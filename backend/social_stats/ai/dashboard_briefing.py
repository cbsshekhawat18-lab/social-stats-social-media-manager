# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
AI dashboard briefing.

Generates the "Today's briefing" string the home dashboard renders at the top.
4-5 short bullets summarising what the user should care about right now,
written in their brand voice via the `AIContextProvider`.

  >>> from social_stats.ai.dashboard_briefing import build_briefing
  >>> build_briefing(client)
  '• 3 new leads from Mumbai property campaign (high quality)\n'
  '• Engagement on Reel "Property Tour" up 240%\n'
  '• 2 negative reviews on GMB need response'

Three guardrails so this never blows up the dashboard:

  1. **Cached for 1 hour** keyed by `client_id` — refreshing the dashboard
     doesn't re-hit the AI. Counts/charts come from the live aggregator;
     the briefing is intentionally slower-moving prose.
  2. **Per-client rate-limited** at 10 generations/day. A user mashing
     "regenerate" in a debugging session can't blow through the AI budget.
  3. **Returns `''` on any failure** — bad model output, missing API key,
     no metrics for the client, AI safety reject. The dashboard renders
     without the briefing card; counts/activity etc are unaffected.

The briefing is a *summary*, not advice. It asks Claude to stick to facts
the AIContextProvider already surfaced (recent metrics, pending approvals,
new leads) — keeps the prompt short and the output reliably structured.
"""
from __future__ import annotations

import logging

from django.core.cache import cache

from ..ai_helpers import rate_limit_check, HAIKU
from .client import AIClient
from .context import AIContextProvider

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60 * 60       # 1 hour — fresh enough; cheap enough
RATE_LIMIT_PER_DAY = 10           # per client
FEATURE_KEY        = 'dashboard_briefing'


def build_briefing(client, *, user=None, force: bool = False) -> str:
    """Return today's briefing string for `client`, or `''` on any failure.

    `user`  — optional, threaded through for AI cost attribution.
    `force` — bypass the 1h cache (still respects rate limit).
    """
    if not client:
        return ''
    cache_key = f'dashboard:briefing:{client.id}'

    if not force:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    if not rate_limit_check(client.id, FEATURE_KEY, RATE_LIMIT_PER_DAY):
        # Don't burn the budget. Return whatever we have cached, even if
        # we just blew the cache by passing `force=True`.
        return cache.get(cache_key) or ''

    try:
        text = _generate(client, user=user)
    except Exception:  # noqa: BLE001
        logger.exception('build_briefing: generation failed for client=%s', client.id)
        return ''

    cache.set(cache_key, text, CACHE_TTL_SECONDS)
    return text


def _generate(client, *, user=None) -> str:
    """Build the prompt + call Claude Haiku + return the trimmed string.

    Haiku is the right model here: the input is structured numbers, the
    output is short prose, no reasoning needed beyond "summarise this".
    Sonnet would be ~10x the cost for the same quality.
    """
    ctx = AIContextProvider(client=client, user=user, feature=FEATURE_KEY)
    facts = ctx.as_dict()

    # If the workspace has no metrics + no leads + no approvals, there's
    # nothing to brief on. Empty string keeps the dashboard slot clean.
    if not _has_signal(facts):
        return ''

    system = _build_system_prompt(ctx, facts)
    prompt = _build_user_prompt(client, facts)

    ai = AIClient(client=client, user=user, feature=FEATURE_KEY)
    raw = ai.complete(
        prompt,
        system=system,
        model=HAIKU,
        max_tokens=200,            # 4-5 bullets fit easily
        temperature=0.4,           # mostly deterministic — these are facts
        use_cache=False,           # we cache at the caller level; no double-cache
    )
    return _clean_output(raw)


def _has_signal(facts: dict) -> bool:
    """Return True iff the briefing would have anything to say.

    `_recent_metrics` is the heaviest input. If it's None, the workspace
    has no DailyMetric rows yet — common for new clients during onboarding.
    Other signals can substitute (a new lead, a viral post) but if all
    buckets are empty there's literally nothing to summarise.
    """
    if facts.get('recent_metrics'):
        return True
    bv = facts.get('brand_voice')
    if bv and bv.get('voice_summary'):
        return True
    return False


def _build_system_prompt(ctx: AIContextProvider, facts: dict) -> str:
    """System message — tone + structural constraints."""
    voice_text = ctx.as_prompt_fragment()
    base = (
        'You are the dashboard briefing writer for a marketing OS called Social Stats. '
        'Write a short, scannable briefing for the workspace owner — '
        '4 to 5 bullet points, each one line, each starting with "• ". '
        'Stick strictly to facts in the data block. No questions, no calls to action, '
        'no greetings, no "Here is your briefing" prelude. '
        'Lead with the most newsworthy item (biggest delta, most leads, biggest spike). '
        'Short numbers stay numeric ("up 240%", "3 new leads"). '
        'Prefer concrete nouns over abstract phrasing. '
        'If a category has no signal, omit it entirely rather than padding.'
    )
    if voice_text:
        return base + '\n\n' + voice_text
    return base


def _build_user_prompt(client, facts: dict) -> str:
    """User-side prompt — packs the data block as plain text Claude can read."""
    lines = [f'Workspace: {client.company}']

    rm = facts.get('recent_metrics')
    if rm and rm.get('summary'):
        lines.append(f'Performance: {rm["summary"]}')

    ind = facts.get('industry')
    if ind and ind.get('industry'):
        lines.append(f'Industry: {ind["industry"]}')

    aud = facts.get('audience')
    if aud and aud.get('total_followers'):
        lines.append(f"Audience: {aud['total_followers']:,} total followers")

    return '\n'.join(lines) + '\n\nWrite the briefing.'


def _clean_output(raw: str) -> str:
    """Normalise model output — strip whitespace, drop accidental preamble,
    enforce 6-line max so a runaway model can't drown the dashboard.
    """
    if not raw:
        return ''
    text = raw.strip()
    # Some Haiku outputs prefix with "Here is your briefing:" or similar.
    # Drop everything before the first bullet.
    bullet_idx = text.find('•')
    if bullet_idx > 0:
        text = text[bullet_idx:]
    # Hard cap on lines — guards against the model producing 30 bullets.
    lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
    return '\n'.join(lines[:6])
