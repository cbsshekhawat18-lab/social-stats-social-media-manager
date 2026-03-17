"""
DRF views for the Content Calendar feature.
"""
from collections import defaultdict
from datetime import date, timedelta, datetime
import calendar as cal_module

from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CalendarPost, CalendarNote, PostingSchedule, Client
from .calendar_serializers import (
    CalendarPostSerializer, CalendarNoteSerializer, PostingScheduleSerializer
)

DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

INDUSTRY_BEST_TIMES = {
    'facebook': [
        {'day_of_week': 2, 'hour': 13, 'minute': 0, 'note': 'Wed 1pm'},
        {'day_of_week': 2, 'hour': 15, 'minute': 0, 'note': 'Wed 3pm'},
        {'day_of_week': 3, 'hour': 13, 'minute': 0, 'note': 'Thu 1pm'},
        {'day_of_week': 3, 'hour': 15, 'minute': 0, 'note': 'Thu 3pm'},
        {'day_of_week': 4, 'hour': 13, 'minute': 0, 'note': 'Fri 1pm'},
    ],
    'instagram': [
        {'day_of_week': 0, 'hour': 11, 'minute': 0, 'note': 'Mon 11am'},
        {'day_of_week': 2, 'hour': 11, 'minute': 0, 'note': 'Wed 11am'},
        {'day_of_week': 2, 'hour': 14, 'minute': 0, 'note': 'Wed 2pm'},
        {'day_of_week': 4, 'hour': 11, 'minute': 0, 'note': 'Fri 11am'},
        {'day_of_week': 4, 'hour': 19, 'minute': 0, 'note': 'Fri 7pm'},
    ],
    'youtube': [
        {'day_of_week': 3, 'hour': 12, 'minute': 0, 'note': 'Thu 12pm'},
        {'day_of_week': 3, 'hour': 16, 'minute': 0, 'note': 'Thu 4pm'},
        {'day_of_week': 4, 'hour': 12, 'minute': 0, 'note': 'Fri 12pm'},
        {'day_of_week': 5, 'hour': 12, 'minute': 0, 'note': 'Sat 12pm'},
        {'day_of_week': 5, 'hour': 16, 'minute': 0, 'note': 'Sat 4pm'},
    ],
    'linkedin': [
        {'day_of_week': 1, 'hour': 8,  'minute': 0, 'note': 'Tue 8am'},
        {'day_of_week': 1, 'hour': 12, 'minute': 0, 'note': 'Tue 12pm'},
        {'day_of_week': 2, 'hour': 9,  'minute': 0, 'note': 'Wed 9am'},
        {'day_of_week': 3, 'hour': 10, 'minute': 0, 'note': 'Thu 10am'},
        {'day_of_week': 3, 'hour': 12, 'minute': 0, 'note': 'Thu 12pm'},
    ],
    'google_my_business': [
        {'day_of_week': 0, 'hour': 9,  'minute': 0, 'note': 'Mon 9am'},
        {'day_of_week': 2, 'hour': 9,  'minute': 0, 'note': 'Wed 9am'},
        {'day_of_week': 4, 'hour': 9,  'minute': 0, 'note': 'Fri 9am'},
    ],
}


def _check_client_access(request, client_id):
    """Returns (client, error_response)."""
    try:
        client = Client.objects.get(id=client_id)
    except Client.DoesNotExist:
        return None, Response({'error': 'Client not found.'}, status=404)

    profile = getattr(request.user, 'profile', None)
    if not profile:
        return None, Response({'error': 'No profile.'}, status=403)
    if not profile.can_access_client(client_id):
        return None, Response({'error': 'Access denied.'}, status=403)
    return client, None


class CalendarPostViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = CalendarPostSerializer

    def get_queryset(self):
        qs = CalendarPost.objects.select_related('client', 'post_metric', 'created_by')
        profile = getattr(self.request.user, 'profile', None)
        if not profile:
            return qs.none()
        if profile.role == 'client':
            qs = qs.filter(client=profile.client)
        elif profile.role == 'staff':
            qs = qs.filter(client__in=profile.assigned_clients.all())
        return qs

    def list(self, request, *args, **kwargs):
        client_id = request.query_params.get('client_id')
        month     = request.query_params.get('month')
        year      = request.query_params.get('year')
        platform  = request.query_params.get('platform')
        status_f  = request.query_params.get('status')

        if not client_id:
            return Response({'error': 'client_id is required.'}, status=400)

        client, err = _check_client_access(request, client_id)
        if err:
            return err

        qs = self.get_queryset().filter(client_id=client_id)

        if month and year:
            try:
                m, y = int(month), int(year)
                start = date(y, m, 1)
                last  = cal_module.monthrange(y, m)[1]
                end   = date(y, m, last)
                qs = qs.filter(
                    scheduled_at__date__range=[start, end]
                ) | qs.filter(
                    published_at__date__range=[start, end]
                )
            except (ValueError, TypeError):
                return Response({'error': 'Invalid month/year.'}, status=400)

        if platform:
            qs = qs.filter(platform=platform)
        if status_f:
            qs = qs.filter(status=status_f)

        # Group by date string
        posts_by_date = defaultdict(list)
        serializer = self.get_serializer(qs.distinct(), many=True)
        for post in serializer.data:
            # Use scheduled_at or published_at for date key
            dt = post.get('scheduled_at') or post.get('published_at')
            if dt:
                date_key = dt[:10]  # 'YYYY-MM-DD'
            else:
                date_key = 'undated'
            posts_by_date[date_key].append(post)

        return Response(dict(posts_by_date))

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        if post.status == 'published':
            return Response(
                {'error': 'Published posts cannot be deleted.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='reschedule')
    def reschedule(self, request, pk=None):
        post = self.get_object()
        if post.status == 'published':
            return Response({'error': 'Cannot reschedule a published post.'}, status=400)

        new_time_str = request.data.get('scheduled_at')
        if not new_time_str:
            return Response({'error': 'scheduled_at is required.'}, status=400)

        try:
            from django.utils.dateparse import parse_datetime
            new_time = parse_datetime(new_time_str)
            if new_time is None:
                raise ValueError('bad format')
        except (ValueError, TypeError):
            return Response({'error': 'Invalid datetime format. Use ISO 8601.'}, status=400)

        if timezone.is_naive(new_time):
            new_time = timezone.make_aware(new_time)

        if new_time <= timezone.now():
            return Response({'error': 'New scheduled time must be in the future.'}, status=400)

        post.scheduled_at = new_time
        post.status       = 'scheduled'
        post.save(update_fields=['scheduled_at', 'status', 'updated_at'])
        return Response(self.get_serializer(post).data)

    @action(detail=False, methods=['get'], url_path='upcoming')
    def upcoming(self, request):
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response([])

        now   = timezone.now()
        until = now + timedelta(days=7)
        qs    = CalendarPost.objects.filter(
            status='scheduled',
            scheduled_at__gte=now,
            scheduled_at__lte=until,
        ).select_related('client')

        if profile.role == 'client':
            qs = qs.filter(client=profile.client)
        elif profile.role == 'staff':
            qs = qs.filter(client__in=profile.assigned_clients.all())

        client_id = request.query_params.get('client_id')
        if client_id:
            qs = qs.filter(client_id=client_id)

        return Response(self.get_serializer(qs.order_by('scheduled_at'), many=True).data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        client_id = request.query_params.get('client_id')
        month     = request.query_params.get('month')
        year      = request.query_params.get('year')

        if not client_id:
            return Response({'error': 'client_id is required.'}, status=400)

        client, err = _check_client_access(request, client_id)
        if err:
            return err

        try:
            m, y = int(month or date.today().month), int(year or date.today().year)
            start = date(y, m, 1)
            last  = cal_module.monthrange(y, m)[1]
            end   = date(y, m, last)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid month/year.'}, status=400)

        qs = CalendarPost.objects.filter(
            client_id=client_id,
            status='published',
        ).filter(
            published_at__date__range=[start, end]
        )

        total_published = qs.count()

        # By platform
        by_platform = defaultdict(int)
        for p in qs.values_list('platform', flat=True):
            by_platform[p] += 1

        # By day of week
        by_dow = defaultdict(int)
        for post in qs:
            dt = post.published_at
            if dt:
                by_dow[DAY_NAMES[dt.weekday()]] += 1

        # By post type
        by_type = defaultdict(int)
        for t in qs.values_list('post_type', flat=True):
            by_type[t] += 1

        # Avg per week
        avg_per_week = round(total_published / 4.33, 1) if total_published else 0

        # Best performing post (by performance_score = likes*2+comments*3+shares*4+saves*3+impressions*.1)
        best_post_obj = None
        best_score    = -1
        for post in qs:
            score = post.likes * 2 + post.comments * 3 + post.shares * 4 + post.saves * 3 + int(post.impressions * 0.1)
            if score > best_score:
                best_score    = score
                best_post_obj = post

        best_post = None
        if best_post_obj:
            best_post = CalendarPostSerializer(best_post_obj).data

        # Posting gaps (days in range with no published posts)
        published_dates = set()
        for post in qs:
            if post.published_at:
                published_dates.add(post.published_at.date().isoformat())

        all_days   = [start + timedelta(days=i) for i in range(last)]
        today_date = date.today()
        gaps       = [d.isoformat() for d in all_days if d.isoformat() not in published_dates and d <= today_date]

        return Response({
            'total_published':     total_published,
            'by_platform':         dict(by_platform),
            'by_day_of_week':      dict(by_dow),
            'by_post_type':        dict(by_type),
            'avg_per_week':        avg_per_week,
            'best_performing_post': best_post,
            'posting_gaps':        gaps,
        })


class CalendarNoteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = CalendarNoteSerializer

    def get_queryset(self):
        qs = CalendarNote.objects.select_related('client', 'created_by')
        profile = getattr(self.request.user, 'profile', None)
        if not profile:
            return qs.none()
        if profile.role == 'client':
            qs = qs.filter(client=profile.client, is_client_visible=True)
        elif profile.role == 'staff':
            qs = qs.filter(client__in=profile.assigned_clients.all())
        return qs

    def list(self, request, *args, **kwargs):
        client_id = request.query_params.get('client_id')
        month     = request.query_params.get('month')
        year      = request.query_params.get('year')

        if not client_id:
            return Response({'error': 'client_id is required.'}, status=400)

        client, err = _check_client_access(request, client_id)
        if err:
            return err

        qs = self.get_queryset().filter(client_id=client_id)

        if month and year:
            try:
                m, y = int(month), int(year)
                import calendar as cm
                start = date(y, m, 1)
                last  = cm.monthrange(y, m)[1]
                end   = date(y, m, last)
                qs    = qs.filter(date__range=[start, end])
            except (ValueError, TypeError):
                pass

        return Response(self.get_serializer(qs, many=True).data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def update(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        if profile and profile.role == 'client':
            return Response({'error': 'Clients cannot edit notes.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        if profile and profile.role == 'client':
            return Response({'error': 'Clients cannot delete notes.'}, status=403)
        return super().destroy(request, *args, **kwargs)


class PostingScheduleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = PostingScheduleSerializer

    def get_queryset(self):
        qs        = PostingSchedule.objects.select_related('client')
        profile   = getattr(self.request.user, 'profile', None)
        client_id = self.request.query_params.get('client_id')

        if not profile or profile.role == 'client':
            return qs.none()

        if client_id:
            qs = qs.filter(client_id=client_id)
        elif profile.role == 'staff':
            qs = qs.filter(client__in=profile.assigned_clients.all())

        return qs

    def list(self, request, *args, **kwargs):
        profile = getattr(request.user, 'profile', None)
        if not profile or profile.role == 'client':
            return Response({'error': 'Access denied.'}, status=403)
        return super().list(request, *args, **kwargs)


class SuggestTimesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        client_id = request.query_params.get('client_id')
        platform  = request.query_params.get('platform')

        if not client_id or not platform:
            return Response({'error': 'client_id and platform are required.'}, status=400)

        _, err = _check_client_access(request, client_id)
        if err:
            return err

        # Use configured PostingSchedule if available
        configured = PostingSchedule.objects.filter(
            client_id=client_id,
            platform=platform,
            is_active=True,
        ).order_by('day_of_week', 'hour')

        if configured.exists():
            return Response({
                'source':      'configured',
                'suggestions': PostingScheduleSerializer(configured, many=True).data,
            })

        # Fall back to industry defaults
        defaults = INDUSTRY_BEST_TIMES.get(platform, [])
        return Response({
            'source':      'industry',
            'suggestions': defaults,
        })
