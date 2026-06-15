"""
TenantScopedMixin agency-visibility tests.

The mixin grants agency members access to clients they have an active
`AgencyClientRelation` to. Verifies:

  • Agency member sees the client(s) their agency manages on a list endpoint.
  • Cross-agency: agency A's member must NOT see agency B's clients.
  • Terminated / paused / pending relations don't grant visibility.
  • Removed AgencyMembership (is_active=False) revokes visibility even if
    `profile.primary_agency_id` is still set (stale field).
  • A user with NO agency membership and NO profile.client_id gets nothing
    (the original empty-queryset case still holds for non-agency users).

We exercise the mixin via a real viewset (UnifiedPostViewSet) so the test
catches any regression in how the queryset filter is wired into ModelViewSet.
"""
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.models import (
    Client, UserProfile, UnifiedPost,
    Agency, AgencyMembership, AgencyClientRelation,
)


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


def _agency(name=None):
    suffix = uuid.uuid4().hex[:6]
    owner = _user(role='superadmin')
    return Agency.objects.create(
        name=name or f'Agency-{suffix}',
        slug=f'agency-{suffix}',
        owner_user=owner,
    )


def _make_agency_member(agency):
    """Return an agency-member user with primary_agency set + active membership."""
    u = _user(role='client')          # platform role 'client', NOT 'superadmin'
    AgencyMembership.objects.create(agency=agency, user=u, role='manager')
    u.profile.primary_agency = agency
    u.profile.save(update_fields=['primary_agency'])
    return u


def _make_relation(agency, client, *, status='active'):
    return AgencyClientRelation.objects.create(
        agency=agency, client=client, status=status,
        initiated_by='agency',
        approved_at=timezone.now() if status == 'active' else None,
    )


def _api(user):
    a = APIClient()
    a.force_authenticate(user=user)
    return a


def _make_post(client, *, content='post body'):
    return UnifiedPost.objects.create(
        client=client, content=content,
        target_platforms=['facebook'], status='draft',
    )


