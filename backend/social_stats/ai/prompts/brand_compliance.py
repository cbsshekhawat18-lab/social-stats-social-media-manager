# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: check whether an image follows the brand's visual guidelines.

Inputs:
    brand_colors:  list of hex colors that should dominate
    brand_tone:    descriptive ("clean, minimalist", "vibrant, bold", ...)
    has_logo:      bool — whether the image is supposed to include the brand logo

Output JSON:
    {
      "compliant": true,
      "score": 0..100,
      "issues": [{"severity": "low|med|high", "text": "..."}],
      "suggestions": ["..."]
    }
"""


def build_prompt(*,
                 brand_colors: list[str] | None = None,
                 brand_tone: str = '',
                 has_logo: bool = False,
                 language: str = 'English') -> dict:
    colors_block = (
        f'Expected brand colors (hex): {", ".join(brand_colors)}.\n'
        if brand_colors else ''
    )
    tone_block = f'Expected visual tone: {brand_tone}.\n' if brand_tone else ''
    logo_block = (
        'The image should include the brand logo somewhere.\n'
        if has_logo else
        'The image does not need to include the brand logo.\n'
    )

    system = (
        'You are a senior brand designer auditing an image against the brand\'s '
        'visual guidelines. Be strict but fair. Note specific issues with colour, '
        'composition, typography, or tone. Flag obvious off-brand cues. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )
    user = (
        f'Audit the attached image.\n\n'
        f'{colors_block}{tone_block}{logo_block}\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "compliant": true,\n'
        '  "score": 0,\n'
        '  "issues": [\n'
        '    {"severity": "low|med|high", "text": "what is off-brand"}\n'
        '  ],\n'
        '  "suggestions": ["concrete fix"]\n'
        '}'
    )
    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1024,
        'temperature':  0.3,
        'model':        None,
    }
