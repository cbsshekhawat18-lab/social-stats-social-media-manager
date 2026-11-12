"""
Meta Graph API version + insights metrics.

- No module hard-codes a Graph/dialog version; everything follows
  settings.META_API_VERSION (default v24.0, env-overridable).
- The metric sync never asks for metrics Meta removed on all versions
  (page/post *_impressions_unique, IG media video_views / plays).
- One rejected metric doesn't blank the whole insights call.
"""
import re
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.test import SimpleTestCase, TestCase

from social_stats import tasks
from social_stats.models import Client, PlatformCredential

APP_DIR = Path(__file__).resolve().parents[1]
REMOVED_METRICS = {
    'page_impressions_unique', 'post_impressions_unique', 'page_daily_unfollows',
    'video_views', 'plays', 'impressions',
}


def _json(payload):
    resp = MagicMock()
    resp.json.return_value = payload
    return resp


class VersionTests(SimpleTestCase):
    def test_default_version(self):
        self.assertRegex(settings.META_API_VERSION, r'^v\d+\.\d+$')

    def test_no_hard_coded_versions_in_app_code(self):
        pattern = re.compile(r'facebook\.com/v\d+\.\d+')
        offenders = []
        for path in APP_DIR.rglob('*.py'):
            if 'tests' in path.parts or 'migrations' in path.parts:
                continue
            for n, line in enumerate(path.read_text().splitlines(), 1):
                if pattern.search(line):
                    offenders.append(f'{path.relative_to(APP_DIR)}:{n}')
        self.assertEqual(offenders, [])

    def test_modules_follow_the_setting(self):
        from social_stats import inbox_tasks, meta_ads_views, meta_capi, token_verifier
        from social_stats.publishers import _graph_client
        base = f'https://graph.facebook.com/{settings.META_API_VERSION}'
        for module in (tasks, inbox_tasks, meta_ads_views, meta_capi, _graph_client):
            with self.subTest(module=module.__name__):
                self.assertEqual(module.GRAPH_BASE, base)
        self.assertEqual(token_verifier.GRAPH_VERSION, settings.META_API_VERSION)


class GraphInsightsFallbackTests(SimpleTestCase):
    @patch('social_stats.tasks.requests.get')
    def test_rejected_batch_is_retried_per_metric(self, mock_get):
        def fake(url, params, timeout):
            metric = params['metric']
            if ',' in metric or metric == 'dead_metric':
                return _json({'error': {'code': 100, 'message': 'invalid metric'}})
            return _json({'data': [{'name': metric, 'values': [{'value': 1}]}]})
        mock_get.side_effect = fake

        out = tasks._graph_insights('https://g/x/insights', ['a', 'dead_metric', 'b'], {'access_token': 't'})
        self.assertEqual([d['name'] for d in out['data']], ['a', 'b'])
        self.assertEqual(mock_get.call_count, 4)  # batch + 3 singles

    @patch('social_stats.tasks.requests.get')
    def test_other_errors_return_empty(self, mock_get):
        mock_get.return_value = _json({'error': {'code': 190, 'message': 'expired token'}})
        self.assertEqual(tasks._graph_insights('https://g/x', ['a', 'b'], {}), {'data': []})
        self.assertEqual(mock_get.call_count, 1)


class SyncRequestsNoRemovedMetricsTests(TestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(name='m', company='M',
                                                email=f'm-{uuid.uuid4().hex[:6]}@x.test')

    def _record_metrics(self, mock_get, routes):
        requested = []

        def fake(url, params=None, timeout=None):
            params = params or {}
            if 'metric' in params:
                requested.extend(params['metric'].split(','))
                return _json({'data': []})
            for suffix, payload in routes.items():
                if url.endswith(suffix):
                    return _json(payload)
            return _json({})
        mock_get.side_effect = fake
        return requested

    @patch('social_stats.tasks.requests.get')
    def test_facebook_sync(self, mock_get):
        PlatformCredential.objects.create(client=self.client_obj, platform='facebook',
                                          access_token='tok', page_id='111', is_active=True)
        requested = self._record_metrics(mock_get, {'/111/posts': {'data': [{'id': '111_1'}]}})
        tasks.sync_facebook.apply(args=(self.client_obj.id,))
        self.assertIn('page_total_media_view_unique', requested)
        self.assertIn('post_total_media_view_unique', requested)
        self.assertFalse(REMOVED_METRICS & set(requested), requested)

    @patch('social_stats.tasks.requests.get')
    def test_instagram_sync(self, mock_get):
        PlatformCredential.objects.create(client=self.client_obj, platform='instagram',
                                          access_token='tok', instagram_account_id='222',
                                          is_active=True)
        requested = self._record_metrics(mock_get, {'/222/media': {'data': [
            {'id': 'm1', 'media_type': 'VIDEO'}, {'id': 'm2', 'media_type': 'REEL'},
            {'id': 'm3', 'media_type': 'IMAGE'},
        ]}})
        tasks.sync_instagram.apply(args=(self.client_obj.id,))
        self.assertIn('views', requested)
        self.assertFalse(REMOVED_METRICS & set(requested), requested)
