# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Unified AI context provider.

Until now every AI callsite (Composer compose / rewrite / extend, automation
auto-reply, template personaliser, AI Assistant chat) called
`brand_voice_prompt(client)` independently and assembled its own context. The
result was inconsistent — one feature might pull recent metrics, another
might not; the AI Assistant chat sees different facts than the Composer.

`AIContextProvider` is the single source of truth. Consumers ask it for the
slice of context they need:

    ctx = AIContextProvider(client=client, user=user, feature='composer.ai_write')
    system_fragment = ctx.as_prompt_fragment()    # text block to inject into Claude's system msg
    payload         = ctx.as_dict()               # structured for tool-use callers

Returned context buckets:

  • brand_voice — voice summary + tone + style rules + preferred / forbidden
    words + audience + emoji + hashtag style. Wraps `brand_voice_prompt()`.
  • recent_metrics — last-30d engagement totals per platform + delta vs prior 30d.
  • audience — top-line summary of audience composition + industry hint.
  • industry — client.industry + tracked competitors (names only).
  • client — minimal {name, company, language, timezone}.

Each bucket is computed lazily — `as_dict()` does the work; cheap properties
short-circuit when called without need. Failures in a single bucket return
`None` for that bucket rather than blowing up the whole call (defence in
depth: AI requests should never 500 because the audience query failed).

