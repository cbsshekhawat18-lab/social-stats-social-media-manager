# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
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
from .security.views import (
    list_sessions      as security_list_sessions,
    revoke_one         as security_revoke_session,
    revoke_all_others  as security_revoke_all_sessions,
    mfa_status, mfa_setup, mfa_verify_setup, mfa_login,
    mfa_disable, mfa_regenerate_backup_codes,
    api_keys_collection, api_key_revoke,
)
from .security.privacy_views import (
    data_export_collection, data_export_download,
    delete_account_request, delete_account_cancel,
    processing_status, consents_collection,
)
from .security.platform_compliance_views import (
    meta_data_deletion_callback, meta_deauth_callback,
    google_data_deletion_callback, platform_deletion_status,
)
from .end_user_views import (
    end_user_signup, end_user_me, end_user_update_profile, end_user_workspace,
)
from .manage_request_views import (
    send_manage_request, list_sent_requests, cancel_manage_request,
    get_manage_invite, accept_manage_invite, decline_manage_invite,
    list_incoming_requests,
)
from .relation_views import (
    list_relations, get_relation, update_relation_permissions,
    pause_relation, resume_relation, terminate_relation, flag_relation,
    relation_agency_profile,
)
from .activity_views import (
    list_activity, flag_activity, revert_activity, export_activity_csv,
)
from .approval_views import (
    list_pending, list_history, get_approval, approve_approval, reject_approval,
)
from .agency_invite_views import (
    send_agency_invite, list_sent_agency_invites,
    get_agency_invite, accept_agency_invite, decline_agency_invite,
    agency_incoming_invites,
)
from .marketplace_views import (
    list_marketplace_agencies, get_marketplace_agency, list_featured,
    list_categories, contact_agency, agency_profile,
)
from .review_views import (
    list_reviews, review_detail,
    respond_to_review, mark_review_helpful,
)
from .verification_views import (
    submit_verification, list_pending_verifications, get_verification,
    approve_verification, reject_verification,
)
from .dispute_views import (
    file_dispute, list_disputes, get_dispute, resolve_dispute,
)
from .profile_views import user_profile, change_password, agency_info, disconnect_agency, delete_account
from .caption_views import caption_view
from .post_ideas_views import post_ideas_view, approve_all, update_idea, add_to_calendar
from .hashtag_views import hashtag_view, save_set, get_saved_sets
from .ai_views import (
    compose_post, suggest_hashtags, best_time_to_post, suggest_reply,
    rewrite, translate, generate_image_caption, content_calendar,
    train_brand_voice, get_brand_voice,
)
from .ai.content_views import (
    compose          as ai_v2_compose,
    rewrite_v2       as ai_v2_rewrite,
    extend           as ai_v2_extend,
    summarize        as ai_v2_summarize,
    hashtag_research as ai_v2_hashtag_research,
    optimal_time     as ai_v2_optimal_time,
    title_generator  as ai_v2_title_generator,
    post_improve     as ai_v2_post_improve,
)
from .ai.image_views import (
    describe_image          as ai_v2_describe_image,
    image_to_post           as ai_v2_image_to_post,
    alt_text                as ai_v2_alt_text,
    brand_compliance_check  as ai_v2_brand_compliance,
)
from .ai.video_ai_views import (
    video_script    as ai_v2_video_script,
    video_captions  as ai_v2_video_captions,
    video_chapters  as ai_v2_video_chapters,
    video_summary   as ai_v2_video_summary,
)
from .ai.engagement_views import (
    reply_suggest      as ai_v2_reply_suggest,
    auto_reply         as ai_v2_auto_reply,
    sentiment_analyze  as ai_v2_sentiment_analyze,
    intent_classify    as ai_v2_intent_classify,
    review_reply       as ai_v2_review_reply,
    crisis_detect      as ai_v2_crisis_detect,
    spam_filter_view   as ai_v2_spam_filter,
)
from .ai.brand_voice_views import (
    get_voice    as ai_v2_brand_voice_get,
    train_voice  as ai_v2_brand_voice_train,
    test_voice   as ai_v2_brand_voice_test,
)
from .ai.chat_views import (
    chat                as ai_v2_chat,
    list_conversations  as ai_v2_chat_list,
    conversation_detail as ai_v2_chat_detail,
)
from .ai.insights_views import (
    insight_generate     as ai_v2_insight_generate,
    list_insights        as ai_v2_insights_list,
    update_insight       as ai_v2_insight_update,
    anomaly_detect       as ai_v2_anomaly_detect,
    trend_analysis       as ai_v2_trend_analysis,
    forecast             as ai_v2_forecast,
    competitor_insight   as ai_v2_competitor_insight,
    audience_profile     as ai_v2_audience_profile,
    today_briefing       as ai_v2_today_briefing,
)
from .ai.report_views import (
    report_write   as ai_v2_report_write,
    report_narrate as ai_v2_report_narrate,
)
from .ai.usage_views import (
    usage_overview   as ai_v2_usage_overview,
    usage_by_client  as ai_v2_usage_by_client,
    usage_by_user    as ai_v2_usage_by_user,
    usage_budget     as ai_v2_usage_budget,
    usage_quota      as ai_v2_usage_quota,
    usage_audit      as ai_v2_usage_audit,
)
from .automation_views import AutomationRuleViewSet
from .video_views import (
    upload_video, trim_video, resize_video, extract_thumbnail,
    add_captions, youtube_upload,
)
from .webhooks_views import meta_webhook, youtube_webhook
from .competitor_views import CompetitorViewSet, BenchmarkView
from .audience_views import UnifiedAudienceView
from .audit import ActionLogViewSet
from .notification_views import notification_preferences, approval_queue
from .whatsapp_views import (
    WhatsAppAccountViewSet, WhatsAppContactViewSet, WhatsAppContactListViewSet,
    WhatsAppTemplateViewSet, WhatsAppCampaignViewSet, WhatsAppMessageViewSet,
    WhatsAppDashboardView, WhatsAppInboxView, WhatsAppInboxThreadView, WhatsAppSendDirectView,
)
from .whatsapp_webhook_views import pinbot_webhook
from .bot_views import (
    BotFlowViewSet, BotTemplateViewSet, BotConversationViewSet, CTWACampaignViewSet,
    bot_settings,
)
from .bot_ai_views import (
    generate_flow_with_ai as bot_generate_flow_with_ai,
    suggest_reply        as bot_suggest_reply,
    build_persona        as bot_build_persona,
)
from .lead_views import LeadViewSet
from .meta_ads_views import (
    list_ad_accounts, list_ad_campaigns, list_ads, meta_ads_health,
)
from .ads_views import notify_ads
from .composer_views import (
    UnifiedPostViewSet, MediaAssetViewSet, PostQueueViewSet, PreflightCheckView,
)
from .inbox_views import (
    ConversationViewSet, MessageViewSet, UnifiedReviewViewSet, InboxStatsView,
)
from .manual_token_views import (
    connect_facebook_manual, connect_instagram_manual,
    connect_youtube_manual, connect_linkedin_manual, connect_gmb_manual,
    test_credential, get_setup_instructions,
)
from .health_views import services_health
from .dashboard_views import dashboard_counts, unified_search, dashboard_today

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

