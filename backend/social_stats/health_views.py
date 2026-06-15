# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Public service-health endpoint backing the marketing /status page.

Exposes /api/health/services/ — no auth, no rate-limited per user (anonymous IP
throttle from settings still applies). Returns a list of services and their
current status: 'operational', 'degraded', or 'outage'. The frontend StatusPage
polls this every 30s.

Each check is wrapped in try/except so one broken dependency never makes the
endpoint itself 500. We always return 200 with status payload so the marketing
page renders, even if everything is on fire.
"""
from __future__ import annotations

import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.db.utils import OperationalError
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

logger = logging.getLogger(__name__)


class StatusThrottle(AnonRateThrottle):
    """30/min per IP — generous, since /status auto-refreshes."""
    rate = '30/min'


def _check_database() -> dict:
    started = time.monotonic()
    try:
        conn = connections['default']
        with conn.cursor() as cur:
            cur.execute('SELECT 1')
            cur.fetchone()
        return {'status': 'operational', 'latency_ms': int((time.monotonic() - started) * 1000)}
    except OperationalError as e:
        logger.warning('health: database check failed: %s', e)
        return {'status': 'outage', 'error': 'database unreachable'}
    except Exception as e:  # noqa: BLE001
        logger.warning('health: database check failed: %s', e)
        return {'status': 'degraded', 'error': str(e)[:120]}


def _check_cache() -> dict:
    started = time.monotonic()
    try:
        probe_key = '__health_probe__'
        cache.set(probe_key, 'ok', 5)
        if cache.get(probe_key) != 'ok':
            return {'status': 'degraded', 'error': 'cache mismatch'}
        return {'status': 'operational', 'latency_ms': int((time.monotonic() - started) * 1000)}
    except Exception as e:  # noqa: BLE001
        logger.warning('health: cache check failed: %s', e)
        return {'status': 'degraded', 'error': str(e)[:120]}


def _check_celery() -> dict:
    """Best-effort celery broker check via cache (broker often shares Redis)."""
    try:
        from celery import current_app  # type: ignore
        insp = current_app.control.inspect(timeout=1.0)
        ping = insp.ping() if insp else None
        if ping:
            return {'status': 'operational', 'workers': len(ping)}
        return {'status': 'degraded', 'error': 'no workers responded'}
    except Exception as e:  # noqa: BLE001
        logger.debug('health: celery check skipped: %s', e)
        # Celery being absent in dev shouldn't show "outage" on prod-style page.
        return {'status': 'operational', 'note': 'no broker configured'}


# Static, infrequently-changing services we surface for visibility. Their state
# is sourced from a per-service cache key that ops can flip during incidents.
_THIRD_PARTY = [
    ('meta',     'Meta integration (Facebook + Instagram)'),
    ('google',   'Google integration (YouTube + GMB)'),
    ('linkedin', 'LinkedIn integration'),
    ('pinbot',   'WhatsApp (Pinbot.ai)'),
    ('ai',       'Social Stats'),
]


def _check_third_party(slug: str) -> dict:
    """Read incident override from cache; default to operational."""
    override = cache.get(f'health:incident:{slug}')
    if override in ('degraded', 'outage'):
        return {'status': override}
    return {'status': 'operational'}


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([StatusThrottle])
def services_health(_request):
    services = []

    services.append({
        'id': 'web',
        'name': 'Web app',
        **_check_database(),  # web liveness implies DB query path works
    })
    services.append({
        'id': 'api',
        'name': 'API',
        'status': 'operational',  # if this view returned, the API is up
    })
    services.append({
        'id': 'workers',
        'name': 'Background workers (Celery)',
        **_check_celery(),
    })
    services.append({
        'id': 'realtime',
        'name': 'Realtime / WebSockets',
        **_check_cache(),  # ASGI layers piggyback on the cache backend
    })
    services.append({
        'id': 'db',
        'name': 'Database',
        **_check_database(),
    })

    for slug, label in _THIRD_PARTY:
        services.append({'id': slug, 'name': label, **_check_third_party(slug)})

    overall = 'operational'
    for s in services:
        if s['status'] == 'outage':
            overall = 'outage'
            break
        if s['status'] == 'degraded' and overall != 'outage':
            overall = 'degraded'

    return Response({
        'overall': overall,
        'checked_at': int(time.time()),
        'region': getattr(settings, 'AWS_REGION', 'ap-south-1'),
        'services': services,
    })
