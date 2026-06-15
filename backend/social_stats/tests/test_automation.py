"""
Automation engine tests.

Covers:
  - matcher logic (trigger_type + trigger_filters: platforms, keywords,
    sentiment, rating bounds)
  - dispatcher → evaluator → action handlers (auto_reply, notify, assign,
    add_tag, webhook)
  - tenant isolation (rules from one client never run on another's events)
  - viewset CRUD + toggle action + templates collection action
"""
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from social_stats.models import (
    Client, UserProfile, AutomationRule, Conversation, Message,
    UnifiedReview, Notification, PlatformCredential,
)
from social_stats.publishers import PublishResult
from social_stats import automation_engine


def _client_factory(label):
    return Client.objects.create(name=label, company=label.title(),
                                  email=f'{label}-{id(object())}@x.test')


def _user_for(client_obj, role='client'):
    import uuid
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:12]}', email='u@x.test',
        password='x', is_active=True,
    )
    UserProfile.objects.create(user=u, role=role,
                                client=client_obj if role == 'client' else None)
    return u


# ══════════════════════════════════════════════════════════════════════
# Matcher
# ══════════════════════════════════════════════════════════════════════
class MatcherTests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory('m')
        self.conv = Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='p1', type='comment',
        )
        self.msg = Message.objects.create(
            conversation=self.conv, direction='inbound',
            author_name='Alice', content='this is broken, urgent help!',
            sentiment='negative', sent_at=timezone.now(),
        )
        self.review = UnifiedReview.objects.create(
            client=self.client_obj, platform='google_my_business',
            platform_review_id='r1', reviewer_name='Mia',
            rating=5, comment='Great service!', sentiment='positive',
        )

    def _rule(self, **kwargs):
        defaults = dict(
            client=self.client_obj, name='r',
            trigger_type='new_comment', trigger_filters={},
            action_type='notify', action_config={},
        )
        defaults.update(kwargs)
        return AutomationRule.objects.create(**defaults)

    def test_new_comment_matches_message_with_comment_type(self):
        rule = self._rule(trigger_type='new_comment')
        ctx = automation_engine._build_context('message_created', self.msg.id, self.client_obj.id)
        self.assertTrue(automation_engine._matches(rule, ctx))

    def test_new_comment_does_not_match_review(self):
        rule = self._rule(trigger_type='new_comment')
        ctx = automation_engine._build_context('review_created', self.review.id, self.client_obj.id)
        self.assertFalse(automation_engine._matches(rule, ctx))

    def test_keyword_filter_case_insensitive(self):
        rule = self._rule(
            trigger_type='keyword_mention',
            trigger_filters={'keywords': ['URGENT', 'broken']},
        )
        ctx = automation_engine._build_context('message_created', self.msg.id, self.client_obj.id)
        self.assertTrue(automation_engine._matches(rule, ctx))

    def test_keyword_filter_no_match(self):
        rule = self._rule(
            trigger_type='keyword_mention',
            trigger_filters={'keywords': ['refund', 'cancel']},
        )
        ctx = automation_engine._build_context('message_created', self.msg.id, self.client_obj.id)
        self.assertFalse(automation_engine._matches(rule, ctx))

    def test_negative_sentiment_filter(self):
        rule = self._rule(trigger_type='negative_sentiment')
        ctx = automation_engine._build_context('message_created', self.msg.id, self.client_obj.id)
        self.assertTrue(automation_engine._matches(rule, ctx))

    def test_rating_bounds_on_review(self):
        rule_5 = self._rule(trigger_type='new_review',
                            trigger_filters={'min_rating': 5, 'max_rating': 5})
        rule_low = self._rule(trigger_type='new_review',
                              trigger_filters={'min_rating': 1, 'max_rating': 2})
        ctx = automation_engine._build_context('review_created', self.review.id, self.client_obj.id)
        self.assertTrue(automation_engine._matches(rule_5, ctx))
        self.assertFalse(automation_engine._matches(rule_low, ctx))

    def test_platform_filter(self):
        rule = self._rule(trigger_type='new_comment',
                          trigger_filters={'platforms': ['instagram']})
        ctx = automation_engine._build_context('message_created', self.msg.id, self.client_obj.id)
        # Conversation is on facebook; rule limited to instagram → no match
        self.assertFalse(automation_engine._matches(rule, ctx))

    def test_outbound_message_does_not_create_context(self):
        # Outbound replies should never trigger automations
        out = Message.objects.create(
            conversation=self.conv, direction='outbound',
            content='reply', sent_at=timezone.now(),
        )
        ctx = automation_engine._build_context('message_created', out.id, self.client_obj.id)
        self.assertIsNone(ctx)

    def test_cross_tenant_returns_none(self):
        other = _client_factory('other')
        ctx = automation_engine._build_context('message_created', self.msg.id, other.id)
        self.assertIsNone(ctx)


