# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""DRF serializers for the WhatsApp module."""
import re
from rest_framework import serializers

from .models import (
    WhatsAppAccount, WhatsAppContact, WhatsAppContactList,
    WhatsAppTemplate, WhatsAppCampaign, WhatsAppMessage, WhatsAppWebhookLog,
)


# ── Account ───────────────────────────────────────────────────────────────────
_HEADER_NAME_RE = re.compile(r'^[A-Za-z0-9-]{1,100}$')
_AUTH_SCHEME_RE = re.compile(r'^[A-Za-z0-9-]{0,30}$')
# Headers the HTTP client must stay in control of.
_RESERVED_HEADERS = {'host', 'content-length', 'content-type', 'transfer-encoding', 'connection', 'cookie'}


class WhatsAppAccountSerializer(serializers.ModelSerializer):
    """One workspace's WhatsApp connection: which provider, and its credentials.

    Secrets go in, never out: `api_key` and `app_secret` are write-only; the
    response only says whether each is set.
    """
    api_key        = serializers.CharField(write_only=True, required=False, allow_blank=True)
    app_secret     = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_api_key    = serializers.SerializerMethodField()
    has_app_secret = serializers.SerializerMethodField()
    provider_label = serializers.SerializerMethodField()
    webhook_url    = serializers.SerializerMethodField()
    webhook_auth   = serializers.SerializerMethodField()

    class Meta:
        model  = WhatsAppAccount
        fields = [
            'id', 'client',
            'provider', 'provider_label', 'api_base_url', 'auth_header', 'auth_scheme',
            'waba_id', 'phone_number_id', 'phone_number', 'display_name',
            'is_active', 'quality_rating', 'messaging_tier',
            'last_synced_at', 'created_at', 'updated_at',
            'api_key', 'has_api_key', 'app_secret', 'has_app_secret',
            'webhook_url', 'webhook_auth', 'webhook_verify_token',
        ]
        read_only_fields = [
            'quality_rating', 'messaging_tier',
            'last_synced_at', 'created_at', 'updated_at',
            'webhook_verify_token',
        ]
        extra_kwargs = {
            # The view stamps the workspace from the signed-in user; a value
            # sent by the browser is never what decides it.
            'client':       {'required': False},
            'api_base_url': {'required': False, 'allow_blank': True},
            'auth_header':  {'required': False, 'allow_blank': True},
            'auth_scheme':  {'required': False, 'allow_blank': True},
        }

    # ── Read side ────────────────────────────────────────────────────────
    def get_has_api_key(self, obj):
        return bool(obj.api_key_encrypted)

    def get_has_app_secret(self, obj):
        return bool(obj.app_secret_encrypted)

    def get_provider_label(self, obj):
        from .whatsapp_providers import DEFAULT_PROVIDER, PROVIDERS
        return PROVIDERS.get(obj.provider, PROVIDERS[DEFAULT_PROVIDER])['label']

    def get_webhook_url(self, obj):
        from django.conf import settings
        from django.urls import reverse
        path = reverse('wa_account_webhook', args=[obj.webhook_key])
        base = (getattr(settings, 'BACKEND_PUBLIC_URL', '') or '').rstrip('/')
        if base:
            return f'{base}{path}'
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path

    def get_webhook_auth(self, obj):
        # 'signature' → deliveries must carry a valid X-Hub-Signature-256;
        # 'header'    → deliveries must carry X-Webhook-Secret: <verify token>.
        return 'signature' if obj.app_secret_encrypted else 'header'

    def to_representation(self, instance):
        # Defensive: never expose secrets in output, even if subclassed.
        data = super().to_representation(instance)
        data.pop('api_key', None)
        data.pop('app_secret', None)
        return data

    # ── Write side ───────────────────────────────────────────────────────
    def validate_provider(self, value):
        from .whatsapp_providers import PROVIDERS
        if value not in PROVIDERS:
            raise serializers.ValidationError(
                f'Unknown provider. Choose one of: {", ".join(PROVIDERS)}.')
        return value

    def validate(self, attrs):
        from .whatsapp_providers import DEFAULT_PROVIDER, PROVIDERS, validate_base_url

        inst = self.instance
        provider = attrs.get('provider') or (inst.provider if inst else DEFAULT_PROVIDER)
        cfg = PROVIDERS[provider]
        errors = {}

        if provider == 'custom':
            base_url = attrs.get('api_base_url', inst.api_base_url if inst else '')
            try:
                attrs['api_base_url'] = validate_base_url(base_url)
            except ValueError as e:
                errors['api_base_url'] = str(e)

            header = (attrs.get('auth_header', inst.auth_header if inst else '') or cfg['auth_header']).strip()
            if not _HEADER_NAME_RE.match(header) or header.lower() in _RESERVED_HEADERS:
                errors['auth_header'] = 'Enter a valid HTTP header name, e.g. Authorization or apikey.'
            attrs['auth_header'] = header

            # Blank scheme = send the raw key. When the field is omitted
            # altogether on a new account, assume the common "Bearer <key>".
            if 'auth_scheme' in attrs or (inst and inst.provider == 'custom'):
                scheme = (attrs.get('auth_scheme', inst.auth_scheme if inst else '') or '').strip()
            else:
                scheme = cfg['auth_scheme']
            if not _AUTH_SCHEME_RE.match(scheme):
                errors['auth_scheme'] = 'Use a single word such as Bearer, or leave blank to send the key as-is.'
            attrs['auth_scheme'] = scheme
        else:
            # Built-in providers have fixed endpoints — never store stray overrides.
            attrs['api_base_url'] = attrs['auth_header'] = attrs['auth_scheme'] = ''

        api_key = attrs.get('api_key') or ''
        app_secret = attrs.get('app_secret') or ''

        # The stored key is only ever sent to the endpoint it was entered for:
        # changing the provider or the base URL needs the key typed in again.
        endpoint_changed = bool(inst) and (
            provider != inst.provider
            or (provider == 'custom' and attrs.get('api_base_url', '') != (inst.api_base_url or '').rstrip('/'))
        )
        if not api_key and (not inst or endpoint_changed or not inst.api_key_encrypted):
            errors['api_key'] = (
                f'Enter the {cfg["credential_label"].lower()} for this provider.'
                if not endpoint_changed else
                'Re-enter the API key — it is not carried over when the provider or its URL changes.'
            )

        if cfg['needs_app_secret'] and not app_secret:
            keeps_existing = bool(inst) and inst.provider == provider and bool(inst.app_secret_encrypted)
            if not keeps_existing:
                errors['app_secret'] = (
                    'Enter the App Secret of your Meta app — it is used to verify that '
                    'incoming webhooks really come from Meta.')

        if errors:
            raise serializers.ValidationError(errors)

        attrs['_provider_changed'] = bool(inst) and provider != inst.provider
        return attrs

    def _apply_secrets(self, instance, api_key, app_secret, *, provider_changed, app_secret_sent):
        if api_key:
            instance.api_key = api_key              # property → encrypts
        if app_secret:
            instance.app_secret = app_secret
        elif provider_changed or instance.provider == 'pinbot':
            instance.app_secret = ''                # a signing secret belongs to one provider
        elif app_secret_sent and instance.provider == 'custom':
            instance.app_secret = ''                # explicit blank clears the optional secret

    def create(self, validated_data):
        api_key = validated_data.pop('api_key', None)
        app_secret_sent = 'app_secret' in validated_data
        app_secret = validated_data.pop('app_secret', None)
        validated_data.pop('_provider_changed', None)
        instance = WhatsAppAccount(**validated_data)
        self._apply_secrets(instance, api_key, app_secret,
                            provider_changed=False, app_secret_sent=app_secret_sent)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        api_key = validated_data.pop('api_key', None)
        app_secret_sent = 'app_secret' in validated_data
        app_secret = validated_data.pop('app_secret', None)
        provider_changed = validated_data.pop('_provider_changed', False)
        validated_data.pop('client', None)          # an account never moves between workspaces
        for k, v in validated_data.items():
            setattr(instance, k, v)
        self._apply_secrets(instance, api_key, app_secret,
                            provider_changed=provider_changed, app_secret_sent=app_secret_sent)
        instance.save()
        return instance


