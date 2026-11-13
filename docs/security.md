---
title: "Security — How Social Stats Protects Data, and How to Report a Vulnerability"
description: "The Social Stats security model: encrypted platform tokens with key rotation, MFA and session controls, content-typed uploads, fail-closed webhooks, a production mode that refuses weak config, and how to report a vulnerability privately."
---

# Security

## Reporting a vulnerability

Please do not open a public issue for a security report. Follow
[SECURITY.md](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/SECURITY.md)
to report it privately. Version 2.0.0 includes fixes from a coordinated
disclosure, credited in the [changelog](changelog.md).

## How Social Stats protects your data

- **Platform tokens are encrypted at rest** with Fernet, per workspace. The keys
  can be rotated: set `FIELD_ENCRYPTION_KEYS` to the new key followed by the old
  one and run `rotate_encryption_keys`. [Going live](GOING_LIVE.md) has the steps.
- **Sign-in** uses JWT, Argon2 password hashing, MFA (TOTP), session management
  and brute-force protection (django-axes). A password reset revokes existing
  sessions and refresh tokens.
- **Social sign-in** validates the OAuth `state`, goes through MFA, and hands the
  app a one-time 60-second code instead of putting tokens in the redirect URL.
- **Throttles hold.** The client IP comes from `REMOTE_ADDR`, or the N-th
  `X-Forwarded-For` entry from the right with `TRUSTED_PROXY_COUNT=N`, so a
  rotated header cannot escape login, signup or MFA throttles.
- **Uploads are typed from their content**, not the client's Content-Type or
  file name, against an allow-list (JPEG, PNG, GIF, WebP, MP4, MOV, WebM, PDF);
  SVG, HTML and polyglots are rejected, with a size cap (`MEDIA_MAX_UPLOAD_MB`).
- **Webhooks fail closed.** Meta events are refused without
  `META_WEBHOOK_SECRET`, and the WhatsApp secret is accepted only in the
  `X-Webhook-Secret` header.
- **The app shell** is served with a Content-Security-Policy (`script-src 'self'`,
  `frame-ancestors 'none'`), X-Frame-Options, Referrer-Policy and
  Permissions-Policy.
- **Production refuses weak configuration.** With `DEBUG` off, the app will not
  start on a weak or placeholder `SECRET_KEY`, empty `FIELD_ENCRYPTION_KEYS`, `*`
  in `ALLOWED_HOSTS`, or missing webhook secrets.
- **Privacy tooling** handles data export and deletion, with an hourly sweep of
  pending deletions.

73 tests cover the 2.0.0 security work: `test_upload_security` (22),
`test_social_auth_security` (16), `test_webhook_security` (11),
`test_client_ip` (10) and `test_prod_config` (14). CI runs static analysis and
dependency audits on every pull request and nightly.
