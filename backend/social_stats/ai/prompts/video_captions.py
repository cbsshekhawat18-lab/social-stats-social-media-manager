# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt: clean up a raw transcript into broadcast-ready SRT + VTT captions.

Speech-to-text engines tend to produce run-on sentences with poor punctuation.
This prompt rewrites the transcript with proper sentence boundaries, then
emits SRT / VTT / plain-text variants.

Inputs:
    transcript:  raw transcript text (timestamped or plain)
    language:    output language (default detect)

Output JSON:
    {"srt": "...", "vtt": "...", "plain_text": "...", "language": "..."}
"""


def build_prompt(*,
                 transcript: str,
                 language: str = '',
                 already_timestamped: bool = False) -> dict:

    language_block = f'Output language: {language}.\n' if language else 'Detect the language and use it.\n'
    timestamp_note = (
        'The transcript already has rough timestamps; preserve them where possible.'
        if already_timestamped else
        'The transcript has no timestamps; estimate timing from sentence length (avg ~150 wpm).'
    )

    system = (
        'You are a captioning specialist. Convert raw transcripts into '
        'broadcast-ready captions: properly punctuated, ≤2 lines per cue, '
        '≤42 characters per line, ≤7 seconds per cue. '
        f'{language_block}'
        f'{timestamp_note} '
        'Return ONLY valid JSON.'
    )

    user = (
        f'Raw transcript:\n"""\n{transcript}\n"""\n\n'
        'Respond with this exact JSON shape:\n'
        '{\n'
        '  "srt": "1\\n00:00:00,000 --> 00:00:03,500\\nFirst caption line\\n\\n2\\n...",\n'
        '  "vtt": "WEBVTT\\n\\n00:00:00.000 --> 00:00:03.500\\nFirst caption line\\n\\n...",\n'
        '  "plain_text": "First caption line. Second sentence. ...",\n'
        '  "language": "ISO 639-1 code or descriptive name"\n'
        '}'
    )

    return {
        'system':       system,
        'user_message': user,
        'max_tokens':   3000,
        'temperature':  0.2,
        'model':        None,
        'use_cache':    True,
    }
