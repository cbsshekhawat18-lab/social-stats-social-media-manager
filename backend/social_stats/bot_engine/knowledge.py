# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Knowledge-base retrieval for `ai_chat` nodes with `use_knowledge`.

`retrieve(client_id, query)` returns the passages of the workspace's
BotKnowledgeDoc rows that best match the customer's message:

  1. Candidate documents — rows of this client only — that share a keyword
     with the query; on PostgreSQL with pg_trgm installed, trigram
     word-similarity also brings in near-misses (typos, inflections).
  2. Each candidate is cut into passages and scored on keyword overlap
     (title matches weigh more) plus a trigram bonus; the top few are returned.

Deliberately simple: no embeddings, no external service.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from django.db import connection
from django.db.models import Q

logger = logging.getLogger(__name__)

MAX_PASSAGES = 4
PASSAGE_CHARS = 700
MAX_CANDIDATE_DOCS = 40
TRIGRAM_THRESHOLD = 0.3

_TOKEN = re.compile(r"[\w\u0900-\u097F]+", re.UNICODE)
_STOPWORDS = frozenset("""
a an the is are was were be been am do does did have has had i you we they he she it my your our
me to of in on at for with and or but not no yes can could will would should what when where which
who how why this that these those there here please tell about any some from as by if so
hai hain ka ki ke ko se mein kya aur bhi ho
""".split())


@dataclass(frozen=True)
class Passage:
    doc_id: int
    title: str
    text: str
    score: float


def keywords(text: str) -> list[str]:
    seen, out = set(), []
    for tok in _TOKEN.findall((text or '').lower()):
        if len(tok) < 2 or tok in _STOPWORDS or tok in seen:
            continue
        seen.add(tok)
        out.append(tok)
    return out[:24]


def _trigrams(word: str) -> set[str]:
    padded = f'  {word} '
    return {padded[i:i + 3] for i in range(len(padded) - 2)}


def _similar(a: str, b: str) -> float:
    ta, tb = _trigrams(a), _trigrams(b)
    return len(ta & tb) / len(ta | tb) if ta and tb else 0.0


_trgm_state: dict[str, bool] = {}


def trigram_available() -> bool:
    """True on PostgreSQL when the pg_trgm extension is installed (cached per
    database alias for the life of the process)."""
    alias = connection.alias + ':' + str(connection.settings_dict.get('NAME'))
    if alias not in _trgm_state:
        ok = False
        if connection.vendor == 'postgresql':
            try:
                with connection.cursor() as cur:
                    cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'")
                    ok = cur.fetchone() is not None
            except Exception:  # noqa: BLE001
                ok = False
        _trgm_state[alias] = ok
    return _trgm_state[alias]


def _candidates(client_id: int, query: str, tokens: list[str]):
    from ..models import BotKnowledgeDoc

    docs = BotKnowledgeDoc.objects.filter(client_id=client_id)       # tenant-scoped
    keyword_q = Q()
    for tok in tokens:
        keyword_q |= Q(title__icontains=tok) | Q(content__icontains=tok)

    if trigram_available():
        from django.contrib.postgres.search import TrigramWordSimilarity
        from django.db.models.functions import Greatest
        try:
            return list(
                docs.annotate(sim=Greatest(TrigramWordSimilarity(query, 'title'),
                                           TrigramWordSimilarity(query, 'content')))
                .filter(keyword_q | Q(sim__gte=TRIGRAM_THRESHOLD))
                .order_by('-sim', '-updated_at')[:MAX_CANDIDATE_DOCS]
            )
        except Exception:  # noqa: BLE001 — fall back to keywords
            logger.exception('trigram knowledge search failed; using keyword match')
    return list(docs.filter(keyword_q).order_by('-updated_at')[:MAX_CANDIDATE_DOCS])


def _passages(content: str) -> list[str]:
    """Paragraph-aligned chunks of at most ~PASSAGE_CHARS characters."""
    out, current = [], ''
    for para in re.split(r'\n\s*\n|\r\n\s*\r\n', content or ''):
        para = para.strip()
        if not para:
            continue
        while len(para) > PASSAGE_CHARS:           # one very long paragraph
            cut = para.rfind(' ', 0, PASSAGE_CHARS)
            cut = cut if cut > PASSAGE_CHARS // 2 else PASSAGE_CHARS
            out.append(para[:cut].strip())
            para = para[cut:].strip()
        if current and len(current) + len(para) + 2 > PASSAGE_CHARS:
            out.append(current)
            current = para
        else:
            current = f'{current}\n\n{para}' if current else para
    if current:
        out.append(current)
    return out


def _match(tok: str, words: set[str]) -> float:
    """1.0 for an exact word match, the trigram similarity for a near-miss
    (typo / inflection) of a word of similar length, else 0."""
    if tok in words:
        return 1.0
    if len(tok) < 4:
        return 0.0
    best = max((_similar(tok, w) for w in words if abs(len(w) - len(tok)) <= 3), default=0.0)
    return best if best >= 0.4 else 0.0


def _score(tokens: list[str], title: str, text: str) -> float:
    title_words = set(keywords(title))
    text_words = set(_TOKEN.findall(text.lower()))
    score = 0.0
    for tok in tokens:
        in_text, in_title = _match(tok, text_words), _match(tok, title_words)
        score += in_text if in_text == 1.0 else in_text * 0.8
        score += 0.75 * in_title            # a hit in the title lifts all of that document's passages
    return score


def retrieve(client_id: int, query: str, *, limit: int = MAX_PASSAGES) -> list[Passage]:
    tokens = keywords(query)
    if not tokens or not client_id:
        return []
    found: list[Passage] = []
    for doc in _candidates(client_id, query, tokens):
        for text in _passages(doc.content):
            score = _score(tokens, doc.title, text)
            if score > 0:
                found.append(Passage(doc.id, doc.title, text, round(score, 3)))
    found.sort(key=lambda p: p.score, reverse=True)
    return found[:limit]


def context_block(passages: list[Passage]) -> str:
    """System-prompt section for the passages (empty string when none)."""
    if not passages:
        return ''
    parts = [f'[{i}] {p.title}\n{p.text}' for i, p in enumerate(passages, 1)]
    return '\n\n'.join(parts)
