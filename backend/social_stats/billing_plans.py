# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Plan catalog — retained only so existing imports (usage_limits, serializers,
the account-type model) keep resolving. The product is now free and
open-source: there are no paid tiers and every quota is unlimited.

Every plan's `limits` are `None` (unlimited). `get_limit()` returns `None` for
any key, so `usage_limits.check_limit()` always allows the action. The two
account *types* (end_user vs agency) still exist for role separation — that
lives in the permission layer, not here.
"""
from __future__ import annotations


def _unlimited(sku: str, side: str, label: str) -> dict:
    """A plan whose every quota is unlimited."""
    return {
        'sku':      sku,
        'side':     side,
        'label':    label,
        'price':    0,
        'currency': 'INR',
        'features': ['All features included — free to self-host'],
        # Every known limit key maps to None (= unlimited). get_limit() also
        # returns None for any key not listed, so nothing is ever gated.
        'limits': {
            'workspaces':               None,
            'connected_platforms':      None,
            'posts_per_month':          None,
            'ai_generations_per_month': None,
            'analytics_history_days':   None,
            'active_relations':         None,
            'managed_clients':          None,
        },
    }


# End-user (B2C) and agency (B2B) plan SKUs are kept so historical
# Subscription.plan values still resolve to a valid (unlimited) plan dict.
EU_FREE           = _unlimited('eu-free',           'end_user', 'Free')
EU_PRO            = _unlimited('eu-pro',            'end_user', 'Pro')
EU_PREMIUM        = _unlimited('eu-premium',        'end_user', 'Premium')
AGENCY_STARTER    = _unlimited('agency-starter',    'agency',   'Starter')
AGENCY_GROWTH     = _unlimited('agency-growth',     'agency',   'Growth')
AGENCY_SCALE      = _unlimited('agency-scale',      'agency',   'Scale')
AGENCY_ENTERPRISE = _unlimited('agency-enterprise', 'agency',   'Enterprise')


PLANS = {
    p['sku']: p for p in [
        EU_FREE, EU_PRO, EU_PREMIUM,
        AGENCY_STARTER, AGENCY_GROWTH, AGENCY_SCALE, AGENCY_ENTERPRISE,
    ]
}


def get_plan(sku: str) -> dict:
    """Return a plan dict; falls back to eu-free if the sku is unknown so
    callers always get a valid (unlimited) limit-bag."""
    return PLANS.get(sku) or EU_FREE


def list_plans(side: str | None = None) -> list[dict]:
    if side:
        return [p for p in PLANS.values() if p['side'] == side]
    return list(PLANS.values())


def get_limit(sku: str, key: str):
    """Always None — every quota is unlimited now that the product is free."""
    return None
