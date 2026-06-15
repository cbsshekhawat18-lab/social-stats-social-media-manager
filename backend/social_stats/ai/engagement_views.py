# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Engagement AI endpoints.

Mounted at:
    POST /api/ai/v2/reply-suggest        — 3 reply candidates (different tones)
    POST /api/ai/v2/auto-reply           — generate (and optionally enqueue) a single reply
    POST /api/ai/v2/sentiment-analyze    — sentiment + emotion + urgency + intent (Haiku)
    POST /api/ai/v2/intent-classify      — quick intent + suggested action (Haiku)
    POST /api/ai/v2/review-reply         — public review reply (GMB / app store)
    POST /api/ai/v2/crisis-detect        — scan recent messages for PR signals
    POST /api/ai/v2/spam-filter          — single-message spam classifier (Haiku)

The endpoints can take EITHER raw text (`message` / `conversation_id`) or
inbox-model IDs (`message_id` / `conversation_id` / `review_id`) and resolve
to the underlying Social Stats Message / Conversation / UnifiedReview rows. Tenant
isolation enforced — a user can only AI-process resources for their own client.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Conversation, Message, UnifiedReview
from ..ai_helpers import brand_voice_prompt
from ..ai_views import _resolved_client
from . import AIClient, AIError, RateLimited, prompts
from .content_views import _ai_call_json, _error_response
from .prompts import sentiment_analyzer, intent_classifier, spam_filter, crisis_detector

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# Resolver helpers — accept text OR Social Stats model IDs
# ─────────────────────────────────────────────────────────────────────────

def _resolve_message(*, client, message_id=None, conversation_id=None, fallback_text=''):
    """
    Returns (text, platform, conversation_history, sender_name) for an AI call.

    `conversation_history` is a list of {role, text} for the last 6 messages,
    with role∈{customer, agent}.
    """
    if message_id:
        try:
            msg = Message.objects.select_related('conversation').get(
                id=message_id, conversation__client=client,
            )
        except Message.DoesNotExist:
            raise AIError('message not found')
        conv = msg.conversation
        history = list(
            Message.objects.filter(conversation=conv)
            .order_by('-sent_at', '-id')[:6]
            .values('direction', 'content')
        )
        history.reverse()
        history_block = [
            {'role': 'agent' if m['direction'] == 'outbound' else 'customer',
             'text': m['content'] or ''}
            for m in history
        ]
        return msg.content or '', conv.platform, history_block, msg.author_name or conv.contact_name or ''

    if conversation_id:
        try:
            conv = Conversation.objects.get(id=conversation_id, client=client)
        except Conversation.DoesNotExist:
            raise AIError('conversation not found')
        history_qs = (
            Message.objects.filter(conversation=conv)
            .order_by('-sent_at', '-id')[:6]
        )
        history = list(history_qs.values('direction', 'content'))
        history.reverse()
        history_block = [
            {'role': 'agent' if m['direction'] == 'outbound' else 'customer',
             'text': m['content'] or ''}
            for m in history
        ]
        # Pick the last inbound message as the "current" message
        last_inbound = next((m for m in reversed(history) if m['direction'] == 'inbound'), None)
        text = (last_inbound or {}).get('content') or fallback_text or conv.last_message_preview
        return text, conv.platform, history_block, conv.contact_name or ''

    if fallback_text:
        return fallback_text, '', [], ''

    raise AIError('message_id, conversation_id, or message text is required')


def _resolve_review(*, client, review_id=None, fallback=None):
    """Returns (review_text, rating, reviewer_name, platform)."""
    if review_id:
        try:
            r = UnifiedReview.objects.get(id=review_id, client=client)
        except UnifiedReview.DoesNotExist:
            raise AIError('review not found')
        return (
            r.content or '',
            int(getattr(r, 'rating', 0) or 0),
            getattr(r, 'reviewer_name', '') or '',
            r.platform,
        )
    if fallback:
        return (
            fallback.get('text', '') or '',
            int(fallback.get('rating', 0) or 0),
            fallback.get('reviewer_name', '') or '',
            fallback.get('platform', 'gmb'),
        )
    raise AIError('review_id or review fallback is required')


