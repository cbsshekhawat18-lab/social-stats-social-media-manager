# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
AI helpers for the automation engine.

Two public functions:

    enrich_message_context(ctx, *, needed_keys)
        Lazily call Claude (Haiku) to classify a message's intent / urgency /
        spam status — only if the active rules actually filter on those keys.
        Mutates `ctx` in place. Cached per-message via Redis to avoid re-running
        for every rule.

    personalize_template(text, ctx, client)
        Replace `{{ai_personalized}}` placeholders in a reply template with a
        Claude-generated personal sentence that uses the customer's name,
        sentiment, and message history.

Both functions degrade gracefully when the SDK / API key is unavailable —
returning the original ctx / template unchanged.
"""
from __future__ import annotations

import logging
from typing import Iterable

from django.core.cache import cache

from ..ai_helpers import unified_voice_prompt
from . import AIClient, AIError, RateLimited, prompts
from .prompts import (
    sentiment_analyzer,
    intent_classifier,
    spam_filter as spam_filter_prompt,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# Context enrichment
# ─────────────────────────────────────────────────────────────────────────

# Filter keys that require AI classification
AI_FILTER_KEYS = {'intent', 'urgency', 'requires_human', 'is_spam', 'emotion'}


def needs_ai_enrichment(rules) -> set[str]:
    """
    Inspect a list of AutomationRule rows and return the set of AI filter keys
    that are referenced. Used to decide which classifiers to run.
    """
    keys: set[str] = set()
    for r in rules:
        f = r.trigger_filters or {}
        for k in AI_FILTER_KEYS:
            if k in f:
                keys.add(k)
    return keys


def enrich_message_context(ctx: dict, *, needed_keys: Iterable[str] = AI_FILTER_KEYS) -> dict:
    """
    Run AI classifiers and stash results in `ctx`. Idempotent — only fills
    missing keys. Cached per-message id.

    `needed_keys` lets callers limit to just the classifiers they need.
    Pass the empty set to skip entirely (for events with no AI filters).

    Adds the following keys to ctx:
        ai_intent           str
        ai_intent_confidence float
        ai_urgency          str
        ai_emotion          str
        ai_requires_human   bool
        ai_is_spam          bool
        ai_spam_category    str
    """
    if not needed_keys:
        return ctx

    text = (ctx.get('content') or '').strip()
    if not text:
        return ctx

    # Cache key per message id (or fallback hash) to avoid re-running per rule
    msg_obj = ctx.get('message') or ctx.get('review')
    msg_id  = getattr(msg_obj, 'id', None) or getattr(msg_obj, 'pk', None)
    cache_key = f'ai:autom:enrich:{ctx.get("client_id")}:{msg_id}' if msg_id else None
    if cache_key:
        cached = cache.get(cache_key)
        if isinstance(cached, dict):
            ctx.update(cached)
            return ctx

    needs_intent    = 'intent'         in needed_keys
    needs_urgency   = 'urgency'        in needed_keys or 'emotion' in needed_keys or 'requires_human' in needed_keys
    needs_spam      = 'is_spam'        in needed_keys

    out: dict = {}
    client_obj = None
    if ctx.get('client_id'):
        try:
            from ..models import Client
            client_obj = Client.objects.get(id=ctx['client_id'])
        except Exception:
            client_obj = None

    ai = AIClient(client=client_obj, user=None, feature='automation_enrich')

    if needs_urgency:
        try:
            cfg = prompts.build('sentiment_analyzer', message=text, platform=ctx.get('platform') or '')
            raw = ai.extract_json(cfg['user_message'], system=cfg['system'],
                                   max_tokens=cfg['max_tokens'], temperature=cfg['temperature'],
                                   fast=True)
            res = sentiment_analyzer.coerce_result(raw)
            out['ai_urgency']        = res['urgency']
            out['ai_emotion']        = res['emotion']
            out['ai_requires_human'] = bool(res['requires_human'])
        except (AIError, RateLimited):
            pass
        except Exception:
            logger.exception('automation_enrich: sentiment failed')

    if needs_intent:
        try:
            cfg = prompts.build('intent_classifier', text=text, platform=ctx.get('platform') or '')
            raw = ai.extract_json(cfg['user_message'], system=cfg['system'],
                                   max_tokens=cfg['max_tokens'], temperature=cfg['temperature'],
                                   fast=True)
            res = intent_classifier.coerce_result(raw)
            out['ai_intent']            = res['intent']
            out['ai_intent_confidence'] = res['confidence']
        except (AIError, RateLimited):
            pass
        except Exception:
            logger.exception('automation_enrich: intent failed')

    if needs_spam:
        try:
            cfg = prompts.build('spam_filter', text=text)
            raw = ai.extract_json(cfg['user_message'], system=cfg['system'],
                                   max_tokens=cfg['max_tokens'], temperature=cfg['temperature'],
                                   fast=True)
            res = spam_filter_prompt.coerce_result(raw)
            out['ai_is_spam']        = bool(res['is_spam'])
            out['ai_spam_category']  = res['category']
        except (AIError, RateLimited):
            pass
        except Exception:
            logger.exception('automation_enrich: spam_filter failed')

    if cache_key and out:
        # Cache for 1 hour — within the lifetime of the inbound event burst
        try:
            cache.set(cache_key, out, timeout=3600)
        except Exception:
            pass

    ctx.update(out)
    return ctx


def matches_ai_filters(filters: dict, ctx: dict) -> bool:
    """
    Evaluate any AI-driven filter keys present in `filters` against the
    enriched `ctx`. Returns True when ALL present AI filters match.
    Returns True when no AI filters are set.

    Filter shape examples:
        {'intent': 'complaint'}                  — exact match
        {'intent': ['complaint', 'support']}      — any-of
        {'urgency': 'high'}                      — at least this severity
        {'requires_human': True}                 — boolean
        {'is_spam': False}                       — must not be spam
    """
    URGENCY_RANK = {'low': 0, 'medium': 1, 'high': 2, 'critical': 3}

    def _any_of(value, allowed) -> bool:
        if isinstance(allowed, list):
            return value in [str(a).lower() for a in allowed]
        return value == str(allowed).lower()

    if 'intent' in filters:
        actual = (ctx.get('ai_intent') or '').lower()
        if not actual or not _any_of(actual, filters['intent']):
            return False

    if 'emotion' in filters:
        actual = (ctx.get('ai_emotion') or '').lower()
        if not actual or not _any_of(actual, filters['emotion']):
            return False

    if 'urgency' in filters:
        # 'urgency' filter is "at least this severity"
        threshold = URGENCY_RANK.get(str(filters['urgency']).lower(), 0)
        actual    = URGENCY_RANK.get(ctx.get('ai_urgency', 'low'), 0)
        if actual < threshold:
            return False

    if 'requires_human' in filters:
        if bool(ctx.get('ai_requires_human', False)) != bool(filters['requires_human']):
            return False

    if 'is_spam' in filters:
        if bool(ctx.get('ai_is_spam', False)) != bool(filters['is_spam']):
            return False

    return True


# ─────────────────────────────────────────────────────────────────────────
# Smart-template personalisation
# ─────────────────────────────────────────────────────────────────────────

PLACEHOLDER = '{{ai_personalized}}'


def template_needs_ai(text: str) -> bool:
    """Cheap check before paying for an AI call."""
    return bool(text) and PLACEHOLDER in text


def personalize_template(text: str, ctx: dict, client=None) -> str:
    """
    Replace `{{ai_personalized}}` in `text` with a Claude-generated
    personal sentence that uses the customer's name + the inbound message
    + brand voice. Other interpolations in the template (e.g.
    `{{customer_name}}`) are NOT touched here — that's the caller's job.

    Returns the original text on any failure so the rule still fires.
    """
    if not template_needs_ai(text):
        return text

    inbound = (ctx.get('content') or '').strip()
    if not inbound:
        return text.replace(PLACEHOLDER, '')

    customer_name = (ctx.get('contact_name') or '').strip() or 'there'
    sentiment     = (ctx.get('ai_emotion') or ctx.get('sentiment') or '').strip()
    business      = (ctx.get('business_name') or (client.company if client else '') or 'we')

    voice_block = unified_voice_prompt(client) if client else ''

    system = (
        f'You write a single sentence (max 25 words) to insert into a reply '
        f'template for {business}. Use the customer\'s tone and any facts in '
        f'their inbound message. Match the brand voice when given. '
        f'Never include placeholders, signatures, greetings, or sign-offs. '
        f'Return ONLY the sentence.'
    )
    if voice_block:
        system += f'\n\nBrand voice context:\n{voice_block}'

    sentiment_block = f'Sentiment: {sentiment}.\n' if sentiment else ''
    user = (
        f'CUSTOMER ({customer_name}) wrote:\n"""\n{inbound}\n"""\n'
        f'{sentiment_block}'
        'Write the single personalised sentence to splice into our reply template.'
    )

    ai = AIClient(client=client, user=None, feature='template_personalize')
    try:
        snippet = ai.complete(
            user, system=system,
            max_tokens=120, temperature=0.6, fast=True,
        )
    except (AIError, RateLimited):
        return text.replace(PLACEHOLDER, '')
    except Exception:
        logger.exception('personalize_template failed')
        return text.replace(PLACEHOLDER, '')

    snippet = (snippet or '').strip().strip('"').strip()
    # Defensive trim — Claude sometimes wraps in quotes or extra prose
    if len(snippet) > 280:
        snippet = snippet[:280].rstrip() + '…'

    return text.replace(PLACEHOLDER, snippet)
