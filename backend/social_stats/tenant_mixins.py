# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Shared tenant-isolation mixin for DRF ViewSets.

Centralises the "filter queryset by the user's tenant" logic so individual
viewsets don't reinvent it. Five branches in priority order:
  1. anonymous / no profile → empty queryset
  2. superadmin             → unconditional access (optionally narrowed by ?client_id=)
  3. staff                  → assigned_clients M2M (legacy admin-side)
  4. agency member          → union of clients managed by the user's primary
                              agency (— closes the audit gap surfaced
                              in where agency members got an empty
                              queryset because their profile.client_id is null;
                              agency identity lives in AgencyMembership, not
                              UserProfile.client). The mixin walks
                              AgencyClientRelation status='active' rows.
  5. end-user with profile.client_id set → that single workspace
  6. fallback               → empty queryset

Never trusts client_id from the request body — always derives it from the
authenticated user's profile / membership.

Note: a near-duplicate copy of this class lives in `whatsapp_views.py` for
historical reasons. Both were updated together here; consolidating
them is a future cleanup.
"""
from typing import Optional

from rest_framework.exceptions import PermissionDenied


class TenantScopedMixin:
    """
    Apply to a DRF ViewSet whose model has `client = ForeignKey(Client)`.

    Provides:
      - get_queryset() that filters by the user's tenant
      - perform_create() that stamps `client_id` (and `created_by` when the
        model has it) — never lets clients spoof another tenant.
      - resolved_client_id() helper for non-CRUD action endpoints.

    Subclasses should override `client_field_name` if their model uses a
    different attribute (e.g. `client` is hidden behind a join).
    """
    client_field_name = 'client'

    # ── Helpers ──────────────────────────────────────────────────────────
    def _profile(self):
        try:
            return self.request.user.profile
        except Exception:
            return None

    def _agency_client_ids(self, profile):
        """Active client ids managed by this user's primary agency. Empty list
        when the user isn't an agency member or has no active relations.

        Checks AgencyMembership.is_active so a user removed from the agency
        loses visibility immediately, even if profile.primary_agency_id is
        a stale field that wasn't cleared on removal.
        """
        agency_id = getattr(profile, 'primary_agency_id', None)
        if not agency_id:
            return []
        from .marketplace_models import AgencyClientRelation, AgencyMembership

        if not AgencyMembership.objects.filter(
            user=self.request.user, agency_id=agency_id, is_active=True,
        ).exists():
            return []

        return list(
            AgencyClientRelation.objects.filter(
                agency_id=agency_id, status='active',
            ).values_list('client_id', flat=True)
        )

    def resolved_client_id(self) -> Optional[int]:
        """Returns the client_id the current user is *allowed* to operate on."""
        profile = self._profile()
        if not profile:
            return None
        if profile.role == 'superadmin':
            cid = self.request.query_params.get('client_id') or self.request.data.get('client')
            try:
                return int(cid) if cid else None
            except (TypeError, ValueError):
                return None
        if profile.role == 'staff':
            cid = self.request.query_params.get('client_id') or self.request.data.get('client')
            try:
                cid = int(cid) if cid else None
            except (TypeError, ValueError):
                return None
            if cid and profile.assigned_clients.filter(id=cid).exists():
                return cid
            return None
        agency_ids = self._agency_client_ids(profile)
        if agency_ids:
            cid = self.request.query_params.get('client_id') or self.request.data.get('client')
            try:
                cid = int(cid) if cid else None
            except (TypeError, ValueError):
                cid = None
            if cid and cid in agency_ids:
                return cid
            return None
        return profile.client_id

    # ── DRF hooks ────────────────────────────────────────────────────────
    def get_queryset(self):
        qs = super().get_queryset()
        profile = self._profile()
        if not profile:
            return qs.none()

        f = self.client_field_name
        if profile.role == 'superadmin':
            cid = self.request.query_params.get('client_id')
            return qs.filter(**{f'{f}_id': cid}) if cid else qs
        if profile.role == 'staff':
            return qs.filter(**{f'{f}__in': profile.assigned_clients.all()})
        agency_ids = self._agency_client_ids(profile)
        if agency_ids:
            return qs.filter(**{f'{f}_id__in': agency_ids})
        if profile.client_id:
            return qs.filter(**{f'{f}_id': profile.client_id})
        return qs.none()

    def perform_create(self, serializer):
        client_id = self.resolved_client_id()
        if client_id is None:
            raise PermissionDenied('No client context available for this user')

        extra = {f'{self.client_field_name}_id': client_id}
        model = serializer.Meta.model
        field_names = {f.name for f in model._meta.get_fields()}
        if 'created_by' in field_names:
            extra['created_by'] = self.request.user
        serializer.save(**extra)

    _resolved_client_id = resolved_client_id
