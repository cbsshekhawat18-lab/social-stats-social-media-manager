# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Business-hours check for flows with `business_hours_only=True`.

`BotFlow.business_hours` shape:
    {"monday": {"start": "09:00", "end": "18:00"}, ..., "timezone": "Asia/Kolkata"}

A weekday that is missing, empty, or `{"closed": true}` is closed. An end
time earlier than the start ("22:00"–"06:00") spans midnight. A schedule with
no weekdays configured at all is treated as always open, so a half-finished
setup never silences a bot completely.
"""
from __future__ import annotations

import logging
from datetime import datetime, time
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

logger = logging.getLogger(__name__)

DEFAULT_TIMEZONE = 'Asia/Kolkata'
WEEKDAYS = ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')


def _parse_hhmm(value) -> Optional[time]:
    try:
        hh, mm = str(value).strip().split(':')[:2]
        return time(int(hh), int(mm))
    except (TypeError, ValueError):
        return None


def _zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name or DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        logger.warning('unknown business-hours timezone %r; using %s', name, DEFAULT_TIMEZONE)
        return ZoneInfo(DEFAULT_TIMEZONE)


def _day_open(day_cfg, at: time) -> bool:
    if not isinstance(day_cfg, dict) or day_cfg.get('closed'):
        return False
    start, end = _parse_hhmm(day_cfg.get('start')), _parse_hhmm(day_cfg.get('end'))
    if not start or not end:
        return False
    if start <= end:
        return start <= at < end
    return at >= start   # overnight window: today's part; the tail is checked on the next day


def is_within_business_hours(business_hours: dict, now: Optional[datetime] = None) -> bool:
    cfg = business_hours or {}
    if not any(cfg.get(d) for d in WEEKDAYS):
        return True
    local = (now or timezone.now()).astimezone(_zone(cfg.get('timezone')))
    today = WEEKDAYS[local.weekday()]
    if _day_open(cfg.get(today), local.time()):
        return True
    # The tail of yesterday's overnight window (e.g. Mon 22:00–06:00 at Tue 02:00).
    yesterday = cfg.get(WEEKDAYS[(local.weekday() - 1) % 7])
    if isinstance(yesterday, dict) and not yesterday.get('closed'):
        start, end = _parse_hhmm(yesterday.get('start')), _parse_hhmm(yesterday.get('end'))
        if start and end and start > end and local.time() < end:
            return True
    return False


def flow_is_open(flow, now: Optional[datetime] = None) -> bool:
    if not getattr(flow, 'business_hours_only', False):
        return True
    return is_within_business_hours(flow.business_hours or {}, now)
