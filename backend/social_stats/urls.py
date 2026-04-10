from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView, me, ClientViewSet, CredentialViewSet,
    SyncLogViewSet, GoalViewSet, AlertViewSet, AIInsightViewSet, WeeklyTopPostViewSet,
    SharedReportViewSet, public_report, public_report_verify,
    OnboardingViewSet,
    OverviewView, PublicSiteContentView, PublicLookupView, create_client_user,
    gmb_info, gmb_reviews, setup_solo_client, sync_all_clients,
)
from .roi_views import ROISettingsView, ROICalculateView, ROIReportView, ROILiveView
from .calendar_views import (
    CalendarPostViewSet, CalendarNoteViewSet,
    PostingScheduleViewSet, SuggestTimesView,
)
from .oauth_views import (
    facebook_oauth_start, facebook_oauth_callback, facebook_consumer_callback,
    google_oauth_start, google_oauth_callback,
    linkedin_oauth_start, linkedin_oauth_callback,
    oauth_status, oauth_disconnect, oauth_debug,
)
from .social_auth_views import (
    google_social_start, google_social_callback,
    microsoft_social_start, microsoft_social_callback,
    facebook_social_start, facebook_social_callback,
)
from .management_views import (
    StaffListView, StaffDetailView, StaffPermissionsView, StaffClientsView,
    ClientManagementListView, ClientManagementDetailView,
    ClientPermissionsView, ClientPortalConfigView,
    PermissionListView, RoleDefaultsView,
)
from .invitation_views import (
    send_invitation, get_invitation, respond_invitation,
    list_invitations, cancel_invitation,
    list_notifications, mark_read, mark_all_read,
)
from .auth_views import signup, verify_email, resend_verification, password_reset_request, password_reset_confirm
from .profile_views import user_profile, change_password, agency_info, disconnect_agency, delete_account
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
    path('auth/login/',                   LoginView.as_view(),           name='login'),
    path('auth/refresh/',                 TokenRefreshView.as_view(),    name='token_refresh'),
    path('auth/me/',                      me,                            name='me'),
    path('auth/signup/',                  signup,                        name='signup'),

    # User profile & account settings
    path('profile/',                      user_profile,                  name='user_profile'),
    path('profile/change-password/',      change_password,               name='change_password'),
    path('profile/agency/',               agency_info,                   name='agency_info'),
    path('profile/disconnect-agency/',    disconnect_agency,             name='disconnect_agency'),
    path('profile/delete-account/',       delete_account,                name='delete_account'),

    path('auth/verify-email/',            verify_email,                  name='verify_email'),
    path('auth/resend-verification/',     resend_verification,           name='resend_verification'),
    path('auth/password-reset/',          password_reset_request,        name='password_reset_request'),
    path('auth/password-reset/confirm/',  password_reset_confirm,        name='password_reset_confirm'),

    # Social login (Google + Facebook + Microsoft — client-only)
    path('auth/social/google/start/',            google_social_start,       name='google_social_start'),
    path('auth/social/google/callback/',         google_social_callback,    name='google_social_callback'),
    path('auth/social/facebook/start/',          facebook_social_start,     name='facebook_social_start'),
    path('auth/social/facebook/callback/',       facebook_social_callback,  name='facebook_social_callback'),
    path('auth/social/microsoft/start/',         microsoft_social_start,    name='microsoft_social_start'),
    path('auth/social/microsoft/callback/',      microsoft_social_callback, name='microsoft_social_callback'),

    # Invitations
    path('invitations/send/',                        send_invitation,    name='invitation_send'),
    path('invitations/mine/',                        list_invitations,   name='invitation_mine'),
    path('invitations/token/<uuid:token>/',          get_invitation,     name='invitation_get'),
    path('invitations/token/<uuid:token>/respond/',  respond_invitation, name='invitation_respond'),
    path('invitations/<int:pk>/cancel/',             cancel_invitation,  name='invitation_cancel'),

    # Notifications
    path('notifications/',              list_notifications, name='notif_list'),
    path('notifications/<int:pk>/read/', mark_read,          name='notif_read'),
    path('notifications/read-all/',     mark_all_read,      name='notif_read_all'),

    # Solo client setup
    path('client/setup-solo/', setup_solo_client, name='setup_solo_client'),

    # Admin actions
    path('admin/create-client/', create_client_user,  name='create_client'),
    path('admin/sync-all/',      sync_all_clients,     name='sync_all_clients'),
    path('overview/',            OverviewView.as_view(), name='overview'),

    # OAuth — Facebook + Instagram
    path('oauth/facebook/start/<int:client_id>/',      facebook_oauth_start,       name='fb_start'),
    path('oauth/facebook/consumer/callback/',          facebook_consumer_callback, name='fb_consumer_callback'),
    path('oauth/facebook/callback/',                   facebook_oauth_callback,    name='fb_callback'),

    # OAuth — Google (YouTube + GMB)
    path('oauth/google/start/<int:client_id>/',    google_oauth_start,    name='google_start'),
    path('oauth/google/callback/',                 google_oauth_callback, name='google_callback'),

    # OAuth — LinkedIn
    path('oauth/linkedin/start/<int:client_id>/',  linkedin_oauth_start,    name='li_start'),
    path('oauth/linkedin/callback/',               linkedin_oauth_callback, name='li_callback'),

    # OAuth status + disconnect + debug
    path('oauth/status/<int:client_id>/',                       oauth_status,     name='oauth_status'),
    path('oauth/disconnect/<int:client_id>/<str:platform>/',    oauth_disconnect, name='oauth_disconnect'),
    path('oauth/debug/',                                         oauth_debug,      name='oauth_debug'),

    # ROI Calculator
    path('roi/settings/<int:client_id>/', ROISettingsView.as_view(),  name='roi_settings'),
    path('roi/calculate/',                ROICalculateView.as_view(), name='roi_calculate'),
    path('roi/reports/',                  ROIReportView.as_view(),    name='roi_reports'),
    path('roi/live/',                     ROILiveView.as_view(),      name='roi_live'),

    # Public report (no auth)
    path('public/report/<uuid:token>/',        public_report,        name='public_report'),
    path('public/report/<uuid:token>/verify/', public_report_verify, name='public_report_verify'),
    path('public/content/<slug:key>/',         PublicSiteContentView.as_view(), name='public_site_content'),
    path('public/lookups/',                    PublicLookupView.as_view(),      name='public_lookups'),

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

    # GMB Business Info & Reviews
    path('gmb/info/<int:client_id>/',             gmb_info,    name='gmb_info'),
    path('gmb/reviews/<int:client_id>/',          gmb_reviews, name='gmb_reviews'),

    # REST API
    path('', include(router.urls)),
]
