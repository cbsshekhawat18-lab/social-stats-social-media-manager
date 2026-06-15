# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: deep hashtag research for a piece of content.

Generates a richer set than the existing /ai/suggest-hashtags endpoint —
includes estimated reach, competition level, and relevance scoring.

Inputs:
    content:    the post body / topic to research hashtags for
    platform:   'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'google_my_business'
    count:      desired number of hashtags (default 15)
    niche:      optional niche / industry hint
    location:   optional location hint
    language:   output language for any descriptive text

Output JSON:
    {
      "hashtags": [
        {"tag": "#…", "estimated_reach": "high|medium|low",
         "competition_level": "high|medium|low",
         "relevance_score": 0.0..1.0,
         "rationale": "one-line why"}
      ]
    }
"""


def build_prompt(*,
                 content: str,
                 platform: str = 'instagram',
                 count: int = 15,
                 niche: str = '',
                 location: str = '',
                 language: str = 'English') -> dict:
    count = max(5, min(count, 30))

    system = (
        f'You are a social-media hashtag strategist for {platform}. You generate '
        'a balanced mix of hashtags: high-reach (large but competitive), '
        'medium-reach (sweet spot), and niche (low competition). '
        'Estimate reach + competition based on platform conventions, not real-time data. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    niche_block    = f'NICHE: {niche}\n'       if niche    else ''
    location_block = f'LOCATION: {location}\n' if location else ''

    user = (
        f'Generate {count} hashtags for the following content.\n\n'
        f'CONTENT:\n"""\n{content}\n"""\n\n'
        f'PLATFORM: {platform}\n'
        f'{niche_block}{location_block}'
        f'\nMix: ~30% high-reach, ~50% medium-reach, ~20% niche/long-tail.\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "hashtags": [\n'
        '    {\n'
        '      "tag": "#example",\n'
        '      "estimated_reach": "high|medium|low",\n'
        '      "competition_level": "high|medium|low",\n'
        '      "relevance_score": 0.0,\n'
        '      "rationale": "one-line reason"\n'
        '    }\n'
        '  ]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1500,
        'temperature':  0.6,
        'model':        None,
        'use_cache':    True,
    }
