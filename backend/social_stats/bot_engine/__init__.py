# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Social Stats CTWA Bot Engine — public API. Usage from the WhatsApp webhook task: from social_stats.bot_engine import process_incoming_message handled = process_incoming_message(client.id, contact.id, message_payload) if not handled: # No bot is active for this contact — fall through to inbox... The engine: - Resumes any active BotConversation for (client, contact). - When no conversation is active, attempts to TRIGGER a flow via triggers.match_trigger() (CTWA referral → keyword → first-message). - Walks node graphs synchronously. Asynchronous nodes (wait_delay, AI streaming) are scheduled in later stages via Celery countdown. The engine never raises into the caller; failures are written to the
BotConversation as `status='failed'` + a `system` step row.
"""
from.runner import process_incoming_message # noqa: F401
