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
| `SECRET_KEY` | **Yes (prod)** | dev fallback | Django cryptographic signing key. Dev has an insecure fallback; in production set a long random value. Generate: `python -c "import secrets; print(secrets.token_urlsafe(50))"`. |
| `DEBUG` | No | `False` | `True` enables Django debug pages. **Keep `False` in production.** |
| `ALLOWED_HOSTS` | **Yes (prod)** | `socialstats.app,www.socialstats.app` | Comma-separated hostnames Django will serve. For local dev add `localhost,127.0.0.1`. Requests to other hosts are rejected. |
| `FRONTEND_URL` | **Yes** | `https://socialstats.app` | Base URL of the React app. Used to build links in emails and OAuth redirects back to the UI. For local dev set `http://localhost:3000`. |

## Field-level encryption

OAuth tokens and manual credentials are encrypted at rest using these keys.

| Variable | Required | Default | What it does / how to set |
|---|---|---|---|
| `FIELD_ENCRYPTION_KEYS` | **Yes (prod)** | empty | Comma-separated Fernet keys. The **first** key encrypts new writes; every key can decrypt (supports rotation). Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. |
| `FIELD_ENCRYPTION_KEY` | No | empty | Legacy single-key fallback used only if `FIELD_ENCRYPTION_KEYS` is empty. |

> If both are empty, `SECRET_KEY` is stretched into a key (dev-only fallback).
> **Production must set `FIELD_ENCRYPTION_KEYS`** — otherwise rotating `SECRET_KEY`
> would make stored tokens undecryptable. Affected fields:
> `PlatformCredential.access_token` / `refresh_token`,
> `ManualCredentialExtras.oauth_client_id` / `oauth_client_secret` / `api_key`.

## Database

| Variable | Required | Default | What it does |
|---|---|---|---|
| `DATABASE_URL` | No (dev) / **Yes (prod)** | SQLite | Full DB URL, e.g. `postgres://user:pass@host:5432/dbname`. If unset, dev uses SQLite. |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | No | `postgres` / `5432` etc. | Alternative to `DATABASE_URL` — set individual Postgres connection parts. |

## Redis / Celery

| Variable | Required | Default | What it does |
|---|---|---|---|
| `CELERY_BROKER_URL` | **Yes (for background tasks)** | `redis://localhost:6379/0` | Where Celery queues jobs. Without Redis + this, scheduled publishing, metric sync, and notifications won't run. |
| `CELERY_RESULT_BACKEND` | No | `redis://localhost:6379/0` | Where task results are stored. |

## Meta (Facebook + Instagram)

Get these from [developers.facebook.com](https://developers.facebook.com) → Create
App (Business type) → add **Pages API** + **Instagram Graph API**. See
[CONNECT_ACCOUNTS.md](CONNECT_ACCOUNTS.md).

| Variable | Required | Default | What it does |
|---|---|---|---|
| `META_APP_ID` | For Quick Connect | placeholder | Meta App ID (Settings → Basic). |
| `META_APP_SECRET` | For Quick Connect | placeholder | Meta App Secret. |
| `META_REDIRECT_URI` | For Quick Connect | `http://localhost:8000/api/oauth/facebook/callback/` | Must match the redirect URI registered in the Meta app exactly. |

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
| `DEFAULT_FROM_EMAIL` | No | `Social Stats <noreply@socialstats.app>` | From address on outgoing email. |

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
| `WHATSAPP_WEBHOOK_SECRET` | For WhatsApp | empty | Random 32+ char string. Verifies inbound webhook calls to `/api/whatsapp/webhook/` (sent as `X-Webhook-Secret` header, or matched as `hub.verify_token` on the GET handshake). |
| `WHATSAPP_RATE_LIMIT_PER_SEC` | No | `20` | Outbound WhatsApp send rate cap. |

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
