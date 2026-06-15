# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
per-plan daily AI cost cap.

Sits next to the existing request-count rate limiter (`ai/rate_limiter.py`).
Where the request-count limit protects against runaway loops, this dollar
cap protects against expensive prompts (long-context Sonnet calls) draining
a plan's monthly budget in a single afternoon.

Resolution: looks up the client's `subscription_plan`, finds the matching
daily $ cap from settings.PLAN_AI_DAILY_BUDGETS_USD, and compares against
today's actual spend (from AIUsageLog). Raises `BudgetExceeded` when the
NEXT call would push us over.

Plug into AIClient.complete via the standard pre-flight pattern: the AI
client already calls `rate_limiter.check()` — we add a `check_daily_budget()`
call right after.
"""
from __future__ import annotations

import logging

from django.conf import settings


logger = logging.getLogger(__name__)


# Defaults — override in settings.PLAN_AI_DAILY_BUDGETS_USD per env.
DEFAULT_PLAN_BUDGETS_USD = {
    'free':            0.50,    # 50¢/day → ~3 Sonnet calls
    'pro':             5.00,
    'premium':        25.00,
    'agency_managed':  50.00,
}


class BudgetExceeded(Exception):
    """Raised when a client's per-day $ cap would be breached.

    Mirrors the shape of `RateLimited` so callers using `except (RateLimited,
    BudgetExceeded)` can handle both uniformly.
    """
    def __init__(self, message: str, *, plan: str = '', limit_usd: float = 0.0,
                 used_usd: float = 0.0):
        super().__init__(message)
        self.scope = 'budget_daily'
        self.plan  = plan
        self.limit = limit_usd
        self.used  = used_usd


def _budget_for_plan(plan: str) -> float:
    """Look up the daily $ cap for a plan, falling back to free-tier."""
    overrides = getattr(settings, 'PLAN_AI_DAILY_BUDGETS_USD', {}) or {}
    table = {**DEFAULT_PLAN_BUDGETS_USD, **overrides}
    return float(table.get(plan or 'free', table['free']))


def _resolve_plan(client_id) -> str:
    """Best-effort plan lookup. Empty string falls through to free."""
    if not client_id:
        return 'free'
    try:
        from ..models import Client
        plan = Client.objects.filter(pk=client_id).values_list('subscription_plan', flat=True).first()
        return plan or 'free'
    except Exception:
        return 'free'


def get_today_spend_usd(client_id) -> float:
    """Today's spend for this client, in USD. Reads AIUsageLog directly."""
    if not client_id:
        return 0.0
    try:
        from ..ai.cost_tracker import get_client_usage
        return float(get_client_usage(client_id, period='day').get('cost_usd', 0))
    except Exception:
        return 0.0


def check_daily_budget(client_id, *, estimated_cost_usd: float = 0.0) -> None:
    """Pre-flight gate. Raises BudgetExceeded when the next call would blow
    the day's cap. Pass a non-zero ``estimated_cost_usd`` if the caller has
    a tight estimate (long-context calls); otherwise the check is "are we
    already over?"
    """
    if not client_id:
        return  # superadmin / system calls bypass the per-plan gate
    plan  = _resolve_plan(client_id)
    cap   = _budget_for_plan(plan)
    if cap <= 0:
        # Plan has no AI budget allowed at all
        raise BudgetExceeded(
            f'Plan "{plan}" does not include AI features. Upgrade to use AI.',
            plan=plan, limit_usd=0.0, used_usd=0.0,
        )
    used = get_today_spend_usd(client_id)
    if used + estimated_cost_usd > cap:
        raise BudgetExceeded(
            f'Daily AI budget reached: ${used:.2f} of ${cap:.2f} (plan: {plan}). '
            f'Resets at midnight.',
            plan=plan, limit_usd=cap, used_usd=used,
        )


def get_daily_budget_status(client_id) -> dict:
    """For UI display: ``{plan, limit_usd, used_usd, remaining_usd, percent}``."""
    plan = _resolve_plan(client_id)
    cap  = _budget_for_plan(plan)
    used = get_today_spend_usd(client_id)
    return {
        'plan':          plan,
        'limit_usd':     round(cap, 2),
        'used_usd':      round(used, 4),
        'remaining_usd': round(max(0.0, cap - used), 4),
        'percent':       round((used / cap * 100) if cap else 0, 1),
    }
