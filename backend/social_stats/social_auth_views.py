"""
Social login views for Google, Microsoft, and Facebook OAuth.
Client users only — superadmin/staff are blocked.
"""
import secrets
import urllib.parse

import requests as http_requests
from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import redirect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile, ensure_client_profile


GOOGLE_CLIENT_ID      = settings.GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET  = settings.GOOGLE_CLIENT_SECRET
GOOGLE_SOCIAL_REDIRECT_URI = getattr(
    settings, 'GOOGLE_SOCIAL_REDIRECT_URI',
    'http://localhost:8000/api/auth/social/google/callback/'
)

FACEBOOK_APP_ID     = getattr(settings, 'META_APP_ID', '')
FACEBOOK_APP_SECRET = getattr(settings, 'META_APP_SECRET', '')
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
    UserProfile.objects.create(user=user, role='client')
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

    access, refresh = _make_jwt(user)
    return redirect(f'{FRONTEND_CALLBACK}?access={access}&refresh={refresh}')


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
        'scope':         'public_profile',
        'state':         state,
    }
    url = 'https://www.facebook.com/v18.0/dialog/oauth?' + urllib.parse.urlencode(params)
    return redirect(url)


@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_social_callback(request):
    """Facebook redirects here; exchange code → profile → JWT → frontend."""
    error = request.query_params.get('error')
    code  = request.query_params.get('code')

    if error or not code:
        return _frontend_error('Facebook sign-in was cancelled.')

    # Exchange code for access token
    token_resp = http_requests.get(
        'https://graph.facebook.com/v18.0/oauth/access_token',
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
        'https://graph.facebook.com/v18.0/me',
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

    access, refresh = _make_jwt(user)
    return redirect(f'{FRONTEND_CALLBACK}?access={access}&refresh={refresh}')


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

    access, refresh = _make_jwt(user)
    return redirect(f'{FRONTEND_CALLBACK}?access={access}&refresh={refresh}')
