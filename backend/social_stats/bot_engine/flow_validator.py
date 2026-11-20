# ============================================================================
#  Social Stats — Social Media Management & Marketing Platform
#  Author    : Chandrabhan Shekhawat
#  Company   : Gigai Kripa Services
#  Website   : https://gigaikripaservices.com/
#  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
#  Released under the MIT License — see LICENSE. Keep this notice.
# ============================================================================
"""
Pre-publish validation of a bot flow graph.

`validate_graph(nodes, edges, starting_node_id)` returns a list of issues:

    [{"node_id": "n3" | None, "level": "error" | "warning", "message": "…"}]

Errors block publishing; warnings are shown to the author but don't.
`node_id` is None for flow-level problems (no start node, …) so the editor
can highlight the nodes that have one.

Limits are WhatsApp's own: 3 reply buttons, 20-character button titles,
10 list rows, 1024-character interactive bodies, 4096-character texts.
"""
from __future__ import annotations

from typing import Optional

from ..bot_models import NODE_TYPES

MAX_BUTTONS = 3
MAX_BUTTON_TITLE = 20
MAX_LIST_ROWS = 10
MAX_LIST_ROW_TITLE = 24
MAX_BODY = 1024
MAX_TEXT = 4096
SERVICE_WINDOW_SECONDS = 24 * 3600

# Nodes at which the engine stops and waits (for the user, a timer, or the AI
# turn) — a loop through one of these can't spin within a single message.
WAITING_NODE_TYPES = frozenset({
    'ask_question', 'ask_email', 'ask_phone', 'ask_number', 'ask_location', 'ask_attachment',
    'message_buttons', 'message_list', 'wait_delay', 'ai_chat',
    'human_handoff', 'end_conversation', 'jump_to_flow',
})
ASK_TYPES = ('ask_question', 'ask_email', 'ask_phone', 'ask_number', 'ask_location', 'ask_attachment')


def _issue(node_id: Optional[str], level: str, message: str) -> dict:
    return {'node_id': node_id, 'level': level, 'message': message}


def _label(node: dict) -> str:
    return NODE_TYPES.get(node.get('type'), node.get('type') or 'node')


def wait_seconds(data: dict) -> int:
    def num(key):
        try:
            return int(data.get(key) or 0)
        except (TypeError, ValueError):
            return 0
    return num('seconds') + num('minutes') * 60 + num('hours') * 3600


def _has_fallback(node: dict) -> bool:
    fb = (node.get('data') or {}).get('fallback_template')
    return bool(fb if isinstance(fb, str) else (fb or {}).get('name') or (fb or {}).get('template_name'))


