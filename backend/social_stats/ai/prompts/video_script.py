# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: generate a script for a short-form video (Reels / Shorts).

Inputs:
    topic:            what the video is about
    duration_seconds: target length (15, 30, 60, ...)
    platform:         'instagram' | 'youtube_shorts' | 'linkedin' | 'facebook'
    hook_style:       'question' | 'shock' | 'story' | 'list' | 'pattern_interrupt'
    cta:              optional call to action
    brand_voice:      optional brand voice context

Output JSON:
    {
      "hook": "...",
      "script": [
        {"timestamp": "0:00", "narration": "...", "visual_direction": "..."}
      ],
      "cta": "...",
      "estimated_words": 0
    }
"""
from . import _brand_voice_block

HOOK_HINTS = {
    'question':           'Open with a sharp question that names the viewer\'s pain.',
    'shock':              'Open with a counter-intuitive claim or surprising stat.',
    'story':              'Open with the first beat of a 3-act story (the inciting incident).',
    'list':               'Open with the number of items + the promised takeaway.',
    'pattern_interrupt':  'Open with an unexpected, attention-grabbing visual or phrase.',
}


def build_prompt(*,
                 topic: str,
                 duration_seconds: int = 30,
                 platform: str = 'instagram',
                 hook_style: str = 'question',
                 cta: str = '',
                 brand_voice: str = '',
                 language: str = 'English') -> dict:
    hook_rule = HOOK_HINTS.get(hook_style, HOOK_HINTS['question'])
    duration_seconds = max(8, min(duration_seconds, 180))

    # Roughly 2.5 words per second for clear narration
    word_target = int(duration_seconds * 2.5)

    system = (
        'You are a short-form video scriptwriter. You write tight, hook-first '
        'scripts that retain viewers through to the CTA. Each beat has both '
        'narration AND a visual direction. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )
    system += _brand_voice_block(brand_voice)

    cta_block = f'CTA: {cta}\n' if cta else ''

    user = (
        f'TOPIC: {topic}\n'
        f'PLATFORM: {platform}\n'
        f'DURATION: {duration_seconds} seconds (~{word_target} words)\n'
        f'HOOK STYLE: {hook_style} — {hook_rule}\n'
        f'{cta_block}\n'
        'Break the script into 3-6 beats. Use timestamps in M:SS format.\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "hook": "the opening line",\n'
        '  "script": [\n'
        '    {"timestamp": "0:00", "narration": "...", "visual_direction": "..."},\n'
        '    {"timestamp": "0:08", "narration": "...", "visual_direction": "..."}\n'
        '  ],\n'
        '  "cta": "the closing call to action",\n'
        '  "estimated_words": 0\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1500,
        'temperature':  0.7,
        'model':        None,
        'use_cache':    True,
    }
