# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
REST API for the Unified Composer.

ViewSets:
  - UnifiedPostViewSet  — CRUD + publish_now / schedule / duplicate / add_to_queue / preview
  - MediaAssetViewSet   — list / retrieve / delete + upload (single + bulk)
  - PostQueueViewSet    — CRUD + add_items / reorder / pause / resume

APIView:
  - PreflightCheckView  — POST a draft post; returns per-platform validation
                          summary BEFORE publishing.

All viewsets use TenantScopedMixin to enforce tenant isolation; client_id is
always derived from the authenticated user — never trusted from the body.
"""
from __future__ import annotations

import logging
from typing import Optional

from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .composer_serializers import (
    UnifiedPostSerializer, UnifiedPostListSerializer,
    MediaAssetSerializer, PostQueueSerializer, QueuedItemSerializer,
)
from .models import (
    UnifiedPost, MediaAsset, PostQueue, QueuedItem,
    PlatformCredential,
)
from .orchestrator import publish_unified_post
from .publishers import get_publisher
from . import media_service
from .tenant_mixins import TenantScopedMixin
from .marketplace_permissions import (
    check_action, deny_response, approval_pending_response,
)
from .activity_logger import log_activity_for_request

logger = logging.getLogger(__name__)


# ── Unified posts ─────────────────────────────────────────────────────────────
class UnifiedPostViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = UnifiedPost.objects.prefetch_related('publish_logs').all()

    def get_serializer_class(self):
        if self.action == 'list':
            return UnifiedPostListSerializer
        return UnifiedPostSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('platform'):
            qs = qs.filter(target_platforms__contains=[params['platform']])
        return qs

    # ── — close audit gap 4.2: create/update/destroy were ungated ─
    # The publish path (publish_now) already calls check_action for
    # 'publish_posts'. CRUD must also enforce the matching marketplace keys
    # so an agency without `draft_posts` can't sneak in posts via POST and
    # an agency without `delete_posts` can't DELETE through the front door.
    # We use check_action manually rather than UnifiedPermission to keep the
    # diff narrow and match the existing publish_now style. End users (role
    # 'owner') and superadmins always pass — only marketplace agencies hit
    # the gate. Approval-required outcomes return a 202 just like publish_now.

    def _gate_or_pending(self, action_key: str, *, action_type: str, payload: dict | None = None,
                         target_object_id: int | None = None, preview: str = ''):
        """Run check_action; return None on allowed, or a Response to short-circuit."""
        client_id = self.request.data.get('client') or self.request.data.get('client_id')
        if not client_id and target_object_id:
            try:
                client_id = UnifiedPost.objects.values_list('client_id', flat=True).get(id=target_object_id)
            except UnifiedPost.DoesNotExist:
                return None
        if not client_id:
            # The view's own validation will surface a clearer error.
            return None
        from .models import Client
        client = Client.objects.filter(id=client_id).first()
        if not client:
            return None
        verdict, ctx = check_action(
            self.request, client, action_key,
            action_type=action_type,
            payload=payload or {},
            target_object_type='UnifiedPost',
            target_object_id=target_object_id,
            preview=preview,
        )
        if verdict == 'denied':
            return deny_response(ctx['reason'])
        if verdict == 'approval_required':
            return approval_pending_response(ctx['approval'])
        return None

    def create(self, request, *args, **kwargs):
        denial = self._gate_or_pending(
            'draft_posts',
            action_type='draft_post',
            payload={'platforms': list(request.data.get('target_platforms') or [])},
            preview=(request.data.get('content') or '')[:300],
        )
        if denial is not None:
            return denial
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # Resolve the target post to evaluate its client. TenantScopedMixin
        # already filters get_object() to the active client, so the lookup
        # is safe.
        post = self.get_object()
        verdict, ctx = check_action(
            request, post.client, 'delete_posts',
            action_type='delete_post',
            payload={'post_id': post.id, 'platforms': list(post.target_platforms or [])},
            target_object_type='UnifiedPost',
            target_object_id=post.id,
            preview=(post.content or '')[:300],
        )
        if verdict == 'denied':
            return deny_response(ctx['reason'])
        if verdict == 'approval_required':
            return approval_pending_response(ctx['approval'])
        return super().destroy(request, *args, **kwargs)

    # ── Custom actions ───────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def publish_now(self, request, pk=None):
        post = self.get_object()
        if post.status not in ('draft', 'scheduled', 'failed', 'partial', 'pending_approval'):
            return Response(
                {'detail': f'Cannot publish a post in status {post.status}'},
                status=400,
            )

        # Marketplace gate (): if the actor is agency-side, must hold
        # the publish_posts permission; if it's flagged for approval, intercept.
        verdict, ctx = check_action(
            request, post.client, 'publish_posts',
            action_type='publish_post',
            payload={
                'post_id':    post.id,
                'platforms':  list(post.target_platforms or []),
                'scheduled':  False,
            },
            target_object_type='UnifiedPost',
            target_object_id=post.id,
            preview=(post.content or '')[:300],
        )
        if verdict == 'denied':
            return deny_response(ctx['reason'])
        if verdict == 'approval_required':
            return approval_pending_response(ctx['approval'])

        if post.client.requires_approval and not post.approved_by_id:
            post.status = 'pending_approval'
            post.save(update_fields=['status'])
            from .notification_watchers import notify_approver_for_post
            notify_approver_for_post.delay(post.id)
            return Response(
                {'detail': 'Post requires approval before publishing.', 'status': 'pending_approval'},
                status=202,
            )
        post.status = 'queued'
        post.scheduled_at = timezone.now()
        post.save(update_fields=['status', 'scheduled_at'])
        publish_unified_post.delay(post.id)

        log_activity_for_request(
            request, post.client,
            action_type='post_published',
            description=f'Published post to {", ".join(post.target_platforms or [])}',
            severity='notice',
            target_object_type='UnifiedPost',
            target_object_id=post.id,
            metadata={'platforms': list(post.target_platforms or [])},
            is_reversible=True,
        )
        return Response(UnifiedPostSerializer(post).data)

    @action(detail=True, methods=['post'])
    def schedule(self, request, pk=None):
        post = self.get_object()
        when = request.data.get('scheduled_at')
        if not when:
            return Response({'detail': 'scheduled_at is required (ISO 8601)'}, status=400)
        try:
            from django.utils.dateparse import parse_datetime
            dt = parse_datetime(when)
            if dt is None:
                raise ValueError
        except ValueError:
            return Response({'detail': 'Invalid scheduled_at — expected ISO 8601 datetime'}, status=400)
        if dt < timezone.now():
            return Response({'detail': 'scheduled_at must be in the future'}, status=400)
        post.scheduled_at = dt
        post.status = 'scheduled'
        post.save(update_fields=['scheduled_at', 'status'])
        return Response(UnifiedPostSerializer(post).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        post = self.get_object()
        if post.status in ('published', 'cancelled'):
            return Response({'detail': f'Already {post.status}'}, status=400)
        post.status = 'cancelled'
        post.save(update_fields=['status'])
        return Response(UnifiedPostSerializer(post).data)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        original = self.get_object()
        with transaction.atomic():
            copy = UnifiedPost.objects.create(
                client_id=original.client_id,
                created_by=request.user,
                title=(original.title or '') + ' (copy)',
                content=original.content,
                media_urls=list(original.media_urls or []),
                media_type=original.media_type,
                target_platforms=list(original.target_platforms or []),
                platform_overrides=dict(original.platform_overrides or {}),
                status='draft',
            )
            copy.media_assets.set(original.media_assets.all())
        return Response(UnifiedPostSerializer(copy).data, status=201)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        post = self.get_object()
        if post.status != 'pending_approval':
            return Response({'detail': f'Post is not pending approval (status={post.status})'}, status=400)
        post.approved_by = request.user
        post.approved_at = timezone.now()
        post.status = 'queued'
        post.scheduled_at = post.scheduled_at or timezone.now()
        post.save(update_fields=['approved_by', 'approved_at', 'status', 'scheduled_at'])
        publish_unified_post.delay(post.id)
        return Response(UnifiedPostSerializer(post).data)

    @action(detail=True, methods=['post'])
    def add_to_queue(self, request, pk=None):
        """Snapshot this post into a QueuedItem inside the named queue."""
        post = self.get_object()
        queue_id = request.data.get('queue_id')
        if not queue_id:
            return Response({'detail': 'queue_id is required'}, status=400)
        queue = PostQueue.objects.filter(id=queue_id, client_id=post.client_id).first()
        if not queue:
            return Response({'detail': 'Queue not found in this tenant'}, status=404)
        item = QueuedItem.objects.create(
            queue=queue,
            content=post.content,
            media_urls=list(post.media_urls or []),
            sort_order=(queue.items.count() + 1),
        )
        return Response(QueuedItemSerializer(item).data, status=201)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Return per-platform rendered preview with character counts + warnings."""
        post = self.get_object()
        previews = {}
        for platform in (post.target_platforms or []):
            overrides = (post.platform_overrides or {}).get(platform, {}) or {}
            content = overrides.get('content', post.content) or ''
            try:
                publisher = get_publisher(platform)
                max_text = getattr(publisher, 'MAX_TEXT_LENGTH', 0) or 0
            except NotImplementedError:
                publisher = None
                max_text = 0
            previews[platform] = {
                'content':       content,
                'media_urls':    overrides.get('media_urls', post.media_urls) or [],
                'character_count': len(content),
                'max_text_length': max_text,
                'over_limit':    max_text > 0 and len(content) > max_text,
                'media_type':    overrides.get('media_type', post.media_type),
                'supported':     bool(publisher and publisher.supports(post.media_type)),
            }
        return Response({'previews': previews})


