# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: identify trends across a window of recent posts + metrics.

Inputs:
    metrics_snapshot:  pre-aggregated dict (per-platform totals + top posts)
    period_label:      free-form label e.g. "last 30 days"
    business_name:     optional

Output JSON:
    {
      "trends": [
        {"topic": "...", "direction": "up | down | flat",
         "magnitude": "small | moderate | large",
         "why": "1-2 sentence explanation"}
      ]
    }
"""
import json

ALLOWED_DIRECTION = ['up', 'down', 'flat']
ALLOWED_MAGNITUDE = ['small', 'moderate', 'large']


def build_prompt(*,
                 metrics_snapshot: dict,
                 period_label: str = 'last 30 days',
                 business_name: str = '',
                 language: str = 'English') -> dict:
    snap = json.dumps(metrics_snapshot or {}, indent=2, default=str)[:20000]
    biz = f'BUSINESS: {business_name}\n' if business_name else ''

    system = (
        'You are a content analyst. You identify trends in social-media '
        'performance — content themes, formats, time-of-day patterns, '
        'platform shifts. Stay grounded in the data and avoid sweeping '
        'claims that the snapshot does not support. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'{biz}'
        f'PERIOD: {period_label}\n\n'
        f'METRICS SNAPSHOT:\n{snap}\n\n'
        'Identify 3-6 trends. Respond with this exact JSON:\n'
        '{\n'
        '  "trends": [\n'
        '    {"topic": "what is trending",\n'
        f'     "direction": "<one of: {"|".join(ALLOWED_DIRECTION)}>",\n'
        f'     "magnitude": "<one of: {"|".join(ALLOWED_MAGNITUDE)}>",\n'
        '     "why": "1-2 sentence explanation tied to the data"}\n'
        '  ]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1500,
        'temperature':  0.3,
        'model':        None,
        'use_cache':    False,
    }


def coerce_result(raw: dict) -> list[dict]:
    if not isinstance(raw, dict):
        return []
    out = []
    for t in (raw.get('trends') or [])[:10]:
        if not isinstance(t, dict):
            continue
        d = (t.get('direction') or '').strip().lower()
        m = (t.get('magnitude') or '').strip().lower()
        out.append({
            'topic':     str(t.get('topic') or '')[:200],
            'direction': d if d in ALLOWED_DIRECTION else 'flat',
            'magnitude': m if m in ALLOWED_MAGNITUDE else 'small',
            'why':       str(t.get('why') or '')[:1000],
        })
    return out
