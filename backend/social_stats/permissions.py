# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
from rest_framework.permissions import BasePermission


class PermissionChecker:
    """Central place to check if a user has a permission."""

    @staticmethod
    def has_permission(user_profile, permission_code):
        if user_profile is None:
            return False
        if user_profile.role == 'superadmin':
            return True
        from .models import UserPermission, RolePermission, Permission
        try:
            override = UserPermission.objects.get(
                user_profile=user_profile,
                permission__code=permission_code,
            )
            return override.is_granted
        except UserPermission.DoesNotExist:
            pass
        try:
            role_perm = RolePermission.objects.get(
                role=user_profile.role,
                permission__code=permission_code,
            )
            return role_perm.is_granted
        except RolePermission.DoesNotExist:
            pass
        return False

    @staticmethod
    def get_user_permissions(user_profile):
        from .models import Permission, UserPermission, RolePermission
        if user_profile is None:
            return {}
        if user_profile.role == 'superadmin':
            return {p.code: True for p in Permission.objects.all()}

        result = {}
        # Start with role defaults
        for rp in RolePermission.objects.filter(role=user_profile.role).select_related('permission'):
            result[rp.permission.code] = rp.is_granted
        # Apply user overrides
        for up in UserPermission.objects.filter(user_profile=user_profile).select_related('permission'):
            result[up.permission.code] = up.is_granted
        # Ensure all permissions are present
        for p in Permission.objects.all():
            if p.code not in result:
                result[p.code] = False
        return result

    @staticmethod
    def grant_permission(user_profile, permission_code, granted_by, note=""):
        from .models import Permission, UserPermission
        try:
            perm = Permission.objects.get(code=permission_code)
        except Permission.DoesNotExist:
            return False
        UserPermission.objects.update_or_create(
            user_profile=user_profile,
            permission=perm,
            defaults={'is_granted': True, 'granted_by': granted_by, 'note': note},
        )
        return True

    @staticmethod
    def revoke_permission(user_profile, permission_code, granted_by, note=""):
        from .models import Permission, UserPermission
        try:
            perm = Permission.objects.get(code=permission_code)
        except Permission.DoesNotExist:
            return False
        UserPermission.objects.update_or_create(
            user_profile=user_profile,
            permission=perm,
            defaults={'is_granted': False, 'granted_by': granted_by, 'note': note},
        )
        return True

    @staticmethod
    def reset_to_default(user_profile, permission_code):
        from .models import Permission, UserPermission
        try:
            perm = Permission.objects.get(code=permission_code)
            UserPermission.objects.filter(user_profile=user_profile, permission=perm).delete()
            return True
        except Permission.DoesNotExist:
            return False

    @staticmethod
    def get_assigned_clients(user_profile):
        from .models import Client, StaffClientAssignment
        if user_profile is None:
            return Client.objects.none()
        if user_profile.role == 'superadmin':
            return Client.objects.filter(is_active=True)
        if user_profile.role == 'staff':
            assigned_ids = StaffClientAssignment.objects.filter(
                staff_profile=user_profile
            ).values_list('client_id', flat=True)
            return Client.objects.filter(id__in=assigned_ids, is_active=True)
        if user_profile.role == 'client' and user_profile.client:
            return Client.objects.filter(id=user_profile.client_id)
        return Client.objects.none()

    @staticmethod
    def get_permissions_grouped(user_profile):
        """Returns permissions grouped by page for the management UI."""
        from .models import Permission, UserPermission, RolePermission, PERMISSION_PAGE_GROUPS
        all_perms = Permission.objects.all().order_by('sort_order')
        role = user_profile.role if user_profile else 'client'

        # Get role defaults
        role_defaults = {}
        for rp in RolePermission.objects.filter(role=role).select_related('permission'):
            role_defaults[rp.permission.code] = rp.is_granted

        # Get user overrides
        user_overrides = {}
        if user_profile:
            for up in UserPermission.objects.filter(user_profile=user_profile).select_related('permission'):
                user_overrides[up.permission.code] = {
                    'is_granted': up.is_granted,
                    'note': up.note,
                }

        groups = {}
        for page_key, page_meta in PERMISSION_PAGE_GROUPS.items():
            page_perms = [p for p in all_perms if p.code.startswith(page_meta['prefix'])]
            if not page_perms:
                continue
            perm_list = []
            for p in page_perms:
                role_default = role_defaults.get(p.code, False)
                override = user_overrides.get(p.code)
                if override is not None:
                    effective = override['is_granted']
                    note = override['note']
                    is_override = True
                else:
                    effective = role_default
                    note = ''
                    is_override = False

                perm_list.append({
                    'code':          p.code,
                    'label':         p.label,
                    'description':   p.description,
                    'category':      p.category,
                    'role_default':  role_default,
                    'is_override':   is_override,
                    'effective':     effective,
                    'override_note': note,
                })
            groups[page_key] = {
                'label':       page_meta['label'],
                'icon':        page_meta['icon'],
                'permissions': perm_list,
                'all_granted': all(p['effective'] for p in perm_list),
            }
        return groups


# ── DRF Permission Classes ────────────────────────────────────────────────────

def _make_page_permission(perm_code, message):
    class PagePermission(BasePermission):
        _code = perm_code
        _message = message

        def has_permission(self, request, view):
            self.message = self._message
            try:
                return PermissionChecker.has_permission(request.user.profile, self._code)
            except Exception:
                return False

    PagePermission.__name__ = f'Has_{perm_code.replace(".", "_")}_Access'
    return PagePermission


HasDashboardAccess = _make_page_permission('dashboard.view', "You don't have access to the dashboard")
HasAnalyticsAccess = _make_page_permission('analytics.view', "You don't have access to analytics")
HasCalendarAccess  = _make_page_permission('calendar.view',  "You don't have access to the content calendar")
HasROIAccess       = _make_page_permission('roi.view',       "You don't have access to the ROI calculator")
HasReportsAccess   = _make_page_permission('reports.view',   "You don't have access to reports")
HasAlertsAccess    = _make_page_permission('alerts.view',    "You don't have access to alerts")
HasReviewsAccess   = _make_page_permission('reviews.view',   "You don't have access to reviews")
HasBillingAccess   = _make_page_permission('billing.view',   "You don't have access to billing")
HasSettingsAccess  = _make_page_permission('settings.view',  "You don't have access to settings")

IsSuperAdmin = _make_page_permission('data.view_all_clients', "Superadmin only")


class IsSuperAdminRole(BasePermission):
    message = "Superadmin only"
    def has_permission(self, request, view):
        try:
            return request.user.profile.role == 'superadmin'
        except Exception:
            return False
