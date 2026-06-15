"""
Tests for: audit log + notification dispatch + smart watchers
+ approval queue + preferences API.
"""
import uuid
from datetime import datetime, timedelta, timezone as dt_tz
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.models import (
    Client, UserProfile, ActionLog, Notification, NotificationPreference,
    PlatformCredential, PostMetric, DailyMetric, UnifiedPost, Alert,
)


def _client_factory(label='c'):
    return Client.objects.create(name=label, company=label.title(),
                                  email=f'{label}-{uuid.uuid4().hex[:8]}@x.test')


def _user_for(client_obj, role='client'):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:12]}',
        email=f'{uuid.uuid4().hex[:8]}@x.test',
        password='x', is_active=True,
    )
    p = UserProfile.objects.create(user=u, role=role,
                                    client=client_obj if role == 'client' else None)
    if role == 'staff':
        p.assigned_clients.add(client_obj)
    return u


def _api(user):
    a = APIClient()
    a.force_authenticate(user=user)
    return a


# ══════════════════════════════════════════════════════════════════════
# log_action helper
# ══════════════════════════════════════════════════════════════════════
class AuditTests(TestCase):
    def setUp(self):
        self.c = _client_factory('a')
        self.u = _user_for(self.c)

    def test_log_action_persists(self):
        from social_stats.audit import log_action
        log = log_action(self.u, self.c, 'composer.published',
                          object_type='UnifiedPost', object_id=42,
                          platform='facebook', result='success',
                          details={'platforms': ['facebook']})
        self.assertIsNotNone(log)
        self.assertEqual(log.action, 'composer.published')
        self.assertEqual(log.actor, self.u)
        self.assertEqual(log.client, self.c)
        self.assertEqual(log.platform, 'facebook')

    def test_log_action_anonymous_actor_becomes_null(self):
        from social_stats.audit import log_action
        from django.contrib.auth.models import AnonymousUser
        log = log_action(AnonymousUser(), self.c, 'system.event')
        self.assertIsNotNone(log)
        self.assertIsNone(log.actor)

    def test_log_action_no_client_returns_none(self):
        from social_stats.audit import log_action
        self.assertIsNone(log_action(self.u, None, 'any.action'))

    def test_audit_viewset_filters_by_tenant_and_action(self):
        from social_stats.audit import log_action
        log_action(self.u, self.c, 'composer.published')
        log_action(self.u, self.c, 'inbox.reply')
        # Different tenant
        other = _client_factory('b')
        log_action(self.u, other, 'composer.published')

        api = _api(self.u)
        res = api.get('/api/audit/log/')
        self.assertEqual(res.status_code, 200)
        rows = res.data.get('results') or res.data
        actions = [r['action'] for r in rows]
        # Client-role user only sees own tenant's logs
        self.assertEqual(set(actions), {'composer.published', 'inbox.reply'})

        res = api.get('/api/audit/log/?action=composer.published')
        rows = res.data.get('results') or res.data
        self.assertEqual([r['action'] for r in rows], ['composer.published'])


# ══════════════════════════════════════════════════════════════════════
# Notification dispatch
# ══════════════════════════════════════════════════════════════════════
class DispatchTests(TestCase):
    def setUp(self):
        self.c = _client_factory('d')
        self.u = _user_for(self.c)

    def test_default_policy_creates_in_app_only(self):
        from social_stats.notification_dispatch import dispatch_notification
        out = dispatch_notification(
            recipients=[self.u], event_type='viral_post',
            client=self.c, title='Hi', body='Body',
        )
        in_app = [s for s in out['sent'] if s['channel'] == 'in_app']
        emails = [s for s in out['sent'] if s['channel'] == 'email']
        self.assertEqual(len(in_app), 1)
        self.assertEqual(len(emails), 0)
        self.assertTrue(Notification.objects.filter(user=self.u).exists())

    def test_opt_in_email_triggers_send_mail(self):
        NotificationPreference.objects.create(
            user=self.u, event_type='viral_post', channel='email', enabled=True,
        )
        from social_stats.notification_dispatch import dispatch_notification
        with patch('social_stats.notification_dispatch.send_mail') as mock_send:
            dispatch_notification(
                recipients=[self.u], event_type='viral_post',
                client=self.c, title='Subject', body='Hi',
            )
        mock_send.assert_called_once()

    def test_opt_out_skips(self):
        NotificationPreference.objects.create(
            user=self.u, event_type='viral_post', channel='in_app', enabled=False,
        )
        from social_stats.notification_dispatch import dispatch_notification
        out = dispatch_notification(
            recipients=[self.u], event_type='viral_post',
            client=self.c, title='Hi',
        )
        self.assertFalse(Notification.objects.filter(user=self.u).exists())
        self.assertEqual(len(out['skipped']), 4)  # all 4 channels skipped (in_app opted out, others default off)


