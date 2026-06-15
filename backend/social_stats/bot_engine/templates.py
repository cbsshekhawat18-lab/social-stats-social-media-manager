# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Tiny variable-interpolation renderer for bot messages.

Supports:
    {{variable}}                — top-level variable lookup
    {{custom_field.colour}}     — dotted lookup (one level deep)
    {{contact.name}}            — accesses well-known runtime keys
    {{name|default:"there"}}    — default-value filter

Intentionally NOT a full Jinja — we don't trust user-authored templates
to be Turing-complete. Anything more complex is a flow-design problem, not
a string-interpolation problem.
"""
from __future__ import annotations

import re
from typing import Any


_TOKEN_RE = re.compile(r'\{\{\s*([^}]+?)\s*\}\}')
_DEFAULT_RE = re.compile(r'^([^|]+?)\s*\|\s*default:\s*"(.*)"\s*$')


def _resolve(path: str, variables: dict) -> Any:
    """Resolve a dotted path against the variables dict. Missing keys → ''.

    `path` must already be the bare expression (no whitespace, no filter).
    """
    parts = path.split('.')
    cur: Any = variables
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return ''
    return cur


def render(text: str, variables: dict | None = None) -> str:
    """Replace {{tokens}} with values from `variables`. Always returns a string."""
    if not text:
        return ''
    variables = variables or {}

    def _sub(match: re.Match) -> str:
        expr = match.group(1).strip()
        default = ''
        m = _DEFAULT_RE.match(expr)
        if m:
            expr = m.group(1).strip()
            default = m.group(2)
        val = _resolve(expr, variables)
        if val in (None, ''):
            return default
        return str(val)

    return _TOKEN_RE.sub(_sub, text)
