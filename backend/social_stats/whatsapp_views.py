# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""DRF ViewSets and APIViews for the WhatsApp module."""
import csv
import io
import logging
from datetime import date, timedelta
from typing import Optional

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Client,
    WhatsAppAccount, WhatsAppContact, WhatsAppContactList,
    WhatsAppTemplate, WhatsAppCampaign, WhatsAppMessage,
)
from .whatsapp_serializers import (
    WhatsAppAccountSerializer, WhatsAppContactSerializer,
    WhatsAppContactListSerializer, WhatsAppTemplateSerializer,
    WhatsAppCampaignSerializer, WhatsAppMessageSerializer,
    WhatsAppContactSummarySerializer,
)
from .whatsapp_service import (
    PinbotError, PinbotAuthError, get_pinbot_for_client,
)
from .whatsapp_tasks import (
    sync_account_status, run_whatsapp_campaign, sync_whatsapp_templates,
    send_whatsapp_message,
)
from .marketplace_permissions import (
    check_action, deny_response, approval_pending_response,
)
from .activity_logger import log_activity_for_request

logger = logging.getLogger(__name__)


# ── Tenant-isolation mixin ──────────────────────────────────────────────────
from .tenant_mixins import TenantScopedMixin  # noqa: F401


# ── Accounts ──────────────────────────────────────────────────────────────────
class WhatsAppAccountViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = WhatsAppAccount.objects.all()
    serializer_class = WhatsAppAccountSerializer

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        account = self.get_object()
        try:
            svc = get_pinbot_for_client(account.client_id)
            details = svc.get_user_details()
            return Response({'ok': True, 'details': details})
        except PinbotAuthError as e:
            return Response({'ok': False, 'error': 'auth', 'detail': str(e)}, status=400)
        except PinbotError as e:
            return Response({'ok': False, 'error': 'api', 'detail': str(e)}, status=400)
        except Exception as e:
            return Response({'ok': False, 'error': 'unknown', 'detail': str(e)}, status=400)

    @action(detail=True, methods=['post'])
    def sync_status(self, request, pk=None):
        account = self.get_object()
        sync_account_status.delay(account.client_id)
        return Response({'queued': True})


