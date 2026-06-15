# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Action handlers — capture_lead (the only action shipping in)."""
from __future__ import annotations

from django.db.models import F

from ...models import Lead


# Standard fields lifted from variables when present. Anything else dumps
# into Lead.custom_fields so a flow-author can collect arbitrary data.
_STANDARD_FIELDS = ('name', 'email', 'phone', 'interest', 'budget', 'location')


def handle_capture_lead(executor, node):
    """Materialize a Lead row from the conversation's collected variables.

    `node.data` may include:
        field_map: {lead_field: variable_name}    — explicit mapping override
        tags:      ['hot', 'real_estate']         — extra tags to apply
    """
    data = node.get('data') or {}
    field_map = data.get('field_map') or {}
    tags = list(data.get('tags') or [])

    variables = dict(executor.variables or {})
    contact = executor.contact
    flow = executor.flow
    conv = executor.conversation

    # Resolve the canonical fields (explicit mapping wins; otherwise key by name)
    def _pick(key: str, fallback: str = ''):
        var_name = field_map.get(key, key)
        return str(variables.get(var_name) or fallback)

    name     = _pick('name', contact.name)
    phone    = _pick('phone', contact.phone)
    email    = _pick('email', contact.email)
    interest = _pick('interest', '')
    budget   = _pick('budget', '')
    location = _pick('location', '')

    # Custom fields = everything in `variables` that's not engine-internal
    # and not already promoted to a standard column.
    promoted = {field_map.get(k, k) for k in _STANDARD_FIELDS}
    custom = {
        k: v for k, v in variables.items()
        if not k.startswith('_') and k not in promoted
    }

    # CTWA source tracking lifted from trigger_metadata
    tm = conv.trigger_metadata or {}

    lead = Lead.objects.create(
        client_id=executor.client.id,
        contact=contact,
        source_flow=flow,
        source_conversation=conv,
        name=name[:200],
        phone=phone[:30],
        email=email if '@' in email else '',
        interest=interest[:200],
        budget=budget[:100],
        location=location[:200],
        custom_fields=custom,
        source_ad_id=str(tm.get('ad_id') or '')[:100],
        source_ad_name=str(tm.get('ad_name') or '')[:200],
        source_campaign_id=str(tm.get('campaign_id') or '')[:100],
        source_campaign_name=str(tm.get('campaign_name') or '')[:200],
        source_adset_id=str(tm.get('adset_id') or '')[:100],
        tags=tags,
    )

    # Record on the conversation
    conv.lead = lead
    conv.lead_captured = True
    conv.save(update_fields=['lead', 'lead_captured'])

    # Bump flow + ctwa-campaign denormalised counters
    if flow:
        type(flow).objects.filter(pk=flow.pk).update(
            total_leads_captured=F('total_leads_captured') + 1,
        )
    if tm.get('ctwa_campaign_id'):
        from ...models import CTWACampaign
        CTWACampaign.objects.filter(pk=tm['ctwa_campaign_id']).update(
            total_leads=F('total_leads') + 1,
        )

    executor.log_step(node, direction='system', payload={
        'lead_id': lead.id,
        'standard_fields_set': sorted([k for k, v in {
            'name': name, 'email': email, 'phone': phone,
            'interest': interest, 'budget': budget, 'location': location,
        }.items() if v]),
        'custom_field_count': len(custom),
    })

    try:
        from ...meta_capi_tasks import push_capi_lead
        push_capi_lead.delay(lead.id)
    except Exception:
        # Never let CAPI break lead capture
        pass

    try:
        _notify_lead_captured(executor, lead)
    except Exception:
        pass

    try:
        from ...events.publisher import EventPublisher
        EventPublisher.publish(
            'lead.captured',
            client=lead.client,
            actor=None,  # bot capture has no human actor
            actor_type='system',
            payload={'lead_id': lead.id, 'source': 'bot'},
        )
    except Exception:
        pass

    return executor.advance_to_next(node['id'])


def _notify_lead_captured(executor, lead) -> None:
    """Fan a 'bot_lead_captured' event to the lead's assignee, falling back to
    the workspace owner. The dispatcher writes the in-app row + emails (when
    the user has email enabled for this event)."""
    from django.conf import settings
    from ...notification_dispatcher import dispatch as dispatch_notification

    recipient = lead.assigned_to
    if not recipient:
        owner = getattr(executor.client, 'owner_user', None)
        recipient = owner
    if not recipient:
        return

    frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    contact_label = lead.name or lead.phone or executor.contact.phone
    flow_name = executor.flow.name if executor.flow else 'a flow'

    dispatch_notification(
        recipient,
        event_type='bot_lead_captured',
        title=f'New lead: {contact_label}',
        body=(f'{flow_name} just captured a lead from '
              f'{lead.source_campaign_name or "an ad"}. '
              f'Quality score: {lead.quality_score}.'),
        data={
            'kind': 'bot_lead_captured',
            'lead_id': lead.id,
            'flow_id': executor.flow.id if executor.flow else None,
            'conversation_id': executor.conversation.id,
        },
        cta_url=f'{frontend}/admin/leads/{lead.id}',
        cta_label='Open lead',
        email_subject=f'[Social Stats] New lead: {contact_label}',
    )


