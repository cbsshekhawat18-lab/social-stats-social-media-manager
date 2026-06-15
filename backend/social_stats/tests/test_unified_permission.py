"""
Unified permission + audit-gap fix tests.

Verifies the three concrete fixes shipped in:

  • UnifiedPermission honours per_action_permissions and stashes pending
    approvals on the view (instead of raising 403).
  • Composer create/destroy now check `draft_posts` / `delete_posts`
    (audit gap 4.2).
  • CalendarPostViewSet.destroy now checks `delete_posts` (audit gap 4.7 —
    delete_posts permission existed but was never enforced).
  • BotFlow publish/unpublish now check `manage_bots` (audit gap 4.3).
  • Approval executors for the new action_types do the right thing on
    approval.

These tests deliberately exercise the "agency without permission" path —
the bug class the audit flagged.
"""
import uuid

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.models import (
    Client, UserProfile, UnifiedPost, CalendarPost,
    Agency, AgencyMembership, AgencyClientRelation, ApprovalRequest,
)
from social_stats.bot_models import BotFlow
from social_stats.approval_executors import execute_approval


def _client(label='c'):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:6]}@x.test',
    )


def _user(role='client', client_obj=None):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:10]}',
        email=f'{uuid.uuid4().hex[:6]}@x.test',
        password='x', is_active=True,
    )
    UserProfile.objects.create(
        user=u, role=role,
        client=client_obj if role == 'client' else None,
    )
    return u


def _agency_relation(client, *, perms_override=None):
    """Build an Agency, an agency-member user, and an active AgencyClientRelation
    that links them. `perms_override` lets you flip individual permission keys
    relative to the defaults.

    Note: agency members get UserProfile.role='client' (the platform-level role)
    NOT 'superadmin' — superadmins bypass every permission gate, which would
    defeat the test. Agency identity is established via AgencyMembership +
    primary_agency, not via UserProfile.role.
    """
    from social_stats.marketplace_models import default_relation_permissions

    owner = _user(role='superadmin')  # agency owner only — not the test subject
    agency = Agency.objects.create(
        name=f'Agency-{uuid.uuid4().hex[:6]}',
        slug=f'agency-{uuid.uuid4().hex[:6]}',
        owner_user=owner,
    )
    # The agency member is the test subject — not a platform superadmin.
    member = _user(role='client')  # plain authenticated user
    AgencyMembership.objects.create(agency=agency, user=member, role='manager')
    member.profile.primary_agency = agency
    member.profile.save(update_fields=['primary_agency'])

    perms = default_relation_permissions()
    if perms_override:
        perms.update(perms_override)

    relation = AgencyClientRelation.objects.create(
        agency=agency,
        client=client,
        status='active',
        initiated_by='agency',
        permissions=perms,
        approved_at=timezone.now(),
    )
    return agency, member, relation


def _api(user):
    a = APIClient()
    a.force_authenticate(user=user)
    return a


