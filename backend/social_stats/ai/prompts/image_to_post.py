# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: turn an image into one or more platform-tailored post drafts.

Inputs:
    platforms:    list of platform ids
    tone:         tone descriptor
    brand_voice:  optional brand voice context
    extra_notes:  free-form additional instructions

Output JSON:
    {
      "posts": [
        {"platform": "...", "content": "...", "hashtags": [...], "alt_text": "..."}
      ]
    }
"""
from . import _brand_voice_block

PLATFORM_RULES = {
    'instagram':          'Instagram: 100-150 words, emotive, 8-15 hashtags grouped at end.',
    'facebook':           'Facebook: 80-200 words, conversational, 1-3 hashtags.',
    'linkedin':           'LinkedIn: 100-200 words, professional, ≤3 hashtags.',
    'youtube':            'YouTube description: 150-300 words, SEO-aware, 5-10 hashtags.',
    'google_my_business': 'Google My Business: 50-150 words, local CTA, no hashtags, no emojis.',
}


def build_prompt(*,
                 platforms: list[str] | None = None,
                 tone: str = 'friendly',
                 brand_voice: str = '',
                 extra_notes: str = '',
                 language: str = 'English') -> dict:
    plats = [p for p in (platforms or ['instagram']) if p in PLATFORM_RULES] or ['instagram']
    rules = '\n'.join(f'- {p.upper()}: {PLATFORM_RULES[p]}' for p in plats)

    system = (
        'You are a creative social-media copywriter analysing an image and '
        'writing platform-tailored posts inspired by what you see. '
        'Tie the copy to the visual content — colours, mood, subject. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )
    system += _brand_voice_block(brand_voice)

    user = (
        f'Write one post per platform inspired by the attached image.\n\n'
        f'TONE: {tone}\n'
        f'PLATFORMS:\n{rules}\n'
    )
    if extra_notes:
        user += f'\nADDITIONAL NOTES: {extra_notes}\n'
    user += (
        '\nRespond with this exact JSON shape:\n'
        '{\n'
        '  "posts": [\n'
        '    {\n'
        '      "platform": "instagram",\n'
        '      "content": "the post text",\n'
        '      "hashtags": ["#tag"],\n'
        '      "alt_text": "accessibility description"\n'
        '    }\n'
        '  ]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   2048,
        'temperature':  0.7,
        'model':        None,
    }
