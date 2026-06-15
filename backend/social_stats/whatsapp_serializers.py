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
class WhatsAppAccountSerializer(serializers.ModelSerializer):
    api_key  = serializers.CharField(write_only=True, required=False, allow_blank=True)
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model  = WhatsAppAccount
        fields = [
            'id', 'client',
            'waba_id', 'phone_number_id', 'phone_number', 'display_name',
            'is_active', 'quality_rating', 'messaging_tier',
            'last_synced_at', 'created_at', 'updated_at',
            'api_key', 'has_api_key',
        ]
        read_only_fields = [
            'quality_rating', 'messaging_tier',
            'last_synced_at', 'created_at', 'updated_at',
        ]

    def get_has_api_key(self, obj):
        return bool(obj.api_key_encrypted)

    def to_representation(self, instance):
        # Defensive: never expose api_key in output, even if subclassed.
        data = super().to_representation(instance)
        data.pop('api_key', None)
        return data

    def create(self, validated_data):
        api_key = validated_data.pop('api_key', None)
        instance = WhatsAppAccount(**validated_data)
        if api_key:
            instance.api_key = api_key  # property → encrypts
        instance.save()
        return instance

    def update(self, instance, validated_data):
        api_key = validated_data.pop('api_key', None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if api_key:
            instance.api_key = api_key
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
