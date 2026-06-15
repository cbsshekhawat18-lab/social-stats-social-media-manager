# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: short-horizon forecast of a metric.

This is NOT a substitute for a real time-series model — it asks Claude to
extrapolate a recent series with rough confidence intervals + assumptions.
Use sparingly; surface the assumption list so the user can sanity-check.

Inputs:
    metric:        e.g. "engagement_total" | "followers" | "reach"
    series:        list of {date, value} ordered chronologically (≥14 points recommended)
    horizon_days:  how many days to forecast (default 7, max 30)

Output JSON:
    {
      "forecast": [
        {"date": "YYYY-MM-DD", "predicted_value": 0, "confidence_low": 0, "confidence_high": 0}
      ],
      "assumptions": ["..."],
      "caveats":     ["..."]
    }
"""
import json


def build_prompt(*,
                 metric: str,
                 series: list[dict],
                 horizon_days: int = 7,
                 language: str = 'English') -> dict:
    horizon_days = max(1, min(horizon_days, 30))
    series_block = json.dumps(series or [], indent=2, default=str)[:15000]

    system = (
        'You are a careful forecaster. Read the recent time series and '
        'project the metric forward by the requested horizon. Use simple '
        'methods: trend + seasonality, not deep modelling. Always provide '
        '~80% confidence bands and the assumptions you made (e.g. "assumed '
        'no major posts" / "assumed Tuesday weekly seasonality"). Add '
        'caveats when the series is too short or noisy to forecast reliably. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'METRIC: {metric}\n'
        f'HORIZON: {horizon_days} days\n'
        f'SERIES (date, value):\n{series_block}\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "forecast": [\n'
        '    {"date": "YYYY-MM-DD", "predicted_value": 0,\n'
        '     "confidence_low": 0, "confidence_high": 0}\n'
        '  ],\n'
        '  "assumptions": ["assumption you made"],\n'
        '  "caveats":     ["caveat the user should know"]\n'
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
    if not isinstance(raw, dict):
        return {'forecast': [], 'assumptions': [], 'caveats': []}
    return {
        'forecast': [
            {
                'date':            str(p.get('date') or '')[:30],
                'predicted_value': float(p.get('predicted_value', 0) or 0),
                'confidence_low':  float(p.get('confidence_low', 0) or 0),
                'confidence_high': float(p.get('confidence_high', 0) or 0),
            }
            for p in (raw.get('forecast') or [])[:60]
            if isinstance(p, dict)
        ],
        'assumptions': [str(a)[:300] for a in (raw.get('assumptions') or [])][:10],
        'caveats':     [str(c)[:300] for c in (raw.get('caveats')     or [])][:10],
    }
