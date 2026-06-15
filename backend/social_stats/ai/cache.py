# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Redis-backed response cache for AI completions.

Cache key = SHA256 of (prompt + system + model + temperature + version).

Public:
    make_key(prompt, system, model, temperature, version='1') -> str
    get(key) -> str | None
    set(key, value, ttl=None) -> None
    invalidate(prefix) -> int  # number of keys cleared
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Optional

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_PREFIX = 'ai:resp:'


def make_key(prompt: str, system: str = '', model: str = '',
             temperature: float = 0.7, version: str = '1',
             extra: Optional[dict] = None) -> str:
    """Stable hash of all inputs that affect output."""
    payload = {
        'p':   prompt or '',
        's':   system or '',
        'm':   model or '',
        't':   round(float(temperature or 0), 4),
        'v':   version,
        'e':   extra or {},
    }
    raw = json.dumps(payload, sort_keys=True, default=str).encode()
    return f'{CACHE_PREFIX}{hashlib.sha256(raw).hexdigest()}'


def get(key: str) -> Optional[Any]:
    try:
        return cache.get(key)
    except Exception:
        logger.exception('AI cache get failed for %s', key)
        return None


def set(key: str, value: Any, ttl: Optional[int] = None) -> None:
    """Persist a response. ttl falls back to AI_CACHE_TTL_SECONDS."""
    if ttl is None:
        ttl = int(getattr(settings, 'AI_CACHE_TTL_SECONDS', 86400))
    try:
        cache.set(key, value, timeout=ttl)
    except Exception:
        logger.exception('AI cache set failed for %s', key)


def invalidate(prefix: str = '') -> int:
    """Best-effort cache flush by matching prefix. Most cache backends
    don't support pattern delete; this returns 0 in that case. Safe no-op."""
    try:
        full = f'{CACHE_PREFIX}{prefix}'
        # django-redis specific
        return getattr(cache, 'delete_pattern', lambda *_: 0)(f'{full}*')
    except Exception:
        return 0
