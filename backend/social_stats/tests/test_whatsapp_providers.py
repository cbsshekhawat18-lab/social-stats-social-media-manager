# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Pluggable WhatsApp providers.

Each workspace connects the provider it chooses (Meta Cloud API, Pinbot, or
any Cloud-API-compatible provider) with its own credentials and its own
webhook. These tests pin down:

  • the HTTP client sends the key the way each provider expects it
  • credentials are stored encrypted and never returned by the API
  • the stored key is never sent to an endpoint it wasn't entered for
  • each account's webhook authenticates on its own and is processed for
    that workspace only
"""
import hashlib
import hmac
import json
import uuid
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from social_stats import whatsapp_tasks
from social_stats.models import (
    Client, UserProfile, WhatsAppAccount, WhatsAppContact, WhatsAppMessage, WhatsAppWebhookLog,
)
from social_stats.whatsapp_providers import PROVIDERS, catalog, connection_for, validate_base_url
from social_stats.whatsapp_service import (
    PinbotService, WhatsAppAPIError, WhatsAppAuthError, WhatsAppCloudClient,
    WhatsAppValidationError, client_for_account,
)

PUBLIC_IP = '93.184.216.34'
ACCOUNTS_URL = '/api/whatsapp/accounts/'


def public_dns(ip=PUBLIC_IP):
    """Resolve every hostname to a public IP (no real DNS in tests)."""
    return patch('social_stats.security.ssrf.socket.gethostbyname', return_value=ip)


def make_client(label='acme'):
    return Client.objects.create(name=label, company=label.title(),
                                 email=f'{label}-{uuid.uuid4().hex[:8]}@x.test')


def api_for(client_obj):
    user = User.objects.create_user(username=f'u-{uuid.uuid4().hex[:12]}', password='x')
    UserProfile.objects.create(user=user, role='client', client=client_obj)
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def make_account(client_obj, provider='pinbot', api_key='key-123', **fields):
    fields.setdefault('waba_id', f'W{client_obj.id}')
    fields.setdefault('phone_number_id', f'PN{client_obj.id}')
    account = WhatsAppAccount(client=client_obj, provider=provider, **fields)
    account.api_key = api_key
    account.save()
    return account


def ok_response(body=None, status=200):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = body if body is not None else {'messages': [{'id': 'wamid.1'}]}
    resp.headers = {}
    return resp


# ─────────────────────────────────────────────────────────────────────────────
# 1. The HTTP client
# ─────────────────────────────────────────────────────────────────────────────
@override_settings(META_API_VERSION='v24.0', PINBOT_BASE_URL='https://partnersv1.pinbot.ai/v3')
class ClientRequestShapeTests(TestCase):
    def _send(self, client_obj_account):
        with patch('social_stats.whatsapp_service.requests.request', return_value=ok_response()) as req:
            client_for_account(client_obj_account).send_text('919800000001', 'hello')
        return req.call_args.kwargs

    def test_meta_cloud_uses_graph_url_and_bearer_token(self):
        account = make_account(make_client(), 'meta_cloud', api_key='EAAG-token', phone_number_id='111')
        sent = self._send(account)
        self.assertEqual(sent['url'], 'https://graph.facebook.com/v24.0/111/messages')
        self.assertEqual(sent['headers']['Authorization'], 'Bearer EAAG-token')
        self.assertNotIn('apikey', sent['headers'])
        self.assertEqual(sent['json']['messaging_product'], 'whatsapp')
        self.assertEqual(sent['json']['text']['body'], 'hello')

    def test_pinbot_uses_its_url_and_raw_apikey_header(self):
        account = make_account(make_client(), 'pinbot', api_key='pb-key', phone_number_id='222')
        sent = self._send(account)
        self.assertEqual(sent['url'], 'https://partnersv1.pinbot.ai/v3/222/messages')
        self.assertEqual(sent['headers']['apikey'], 'pb-key')
        self.assertNotIn('Authorization', sent['headers'])

    def test_custom_provider_uses_the_workspace_url_and_header(self):
        account = make_account(make_client(), 'custom', api_key='c-key', phone_number_id='333',
                               api_base_url='https://waba.example.com/v1/',
                               auth_header='D360-API-KEY', auth_scheme='')
        with public_dns():
            sent = self._send(account)
        self.assertEqual(sent['url'], 'https://waba.example.com/v1/333/messages')
        self.assertEqual(sent['headers']['D360-API-KEY'], 'c-key')      # blank scheme → raw key

    def test_custom_provider_with_a_scheme(self):
        account = make_account(make_client(), 'custom', api_key='c-key',
                               api_base_url='https://waba.example.com', auth_scheme='Token')
        with public_dns():
            sent = self._send(account)
        self.assertEqual(sent['headers']['Authorization'], 'Token c-key')

    def test_api_calls_never_follow_redirects(self):
        account = make_account(make_client(), 'meta_cloud')
        self.assertIs(self._send(account)['allow_redirects'], False)

    def test_accounts_created_before_providers_existed_are_pinbot(self):
        account = WhatsAppAccount.objects.create(client=make_client(), waba_id='W', phone_number_id='P')
        self.assertEqual(account.provider, 'pinbot')
        self.assertEqual(connection_for(account).base_url, 'https://partnersv1.pinbot.ai/v3')

    def test_unknown_provider_value_falls_back_to_pinbot(self):
        account = make_account(make_client(), 'something-removed')
        self.assertEqual(connection_for(account).provider, 'pinbot')

    def test_pinbot_service_alias_still_works(self):
        svc = PinbotService('k', phone_number_id='1')
        self.assertIsInstance(svc, WhatsAppCloudClient)
        self.assertEqual(svc._auth_headers(), {'apikey': 'k'})

    def test_account_without_a_key_cannot_build_a_client(self):
        account = WhatsAppAccount.objects.create(client=make_client(), waba_id='W', phone_number_id='P')
        with self.assertRaises(WhatsAppAuthError):
            client_for_account(account)

    def test_connection_check_uses_the_right_endpoint(self):
        meta = make_account(make_client('m'), 'meta_cloud', phone_number_id='111')
        pinbot = make_account(make_client('p'), 'pinbot')
        with patch('social_stats.whatsapp_service.requests.request', return_value=ok_response({})) as req:
            client_for_account(meta).check_connection()
            client_for_account(pinbot).check_connection()
        urls = [c.kwargs['url'] for c in req.call_args_list]
        self.assertEqual(urls, ['https://graph.facebook.com/v24.0/111',
                                'https://partnersv1.pinbot.ai/v3/getuserdetails'])


class CustomBaseUrlSafetyTests(TestCase):
    def test_http_is_refused(self):
        with public_dns(), self.assertRaises(ValueError):
            validate_base_url('http://waba.example.com')

    def test_private_and_metadata_addresses_are_refused(self):
        for ip in ('127.0.0.1', '10.0.0.5', '192.168.1.10', '169.254.169.254'):
            with public_dns(ip), self.assertRaises(ValueError, msg=ip):
                validate_base_url('https://internal.example.com')

    def test_blank_is_refused(self):
        with self.assertRaises(ValueError):
            validate_base_url('  ')

    def test_public_https_is_accepted_and_trimmed(self):
        with public_dns():
            self.assertEqual(validate_base_url(' https://waba.example.com/v1/ '), 'https://waba.example.com/v1')

    def test_base_url_is_rechecked_when_the_client_is_built(self):
        """A hostname that later starts resolving to an internal address
        (DNS rebinding) must not be called with the workspace's key."""
        account = make_account(make_client(), 'custom', api_base_url='https://waba.example.com')
        with public_dns('10.0.0.5'), self.assertRaises(WhatsAppValidationError):
            client_for_account(account)

    def test_media_url_from_the_provider_is_not_trusted(self):
        account = make_account(make_client(), 'meta_cloud')
        svc = client_for_account(account)
        with patch.object(svc, 'get_media_url', return_value={'url': 'https://evil.example.com/x'}), \
             public_dns('169.254.169.254'), \
             patch('social_stats.whatsapp_service.requests.get') as get:
            with self.assertRaises(WhatsAppAPIError):
                svc.download_media('MEDIA1')
        get.assert_not_called()

    def test_media_redirect_to_another_host_drops_the_key(self):
        svc = client_for_account(make_account(make_client(), 'meta_cloud', api_key='tok'))
        redirect = ok_response(status=302)
        redirect.headers = {'Location': 'https://cdn.other.example.com/file'}
        final = ok_response(status=200)
        final.content = b'bytes'
        with patch.object(svc, 'get_media_url', return_value={'url': 'https://media.example.com/x'}), \
             public_dns(), \
             patch('social_stats.whatsapp_service.requests.get', side_effect=[redirect, final]) as get:
            self.assertEqual(svc.download_media('MEDIA1'), b'bytes')
        first, second = get.call_args_list
        self.assertEqual(first.kwargs['headers'], {'Authorization': 'Bearer tok'})
        self.assertEqual(second.kwargs['headers'], {})
        self.assertIs(second.kwargs['allow_redirects'], False)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Stored credentials
