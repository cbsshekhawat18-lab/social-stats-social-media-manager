# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Send-message handlers: text / image / buttons."""
from __future__ import annotations

from ..templates import render


def handle_text(executor, node):
    text = render((node.get('data') or {}).get('text', ''), executor.variables)
    if text:
        executor.pinbot.send_text(executor.contact.phone, text)
        executor.log_step(node, direction='bot_to_user', payload={'text': text})
    return executor.advance_to_next(node['id'])


def handle_image(executor, node):
    data = node.get('data') or {}
    link    = data.get('url') or data.get('link') or ''
    media_id = data.get('media_id') or ''
    caption = render(data.get('caption', ''), executor.variables) or None
    if not (link or media_id):
        executor.log_step(node, direction='system', payload={'error': 'no image url or media_id'})
        return executor.advance_to_next(node['id'])
    executor.pinbot.send_image(
        executor.contact.phone,
        link=link or None, media_id=media_id or None, caption=caption,
    )
    executor.log_step(node, direction='bot_to_user', payload={'link': link, 'caption': caption})
    return executor.advance_to_next(node['id'])


def handle_buttons(executor, node):
    """Send interactive buttons (max 3, per WhatsApp). Buttons:
        [{id: 'BTN_YES', title: 'Yes'}, ...]
    Each button id can be the source of an outgoing edge via `sourceHandle`.
    """
    data = node.get('data') or {}
    body = render(data.get('body') or data.get('text') or '', executor.variables)
    buttons = (data.get('buttons') or [])[:3]   # WhatsApp hard cap
    if not body or not buttons:
        executor.log_step(node, direction='system', payload={'error': 'buttons node missing body or buttons'})
        return executor.advance_to_next(node['id'])

    btn_objs = [{'id': b.get('id') or f'btn_{i}', 'title': (b.get('title') or '')[:20]}
                for i, b in enumerate(buttons)]
    executor.pinbot.send_interactive_buttons(executor.contact.phone, body, btn_objs)
    executor.log_step(node, direction='bot_to_user', payload={'body': body, 'buttons': btn_objs})

    # Wait for the user's button reply — `_waiting_for_node` will resume here.
    return executor.wait_for_user(node['id'])


def reply_buttons(executor, node, user_text: str, kind: str, raw_payload: dict):
    """Resume after the user picks a button. Branch via the button id matching
    a `sourceHandle` on an outgoing edge."""
    interactive = (raw_payload.get('interactive') or {})
    button_reply = interactive.get('button_reply') or {}
    button_id = button_reply.get('id', '')

    # Persist the picked button for downstream conditions
    store_var = (node.get('data') or {}).get('store_var')
    if store_var:
        executor.set_variable(store_var, button_reply.get('title') or button_id)

    # Branch — sourceHandle on an outgoing edge equals the button id
    return executor.advance_to_next(node['id'], branch=button_id or None)


# ─────────────────────────────────────────────────────────────────────────────
def handle_video(executor, node):
    data = node.get('data') or {}
    link, media_id = data.get('url') or data.get('link') or '', data.get('media_id') or ''
    caption = render(data.get('caption', ''), executor.variables) or None
    if not (link or media_id):
        executor.log_step(node, direction='system', payload={'error': 'no video url or media_id'})
        return executor.advance_to_next(node['id'])
    executor.pinbot.send_video(executor.contact.phone, link=link or None, media_id=media_id or None, caption=caption)
    executor.log_step(node, direction='bot_to_user', payload={'link': link, 'caption': caption})
    return executor.advance_to_next(node['id'])


def handle_document(executor, node):
    data = node.get('data') or {}
    link, media_id = data.get('url') or data.get('link') or '', data.get('media_id') or ''
    caption  = render(data.get('caption', ''), executor.variables) or None
    filename = render(data.get('filename', ''), executor.variables) or None
    if not (link or media_id):
        executor.log_step(node, direction='system', payload={'error': 'no document url or media_id'})
        return executor.advance_to_next(node['id'])
    executor.pinbot.send_document(
        executor.contact.phone,
        link=link or None, media_id=media_id or None,
        caption=caption, filename=filename,
    )
    executor.log_step(node, direction='bot_to_user', payload={
        'link': link, 'caption': caption, 'filename': filename,
    })
    return executor.advance_to_next(node['id'])


