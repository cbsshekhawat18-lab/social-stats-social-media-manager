# Social State — Marketing OS

Social State is the marketing operating system for modern teams. One product unifies
analytics, content composing, conversation inbox, ads, AI assistant, and bot
builder across the five platforms that matter most: **Facebook**, **Instagram**,
**YouTube**, **LinkedIn**, and **Google Business**. WhatsApp Business is a
first-class messaging module.

> **Status:** early-stage. The product is feature-complete enough to run
> end-to-end (auth, OAuth onboarding, analytics, composer, AI features,
> CTWA bot builder, marketplace), but customer-volume, testimonials, and
> case studies on the marketing site are intentionally absent until we
> onboard the first cohort of launch partners.

> **Try the demo locally:** `python manage.py migrate && python manage.py demo_setup`
> seeds three accounts — superadmin / agency / end-user, all with password
> `demo` — and 90 days of sample analytics so the dashboards aren't empty.
> The `/login` page surfaces one-click sign-in buttons for each.

---

## What's in the box

- **Analytics** — daily-metric ingestion across 5 platforms, time-series API,
  per-client dashboards, AI-narrated monthly reports.
- **Composer** — one editor, per-platform formatting, brand-voice AI captions,
  scheduling, approval flows for agency clients.
- **Inbox** — unified conversation queue across DMs, comments, and Google
  reviews; AI reply suggestions in your brand voice.
- **Click-to-WhatsApp bots** — visual flow editor with conditional branches and
  AI chat nodes; lead capture pushes to CRM.
- **Marketplace** — two-sided agency directory where end users can find an
  agency to manage their workspace.
- **AI surfaces** — Cmd/Ctrl+J assistant with tool use, brand-voice training,
  insights, forecasts.

Account types:

| Account | What they see |
|---|---|
| `superadmin` / `staff` | Full admin shell at `/admin` |
| Agency member (`role=client`, `account_type=agency_member`) | Shared dashboard at `/dashboard` + agency-only management at `/agency/*` |
| End user (`role=client`, `account_type=end_user`) | End-user shell at `/u` + a single workspace they own |

---

## Tech stack

| Layer | What |
|---|---|
| Backend | Django 4.2 + Django REST Framework |
| Auth | JWT (SimpleJWT) + Argon2 hasher + django-axes brute-force protection |
| Task queue | Celery + Redis |
| Realtime | Django Channels (WebSockets) |
| Database | SQLite for local dev, PostgreSQL for everything else |
| Encryption | Fernet for OAuth tokens at rest |
| Frontend | React 18 + React Router v6 |
| Data fetching | TanStack Query + Zustand |
| Animations | framer-motion |
| Charts | Recharts |
| Icons | lucide-react |

---

## Quick start (local dev)

You'll need: Python 3.11+, Node 18+, Redis, and an Anthropic API key for AI
features (everything else works without external credentials).

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure env
cp .env.example .env
# Edit .env — at minimum set ANTHROPIC_API_KEY if you want AI features.

# Migrate the schema
python manage.py migrate

# (Optional, but recommended for first-time evaluation)
# Seed three demo accounts + 90 days of analytics data so the dashboards
# aren't empty. Prints the demo credentials on stdout.
python manage.py demo_setup

# Run
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm start
# http://localhost:3000
```

### Celery (background sync + notifications)

In two extra terminals:

```bash
# worker
cd backend && source .venv/bin/activate
celery -A dashboard worker -l info

# beat (scheduled tasks)
cd backend && source .venv/bin/activate
celery -A dashboard beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### Redis

```bash
# macOS
brew install redis && brew services start redis

# Ubuntu / Debian
sudo apt install redis-server && sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis
```

---

## OAuth setup

To connect real social-platform accounts during local dev, you need OAuth
credentials. Each platform requires its own app:

- **Meta (Facebook + Instagram)** — `https://developers.facebook.com` → Create
  App → Business type → Pages API + Instagram Graph API. Add redirect URI
  `http://localhost:8000/api/oauth/facebook/callback/`.
- **Google (YouTube + Google Business)** — `https://console.cloud.google.com` →
  enable YouTube Data API v3, YouTube Analytics API, Business Profile API. Add
  redirect URI `http://localhost:8000/api/oauth/google/callback/`.
- **LinkedIn** — `https://www.linkedin.com/developers` → request Marketing
  Developer Platform. Add redirect URI
  `http://localhost:8000/api/oauth/linkedin/callback/`.

Drop the resulting `*_CLIENT_ID` / `*_CLIENT_SECRET` values into `backend/.env`.
Without these, the connect-account flows in Settings will redirect but fail at
the platform-consent step; everything else (composer drafts, AI features,
preview pages) still works.

---

## Project layout

```
social-state/
├── backend/                     Django + DRF
│   ├── dashboard/               Project config (settings, urls, celery)
│   └── social_stats/            Main app
│       ├── models.py            Client, UserProfile, PlatformCredential,
│       │                        DailyMetric, Agency, HashtagSet, UnifiedPost, …
│       ├── views.py             REST viewsets
│       ├── oauth_views.py       OAuth flows for the 5 platforms
│       ├── ai/                  Prompts + context builders
│       ├── security/            MFA, sessions, login monitor, throttles
│       └── tasks.py             Celery sync + notification tasks
├── frontend/
│   └── src/
│       ├── App.js               Routes + Protected wrapper
│       ├── components/
│       │   ├── shell/           AppShell, ModuleRail, TopBar, FeatureSidebar
│       │   ├── marketing/       MarketingLayout + landing-page sections
│       │   └── ui/              Button, Modal, Drawer, Tooltip, AccountTypeBadge…
│       ├── pages/               Routed page components
│       ├── hooks/               useAuth, useTheme, useRealtime, useBreakpoint
│       ├── services/            api.js, platforms.js, queryClient
│       └── styles/              tokens.css (design tokens), theme.js
├── infra/                       Terraform + Nginx examples
├── scripts/                     deploy_prod.sh, verify-backups.sh, …
└── templates/                   Breach-notification + regulatory templates
```

---

## Production deployment

```bash
# Build the React bundle
cd frontend && npm run build

# Production env
# DEBUG=False
# ALLOWED_HOSTS=yourdomain.com
# DATABASE_URL=postgres://…
# REDIS_URL=redis://…
# ANTHROPIC_API_KEY=…
# EMAIL_HOST_PASSWORD=…
# FIELD_ENCRYPTION_KEYS=…
# FACEBOOK_CONSUMER_REDIRECT_URI=https://yourdomain.com/api/oauth/facebook/consumer/callback/
# FRONTEND_URL=https://yourdomain.com

# Run
cd backend && gunicorn dashboard.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

An example Nginx config lives in `infra/nginx/`. A skeleton Terraform module
covering VPC, RDS, KMS, and GuardDuty is at `infra/terraform/`. Both are
starting points — adapt to your environment.

---

## Contributing

Social State is an open codebase. PRs welcome, especially:

- New platform integrations (any of the major social or messaging APIs)
- Translations for marketing pages
- A11y improvements
- Test coverage in the React app

The backend has 267 tests (`python manage.py test social_stats`); the frontend
has Jest tests (`CI=true npm test`). Both should stay green.

---

## License

[MIT](./LICENSE)

---

## Security

For responsible disclosure, email `security@socialstate.ai`. Please don't open
public issues for security reports.
