import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { postIdeasAPI } from '../services/api';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const BUSINESS_TYPES = [
  { value: 'restaurant',  label: 'Restaurant' },
  { value: 'retail',      label: 'Retail' },
  { value: 'healthcare',  label: 'Healthcare' },
  { value: 'fitness',     label: 'Fitness' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'education',   label: 'Education' },
  { value: 'tech',        label: 'Tech' },
  { value: 'beauty',      label: 'Beauty' },
  { value: 'legal',       label: 'Legal' },
  { value: 'finance',     label: 'Finance' },
  { value: 'other',       label: 'Other' },
];

const PLATFORMS = [
  { value: 'instagram',          label: 'Instagram',  icon: '📸' },
  { value: 'facebook',           label: 'Facebook',   icon: '👍' },
  { value: 'linkedin',           label: 'LinkedIn',   icon: '💼' },
  { value: 'youtube',            label: 'YouTube',    icon: '▶️' },
  { value: 'google_my_business', label: 'GMB',        icon: '📍' },
];

const POSTS_PER_WEEK_OPTIONS = [
  { value: 3,  label: '3 / week' },
  { value: 5,  label: '5 / week' },
  { value: 7,  label: '7 / week' },
  { value: 14, label: 'Daily ×2' },
];

const PLATFORM_COLORS = {
  instagram:          '#e1306c',
  facebook:           '#1877f2',
  linkedin:           '#0077b5',
  youtube:            '#ff0000',
  google_my_business: '#34a853',
};

const LOADING_STEPS = [
  'Analysing your business…',
  'Researching month opportunities…',
  'Crafting post ideas…',
  'Building your calendar…',
];

