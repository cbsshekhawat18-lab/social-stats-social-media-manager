# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Serializers for the unified inbox."""
from rest_framework import serializers

from .models import Conversation, Message, UnifiedReview


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id', 'conversation',
            'platform_message_id', 'direction',
            'author_name', 'author_handle', 'author_avatar_url',
            'content', 'media_urls',
            'sent_at', 'read_at', 'replied_at',
            'sentiment', 'ai_suggested_reply',
            'sent_by',
            'created_at',
        ]
        read_only_fields = [
            'platform_message_id', 'direction',
            'author_name', 'author_handle', 'author_avatar_url',
            'sent_at', 'read_at', 'replied_at',
            'sentiment', 'ai_suggested_reply',
            'sent_by', 'created_at',
        ]


class ConversationListSerializer(serializers.ModelSerializer):
    """Compact serializer for the list view; omits messages."""
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id', 'client',
            'platform', 'platform_thread_id', 'type',
            'contact_name', 'contact_handle', 'contact_avatar_url',
            'last_message_preview', 'last_message_at',
            'unread_count', 'is_starred', 'is_archived', 'is_resolved',
            'assigned_to', 'assigned_to_name',
            'sentiment', 'tags',
            'updated_at',
        ]
        read_only_fields = fields


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id', 'client',
            'platform', 'platform_thread_id', 'type',
            'contact_name', 'contact_handle', 'contact_avatar_url',
            'last_message_preview', 'last_message_at',
            'unread_count', 'is_starred', 'is_archived', 'is_resolved',
            'assigned_to', 'sentiment',
            'linked_publish_log', 'tags',
            'created_at', 'updated_at',
            'messages',
        ]
        read_only_fields = [
            'platform', 'platform_thread_id', 'type',
            'contact_name', 'contact_handle', 'contact_avatar_url',
            'last_message_preview', 'last_message_at',
            'unread_count',
            'sentiment', 'linked_publish_log',
            'created_at', 'updated_at', 'messages',
        ]


class UnifiedReviewSerializer(serializers.ModelSerializer):
    replied_by_name = serializers.CharField(source='replied_by.get_full_name', read_only=True)

    class Meta:
        model = UnifiedReview
        fields = [
            'id', 'client',
            'platform', 'platform_review_id',
            'reviewer_name', 'reviewer_avatar_url',
            'rating', 'comment', 'language', 'sentiment',
            'status', 'reply_text', 'replied_at', 'replied_by', 'replied_by_name',
            'created_at_platform', 'synced_at',
        ]
        read_only_fields = [
            'platform_review_id',
            'reviewer_name', 'reviewer_avatar_url',
            'rating', 'comment', 'language', 'sentiment',
            'replied_at', 'replied_by', 'replied_by_name',
            'created_at_platform', 'synced_at',
        ]
