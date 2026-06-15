# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Meta Conversions API (CAPI) push.

When a CTWA lead is captured we POST a Lead event back to Meta so the ad
can optimize on real conversions, not just clicks. The pixel is opt-in: a
client must set `meta_pixel_id` on their `Client` row (or pass it on the
CTWACampaign — that overrides). Without a pixel, this module is a no-op.

We use the Conversions API for `event_source_url` = 'whatsapp' events.
The user-level identifiers we hash & send:
  • em (email)        — sha256
  • ph (phone)        — sha256, E.164 stripped of '+'
  • client_ip_address — only if we have it on the conversation
  • ctwa_clid         — Meta's "click ID" handed to us in the CTWA referral
                        payload. This is the strongest attribution signal.

Failures are logged and never raise — CAPI must not block lead capture.
"""
from __future__ import annotations

import hashlib
import logging
import re
import time

import requests
from django.utils import timezone

logger = logging.getLogger(__name__)


GRAPH_BASE = 'https://graph.facebook.com/v21.0'


def _sha256(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode('utf-8')).hexdigest()


def _normalize_phone(phone: str) -> str:
    """E.164 minus the leading '+'. Strip everything that isn't a digit."""
    digits = re.sub(r'\D+', '', phone or '')
    return digits


def _resolve_pixel_and_token(lead) -> tuple[str | None, str | None, str | None]:
    """Return (pixel_id, access_token, capi_test_event_code) or (None, …, …)."""
    client = lead.client
    pixel_id = (getattr(client, 'meta_pixel_id', '') or '').strip()
    if not pixel_id:
        return (None, None, None)

    from .models import PlatformCredential
    cred = (
        PlatformCredential.objects.filter(
            client=client, platform='facebook', is_active=True,
        ).first()
    )
    if not cred or not cred.access_token:
        return (None, None, None)

    return (pixel_id, cred.access_token, getattr(client, 'meta_capi_test_code', '') or None)


def push_lead_event(lead) -> dict:
    """Fire a 'Lead' event to Meta for the given Lead. Returns a small status
    dict. Errors are logged; this never raises.
    """
    pixel_id, token, test_code = _resolve_pixel_and_token(lead)
    if not pixel_id or not token:
        return {'sent': False, 'reason': 'no pixel or facebook credential'}

    user_data: dict = {}
    if lead.email:
        user_data['em'] = [_sha256(lead.email)]
    if lead.phone:
        digits = _normalize_phone(lead.phone)
        if digits:
            user_data['ph'] = [_sha256(digits)]
    # Pull ctwa_clid + ip from the source conversation's trigger metadata
    conv = lead.source_conversation
    if conv:
        tm = conv.trigger_metadata or {}
        if tm.get('ctwa_clid'):
            # Per Meta's spec, ctwa_clid is sent as a top-level user_data field
            user_data['ctwa_clid'] = tm['ctwa_clid']
        if tm.get('client_ip_address'):
            user_data['client_ip_address'] = tm['client_ip_address']
        if tm.get('client_user_agent'):
            user_data['client_user_agent'] = tm['client_user_agent']

    if not user_data:
        # Without any identifier, the event can't be matched. Skip.
        return {'sent': False, 'reason': 'no user identifiers available'}

    custom_data: dict = {}
    if lead.conversion_value:
        custom_data['value']    = float(lead.conversion_value)
        custom_data['currency'] = 'INR'
    if lead.source_campaign_name:
        custom_data['content_name'] = lead.source_campaign_name

    event = {
        'event_name':       'Lead',
        'event_time':       int(time.time()),
        'event_id':         f'lead-{lead.id}',  # idempotency key — Meta dedupes
        'event_source_url': 'https://wa.me/',
        'action_source':    'business_messaging',
        'user_data':        user_data,
    }
    if custom_data:
        event['custom_data'] = custom_data

    payload = {'data': [event]}
    if test_code:
        payload['test_event_code'] = test_code

    url = f'{GRAPH_BASE}/{pixel_id}/events'
    try:
        r = requests.post(url, params={'access_token': token}, json=payload, timeout=6)
        body = r.json() if r.content else {}
    except Exception as e:  # noqa: BLE001
        logger.warning('CAPI push failed for lead#%s: %s', lead.id, e)
        return {'sent': False, 'reason': f'request failed: {e}'}

    if r.status_code >= 400:
        logger.warning('CAPI push %s for lead#%s — body: %s',
                       r.status_code, lead.id, body)
        return {'sent': False, 'reason': f'http {r.status_code}',
                'response': body}

    # Stamp success on the Lead so we can audit later
    try:
        lead.capi_pushed_at = timezone.now()
        lead.save(update_fields=['capi_pushed_at'])
    except Exception:
        pass

    return {
        'sent':            True,
        'events_received': body.get('events_received'),
        'fbtrace_id':      body.get('fbtrace_id'),
    }
