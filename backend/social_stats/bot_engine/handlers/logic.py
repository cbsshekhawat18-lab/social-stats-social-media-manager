# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""Logic handlers: condition + set_variable."""
from __future__ import annotations

from ..conditions import evaluate
from ..templates import render


def handle_condition(executor, node):
    """Branches via outgoing edges. The 'true' branch picks an edge whose
    `sourceHandle` is `'true'`; otherwise `'false'`. If neither side has a
    matching edge, advance via the first available edge.
    """
    cfg = (node.get('data') or {}).get('condition') or node.get('data') or {}
    result = bool(evaluate(cfg, executor.variables))
    branch = 'true' if result else 'false'
    executor.log_step(node, direction='system', payload={'result': result, 'branch': branch})
    return executor.advance_to_next(node['id'], branch=branch)


def handle_random_split(executor, node):
    """Pick a branch by weight. Edges out of this node should have a numeric
    `weight` on `data` (or `sourceHandle` like 'A'/'B'/'C'). When weights are
    missing, branches get equal probability.
    """
    import random

    edges_out = [e for e in (executor.flow.edges or []) if e.get('source') == node['id']]
    if not edges_out:
        executor.log_step(node, direction='system', payload={'note': 'no outgoing edges'})
        return executor.end_conversation('completed')

    weights = [max(0.0, float(e.get('data', {}).get('weight', 1) or 1)) for e in edges_out]
    total = sum(weights) or 1.0
    pick = random.random() * total
    cumulative = 0.0
    chosen = edges_out[0]
    for e, w in zip(edges_out, weights):
        cumulative += w
        if pick <= cumulative:
            chosen = e
            break

    branch = chosen.get('sourceHandle') or chosen.get('id')
    executor.log_step(node, direction='system', payload={
        'branch': branch, 'weights': weights, 'chosen_target': chosen.get('target'),
    })
    return executor.advance_to_next(node['id'], branch=branch)


def handle_jump_to_flow(executor, node):
    """Stop this conversation and start another flow for the same contact.

    data: { target_flow_id, carry_variables: bool (default True) }
    """
    from ...models import BotConversation, BotFlow
    data = node.get('data') or {}
    target_flow_id = data.get('target_flow_id') or data.get('flow_id')
    if not target_flow_id:
        executor.log_step(node, direction='system', payload={'error': 'jump_to_flow missing target_flow_id'})
        return executor.advance_to_next(node['id'])

    target = BotFlow.objects.filter(
        pk=target_flow_id, client_id=executor.client.id, is_active=True,
    ).first()
    if not target:
        executor.log_step(node, direction='system', payload={'error': f'target flow {target_flow_id} not active'})
        return executor.end_conversation('failed')

    carry = bool(data.get('carry_variables', True))
    inherited_vars = dict(executor.variables) if carry else {}
    # Strip engine-internal markers so we don't carry them into the next flow
    for k in ('_waiting_for', '_waiting_for_node'):
        inherited_vars.pop(k, None)

    # End current conversation
    executor.end_conversation('completed')

    # Start the new one immediately (no inbound message — synthetic trigger)
    starting = target.starting_node_id or _find_start(target)
    if not starting:
        return executor.conversation

    new_conv = BotConversation.objects.create(
        client_id=executor.client.id,
        flow=target,
        contact=executor.contact,
        triggered_via='manual',
        trigger_metadata={'jumped_from_conversation_id': executor.conversation.id},
        current_node_id=starting,
        path_history=[starting],
        variables=inherited_vars,
    )
    from django.db.models import F
    BotFlow.objects.filter(pk=target.pk).update(total_triggered=F('total_triggered') + 1)
    from ..executor import BotExecutor
    BotExecutor(new_conv, pinbot=executor._pinbot).execute_node(starting)
    return new_conv


def _find_start(flow):
    for n in (flow.nodes or []):
        if n.get('type') == 'start':
            return n.get('id')
    return None


def handle_set_variable(executor, node):
    """Set one or more variables. data: {assignments: [{name, value}, ...]}
    or shorthand {name, value}.

    Values are passed through the template renderer so you can do:
        name="full_name", value="{{first}} {{last}}"
    """
    data = node.get('data') or {}
    assignments = data.get('assignments')
    if not assignments and (data.get('name') or data.get('variable')):
        assignments = [{'name': data.get('name') or data.get('variable'), 'value': data.get('value', '')}]
    for a in (assignments or []):
        name = a.get('name')
        if not name:
            continue
        raw = a.get('value', '')
        executor.set_variable(name, render(str(raw), executor.variables) if isinstance(raw, str) else raw)

    executor.log_step(node, direction='system', payload={'assignments': assignments})
    return executor.advance_to_next(node['id'])
