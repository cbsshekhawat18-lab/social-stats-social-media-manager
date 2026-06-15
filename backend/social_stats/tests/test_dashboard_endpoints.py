"""
/api/dashboard/counts/ + /api/search/unified/ tests.

Verifies:
  • dashboard counts include unread inbox / new leads / pending approvals /
    unread notifications / scheduled posts and are tenant-scoped.
  • An end user without an active client gets all-zeros (the UI keeps rendering).
  • Cross-tenant client_id is rejected — counts come back as zero.
  • Unified search hits posts + leads + conversations + contacts.
  • Sub-2-char queries short-circuit (no DB hit) returning empty arrays.
  • Search is tenant-scoped — results from other clients never leak.
"""
import uuid
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.models import (
    Client, UserProfile, Conversation, Notification, UnifiedPost,
    WhatsAppContact, ApprovalRequest,
    Agency, AgencyMembership, AgencyClientRelation,
)
from social_stats.bot_models import Lead, BotFlow, BotConversation


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


def _agency_member(client):
    """Build an Agency + member with active relation to `client`."""
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
    AgencyClientRelation.objects.create(
        agency=agency, client=client, status='active',
        initiated_by='agency', approved_at=timezone.now(),
    )
    return agency, member


def _api(user):
    a = APIClient()
    a.force_authenticate(user=user)
    return a


# ══════════════════════════════════════════════════════════════════════
# /api/dashboard/counts/
# ══════════════════════════════════════════════════════════════════════
class DashboardCountsTests(TestCase):
    def setUp(self):
        self.client_obj = _client('dc')
        self.owner = _user(role='client', client_obj=self.client_obj)

    def _whatsapp_contact(self):
        return WhatsAppContact.objects.create(
            client=self.client_obj, phone='+919999000777',
            name='dc-contact', opt_in_status='opted_in',
        )

    def test_returns_all_zeros_for_empty_workspace(self):
        api = _api(self.owner)
        res = api.get('/api/dashboard/counts/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['client_id'], self.client_obj.id)
        for key in ('unread_inbox', 'priority_inbox', 'pending_approvals',
                    'new_leads', 'unread_notifications', 'scheduled_posts'):
            self.assertEqual(res.data[key], 0, f'{key} should be 0')

    def test_counts_unread_inbox_only_for_active_threads(self):
        # An archived conversation with unread > 0 must NOT count.
        Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='t1', unread_count=3, is_archived=False,
        )
        Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='t2', unread_count=5, is_archived=True,
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/counts/')
        self.assertEqual(res.data['unread_inbox'], 1)

    def test_counts_new_leads_in_last_24h_only(self):
        contact = self._whatsapp_contact()
        recent = Lead.objects.create(
            client=self.client_obj, contact=contact, phone='+919999000888',
            name='Recent', status='new',
        )
        old = Lead.objects.create(
            client=self.client_obj, contact=contact, phone='+919999000999',
            name='Old', status='new',
        )
        Lead.objects.filter(id=old.id).update(
            created_at=timezone.now() - timedelta(days=2),
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/counts/')
        self.assertEqual(res.data['new_leads'], 1, 'only the <24h lead counts')

    def test_counts_pending_approvals_only(self):
        agency, member = _agency_member(self.client_obj)
        relation = AgencyClientRelation.objects.get(agency=agency, client=self.client_obj)
        ApprovalRequest.objects.create(
            relation=relation, client=self.client_obj,
            requested_by=member, action_type='publish_post',
            payload={}, status='pending',
        )
        ApprovalRequest.objects.create(
            relation=relation, client=self.client_obj,
            requested_by=member, action_type='publish_post',
            payload={}, status='approved',
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/counts/')
        self.assertEqual(res.data['pending_approvals'], 1)

    def test_unread_notifications_scoped_to_calling_user(self):
        Notification.objects.create(
            user=self.owner, client=self.client_obj,
            notif_type='system', title='for me',
        )
        # A second user's notification must NOT count.
        other = _user(role='client', client_obj=self.client_obj)
        Notification.objects.create(
            user=other, client=self.client_obj,
            notif_type='system', title='not me',
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/counts/')
        self.assertEqual(res.data['unread_notifications'], 1)

    def test_admin_without_client_param_gets_zeros(self):
        admin = _user(role='superadmin')
        # No ?client_id= and superadmin profile has no .client_id; expect zeros.
        api = _api(admin)
        res = api.get('/api/dashboard/counts/')
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['client_id'])
        self.assertEqual(res.data['unread_inbox'], 0)

    def test_cross_tenant_client_id_returns_zeros(self):
        """A user pointing at someone else's client_id must NOT see that
        workspace's data — _resolve_client returns None and the endpoint
        returns the zeros payload."""
        other = _client('other')
        # Stuff a real notification in `other` so the cross-tenant attempt
        # would be visible if scoping broke.
        other_owner = _user(role='client', client_obj=other)
        Notification.objects.create(
            user=other_owner, client=other,
            notif_type='system', title='secret',
        )
        # Owner of self.client_obj asks about `other` — must not leak.
        api = _api(self.owner)
        res = api.get(f'/api/dashboard/counts/?client_id={other.id}')
        self.assertIsNone(res.data['client_id'])
        self.assertEqual(res.data['unread_notifications'], 0)


# ══════════════════════════════════════════════════════════════════════
# /api/search/unified/
# ══════════════════════════════════════════════════════════════════════
class UnifiedSearchTests(TestCase):
    def setUp(self):
        self.client_obj = _client('s')
        self.owner = _user(role='client', client_obj=self.client_obj)
        self.contact = WhatsAppContact.objects.create(
            client=self.client_obj, phone='+919999333222',
            name='Mumbai contact', opt_in_status='opted_in',
        )

    def test_short_query_returns_empty_arrays(self):
        api = _api(self.owner)
        res = api.get('/api/search/unified/?q=a')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['posts'], [])
        self.assertEqual(res.data['leads'], [])
        self.assertEqual(res.data['conversations'], [])
        self.assertEqual(res.data['contacts'], [])
        self.assertEqual(res.data['total'], 0)

    def test_search_hits_each_category(self):
        UnifiedPost.objects.create(
            client=self.client_obj, content='Mumbai property listing',
            target_platforms=['facebook'], status='draft',
        )
        Lead.objects.create(
            client=self.client_obj, contact=self.contact,
            phone='+919999333222', name='Mumbai buyer',
        )
        Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='t1', contact_name='Mumbai customer',
            last_message_preview='asking about mumbai property',
        )

        api = _api(self.owner)
        res = api.get('/api/search/unified/?q=mumbai')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data['posts']), 1)
        self.assertGreaterEqual(len(res.data['leads']), 1)
        self.assertGreaterEqual(len(res.data['conversations']), 1)
        self.assertGreaterEqual(len(res.data['contacts']), 1)
        # Every result must carry a deep_link
        for cat in ('posts', 'leads', 'conversations', 'contacts'):
            for item in res.data[cat]:
                self.assertTrue(item.get('deep_link', '').startswith('/'))

    def test_search_is_tenant_scoped(self):
        """Posts in another workspace must not appear in this user's search."""
        other = _client('s2')
        UnifiedPost.objects.create(
            client=other, content='Mumbai luxury villa',
            target_platforms=['facebook'], status='draft',
        )
        api = _api(self.owner)
        res = api.get('/api/search/unified/?q=Mumbai')
        # No results from `other` — owner only sees their own workspace.
        for p in res.data['posts']:
            self.assertNotIn('luxury villa', p['preview'])

    def test_limit_caps_per_category(self):
        for i in range(8):
            UnifiedPost.objects.create(
                client=self.client_obj, content=f'limit test post {i}',
                target_platforms=['facebook'], status='draft',
            )
        api = _api(self.owner)
        res = api.get('/api/search/unified/?q=limit&limit=3')
        self.assertLessEqual(len(res.data['posts']), 3)


