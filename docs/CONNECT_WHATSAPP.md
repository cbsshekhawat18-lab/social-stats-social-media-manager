---
title: "Connect WhatsApp Business — Messaging, Campaigns & Bots"
description: "Set up the WhatsApp Business module in Social Stats: inbox, contact lists, template campaigns, and the click-to-WhatsApp bot builder."
---

# Connect WhatsApp Business

Each workspace connects **the WhatsApp Business provider it chooses**, with its
own credentials. Nothing is shared between workspaces, and no provider is
built in as the only option.

| Provider | Use it when | What you enter |
|---|---|---|
| **Meta WhatsApp Cloud API** | You have (or will create) your own Meta app. Direct to Meta, no middleman. | Access token, App Secret, WABA ID, Phone Number ID |
| **Pinbot** | You already have a Pinbot Partners account. | API key, WABA ID, Phone Number ID |
| **Other provider (Cloud API compatible)** | Your provider exposes the WhatsApp Cloud API format (`POST {base}/{phone-number-id}/messages`). | Base URL, auth header, API key, WABA ID, Phone Number ID |

Providers with their own message format (Twilio, Gupshup's native API, …) are
not supported by "Other provider" — it only changes the address and the way the
key is sent, not the message format.

The code lives in
[`whatsapp_providers.py`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/social_stats/whatsapp_providers.py) (the provider list),
[`whatsapp_service.py`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/social_stats/whatsapp_service.py) (the API client),
[`whatsapp_webhook_views.py`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/social_stats/whatsapp_webhook_views.py) and
[`whatsapp_tasks.py`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/social_stats/whatsapp_tasks.py).

## 1. Server setup (once per install)

In `backend/.env`:

```
WHATSAPP_ENCRYPTION_KEY=<generate a Fernet key>
WHATSAPP_RATE_LIMIT_PER_SEC=20
BACKEND_PUBLIC_URL=https://YOUR_DOMAIN
```

Generate the encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

- `WHATSAPP_ENCRYPTION_KEY` — encrypts every workspace's API key and App Secret
  at rest. Keep it safe: without it the stored credentials can't be read.
- `WHATSAPP_RATE_LIMIT_PER_SEC` — outbound send cap.
- `BACKEND_PUBLIC_URL` — the public address of the API. It is used to show each
  workspace its webhook URL; if unset, the address of the current request is used.
- `PINBOT_BASE_URL` — only if Pinbot gives you a different API address
  (default `https://partnersv1.pinbot.ai/v3`).
- `META_API_VERSION` — Graph API version used for Meta Cloud API calls.

Provider credentials are **never** put in `.env` or in the repository. Each
workspace enters its own in the app (next step).

## 2. Connect a provider (per workspace)

Open **WhatsApp → Settings**, pick the provider, fill in the fields and press
**Connect**. Then press **Test Connection** — it makes one call to the provider
with the saved key.

### Meta WhatsApp Cloud API

1. At [developers.facebook.com](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
   create a Business app and add the **WhatsApp** product.
2. In Business Settings create a **System User**, give it your WhatsApp account,
   and generate a **permanent access token** with `whatsapp_business_messaging`
   and `whatsapp_business_management`. (The temporary token from the Meta
   quick-start expires in a day.)
3. Copy the **WABA ID** and **Phone Number ID** from WhatsApp → API Setup, and
   the **App Secret** from App settings → Basic.
4. Enter all four in Social Stats.

### Pinbot

Enter the **API key** from your Pinbot dashboard with the WABA ID and Phone
Number ID.

### Other provider

Enter the provider's **base URL** (https only) and how it expects the key:

| Provider says | Auth header | Auth scheme |
|---|---|---|
| `Authorization: Bearer <key>` | `Authorization` | `Bearer` |
| `apikey: <key>` | `apikey` | *(blank)* |
| `D360-API-KEY: <key>` | `D360-API-KEY` | *(blank)* |

Messages are sent to `{base URL}/{phone number ID}/messages`. The base URL
must be a public https address — private and internal addresses are refused.

### How credentials are handled

- The API key and App Secret are stored encrypted and are **never returned**
  by the API or shown again in the UI (only "saved").
- A saved key is only ever sent to the endpoint it was entered for. Switching
  provider, or changing a custom base URL, requires typing the key again.
- API calls never follow redirects.

## 3. Register the webhook (per workspace)

After connecting, the Settings page shows that workspace's own **Callback URL**
and **Verify token**:

```
https://YOUR_DOMAIN/api/whatsapp/webhook/<key>/
```

(Local dev: expose port 8000 through a tunnel like ngrok / Cloudflare Tunnel
and set `BACKEND_PUBLIC_URL` to the tunnel address.)

- **Meta Cloud API** — in your Meta app open WhatsApp → Configuration, paste the
  Callback URL and Verify token, then subscribe to the **messages** field.
  Every delivery must carry a valid `X-Hub-Signature-256` made with your App
  Secret; anything else is rejected with `403`.
- **Pinbot / other providers** — set the Callback URL as the webhook and add the
  header `X-Webhook-Secret: <verify token>`. Deliveries without it are rejected
  with `403`. (If you saved a *webhook signing secret* for a custom provider,
  the `X-Hub-Signature-256` check is used instead.)

Secrets are only accepted in headers, never as a `?secret=` query parameter (it
would leak into access logs). **New token** on the Settings page replaces the
verify token at once — update the provider afterwards.

What arrives on a workspace's webhook is processed **for that workspace only**:
an event naming another phone number is ignored, and delivery receipts only
update that workspace's messages.

Valid events are logged (`WhatsAppWebhookLog`) and processed asynchronously by the
`process_whatsapp_webhook` Celery task — so the **Celery worker must be running**
for inbound messages and delivery/read receipts to be handled.

### The older shared webhook

Installs that registered `https://YOUR_DOMAIN/api/whatsapp/webhook/` (no key)
with Pinbot keep working: that endpoint still checks `X-Webhook-Secret` /
`hub.verify_token` against `WHATSAPP_WEBHOOK_SECRET` and finds the workspace by
phone number ID. New connections should use the per-workspace URL.

## 4. Upgrading an existing Pinbot install

Run `migrate`. Existing accounts become provider **Pinbot** with the same key,
and each gets a webhook URL and verify token. Nothing has to be re-entered, and
the shared webhook above continues to work.

## 5. Test sending & receiving

1. Make sure **Redis** and the **Celery worker** are running (see
   [GETTING_STARTED.md](GETTING_STARTED.md)).
2. Send a test message from the WhatsApp dashboard (`/api/whatsapp/...`).
3. Reply from a real WhatsApp number → your provider calls the webhook → the
   message appears in the WhatsApp inbox.

## 6. Bots & Click-to-WhatsApp (CTWA)

Once an account is connected, the **bot builder** (visual flow editor with
conditional branches and AI chat nodes) drives automated conversations. Inbound
messages that hit the webhook are routed into the bot engine; lead-capture nodes
push contacts to the CRM. Click-to-WhatsApp ad campaigns land users into the same
flows. See the [User Guide](USER_GUIDE.md#whatsapp-bot-builder) for building a flow.

### What you need running

Bots depend on the **Celery worker and beat**, not just the web process:

| Task | Runs | Without it |
|---|---|---|
| `resume_bot_conversation` | after a **Wait** node | flows stop at the wait |
| `ask_node_timeout` | after an answer timeout | no reminders, no `timeout` branch |
| `mark_abandoned_bot_conversations` | every 15 minutes (beat) | idle conversations stay "active" until the contact writes again |
| `dispatch_webhook` | Webhook / Push to CRM nodes | nothing is delivered |

The Docker stack starts both. `migrate` must have been run (it adds flow
versions, the knowledge base, and recomputes flow completion counts).

### The 24-hour rule

WhatsApp only delivers **free-form** messages (text, media, buttons, lists, AI
replies) within 24 hours of the contact's last message. The engine checks this
before every send:

- Inside the window: the message is sent normally.
- Outside it: the node's **fallback template** is sent instead, if you set one
  in the node's inspector. Otherwise the conversation ends as *failed* with
  `outside_24h_window` in its log.
- **Send Template** nodes are always allowed.

This mostly matters after a long **Wait** and for answer-timeout reminders. The
validator warns when a wait over 24 hours isn't followed by a template.
A **Test** run from the editor is held to the same rule: message your WhatsApp
number from the test phone first.

### Publishing, versions and validation

- **Publish** validates the flow first. Errors (no Start node, unreachable
  nodes, more than 3 buttons, a 20+ character button title, more than 10 list
  rows, a body over 1024 characters, a condition without both outputs…) block
  publishing and are outlined on the canvas; warnings don't block.
- Each publish saves a **version**. A conversation runs on the version that
  was live when it started, so **editing a live flow changes nothing for
  customers until you publish again**. *Live vN* in the editor lists versions
  and restores one.

### Behaviour worth knowing

- **Business hours** (flow settings): outside the configured hours the flow
  doesn't start; the out-of-hours message is sent at most once an hour per
  contact. Times are in the flow's timezone (default `Asia/Kolkata`).
- **Unexpected answers** to buttons, lists and conditions: connect the node's
  **no match** output, or turn on *AI fallback* for the flow — the AI answers
  once in your fallback persona and the question is asked again.
- **Retries**: ask nodes re-prompt up to *Max retries* (default 3), then take
  the **invalid** output → a Human Handoff node if the flow has one → fail.
- **Answer timeout**: *If there's no answer after N minutes* sends the
  reminder once, then follows the **timeout** output.
- **Abandonment**: a conversation idle longer than *Mark abandoned after*
  (Bot Safety, default 1440 minutes) is closed. A click on an ad or referral
  link for a *different* flow also closes the running conversation and starts
  the new flow.
- **Handoff** goes to the assigned staff member with the fewest open handoffs
  (round-robin on ties).
- **Duplicate webhooks** are ignored: each WhatsApp message id is processed once.

### AI nodes

All AI nodes need `ANTHROPIC_API_KEY` and count against the workspace's AI limits.

| Node | What it does |
|---|---|
| **AI Chat** | Free conversation in your persona. Tick *Answer only from the knowledge base* to restrict it to **Conversational AI → Knowledge base** documents; if nothing matches, it says so and offers a teammate. |
| **AI Extract** | Reads what the customer already wrote and fills variables (string, number, boolean, email, phone, date). Outputs: **complete** / **missing** (`{{missing_fields}}` lists what's missing). |
| **AI Intent** | Classifies the last message into one of your intents; one output per intent, plus **other**. |

Replies follow the customer's language — English, Hindi or Hinglish — detected
from their first typed message. If an AI call fails, the conversation carries
on (*missing* / *other* / the question is repeated) rather than failing.

Knowledge search is keyword-based, with typo tolerance on PostgreSQL when the
`pg_trgm` extension is available (`migrate` tries to enable it; if your
database role can't create extensions, ask your DBA to run
`CREATE EXTENSION pg_trgm;` — everything else works without it).

### Other nodes added

- **Add to List** — adds the contact to a WhatsApp contact list (created if needed).
- **Push to CRM** — POSTs a flat JSON object built from your field mapping to
  your CRM's endpoint, with retries. Header values (API keys) are never written
  to conversation logs.

### Analytics

**Flow analytics** shows, per step, how many conversations entered it, went on,
are waiting, or dropped off — and for linked CTWA campaigns the funnel
ad click → conversation → lead → converted with **cost per lead** (spend is
synced from Meta on the campaign page).


## Going live

WhatsApp Business has its own approvals — display-name approval, message-template
approval, and messaging tier limits. See [GOING_LIVE.md](GOING_LIVE.md#whatsapp).
