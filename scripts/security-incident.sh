#!/usr/bin/env bash
# Stage 15 — on-call security-incident helper.
#
# Wraps the most-used containment + investigation commands so a sleepy
# on-call doesn't have to remember the exact incantation. Read the actions
# below before using — every command is a real production change.
#
# Usage:
#   scripts/security-incident.sh contain --kind session   --user-id 123
#   scripts/security-incident.sh contain --kind api-key   --prefix sk_live_aBc1
#   scripts/security-incident.sh contain --kind cred      --client-id 5 --platform facebook
#   scripts/security-incident.sh contain --kind workspace --client-id 5
#   scripts/security-incident.sh snapshot
#   scripts/security-incident.sh logs --since '2 hours ago'
#   scripts/security-incident.sh audit --user-id 123
#
# Exit codes: 0 ok · 1 user error · 2 environment / system failure
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANAGE="$ROOT/backend/manage.py"

if [[ ! -f "$MANAGE" ]]; then
  echo "FAIL  manage.py not found at $MANAGE — are you in the right repo?"
  exit 2
fi

usage() {
  sed -n '4,20p' "$0" | sed 's/^# *//'
}

require() {
  local name=$1 val=$2
  if [[ -z "$val" ]]; then echo "missing required arg: $name"; usage; exit 1; fi
}

action=${1:-}
shift || true

case "$action" in
  contain)
    kind=""; user_id=""; prefix=""; client_id=""; platform=""
    while [[ $# -gt 0 ]]; do
      case $1 in
        --kind)        kind=$2; shift 2 ;;
        --user-id)     user_id=$2; shift 2 ;;
        --prefix)      prefix=$2; shift 2 ;;
        --client-id)   client_id=$2; shift 2 ;;
        --platform)    platform=$2; shift 2 ;;
        *) echo "unknown flag $1"; usage; exit 1 ;;
      esac
    done
    require '--kind' "$kind"
    case "$kind" in
      session)
        require '--user-id' "$user_id"
        echo ">> Revoking ALL active sessions for user_id=$user_id"
        python "$MANAGE" shell -c "
from social_stats.security.sessions import revoke_session, UserSession
n=0
for s in UserSession.objects.filter(user_id=$user_id, revoked_at__isnull=True):
    revoke_session(s, reason='incident_oncall')
    n += 1
print(f'revoked {n} session(s)')
"
        ;;
      api-key)
        require '--prefix' "$prefix"
        echo ">> Revoking API keys with prefix='$prefix'"
        python "$MANAGE" shell -c "
from django.utils import timezone
from social_stats.models import APIKey
n = APIKey.objects.filter(key_prefix__startswith='$prefix', revoked_at__isnull=True).update(
    is_active=False, revoked_at=timezone.now(), revoke_reason='incident_oncall'
)
print(f'revoked {n} key(s)')
"
        ;;
      cred)
        require '--client-id' "$client_id"
        require '--platform'  "$platform"
        echo ">> Revoking PlatformCredential client=$client_id platform=$platform"
        python "$MANAGE" shell -c "
from django.utils import timezone
from social_stats.models import PlatformCredential
n = PlatformCredential.objects.filter(client_id=$client_id, platform='$platform').update(
    is_active=False, access_token='', refresh_token='',
    expires_at=timezone.now(),
)
print(f'revoked {n} credential(s)')
"
        ;;
      workspace)
        require '--client-id' "$client_id"
        echo ">> Pausing workspace + bot for client_id=$client_id"
        python "$MANAGE" shell -c "
from social_stats.models import Client
n = Client.objects.filter(id=$client_id).update(is_processing_paused=True, bot_enabled=False)
print(f'paused {n} workspace(s)')
"
        ;;
      *)
        echo "unknown --kind $kind. Use: session | api-key | cred | workspace"
        exit 1
        ;;
    esac
    ;;

  snapshot)
    : "${RDS_INSTANCE_ID:?RDS_INSTANCE_ID env var required}"
    : "${AWS_REGION:?AWS_REGION env var required}"
    snap_id="incident-$(date +%Y%m%d-%H%M)"
    echo ">> Creating ad-hoc RDS snapshot: $snap_id"
    aws rds create-db-snapshot \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --db-snapshot-identifier "$snap_id" \
        --region "$AWS_REGION"
    echo "snapshot id: $snap_id  (poll with: aws rds describe-db-snapshots --db-snapshot-identifier $snap_id)"
    ;;

  logs)
    since="2 hours ago"
    while [[ $# -gt 0 ]]; do
      case $1 in --since) since=$2; shift 2 ;; *) shift ;; esac
    done
    out="incident-logs-$(date +%Y%m%d-%H%M).log"
    echo ">> Capturing nginx + gunicorn + Celery logs since '$since' → $out"
    {
      echo "=== nginx ==="
      sudo journalctl -u nginx --since "$since" 2>/dev/null || true
      echo
      echo "=== gunicorn ==="
      sudo journalctl -u gunicorn --since "$since" 2>/dev/null || true
      echo
      echo "=== celery worker ==="
      sudo journalctl -u celery-worker --since "$since" 2>/dev/null || true
      echo
      echo "=== celery beat ==="
      sudo journalctl -u celery-beat --since "$since" 2>/dev/null || true
    } > "$out"
    echo "wrote $out ($(wc -l < "$out") lines)"
    ;;

  audit)
    user_id=""
    ip=""
    while [[ $# -gt 0 ]]; do
      case $1 in
        --user-id) user_id=$2; shift 2 ;;
        --ip)      ip=$2;      shift 2 ;;
        *) shift ;;
      esac
    done
    if [[ -z "$user_id" && -z "$ip" ]]; then
      echo 'usage: audit --user-id <id> | --ip <ip>'; exit 1
    fi
    filter='Q()'
    [[ -n "$user_id" ]] && filter="Q(actor_user_id=$user_id)"
    [[ -n "$ip"      ]] && filter="$filter | Q(actor_ip='$ip')"
    python "$MANAGE" shell -c "
from django.db.models import Q
from social_stats.models import SecurityAuditLog
qs = SecurityAuditLog.objects.filter($filter).order_by('-timestamp')[:200]
for r in qs:
    print(r.timestamp.isoformat(), r.event_type, r.severity, r.success,
          r.actor_ip, r.target_object_type, r.target_object_id, r.description[:80])
"
    ;;

  ""|help|-h|--help) usage ;;
  *) echo "unknown action: $action"; usage; exit 1 ;;
esac
