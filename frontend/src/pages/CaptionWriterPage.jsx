import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useClients } from '../hooks/useData';
import { captionAPI, hashtagAPI } from '../services/api';
import {
  Copy, Edit2, CalendarDays, RefreshCw, Sparkles,
  Clock, Hash, CheckSquare, Square, ChevronDown, ChevronUp, Loader2,
  Save, X, ChevronRight,
} from 'lucide-react';

// ── Caption platform config ─────────────────────────────────────────────────────
const PLATFORMS = {
  facebook:           { label: 'Facebook',          emoji: '📘', color: '#1877f2', limit: 63206 },
  instagram:          { label: 'Instagram',          emoji: '📸', color: '#e1306c', limit: 2200  },
  linkedin:           { label: 'LinkedIn',           emoji: '💼', color: '#0077b5', limit: 3000  },
  youtube:            { label: 'YouTube',            emoji: '▶️', color: '#ff0000', limit: 5000  },
  google_my_business: { label: 'Google My Business', emoji: '🏢', color: '#34a853', limit: 1500  },
};

// ── Hashtag platform config ─────────────────────────────────────────────────────
const HASHTAG_PLATFORMS = {
  instagram: { label: 'Instagram', emoji: '📸', color: '#e1306c' },
  facebook:  { label: 'Facebook',  emoji: '📘', color: '#1877f2' },
  linkedin:  { label: 'LinkedIn',  emoji: '💼', color: '#0077b5' },
  youtube:   { label: 'YouTube',   emoji: '▶️', color: '#ff0000' },
  tiktok:    { label: 'TikTok',    emoji: '🎵', color: '#69c9d0' },
};

