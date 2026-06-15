# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: generate title candidates for blog / YouTube / long-form content.

Inputs:
    topic:    what the content is about
    content:  optional excerpt for context
    style:    'clickbait' | 'informative' | 'seo' | 'curious' | 'list' | 'how_to'
    count:    number of titles (default 6)
    language: output language

Output JSON:
    {
      "titles": [
        {"text": "...", "ctr_prediction": "high|medium|low",
         "length": 0, "score": 0.0..1.0, "rationale": "..."}
      ]
    }
"""

STYLE_HINTS = {
    'clickbait':   'Clickbait — strong curiosity hook, numbers/superlatives welcome (without being misleading).',
    'informative': 'Informative — clear and direct; describe the value the reader gets.',
    'seo':         'SEO-optimised — front-load the primary keyword, 50-65 chars ideal.',
    'curious':     'Curiosity-driven — open a knowledge gap without giving the answer.',
    'list':        'List-style — start with a number ("7 Ways to ...").',
    'how_to':      'How-to — start with "How to..." and name the outcome.',
}


def build_prompt(*,
                 topic: str,
                 content: str = '',
                 style: str = 'informative',
                 count: int = 6,
                 language: str = 'English') -> dict:
    count = max(3, min(count, 12))
    style_rule = STYLE_HINTS.get(style, STYLE_HINTS['informative'])

    system = (
        'You are an editorial headline writer. You craft titles that earn '
        'clicks honestly — accurate, specific, and curiosity-arousing without '
        'being misleading. Avoid hype words like "shocking", "won\'t believe", "insane". '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    excerpt = (f'\nEXCERPT FOR CONTEXT:\n"""\n{content}\n"""\n' if content else '')

    user = (
        f'TOPIC: {topic}\n'
        f'STYLE: {style} — {style_rule}\n'
        f'{excerpt}\n'
        f'Generate {count} title options.\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "titles": [\n'
        '    {\n'
        '      "text": "the title",\n'
        '      "ctr_prediction": "high|medium|low",\n'
        '      "length": 0,\n'
        '      "score": 0.0,\n'
        '      "rationale": "one-line why this works"\n'
        '    }\n'
        '  ]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   1024,
        'temperature':  0.8,    # creative
        'model':        None,
        'use_cache':    True,
    }
