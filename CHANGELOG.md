# Changelog

## [Unreleased]

### Changed — Social Stats is now free & open source (MIT)

Payments and paid plans were removed; the product is free and self-hostable
under the MIT License (Copyright © 2026 Chandrabhan Shekhawat — Gigai Kripa
Services).

**Removed**
- Razorpay billing integration: checkout/confirm/cancel/invoice/webhook
  endpoints (`billing_views.py`) and their routes; the Razorpay healthcheck.
- Frontend Pricing page, Agency/End-user billing pages, Refund Policy page, the
  billing API client, pricing teasers, and the Razorpay integration card.
- "Billing"/"Agency billing" navigation entries and the billing notification
  event.

**Changed**
- All plan quotas are now unlimited for both account types (`end_user` and
  `agency_member`); `usage_limits` checks always allow. Role separation
  (end-user vs agency vs superadmin) is unchanged.
- Legal pages drop the payment processor (Razorpay) from sub-processor/cookie
  lists; the operator is now "Gigai Kripa Services".

**Database (legacy / unused)**
- The billing models (`Subscription`, `Invoice`) and **all historical
  migrations are kept as-is** — no tables were dropped. These tables are now
  **unused/legacy** inert storage; the app still `migrate`s cleanly from an
  empty database. Migration `0064_rename_gateway_fields` renames the former
  `razorpay_*` columns to neutral `gateway_*` names (a pure column rename — no
  data loss). They may be removed in a future migration if desired.
