# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: rewrite text following a free-form instruction.

Inputs:
    text:         original text
    instruction:  free-form rewrite instruction
                  ("make shorter", "more casual", "add urgency",
                   "more professional", "translate to Hindi", ...)
    preserve_meaning: bool — keep semantic intent (default True)
    brand_voice:  optional brand voice context

Output JSON:
    {"rewritten_text": "...", "changes_summary": "..."}
"""
from . import _brand_voice_block


def build_prompt(*,
                 text: str,
                 instruction: str,
                 preserve_meaning: bool = True,
                 brand_voice: str = '') -> dict:

    system = (
        'You are a precise copy editor. Apply the user\'s rewrite instruction '
        'exactly while preserving the original meaning. '
        'Return ONLY valid JSON.'
    )
    system += _brand_voice_block(brand_voice)

    preserve_note = (
        'Preserve the underlying meaning unless the instruction explicitly asks '
        'you to change it.' if preserve_meaning else
        'Follow the instruction even if it changes the meaning.'
    )

    user = (
        f'Original text:\n"""\n{text}\n"""\n\n'
        f'Rewrite instruction: {instruction}\n'
        f'{preserve_note}\n\n'
        'Respond with this exact JSON:\n'
        '{\n'
        '  "rewritten_text": "the rewritten version",\n'
        '  "changes_summary": "one-sentence description of what you changed"\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1024,
        'temperature':  0.5,
        'model':        None,
        'use_cache':    True,
    }
