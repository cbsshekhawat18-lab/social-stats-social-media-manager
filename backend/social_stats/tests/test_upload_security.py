"""
Upload validation regression tests.

Uploads are typed from their content (Pillow / container magic bytes), never
from the client's Content-Type or filename. SVG, HTML and polyglots are
rejected; the stored extension always matches the detected type, because
that is what the web server uses to pick the Content-Type it serves.
"""
import io
import os
import uuid

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from social_stats.models import Client, MediaAsset, UserProfile
from social_stats.security.uploads import (
    sniff_upload,
    validate_image_upload,
    validate_media_upload,
)
from social_stats.serializers import ClientSerializer

from .utils import TempMediaRootMixin


# ── Fixtures ────────────────────────────────────────────────────────────────
def _image_bytes(fmt='PNG', size=(8, 8)):
    buf = io.BytesIO()
    Image.new('RGB', size, (200, 30, 30)).save(buf, format=fmt)
    return buf.getvalue()


MP4_BYTES = b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom' + b'\x00' * 512
MOV_BYTES = b'\x00\x00\x00\x14ftypqt  \x00\x00\x02\x00qt  ' + b'\x00' * 512
WEBM_BYTES = (
    b'\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04'
    b'\x42\xf3\x81\x08\x42\x82\x84webm\x42\x87\x81\x04\x42\x85\x81\x02' + b'\x00' * 256
)
MKV_BYTES = WEBM_BYTES.replace(b'\x42\x82\x84webm', b'\x42\x82\x88matroska')
HEIC_BYTES = b'\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic' + b'\x00' * 256
PDF_BYTES = b'%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n'

SVG_BYTES = (
    b'<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">'
    b'<script>alert(document.domain)</script></svg>'
)
HTML_BYTES = b'<!DOCTYPE html><html><body><script>alert(1)</script></body></html>'
GIF_HTML_POLYGLOT = b'GIF89a/*<script>alert(1)</script>*/' + _image_bytes('GIF')[6:]


def _upload(name, content, content_type='application/octet-stream'):
    return SimpleUploadedFile(name, content, content_type=content_type)


def _client(label='up'):
    return Client.objects.create(name=label, company=label.title(),
                                 email=f'{label}-{uuid.uuid4().hex[:8]}@x.test')


def _client_user(client):
    u = User.objects.create_user(username=f'u-{uuid.uuid4().hex[:12]}',
                                 email=f'{uuid.uuid4().hex[:6]}@x.test', password='x')
    UserProfile.objects.create(user=u, role='client', client=client)
    return u


# ── Detection ───────────────────────────────────────────────────────────────
class SniffTests(TestCase):
    def test_allowed_types_detected_from_content(self):
        cases = [
            ('a.png', _image_bytes('PNG'), 'image/png'),
            ('a.jpg', _image_bytes('JPEG'), 'image/jpeg'),
            ('a.gif', _image_bytes('GIF'), 'image/gif'),
            ('a.webp', _image_bytes('WEBP'), 'image/webp'),
            ('a.mp4', MP4_BYTES, 'video/mp4'),
            ('a.mov', MOV_BYTES, 'video/quicktime'),
            ('a.webm', WEBM_BYTES, 'video/webm'),
            ('a.pdf', PDF_BYTES, 'application/pdf'),
        ]
        for name, data, expected in cases:
            with self.subTest(name=name):
                self.assertEqual(sniff_upload(_upload(name, data)).mime, expected)

    def test_client_content_type_and_extension_are_ignored(self):
        detected = sniff_upload(_upload('photo.mp4', _image_bytes('PNG'), 'video/mp4'))
        self.assertEqual(detected.mime, 'image/png')

    def test_rejects_svg_even_when_labelled_as_png(self):
        with self.assertRaises(ValidationError):
            sniff_upload(_upload('logo.png', SVG_BYTES, 'image/png'))

    def test_rejects_html_even_when_labelled_as_jpeg(self):
        with self.assertRaises(ValidationError):
            sniff_upload(_upload('pic.jpg', HTML_BYTES, 'image/jpeg'))

    def test_rejects_gif_html_polyglot(self):
        with self.assertRaises(ValidationError):
            sniff_upload(_upload('pic.gif', GIF_HTML_POLYGLOT, 'image/gif'))

    def test_rejects_types_outside_the_allow_list(self):
        cases = [
            ('a.bmp', _image_bytes('BMP')),
            ('a.tiff', _image_bytes('TIFF')),
            ('a.mkv', MKV_BYTES),
            ('a.heic', HEIC_BYTES),
            ('a.txt', b'just some text'),
            ('a.exe', b'MZ\x90\x00' + b'\x00' * 64),
            ('empty.png', b''),
        ]
        for name, data in cases:
            with self.subTest(name=name), self.assertRaises(ValidationError):
                sniff_upload(_upload(name, data))

    @override_settings(MEDIA_MAX_UPLOAD_MB=1)
    def test_size_cap_from_settings(self):
        big = MP4_BYTES + b'\x00' * (1024 * 1024)
        with self.assertRaisesMessage(ValidationError, 'max 1 MB'):
            validate_media_upload(_upload('big.mp4', big))
        validate_media_upload(_upload('small.mp4', MP4_BYTES))  # under the cap


