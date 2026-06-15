---
title: "Social Stats — Open-Source Social Media Management Platform"
description: "Open-source social media management & marketing platform — schedule posts, content calendar, cross-platform analytics dashboards, unified inbox, click-to-WhatsApp bot builder, and an AI assistant. Self-hosted Django + React. A Hootsuite / Buffer / Sprout Social alternative."
---

# Social Stats — Open-Source Social Media Management Platform

**Social Stats** is an open-source, self-hostable **social media management** and
marketing platform for agencies and teams. It's an open alternative to Hootsuite,
Buffer, and Sprout Social, built on **Django + React**.

[⭐ Star the project on GitHub »](https://github.com/cbsshekhawat18/social-stats-social-media-manager)

## What it does

- **Social media scheduler & content calendar** — one composer with per-platform
  formatting, brand-voice AI captions, scheduling, and agency approval flows.
- **Social media analytics dashboard** — daily-metric ingestion across Facebook,
  Instagram, YouTube, LinkedIn, and Google Business, with a time-series API and
  per-client dashboards.
- **Unified inbox** — DMs, comments, and Google reviews in one queue, with AI
  reply suggestions in your brand voice.
- **Click-to-WhatsApp bot builder** — a visual flow editor with conditional
  branches and AI chat nodes.
- **Agency marketplace** — a two-sided directory connecting businesses with
  agencies.
- **AI social media assistant** — powered by Anthropic Claude.

## Self-hosting

Social Stats runs on Django 4.2 + Django REST Framework, Celery + Redis, Django
Channels, PostgreSQL, and a React 18 frontend. See the
[installation guide on GitHub](https://github.com/cbsshekhawat18/social-stats-social-media-manager#self-hosting--installation-local-dev).

```bash
python manage.py migrate
python manage.py demo_setup   # demo accounts + 90 days of sample analytics
python manage.py runserver
```

## Links

- [Source code & README](https://github.com/cbsshekhawat18/social-stats-social-media-manager)
- [Contributing guide](https://github.com/cbsshekhawat18/social-stats-social-media-manager/blob/main/CONTRIBUTING.md)
- [Report an issue](https://github.com/cbsshekhawat18/social-stats-social-media-manager/issues)

---

_Open-source under the MIT License. An open-source alternative to Hootsuite,
Buffer, and Sprout Social._
