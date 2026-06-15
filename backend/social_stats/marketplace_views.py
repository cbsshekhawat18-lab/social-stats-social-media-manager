# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Public marketplace endpoints + agency-side profile editing.

Public endpoints (AllowAny):
    GET  /api/marketplace/agencies/          — list listed-and-verified agencies
    GET  /api/marketplace/agencies/<slug>/   — agency profile detail
    GET  /api/marketplace/featured/          — top-rated subset
    GET  /api/marketplace/categories/        — industry / service facets

Agency-owner endpoints (IsAuthenticated, member of the agency):
    GET  /api/agency/<slug>/                  — full profile (incl. private fields)
    PUT  /api/agency/<slug>/                  — edit profile
    POST /api/marketplace/agencies/<slug>/contact/ — send a non-binding inquiry
"""
from __future__ import annotations

import logging
from collections import Counter

from django.db.models import F, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    Agency, AgencyMembership, AgencyReview,
)


logger = logging.getLogger(__name__)


# Editable fields when an agency owner/admin updates their profile.
EDITABLE_FIELDS = (
    'name', 'logo_url', 'description', 'website',
    'location_city', 'location_country',
    'industries_served', 'services_offered',
    'pricing_starting_at', 'pricing_currency',
    'is_listed_in_marketplace',
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _is_agency_member(user, agency: Agency, *, roles=None) -> bool:
    if not user or not user.is_authenticated:
        return False
    qs = AgencyMembership.objects.filter(user=user, agency=agency, is_active=True)
    if roles:
        qs = qs.filter(role__in=roles)
    return qs.exists()


def _serialize_agency_public(a: Agency, *, full: bool = False) -> dict:
    out = {
        'id':                a.id,
        'name':              a.name,
        'slug':              a.slug,
        'logo_url':          a.logo_url,
        'description':       a.description,
        'website':           a.website,
        'location_city':     a.location_city,
        'location_country':  a.location_country,
        'location':          ', '.join([p for p in (a.location_city, a.location_country) if p]),
        'industries_served': a.industries_served,
        'services_offered':  a.services_offered,
        'pricing_starting_at': float(a.pricing_starting_at) if a.pricing_starting_at is not None else None,
        'pricing_currency':  a.pricing_currency,
        'is_verified':       a.is_verified,
        'avg_rating':        a.avg_rating,
        'review_count':      a.review_count,
        'active_clients_count': a.active_clients_count,
    }
    if full:
        out.update({
            'is_listed_in_marketplace': a.is_listed_in_marketplace,
            'plan':                     a.plan,
            'plan_client_limit':        a.plan_client_limit,
            'is_active':                a.is_active,
            'created_at':               a.created_at.isoformat() if a.created_at else None,
        })
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 1. Public list (browse)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def list_marketplace_agencies(request):
    """List listed (and active) agencies with optional filters.

    Query params:
        q              fuzzy search (name / description / location)
        industry       a value that must appear in industries_served
        service        a value that must appear in services_offered
        location       fuzzy on city/country
        rating_min     float
        price_max      float (against pricing_starting_at)
        verified       '1' to require verified
        sort           'relevance' (default) | 'rating' | 'newest' | 'cheapest'
        page           1-based; default 1
        page_size      default 20, max 50
    """
    p = request.query_params

    qs = Agency.objects.filter(is_listed_in_marketplace=True, is_active=True)

    if p.get('verified') in ('1', 'true', 'True'):
        qs = qs.filter(is_verified=True)

    q = (p.get('q') or '').strip()
    if q:
        qs = qs.filter(
            Q(name__icontains=q)
            | Q(description__icontains=q)
            | Q(location_city__icontains=q)
        )

    industry = (p.get('industry') or '').strip()
    if industry:
        qs = qs.filter(industries_served__contains=[industry])

    service = (p.get('service') or '').strip()
    if service:
        qs = qs.filter(services_offered__contains=[service])

    location = (p.get('location') or '').strip()
    if location:
        qs = qs.filter(
            Q(location_city__icontains=location) | Q(location_country__icontains=location)
        )

    try:
        rating_min = float(p.get('rating_min') or 0)
    except (TypeError, ValueError):
        rating_min = 0
    if rating_min > 0:
        qs = qs.filter(avg_rating__gte=rating_min)

    try:
        price_max = float(p['price_max']) if p.get('price_max') else None
    except (TypeError, ValueError):
        price_max = None
    if price_max is not None:
        qs = qs.filter(pricing_starting_at__lte=price_max)

    sort = (p.get('sort') or 'relevance').strip()
    if sort == 'rating':
        qs = qs.order_by('-avg_rating', '-review_count', '-created_at')
    elif sort == 'newest':
        qs = qs.order_by('-created_at')
    elif sort == 'cheapest':
        qs = qs.order_by(F('pricing_starting_at').asc(nulls_last=True), '-avg_rating')
    else:
        # "relevance" — verified first, then rating, then created_at
        qs = qs.order_by('-is_verified', '-avg_rating', '-review_count', '-created_at')

    try:
        page = max(1, int(p.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = max(1, min(int(p.get('page_size', 20) or 20), 50))
    except (TypeError, ValueError):
        page_size = 20

    total = qs.count()
    rows = list(qs[(page - 1) * page_size: page * page_size])

    return Response({
        'count':     total,
        'page':      page,
        'page_size': page_size,
        'has_next':  page * page_size < total,
        'agencies':  [_serialize_agency_public(a) for a in rows],
    })


# ─────────────────────────────────────────────────────────────────────────────
# 2. Public detail
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def get_marketplace_agency(request, slug):
    try:
        a = Agency.objects.get(slug=slug)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)

    if not a.is_listed_in_marketplace and not _is_agency_member(request.user, a):
        return Response({'error': 'agency not found'}, status=404)

    Agency.objects.filter(pk=a.pk).update(marketplace_profile_views=F('marketplace_profile_views') + 1)

    payload = _serialize_agency_public(a)

    # Top reviews surface
    reviews_qs = (
        AgencyReview.objects
        .filter(agency=a, is_approved=True)
        .select_related('reviewer_user')
        .order_by('-created_at')[:5]
    )
    payload['reviews'] = [{
        'id':            r.id,
        'rating':        r.rating,
        'title':         r.title,
        'body':          r.body,
        'pros':          r.pros,
        'cons':          r.cons,
        'reviewer':      (r.reviewer_user.get_full_name() or '').strip() or r.reviewer_user.email.split('@')[0],
        'is_verified':   r.is_verified,
        'agency_response': r.agency_response,
        'helpful_count': r.helpful_count,
        'created_at':    r.created_at.isoformat() if r.created_at else None,
    } for r in reviews_qs]

    return Response(payload)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Featured
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def list_featured(request):
    """Top-of-funnel: verified, listed, with at least 1 review, sorted by rating."""
    qs = (
        Agency.objects
        .filter(is_listed_in_marketplace=True, is_active=True, is_verified=True)
        .order_by('-avg_rating', '-review_count', '-created_at')[:6]
    )
    return Response({'agencies': [_serialize_agency_public(a) for a in qs]})


# ─────────────────────────────────────────────────────────────────────────────
# 4. Categories / facets (for filter UI)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def list_categories(request):
    """Aggregate industries_served and services_offered counts so the
    browse filter UI can show population per facet."""
    rows = list(
        Agency.objects.filter(is_listed_in_marketplace=True, is_active=True)
        .values_list('industries_served', 'services_offered')
    )
    industries = Counter()
    services   = Counter()
    for ind_list, svc_list in rows:
        if isinstance(ind_list, list):
            for v in ind_list:
                if v: industries[v] += 1
        if isinstance(svc_list, list):
            for v in svc_list:
                if v: services[v] += 1

    return Response({
        'industries': [{'value': k, 'count': c} for k, c in industries.most_common()],
        'services':   [{'value': k, 'count': c} for k, c in services.most_common()],
    })


# ─────────────────────────────────────────────────────────────────────────────
# 5. Contact (auth user sends inquiry)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contact_agency(request, slug):
    """Lightweight inquiry — creates a Notification for the agency owner.
    Distinct from `agency_invite`  which establishes a relation."""
    try:
        a = Agency.objects.get(slug=slug)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)
    if not a.is_listed_in_marketplace:
        return Response({'error': 'agency is not currently accepting inquiries'}, status=400)

    message = (request.data.get('message') or '').strip()
    if not message:
        return Response({'error': 'message is required'}, status=400)

    sender_name = (request.user.get_full_name() or '').strip() or request.user.email
    from .notification_dispatcher import dispatch as _dispatch
    _dispatch(
        a.owner_user,
        event_type='marketplace_inquiry',
        title=f'{sender_name} is interested in working with you',
        body=message,
        data={
            'kind':       'marketplace_inquiry',
            'sender_id':  request.user.id,
            'sender_email': request.user.email,
            'agency_slug': a.slug,
        },
    )
    return Response({'ok': True})


# ─────────────────────────────────────────────────────────────────────────────
# 6. Agency profile fetch + edit (owner-side)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def agency_profile(request, slug):
    try:
        a = Agency.objects.get(slug=slug)
    except Agency.DoesNotExist:
        return Response({'error': 'agency not found'}, status=404)

    if not _is_agency_member(request.user, a):
        return Response({'error': 'forbidden'}, status=403)

    if request.method == 'GET':
        return Response(_serialize_agency_public(a, full=True))

    # PUT — owner / admin only
    if not _is_agency_member(request.user, a, roles=('owner', 'admin')):
        return Response({'error': 'only an agency owner or admin can edit'}, status=403)

    data = request.data or {}
    changed = []
    for f in EDITABLE_FIELDS:
        if f not in data:
            continue
        val = data[f]
        # Coerce numeric fields
        if f == 'pricing_starting_at':
            try:
                val = float(val) if val not in (None, '') else None
            except (TypeError, ValueError):
                continue
        # JSON list fields — accept arrays
        if f in ('industries_served', 'services_offered') and not isinstance(val, list):
            continue
        # Booleans
        if f == 'is_listed_in_marketplace':
            val = bool(val)
        setattr(a, f, val)
        changed.append(f)

    if changed:
        a.updated_at = timezone.now()
        a.save(update_fields=[*changed, 'updated_at'])

    return Response(_serialize_agency_public(a, full=True))
