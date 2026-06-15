# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: summarise long content in a chosen style and length.

Inputs:
    text:          source content
    style:         'bullet_points' | 'paragraph' | 'oneliner' | 'tldr'
    target_length: short | medium | long  (style-relative)
    language:      output language

Output JSON:
    {"summary": "...", "key_points": [...]}
"""

STYLE_HINTS = {
    'bullet_points': 'Output bullet points (5-8 bullets). Each bullet is one short sentence.',
    'paragraph':     'Output a single tight paragraph.',
    'oneliner':      'Output one tight headline-style line under 280 characters.',
    'tldr':          'Output a one-line "TL;DR:" summary.',
}

LENGTH_HINTS = {
    'short':  '~30 words total.',
    'medium': '~80 words total.',
    'long':   '~180 words total.',
}


def build_prompt(*,
                 text: str,
                 style: str = 'bullet_points',
                 target_length: str = 'medium',
                 language: str = 'English') -> dict:

    style_rule  = STYLE_HINTS.get(style,  STYLE_HINTS['bullet_points'])
    length_rule = LENGTH_HINTS.get(target_length, LENGTH_HINTS['medium'])

    system = (
        'You are a precise summariser. You compress text into the requested '
        'style and length without losing the core insights. '
        f'Always write in {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'Source text:\n"""\n{text}\n"""\n\n'
        f'Style: {style} — {style_rule}\n'
        f'Length: {target_length} — {length_rule}\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "summary": "the summary in the requested style",\n'
        '  "key_points": ["first key takeaway", "second key takeaway"]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   800,
        'temperature':  0.3,    # summaries should be consistent
        'model':        None,
        'use_cache':    True,
    }
