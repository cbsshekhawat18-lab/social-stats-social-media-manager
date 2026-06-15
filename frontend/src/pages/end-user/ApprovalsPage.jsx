/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * ApprovalsPage — end-user approves/rejects agency-side actions.
 *
 * Two tabs: Pending and History. A pending row expands to show:
 *   - Action type + agency + requester
 *   - Preview (post content for publish_post, recipient count for campaigns)
 *   - For publish_post: editable textarea so the user can tweak the post body
 *     before approving
 *   - Approve / Reject buttons
 *
 * Approve calls /api/approvals/<id>/approve/ which executes the action
 * server-side (via approval_executors); the response carries the success/
 * failure of execution.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, Check, X, ChevronDown, ChevronRight, Clock,
  AlertTriangle, Sparkles, FileText, Send, Plug,
} from 'lucide-react';

import { approvalAPI } from '../../services/api';
import toast from '../../components/ui/toast';

const ACTION_ICON = {
  publish_post:        FileText,
  send_campaign:       Send,
  reply_dm:            Sparkles,
  reply_comment:       Sparkles,
  reply_review:        Sparkles,
  disconnect_platform: Plug,
};

const ACTION_LABEL = {
  publish_post:        'Publish post',
  send_campaign:       'Send WhatsApp campaign',
  reply_dm:            'Reply to DM',
  reply_comment:       'Reply to comment',
  reply_review:        'Reply to review',
  disconnect_platform: 'Disconnect platform',
};

const STATUS_PILL = {
  pending:       { bg: 'var(--brand-primary-soft)', fg: 'var(--brand-primary-hover)' },
  approved:      { bg: 'var(--success-bg)',         fg: 'var(--success)' },
  rejected:      { bg: 'var(--surface-sunken)',     fg: 'var(--text-tertiary)' },
  expired:       { bg: 'var(--surface-sunken)',     fg: 'var(--text-tertiary)' },
  auto_approved: { bg: 'var(--success-bg)',         fg: 'var(--success)' },
  cancelled:     { bg: 'var(--surface-sunken)',     fg: 'var(--text-tertiary)' },
};

