# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
End-user billing endpoints.

Endpoints:
    GET  /api/billing/plans/                 — public plan catalog (eu-* tiers)
    GET  /api/billing/subscription/          — current user's workspace subscription + usage
    POST /api/billing/checkout/              — create a Razorpay order (stubbed in dev)
    POST /api/billing/confirm/               — confirm payment client-side (stubbed flow)
    POST /api/billing/cancel/                — schedule cancellation at period end
    GET  /api/billing/invoices/              — list past invoices for the workspace
    POST /api/billing/webhook/razorpay/      — Razorpay webhook handler (signature-verified)

Razorpay strategy:
    - In dev / when RAZORPAY_KEY_ID is unset: the checkout endpoint returns a
      `test_mode=True` order envelope; `confirm` simulates a paid invoice and
      flips the subscription to the new plan immediately. This keeps the full
      upgrade UX testable end-to-end without live keys.
    - In prod: `checkout` calls Razorpay to create an order; the frontend
      mounts Razorpay Checkout; on success it POSTs payment_id + signature to
      `confirm`, which validates and waits for the webhook to confirm.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .billing_plans import PLANS, get_plan, list_plans
from .end_user_views import _workspace_for
from .models import Agency, AgencyMembership, Client, Invoice, Subscription
from .usage_limits import (
    get_or_create_subscription, get_usage,
    get_or_create_agency_subscription, get_agency_usage,
)


logger = logging.getLogger(__name__)


def _razorpay_configured() -> bool:
    return bool(getattr(settings, 'RAZORPAY_KEY_ID', '') and getattr(settings, 'RAZORPAY_KEY_SECRET', ''))


