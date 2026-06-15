# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: write a full executive-style performance report.

Inputs:
    metrics_snapshot:  pre-aggregated dict (per-platform totals + top posts)
    business_name:     client name
    period_label:      "weekly" | "monthly" | "quarterly" | "campaign"
    period_start:      ISO date
    period_end:        ISO date
    insights:          optional list of AI insights from the same window
    industry:          optional industry tag for industry-aware framing

Output JSON:
    {
      "title":             "string",
      "executive_summary": "2-3 paragraph TL;DR",
      "sections": [
        {
          "heading":         "Performance overview",
          "content":         "1-3 paragraph prose",
          "callout_metrics": [{"label": "...", "value": "..."}],
          "key_takeaway":    "single sentence highlight"
        }
      ],
      "key_metrics": [{"label": "...", "value": "...", "trend": "+12%"}],
      "recommendations": ["concrete next-step", "another"],
      "footer_note": "optional disclaimer"
    }
"""
import json


def build_prompt(*,
                 metrics_snapshot: dict,
                 business_name: str = '',
                 period_label: str = 'weekly',
                 period_start: str = '',
                 period_end: str = '',
                 insights: list[dict] | None = None,
                 industry: str = '',
                 language: str = 'English') -> dict:
    snap = json.dumps(metrics_snapshot or {}, indent=2, default=str)[:25000]
    ins  = json.dumps(insights or [], indent=2, default=str)[:8000]
    biz  = f'BUSINESS: {business_name}\n' if business_name else ''
    ind  = f'INDUSTRY: {industry}\n' if industry else ''

    system = (
        'You are a senior agency analyst writing an executive-style report '
        'for a client. Your audience reads dozens of these — be concise, '
        'concrete, and specific. Cite real numbers from the data; never '
        'invent. Lead with what changed and why it matters. End every '
        'section with one actionable takeaway. Avoid jargon. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'{biz}{ind}'
        f'PERIOD: {period_label} ({period_start} to {period_end})\n\n'
        f'METRICS SNAPSHOT:\n{snap}\n\n'
        f'AI INSIGHTS (optional context):\n{ins}\n\n'
        'Write a polished executive report with 4-6 sections. Suggested '
        'sections: Performance overview, What worked, What did not, Audience '
        'and engagement, Competitive context (only if data supports), Outlook + '
        'recommendations.\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "title": "string",\n'
        '  "executive_summary": "2-3 paragraph TL;DR",\n'
        '  "sections": [\n'
        '    {\n'
        '      "heading": "section title",\n'
        '      "content": "1-3 paragraph prose with concrete numbers",\n'
        '      "callout_metrics": [{"label": "...", "value": "..."}],\n'
        '      "key_takeaway": "one sentence highlight"\n'
        '    }\n'
        '  ],\n'
        '  "key_metrics": [{"label": "Followers", "value": "12,540", "trend": "+8.2%"}],\n'
        '  "recommendations": ["concrete next step", "another"],\n'
        '  "footer_note": "optional disclaimer"\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   4000,
        'temperature':  0.4,
        'model':        None,
        'use_cache':    False,
    }


def coerce_result(raw: dict) -> dict:
    """Defensive shape-pin so the UI can always render something."""
    if not isinstance(raw, dict):
        raw = {}

    def _str(v, max_len=4000):
        return str(v or '')[:max_len]

    sections = []
    for s in (raw.get('sections') or [])[:10]:
        if not isinstance(s, dict):
            continue
        sections.append({
            'heading':         _str(s.get('heading'), 200),
            'content':         _str(s.get('content'), 4000),
            'callout_metrics': [
                {'label': _str(c.get('label'), 80), 'value': _str(c.get('value'), 80)}
                for c in (s.get('callout_metrics') or [])[:6]
                if isinstance(c, dict)
            ],
            'key_takeaway':    _str(s.get('key_takeaway'), 500),
        })

    return {
        'title':             _str(raw.get('title'), 200) or 'Performance report',
        'executive_summary': _str(raw.get('executive_summary'), 4000),
        'sections':          sections,
        'key_metrics': [
            {
                'label': _str(m.get('label'), 80),
                'value': _str(m.get('value'), 80),
                'trend': _str(m.get('trend'), 30),
            }
            for m in (raw.get('key_metrics') or [])[:8]
            if isinstance(m, dict)
        ],
        'recommendations': [_str(r, 500) for r in (raw.get('recommendations') or [])][:8],
        'footer_note':     _str(raw.get('footer_note'), 1000),
    }
