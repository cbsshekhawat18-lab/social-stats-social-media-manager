# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Automation engine.

How it works:
  - Sync tasks call `dispatch_event(event_type, object_id, client_id)` whenever
    a new Message or UnifiedReview row is created.
  - That helper queues `evaluate_automation_rules.delay(...)` (the Celery task),
    which loads the originating object + iterates active AutomationRule rows
    for the client, matching trigger_type + trigger_filters against the event.
  - For each matching rule, the corresponding ACTION_HANDLER runs. All actions
    are wrapped in try/except so one failure can't tank the rest.

Supported triggers:
  new_comment, new_dm, new_review, keyword_mention, negative_sentiment

Supported actions:
  auto_reply, ai_smart_reply, notify, assign, add_tag, webhook
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import requests
from celery import shared_task
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from .models import (
    AutomationRule, Message, UnifiedReview, Conversation, Notification,
    PlatformCredential, AIReplyTemplate,
)
from .publishers import (
    get_publisher, PublishError, TokenExpiredError,
)

logger = logging.getLogger(__name__)


# ── Public entry points ──────────────────────────────────────────────────────
def dispatch_event(event_type: str, object_id: int, client_id: int) -> None:
    """
    Fire-and-forget helper called from sync tasks. Always non-blocking.

    event_type is one of: 'message_created' | 'review_created'.
    The evaluator expands these into the rule trigger_type space (new_comment,
    new_dm, keyword_mention, negative_sentiment, new_review).
    """
    try:
        evaluate_automation_rules.delay(event_type, object_id, client_id)
    except Exception:
        # Never let the dispatcher crash the sync that scheduled it.
        logger.exception('dispatch_event failed event=%s id=%s client=%s',
                         event_type, object_id, client_id)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def evaluate_automation_rules(self, event_type: str, object_id: int, client_id: int):
    """Match the event against all active rules and run their actions."""
    try:
        ctx = _build_context(event_type, object_id, client_id)
    except Exception:
        logger.exception('evaluate_automation_rules: failed to build context for event=%s id=%s',
                         event_type, object_id)
        return 0

    if not ctx:
        return 0

    rules = list(AutomationRule.objects.filter(client_id=client_id, is_active=True))

    try:
        from .ai.automation_ai import needs_ai_enrichment, enrich_message_context
        needed = needs_ai_enrichment(rules)
        if needed and ctx.get('content'):
            enrich_message_context(ctx, needed_keys=needed)
    except Exception:
        logger.exception('automation: enrich_message_context failed')

    fired = 0
    for rule in rules:
        if not _matches(rule, ctx):
            continue
        try:
            _run_action(rule, ctx)
            AutomationRule.objects.filter(id=rule.id).update(
                run_count=rule.run_count + 1,
                last_run_at=timezone.now(),
            )
            fired += 1
            from .audit import log_action
            from .models import Client
            log_action(None, Client.objects.filter(id=client_id).first(),
                        'automation.fired',
                        object_type='AutomationRule', object_id=rule.id,
                        platform=ctx.get('platform', ''),
                        result='success',
                        details={'rule_name': rule.name,
                                 'trigger_type': rule.trigger_type,
                                 'action_type': rule.action_type})
        except Exception:
            logger.exception('AutomationRule %s action failed', rule.id)
    return fired


