# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""start + end_conversation handlers."""
from __future__ import annotations


def handle_start(executor, node):
    """No-op entry node. Just advance to whatever connects from it."""
    executor.log_step(node, direction='system', payload={'note': 'flow started'})
    return executor.advance_to_next(node['id'])


def handle_end(executor, node):
    """Optionally send a final message, then mark the conversation completed."""
    text = (node.get('data') or {}).get('text', '') or ''
    if text:
        from ..templates import render
        rendered = render(text, executor.variables)
        try:
            executor.pinbot.send_text(executor.contact.phone, rendered)
        except Exception:  # noqa: BLE001 — sending is best-effort at end
            pass
        executor.log_step(node, direction='bot_to_user', payload={'text': rendered})
    return executor.end_conversation('completed')
