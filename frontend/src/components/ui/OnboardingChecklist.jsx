import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Rocket, X } from 'lucide-react';
import { onboardingAPI } from '../../services/api';

// ── Confetti ──────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('onboarding-styles')) {
  const s = document.createElement('style');
  s.id = 'onboarding-styles';
  s.textContent = `
    @keyframes confettiFall {
      0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
      100% { transform: translateY(120px) rotate(720deg); opacity: 0; }
    }
    @keyframes checkPop {
      0%   { transform: scale(0.5); opacity: 0; }
      60%  { transform: scale(1.2); }
      100% { transform: scale(1);   opacity: 1; }
    }
    @keyframes progressFill {
      from { width: 0; }
    }
  `;
  document.head.appendChild(s);
}

const CONFETTI_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#2563eb'];

function ConfettiBurst() {
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.6}s`,
    size: `${6 + Math.random() * 8}px`,
    duration: `${0.8 + Math.random() * 0.6}s`,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'inherit' }}>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: 0,
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

const STEP_ICONS = {
  connect_platform: '🔗',
  first_sync:       '🔄',
  set_goals:        '🎯',
  add_credentials:  '🔑',
  invite_team:      '👥',
  configure_alerts: '🔔',
};

const MANUAL_STEPS = new Set(['invite_team', 'configure_alerts']);

export default function OnboardingChecklist({ clientId }) {
  const [steps,     setSteps]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [confetti,  setConfetti]  = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevDoneRef = useRef(0);

  const fetchSteps = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await onboardingAPI.list({ client: clientId });
      const data = res.data.results || res.data;
      setSteps(data);

      const doneNow = data.filter(s => s.is_completed).length;
      // Trigger confetti when all 6 just completed
      if (doneNow === data.length && data.length > 0 && prevDoneRef.current < data.length) {
        setConfetti(true);
        setTimeout(() => {
          setConfetti(false);
          setDismissed(true);
        }, 2500);
      }
      prevDoneRef.current = doneNow;
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchSteps(); }, [fetchSteps]);

  async function markComplete(step) {
    if (step.is_completed) return;
    try {
      const res = await onboardingAPI.update(step.id, { is_completed: true });
      setSteps(prev => prev.map(s => s.id === step.id ? res.data : s));
      const updatedSteps = steps.map(s => s.id === step.id ? res.data : s);
      const doneNow = updatedSteps.filter(s => s.is_completed).length;
      if (doneNow === updatedSteps.length) {
        setConfetti(true);
        setTimeout(() => { setConfetti(false); setDismissed(true); }, 2500);
      }
    } catch { /* ignore */ }
  }

  if (loading || dismissed) return null;

  const done  = steps.filter(s => s.is_completed).length;
  const total = steps.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  // Already complete and not just-finished — hide
  if (done === total && total > 0 && !confetti) return null;

  return (
    <div style={{ ...wrap, position: 'relative' }}>
      {confetti && <ConfettiBurst />}

      {/* Header */}
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={rocketWrap}>
            <Rocket size={16} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h3 style={title}>Getting Started</h3>
            <p style={subtitle}>{done} of {total} steps completed</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={pctBadge}>{pct}%</span>
          <button onClick={() => setCollapsed(c => !c)} style={iconBtn}>
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button onClick={() => setDismissed(true)} style={{ ...iconBtn, color: '#94a3b8' }} title="Dismiss">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={trackStyle}>
        <div
          style={{
            ...fillStyle,
            width: `${pct}%`,
            animation: 'progressFill 0.6s ease',
            background: pct === 100 ? '#16a34a' : '#6366f1',
          }}
        />
      </div>

      {/* Steps list */}
      {!collapsed && (
        <div style={stepsList}>
          {steps.map(step => (
            <div key={step.id} style={{ ...stepRow, opacity: step.is_completed ? 0.7 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                {step.is_completed ? (
                  <CheckCircle2
                    size={20}
                    style={{ color: '#16a34a', flexShrink: 0, animation: 'checkPop 0.3s ease', marginTop: 1 }}
                  />
                ) : (
                  <Circle size={20} style={{ color: '#cbd5e1', flexShrink: 0, marginTop: 1 }} />
                )}
                <div>
                  <div style={stepLabel}>
                    <span style={{ marginRight: 6 }}>{STEP_ICONS[step.step_key]}</span>
                    <span style={{ textDecoration: step.is_completed ? 'line-through' : 'none' }}>
                      {step.label}
                    </span>
                  </div>
                  <p style={stepDesc}>{step.description}</p>
                </div>
              </div>

              {!step.is_completed && MANUAL_STEPS.has(step.step_key) && (
                <button onClick={() => markComplete(step)} style={markBtn}>
                  Mark Done
                </button>
              )}

              {step.is_completed && step.completed_at && (
                <span style={doneAt}>
                  {new Date(step.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const wrap = {
  background: '#fff', borderRadius: 14, padding: '18px 20px',
  boxShadow: '0 1px 8px rgba(0,0,0,.08)', marginBottom: 24,
  border: '1px solid #e0e7ff',
};
const header  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 };
const rocketWrap = {
  width: 34, height: 34, borderRadius: 8, background: '#ede9fe',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const title    = { margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' };
const subtitle = { margin: '2px 0 0', fontSize: 12, color: '#64748b' };
const pctBadge = {
  fontSize: 11, fontWeight: 700, padding: '2px 8px',
  background: '#ede9fe', color: '#6366f1', borderRadius: 20,
};
const iconBtn  = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#64748b', display: 'flex', padding: 4,
};
const trackStyle = {
  height: 6, background: '#e5e7eb', borderRadius: 4,
  overflow: 'hidden', marginBottom: 16,
};
const fillStyle  = { height: '100%', borderRadius: 4, transition: 'width 0.5s ease, background 0.3s' };
const stepsList  = { display: 'flex', flexDirection: 'column', gap: 12 };
const stepRow    = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
  gap: 10, padding: '10px 12px', background: '#f8fafc',
  borderRadius: 10, border: '1px solid #f1f5f9',
  transition: 'opacity 0.3s',
};
const stepLabel  = { fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 2 };
const stepDesc   = { margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 };
const markBtn    = {
  padding: '5px 12px', borderRadius: 8, border: '1px solid #6366f1',
  background: '#fff', color: '#6366f1', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
};
const doneAt     = { fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'center' };