router.register(r'composer/posts',  UnifiedPostViewSet, basename='composer-post')
router.register(r'composer/media',  MediaAssetViewSet,  basename='composer-media')
router.register(r'composer/queues', PostQueueViewSet,   basename='composer-queue')

router.register(r'inbox/conversations', ConversationViewSet,   basename='inbox-conversation')
router.register(r'inbox/messages',      MessageViewSet,        basename='inbox-message')
router.register(r'inbox/reviews',       UnifiedReviewViewSet,  basename='inbox-review')

router.register(r'automations',         AutomationRuleViewSet, basename='automation-rule')

router.register(r'competitors',         CompetitorViewSet,     basename='competitor')
router.register(r'audit/log',           ActionLogViewSet,      basename='audit-log')

router.register(r'whatsapp/accounts',  WhatsAppAccountViewSet,     basename='wa-account')
router.register(r'whatsapp/contacts',  WhatsAppContactViewSet,     basename='wa-contact')
router.register(r'whatsapp/lists',     WhatsAppContactListViewSet, basename='wa-list')
router.register(r'whatsapp/templates', WhatsAppTemplateViewSet,    basename='wa-template')
router.register(r'whatsapp/campaigns', WhatsAppCampaignViewSet,    basename='wa-campaign')
router.register(r'whatsapp/messages',  WhatsAppMessageViewSet,     basename='wa-message')