def handle_template(executor, node):
    """Send an approved WhatsApp template — required when outside the 24h window.

    data: { template_name, language ('en_US'), components: [...] }
    Components are passed through render() recursively for {{var}} substitution.
    """
    data = node.get('data') or {}
    name = data.get('template_name') or data.get('name')
    if not name:
        executor.log_step(node, direction='system', payload={'error': 'template_name required'})
        return executor.advance_to_next(node['id'])

    language = data.get('language') or 'en_US'
    components = _render_components(data.get('components') or [], executor.variables)
    executor.pinbot.send_text_template(executor.contact.phone, name, language, components)
    executor.log_step(node, direction='bot_to_user', payload={
        'template_name': name, 'language': language, 'components': components,
    })
    return executor.advance_to_next(node['id'])


def _render_components(components, variables):
    """Recursively render {{var}} tokens inside a Pinbot template-components list."""
    out = []
    for c in components:
        if not isinstance(c, dict):
            continue
        rc = dict(c)
        params = rc.get('parameters')
        if isinstance(params, list):
            new_params = []
            for p in params:
                if isinstance(p, dict) and 'text' in p:
                    p = {**p, 'text': render(str(p.get('text', '')), variables)}
                new_params.append(p)
            rc['parameters'] = new_params
        out.append(rc)
    return out


def handle_list(executor, node):
    """Send an interactive list picker.

    data: {
        body, button_label, sections: [{title, rows: [{id, title, description}]}],
        header?, footer?, store_var?
    }
    Each row id can be the source of an outgoing edge via `sourceHandle`.
    """
    data = node.get('data') or {}
    body = render(data.get('body') or data.get('text') or '', executor.variables)
    button_label = data.get('button_label') or data.get('button') or 'Choose'
    sections = data.get('sections') or []
    if not body or not sections:
        executor.log_step(node, direction='system', payload={'error': 'list missing body or sections'})
        return executor.advance_to_next(node['id'])

    header = render(data.get('header', ''), executor.variables) or None
    footer = render(data.get('footer', ''), executor.variables) or None
    executor.pinbot.send_interactive_list(
        executor.contact.phone, body, button_label, sections,
        header=header, footer=footer,
    )
    executor.log_step(node, direction='bot_to_user', payload={
        'body': body, 'button_label': button_label, 'sections': sections,
    })
    return executor.wait_for_user(node['id'])


def reply_list(executor, node, user_text: str, kind: str, raw_payload: dict):
    interactive = raw_payload.get('interactive') or {}
    list_reply = interactive.get('list_reply') or {}
    row_id = list_reply.get('id', '')
    title  = list_reply.get('title', '') or row_id

    store_var = (node.get('data') or {}).get('store_var')
    if store_var:
        executor.set_variable(store_var, title)

    return executor.advance_to_next(node['id'], branch=row_id or None)


def handle_cta(executor, node):
    """Send a CTA URL button via approved template (Pinbot supports CTA URL templates).

    data: { template_name, language, button_text, url }
    For free-form (in-window) sends, falls back to a text + link.
    """
    data = node.get('data') or {}
    template_name = data.get('template_name')
    if template_name:
        # Use the approved CTA-URL template
        body_text = render(data.get('body', ''), executor.variables) or ''
        button_text = data.get('button_text', 'Open')
        url = render(data.get('url', ''), executor.variables) or ''
        try:
            executor.pinbot.send_cta_url_template(
                executor.contact.phone, template_name,
                data.get('language', 'en_US'),
                body_text=body_text, button_text=button_text, url=url,
            )
        except TypeError:
            # Some Pinbot versions take a single payload dict — fall back to send_text
            executor.pinbot.send_text(executor.contact.phone, f'{body_text}\n{url}')
        executor.log_step(node, direction='bot_to_user', payload={
            'template_name': template_name, 'url': url, 'button_text': button_text,
        })
    else:
        body = render(data.get('body', ''), executor.variables) or ''
        url  = render(data.get('url', ''),  executor.variables) or ''
        text = f'{body}\n{url}' if url else body
        executor.pinbot.send_text(executor.contact.phone, text, preview_url=True)
        executor.log_step(node, direction='bot_to_user', payload={'body': body, 'url': url})
    return executor.advance_to_next(node['id'])
