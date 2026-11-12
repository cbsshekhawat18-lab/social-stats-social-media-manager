"""
anthropic 1.x request shape.

The rest of the AI tests stub the SDK, so they can't notice that 1.x removed
`temperature` from `messages.create()` / `.stream()` (a TypeError). These
tests drive the real SDK against an in-memory httpx2 transport — no network —
and assert on the JSON it would send:

- models that still accept sampling parameters (Sonnet 4.6, Haiku 4.5) get
  `temperature` via `extra_body`, so behaviour is unchanged;
- Opus 4.7+ (which return 400 for any sampling parameter) get none.
"""
import json
import uuid

import anthropic
import httpx2
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from social_stats.ai.client import AIClient, sampling_kwargs
from social_stats.models import Client


def _message(model):
    return {
        'id': 'msg_test', 'type': 'message', 'role': 'assistant', 'model': model,
        'content': [{'type': 'text', 'text': 'hello there'}],
        'stop_reason': 'end_turn', 'stop_sequence': None,
        'usage': {'input_tokens': 5, 'output_tokens': 3},
    }


def _sse(model):
    events = [
        ('message_start', {'type': 'message_start', 'message': {
            **_message(model), 'content': [], 'stop_reason': None,
            'usage': {'input_tokens': 5, 'output_tokens': 0}}}),
        ('content_block_start', {'type': 'content_block_start', 'index': 0,
                                 'content_block': {'type': 'text', 'text': ''}}),
        ('content_block_delta', {'type': 'content_block_delta', 'index': 0,
                                 'delta': {'type': 'text_delta', 'text': 'hello there'}}),
        ('content_block_stop', {'type': 'content_block_stop', 'index': 0}),
        ('message_delta', {'type': 'message_delta',
                           'delta': {'stop_reason': 'end_turn', 'stop_sequence': None},
                           'usage': {'output_tokens': 3}}),
        ('message_stop', {'type': 'message_stop'}),
    ]
    return ''.join(f'event: {name}\ndata: {json.dumps(data)}\n\n' for name, data in events)


class _RecordingSDK:
    """Stands in for `anthropic.Anthropic`: a real client on a fake transport."""

    def __init__(self):
        self.bodies = []

    def _handler(self, request):
        body = json.loads(request.content)
        self.bodies.append(body)
        if body.get('stream'):
            return httpx2.Response(200, text=_sse(body['model']),
                                   headers={'content-type': 'text/event-stream'})
        return httpx2.Response(200, json=_message(body['model']))

    def __call__(self, api_key):
        return anthropic.Anthropic(
            api_key=api_key, max_retries=0,
            http_client=anthropic.DefaultHttpxClient(transport=httpx2.MockTransport(self._handler)),
        )


@override_settings(ANTHROPIC_API_KEY='test-key')
class RealSdkRequestTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username=f'u-{uuid.uuid4().hex[:8]}', password='x')
        self.client_obj = Client.objects.create(name='a', company='A',
                                                email=f'a-{uuid.uuid4().hex[:6]}@x.test')
        self.sdk = _RecordingSDK()

    def _ai(self):
        ai = AIClient(client=self.client_obj, user=self.user, feature='test')
        ai._anthropic_class = self.sdk
        return ai

    def test_installed_sdk_is_1x(self):
        self.assertEqual(anthropic.__version__.split('.')[0], '1')

    def test_complete_keeps_temperature_for_sonnet_4_6(self):
        text = self._ai().complete('hi', model='claude-sonnet-4-6', temperature=0.2,
                                   use_cache=False, safety=False)
        self.assertEqual(text, 'hello there')
        self.assertEqual(self.sdk.bodies[-1]['temperature'], 0.2)

    def test_complete_omits_temperature_for_opus_4_7(self):
        self._ai().complete('hi', model='claude-opus-4-7', temperature=0.2,
                            use_cache=False, safety=False)
        body = self.sdk.bodies[-1]
        self.assertEqual(body['model'], 'claude-opus-4-7')
        self.assertNotIn('temperature', body)

    def test_stream_sends_temperature_via_extra_body(self):
        chunks = list(self._ai().complete_stream('hi', model='claude-haiku-4-5-20251001',
                                                 temperature=0.5))
        self.assertEqual(''.join(chunks), 'hello there')
        body = self.sdk.bodies[-1]
        self.assertTrue(body['stream'])
        self.assertEqual(body['temperature'], 0.5)


class SamplingKwargsTests(SimpleTestCase):
    def test_accepting_models(self):
        for model in ('claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-opus-4-6',
                      'claude-sonnet-4-5', 'claude-3-5-haiku-latest'):
            with self.subTest(model=model):
                self.assertEqual(sampling_kwargs(model, 0.3), {'extra_body': {'temperature': 0.3}})

    def test_rejecting_or_unknown_models(self):
        for model in ('claude-opus-4-7', 'claude-opus-4-8', 'claude-opus-5-5',
                      'claude-sonnet-5-5', 'claude-fable-5-2', ''):
            with self.subTest(model=model):
                self.assertEqual(sampling_kwargs(model, 0.3), {})

    def test_none_temperature(self):
        self.assertEqual(sampling_kwargs('claude-sonnet-4-6', None), {})
