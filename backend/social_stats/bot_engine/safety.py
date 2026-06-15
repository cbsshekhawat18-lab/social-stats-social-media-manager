# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
bot safety guardrails.

Three checks, all designed to fail open (returning "allowed" on any internal
error) so we never lock a real user out of the bot due to a safety bug:

  • is_bot_enabled(client)           — workspace-level kill switch
  • is_rate_limited(contact_id, ...) — per-contact inbound-message throttle
  • spam_signal(text)                — heuristic spam score for one message
                                        (used to bump conversation.spam_score
                                         and auto-end at the configured cap)

The runner consults these BEFORE the engine spends any compute / sends any
WhatsApp message, so a spammer can't drain Anthropic credits or PinBot quota.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from django.core.cache import cache


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Workspace kill switch
# ─────────────────────────────────────────────────────────────────────────────
def is_bot_enabled(client) -> bool:
    """Honour `Client.bot_enabled`. Default True if the field is missing
    (e.g. on a freshly-migrated row before it gets touched)."""
    try:
        return bool(getattr(client, 'bot_enabled', True))
    except Exception:
        return True


# ─────────────────────────────────────────────────────────────────────────────
# Per-contact rate limit
# ─────────────────────────────────────────────────────────────────────────────
_RATE_KEY = 'bot:rate:{client_id}:{contact_id}'


def is_rate_limited(client_id: int, contact_id: int, *, max_per_minute: int = 20) -> bool:
    """Return True if this contact has exceeded `max_per_minute` inbound
    messages in the last 60 seconds. Implemented as a Redis-cache counter
    with a 60s TTL — falls back to "not limited" if cache is unavailable."""
    if max_per_minute <= 0:
        return False
    key = _RATE_KEY.format(client_id=client_id, contact_id=contact_id)
    try:
        # add() sets only if missing — gives us a sliding-ish window per minute
        cache.add(key, 0, timeout=60)
        n = cache.incr(key)
    except Exception:
        # Cache backend not available — fail open. We log because this means
        # rate limiting is silently disabled.
        logger.warning('bot rate-limit cache unavailable; allowing through')
        return False
    return n > max_per_minute


# ─────────────────────────────────────────────────────────────────────────────
# Spam heuristics
# ─────────────────────────────────────────────────────────────────────────────
_URL_RE         = re.compile(r'https?://|www\.', re.IGNORECASE)
_REPEAT_RE      = re.compile(r'(.)\1{6,}')  # "aaaaaaa" (7+) → suspicious
_PHONE_LIKE_RE  = re.compile(r'\+?\d[\d\s\-]{8,}')  # phone numbers in body
_LONG_THRESHOLD = 600                                # very long messages are weird on WA

# Keep the bad-word list small + focused — a real product would source from a
# moderation service. We only pattern-match obvious spam-marketing spew.
_SPAM_MARKERS = (
    'free crypto', 'click here', 'limited time offer', 'congratulations you won',
    'work from home', 'whatsapp business api offer',
)


def spam_signal(text: str) -> int:
    """Return a score in [0, 5]. Higher = more spammy. Cheap heuristics —
    no AI call. The runner uses this to bump `BotConversation.spam_score`."""
    if not text:
        return 0
    s = text.lower()
    score = 0

    if _URL_RE.search(s):
        score += 2
    if _REPEAT_RE.search(s):
        score += 1
    if len(text) > _LONG_THRESHOLD:
        score += 1
    if _PHONE_LIKE_RE.search(text):
        score += 1
    if any(marker in s for marker in _SPAM_MARKERS):
        score += 3

    return min(score, 5)


def reset_rate_limit(client_id: int, contact_id: int) -> None:
    """Clear the per-contact rate counter — used by the test-mode drawer so
    it doesn't trip safety on rapid-fire test sends from the same number."""
    try:
        cache.delete(_RATE_KEY.format(client_id=client_id, contact_id=contact_id))
    except Exception:
        pass
