"""
Tests for the WebSocket layer + realtime publisher + webhook receivers.

For the consumer we use Channels' WebsocketCommunicator against the ASGI app.
For webhook tests we use DRF's APIClient.
"""
import asyncio
import hashlib
import hmac
import json
import uuid

from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from social_stats.consumers import ClientWSConsumer, group_name
from social_stats.models import Client, PlatformCredential, UserProfile
from social_stats.realtime import push_event


def _client_factory(label='c'):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:8]}@x.test',
    )


def _user_for(client_obj, role='client'):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:12]}',
        email='u@x.test', password='x', is_active=True,
    )
    UserProfile.objects.create(user=u, role=role,
                                client=client_obj if role == 'client' else None)
    return u


def _jwt_for(user):
    return str(RefreshToken.for_user(user).access_token)


@override_settings(CHANNEL_LAYERS={
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
})
class ConsumerTests(TestCase):
    def test_anonymous_connection_rejected(self):
        async def run():
            comm = WebsocketCommunicator(
                ClientWSConsumer.as_asgi(), '/ws/realtime/',
            )
            connected, code = await comm.connect()
            self.assertFalse(connected)
            self.assertEqual(code, 4401)
        asyncio.get_event_loop().run_until_complete(run())

    def test_authenticated_connection_joins_tenant_group(self):
        client_obj = _client_factory()
        user = _user_for(client_obj)

        async def run():
            comm = WebsocketCommunicator(
                ClientWSConsumer.as_asgi(), '/ws/realtime/',
            )
            comm.scope['user'] = user
            connected, _ = await comm.connect()
            self.assertTrue(connected)

            # Server's first frame is connection.ready
            ready = await comm.receive_json_from()
            self.assertEqual(ready['type'], 'connection.ready')
            self.assertEqual(ready['client_ids'], [client_obj.id])

            # ping → pong
            await comm.send_json_to({'type': 'ping'})
            pong = await comm.receive_json_from()
            self.assertEqual(pong['type'], 'pong')

            await comm.disconnect()
        asyncio.get_event_loop().run_until_complete(run())

    def test_push_event_reaches_subscribers(self):
        client_obj = _client_factory()
        user = _user_for(client_obj)

        async def run():
            comm = WebsocketCommunicator(
                ClientWSConsumer.as_asgi(), '/ws/realtime/',
            )
            comm.scope['user'] = user
            connected, _ = await comm.connect()
            self.assertTrue(connected)
            await comm.receive_json_from()  # consume connection.ready

            # Use the channel layer directly to avoid the async_to_sync
            # deadlock that happens when calling sync push_event() from inside
            # a running event loop. Production code uses push_event() (sync),
            # which is also covered by an indirect test below.
            from channels.layers import get_channel_layer
            layer = get_channel_layer()
            await layer.group_send(
                group_name(client_obj.id),
                {'type': 'broadcast.event',
                 'payload': {'type': 'inbox.new_message',
                             'client_id': client_obj.id,
                             'data': {'preview': 'hello'}}},
            )

            event = await comm.receive_json_from(timeout=2)
            self.assertEqual(event['type'], 'inbox.new_message')
            self.assertEqual(event['client_id'], client_obj.id)
            self.assertEqual(event['data']['preview'], 'hello')

            await comm.disconnect()
        asyncio.get_event_loop().run_until_complete(run())

    def test_push_event_helper_runs_without_raising(self):
        """Verify the sync push_event() helper itself works in sync code."""
        client_obj = _client_factory()
        # No subscribers — call should still succeed and not raise
        result = push_event('test.event', client_obj.id, {'k': 'v'})
        self.assertTrue(result)

    def test_user_with_no_client_rejected(self):
        # client-role user with profile.client_id = None
        u = User.objects.create_user(
            username=f'u-{uuid.uuid4().hex[:12]}',
            email='u@x.test', password='x', is_active=True,
        )
        UserProfile.objects.create(user=u, role='client', client=None)

        async def run():
            comm = WebsocketCommunicator(
                ClientWSConsumer.as_asgi(), '/ws/realtime/',
            )
            comm.scope['user'] = u
            connected, code = await comm.connect()
            self.assertFalse(connected)
            self.assertEqual(code, 4403)
        asyncio.get_event_loop().run_until_complete(run())


# ══════════════════════════════════════════════════════════════════════
# Webhooks
# ══════════════════════════════════════════════════════════════════════
class MetaWebhookTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.client_obj = _client_factory('m')
        self.cred = PlatformCredential.objects.create(
            client=self.client_obj, platform='facebook',
            access_token='tok', page_id='100110011001',
            is_active=True,
        )

    @override_settings(META_WEBHOOK_VERIFY_TOKEN='topsecret')
    def test_verify_handshake_echoes_challenge(self):
        res = self.api.get('/api/webhooks/meta/', {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'topsecret',
            'hub.challenge': 'abc123',
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content, b'abc123')

    @override_settings(META_WEBHOOK_VERIFY_TOKEN='topsecret')
    def test_verify_rejects_bad_token(self):
        res = self.api.get('/api/webhooks/meta/', {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'wrong',
            'hub.challenge': 'abc',
        })
        self.assertEqual(res.status_code, 403)

    @override_settings(META_WEBHOOK_SECRET='shh')
    def test_event_signature_required(self):
        body = json.dumps({'object': 'page', 'entry': []}).encode()
        # Bad signature → 403
        res = self.api.post(
            '/api/webhooks/meta/', body,
            content_type='application/json',
            HTTP_X_HUB_SIGNATURE_256='sha256=' + 'a' * 64,
        )
        self.assertEqual(res.status_code, 403)

    @override_settings(META_WEBHOOK_SECRET='shh')
    def test_event_dispatches_sync_for_known_page(self):
        from unittest.mock import patch
        body_dict = {
            'object': 'page',
            'entry': [
                {'id': '100110011001', 'changes': [{'field': 'feed'}]},
                {'id': '999999999',     'changes': [{'field': 'feed'}]},  # no cred
            ],
        }
        body = json.dumps(body_dict).encode()
        sig = 'sha256=' + hmac.new(b'shh', body, hashlib.sha256).hexdigest()

        with patch('social_stats.inbox_tasks.sync_facebook_inbox.delay') as mock_fn:
            res = self.api.post(
                '/api/webhooks/meta/', body,
                content_type='application/json',
                HTTP_X_HUB_SIGNATURE_256=sig,
            )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['fired_clients'], 1)
        mock_fn.assert_called_once_with(self.client_obj.id)


class YouTubeWebhookTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.client_obj = _client_factory('yt')
        PlatformCredential.objects.create(
            client=self.client_obj, platform='youtube',
            access_token='t', refresh_token='r',
            channel_id='UCabc', is_active=True,
        )

    def test_subscribe_handshake_echoes_challenge(self):
        res = self.api.get('/api/webhooks/youtube/', {
            'hub.mode': 'subscribe',
            'hub.challenge': 'xyz999',
            'hub.topic': 'https://www.youtube.com/xml/feeds/videos.xml?channel_id=UCabc',
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content, b'xyz999')

    def test_event_dispatches_youtube_sync(self):
        from unittest.mock import patch
        atom = (
            '<feed><entry><yt:channelId>UCabc</yt:channelId>'
            '<title>New video</title></entry></feed>'
        )
        with patch('social_stats.inbox_tasks.sync_youtube_inbox.delay') as mock_fn:
            res = self.api.post(
                '/api/webhooks/youtube/', atom,
                content_type='application/atom+xml',
            )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['fired_clients'], 1)
        mock_fn.assert_called_once_with(self.client_obj.id)