# ── Context builder ──────────────────────────────────────────────────────────
def _build_context(event_type: str, object_id: int, client_id: int) -> Optional[dict]:
    """
    Translate the raw event into a context dict the matcher + handlers
    consume. Returns None when the originating object can't be found.
    """
    if event_type == 'message_created':
        try:
            m = Message.objects.select_related('conversation').get(id=object_id)
        except Message.DoesNotExist:
            return None
        if m.conversation.client_id != client_id:
            return None
        if m.direction != 'inbound':
            return None
        return {
            'kind':         'message',
            'message':      m,
            'conversation': m.conversation,
            'platform':     m.conversation.platform,
            'content':      m.content or '',
            'sentiment':    m.sentiment or 'unknown',
            'conv_type':    m.conversation.type,    # comment | dm | mention | review
            'client_id':    client_id,
        }
    if event_type == 'review_created':
        try:
            r = UnifiedReview.objects.get(id=object_id)
        except UnifiedReview.DoesNotExist:
            return None
        if r.client_id != client_id:
            return None
        return {
            'kind':      'review',
            'review':    r,
            'platform':  r.platform,
            'content':   r.comment or '',
            'sentiment': r.sentiment or 'unknown',
            'rating':    r.rating,
            'client_id': client_id,
        }
    return None


# ── Matcher ──────────────────────────────────────────────────────────────────
def _matches(rule: AutomationRule, ctx: dict) -> bool:
    """Return True when the rule's trigger_type + trigger_filters fit ctx."""
    f = rule.trigger_filters or {}

    # Platform filter applies to all triggers
    platforms = f.get('platforms') or []
    if platforms and ctx['platform'] not in platforms:
        return False

    try:
        from .ai.automation_ai import matches_ai_filters
        if not matches_ai_filters(f, ctx):
            return False
    except Exception:
        logger.exception('matches_ai_filters failed for rule %s', rule.id)

    t = rule.trigger_type
    kind = ctx['kind']

    if t == 'new_review':
        if kind != 'review':
            return False
        # Optional rating bounds
        min_r = f.get('min_rating')
        max_r = f.get('max_rating')
        if min_r is not None and ctx['rating'] < int(min_r):
            return False
        if max_r is not None and ctx['rating'] > int(max_r):
            return False
        return True

    if t == 'new_comment':
        return kind == 'message' and ctx['conv_type'] == 'comment'

    if t == 'new_dm':
        return kind == 'message' and ctx['conv_type'] == 'dm'

    if t == 'keyword_mention':
        if kind != 'message':
            return False
        keywords = [str(k).lower().strip() for k in (f.get('keywords') or []) if str(k).strip()]
        if not keywords:
            return False
        text = (ctx['content'] or '').lower()
        return any(k in text for k in keywords)

    if t == 'negative_sentiment':
        return ctx['sentiment'] == 'negative'

    # viral_post / new_follower not driven by inbox events; future work.
    return False


# ── Action handlers ──────────────────────────────────────────────────────────
def _run_action(rule: AutomationRule, ctx: dict) -> None:
    handler = ACTION_HANDLERS.get(rule.action_type)
    if handler is None:
        logger.warning('Unknown action_type=%s on rule=%s', rule.action_type, rule.id)
        return
    handler(rule, ctx)


def _execute_auto_reply(rule: AutomationRule, ctx: dict) -> None:
    cfg = rule.action_config or {}
    text = _resolve_template_text(cfg, rule, ctx)
    if not text:
        logger.info('auto_reply rule=%s skipped — empty template', rule.id)
        return
    _post_reply(ctx, text)


def _execute_ai_smart_reply(rule: AutomationRule, ctx: dict) -> None:
    """Generate a short reply via Claude and post it."""
    text = _generate_smart_reply(ctx)
    if not text:
        logger.info('ai_smart_reply rule=%s skipped — Claude unavailable or empty', rule.id)
        return
    _post_reply(ctx, text)


