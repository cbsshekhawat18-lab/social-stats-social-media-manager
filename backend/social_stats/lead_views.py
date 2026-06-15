# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Lead management API.

Endpoints:
    GET    /api/leads/                       (paginated list, rich filters)
    GET    /api/leads/<id>/
    PUT    /api/leads/<id>/                  (full update — name/notes/tags/etc.)
    DELETE /api/leads/<id>/
    POST   /api/leads/<id>/assign/           {user_id}
    POST   /api/leads/<id>/status/           {status, notes?}
    POST   /api/leads/<id>/activity/         {activity_type, content, metadata?}
    POST   /api/leads/<id>/convert/          {conversion_value}
    GET    /api/leads/<id>/timeline/         activities + bot conversation steps
    POST   /api/leads/bulk-assign/           {lead_ids[], user_id}
    GET    /api/leads/export.csv/            CSV download
    POST   /api/leads/import/                CSV upload (basic)
"""
from __future__ import annotations

import csv
import io
import logging

from django.contrib.auth.models import User
from django.db.models import Q, F
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .bot_serializers import (
    LeadListSerializer, LeadDetailSerializer, LeadActivitySerializer,
)
from .models import Lead, LeadActivity, BotConversationStep, WhatsAppContact
from .whatsapp_views import TenantScopedMixin


logger = logging.getLogger(__name__)


class LeadViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = Lead.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return LeadListSerializer
        return LeadDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset().select_related('contact', 'assigned_to', 'source_flow')
        p = self.request.query_params

        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('assigned_to'):
            try:
                qs = qs.filter(assigned_to_id=int(p['assigned_to']))
            except (TypeError, ValueError):
                pass
        if p.get('source_flow'):
            qs = qs.filter(source_flow_id=p['source_flow'])
        if p.get('source_campaign_id'):
            qs = qs.filter(source_campaign_id=p['source_campaign_id'])
        if p.get('source_ad_id'):
            qs = qs.filter(source_ad_id=p['source_ad_id'])
        if p.get('tag'):
            qs = qs.filter(tags__contains=[p['tag']])
        if p.get('q'):
            q = p['q']
            qs = qs.filter(
                Q(name__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q)
                | Q(interest__icontains=q) | Q(notes__icontains=q)
            )
        if p.get('min_score'):
            try:
                qs = qs.filter(quality_score__gte=int(p['min_score']))
            except ValueError:
                pass
        if p.get('from'):
            from django.utils.dateparse import parse_datetime
            dt = parse_datetime(p['from'])
            if dt: qs = qs.filter(created_at__gte=dt)
        if p.get('to'):
            from django.utils.dateparse import parse_datetime
            dt = parse_datetime(p['to'])
            if dt: qs = qs.filter(created_at__lte=dt)

        return qs.order_by('-created_at')

    # ── Single-lead actions ────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        lead = self.get_object()
        user_id = request.data.get('user_id')
        previous = lead.assigned_to_id

        if user_id in (None, '', 0):
            lead.assigned_to = None
        else:
            try:
                lead.assigned_to = User.objects.get(pk=int(user_id))
            except (User.DoesNotExist, TypeError, ValueError):
                return Response({'error': 'invalid user_id'}, status=400)
        lead.save(update_fields=['assigned_to'])

        LeadActivity.objects.create(
            lead=lead, actor=request.user, activity_type='assignment',
            content=f'Assigned to {lead.assigned_to.email if lead.assigned_to else "(unassigned)"}',
            metadata={'previous_user_id': previous, 'new_user_id': lead.assigned_to_id},
        )
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=['post', 'put'])
    def status(self, request, pk=None):
        lead = self.get_object()
        new_status = request.data.get('status')
        notes = (request.data.get('notes') or '').strip()
        valid = {choice[0] for choice in Lead.STATUS_CHOICES}
        if new_status not in valid:
            return Response({'error': f'invalid status; one of {sorted(valid)}'}, status=400)

        previous = lead.status
        lead.status = new_status
        if notes and not lead.notes:
            lead.notes = notes
        elif notes:
            lead.notes = f'{lead.notes}\n\n{notes}' if lead.notes else notes
        lead.save(update_fields=['status', 'notes'])

        LeadActivity.objects.create(
            lead=lead, actor=request.user, activity_type='status_change',
            content=f'Status: {previous} → {new_status}' + (f' — {notes}' if notes else ''),
            metadata={'previous': previous, 'new': new_status},
        )

        try:
            from .events.publisher import EventPublisher
            EventPublisher.publish(
                'lead.status_changed',
                client=lead.client,
                actor=request.user,
                payload={
                    'lead_id': lead.id,
                    'from_status': previous,
                    'to_status': new_status,
                },
            )
            if new_status == 'converted' and previous != 'converted':
                EventPublisher.publish(
                    'lead.converted',
                    client=lead.client,
                    actor=request.user,
                    payload={
                        'lead_id': lead.id,
                        'value': str(lead.conversion_value) if lead.conversion_value else None,
                    },
                )
        except Exception:
            pass

        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=['post'])
    def activity(self, request, pk=None):
        lead = self.get_object()
        activity_type = request.data.get('activity_type') or 'note'
        valid = {c[0] for c in LeadActivity._meta.get_field('activity_type').choices}
        if activity_type not in valid:
            return Response({'error': f'invalid activity_type; one of {sorted(valid)}'}, status=400)
        a = LeadActivity.objects.create(
            lead=lead, actor=request.user,
            activity_type=activity_type,
            content=(request.data.get('content') or '').strip(),
            metadata=request.data.get('metadata') or {},
        )
        return Response(LeadActivitySerializer(a).data, status=201)

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        lead = self.get_object()
        try:
            value = float(request.data.get('conversion_value') or 0)
        except (TypeError, ValueError):
            return Response({'error': 'invalid conversion_value'}, status=400)

        lead.status = 'converted'
        lead.conversion_value = value
        lead.converted_at = timezone.now()
        lead.save(update_fields=['status', 'conversion_value', 'converted_at'])

        LeadActivity.objects.create(
            lead=lead, actor=request.user, activity_type='status_change',
            content=f'Converted (₹{value:,.0f})',
            metadata={'conversion_value': value},
        )
        return Response(LeadDetailSerializer(lead).data)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """Merged timeline of LeadActivities + the bot conversation steps."""
        lead = self.get_object()
        activities = list(LeadActivitySerializer(lead.activities.all().order_by('-created_at'), many=True).data)
        bot_steps = []
        if lead.source_conversation_id:
            steps_qs = BotConversationStep.objects.filter(conversation_id=lead.source_conversation_id).order_by('-created_at')
            bot_steps = [{
                'id':         f'step-{s.id}',
                'kind':       'bot_step',
                'node_type':  s.node_type,
                'direction':  s.direction,
                'payload':    s.payload,
                'created_at': s.created_at.isoformat(),
            } for s in steps_qs]
        return Response({'activities': activities, 'bot_steps': bot_steps})

    # ── Bulk + import / export ─────────────────────────────────────────────
    @action(detail=False, methods=['post'], url_path='bulk-assign')
    def bulk_assign(self, request):
        ids = request.data.get('lead_ids') or []
        user_id = request.data.get('user_id')
        if not isinstance(ids, list) or not ids:
            return Response({'error': 'lead_ids must be a non-empty list'}, status=400)
        try:
            user = User.objects.get(pk=int(user_id)) if user_id else None
        except (User.DoesNotExist, TypeError, ValueError):
            return Response({'error': 'invalid user_id'}, status=400)

        qs = self.get_queryset().filter(pk__in=ids)
        count = qs.update(assigned_to=user)
        for lead_id in qs.values_list('id', flat=True):
            LeadActivity.objects.create(
                lead_id=lead_id, actor=request.user, activity_type='assignment',
                content=f'Bulk-assigned to {user.email if user else "(unassigned)"}',
                metadata={'bulk': True, 'new_user_id': user.id if user else None},
            )
        return Response({'updated': count})

    @action(detail=False, methods=['get'], url_path='export.csv')
    def export_csv(self, request):
        qs = self.get_queryset().iterator()
        response = StreamingHttpResponse(_csv_iter(qs), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="leads-{timezone.now().date().isoformat()}.csv"'
        return response

    @action(detail=True, methods=['post'], url_path='score-with-ai')
    def score_with_ai(self, request, pk=None):
        """Use Claude Haiku to score the lead 0-100 with a one-line reason.
        Reads captured fields + the source conversation steps for context."""
        lead = self.get_object()

        # Build a compact context from the bot conversation
        history = []
        if lead.source_conversation_id:
            steps = (BotConversationStep.objects
                     .filter(conversation_id=lead.source_conversation_id)
                     .order_by('created_at')[:30])
            for s in steps:
                text = (s.payload or {}).get('text') or (s.payload or {}).get('body') or ''
                if not text: continue
                who = 'User' if s.direction == 'user_to_bot' else 'Assistant'
                history.append(f'{who}: {text}')

        captured = {
            'name': lead.name, 'phone': lead.phone, 'email': lead.email,
            'interest': lead.interest, 'budget': lead.budget, 'location': lead.location,
            'tags': lead.tags, 'custom': lead.custom_fields,
            'source_ad': lead.source_ad_name or lead.source_ad_id,
            'source_campaign': lead.source_campaign_name or lead.source_campaign_id,
        }

        prompt = (
            'Score this lead from 0 to 100 based on how likely they are to convert. '
            '0 = clearly low intent / spam, 100 = high intent + budget + clear ask.\n\n'
            f'Captured info:\n{captured}\n\n'
            'Conversation:\n' + '\n'.join(history[-20:]) + '\n\n'
            'Respond with EXACTLY two lines:\n'
            '  Line 1: just the integer score (0-100).\n'
            '  Line 2: one sentence (max 30 words) explaining the score — '
            'mention budget, urgency, specificity, and any red flags.'
        )

        try:
            from .ai.client import AIClient
            ai = AIClient(client=lead.client, user=request.user, feature='ctwa_lead_score')
            raw = ai.complete(
                prompt=prompt, system='You are a senior sales analyst.',
                max_tokens=120, temperature=0.3, fast=True, use_cache=False,
            ).strip()
        except Exception as e:  # noqa: BLE001
            return Response({'error': f'AI scoring failed: {e}'}, status=502)

        # Parse "score\nreason"
        parts = raw.split('\n', 1)
        try:
            score = max(0, min(100, int(''.join(c for c in parts[0] if c.isdigit() or c == '-')[:4])))
        except (ValueError, TypeError):
            score = 50
        reason = (parts[1].strip() if len(parts) > 1 else '').strip()[:500]

        lead.quality_score = score
        lead.quality_reason = reason or lead.quality_reason
        lead.save(update_fields=['quality_score', 'quality_reason'])

        LeadActivity.objects.create(
            lead=lead, actor=request.user, activity_type='note',
            content=f'AI scored {score}/100: {reason}'[:500],
            metadata={'ai_score': score, 'ai_reason': reason},
        )
        return Response({'quality_score': score, 'quality_reason': reason})

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """Best-effort CSV import. Required columns: name, phone. Optional:
        email, interest, budget, location, notes, tags (comma-separated)."""
        client_id = self._resolved_client_id()
        if not client_id:
            return Response({'error': 'no client context'}, status=403)
        f = request.FILES.get('file')
        if not f:
            return Response({'error': 'attach a CSV file as form-field "file"'}, status=400)
        try:
            text = f.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response({'error': 'CSV must be UTF-8'}, status=400)
        reader = csv.DictReader(io.StringIO(text))

        created = 0; skipped = 0
        for row in reader:
            phone = (row.get('phone') or '').strip()
            if not phone:
                skipped += 1
                continue
            contact, _ = WhatsAppContact.objects.get_or_create(
                client_id=client_id, phone=phone,
                defaults={'name': row.get('name', ''), 'email': row.get('email', '')},
            )
            tags = [t.strip() for t in (row.get('tags') or '').split(',') if t.strip()]
            Lead.objects.create(
                client_id=client_id, contact=contact,
                name=(row.get('name') or contact.name or '')[:200],
                phone=phone[:30],
                email=(row.get('email') or '')[:254],
                interest=(row.get('interest') or '')[:200],
                budget=(row.get('budget') or '')[:100],
                location=(row.get('location') or '')[:200],
                notes=(row.get('notes') or ''),
                tags=tags,
                source_channel='import_csv',
            )
            created += 1
        return Response({'created': created, 'skipped': skipped})


def _csv_iter(rows):
    """Stream a CSV row-by-row so big exports don't hog a worker."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    header = [
        'id', 'created_at', 'status', 'name', 'phone', 'email',
        'interest', 'budget', 'location',
        'source_flow_id', 'source_campaign_id', 'source_ad_id', 'source_ad_name',
        'assigned_email', 'tags', 'quality_score', 'conversion_value',
    ]
    writer.writerow(header)
    yield buf.getvalue(); buf.seek(0); buf.truncate()

    for r in rows:
        writer.writerow([
            r.id,
            r.created_at.isoformat() if r.created_at else '',
            r.status, r.name, r.phone, r.email,
            r.interest, r.budget, r.location,
            r.source_flow_id or '',
            r.source_campaign_id, r.source_ad_id, r.source_ad_name,
            r.assigned_to.email if r.assigned_to else '',
            ','.join(r.tags or []),
            r.quality_score,
            float(r.conversion_value) if r.conversion_value is not None else '',
        ])
        yield buf.getvalue(); buf.seek(0); buf.truncate()
