# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Regression tests for tenant-isolation fixes.

Each test corresponds to a previously exploitable IDOR: an authenticated
user of tenant B could read or write tenant A's data by passing A's ids.
"""
import uuid

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from social_stats.models import (
    Client, UserProfile, SharedReport, OnboardingStep, ClientGoal,
    PlatformCredential, ROISettings, ROIReport, HashtagSet, GMBReview,
    WhatsAppContact, PostIdeaSet,
)


def _client_factory(label):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:8]}@x.test',
    )


def _user_for(client_obj, role='client'):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:12]}', email='u@x.test',
        password='x', is_active=True,
    )
    profile = UserProfile.objects.create(
        user=u, role=role, client=client_obj if role == 'client' else None,
    )
    if role == 'staff' and client_obj is not None:
        profile.assigned_clients.add(client_obj)
    return u


def _api_for(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


class TwoTenantBase(TestCase):
    """Tenant A (victim) + tenant B (attacker, a client-role user)."""

    def setUp(self):
        self.client_a = _client_factory('victim')
        self.client_b = _client_factory('attacker')
        self.user_b = _user_for(self.client_b)
        self.api_b = _api_for(self.user_b)


class SharedReportIsolationTests(TwoTenantBase):
    def setUp(self):
        super().setUp()
        self.report_a = SharedReport.objects.create(
            client=self.client_a, date_from='2026-01-01', date_until='2026-01-31',
        )

    def test_cannot_list_other_tenants_reports_via_client_param(self):
        res = self.api_b.get(f'/api/shared-reports/?client={self.client_a.id}')
        self.assertEqual(res.status_code, 200)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(list(rows), [])

    def test_cannot_create_report_for_other_tenant(self):
        res = self.api_b.post('/api/shared-reports/', {
            'client': self.client_a.id,
            'date_from': '2026-01-01', 'date_until': '2026-01-31',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_can_create_report_for_own_tenant(self):
        res = self.api_b.post('/api/shared-reports/', {
            'client': self.client_b.id,
            'date_from': '2026-01-01', 'date_until': '2026-01-31',
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_cannot_delete_other_tenants_report(self):
        res = self.api_b.delete(f'/api/shared-reports/{self.report_a.id}/')
        self.assertEqual(res.status_code, 404)
        self.report_a.refresh_from_db()
        self.assertTrue(self.report_a.is_active)


class ROIIsolationTests(TwoTenantBase):
    def setUp(self):
        super().setUp()
        ROISettings.objects.create(client=self.client_a, avg_sale_value=999)
        ROIReport.objects.create(client=self.client_a, month=1, year=2026)

    def test_settings_get_denied(self):
        res = self.api_b.get(f'/api/roi/settings/{self.client_a.id}/')
        self.assertEqual(res.status_code, 403)

    def test_settings_get_own_allowed(self):
        res = self.api_b.get(f'/api/roi/settings/{self.client_b.id}/')
        self.assertEqual(res.status_code, 200)

    def test_calculate_denied(self):
        res = self.api_b.post('/api/roi/calculate/', {
            'client_id': self.client_a.id, 'month': 1, 'year': 2026,
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_live_denied(self):
        res = self.api_b.get(
            f'/api/roi/live/?client_id={self.client_a.id}&month=1&year=2026')
        self.assertEqual(res.status_code, 403)

    def test_reports_list_excludes_other_tenants(self):
        res = self.api_b.get(f'/api/roi/reports/?client_id={self.client_a.id}')
        self.assertEqual(res.status_code, 200)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(list(rows), [])


class OnboardingIsolationTests(TwoTenantBase):
    def test_list_with_other_client_param_is_empty(self):
        res = self.api_b.get(f'/api/onboarding/?client={self.client_a.id}')
        self.assertEqual(res.status_code, 200)
        rows = res.data['results'] if isinstance(res.data, dict) else res.data
        self.assertEqual(list(rows), [])

    def test_cannot_patch_other_tenants_step(self):
        step = OnboardingStep.objects.filter(client=self.client_a).first()
        res = self.api_b.patch(f'/api/onboarding/{step.id}/',
                               {'is_completed': True}, format='json')
        self.assertEqual(res.status_code, 404)


class GoalIsolationTests(TwoTenantBase):
    def test_cannot_create_goal_for_other_tenant(self):
        res = self.api_b.post('/api/goals/', {
            'client': self.client_a.id, 'platform': 'facebook',
            'metric': 'reach', 'target_value': 100, 'month': 1, 'year': 2026,
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_can_create_goal_for_own_tenant(self):
        res = self.api_b.post('/api/goals/', {
            'client': self.client_b.id, 'platform': 'facebook',
            'metric': 'reach', 'target_value': 100, 'month': 1, 'year': 2026,
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_cannot_move_goal_to_other_tenant_on_update(self):
        goal = ClientGoal.objects.create(
            client=self.client_b, platform='facebook', metric='reach',
            target_value=100, month=1, year=2026,
        )
        res = self.api_b.patch(f'/api/goals/{goal.id}/',
                               {'client': self.client_a.id}, format='json')
        self.assertEqual(res.status_code, 403)


class CredentialIsolationTests(TwoTenantBase):
    def test_cannot_create_credential_for_other_tenant(self):
        res = self.api_b.post('/api/credentials/', {
            'client': self.client_a.id, 'platform': 'facebook',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_cannot_move_credential_to_other_tenant(self):
        cred = PlatformCredential.objects.create(
            client=self.client_b, platform='facebook', access_token='tok',
        )
        res = self.api_b.patch(f'/api/credentials/{cred.id}/',
                               {'client': self.client_a.id}, format='json')
        self.assertEqual(res.status_code, 403)


class OAuthStatusIsolationTests(TwoTenantBase):
    def test_status_denied_for_other_tenant(self):
        res = self.api_b.get(f'/api/oauth/status/{self.client_a.id}/')
        self.assertEqual(res.status_code, 403)

    def test_status_allowed_for_own_tenant(self):
        res = self.api_b.get(f'/api/oauth/status/{self.client_b.id}/')
        self.assertEqual(res.status_code, 200)


class AIToolsIsolationTests(TwoTenantBase):
    def test_hashtag_history_denied(self):
        res = self.api_b.get(f'/api/ai/hashtags/?client_id={self.client_a.id}')
        self.assertEqual(res.status_code, 403)

    def test_hashtag_generate_denied(self):
        res = self.api_b.post('/api/ai/hashtags/', {
            'client_id': self.client_a.id, 'platform': 'instagram',
            'niche': 'shoes', 'post_topic': 'sale',
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_hashtag_save_set_denied(self):
        hs = HashtagSet.objects.create(
            client=self.client_a, platform='instagram', niche='x',
            hashtags={'tags': ['#a']},
        )
        res = self.api_b.post(f'/api/ai/hashtags/{hs.id}/save-set/', {
            'set_name': 'steal', 'tags': ['#a'],
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_caption_history_denied(self):
        res = self.api_b.get(f'/api/ai/caption/?client_id={self.client_a.id}')
        self.assertEqual(res.status_code, 403)

    def test_caption_generate_denied(self):
        res = self.api_b.post('/api/ai/caption/', {
            'client_id': self.client_a.id, 'topic': 'sale',
            'platforms': ['facebook'],
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_post_ideas_history_denied(self):
        res = self.api_b.get(f'/api/ai/post-ideas/?client_id={self.client_a.id}')
        self.assertEqual(res.status_code, 403)

    def test_post_ideas_approve_all_denied(self):
        idea_set = PostIdeaSet.objects.create(
            client=self.client_a, month=1, year=2026,
            business_type='x', platforms=['facebook'], ideas={},
        )
        res = self.api_b.post(f'/api/ai/post-ideas/{idea_set.id}/approve-all/')
        self.assertEqual(res.status_code, 403)


class GMBIsolationTests(TwoTenantBase):
    def test_unassigned_staff_cannot_read_reviews(self):
        staff = _user_for(self.client_b, role='staff')  # assigned to B only
        api = _api_for(staff)
        GMBReview.objects.create(
            client=self.client_a, review_id='r1', rating=5,
        )
        res = api.get(f'/api/gmb/reviews/{self.client_a.id}/')
        self.assertEqual(res.status_code, 403)


class WhatsAppIsolationTests(TwoTenantBase):
    def setUp(self):
        super().setUp()
        self.contact_a = WhatsAppContact.objects.create(
            client=self.client_a, phone='+15550001111', name='A-contact',
        )

    def test_thread_view_denied_cross_tenant(self):
        res = self.api_b.get(f'/api/whatsapp/inbox/thread/?contact_id={self.contact_a.id}')
        self.assertEqual(res.status_code, 403)

    def test_send_direct_denied_cross_tenant(self):
        res = self.api_b.post('/api/whatsapp/send/', {
            'contact_id': self.contact_a.id, 'type': 'text',
            'payload': {'body': 'hi'},
        }, format='json')
        self.assertEqual(res.status_code, 403)

    def test_unassigned_staff_gets_no_thread_access(self):
        # Staff with no assignment resolves to no client context → denied,
        # previously fell through to unscoped access.
        staff = _user_for(None, role='staff')
        api = _api_for(staff)
        res = api.get(f'/api/whatsapp/inbox/thread/?contact_id={self.contact_a.id}')
        self.assertEqual(res.status_code, 403)

    def test_unassigned_staff_inbox_is_empty(self):
        staff = _user_for(None, role='staff')
        api = _api_for(staff)
        res = api.get('/api/whatsapp/inbox/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['results'], [])


class ClientCreateLinksProfileTests(TestCase):
    """Regression: the profile-linking block lived in GoalViewSet by mistake,
    so onboarding-created workspaces never linked to the creating user."""

    def test_solo_client_create_links_profile(self):
        u = User.objects.create_user(
            username=f'solo-{uuid.uuid4().hex[:8]}', email='solo@x.test',
            password='x', is_active=True,
        )
        profile = UserProfile.objects.create(user=u, role='client')
        api = _api_for(u)
        res = api.post('/api/clients/', {
            'name': 'Solo', 'company': 'Solo Co',
            'email': f'biz-{uuid.uuid4().hex[:8]}@x.test',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        profile.refresh_from_db()
        self.assertEqual(profile.client_id, res.data['id'])
