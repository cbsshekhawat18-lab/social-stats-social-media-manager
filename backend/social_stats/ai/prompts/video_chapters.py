# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: generate YouTube-style chapter markers from a transcript.

Inputs:
    transcript:      transcript (with or without rough timestamps)
    video_duration:  duration in seconds — used to bound chapter timestamps
    chapter_count:   target number of chapters (default 6)
    language:        output language

Output JSON:
    {
      "chapters": [
        {"timestamp": "0:00", "title": "Intro", "seconds": 0},
        {"timestamp": "1:15", "title": "...",   "seconds": 75}
      ]
    }
"""


def build_prompt(*,
                 transcript: str,
                 video_duration: int = 0,
                 chapter_count: int = 6,
                 language: str = 'English') -> dict:
    chapter_count = max(3, min(chapter_count, 12))
    duration_block = (
        f'Video duration: {video_duration} seconds. Bound timestamps inside this range.\n'
        if video_duration else 'Video duration unknown — estimate from transcript length.\n'
    )

    system = (
        'You are a YouTube chapter author. You break a video into clearly '
        'titled chapters that match how creators title sections in their '
        'descriptions. Titles are 3-7 words, action- or topic-oriented, '
        'never sentences. The first chapter MUST start at 0:00. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'TRANSCRIPT:\n"""\n{transcript}\n"""\n\n'
        f'{duration_block}'
        f'Target {chapter_count} chapters.\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "chapters": [\n'
        '    {"timestamp": "0:00", "title": "Intro", "seconds": 0}\n'
        '  ]\n'
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