# ══════════════════════════════════════════════════════════════════════
# Smart watchers
# ══════════════════════════════════════════════════════════════════════
class WatcherTests(TestCase):
    def setUp(self):
        self.c = _client_factory('w')
        self.u = _user_for(self.c)

    def test_token_expiring_dispatches_alert(self):
        PlatformCredential.objects.create(
            client=self.c, platform='facebook',
            access_token='tok', page_id='1', is_active=True,
            expires_at=timezone.now() + timedelta(days=3),
        )
        from social_stats.notification_watchers import detect_token_expiring
        n = detect_token_expiring()
        self.assertEqual(n, 1)
        self.assertTrue(Notification.objects.filter(user=self.u).exists())
        self.assertTrue(Alert.objects.filter(client=self.c, alert_type='token_expired').exists())

        # Repeat: dedup_key prevents a second alert today
        n2 = detect_token_expiring()
        self.assertEqual(n2, 0)

    def test_follower_milestone_fires_once_per_threshold(self):
        today = timezone.now().date()
        # Yesterday: 4500. Today: 5500. Crosses 5,000.
        DailyMetric.objects.create(client=self.c, platform='facebook',
                                    date=today - timedelta(days=1),
                                    followers=4500)
        DailyMetric.objects.create(client=self.c, platform='facebook',
                                    date=today, followers=5500)
        from social_stats.notification_watchers import detect_follower_milestones
        n = detect_follower_milestones()
        self.assertEqual(n, 1)
        alert = Alert.objects.get(client=self.c, alert_type='follower_milestone')
        self.assertIn('5,000', alert.message)

        n2 = detect_follower_milestones()
        self.assertEqual(n2, 0)

    def test_viral_post_threshold(self):
        from social_stats.notification_watchers import detect_viral_posts
        cutoff = timezone.now()
        # 3 baseline posts (engagement ~= 12)
        for i in range(3):
            PostMetric.objects.create(
                client=self.c, platform='facebook', post_id=f'b{i}',
                published_at=cutoff - timedelta(days=5),
                likes=10, comments=1, shares=0, saves=0,
            )
        # 1 viral post within last 24h (engagement ~80)
        PostMetric.objects.create(
            client=self.c, platform='facebook', post_id='viral',
            published_at=cutoff - timedelta(hours=2),
            likes=70, comments=5, shares=0, saves=0,
        )
        n = detect_viral_posts()
        self.assertEqual(n, 1)
        self.assertTrue(Alert.objects.filter(client=self.c, alert_type='viral_post').exists())


# ══════════════════════════════════════════════════════════════════════
# Notification preferences API
# ══════════════════════════════════════════════════════════════════════
class PreferencesAPITests(TestCase):
    def setUp(self):
        self.c = _client_factory('p')
        self.u = _user_for(self.c)
        self.api = _api(self.u)

    def test_get_returns_default_matrix(self):
        res = self.api.get('/api/notifications/preferences/')
        self.assertEqual(res.status_code, 200)
        # Every event row has all 4 channels with defaults
        self.assertGreaterEqual(len(res.data['matrix']), 1)
        first = res.data['matrix'][0]
        for ch in ('in_app', 'email', 'whatsapp', 'browser'):
            self.assertIn(ch, first)
        # in_app default True, others False
        self.assertTrue(first['in_app'])
        self.assertFalse(first['email'])

    def test_put_persists_changes(self):
        body = {'matrix': [
            {'event_type': 'viral_post', 'channel': 'email', 'enabled': True},
            {'event_type': 'viral_post', 'channel': 'in_app', 'enabled': False},
            {'event_type': 'BOGUS',      'channel': 'email', 'enabled': True},  # ignored
        ]}
        res = self.api.put('/api/notifications/preferences/', body, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['updated'], 2)
        self.assertEqual(NotificationPreference.objects.filter(user=self.u).count(), 2)


# ══════════════════════════════════════════════════════════════════════
# Approval queue + workflow
# ══════════════════════════════════════════════════════════════════════
class ApprovalQueueTests(TestCase):
    def setUp(self):
        self.c = _client_factory('ap')
        self.c.requires_approval = True
        self.c.save(update_fields=['requires_approval'])

        self.client_user = _user_for(self.c, role='client')
        self.staff = _user_for(self.c, role='staff')
        self.api = _api(self.staff)

    def test_queue_lists_pending_approval_only(self):
        UnifiedPost.objects.create(
            client=self.c, content='Pending', media_type='text',
            target_platforms=['facebook'], status='pending_approval',
            created_by=self.client_user,
        )
        UnifiedPost.objects.create(
            client=self.c, content='Draft', media_type='text',
            target_platforms=['facebook'], status='draft',
            created_by=self.client_user,
        )
        res = self.api.get('/api/composer/approvals/')
        self.assertEqual(res.status_code, 200)
        contents = [r['content'] for r in res.data['queue']]
        self.assertIn('Pending', contents)
        self.assertNotIn('Draft', contents)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_publish_now_on_approval_required_dispatches_notify(self):
        post = UnifiedPost.objects.create(
            client=self.c, content='Needs review', media_type='text',
            target_platforms=['facebook'], status='draft',
            created_by=self.client_user,
        )
        client_api = _api(self.client_user)
        with patch('social_stats.notification_watchers.dispatch_notification') as mock_dis:
            res = client_api.post(f'/api/composer/posts/{post.id}/publish_now/')
        self.assertEqual(res.status_code, 202)
        post.refresh_from_db()
        self.assertEqual(post.status, 'pending_approval')
        # The approver-notify task should have been dispatched (eager)
        mock_dis.assert_called()
