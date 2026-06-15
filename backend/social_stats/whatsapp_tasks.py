# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Celery tasks for the WhatsApp / Pinbot integration.

Mirrors the style of `social_stats/tasks.py`:
    @shared_task(bind=True, max_retries=3, default_retry_delay=60)
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger(__name__)


# ── Send a single message ─────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_whatsapp_message(self, message_id):
    """Send one WhatsAppMessage row through Pinbot."""
    from .models import WhatsAppMessage, WhatsAppCampaign
    from .whatsapp_service import (
        get_pinbot_for_client, PinbotError, PinbotRateLimitError, PinbotAPIError,
    )

    try:
        msg = WhatsAppMessage.objects.select_related('contact', 'campaign', 'client').get(id=message_id)
    except WhatsAppMessage.DoesNotExist:
        logger.warning('send_whatsapp_message: message %s not found', message_id)
        return

    # Skip if already sent / terminal
    if msg.status in ('sent', 'delivered', 'read', 'failed'):
        return

    try:
        svc = get_pinbot_for_client(msg.client_id)
    except Exception as e:
        logger.exception('send_whatsapp_message: cannot get Pinbot service for client %s', msg.client_id)
        msg.status = 'failed'
        msg.error_message = str(e)
        msg.save(update_fields=['status', 'error_message'])
        _bump_campaign_failed(msg.campaign_id)
        return

    payload = msg.payload or {}
    msg_type = payload.get('type') or msg.message_type or 'text'
    to = msg.contact.phone

    try:
        if msg_type == 'template':
            tpl = payload.get('template', {})
            response = svc.send_text_template(
                to=to,
                name=tpl.get('name'),
                language=tpl.get('language', 'en_US'),
                components=tpl.get('components'),
            )
        elif msg_type == 'text':
            response = svc.send_text(to, payload.get('body', ''), preview_url=payload.get('preview_url', False))
        elif msg_type == 'image':
            response = svc.send_image(to, link=payload.get('link'), media_id=payload.get('media_id'),
                                      caption=payload.get('caption'))
        elif msg_type == 'video':
            response = svc.send_video(to, link=payload.get('link'), media_id=payload.get('media_id'),
                                      caption=payload.get('caption'))
        elif msg_type == 'document':
            response = svc.send_document(to, link=payload.get('link'), media_id=payload.get('media_id'),
                                         filename=payload.get('filename'), caption=payload.get('caption'))
        else:
            response = svc.send_text(to, payload.get('body', ''))

        # Extract pinbot message id from response (Cloud API style)
        wa_id = ''
        if isinstance(response, dict):
            messages = response.get('messages') or []
            if messages and isinstance(messages, list):
                wa_id = messages[0].get('id', '')

        msg.pinbot_message_id = wa_id
        msg.status = 'sent'
        msg.sent_at = timezone.now()
        msg.error_code = ''
        msg.error_message = ''
        msg.save(update_fields=['pinbot_message_id', 'status', 'sent_at', 'error_code', 'error_message'])

        _bump_campaign_sent(msg.campaign_id)
        # Update contact.last_message_at
        msg.contact.last_message_at = timezone.now()
        msg.contact.save(update_fields=['last_message_at'])

    except (PinbotRateLimitError, PinbotAPIError) as e:
        # Transient — retry
        logger.warning('Transient Pinbot error sending message %s: %s', message_id, e)
        try:
            raise self.retry(exc=e)
        except self.MaxRetriesExceededError:
            msg.status = 'failed'
            msg.error_code = str(getattr(e, 'status_code', '')) or 'transient'
            msg.error_message = str(e)[:500]
            msg.save(update_fields=['status', 'error_code', 'error_message'])
            _bump_campaign_failed(msg.campaign_id)

    except PinbotError as e:
        msg.status = 'failed'
        msg.error_code = str(getattr(e, 'status_code', '')) or 'error'
        msg.error_message = str(e)[:500]
        msg.save(update_fields=['status', 'error_code', 'error_message'])
        _bump_campaign_failed(msg.campaign_id)


def _bump_campaign_sent(campaign_id):
    if not campaign_id:
        return
    from .models import WhatsAppCampaign
    WhatsAppCampaign.objects.filter(id=campaign_id).update(sent_count=F('sent_count') + 1)


def _bump_campaign_failed(campaign_id):
    if not campaign_id:
        return
    from .models import WhatsAppCampaign
    WhatsAppCampaign.objects.filter(id=campaign_id).update(failed_count=F('failed_count') + 1)


