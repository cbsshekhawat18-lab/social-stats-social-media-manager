# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: generate 3 platform-tailored variants of a post in one call.

Differs from post_writer (which produces ONE post for ONE platform):
this template fans out across platforms[] and returns a variant per platform.

Inputs:
    topic, tone, length, platforms[], include_hashtags, include_emojis,
    language, brand_voice, cta, extra_notes

Output JSON:
    {
      "variants": [
        {"platform": "...", "content": "...", "hashtags": [...],
         "suggested_media_type": "...", "character_count": 0, "score": 0}
      ]
    }
"""
from . import _brand_voice_block

PLATFORM_RULES = {
    'facebook':           'Facebook: 80-200 words, conversational, hook in line 1, 1-3 hashtags at end.',
    'instagram':          'Instagram: 100-150 words, emotive, strong opener, 8-15 hashtags grouped at end.',
    'linkedin':           'LinkedIn: 100-200 words, professional, thought-leadership, 1-3 hashtags max.',
    'youtube':            'YouTube description: 150-300 words, SEO-aware, clear CTA, 5-10 hashtags.',
    'google_my_business': 'Google My Business: 50-150 words, local CTA, no hashtags, no emojis.',
}


def build_prompt(*,
                 topic: str,
                 platforms: list[str] | None = None,
                 tone: str = 'friendly',
                 length: str = 'medium',
                 include_hashtags: bool = True,
                 include_emojis: bool = True,
                 language: str = 'English',
                 brand_voice: str = '',
                 cta: str = '',
                 extra_notes: str = '') -> dict:
    plats = platforms or ['instagram']
    plats = [p for p in plats if p in PLATFORM_RULES] or ['instagram']

    rules_block = '\n'.join(f'- {p.upper()}: {PLATFORM_RULES[p]}' for p in plats)

    system = (
        'You are an expert social media copywriter for a marketing agency. '
        'You write platform-tailored posts that hit each network\'s native expectations. '
        f'Always write in {language}. '
        f'{"Use emojis tastefully (1-3 per post)." if include_emojis else "Do NOT use emojis."} '
        f'{"Include relevant hashtags per platform rules." if include_hashtags else "Do NOT include hashtags."} '
        'Return ONLY valid JSON — no prose outside the JSON object.'
    )
    system += _brand_voice_block(brand_voice)

    user = (
        f'Generate one post per platform for the topic: "{topic}".\n\n'
        f'TONE: {tone}\n'
        f'LENGTH: {length}\n'
    )
    if cta:
        user += f'CALL TO ACTION: {cta}\n'
    if extra_notes:
        user += f'ADDITIONAL NOTES: {extra_notes}\n'

    user += (
        f'\nPLATFORMS + RULES:\n{rules_block}\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "variants": [\n'
        '    {\n'
        '      "platform": "instagram",\n'
        '      "content": "the post text",\n'
        '      "hashtags": ["#tag1"],\n'
        '      "suggested_media_type": "image|video|carousel|none",\n'
        '      "character_count": 0,\n'
        '      "score": 0\n'
        '    }\n'
        '  ]\n'
        '}\n'
        f'Generate one variant per platform from this list: {plats}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   2048,
        'temperature':  0.7,
        'model':        None,    # Sonnet
        'use_cache':    True,
    }
