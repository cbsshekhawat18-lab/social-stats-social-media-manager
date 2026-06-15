# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Security API.

sessions:
    GET  /api/auth/sessions/              — list user's sessions
    POST /api/auth/sessions/<id>/revoke/  — revoke a single session
    POST /api/auth/sessions/revoke-all/   — revoke every other session

MFA:
    GET  /api/auth/mfa/status/                       — is MFA on for this user
    POST /api/auth/mfa/setup/                        — start enrolment, returns QR
    POST /api/auth/mfa/verify-setup/                 — confirm with first OTP
    POST /api/auth/mfa/login/                        — second factor at login
    POST /api/auth/mfa/disable/                      — turn MFA off (needs OTP+password)
    POST /api/auth/mfa/regenerate-backup-codes/      — replace the 10 codes
"""
from __future__ import annotations

from datetime import timedelta

from django.db import models
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .throttles import MFAVerifyThrottle

from .sessions import UserSession, revoke_session, revoke_all_for_user, _client_ip, record_session
from .mfa import (
    UserMFA, BACKUP_CODE_COUNT,
    provision_secret, qr_data_uri, verify_totp,
    generate_backup_codes, consume_backup_code,
    issue_mfa_token, parse_mfa_token,
)
from .api_keys import APIKey, generate_key, KEY_PREFIX_LIVE, KEY_PREFIX_TEST
from . import audit as security_audit


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_sessions(request):
    """List the calling user's sessions, newest first. Returns active +
    revoked rows from the last 90 days so the user can see history."""
    from datetime import timedelta
    from django.utils import timezone
    cutoff = timezone.now() - timedelta(days=90)
    qs = UserSession.objects.filter(user=request.user, created_at__gte=cutoff).order_by('-last_used_at')
    out = []
    for s in qs:
        out.append({
            'id':           s.id,
            'browser':      s.ua_browser,
            'os':           s.ua_os,
            'device':       s.ua_device,
            'ip':           s.ip_address,
            'country':      s.location_country,
            'city':         s.location_city,
            'created_at':   s.created_at.isoformat(),
            'last_used_at': s.last_used_at.isoformat(),
            'expires_at':   s.expires_at.isoformat() if s.expires_at else None,
            'is_active':    s.is_active,
            'revoked_at':   s.revoked_at.isoformat() if s.revoked_at else None,
            'revoke_reason': s.revoke_reason,
        })
    return Response({'sessions': out, 'count': len(out)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def revoke_one(request, session_id: int):
    """Revoke a single session by id. Must belong to the calling user."""
    sess = UserSession.objects.filter(pk=session_id, user=request.user).first()
    if not sess:
        return Response({'error': 'session not found'}, status=404)
    revoke_session(sess, reason='user_revoked')
    security_audit.record(
        event_type='session_revoked', actor_user=request.user, request=request,
        target_object_type='UserSession', target_object_id=sess.id,
        metadata={'jti': sess.refresh_jti[:12]},
    )
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def revoke_all_others(request):
    """Sign out everywhere except the current refresh token (if known)."""
    keep_jti = (request.data.get('keep_jti') or '').strip()
    n = revoke_all_for_user(request.user, except_jti=keep_jti, reason='sign_out_everywhere')
    security_audit.record(
        event_type='sign_out_everywhere', actor_user=request.user, request=request,
        target_object_type='User', target_object_id=request.user.id,
        metadata={'revoked': n, 'kept_jti': keep_jti[:12] if keep_jti else None},
    )
    return Response({'ok': True, 'revoked': n})


# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mfa_status(request):
    """Cheap status endpoint for the Settings UI."""
    mfa = getattr(request.user, 'mfa', None)
    return Response({
        'enabled':                bool(mfa and mfa.is_enabled),
        'pending':                bool(mfa and not mfa.is_enabled and mfa.totp_secret),
        'backup_codes_remaining': mfa.remaining_backup_codes() if mfa and mfa.is_enabled else 0,
        'last_used_at':           mfa.last_used_at.isoformat() if mfa and mfa.last_used_at else None,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_setup(request):
    """Start enrolment: provision a fresh TOTP secret, return QR + secret.
    Idempotent before verification — re-calling rotates the seed (useful if
    the user lost the QR before scanning)."""
    try:
        mfa, secret, url = provision_secret(request.user)
    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    return Response({
        'secret':       secret,           # base32 — for manual entry
        'otpauth_url':  url,
        'qr_data_uri':  qr_data_uri(url),
        'instructions': (
            'Scan the QR with Google Authenticator, 1Password, or any TOTP app, '
            'then enter the 6-digit code below to confirm.'
        ),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_verify_setup(request):
    """Confirm enrolment: user submits the first 6-digit code. On success
    we mark MFA enabled and return 10 single-use backup codes (shown once)."""
    code = (request.data.get('code') or '').strip()
    mfa = getattr(request.user, 'mfa', None)
    if not mfa or not mfa.totp_secret:
        return Response({'error': 'no MFA enrolment in progress; call /setup/ first'}, status=400)
    if mfa.is_enabled:
        return Response({'error': 'MFA already enabled'}, status=400)
    if not verify_totp(mfa, code):
        return Response({'error': 'invalid code — check your authenticator clock'}, status=400)

    from django.utils import timezone
    mfa.is_enabled  = True
    mfa.enabled_at  = timezone.now()
    mfa.save(update_fields=['is_enabled', 'enabled_at', 'updated_at'])
    backup_codes = generate_backup_codes(mfa)

    security_audit.record(
        event_type='mfa_enabled', actor_user=request.user, request=request,
        target_object_type='UserMFA', target_object_id=mfa.id,
    )
    return Response({
        'ok':            True,
        'backup_codes':  backup_codes,
        'instructions': (
            'Save these codes somewhere safe. Each can be used ONCE if you '
            'lose your authenticator. We will never show them again.'
        ),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([MFAVerifyThrottle])
def mfa_login(request):
    """Second factor of login. Consumes the mfa_token from /auth/login/'s
    handshake response, plus a TOTP code OR a backup code, and issues the
    real {access, refresh} pair on success.

    Body: {mfa_token, code?, backup_code?, terms_accepted}
    """
    from django.contrib.auth.models import User
    from django.utils import timezone
    from rest_framework_simplejwt.tokens import RefreshToken
    from datetime import datetime, timezone as dt_tz

    mfa_token = (request.data.get('mfa_token') or '').strip()
    code        = (request.data.get('code') or '').strip()
    backup_code = (request.data.get('backup_code') or '').strip()

    if not mfa_token or (not code and not backup_code):
        return Response({'error': 'mfa_token and code (or backup_code) required'}, status=400)

    expected_ip = _client_ip(request)
    user_id = parse_mfa_token(mfa_token, expected_ip=expected_ip)
    if not user_id:
        return Response({'error': 'mfa session expired or invalid — sign in again'}, status=401)

    try:
        user = User.objects.get(pk=user_id, is_active=True)
    except User.DoesNotExist:
        return Response({'error': 'user not found'}, status=401)

    mfa = getattr(user, 'mfa', None)
    if not mfa or not mfa.is_enabled:
        return Response({'error': 'MFA not enabled for this user'}, status=400)

    method = None
    if code and verify_totp(mfa, code):
        method = 'totp'
    elif backup_code and consume_backup_code(mfa, backup_code):
        method = 'backup_code'
    else:
        security_audit.record(
            event_type='mfa_login_failed', actor_user=user, request=request,
            target_object_type='UserMFA', target_object_id=mfa.id,
            success=False, severity='warning',
        )
        return Response({'error': 'invalid code'}, status=401)

    mfa.last_used_at = timezone.now()
    mfa.last_used_method = method
    mfa.save(update_fields=['last_used_at', 'last_used_method', 'updated_at'])

    security_audit.record(
        event_type='backup_code_used' if method == 'backup_code' else 'mfa_used',
        actor_user=user, request=request,
        target_object_type='UserMFA', target_object_id=mfa.id,
        metadata={'method': method, 'remaining_backup_codes': mfa.remaining_backup_codes()},
    )

    # Issue tokens, mirroring TokenObtainPairView's contract
    refresh = RefreshToken.for_user(user)
    access  = refresh.access_token
    response = Response({
        'access':  str(access),
        'refresh': str(refresh),
        'mfa_method_used': method,
        'backup_codes_remaining': mfa.remaining_backup_codes(),
    })

    # Reuse Stage-2 session bookkeeping
    try:
        jti = refresh.get('jti', '')
        exp_ts = refresh.get('exp')
        if jti and exp_ts:
            expires_at = datetime.fromtimestamp(exp_ts, tz=dt_tz.utc)
            record_session(user=user, refresh_jti=jti,
                           expires_at=expires_at, request=request)
    except Exception:
        pass

    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_disable(request):
    """Turn MFA off. Requires the user's password AND a valid current OTP
    (or backup code) — we deliberately make this expensive so a session
    hijacker can't disable MFA before the user notices the new login."""
    password    = request.data.get('password') or ''
    code        = (request.data.get('code') or '').strip()
    backup_code = (request.data.get('backup_code') or '').strip()

    if not password or (not code and not backup_code):
        return Response({'error': 'password and code (or backup_code) required'}, status=400)
    if not request.user.check_password(password):
        return Response({'error': 'incorrect password'}, status=401)

    mfa = getattr(request.user, 'mfa', None)
    if not mfa or not mfa.is_enabled:
        return Response({'error': 'MFA not enabled'}, status=400)

    if not (verify_totp(mfa, code) or consume_backup_code(mfa, backup_code)):
        return Response({'error': 'invalid code'}, status=401)

    mfa.is_enabled  = False
    mfa.totp_secret = ''
    mfa.backup_codes = []
    mfa.save(update_fields=['is_enabled', 'totp_secret', 'backup_codes', 'updated_at'])
    security_audit.record(
        event_type='mfa_disabled', actor_user=request.user, request=request,
        target_object_type='UserMFA', target_object_id=mfa.id,
        severity='warning',
    )
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mfa_regenerate_backup_codes(request):
    """Replace the 10 backup codes with fresh ones. Requires a current OTP
    so a hijacker holding only the session can't refresh the recovery vector."""
    code = (request.data.get('code') or '').strip()
    mfa = getattr(request.user, 'mfa', None)
    if not mfa or not mfa.is_enabled:
        return Response({'error': 'MFA not enabled'}, status=400)
    if not verify_totp(mfa, code):
        return Response({'error': 'invalid code'}, status=401)

    backup_codes = generate_backup_codes(mfa)
    return Response({
        'ok':           True,
        'backup_codes': backup_codes,
        'count':        len(backup_codes),
    })


