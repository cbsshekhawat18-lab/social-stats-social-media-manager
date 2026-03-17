"""
Management command: python3 manage.py seed_demo_data
Seeds realistic DailyMetric data for the last 90 days for all clients.
Safe to run multiple times (skips existing rows).
"""
import random
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from social_stats.models import Client, DailyMetric


PLATFORMS = ['facebook', 'instagram', 'youtube', 'linkedin', 'google_my_business']

# Base daily numbers per platform
PLATFORM_BASE = {
    'facebook':           dict(impressions=4200,  reach=2800,  clicks=180,  likes=95,   followers=12,  video_views=320),
    'instagram':          dict(impressions=6500,  reach=4100,  clicks=95,   likes=310,  followers=28,  video_views=1100),
    'youtube':            dict(impressions=2100,  reach=1600,  clicks=55,   likes=42,   followers=8,   video_views=3200),
    'linkedin':           dict(impressions=1800,  reach=1200,  clicks=140,  likes=38,   followers=6,   video_views=90),
    'google_my_business': dict(impressions=900,   reach=700,   clicks=210,  likes=5,    followers=2,   video_views=0),
}

def jitter(base, pct=0.35):
    """Return base ± pct% with random noise."""
    lo = int(base * (1 - pct))
    hi = int(base * (1 + pct))
    return max(0, random.randint(lo, hi))

def trend_factor(day_index, total_days, growth=0.3):
    """Slight upward trend over the period."""
    return 1.0 + growth * (day_index / total_days)


class Command(BaseCommand):
    help = 'Seed realistic DailyMetric demo data for the last 90 days'

    def add_arguments(self, parser):
        parser.add_argument('--days',    type=int, default=90,  help='Number of days to seed (default 90)')
        parser.add_argument('--client',  type=int, default=None, help='Seed for a specific client ID only')
        parser.add_argument('--replace', action='store_true',    help='Delete existing rows before seeding')

    def handle(self, *args, **options):
        days     = options['days']
        cid      = options['client']
        replace  = options['replace']

        clients = Client.objects.filter(pk=cid) if cid else Client.objects.filter(is_active=True)

        if not clients.exists():
            self.stderr.write('No clients found.')
            return

        today = date.today()

        for client in clients:
            self.stdout.write(f'\nSeeding {client.company} (id={client.id})…')
            created_total = 0
            skipped_total = 0

            for platform, base in PLATFORM_BASE.items():
                if replace:
                    deleted, _ = DailyMetric.objects.filter(client=client, platform=platform).delete()
                    if deleted:
                        self.stdout.write(f'  Deleted {deleted} existing {platform} rows')

                rows_to_create = []
                for i in range(days):
                    day = today - timedelta(days=(days - 1 - i))
                    tf  = trend_factor(i, days)

                    # Weekend dip for B2B platforms
                    dow = day.weekday()
                    weekend_factor = 0.55 if dow >= 5 and platform == 'linkedin' else 1.0

                    # Skip if already exists
                    if DailyMetric.objects.filter(client=client, platform=platform, date=day).exists():
                        skipped_total += 1
                        continue

                    rows_to_create.append(DailyMetric(
                        client      = client,
                        platform    = platform,
                        date        = day,
                        impressions = int(jitter(base['impressions']) * tf * weekend_factor),
                        reach       = int(jitter(base['reach'])       * tf * weekend_factor),
                        clicks      = int(jitter(base['clicks'])      * tf * weekend_factor),
                        likes       = int(jitter(base['likes'])       * tf),
                        followers   = int(jitter(base['followers'])   * tf),
                        video_views = int(jitter(base['video_views']) * tf),
                        comments    = int(jitter(base['likes'] * 0.1) * tf),
                        shares      = int(jitter(base['likes'] * 0.05)* tf),
                    ))

                if rows_to_create:
                    DailyMetric.objects.bulk_create(rows_to_create)
                    created_total += len(rows_to_create)
                    self.stdout.write(f'  ✓ {platform}: {len(rows_to_create)} rows created')

            self.stdout.write(
                self.style.SUCCESS(
                    f'  Done — {created_total} created, {skipped_total} skipped'
                )
            )

        total = DailyMetric.objects.count()
        self.stdout.write(self.style.SUCCESS(f'\nTotal DailyMetric rows in DB: {total}'))
