# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
privacy Celery tasks.

assemble_data_export(request_id)   — build the user's data ZIP, email link
process_account_deletion(req_id)   — hard-delete after grace; anonymise PII
sweep_pending_deletions()           — beat task: kicks off process_account_deletion
                                       for any AccountDeletionRequest past grace
"""
from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import secrets
import tempfile
import uuid
import zipfile
from datetime import timedelta
from typing import Iterable

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Data export
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(bind=True, ignore_result=True, max_retries=2, default_retry_delay=300)
def assemble_data_export(self, request_id: int):
    """Build a ZIP of the user's data, store it on disk, email a download link."""
    from ..models import DataExportRequest, Client
    req = DataExportRequest.objects.filter(pk=request_id).first()
    if not req:
        return
    if req.status != 'queued':
        logger.info('data export #%s status=%s — skipping', req.id, req.status)
        return

    req.status = 'processing'
    req.save(update_fields=['status'])

    user = req.user
    try:
        zip_bytes, manifest = _build_export_zip(user)
    except Exception as e:  # noqa: BLE001
        logger.exception('data export #%s failed', req.id)
        req.status = 'failed'
        req.error_message = str(e)[:500]
        req.save(update_fields=['status', 'error_message'])
        try:
            self.retry(exc=e)
        except Exception:
            return
        return

    # Persist the archive. In prod, prefer S3 with KMS + signed URL; here we
    # write to MEDIA_ROOT/exports/<token>.zip for simplicity.
    download_token = uuid.uuid4()
    out_dir = os.path.join(getattr(settings, 'MEDIA_ROOT', None) or tempfile.gettempdir(),
                           'privacy_exports')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f'{download_token.hex}.zip')
    with open(out_path, 'wb') as f:
        f.write(zip_bytes)

    req.archive_path        = out_path
    req.archive_size_bytes  = len(zip_bytes)
    req.download_token      = download_token
    req.download_expires_at = timezone.now() + timedelta(days=7)
    req.completed_at        = timezone.now()
    req.status              = 'completed'
    req.save(update_fields=['archive_path', 'archive_size_bytes', 'download_token',
                            'download_expires_at', 'completed_at', 'status'])

    _email_export_link(user, req, manifest)


