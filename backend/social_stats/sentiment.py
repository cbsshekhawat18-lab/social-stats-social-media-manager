# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Sentiment classification for inbox messages.

Uses Anthropic Claude Haiku when `ANTHROPIC_API_KEY` is configured; gracefully
falls back to 'unknown' when not. Lazy-imports the SDK so this module loads
cleanly even when `anthropic` isn't installed in dev.

Public:
    classify(text: str) -> str   # 'positive' | 'neutral' | 'negative' | 'unknown'
    classify_many(texts: list[str]) -> list[str]
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

VALID = ('positive', 'neutral', 'negative', 'unknown')
_MODEL = 'claude-haiku-4-5-20251001'  # cheapest Haiku — fits the cost target


def classify(text: str) -> str:
    """Return one of {'positive','neutral','negative','unknown'}. Never raises."""
    if not text or not text.strip():
        return 'unknown'

    client = _get_client()
    if not client:
        return 'unknown'

    try:
        msg = client.messages.create(
            model=_MODEL,
            max_tokens=8,
            system=(
                'Classify the sentiment of the following message as EXACTLY '
                'one of: positive, neutral, negative. Output only the single '
                'lowercase word. No punctuation, no explanation.'
            ),
            messages=[{'role': 'user', 'content': text[:1500]}],
        )
        out = ''.join(b.text for b in msg.content if hasattr(b, 'text')).strip().lower()
        out = re.sub(r'[^a-z]', '', out)  # strip stray punctuation
        return out if out in VALID else 'unknown'
    except Exception:
        logger.exception('Anthropic sentiment classify failed — returning unknown')
        return 'unknown'


def classify_many(texts: list[str]) -> list[str]:
    """Convenience batch — sequential classify so a single failure doesn't tank the loop."""
    return [classify(t or '') for t in texts]


def _get_client():
    """Lazy-load the Anthropic client; cache nothing for now (one client per call is fine)."""
    try:
        from django.conf import settings
        from anthropic import Anthropic
    except Exception:
        logger.debug('anthropic SDK not installed — sentiment will return unknown')
        return None

    key = getattr(settings, 'ANTHROPIC_API_KEY', '') or ''
    if not key:
        return None
    try:
        return Anthropic(api_key=key)
    except Exception:
        logger.exception('Failed to create Anthropic client')
        return None
