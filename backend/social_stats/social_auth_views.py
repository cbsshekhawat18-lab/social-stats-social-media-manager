# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Social login views for Google, Microsoft, and Facebook OAuth.
Client users only — superadmin/staff are blocked.
"""
import hashlib
import secrets
import urllib.parse

import requests as http_requests
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.shortcuts import redirect
from rest_framework.decorators import (
    api_view, authentication_classes, permission_classes, throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile, ensure_client_profile
from .security.throttles import SocialExchangeThrottle


GOOGLE_CLIENT_ID      = settings.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET  = settings.GOOGLE_CLIENT_SECRET
GOOGLE_SOCIAL_REDIRECT_URI = getattr(
    settings, 'GOOGLE_SOCIAL_REDIRECT_URI',
    'http://localhost:8000/api/auth/social/google/callback/'
)

FACEBOOK_APP_ID     = getattr(settings, 'FACEBOOK_SOCIAL_APP_ID', '')
FACEBOOK_APP_SECRET = getattr(settings, 'FACEBOOK_SOCIAL_APP_SECRET', '')
FACEBOOK_SOCIAL_REDIRECT_URI = getattr(
    settings, 'FACEBOOK_SOCIAL_REDIRECT_URI',
    'http://localhost:8000/api/auth/social/facebook/callback/'
)

MICROSOFT_CLIENT_ID     = getattr(settings, 'MICROSOFT_CLIENT_ID', '')
MICROSOFT_CLIENT_SECRET = getattr(settings, 'MICROSOFT_CLIENT_SECRET', '')
MICROSOFT_REDIRECT_URI  = getattr(
    settings, 'MICROSOFT_SOCIAL_REDIRECT_URI',
    'http://localhost:8000/api/auth/social/microsoft/callback/'
)
MICROSOFT_TENANT = 'common'

FRONTEND_URL = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
FRONTEND_CALLBACK = FRONTEND_URL + '/auth/callback'


def _frontend_error(msg):
    return redirect(f'{FRONTEND_URL}/login?error={urllib.parse.quote(msg)}')


def _social_state_valid(request) -> bool:
    """Login-CSRF guard: the callback's `state` must equal the one-time value
    stored in this browser's session at /start. Pops the stored value so a
    state can't be replayed. Mirrors _oauth_state_valid in oauth_views.py."""
    import hmac as _hmac
    returned = request.query_params.get('state', '') or ''
    expected = request.session.pop('social_state', '') or ''
    return bool(expected) and _hmac.compare_digest(returned, expected)


# ── One-time login codes ──────────────────────────────────────────────────────
# The provider callback must hand the result back to the SPA via a browser
# redirect. Tokens in that URL would land in browser history, proxy/access
# logs and Referer headers, so the redirect carries only a random one-time
# code; the SPA swaps it for the real payload with a POST to
# /api/auth/social/exchange/. Codes live in the shared cache for 60 s and
# can be redeemed exactly once.
SOCIAL_LOGIN_CODE_TTL = 60
_LOGIN_CODE_PREFIX = 'social-login-code:'


def _login_code_key(code: str) -> str:
    return _LOGIN_CODE_PREFIX + hashlib.sha256(code.encode()).hexdigest()


def _redirect_with_login_code(payload: dict):
    code = secrets.token_urlsafe(32)
    cache.set(_login_code_key(code), payload, timeout=SOCIAL_LOGIN_CODE_TTL)
    return redirect(f'{FRONTEND_CALLBACK}?code={code}')


def _consume_login_code(code: str):
    """Return the payload stored for `code` and invalidate it, or None.
    `cache.add` is atomic (SET NX on Redis), so concurrent redemptions of
    the same code can't both succeed."""
    if not code or len(code) > 128:
        return None
    key = _login_code_key(code)
    payload = cache.get(key)
    if payload is None:
        return None
    if not cache.add(key + ':claimed', 1, timeout=SOCIAL_LOGIN_CODE_TTL):
        return None
    cache.delete(key)
    return payload


def _finish_social_login(request, user):
    """Issue tokens for a socially-authenticated user — via the same MFA
    handshake the password login uses when the account has TOTP enabled.
    Social login must not be a second-factor bypass."""
    mfa = getattr(user, 'mfa', None)
    if mfa and mfa.is_enabled:
        from .security.mfa import issue_mfa_token
        from .security.client_ip import get_client_ip
        token = issue_mfa_token(user_id=user.id, ip=get_client_ip(request))
        return _redirect_with_login_code({'mfa_required': True, 'mfa_token': token})

    access, refresh = _make_jwt(user)
    try:
        has_client = user.profile.client_id is not None
    except Exception:
        has_client = False
    payload = {'access': access, 'refresh': refresh}
    if not has_client:
        payload['state'] = 'self'
    return _redirect_with_login_code(payload)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([SocialExchangeThrottle])
