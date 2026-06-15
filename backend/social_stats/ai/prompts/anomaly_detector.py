# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: identify anomalies in a metric time series.

Inputs:
    metric:    e.g. "engagement_total" | "reach" | "followers"
    series:    list of {date, value} ordered chronologically
    baseline_window_days: how many days to use as baseline (default 28)

Output JSON:
    {
      "anomalies": [
        {"date": "YYYY-MM-DD", "value": 0, "expected": 0,
         "deviation_pct": 0.0, "severity": "low|medium|high",
         "possible_causes": ["..."]}
      ],
      "summary": "1-line overview"
    }
"""
import json

ALLOWED_SEVERITY = ['low', 'medium', 'high']


def build_prompt(*,
                 metric: str,
                 series: list[dict],
                 baseline_window_days: int = 28,
                 language: str = 'English') -> dict:
    series_block = json.dumps(series or [], indent=2, default=str)[:20000]

    system = (
        'You are a quantitative analyst. You spot anomalies in time-series '
        'data and explain them in plain English. '
        f'Use the most recent {baseline_window_days} days (excluding the '
        'point being scored) as the rolling baseline. Flag a point as '
        'anomalous if it deviates more than 2 standard deviations from the '
        'baseline mean. Suggest plausible causes — never invent specifics. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'METRIC: {metric}\n'
        f'SERIES (date, value):\n{series_block}\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "anomalies": [\n'
        '    {"date": "YYYY-MM-DD", "value": 0, "expected": 0,\n'
        '     "deviation_pct": 0.0, "severity": "low|medium|high",\n'
        '     "possible_causes": ["best-guess explanation"]}\n'
        '  ],\n'
        '  "summary": "one-line overview"\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1500,
        'temperature':  0.2,
        'model':        None,
        'use_cache':    False,
    }


def coerce_result(raw: dict) -> dict:
    out = {
        'anomalies': [],
        'summary':   str(raw.get('summary') or '')[:500] if isinstance(raw, dict) else '',
    }
    if not isinstance(raw, dict):
        return out
    for a in (raw.get('anomalies') or [])[:30]:
        if not isinstance(a, dict):
            continue
        sev = a.get('severity') or ''
        sev = sev.strip().lower() if isinstance(sev, str) else ''
        out['anomalies'].append({
            'date':            str(a.get('date') or '')[:30],
            'value':           float(a.get('value', 0) or 0),
            'expected':        float(a.get('expected', 0) or 0),
            'deviation_pct':   float(a.get('deviation_pct', 0) or 0),
            'severity':        sev if sev in ALLOWED_SEVERITY else 'low',
            'possible_causes': [str(c)[:200] for c in (a.get('possible_causes') or [])][:5],
        })
    return out
