# Connect WhatsApp Business

Social Stats integrates WhatsApp Business through the **Pinbot Partners API v3**.
Everything below comes from
[`whatsapp_service.py`](../backend/social_stats/whatsapp_service.py),
[`whatsapp_webhook_views.py`](../backend/social_stats/whatsapp_webhook_views.py),
[`whatsapp_tasks.py`](../backend/social_stats/whatsapp_tasks.py),
[`urls.py`](../backend/social_stats/urls.py), and
[`.env.example`](../backend/.env.example).

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
- **POST events**: requires the `X-Webhook-Secret` header (or a `?secret=` query
  param) to equal `WHATSAPP_WEBHOOK_SECRET`. If the secret is unset or wrong, the
  call is rejected with `403`.

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

![Click-to-WhatsApp flow editor](images/bot-builder.png)

## Going live

WhatsApp Business has its own approvals — display-name approval, message-template
approval, and messaging tier limits. See [GOING_LIVE.md](GOING_LIVE.md#whatsapp).
