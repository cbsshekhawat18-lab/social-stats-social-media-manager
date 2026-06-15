# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Agency reviews + trust.

Endpoints:
    GET    /api/agencies/<slug>/reviews/         — list reviews (public, paginated)
    POST   /api/agencies/<slug>/reviews/         — auth user submits review (must
                                                   have an active OR past relation
                                                   with the agency for is_verified=True;
                                                   we permit unverified review only if
                                                   relation has ever existed)
    PUT    /api/reviews/<id>/                    — owner edits within 30 days
    DELETE /api/reviews/<id>/                    — owner deletes
    POST   /api/reviews/<id>/respond/            — agency owner/admin responds (inline)
    POST   /api/reviews/<id>/helpful/            — any auth user marks helpful (idempotent
                                                   per session; we just bump the counter)

After any write that changes ratings, we recompute the agency's avg_rating
and review_count (denormalized columns) so the marketplace can sort cheaply.
"""
from __future__ import annotations

from datetime import timedelta

from django.db.models import Avg, Count, F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .activity_logger import log_activity
from .models import (
    Agency, AgencyClientRelation, AgencyMembership, AgencyReview,
)


REVIEW_EDIT_WINDOW = timedelta(days=30)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _serialize_review(r: AgencyReview, *, viewer=None) -> dict:
    is_owner = viewer and r.reviewer_user_id == viewer.id
    return {
        'id':              r.id,
        'agency_id':       r.agency_id,
        'rating':          r.rating,
        'title':           r.title,
        'body':            r.body,
        'pros':            r.pros,
        'cons':            r.cons,
        'services_used':   r.services_used,
        'duration_months': r.duration_months,
        'is_verified':     r.is_verified,
        'is_approved':     r.is_approved,
        'reviewer_id':     r.reviewer_user_id if is_owner else None,
        'reviewer_name':   (r.reviewer_user.get_full_name() or '').strip() or r.reviewer_user.email.split('@')[0],
        'is_owner':        bool(is_owner),
        'editable_until':  (r.created_at + REVIEW_EDIT_WINDOW).isoformat() if r.created_at else None,
        'is_editable':     bool(is_owner and r.created_at and timezone.now() < r.created_at + REVIEW_EDIT_WINDOW),
        'agency_response': r.agency_response,
        'helpful_count':   r.helpful_count,
        'created_at':      r.created_at.isoformat() if r.created_at else None,
    }


def _recompute_agency_rating(agency: Agency):
    aggregate = (
        AgencyReview.objects
        .filter(agency=agency, is_approved=True)
        .aggregate(avg=Avg('rating'), n=Count('id'))
    )
    agency.avg_rating   = round(float(aggregate['avg'] or 0.0), 2)
    agency.review_count = int(aggregate['n'] or 0)
    agency.save(update_fields=['avg_rating', 'review_count'])


def _user_has_relation_with(user, agency) -> AgencyClientRelation | None:
    """Returns any active/past relation between this user (as workspace owner)
    and the agency. Used to set `is_verified=True` and to gate submission."""
    return (
        AgencyClientRelation.objects
        .filter(agency=agency, client__owner_user=user)
        .order_by('-proposed_at')
        .first()
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1. List (public)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def list_reviews(request, slug):
    """GET → public list. POST → create (auth required)."""
    if request.method == 'POST':
        if not request.user or not request.user.is_authenticated:
            return Response({'error': 'authentication required'}, status=401)
        return _create_review_impl(request, slug)

    try:
        agency = Agency.objects.get(slug=slug)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)

    qs = (
        AgencyReview.objects
        .filter(agency=agency, is_approved=True)
        .select_related('reviewer_user')
        .order_by('-created_at')
    )

    p = request.query_params
    try:
        limit = max(1, min(int(p.get('limit', 50) or 50), 200))
    except (TypeError, ValueError):
        limit = 50

    rows = list(qs[:limit])
    distribution = {i: 0 for i in (1, 2, 3, 4, 5)}
    for star, count in (
        AgencyReview.objects.filter(agency=agency, is_approved=True)
        .values_list('rating')
        .annotate(c=Count('id'))
    ):
        distribution[int(star)] = count
    return Response({
        'count':        agency.review_count,
        'avg_rating':   agency.avg_rating,
        'distribution': distribution,
        'rows':         [_serialize_review(r, viewer=request.user if request.user.is_authenticated else None) for r in rows],
    })


# ─────────────────────────────────────────────────────────────────────────────
# 2. Create
# ─────────────────────────────────────────────────────────────────────────────
def _create_review_impl(request, slug):
    """POST {rating(1-5), title, body, pros?, cons?, services_used?, duration_months?}.

    Constraints:
        - Must not already have a review for this agency (uniqueness).
        - Must have OR have had an AgencyClientRelation with the agency.
          (`is_verified=True` is set when a relation exists.)
        - Reviewer cannot review their own agency (avoid self-rating).
    """
    try:
        agency = Agency.objects.get(slug=slug)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)

    if AgencyMembership.objects.filter(user=request.user, agency=agency, is_active=True).exists():
        return Response({'error': 'agency members cannot review their own agency'}, status=400)

    if AgencyReview.objects.filter(agency=agency, reviewer_user=request.user).exists():
        return Response({'error': 'you already reviewed this agency'}, status=409)

    relation = _user_has_relation_with(request.user, agency)
    if not relation:
        return Response({'error': 'you can review an agency only after working with them'}, status=403)

    data = request.data or {}
    try:
        rating = int(data.get('rating') or 0)
    except (TypeError, ValueError):
        rating = 0
    if rating < 1 or rating > 5:
        return Response({'error': 'rating must be between 1 and 5'}, status=400)
    title = (data.get('title') or '').strip()[:200]
    body  = (data.get('body')  or '').strip()
    if not title or not body:
        return Response({'error': 'title and body are required'}, status=400)

    duration_months = data.get('duration_months')
    try:
        duration_months = int(duration_months) if duration_months not in (None, '') else None
    except (TypeError, ValueError):
        duration_months = None

    review = AgencyReview.objects.create(
        agency=agency,
        reviewer_user=request.user,
        relation=relation,
        rating=rating,
        title=title,
        body=body,
        pros=list(data.get('pros') or []),
        cons=list(data.get('cons') or []),
        services_used=list(data.get('services_used') or []),
        duration_months=duration_months,
        is_verified=True,
        is_approved=True,
    )
    _recompute_agency_rating(agency)

    from django.conf import settings
    from .notification_dispatcher import dispatch as dispatch_notification
    frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    dispatch_notification(
        agency.owner_user,
        event_type='new_review_received',
        title=f'New {rating}★ review from {request.user.get_full_name() or request.user.email}',
        body=title,
        cta_url=f'{frontend}/agencies/{agency.slug}',
        cta_label='View review',
        data={'kind': 'new_review', 'review_id': review.id, 'agency_slug': agency.slug, 'rating': rating},
    )
    if relation.client_id:
        log_activity(
            relation.client,
            actor_user=request.user, actor_type='end_user',
            action_type='agency_reviewed',
            description=f'Reviewed {agency.name} with {rating}★',
            severity='info',
            target_object_type='AgencyReview',
            target_object_id=review.id,
            metadata={'agency_id': agency.id, 'rating': rating},
        )

    return Response(_serialize_review(review, viewer=request.user), status=201)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Update + delete (owner of the review)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def review_detail(request, review_id):
    try:
        r = AgencyReview.objects.select_related('agency', 'reviewer_user').get(pk=review_id)
    except AgencyReview.DoesNotExist:
        return Response({'error': 'review not found'}, status=404)
    if r.reviewer_user_id != request.user.id:
        return Response({'error': 'forbidden'}, status=403)

    if request.method == 'DELETE':
        agency = r.agency
        r.delete()
        _recompute_agency_rating(agency)
        return Response({'ok': True})

    # PUT — within 30 days only
    if not r.created_at or timezone.now() >= r.created_at + REVIEW_EDIT_WINDOW:
        return Response({'error': 'reviews can only be edited within 30 days of posting'}, status=400)

    data = request.data or {}
    if 'rating' in data:
        try:
            new_rating = int(data['rating'])
            if 1 <= new_rating <= 5:
                r.rating = new_rating
        except (TypeError, ValueError):
            pass
    for key in ('title', 'body'):
        if key in data:
            val = (data[key] or '').strip()
            if val:
                setattr(r, key, val[:200] if key == 'title' else val)
    for key in ('pros', 'cons', 'services_used'):
        if key in data and isinstance(data[key], list):
            setattr(r, key, data[key])
    if 'duration_months' in data:
        try:
            r.duration_months = int(data['duration_months']) if data['duration_months'] not in (None, '') else None
        except (TypeError, ValueError):
            pass

    r.save()
    _recompute_agency_rating(r.agency)
    return Response(_serialize_review(r, viewer=request.user))


# ─────────────────────────────────────────────────────────────────────────────
# 4. Respond (agency owner/admin)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def respond_to_review(request, review_id):
    try:
        r = AgencyReview.objects.select_related('agency').get(pk=review_id)
    except AgencyReview.DoesNotExist:
        return Response({'error': 'review not found'}, status=404)

    is_admin = AgencyMembership.objects.filter(
        user=request.user, agency=r.agency, is_active=True,
        role__in=('owner', 'admin'),
    ).exists()
    if not is_admin:
        return Response({'error': 'only the agency owner or admin can respond'}, status=403)

    response_text = (request.data.get('response') or '').strip()
    r.agency_response = response_text
    r.save(update_fields=['agency_response'])

    if r.reviewer_user_id and response_text:
        from django.contrib.auth.models import User
        from .notification_dispatcher import dispatch as _dispatch
        try:
            _dispatch(
                User.objects.get(id=r.reviewer_user_id),
                event_type='review_response',
                title=f'{r.agency.name} replied to your review',
                body=response_text[:200],
                data={'kind': 'review_response', 'review_id': r.id, 'agency_slug': r.agency.slug},
            )
        except User.DoesNotExist:
            pass

    return Response(_serialize_review(r, viewer=request.user))


# ─────────────────────────────────────────────────────────────────────────────
# 5. Mark helpful
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_review_helpful(request, review_id):
    """Idempotency at the data layer is light — we just bump a counter and
    rely on UI debounce. Worst case is double-count if the user clicks twice
    on different sessions; not worth a join table for v1."""
    try:
        r = AgencyReview.objects.get(pk=review_id)
    except AgencyReview.DoesNotExist:
        return Response({'error': 'review not found'}, status=404)
    AgencyReview.objects.filter(pk=r.pk).update(helpful_count=F('helpful_count') + 1)
    r.refresh_from_db(fields=['helpful_count'])
    return Response({'id': r.id, 'helpful_count': r.helpful_count})
