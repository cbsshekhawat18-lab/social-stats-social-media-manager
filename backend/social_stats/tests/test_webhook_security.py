"""
Webhook authentication must fail closed.

- Meta: without META_WEBHOOK_SECRET, events are rejected unless DEBUG.
- WhatsApp/Pinbot: the shared secret is only accepted in the
  X-Webhook-Secret header, never as a ?secret= query parameter.
"""
import hashlib
import hmac
import json
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

META_URL = '/api/webhooks/meta/'
WA_URL = '/api/whatsapp/webhook/'


def _meta_body():
    return json.dumps({'object': 'page', 'entry': []}).encode()


class MetaWebhookFailClosedTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def _post(self, body, **headers):
        return self.api.post(META_URL, body, content_type='application/json', **headers)

    @override_settings(META_WEBHOOK_SECRET='', DEBUG=False)
    def test_no_secret_rejects_in_production(self):
        self.assertEqual(self._post(_meta_body()).status_code, 403)

    @override_settings(META_WEBHOOK_SECRET='', DEBUG=False)
    def test_no_secret_rejects_even_with_a_signature(self):
        body = _meta_body()
        sig = 'sha256=' + hmac.new(b'', body, hashlib.sha256).hexdigest()
        self.assertEqual(self._post(body, HTTP_X_HUB_SIGNATURE_256=sig).status_code, 403)

    @override_settings(META_WEBHOOK_SECRET='', DEBUG=True)
    def test_no_secret_accepted_in_debug(self):
        self.assertEqual(self._post(_meta_body()).status_code, 200)

    @override_settings(META_WEBHOOK_SECRET='shh', DEBUG=False)
    def test_valid_signature_accepted(self):
        body = _meta_body()
        sig = 'sha256=' + hmac.new(b'shh', body, hashlib.sha256).hexdigest()
        self.assertEqual(self._post(body, HTTP_X_HUB_SIGNATURE_256=sig).status_code, 200)

    @override_settings(META_WEBHOOK_SECRET='shh', DEBUG=False)
    def test_missing_signature_rejected(self):
        self.assertEqual(self._post(_meta_body()).status_code, 403)


@patch('social_stats.whatsapp_webhook_views.process_whatsapp_webhook.delay')
class WhatsAppWebhookSecretTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def _post(self, url=WA_URL, **headers):
        return self.api.post(url, {'type': 'message'}, format='json', **headers)

    @override_settings(WHATSAPP_WEBHOOK_SECRET='wa-secret')
    def test_header_secret_accepted(self, mock_delay):
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET='wa-secret').status_code, 200)
        mock_delay.assert_called_once()

    @override_settings(WHATSAPP_WEBHOOK_SECRET='wa-secret')
    def test_query_param_secret_rejected(self, mock_delay):
        res = self._post(url=WA_URL + '?secret=wa-secret')
        self.assertEqual(res.status_code, 403)
        mock_delay.assert_not_called()

    @override_settings(WHATSAPP_WEBHOOK_SECRET='wa-secret')
    def test_wrong_and_non_ascii_header_rejected(self, mock_delay):
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET='nope').status_code, 403)
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET='wä-secret').status_code, 403)
        mock_delay.assert_not_called()

    @override_settings(WHATSAPP_WEBHOOK_SECRET='')
    def test_unset_secret_rejects_everything(self, mock_delay):
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET='').status_code, 403)
        mock_delay.assert_not_called()

    @override_settings(WHATSAPP_WEBHOOK_SECRET='')
    def test_handshake_with_empty_token_rejected_when_unset(self, mock_delay):
        res = self.api.get(WA_URL, {'hub.challenge': 'abc', 'hub.verify_token': ''})
        self.assertEqual(res.status_code, 403)

    @override_settings(WHATSAPP_WEBHOOK_SECRET='wa-secret')
    def test_handshake_with_correct_token(self, mock_delay):
        res = self.api.get(WA_URL, {'hub.challenge': 'abc', 'hub.verify_token': 'wa-secret'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.content, b'abc')