# ── Run a campaign (dispatches one job per contact) ───────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def run_whatsapp_campaign(self, campaign_id):
    """Materialize messages for a campaign and queue them for sending."""
    from .models import WhatsAppCampaign, WhatsAppMessage, WhatsAppContact

    try:
        campaign = WhatsAppCampaign.objects.select_related('template', 'contact_list').get(id=campaign_id)
    except WhatsAppCampaign.DoesNotExist:
        logger.warning('run_whatsapp_campaign: campaign %s not found', campaign_id)
        return

    if campaign.status not in ('scheduled', 'draft'):
        logger.info('run_whatsapp_campaign: campaign %s in status %s — skipping',
                    campaign_id, campaign.status)
        return

    template = campaign.template
    if template.status != 'approved':
        campaign.status = 'failed'
        campaign.completed_at = timezone.now()
        campaign.save(update_fields=['status', 'completed_at'])
        logger.warning('run_whatsapp_campaign: template %s not approved', template.id)
        return

    contacts = campaign.contact_list.contacts.filter(opt_in_status='opted_in')
    total = contacts.count()
    if total == 0:
        campaign.status = 'failed'
        campaign.completed_at = timezone.now()
        campaign.save(update_fields=['status', 'completed_at'])
        return

    campaign.status = 'running'
    campaign.started_at = timezone.now()
    campaign.total_count = total
    campaign.save(update_fields=['status', 'started_at', 'total_count'])

    # Build payload per contact (template message).
    msgs_to_create = []
    for contact in contacts.iterator(chunk_size=500):
        components = _build_template_components(template, campaign.template_variables, contact)
        payload = {
            'type': 'template',
            'template': {
                'name':       template.name,
                'language':   template.language,
                'components': components,
            },
        }
        msgs_to_create.append(WhatsAppMessage(
            client_id=campaign.client_id,
            campaign=campaign,
            contact=contact,
            direction='outbound',
            message_type='template',
            payload=payload,
            status='queued',
        ))

    created = WhatsAppMessage.objects.bulk_create(msgs_to_create, batch_size=500)

    # Stagger sends to respect WHATSAPP_RATE_LIMIT_PER_SEC
    from django.conf import settings as dj_settings
    rate_per_sec = max(int(getattr(dj_settings, 'WHATSAPP_RATE_LIMIT_PER_SEC', 20)), 1)
    spacing = 1.0 / rate_per_sec
    for i, msg in enumerate(created):
        send_whatsapp_message.apply_async(args=[msg.id], countdown=i * spacing)


def _build_template_components(template, variables_map, contact):
    """
    Translate the template's variable mapping into Cloud-API `components`.
    `variables_map` example:
        {'1': 'static value', '2': '{{contact.name}}'}
    """
    if not variables_map:
        return None

    body_params = []
    # Sort by integer position so params are ordered correctly
    for pos in sorted(variables_map.keys(), key=lambda k: int(str(k).strip('{}'))):
        raw = variables_map[pos]
        body_params.append({'type': 'text', 'text': str(_resolve_variable(raw, contact))})

    if not body_params:
        return None
    return [{'type': 'body', 'parameters': body_params}]


def _resolve_variable(raw, contact):
    """Replace '{{contact.name}}' style placeholders with contact field values."""
    if not isinstance(raw, str):
        return raw
    if raw == '{{contact.name}}':
        return contact.name or ''
    if raw == '{{contact.phone}}':
        return contact.phone or ''
    if raw == '{{contact.email}}':
        return contact.email or ''
    if raw.startswith('{{contact.custom.') and raw.endswith('}}'):
        key = raw[len('{{contact.custom.'):-2]
        return (contact.custom_fields or {}).get(key, '')
    return raw


# ── Webhook processor ─────────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_whatsapp_webhook(self, log_id):
    """Process a queued WhatsAppWebhookLog row idempotently."""
    from .models import WhatsAppWebhookLog, WhatsAppMessage, WhatsAppContact, WhatsAppCampaign

    try:
        log = WhatsAppWebhookLog.objects.get(id=log_id)
    except WhatsAppWebhookLog.DoesNotExist:
        return

    if log.processed:
        return

    payload = log.payload or {}
    try:
        # Standard Cloud-API webhook shape: entry → changes → value → {statuses, messages, contacts}
        for entry in payload.get('entry', []) or []:
            for change in entry.get('changes', []) or []:
                value = change.get('value', {}) or {}
                _process_status_updates(value)
                _process_inbound_messages(value)
        log.processed = True
        log.error = ''
        log.save(update_fields=['processed', 'error'])
    except Exception as e:
        logger.exception('process_whatsapp_webhook failed for log %s', log_id)
        log.error = str(e)[:1000]
        log.save(update_fields=['error'])
        try:
            raise self.retry(exc=e)
        except self.MaxRetriesExceededError:
            return


