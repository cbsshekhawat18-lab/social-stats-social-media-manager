# Customer breach notification — email template

**Status:** template — fill bracketed fields, run through DPO + legal **before** sending.

---

**Subject:** Important security update about your Social Stats account

Hi {{ customer.first_name | "there" }},

We're writing to let you know about a security incident affecting your Social Stats
account. We're contacting you directly because we believe **your data may have
been involved**, and we want to be straightforward about what happened.

## What happened

On **{{ incident.date }}** at **{{ incident.time }}** (UTC), {{ short_factual_summary }}.

We discovered the issue on {{ discovery.date }} and {{ contained_by_action }}.

## What information was involved

The incident affected the following data associated with your account:

- {{ data_category_1 }}
- {{ data_category_2 }}
- ...

We have **no evidence** that the following data was accessed:

- {{ unaffected_category_1 }}
- {{ unaffected_category_2 }}

Social Stats does not process payments or store any card/billing details.

## What we've done

- {{ action_taken_1 — e.g. revoked the affected API key }}
- {{ action_taken_2 — e.g. patched the vulnerability and re-deployed }}
- Engaged an external security firm ({{ firm_name }}) to confirm the root cause
- Reported to {{ regulator — e.g. Data Protection Board of India }}
- Reset every active session for affected users
- {{ action_taken_3 }}

## What you should do

1. **Change your Social Stats password.** We've reset every active session, so you'll
   be signed out the next time you visit.
   → https://app.socialstats.app/u/settings/security
2. **Enable two-factor authentication** if you haven't already. We strongly
   recommend it for every admin user.
   → https://app.socialstats.app/u/settings/security
3. **Review your API keys.** Revoke any you don't recognise.
   → https://app.socialstats.app/u/settings/api-keys
4. **Review activity logs.** If you see something suspicious, contact us.
5. {{ situation_specific_action — e.g. rotate the OAuth tokens for Meta }}

## How to contact us

- **Email:** privacy@socialstats.app (encrypted: pgp-key.asc on our security page)
- **Status page:** https://status.socialstats.app
- **Security advisory:** {{ url_to_full_writeup }}
- **Phone (urgent):** {{ phone }} — Mon-Fri 9-19 IST

We are deeply sorry for the disruption and concern this causes. Your trust is
the foundation of our business, and this incident reminds us that we must
keep raising the bar.

—

{{ ceo_signature }}
{{ ceo_name }}, CEO
Social Stats

---

*This notification is sent under DPDP Act §8(6) / GDPR Art.34 / CCPA §1798.82
where applicable. Reference number: {{ incident.reference_number }}*
