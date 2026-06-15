# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
OAuth 2.0 handlers for all 5 platforms:
  Facebook, Instagram, YouTube, Google My Business, LinkedIn
"""
import secrets, requests, logging
from urllib.parse import urlencode
from datetime import timedelta

logger = logging.getLogger(__name__)

from django.conf import settings
from django.shortcuts import redirect
from django.utils import timezone
from django.contrib.auth.decorators import login_required

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import PlatformCredential, Client
from django.contrib.auth.models import User
from .marketplace_permissions import (
    resolve_acting_context, check_action, deny_response, approval_pending_response,
)
from .activity_logger import log_activity_for_request

# ── Consumer app (public_profile + email only) ────────────────────────────────
# App ID is public (appears in OAuth URLs). Secret comes from env.
# Both default to the production values; override in env for self-hosted forks.
FACEBOOK_CONSUMER_APP_ID = getattr(
    settings, 'FACEBOOK_CONSUMER_APP_ID', '2880231975675480'
)
FACEBOOK_CONSUMER_REDIRECT = getattr(
    settings, 'FACEBOOK_CONSUMER_REDIRECT_URI',
    'https://socialstats.app/api/oauth/facebook/consumer/callback/',
)

def _facebook_consumer_secret():
    return getattr(settings, 'FACEBOOK_SOCIAL_APP_SECRET', '') or settings.META_APP_SECRET


def _save_credential(client_id, platform, defaults):
    # Connected-platform count is unlimited (free / open source) — no cap.
    PlatformCredential.objects.update_or_create(
        client_id=client_id, platform=platform, defaults={**defaults, 'is_active': True}
    )


def _settings_redirect(client_id, query=''):
    """
    Redirect through /oauth/callback so the frontend can route correctly
    based on the logged-in user's role (admin vs client).
    query is either '?connected=xxx' or '?error=xxx'.
    """
    sep = '&' if query else '?'
    return redirect(
        f"{settings.FRONTEND_URL}/oauth/callback{query}{sep}client_id={client_id}"
    )


# ══════════════════════════════════════════════════════════════════════
# FACEBOOK + INSTAGRAM
# ══════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_oauth_start(request, client_id):
    """
    Use the Business app to request page + Instagram access.
    This is the platform-connect flow (not social login).
    Redirect goes to facebook_oauth_callback which fetches pages + IG.
    """
    state = f"{client_id}:{secrets.token_urlsafe(16)}"
    request.session['oauth_state']     = state
    request.session['oauth_client_id'] = str(client_id)

    logger.info("FB oauth start (business app): client_id=%s app_id=%s", client_id, settings.META_APP_ID)

    params = {
        'client_id':     settings.META_APP_ID,
        'redirect_uri':  settings.META_REDIRECT_URI,
        'scope':         'pages_show_list,pages_read_engagement,pages_manage_metadata,instagram_manage_insights,read_insights',
        'response_type': 'code',
        'state':          state,
    }
    return redirect(f"https://www.facebook.com/dialog/oauth?{urlencode(params)}")


@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_consumer_callback(request):
    """
    Step 1 callback: exchange code for user identity, then redirect to Step 2 (Business app).
    """
    code  = request.GET.get('code')
    state = request.GET.get('state', '')
    error = request.GET.get('error')

    if error or not code:
        client_id = state.split(':')[0] if state else '0'
        return _settings_redirect(client_id, '?error=facebook_denied')

    client_id = state.split(':')[0]

    logger.info(
        "FB consumer callback: client_id=%s app_id=%s redirect=%s",
        client_id, FACEBOOK_CONSUMER_APP_ID, FACEBOOK_CONSUMER_REDIRECT
    )

    # Exchange code for consumer token
    token_resp = requests.get(
        "https://graph.facebook.com/v21.0/oauth/access_token",
        params={
            'client_id':     FACEBOOK_CONSUMER_APP_ID,
            'client_secret': _facebook_consumer_secret(),
            'redirect_uri':  FACEBOOK_CONSUMER_REDIRECT,
            'code':          code,
        }, timeout=10
    ).json()

    if 'error' in token_resp:
        logger.error(
            "FB consumer token exchange failed: app_id=%s error=%s",
            FACEBOOK_CONSUMER_APP_ID, token_resp.get('error')
        )
        return _settings_redirect(client_id, '?error=facebook_consumer_token')

    consumer_token = token_resp.get('access_token', '')
    expires_in     = token_resp.get('expires_in', 5184000)
    expires_at     = timezone.now() + timedelta(seconds=expires_in)

    # Extend to long-lived token (60 days)
    long_resp = requests.get(
        'https://graph.facebook.com/v21.0/oauth/access_token',
        params={
            'grant_type':        'fb_exchange_token',
            'client_id':         FACEBOOK_CONSUMER_APP_ID,
            'client_secret':     _facebook_consumer_secret(),
            'fb_exchange_token': consumer_token,
        }, timeout=10
    ).json()
    long_token = long_resp.get('access_token', consumer_token)
    ll_expires_in = long_resp.get('expires_in', expires_in)
    expires_at = timezone.now() + timedelta(seconds=ll_expires_in)

    # Fetch pages this user manages
    pages_resp = requests.get(
        'https://graph.facebook.com/v21.0/me/accounts',
        params={'access_token': long_token, 'fields': 'id,name,access_token'},
        timeout=10
    ).json()
    pages = pages_resp.get('data', [])

    logger.info("FB consumer pages for client %s: %s", client_id, [p.get('name') for p in pages])

    if pages:
        page       = pages[0]
        page_id    = page['id']
        page_name  = page.get('name', 'Facebook Page')
        page_token = page.get('access_token', long_token)

        _save_credential(client_id, 'facebook', {
            'access_token':  page_token,
            'refresh_token': long_token,
            'expires_at':    expires_at,
            'page_id':       page_id,
            'page_name':     page_name,
        })

        # Try to get linked Instagram Business Account
        ig_resp = requests.get(
            f'https://graph.facebook.com/v21.0/{page_id}',
            params={'fields': 'instagram_business_account', 'access_token': page_token},
            timeout=10
        ).json()
        ig_id = ig_resp.get('instagram_business_account', {}).get('id', '')
        if ig_id:
            ig_info = requests.get(
                f'https://graph.facebook.com/v21.0/{ig_id}',
                params={'fields': 'name,username', 'access_token': page_token},
                timeout=10
            ).json()
            _save_credential(client_id, 'instagram', {
                'access_token':         page_token,
                'refresh_token':        long_token,
                'expires_at':           expires_at,
                'page_id':              page_id,
                'page_name':            ig_info.get('username', page_name),
                'instagram_account_id': ig_id,
            })
    else:
        # No pages found — save user identity token so UI shows connected
        me_resp = requests.get(
            'https://graph.facebook.com/v21.0/me',
            params={'fields': 'name', 'access_token': long_token},
            timeout=10
        ).json()
        _save_credential(client_id, 'facebook', {
            'access_token':  long_token,
            'refresh_token': long_token,
            'expires_at':    expires_at,
            'page_name':     me_resp.get('name', 'Facebook User'),
        })
        logger.warning("FB: no pages found for client %s — saved user token only", client_id)

    # ── Step 2: Business app (uncomment after Meta App Review approval) ────────
    # biz_state = f"{client_id}:{secrets.token_urlsafe(16)}"
    # request.session['oauth_state']     = biz_state
    # request.session['oauth_client_id'] = str(client_id)
    # params = {
    #     'client_id':     settings.META_APP_ID,
    #     'redirect_uri':  settings.META_REDIRECT_URI,
    #     'scope':         ','.join([
    #         'pages_show_list',
    #         'pages_read_engagement',
    #         'pages_manage_metadata',
    #     ]),
    #     'response_type': 'code',
    #     'state':          biz_state,
    # }
    # return redirect(f"https://www.facebook.com/dialog/oauth?{urlencode(params)}")
    # ──────────────────────────────────────────────────────────────────────────

    # For now: consumer login complete, redirect back to settings
    return _settings_redirect(client_id, '?connected=facebook')


@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_oauth_callback(request):
    """Exchange code for tokens, fetch page/IG IDs, save to DB."""
    code      = request.GET.get('code')
    state     = request.GET.get('state', '')
    error     = request.GET.get('error')
    client_id = state.split(':')[0] if ':' in state else state or '0'

    if error:
        return _settings_redirect(client_id, '?error=facebook_denied')

    # Step 1: Short-lived token
    token_resp = requests.get(
        f"https://graph.facebook.com/{settings.META_API_VERSION}/oauth/access_token",
        params={
            'client_id':     settings.META_APP_ID,
            'client_secret': settings.META_APP_SECRET,
            'redirect_uri':  settings.META_REDIRECT_URI,
            'code':           code,
        }, timeout=10
    ).json()

    logger.info("FB business callback: client_id=%s token_resp_keys=%s", client_id, list(token_resp.keys()))

    if 'error' in token_resp:
        logger.error("FB business token error: %s", token_resp)
        return _settings_redirect(client_id, '?error=facebook_token')

    short_token = token_resp['access_token']

    # Step 2: Long-lived token (60 days)
    long_resp = requests.get(
        f"https://graph.facebook.com/{settings.META_API_VERSION}/oauth/access_token",
        params={
            'grant_type':        'fb_exchange_token',
            'client_id':          settings.META_APP_ID,
            'client_secret':      settings.META_APP_SECRET,
            'fb_exchange_token':  short_token,
        }, timeout=10
    ).json()

    long_token = long_resp.get('access_token', short_token)
    expires_in = long_resp.get('expires_in', 5184000)
    expires_at = timezone.now() + timedelta(seconds=expires_in)

    # Step 3: Get Pages the user manages
    pages = requests.get(
        f"https://graph.facebook.com/{settings.META_API_VERSION}/me/accounts",
        params={'access_token': long_token}, timeout=10
    ).json().get('data', [])

    # Log granted permissions — helps diagnose if Meta stripped a scope
    # (e.g. instagram_manage_insights not yet approved by App Review).
    try:
        perms_resp = requests.get(
            f"https://graph.facebook.com/{settings.META_API_VERSION}/me/permissions",
            params={'access_token': long_token}, timeout=10
        ).json()
        granted = [p.get('permission') for p in perms_resp.get('data', []) if p.get('status') == 'granted']
        logger.info("FB granted permissions for client %s: %s", client_id, granted)
    except Exception as e:
        logger.warning("FB permissions probe failed for client %s: %s", client_id, e)

    if not pages:
        logger.warning("FB callback: /me/accounts returned no pages for client %s", client_id)
        return _settings_redirect(client_id, '?error=facebook_no_pages')

    # Step 4: Probe every page for a linked Instagram Business Account.
    # Prefer the first page that has IG linked. If none do, fall back to
    # pages[0] for FB-only credential.
    chosen_page = None
    chosen_ig_id = ''
    for page in pages:
        page_id    = page['id']
        page_name  = page.get('name', '')
        page_token = page.get('access_token', long_token)

        ig_resp = requests.get(
            f"https://graph.facebook.com/{settings.META_API_VERSION}/{page_id}",
            params={
                'fields':       'instagram_business_account',
                'access_token': page_token,
            }, timeout=10
        ).json()

        ig_id = ig_resp.get('instagram_business_account', {}).get('id', '')
        logger.info(
            "FB page candidate: client=%s page_id=%s name=%s ig_id=%r ig_resp=%s",
            client_id, page_id, page_name, ig_id, ig_resp
        )

        if ig_id and not chosen_page:
            chosen_page  = page
            chosen_ig_id = ig_id
            break

    if chosen_page is None:
        chosen_page = pages[0]

    page_id    = chosen_page['id']
    page_name  = chosen_page.get('name', '')
    page_token = chosen_page.get('access_token', long_token)

    connected = []

    # Save Facebook credential for the chosen page
    _save_credential(client_id, 'facebook', {
        'access_token':  page_token,
        'refresh_token': long_token,
        'expires_at':    expires_at,
        'page_id':       page_id,
        'page_name':     page_name,
    })
    connected.append('facebook')

    # Save Instagram credential if a linked IG Business Account was found
    if chosen_ig_id:
        ig_info = requests.get(
            f"https://graph.facebook.com/{settings.META_API_VERSION}/{chosen_ig_id}",
            params={'fields': 'name,username', 'access_token': page_token}, timeout=10
        ).json()

        _save_credential(client_id, 'instagram', {
            'access_token':          page_token,
            'refresh_token':         long_token,
            'expires_at':            expires_at,
            'page_id':               page_id,
            'page_name':             ig_info.get('username', page_name),
            'instagram_account_id':  chosen_ig_id,
        })
        connected.append('instagram')
    else:
        logger.warning(
            "FB callback: no page with linked Instagram for client %s (checked %d pages)",
            client_id, len(pages)
        )

    platforms = ','.join(connected)
    return _settings_redirect(client_id, f"?connected={platforms}")


# ══════════════════════════════════════════════════════════════════════
# GOOGLE (YouTube + Google My Business) — One OAuth flow, two APIs
# ══════════════════════════════════════════════════════════════════════

GOOGLE_SCOPES_YOUTUBE = ' '.join([
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'openid', 'email', 'profile',
])

GOOGLE_SCOPES_GMB = ' '.join([
    'https://www.googleapis.com/auth/business.manage',
    'openid', 'email', 'profile',
])

# Keep combined for backwards compatibility
GOOGLE_SCOPES = ' '.join([
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/business.manage',
    'openid', 'email', 'profile',
])

@api_view(['GET'])
@permission_classes([AllowAny])
def google_oauth_start(request, client_id):
    """Redirect to Google consent screen.
    Optional ?platform=youtube or ?platform=google_my_business for separate flows.
    """
    platform = request.GET.get('platform', 'all')  # youtube | google_my_business | all
    state = f"{client_id}:{platform}:{secrets.token_urlsafe(16)}"
    request.session['oauth_state'] = state

    if platform == 'youtube':
        scopes = GOOGLE_SCOPES_YOUTUBE
    elif platform == 'google_my_business':
        scopes = GOOGLE_SCOPES_GMB
    else:
        scopes = GOOGLE_SCOPES

    params = {
        'client_id':     settings.GOOGLE_CLIENT_ID,
        'redirect_uri':  settings.GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope':          scopes,
        'access_type':   'offline',
        'prompt':        'consent',
        'state':          state,
    }
    return redirect(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@api_view(['GET'])
@permission_classes([AllowAny])
def google_oauth_callback(request):
    """Exchange code for tokens, fetch YouTube channel + GMB location."""
    code      = request.GET.get('code')
    state     = request.GET.get('state', '')
    error     = request.GET.get('error')

    if error:
        return redirect(f"{settings.FRONTEND_URL}/settings?error=google_denied")

    parts = state.split(':')
    client_id = parts[0]
    platform  = parts[1] if len(parts) >= 3 else 'all'  # youtube | google_my_business | all

    # Exchange code for tokens
    token_resp = requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'code':          code,
            'client_id':     settings.GOOGLE_CLIENT_ID,
            'client_secret': settings.GOOGLE_CLIENT_SECRET,
            'redirect_uri':  settings.GOOGLE_REDIRECT_URI,
            'grant_type':    'authorization_code',
        }, timeout=10
    ).json()

    if 'error' in token_resp:
        logger.error("Google token exchange failed: %s", token_resp)
        return redirect(f"{settings.FRONTEND_URL}/settings?error=google_token")

    access_token  = token_resp['access_token']
    refresh_token = token_resp.get('refresh_token', '')
    expires_in    = token_resp.get('expires_in', 3600)
    expires_at    = timezone.now() + timedelta(seconds=expires_in)

    connected = []

    # ── YouTube ───────────────────────────────────────────
    if platform in ('youtube', 'all'):
        yt_resp = requests.get(
            'https://www.googleapis.com/youtube/v3/channels',
            params={
                'part':        'snippet,statistics',
                'mine':        'true',
                'access_token': access_token,
            }, timeout=10
        ).json()

        logger.info("YouTube channels response: %s", yt_resp)

        yt_items = yt_resp.get('items', [])
        if yt_items:
            channel      = yt_items[0]
            channel_id   = channel['id']
            channel_name = channel['snippet']['title']

            _save_credential(client_id, 'youtube', {
                'access_token':  access_token,
                'refresh_token': refresh_token,
                'expires_at':    expires_at,
                'channel_id':    channel_id,
                'channel_name':  channel_name,
            })
            connected.append('youtube')

    # ── Google My Business ────────────────────────────────
    if platform in ('google_my_business', 'all'):
        gmb_accounts_resp = requests.get(
            'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
            headers={'Authorization': f'Bearer {access_token}'}, timeout=10
        )
        gmb_accounts = gmb_accounts_resp.json()
        logger.info("GMB accounts status=%s body=%s", gmb_accounts_resp.status_code, gmb_accounts)

        accounts = gmb_accounts.get('accounts', [])
        if accounts:
            gmb_account_id = accounts[0]['name']

            gmb_locations_resp = requests.get(
                f'https://mybusinessbusinessinformation.googleapis.com/v1/{gmb_account_id}/locations',
                params={'readMask': 'name,title'},
                headers={'Authorization': f'Bearer {access_token}'}, timeout=10
            )
            gmb_locations = gmb_locations_resp.json()
            logger.info("GMB locations status=%s body=%s", gmb_locations_resp.status_code, gmb_locations)

            locations = gmb_locations.get('locations', [])
            if locations:
                location    = locations[0]
                location_id = location['name']
                biz_name    = location.get('title', '')

                _save_credential(client_id, 'google_my_business', {
                    'access_token':    access_token,
                    'refresh_token':   refresh_token,
                    'expires_at':      expires_at,
                    'gmb_account_id':  gmb_account_id,
                    'gmb_location_id': location_id,
                    'page_name':       biz_name,
                })
                connected.append('google_my_business')
            else:
                # No locations found — save token anyway so user shows as connected
                logger.warning("GMB: no locations found for account %s", gmb_account_id)
                _save_credential(client_id, 'google_my_business', {
                    'access_token':    access_token,
                    'refresh_token':   refresh_token,
                    'expires_at':      expires_at,
                    'gmb_account_id':  gmb_account_id,
                    'gmb_location_id': '',
                    'page_name':       accounts[0].get('accountName', 'Google My Business'),
                })
                connected.append('google_my_business')
        else:
            # No GMB account — still save the token with the Google profile name
            logger.warning("GMB: no accounts found. Response: %s", gmb_accounts)
            user_info = requests.get(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {access_token}'}, timeout=10
            ).json()
            _save_credential(client_id, 'google_my_business', {
                'access_token':    access_token,
                'refresh_token':   refresh_token,
                'expires_at':      expires_at,
                'gmb_account_id':  '',
                'gmb_location_id': '',
                'page_name':       user_info.get('name', 'Google My Business'),
            })
            connected.append('google_my_business')

    platforms = ','.join(connected)
    return _settings_redirect(client_id, f"?connected={platforms}")


# ══════════════════════════════════════════════════════════════════════
# LINKEDIN
# ══════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def linkedin_oauth_start(request, client_id):
    """Redirect to LinkedIn consent screen."""
    state = f"{client_id}:{secrets.token_urlsafe(16)}"
    request.session['oauth_state'] = state

    params = {
        'response_type': 'code',
        'client_id':      settings.LINKEDIN_CLIENT_ID,
        'redirect_uri':   settings.LINKEDIN_REDIRECT_URI,
        'state':           state,
        # OpenID Connect scopes only — these don't require LinkedIn Community
        # Management API approval. Org-level analytics (organizationAcls /
        # organizationPageStatistics) require approval on a dedicated LinkedIn
        # app and will be added back once that approval is granted.
        'scope':          'openid profile email',
    }
    return redirect(f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}")


@api_view(['GET'])
@permission_classes([AllowAny])
def linkedin_oauth_callback(request):
    """Exchange code for LinkedIn token, fetch organization ID."""
    code      = request.GET.get('code')
    state     = request.GET.get('state', '')
    error     = request.GET.get('error')

    if error:
        return redirect(f"{settings.FRONTEND_URL}/settings?error=linkedin_denied")

    client_id = state.split(':')[0]

    # Exchange code for access token
    token_resp = requests.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        data={
            'grant_type':    'authorization_code',
            'code':           code,
            'redirect_uri':   settings.LINKEDIN_REDIRECT_URI,
            'client_id':      settings.LINKEDIN_CLIENT_ID,
            'client_secret':  settings.LINKEDIN_CLIENT_SECRET,
        },
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        timeout=10
    ).json()

    if 'error' in token_resp:
        return redirect(f"{settings.FRONTEND_URL}/settings?error=linkedin_token")

    access_token  = token_resp['access_token']
    expires_in    = token_resp.get('expires_in', 5184000)
    refresh_token = token_resp.get('refresh_token', '')
    expires_at    = timezone.now() + timedelta(seconds=expires_in)

    # OpenID Connect userinfo — works with the basic OIDC scopes above and does
    # NOT require Community Management API approval.
    # NOTE: Org-level analytics (organizationAcls / organizationPageStatistics)
    # require Community Management API approval on a dedicated LinkedIn app.
    # Until that is granted, we only store the user's LinkedIn identity.
    userinfo_resp = requests.get(
        'https://api.linkedin.com/v2/userinfo',
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10
    ).json()

    user_sub  = str(userinfo_resp.get('sub', ''))
    user_name = userinfo_resp.get('name', '') or userinfo_resp.get('given_name', '')

    _save_credential(client_id, 'linkedin', {
        'access_token':      access_token,
        'refresh_token':     refresh_token,
        'expires_at':        expires_at,
        'organization_id':   user_sub,
        'organization_name': user_name,
    })

    return _settings_redirect(client_id, "?connected=linkedin")


# ══════════════════════════════════════════════════════════════════════
# STATUS CHECK — used by React to show connected/disconnected
# ══════════════════════════════════════════════════════════════════════

def _refresh_google_token(cred):
    """Refresh an expired Google OAuth access token using the stored refresh_token."""
    try:
        resp = requests.post('https://oauth2.googleapis.com/token', data={
            'client_id':     settings.GOOGLE_CLIENT_ID,
            'client_secret': settings.GOOGLE_CLIENT_SECRET,
            'refresh_token': cred.refresh_token,
            'grant_type':    'refresh_token',
        }, timeout=10).json()
        if 'access_token' in resp:
            cred.access_token = resp['access_token']
            cred.expires_at   = timezone.now() + timedelta(seconds=resp.get('expires_in', 3600))
            cred.save(update_fields=['access_token', 'expires_at'])
    except Exception as e:
        logger.warning(f"Google token refresh failed for cred {cred.id}: {e}")


def _refresh_facebook_token(cred):
    """Extend a Facebook long-lived token (valid for 60 more days)."""
    try:
        resp = requests.get('https://graph.facebook.com/v21.0/oauth/access_token', params={
            'grant_type':        'fb_exchange_token',
            'client_id':         settings.META_APP_ID,
            'client_secret':     settings.META_APP_SECRET,
            'fb_exchange_token': cred.refresh_token or cred.access_token,
        }, timeout=10).json()
        if 'access_token' in resp:
            expires_in = resp.get('expires_in', 5184000)
            cred.access_token = resp['access_token']
            cred.expires_at   = timezone.now() + timedelta(seconds=expires_in)
            cred.save(update_fields=['access_token', 'expires_at'])
    except Exception as e:
        logger.warning(f"Facebook token refresh failed for cred {cred.id}: {e}")


@api_view(['GET'])
def oauth_status(request, client_id):
    """Return connection status for all platforms. Auto-refreshes expired Google tokens."""
    credentials = PlatformCredential.objects.filter(client_id=client_id)
    result = {}
    for platform, label in [
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
        ('youtube', 'YouTube'),
        ('linkedin', 'LinkedIn'),
        ('google_my_business', 'Google My Business'),
    ]:
        cred = credentials.filter(platform=platform).first()
        if cred and cred.access_token:
            # Auto-refresh expired Google tokens silently
            if cred.is_expired and cred.refresh_token:
                if platform in ('youtube', 'google_my_business'):
                    _refresh_google_token(cred)
                elif platform in ('facebook', 'instagram'):
                    _refresh_facebook_token(cred)
            result[platform] = {
                'status':       cred.status,
                'connected_at': cred.connected_at.isoformat(),
                'expires_at':   cred.expires_at.isoformat() if cred.expires_at else None,
                'account_name': cred.page_name or cred.channel_name or cred.organization_name or '',
            }
        else:
            result[platform] = {'status': 'not_connected'}

    return Response(result)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def oauth_disconnect(request, client_id, platform):
    """Disconnect a platform — delete stored tokens.

    Rule #9 of the marketplace spec: end-users can ALWAYS disconnect platforms,
    even on agency-managed workspaces. So owners and superadmins bypass the
    permission check; agency-side actors must hold disconnect_platforms.
    """
    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        return Response({'error': 'workspace not found'}, status=404)

    role, relation = resolve_acting_context(request, client)
    if role == 'forbidden':
        return Response({'error': 'forbidden'}, status=403)
    if role == 'agency':
        verdict, ctx = check_action(
            request, client, 'disconnect_platforms',
            action_type='disconnect_platform',
            payload={'platform': platform},
            target_object_type='PlatformCredential',
            preview=f'Disconnect {platform}',
        )
        if verdict == 'denied':
            return deny_response(ctx['reason'])
        if verdict == 'approval_required':
            return approval_pending_response(ctx['approval'])

    PlatformCredential.objects.filter(
        client_id=client_id, platform=platform
    ).update(access_token='', refresh_token='', is_active=False)

    log_activity_for_request(
        request, client,
        action_type='platform_disconnected',
        description=f'Disconnected {platform}',
        severity='warning',
        target_object_type='PlatformCredential',
        metadata={'platform': platform},
        is_reversible=False,
    )
    return Response({'message': f'{platform} disconnected'})


@api_view(['GET'])
def oauth_debug(request):
    """Debug endpoint — shows current OAuth config. Superadmin only."""
    try:
        role = request.user.profile.role
        if role not in ('superadmin', 'staff'):
            return Response({'error': 'forbidden'}, status=403)
    except Exception:
        return Response({'error': 'forbidden'}, status=403)

    secret = _facebook_consumer_secret()
    return Response({
        'facebook_consumer_app_id':        FACEBOOK_CONSUMER_APP_ID,
        'facebook_consumer_redirect':      FACEBOOK_CONSUMER_REDIRECT,
        'facebook_consumer_secret_set':    bool(secret),
        'facebook_consumer_secret_prefix': secret[:6] + '...' if secret else '(empty)',
        'meta_app_id':                     settings.META_APP_ID,
        'FACEBOOK_SOCIAL_APP_SECRET_env':  bool(getattr(settings, 'FACEBOOK_SOCIAL_APP_SECRET', '')),
    })