# ─────────────────────────────────────────────────────────────────────────
# 1. /ai/v2/reply-suggest
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reply_suggest(request):
    """
    Body: { client_id, message_id? | conversation_id? | message: text,
            platform?, sender_name?, intent?, sentiment?, extra_notes? }
    Returns: { suggestions: [{tone, text, length, recommended}], summary }
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        text, platform, history, sender_name = _resolve_message(
            client=client,
            message_id=request.data.get('message_id'),
            conversation_id=request.data.get('conversation_id'),
            fallback_text=request.data.get('message') or '',
        )
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    if not text.strip():
        return Response({'error': 'no message text to reply to'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='reply_suggest')
    try:
        data = _ai_call_json(
            ai=ai, template='reply_suggester',
            message=text,
            platform=request.data.get('platform') or platform or 'whatsapp',
            conversation_history=history,
            sender_name=request.data.get('sender_name') or sender_name,
            business_name=client.company or '',
            intent=request.data.get('intent', '') or '',
            sentiment=request.data.get('sentiment', '') or '',
            brand_voice=brand_voice_prompt(client),
            extra_notes=request.data.get('extra_notes', '') or '',
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'reply-suggest failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 2. /ai/v2/auto-reply
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_reply(request):
    """
    Generate a single ready-to-send reply. Optionally persists it as the
    AI-suggested reply on the source Message row.

    Body: { client_id, message_id? | conversation_id? | message: text,
            platform?, sender_name?, custom_instruction?, save_to_message? }
    Returns: { reply_text, tone_used, saved_to_message_id? }

    "send_immediately" is intentionally NOT supported here — sending a reply
    on a customer's behalf needs the platform-specific publisher pipeline,
    which lives outside the AI module. Surfacing the suggested reply for
    one-click send by the human operator is the safe pattern for now.
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        text, platform, history, sender_name = _resolve_message(
            client=client,
            message_id=request.data.get('message_id'),
            conversation_id=request.data.get('conversation_id'),
            fallback_text=request.data.get('message') or '',
        )
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    if not text.strip():
        return Response({'error': 'no message text to reply to'}, status=400)

    custom = (request.data.get('custom_instruction') or '').strip()

    ai = AIClient(client=client, user=request.user, feature='auto_reply')
    try:
        # We re-use the reply_suggester template and pick the recommended one,
        # but inject any custom instruction via extra_notes.
        data = _ai_call_json(
            ai=ai, template='reply_suggester',
            message=text,
            platform=request.data.get('platform') or platform or 'whatsapp',
            conversation_history=history,
            sender_name=request.data.get('sender_name') or sender_name,
            business_name=client.company or '',
            brand_voice=brand_voice_prompt(client),
            extra_notes=custom,
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'auto-reply failed')

    suggestions = data.get('suggestions') or []
    chosen = next((s for s in suggestions if s.get('recommended')), None) or (suggestions[0] if suggestions else None)
    if not chosen:
        return Response({'error': 'no reply could be generated'}, status=503)

    out = {
        'reply_text': chosen.get('text') or '',
        'tone_used':  chosen.get('tone') or 'professional',
        'all_suggestions': suggestions,
    }

    # Optionally save back to the source Message
    if request.data.get('save_to_message') and request.data.get('message_id'):
        try:
            Message.objects.filter(
                id=request.data.get('message_id'),
                conversation__client=client,
            ).update(ai_suggested_reply=out['reply_text'])
            out['saved_to_message_id'] = int(request.data.get('message_id'))
        except Exception:
            logger.exception('failed to persist ai_suggested_reply')

    return Response(out)


