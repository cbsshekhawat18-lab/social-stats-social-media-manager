# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: AI analysis of one competitor's snapshot data.

Inputs:
    competitor_name:    string
    platform:           platform slug
    snapshots:          list of CompetitorSnapshot dicts (followers, post_count, engagement, taken_at)
    our_snapshot:       optional dict with the client's matching numbers for comparison

Output JSON:
    {
      "strengths":               ["..."],
      "weaknesses":              ["..."],
      "content_themes":          ["..."],
      "posting_patterns":        "1-2 sentence description",
      "recommendations_for_us":  ["actionable next step"]
    }
"""
import json


def build_prompt(*,
                 competitor_name: str,
                 platform: str = '',
                 snapshots: list[dict] | None = None,
                 our_snapshot: dict | None = None,
                 language: str = 'English') -> dict:
    snaps = json.dumps(snapshots or [], indent=2, default=str)[:15000]
    ours  = json.dumps(our_snapshot or {}, indent=2, default=str)[:5000]

    system = (
        'You are a competitor-intel analyst. You compare a competitor\'s '
        'social-media snapshots to our own and extract actionable lessons. '
        'Be specific — "they post 3x per week, we post 7x" beats "they post often". '
        'Never speculate about internal team size, budgets, or strategy beyond what the '
        'public data supports. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'COMPETITOR: {competitor_name}\n'
        f'PLATFORM: {platform}\n\n'
        f'COMPETITOR SNAPSHOTS:\n{snaps}\n\n'
        f'OUR SNAPSHOT (for comparison):\n{ours}\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "strengths":              ["3-5 things the competitor does well"],\n'
        '  "weaknesses":             ["3-5 areas where we beat them"],\n'
        '  "content_themes":         ["the topics they post about"],\n'
        '  "posting_patterns":       "1-2 sentence description of cadence + format",\n'
        '  "recommendations_for_us": ["actionable steps to apply to our channel"]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1500,
        'temperature':  0.4,
        'model':        None,
        'use_cache':    True,
    }
