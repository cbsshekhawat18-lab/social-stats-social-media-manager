# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
WhatsApp provider registry.

Each workspace connects the WhatsApp Business provider it chooses, with its
own credentials. Social Stats talks the WhatsApp **Cloud API** format
(`POST /{phone-number-id}/messages`, Cloud-API webhooks), so any provider
that exposes that format works — only the base URL and the way the API key
is sent differ.

    meta_cloud  Meta's own WhatsApp Cloud API, no middleman.
    pinbot      Pinbot Partners API v3.
    custom      Any other Cloud-API-compatible provider: the user supplies
                the base URL and the auth header.

Providers with a different message format (Twilio, Gupshup's native API, …)
need their own client class; they are not covered by `custom`.
"""
from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings

DEFAULT_PROVIDER = 'pinbot'


@dataclass(frozen=True)
class ProviderConnection:
    """Everything the HTTP client needs to talk to one account's provider."""
    provider: str
    base_url: str
    auth_header: str
    auth_scheme: str      # prefix before the key, e.g. 'Bearer' ('' = raw key)


def _meta_base_url() -> str:
    return f'https://graph.facebook.com/{settings.META_API_VERSION}'


def _pinbot_base_url() -> str:
    return getattr(settings, 'PINBOT_BASE_URL', 'https://partnersv1.pinbot.ai/v3')


# Static description of each provider. `fields` drives the connect form.
PROVIDERS = {
    'meta_cloud': {
        'label': 'Meta WhatsApp Cloud API',
        'description': 'Connect directly to Meta with your own WhatsApp Business app. No third-party provider.',
        'base_url': _meta_base_url,
        'auth_header': 'Authorization',
        'auth_scheme': 'Bearer',
        'credential_label': 'Access token',
        'credential_help': 'A permanent System User access token with whatsapp_business_messaging '
                           'and whatsapp_business_management permissions.',
        'webhook_auth': 'signature',     # Meta signs each delivery with the App Secret
        'needs_app_secret': True,
        'needs_base_url': False,
        'docs_url': 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    },
    'pinbot': {
        'label': 'Pinbot',
        'description': 'Pinbot Partners API v3.',
        'base_url': _pinbot_base_url,
        'auth_header': 'apikey',
        'auth_scheme': '',
        'credential_label': 'API key',
        'credential_help': 'The WABA API key from your Pinbot dashboard.',
        'webhook_auth': 'header',        # shared secret in X-Webhook-Secret
        'needs_app_secret': False,
        'needs_base_url': False,
        'docs_url': 'https://pinbot.ai',
    },
    'custom': {
        'label': 'Other provider (Cloud API compatible)',
        'description': 'Any provider that exposes the WhatsApp Cloud API format. '
                       'You provide its base URL and how the API key is sent.',
        'base_url': None,
        'auth_header': 'Authorization',
        'auth_scheme': 'Bearer',
        'credential_label': 'API key / token',
        'credential_help': 'The key your provider gave you. Set the header it expects below.',
        'webhook_auth': 'header',
        'needs_app_secret': False,
        'needs_base_url': True,
        'docs_url': '',
    },
}

PROVIDER_CHOICES = [(key, cfg['label']) for key, cfg in PROVIDERS.items()]


def catalog() -> list[dict]:
    """Provider list for the connect form (no callables, no secrets)."""
    out = []
    for key, cfg in PROVIDERS.items():
        out.append({
            'key': key,
            'label': cfg['label'],
            'description': cfg['description'],
            'base_url': cfg['base_url']() if cfg['base_url'] else '',
            'auth_header': cfg['auth_header'],
            'auth_scheme': cfg['auth_scheme'],
            'credential_label': cfg['credential_label'],
            'credential_help': cfg['credential_help'],
            'webhook_auth': cfg['webhook_auth'],
            'needs_app_secret': cfg['needs_app_secret'],
            'needs_base_url': cfg['needs_base_url'],
            'docs_url': cfg['docs_url'],
        })
    return out


def validate_base_url(url: str) -> str:
    """A custom provider's base URL must be https and must not point at a
    private / internal address (the server calls it with the user's key).
    Returns the cleaned URL; raises ValueError with a readable message."""
    from .security.ssrf import UnsafeURLError, check_url

    url = (url or '').strip().rstrip('/')
    if not url:
        raise ValueError('Enter the provider\'s API base URL.')
    try:
        check_url(url, allowed_schemes=('https',))
    except UnsafeURLError as e:
        raise ValueError(f'This base URL can\'t be used: {e}.') from e
    return url


def connection_for(account) -> ProviderConnection:
    """Resolve the base URL and auth style for a WhatsAppAccount."""
    key = account.provider if account.provider in PROVIDERS else DEFAULT_PROVIDER
    cfg = PROVIDERS[key]
    if key == 'custom':
        base_url = validate_base_url(account.api_base_url)      # re-checked on every use
        header = (account.auth_header or cfg['auth_header']).strip()
        # auth_scheme is stored as typed: blank means "send the raw key".
        scheme = (account.auth_scheme or '').strip()
    else:
        base_url, header, scheme = cfg['base_url'](), cfg['auth_header'], cfg['auth_scheme']
    return ProviderConnection(provider=key, base_url=base_url.rstrip('/'),
                              auth_header=header, auth_scheme=scheme)
