# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Base interface and exception types for per-platform publishers.

All concrete publishers (Facebook, Instagram, YouTube, LinkedIn, GMB) inherit
from `BasePublisher` and override the methods relevant to their platform.
Methods they don't support raise `PublishError(supported=False)` so the
orchestrator can fail gracefully.

Each method takes a `PlatformCredential` instance + content args and returns
a `PublishResult` (or raises a typed exception).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ── Exceptions ────────────────────────────────────────────────────────────────
class PublishError(Exception):
    """Generic publishing failure. Carries a structured error code + raw response."""
    def __init__(self, message: str, *, code: str = '', status_code: Optional[int] = None,
                 raw: Any = None, supported: bool = True):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.raw = raw
        self.supported = supported


class TokenExpiredError(PublishError):
    """Token rejected by the platform — needs reconnect."""
    def __init__(self, message='Access token expired or revoked', **kwargs):
        super().__init__(message, code='token_expired', **kwargs)


class RateLimitError(PublishError):
    """Platform rate limit hit. Caller should backoff + retry."""
    def __init__(self, message='Rate limit exceeded', retry_after: Optional[int] = None, **kwargs):
        super().__init__(message, code='rate_limited', **kwargs)
        self.retry_after = retry_after


class PermissionDeniedError(PublishError):
    """Token is valid but lacks required scope/permission for this action."""
    def __init__(self, message='Permission denied', **kwargs):
        super().__init__(message, code='permission_denied', **kwargs)


class MediaTooLargeError(PublishError):
    """Uploaded media exceeds the platform's size/duration cap."""
    def __init__(self, message='Media exceeds platform limits', **kwargs):
        super().__init__(message, code='media_too_large', **kwargs)


class MediaValidationError(PublishError):
    """Media format/aspect-ratio/etc. fails platform validation rules."""
    def __init__(self, message='Media failed validation', **kwargs):
        super().__init__(message, code='media_invalid', **kwargs)


# ── Result type ───────────────────────────────────────────────────────────────
@dataclass
class PublishResult:
    """Standard publisher response. `success=True` means the platform accepted the post."""
    success: bool = False
    platform_post_id: str = ''
    platform_url: str = ''
    raw_response: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            'success':           self.success,
            'platform_post_id':  self.platform_post_id,
            'platform_url':      self.platform_url,
            'warnings':          self.warnings,
            # raw_response kept on the instance but excluded from this digest
        }


# ── Base publisher ────────────────────────────────────────────────────────────
class BasePublisher:
    """
    Abstract publisher. Subclasses implement the platform's specifics.

    Convention:
      - Every method MUST accept a `credential` (PlatformCredential) as the
        first positional arg.
      - Methods raise typed exceptions rather than returning failure objects.
      - Methods that the platform doesn't support should NOT be overridden;
        the default `_unsupported()` raises a clear PublishError.

    Concrete publishers also expose:
      MAX_TEXT_LENGTH:   int — character cap on post body (used by preflight)
      MAX_IMAGE_BYTES:   int — single-image upload cap
      MAX_VIDEO_BYTES:   int — single-video upload cap
      MAX_VIDEO_SECONDS: int — duration cap
      SUPPORTED_TYPES:   set[str] — subset of {'text','image','video','carousel','story','reel'}
    """

    platform: str = ''  # e.g. 'facebook'
    MAX_TEXT_LENGTH: int = 0
    MAX_IMAGE_BYTES: int = 0
    MAX_VIDEO_BYTES: int = 0
    MAX_VIDEO_SECONDS: int = 0
    SUPPORTED_TYPES: set = frozenset()

    # ── Capability check ──
    def supports(self, media_type: str) -> bool:
        return media_type in self.SUPPORTED_TYPES

    # ── Publish surface ──
    def publish_text(self, credential, content: str, **kwargs) -> PublishResult:
        return self._unsupported('publish_text')

    def publish_image(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        return self._unsupported('publish_image')

    def publish_video(self, credential, content: str, video_url: str, *, thumbnail: Optional[str] = None, **kwargs) -> PublishResult:
        return self._unsupported('publish_video')

    def publish_carousel(self, credential, content: str, image_urls: list[str], **kwargs) -> PublishResult:
        return self._unsupported('publish_carousel')

    def publish_story(self, credential, media_url: str, **kwargs) -> PublishResult:
        return self._unsupported('publish_story')

    def publish_reel(self, credential, video_url: str, content: str, **kwargs) -> PublishResult:
        return self._unsupported('publish_reel')

    # ── Lifecycle ──
    def delete_post(self, credential, platform_post_id: str) -> dict:
        return self._unsupported('delete_post')

    def get_post_metrics(self, credential, platform_post_id: str) -> dict:
        return self._unsupported('get_post_metrics')

    # ── Inbox / engagement (added in) ──
    def reply_to_comment(self, credential, comment_id: str, text: str, **kwargs) -> PublishResult:
        return self._unsupported('reply_to_comment')

    def reply_to_dm(self, credential, conversation_id: str, text: str, *, media: Optional[list] = None, **kwargs) -> PublishResult:
        return self._unsupported('reply_to_dm')

    def reply_to_review(self, credential, review_id: str, text: str, **kwargs) -> PublishResult:
        return self._unsupported('reply_to_review')

    # ── Defaults / helpers ──
    def _unsupported(self, method_name: str):
        raise PublishError(
            f'{self.__class__.__name__} does not support {method_name}',
            code='unsupported',
            supported=False,
        )


# ── Factory ───────────────────────────────────────────────────────────────────
_REGISTRY: dict[str, type[BasePublisher]] = {}


def register_publisher(platform: str, publisher_cls: type[BasePublisher]) -> None:
    """Concrete publisher modules call this on import to register themselves."""
    if not issubclass(publisher_cls, BasePublisher):
        raise TypeError(f'{publisher_cls} must subclass BasePublisher')
    _REGISTRY[platform] = publisher_cls


def get_publisher(platform: str) -> BasePublisher:
    """Return a fresh publisher instance for the given platform key."""
    cls = _REGISTRY.get(platform)
    if cls is None:
        # Lazy import to avoid circular registration on first call.
        _autoload()
        cls = _REGISTRY.get(platform)
    if cls is None:
        raise NotImplementedError(f'No publisher registered for platform={platform}')
    return cls()


def _autoload() -> None:
    """
    Best-effort import of all concrete publisher modules so they self-register.
    Each concrete publisher imports lazily to avoid breaking when a module
    isn't present yet(base only; concrete classes arrive in
).
    """
    for mod_name in ('facebook', 'instagram', 'youtube', 'linkedin', 'gmb'):
        try:
            __import__(f'social_stats.publishers.{mod_name}')
        except ImportError as e:
            logger.debug('Publisher module not yet present: %s (%s)', mod_name, e)
        except Exception:
            logger.exception('Failed to import publisher module: %s', mod_name)