def _execute_notify(rule: AutomationRule, ctx: dict) -> None:
    cfg = rule.action_config or {}
    title = _interpolate(cfg.get('title') or _default_notify_title(ctx), ctx)
    body  = _interpolate(cfg.get('body')  or _default_notify_body(ctx), ctx)

    # Pick recipients — explicit user_ids in config, or all users with a profile
    # tied to this client.
    recipient_ids = cfg.get('user_ids') or []
    if not recipient_ids:
        from .models import UserProfile
        recipient_ids = list(
            UserProfile.objects
                .filter(client_id=ctx['client_id'])
                .values_list('user_id', flat=True)
        )

    objs = [
        Notification(
            user_id=uid,
            notif_type='system',
            title=title,
            body=body,
            data={
                'event':      ctx['kind'],
                'platform':   ctx.get('platform'),
                'rule_id':    rule.id,
                'object_id':  ctx['message'].id if ctx['kind'] == 'message' else ctx['review'].id,
            },
        )
        for uid in recipient_ids if uid
    ]
    if objs:
        Notification.objects.bulk_create(objs)


def _execute_assignment(rule: AutomationRule, ctx: dict) -> None:
    cfg = rule.action_config or {}
    user_id = cfg.get('user_id')
    if not user_id:
        return
    if ctx['kind'] != 'message':
        return  # reviews don't have assigned_to
    Conversation.objects.filter(id=ctx['conversation'].id).update(assigned_to_id=user_id)


def _execute_tag(rule: AutomationRule, ctx: dict) -> None:
    cfg = rule.action_config or {}
    tag = cfg.get('tag')
    if not tag:
        return
    if ctx['kind'] != 'message':
        return
    with transaction.atomic():
        conv = Conversation.objects.select_for_update().get(id=ctx['conversation'].id)
        tags = list(conv.tags or [])
        if tag not in tags:
            tags.append(str(tag))
            conv.tags = tags
            conv.save(update_fields=['tags'])


def _execute_webhook(rule: AutomationRule, ctx: dict) -> None:
    cfg = rule.action_config or {}
    url = cfg.get('url')
    if not url:
        return
    payload = {
        'rule_id':    rule.id,
        'rule_name':  rule.name,
        'event':      ctx['kind'],
        'platform':   ctx.get('platform'),
        'sentiment':  ctx.get('sentiment'),
        'content':    (ctx.get('content') or '')[:500],
        'object_id':  ctx['message'].id if ctx['kind'] == 'message' else ctx['review'].id,
        'client_id':  ctx['client_id'],
        'fired_at':   timezone.now().isoformat(),
    }
    try:
        requests.post(url, json=payload, timeout=(5, 10))
    except requests.RequestException as e:
        logger.warning('Webhook rule=%s failed: %s', rule.id, e)


ACTION_HANDLERS = {
    'auto_reply':     _execute_auto_reply,
    'ai_smart_reply': _execute_ai_smart_reply,
    'notify':         _execute_notify,
    'assign':         _execute_assignment,
    'add_tag':        _execute_tag,
    'webhook':        _execute_webhook,
}


# ── Helpers used by handlers ─────────────────────────────────────────────────
def _resolve_template_text(cfg: dict, rule: AutomationRule, ctx: dict) -> str:
    """
    Pick text from cfg.template, AIReplyTemplate (cfg.template_id), or empty.

    if the template contains the magic placeholder `{{ai_personalized}}`
    OR the AIReplyTemplate row has `is_ai_dynamic=True`, run a Claude call to
    fill the slot with a customer-aware sentence before standard interpolation.
    """
    from .ai.automation_ai import template_needs_ai, personalize_template

    # Inline template wins over a referenced AIReplyTemplate row.
    txt = (cfg.get('template') or '').strip()
    if txt:
        if template_needs_ai(txt):
            client = _get_client_for_rule(rule)
            txt = personalize_template(txt, ctx, client=client)
        return _interpolate(txt, ctx)

    tpl_id = cfg.get('template_id')
    if tpl_id:
        try:
            tpl = AIReplyTemplate.objects.get(id=tpl_id, client_id=rule.client_id)
            AIReplyTemplate.objects.filter(id=tpl.id).update(use_count=tpl.use_count + 1)
            tpl_text = tpl.reply_text or ''
            # AI-dynamic templates personalise the body OR fill explicit placeholders.
            if tpl.is_ai_dynamic and not template_needs_ai(tpl_text):
                # No explicit placeholder: append one so personalize_template has
                # something to fill with the customer-aware sentence.
                tpl_text = f'{tpl_text}\n\n{{{{ai_personalized}}}}'.strip() if tpl_text else '{{ai_personalized}}'
            if template_needs_ai(tpl_text):
                client = _get_client_for_rule(rule)
                tpl_text = personalize_template(tpl_text, ctx, client=client)
            return _interpolate(tpl_text, ctx)
        except AIReplyTemplate.DoesNotExist:
            return ''
    return ''


