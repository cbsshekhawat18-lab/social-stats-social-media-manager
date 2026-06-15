# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
webhook delivery as a Celery task with exponential backoff.

The flow's `webhook` node calls `dispatch_webhook.delay(...)` and continues
immediately. This task does the actual HTTP, retries up to 4 times with
expanding backoff, and stamps a final success/failure row onto the
conversation's audit trail when retries are exhausted.
"""
from __future__ import annotations

import json
import logging

import requests
from celery import shared_task


logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    autoretry_for=(requests.RequestException, requests.Timeout, requests.ConnectionError),
    retry_backoff=True,        # 1s → 2s → 4s → 8s
    retry_backoff_max=60,
    retry_jitter=True,
    max_retries=4,
    ignore_result=True,
)
def dispatch_webhook(
    self,
    *, conversation_id: int, node_id: str,
    url: str, method: str,
    headers: dict, body: dict, timeout: int,
):
    """Fire the HTTP request; retry on transient errors. Append an audit step
    on the final outcome (success or exhausted-retries failure)."""
    method_u = (method or 'POST').upper()

    try:
        if method_u == 'GET':
            r = requests.get(url, params=body, headers=headers, timeout=timeout)
        else:
            r = requests.request(method_u, url, data=json.dumps(body),
                                 headers=headers, timeout=timeout)

        if r.status_code >= 500:
            # 5xx is retryable — raise to trigger autoretry
            raise requests.RequestException(f'http {r.status_code}')

        ok = r.status_code < 400
        _log(conversation_id, node_id, url, method_u, ok=ok, status=r.status_code)

    except (requests.RequestException, requests.Timeout, requests.ConnectionError):
        # Will autoretry until max_retries — when exhausted, log final failure
        if self.request.retries >= self.max_retries:
            _log(conversation_id, node_id, url, method_u, ok=False,
                 status='exhausted', retries=self.request.retries)
            return
        raise


def _log(conversation_id, node_id, url, method, *, ok, status, retries=0):
    """Append a final audit row to the conversation. Imported lazily to avoid
    a circular import on app startup."""
    try:
        from .models import BotConversation, BotConversationStep
        conv = BotConversation.objects.filter(pk=conversation_id).only('id').first()
        if not conv:
            return
        BotConversationStep.objects.create(
            conversation=conv,
            node_id=node_id,
            node_type='webhook',
            direction='system',
            payload={
                'url': url, 'method': method,
                'ok': bool(ok), 'status': status, 'retries': retries,
            },
        )
    except Exception:
        logger.exception('webhook audit log failed for conv=%s', conversation_id)
