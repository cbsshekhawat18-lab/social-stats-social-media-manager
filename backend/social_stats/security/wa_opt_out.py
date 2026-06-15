# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
multilingual WhatsApp opt-out detection.

Meta requires us to honour STOP / UNSUBSCRIBE / equivalent in any language
the user might use. We strip casing, punctuation, and whitespace, then test
against a curated keyword set. A single match in any of the user's languages
is enough — false positives are rare and "false negative blocks marketing"
is a much worse failure mode than "false positive blocks marketing".

Once detected, ``apply_opt_out`` does the right thing atomically:
    1. flip WhatsAppContact.opt_in_status → 'opted_out'
    2. stamp opt_out_at + opt_out_keyword
    3. send the legally-required confirmation reply (best-effort)
    4. emit a SecurityAuditLog row

Caller (the inbound webhook) just does:

    if was_opt_out_message(text):
        apply_opt_out(contact, keyword=text, request=request)
        return  # don't run the rest of inbound handling
"""
from __future__ import annotations

import logging
import re
from typing import Iterable

from django.utils import timezone


logger = logging.getLogger(__name__)


# Curated multilingual opt-out keyword set. Compared as lowercase, with all
# non-letter characters stripped (so "STOP!", " stop ", "S T O P" all match).
# Keep this list small + obvious — the cost of a false positive is one user
# who has to ping support; the cost of a false negative is a Meta violation.
_OPT_OUT_KEYWORDS: set[str] = {
    # English
    'stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'optout',
    # Spanish / Portuguese
    'parar', 'baja', 'cancelar',
    # French
    'arret', 'arreter',
    # German
    'stopp', 'beenden',
    # Hindi (Latin-transliterated + Devanagari)
    'band', 'bandkaro', 'rok', 'rokdo',
    'बंद', 'रोको', 'रोक',
    # Tamil
    'நிறுத்து',
    # Telugu
    'ఆపండి',
    # Bengali
    'বন্ধ',
    # Marathi / Gujarati
    'बंदकरा', 'બંધ',
    # Arabic
    'توقف', 'الغاء',
    # Indonesian / Malay
    'henti', 'berhenti',
    # Filipino
    'tumigil',
    # Vietnamese
    'dung',
    # Mandarin / Cantonese
    '停止', '取消',
    # Japanese
    '停止', 'キャンセル',
    # Korean
    '중지', '취소',
    # Russian
    'стоп',
}


# Strip everything except letters (any script) — gives us a clean comparable
# token even if the user wrote "S.T.O.P!" or " parar :)".
_NON_LETTER_RE = re.compile(r'\W+', re.UNICODE)


def normalise(text: str) -> str:
    if not text:
        return ''
    return _NON_LETTER_RE.sub('', text).lower()


def was_opt_out_message(text: str, *, extra_keywords: Iterable[str] = ()) -> tuple[bool, str]:
    """Return ``(matched, keyword)``. The returned keyword is the keyword
    that matched (so the caller can store it on the contact)."""
    norm = normalise(text or '')
    if not norm:
        return False, ''

    # Normalise BOTH sides so combining marks / casing differences don't
    # cause false negatives (e.g. Devanagari "बंद" includes a combining
    # anusvara that may or may not survive \w-regex matching).
    keywords = {normalise(k) for k in (set(_OPT_OUT_KEYWORDS) | set(extra_keywords))}
    keywords.discard('')

    # Whole-message match (most reliable)
    if norm in keywords:
        return True, norm

    for kw in sorted(keywords, key=len, reverse=True):
        if len(kw) < 3:
            continue
        # Latin-script keywords must hit a word-boundary so "STOP" matches in
        # "Hi, STOP this please" but NOT in "stopover".
        if kw.isascii() and kw.isalpha():
            pattern = re.compile(rf'(?<!\w){re.escape(kw)}(?!\w)',
                                 re.IGNORECASE | re.UNICODE)
            if pattern.search(text or ''):
                return True, kw
            continue
        # Non-Latin scripts (CJK, Devanagari, Arabic, etc.) often have no
        # word boundaries — fall back to substring on the normalised text.
        if kw in norm:
            return True, kw

    return False, ''


def apply_opt_out(contact, *, keyword: str = '', request=None, send_confirmation: bool = True) -> None:
    """Atomically flip the contact to opted-out, audit, and send the
    confirmation reply Meta requires."""
    from ..models import WhatsAppContact

    if not isinstance(contact, WhatsAppContact):
        return
    if contact.opt_in_status == 'opted_out':
        return  # already opted out — idempotent

    now = timezone.now()
    contact.opt_in_status   = 'opted_out'
    contact.opt_out_at      = now
    contact.opt_out_keyword = (keyword or '')[:40]
    contact.save(update_fields=['opt_in_status', 'opt_out_at', 'opt_out_keyword',
                                'updated_at'])

    # Audit log
    try:
        from . import audit
        audit.record(
            event_type='consent_withdrawn',
            request=request,
            target_object_type='WhatsAppContact', target_object_id=contact.id,
            target_client=contact.client,
            description=f'WhatsApp opt-out via keyword: {keyword!r}',
            metadata={'keyword': keyword, 'phone_last4': str(contact.phone)[-4:]},
        )
    except Exception:
        pass

    # Meta requires confirmation that the request was processed. Best-effort —
    # if Pinbot is misconfigured, we'd rather honour the opt-out than crash.
    if send_confirmation:
        try:
            from ..whatsapp_service import get_pinbot_for_client
            svc = get_pinbot_for_client(contact.client_id)
            if svc:
                svc.send_text(contact.phone,
                              "You've been unsubscribed and will no longer "
                              "receive marketing messages from us. Reply START "
                              "to opt back in.")
        except Exception:
            logger.warning('opt-out confirmation send failed for contact=%s',
                           contact.id, exc_info=True)
