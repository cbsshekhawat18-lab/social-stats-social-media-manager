# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: write a reply to a public review (GMB / app store / Trustpilot).

Tuned for the universal review-reply rhythm:
  1. Thank the reviewer by name when available
  2. Address their specific concern (pain or praise)
  3. Invite them back / next step

Inputs:
    review_text:      body of the review
    rating:           1-5 if available
    reviewer_name:    optional first name
    business_name:    the business replying
    platform:         'gmb' | 'app_store' | 'trustpilot' | 'yelp'
    brand_voice:      optional brand voice context
    extra_notes:      free-form (e.g. "we already refunded them")

Output JSON:
    {
      "reply_text":        "...",
      "tone_used":         "professional | warm | apologetic | celebratory",
      "addresses_concerns":["concern 1", "concern 2"]
    }
"""
from . import _brand_voice_block


def build_prompt(*,
                 review_text: str,
                 rating: int = 0,
                 reviewer_name: str = '',
                 business_name: str = '',
                 platform: str = 'gmb',
                 brand_voice: str = '',
                 extra_notes: str = '',
                 language: str = 'English') -> dict:
    biz = business_name or 'the business'
    name_block   = f'REVIEWER NAME: {reviewer_name}\n' if reviewer_name else ''
    rating_block = f'RATING: {rating}/5\n' if rating else ''

    tone_hint = (
        'Be warm and apologetic — focus on what you can do next.'
        if rating and rating <= 2 else
        'Be celebratory and grateful — never sycophantic.'
        if rating and rating >= 4 else
        'Be professional and curious — ask what would have made it 5 stars.'
    )

    system = (
        f'You are the public-relations voice of {biz}. You reply to public '
        'reviews on the company\'s behalf. Always: thank the reviewer (use '
        'their name when available), acknowledge specific points they made, '
        'and offer a concrete next step. Keep replies tight (2-4 sentences). '
        'Never argue. Never make excuses. Never include phone/email — invite '
        'them to private channels generically. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )
    system += _brand_voice_block(brand_voice)

    user = (
        f'PLATFORM: {platform}\n'
        f'{rating_block}{name_block}'
        f'REVIEW:\n"""\n{review_text}\n"""\n\n'
        f'TONE GUIDANCE: {tone_hint}\n'
    )
    if extra_notes:
        user += f'\nADDITIONAL CONTEXT: {extra_notes}\n'
    user += (
        '\nRespond with this exact JSON shape:\n'
        '{\n'
        '  "reply_text": "the reply",\n'
        '  "tone_used": "professional | warm | apologetic | celebratory",\n'
        '  "addresses_concerns": ["specific concern 1"]\n'
        '}'
    )
    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   600,
        'temperature':  0.5,
        'model':        None,
        'use_cache':    True,
    }
