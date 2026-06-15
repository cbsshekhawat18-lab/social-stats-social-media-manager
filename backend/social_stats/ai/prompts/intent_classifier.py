# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: classify user intent + suggest a routing action.

Used as a fast pre-filter for inbox messages — drives automation rules and
escalation logic. Designed for Haiku (fast + cheap, deterministic).

Inputs:
    text:     the message to classify
    platform: optional platform context (helps with slang)
    business_context: optional one-line business description

Output JSON:
    {
      "intent":          "question | complaint | praise | sales_inquiry | support | spam | feedback | other",
      "confidence":      0.0..1.0,
      "suggested_action":"reply_human | reply_template | route_sales | route_support | escalate | dismiss",
      "rationale":       "one-line explanation"
    }
"""

ALLOWED_INTENTS = [
    'question', 'complaint', 'praise', 'sales_inquiry', 'support',
    'spam', 'feedback', 'other',
]
ALLOWED_ACTIONS = [
    'reply_human', 'reply_template', 'route_sales', 'route_support',
    'escalate', 'dismiss',
]


def build_prompt(*, text: str, platform: str = '', business_context: str = '') -> dict:
    system = (
        'You are a precise customer-message intent classifier. Read the '
        'message carefully and decide the single best intent. Suggest the '
        'routing action that would help the team respond fastest. '
        'Be conservative: prefer "reply_human" for ambiguous messages and '
        '"escalate" for hostile / legal / refund-threat tones. '
        'Return ONLY valid JSON.'
    )

    plat_block = f'PLATFORM: {platform}\n' if platform else ''
    biz_block  = f'BUSINESS CONTEXT: {business_context}\n' if business_context else ''

    user = (
        f'{plat_block}{biz_block}'
        f'MESSAGE:\n"""\n{text}\n"""\n\n'
        'Respond with this exact JSON shape (use lowercase enum values):\n'
        '{\n'
        f'  "intent":           "<one of: {"|".join(ALLOWED_INTENTS)}>",\n'
        '  "confidence":       0.0,\n'
        f'  "suggested_action": "<one of: {"|".join(ALLOWED_ACTIONS)}>",\n'
        '  "rationale":        "one-line why"\n'
        '}'
    )
    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   200,
        'temperature':  0.0,
        'model':        None,
        'use_cache':    True,
    }


def coerce_result(raw: dict) -> dict:
    def pick(value, allowed, fallback):
        v = (value or '').strip().lower() if isinstance(value, str) else ''
        return v if v in allowed else fallback

    return {
        'intent':           pick(raw.get('intent'),           ALLOWED_INTENTS, 'other'),
        'confidence':       max(0.0, min(1.0, float(raw.get('confidence', 0.5) or 0.5))),
        'suggested_action': pick(raw.get('suggested_action'), ALLOWED_ACTIONS, 'reply_human'),
        'rationale':        str(raw.get('rationale') or '')[:500],
    }
