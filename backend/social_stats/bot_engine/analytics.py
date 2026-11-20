# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Flow analytics computed from the conversation audit trail.

node_funnel(flow)  — per node: how many conversations entered it, went on,
                     are still waiting there, or dropped off there.
ctwa_funnel(flow)  — per linked CTWA campaign: ad clicks → conversations →
                     leads → converted, with spend and cost per lead.

Both are scoped to the flow's own client.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Optional

from django.db.models import Count, OuterRef, Q, Subquery, Sum
from django.utils import timezone

from ..bot_models import NODE_TYPES

# A conversation that ended in one of these states stopped short at its last node.
DROP_STATUSES = ('abandoned', 'failed', 'exited')


def _conversations(flow, days: Optional[int] = None):
    from ..models import BotConversation
    qs = (BotConversation.objects
          .filter(client_id=flow.client_id, flow=flow)
          .exclude(trigger_metadata__has_key='out_of_hours'))   # never ran the flow
    if days:
        qs = qs.filter(started_at__gte=timezone.now() - timedelta(days=days))
    return qs


def _summary(node: dict) -> str:
    d = node.get('data') or {}
    text = d.get('text') or d.get('question') or d.get('body') or d.get('message') \
        or d.get('opening_message') or d.get('template_name') or d.get('list_name') or ''
    text = ' '.join(str(text).split())
    return text[:80] + ('…' if len(text) > 80 else '')


def _graph_order(nodes: list, edges: list, start_id: str) -> list[str]:
    """Node ids in the order a conversation meets them (breadth-first from Start)."""
    out_edges = defaultdict(list)
    for e in edges or []:
        out_edges[e.get('source')].append(e.get('target'))
    ids = [n.get('id') for n in nodes or []]
    if start_id not in ids:
        start_id = next((n.get('id') for n in nodes or [] if n.get('type') == 'start'), ids[0] if ids else '')
    order, seen, queue = [], set(), [start_id]
    while queue:
        cur = queue.pop(0)
        if cur in seen or cur not in ids:
            continue
        seen.add(cur)
        order.append(cur)
        queue.extend(out_edges.get(cur, []))
    return order + [i for i in ids if i not in seen]


def node_funnel(flow, days: Optional[int] = None) -> list[dict]:
    from ..models import BotConversationStep
    from .runner import published_version_of

    convs = _conversations(flow, days)

    entered = dict(
        BotConversationStep.objects
        .filter(conversation__in=convs).exclude(node_id='')
        .values_list('node_id').annotate(n=Count('conversation', distinct=True))
        .values_list('node_id', 'n')
    )

    last_step = (BotConversationStep.objects
                 .filter(conversation=OuterRef('pk')).exclude(node_id='')
                 .order_by('-created_at', '-id').values('node_id')[:1])
    dropped, waiting = defaultdict(int), defaultdict(int)
    for row in (convs.annotate(last_node=Subquery(last_step))
                .values('last_node', 'status').annotate(n=Count('id'))):
        if not row['last_node']:
            continue
        if row['status'] in DROP_STATUSES:
            dropped[row['last_node']] += row['n']
        elif row['status'] == 'active':
            waiting[row['last_node']] += row['n']

    graph = published_version_of(flow) or flow
    by_id = {n.get('id'): n for n in (graph.nodes or [])}
    order = _graph_order(graph.nodes or [], graph.edges or [], graph.starting_node_id or '')
    order += sorted(i for i in entered if i not in by_id and not i.startswith('__'))

    rows = []
    for node_id in order:
        node = by_id.get(node_id)
        n_entered = entered.get(node_id, 0)
        n_dropped, n_waiting = dropped.get(node_id, 0), waiting.get(node_id, 0)
        rows.append({
            'node_id': node_id,
            'node_type': node.get('type') if node else '',
            'label': NODE_TYPES.get(node.get('type'), node.get('type') or '') if node else 'Removed node',
            'summary': _summary(node) if node else '',
            'in_current_version': node is not None,
            'entered': n_entered,
            'exited': max(0, n_entered - n_dropped - n_waiting),
            'waiting': n_waiting,
            'dropped_off': n_dropped,
            'drop_off_rate': round(n_dropped / n_entered * 100, 1) if n_entered else 0,
        })
    return rows


def _rate(part, whole) -> Optional[float]:
    return round(part / whole * 100, 1) if whole else None


def _per(amount: float, count: int) -> Optional[float]:
    return round(amount / count, 2) if count and amount else None


def ctwa_funnel(flow, days: Optional[int] = None) -> dict:
    """Ad click → conversation → lead → converted, per CTWA campaign linked to
    this flow. Spend and clicks come from CTWACampaign (synced from Meta, and
    cumulative — they are not cut to `days`); conversations and leads are
    counted from our own rows."""
    from ..models import CTWACampaign, Lead

    convs = _conversations(flow, days).filter(triggered_via='ctwa_ad')
    leads = Lead.objects.filter(client_id=flow.client_id, source_flow=flow)
    if days:
        leads = leads.filter(created_at__gte=timezone.now() - timedelta(days=days))

    campaigns = []
    for camp in CTWACampaign.objects.filter(client_id=flow.client_id, flow=flow).order_by('-created_at'):
        ad_ids = [str(a) for a in (camp.ad_ids or []) if a]
        conv_q = Q(trigger_metadata__ctwa_campaign_id=camp.id)
        lead_q = Q(source_conversation__trigger_metadata__ctwa_campaign_id=camp.id)
        if ad_ids:
            conv_q |= Q(trigger_metadata__ad_id__in=ad_ids)
            lead_q |= Q(source_ad_id__in=ad_ids)
        if camp.campaign_id:
            lead_q |= Q(source_campaign_id=camp.campaign_id)
        camp_leads = leads.filter(lead_q).distinct()
        n_conv = convs.filter(conv_q).count()
        n_leads = camp_leads.count()
        won = camp_leads.filter(status='converted')
        n_converted = won.count()
        revenue = float(won.aggregate(v=Sum('conversion_value'))['v'] or 0)
        spent = float(camp.total_spent or 0)
        campaigns.append({
            'id': camp.id, 'name': camp.name, 'campaign_id': camp.campaign_id,
            'is_active': camp.is_active, 'last_synced_at': camp.last_synced_at,
            'clicks': camp.total_clicks, 'conversations': n_conv,
            'leads': n_leads, 'converted': n_converted,
            'spent': spent, 'revenue': revenue,
            'click_to_conversation_rate': _rate(n_conv, camp.total_clicks),
            'conversation_to_lead_rate': _rate(n_leads, n_conv),
            'lead_to_converted_rate': _rate(n_converted, n_leads),
            'cost_per_conversation': _per(spent, n_conv),
            'cost_per_lead': _per(spent, n_leads),
            'cost_per_conversion': _per(spent, n_converted),
        })

    def total(key):
        return sum(c[key] or 0 for c in campaigns)

    spent, n_leads, n_conv, n_won = total('spent'), total('leads'), total('conversations'), total('converted')
    return {
        'campaigns': campaigns,
        'totals': {
            'clicks': total('clicks'), 'conversations': n_conv, 'leads': n_leads, 'converted': n_won,
            'spent': round(spent, 2), 'revenue': round(total('revenue'), 2),
            'conversation_to_lead_rate': _rate(n_leads, n_conv),
            'lead_to_converted_rate': _rate(n_won, n_leads),
            'cost_per_lead': _per(spent, n_leads),
            'cost_per_conversion': _per(spent, n_won),
        },
    }
