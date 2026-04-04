from django.db import migrations


def forward_func(apps, schema_editor):
    LookupCollection = apps.get_model('social_stats', 'LookupCollection')
    LookupItem = apps.get_model('social_stats', 'LookupItem')

    collection = LookupCollection.objects.filter(key='platforms').first()
    if not collection:
        return

    valid_platforms = [
        {'key': 'facebook', 'label': 'Facebook', 'sort_order': 10},
        {'key': 'instagram', 'label': 'Instagram', 'sort_order': 20},
        {'key': 'linkedin', 'label': 'LinkedIn', 'sort_order': 30},
        {'key': 'youtube', 'label': 'YouTube', 'sort_order': 40},
        {'key': 'google_my_business', 'label': 'Google My Business', 'sort_order': 50},
    ]

    for item in valid_platforms:
        LookupItem.objects.update_or_create(
            collection=collection,
            key=item['key'],
            defaults={
                'label': item['label'],
                'value': item.get('value', item['label']),
                'sort_order': item['sort_order'],
                'is_active': True,
            }
        )

    LookupItem.objects.filter(collection=collection, key__in=['twitter', 'tiktok', 'other']).delete()


def reverse_func(apps, schema_editor):
    LookupCollection = apps.get_model('social_stats', 'LookupCollection')
    LookupItem = apps.get_model('social_stats', 'LookupItem')

    collection = LookupCollection.objects.filter(key='platforms').first()
    if not collection:
        return

    LookupItem.objects.update_or_create(
        collection=collection,
        key='twitter',
        defaults={'label': 'Twitter', 'value': 'Twitter', 'sort_order': 100, 'is_active': True, 'metadata': {}},
    )
    LookupItem.objects.update_or_create(
        collection=collection,
        key='tiktok',
        defaults={'label': 'TikTok', 'value': 'TikTok', 'sort_order': 110, 'is_active': True, 'metadata': {}},
    )
    LookupItem.objects.update_or_create(
        collection=collection,
        key='other',
        defaults={'label': 'Other', 'value': 'Other', 'sort_order': 120, 'is_active': True, 'metadata': {}},
    )


class Migration(migrations.Migration):
    dependencies = [
        ('social_stats', '0020_seed_lookup_items'),
    ]

    operations = [
        migrations.RunPython(forward_func, reverse_func),
    ]
