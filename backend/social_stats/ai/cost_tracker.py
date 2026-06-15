# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Cost estimation + monthly-budget tracking for AI requests.

Public:
    estimate_cost(input_tokens, output_tokens, model) -> Decimal (USD)
    record_cost(client, user, feature, model, in_tok, out_tok, ...) -> AIUsageLog
    get_client_usage(client_id, period='month') -> dict
    get_total_usage(period='month') -> dict
    is_over_budget() -> bool
    remaining_budget_usd() -> float
"""
from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone

logger = logging.getLogger(__name__)

# Per-million-token prices in USD. Conservative estimates for 2026 Anthropic rates;
# override via the MODEL_PRICING setting if pricing changes.
DEFAULT_PRICING = {
    # Sonnet family
    'claude-sonnet-4-6':                Decimal('3.00') / 1000 / 1000,
    'claude-sonnet-4-5':                Decimal('3.00') / 1000 / 1000,
    'claude-sonnet-4-6_output':         Decimal('15.00') / 1000 / 1000,
    'claude-sonnet-4-5_output':         Decimal('15.00') / 1000 / 1000,
    # Haiku family — fast + cheap
    'claude-haiku-4-5':                 Decimal('1.00') / 1000 / 1000,
    'claude-haiku-4-5-20251001':        Decimal('1.00') / 1000 / 1000,
    'claude-haiku-4-5_output':          Decimal('5.00') / 1000 / 1000,
    'claude-haiku-4-5-20251001_output': Decimal('5.00') / 1000 / 1000,
    # Opus family — deep reasoning
    'claude-opus-4-7':                  Decimal('15.00') / 1000 / 1000,
    'claude-opus-4-7_output':           Decimal('75.00') / 1000 / 1000,
}


def _price(model: str, kind: str) -> Decimal:
    """kind = 'input' | 'output'. Returns USD per token."""
    pricing = getattr(settings, 'AI_MODEL_PRICING', DEFAULT_PRICING)
    if kind == 'output':
        return Decimal(str(pricing.get(f'{model}_output', '0')))
    return Decimal(str(pricing.get(model, '0')))


def estimate_cost(input_tokens: int, output_tokens: int, model: str) -> Decimal:
    """USD cost (Decimal, 6dp) for a single completion."""
    cost = (_price(model, 'input') * Decimal(input_tokens)
            + _price(model, 'output') * Decimal(output_tokens))
    return cost.quantize(Decimal('0.000001'), rounding=ROUND_HALF_UP)


def record_cost(*, client, user, feature: str, model: str,
                input_tokens: int, output_tokens: int,
                duration_ms: int = 0, request_id: str = '',
                prompt_hash: str = '', cached: bool = False,
                request_payload: dict | None = None,
                response_summary: str = '',
                status: str = 'success', error_message: str = ''):
    """Persist an AIUsageLog row. Returns the new instance (or None on error)."""
    try:
        from ..models import AIUsageLog
    except Exception:
        # Migration not yet applied — silent.
        return None

    cost = estimate_cost(input_tokens, output_tokens, model)
    try:
        return AIUsageLog.objects.create(
            client=client,
            user=user,
            feature=feature[:60],
            model=model[:80],
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_cost_usd=cost,
            request_id=str(request_id or '')[:120],
            prompt_hash=str(prompt_hash or '')[:64],
            cached=cached,
            request_payload=request_payload or {},
            response_summary=str(response_summary or '')[:200],
            duration_ms=duration_ms,
            status=status[:20],
            error_message=str(error_message or '')[:1000],
        )
    except Exception:
        logger.exception('record_cost failed')
        return None


def _period_start(period: str = 'month'):
    now = timezone.now()
    if period == 'day':
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == 'week':
        days = now.weekday()
        return (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    # month
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def get_client_usage(client_id, period: str = 'month') -> dict:
    """Aggregate usage for one client over a period."""
    from ..models import AIUsageLog
    qs = AIUsageLog.objects.filter(client_id=client_id, created_at__gte=_period_start(period))
    agg = qs.aggregate(
        cost=Sum('total_cost_usd'),
        in_tokens=Sum('input_tokens'),
        out_tokens=Sum('output_tokens'),
    )
    return {
        'requests':      qs.count(),
        'cost_usd':      float(agg['cost'] or 0),
        'input_tokens':  int(agg['in_tokens']  or 0),
        'output_tokens': int(agg['out_tokens'] or 0),
        'cached_hits':   qs.filter(cached=True).count(),
        'period':        period,
    }


def get_total_usage(period: str = 'month') -> dict:
    """Aggregate usage across all clients."""
    from ..models import AIUsageLog
    qs = AIUsageLog.objects.filter(created_at__gte=_period_start(period))
    agg = qs.aggregate(cost=Sum('total_cost_usd'),
                       in_tokens=Sum('input_tokens'),
                       out_tokens=Sum('output_tokens'))
    return {
        'requests':      qs.count(),
        'cost_usd':      float(agg['cost'] or 0),
        'input_tokens':  int(agg['in_tokens']  or 0),
        'output_tokens': int(agg['out_tokens'] or 0),
        'cached_hits':   qs.filter(cached=True).count(),
        'period':        period,
    }


def remaining_budget_usd() -> float:
    """Dollar amount left in the global monthly budget."""
    cap = float(getattr(settings, 'AI_MONTHLY_BUDGET_USD', 500))
    used = float(get_total_usage('month').get('cost_usd', 0))
    return max(0.0, cap - used)


def is_over_budget() -> bool:
    return remaining_budget_usd() <= 0


def budget_status() -> dict:
    """For admin dashboards: cap, used, remaining, percent."""
    cap = float(getattr(settings, 'AI_MONTHLY_BUDGET_USD', 500))
    used = float(get_total_usage('month').get('cost_usd', 0))
    pct = (used / cap * 100) if cap > 0 else 0
    return {
        'cap_usd':       cap,
        'used_usd':      round(used, 4),
        'remaining_usd': round(max(0.0, cap - used), 4),
        'percent_used':  round(pct, 2),
        'alert_level':   ('critical' if pct >= 100 else
                          'warn'     if pct >=  80 else
                          'notice'   if pct >=  50 else 'ok'),
    }
