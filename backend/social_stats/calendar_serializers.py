# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Serializers for the Content Calendar feature.
"""
from datetime import date as date_cls
from django.utils import timezone
from rest_framework import serializers

from .models import CalendarPost, CalendarNote, PostingSchedule, PLATFORM_CHOICES

PLATFORM_META = {
    'facebook':          {'label': 'Facebook',            'color': '#1877F2', 'icon': '📘'},
    'instagram':         {'label': 'Instagram',           'color': '#E1306C', 'icon': '📸'},
    'youtube':           {'label': 'YouTube',             'color': '#FF0000', 'icon': '▶️'},
    'linkedin':          {'label': 'LinkedIn',            'color': '#0A66C2', 'icon': '💼'},
    'google_my_business':{'label': 'Google My Business',  'color': '#34A853', 'icon': '🏢'},
}

PLATFORM_KEYS = list(PLATFORM_META.keys())

DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


class CalendarPostSerializer(serializers.ModelSerializer):
    # Computed read-only fields
    platform_label    = serializers.SerializerMethodField()
    platform_color    = serializers.SerializerMethodField()
    platform_icon     = serializers.SerializerMethodField()
    days_until        = serializers.SerializerMethodField()
    is_overdue        = serializers.SerializerMethodField()
    performance_score = serializers.SerializerMethodField()

    class Meta:
        model  = CalendarPost
        fields = [
            'id', 'client', 'platform', 'post_type', 'status',
            'title', 'caption', 'hashtags', 'media_url', 'post_url',
            'scheduled_at', 'published_at', 'post_metric',
            'impressions', 'reach', 'likes', 'comments', 'shares',
            'saves', 'video_views', 'engagement_rate',
            'created_by', 'created_at', 'updated_at',
            'external_id', 'notes',
            # computed
            'platform_label', 'platform_color', 'platform_icon',
            'days_until', 'is_overdue', 'performance_score',
        ]
        read_only_fields = [
            'created_at', 'updated_at', 'created_by',
            'platform_label', 'platform_color', 'platform_icon',
            'days_until', 'is_overdue', 'performance_score',
        ]

    def get_platform_label(self, obj):
        return PLATFORM_META.get(obj.platform, {}).get('label', obj.platform)

    def get_platform_color(self, obj):
        return PLATFORM_META.get(obj.platform, {}).get('color', '#64748B')

    def get_platform_icon(self, obj):
        return PLATFORM_META.get(obj.platform, {}).get('icon', '🔗')

    def get_days_until(self, obj):
        target = obj.scheduled_at or obj.published_at
        if not target:
            return None
        delta = (target.date() - date_cls.today()).days
        return delta

    def get_is_overdue(self, obj):
        if obj.status != 'scheduled':
            return False
        if not obj.scheduled_at:
            return False
        return timezone.now() > obj.scheduled_at

    def get_performance_score(self, obj):
        return (
            obj.likes        * 2 +
            obj.comments     * 3 +
            obj.shares       * 4 +
            obj.saves        * 3 +
            int(obj.impressions * 0.1)
        )

    def validate_platform(self, value):
        if value not in PLATFORM_KEYS:
            raise serializers.ValidationError(f"Platform must be one of: {', '.join(PLATFORM_KEYS)}")
        return value

    def validate(self, data):
        status      = data.get('status', getattr(self.instance, 'status', None))
        scheduled_at = data.get('scheduled_at', getattr(self.instance, 'scheduled_at', None))
        published_at = data.get('published_at', getattr(self.instance, 'published_at', None))

        # Scheduled posts in the future only (on create)
        if not self.instance and status == 'scheduled' and scheduled_at:
            if scheduled_at <= timezone.now():
                raise serializers.ValidationError({'scheduled_at': 'Scheduled time must be in the future.'})

        # Published posts require published_at
        if status == 'published' and not published_at:
            # Allow it — could be synced post without exact time
            pass

        return data


class CalendarNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CalendarNote
        fields = [
            'id', 'client', 'date', 'title', 'note',
            'color', 'is_client_visible', 'created_by', 'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']

    def validate_color(self, value):
        import re
        if not re.match(r'^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$', value):
            raise serializers.ValidationError('Color must be a valid hex code (e.g. #2563EB).')
        return value


class PostingScheduleSerializer(serializers.ModelSerializer):
    day_name = serializers.SerializerMethodField()

    class Meta:
        model  = PostingSchedule
        fields = [
            'id', 'client', 'platform', 'day_of_week', 'hour', 'minute',
            'is_active', 'note', 'day_name',
        ]
        read_only_fields = ['day_name']

    def get_day_name(self, obj):
        try:
            return DAY_NAMES[obj.day_of_week]
        except (IndexError, TypeError):
            return ''

    def validate_day_of_week(self, value):
        if value not in range(7):
            raise serializers.ValidationError('day_of_week must be 0 (Monday) to 6 (Sunday).')
        return value

    def validate_hour(self, value):
        if value not in range(24):
            raise serializers.ValidationError('hour must be 0–23.')
        return value

    def validate_minute(self, value):
        if value not in range(60):
            raise serializers.ValidationError('minute must be 0–59.')
        return value
