# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
PinbotService — wraps Pinbot Partners API v3 (https://partnersv1.pinbot.ai/v3).

Auth: single header `apikey: YOUR_WABA_API_KEY` per WABA. One Pinbot key
serves multiple `phone_number_id`s (one per Social Stats client).

Usage:
    svc = get_pinbot_for_client(client_id)
    svc.send_text('+919876543210', 'Hello!')

Or directly:
    svc = PinbotService(api_key='...', phone_number_id='...', waba_id='...')
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import requests
from django.conf import settings
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


# ── Exceptions ────────────────────────────────────────────────────────────────
class PinbotError(Exception):
    """Base class for all Pinbot errors."""
    def __init__(self, message: str, *, status_code: Optional[int] = None, response: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class PinbotAuthError(PinbotError):
    """401/403 — bad apikey or missing permissions."""


class PinbotRateLimitError(PinbotError):
    """429 — rate limit exceeded."""


class PinbotValidationError(PinbotError):
    """400/422 — validation failure on payload."""


class PinbotAPIError(PinbotError):
    """5xx or other unexpected response."""


# ── Service ───────────────────────────────────────────────────────────────────
class PinbotService:
    """Thin wrapper over the Pinbot Partners API v3."""

    def __init__(
        self,
        api_key: str,
        phone_number_id: Optional[str] = None,
        waba_id: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        if not api_key:
            raise PinbotAuthError('api_key is required')
        self.api_key = api_key
        self.phone_number_id = phone_number_id
        self.waba_id = waba_id
        self.base_url = (base_url or getattr(settings, 'PINBOT_BASE_URL', 'https://partnersv1.pinbot.ai/v3')).rstrip('/')

    # ── HTTP plumbing ─────────────────────────────────────────────────────────
    def _headers(self, *, json_body: bool = True) -> dict:
        h = {'apikey': self.api_key, 'Accept': 'application/json'}
        if json_body:
            h['Content-Type'] = 'application/json'
        return h

    @retry(
        retry=retry_if_exception_type((PinbotRateLimitError, PinbotAPIError, requests.ConnectionError, requests.Timeout)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        files: Any = None,
        data: Any = None,
        params: Any = None,
    ) -> Any:
        url = f"{self.base_url}{path if path.startswith('/') else '/' + path}"
        logger.info('Pinbot %s %s', method, path)
        try:
            resp = requests.request(
                method=method,
                url=url,
                headers=self._headers(json_body=(files is None and data is None)),
                json=json,
                files=files,
                data=data,
                params=params,
                timeout=(10, 30),
            )
        except (requests.ConnectionError, requests.Timeout):
            logger.exception('Pinbot connection/timeout %s %s', method, path)
            raise

        return self._handle_response(resp, method, path)

    def _handle_response(self, resp: requests.Response, method: str, path: str) -> Any:
        sc = resp.status_code
        # Try to parse JSON; fall back to text
        try:
            body = resp.json()
        except Exception:
            body = resp.text

        if 200 <= sc < 300:
            return body

        # Sanitize before logging — never log api_key
        snippet = body if isinstance(body, (dict, list)) else str(body)[:500]
        logger.error('Pinbot %s %s failed %s: %s', method, path, sc, snippet)

        if sc in (401, 403):
            raise PinbotAuthError(f'Pinbot auth failed ({sc})', status_code=sc, response=body)
        if sc == 429:
            raise PinbotRateLimitError('Pinbot rate-limit exceeded', status_code=sc, response=body)
        if sc in (400, 422):
            raise PinbotValidationError(f'Pinbot validation error ({sc})', status_code=sc, response=body)
        raise PinbotAPIError(f'Pinbot API error ({sc})', status_code=sc, response=body)

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _phone_id(self, override: Optional[str] = None) -> str:
        pid = override or self.phone_number_id
        if not pid:
            raise PinbotValidationError('phone_number_id is required for this call')
        return pid

    def _waba_id(self, override: Optional[str] = None) -> str:
        wid = override or self.waba_id
        if not wid:
            raise PinbotValidationError('waba_id is required for this call')
        return wid

    def _wrap_message(self, to: str, message_type: str, body: dict) -> dict:
        """Build a standard Cloud-API style payload."""
        payload = {
            'messaging_product': 'whatsapp',
            'recipient_type':    'individual',
            'to':                to,
            'type':              message_type,
        }
        payload.update(body)
        return payload

    def _send(self, payload: dict, *, phone_number_id: Optional[str] = None) -> dict:
        pid = self._phone_id(phone_number_id)
        return self._request('POST', f'/{pid}/messages', json=payload)

    # ── Messaging — basic ─────────────────────────────────────────────────────
    def send_text(self, to: str, body: str, preview_url: bool = False) -> dict:
        return self._send(self._wrap_message(to, 'text', {
            'text': {'body': body, 'preview_url': bool(preview_url)},
        }))

    def send_location(self, to: str, lat: float, lng: float, name: str = '', address: str = '') -> dict:
        return self._send(self._wrap_message(to, 'location', {
            'location': {
                'latitude':  lat,
                'longitude': lng,
                'name':      name,
                'address':   address,
            },
        }))

    def _media_block(self, link: Optional[str], media_id: Optional[str], extra: Optional[dict] = None) -> dict:
        if not link and not media_id:
            raise PinbotValidationError('Either link or media_id must be provided')
        block = {}
        if media_id:
            block['id'] = media_id
        else:
            block['link'] = link
        if extra:
            block.update({k: v for k, v in extra.items() if v is not None})
        return block

    def send_image(self, to: str, link: Optional[str] = None, media_id: Optional[str] = None, caption: Optional[str] = None) -> dict:
        return self._send(self._wrap_message(to, 'image', {
            'image': self._media_block(link, media_id, {'caption': caption}),
        }))

    def send_video(self, to: str, link: Optional[str] = None, media_id: Optional[str] = None, caption: Optional[str] = None) -> dict:
        return self._send(self._wrap_message(to, 'video', {
            'video': self._media_block(link, media_id, {'caption': caption}),
        }))

    def send_document(
        self,
        to: str,
        link: Optional[str] = None,
        media_id: Optional[str] = None,
        filename: Optional[str] = None,
        caption: Optional[str] = None,
    ) -> dict:
        return self._send(self._wrap_message(to, 'document', {
            'document': self._media_block(link, media_id, {'filename': filename, 'caption': caption}),
        }))

    def send_audio(self, to: str, link: Optional[str] = None, media_id: Optional[str] = None) -> dict:
        return self._send(self._wrap_message(to, 'audio', {
            'audio': self._media_block(link, media_id),
        }))

    def send_contacts(self, to: str, contacts: list) -> dict:
        return self._send(self._wrap_message(to, 'contacts', {'contacts': contacts}))

    # ── Messaging — interactive ───────────────────────────────────────────────
    def send_interactive_list(
        self,
        to: str,
        body: str,
        button: str,
        sections: list,
        header: Optional[str] = None,
        footer: Optional[str] = None,
    ) -> dict:
        action = {'button': button, 'sections': sections}
        interactive = {'type': 'list', 'body': {'text': body}, 'action': action}
        if header:
            interactive['header'] = {'type': 'text', 'text': header}
        if footer:
            interactive['footer'] = {'text': footer}
        return self._send(self._wrap_message(to, 'interactive', {'interactive': interactive}))

    def send_interactive_buttons(
        self,
        to: str,
        body: str,
        buttons: list,
        header: Optional[str] = None,
        footer: Optional[str] = None,
    ) -> dict:
        # buttons: [{id, title}]
        button_objs = [{'type': 'reply', 'reply': {'id': b['id'], 'title': b['title']}} for b in buttons]
        interactive = {
            'type': 'button',
            'body': {'text': body},
            'action': {'buttons': button_objs},
        }
        if header:
            interactive['header'] = {'type': 'text', 'text': header}
        if footer:
            interactive['footer'] = {'text': footer}
        return self._send(self._wrap_message(to, 'interactive', {'interactive': interactive}))

    def send_catalog_single(self, to: str, body: str, product_retailer_id: str, footer: Optional[str] = None) -> dict:
        interactive = {
            'type': 'product',
            'body': {'text': body},
            'action': {'catalog_id': '', 'product_retailer_id': product_retailer_id},
        }
        if footer:
            interactive['footer'] = {'text': footer}
        return self._send(self._wrap_message(to, 'interactive', {'interactive': interactive}))

    def send_catalog_multi(self, to: str, header: str, body: str, footer: str, sections: list) -> dict:
        interactive = {
            'type': 'product_list',
            'header': {'type': 'text', 'text': header},
            'body': {'text': body},
            'footer': {'text': footer},
            'action': {'catalog_id': '', 'sections': sections},
        }
        return self._send(self._wrap_message(to, 'interactive', {'interactive': interactive}))

    def send_location_request(self, to: str, body: str) -> dict:
        interactive = {
            'type': 'location_request_message',
            'body': {'text': body},
            'action': {'name': 'send_location'},
        }
        return self._send(self._wrap_message(to, 'interactive', {'interactive': interactive}))

    # ── Messaging — templates ─────────────────────────────────────────────────
    def _template_payload(self, name: str, language: str, components: Optional[list] = None) -> dict:
        tpl = {'name': name, 'language': {'code': language}}
        if components:
            tpl['components'] = components
        return tpl

    def send_text_template(self, to: str, name: str, language: str, components: Optional[list] = None) -> dict:
        return self._send(self._wrap_message(to, 'template', {
            'template': self._template_payload(name, language, components),
        }))

    def send_media_template(
        self,
        to: str,
        name: str,
        language: str,
        header_type: str,           # image | video | document
        header_value: dict,         # {'link': ...} or {'id': ...}
        body_params: Optional[list] = None,
        button_params: Optional[list] = None,
    ) -> dict:
        components = [{
            'type': 'header',
            'parameters': [{'type': header_type, header_type: header_value}],
        }]
        if body_params:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': str(p)} for p in body_params],
            })
        if button_params:
            for i, bp in enumerate(button_params):
                components.append({
                    'type': 'button',
                    'sub_type': bp.get('sub_type', 'url'),
                    'index': str(i),
                    'parameters': bp.get('parameters', []),
                })
        return self._send(self._wrap_message(to, 'template', {
            'template': self._template_payload(name, language, components),
        }))

    def send_cta_url_template(
        self,
        to: str,
        name: str,
        language: str,
        body_params: list,
        url_button_param: str,
    ) -> dict:
        components = []
        if body_params:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': str(p)} for p in body_params],
            })
        components.append({
            'type': 'button',
            'sub_type': 'url',
            'index': '0',
            'parameters': [{'type': 'text', 'text': url_button_param}],
        })
        return self._send(self._wrap_message(to, 'template', {
            'template': self._template_payload(name, language, components),
        }))

    def send_quick_reply_template(
        self,
        to: str,
        name: str,
        language: str,
        body_params: list,
        button_payloads: list,
    ) -> dict:
        components = []
        if body_params:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': str(p)} for p in body_params],
            })
        for i, payload in enumerate(button_payloads):
            components.append({
                'type': 'button',
                'sub_type': 'quick_reply',
                'index': str(i),
                'parameters': [{'type': 'payload', 'payload': payload}],
            })
        return self._send(self._wrap_message(to, 'template', {
            'template': self._template_payload(name, language, components),
        }))

    def send_carousel_template(
        self,
        to: str,
        name: str,
        language: str,
        body_params: list,
        cards: list,
    ) -> dict:
        components = []
        if body_params:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': str(p)} for p in body_params],
            })
        components.append({
            'type': 'carousel',
            'cards': cards,
        })
        return self._send(self._wrap_message(to, 'template', {
            'template': self._template_payload(name, language, components),
        }))

    def send_coupon_template(
        self,
        to: str,
        name: str,
        language: str,
        body_params: list,
        coupon_code: str,
    ) -> dict:
        components = []
        if body_params:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': str(p)} for p in body_params],
            })
        components.append({
            'type': 'button',
            'sub_type': 'copy_code',
            'index': '0',
            'parameters': [{'type': 'coupon_code', 'coupon_code': coupon_code}],
        })
        return self._send(self._wrap_message(to, 'template', {
            'template': self._template_payload(name, language, components),
        }))

    def send_lto_template(
        self,
        to: str,
        name: str,
        language: str,
        body_params: list,
        expiration_ms: int,
    ) -> dict:
        components = [{
            'type': 'limited_time_offer',
            'parameters': [{
                'type': 'limited_time_offer',
                'limited_time_offer': {'expiration_time_ms': expiration_ms},
            }],
        }]
        if body_params:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': str(p)} for p in body_params],
            })
        return self._send(self._wrap_message(to, 'template', {
            'template': self._template_payload(name, language, components),
        }))

    def send_mpm_template(
        self,
        to: str,
        name: str,
        language: str,
        header_params: list,
        body_params: list,
        sections: list,
    ) -> dict:
        components = []
        if header_params:
            components.append({
                'type': 'header',
                'parameters': [{'type': 'text', 'text': str(p)} for p in header_params],
            })
        if body_params:
            components.append({
                'type': 'body',
                'parameters': [{'type': 'text', 'text': str(p)} for p in body_params],
            })
        components.append({
            'type': 'button',
            'sub_type': 'mpm',
            'index': '0',
            'parameters': [{'type': 'action', 'action': {'sections': sections}}],
        })
        return self._send(self._wrap_message(to, 'template', {
            'template': self._template_payload(name, language, components),
        }))

    # ── Templates — manage ────────────────────────────────────────────────────
    def create_template(self, waba_id: Optional[str], payload: dict) -> dict:
        wid = self._waba_id(waba_id)
        return self._request('POST', f'/{wid}/message_templates', json=payload)

    def list_templates(self, waba_id: Optional[str] = None, limit: int = 100, after: Optional[str] = None) -> dict:
        wid = self._waba_id(waba_id)
        params = {'limit': limit}
        if after:
            params['after'] = after
        return self._request('GET', f'/{wid}/message_templates', params=params)

    def get_template(self, template_id: str) -> dict:
        return self._request('GET', f'/{template_id}')

    def edit_template(self, template_id: str, payload: dict) -> dict:
        return self._request('POST', f'/{template_id}', json=payload)

    def delete_template_by_name(self, waba_id: Optional[str], name: str) -> dict:
        wid = self._waba_id(waba_id)
        return self._request('DELETE', f'/{wid}/message_templates', params={'name': name})

    def delete_template_by_id(self, waba_id: Optional[str], name: str, hsm_id: str) -> dict:
        wid = self._waba_id(waba_id)
        return self._request('DELETE', f'/{wid}/message_templates', params={'name': name, 'hsm_id': hsm_id})

    def get_namespace(self, waba_id: Optional[str] = None) -> dict:
        wid = self._waba_id(waba_id)
        return self._request('GET', f'/{wid}', params={'fields': 'message_template_namespace'})

    def get_template_count(self, waba_id: Optional[str] = None) -> dict:
        wid = self._waba_id(waba_id)
        return self._request('GET', f'/{wid}', params={'fields': 'message_template_count'})

    # ── Media ─────────────────────────────────────────────────────────────────
    def upload_media(self, phone_number_id: Optional[str], file_path: str, mime_type: str) -> dict:
        pid = self._phone_id(phone_number_id)
        if not os.path.exists(file_path):
            raise PinbotValidationError(f'File not found: {file_path}')
        with open(file_path, 'rb') as fh:
            files = {
                'file':              (os.path.basename(file_path), fh, mime_type),
                'type':              (None, mime_type),
                'messaging_product': (None, 'whatsapp'),
            }
            return self._request('POST', f'/{pid}/media', files=files)

    def get_media_url(self, media_id: str) -> dict:
        return self._request('GET', f'/{media_id}')

    def download_media(self, media_id: str) -> bytes:
        info = self.get_media_url(media_id)
        url = info.get('url') if isinstance(info, dict) else None
        if not url:
            raise PinbotAPIError('No url returned for media', response=info)
        resp = requests.get(url, headers={'apikey': self.api_key}, timeout=(10, 60))
        if resp.status_code >= 300:
            raise PinbotAPIError(f'Failed to download media ({resp.status_code})', status_code=resp.status_code)
        return resp.content

    def delete_media(self, media_id: str) -> dict:
        return self._request('DELETE', f'/{media_id}')

    def create_resumable_session(self, file_size: int, file_type: str, file_name: str) -> dict:
        return self._request('POST', '/uploads', params={
            'file_length': file_size,
            'file_type':   file_type,
            'file_name':   file_name,
        })

    def start_resumable_upload(self, session_id: str, file_data: bytes) -> dict:
        url = f"{self.base_url}/{session_id}"
        headers = {
            'apikey':         self.api_key,
            'file_offset':    '0',
            'Content-Type':   'application/octet-stream',
        }
        resp = requests.post(url, headers=headers, data=file_data, timeout=(10, 120))
        return self._handle_response(resp, 'POST', f'/{session_id}')

    # ── Account ───────────────────────────────────────────────────────────────
    def get_user_details(self) -> dict:
        return self._request('GET', '/getuserdetails')

    def fetch_waba_info(self, waba_id: Optional[str] = None) -> dict:
        wid = self._waba_id(waba_id)
        return self._request('GET', f'/{wid}')

    def mark_message_read(self, phone_number_id: Optional[str], message_id: str) -> dict:
        pid = self._phone_id(phone_number_id)
        return self._request('POST', f'/{pid}/messages', json={
            'messaging_product': 'whatsapp',
            'status':            'read',
            'message_id':        message_id,
        })


# ── Factory ───────────────────────────────────────────────────────────────────
def get_pinbot_for_client(client_id: int) -> PinbotService:
    """
    Return a configured PinbotService instance for the given client.

    Raises WhatsAppAccount.DoesNotExist if the client has no WhatsApp account.
    """
    from .models import WhatsAppAccount
    account = WhatsAppAccount.objects.get(client_id=client_id)
    api_key = account.api_key  # decrypted via Fernet
    if not api_key:
        raise PinbotAuthError(f'No api_key configured for client {client_id}')
    return PinbotService(
        api_key=api_key,
        phone_number_id=account.phone_number_id,
        waba_id=account.waba_id,
    )
