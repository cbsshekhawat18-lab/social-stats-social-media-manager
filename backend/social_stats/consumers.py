# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
WebSocket consumer for live updates.

Connection flow:
  - Client connects to ws://host/ws/realtime/?token=<JWT>
  - JWTAuthMiddleware (in ws_auth.py) sets scope['user']
  - Consumer derives the user's tenant client_ids and joins one channel
    group per accessible client. Server-side publishers fan events to those
    groups via realtime.push_event(...).

Event envelope sent to the client:
  { "type": "<event_type>", "client_id": <int>, "data": <dict> }

The consumer is mostly read-only — it doesn't accept commands beyond `ping`
(used by the frontend to keep the socket warm).
"""
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


def group_name(client_id) -> str:
    """Channel group key — one per tenant."""
    return f'client_{int(client_id)}'


class ClientWSConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or isinstance(user, AnonymousUser) or not user.is_active:
            await self.close(code=4401)  # 4401 = our auth-fail code
            return

        client_ids = await self._tenant_client_ids(user)
        if not client_ids:
            await self.close(code=4403)
            return

        self.user = user
        self.client_ids = client_ids
        self.groups_joined = [group_name(cid) for cid in client_ids]

        for g in self.groups_joined:
            await self.channel_layer.group_add(g, self.channel_name)

        await self.accept()
        await self.send_json({
            'type':       'connection.ready',
            'client_ids': client_ids,
        })

    async def disconnect(self, code):
        for g in getattr(self, 'groups_joined', []):
            await self.channel_layer.group_discard(g, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # Frontend keeps the socket warm with a ping every 30s.
        if isinstance(content, dict) and content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})

    # ── Group event handlers ────────────────────────────────────────────
    async def broadcast_event(self, message):
        """
        Triggered by realtime.push_event(...) via group_send.
        `message` shape: {'type': 'broadcast.event', 'payload': {...}}
        We forward only the payload to the client.
        """
        await self.send_json(message.get('payload') or {})

    # ── Helpers ─────────────────────────────────────────────────────────
    @database_sync_to_async
    def _tenant_client_ids(self, user):
        try:
            profile = user.profile
        except Exception:
            return []
        if profile.role == 'superadmin':
            from .models import Client
            return list(Client.objects.values_list('id', flat=True))
        if profile.role == 'staff':
            return list(profile.assigned_clients.values_list('id', flat=True))
        if profile.role == 'client' and profile.client_id:
            return [profile.client_id]
        return []