# ══════════════════════════════════════════════════════════════════════
# Action handlers
# ══════════════════════════════════════════════════════════════════════
class ActionHandlerTests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory('a')
        PlatformCredential.objects.create(
            client=self.client_obj, platform='facebook',
            access_token='tok', page_id='100', is_active=True,
        )
        self.user = _user_for(self.client_obj)
        self.conv = Conversation.objects.create(
            client=self.client_obj, platform='facebook',
            platform_thread_id='p1', type='comment',
            contact_name='Alice',
        )
        self.msg = Message.objects.create(
            conversation=self.conv, direction='inbound',
            platform_message_id='cmt-1',
            author_name='Alice', content='Loved your post!',
            sentiment='positive', sent_at=timezone.now(),
        )

    def _ctx(self):
        return automation_engine._build_context('message_created', self.msg.id, self.client_obj.id)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_auto_reply_calls_publisher_and_persists_outbound(self):
        rule = AutomationRule.objects.create(
            client=self.client_obj, name='thanks',
            trigger_type='new_comment', trigger_filters={},
            action_type='auto_reply',
            action_config={'template': 'Thanks {author_name}!'},
        )
        with patch('social_stats.publishers.facebook.FacebookPublisher.reply_to_comment',
                   return_value=PublishResult(success=True, platform_post_id='r-1')) as mock_fn:
            automation_engine.evaluate_automation_rules(
                'message_created', self.msg.id, self.client_obj.id,
            )
        # Publisher called with our inbound comment id + interpolated template
        mock_fn.assert_called_once()
        args, kwargs = mock_fn.call_args
        self.assertEqual(args[1], 'cmt-1')
        self.assertEqual(args[2], 'Thanks Alice!')

        # Outbound row persisted
        out = Message.objects.get(conversation=self.conv, direction='outbound')
        self.assertEqual(out.content, 'Thanks Alice!')
        self.assertEqual(out.platform_message_id, 'r-1')

        # run_count incremented
        rule.refresh_from_db()
        self.assertEqual(rule.run_count, 1)
        self.assertIsNotNone(rule.last_run_at)

    def test_notify_writes_notification(self):
        AutomationRule.objects.create(
            client=self.client_obj, name='alert',
            trigger_type='new_comment', trigger_filters={},
            action_type='notify',
            action_config={'title': 'Hey!', 'body': 'On {platform}'},
        )
        before = Notification.objects.filter(user=self.user).count()
        automation_engine.evaluate_automation_rules(
            'message_created', self.msg.id, self.client_obj.id,
        )
        after = Notification.objects.filter(user=self.user).count()
        self.assertEqual(after - before, 1)
        notif = Notification.objects.filter(user=self.user).latest('created_at')
        self.assertEqual(notif.title, 'Hey!')
        self.assertEqual(notif.body, 'On facebook')

    def test_add_tag_appends_to_conversation_tags(self):
        AutomationRule.objects.create(
            client=self.client_obj, name='tag',
            trigger_type='keyword_mention',
            trigger_filters={'keywords': ['loved']},
            action_type='add_tag',
            action_config={'tag': 'positive-feedback'},
        )
        automation_engine.evaluate_automation_rules(
            'message_created', self.msg.id, self.client_obj.id,
        )
        self.conv.refresh_from_db()
        self.assertIn('positive-feedback', self.conv.tags or [])

    def test_assign_sets_assigned_to(self):
        target = User.objects.create_user(username=f'tgt-{id(self)}',
                                           email='t@x.test', password='x', is_active=True)
        AutomationRule.objects.create(
            client=self.client_obj, name='assign',
            trigger_type='new_comment',
            action_type='assign',
            action_config={'user_id': target.id},
        )
        automation_engine.evaluate_automation_rules(
            'message_created', self.msg.id, self.client_obj.id,
        )
        self.conv.refresh_from_db()
        self.assertEqual(self.conv.assigned_to_id, target.id)

    @patch('social_stats.automation_engine.requests.post')
    def test_webhook_posts_payload(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200)
        AutomationRule.objects.create(
            client=self.client_obj, name='hook',
            trigger_type='new_comment',
            action_type='webhook',
            action_config={'url': 'https://example.invalid/hook'},
        )
        automation_engine.evaluate_automation_rules(
            'message_created', self.msg.id, self.client_obj.id,
        )
        mock_post.assert_called_once()
        url, _ = mock_post.call_args[0], mock_post.call_args[1]
        self.assertEqual(url[0], 'https://example.invalid/hook')
        payload = mock_post.call_args.kwargs['json']
        self.assertEqual(payload['platform'], 'facebook')
        self.assertEqual(payload['event'], 'message')

    def test_inactive_rule_does_not_fire(self):
        AutomationRule.objects.create(
            client=self.client_obj, name='off',
            trigger_type='new_comment', trigger_filters={},
            action_type='notify', action_config={},
            is_active=False,
        )
        before = Notification.objects.count()
        automation_engine.evaluate_automation_rules(
            'message_created', self.msg.id, self.client_obj.id,
        )
        self.assertEqual(Notification.objects.count(), before)


