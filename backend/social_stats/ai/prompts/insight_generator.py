# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: produce a feed of actionable insights from a client's recent metrics.

Used by /ai/v2/insight-generate. The caller pre-aggregates PostMetric data
into a compact JSON snapshot and passes it as `metrics_snapshot`.

Inputs:
    metrics_snapshot:  dict — see _build_metrics_snapshot() in insights_views
    business_name:     optional context
    focus_area:        optional ("engagement" | "growth" | "content_mix" | "any")

Output JSON:
    {
      "insights": [
        {
          "title":            "short headline (5-8 words)",
          "description":      "2-3 sentence explanation",
          "insight_type":     "engagement_trend | best_time_shift | content_mix |
                               competitor_alert | platform_underperform | growth | other",
          "severity":         "low | medium | high | critical",
          "confidence":       0.0..1.0,
          "data_evidence":    "concrete numbers or comparisons",
          "action_recommended": "next step the user can take"
        }
      ]
    }
"""
import json

ALLOWED_TYPES    = [
    'engagement_trend', 'best_time_shift', 'content_mix',
    'competitor_alert', 'platform_underperform', 'growth', 'other',
]
ALLOWED_SEVERITY = ['low', 'medium', 'high', 'critical']


def build_prompt(*,
                 metrics_snapshot: dict,
                 business_name: str = '',
                 focus_area: str = 'any',
                 max_insights: int = 5,
                 language: str = 'English') -> dict:
    snap = json.dumps(metrics_snapshot or {}, indent=2, default=str)[:30000]
    biz = f'BUSINESS: {business_name}\n' if business_name else ''
    focus = f'FOCUS: {focus_area}\n' if focus_area and focus_area != 'any' else ''

    system = (
        'You are a senior social-media strategist. You read a client\'s recent '
        'performance metrics and surface 3-5 specific, actionable insights. '
        '\n\nGrounding rules:\n'
        '  - Cite real numbers from the data — never invent.\n'
        '  - Say "I cannot tell from this data" rather than guess.\n'
        '  - Insights should be ranked by usefulness — bury the trivial ones.\n'
        '  - Each insight needs a concrete recommended action.\n\n'
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'{biz}{focus}\n'
        f'METRICS SNAPSHOT (last 30/7 days, per-platform aggregates + top posts):\n'
        f'{snap}\n\n'
        f'Generate up to {max_insights} insights.\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "insights": [\n'
        '    {\n'
        '      "title": "5-8 word headline",\n'
        '      "description": "2-3 sentence body",\n'
        f'      "insight_type": "<one of: {"|".join(ALLOWED_TYPES)}>",\n'
        f'      "severity": "<one of: {"|".join(ALLOWED_SEVERITY)}>",\n'
        '      "confidence": 0.0,\n'
        '      "data_evidence": "concrete numbers from the snapshot",\n'
        '      "action_recommended": "one concrete next step"\n'
        '    }\n'
        '  ]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   2048,
        'temperature':  0.3,
        'model':        None,
        'use_cache':    False,
    }


def coerce_result(raw: dict, max_insights: int = 5) -> list[dict]:
    items = raw.get('insights') if isinstance(raw, dict) else []
    if not isinstance(items, list):
        return []

    def pick(value, allowed, fallback):
        v = (value or '').strip().lower() if isinstance(value, str) else ''
        return v if v in allowed else fallback

    out = []
    for it in items[:max_insights]:
        if not isinstance(it, dict):
            continue
        out.append({
            'title':              str(it.get('title') or '')[:200],
            'description':        str(it.get('description') or '')[:2000],
            'insight_type':       pick(it.get('insight_type'), ALLOWED_TYPES,    'other'),
            'severity':           pick(it.get('severity'),     ALLOWED_SEVERITY, 'medium'),
            'confidence':         max(0.0, min(1.0, float(it.get('confidence', 0.5) or 0.5))),
            'data_evidence':      str(it.get('data_evidence') or '')[:1000],
            'action_recommended': str(it.get('action_recommended') or '')[:1000],
        })
    return out
