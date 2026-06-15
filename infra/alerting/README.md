# Alerting + monitoring config

Stage 15. Drop-in templates for Sentry, PagerDuty, and Slack — adapt the
DSNs / channel names, then wire to ops.

The runtime side already exists:
- Stage 8 [`SecurityAuditLog`](backend/social_stats/security/audit.py) is the
  source of truth for security-relevant events.
- The hourly `detect_security_anomalies` Celery task already emits
  `suspicious_login` rows for `failed-login spike per user` (severity=warning)
  and `failed-login spike per IP` (severity=critical).

What this directory adds is the **routing**: how a `severity=critical` row in
`SecurityAuditLog` becomes a phone call at 3am.

---

## Sentry — Django SDK config

Append to `backend/dashboard/settings.py` once `SENTRY_DSN` is set in env:

```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

if os.environ.get('SENTRY_DSN'):
    sentry_sdk.init(
        dsn=os.environ['SENTRY_DSN'],
        environment=os.environ.get('SENTRY_ENV', 'production'),
        release=os.environ.get('GIT_SHA', 'unknown')[:12],
        integrations=[
            DjangoIntegration(transaction_style='url'),
            CeleryIntegration(monitor_beat_tasks=True),
        ],
        # Sample rates — adjust per traffic
        traces_sample_rate=0.05,            # 5% of requests
        profiles_sample_rate=0.05,
        send_default_pii=False,             # NEVER ship user PII to Sentry
        before_send=lambda event, hint: _scrub(event),
    )

def _scrub(event):
    # Drop request bodies (Stage 8 sanitiser already redacts; belt-and-braces)
    if event.get('request') and event['request'].get('data'):
        event['request']['data'] = '[REDACTED]'
    if event.get('request') and event['request'].get('cookies'):
        event['request']['cookies'] = '[REDACTED]'
    return event
```

`send_default_pii=False` is mandatory — without it Sentry pulls user emails
from `request.user`, which is a DPDP / GDPR liability.

## Sentry — alert rules (UI-side)

Configure in the Sentry dashboard:

| Trigger | Action |
|---|---|
| Error count > 50 in 10 min | PagerDuty (P1) |
| New issue (`first_seen`) on `social_stats.security.*` | Slack `#security` |
| Issue `tags.severity == 'critical'` | PagerDuty (P1) + Slack |
| Performance regression > 20% on `/api/auth/*` | Slack `#perf` |

## PagerDuty — service + escalation

```yaml
# Wire the Sentry → PagerDuty integration via webhook URL.
# Escalation policy:
service: socialstats-prod
escalation_policy:
  - tier_1:
      target: on-call rotation
      ack_within: 5 min
  - tier_2:
      target: head of engineering
      escalate_after: 10 min
  - tier_3:
      target: CEO (SEV-1 only)
      escalate_after: 20 min

# Schedules:
schedules:
  - name: weekday-business-hours
    timezone: Asia/Kolkata
    layers:
      - users: [eng-1, eng-2]
        rotation: weekly
  - name: nights-weekends
    timezone: Asia/Kolkata
    layers:
      - users: [eng-1, eng-2, eng-3]
        rotation: weekly
```

## Slack — channels + webhooks

| Channel | Purpose | Audience |
|---|---|---|
| `#alerts` | All warning+ alerts | Eng team |
| `#security` | Stage 8 SecurityAuditLog `severity >= warning` | Eng + DPO |
| `#incidents` | Active SEV-1 / SEV-2 war rooms | Eng + leadership |
| `#status-public` | Mirror of public status page updates | All-hands |

Webhook env vars (don't commit):
```
SLACK_WEBHOOK_ALERTS=https://hooks.slack.com/services/T../B../...
SLACK_WEBHOOK_SECURITY=https://hooks.slack.com/services/T../B../...
```

## Wiring SecurityAuditLog → Slack

Add to `social_stats/security/tasks.py` after Stage 15 review (kept out of
Stage 8 to avoid hard-coding ops decisions):

```python
@shared_task(ignore_result=True)
def push_critical_audit_to_slack():
    """Beat: every 5 min, ship NEW severity='critical' rows to Slack."""
    import requests
    from django.conf import settings
    from django.core.cache import cache
    from .audit import SecurityAuditLog

    webhook = getattr(settings, 'SLACK_WEBHOOK_SECURITY', '')
    if not webhook:
        return

    last_id = cache.get('audit_slack_last_id') or 0
    rows = (SecurityAuditLog.objects
            .filter(id__gt=last_id, severity='critical')
            .order_by('id')[:20])
    sent = 0
    for r in rows:
        text = (f':rotating_light: *{r.event_type}* '
                f'({r.severity}) actor=`{r.actor_user_id or r.actor_ip}` '
                f'at {r.timestamp:%Y-%m-%d %H:%M UTC}\n'
                f'> {r.description[:200]}')
        try:
            requests.post(webhook, json={'text': text}, timeout=4)
            sent += 1
            cache.set('audit_slack_last_id', r.id, timeout=86400)
        except Exception:
            break
    return {'sent': sent}
```

Beat schedule:
```python
'security-critical-audit-to-slack-5min': {
    'task': 'social_stats.security.tasks.push_critical_audit_to_slack',
    'schedule': crontab(minute='*/5'),
}
```

## Status page

Use Statuspage.io / Better Uptime / Instatus. The integration:

1. Public URL: `https://status.socialstats.app`
2. Components mirror our internal services: API · WhatsApp · AI · Composer
3. Subscriber list: opt-in (CCPA-friendly)
4. Incident automation: when an IC posts in `#incidents`, a Slack bot creates
   the matching status-page incident (Slack → Statuspage webhook).

Manual update via `curl`:
```bash
curl -X POST -H "Authorization: OAuth $STATUSPAGE_TOKEN" \
  https://api.statuspage.io/v1/pages/$PAGE_ID/incidents \
  -d 'incident[name]=API degraded' \
  -d 'incident[status]=investigating' \
  -d 'incident[impact]=major' \
  -d 'incident[component_ids][]=$API_COMPONENT_ID'
```

---

*Owners:* sre@socialstats.app · *Last reviewed:* 2024-11-01
