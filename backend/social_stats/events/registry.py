# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Event handler registry.

Maps `event_type` → list of handler dotted paths. The dispatcher
(events/publisher.py) reads this dict and fans events out to all listed
handlers asynchronously.

Conventions:

 • Handler paths are dotted Python imports, NOT relative.
 • Each handler is a plain function with signature `handler(event: EventLog)`.
 • Handlers must be idempotent — retries and re-dispatches happen.
 • Order in the list is *not* a sequencing guarantee; handlers run in parallel
 Celery workers. If an event needs strict ordering, model it as two events.
 • Adding a new event_type? Add it here AND publish it from the producer.

This stage ships handlers for the highest-impact integration gaps from the
audit (lead.captured, post.published, message.received, approval lifecycle,
relation lifecycle). Other event_types are listed with empty handler lists or
stub handlers so producers can start emitting now and we add subscribers
incrementally without touching producer code again.
"""
from __future__ import annotations

# Each entry: 'event.type': ['dotted.path.to.handler', ...]
EVENT_HANDLERS: dict[str, list[str]] = {

 # ── Post lifecycle ───────────────────────────────────────────────────
 'post.published': [
 'social_stats.events.handlers.activity.log_post_published',
 'social_stats.events.handlers.notifications.notify_post_published',
 ],
 'post.failed': [
 'social_stats.events.handlers.activity.log_post_failed',
 'social_stats.events.handlers.notifications.notify_post_failed',
 ],
 'post.engagement_spike': [
 # Handler stub — (AI) will fill this in.
 # 'social_stats.events.handlers.ai.generate_viral_insight',
 # 'social_stats.events.handlers.notifications.notify_viral_post',
 ],

 # ── Inbox / messaging ────────────────────────────────────────────────
 'message.received': [
 'social_stats.events.handlers.activity.log_message_received',
 'social_stats.events.handlers.notifications.notify_inbox_new_message',
 ],
 'message.sent': [
 'social_stats.events.handlers.activity.log_message_sent',
 ],
 'comment.received': [
 ],
 'review.received': [
 'social_stats.events.handlers.notifications.notify_review_received',
 ],

 # ── Bot / leads ──────────────────────────────────────────────────────
 'bot.conversation_started': [
 'social_stats.events.handlers.activity.log_bot_conversation_started',
 ],
 'bot.conversation_completed': [
 ],
 'bot.handoff_requested': [
 'social_stats.events.handlers.notifications.notify_human_handoff',
 ],
 'lead.captured': [
 'social_stats.events.handlers.activity.log_lead_captured',
 'social_stats.events.handlers.notifications.notify_new_lead',
 ],
 'lead.status_changed': [
 'social_stats.events.handlers.activity.log_lead_status_changed',
 'social_stats.events.handlers.notifications.notify_lead_assigned',
 ],
 'lead.converted': [
 'social_stats.events.handlers.activity.log_lead_converted',
 ],

 # ── WhatsApp campaigns ───────────────────────────────────────────────
 'whatsapp_campaign.launched': [
 'social_stats.events.handlers.activity.log_whatsapp_campaign_launched',
 ],
 'whatsapp_campaign.completed': [
 ],

 # ── Marketplace / Agency ─────────────────────────────────────────────
 'agency_relation.created': [
 # Existing direct calls already handle this (relation_views.py).
 ],
 'agency_relation.terminated': [
 ],
 'permission.changed': [
 'social_stats.events.handlers.activity.log_permission_changed',
 ],
 'approval.requested': [
 # Existing notify_approver_for_post.delay() already covers this.
 ],
 'approval.granted': [
 'social_stats.events.handlers.activity.log_approval_granted',
 'social_stats.events.handlers.notifications.notify_approval_decided',
 ],
 'approval.rejected': [
 'social_stats.events.handlers.activity.log_approval_rejected',
 'social_stats.events.handlers.notifications.notify_approval_decided',
 ],

 # ── Auth / Security ──────────────────────────────────────────────────
 'user.signed_up': [
 # Existing onboarding flow handles this. — track_signup analytics
 ],
 'user.logged_in': [
 # Existing security/login_monitor.py handles this. Listed here so
 # future analytics handlers can subscribe without touching auth_views.
 ],
 'token.expired': [
 'social_stats.events.handlers.notifications.notify_token_expired',
 ],

 # ── AI ───────────────────────────────────────────────────────────────
 'ai.insight_generated': [
 ],
 'ai.cost_threshold_reached': [
 ],

 # ── Sync tasks ───────────────────────────────────────────────────────
 'platform.synced': [
 ],
 'platform.sync_failed': [
 'social_stats.events.handlers.notifications.notify_sync_failed',
 ],
}

def list_event_types() -> list[str]:
 """Helper for tests + admin debugging — returns every registered event_type."""
 return sorted(EVENT_HANDLERS.keys())

def list_handlers_for(event_type: str) -> list[str]:
 """Returns the handler list for an event_type, or [] if unregistered."""
 return list(EVENT_HANDLERS.get(event_type, []))
