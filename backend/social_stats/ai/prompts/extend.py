# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: extend a draft to reach a target length while preserving voice.

Inputs:
    draft:         current draft text
    target_length: 'short' (≤80w) | 'medium' (~150w) | 'long' (~300w) | int (word count)
    preserve_tone: bool — keep the existing tone
    brand_voice:   optional brand voice context

Output JSON:
    {"extended_text": "...", "added_word_count": 0}
"""
from . import _brand_voice_block


def _length_hint(target_length) -> str:
    if isinstance(target_length, int):
        return f'Approximately {target_length} words total.'
    return {
        'short':  'Approximately 80 words total — punchy, 1-2 short paragraphs.',
        'medium': 'Approximately 150 words total — balanced, 2-3 paragraphs.',
        'long':   'Approximately 300 words total — detailed, 4-5 paragraphs.',
    }.get(target_length, 'Approximately 150 words total.')


def build_prompt(*,
                 draft: str,
                 target_length='medium',
                 preserve_tone: bool = True,
                 brand_voice: str = '') -> dict:

    system = (
        'You are a skilled copywriter. Continue and extend the user\'s draft '
        'in the same voice and style. Do not contradict anything in the draft. '
        'Add depth, examples, or detail — never repeat what\'s already there. '
        'Return ONLY valid JSON.'
    )
    system += _brand_voice_block(brand_voice)

    user = (
        f'Original draft:\n"""\n{draft}\n"""\n\n'
        f'Target length: {_length_hint(target_length)}\n'
        f'Preserve tone: {"yes" if preserve_tone else "no"}\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "extended_text": "the full extended version (includes the original)",\n'
        '  "added_word_count": 0\n'
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