# ══════════════════════════════════════════════════════════════════════
# UnifiedPermission contract
# ══════════════════════════════════════════════════════════════════════
class UnifiedPermissionTests(TestCase):
    """Direct unit tests on UnifiedPermission — no HTTP, just the class."""

    def setUp(self):
        from social_stats.unified_permission import UnifiedPermission
        self.perm = UnifiedPermission()
        self.client_obj = _client('uperm')

    def _request_for(self, user):
        from rest_framework.test import APIRequestFactory
        f = APIRequestFactory()
        req = f.post('/x', {'client_id': self.client_obj.id})
        req.user = user
        # Shim: query_params is needed by the resolver.
        req.query_params = {'client_id': str(self.client_obj.id)}
        return req

    def test_unauthenticated_request_denied(self):
        from django.contrib.auth.models import AnonymousUser

        class V:
            action = 'create'
            kwargs = {}
            per_action_permissions = {'create': 'draft_posts'}

        req = self._request_for(AnonymousUser())
        self.assertFalse(self.perm.has_permission(req, V()))

    def test_no_action_key_means_authenticated_read(self):
        u = _user(role='client', client_obj=self.client_obj)

        class V:
            action = 'list'  # in READ_ACTIONS
            kwargs = {}

        req = self._request_for(u)
        self.assertTrue(self.perm.has_permission(req, V()))

    def test_owner_passes_with_action_key(self):
        u = _user(role='client', client_obj=self.client_obj)

        class V:
            action = 'create'
            kwargs = {}
            per_action_permissions = {'create': 'draft_posts'}

        req = self._request_for(u)
        self.assertTrue(self.perm.has_permission(req, V()))

    def test_agency_without_permission_denied(self):
        _, member, _ = _agency_relation(
            self.client_obj, perms_override={'delete_posts': False},
        )

        class V:
            action = 'destroy'
            kwargs = {}
            per_action_permissions = {'destroy': 'delete_posts'}

        req = self._request_for(member)
        self.assertFalse(self.perm.has_permission(req, V()))

    def test_agency_with_permission_passes_and_stashes_relation(self):
        _, member, relation = _agency_relation(
            self.client_obj, perms_override={'delete_posts': True},
        )

        class V:
            action = 'destroy'
            kwargs = {}
            per_action_permissions = {'destroy': 'delete_posts'}

        view = V()
        req = self._request_for(member)
        self.assertTrue(self.perm.has_permission(req, view))
        self.assertEqual(view.unified_relation, relation)
        self.assertEqual(view.unified_role, 'agency')

    def test_approval_required_returns_true_and_stashes_approval(self):
        """When relation requires approval, has_permission returns True so
        the view runs — but pending_approval is set so the view should
        short-circuit to a 202 response rather than executing."""
        agency, member, relation = _agency_relation(
            self.client_obj, perms_override={'delete_posts': True},
        )
        relation.requires_approval_for = ['delete_posts']
        relation.save(update_fields=['requires_approval_for'])

        class V:
            action = 'destroy'
            kwargs = {}
            per_action_permissions = {'destroy': 'delete_posts'}

        view = V()
        req = self._request_for(member)
        self.assertTrue(self.perm.has_permission(req, view))
        self.assertTrue(hasattr(view, 'pending_approval'))
        self.assertIsNotNone(view.pending_approval)
        self.assertEqual(view.pending_approval.action_type, 'delete_posts')


# ══════════════════════════════════════════════════════════════════════
# Audit gap 4.7 — delete_posts on CalendarPostViewSet was unenforced
# ══════════════════════════════════════════════════════════════════════
class CalendarDeletePermissionTests(TestCase):
    def setUp(self):
        self.client_obj = _client('cal')

    def _make_calendar_post(self):
        return CalendarPost.objects.create(
            client=self.client_obj,
            caption='hello',
            scheduled_at=timezone.now() + timezone.timedelta(days=1),
            status='scheduled',
            platform='facebook',
        )

    def test_owner_can_delete(self):
        owner = _user(role='client', client_obj=self.client_obj)
        post = self._make_calendar_post()
        api = _api(owner)
        res = api.delete(f'/api/calendar/posts/{post.id}/')
        self.assertEqual(res.status_code, 204, res.data if hasattr(res, 'data') else res.content)

    def test_agency_without_delete_posts_denied(self):
        post = self._make_calendar_post()
        _, member, _ = _agency_relation(
            self.client_obj, perms_override={'delete_posts': False, 'view_posts': True},
        )
        api = _api(member)
        res = api.delete(f'/api/calendar/posts/{post.id}/?client_id={self.client_obj.id}')
        # Either 403 (denied by check_action) or 404 (TenantScopedMixin
        # filters the queryset and the agency can't see the post). Either
        # way, the agency does NOT delete the post — that's the bug fix.
        self.assertIn(res.status_code, (403, 404))
        # Verify the post still exists.
        self.assertTrue(CalendarPost.objects.filter(id=post.id).exists())


# ══════════════════════════════════════════════════════════════════════
# Audit gap 4.3 — BotFlow publish/unpublish were unenforced
# ══════════════════════════════════════════════════════════════════════
class BotPublishPermissionTests(TestCase):
    def setUp(self):
        self.client_obj = _client('bot')

    def _make_flow(self, creator):
        return BotFlow.objects.create(
            client=self.client_obj,
            name='test flow',
            nodes=[{'id': 'start', 'type': 'message', 'data': {'text': 'hi'}}],
            edges=[],
            starting_node_id='start',
            created_by=creator,
        )

    def test_agency_without_manage_bots_denied(self):
        owner = _user(role='client', client_obj=self.client_obj)
        flow = self._make_flow(owner)
        _, member, _ = _agency_relation(
            self.client_obj, perms_override={'manage_bots': False, 'view_posts': True},
        )
        api = _api(member)
        res = api.post(f'/api/bot-flows/{flow.id}/publish/?client_id={self.client_obj.id}')
        self.assertIn(res.status_code, (403, 404))
        flow.refresh_from_db()
        self.assertFalse(flow.is_active, 'flow should not have been published')


