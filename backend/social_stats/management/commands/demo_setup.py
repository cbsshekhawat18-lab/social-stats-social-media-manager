# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
python manage.py demo_setup

One-shot setup for a public-demo or local-evaluation environment:
  1. Creates 3 named demo accounts with documented credentials
       admin@demo.local      / demo  → superadmin
       agency@demo.local     / demo  → agency-member client
       enduser@demo.local    / demo  → end-user client
  2. Creates an Agency for the agency member to own
  3. Creates a Client workspace for the end user
  4. Optionally chains into seed_demo_data to populate 90 days of metrics
     so the analytics dashboards aren't empty (--no-metrics to skip)

Safe to run multiple times — idempotent on the user / agency / workspace
records. Existing accounts keep their existing passwords (so re-running
won't reset a password the operator changed). Pass --reset to force.

These are local-only demo credentials. NEVER deploy this command's output
to a real environment.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.core.management import call_command
from django.utils import timezone


DEMO_PASSWORD = 'demo'

DEMO_ACCOUNTS = [
    {
        'role':         'superadmin',
        'account_type': 'legacy',           # superadmin sits outside the end-user / agency split
        'email':        'admin@demo.local',
        'first':        'Demo',
        'last':         'Admin',
    },
    {
        'role':         'client',
        'account_type': 'agency_member',
        'email':        'agency@demo.local',
        'first':        'Demo',
        'last':         'Agency',
    },
    {
        'role':         'client',
        'account_type': 'end_user',
        'email':        'enduser@demo.local',
        'first':        'Demo',
        'last':         'User',
    },
]


class Command(BaseCommand):
    help = 'Create 3 demo accounts (admin / agency / end-user) for local-only evaluation.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true',
            help='Reset password on existing demo accounts (default: leave alone).',
        )
        parser.add_argument(
            '--no-metrics', action='store_true',
            help='Skip the seed_demo_data call (faster; analytics dashboards will be empty).',
        )

    def handle(self, *args, **options):
        from social_stats.models import UserProfile, Client, Agency, AgencyMembership

        reset = options['reset']

        agency_user = end_user = None

        # ── 1. Users + profiles ───────────────────────────────────────────
        for spec in DEMO_ACCOUNTS:
            existing = User.objects.filter(username=spec['email']).first()
            if existing:
                if reset:
                    existing.set_password(DEMO_PASSWORD)
                    existing.save(update_fields=['password'])
                    self.stdout.write(f'  reset password   {spec["email"]}')
                else:
                    self.stdout.write(f'  exists (kept)    {spec["email"]}')
                user = existing
            else:
                user = User.objects.create_user(
                    username=spec['email'], email=spec['email'],
                    password=DEMO_PASSWORD,
                    first_name=spec['first'], last_name=spec['last'],
                    is_active=True,
                    is_staff=(spec['role'] == 'superadmin'),
                    is_superuser=(spec['role'] == 'superadmin'),
                )
                UserProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        'role':         spec['role'],
                        'account_type': spec['account_type'],
                    },
                )
                self.stdout.write(self.style.SUCCESS(f'  created          {spec["email"]}'))

            # Demo accounts must have Terms accepted so they can log in straight
            # away (login enforces ToS acceptance). Idempotent for existing rows.
            profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={'role': spec['role'], 'account_type': spec['account_type']},
            )
            if not profile.terms_accepted:
                profile.terms_accepted = True
                profile.terms_accepted_at = timezone.now()
                profile.save(update_fields=['terms_accepted', 'terms_accepted_at'])

            if spec['account_type'] == 'agency_member':
                agency_user = user
            elif spec['account_type'] == 'end_user':
                end_user = user

        # ── 2. Agency + membership for the agency user ────────────────────
        agency, _ = Agency.objects.get_or_create(
            slug='demo-agency',
            defaults={
                'name':                       'Demo Agency',
                'owner_user':                 agency_user,
                'description':                'A sample agency workspace for local evaluation.',
                'location_city':              'Demo City',
                'location_country':           'XX',
                'is_verified':                False,
                'is_listed_in_marketplace':   False,
                'plan':                       'starter',
                'is_active':                  True,
            },
        )
        AgencyMembership.objects.get_or_create(
            agency=agency, user=agency_user,
            defaults={'role': 'owner', 'is_active': True},
        )
        if agency_user.profile.primary_agency_id != agency.id:
            agency_user.profile.primary_agency = agency
            agency_user.profile.save(update_fields=['primary_agency'])

        # ── 3. End-user workspace ─────────────────────────────────────────
        end_user_client, _ = Client.objects.get_or_create(
            email=end_user.email,
            defaults={
                'name':                'Demo User',
                'company':             'Demo Personal Workspace',
                'onboarding_complete': True,
            },
        )
        if end_user.profile.client_id != end_user_client.id:
            end_user.profile.client = end_user_client
            end_user.profile.default_workspace = end_user_client
            end_user.profile.save(update_fields=['client', 'default_workspace'])

        # ── 4. Sample data (optional) ─────────────────────────────────────
        if not options['no_metrics']:
            self.stdout.write('  seeding metrics  (90 days across all clients)…')
            try:
                call_command('seed_demo_data', days=90, verbosity=0)
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  seed_demo_data failed: {e}'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Demo accounts ready. Sign in at /login with:'))
        self.stdout.write('')
        for spec in DEMO_ACCOUNTS:
            label = spec['account_type'].replace('_', ' ').title()
            self.stdout.write(f'  {label:<14}  {spec["email"]:<25}  password: {DEMO_PASSWORD}')
        self.stdout.write('')
        self.stdout.write('These are local demo credentials. Do NOT use in production.')
