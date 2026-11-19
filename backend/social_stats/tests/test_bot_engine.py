# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
WhatsApp bot engine tests.

Everything runs against a FakePinbot (BotExecutor / process_incoming_message
accept `pinbot=`), so no network and no Pinbot account are involved. Run with
either `pytest social_stats/tests/test_bot_engine.py` or
`python manage.py test social_stats.tests.test_bot_engine`.
"""
import re
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.bot_engine import process_incoming_message
from social_stats.bot_engine.business_hours import is_within_business_hours
from social_stats.bot_engine.executor import BotExecutor
from social_stats.bot_engine.handlers import NODE_HANDLERS, REPLY_HANDLERS
from social_stats.bot_engine.handlers.timed import resume_bot_conversation
from social_stats.bot_engine.tasks import mark_abandoned_bot_conversations
from social_stats.bot_engine.window import in_service_window
from social_stats.bot_views import snapshot_flow
from social_stats.models import (
    NODE_TYPES, BotConversation, BotFlow, Client, UserProfile,
    WhatsAppAccount, WhatsAppContact, WhatsAppContactList, WhatsAppMessage,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
class FakePinbot:
    """Records every send instead of calling Pinbot."""

    def __init__(self):
        self.sent = []

    def _record(self, kind, to, **payload):
        self.sent.append({'kind': kind, 'to': to, **payload})
        return {'messages': [{'id': f'wamid.fake{len(self.sent)}'}]}

    def send_text(self, to, body, preview_url=False):
        return self._record('text', to, body=body)

    def send_image(self, to, link=None, media_id=None, caption=None):
        return self._record('image', to, link=link, caption=caption)

    def send_video(self, to, link=None, media_id=None, caption=None):
        return self._record('video', to, link=link, caption=caption)

    def send_document(self, to, link=None, media_id=None, caption=None, filename=None):
        return self._record('document', to, link=link, filename=filename)

    def send_interactive_buttons(self, to, body, buttons, **kw):
        return self._record('buttons', to, body=body, buttons=buttons)

    def send_interactive_list(self, to, body, button_label, sections, header=None, footer=None):
        return self._record('list', to, body=body, sections=sections)

    def send_text_template(self, to, name, language, components=None):
        return self._record('template', to, name=name, language=language, components=components or [])

    def send_location_request(self, to, body):
        return self._record('location_request', to, body=body)

    # convenience
    def kinds(self):
        return [m['kind'] for m in self.sent]

    def texts(self):
        return [m['body'] for m in self.sent if m['kind'] == 'text']


def node(node_id, node_type, **data):
    return {'id': node_id, 'type': node_type, 'position': {'x': 0, 'y': 0}, 'data': data}


def edge(source, target, handle=None):
    e = {'id': f'{source}-{target}-{handle or "out"}', 'source': source, 'target': target}
    if handle:
        e['sourceHandle'] = handle
    return e


def text_msg(body, msg_id=None):
    return {'id': msg_id or f'wamid.{uuid.uuid4().hex}', 'type': 'text', 'text': {'body': body}}


def button_msg(button_id, title=''):
    return {'id': f'wamid.{uuid.uuid4().hex}', 'type': 'interactive',
            'interactive': {'type': 'button_reply', 'button_reply': {'id': button_id, 'title': title or button_id}}}


def ad_msg(ad_id, body='Hi'):
    return {**text_msg(body), 'referral': {'source_type': 'ad', 'source_id': ad_id}}


class BotTestCase(TestCase):
    """A client, an in-window contact, a fake Pinbot, and flow builders."""

    def setUp(self):
        cache.clear()
        self.client_obj = Client.objects.create(
            name='Acme', company='Acme', email=f'acme-{uuid.uuid4().hex[:8]}@x.test',
        )
        self.contact = WhatsAppContact.objects.create(
            client=self.client_obj, phone='919800000001', name='Asha',
            last_inbound_at=timezone.now(),
        )
        self.pinbot = FakePinbot()

    def make_flow(self, nodes, edges, *, publish=True, client=None, **fields):
        fields.setdefault('trigger_type', 'keyword')
        fields.setdefault('trigger_config', {'keywords': ['hi'], 'match_type': 'exact'})
        flow = BotFlow.objects.create(
            client=client or self.client_obj, name=fields.pop('name', 'Flow'),
            nodes=nodes, edges=edges, starting_node_id=nodes[0]['id'], **fields,
        )
        if publish:
            snapshot_flow(flow)
        return flow

    def send(self, payload, contact=None):
        contact = contact or self.contact
        return process_incoming_message(contact.client_id, contact.id, payload, pinbot=self.pinbot)

    def conv(self, **filters):
        return BotConversation.objects.filter(contact=self.contact, **filters).order_by('-id').first()

    def errors(self, conv):
        return [s.payload.get('error') for s in conv.steps.filter(node_type='_error')]

    def notes(self, conv):
        return [s.payload.get('note') for s in conv.steps.filter(direction='system') if s.payload.get('note')]


def ask_flow_nodes():
    """start → ask name → say thanks → end."""
    return (
        [node('start', 'start'),
         node('ask', 'ask_question', question='Your name?', store_var='name'),
         node('thanks', 'message_text', text='Thanks {{name}}'),
         node('end', 'end_conversation')],
        [edge('start', 'ask'), edge('ask', 'thanks'), edge('thanks', 'end')],
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1. total_completed
# ─────────────────────────────────────────────────────────────────────────────
class CompletionCounterTests(BotTestCase):
    def test_total_completed_counts_every_completion(self):
        flow = self.make_flow(*ask_flow_nodes())
        for i in range(3):
            contact = WhatsAppContact.objects.create(
                client=self.client_obj, phone=f'9198000001{i}', last_inbound_at=timezone.now())
            self.send(text_msg('hi'), contact)
            self.send(text_msg('Ravi'), contact)
        flow.refresh_from_db()
        self.assertEqual(flow.total_completed, 3)
        self.assertEqual(flow.total_triggered, 3)

    def test_data_migration_recomputes_from_conversations(self):
        import importlib
        from django.apps import apps
        migration = importlib.import_module('social_stats.migrations.0068_bot_engine_data_fixes')
        flow = self.make_flow(*ask_flow_nodes())
        for status in ('completed', 'completed', 'abandoned'):
            BotConversation.objects.create(client=self.client_obj, flow=flow, contact=self.contact,
                                           triggered_via='keyword', status=status)
        BotFlow.objects.filter(pk=flow.pk).update(total_completed=1)   # the old bug's value
        migration.recompute_total_completed(apps, None)
        flow.refresh_from_db()
        self.assertEqual(flow.total_completed, 2)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Business hours
# ─────────────────────────────────────────────────────────────────────────────
ALL_CLOSED = {d: {'closed': True} for d in
              ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')}


class BusinessHoursTests(BotTestCase):
    def test_schedule_evaluation_in_flow_timezone(self):
        cfg = {'monday': {'start': '09:00', 'end': '18:00'}, 'timezone': 'Asia/Kolkata'}
        ist = ZoneInfo('Asia/Kolkata')
        monday = datetime(2026, 11, 16, tzinfo=ist)
        self.assertTrue(is_within_business_hours(cfg, monday.replace(hour=10)))
        self.assertFalse(is_within_business_hours(cfg, monday.replace(hour=8, minute=59)))
        self.assertFalse(is_within_business_hours(cfg, monday.replace(hour=18)))
        self.assertFalse(is_within_business_hours(cfg, monday + timedelta(days=1, hours=10)))  # Tuesday unset
        # 04:00 UTC Monday is 09:30 IST → open
        self.assertTrue(is_within_business_hours(cfg, datetime(2026, 11, 16, 4, 0, tzinfo=ZoneInfo('UTC'))))

    def test_default_timezone_and_overnight_window(self):
        cfg = {'friday': {'start': '22:00', 'end': '02:00'}}          # no timezone → Asia/Kolkata
        ist = ZoneInfo('Asia/Kolkata')
        self.assertTrue(is_within_business_hours(cfg, datetime(2026, 11, 20, 23, 0, tzinfo=ist)))
        self.assertTrue(is_within_business_hours(cfg, datetime(2026, 11, 21, 1, 0, tzinfo=ist)))   # Sat 01:00
        self.assertFalse(is_within_business_hours(cfg, datetime(2026, 11, 21, 3, 0, tzinfo=ist)))
        self.assertTrue(is_within_business_hours({}, datetime(2026, 11, 21, 3, 0, tzinfo=ist)))    # nothing set

    def test_closed_flow_sends_notice_and_does_not_run(self):
        flow = self.make_flow(*ask_flow_nodes(), business_hours_only=True,
                              business_hours=ALL_CLOSED, out_of_hours_message='We open at 9am.')
        self.assertTrue(self.send(text_msg('hi')))
        self.assertEqual(self.pinbot.texts(), ['We open at 9am.'])
        conv = self.conv()
        self.assertEqual(conv.status, 'exited')
        self.assertIn('outside_business_hours', self.notes(conv))
        self.assertFalse(conv.steps.filter(node_id='ask').exists())
        flow.refresh_from_db()
        self.assertEqual(flow.total_triggered, 0)

    def test_notice_is_not_repeated_within_the_hour(self):
        self.make_flow(*ask_flow_nodes(), business_hours_only=True,
                       business_hours=ALL_CLOSED, out_of_hours_message='Closed.')
        self.send(text_msg('hi'))
        self.send(text_msg('hi'))
        self.assertEqual(self.pinbot.texts(), ['Closed.'])
        self.assertEqual(BotConversation.objects.filter(contact=self.contact).count(), 1)

    def test_no_message_configured_still_does_not_run(self):
        self.make_flow(*ask_flow_nodes(), business_hours_only=True, business_hours=ALL_CLOSED)
        self.send(text_msg('hi'))
        self.assertEqual(self.pinbot.sent, [])

    def test_open_flow_runs(self):
        self.make_flow(*ask_flow_nodes(), business_hours_only=True, business_hours={})
        self.send(text_msg('hi'))
        self.assertEqual(self.pinbot.texts(), ['Your name?'])

    def test_out_of_hours_does_not_use_up_the_first_message_trigger(self):
        flow = self.make_flow(*ask_flow_nodes(), trigger_type='first_message', trigger_config={},
                              business_hours_only=True, business_hours=ALL_CLOSED)
        self.send(text_msg('hello'))
        BotFlow.objects.filter(pk=flow.pk).update(business_hours_only=False)
        self.send(text_msg('hello again'))
        self.assertEqual(self.pinbot.texts(), ['Your name?'])


# ─────────────────────────────────────────────────────────────────────────────
# 3. No-match handling + AI fallback
# ─────────────────────────────────────────────────────────────────────────────
def buttons_flow(extra_edges=()):
    nodes = [
        node('start', 'start'),
        node('pick', 'message_buttons', body='Buy or rent?', store_var='intent',
             buttons=[{'id': 'BUY', 'title': 'Buy'}, {'id': 'RENT', 'title': 'Rent'}]),
        node('buy', 'message_text', text='Buying it is'),
        node('rent', 'message_text', text='Renting it is'),
        node('lost', 'message_text', text='Let me get someone'),
    ]
    edges = [edge('start', 'pick'), edge('pick', 'buy', 'BUY'), edge('pick', 'rent', 'RENT'), *extra_edges]
    return nodes, edges


AI_REPLY = 'social_stats.bot_engine.handlers.smart._generate_reply'


class NoMatchTests(BotTestCase):
    def test_button_tap_follows_its_edge(self):
        self.make_flow(*buttons_flow())
        self.send(text_msg('hi'))
        self.send(button_msg('RENT', 'Rent'))
        self.assertEqual(self.pinbot.texts(), ['Renting it is'])
        self.assertEqual(self.conv().variables.get('intent'), 'Rent')

    def test_typing_the_button_title_counts_as_tapping_it(self):
        self.make_flow(*buttons_flow())
        self.send(text_msg('hi'))
        self.send(text_msg('  buy '))
        self.assertEqual(self.pinbot.texts(), ['Buying it is'])

    def test_no_match_edge_is_taken_when_wired(self):
        self.make_flow(*buttons_flow([edge('pick', 'lost', 'no_match')]))
        self.send(text_msg('hi'))
        self.send(text_msg('what is the price?'))
        self.assertEqual(self.pinbot.texts(), ['Let me get someone'])

    def test_ai_fallback_answers_once_then_reasks_the_same_node(self):
        self.make_flow(*buttons_flow(), ai_fallback_enabled=True, ai_fallback_persona='You sell flats.')
        self.send(text_msg('hi'))
        with patch(AI_REPLY, return_value='Prices start at 40 lakh.') as ai:
            self.send(text_msg('what is the price?'))
        self.assertIn('You sell flats.', ai.call_args.kwargs['persona'])
        self.assertEqual(self.pinbot.kinds(), ['buttons', 'text', 'buttons'])
        self.assertEqual(self.pinbot.texts(), ['Prices start at 40 lakh.'])
        conv = self.conv()
        self.assertEqual(conv.status, 'active')
        self.assertEqual(conv.current_node_id, 'pick')
        # …and a real pick afterwards still works
        self.send(button_msg('BUY', 'Buy'))
        self.assertEqual(self.pinbot.texts()[-1], 'Buying it is')

    def test_ai_fallback_failure_still_reasks(self):
        self.make_flow(*buttons_flow(), ai_fallback_enabled=True)
        self.send(text_msg('hi'))
        with patch(AI_REPLY, side_effect=RuntimeError('api down')):
            self.send(text_msg('hmm'))
        self.assertEqual(self.pinbot.kinds(), ['buttons', 'buttons'])
        self.assertEqual(self.conv().status, 'active')

    def test_without_fallback_or_no_match_edge_legacy_first_edge(self):
        self.make_flow(*buttons_flow())
        self.send(text_msg('hi'))
        self.send(text_msg('something else'))
        self.assertEqual(self.pinbot.texts(), ['Buying it is'])

    def test_condition_without_matching_edge_uses_ai_fallback_then_reasks_question(self):
        nodes = [
            node('start', 'start'),
            node('ask', 'ask_question', question='Buy or rent?', store_var='intent'),
            node('cond', 'condition', condition={'left': 'intent', 'op': '==', 'right': 'buy'}),
            node('buy', 'message_text', text='Buying it is'),
        ]
        edges = [edge('start', 'ask'), edge('ask', 'cond'), edge('cond', 'buy', 'true')]
        self.make_flow(nodes, edges, ai_fallback_enabled=True)
        self.send(text_msg('hi'))
        with patch(AI_REPLY, return_value='We do both.'):
            self.send(text_msg('not sure'))
        self.assertEqual(self.pinbot.texts(), ['Buy or rent?', 'We do both.', 'Buy or rent?'])
        self.send(text_msg('buy'))
        self.assertEqual(self.pinbot.texts()[-1], 'Buying it is')

    def test_condition_no_match_edge(self):
        nodes = [
            node('start', 'start'),
            node('ask', 'ask_question', question='Buy or rent?', store_var='intent'),
            node('cond', 'condition', condition={'left': 'intent', 'op': '==', 'right': 'buy'}),
            node('buy', 'message_text', text='Buying it is'),
            node('other', 'message_text', text='Tell me more'),
        ]
        edges = [edge('start', 'ask'), edge('ask', 'cond'), edge('cond', 'buy', 'true'),
                 edge('cond', 'other', 'no_match')]
        self.make_flow(nodes, edges, ai_fallback_enabled=True)
        self.send(text_msg('hi'))
        with patch(AI_REPLY) as ai:
            self.send(text_msg('lease'))
        ai.assert_not_called()
        self.assertEqual(self.pinbot.texts()[-1], 'Tell me more')


# ─────────────────────────────────────────────────────────────────────────────
# 4. Abandonment
# ─────────────────────────────────────────────────────────────────────────────
class AbandonmentTests(BotTestCase):
    def _age(self, conv, minutes):
        BotConversation.objects.filter(pk=conv.pk).update(
            last_activity_at=timezone.now() - timedelta(minutes=minutes))

    def test_beat_task_marks_idle_conversations_abandoned(self):
        self.make_flow(*ask_flow_nodes())
        self.send(text_msg('hi'))
        stale = self.conv()
        self._age(stale, 1441)
        other = WhatsAppContact.objects.create(client=self.client_obj, phone='919800000002',
                                               last_inbound_at=timezone.now())
        self.send(text_msg('hi'), other)

        self.assertEqual(mark_abandoned_bot_conversations(), 1)
        stale.refresh_from_db()
        self.assertEqual(stale.status, 'abandoned')
        self.assertIsNotNone(stale.ended_at)
        self.assertNotIn('_waiting_for_node', stale.variables)
        self.assertIn('idle_timeout', self.notes(stale))
        self.assertEqual(BotConversation.objects.get(contact=other).status, 'active')

    def test_threshold_is_per_client(self):
        self.client_obj.bot_abandon_after_minutes = 30
        self.client_obj.save(update_fields=['bot_abandon_after_minutes'])
        self.make_flow(*ask_flow_nodes())
        self.send(text_msg('hi'))
        self._age(self.conv(), 31)
        self.assertEqual(mark_abandoned_bot_conversations(), 1)

    def test_stale_conversation_is_replaced_on_next_message(self):
        self.make_flow(*ask_flow_nodes())
        self.send(text_msg('hi'))
        old = self.conv()
        self._age(old, 2000)
        self.send(text_msg('hi'))
        old.refresh_from_db()
        self.assertEqual(old.status, 'abandoned')
        new = self.conv(status='active')
        self.assertNotEqual(new.pk, old.pk)
        self.assertEqual(self.pinbot.texts(), ['Your name?', 'Your name?'])

    def test_ad_click_for_a_different_flow_replaces_the_running_one(self):
        self.make_flow(*ask_flow_nodes())
        ad_nodes = [node('start', 'start'), node('hello', 'message_text', text='Thanks for clicking our ad')]
        ad_flow = self.make_flow(ad_nodes, [edge('start', 'hello')], name='Ad flow',
                                 trigger_type='ctwa_ad', trigger_config={'ad_ids': ['AD1']})
        self.send(text_msg('hi'))
        old = self.conv()
        self.send(ad_msg('AD1'))
        old.refresh_from_db()
        self.assertEqual(old.status, 'abandoned')
        self.assertEqual(self.conv().flow_id, ad_flow.id)
        self.assertEqual(self.pinbot.texts()[-1], 'Thanks for clicking our ad')

    def test_ad_click_for_the_same_flow_continues_it(self):
        self.make_flow(*ask_flow_nodes(), trigger_type='ctwa_ad', trigger_config={'ad_ids': ['AD1']})
        self.send(ad_msg('AD1'))
        self.send(ad_msg('AD1', body='Ravi'))
        self.assertEqual(BotConversation.objects.filter(contact=self.contact).count(), 1)
        self.assertEqual(self.pinbot.texts(), ['Your name?', 'Thanks Ravi'])


# ─────────────────────────────────────────────────────────────────────────────
# 5. Flow versions
# ─────────────────────────────────────────────────────────────────────────────
class FlowVersionTests(BotTestCase):
    def test_publish_snapshots_and_conversations_pin_the_version(self):
        flow = self.make_flow(*ask_flow_nodes())
        self.assertEqual(flow.published_version, 1)
        self.send(text_msg('hi'))
        self.assertEqual(self.conv().flow_version.version, 1)

    def test_editing_a_live_flow_does_not_change_running_conversations(self):
        flow = self.make_flow(*ask_flow_nodes())
        self.send(text_msg('hi'))
        # Author rewrites the flow while Asha is mid-conversation.
        flow.nodes = [node('start', 'start'), node('new', 'message_text', text='Brand new flow')]
        flow.edges = [edge('start', 'new')]
        flow.save()
        self.send(text_msg('Ravi'))
        self.assertEqual(self.pinbot.texts(), ['Your name?', 'Thanks Ravi'])

        # Unpublished edits don't reach new conversations either…
        other = WhatsAppContact.objects.create(client=self.client_obj, phone='919800000002',
                                               last_inbound_at=timezone.now())
        self.send(text_msg('hi'), other)
        self.assertEqual(self.pinbot.texts()[-1], 'Your name?')
        # …until the flow is published again.
        snapshot_flow(flow)
        third = WhatsAppContact.objects.create(client=self.client_obj, phone='919800000003',
                                               last_inbound_at=timezone.now())
        self.send(text_msg('hi'), third)
        self.assertEqual(self.pinbot.texts()[-1], 'Brand new flow')
        self.assertEqual(BotConversation.objects.get(contact=third).flow_version.version, 2)

    def test_republishing_an_unchanged_graph_reuses_the_snapshot(self):
        flow = self.make_flow(*ask_flow_nodes())
        snapshot_flow(flow)
        self.assertEqual(flow.versions.count(), 1)

    def test_legacy_conversation_without_version_reads_the_live_flow(self):
        flow = self.make_flow(*ask_flow_nodes(), publish=False)
        BotFlow.objects.filter(pk=flow.pk).update(is_active=True)     # published before versioning
        self.send(text_msg('hi'))
        conv = self.conv()
        self.assertIsNone(conv.flow_version)
        self.send(text_msg('Ravi'))
        self.assertEqual(self.pinbot.texts(), ['Your name?', 'Thanks Ravi'])

    def test_data_migration_snapshots_live_flows(self):
        import importlib
        from django.apps import apps
        migration = importlib.import_module('social_stats.migrations.0068_bot_engine_data_fixes')
        flow = self.make_flow(*ask_flow_nodes(), publish=False)
        BotFlow.objects.filter(pk=flow.pk).update(is_active=True)
        migration.snapshot_published_flows(apps, None)
        flow.refresh_from_db()
        self.assertEqual(flow.published_version, 1)
        self.assertEqual(flow.versions.get().nodes, flow.nodes)


class FlowVersionApiTests(BotTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(username=f'u-{uuid.uuid4().hex[:10]}', password='x')
        UserProfile.objects.create(user=self.user, role='superadmin')
        self.api = APIClient()
        self.api.force_authenticate(self.user)
        self.q = f'?client_id={self.client_obj.id}'

    def test_publish_list_versions_and_rollback(self):
        flow = self.make_flow(*ask_flow_nodes(), publish=False)
        res = self.api.post(f'/api/bot-flows/{flow.id}/publish/{self.q}')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['published_version'], 1)

        v1_nodes = flow.nodes
        flow.nodes = [node('start', 'start'), node('new', 'message_text', text='v2')]
        flow.edges = [edge('start', 'new')]
        flow.save()
        self.assertEqual(self.api.post(f'/api/bot-flows/{flow.id}/publish/{self.q}').data['published_version'], 2)

        res = self.api.get(f'/api/bot-flows/{flow.id}/versions/{self.q}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([v['version'] for v in res.data['results']], [2, 1])
        self.assertEqual([v['is_published'] for v in res.data['results']], [True, False])
        self.assertEqual(res.data['results'][0]['published_by'], self.user.id)

        res = self.api.post(f'/api/bot-flows/{flow.id}/rollback/{self.q}', {'version': 1}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        flow.refresh_from_db()
        self.assertEqual(flow.published_version, 1)
        self.assertEqual(flow.nodes, v1_nodes)
        self.send(text_msg('hi'))
        self.assertEqual(self.pinbot.texts(), ['Your name?'])

    def test_rollback_rejects_unknown_version_and_other_tenants(self):
        flow = self.make_flow(*ask_flow_nodes())
        res = self.api.post(f'/api/bot-flows/{flow.id}/rollback/{self.q}', {'version': 9}, format='json')
        self.assertEqual(res.status_code, 404)
        res = self.api.post(f'/api/bot-flows/{flow.id}/rollback/{self.q}', {}, format='json')
        self.assertEqual(res.status_code, 400)

        outsider = User.objects.create_user(username=f'o-{uuid.uuid4().hex[:10]}', password='x')
        other_client = Client.objects.create(name='B', company='B', email=f'b-{uuid.uuid4().hex[:6]}@x.test')
        UserProfile.objects.create(user=outsider, role='client', client=other_client)
        api = APIClient()
        api.force_authenticate(outsider)
        self.assertEqual(api.get(f'/api/bot-flows/{flow.id}/versions/').status_code, 404)
        self.assertEqual(api.post(f'/api/bot-flows/{flow.id}/rollback/', {'version': 1}, format='json').status_code, 404)


# ─────────────────────────────────────────────────────────────────────────────
# 6. 24-hour customer-service window
# ─────────────────────────────────────────────────────────────────────────────
class ServiceWindowTests(BotTestCase):
    def _close_window(self):
        WhatsAppContact.objects.filter(pk=self.contact.pk).update(
            last_inbound_at=timezone.now() - timedelta(hours=25))
        self.contact.refresh_from_db()

    def _conversation(self, nodes, edges):
        flow = self.make_flow(nodes, edges)
        return BotConversation.objects.create(
            client=self.client_obj, flow=flow, flow_version=flow.versions.first(),
            contact=self.contact, triggered_via='manual',
            current_node_id='start', path_history=['start'])

    def test_helper(self):
        now = timezone.now()
        self.assertTrue(in_service_window(self.contact))
        self.contact.last_inbound_at = now - timedelta(hours=23, minutes=59)
        self.assertTrue(in_service_window(self.contact, now))
        self.contact.last_inbound_at = now - timedelta(hours=24)
        self.assertFalse(in_service_window(self.contact, now))
        self.contact.last_inbound_at = None
        self.assertFalse(in_service_window(self.contact))

    def test_every_freeform_send_is_blocked_outside_the_window(self):
        self._close_window()
        freeform = {
            'message_text': {'text': 'hello'},
            'message_image': {'url': 'https://x.test/a.jpg'},
            'message_video': {'url': 'https://x.test/a.mp4'},
            'message_document': {'url': 'https://x.test/a.pdf'},
            'message_buttons': {'body': 'Pick', 'buttons': [{'id': 'A', 'title': 'A'}]},
            'message_list': {'body': 'Pick', 'sections': [{'title': 'S', 'rows': [{'id': 'r', 'title': 'R'}]}]},
            'message_cta': {'body': 'Visit', 'url': 'https://x.test'},
            'ask_question': {'question': 'Name?'},
            'ask_email': {'question': 'Email?'},
            'ask_phone': {'question': 'Phone?'},
            'ask_number': {'question': 'How many?'},
            'ask_location': {'question': 'Where?'},
            'ask_attachment': {'question': 'Upload'},
            'ai_chat': {'opening_message': 'How can I help?'},
        }
        for node_type, data in freeform.items():
            with self.subTest(node_type=node_type):
                self.pinbot.sent.clear()
                conv = self._conversation([node('start', 'start'), node('n', node_type, **data)],
                                          [edge('start', 'n')])
                BotExecutor(conv, pinbot=self.pinbot).execute_node('start')
                conv.refresh_from_db()
                self.assertEqual(self.pinbot.sent, [])
                self.assertEqual(conv.status, 'failed')
                self.assertEqual(self.errors(conv), ['outside_24h_window'])

    def test_fallback_template_is_sent_instead(self):
        self._close_window()
        conv = self._conversation(
            [node('start', 'start'),
             node('n', 'message_text', text='Your report is ready',
                  fallback_template={'name': 'report_ready', 'language': 'en'}),
             node('end', 'end_conversation')],
            [edge('start', 'n'), edge('n', 'end')])
        BotExecutor(conv, pinbot=self.pinbot).execute_node('start')
        conv.refresh_from_db()
        self.assertEqual([(m['kind'], m.get('name'), m.get('language')) for m in self.pinbot.sent],
                         [('template', 'report_ready', 'en')])
        self.assertEqual(conv.status, 'completed')

    def test_template_nodes_are_always_allowed(self):
        self._close_window()
        conv = self._conversation(
            [node('start', 'start'), node('t', 'message_template', template_name='hello_again')],
            [edge('start', 't')])
        BotExecutor(conv, pinbot=self.pinbot).execute_node('start')
        self.assertEqual(self.pinbot.kinds(), ['template'])

    def test_ask_with_fallback_resends_the_real_question_when_the_user_replies(self):
        self._close_window()
        nodes, edges = ask_flow_nodes()
        nodes[1]['data']['fallback_template'] = 'come_back'
        conv = self._conversation(nodes, edges)
        BotExecutor(conv, pinbot=self.pinbot).execute_node('start')
        self.assertEqual(self.pinbot.kinds(), ['template'])
        # The user answers the template → window is open again.
        WhatsAppContact.objects.filter(pk=self.contact.pk).update(last_inbound_at=timezone.now())
        self.send(text_msg('ok'))
        self.assertEqual(self.pinbot.texts(), ['Your name?'])
        self.send(text_msg('Ravi'))
        self.assertEqual(self.pinbot.texts()[-1], 'Thanks Ravi')

    @patch('social_stats.bot_engine.handlers.timed.resume_bot_conversation.apply_async')
    def test_resume_after_long_wait_applies_the_same_rule(self, apply_async):
        nodes = [node('start', 'start'), node('wait', 'wait_delay', hours=30),
                 node('after', 'message_text', text='Still interested?')]
        self.make_flow(nodes, [edge('start', 'wait'), edge('wait', 'after')])
        self.send(text_msg('hi'))
        conv = self.conv()
        self.assertEqual(apply_async.call_args.kwargs['args'], [conv.id, 'wait'])
        self._close_window()

        resume_bot_conversation.run(conv.id, 'wait', pinbot=self.pinbot)
        conv.refresh_from_db()
        self.assertEqual(self.pinbot.sent, [])
        self.assertEqual(conv.status, 'failed')
        self.assertEqual(self.errors(conv), ['outside_24h_window'])

    @patch('social_stats.bot_engine.handlers.timed.resume_bot_conversation.apply_async')
    def test_reply_during_a_wait_does_not_run_the_next_node_twice(self, apply_async):
        nodes = [node('start', 'start'), node('wait', 'wait_delay', minutes=5),
                 node('after', 'message_text', text='Here is your brochure')]
        self.make_flow(nodes, [edge('start', 'wait'), edge('wait', 'after')])
        self.send(text_msg('hi'))
        conv = self.conv()
        self.send(text_msg('hello?'))                 # impatient reply during the wait
        self.assertEqual(self.pinbot.sent, [])
        resume_bot_conversation.run(conv.id, 'wait', pinbot=self.pinbot)
        resume_bot_conversation.run(conv.id, 'wait', pinbot=self.pinbot)   # duplicate timer
        self.assertEqual(self.pinbot.texts(), ['Here is your brochure'])


# ─────────────────────────────────────────────────────────────────────────────
# 7. Ask-node retries
# ─────────────────────────────────────────────────────────────────────────────
class RetryTests(BotTestCase):
    def _email_flow(self, *, invalid_edge=False, handoff=False, max_retries=None):
        data = {'question': 'Email?', 'store_var': 'email'}
        if max_retries is not None:
            data['max_retries'] = max_retries
        nodes = [node('start', 'start'), node('ask', 'ask_email', **data),
                 node('ok', 'message_text', text='Got {{email}}'),
                 node('sorry', 'message_text', text='No worries, we will call you')]
        edges = [edge('start', 'ask'), edge('ask', 'ok')]
        if invalid_edge:
            edges.append(edge('ask', 'sorry', 'invalid'))
        if handoff:
            nodes.append(node('human', 'human_handoff', message='Connecting you'))
        return self.make_flow(nodes, edges)

    def test_default_three_retries_then_invalid_edge(self):
        self._email_flow(invalid_edge=True)
        self.send(text_msg('hi'))
        for _ in range(3):
            self.send(text_msg('nope'))
        conv = self.conv()
        self.assertEqual(conv.status, 'active')
        self.assertEqual(conv.variables['_retries'], {'ask': 3})
        self.assertEqual(len(self.pinbot.texts()), 4)            # question + 3 re-prompts
        self.send(text_msg('still nope'))
        self.assertEqual(self.pinbot.texts()[-1], 'No worries, we will call you')
        self.assertNotIn('ask', self.conv().variables.get('_retries', {}))

    def test_valid_answer_resets_and_never_takes_the_invalid_edge(self):
        self._email_flow(invalid_edge=True)
        self.send(text_msg('hi'))
        self.send(text_msg('nope'))
        self.send(text_msg('a@b.co'))
        self.assertEqual(self.pinbot.texts()[-1], 'Got a@b.co')

    def test_custom_max_retries_then_handoff_when_no_invalid_edge(self):
        self._email_flow(handoff=True, max_retries=1)
        self.send(text_msg('hi'))
        self.send(text_msg('nope'))
        self.send(text_msg('nope'))
        conv = self.conv()
        self.assertEqual(conv.status, 'handed_off')
        self.assertEqual(self.pinbot.texts()[-1], 'Connecting you')

    def test_fails_when_nothing_is_wired(self):
        self._email_flow(max_retries=0)
        self.send(text_msg('hi'))
        self.send(text_msg('nope'))
        conv = self.conv()
        self.assertEqual(conv.status, 'failed')
        self.assertEqual(self.errors(conv), ['max_retries_exceeded'])

    def test_message_counters_survive_a_reprompt(self):
        self._email_flow()
        self.send(text_msg('hi'))
        self.send(text_msg('nope'))
        self.send(text_msg('nope'))
        self.assertEqual(self.conv().user_messages_count, 2)


# ─────────────────────────────────────────────────────────────────────────────
# 8. Idempotency + locking
# ─────────────────────────────────────────────────────────────────────────────
class IdempotencyTests(BotTestCase):
    def setUp(self):
        super().setUp()
        WhatsAppAccount.objects.create(client=self.client_obj, waba_id='W1', phone_number_id='PN1')
        self.make_flow(*ask_flow_nodes())

    def _webhook_value(self, msg):
        return {'metadata': {'phone_number_id': 'PN1'},
                'contacts': [{'wa_id': self.contact.phone, 'profile': {'name': 'Asha'}}],
                'messages': [{**msg, 'from': self.contact.phone}]}

    def test_redelivered_webhook_is_processed_once(self):
        from social_stats import whatsapp_tasks
        value = self._webhook_value(text_msg('hi', msg_id='wamid.SAME'))
        with patch('social_stats.whatsapp_service.get_pinbot_for_client', return_value=self.pinbot):
            whatsapp_tasks._process_inbound_messages(value)
            whatsapp_tasks._process_inbound_messages(value)
        self.assertEqual(WhatsAppMessage.objects.filter(pinbot_message_id='wamid.SAME').count(), 1)
        self.assertEqual(BotConversation.objects.filter(contact=self.contact).count(), 1)
        self.assertEqual(self.pinbot.texts(), ['Your name?'])

    def test_unique_constraint_on_client_message_id_direction(self):
        kwargs = dict(client=self.client_obj, contact=self.contact, pinbot_message_id='wamid.X',
                      direction='inbound')
        WhatsAppMessage.objects.create(**kwargs)
        with self.assertRaises(IntegrityError), transaction.atomic():
            WhatsAppMessage.objects.create(**kwargs)
        WhatsAppMessage.objects.create(**{**kwargs, 'direction': 'outbound'})   # other direction is fine
        for _ in range(2):                                                       # blank ids are exempt
            WhatsAppMessage.objects.create(**{**kwargs, 'pinbot_message_id': ''})

    def test_engine_locks_the_conversation_row(self):
        self.send(text_msg('hi'))
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        with CaptureQueriesContext(connection) as ctx:
            self.send(text_msg('Ravi'))
        locking = [q['sql'] for q in ctx.captured_queries if 'FOR UPDATE' in q['sql'].upper()]
        if connection.features.has_select_for_update:
            self.assertTrue(any('botconversation' in q.lower() for q in locking), locking)
            self.assertTrue(any('whatsappcontact' in q.lower() for q in locking), locking)


# ─────────────────────────────────────────────────────────────────────────────
# 9. Node catalog stays in sync
# ─────────────────────────────────────────────────────────────────────────────
class NodeCatalogSyncTests(TestCase):
    CATALOG = Path(__file__).resolve().parents[3] / 'frontend/src/components/bot/nodeCatalog.js'

    def test_every_node_type_has_a_handler_and_vice_versa(self):
        self.assertEqual(set(NODE_TYPES), set(NODE_HANDLERS))
        self.assertNotIn('rate_limit', NODE_TYPES)
        self.assertLessEqual(set(REPLY_HANDLERS), set(NODE_TYPES))

    def test_frontend_catalog_matches_backend(self):
        if not self.CATALOG.exists():
            self.skipTest('frontend sources not present (backend-only checkout/image)')
        source = self.CATALOG.read_text()
        body = source[source.index('export const NODE_CATALOG = {'):source.index('export const CATEGORIES')]
        keys = set(re.findall(r'^  (\w+): \{$', body, flags=re.M))
        self.assertEqual(keys, set(NODE_TYPES))


# ─────────────────────────────────────────────────────────────────────────────
# 10. Handoff assignment
# ─────────────────────────────────────────────────────────────────────────────
class HandoffAssignmentTests(BotTestCase):
    def _staff(self, name, client=None):
        user = User.objects.create_user(username=f'{name}-{uuid.uuid4().hex[:6]}', password='x')
        profile = UserProfile.objects.create(user=user, role='staff')
        profile.assigned_clients.add(client or self.client_obj)
        return user

    def _handoff(self, phone, **data):
        contact = WhatsAppContact.objects.create(client=self.client_obj, phone=phone,
                                                 last_inbound_at=timezone.now())
        self.send(text_msg('hi'), contact)
        return BotConversation.objects.get(contact=contact)

    def _flow(self, **data):
        return self.make_flow([node('start', 'start'), node('human', 'human_handoff', **data)],
                              [edge('start', 'human')])

    @patch('social_stats.notification_dispatcher.dispatch')
    def test_least_busy_agent_gets_the_conversation(self, _dispatch):
        a, b = self._staff('a'), self._staff('b')
        self._flow()
        busy_contact = WhatsAppContact.objects.create(client=self.client_obj, phone='919811111111')
        for _ in range(2):
            BotConversation.objects.create(client=self.client_obj, contact=busy_contact,
                                           triggered_via='manual', status='handed_off', handed_off_to_user=a)
        conv = self._handoff('919822222201')
        self.assertEqual(conv.status, 'handed_off')
        self.assertEqual(conv.handed_off_to_user, b)

    @patch('social_stats.notification_dispatcher.dispatch')
    def test_ties_are_broken_round_robin(self, _dispatch):
        agents = {self._staff('a').id, self._staff('b').id, self._staff('c').id}
        self._flow()
        picked = [self._handoff(f'9198333333{i:02d}').handed_off_to_user_id for i in range(6)]
        self.assertEqual(set(picked[:3]), agents)       # everyone gets one before anyone gets two
        self.assertEqual(set(picked[3:]), agents)

    @patch('social_stats.notification_dispatcher.dispatch')
    def test_explicit_assignee_from_another_tenant_is_ignored(self, _dispatch):
        other_client = Client.objects.create(name='B', company='B', email=f'b-{uuid.uuid4().hex[:6]}@x.test')
        outsider = self._staff('outsider', client=other_client)
        mine = self._staff('mine')
        self._flow(assignee_user_id=outsider.id)
        self.assertEqual(self._handoff('919844444401').handed_off_to_user, mine)

    @patch('social_stats.notification_dispatcher.dispatch')
    def test_explicit_assignee_in_the_workspace_is_honoured(self, _dispatch):
        self._staff('a')
        chosen = self._staff('chosen')
        self._flow(assignee_user_id=chosen.id)
        self.assertEqual(self._handoff('919855555501').handed_off_to_user, chosen)

    def test_no_staff_leaves_it_unassigned(self):
        self._flow()
        conv = self._handoff('919866666601')
        self.assertEqual(conv.status, 'handed_off')
        self.assertIsNone(conv.handed_off_to_user)


# ─────────────────────────────────────────────────────────────────────────────
# New action nodes + small engine fixes
# ─────────────────────────────────────────────────────────────────────────────
class ActionNodeTests(BotTestCase):
    def test_assign_segment_adds_contact_to_a_list_of_this_client_only(self):
        other_client = Client.objects.create(name='B', company='B', email=f'b-{uuid.uuid4().hex[:6]}@x.test')
        foreign = WhatsAppContactList.objects.create(client=other_client, name='Hot leads')
        nodes = [node('start', 'start'), node('seg', 'assign_segment', list_name='Hot leads'),
                 node('seg2', 'assign_segment', list_id=foreign.id)]
        self.make_flow(nodes, [edge('start', 'seg'), edge('seg', 'seg2')])
        self.send(text_msg('hi'))
        mine = WhatsAppContactList.objects.get(client=self.client_obj, name='Hot leads')
        self.assertEqual(list(mine.contacts.all()), [self.contact])
        self.assertEqual(foreign.contacts.count(), 0)
        self.assertEqual(self.conv().status, 'completed')

    @patch('social_stats.security.ssrf.check_url')
    @patch('social_stats.bot_webhook_tasks.dispatch_webhook.delay')
    def test_crm_push_maps_fields_and_keeps_headers_out_of_the_log(self, delay, _check):
        nodes = [node('start', 'start'),
                 node('ask', 'ask_question', question='Budget?', store_var='budget'),
                 node('crm', 'crm_push', url='https://crm.example.com/leads',
                      headers={'Authorization': 'Bearer SECRET-KEY'},
                      field_map={'full_name': '{{name}}', 'mobile': '{{phone}}',
                                 'deal_size': '{{budget}}', 'pipeline': 'whatsapp'}),
                 node('done', 'message_text', text='Saved')]
        self.make_flow(nodes, [edge('start', 'ask'), edge('ask', 'crm'), edge('crm', 'done')])
        self.send(text_msg('hi'))
        self.send(text_msg('50 lakh'))
        kwargs = delay.call_args.kwargs
        self.assertEqual(kwargs['url'], 'https://crm.example.com/leads')
        self.assertEqual({k: v for k, v in kwargs['body'].items() if k != 'source'},
                         {'full_name': 'Asha', 'mobile': '919800000001',
                          'deal_size': '50 lakh', 'pipeline': 'whatsapp'})
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer SECRET-KEY')
        conv = self.conv()
        self.assertNotIn('SECRET-KEY', str(list(conv.steps.values_list('payload', flat=True))))
        self.assertEqual(self.pinbot.texts()[-1], 'Saved')

    def test_crm_push_without_url_takes_failure_edge(self):
        nodes = [node('start', 'start'), node('crm', 'crm_push', url=''),
                 node('ok', 'message_text', text='ok'), node('bad', 'message_text', text='crm down')]
        self.make_flow(nodes, [edge('start', 'crm'), edge('crm', 'ok'), edge('crm', 'bad', 'failure')])
        self.send(text_msg('hi'))
        self.assertEqual(self.pinbot.texts(), ['crm down'])

    def test_random_split_follows_the_chosen_unlabelled_edge(self):
        nodes = [node('start', 'start'), node('split', 'random_split'),
                 node('a', 'message_text', text='A'), node('b', 'message_text', text='B')]
        self.make_flow(nodes, [edge('start', 'split'), edge('split', 'a'), edge('split', 'b')])
        with patch('random.random', return_value=0.99):      # second of two equal weights
            self.send(text_msg('hi'))
        self.assertEqual(self.pinbot.texts(), ['B'])
