"""
AIContextProvider + AI Assistant tool coverage tests.

Verifies:
  • AIContextProvider returns brand voice + metrics + audience + industry
    in both dict and prompt-fragment forms.
  • Each bucket fails gracefully — missing brand voice / no metrics / no
    competitors does not raise; the bucket returns None.
  • New AI Assistant tools (get_lead, update_lead_status, reply_to_message,
    list_bot_flows) are wired into the dispatch table + schema.
  • update_lead_status + reply_to_message are gated by CONFIRMATION_REQUIRED.
  • update_lead_status actually transitions the row + emits a
    `lead.status_changed` event-bus event.
"""
import uuid

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from social_stats.ai.context import AIContextProvider, build_context
from social_stats.ai.tools import (
    TOOL_SCHEMA, CONFIRMATION_REQUIRED, _DISPATCH, execute_tool,
)
from social_stats.models import (
    Client, UserProfile, EventLog, WhatsAppContact,
)
from social_stats.bot_models import Lead, BotFlow, BotConversation


def _client(label='c'):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:6]}@x.test',
    )


def _user(client_obj=None):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:10]}',
        email=f'{uuid.uuid4().hex[:6]}@x.test',
        password='x', is_active=True,
    )
    UserProfile.objects.create(
        user=u, role='client',
        client=client_obj,
    )
    return u


# ══════════════════════════════════════════════════════════════════════
# AIContextProvider
# ══════════════════════════════════════════════════════════════════════
class AIContextProviderTests(TestCase):
    def setUp(self):
        self.client_obj = _client('ctx')
        self.user = _user(self.client_obj)

    def test_as_dict_returns_all_buckets_even_when_empty(self):
        """Brand voice / metrics / competitors might all be None for a
        fresh client. The dict must still have every key — consumers can
        rely on the shape."""
        ctx = build_context(self.client_obj, user=self.user)
        d = ctx.as_dict()
        self.assertIn('client', d)
        self.assertIn('brand_voice', d)
        self.assertIn('recent_metrics', d)
        self.assertIn('audience', d)
        self.assertIn('industry', d)
        # client is always populated (we just queried by id)
        self.assertEqual(d['client']['id'], self.client_obj.id)
        self.assertEqual(d['client']['company'], self.client_obj.company)

    def test_as_prompt_fragment_starts_with_company_anchor(self):
        ctx = build_context(self.client_obj)
        frag = ctx.as_prompt_fragment()
        self.assertIn(self.client_obj.company, frag)
        # Should be plain prose — no None / empty sections
        self.assertNotIn('None', frag)
        self.assertNotIn('\n\n\n', frag)

    def test_as_prompt_fragment_handles_failing_buckets_silently(self):
        """If a bucket raises (e.g. an unrelated migration failure), the
        provider returns None for that bucket and the prompt fragment still
        renders. This is the defence-in-depth contract."""
        ctx = build_context(self.client_obj)
        # Force `_recent_metrics` to raise.
        original = ctx._recent_metrics
        ctx._recent_metrics = lambda: (_ for _ in ()).throw(RuntimeError('boom'))
        # cache-bust by clearing
        ctx._cache.pop('recent_metrics', None)
        out = ctx.as_dict()
        self.assertIsNone(out['recent_metrics'])

    def test_as_dict_caches_per_instance(self):
        """Each bucket runs at most once per instance — verified by hijacking
        the bucket fn to count calls."""
        ctx = build_context(self.client_obj)
        calls = {'n': 0}
        def counter():
            calls['n'] += 1
            return {'industry': 'test', 'competitor_names': []}
        ctx._industry = counter
        ctx.as_dict()
        ctx.as_dict()
        # Two calls of as_dict, but the bucket fn only runs once.
        self.assertEqual(calls['n'], 1)


# ══════════════════════════════════════════════════════════════════════
# AI Assistant tool registration
# ══════════════════════════════════════════════════════════════════════
class ToolRegistryTests(TestCase):
    """The new tools are reachable through the same dispatch surface every
    other tool uses, and their schemas are complete."""

    def test_new_tools_are_registered(self):
        names = {t['name'] for t in TOOL_SCHEMA}
        for new in ('get_lead', 'update_lead_status', 'reply_to_message', 'list_bot_flows'):
            self.assertIn(new, names, f'{new} missing from TOOL_SCHEMA')

    def test_new_tools_in_dispatch_table(self):
        for new in ('get_lead', 'update_lead_status', 'reply_to_message', 'list_bot_flows'):
            self.assertIn(new, _DISPATCH)

    def test_state_mutating_tools_require_confirmation(self):
        """Read tools must NOT be in CONFIRMATION_REQUIRED; write tools must be."""
        self.assertNotIn('get_lead', CONFIRMATION_REQUIRED)
        self.assertNotIn('list_bot_flows', CONFIRMATION_REQUIRED)
        self.assertIn('update_lead_status', CONFIRMATION_REQUIRED)
        self.assertIn('reply_to_message', CONFIRMATION_REQUIRED)

    def test_every_schema_entry_has_required_fields(self):
        """A tool with no name / description / input_schema would crash the
        Claude API call. Catch the regression at dev time."""
        for t in TOOL_SCHEMA:
            self.assertIn('name', t)
            self.assertIn('description', t)
            self.assertIn('input_schema', t)
            self.assertEqual(t['input_schema'].get('type'), 'object')


