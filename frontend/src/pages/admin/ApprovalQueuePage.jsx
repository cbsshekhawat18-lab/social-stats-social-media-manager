/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle2, X, FileEdit, Send } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { notificationsAPI, composerAPI } from '../../services/api';

export default function ApprovalQueuePage() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  function refetch() {
    setLoading(true);
    notificationsAPI.approvalQueue()
      .then((r) => setQueue(r.data?.queue || []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { refetch(); }, []);

  async function approve(post) {
    try {
      await composerAPI.posts.approve(post.id);
      toast.success(`Approved — "${post.title || post.content.slice(0, 30)}" is publishing`);
      refetch();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Approve failed');
    }
  }

  async function reject(post) {
    if (!window.confirm(`Reject "${post.title || post.content.slice(0, 30)}…"? This will cancel the post.`)) return;
    try {
      await composerAPI.posts.cancel(post.id);
      toast.success('Rejected and canceled');
      refetch();
    } catch (e) {
      toast.error('Reject failed');
    }
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Approval queue"
        subtitle={`${queue.length} post${queue.length === 1 ? '' : 's'} awaiting review`}
      />

      <div style={{ padding: '0 24px' }}>
        {loading && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <Loader2 size={18} className="ds-spin" color="var(--text-tertiary)" />
          </div>
        )}

        {!loading && queue.length === 0 && (
          <Card padding="none" style={{ overflow: 'hidden' }}>
            <EmptyState
              icon={CheckCircle2}
              title="Inbox zero"
              description="No posts are waiting for approval. New submissions will appear here for review."
            />
          </Card>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {queue.map((post) => (
            <Card key={post.id} padding="md">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                      {post.title || 'Untitled'}
                    </strong>
                    <Badge variant="warning" dot>pending approval</Badge>
                    {(post.target_platforms || []).map((p) => (
                      <Badge key={p} variant="default">{p}</Badge>
                    ))}
                  </div>
                  <div style={{
                    fontSize: 13, color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap', lineHeight: 1.5,
                    maxHeight: 120, overflow: 'hidden',
                    background: 'var(--surface-sunken)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    {post.content || <em>(no body)</em>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                    {post.media_type !== 'text' && `${post.media_type} · `}
                    Submitted {new Date(post.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Button icon={CheckCircle2} onClick={() => approve(post)}>Approve</Button>
                  <Button variant="ghost" icon={X} onClick={() => reject(post)}>Reject</Button>
                  <Button as={Link} variant="secondary" icon={FileEdit}
                          to={`/admin/analytics/composer/${post.id}`}>
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <style>{`.ds-spin { animation: ds-spin 0.9s linear infinite; } @keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
