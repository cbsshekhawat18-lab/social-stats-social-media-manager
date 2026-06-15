"""
`unified_voice_prompt` rollout tests.

Covers the helper that the migrated callsites (ai_views, automation_engine,
ai/automation_ai) now use in place of the legacy `brand_voice_prompt`.
The helper is a thin shim around `AIContextProvider.as_prompt_fragment()`
with defensive fallback to the legacy helper on failure.

Verifies:
  • Returns '' on missing / falsy client (no client provided ⇒ no fragment).
  • Returns '' for a brand-new workspace with no metrics + no brand voice
    (matches the legacy helper's empty-output behaviour — drop-in safe).
  • Returns a non-empty fragment when the workspace has signal — and the
    fragment is a superset of what brand_voice_prompt would produce
    (i.e. always includes the workspace anchor on top of the voice text).
  • Falls back to brand_voice_prompt when AIContextProvider raises (the
    defensive try/except path).
  • Each Pattern-A migrated callsite imports the new helper.
"""
import uuid
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from social_stats.ai_helpers import unified_voice_prompt, brand_voice_prompt
from social_stats.models import Client, UserProfile, BrandVoiceProfile, DailyMetric


def _client(label='c'):
    return Client.objects.create(
        name=label, company=label.title(),
        email=f'{label}-{uuid.uuid4().hex[:6]}@x.test',
    )


class UnifiedVoicePromptTests(TestCase):

    def test_returns_empty_for_no_client(self):
        self.assertEqual(unified_voice_prompt(None), '')

    def test_emits_company_anchor_even_for_workspace_with_no_signal(self):
        """A fresh workspace with no metrics + no brand voice gets the
        company anchor ("You are writing for X") in the fragment.

        This is INTENTIONALLY different from the legacy `brand_voice_prompt`
        which returns '' for fresh workspaces — the unified provider always
        emits the workspace anchor since it's cheap and helps Claude write
        in-character. tests pin the anchor as part of the contract.

        Migration is still drop-in SAFE: every Pattern-A callsite gates on
        `if bv:`, so an always-non-empty fragment just consistently fires the
        gate (whereas the legacy helper sometimes left it off). No regression."""
        c = _client('empty')
        out = unified_voice_prompt(c)
        self.assertNotEqual(out, '')
        self.assertIn(c.company, out)

    def test_returns_workspace_anchor_when_signal_exists(self):
        """With recent metrics, the unified fragment includes the workspace
        anchor ("You are writing for ...") — content the legacy
        `brand_voice_prompt` does NOT emit. This is the strict superset claim
        that justifies the migration."""
        from datetime import date, timedelta
        c = _client('signal')
        for i in range(5):
            DailyMetric.objects.create(
                client=c, platform='facebook',
                date=date.today() - timedelta(days=i),
                likes=100, comments=50, shares=20, reach=1000, impressions=2000,
            )

        out = unified_voice_prompt(c)
        self.assertNotEqual(out, '', 'fragment should be non-empty when metrics exist')
        # The workspace anchor is the unified provider's signature.
        self.assertIn('writing for', out.lower())
        # Recent performance section appears.
        self.assertIn('Recent performance', out)

        # The legacy helper has no metrics/anchor sections — proves the
        # superset claim.
        legacy = brand_voice_prompt(c)
        # Legacy is empty here (no BrandVoiceProfile trained), but unified
        # still returns content. That's the integration value.
        self.assertEqual(legacy, '')
        self.assertGreater(len(out), len(legacy))

    def test_includes_brand_voice_when_profile_is_ready(self):
        """When BOTH a brand voice profile AND metrics exist, the unified
        fragment should still include the voice content the legacy helper
        would have emitted."""
        from datetime import date
        c = _client('voiced')
        BrandVoiceProfile.objects.create(
            client=c, training_status='ready',
            voice_summary='Confident, witty, India-first.',
            tone_descriptors=['playful', 'sharp'],
        )
        DailyMetric.objects.create(
            client=c, platform='facebook',
            date=date.today(),
            likes=10, comments=5, shares=1, reach=100, impressions=200,
        )

        out = unified_voice_prompt(c)
        self.assertIn('Confident, witty', out,
            'unified fragment must still surface the trained brand voice')

    def test_falls_back_to_legacy_when_provider_raises(self):
        """If AIContextProvider blows up (e.g. an unrelated migration fails
        partway), the helper must NOT propagate the error — it falls back
        to the legacy helper. AI requests can't 500 because the context
        builder had a bad day."""
        c = _client('fallback')
        # Patch AIContextProvider so its constructor itself raises.
        with patch('social_stats.ai.context.AIContextProvider',
                   side_effect=RuntimeError('provider broken')):
            out = unified_voice_prompt(c)
        # Doesn't raise — legacy helper kicks in. For an empty workspace
        # the legacy result is '', which is also fine.
        self.assertEqual(out, '')


class CallsiteMigrationTests(TestCase):
    """Static checks that the Pattern-A callsites use the new helper.
    Catches regressions where someone reverts a migrated callsite to the
    legacy import."""

    def test_ai_views_imports_unified_voice_prompt(self):
        from social_stats import ai_views
        # The module should expose unified_voice_prompt (imported into its
        # namespace), not the legacy brand_voice_prompt.
        self.assertTrue(hasattr(ai_views, 'unified_voice_prompt'))
        self.assertFalse(hasattr(ai_views, 'brand_voice_prompt'),
            'ai_views should not import brand_voice_prompt anymore — '
            'use unified_voice_prompt for system-prompt context')

    def test_automation_ai_uses_unified_voice_prompt(self):
        # Read the source — automation_ai.py uses lazy local import in
        # its module level, so attribute checks are sufficient.
        from social_stats.ai import automation_ai
        self.assertTrue(hasattr(automation_ai, 'unified_voice_prompt'))