# ── Contacts ──────────────────────────────────────────────────────────────────
class WhatsAppContactViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = WhatsAppContact.objects.all()
    serializer_class = WhatsAppContactSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('opt_in_status'):
            qs = qs.filter(opt_in_status=params['opt_in_status'])
        if params.get('search'):
            term = params['search']
            qs = qs.filter(Q(phone__icontains=term) | Q(name__icontains=term) | Q(email__icontains=term))
        return qs

    @action(detail=False, methods=['post'], url_path='import_csv')
    def import_csv(self, request):
        """Upload a CSV and create/update WhatsAppContact rows."""
        client_id = self._resolved_client_id()
        if not client_id:
            return Response({'error': 'No client context'}, status=400)

        upload = request.FILES.get('file')
        if not upload:
            return Response({'error': 'file is required (multipart "file")'}, status=400)

        try:
            text = upload.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response({'error': 'CSV must be UTF-8 encoded'}, status=400)

        reader = csv.DictReader(io.StringIO(text))
        created, updated, skipped, errors = 0, 0, 0, []

        try:
            import phonenumbers
        except ImportError:
            phonenumbers = None

        for i, row in enumerate(reader, start=2):  # row 2 = first data row
            phone = (row.get('phone') or row.get('Phone') or '').strip()
            if not phone:
                skipped += 1
                continue

            # Normalize phone to E.164 if possible
            if phonenumbers:
                try:
                    parsed = phonenumbers.parse(phone, None)
                    if not phonenumbers.is_valid_number(parsed):
                        errors.append({'row': i, 'phone': phone, 'reason': 'invalid'})
                        skipped += 1
                        continue
                    phone = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
                except phonenumbers.NumberParseException:
                    errors.append({'row': i, 'phone': phone, 'reason': 'unparseable'})
                    skipped += 1
                    continue

            name  = (row.get('name')  or row.get('Name')  or '').strip()
            email = (row.get('email') or row.get('Email') or '').strip()
            tags_raw = row.get('tags') or row.get('Tags') or ''
            tags = [t.strip() for t in tags_raw.split(',') if t.strip()]

            obj, created_flag = WhatsAppContact.objects.update_or_create(
                client_id=client_id,
                phone=phone,
                defaults={'name': name, 'email': email, 'tags': tags},
            )
            if created_flag:
                created += 1
            else:
                updated += 1

        return Response({'created': created, 'updated': updated, 'skipped': skipped, 'errors': errors[:50]})

    @action(detail=False, methods=['post'])
    def bulk_opt_in(self, request):
        ids = request.data.get('ids') or []
        n = self.get_queryset().filter(id__in=ids).update(
            opt_in_status='opted_in', opt_in_at=timezone.now()
        )
        return Response({'updated': n})

    @action(detail=False, methods=['post'])
    def bulk_opt_out(self, request):
        ids = request.data.get('ids') or []
        n = self.get_queryset().filter(id__in=ids).update(opt_in_status='opted_out')
        return Response({'updated': n})

    @action(detail=False, methods=['post'])
    def add_to_list(self, request):
        ids = request.data.get('ids') or []
        list_id = request.data.get('list_id')
        if not list_id:
            return Response({'error': 'list_id is required'}, status=400)

        contacts = list(self.get_queryset().filter(id__in=ids))
        try:
            target = WhatsAppContactList.objects.get(id=list_id, client_id=self._resolved_client_id())
        except WhatsAppContactList.DoesNotExist:
            return Response({'error': 'list not found'}, status=404)
        target.contacts.add(*contacts)
        return Response({'added': len(contacts)})

    @action(detail=False, methods=['get'], url_path='export_csv')
    def export_csv(self, request):
        from django.http import HttpResponse
        qs = self.get_queryset()
        resp = HttpResponse(content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="whatsapp_contacts.csv"'
        writer = csv.writer(resp)
        writer.writerow(['phone', 'name', 'email', 'opt_in_status', 'tags'])
        for c in qs.iterator():
            writer.writerow([c.phone, c.name, c.email, c.opt_in_status, ','.join(c.tags or [])])
        return resp


# ── Lists ─────────────────────────────────────────────────────────────────────
class WhatsAppContactListViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = WhatsAppContactList.objects.all()
    serializer_class = WhatsAppContactListSerializer

    @action(detail=True, methods=['post'])
    def add_contacts(self, request, pk=None):
        target = self.get_object()
        ids = request.data.get('ids') or []
        contacts = WhatsAppContact.objects.filter(id__in=ids, client_id=target.client_id)
        target.contacts.add(*contacts)
        return Response({'added': contacts.count()})

    @action(detail=True, methods=['post'])
    def remove_contacts(self, request, pk=None):
        target = self.get_object()
        ids = request.data.get('ids') or []
        target.contacts.remove(*WhatsAppContact.objects.filter(id__in=ids))
        return Response({'removed': len(ids)})


# ── Templates ─────────────────────────────────────────────────────────────────
class WhatsAppTemplateViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = WhatsAppTemplate.objects.all()
    serializer_class = WhatsAppTemplateSerializer

    def perform_create(self, serializer):
        super().perform_create(serializer)
        instance = serializer.instance
        # Submit to Pinbot for review
        self._submit_to_pinbot(instance)

    def _submit_to_pinbot(self, instance):
        try:
            svc = get_pinbot_for_client(instance.client_id)
            payload = self._build_pinbot_template_payload(instance)
            response = svc.create_template(svc.waba_id, payload)
            tid = response.get('id') if isinstance(response, dict) else ''
            instance.pinbot_template_id = tid or instance.pinbot_template_id
            instance.status = 'pending'
            instance.save(update_fields=['pinbot_template_id', 'status'])
        except WhatsAppAccount.DoesNotExist:
            pass  # account not yet configured — leave as draft
        except PinbotError as e:
            logger.warning('Template submit failed: %s', e)
            instance.status = 'draft'
            instance.rejection_reason = str(e)[:500]
            instance.save(update_fields=['status', 'rejection_reason'])

    def _build_pinbot_template_payload(self, t: WhatsAppTemplate) -> dict:
        components = []
        if t.header:
            components.append({'type': 'HEADER', **t.header})
        components.append({'type': 'BODY', 'text': t.body})
        if t.footer:
            components.append({'type': 'FOOTER', 'text': t.footer})
        if t.buttons:
            components.append({'type': 'BUTTONS', 'buttons': t.buttons})
        return {
            'name':       t.name,
            'category':   t.category.upper(),
            'language':   t.language,
            'components': components,
        }

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        instance = self.get_object()
        self._submit_to_pinbot(instance)
        return Response(WhatsAppTemplateSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        instance = self.get_object()
        sync_whatsapp_templates.delay(instance.client_id)
        return Response({'queued': True})

    @action(detail=True, methods=['post', 'get'])
    def preview(self, request, pk=None):
        instance = self.get_object()
        variables = request.data.get('variables', {}) if request.method == 'POST' else {}
        body = instance.body or ''
        for k, v in (variables or {}).items():
            body = body.replace(f'{{{{{k}}}}}', str(v))
        return Response({
            'header': instance.header,
            'body':   body,
            'footer': instance.footer,
            'buttons': instance.buttons,
        })


# ── Campaigns ─────────────────────────────────────────────────────────────────
class WhatsAppCampaignViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = WhatsAppCampaign.objects.select_related('template', 'contact_list').all()
    serializer_class = WhatsAppCampaignSerializer

    @action(detail=True, methods=['post'])
    def launch(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status not in ('draft', 'scheduled'):
            return Response({'error': f'Cannot launch a {campaign.status} campaign'}, status=400)
        if campaign.template.status != 'approved':
            return Response({'error': 'Template is not approved'}, status=400)
        opted_in = campaign.contact_list.contacts.filter(opt_in_status='opted_in').count()
        if opted_in == 0:
            return Response({'error': 'No opted-in contacts in this list'}, status=400)

        # Marketplace gate (): agency-side users need send_campaigns.
        verdict, ctx = check_action(
            request, campaign.client, 'send_campaigns',
            action_type='send_campaign',
            payload={
                'campaign_id': campaign.id,
                'template':    campaign.template.name,
                'audience':    opted_in,
            },
            target_object_type='WhatsAppCampaign',
            target_object_id=campaign.id,
            preview=f'{campaign.name} → {opted_in} contacts',
        )
        if verdict == 'denied':
            return deny_response(ctx['reason'])
        if verdict == 'approval_required':
            return approval_pending_response(ctx['approval'])

        campaign.status = 'scheduled'
        campaign.scheduled_at = campaign.scheduled_at or timezone.now()
        campaign.save(update_fields=['status', 'scheduled_at'])
        run_whatsapp_campaign.delay(campaign.id)

        log_activity_for_request(
            request, campaign.client,
            action_type='campaign_launched',
            description=f'Launched WhatsApp campaign "{campaign.name}" to {opted_in} contacts',
            severity='warning',
            target_object_type='WhatsAppCampaign',
            target_object_id=campaign.id,
            metadata={'audience_size': opted_in, 'template': campaign.template.name},
            is_reversible=False,
        )
        return Response(WhatsAppCampaignSerializer(campaign).data)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        campaign = self.get_object()
        campaign.status = 'paused'
        campaign.save(update_fields=['status'])
        return Response({'status': 'paused'})

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status != 'paused':
            return Response({'error': 'Campaign is not paused'}, status=400)
        campaign.status = 'running'
        campaign.save(update_fields=['status'])
        return Response({'status': 'running'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status in ('completed', 'cancelled'):
            return Response({'error': f'Already {campaign.status}'}, status=400)
        campaign.status = 'cancelled'
        campaign.completed_at = timezone.now()
        campaign.save(update_fields=['status', 'completed_at'])
        return Response({'status': 'cancelled'})

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        campaign = self.get_object()
        breakdown = (WhatsAppMessage.objects
                     .filter(campaign=campaign)
                     .values('status')
                     .annotate(count=Count('id')))
        return Response({
            'total':     campaign.total_count,
            'sent':      campaign.sent_count,
            'delivered': campaign.delivered_count,
            'read':      campaign.read_count,
            'failed':    campaign.failed_count,
            'progress_percent': campaign.progress_percent,
            'by_status': {row['status']: row['count'] for row in breakdown},
        })

    @action(detail=True, methods=['post'])
    def retry_failed(self, request, pk=None):
        campaign = self.get_object()
        failed = WhatsAppMessage.objects.filter(campaign=campaign, status='failed')
        count = 0
        for msg in failed.iterator():
            msg.status = 'queued'
            msg.error_code = ''
            msg.error_message = ''
            msg.save(update_fields=['status', 'error_code', 'error_message'])
            send_whatsapp_message.apply_async(args=[msg.id], countdown=count * 0.05)
            count += 1
        # Decrement failed_count
        WhatsAppCampaign.objects.filter(id=campaign.id).update(failed_count=0)
        if campaign.status in ('completed', 'failed'):
            campaign.status = 'running'
            campaign.completed_at = None
            campaign.save(update_fields=['status', 'completed_at'])
        return Response({'requeued': count})


# ── Messages (read-only) ──────────────────────────────────────────────────────
class WhatsAppMessageViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = WhatsAppMessage.objects.select_related('contact').all()
    serializer_class = WhatsAppMessageSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('campaign'):
            qs = qs.filter(campaign_id=params['campaign'])
        if params.get('contact'):
            qs = qs.filter(contact_id=params['contact'])
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('from'):
            try:
                qs = qs.filter(created_at__date__gte=date.fromisoformat(params['from']))
            except ValueError:
                pass
        if params.get('to'):
            try:
                qs = qs.filter(created_at__date__lte=date.fromisoformat(params['to']))
            except ValueError:
                pass
        return qs


# ── Dashboard ─────────────────────────────────────────────────────────────────
def _resolve_client_id_for_view(request) -> Optional[int]:
    try:
        profile = request.user.profile
    except Exception:
        return None
    if profile.role == 'superadmin':
        cid = request.query_params.get('client_id')
        try:
            return int(cid) if cid else None
        except (TypeError, ValueError):
            return None
    if profile.role == 'staff':
        cid = request.query_params.get('client_id')
        try:
            cid = int(cid) if cid else None
        except (TypeError, ValueError):
            return None
        if cid and profile.assigned_clients.filter(id=cid).exists():
            return cid
        return None
    return profile.client_id


class WhatsAppDashboardView(APIView):
    def get(self, request):
        client_id = _resolve_client_id_for_view(request)
        qs = WhatsAppMessage.objects.all()
        if client_id:
            qs = qs.filter(client_id=client_id)
        else:
            try:
                if request.user.profile.role == 'staff':
                    qs = qs.filter(client__in=request.user.profile.assigned_clients.all())
            except Exception:
                pass

        today = timezone.now().date()
        week_ago  = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        outbound = qs.filter(direction='outbound')
        messages_today = outbound.filter(created_at__date=today).count()
        messages_week  = outbound.filter(created_at__date__gte=week_ago).count()
        messages_month = outbound.filter(created_at__date__gte=month_ago).count()

        delivered = outbound.filter(delivered_at__isnull=False, created_at__date__gte=month_ago).count()
        read      = outbound.filter(read_at__isnull=False, created_at__date__gte=month_ago).count()

        delivery_rate = (delivered / messages_month * 100) if messages_month else 0
        read_rate     = (read / messages_month * 100) if messages_month else 0

        active_campaigns_qs = WhatsAppCampaign.objects.filter(status__in=('scheduled', 'running'))
        if client_id:
            active_campaigns_qs = active_campaigns_qs.filter(client_id=client_id)
        active_campaigns = active_campaigns_qs.count()

        # Daily timeseries for the last 30 days
        time_series = []
        from collections import Counter
        rows = (outbound.filter(created_at__date__gte=month_ago)
                .extra({'d': "date(created_at)"})
                .values('d')
                .annotate(c=Count('id')))
        by_day = {str(r['d']): r['c'] for r in rows}
        for offset in range(30, -1, -1):
            d = today - timedelta(days=offset)
            time_series.append({'date': d.isoformat(), 'count': by_day.get(d.isoformat(), 0)})

        return Response({
            'messages_today':   messages_today,
            'messages_week':    messages_week,
            'messages_month':   messages_month,
            'delivery_rate':    round(delivery_rate, 2),
            'read_rate':        round(read_rate, 2),
            'active_campaigns': active_campaigns,
            'time_series':      time_series,
        })


class WhatsAppInboxView(APIView):
    """One conversation per contact: last message, unread count, 24h window flag."""
    def get(self, request):
        client_id = _resolve_client_id_for_view(request)
        contact_qs = WhatsAppContact.objects.all()
        if client_id:
            contact_qs = contact_qs.filter(client_id=client_id)

        # Only include contacts with at least one message
        contacts = (contact_qs.filter(messages__isnull=False)
                              .distinct()
                              .order_by('-last_message_at', '-last_inbound_at')[:200])

        results = []
        for c in contacts:
            last = c.messages.order_by('-created_at').first()
            unread = c.messages.filter(direction='inbound', read_at__isnull=True).count()
            results.append({
                'contact':       WhatsAppContactSummarySerializer(c).data,
                'last_message': {
                    'direction':    last.direction if last else None,
                    'message_type': last.message_type if last else None,
                    'preview':      _message_preview(last),
                    'created_at':   last.created_at.isoformat() if last else None,
                    'status':       last.status if last else None,
                },
                'unread_count':  unread,
                'within_24h':    c.within_24h_window,
                'last_inbound_at': c.last_inbound_at.isoformat() if c.last_inbound_at else None,
            })
        return Response({'results': results})


def _message_preview(msg):
    if not msg:
        return ''
    if msg.direction == 'inbound':
        body = (msg.payload or {}).get('text', {}).get('body') if isinstance(msg.payload, dict) else None
        return body or msg.message_type or ''
    if msg.message_type == 'text':
        return (msg.payload or {}).get('body') or ''
    if msg.message_type == 'template':
        tpl = (msg.payload or {}).get('template') or {}
        return f"[Template] {tpl.get('name', '')}"
    return f'[{msg.message_type}]'


class WhatsAppInboxThreadView(APIView):
    def get(self, request):
        contact_id = request.query_params.get('contact_id')
        if not contact_id:
            return Response({'error': 'contact_id is required'}, status=400)

        client_id = _resolve_client_id_for_view(request)
        try:
            contact = WhatsAppContact.objects.get(id=contact_id)
        except WhatsAppContact.DoesNotExist:
            return Response({'error': 'contact not found'}, status=404)

        # Tenant guard
        if client_id is not None and contact.client_id != client_id:
            return Response({'error': 'access denied'}, status=403)

        msgs = (WhatsAppMessage.objects
                .filter(contact=contact)
                .order_by('-created_at')[:100])
        return Response({
            'contact':  WhatsAppContactSerializer(contact).data,
            'messages': WhatsAppMessageSerializer(msgs, many=True).data,
        })


class WhatsAppSendDirectView(APIView):
    """Inbox replies: free-form within 24h window, otherwise must be template."""
    def post(self, request):
        contact_id = request.data.get('contact_id')
        msg_type = request.data.get('type', 'text')
        payload = request.data.get('payload') or {}

        if not contact_id:
            return Response({'error': 'contact_id is required'}, status=400)

        try:
            contact = WhatsAppContact.objects.get(id=contact_id)
        except WhatsAppContact.DoesNotExist:
            return Response({'error': 'contact not found'}, status=404)

        client_id = _resolve_client_id_for_view(request)
        if client_id is not None and contact.client_id != client_id:
            return Response({'error': 'access denied'}, status=403)

        if msg_type != 'template' and not contact.within_24h_window:
            return Response({
                'error': 'outside_24h_window',
                'detail': 'Only template messages are allowed when 24h window is closed',
            }, status=400)

        if contact.opt_in_status == 'opted_out':
            return Response({
                'error': 'contact_opted_out',
                'detail': 'This contact has opted out of WhatsApp messages.',
            }, status=403)

        from .security.wa_content_policy import check_content
        body_text = ''
        if msg_type == 'text':
            body_text = (payload.get('text') or {}).get('body') or payload.get('body') or ''
        elif msg_type == 'template':
            # Body comes from the template; skip pre-send check (Meta reviews
            # templates separately).
            body_text = ''
        decision = check_content(body_text)
        if not decision.allow:
            return Response({
                'error': 'content_policy_violation',
                'detail': f'Message blocked: {decision.category}.',
                'snippet': decision.snippet,
            }, status=400)
        if decision.reason.startswith('warn:'):
            from .security import audit
            audit.record(
                event_type='admin_action',
                actor_user=request.user, request=request,
                target_object_type='WhatsAppContact', target_object_id=contact.id,
                target_client=contact.client,
                description=f'WA content soft-flagged: {decision.category}',
                metadata={'category': decision.category, 'snippet': decision.snippet},
                severity='info',
            )

        msg = WhatsAppMessage.objects.create(
            client_id=contact.client_id,
            contact=contact,
            direction='outbound',
            message_type=msg_type,
            payload={'type': msg_type, **payload},
            status='queued',
        )
        send_whatsapp_message.delay(msg.id)
        return Response(WhatsAppMessageSerializer(msg).data, status=201)
