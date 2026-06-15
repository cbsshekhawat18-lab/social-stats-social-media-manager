# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Ask handlers — send a question, halt, then validate user reply."""
from __future__ import annotations

from ..templates import render
from ..validators import is_email, is_phone, normalise_phone


def _ask(executor, node, *, prompt_key='question', default_prompt='Please reply.'):
    data = node.get('data') or {}
    text = render(data.get(prompt_key) or data.get('text') or default_prompt, executor.variables)
    executor.pinbot.send_text(executor.contact.phone, text)
    executor.log_step(node, direction='bot_to_user', payload={'text': text})
    store_var = data.get('store_var') or data.get('variable') or None
    return executor.wait_for_user(node['id'], store_var=store_var)


def _reprompt(executor, node, message: str):
    executor.pinbot.send_text(executor.contact.phone, message)
    executor.log_step(node, direction='bot_to_user', payload={'text': message, 're_prompt': True})
    # Stay on this node — leave _waiting_for / _waiting_for_node intact
    return executor.conversation


# ── ask_question ───────────────────────────────────────────────────────────
def ask_question(executor, node):
    return _ask(executor, node)


def reply_question(executor, node, user_text: str, kind: str, raw_payload: dict):
    data = node.get('data') or {}
    store_var = data.get('store_var') or data.get('variable') or None
    if store_var:
        executor.set_variable(store_var, user_text)
    executor.consume_waiting()
    return executor.advance_to_next(node['id'])


# ── ask_email ──────────────────────────────────────────────────────────────
def ask_email(executor, node):
    return _ask(executor, node, prompt_key='question', default_prompt='Please share your email.')


def reply_email(executor, node, user_text: str, kind: str, raw_payload: dict):
    data = node.get('data') or {}
    if not is_email(user_text):
        retry_msg = data.get('retry_message') or "That doesn't look like a valid email — please try again."
        return _reprompt(executor, node, retry_msg)
    store_var = data.get('store_var') or data.get('variable') or 'email'
    executor.set_variable(store_var, user_text.strip().lower())
    executor.consume_waiting()
    return executor.advance_to_next(node['id'])


# ── ask_phone ──────────────────────────────────────────────────────────────
def ask_phone(executor, node):
    return _ask(executor, node, prompt_key='question', default_prompt='Please share your phone number.')


def reply_phone(executor, node, user_text: str, kind: str, raw_payload: dict):
    data = node.get('data') or {}
    if not is_phone(user_text):
        retry_msg = data.get('retry_message') or "That doesn't look like a valid phone — please try again."
        return _reprompt(executor, node, retry_msg)
    store_var = data.get('store_var') or data.get('variable') or 'phone'
    executor.set_variable(store_var, normalise_phone(user_text))
    executor.consume_waiting()
    return executor.advance_to_next(node['id'])


# ─────────────────────────────────────────────────────────────────────────────
def ask_number(executor, node):
    return _ask(executor, node, prompt_key='question', default_prompt='Please enter a number.')


def reply_number(executor, node, user_text: str, kind: str, raw_payload: dict):
    data = node.get('data') or {}
    cleaned = (user_text or '').replace(',', '').strip()
    try:
        value = float(cleaned)
        if value.is_integer():
            value = int(value)
    except ValueError:
        retry = data.get('retry_message') or "That doesn't look like a number — please try again."
        return _reprompt(executor, node, retry)

    # Optional min/max
    minv, maxv = data.get('min'), data.get('max')
    try:
        if minv is not None and value < float(minv):
            return _reprompt(executor, node, data.get('retry_message') or f'Please enter a number ≥ {minv}.')
        if maxv is not None and value > float(maxv):
            return _reprompt(executor, node, data.get('retry_message') or f'Please enter a number ≤ {maxv}.')
    except (TypeError, ValueError):
        pass

    store_var = data.get('store_var') or data.get('variable') or 'number'
    executor.set_variable(store_var, value)
    executor.consume_waiting()
    return executor.advance_to_next(node['id'])


def ask_location(executor, node):
    """Ask the user to share their location. We send a `send_location_request`
    if Pinbot supports it; otherwise fall back to a text prompt."""
    data = node.get('data') or {}
    body = (data.get('question') or 'Please share your location.').strip()
    body = body  # already plain text
    sender = executor.pinbot
    try:
        if hasattr(sender, 'send_location_request'):
            sender.send_location_request(executor.contact.phone, body)
        else:
            sender.send_text(executor.contact.phone, body)
    except Exception:
        sender.send_text(executor.contact.phone, body)
    executor.log_step(node, direction='bot_to_user', payload={'text': body, 'expects': 'location'})
    return executor.wait_for_user(node['id'], store_var=data.get('store_var') or 'location')


def reply_location(executor, node, user_text: str, kind: str, raw_payload: dict):
    """Pinbot/WhatsApp deliver location messages with a `location` block:
        {latitude, longitude, name, address}
    """
    data = node.get('data') or {}
    loc = raw_payload.get('location') or {}
    if not loc and (raw_payload.get('type') != 'location'):
        # User typed text instead of sharing — treat as best-effort and store the string
        if user_text:
            executor.set_variable(data.get('store_var') or 'location', user_text)
            executor.consume_waiting()
            return executor.advance_to_next(node['id'])
        retry = data.get('retry_message') or 'Please tap the location icon and share your location.'
        return _reprompt(executor, node, retry)

    payload = {
        'latitude':  loc.get('latitude'),
        'longitude': loc.get('longitude'),
        'name':      loc.get('name', ''),
        'address':   loc.get('address', ''),
    }
    executor.set_variable(data.get('store_var') or 'location', payload)
    executor.consume_waiting()
    return executor.advance_to_next(node['id'])


def ask_attachment(executor, node):
    """Ask for an image or document upload."""
    data = node.get('data') or {}
    body = (data.get('question') or 'Please upload the file.').strip()
    executor.pinbot.send_text(executor.contact.phone, body)
    executor.log_step(node, direction='bot_to_user', payload={'text': body, 'expects': 'attachment'})
    return executor.wait_for_user(node['id'], store_var=data.get('store_var') or 'attachment')


def reply_attachment(executor, node, user_text: str, kind: str, raw_payload: dict):
    data = node.get('data') or {}
    msg_type = raw_payload.get('type') or ''
    media_block = (raw_payload.get(msg_type) or {}) if msg_type in ('image', 'document', 'video') else {}
    if not media_block:
        retry = data.get('retry_message') or 'Please attach an image or document and send.'
        return _reprompt(executor, node, retry)

    payload = {
        'type':     msg_type,
        'media_id': media_block.get('id'),
        'mime':     media_block.get('mime_type'),
        'sha256':   media_block.get('sha256'),
        'caption':  media_block.get('caption', ''),
        'filename': media_block.get('filename', ''),
    }
    executor.set_variable(data.get('store_var') or 'attachment', payload)
    executor.consume_waiting()
    return executor.advance_to_next(node['id'])