def validate_graph(nodes: list, edges: list, starting_node_id: str = '') -> list[dict]:
    issues: list[dict] = []
    nodes = [n for n in (nodes or []) if isinstance(n, dict)]
    edges = [e for e in (edges or []) if isinstance(e, dict)]
    by_id = {n.get('id'): n for n in nodes}
    out_edges: dict[str, list] = {}

    if not nodes:
        return [_issue(None, 'error', 'The flow has no nodes.')]

    # ── ids ──────────────────────────────────────────────────────────────
    seen = set()
    for n in nodes:
        nid = n.get('id')
        if not nid:
            issues.append(_issue(None, 'error', 'A node has no id.'))
        elif nid in seen:
            issues.append(_issue(nid, 'error', f'Duplicate node id "{nid}".'))
        seen.add(nid)

    # ── exactly one start ────────────────────────────────────────────────
    starts = [n for n in nodes if n.get('type') == 'start']
    if not starts:
        issues.append(_issue(None, 'error', 'The flow needs a Start node.'))
    elif len(starts) > 1:
        for n in starts[1:]:
            issues.append(_issue(n.get('id'), 'error', 'Only one Start node is allowed.'))
    start_id = starts[0].get('id') if len(starts) == 1 else (starting_node_id or '')
    if starting_node_id and starting_node_id not in by_id:
        issues.append(_issue(None, 'error', f'The starting node "{starting_node_id}" does not exist.'))

    # ── node types ───────────────────────────────────────────────────────
    for n in nodes:
        if n.get('type') not in NODE_TYPES:
            issues.append(_issue(n.get('id'), 'error', f'Unknown node type "{n.get("type")}".'))

    # ── edges point at real nodes ────────────────────────────────────────
    for e in edges:
        src, dst = e.get('source'), e.get('target')
        if src not in by_id:
            issues.append(_issue(dst if dst in by_id else None, 'error',
                                 f'A connection starts from a node that no longer exists ("{src}").'))
            continue
        if dst not in by_id:
            issues.append(_issue(src, 'error',
                                 f'A connection from this node points to a node that no longer exists ("{dst}").'))
            continue
        out_edges.setdefault(src, []).append(e)

    # ── reachability ─────────────────────────────────────────────────────
    if start_id in by_id:
        reachable, stack = set(), [start_id]
        while stack:
            cur = stack.pop()
            if cur in reachable:
                continue
            reachable.add(cur)
            stack.extend(e['target'] for e in out_edges.get(cur, []))
        for n in nodes:
            if n.get('id') not in reachable:
                issues.append(_issue(n.get('id'), 'error',
                                     f'{_label(n)} can never be reached from Start. Connect it or delete it.'))
        if not out_edges.get(start_id):
            issues.append(_issue(start_id, 'error', 'Start is not connected to anything.'))

    # ── per-node content rules ───────────────────────────────────────────
    for n in nodes:
        issues.extend(_node_issues(n, out_edges.get(n.get('id'), []), by_id))

    # ── loops that never wait ────────────────────────────────────────────
    for cycle in _cycles(by_id, out_edges):
        if not any(by_id[i].get('type') in WAITING_NODE_TYPES for i in cycle):
            names = ' → '.join(_label(by_id[i]) for i in cycle[:4]) + (' → …' if len(cycle) > 4 else '')
            for nid in cycle:
                issues.append(_issue(nid, 'warning',
                                     f'This node is in a loop that never waits for the user ({names}). '
                                     'The engine stops such a loop after 20 steps and fails the conversation.'))
    return issues