def _serialize_subscription(sub: Subscription) -> dict:
    plan = get_plan(sub.plan)
    return {
        'plan':            sub.plan,
        'plan_label':      plan['label'],
        'plan_features':   plan['features'],
        'price':           plan['price'],
        'currency':        plan['currency'],
        'status':          sub.status,
        'started_at':      sub.started_at.isoformat() if sub.started_at else None,
        'current_period_start': sub.current_period_start.isoformat() if sub.current_period_start else None,
        'current_period_end':   sub.current_period_end.isoformat() if sub.current_period_end else None,
        'cancel_at_period_end': sub.cancel_at_period_end,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. Plan catalog
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def billing_plans(request):
    side = request.query_params.get('side') or 'end_user'
    return Response({'plans': list_plans(side=side)})


# ─────────────────────────────────────────────────────────────────────────────
# 2. Current subscription + usage
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_subscription(request):
    workspace = _workspace_for(request.user)
    if not workspace:
        return Response({'error': 'no workspace owned by this user'}, status=404)
    sub = get_or_create_subscription(workspace)
    return Response({
        'subscription': _serialize_subscription(sub),
 **get_usage(workspace), # adds usage[] rows for the meter UI
    })


# ─────────────────────────────────────────────────────────────────────────────
# 3. Checkout (create Razorpay order)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def billing_checkout(request):
    """POST {plan}. Returns a Razorpay order envelope the frontend mounts.

    In dev (no Razorpay keys): returns `{test_mode: true, order_id: 'test_…'}`
    so the frontend can call /confirm/ directly.
    """
    workspace = _workspace_for(request.user)
    if not workspace:
        return Response({'error': 'no workspace owned by this user'}, status=404)

    target_plan = request.data.get('plan')
    if target_plan not in PLANS or PLANS[target_plan]['side'] != 'end_user':
        return Response({'error': 'unknown plan'}, status=400)
    plan = PLANS[target_plan]
    if plan['price'] in (None, 0):
        return Response({'error': 'free plan needs no checkout'}, status=400)

    sub = get_or_create_subscription(workspace)
    if sub.plan == target_plan and sub.status == 'active':
        return Response({'error': 'already on this plan'}, status=400)

    # Dev / test mode — no Razorpay call
    if not _razorpay_configured():
        order_id = f'test_order_{workspace.id}_{int(timezone.now().timestamp())}'
        return Response({
            'test_mode':  True,
            'plan':       target_plan,
            'amount':     plan['price'],
            'currency':   plan['currency'],
            'order_id':   order_id,
            'key_id':     '',
        })

    # Live Razorpay path
    try:
        import razorpay  # type: ignore
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order = client.order.create({
            'amount':   plan['price'],
            'currency': plan['currency'],
            'receipt':  f'ws-{workspace.id}-{int(timezone.now().timestamp())}',
            'notes':    {'workspace_id': workspace.id, 'plan': target_plan},
        })
        return Response({
            'test_mode':  False,
            'plan':       target_plan,
            'amount':     plan['price'],
            'currency':   plan['currency'],
            'order_id':   order['id'],
            'key_id':     settings.RAZORPAY_KEY_ID,
        })
    except Exception as e:  # noqa: BLE001
        logger.exception('razorpay order create failed')
        return Response({'error': f'checkout failed: {e}'}, status=502)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Confirm (after Razorpay Checkout success OR test-mode short-circuit)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def billing_confirm(request):
    """POST {plan, order_id, payment_id?, signature?}.

    Test mode (`order_id` startswith 'test_'): skip signature, flip the
    plan immediately, write a stub Invoice.

    Live mode: verify Razorpay signature; flip plan to `pending` until the
    webhook delivers the final paid state.
    """
    workspace = _workspace_for(request.user)
    if not workspace:
        return Response({'error': 'no workspace owned by this user'}, status=404)

    target_plan = request.data.get('plan')
    order_id    = request.data.get('order_id') or ''
    payment_id  = request.data.get('payment_id') or ''
    signature   = request.data.get('signature')  or ''

    if target_plan not in PLANS:
        return Response({'error': 'unknown plan'}, status=400)
    plan = PLANS[target_plan]

    sub = get_or_create_subscription(workspace)

    # Dev / test mode: trust the call, flip plan immediately
    if order_id.startswith('test_') or not _razorpay_configured():
        sub.plan   = target_plan
        sub.status = 'active'
        sub.current_period_start = timezone.now()
        sub.current_period_end   = timezone.now() + timedelta(days=30)
        sub.cancel_at_period_end = False
        sub.save()

        Invoice.objects.create(
            subscription=sub,
            razorpay_invoice_id='',
            razorpay_payment_id=payment_id or f'test_payment_{int(timezone.now().timestamp())}',
            amount=plan['price'] / 100 if plan['price'] else 0,
            currency=plan['currency'],
            status='paid',
            period_start=sub.current_period_start,
            period_end=sub.current_period_end,
        )

        # Mirror the plan onto the Client row so the rest of the codebase reads
        # the right tier without a join.
        Client.objects.filter(pk=workspace.pk).update(subscription_plan=target_plan)
        return Response({
            'ok': True, 'subscription': _serialize_subscription(sub), 'test_mode': True,
        })

    # Live mode: verify signature
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f'{order_id}|{payment_id}'.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return Response({'error': 'invalid signature'}, status=400)

    # Mark pending; webhook will flip to active once Razorpay confirms
    sub.plan   = target_plan
    sub.status = 'trialing'
    sub.save(update_fields=['plan', 'status'])
    return Response({'ok': True, 'subscription': _serialize_subscription(sub), 'awaiting_webhook': True})


# ─────────────────────────────────────────────────────────────────────────────
# 5. Cancel at period end
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def billing_cancel(request):
    workspace = _workspace_for(request.user)
    if not workspace:
        return Response({'error': 'no workspace owned by this user'}, status=404)
    sub = get_or_create_subscription(workspace)
    if sub.plan == 'eu-free':
        return Response({'error': 'free plan cannot be cancelled'}, status=400)
    sub.cancel_at_period_end = True
    sub.save(update_fields=['cancel_at_period_end'])
    return Response({'ok': True, 'subscription': _serialize_subscription(sub)})


# ─────────────────────────────────────────────────────────────────────────────
# 6. Invoices
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_invoices(request):
    workspace = _workspace_for(request.user)
    if not workspace:
        return Response({'error': 'no workspace owned by this user'}, status=404)
    sub = get_or_create_subscription(workspace)
    invoices = list(sub.invoices.all()[:50])
    return Response({
        'invoices': [{
            'id':            i.id,
            'amount':        float(i.amount),
            'currency':      i.currency,
            'status':        i.status,
            'period_start':  i.period_start.isoformat() if i.period_start else None,
            'period_end':    i.period_end.isoformat() if i.period_end else None,
            'pdf_url':       i.pdf_url,
            'created_at':    i.created_at.isoformat() if i.created_at else None,
        } for i in invoices],
    })


# ─────────────────────────────────────────────────────────────────────────────
# 7. Razorpay webhook
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def billing_razorpay_webhook(request):
    """Verify HMAC, then update Subscription + write an Invoice row.

    Stubbed in dev: returns 200 silently when the webhook secret is unset.
    In prod the secret comes from settings.RAZORPAY_WEBHOOK_SECRET.
    """
    secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')
    if not secret:
        return Response({'ok': True, 'note': 'webhook secret not configured; ignoring'})

    sig = request.META.get('HTTP_X_RAZORPAY_SIGNATURE', '')
    body = request.body or b''
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return Response({'error': 'invalid signature'}, status=400)

    try:
        payload = json.loads(body.decode())
    except Exception:
        return Response({'error': 'invalid payload'}, status=400)

    event = payload.get('event', '')
    if event in ('subscription.activated', 'subscription.charged'):
        sub_id = payload.get('payload', {}).get('subscription', {}).get('entity', {}).get('id')
        if sub_id:
            Subscription.objects.filter(razorpay_subscription_id=sub_id).update(
                status='active', updated_at=timezone.now(),
            )
    elif event in ('subscription.cancelled', 'subscription.halted'):
        sub_id = payload.get('payload', {}).get('subscription', {}).get('entity', {}).get('id')
        if sub_id:
            Subscription.objects.filter(razorpay_subscription_id=sub_id).update(
                status='cancelled' if event.endswith('cancelled') else 'halted',
                updated_at=timezone.now(),
            )
    elif event == 'payment.failed':
        sub_id = payload.get('payload', {}).get('subscription', {}).get('entity', {}).get('id', '')
        if sub_id:
            Subscription.objects.filter(razorpay_subscription_id=sub_id).update(
                status='past_due', updated_at=timezone.now(),
            )

    return Response({'ok': True})


# ─────────────────────────────────────────────────────────────────────────────
# Agency-side billing ()
# ─────────────────────────────────────────────────────────────────────────────
def _resolve_agency_member(user, slug, *, admin_required=False):
    """Returns (agency, error_response). Caller short-circuits on error."""
    try:
        agency = Agency.objects.get(slug=slug)
    except Agency.DoesNotExist:
        return (None, Response({'error': 'agency not found'}, status=404))
    qs = AgencyMembership.objects.filter(user=user, agency=agency, is_active=True)
    if admin_required:
        qs = qs.filter(role__in=('owner', 'admin'))
    if not qs.exists():
        return (None, Response({'error': 'forbidden'}, status=403))
    return (agency, None)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agency_subscription(request, slug):
    agency, err = _resolve_agency_member(request.user, slug)
    if err: return err
    sub = get_or_create_agency_subscription(agency)
    return Response({
        'subscription': _serialize_subscription(sub),
 **get_agency_usage(agency),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agency_billing_checkout(request, slug):
    agency, err = _resolve_agency_member(request.user, slug, admin_required=True)
    if err: return err

    target_plan = request.data.get('plan')
    if target_plan not in PLANS or PLANS[target_plan]['side'] != 'agency':
        return Response({'error': 'unknown plan'}, status=400)
    plan = PLANS[target_plan]
    if plan['price'] in (None, 0):
        return Response({'error': 'this plan has no online checkout — contact sales'}, status=400)

    sub = get_or_create_agency_subscription(agency)
    if sub.plan == target_plan and sub.status == 'active':
        return Response({'error': 'already on this plan'}, status=400)

    if not _razorpay_configured():
        order_id = f'test_order_ag_{agency.id}_{int(timezone.now().timestamp())}'
        return Response({
            'test_mode': True,
            'plan':      target_plan,
            'amount':    plan['price'],
            'currency':  plan['currency'],
            'order_id':  order_id,
            'key_id':    '',
        })

    try:
        import razorpay  # type: ignore
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        order = client.order.create({
            'amount':   plan['price'],
            'currency': plan['currency'],
            'receipt':  f'ag-{agency.id}-{int(timezone.now().timestamp())}',
            'notes':    {'agency_id': agency.id, 'plan': target_plan},
        })
        return Response({
            'test_mode': False,
            'plan':      target_plan,
            'amount':    plan['price'],
            'currency':  plan['currency'],
            'order_id':  order['id'],
            'key_id':    settings.RAZORPAY_KEY_ID,
        })
    except Exception as e:  # noqa: BLE001
        logger.exception('razorpay agency order create failed')
        return Response({'error': f'checkout failed: {e}'}, status=502)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agency_billing_confirm(request, slug):
    agency, err = _resolve_agency_member(request.user, slug, admin_required=True)
    if err: return err

    target_plan = request.data.get('plan')
    order_id    = request.data.get('order_id') or ''
    payment_id  = request.data.get('payment_id') or ''
    signature   = request.data.get('signature')  or ''

    if target_plan not in PLANS or PLANS[target_plan]['side'] != 'agency':
        return Response({'error': 'unknown plan'}, status=400)
    plan = PLANS[target_plan]

    sub = get_or_create_agency_subscription(agency)

    if order_id.startswith('test_') or not _razorpay_configured():
        sub.plan   = target_plan
        sub.status = 'active'
        sub.current_period_start = timezone.now()
        sub.current_period_end   = timezone.now() + timedelta(days=30)
        sub.cancel_at_period_end = False
        sub.save()

        Invoice.objects.create(
            subscription=sub,
            razorpay_invoice_id='',
            razorpay_payment_id=payment_id or f'test_payment_{int(timezone.now().timestamp())}',
            amount=plan['price'] / 100 if plan['price'] else 0,
            currency=plan['currency'],
            status='paid',
            period_start=sub.current_period_start,
            period_end=sub.current_period_end,
        )
        # Mirror the plan + cap onto the Agency row
        Agency.objects.filter(pk=agency.pk).update(
            plan=target_plan.replace('agency-', ''),
            plan_client_limit=plan['limits'].get('managed_clients') or 0,
        )
        return Response({
            'ok': True, 'subscription': _serialize_subscription(sub), 'test_mode': True,
        })

    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(),
        f'{order_id}|{payment_id}'.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return Response({'error': 'invalid signature'}, status=400)

    sub.plan   = target_plan
    sub.status = 'trialing'
    sub.save(update_fields=['plan', 'status'])
    return Response({'ok': True, 'subscription': _serialize_subscription(sub), 'awaiting_webhook': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agency_billing_cancel(request, slug):
    agency, err = _resolve_agency_member(request.user, slug, admin_required=True)
    if err: return err
    sub = get_or_create_agency_subscription(agency)
    if sub.plan == 'agency-starter':
        return Response({'error': 'starter plan cannot be cancelled — downgrade by contacting support'}, status=400)
    sub.cancel_at_period_end = True
    sub.save(update_fields=['cancel_at_period_end'])
    return Response({'ok': True, 'subscription': _serialize_subscription(sub)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agency_billing_invoices(request, slug):
    agency, err = _resolve_agency_member(request.user, slug)
    if err: return err
    sub = get_or_create_agency_subscription(agency)
    invoices = list(sub.invoices.all()[:50])
    return Response({
        'invoices': [{
            'id':           i.id,
            'amount':       float(i.amount),
            'currency':     i.currency,
            'status':       i.status,
            'period_start': i.period_start.isoformat() if i.period_start else None,
            'period_end':   i.period_end.isoformat()   if i.period_end   else None,
            'pdf_url':      i.pdf_url,
            'created_at':   i.created_at.isoformat()   if i.created_at   else None,
        } for i in invoices],
    })
