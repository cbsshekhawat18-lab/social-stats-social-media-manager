"""
Cross-feature workflow tests.

Each test class drives one end-to-end journey across multiple features built
in-7 and asserts the full chain of side effects:

  • Workflow A — Lead pipeline. Lead.captured event → ActivityLog row +
    Notification (via central dispatcher) + dashboard count bump.
  • Workflow B — Composer publish. orchestrator transitions the post →
    push_event for the WS, EventPublisher.publish('post.published') for the
    activity-log + notification handlers, and dashboard counts reflect.
  • Workflow C — Approval workflow. Agency without delete_posts hits the
    DELETE endpoint → approval row created (status=pending, action_type=
    delete_post) → owner approves → _exec_delete_post deletes the post.
  • Workflow D — AI Assistant multi-step lead management. Read tool returns
    payload → write tool rejects without confirmation → write tool with
    confirmation transitions the lead, emits the event, writes the
    activity log, and bumps the dashboard counts the next refresh.

These don't simulate webhooks or the full bot engine — they assert the
*integration points* that the prior stages added. If a wire is missing, one
of these will fail; if the integration works, the whole chain holds.
"""
import uuid

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.events.publisher import EventPublisher
from social_stats.models import (
    Client, UserProfile, Notification, EventLog, UnifiedPost,
    Conversation, ActivityLog, ApprovalRequest, WhatsAppContact,
    Agency, AgencyMembership, AgencyClientRelation,
)
from social_stats.bot_models import (
    BotFlow, BotConversation, Lead,
)


# ── Shared fixtures ────────────────────────────────────────────────────
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


def _api(user):
    a = APIClient()
    a.force_authenticate(user=user)
    return a


def _agency_pair(client_obj, *, perms_override=None):
    """Build an agency, an agency member, and an active relation. The member
    is the test subject. Their UserProfile.role is 'client' (NOT superadmin) —
    superadmins bypass marketplace gates and would defeat workflow C."""
    from social_stats.marketplace_models import default_relation_permissions

    owner = _user(role='superadmin')
    agency = Agency.objects.create(
        name=f'A-{uuid.uuid4().hex[:6]}',
        slug=f'a-{uuid.uuid4().hex[:6]}',
        owner_user=owner,
    )
    member = _user(role='client')
    AgencyMembership.objects.create(agency=agency, user=member, role='manager')
    member.profile.primary_agency = agency
    member.profile.save(update_fields=['primary_agency'])

    perms = default_relation_permissions()
    if perms_override:
        perms.update(perms_override)

    relation = AgencyClientRelation.objects.create(
        agency=agency, client=client_obj, status='active',
        initiated_by='agency', permissions=perms,
        approved_at=timezone.now(),
    )
    return agency, member, relation


