# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Bot-engine data fixes that go with 0067.

1. BotFlow.total_completed — end_conversation() used to reset the counter to
   its default before incrementing, so every completed flow showed 1.
   Recompute it from the completed conversations.
2. Snapshot every currently published flow as BotFlowVersion so new
   conversations pin a version straight away (existing graphs, unchanged).
3. Make WhatsApp message ids unique per (client, direction): blank the id on
   later duplicates (rows are kept), then add the constraint.
"""
from django.db import migrations, models
from django.db.models import Count, Min


def recompute_total_completed(apps, schema_editor):
    BotFlow = apps.get_model('social_stats', 'BotFlow')
    BotConversation = apps.get_model('social_stats', 'BotConversation')
    counts = dict(
        BotConversation.objects.filter(status='completed', flow__isnull=False)
        .values_list('flow_id').annotate(n=Count('id')).values_list('flow_id', 'n')
    )
    for flow in BotFlow.objects.only('id', 'total_completed').iterator():
        n = counts.get(flow.id, 0)
        if flow.total_completed != n:
            BotFlow.objects.filter(pk=flow.pk).update(total_completed=n)


def snapshot_published_flows(apps, schema_editor):
    BotFlow = apps.get_model('social_stats', 'BotFlow')
    BotFlowVersion = apps.get_model('social_stats', 'BotFlowVersion')
    for flow in BotFlow.objects.filter(is_active=True).iterator():
        version = flow.published_version or flow.version or 1
        if BotFlowVersion.objects.filter(flow_id=flow.id, version=version).exists():
            continue
        BotFlowVersion.objects.create(
            flow_id=flow.id, version=version,
            nodes=flow.nodes or [], edges=flow.edges or [],
            starting_node_id=flow.starting_node_id or '',
            note='snapshot of the live flow when versioning was introduced',
        )
        if flow.published_version != version:
            BotFlow.objects.filter(pk=flow.pk).update(published_version=version)


def dedupe_whatsapp_message_ids(apps, schema_editor):
    WhatsAppMessage = apps.get_model('social_stats', 'WhatsAppMessage')
    dupes = (
        WhatsAppMessage.objects.exclude(pinbot_message_id='')
        .values('client_id', 'pinbot_message_id', 'direction')
        .annotate(n=Count('id'), keep=Min('id'))
        .filter(n__gt=1)
    )
    for d in dupes.iterator():
        (WhatsAppMessage.objects
         .filter(client_id=d['client_id'], pinbot_message_id=d['pinbot_message_id'],
                 direction=d['direction'])
         .exclude(pk=d['keep'])
         .update(pinbot_message_id=''))


class Migration(migrations.Migration):

    dependencies = [
        ('social_stats', '0067_bot_flow_versions_and_abandonment'),
    ]

    operations = [
        migrations.RunPython(recompute_total_completed, migrations.RunPython.noop),
        migrations.RunPython(snapshot_published_flows, migrations.RunPython.noop),
        migrations.RunPython(dedupe_whatsapp_message_ids, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='whatsappmessage',
            constraint=models.UniqueConstraint(
                condition=models.Q(('pinbot_message_id', ''), _negated=True),
                fields=('client', 'pinbot_message_id', 'direction'),
                name='uniq_wa_message_id_per_client_direction',
            ),
        ),
    ]