# ══════════════════════════════════════════════════════════════════════
# Tenant isolation: rules from one client never trigger on another's events
# ══════════════════════════════════════════════════════════════════════
class CrossTenantTests(TestCase):
    def test_rule_on_client_a_does_not_run_for_client_b_event(self):
        a = _client_factory('aa')
        b = _client_factory('bb')

        # Rule belongs to client A
        AutomationRule.objects.create(
            client=a, name='a-rule',
            trigger_type='new_comment',
            action_type='notify', action_config={'title': 'A!', 'body': '.'},
        )
        # Event happens on client B
        conv_b = Conversation.objects.create(
            client=b, platform='facebook',
            platform_thread_id='pb', type='comment',
        )
        msg_b = Message.objects.create(
            conversation=conv_b, direction='inbound',
            content='hi from b', sent_at=timezone.now(),
        )

        before = Notification.objects.count()
        automation_engine.evaluate_automation_rules('message_created', msg_b.id, b.id)
        # No notifications because A's rule isn't loaded for client_id=b
        self.assertEqual(Notification.objects.count(), before)


# ══════════════════════════════════════════════════════════════════════
# ViewSet CRUD + toggle + templates
# ══════════════════════════════════════════════════════════════════════
class AutomationRuleAPITests(TestCase):
    def setUp(self):
        self.client_obj = _client_factory('vs')
        self.user = _user_for(self.client_obj)
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_create_rule(self):
        res = self.api.post('/api/automations/', {
            'name': 'My rule',
            'trigger_type': 'new_review',
            'trigger_filters': {'min_rating': 5},
            'action_type': 'auto_reply',
            'action_config': {'template': 'Thanks!'},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        rule = AutomationRule.objects.get(client=self.client_obj)
        self.assertEqual(rule.name, 'My rule')
        self.assertTrue(rule.is_active)
        self.assertEqual(rule.created_by, self.user)

    def test_list_filtered_by_active(self):
        AutomationRule.objects.create(
            client=self.client_obj, name='on',
            trigger_type='new_comment', action_type='notify',
            is_active=True,
        )
        AutomationRule.objects.create(
            client=self.client_obj, name='off',
            trigger_type='new_comment', action_type='notify',
            is_active=False,
        )
        res = self.api.get('/api/automations/?active=true')
        names = {r['name'] for r in (res.data.get('results') or res.data)}
        self.assertEqual(names, {'on'})

    def test_toggle_action(self):
        rule = AutomationRule.objects.create(
            client=self.client_obj, name='t',
            trigger_type='new_comment', action_type='notify',
            is_active=True,
        )
        res = self.api.post(f'/api/automations/{rule.id}/toggle/')
        self.assertEqual(res.status_code, 200)
        rule.refresh_from_db()
        self.assertFalse(rule.is_active)

    def test_templates_action_returns_prebuilt(self):
        res = self.api.get('/api/automations/templates/')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data['templates']), 5)
        names = [t['name'] for t in res.data['templates']]
        self.assertIn('Auto-thank for 5-star reviews', names)
        self.assertIn('Alert me on negative sentiment', names)

    def test_validation_rejects_non_object_filters(self):
        res = self.api.post('/api/automations/', {
            'name': 'bad',
            'trigger_type': 'new_comment',
            'trigger_filters': 'not-an-object',
            'action_type': 'notify',
            'action_config': {},
        }, format='json')
        self.assertEqual(res.status_code, 400)
