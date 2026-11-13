---
title: "Social Stats — Open-Source Social Media Management Platform"
description: "Social Stats is an open-source, self-hostable social media management platform for agencies and teams. It publishes to Facebook, Instagram, YouTube, LinkedIn and Google Business from one composer, runs many client workspaces with enforced tenant isolation, and adds analytics, a unified inbox, WhatsApp bots and an AI assistant. Django + React, MIT."
hide:
  - navigation
  - toc
---

<div class="ss-hero" markdown>

<div class="ss-eyebrow">Social Stats 2.0.0 · open source · MIT</div>

# Social media management <span class="ss-grad">you host yourself.</span>

Social Stats is an open-source, self-hostable social media management platform
for agencies and teams. It publishes to Facebook, Instagram, YouTube, LinkedIn
and Google Business from one composer, runs many client workspaces with
enforced tenant isolation, and adds analytics, a unified inbox, WhatsApp bots
and an AI assistant. Django + React, MIT.

[Get started](GETTING_STARTED.md){ .md-button .md-button--primary }
[Features](features.md){ .md-button }
[GitHub](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager){ .md-button }

</div>

![Social Stats: the demo sign-in, the analytics page with 90 days of sample data, then the dashboard](demo.gif){ loading=lazy }

<div class="ss-stats" markdown>
<div><b>400</b><span>backend tests, all passing</span></div>
<div><b>5</b><span>publishing platforms, plus WhatsApp</span></div>
<div><b>93</b><span>data models</span></div>
<div><b>388</b><span>API endpoints</span></div>
<div><b>MIT</b><span>free to self-host</span></div>
</div>

The numbers are counted in the 2.0.0 code: `python manage.py test social_stats`
runs the 400 tests.

## What Social Stats does

<div class="grid cards" markdown>

-   **Publish**

    ---

    Write a post once, format it per platform, and schedule it on a content
    calendar. Agency posts can route through client approval first.

    [User guide](USER_GUIDE.md#composer-scheduling)

-   **Engage**

    ---

    Comments from Facebook, Instagram, YouTube and LinkedIn, Google reviews and
    WhatsApp messages in one inbox, with AI reply suggestions.

    [User guide](USER_GUIDE.md#unified-inbox)

-   **Measure**

    ---

    Daily metrics per client: impressions, reach, clicks, video views and
    followers, with exportable and AI-narrated monthly reports.

    [User guide](USER_GUIDE.md#analytics-dashboard)

-   **Automate**

    ---

    IF-this-THEN-that rules, an event bus behind in-app and email
    notifications, and an audit log.

    [Features](features.md#engage)

-   **WhatsApp**

    ---

    Campaigns, templates and click-to-WhatsApp bot flows with conditional
    branches, AI nodes and a human hand-off queue.

    [Connect WhatsApp](CONNECT_WHATSAPP.md)

-   **Agencies**

    ---

    One agency, many client brands, each in its own workspace, with tenant
    isolation enforced on every endpoint, not just in the UI.

    [Features](features.md#agencies)

</div>

## Try it with Docker

Docker brings up PostgreSQL, Redis, the Django API, a Celery worker and beat,
and the React app on one origin. This is a throwaway trial config; for a real
install, start from `.env.docker.example` and read [Going live](GOING_LIVE.md).

```bash
git clone https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager.git
cd social-stats-social-media-manager
cat > .env.docker <<EOF
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')
FIELD_ENCRYPTION_KEYS=$(python3 -c 'import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())')
ALLOW_UNSIGNED_WEBHOOKS=True
EOF
docker compose --env-file .env.docker pull && docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker exec backend python manage.py demo_setup --i-know-this-is-not-production
```

Then open <http://localhost:3000/login> and sign in with a demo account
(password `demo`). [Getting started](GETTING_STARTED.md) has every step,
with or without Docker.

## Who it is for

- **Social media agencies** managing many client brands, with per-client
  workspaces, permissions and approvals.
- **In-house marketing teams** running several brands, with scheduling,
  analytics and a shared inbox and no per-seat fees.
- **Creators and small businesses** who want a free, self-hosted way to plan
  posts, track growth and reply across platforms.
- **Developers** who want an MIT-licensed Django + React base to self-host and
  extend.

## Where it stands

Social Stats is early-stage. It runs end to end and its 400 backend tests pass,
but it has no launch partners yet, so expect rough edges and please
[report them](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/issues).
Connecting real accounts needs your own platform developer apps and, for
one-click OAuth, the platforms' app review. [How it compares](COMPARISON.md)
says when a commercial tool is the better fit.

## Read next

<div class="grid cards" markdown>

-   **Start**

    ---

    [Getting started](GETTING_STARTED.md): from zero to a running app on your
    machine, with or without Docker.

-   **Connect**

    ---

    [Connect social accounts](CONNECT_ACCOUNTS.md): Meta, Google and
    LinkedIn, with the exact scopes and redirect URIs.

-   **Ship**

    ---

    [Going live](GOING_LIVE.md): platform app review and the production
    checklist the app enforces at startup.

-   **Questions**

    ---

    [FAQ](faq.md) and [troubleshooting](FAQ_TROUBLESHOOTING.md): what it is,
    what it costs, and fixes for common setup problems.

</div>

Social Stats is built by [Gigai Kripa Services](https://gigaikripaservices.com/).
The product page is [gigaikripaservices.com/social-stats](https://gigaikripaservices.com/social-stats/).
