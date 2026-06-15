# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Serializers for the competitor tracking module."""
from rest_framework import serializers

from .models import Competitor, CompetitorSnapshot


class CompetitorSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetitorSnapshot
        fields = [
            'id', 'competitor', 'platform', 'date',
            'followers', 'posts_count', 'engagement_rate',
            'avg_likes', 'avg_comments', 'sample_top_posts',
            'created_at',
        ]
        read_only_fields = fields


class CompetitorSerializer(serializers.ModelSerializer):
    latest_snapshots = serializers.SerializerMethodField()

    class Meta:
        model = Competitor
        fields = [
            'id', 'client',
            'name', 'social_links', 'public_handles',
            'follower_history', 'last_synced_at',
            'created_at',
            'latest_snapshots',
        ]
        read_only_fields = ['follower_history', 'last_synced_at',
                            'created_at', 'latest_snapshots']
        extra_kwargs = {
            'client': {'required': False, 'read_only': True},
        }

    def get_latest_snapshots(self, obj):
        """Most recent snapshot per platform."""
        from django.db.models import Max
        # One row per platform — latest by date
        latest = (CompetitorSnapshot.objects
                  .filter(competitor=obj)
                  .values('platform')
                  .annotate(max_date=Max('date')))
        if not latest:
            return []
        keys = [(row['platform'], row['max_date']) for row in latest]
        rows = CompetitorSnapshot.objects.filter(
            competitor=obj,
            platform__in=[k[0] for k in keys],
            date__in=[k[1] for k in keys],
        )
        return CompetitorSnapshotSerializer(rows, many=True).data
