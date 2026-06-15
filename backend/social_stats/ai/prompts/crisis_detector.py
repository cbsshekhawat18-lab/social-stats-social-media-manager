# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: scan a batch of recent inbound messages/comments for PR-crisis signals.

Designed to run on a Celery task (daily/hourly). Looks for clusters of
negativity, threat language, regulatory red flags, viral-grievance patterns.

Inputs:
    messages: list of {text, platform, posted_at, author_handle?, post_id?}
              (typically last 24-72 hours of inbound chatter)
    business_name: optional context

Output JSON:
    {
      "crisis_detected":     true | false,
      "severity":            "low | medium | high | critical",
      "signals":             [{"category": "...", "evidence": "...", "examples": ["..."]}],
      "affected_post_ids":   ["..."],
      "recommended_action":  "monitor | acknowledge | escalate | issue_statement",
      "summary":             "1-2 sentence overview for ops"
    }
"""
import json

ALLOWED_SEVERITY = ['low', 'medium', 'high', 'critical']
ALLOWED_ACTIONS  = ['monitor', 'acknowledge', 'escalate', 'issue_statement']


def build_prompt(*,
                 messages: list[dict],
                 business_name: str = '',
                 language: str = 'English') -> dict:
    # Cap the payload — never send more than ~120 messages to keep prompts bounded
    capped = (messages or [])[:120]

    try:
        msg_block = json.dumps(capped, indent=2, default=str)[:30000]
    except Exception:
        msg_block = '(could not serialise messages)'

    biz_block = f'BUSINESS: {business_name}\n' if business_name else ''

    system = (
        'You are a senior brand-safety analyst. Scan a batch of recent '
        'inbound messages and identify whether the company faces a '
        'developing PR crisis. Look for: clusters of complaints about the '
        'same issue, viral-grievance patterns (multiple users repeating a '
        'narrative), threat / legal language, regulatory red flags, sudden '
        'sentiment shifts. '
        '\n\nGrade severity conservatively:\n'
        '  - low:      isolated negative messages, no theme\n'
        '  - medium:   3+ messages on the same theme within 24h\n'
        '  - high:     trending narrative + emotional escalation\n'
        '  - critical: legal threats, safety claims, or coordinated attack\n\n'
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'{biz_block}'
        f'RECENT MESSAGES:\n{msg_block}\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "crisis_detected": true,\n'
        f'  "severity": "<one of: {"|".join(ALLOWED_SEVERITY)}>",\n'
        '  "signals": [\n'
        '    {"category": "complaint cluster | threat | regulatory | viral | sentiment_shift",\n'
        '     "evidence": "what you observed", "examples": ["<= 3 example excerpts"]}\n'
        '  ],\n'
        '  "affected_post_ids": ["..."],\n'
        f'  "recommended_action": "<one of: {"|".join(ALLOWED_ACTIONS)}>",\n'
        '  "summary": "1-2 sentence overview"\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1200,
        'temperature':  0.2,
        'model':        None,
        'use_cache':    False,   # input includes time-bound batches; do not cache
    }


def coerce_result(raw: dict) -> dict:
    def pick(value, allowed, fallback):
        v = (value or '').strip().lower() if isinstance(value, str) else ''
        return v if v in allowed else fallback

    return {
        'crisis_detected':    bool(raw.get('crisis_detected', False)),
        'severity':           pick(raw.get('severity'), ALLOWED_SEVERITY, 'low'),
        'signals':            list(raw.get('signals') or [])[:8],
        'affected_post_ids':  [str(x) for x in (raw.get('affected_post_ids') or [])][:20],
        'recommended_action': pick(raw.get('recommended_action'), ALLOWED_ACTIONS, 'monitor'),
        'summary':            str(raw.get('summary') or '')[:500],
    }