export default function ApprovalsPage() {
  const [tab,     setTab]     = useState('pending');
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId,  setOpenId]  = useState(null);

  function load(which = tab) {
    setLoading(true);
    const fn = which === 'pending' ? approvalAPI.pending : approvalAPI.history;
    fn()
      .then((r) => setRows(r.data?.rows || []))
      .catch(() => toast.error('Could not load approvals'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(tab); /* eslint-disable-next-line */ }, [tab]);

  const pendingCount = useMemo(
    () => tab === 'pending' ? rows.length : 0,
    [tab, rows]
  );

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 40, height: 40,
          background: 'var(--brand-primary-glow)',
          color: 'var(--brand-primary-hover)',
          borderRadius: 'var(--radius-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ClipboardCheck size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Approvals
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Sensitive actions your agency wants to do — approve, edit, or reject.
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border-subtle)' }}>
        <TabButton active={tab === 'pending'} onClick={() => setTab('pending')}>
          Pending {pendingCount > 0 && <Badge n={pendingCount} />}
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          History
        </TabButton>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul style={listStyle}>
          {rows.map((row) => (
            <ApprovalRow
              key={row.id}
              row={row}
              expanded={openId === row.id}
              onToggle={() => setOpenId(openId === row.id ? null : row.id)}
              onActed={() => load(tab)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 16px',
        background: 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
        border: 'none',
        borderBottom: `2px solid ${active ? 'var(--brand-primary)' : 'transparent'}`,
        fontSize: 13, fontWeight: active ? 600 : 500,
        fontFamily: 'inherit', cursor: 'pointer',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  );
}

function Badge({ n }) {
  return (
    <span style={{
      marginLeft: 6, padding: '1px 7px',
      background: 'var(--brand-primary-hover)', color: '#fff',
      fontSize: 10, fontWeight: 700,
      borderRadius: 'var(--radius-pill)',
    }}>{n}</span>
  );
}

function EmptyState({ tab }) {
  return (
    <div style={{
      padding: 36,
      background: 'var(--surface-card)',
      border: '1px dashed var(--border-default)',
      borderRadius: 'var(--radius-md)',
      textAlign: 'center',
      color: 'var(--text-tertiary)',
    }}>
      <ClipboardCheck size={28} strokeWidth={1.6} style={{ opacity: 0.4 }} />
      <div style={{ marginTop: 8, fontSize: 13 }}>
        {tab === 'pending'
          ? 'No pending approvals — everything\'s caught up.'
          : 'No past approvals yet.'}
      </div>
    </div>
  );
}

function ApprovalRow({ row, expanded, onToggle, onActed }) {
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(row.payload?.content || row.payload?.text || row.preview || '');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const Icon = ACTION_ICON[row.action_type] || ClipboardCheck;
  const status = STATUS_PILL[row.status] || STATUS_PILL.pending;
  const expires = row.expires_at ? new Date(row.expires_at) : null;
  const expiresIn = expires ? Math.max(0, Math.round((expires - new Date()) / 36e5)) : null;

  async function approve() {
    setBusy(true);
    try {
      const editedContent = editor !== (row.payload?.content || row.payload?.text || row.preview || '')
        ? (row.action_type.startsWith('reply_') ? { text: editor } : { content: editor })
        : undefined;
      const payload = {};
      if (editedContent) payload.edited_payload = editedContent;
      const r = await approvalAPI.approve(row.id, payload);
      const exec = r.data?.execution_result || {};
      if (exec.success) toast.success('Approved and executed');
      else if (exec.message) toast.error(`Approved, but execution failed: ${exec.message}`);
      else toast.success('Approved');
      onActed?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not approve');
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await approvalAPI.reject(row.id, rejectReason);
      toast.success('Rejected');
      onActed?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not reject');
    } finally {
      setBusy(false);
      setShowReject(false);
    }
  }

  const isPending = row.status === 'pending';
  const editable = isPending && (row.action_type === 'publish_post' || row.action_type.startsWith('reply_'));

  return (
    <li style={cardStyle}>
      <button type="button" onClick={onToggle} style={headerBtn} aria-expanded={expanded}>
        <span style={iconWrap}><Icon size={16} strokeWidth={2.2} /></span>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {ACTION_LABEL[row.action_type] || row.action_type}
            </span>
            <span style={{ ...pillStyle, background: status.bg, color: status.fg }}>{row.status}</span>
            {isPending && expiresIn !== null && (
              <span style={{ fontSize: 11, color: expiresIn < 6 ? 'var(--warning)' : 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Clock size={11} /> {expiresIn}h left
              </span>
            )}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-tertiary)' }}>
            From <strong style={{ color: 'var(--text-secondary)' }}>{row.agency_name}</strong> · {row.requested_by_name}
          </div>
          {!expanded && row.preview && (
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{row.preview}"
            </div>
          )}
        </div>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {expanded && (
        <div style={bodyStyle}>
          {row.payload?.platforms && (
            <Detail k="Platforms" v={row.payload.platforms.join(', ')} />
          )}
          {row.payload?.audience !== undefined && (
            <Detail k="Audience" v={`${row.payload.audience} contacts`} />
          )}
          {row.payload?.template && (
            <Detail k="Template" v={row.payload.template} />
          )}
          {row.payload?.platform && (
            <Detail k="Platform" v={row.payload.platform} />
          )}

          {editable ? (
            <div>
              <label style={fieldLabel}>{row.action_type === 'publish_post' ? 'Post content' : 'Reply text'} (you can edit before approving)</label>
              <textarea
                rows={4}
                value={editor}
                onChange={(e) => setEditor(e.target.value)}
                style={textareaStyle}
                disabled={!isPending || busy}
              />
            </div>
          ) : (
            row.preview && (
              <div style={previewStyle}>
                {row.preview}
              </div>
            )
          )}

          {!isPending && row.user_response && (
            <Detail k="Your response" v={row.user_response} />
          )}

          {!isPending && row.execution_result && (
            <div style={{
              padding: '8px 10px',
              fontSize: 12,
              color: row.execution_result.success ? 'var(--success)' : 'var(--danger)',
              background: row.execution_result.success ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${row.execution_result.success ? 'var(--success)' : 'var(--danger)'}`,
              borderRadius: 'var(--radius-sm)',
            }}>
              <strong style={{ marginRight: 4 }}>
                {row.execution_result.success ? '✓ Executed:' : <><AlertTriangle size={11} style={{ verticalAlign: '-2px', marginRight: 3 }} />Execution failed:</>}
              </strong>
              {row.execution_result.message}
            </div>
          )}

          {isPending && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowReject(true)} disabled={busy} style={btnGhost}>
                <X size={14} /> Reject
              </button>
              <button type="button" onClick={approve} disabled={busy} style={btnPrimary}>
                <Check size={14} /> {busy ? 'Working…' : 'Approve'}
              </button>
            </div>
          )}

          {showReject && (
            <div style={rejectBox}>
              <label style={fieldLabel}>Why are you rejecting? (optional)</label>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={textareaStyle}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowReject(false)} style={btnGhost}>Cancel</button>
                <button type="button" onClick={reject} disabled={busy} style={btnDanger}>Reject</button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Detail({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 13, padding: '4px 0' }}>
      <span style={{ width: 100, color: 'var(--text-tertiary)', flexShrink: 0 }}>{k}</span>
      <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{v}</span>
    </div>
  );
}

const cardStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  overflow: 'hidden',
};

const headerBtn = {
  width: '100%',
  display: 'flex', alignItems: 'flex-start', gap: 12,
  padding: 14,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
};

const iconWrap = {
  width: 32, height: 32,
  background: 'var(--brand-primary-glow)',
  color: 'var(--brand-primary-hover)',
  borderRadius: 'var(--radius-sm)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const bodyStyle = {
  padding: '12px 14px 16px',
  display: 'flex', flexDirection: 'column', gap: 10,
  borderTop: '1px solid var(--border-subtle)',
};

const previewStyle = {
  padding: '10px 12px',
  background: 'var(--surface-sunken)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, color: 'var(--text-primary)',
  whiteSpace: 'pre-wrap',
  lineHeight: 1.55,
};

const pillStyle = {
  padding: '2px 8px',
  fontSize: 10, fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  borderRadius: 'var(--radius-pill)',
};

const fieldLabel = {
  display: 'block',
  fontSize: 11, fontWeight: 600,
  letterSpacing: '0.04em', textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: 4,
};

const textareaStyle = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 13, lineHeight: 1.5,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
};

const rejectBox = {
  padding: 12,
  background: 'var(--danger-bg)',
  border: '1px solid var(--danger)',
  borderRadius: 'var(--radius-sm)',
};

const listStyle = {
  listStyle: 'none', padding: 0, margin: 0,
  display: 'flex', flexDirection: 'column', gap: 8,
};

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px',
  background: 'var(--success)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
};

const btnDanger = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'var(--danger)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};
