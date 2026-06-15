/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useRef, useState } from 'react';
import {
  Upload, Scissors, Crop, Camera, Captions, Youtube,
  Loader2, Play, X, Link as LinkIcon, FileVideo, Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { videoAPI, composerAPI } from '../../services/api';

const ASPECTS = [
  { id: '16:9', label: '16:9 · Landscape',  hint: 'YouTube, Facebook, LinkedIn feed' },
  { id: '9:16', label: '9:16 · Vertical',   hint: 'Reels, Shorts, Stories' },
  { id: '1:1',  label: '1:1 · Square',      hint: 'Feed posts on Instagram' },
  { id: '4:5',  label: '4:5 · Portrait',    hint: 'Instagram feed (taller)' },
];

const TABS = [
  { id: 'trim',     label: 'Trim',       icon: Scissors },
  { id: 'resize',   label: 'Resize',     icon: Crop },
  { id: 'thumb',    label: 'Thumbnail',  icon: Camera },
  { id: 'captions', label: 'Captions',   icon: Captions },
  { id: 'publish',  label: 'Publish',    icon: Youtube },
];

export default function VideoStudioPage() {
  const [active, setActive] = useState(null);   // currently-loaded MediaAsset (video)
  const [derived, setDerived] = useState([]);   // list of derived assets (trims/resizes/thumbs)
  const [tab, setTab] = useState('trim');

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Video Studio"
        subtitle="Trim, resize, capture thumbnails, and publish to YouTube"
      />

      <div className="vs-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 380px',
        gap: 16,
        padding: '0 24px',
      }}>
        {/* ── Player + derived assets ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!active && <UploadCard onUploaded={(a) => setActive(a)} />}
          {active && (
            <PlayerCard
              asset={active}
              onClear={() => { setActive(null); setDerived([]); }}
            />
          )}

          {derived.length > 0 && (
            <Card padding="md">
              <Card.Header title="Derived clips" subtitle="Click any clip to make it the active asset" />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 8,
              }}>
                {derived.map((d) => (
                  <DerivedTile
                    key={d.id}
                    asset={d}
                    onPick={() => setActive(d)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Tools panel ─────────────────────────────────────────── */}
        <Card padding="none" style={{ overflow: 'hidden', alignSelf: 'flex-start',
                                        position: 'sticky', top: 'calc(var(--topbar-height) + 16px)' }}>
          <div style={{ display: 'flex', overflowX: 'auto',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: 'var(--surface-sunken)' }}>
            {TABS.map((t) => {
              const isActive = t.id === tab;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: '0 0 auto',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--brand-primary)' : '2px solid transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    whiteSpace: 'nowrap',
                    minHeight: 'unset', minWidth: 'unset',
                  }}
                >
                  <Icon size={13} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: 16 }}>
            {!active ? (
              <EmptyState
                icon={FileVideo}
                title="Load a video first"
                description="Upload a file or paste a URL to start editing."
                compact
              />
            ) : (
              <>
                {tab === 'trim'     && <TrimTool     asset={active} onResult={(a) => { setActive(a); setDerived((d) => [a, ...d]); }} />}
                {tab === 'resize'   && <ResizeTool   asset={active} onResult={(a) => { setActive(a); setDerived((d) => [a, ...d]); }} />}
                {tab === 'thumb'    && <ThumbnailTool asset={active} onResult={(a) => setDerived((d) => [a, ...d])} />}
                {tab === 'captions' && <CaptionsTool asset={active} />}
                {tab === 'publish'  && <PublishTool  asset={active} />}
              </>
            )}
          </div>
        </Card>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .vs-grid { grid-template-columns: 1fr !important; }
          .vs-grid > div:last-child { position: static !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Upload ────────────────────────────────────────────────────────────── */
function UploadCard({ onUploaded }) {
  const fileRef = useRef();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function uploadFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await videoAPI.upload(fd);
      onUploaded(res.data);
      toast.success('Video uploaded');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed');
    } finally { setBusy(false); }
  }

  async function importUrl() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await videoAPI.importFromUrl({ url: url.trim() });
      onUploaded(res.data);
      toast.success('Video imported');
      setUrl('');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Import failed');
    } finally { setBusy(false); }
  }

  return (
    <Card padding="none" style={{ overflow: 'hidden' }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          uploadFile(e.dataTransfer.files?.[0]);
        }}
        style={{
          padding: 40,
          textAlign: 'center',
          border: drag ? '2px dashed var(--brand-primary)' : '2px dashed transparent',
          background: drag ? 'var(--brand-primary-glow)' : 'transparent',
          transition: 'var(--transition-fast)',
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover))',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', marginBottom: 12,
        }}>
          <FileVideo size={24} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          Drop a video here, or
        </div>
        <input ref={fileRef} type="file" accept="video/*" hidden
                onChange={(e) => uploadFile(e.target.files?.[0])} />
        <Button icon={Upload} onClick={() => fileRef.current?.click()} loading={busy}>
          Choose file
        </Button>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)',
                      maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
            …or import from a URL
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <LinkIcon size={14} color="var(--text-tertiary)"
                        style={{ position: 'absolute', top: 11, left: 10 }} />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                style={{ ...inputStyle, paddingLeft: 30 }}
              />
            </div>
            <Button onClick={importUrl} loading={busy} disabled={!url.trim()}>
              Import
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Player ────────────────────────────────────────────────────────────── */
function PlayerCard({ asset, onClear }) {
  return (
    <Card padding="none" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {asset.file_url ? asset.file_url.split('/').pop().split('?')[0] : 'video.mp4'}
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Badge variant="default">{(asset.mime_type || '').split('/')[1] || 'video'}</Badge>
            {asset.duration_seconds > 0 && (
              <Badge>{fmtDuration(asset.duration_seconds)}</Badge>
            )}
            {asset.width > 0 && (
              <Badge>{asset.width}×{asset.height}</Badge>
            )}
            {asset.file_size > 0 && (
              <Badge>{fmtBytes(asset.file_size)}</Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" icon={X} iconOnly onClick={onClear} aria-label="Close" />
      </div>
      <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: 320 }}>
        {asset.file_url ? (
          <video
            src={asset.file_url}
            controls
            style={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div style={{ color: 'var(--text-tertiary)', padding: 32 }}>No preview URL</div>
        )}
      </div>
    </Card>
  );
}

/* ── Tools ─────────────────────────────────────────────────────────────── */
function TrimTool({ asset, onResult }) {
  const max = Math.max(0.1, asset.duration_seconds || 60);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(10, max));
  const [busy, setBusy] = useState(false);

  async function run() {
    if (end <= start) { toast.error('End must be after start'); return; }
    setBusy(true);
    try {
      const res = await videoAPI.trim({
        asset_id: asset.id, start_seconds: start, end_seconds: end,
      });
      onResult(res.data);
      toast.success('Trim complete');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Trim failed');
    } finally { setBusy(false); }
  }

  return (
    <>
      <ToolHeader title="Trim" desc="Cut a section from this video" />
      <Field label={`Start (${fmtDuration(start)})`}>
        <input type="range" min={0} max={max} step={0.1}
                value={start}
                onChange={(e) => setStart(Math.min(parseFloat(e.target.value), end - 0.1))}
                style={rangeStyle} />
      </Field>
      <Field label={`End (${fmtDuration(end)})`}>
        <input type="range" min={0} max={max} step={0.1}
                value={end}
                onChange={(e) => setEnd(Math.max(parseFloat(e.target.value), start + 0.1))}
                style={rangeStyle} />
      </Field>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        New duration: <strong>{fmtDuration(end - start)}</strong>
      </div>
      <Button onClick={run} loading={busy} icon={Scissors} fullWidth>
        Trim & save as new clip
      </Button>
    </>
  );
}

