/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * CanvasNode — single React Flow node renderer.
 *
 * One component, branched by `data.type`. Renders a card with category-color
 * left stripe, icon, label, and a one-line summary of the data. Buttons /
 * list nodes get extra outgoing handles (one per option) so the user can
 * draw a different edge from each option.
 */
import { Handle, Position } from 'reactflow';
import { getNodeMeta } from './nodeCatalog';

export default function CanvasNode({ data, selected }) {
  const meta = getNodeMeta(data.type);
  const Icon = meta.icon;
  const summary = describeNode(data);

  return (
    <div style={{
      width: 220,
      background: 'var(--surface-card)',
      border: `2px solid ${selected ? meta.color : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: selected ? `0 0 0 4px ${meta.color}33` : 'var(--shadow-sm)',
      transition: 'border-color 120ms, box-shadow 120ms',
      fontFamily: 'inherit',
      overflow: 'hidden',
    }}>
      {/* Top stripe */}
      <div style={{ height: 4, background: meta.color }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 6px' }}>
        <span style={{
          width: 26, height: 26, borderRadius: 'var(--radius-sm)',
          background: `${meta.color}22`, color: meta.color,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={14} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}>{meta.category}</div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{meta.label}</div>
        </div>
      </div>

      {/* Body summary */}
      {summary && (
        <div style={{
          padding: '0 12px 10px', fontSize: 12, color: 'var(--text-secondary)',
          lineHeight: 1.4,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {summary}
        </div>
      )}

      {/* Handles */}
      {data.type !== 'start' && (
        <Handle type="target" position={Position.Left}
                style={{ background: meta.color, width: 9, height: 9 }} />
      )}

      {/* Multi-handle outputs for buttons / list / condition / random_split */}
      {data.type === 'message_buttons' ? (
        (data.data?.buttons || []).map((b, i, arr) => (
          <Handle
            key={b.id || i}
            type="source" position={Position.Right}
            id={b.id || `btn_${i}`}
            style={{
              top: `${24 + (i + 1) * 60 / (arr.length + 1)}px`,
              background: meta.color, width: 9, height: 9,
            }}
          />
        ))
      ) : data.type === 'message_list' ? (
        (data.data?.sections || []).flatMap((s, si) => (s.rows || []).map((r, ri, all) => (
          <Handle
            key={`${si}-${r.id || ri}`}
            type="source" position={Position.Right}
            id={r.id || `row_${si}_${ri}`}
            style={{ background: meta.color, width: 9, height: 9 }}
          />
        )))
      ) : data.type === 'condition' ? (
        <>
          <Handle type="source" position={Position.Right} id="true"
                  style={{ top: '40%', background: 'var(--success)', width: 9, height: 9 }} />
          <Handle type="source" position={Position.Right} id="false"
                  style={{ top: '70%', background: 'var(--danger)', width: 9, height: 9 }} />
        </>
      ) : !meta.terminal && (
        <Handle type="source" position={Position.Right}
                style={{ background: meta.color, width: 9, height: 9 }} />
      )}
    </div>
  );
}

function describeNode(data) {
  const d = data.data || {};
  switch (data.type) {
    case 'message_text':     return d.text || '(empty message)';
    case 'message_image':    return d.url ? `🖼 ${d.url}` : '(no image url)';
    case 'message_video':    return d.url ? `🎬 ${d.url}` : '(no video url)';
    case 'message_document': return d.filename ? `📄 ${d.filename}` : (d.url || '(no document)');
    case 'message_template': return d.template_name ? `📨 ${d.template_name}` : '(no template)';
    case 'message_buttons':  return d.body ? `${d.body} · ${(d.buttons || []).length} buttons` : '(no body)';
    case 'message_list':     return d.body || '(list picker)';
    case 'message_cta':      return `${d.body || ''}${d.url ? ` → ${d.url}` : ''}`;

    case 'ask_question':
    case 'ask_email':
    case 'ask_phone':
    case 'ask_number':
    case 'ask_location':
    case 'ask_attachment':
      return `${d.question || '(no question)'}${d.store_var ? ` → {{${d.store_var}}}` : ''}`;

    case 'condition':
      const c = d.condition || {};
      return `${c.left || '?'} ${c.op || '=='} ${JSON.stringify(c.right ?? '')}`;
    case 'random_split':  return 'Pick a random branch';
    case 'set_variable':  return d.name ? `${d.name} = ${d.value}` : '(unconfigured)';
    case 'jump_to_flow':  return d.target_flow_id ? `→ flow #${d.target_flow_id}` : '(no target)';
    case 'wait_delay':    return formatDelay(d);

    case 'tag_contact':   return `Tags: ${(d.tags || []).join(', ') || '(none)'}`;
    case 'capture_lead':  return 'Save lead to database';
    case 'webhook':       return d.url || '(no url)';
    case 'send_email':    return d.to ? `To: ${d.to}` : '(no recipient)';

    case 'ai_chat':       return d.persona ? d.persona.slice(0, 80) + '…' : 'AI takes over';
    case 'human_handoff': return d.message || 'Hand off to agent';

    case 'start':         return 'Flow entry point';
    case 'end_conversation': return d.text || 'Conversation ends';
    default: return '';
  }
}

function formatDelay(d) {
  const s = (d.hours || 0) * 3600 + (d.minutes || 0) * 60 + (d.seconds || 0);
  if (!s) return 'no delay';
  if (s >= 3600) return `${Math.round(s / 3600)} h`;
  if (s >= 60) return `${Math.round(s / 60)} min`;
  return `${s} s`;
}