# ─────────────────────────────────────────────────────────────────────────────
def handle_tag_contact(executor, node):
    """Add (or remove) tags on the WhatsAppContact.

    data: { tags: [...], remove: bool }
    Tags are interpolated through the renderer so {{interest}} works.
    """
    from ..templates import render
    data = node.get('data') or {}
    tags_in = data.get('tags') or []
    if isinstance(tags_in, str):
        tags_in = [tags_in]
    rendered = [render(str(t), executor.variables).strip() for t in tags_in if t]
    rendered = [t for t in rendered if t]

    contact = executor.contact
    current = list(contact.tags or [])
    if data.get('remove'):
        current = [t for t in current if t not in rendered]
    else:
        for t in rendered:
            if t not in current:
                current.append(t)
    contact.tags = current
    contact.save(update_fields=['tags'])

    executor.log_step(node, direction='system', payload={'tags_after': current, 'mode': 'remove' if data.get('remove') else 'add'})
    return executor.advance_to_next(node['id'])


def handle_send_email(executor, node):
    """Send a transactional email — typically used to notify the agency about a fresh lead."""
    from django.conf import settings
    from django.core.mail import send_mail
    from ..templates import render

    data = node.get('data') or {}
    to_raw = data.get('to') or ''
    if isinstance(to_raw, list):
        recipients = [render(str(t), executor.variables) for t in to_raw if t]
    else:
        recipients = [render(str(t), executor.variables).strip() for t in (to_raw or '').split(',') if t.strip()]
    recipients = [r for r in recipients if r and '@' in r]
    if not recipients:
        executor.log_step(node, direction='system', payload={'error': 'send_email no valid recipients'})
        return executor.advance_to_next(node['id'])

    subject = render(data.get('subject', 'New lead'), executor.variables)[:200]
    body    = render(data.get('body', ''), executor.variables)
    html    = render(data.get('html', ''), executor.variables) or None
    from_email = data.get('from_email') or getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@socialstats.app')

    try:
        send_mail(subject, body, from_email, recipients, html_message=html, fail_silently=True)
    except Exception as e:  # noqa: BLE001
        executor.log_step(node, direction='system', payload={'error': f'send_email failed: {e}'})
        return executor.advance_to_next(node['id'])

    executor.log_step(node, direction='system', payload={
        'recipients': recipients, 'subject': subject,
    })
    return executor.advance_to_next(node['id'])


def handle_webhook(executor, node):
    """POST conversation snapshot to an external URL — used for CRM push, Slack
    notifications, custom integrations.

    data: {
        url, method ('POST'|'GET'), headers: {...},
        body_template (rendered), include_variables: bool, timeout: 5,
    }

    the actual HTTP call runs in `bot_webhook_dispatch` (Celery
    task with exponential backoff retry). The flow advances on the
    `success` branch immediately — failure-branch routing is handled by
    the task itself when retries are exhausted, by appending a `_webhook_failed`
    step row that the audit page surfaces.
    """
    from ..templates import render

    data = node.get('data') or {}
    url = render(str(data.get('url') or ''), executor.variables).strip()
    if not url:
        executor.log_step(node, direction='system', payload={'error': 'webhook missing url'})
        return executor.advance_to_next(node['id'], branch='failure')

    from ...security.ssrf import check_url, UnsafeURLError
    try:
        check_url(url)
    except UnsafeURLError as e:
        executor.log_step(node, direction='system', payload={
            'error': f'webhook url blocked by SSRF policy: {e}', 'url': url,
        })
        return executor.advance_to_next(node['id'], branch='failure')

    method = (data.get('method') or 'POST').upper()
    headers = {'Content-Type': 'application/json', **(data.get('headers') or {})}
    timeout = int(data.get('timeout') or 5)

    body = {}
    if data.get('include_variables', True):
        body['variables'] = {k: v for k, v in (executor.variables or {}).items() if not k.startswith('_')}
    body['conversation_id'] = executor.conversation.id
    body['flow_id']         = executor.flow.id if executor.flow else None
    body['contact'] = {'phone': executor.contact.phone, 'name': executor.contact.name}
    if data.get('body_template'):
        body['custom_body'] = render(str(data['body_template']), executor.variables)

    # Hand off the actual delivery to Celery so the bot doesn't block on a slow
    # third-party endpoint and so we get retry-with-backoff for free.
    try:
        from ...bot_webhook_tasks import dispatch_webhook
        dispatch_webhook.delay(
            conversation_id=executor.conversation.id,
            node_id=node['id'],
            url=url, method=method,
            headers=headers, body=body, timeout=timeout,
        )
        executor.log_step(node, direction='system', payload={
            'url': url, 'method': method, 'queued': True,
        })
    except Exception as e:  # noqa: BLE001
        executor.log_step(node, direction='system', payload={
            'url': url, 'method': method, 'queued': False, 'error': str(e),
        })

    # Always take the `success` branch up-front — webhook results are async.
    # Flows that need to block on the response should use a wait_delay node.
    return executor.advance_to_next(node['id'], branch='success')