const TIER_ORDER = ['mega', 'large', 'medium', 'small', 'local', 'branded'];
const TIER_CONFIG = {
  mega:    { label: 'Mega',    subtitle: '1M+ posts',    color: '#7c3aed', bg: '#f3e8ff', border: '#e9d5ff' },
  large:   { label: 'Large',   subtitle: '100K–1M posts', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  medium:  { label: 'Medium',  subtitle: '10K–100K posts',color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  small:   { label: 'Small',   subtitle: '1K–10K posts',  color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  local:   { label: 'Local',   subtitle: 'Location tags', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  branded: { label: 'Branded', subtitle: 'Your own brand',color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
};

const HASHTAG_POST_TYPES = [
  { value: 'general',      label: 'General' },
  { value: 'promotion',    label: 'Promotion' },
  { value: 'educational',  label: 'Educational' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'product',      label: 'Product Showcase' },
  { value: 'event',        label: 'Event' },
  { value: 'behind_scenes',label: 'Behind the Scenes' },
];

const TONES = [
  { value: 'professional',  label: 'Professional',  emoji: '💼' },
  { value: 'casual',        label: 'Casual',        emoji: '😊' },
  { value: 'funny',         label: 'Funny',         emoji: '😄' },
  { value: 'inspirational', label: 'Inspirational', emoji: '✨' },
  { value: 'urgent',        label: 'Urgent',        emoji: '🔥' },
  { value: 'friendly',      label: 'Friendly',      emoji: '👋' },
];

const POST_TYPES = [
  { value: 'promotion',    label: 'Promotion' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'educational',  label: 'Educational' },
  { value: 'behind_scenes',label: 'Behind the Scenes' },
  { value: 'product',      label: 'Product Showcase' },
  { value: 'event',        label: 'Event' },
  { value: 'tip',          label: 'Tip & Advice' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function charLimitColor(len, limit) {
  const pct = len / limit;
  if (pct > 1)    return '#dc2626';
  if (pct > 0.85) return '#f59e0b';
  return '#16a34a';
}

function useCopyText() {
  const [copied, setCopied] = useState('');
  const copy = useCallback((text, id = 'main') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(''), 2000);
    });
  }, []);
  return { copied, copy };
}

// ── Skeleton loader ────────────────────────────────────────────────────────────
function Skeleton({ height = 16, width = '100%', mb = 8 }) {
  return (
    <div style={{
      height, width, borderRadius: 8, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', marginBottom: mb,
    }} />
  );
}

// ── Caption card ───────────────────────────────────────────────────────────────
function CaptionCard({ platform, caption, hashtags, bestTime, onAddToCalendar }) {
  const cfg = PLATFORMS[platform] || { label: platform, emoji: '📄', color: '#64748b', limit: 2200 };
  const { copied, copy } = useCopyText();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(caption || '');
  const len = text.length;
  const limitColor = charLimitColor(len, cfg.limit);
  const tagsText = hashtags ? hashtags.join(' ') : '';

  return (
    <div style={cardStyles.card}>
      <div style={{ ...cardStyles.header, background: cfg.color + '15', borderBottom: `2px solid ${cfg.color}30` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{cfg.emoji}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{cfg.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: limitColor }}>
            {len.toLocaleString()} / {cfg.limit.toLocaleString()}
          </span>
          <div style={{ width: 60, height: 5, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (len / cfg.limit) * 100)}%`, height: '100%', background: limitColor, borderRadius: 99 }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {editing ? (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={6}
            style={{ width: '100%', padding: '10px 12px', border: `2px solid ${cfg.color}`, borderRadius: 10, fontSize: 14, lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#1e293b', whiteSpace: 'pre-wrap', margin: 0 }}>{text}</p>
        )}
      </div>

      {hashtags && hashtags.length > 0 && (
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Hash size={13} color="#94a3b8" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hashtags</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {hashtags.map(tag => (
              <span key={tag} style={{ padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 600 }}>{tag}</span>
            ))}
          </div>
          <button onClick={() => copy(tagsText, `tags-${platform}`)} style={{ ...cardStyles.ghostBtn, fontSize: 11 }}>
            {copied === `tags-${platform}` ? '✓ Copied!' : 'Copy hashtags'}
          </button>
        </div>
      )}

      {bestTime && (
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 99, padding: '5px 12px' }}>
            <Clock size={12} color="#16a34a" />
            <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Best time: {bestTime}</span>
          </div>
        </div>
      )}

      <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
        <button onClick={() => copy(text, platform)} style={cardStyles.actionBtn}>
          <Copy size={13} />
          {copied === platform ? 'Copied!' : 'Copy'}
        </button>
        <button onClick={() => setEditing(e => !e)} style={{ ...cardStyles.actionBtn, ...(editing ? { background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' } : {}) }}>
          <Edit2 size={13} />
          {editing ? 'Done' : 'Edit'}
        </button>
        <button onClick={() => onAddToCalendar({ platform, text, hashtags })} style={cardStyles.actionBtn}>
          <CalendarDays size={13} />
          Add to Calendar
        </button>
      </div>
    </div>
  );
}

// ── Hashtag tier card ──────────────────────────────────────────────────────────
function TierCard({ tier, data, selectedTags, onToggleTag }) {
  const [open, setOpen] = useState(true);
  const cfg = TIER_CONFIG[tier] || { label: tier, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  const tags = data?.tags || [];

  return (
    <div style={{ border: `1px solid ${cfg.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 12, background: '#fff' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: 'none', background: cfg.bg, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color, background: cfg.border, padding: '2px 10px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cfg.label}</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{data?.description || cfg.subtitle}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>({tags.length})</span>
        </div>
        {open ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
      </button>
      {open && (
        <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tags.map(t => {
            const isSelected = selectedTags.includes(t.tag);
            return (
              <button
                key={t.tag}
                onClick={() => onToggleTag(t.tag)}
                title={`Est. ${t.estimated_posts || '?'} posts`}
                style={{
                  padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${isSelected ? cfg.color : cfg.border}`,
                  background: isSelected ? cfg.color : cfg.bg,
                  color: isSelected ? '#fff' : cfg.color,
                  transition: 'all .15s',
                }}
              >
                {t.tag}
                {t.estimated_posts && (
                  <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.75 }}>{t.estimated_posts}</span>
                )}
              </button>
            );
          })}
          {tags.length === 0 && (
            <span style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>No tags in this tier</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recommended set card ────────────────────────────────────────────────────────
function RecommendedSetCard({ rec, onCopy, copied }) {
  if (!rec) return null;
  return (
    <div style={{ border: '1px solid #bfdbfe', borderRadius: 14, overflow: 'hidden', marginBottom: 12, background: '#eff6ff' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles size={14} color="#2563eb" />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8' }}>Recommended Set</span>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {rec.caption && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Caption hashtags</div>
            <p style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7, margin: '0 0 8px', wordBreak: 'break-word' }}>{rec.caption}</p>
            <button onClick={() => onCopy(rec.caption, 'rec-caption')} style={cardStyles.ghostBtn}>
              <Copy size={12} />
              {copied === 'rec-caption' ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        )}
        {rec.first_comment && (
          <div style={{ marginBottom: 12, paddingTop: 12, borderTop: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>First comment hashtags</div>
            <p style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7, margin: '0 0 8px', wordBreak: 'break-word' }}>{rec.first_comment}</p>
            <button onClick={() => onCopy(rec.first_comment, 'rec-comment')} style={cardStyles.ghostBtn}>
              <Copy size={12} />
              {copied === 'rec-comment' ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        )}
        {rec.mix_explanation && (
          <div style={{ paddingTop: 10, borderTop: '1px solid #bfdbfe' }}>
            <span style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.6 }}>{rec.mix_explanation}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyles = {
  card: { border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', marginBottom: 16, background: '#fff' },
  header: { padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  ghostBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', border: '1px solid #dbe5f3', borderRadius: 8, background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  actionBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};

// ── History items ──────────────────────────────────────────────────────────────
function CaptionHistoryItem({ item, onRestore }) {
  const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <button onClick={() => onRestore(item)} style={histStyles.item}>
      <div style={histStyles.topic}>{item.topic.length > 40 ? item.topic.slice(0, 40) + '…' : item.topic}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={histStyles.date}>{date}</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {(item.platforms || []).map(p => (
            <span key={p} style={{ fontSize: 13 }}>{PLATFORMS[p]?.emoji || '📄'}</span>
          ))}
        </div>
      </div>
    </button>
  );
}

function HashHistoryItem({ item, onRestore }) {
  const date = new Date(item.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const pfCfg = HASHTAG_PLATFORMS[item.platform] || {};
  return (
    <button onClick={() => onRestore(item)} style={histStyles.item}>
      <div style={histStyles.topic}>{item.niche.length > 30 ? item.niche.slice(0, 30) + '…' : item.niche}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={histStyles.date}>{date}</span>
        <span style={{ fontSize: 13 }}>{pfCfg.emoji || '📄'}</span>
      </div>
    </button>
  );
}

const histStyles = {
  item: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: 'none', borderBottom: '1px solid #f1f5f9', background: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'background .15s' },
  topic: { fontSize: 13, fontWeight: 600, color: '#1e293b', flex: 1, paddingRight: 8 },
  date: { fontSize: 11, color: '#94a3b8' },
};

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CaptionWriterPage({ defaultTab = 'caption' }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'superadmin' || user?.role === 'staff';
  const { clients } = useClients();

  const defaultClientId = isAdmin ? null : (user?.client_id || null);
  const [mode, setMode] = useState(defaultTab); // 'caption' | 'hashtag'

  // ── Shared state ──
  const [clientId, setClientId] = useState(defaultClientId);

  // ── Caption state ──
  const [topic, setTopic]               = useState('');
  const [tone, setTone]                 = useState('professional');
  const [postType, setPostType]         = useState('promotion');
  const [selectedPlatforms, setPlatforms] = useState(['facebook', 'instagram', 'linkedin']);
  const [keywords, setKeywords]         = useState('');
  const [cta, setCta]                   = useState('');
  const [capLoading, setCapLoading]     = useState(false);
  const [captions, setCaptions]         = useState(null);
  const [capError, setCapError]         = useState('');
  const [activePlatform, setActivePlatform] = useState(null);
  const [capHistory, setCapHistory]     = useState([]);
  const [capHistOpen, setCapHistOpen]   = useState(false);
  const [capHistLoading, setCapHistLoading] = useState(false);

  // ── Hashtag state ──
  const [hNiche, setHNiche]             = useState('');
  const [hLocation, setHLocation]       = useState('');
  const [hPlatform, setHPlatform]       = useState('instagram');
  const [hTopic, setHTopic]             = useState('');
  const [hPostType, setHPostType]       = useState('general');
  const [hashLoading, setHashLoading]   = useState(false);
  const [hashResult, setHashResult]     = useState(null);
  const [hashResultId, setHashResultId] = useState(null);
  const [hashError, setHashError]       = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [hashHistory, setHashHistory]   = useState([]);
  const [hashHistOpen, setHashHistOpen] = useState(false);
  const [hashHistLoading, setHashHistLoading] = useState(false);
  const [saveModal, setSaveModal]       = useState(false);
  const [saveName, setSaveName]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState('');

  const { copied: globalCopied, copy: globalCopy } = useCopyText();
  const { copied: recCopied, copy: recCopy } = useCopyText();

  // ── Caption history ────────────────────────────────────────────────────────
  const loadCapHistory = useCallback(async (cid) => {
    if (!cid) return;
    setCapHistLoading(true);
    try {
      const res = await captionAPI.getHistory(cid);
      setCapHistory(res.data || []);
    } catch { /* non-fatal */ } finally {
      setCapHistLoading(false);
    }
  }, []);

  // ── Hashtag history ────────────────────────────────────────────────────────
  const loadHashHistory = useCallback(async (cid) => {
    if (!cid) return;
    setHashHistLoading(true);
    try {
      const res = await hashtagAPI.getHistory({ client_id: cid });
      setHashHistory(res.data || []);
    } catch { /* non-fatal */ } finally {
      setHashHistLoading(false);
    }
  }, []);

  useEffect(() => {
    if (clientId) {
      loadCapHistory(clientId);
      loadHashHistory(clientId);
    }
  }, [clientId, loadCapHistory, loadHashHistory]);

  // ── Caption logic ──────────────────────────────────────────────────────────
  const togglePlatform = (p) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleGenerateCaption = async () => {
    if (!topic.trim()) { setCapError('Please enter a topic.'); return; }
    if (selectedPlatforms.length === 0) { setCapError('Select at least one platform.'); return; }
    if (isAdmin && !clientId) { setCapError('Please select a user/client first.'); return; }

    setCapLoading(true);
    setCapError('');
    setCaptions(null);

    try {
      const res = await captionAPI.generate({
        client_id: clientId, topic, tone,
        post_type: postType, platforms: selectedPlatforms,
        keywords, call_to_action: cta,
      });
      setCaptions(res.data.captions);
      setActivePlatform(selectedPlatforms[0]);
      loadCapHistory(clientId);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate captions. Please try again.';
      setCapError(msg);
    } finally {
      setCapLoading(false);
    }
  };

  const handleRestoreCaption = (item) => {
    setTopic(item.topic);
    setTone(item.tone);
    setPostType(item.post_type);
    setPlatforms(item.platforms || []);
    setKeywords(item.keywords || '');
    setCta(item.call_to_action || '');
    setCaptions(item.generated_captions);
    setActivePlatform((item.platforms || [])[0] || null);
    if (item.client) setClientId(item.client);
    setCapHistOpen(false);
  };

  const handleAddToCalendar = ({ platform, text }) => {
    const encoded = encodeURIComponent(text);
    window.open(`/dashboard/calendar?draft=${encoded}&platform=${platform}`, '_blank');
  };

  const activePlatforms = selectedPlatforms.filter(p => captions && captions[p]);
  const allCaptionsText = activePlatforms.map(p => {
    const cfg = PLATFORMS[p] || {};
    const tags = captions?.hashtags?.[p]?.join(' ') || '';
    return `--- ${cfg.label || p} ---\n${captions[p]}${tags ? '\n\n' + tags : ''}`;
  }).join('\n\n');

  // ── Hashtag logic ──────────────────────────────────────────────────────────
  const handleGenerateHashtags = async () => {
    if (!hNiche.trim()) { setHashError('Please enter your niche.'); return; }
    if (!hTopic.trim()) { setHashError('Please enter a post topic.'); return; }
    if (isAdmin && !clientId) { setHashError('Please select a user/client first.'); return; }

    setHashLoading(true);
    setHashError('');
    setHashResult(null);
    setHashResultId(null);
    setSelectedTags([]);

    try {
      const res = await hashtagAPI.generate({
        client_id: clientId,
        niche: hNiche,
        location: hLocation,
        platform: hPlatform,
        post_topic: hTopic,
        post_type: hPostType,
      });
      setHashResult(res.data.hashtags);
      setHashResultId(res.data.id);
      loadHashHistory(clientId);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate hashtags. Please try again.';
      setHashError(msg);
    } finally {
      setHashLoading(false);
    }
  };

  const handleRestoreHash = (item) => {
    setHNiche(item.niche);
    setHLocation(item.location || '');
    setHPlatform(item.platform);
    setHashResult(item.hashtags);
    setHashResultId(item.id);
    setSelectedTags([]);
    setHashHistOpen(false);
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSaveSet = async () => {
    if (!saveName.trim()) { setSaveError('Please enter a name for this set.'); return; }
    if (!hashResultId) { setSaveError('No hashtag set to save.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      await hashtagAPI.saveSet(hashResultId, { set_name: saveName.trim(), tags: selectedTags });
      setSaveModal(false);
      setSaveName('');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save set.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <style>{`
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin { to { transform:rotate(360deg) } }
      `}</style>

      {/* Page header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            {mode === 'caption' ? 'AI Caption Writer' : 'AI Hashtag Research'}
          </h1>
          <p style={styles.sub}>
            {mode === 'caption'
              ? 'Generate perfect captions for every platform'
              : 'Discover the best hashtags for maximum reach'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc' }}>
            <button
              onClick={() => setMode('caption')}
              style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
                background: mode === 'caption' ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : 'transparent',
                color: mode === 'caption' ? '#fff' : '#64748b',
                transition: 'all .15s',
              }}
            >
              <Sparkles size={14} />
              Caption Writer
            </button>
            <button
              onClick={() => setMode('hashtag')}
              style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
                background: mode === 'hashtag' ? 'linear-gradient(135deg,#7c3aed,#db2777)' : 'transparent',
                color: mode === 'hashtag' ? '#fff' : '#64748b',
                transition: 'all .15s',
              }}
            >
              <Hash size={14} />
              Hashtag Research
            </button>
          </div>
          {isAdmin && (
            <select
              value={clientId || ''}
              onChange={e => setClientId(e.target.value ? parseInt(e.target.value) : null)}
              style={styles.clientSelect}
            >
              <option value="">— Select a user —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
          )}
        </div>
      </div>

      <div style={styles.layout}>
        {/* ── LEFT: Input form ── */}
        <div style={styles.leftPanel}>
          <div style={styles.formCard}>

            {mode === 'caption' ? (
              <>
                {/* Caption form */}
                <div style={styles.fieldGroup}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <label style={styles.label}>What is your post about?</label>
                    <span style={{ fontSize: 11, color: topic.length > 450 ? '#f59e0b' : '#94a3b8' }}>{topic.length}/500</span>
                  </div>
                  <textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value.slice(0, 500))}
                    placeholder="Summer sale, 30% off all shoes..."
                    rows={3}
                    style={styles.textarea}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Tone</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {TONES.map(t => (
                      <button key={t.value} type="button" onClick={() => setTone(t.value)}
                        style={{ ...styles.toneBtn, ...(tone === t.value ? styles.toneBtnActive : {}) }}>
                        <span>{t.emoji}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Post Type</label>
                  <select value={postType} onChange={e => setPostType(e.target.value)} style={styles.select}>
                    {POST_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                  </select>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Platforms</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {Object.entries(PLATFORMS).map(([key, cfg]) => {
                      const checked = selectedPlatforms.includes(key);
                      return (
                        <button key={key} type="button" onClick={() => togglePlatform(key)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${checked ? cfg.color + '60' : '#e2e8f0'}`, background: checked ? cfg.color + '08' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                          {checked ? <CheckSquare size={16} color={cfg.color} /> : <Square size={16} color="#cbd5e1" />}
                          <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: checked ? cfg.color : '#64748b' }}>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Keywords to include <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                  <input type="text" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="summer, sale, shoes, discount" style={styles.input} />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Call to action <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                  <input type="text" value={cta} onChange={e => setCta(e.target.value)} placeholder="Shop now, Book a table, Call us..." style={styles.input} />
                </div>

                {capError && (
                  <div style={styles.errorBox}>{capError}</div>
                )}

                <button onClick={handleGenerateCaption} disabled={capLoading}
                  style={{ ...styles.generateBtn, opacity: capLoading ? 0.85 : 1, cursor: capLoading ? 'not-allowed' : 'pointer' }}>
                  {capLoading ? (
                    <><Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} />Generating… (5-10 seconds)</>
                  ) : (
                    <><Sparkles size={18} />✨ Generate Captions</>
                  )}
                </button>

                {capHistory.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={styles.recentLabel}>Recent</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {capHistory.slice(0, 5).map(h => (
                        <button key={h.id} onClick={() => handleRestoreCaption(h)}
                          style={styles.recentChip} title={h.topic}>
                          {h.topic.slice(0, 20)}{h.topic.length > 20 ? '…' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Hashtag form */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Your niche / industry</label>
                  <input type="text" value={hNiche} onChange={e => setHNiche(e.target.value)}
                    placeholder="Fitness, Restaurant, Fashion, Real Estate…"
                    style={{ ...styles.input, marginTop: 6 }} />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Location <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                  <input type="text" value={hLocation} onChange={e => setHLocation(e.target.value)}
                    placeholder="New York, London, Mumbai…"
                    style={{ ...styles.input, marginTop: 6 }} />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Platform</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {Object.entries(HASHTAG_PLATFORMS).map(([key, cfg]) => {
                      const checked = hPlatform === key;
                      return (
                        <button key={key} type="button" onClick={() => setHPlatform(key)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${checked ? cfg.color + '60' : '#e2e8f0'}`, background: checked ? cfg.color + '08' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${checked ? cfg.color : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {checked && <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />}
                          </div>
                          <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: checked ? cfg.color : '#64748b' }}>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Post topic</label>
                  <textarea value={hTopic} onChange={e => setHTopic(e.target.value)}
                    placeholder="Announcing our new protein shake product…"
                    rows={3} style={{ ...styles.textarea, marginTop: 6 }} />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Post type</label>
                  <select value={hPostType} onChange={e => setHPostType(e.target.value)} style={styles.select}>
                    {HASHTAG_POST_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                  </select>
                </div>

                {hashError && (
                  <div style={styles.errorBox}>{hashError}</div>
                )}

                <button onClick={handleGenerateHashtags} disabled={hashLoading}
                  style={{ ...styles.generateBtn, background: 'linear-gradient(135deg, #7c3aed, #db2777)', opacity: hashLoading ? 0.85 : 1, cursor: hashLoading ? 'not-allowed' : 'pointer' }}>
                  {hashLoading ? (
                    <><Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} />Researching… (5-10 seconds)</>
                  ) : (
                    <><Hash size={18} /># Research Hashtags</>
                  )}
                </button>

                {hashHistory.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={styles.recentLabel}>Recent searches</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {hashHistory.slice(0, 5).map(h => (
                        <button key={h.id} onClick={() => handleRestoreHash(h)}
                          style={styles.recentChip} title={h.niche}>
                          {HASHTAG_PLATFORMS[h.platform]?.emoji} {h.niche.slice(0, 16)}{h.niche.length > 16 ? '…' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Output ── */}
        <div style={styles.rightPanel}>

          {mode === 'caption' ? (
            <>
              {!capLoading && !captions && (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}><Sparkles size={40} color="#c4b5fd" /></div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Your captions will appear here</h3>
                  <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Fill in the form and click Generate</p>
                </div>
              )}

              {capLoading && (
                <div>
                  <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' }}>
                    <Loader2 size={14} style={{ animation: 'spin .8s linear infinite', verticalAlign: 'middle', marginRight: 6 }} />
                    Claude is writing your captions…
                  </p>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, marginBottom: 16 }}>
                      <Skeleton height={20} width={120} mb={16} />
                      <Skeleton height={14} mb={8} />
                      <Skeleton height={14} mb={8} />
                      <Skeleton height={14} width="75%" mb={16} />
                      <Skeleton height={10} width={200} />
                    </div>
                  ))}
                </div>
              )}

              {captions && !capLoading && (
                <>
                  {activePlatforms.length > 1 && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                      <button onClick={() => setActivePlatform(null)}
                        style={{ ...styles.platTab, ...(activePlatform === null ? styles.platTabActive : {}) }}>All</button>
                      {activePlatforms.map(p => {
                        const cfg = PLATFORMS[p] || {};
                        return (
                          <button key={p} onClick={() => setActivePlatform(p)}
                            style={{ ...styles.platTab, ...(activePlatform === p ? { ...styles.platTabActive, borderColor: cfg.color, color: cfg.color, background: cfg.color + '10' } : {}) }}>
                            {cfg.emoji} {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(activePlatform ? [activePlatform] : activePlatforms).map(p => (
                    <CaptionCard key={p} platform={p} caption={captions[p]}
                      hashtags={captions.hashtags?.[p]} bestTime={captions.best_posting_time?.[p]}
                      onAddToCalendar={handleAddToCalendar} />
                  ))}

                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => globalCopy(allCaptionsText, 'all')} style={styles.bottomBtn}>
                      <Copy size={14} />
                      {globalCopied === 'all' ? '✓ Copied All!' : 'Copy All Captions'}
                    </button>
                    <button onClick={handleGenerateCaption} disabled={capLoading} style={{ ...styles.bottomBtn, background: '#f8fafc' }}>
                      <RefreshCw size={14} />Regenerate
                    </button>
                  </div>

                  <div style={{ marginTop: 24, border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                    <button onClick={() => setCapHistOpen(o => !o)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: 'none', background: '#f8fafc', cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>History ({capHistory.length})</span>
                      {capHistOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                    </button>
                    {capHistOpen && (
                      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                        {capHistLoading
                          ? <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
                          : capHistory.length === 0
                            ? <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>No history yet.</div>
                            : capHistory.map(h => <CaptionHistoryItem key={h.id} item={h} onRestore={handleRestoreCaption} />)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {!hashLoading && !hashResult && (
                <div style={styles.emptyState}>
                  <div style={{ ...styles.emptyIcon, background: '#f3e8ff' }}><Hash size={40} color="#7c3aed" /></div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>Hashtag research will appear here</h3>
                  <p style={{ fontSize: 14, color: '#94a3b8', margin: 0 }}>Click each tag to select it, then copy or save your set</p>
                </div>
              )}

              {hashLoading && (
                <div>
                  <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' }}>
                    <Loader2 size={14} style={{ animation: 'spin .8s linear infinite', verticalAlign: 'middle', marginRight: 6 }} />
                    Claude is researching hashtags…
                  </p>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 12 }}>
                      <Skeleton height={18} width={100} mb={12} />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[80, 110, 90, 120, 85].map((w, j) => <Skeleton key={j} height={28} width={w} mb={0} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hashResult && !hashLoading && (
                <>
                  {/* Strategy banner */}
                  {hashResult.strategy && (
                    <div style={{ background: 'linear-gradient(135deg,#7c3aed15,#db277715)', border: '1px solid #e9d5ff', borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Sparkles size={16} color="#7c3aed" style={{ flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 14, color: '#4c1d95', fontWeight: 500, margin: 0, lineHeight: 1.6 }}>{hashResult.strategy}</p>
                    </div>
                  )}

                  {/* Tier cards */}
                  {TIER_ORDER.map(tier => {
                    const data = hashResult.groups?.[tier];
                    if (!data) return null;
                    return (
                      <TierCard key={tier} tier={tier} data={data}
                        selectedTags={selectedTags} onToggleTag={toggleTag} />
                    );
                  })}

                  {/* Recommended set */}
                  <RecommendedSetCard rec={hashResult.recommended_set} onCopy={recCopy} copied={recCopied} />

                  {/* Platform tips */}
                  {hashResult.platform_tips && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px', marginBottom: 12, background: '#f8fafc' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{HASHTAG_PLATFORMS[hPlatform]?.emoji}</span>
                        {HASHTAG_PLATFORMS[hPlatform]?.label} Tips
                      </div>
                      <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.7 }}>{hashResult.platform_tips}</p>
                    </div>
                  )}

                  {/* Avoid list */}
                  {hashResult.avoid && hashResult.avoid.length > 0 && (
                    <div style={{ border: '1px solid #fecaca', borderRadius: 14, padding: '14px 16px', marginBottom: 16, background: '#fef2f2' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Tags to Avoid</div>
                      <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {hashResult.avoid.map((item, i) => (
                          <li key={i} style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Regenerate + history */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    <button onClick={handleGenerateHashtags} disabled={hashLoading} style={{ ...styles.bottomBtn, background: '#f8fafc' }}>
                      <RefreshCw size={14} />Regenerate
                    </button>
                  </div>

                  <div style={{ marginTop: 20, border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
                    <button onClick={() => setHashHistOpen(o => !o)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: 'none', background: '#f8fafc', cursor: 'pointer' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>History ({hashHistory.length})</span>
                      {hashHistOpen ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                    </button>
                    {hashHistOpen && (
                      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {hashHistLoading
                          ? <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
                          : hashHistory.length === 0
                            ? <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>No history yet.</div>
                            : hashHistory.map(h => <HashHistoryItem key={h.id} item={h} onRestore={handleRestoreHash} />)}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Selected tags sticky bar (hashtag mode) ── */}
      {mode === 'hashtag' && selectedTags.length > 0 && (
        <div style={styles.stickyBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>
              {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {selectedTags.join(' ').length} chars
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flex: 1 }}>
              {selectedTags.map(tag => (
                <span key={tag} style={{ padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {tag}
                  <button onClick={() => toggleTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#93c5fd', lineHeight: 1, fontSize: 14 }}>×</button>
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => globalCopy(selectedTags.join(' '), 'sel')} style={styles.barBtn}>
              <Copy size={13} />
              {globalCopied === 'sel' ? '✓ Copied!' : 'Copy'}
            </button>
            {hashResultId && (
              <button onClick={() => { setSaveModal(true); setSaveError(''); setSaveName(''); }} style={{ ...styles.barBtn, background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', border: 'none' }}>
                <Save size={13} />Save Set
              </button>
            )}
            <button onClick={() => setSelectedTags([])} style={{ ...styles.barBtn, color: '#94a3b8' }}>
              <X size={13} />Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Save Set modal ── */}
      {saveModal && (
        <div style={styles.modalOverlay} onClick={() => setSaveModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>Save Hashtag Set</h3>
              <button onClick={() => setSaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px' }}>Saving {selectedTags.length} tags</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16, maxHeight: 100, overflowY: 'auto' }}>
              {selectedTags.map(tag => (
                <span key={tag} style={{ padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
            <label style={styles.label}>Set name</label>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="e.g. Fitness promo tags"
              style={{ ...styles.input, marginTop: 6, marginBottom: 12 }}
              onKeyDown={e => e.key === 'Enter' && handleSaveSet()}
              autoFocus
            />
            {saveError && <div style={{ ...styles.errorBox, marginBottom: 12 }}>{saveError}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSaveModal(false)} style={styles.bottomBtn}>Cancel</button>
              <button onClick={handleSaveSet} disabled={saving}
                style={{ ...styles.generateBtn, width: 'auto', padding: '0 20px', height: 40, fontSize: 13, background: 'linear-gradient(135deg,#7c3aed,#db2777)', opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? <Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> : <><Save size={14} />Save Set</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
  page: { padding: '32px 36px', maxWidth: 1280, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 },
  title: { fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  sub: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 0 },
  clientSelect: { padding: '9px 14px', border: '1.5px solid #dbe5f3', borderRadius: 10, fontSize: 13, color: '#1e293b', background: '#fff', outline: 'none', minWidth: 200 },
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  leftPanel: { width: '40%', flexShrink: 0 },
  rightPanel: { flex: 1, minWidth: 0 },
  formCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 24 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: 700, color: '#374151', display: 'block' },
  textarea: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#1e293b' },
  select: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', marginTop: 6 },
  input: { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', boxSizing: 'border-box' },
  toneBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  toneBtnActive: { background: '#2563eb', color: '#fff', borderColor: '#2563eb' },
  generateBtn: { width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700 },
  errorBox: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, marginBottom: 16 },
  recentLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  recentChip: { padding: '4px 10px', borderRadius: 99, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18 },
  emptyIcon: { width: 80, height: 80, borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  platTab: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  platTabActive: { background: '#eff6ff', borderColor: '#bfdbfe', color: '#2563eb' },
  bottomBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  stickyBar: { position: 'fixed', bottom: 0, left: 240, right: 0, background: '#fff', borderTop: '1.5px solid #e2e8f0', padding: '12px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, zIndex: 50, boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' },
  barBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: 18, padding: 24, width: 440, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
};
