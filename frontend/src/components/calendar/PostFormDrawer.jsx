import { useState, useEffect } from 'react';
import { format, isBefore } from 'date-fns';
import { X, AlertCircle } from 'lucide-react';
import { PLATFORMS, PLATFORM_LIST } from '../../services/platforms';
import { useSuggestedTimes } from '../../hooks/useCalendar';
import SocialPlatformIcon from '../ui/SocialPlatformIcon';

const CHAR_LIMITS = {
  facebook:          63206,
  instagram:         2200,
  linkedin:          3000,
  youtube:           5000,
  google_my_business:1500,
};

const POST_TYPES = [
  { value: 'image',    label: 'Image'    },
  { value: 'video',    label: 'Video'    },
  { value: 'reel',     label: 'Reel'     },
  { value: 'story',    label: 'Story'    },
  { value: 'carousel', label: 'Carousel' },
  { value: 'text',     label: 'Text'     },
  { value: 'article',  label: 'Article'  },
  { value: 'short',    label: 'Short'    },
];

const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getMinScheduleValue() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function CharCounter({ text, limit }) {
  const count = (text || '').length;
  const pct   = count / limit;
  const color = pct > 0.95 ? '#EF4444' : pct > 0.80 ? '#F59E0B' : '#10B981';
  return (
    <div style={{ fontSize: 11, color, textAlign: 'right', marginTop: 2 }}>
      {count.toLocaleString()} / {limit.toLocaleString()}
    </div>
  );
}

function SuggestRow({ clientId, platform }) {
  const { suggestions, source } = useSuggestedTimes(clientId, platform);
  if (!suggestions.length) return null;
  return (
    <div style={{
      background: '#EFF6FF', border: '1px solid #BFDBFE',
      borderRadius: 8, padding: '8px 12px', marginTop: 6, fontSize: 12,
    }}>
      <span style={{ color: '#2563EB', fontWeight: 600 }}>💡 Best times for {PLATFORMS[platform]?.label || platform}: </span>
      <span style={{ color: '#1e40af' }}>
        {suggestions.slice(0, 4).map(s => s.note || `${DAY_NAMES[s.day_of_week]} ${s.hour}:${String(s.minute||0).padStart(2,'0')}`).join(', ')}
      </span>
      {source === 'industry' && <span style={{ color: '#64748B' }}> (industry)</span>}
    </div>
  );
}

