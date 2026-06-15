# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Backfill command for the two-sided marketplace migration .

Run AFTER `python manage.py migrate` for migration 0040_marketplace_foundation.

What this does (idempotent — safe to re-run):

1. UserProfile.account_type:
       legacy users (the default) stay 'legacy' — that's fine. We only flip:
         - role='client'        → 'end_user'      (B2C accounts)
         - role in (superadmin,
                    staff)      → 'agency_member' (works at the agency)
       BUT only if account_type is still 'legacy', so nothing user-set is overwritten.

2. Client.ownership_type / created_via:
       Existing rows default to 'agency_owned' / 'agency_invite' — already correct.
       We additionally backfill `Client.owner_user` for client-role profiles whose
       UserProfile.client points at this row, so end-user-direct-signups get a
       proper owner pointer.

3. Agency creation (the trickiest piece):
       The legacy model used UserProfile.agency (an FK to User) to mark which
       agency-owner manages a given client/staff user. We collect every
       distinct agency-owner User mentioned by either:
           - UserProfile.agency  (per-staff/per-client pointer), OR
           - StaffClientAssignment.assigned_by
       …and create ONE Agency per distinct owner User (slug derived from the
       owner's username/email). The owner User becomes Agency.owner_user and
       gets an AgencyMembership(role='owner').

4. AgencyMembership backfill:
       Every staff/superadmin UserProfile.agency=X → membership in agency-of(X)
       with role='admin' (superadmin) or 'manager' (staff).

5. AgencyClientRelation backfill:
       For every Client whose agency-side users (UserProfile.client OR
       UserProfile.assigned_clients OR StaffClientAssignment) imply an
       agency-of(owner) relationship, create an AgencyClientRelation with
       status='active', initiated_by='agency', and FULL legacy permissions
       (everything True) so existing flows keep working.

6. UserProfile.primary_agency / default_workspace:
       Set primary_agency for agency-side users; set default_workspace for
       end-users to point at their client.

NEVER deletes existing data. Prints a summary at the end.
"""
from __future__ import annotations

import re
from collections import defaultdict

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from social_stats.models import (
    AGENCY_CLIENT_PERMISSIONS,
    Agency,
    AgencyClientRelation,
    AgencyMembership,
    Client,
    StaffClientAssignment,
    UserProfile,
)


def _all_perms_granted():
    """Permission matrix for legacy relations: full access (the legacy default)."""
    return {key: True for key in AGENCY_CLIENT_PERMISSIONS}


def _slug_for_owner(owner: User) -> str:
    base = slugify(
        owner.username or owner.email.split('@')[0] or f'agency-{owner.pk}'
    )[:40] or f'agency-{owner.pk}'
    candidate = base
    n = 2
    while Agency.objects.filter(slug=candidate).exclude(owner_user=owner).exists():
        suffix = f'-{n}'
        candidate = (base[: 50 - len(suffix)] + suffix)
        n += 1
    return candidate


def _agency_name_for(owner: User) -> str:
    full = (owner.get_full_name() or '').strip()
    if full:
        return f"{full}'s Agency"
    if owner.email:
        local = owner.email.split('@')[0]
        return f"{local.title()}'s Agency"
    return f"Agency #{owner.pk}"


class Command(BaseCommand):
    help = 'Backfill marketplace structures for existing data .'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Print what would change without writing anything',
        )

    def handle(self, *args, **opts):
        dry = opts['dry_run']
        stats = defaultdict(int)

        with transaction.atomic():
            # ── 1. UserProfile.account_type ──────────────────────────────────
            for prof in UserProfile.objects.filter(account_type='legacy'):
                if prof.role == 'client':
                    new_type = 'end_user'
                elif prof.role in ('staff', 'superadmin'):
                    new_type = 'agency_member'
                else:
                    continue
                if not dry:
                    prof.account_type = new_type
                    prof.save(update_fields=['account_type'])
                stats[f'profile_account_type_{new_type}'] += 1

            # ── 2. Client.owner_user backfill ───────────────────────────────
            for prof in UserProfile.objects.filter(role='client', client__isnull=False).select_related('client'):
                client = prof.client
                if client.owner_user_id:
                    continue
                if not dry:
                    client.owner_user = prof.user
                    # End-user-owned semantics for self-registered profiles
                    if prof.is_self_registered:
                        client.ownership_type = 'end_user_owned'
                        client.created_via = 'end_user_signup'
                    client.save(update_fields=['owner_user', 'ownership_type', 'created_via'])
                stats['client_owner_backfilled'] += 1

            # ── 3. Distinct agency owners ───────────────────────────────────
            owner_ids = set()
            owner_ids.update(
                UserProfile.objects.exclude(agency__isnull=True).values_list('agency_id', flat=True)
            )
            owner_ids.update(
                StaffClientAssignment.objects.exclude(assigned_by__isnull=True).values_list('assigned_by_id', flat=True)
            )

            agencies_by_owner: dict[int, Agency] = {}
            for owner_id in owner_ids:
                try:
                    owner = User.objects.get(pk=owner_id)
                except User.DoesNotExist:
                    continue

                # Already created?
                existing = Agency.objects.filter(owner_user=owner).first()
                if existing:
                    agencies_by_owner[owner_id] = existing
                    continue

                if dry:
                    stats['agency_would_create'] += 1
                    continue

                agency = Agency.objects.create(
                    name=_agency_name_for(owner),
                    slug=_slug_for_owner(owner),
                    owner_user=owner,
                )
                AgencyMembership.objects.get_or_create(
                    agency=agency, user=owner,
                    defaults={'role': 'owner'},
                )
                agencies_by_owner[owner_id] = agency
                stats['agency_created'] += 1

            # ── 4. AgencyMembership for staff/superadmin → agency_of(owner) ──
            for prof in UserProfile.objects.exclude(agency__isnull=True).select_related('user'):
                agency = agencies_by_owner.get(prof.agency_id)
                if not agency:
                    continue
                role = 'admin' if prof.role == 'superadmin' else (
                    'manager' if prof.role == 'staff' else 'member'
                )
                if dry:
                    stats[f'membership_would_{role}'] += 1
                    continue
                _, created = AgencyMembership.objects.get_or_create(
                    agency=agency, user=prof.user,
                    defaults={'role': role, 'invited_by': prof.agency},
                )
                if created:
                    stats[f'membership_created_{role}'] += 1

                if not prof.primary_agency_id:
                    prof.primary_agency = agency
                    prof.save(update_fields=['primary_agency'])
                    stats['profile_primary_agency_set'] += 1

            # Owners' own profiles need primary_agency too (their agency=NULL on
            # their own profile, so the loop above misses them).
            for agency in agencies_by_owner.values():
                owner_prof = getattr(agency.owner_user, 'profile', None)
                if owner_prof and not owner_prof.primary_agency_id:
                    if dry:
                        stats['owner_primary_agency_would_set'] += 1
                        continue
                    owner_prof.primary_agency = agency
                    owner_prof.save(update_fields=['primary_agency'])
                    stats['owner_primary_agency_set'] += 1

            # ── 5. Default-workspace pointer for end-users ──────────────────
            for prof in UserProfile.objects.filter(account_type='end_user', client__isnull=False, default_workspace__isnull=True):
                if dry:
                    stats['default_workspace_would_set'] += 1
                    continue
                prof.default_workspace = prof.client
                prof.save(update_fields=['default_workspace'])
                stats['default_workspace_set'] += 1

            # ── 6. AgencyClientRelation backfill ────────────────────────────
            # An agency manages a client whenever:
            #   (a) that agency's owner appears in StaffClientAssignment.assigned_by for the client, OR
            #   (b) any UserProfile with agency=<owner> has the client among
            #       assigned_clients or as their direct client.
            agency_client_pairs: set[tuple[int, int]] = set()

            for sca in StaffClientAssignment.objects.exclude(assigned_by__isnull=True):
                ag = agencies_by_owner.get(sca.assigned_by_id)
                if ag:
                    agency_client_pairs.add((ag.id, sca.client_id))

            for prof in UserProfile.objects.exclude(agency__isnull=True):
                ag = agencies_by_owner.get(prof.agency_id)
                if not ag:
                    continue
                if prof.client_id:
                    agency_client_pairs.add((ag.id, prof.client_id))
                for cid in prof.assigned_clients.values_list('id', flat=True):
                    agency_client_pairs.add((ag.id, cid))

            full_perms = _all_perms_granted()
            for ag_id, client_id in agency_client_pairs:
                if dry:
                    stats['relation_would_create'] += 1
                    continue
                _, created = AgencyClientRelation.objects.get_or_create(
                    agency_id=ag_id, client_id=client_id,
                    defaults={
                        'status': 'active',
                        'initiated_by': 'agency',
                        'permissions': full_perms,
                        'requires_approval_for': [],
                        'approved_at': None,  # legacy — never explicitly approved
                    },
                )
                if created:
                    stats['relation_created'] += 1

        # ── Summary ─────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS(
            ('DRY RUN — no changes written\n' if dry else 'Backfill complete.\n')
        ))
        for k in sorted(stats):
            self.stdout.write(f'  {k}: {stats[k]}')
        if not stats:
            self.stdout.write('  (no changes — already migrated)')
