/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * BotFlowEditorPage — visual flow builder.
 *
 * Layout: top bar + 3-column body (palette | canvas | inspector).
 * - Drag a palette item onto the canvas → creates a new node at drop position.
 * - Click a node → loads it in the inspector.
 * - Connect nodes by dragging from a source handle to a target handle.
 * - Auto-save: every 5 seconds while dirty, plus on explicit Save click.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges, useReactFlow,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { nanoid } from 'nanoid';
import {
  ArrowLeft, Save, PlayCircle, CheckCircle2, AlertTriangle,
  Undo2, Redo2, LayoutGrid, FlaskConical,
} from 'lucide-react';

import { botAPI } from '../../services/api';
import toast from '../../components/ui/toast';
import CanvasNode from '../../components/bot/CanvasNode';
import NodeInspector from '../../components/bot/NodeInspector';
import TestModeDrawer from '../../components/bot/TestModeDrawer';
import TriggerConfigModal from '../../components/bot/TriggerConfigModal';
import { NODE_CATALOG, CATEGORIES, getNodeMeta } from '../../components/bot/nodeCatalog';

// ─────────────────────────────────────────────────────────
// Auto-layout via Dagre
// ─────────────────────────────────────────────────────────
const NODE_W = 220;
const NODE_H = 92;

function autoLayout(nodes, edges, direction = 'LR') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

const nodeTypes = { custom: CanvasNode };