def _get_client_for_rule(rule: AutomationRule):
    """Resolve the Client row a rule belongs to (cached lookup is overkill here)."""
    try:
        return rule.client
    except Exception:
        try:
            from .models import Client
            return Client.objects.get(id=rule.client_id)
        except Exception:
            return None


def _interpolate(template: str, ctx: dict) -> str:
    """Light-weight {placeholder} expansion — never raises on missing keys."""
    if not template:
        return ''
    safe = {
        'platform':       ctx.get('platform', ''),
        'sentiment':      ctx.get('sentiment', ''),
        'rating':         ctx.get('rating', ''),
        'content':        (ctx.get('content') or '')[:200],
        'reviewer_name':  getattr(ctx.get('review'), 'reviewer_name', '') if ctx.get('review') else '',
        'author_name':    getattr(ctx.get('message'), 'author_name', '')   if ctx.get('message') else '',
        'author_handle':  getattr(ctx.get('message'), 'author_handle', '') if ctx.get('message') else '',
    }
    try:
        return template.format(**safe)
    except (KeyError, IndexError, ValueError):
        return template


def _post_reply(ctx: dict, text: str) -> None:
    """Route the reply through the right publisher method based on context."""
    cred = PlatformCredential.objects.filter(
        client_id=ctx['client_id'], platform=ctx['platform'], is_active=True,
    ).first()
    if not cred:
        logger.warning('Auto-reply skipped — no active credential for %s', ctx['platform'])
        return

    publisher = get_publisher(ctx['platform'])
    try:
        if ctx['kind'] == 'review':
            r = ctx['review']
            result = publisher.reply_to_review(cred, r.platform_review_id, text)
            UnifiedReview.objects.filter(id=r.id).update(
                reply_text=text,
                replied_at=timezone.now(),
                status='replied',
            )
        elif ctx['kind'] == 'message':
            m = ctx['message']
            conv = ctx['conversation']
            if conv.type == 'comment':
                result = publisher.reply_to_comment(cred, m.platform_message_id, text)
            elif conv.type == 'dm':
                psid = m.author_handle or conv.contact_handle
                result = publisher.reply_to_dm(cred, conv.platform_thread_id, text,
                                               psid=psid, recipient_id=psid)
            else:
                logger.info('Auto-reply skipped — unsupported conv type=%s', conv.type)
                return

            # Persist outbound row so the inbox UI shows the auto-reply.
            Message.objects.create(
                conversation=conv,
                platform_message_id=getattr(result, 'platform_post_id', '') or '',
                direction='outbound',
                author_name='Social Stats automation',
                content=text,
                sent_at=timezone.now(),
                replied_at=timezone.now(),
                sentiment=m.sentiment,
            )
            Conversation.objects.filter(id=conv.id).update(
                last_message_preview=text[:500],
                last_message_at=timezone.now(),
            )
    except TokenExpiredError:
        logger.warning('Auto-reply: %s token expired (cred=%s)', ctx['platform'], cred.id)
        PlatformCredential.objects.filter(id=cred.id).update(is_active=False)
    except PublishError as e:
        logger.warning('Auto-reply publisher error: %s', e)


def _default_notify_title(ctx: dict) -> str:
    if ctx['kind'] == 'review':
        return f"New {ctx.get('rating', '')}-star review"
    return f"New {ctx.get('platform', '')} {ctx.get('conv_type', 'message')}"


