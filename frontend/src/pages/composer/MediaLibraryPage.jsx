/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useRef, useState, useCallback } from 'react';
import { Image as ImageIcon, Video, Trash2, Upload, Search, Loader2, Folder } from 'lucide-react';
import toast from 'react-hot-toast';

import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import { useMediaAssets } from '../../hooks/useComposer';
import { composerAPI } from '../../services/api';

export default function MediaLibraryPage() {
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [mime, setMime] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const fileRef = useRef();

  const params = {};
  if (folder) params.folder = folder;
  if (mime)   params.mime   = mime;
  const { data: assets, refetch, loading } = useMediaAssets(params);

  const filtered = !search ? assets
    : assets.filter((a) => (
      (a.alt_text || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.tags || []).join(' ').toLowerCase().includes(search.toLowerCase())
    ));

  // Folder list derived from existing assets
  const folders = Array.from(new Set(assets.map((a) => a.folder).filter(Boolean))).sort();

  /* ── Upload handlers ───────────────────────────────────────────────── */
  async function uploadFiles(files) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      if (folder) fd.append('folder', folder);
      const res = await composerAPI.media.bulkUpload(fd);
      const created = res.data?.created || [];
      const errors = res.data?.errors || [];
      if (created.length) toast.success(`Uploaded ${created.length} file${created.length === 1 ? '' : 's'}`);
      if (errors.length)  toast.error(`${errors.length} file${errors.length === 1 ? '' : 's'} failed`);
      refetch();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files || []));
  // eslint-disable-next-line
  }, [folder]);

  /* ── Selection ─────────────────────────────────────────────────────── */
  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function bulkDelete() {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`)) return;
    try {
      await Promise.all([...selected].map((id) => composerAPI.media.delete(id)));
      setSelected(new Set());
      refetch();
      toast.success('Deleted');
    } catch (e) {
      toast.error('Delete failed');
    }
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      <PageHeader
        title="Media Library"
        subtitle="Reusable photos, videos, and graphics"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {selected.size > 0 && (
              <Button variant="secondary" icon={Trash2} onClick={bulkDelete}>
                Delete ({selected.size})
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
            />
            <Button variant="primary" icon={Upload} onClick={() => fileRef.current?.click()} loading={uploading}>
              Upload
            </Button>
          </div>
        }
      />

      <div style={{ padding: '0 24px' }}>
        {/* Toolbar */}
        <Card padding="sm" style={{
          display: 'flex', gap: 8, alignItems: 'center',
          flexWrap: 'wrap', marginBottom: 12, padding: 10,
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} color="var(--text-tertiary)"
                    style={{ position: 'absolute', top: 11, left: 10 }} />
            <input
              placeholder="Search alt text or tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
          <select value={mime} onChange={(e) => setMime(e.target.value)} style={inputStyle}>
            <option value="">All types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
          <select value={folder} onChange={(e) => setFolder(e.target.value)} style={inputStyle}>
            <option value="">All folders</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Card>

        {/* Drag-drop zone or grid */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            background: dragOver ? 'var(--brand-primary-glow)' : 'transparent',
            borderRadius: 'var(--radius-lg)',
            border: dragOver ? '2px dashed var(--brand-primary)' : '2px dashed transparent',
            padding: dragOver ? 16 : 0,
            transition: 'var(--transition-fast)',
          }}
        >
          {loading && (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <Loader2 size={18} className="ds-spin" color="var(--text-tertiary)" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <Card padding="none" style={{ overflow: 'hidden' }}>
              <EmptyState
                icon={ImageIcon}
                title="No media yet"
                description="Drag-and-drop files anywhere on this page, or click Upload."
                action={<Button icon={Upload} onClick={() => fileRef.current?.click()}>Upload</Button>}
              />
            </Card>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
            }}>
              {filtered.map((a) => (
                <AssetTile
                  key={a.id}
                  asset={a}
                  selected={selected.has(a.id)}
                  onToggle={() => toggle(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`.ds-spin { animation: ds-spin 0.9s linear infinite; } @keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AssetTile({ asset, selected, onToggle }) {
  const isVideo = (asset.mime_type || '').startsWith('video/');
  return (
    <div
      onClick={onToggle}
      style={{
        position: 'relative',
        background: 'var(--surface-card)',
        border: `1px solid ${selected ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        boxShadow: selected ? '0 0 0 2px var(--brand-primary-glow)' : 'none',
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '1 / 1',
        background: 'var(--surface-sunken)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {asset.thumbnail_url ? (
          <img src={asset.thumbnail_url} alt={asset.alt_text || ''}
               style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : isVideo ? (
          <Video size={32} color="var(--text-tertiary)" />
        ) : (
          <ImageIcon size={32} color="var(--text-tertiary)" />
        )}
        {isVideo && asset.duration_seconds ? (
          <span style={{
            position: 'absolute', bottom: 6, right: 6,
            background: 'rgba(10,14,20,0.7)', color: '#fff',
            padding: '2px 6px', borderRadius: 4,
            fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
          }}>
            {fmtDuration(asset.duration_seconds)}
          </span>
        ) : null}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{(asset.mime_type || '').split('/')[1] || '—'}</span>
          <span>{fmtBytes(asset.file_size)}</span>
        </div>
        {asset.folder && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)',
          }}>
            <Folder size={10} /> {asset.folder}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  height: 36,
  padding: '0 12px',
  background: 'var(--surface-card)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box',
  minHeight: 'unset',
};

function fmtBytes(n) {
  if (!n) return '—';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024)        return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function fmtDuration(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