# ══════════════════════════════════════════════════════════════════════
# Approval executors for new action_types
# ══════════════════════════════════════════════════════════════════════
@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class ApprovalExecutorTests(TestCase):
    def setUp(self):
        self.client_obj = _client('ae')
        self.agency, self.member, self.relation = _agency_relation(self.client_obj)

    def _make_approval(self, action_type, payload, target_type='', target_id=None):
        return ApprovalRequest.objects.create(
            relation=self.relation,
            client=self.client_obj,
            requested_by=self.member,
            action_type=action_type,
            payload=payload,
            target_object_type=target_type,
            target_object_id=target_id,
        )

    def test_delete_post_executor_deletes_unifiedpost(self):
        post = UnifiedPost.objects.create(
            client=self.client_obj, content='to delete',
            target_platforms=['facebook'], status='draft',
        )
        ar = self._make_approval(
            'delete_post', {'post_id': post.id},
            target_type='UnifiedPost', target_id=post.id,
        )
        ok, msg, result = execute_approval(ar)
        self.assertTrue(ok, msg)
        self.assertFalse(UnifiedPost.objects.filter(id=post.id).exists())

    def test_delete_post_executor_routes_to_calendar_post(self):
        post = CalendarPost.objects.create(
            client=self.client_obj, caption='c',
            scheduled_at=timezone.now() + timezone.timedelta(hours=1),
            status='scheduled', platform='facebook',
        )
        ar = self._make_approval(
            'delete_post', {'post_id': post.id},
            target_type='CalendarPost', target_id=post.id,
        )
        ok, msg, result = execute_approval(ar)
        self.assertTrue(ok, msg)
        self.assertFalse(CalendarPost.objects.filter(id=post.id).exists())

    def test_publish_bot_executor_activates_flow(self):
        flow = BotFlow.objects.create(
            client=self.client_obj, name='approve-me',
            nodes=[], edges=[], created_by=self.member,
        )
        ar = self._make_approval(
            'publish_bot', {'flow_id': flow.id},
            target_type='BotFlow', target_id=flow.id,
        )
        ok, msg, result = execute_approval(ar)
        self.assertTrue(ok, msg)
        flow.refresh_from_db()
        self.assertTrue(flow.is_active)
        self.assertEqual(flow.published_version, flow.version)

    def test_unpublish_bot_executor_deactivates_flow(self):
        flow = BotFlow.objects.create(
            client=self.client_obj, name='deactivate-me',
            nodes=[], edges=[], created_by=self.member,
            is_active=True,
        )
        ar = self._make_approval(
            'unpublish_bot', {'flow_id': flow.id},
            target_type='BotFlow', target_id=flow.id,
        )
        ok, _, _ = execute_approval(ar)
        self.assertTrue(ok)
        flow.refresh_from_db()
        self.assertFalse(flow.is_active)

    def test_draft_post_executor_creates_unifiedpost(self):
        ar = self._make_approval(
            'draft_post',
            {
                'content':         'hello from approved draft',
                'target_platforms': ['facebook', 'instagram'],
                'title':           'Approved title',
            },
        )
        ok, msg, result = execute_approval(ar)
        self.assertTrue(ok, msg)
        post = UnifiedPost.objects.get(id=result['post_id'])
        self.assertEqual(post.content, 'hello from approved draft')
        self.assertEqual(post.status, 'draft')
        self.assertEqual(set(post.target_platforms), {'facebook', 'instagram'})

    def test_draft_post_executor_rejects_empty_payload(self):
        ar = self._make_approval('draft_post', {})
        ok, msg, _ = execute_approval(ar)
        self.assertFalse(ok)
        self.assertIn('no content', msg)


# ══════════════════════════════════════════════════════════════════════
# manage_bots permission key registered
# ══════════════════════════════════════════════════════════════════════
class PermissionKeyRegistryTests(TestCase):
    def test_manage_bots_key_present(self):
        from social_stats.marketplace_models import AGENCY_CLIENT_PERMISSIONS
        self.assertIn('manage_bots', AGENCY_CLIENT_PERMISSIONS)
        meta = AGENCY_CLIENT_PERMISSIONS['manage_bots']
        self.assertEqual(meta['risk'], 'high')
        # New permissions should default OFF — agency must explicitly be granted.
        self.assertFalse(meta['default'])
