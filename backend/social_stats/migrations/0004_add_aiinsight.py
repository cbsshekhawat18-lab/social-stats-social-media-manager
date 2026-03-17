from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('social_stats', '0003_add_alert'),
    ]

    operations = [
        migrations.CreateModel(
            name='AIInsight',
            fields=[
                ('id',           models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('month',        models.PositiveSmallIntegerField()),
                ('year',         models.PositiveSmallIntegerField()),
                ('content',      models.TextField()),
                ('generated_at', models.DateTimeField(auto_now=True)),
                ('client',       models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_insights', to='social_stats.client')),
            ],
            options={
                'ordering': ['-year', '-month'],
                'unique_together': {('client', 'month', 'year')},
            },
        ),
    ]
