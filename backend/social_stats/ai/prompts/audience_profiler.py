# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: build a rich audience profile from the client's data.

Inputs:
    client_summary:       dict with industry, country, follower counts, top posts
    metrics_snapshot:     pre-aggregated metrics
    business_name:        optional

Output JSON:
    {
      "persona_summary":     "2-3 sentence persona description",
      "demographics":        {"likely_age_range": "...", "likely_gender_skew": "...", "geo": "..."},
      "interests":           ["..."],
      "pain_points":         ["..."],
      "content_preferences": ["..."],
      "best_channels":       ["..."],
      "tone_recommendation": "1-line voice tip"
    }
"""
import json


def build_prompt(*,
                 client_summary: dict,
                 metrics_snapshot: dict | None = None,
                 business_name: str = '',
                 language: str = 'English') -> dict:
    summary = json.dumps(client_summary or {}, indent=2, default=str)[:6000]
    snap    = json.dumps(metrics_snapshot or {}, indent=2, default=str)[:12000]
    biz     = f'BUSINESS: {business_name}\n' if business_name else ''

    system = (
        'You are an audience strategist. You read top-performing content + '
        'engagement signals and infer who is engaging — their likely age '
        'range, interests, pain points, and what they want to see more of. '
        'Be honest about uncertainty: when the data does not let you '
        'estimate something, say so rather than fabricate. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'{biz}\n'
        f'CLIENT SUMMARY:\n{summary}\n\n'
        f'METRICS SNAPSHOT:\n{snap}\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "persona_summary": "2-3 sentence summary",\n'
        '  "demographics":    {"likely_age_range": "..", "likely_gender_skew": "..", "geo": ".."},\n'
        '  "interests":       ["3-6 specific interests"],\n'
        '  "pain_points":     ["3-5 problems this audience cares about"],\n'
        '  "content_preferences": ["formats / topics they engage with"],\n'
        '  "best_channels":   ["channels to prioritise based on the data"],\n'
        '  "tone_recommendation": "one-line voice tip for this audience"\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1800,
        'temperature':  0.4,
        'model':        None,
        'use_cache':    True,
    }
