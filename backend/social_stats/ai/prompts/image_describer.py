# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: describe an image (vision).

Used by /ai/v2/describe-image. The caller passes a base64-encoded image to
AIClient.complete_vision; this template provides the system + user prompt.

Inputs:
    purpose:   'caption' | 'alt_text' | 'analysis'  — biases the description
    language:  output language

Output JSON:
    {
      "description":           "...",
      "suggested_caption":     "...",
      "suggested_hashtags":    ["#tag1", "#tag2"],
      "detected_objects":      ["object1", "object2"],
      "mood":                  "...",
      "colors":                ["..."],
      "suggested_edits":       ["...", "..."]
    }
"""


def build_prompt(*, purpose: str = 'caption', language: str = 'English') -> dict:
    purpose_hint = {
        'caption':   'Lean into emotional/marketing details — what would help write a caption?',
        'alt_text':  'Lean into objective, factual descriptions for accessibility.',
        'analysis':  'Lean into composition, lighting, branding cues — what would help a designer?',
    }.get(purpose, 'Provide a balanced description.')

    system = (
        'You are a vision specialist analysing images for a marketing platform. '
        f'Provide structured output. {purpose_hint} '
        f'Output language: {language}. '
        'Return ONLY valid JSON.'
    )

    user_message = (
        'Analyse the attached image and respond with this exact JSON shape:\n'
        '{\n'
        '  "description": "1-2 sentence description",\n'
        '  "suggested_caption": "a ready-to-post caption",\n'
        '  "suggested_hashtags": ["#tag1"],\n'
        '  "detected_objects": ["object1"],\n'
        '  "mood": "the overall mood/feeling",\n'
        '  "colors": ["dominant color names"],\n'
        '  "suggested_edits": ["concrete edit suggestion if useful"]\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user_message,
        'max_tokens':   1024,
        'temperature':  0.4,
        'model':        None,
    }
