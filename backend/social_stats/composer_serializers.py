# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""DRF serializers for the Unified Composer module."""
from rest_framework import serializers

from .models import (
    UnifiedPost, PlatformPublishLog, MediaAsset,
    PostQueue, QueuedItem, PostEngagement,
)


# ── Media ─────────────────────────────────────────────────────────────────────
class MediaAssetSerializer(serializers.ModelSerializer):
    file_url      = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = [
            'id', 'client',
            'mime_type', 'file_size', 'width', 'height', 'duration_seconds',
            'alt_text', 'tags', 'folder', 'is_used',
            'file_url', 'thumbnail_url',
            'created_at',
        ]
        read_only_fields = [
            'mime_type', 'file_size', 'width', 'height', 'duration_seconds',
            'is_used', 'created_at',
        ]

    def get_file_url(self, obj):
        try:
            return obj.file.url if obj.file else ''
        except Exception:
            return ''

    def get_thumbnail_url(self, obj):
        try:
            return obj.thumbnail.url if obj.thumbnail else ''
        except Exception:
            return ''


# ── Publish log + engagement ──────────────────────────────────────────────────
class PostEngagementSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostEngagement
        fields = [
            'likes', 'comments', 'shares', 'saves',
            'reach', 'impressions', 'video_views',
            'watch_time_seconds', 'click_throughs', 'pulled_at',
        ]


class PlatformPublishLogSerializer(serializers.ModelSerializer):
    engagement = PostEngagementSerializer(read_only=True)

    class Meta:
        model = PlatformPublishLog
        fields = [
            'id', 'unified_post', 'platform', 'status',
            'platform_post_id', 'platform_url',
            'error_code', 'error_message',
            'attempted_at', 'completed_at', 'engagement_synced_at',
            'engagement',
        ]
        read_only_fields = fields


# ── Unified post ──────────────────────────────────────────────────────────────
class UnifiedPostSerializer(serializers.ModelSerializer):
    publish_logs = PlatformPublishLogSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = UnifiedPost
        fields = [
            'id', 'client',
            'title', 'content', 'media_urls', 'media_type',
            'target_platforms', 'platform_overrides',
            'scheduled_at', 'published_at',
            'status', 'is_recurring', 'recurrence_rule',
            'ai_generated', 'ai_prompt',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
            'approved_by', 'approved_at',
            'publish_logs',
        ]
        read_only_fields = [
            'status', 'published_at',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'approved_by', 'approved_at',
        ]

    def validate_target_platforms(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('target_platforms must be a list')
        return [str(p).lower() for p in value if p]

    def validate(self, attrs):
        media_type = attrs.get('media_type', 'text')
        media_urls = attrs.get('media_urls') or []
        if media_type != 'text' and not media_urls:
            raise serializers.ValidationError(
                {'media_urls': 'At least one media URL is required for non-text posts'}
            )
        return attrs


class UnifiedPostListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views — omits publish_logs to keep payload small."""
    platform_count = serializers.SerializerMethodField()

    class Meta:
        model = UnifiedPost
        fields = [
            'id', 'client', 'title',
            'content', 'media_type', 'target_platforms', 'platform_count',
            'status', 'scheduled_at', 'published_at',
            'created_by', 'created_at',
        ]
        read_only_fields = fields

    def get_platform_count(self, obj):
        return len(obj.target_platforms or [])


# ── Queues ────────────────────────────────────────────────────────────────────
class QueuedItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QueuedItem
        fields = [
            'id', 'queue',
            'content', 'media_urls', 'hashtags', 'sort_order', 'status',
            'used_at', 'unified_post', 'created_at',
        ]
        read_only_fields = ['status', 'used_at', 'unified_post', 'created_at']


class PostQueueSerializer(serializers.ModelSerializer):
    items_count   = serializers.SerializerMethodField()
    waiting_count = serializers.SerializerMethodField()

    class Meta:
        model = PostQueue
        fields = [
            'id', 'client', 'name', 'platforms', 'schedule_rule',
            'queue_strategy', 'is_active',
            'last_dispatched_at',
            'items_count', 'waiting_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['last_dispatched_at', 'created_at', 'updated_at']

    def get_items_count(self, obj):
        return obj.items.count()

    def get_waiting_count(self, obj):
        return obj.items.filter(status='waiting').count()
