# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
password validators that enforce complexity in addition to the
Django defaults (which only catch length, common-password, numeric-only,
and similarity-to-username).

Activated via AUTH_PASSWORD_VALIDATORS in settings.py.
"""
from __future__ import annotations

import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class PasswordComplexityValidator:
    """Require at least 3 of: lowercase, uppercase, digit, special character.

    "Three of four" beats "must have all four" for usability — long
    passphrases without symbols still pass, and we don't push users toward
    the predictable "Password1!" pattern that "all four required" rules
    create.
    """

    REQUIRED_CLASSES = 3

    def validate(self, password, user=None):
        classes = sum([
            bool(re.search(r'[a-z]', password)),
            bool(re.search(r'[A-Z]', password)),
            bool(re.search(r'\d',    password)),
            bool(re.search(r'[^A-Za-z0-9]', password)),
        ])
        if classes < self.REQUIRED_CLASSES:
            raise ValidationError(
                _('Password must include at least %(n)d of: lowercase, '
                  'uppercase, digits, special characters.'),
                code='password_too_simple',
                params={'n': self.REQUIRED_CLASSES},
            )

    def get_help_text(self):
        return _('Use at least 3 of: lowercase letters, uppercase letters, '
                 'digits, and special characters.')
