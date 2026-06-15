# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: suggest 3 reply candidates (different tones) for an inbound message.

Inputs:
    message:        the inbound message text
    platform:       'whatsapp' | 'instagram' | 'facebook' | 'linkedin' | 'youtube' | ...
    conversation_history: list of {role: 'customer'|'agent', text}  (optional, last 6 messages)
    sender_name:    optional first name of customer
    business_name:  the brand/company replying
    intent:         pre-classified intent ('question' | 'complaint' | ...) — optional
    sentiment:      pre-classified sentiment ('positive'|'negative'|'neutral') — optional
    brand_voice:    formatted brand-voice context (optional)

Output:
    JSON: {
      suggestions: [
        {tone, text, length, recommended (bool)}
      ],
      summary: "one-line description of the customer's intent"
    }
"""
from . import _brand_voice_block


def build_prompt(*,
                 message: str,
                 platform: str = 'whatsapp',
                 conversation_history: list | None = None,
                 sender_name: str = '',
                 business_name: str = '',
                 intent: str = '',
                 sentiment: str = '',
                 brand_voice: str = '',
                 extra_notes: str = '') -> dict:
    history_block = ''
    if conversation_history:
        lines = []
        for m in conversation_history[-6:]:
            role = m.get('role', 'customer')
            text = m.get('text', '') or ''
            lines.append(f'{role.upper()}: {text}')
        history_block = '\nRecent conversation:\n' + '\n'.join(lines) + '\n'

    sender_label = f' from {sender_name}' if sender_name else ''
    sentiment_hint = f'Customer sentiment: {sentiment}.\n' if sentiment else ''
    intent_hint    = f'Customer intent: {intent}.\n' if intent else ''
    biz = business_name or 'the business'

    system = (
        f'You are the customer-support voice of {biz}. '
        'Generate three concise reply options for an inbound message — '
        'one professional, one friendly, one empathetic. '
        'Each should be ready-to-send: no placeholders, no "[insert name]" gaps. '
        'Keep replies tight (1-3 sentences for chat platforms, up to 5 for email). '
        'Recommend whichever best fits the message. '
        'Return ONLY valid JSON.'
    )
    system += _brand_voice_block(brand_voice)

    user = (
        f'Inbound {platform} message{sender_label}:\n'
        f'"""\n{message}\n"""\n'
        f'{sentiment_hint}{intent_hint}{history_block}'
    )
    if extra_notes:
        user += f'\nAdditional context: {extra_notes}\n'

    user += (
        '\nRespond with this exact JSON shape:\n'
        '{\n'
        '  "suggestions": [\n'
        '    {"tone": "professional", "text": "...", "length": 0, "recommended": false},\n'
        '    {"tone": "friendly",     "text": "...", "length": 0, "recommended": true },\n'
        '    {"tone": "empathetic",   "text": "...", "length": 0, "recommended": false}\n'
        '  ],\n'
        '  "summary": "one-line description of the customer\'s intent"\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1024,
        'temperature':  0.6,
        'model':        None,
        'use_cache':    True,
    }