export default function PostFormDrawer({ date, post, isOpen, onClose, onSave, clientId, readOnly }) {
  const isEdit = !!post;

  const [platform,    setPlatform]    = useState(post?.platform    || 'instagram');
  const [postType,    setPostType]    = useState(post?.post_type   || 'image');
  const [title,       setTitle]       = useState(post?.title       || '');
  const [caption,     setCaption]     = useState(post?.caption     || '');
  const [hashtags,    setHashtags]    = useState(post?.hashtags    || '');
  const [mediaUrl,    setMediaUrl]    = useState(post?.media_url   || '');
  const [postUrl,     setPostUrl]     = useState(post?.post_url    || '');
  const [status,      setStatus]      = useState(post?.status === 'scheduled' ? 'scheduled' : 'draft');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes,       setNotes]       = useState(post?.notes       || '');
  const [saving,      setSaving]      = useState(false);
  const [errors,      setErrors]      = useState({});
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (post) {
      setPlatform(post.platform || 'instagram');
      setPostType(post.post_type || 'image');
      setTitle(post.title || '');
      setCaption(post.caption || '');
      setHashtags(post.hashtags || '');
      setMediaUrl(post.media_url || '');
      setPostUrl(post.post_url || '');
      setStatus(post.status === 'scheduled' ? 'scheduled' : 'draft');
      setNotes(post.notes || '');
      if (post.scheduled_at) {
        // Convert to local datetime-local input format
        const d = new Date(post.scheduled_at);
        const pad = n => String(n).padStart(2, '0');
        setScheduledAt(
          `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        );
      }
    } else {
      // New post — pre-fill date
      setPlatform('instagram');
      setPostType('image');
      setTitle('');
      setCaption('');
      setHashtags('');
      setMediaUrl('');
      setPostUrl('');
      setStatus('draft');
      setNotes('');
      if (date) {
        const d = date instanceof Date ? date : new Date(date);
        const pad = n => String(n).padStart(2, '0');
        setScheduledAt(
          `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T10:00`
        );
      } else {
        setScheduledAt('');
      }
    }
    setError('');
    setErrors({});
    setSaving(false);
  }, [isOpen, post, date]);

  const charLimit = CHAR_LIMITS[platform] || 2200;
  const hashCount = hashtags.trim().split(/\s+/).filter(t => t.startsWith('#')).length;

  const clearFieldError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = (finalStatus) => {
    const nextErrors = {};
    if (!platform) {
      nextErrors.platform = 'Please select a platform.';
    }
    if (!caption.trim() && !title.trim()) {
      nextErrors.caption = 'Caption is required. Add a caption or at least an internal title.';
    }
    if (finalStatus === 'scheduled' && !scheduledAt) {
      nextErrors.scheduledAt = 'Please pick a date and time to schedule this post.';
    }
    if (finalStatus === 'scheduled' && scheduledAt && isBefore(new Date(scheduledAt), new Date())) {
      nextErrors.scheduledAt = 'The scheduled time must be in the future.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  async function handleSave(forcedStatus) {
    setError('');
    const finalStatus = forcedStatus || status;

    // Auto-reveal the datetime picker when "Schedule Post" is clicked
    if (finalStatus === 'scheduled') {
      setStatus('scheduled');
    }

    if (!validateForm(finalStatus)) {
      // Build a specific summary of what's missing
      const missing = [];
      if (!platform) missing.push('Platform');
      if (!caption.trim() && !title.trim()) missing.push('Caption');
      if (finalStatus === 'scheduled' && !scheduledAt) missing.push('Scheduled Date & Time');
      if (finalStatus === 'scheduled' && scheduledAt && isBefore(new Date(scheduledAt), new Date())) {
        missing.push('Scheduled Date & Time (must be in the future)');
      }
      setError(
        missing.length > 0
          ? `Required field${missing.length > 1 ? 's' : ''} missing: ${missing.join(', ')}.`
          : 'Please fix the highlighted fields before saving.'
      );
      return;
    }

    setSaving(true);
    const payload = {
      platform, post_type: postType,
      title, caption, hashtags,
      media_url: mediaUrl, post_url: postUrl,
      status: finalStatus,
      notes,
    };
    if (finalStatus === 'scheduled' && scheduledAt) {
      payload.scheduled_at = new Date(scheduledAt).toISOString();
    }
    if (!isEdit && clientId) {
      payload.client = clientId;
    }

    const result = await onSave(payload, post?.id);
    setSaving(false);
    if (result?.success === false) {
      setError(result.error || 'Save failed.');
    }
  }

  const plat = PLATFORMS[platform] || { color: '#64748B', label: platform };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.25s',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      />

      {/* Drawer */}
      <div style={{
        position:  'fixed', top: 0, right: 0, bottom: 0,
        width:     460,
        background:'#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex:    1001,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition:'transform 0.25s ease-out',
        display:   'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
            {isEdit ? 'Edit Post' : 'Schedule Post'}
          </div>
          {date && !isEdit && (
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {format(date instanceof Date ? date : new Date(date), 'EEEE, MMMM d')}
            </div>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '20px', flex: 1 }}>
          {/* Platform selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Platform <span style={requiredAsteriskStyle}>*</span></label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PLATFORM_LIST.map(key => {
                const p = PLATFORMS[key];
                const active = platform === key;
                return (
                  <button
                    key={key}
                    onClick={() => setPlatform(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 8,
                      background: active ? p.color : '#F1F5F9',
                      color:      active ? '#fff'   : '#475569',
                      border:     errors.platform
                        ? '1px solid #ef4444'
                        : (active ? `1px solid ${p.color}` : '1px solid #E2E8F0'),
                      cursor:     'pointer', fontSize: 12, fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <SocialPlatformIcon platform={key} size={14} />
                      {p.label.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.platform && <div style={fieldErrorStyle}>{errors.platform}</div>}
          </div>

          {/* Post Type */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Post Type</label>
            <select
              value={postType}
              onChange={e => setPostType(e.target.value)}
              style={inputStyle}
            >
              {POST_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Internal Title</label>
            <input
              type="text"
              value={title}
              onChange={e => {
                setTitle(e.target.value);
                clearFieldError('caption');
              }}
              placeholder="Agency reference label"
              style={inputStyle}
            />
          </div>

          {/* Caption */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Caption <span style={requiredAsteriskStyle}>*</span></label>
            <textarea
              value={caption}
              onChange={e => {
                setCaption(e.target.value);
                clearFieldError('caption');
              }}
              placeholder={`Write your ${plat.label} caption…`}
              rows={5}
              style={{ ...inputStyle, ...(errors.caption ? inputErrorStyle : {}), resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            {errors.caption && <div style={fieldErrorStyle}>{errors.caption}</div>}
            <CharCounter text={caption} limit={charLimit} />
          </div>

          {/* Hashtags */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Hashtags
              {hashCount > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 400, color: '#64748B' }}>
                  {hashCount} hashtag{hashCount !== 1 ? 's' : ''}
                </span>
              )}
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="#socialmedia #marketing"
              style={inputStyle}
            />
          </div>

          {/* Media URL */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Media URL (optional)</label>
            <input
              type="url"
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              placeholder="https://…"
              style={inputStyle}
            />
          </div>

          {/* Post URL */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Post URL (optional)</label>
            <input
              type="url"
              value={postUrl}
              onChange={e => setPostUrl(e.target.value)}
              placeholder="https://…"
              style={inputStyle}
            />
          </div>

          {/* Status */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['draft', 'scheduled'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8,
                    background: status === s ? (s === 'scheduled' ? '#2563EB' : '#F1F5F9') : '#F8FAFC',
                    color:      status === s ? (s === 'scheduled' ? '#fff'   : '#374151') : '#94A3B8',
                    border:     status === s ? `1px solid ${s === 'scheduled' ? '#2563EB' : '#CBD5E1'}` : '1px solid #E2E8F0',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* DateTime picker */}
          {status === 'scheduled' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Scheduled Date & Time <span style={requiredAsteriskStyle}>*</span></label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => {
                  setScheduledAt(e.target.value);
                  clearFieldError('scheduledAt');
                }}
                min={getMinScheduleValue()}
                style={{ ...inputStyle, ...(errors.scheduledAt ? inputErrorStyle : {}) }}
              />
              {errors.scheduledAt && <div style={fieldErrorStyle}>{errors.scheduledAt}</div>}
              {clientId && (
                <SuggestRow clientId={clientId} platform={platform} />
              )}
            </div>
          )}

          {/* Agency notes */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Internal Notes (not shown to user)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Waiting on final image from designer"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 8, padding: '12px 14px',
              color: '#B91C1C', fontSize: 13, marginBottom: 12, lineHeight: 1.5,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {!readOnly && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #E2E8F0',
            display: 'flex', gap: 8,
            position: 'sticky', bottom: 0, background: '#fff', zIndex: 1,
          }}>
            <button
              onClick={() => handleSave('draft')}
              disabled={saving}
              style={{
                flex: 1, padding: '10px', borderRadius: 8,
                background: '#F1F5F9', border: '1px solid #E2E8F0',
                color: '#374151', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSave('scheduled')}
              disabled={saving}
              style={{
                flex: 1, padding: '10px', borderRadius: 8,
                background: '#2563EB', color: '#fff',
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Schedule Post'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#374151', marginBottom: 6,
};

const requiredAsteriskStyle = {
  color: '#ef4444', marginLeft: 2, fontWeight: 800,
};

const inputStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: '1px solid #D1D5DB', fontSize: 13,
  boxSizing: 'border-box', background: '#fff',
  outline: 'none', color: '#1e293b',
};

const inputErrorStyle = {
  borderColor: '#ef4444',
  background: '#fef2f2',
};

const fieldErrorStyle = {
  marginTop: 6,
  fontSize: 12,
  color: '#dc2626',
};
