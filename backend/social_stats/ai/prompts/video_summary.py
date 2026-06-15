# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: summarise a video from its transcript.

Inputs:
    transcript:  the transcript text
    language:    output language

Output JSON:
    {
      "summary":                "2-3 sentence overview",
      "key_points":             ["...", "..."],
      "suggested_thumbnail_text":"3-6 word overlay",
      "suggested_title":        "punchy title",
      "estimated_watch_time_seconds": 0
    }
"""


def build_prompt(*, transcript: str, language: str = 'English') -> dict:
    system = (
        'You are a video producer extracting the spine of a video from its '
        'transcript. You write thumbnail-friendly text, click-worthy titles '
        'that match the content, and a TL;DR a marketing manager could paste '
        'into a Slack message. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'TRANSCRIPT:\n"""\n{transcript}\n"""\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "summary": "2-3 sentence overview",\n'
        '  "key_points": ["five to seven concrete bullet points"],\n'
        '  "suggested_thumbnail_text": "3-6 words of bold overlay text",\n'
        '  "suggested_title": "punchy title (max 60 chars)",\n'
        '  "estimated_watch_time_seconds": 0\n'
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
