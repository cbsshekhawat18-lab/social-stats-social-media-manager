# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: recommend the best time(s) to post on a platform.

Combines the client's historical engagement data with AI reasoning. The
caller pre-aggregates PostMetric data into a per-day/per-hour map and
passes it as `historical_engagement`; this prompt asks Claude to pick
top slots and explain why.

Inputs:
    platform:        'instagram' | 'facebook' | ...
    content_type:    'image' | 'video' | 'carousel' | 'story' | 'reel' | 'general'
    target_audience: optional persona description
    timezone:        IANA tz id (e.g. 'Asia/Kolkata') so suggestions are TZ-aware
    historical_engagement: dict like {'Monday': {9: 0.72, 14: 0.81, ...}, ...}
                           values are normalised engagement scores 0-1
    top_n:           number of recommendations (default 5)

Output JSON:
    {
      "recommendations": [
        {"day": "Monday", "hour": 14,
         "expected_engagement_score": 0.0..1.0,
         "reason": "..."}
      ]
    }
"""
import json


def build_prompt(*,
                 platform: str = 'instagram',
                 content_type: str = 'general',
                 target_audience: str = '',
                 timezone: str = 'UTC',
                 historical_engagement: dict | None = None,
                 top_n: int = 5) -> dict:

    history_block = ''
    if historical_engagement:
        try:
            history_block = (
                '\nHISTORICAL ENGAGEMENT (normalised 0-1):\n'
                + json.dumps(historical_engagement, indent=2)[:2000]
                + '\n'
            )
        except Exception:
            history_block = ''

    system = (
        'You are a social-media timing strategist. You recommend optimal '
        'posting slots based on historical engagement patterns and platform '
        'audience habits. Return realistic, actionable time slots — never '
        'recommend the same hour twice unless the data strongly supports it. '
        f'Suggestions should be in the {timezone} timezone. '
        'Return ONLY valid JSON.'
    )

    audience_block = f'TARGET AUDIENCE: {target_audience}\n' if target_audience else ''

    user = (
        f'PLATFORM: {platform}\n'
        f'CONTENT TYPE: {content_type}\n'
        f'TIMEZONE: {timezone}\n'
        f'{audience_block}{history_block}\n'
        f'Recommend the top {top_n} time slots. Each slot must include:\n'
        '- day: full weekday name\n'
        '- hour: 0-23\n'
        '- expected_engagement_score: 0.0-1.0\n'
        '- reason: one-sentence explanation tied to the data or platform norms\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "recommendations": [\n'
        '    {"day": "Tuesday", "hour": 19,\n'
        '     "expected_engagement_score": 0.0,\n'
        '     "reason": "..."}\n'
        '  ]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1024,
        'temperature':  0.4,
        'model':        None,
        'use_cache':    True,
    }
