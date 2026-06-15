"""
Unit tests for YouTubePublisher, LinkedInPublisher, GMBPublisher.

The HTTP layers are mocked; we verify URL/method/body construction, the
multi-step upload/init flows, error mapping, and config guards.
"""
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase
from django.utils import timezone

from social_stats.publishers import (
    get_publisher, PublishError, TokenExpiredError, RateLimitError,
    PermissionDeniedError,
)


def _resp(status=200, json_body=None, *, headers=None, text=''):
    m = MagicMock()
    m.status_code = status
    m.headers = headers or {}
    m.json.return_value = json_body if json_body is not None else {}
    m.content = b'{}' if json_body is not None else b''
    m.text = text or ''
    m.iter_content.return_value = iter([])
    # Support `with requests.get(...) as src:` usage
    m.__enter__.return_value = m
    m.__exit__.return_value = False
    return m


def _yt_credential(**overrides):
    base = {
        'access_token':  'yt-access',
        'refresh_token': 'yt-refresh',
        'channel_id':    'UCxxxxxxxxxxxxxxxxxxxxxx',
        'channel_name':  'Test Channel',
        'expires_at':    timezone.now() + timedelta(hours=1),
        # GoogleClient looks at credential.manual_extras for OAuth client creds.
        # SimpleNamespace defaults to "no manual_extras" — that's fine because
        # we patch out the request so refresh never fires.
    }
    base.update(overrides)
    return SimpleNamespace(**base, save=lambda **kw: None)


