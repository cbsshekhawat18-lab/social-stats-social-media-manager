# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: classify a single message as spam vs legitimate.

Fast Haiku-grade classifier. Used inline to filter inbox / comments /
DMs before they reach the human queue.

Inputs:
    text:            the message
    sender_metadata: optional dict with sender handle, follower count, age etc.

Output JSON:
    {
      "is_spam":    true | false,
      "confidence": 0.0..1.0,
      "category":   "promo | scam | bot | repost | irrelevant | clean",
      "reason":     "one-line explanation"
    }
"""
import json

ALLOWED_CATEGORIES = ['promo', 'scam', 'bot', 'repost', 'irrelevant', 'clean']


def build_prompt(*, text: str, sender_metadata: dict | None = None) -> dict:
    sender_block = ''
    if sender_metadata:
        try:
            sender_block = (
                'SENDER METADATA:\n'
                + json.dumps(sender_metadata, indent=2, default=str)[:1000]
                + '\n'
            )
        except Exception:
            sender_block = ''

    system = (
        'You are a precise spam classifier for an agency\'s inbox. Be specific: '
        'mark as spam ONLY when you are confident. Legitimate criticism, weird '
        'phrasing, or low effort do NOT count as spam. '
        '\n\nCategories:\n'
        '  - promo:      unsolicited promotional message from another business\n'
        '  - scam:       phishing, fake giveaway, impersonation\n'
        '  - bot:        clearly automated / templated\n'
        '  - repost:     near-duplicate of another inbound (suspicious chain)\n'
        '  - irrelevant: off-topic for this business (e.g. crypto pitch on a hospital page)\n'
        '  - clean:      legitimate (set is_spam=false)\n\n'
        'Return ONLY valid JSON.'
    )

    user = (
        f'{sender_block}'
        f'MESSAGE:\n"""\n{text}\n"""\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "is_spam": true|false,\n'
        '  "confidence": 0.0,\n'
        f'  "category": "<one of: {"|".join(ALLOWED_CATEGORIES)}>",\n'
        '  "reason": "one-line why"\n'
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
        'is_spam':    bool(raw.get('is_spam', False)),
        'confidence': max(0.0, min(1.0, float(raw.get('confidence', 0.5) or 0.5))),
        'category':   pick(raw.get('category'), ALLOWED_CATEGORIES, 'clean'),
        'reason':     str(raw.get('reason') or '')[:300],
    }
