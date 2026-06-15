#!/usr/bin/env bash
# Stage 14 — backup health check.
#
# Confirms:
#   1. RDS daily snapshot exists from the last 26h
#   2. Snapshot is encrypted (KMS-managed)
#   3. Cross-region replica exists (if configured)
#   4. S3 backup bucket has objects from the last 26h (for media)
#
# Exit codes:
#   0 — all checks pass
#   1 — at least one check fails
#   2 — environment misconfigured (missing env / aws CLI)
#
# Wire to a daily Celery beat OR to a Cloudflare Worker / Lambda that pages
# on failure. Don't run as a Django mgmt cmd — keep it independent so DB
# down doesn't block the alarm.

set -euo pipefail

: "${AWS_REGION:?AWS_REGION env var required}"
: "${RDS_INSTANCE_ID:?RDS_INSTANCE_ID env var required}"
: "${BACKUP_S3_BUCKET:=}"          # optional — only checked if set
: "${REPLICA_REGION:=}"            # optional — cross-region replica

if ! command -v aws >/dev/null 2>&1; then
  echo "FAIL  aws CLI not found"; exit 2
fi

CUTOFF_ISO=$(date -u -v-26H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || \
             date -u -d "26 hours ago" +"%Y-%m-%dT%H:%M:%SZ")

failures=0
note() { echo "  $*"; }
pass() { echo "OK    $*"; }
fail() { echo "FAIL  $*"; failures=$((failures+1)); }

# ── 1. RDS snapshot from the last 26h ─────────────────────────────────────
echo "[1/4] RDS automated snapshot"
LATEST=$(aws rds describe-db-snapshots \
            --db-instance-identifier "$RDS_INSTANCE_ID" \
            --snapshot-type automated \
            --region "$AWS_REGION" \
            --query 'reverse(sort_by(DBSnapshots,&SnapshotCreateTime))|[0]' \
            --output json 2>/dev/null || echo '{}')

CREATED=$(echo "$LATEST" | grep -o '"SnapshotCreateTime"[^,]*' | head -1)
ENCRYPTED=$(echo "$LATEST" | grep -o '"Encrypted"[[:space:]]*:[[:space:]]*\(true\|false\)' | head -1)

if [[ -z "$CREATED" ]]; then
  fail "No automated snapshot found for $RDS_INSTANCE_ID"
elif [[ "$CREATED" < "\"SnapshotCreateTime\": \"$CUTOFF_ISO" ]]; then
  fail "Latest snapshot older than 26h: $CREATED"
else
  pass "Latest snapshot: $CREATED"
fi

if [[ "$ENCRYPTED" != *"true"* ]]; then
  fail "Latest snapshot is NOT encrypted (Stage 14 requires KMS-encrypted backups)"
else
  pass "Snapshot is encrypted"
fi

# ── 2. Cross-region replica (optional) ────────────────────────────────────
if [[ -n "$REPLICA_REGION" ]]; then
  echo "[2/4] Cross-region replica in $REPLICA_REGION"
  REPLICA=$(aws rds describe-db-instances \
              --region "$REPLICA_REGION" \
              --query "DBInstances[?contains(DBInstanceIdentifier,'$RDS_INSTANCE_ID')].DBInstanceIdentifier" \
              --output text 2>/dev/null || true)
  if [[ -z "$REPLICA" ]]; then
    fail "No cross-region replica found in $REPLICA_REGION"
  else
    pass "Cross-region replica: $REPLICA"
  fi
else
  note "[2/4] REPLICA_REGION unset — skipping"
fi

# ── 3. S3 media backup (optional) ─────────────────────────────────────────
if [[ -n "$BACKUP_S3_BUCKET" ]]; then
  echo "[3/4] S3 media backup objects"
  RECENT=$(aws s3api list-objects-v2 \
             --bucket "$BACKUP_S3_BUCKET" \
             --query "Contents[?LastModified>='$CUTOFF_ISO']|length(@)" \
             --output text 2>/dev/null || echo "0")
  if [[ "${RECENT:-0}" -lt 1 ]]; then
    fail "No fresh objects (< 26h) in s3://$BACKUP_S3_BUCKET"
  else
    pass "$RECENT fresh object(s) in s3://$BACKUP_S3_BUCKET"
  fi
else
  note "[3/4] BACKUP_S3_BUCKET unset — skipping"
fi

# ── 4. KMS key health ─────────────────────────────────────────────────────
echo "[4/4] KMS key for backups"
KEY_STATE=$(aws kms describe-key --key-id alias/socialstats-backups \
              --region "$AWS_REGION" \
              --query 'KeyMetadata.KeyState' --output text 2>/dev/null || echo "missing")
if [[ "$KEY_STATE" != "Enabled" ]]; then
  fail "KMS key alias/socialstats-backups state=$KEY_STATE (need Enabled)"
else
  pass "KMS key alias/socialstats-backups Enabled"
fi

echo
if (( failures > 0 )); then
  echo "RESULT  $failures check(s) failed"
  exit 1
fi
echo "RESULT  all checks pass"
