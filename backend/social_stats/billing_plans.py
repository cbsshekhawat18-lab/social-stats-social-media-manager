# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Plan catalog (limits + pricing) for both end-user and agency tiers.

Each plan exposes:
    label, price (in paise/INR), currency, features (free-form bullets),
    limits (machine-readable quotas), razorpay_plan_id (filled from settings
    or env in production).

Limits keys (read by usage_limits.py):
    workspaces            : max workspaces an end-user can own
    connected_platforms   : max active PlatformCredentials per workspace
    posts_per_month       : max published posts per billing period
    ai_generations_per_month
    analytics_history_days
    active_relations      : max simultaneously active AgencyClientRelations per workspace
    managed_clients       : agency-side cap (number of active relations the agency holds)
"""
from __future__ import annotations

from django.conf import settings


# ─────────────────────────────────────────────────────────────────────────────
# End-user plans (B2C)
# ─────────────────────────────────────────────────────────────────────────────
EU_FREE = {
    'sku':          'eu-free',
    'side':         'end_user',
    'label':        'Free',
    'price':        0,
    'currency':     'INR',
    'features': [
        '1 workspace · 3 connected platforms',
        '30 posts / month',
        '10 AI generations / month',
        'Last 30 days of analytics',
        '1 active agency relationship',
    ],
    'limits': {
        'workspaces':              1,
        'connected_platforms':     3,
        'posts_per_month':         30,
        'ai_generations_per_month': 10,
        'analytics_history_days':  30,
        'active_relations':        1,
    },
    'razorpay_plan_id': '',
}

EU_PRO = {
    'sku':          'eu-pro',
    'side':         'end_user',
    'label':        'Pro',
    'price':        49900,  # ₹499.00 in paise
    'currency':     'INR',
    'features': [
        '5 connected platforms',
        'Unlimited posts',
        'Full AI Studio access',
        '12 months of analytics',
        'Scheduling + queues',
        'Up to 3 agency relationships',
    ],
    'limits': {
        'workspaces':              1,
        'connected_platforms':     5,
        'posts_per_month':         None,  # unlimited
        'ai_generations_per_month': None,
        'analytics_history_days':  365,
        'active_relations':        3,
    },
    'razorpay_plan_id': getattr(settings, 'RAZORPAY_PLAN_EU_PRO', ''),
}

EU_PREMIUM = {
    'sku':          'eu-premium',
    'side':         'end_user',
    'label':        'Premium',
    'price':        99900,  # ₹999.00 in paise
    'currency':     'INR',
    'features': [
        'All 5 platforms unlocked',
        'Unlimited posts + AI',
        '3 years of analytics',
        'WhatsApp campaigns',
        'Priority support',
        'Unlimited agency relationships',
    ],
    'limits': {
        'workspaces':              1,
        'connected_platforms':     None,
        'posts_per_month':         None,
        'ai_generations_per_month': None,
        'analytics_history_days':  1095,
        'active_relations':        None,
    },
    'razorpay_plan_id': getattr(settings, 'RAZORPAY_PLAN_EU_PREMIUM', ''),
}


# ─────────────────────────────────────────────────────────────────────────────
# Agency plans (B2B) — included so the catalog is complete; wires UI
# ─────────────────────────────────────────────────────────────────────────────
AGENCY_STARTER = {
    'sku':       'agency-starter',
    'side':      'agency',
    'label':     'Starter',
    'price':     299900,
    'currency':  'INR',
    'features':  ['Up to 5 managed clients', 'All marketplace features', 'Email support'],
    'limits':    {'managed_clients': 5},
    'razorpay_plan_id': getattr(settings, 'RAZORPAY_PLAN_AGENCY_STARTER', ''),
}
AGENCY_GROWTH = {
    'sku':       'agency-growth',
    'side':      'agency',
    'label':     'Growth',
    'price':     799900,
    'currency':  'INR',
    'features':  ['Up to 25 clients', 'Featured marketplace listing', 'Priority support'],
    'limits':    {'managed_clients': 25},
    'razorpay_plan_id': getattr(settings, 'RAZORPAY_PLAN_AGENCY_GROWTH', ''),
}
AGENCY_SCALE = {
    'sku':       'agency-scale',
    'side':      'agency',
    'label':     'Scale',
    'price':     1999900,
    'currency':  'INR',
    'features':  ['Up to 100 clients', 'White-label', 'Dedicated account manager'],
    'limits':    {'managed_clients': 100},
    'razorpay_plan_id': getattr(settings, 'RAZORPAY_PLAN_AGENCY_SCALE', ''),
}
AGENCY_ENTERPRISE = {
    'sku':       'agency-enterprise',
    'side':      'agency',
    'label':     'Enterprise',
    'price':     None,  # custom — sales-led
    'currency':  'INR',
    'features':  ['Unlimited clients', 'SLA + custom legal', 'Dedicated infra option'],
    'limits':    {'managed_clients': None},
    'razorpay_plan_id': '',
}


PLANS = {
    p['sku']: p for p in [
        EU_FREE, EU_PRO, EU_PREMIUM,
        AGENCY_STARTER, AGENCY_GROWTH, AGENCY_SCALE, AGENCY_ENTERPRISE,
    ]
}


def get_plan(sku: str) -> dict:
    """Return a plan dict; falls back to eu-free if the sku is unknown so
    callers always get a valid limit-bag."""
    return PLANS.get(sku) or EU_FREE


def list_plans(side: str | None = None) -> list[dict]:
    if side:
        return [p for p in PLANS.values() if p['side'] == side]
    return list(PLANS.values())


def get_limit(sku: str, key: str):
    """Return the limit value (None means unlimited; missing key means 0)."""
    return get_plan(sku)['limits'].get(key, 0)
