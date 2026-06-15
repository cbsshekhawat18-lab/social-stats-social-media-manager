# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Lightweight email/phone validators used by ask_email / ask_phone."""
from __future__ import annotations

import re


_EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
# E.164-ish — 8-15 digits with optional + prefix; relaxed enough to cover
# Indian mobile numbers without the optional `phonenumbers` lib.
_PHONE_RE = re.compile(r'^\+?\d{8,15}$')


def is_email(value: str) -> bool:
    return bool(value) and bool(_EMAIL_RE.match(value.strip()))


def is_phone(value: str) -> bool:
    if not value:
        return False
    cleaned = re.sub(r'[\s\-()]', '', value.strip())
    return bool(_PHONE_RE.match(cleaned))


def normalise_phone(value: str) -> str:
    cleaned = re.sub(r'[\s\-()]', '', (value or '').strip())
    if cleaned.startswith('+'):
        return cleaned
    # Default to assuming Indian mobile if it's a 10-digit number
    if len(cleaned) == 10 and cleaned.isdigit():
        return f'+91{cleaned}'
    return cleaned
