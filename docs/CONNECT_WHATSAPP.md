---
title: "Connect WhatsApp Business — Messaging, Campaigns & Bots"
description: "Set up the WhatsApp Business module in Social Stats: inbox, contact lists, template campaigns, and the click-to-WhatsApp bot builder."
---

# Connect WhatsApp Business

Social Stats integrates WhatsApp Business through the **Pinbot Partners API v3**.
Everything below comes from
[`whatsapp_service.py`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/social_stats/whatsapp_service.py),
[`whatsapp_webhook_views.py`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/social_stats/whatsapp_webhook_views.py),
[`whatsapp_tasks.py`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/social_stats/whatsapp_tasks.py),
[`urls.py`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/social_stats/urls.py), and
[`.env.example`](https://github.com/cbsshekhawat18-lab/social-stats-social-media-manager/blob/main/backend/.env.example).

The integration is **fully dynamic and per-tenant**: each Client provides its own
`phone_number_id` and `waba_id`, and the Pinbot `apikey` is stored encrypted in
the database (`WHATSAPP_ENCRYPTION_KEY`). There are no test numbers hardcoded —
the `PinbotService` takes `api_key`, `phone_number_id`, and `waba_id` as
constructor arguments per call.

## 1. Sign up with the provider

- Create a **Partners account** at **https://pinbot.ai**.
- Provision a **WABA (WhatsApp Business Account)** per Social Stats Client.
- Copy the **apikey** from your Pinbot dashboard.

## 2. Set the environment variables

In `backend/.env`:

```
PINBOT_BASE_URL=https://partnersv1.pinbot.ai/v3
WHATSAPP_ENCRYPTION_KEY=<generate a Fernet key>
WHATSAPP_WEBHOOK_SECRET=<random 32+ char string>
WHATSAPP_RATE_LIMIT_PER_SEC=20
```

Generate the encryption key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

- `PINBOT_BASE_URL` — Pinbot Partners API base (default already correct).
- `WHATSAPP_ENCRYPTION_KEY` — encrypts the stored Pinbot apikey at rest.
- `WHATSAPP_WEBHOOK_SECRET` — verifies inbound webhook calls (see step 4).
- `WHATSAPP_RATE_LIMIT_PER_SEC` — outbound send cap.

## 3. Add the account in-app

Each Client's `apikey`, `phone_number_id`, and `waba_id` are entered through the
WhatsApp account UI (`POST /api/whatsapp/accounts/`). They're stored per-tenant
and encrypted — not in config files.

## 4. Register & verify the webhook

Register this URL in your Pinbot dashboard as the webhook endpoint:

```
https://YOUR_DOMAIN/api/whatsapp/webhook/
```

(Local dev: expose `http://localhost:8000/api/whatsapp/webhook/` via a tunnel
like ngrok/Cloudflare Tunnel.)

The endpoint (`pinbot_webhook`) verifies callers two ways:

- **GET handshake** (Meta-style): returns `hub.challenge` only when
  `hub.verify_token` equals your `WHATSAPP_WEBHOOK_SECRET`; otherwise `403`.
- **POST events**: requires the `X-Webhook-Secret` header to equal
  `WHATSAPP_WEBHOOK_SECRET`. If the secret is unset or wrong, the call is
  rejected with `403`. A `?secret=` query parameter is **not** accepted (it
  would leak into access logs) — if your Pinbot webhook URL still carries one,
  move the value to the header.

So set the **verify token** (GET) and the **secret header** (POST) in Pinbot to
the exact value of `WHATSAPP_WEBHOOK_SECRET`.

Valid events are logged (`WhatsAppWebhookLog`) and processed asynchronously by the
`process_whatsapp_webhook` Celery task — so the **Celery worker must be running**
for inbound messages and delivery/read receipts to be handled.

## 5. Test sending & receiving

1. Make sure **Redis** and the **Celery worker** are running (see
   [GETTING_STARTED.md](GETTING_STARTED.md)).
2. Send a test message from the WhatsApp dashboard (`/api/whatsapp/...`).
3. Reply from a real WhatsApp number → Pinbot calls your webhook → the message
   appears in the WhatsApp inbox.

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
approval, and messaging tier limits. See [GOING_LIVE.md](GOING_LIVE.md#whatsapp-pinbot-waba).
