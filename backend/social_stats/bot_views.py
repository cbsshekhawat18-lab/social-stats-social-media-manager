# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
CTWA Bot REST API.

ViewSets:
    BotFlowViewSet         /api/bot-flows/        + duplicate / publish / unpublish / test / validate / analytics
    BotTemplateViewSet     /api/bot-templates/    + use (clone into a new BotFlow)
    BotConversationViewSet /api/bot-conversations/+ handoff / end
    CTWACampaignViewSet    /api/ctwa-campaigns/   + analytics / sync_meta

All viewsets use the existing TenantScopedMixin from whatsapp_views.py for
tenant isolation: queries are filtered by the user's accessible client_id
and writes stamp client_id from the user, never the request body.

Permissions are coarse-grained at this layer (IsAuthenticated). Page-level
permission codes (`bot.view`, `bot.publish`, etc.) are seeded into
PERMISSION_PAGE_GROUPS in and enforced via PermissionGate on the
frontend; backend-level enforcement layers on later if/when needed.
"""
from __future__ import annotations

import copy
import logging
from collections import Counter

from django.db.models import F, Count, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .bot_serializers import (
    BotFlowListSerializer, BotFlowDetailSerializer, BotFlowVersionSerializer,
    BotKnowledgeDocSerializer,
    BotFlowTemplateSerializer,
    BotConversationListSerializer, BotConversationDetailSerializer,
    CTWACampaignSerializer,
)
from .models import (
    BotConversation, BotFlow, BotFlowTemplate, BotFlowVersion, BotKnowledgeDoc,
    CTWACampaign,
)
from .whatsapp_views import TenantScopedMixin
from .bot_engine import analytics as bot_analytics


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# BotFlowViewSet
# ─────────────────────────────────────────────────────────────────────────────
class BotFlowViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = BotFlow.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return BotFlowListSerializer
        return BotFlowDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related('client', 'created_by')
        # Optional filter helpers
        params = self.request.query_params
        if params.get('trigger_type'):
            qs = qs.filter(trigger_type=params['trigger_type'])
        if params.get('active') in ('1', 'true', 'True'):
            qs = qs.filter(is_active=True)
        elif params.get('active') in ('0', 'false', 'False'):
            qs = qs.filter(is_active=False)
        if params.get('q'):
            qs = qs.filter(Q(name__icontains=params['q']) | Q(description__icontains=params['q']))
        return qs.order_by('-updated_at')

    def perform_create(self, serializer):
        client_id = self._resolved_client_id()
        if client_id is None:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No client context for this user.')
        serializer.save(client_id=client_id, created_by=self.request.user)

    # ── Custom actions ────────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        original = self.get_object()
        copy_of = BotFlow.objects.create(
            client=original.client,
            name=f'{original.name} (copy)',
            description=original.description,
            trigger_type=original.trigger_type,
            trigger_config=copy.deepcopy(original.trigger_config or {}),
            nodes=copy.deepcopy(original.nodes or []),
            edges=copy.deepcopy(original.edges or []),
            starting_node_id=original.starting_node_id,
            is_active=False,
            is_template=False,
            business_hours_only=original.business_hours_only,
            business_hours=copy.deepcopy(original.business_hours or {}),
            out_of_hours_message=original.out_of_hours_message,
            ai_fallback_enabled=original.ai_fallback_enabled,
            ai_fallback_persona=original.ai_fallback_persona,
            created_by=request.user,
        )
        return Response(BotFlowDetailSerializer(copy_of).data, status=201)

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        flow = self.get_object()
        result = _validate_flow(flow)
        return Response(result)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        flow = self.get_object()
        from .marketplace_permissions import (
            check_action, deny_response, approval_pending_response,
        )
        verdict, ctx = check_action(
            request, flow.client, 'manage_bots',
            action_type='publish_bot',
            payload={'flow_id': flow.id, 'flow_name': flow.name, 'version': flow.version},
            target_object_type='BotFlow',
            target_object_id=flow.id,
            preview=f'Publish bot flow "{flow.name}" v{flow.version}',
        )
        if verdict == 'denied':
            return deny_response(ctx['reason'])
        if verdict == 'approval_required':
            return approval_pending_response(ctx['approval'])

        result = _validate_flow(flow)
        if not result['ok']:
            return Response({'error': 'flow validation failed', 'issues': result['issues'],
                             'errors': result['errors']}, status=400)
        snapshot_flow(flow, user=request.user)
        data = BotFlowDetailSerializer(flow).data
        data['warnings'] = [i for i in result['errors'] if i['level'] == 'warning']
        return Response(data)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Published snapshots of this flow, newest first."""
        flow = self.get_object()
        rows = flow.versions.select_related('published_by').order_by('-version')
        return Response({
            'published_version': flow.published_version,
            'results': BotFlowVersionSerializer(rows, many=True, context={'flow': flow}).data,
        })

    @action(detail=True, methods=['post'])
    def rollback(self, request, pk=None):
        """Restore the graph of an earlier published version.

        Body: {version: <int>}. The draft graph is replaced by that snapshot;
        if the flow is live, new conversations use it from now on.
        Conversations already running stay on the version they started with.
        """
        flow = self.get_object()
        try:
            number = int(request.data.get('version'))
        except (TypeError, ValueError):
            return Response({'error': 'version (integer) is required'}, status=400)
        target = flow.versions.filter(version=number).first()
        if not target:
            return Response({'error': f'version {number} not found for this flow'}, status=404)

        from .marketplace_permissions import (
            check_action, deny_response, approval_pending_response,
        )
        verdict, ctx = check_action(
            request, flow.client, 'manage_bots',
            action_type='publish_bot',
            payload={'flow_id': flow.id, 'flow_name': flow.name, 'rollback_to_version': number},
            target_object_type='BotFlow',
            target_object_id=flow.id,
            preview=f'Roll back bot flow "{flow.name}" to v{number}',
        )
        if verdict == 'denied':
            return deny_response(ctx['reason'])
        if verdict == 'approval_required':
            return approval_pending_response(ctx['approval'])

        flow.nodes = copy.deepcopy(target.nodes or [])
        flow.edges = copy.deepcopy(target.edges or [])
        flow.starting_node_id = target.starting_node_id
        update = ['nodes', 'edges', 'starting_node_id', 'updated_at']
        if flow.is_active:
            flow.published_version = target.version
            flow.last_published_at = timezone.now()
            update += ['published_version', 'last_published_at']
        flow.save(update_fields=update)
        return Response(BotFlowDetailSerializer(flow).data)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        flow = self.get_object()
        from .marketplace_permissions import (
            check_action, deny_response, approval_pending_response,
        )
        verdict, ctx = check_action(
            request, flow.client, 'manage_bots',
            action_type='unpublish_bot',
            payload={'flow_id': flow.id, 'flow_name': flow.name},
            target_object_type='BotFlow',
            target_object_id=flow.id,
            preview=f'Unpublish bot flow "{flow.name}"',
        )
        if verdict == 'denied':
            return deny_response(ctx['reason'])
        if verdict == 'approval_required':
            return approval_pending_response(ctx['approval'])

        flow.is_active = False
        flow.save(update_fields=['is_active'])
        return Response(BotFlowDetailSerializer(flow).data)

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Trigger the flow against a tester phone (the test mode runs the engine
        synchronously with a pinbot stand-in if RUN_TEST_MODE is configured;
        otherwise we let the real Pinbot account send the messages)."""
        flow = self.get_object()
        phone = (request.data.get('phone') or '').strip()
        if not phone:
            return Response({'error': 'phone is required'}, status=400)

        from .models import WhatsAppContact
        contact, _ = WhatsAppContact.objects.get_or_create(
            client=flow.client, phone=phone,
            defaults={'name': 'Tester', 'tags': ['__bot_test__']},
        )

        starting = flow.starting_node_id
        if not starting:
            return Response({'error': 'flow has no starting node'}, status=400)

        # End any prior test conversation for this contact + flow so the test
        # always starts clean.
        BotConversation.objects.filter(
            client=flow.client, contact=contact, flow=flow, status='active',
        ).update(status='exited', ended_at=timezone.now())

        # Test runs use the draft graph (no pinned version), so unpublished
        # edits can be tried before going live.
        conv = BotConversation.objects.create(
            client=flow.client, flow=flow, contact=contact,
            triggered_via='manual',
            trigger_metadata={'test_run': True, 'tester_user_id': request.user.id},
            current_node_id=starting,
            path_history=[starting],
        )
        BotFlow.objects.filter(pk=flow.pk).update(total_triggered=F('total_triggered') + 1)
        from .bot_engine.executor import BotExecutor
        BotExecutor(conv).execute_node(starting)
        conv.refresh_from_db()
        out = {'conversation_id': conv.id, 'status': 'started', 'conversation_status': conv.status}
        if conv.status == 'failed':
            err = conv.steps.filter(node_type='_error').order_by('-created_at').first()
            out['error'] = (err.payload or {}).get('error', '') if err else ''
            if out['error'] == 'outside_24h_window':
                out['hint'] = ('WhatsApp only delivers free-form messages within 24 hours of the '
                               "contact's last message. Send any message from the test phone to "
                               'your WhatsApp number, then run the test again.')
        return Response(out)

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        """Funnel + per-node drop-off for this flow.

        `node_funnel` (entered / exited / waiting / dropped off per node, from
        the step audit trail) and `ctwa_funnel` (ad → conversation → lead →
        converted, with cost per lead) accept `?days=N`; the older keys are
        all-time, as before.
        """
        flow = self.get_object()
        days = None
        if request.query_params.get('days'):
            try:
                days = max(1, min(int(request.query_params['days']), 365))
            except (TypeError, ValueError):
                days = None
        convs = BotConversation.objects.filter(flow=flow)
        total = convs.count()
        completed = convs.filter(status='completed').count()
        abandoned = convs.filter(status='abandoned').count()
        handed_off = convs.filter(status='handed_off').count()
        leads = convs.filter(lead_captured=True).count()

        # Drop-off per node — count how many path_histories ended at each node
        drop_off = Counter()
        for hist in convs.filter(status__in=['abandoned', 'failed']).values_list('path_history', flat=True):
            if hist:
                drop_off[hist[-1]] += 1

        # Most-frequent terminal nodes for completed convs (success funnel)
        success_funnel = Counter()
        for hist in convs.filter(status='completed').values_list('path_history', flat=True):
            for node_id in (hist or []):
                success_funnel[node_id] += 1

        return Response({
            'totals': {
                'triggered': flow.total_triggered,
                'started':   total,
                'completed': completed,
                'abandoned': abandoned,
                'handed_off': handed_off,
                'leads_captured': leads,
            },
            'completion_rate':    round(completed / total * 100, 1) if total else 0,
            'lead_capture_rate':  round(leads / total * 100, 1)     if total else 0,
            'top_drop_off_nodes': drop_off.most_common(10),
            'success_funnel':     success_funnel.most_common(20),
            'days':               days,
            'node_funnel':        bot_analytics.node_funnel(flow, days),
            'ctwa_funnel':        bot_analytics.ctwa_funnel(flow, days),
        })


# ─────────────────────────────────────────────────────────────────────────────
# BotTemplateViewSet
# ─────────────────────────────────────────────────────────────────────────────
class BotTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    """Templates are global (no tenant scoping) — read-only for now."""
    queryset = BotFlowTemplate.objects.all().order_by('-is_featured', '-use_count', '-created_at')
    serializer_class = BotFlowTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('industry'):
            qs = qs.filter(industry=params['industry'])
        if params.get('use_case'):
            qs = qs.filter(use_case=params['use_case'])
        if params.get('featured') in ('1', 'true', 'True'):
            qs = qs.filter(is_featured=True)
        return qs

    @action(detail=True, methods=['post'])
    def use(self, request, pk=None):
        """Clone the template into a fresh, draft BotFlow for the calling client."""
        template = self.get_object()
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return Response({'error': 'no profile'}, status=403)

        if profile.role == 'superadmin':
            cid = request.query_params.get('client_id') or request.data.get('client_id')
            try: client_id = int(cid) if cid else None
            except (TypeError, ValueError): client_id = None
        elif profile.role == 'staff':
            cid = request.data.get('client_id') or request.query_params.get('client_id')
            try: cid = int(cid) if cid else None
            except (TypeError, ValueError): cid = None
            client_id = cid if cid and profile.assigned_clients.filter(id=cid).exists() else None
        else:
            client_id = profile.client_id

        if not client_id:
            return Response({'error': 'no client context'}, status=403)

        flow = BotFlow.objects.create(
            client_id=client_id,
            name=request.data.get('name') or template.name,
            description=template.description,
            trigger_type='ctwa_ad',
            trigger_config={},
            nodes=copy.deepcopy(template.nodes or []),
            edges=copy.deepcopy(template.edges or []),
            starting_node_id=template.starting_node_id,
            is_active=False,
            created_by=request.user,
        )
        BotFlowTemplate.objects.filter(pk=template.pk).update(use_count=F('use_count') + 1)
        return Response(BotFlowDetailSerializer(flow).data, status=201)


# ─────────────────────────────────────────────────────────────────────────────
# BotConversationViewSet
# ─────────────────────────────────────────────────────────────────────────────
class BotConversationViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = BotConversation.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return BotConversationListSerializer
        return BotConversationDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related('flow', 'contact', 'lead', 'handed_off_to_user')
        params = self.request.query_params
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('flow'):
            qs = qs.filter(flow_id=params['flow'])
        if params.get('lead_captured') in ('1', 'true'):
            qs = qs.filter(lead_captured=True)
        if params.get('q'):
            qs = qs.filter(contact__name__icontains=params['q'])
        return qs.order_by('-started_at').prefetch_related('steps')

    @action(detail=True, methods=['post'])
    def handoff(self, request, pk=None):
        conv = self.get_object()
        if conv.status != 'active':
            return Response({'error': f'conversation status={conv.status}; cannot hand off'}, status=400)
        from .bot_engine.handlers.smart import handle_human_handoff
        from .bot_engine.executor import BotExecutor
        # Synthesise a node so the handler can run
        synthetic = {'id': '__manual_handoff__', 'type': 'human_handoff', 'data': {
            'message': request.data.get('message') or 'Connecting you to a teammate…',
            'assignee_user_id': request.data.get('assignee_user_id') or request.user.id,
        }}
        handle_human_handoff(BotExecutor(conv), synthetic)
        return Response(BotConversationDetailSerializer(conv).data)

    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        conv = self.get_object()
        if conv.status != 'active':
            return Response({'error': f'conversation status={conv.status}; cannot end'}, status=400)
        conv.status = 'exited'
        conv.ended_at = timezone.now()
        conv.save(update_fields=['status', 'ended_at'])
        return Response(BotConversationDetailSerializer(conv).data)

    @action(detail=False, methods=['get'], url_path='handoff-queue')
    def handoff_queue(self, request):
        """handoff inbox for the calling user.

        Returns conversations in `handed_off` status that are either
        explicitly assigned to the user OR (when `?include_unassigned=1`)
        any handoff in their workspace that hasn't been picked up yet.
        """
        qs = self.get_queryset().filter(status='handed_off')
        include_unassigned = request.query_params.get('include_unassigned') in ('1', 'true')
        if include_unassigned:
            from django.db.models import Q
            qs = qs.filter(Q(handed_off_to_user=request.user) | Q(handed_off_to_user__isnull=True))
        else:
            qs = qs.filter(handed_off_to_user=request.user)
        qs = qs.order_by('-handed_off_at')[:200]
        return Response({
            'count':   qs.count() if hasattr(qs, 'count') else len(qs),
            'results': BotConversationListSerializer(qs, many=True).data,
        })


# ─────────────────────────────────────────────────────────────────────────────
# CTWACampaignViewSet
# ─────────────────────────────────────────────────────────────────────────────
class CTWACampaignViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = CTWACampaign.objects.all()
    serializer_class = CTWACampaignSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().select_related('flow').order_by('-created_at')

    def perform_create(self, serializer):
        client_id = self._resolved_client_id()
        if client_id is None:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No client context for this user.')
        serializer.save(client_id=client_id)

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        camp = self.get_object()
        # Time-series — daily leads + conversations for the last 30 days
        from .models import Lead
        thirty_ago = timezone.now() - timezone.timedelta(days=30)
        leads_qs = Lead.objects.filter(
            source_campaign_id=camp.campaign_id, created_at__gte=thirty_ago,
        ).extra({'date': "date(created_at)"}).values('date').annotate(c=Count('id')).order_by('date')
        conv_qs = BotConversation.objects.filter(
            client=camp.client, flow=camp.flow, started_at__gte=thirty_ago,
        ).extra({'date': "date(started_at)"}).values('date').annotate(c=Count('id')).order_by('date')

        cpl = (float(camp.total_spent) / camp.total_leads) if camp.total_leads and camp.total_spent else None
        return Response({
            'totals': {
                'clicks':         camp.total_clicks,
                'conversations':  camp.total_conversations,
                'leads':          camp.total_leads,
                'spent':          float(camp.total_spent or 0),
                'cpl':            round(cpl, 2) if cpl else None,
            },
            'leads_per_day':         list(leads_qs),
            'conversations_per_day': list(conv_qs),
        })

    @action(detail=True, methods=['post'], url_path='sync-meta')
    def sync_meta(self, request, pk=None):
        """Trigger a one-off Meta Insights sync for this campaign.'s
        daily Celery task runs the same path."""
        camp = self.get_object()
        from .meta_ads_views import sync_campaign_spend
        result = sync_campaign_spend(camp)
        return Response(result)

    @action(detail=True, methods=['get'], url_path='ad-breakdown')
    def ad_breakdown(self, request, pk=None):
        """per-ad performance breakdown (last 30 days).

        Lazily called by the campaign detail page so the main /analytics
        response stays snappy.
        """
        camp = self.get_object()
        from .meta_ads_views import fetch_per_ad_insights
        return Response(fetch_per_ad_insights(camp))


# ─────────────────────────────────────────────────────────────────────────────
# BotKnowledgeDocViewSet — knowledge base for ai_chat nodes
# ─────────────────────────────────────────────────────────────────────────────
class BotKnowledgeDocViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    """CRUD for the workspace's knowledge documents (/api/bot-knowledge/),
    plus `search` to preview what an AI chat node would be given."""
    queryset = BotKnowledgeDoc.objects.all()
    serializer_class = BotKnowledgeDocSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(content__icontains=q))
        return qs.order_by('-updated_at')

    def perform_create(self, serializer):
        client_id = self._resolved_client_id()
        if client_id is None:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No client context for this user.')
        serializer.save(client_id=client_id, created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def search(self, request):
        """Body: {query}. Returns the passages retrieval would hand the AI."""
        client_id = self._resolved_client_id()
        if client_id is None:
            return Response({'error': 'no client context'}, status=403)
        from .bot_engine.knowledge import retrieve
        passages = retrieve(client_id, str(request.data.get('query') or '')[:500])
        return Response({'results': [
            {'doc_id': p.doc_id, 'title': p.title, 'text': p.text, 'score': p.score} for p in passages
        ]})


# ─────────────────────────────────────────────────────────────────────────────
# Publishing = snapshotting
# ─────────────────────────────────────────────────────────────────────────────
def snapshot_flow(flow: BotFlow, *, user=None, note: str = '') -> BotFlowVersion:
    """Publish `flow`: freeze its current graph as a BotFlowVersion and point
    `published_version` at it. Re-publishing an unchanged graph reuses the
    latest snapshot instead of piling up identical copies."""
    latest = flow.versions.order_by('-version').first()
    if latest and (latest.nodes, latest.edges, latest.starting_node_id) == (
        flow.nodes or [], flow.edges or [], flow.starting_node_id or '',
    ):
        version = latest
    else:
        number = max((latest.version if latest else 0) + 1, flow.version or 1)
        version = BotFlowVersion.objects.create(
            flow=flow, version=number,
            nodes=copy.deepcopy(flow.nodes or []), edges=copy.deepcopy(flow.edges or []),
            starting_node_id=flow.starting_node_id or '',
            published_by=user if getattr(user, 'is_authenticated', False) else None,
            note=note[:200],
        )
    flow.is_active = True
    flow.version = version.version
    flow.published_version = version.version
    flow.last_published_at = timezone.now()
    flow.save(update_fields=['is_active', 'version', 'published_version', 'last_published_at'])
    return version


# ─────────────────────────────────────────────────────────────────────────────
# Flow validator (used by validate + publish)
# ─────────────────────────────────────────────────────────────────────────────
def _validate_flow(flow: BotFlow) -> dict:
    """Run bot_engine.flow_validator on the draft graph.

    Returns {ok, errors: [{node_id, level, message}], issues: [str], …}.
    `errors` carries both levels; only level="error" blocks publishing.
    """
    from .bot_engine.flow_validator import validate_flow

    # A flow with exactly one Start node doesn't need starting_node_id set by hand.
    starts = [n for n in (flow.nodes or []) if n.get('type') == 'start']
    if len(starts) == 1 and flow.starting_node_id != starts[0].get('id'):
        flow.starting_node_id = starts[0].get('id', '')
        flow.save(update_fields=['starting_node_id'])
    return validate_flow(flow)


# ─────────────────────────────────────────────────────────────────────────────
_BOT_SETTING_FIELDS = (
    'bot_enabled',
    'bot_max_msgs_per_minute',
    'bot_max_msgs_per_conv',
    'bot_spam_threshold',
    'bot_abandon_after_minutes',
)


def _resolve_setting_client_id(request) -> int | None:
    """Same shape as TenantScopedMixin._resolved_client_id, without inheritance."""
    profile = getattr(request.user, 'profile', None)
    if not profile:
        return None
    if profile.role == 'superadmin':
        cid = request.query_params.get('client_id') or request.data.get('client_id')
        try: return int(cid) if cid else None
        except (TypeError, ValueError): return None
    if profile.role == 'staff':
        cid = request.query_params.get('client_id') or request.data.get('client_id')
        try: cid = int(cid) if cid else None
        except (TypeError, ValueError): cid = None
        return cid if cid and profile.assigned_clients.filter(id=cid).exists() else None
    return profile.client_id


from rest_framework.decorators import api_view, permission_classes


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def bot_settings(request):
    """GET/PUT the workspace's bot safety + kill-switch settings."""
    from .models import Client
    client_id = _resolve_setting_client_id(request)
    if not client_id:
        return Response({'error': 'no client context'}, status=403)
    client = Client.objects.filter(pk=client_id).first()
    if not client:
        return Response({'error': 'client not found'}, status=404)

    if request.method == 'GET':
        return Response({f: getattr(client, f) for f in _BOT_SETTING_FIELDS})

    # PUT — only update fields the caller actually sent.
    update = []
    for f in _BOT_SETTING_FIELDS:
        if f in request.data:
            v = request.data[f]
            if f == 'bot_enabled':
                setattr(client, f, bool(v))
            else:
                # Clamp to sane ranges to prevent disabling safety entirely or
                # capping so high it's effectively unlimited.
                try:
                    n = int(v)
                except (TypeError, ValueError):
                    continue
                if f == 'bot_max_msgs_per_minute':
                    n = max(1, min(n, 600))
                elif f == 'bot_max_msgs_per_conv':
                    n = max(10, min(n, 10000))
                elif f == 'bot_spam_threshold':
                    n = max(1, min(n, 50))
                elif f == 'bot_abandon_after_minutes':
                    n = max(5, min(n, 43200))   # 5 minutes … 30 days
                setattr(client, f, n)
            update.append(f)
    if update:
        client.save(update_fields=update)

    return Response({f: getattr(client, f) for f in _BOT_SETTING_FIELDS})
