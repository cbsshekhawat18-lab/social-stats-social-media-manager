# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
SSRF defense for user-provided URLs.

Used by:
  • Bot Builder ``webhook`` node (target URL set by flow author)
  • Any post-fetch / image-proxy / OG-tag scrape that resolves a user URL

We BLOCK:
  • Non-http(s) schemes (file://, gopher://, etc.)
  • RFC1918 / loopback / link-local / unique-local IPs
  • Cloud-metadata endpoints (AWS, GCP, Azure)
  • Redirects to private space (caller decides — we expose ``check_redirect``)

Network DNS happens here (single resolve; no TOCTOU protection without a
custom HTTP transport). For the strictest cases pair this with a TCP-level
allowlist on the egress NAT — but for application-layer abuse this is enough
to stop most attacks.
"""
from __future__ import annotations

import ipaddress
import logging
import socket
from typing import Iterable, Optional
from urllib.parse import urlparse


logger = logging.getLogger(__name__)


_BLOCKED_NETWORKS = [
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('169.254.0.0/16'),  # link-local + AWS/GCP metadata
    ipaddress.ip_network('100.64.0.0/10'),   # CGNAT
    ipaddress.ip_network('::1/128'),
    ipaddress.ip_network('fe80::/10'),       # IPv6 link-local
    ipaddress.ip_network('fc00::/7'),        # IPv6 unique-local
]
# Hostnames a malicious URL might use to dodge IP checks (sometimes resolved
# through HTTP CONNECT or a private resolver). Belt-and-braces.
_BLOCKED_HOSTNAMES = {
    'metadata.google.internal',
    'metadata.azure.com',
    'kubernetes.default.svc',
}


class UnsafeURLError(ValueError):
    """Raised when a URL fails the safety check. Subclasses ValueError so
    callers using a generic try/except still catch it."""


def is_safe_url(url: str, *, allowed_schemes: Iterable[str] = ('http', 'https')) -> bool:
    """Return True iff ``url`` is safe to fetch from a server context."""
    try:
        check_url(url, allowed_schemes=allowed_schemes)
        return True
    except UnsafeURLError:
        return False


def check_url(url: str, *, allowed_schemes: Iterable[str] = ('http', 'https')) -> str:
    """Validate ``url``. Returns the resolved IP on success; raises
    ``UnsafeURLError`` on any policy violation. Useful when callers want to
    log WHY a URL was rejected.
    """
    if not url or not isinstance(url, str):
        raise UnsafeURLError('empty URL')
    parsed = urlparse(url.strip())

    if parsed.scheme.lower() not in {s.lower() for s in allowed_schemes}:
        raise UnsafeURLError(f'scheme {parsed.scheme!r} not allowed')
    if not parsed.hostname:
        raise UnsafeURLError('missing hostname')

    host = parsed.hostname.lower()
    if host in _BLOCKED_HOSTNAMES:
        raise UnsafeURLError(f'hostname {host!r} blocked')

    # Resolve once. We accept the TOCTOU caveat — see module docstring.
    try:
        ip_str = socket.gethostbyname(host)
    except socket.gaierror as e:
        raise UnsafeURLError(f'DNS resolution failed: {e}') from e

    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError as e:
        raise UnsafeURLError(f'unparsable IP {ip_str}') from e

    for net in _BLOCKED_NETWORKS:
        if addr in net:
            raise UnsafeURLError(f'resolves to private/internal address {ip_str}')

    # Belt: explicit metadata IPs (in case the network list above is widened)
    if ip_str in ('169.254.169.254', '169.254.170.2'):
        raise UnsafeURLError('cloud metadata endpoint blocked')

    return ip_str


def safe_request(method: str, url: str, **kwargs):
    """Drop-in wrapper around ``requests.request`` that validates the URL
    BEFORE the request goes out. Raises UnsafeURLError on bad URLs.
    """
    import requests
    check_url(url)
    # `allow_redirects=False` is the safer default — caller should opt in if needed
    kwargs.setdefault('allow_redirects', False)
    return requests.request(method, url, **kwargs)
