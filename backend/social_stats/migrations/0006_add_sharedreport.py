import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('social_stats', '0005_add_weeklytoppost'),
    ]

    operations = [
        migrations.CreateModel(
            name='SharedReport',
            fields=[
                ('id',           models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token',        models.UUIDField(default=uuid.uuid4, unique=True, editable=False)),
                ('date_from',    models.DateField()),
                ('date_until',   models.DateField()),
                ('platforms',    models.JSONField(default=list)),
                ('is_password_protected', models.BooleanField(default=False)),
                ('password_hash',         models.CharField(blank=True, max_length=128)),
                ('expires_at',   models.DateTimeField(blank=True, null=True)),
                ('view_count',   models.PositiveIntegerField(default=0)),
                ('last_viewed_at', models.DateTimeField(blank=True, null=True)),
                ('is_active',    models.BooleanField(default=True)),
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('client',       models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shared_reports', to='social_stats.client')),
                ('created_by',   models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
