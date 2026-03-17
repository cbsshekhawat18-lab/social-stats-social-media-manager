"""
python manage.py setup

One-time setup:
  1. Creates a superadmin user
  2. Registers Celery Beat schedules for all 5 platforms
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Initial project setup — creates superadmin + Celery schedules'

    def add_arguments(self, parser):
        parser.add_argument('--email',    default='admin@agency.com')
        parser.add_argument('--password', default='admin123')
        parser.add_argument('--name',     default='Agency Admin')

    def handle(self, *args, **options):
        from social_stats.models import UserProfile

        email    = options['email']
        password = options['password']
        name     = options['name']

        # ── Create superadmin user ─────────────────────────
        if User.objects.filter(email=email).exists():
            self.stdout.write(f'⚠️  User {email} already exists — skipping')
            user = User.objects.get(email=email)
        else:
            user = User.objects.create_superuser(
                username=email, email=email, password=password,
                first_name=name.split()[0],
                last_name=' '.join(name.split()[1:]) if len(name.split())>1 else '',
            )
            UserProfile.objects.get_or_create(user=user, defaults={'role': 'superadmin'})
            self.stdout.write(self.style.SUCCESS(f'✅ Superadmin created: {email} / {password}'))

        # ── Celery Beat schedules ──────────────────────────
        try:
            from django_celery_beat.models import PeriodicTask, IntervalSchedule
            import json

            every_6h,  _ = IntervalSchedule.objects.get_or_create(every=6,  period=IntervalSchedule.HOURS)
            every_12h, _ = IntervalSchedule.objects.get_or_create(every=12, period=IntervalSchedule.HOURS)
            every_24h, _ = IntervalSchedule.objects.get_or_create(every=24, period=IntervalSchedule.HOURS)

            schedules = [
                ('sync-facebook',  'social_stats.tasks.sync_all', every_6h,  ['facebook']),
                ('sync-instagram', 'social_stats.tasks.sync_all', every_6h,  ['instagram']),
                ('sync-youtube',   'social_stats.tasks.sync_all', every_12h, ['youtube']),
                ('sync-linkedin',  'social_stats.tasks.sync_all', every_12h, ['linkedin']),
                ('sync-gmb',       'social_stats.tasks.sync_all', every_24h, ['google_my_business']),
            ]

            for name, task, schedule, args in schedules:
                obj, created = PeriodicTask.objects.update_or_create(
                    name=name,
                    defaults={'task': task, 'interval': schedule, 'args': json.dumps(args), 'enabled': True}
                )
                action = 'Created' if created else 'Updated'
                self.stdout.write(self.style.SUCCESS(
                    f'{action} schedule: {name} → every {schedule.every} {schedule.period}'
                ))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️  Celery schedules skipped: {e}'))

        # ── Seed permissions ───────────────────────────────
        try:
            from social_stats.models import Permission, RolePermission, ALL_PERMISSIONS
            created_count = 0
            for code, label, description, category, is_staff, is_client, sort_order in ALL_PERMISSIONS:
                page = code.split('.')[0]
                perm, created = Permission.objects.update_or_create(
                    code=code,
                    defaults={
                        'label': label,
                        'description': description,
                        'category': category,
                        'page': page,
                        'is_default_staff': is_staff,
                        'is_default_client': is_client,
                        'sort_order': sort_order,
                    }
                )
                if created:
                    created_count += 1
                # Seed role defaults
                if is_staff:
                    RolePermission.objects.get_or_create(role='staff', permission=perm, defaults={'is_granted': True})
                if is_client:
                    RolePermission.objects.get_or_create(role='client', permission=perm, defaults={'is_granted': True})
                # Explicitly create revoked defaults for non-default permissions
                if not is_staff:
                    RolePermission.objects.get_or_create(role='staff', permission=perm, defaults={'is_granted': False})
                if not is_client:
                    RolePermission.objects.get_or_create(role='client', permission=perm, defaults={'is_granted': False})

            self.stdout.write(self.style.SUCCESS(
                f'✅ Seeded {Permission.objects.count()} permissions '
                f'({created_count} new)'
            ))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️  Permission seed skipped: {e}'))

        self.stdout.write('\n' + '='*50)
        self.stdout.write(self.style.SUCCESS('✅ Setup complete!'))
        self.stdout.write(f'\n  Admin login:  {email}')
        self.stdout.write(f'  Password:     {password}')
        self.stdout.write('\nNext steps:')
        self.stdout.write('  1. Fill in .env with your API credentials')
        self.stdout.write('  2. python manage.py runserver')
        self.stdout.write('  3. cd frontend && npm install && npm start')
        self.stdout.write('  4. Open http://localhost:3000')