// Content-type classification for the mix chart
function classifyPostType(pt, topic) {
  const t = (topic + ' ' + pt).toLowerCase();
  if (/behind|team|office|day in|meet/.test(t)) return 'Behind the Scenes';
  if (/tip|advice|how|guide|learn|educate|teach/.test(t)) return 'Educational';
  if (/poll|question|quiz|engage|vote|which|would you/.test(t)) return 'Engagement';
  return 'Promotional';
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PostIdeasPage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === 'superadmin' || user?.role === 'staff';

  const now = new Date();
  const [form, setForm] = useState({
    client_id:       user?.client_id || '',
    month:           now.getMonth() + 1,
    year:            now.getFullYear(),
    business_type:   '',
    location:        '',
    target_audience: '',
    upcoming_events: '',
    platforms:       ['instagram', 'facebook'],
    posts_per_week:  5,
  });

  const [step, setStep]         = useState('form');   // 'form' | 'loading' | 'results'
  const [loadStep, setLoadStep] = useState(0);
  const [error, setError]       = useState('');
  const [ideaSet, setIdeaSet]   = useState(null);     // current result
  const [history, setHistory]   = useState([]);
  const [activeWeek, setActiveWeek]   = useState(1);
  const [editingIdea, setEditingIdea] = useState(null); // { id, field, value }
  const [saving, setSaving]           = useState(false);
  const [calMsg, setCalMsg]           = useState('');
  const loadTimer = useRef(null);

  // ── Load history ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    const params = {};
    if (!isAdmin && user?.client_id) params.client_id = user.client_id;
    else if (form.client_id)          params.client_id = form.client_id;
    if (!params.client_id) return;
    try {
      const res = await postIdeasAPI.getHistory(params);
      setHistory(res.data);
    } catch {
      // silently ignore
    }
  }, [isAdmin, user, form.client_id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Loading animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'loading') {
      clearInterval(loadTimer.current);
      return;
    }
    setLoadStep(0);
    let i = 0;
    loadTimer.current = setInterval(() => {
      i += 1;
      if (i < LOADING_STEPS.length) setLoadStep(i);
      else clearInterval(loadTimer.current);
    }, 4000);
    return () => clearInterval(loadTimer.current);
  }, [step]);

  // ── Generate ────────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError('');
    if (!form.business_type)         return setError('Please select a business type.');
    if (form.platforms.length === 0) return setError('Select at least one platform.');

    const payload = {
      ...form,
      client_id: isAdmin ? form.client_id : user?.client_id,
    };
    if (!payload.client_id) return setError('Client ID is required.');

    setStep('loading');
    try {
      const res = await postIdeasAPI.generate(payload);
      setIdeaSet(res.data);
      setActiveWeek(1);
      setStep('results');
      loadHistory();
    } catch (e) {
      const msg = e.response?.data?.error
        || Object.values(e.response?.data?.errors || {}).flat().join(' ')
        || 'Generation failed. Please try again.';
      setError(msg);
      setStep('form');
    }
  };

  // ── Load from history ────────────────────────────────────────────────────────
  const loadFromHistory = (set) => {
    setIdeaSet(set);
    setActiveWeek(1);
    setCalMsg('');
    setStep('results');
  };

  // ── Toggle platform ──────────────────────────────────────────────────────────
  const togglePlatform = (p) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter(x => x !== p)
        : [...f.platforms, p],
    }));
  };

  // ── Approve / unapprove ──────────────────────────────────────────────────────
  const toggleApprove = async (idea) => {
    if (!ideaSet) return;
    try {
      const res = await postIdeasAPI.updateIdea(ideaSet.id, idea.id, {
        is_approved: !idea.is_approved,
      });
      setIdeaSet(prev => ({
        ...prev,
        ideas: prev.ideas.map(i => i.id === idea.id ? { ...i, ...res.data } : i),
      }));
    } catch { /* ignore */ }
  };

  const handleApproveAll = async () => {
    if (!ideaSet) return;
    try {
      await postIdeasAPI.approveAll(ideaSet.id);
      setIdeaSet(prev => ({
        ...prev,
        ideas: prev.ideas.map(i => ({ ...i, is_approved: true })),
      }));
    } catch { /* ignore */ }
  };

  // ── Inline edit ──────────────────────────────────────────────────────────────
  const startEdit = (idea, field) => {
    setEditingIdea({ id: idea.id, field, value: idea[field] });
  };

  const commitEdit = async () => {
    if (!editingIdea || !ideaSet) return;
    setSaving(true);
    try {
      const res = await postIdeasAPI.updateIdea(ideaSet.id, editingIdea.id, {
        [editingIdea.field]: editingIdea.value,
      });
      setIdeaSet(prev => ({
        ...prev,
        ideas: prev.ideas.map(i => i.id === editingIdea.id ? { ...i, ...res.data } : i),
      }));
    } catch { /* ignore */ }
    setSaving(false);
    setEditingIdea(null);
  };

  // ── Add to calendar ──────────────────────────────────────────────────────────
  const handleAddToCalendar = async (ideaIds = null) => {
    if (!ideaSet) return;
    setCalMsg('');
    setSaving(true);
    try {
      const body = ideaIds ? { idea_ids: ideaIds } : {};
      const res  = await postIdeasAPI.addToCalendar(ideaSet.id, body);
      setCalMsg(res.data.message);
      // Refresh idea statuses
      const history = await postIdeasAPI.getHistory({
        client_id: ideaSet.ideas[0] ? undefined : null,
        month: ideaSet.month,
        year:  ideaSet.year,
      });
      const updated = (history.data || []).find(s => s.id === ideaSet.id);
      if (updated) setIdeaSet(updated);
    } catch (e) {
      setCalMsg(e.response?.data?.error || 'Failed to add to calendar.');
    }
    setSaving(false);
  };

  const handleAddAllToCalendar = async () => {
    if (!ideaSet) return;
    setCalMsg('');
    setSaving(true);
    try {
      const res = await postIdeasAPI.addToCalendar(ideaSet.id, { approve_all: true });
      setCalMsg(res.data.message);
      setIdeaSet(prev => ({
        ...prev,
        ideas: prev.ideas.map(i => ({ ...i, is_approved: true, is_added_to_calendar: true })),
      }));
    } catch (e) {
      setCalMsg(e.response?.data?.error || 'Failed to add to calendar.');
    }
    setSaving(false);
  };

  // ── Derived stats ────────────────────────────────────────────────────────────
  const weekIdeas = ideaSet
    ? ideaSet.ideas.filter(i => i.week_number === activeWeek)
    : [];

  const approvedCount     = ideaSet ? ideaSet.ideas.filter(i => i.is_approved).length : 0;
  const addedCount        = ideaSet ? ideaSet.ideas.filter(i => i.is_added_to_calendar).length : 0;
  const totalIdeas        = ideaSet ? ideaSet.ideas.length : 0;

  const contentMix = ideaSet
    ? (() => {
        const counts = {};
        ideaSet.ideas.forEach(i => {
          const cat = classifyPostType(i.post_type, i.topic);
          counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
      })()
    : [];

  const platformMix = ideaSet
    ? (() => {
        const counts = {};
        ideaSet.ideas.forEach(i => {
          counts[i.platform] = (counts[i.platform] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({
          name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value,
          fill: PLATFORM_COLORS[name] || '#00d7ff',
        }));
      })()
    : [];

  const weeks = ideaSet
    ? [...new Set(ideaSet.ideas.map(i => i.week_number))].sort()
    : [];

  const MIX_COLORS = ['#00d7ff', '#22c55e', '#f59e0b', '#ec4899'];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>✨ Post Ideas Generator</h1>
          <p style={styles.subtitle}>AI-powered content calendar for the full month</p>
        </div>
        {step === 'results' && (
          <button onClick={() => { setStep('form'); setError(''); }} style={styles.newBtn}>
            + New Calendar
          </button>
        )}
      </div>

      {step === 'form' && (
        <SetupForm
          form={form}
          setForm={setForm}
          isAdmin={isAdmin}
          error={error}
          onGenerate={handleGenerate}
          history={history}
          onLoadHistory={loadFromHistory}
          togglePlatform={togglePlatform}
        />
      )}

      {step === 'loading' && (
        <LoadingScreen steps={LOADING_STEPS} currentStep={loadStep} />
      )}

      {step === 'results' && ideaSet && (
        <ResultsView
          ideaSet={ideaSet}
          weeks={weeks}
          activeWeek={activeWeek}
          setActiveWeek={setActiveWeek}
          weekIdeas={weekIdeas}
          approvedCount={approvedCount}
          addedCount={addedCount}
          totalIdeas={totalIdeas}
          contentMix={contentMix}
          platformMix={platformMix}
          mixColors={MIX_COLORS}
          editingIdea={editingIdea}
          setEditingIdea={setEditingIdea}
          saving={saving}
          calMsg={calMsg}
          onApproveAll={handleApproveAll}
          onAddAllToCalendar={handleAddAllToCalendar}
          onAddToCalendar={handleAddToCalendar}
          onToggleApprove={toggleApprove}
          onStartEdit={startEdit}
          onCommitEdit={commitEdit}
          onRegenerate={() => setStep('form')}
        />
      )}
    </div>
  );
}

// ── Setup Form ────────────────────────────────────────────────────────────────

function SetupForm({ form, setForm, isAdmin, error, onGenerate, history, onLoadHistory, togglePlatform }) {
  const now = new Date();

  const yearOptions = [now.getFullYear(), now.getFullYear() + 1];

  return (
    <div style={styles.formPage}>
      <div style={styles.formCard}>
        <h2 style={styles.formTitle}>Generate Your Content Calendar</h2>
        <p style={styles.formSub}>Fill in your business details to get {form.posts_per_week * 4}+ unique post ideas</p>

        <div style={styles.formGrid}>
          {/* Business Type */}
          <div style={styles.formField}>
            <label style={styles.label}>Business Type *</label>
            <select
              value={form.business_type}
              onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}
              style={styles.select}
            >
              <option value="">Select type…</option>
              {BUSINESS_TYPES.map(bt => (
                <option key={bt.value} value={bt.value}>{bt.label}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div style={styles.formField}>
            <label style={styles.label}>Location</label>
            <input
              type="text"
              placeholder="e.g. Mumbai, India"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              style={styles.input}
            />
          </div>

          {/* Target Audience */}
          <div style={{ ...styles.formField, gridColumn: '1 / -1' }}>
            <label style={styles.label}>Target Audience</label>
            <input
              type="text"
              placeholder="e.g. Young professionals 25-35 in Mumbai"
              value={form.target_audience}
              onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
              style={styles.input}
            />
          </div>

          {/* Month */}
          <div style={styles.formField}>
            <label style={styles.label}>Month *</label>
            <select
              value={form.month}
              onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
              style={styles.select}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div style={styles.formField}>
            <label style={styles.label}>Year *</label>
            <select
              value={form.year}
              onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
              style={styles.select}
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Platforms */}
          <div style={{ ...styles.formField, gridColumn: '1 / -1' }}>
            <label style={styles.label}>Platforms *</label>
            <div style={styles.platformGrid}>
              {PLATFORMS.map(p => {
                const sel = form.platforms.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlatform(p.value)}
                    style={{
                      ...styles.platformBtn,
                      ...(sel ? styles.platformBtnSel : {}),
                    }}
                  >
                    <span style={styles.platformIcon}>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Posts per week */}
          <div style={{ ...styles.formField, gridColumn: '1 / -1' }}>
            <label style={styles.label}>Posts per Week</label>
            <div style={styles.ppwRow}>
              {POSTS_PER_WEEK_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, posts_per_week: opt.value }))}
                  style={{
                    ...styles.ppwBtn,
                    ...(form.posts_per_week === opt.value ? styles.ppwBtnSel : {}),
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div style={{ ...styles.formField, gridColumn: '1 / -1' }}>
            <label style={styles.label}>Upcoming Events / Promotions</label>
            <textarea
              placeholder="e.g. Diwali on Oct 20, New menu launching Nov 1, Anniversary sale last week of month"
              value={form.upcoming_events}
              onChange={e => setForm(f => ({ ...f, upcoming_events: e.target.value }))}
              style={styles.textarea}
              rows={3}
            />
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <button
          type="button"
          onClick={onGenerate}
          style={styles.generateBtn}
        >
          ✨ Generate My Content Calendar
        </button>
        <p style={styles.generateNote}>
          Generates {form.posts_per_week * 4}–{form.posts_per_week * 5} unique post ideas using AI
        </p>
      </div>

      {/* History sidebar */}
      {history.length > 0 && (
        <div style={styles.historyCard}>
          <h3 style={styles.historyTitle}>Previous Calendars</h3>
          <div style={styles.historyList}>
            {history.map(set => (
              <button
                key={set.id}
                type="button"
                onClick={() => onLoadHistory(set)}
                style={styles.historyItem}
              >
                <div style={styles.historyItemTop}>
                  <span style={styles.historyMonth}>{set.month_name} {set.year}</span>
                  <span style={styles.historyCount}>{set.ideas?.length || 0} ideas</span>
                </div>
                <div style={styles.historyBiz}>
                  {set.business_type.replace('_', ' ')} · {set.platforms.length} platforms
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Loading screen ────────────────────────────────────────────────────────────

function LoadingScreen({ steps, currentStep }) {
  return (
    <div style={styles.loadingWrap}>
      <div style={styles.loadingCard}>
        <div style={styles.loadingSpinner} />
        <h2 style={styles.loadingTitle}>Building your content calendar…</h2>
        <p style={styles.loadingSub}>Claude is crafting personalised post ideas for your business</p>
        <div style={styles.loadingSteps}>
          {steps.map((s, i) => (
            <div key={s} style={{
              ...styles.loadingStep,
              ...(i < currentStep ? styles.loadingStepDone : {}),
              ...(i === currentStep ? styles.loadingStepActive : {}),
            }}>
              <span style={styles.loadingStepIcon}>
                {i < currentStep ? '✓' : i === currentStep ? '⟳' : '○'}
              </span>
              <span>{s}</span>
            </div>
          ))}
        </div>
        <p style={styles.loadingTime}>This usually takes 15–20 seconds</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Results view ──────────────────────────────────────────────────────────────

function ResultsView({
  ideaSet, weeks, activeWeek, setActiveWeek, weekIdeas,
  approvedCount, addedCount, totalIdeas,
  contentMix, platformMix, mixColors,
  editingIdea, saving, calMsg,
  onApproveAll, onAddAllToCalendar, onAddToCalendar,
  onToggleApprove, onStartEdit, onCommitEdit, onRegenerate,
  setEditingIdea,
}) {
  return (
    <div style={styles.resultsLayout}>
      {/* Main column */}
      <div style={styles.resultsMain}>
        {/* Month header */}
        <div style={styles.monthHeader}>
          <div>
            <div style={styles.monthTheme}>{ideaSet.month_theme}</div>
            <div style={styles.strategyNote}>{ideaSet.strategy_notes}</div>
          </div>
          <div style={styles.headerActions}>
            <button onClick={onApproveAll} style={styles.actionBtnOutline}>
              ✓ Approve All
            </button>
            <button onClick={onAddAllToCalendar} disabled={saving} style={styles.actionBtnOutline}>
              📅 Add All to Calendar
            </button>
            <button onClick={onRegenerate} style={styles.actionBtnOutline}>
              🔄 Regenerate
            </button>
          </div>
        </div>

        {calMsg && (
          <div style={styles.calMsg}>{calMsg}</div>
        )}

        {/* Week tabs */}
        <div style={styles.weekTabs}>
          {weeks.map(w => (
            <button
              key={w}
              type="button"
              onClick={() => setActiveWeek(w)}
              style={{
                ...styles.weekTab,
                ...(activeWeek === w ? styles.weekTabActive : {}),
              }}
            >
              Week {w}
            </button>
          ))}
        </div>

        {/* Week theme */}
        {ideaSet.weeks && ideaSet.weeks[activeWeek - 1] && (
          <div style={styles.weekThemeBadge}>
            {ideaSet.weeks[activeWeek - 1].theme}
          </div>
        )}

        {/* Ideas grid */}
        <div style={styles.ideasGrid}>
          {weekIdeas.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              editingIdea={editingIdea}
              saving={saving}
              onToggleApprove={onToggleApprove}
              onAddToCalendar={onAddToCalendar}
              onStartEdit={onStartEdit}
              onCommitEdit={onCommitEdit}
              setEditingIdea={setEditingIdea}
            />
          ))}
          {weekIdeas.length === 0 && (
            <div style={styles.emptyWeek}>No ideas for this week.</div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div style={styles.resultsSidebar}>
        <div style={styles.sideCard}>
          <h3 style={styles.sideTitle}>Progress</h3>
          <div style={styles.statRow}>
            <span style={styles.statLabel}>Approved</span>
            <span style={styles.statValue}>{approvedCount} / {totalIdeas}</span>
          </div>
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: totalIdeas ? `${(approvedCount / totalIdeas) * 100}%` : '0%',
              background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            }} />
          </div>
          <div style={{ ...styles.statRow, marginTop: 12 }}>
            <span style={styles.statLabel}>Added to Calendar</span>
            <span style={styles.statValue}>{addedCount} / {totalIdeas}</span>
          </div>
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: totalIdeas ? `${(addedCount / totalIdeas) * 100}%` : '0%',
              background: 'linear-gradient(90deg, #00d7ff, #00d7ff)',
            }} />
          </div>
          {approvedCount > addedCount && (
            <button
              onClick={() => onAddToCalendar(null)}
              disabled={saving}
              style={styles.addRemainingBtn}
            >
              📅 Add Approved to Calendar
            </button>
          )}
        </div>

        {contentMix.length > 0 && (
          <div style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Content Mix</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={contentMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {contentMix.map((entry, i) => (
                    <Cell key={entry.name} fill={mixColors[i % mixColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={styles.legendList}>
              {contentMix.map((entry, i) => (
                <div key={entry.name} style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, background: mixColors[i % mixColors.length] }} />
                  <span style={styles.legendName}>{entry.name}</span>
                  <span style={styles.legendVal}>{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {platformMix.length > 0 && (
          <div style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Platforms</h3>
            <ResponsiveContainer width="100%" height={platformMix.length * 36 + 20}>
              <BarChart data={platformMix} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {platformMix.map(entry => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Idea card ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea, editingIdea, saving, onToggleApprove, onAddToCalendar, onStartEdit, onCommitEdit, setEditingIdea }) {
  const [captionOpen, setCaptionOpen] = useState(false);
  const isEditingTopic    = editingIdea?.id === idea.id && editingIdea?.field === 'topic';
  const isEditingCaption  = editingIdea?.id === idea.id && editingIdea?.field === 'caption_hint';

  const platformColor = PLATFORM_COLORS[idea.platform] || '#00d7ff';
  const platformLabel = PLATFORMS.find(p => p.value === idea.platform)?.label || idea.platform;
  const platformIcon  = PLATFORMS.find(p => p.value === idea.platform)?.icon || '📱';

  let cardBorder = '1px solid #e2e8f0';
  if (idea.is_added_to_calendar) cardBorder = '2px solid #00d7ff';
  else if (idea.is_approved)     cardBorder = '2px solid #22c55e';

  return (
    <div style={{ ...styles.ideaCard, border: cardBorder }}>
      {/* Top row */}
      <div style={styles.cardTop}>
        <div style={styles.dayBadge}>
          <span style={styles.dayText}>{idea.day_of_week.slice(0, 3)}</span>
          {idea.best_time && (
            <span style={styles.timeText}>{idea.best_time}</span>
          )}
        </div>
        <div style={{ ...styles.platformPill, background: platformColor }}>
          {platformIcon} {platformLabel}
        </div>
        <div style={{ ...styles.typePill, background: '#f0f4f9', color: '#475569' }}>
          {idea.post_type}
        </div>
      </div>

      {/* Topic */}
      <div style={styles.topicWrap}>
        {isEditingTopic ? (
          <div style={styles.inlineEditWrap}>
            <input
              autoFocus
              style={styles.inlineInput}
              value={editingIdea.value}
              onChange={e => setEditingIdea(prev => ({ ...prev, value: e.target.value }))}
              onBlur={onCommitEdit}
              onKeyDown={e => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') setEditingIdea(null); }}
            />
          </div>
        ) : (
          <div
            style={styles.topicText}
            onDoubleClick={() => onStartEdit(idea, 'topic')}
            title="Double-click to edit"
          >
            {idea.topic}
          </div>
        )}
      </div>

      {/* Caption hint */}
      <div>
        <button
          type="button"
          onClick={() => setCaptionOpen(o => !o)}
          style={styles.captionToggle}
        >
          {captionOpen ? '▲' : '▼'} Caption direction
        </button>
        {captionOpen && (
          isEditingCaption ? (
            <div style={styles.inlineEditWrap}>
              <textarea
                autoFocus
                rows={3}
                style={{ ...styles.inlineInput, resize: 'vertical' }}
                value={editingIdea.value}
                onChange={e => setEditingIdea(prev => ({ ...prev, value: e.target.value }))}
                onBlur={onCommitEdit}
              />
            </div>
          ) : (
            <div
              style={styles.captionText}
              onDoubleClick={() => onStartEdit(idea, 'caption_hint')}
              title="Double-click to edit"
            >
              {idea.caption_hint}
            </div>
          )
        )}
      </div>

      {/* Hashtags */}
      {idea.hashtag_hints && idea.hashtag_hints.length > 0 && (
        <div style={styles.hashtagRow}>
          {idea.hashtag_hints.slice(0, 5).map(tag => (
            <span key={tag} style={styles.hashtagPill}>{tag}</span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={styles.cardActions}>
        {idea.is_added_to_calendar ? (
          <span style={styles.addedBadge}>📅 Added to Calendar</span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onToggleApprove(idea)}
              style={{
                ...styles.cardBtn,
                ...(idea.is_approved ? styles.cardBtnApproved : {}),
              }}
            >
              {idea.is_approved ? '✓ Approved' : '✓ Approve'}
            </button>
            {idea.is_approved && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onAddToCalendar([idea.id])}
                style={{ ...styles.cardBtn, ...styles.cardBtnCal }}
              >
                📅 Add
              </button>
            )}
            <button
              type="button"
              onClick={() => onStartEdit(idea, 'topic')}
              style={styles.cardBtnIcon}
              title="Edit topic"
            >
              ✏️
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    padding: '32px 36px',
    maxWidth: 1400,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: '#0f172a',
  },
  subtitle: {
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 15,
  },
  newBtn: {
    padding: '10px 20px',
    background: '#00d7ff',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },

  // Form
  formPage: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
  },
  formCard: {
    flex: 1,
    background: '#fff',
    borderRadius: 20,
    padding: '36px 40px',
    boxShadow: '0 4px 24px rgba(15,23,42,.08)',
    border: '1px solid #e2e8f0',
  },
  formTitle: {
    margin: '0 0 6px',
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
  },
  formSub: {
    margin: '0 0 28px',
    color: '#64748b',
    fontSize: 14,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
    marginBottom: 24,
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
  },
  select: {
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    fontSize: 14,
    outline: 'none',
    background: '#fff',
    cursor: 'pointer',
  },
  textarea: {
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    fontSize: 14,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    background: '#fff',
  },
  platformGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  platformBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all .15s',
  },
  platformBtnSel: {
    border: '1.5px solid #00d7ff',
    background: '#e6fbff',
    color: '#4338ca',
  },
  platformIcon: { fontSize: 16 },
  ppwRow: {
    display: 'flex',
    gap: 10,
  },
  ppwBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  ppwBtnSel: {
    border: '1.5px solid #00d7ff',
    background: '#e6fbff',
    color: '#4338ca',
  },
  errorBox: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 13,
    border: '1px solid #fecaca',
    marginBottom: 20,
  },
  generateBtn: {
    width: '100%',
    padding: '16px',
    background: '#00d7ff',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(99,102,241,.35)',
  },
  generateNote: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    margin: '10px 0 0',
  },

  // History
  historyCard: {
    width: 240,
    background: '#fff',
    borderRadius: 16,
    padding: '20px 16px',
    boxShadow: '0 4px 16px rgba(15,23,42,.07)',
    border: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  historyTitle: {
    margin: '0 0 14px',
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  historyItem: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    background: '#f0f4f9',
    cursor: 'pointer',
    textAlign: 'left',
  },
  historyItemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyMonth: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
  },
  historyCount: {
    fontSize: 11,
    color: '#00d7ff',
    fontWeight: 700,
  },
  historyBiz: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    textTransform: 'capitalize',
  },

  // Loading
  loadingWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  loadingCard: {
    background: '#fff',
    borderRadius: 24,
    padding: '48px 56px',
    textAlign: 'center',
    boxShadow: '0 24px 60px rgba(15,23,42,.12)',
    border: '1px solid #e2e8f0',
    minWidth: 380,
  },
  loadingSpinner: {
    width: 52,
    height: 52,
    border: '4px solid #e2e8f0',
    borderTopColor: '#00d7ff',
    borderRadius: '50%',
    margin: '0 auto 24px',
    animation: 'spin 0.8s linear infinite',
  },
  loadingTitle: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
  },
  loadingSub: {
    margin: '0 0 28px',
    fontSize: 14,
    color: '#64748b',
  },
  loadingSteps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    textAlign: 'left',
    marginBottom: 20,
  },
  loadingStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    color: '#94a3b8',
    padding: '8px 12px',
    borderRadius: 8,
  },
  loadingStepDone: {
    color: '#16a34a',
    background: '#f0fdf4',
  },
  loadingStepActive: {
    color: '#4338ca',
    background: '#e6fbff',
    fontWeight: 600,
  },
  loadingStepIcon: {
    fontSize: 16,
    width: 20,
    flexShrink: 0,
  },
  loadingTime: {
    fontSize: 12,
    color: '#94a3b8',
    margin: 0,
  },

  // Results
  resultsLayout: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
  },
  resultsMain: {
    flex: 1,
    minWidth: 0,
  },
  resultsSidebar: {
    width: 260,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    position: 'sticky',
    top: 24,
  },
  monthHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: '#fff',
    borderRadius: 16,
    padding: '20px 24px',
    marginBottom: 16,
    boxShadow: '0 2px 12px rgba(15,23,42,.06)',
    border: '1px solid #e2e8f0',
  },
  monthTheme: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  strategyNote: {
    fontSize: 13,
    color: '#64748b',
    maxWidth: 480,
  },
  headerActions: {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
  },
  actionBtnOutline: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    background: '#fff',
    color: '#374151',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  calMsg: {
    background: '#e6fbff',
    color: '#00d7ff',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid #e6fbff',
    marginBottom: 16,
  },
  weekTabs: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
  weekTab: {
    padding: '9px 20px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  weekTabActive: {
    border: '1.5px solid #00d7ff',
    background: '#e6fbff',
    color: '#4338ca',
  },
  weekThemeBadge: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: 999,
    background: '#fef9c3',
    color: '#854d0e',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 16,
  },
  ideasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: 16,
  },
  emptyWeek: {
    color: '#94a3b8',
    fontSize: 14,
    padding: 24,
    textAlign: 'center',
  },

  // Idea card
  ideaCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: '0 2px 10px rgba(15,23,42,.05)',
    transition: 'box-shadow .15s',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 44,
    padding: '4px 8px',
    borderRadius: 8,
    background: '#f0f4f9',
    flexShrink: 0,
  },
  dayText: {
    fontSize: 11,
    fontWeight: 800,
    color: '#334155',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 10,
    color: '#64748b',
  },
  platformPill: {
    padding: '3px 9px',
    borderRadius: 999,
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
  },
  typePill: {
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  topicWrap: { minHeight: 40 },
  topicText: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
    lineHeight: 1.4,
    cursor: 'text',
  },
  captionToggle: {
    background: 'none',
    border: 'none',
    color: '#00d7ff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    marginBottom: 4,
  },
  captionText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
    cursor: 'text',
    padding: '8px 10px',
    borderRadius: 8,
    background: '#f0f4f9',
  },
  hashtagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
  },
  hashtagPill: {
    padding: '2px 8px',
    borderRadius: 999,
    background: '#e6fbff',
    color: '#00d7ff',
    fontSize: 11,
    fontWeight: 600,
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  cardBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    background: '#fff',
    color: '#374151',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  cardBtnApproved: {
    border: '1.5px solid #22c55e',
    background: '#f0fdf4',
    color: '#16a34a',
  },
  cardBtnCal: {
    border: '1.5px solid #e6fbff',
    background: '#e6fbff',
    color: '#00d7ff',
  },
  cardBtnIcon: {
    padding: '6px 8px',
    borderRadius: 8,
    border: '1.5px solid #e2e8f0',
    background: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    marginLeft: 'auto',
  },
  addedBadge: {
    fontSize: 12,
    fontWeight: 700,
    color: '#00d7ff',
    background: '#e6fbff',
    padding: '5px 10px',
    borderRadius: 8,
  },
  inlineEditWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
  inlineInput: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1.5px solid #00d7ff',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },

  // Sidebar cards
  sideCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '18px 20px',
    boxShadow: '0 2px 12px rgba(15,23,42,.06)',
    border: '1px solid #e2e8f0',
  },
  sideTitle: {
    margin: '0 0 14px',
    fontSize: 13,
    fontWeight: 800,
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: { fontSize: 12, color: '#64748b', fontWeight: 600 },
  statValue: { fontSize: 13, fontWeight: 800, color: '#0f172a' },
  progressBar: {
    height: 6,
    borderRadius: 999,
    background: '#f0f4f9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    transition: 'width .3s ease',
  },
  addRemainingBtn: {
    width: '100%',
    marginTop: 14,
    padding: '9px 0',
    borderRadius: 10,
    border: 'none',
    background: '#00d7ff',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  legendList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 8,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendName: { flex: 1, color: '#374151', fontWeight: 600 },
  legendVal:  { color: '#64748b', fontWeight: 700 },
};