function ResizeTool({ asset, onResult }) {
  const [aspect, setAspect] = useState('9:16');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await videoAPI.resize({ asset_id: asset.id, target_aspect: aspect });
      onResult(res.data);
      toast.success(`Resized to ${aspect}`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Resize failed');
    } finally { setBusy(false); }
  }

  return (
    <>
      <ToolHeader title="Resize" desc="Center-crop into a different aspect ratio" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {ASPECTS.map((a) => {
          const on = aspect === a.id;
          return (
            <button
              key={a.id} type="button"
              onClick={() => setAspect(a.id)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${on ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                background: on ? 'var(--brand-primary-glow)' : 'var(--surface-card)',
                cursor: 'pointer', minHeight: 'unset', minWidth: 'unset',
                transition: 'var(--transition-fast)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{a.hint}</div>
            </button>
          );
        })}
      </div>
      <Button onClick={run} loading={busy} icon={Crop} fullWidth>
        Resize to {aspect}
      </Button>
    </>
  );
}

function ThumbnailTool({ asset, onResult }) {
  const max = Math.max(0.5, (asset.duration_seconds || 1) - 0.1);
  const [t, setT] = useState(Math.min(2, max));
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await videoAPI.extractThumbnail({ asset_id: asset.id, time_seconds: t });
      onResult(res.data);
      toast.success('Thumbnail saved');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Thumbnail failed');
    } finally { setBusy(false); }
  }

  return (
    <>
      <ToolHeader title="Extract thumbnail" desc="Capture a still frame as an image asset" />
      <Field label={`Time: ${fmtDuration(t)}`}>
        <input type="range" min={0} max={max} step={0.1}
                value={t} onChange={(e) => setT(parseFloat(e.target.value))}
                style={rangeStyle} />
      </Field>
      <Button onClick={run} loading={busy} icon={Camera} fullWidth>
        Capture frame
      </Button>
    </>
  );
}

