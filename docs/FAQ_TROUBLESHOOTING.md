# FAQ & Troubleshooting

Common problems and their fixes. See [CONFIGURATION.md](CONFIGURATION.md) for any
variable mentioned here.

## What is Social Stats, and who is it for?

Social Stats is an **open-source social media management & marketing platform**
for **agencies and in-house teams** who manage multiple brands across Facebook,
Instagram, YouTube, LinkedIn, and Google Business — plus WhatsApp Business. It
combines a post **scheduler + content calendar**, cross-platform **analytics
dashboards**, a unified **inbox**, a **click-to-WhatsApp bot builder**, an
**agency marketplace**, and an **AI assistant** (powered by Anthropic Claude).
It's **self-hostable** (Django + React) and MIT-licensed — a self-hosted
alternative to tools like Hootsuite, Buffer, and Sprout Social. See
[COMPARISON.md](COMPARISON.md).

---

## Setup & runtime

### "OAuth redirect URI mismatch" when connecting an account
The redirect URI registered in the platform's developer app must match the app's
`*_REDIRECT_URI` **exactly** (scheme, host, port, path, trailing slash). The code
uses:
- Meta: `http://localhost:8000/api/oauth/facebook/callback/`
- Google: `http://localhost:8000/api/oauth/google/callback/`
- LinkedIn: `http://localhost:8000/api/oauth/linkedin/callback/`

In production these must be your HTTPS domain. Update both the platform app
**and** the env var. See [CONNECT_ACCOUNTS.md](CONNECT_ACCOUNTS.md).

### Quick Connect buttons say "Coming Soon"
That's expected when `OAUTH_APPS_APPROVED=False` (the default). Use the **Manual
Setup wizard**, or set `OAUTH_APPS_APPROVED=True` after your OAuth apps are
approved. See [GOING_LIVE.md](GOING_LIVE.md).

### WhatsApp webhook not verifying (403)
- The GET handshake returns `403` unless `hub.verify_token` equals
  `WHATSAPP_WEBHOOK_SECRET`.
- POST events return `403` unless the `X-Webhook-Secret` header (or `?secret=`)
  equals `WHATSAPP_WEBHOOK_SECRET`.
- Make sure `WHATSAPP_WEBHOOK_SECRET` is **set** (an empty value rejects all
  calls) and matches what you configured in Pinbot. See
  [CONNECT_WHATSAPP.md](CONNECT_WHATSAPP.md).

### Background tasks / scheduling / sync not running
Celery needs Redis and **both** a worker and beat:
```bash
celery -A dashboard worker -l info
celery -A dashboard beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```
If `CELERY_BROKER_URL` can't reach Redis, scheduled publishing, metric sync, and
notification/webhook processing won't happen. Start Redis first.

### AI features do nothing / errors about the API key
Set `ANTHROPIC_API_KEY` in `backend/.env` (get one at
https://console.anthropic.com). Without it, AI surfaces (captions, replies,
insights, the Cmd/Ctrl+J assistant, AI-narrated reports) are disabled — but the
rest of the app works normally.

### Tokens expiring / "token expired" warnings
- **Google** uses `access_type=offline` + a refresh token; Social Stats
  auto-refreshes the access token. Keep the refresh token valid (don't revoke it).
- **LinkedIn** access tokens last ~60 days; the app warns 7 days before expiry —
  regenerate the token and paste it again.
- **Meta** System User Page tokens are long-lived; Graph API Explorer tokens
  expire in ~60 days, so prefer a System User token.

### `demo_setup` didn't seed any analytics
- Run `python manage.py migrate` first.
- `demo_setup` chains into `seed_demo_data` (90 days). If you passed
  `--no-metrics`, dashboards stay empty — re-run without it.
- It's idempotent; existing demo accounts keep their passwords unless you pass
  `--reset`.

### I can't log in to the demo accounts
All three use password `demo`: `admin@demo.local`, `agency@demo.local`,
`enduser@demo.local`. The `/login` page has one-click buttons for each.

### Database errors / want PostgreSQL instead of SQLite
Set `DATABASE_URL=postgres://user:pass@host:5432/dbname` (or the individual
`DB_*` vars) and re-run `python manage.py migrate`.

### Frontend can't reach the API / CORS
The React app expects the API at `http://localhost:8000` and runs on
`http://localhost:3000`. Set `FRONTEND_URL=http://localhost:3000` in
`backend/.env` for local dev, and ensure both servers are running.

### Is any data hardcoded? Will it work with my own accounts on an empty `.env`?
Yes — it's fully dynamic. Platform credentials come from env (`*_APP_ID` /
`*_CLIENT_ID`) and connected-account tokens are stored **per-tenant, encrypted,
in the database**. Demo data is synthetic and only loaded by `demo_setup` /
`seed_demo_data`; the app runs end-to-end with the demo seed off and your own
connected accounts on.
