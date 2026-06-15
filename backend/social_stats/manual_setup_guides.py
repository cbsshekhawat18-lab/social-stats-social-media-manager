# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Friendly, hand-holding setup guides served to the Manual Setup Wizard.
Aimed at non-technical users (real estate agents, hospital admins, etc.).

Each guide has:
  - platform, title, estimated_time, intro, steps, fields, tips
"""

FACEBOOK = {
    'platform': 'facebook',
    'title': 'Connect Facebook Page (Manual Setup)',
    'estimated_time': '5–10 minutes',
    'intro': (
        'Social Stats is currently in app review with Meta. While that wraps up, you '
        'can connect your Facebook Page using your own Meta Business account. '
        'Your tokens stay encrypted and only you can see them.'
    ),
    'requirements': [
        'A Facebook Page you manage as Admin',
        'Access to Meta Business Suite (business.facebook.com)',
    ],
    'steps': [
        {
            'title': 'Open Meta Business Suite',
            'description': 'Sign in at https://business.facebook.com and pick the Business Account that owns your Page.',
            'external_link': 'https://business.facebook.com',
            'cta': 'Open Meta Business Suite',
        },
        {
            'title': 'Open Business Settings',
            'description': 'Click the gear icon in the bottom-left → Business Settings.',
        },
        {
            'title': 'Create a System User',
            'description': 'Under Users → System Users, click "Add". Name it "Social Stats Integration", role: Admin. (System Users give long-lived tokens that don\'t expire — recommended.)',
        },
        {
            'title': 'Assign your Page to the System User',
            'description': 'Click "Add Assets" → Pages → select your Page → toggle "Manage Page" + "Manage Page Performance" → Save.',
        },
        {
            'title': 'Generate the Page Access Token',
            'description': 'With the System User selected, click "Generate New Token". Pick the Social Stats Meta App (or any app you control). Select these permissions and click Generate:',
            'bullets': [
                'pages_show_list',
                'pages_read_engagement',
                'pages_read_user_content',
                'read_insights',
                'pages_manage_metadata',
            ],
            'warning': 'Copy the token NOW — Meta only shows it once. It looks like "EAA..." and is ~200 characters long.',
        },
        {
            'title': 'Find your Page ID',
            'description': 'Open your Facebook Page → About tab → scroll to "Page Transparency". The Page ID is the long number under "ID".',
        },
        {
            'title': 'Paste both into Social Stats below',
            'description': 'Click "Save & Test Connection". Social Stats will verify the token works before saving.',
        },
    ],
    'fields': [
        {
            'name': 'page_id',
            'label': 'Facebook Page ID',
            'type': 'text',
            'placeholder': 'e.g. 105234567890123',
            'help': 'Find under your Page → About → Page Transparency.',
            'required': True,
        },
        {
            'name': 'page_access_token',
            'label': 'Page Access Token',
            'type': 'password',
            'placeholder': 'EAA...',
            'help': 'The long token from the System User you generated above.',
            'required': True,
        },
    ],
    'tips': [
        'System User tokens don\'t expire — best for production.',
        'If you used the Graph API Explorer instead, the token may expire in 60 days.',
        'Social Stats encrypts your token at rest and only uses it to read insights.',
    ],
}


INSTAGRAM = {
    'platform': 'instagram',
    'title': 'Connect Instagram Business (Manual Setup)',
    'estimated_time': '5–10 minutes',
    'intro': (
        'Instagram uses the same Page Access Token as your linked Facebook Page. '
        'Make sure your Instagram account is a Business or Creator account and is '
        'linked to a Facebook Page first.'
    ),
    'requirements': [
        'An Instagram Business or Creator account (NOT a personal account)',
        'That Instagram account linked to a Facebook Page',
        'A Page Access Token for that Facebook Page (see Facebook guide)',
    ],
    'steps': [
        {
            'title': 'Make sure Instagram is connected to your Facebook Page',
            'description': 'In Meta Business Suite → Settings → Accounts → Instagram accounts. Your IG account should show "Connected".',
        },
        {
            'title': 'Get your Instagram Business Account ID',
            'description': 'Open the Graph API Explorer and run: GET /{your_facebook_page_id}?fields=instagram_business_account. The "id" returned is your IG Business Account ID.',
            'external_link': 'https://developers.facebook.com/tools/explorer',
            'cta': 'Open Graph API Explorer',
        },
        {
            'title': 'Use the same Page Access Token',
            'description': 'Reuse the long-lived token you generated for the Facebook step. Both Facebook and Instagram share the same token.',
        },
        {
            'title': 'Paste into Social Stats below',
            'description': 'Social Stats will verify the token can read your Instagram insights before saving.',
        },
    ],
    'fields': [
        {
            'name': 'instagram_account_id',
            'label': 'Instagram Business Account ID',
            'type': 'text',
            'placeholder': 'e.g. 17841401234567890',
            'help': 'The numeric IG Business Account ID — NOT your @handle.',
            'required': True,
        },
        {
            'name': 'page_access_token',
            'label': 'Page Access Token',
            'type': 'password',
            'placeholder': 'EAA...',
            'help': 'Same token as the linked Facebook Page.',
            'required': True,
        },
    ],
    'tips': [
        'Instagram personal accounts cannot be connected — convert to a Business account first.',
        'If your IG account is freshly converted, Meta may take a few minutes to enable insights.',
    ],
}


YOUTUBE = {
    'platform': 'youtube',
    'title': 'Connect YouTube Channel (Manual Setup)',
    'estimated_time': '10–15 minutes',
    'intro': (
        'YouTube needs a Google Cloud project that you own. We\'ll have you create '
        'an OAuth client and generate a refresh token via the Google OAuth Playground. '
        'This sounds technical but it\'s well-documented and free.'
    ),
    'requirements': [
        'A Google account that owns or manages your YouTube channel',
        'The ability to create a free Google Cloud project',
    ],
    'steps': [
        {
            'title': 'Create a Google Cloud project',
            'description': 'Visit Google Cloud Console → New Project → name it "Social Stats-{YourCompany}".',
            'external_link': 'https://console.cloud.google.com/projectcreate',
            'cta': 'Open Google Cloud Console',
        },
        {
            'title': 'Enable the YouTube APIs',
            'description': 'In your new project: APIs & Services → Library. Enable BOTH:',
            'bullets': [
                'YouTube Data API v3',
                'YouTube Analytics API',
            ],
        },
        {
            'title': 'Configure the OAuth Consent Screen',
            'description': 'APIs & Services → OAuth consent screen. User Type: External. Fill the basics (app name, your email, your domain) and add yourself as a test user. You don\'t need verification — staying in test mode is fine for personal use.',
        },
        {
            'title': 'Create OAuth 2.0 credentials',
            'description': 'APIs & Services → Credentials → "Create Credentials" → OAuth Client ID. Type: Web application. Authorized redirect URI: https://developers.google.com/oauthplayground',
            'warning': 'The redirect URI must match exactly, including the trailing word — no slash.',
        },
        {
            'title': 'Copy the Client ID and Client Secret',
            'description': 'After creating, copy the OAuth Client ID (ends in apps.googleusercontent.com) and Client Secret. You\'ll paste them in Social Stats below.',
        },
        {
            'title': 'Generate a refresh token in OAuth Playground',
            'description': 'Visit OAuth Playground → ⚙️ icon (top right) → "Use your own OAuth credentials" → paste your Client ID + Secret. Then in step 1, paste these scopes:',
            'external_link': 'https://developers.google.com/oauthplayground',
            'cta': 'Open OAuth Playground',
            'bullets': [
                'https://www.googleapis.com/auth/youtube.readonly',
                'https://www.googleapis.com/auth/yt-analytics.readonly',
            ],
        },
        {
            'title': 'Authorize and exchange',
            'description': 'Click "Authorize APIs" → sign in with the Google account that owns your channel → "Exchange authorization code for tokens". Copy the Refresh Token (starts with "1//").',
        },
        {
            'title': 'Find your Channel ID',
            'description': 'Open YouTube Studio → Settings → Channel → Advanced settings. The Channel ID is shown there — it starts with "UC".',
            'external_link': 'https://studio.youtube.com',
            'cta': 'Open YouTube Studio',
        },
        {
            'title': 'Paste all 4 values into Social Stats below',
            'description': 'API Key is optional (only needed for some legacy fallback queries).',
        },
    ],
    'fields': [
        {
            'name': 'channel_id',
            'label': 'YouTube Channel ID',
            'type': 'text',
            'placeholder': 'UCxxxxxxxxxxxxxxxxxxxxxx',
            'help': 'From YouTube Studio → Settings → Channel → Advanced. Starts with "UC".',
            'required': True,
        },
        {
            'name': 'oauth_client_id',
            'label': 'OAuth Client ID',
            'type': 'text',
            'placeholder': '123456-abc.apps.googleusercontent.com',
            'help': 'From your Google Cloud project → Credentials.',
            'required': True,
        },
        {
            'name': 'oauth_client_secret',
            'label': 'OAuth Client Secret',
            'type': 'password',
            'placeholder': 'GOCSPX-...',
            'help': 'Shown next to the OAuth Client ID in Google Cloud.',
            'required': True,
        },
        {
            'name': 'refresh_token',
            'label': 'Refresh Token',
            'type': 'password',
            'placeholder': '1//...',
            'help': 'From OAuth Playground after exchanging the auth code.',
            'required': True,
        },
        {
            'name': 'api_key',
            'label': 'API Key (optional)',
            'type': 'password',
            'placeholder': 'AIza...',
            'help': 'Only needed for some fallback queries. Leave blank if unsure.',
            'required': False,
        },
    ],
    'tips': [
        'Keep your Cloud project under the same Google account that owns the channel.',
        'Refresh tokens last forever unless explicitly revoked.',
        'Social Stats auto-refreshes the access token every hour using your refresh token.',
    ],
}


LINKEDIN = {
    'platform': 'linkedin',
    'title': 'Connect LinkedIn Company Page (Manual Setup)',
    'estimated_time': '5–10 minutes',
    'intro': (
        'LinkedIn requires a developer app and a 60-day access token. '
        'Social Stats will warn you 7 days before the token expires so you can refresh it.'
    ),
    'requirements': [
        'You are an Admin of the LinkedIn Company Page',
        'Access to https://linkedin.com/developers',
    ],
    'steps': [
        {
            'title': 'Create a LinkedIn developer app',
            'description': 'Visit linkedin.com/developers → "Create app". Associate it with the Company Page you want to track.',
            'external_link': 'https://www.linkedin.com/developers/apps/new',
            'cta': 'Create LinkedIn App',
        },
        {
            'title': 'Request the right scopes',
            'description': 'In your app → Products tab. Request access to "Marketing Developer Platform" — approval can take a few days. While waiting, the basic scopes still work for most insights.',
        },
        {
            'title': 'Generate an access token',
            'description': 'Auth tab → OAuth 2.0 settings → "Generate token" → select these scopes:',
            'bullets': [
                'r_organization_social',
                'rw_organization_admin',
            ],
        },
        {
            'title': 'Copy the access token',
            'description': 'It\'s long (~200 chars). Tokens last 60 days — Social Stats will alert you 7 days before expiry.',
        },
        {
            'title': 'Find your Organization ID',
            'description': 'On your Company Page admin view, the URL contains /company/{id}/admin/. The "id" is your Organization ID. It\'s a number.',
        },
        {
            'title': 'Paste both into Social Stats below',
            'description': 'Social Stats will verify the token can read your organization data before saving.',
        },
    ],
    'fields': [
        {
            'name': 'organization_id',
            'label': 'LinkedIn Organization ID',
            'type': 'text',
            'placeholder': 'e.g. 1234567 (or urn:li:organization:1234567)',
            'help': 'Numeric ID from your Company Page admin URL.',
            'required': True,
        },
        {
            'name': 'access_token',
            'label': 'Access Token',
            'type': 'password',
            'placeholder': 'AQV...',
            'help': '60-day token from your LinkedIn app → Auth tab.',
            'required': True,
        },
    ],
    'tips': [
        'LinkedIn tokens expire after 60 days — Social Stats alerts you 7 days before.',
        'Token rotation: just regenerate the token in LinkedIn and paste it again.',
    ],
}


GMB = {
    'platform': 'google_my_business',
    'title': 'Connect Google Business Profile (Manual Setup)',
    'estimated_time': '10–15 minutes',
    'intro': (
        'Google Business Profile (formerly GMB) uses the same Google Cloud + OAuth Playground flow as YouTube. '
        'You can reuse the same Cloud project — just enable the Business Profile API.'
    ),
    'requirements': [
        'A verified Google Business Profile location',
        'A Google Cloud project (you can reuse the YouTube one)',
    ],
    'steps': [
        {
            'title': 'Use your existing Google Cloud project (or create one)',
            'description': 'If you already set up YouTube manual mode, reuse that project. Otherwise, create a new project at console.cloud.google.com.',
            'external_link': 'https://console.cloud.google.com',
            'cta': 'Open Google Cloud Console',
        },
        {
            'title': 'Enable the Business Profile APIs',
            'description': 'APIs & Services → Library. Enable:',
            'bullets': [
                'My Business Business Information API',
                'My Business Account Management API',
                'My Business Q&A API (optional)',
            ],
        },
        {
            'title': 'Reuse OAuth credentials (or create new)',
            'description': 'You can reuse the OAuth Client ID + Secret from YouTube setup. The redirect URI is the same: https://developers.google.com/oauthplayground',
        },
        {
            'title': 'Generate a refresh token in OAuth Playground',
            'description': 'OAuth Playground → ⚙️ → use your own credentials. Add this scope in step 1:',
            'external_link': 'https://developers.google.com/oauthplayground',
            'cta': 'Open OAuth Playground',
            'bullets': [
                'https://www.googleapis.com/auth/business.manage',
            ],
        },
        {
            'title': 'Find your Account ID and Location ID',
            'description': 'Open business.google.com and select your business. The URL contains both IDs after /b/{accountId}/locations/{locationId}/. Or use the API: GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
            'external_link': 'https://business.google.com',
            'cta': 'Open Business Profile',
        },
        {
            'title': 'Paste all 5 values into Social Stats below',
            'description': 'Social Stats will verify the location is reachable before saving.',
        },
    ],
    'fields': [
        {
            'name': 'account_id',
            'label': 'GMB Account ID',
            'type': 'text',
            'placeholder': 'e.g. 1234567890',
            'help': 'Numeric account ID from business.google.com URL.',
            'required': True,
        },
        {
            'name': 'location_id',
            'label': 'GMB Location ID',
            'type': 'text',
            'placeholder': 'e.g. 9876543210',
            'help': 'Numeric location ID from business.google.com URL.',
            'required': True,
        },
        {
            'name': 'oauth_client_id',
            'label': 'OAuth Client ID',
            'type': 'text',
            'placeholder': '...apps.googleusercontent.com',
            'help': 'Same as your YouTube OAuth Client ID, or create a new one.',
            'required': True,
        },
        {
            'name': 'oauth_client_secret',
            'label': 'OAuth Client Secret',
            'type': 'password',
            'placeholder': 'GOCSPX-...',
            'help': 'Same as your YouTube OAuth Client Secret.',
            'required': True,
        },
        {
            'name': 'refresh_token',
            'label': 'Refresh Token',
            'type': 'password',
            'placeholder': '1//...',
            'help': 'Generate via OAuth Playground with the business.manage scope.',
            'required': True,
        },
    ],
    'tips': [
        'Refresh tokens persist forever; Social Stats refreshes the access token automatically.',
        'If you have multiple locations, set up one PlatformCredential per Social Stats Client.',
    ],
}


SETUP_GUIDES = {
    'facebook':           FACEBOOK,
    'instagram':          INSTAGRAM,
    'youtube':            YOUTUBE,
    'linkedin':           LINKEDIN,
    'gmb':                GMB,
    'google_my_business': GMB,
}


def get_guide(platform: str):
    return SETUP_GUIDES.get((platform or '').lower())