Existing callsites that already use `brand_voice_prompt(client)` keep working —
this provider does NOT force a migration. Use it for NEW AI callsites and
gradually backfill.
"""
from __future__ import annotations

import logging
from typing import Optional

from django.utils import timezone

logger = logging.getLogger(__name__)


class AIContextProvider:
    """Unified surface for the context every AI call wants — brand voice +
    recent performance + audience + industry. Lazy + defensive."""

    def __init__(self, *, client, user=None, feature: str = 'misc'):
        self.client = client
        self.user = user
        self.feature = feature
        self._cache: dict = {}

    # ── Public surface ────────────────────────────────────────────────
    def as_dict(self) -> dict:
        """Return a flat dict of every bucket. Used by tool-use callers and
        structured prompt templates (e.g. report generation)."""
        return {
            'client':         self._safe(self._client_info,    'client'),
            'brand_voice':    self._safe(self._brand_voice,    'brand_voice'),
            'recent_metrics': self._safe(self._recent_metrics, 'recent_metrics'),
            'audience':       self._safe(self._audience,       'audience'),
            'industry':       self._safe(self._industry,       'industry'),
        }

    def as_prompt_fragment(self) -> str:
        """Render a multi-section text block suitable for Claude's system
        prompt. Empty sections are dropped — never produces a fragment that
        starts/ends with blank scaffolding."""
        sections: list[str] = []

        c = self._safe(self._client_info, 'client')
        if c:
            sections.append(f"You are writing for {c['company']} (a {c.get('industry') or 'business'}).")

        bv = self._safe(self._brand_voice_text, 'brand_voice_text')
        if bv:
            sections.append(f"Brand voice:\n{bv}")

        m = self._safe(self._recent_metrics, 'recent_metrics')
        if m and m.get('summary'):
            sections.append(f"Recent performance:\n{m['summary']}")

        ind = self._safe(self._industry, 'industry')
        if ind and ind.get('competitor_names'):
            sections.append(
                f"Industry context: tracked competitors include "
                f"{', '.join(ind['competitor_names'][:5])}."
            )

        return '\n\n'.join(sections)

    # ── Bucket builders (lazy + cached) ───────────────────────────────
    def _client_info(self) -> dict:
        c = self.client
        return {
            'id':       c.id,
            'name':     c.name,
            'company':  c.company,
            'industry': getattr(c, 'industry', '') or '',
            'language': getattr(c, 'language', '') or 'en',
            'timezone': getattr(c, 'timezone', '') or 'Asia/Kolkata',
        }

    def _brand_voice(self) -> dict | None:
        """Structured brand-voice payload. Re-uses the existing trainer's
        getter so the schema stays consistent with the training UI."""
        from .brand_voice import get_brand_voice_payload
        try:
            payload = get_brand_voice_payload(self.client)
        except Exception:
            return None
        # `get_brand_voice_payload` returns a dict; surface it as-is so
        # any added fields propagate automatically.
        return payload or None

    def _brand_voice_text(self) -> str:
        """Text fragment for system prompts — wraps the existing helper."""
        from ..ai_helpers import brand_voice_prompt
        try:
            return brand_voice_prompt(self.client) or ''
        except Exception:
            return ''

    def _recent_metrics(self) -> dict | None:
        """Last-30d engagement totals + delta vs prior 30d. Best-effort —
        returns None if the metrics tables are empty for this client.

        Note: `DailyMetric` doesn't have a single `engagement` column;
        engagement is the sum of likes + comments + shares. We pull those
        three columns and compose the metric Python-side. The previous
        version of this code queried a non-existent `engagement` field
        and the `_safe` wrapper silently swallowed the FieldError, so
        every workspace's recent-metrics bucket came back None — caught
        by the briefing tests.
        """
        from ..models import DailyMetric

        now = timezone.now().date()
        from datetime import timedelta
        last30_start = now - timedelta(days=30)
        prev30_start = now - timedelta(days=60)

        try:
            qs = DailyMetric.objects.filter(client=self.client)
            recent = list(qs.filter(date__gte=last30_start, date__lt=now)
                            .values_list('likes', 'comments', 'shares', 'reach', 'impressions'))
            previous = list(qs.filter(date__gte=prev30_start, date__lt=last30_start)
                              .values_list('likes', 'comments', 'shares', 'reach', 'impressions'))
        except Exception:
            return None

        if not recent and not previous:
            return None

        def _sum_engagement(rows):
            return sum((r[0] or 0) + (r[1] or 0) + (r[2] or 0) for r in rows)

        def _sum_col(rows, idx):
            return sum((r[idx] or 0) for r in rows)

        recent_totals = {
            'engagement': _sum_engagement(recent),
            'reach':       _sum_col(recent, 3),
            'impressions': _sum_col(recent, 4),
        }
        previous_totals = {
            'engagement': _sum_engagement(previous),
            'reach':       _sum_col(previous, 3),
            'impressions': _sum_col(previous, 4),
        }

        def _pct_delta(curr, prev):
            if not prev:
                return None
            return round((curr - prev) / prev * 100, 1)

        deltas = {k: _pct_delta(recent_totals[k], previous_totals[k]) for k in recent_totals}

        # Render a one-line human summary for the prompt fragment.
        summary_parts = []
        for k, v in recent_totals.items():
            d = deltas[k]
            if d is None:
                summary_parts.append(f'{k} {v:,}')
            else:
                arrow = '↑' if d >= 0 else '↓'
                summary_parts.append(f'{k} {v:,} ({arrow}{abs(d)}%)')
        return {
            'window_days':     30,
            'recent_totals':   recent_totals,
            'previous_totals': previous_totals,
            'pct_delta':       deltas,
            'summary':         'Last 30 days vs prior 30: ' + ' · '.join(summary_parts),
        }

    def _audience(self) -> dict | None:
        """Top-line audience summary. Lighter than the full audience module —
        this is a hint for the AI, not a full pull."""
        try:
            from ..models import Client
            c = self.client
            # Try common fields without forcing a hard dependency.
            audience_size = getattr(c, 'total_followers', None)
            if audience_size is None:
                # Sum across credentials if denorm field missing.
                creds = c.credentials.all() if hasattr(c, 'credentials') else []
                audience_size = sum(
                    getattr(cred, 'follower_count', 0) or 0 for cred in creds
                )
            return {
                'total_followers': audience_size or 0,
                'language':        getattr(c, 'language', '') or 'en',
            }
        except Exception:
            return None

    def _industry(self) -> dict | None:
        """Industry + competitor names (stripped of metrics — light context)."""
        c = self.client
        try:
            industry = getattr(c, 'industry', '') or ''
            from ..models import Competitor
            comp_names = list(
                Competitor.objects.filter(client=c).values_list('name', flat=True)[:8]
            )
            if not industry and not comp_names:
                return None
            return {
                'industry':         industry,
                'competitor_names': comp_names,
            }
        except Exception:
            return None

    # ── Defence-in-depth wrapper ──────────────────────────────────────
    def _safe(self, fn, cache_key):
        """Run `fn`, cache the result by key, swallow exceptions."""
        if cache_key in self._cache:
            return self._cache[cache_key]
        try:
            result = fn()
        except Exception as exc:  # noqa: BLE001
            logger.debug('AIContextProvider: %s failed: %s', cache_key, exc)
            result = None
        self._cache[cache_key] = result
        return result


def build_context(client, user=None, feature: str = 'misc') -> AIContextProvider:
    """Convenience constructor — `build_context(client).as_prompt_fragment()`
    is the most common call shape."""
    return AIContextProvider(client=client, user=user, feature=feature)
