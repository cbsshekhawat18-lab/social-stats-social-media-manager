import { useState, useEffect, useRef } from 'react';
import { Sparkles, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { insightsAPI } from '../../services/api';
import { getDemoInsight, isDemoClient } from '../../services/demoData';

// Inject keyframe animations once
if (typeof document !== 'undefined' && !document.getElementById('ai-insight-styles')) {
  const s = document.createElement('style');
  s.id = 'ai-insight-styles';
  s.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  `;
  document.head.appendChild(s);
}

function useInsight(clientId, month, year) {
  const [insight, setInsight]   = useState(null);
  const [loading, setLoading]   = useState(false);

  const fetch = async () => {
    if (!clientId) return;
    if (isDemoClient(clientId)) {
      setInsight(getDemoInsight(month, year));
      return;
    }
    try {
      setLoading(true);
      const res = await insightsAPI.list({ client: clientId, month, year });
      const data = res.data.results || res.data;
      setInsight(data.length > 0 ? data[0] : null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [clientId, month, year]); // eslint-disable-line

  return { insight, loading, refetch: fetch };
}

// Typewriter animation hook
function useTypewriter(text, speed = 12) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone]           = useState(false);
  const prevText                  = useRef('');

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(false); return; }
    if (text === prevText.current) return;
    prevText.current = text;
    setDone(false);
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(timer); setDone(true); }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayed, done };
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

export default function AIInsightCard({ clientId, month, year, canGenerate = false }) {
  const { insight, loading, refetch } = useInsight(clientId, month, year);
  const [generating, setGenerating]  = useState(false);
  const [copied, setCopied]          = useState(false);
  const [newText, setNewText]        = useState('');

  // Show typewriter when a new insight arrives after generation
  const { displayed, done } = useTypewriter(newText, 10);
  const displayText = newText ? displayed : (insight?.content || '');

  const handleGenerate = async () => {
    setGenerating(true);
    setNewText('');
    if (isDemoClient(clientId)) {
      const nextInsight = getDemoInsight(month, year);
      setTimeout(() => {
        setGenerating(false);
        setNewText(nextInsight.content);
        setInsight(nextInsight);
      }, 900);
      return;
    }
    try {
      await insightsAPI.generate({ client: clientId, month, year });
      // Poll until the insight appears (Celery task ~5-15s)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const res = await insightsAPI.list({ client: clientId, month, year });
          const data = res.data.results || res.data;
          if (data.length > 0) {
            const content = data[0].content;
            // Check it's newer than what we had
            const isNew = !insight || data[0].generated_at !== insight.generated_at;
            if (isNew) {
              clearInterval(poll);
              setGenerating(false);
              setNewText(content);
              refetch();
            }
          }
        } catch { /* ignore */ }
        if (attempts >= 30) { clearInterval(poll); setGenerating(false); refetch(); }
      }, 1000);
    } catch (e) {
      console.error(e);
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    const text = displayText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const monthLabel = MONTHS[(month || 1) - 1];

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <div style={styles.iconWrap}>
            <Sparkles size={16} style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <h3 style={styles.title}>AI Insight</h3>
            <p style={styles.subtitle}>{monthLabel} {year}</p>
          </div>
        </div>

        <div style={styles.actions}>
          {displayText && (
            <button onClick={handleCopy} style={styles.iconBtn} title="Copy to clipboard">
              {copied ? <Check size={15} style={{ color: '#16a34a' }} /> : <Copy size={15} />}
            </button>
          )}
          {canGenerate && (
            <button
              onClick={handleGenerate}
              disabled={generating || loading}
              style={styles.generateBtn}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {generating
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                  : <><RefreshCw size={14} /> {insight ? 'Regenerate' : 'Generate Insight'}</>
                }
              </span>
            </button>
          )}
        </div>
      </div>

      <div style={styles.body}>
        {loading && !displayText ? (
          <div style={styles.skeleton}>
            <div style={{ ...styles.skLine, width: '92%' }} />
            <div style={{ ...styles.skLine, width: '85%' }} />
            <div style={{ ...styles.skLine, width: '78%' }} />
          </div>
        ) : generating && !newText ? (
          <div style={styles.generatingState}>
            <Loader2 size={24} style={{ color: '#7c3aed', animation: 'spin 1s linear infinite' }} />
            <p style={styles.generatingText}>
              AI is analyzing your metrics…<br />
              <span style={{ color: '#94a3b8', fontSize: 12 }}>This usually takes 5–15 seconds</span>
            </p>
          </div>
        ) : displayText ? (
          <div style={styles.content}>
            {displayText.split('\n\n').map((para, i) => (
              <p key={i} style={styles.para}>{para}</p>
            ))}
            {newText && !done && <span style={styles.cursor}>▌</span>}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <Sparkles size={28} style={{ color: '#c4b5fd', marginBottom: 10 }} />
            <p style={styles.emptyText}>
              {canGenerate
                ? 'No insight generated yet. Click "Generate Insight" to get an AI-powered analysis.'
                : 'No insight available for this period yet.'}
            </p>
          </div>
        )}
      </div>

      {insight && !newText && (
        <div style={styles.footer}>
          Generated {new Date(insight.generated_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: 'linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)',
    border: '1.5px solid #e9d5ff',
    borderRadius: 16, padding: 24,
    boxShadow: '0 2px 12px rgba(124,58,237,.08)',
    marginBottom: 24,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 18,
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title:    { margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' },
  subtitle: { margin: '2px 0 0', fontSize: 12, color: '#7c3aed' },
  actions:  { display: 'flex', alignItems: 'center', gap: 8 },

  iconBtn: {
    background: 'none', border: '1px solid #e2d9f3', borderRadius: 8,
    padding: '6px 8px', cursor: 'pointer', color: '#64748b',
    display: 'flex', alignItems: 'center',
  },
  generateBtn: {
    padding: '8px 16px', borderRadius: 10, border: 'none',
    background: '#7c3aed', color: '#fff', cursor: 'pointer',
    fontWeight: 600, fontSize: 13,
  },

  body: { minHeight: 80 },

  skeleton: { display: 'flex', flexDirection: 'column', gap: 10 },
  skLine: {
    height: 14, borderRadius: 6,
    background: 'linear-gradient(90deg, #e9d5ff 25%, #f3e8ff 50%, #e9d5ff 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },

  generatingState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: '28px 0', textAlign: 'center',
  },
  generatingText: { margin: 0, fontSize: 14, color: '#6d28d9', lineHeight: 1.6 },

  content: {},
  para: {
    margin: '0 0 14px', fontSize: 14, color: '#374151',
    lineHeight: 1.75,
  },
  cursor: { color: '#7c3aed', animation: 'blink 1s step-end infinite' },

  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '32px 0', textAlign: 'center',
  },
  emptyText: { margin: 0, fontSize: 13, color: '#94a3b8', maxWidth: 320, lineHeight: 1.6 },

  footer: {
    marginTop: 12, paddingTop: 12,
    borderTop: '1px solid #e9d5ff',
    fontSize: 11, color: '#a78bfa',
  },
};
