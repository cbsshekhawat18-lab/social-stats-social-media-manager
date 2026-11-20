# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Conversation language: Hindi, Hinglish or English.

Detected from the customer's first message with a cheap heuristic (no AI
call) and stored in `variables['_lang']`; AI nodes are then told to reply in
that language.

    'hi'        Hindi in Devanagari script        "मुझे जानकारी चाहिए"
    'hinglish'  Hindi written in Latin letters     "mujhe price batao"
    'en'        English (and anything else)
"""
from __future__ import annotations

import re
from typing import Optional

_DEVANAGARI = re.compile(r'[\u0900-\u097F]')
_WORD = re.compile(r"[a-zA-Z']+")

# Romanised Hindi words that are not also common English words.
_HINGLISH_WORDS = frozenset("""
hai hain hoon hu hun ho tha thi raha rahi rahe hoga hogi hua hui
kya kaise kaisa kaisi kitna kitne kitni kab kahan kaha kyun kyu kyon kaun kaunsa konsa
nahi nahin nhi mat haan han ji bilkul zaroor jarur
mujhe mujhko mera meri mere aap aapka aapki aapke tum tumhara hum humein hamara
yeh ye woh wo iska uska inka unka kuch sab bahut bohot thoda zyada jyada kam
accha acha achha theek thik sahi galat
chahiye chahta chahti chahte karna karo kariye karein karenge karunga karungi kar
batao bataiye bataye bata dijiye dedo dena lena lunga lungi milega milegi milta
bhej bhejo bhejiye bhejna dikhao dikhaiye dekhna dekho samjha samjhao
ka ki ke ko se mein par aur ya bhi lekin magar agar toh phir fir abhi kal aaj baad pehle
liye saath sath wala wali wale waha yaha yahan wahan idhar udhar
namaste namaskar dhanyavaad dhanyawad shukriya kripya madad jankari jaankari
paisa paise rupaye rupay rupaiye daam kimat keemat sasta mehnga mahanga
ghar dukaan dukan kaam naam samay din raat mahina saal log bhai didi
""".split())

LANGUAGE_NAMES = {'hi': 'Hindi', 'hinglish': 'Hinglish', 'en': 'English'}


def detect_language(text: str) -> Optional[str]:
    """'hi' | 'hinglish' | 'en', or None when the text has no words to judge."""
    text = text or ''
    if len(_DEVANAGARI.findall(text)) >= 2:
        return 'hi'
    words = [w.lower() for w in _WORD.findall(text)]
    if not words:
        return None
    hits = sum(1 for w in words if w in _HINGLISH_WORDS)
    if hits >= 2 or (hits == 1 and len(words) <= 3):
        if hits / len(words) >= 0.2:
            return 'hinglish'
    return 'en'


def is_confident(text: str, lang: Optional[str]) -> bool:
    """A one- or two-word English guess ("Hi", "Price?") says little; the
    next message gets to overrule it."""
    if lang in ('hi', 'hinglish'):
        return True
    return len(_WORD.findall(text or '')) >= 3


def reply_instruction(lang: Optional[str]) -> str:
    """Line added to an AI node's system prompt."""
    if lang == 'hi':
        return 'Reply in Hindi, written in Devanagari script.'
    if lang == 'hinglish':
        return ('Reply in Hinglish — conversational Hindi written in Latin (English) letters, '
                'the way the customer writes. Do not use Devanagari script.')
    if lang == 'en':
        return 'Reply in English.'
    return "Reply in the language the customer writes in."
