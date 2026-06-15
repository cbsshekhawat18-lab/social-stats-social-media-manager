from django.db import migrations


WHATSAPP_PERMISSIONS = [
    # (code, label, description, category, default_staff, default_client, sort_order)
    ('whatsapp.view',             'View WhatsApp Module',     'Access the WhatsApp section',                'pages',    True, True,  110),
    ('whatsapp.send',             'Send Messages',            'Send messages and template replies',         'actions',  True, True,  111),
    ('whatsapp.manage_contacts',  'Manage Contacts',          'Add/edit/delete contacts and lists',         'actions',  True, True,  112),
    ('whatsapp.manage_templates', 'Manage Templates',         'Create and submit message templates',        'actions',  True, False, 113),
    ('whatsapp.manage_campaigns', 'Manage Campaigns',         'Create and launch broadcast campaigns',      'actions',  True, False, 114),
    ('whatsapp.view_inbox',       'View Inbox',               'View inbox conversations',                   'pages',    True, True,  115),
    ('whatsapp.manage_account',   'Manage Pinbot Account',    'Connect/disconnect Pinbot WABA',             'actions',  False, False, 116),
]


def seed_whatsapp_permissions(apps, schema_editor):
    Permission     = apps.get_model('social_stats', 'Permission')
    RolePermission = apps.get_model('social_stats', 'RolePermission')

    for code, label, desc, category, default_staff, default_client, sort_order in WHATSAPP_PERMISSIONS:
        perm, _ = Permission.objects.update_or_create(
            code=code,
            defaults={
                'label':            label,
                'description':      desc,
                'category':         category,
                'page':             'whatsapp',
                'is_default_staff': default_staff,
                'is_default_client': default_client,
                'sort_order':       sort_order,
            },
        )
        RolePermission.objects.update_or_create(
            role='staff', permission=perm,
            defaults={'is_granted': default_staff},
        )
        RolePermission.objects.update_or_create(
            role='client', permission=perm,
            defaults={'is_granted': default_client},
        )


def remove_whatsapp_permissions(apps, schema_editor):
    Permission = apps.get_model('social_stats', 'Permission')
    Permission.objects.filter(code__startswith='whatsapp.').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('social_stats', '0032_whatsapp_models'),
    ]

    operations = [
        migrations.RunPython(seed_whatsapp_permissions, remove_whatsapp_permissions),
    ]
