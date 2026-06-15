# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Celery wrapper for processing Meta + Google deletion callbacks.

The endpoint mints a row + returns 200 immediately (Meta requires this);
this task does the actual platform-credential revocation.
"""
from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, ignore_result=True, max_retries=3, default_retry_delay=60)
def process_platform_deletion_task(self, request_id: int):
    from .platform_compliance import process_platform_deletion
    try:
        result = process_platform_deletion(request_id)
        if result == 'failed':
            try: self.retry()
            except Exception: return
        return result
    except Exception as e:
        logger.exception('process_platform_deletion_task crashed: req=%s', request_id)
        try: self.retry(exc=e)
        except Exception: return
