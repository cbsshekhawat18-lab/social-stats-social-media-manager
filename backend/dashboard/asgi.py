"""
ASGI config for dashboard project — wires HTTP through Django and WebSocket
through Channels (via social_stats.routing).

In dev: `python manage.py runserver` uses Daphne (because it's first in
INSTALLED_APPS) and serves both HTTP and WS. In prod, run with:
    daphne -b 0.0.0.0 -p 8000 dashboard.asgi:application
"""
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')

from django.core.asgi import get_asgi_application

# IMPORTANT: import django HTTP application first so apps are loaded.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter

from social_stats.routing import websocket_urlpatterns
from social_stats.ws_auth import JWTAuthMiddleware

application = ProtocolTypeRouter({
    'http':       django_asgi_app,
    'websocket':  JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
})