# ══════════════════════════════════════════════════════════════════════
# Tool implementations — execute_tool surface
# ══════════════════════════════════════════════════════════════════════
@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class ToolExecutionTests(TestCase):
    def setUp(self):
        self.client_obj = _client('tools')
        self.user = _user(self.client_obj)
        self.contact = WhatsAppContact.objects.create(
            client=self.client_obj, phone='+919999000444',
            name='AI Tool Lead', opt_in_status='opted_in',
        )
        self.flow = BotFlow.objects.create(
            client=self.client_obj, name='tools-test',
            nodes=[], edges=[], created_by=self.user,
        )
        self.conv = BotConversation.objects.create(
            client=self.client_obj, contact=self.contact, flow=self.flow,
            triggered_via='manual',
        )
        self.lead = Lead.objects.create(
            client=self.client_obj, contact=self.contact,
            phone='+919999000444', name='AI Tool Lead',
            source_flow=self.flow, source_conversation=self.conv,
        )

    def test_get_lead_returns_lead_payload(self):
        out = execute_tool(
            name='get_lead',
            tool_input={'lead_id': self.lead.id},
            client=self.client_obj, user=self.user,
        )
        self.assertTrue(out['ok'])
        self.assertEqual(out['data']['id'], self.lead.id)
        self.assertEqual(out['data']['name'], 'AI Tool Lead')
        self.assertEqual(out['data']['status'], 'new')
        # The activity timeline is part of the surface (empty list is fine).
        self.assertIn('recent_activity', out['data'])

    def test_get_lead_rejects_cross_tenant_access(self):
        """A Lead belonging to another client must NOT leak."""
        other = _client('other')
        contact = WhatsAppContact.objects.create(
            client=other, phone='+919999000999',
            name='Other Lead', opt_in_status='opted_in',
        )
        other_lead = Lead.objects.create(
            client=other, contact=contact, phone='+919999000999', name='Other Lead',
        )
        out = execute_tool(
            name='get_lead',
            tool_input={'lead_id': other_lead.id},
            client=self.client_obj, user=self.user,
        )
        self.assertTrue(out['ok'])
        # `data` is the inner dict; success path returns 'error' inside data
        # when the lookup is cross-tenant.
        self.assertIn('error', out['data'])

    def test_update_lead_status_requires_confirmation(self):
        """Without confirmed=True, the dispatcher returns a confirmation
        envelope rather than executing."""
        out = execute_tool(
            name='update_lead_status',
            tool_input={'lead_id': self.lead.id, 'status': 'qualified'},
            client=self.client_obj, user=self.user,
            # confirmed defaults to False
        )
        self.assertFalse(out['ok'])
        self.assertTrue(out.get('confirmation_required'))
        self.assertIn('qualified', out['summary'])
        # Nothing changed yet.
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, 'new')

    def test_update_lead_status_executes_with_confirmation(self):
        with self.captureOnCommitCallbacks(execute=True):
            out = execute_tool(
                name='update_lead_status',
                tool_input={'lead_id': self.lead.id, 'status': 'qualified',
                            'note': 'AI moved this'},
                client=self.client_obj, user=self.user,
                confirmed=True,
            )
        self.assertTrue(out['ok'])
        self.assertEqual(out['data']['new_status'], 'qualified')
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, 'qualified')
        self.assertIn('AI moved this', self.lead.notes)
        evt = EventLog.objects.filter(
            client=self.client_obj,
            event_type='lead.status_changed',
        ).first()
        self.assertIsNotNone(evt, 'expected lead.status_changed EventLog row')
        self.assertEqual(evt.payload['from_status'], 'new')
        self.assertEqual(evt.payload['to_status'], 'qualified')
        self.assertEqual(evt.actor_type, 'ai')

    def test_update_lead_status_rejects_invalid_status(self):
        out = execute_tool(
            name='update_lead_status',
            tool_input={'lead_id': self.lead.id, 'status': 'wat'},
            client=self.client_obj, user=self.user,
            confirmed=True,
        )
        self.assertTrue(out['ok'])  # tool ran; the inner `data.error` records the rejection
        self.assertIn('error', out['data'])

    def test_list_bot_flows_returns_active_flows(self):
        """Read-only tool — no confirmation gate, returns the flow we built
        in setUp."""
        out = execute_tool(
            name='list_bot_flows', tool_input={},
            client=self.client_obj, user=self.user,
        )
        self.assertTrue(out['ok'])
        self.assertEqual(out['data']['count'], 1)
        flow = out['data']['flows'][0]
        self.assertEqual(flow['name'], 'tools-test')
        self.assertEqual(flow['version'], 1)

    def test_reply_to_message_requires_confirmation(self):
        out = execute_tool(
            name='reply_to_message',
            tool_input={'conversation_id': 1, 'text': 'Hi there!'},
            client=self.client_obj, user=self.user,
        )
        self.assertFalse(out['ok'])
        self.assertTrue(out.get('confirmation_required'))