# ── Media library ─────────────────────────────────────────────────────────────
class MediaAssetViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = MediaAsset.objects.all()
    serializer_class = MediaAssetSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('folder'):
            qs = qs.filter(folder=self.request.query_params['folder'])
        if self.request.query_params.get('mime'):
            qs = qs.filter(mime_type__startswith=self.request.query_params['mime'])
        return qs

    def create(self, request, *args, **kwargs):
        client_id = self.resolved_client_id()
        if not client_id:
            return Response({'detail': 'No client context'}, status=400)

        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'file is required (multipart "file")'}, status=400)

        asset = media_service.upload_media(
            upload,
            client_id=client_id,
            uploaded_by_id=request.user.id,
            folder=request.data.get('folder', ''),
            alt_text=request.data.get('alt_text', ''),
            tags=request.data.getlist('tags') if hasattr(request.data, 'getlist') else (request.data.get('tags') or []),
        )
        return Response(MediaAssetSerializer(asset).data, status=201)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def bulk_upload(self, request):
        client_id = self.resolved_client_id()
        if not client_id:
            return Response({'detail': 'No client context'}, status=400)
        files = request.FILES.getlist('files')
        if not files:
            return Response({'detail': 'files are required (multipart "files")'}, status=400)
        folder = request.data.get('folder', '')
        out, errors = [], []
        for f in files:
            try:
                asset = media_service.upload_media(
                    f, client_id=client_id, uploaded_by_id=request.user.id, folder=folder,
                )
                out.append(MediaAssetSerializer(asset).data)
            except Exception as e:
                logger.exception('bulk_upload failed for %s', f.name)
                errors.append({'file': f.name, 'error': str(e)})
        return Response({'created': out, 'errors': errors}, status=201 if out else 400)