# ── Contact ───────────────────────────────────────────────────────────────────
class WhatsAppContactSerializer(serializers.ModelSerializer):
    within_24h_window = serializers.BooleanField(read_only=True)

    class Meta:
        model  = WhatsAppContact
        fields = [
            'id', 'client',
            'phone', 'name', 'email', 'tags', 'custom_fields',
            'opt_in_status', 'opt_in_source', 'opt_in_at',
            'last_message_at', 'last_inbound_at', 'within_24h_window',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['last_message_at', 'last_inbound_at', 'created_at', 'updated_at']


class WhatsAppContactSummarySerializer(serializers.ModelSerializer):
    """Compact representation for nesting inside messages/campaigns."""
    class Meta:
        model  = WhatsAppContact
        fields = ['id', 'phone', 'name', 'opt_in_status']


# ── Contact List ──────────────────────────────────────────────────────────────
class WhatsAppContactListSerializer(serializers.ModelSerializer):
    contact_count = serializers.SerializerMethodField()

    class Meta:
        model  = WhatsAppContactList
        fields = ['id', 'client', 'name', 'description', 'contacts', 'contact_count', 'created_at']
        read_only_fields = ['created_at']
        extra_kwargs = {'contacts': {'required': False}}

    def get_contact_count(self, obj):
        return obj.contacts.count()


# ── Template ──────────────────────────────────────────────────────────────────
class WhatsAppTemplateSerializer(serializers.ModelSerializer):
    preview = serializers.SerializerMethodField()

    class Meta:
        model  = WhatsAppTemplate
        fields = [
            'id', 'client',
            'name', 'category', 'language', 'template_type',
            'header', 'body', 'footer', 'buttons',
            'pinbot_template_id', 'status', 'rejection_reason',
            'variables_count', 'preview',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'pinbot_template_id', 'status', 'rejection_reason',
            'variables_count', 'created_by', 'created_at', 'updated_at',
        ]

    def get_preview(self, obj):
        """Render a preview substituting {{n}} with sample values."""
        from django.utils.html import escape
        body = obj.body or ''
        # Replace {{1}}, {{2}}, ... with sample values
        def repl(m):
            n = m.group(1)
            return f'[Sample {n}]'
        rendered = re.sub(r'\{\{(\d+)\}\}', repl, body)
        return escape(rendered)


# ── Campaign ──────────────────────────────────────────────────────────────────
class WhatsAppCampaignSerializer(serializers.ModelSerializer):
    template_name      = serializers.CharField(source='template.name', read_only=True)
    contact_list_name  = serializers.CharField(source='contact_list.name', read_only=True)
    progress_percent   = serializers.IntegerField(read_only=True)

    class Meta:
        model  = WhatsAppCampaign
        fields = [
            'id', 'client', 'name',
            'template', 'template_name', 'contact_list', 'contact_list_name',
            'template_variables',
            'scheduled_at', 'started_at', 'completed_at', 'status',
            'total_count', 'sent_count', 'delivered_count', 'read_count', 'failed_count',
            'progress_percent',
            'created_by', 'created_at',
        ]
        read_only_fields = [
            'started_at', 'completed_at', 'status',
            'total_count', 'sent_count', 'delivered_count', 'read_count', 'failed_count',
            'created_by', 'created_at',
        ]


# ── Message ───────────────────────────────────────────────────────────────────
class WhatsAppMessageSerializer(serializers.ModelSerializer):
    contact = WhatsAppContactSummarySerializer(read_only=True)

    class Meta:
        model  = WhatsAppMessage
        fields = [
            'id', 'client', 'campaign', 'contact',
            'pinbot_message_id', 'direction', 'message_type', 'payload',
            'status', 'error_code', 'error_message',
            'sent_at', 'delivered_at', 'read_at', 'created_at',
        ]
        read_only_fields = fields  # messages are managed by tasks/webhooks


# ── Webhook log (admin/debug) ─────────────────────────────────────────────────
class WhatsAppWebhookLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WhatsAppWebhookLog
        fields = ['id', 'client', 'event_type', 'payload', 'processed', 'error', 'created_at']
        read_only_fields = fields
