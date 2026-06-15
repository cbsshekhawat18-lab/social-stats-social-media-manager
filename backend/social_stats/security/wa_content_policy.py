# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
WhatsApp content policy pre-send check.

Meta's WhatsApp Business policy bans certain categories outright:
  • Cryptocurrency / NFT promotion
  • Gambling / betting / lotteries
  • Adult content
  • Illegal substances (cannabis-as-medicine slips through depending on
    region, but recreational explicitly bans)
  • Get-rich-quick / MLM / pyramid schemes
  • Weapons / firearms
  • Misleading health claims (cure-cancer-with-this-tea)

We run a CHEAP keyword pre-screen on every outbound template body + free-form
send. Matches result in either:
  • REJECT (high-confidence keywords)
  • WARN (low-confidence — ambiguous; logged but allowed)

This is INTENTIONALLY not an AI moderation call — it's a fast filter to
prevent obvious violations from going out. Meta still does its own template
review; this is about the free-form path AND about helping users notice
problems before submitting templates for approval.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass


logger = logging.getLogger(__name__)


# Keep these focused — false positives kill UX. Each pattern is checked
# case-insensitively, with whole-word boundaries where helpful.
HARD_BLOCKED = {
    'cryptocurrency': [
        r'\b(bitcoin|btc|ethereum|eth|altcoin|crypto|defi|nft)\s+(invest|trading|gain|profit|airdrop)',
        r'\binvest in (bitcoin|crypto|nft)',
        r'\bcrypto airdrop',
    ],
    'gambling': [
        r'\b(casino|betting|sportsbook|jackpot)\b',
        r'\b(roulette|blackjack|poker chips)\b',
        r'\bplace your bet',
    ],
    'adult_content': [
        r'\b(escort|sex chat|adult cam)\b',
        r'\bxxx\b',
    ],
    'illegal_substances': [
        r'\b(cocaine|heroin|meth|mdma|ecstasy)\b',
        r'\brecreational (cannabis|weed)\b',
    ],
    'get_rich_quick': [
        r'\b(MLM|pyramid scheme)\b',
        r'\bguaranteed (income|returns?)\b',
        r'\bdouble your money in \d+',
    ],
    'weapons': [
        r'\b(firearm|handgun|assault rifle|ammunition)\s+(sale|deal|discount|offer)',
    ],
    'misleading_health': [
        r'\bcure (cancer|diabetes|hiv)\b',
        r'\b100% guaranteed cure\b',
        r'\bmiracle (cure|drug|treatment)\b',
    ],
}

SOFT_FLAGGED = {
    'urgency_pressure': [
        r'\bact now or lose\b',
        r'\bonly \d+ left\b.*\bhurry\b',
    ],
    'too_many_emojis': [
        # 7+ emojis in a row is spam-coded
        r'(?:[\U0001F300-\U0001FAFF\U00002600-\U000027BF]\s*){7,}',
    ],
    'all_caps': [
        # 30+ char stretch in ALL CAPS suggests shouting / spam
        r'\b[A-Z]{30,}\b',
    ],
}


@dataclass
class ContentDecision:
    allow: bool
    reason: str       # 'ok' | 'blocked:<category>' | 'warn:<category>'
    category: str     # the category that fired
    snippet: str      # the matching substring

    def __bool__(self) -> bool:
        return self.allow


def check_content(text: str) -> ContentDecision:
    """Single entry point. Run hard rules first, then soft. Empty input is allowed."""
    if not text:
        return ContentDecision(allow=True, reason='ok', category='', snippet='')

    for category, patterns in HARD_BLOCKED.items():
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                return ContentDecision(
                    allow=False, reason=f'blocked:{category}',
                    category=category, snippet=m.group(0)[:80],
                )

    for category, patterns in SOFT_FLAGGED.items():
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                return ContentDecision(
                    allow=True, reason=f'warn:{category}',
                    category=category, snippet=m.group(0)[:80],
                )

    return ContentDecision(allow=True, reason='ok', category='', snippet='')


def assert_marketing_target_opted_in(contact, template) -> None:
    """Raise if a marketing template is being sent to a non-opted-in contact.

    Meta strictly bans marketing-category sends to anyone who hasn't given
    explicit opt-in. Utility / Authentication categories don't have this
    restriction.
    """
    if not contact or not template:
        return
    category = getattr(template, 'category', '') or ''
    if category.lower() != 'marketing':
        return
    status = getattr(contact, 'opt_in_status', '')
    if status != 'opted_in':
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied(
            f'Cannot send marketing template to contact with opt-in status='
            f'{status!r}. Marketing requires explicit opt-in (Meta WA policy).'
        )