# ─────────────────────────────────────────────────────────────────────────────
class CredentialStorageTests(TestCase):
    def test_key_and_app_secret_are_encrypted_at_rest(self):
        account = make_account(make_client(), 'meta_cloud', api_key='EAAG-plain')
        account.app_secret = 'app-secret-plain'
        account.save()
        account.refresh_from_db()
        self.assertEqual(account.api_key, 'EAAG-plain')
        self.assertEqual(account.app_secret, 'app-secret-plain')
        self.assertNotIn(b'EAAG-plain', bytes(account.api_key_encrypted))
        self.assertNotIn(b'app-secret-plain', bytes(account.app_secret_encrypted))

    def test_every_account_gets_its_own_webhook_credentials(self):
        a, b = make_account(make_client('a')), make_account(make_client('b'))
        self.assertTrue(a.webhook_key and a.webhook_verify_token)
        self.assertNotEqual(a.webhook_key, b.webhook_key)
        self.assertNotEqual(a.webhook_verify_token, b.webhook_verify_token)


# ─────────────────────────────────────────────────────────────────────────────
# 3. The account API
# ─────────────────────────────────────────────────────────────────────────────
class AccountApiTests(TestCase):
    def setUp(self):
        self.client_obj = make_client()
        self.api = api_for(self.client_obj)

    def _create(self, **body):
        body = {'client': self.client_obj.id, 'waba_id': 'W1', 'phone_number_id': 'PN1', **body}
        return self.api.post(ACCOUNTS_URL, body, format='json')

    def test_provider_catalog_endpoint(self):
        res = self.api.get('/api/whatsapp/providers/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([p['key'] for p in res.data['providers']], ['meta_cloud', 'pinbot', 'custom'])
        self.assertEqual(json.loads(json.dumps(res.data['providers'])), catalog())   # plain data only

    def test_provider_catalog_requires_login(self):
        self.assertIn(APIClient().get('/api/whatsapp/providers/').status_code, (401, 403))

    def test_workspace_comes_from_the_signed_in_user(self):
        other = make_client('other')
        res = self.api.post(ACCOUNTS_URL, {'waba_id': 'W1', 'phone_number_id': 'PN1', 'api_key': 'k'},
                            format='json')                           # no `client` sent (the settings form)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(WhatsAppAccount.objects.get().client_id, self.client_obj.id)
        WhatsAppAccount.objects.all().delete()
        res = self.api.post(ACCOUNTS_URL, {'client': other.id, 'waba_id': 'W1', 'phone_number_id': 'PN1',
                                           'api_key': 'k'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(WhatsAppAccount.objects.get().client_id, self.client_obj.id)

    def test_connect_meta_cloud(self):
        res = self._create(provider='meta_cloud', api_key='EAAG-token', app_secret='shh')
        self.assertEqual(res.status_code, 201, res.data)
        account = WhatsAppAccount.objects.get(client=self.client_obj)
        self.assertEqual((account.provider, account.api_key, account.app_secret),
                         ('meta_cloud', 'EAAG-token', 'shh'))
        self.assertEqual(res.data['webhook_auth'], 'signature')
        self.assertTrue(res.data['webhook_url'].endswith(f'/api/whatsapp/webhook/{account.webhook_key}/'))
        self.assertEqual(res.data['webhook_verify_token'], account.webhook_verify_token)

    def test_secrets_are_never_returned(self):
        self._create(provider='meta_cloud', api_key='EAAG-token', app_secret='shh')
        for res in (self.api.get(ACCOUNTS_URL),
                    self.api.get(f'{ACCOUNTS_URL}{WhatsAppAccount.objects.get().id}/')):
            body = json.dumps(res.data, default=str)
            self.assertNotIn('EAAG-token', body)
            self.assertNotIn('shh', body)
            self.assertNotIn('api_key_encrypted', body)
            self.assertNotIn('"api_key"', body)
            self.assertNotIn('"app_secret"', body)
        row = (res.data.get('results') if isinstance(res.data, dict) and 'results' in res.data else None) or res.data
        row = row[0] if isinstance(row, list) else row
        self.assertTrue(row['has_api_key'] and row['has_app_secret'])

    def test_meta_cloud_needs_the_app_secret(self):
        res = self._create(provider='meta_cloud', api_key='EAAG-token')
        self.assertEqual(res.status_code, 400)
        self.assertIn('app_secret', res.data)

    def test_an_api_key_is_required(self):
        res = self._create(provider='pinbot')
        self.assertEqual(res.status_code, 400)
        self.assertIn('api_key', res.data)

    def test_unknown_provider_is_rejected(self):
        res = self._create(provider='twilio', api_key='k')
        self.assertEqual(res.status_code, 400)
        self.assertIn('provider', res.data)

    def test_provider_defaults_to_pinbot_for_older_api_users(self):
        res = self._create(api_key='pb-key')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data['provider'], 'pinbot')
        self.assertEqual(res.data['webhook_auth'], 'header')

    def test_connect_custom_provider(self):
        with public_dns():
            res = self._create(provider='custom', api_key='c-key',
                               api_base_url='https://waba.example.com/v1/', auth_header='X-API-Key',
                               auth_scheme='')
        self.assertEqual(res.status_code, 201, res.data)
        account = WhatsAppAccount.objects.get(client=self.client_obj)
        self.assertEqual((account.api_base_url, account.auth_header, account.auth_scheme),
                         ('https://waba.example.com/v1', 'X-API-Key', ''))

    def test_custom_provider_defaults_to_bearer_authorization(self):
        with public_dns():
            res = self._create(provider='custom', api_key='c-key', api_base_url='https://waba.example.com')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual((res.data['auth_header'], res.data['auth_scheme']), ('Authorization', 'Bearer'))

    def test_custom_provider_validation(self):
        with public_dns():
            self.assertIn('api_base_url', self._create(provider='custom', api_key='k').data)
            self.assertIn('api_base_url', self._create(
                provider='custom', api_key='k', api_base_url='http://waba.example.com').data)
            for bad in ('Host', 'X Bad Header', 'a:b', 'Content-Length'):
                res = self._create(provider='custom', api_key='k',
                                   api_base_url='https://waba.example.com', auth_header=bad)
                self.assertEqual(res.status_code, 400, bad)
                self.assertIn('auth_header', res.data)
            res = self._create(provider='custom', api_key='k', api_base_url='https://waba.example.com',
                               auth_scheme='Bearer x\r\nX-Evil: 1')
            self.assertEqual(res.status_code, 400)
        with public_dns('10.1.2.3'):
            res = self._create(provider='custom', api_key='k', api_base_url='https://intranet.example.com')
            self.assertEqual(res.status_code, 400)
            self.assertIn('api_base_url', res.data)
        self.assertFalse(WhatsAppAccount.objects.exists())

    def test_built_in_providers_ignore_url_and_header_overrides(self):
        res = self._create(provider='pinbot', api_key='pb', api_base_url='https://evil.example.com',
                           auth_header='X-Steal')
        self.assertEqual(res.status_code, 201, res.data)
        account = WhatsAppAccount.objects.get()
        self.assertEqual((account.api_base_url, account.auth_header), ('', ''))
        self.assertEqual(connection_for(account).base_url, PROVIDERS['pinbot']['base_url']())

    def test_ordinary_edits_keep_the_stored_key(self):
        account = make_account(self.client_obj, 'pinbot', api_key='pb-key')
        res = self.api.patch(f'{ACCOUNTS_URL}{account.id}/', {'display_name': 'Shop'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        account.refresh_from_db()
        self.assertEqual((account.display_name, account.api_key), ('Shop', 'pb-key'))

    def test_switching_provider_needs_the_new_key(self):
        """The stored Pinbot key must never be sent to another provider."""
        account = make_account(self.client_obj, 'pinbot', api_key='pb-key')
        url = f'{ACCOUNTS_URL}{account.id}/'
        with public_dns():
            res = self.api.patch(url, {'provider': 'custom', 'api_base_url': 'https://attacker.example.com'},
                                 format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('api_key', res.data)
        account.refresh_from_db()
        self.assertEqual((account.provider, account.api_base_url), ('pinbot', ''))

        res = self.api.patch(url, {'provider': 'meta_cloud', 'api_key': 'EAAG', 'app_secret': 's'},
                             format='json')
        self.assertEqual(res.status_code, 200, res.data)
        account.refresh_from_db()
        self.assertEqual((account.provider, account.api_key, account.app_secret), ('meta_cloud', 'EAAG', 's'))

    def test_changing_a_custom_base_url_needs_the_key_again(self):
        with public_dns():
            account = make_account(self.client_obj, 'custom', api_key='c-key',
                                   api_base_url='https://waba.example.com')
            url = f'{ACCOUNTS_URL}{account.id}/'
            res = self.api.patch(url, {'api_base_url': 'https://attacker.example.com'}, format='json')
            self.assertEqual(res.status_code, 400)
            self.assertIn('api_key', res.data)
            # Same URL (give or take a trailing slash) is not a change.
            res = self.api.patch(url, {'api_base_url': 'https://waba.example.com/', 'display_name': 'x'},
                                 format='json')
            self.assertEqual(res.status_code, 200, res.data)
            res = self.api.patch(url, {'api_base_url': 'https://new.example.com', 'api_key': 'new-key'},
                                 format='json')
            self.assertEqual(res.status_code, 200, res.data)
        account.refresh_from_db()
        self.assertEqual((account.api_base_url, account.api_key), ('https://new.example.com', 'new-key'))

    def test_leaving_meta_drops_the_app_secret(self):
        account = make_account(self.client_obj, 'meta_cloud', api_key='EAAG')
        account.app_secret = 'shh'
        account.save()
        res = self.api.patch(f'{ACCOUNTS_URL}{account.id}/', {'provider': 'pinbot', 'api_key': 'pb'},
                             format='json')
        self.assertEqual(res.status_code, 200, res.data)
        account.refresh_from_db()
        self.assertEqual(account.app_secret, '')
        self.assertEqual(res.data['webhook_auth'], 'header')

    def test_meta_edits_keep_the_app_secret(self):
        account = make_account(self.client_obj, 'meta_cloud', api_key='EAAG')
        account.app_secret = 'shh'
        account.save()
        res = self.api.patch(f'{ACCOUNTS_URL}{account.id}/', {'display_name': 'Shop'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        account.refresh_from_db()
        self.assertEqual(account.app_secret, 'shh')

    def test_other_workspaces_cannot_see_or_edit_the_account(self):
        account = make_account(self.client_obj, 'pinbot')
        other = api_for(make_client('other'))
        self.assertEqual(other.get(f'{ACCOUNTS_URL}{account.id}/').status_code, 404)
        self.assertEqual(other.patch(f'{ACCOUNTS_URL}{account.id}/', {'display_name': 'x'},
                                     format='json').status_code, 404)
        self.assertEqual(other.post(f'{ACCOUNTS_URL}{account.id}/rotate_webhook_token/').status_code, 404)
        self.assertEqual(other.post(f'{ACCOUNTS_URL}{account.id}/test_connection/').status_code, 404)

    def test_an_account_cannot_be_moved_to_another_workspace(self):
        account = make_account(self.client_obj, 'pinbot')
        other_client = make_client('other')
        self.api.patch(f'{ACCOUNTS_URL}{account.id}/', {'client': other_client.id}, format='json')
        account.refresh_from_db()
        self.assertEqual(account.client_id, self.client_obj.id)

    def test_rotate_webhook_token(self):
        account = make_account(self.client_obj, 'pinbot')
        old = account.webhook_verify_token
        res = self.api.post(f'{ACCOUNTS_URL}{account.id}/rotate_webhook_token/')
        self.assertEqual(res.status_code, 200)
        account.refresh_from_db()
        self.assertNotEqual(account.webhook_verify_token, old)
        self.assertEqual(res.data['webhook_verify_token'], account.webhook_verify_token)

    def test_test_connection_calls_the_accounts_own_provider(self):
        account = make_account(self.client_obj, 'meta_cloud', api_key='EAAG', phone_number_id='111')
        body = {'display_phone_number': '+91 98000 00001', 'verified_name': 'Shop'}
        with patch('social_stats.whatsapp_service.requests.request', return_value=ok_response(body)) as req:
            res = self.api.post(f'{ACCOUNTS_URL}{account.id}/test_connection/')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['details'], body)
        self.assertIn('graph.facebook.com', req.call_args.kwargs['url'])

    def test_test_connection_reports_bad_credentials(self):
        account = make_account(self.client_obj, 'meta_cloud', api_key='EAAG-secret-token')
        with patch('social_stats.whatsapp_service.requests.request',
                   return_value=ok_response({'error': {'message': 'Invalid OAuth access token'}}, status=401)):
            res = self.api.post(f'{ACCOUNTS_URL}{account.id}/test_connection/')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['error'], 'auth')
        self.assertNotIn('EAAG-secret-token', json.dumps(res.data))


# ─────────────────────────────────────────────────────────────────────────────
# 4. Per-account webhooks
# ─────────────────────────────────────────────────────────────────────────────
def inbound_payload(phone_number_id, sender='919800000001', msg_id='wamid.IN1', body='hello'):
    return {'object': 'whatsapp_business_account', 'entry': [{'changes': [{'field': 'messages', 'value': {
        'metadata': {'phone_number_id': phone_number_id},
        'contacts': [{'wa_id': sender, 'profile': {'name': 'Asha'}}],
        'messages': [{'from': sender, 'id': msg_id, 'timestamp': '1700000000',
                      'type': 'text', 'text': {'body': body}}],
    }}]}]}


def status_payload(phone_number_id, wa_id, status='delivered'):
    return {'object': 'whatsapp_business_account', 'entry': [{'changes': [{'field': 'messages', 'value': {
        'metadata': {'phone_number_id': phone_number_id},
        'statuses': [{'id': wa_id, 'status': status, 'timestamp': '1700000000'}],
    }}]}]}


def sign(secret, body: bytes) -> str:
    return 'sha256=' + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@patch('social_stats.whatsapp_webhook_views.process_whatsapp_webhook.delay')
class AccountWebhookAuthTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.client_obj = make_client()
        self.account = make_account(self.client_obj, 'pinbot')
        self.url = f'/api/whatsapp/webhook/{self.account.webhook_key}/'
        self.token = self.account.webhook_verify_token

    def _post(self, body=None, url=None, **headers):
        raw = json.dumps(body or {'object': 'whatsapp_business_account', 'entry': []}).encode()
        return self.api.post(url or self.url, raw, content_type='application/json', **headers)

    def test_header_secret_accepted_and_logged_for_the_workspace(self, delay):
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET=self.token).status_code, 200)
        log = WhatsAppWebhookLog.objects.get()
        self.assertEqual(log.client_id, self.client_obj.id)
        delay.assert_called_once_with(log.id)

    def test_missing_or_wrong_secret_rejected(self, delay):
        self.assertEqual(self._post().status_code, 403)
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET='nope').status_code, 403)
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET='tökèn').status_code, 403)
        self.assertEqual(self._post(url=f'{self.url}?secret={self.token}').status_code, 403)
        delay.assert_not_called()
        self.assertFalse(WhatsAppWebhookLog.objects.exists())

    def test_another_accounts_secret_is_rejected(self, delay):
        other = make_account(make_client('other'), 'pinbot')
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET=other.webhook_verify_token).status_code, 403)
        delay.assert_not_called()

    @override_settings(WHATSAPP_WEBHOOK_SECRET='global-secret')
    def test_the_global_secret_does_not_open_an_account_webhook(self, delay):
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET='global-secret').status_code, 403)

    def test_unknown_or_inactive_account_is_404(self, delay):
        self.assertEqual(self._post(url='/api/whatsapp/webhook/not-a-real-key/',
                                    HTTP_X_WEBHOOK_SECRET=self.token).status_code, 404)
        WhatsAppAccount.objects.filter(pk=self.account.pk).update(is_active=False)
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET=self.token).status_code, 404)
        delay.assert_not_called()

    def test_handshake(self, delay):
        res = self.api.get(self.url, {'hub.mode': 'subscribe', 'hub.challenge': '4242',
                                      'hub.verify_token': self.token})
        self.assertEqual((res.status_code, res.content), (200, b'4242'))
        for bad in ('nope', ''):
            res = self.api.get(self.url, {'hub.challenge': '4242', 'hub.verify_token': bad})
            self.assertEqual(res.status_code, 403)

    def test_rotated_token_replaces_the_old_one(self, delay):
        self.account.rotate_webhook_token()
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET=self.token).status_code, 403)
        self.assertEqual(self._post(HTTP_X_WEBHOOK_SECRET=self.account.webhook_verify_token).status_code, 200)

    def test_meta_signature_accepted(self, delay):
        self.account.provider = 'meta_cloud'
        self.account.app_secret = 'app-secret'
        self.account.save()
        body = {'object': 'whatsapp_business_account', 'entry': []}
        raw = json.dumps(body).encode()
        res = self._post(body, HTTP_X_HUB_SIGNATURE_256=sign('app-secret', raw))
        self.assertEqual(res.status_code, 200)
        delay.assert_called_once()

    def test_meta_signature_is_mandatory_once_an_app_secret_is_set(self, delay):
        self.account.provider = 'meta_cloud'
        self.account.app_secret = 'app-secret'
        self.account.save()
        body = {'object': 'whatsapp_business_account', 'entry': []}
        raw = json.dumps(body).encode()
        self.assertEqual(self._post(body).status_code, 403)
        self.assertEqual(self._post(body, HTTP_X_HUB_SIGNATURE_256=sign('wrong', raw)).status_code, 403)
        self.assertEqual(self._post(body, HTTP_X_HUB_SIGNATURE_256='sha256=').status_code, 403)
        # The verify token is public to Meta's dashboard; it must not replace the signature.
        self.assertEqual(self._post(body, HTTP_X_WEBHOOK_SECRET=self.token).status_code, 403)
        # A signature over a different body is no good either.
        other = json.dumps({'object': 'x', 'entry': [1]}).encode()
        self.assertEqual(self._post(body, HTTP_X_HUB_SIGNATURE_256=sign('app-secret', other)).status_code, 403)
        delay.assert_not_called()

    @override_settings(WHATSAPP_WEBHOOK_SECRET='global-secret')
    def test_the_shared_endpoint_still_works(self, delay):
        res = self.api.post('/api/whatsapp/webhook/', {'type': 'message'}, format='json',
                            HTTP_X_WEBHOOK_SECRET='global-secret')
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(WhatsAppWebhookLog.objects.get().client_id)


