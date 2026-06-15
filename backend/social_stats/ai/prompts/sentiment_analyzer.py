# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: analyse sentiment + emotion + urgency + intent of one message.

Designed to run on Haiku for speed and cost. Returns a compact JSON block
suitable for tagging inbox messages or driving automation rules.

Inputs:
    message: the text to analyse
    platform: optional platform context (helps with slang)
    business_context: optional one-line description of the business

Output:
    JSON: {
        sentiment: 'positive' | 'neutral' | 'negative' | 'mixed',
        emotion: 'happy' | 'frustrated' | 'angry' | 'curious' | 'sad' | 'neutral' | 'excited' | 'confused',
        urgency: 'low' | 'medium' | 'high' | 'critical',
        intent: 'question' | 'complaint' | 'praise' | 'sales_inquiry' | 'support' | 'spam' | 'other',
        requires_human: bool,
        key_topics: ['list', 'of', 'topics'],
        confidence: 0.0..1.0,
    }
"""

ALLOWED_SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed']
ALLOWED_EMOTIONS   = ['happy', 'frustrated', 'angry', 'curious', 'sad', 'neutral', 'excited', 'confused']
ALLOWED_URGENCY    = ['low', 'medium', 'high', 'critical']
ALLOWED_INTENTS    = ['question', 'complaint', 'praise', 'sales_inquiry', 'support', 'spam', 'other']


def build_prompt(*,
                 message: str,
                 platform: str = '',
                 business_context: str = '') -> dict:

    system = (
        'You are a precise sentiment-and-intent classifier for customer messages. '
        'Read the message carefully. Detect sentiment, emotion, urgency, intent, '
        'and whether a human response is recommended. Be conservative on "critical" '
        'urgency — reserve it for clear emergencies, payment issues, or angry-public '
        'complaints. '
        'Return ONLY valid JSON, no prose, no markdown.'
    )

    platform_block = f'PLATFORM: {platform}\n' if platform else ''
    business_block = f'BUSINESS CONTEXT: {business_context}\n' if business_context else ''

    user = (
        f'{platform_block}{business_block}'
        f'Customer message:\n"""\n{message}\n"""\n\n'
        'Respond with this exact JSON shape (use lowercase enum values):\n'
        '{\n'
        f'  "sentiment": "<one of: {"|".join(ALLOWED_SENTIMENTS)}>",\n'
        f'  "emotion":   "<one of: {"|".join(ALLOWED_EMOTIONS)}>",\n'
        f'  "urgency":   "<one of: {"|".join(ALLOWED_URGENCY)}>",\n'
        f'  "intent":    "<one of: {"|".join(ALLOWED_INTENTS)}>",\n'
        '  "requires_human": true|false,\n'
        '  "key_topics": ["topic1", "topic2"],\n'
        '  "confidence": 0.0\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   300,
        'temperature':  0.0,   # deterministic classification
        'model':        None,  # AIClient.classify uses fast=True (Haiku)
        'use_cache':    True,
    }


def coerce_result(raw: dict) -> dict:
    """Sanity-check + pin enum values inside known sets. Use after extract_json."""
    def pick(value, allowed, fallback):
        v = (value or '').strip().lower() if isinstance(value, str) else ''
        return v if v in allowed else fallback

    return {
        'sentiment':      pick(raw.get('sentiment'),      ALLOWED_SENTIMENTS, 'neutral'),
        'emotion':        pick(raw.get('emotion'),        ALLOWED_EMOTIONS,   'neutral'),
        'urgency':        pick(raw.get('urgency'),        ALLOWED_URGENCY,    'low'),
        'intent':         pick(raw.get('intent'),         ALLOWED_INTENTS,    'other'),
        'requires_human': bool(raw.get('requires_human', False)),
        'key_topics':     list(raw.get('key_topics') or [])[:8],
        'confidence':     max(0.0, min(1.0, float(raw.get('confidence', 0.5) or 0.5))),
    }
