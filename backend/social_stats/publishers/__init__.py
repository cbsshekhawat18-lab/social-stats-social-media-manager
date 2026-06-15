# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Per-platform publishers for the Unified Composer.

Public surface:
 from social_stats.publishers import (
 BasePublisher, get_publisher,
 PublishError, MediaTooLargeError, RateLimitError,
 TokenExpiredError, PermissionDeniedError,
)

Concrete publishers (FacebookPublisher, InstagramPublisher, etc.) are added
in the build. The factory raises NotImplementedError until they exist.
"""
from .base import (
 BasePublisher,
 PublishError, PublishResult,
 MediaTooLargeError, RateLimitError, TokenExpiredError,
 PermissionDeniedError, MediaValidationError,
 get_publisher, register_publisher,
)

__all__ = [
 'BasePublisher', 'PublishResult',
 'PublishError', 'MediaTooLargeError', 'RateLimitError',
 'TokenExpiredError', 'PermissionDeniedError', 'MediaValidationError',
 'get_publisher', 'register_publisher',
]