def social_exchange(request):
    """POST {code} → the tokens (or MFA handshake) behind a one-time code
    issued by a social login callback. Each code works once, for 60 s."""
    code = request.data.get('code') if hasattr(request.data, 'get') else None
    payload = _consume_login_code(code if isinstance(code, str) else '')
    if payload is None:
        return Response({'error': 'Invalid or expired sign-in code.'}, status=400)
    response = Response(payload)
    response['Cache-Control'] = 'no-store'
    return response




def _make_jwt(user):
    """Build JWT tokens with the same custom claims as our login view."""
    refresh = RefreshToken.for_user(user)
    try:
        profile = user.profile
        ensure_client_profile(profile)
        refresh['role']      = profile.role
        refresh['client_id'] = profile.client_id
        refresh['name']      = user.get_full_name() or user.username
        from .permissions import PermissionChecker
        refresh['permissions'] = PermissionChecker.get_user_permissions(profile)
        if profile.role == 'client' and profile.client:
            try:
                cfg = profile.client.page_config
                refresh['portal_config'] = {
                    'show_posts_section':   cfg.show_posts_section,
                    'show_roi_section':     cfg.show_roi_section,
                    'show_calendar':        cfg.show_calendar,
                    'show_reviews_section': cfg.show_reviews_section,
                    'custom_accent_color':  cfg.custom_accent_color,
                    'welcome_message':      cfg.welcome_message,
                }
            except Exception:
                refresh['portal_config'] = {}
    except Exception:
        refresh['role'] = 'client'
        refresh['permissions'] = {}
    return str(refresh.access_token), str(refresh)


def _find_or_create_client(email, first_name='', last_name=''):
    """
    Find existing user by email or create a new one with client role.
    Returns (user, error_msg). error_msg is non-empty if the user is staff/admin.
    """
    user = User.objects.filter(email__iexact=email).first()
    if user:
        try:
            if user.profile.role in ('superadmin', 'staff'):
                return None, 'Staff and admin accounts cannot use social login.'
        except UserProfile.DoesNotExist:
            pass
        return user, ''

    # Create new client user
    username = email.lower()
    # Ensure username uniqueness
    if User.objects.filter(username=username).exists():
        username = email.lower().replace('@', '_at_')
    user = User.objects.create_user(
        username=username,
        email=email.lower(),
        first_name=first_name,
        last_name=last_name,
    )
    user.set_unusable_password()
    user.save()
    UserProfile.objects.create(user=user, role='client', is_self_registered=True)
    return user, ''


# ── Google ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def google_social_start(request):
    """Redirect browser to Google OAuth consent screen."""
    state = secrets.token_urlsafe(16)
    request.session['social_state'] = state
    params = {
        'client_id':     GOOGLE_CLIENT_ID,
        'redirect_uri':  GOOGLE_SOCIAL_REDIRECT_URI,
        'response_type': 'code',
        'scope':         'openid email profile',
        'state':         state,
        'access_type':   'online',
        'prompt':        'select_account',
    }
    url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode(params)
    return redirect(url)


@api_view(['GET'])
@permission_classes([AllowAny])
def google_social_callback(request):
    """Google redirects here; exchange code → profile → JWT → frontend."""
    error = request.query_params.get('error')
    code  = request.query_params.get('code')

    if error or not code:
        return _frontend_error('Google sign-in was cancelled.')

    if not _social_state_valid(request):
        return _frontend_error('Sign-in session expired or was invalid — please try again.')

    # Exchange code for tokens
    token_resp = http_requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'code':          code,
            'client_id':     GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri':  GOOGLE_SOCIAL_REDIRECT_URI,
            'grant_type':    'authorization_code',
        },
        timeout=10,
    )
    if token_resp.status_code != 200:
        return _frontend_error('Google sign-in failed. Please try again.')

    token_data   = token_resp.json()
    access_token = token_data.get('access_token')

    # Get user info from Google
    userinfo_resp = http_requests.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10,
    )
    if userinfo_resp.status_code != 200:
        return _frontend_error('Could not retrieve your Google profile.')

    info       = userinfo_resp.json()
    email      = info.get('email', '').lower()
    first_name = info.get('given_name', '')
    last_name  = info.get('family_name', '')

    if not email:
        return _frontend_error('Your Google account has no email address.')

    user, err = _find_or_create_client(email, first_name, last_name)
    if err:
        return _frontend_error(err)

    return _finish_social_login(request, user)


