# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Prompt templates for AI features.

Every template module exports `build_prompt(**kwargs) -> dict` with keys:
    system        — system message (optional, '' allowed)
    user_message  — user-side prompt
    max_tokens    — recommended max output tokens
    temperature   — recommended temperature (0.0 deterministic … 1.0 creative)
    model         — optional model override (None = use AIClient default)
    use_cache     — optional bool (default True; False for inherently variable outputs)

Templates take the brand-voice context as an optional `brand_voice` arg and
weave it into the system prompt — keep generation aligned with the client's
trained tone.

Public:
    load(name) -> module                — dynamic loader by template name
    build(name, **kwargs) -> dict       — convenience wrapper
"""
from __future__ import annotations

import importlib
from types import ModuleType


def load(name: str) -> ModuleType:
    """Import a prompt template module by short name."""
    if not name or '/' in name or '.' in name:
        raise ValueError(f'invalid prompt name: {name!r}')
    return importlib.import_module(f'social_stats.ai.prompts.{name}')


def build(name: str, **kwargs) -> dict:
    """Build a prompt dict from the named template."""
    return load(name).build_prompt(**kwargs)


# Brand-voice helper used by every template that generates content.
def _brand_voice_block(brand_voice: str = '') -> str:
    if not brand_voice:
        return ''
    return f'\n\nThis client has a trained brand voice. Honour it when generating:\n{brand_voice}'
