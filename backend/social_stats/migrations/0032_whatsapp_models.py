from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('social_stats', '0031_remove_instagram_basic_scope'),
    ]

    operations = [
        # ── Client.whatsapp_enabled ───────────────────────────────────────────
        migrations.AddField(
            model_name='client',
            name='whatsapp_enabled',
            field=models.BooleanField(default=False),
        ),

        # ── WhatsAppAccount ───────────────────────────────────────────────────
        migrations.CreateModel(
            name='WhatsAppAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('waba_id', models.CharField(max_length=100)),
                ('phone_number_id', models.CharField(max_length=100)),
                ('phone_number', models.CharField(blank=True, max_length=30)),
                ('api_key_encrypted', models.BinaryField(blank=True, null=True)),
                ('display_name', models.CharField(blank=True, max_length=200)),
                ('is_active', models.BooleanField(default=True)),
                ('quality_rating', models.CharField(choices=[('GREEN', 'Green'), ('YELLOW', 'Yellow'), ('RED', 'Red'), ('UNKNOWN', 'Unknown')], default='UNKNOWN', max_length=10)),
                ('messaging_tier', models.CharField(choices=[('TIER_1K', '1,000 / 24h'), ('TIER_10K', '10,000 / 24h'), ('TIER_100K', '100,000 / 24h'), ('TIER_UNLIMITED', 'Unlimited')], default='TIER_1K', max_length=20)),
                ('last_synced_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('client', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_account', to='social_stats.client')),
            ],
            options={'ordering': ['-updated_at']},
        ),

        # ── WhatsAppContact ───────────────────────────────────────────────────
        migrations.CreateModel(
            name='WhatsAppContact',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone', models.CharField(db_index=True, max_length=20)),
                ('name', models.CharField(blank=True, max_length=200)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('custom_fields', models.JSONField(blank=True, default=dict)),
                ('opt_in_status', models.CharField(choices=[('pending', 'Pending'), ('opted_in', 'Opted In'), ('opted_out', 'Opted Out')], default='pending', max_length=20)),
                ('opt_in_source', models.CharField(blank=True, max_length=100)),
                ('opt_in_at', models.DateTimeField(blank=True, null=True)),
                ('last_message_at', models.DateTimeField(blank=True, null=True)),
                ('last_inbound_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_contacts', to='social_stats.client')),
            ],
            options={'ordering': ['-updated_at']},
        ),
        migrations.AddIndex(
            model_name='whatsappcontact',
            index=models.Index(fields=['client', 'opt_in_status'], name='social_stat_client__9cd2fd_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='whatsappcontact',
            unique_together={('client', 'phone')},
        ),

        # ── WhatsAppContactList ───────────────────────────────────────────────
        migrations.CreateModel(
            name='WhatsAppContactList',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_lists', to='social_stats.client')),
                ('contacts', models.ManyToManyField(blank=True, related_name='lists', to='social_stats.whatsappcontact')),
            ],
            options={'ordering': ['-created_at']},
        ),

        # ── WhatsAppTemplate ──────────────────────────────────────────────────
        migrations.CreateModel(
            name='WhatsAppTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Lowercase slug-like, e.g. order_confirmation', max_length=100)),
                ('category', models.CharField(choices=[('marketing', 'Marketing'), ('utility', 'Utility'), ('authentication', 'Authentication')], default='marketing', max_length=20)),
                ('language', models.CharField(default='en_US', max_length=20)),
                ('template_type', models.CharField(choices=[('text', 'Text'), ('image', 'Image'), ('video', 'Video'), ('document', 'Document'), ('location', 'Location'), ('carousel', 'Carousel'), ('coupon', 'Coupon'), ('mpm', 'Multi-Product Message'), ('lto', 'Limited-Time Offer')], default='text', max_length=20)),
                ('header', models.JSONField(blank=True, default=dict)),
                ('body', models.TextField()),
                ('footer', models.CharField(blank=True, max_length=200)),
                ('buttons', models.JSONField(blank=True, default=list)),
                ('pinbot_template_id', models.CharField(blank=True, max_length=200)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('paused', 'Paused')], default='draft', max_length=20)),
                ('rejection_reason', models.TextField(blank=True)),
                ('variables_count', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_templates', to='social_stats.client')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_wa_templates', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-updated_at']},
        ),
        migrations.AlterUniqueTogether(
            name='whatsapptemplate',
            unique_together={('client', 'name', 'language')},
        ),

        # ── WhatsAppCampaign ──────────────────────────────────────────────────
        migrations.CreateModel(
            name='WhatsAppCampaign',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('template_variables', models.JSONField(blank=True, default=dict, help_text='Mapping of {{n}} → value or {{n}} → contact field')),
                ('scheduled_at', models.DateTimeField(blank=True, null=True)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('scheduled', 'Scheduled'), ('running', 'Running'), ('completed', 'Completed'), ('failed', 'Failed'), ('cancelled', 'Cancelled'), ('paused', 'Paused')], default='draft', max_length=20)),
                ('total_count', models.IntegerField(default=0)),
                ('sent_count', models.IntegerField(default=0)),
                ('delivered_count', models.IntegerField(default=0)),
                ('read_count', models.IntegerField(default=0)),
                ('failed_count', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_campaigns', to='social_stats.client')),
                ('contact_list', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='campaigns', to='social_stats.whatsappcontactlist')),
                ('template', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='campaigns', to='social_stats.whatsapptemplate')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_wa_campaigns', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),

        # ── WhatsAppMessage ───────────────────────────────────────────────────
        migrations.CreateModel(
            name='WhatsAppMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pinbot_message_id', models.CharField(blank=True, db_index=True, max_length=200)),
                ('direction', models.CharField(choices=[('outbound', 'Outbound'), ('inbound', 'Inbound')], default='outbound', max_length=10)),
                ('message_type', models.CharField(default='text', max_length=30)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('status', models.CharField(choices=[('queued', 'Queued'), ('sent', 'Sent'), ('delivered', 'Delivered'), ('read', 'Read'), ('failed', 'Failed')], default='queued', max_length=15)),
                ('error_code', models.CharField(blank=True, max_length=50)),
                ('error_message', models.TextField(blank=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('campaign', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='messages', to='social_stats.whatsappcampaign')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_messages', to='social_stats.client')),
                ('contact', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='social_stats.whatsappcontact')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='whatsappmessage',
            index=models.Index(fields=['client', '-created_at'], name='social_stat_client__161b24_idx'),
        ),
        migrations.AddIndex(
            model_name='whatsappmessage',
            index=models.Index(fields=['campaign', 'status'], name='social_stat_campaig_59fba1_idx'),
        ),
        migrations.AddIndex(
            model_name='whatsappmessage',
            index=models.Index(fields=['contact', '-created_at'], name='social_stat_contact_d51bc6_idx'),
        ),

        # ── WhatsAppWebhookLog ────────────────────────────────────────────────
        migrations.CreateModel(
            name='WhatsAppWebhookLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(default='unknown', max_length=100)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('processed', models.BooleanField(default=False)),
                ('error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='whatsapp_webhooks', to='social_stats.client')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddIndex(
            model_name='whatsappwebhooklog',
            index=models.Index(fields=['processed', '-created_at'], name='social_stat_process_2c975b_idx'),
        ),
    ]
