---
title: "Social Stats FAQ — Cost, Platforms, Self-Hosting and Security"
description: "Answers about Social Stats: what it is, what it costs, which platforms it supports, how to try it, the AI key, agencies, token security, production readiness, version 2.0.0, and how it compares."
faq: true
---

# Frequently asked questions

The same answers as the [product page](https://gigaikripaservices.com/social-stats/#faq). For setup problems, see [Troubleshooting](FAQ_TROUBLESHOOTING.md).

## What is Social Stats?

Social Stats is an open-source, self-hostable social media management platform for agencies and teams. It publishes to Facebook, Instagram, YouTube, LinkedIn and Google Business from one composer, runs many client workspaces with enforced tenant isolation, and adds analytics, a unified inbox, WhatsApp bots and an AI assistant. It is built on Django + React and released under the MIT license.

## Is there a free, self-hosted social media scheduler?

Yes. Social Stats is a free, open-source social media scheduler you host yourself. It schedules and publishes posts to Facebook, Instagram, YouTube, LinkedIn and Google Business from a composer and content calendar, and runs on your own server or cloud with Docker.

## Is Social Stats free?

Yes. Social Stats is free and open source under the MIT license, for individuals and companies alike. Self-hosting it costs only your own servers and any API use, such as an Anthropic key for the AI features.

## Which platforms does Social Stats support?

It publishes to and syncs daily analytics from Facebook, Instagram, YouTube, LinkedIn and Google Business Profile. WhatsApp Business adds an inbox, campaigns, templates and click-to-WhatsApp bot flows.

## How do I try Social Stats?

Clone the repository, write a throwaway .env.docker with a SECRET_KEY and FIELD_ENCRYPTION_KEYS, then run docker compose --env-file .env.docker pull and up -d. python manage.py demo_setup --i-know-this-is-not-production seeds three demo accounts and 90 days of sample analytics. Open localhost:3000/login and sign in.

## Do the AI features need an API key?

Yes. The AI features use Anthropic Claude through your own ANTHROPIC_API_KEY. Everything else, including publishing, analytics, the inbox and automations, works without one.

## Can an agency manage many clients?

Yes. Each client brand gets its own workspace with per-client permissions, invites and approval flows, and tenant isolation is enforced on every endpoint, not only in the interface. 56 tests cover the agency workspaces.

## How are platform tokens protected?

Platform tokens are encrypted at rest with Fernet, per workspace. The keys can be rotated: set FIELD_ENCRYPTION_KEYS to the new key followed by the old one and run rotate_encryption_keys.

## Is Social Stats production-ready?

It is early-stage. It runs end to end and its 400 backend tests pass, but it has no launch partners yet, so expect rough edges and please report them. Version 2.0.0 refuses to start in production on a weak key, missing secrets or a wildcard host.

## What changed in Social Stats 2.0.0?

Version 2.0.0, released on 13 November 2026, is a security-hardening and platform-upgrade release: uploads typed from their content, throttles that a rotated header cannot escape, no tokens in sign-in URLs, webhooks that fail closed, Meta Graph API v24.0 and Django 5.2 LTS. The changelog lists the upgrade steps from 1.0.0.

## How does Social Stats compare with Hootsuite, Buffer and Sprout Social?

Social Stats is open source and self-hosted, so you own the data and the keys and pay no subscription. Those tools are closed, hosted and mature, with commercial support. If you want zero operations and a support contract, a commercial tool is the better fit today.

## Who makes Social Stats?

Social Stats is built and maintained by Chandrabhan Shekhawat at Gigai Kripa Services, a software development company that also builds custom platforms for clients. The source is public on GitHub, and contributions are welcome.