def _default_notify_body(ctx: dict) -> str:
    snippet = (ctx.get('content') or '')[:200]
    return snippet or 'New activity matched one of your automation rules.'


def _generate_smart_reply(ctx: dict) -> str:
    """Single-suggestion variant of `ai_views.suggest_reply`. Returns ''
    when Claude is unavailable."""
    from .ai_helpers import get_claude, parse_json_response, unified_voice_prompt, HAIKU
    from .models import Client
    claude = get_claude()
    if not claude:
        return ''
    try:
        client = Client.objects.get(id=ctx['client_id'])
    except Client.DoesNotExist:
        return ''
    bv = unified_voice_prompt(client)
    sys = (
        'Reply on-brand to a social media interaction. ≤ 240 chars. '
        'Output JSON only.\n' + (bv + '\n' if bv else '')
    )
    user = (
        f'Platform: {ctx.get("platform")}.\n'
        f'Sentiment: {ctx.get("sentiment")}.\n\n'
        f'They wrote: """{(ctx.get("content") or "")[:1500]}"""\n\n'
        'Return JSON: {"reply": "<text>"}'
    )
    try:
        msg = claude.messages.create(
            model=HAIKU, max_tokens=300, timeout=20,
            system=sys, messages=[{'role': 'user', 'content': user}],
        )
        out = parse_json_response(msg.content[0].text)
        return str(out.get('reply') or '').strip()
    except Exception:
        logger.exception('_generate_smart_reply failed')
        return ''


# ── Rule templates (served by the viewset's `templates` action) ──────────────
RULE_TEMPLATES = [
    {
        'name':           'Auto-thank for 5-star reviews',
        'description':    'Posts a friendly thank-you reply on every new 5★ Google review.',
        'trigger_type':   'new_review',
        'trigger_filters': {'min_rating': 5, 'max_rating': 5},
        'action_type':    'auto_reply',
        'action_config': {
            'template': 'Thank you so much for the kind words, {reviewer_name}! 🙏',
        },
    },
    {
        'name':           'Alert me on negative sentiment',
        'description':    'Sends an in-app notification whenever a comment or DM is flagged negative.',
        'trigger_type':   'negative_sentiment',
        'trigger_filters': {},
        'action_type':    'notify',
        'action_config': {
            'title': 'Heads up — negative sentiment detected',
            'body':  '{author_name} on {platform}: "{content}"',
        },
    },
    {
        'name':           'AI smart-reply to comments',
        'description':    'Automatically writes an on-brand reply to every new comment using Claude.',
        'trigger_type':   'new_comment',
        'trigger_filters': {},
        'action_type':    'ai_smart_reply',
        'action_config':  {},
    },
    {
        'name':           'Tag urgent keywords',
        'description':    'Tags conversations whose content mentions "urgent", "asap", or "broken".',
        'trigger_type':   'keyword_mention',
        'trigger_filters': {'keywords': ['urgent', 'asap', 'broken']},
        'action_type':    'add_tag',
        'action_config':  {'tag': 'priority'},
    },
    {
        'name':           'Webhook on new DM',
        'description':    'POSTs a JSON payload to your webhook URL whenever a new direct message arrives.',
        'trigger_type':   'new_dm',
        'trigger_filters': {},
        'action_type':    'webhook',
        'action_config':  {'url': 'https://your-webhook.example/incoming'},
    },
    {
        'name':           'Assign 1-2★ reviews to support lead',
        'description':    'Routes low-rating reviews to a specific user (configure user_id).',
        'trigger_type':   'new_review',
        'trigger_filters': {'min_rating': 1, 'max_rating': 2},
        'action_type':    'notify',
        'action_config': {
            'title': '1-2★ review needs attention',
            'body':  '{reviewer_name}: "{content}"',
        },
    },
]
