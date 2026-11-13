# Social Stats — Open-Source Social Media Management & Marketing Platform

> An open-source, self-hostable alternative to Hootsuite, Buffer & Sprout Social.

**Social Stats** is an open-source, self-hostable **social media scheduler** for agencies
and teams: publish to **Facebook**, **Instagram**, **YouTube**, **LinkedIn** and **Google
Business** from one composer, run many client workspaces with enforced tenant isolation, and
let automations answer and notify for you. It's built on **Django + React**; you own the data
and the keys.

[![Tests](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/actions/workflows/tests.yml/badge.svg)](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/actions/workflows/tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/cbsshekhawat18-lab/social-stats-social-media-manager?style=social)](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/cbsshekhawat18-lab/social-stats-social-media-manager)](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/commits)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

> **Status:** early-stage. It runs end to end (auth, OAuth onboarding,
> analytics, composer, AI features, the click-to-WhatsApp bot builder,
> marketplace) and its 390+ backend tests pass, but it has no launch partners yet:
> expect rough edges, and please report them.

---

## Demo

![Social Stats: demo sign-in, the analytics page with 90 days of sample data, the dashboard](docs/demo.gif)

Run it locally with Docker, seeded with three accounts and 90 days of sample analytics:

```bash
git clone https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager.git
cd social-stats-social-media-manager

# Throwaway config for a local trial (for a real install, start from .env.docker.example)
cat > .env.docker <<EOF
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')
FIELD_ENCRYPTION_KEYS=$(python3 -c 'import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())')
ALLOW_UNSIGNED_WEBHOOKS=True
EOF

docker compose --env-file .env.docker pull && docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker exec backend python manage.py demo_setup --i-know-this-is-not-production
```

