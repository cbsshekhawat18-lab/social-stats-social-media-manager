# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Unified DRF permission class.

`UnifiedPermission` is the single permission class viewsets should declare.
It wraps the existing `check_action()` helper from marketplace_permissions
and turns its three-state result (allowed / denied / approval_required) into
DRF's boolean `has_permission()` plus stashed view-state for downstream code.

Existing viewsets that already call `check_action()` directly keep working —
this class is additive infrastructure, not a forced rewrite. Use it when:

  • You're building a NEW viewset and want the policy applied automatically.
  • You're FIXING an audit-flagged viewset (Composer create/destroy, etc.) and
    the per-action approach is cleaner than scattering manual `check_action`
    calls through every method.

Usage:

    class UnifiedPostViewSet(TenantScopedMixin, ModelViewSet):
        permission_classes = [UnifiedPermission]
        per_action_permissions = {
            'create':         'draft_posts',
            'update':         'edit_published',
            'partial_update': 'edit_published',
            'destroy':        'delete_posts',
            # 'list' / 'retrieve' don't need a check (TenantScopedMixin gates).
        }

The class:
  1. Resolves the active client from URL kwargs / query params / profile.
  2. Calls `check_action(request, client, action_key)` with the right key.
  3. On 'allowed' → returns True. The view runs normally.
  4. On 'denied'  → returns False, DRF turns it into 403.
  5. On 'approval_required' → returns True (so the request flows through),
     but stashes `view.pending_approval = ApprovalRequest`. The view's
     `perform_create / perform_update / perform_destroy` (via the
     ApprovalAwareMixin) checks the flag and short-circuits to a 202.