def _node_issues(node: dict, outgoing: list, by_id: dict) -> list[dict]:
    out: list[dict] = []
    nid, kind, d = node.get('id'), node.get('type'), node.get('data') or {}
    handles = {e.get('sourceHandle') for e in outgoing}

    def err(msg): out.append(_issue(nid, 'error', msg))
    def warn(msg): out.append(_issue(nid, 'warning', msg))

    if kind == 'message_text':
        text = d.get('text') or ''
        if not text.strip():
            err('The message text is empty.')
        elif len(text) > MAX_TEXT:
            err(f'The message is {len(text)} characters; WhatsApp allows {MAX_TEXT}.')

    elif kind in ('message_image', 'message_video', 'message_document'):
        if not (d.get('url') or d.get('link') or d.get('media_id')):
            err('Add a media URL (or media id).')
        if len(d.get('caption') or '') > MAX_BODY:
            err(f'The caption is longer than {MAX_BODY} characters.')

    elif kind == 'message_template':
        if not (d.get('template_name') or d.get('name')):
            err('Choose an approved template.')

    elif kind == 'message_buttons':
        body, buttons = d.get('body') or d.get('text') or '', d.get('buttons') or []
        if not body.strip():
            err('The buttons message needs body text.')
        elif len(body) > MAX_BODY:
            err(f'The body is {len(body)} characters; WhatsApp allows {MAX_BODY}.')
        if not buttons:
            err('Add at least one button.')
        if len(buttons) > MAX_BUTTONS:
            err(f'WhatsApp allows at most {MAX_BUTTONS} buttons; this node has {len(buttons)}.')
        ids = [b.get('id') for b in buttons]
        if len(set(ids)) != len(ids):
            err('Two buttons share the same id.')
        for b in buttons:
            title = b.get('title') or ''
            if not title.strip():
                err('A button has no title.')
            elif len(title) > MAX_BUTTON_TITLE:
                err(f'Button "{title}" is {len(title)} characters; the limit is {MAX_BUTTON_TITLE}.')
        unwired = [b.get('title') or b.get('id') for b in buttons
                   if b.get('id') not in handles]
        if unwired and outgoing and None not in handles and 'no_match' not in handles:
            warn('No connection for: ' + ', '.join(str(u) for u in unwired) + '.')

    elif kind == 'message_list':
        body = d.get('body') or d.get('text') or ''
        rows = [r for s in (d.get('sections') or []) for r in (s.get('rows') or [])]
        if not body.strip():
            err('The list message needs body text.')
        elif len(body) > MAX_BODY:
            err(f'The body is {len(body)} characters; WhatsApp allows {MAX_BODY}.')
        if not rows:
            err('Add at least one row to the list.')
        if len(rows) > MAX_LIST_ROWS:
            err(f'WhatsApp allows at most {MAX_LIST_ROWS} rows in a list; this one has {len(rows)}.')
        ids = [r.get('id') for r in rows]
        if len(set(ids)) != len(ids):
            err('Two list rows share the same id.')
        for r in rows:
            if len(r.get('title') or '') > MAX_LIST_ROW_TITLE:
                err(f'Row "{r.get("title")}" is longer than {MAX_LIST_ROW_TITLE} characters.')
        if len(d.get('button_label') or d.get('button') or '') > MAX_BUTTON_TITLE:
            err(f'The list button label is longer than {MAX_BUTTON_TITLE} characters.')

    elif kind == 'message_cta':
        if len(d.get('body') or '') > MAX_BODY:
            err(f'The body is longer than {MAX_BODY} characters.')
        if not (d.get('url') or '').strip().startswith(('http://', 'https://', '{{')):
            err('Add the URL the button should open.')

    elif kind in ASK_TYPES:
        question = d.get('question') or d.get('text') or ''
        if len(question) > MAX_TEXT:
            err(f'The question is longer than {MAX_TEXT} characters.')
        if kind == 'ask_question' and not question.strip():
            err('The question is empty.')

    elif kind == 'condition':
        cfg = d.get('condition') or d
        if not (cfg.get('rules') or cfg.get('left')):
            err('The condition has no rule.')
        missing = [side for side in ('true', 'false') if side not in handles]
        if missing and 'no_match' not in handles:
            err('Connect both the true and the false output '
                f'(missing: {", ".join(missing)}), or connect "no match" for the side you leave open.')

    elif kind == 'jump_to_flow':
        if not (d.get('target_flow_id') or d.get('flow_id')):
            err('Choose the flow to jump to.')

    elif kind == 'wait_delay':
        seconds = wait_seconds(d)
        if seconds > SERVICE_WINDOW_SECONDS:
            followers = [by_id[e['target']] for e in outgoing]
            bad = [f for f in followers
                   if f.get('type') != 'message_template' and not _has_fallback(f)]
            if bad or not followers:
                warn('This wait is longer than 24 hours. WhatsApp only delivers approved templates '
                     'after that, so follow it with a Send Template node (or give the next node a '
                     'fallback template) — otherwise the conversation fails there.')

    elif kind == 'ai_extract':
        fields = [f for f in (d.get('fields') or []) if isinstance(f, dict)]
        names = [str(f.get('name') or '').strip() for f in fields]
        if not any(names):
            err('Add at least one field to extract.')
        if any(not n for n in names):
            err('A field has no name.')
        if len(set(names)) != len(names):
            err('Two fields share the same name.')
        if 'missing' not in handles:
            warn('The "missing" output is not connected — connect it to ask for what could not be found.')

    elif kind == 'ai_intent':
        intents = [i for i in (d.get('intents') or []) if isinstance(i, dict)]
        keys = [str(i.get('key') or '').strip() for i in intents]
        if not any(keys):
            err('Add at least one intent.')
        if any(not k for k in keys):
            err('An intent has no key.')
        if len(set(keys)) != len(keys):
            err('Two intents share the same key.')
        if 'other' in keys:
            err('"other" is reserved for messages that match no intent — rename that intent.')
        if 'other' not in handles and None not in handles:
            warn('The "other" output is not connected — messages that match no intent end the conversation.')
        unwired = [k for k in keys if k and k not in handles]
        if unwired and outgoing:
            warn('No connection for intent: ' + ', '.join(unwired) + ' (it will follow "other").')

    elif kind in ('webhook', 'crm_push'):
        if not (d.get('url') or '').strip().startswith(('http://', 'https://', '{{')):
            err('Add the URL to call.')

    elif kind == 'assign_segment':
        if not (d.get('list_id') or (d.get('list_name') or '').strip()):
            err('Choose or name the contact list.')

    elif kind == 'send_email':
        if not d.get('to'):
            err('Add at least one recipient.')

    if kind in ASK_TYPES or kind in ('message_buttons', 'message_list'):
        try:
            minutes = int(d.get('timeout_minutes') or 0)
        except (TypeError, ValueError):
            minutes = 0
            err('The answer timeout must be a number of minutes.')
        if minutes > 0 and 'timeout' not in handles and not (d.get('reminder_text') or '').strip():
            warn('An answer timeout is set, but there is no reminder text and the "timeout" output '
                 'is not connected — nothing will happen when it runs out.')
        if (d.get('reminder_text') or '').strip() and minutes <= 0:
            warn('Reminder text is set but the answer timeout is 0, so the reminder is never sent.')
        if minutes * 60 >= SERVICE_WINDOW_SECONDS and (d.get('reminder_text') or '').strip() and not _has_fallback(node):
            warn('The reminder would go out 24 hours or more after the customer last wrote. WhatsApp '
                 'only delivers approved templates then — add a fallback template or the reminder is skipped.')

    if kind not in ('end_conversation', 'human_handoff', 'jump_to_flow') and not outgoing and kind in NODE_TYPES:
        if kind != 'start':   # start has its own message
            warn('Nothing is connected after this node, so the conversation ends here.')
    return out