class AccountWebhookProcessingTests(TestCase):
    """What arrives on a workspace's webhook only ever touches that workspace."""

    def setUp(self):
        self.client_a, self.client_b = make_client('a'), make_client('b')
        self.account_a = make_account(self.client_a, 'meta_cloud', phone_number_id='PN-A')
        self.account_b = make_account(self.client_b, 'pinbot', phone_number_id='PN-B')

    def _process(self, payload, client=None):
        log = WhatsAppWebhookLog.objects.create(client=client, event_type='messages', payload=payload)
        with patch('social_stats.bot_engine.process_incoming_message'):
            whatsapp_tasks.process_whatsapp_webhook(log.id)
        log.refresh_from_db()
        return log

    def test_inbound_on_own_webhook_is_stored_for_that_workspace(self):
        log = self._process(inbound_payload('PN-A'), client=self.client_a)
        self.assertTrue(log.processed)
        msg = WhatsAppMessage.objects.get(pinbot_message_id='wamid.IN1')
        self.assertEqual((msg.client_id, msg.direction), (self.client_a.id, 'inbound'))
        self.assertTrue(WhatsAppContact.objects.filter(client=self.client_a, phone='919800000001').exists())

    def test_inbound_for_another_workspaces_number_is_dropped(self):
        """Workspace A's webhook (A's own secret) must not be a way to inject
        messages into workspace B."""
        self._process(inbound_payload('PN-B'), client=self.client_a)
        self.assertFalse(WhatsAppMessage.objects.exists())
        self.assertFalse(WhatsAppContact.objects.exists())

    def test_status_updates_only_touch_the_webhooks_own_workspace(self):
        contact_b = WhatsAppContact.objects.create(client=self.client_b, phone='919800000002')
        msg_b = WhatsAppMessage.objects.create(client=self.client_b, contact=contact_b, direction='outbound',
                                               pinbot_message_id='wamid.OUT', status='sent')
        self._process(status_payload('PN-B', 'wamid.OUT', 'read'), client=self.client_a)
        msg_b.refresh_from_db()
        self.assertEqual(msg_b.status, 'sent')

        self._process(status_payload('PN-B', 'wamid.OUT', 'read'), client=self.client_b)
        msg_b.refresh_from_db()
        self.assertEqual(msg_b.status, 'read')

    def test_shared_endpoint_still_routes_by_phone_number_id(self):
        self._process(inbound_payload('PN-B', msg_id='wamid.IN2'))
        self.assertEqual(WhatsAppMessage.objects.get(pinbot_message_id='wamid.IN2').client_id, self.client_b.id)


class SyncAccountStatusTests(TestCase):
    def test_meta_account_reads_quality_from_the_phone_number(self):
        account = make_account(make_client(), 'meta_cloud', phone_number_id='111', messaging_tier='TIER_10K')
        body = {'display_phone_number': '+91 98', 'verified_name': 'Shop', 'quality_rating': 'GREEN'}
        with patch('social_stats.whatsapp_service.requests.request', return_value=ok_response(body)) as req:
            whatsapp_tasks.sync_account_status(account.client_id)
        self.assertTrue(req.call_args.kwargs['url'].endswith('/111'))
        account.refresh_from_db()
        self.assertEqual(account.quality_rating, 'GREEN')
        self.assertEqual(account.messaging_tier, 'TIER_10K')        # not reported → left as it was
        self.assertIsNotNone(account.last_synced_at)
