# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
from datetime import date, timedelta
from django.db.models import Sum, Avg
from django.contrib.auth.models import User
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from django.db.models import F
from django.utils import timezone

from .models import Client, UserProfile, PlatformCredential, DailyMetric, PostMetric, SyncLog, ClientGoal, Alert, AIInsight, WeeklyTopPost, SharedReport, OnboardingStep, SiteContent, LookupCollection, ensure_client_profile, GMBBusinessInfo, GMBReview
from .serializers import (
    ClientSerializer, PlatformCredentialSerializer,
    DailyMetricSerializer, PostMetricSerializer, SyncLogSerializer, UserSerializer, ClientGoalSerializer,
    AlertSerializer, AIInsightSerializer, WeeklyTopPostSerializer, SharedReportSerializer,
    OnboardingStepSerializer, SiteContentSerializer, LookupCollectionSerializer,
    GMBBusinessInfoSerializer, GMBReviewSerializer,
)


# ── Custom JWT: include role + client_id in token ─────────────────────────────
class CustomTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        try:
            profile = user.profile
            ensure_client_profile(profile)
            token['role']      = profile.role
            token['client_id'] = profile.client_id
            token['name']      = user.get_full_name() or user.username
            # Include permissions in token
            from .permissions import PermissionChecker
            token['permissions'] = PermissionChecker.get_user_permissions(profile)
            # Include portal config for client users
            if profile.role == 'client' and profile.client:
                try:
                    cfg = profile.client.page_config
                    token['portal_config'] = {
                        'portal_title':         cfg.portal_title,
                        'show_platform_tabs':   cfg.show_platform_tabs,
                        'show_date_picker':     cfg.show_date_picker,
                        'show_export_button':   cfg.show_export_button,
                        'show_sync_button':     cfg.show_sync_button,
                        'show_posts_section':   cfg.show_posts_section,
                        'show_reviews_section': cfg.show_reviews_section,
                        'show_roi_section':     cfg.show_roi_section,
                        'show_calendar':        cfg.show_calendar,
                        'default_platform':     cfg.default_platform,
                        'default_date_range':   cfg.default_date_range,
                        'custom_accent_color':  cfg.custom_accent_color,
                        'welcome_message':      cfg.welcome_message,
                    }
                except Exception:
                    token['portal_config'] = {}
        except Exception:
            token['role'] = 'client'
            token['permissions'] = {}
        return token

