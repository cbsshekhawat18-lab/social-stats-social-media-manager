# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Social Stats Assistant chat endpoints.

Endpoints:
    POST   /api/ai/v2/chat/                       — send a message + (optional) confirm an action
    GET    /api/ai/v2/chat/conversations/         — list user's chat threads
    GET    /api/ai/v2/chat/conversations/<id>/    — fetch conversation + messages
    PATCH  /api/ai/v2/chat/conversations/<id>/    — rename / archive
    DELETE /api/ai/v2/chat/conversations/<id>/    — delete

Architecture:
    The chat is agentic. Claude can call tools (defined in ai/tools.py). The
    orchestrator runs a multi-turn loop: send → if tool_use blocks, execute
    each → send tool_results → repeat until Claude responds with text only.

    Dangerous tools (schedule_post, send_whatsapp_campaign, update_post)
    return a `confirmation_required` flag. The orchestrator halts the loop
    on the first such tool, persists the assistant's tool_use turn, and
    surfaces a pending_confirmations[] to the UI. The UI renders a Confirm
    card; user clicks → POST /ai/v2/chat/ again with `confirm: {…}` →
    orchestrator runs the tool with confirmed=True and continues.

Streaming:
    This first version is non-streaming (single JSON response per turn).
    Streaming via SSE will land in a polish pass once the agentic loop is
    proven stable.
