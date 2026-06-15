from django.db import migrations


# (code, label, description, category, default_staff, default_client, sort_order, page)
STAGE_PERMISSIONS = [
    # Composer
    ('composer.view',        'View Composer',         'Access composer and posts pages',          'pages',   True, True,  120, 'composer'),
    ('composer.create',      'Create Posts',          'Compose new unified posts',                'actions', True, True,  121, 'composer'),
    ('composer.publish',     'Publish Posts',         'Trigger publish-now or schedule a post',   'actions', True, False, 122, 'composer'),
    ('composer.approve',     'Approve Posts',         'Approve pending-approval posts',           'actions', True, False, 123, 'composer'),
    ('composer.delete',      'Delete Posts',          'Delete unified posts',                     'actions', True, False, 124, 'composer'),

    # Inbox
    ('inbox.view',           'View Inbox',            'Access unified inbox conversations',       'pages',   True, True,  130, 'inbox'),
    ('inbox.reply',          'Reply in Inbox',        'Send replies to inbox messages',           'actions', True, True,  131, 'inbox'),
    ('inbox.assign',         'Assign Conversations',  'Assign or reassign conversations',         'actions', True, False, 132, 'inbox'),

    # Video Studio
    ('video.view',           'View Video Studio',     'Access the Video Studio page',             'pages',   True, True,  139, 'video_studio'),
    ('video.upload',         'Upload Videos',         'Upload videos to the Video Studio',        'actions', True, True,  140, 'video_studio'),
    ('video.publish',        'Publish Videos',        'Publish videos to connected platforms',    'actions', True, False, 141, 'video_studio'),

    # Automations
    ('automations.view',     'View Automations',      'Access the Automations page',              'pages',   True, False, 150, 'automations'),
    ('automations.create',   'Create Automations',    'Create new automation rules',              'actions', True, False, 151, 'automations'),
    ('automations.edit',     'Edit Automations',      'Edit existing automation rules',           'actions', True, False, 152, 'automations'),
    ('automations.delete',   'Delete Automations',    'Delete automation rules',                  'actions', True, False, 153, 'automations'),

    # AI Studio
    ('ai.compose',           'Use AI Compose',        'Generate captions/hashtags via AI',        'actions', True, True,  160, 'ai_studio'),
    ('ai.brand_voice',       'Manage Brand Voice',    'Train/edit the brand voice profile',       'actions', True, False, 161, 'ai_studio'),

    # Audience
    ('audience.view',        'View Audience',         'Access the Audience Insights page',        'pages',   True, True,  170, 'audience'),

    # Competitors
    ('competitors.view',      'View Competitors',     'Access the Competitors page',              'pages',   True, True,  180, 'competitors'),
    ('competitors.create',    'Add Competitors',      'Add or remove tracked competitors',        'actions', True, False, 181, 'competitors'),
    ('competitors.benchmark', 'Run Benchmarks',       'Trigger competitor benchmark snapshots',   'actions', True, True,  182, 'competitors'),

    # Audit
    ('audit.view',            'View Audit Log',       'Access the audit log page',                'pages',   True, False, 190, 'audit'),
]


def seed_stage_permissions(apps, schema_editor):
    Permission     = apps.get_model('social_stats', 'Permission')
    RolePermission = apps.get_model('social_stats', 'RolePermission')

    for code, label, desc, category, default_staff, default_client, sort_order, page in STAGE_PERMISSIONS:
        perm, _ = Permission.objects.update_or_create(
            code=code,
            defaults={
                'label':             label,
                'description':       desc,
                'category':          category,
                'page':              page,
                'is_default_staff':  default_staff,
                'is_default_client': default_client,
                'sort_order':        sort_order,
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


def remove_stage_permissions(apps, schema_editor):
    Permission = apps.get_model('social_stats', 'Permission')
    prefixes = ('composer.', 'inbox.', 'video.', 'automations.',
                'ai.', 'audience.', 'competitors.', 'audit.')
    for prefix in prefixes:
        Permission.objects.filter(code__startswith=prefix).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('social_stats', '0037_actionlog_notification_prefs'),
    ]

    operations = [
        migrations.RunPython(seed_stage_permissions, remove_stage_permissions),
    ]