function CaptionsTool({ asset }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setBusy(true); setError(null);
    try {
      await videoAPI.addCaptions({ asset_id: asset.id });
      toast.success('Captions queued');
    } catch (e) {
      const detail = e.response?.data?.detail || e.response?.data?.error;
      if (e.response?.status === 501) setError(detail || 'Captions service not configured.');
      else toast.error('Captions failed');
    } finally { setBusy(false); }
  }

  return (
    <>
      <ToolHeader title="Auto captions" desc="Transcribe the audio and burn captions in" />
      {error && (
        <div style={{
          padding: '10px 12px', marginBottom: 12,
          background: 'var(--warning-bg)', color: 'var(--warning)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12, lineHeight: 1.5,
        }}>
          <strong>Not configured.</strong> {error}
        </div>
      )}
      <Button onClick={run} loading={busy} icon={Captions} fullWidth>
        Generate captions
      </Button>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
        Requires <code style={code}>WHISPER_API_KEY</code> on the server.
      </div>
    </>
  );
}

function PublishTool({ asset }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('unlisted');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function run() {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setBusy(true); setResult(null);
    try {
      const res = await videoAPI.youtubeUpload({
        asset_id: asset.id, title, description, privacy,
      });
      setResult(res.data);
      toast.success('Uploaded to YouTube');
    } catch (e) {
      const code = e.response?.data?.code;
      if (code === 'token_expired') toast.error('YouTube token expired — please reconnect.');
      else toast.error(e.response?.data?.error || 'Upload failed');
    } finally { setBusy(false); }
  }

  return (
    <>
      <ToolHeader title="Publish to YouTube" desc="Direct upload via the connected channel" />
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="My new video" style={inputStyle} />
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                   rows={4} placeholder="Tell viewers what it's about…"
                   style={{ ...inputStyle, height: 'auto', resize: 'vertical' }} />
      </Field>
      <Field label="Privacy">
        <select value={privacy} onChange={(e) => setPrivacy(e.target.value)} style={inputStyle}>
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>
      </Field>
      <Button onClick={run} loading={busy} icon={Youtube} fullWidth>
        Upload to YouTube
      </Button>
      {result?.platform_url && (
        <a href={result.platform_url} target="_blank" rel="noreferrer"
           style={{
             display: 'block', marginTop: 10, fontSize: 12, fontWeight: 600,
             color: 'var(--brand-primary-hover)', textDecoration: 'none',
           }}>
          View on YouTube ↗
        </a>
      )}
    </>
  );
}

/* ── Derived tile ──────────────────────────────────────────────────────── */
function DerivedTile({ asset, onPick }) {
  const isVideo = (asset.mime_type || '').startsWith('video/');
  return (
    <button
      type="button"
      onClick={onPick}
      style={{
        position: 'relative',
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 0, cursor: 'pointer',
        overflow: 'hidden',
        textAlign: 'left',
        minHeight: 'unset', minWidth: 'unset',
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '16/9',
        background: 'var(--surface-sunken)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {asset.thumbnail_url ? (
          <img src={asset.thumbnail_url} alt=""
               style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : isVideo ? (
          <Play size={28} color="var(--text-tertiary)" />
        ) : (
          <Camera size={28} color="var(--text-tertiary)" />
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {asset.alt_text || asset.file_url?.split('/').pop()?.split('?')[0]}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {isVideo
            ? `${fmtDuration(asset.duration_seconds)} · ${asset.width}×${asset.height}`
            : `${asset.width}×${asset.height} · ${fmtBytes(asset.file_size)}`}
        </div>
      </div>
    </button>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
function ToolHeader({ title, desc }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{desc}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{
        display: 'block', fontSize: 11, fontWeight: 600,
        color: 'var(--text-tertiary)', textTransform: 'uppercase',
        letterSpacing: 0.4, marginBottom: 6,
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function fmtDuration(sec) {
  if (!sec || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtBytes(n) {
  if (!n) return '—';
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

const inputStyle = {
  width: '100%', height: 36, padding: '0 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box', minHeight: 'unset',
};

const rangeStyle = {
  width: '100%', accentColor: 'var(--brand-primary)',
};

const code = {
  background: 'var(--surface-sunken)',
  padding: '0 6px', borderRadius: 4,
  fontFamily: 'var(--font-mono)', fontSize: 11,
};