class AgencyTenantVisibilityTests(TestCase):
    """All these tests exercise the mixin through a real list endpoint
    (`/api/composer/posts/`). UnifiedPostViewSet inherits TenantScopedMixin,
    so its queryset reflects the mixin's behaviour 1:1."""

    def setUp(self):
        # Two agencies, two managed clients each — let's prove cross-agency
        # isolation works even with a busy fixture.
        self.agency_a = _agency()
        self.agency_b = _agency()

        self.client_a1 = _client('a1')
        self.client_a2 = _client('a2')
        self.client_b1 = _client('b1')
        self.client_b2 = _client('b2')

        _make_relation(self.agency_a, self.client_a1)
        _make_relation(self.agency_a, self.client_a2)
        _make_relation(self.agency_b, self.client_b1)
        _make_relation(self.agency_b, self.client_b2)

        # One distinct post per client so we can prove who sees what.
        self.post_a1 = _make_post(self.client_a1, content='post for a1')
        self.post_a2 = _make_post(self.client_a2, content='post for a2')
        self.post_b1 = _make_post(self.client_b1, content='post for b1')
        self.post_b2 = _make_post(self.client_b2, content='post for b2')

    def _list_posts(self, member):
        api = _api(member)
        res = api.get('/api/composer/posts/')
        self.assertEqual(res.status_code, 200, res.data)
        # DRF default pagination: results may be wrapped or a bare list.
        items = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        # When pagination is off, response is a list; when on, it's a dict.
        # Map both shapes to the list of post ids returned.
        if isinstance(items, list):
            return [p['id'] for p in items if isinstance(p, dict) and 'id' in p]
        return []

    def test_agency_a_member_sees_both_a_clients(self):
        member = _make_agency_member(self.agency_a)
        ids = self._list_posts(member)
        self.assertIn(self.post_a1.id, ids)
        self.assertIn(self.post_a2.id, ids)

    def test_agency_a_member_does_not_see_agency_b_clients(self):
        """The cross-agency isolation case — hardens this."""
        member = _make_agency_member(self.agency_a)
        ids = self._list_posts(member)
        self.assertNotIn(self.post_b1.id, ids,
            "agency A member must NOT see agency B's posts")
        self.assertNotIn(self.post_b2.id, ids,
            "agency A member must NOT see agency B's posts")

    def test_terminated_relation_revokes_visibility(self):
        """A relation flipped to status='terminated' must immediately stop
        granting queryset visibility — no zombie access."""
        member = _make_agency_member(self.agency_a)
        # Terminate one of agency A's relations
        AgencyClientRelation.objects.filter(
            agency=self.agency_a, client=self.client_a1,
        ).update(status='terminated')

        ids = self._list_posts(member)
        self.assertNotIn(self.post_a1.id, ids,
            'terminated relation must NOT grant visibility')
        self.assertIn(self.post_a2.id, ids,
            'still-active relation must still be visible')

    def test_pending_relation_does_not_grant_visibility(self):
        """An invitation that hasn't been accepted yet (status='pending')
        is not active and must not let the agency see the workspace."""
        agency_c = _agency()
        client_c = _client('c1')
        _make_relation(agency_c, client_c, status='pending')
        post_c = _make_post(client_c, content='not yours yet')

        member_c = _make_agency_member(agency_c)
        ids = self._list_posts(member_c)
        self.assertNotIn(post_c.id, ids)

    def test_revoked_membership_blocks_visibility_even_with_stale_primary_agency(self):
        """If AgencyMembership.is_active was flipped to False (e.g. user
        removed from the agency), they should NOT see the agency's clients
        even if their UserProfile.primary_agency_id is still pointing at it."""
        member = _make_agency_member(self.agency_a)
        # Stale primary_agency persists on the profile (not auto-cleared);
        # but the membership is deactivated.
        AgencyMembership.objects.filter(
            user=member, agency=self.agency_a,
        ).update(is_active=False)

        ids = self._list_posts(member)
        self.assertNotIn(self.post_a1.id, ids,
            'inactive membership must revoke visibility even with stale primary_agency')
        self.assertNotIn(self.post_a2.id, ids)

    def test_user_with_no_agency_and_no_workspace_sees_nothing(self):
        """The pre-existing behaviour for fresh users with neither role
        must still hold — no agency, no profile.client_id → empty queryset."""
        u = _user(role='client', client_obj=None)
        ids = self._list_posts(u)
        self.assertEqual(ids, [])

    def test_end_user_still_only_sees_own_workspace(self):
        """The single-workspace branch still works — added an
        agency branch BEFORE the end-user branch but didn't change the
        end-user behaviour for users with no agency membership."""
        owner = _user(role='client', client_obj=self.client_a1)
        ids = self._list_posts(owner)
        self.assertEqual(ids, [self.post_a1.id])

    def test_superadmin_still_sees_everything(self):
        admin = _user(role='superadmin')
        ids = self._list_posts(admin)
        # Superadmin sees ALL posts across ALL clients.
        for pid in (self.post_a1.id, self.post_a2.id,
                    self.post_b1.id, self.post_b2.id):
            self.assertIn(pid, ids)


# ══════════════════════════════════════════════════════════════════════
class WorkflowC_HTTPPathReinstated(TestCase):
    """Workflow C had to bypass the HTTP DELETE path because
    TenantScopedMixin filtered the agency member's queryset to empty.
 fixes that — the same scenario should now actually intercept
    via the standard request flow."""

    def test_agency_delete_intercepted_via_http_with_202(self):
        from social_stats.marketplace_models import default_relation_permissions

        client = _client('wf-c')
        owner = _user(role='client', client_obj=client)
        agency = _agency()
        member = _make_agency_member(agency)

        relation = AgencyClientRelation.objects.create(
            agency=agency, client=client, status='active',
            initiated_by='agency',
            permissions={**default_relation_permissions(), 'delete_posts': True},
            requires_approval_for=['delete_posts'],
            approved_at=timezone.now(),
        )

        post = _make_post(client, content='workflow-C HTTP-path verification')

        # Pre-Phase-12: this returned 404 (queryset empty).
        # Post-Phase-12: queryset includes the post + check_action returns
        # approval_required → 202.
        api = _api(member)
        res = api.delete(
            f'/api/composer/posts/{post.id}/?client_id={client.id}',
        )
        self.assertEqual(res.status_code, 202, res.data)
        self.assertTrue(res.data.get('requires_approval'))
        self.assertIn('approval_id', res.data)

        # Post still exists — owner approval pending.
        self.assertTrue(UnifiedPost.objects.filter(id=post.id).exists())