def _process_status_updates(value):
    from .models import WhatsAppMessage, WhatsAppCampaign

    statuses = value.get('statuses') or []
    for st in statuses:
        wa_id = st.get('id')
        new_status = st.get('status')  # sent, delivered, read, failed
        if not wa_id or not new_status:
            continue

        ts = _parse_ts(st.get('timestamp'))

        with transaction.atomic():
            msg = (WhatsAppMessage.objects
                   .select_for_update()
                   .filter(pinbot_message_id=wa_id)
                   .first())
            if not msg:
                continue

            update_fields = []
            # Don't go backwards on terminal/ordered statuses
            order = {'queued': 0, 'sent': 1, 'delivered': 2, 'read': 3, 'failed': 99}
            if order.get(new_status, 0) > order.get(msg.status, 0):
                msg.status = new_status
                update_fields.append('status')

            if new_status == 'delivered' and not msg.delivered_at:
                msg.delivered_at = ts
                update_fields.append('delivered_at')
            elif new_status == 'read' and not msg.read_at:
                msg.read_at = ts
                update_fields.append('read_at')
            elif new_status == 'failed':
                err = st.get('errors') or []
                if err and isinstance(err, list):
                    msg.error_code = str(err[0].get('code', ''))[:50]
                    msg.error_message = str(err[0].get('title') or err[0].get('message') or '')[:500]
                    update_fields += ['error_code', 'error_message']

            if update_fields:
                msg.save(update_fields=update_fields)
                _bump_campaign_counter(msg.campaign_id, new_status)


def _process_inbound_messages(value):
    from .models import WhatsAppMessage, WhatsAppContact, Client

    messages = value.get('messages') or []
    if not messages:
        return

    metadata = value.get('metadata') or {}
    phone_number_id = metadata.get('phone_number_id')

    # Resolve client by phone_number_id
    client = None
    if phone_number_id:
        from .models import WhatsAppAccount
        acct = WhatsAppAccount.objects.filter(phone_number_id=phone_number_id).first()
        if acct:
            client = acct.client

    if not client:
        logger.warning('Inbound message but no matching WhatsAppAccount for phone_number_id=%s', phone_number_id)
        return

    contacts_meta = {c.get('wa_id'): c for c in (value.get('contacts') or [])}

    for m in messages:
        from_phone = m.get('from') or ''
        if not from_phone:
            continue

        contact, _ = WhatsAppContact.objects.get_or_create(
            client=client,
            phone=from_phone,
            defaults={
                'name': (contacts_meta.get(from_phone, {}).get('profile') or {}).get('name', ''),
            },
        )
        contact.last_inbound_at = timezone.now()
        contact.save(update_fields=['last_inbound_at'])

        WhatsAppMessage.objects.create(
            client=client,
            contact=contact,
            campaign=None,
            pinbot_message_id=m.get('id', ''),
            direction='inbound',
            message_type=m.get('type', 'text'),
            payload=m,
            status='delivered',
            delivered_at=timezone.now(),
        )

        try:
            from .security.wa_opt_out import was_opt_out_message, apply_opt_out
            inbound_text = (m.get('text') or {}).get('body') or ''
            matched, kw = was_opt_out_message(inbound_text)
            if matched:
                apply_opt_out(contact, keyword=kw)
                continue   # don't dispatch to bot — request was honoured
        except Exception:
            logger.exception('opt-out detection crashed for client=%s contact=%s',
                             client.id, contact.id)

        try:
            from .bot_engine import process_incoming_message
            process_incoming_message(client.id, contact.id, m)
        except Exception:
            logger.exception('bot_engine: process_incoming_message crashed for client=%s contact=%s', client.id, contact.id)


def _bump_campaign_counter(campaign_id, status):
    if not campaign_id:
        return
    from .models import WhatsAppCampaign
    field_map = {
        'delivered': 'delivered_count',
        'read':      'read_count',
        'failed':    'failed_count',
    }
    field = field_map.get(status)
    if field:
        WhatsAppCampaign.objects.filter(id=campaign_id).update(**{field: F(field) + 1})


