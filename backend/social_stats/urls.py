from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView, me, ClientViewSet, CredentialViewSet,
    SyncLogViewSet, GoalViewSet, AlertViewSet, AIInsightViewSet, WeeklyTopPostViewSet,
    SharedReportViewSet, public_report, public_report_verify,
    OnboardingViewSet,
    OverviewView, create_client_user,
)
from .roi_views import ROISettingsView, ROICalculateView, ROIReportView, ROILiveView
from .calendar_views import (
    CalendarPostViewSet, CalendarNoteViewSet,
    PostingScheduleViewSet, SuggestTimesView,
)
from .oauth_views import (
    facebook_oauth_start, facebook_oauth_callback,
    google_oauth_start, google_oauth_callback,
    linkedin_oauth_start, linkedin_oauth_callback,
    oauth_status, oauth_disconnect,
)
from .social_auth_views import (
    google_social_start, google_social_callback,
    microsoft_social_start, microsoft_social_callback,
)
from .management_views import (
    StaffListView, StaffDetailView, StaffPermissionsView, StaffClientsView,
    ClientManagementListView, ClientManagementDetailView,
    ClientPermissionsView, ClientPortalConfigView,
    PermissionListView, RoleDefaultsView,
)
from .caption_views import caption_view
from .post_ideas_views import post_ideas_view, approve_all, update_idea, add_to_calendar
from .hashtag_views import hashtag_view, save_set, get_saved_sets

router = DefaultRouter()
router.register(r'clients',     ClientViewSet,    basename='client')
router.register(r'credentials', CredentialViewSet,basename='credential')
router.register(r'synclogs',    SyncLogViewSet,   basename='synclog')
router.register(r'goals',       GoalViewSet,      basename='goal')
router.register(r'alerts',      AlertViewSet,     basename='alert')
router.register(r'insights',    AIInsightViewSet,      basename='insight')
router.register(r'top-posts',      WeeklyTopPostViewSet,  basename='top-post')
router.register(r'shared-reports', SharedReportViewSet,   basename='shared-report')
router.register(r'onboarding',     OnboardingViewSet,     basename='onboarding')
router.register(r'calendar/posts',    CalendarPostViewSet,    basename='calendar-post')
router.register(r'calendar/notes',    CalendarNoteViewSet,    basename='calendar-note')
router.register(r'calendar/schedule', PostingScheduleViewSet, basename='calendar-schedule')

urlpatterns = [
    # Auth
    path('auth/login/',   LoginView.as_view(),    name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/',      me,                     name='me'),

    # Social login (Google + Microsoft — client-only)
    path('auth/social/google/start/',            google_social_start,       name='google_social_start'),
    path('auth/social/google/callback/',         google_social_callback,    name='google_social_callback'),
    path('auth/social/microsoft/start/',         microsoft_social_start,    name='microsoft_social_start'),
    path('auth/social/microsoft/callback/',      microsoft_social_callback, name='microsoft_social_callback'),

    # Admin actions
    path('admin/create-client/', create_client_user, name='create_client'),
    path('overview/',            OverviewView.as_view(), name='overview'),

    # OAuth — Facebook + Instagram
    path('oauth/facebook/start/<int:client_id>/',  facebook_oauth_start,    name='fb_start'),
    path('oauth/facebook/callback/',               facebook_oauth_callback, name='fb_callback'),

    # OAuth — Google (YouTube + GMB)
    path('oauth/google/start/<int:client_id>/',    google_oauth_start,    name='google_start'),
    path('oauth/google/callback/',                 google_oauth_callback, name='google_callback'),

    # OAuth — LinkedIn
    path('oauth/linkedin/start/<int:client_id>/',  linkedin_oauth_start,    name='li_start'),
    path('oauth/linkedin/callback/',               linkedin_oauth_callback, name='li_callback'),

    # OAuth status + disconnect
    path('oauth/status/<int:client_id>/',                       oauth_status,     name='oauth_status'),
    path('oauth/disconnect/<int:client_id>/<str:platform>/',    oauth_disconnect, name='oauth_disconnect'),

    # ROI Calculator
    path('roi/settings/<int:client_id>/', ROISettingsView.as_view(),  name='roi_settings'),
    path('roi/calculate/',                ROICalculateView.as_view(), name='roi_calculate'),
    path('roi/reports/',                  ROIReportView.as_view(),    name='roi_reports'),
    path('roi/live/',                     ROILiveView.as_view(),      name='roi_live'),

    # Public report (no auth)
    path('public/report/<uuid:token>/',        public_report,        name='public_report'),
    path('public/report/<uuid:token>/verify/', public_report_verify, name='public_report_verify'),

    # Calendar
    path('calendar/suggest-times/', SuggestTimesView.as_view(), name='calendar_suggest_times'),

    # Access Management (superadmin only)
    path('management/staff/',                              StaffListView.as_view(),               name='mgmt_staff_list'),
    path('management/staff/<int:pk>/',                     StaffDetailView.as_view(),             name='mgmt_staff_detail'),
    path('management/staff/<int:pk>/permissions/',         StaffPermissionsView.as_view(),        name='mgmt_staff_perms'),
    path('management/staff/<int:pk>/clients/',             StaffClientsView.as_view(),            name='mgmt_staff_clients'),
    path('management/clients/',                            ClientManagementListView.as_view(),    name='mgmt_client_list'),
    path('management/clients/<int:pk>/',                   ClientManagementDetailView.as_view(),  name='mgmt_client_detail'),
    path('management/clients/<int:pk>/permissions/',       ClientPermissionsView.as_view(),       name='mgmt_client_perms'),
    path('management/clients/<int:pk>/portal-config/',     ClientPortalConfigView.as_view(),      name='mgmt_portal_config'),
    path('management/permissions/',                        PermissionListView.as_view(),          name='mgmt_permissions'),
    path('management/role-defaults/<str:role>/',           RoleDefaultsView.as_view(),            name='mgmt_role_defaults'),

    # AI Caption Writer
    path('ai/caption/', caption_view, name='ai_caption'),

    # AI Post Ideas Generator
    path('ai/post-ideas/',                                   post_ideas_view, name='ai_post_ideas'),
    path('ai/post-ideas/<int:pk>/approve-all/',              approve_all,     name='ai_post_ideas_approve_all'),
    path('ai/post-ideas/<int:pk>/add-to-calendar/',          add_to_calendar, name='ai_post_ideas_add_to_calendar'),
    path('ai/post-ideas/<int:pk>/ideas/<int:idea_pk>/',      update_idea,     name='ai_post_ideas_update_idea'),

    # AI Hashtag Research Tool
    path('ai/hashtags/',                          hashtag_view,   name='ai_hashtags'),
    path('ai/hashtags/<int:pk>/save-set/',         save_set,       name='ai_hashtags_save_set'),
    path('ai/hashtags/saved-sets/',                get_saved_sets, name='ai_hashtags_saved_sets'),

    # REST API
    path('', include(router.urls)),
]
