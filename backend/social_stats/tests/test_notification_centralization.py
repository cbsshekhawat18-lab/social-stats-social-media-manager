"""
Notification centralization tests.

Verifies:
  • event handlers route through the central
    `notification_dispatcher.dispatch` (not a direct
    `Notification.objects.create`), so user channel preferences are honoured.
  • Disabling a channel via NotificationPreference suppresses email
    fan-out for the matching event.
  • The Notification row carries the new `client` FK from.
  • Bus event types are mapped to the dispatcher's preference vocabulary
    (`post.published` → `post_published`, etc.).
  • The previously broken PUT /api/notifications/preferences/ now works
    (verifies the duplicate-URL bug is gone).
"""
import uuid
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from social_stats.events.publisher import EventPublisher
from social_stats.models import (
    Client, UserProfile, Notification, NotificationPreference, UnifiedPost,
)
from social_stats.bot_models import BotFlow, BotConversation, Lead


def _client(label='c'):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:6]}@x.test',
    )


def _user(role='client', client_obj=None, owner_of=None):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:10]}',
        email=f'{uuid.uuid4().hex[:6]}@x.test',
        password='x', is_active=True,
    )
    UserProfile.objects.create(
        user=u, role=role,
        client=client_obj if role == 'client' else None,
    )
    if owner_of is not None:
        owner_of.owner_user = u
        owner_of.save(update_fields=['owner_user'])
    return u


# ══════════════════════════════════════════════════════════════════════
# Event handler → central dispatcher pipeline
# ══════════════════════════════════════════════════════════════════════
@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class EventHandlerDispatcherIntegrationTests(TestCase):

    def setUp(self):
        self.client_obj = _client('disp')
        self.owner = _user(role='client', client_obj=self.client_obj, owner_of=self.client_obj)
        mail.outbox = []

    def _make_lead(self):
        from social_stats.models import WhatsAppContact
        contact = WhatsAppContact.objects.create(
            client=self.client_obj,
            phone='+919999000123',
            name='Lead Person',
            opt_in_status='opted_in',
        )
        flow = BotFlow.objects.create(
            client=self.client_obj, name='dispatch test flow',
            nodes=[], edges=[], created_by=self.owner,
        )
        conv = BotConversation.objects.create(
            client=self.client_obj, contact=contact, flow=flow,
            triggered_via='manual',
        )
        return Lead.objects.create(
            client=self.client_obj,
            contact=contact,
            phone='+919999000123',
            name='Lead Person',
            source_flow=flow,
            source_conversation=conv,
        )

    def test_lead_captured_routes_through_dispatcher(self):
        """publish('lead.captured') → handler → dispatch() → in-app row.
        We patch `dispatch` so we can prove it's the path being used."""
        lead = self._make_lead()

        with patch(
            'social_stats.notification_dispatcher.dispatch',
            wraps=__import__('social_stats.notification_dispatcher',
                             fromlist=['dispatch']).dispatch,
        ) as spy, self.captureOnCommitCallbacks(execute=True):
            EventPublisher.publish(
                'lead.captured',
                client=self.client_obj,
                actor=None,
                actor_type='system',
                payload={'lead_id': lead.id, 'source': 'bot'},
            )

        # dispatcher was called at least once (owner is the only recipient)
        self.assertGreaterEqual(spy.call_count, 1)
        # the bus event_type is mapped to the dispatcher vocabulary
        kwargs_seen = [c.kwargs for c in spy.call_args_list]
        self.assertTrue(
            any(k.get('event_type') == 'bot_lead_captured' for k in kwargs_seen),
            f'expected event_type=bot_lead_captured, got {kwargs_seen}',
        )

    def test_lead_captured_in_app_row_has_client_fk(self):
        """Audit gap 1.1: every notification row written by the
        event-bus handlers must carry `client` for tenant scoping."""
        lead = self._make_lead()

        with self.captureOnCommitCallbacks(execute=True):
            EventPublisher.publish(
                'lead.captured',
                client=self.client_obj,
                actor=None,
                payload={'lead_id': lead.id, 'source': 'bot'},
            )

        notes = Notification.objects.filter(
            user=self.owner,
            data__bus_event_type='lead.captured',
        )
        self.assertGreaterEqual(notes.count(), 1)
        for n in notes:
            self.assertEqual(n.client_id, self.client_obj.id,
                             f'notification {n.id} missing client FK')

    def test_disabling_email_pref_suppresses_email_fanout(self):
        """User opts out of email for `bot_lead_captured` → in-app still
        lands but Django mail.outbox stays empty."""
        # bot_lead_captured is in DEFAULTS_EMAIL, so by default email fires.
        # Opt the owner out.
        NotificationPreference.objects.create(
            user=self.owner, event_type='bot_lead_captured',
            channel='email', enabled=False,
        )
        lead = self._make_lead()

        with self.captureOnCommitCallbacks(execute=True):
            EventPublisher.publish(
                'lead.captured',
                client=self.client_obj,
                actor=None,
                payload={'lead_id': lead.id, 'source': 'bot'},
            )

        # in-app still fired
        self.assertGreaterEqual(
            Notification.objects.filter(user=self.owner).count(), 1,
        )
        # but no email — opt-out respected
        self.assertEqual(mail.outbox, [], 'opted-out email should NOT have sent')

    def test_post_published_event_maps_to_post_published_pref_key(self):
        """Confirms the event-type mapping table — bus emits `post.published`,
        dispatcher receives `post_published` so the right pref key is checked."""
        post = UnifiedPost.objects.create(
            client=self.client_obj,
            created_by=self.owner,
            content='hello world',
            target_platforms=['facebook'],
            status='published',
        )

        with patch(
            'social_stats.notification_dispatcher.dispatch',
        ) as spy, self.captureOnCommitCallbacks(execute=True):
            EventPublisher.publish(
                'post.published',
                client=self.client_obj,
                actor=self.owner,
                payload={'post_id': post.id, 'platforms': ['facebook']},
            )

        kwargs_seen = [c.kwargs for c in spy.call_args_list]
        self.assertTrue(
            any(k.get('event_type') == 'post_published' for k in kwargs_seen),
            f'expected event_type=post_published in dispatch calls; got {kwargs_seen}',
        )


# ══════════════════════════════════════════════════════════════════════
# Preferences API regression — the bug the audit +-4 chased
# ══════════════════════════════════════════════════════════════════════
class PreferencesEndpointTests(TestCase):
    """The duplicate URL that returned 405 on PUT is gone; both methods
    work and the matrix shape matches what the test_audit_notifications
    suite already expects."""

    def setUp(self):
        self.c = _client('prefs')
        self.user = _user(role='client', client_obj=self.c)
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_get_returns_flat_per_channel_matrix(self):
        res = self.api.get('/api/notifications/preferences/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data['matrix']), 1)
        first = res.data['matrix'][0]
        # Flat shape: each channel is a top-level key (NOT nested under .channels)
        for ch in ('in_app', 'email', 'whatsapp', 'browser'):
            self.assertIn(ch, first, f'channel {ch} missing from matrix entry')

    def test_put_accepts_matrix_and_persists(self):
        """The bug fixed in: PUT used to return 405 because a
        GET-only view shadowed the combined GET+PUT view."""
        body = {'matrix': [
            {'event_type': 'post_published', 'channel': 'email', 'enabled': True},
            {'event_type': 'post_published', 'channel': 'in_app', 'enabled': False},
        ]}
        res = self.api.put('/api/notifications/preferences/', body, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['updated'], 2)
        self.assertEqual(
            NotificationPreference.objects.filter(user=self.user).count(), 2,
        )
