# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Serializers for the CTWA bot/lead surface —."""
from __future__ import annotations

from rest_framework import serializers

from .models import (
    BotConversation, BotConversationStep, BotFlow, BotFlowTemplate,
    CTWACampaign, Lead, LeadActivity,
)


# ─────────────────────────────────────────────────────────────────────────────
# BotFlow
# ─────────────────────────────────────────────────────────────────────────────
class BotFlowListSerializer(serializers.ModelSerializer):
    """Compact list view — no nodes/edges payload."""
    completion_rate = serializers.SerializerMethodField()

    class Meta:
        model = BotFlow
        fields = [
            'id', 'name', 'description', 'trigger_type', 'is_active', 'is_template',
            'version', 'last_published_at',
            'total_triggered', 'total_completed', 'total_leads_captured', 'completion_rate',
            'created_at', 'updated_at',
        ]

    def get_completion_rate(self, obj):
        return round(obj.total_completed / obj.total_triggered * 100, 1) if obj.total_triggered else 0


class BotFlowDetailSerializer(serializers.ModelSerializer):
    """Full editor payload — nodes, edges, trigger config, settings."""

    class Meta:
        model = BotFlow
        fields = [
            'id', 'client', 'name', 'description',
            'trigger_type', 'trigger_config',
            'nodes', 'edges', 'starting_node_id',
            'is_active', 'is_template',
            'version', 'published_version', 'last_published_at',
            'total_triggered', 'total_completed', 'total_leads_captured',
            'business_hours_only', 'business_hours', 'out_of_hours_message',
            'ai_fallback_enabled', 'ai_fallback_persona',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'client', 'version', 'published_version', 'last_published_at',
            'total_triggered', 'total_completed', 'total_leads_captured',
            'created_by', 'created_at', 'updated_at',
        ]


class BotFlowTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotFlowTemplate
        fields = [
            'id', 'name', 'description', 'industry', 'use_case', 'cover_image',
            'nodes', 'edges', 'starting_node_id',
            'is_featured', 'use_count', 'created_at',
        ]


# ─────────────────────────────────────────────────────────────────────────────
# Conversations
# ─────────────────────────────────────────────────────────────────────────────
class BotConversationStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotConversationStep
        fields = ['id', 'node_id', 'node_type', 'direction', 'payload', 'duration_ms', 'created_at']


class BotConversationListSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    contact_phone = serializers.CharField(source='contact.phone', read_only=True)
    flow_name = serializers.CharField(source='flow.name', read_only=True, default='')

    class Meta:
        model = BotConversation
        fields = [
            'id', 'flow', 'flow_name', 'contact', 'contact_name', 'contact_phone',
            'triggered_via', 'status',
            'lead_captured', 'lead', 'ai_takeover_active',
            'started_at', 'last_activity_at', 'ended_at',
        ]


class BotConversationDetailSerializer(BotConversationListSerializer):
    steps = BotConversationStepSerializer(many=True, read_only=True)
    trigger_metadata = serializers.JSONField(read_only=True)
    variables = serializers.JSONField(read_only=True)
    path_history = serializers.JSONField(read_only=True)

    class Meta(BotConversationListSerializer.Meta):
        fields = BotConversationListSerializer.Meta.fields + [
            'trigger_metadata', 'variables', 'path_history', 'current_node_id',
            'handed_off_to_user', 'handed_off_at', 'steps',
        ]


# ─────────────────────────────────────────────────────────────────────────────
# Leads
# ─────────────────────────────────────────────────────────────────────────────
class LeadActivitySerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source='actor.email', read_only=True, default='')

    class Meta:
        model = LeadActivity
        fields = ['id', 'activity_type', 'content', 'metadata',
                  'actor', 'actor_email', 'created_at']
        read_only_fields = ['actor', 'actor_email', 'created_at']


class LeadListSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(source='contact.name', read_only=True)
    contact_phone = serializers.CharField(source='contact.phone', read_only=True)
    assigned_email = serializers.CharField(source='assigned_to.email', read_only=True, default='')
    source_flow_name = serializers.CharField(source='source_flow.name', read_only=True, default='')

    class Meta:
        model = Lead
        fields = [
            'id', 'name', 'phone', 'email', 'interest', 'budget', 'location',
            'contact', 'contact_name', 'contact_phone',
            'status', 'quality_score', 'tags',
            'assigned_to', 'assigned_email',
            'source_flow', 'source_flow_name',
            'source_ad_id', 'source_ad_name', 'source_campaign_id', 'source_campaign_name',
            'created_at', 'converted_at', 'conversion_value',
        ]


class LeadDetailSerializer(LeadListSerializer):
    activities = LeadActivitySerializer(many=True, read_only=True)
    custom_fields = serializers.JSONField()
    quality_reason = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    class Meta(LeadListSerializer.Meta):
        fields = LeadListSerializer.Meta.fields + [
            'custom_fields', 'quality_reason', 'notes',
            'source_adset_id', 'source_channel',
            'source_conversation', 'activities', 'updated_at',
            'capi_pushed_at',
        ]


# ─────────────────────────────────────────────────────────────────────────────
# CTWA Campaigns
# ─────────────────────────────────────────────────────────────────────────────
class CTWACampaignSerializer(serializers.ModelSerializer):
    flow_name = serializers.CharField(source='flow.name', read_only=True, default='')
    cpl = serializers.SerializerMethodField()

    class Meta:
        model = CTWACampaign
        fields = [
            'id', 'name', 'flow', 'flow_name',
            'ad_account_id', 'campaign_id', 'campaign_name',
            'adset_ids', 'ad_ids', 'pre_filled_message',
            'is_active',
            'total_clicks', 'total_conversations', 'total_leads', 'total_spent', 'cpl',
            'last_synced_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'total_clicks', 'total_conversations', 'total_leads', 'total_spent',
            'last_synced_at', 'created_at', 'updated_at',
        ]

    def get_cpl(self, obj):
        if obj.total_leads and obj.total_spent:
            return round(float(obj.total_spent) / obj.total_leads, 2)
        return None
