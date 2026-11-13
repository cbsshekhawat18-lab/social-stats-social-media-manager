"""MkDocs hooks for the docs site's machine-readable surfaces (mkdocs.yml `hooks:`).

- Every page has a front-matter ``description``, and no two pages share a
  title or a description; a miss is a warning, which ``strict: true`` fails.
- The homepage's description is ``site_description`` verbatim, and it carries
  schema.org ``SoftwareApplication`` JSON-LD; a page with ``faq: true`` in its
  front matter carries ``FAQPage`` JSON-LD built from its ``## Question?``
  headings and the paragraphs under them.
- ``llms-full.txt`` is written at the site root: the plain-text Markdown of the
  pages listed in ``LLMS_FULL``, each under its URL.

The JSON-LD reaches the page through docs/overrides/main.html.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

log = logging.getLogger("mkdocs.hooks.socialstats_seo")

ROOT = Path(__file__).resolve().parents[1]
PRODUCT_PAGE = "https://gigaikripaservices.com/social-stats/"
IMAGES = "https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/pkgs/container/social-stats-backend"

#: The pages llms-full.txt concatenates, in reading order (docs-relative paths).
LLMS_FULL = [
    "index.md",
    "features.md",
    "faq.md",
    "GETTING_STARTED.md",
    "CONFIGURATION.md",
    "CONNECT_ACCOUNTS.md",
    "CONNECT_WHATSAPP.md",
    "GOING_LIVE.md",
    "USER_GUIDE.md",
    "COMPARISON.md",
    "FAQ_TROUBLESHOOTING.md",
]

_seen_titles: dict[str, str] = {}
_seen_descriptions: dict[str, str] = {}
_markdown: dict[str, str] = {}


def _version() -> str:
    """The newest release in CHANGELOG.md (``## [2.0.0] - 2026-11-13``)."""
    match = re.search(r"^## \[(\d+\.\d+\.\d+)\]", (ROOT / "CHANGELOG.md").read_text(encoding="utf-8"), re.M)
    return match.group(1) if match else ""


def _plain(markdown: str) -> str:
    """Markdown inline syntax to plain text, for JSON-LD answers."""
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", markdown)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"(\*\*|__|\*|_)(\S(?:.*?\S)?)\1", r"\2", text)
    return re.sub(r"\s+", " ", text).strip()


def faq_pairs(markdown: str) -> list[tuple[str, str]]:
    """``(question, answer)`` for every ``## ...?`` heading and the paragraphs under it."""
    pairs: list[tuple[str, str]] = []
    for block in re.split(r"^## ", markdown, flags=re.M)[1:]:
        heading, _, body = block.partition("\n")
        question = _plain(heading)
        if not question.endswith("?"):
            continue
        answer = re.split(r"^#{1,6} ", body, maxsplit=1, flags=re.M)[0]
        prose = (line for line in answer.splitlines() if not line.startswith(("|", "```", "    ")))
        answer = _plain("\n".join(prose))
        if answer:
            pairs.append((question, answer))
    return pairs


def _jsonld(data: dict[str, Any]) -> str:
    # "</" would end the <script> element early.
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def on_config(config: Any) -> Any:
    _seen_titles.clear()
    _seen_descriptions.clear()
    _markdown.clear()
    return config


def on_page_markdown(markdown: str, page: Any, config: Any, files: Any) -> str:
    path = page.file.src_uri
    _markdown[path] = markdown
    description = str(page.meta.get("description") or "").strip()
    if not description:
        log.warning("%s has no front-matter description (every page needs its own).", path)
    elif description in _seen_descriptions:
        log.warning("%s repeats the description of %s.", path, _seen_descriptions[description])
    else:
        _seen_descriptions[description] = path
    title = str(page.meta.get("title") or page.title or "")
    if title in _seen_titles:
        log.warning("%s repeats the title %r of %s.", path, title, _seen_titles[title])
    else:
        _seen_titles[title] = path

    blocks: list[str] = []
    site = str(config["site_url"])
    if page.is_homepage:
        if description != config["site_description"]:
            log.warning("index.md's description must be site_description (mkdocs.yml) verbatim.")
        blocks.append(_jsonld({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Social Stats",
            "description": config["site_description"],
            "url": site,
            "applicationCategory": "BusinessApplication",
            "applicationSubCategory": "Social media management",
            "operatingSystem": "Linux, macOS, Windows (Docker)",
            "softwareVersion": _version(),
            "license": "https://opensource.org/license/mit",
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "codeRepository": str(config["repo_url"]),
            "screenshot": site + "images/analytics.png",
            "author": {"@type": "Organization", "name": "Gigai Kripa Services",
                       "url": "https://gigaikripaservices.com/"},
            "sameAs": [str(config["repo_url"]), PRODUCT_PAGE, IMAGES],
        }))
    if page.meta.get("faq"):
        pairs = faq_pairs(markdown)
        if not pairs:
            log.warning("%s sets faq: true but has no '## Question?' headings.", path)
        blocks.append(_jsonld({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in pairs
            ],
        }))
    page.meta["ss_jsonld"] = blocks
    return markdown


def on_post_build(config: Any) -> None:
    site = str(config["site_url"])
    missing = [path for path in LLMS_FULL if path not in _markdown]
    if missing:
        log.warning("llms-full.txt lists pages that do not exist: %s", ", ".join(missing))
    parts = [f"# Social Stats\n\n> {config['site_description']}\n\nSource: {config['repo_url']}\n"
             f"Product page: {PRODUCT_PAGE}\n"]
    for path in LLMS_FULL:
        if path not in _markdown:
            continue
        url = site + ("" if path == "index.md" else path.removesuffix(".md") + ".html")
        body = re.sub(r"\A---\n.*?\n---\n", "", _markdown[path], flags=re.S).strip()
        parts.append(f"\n---\n\nURL: {url}\n\n{body}\n")
    Path(config["site_dir"], "llms-full.txt").write_text("".join(parts), encoding="utf-8")
