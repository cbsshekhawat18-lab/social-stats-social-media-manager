# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Audit logging.

Public:
    log_action(actor, client, action, *, object_type='', object_id='',
               platform='', result='success', details=None, error='') -> ActionLog | None

Always non-raising — a failed log call shouldn't crash the action it's tracking.
"""
from __future__ import annotations

import logging
from typing import Optional

from rest_framework import serializers, viewsets

from .models import ActionLog
from .tenant_mixins import TenantScopedMixin

logger = logging.getLogger(__name__)


def log_action(actor, client, action: str, *,
               object_type: str = '', object_id='',
               platform: str = '', result: str = 'success',
               details: Optional[dict] = None,
               error: str = '') -> Optional[ActionLog]:
    """Append an immutable audit row. Returns the row, or None on failure."""
    if client is None:
        return None
    try:
        return ActionLog.objects.create(
            actor=actor if (actor and getattr(actor, 'is_authenticated', False)) else None,
            client=client,
            action=action[:80],
            object_type=str(object_type or '')[:80],
            object_id=str(object_id or '')[:80],
            platform=(platform or '')[:30],
            result=result,
            details=details or {},
            error=str(error or '')[:1000],
        )
    except Exception:
        logger.exception('log_action failed for action=%s', action)
        return None


# ── API surface ──────────────────────────────────────────────────────────────
class ActionLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source='actor.email', read_only=True)
    actor_name  = serializers.CharField(source='actor.get_full_name', read_only=True)

    class Meta:
        model = ActionLog
        fields = [
            'id', 'client',
            'actor', 'actor_email', 'actor_name',
            'action', 'object_type', 'object_id', 'platform',
            'result', 'details', 'error',
            'created_at',
        ]
        read_only_fields = fields


class ActionLogViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    """List + detail of audit entries. Read-only — entries are append-only."""
    queryset = ActionLog.objects.select_related('actor').all()
    serializer_class = ActionLogSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('action'):
            qs = qs.filter(action=params['action'])
        if params.get('actor'):
            qs = qs.filter(actor_id=params['actor'])
        if params.get('result'):
            qs = qs.filter(result=params['result'])
        if params.get('platform'):
            qs = qs.filter(platform=params['platform'])
        if params.get('search'):
            qs = qs.filter(action__icontains=params['search'])
        return qs
