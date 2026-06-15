# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Centralised Anthropic Claude client.

Every AI feature in Social Stats flows through AIClient — never call the Anthropic SDK
directly from a view. This centralises:

    * Per-client + global rate limiting (rate_limiter)
    * Response caching (cache)
    * Cost estimation + AIUsageLog persistence (cost_tracker)
    * Retry with exponential backoff (tenacity)
    * Tenant-scoped logging
    * JSON extraction helper for structured outputs

Usage:
    from social_stats.ai import AIClient

    ai = AIClient(client=client, user=request.user, feature='caption')
    text = ai.complete("Write a tagline for a coffee shop")

    # Structured JSON
    data = ai.extract_json(prompt, schema_hint={'caption': 'str', 'tags': 'list'})

    # Streaming (returns a generator of token deltas)
    for delta in ai.complete_stream("Tell me a story"):
        print(delta, end='', flush=True)

Models:
    settings.AI_DEFAULT_MODEL  — Sonnet (content generation)
    settings.AI_FAST_MODEL     — Haiku  (classification / quick tasks)
    settings.AI_DEEP_MODEL     — Opus   (deep reasoning / research)
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any, Iterable, Optional

from django.conf import settings

from . import cache as ai_cache
from . import cost_tracker
from . import rate_limiter
from .rate_limiter import RateLimited

logger = logging.getLogger(__name__)


class AIError(Exception):
    """Wraps Anthropic SDK errors with friendly messages."""


def _anthropic_or_none():
    """Lazy-import Anthropic. Returns (Anthropic_class, exceptions_module) or (None, None)."""
    try:
        import anthropic  # noqa
        return anthropic.Anthropic, anthropic
    except ImportError:
        return None, None


