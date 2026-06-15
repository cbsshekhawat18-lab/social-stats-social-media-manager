# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: produce short narrative paragraphs that explain dashboard data
"in English". Renders as 'What this data means' callouts beside charts.

Differs from report_writer (which produces a long structured doc): this
template returns just 2-4 short paragraphs.

Inputs:
    metrics_snapshot:  pre-aggregated dict
    chart_focus:       optional — which chart this narrative accompanies
                       e.g. "engagement_over_time", "platform_compare"
    business_name:     client name
    paragraphs:        target count (default 3)

Output JSON:
    {"paragraphs": ["string", "string"], "highlights": ["bullet", "bullet"]}
"""
import json


def build_prompt(*,
                 metrics_snapshot: dict,
                 chart_focus: str = '',
                 business_name: str = '',
                 paragraphs: int = 3,
                 language: str = 'English') -> dict:
    snap = json.dumps(metrics_snapshot or {}, indent=2, default=str)[:15000]
    biz  = f'BUSINESS: {business_name}\n' if business_name else ''
    chart_block = f'CHART FOCUS: {chart_focus}\n' if chart_focus else ''
    paragraphs = max(1, min(paragraphs, 5))

    system = (
        'You are a numbers-first analyst writing two-sentence-long narrative '
        'paragraphs that sit next to charts in a marketing dashboard. Your '
        'job is to translate numbers into plain language. Lead each '
        'paragraph with the headline number. End with what it means or '
        'what to do next. '
        'Be brutally concise — no fluff, no caveats unless they actually matter. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'{biz}{chart_block}'
        f'METRICS SNAPSHOT:\n{snap}\n\n'
        f'Generate exactly {paragraphs} paragraphs (each 2-3 sentences) plus '
        'up to 5 single-sentence highlights for a callout box.\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "paragraphs": ["paragraph 1", "paragraph 2"],\n'
        '  "highlights": ["one-line highlight", "one-line highlight"]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1500,
        'temperature':  0.3,
        'model':        None,
        'use_cache':    True,
    }


def coerce_result(raw: dict) -> dict:
    if not isinstance(raw, dict):
        return {'paragraphs': [], 'highlights': []}
    return {
        'paragraphs': [str(p)[:1500] for p in (raw.get('paragraphs') or [])][:5],
        'highlights': [str(h)[:300]  for h in (raw.get('highlights') or [])][:6],
    }
