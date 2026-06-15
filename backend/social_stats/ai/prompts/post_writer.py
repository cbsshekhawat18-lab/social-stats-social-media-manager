# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: generate a social media post optimised per platform.

Inputs:
    topic:        what the post is about
    platform:     'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'google_my_business'
    tone:         'professional' | 'friendly' | 'witty' | 'urgent' | 'inspirational' | ...
    length:       'short' | 'medium' | 'long'
    include_hashtags: bool
    include_emojis:   bool
    language:     ISO code or descriptive ('English', 'Hindi', ...)
    brand_voice:  formatted brand-voice context string (optional)
    extra_notes:  free-form additional instructions

Output:
    JSON with keys: content, hashtags (list), suggested_media_type, character_count
"""
from . import _brand_voice_block

PLATFORM_RULES = {
    'facebook': (
        'Facebook: 80-200 words preferred (3-5 short paragraphs). Conversational. '
        'Include 1-3 strategic hashtags at the end. Hook in the first sentence.'
    ),
    'instagram': (
        'Instagram: 100-150 words preferred. Engaging, emotive. Strong opening line. '
        'Group 8-15 hashtags at the very end (separate paragraph). Emojis welcome but tasteful.'
    ),
    'linkedin': (
        'LinkedIn: 100-200 words. Professional, thought-leadership oriented. '
        'No more than 3 hashtags. Open with a bold insight or counter-intuitive claim.'
    ),
    'youtube': (
        'YouTube description: 150-300 words. SEO-aware (relevant keywords woven naturally). '
        'Include a clear CTA. 5-10 hashtags at the end.'
    ),
    'google_my_business': (
        'Google My Business: 50-150 words. Local-business focused, clear CTA, '
        'mention location if relevant. No hashtags. Avoid emojis.'
    ),
}

LENGTH_HINTS = {
    'short':  'Keep it punchy — 1-2 short paragraphs.',
    'medium': 'Balanced length — 2-4 short paragraphs.',
    'long':   'Detailed — 4-6 paragraphs with depth.',
}


def build_prompt(*,
                 topic: str,
                 platform: str = 'instagram',
                 tone: str = 'friendly',
                 length: str = 'medium',
                 include_hashtags: bool = True,
                 include_emojis: bool = True,
                 language: str = 'English',
                 brand_voice: str = '',
                 extra_notes: str = '',
                 cta: str = '') -> dict:
    rule = PLATFORM_RULES.get(platform, PLATFORM_RULES['instagram'])
    length_hint = LENGTH_HINTS.get(length, LENGTH_HINTS['medium'])

    system = (
        'You are an expert social media copywriter for a marketing agency. '
        'You write compelling, on-platform-tone posts that drive measurable engagement. '
        f'Always write in {language}. '
        f'{"Use emojis tastefully (1-3 per post)." if include_emojis else "Do NOT use emojis."} '
        f'{"Include relevant hashtags as instructed." if include_hashtags else "Do NOT include hashtags."} '
        'Return ONLY valid JSON — no prose outside the JSON object.'
    )
    system += _brand_voice_block(brand_voice)

    user = (
        f'Write a single {platform} post about:\n'
        f'TOPIC: {topic}\n'
        f'TONE: {tone}\n'
        f'LENGTH: {length} — {length_hint}\n'
        f'PLATFORM RULES: {rule}\n'
    )
    if cta:
        user += f'CALL TO ACTION: {cta}\n'
    if extra_notes:
        user += f'ADDITIONAL NOTES: {extra_notes}\n'

    user += (
        '\nRespond with this exact JSON shape:\n'
        '{\n'
        '  "content": "the post text",\n'
        '  "hashtags": ["#tag1", "#tag2"],\n'
        '  "suggested_media_type": "image" | "video" | "carousel" | "none",\n'
        '  "character_count": 0,\n'
        '  "score": 0\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1024,
        'temperature':  0.7,
        'model':        None,    # use AIClient default (Sonnet)
        'use_cache':    True,
    }
