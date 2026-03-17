from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('social_stats', '0004_add_aiinsight'),
    ]

    operations = [
        migrations.CreateModel(
            name='WeeklyTopPost',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('platform',   models.CharField(choices=[('facebook','Facebook'),('instagram','Instagram'),('youtube','YouTube'),('linkedin','LinkedIn'),('google_my_business','Google My Business')], max_length=30)),
                ('week_start', models.DateField()),
                ('score',      models.FloatField(default=0)),
                ('rank',       models.PositiveSmallIntegerField(default=1)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('client',      models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='weekly_top_posts', to='social_stats.client')),
                ('post_metric', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='social_stats.postmetric')),
            ],
            options={
                'ordering': ['-week_start', 'platform', 'rank'],
                'unique_together': {('client', 'platform', 'week_start', 'rank')},
            },
        ),
    ]