"""
from __future__ import annotations

import logging
import time
from decimal import Decimal

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import AIConversation, AIMessage
from ..ai_helpers import brand_voice_prompt
from ..ai_views import _resolved_client
from . import AIError, RateLimited, prompts
from .client import _anthropic_or_none
from . import cost_tracker, rate_limiter
from .tools import TOOL_SCHEMA, execute_tool, CONFIRMATION_REQUIRED

logger = logging.getLogger(__name__)

# Hard cap on agentic loop iterations to prevent runaway costs.
MAX_TOOL_ITERATIONS = 6
# Cap on conversation history sent to Claude (token budget).
MAX_HISTORY_MESSAGES = 30


def _serialize_conversation(conv: AIConversation) -> dict:
    return {
        'id':           conv.id,
        'title':        conv.title or '',
        'context_type': conv.context_type,
        'archived':     conv.archived,
        'client_id':    conv.client_id,
        'created_at':   conv.created_at.isoformat() if conv.created_at else '',
        'updated_at':   conv.updated_at.isoformat() if conv.updated_at else '',
    }


def _serialize_message(msg: AIMessage) -> dict:
    return {
        'id':           msg.id,
        'role':         msg.role,
        'content':      msg.content or '',
        'tool_calls':   list(msg.tool_calls or []),
        'tool_results': list(msg.tool_results or []),
        'attachments':  list(msg.attachments or []),
        'feedback':     msg.feedback or '',
        'created_at':   msg.created_at.isoformat() if msg.created_at else '',
    }


def _build_history(conversation: AIConversation) -> list:
    """
    Convert the persisted AIMessage rows into the Anthropic messages[] format.
    Capped at MAX_HISTORY_MESSAGES most recent.

    Each AIMessage with role='user' or 'assistant' becomes one entry. The
    `tool_calls` / `tool_results` JSON fields are reconstructed into the
    appropriate content-blocks shape.
    """
    rows = list(
        AIMessage.objects.filter(conversation=conversation)
        .exclude(role='system')
        .order_by('-id')[:MAX_HISTORY_MESSAGES]
    )
    rows.reverse()

    out = []
    for r in rows:
        if r.role == 'user':
            # User messages are simple text. (Future: attachments → image blocks.)
            content = r.content or ''
            if r.tool_results:
                # Replays a prior tool_results turn (the role is "user" because
                # tool_result blocks are sent from the user side per Anthropic spec)
                blocks = []
                if content:
                    blocks.append({'type': 'text', 'text': content})
                for tr in r.tool_results:
                    blocks.append({
                        'type':         'tool_result',
                        'tool_use_id':  tr.get('tool_use_id', ''),
                        'content':      tr.get('content', ''),
                    })
                out.append({'role': 'user', 'content': blocks})
            else:
                out.append({'role': 'user', 'content': content})
        elif r.role == 'assistant':
            blocks = []
            if r.content:
                blocks.append({'type': 'text', 'text': r.content})
            for tc in r.tool_calls or []:
                blocks.append({
                    'type':  'tool_use',
                    'id':    tc.get('id', ''),
                    'name':  tc.get('name', ''),
                    'input': tc.get('input', {}),
                })
            if blocks:
                out.append({'role': 'assistant', 'content': blocks})
    return out


def _persist_assistant_turn(conversation, blocks, model_used: str,
                             usage: tuple[int, int] = (0, 0),
                             cost: Decimal = Decimal('0')):
    """Save an assistant response (mix of text + tool_use blocks) as one AIMessage."""
    text_parts = []
    tool_calls = []
    for b in blocks:
        if isinstance(b, dict):
            kind = b.get('type')
            if kind == 'text':
                text_parts.append(b.get('text', ''))
            elif kind == 'tool_use':
                tool_calls.append({
                    'id':    b.get('id', ''),
                    'name':  b.get('name', ''),
                    'input': b.get('input', {}),
                })
        else:
            # SDK objects with .type attribute
            kind = getattr(b, 'type', '')
            if kind == 'text':
                text_parts.append(getattr(b, 'text', '') or '')
            elif kind == 'tool_use':
                tool_calls.append({
                    'id':    getattr(b, 'id', ''),
                    'name':  getattr(b, 'name', ''),
                    'input': getattr(b, 'input', {}) or {},
                })
    return AIMessage.objects.create(
        conversation=conversation,
        role='assistant',
        content='\n'.join(text_parts).strip(),
        tool_calls=tool_calls,
        model_used=model_used,
        tokens_used=int(usage[0] or 0) + int(usage[1] or 0),
        cost_usd=cost,
    )


def _persist_user_turn(conversation, content: str, tool_results: list = None):
    """Save a user message (text + optional tool_results from prior turn)."""
    return AIMessage.objects.create(
        conversation=conversation,
        role='user',
        content=(content or '')[:32000],
        tool_results=list(tool_results or []),
    )


def _normalise_blocks_to_dicts(content) -> list[dict]:
    """SDK content can be a list of model objects; normalise to plain dicts."""
    out = []
    for b in content or []:
        if isinstance(b, dict):
            out.append(b)
            continue
        kind = getattr(b, 'type', '')
        if kind == 'text':
            out.append({'type': 'text', 'text': getattr(b, 'text', '') or ''})
        elif kind == 'tool_use':
            out.append({
                'type':  'tool_use',
                'id':    getattr(b, 'id', ''),
                'name':  getattr(b, 'name', ''),
                'input': getattr(b, 'input', {}) or {},
            })
    return out


# ─────────────────────────────────────────────────────────────────────────
# 1. POST /ai/v2/chat/   — main chat turn
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat(request):
    """
    Body:
        {
          client_id,
          conversation_id?:   id (creates new conversation if missing),
          message:            "user text",
          context_page?:      "where the user is in the app",
          confirm?: {tool_name, tool_input}    # to confirm a previously gated action
        }

    Returns:
        {
          conversation_id,
          assistant_message: {id, role, content, tool_calls},
          tool_runs:         [{name, ok, data?, error?, summary?}],
          pending_confirmations: [{tool_name, tool_input, summary}],
          usage:             {input_tokens, output_tokens, cost_usd, model},
        }
    """
    client, err = _resolved_client(request)
    if err: return err

    user = request.user
    message_text = (request.data.get('message') or '').strip()
    confirm      = request.data.get('confirm') or None
    if not message_text and not confirm:
        return Response({'error': 'message or confirm is required'}, status=400)

    # Get / create conversation
    convo_id = request.data.get('conversation_id')
    if convo_id:
        try:
            conversation = AIConversation.objects.get(id=convo_id, user=user)
        except AIConversation.DoesNotExist:
            return Response({'error': 'conversation not found'}, status=404)
    else:
        conversation = AIConversation.objects.create(
            user=user, client=client,
            title=(message_text[:60] or 'New chat'),
            context_type='client_specific' if client else 'general',
        )

    # SDK availability
    AnthropicCls, _sdk = _anthropic_or_none()
    if AnthropicCls is None:
        return Response({'error': 'AI SDK not installed'}, status=503)

    from django.conf import settings as dj_settings
    api_key = getattr(dj_settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        return Response({'error': 'ANTHROPIC_API_KEY is not configured'}, status=503)
    sdk = AnthropicCls(api_key=api_key)
    model_id = getattr(dj_settings, 'AI_DEFAULT_MODEL', 'claude-sonnet-4-6')

    # Pre-flight rate-limit check
    try:
        rate_limiter.check(getattr(client, 'id', None), feature='chat')
    except RateLimited as e:
        return Response({
            'error': str(e), 'scope': e.scope, 'limit': e.limit, 'used': e.used,
        }, status=429)

    # Optional confirm-and-execute pre-step
    extra_tool_runs = []
    pre_tool_results = []   # tool_result content blocks to attach to the next user message
    if confirm and isinstance(confirm, dict):
        result = execute_tool(
            name=confirm.get('tool_name'),
            tool_input=confirm.get('tool_input') or {},
            client=client, user=user, confirmed=True,
        )
        extra_tool_runs.append({
            'name': confirm.get('tool_name'),
            'ok':   bool(result.get('ok')),
            'data': result.get('data'),
            'error': result.get('error'),
            'confirmed': True,
        })
        # Stash this result so we send it back to Claude as additional context
        pre_tool_results.append({
            'tool_use_id': confirm.get('tool_use_id', ''),
            'content':     str(result),
        })

    # Persist the user's message + prior confirmation tool_results
    _persist_user_turn(conversation, content=message_text, tool_results=pre_tool_results)

    # System prompt
    sys_cfg = prompts.build('chat_system',
                            client_name=getattr(client, 'company', '') or '',
                            client_industry=(getattr(client, 'industry', '') or '') if client else '',
                            brand_voice=brand_voice_prompt(client),
                            user_role=getattr(getattr(user, 'profile', None), 'role', 'client'),
                            current_page=request.data.get('context_page', '') or '',
                            today_iso=timezone.now().date().isoformat())

    # Agentic loop
    history = _build_history(conversation)
    pending_confirmations = []
    tool_runs = list(extra_tool_runs)
    usage_in = usage_out = 0
    iterations = 0
    final_blocks = []

    while iterations < MAX_TOOL_ITERATIONS:
        iterations += 1
        t0 = time.monotonic()
        try:
            response = sdk.messages.create(
                model=model_id,
                max_tokens=sys_cfg.get('max_tokens', 2048),
                temperature=sys_cfg.get('temperature', 0.6),
                system=sys_cfg['system'],
                tools=TOOL_SCHEMA,
                messages=history,
            )
        except Exception as e:
            logger.exception('chat call failed (iter=%d)', iterations)
            cost_tracker.record_cost(
                client=client, user=user, feature='chat',
                model=model_id, input_tokens=0, output_tokens=0,
                duration_ms=int((time.monotonic() - t0) * 1000),
                request_id='', prompt_hash='', cached=False,
                request_payload={'iter': iterations}, response_summary=str(e)[:200],
                status='error', error_message=str(e)[:1000],
            )
            return Response({'error': f'AI call failed: {e}'}, status=503)

        usage = getattr(response, 'usage', None)
        usage_in  += int(getattr(usage, 'input_tokens',  0) or 0)
        usage_out += int(getattr(usage, 'output_tokens', 0) or 0)
        request_id = getattr(response, 'id', '') or ''
        stop_reason = getattr(response, 'stop_reason', '') or ''
        blocks = _normalise_blocks_to_dicts(getattr(response, 'content', []) or [])

        # Cost record per-turn
        per_turn_cost = cost_tracker.estimate_cost(
            int(getattr(usage, 'input_tokens', 0) or 0),
            int(getattr(usage, 'output_tokens', 0) or 0),
            model_id,
        )
        cost_tracker.record_cost(
            client=client, user=user, feature='chat',
            model=model_id,
            input_tokens=int(getattr(usage, 'input_tokens', 0) or 0),
            output_tokens=int(getattr(usage, 'output_tokens', 0) or 0),
            duration_ms=int((time.monotonic() - t0) * 1000),
            request_id=request_id, prompt_hash='', cached=False,
            request_payload={'iter': iterations},
            response_summary=' '.join(b.get('text', '') for b in blocks if b.get('type') == 'text')[:200],
            status='success',
        )

        # Identify tool calls in this turn
        tool_calls = [b for b in blocks if b.get('type') == 'tool_use']

        if not tool_calls:
            # Final response — persist + return
            assistant_msg = _persist_assistant_turn(conversation, blocks, model_id,
                                                    (usage_in, usage_out),
                                                    cost_tracker.estimate_cost(usage_in, usage_out, model_id))
            final_blocks = blocks
            break

        # Need to execute tools. Persist this assistant turn (with tool_use blocks),
        # then run the tools, then loop with tool_results in the next user message.
        assistant_msg = _persist_assistant_turn(conversation, blocks, model_id,
                                                 (0, 0), Decimal('0'))
        final_blocks = blocks

        tool_result_blocks = []
        halt_for_confirmation = False
        for tc in tool_calls:
            result = execute_tool(
                name=tc.get('name'),
                tool_input=tc.get('input') or {},
                client=client, user=user, confirmed=False,
            )

            run_summary = {
                'name': tc.get('name'),
                'ok':   bool(result.get('ok')),
                'data': result.get('data'),
                'error': result.get('error'),
            }
            tool_runs.append(run_summary)

            if result.get('confirmation_required'):
                # Surface as a pending confirmation card
                pending_confirmations.append({
                    'tool_use_id': tc.get('id', ''),
                    'tool_name':   tc.get('name'),
                    'tool_input':  tc.get('input') or {},
                    'summary':     result.get('summary') or '',
                })
                # Tell Claude this needs user confirmation; it should respond conversationally.
                tool_result_blocks.append({
                    'type':        'tool_result',
                    'tool_use_id': tc.get('id', ''),
                    'content':     'AWAITING_USER_CONFIRMATION: ' + (result.get('summary') or ''),
                })
                halt_for_confirmation = True
            else:
                tool_result_blocks.append({
                    'type':        'tool_result',
                    'tool_use_id': tc.get('id', ''),
                    'content':     str(result),
                })

        # Append the tool-result message to history + persist a tool-result user message
        history.append({'role': 'assistant', 'content': blocks})
        history.append({'role': 'user',      'content': tool_result_blocks})
        _persist_user_turn(conversation, content='', tool_results=[
            {'tool_use_id': trb.get('tool_use_id', ''), 'content': trb.get('content', '')}
            for trb in tool_result_blocks
        ])

        if halt_for_confirmation:
            # Don't iterate further until the user confirms; let Claude take ONE more
            # turn to summarise + ask the user, then break.
            try:
                response = sdk.messages.create(
                    model=model_id,
                    max_tokens=1024,
                    temperature=sys_cfg.get('temperature', 0.6),
                    system=sys_cfg['system'],
                    tools=TOOL_SCHEMA,
                    messages=history,
                )
                blocks = _normalise_blocks_to_dicts(getattr(response, 'content', []) or [])
                _persist_assistant_turn(conversation, blocks, model_id,
                                         (0, 0), Decimal('0'))
                final_blocks = blocks
            except Exception:
                logger.exception('confirmation summary turn failed')
            break

    # Bump conversation timestamp + auto-title for new convos
    if not conversation.title or conversation.title == 'New chat':
        # Try to set a better title from the first user message
        if message_text:
            conversation.title = message_text[:60]
    conversation.save(update_fields=['title', 'updated_at'])

    # Final assistant text (concat of any text blocks in the final turn)
    final_text = ' '.join(b.get('text', '') for b in (final_blocks or []) if b.get('type') == 'text').strip()
    final_tool_calls = [
        {'id': b.get('id', ''), 'name': b.get('name', ''), 'input': b.get('input', {})}
        for b in (final_blocks or []) if b.get('type') == 'tool_use'
    ]

    return Response({
        'conversation_id': conversation.id,
        'assistant_message': {
            'role':       'assistant',
            'content':    final_text,
            'tool_calls': final_tool_calls,
        },
        'tool_runs':              tool_runs,
        'pending_confirmations':  pending_confirmations,
        'iterations':             iterations,
        'usage': {
            'input_tokens':  usage_in,
            'output_tokens': usage_out,
            'cost_usd':      float(cost_tracker.estimate_cost(usage_in, usage_out, model_id)),
            'model':         model_id,
        },
    })


# ─────────────────────────────────────────────────────────────────────────
# 2. GET /ai/v2/chat/conversations/
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_conversations(request):
    user = request.user
    archived = request.query_params.get('archived')
    qs = AIConversation.objects.filter(user=user)
    if archived is None:
        qs = qs.filter(archived=False)
    elif archived == 'true':
        qs = qs.filter(archived=True)
    qs = qs.order_by('-updated_at')[:100]
    return Response({
        'count':         qs.count(),
        'conversations': [_serialize_conversation(c) for c in qs],
    })


# ─────────────────────────────────────────────────────────────────────────
# 3. GET / PATCH / DELETE /ai/v2/chat/conversations/<id>/
# ─────────────────────────────────────────────────────────────────────────
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def conversation_detail(request, pk):
    try:
        conversation = AIConversation.objects.get(id=pk, user=request.user)
    except AIConversation.DoesNotExist:
        return Response({'error': 'conversation not found'}, status=404)

    if request.method == 'GET':
        msgs = AIMessage.objects.filter(conversation=conversation).order_by('id')
        return Response({
            **_serialize_conversation(conversation),
            'messages': [_serialize_message(m) for m in msgs],
        })

    if request.method == 'PATCH':
        title    = request.data.get('title')
        archived = request.data.get('archived')
        fields = []
        if title is not None:
            conversation.title = str(title)[:200]
            fields.append('title')
        if archived is not None:
            conversation.archived = bool(archived)
            fields.append('archived')
        if fields:
            conversation.save(update_fields=fields + ['updated_at'])
        return Response(_serialize_conversation(conversation))

    if request.method == 'DELETE':
        conversation.delete()
        return Response(status=204)