# ── Queues ────────────────────────────────────────────────────────────────────
class PostQueueViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = PostQueue.objects.prefetch_related('items').all()
    serializer_class = PostQueueSerializer

    @action(detail=True, methods=['post'])
    def add_items(self, request, pk=None):
        queue = self.get_object()
        items = request.data.get('items') or []
        if not isinstance(items, list) or not items:
            return Response({'detail': 'items must be a non-empty list of {content, media_urls?, hashtags?}'}, status=400)
        from django.db.models import Max
        next_order = (queue.items.aggregate(m=Max('sort_order'))['m'] or 0) + 1
        created = []
        for entry in items:
            qi = QueuedItem.objects.create(
                queue=queue,
                content=(entry or {}).get('content', ''),
                media_urls=(entry or {}).get('media_urls') or [],
                hashtags=(entry or {}).get('hashtags') or [],
                sort_order=next_order,
            )
            next_order += 1
            created.append(QueuedItemSerializer(qi).data)
        return Response({'created': created}, status=201)

    @action(detail=True, methods=['post'])
    def reorder(self, request, pk=None):
        queue = self.get_object()
        order = request.data.get('order') or []
        if not isinstance(order, list):
            return Response({'detail': 'order must be a list of item IDs in the desired order'}, status=400)
        items_by_id = {i.id: i for i in queue.items.filter(id__in=order)}
        for idx, item_id in enumerate(order, start=1):
            item = items_by_id.get(int(item_id))
            if item:
                item.sort_order = idx
                item.save(update_fields=['sort_order'])
        return Response({'ok': True, 'reordered': len(items_by_id)})

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        queue = self.get_object()
        queue.is_active = False
        queue.save(update_fields=['is_active'])
        return Response({'is_active': False})

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        queue = self.get_object()
        queue.is_active = True
        queue.save(update_fields=['is_active'])
        return Response({'is_active': True})


