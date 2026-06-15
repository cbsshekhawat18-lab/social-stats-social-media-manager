# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Brand-voice training pipeline.

Stage 5 of the comprehensive AI build. Trains a richer profile than the
existing /ai/train-brand-voice endpoint (which is kept untouched per Rule #1):

    1. Validate the sample-post payload (3-20 non-empty strings)
    2. Set BrandVoiceProfile.training_status = 'training'
    3. Call Claude via AIClient (centralised cost / rate-limit / log)
    4. Coerce + persist the structured profile
    5. Set training_status = 'ready' (or 'failed' on errors)

Public:
    train_brand_voice(client, samples, user=None, business_hint='', industry='') -> dict
    get_brand_voice_payload(client) -> dict          # serialised profile
    serialize_profile(profile) -> dict               # for API responses
"""
from __future__ import annotations

import logging

from django.utils import timezone

from ..models import BrandVoiceProfile
from . import AIClient, AIError, prompts
from .prompts import brand_voice_trainer

logger = logging.getLogger(__name__)

MIN_SAMPLES = 3
MAX_SAMPLES = 20


def _validate_samples(samples) -> list[str]:
    if not isinstance(samples, list):
        raise AIError('sample_posts must be a list of strings')
    cleaned = [str(s).strip() for s in samples if str(s).strip()]
    if len(cleaned) < MIN_SAMPLES:
        raise AIError(f'Provide at least {MIN_SAMPLES} non-empty sample posts')
    return cleaned[:MAX_SAMPLES]


def serialize_profile(profile: BrandVoiceProfile | None) -> dict:
    """Render a BrandVoiceProfile for API consumers. None → blank profile."""
    if profile is None:
        return {
            'voice_summary':     '',
            'tone_descriptors':  [],
            'preferred_words':   [],
            'forbidden_words':   [],
            'style_rules':       [],
            'target_audience':   '',
            'prohibited_topics': [],
            'emoji_usage':       'moderate',
            'hashtag_style':     '',
            'training_status':   'pending',
            'training_error':    '',
            'last_trained_at':   None,
            'sample_count':      0,
        }
    return {
        'voice_summary':     profile.voice_summary or '',
        'tone_descriptors':  list(profile.tone_descriptors  or []),
        'preferred_words':   list(profile.preferred_words   or []),
        'forbidden_words':   list(profile.forbidden_words   or []),
        'style_rules':       list(profile.style_rules       or []),
        'target_audience':   profile.target_audience  or '',
        'prohibited_topics': list(profile.prohibited_topics or []),
        'emoji_usage':       profile.emoji_usage    or 'moderate',
        'hashtag_style':     profile.hashtag_style  or '',
        'training_status':   profile.training_status or 'pending',
        'training_error':    profile.training_error  or '',
        'last_trained_at':   profile.last_trained_at,
        'sample_count':      len(profile.sample_posts or []),
    }


def get_brand_voice_payload(client) -> dict:
    """Look up the profile for a client and serialise it."""
    profile = getattr(client, 'brand_voice', None) or BrandVoiceProfile.objects.filter(client=client).first()
    return serialize_profile(profile)


def train_brand_voice(*, client, samples, user=None,
                       business_hint: str = '', industry: str = '',
                       language: str = 'English') -> dict:
    """
    Train (or re-train) the brand voice profile for `client`. Returns the
    serialised profile + 3 example posts the model generated as validation.

    Raises AIError on validation / API failures. The persisted profile's
    training_status reflects the outcome ('ready' on success, 'failed' on
    error — with training_error populated).
    """
    cleaned = _validate_samples(samples)

    profile, _ = BrandVoiceProfile.objects.get_or_create(client=client)
    profile.training_status = 'training'
    profile.training_error  = ''
    profile.save(update_fields=['training_status', 'training_error', 'updated_at'])

    ai = AIClient(client=client, user=user, feature='brand_voice_train')
    cfg = prompts.build('brand_voice_trainer',
                        samples=cleaned,
                        business_hint=business_hint,
                        industry=industry,
                        language=language)

    try:
        raw = ai.extract_json(
            cfg['user_message'],
            system=cfg['system'],
            max_tokens=cfg['max_tokens'],
            temperature=cfg['temperature'],
        )
    except Exception as e:
        profile.training_status = 'failed'
        profile.training_error  = str(e)[:500]
        profile.save(update_fields=['training_status', 'training_error', 'updated_at'])
        raise AIError(f'Training failed: {e}') from e

    parsed = brand_voice_trainer.coerce_result(raw)
    example_posts = parsed.pop('example_posts', [])

    BrandVoiceProfile.objects.filter(pk=profile.pk).update(
        sample_posts=cleaned,
        voice_summary=parsed['voice_summary'],
        tone_descriptors=parsed['tone_descriptors'],
        preferred_words=parsed['preferred_words'],
        forbidden_words=parsed['forbidden_words'],
        style_rules=parsed['style_rules'],
        target_audience=parsed['target_audience'],
        prohibited_topics=parsed['prohibited_topics'],
        emoji_usage=parsed['emoji_usage'],
        hashtag_style=parsed['hashtag_style'],
        training_status='ready',
        training_error='',
        last_trained_at=timezone.now(),
    )
    profile.refresh_from_db()

    out = serialize_profile(profile)
    out['example_posts'] = example_posts
    return out
