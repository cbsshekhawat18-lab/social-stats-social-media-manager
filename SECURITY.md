# Security policy

We take security seriously and welcome reports from researchers, customers,
and the public. This document covers our **Vulnerability Disclosure Program
(VDP)** and our internal **patching SLA**.

## Reporting a vulnerability

**Preferred channel:** [GitHub private vulnerability reporting](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/security/advisories/new)
(Security tab → *Report a vulnerability*). Reports stay private between you
and the maintainers until a fix ships.

When reporting, include:

1. A description of the vulnerability + the impact you believe it has
2. Reproduction steps (or a minimal proof-of-concept)
3. Whether you've disclosed this to anyone else
4. Your name / handle if you'd like credit

We respond to every report within **2 business days** with a triage acknowledgement.

### Scope

| In scope | Out of scope |
|---|---|
| The code in this repository (backend API + frontend) | Third-party services the code integrates with (Anthropic, Pinbot, the social platforms) |
| OAuth flows + token handling | DoS / volumetric attacks against someone's self-hosted instance |
| Tenant-isolation bugs (IDOR, SSRF) | Individual self-hosted deployments (report those to their operator) |
| Auth, MFA, session and webhook handling | Self-XSS / clickjacking on logged-out marketing pages |
| Authentication + authorization | Recently-disclosed CVEs in dependencies (we patch via Dependabot) |
| Encryption at rest + in transit | Outdated browser support |

### Safe-harbor

We will not pursue legal action against good-faith researchers who:

- Don't violate our customers' privacy
- Don't degrade our services for other users
- Don't access data beyond the minimum needed to demonstrate the issue
- Give us reasonable time to fix before public disclosure (we ask 90 days)

## Bug-bounty rewards

We do not currently run a paid bounty program. Reports earn:

- **Public credit** in the Acknowledgements section below and in the fix's release notes (with permission)

## Patching SLA

Once a vulnerability is **confirmed**, we patch on the following timeline:

| Severity | Triage SLA | Patch SLA | Public disclosure |
|---|---|---|---|
| **Critical** (data breach, RCE, auth bypass) | 4 hours | 7 days | 30 days post-fix |
| **High** (privilege escalation, CSRF on sensitive ops, stored XSS) | 24 hours | 14 days | 60 days post-fix |
| **Medium** (SSRF on internal services, info disclosure, weak crypto) | 3 business days | 30 days | 90 days post-fix |
| **Low** (clickjacking, missing security header, verbose error messages) | 5 business days | next sprint | with the fix |

Severity is assigned using **CVSS 3.1**.

The SLA starts when triage confirms the issue is reproducible AND in-scope.

### Out-of-cycle releases

For Critical and High issues we cut a hotfix release outside of the regular
deployment cadence. The following channels carry security release notes:

- [GitHub security advisories](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/security/advisories) — published after the fix
- [GitHub releases](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/releases) — hotfix release notes flag security fixes

## How we find vulnerabilities ourselves

The product CI runs the following on every PR + nightly on `main`:

- **Bandit** — Python static security scan
- **pip-audit + safety** — Python CVE scan against OSV.dev and Snyk
- **npm audit** — JS dependency CVE scan, blocking at HIGH+
- **gitleaks** — secret scan on the full git history of every PR

Dependabot opens automated update PRs for security advisories within hours
of disclosure. Our weekly cadence catches non-security drift.

We run **annual third-party penetration tests** (rotating between providers)
and publish summaries with the customer-facing executive report.

## Incident response

For active security incidents affecting customer data, see our
[Incident Response Runbook](./INCIDENT_RESPONSE.md). Customers are notified
within 72 hours per DPDP / GDPR requirements.

---

*Last updated: 2024-11-01 — version 1.0*

## Acknowledgements

Researchers who have responsibly disclosed vulnerabilities (listed with permission):

- **Dicky Mulia Fiqri** — OAuth state validation in social login callbacks, MFA bypass via social login, and missing session/refresh-token revocation on password reset (September 2026, fixed in `9d422bf`)