# ── Preflight ─────────────────────────────────────────────────────────────────
class PreflightCheckView(APIView):
    """
    POST: validate a draft post against each target platform's rules
    BEFORE publishing. Returns `{ok, platforms: {platform: {ok, errors, warnings}}}`.

    Body: same shape as a UnifiedPost (content, media_type, target_platforms,
          media_urls, media_assets, platform_overrides). No DB writes.
    """
    def post(self, request):
        data = request.data or {}
        content = (data.get('content') or '')
        media_type = (data.get('media_type') or 'text').lower()
        media_urls = data.get('media_urls') or []
        media_asset_ids = data.get('media_assets') or []
        targets = [str(p).lower() for p in (data.get('target_platforms') or [])]
        overrides = data.get('platform_overrides') or {}

        # Resolve referenced MediaAssets within this tenant for size/format checks
        client_id = self._resolve_client_id(request, data)
        assets = []
        if media_asset_ids and client_id:
            assets = list(MediaAsset.objects.filter(
                id__in=media_asset_ids, client_id=client_id,
            ))

        results = {}
        any_block = False
        for platform in targets:
            o = overrides.get(platform, {}) or {}
            p_content    = o.get('content', content)
            p_media_type = o.get('media_type', media_type)

            errors, warnings = [], []

            # Capability + text length
            try:
                publisher = get_publisher(platform)
                max_text  = getattr(publisher, 'MAX_TEXT_LENGTH', 0) or 0
                if not publisher.supports(p_media_type):
                    errors.append(f'{platform} does not support media_type={p_media_type}')
                if max_text and p_content and len(p_content) > max_text:
                    errors.append(f'Text exceeds {platform} max ({len(p_content)}/{max_text})')
            except NotImplementedError:
                errors.append(f'No publisher available for {platform}')
                results[platform] = {'ok': False, 'errors': errors, 'warnings': warnings}
                any_block = True
                continue

            # Per-asset platform validation
            for asset in assets:
                vr = media_service.validate_for_platform(asset, platform, p_media_type)
                if vr.errors:
                    errors.extend([f'asset#{asset.id}: {e}' for e in vr.errors])
                if vr.warnings:
                    warnings.extend([f'asset#{asset.id}: {w}' for w in vr.warnings])

            # Active credential check
            if client_id:
                has_cred = PlatformCredential.objects.filter(
                    client_id=client_id, platform=platform, is_active=True,
                ).exists()
                if not has_cred:
                    errors.append(f'No active {platform} credential — connect first')

            ok = not errors
            if not ok:
                any_block = True
            results[platform] = {'ok': ok, 'errors': errors, 'warnings': warnings}

        return Response({'ok': not any_block, 'platforms': results})

    def _resolve_client_id(self, request, data) -> Optional[int]:
        try:
            profile = request.user.profile
        except Exception:
            return None
        if profile.role == 'superadmin':
            cid = request.query_params.get('client_id') or data.get('client')
            try:
                return int(cid) if cid else None
            except (TypeError, ValueError):
                return None
        if profile.role == 'staff':
            cid = request.query_params.get('client_id') or data.get('client')
            try:
                cid = int(cid) if cid else None
            except (TypeError, ValueError):
                return None
            if cid and profile.assigned_clients.filter(id=cid).exists():
                return cid
            return None
        return profile.client_id
