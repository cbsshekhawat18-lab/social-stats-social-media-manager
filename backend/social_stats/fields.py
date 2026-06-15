# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Custom Django model fields with transparent encryption."""

from django.db import models
from .crypto import encrypt_value, decrypt_value


class EncryptedTextField(models.TextField):
    """TextField that encrypts on write and decrypts on read (Fernet AES-128-CBC)."""

    def from_db_value(self, value, expression, connection):
        return decrypt_value(value)

    def get_prep_value(self, value):
        return encrypt_value(value)

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        # Always serialise as our custom path so migrations are reproducible.
        return name, 'social_stats.fields.EncryptedTextField', args, kwargs
