"""
Video Studio tests.

moviepy is heavy + needs ffmpeg, so we patch the lazy import to either:
  - return a fake VideoFileClip class (subclasses MagicMock with the methods we hit)
  - raise ImportError to exercise the 503 path
"""
import io
import sys
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from social_stats.models import Client, MediaAsset, PlatformCredential, UserProfile
from social_stats.publishers import PublishResult


def _client_factory(label):
    return Client.objects.create(name=label, company=label.title(),
                                  email=f'{label}-{uuid.uuid4().hex[:8]}@x.test')


def _user_for(client_obj, role='client'):
    u = User.objects.create_user(
        username=f'u-{uuid.uuid4().hex[:12]}',
        email='u@x.test', password='x', is_active=True,
    )
    UserProfile.objects.create(user=u, role=role,
                                client=client_obj if role == 'client' else None)
    return u


def _api(user):
    a = APIClient()
    a.force_authenticate(user=user)
    return a


def _fake_clip(*, duration=5.0, size=(1920, 1080)):
    """Return a context-manager-friendly mock that mimics moviepy.VideoFileClip.
    `get_frame` returns None — thumbnail tests should mock Image.fromarray
    separately so we don't need numpy in the test environment."""
    clip = MagicMock()
    clip.duration = duration
    clip.size = size
    clip.w, clip.h = size
    clip.__enter__.return_value = clip
    clip.__exit__.return_value = False
    sub = MagicMock()
    sub.write_videofile.return_value = None
    clip.subclip.return_value = sub
    clip.get_frame.return_value = None
    return clip


def _seed_video_asset(client, *, duration=5.0):
    """Create a MediaAsset with a small fake .mp4 payload on disk."""
    fake_bytes = b'\x00\x00\x00\x14ftypmp42\x00\x00\x00\x00mp42isom' + b'\x00' * 256
    f = SimpleUploadedFile('clip.mp4', fake_bytes, content_type='video/mp4')
    asset = MediaAsset(
        client=client, mime_type='video/mp4',
        file_size=len(fake_bytes),
        duration_seconds=duration,
        width=1920, height=1080,
    )
    asset.file.save('clip.mp4', ContentFile(fake_bytes), save=False)
    asset.save()
    return asset


