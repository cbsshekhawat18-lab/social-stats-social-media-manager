# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: critique and improve a draft post.

Returns a structured score, list of issues, list of improvement suggestions,
and a polished improved version. Useful as a "post-improve" CTA in Composer.

Inputs:
    draft:    the draft post text
    platform: target platform (rules vary)
    goal:     'engagement' | 'reach' | 'conversions' | 'brand_awareness'
    brand_voice: optional brand voice context

Output JSON:
    {
      "score": 0..100,
      "issues":      [{"severity": "low|med|high", "text": "..."}],
      "suggestions": ["...", "..."],
      "improved_version": "..."
    }
"""
from . import _brand_voice_block

PLATFORM_NOTES = {
    'instagram': 'IG: opener matters, 15+ hashtags help, emojis OK, length 100-150 words ideal.',
    'facebook':  'FB: hook in line 1, 80-200 words, strategic 2-3 hashtags.',
    'linkedin':  'LinkedIn: thought-leadership, professional, ≤3 hashtags, no emoji overload.',
    'youtube':   'YT description: SEO-aware, clear CTA, chapters help, longer is OK.',
    'google_my_business': 'GMB: local CTA, no emojis, no hashtags.',
}


def build_prompt(*,
                 draft: str,
                 platform: str = 'instagram',
                 goal: str = 'engagement',
                 brand_voice: str = '') -> dict:
    plat_note = PLATFORM_NOTES.get(platform, PLATFORM_NOTES['instagram'])

    system = (
        'You are a senior social-media editor. You audit drafts against the '
        'target platform\'s norms and the chosen marketing goal. Be specific '
        'about issues — never vague. Provide actionable suggestions, then '
        'rewrite the draft incorporating them. '
        'Return ONLY valid JSON.'
    )
    system += _brand_voice_block(brand_voice)

    user = (
        f'PLATFORM: {platform}\n'
        f'PLATFORM NORMS: {plat_note}\n'
        f'GOAL: {goal}\n\n'
        f'DRAFT:\n"""\n{draft}\n"""\n\n'
        'Audit the draft. Then improve it.\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "score": 0,\n'
        '  "issues": [\n'
        '    {"severity": "low|med|high", "text": "what is wrong"}\n'
        '  ],\n'
        '  "suggestions": ["concrete next step", "another"],\n'
        '  "improved_version": "the rewritten post"\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1500,
        'temperature':  0.5,
        'model':        None,
        'use_cache':    True,
    }