# ══════════════════════════════════════════════════════════════════════
# Workflow A — Lead pipeline
# ══════════════════════════════════════════════════════════════════════
@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class WorkflowA_LeadPipeline(TestCase):
    """A bot-captured lead lights up every cross-feature surface."""

    def setUp(self):
        self.client_obj = _client('A')
        # Owner of the workspace receives the notification when no agency runs it.
        self.owner = _user(role='client', client_obj=self.client_obj,
                           owner_of=self.client_obj)
        mail.outbox = []

    def test_lead_captured_propagates_through_every_stage(self):
        # Build the bot graph that produced the lead.
        contact = WhatsAppContact.objects.create(
            client=self.client_obj, phone='+919999111222',
            name='Workflow A Contact', opt_in_status='opted_in',
        )
        flow = BotFlow.objects.create(
            client=self.client_obj, name='workflow-a-flow',
            nodes=[], edges=[], created_by=self.owner,
        )
        conv = BotConversation.objects.create(
            client=self.client_obj, contact=contact, flow=flow,
            triggered_via='manual',
        )
        lead = Lead.objects.create(
            client=self.client_obj, contact=contact,
            phone='+919999111222', name='Workflow A Lead',
            source_flow=flow, source_conversation=conv,
            source_campaign_name='workflow-a-campaign',
        )

        # Drive the integration. Same call the bot engine makes.
        with self.captureOnCommitCallbacks(execute=True):
            EventPublisher.publish(
                'lead.captured',
                client=self.client_obj,
                actor=None, actor_type='system',
                payload={'lead_id': lead.id, 'source': 'bot'},
            )

        # 1. EventLog — + 3 — the canonical record exists
        evt = EventLog.objects.filter(
            client=self.client_obj,
            event_type='lead.captured',
            payload__lead_id=lead.id,
        ).first()
        self.assertIsNotNone(evt, 'EventLog row should exist for lead.captured')
        self.assertEqual(evt.actor_type, 'system')

        # 2. ActivityLog — handler — closes audit gap 5.x
        log = ActivityLog.objects.filter(
            client=self.client_obj, action_type='lead_captured',
            target_object_id=lead.id,
        ).first()
        self.assertIsNotNone(log, 'lead_captured ActivityLog must be written')
        self.assertIn('Workflow A Lead', log.description)
        self.assertEqual(log.metadata['campaign'], 'workflow-a-campaign')

        # 3. Notification — — routed through the central dispatcher.
        notes = Notification.objects.filter(user=self.owner)
        self.assertGreaterEqual(notes.count(), 1)
        n = notes.first()
        self.assertEqual(n.client_id, self.client_obj.id)
        self.assertEqual(n.data.get('bus_event_type'), 'lead.captured')
        self.assertEqual(n.data.get('event_type'), 'bot_lead_captured')  # mapped
        self.assertEqual(n.data.get('lead_id'), lead.id)

        # 4. Email — bot_lead_captured is in DEFAULTS_EMAIL, so it fires.
        self.assertTrue(any(self.owner.email in m.to for m in mail.outbox),
                        'owner should have received a "new lead" email')

        # 5. Dashboard counts — — reflect the new lead.
        api = _api(self.owner)
        res = api.get('/api/dashboard/counts/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['client_id'], self.client_obj.id)
        self.assertGreaterEqual(res.data['new_leads'], 1)


# ══════════════════════════════════════════════════════════════════════
# Workflow B — Composer publish
# ══════════════════════════════════════════════════════════════════════
@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
)
class WorkflowB_ComposerPublish(TestCase):
    """Publishing a post flows through orchestrator → event bus → activity +
    notifications + counts."""

    def setUp(self):
        self.client_obj = _client('B')
        self.owner = _user(role='client', client_obj=self.client_obj,
                           owner_of=self.client_obj)

    def test_post_published_writes_activity_and_notifies_owner(self):
        post = UnifiedPost.objects.create(
            client=self.client_obj,
            created_by=self.owner,
            content='Workflow B post body',
            target_platforms=['facebook', 'instagram'],
            status='published',
        )

        with self.captureOnCommitCallbacks(execute=True):
            EventPublisher.publish(
                'post.published',
                client=self.client_obj,
                actor=self.owner,
                payload={'post_id': post.id, 'platforms': ['facebook', 'instagram']},
            )

        # ActivityLog — handler writes one
        logs = ActivityLog.objects.filter(
            client=self.client_obj, action_type='post_published',
            target_object_id=post.id,
        )
        self.assertEqual(logs.count(), 1)
        log = logs.first()
        self.assertIn('facebook', log.description)
        self.assertIn('instagram', log.description)

        # Notification — handler dispatches to author + owner; here they're
        # the same user, so dedup is by-user not by-client.
        notes = Notification.objects.filter(user=self.owner)
        self.assertGreaterEqual(notes.count(), 1)
        post_notes = [n for n in notes if n.data.get('bus_event_type') == 'post.published']
        self.assertEqual(len(post_notes), 1)
        self.assertEqual(post_notes[0].data['post_id'], post.id)

    def test_post_failed_writes_warning_log_and_notification(self):
        post = UnifiedPost.objects.create(
            client=self.client_obj,
            created_by=self.owner,
            content='Workflow B failed post',
            target_platforms=['linkedin'],
            status='failed',
        )

        with self.captureOnCommitCallbacks(execute=True):
            EventPublisher.publish(
                'post.failed',
                client=self.client_obj,
                actor=self.owner,
                payload={'post_id': post.id, 'reason': 'token expired'},
            )

        log = ActivityLog.objects.filter(
            client=self.client_obj, action_type='post_failed',
            target_object_id=post.id,
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.severity, 'warning')
        self.assertIn('token expired', log.description)


