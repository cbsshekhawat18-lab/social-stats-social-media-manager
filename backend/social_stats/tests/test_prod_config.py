"""
Production configuration guard.

With DEBUG=False, settings.py must refuse to load when SECRET_KEY is weak,
FIELD_ENCRYPTION_KEYS is empty, ALLOWED_HOSTS contains '*', or the webhook
secrets are missing (unless ALLOW_UNSIGNED_WEBHOOKS=True).
"""
import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase

from dashboard.prod_checks import production_config_errors

BACKEND_DIR = Path(__file__).resolve().parents[2]
GOOD_SECRET = 'k' * 20 + 'Zx9-' * 10          # 60 chars, no placeholder text
GOOD_FERNET = 'q2C5V3Rr0p3Ww9mNNmP2Ke5k4N8W0vGgD9g1k3m5n7o='


def _good(**overrides):
    kwargs = dict(
        secret_key=GOOD_SECRET,
        field_encryption_keys=GOOD_FERNET,
        allowed_hosts=['app.example.com'],
        meta_webhook_secret='meta-secret',
        whatsapp_webhook_secret='wa-secret',
        allow_unsigned_webhooks=False,
    )
    kwargs.update(overrides)
    return production_config_errors(**kwargs)


class ProductionConfigErrorsTests(SimpleTestCase):
    def test_good_config_passes(self):
        self.assertEqual(_good(), [])

    def test_missing_secret_key(self):
        self.assertTrue(any('SECRET_KEY is not set' in e for e in _good(secret_key='')))

    def test_short_secret_key(self):
        self.assertTrue(any('at least 50' in e for e in _good(secret_key='x' * 49)))

    def test_placeholder_secret_keys(self):
        for key in ('django-insecure-' + 'a' * 50, 'change-me-' + 'b' * 50,
                    'CHANGE-ME-' + 'c' * 50):
            with self.subTest(key=key[:16]):
                self.assertTrue(any('placeholder' in e for e in _good(secret_key=key)))

    def test_empty_field_encryption_keys(self):
        for value in ('', '  ', ' , '):
            with self.subTest(value=value):
                self.assertTrue(any('FIELD_ENCRYPTION_KEYS' in e
                                    for e in _good(field_encryption_keys=value)))

    def test_wildcard_allowed_hosts(self):
        self.assertTrue(any("'*'" in e for e in _good(allowed_hosts=['app.example.com', '*'])))

    def test_webhook_secrets_required(self):
        errors = _good(meta_webhook_secret='', whatsapp_webhook_secret='')
        self.assertTrue(any('META_WEBHOOK_SECRET' in e for e in errors))
        self.assertTrue(any('WHATSAPP_WEBHOOK_SECRET' in e for e in errors))

    def test_allow_unsigned_webhooks_skips_webhook_checks_only(self):
        self.assertEqual(
            _good(meta_webhook_secret='', whatsapp_webhook_secret='',
                  allow_unsigned_webhooks=True),
            [],
        )
        self.assertNotEqual(
            _good(secret_key='', meta_webhook_secret='', allow_unsigned_webhooks=True), [],
        )


class SettingsGuardSubprocessTests(SimpleTestCase):
    """Load the real settings module in a fresh interpreter (not under
    `manage.py test`, so the guard is active)."""

    SCRIPT = (
        'import django; django.setup(); '
        'from django.conf import settings; print("DEBUG", settings.DEBUG)'
    )

    def _load_settings(self, **env_overrides):
        env = dict(os.environ)
        env.update({
            'DJANGO_SETTINGS_MODULE': 'dashboard.settings',
            'DEBUG': 'False',
            'SECRET_KEY': GOOD_SECRET,
            'FIELD_ENCRYPTION_KEYS': GOOD_FERNET,
            'ALLOWED_HOSTS': 'app.example.com',
            'META_WEBHOOK_SECRET': 'meta-secret',
            'WHATSAPP_WEBHOOK_SECRET': 'wa-secret',
            'ALLOW_UNSIGNED_WEBHOOKS': 'False',
        })
        env.update(env_overrides)
        return subprocess.run(
            [sys.executable, '-c', self.SCRIPT],
            cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=120,
        )

    def test_unsafe_config_refuses_to_start(self):
        proc = self._load_settings(SECRET_KEY='django-insecure-change-in-production',
                                   ALLOWED_HOSTS='*', FIELD_ENCRYPTION_KEYS='')
        self.assertNotEqual(proc.returncode, 0, proc.stdout)
        self.assertIn('ImproperlyConfigured', proc.stderr)
        self.assertIn('SECRET_KEY', proc.stderr)
        self.assertIn('FIELD_ENCRYPTION_KEYS', proc.stderr)
        self.assertIn('ALLOWED_HOSTS', proc.stderr)

    def test_safe_config_starts(self):
        proc = self._load_settings()
        self.assertEqual(proc.returncode, 0, proc.stderr[-2000:])
        self.assertIn('DEBUG False', proc.stdout)

    def test_blank_debug_counts_as_production(self):
        proc = self._load_settings(DEBUG='', SECRET_KEY='short')
        self.assertNotEqual(proc.returncode, 0, proc.stdout)
        self.assertIn('ImproperlyConfigured', proc.stderr)


class CacheConfigSubprocessTests(SettingsGuardSubprocessTests):
    """Production must use the shared Redis cache; LocMem only in DEBUG."""

    SCRIPT = (
        'import django; django.setup(); from django.conf import settings; '
        'c = settings.CACHES["default"]; print(c["BACKEND"], c.get("LOCATION"))'
    )

    def test_production_uses_redis(self):
        proc = self._load_settings(REDIS_CACHE_URL='redis://cache.internal:6379/5')
        self.assertEqual(proc.returncode, 0, proc.stderr[-2000:])
        self.assertIn('RedisCache redis://cache.internal:6379/5', proc.stdout)

    def test_production_defaults_to_local_redis(self):
        proc = self._load_settings(REDIS_CACHE_URL='')
        self.assertEqual(proc.returncode, 0, proc.stderr[-2000:])
        self.assertIn('RedisCache redis://localhost:6379/2', proc.stdout)

    def test_debug_without_url_uses_locmem(self):
        proc = self._load_settings(DEBUG='True', REDIS_CACHE_URL='')
        self.assertEqual(proc.returncode, 0, proc.stderr[-2000:])
        self.assertIn('LocMemCache', proc.stdout)

    # The parent's guard tests are not re-run here.
    test_unsafe_config_refuses_to_start = None
    test_safe_config_starts = None
    test_blank_debug_counts_as_production = None
