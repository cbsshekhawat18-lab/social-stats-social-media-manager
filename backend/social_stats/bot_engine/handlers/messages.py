# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Send-message handlers: text / media / template / buttons / list / CTA.

Free-form sends go through `executor.send_freeform`, which enforces the
24-hour customer-service window (templates are exempt).
"""
from __future__ import annotations

from ..templates import render


def handle_text(executor, node):
    text = render((node.get('data') or {}).get('text', ''), executor.variables)
    if text and executor.send_freeform(node, 'send_text', executor.contact.phone, text):
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
    if executor.send_freeform(node, 'send_image', executor.contact.phone,
                              link=link or None, media_id=media_id or None, caption=caption):
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

    btn_objs = _button_objects(buttons)
    if executor.send_freeform(node, 'send_interactive_buttons', executor.contact.phone, body, btn_objs):
        executor.log_step(node, direction='bot_to_user', payload={'body': body, 'buttons': btn_objs})

    # Wait for the user's button reply — `_waiting_for_node` will resume here.
    return executor.wait_for_user(node['id'])


def _button_objects(buttons):
    return [{'id': b.get('id') or f'btn_{i}', 'title': (b.get('title') or '')[:20]}
            for i, b in enumerate(buttons)]


def _match_option(options, user_text: str):
    """Typed text that equals an option's title (case-insensitive) or id
    counts as picking it — people often type the answer instead of tapping."""
    needle = (user_text or '').strip().lower()
    if not needle:
        return None
    for opt in options:
        if needle in ((opt.get('title') or '').strip().lower(), (opt.get('id') or '').strip().lower()):
            return opt
    return None


def reply_buttons(executor, node, user_text: str, kind: str, raw_payload: dict):
    """Resume after the user picks a button. Branch via the button id matching
    a `sourceHandle` on an outgoing edge. Anything else is a no-match."""
    data = node.get('data') or {}
    interactive = (raw_payload.get('interactive') or {})
    button_reply = interactive.get('button_reply') or {}
    button_id = button_reply.get('id', '')
    title = button_reply.get('title') or ''
    if not button_id:
        picked = _match_option(_button_objects((data.get('buttons') or [])[:3]), user_text)
        if picked:
            button_id, title = picked['id'], picked['title']

    if not button_id:
        # Free text (or anything else) that isn't one of the options.
        return executor.handle_no_match(node, user_text)

    # Persist the picked button for downstream conditions
    store_var = data.get('store_var')
    if store_var:
        executor.set_variable(store_var, title or button_id)

    # Branch — sourceHandle on an outgoing edge equals the button id
    return executor.advance_to_next(node['id'], branch=button_id)


# ─────────────────────────────────────────────────────────────────────────────
def handle_video(executor, node):
    data = node.get('data') or {}
    link, media_id = data.get('url') or data.get('link') or '', data.get('media_id') or ''
    caption = render(data.get('caption', ''), executor.variables) or None
    if not (link or media_id):
        executor.log_step(node, direction='system', payload={'error': 'no video url or media_id'})
        return executor.advance_to_next(node['id'])
    if executor.send_freeform(node, 'send_video', executor.contact.phone,
                              link=link or None, media_id=media_id or None, caption=caption):
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
    if executor.send_freeform(node, 'send_document', executor.contact.phone,
                              link=link or None, media_id=media_id or None,
                              caption=caption, filename=filename):
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
    if executor.send_freeform(node, 'send_interactive_list',
                              executor.contact.phone, body, button_label, sections,
                              header=header, footer=footer):
        executor.log_step(node, direction='bot_to_user', payload={
            'body': body, 'button_label': button_label, 'sections': sections,
        })
    return executor.wait_for_user(node['id'])


def _list_rows(data):
    return [r for s in (data.get('sections') or []) for r in (s.get('rows') or [])]


def reply_list(executor, node, user_text: str, kind: str, raw_payload: dict):
    data = node.get('data') or {}
    interactive = raw_payload.get('interactive') or {}
    list_reply = interactive.get('list_reply') or {}
    row_id = list_reply.get('id', '')
    title  = list_reply.get('title', '') or row_id
    if not row_id:
        picked = _match_option(_list_rows(data), user_text)
        if picked:
            row_id, title = picked.get('id', ''), picked.get('title') or picked.get('id', '')

    if not row_id:
        # Free text (or anything else) that isn't one of the options.
        return executor.handle_no_match(node, user_text)

    store_var = data.get('store_var')
    if store_var:
        executor.set_variable(store_var, title)

    return executor.advance_to_next(node['id'], branch=row_id)


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
            executor.send_freeform(node, 'send_text', executor.contact.phone, f'{body_text}\n{url}')
        executor.log_step(node, direction='bot_to_user', payload={
            'template_name': template_name, 'url': url, 'button_text': button_text,
        })
    else:
        body = render(data.get('body', ''), executor.variables) or ''
        url  = render(data.get('url', ''),  executor.variables) or ''
        text = f'{body}\n{url}' if url else body
        if executor.send_freeform(node, 'send_text', executor.contact.phone, text, preview_url=True):
            executor.log_step(node, direction='bot_to_user', payload={'body': body, 'url': url})
    return executor.advance_to_next(node['id'])