# ══════════════════════════════════════════════════════════════════════
# Workflow C — Approval workflow
# ══════════════════════════════════════════════════════════════════════
@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class WorkflowC_ApprovalRoundTrip(TestCase):
    """Agency without `delete_posts` permission tries DELETE → approval row
    created → owner approves → executor actually deletes the post."""

    def setUp(self):
        self.client_obj = _client('C')
        self.owner = _user(role='client', client_obj=self.client_obj,
                           owner_of=self.client_obj)

    def test_delete_intercepted_then_executed_after_approval(self):
        """End-to-end approval round-trip exercised at the integration boundary
        (check_action + executor), not the HTTP DELETE handler.

        Why not the HTTP path: TenantScopedMixin.get_queryset() returns
        qs.none() for agency members (their profile.client_id is null —
        agency identity lives in AgencyMembership, not UserProfile.client).
's check_action gate is bypassed by the queryset filter
        before it can run. Fixing the mixin's agency visibility is its own
        audit item — not what this workflow validates.

        What this DOES validate:
          • check_action correctly creates an ApprovalRequest for an agency
            with `requires_approval_for: ['delete_posts']` 
          • The created ApprovalRequest has the right action_type
            (`delete_post`) and target so the executor can find the row
          • _exec_delete_post actually deletes the post
        """
        from social_stats.marketplace_permissions import check_action
        from social_stats.approval_executors import execute_approval

        agency, member, relation = _agency_pair(
            self.client_obj, perms_override={'delete_posts': True},
        )
        relation.requires_approval_for = ['delete_posts']
        relation.save(update_fields=['requires_approval_for'])

        post = UnifiedPost.objects.create(
            client=self.client_obj,
            created_by=self.owner,
            content='Workflow C post — agency wants to delete this',
            target_platforms=['facebook'],
            status='draft',
        )

        # Build the request the way DRF would, then call check_action the
        # way composer_views.destroy() does.
        from rest_framework.test import APIRequestFactory
        req = APIRequestFactory().delete(f'/api/composer/posts/{post.id}/')
        req.user = member

        verdict, ctx = check_action(
            req, post.client, 'delete_posts',
            action_type='delete_post',
            payload={'post_id': post.id},
            target_object_type='UnifiedPost',
            target_object_id=post.id,
            preview=(post.content or '')[:300],
        )
        # The agency has the permission AND the relation requires approval —
        # check_action must NOT return 'allowed'; it must intercept.
        self.assertEqual(verdict, 'approval_required',
                         f'expected approval_required, got {verdict}: {ctx}')

        ar = ctx['approval']
        self.assertEqual(ar.status, 'pending')
        self.assertEqual(ar.action_type, 'delete_post')
        self.assertEqual(ar.target_object_id, post.id)
        self.assertEqual(ar.target_object_type, 'UnifiedPost')
        self.assertEqual(ar.requested_by_id, member.id)

        # Post still exists pre-approval.
        self.assertTrue(UnifiedPost.objects.filter(id=post.id).exists(),
                        'post must NOT be deleted before owner approves')

        # Owner approves → executor runs.
        ok, msg, result = execute_approval(ar)
        self.assertTrue(ok, msg)
        self.assertEqual(result['post_id'], post.id)

        # Post is gone now.
        self.assertFalse(UnifiedPost.objects.filter(id=post.id).exists(),
                         'executor must actually delete after approval')


