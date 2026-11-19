# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
WhatsApp 24-hour customer-service window.

Free-form messages (text, media, buttons, lists, AI replies) may only be sent
within 24 hours of the contact's last inbound message. Outside that window
only approved templates are delivered — Meta rejects anything else.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from django.utils import timezone

SERVICE_WINDOW = timedelta(hours=24)


def in_service_window(contact, now: Optional[timezone.datetime] = None) -> bool:
    """True if a free-form message to `contact` is allowed right now."""
    last = getattr(contact, 'last_inbound_at', None)
    if not last:
        return False
    return ((now or timezone.now()) - last) < SERVICE_WINDOW
