# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Trigger matcher — given an inbound message, find a BotFlow to start.

Priority order (highest first):
    1. CTWA referral (`message_payload.referral.source_type == 'ad'`)
    2. WhatsApp link referral codes
    3. Button reply matching a flow's button_payloads
    4. Keyword (exact / contains / regex) on the text body
    5. First message ever from this contact

Returns (flow, trigger_metadata) or (None, {}).
"""
from __future__ import annotations

import re

from ..models import BotConversation, BotFlow, CTWACampaign


def _text(payload: dict) -> str:
    text = ((payload.get('text') or {}).get('body') or '').strip()
    return text


def _try_ctwa(client_id: int, payload: dict) -> tuple[BotFlow | None, dict]:
    referral = payload.get('referral') or {}
    if not referral or referral.get('source_type') != 'ad':
        return (None, {})
    ad_id = referral.get('source_id') or ''
    if not ad_id:
        return (None, {})
    flows = BotFlow.objects.filter(
        client_id=client_id, is_active=True, trigger_type='ctwa_ad',
    )
    for flow in flows:
        cfg = flow.trigger_config or {}
        if ad_id in (cfg.get('ad_ids') or []):
            meta = {
                'ad_id':       ad_id,
                'ad_name':     referral.get('headline', ''),
                'campaign_id': cfg.get('campaign_id', '') or (cfg.get('campaign_ids') or [''])[0],
                'source_url':  referral.get('source_url', ''),
                'ctwa_clid':   referral.get('ctwa_clid', '') or payload.get('ctwa_clid', ''),
                'headline':    referral.get('headline', ''),
                'body':        referral.get('body', ''),
            }
            # Tie the conversation to the CTWA campaign that owns this ad, so
            # its conversation / lead counters and cost-per-lead are right.
            campaign = next((c for c in CTWACampaign.objects.filter(
                client_id=client_id, flow=flow, is_active=True,
            ) if ad_id in [str(a) for a in (c.ad_ids or [])]), None)
            if campaign:
                meta.update({
                    'ctwa_campaign_id': campaign.id,
                    'campaign_id':      campaign.campaign_id,
                    'campaign_name':    campaign.campaign_name or campaign.name,
                })
            return (flow, meta)
    return (None, {})


def _try_referral_link(client_id: int, payload: dict) -> tuple[BotFlow | None, dict]:
    referral = payload.get('referral') or {}
    code = referral.get('source_id') or referral.get('referral_code') or ''
    if not code:
        return (None, {})
    flows = BotFlow.objects.filter(
        client_id=client_id, is_active=True, trigger_type='referral_link',
    )
    for flow in flows:
        codes = (flow.trigger_config or {}).get('referral_codes') or []
        if code in codes:
            return (flow, {'referral_code': code})
    return (None, {})


def _try_button(client_id: int, payload: dict) -> tuple[BotFlow | None, dict]:
    interactive = payload.get('interactive') or {}
    button_id = (interactive.get('button_reply') or {}).get('id') \
                or (interactive.get('list_reply') or {}).get('id')
    if not button_id:
        return (None, {})
    flows = BotFlow.objects.filter(
        client_id=client_id, is_active=True, trigger_type='button_reply',
    )
    for flow in flows:
        payloads = (flow.trigger_config or {}).get('button_payloads') or []
        if button_id in payloads:
            return (flow, {'button_id': button_id})
    return (None, {})


def _try_keyword(client_id: int, payload: dict) -> tuple[BotFlow | None, dict]:
    text = _text(payload)
    if not text:
        return (None, {})
    flows = BotFlow.objects.filter(
        client_id=client_id, is_active=True, trigger_type='keyword',
    )
    for flow in flows:
        cfg = flow.trigger_config or {}
        keywords = cfg.get('keywords') or []
        match_type = (cfg.get('match_type') or 'contains').lower()
        case_sensitive = bool(cfg.get('case_sensitive', False))

        haystack = text if case_sensitive else text.lower()
        words = keywords if case_sensitive else [k.lower() for k in keywords]

        if match_type == 'exact':
            if haystack in words:
                return (flow, {'matched_keyword': haystack, 'match_type': match_type})
        elif match_type == 'contains':
            for k in words:
                if k and k in haystack:
                    return (flow, {'matched_keyword': k, 'match_type': match_type})
        elif match_type == 'regex':
            for pattern in words:
                try:
                    if re.search(pattern, haystack):
                        return (flow, {'matched_keyword': pattern, 'match_type': match_type})
                except re.error:
                    continue
    return (None, {})


def _try_first_message(client_id: int, contact_id: int) -> tuple[BotFlow | None, dict]:
    # A conversation that only recorded an out-of-hours notice doesn't count:
    # the contact still gets the first-message flow when the business is open.
    is_first = not BotConversation.objects.filter(
        client_id=client_id, contact_id=contact_id,
    ).exclude(trigger_metadata__has_key='out_of_hours').exists()   # has_key: a missing key must not exclude the row
    if not is_first:
        return (None, {})
    flow = BotFlow.objects.filter(
        client_id=client_id, is_active=True, trigger_type='first_message',
    ).first()
    if flow:
        return (flow, {'reason': 'first_message_ever'})
    return (None, {})


def match_entry_trigger(client_id: int, payload: dict) -> tuple[BotFlow | None, str, dict]:
    """CTWA ad click or referral link only — the explicit "start this flow"
    signals that may replace a conversation that is already running."""
    flow, meta = _try_ctwa(client_id, payload)
    if flow:
        return (flow, 'ctwa_ad', meta)
    flow, meta = _try_referral_link(client_id, payload)
    if flow:
        return (flow, 'referral_link', meta)
    return (None, '', {})


def match_trigger(client_id: int, contact_id: int, payload: dict) -> tuple[BotFlow | None, str, dict]:
    """Return (flow, triggered_via, trigger_metadata). flow is None when nothing matches."""
    flow, meta = _try_ctwa(client_id, payload)
    if flow:
        return (flow, 'ctwa_ad', meta)

    flow, meta = _try_referral_link(client_id, payload)
    if flow:
        return (flow, 'referral_link', meta)

    flow, meta = _try_button(client_id, payload)
    if flow:
        return (flow, 'button_reply', meta)

    flow, meta = _try_keyword(client_id, payload)
    if flow:
        return (flow, 'keyword', meta)

    flow, meta = _try_first_message(client_id, contact_id)
    if flow:
        return (flow, 'first_message', meta)

    return (None, '', {})
