# How Social Stats Compares

A fair, factual comparison between **Social Stats** (open-source, self-hosted) and
typical **closed-source SaaS** social media management tools such as Hootsuite,
Buffer, and Sprout Social.

> Honesty note: Social Stats is **early-stage**. The table compares *structural*
> properties (licensing, hosting, data ownership) and the feature **categories**
> Social Stats actually ships — verified against this codebase. Competitor
> capabilities vary by plan and change over time; check their official sites for
> exact, current details before making a decision. We don't claim feature
> superiority over mature commercial products.

## Structural comparison

| | **Social Stats** | Typical SaaS (Hootsuite / Buffer / Sprout Social) |
|---|---|---|
| License | **Open source (MIT)** | Proprietary |
| Hosting | **Self-host** (your servers/cloud) | Vendor cloud only |
| Source code | **Public, auditable, forkable** | Closed |
| Pricing | **Free to self-host** (you pay for infra + API usage) | Paid subscription / per-seat |
| Data ownership | **Your database, your keys** (tokens encrypted at rest) | Stored in vendor cloud |
| Customizable | **Fully** (it's your code) | Limited to vendor features |
| Maturity / support | Early-stage, community | Mature, commercial SLAs & support |

## Feature categories Social Stats ships

These are present in this codebase (see the linked docs):

- Multi-platform **analytics dashboards** — Facebook, Instagram, YouTube,
  LinkedIn, Google Business
- **Post composer + scheduling + content calendar** with agency approval flows
- **Unified inbox** (DMs, comments, Google reviews) with AI reply suggestions
- **Click-to-WhatsApp bot builder** (visual flow editor with AI nodes)
- **Agency marketplace** (two-sided directory)
- **AI assistant** + brand-voice training, insights, forecasts (Anthropic Claude)
- Multi-tenant **agency / end-user** account model with per-client workspaces

## When Social Stats is a good fit

- You want to **self-host** and **own your data** and platform tokens.
- You're an **agency or team** managing multiple brands and want per-client
  workspaces and approval flows.
- You want to **customize or extend** the tool (it's your code).
- You're comfortable running Django + React + Redis (or hiring someone who is).

## When a commercial SaaS is a better fit

- You want **zero ops** — no servers, upgrades, or platform app-review work.
- You need **guaranteed support / SLAs** and a mature, polished product today.
- You don't want to manage your own platform OAuth apps and approvals.

## Honest limitations (today)

- **Early-stage**: expect rough edges; the React test suite is thin.
- Connecting real accounts requires **your own platform developer apps** and, for
  one-click OAuth, **platform app review** (see [GOING_LIVE.md](GOING_LIVE.md)).
- Some integrations (e.g. LinkedIn org analytics, WhatsApp templates) depend on
  platform approvals you must obtain.

See also: [Getting Started](GETTING_STARTED.md) ·
[Connect Accounts](CONNECT_ACCOUNTS.md) · [FAQ](FAQ_TROUBLESHOOTING.md)