def _li_credential(**overrides):
    base = {
        'access_token':      'li-access',
        'organization_id':   '12345678',
        'organization_name': 'Acme',
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def _gmb_credential(**overrides):
    base = {
        'access_token':     'gmb-access',
        'refresh_token':    'gmb-refresh',
        'gmb_account_id':   '1112223334',
        'gmb_location_id':  '5556667778',
        'expires_at':       timezone.now() + timedelta(hours=1),
    }
    base.update(overrides)
    return SimpleNamespace(**base, save=lambda **kw: None)


# ══════════════════════════════════════════════════════════════════════
# YouTube
# ══════════════════════════════════════════════════════════════════════
class YouTubePublisherTests(SimpleTestCase):
    @patch('social_stats.publishers.youtube.os.remove', lambda *_: None)
    @patch('social_stats.publishers.youtube.requests.put')
    @patch('social_stats.publishers.youtube.requests.get')
    @patch('social_stats.publishers.youtube.requests.post')
    def test_publish_video_resumable_flow(self, mock_init, mock_get, mock_put):
        # Step 1 init returns Location header
        mock_init.return_value = _resp(200, {'ok': True}, headers={'Location': 'https://upload.example/abc'})
        # Step 2 download streams empty file
        mock_get.return_value = _resp(200, headers={})
        # Step 3 PUT returns final video metadata
        mock_put.return_value = _resp(200, {'id': 'VID-1', 'snippet': {'title': 'x'}})

        pub = get_publisher('youtube')
        result = pub.publish_video(_yt_credential(), 'description here', 'https://x/v.mp4')

        # Init call: correct URL, params, JSON body shape
        args, kwargs = mock_init.call_args
        self.assertEqual(kwargs['params']['uploadType'], 'resumable')
        self.assertEqual(kwargs['params']['part'], 'snippet,status')
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer yt-access')
        self.assertEqual(kwargs['json']['snippet']['description'], 'description here')
        self.assertEqual(kwargs['json']['status']['privacyStatus'], 'public')

        # PUT call: bytes upload to the Location URL
        self.assertEqual(mock_put.call_args.args[0], 'https://upload.example/abc')

        self.assertTrue(result.success)
        self.assertEqual(result.platform_post_id, 'VID-1')
        self.assertEqual(result.platform_url, 'https://www.youtube.com/watch?v=VID-1')

    @patch('social_stats.publishers.youtube.os.remove', lambda *_: None)
    @patch('social_stats.publishers.youtube.requests.put')
    @patch('social_stats.publishers.youtube.requests.get')
    @patch('social_stats.publishers.youtube.requests.post')
    def test_publish_reel_appends_shorts_marker(self, mock_init, mock_get, mock_put):
        mock_init.return_value = _resp(200, {}, headers={'Location': 'https://upload.example/r'})
        mock_get.return_value  = _resp(200)
        mock_put.return_value  = _resp(200, {'id': 'REEL-1'})

        pub = get_publisher('youtube')
        pub.publish_reel(_yt_credential(), 'https://x/v.mp4', 'morning vibes')

        # Description should contain #shorts
        desc = mock_init.call_args.kwargs['json']['snippet']['description']
        self.assertIn('#shorts', desc.lower())

    @patch('social_stats.publishers.youtube.requests.post')
    def test_init_failure_raises_typed_error(self, mock_init):
        # Simulate a 401 from the resumable init
        mock_init.return_value = _resp(401, {'error': {'message': 'Token expired', 'code': 401}})
        pub = get_publisher('youtube')
        with self.assertRaises(TokenExpiredError):
            pub.publish_video(_yt_credential(), 'x', 'https://x/v.mp4')

    @patch('social_stats.publishers._google_client.requests.request')
    def test_delete_post(self, m):
        m.return_value = _resp(204, None)
        pub = get_publisher('youtube')
        pub.delete_post(_yt_credential(), 'VID-1')
        kwargs = m.call_args.kwargs
        self.assertEqual(kwargs['method'], 'DELETE')
        self.assertEqual(kwargs['params']['id'], 'VID-1')

    @patch('social_stats.publishers._google_client.requests.request')
    def test_get_post_metrics(self, m):
        m.return_value = _resp(200, {'items': [{'id': 'V1'}]})
        pub = get_publisher('youtube')
        out = pub.get_post_metrics(_yt_credential(), 'V1')
        self.assertEqual(m.call_args.kwargs['method'], 'GET')
        self.assertEqual(m.call_args.kwargs['params']['id'], 'V1')
        self.assertIn('statistics', m.call_args.kwargs['params']['part'])
        self.assertEqual(out['items'][0]['id'], 'V1')

    @patch('social_stats.publishers._google_client.requests.request')
    def test_reply_to_comment(self, m):
        m.return_value = _resp(200, {'id': 'reply-1'})
        pub = get_publisher('youtube')
        result = pub.reply_to_comment(_yt_credential(), 'parent-comment', 'thanks!')
        kwargs = m.call_args.kwargs
        self.assertEqual(kwargs['json']['snippet']['parentId'], 'parent-comment')
        self.assertEqual(kwargs['json']['snippet']['textOriginal'], 'thanks!')
        self.assertEqual(result.platform_post_id, 'reply-1')

    def test_text_only_unsupported(self):
        pub = get_publisher('youtube')
        with self.assertRaises(PublishError) as ctx:
            pub.publish_text(_yt_credential(), 'words')
        self.assertFalse(ctx.exception.supported)

    def test_missing_channel_id_raises(self):
        pub = get_publisher('youtube')
        with self.assertRaises(PublishError) as ctx:
            pub.publish_video(_yt_credential(channel_id=''), 'x', 'https://x/v.mp4')
        self.assertEqual(ctx.exception.code, 'missing_config')


# ══════════════════════════════════════════════════════════════════════
# LinkedIn
# ══════════════════════════════════════════════════════════════════════
class LinkedInPublisherTests(SimpleTestCase):
    @patch('social_stats.publishers.linkedin.requests.request')
    def test_publish_text(self, m):
        m.return_value = _resp(201, {}, headers={'x-restli-id': 'urn:li:share:1'})
        pub = get_publisher('linkedin')
        result = pub.publish_text(_li_credential(), 'hello world')

        kwargs = m.call_args.kwargs
        self.assertEqual(kwargs['method'], 'POST')
        self.assertIn('/rest/posts', kwargs['url'])
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer li-access')
        self.assertEqual(kwargs['headers']['LinkedIn-Version'], '202404')
        self.assertEqual(kwargs['json']['author'], 'urn:li:organization:12345678')
        self.assertEqual(kwargs['json']['commentary'], 'hello world')
        self.assertEqual(kwargs['json']['lifecycleState'], 'PUBLISHED')

        self.assertTrue(result.success)
        self.assertEqual(result.platform_post_id, 'urn:li:share:1')

    @patch('social_stats.publishers.linkedin.requests.put')
    @patch('social_stats.publishers.linkedin.requests.get')
    @patch('social_stats.publishers.linkedin.requests.request')
    def test_publish_image_three_step(self, mock_request, mock_get, mock_put):
        # 1. initializeUpload → returns uploadUrl + image URN
        # 2. download bytes via requests.get
        # 3. PUT bytes to uploadUrl
        # 4. create post via requests.request
        init_resp = _resp(200, {
            'value': {
                'uploadUrl': 'https://upload.example/img',
                'image':     'urn:li:image:img-1',
            },
        })
        post_resp = _resp(201, {}, headers={'x-restli-id': 'urn:li:share:99'})
        mock_request.side_effect = [init_resp, post_resp]
        mock_get.return_value = _resp(200, headers={})
        # Mock the bytes download
        mock_get.return_value.content = b'\x89PNG...'
        mock_put.return_value = _resp(201, {})

        pub = get_publisher('linkedin')
        result = pub.publish_image(_li_credential(), 'pic caption', ['https://x/img.jpg'])

        # Post body should reference the image URN
        post_body = mock_request.call_args_list[1].kwargs['json']
        self.assertEqual(post_body['content']['media']['id'], 'urn:li:image:img-1')
        self.assertEqual(post_body['commentary'], 'pic caption')

        self.assertEqual(result.platform_post_id, 'urn:li:share:99')

    @patch('social_stats.publishers.linkedin.requests.put')
    @patch('social_stats.publishers.linkedin.requests.get')
    @patch('social_stats.publishers.linkedin.requests.request')
    def test_publish_carousel(self, mock_request, mock_get, mock_put):
        # 2 init calls + 1 post = 3 requests via .request
        init1 = _resp(200, {'value': {'uploadUrl': 'https://up/1', 'image': 'urn:li:image:1'}})
        init2 = _resp(200, {'value': {'uploadUrl': 'https://up/2', 'image': 'urn:li:image:2'}})
        post  = _resp(201, {}, headers={'x-restli-id': 'urn:li:share:carousel-1'})
        mock_request.side_effect = [init1, init2, post]
        mock_get.return_value  = _resp(200); mock_get.return_value.content = b'x'
        mock_put.return_value  = _resp(201)

        pub = get_publisher('linkedin')
        result = pub.publish_carousel(_li_credential(), 'multi',
                                      ['https://x/1.jpg', 'https://x/2.jpg'])

        # Post body uses multiImage with both URNs
        post_body = mock_request.call_args_list[2].kwargs['json']
        urns = [im['id'] for im in post_body['content']['multiImage']['images']]
        self.assertEqual(urns, ['urn:li:image:1', 'urn:li:image:2'])
        self.assertEqual(result.platform_post_id, 'urn:li:share:carousel-1')

    def test_carousel_too_few(self):
        pub = get_publisher('linkedin')
        with self.assertRaises(PublishError) as ctx:
            pub.publish_carousel(_li_credential(), 'x', ['https://x/1.jpg'])
        self.assertEqual(ctx.exception.code, 'missing_media')

    def test_story_unsupported(self):
        pub = get_publisher('linkedin')
        with self.assertRaises(PublishError) as ctx:
            pub.publish_story(_li_credential(), 'https://x/img.jpg')
        self.assertFalse(ctx.exception.supported)

    @patch('social_stats.publishers.linkedin.requests.request')
    def test_delete_post_url_encodes_urn(self, m):
        m.return_value = _resp(204)
        pub = get_publisher('linkedin')
        pub.delete_post(_li_credential(), 'urn:li:share:1')
        # URN colons should be percent-encoded into the URL
        self.assertIn('urn%3Ali%3Ashare%3A1', m.call_args.kwargs['url'])

    @patch('social_stats.publishers.linkedin.requests.request')
    def test_token_expired_maps(self, m):
        m.return_value = _resp(401, {'message': 'expired'})
        pub = get_publisher('linkedin')
        with self.assertRaises(TokenExpiredError):
            pub.publish_text(_li_credential(), 'hi')

    @patch('social_stats.publishers.linkedin.requests.request')
    def test_rate_limit_maps(self, m):
        m.return_value = _resp(429, {'message': 'too many'})
        pub = get_publisher('linkedin')
        with self.assertRaises(RateLimitError):
            pub.publish_text(_li_credential(), 'hi')

    def test_missing_org_id(self):
        pub = get_publisher('linkedin')
        with self.assertRaises(PublishError) as ctx:
            pub.publish_text(_li_credential(organization_id=''), 'hi')
        self.assertEqual(ctx.exception.code, 'missing_config')

    def test_author_urn_passes_through_full_urn(self):
        pub = get_publisher('linkedin')
        # internal helper test
        urn = pub._author_urn(_li_credential(organization_id='urn:li:organization:99'))
        self.assertEqual(urn, 'urn:li:organization:99')


# ══════════════════════════════════════════════════════════════════════
# GMB
# ══════════════════════════════════════════════════════════════════════
class GMBPublisherTests(SimpleTestCase):
    @patch('social_stats.publishers._google_client.requests.request')
    def test_publish_text_creates_local_post(self, m):
        m.return_value = _resp(200, {
            'name':      'accounts/1112223334/locations/5556667778/localPosts/abc',
            'searchUrl': 'https://posts.gle/abc',
        })
        pub = get_publisher('google_my_business')
        result = pub.publish_text(_gmb_credential(), 'hello business world',
                                   topic_type='STANDARD')

        kwargs = m.call_args.kwargs
        self.assertEqual(kwargs['method'], 'POST')
        self.assertIn('/accounts/1112223334/locations/5556667778/localPosts', kwargs['url'])
        self.assertEqual(kwargs['json']['summary'], 'hello business world')
        self.assertEqual(kwargs['json']['topicType'], 'STANDARD')
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer gmb-access')

        self.assertTrue(result.success)
        self.assertEqual(result.platform_post_id, 'accounts/1112223334/locations/5556667778/localPosts/abc')

    @patch('social_stats.publishers._google_client.requests.request')
    def test_publish_image_attaches_media(self, m):
        m.return_value = _resp(200, {'name': 'accounts/1/locations/2/localPosts/xyz'})
        pub = get_publisher('google_my_business')
        pub.publish_image(_gmb_credential(), 'caption', ['https://x/img.jpg'])
        body = m.call_args.kwargs['json']
        self.assertEqual(body['media'], [{'mediaFormat': 'PHOTO', 'sourceUrl': 'https://x/img.jpg'}])

    @patch('social_stats.publishers._google_client.requests.request')
    def test_publish_image_extras_warning(self, m):
        m.return_value = _resp(200, {'name': 'accounts/1/locations/2/localPosts/xyz'})
        pub = get_publisher('google_my_business')
        result = pub.publish_image(_gmb_credential(), 'caption',
                                    ['https://x/1.jpg', 'https://x/2.jpg'])
        # Only first image is used; extras dropped via warning
        body = m.call_args.kwargs['json']
        self.assertEqual(body['media'][0]['sourceUrl'], 'https://x/1.jpg')
        self.assertTrue(any('extras dropped' in w for w in result.warnings))

    @patch('social_stats.publishers._google_client.requests.request')
    def test_delete_post_uses_resource_path(self, m):
        m.return_value = _resp(204, None)
        pub = get_publisher('google_my_business')
        pub.delete_post(_gmb_credential(),
                        'accounts/1/locations/2/localPosts/xyz')
        self.assertEqual(m.call_args.kwargs['method'], 'DELETE')
        self.assertIn('/v4/accounts/1/locations/2/localPosts/xyz', m.call_args.kwargs['url'])

    @patch('social_stats.publishers.gmb.requests.put')
    def test_reply_to_review(self, mock_put):
        mock_put.return_value = _resp(200, {'comment': 'thx', 'updateTime': '2026-01-01'})
        pub = get_publisher('google_my_business')
        result = pub.reply_to_review(_gmb_credential(),
                                      'accounts/1/locations/2/reviews/r-9',
                                      'Thanks for the kind words!')
        kwargs = mock_put.call_args.kwargs
        self.assertEqual(kwargs['json']['comment'], 'Thanks for the kind words!')
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer gmb-access')
        self.assertIn('/reviews/r-9/reply', mock_put.call_args.args[0])
        self.assertTrue(result.success)

    def test_missing_account_id(self):
        pub = get_publisher('google_my_business')
        with self.assertRaises(PublishError) as ctx:
            pub.publish_text(_gmb_credential(gmb_account_id=''), 'x')
        self.assertEqual(ctx.exception.code, 'missing_config')

    def test_unsupported_methods(self):
        pub = get_publisher('google_my_business')
        for method, args in [
            (pub.publish_video,    (_gmb_credential(), 'x', 'https://x/v.mp4')),
            (pub.publish_carousel, (_gmb_credential(), 'x', ['https://x/1.jpg', 'https://x/2.jpg'])),
            (pub.publish_reel,     (_gmb_credential(), 'https://x/v.mp4', 'x')),
            (pub.publish_story,    (_gmb_credential(), 'https://x/v.mp4')),
        ]:
            with self.assertRaises(PublishError) as ctx:
                method(*args)
            self.assertFalse(ctx.exception.supported)