class UploadTests(TestCase):
    def setUp(self):
        self.c = _client_factory('vid')
        self.u = _user_for(self.c)
        self.api = _api(self.u)

    def test_multipart_upload_creates_asset(self):
        f = SimpleUploadedFile('vid.mp4', b'\x00' * 1024, content_type='video/mp4')
        res = self.api.post('/api/video/upload/', {'file': f}, format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(MediaAsset.objects.filter(client=self.c).exists())

    def test_url_or_file_required(self):
        res = self.api.post('/api/video/upload/', {}, format='json')
        self.assertEqual(res.status_code, 400)


class MoviepyMissingTests(TestCase):
    """Exercise the 503 fallback when moviepy isn't installed."""
    def setUp(self):
        self.c = _client_factory('mvy')
        self.u = _user_for(self.c)
        self.api = _api(self.u)
        self.asset = _seed_video_asset(self.c)

    def test_trim_returns_503_without_moviepy(self):
        # Force the lazy import to raise ImportError
        with patch.dict(sys.modules, {'moviepy.editor': None}):
            # The dict-patch forces ImportError on `from moviepy.editor import VideoFileClip`
            res = self.api.post('/api/video/trim/', {
                'asset_id': self.asset.id, 'start_seconds': 0, 'end_seconds': 1,
            }, format='json')
        self.assertEqual(res.status_code, 503)
        self.assertIn('moviepy', res.data['error'])


class TrimTests(TestCase):
    def setUp(self):
        self.c = _client_factory('trim')
        self.u = _user_for(self.c)
        self.api = _api(self.u)
        self.asset = _seed_video_asset(self.c, duration=10.0)

    @patch('social_stats.video_views._moviepy_or_503')
    def test_trim_creates_derived_asset(self, mock_lazy):
        # Build a fake VideoFileClip class whose constructor returns our fake clip
        clip = _fake_clip(duration=10.0)
        VideoFileClipFake = MagicMock(return_value=clip)
        mock_lazy.return_value = (VideoFileClipFake, None)

        # Patch open() inside the trim view's `with open(out_path, 'rb')` so it
        # returns predictable bytes without writing real video.
        with patch('builtins.open', side_effect=mock_open_videos):
            res = self.api.post('/api/video/trim/', {
                'asset_id': self.asset.id, 'start_seconds': 1.0, 'end_seconds': 4.0,
            }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        clip.subclip.assert_called_once_with(1.0, 4.0)
        # New asset created with derived suffix
        new_asset = MediaAsset.objects.filter(client=self.c, alt_text__startswith='Derived from').first()
        self.assertIsNotNone(new_asset)
        self.assertAlmostEqual(new_asset.duration_seconds, 3.0, places=1)

    @patch('social_stats.video_views._moviepy_or_503')
    def test_trim_invalid_range(self, mock_lazy):
        # Even though moviepy returns OK, the validation should reject end <= start
        mock_lazy.return_value = (MagicMock(return_value=_fake_clip()), None)
        res = self.api.post('/api/video/trim/', {
            'asset_id': self.asset.id, 'start_seconds': 5.0, 'end_seconds': 5.0,
        }, format='json')
        self.assertEqual(res.status_code, 400)


class ResizeTests(TestCase):
    def setUp(self):
        self.c = _client_factory('rs')
        self.u = _user_for(self.c)
        self.api = _api(self.u)
        self.asset = _seed_video_asset(self.c)

    @patch('social_stats.video_views._moviepy_or_503')
    def test_resize_to_9_16(self, mock_lazy):
        clip = _fake_clip(size=(1920, 1080))
        # clip.crop() returns the same clip (mock); .write_videofile is a no-op
        clip.crop.return_value = clip
        VideoFileClipFake = MagicMock(return_value=clip)
        mock_lazy.return_value = (VideoFileClipFake, None)

        with patch('builtins.open', side_effect=mock_open_videos):
            res = self.api.post('/api/video/resize/', {
                'asset_id': self.asset.id, 'target_aspect': '9:16',
            }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        new_asset = MediaAsset.objects.filter(client=self.c, alt_text__startswith='Derived from').first()
        # 1920×1080 → 9:16 crop should be 608×1080 (rounded to even)
        self.assertEqual((new_asset.width, new_asset.height), (608, 1080))

    def test_invalid_aspect_400(self):
        res = self.api.post('/api/video/resize/', {
            'asset_id': self.asset.id, 'target_aspect': '7:5',
        }, format='json')
        self.assertEqual(res.status_code, 400)


class ThumbnailTests(TestCase):
    def setUp(self):
        self.c = _client_factory('th')
        self.u = _user_for(self.c)
        self.api = _api(self.u)
        self.asset = _seed_video_asset(self.c, duration=10.0)

    @patch('social_stats.video_views._moviepy_or_503')
    @patch('social_stats.video_views.Image')
    def test_extract_thumbnail_creates_image_asset(self, mock_Image, mock_lazy):
        clip = _fake_clip(duration=10.0)
        VideoFileClipFake = MagicMock(return_value=clip)
        mock_lazy.return_value = (VideoFileClipFake, None)

        # Mock the PIL pipeline so we don't depend on numpy
        fake_img = MagicMock()
        fake_img.size = (640, 360)
        def _save(buf, format=None, quality=None):
            buf.write(b'\x00' * 256)
        fake_img.save.side_effect = _save
        mock_Image.fromarray.return_value = fake_img

        res = self.api.post('/api/video/extract-thumbnail/', {
            'asset_id': self.asset.id, 'time_seconds': 3.5,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        clip.get_frame.assert_called_once_with(3.5)
        mock_Image.fromarray.assert_called_once()
        new_asset = MediaAsset.objects.get(client=self.c, mime_type='image/jpeg')
        self.assertEqual((new_asset.width, new_asset.height), (640, 360))


class CaptionsTests(TestCase):
    def setUp(self):
        self.c = _client_factory('cap')
        self.u = _user_for(self.c)
        self.api = _api(self.u)
        self.asset = _seed_video_asset(self.c)

    def test_returns_501_without_whisper_key(self):
        res = self.api.post('/api/video/add-captions/', {
            'asset_id': self.asset.id,
        }, format='json')
        self.assertEqual(res.status_code, 501)
        self.assertEqual(res.data['error'], 'captions_not_configured')


class YouTubeUploadTests(TestCase):
    def setUp(self):
        self.c = _client_factory('yt')
        self.u = _user_for(self.c)
        self.api = _api(self.u)
        self.asset = _seed_video_asset(self.c)
        PlatformCredential.objects.create(
            client=self.c, platform='youtube',
            access_token='tok', refresh_token='r',
            channel_id='UCxxx', is_active=True,
        )

    def test_calls_publisher_publish_video(self):
        with patch('social_stats.publishers.youtube.YouTubePublisher.publish_video',
                   return_value=PublishResult(success=True, platform_post_id='VID-1',
                                              platform_url='https://youtu.be/VID-1')) as mock_pub:
            res = self.api.post('/api/video/youtube-upload/', {
                'asset_id': self.asset.id, 'title': 'My Video',
                'description': 'desc here', 'privacy': 'unlisted',
            }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['platform_post_id'], 'VID-1')
        self.assertEqual(res.data['platform_url'], 'https://youtu.be/VID-1')
        # Publisher invoked with our presigned/local URL + title kwarg
        args, kwargs = mock_pub.call_args
        self.assertEqual(kwargs.get('title'), 'My Video')

    def test_no_credential_returns_400(self):
        PlatformCredential.objects.filter(client=self.c, platform='youtube').delete()
        res = self.api.post('/api/video/youtube-upload/', {
            'asset_id': self.asset.id, 'title': 't',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('YouTube credential', res.data['error'])

    def test_non_video_asset_400(self):
        # Replace mime type
        self.asset.mime_type = 'image/jpeg'
        self.asset.save(update_fields=['mime_type'])
        res = self.api.post('/api/video/youtube-upload/', {
            'asset_id': self.asset.id, 'title': 't',
        }, format='json')
        self.assertEqual(res.status_code, 400)


class TenantIsolationTests(TestCase):
    def test_cannot_operate_on_other_tenants_asset(self):
        a = _client_factory('aa')
        b = _client_factory('bb')
        b_asset = _seed_video_asset(b)

        a_user = _user_for(a)
        api = _api(a_user)
        res = api.post('/api/video/extract-thumbnail/', {
            'asset_id': b_asset.id, 'time_seconds': 1.0,
        }, format='json')
        # 404 — asset not found within client `a`
        self.assertEqual(res.status_code, 404)


# ── Helpers ──────────────────────────────────────────────────────────────────
def mock_open_videos(*args, **kwargs):
    """
    Return a mock file handle whose .read() yields a few bytes. Used to bypass
    real video write in the trim/resize tests.
    """
    fake = MagicMock()
    fake.read.return_value = b'\x00' * 1024
    fake.__enter__.return_value = fake
    fake.__exit__.return_value = False
    return fake
