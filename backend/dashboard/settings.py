# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-in-production')

# Independent keys for field-level encryption of OAuth tokens ( security).
# Preferred form: FIELD_ENCRYPTION_KEYS — comma-separated, primary first.
# All keys decrypt; only the first encrypts new writes. Rotation flow:
# 1. Generate new key
# 2. Prepend it to FIELD_ENCRYPTION_KEYS in env
# 3. Run social_stats.security.tasks.rotate_encryption_keys
# 4. Remove the retired key on next deploy
# Backwards compat: FIELD_ENCRYPTION_KEY (singular) is honoured when KEYS is
# empty; SECRET_KEY-derived as dev-only last resort.
FIELD_ENCRYPTION_KEYS = os.environ.get('FIELD_ENCRYPTION_KEYS', '')
FIELD_ENCRYPTION_KEY  = os.environ.get('FIELD_ENCRYPTION_KEY',  '')

DEBUG = os.environ.get('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

INSTALLED_APPS = [
    # daphne replaces the runserver with a Channels-aware ASGI dev server.
    # Must be first so it patches `runserver`.
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_celery_beat',
    'axes',
    'social_stats',
]

MIDDLEWARE = [
    'social_stats.security.middleware.RequestIDMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'social_stats.security.middleware.SecurityHeadersMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'axes.middleware.AxesMiddleware',
]

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',  # legacy verifier
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',  # legacy verifier
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',  # legacy verifier
]

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

AXES_FAILURE_LIMIT       = int(os.environ.get('AXES_FAILURE_LIMIT', '5'))
AXES_COOLOFF_TIME        = float(os.environ.get('AXES_COOLOFF_HOURS', '1'))  # hours
AXES_LOCKOUT_PARAMETERS  = ['username', 'ip_address']
AXES_RESET_ON_SUCCESS    = True
AXES_ENABLE_ADMIN        = True
AXES_ENABLED             = os.environ.get('AXES_ENABLED', 'True') == 'True'  # toggle in dev/test
# When DRF returns JSON (most paths), axes returns plain text — we override
# the lockout response below from a custom view if needed. For now the default
# plain-text 403 is acceptable for a security message.

ROOT_URLCONF = 'dashboard.urls'
WSGI_APPLICATION = 'dashboard.wsgi.application'
ASGI_APPLICATION = 'dashboard.asgi.application'

# ── Channels (WebSocket) layer ────────────────────────────────────────
# In dev, the in-memory layer is sufficient (single process, no redis needed).
# In prod, set CHANNEL_LAYERS_REDIS_URL to use a redis-backed layer that
# fans out across multiple workers.
_CHANNEL_REDIS = os.environ.get('CHANNEL_LAYERS_REDIS_URL', '')
if _CHANNEL_REDIS:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {'hosts': [_CHANNEL_REDIS]},
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
    }

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