class ImageFieldValidatorTests(TestCase):
    def test_accepts_real_image(self):
        validate_image_upload(_upload('logo.png', _image_bytes('PNG')))

    def test_rejects_non_image_allowed_types(self):
        for name, data in (('doc.pdf', PDF_BYTES), ('clip.mp4', MP4_BYTES)):
            with self.subTest(name=name), self.assertRaises(ValidationError):
                validate_image_upload(_upload(name, data))

    def test_rejects_svg(self):
        with self.assertRaises(ValidationError):
            validate_image_upload(_upload('logo.svg', SVG_BYTES, 'image/svg+xml'))

    def test_rejects_valid_image_with_html_extension(self):
        # A real PNG named .html would be served as text/html by nginx.
        with self.assertRaises(ValidationError):
            validate_image_upload(_upload('logo.html', _image_bytes('PNG')))

    def test_client_serializer_rejects_svg_logo(self):
        s = ClientSerializer(data={
            'name': 'n', 'company': 'c', 'email': 'svg@x.test',
            'logo': _upload('logo.svg', SVG_BYTES, 'image/svg+xml'),
        })
        self.assertFalse(s.is_valid())
        self.assertIn('logo', s.errors)

    def test_client_serializer_rejects_png_named_html(self):
        s = ClientSerializer(data={
            'name': 'n', 'company': 'c', 'email': 'html@x.test',
            'profile_image': _upload('x.html', _image_bytes('PNG'), 'image/png'),
        })
        self.assertFalse(s.is_valid())
        self.assertIn('profile_image', s.errors)

    def test_model_field_validators_wired(self):
        for model, field in ((Client, 'logo'), (Client, 'profile_image'), (UserProfile, 'avatar')):
            with self.subTest(field=field):
                validators = model._meta.get_field(field).validators
                self.assertIn(validate_image_upload, validators)


# ── End-to-end through the API ──────────────────────────────────────────────
class MediaUploadApiTests(TempMediaRootMixin, TestCase):
    def setUp(self):
        self.client_obj = _client()
        self.api = APIClient()
        self.api.force_authenticate(_client_user(self.client_obj))

    def test_composer_upload_rejects_svg(self):
        res = self.api.post('/api/composer/media/',
                            {'file': _upload('x.png', SVG_BYTES, 'image/png')},
                            format='multipart')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertFalse(MediaAsset.objects.filter(client=self.client_obj).exists())

    def test_composer_upload_rejects_html(self):
        res = self.api.post('/api/composer/media/',
                            {'file': _upload('x.html', HTML_BYTES, 'text/html')},
                            format='multipart')
        self.assertEqual(res.status_code, 400, res.content)

    def test_composer_upload_stores_detected_type_and_extension(self):
        res = self.api.post('/api/composer/media/',
                            {'file': _upload('evil.html', _image_bytes('PNG'), 'text/html')},
                            format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        asset = MediaAsset.objects.get(client=self.client_obj)
        self.assertEqual(asset.mime_type, 'image/png')
        self.assertEqual(os.path.splitext(asset.file.name)[1], '.png')

    def test_bulk_upload_reports_rejected_files(self):
        res = self.api.post('/api/composer/media/bulk_upload/', {
            'files': [_upload('ok.jpg', _image_bytes('JPEG'), 'image/jpeg'),
                      _upload('bad.svg', SVG_BYTES, 'image/svg+xml')],
        }, format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(res.data['created']), 1)
        self.assertEqual([e['file'] for e in res.data['errors']], ['bad.svg'])

    def test_video_upload_rejects_html_named_mp4(self):
        res = self.api.post('/api/video/upload/',
                            {'file': _upload('x.mp4', HTML_BYTES, 'video/mp4')},
                            format='multipart')
        self.assertEqual(res.status_code, 400, res.content)

    def test_video_upload_accepts_mp4(self):
        res = self.api.post('/api/video/upload/',
                            {'file': _upload('clip.mp4', MP4_BYTES, 'video/mp4')},
                            format='multipart')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(MediaAsset.objects.get(client=self.client_obj).mime_type, 'video/mp4')


class AvatarUploadApiTests(TempMediaRootMixin, TestCase):
    def setUp(self):
        self.user = _client_user(_client('av'))
        self.user.first_name = 'A'
        self.user.save()
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_svg_avatar_rejected(self):
        res = self.api.patch('/api/profile/', {
            'first_name': 'A',
            'avatar': _upload('me.svg', SVG_BYTES, 'image/svg+xml'),
        }, format='multipart')
        self.assertEqual(res.status_code, 400, res.content)
        self.user.profile.refresh_from_db()
        self.assertFalse(self.user.profile.avatar)

    def test_png_avatar_accepted(self):
        res = self.api.patch('/api/profile/', {
            'first_name': 'A',
            'avatar': _upload('me.png', _image_bytes('PNG'), 'image/png'),
        }, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        self.user.profile.refresh_from_db()
        self.assertTrue(self.user.profile.avatar.name.endswith('.png'))