def _parse_ts(value):
    """Pinbot/Meta send unix-second timestamps as strings."""
    if not value:
        return timezone.now()
    try:
        from datetime import datetime, timezone as dt_tz
        return datetime.fromtimestamp(int(value), tz=dt_tz.utc)
    except (TypeError, ValueError):
        return timezone.now()


# ── Account/template sync ─────────────────────────────────────────────────────
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_whatsapp_templates(self, client_id):
    """Pull templates from Pinbot and upsert into WhatsAppTemplate."""
    from .models import WhatsAppTemplate
    from .whatsapp_service import get_pinbot_for_client, PinbotError

    try:
        svc = get_pinbot_for_client(client_id)
    except Exception as e:
        logger.warning('sync_whatsapp_templates: %s', e)
        return

    try:
        result = svc.list_templates(limit=200)
    except PinbotError as e:
        logger.warning('sync_whatsapp_templates failed for client %s: %s', client_id, e)
        try:
            raise self.retry(exc=e)
        except self.MaxRetriesExceededError:
            return

    items = result.get('data', []) if isinstance(result, dict) else []
    for it in items:
        name = it.get('name')
        if not name:
            continue
        defaults = {
            'category':           (it.get('category') or 'marketing').lower(),
            'status':             (it.get('status') or 'pending').lower(),
            'pinbot_template_id': it.get('id', ''),
            'rejection_reason':   it.get('rejected_reason', '') or '',
            'body':               _extract_template_body(it.get('components', [])),
        }
        WhatsAppTemplate.objects.update_or_create(
            client_id=client_id,
            name=name,
            language=it.get('language', 'en_US'),
            defaults=defaults,
        )


def _extract_template_body(components):
    for c in components or []:
        if c.get('type', '').upper() == 'BODY':
            return c.get('text', '')
    return ''


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def sync_account_status(self, client_id):
    """Refresh quality_rating + messaging_tier on the WhatsAppAccount."""
    from .models import WhatsAppAccount
    from .whatsapp_service import get_pinbot_for_client, PinbotError

    try:
        account = WhatsAppAccount.objects.get(client_id=client_id)
        svc = get_pinbot_for_client(client_id)
    except Exception as e:
        logger.warning('sync_account_status: %s', e)
        return

    try:
        info = svc.fetch_waba_info()
    except PinbotError as e:
        logger.warning('sync_account_status failed for client %s: %s', client_id, e)
        try:
            raise self.retry(exc=e)
        except self.MaxRetriesExceededError:
            return

    if isinstance(info, dict):
        quality = (info.get('quality_rating') or info.get('quality') or 'UNKNOWN').upper()
        if quality not in ('GREEN', 'YELLOW', 'RED', 'UNKNOWN'):
            quality = 'UNKNOWN'
        tier_raw = (info.get('messaging_limit_tier') or info.get('messaging_tier') or 'TIER_1K').upper()
        # Normalize Meta-style tiers to our choices
        tier_map = {
            'TIER_1K': 'TIER_1K', 'TIER_10K': 'TIER_10K', 'TIER_100K': 'TIER_100K',
            'TIER_UNLIMITED': 'TIER_UNLIMITED',
            'UNLIMITED': 'TIER_UNLIMITED',
        }
        tier = tier_map.get(tier_raw, 'TIER_1K')

        account.quality_rating = quality
        account.messaging_tier = tier
        account.last_synced_at = timezone.now()
        account.save(update_fields=['quality_rating', 'messaging_tier', 'last_synced_at'])


# ── Campaign completion sweeper (runs every 5 min via Celery beat) ────────────
@shared_task(bind=True)
def check_campaign_completion(self):
    """Mark running campaigns as completed when all messages reach a terminal state."""
    from .models import WhatsAppCampaign, WhatsAppMessage

    running = WhatsAppCampaign.objects.filter(status='running')
    for campaign in running.iterator():
        # If no non-terminal messages remain, mark complete
        non_terminal = WhatsAppMessage.objects.filter(
            campaign=campaign,
            status__in=('queued', 'sent'),
        ).exists()
        if not non_terminal:
            campaign.status = 'completed'
            campaign.completed_at = timezone.now()
            campaign.save(update_fields=['status', 'completed_at'])
