# Changelog

## [2.0.0] - 2026-11-13

A security-hardening and platform-upgrade release. **It changes how the app is
configured and started** — read *Upgrading from 1.0.0* before deploying.

### Upgrading from 1.0.0

- **Docker:** copy `.env.docker.example` → `.env.docker` and set `SECRET_KEY`
  (50+ chars), `FIELD_ENCRYPTION_KEYS`, and the webhook secrets (or
  `ALLOW_UNSIGNED_WEBHOOKS=True`). Pass `--env-file .env.docker` to every
  `docker compose` command.
- **`DEBUG` now defaults to `False`**, and with it off the app refuses to start
  on a weak/placeholder `SECRET_KEY`, empty `FIELD_ENCRYPTION_KEYS`, `*` in
  `ALLOWED_HOSTS`, or missing webhook secrets. Set `DEBUG=True` for local dev.
- **Existing data:** if `FIELD_ENCRYPTION_KEYS` was never set, stored tokens are
  encrypted with a key derived from `SECRET_KEY`. Set
  `FIELD_ENCRYPTION_KEYS=<new key>,<old SECRET_KEY>` and run
  `rotate_encryption_keys` *before* changing `SECRET_KEY` — see
  `docs/GOING_LIVE.md`.
- **Run `migrate`** (Docker does this on start): image-field validators, a
  state-only migration for Django 5, and django-axes' own new migrations.
- **Python 3.11+** is required (Django 5.2, Pillow 13).
- **WhatsApp/Pinbot:** the webhook secret is accepted only in the
  `X-Webhook-Secret` header, no longer as `?secret=`.
- **Meta:** set the app's Webhooks subscriptions to v24.0;
  `META_WEBHOOK_SECRET` is your App Secret.
- **Demo accounts:** `demo_setup` needs `--i-know-this-is-not-production` when
  `DEBUG=False`; the one-click demo buttons only appear in a frontend built
  with `REACT_APP_SHOW_DEMO=true` (prebuilt images don't have them).
- Upgrade the backend and frontend together: social login now hands the SPA a
  one-time code that the new frontend exchanges.

### Security

- Uploads are typed from their content (Pillow / container magic bytes), not
  the client's Content-Type or extension; allow-list of JPEG/PNG/GIF/WebP,
  MP4/MOV/WebM and PDF; SVG, HTML and polyglots rejected; size cap
  `MEDIA_MAX_UPLOAD_MB`. nginx serves `/media/` with a sandbox CSP, `nosniff`
  and forced download for non-image/video files.
- Client IP comes from `REMOTE_ADDR`, or the N-th `X-Forwarded-For` entry from
  the right with `TRUSTED_PROXY_COUNT=N` — rotating the header no longer
  escapes login/signup/MFA throttles or API-key IP allow-lists. django-axes
  uses the same logic.
- Social login no longer puts JWTs in the redirect URL (one-time 60 s code,
  `POST /api/auth/social/exchange/`).
- Social login validates OAuth `state` and goes through MFA; password reset
  revokes existing sessions and refresh tokens (coordinated disclosure —
  thanks to Dicky Mulia Fiqri, see `SECURITY.md`).
- Webhooks fail closed: Meta events are rejected without `META_WEBHOOK_SECRET`
  (except in `DEBUG`).
- The SPA is served with a Content-Security-Policy (`script-src 'self'`,
  `frame-ancestors 'none'`), X-Frame-Options, Referrer-Policy and
  Permissions-Policy.
- Demo accounts can no longer be created on, or advertised by, a production
  build.

### Added

- Shared Redis cache (`REDIS_CACHE_URL`) for throttles and one-time codes.
- `.env.docker.example`; settings `TRUSTED_PROXY_COUNT`, `MEDIA_MAX_UPLOAD_MB`,
  `ALLOW_UNSIGNED_WEBHOOKS`, `REDIS_CACHE_URL`, `META_API_VERSION`; frontend
  build argument `REACT_APP_SHOW_DEMO`. All documented in
  `docs/CONFIGURATION.md`.

### Changed

- Meta Graph API v24.0 everywhere (`META_API_VERSION`). Insights metrics Meta
  removed on all versions were replaced (`page_impressions_unique` →
  `page_total_media_view_unique`, `post_impressions_unique` →
  `post_total_media_view_unique`, `page_daily_unfollows` →
  `page_daily_unfollows_unique`, Instagram `video_views` / `plays` → `views`).
  Facebook "reach" now uses the views metric, which Meta says is not 1:1 with
  the old one.
- Django 5.2 LTS, Django REST Framework 3.18, anthropic Python SDK 1.x,
  django-axes 8, Celery 5.7; React Router 7, Recharts 3, lucide-react 1,
  framer-motion 13, jsPDF 4. `pip-audit` and `npm audit --omit=dev` are clean.
- README and docs refreshed for first-time visitors and the new Docker setup;
  demo GIF and screenshot re-recorded.

### Fixed

- Facebook and Instagram metric syncs that failed because of removed metrics;
  a rejected metric no longer blanks the whole insights call.
- AI calls on Opus 4.7+ (`AI_DEEP_MODEL`) that failed because a `temperature`
  was sent.
- Social sign-in now loads the user before redirecting, instead of bouncing to
  `/login`.
- The test suite no longer writes files into `backend/media/`.

## [1.0.0] - 2026-08-20

First tagged release.

### Changed — Social Stats is now free & open source (MIT)

Payments and paid plans were removed; the product is free and self-hostable
under the MIT License (Copyright © 2026 Chandrabhan Shekhawat — Gigai Kripa
Services).

**Removed**
- Razorpay billing integration: checkout/confirm/cancel/invoice/webhook
  endpoints (`billing_views.py`) and their routes; the Razorpay healthcheck.
- Frontend Pricing page, Agency/End-user billing pages, Refund Policy page, the
  billing API client, pricing teasers, and the Razorpay integration card.
- "Billing"/"Agency billing" navigation entries and the billing notification
  event.

**Changed**
- All plan quotas are now unlimited for both account types (`end_user` and
  `agency_member`); `usage_limits` checks always allow. Role separation
  (end-user vs agency vs superadmin) is unchanged.
- Legal pages drop the payment processor (Razorpay) from sub-processor/cookie
  lists; the operator is now "Gigai Kripa Services".

**Database (legacy / unused)**
- The billing models (`Subscription`, `Invoice`) and **all historical
  migrations are kept as-is** — no tables were dropped. These tables are now
  **unused/legacy** inert storage; the app still `migrate`s cleanly from an
  empty database. Migration `0064_rename_gateway_fields` renames the former
  `razorpay_*` columns to neutral `gateway_*` names (a pure column rename — no
  data loss). They may be removed in a future migration if desired.
