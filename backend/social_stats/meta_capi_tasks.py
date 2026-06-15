# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Celery wrappers for Meta Ads.

  • push_capi_lead(lead_id):       fired from the capture_lead handler
  • sync_active_ctwa_campaigns():  daily beat task — refreshes spend on every
                                    active CTWACampaign across all clients
"""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=120, ignore_result=True)
def push_capi_lead(self, lead_id: int):
    """Push a Lead event to Meta's Conversions API for the given lead.
    Retries up to 2x with 2-min backoff on transient errors.
    """
    from .models import Lead
    from .meta_capi import push_lead_event

    try:
        lead = Lead.objects.select_related('client', 'source_conversation').get(pk=lead_id)
    except Lead.DoesNotExist:
        logger.warning('push_capi_lead: lead#%s gone', lead_id)
        return

    result = push_lead_event(lead)
    if not result.get('sent') and 'request failed' in (result.get('reason') or ''):
        # Network blip — retry
        try:
            self.retry()
        except Exception:
            pass


@shared_task(ignore_result=True)
def sync_active_ctwa_campaigns():
    """Refresh spend on every active CTWACampaign. Each campaign is synced
    independently — one failure shouldn't take down the whole run.
    """
    from .models import CTWACampaign
    from .meta_ads_views import sync_campaign_spend

    active = CTWACampaign.objects.filter(is_active=True).select_related('client')
    total = active.count()
    successes = 0
    for camp in active.iterator(chunk_size=50):
        try:
            r = sync_campaign_spend(camp)
            if r.get('ok'):
                successes += 1
        except Exception as e:  # noqa: BLE001
            logger.warning('sync_active_ctwa_campaigns: %s failed: %s', camp, e)

    logger.info('sync_active_ctwa_campaigns: %s/%s synced', successes, total)
    return {'synced': successes, 'total': total}