if os.environ.get('DB_NAME'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME'),
            'USER': os.environ.get('DB_USER', 'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
     'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
    {'NAME': 'social_stats.security.validators.PasswordComplexityValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Static files (production build, collectstatic) ─────────────────
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ── Security headers + HTTPS enforcement () ──────────────────────────
# Defaults flip ON when DEBUG is False. Each can still be overridden per env
# (useful for staging that runs HTTP-only behind a private LB).
def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ('1', 'true', 'yes', 'on')

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT     = _env_bool('SECURE_SSL_REDIRECT',     not DEBUG)
SESSION_COOKIE_SECURE   = _env_bool('SESSION_COOKIE_SECURE',   not DEBUG)
CSRF_COOKIE_SECURE      = _env_bool('CSRF_COOKIE_SECURE',      not DEBUG)
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY    = False  # double-submit cookie pattern needs JS read
SESSION_COOKIE_SAMESITE = os.environ.get('SESSION_COOKIE_SAMESITE', 'Lax')
CSRF_COOKIE_SAMESITE    = os.environ.get('CSRF_COOKIE_SAMESITE', 'Lax')

# HSTS — default to 1 year preload-eligible in prod; 0 in dev (so the browser
# doesn't latch onto http://localhost behaviour).
SECURE_HSTS_SECONDS            = int(os.environ.get('SECURE_HSTS_SECONDS', '0' if DEBUG else '31536000'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', not DEBUG)
SECURE_HSTS_PRELOAD            = _env_bool('SECURE_HSTS_PRELOAD',            not DEBUG)

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY      = 'strict-origin-when-cross-origin'
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
X_FRAME_OPTIONS             = 'DENY'

# ── CSP — overridable in env via CSP_CONNECT_SRC for prod-specific origins ──
_csp_connect_extra = [s.strip() for s in os.environ.get('CSP_CONNECT_SRC', '').split(',') if s.strip()]
CONTENT_SECURITY_POLICY = {
    'connect-src': [
        "'self'",
        'https://api.anthropic.com',
        'https://partnersv1.pinbot.ai',
        'https://graph.facebook.com',
        'https://www.googleapis.com',
 *_csp_connect_extra,
    ],
}

# ── — CAPTCHA + AI cost quotas ───────────────────────────────────────
TURNSTILE_SECRET_KEY = os.environ.get('TURNSTILE_SECRET_KEY', '')
TURNSTILE_SITE_KEY   = os.environ.get('TURNSTILE_SITE_KEY',   '')

BACKEND_PUBLIC_URL = os.environ.get('BACKEND_PUBLIC_URL', '')
# Shared secret Google sends in X-Goog-Channel-Token; keep it short-but-random.
GOOGLE_DELETION_SHARED_SECRET = os.environ.get('GOOGLE_DELETION_SHARED_SECRET', '')

# Per-plan daily $ caps for AI features. Override via env (JSON-ish via env not
# possible cleanly; for now use defaults from `security.ai_budget` and let
# higher envs patch via Django settings.)
# PLAN_AI_DAILY_BUDGETS_USD = {'free': 0.5, 'pro': 5.0, 'premium': 25.0, ...}

# ── CORS ──────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = DEBUG and _env_bool('CORS_ALLOW_ALL_ORIGINS', True)
CORS_ALLOWED_ORIGINS   = [
    o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
# Surface the request-id header so the frontend can include it in support reports.
CORS_EXPOSE_HEADERS    = ['X-Request-ID']

# ── JWT Auth ──────────────────────────────────────────
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':       timedelta(minutes=int(os.environ.get('JWT_ACCESS_MIN', '15'))),
    'REFRESH_TOKEN_LIFETIME':      timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', '7'))),
    'ROTATE_REFRESH_TOKENS':       True,
    'BLACKLIST_AFTER_ROTATION':    True,
    'UPDATE_LAST_LOGIN':           True,
    'AUTH_HEADER_TYPES':           ('Bearer',),
    'AUDIENCE':                    os.environ.get('JWT_AUDIENCE', 'socialstats-app'),
    'ISSUER':                      os.environ.get('JWT_ISSUER',   'socialstats.com'),
    # JTI claim is on by default in simplejwt — required for blacklist to work.
}

# ── DRF ───────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'social_stats.security.api_keys.APIKeyAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
}

# ── Celery ────────────────────────────────────────────
CELERY_BROKER_URL        = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND    = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT    = ['json']
CELERY_TASK_SERIALIZER   = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE          = 'UTC'
CELERY_BEAT_SCHEDULER    = 'django_celery_beat.schedulers:DatabaseScheduler'
# In development, run tasks synchronously (no Redis/worker needed)
CELERY_TASK_ALWAYS_EAGER = DEBUG
CELERY_TASK_EAGER_PROPAGATES = DEBUG

from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    'check-alerts-every-6-hours': {
        'task':     'social_stats.tasks.check_alerts',
        'schedule': crontab(minute=0, hour='*/6'),
    },
    'find-best-posts-monday-8am': {
        'task':     'social_stats.tasks.find_best_posts',
        'schedule': crontab(minute=0, hour=8, day_of_week=1),  # Monday 8am UTC
    },
    'generate-monthly-roi-2nd': {
        'task': 'social_stats.tasks.generate_monthly_roi_reports',
        'schedule': crontab(minute=0, hour=8, day_of_month=2),
    },
    'send-scheduling-reminders-daily-8am': {
        'task':     'social_stats.tasks.send_scheduling_reminders',
        'schedule': crontab(hour=8, minute=0),
    },
    'check-overdue-scheduled-posts-hourly': {
        'task':     'social_stats.tasks.check_overdue_scheduled_posts',
        'schedule': crontab(minute=0),
    },
    'check-whatsapp-campaign-completion-5min': {
        'task':     'social_stats.whatsapp_tasks.check_campaign_completion',
        'schedule': crontab(minute='*/5'),
    },
    'composer-process-scheduled-posts': {
        'task':     'social_stats.scheduler.process_scheduled_posts',
        'schedule': crontab(minute='*'),
    },
    'composer-process-post-queues': {
        'task':     'social_stats.scheduler.process_post_queues',
        'schedule': crontab(minute='*'),
    },
    'inbox-sync-every-5min': {
        'task':     'social_stats.inbox_tasks.sync_inbox_for_all_clients',
        'schedule': crontab(minute='*/5'),
    },
    'snapshot-competitors-daily-3am': {
        'task':     'social_stats.competitor_tasks.snapshot_competitors',
        'schedule': crontab(hour=3, minute=0),
    },
    'smart-notifications-hourly': {
        'task':     'social_stats.notification_watchers.run_smart_notifications',
        'schedule': crontab(minute=15),
    },
    'ctwa-sync-active-campaigns-daily-2am': {
        'task':     'social_stats.meta_capi_tasks.sync_active_ctwa_campaigns',
        'schedule': crontab(hour=2, minute=30),
    },
    'security-audit-anomaly-scan-hourly': {
        'task':     'social_stats.security.tasks.detect_security_anomalies',
        'schedule': crontab(minute=10),  # every hour at HH:10
    },
    'security-audit-retention-weekly': {
        'task':     'social_stats.security.tasks.cleanup_security_audit_logs',
        'schedule': crontab(hour=3, minute=15, day_of_week=0),  # Sunday 03:15
    },
    'privacy-sweep-pending-deletions-hourly': {
        'task':     'social_stats.security.privacy_tasks.sweep_pending_deletions',
        'schedule': crontab(minute=20),  # every hour at HH:20
    },
}

# ── Meta OAuth (Facebook + Instagram) ────────────────
META_APP_ID        = os.environ.get('META_APP_ID', '')
META_APP_SECRET    = os.environ.get('META_APP_SECRET', '')
META_REDIRECT_URI  = os.environ.get('META_REDIRECT_URI', 'http://localhost:8000/api/oauth/facebook/callback/')
META_API_VERSION   = 'v18.0'

# ── Google OAuth (YouTube + GMB) ─────────────────────
GOOGLE_CLIENT_ID      = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET  = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI   = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:8000/api/oauth/google/callback/')

# ── Microsoft OAuth (social login) ───────────────────
MICROSOFT_CLIENT_ID           = os.environ.get('MICROSOFT_CLIENT_ID', '')
MICROSOFT_CLIENT_SECRET       = os.environ.get('MICROSOFT_CLIENT_SECRET', '')
MICROSOFT_SOCIAL_REDIRECT_URI = os.environ.get('MICROSOFT_SOCIAL_REDIRECT_URI', 'http://localhost:8000/api/auth/social/microsoft/callback/')
GOOGLE_SOCIAL_REDIRECT_URI    = os.environ.get('GOOGLE_SOCIAL_REDIRECT_URI',    'http://localhost:8000/api/auth/social/google/callback/')
FACEBOOK_SOCIAL_REDIRECT_URI  = os.environ.get('FACEBOOK_SOCIAL_REDIRECT_URI',  'http://localhost:8000/api/auth/social/facebook/callback/')
# Separate Consumer app credentials for Facebook social login (login/signup buttons)
FACEBOOK_SOCIAL_APP_ID     = os.environ.get('FACEBOOK_SOCIAL_APP_ID',     os.environ.get('META_APP_ID', ''))
FACEBOOK_SOCIAL_APP_SECRET = os.environ.get('FACEBOOK_SOCIAL_APP_SECRET', os.environ.get('META_APP_SECRET', ''))

# ── LinkedIn OAuth ────────────────────────────────────
LINKEDIN_CLIENT_ID     = os.environ.get('LINKEDIN_CLIENT_ID', '')
LINKEDIN_CLIENT_SECRET = os.environ.get('LINKEDIN_CLIENT_SECRET', '')
LINKEDIN_REDIRECT_URI  = os.environ.get('LINKEDIN_REDIRECT_URI', 'http://localhost:8000/api/oauth/linkedin/callback/')

# ── Email (Zoho) ──────────────────────────────────────
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = os.environ.get('EMAIL_HOST', 'smtp.zoho.in')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS       = True
EMAIL_USE_SSL       = False
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER', 'noreply@socialstats.app')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get('DEFAULT_FROM_EMAIL', 'Social Stats <noreply@socialstats.app>')

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# ── Anthropic Claude API ──────────────────────────────
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

# AI infrastructure () — central limits + model selection.
AI_MONTHLY_BUDGET_USD     = float(os.environ.get('AI_MONTHLY_BUDGET_USD', '500'))
AI_PER_CLIENT_DAILY_LIMIT = int(os.environ.get('AI_PER_CLIENT_DAILY_LIMIT', '100'))
AI_CACHE_TTL_SECONDS      = int(os.environ.get('AI_CACHE_TTL_SECONDS', '86400'))
AI_DEFAULT_MODEL          = os.environ.get('AI_DEFAULT_MODEL', 'claude-sonnet-4-6')
AI_FAST_MODEL             = os.environ.get('AI_FAST_MODEL', 'claude-haiku-4-5-20251001')
AI_DEEP_MODEL             = os.environ.get('AI_DEEP_MODEL', 'claude-opus-4-7')
AI_STREAMING_ENABLED      = os.environ.get('AI_STREAMING_ENABLED', 'true').lower() == 'true'
AI_TOOL_USE_ENABLED       = os.environ.get('AI_TOOL_USE_ENABLED', 'true').lower() == 'true'
AI_RAG_ENABLED            = os.environ.get('AI_RAG_ENABLED', 'false').lower() == 'true'

# ── Real-time webhooks ────────────────────────────────
# Used to verify Meta Page webhook subscriptions. Configure on the Meta app's
# webhooks page; Meta hits GET /api/webhooks/meta/ once with this token.
META_WEBHOOK_VERIFY_TOKEN = os.environ.get('META_WEBHOOK_VERIFY_TOKEN', '')
# Used to validate the X-Hub-Signature-256 header on POST events; should be
# the same secret you configured on the Meta app's webhooks page.
META_WEBHOOK_SECRET       = os.environ.get('META_WEBHOOK_SECRET', '')
# YouTube PubSubHubbub callback secret (optional — verifies HMAC on POST).
YOUTUBE_WEBHOOK_SECRET    = os.environ.get('YOUTUBE_WEBHOOK_SECRET', '')

# ── Manual-token mode ─────────────────────────────────
# When False, the frontend disables Quick-Connect (OAuth) buttons and steers
# users to the Manual Setup wizard. Flip to True once Meta/Google approve our
# OAuth apps to re-enable Quick Connect across the UI.
OAUTH_APPS_APPROVED = os.environ.get('OAUTH_APPS_APPROVED', 'False') == 'True'

# ── WhatsApp / Pinbot ─────────────────────────────────
PINBOT_BASE_URL              = os.environ.get('PINBOT_BASE_URL', 'https://partnersv1.pinbot.ai/v3')
WHATSAPP_ENCRYPTION_KEY      = os.environ.get('WHATSAPP_ENCRYPTION_KEY', '')
WHATSAPP_WEBHOOK_SECRET      = os.environ.get('WHATSAPP_WEBHOOK_SECRET', '')
WHATSAPP_RATE_LIMIT_PER_SEC  = int(os.environ.get('WHATSAPP_RATE_LIMIT_PER_SEC', '20'))
