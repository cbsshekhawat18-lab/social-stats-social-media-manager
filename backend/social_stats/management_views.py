# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import (
    UserProfile, Client, Permission, RolePermission,
    UserPermission, StaffClientAssignment, ClientPageConfig,
    PERMISSION_PAGE_GROUPS,
)
from .permissions import PermissionChecker, IsSuperAdminRole


def _require_superadmin(request):
    try:
        return request.user.profile.role == 'superadmin'
    except Exception:
        return False


def _agency_client_qs(request):
    """Return a Client queryset scoped to the logged-in agency (superadmin)."""
    return Client.objects.filter(
        Q(userprofile__isnull=True) |
        Q(userprofile__is_self_registered=False) |
        Q(userprofile__agency=request.user)
    ).distinct()


# ── Staff ─────────────────────────────────────────────────────────────────────

class StaffListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def get(self, request):
        profiles = UserProfile.objects.filter(role='staff').select_related('user')
        data = []
        for p in profiles:
            assigned = StaffClientAssignment.objects.filter(staff_profile=p).count()
            total_perms = Permission.objects.count()
            granted = sum(1 for v in PermissionChecker.get_user_permissions(p).values() if v)
            data.append({
                'id':               p.id,
                'user_id':          p.user_id,
                'name':             p.user.get_full_name() or p.user.username,
                'email':            p.user.email,
                'role':             p.role,
                'is_active':        p.user.is_active,
                'assigned_clients': assigned,
                'last_login':       p.user.last_login,
                'date_joined':      p.user.date_joined,
                'permission_summary': {'granted': granted, 'total': total_perms},
            })
        return Response(data)

    def post(self, request):
        name     = request.data.get('name', '')
        email    = request.data.get('email', '')
        password = request.data.get('password', '')
        client_ids = request.data.get('assigned_clients', [])
        perm_mode  = request.data.get('permission_mode', 'default')
        copy_from  = request.data.get('copy_from_staff_id')

        if not email or not password:
            return Response({'error': 'email and password are required'}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({'error': 'A user with this email already exists'}, status=400)

        with transaction.atomic():
            parts = name.strip().split(' ', 1)
            user = User.objects.create_user(
                username=email, email=email, password=password,
                first_name=parts[0], last_name=parts[1] if len(parts) > 1 else '',
            )
            profile = UserProfile.objects.create(user=user, role='staff')

            # Assign clients
            for cid in client_ids:
                try:
                    client = Client.objects.get(id=cid)
                    StaffClientAssignment.objects.create(
                        staff_profile=profile, client=client,
                        assigned_by=request.user,
                    )
                    profile.assigned_clients.add(client)
                except Client.DoesNotExist:
                    pass

            # Permissions
            if perm_mode == 'none':
                for perm in Permission.objects.all():
                    UserPermission.objects.create(
                        user_profile=profile, permission=perm,
                        is_granted=False, granted_by=request.user,
                    )
            elif perm_mode == 'copy' and copy_from:
                try:
                    source = UserProfile.objects.get(id=copy_from, role='staff')
                    for up in UserPermission.objects.filter(user_profile=source):
                        UserPermission.objects.create(
                            user_profile=profile, permission=up.permission,
                            is_granted=up.is_granted, granted_by=request.user,
                            note=f'Copied from {source.user.email}',
                        )
                except UserProfile.DoesNotExist:
                    pass
            # else: use role defaults (no UserPermission records needed)

        return Response({
            'id': profile.id, 'user_id': user.id,
            'name': user.get_full_name(), 'email': user.email,
            'role': 'staff', 'is_active': True,
        }, status=201)


class StaffDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def _get_profile(self, pk):
        try:
            return UserProfile.objects.select_related('user').get(id=pk, role='staff')
        except UserProfile.DoesNotExist:
            return None

    def get(self, request, pk):
        profile = self._get_profile(pk)
        if not profile:
            return Response({'error': 'Staff not found'}, status=404)
        assignments = StaffClientAssignment.objects.filter(staff_profile=profile).select_related('client')
        clients_data = [{
            'id':         a.client.id,
            'company':    a.client.company,
            'email':      a.client.email,
            'can_edit':   a.can_edit,
            'can_sync':   a.can_sync,
            'can_export': a.can_export,
            'note':       a.note,
            'assigned_at': a.assigned_at,
        } for a in assignments]
        perms = PermissionChecker.get_permissions_grouped(profile)
        overrides = UserPermission.objects.filter(user_profile=profile).count()
        return Response({
            'id':                 profile.id,
            'user_id':            profile.user_id,
            'name':               profile.user.get_full_name() or profile.user.username,
            'email':              profile.user.email,
            'role':               profile.role,
            'is_active':          profile.user.is_active,
            'last_login':         profile.user.last_login,
            'date_joined':        profile.user.date_joined,
            'assigned_clients':   clients_data,
            'permission_groups':  perms,
            'override_count':     overrides,
        })

    def patch(self, request, pk):
        profile = self._get_profile(pk)
        if not profile:
            return Response({'error': 'Staff not found'}, status=404)
        user = profile.user
        if 'name' in request.data:
            parts = request.data['name'].strip().split(' ', 1)
            user.first_name = parts[0]
            user.last_name  = parts[1] if len(parts) > 1 else ''
        if 'email' in request.data:
            user.email    = request.data['email']
            user.username = request.data['email']
        if 'is_active' in request.data:
            user.is_active = bool(request.data['is_active'])
        user.save()
        return Response({'id': profile.id, 'name': user.get_full_name(), 'email': user.email, 'is_active': user.is_active})

    def delete(self, request, pk):
        profile = self._get_profile(pk)
        if not profile:
            return Response({'error': 'Staff not found'}, status=404)
        profile.user.is_active = False
        profile.user.save(update_fields=['is_active'])
        return Response({'status': 'deactivated'})


class StaffPermissionsView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def _get_profile(self, pk):
        try:
            return UserProfile.objects.get(id=pk, role='staff')
        except UserProfile.DoesNotExist:
            return None

    def get(self, request, pk):
        profile = self._get_profile(pk)
        if not profile:
            return Response({'error': 'Staff not found'}, status=404)
        return Response(PermissionChecker.get_permissions_grouped(profile))

    def post(self, request, pk):
        profile = self._get_profile(pk)
        if not profile:
            return Response({'error': 'Staff not found'}, status=404)
        grants  = request.data.get('grants', [])
        revokes = request.data.get('revokes', [])
        resets  = request.data.get('resets', [])
        note    = request.data.get('note', '')
        for code in grants:
            PermissionChecker.grant_permission(profile, code, request.user, note)
        for code in revokes:
            PermissionChecker.revoke_permission(profile, code, request.user, note)
        for code in resets:
            PermissionChecker.reset_to_default(profile, code)
        return Response(PermissionChecker.get_permissions_grouped(profile))


class StaffClientsView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def _get_profile(self, pk):
        try:
            return UserProfile.objects.get(id=pk, role='staff')
        except UserProfile.DoesNotExist:
            return None

    def get(self, request, pk):
        profile = self._get_profile(pk)
        if not profile:
            return Response({'error': 'Staff not found'}, status=404)
        assignments = StaffClientAssignment.objects.filter(staff_profile=profile).select_related('client')
        return Response([{
            'id':         a.client.id,
            'company':    a.client.company,
            'email':      a.client.email,
            'can_edit':   a.can_edit,
            'can_sync':   a.can_sync,
            'can_export': a.can_export,
            'note':       a.note,
            'assigned_at': a.assigned_at,
        } for a in assignments])

    def post(self, request, pk):
        profile = self._get_profile(pk)
        if not profile:
            return Response({'error': 'Staff not found'}, status=404)
        add_list    = request.data.get('add', [])
        remove_list = request.data.get('remove', [])
        agency_qs = _agency_client_qs(request)
        for item in add_list:
            cid = item.get('client_id')
            try:
                client = agency_qs.get(id=cid)
                assignment, _ = StaffClientAssignment.objects.update_or_create(
                    staff_profile=profile, client=client,
                    defaults={
                        'can_edit':   item.get('can_edit', False),
                        'can_sync':   item.get('can_sync', True),
                        'can_export': item.get('can_export', True),
                        'assigned_by': request.user,
                    }
                )
                profile.assigned_clients.add(client)
            except Client.DoesNotExist:
                pass
        for cid in remove_list:
            try:
                client = agency_qs.get(id=cid)
                StaffClientAssignment.objects.filter(staff_profile=profile, client=client).delete()
                profile.assigned_clients.remove(client)
            except Client.DoesNotExist:
                pass
        return self.get(request, pk)


# ── Clients ───────────────────────────────────────────────────────────────────

class ClientManagementListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def get(self, request):
        clients = _agency_client_qs(request).order_by('company')
        data = []
        for c in clients:
            # Get the client's user profile
            client_profile = UserProfile.objects.filter(client=c, role='client').first()
            assigned_staff = StaffClientAssignment.objects.filter(client=c).select_related('staff_profile__user')
            from .models import PlatformCredential
            connected = PlatformCredential.objects.filter(client=c, is_active=True).count()
            data.append({
                'id':                c.id,
                'company':           c.company,
                'email':             c.email,
                'name':              c.name,
                'is_active':         c.is_active,
                'connected_platforms': connected,
                'assigned_staff':    [{'id': a.staff_profile.id, 'name': a.staff_profile.user.get_full_name() or a.staff_profile.user.email} for a in assigned_staff],
                'has_portal_config': hasattr(c, 'page_config'),
                'profile_id':        client_profile.id if client_profile else None,
            })
        return Response(data)


class ClientManagementDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def _get_client(self, request, pk):
        try:
            return _agency_client_qs(request).get(id=pk)
        except Client.DoesNotExist:
            return None

    def get(self, request, pk):
        client = self._get_client(request, pk)
        if not client:
            return Response({'error': 'Client not found'}, status=404)
        client_profile = UserProfile.objects.filter(client=client, role='client').first()
        assigned_staff = StaffClientAssignment.objects.filter(client=client).select_related('staff_profile__user')
        from .models import PlatformCredential, SyncLog
        creds = PlatformCredential.objects.filter(client=client)
        last_sync = SyncLog.objects.filter(client=client, status='success').order_by('-finished_at').first()
        perms = PermissionChecker.get_permissions_grouped(client_profile) if client_profile else {}
        return Response({
            'id':              client.id,
            'company':         client.company,
            'email':           client.email,
            'name':            client.name,
            'phone':           client.phone,
            'website':         client.website,
            'is_active':       client.is_active,
            'created_at':      client.created_at,
            'profile_id':      client_profile.id if client_profile else None,
            'assigned_staff':  [{'id': a.staff_profile.id, 'name': a.staff_profile.user.get_full_name() or a.staff_profile.user.email, 'email': a.staff_profile.user.email} for a in assigned_staff],
            'connected_platforms': [{'platform': c.platform, 'is_active': c.is_active} for c in creds],
            'last_sync':       last_sync.finished_at if last_sync else None,
            'permission_groups': perms,
        })

    def patch(self, request, pk):
        client = self._get_client(request, pk)
        if not client:
            return Response({'error': 'Client not found'}, status=404)
        for field in ['company', 'email', 'name', 'phone', 'website', 'is_active']:
            if field in request.data:
                setattr(client, field, request.data[field])
        client.save()
        return Response({'id': client.id, 'company': client.company})


class ClientPermissionsView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def _get_client_profile(self, pk):
        return UserProfile.objects.filter(client_id=pk, role='client').first()

    def get(self, request, pk):
        profile = self._get_client_profile(pk)
        if not profile:
            return Response({'error': 'No user profile for this client'}, status=404)
        return Response(PermissionChecker.get_permissions_grouped(profile))

    def post(self, request, pk):
        profile = self._get_client_profile(pk)
        if not profile:
            return Response({'error': 'No user profile for this client'}, status=404)
        grants  = request.data.get('grants', [])
        revokes = request.data.get('revokes', [])
        resets  = request.data.get('resets', [])
        note    = request.data.get('note', '')
        for code in grants:
            PermissionChecker.grant_permission(profile, code, request.user, note)
        for code in revokes:
            PermissionChecker.revoke_permission(profile, code, request.user, note)
        for code in resets:
            PermissionChecker.reset_to_default(profile, code)
        return Response(PermissionChecker.get_permissions_grouped(profile))


class ClientPortalConfigView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def _get_or_create_config(self, request, pk):
        try:
            client = _agency_client_qs(request).get(id=pk)
        except Client.DoesNotExist:
            return None, None
        config, _ = ClientPageConfig.objects.get_or_create(client=client)
        return client, config

    def get(self, request, pk):
        client, config = self._get_or_create_config(request, pk)
        if not client:
            return Response({'error': 'Client not found'}, status=404)
        return Response({
            'client_id':             client.id,
            'client_name':           client.company,
            'portal_title':          config.portal_title,
            'show_platform_tabs':    config.show_platform_tabs,
            'show_date_picker':      config.show_date_picker,
            'show_export_button':    config.show_export_button,
            'show_sync_button':      config.show_sync_button,
            'show_posts_section':    config.show_posts_section,
            'show_reviews_section':  config.show_reviews_section,
            'show_roi_section':      config.show_roi_section,
            'show_calendar':         config.show_calendar,
            'default_platform':      config.default_platform,
            'default_date_range':    config.default_date_range,
            'custom_logo_url':       config.custom_logo_url,
            'custom_accent_color':   config.custom_accent_color,
            'welcome_message':       config.welcome_message,
            'updated_at':            config.updated_at,
        })

    def put(self, request, pk):
        client, config = self._get_or_create_config(request, pk)
        if not client:
            return Response({'error': 'Client not found'}, status=404)
        fields = [
            'portal_title', 'show_platform_tabs', 'show_date_picker',
            'show_export_button', 'show_sync_button', 'show_posts_section',
            'show_reviews_section', 'show_roi_section', 'show_calendar',
            'default_platform', 'default_date_range', 'custom_logo_url',
            'custom_accent_color', 'welcome_message',
        ]
        for field in fields:
            if field in request.data:
                setattr(config, field, request.data[field])
        config.updated_by = request.user
        config.save()
        return self.get(request, pk)


class PermissionListView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def get(self, request):
        perms = Permission.objects.all().order_by('sort_order')
        groups = {}
        for page_key, page_meta in PERMISSION_PAGE_GROUPS.items():
            page_perms = [p for p in perms if p.code.startswith(page_meta['prefix'])]
            if page_perms:
                groups[page_key] = {
                    'label': page_meta['label'],
                    'icon':  page_meta['icon'],
                    'permissions': [{
                        'code':              p.code,
                        'label':             p.label,
                        'description':       p.description,
                        'category':          p.category,
                        'is_default_staff':  p.is_default_staff,
                        'is_default_client': p.is_default_client,
                    } for p in page_perms],
                }
        return Response(groups)


class RoleDefaultsView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdminRole]

    def get(self, request, role):
        if role not in ('staff', 'client'):
            return Response({'error': 'Invalid role'}, status=400)
        perms = Permission.objects.all().order_by('sort_order')
        role_defaults = {rp.permission.code: rp.is_granted
                         for rp in RolePermission.objects.filter(role=role).select_related('permission')}
        groups = {}
        for page_key, page_meta in PERMISSION_PAGE_GROUPS.items():
            page_perms = [p for p in perms if p.code.startswith(page_meta['prefix'])]
            if page_perms:
                groups[page_key] = {
                    'label': page_meta['label'],
                    'icon':  page_meta['icon'],
                    'permissions': [{
                        'code':         p.code,
                        'label':        p.label,
                        'description':  p.description,
                        'is_granted':   role_defaults.get(p.code, False),
                    } for p in page_perms],
                }
        return Response({'role': role, 'groups': groups})

    def put(self, request, role):
        if role not in ('staff', 'client'):
            return Response({'error': 'Invalid role'}, status=400)
        grants  = request.data.get('grants', [])
        revokes = request.data.get('revokes', [])
        for code in grants:
            try:
                perm = Permission.objects.get(code=code)
                RolePermission.objects.update_or_create(
                    role=role, permission=perm,
                    defaults={'is_granted': True},
                )
            except Permission.DoesNotExist:
                pass
        for code in revokes:
            try:
                perm = Permission.objects.get(code=code)
                RolePermission.objects.update_or_create(
                    role=role, permission=perm,
                    defaults={'is_granted': False},
                )
            except Permission.DoesNotExist:
                pass
        return self.get(request, role)
