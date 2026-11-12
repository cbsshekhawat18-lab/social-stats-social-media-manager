"""Shared test helpers."""
import shutil
import tempfile

from django.test import override_settings


class TempMediaRootMixin:
    """Point MEDIA_ROOT at a throwaway directory for the whole TestCase class
    so tests that save files never write into backend/media/.

    Put it first in the bases: ``class FooTests(TempMediaRootMixin, TestCase)``.
    """

    @classmethod
    def setUpClass(cls):
        cls._temp_media_root = tempfile.mkdtemp(prefix='socialstats-test-media-')
        cls._media_root_override = override_settings(MEDIA_ROOT=cls._temp_media_root)
        cls._media_root_override.enable()
        try:
            super().setUpClass()
        except Exception:
            cls._media_root_override.disable()
            shutil.rmtree(cls._temp_media_root, ignore_errors=True)
            raise

    @classmethod
    def tearDownClass(cls):
        try:
            super().tearDownClass()
        finally:
            cls._media_root_override.disable()
            shutil.rmtree(cls._temp_media_root, ignore_errors=True)
