# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
AI helpers for the bot builder.

Endpoints:
    POST /api/bot-flows/generate-with-ai/                 (auth)
        body: {prompt, industry?, language?, name?}
        → returns a draft BotFlow with nodes/edges synthesised by Claude

    POST /api/bot-conversations/<id>/ai-suggest-replies/  (auth)
        → returns up to 3 reply suggestions for a handed-off conversation
          (read-only — does not send anything)

    POST /api/ai/persona-builder/                          (auth)
        body: {business_name, industry?, what_you_do?, tone?, no_go_topics?}
        → returns a persona prompt suitable for an `ai_chat` node

Lead scoring already ships in lead_views.py .
"""
from __future__ import annotations

import json
import logging
import re

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .ai.client import AIClient
from .bot_views import _validate_flow
from .models import (
    BotConversation, BotConversationStep, BotFlow,
    NODE_TYPES,
)
from .whatsapp_views import TenantScopedMixin


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _resolve_client_id(request) -> int | None:
    """Reuse the same shape as TenantScopedMixin without requiring inheritance."""
    profile = getattr(request.user, 'profile', None)
    if not profile:
        return None
    if profile.role == 'superadmin':
        cid = request.query_params.get('client_id') or request.data.get('client_id') or request.data.get('client')
        try: return int(cid) if cid else None
        except (TypeError, ValueError): return None
    if profile.role == 'staff':
        cid = request.query_params.get('client_id') or request.data.get('client_id') or request.data.get('client')
        try: cid = int(cid) if cid else None
        except (TypeError, ValueError): cid = None
        return cid if cid and profile.assigned_clients.filter(id=cid).exists() else None
    return profile.client_id


def _extract_json(text: str) -> dict | None:
    """Pull the first {…} JSON object out of an LLM response, even when it's
    wrapped in markdown fences or has prose around it."""
    if not text:
        return None
    # Strip fenced code blocks
    fenced = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if fenced:
        candidate = fenced.group(1)
    else:
        # Greedy match of the outermost braces
        m = re.search(r'\{.*\}', text, re.DOTALL)
        candidate = m.group(0) if m else None
    if not candidate:
        return None
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 1. Flow generator
# ─────────────────────────────────────────────────────────────────────────────
_FLOW_GEN_SYSTEM = (
    'You are a senior conversational-AI designer who builds CTWA WhatsApp '
    'bot flows for marketing agencies. Output STRICT JSON matching the '
    'schema given by the user — no prose, no fences, no markdown.'
)


def _flow_generator_prompt(user_prompt: str, *, industry: str = '', language: str = 'en') -> str:
    node_catalog = ', '.join(sorted(NODE_TYPES.keys()))
    return (
        f'Build a WhatsApp bot flow based on this requirement:\n'
        f'  "{user_prompt}"\n'
        + (f'Industry: {industry}\n'                  if industry else '')
        + (f'Language: {language}\n'                  if language and language != 'en' else '')
        + '\n'
        'Output JSON with exactly this shape:\n'
        '{\n'
        '  "name":              "<short flow name>",\n'
        '  "description":       "<one-line description>",\n'
        '  "starting_node_id":  "start",\n'
        '  "nodes":             [...],\n'
        '  "edges":             [...]\n'
        '}\n'
        '\n'
        'Node shape:\n'
        '  { "id": "<unique snake_case id>", "type": "<one of: ' + node_catalog + '>",\n'
        '    "position": {"x": <number>, "y": <number>},\n'
        '    "data": {<type-specific payload>} }\n'
        '\n'
        'Edge shape:\n'
        '  { "id": "<unique edge id>", "source": "<node id>", "target": "<node id>",\n'
        '    "sourceHandle"?: "<button id, list row id, true|false, success|failure>" }\n'
        '\n'
        'Rules — STRICT:\n'
        '  • Exactly one "start" node, id="start". Every other node must be reachable from it.\n'
        '  • End every branch with an "end_conversation" or "human_handoff" node.\n'
        '  • For "ask_*" nodes, set data.store_var to a snake_case variable name.\n'
        '  • For "message_buttons", supply 2-3 buttons as data.buttons:[{id,title}],\n'
        '    and route each branch via edge.sourceHandle = button.id.\n'
        '  • Use "{{var}}" tokens to interpolate collected variables in message text.\n'
        '  • Always include a "capture_lead" node before "end_conversation" if the flow\n'
        '    is for lead capture or appointment booking.\n'
        '  • Position nodes with x increasing left-to-right (start at x=80, step ~240).\n'
        '  • Keep the flow under 14 nodes total.\n'
        '\n'
        'Output ONLY the JSON object, no other text.'
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_flow_with_ai(request):
    """POST {prompt, industry?, language?, name?} → returns a freshly created
    draft BotFlow (status: is_active=False) for the calling client."""
    client_id = _resolve_client_id(request)
    if not client_id:
        return Response({'error': 'no client context'}, status=403)

    prompt = (request.data.get('prompt') or '').strip()
    if not prompt:
        return Response({'error': 'prompt is required'}, status=400)
    industry = (request.data.get('industry') or '').strip()
    language = (request.data.get('language') or 'en').strip()
    explicit_name = (request.data.get('name') or '').strip()

    from .models import Client
    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        return Response({'error': 'client not found'}, status=404)

    ai = AIClient(client=client, user=request.user, feature='ctwa_flow_gen')
    try:
        raw = ai.complete(
            prompt=_flow_generator_prompt(prompt, industry=industry, language=language),
            system=_FLOW_GEN_SYSTEM,
            max_tokens=2200, temperature=0.4,
            use_cache=False,
        )
    except Exception as e:  # noqa: BLE001
        logger.exception('flow generator AI call failed')
        return Response({'error': f'AI call failed: {e}'}, status=502)

    spec = _extract_json(raw)
    if not spec or not isinstance(spec.get('nodes'), list) or not isinstance(spec.get('edges'), list):
        return Response({
            'error': 'AI did not return a valid flow JSON',
            'raw_excerpt': (raw or '')[:400],
        }, status=502)

    # Validate the AI output against our schema before persisting
    nodes = [n for n in spec['nodes'] if isinstance(n, dict) and n.get('id') and n.get('type') in NODE_TYPES]
    edges = [e for e in spec['edges'] if isinstance(e, dict) and e.get('source') and e.get('target')]
    starting = spec.get('starting_node_id') or 'start'
    starts = [n for n in nodes if n.get('type') == 'start']
    if not starts:
        return Response({'error': 'AI omitted the start node'}, status=502)
    if not any(n.get('id') == starting for n in nodes):
        starting = starts[0]['id']

    flow = BotFlow.objects.create(
        client_id=client_id,
        name=(explicit_name or spec.get('name') or 'AI-generated flow')[:200],
        description=(spec.get('description') or f'Generated by AI from: "{prompt[:80]}"')[:2000],
        trigger_type='ctwa_ad', trigger_config={},
        nodes=nodes, edges=edges,
        starting_node_id=starting,
        is_active=False,
        created_by=request.user,
    )
    # Run our post-generation validator so the response can flag anything
    # the editor will surface anyway.
    val = _validate_flow(flow)

    return Response({
        'flow_id':    flow.id,
        'name':       flow.name,
        'node_count': len(nodes),
        'edge_count': len(edges),
        'validation': val,
    })


# ─────────────────────────────────────────────────────────────────────────────
# 2. Reply suggestions for handoff conversations
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_reply(request, conversation_id):
    """Return up to 3 suggested replies the human agent can pick + send.
    Read-only — the agent picks one and uses the existing send-message endpoint.
    """
    try:
        conv = BotConversation.objects.select_related('client', 'flow', 'contact').get(pk=conversation_id)
    except BotConversation.DoesNotExist:
        return Response({'error': 'conversation not found'}, status=404)

    # Tenant gate — keep it loose; a stricter check would require resolving
    # acting agency membership. For now, the calling user's profile must
    # have access to this client.
    profile = getattr(request.user, 'profile', None)
    if not profile or (profile.role == 'client' and profile.client_id != conv.client_id):
        return Response({'error': 'forbidden'}, status=403)

    # Build last 12 turns from the audit trail
    history_lines: list[str] = []
    for s in conv.steps.order_by('-created_at')[:12][::-1]:
        text = (s.payload or {}).get('text') or (s.payload or {}).get('body') or ''
        if not text: continue
        who = 'Customer' if s.direction == 'user_to_bot' else 'Agency'
        history_lines.append(f'{who}: {text}')

    if not history_lines:
        return Response({'suggestions': []})

    captured = {k: v for k, v in (conv.variables or {}).items() if not k.startswith('_')}

    prompt = (
        f'Conversation so far:\n{chr(10).join(history_lines)}\n\n'
        f'Captured info: {captured}\n\n'
        f'Suggest THREE replies the human agent could send right now to move this '
        f'conversation forward. Output JSON: {{"suggestions": ["...", "...", "..."]}}.\n'
        f'Each reply must be:\n'
        f'  • under 120 characters\n'
        f'  • friendly, professional, in the customer\'s language\n'
        f'  • direct and actionable (avoid "let me check")\n'
        f'Output ONLY the JSON object.'
    )

    ai = AIClient(client=conv.client, user=request.user, feature='ctwa_reply_suggest')
    try:
        raw = ai.complete(
            prompt=prompt,
            system='You are a senior customer-service rep. Be concise and helpful.',
            max_tokens=400, temperature=0.5, fast=True,  # Haiku — cheap + fast
            use_cache=False,
        )
    except Exception as e:  # noqa: BLE001
        return Response({'error': f'AI call failed: {e}'}, status=502)

    spec = _extract_json(raw) or {}
    suggestions = spec.get('suggestions') or []
    suggestions = [str(s)[:300] for s in suggestions if s][:3]
    return Response({'suggestions': suggestions})


# ─────────────────────────────────────────────────────────────────────────────
# 3. Persona builder wizard
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def build_persona(request):
    """POST {business_name, industry?, what_you_do?, tone?, no_go_topics?[]} →
    returns a persona prompt the user can paste into an ai_chat node."""
    client_id = _resolve_client_id(request)
    biz = (request.data.get('business_name') or '').strip()
    industry = (request.data.get('industry') or '').strip()
    what_you_do = (request.data.get('what_you_do') or '').strip()
    tone = (request.data.get('tone') or 'friendly, professional').strip()
    no_go = request.data.get('no_go_topics') or []
    if not biz:
        return Response({'error': 'business_name is required'}, status=400)

    prompt = (
        f'Write a system prompt (persona) for a WhatsApp customer-service AI agent.\n\n'
        f'Business name: {biz}\n'
        + (f'Industry: {industry}\n' if industry else '')
        + (f'What they do: {what_you_do}\n' if what_you_do else '')
        + f'Tone: {tone}\n'
        + (f'No-go topics: {", ".join(no_go)}\n' if no_go else '')
        + '\n'
        'Constraints:\n'
        '  • Maximum 130 words.\n'
        '  • Tell the AI what role it plays, who it talks to, and how to behave.\n'
        '  • Tell the AI to keep replies under 80 words.\n'
        '  • Tell the AI to suggest a human agent when it is unsure or when the\n'
        '    user asks for medical/legal/financial advice.\n'
        '  • Do not start with "You are" — that is implied.\n'
        '  • Output PLAIN TEXT only — no preamble, no quotes, no markdown.'
    )

    from .models import Client
    client = Client.objects.filter(pk=client_id).first() if client_id else None
    ai = AIClient(client=client, user=request.user, feature='ctwa_persona_builder')
    try:
        persona = ai.complete(
            prompt=prompt,
            system='You write concise, no-fluff system prompts for customer-service AIs.',
            max_tokens=300, temperature=0.5, fast=True,
            use_cache=False,
        ).strip().strip('"').strip()
    except Exception as e:  # noqa: BLE001
        return Response({'error': f'AI call failed: {e}'}, status=502)

    return Response({'persona': persona})