Why allow approval_required to return True instead of False? Because returning
False would 403 the request — but the user IS allowed to attempt this; the
work just needs review first. Letting it through with a stashed marker keeps
the response semantics clean (202 "submitted for approval" not 403 "denied").
"""
from __future__ import annotations

import logging

from rest_framework.permissions import BasePermission

from .marketplace_permissions import check_action

logger = logging.getLogger(__name__)


class UnifiedPermission(BasePermission):
    """Single permission class for all viewsets — wraps marketplace check_action."""

    # DRF actions that don't mutate state and don't need an explicit permission
    # gate (TenantScopedMixin already isolates queries by client).
    READ_ACTIONS = frozenset(['list', 'retrieve', 'metadata'])

    def has_permission(self, request, view) -> bool:
        # 1. Auth — same gate every other class enforces.
        if not request.user.is_authenticated:
            return False

        # 2. Find the action permission key. Per-action override > viewset-wide
        #    `required_action_permission` > nothing (read access only).
        action_key = self._resolve_action_key(view)
        if action_key is None:
            # No mutation gate declared. Treat as "authenticated read" — the
            # view's queryset filtering (via TenantScopedMixin) does the rest.
            return True

        # 3. Resolve the client we're acting on. Without a client, we can't
        #    evaluate marketplace permissions — fall back to allowing
        #    superadmins only.
        client = self._resolve_client(request, view)
        if client is None:
            profile = getattr(request.user, 'profile', None)
            return profile is not None and profile.role == 'superadmin'

        # 4. Delegate to the existing check_action helper.
        result, ctx = check_action(request, client, action_key)

        if result == 'allowed':
            view.unified_role     = ctx.get('role')
            view.unified_relation = ctx.get('relation')
            return True

        if result == 'approval_required':
            # Stash the approval so the ApprovalAwareMixin can short-circuit
            # the view's perform_* method to a 202 response.
            view.pending_approval = ctx.get('approval')
            view.unified_relation = ctx.get('relation')
            view.unified_role     = 'agency'
            return True  # see docstring — approval_required isn't 403

        # 'denied' — record reason for the 403 envelope.
        view.unified_denial_reason = ctx.get('reason', 'permission denied')
        logger.info(
            'UnifiedPermission denied %s on %s for client#%s: %s',
            action_key, view.__class__.__name__, client.id,
            view.unified_denial_reason,
        )
        return False

    # ── helpers ────────────────────────────────────────────────────────
    @classmethod
    def _resolve_action_key(cls, view) -> str | None:
        """Pick the marketplace permission key for the current DRF action."""
        action = getattr(view, 'action', None)
        if action in cls.READ_ACTIONS:
            return None

        per_action = getattr(view, 'per_action_permissions', None) or {}
        if action and action in per_action:
            return per_action[action]

        # Fallback to the viewset-wide setting (works with custom @action methods).
        return getattr(view, 'required_action_permission', None)

    @staticmethod
    def _resolve_client(request, view):
        """Find the Client this request is acting on. Order:
          1. View kwargs (`client_id` or `pk` for ClientViewSet)
          2. Query string (`?client_id=...`)
          3. Existing TenantScopedMixin context (if the mixin has stored it)
          4. End-user-owned workspace (one client per user)
        """
        from .models import Client

        # 1. URL kwarg
        client_id = view.kwargs.get('client_id') if hasattr(view, 'kwargs') else None
        if client_id:
            return Client.objects.filter(id=client_id).first()

        # 2. Query string
        client_id = request.query_params.get('client_id') if hasattr(request, 'query_params') else None
        if client_id and str(client_id).isdigit():
            return Client.objects.filter(id=int(client_id)).first()

        # 3. Already-stashed by middleware/mixin
        if hasattr(request, 'client_context') and request.client_context:
            return request.client_context

        # 4. End-user-owned workspace fallback
        profile = getattr(request.user, 'profile', None)
        if profile and profile.client_id:
            return profile.client

        # End-users own a Client via Client.owner_user
        owned = Client.objects.filter(owner_user=request.user).first()
        return owned


# ─────────────────────────────────────────────────────────────────────────────
# Mixin that intercepts approval-required mutations
# ─────────────────────────────────────────────────────────────────────────────
class ApprovalAwareMixin:
    """Mixin for viewsets that may need their mutations intercepted for approval.

    When `UnifiedPermission` finds an `approval_required` result, it sets
    `view.pending_approval = ApprovalRequest`. This mixin checks for that
    flag in perform_create/update/destroy and raises a special exception so
    the response becomes a 202 "submitted for approval" instead of executing.

    Add to viewsets that should support the workflow:

        class UnifiedPostViewSet(ApprovalAwareMixin, TenantScopedMixin, ModelViewSet):
            ...

    The view's `create`/`update`/`destroy` then returns the stashed approval
    via `_approval_pending_response()`.
    """

    def perform_create(self, serializer):
        if self._intercept_for_approval(serializer.validated_data):
            return
        return super().perform_create(serializer)

    def perform_update(self, serializer):
        if self._intercept_for_approval(serializer.validated_data):
            return
        return super().perform_update(serializer)

    def perform_destroy(self, instance):
        approval = getattr(self, 'pending_approval', None)
        if approval is not None:
            self._stash_approval_for_response(approval, target_id=instance.pk)
            return  # don't actually delete
        return super().perform_destroy(instance)

    def finalize_response(self, request, response, *args, **kwargs):
        """Promote the stashed approval payload to a 202 response."""
        from .marketplace_permissions import approval_pending_response
        approval = getattr(self, '_intercepted_approval', None)
        if approval is not None:
            response = approval_pending_response(approval)
        return super().finalize_response(request, response, *args, **kwargs)

    # ── helpers ────────────────────────────────────────────────────────
    def _intercept_for_approval(self, validated_data) -> bool:
        approval = getattr(self, 'pending_approval', None)
        if approval is None:
            return False
        # Persist payload onto the approval row so the executor can re-run
        # the original action when the owner approves it. We avoid double-
        # writing — check_action already created the row; this just augments
        # it with the validated payload (which the perm class couldn't see).
        try:
            approval.payload = approval.payload or {}
            approval.payload.update({
                # Serialize anything JSON-safe; skip unserializable values.
                k: v for k, v in (validated_data or {}).items()
                if _json_safe(v)
            })
            approval.save(update_fields=['payload'])
        except Exception:
            # Approval row exists; payload augment is best-effort.
            pass
        self._stash_approval_for_response(approval)
        return True

    def _stash_approval_for_response(self, approval, target_id=None):
        self._intercepted_approval = approval
        if target_id is not None and not approval.target_object_id:
            approval.target_object_id = target_id
            try:
                approval.save(update_fields=['target_object_id'])
            except Exception:
                pass


def _json_safe(v) -> bool:
    """Best-effort: treat dicts/lists/scalars as safe; skip Django models / files."""
    if v is None:
        return True
    if isinstance(v, (str, int, float, bool, list, dict)):
        return True
    return False
