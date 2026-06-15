# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Safe expression evaluator for `condition` nodes.

We deliberately avoid `eval()` / `simpleeval` and accept a small declarative
shape instead — easier to validate, easier to render in the UI, immune to
template-injection attacks.

A condition is a dict like:

    {
        "operator": "and",            # 'and' | 'or' | leaf operator
        "rules": [                    # only present for and/or
            {"left": "budget", "op": ">=", "right": 5000000},
            {"left": "interest", "op": "contains", "right": "rent"},
        ],
    }

Or a leaf (passed directly):

    {"left": "interest", "op": "==", "right": "buy"}

Supported leaf operators:
    ==  !=  >  <  >=  <=  contains  starts_with  ends_with  regex_match  is_empty  is_not_empty

`left` values are resolved from the conversation's variables dict (dotted
lookups supported, same shape as templates.py). `right` is taken literally.
"""
from __future__ import annotations

import re
from typing import Any

from .templates import _resolve


_NUMERIC_OPS = {'>', '<', '>=', '<='}


def _coerce_pair(left: Any, right: Any) -> tuple:
    """Coerce both sides to numbers when at least one looks numeric."""
    try:
        return float(left), float(right)
    except (TypeError, ValueError):
        return left, right


def _eval_leaf(rule: dict, variables: dict) -> bool:
    op = (rule or {}).get('op', '==')
    left = _resolve((rule or {}).get('left', ''), variables)
    right = (rule or {}).get('right', '')

    if op == 'is_empty':
        return left in (None, '', [], {})
    if op == 'is_not_empty':
        return left not in (None, '', [], {})

    if op in _NUMERIC_OPS:
        try:
            l, r = _coerce_pair(left, right)
            return {'>': l > r, '<': l < r, '>=': l >= r, '<=': l <= r}[op]
        except Exception:
            return False

    sl = '' if left is None else str(left)
    sr = '' if right is None else str(right)

    if op == '==':         return sl == sr
    if op == '!=':         return sl != sr
    if op == 'contains':   return sr.lower() in sl.lower()
    if op == 'starts_with':return sl.lower().startswith(sr.lower())
    if op == 'ends_with':  return sl.lower().endswith(sr.lower())
    if op == 'regex_match':
        try:
            return bool(re.search(sr, sl))
        except re.error:
            return False
    return False


def evaluate(condition: dict, variables: dict) -> bool:
    """Evaluate a (possibly compound) condition tree."""
    if not isinstance(condition, dict):
        return False

    operator = condition.get('operator')
    if operator in ('and', 'or'):
        rules = condition.get('rules') or []
        if not rules:
            return False
        results = [evaluate(r, variables) for r in rules]
        return all(results) if operator == 'and' else any(results)

    return _eval_leaf(condition, variables)
