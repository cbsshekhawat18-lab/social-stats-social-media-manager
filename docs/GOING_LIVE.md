---
title: "Going Live — Production Checklist & Platform App Review"
description: "Deploy Social Stats to production: environment checklist, TLS, and the exact OAuth scopes plus app-review steps for Meta, Google and LinkedIn."
---

# Going Live — Platform App Review & Production Checklist

To move from the Manual Setup wizard (users paste their own tokens) to **Quick
Connect** (one-click OAuth for your users), each platform must approve your
developer app for the scopes the code requests. This page lists those exact
scopes and the official review process for each platform.

> Until your apps are approved, keep `OAUTH_APPS_APPROVED=False` — users connect
> via the Manual Setup wizard, which needs no app review.

## The exact scopes you're applying for

These are the scopes Social Stats requests in code — apply for exactly these:

| Platform | Scopes (Quick Connect) |
|---|---|
| **Meta (Facebook/Instagram)** | `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `instagram_manage_insights`, `read_insights` |
| **Google — YouTube** | `youtube.readonly`, `yt-analytics.readonly`, `openid`, `email`, `profile` |
| **Google — Business Profile** | `business.manage`, `openid`, `email`, `profile` |
| **LinkedIn** | `openid`, `profile`, `email` (OIDC). Org analytics (`r_organization_social`, `rw_organization_admin`) require Marketing Developer Platform approval. |

---

## Meta (Facebook + Instagram)

1. **App Review for Advanced Access** on each permission above. Standard Access
   only works for users with a role on the app; Advanced Access is required for
   the public. Submit screencasts showing how each permission is used.
   - Docs: https://developers.facebook.com/docs/app-review
2. **Business Verification** of your Meta Business account.
   - Docs: https://www.facebook.com/business/help/2058515294227817
3. **Switch the app from Development to Live** (App Dashboard → top toggle).
4. **Privacy Policy URL** and **Data Deletion** are required. Social Stats already
   exposes the callbacks:
   - Data deletion callback: `/api/meta/data-deletion-callback/`
   - Deauthorize callback: `/api/meta/deauth-callback/`
   - A user-facing privacy policy + data-deletion page also ship in the app.

## Google (YouTube + Business Profile)

1. **OAuth consent screen verification** (APIs & Services → OAuth consent screen).
   - Docs: https://support.google.com/cloud/answer/9110914
2. **Sensitive / restricted scopes.** `youtube.readonly` and `yt-analytics.readonly`
   are *sensitive*; `business.manage` is *restricted*. Restricted scopes can
   trigger a **third-party security assessment** (CASA) in addition to brand
   verification.
   - Scopes overview: https://developers.google.com/identity/protocols/oauth2/scopes
   - Verification FAQ: https://support.google.com/cloud/answer/9110914
3. **Verified domain + branding** (app name, logo, homepage, privacy policy on a
   domain you've verified in Search Console).
4. Add `/api/oauth/google/callback/` (HTTPS, your domain) as an authorized
   redirect URI on the production OAuth client.

## LinkedIn

1. **Request the Marketing Developer Platform product** on your app (Products tab).
   This unlocks organization-level analytics scopes beyond the OIDC defaults.
   - Docs: https://learn.microsoft.com/en-us/linkedin/marketing/
2. Complete the product's review/questionnaire; approval typically takes a few days.
3. Add `/api/oauth/linkedin/callback/` (HTTPS) as an authorized redirect URL.

## WhatsApp (Pinbot / WABA)

1. **Display-name approval** for each WABA phone number.
2. **Message-template approval** — template (HSM) messages must be approved before
   you can send them for notifications/marketing.
3. **Messaging tier limits** — new numbers start at a low daily unique-recipient
   tier that scales up with quality and volume.
   - WhatsApp Business Platform docs: https://developers.facebook.com/docs/whatsapp
   - (Provisioning is done through your Pinbot Partners dashboard.)

---

## Production environment checklist

> Self-hosting with Docker? Copy `.env.docker.example` to `.env.docker`, put
> your production values there, and run
> `docker compose --env-file .env.docker up -d` from the repo root (full
> stack: PostgreSQL, Redis, API, Celery worker + beat, frontend). Front it
> with your own TLS-terminating proxy (see `infra/nginx/` for a reference
> config) and set `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE` and
> `CSRF_COOKIE_SECURE` to `True` in `.env.docker`.

### Enforced at startup

With `DEBUG=False` (now the default when `DEBUG` is unset) the backend — web,
Celery worker and beat, and every management command — **refuses to start**
with `ImproperlyConfigured` listing each problem, if:

| Check | Fix |
|---|---|
| `SECRET_KEY` missing, shorter than 50 characters, or containing `insecure` / `change-me` | `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `FIELD_ENCRYPTION_KEYS` empty | Generate a Fernet key (see [CONFIGURATION.md](CONFIGURATION.md#field-level-encryption)). **Existing installs:** see the migration note below. |
| `ALLOWED_HOSTS` contains `*` | List your real hostnames (keep `localhost` for the Docker healthcheck). |
| `META_WEBHOOK_SECRET` or `WHATSAPP_WEBHOOK_SECRET` empty | Set them, or set `ALLOW_UNSIGNED_WEBHOOKS=True` if you don't use those webhooks. That only skips this check: without a secret the webhook endpoints reject every delivery. |

The check is skipped under `manage.py test`. For local development set
`DEBUG=True` (as `backend/.env.example` does).

> **Migrating an existing install.** If `FIELD_ENCRYPTION_KEYS` was never set,
> stored OAuth tokens are encrypted with a key derived from your current
> `SECRET_KEY` (or from `FIELD_ENCRYPTION_KEY`). Before changing either:
> 1. Set `FIELD_ENCRYPTION_KEYS=<new Fernet key>,<old FIELD_ENCRYPTION_KEY or old SECRET_KEY>`
>    — every listed key can decrypt; the first encrypts new writes.
> 2. Deploy, then run the `social_stats.security.tasks.rotate_encryption_keys` task.
> 3. Only then replace a short/placeholder `SECRET_KEY` (this also signs users
>    out — JWTs and sessions are signed with it) and drop the old key from the list.

### Checklist

- [ ] `DEBUG=False` (or unset)
- [ ] `ALLOWED_HOSTS` set to your real domain(s)
- [ ] `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` point at PostgreSQL (not SQLite)
- [ ] `FIELD_ENCRYPTION_KEYS` set to a real Fernet key (stored in a secrets manager)
- [ ] `SECRET_KEY` set to a strong random value (50+ characters)
- [ ] `META_WEBHOOK_SECRET` (your Meta App Secret) and `WHATSAPP_WEBHOOK_SECRET` set — or `ALLOW_UNSIGNED_WEBHOOKS=True` if unused
- [ ] `TRUSTED_PROXY_COUNT` matches the number of reverse proxies in front of Django
- [ ] `FRONTEND_URL` set to your HTTPS domain
- [ ] All `*_REDIRECT_URI` values use **HTTPS** + your domain and match the
      platform app settings exactly
- [ ] `ANTHROPIC_API_KEY` set (if using AI)
- [ ] WhatsApp: `WHATSAPP_ENCRYPTION_KEY` + `WHATSAPP_WEBHOOK_SECRET` set; webhook
      URL registered in Pinbot
- [ ] Redis reachable; Celery **worker** + **beat** running
- [ ] **Flip `OAUTH_APPS_APPROVED=True`** only after Meta/Google/LinkedIn approve
      your apps
- [ ] Privacy policy + data-deletion pages reachable (required by Meta/Google)

See [CONFIGURATION.md](CONFIGURATION.md) for how to generate each value.