# ══════════════════════════════════════════════════════════════════════
# /api/dashboard/today/ — cross-feature aggregator
# ══════════════════════════════════════════════════════════════════════
class DashboardTodayTests(TestCase):
    """One endpoint, many features. Verifies each section pulls from the
    right model + filters by tenant + handles empty data gracefully."""

    def setUp(self):
        self.client_obj = _client('today')
        self.owner = _user(role='client', client_obj=self.client_obj)

    # ── empty + scope ─────────────────────────────────────────────────
    def test_returns_empty_payload_for_admin_without_client(self):
        admin = _user(role='superadmin')
        api = _api(admin)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['client_id'])
        self.assertEqual(res.data['posts']['published_today'], 0)
        self.assertEqual(res.data['recent_activity'], [])
        self.assertEqual(res.data['pending_approvals'], [])
        self.assertEqual(res.data['engagement_chart'], [])

    def test_returns_full_shape_for_owner(self):
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['client_id'], self.client_obj.id)
        self.assertEqual(res.data['client_name'], self.client_obj.company)
        self.assertIn('as_of', res.data)
        # All the section keys must exist (the frontend renders skeletons
        # off this shape — dropping a key would break the dashboard layout).
        for key in ('posts', 'inbox', 'leads', 'campaigns',
                    'recent_activity', 'pending_approvals', 'engagement_chart'):
            self.assertIn(key, res.data)

    def test_cross_tenant_client_id_returns_empty_payload(self):
        """A user pointing at another client's id must NOT see that
        workspace's data — same scoping pattern as the counts endpoint."""
        other = _client('other')
        UnifiedPost.objects.create(
            client=other, content='secret',
            target_platforms=['facebook'], status='published',
            published_at=timezone.now(),
        )
        api = _api(self.owner)
        res = api.get(f'/api/dashboard/today/?client_id={other.id}')
        self.assertIsNone(res.data['client_id'])
        self.assertEqual(res.data['posts']['published_today'], 0)

    # ── posts ─────────────────────────────────────────────────────────
    def test_published_today_counts_only_today_publishes(self):
        UnifiedPost.objects.create(
            client=self.client_obj, content='today',
            target_platforms=['facebook'], status='published',
            published_at=timezone.now(),
        )
        # Yesterday's publish must NOT count.
        old = UnifiedPost.objects.create(
            client=self.client_obj, content='old',
            target_platforms=['facebook'], status='published',
            published_at=timezone.now() - timedelta(days=2),
        )
        UnifiedPost.objects.filter(id=old.id).update(
            published_at=timezone.now() - timedelta(days=2),
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.data['posts']['published_today'], 1)

    def test_scheduled_count_excludes_drafts_and_failed(self):
        UnifiedPost.objects.create(
            client=self.client_obj, content='draft', status='draft',
            target_platforms=['facebook'],
        )
        UnifiedPost.objects.create(
            client=self.client_obj, content='scheduled', status='scheduled',
            target_platforms=['facebook'],
        )
        UnifiedPost.objects.create(
            client=self.client_obj, content='failed', status='failed',
            target_platforms=['facebook'],
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.data['posts']['scheduled'], 1)

    # ── inbox ─────────────────────────────────────────────────────────
    def test_inbox_priority_counts_negative_unresolved(self):
        Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='t1', sentiment='negative', is_archived=False,
            is_resolved=False,
        )
        Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='t2', sentiment='negative', is_archived=False,
            is_resolved=True,                    # resolved → excluded
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.data['inbox']['priority'], 1)

    # ── leads ─────────────────────────────────────────────────────────
    def test_leads_pipeline_value_sums_open_pipeline(self):
        from social_stats.models import WhatsAppContact
        from social_stats.bot_models import Lead
        contact = WhatsAppContact.objects.create(
            client=self.client_obj, phone='+919999000000',
            name='c', opt_in_status='opted_in',
        )
        Lead.objects.create(
            client=self.client_obj, contact=contact,
            phone='+919999000000', status='qualified',
            conversion_value=10000,
        )
        Lead.objects.create(
            client=self.client_obj, contact=contact,
            phone='+919999000001', status='converted',  # converted excluded
            conversion_value=99999,
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.data['leads']['pipeline_value'], 10000.0)

    def test_converted_today_counts_only_today_conversions(self):
        from social_stats.models import WhatsAppContact
        from social_stats.bot_models import Lead
        contact = WhatsAppContact.objects.create(
            client=self.client_obj, phone='+919999000000',
            name='c', opt_in_status='opted_in',
        )
        Lead.objects.create(
            client=self.client_obj, contact=contact,
            phone='+919999000002', status='converted',
            converted_at=timezone.now(),
        )
        old_conv = Lead.objects.create(
            client=self.client_obj, contact=contact,
            phone='+919999000003', status='converted',
            converted_at=timezone.now() - timedelta(days=10),
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.data['leads']['converted_today'], 1)

    # ── campaigns ─────────────────────────────────────────────────────
    def test_running_campaigns_count(self):
        from social_stats.models import (
            WhatsAppCampaign, WhatsAppTemplate, WhatsAppContactList,
        )
        tpl = WhatsAppTemplate.objects.create(
            client=self.client_obj, name='t', category='MARKETING',
            language='en', body='hi',
        )
        lst = WhatsAppContactList.objects.create(client=self.client_obj, name='l')
        WhatsAppCampaign.objects.create(
            client=self.client_obj, name='running c',
            template=tpl, contact_list=lst, status='running',
            total_count=100, delivered_count=80,
        )
        WhatsAppCampaign.objects.create(
            client=self.client_obj, name='draft c',
            template=tpl, contact_list=lst, status='draft',
            total_count=0,
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(res.data['campaigns']['running'], 1)
        # 80% delivery rate from the single running campaign with traffic
        self.assertEqual(res.data['campaigns']['avg_delivery_rate_pct'], 80.0)

    # ── activity + approvals ──────────────────────────────────────────
    def test_recent_activity_returns_max_10_for_this_client(self):
        from social_stats.marketplace_models import ActivityLog
        for i in range(15):
            ActivityLog.objects.create(
                client=self.client_obj, actor_user=self.owner,
                actor_type='end_user', action_type='post_published',
                description=f'activity {i}', severity='info',
            )
        # Another client's activity must not bleed in.
        other = _client('other2')
        ActivityLog.objects.create(
            client=other, actor_type='system',
            action_type='post_published', description='other-client',
        )
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(len(res.data['recent_activity']), 10)
        for a in res.data['recent_activity']:
            self.assertNotIn('other-client', a['description'])

    def test_pending_approvals_returns_max_5(self):
        agency, member = _agency_member(self.client_obj)
        relation = AgencyClientRelation.objects.get(
            agency=agency, client=self.client_obj,
        )
        for i in range(8):
            ApprovalRequest.objects.create(
                relation=relation, client=self.client_obj,
                requested_by=member, action_type='publish_post',
                payload={}, preview=f'approval {i}', status='pending',
            )
        api = _api(self.owner)
        res = api.get('/api/dashboard/today/')
        self.assertEqual(len(res.data['pending_approvals']), 5)
        # Each has the structured shape we promise the frontend.
        for a in res.data['pending_approvals']:
            self.assertIn('id', a)
            self.assertIn('action_type', a)
            self.assertIn('requested_by', a)
            self.assertIn('preview', a)