# CTWA Bot Builder
router.register(r'bot-flows',         BotFlowViewSet,         basename='bot-flow')
router.register(r'bot-templates',     BotTemplateViewSet,     basename='bot-template')
router.register(r'bot-conversations', BotConversationViewSet, basename='bot-conversation')
router.register(r'ctwa-campaigns',    CTWACampaignViewSet,    basename='ctwa-campaign')
router.register(r'leads',             LeadViewSet,            basename='lead')

urlpatterns = [
    # Auth
    path('auth/login/',                   LoginView.as_view(),           name='login'),
    path('auth/refresh/',                 TokenRefreshView.as_view(),    name='token_refresh'),
    path('auth/me/',                      me,                            name='me'),
    path('auth/signup/',                  signup,                        name='signup'),

    # End-user (B2C)
    path('end-user/signup/',     end_user_signup,         name='end_user_signup'),
    path('end-user/me/',         end_user_me,             name='end_user_me'),
    path('end-user/profile/',    end_user_update_profile, name='end_user_update_profile'),
    path('end-user/workspace/',  end_user_workspace,      name='end_user_workspace'),
    path('end-user/incoming-requests/', list_incoming_requests, name='end_user_incoming_requests'),

    # Manage requests ()
    path('manage-request/send/',                  send_manage_request,    name='manage_request_send'),
    path('manage-request/sent/',                  list_sent_requests,     name='manage_request_sent'),
    path('manage-request/<int:request_id>/',      cancel_manage_request,  name='manage_request_cancel'),
    path('manage-invite/<uuid:token>/',           get_manage_invite,      name='manage_invite_get'),
    path('manage-invite/<uuid:token>/accept/',    accept_manage_invite,   name='manage_invite_accept'),
    path('manage-invite/<uuid:token>/decline/',   decline_manage_invite,  name='manage_invite_decline'),

    # Relation management ()
    path('relations/',                                list_relations,             name='relation_list'),
    path('relations/<int:relation_id>/',              get_relation,               name='relation_get'),
    path('relations/<int:relation_id>/permissions/',  update_relation_permissions, name='relation_perms'),
    path('relations/<int:relation_id>/pause/',        pause_relation,             name='relation_pause'),
    path('relations/<int:relation_id>/resume/',       resume_relation,            name='relation_resume'),
    path('relations/<int:relation_id>/terminate/',    terminate_relation,         name='relation_terminate'),
    path('relations/<int:relation_id>/flag/',         flag_relation,              name='relation_flag'),
    path('relations/<int:relation_id>/agency-profile/', relation_agency_profile,  name='relation_agency_profile'),

    # Activity log ( + 12)
    path('activity/',                            list_activity,              name='activity_list'),
    path('activity/export.csv',                  export_activity_csv,        name='activity_export_csv'),
    path('activity/<int:activity_id>/flag/',     flag_activity,              name='activity_flag'),
    path('activity/<int:activity_id>/revert/',   revert_activity,            name='activity_revert'),

    # Approvals ()
    path('approvals/pending/',                   list_pending,           name='approvals_pending'),
    path('approvals/history/',                   list_history,           name='approvals_history'),
    path('approvals/<int:approval_id>/',         get_approval,           name='approvals_get'),
    path('approvals/<int:approval_id>/approve/', approve_approval,       name='approvals_approve'),
    path('approvals/<int:approval_id>/reject/',  reject_approval,        name='approvals_reject'),

    # Agency invites — user-side ()
    path('end-user/invite-agency/',         send_agency_invite,        name='end_user_invite_agency'),
    path('end-user/sent-agency-invites/',   list_sent_agency_invites,  name='end_user_sent_agency_invites'),
    path('agency-invite/<uuid:token>/',         get_agency_invite,     name='agency_invite_get'),
    path('agency-invite/<uuid:token>/accept/',  accept_agency_invite,  name='agency_invite_accept'),
    path('agency-invite/<uuid:token>/decline/', decline_agency_invite, name='agency_invite_decline'),
    path('agency/<slug:slug>/incoming-invites/', agency_incoming_invites, name='agency_incoming_invites'),

    # Marketplace ()
    path('marketplace/agencies/',                    list_marketplace_agencies, name='marketplace_list'),
    path('marketplace/agencies/<slug:slug>/',        get_marketplace_agency,    name='marketplace_get'),
    path('marketplace/featured/',                    list_featured,             name='marketplace_featured'),
    path('marketplace/categories/',                  list_categories,           name='marketplace_categories'),
    path('marketplace/agencies/<slug:slug>/contact/', contact_agency,           name='marketplace_contact'),
    path('agency/<slug:slug>/',                      agency_profile,            name='agency_profile'),

    # Reviews ()
    path('agencies/<slug:slug>/reviews/',     list_reviews,        name='reviews_list'),
    path('reviews/<int:review_id>/',          review_detail,       name='review_detail'),
    path('reviews/<int:review_id>/respond/',  respond_to_review,   name='review_respond'),
    path('reviews/<int:review_id>/helpful/',  mark_review_helpful, name='review_helpful'),

    # Notification preferences — see notification_views.notification_preferences
    # registered later in this file (handles GET + PUT).

    # Verification ()
    path('agency/<slug:slug>/verification/submit/',     submit_verification,         name='verif_submit'),
    path('admin/verifications/pending/',                list_pending_verifications,  name='verif_pending'),
    path('admin/verifications/<int:agency_id>/',        get_verification,            name='verif_get'),
    path('admin/verifications/<int:agency_id>/approve/', approve_verification,       name='verif_approve'),
    path('admin/verifications/<int:agency_id>/reject/',  reject_verification,        name='verif_reject'),

    # Disputes ()
    path('disputes/file/',                              file_dispute,                name='dispute_file'),
    path('admin/disputes/',                             list_disputes,               name='dispute_list'),
    path('admin/disputes/<int:dispute_id>/',            get_dispute,                 name='dispute_get'),
    path('admin/disputes/<int:dispute_id>/resolve/',    resolve_dispute,             name='dispute_resolve'),

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

    path('auth/sessions/',                          security_list_sessions,         name='auth_sessions_list'),
    path('auth/sessions/<int:session_id>/revoke/',  security_revoke_session,        name='auth_session_revoke'),
    path('auth/sessions/revoke-all/',               security_revoke_all_sessions,   name='auth_sessions_revoke_all'),

    path('auth/mfa/status/',                  mfa_status,                  name='auth_mfa_status'),
    path('auth/mfa/setup/',                   mfa_setup,                   name='auth_mfa_setup'),
    path('auth/mfa/verify-setup/',            mfa_verify_setup,            name='auth_mfa_verify_setup'),
    path('auth/mfa/login/',                   mfa_login,                   name='auth_mfa_login'),
    path('auth/mfa/disable/',                 mfa_disable,                 name='auth_mfa_disable'),
    path('auth/mfa/regenerate-backup-codes/', mfa_regenerate_backup_codes, name='auth_mfa_regenerate_backup_codes'),

    path('api-keys/',                  api_keys_collection,  name='api_keys_collection'),
    path('api-keys/<int:key_id>/revoke/', api_key_revoke,    name='api_key_revoke'),

    path('privacy/export-request/',         data_export_collection,  name='privacy_export'),
    path('privacy/download/<str:token>/',   data_export_download,    name='privacy_download'),
    path('privacy/delete-account/',         delete_account_request,  name='privacy_delete_account'),
    path('privacy/delete-account/cancel/',  delete_account_cancel,   name='privacy_delete_account_cancel'),
    path('privacy/processing-status/',      processing_status,       name='privacy_processing_status'),
    path('privacy/consents/',               consents_collection,     name='privacy_consents'),

    path('meta/data-deletion-callback/',    meta_data_deletion_callback,    name='meta_data_deletion'),
    path('meta/deauth-callback/',           meta_deauth_callback,           name='meta_deauth'),
    path('google/data-deletion/',           google_data_deletion_callback,  name='google_data_deletion'),
    path('privacy/platform-deletion/<str:code>/', platform_deletion_status, name='platform_deletion_status'),

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

    # Unified AI Assistant ()
    path('ai/compose-post/',           compose_post,            name='ai_compose_post'),
    path('ai/suggest-hashtags/',       suggest_hashtags,        name='ai_suggest_hashtags'),
    path('ai/best-time-to-post/',      best_time_to_post,       name='ai_best_time'),
    path('ai/suggest-reply/',          suggest_reply,           name='ai_suggest_reply'),
    path('ai/rewrite/',                rewrite,                 name='ai_rewrite'),
    path('ai/translate/',              translate,               name='ai_translate'),
    path('ai/generate-image-caption/', generate_image_caption,  name='ai_image_caption'),
    path('ai/content-calendar/',       content_calendar,        name='ai_content_calendar'),
    path('ai/train-brand-voice/',      train_brand_voice,       name='ai_train_brand_voice'),
    path('ai/brand-voice/',            get_brand_voice,         name='ai_brand_voice'),

    # ── AI v2 — content creation ( of comprehensive AI build) ─────────
    # New endpoints flow through the centralised AIClient (cache + rate-limit + cost).
    # Existing /ai/* endpoints above remain unchanged.
    path('ai/v2/compose/',          ai_v2_compose,           name='ai_v2_compose'),
    path('ai/v2/rewrite/',          ai_v2_rewrite,           name='ai_v2_rewrite'),
    path('ai/v2/extend/',           ai_v2_extend,            name='ai_v2_extend'),
    path('ai/v2/summarize/',        ai_v2_summarize,         name='ai_v2_summarize'),
    path('ai/v2/hashtag-research/', ai_v2_hashtag_research,  name='ai_v2_hashtag_research'),
    path('ai/v2/optimal-time/',     ai_v2_optimal_time,      name='ai_v2_optimal_time'),
    path('ai/v2/title-generator/',  ai_v2_title_generator,   name='ai_v2_title_generator'),
    path('ai/v2/post-improve/',     ai_v2_post_improve,      name='ai_v2_post_improve'),

    # ── AI v2 — image () ─────────────────────────────────────────────
    path('ai/v2/describe-image/',          ai_v2_describe_image,    name='ai_v2_describe_image'),
    path('ai/v2/image-to-post/',           ai_v2_image_to_post,     name='ai_v2_image_to_post'),
    path('ai/v2/alt-text/',                ai_v2_alt_text,          name='ai_v2_alt_text'),
    path('ai/v2/brand-compliance-check/',  ai_v2_brand_compliance,  name='ai_v2_brand_compliance'),

    # ── AI v2 — video () ─────────────────────────────────────────────
    path('ai/v2/video-script/',            ai_v2_video_script,      name='ai_v2_video_script'),
    path('ai/v2/video-captions/',          ai_v2_video_captions,    name='ai_v2_video_captions'),
    path('ai/v2/video-chapters/',          ai_v2_video_chapters,    name='ai_v2_video_chapters'),
    path('ai/v2/video-summary/',           ai_v2_video_summary,     name='ai_v2_video_summary'),

    # ── AI v2 — engagement () ────────────────────────────────────────
    path('ai/v2/reply-suggest/',      ai_v2_reply_suggest,     name='ai_v2_reply_suggest'),
    path('ai/v2/auto-reply/',         ai_v2_auto_reply,        name='ai_v2_auto_reply'),
    path('ai/v2/sentiment-analyze/',  ai_v2_sentiment_analyze, name='ai_v2_sentiment_analyze'),
    path('ai/v2/intent-classify/',    ai_v2_intent_classify,   name='ai_v2_intent_classify'),
    path('ai/v2/review-reply/',       ai_v2_review_reply,      name='ai_v2_review_reply'),
    path('ai/v2/crisis-detect/',      ai_v2_crisis_detect,     name='ai_v2_crisis_detect'),
    path('ai/v2/spam-filter/',        ai_v2_spam_filter,       name='ai_v2_spam_filter'),

    # ── AI v2 — brand voice () ───────────────────────────────────────
    path('ai/v2/brand-voice/',         ai_v2_brand_voice_get,   name='ai_v2_brand_voice_get'),
    path('ai/v2/brand-voice/train/',   ai_v2_brand_voice_train, name='ai_v2_brand_voice_train'),
    path('ai/v2/brand-voice/test/',    ai_v2_brand_voice_test,  name='ai_v2_brand_voice_test'),

    # ── AI v2 — chat assistant () ────────────────────────────────────
    path('ai/v2/chat/',                              ai_v2_chat,         name='ai_v2_chat'),
    path('ai/v2/chat/conversations/',                ai_v2_chat_list,    name='ai_v2_chat_conversations'),
    path('ai/v2/chat/conversations/<int:pk>/',       ai_v2_chat_detail,  name='ai_v2_chat_conversation_detail'),

    # ── AI v2 — insights () ──────────────────────────────────────────
    path('ai/v2/insight-generate/',    ai_v2_insight_generate,   name='ai_v2_insight_generate'),
    path('ai/v2/insights/',            ai_v2_insights_list,      name='ai_v2_insights_list'),
    path('ai/v2/insights/<int:pk>/',   ai_v2_insight_update,     name='ai_v2_insight_update'),
    path('ai/v2/anomaly-detect/',      ai_v2_anomaly_detect,     name='ai_v2_anomaly_detect'),
    path('ai/v2/trend-analysis/',      ai_v2_trend_analysis,     name='ai_v2_trend_analysis'),
    path('ai/v2/forecast/',            ai_v2_forecast,           name='ai_v2_forecast'),
    path('ai/v2/competitor-insight/',  ai_v2_competitor_insight, name='ai_v2_competitor_insight'),
    path('ai/v2/audience-profile/',    ai_v2_audience_profile,   name='ai_v2_audience_profile'),
    path('ai/v2/today-briefing/',      ai_v2_today_briefing,     name='ai_v2_today_briefing'),

    # ── AI v2 — reports + narration () ──────────────────────────────
    path('ai/v2/report-write/',        ai_v2_report_write,       name='ai_v2_report_write'),
    path('ai/v2/report-narrate/',      ai_v2_report_narrate,     name='ai_v2_report_narrate'),

    # ── AI v2 — usage / cost dashboard () ──────────────────────────
    path('ai/v2/usage/',           ai_v2_usage_overview,   name='ai_v2_usage_overview'),
    path('ai/v2/usage/by-client/', ai_v2_usage_by_client,  name='ai_v2_usage_by_client'),
    path('ai/v2/usage/by-user/',   ai_v2_usage_by_user,    name='ai_v2_usage_by_user'),
    path('ai/v2/usage/budget/',    ai_v2_usage_budget,     name='ai_v2_usage_budget'),
    path('ai/v2/usage/quota/',     ai_v2_usage_quota,      name='ai_v2_usage_quota'),
    path('ai/v2/audit/',           ai_v2_usage_audit,      name='ai_v2_usage_audit'),

    # GMB Business Info & Reviews
    path('gmb/info/<int:client_id>/',             gmb_info,    name='gmb_info'),
    path('gmb/reviews/<int:client_id>/',          gmb_reviews, name='gmb_reviews'),

    # WhatsApp module
    path('whatsapp/dashboard/',     WhatsAppDashboardView.as_view(),    name='wa_dashboard'),
    path('whatsapp/inbox/',         WhatsAppInboxView.as_view(),        name='wa_inbox'),
    path('whatsapp/inbox/thread/',  WhatsAppInboxThreadView.as_view(),  name='wa_inbox_thread'),
    path('whatsapp/send/',          WhatsAppSendDirectView.as_view(),   name='wa_send_direct'),
    path('whatsapp/webhook/',       pinbot_webhook,                     name='wa_webhook'),

    # Ads waitlist (stub for upcoming Ads module)
    path('notify-ads/',             notify_ads,                         name='notify_ads'),

    # Composer preflight (validates a draft post against each platform's rules)
    path('composer/preflight/',     PreflightCheckView.as_view(),       name='composer_preflight'),

    # Video Studio ()
    path('video/upload/',             upload_video,        name='video_upload'),
    path('video/trim/',               trim_video,          name='video_trim'),
    path('video/resize/',             resize_video,        name='video_resize'),
    path('video/extract-thumbnail/',  extract_thumbnail,   name='video_thumbnail'),
    path('video/add-captions/',       add_captions,        name='video_captions'),
    path('video/youtube-upload/',     youtube_upload,      name='video_youtube_upload'),

    # Real-time webhooks ()
    path('webhooks/meta/',            meta_webhook,        name='webhook_meta'),
    path('webhooks/youtube/',         youtube_webhook,     name='webhook_youtube'),

    # Audience + competitor benchmark ()
    path('audience/unified/',         UnifiedAudienceView.as_view(), name='audience_unified'),
    path('competitors/benchmark/',    BenchmarkView.as_view(),       name='competitors_benchmark'),

    # Notifications + approvals ()
    path('notifications/preferences/', notification_preferences,    name='notif_preferences'),
    path('composer/approvals/',        approval_queue,              name='composer_approvals'),

    # Inbox stats
    path('inbox/stats/',            InboxStatsView.as_view(),           name='inbox_stats'),

    # Manual-token mode (per-client OAuth-app credentials)
    path('manual/facebook/<int:client_id>/',  connect_facebook_manual,  name='manual_fb'),
    path('manual/instagram/<int:client_id>/', connect_instagram_manual, name='manual_ig'),
    path('manual/youtube/<int:client_id>/',   connect_youtube_manual,   name='manual_yt'),
    path('manual/linkedin/<int:client_id>/',  connect_linkedin_manual,  name='manual_li'),
    path('manual/gmb/<int:client_id>/',       connect_gmb_manual,       name='manual_gmb'),
    path('manual/test/<int:credential_id>/',  test_credential,          name='manual_test'),
    path('manual/instructions/<str:platform>/', get_setup_instructions, name='manual_instructions'),

    # Meta Ads (CTWA — + health)
    path('meta-ads/health/',    meta_ads_health,   name='meta_ads_health'),
    path('meta-ads/accounts/',  list_ad_accounts,  name='meta_ad_accounts'),
    path('meta-ads/campaigns/', list_ad_campaigns, name='meta_ad_campaigns'),
    path('meta-ads/ads/',       list_ads,          name='meta_ads'),

    # CTWA Bot Builder — AI helpers
    path('bot-flows/generate-with-ai/',
         bot_generate_flow_with_ai, name='bot_generate_flow_with_ai'),
    path('bot-conversations/<int:conversation_id>/ai-suggest-replies/',
         bot_suggest_reply,         name='bot_ai_suggest_replies'),
    path('ai/persona-builder/',
         bot_build_persona,         name='ai_persona_builder'),

    # CTWA Bot Builder — safety settings
    path('bot-settings/', bot_settings, name='bot_settings'),

    # Public service health (powers /status marketing page)
    path('health/services/', services_health, name='services_health'),

    path('dashboard/counts/', dashboard_counts, name='dashboard_counts'),
    path('search/unified/',   unified_search,   name='search_unified'),
    path('dashboard/today/',  dashboard_today,  name='dashboard_today'),

    # REST API
    path('', include(router.urls)),
]
