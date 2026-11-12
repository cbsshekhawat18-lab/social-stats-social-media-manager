---
title: "Configuration Reference — Every Environment Variable"
description: "Every environment variable Social Stats reads: database, Redis/Celery, OAuth apps for Facebook, Instagram, YouTube, LinkedIn and Google Business, WhatsApp, email, AI models, and security settings."
---

# Configuration Reference

Every variable in [`backend/.env.example`](../backend/.env.example), what it does,
whether it's required, how to generate it, and what breaks if it's unset.

Copy the template first:

```bash
cd backend && cp .env.example .env
```

The defaults are tuned for **local development** — you can run the app and the
demo seed with the file almost untouched. Set `ANTHROPIC_API_KEY` to enable AI,
and the platform credentials only when you want to connect real accounts.

---

## Django core

| Variable | Required | Default | What it does / how to set |
|---|---|---|---|
| `SECRET_KEY` | **Yes (prod)** | dev fallback only when `DEBUG=True` | Django cryptographic signing key (also signs JWTs). With `DEBUG=False` startup fails unless it is set, at least 50 characters, and free of `insecure` / `change-me`. Generate: `python -c "import secrets; print(secrets.token_urlsafe(64))"`. |
| `DEBUG` | No | `False` | `True` enables Django debug pages, eager Celery and permissive CORS. **Unset means `False`.** `backend/.env.example` sets `True` for local development. With `False`, the startup guard in [GOING_LIVE.md](GOING_LIVE.md#enforced-at-startup) applies. |
| `ALLOWED_HOSTS` | **Yes (prod)** | `localhost,127.0.0.1` | Comma-separated hostnames Django will serve. `*` is rejected at startup when `DEBUG=False`. In Docker keep `localhost` listed (container healthcheck). |
| `FRONTEND_URL` | **Yes** | `https://app.example.com` | Base URL of the React app. Used to build links in emails and OAuth redirects back to the UI. For local dev set `http://localhost:3000`. |

## Field-level encryption

OAuth tokens and manual credentials are encrypted at rest using these keys.

| Variable | Required | Default | What it does / how to set |
|---|---|---|---|
| `FIELD_ENCRYPTION_KEYS` | **Yes (prod)** — startup fails without it when `DEBUG=False` | empty | Comma-separated Fernet keys. The **first** key encrypts new writes; every key can decrypt (supports rotation). Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. |
| `FIELD_ENCRYPTION_KEY` | No | empty | Legacy single-key fallback used only if `FIELD_ENCRYPTION_KEYS` is empty. |

> If both are empty, `SECRET_KEY` is stretched into a key (dev-only fallback;
> production refuses to start — see the migration note in
> [GOING_LIVE.md](GOING_LIVE.md#enforced-at-startup)).
> **Production must set `FIELD_ENCRYPTION_KEYS`** — otherwise rotating `SECRET_KEY`
> would make stored tokens undecryptable. Affected fields:
> `PlatformCredential.access_token` / `refresh_token`,
> `ManualCredentialExtras.oauth_client_id` / `oauth_client_secret` / `api_key`.

## Database

| Variable | Required | Default | What it does |
|---|---|---|---|
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | No (dev) / **Yes (prod)** | SQLite when `DB_NAME` unset | Postgres connection parts. If `DB_NAME` is unset, dev falls back to SQLite. (There is no `DATABASE_URL` parser.) |

## Redis / Celery

| Variable | Required | Default | What it does |
|---|---|---|---|
| `CELERY_BROKER_URL` | **Yes (for background tasks)** | `redis://localhost:6379/0` | Where Celery queues jobs. Without Redis + this, scheduled publishing, metric sync, and notifications won't run. |
| `CELERY_RESULT_BACKEND` | No | `redis://localhost:6379/0` | Where task results are stored. |
| `CHANNEL_LAYERS_REDIS_URL` | **Yes (prod)** | empty (in-memory) | Redis for WebSocket fan-out across workers. |
| `REDIS_CACHE_URL` | **Yes (prod)** | `redis://localhost:6379/2` | Shared Django cache: login/signup/MFA throttles, one-time social-login codes, AI response cache. Always Redis when `DEBUG=False`; with `DEBUG=True` and this unset, an in-process cache is used. Docker sets `redis://redis:6379/2`. |

## Meta (Facebook + Instagram)

Get these from [developers.facebook.com](https://developers.facebook.com) → Create
App (Business type) → add **Pages API** + **Instagram Graph API**. See
[CONNECT_ACCOUNTS.md](CONNECT_ACCOUNTS.md).

| Variable | Required | Default | What it does |
|---|---|---|---|
| `META_APP_ID` | For Quick Connect | placeholder | Meta App ID (Settings → Basic). |
| `META_APP_SECRET` | For Quick Connect | placeholder | Meta App Secret. |
| `META_REDIRECT_URI` | For Quick Connect | `http://localhost:8000/api/oauth/facebook/callback/` | Must match the redirect URI registered in the Meta app exactly. |
| `META_API_VERSION` | No | `v24.0` | Graph API version used for every Meta call (Graph, Marketing API, Conversions API, the Facebook Login dialog). Format `vNN.N`; anything else fails at startup. Before bumping, check Meta's changelog for removed insights metrics, and set your Meta app's Webhooks subscriptions to the same version. |

## Google (YouTube + Google Business Profile)

Get these from [console.cloud.google.com](https://console.cloud.google.com) →
enable **YouTube Data API v3**, **YouTube Analytics API**, **Business Profile API**.

| Variable | Required | Default | What it does |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | For Quick Connect | placeholder | OAuth 2.0 Web Application client ID (ends `.apps.googleusercontent.com`). |
| `GOOGLE_CLIENT_SECRET` | For Quick Connect | placeholder | OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | For Quick Connect | `http://localhost:8000/api/oauth/google/callback/` | Must match the Authorized redirect URI in Google Cloud exactly. |

## LinkedIn

Get these from [linkedin.com/developers](https://www.linkedin.com/developers).

| Variable | Required | Default | What it does |
|---|---|---|---|
| `LINKEDIN_CLIENT_ID` | For Quick Connect | placeholder | LinkedIn app client ID (Auth tab). |
| `LINKEDIN_CLIENT_SECRET` | For Quick Connect | placeholder | LinkedIn app client secret. |
| `LINKEDIN_REDIRECT_URI` | For Quick Connect | `http://localhost:8000/api/oauth/linkedin/callback/` | Must match the redirect URI in the LinkedIn app exactly. |

## Email

| Variable | Required | Default | What it does |
|---|---|---|---|
| `EMAIL_HOST` | For email | `smtp.gmail.com` | SMTP host for report/notification emails. |
| `EMAIL_PORT` | For email | `587` | SMTP port. |
| `EMAIL_HOST_USER` | For email | placeholder | SMTP username. For Gmail, enable 2FA → App Passwords. |
| `EMAIL_HOST_PASSWORD` | For email | placeholder | SMTP password / Gmail App Password. |
| `DEFAULT_FROM_EMAIL` | No | `Social Stats <noreply@example.com>` | From address on outgoing email. |

> Without email config, the app still runs; email-dependent features (report
> delivery, some notifications) simply won't send.

## Anthropic (AI features)

| Variable | Required | Default | What it does |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | For AI | placeholder | Powers AI captions, replies, insights, the Cmd/Ctrl+J assistant, and AI-narrated reports. Get one at [console.anthropic.com](https://console.anthropic.com). **Without it, AI surfaces are disabled; everything else works.** |

## WhatsApp (Pinbot Partners API v3)

See [CONNECT_WHATSAPP.md](CONNECT_WHATSAPP.md) for the full setup.

| Variable | Required | Default | What it does |
|---|---|---|---|
| `PINBOT_BASE_URL` | For WhatsApp | `https://partnersv1.pinbot.ai/v3` | Pinbot Partners API base URL. |
| `WHATSAPP_ENCRYPTION_KEY` | For WhatsApp | empty | Fernet key encrypting WhatsApp credentials at rest. Generate like `FIELD_ENCRYPTION_KEYS`. |
| `WHATSAPP_WEBHOOK_SECRET` | **Yes (prod)** unless `ALLOW_UNSIGNED_WEBHOOKS=True` | empty | Random 32+ char string. Verifies inbound webhook calls to `/api/whatsapp/webhook/` (sent as `X-Webhook-Secret` header, or matched as `hub.verify_token` on the GET handshake). |
| `WHATSAPP_RATE_LIMIT_PER_SEC` | No | `20` | Outbound WhatsApp send rate cap. |

## Webhook signing

| Variable | Required | Default | What it does |
|---|---|---|---|
| `META_WEBHOOK_SECRET` | **Yes (prod)** unless `ALLOW_UNSIGNED_WEBHOOKS=True` | empty | Your Meta app's **App Secret** — Meta signs webhook POSTs to `/api/webhooks/meta/` with it (`X-Hub-Signature-256`). |
| `META_WEBHOOK_VERIFY_TOKEN` | For Meta webhooks | empty | Token you enter on the Meta app's Webhooks page for the GET subscription handshake. |
| `ALLOW_UNSIGNED_WEBHOOKS` | No | `False` | `True` lets a `DEBUG=False` deployment boot without `META_WEBHOOK_SECRET` / `WHATSAPP_WEBHOOK_SECRET`. It does **not** open the endpoints: without a secret they reject every delivery. Use it when you don't use those webhooks. |

## Uploads

| Variable | Required | Default | What it does |
|---|---|---|---|
| `MEDIA_MAX_UPLOAD_MB` | No | `100` | Largest accepted upload (media library, video import, logos, avatars). Allowed types are fixed: JPEG/PNG/GIF/WebP, MP4/MOV/WebM, PDF — detected from file content. Keep nginx `client_max_body_size` at least this large. |

## Docker (`.env.docker`)

`docker-compose.yml` reads `SECRET_KEY` and `FIELD_ENCRYPTION_KEYS` (required —
compose stops if they're missing), plus `ALLOWED_HOSTS`, `FRONTEND_URL`,
`SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` and
`POSTGRES_PASSWORD` (optional, local-friendly defaults) from `.env.docker`.
Start from [`.env.docker.example`](../.env.docker.example) and pass
`--env-file .env.docker` to every `docker compose` command. Everything else in
the file (API keys, OAuth apps, webhook secrets) is handed to the containers
as-is. `REACT_APP_SHOW_DEMO` is a frontend **build** argument (default `false`).

## Quick Connect toggle

| Variable | Required | Default | What it does |
|---|---|---|---|
| `OAUTH_APPS_APPROVED` | No | `False` | `False` → Quick Connect (one-click OAuth) buttons are disabled and labelled "Coming Soon"; users are routed to the **Manual Setup wizard**. `True` → Quick Connect is enabled. Flip to `True` only after Meta/Google have approved your OAuth apps in production. |

---

## Advanced / optional (read from `settings.py`, not in `.env.example`)

These have working defaults and rarely need changing:

| Variable | Default | What it does |
|---|---|---|
| `AXES_FAILURE_LIMIT` | `5` | Failed logins before lockout (django-axes). |
| `AXES_COOLOFF_HOURS` | `1` | Lockout duration in hours. |
| `TRUSTED_PROXY_COUNT` | `0` | Number of reverse proxies in front of Django that append to `X-Forwarded-For`. `0` ignores the header and uses the socket address. Set it to the exact number of your proxies (docker-compose sets `1` for its nginx) — and only if Django can't be reached around them, or clients could forge their IP. Used by login/signup/MFA throttles, django-axes, session records and API-key IP allow-lists. |
| `JWT_ACCESS_MIN` | `15` | Access-token lifetime (minutes). |
| `JWT_REFRESH_DAYS` | `7` | Refresh-token lifetime (days). |
| `JWT_AUDIENCE` / `JWT_ISSUER` | `socialstats-app` / `socialstats.com` | JWT claims. |
| `SESSION_COOKIE_SAMESITE` / `CSRF_COOKIE_SAMESITE` | `Lax` | Cookie SameSite policy. |
| `FACEBOOK_SOCIAL_APP_ID` / `FACEBOOK_SOCIAL_APP_SECRET` | falls back to `META_APP_ID` / `META_APP_SECRET` | App credentials for "Sign in with Facebook" (app login, separate from connecting a Page). |
| `AI_MONTHLY_BUDGET_USD` | `500` | Monthly AI spend cap. |
| `AI_PER_CLIENT_DAILY_LIMIT` | `100` | Per-client daily AI request cap. |
| `AI_DEFAULT_MODEL` | `claude-sonnet-4-6` | Default Claude model. |
| `AI_FAST_MODEL` | `claude-haiku-4-5-20251001` | Fast/cheap model for light tasks. |
| `AI_DEEP_MODEL` | `claude-opus-4-7` | Highest-capability model for deep tasks. |
