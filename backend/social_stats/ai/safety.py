# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Content safety + ethics filters.

Two layers, both regex-based for speed and zero extra cost:

  1. Pre-generation:  sanitize_input(text)
     Strips obvious prompt-injection attempts before we send to the model.
     Returns (cleaned_text, removed_flags).

  2. Post-generation: scan_output(text)
     Inspects the assistant's response for:
       - Hate / slur keywords (English + Hindi common forms)
       - PII leaks (phone numbers, email addresses)
       - Hallucinated-looking stat phrases ("over 5 million users", "70%")
         on a "warn" basis — never blocks, just flags
     Returns ScanResult with .flags + .clean_text (PII-redacted by default).

Plus:
    add_disclaimer(text, kind) — append the right regulatory disclaimer
    for medical / legal / financial AI-generated content.

These run in pure Python — no extra AI call. The aim is "good enough, fast,
free" guardrails on every AI request, with optional Claude-based moderation
as a follow-up.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Iterable

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# 1. Input sanitisation — prompt injection
# ─────────────────────────────────────────────────────────────────────────

# Common prompt-injection markers. Conservative — only the most obvious tells.
INJECTION_PATTERNS = [
    re.compile(r'ignore (all |the )?(previous|above|prior|earlier) (instructions?|prompts?|rules?)', re.I),
    re.compile(r'disregard (all |the )?(previous|above|prior|earlier) (instructions?|rules?)',         re.I),
    re.compile(r'(?:you are|act as|pretend to be|roleplay as)\s+(?:a\s+)?(?:dan|jailbroken|unrestricted|developer mode|admin)', re.I),
    re.compile(r'\b(system|assistant)\s*[:=]\s*[\'"]', re.I),
    re.compile(r'<\s*system\s*>', re.I),
    re.compile(r'</\s*system\s*>', re.I),
    re.compile(r'\boverride\s+(?:safety|guardrails?|rules?)\b', re.I),
    re.compile(r'\breveal\s+(?:your\s+)?(?:system\s+)?prompt\b', re.I),
    re.compile(r'\bprint\s+your\s+(?:full\s+)?(?:system\s+)?prompt\b', re.I),
]

INJECTION_MAX_LEN = 16000  # truncate absurdly long inputs


def sanitize_input(text: str, max_len: int = INJECTION_MAX_LEN) -> tuple[str, list[str]]:
    """
    Strip obvious prompt-injection attempts from user-supplied text.

    Returns (cleaned_text, flags) where flags is a list of detection labels
    (empty when nothing was found).
    """
    if not text:
        return '', []

    flags: list[str] = []
    cleaned = text

    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len]
        flags.append('truncated_overlong')

    for i, pat in enumerate(INJECTION_PATTERNS):
        if pat.search(cleaned):
            flags.append(f'injection_pattern_{i}')
            cleaned = pat.sub('[…]', cleaned)

    return cleaned, flags


# ─────────────────────────────────────────────────────────────────────────
# 2. Output scanning — hate / PII / hallucinated stats
# ─────────────────────────────────────────────────────────────────────────

# A small, intentionally-conservative slur list used as a hard block. We do
# NOT enumerate slurs in source code — instead we keep a hand-picked set of
# the most common hate-speech indicators in English to flag for review.
# Operators: extend HATE_TERMS via settings.AI_HATE_TERMS in production.
HATE_TERMS_DEFAULT = [
    # Generic flags — categories rather than slurs to keep this list safe.
    'kill (yourself|all)',
    '(go|hang) yourself',
    '(stupid|dumb) (girl|woman|man|boy)',
]

PII_PATTERNS = {
    'email': re.compile(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', re.I),
    # Indian + international phone-number-ish patterns. Very approximate.
    'phone': re.compile(r'(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,4}\d{2,4}'),
    # Indian PAN (legal-id) and Aadhaar pattern (12 digits).
    'pan':       re.compile(r'\b[A-Z]{5}\d{4}[A-Z]\b'),
    'aadhaar':   re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\b'),
    'credit_card': re.compile(r'\b(?:\d[ -]*?){13,16}\b'),
}

# "Hallucinated stat" red-flag phrases. Used as soft warnings only.
STAT_RED_FLAGS = [
    re.compile(r'\b(?:over|more than|approximately|around)\s+\d+(?:\.\d+)?\s*(?:million|billion|m|b|k|%|percent)\b', re.I),
    re.compile(r'\bstudies (?:have )?shown\b', re.I),
    re.compile(r'\baccording to (?:research|studies|experts)\b', re.I),
]


@dataclass
class ScanResult:
    clean_text: str
    flags: list[str] = field(default_factory=list)
    redacted_count: int = 0
    has_pii: bool = False
    has_hate: bool = False
    has_stats_warning: bool = False


def _hate_terms() -> list[str]:
    try:
        from django.conf import settings as dj
        return list(getattr(dj, 'AI_HATE_TERMS', []) or HATE_TERMS_DEFAULT)
    except Exception:
        return HATE_TERMS_DEFAULT


def scan_output(text: str, *, redact_pii: bool = True) -> ScanResult:
    """
    Scan a generated output for hate / PII / hallucinated-stat signals.
    Always returns a ScanResult — this never raises.

    `redact_pii=True` replaces detected emails / phone numbers / PAN / Aadhaar
    with a `[redacted-…]` token in `clean_text`. Set False to keep the raw
    text and just report flags.
    """
    out = ScanResult(clean_text=text or '')
    if not text:
        return out

    # Hate-keyword check
    for term in _hate_terms():
        try:
            if re.search(term, text, re.I):
                out.flags.append(f'hate:{term}')
                out.has_hate = True
        except re.error:
            continue

    # PII check
    for label, pat in PII_PATTERNS.items():
        matches = list(pat.finditer(out.clean_text))
        if not matches:
            continue
        # phone has many false positives — only flag/redact when 2+ digits cluster
        if label == 'phone':
            matches = [m for m in matches if len(re.sub(r'\D', '', m.group(0))) >= 8]
            if not matches:
                continue
        out.flags.append(f'pii:{label}:{len(matches)}')
        out.has_pii = True
        if redact_pii:
            out.clean_text = pat.sub(f'[redacted-{label}]', out.clean_text, count=0)
            out.redacted_count += len(matches)

    # Hallucinated-stat check — never blocks, just warns
    for i, pat in enumerate(STAT_RED_FLAGS):
        if pat.search(out.clean_text):
            out.flags.append(f'stat_warning:{i}')
            out.has_stats_warning = True
            break  # one warning is enough

    return out


# ─────────────────────────────────────────────────────────────────────────
# 3. Disclaimers for sensitive verticals
# ─────────────────────────────────────────────────────────────────────────

DISCLAIMERS = {
    'medical':   'AI-generated. Verify with a qualified medical professional before publishing or acting on this information.',
    'legal':     'AI-generated. Not legal advice. Consult a qualified attorney for your specific situation.',
    'financial': 'AI-generated. Not financial advice. Consult a SEBI-registered advisor before making investment decisions.',
    'health':    'AI-generated. For informational purposes only — not a substitute for medical advice.',
    'general':   'Generated with Social Stats assistance. Review before publishing.',
}


def add_disclaimer(text: str, kind: str = 'general') -> str:
    """Append an appropriate regulatory disclaimer to AI-generated content."""
    if not text:
        return text
    note = DISCLAIMERS.get(kind, DISCLAIMERS['general'])
    sep = '\n\n— '
    return f'{text.rstrip()}{sep}{note}'