def _build_export_zip(user) -> tuple[bytes, dict]:
    """Pack the user's data into a ZIP. Returns ``(zip_bytes, manifest_dict)``."""
    from ..models import (
        Client, UserProfile, UserConsent, AccountDeletionRequest, DataExportRequest,
    )
    profile = getattr(user, 'profile', None)
    profile_data = {
        'id':         user.id,
        'username':   user.username,
        'email':      user.email,
        'first_name': user.first_name,
        'last_name':  user.last_name,
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
        'last_login':  user.last_login.isoformat()  if user.last_login  else None,
        'profile': {
            'role':  getattr(profile, 'role', None),
            'phone': getattr(profile, 'phone', None),
            'terms_accepted_at': profile.terms_accepted_at.isoformat()
                if profile and getattr(profile, 'terms_accepted_at', None) else None,
        } if profile else None,
    }

    # Workspaces this user owns
    owned_clients = list(Client.objects.filter(owner_user=user).values(
        'id', 'name', 'company', 'email', 'phone', 'subscription_plan',
        'industry', 'created_at',
    ))

    # Consent log
    consents = list(UserConsent.objects.filter(user=user).order_by('given_at').values(
        'consent_type', 'given', 'given_at', 'given_via', 'text_version', 'ip_address',
    ))

    # Prior export / deletion requests
    export_history = list(DataExportRequest.objects.filter(user=user).values(
        'id', 'status', 'requested_at', 'completed_at',
    ))
    deletion_history = list(AccountDeletionRequest.objects.filter(user=user).values(
        'id', 'status', 'requested_at', 'grace_until',
    ))

    manifest = {
        'export_generated_at': timezone.now().isoformat(),
        'subject_user_id':     user.id,
        'subject_email':       user.email,
        'files': [
            'profile.json', 'workspaces.json', 'consents.json',
            'export_requests.json', 'deletion_requests.json', 'README.txt',
        ],
        'note': (
            'This archive contains personal data Social Stats holds about you. '
            'Workspace content (posts, leads, messages) is included only when '
            'you are the workspace owner. Connected platform tokens are '
            'NOT included for security.'
        ),
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('manifest.json',           _json(manifest))
        zf.writestr('profile.json',            _json(profile_data))
        zf.writestr('workspaces.json',         _json(owned_clients))
        zf.writestr('consents.json',           _json(consents))
        zf.writestr('export_requests.json',    _json(export_history))
        zf.writestr('deletion_requests.json',  _json(deletion_history))
        zf.writestr('README.txt',              _readme_text(user, manifest))
    return buf.getvalue(), manifest


def _json(obj) -> str:
    return json.dumps(obj, default=str, indent=2, ensure_ascii=False)


def _readme_text(user, manifest: dict) -> str:
    return (
        f'Social Stats — personal data export\n'
        f'-----------------------------\n'
        f'Subject: {user.email or user.username}\n'
        f'Generated: {manifest["export_generated_at"]}\n\n'
        f'Files in this archive:\n'
        + '\n'.join(f'  • {f}' for f in manifest['files'])
        + '\n\nQuestions? privacy@socialstats.app\n'
    )


def _email_export_link(user, req, manifest: dict) -> None:
    if not user.email:
        return
    frontend = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    link = f'{frontend}/privacy/download/{req.download_token.hex}/'
    body = (
        f'Hi {user.first_name or user.username},\n\n'
        f'Your Social Stats personal-data export is ready. Download link (expires '
        f'in 7 days):\n\n'
        f'  {link}\n\n'
        f'Archive size: {req.archive_size_bytes:,} bytes\n'
        f'Files: {", ".join(manifest["files"])}\n\n'
        f'If you did not request this export, please contact security@socialstats.app\n'
    )
    try:
        send_mail(
            '[Social Stats] Your data export is ready',
            body,
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@socialstats.app'),
            [user.email],
            fail_silently=True,
        )
    except Exception:
        logger.warning('export email failed for user=%s', user.id, exc_info=True)


# ─────────────────────────────────────────────────────────────────────────────
# Account deletion — anonymise after grace
# ─────────────────────────────────────────────────────────────────────────────
@shared_task(ignore_result=True)
def process_account_deletion(request_id: int) -> str:
    """Hard-delete + anonymise the user behind an AccountDeletionRequest that
    has cleared its grace period.

    What we DELETE:
      • UserSession (sessions.py)
      • UserMFA (mfa.py)
      • APIKey rows owned by the user
      • DataExportRequest archive files
    What we ANONYMISE on the User row:
      • email, first_name, last_name → hashed; username → "deleted-<id>"
      • set is_active=False
    What we KEEP (legal/audit):
      • SecurityAuditLog rows (actor_user FK SET_NULL on delete is fine)
      • Anonymised User row itself
      • AccountDeletionRequest row (so we can prove we honoured the request)
    """
    from ..models import AccountDeletionRequest, UserSession, UserMFA, APIKey, DataExportRequest

    req = AccountDeletionRequest.objects.filter(pk=request_id).first()
    if not req or req.status not in ('queued',):
        return 'noop'
    if timezone.now() < req.grace_until:
        return 'still_in_grace'

    user = req.user
    if not user:
        req.status = 'completed'
        req.processed_at = timezone.now()
        req.save(update_fields=['status', 'processed_at'])
        return 'user_already_gone'

    req.status = 'processing'
    req.save(update_fields=['status'])

    try:
        UserSession.objects.filter(user=user).delete()
        UserMFA.objects.filter(user=user).delete()
        APIKey.objects.filter(created_by=user).update(
            is_active=False, revoked_at=timezone.now(),
            revoke_reason='account_deletion',
        )
        # Wipe export archives off disk, plus the rows
        for old in DataExportRequest.objects.filter(user=user):
            try:
                if old.archive_path and os.path.exists(old.archive_path):
                    os.remove(old.archive_path)
            except OSError:
                pass
        DataExportRequest.objects.filter(user=user).delete()

        # Anonymise the User row itself
        salt = secrets.token_hex(8)
        h_email = hashlib.sha256((user.email + salt).encode()).hexdigest()[:16]
        user.email      = f'deleted-{user.id}@anon.socialstats.local'
        user.first_name = ''
        user.last_name  = ''
        user.username   = f'deleted-{user.id}'
        user.is_active  = False
        user.set_unusable_password()
        user.save(update_fields=['email', 'first_name', 'last_name',
                                 'username', 'is_active', 'password'])

        req.anonymised_user_id_hash = h_email
        req.status                  = 'completed'
        req.processed_at            = timezone.now()
        req.save(update_fields=['anonymised_user_id_hash', 'status', 'processed_at'])
        return 'completed'
    except Exception as e:
        logger.exception('account deletion #%s failed', req.id)
        req.status = 'failed'
        req.error_message = str(e)[:500]
        req.save(update_fields=['status', 'error_message'])
        return 'failed'


@shared_task(ignore_result=True)
def sweep_pending_deletions() -> dict:
    """Beat task — find every queued deletion past its grace window and run it."""
    from ..models import AccountDeletionRequest
    overdue = AccountDeletionRequest.objects.filter(
        status='queued', grace_until__lte=timezone.now(),
    ).values_list('id', flat=True)
    n = 0
    for rid in list(overdue):
        try:
            process_account_deletion.delay(rid)
            n += 1
        except Exception:
            logger.exception('sweep: failed to enqueue deletion #%s', rid)
    return {'enqueued': n}
