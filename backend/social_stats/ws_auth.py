# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Custom Channels middleware that authenticates WebSocket connections via JWT.

Token passed in the connection URL's query string:
    ws://host/ws/realtime/?token=<JWT>

On success, scope['user'] is set to the resolved Django User. On failure,
scope['user'] is AnonymousUser — the consumer rejects the connection.

We avoid using Channels' AuthMiddlewareStack because that reads session
cookies; the SPA carries its JWT in localStorage and connects without
cookies.
"""
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser

logger = logging.getLogger(__name__)


@database_sync_to_async
def _resolve_user(token: str):
    """Validate JWT and return the matching Django User (or AnonymousUser)."""
    if not token:
        return AnonymousUser()
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth.models import User
        access = AccessToken(token)
        user_id = access.get('user_id')
        if not user_id:
            return AnonymousUser()
        try:
            return User.objects.select_related('profile').get(id=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
    except Exception as e:
        logger.debug('WS JWT validation failed: %s', e)
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        qs = parse_qs((scope.get('query_string') or b'').decode())
        token = (qs.get('token') or [None])[0]
        scope['user'] = await _resolve_user(token)
        return await super().__call__(scope, receive, send)
