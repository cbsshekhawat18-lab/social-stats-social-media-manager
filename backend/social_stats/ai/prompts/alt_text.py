# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: generate accessibility alt text for an image.

Inputs:
    language:  output language
    max_chars: soft cap (default 140 — most platforms recommend ≤125)

Output JSON:
    {"alt_text": "..."}
"""


def build_prompt(*, language: str = 'English', max_chars: int = 140) -> dict:
    system = (
        'You are an accessibility specialist. Write alt text that is concise, '
        'objective, and useful to screen-reader users. Describe what is in the '
        'image, not how it makes you feel. Avoid "image of…" or "picture of…" '
        f'preambles. Maximum {max_chars} characters. Output language: {language}. '
        'Return ONLY valid JSON.'
    )
    user = (
        'Generate alt text for the attached image.\n\n'
        'Respond with this exact JSON shape:\n'
        '{"alt_text": "the description"}'
    )
    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   200,
        'temperature':  0.2,
        'model':        None,
    }