# ─────────────────────────────────────────────────────────────────────────────
def _api_key_summary(k: APIKey) -> dict:
    """Public-safe representation: never includes the plaintext key or hash."""
    return {
        'id':           k.id,
        'name':         k.name,
        'key_prefix':   k.key_prefix,         # for display, e.g. "sk_live_aBc1"
        'scopes':       list(k.scopes or []),
        'ip_allowlist': list(k.ip_allowlist or []),
        'last_used_at': k.last_used_at.isoformat() if k.last_used_at else None,
        'last_used_ip': k.last_used_ip,
        'use_count':    k.use_count,
        'expires_at':   k.expires_at.isoformat() if k.expires_at else None,
        'is_active':    k.is_active and not k.is_expired and not k.revoked_at,
        'is_expired':   k.is_expired,
        'revoked_at':   k.revoked_at.isoformat() if k.revoked_at else None,
        'created_at':   k.created_at.isoformat(),
        'created_by':   k.created_by_id,
    }


def _resolve_client_for_user(request) -> int | None:
    """Mirror TenantScopedMixin._resolved_client_id without the ViewSet wrapper."""
    profile = getattr(request.user, 'profile', None)
    if not profile:
        return None
    if profile.role == 'superadmin':
        cid = request.query_params.get('client_id') or request.data.get('client_id')
        try: return int(cid) if cid else None
        except (TypeError, ValueError): return None
    if profile.role == 'staff':
        cid = request.query_params.get('client_id') or request.data.get('client_id')
        try: cid = int(cid) if cid else None
        except (TypeError, ValueError): cid = None
        return cid if cid and profile.assigned_clients.filter(id=cid).exists() else None
    return profile.client_id


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_keys_collection(request):
    """GET — list keys for the calling user's client (revoked + expired hidden by default).
    POST — create a new key. Plaintext returned ONCE; never retrievable again.

    POST body: {name, scopes?: [...], ip_allowlist?: [...], expires_in_days?: int, test?: bool}
    """
    client_id = _resolve_client_for_user(request)
    if not client_id:
        return Response({'error': 'no client context'}, status=403)

    if request.method == 'GET':
        include_inactive = request.query_params.get('include_inactive') in ('1', 'true')
        qs = APIKey.objects.filter(client_id=client_id).order_by('-created_at')
        if not include_inactive:
            from django.utils import timezone as tz
            qs = qs.filter(is_active=True, revoked_at__isnull=True).filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=tz.now())
            )
        return Response({'keys': [_api_key_summary(k) for k in qs]})

    # POST — create
    name = (request.data.get('name') or '').strip()[:200]
    if not name:
        return Response({'error': 'name is required'}, status=400)
    scopes = request.data.get('scopes') or []
    if not isinstance(scopes, list):
        return Response({'error': 'scopes must be a list'}, status=400)
    ip_allowlist = request.data.get('ip_allowlist') or []
    if not isinstance(ip_allowlist, list):
        return Response({'error': 'ip_allowlist must be a list'}, status=400)
    test_mode = bool(request.data.get('test'))
    days = request.data.get('expires_in_days')

    plaintext, key_prefix, key_hash = generate_key(test_mode=test_mode)
    expires_at = None
    if days:
        try:
            expires_at = timezone.now() + timedelta(days=int(days))
        except (TypeError, ValueError):
            pass

    key = APIKey.objects.create(
        client_id=client_id,
        name=name,
        key_prefix=key_prefix,
        key_hash=key_hash,
        scopes=[str(s)[:80] for s in scopes][:50],
        ip_allowlist=[str(c)[:50] for c in ip_allowlist][:50],
        expires_at=expires_at,
        created_by=request.user,
    )

    security_audit.record(
        event_type='api_key_created', actor_user=request.user, request=request,
        target_object_type='APIKey', target_object_id=key.id,
        target_client=key.client,
        metadata={'name': name, 'scopes': key.scopes,
                  'has_ip_allowlist': bool(key.ip_allowlist),
                  'expires_at': key.expires_at.isoformat() if key.expires_at else None,
                  'key_prefix': key.key_prefix},
    )

    return Response({
        **_api_key_summary(key),
        # The plaintext is the entire point of this response — show it once
        # to the user. Subsequent GETs only return key_prefix.
        'plaintext_key': plaintext,
        'warning': 'Save this key now — it will not be shown again.',
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_key_revoke(request, key_id: int):
    """Revoke a key. Cannot be undone — issue a new key if needed."""
    client_id = _resolve_client_for_user(request)
    if not client_id:
        return Response({'error': 'no client context'}, status=403)
    key = APIKey.objects.filter(pk=key_id, client_id=client_id).first()
    if not key:
        return Response({'error': 'key not found'}, status=404)
    if key.revoked_at:
        return Response({'error': 'already revoked'}, status=400)
    key.revoked_at    = timezone.now()
    key.is_active     = False
    key.revoke_reason = (request.data.get('reason') or 'user_revoked')[:80]
    key.save(update_fields=['revoked_at', 'is_active', 'revoke_reason'])
    security_audit.record(
        event_type='api_key_revoked', actor_user=request.user, request=request,
        target_object_type='APIKey', target_object_id=key.id,
        target_client=key.client,
        metadata={'name': key.name, 'reason': key.revoke_reason, 'key_prefix': key.key_prefix},
    )
    return Response({'ok': True})
