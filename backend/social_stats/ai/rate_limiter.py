# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Per-client + global rate limiting for AI requests.

Two limits combine:
    1. Per-client daily request count (settings.AI_PER_CLIENT_DAILY_LIMIT)
    2. Global monthly USD budget (settings.AI_MONTHLY_BUDGET_USD)

Both are checked before each AI call. Limits are advisory in the sense that
exceeding them raises RateLimited and the caller surfaces a friendly error.

Public:
    check(client_id, feature, weight=1) -> None    # raises RateLimited on excess
    increment(client_id, feature, weight=1) -> int # returns new count
    get_usage(client_id) -> dict                   # for UI / admin display

Cache-backed (Redis recommended). Counter resets at midnight in the server's
timezone.
"""
from __future__ import annotations

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from . import cost_tracker


class RateLimited(Exception):
    """Raised when a client or the global budget has hit its cap."""
    def __init__(self, message: str, scope: str = 'client', limit: int = 0, used: int = 0):
        super().__init__(message)
        self.scope = scope    # 'client' | 'global' | 'budget'
        self.limit = limit
        self.used  = used


def _client_key(client_id, feature: str = '') -> str:
    today = timezone.now().date().isoformat()
    suffix = f':{feature}' if feature else ''
    return f'ai:rl:client:{client_id}:{today}{suffix}'


def _client_total_key(client_id) -> str:
    today = timezone.now().date().isoformat()
    return f'ai:rl:client:{client_id}:{today}:_total'


def check(client_id, feature: str = '', weight: int = 1) -> None:
    """
    Pre-flight check. Raises RateLimited if the next request would exceed
    either the per-client daily cap or the global monthly budget.

    Does NOT increment — call increment() after a successful API hit so
    cached responses don't count against the cap.
    """
    daily_cap = int(getattr(settings, 'AI_PER_CLIENT_DAILY_LIMIT', 100))
    if client_id is not None:
        used = cache.get(_client_total_key(client_id)) or 0
        if used + weight > daily_cap:
            raise RateLimited(
                f'Daily AI quota reached ({daily_cap} requests). Resets at midnight.',
                scope='client', limit=daily_cap, used=used,
            )

    if cost_tracker.is_over_budget():
        raise RateLimited(
            'Monthly AI budget exhausted. Contact your admin to increase the cap.',
            scope='budget',
            limit=int(getattr(settings, 'AI_MONTHLY_BUDGET_USD', 500)),
            used=int(getattr(settings, 'AI_MONTHLY_BUDGET_USD', 500)),
        )


def increment(client_id, feature: str = '', weight: int = 1) -> int:
    """Increment counters after a successful (non-cached) API call."""
    if client_id is None:
        return 0
    total_key = _client_total_key(client_id)
    feat_key  = _client_key(client_id, feature)
    ttl = 60 * 60 * 26  # 26h — covers daily window + clock skew
    try:
        # Atomic-ish: get-then-set is not perfectly safe under heavy concurrency,
        # but the cap is advisory and the overshoot is bounded by request count.
        new_total = (cache.get(total_key) or 0) + weight
        cache.set(total_key, new_total, timeout=ttl)
        cache.set(feat_key, (cache.get(feat_key) or 0) + weight, timeout=ttl)
        return new_total
    except Exception:
        return 0


def get_usage(client_id) -> dict:
    """For UI / admin: how much of today's quota is consumed."""
    daily_cap = int(getattr(settings, 'AI_PER_CLIENT_DAILY_LIMIT', 100))
    used = cache.get(_client_total_key(client_id)) or 0 if client_id is not None else 0
    return {
        'limit':     daily_cap,
        'used':      used,
        'remaining': max(0, daily_cap - used),
        'percent':   round((used / daily_cap * 100) if daily_cap else 0, 1),
    }