class AIClient:
    """
    Tenant-scoped wrapper around the Anthropic SDK.

    Args:
        client:   social_stats.Client instance (or None for system-level calls)
        user:    User instance (for AIUsageLog attribution)
        feature: short feature label, e.g. 'caption', 'reply_suggest', 'chat'

    All methods enforce rate limiting + log to AIUsageLog. Cached responses
    bypass the API entirely and are recorded with cached=True.
    """

    def __init__(self, client=None, user=None, feature: str = 'misc'):
        self.client = client
        self.user = user
        self.feature = feature
        self._anthropic_class, self._sdk = _anthropic_or_none()

    # ── Internal helpers ─────────────────────────────────────────────────

    def _model(self, override: Optional[str], deep: bool = False, fast: bool = False) -> str:
        if override:
            return override
        if fast:
            return getattr(settings, 'AI_FAST_MODEL', 'claude-haiku-4-5-20251001')
        if deep:
            return getattr(settings, 'AI_DEEP_MODEL', 'claude-opus-4-7')
        return getattr(settings, 'AI_DEFAULT_MODEL', 'claude-sonnet-4-6')

    def _sdk_client(self):
        if self._anthropic_class is None:
            raise AIError('Anthropic SDK not installed (pip install anthropic)')
        api_key = getattr(settings, 'ANTHROPIC_API_KEY', '')
        if not api_key:
            raise AIError('ANTHROPIC_API_KEY is not configured')
        return self._anthropic_class(api_key=api_key)

    def _hash_prompt(self, prompt: str, system: str, model: str) -> str:
        raw = f'{model}|{system}|{prompt}'.encode()
        return hashlib.sha256(raw).hexdigest()[:32]

    def _make_request_payload(self, prompt: str, system: str, model: str,
                              temperature: float, max_tokens: int) -> dict:
        # Sanitised payload for AIUsageLog — truncate strings to keep DB rows lean.
        return {
            'system_preview': (system or '')[:240],
            'prompt_preview': (prompt or '')[:500],
            'model':          model,
            'temperature':    temperature,
            'max_tokens':     max_tokens,
        }

    def _call_with_retry(self, sdk_client, **kwargs):
        """Retry transient errors (overload, network) with exponential backoff."""
        last_err = None
        for attempt in range(3):
            try:
                return sdk_client.messages.create(**kwargs)
            except Exception as err:
                last_err = err
                # Retryable: 5xx / overload / transient network. Non-retryable: auth/4xx.
                msg = str(err).lower()
                non_retryable = any(s in msg for s in ('unauthorized', 'invalid', '401', '403', '400'))
                if non_retryable:
                    break
                if attempt < 2:
                    time.sleep(0.6 * (2 ** attempt))
                    continue
        raise AIError(f'Anthropic call failed: {last_err}') from last_err

    # ── Core completion ─────────────────────────────────────────────────

    def complete(self, prompt: str, *, system: str = '', model: Optional[str] = None,
                 max_tokens: int = 1024, temperature: float = 0.7,
                 cache_key: Optional[str] = None, fast: bool = False, deep: bool = False,
                 use_cache: bool = True, safety: bool = True) -> str:
        """
        Synchronous completion. Returns plain text from the assistant.

        Args:
            prompt:      user-side message
            system:      system prompt
            model:       explicit model override
            max_tokens:  cap on output tokens
            temperature: 0.0 (deterministic) → 1.0 (creative)
            cache_key:   override the auto-generated cache key (rarely needed)
            fast:        use Haiku for cheap classifications
            deep:        use Opus for hard reasoning
            use_cache:   default True; set False for inherently variable outputs
            safety:      — run input sanitiser + output scanner.
                         Defaults to True. Pass False to bypass (e.g. for system tooling).

        Raises:
            RateLimited: when client/global cap is exceeded
            AIError:     on SDK / config failures
        """
        if safety:
            from . import safety as ai_safety
            cleaned, in_flags = ai_safety.sanitize_input(prompt)
            if in_flags:
                logger.info('AIClient.complete: input safety flags %s (feature=%s)', in_flags, self.feature)
                prompt = cleaned

        chosen_model = self._model(model, deep=deep, fast=fast)

        # 1. Rate-limit pre-flight (request count + global $ budget)
        client_id = getattr(self.client, 'id', None)
        rate_limiter.check(client_id, feature=self.feature)
        try:
            from ..security.ai_budget import check_daily_budget, BudgetExceeded
            check_daily_budget(client_id)
        except BudgetExceeded as e:
            raise RateLimited(str(e), scope='budget_daily',
                              limit=int(e.limit), used=int(e.used)) from e

        # 2. Cache lookup
        ckey = cache_key or ai_cache.make_key(prompt, system, chosen_model, temperature)
        if use_cache:
            hit = ai_cache.get(ckey)
            if hit is not None:
                cost_tracker.record_cost(
                    client=self.client, user=self.user, feature=self.feature,
                    model=chosen_model, input_tokens=0, output_tokens=0,
                    duration_ms=0, request_id='cached',
                    prompt_hash=self._hash_prompt(prompt, system, chosen_model),
                    cached=True,
                    request_payload=self._make_request_payload(
                        prompt, system, chosen_model, temperature, max_tokens),
                    response_summary=str(hit)[:200],
                    status='success',
                )
                return hit

        # 3. SDK call
        sdk = self._sdk_client()
        kwargs = {
            'model': chosen_model,
            'max_tokens': max_tokens,
            'temperature': temperature,
            'messages': [{'role': 'user', 'content': prompt}],
        }
        if system:
            kwargs['system'] = system

        t0 = time.monotonic()
        status = 'success'
        err_msg = ''
        text = ''
        in_tok = out_tok = 0
        request_id = ''
        try:
            response = self._call_with_retry(sdk, **kwargs)
            request_id = getattr(response, 'id', '') or ''
            usage = getattr(response, 'usage', None)
            in_tok  = int(getattr(usage, 'input_tokens', 0) or 0)
            out_tok = int(getattr(usage, 'output_tokens', 0) or 0)
            content = getattr(response, 'content', []) or []
            if content and hasattr(content[0], 'text'):
                text = content[0].text or ''
            elif isinstance(content, list) and content:
                # Fallback for older SDK shapes
                text = (content[0].get('text') if isinstance(content[0], dict) else str(content[0])) or ''
        except RateLimited:
            raise
        except Exception as e:
            status = 'error'
            err_msg = str(e)[:1000]
            logger.exception('AIClient.complete failed (feature=%s)', self.feature)
            raise
        finally:
            duration_ms = int((time.monotonic() - t0) * 1000)
            cost_tracker.record_cost(
                client=self.client, user=self.user, feature=self.feature,
                model=chosen_model, input_tokens=in_tok, output_tokens=out_tok,
                duration_ms=duration_ms, request_id=request_id,
                prompt_hash=self._hash_prompt(prompt, system, chosen_model),
                cached=False,
                request_payload=self._make_request_payload(
                    prompt, system, chosen_model, temperature, max_tokens),
                response_summary=text[:200],
                status=status, error_message=err_msg,
            )
            if status == 'success':
                rate_limiter.increment(client_id, feature=self.feature)

        if safety and text:
            from . import safety as ai_safety
            scan = ai_safety.scan_output(text)
            if scan.flags:
                logger.warning('AIClient.complete: output safety flags %s (feature=%s)', scan.flags, self.feature)
            text = scan.clean_text

        if use_cache and text:
            ai_cache.set(ckey, text)

        return text

    # ── Streaming ─────────────────────────────────────────────────────

    def complete_stream(self, prompt: str, *, system: str = '', model: Optional[str] = None,
                        max_tokens: int = 2048, temperature: float = 0.7,
                        fast: bool = False, deep: bool = False) -> Iterable[str]:
        """
        Streaming completion — yields text deltas as they arrive.

        Streaming responses are NOT cached. Logs once at end with totals.
        """
        chosen_model = self._model(model, deep=deep, fast=fast)
        client_id = getattr(self.client, 'id', None)
        rate_limiter.check(client_id, feature=self.feature)

        sdk = self._sdk_client()
        kwargs = {
            'model': chosen_model,
            'max_tokens': max_tokens,
            'temperature': temperature,
            'messages': [{'role': 'user', 'content': prompt}],
        }
        if system:
            kwargs['system'] = system

        t0 = time.monotonic()
        full_text = []
        in_tok = out_tok = 0
        request_id = ''
        status = 'success'
        err_msg = ''
        try:
            with sdk.messages.stream(**kwargs) as stream:
                for chunk in stream.text_stream:
                    full_text.append(chunk)
                    yield chunk
                final = stream.get_final_message()
                request_id = getattr(final, 'id', '') or ''
                usage = getattr(final, 'usage', None)
                in_tok  = int(getattr(usage, 'input_tokens', 0) or 0)
                out_tok = int(getattr(usage, 'output_tokens', 0) or 0)
        except RateLimited:
            raise
        except Exception as e:
            status = 'error'
            err_msg = str(e)[:1000]
            logger.exception('AIClient.complete_stream failed (feature=%s)', self.feature)
            raise
        finally:
            duration_ms = int((time.monotonic() - t0) * 1000)
            text = ''.join(full_text)
            cost_tracker.record_cost(
                client=self.client, user=self.user, feature=self.feature,
                model=chosen_model, input_tokens=in_tok, output_tokens=out_tok,
                duration_ms=duration_ms, request_id=request_id,
                prompt_hash=self._hash_prompt(prompt, system, chosen_model),
                cached=False,
                request_payload=self._make_request_payload(
                    prompt, system, chosen_model, temperature, max_tokens),
                response_summary=text[:200],
                status=status, error_message=err_msg,
            )
            if status == 'success':
                rate_limiter.increment(client_id, feature=self.feature)

    # ── Vision ───────────────────────────────────────────────────────

    def complete_vision(self, prompt: str, image_b64: str, *,
                        media_type: str = 'image/jpeg',
                        system: str = '', model: Optional[str] = None,
                        max_tokens: int = 1024, temperature: float = 0.4) -> str:
        """
        Vision completion. `image_b64` is base64-encoded image data (no data: prefix).

        Always uses Sonnet (multimodal) regardless of `fast` flag. Vision
        responses are not cached by default (they're rarely repeated).
        """
        chosen_model = model or getattr(settings, 'AI_DEFAULT_MODEL', 'claude-sonnet-4-6')
        client_id = getattr(self.client, 'id', None)
        rate_limiter.check(client_id, feature=self.feature)

        sdk = self._sdk_client()
        kwargs = {
            'model': chosen_model,
            'max_tokens': max_tokens,
            'temperature': temperature,
            'messages': [{
                'role': 'user',
                'content': [
                    {'type': 'image', 'source': {'type': 'base64', 'media_type': media_type, 'data': image_b64}},
                    {'type': 'text', 'text': prompt},
                ],
            }],
        }
        if system:
            kwargs['system'] = system

        t0 = time.monotonic()
        status = 'success'
        err_msg = ''
        text = ''
        in_tok = out_tok = 0
        request_id = ''
        try:
            response = self._call_with_retry(sdk, **kwargs)
            request_id = getattr(response, 'id', '') or ''
            usage = getattr(response, 'usage', None)
            in_tok  = int(getattr(usage, 'input_tokens', 0) or 0)
            out_tok = int(getattr(usage, 'output_tokens', 0) or 0)
            content = getattr(response, 'content', []) or []
            if content and hasattr(content[0], 'text'):
                text = content[0].text or ''
        except Exception as e:
            status = 'error'
            err_msg = str(e)[:1000]
            logger.exception('AIClient.complete_vision failed (feature=%s)', self.feature)
            raise
        finally:
            duration_ms = int((time.monotonic() - t0) * 1000)
            cost_tracker.record_cost(
                client=self.client, user=self.user, feature=self.feature,
                model=chosen_model, input_tokens=in_tok, output_tokens=out_tok,
                duration_ms=duration_ms, request_id=request_id,
                prompt_hash=self._hash_prompt(prompt, system, chosen_model),
                cached=False,
                request_payload=self._make_request_payload(
                    prompt, system, chosen_model, temperature, max_tokens),
                response_summary=text[:200],
                status=status, error_message=err_msg,
            )
            if status == 'success':
                rate_limiter.increment(client_id, feature=self.feature)

        return text

    # ── Higher-level helpers ────────────────────────────────────────

    def classify(self, text: str, *, labels: list[str], system: str = '',
                 temperature: float = 0.0) -> str:
        """
        Quick categorical classification using Haiku. Returns one of `labels`
        verbatim, or the first label as a safe fallback.
        """
        if not labels:
            raise AIError('classify() requires non-empty labels')
        prompt = (
            f'Classify the following text into exactly ONE of these categories: '
            f'{", ".join(labels)}.\n\n'
            f'Text:\n"""\n{text}\n"""\n\n'
            f'Respond with ONLY the category label, no explanation.'
        )
        out = self.complete(prompt, system=system, fast=True, temperature=temperature, max_tokens=20)
        out = (out or '').strip()
        for label in labels:
            if label.lower() == out.lower():
                return label
        # Loose match: contains the label as substring
        for label in labels:
            if label.lower() in out.lower():
                return label
        return labels[0]

    def extract_json(self, prompt: str, *, system: str = '', model: Optional[str] = None,
                     max_tokens: int = 1024, temperature: float = 0.4,
                     fast: bool = False, deep: bool = False) -> dict:
        """
        Run a completion and parse the response as JSON. Handles markdown
        code-fences. Raises AIError on unparseable output.
        """
        json_system = (system or '').rstrip()
        json_system += (
            '\n\nIMPORTANT: Respond with valid JSON only. '
            'No prose, no markdown, no commentary outside the JSON object.'
        ).lstrip('\n')

        raw = self.complete(prompt, system=json_system, model=model,
                            max_tokens=max_tokens, temperature=temperature,
                            fast=fast, deep=deep, use_cache=False)
        return _parse_json_loose(raw)


def _parse_json_loose(raw: str) -> dict:
    """Tolerant JSON parser that strips markdown fences and language tags."""
    if not raw:
        raise AIError('Empty response')
    s = raw.strip()
    if s.startswith('```'):
        first_nl = s.find('\n')
        s = s[3:] if first_nl == -1 else s[first_nl + 1:]
        if s.endswith('```'):
            s = s[:-3].strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError as e:
        # Last-ditch: extract the largest {...} or [...] block
        for opener, closer in (('{', '}'), ('[', ']')):
            i = s.find(opener)
            j = s.rfind(closer)
            if i != -1 and j != -1 and j > i:
                try:
                    return json.loads(s[i:j+1])
                except json.JSONDecodeError:
                    pass
        raise AIError(f'Could not parse JSON response: {e}') from e