# ── Facebook ───────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_social_start(request):
    """Redirect browser to Facebook OAuth consent screen."""
    state = secrets.token_urlsafe(16)
    request.session['social_state'] = state
    params = {
        'client_id':     FACEBOOK_APP_ID,
        'redirect_uri':  FACEBOOK_SOCIAL_REDIRECT_URI,
        'response_type': 'code',
        'scope':         'public_profile,email',
        'state':         state,
    }
    url = f'https://www.facebook.com/{settings.META_API_VERSION}/dialog/oauth?' + urllib.parse.urlencode(params)
    return redirect(url)


@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_social_callback(request):
    """Facebook redirects here; exchange code → profile → JWT → frontend."""
    error = request.query_params.get('error')
    code  = request.query_params.get('code')

    if error or not code:
        return _frontend_error('Facebook sign-in was cancelled.')

    if not _social_state_valid(request):
        return _frontend_error('Sign-in session expired or was invalid — please try again.')

    # Exchange code for access token
    token_resp = http_requests.get(
        f'https://graph.facebook.com/{settings.META_API_VERSION}/oauth/access_token',
        params={
            'client_id':     FACEBOOK_APP_ID,
            'client_secret': FACEBOOK_APP_SECRET,
            'redirect_uri':  FACEBOOK_SOCIAL_REDIRECT_URI,
            'code':          code,
        },
        timeout=10,
    )
    if token_resp.status_code != 200:
        return _frontend_error('Facebook sign-in failed. Please try again.')

    access_token = token_resp.json().get('access_token')

    # Get user info from Facebook Graph API
    userinfo_resp = http_requests.get(
        f'https://graph.facebook.com/{settings.META_API_VERSION}/me',
        params={
            'fields':       'id,email,first_name,last_name',
            'access_token': access_token,
        },
        timeout=10,
    )
    if userinfo_resp.status_code != 200:
        return _frontend_error('Could not retrieve your Facebook profile.')

    info       = userinfo_resp.json()
    email      = info.get('email', '').lower()
    first_name = info.get('first_name', '')
    last_name  = info.get('last_name', '')

    if not email:
        return _frontend_error('Your Facebook account has no email address. Please use email/password login instead.')

    user, err = _find_or_create_client(email, first_name, last_name)
    if err:
        return _frontend_error(err)

    return _finish_social_login(request, user)


# ── Microsoft ──────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_social_start(request):
    """Redirect browser to Microsoft OAuth consent screen."""
    state = secrets.token_urlsafe(16)
    request.session['social_state'] = state
    params = {
        'client_id':      MICROSOFT_CLIENT_ID,
        'redirect_uri':   MICROSOFT_REDIRECT_URI,
        'response_type':  'code',
        'scope':          'openid email profile User.Read',
        'state':          state,
        'response_mode':  'query',
    }
    url = (
        f'https://login.microsoftonline.com/{MICROSOFT_TENANT}/oauth2/v2.0/authorize?'
        + urllib.parse.urlencode(params)
    )
    return redirect(url)


@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_social_callback(request):
    """Microsoft redirects here; exchange code → profile → JWT → frontend."""
    error = request.query_params.get('error')
    code  = request.query_params.get('code')

    if error or not code:
        return _frontend_error('Microsoft sign-in was cancelled.')

    if not _social_state_valid(request):
        return _frontend_error('Sign-in session expired or was invalid — please try again.')

    # Exchange code for tokens
    token_resp = http_requests.post(
        f'https://login.microsoftonline.com/{MICROSOFT_TENANT}/oauth2/v2.0/token',
        data={
            'client_id':     MICROSOFT_CLIENT_ID,
            'client_secret': MICROSOFT_CLIENT_SECRET,
            'code':          code,
            'redirect_uri':  MICROSOFT_REDIRECT_URI,
            'grant_type':    'authorization_code',
        },
        timeout=10,
    )
    if token_resp.status_code != 200:
        return _frontend_error('Microsoft sign-in failed. Please try again.')

    access_token = token_resp.json().get('access_token')

    # Get user info from Microsoft Graph
    graph_resp = http_requests.get(
        'https://graph.microsoft.com/v1.0/me',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10,
    )
    if graph_resp.status_code != 200:
        return _frontend_error('Could not retrieve your Microsoft profile.')

    data       = graph_resp.json()
    email      = (data.get('mail') or data.get('userPrincipalName', '')).lower()
    first_name = data.get('givenName', '')
    last_name  = data.get('surname', '')

    if not email or '@' not in email:
        return _frontend_error('Your Microsoft account has no valid email address.')

    user, err = _find_or_create_client(email, first_name, last_name)
    if err:
        return _frontend_error(err)

    return _finish_social_login(request, user)
