# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
WhatsApp: bring-your-own provider.

Adds the provider choice and per-account webhook credentials to
WhatsAppAccount. Existing accounts stay on Pinbot and each gets its own
webhook key + verify token (the shared /api/whatsapp/webhook/ endpoint and
WHATSAPP_WEBHOOK_SECRET keep working for them).
"""
import secrets

from django.db import migrations, models

import social_stats.models


def fill_webhook_credentials(apps, schema_editor):
    WhatsAppAccount = apps.get_model('social_stats', 'WhatsAppAccount')
    for account in WhatsAppAccount.objects.all().only('id'):
        WhatsAppAccount.objects.filter(pk=account.pk).update(
            webhook_key=secrets.token_urlsafe(18),
            webhook_verify_token=secrets.token_urlsafe(32),
        )


class Migration(migrations.Migration):

    dependencies = [
        ('social_stats', '0069_bot_knowledge_docs'),
    ]

    operations = [
        migrations.AddField(
            model_name='whatsappaccount', name='provider',
            field=models.CharField(default='pinbot', max_length=30),
        ),
        migrations.AddField(
            model_name='whatsappaccount', name='api_base_url',
            field=models.URLField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name='whatsappaccount', name='auth_header',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='whatsappaccount', name='auth_scheme',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='whatsappaccount', name='app_secret_encrypted',
            field=models.BinaryField(blank=True, null=True),
        ),
        # Unique per-row values: add plain, fill, then constrain.
        migrations.AddField(
            model_name='whatsappaccount', name='webhook_key',
            field=models.CharField(default='', max_length=64),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='whatsappaccount', name='webhook_verify_token',
            field=models.CharField(default='', max_length=64),
            preserve_default=False,
        ),
        migrations.RunPython(fill_webhook_credentials, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='whatsappaccount', name='webhook_key',
            field=models.CharField(default=social_stats.models._new_webhook_key, max_length=64, unique=True),
        ),
        migrations.AlterField(
            model_name='whatsappaccount', name='webhook_verify_token',
            field=models.CharField(default=social_stats.models._new_webhook_token, max_length=64),
        ),
    ]
