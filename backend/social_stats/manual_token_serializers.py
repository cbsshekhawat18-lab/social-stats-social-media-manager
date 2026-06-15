# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
DRF serializers for manual-mode connect endpoints. One serializer per platform,
each enforcing the required fields and basic format checks.
"""
import re
from rest_framework import serializers


# ── Helpers ───────────────────────────────────────────────────────────────────
def _strip(value):
    return (value or '').strip()


def _validate_id(value, field_name='id', min_len=4):
    v = _strip(value)
    if not v:
        raise serializers.ValidationError(f'{field_name} is required')
    if len(v) < min_len:
        raise serializers.ValidationError(f'{field_name} looks too short')
    return v


# ── Facebook ──────────────────────────────────────────────────────────────────
class FacebookManualSerializer(serializers.Serializer):
    page_id           = serializers.CharField(max_length=200)
    page_access_token = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_page_id(self, v):
        v = _validate_id(v, 'page_id')
        if not re.fullmatch(r'\d{4,}', v):
            raise serializers.ValidationError('page_id should be the numeric Facebook Page ID')
        return v

    def validate_page_access_token(self, v):
        v = _strip(v)
        if not v:
            raise serializers.ValidationError('page_access_token is required')
        if len(v) < 60:
            raise serializers.ValidationError('page_access_token looks too short — paste the full token')
        return v


# ── Instagram ─────────────────────────────────────────────────────────────────
class InstagramManualSerializer(serializers.Serializer):
    instagram_account_id = serializers.CharField(max_length=200)
    page_access_token    = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_instagram_account_id(self, v):
        v = _validate_id(v, 'instagram_account_id')
        if not re.fullmatch(r'\d{4,}', v):
            raise serializers.ValidationError('instagram_account_id should be the numeric IG Business Account ID')
        return v

    def validate_page_access_token(self, v):
        v = _strip(v)
        if len(v) < 60:
            raise serializers.ValidationError('page_access_token looks too short — paste the full token')
        return v


# ── YouTube ───────────────────────────────────────────────────────────────────
class YoutubeManualSerializer(serializers.Serializer):
    channel_id          = serializers.CharField(max_length=200)
    oauth_client_id     = serializers.CharField(max_length=300)
    oauth_client_secret = serializers.CharField(max_length=300, trim_whitespace=True)
    refresh_token       = serializers.CharField(max_length=2000, trim_whitespace=True)
    api_key             = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate_channel_id(self, v):
        v = _validate_id(v, 'channel_id', min_len=10)
        if not v.startswith('UC'):
            raise serializers.ValidationError('YouTube channel_id should start with "UC"')
        return v

    def validate_oauth_client_id(self, v):
        v = _validate_id(v, 'oauth_client_id', min_len=20)
        if 'apps.googleusercontent.com' not in v:
            raise serializers.ValidationError('oauth_client_id should end in apps.googleusercontent.com')
        return v


# ── LinkedIn ──────────────────────────────────────────────────────────────────
class LinkedinManualSerializer(serializers.Serializer):
    organization_id = serializers.CharField(max_length=200)
    access_token    = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_organization_id(self, v):
        v = _strip(v)
        if not v:
            raise serializers.ValidationError('organization_id is required')
        # Accept both raw numeric IDs and urn:li:organization:NNNN
        if v.startswith('urn:li:organization:'):
            v = v.split(':')[-1]
        if not re.fullmatch(r'\d+', v):
            raise serializers.ValidationError('organization_id should be numeric (or a urn:li:organization: URN)')
        return v

    def validate_access_token(self, v):
        v = _strip(v)
        if len(v) < 60:
            raise serializers.ValidationError('access_token looks too short — paste the full token')
        return v


# ── GMB ───────────────────────────────────────────────────────────────────────
class GmbManualSerializer(serializers.Serializer):
    account_id          = serializers.CharField(max_length=200)
    location_id         = serializers.CharField(max_length=200)
    oauth_client_id     = serializers.CharField(max_length=300)
    oauth_client_secret = serializers.CharField(max_length=300, trim_whitespace=True)
    refresh_token       = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_account_id(self, v):
        return _validate_id(v, 'account_id')

    def validate_location_id(self, v):
        return _validate_id(v, 'location_id')

    def validate_oauth_client_id(self, v):
        v = _validate_id(v, 'oauth_client_id', min_len=20)
        if 'apps.googleusercontent.com' not in v:
            raise serializers.ValidationError('oauth_client_id should end in apps.googleusercontent.com')
        return v