export default function BotFlowEditorPage() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reactFlow = useReactFlow();

  const [flow, setFlow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [validation, setValidation] = useState(null);
  const [testOpen,  setTestOpen]  = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Undo/redo history — stack of {nodes, edges} snapshots
  const historyRef = useRef({ past: [], future: [] });
  const skipNextSnapshot = useRef(false);

  // Snapshot the current state (called before mutating + on user-driven moves)
  function snapshot() {
    historyRef.current.past.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    if (historyRef.current.past.length > 50) historyRef.current.past.shift();
    historyRef.current.future = [];
  }

  function undo() {
    const past = historyRef.current.past;
    if (past.length === 0) return;
    const prev = past.pop();
    historyRef.current.future.push({ nodes, edges });
    skipNextSnapshot.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setDirty(true);
  }
  function redo() {
    const future = historyRef.current.future;
    if (future.length === 0) return;
    const next = future.pop();
    historyRef.current.past.push({ nodes, edges });
    skipNextSnapshot.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    setDirty(true);
  }

  // Keyboard shortcuts — Cmd/Ctrl-Z + Cmd/Ctrl-Shift-Z
  useEffect(() => {
    function onKey(e) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      // Ignore when typing in inputs
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if (e.key === 'y') { e.preventDefault(); redo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes, edges]); // eslint-disable-line

  // ── Load ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    botAPI.get(id).then((r) => {
      if (cancelled) return;
      const f = r.data;
      setFlow(f);
      setNodes((f.nodes || []).map((n) => ({
        id: n.id,
        type: 'custom',
        position: n.position || { x: 100, y: 100 },
        data: { type: n.type, data: n.data || {} },
      })));
      setEdges((f.edges || []).map((e) => ({
        id: e.id || nanoid(8),
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        label: e.label,
        markerEnd: { type: MarkerType.ArrowClosed },
      })));
    }).catch(() => toast.error('Could not load flow'));
    return () => { cancelled = true; };
  }, [id]);

  // ── Autosave loop ────────────────────────────────────
  useEffect(() => {
    if (!flow || !dirty) return;
    const t = setTimeout(save, 5000);
    return () => clearTimeout(t);
  }, [dirty, nodes, edges, flow]); // eslint-disable-line

  function save() {
    if (!flow || saving) return;
    setSaving(true);
    const payload = {
      ...flow,
      nodes: nodes.map((n) => ({
        id: n.id, type: n.data.type, position: n.position, data: n.data.data,
      })),
      edges: edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        sourceHandle: e.sourceHandle, label: e.label,
      })),
      starting_node_id: flow.starting_node_id || (nodes.find((n) => n.data.type === 'start')?.id || ''),
    };
    botAPI.update(id, payload)
      .then((r) => {
        setFlow(r.data);
        setSavedAt(new Date());
        setDirty(false);
      })
      .catch(() => toast.error('Auto-save failed'))
      .finally(() => setSaving(false));
  }

  // ── Mutations ────────────────────────────────────────
  function patchSelected(nextDataPayload) {
    if (!selectedId) return;
    snapshot();
    setNodes((ns) => ns.map((n) => n.id === selectedId
      ? { ...n, data: { ...n.data, data: nextDataPayload } }
      : n));
    setDirty(true);
  }
  function deleteSelected() {
    if (!selectedId) return;
    if (!window.confirm('Delete this node?')) return;
    snapshot();
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
    setDirty(true);
  }

  const onNodesChange = useCallback((c) => {
    // Only snapshot on "user finished" actions, not every drag tick
    const significant = c.some((ch) => ch.type === 'remove' || (ch.type === 'position' && ch.dragging === false));
    if (significant && !skipNextSnapshot.current) snapshot();
    skipNextSnapshot.current = false;
    setNodes((ns) => applyNodeChanges(c, ns));
    setDirty(true);
  }, [nodes, edges]); // eslint-disable-line
  const onEdgesChange = useCallback((c) => {
    if (c.some((ch) => ch.type === 'remove') && !skipNextSnapshot.current) snapshot();
    skipNextSnapshot.current = false;
    setEdges((es) => applyEdgeChanges(c, es));
    setDirty(true);
  }, [nodes, edges]); // eslint-disable-line
  const onConnect = useCallback((c) => {
    snapshot();
    setEdges((es) => addEdge({ ...c, id: nanoid(8), markerEnd: { type: MarkerType.ArrowClosed } }, es));
    setDirty(true);
  }, [nodes, edges]); // eslint-disable-line

  function applyAutoLayout() {
    if (nodes.length === 0) return;
    snapshot();
    setNodes(autoLayout(nodes, edges, 'LR'));
    setDirty(true);
    setTimeout(() => reactFlow.fitView({ duration: 250 }), 50);
  }

  // ── Drag from palette → drop on canvas ───────────────
  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/x-bot-node');
    if (!type || !NODE_CATALOG[type]) return;
    const bounds = wrapperRef.current.getBoundingClientRect();
    const position = reactFlow.project({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const meta = NODE_CATALOG[type];
    const newNode = {
      id: type === 'start' ? 'start' : `n_${nanoid(6)}`,
      type: 'custom', position,
      data: { type, data: JSON.parse(JSON.stringify(meta.defaultData || {})) },
    };
    // Only one start node per flow
    if (type === 'start' && nodes.some((n) => n.data.type === 'start')) {
      toast.error('Only one Start node per flow');
      return;
    }
    setNodes((ns) => [...ns, newNode]);
    setSelectedId(newNode.id);
    setDirty(true);
  }, [nodes, reactFlow]);

  // ── Validation + publish ─────────────────────────────
  async function validateNow() {
    if (dirty) await save();
    try {
      const r = await botAPI.validate(id);
      setValidation(r.data);
    } catch { toast.error('Validation failed'); }
  }
  async function openPublishModal() {
    if (dirty) await save();
    setPublishOpen(true);
  }
  async function unpublish() {
    if (!flow) return;
    try {
      const r = await botAPI.unpublish(id);
      setFlow(r.data);
      toast.success('Flow unpublished');
    } catch {
      toast.error('Could not unpublish');
    }
  }

  // ── Variable list (for inserter) ─────────────────────
  const variables = useMemo(() => {
    const seen = new Set();
    nodes.forEach((n) => {
      const d = n.data?.data || {};
      const v = d.store_var || d.variable || d.name;
      if (v && typeof v === 'string') seen.add(v);
    });
    return Array.from(seen);
  }, [nodes]);

  const selected = nodes.find((n) => n.id === selectedId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface-page)' }}>
      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <button type="button" onClick={() => navigate('/admin/bot-flows')} aria-label="Back" style={iconBtn}>
          <ArrowLeft size={14} />
        </button>
        {flow && (
          <input
            value={flow.name || ''}
            onChange={(e) => { setFlow({ ...flow, name: e.target.value }); setDirty(true); }}
            style={{
              flex: 1, padding: '6px 10px', maxWidth: 360,
              fontSize: 14, fontWeight: 600,
              background: 'transparent', color: 'var(--text-primary)',
              border: '1px solid transparent', borderRadius: 'var(--radius-sm)',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.background = 'var(--surface-sunken)'}
            onBlur={(e) => e.target.style.background = 'transparent'}
          />
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={undo} aria-label="Undo (Cmd+Z)"
                  disabled={historyRef.current.past.length === 0}
                  style={iconBtn} title="Undo (Cmd/Ctrl+Z)">
            <Undo2 size={14} />
          </button>
          <button type="button" onClick={redo} aria-label="Redo (Cmd+Shift+Z)"
                  disabled={historyRef.current.future.length === 0}
                  style={iconBtn} title="Redo (Cmd/Ctrl+Shift+Z)">
            <Redo2 size={14} />
          </button>
          <button type="button" onClick={applyAutoLayout} aria-label="Auto-layout"
                  style={iconBtn} title="Auto-layout (Dagre)">
            <LayoutGrid size={14} />
          </button>
          <span style={{ fontSize: 12, color: dirty ? 'var(--warning)' : 'var(--text-tertiary)' }}>
            {saving ? 'Saving…' :
             dirty ? 'Unsaved' :
             savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : ''}
          </span>
          <button type="button" onClick={save} disabled={!dirty || saving} style={btnGhost}>
            <Save size={13} /> Save
          </button>
          <button type="button" onClick={validateNow} style={btnGhost}>Validate</button>
          <button type="button" onClick={() => setTestOpen(true)} style={btnGhost}>
            <FlaskConical size={13} /> Test
          </button>
          {flow?.is_active && (
            <button type="button" onClick={unpublish} style={btnGhost}>Unpublish</button>
          )}
          <button type="button" onClick={openPublishModal} style={btnPrimary} disabled={saving}>
            <PlayCircle size={13} /> {flow?.is_active ? 'Re-publish' : 'Publish'}
          </button>
        </div>
      </header>

      {validation && (
        <ValidationBanner result={validation} onClose={() => setValidation(null)} />
      )}

      {/* 3-column body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Palette />

        <div ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}
             style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            minZoom={0.4} maxZoom={1.4}
          >
            <Background gap={16} size={1} color="var(--border-subtle)" />
            <Controls position="bottom-right" />
            <MiniMap pannable zoomable
                     style={{ background: 'var(--surface-card)' }}
                     nodeStrokeWidth={3}
                     nodeColor={(n) => getNodeMeta(n.data?.type).color} />
          </ReactFlow>
        </div>

        <aside style={{
          width: 320, borderLeft: '1px solid var(--border-subtle)',
          background: 'var(--surface-card)',
        }}>
          <NodeInspector
            node={selected}
            onChange={patchSelected}
            onDelete={deleteSelected}
            variables={variables}
          />
        </aside>
      </div>

      {testOpen && flow && (
        <TestModeDrawer flow={flow} onClose={() => setTestOpen(false)} />
      )}
      {publishOpen && flow && (
        <TriggerConfigModal
          flow={flow}
          onClose={() => setPublishOpen(false)}
          onPublished={(updated) => { setFlow(updated); setPublishOpen(false); }}
        />
      )}

      <style>{`
        @keyframes bot-test-slide {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Palette
// ─────────────────────────────────────────────────────────
function Palette() {
  function onDragStart(e, type) {
    e.dataTransfer.setData('application/x-bot-node', type);
    e.dataTransfer.effectAllowed = 'move';
  }
  return (
    <aside style={{
      width: 220, borderRight: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
      overflowY: 'auto', padding: 12,
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Drag onto canvas
      </h3>
      {CATEGORIES.map((cat) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '2px 6px', marginBottom: 4,
          }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(NODE_CATALOG)
              .filter(([, m]) => m.category === cat)
              .map(([type, m]) => {
                const Icon = m.icon;
                return (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => onDragStart(e, type)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 8px', cursor: 'grab',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12, color: 'var(--text-primary)',
                    }}
                    title={`Drag to add ${m.label}`}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                      background: `${m.color}22`, color: m.color,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Icon size={12} strokeWidth={2.2} />
                    </span>
                    {m.label}
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </aside>
  );
}

function ValidationBanner({ result, onClose }) {
  return (
    <div style={{
      padding: '10px 14px',
      background: result.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
      borderBottom: '1px solid ' + (result.ok ? 'var(--success)' : 'var(--danger)'),
      color: result.ok ? 'var(--success)' : 'var(--danger)',
      fontSize: 13,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {result.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
      {result.ok
        ? `Flow looks good — ${result.node_count} nodes, ${result.edge_count} edges.`
        : <>Issues: <strong>{result.issues?.[0]}</strong>{result.issues?.length > 1 && ` (+${result.issues.length - 1} more)`}</>
      }
      <button type="button" onClick={onClose} style={{
        marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'inherit', fontSize: 14,
      }}>×</button>
    </div>
  );
}

const iconBtn = {
  width: 30, height: 30, padding: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 12px',
  background: 'var(--surface-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-sm)',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