def _cycles(by_id: dict, out_edges: dict) -> list[list[str]]:
    """Strongly connected components that contain a cycle (Tarjan, iterative)."""
    index, low, on_stack, stack, result = {}, {}, set(), [], []
    counter = 0
    for root in by_id:
        if root in index:
            continue
        work = [(root, iter([e['target'] for e in out_edges.get(root, [])]))]
        index[root] = low[root] = counter
        counter += 1
        stack.append(root)
        on_stack.add(root)
        while work:
            node, it = work[-1]
            advanced = False
            for nxt in it:
                if nxt not in index:
                    index[nxt] = low[nxt] = counter
                    counter += 1
                    stack.append(nxt)
                    on_stack.add(nxt)
                    work.append((nxt, iter([e['target'] for e in out_edges.get(nxt, [])])))
                    advanced = True
                    break
                if nxt in on_stack:
                    low[node] = min(low[node], index[nxt])
            if advanced:
                continue
            work.pop()
            if work:
                parent = work[-1][0]
                low[parent] = min(low[parent], low[node])
            if low[node] == index[node]:
                component = []
                while True:
                    top = stack.pop()
                    on_stack.discard(top)
                    component.append(top)
                    if top == node:
                        break
                self_loop = any(e['target'] == node for e in out_edges.get(node, []))
                if len(component) > 1 or self_loop:
                    result.append(list(reversed(component)))
    return result


def validate_flow(flow) -> dict:
    """Validate a BotFlow's draft graph. Shape used by the validate + publish
    endpoints; `issues` (plain strings) is kept for older clients."""
    found = validate_graph(flow.nodes or [], flow.edges or [], flow.starting_node_id or '')
    errors = [i for i in found if i['level'] == 'error']
    return {
        'ok': not errors,
        'errors': found,
        'issues': [i['message'] if not i['node_id'] else f'{i["node_id"]}: {i["message"]}' for i in errors],
        'error_count': len(errors),
        'warning_count': len(found) - len(errors),
        'node_count': len(flow.nodes or []),
        'edge_count': len(flow.edges or []),
    }