class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenSerializer
    permission_classes = [AllowAny]
    from .security.throttles import LoginIPThrottle  # noqa: E402
    throttle_classes = [LoginIPThrottle]

    def post(self, request, *args, **kwargs):
        terms_accepted = request.data.get('terms_accepted', False)
        if not terms_accepted:
            return Response(
                {'detail': 'You must accept the Terms of Service and Privacy Policy to sign in.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check for unverified email/password accounts before simplejwt rejects them
        username = request.data.get('username', '').strip().lower()
        try:
            candidate = User.objects.get(username=username)
            if not candidate.is_active:
                # Check if they have an email verification pending
                has_token = hasattr(candidate, 'email_verification')
                if has_token:
                    return Response(
                        {'detail': 'email_not_verified', 'email': candidate.email},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
        except User.DoesNotExist:
            pass

        password_for_mfa = request.data.get('password', '')
        user_has_mfa = False
        if username:
            try:
                _u = User.objects.get(username=username)
                user_has_mfa = bool(getattr(_u, 'mfa', None) and _u.mfa.is_enabled)
            except User.DoesNotExist:
                pass

        if user_has_mfa and password_for_mfa:
            from django.contrib.auth import authenticate
            mfa_user = authenticate(request, username=username, password=password_for_mfa)
            if mfa_user:
                from .security.mfa import issue_mfa_token
                from .security.sessions import _client_ip
                ip = _client_ip(request)
                token = issue_mfa_token(user_id=mfa_user.id, ip=ip)
                return Response(
                    {
                        'mfa_required': True,
                        'mfa_token':    token,
                        'expires_in':   300,
                        'detail':       'mfa_required',
                    },
                    status=status.HTTP_200_OK,
                )
            # password was wrong — fall through to super().post() so simplejwt
            # produces the canonical "no active account" 401. The
            # authenticate() call already recorded the failure with axes, and
            # super().post() will also try; axes is keyed by (username, ip)
            # within the cooloff window so the second hit is just a tick.

        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = request.data.get('username', '')
            try:
                user = User.objects.get(username=username)
                profile = user.profile
                if not profile.terms_accepted:
                    profile.terms_accepted = True
                    profile.terms_accepted_at = timezone.now()
                    profile.save(update_fields=['terms_accepted', 'terms_accepted_at'])
            except Exception:
                pass

            try:
                self._record_login_session(request, response)
            except Exception:
                # Never let session bookkeeping break a successful login
                import logging
                logging.getLogger(__name__).exception('login session recording failed')
        return response

    def _record_login_session(self, request, response):
        """Persist a UserSession row for the just-issued refresh token + send
        a 'new login detected' email if the (IP, browser+os) combo is new."""
        from datetime import datetime, timezone as dt_tz
        from rest_framework_simplejwt.tokens import RefreshToken

        refresh_str = (response.data or {}).get('refresh')
        if not refresh_str:
            return
        try:
            rt = RefreshToken(refresh_str)
        except Exception:
            return
        jti     = rt.get('jti', '')
        exp_ts  = rt.get('exp')
        if not jti or not exp_ts:
            return
        expires_at = datetime.fromtimestamp(exp_ts, tz=dt_tz.utc)

        username = (request.data.get('username') or '').strip().lower()
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return

        from .security.sessions import record_session
        from .security.login_monitor import is_suspicious, notify_new_login
        from .security import audit

        # Run suspicious-login detection BEFORE recording the new session,
        # otherwise the new row would self-match and mask any new-context.
        suspicious, ctx = is_suspicious(user=user, request=request)

        record_session(user=user, refresh_jti=jti,
                       expires_at=expires_at, request=request)

        audit.record(
            event_type='suspicious_login' if suspicious else 'login_success',
            actor_user=user, request=request,
            target_object_type='User', target_object_id=user.id,
            metadata={'jti': jti[:12], **{k: v for k, v in ctx.items() if k != 'ip'}},
        )

        if suspicious:
            notify_new_login(user=user, context=ctx)


# ── Helpers ───────────────────────────────────────────────────────────────────
def parse_dates(request):
    today = date.today()
    since = request.query_params.get('since', (today - timedelta(days=30)).isoformat())
    until = request.query_params.get('until', today.isoformat())
    try:
        return date.fromisoformat(since), date.fromisoformat(until)
    except ValueError:
        return today - timedelta(days=30), today


def check_client_access(request, client_id):
    """Returns True if user is allowed to access this client's data."""
    try:
        profile = request.user.profile
        return profile.can_access_client(client_id)
    except Exception:
        return False


def _silent_token_refresh(client_id):
    """Silently refresh any expired OAuth tokens for a client. Fire-and-forget."""
    try:
        from .oauth_views import _refresh_google_token, _refresh_facebook_token
        creds = PlatformCredential.objects.filter(client_id=client_id, is_active=True)
        for cred in creds:
            if cred.is_expired and cred.refresh_token:
                if cred.platform in ('youtube', 'google_my_business'):
                    _refresh_google_token(cred)
                elif cred.platform in ('facebook', 'instagram'):
                    _refresh_facebook_token(cred)
    except Exception:
        pass  # Never block the /me response


# ── Me endpoint ───────────────────────────────────────────────────────────────
@api_view(['GET'])
def me(request):
    from django.conf import settings as dj_settings
    user = request.user
    data = UserSerializer(user).data
    try:
        from .permissions import PermissionChecker
        profile = user.profile
        ensure_client_profile(profile)
        data = UserSerializer(user).data
        data['permissions'] = PermissionChecker.get_user_permissions(profile)
        data['onboarding_complete'] = profile.client.onboarding_complete if profile.client else False
        # Feature flags surfaced to the client app.
        data['feature_flags'] = {
            'oauth_apps_approved': bool(getattr(dj_settings, 'OAUTH_APPS_APPROVED', False)),
        }
        # Silently refresh any expired platform tokens on every page load
        if profile.client_id:
            _silent_token_refresh(profile.client_id)
        # Marketplace (): surface the primary agency slug so the
        # agency-side marketplace profile editor can resolve its target.
        try:
            if profile.primary_agency_id:
                data['primary_agency_slug'] = profile.primary_agency.slug
        except Exception:
            pass
        if profile.role == 'client' and profile.client:
            try:
                cfg = profile.client.page_config
                data['portal_config'] = {
                    'portal_title':         cfg.portal_title,
                    'show_platform_tabs':   cfg.show_platform_tabs,
                    'show_date_picker':     cfg.show_date_picker,
                    'show_export_button':   cfg.show_export_button,
                    'show_sync_button':     cfg.show_sync_button,
                    'show_posts_section':   cfg.show_posts_section,
                    'show_reviews_section': cfg.show_reviews_section,
                    'show_roi_section':     cfg.show_roi_section,
                    'show_calendar':        cfg.show_calendar,
                    'default_platform':     cfg.default_platform,
                    'default_date_range':   cfg.default_date_range,
                    'custom_accent_color':  cfg.custom_accent_color,
                    'welcome_message':      cfg.welcome_message,
                }
            except Exception:
                data['portal_config'] = {}
    except Exception:
        data['permissions'] = {}
    return Response(data)


# ── Clients ───────────────────────────────────────────────────────────────────
class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        from django.db.models import Q
        try:
            profile = self.request.user.profile
        except Exception:
            return Client.objects.none()

        if profile.role == 'superadmin':
            if self.action == 'list':
                # AllClientsPage: only show properly onboarded clients
                # (admin-created OR accepted invitation from this agency)
                return Client.objects.filter(
                    Q(userprofile__isnull=True) |
                    Q(userprofile__is_self_registered=False) |
                    Q(userprofile__agency=self.request.user)
                ).distinct().order_by('company')
            # All other actions (trigger_sync, dashboard, settings, etc.)
            # allow full access to every client
            return Client.objects.all().order_by('company')
        if profile.role == 'staff':
            return profile.assigned_clients.all()
        if profile.role == 'client' and profile.client:
            return Client.objects.filter(id=profile.client_id)
        return Client.objects.none()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        if not check_client_access(request, pk):
            return Response({'error': 'Access denied'}, status=403)

        client = self.get_object()
        since, until = parse_dates(request)
        platform = request.query_params.get('platform')

        qs = DailyMetric.objects.filter(client=client, date__range=(since, until))
        if platform and platform != 'all':
            qs = qs.filter(platform=platform)

        agg = qs.aggregate(
            total_impressions=Sum('impressions'),
            total_reach=Sum('reach'),
            total_clicks=Sum('clicks'),
            total_likes=Sum('likes'),
            total_comments=Sum('comments'),
            total_shares=Sum('shares'),
            total_saves=Sum('saves'),
            total_video_views=Sum('video_views'),
            total_followers=Sum('followers'),
            total_profile_views=Sum('profile_views'),
            total_website_clicks=Sum('website_clicks'),
            total_phone_calls=Sum('phone_calls'),
            total_direction_requests=Sum('direction_requests'),
            total_watch_time_minutes=Sum('watch_time_minutes'),
            total_subscribers_lost=Sum('subscribers_lost'),
            avg_view_duration=Avg('avg_view_duration'),
            # Facebook
            total_followers_lost=Sum('followers_lost'),
            total_negative_feedback=Sum('negative_feedback'),
            total_fb_video_views=Sum('fb_video_views'),
            total_fb_video_watch_time=Sum('fb_video_watch_time'),
            # Instagram
            total_accounts_engaged=Sum('accounts_engaged'),
            total_total_interactions=Sum('total_interactions'),
            total_email_contacts=Sum('email_contacts'),
            total_phone_call_clicks=Sum('phone_call_clicks'),
            total_direction_clicks=Sum('direction_clicks'),
            total_ig_followers_lost=Sum('ig_followers_lost'),
            avg_ctr=Avg('ctr'),
            avg_engagement=Avg('engagement_rate'),
        )
        for k, v in agg.items():
            if v is None:
                agg[k] = 0

        by_platform = list(qs.values('platform').annotate(
            impressions=Sum('impressions'),
            reach=Sum('reach'),
            clicks=Sum('clicks'),
            likes=Sum('likes'),
            video_views=Sum('video_views'),
            followers=Sum('followers'),
        ))

        return Response({
            'client':      ClientSerializer(client).data,
            'period':      {'since': since.isoformat(), 'until': until.isoformat()},
            'totals':      agg,
            'by_platform': by_platform,
        })

    @action(detail=True, methods=['get'])
    def timeseries(self, request, pk=None):
        if not check_client_access(request, pk):
            return Response({'error': 'Access denied'}, status=403)

        client = self.get_object()
        since, until = parse_dates(request)
        platform = request.query_params.get('platform')

        qs = DailyMetric.objects.filter(
            client=client, date__range=(since, until)
        ).order_by('date')
        if platform and platform != 'all':
            qs = qs.filter(platform=platform)

        return Response(DailyMetricSerializer(qs, many=True).data)

    @action(detail=True, methods=['get'])
    def posts(self, request, pk=None):
        if not check_client_access(request, pk):
            return Response({'error': 'Access denied'}, status=403)

        client   = self.get_object()
        platform = request.query_params.get('platform')
        limit    = int(request.query_params.get('limit', 20))
        offset   = int(request.query_params.get('offset', 0))
        since, until = parse_dates(request)

        qs = PostMetric.objects.filter(
            client=client,
            published_at__date__gte=since,
            published_at__date__lte=until,
        )
        if platform and platform != 'all':
            qs = qs.filter(platform=platform)

        total = qs.count()
        posts = list(PostMetricSerializer(qs[offset:offset + limit], many=True).data)

        # Attach account name from stored credentials
        creds = {
            c.platform: c.page_name or c.channel_name or c.organization_name
            for c in PlatformCredential.objects.filter(client=client)
        }
        for post in posts:
            post['account_name'] = creds.get(post['platform'], '')

        return Response({
            'results': posts,
            'total': total,
            'has_more': (offset + limit) < total,
        })

    @action(detail=True, methods=['post'])
    def trigger_sync(self, request, pk=None):
        if not check_client_access(request, pk):
            return Response({'error': 'Access denied'}, status=403)

        from .tasks import sync_facebook, sync_instagram, sync_youtube, sync_linkedin, sync_gmb
        client    = self.get_object()
        platforms = request.data.get('platforms', ['facebook','instagram','youtube','linkedin','google_my_business'])
        task_map  = {
            'facebook': sync_facebook, 'instagram': sync_instagram,
            'youtube': sync_youtube, 'linkedin': sync_linkedin,
            'google_my_business': sync_gmb,
        }
        queued = []
        for p in platforms:
            has_cred = PlatformCredential.objects.filter(
                client=client, platform=p, is_active=True
            ).exclude(access_token='').exists()
            if has_cred and p in task_map:
                task_map[p].delay(client.id)
                queued.append(p)

        return Response({'queued': queued})

    @action(detail=True, methods=['get'])
    def sync_status(self, request, pk=None):
        if not check_client_access(request, pk):
            return Response({'error': 'Access denied'}, status=403)

        logs = SyncLog.objects.filter(client_id=pk).order_by('-started_at')[:20]
        return Response(SyncLogSerializer(logs, many=True).data)


# ── Platform Credentials ──────────────────────────────────────────────────────
def _agency_client_ids(request):
    """Return list of client IDs this user is allowed to see."""
    from django.db.models import Q
    try:
        profile = request.user.profile
        role    = profile.role
    except Exception:
        return []
    if role == 'staff':
        return list(profile.assigned_clients.values_list('id', flat=True))
    if role == 'superadmin':
        return list(
            Client.objects.filter(
                Q(userprofile__isnull=True) |
                Q(userprofile__is_self_registered=False) |
                Q(userprofile__agency=request.user)
            ).distinct().values_list('id', flat=True)
        )
    if role == 'client' and profile.client_id:
        return [profile.client_id]
    return []


class CredentialViewSet(viewsets.ModelViewSet):
    serializer_class = PlatformCredentialSerializer

    def get_queryset(self):
        client_ids = _agency_client_ids(self.request)
        client_id  = self.request.query_params.get('client')
        qs = PlatformCredential.objects.select_related('client').filter(client_id__in=client_ids)
        if client_id:
            qs = qs.filter(client_id=client_id)
        return qs


# ── Sync Logs ─────────────────────────────────────────────────────────────────
class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SyncLogSerializer

    def get_queryset(self):
        client_ids = _agency_client_ids(self.request)
        client_id  = self.request.query_params.get('client')
        qs = SyncLog.objects.select_related('client').filter(client_id__in=client_ids)
        if client_id:
            qs = qs.filter(client_id=client_id)
        return qs.order_by('-started_at')[:100]


# ── Goals ─────────────────────────────────────────────────────────────────────
class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = ClientGoalSerializer

    def get_queryset(self):
        client_ids = _agency_client_ids(self.request)
        client_id  = self.request.query_params.get('client')
        month      = self.request.query_params.get('month')
        year       = self.request.query_params.get('year')
        qs = ClientGoal.objects.select_related('client').filter(client_id__in=client_ids)
        if client_id:
            qs = qs.filter(client_id=client_id)
        if month:
            qs = qs.filter(month=month)
        if year:
            qs = qs.filter(year=year)
        return qs

    def perform_create(self, serializer):
        try:
            profile = self.request.user.profile
            role = profile.role
        except Exception:
            role = None
            profile = None
        if role not in ('superadmin', 'staff', 'client'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        client = serializer.save()
        # Link new client to this user's profile if they don't have one yet
        if role == 'client' and profile and not profile.client:
            profile.client = client
            profile.save()

    def perform_update(self, serializer):
        try:
            profile = self.request.user.profile
            role = profile.role
        except Exception:
            role = None
            profile = None
        # Allow client to update their own record
        if role == 'client' and profile and profile.client_id == serializer.instance.id:
            serializer.save()
            return
        if role not in ('superadmin', 'staff'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        try:
            role = self.request.user.profile.role
        except Exception:
            role = None
        if role not in ('superadmin', 'staff'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        instance.delete()

    @action(detail=False, methods=['get'], url_path='progress')
    def progress(self, request):
        client_id = request.query_params.get('client')
        month     = int(request.query_params.get('month', date.today().month))
        year      = int(request.query_params.get('year',  date.today().year))

        if not client_id:
            return Response({'error': 'client is required'}, status=400)
        if not check_client_access(request, client_id):
            return Response({'error': 'Access denied'}, status=403)

        goals = ClientGoal.objects.filter(client_id=client_id, month=month, year=year)

        since = date(year, month, 1)
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)
        until = min(month_end, date.today())

        today = date.today()
        month_passed = today > month_end

        results = []
        for goal in goals:
            qs = DailyMetric.objects.filter(client_id=client_id, date__range=(since, until))
            if goal.platform != 'all':
                qs = qs.filter(platform=goal.platform)

            agg     = qs.aggregate(current=Sum(goal.metric))
            current = agg['current'] or 0
            pct     = round(current / goal.target_value * 100, 1) if goal.target_value > 0 else 0

            if current >= goal.target_value:
                goal_status = 'completed'
            elif month_passed:
                goal_status = 'missed'
            elif pct >= 80:
                goal_status = 'on_track'
            else:
                goal_status = 'at_risk'

            results.append({
                'id':            goal.id,
                'platform':      goal.platform,
                'metric':        goal.metric,
                'target_value':  goal.target_value,
                'current_value': current,
                'percentage':    min(pct, 100),
                'status':        goal_status,
                'month':         goal.month,
                'year':          goal.year,
            })

        return Response(results)


# ── Alerts ────────────────────────────────────────────────────────────────────
class AlertViewSet(viewsets.ModelViewSet):
    serializer_class   = AlertSerializer
    http_method_names  = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        try:
            profile = self.request.user.profile
        except Exception:
            return Alert.objects.none()

        client_ids = _agency_client_ids(self.request)
        qs = Alert.objects.select_related('client').filter(client_id__in=client_ids)

        client_id = self.request.query_params.get('client')
        is_read   = self.request.query_params.get('is_read')
        if client_id:
            qs = qs.filter(client_id=client_id)
        if is_read is not None:
            qs = qs.filter(is_read=(is_read.lower() == 'true'))
        return qs

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        alert = self.get_object()
        alert.is_read = True
        alert.save(update_fields=['is_read'])
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        qs = self.get_queryset().filter(is_read=False)
        client_id = request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)
        qs.update(is_read=True)
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'], url_path='run_check')
    def run_check(self, request):
        """Manually trigger the alert check (admin only)."""
        try:
            if request.user.profile.role not in ('superadmin', 'staff'):
                return Response({'error': 'Forbidden'}, status=403)
        except Exception:
            return Response({'error': 'Forbidden'}, status=403)
        from .tasks import check_alerts
        check_alerts.delay()
        return Response({'status': 'check triggered'})


# ── Admin: create client + user account ───────────────────────────────────────
@api_view(['POST'])
def create_client_user(request):
    """Superadmin creates a new client + login account in one step."""
    try:
        profile = request.user.profile
        if profile.role != 'superadmin':
            return Response({'error': 'Only superadmin can create clients'}, status=403)
    except Exception:
        return Response({'error': 'Forbidden'}, status=403)

    data     = request.data
    company  = data.get('company', '')
    name     = data.get('name', '')
    email    = data.get('email', '')
    password = data.get('password', '')

    if not all([company, name, email, password]):
        return Response({'error': 'company, name, email, password are required'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=400)

    # Create Client
    client = Client.objects.create(company=company, name=name, email=email)

    # Create Django User
    user = User.objects.create_user(
        username=email, email=email, password=password,
        first_name=name.split()[0] if name else '',
        last_name=' '.join(name.split()[1:]) if len(name.split()) > 1 else '',
    )

    # Create UserProfile
    UserProfile.objects.create(user=user, role='client', client=client)

    return Response({
        'message': f'Client "{company}" created successfully',
        'client_id': client.id,
        'user_id':   user.id,
    }, status=201)


# ── AI Insights ───────────────────────────────────────────────────────────────
class AIInsightViewSet(viewsets.GenericViewSet):
    serializer_class = AIInsightSerializer

    def list(self, request):
        client_id = request.query_params.get('client')
        month     = request.query_params.get('month')
        year      = request.query_params.get('year')

        if not client_id:
            return Response({'error': 'client is required'}, status=400)
        if not check_client_access(request, client_id):
            return Response({'error': 'Access denied'}, status=403)

        qs = AIInsight.objects.filter(client_id=client_id)
        if month: qs = qs.filter(month=month)
        if year:  qs = qs.filter(year=year)
        return Response(AIInsightSerializer(qs, many=True).data)

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        """Superadmin/staff only — queues the Celery task."""
        try:
            role = request.user.profile.role
        except Exception:
            role = None
        if role not in ('superadmin', 'staff'):
            return Response({'error': 'Forbidden'}, status=403)

        client_id = request.data.get('client')
        month     = request.data.get('month', date.today().month)
        year      = request.data.get('year',  date.today().year)

        if not client_id:
            return Response({'error': 'client is required'}, status=400)

        from .tasks import generate_ai_insights
        generate_ai_insights.delay(int(client_id), int(month), int(year))
        return Response({'status': 'generating'})


# ── Weekly Top Posts ──────────────────────────────────────────────────────────
class WeeklyTopPostViewSet(viewsets.GenericViewSet):
    serializer_class = WeeklyTopPostSerializer

    @staticmethod
    def _current_week_start():
        today = date.today()
        return today - timedelta(days=today.weekday())  # This Monday

    def list(self, request):
        client_id = request.query_params.get('client')
        week_str  = request.query_params.get('week')

        try:
            week_start = date.fromisoformat(week_str) if week_str else self._current_week_start()
        except ValueError:
            return Response({'error': 'Invalid week format (use YYYY-MM-DD)'}, status=400)

        if client_id:
            if not check_client_access(request, client_id):
                return Response({'error': 'Access denied'}, status=403)
            qs = WeeklyTopPost.objects.filter(
                client_id=client_id, week_start=week_start, rank=1
            ).select_related('post_metric', 'client')
        else:
            # Admin: all clients for this week
            try:
                if request.user.profile.role not in ('superadmin', 'staff'):
                    return Response({'error': 'client is required'}, status=400)
            except Exception:
                return Response({'error': 'client is required'}, status=400)
            qs = WeeklyTopPost.objects.filter(
                week_start=week_start, rank=1
            ).select_related('post_metric', 'client').order_by('-score')

        data = WeeklyTopPostSerializer(qs, many=True).data

        # Attach avg_score for "vs average" comparison per platform
        from django.db.models import Avg
        for item in data:
            avg = WeeklyTopPost.objects.filter(
                client_id=item['client'], platform=item['platform'], rank=1
            ).aggregate(v=Avg('score'))['v'] or 0
            item['avg_score'] = round(avg, 2)

        return Response(data)

    @action(detail=False, methods=['get'], url_path='all-time')
    def all_time(self, request):
        client_id = request.query_params.get('client')
        platform  = request.query_params.get('platform')

        if client_id:
            if not check_client_access(request, client_id):
                return Response({'error': 'Access denied'}, status=403)
            qs = WeeklyTopPost.objects.filter(client_id=client_id, rank=1)
        else:
            try:
                if request.user.profile.role not in ('superadmin', 'staff'):
                    return Response({'error': 'client is required'}, status=400)
            except Exception:
                return Response({'error': 'client is required'}, status=400)
            qs = WeeklyTopPost.objects.filter(rank=1)

        if platform:
            qs = qs.filter(platform=platform)
        qs = qs.select_related('post_metric', 'client').order_by('-score')[:10]
        return Response(WeeklyTopPostSerializer(qs, many=True).data)

    @action(detail=False, methods=['post'], url_path='run')
    def run(self, request):
        try:
            if request.user.profile.role not in ('superadmin', 'staff'):
                return Response({'error': 'Forbidden'}, status=403)
        except Exception:
            return Response({'error': 'Forbidden'}, status=403)
        from .tasks import find_best_posts
        find_best_posts.delay()
        return Response({'status': 'triggered'})


# ── Onboarding Checklist ──────────────────────────────────────────────────────
class OnboardingViewSet(viewsets.ModelViewSet):
    serializer_class = OnboardingStepSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        client_id = self.request.query_params.get('client')
        if client_id:
            return OnboardingStep.objects.filter(client_id=client_id)
        try:
            profile = self.request.user.profile
            if profile.role in ('superadmin', 'staff'):
                return OnboardingStep.objects.all()
            if profile.client_id:
                return OnboardingStep.objects.filter(client_id=profile.client_id)
        except Exception:
            pass
        return OnboardingStep.objects.none()

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        is_completed = request.data.get('is_completed')
        if is_completed is True or is_completed == 'true':
            instance.mark_complete(user=request.user)
        elif is_completed is False or is_completed == 'false':
            instance.is_completed = False
            instance.completed_at = None
            instance.completed_by = None
            instance.save(update_fields=['is_completed', 'completed_at', 'completed_by'])
        return Response(OnboardingStepSerializer(instance).data)


# ── Shared Reports ────────────────────────────────────────────────────────────
class SharedReportViewSet(viewsets.ModelViewSet):
    serializer_class = SharedReportSerializer

    def get_queryset(self):
        qs = SharedReport.objects.select_related('client', 'created_by')
        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)
        else:
            try:
                if self.request.user.profile.role not in ('superadmin', 'staff'):
                    qs = qs.filter(client=self.request.user.profile.client)
            except Exception:
                pass
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        raw_password = self.request.data.get('password', '')
        instance = serializer.save(created_by=self.request.user)
        if raw_password:
            instance.is_password_protected = True
            instance.set_password(raw_password)
            instance.save(update_fields=['is_password_protected', 'password_hash'])

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


def _build_report_data(report):
    """Aggregate metrics for the shared report date range and platforms."""
    date_range = (report.date_from, report.date_until)
    qs = DailyMetric.objects.filter(
        client=report.client,
        date__range=date_range,
    )
    if report.platforms:
        qs = qs.filter(platform__in=report.platforms)

    by_platform = list(qs.values('platform').annotate(
        impressions=Sum('impressions'),
        reach=Sum('reach'),
        clicks=Sum('clicks'),
        likes=Sum('likes'),
        followers=Sum('followers'),
        video_views=Sum('video_views'),
    ))

    timeseries = list(
        qs.values('date', 'platform')
          .annotate(
              impressions=Sum('impressions'),
              reach=Sum('reach'),
              clicks=Sum('clicks'),
              likes=Sum('likes'),
          )
          .order_by('date')
    )

    totals = qs.aggregate(
        impressions=Sum('impressions'),
        reach=Sum('reach'),
        clicks=Sum('clicks'),
        likes=Sum('likes'),
        followers=Sum('followers'),
        video_views=Sum('video_views'),
    )

    top_posts = list(
        PostMetric.objects.filter(
            client=report.client,
            published_at__date__range=date_range,
        ).order_by('-likes', '-video_views')[:5]
        .values('platform', 'caption', 'post_url', 'thumbnail_url',
                'likes', 'comments', 'shares', 'video_views', 'published_at')
    )

    return {
        'client': {'name': report.client.company, 'industry': getattr(report.client, 'industry', '')},
        'period': {'from': report.date_from.isoformat(), 'until': report.date_until.isoformat()},
        'totals': totals,
        'by_platform': by_platform,
        'timeseries': timeseries,
        'top_posts': top_posts,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def public_report(request, token):
    try:
        report = SharedReport.objects.select_related('client').get(token=token, is_active=True)
    except SharedReport.DoesNotExist:
        return Response({'error': 'Report not found'}, status=404)

    if report.is_expired:
        return Response({'error': 'This report link has expired'}, status=410)

    if report.is_password_protected:
        # Require password to be sent via POST (handled by public_report_verify)
        # GET returns meta only so the frontend can show the password gate
        return Response({
            'requires_password': True,
            'client_name': report.client.company,
            'period': {'from': report.date_from.isoformat(), 'until': report.date_until.isoformat()},
        })

    # Increment view counter atomically
    SharedReport.objects.filter(pk=report.pk).update(
        view_count=F('view_count') + 1,
        last_viewed_at=timezone.now(),
    )

    data = _build_report_data(report)
    data['requires_password'] = False
    return Response(data)


@api_view(['POST'])
@permission_classes([AllowAny])
def public_report_verify(request, token):
    try:
        report = SharedReport.objects.select_related('client').get(token=token, is_active=True)
    except SharedReport.DoesNotExist:
        return Response({'error': 'Report not found'}, status=404)

    if report.is_expired:
        return Response({'error': 'This report link has expired'}, status=410)

    if not report.is_password_protected:
        # No password needed — redirect to normal view
        SharedReport.objects.filter(pk=report.pk).update(
            view_count=F('view_count') + 1,
            last_viewed_at=timezone.now(),
        )
        data = _build_report_data(report)
        data['requires_password'] = False
        return Response(data)

    raw_password = request.data.get('password', '')
    if not report.verify_password(raw_password):
        return Response({'error': 'Incorrect password'}, status=401)

    SharedReport.objects.filter(pk=report.pk).update(
        view_count=F('view_count') + 1,
        last_viewed_at=timezone.now(),
    )
    data = _build_report_data(report)
    data['requires_password'] = False
    return Response(data)


# ── Overview (superadmin / agency-scoped) ────────────────────────────────────
class OverviewView(APIView):
    def get(self, request):
        from django.db.models import Q
        try:
            profile = request.user.profile
            role    = profile.role
        except Exception:
            return Response({'error': 'Forbidden'}, status=403)

        if role not in ('superadmin', 'staff'):
            return Response({'error': 'Forbidden'}, status=403)

        # Scope clients to what this agency/staff user owns
        if role == 'staff':
            client_qs = profile.assigned_clients.filter(is_active=True)
        else:
            # superadmin — only their own clients (admin-created or agency-invited)
            client_qs = Client.objects.filter(is_active=True).filter(
                Q(userprofile__isnull=True) |
                Q(userprofile__is_self_registered=False) |
                Q(userprofile__agency=request.user)
            ).distinct()

        client_ids = list(client_qs.values_list('id', flat=True))

        since, until = parse_dates(request)
        qs = DailyMetric.objects.filter(date__range=(since, until), client_id__in=client_ids)

        by_platform = list(qs.values('platform').annotate(
            impressions=Sum('impressions'),
            reach=Sum('reach'),
            clicks=Sum('clicks'),
            video_views=Sum('video_views'),
            followers=Sum('followers'),
        ))

        total_clients = len(client_ids)
        recent_syncs  = SyncLog.objects.filter(client_id__in=client_ids).order_by('-started_at')[:10]

        return Response({
            'period':        {'since': since.isoformat(), 'until': until.isoformat()},
            'total_clients': total_clients,
            'by_platform':   by_platform,
            'recent_syncs':  SyncLogSerializer(recent_syncs, many=True).data,
        })


@api_view(['POST'])
def sync_all_clients(request):
    """Queue sync for this agency's active clients. Superadmin / staff only."""
    from django.db.models import Q
    try:
        profile = request.user.profile
        role    = profile.role
    except Exception:
        return Response({'error': 'Forbidden'}, status=403)
    if role not in ('superadmin', 'staff'):
        return Response({'error': 'Forbidden'}, status=403)

    # Scope to this agency's clients only
    if role == 'staff':
        client_ids = list(profile.assigned_clients.filter(is_active=True).values_list('id', flat=True))
    else:
        client_ids = list(
            Client.objects.filter(is_active=True).filter(
                Q(userprofile__isnull=True) |
                Q(userprofile__is_self_registered=False) |
                Q(userprofile__agency=request.user)
            ).distinct().values_list('id', flat=True)
        )

    from .tasks import sync_facebook, sync_instagram, sync_youtube, sync_linkedin, sync_gmb
    task_map = {
        'facebook': sync_facebook,
        'instagram': sync_instagram,
        'youtube': sync_youtube,
        'linkedin': sync_linkedin,
        'google_my_business': sync_gmb,
    }

    active_creds = PlatformCredential.objects.filter(
        is_active=True, client_id__in=client_ids
    ).exclude(access_token='').values('client_id', 'platform').distinct()

    queued = {}
    for row in active_creds:
        cid = row['client_id']
        p   = row['platform']
        if p in task_map:
            task_map[p].delay(cid)
            queued.setdefault(cid, []).append(p)

    return Response({'queued_clients': len(queued), 'detail': queued})


class PublicSiteContentView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, key):
        item = SiteContent.objects.filter(key=key, is_public=True).first()
        if not item:
            return Response({'error': 'Content not found'}, status=404)
        return Response(SiteContentSerializer(item).data)


class PublicLookupView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        collections = LookupCollection.objects.filter(is_public=True).prefetch_related('items')
        data = {}
        for collection in collections:
            serialized = LookupCollectionSerializer(collection).data
            data[collection.key] = serialized['items']
        return Response(data)


# ── GMB Business Info ─────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gmb_info(request, client_id):
    profile = request.user.profile
    # Only allow access to own client or staff/admin
    if profile.role == 'client' and profile.client_id != client_id:
        return Response({'error': 'Forbidden'}, status=403)
    try:
        info = GMBBusinessInfo.objects.get(client_id=client_id)
        return Response(GMBBusinessInfoSerializer(info).data)
    except GMBBusinessInfo.DoesNotExist:
        return Response({}, status=200)


# ── GMB Reviews ───────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def gmb_reviews(request, client_id):
    profile = request.user.profile
    if profile.role == 'client' and profile.client_id != client_id:
        return Response({'error': 'Forbidden'}, status=403)
    qs = GMBReview.objects.filter(client_id=client_id).order_by('-published_at')
    # Optional pagination via ?page=1&page_size=20
    try:
        page_size = int(request.query_params.get('page_size', 20))
        page      = int(request.query_params.get('page', 1))
    except ValueError:
        page_size, page = 20, 1
    total  = qs.count()
    offset = (page - 1) * page_size
    items  = qs[offset:offset + page_size]
    return Response({
        'count':   total,
        'page':    page,
        'results': GMBReviewSerializer(items, many=True).data,
    })


# ── Solo Client Setup ──────────────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def setup_solo_client(request):
    """
    Create a Client record for a self-registered user who has no client yet.
    Returns new JWT tokens with updated client_id claim.
    """
    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role != 'client':
        return Response({'error': 'Only client users can use this endpoint.'}, status=403)
    if profile.client_id:
        return Response({'error': 'You already have a client account.'}, status=400)

    user  = request.user
    email = user.email.strip().lower()

    # Find or create a Client record
    client = Client.objects.filter(email__iexact=email).first()
    if not client:
        full_name  = user.get_full_name() or user.username or email.split('@')[0]
        first_name = (user.first_name or '').strip()
        company    = first_name or full_name or email.split('@')[0]
        client = Client.objects.create(
            name=full_name, company=company, email=email,
        )

    profile.client = client
    profile.save(update_fields=['client'])

    # Create onboarding steps
    STEP_KEYS = [
        'connect_platform', 'sync_data', 'set_goals',
        'add_competitor', 'view_analytics', 'share_report',
    ]
    for step_key in STEP_KEYS:
        OnboardingStep.objects.get_or_create(client=client, step_key=step_key)

    from .social_auth_views import _make_jwt
    access, refresh = _make_jwt(user)
    return Response({
        'access':    access,
        'refresh':   refresh,
        'client_id': client.id,
    })
