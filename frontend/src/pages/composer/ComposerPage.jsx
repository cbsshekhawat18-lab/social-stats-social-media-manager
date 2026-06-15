/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Image as ImageIcon, Video, Calendar, Send, Save, AlertCircle, CheckCircle2,
  X, Wand2, Hash, Clock, Layers, Loader2, Upload, Eye, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import AIWriteButton from '../../components/ai/AIWriteButton';
import { composerAPI, captionAPI, hashtagAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useComposerPost } from '../../hooks/useComposer';

/* ── Platform metadata for toggles + previews ──────────────────────────── */
const PLATFORMS = [
  { id: 'facebook',           label: 'Facebook',  color: '#1877F2', maxText: 63206, types: ['text','image','video','carousel','reel'] },
  { id: 'instagram',          label: 'Instagram', color: '#E1306C', maxText: 2200,  types: ['image','video','carousel','reel','story'] },
  { id: 'youtube',            label: 'YouTube',   color: '#FF0000', maxText: 5000,  types: ['video','reel'] },
  { id: 'linkedin',           label: 'LinkedIn',  color: '#0A66C2', maxText: 3000,  types: ['text','image','video','carousel'] },
  { id: 'google_my_business', label: 'Google',    color: '#34A853', maxText: 1500,  types: ['text','image'] },
];

const MEDIA_TYPES = [
  { id: 'text',     label: 'Text only', icon: null },
  { id: 'image',    label: 'Image',     icon: ImageIcon },
  { id: 'video',    label: 'Video',     icon: Video },
  { id: 'carousel', label: 'Carousel',  icon: Layers },
  { id: 'reel',     label: 'Reel',      icon: Video },
  { id: 'story',    label: 'Story',     icon: ImageIcon },
];

