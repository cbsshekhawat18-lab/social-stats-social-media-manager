# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
usage measurement + limit enforcement helpers.

Backed by the workspace's Subscription row (which's
billing_views auto-creates on first access). Keep this module thin and
read-only: callers either query (`get_usage`) or check (`check_limit`)
before performing the action.

A limit value of `None` means unlimited.
A limit value of `0` blocks the action entirely.
"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from .billing_plans import get_plan, get_limit
from .models import (
    AgencyClientRelation, AIUsageLog, Client, PlatformCredential,
    Subscription, UnifiedPost,
)


# ─────────────────────────────────────────────────────────────────────────────
# Subscription bootstrapping
# ─────────────────────────────────────────────────────────────────────────────
_LEGACY_PLAN_TO_SKU = {
    'free':           'eu-free',
    'pro':            'eu-pro',
    'premium':        'eu-premium',
    'agency_managed': 'eu-free',  # agency-managed workspaces stay on the free tier
}


def get_or_create_subscription(client: Client) -> Subscription:
    """Free-tier subscriptions are auto-provisioned on first access so the
    rest of the codebase can read `client.subscription` without null-checks."""
    legacy = client.subscription_plan or 'free'
    sku = _LEGACY_PLAN_TO_SKU.get(legacy, legacy if legacy.startswith(('eu-', 'agency-')) else 'eu-free')
    sub, _ = Subscription.objects.get_or_create(
        client=client,
        defaults={'plan': sku, 'status': 'active'},
    )
    return sub


def get_or_create_agency_subscription(agency) -> Subscription:
    """Agency subscriptions are auto-provisioned on the starter tier so the
    this flows can read a usage row without null-checks."""
    sub, _ = Subscription.objects.get_or_create(
        agency=agency,
        defaults={'plan': 'agency-starter', 'status': 'active'},
    )
    return sub


# ─────────────────────────────────────────────────────────────────────────────
# Usage queries
# ─────────────────────────────────────────────────────────────────────────────
def _period_start(sub: Subscription):
    if sub.current_period_start:
        return sub.current_period_start
    # Fall back to the start of the current calendar month
    now = timezone.now()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _connected_platforms(client: Client) -> int:
    return PlatformCredential.objects.filter(client=client, is_active=True).count()


def _posts_this_period(sub: Subscription) -> int:
    return UnifiedPost.objects.filter(
        client=sub.client,
        status__in=('published', 'queued'),
        published_at__gte=_period_start(sub),
    ).count()


def _ai_generations_this_period(sub: Subscription) -> int:
    return AIUsageLog.objects.filter(
        client=sub.client,
        created_at__gte=_period_start(sub),
    ).count()


def _active_relations(client: Client) -> int:
    return AgencyClientRelation.objects.filter(client=client, status='active').count()


def get_usage(client: Client) -> dict:
    """Snapshot of usage vs limits for the workspace's current plan."""
    sub = get_or_create_subscription(client)
    plan = get_plan(sub.plan)
    counts = {
        'connected_platforms':      _connected_platforms(client),
        'posts_per_month':          _posts_this_period(sub),
        'ai_generations_per_month': _ai_generations_this_period(sub),
        'active_relations':         _active_relations(client),
    }
    rows = []
    for key, current in counts.items():
        limit = plan['limits'].get(key)
        rows.append({
            'key':       key,
            'current':   current,
            'limit':     limit,                                    # None → unlimited
            'remaining': None if limit is None else max(0, limit - current),
            'percent':   None if limit in (None, 0) else round(min(100, current * 100 / limit), 1),
        })
    return {
        'subscription': {
            'plan':         sub.plan,
            'plan_label':   plan['label'],
            'status':       sub.status,
            'current_period_end':   sub.current_period_end.isoformat() if sub.current_period_end else None,
            'cancel_at_period_end': sub.cancel_at_period_end,
        },
        'usage': rows,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Limit checks (called by views before performing the action)
# ─────────────────────────────────────────────────────────────────────────────
def check_limit(client: Client, key: str, *, increment: int = 1) -> tuple[bool, str | None, dict | None]:
    """Returns (ok, reason_if_blocked, info_dict).

    `info_dict` is always populated with current/limit so callers can show
    a useful upgrade prompt.
    """
    sub = get_or_create_subscription(client)
    limit = get_limit(sub.plan, key)
    if limit is None:           # unlimited
        return (True, None, {'current': None, 'limit': None, 'plan': sub.plan})

    counter_fns = {
        'connected_platforms':       _connected_platforms,
        'posts_per_month':           lambda c: _posts_this_period(get_or_create_subscription(c)),
        'ai_generations_per_month':  lambda c: _ai_generations_this_period(get_or_create_subscription(c)),
        'active_relations':          _active_relations,
    }
    fn = counter_fns.get(key)
    if not fn:
        return (True, None, {'plan': sub.plan})

    current = fn(client)
    if current + increment > limit:
        return (
            False,
            f'Your {sub.plan} plan allows {limit} {key.replace("_", " ")}; you have {current}.',
            {'current': current, 'limit': limit, 'plan': sub.plan, 'key': key},
        )
    return (True, None, {'current': current, 'limit': limit, 'plan': sub.plan, 'key': key})


# ─────────────────────────────────────────────────────────────────────────────
# Agency-side usage + checks 
# ─────────────────────────────────────────────────────────────────────────────
def _managed_clients(agency) -> int:
    return AgencyClientRelation.objects.filter(agency=agency, status='active').count()


def get_agency_usage(agency) -> dict:
    sub = get_or_create_agency_subscription(agency)
    plan = get_plan(sub.plan)
    current = _managed_clients(agency)
    limit = plan['limits'].get('managed_clients')
    return {
        'subscription': {
            'plan':         sub.plan,
            'plan_label':   plan['label'],
            'status':       sub.status,
            'current_period_end':   sub.current_period_end.isoformat() if sub.current_period_end else None,
            'cancel_at_period_end': sub.cancel_at_period_end,
        },
        'usage': [{
            'key':       'managed_clients',
            'current':   current,
            'limit':     limit,
            'remaining': None if limit is None else max(0, limit - current),
            'percent':   None if limit in (None, 0) else round(min(100, current * 100 / limit), 1),
        }],
    }


def check_agency_limit(agency, key: str, *, increment: int = 1) -> tuple[bool, str | None, dict | None]:
    """Same shape as `check_limit` but for agency-side keys (managed_clients)."""
    sub = get_or_create_agency_subscription(agency)
    limit = get_limit(sub.plan, key)
    if limit is None:
        return (True, None, {'current': None, 'limit': None, 'plan': sub.plan})
    if key != 'managed_clients':
        return (True, None, {'plan': sub.plan})
    current = _managed_clients(agency)
    if current + increment > limit:
        return (
            False,
            f'Your {sub.plan} plan allows {limit} active managed client{"s" if limit != 1 else ""}; you currently manage {current}. Upgrade to onboard more.',
            {'current': current, 'limit': limit, 'plan': sub.plan, 'key': key},
        )
    return (True, None, {'current': current, 'limit': limit, 'plan': sub.plan, 'key': key})