Then open <http://localhost:3000/login>. Without Docker, follow
[Option B](#option-b--manual-local-dev): a Python 3.12 virtualenv for the
backend and `npm start` for the frontend.

`demo_setup` is idempotent. It creates three accounts (password `demo` for all)
and seeds the sample data. It only runs with `DEBUG=True` unless you pass
`--i-know-this-is-not-production` — the Docker stack runs with `DEBUG=False`,
hence the flag above. Sign in with the accounts below; for one-click sign-in
buttons on `/login`, build the frontend with `REACT_APP_SHOW_DEMO=true`
(`REACT_APP_SHOW_DEMO=true docker compose --env-file .env.docker up -d --build`,
or set it in `frontend/.env` without Docker):

| Account | Email | Password | Lands on |
|---|---|---|---|
| Superadmin | `admin@demo.local` | `demo` | `/admin` |
| Agency member | `agency@demo.local` | `demo` | `/dashboard` + `/agency/*` |
| End user | `enduser@demo.local` | `demo` | `/u` |

> These are local-only demo credentials — never deploy them to a real environment.

> ⭐ **If Social Stats is useful to you, please star the repo** — it helps other
> people building self-hosted social tooling find the project.

---

## Documentation

Full guides live on the **[docs site](https://cbsshekhawat18-lab.github.io/social-stats-social-media-manager/)** (built from [`docs/`](docs/)), and the product page is [gigaikripaservices.com/social-stats](https://gigaikripaservices.com/social-stats/):

- [Getting Started](docs/GETTING_STARTED.md) — zero to running locally
- [Configuration](docs/CONFIGURATION.md) — every `.env` variable explained
- [Connect Social Accounts](docs/CONNECT_ACCOUNTS.md) — Meta, Google, LinkedIn (exact scopes & redirect URIs)
- [Connect WhatsApp](docs/CONNECT_WHATSAPP.md) — Pinbot / WABA + webhook setup
- [Going Live](docs/GOING_LIVE.md) — platform app-review & production checklist
- [User Guide](docs/USER_GUIDE.md) — the three account types and every module
- [FAQ & Troubleshooting](docs/FAQ_TROUBLESHOOTING.md) — common failures and fixes
- [How it compares](docs/COMPARISON.md) — vs. closed-source SaaS tools

---

## Features

Social Stats leads with the three capabilities its test suite covers best
(`python manage.py test social_stats`: 390+ tests, all passing on Python 3.12).

### 📅 Publishing to five platforms — 59 tests
- Publishers for Facebook, Instagram, YouTube, LinkedIn and Google Business behind one
  orchestrator, each unit-tested against a mocked platform API
- Driven from the **composer** and **content calendar**: write once, format per platform,
  schedule, and route agency posts through client **approval** first
- Covered by `test_publishers_facebook` (13), `test_publishers_instagram` (13),
  `test_publishers_remaining` (25), `test_orchestrator` (8)

### 🏢 Multi-client agency workspaces — 56 tests
- One agency, many client brands: per-client workspaces, **granular per-client
  permissions**, invites and manage-requests
- Tenant isolation enforced on every endpoint, not just in the UI
- Covered by `test_tenant_isolation` (31), `test_unified_permission` (16),
  `test_tenant_scoped_agency` (9)

### ⚡ Automations and notifications — 55 tests
- **Automations**: IF-this-THEN-that rules, e.g. a keyword in a comment triggers a
  template reply
- An internal event bus that drives in-app and e-mail **notifications**, smart watchers
  and an **audit log**
- Covered by `test_automation` (21), `test_event_bus` (14),
  `test_audit_notifications` (14), `test_notification_centralization` (6)

<details>
<summary><strong>Also included</strong> — the rest of the product, with lighter test coverage</summary>

- **Analytics** — daily-metric ingestion across the five platforms into per-client
  dashboards (impressions, reach, clicks, video views, followers), per-platform
  tables and charts, date-range filters, exportable reports, sync logs and alerts
- **Unified inbox** — DMs, comments and Google reviews in one queue with AI reply
  suggestions; **reviews** management
- **AI Studio** (Anthropic Claude) — Cmd/Ctrl+J assistant with tool use, Smart
  Composer, Caption Writer, Post Ideas, Hashtag Research, Brand Voice training,
  AI Insights, AI-narrated monthly reports, usage tracking
- **WhatsApp & click-to-WhatsApp bots** — WhatsApp dashboard, inbox, contacts,
  lists, templates, campaigns; a visual bot-flow editor with conditional branches
  and AI nodes; human hand-off queue, bot analytics, template gallery
- **Leads/CRM** — captured leads with conversation history
- **Agency marketplace** — two-sided directory with profiles, reviews, invites,
  manage-requests and disputes
- **Admin shell** (`/admin`) — users, clients, staff access, audit log, approval
  and trust queues
- **Public marketing site** — home, features, solutions, customers, blog, help
  center, status, changelog and legal pages
- **Platform** — realtime updates (WebSockets / Django Channels), PWA/offline
  support, JWT + Argon2, MFA/TOTP, session management, django-axes,
  Fernet-encrypted tokens, GDPR/DPDP tooling, light and dark theme, mobile layout

Every module is described in the [User Guide](docs/USER_GUIDE.md).

</details>

### Account types

| Account | What they see |
|---|---|
| `superadmin` / `staff` | Full admin shell at `/admin` |
| Agency member (`role=client`, `account_type=agency_member`) | Shared dashboard at `/dashboard` + agency-only management at `/agency/*` |
| End user (`role=client`, `account_type=end_user`) | End-user shell at `/u` + a single workspace they own |

---

## Who is it for?

- **Social media agencies** managing many client brands from one place, with per-client workspaces, granular permissions, and approval flows.
- **In-house marketing teams** running several brand/social accounts who want scheduling, analytics, and a shared inbox without per-seat SaaS fees.
- **Solo creators & small businesses** who want a free, self-hosted tool to plan posts, track growth, and reply to messages across platforms.
- **Developers** who want a customizable, MIT-licensed Django + React base they can self-host and extend.

## How it works

1. **Connect accounts** — link Facebook, Instagram, YouTube, LinkedIn, Google Business, and WhatsApp via OAuth or the in-app manual setup wizard. Tokens are encrypted at rest, per workspace. See [docs/CONNECT_ACCOUNTS.md](docs/CONNECT_ACCOUNTS.md).
2. **Plan & publish** — draft once in the composer, format per platform, schedule on the content calendar; agency posts can route through client approval.
3. **Engage** — DMs, comments, and Google reviews land in one unified inbox with AI-suggested replies; build automated WhatsApp/CTWA bot flows.
4. **Measure** — Celery syncs daily metrics into per-client analytics dashboards, with AI-narrated monthly reports.
5. **Self-host** — run it on your own infrastructure (Django + DRF + Celery + Postgres + React); you own the data and the keys.

## How it compares

An honest, structural comparison vs. closed-source SaaS tools (Hootsuite, Buffer,
Sprout Social). Social Stats is early-stage; this compares licensing/hosting and
the feature categories it actually ships — see [docs/COMPARISON.md](docs/COMPARISON.md)
for the full picture.

| | **Social Stats** | Closed SaaS |
|---|---|---|
| License | **Open source (MIT)** | Proprietary |
| Hosting | **Self-host, own your data** | Vendor cloud only |
| Source code | **Public & forkable** | Closed |
| Cost | **Free to self-host** | Paid subscription |
| Platform coverage | FB, IG, YouTube, LinkedIn, Google Business + WhatsApp | Varies by plan |
| Maturity / support | Early-stage, community | Mature, commercial SLAs |

---

## Tech stack

| Layer | What |
|---|---|
| Backend | Django 5.2 LTS + Django REST Framework |
| Auth | JWT (SimpleJWT) + Argon2 hasher + django-axes brute-force protection |
| Task queue | Celery + Redis |
| Realtime | Django Channels (WebSockets) |
| Database | SQLite for local dev, PostgreSQL for everything else |
| Encryption | Fernet for OAuth tokens at rest |
| AI | Anthropic Claude (captions, replies, insights, assistant) |
| Frontend | React 18 + React Router v6 |
| Data fetching | TanStack Query + Zustand |
| Animations | framer-motion |
| Charts | Recharts |
| Icons | lucide-react |

---

## Self-hosting / installation

### Option A — Docker (recommended for self-hosting)

One command brings up the full stack — PostgreSQL, Redis, the Django/Channels
API, a Celery worker + beat, and the React app served by nginx on one origin:

```bash
cp .env.docker.example .env.docker   # set SECRET_KEY + FIELD_ENCRYPTION_KEYS (see comments inside)

# Pull the prebuilt multi-arch images (amd64 + arm64) and start:
docker compose --env-file .env.docker pull && docker compose --env-file .env.docker up -d
# — or build from source instead: docker compose --env-file .env.docker up -d --build

# optional: seed 3 demo accounts + 90 days of analytics (throwaway stacks only)
docker compose --env-file .env.docker exec backend python manage.py demo_setup --i-know-this-is-not-production
# app:          http://localhost:3000
# Django admin: http://localhost:8000/admin/
```

Images are published to GHCR on every release:
`ghcr.io/cbsshekhawat18-lab/social-stats-backend` and
`ghcr.io/cbsshekhawat18-lab/social-stats-frontend` (`:latest` + semver tags).

Fill in `.env.docker` from the template: `SECRET_KEY`, `FIELD_ENCRYPTION_KEYS`,
and the webhook secrets (or `ALLOW_UNSIGNED_WEBHOOKS=True`) are required —
the backend refuses to start without them — and `ANTHROPIC_API_KEY` enables AI.
[docs/CONFIGURATION.md](docs/CONFIGURATION.md) lists every variable.

### Option B — manual (local dev)

You'll need: Python 3.11–3.13 (the Docker image and CI use 3.12), Node 18+,
Redis, and an Anthropic API key for AI features (everything else works
without external credentials).

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
social-stats/
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
# DB_NAME=… DB_USER=… DB_PASSWORD=… DB_HOST=… DB_PORT=…
# CELERY_BROKER_URL=redis://…
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

Social Stats is an open codebase and PRs are welcome — see
[CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md). Good areas to start:

- New platform integrations (any of the major social or messaging APIs)
- Translations for marketing pages
- Accessibility (a11y) improvements
- Test coverage in the React app

Run the backend test suite with `python manage.py test social_stats` and the
frontend Jest suite with `CI=true npm test`. Both should stay green.

⭐ **Starring the repo is the single easiest way to help** — it raises visibility
for everyone else looking for an open-source social media management tool.

---

## Author & Credits

**Social Stats** is built and maintained by **Chandrabhan Shekhawat** —
**Gigai Kripa Services**.

- 🌐 Website: <https://gigaikripaservices.com/>
- 👤 Author: Chandrabhan Shekhawat
- 🏢 Company: Gigai Kripa Services
- © 2026 Chandrabhan Shekhawat — Gigai Kripa Services

If you use Social Stats in your own project or product, a credit back to the
author / this repository is appreciated. ⭐ Stars help others find it.

---

## License

Released under the **[MIT License](./LICENSE)** — free to use, modify, and
self-host, for individuals and companies alike.

```
Copyright (c) 2026 Chandrabhan Shekhawat — Gigai Kripa Services
```

---

## Security

For responsible disclosure, see [SECURITY.md](./SECURITY.md). Please don't open
public issues for security reports.
