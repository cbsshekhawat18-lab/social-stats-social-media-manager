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


def _save_credential(client_id, platform, defaults):
    PlatformCredential.objects.update_or_create(
        client_id=client_id, platform=platform, defaults={**defaults, 'is_active': True}
    )


# ══════════════════════════════════════════════════════════════════════
# FACEBOOK + INSTAGRAM
# ══════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_oauth_start(request, client_id):
    """Redirect to Facebook login consent screen."""
    state = f"{client_id}:{secrets.token_urlsafe(16)}"
    request.session['oauth_state'] = state
    request.session['oauth_client_id'] = str(client_id)

    params = {
        'client_id':     settings.META_APP_ID,
        'redirect_uri':  settings.META_REDIRECT_URI,
        'scope':         ','.join([
            'pages_read_engagement',
            'pages_show_list',
            'read_insights',
            'instagram_basic',
            'instagram_manage_insights',
            'pages_manage_metadata',
        ]),
        'response_type': 'code',
        'state':          state,
    }
    return redirect(f"https://www.facebook.com/dialog/oauth?{urlencode(params)}")


@api_view(['GET'])
@permission_classes([AllowAny])
def facebook_oauth_callback(request):
    """Exchange code for tokens, fetch page/IG IDs, save to DB."""
    code      = request.GET.get('code')
    state     = request.GET.get('state', '')
    error     = request.GET.get('error')

    if error:
        return redirect(f"{settings.FRONTEND_URL}/settings?error=facebook_denied")

    client_id = state.split(':')[0]

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

    if 'error' in token_resp:
        return redirect(f"{settings.FRONTEND_URL}/settings?error=facebook_token")

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

    connected = []

    for page in pages:
        page_id    = page['id']
        page_name  = page.get('name', '')
        page_token = page.get('access_token', long_token)

        # Save Facebook credential
        _save_credential(client_id, 'facebook', {
            'access_token':  page_token,
            'refresh_token': long_token,
            'expires_at':    expires_at,
            'page_id':       page_id,
            'page_name':     page_name,
        })
        connected.append('facebook')

        # Step 4: Get linked Instagram Business Account
        ig_resp = requests.get(
            f"https://graph.facebook.com/{settings.META_API_VERSION}/{page_id}",
            params={
                'fields':       'instagram_business_account',
                'access_token': page_token,
            }, timeout=10
        ).json()

        ig_id = ig_resp.get('instagram_business_account', {}).get('id', '')
        if ig_id:
            # Get IG username
            ig_info = requests.get(
                f"https://graph.facebook.com/{settings.META_API_VERSION}/{ig_id}",
                params={'fields': 'name,username', 'access_token': page_token}, timeout=10
            ).json()

            _save_credential(client_id, 'instagram', {
                'access_token':          page_token,
                'refresh_token':         long_token,
                'expires_at':            expires_at,
                'page_id':               page_id,
                'page_name':             ig_info.get('username', page_name),
                'instagram_account_id':  ig_id,
            })
            connected.append('instagram')
        break  # Use first page only (can extend to page picker)

    platforms = ','.join(connected)
    return redirect(f"{settings.FRONTEND_URL}/admin/client/{client_id}/settings?connected={platforms}")


# ══════════════════════════════════════════════════════════════════════
# GOOGLE (YouTube + Google My Business) — One OAuth flow, two APIs
# ══════════════════════════════════════════════════════════════════════

GOOGLE_SCOPES = ' '.join([
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/business.manage',
    'openid',
    'email',
    'profile',
])

@api_view(['GET'])
@permission_classes([AllowAny])
def google_oauth_start(request, client_id):
    """Redirect to Google consent screen."""
    state = f"{client_id}:{secrets.token_urlsafe(16)}"
    request.session['oauth_state'] = state

    params = {
        'client_id':     settings.GOOGLE_CLIENT_ID,
        'redirect_uri':  settings.GOOGLE_REDIRECT_URI,
        'response_type': 'code',
        'scope':          GOOGLE_SCOPES,
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

    client_id = state.split(':')[0]

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

    # ── YouTube: get channel info ─────────────────────────
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
        channel     = yt_items[0]
        channel_id  = channel['id']
        channel_name= channel['snippet']['title']

        _save_credential(client_id, 'youtube', {
            'access_token':  access_token,
            'refresh_token': refresh_token,
            'expires_at':    expires_at,
            'channel_id':    channel_id,
            'channel_name':  channel_name,
        })
        connected.append('youtube')

    # ── Google My Business: get account + location ────────
    gmb_accounts = requests.get(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        headers={'Authorization': f'Bearer {access_token}'}, timeout=10
    ).json()

    accounts = gmb_accounts.get('accounts', [])
    if accounts:
        gmb_account_id = accounts[0]['name']  # e.g. "accounts/123456"

        gmb_locations = requests.get(
            f'https://mybusinessbusinessinformation.googleapis.com/v1/{gmb_account_id}/locations',
            params={'readMask': 'name,title'},
            headers={'Authorization': f'Bearer {access_token}'}, timeout=10
        ).json()

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

    platforms = ','.join(connected)
    return redirect(f"{settings.FRONTEND_URL}/admin/client/{client_id}/settings?connected={platforms}")


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
        'scope':          'r_organization_social rw_organization_admin r_basicprofile openid email',
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

    # Get organizations the user is admin of
    orgs_resp = requests.get(
        'https://api.linkedin.com/v2/organizationAcls',
        params={
            'q':        'roleAssignee',
            'role':     'ADMINISTRATOR',
            'projection': '(elements*(organization~(id,localizedName)))',
        },
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10
    ).json()

    elements = orgs_resp.get('elements', [])
    if elements:
        org      = elements[0].get('organization~', {})
        org_id   = str(org.get('id', ''))
        org_name = org.get('localizedName', '')

        _save_credential(client_id, 'linkedin', {
            'access_token':    access_token,
            'refresh_token':   refresh_token,
            'expires_at':      expires_at,
            'organization_id': org_id,
            'organization_name': org_name,
        })

    return redirect(f"{settings.FRONTEND_URL}/admin/client/{client_id}/settings?connected=linkedin")


# ══════════════════════════════════════════════════════════════════════
# STATUS CHECK — used by React to show connected/disconnected
# ══════════════════════════════════════════════════════════════════════

@api_view(['GET'])
def oauth_status(request, client_id):
    """Return connection status for all platforms for a client."""
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
def oauth_disconnect(request, client_id, platform):
    """Disconnect a platform — delete stored tokens."""
    PlatformCredential.objects.filter(
        client_id=client_id, platform=platform
    ).update(access_token='', refresh_token='', is_active=False)
    return Response({'message': f'{platform} disconnected'})
