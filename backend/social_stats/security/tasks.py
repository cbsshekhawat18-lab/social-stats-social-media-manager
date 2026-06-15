# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Celery tasks for the security/compliance pillar.

`rotate_encryption_keys`:
    Re-encrypts every value stored in an EncryptedTextField with the current
    primary key. Run after rotating ``FIELD_ENCRYPTION_KEYS`` (added a new
    primary key at position [0]) so old ciphertexts are migrated off the
    retired key. Once this task completes, the retired key can be removed
    from the env on the next deploy.

Run modes:
    - Quarterly Celery beat (configured separately in settings)
    - Manual: ``python manage.py shell -c "from social_stats.security.tasks
      import rotate_encryption_keys; rotate_encryption_keys()"``

Implementation note
-------------------
``EncryptedTextField`` decrypts on read (``from_db_value``) and encrypts on
write (``get_prep_value``) using the *primary* key. So the rotation task
just reads each field through the ORM (decrypts with whichever key works)
and writes it back (re-encrypts with primary). One round-trip per row.

Every run produces fresh ciphertext (Fernet uses a random IV), so this is
**not** a no-op on already-primary rows — it always issues UPDATEs. That's
fine; rotation runs quarterly, not hot-path.
"""
from __future__ import annotations

import logging
from typing import Iterable

from celery import shared_task
from django.db import transaction


logger = logging.getLogger(__name__)


# Registry: every (model_label, [field_names]) pair to walk during rotation.
# Keep in sync with EncryptedTextField declarations across the codebase.
# Future stages (UserMFA.totp_secret, APIKey.key_hash, …) append here.
ENCRYPTED_FIELDS: list[tuple[str, list[str]]] = [
    ('social_stats.PlatformCredential',     ['access_token', 'refresh_token']),
    ('social_stats.ManualCredentialExtras', ['oauth_client_id', 'oauth_client_secret', 'api_key']),
]


@shared_task(ignore_result=True)
def cleanup_security_audit_logs(days: int = 2555) -> int:
    """purge SecurityAuditLog rows older than ``days`` (default 7y)."""
    from .audit import cleanup_old_logs
    n = cleanup_old_logs(days=days)
    logger.info('cleanup_security_audit_logs: deleted %s row(s) older than %s days', n, days)
    return n


@shared_task(ignore_result=True)
def detect_security_anomalies(window_minutes: int = 60) -> dict:
    """periodic detector: scan recent SecurityAuditLog for spikes
    that warrant a human alert.

    Triggers right now:
      • >10 failed logins for ONE user in the window  → emit warning row
      • >50 failed logins from ONE IP in the window   → emit critical row

    Returns ``{spikes_per_user, spikes_per_ip}``. The emitted "anomaly" rows
    feed the same audit feed they came from so the security console only
    needs one source.
    """
    from datetime import timedelta
    from django.db.models import Count
    from django.utils import timezone
    from .audit import SecurityAuditLog, record

    cutoff = timezone.now() - timedelta(minutes=window_minutes)
    base = SecurityAuditLog.objects.filter(
        timestamp__gte=cutoff,
        event_type__in=['login_failed', 'mfa_login_failed'],
        success=False,
    )

    per_user = list(
        base.exclude(actor_user__isnull=True)
            .values('actor_user_id')
            .annotate(n=Count('id'))
            .filter(n__gt=10)
    )
    per_ip = list(
        base.exclude(actor_ip__isnull=True)
            .values('actor_ip')
            .annotate(n=Count('id'))
            .filter(n__gt=50)
    )

    for row in per_user:
        record(
            event_type='suspicious_login',  # closest existing slot
            severity='warning',
            target_object_type='User', target_object_id=row['actor_user_id'],
            description=f'{row["n"]} failed logins for user in {window_minutes} min',
            metadata={'window_minutes': window_minutes, 'count': row['n'],
                      'detector': 'failed_login_spike_per_user'},
        )
    for row in per_ip:
        record(
            event_type='suspicious_login',
            severity='critical',
            description=f'{row["n"]} failed logins from {row["actor_ip"]} in {window_minutes} min',
            metadata={'window_minutes': window_minutes, 'count': row['n'],
                      'ip': row['actor_ip'], 'detector': 'failed_login_spike_per_ip'},
        )

    return {
        'spikes_per_user': len(per_user),
        'spikes_per_ip':   len(per_ip),
        'window_minutes':  window_minutes,
    }


@shared_task(ignore_result=True)
def rotate_encryption_keys(batch_size: int = 200) -> dict:
    """Re-encrypt every covered column with the current primary key.

    Returns ``{model_label: rows_touched}`` for observability.
    """
    from django.apps import apps

    summary: dict[str, int] = {}
    for label, field_names in ENCRYPTED_FIELDS:
        try:
            Model = apps.get_model(label)
        except LookupError:
            logger.warning('rotate_encryption_keys: unknown model %s — skipping', label)
            continue
        touched = _rotate_model(Model, field_names, batch_size)
        summary[label] = touched
        logger.info('rotate_encryption_keys: %s — re-encrypted %s row(s)', label, touched)
    return summary


def _rotate_model(Model, field_names: Iterable[str], batch_size: int) -> int:
    """Read each row through the ORM (decrypts) and write it back (re-encrypts
    with the primary key). Bypasses signals/auto_now via ``update_fields``.
    """
    field_list = list(field_names)
    pk_name = Model._meta.pk.name
    pks = list(Model.objects.values_list(pk_name, flat=True).order_by(pk_name))
    touched = 0

    for start in range(0, len(pks), batch_size):
        chunk_pks = pks[start:start + batch_size]
        with transaction.atomic():
            for inst in Model.objects.filter(pk__in=chunk_pks).only(pk_name, *field_list):
                changed = False
                for fname in field_list:
                    val = getattr(inst, fname)
                    if val:
                        # Re-assigning the same plaintext triggers fresh
                        # encryption with the primary key on save().
                        setattr(inst, fname, val)
                        changed = True
                if changed:
                    inst.save(update_fields=field_list)
                    touched += 1
    return touched
