# Connect Social Accounts

How to connect each social platform to Social Stats. All redirect URIs, scopes,
and env var names below are taken **directly from the code**
([`oauth_views.py`](../backend/social_stats/oauth_views.py),
[`urls.py`](../backend/social_stats/urls.py),
[`manual_setup_guides.py`](../backend/social_stats/manual_setup_guides.py)).

## Two ways to connect

Social Stats has two connection paths, controlled by the `OAUTH_APPS_APPROVED`
flag (see [CONFIGURATION.md](CONFIGURATION.md)):

1. **Quick Connect (OAuth)** — one-click "Connect" buttons. The app holds a
   single set of developer credentials (your `*_APP_ID` / `*_CLIENT_ID`), and
   users authorize via the platform's consent screen. Enabled only when
   `OAUTH_APPS_APPROVED=True`.
2. **Manual Setup wizard** — when `OAUTH_APPS_APPROVED=False` (the default), the
   Quick Connect buttons show "Coming Soon" and users are routed to a guided
   wizard where they paste their **own** tokens/IDs. This is the path that works
   before your OAuth apps clear platform review.

Either way, **credentials are stored per-tenant (per Client) in the database,
encrypted at rest** (`PlatformCredential` / `ManualCredentialExtras` via
`EncryptedTextField`). Nothing is hardcoded; with an empty `.env` a fresh user
connects their own accounts.

![Settings → Connected Accounts](images/connect-accounts.png)

### Redirect URI base

All OAuth routes are served under `/api/` (the React dev server runs on
`http://localhost:3000`, the API on `http://localhost:8000`). For production,
swap the host for your domain over HTTPS.

---

## Meta (Facebook + Instagram)

### 1. Create the developer app
- Go to **https://developers.facebook.com** → **Create App** → **Business** type.
- Add products: **Facebook Login**, **Pages API**, **Instagram Graph API**.
- **Settings → Basic** → copy **App ID** and **App Secret**.

### 2. Register the redirect URI
In **Facebook Login → Settings**, add the redirect URI used by the code:

```
http://localhost:8000/api/oauth/facebook/callback/
```

(Production: `https://YOUR_DOMAIN/api/oauth/facebook/callback/`. A consumer
variant also exists: `/api/oauth/facebook/consumer/callback/`.)

### 3. Scopes the app requests (Quick Connect)
From `oauth_views.py`:

```
pages_show_list, pages_read_engagement, pages_manage_metadata,
instagram_manage_insights, read_insights
```

### 4. Env vars
```
META_APP_ID=...
META_APP_SECRET=...
META_REDIRECT_URI=http://localhost:8000/api/oauth/facebook/callback/
```

### 5. Manual Setup alternative (no app review needed)
The in-app wizard ([`manual_setup_guides.py`](../backend/social_stats/manual_setup_guides.py))
walks users through generating a **System User Page Access Token** in Meta
Business Suite with these permissions:
`pages_show_list, pages_read_engagement, pages_read_user_content, read_insights,
pages_manage_metadata`. The user pastes their **Page ID** + **Page Access Token**.
Instagram reuses the same Page token plus the **Instagram Business Account ID**
(the IG account must be a Business/Creator account linked to the Page).

---

## Google (YouTube + Google Business Profile)

One OAuth flow covers both APIs; the start endpoint accepts
`?platform=youtube`, `?platform=google_my_business`, or `all` (default).

### 1. Create the developer app
- Go to **https://console.cloud.google.com** → **New Project**.
- **APIs & Services → Library** → enable:
  - **YouTube Data API v3**
  - **YouTube Analytics API**
  - **Business Profile API**
- **APIs & Services → Credentials → Create OAuth 2.0 Client ID** → type **Web application**.

### 2. Register the redirect URI
```
http://localhost:8000/api/oauth/google/callback/
```

### 3. Scopes the app requests (Quick Connect)
From `oauth_views.py` (the flow also requests `access_type=offline` + `prompt=consent`
to obtain a refresh token):

- **YouTube** (`?platform=youtube`):
  ```
  https://www.googleapis.com/auth/youtube.readonly
  https://www.googleapis.com/auth/yt-analytics.readonly
  openid email profile
  ```
- **Google Business Profile** (`?platform=google_my_business`):
  ```
  https://www.googleapis.com/auth/business.manage
  openid email profile
  ```
- **All** (default) combines both sets.

### 4. Env vars
```
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:8000/api/oauth/google/callback/
```

### 5. Manual Setup alternative
The wizard has users create their own Google Cloud project, enable the same APIs,
and generate a **refresh token** via the **Google OAuth Playground**
(`https://developers.google.com/oauthplayground` as the redirect URI). Scopes:
`youtube.readonly` + `yt-analytics.readonly` for YouTube; `business.manage` for
Business Profile. They paste **Channel ID** (YouTube) or **Account ID + Location
ID** (Business Profile), plus their OAuth Client ID/Secret and the refresh token.

> `youtube.readonly`, `yt-analytics.readonly`, and `business.manage` are
> **sensitive/restricted** Google scopes — see [GOING_LIVE.md](GOING_LIVE.md)
> for the consent-screen verification implications.

---

## LinkedIn

### 1. Create the developer app
- Go to **https://www.linkedin.com/developers** → **Create app**.
- Associate it with your **Company Page**.
- **Products** tab → request **Marketing Developer Platform** (approval can take
  a few days).
- **Auth** tab → copy **Client ID** and **Client Secret**.

### 2. Register the redirect URI
```
http://localhost:8000/api/oauth/linkedin/callback/
```

### 3. Scopes the app requests (Quick Connect)
From `oauth_views.py` — **OpenID Connect scopes only**:

```
openid profile email
```

> The code uses OIDC-only scopes on purpose: organization-level analytics
> (`r_organization_social` / `rw_organization_admin`, used in the Manual Setup
> wizard) require **Marketing Developer Platform / Community Management API**
> approval on a dedicated app, and are added back once that approval is granted.

### 4. Env vars
```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_REDIRECT_URI=http://localhost:8000/api/oauth/linkedin/callback/
```

### 5. Manual Setup alternative
The wizard has users generate a **60-day access token** in their LinkedIn app
(scopes `r_organization_social`, `rw_organization_admin`) and paste it with their
**Organization ID**. Social Stats alerts 7 days before the token expires.

---

## What works without real OAuth credentials

| Works without creds | Needs connected accounts |
|---|---|
| Draft composing & scheduling (drafts queue) | Publishing posts to platforms |
| AI captions / replies / insights (needs `ANTHROPIC_API_KEY` only) | Live metric sync / real analytics |
| Preview & marketing pages | Pulling real audience/engagement data |
| Demo data dashboards (`demo_setup`) | Real per-platform reports |

So you can evaluate the whole UI and AI with **zero** platform credentials; you
only need them when you want to publish or pull live data.

See [GOING_LIVE.md](GOING_LIVE.md) for the platform app-review process required
to flip `OAUTH_APPS_APPROVED=True` in production.
