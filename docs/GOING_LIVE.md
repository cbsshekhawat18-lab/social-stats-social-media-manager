# Going Live — Platform App Review & Production Checklist

To move from the Manual Setup wizard (users paste their own tokens) to **Quick
Connect** (one-click OAuth for your users), each platform must approve your
developer app for the scopes the code requests. This page lists those exact
scopes and the official review process for each platform.

> Until your apps are approved, keep `OAUTH_APPS_APPROVED=False` — users connect
> via the Manual Setup wizard, which needs no app review.

## The exact scopes you're applying for

These are the scopes Social Stats requests in code — apply for exactly these:

| Platform | Scopes (Quick Connect) |
|---|---|
| **Meta (Facebook/Instagram)** | `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `instagram_manage_insights`, `read_insights` |
| **Google — YouTube** | `youtube.readonly`, `yt-analytics.readonly`, `openid`, `email`, `profile` |
| **Google — Business Profile** | `business.manage`, `openid`, `email`, `profile` |
| **LinkedIn** | `openid`, `profile`, `email` (OIDC). Org analytics (`r_organization_social`, `rw_organization_admin`) require Marketing Developer Platform approval. |

---

## Meta (Facebook + Instagram)

1. **App Review for Advanced Access** on each permission above. Standard Access
   only works for users with a role on the app; Advanced Access is required for
   the public. Submit screencasts showing how each permission is used.
   - Docs: https://developers.facebook.com/docs/app-review
2. **Business Verification** of your Meta Business account.
   - Docs: https://www.facebook.com/business/help/2058515294227817
3. **Switch the app from Development to Live** (App Dashboard → top toggle).
4. **Privacy Policy URL** and **Data Deletion** are required. Social Stats already
   exposes the callbacks:
   - Data deletion callback: `/api/meta/data-deletion-callback/`
   - Deauthorize callback: `/api/meta/deauth-callback/`
   - A user-facing privacy policy + data-deletion page also ship in the app.

## Google (YouTube + Business Profile)

1. **OAuth consent screen verification** (APIs & Services → OAuth consent screen).
   - Docs: https://support.google.com/cloud/answer/9110914
2. **Sensitive / restricted scopes.** `youtube.readonly` and `yt-analytics.readonly`
   are *sensitive*; `business.manage` is *restricted*. Restricted scopes can
   trigger a **third-party security assessment** (CASA) in addition to brand
   verification.
   - Scopes overview: https://developers.google.com/identity/protocols/oauth2/scopes
   - Verification FAQ: https://support.google.com/cloud/answer/9110914
3. **Verified domain + branding** (app name, logo, homepage, privacy policy on a
   domain you've verified in Search Console).
4. Add `/api/oauth/google/callback/` (HTTPS, your domain) as an authorized
   redirect URI on the production OAuth client.

## LinkedIn

1. **Request the Marketing Developer Platform product** on your app (Products tab).
   This unlocks organization-level analytics scopes beyond the OIDC defaults.
   - Docs: https://learn.microsoft.com/en-us/linkedin/marketing/
2. Complete the product's review/questionnaire; approval typically takes a few days.
3. Add `/api/oauth/linkedin/callback/` (HTTPS) as an authorized redirect URL.

## WhatsApp (Pinbot / WABA)

1. **Display-name approval** for each WABA phone number.
2. **Message-template approval** — template (HSM) messages must be approved before
   you can send them for notifications/marketing.
3. **Messaging tier limits** — new numbers start at a low daily unique-recipient
   tier that scales up with quality and volume.
   - WhatsApp Business Platform docs: https://developers.facebook.com/docs/whatsapp
   - (Provisioning is done through your Pinbot Partners dashboard.)

---

## Production environment checklist

- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` set to your real domain(s)
- [ ] `DATABASE_URL` points at PostgreSQL (not SQLite)
- [ ] `FIELD_ENCRYPTION_KEYS` set to a real Fernet key (stored in a secrets manager)
- [ ] `SECRET_KEY` set to a strong random value
- [ ] `FRONTEND_URL` set to your HTTPS domain
- [ ] All `*_REDIRECT_URI` values use **HTTPS** + your domain and match the
      platform app settings exactly
- [ ] `ANTHROPIC_API_KEY` set (if using AI)
- [ ] WhatsApp: `WHATSAPP_ENCRYPTION_KEY` + `WHATSAPP_WEBHOOK_SECRET` set; webhook
      URL registered in Pinbot
- [ ] Redis reachable; Celery **worker** + **beat** running
- [ ] **Flip `OAUTH_APPS_APPROVED=True`** only after Meta/Google/LinkedIn approve
      your apps
- [ ] Privacy policy + data-deletion pages reachable (required by Meta/Google)

See [CONFIGURATION.md](CONFIGURATION.md) for how to generate each value.