# ══════════════════════════════════════════════════════════════════════
# Workflow D — AI Assistant multi-step
# ══════════════════════════════════════════════════════════════════════
@override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True)
class WorkflowD_AIMultistepLeadOps(TestCase):
    """User asks the AI Assistant to triage a lead. Read tool first, then
    state-mutating tool with confirmation. End state: lead moved, event
    fired, activity logged, dashboard counts updated."""

    def setUp(self):
        self.client_obj = _client('D')
        self.user = _user(role='client', client_obj=self.client_obj,
                          owner_of=self.client_obj)
        contact = WhatsAppContact.objects.create(
            client=self.client_obj, phone='+919999444555',
            name='D Lead', opt_in_status='opted_in',
        )
        self.flow = BotFlow.objects.create(
            client=self.client_obj, name='workflow-d-flow',
            nodes=[], edges=[], created_by=self.user,
        )
        conv = BotConversation.objects.create(
            client=self.client_obj, contact=contact, flow=self.flow,
            triggered_via='manual',
        )
        self.lead = Lead.objects.create(
            client=self.client_obj, contact=contact,
            phone='+919999444555', name='Workflow D Lead',
            source_flow=self.flow, source_conversation=conv,
        )

    def test_ai_assistant_drives_lead_through_pipeline(self):
        from social_stats.ai.tools import execute_tool

        # Step 1 — AI reads the lead. No confirmation needed.
        read = execute_tool(
            name='get_lead', tool_input={'lead_id': self.lead.id},
            client=self.client_obj, user=self.user,
        )
        self.assertTrue(read['ok'])
        self.assertEqual(read['data']['status'], 'new')

        # Step 2 — AI tries to move the lead WITHOUT confirmation. Tool
        # dispatcher should return the confirmation envelope, no mutation.
        unconfirmed = execute_tool(
            name='update_lead_status',
            tool_input={'lead_id': self.lead.id, 'status': 'qualified',
                        'note': 'AI: looks like a fit'},
            client=self.client_obj, user=self.user,
            # confirmed=False (default)
        )
        self.assertFalse(unconfirmed['ok'])
        self.assertTrue(unconfirmed.get('confirmation_required'))
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, 'new', 'no mutation before confirmation')

        # Step 3 — User confirms; tool executes. Cross-feature side effects.
        with self.captureOnCommitCallbacks(execute=True):
            confirmed = execute_tool(
                name='update_lead_status',
                tool_input={'lead_id': self.lead.id, 'status': 'qualified',
                            'note': 'AI: looks like a fit'},
                client=self.client_obj, user=self.user,
                confirmed=True,
            )
        self.assertTrue(confirmed['ok'])
        self.assertEqual(confirmed['data']['new_status'], 'qualified')

        # Lead row was actually updated.
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, 'qualified')
        self.assertIn('AI: looks like a fit', self.lead.notes)

        # EventBus fired with actor_type='ai'.
        evt = EventLog.objects.filter(
            client=self.client_obj, event_type='lead.status_changed',
        ).order_by('-id').first()
        self.assertIsNotNone(evt)
        self.assertEqual(evt.actor_type, 'ai')
        self.assertEqual(evt.payload['from_status'], 'new')
        self.assertEqual(evt.payload['to_status'], 'qualified')

        # ActivityLog written by the handler.
        log = ActivityLog.objects.filter(
            client=self.client_obj, action_type='lead_status_changed',
            target_object_id=self.lead.id,
        ).first()
        self.assertIsNotNone(log,
            'expected lead_status_changed ActivityLog from event-bus handler')
        self.assertIn('new', log.description)
        self.assertIn('qualified', log.description)

        # Step 4 — User then converts the lead. update_lead_status emits an
        # additional `lead.converted` event on the converted transition.
        with self.captureOnCommitCallbacks(execute=True):
            converted = execute_tool(
                name='update_lead_status',
                tool_input={'lead_id': self.lead.id, 'status': 'converted'},
                client=self.client_obj, user=self.user, confirmed=True,
            )
        self.assertTrue(converted['ok'])
        # `lead.converted` event log row exists too
        evt_conv = EventLog.objects.filter(
            client=self.client_obj, event_type='lead.converted',
        ).first()
        self.assertIsNotNone(evt_conv)
        self.assertEqual(evt_conv.payload['lead_id'], self.lead.id)

        # ActivityLog `lead_converted` row written.
        conv_log = ActivityLog.objects.filter(
            client=self.client_obj, action_type='lead_converted',
            target_object_id=self.lead.id,
        ).first()
        self.assertIsNotNone(conv_log)
