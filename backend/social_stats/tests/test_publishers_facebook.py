"""
Unit tests for FacebookPublisher. The Graph API is mocked at requests.request
so we verify URL, method, params, and body construction without hitting the
network.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from social_stats.publishers import (
    get_publisher, PublishError, TokenExpiredError, RateLimitError,
    PermissionDeniedError,
)


def _fake_credential(**overrides):
    base = {
        'access_token':         'page-tok-12345',
        'page_id':              '100110011001',
        'page_name':            'Test Page',
        'instagram_account_id': None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _resp(status=200, json_body=None):
    """Build a mock requests.Response."""
    m = MagicMock()
    m.status_code = status
    m.json.return_value = json_body or {}
    m.text = '{}'
    m.headers = {}
    return m


class FacebookPublisherTests(SimpleTestCase):
    # ── Text post ────────────────────────────────────────────────────────
    @patch('social_stats.publishers._graph_client.requests.request')
    def test_publish_text_calls_feed_endpoint(self, m):
        m.return_value = _resp(200, {'id': '100_555'})
        pub = get_publisher('facebook')
        result = pub.publish_text(_fake_credential(), 'Hello world')

        m.assert_called_once()
        args, kwargs = m.call_args
        self.assertEqual(kwargs['method'], 'POST')
        self.assertIn('/100110011001/feed', kwargs['url'])
        self.assertEqual(kwargs['data']['message'], 'Hello world')
        self.assertEqual(kwargs['params']['access_token'], 'page-tok-12345')
        self.assertTrue(result.success)
        self.assertEqual(result.platform_post_id, '100_555')

    @patch('social_stats.publishers._graph_client.requests.request')
    def test_scheduled_text_includes_published_false(self, m):
        m.return_value = _resp(200, {'id': '100_555'})
        pub = get_publisher('facebook')
        pub.publish_text(_fake_credential(), 'later', scheduled_publish_time=1735200000)

        kwargs = m.call_args.kwargs
        self.assertEqual(kwargs['data']['published'], 'false')
        self.assertEqual(kwargs['data']['scheduled_publish_time'], 1735200000)

    # ── Single image ─────────────────────────────────────────────────────
    @patch('social_stats.publishers._graph_client.requests.request')
    def test_publish_image_single(self, m):
        m.return_value = _resp(200, {'id': 'photo-1', 'post_id': '100_777'})
        pub = get_publisher('facebook')
        result = pub.publish_image(_fake_credential(), 'caption', ['https://x/img.jpg'])

        kwargs = m.call_args.kwargs
        self.assertIn('/100110011001/photos', kwargs['url'])
        self.assertEqual(kwargs['data']['url'], 'https://x/img.jpg')
        self.assertEqual(kwargs['data']['caption'], 'caption')
        self.assertEqual(result.platform_post_id, '100_777')

    # ── Multi image / carousel ───────────────────────────────────────────
    @patch('social_stats.publishers._graph_client.requests.request')
    def test_publish_image_carousel_uploads_then_feed(self, m):
        m.side_effect = [
            _resp(200, {'id': 'photo-1'}),     # upload 1
            _resp(200, {'id': 'photo-2'}),     # upload 2
            _resp(200, {'id': '100_888'}),     # final feed post
        ]
        pub = get_publisher('facebook')
        result = pub.publish_image(_fake_credential(), 'caption',
                                   ['https://x/1.jpg', 'https://x/2.jpg'])

        # 3 calls expected: 2 photo uploads + 1 feed post
        self.assertEqual(m.call_count, 3)
        first, second, third = m.call_args_list

        # First two: photos with published=false
        self.assertIn('/photos', first.kwargs['url'])
        self.assertEqual(first.kwargs['data']['published'], 'false')
        self.assertIn('/photos', second.kwargs['url'])

        # Third: feed POST with attached_media JSON
        self.assertIn('/feed', third.kwargs['url'])
        attached = third.kwargs['json']['attached_media']
        self.assertEqual([a['media_fbid'] for a in attached], ['photo-1', 'photo-2'])
        self.assertTrue(result.success)

    # ── Video ────────────────────────────────────────────────────────────
    @patch('social_stats.publishers._graph_client.requests.request')
    def test_publish_video(self, m):
        m.return_value = _resp(200, {'id': 'vid-1', 'post_id': '100_999'})
        pub = get_publisher('facebook')
        result = pub.publish_video(_fake_credential(), 'desc', 'https://x/v.mp4',
                                   thumbnail='https://x/t.jpg', title='Title!')

        kwargs = m.call_args.kwargs
        self.assertIn('/videos', kwargs['url'])
        self.assertEqual(kwargs['data']['file_url'], 'https://x/v.mp4')
        self.assertEqual(kwargs['data']['description'], 'desc')
        self.assertEqual(kwargs['data']['thumb'], 'https://x/t.jpg')
        self.assertEqual(kwargs['data']['title'], 'Title!')
        self.assertEqual(result.platform_post_id, '100_999')

    # ── Delete + metrics ─────────────────────────────────────────────────
    @patch('social_stats.publishers._graph_client.requests.request')
    def test_delete_post(self, m):
        m.return_value = _resp(200, {'success': True})
        pub = get_publisher('facebook')
        out = pub.delete_post(_fake_credential(), '100_555')
        self.assertEqual(m.call_args.kwargs['method'], 'DELETE')
        self.assertIn('/100_555', m.call_args.kwargs['url'])
        self.assertTrue(out['success'])

    @patch('social_stats.publishers._graph_client.requests.request')
    def test_get_post_metrics(self, m):
        m.return_value = _resp(200, {'data': []})
        pub = get_publisher('facebook')
        pub.get_post_metrics(_fake_credential(), '100_555')
        kwargs = m.call_args.kwargs
        self.assertIn('/100_555/insights', kwargs['url'])
        self.assertIn('post_impressions', kwargs['params']['metric'])

    # ── Reply to comment ─────────────────────────────────────────────────
    @patch('social_stats.publishers._graph_client.requests.request')
    def test_reply_to_comment(self, m):
        m.return_value = _resp(200, {'id': 'reply-1'})
        pub = get_publisher('facebook')
        out = pub.reply_to_comment(_fake_credential(), 'comment-99', 'Thanks!')
        self.assertIn('/comment-99/comments', m.call_args.kwargs['url'])
        self.assertEqual(m.call_args.kwargs['data']['message'], 'Thanks!')
        self.assertEqual(out.platform_post_id, 'reply-1')

    # ── Error mapping ────────────────────────────────────────────────────
    @patch('social_stats.publishers._graph_client.requests.request')
    def test_token_expired_maps_to_typed_exception(self, m):
        m.return_value = _resp(401, {'error': {'code': 190, 'message': 'Session has expired'}})
        pub = get_publisher('facebook')
        with self.assertRaises(TokenExpiredError):
            pub.publish_text(_fake_credential(), 'hi')

    @patch('social_stats.publishers._graph_client.requests.request')
    def test_rate_limit_maps_to_typed_exception(self, m):
        m.return_value = _resp(429, {'error': {'code': 4, 'message': 'Application request limit reached'}})
        pub = get_publisher('facebook')
        with self.assertRaises(RateLimitError):
            pub.publish_text(_fake_credential(), 'hi')

    @patch('social_stats.publishers._graph_client.requests.request')
    def test_permission_denied_maps_to_typed_exception(self, m):
        m.return_value = _resp(403, {'error': {'code': 200, 'message': 'No permission'}})
        pub = get_publisher('facebook')
        with self.assertRaises(PermissionDeniedError):
            pub.publish_text(_fake_credential(), 'hi')

    # ── Config guards ────────────────────────────────────────────────────
    def test_missing_page_id_raises(self):
        pub = get_publisher('facebook')
        cred = _fake_credential(page_id='')
        with self.assertRaises(PublishError) as ctx:
            pub.publish_text(cred, 'hi')
        self.assertEqual(ctx.exception.code, 'missing_config')

    def test_empty_image_list_raises(self):
        pub = get_publisher('facebook')
        with self.assertRaises(PublishError) as ctx:
            pub.publish_image(_fake_credential(), 'caption', [])
        self.assertEqual(ctx.exception.code, 'missing_media')
