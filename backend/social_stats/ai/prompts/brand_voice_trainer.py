# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: extract a structured brand-voice profile from sample posts.

Used by /ai/v2/brand-voice/train. Drops every analysis field that the
extended BrandVoiceProfile model can store (added of the AI build).

Inputs:
    samples:       list of sample post strings (3-20 expected)
    business_hint: optional one-liner about the business
    industry:      optional industry tag

Output JSON:
    {
      "voice_summary":      "2-3 sentence persona description",
      "tone_descriptors":   ["friendly", "concise", "expert"],
      "preferred_words":    ["word", "phrase"],
      "forbidden_words":    ["word", "phrase"],
      "style_rules":        ["short imperative rule", ...],
      "target_audience":    "1-2 sentence audience description",
      "prohibited_topics":  ["topic to avoid"],
      "emoji_usage":        "heavy | moderate | minimal | none",
      "hashtag_style":      "minimal | grouped-at-end | inline | none",
      "example_posts":      ["3 short example posts in this voice for validation"]
    }
"""

ALLOWED_EMOJI_USAGE   = ['heavy', 'moderate', 'minimal', 'none']
ALLOWED_HASHTAG_STYLE = ['minimal', 'grouped-at-end', 'inline', 'none']


def build_prompt(*,
                 samples: list[str],
                 business_hint: str = '',
                 industry: str = '',
                 language: str = 'English') -> dict:
    capped = [s[:1500] for s in (samples or []) if s and s.strip()][:20]
    samples_block = '\n\n'.join(
        f'--- POST {i + 1} ---\n{s}' for i, s in enumerate(capped)
    ) or '(no samples)'

    biz_block = f'BUSINESS: {business_hint}\n' if business_hint else ''
    ind_block = f'INDUSTRY: {industry}\n'      if industry      else ''

    system = (
        'You are a senior brand strategist. You read sample posts and extract '
        'the underlying voice — what makes this brand sound like itself. '
        'Be specific: short tone adjectives, concrete style rules ("never start '
        'with hi"), real vocabulary patterns. Generate three short example '
        'posts at the end as validation that you have captured the voice. '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user = (
        f'{biz_block}{ind_block}'
        f'SAMPLE POSTS:\n{samples_block}\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "voice_summary": "2-3 sentence persona description",\n'
        '  "tone_descriptors": ["3-6 short adjectives"],\n'
        '  "preferred_words": ["vocabulary patterns to favour"],\n'
        '  "forbidden_words": ["words/phrases this brand avoids"],\n'
        '  "style_rules": ["concrete imperative rules — be specific"],\n'
        '  "target_audience": "1-2 sentences describing who this content is for",\n'
        '  "prohibited_topics": ["topics this brand should not touch"],\n'
        f'  "emoji_usage": "<one of: {"|".join(ALLOWED_EMOJI_USAGE)}>",\n'
        f'  "hashtag_style": "<one of: {"|".join(ALLOWED_HASHTAG_STYLE)}>",\n'
        '  "example_posts": ["short example post 1", "example 2", "example 3"]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   2048,
        'temperature':  0.4,
        'model':        None,
        'use_cache':    False,    # always re-train fresh
    }


def coerce_result(raw: dict) -> dict:
    """Sanitise + pin enums after parsing."""
    def pick(value, allowed, fallback):
        v = (value or '').strip().lower() if isinstance(value, str) else ''
        return v if v in allowed else fallback

    def _trim_list(items, max_items, max_chars=200):
        out = []
        for item in (items or [])[:max_items]:
            s = str(item or '').strip()
            if s:
                out.append(s[:max_chars])
        return out

    return {
        'voice_summary':     str(raw.get('voice_summary') or '')[:2000],
        'tone_descriptors':  _trim_list(raw.get('tone_descriptors'), 10, 50),
        'preferred_words':   _trim_list(raw.get('preferred_words'), 50, 80),
        'forbidden_words':   _trim_list(raw.get('forbidden_words'), 50, 80),
        'style_rules':       _trim_list(raw.get('style_rules'), 20, 200),
        'target_audience':   str(raw.get('target_audience') or '')[:1000],
        'prohibited_topics': _trim_list(raw.get('prohibited_topics'), 20, 100),
        'emoji_usage':       pick(raw.get('emoji_usage'),   ALLOWED_EMOJI_USAGE,   'moderate'),
        'hashtag_style':     pick(raw.get('hashtag_style'), ALLOWED_HASHTAG_STYLE, 'grouped-at-end'),
        'example_posts':     _trim_list(raw.get('example_posts'), 5, 800),
    }