export default function ComposerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isEditing = !!id;
  const { data: existing, loading: loadingExisting, refetch } = useComposerPost(id);

  /* ── Editor state ──────────────────────────────────────────────────── */
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaType, setMediaType] = useState('text');
  const [mediaAssets, setMediaAssets] = useState([]);   // [{id, file_url, thumbnail_url, mime_type}]
  const [targetPlatforms, setTargetPlatforms] = useState(['facebook', 'instagram']);
  const [scheduleMode, setScheduleMode] = useState('now'); // 'now' | 'schedule' | 'queue'
  const [scheduledAt, setScheduledAt] = useState('');

  /* ── Pre-fill when editing ────────────────────────────────────────── */
  useEffect(() => {
    if (existing && isEditing) {
      setTitle(existing.title || '');
      setContent(existing.content || '');
      setMediaType(existing.media_type || 'text');
      setTargetPlatforms(existing.target_platforms || []);
      if (existing.scheduled_at) {
        setScheduleMode('schedule');
        setScheduledAt(toLocalInput(existing.scheduled_at));
      }
    }
  }, [existing, isEditing]);

  /* ── State for save + preflight + AI strip ─────────────────────────── */
  const [saving, setSaving]       = useState(false);
  const [preflight, setPreflight] = useState(null);   // { ok, platforms: {p: {ok, errors, warnings}} }
  const [aiBusy, setAiBusy]       = useState(false);
  const [activePreview, setActivePreview] = useState(targetPlatforms[0] || 'facebook');

  /* When platforms change, ensure activePreview is one of them */
  useEffect(() => {
    if (!targetPlatforms.includes(activePreview) && targetPlatforms[0]) {
      setActivePreview(targetPlatforms[0]);
    }
  }, [targetPlatforms, activePreview]);

  /* ── Per-platform character counts (live) ──────────────────────────── */
  const counts = useMemo(() => {
    return PLATFORMS.reduce((acc, p) => {
      acc[p.id] = { used: content.length, max: p.maxText, over: content.length > p.maxText };
      return acc;
    }, {});
  }, [content]);

  /* ── Handlers ──────────────────────────────────────────────────────── */
  function togglePlatform(pid) {
    setTargetPlatforms((cur) => cur.includes(pid)
      ? cur.filter((x) => x !== pid)
      : [...cur, pid]);
  }

  async function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await composerAPI.media.upload(fd);
      setMediaAssets((cur) => [...cur, res.data]);
      // Auto-pick media type if first upload
      if (mediaAssets.length === 0) {
        if ((res.data.mime_type || '').startsWith('video/')) setMediaType('video');
        else setMediaType('image');
      } else if (mediaAssets.length === 1) {
        setMediaType('carousel');
      }
      toast.success('Uploaded');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    }
  }

  function removeAsset(idx) {
    setMediaAssets((cur) => cur.filter((_, i) => i !== idx));
  }

  /* ── Save / publish flow ───────────────────────────────────────────── */
  function buildPayload() {
    return {
      title: title.trim(),
      content,
      media_type: mediaType,
      target_platforms: targetPlatforms,
      // Reference assets via "asset:<id>" so the orchestrator resolves to S3
      // presigned URLs at publish time.
      media_urls: mediaAssets.map((a) => `asset:${a.id}`),
    };
  }

  async function ensurePost() {
    const payload = buildPayload();
    if (isEditing) {
      const res = await composerAPI.posts.update(id, payload);
      return res.data;
    }
    const res = await composerAPI.posts.create(payload);
    navigate(`/admin/analytics/composer/${res.data.id}`, { replace: true });
    return res.data;
  }

  async function onSaveDraft() {
    if (!validate()) return;
    setSaving(true);
    try {
      await ensurePost();
      toast.success('Draft saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onPreflight() {
    setPreflight(null);
    try {
      const res = await composerAPI.preflight({
        ...buildPayload(),
        media_assets: mediaAssets.map((a) => a.id),
      });
      setPreflight(res.data);
      if (res.data.ok) toast.success('Preflight passed — ready to publish');
      else toast.error('Preflight found issues — see details below');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Preflight failed');
    }
  }

  async function onSchedule() {
    if (!validate()) return;
    if (!scheduledAt) { toast.error('Pick a future date/time first'); return; }
    setSaving(true);
    try {
      const post = await ensurePost();
      await composerAPI.posts.schedule(post.id, new Date(scheduledAt).toISOString());
      toast.success(`Scheduled for ${new Date(scheduledAt).toLocaleString()}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Schedule failed');
    } finally {
      setSaving(false);
    }
  }

  async function onPublishNow() {
    if (!validate()) return;
    setSaving(true);
    try {
      const post = await ensurePost();
      const res = await composerAPI.posts.publishNow(post.id);
      const status = res.data?.status;
      if (status === 'pending_approval') {
        toast.success('Sent for approval');
      } else {
        toast.success('Publishing — check status in a few seconds');
      }
    } catch (e) {
      const msg = e.response?.data?.detail || 'Publish failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function validate() {
    if (mediaType === 'text' && !content.trim()) {
      toast.error('Add some text first'); return false;
    }
    if (mediaType !== 'text' && mediaAssets.length === 0) {
      toast.error('Upload at least one media file'); return false;
    }
    if (targetPlatforms.length === 0) {
      toast.error('Pick at least one platform'); return false;
    }
    return true;
  }

  /* ── AI strip ──────────────────────────────────────────────────────── */
  async function aiCompose() {
    setAiBusy(true);
    try {
      const res = await captionAPI.generate({
        topic: title || 'general post',
        tone: 'friendly',
        post_type: 'announcement',
        platforms: targetPlatforms,
        keywords: '',
        call_to_action: '',
      });
      // Pick the first platform's caption (existing endpoint returns dict per platform)
      const captions = res.data?.captions || res.data?.generated_captions || {};
      const first = targetPlatforms.find((p) => captions[p]) || Object.keys(captions)[0];
      if (first && captions[first]) setContent(captions[first]);
      else toast.error('AI did not return a caption');
    } catch (e) {
      toast.error('AI compose failed');
    } finally {
      setAiBusy(false);
    }
  }

  async function aiHashtags() {
    setAiBusy(true);
    try {
      const res = await hashtagAPI.generate({
        niche: title || content.slice(0, 60) || 'general',
        platform: targetPlatforms[0] || 'instagram',
      });
      const tags = (res.data?.hashtags?.suggested || res.data?.hashtags || [])
        .slice(0, 8)
        .map((t) => (t.startsWith('#') ? t : `#${t}`))
        .join(' ');
      if (tags) setContent((c) => `${c}${c && !c.endsWith('\n') ? '\n\n' : ''}${tags}`);
      else toast.error('No hashtags returned');
    } catch (e) {
      toast.error('AI hashtags failed');
    } finally {
      setAiBusy(false);
    }
  }

  if (loadingExisting && isEditing) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={20} className="ds-spin" color="var(--text-tertiary)" />
        <style>{`.ds-spin { animation: ds-spin 0.9s linear infinite; } @keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div style={{ paddingBottom: 40 }}>
      <PageHeader
        title={isEditing ? 'Edit Post' : 'New Post'}
        subtitle="Compose once. Publish everywhere."
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" icon={Save} onClick={onSaveDraft} loading={saving}>
              Save Draft
            </Button>
            <Button variant="secondary" icon={Eye} onClick={onPreflight}>
              Preflight
            </Button>
            {scheduleMode === 'schedule' ? (
              <Button variant="primary" icon={Calendar} onClick={onSchedule} loading={saving}>
                Schedule
              </Button>
            ) : (
              <Button variant="primary" icon={Send} onClick={onPublishNow} loading={saving}>
                Publish Now
              </Button>
            )}
          </div>
        }
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 16,
        padding: '0 24px',
      }} className="composer-grid">
        {/* ── LEFT: editor ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Platform toggles */}
          <Card padding="md">
            <Card.Header
              title="Publish to"
              subtitle="Pick where this post should go live"
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {PLATFORMS.map((p) => {
                const on = targetPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    aria-pressed={on}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-pill)',
                      border: `1px solid ${on ? 'transparent' : 'var(--border-default)'}`,
                      background: on ? p.color : 'var(--surface-card)',
                      color: on ? '#fff' : 'var(--text-primary)',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: 'unset', minWidth: 'unset',
                      transition: 'var(--transition-fast)',
                      boxShadow: on ? '0 2px 6px rgba(10,14,20,0.08)' : 'none',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Title + Body */}
          <Card padding="md">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Internal title (optional)"
              style={{
                width: '100%',
                padding: '8px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 15, fontWeight: 600,
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <AIWriteButton
                clientId={user?.client_id}
                platform={targetPlatforms?.[0] || 'instagram'}
                onInsert={(text) => setContent((c) => c ? `${c}\n\n${text}` : text)}
                size="sm"
                align="right"
              />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to say?"
              rows={10}
              style={{
                width: '100%',
                padding: '12px 0',
                background: 'transparent',
                border: 'none',
                resize: 'vertical',
                fontSize: 14,
                fontFamily: 'inherit',
                color: 'var(--text-primary)',
                outline: 'none',
                lineHeight: 1.6,
                boxSizing: 'border-box',
                minHeight: 'unset',
              }}
            />
            {/* Per-platform char counts (only for selected) */}
            <div style={{
              display: 'flex', gap: 12, flexWrap: 'wrap',
              fontSize: 11, color: 'var(--text-tertiary)',
              marginTop: 8, paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
            }}>
              {targetPlatforms.map((pid) => {
                const c = counts[pid];
                return (
                  <span key={pid} style={{
                    color: c.over ? 'var(--danger)' : 'var(--text-tertiary)',
                    fontWeight: c.over ? 600 : 500,
                  }}>
                    {pid}: {c.used}/{c.max}
                  </span>
                );
              })}
            </div>
          </Card>

          {/* Media + Type */}
          <Card padding="md">
            <Card.Header
              title="Media"
              subtitle="Images, videos, carousels"
              action={<MediaUploadButton onUpload={uploadFile} />}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
              {MEDIA_TYPES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMediaType(m.id)}
                  style={typePillStyle(mediaType === m.id)}
                >
                  {m.icon ? <m.icon size={12} strokeWidth={2.4} /> : null}
                  {m.label}
                </button>
              ))}
            </div>
            <MediaGrid assets={mediaAssets} onRemove={removeAsset} />
          </Card>

          {/* Scheduling */}
          <Card padding="md">
            <Card.Header title="When to post" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {[
                { id: 'now',      label: 'Now',         icon: Send },
                { id: 'schedule', label: 'Schedule',    icon: Calendar },
                { id: 'queue',    label: 'Add to Queue', icon: Layers },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setScheduleMode(m.id)}
                  style={typePillStyle(scheduleMode === m.id)}
                >
                  <m.icon size={12} strokeWidth={2.4} /> {m.label}
                </button>
              ))}
            </div>
            {scheduleMode === 'schedule' && (
              <div style={{ marginTop: 12 }}>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  In your local time. The scheduler runs every minute.
                </div>
              </div>
            )}
            {scheduleMode === 'queue' && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                Manage queues from the <strong>Queues</strong> page. Save this as a draft and add it
                to a queue from there, or use "Add to Queue" after saving.
              </div>
            )}
          </Card>

          {/* AI assist strip */}
          <Card padding="sm" style={{ background: 'var(--surface-sunken)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                AI assist
              </span>
              <Button variant="secondary" size="sm" icon={Wand2}
                      onClick={aiCompose} loading={aiBusy} disabled={targetPlatforms.length === 0}>
                Compose
              </Button>
              <Button variant="secondary" size="sm" icon={Hash}
                      onClick={aiHashtags} loading={aiBusy}>
                Add hashtags
              </Button>
              <Button variant="ghost" size="sm" icon={Clock} disabled
                      title="Best time to post — coming with audience analytics">
                Best time
              </Button>
            </div>
          </Card>

          {/* Preflight results */}
          {preflight && <PreflightPanel result={preflight} onClose={() => setPreflight(null)} />}
        </div>

        {/* ── RIGHT: live preview ────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 'calc(var(--topbar-height) + 16px)', alignSelf: 'flex-start' }}>
          <Card padding="none" style={{ overflow: 'hidden' }}>
            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 0,
              borderBottom: '1px solid var(--border-subtle)',
              overflowX: 'auto',
            }}>
              {(targetPlatforms.length ? targetPlatforms : ['facebook']).map((pid) => {
                const p = PLATFORMS.find((x) => x.id === pid) || PLATFORMS[0];
                const active = pid === activePreview;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => setActivePreview(pid)}
                    style={{
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: active ? `2px solid ${p.color}` : '2px solid transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      minHeight: 'unset', minWidth: 'unset',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div style={{ padding: 20, background: 'var(--surface-sunken)' }}>
              <PlatformPreview
                platform={activePreview}
                content={content}
                mediaAssets={mediaAssets}
                mediaType={mediaType}
                user={user}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Mobile-friendly grid override */}
      <style>{`
        @media (max-width: 1024px) {
          .composer-grid { grid-template-columns: 1fr !important; }
          .composer-grid > div:last-child { position: static !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────── */
function MediaUploadButton({ onUpload }) {
  const ref = useRef();
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          for (const f of e.target.files || []) onUpload(f);
          e.target.value = '';
        }}
      />
      <Button variant="secondary" size="sm" icon={Upload}
              onClick={() => ref.current?.click()}>
        Upload
      </Button>
    </>
  );
}

function MediaGrid({ assets, onRemove }) {
  if (!assets.length) {
    return (
      <div style={{
        border: '1px dashed var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 24, textAlign: 'center',
        fontSize: 13, color: 'var(--text-tertiary)',
      }}>
        No media yet — click Upload to add images or videos.
      </div>
    );
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
      gap: 8,
    }}>
      {assets.map((a, idx) => (
        <div key={a.id} style={{ position: 'relative' }}>
          <div style={{
            width: '100%', aspectRatio: '1 / 1',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {a.thumbnail_url || (a.mime_type || '').startsWith('image/') ? (
              <img src={a.thumbnail_url || a.file_url} alt={a.alt_text || ''}
                   style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Video size={28} color="var(--text-tertiary)" />
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label="Remove"
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 22, height: 22, borderRadius: 999,
              background: 'rgba(10,14,20,0.7)', color: '#fff',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 'unset', minWidth: 'unset',
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function PlatformPreview({ platform, content, mediaAssets, mediaType, user }) {
  const meta = PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0];
  const handle = user?.first_name || user?.email?.split('@')[0] || 'You';

  // Common card shell (white card on surface-sunken background)
  return (
    <div style={{
      background: 'var(--surface-card)', color: 'var(--text-primary)',
      borderRadius: 'var(--radius-md)',
      maxWidth: 540, margin: '0 auto',
      boxShadow: '0 1px 4px rgba(10,14,20,0.06)',
      overflow: 'hidden',
      border: '1px solid var(--border-default)',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 999,
          background: `linear-gradient(135deg, ${meta.color}, ${shade(meta.color, -15)})`,
          color: '#fff', fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {handle[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{handle}</div>
          <div style={{ fontSize: 11, color: '#667781' }}>
            {meta.label} · just now
          </div>
        </div>
      </div>

      {/* Body text (above media for FB/LI/GMB; below for IG) */}
      {platform !== 'instagram' && content && (
        <div style={{ padding: '0 14px 12px', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>
          {content}
        </div>
      )}

      {/* Media */}
      {mediaAssets.length > 0 && mediaType !== 'text' && (
        <PreviewMedia assets={mediaAssets} mediaType={mediaType} platform={platform} />
      )}

      {/* IG: caption below */}
      {platform === 'instagram' && content && (
        <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>
          <strong>{handle}</strong> {content}
        </div>
      )}

      {/* Engagement row */}
      <div style={{
        display: 'flex', gap: 16, padding: '8px 14px 14px',
        borderTop: '1px solid var(--surface-sunken)', fontSize: 12, color: '#667781',
      }}>
        <span>♡ Like</span>
        <span>💬 Comment</span>
        <span>↗ Share</span>
      </div>
    </div>
  );
}

function PreviewMedia({ assets, mediaType, platform }) {
  const isSquare = platform === 'instagram';

  if (mediaType === 'video' || mediaType === 'reel') {
    const a = assets[0];
    return (
      <div style={{
        background: '#000', aspectRatio: platform === 'instagram' && mediaType === 'reel' ? '9/16' : '16/9',
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        {a?.thumbnail_url ? (
          <img src={a.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
        <div style={{
          position: 'absolute', width: 56, height: 56, borderRadius: 999,
          background: 'rgba(0,0,0,0.55)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>▶</div>
      </div>
    );
  }

  if (mediaType === 'carousel' && assets.length > 1) {
    return (
      <div style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
        {assets.map((a) => (
          <div key={a.id} style={{
            flex: '0 0 100%',
            aspectRatio: isSquare ? '1 / 1' : '16 / 10',
            background: 'var(--text-primary)',
            scrollSnapAlign: 'start',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {a.thumbnail_url || a.file_url ? (
              <img src={a.thumbnail_url || a.file_url} alt={a.alt_text || ''}
                   style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  // Single image (or first of carousel)
  const a = assets[0];
  return (
    <div style={{
      width: '100%',
      aspectRatio: isSquare ? '1 / 1' : '16 / 10',
      background: 'var(--text-primary)',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {a?.thumbnail_url || a?.file_url ? (
        <img src={a.thumbnail_url || a.file_url} alt={a.alt_text || ''}
             style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
    </div>
  );
}

function PreflightPanel({ result, onClose }) {
  return (
    <Card padding="md">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {result.ok
            ? <CheckCircle2 size={18} color="var(--success)" />
            : <AlertCircle size={18} color="var(--danger)" />}
          <strong style={{ fontSize: 14 }}>
            {result.ok ? 'Preflight passed' : 'Preflight found issues'}
          </strong>
        </div>
        <button onClick={onClose} aria-label="Dismiss"
                style={{ background: 'transparent', border: 'none',
                         color: 'var(--text-tertiary)', cursor: 'pointer',
                         minHeight: 'unset', minWidth: 'unset', padding: 4 }}>
          <X size={14} />
        </button>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(result.platforms || {}).map(([pid, status]) => {
          const p = PLATFORMS.find((x) => x.id === pid);
          return (
            <div key={pid} style={{
              padding: 12, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              background: status.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 13, color: p?.color }}>{p?.label || pid}</strong>
                {status.ok
                  ? <Badge variant="success" dot>OK</Badge>
                  : <Badge variant="danger" dot>Blocked</Badge>}
              </div>
              {(status.errors || []).length > 0 && (
                <ul style={ulStyle}>
                  {status.errors.map((e, i) => <li key={i} style={{ color: 'var(--danger)' }}>{e}</li>)}
                </ul>
              )}
              {(status.warnings || []).length > 0 && (
                <ul style={ulStyle}>
                  {status.warnings.map((w, i) => <li key={i} style={{ color: 'var(--warning)' }}>{w}</li>)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Style helpers ────────────────────────────────────────────────── */
function typePillStyle(active) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 12px',
    background: active ? 'var(--brand-primary-glow)' : 'var(--surface-card)',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: `1px solid ${active ? 'transparent' : 'var(--border-subtle)'}`,
    borderRadius: 'var(--radius-pill)',
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
    minHeight: 'unset', minWidth: 'unset',
    transition: 'var(--transition-fast)',
  };
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box',
  minHeight: 'unset',
};

const ulStyle = {
  margin: '6px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.5,
};

function toLocalInput(iso) {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 16);
}

// Lighten/darken hex color by `pct` (negative = darker)
function shade(hex, pct) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  let n = parseInt(m[1], 16);
  let r = (n >> 16) + Math.round(255 * pct / 100);
  let g = ((n >> 8) & 0xff) + Math.round(255 * pct / 100);
  let b = (n & 0xff) + Math.round(255 * pct / 100);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
