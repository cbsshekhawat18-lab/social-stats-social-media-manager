# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Node handler registry —of the bot engine.

Each handler is a callable with the signature:

 def handle_<type>(executor, node) -> conversation:
 ...

For ask_* nodes there's also a reply handler:

 def reply_<type>(executor, node, user_text, kind, raw_payload) -> conversation:
 ...

NODE_HANDLERS / REPLY_HANDLERS are the dispatch tables read by the executor
and runner.will register more types here without touching the rest
of the engine.
"""
from . import (
 flow_control,
 messages,
 asks,
 actions,
 logic,
 timed,
 smart,
)

NODE_HANDLERS = {
 # Flow control
 'start': flow_control.handle_start,
 'end_conversation': flow_control.handle_end,
 # Messages
 'message_text': messages.handle_text,
 'message_image': messages.handle_image,
 'message_buttons': messages.handle_buttons,
 # Messages
 'message_video': messages.handle_video,
 'message_document': messages.handle_document,
 'message_template': messages.handle_template,
 'message_list': messages.handle_list,
 'message_cta': messages.handle_cta,
 # Asks
 'ask_question': asks.ask_question,
 'ask_email': asks.ask_email,
 'ask_phone': asks.ask_phone,
 # Asks
 'ask_number': asks.ask_number,
 'ask_location': asks.ask_location,
 'ask_attachment': asks.ask_attachment,
 # Logic
 'condition': logic.handle_condition,
 'set_variable': logic.handle_set_variable,
 # Logic
 'random_split': logic.handle_random_split,
 'jump_to_flow': logic.handle_jump_to_flow,
 # Actions
 'capture_lead': actions.handle_capture_lead,
 # Actions
 'tag_contact': actions.handle_tag_contact,
 'send_email': actions.handle_send_email,
 'webhook': actions.handle_webhook,
 # Timed
 'wait_delay': timed.handle_wait_delay,
 # Smart
 'human_handoff': smart.handle_human_handoff,
 'ai_chat': smart.handle_ai_chat,
}

REPLY_HANDLERS = {
 'ask_question': asks.reply_question,
 'ask_email': asks.reply_email,
 'ask_phone': asks.reply_phone,
 'ask_number': asks.reply_number,
 'ask_location': asks.reply_location,
 'ask_attachment': asks.reply_attachment,
 'message_buttons': messages.reply_buttons,
 'message_list': messages.reply_list,
}
