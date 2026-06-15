"""seed the 8 industry BotFlowTemplate rows.

Idempotent: re-applying upserts via the seeder. Reverse migration deletes
rows by name, leaving any user-cloned BotFlow rows untouched (they live in
a separate table).
"""
from django.db import migrations


def forwards(apps, schema_editor):
    # Run the seed helper through the live ORM — it imports the model from
    # social_stats.models which is fine inside a data migration.
    from social_stats.management.commands.seed_bot_templates import seed
    seed()


def backwards(apps, schema_editor):
    BotFlowTemplate = apps.get_model('social_stats', 'BotFlowTemplate')
    BotFlowTemplate.objects.filter(name__in=[
        'Real-estate lead capture',
        'Healthcare appointment booking',
        'Restaurant reservation',
        'Fitness / gym lead capture',
        'E-commerce product inquiry',
        'Education / course inquiry',
        'General lead magnet',
        'Customer support triage',
    ]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('social_stats', '0046_ctwa_bot_models'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
