# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""WebSocket routing — referenced by dashboard/asgi.py."""
from django.urls import re_path

from .consumers import ClientWSConsumer

websocket_urlpatterns = [
    re_path(r'^ws/realtime/?$', ClientWSConsumer.as_asgi()),
]
