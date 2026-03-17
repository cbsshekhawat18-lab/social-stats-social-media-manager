from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Client, UserProfile, PlatformCredential, DailyMetric, PostMetric, SyncLog, ClientGoal, Alert, AIInsight, WeeklyTopPost, SharedReport, OnboardingStep, ONBOARDING_STEP_DESCRIPTIONS, ROISettings, ROIReport


class UserSerializer(serializers.ModelSerializer):
    role       = serializers.CharField(source='profile.role', read_only=True)
    client_id  = serializers.IntegerField(source='profile.client_id', read_only=True)

    class Meta:
        model  = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'client_id']


class ClientSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(required=False)

    class Meta:
        model  = Client
        fields = '__all__'


class PlatformCredentialSerializer(serializers.ModelSerializer):
    access_token  = serializers.CharField(write_only=True, required=False, allow_blank=True)
    refresh_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    status        = serializers.ReadOnlyField()

    class Meta:
        model  = PlatformCredential
        fields = [
            'id', 'client', 'platform', 'status',
            'access_token', 'refresh_token', 'expires_at', 'scope',
            'page_id', 'page_name', 'instagram_account_id',
            'channel_id', 'channel_name',
            'organization_id', 'organization_name',
            'gmb_account_id', 'gmb_location_id',
            'is_active', 'connected_at', 'updated_at',
        ]


class DailyMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DailyMetric
        fields = '__all__'


class PostMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PostMetric
        fields = '__all__'


class SyncLogSerializer(serializers.ModelSerializer):
    client_name      = serializers.CharField(source='client.company', read_only=True)
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model  = SyncLog
        fields = '__all__'

    def get_duration_seconds(self, obj):
        if obj.finished_at and obj.started_at:
            return round((obj.finished_at - obj.started_at).total_seconds(), 1)
        return None


class ClientGoalSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company', read_only=True)

    class Meta:
        model  = ClientGoal
        fields = ['id', 'client', 'client_name', 'platform', 'metric',
                  'target_value', 'month', 'year', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class AlertSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company', read_only=True)

    class Meta:
        model  = Alert
        fields = ['id', 'client', 'client_name', 'platform', 'alert_type',
                  'message', 'is_read', 'created_at']
        read_only_fields = ['created_at']


class AIInsightSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company', read_only=True)

    class Meta:
        model  = AIInsight
        fields = ['id', 'client', 'client_name', 'month', 'year', 'content', 'generated_at']
        read_only_fields = ['content', 'generated_at']


class PostMetricInlineSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PostMetric
        fields = [
            'id', 'post_url', 'post_type', 'caption', 'thumbnail_url', 'published_at',
            'impressions', 'reach', 'clicks', 'likes', 'comments', 'shares', 'saves', 'video_views',
        ]


class WeeklyTopPostSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company', read_only=True)
    post        = PostMetricInlineSerializer(source='post_metric', read_only=True)

    class Meta:
        model  = WeeklyTopPost
        fields = ['id', 'client', 'client_name', 'platform', 'week_start', 'score', 'rank', 'post', 'created_at']


class SharedReportSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company', read_only=True)
    share_url   = serializers.SerializerMethodField()
    is_expired  = serializers.BooleanField(read_only=True)
    password    = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model  = SharedReport
        fields = [
            'id', 'client', 'client_name', 'token', 'date_from', 'date_until',
            'platforms', 'is_password_protected', 'expires_at',
            'view_count', 'last_viewed_at', 'is_active', 'created_at',
            'share_url', 'is_expired', 'password',
        ]
        read_only_fields = ['token', 'view_count', 'last_viewed_at', 'created_at', 'is_expired']

    def get_share_url(self, obj):
        from django.conf import settings
        return f"{settings.FRONTEND_URL}/report/{obj.token}"

    def create(self, validated_data):
        validated_data.pop('password', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('password', None)
        return super().update(instance, validated_data)


class OnboardingStepSerializer(serializers.ModelSerializer):
    description = serializers.SerializerMethodField()
    label       = serializers.SerializerMethodField()
    client      = serializers.IntegerField(source='client_id', read_only=True)
    client_name = serializers.CharField(source='client.company', read_only=True)

    class Meta:
        model  = OnboardingStep
        fields = ['id', 'client', 'client_name', 'step_key', 'label', 'description', 'is_completed', 'completed_at', 'completed_by']
        read_only_fields = ['step_key', 'completed_at', 'completed_by']

    def get_description(self, obj):
        return ONBOARDING_STEP_DESCRIPTIONS.get(obj.step_key, '')

    def get_label(self, obj):
        return dict(obj._meta.get_field('step_key').choices).get(obj.step_key, obj.step_key)


class ROISettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ROISettings
        fields = '__all__'

    def validate_facebook_budget(self, v):
        if v < 0: raise serializers.ValidationError("Budget cannot be negative.")
        return v
    def validate_instagram_budget(self, v):
        if v < 0: raise serializers.ValidationError("Budget cannot be negative.")
        return v
    def validate_youtube_budget(self, v):
        if v < 0: raise serializers.ValidationError("Budget cannot be negative.")
        return v
    def validate_linkedin_budget(self, v):
        if v < 0: raise serializers.ValidationError("Budget cannot be negative.")
        return v
    def validate_gmb_budget(self, v):
        if v < 0: raise serializers.ValidationError("Budget cannot be negative.")
        return v
    def validate_agency_fee(self, v):
        if v < 0: raise serializers.ValidationError("Agency fee cannot be negative.")
        return v
    def validate_avg_sale_value(self, v):
        if v < 0: raise serializers.ValidationError("Sale value cannot be negative.")
        return v
    def validate_conversion_rate(self, v):
        if v < 0 or v > 100: raise serializers.ValidationError("Conversion rate must be 0-100.")
        return v
    def validate_lead_to_sale_rate(self, v):
        if v < 0 or v > 100: raise serializers.ValidationError("Lead-to-sale rate must be 0-100.")
        return v


class ROIReportSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company', read_only=True)

    class Meta:
        model  = ROIReport
        fields = '__all__'
        read_only_fields = ['generated_at']
