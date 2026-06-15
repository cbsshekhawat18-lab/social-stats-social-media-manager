# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Video AI endpoints.

Mounted at:
    POST /api/ai/v2/video-script           — generate a short-form video script
    POST /api/ai/v2/video-captions         — clean up a transcript into SRT/VTT
    POST /api/ai/v2/video-chapters         — generate YouTube chapter markers
    POST /api/ai/v2/video-summary          — extract summary + thumbnail/title

These endpoints process TEXT (transcripts, topics) — they don't ingest video
files. Video transcription itself is handled separately (e.g. Whisper); these
endpoints take the resulting transcript and post-process it intelligently.

File name is `video_ai_views.py` (not `video_views.py`) to avoid colliding
with the existing top-level `video_views.py` module that handles the
moviepy-based trim/resize/upload flow.
"""
from __future__ import annotations

import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..ai_helpers import brand_voice_prompt
from ..ai_views import _resolved_client
from . import AIClient, AIError, RateLimited, prompts
from .content_views import _ai_call_json, _error_response

logger = logging.getLogger(__name__)

# Soft caps to keep prompts (and bills) bounded.
MAX_TRANSCRIPT_CHARS = 60000   # ~10-15k tokens
MIN_TRANSCRIPT_CHARS = 30


def _validate_transcript(text: str):
    if len(text) < MIN_TRANSCRIPT_CHARS:
        raise AIError('transcript is too short to analyse')
    if len(text) > MAX_TRANSCRIPT_CHARS:
        raise AIError(f'transcript exceeds {MAX_TRANSCRIPT_CHARS} characters; chunk it first')


# ─────────────────────────────────────────────────────────────────────────
# 1. /ai/v2/video-script
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def video_script(request):
    """
    Body: { client_id, topic, duration_seconds?, platform?, hook_style?, cta?, language? }
    Returns: { hook, script: [{timestamp, narration, visual_direction}], cta, estimated_words }
    """
    client, err = _resolved_client(request)
    if err: return err

    topic = (request.data.get('topic') or '').strip()
    if not topic:
        return Response({'error': 'topic is required'}, status=400)

    ai = AIClient(client=client, user=request.user, feature='video_script')
    try:
        data = _ai_call_json(
            ai=ai, template='video_script',
            topic=topic,
            duration_seconds=int(request.data.get('duration_seconds', 30) or 30),
            platform=request.data.get('platform', 'instagram'),
            hook_style=request.data.get('hook_style', 'question'),
            cta=request.data.get('cta', '') or '',
            language=request.data.get('language', 'English'),
            brand_voice=brand_voice_prompt(client),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'video-script failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 2. /ai/v2/video-captions
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def video_captions(request):
    """
    Body: { client_id, transcript, already_timestamped?, language? }
    Returns: { srt, vtt, plain_text, language }
    """
    client, err = _resolved_client(request)
    if err: return err

    transcript = (request.data.get('transcript') or '').strip()
    try:
        _validate_transcript(transcript)
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    ai = AIClient(client=client, user=request.user, feature='video_captions')
    try:
        data = _ai_call_json(
            ai=ai, template='video_captions',
            transcript=transcript,
            already_timestamped=bool(request.data.get('already_timestamped', False)),
            language=request.data.get('language', '') or '',
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'video-captions failed')
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 3. /ai/v2/video-chapters
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def video_chapters(request):
    """
    Body: { client_id, transcript, video_duration?, chapter_count?, language? }
    Returns: { chapters: [{timestamp, title, seconds}] }
    """
    client, err = _resolved_client(request)
    if err: return err

    transcript = (request.data.get('transcript') or '').strip()
    try:
        _validate_transcript(transcript)
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    ai = AIClient(client=client, user=request.user, feature='video_chapters')
    try:
        data = _ai_call_json(
            ai=ai, template='video_chapters',
            transcript=transcript,
            video_duration=int(request.data.get('video_duration', 0) or 0),
            chapter_count=int(request.data.get('chapter_count', 6) or 6),
            language=request.data.get('language', 'English'),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'video-chapters failed')

    # Ensure first chapter starts at 0
    chapters = data.get('chapters') or []
    if chapters and chapters[0].get('seconds', 0) != 0:
        chapters[0]['seconds'] = 0
        chapters[0]['timestamp'] = '0:00'
    data['chapters'] = chapters
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────
# 4. /ai/v2/video-summary
# ─────────────────────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def video_summary(request):
    """
    Body: { client_id, transcript, language? }
    Returns: { summary, key_points, suggested_thumbnail_text, suggested_title,
               estimated_watch_time_seconds }
    """
    client, err = _resolved_client(request)
    if err: return err

    transcript = (request.data.get('transcript') or '').strip()
    try:
        _validate_transcript(transcript)
    except AIError as e:
        return Response({'error': str(e)}, status=400)

    ai = AIClient(client=client, user=request.user, feature='video_summary')
    try:
        data = _ai_call_json(
            ai=ai, template='video_summary',
            transcript=transcript,
            language=request.data.get('language', 'English'),
        )
    except (AIError, RateLimited) as e:
        return _error_response(e, 'video-summary failed')
    return Response(data)
