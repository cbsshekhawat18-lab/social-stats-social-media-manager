"""
demo_setup creates a superuser with the public password "demo". It must
refuse to run on a production-like configuration (DEBUG=False) unless the
operator explicitly opts in.
"""
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

DEMO_ADMIN = 'admin@demo.local'


class DemoSetupGuardTests(TestCase):
    def _run(self, *args):
        call_command('demo_setup', '--no-metrics', *args, stdout=StringIO())

    @override_settings(DEBUG=False)
    def test_refuses_when_debug_is_false(self):
        with self.assertRaisesMessage(CommandError, '--i-know-this-is-not-production'):
            self._run()
        self.assertFalse(User.objects.filter(username=DEMO_ADMIN).exists())

    @override_settings(DEBUG=False)
    def test_explicit_override_flag_allows_it(self):
        self._run('--i-know-this-is-not-production')
        self.assertTrue(User.objects.filter(username=DEMO_ADMIN, is_superuser=True).exists())

    @override_settings(DEBUG=True)
    def test_runs_in_debug(self):
        self._run()
        self.assertTrue(User.objects.filter(username=DEMO_ADMIN).exists())