# ─────────────────────────────────────────────────────────────────────────
# 3. /ai/v2/sentiment-analyze
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sentiment_analyze(request):
    """
    Body: { client_id, message_id? | conversation_id? | text, platform?, business_context? }
    Returns: sentiment_analyzer.coerce_result(...)  — see prompt module
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        text, platform, _hist, _sender = _resolve_message(
            client=client,
            message_id=request.data.get('message_id'),
            conversation_id=request.data.get('conversation_id'),
            fallback_text=request.data.get('text') or '',
        )
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    if not text.strip():
        return Response({'error': 'text is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='sentiment_analyze')
    cfg = prompts.build('sentiment_analyzer',
                        message=text,
                        platform=request.data.get('platform') or platform or '',
                        business_context=request.data.get('business_context', '') or '')
    try:
        # Force Haiku for fast/cheap classification
        raw = ai.extract_json(
            cfg['user_message'], system=cfg['system'],
            max_tokens=cfg['max_tokens'], temperature=cfg['temperature'],
            fast=True,
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'sentiment-analyze failed')

    result = sentiment_analyzer.coerce_result(raw)

    # Optionally persist back to Message.sentiment
    if request.data.get('save_to_message') and request.data.get('message_id'):
        try:
            Message.objects.filter(
                id=request.data.get('message_id'),
                conversation__client=client,
            ).update(sentiment=result['sentiment'])
        except Exception:
            logger.exception('failed to persist Message.sentiment')

    return Response(result)


# ─────────────────────────────────────────────────────────────────────────
# 4. /ai/v2/intent-classify
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def intent_classify(request):
    """
    Body: { client_id, text? | message_id?, platform?, business_context? }
    Returns: intent_classifier.coerce_result(...)
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        text, platform, _hist, _sender = _resolve_message(
            client=client,
            message_id=request.data.get('message_id'),
            conversation_id=request.data.get('conversation_id'),
            fallback_text=request.data.get('text') or '',
        )
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    if not text.strip():
        return Response({'error': 'text is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='intent_classify')
    cfg = prompts.build('intent_classifier',
                        text=text,
                        platform=request.data.get('platform') or platform or '',
                        business_context=request.data.get('business_context', '') or '')
    try:
        raw = ai.extract_json(
            cfg['user_message'], system=cfg['system'],
            max_tokens=cfg['max_tokens'], temperature=cfg['temperature'],
            fast=True,
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'intent-classify failed')

    return Response(intent_classifier.coerce_result(raw))


# ─────────────────────────────────────────────────────────────────────────
# 5. /ai/v2/review-reply
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def review_reply(request):
    """
    Body: { client_id, review_id? | review: {text, rating, reviewer_name, platform},
            extra_notes?, language? }
    Returns: { reply_text, tone_used, addresses_concerns }
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        review_text, rating, reviewer_name, platform = _resolve_review(
            client=client,
            review_id=request.data.get('review_id'),
            fallback=request.data.get('review'),
        )
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    if not review_text.strip():
        return Response({'error': 'review text is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='review_reply')
    try:
        data = _ai_call_json(
            ai=ai, template='review_reply',
            review_text=review_text,
            rating=rating,
            reviewer_name=reviewer_name,
            business_name=client.company or '',
            platform=platform or 'gmb',
            brand_voice=brand_voice_prompt(client),
            extra_notes=request.data.get('extra_notes', '') or '',
            language=request.data.get('language', 'English'),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'review-reply failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 6. /ai/v2/crisis-detect
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crisis_detect(request):
    """
    Scan recent inbound messages for PR-crisis signals.

    Body: { client_id, time_window_hours?, max_messages? }
    Returns: crisis_detector.coerce_result(...)
    """
    client, err = _resolved_client(request)
    if err: return err

    hours        = max(1, min(int(request.data.get('time_window_hours', 24) or 24), 168))
    max_messages = max(1, min(int(request.data.get('max_messages', 100) or 100), 200))
    since        = timezone.now() - timedelta(hours=hours)

    msg_qs = (
        Message.objects.filter(
            conversation__client=client,
            direction='inbound',
            sent_at__gte=since,
        )
        .select_related('conversation')
        .order_by('-sent_at')[:max_messages]
    )

    messages = []
    for m in msg_qs:
        messages.append({
            'text':           (m.content or '')[:400],
            'platform':       m.conversation.platform,
            'posted_at':      m.sent_at.isoformat() if m.sent_at else '',
            'author_handle':  m.author_handle or '',
            'post_id':        m.platform_message_id or '',
        })

    if not messages:
        return Response({
            'crisis_detected':    False,
            'severity':           'low',
            'signals':            [],
            'affected_post_ids':  [],
            'recommended_action': 'monitor',
            'summary':            f'No inbound messages in the last {hours} hours.',
            'messages_analysed':  0,
        })

    ai = AIClient(client=client, user=request.user, feature='crisis_detect')
    cfg = prompts.build('crisis_detector',
                        messages=messages,
                        business_name=client.company or '',
                        language='English')
    try:
        raw = ai.extract_json(
            cfg['user_message'], system=cfg['system'],
            max_tokens=cfg['max_tokens'], temperature=cfg['temperature'],
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'crisis-detect failed')

    result = crisis_detector.coerce_result(raw)
    result['messages_analysed'] = len(messages)
    return Response(result)


# ─────────────────────────────────────────────────────────────────────────
# 7. /ai/v2/spam-filter
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def spam_filter_view(request):
    """
    Body: { client_id, text? | message_id?, sender_metadata? }
    Returns: spam_filter.coerce_result(...)
    """
    client, err = _resolved_client(request)
    if err: return err

    try:
        text, _platform, _hist, _sender = _resolve_message(
            client=client,
            message_id=request.data.get('message_id'),
            fallback_text=request.data.get('text') or '',
        )
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    if not text.strip():
        return Response({'error': 'text is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='spam_filter')
    cfg = prompts.build('spam_filter',
                        text=text,
                        sender_metadata=request.data.get('sender_metadata') or {})
    try:
        raw = ai.extract_json(
            cfg['user_message'], system=cfg['system'],
            max_tokens=cfg['max_tokens'], temperature=cfg['temperature'],
            fast=True,
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'spam-filter failed')

    return Response(spam_filter.coerce_result(raw))
