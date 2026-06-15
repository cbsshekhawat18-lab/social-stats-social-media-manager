/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, RotateCcw, Rocket } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { onboardingAPI } from '../services/api';
import { useClients } from '../hooks/useData';
function ProgressBar({ value }) {
  return (
    <div style={styles.progressTrack}>
      <div style={{ ...styles.progressFill, width: `${value}%` }} />
    </div>
  );
}

export default function AdminOnboardingPage() {
  const { clients } = useClients();
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSteps() {
      try {
        setLoading(true);
        const res = await onboardingAPI.list();
        if (cancelled) return;
        const apiSteps = res.data.results || res.data;

        setSteps(apiSteps);
        if (!expandedClient && apiSteps[0]?.client) setExpandedClient(apiSteps[0].client);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSteps();
    return () => { cancelled = true; };
  }, [expandedClient]);

  const grouped = useMemo(() => {
    const map = new Map();
    steps.forEach((step) => {
      const clientId = step.client;
      if (!map.has(clientId)) {
        const clientName = step.client_name || clients.find((client) => client.id === clientId)?.company || `Client ${clientId}`;
        map.set(clientId, { clientId, clientName, steps: [] });
      }
      map.get(clientId).steps.push(step);
    });
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [steps, clients]);

  async function updateStep(step, nextCompleted) {
    try {
      setSavingId(step.id);
      const res = await onboardingAPI.update(step.id, { is_completed: nextCompleted });
      setSteps((prev) => prev.map((item) => (item.id === step.id ? res.data : item)));
    } catch (error) {
      console.error(error);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="app-page app-page--content app-page--lg">
      <PageHeader
        title="Onboarding"
        subtitle="Track setup progress across all clients and complete steps from one place."
        meta={[
          { label: 'Clients', value: grouped.length },
          { label: 'Completed Steps', value: steps.filter((step) => step.is_completed).length },
          { label: 'Open Steps', value: steps.filter((step) => !step.is_completed).length },
        ]}
      />

      {loading ? (
        <div style={styles.emptyState}>Loading onboarding progress…</div>
      ) : grouped.length === 0 ? (
        <div style={styles.emptyState}>No onboarding steps found yet.</div>
      ) : (
        <div style={styles.clientStack}>
          {grouped.map((group) => {
            const completed = group.steps.filter((step) => step.is_completed).length;
            const total = group.steps.length;
            const pct = total ? Math.round((completed / total) * 100) : 0;
            const open = expandedClient === group.clientId;

            return (
              <section key={group.clientId} style={styles.clientCard}>
                <button
                  type="button"
                  onClick={() => setExpandedClient(open ? null : group.clientId)}
                  style={styles.clientHeader}
                >
                  <div style={styles.clientHeaderLeft}>
                    <div style={styles.clientIcon}>
                      <Rocket size={16} style={{ color: '#00d7ff' }} />
                    </div>
                    <div>
                      <div style={styles.clientName}>{group.clientName}</div>
                      <div style={styles.clientMeta}>{completed} of {total} steps completed</div>
                    </div>
                  </div>
                  <div style={styles.clientHeaderRight}>
                    <span style={styles.percentBadge}>{pct}%</span>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                <div style={styles.clientProgressWrap}>
                  <ProgressBar value={pct} />
                </div>

                {open && (
                  <div style={styles.stepList}>
                    {group.steps.map((step) => {
                      const busy = savingId === step.id;
                      return (
                        <div key={step.id} style={styles.stepRow}>
                          <div style={styles.stepMain}>
                            {step.is_completed ? (
                              <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
                            ) : (
                              <Circle size={18} style={{ color: 'var(--text-quaternary)', flexShrink: 0, marginTop: 2 }} />
                            )}
                            <div>
                              <div style={styles.stepLabel}>{step.label}</div>
                              <div style={styles.stepDescription}>{step.description}</div>
                              {step.completed_at && (
                                <div style={styles.stepMeta}>
                                  Completed {new Date(step.completed_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => updateStep(step, !step.is_completed)}
                            style={{
                              ...styles.stepAction,
                              ...(step.is_completed ? styles.stepActionSecondary : styles.stepActionPrimary),
                              opacity: busy ? 0.6 : 1,
                            }}
                          >
                            {step.is_completed ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                            {busy ? 'Saving…' : step.is_completed ? 'Reset' : 'Mark Done'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  emptyState: {
    background: 'var(--surface-card)',
    borderRadius: 16,
    border: '1px solid var(--border-default)',
    padding: 40,
    textAlign: 'center',
    color: 'var(--text-tertiary)',
    boxShadow: '0 1px 6px rgba(15,23,42,.05)',
  },
  clientStack: { display: 'flex', flexDirection: 'column', gap: 18 },
  clientCard: {
    background: 'var(--surface-card)',
    borderRadius: 18,
    border: '1px solid var(--border-default)',
    boxShadow: '0 1px 8px rgba(15,23,42,.05)',
    overflow: 'hidden',
  },
  clientHeader: {
    width: '100%',
    padding: '18px 20px 14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  clientHeaderLeft: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  clientIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: '#e6fbff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clientName: { fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'left' },
  clientMeta: { marginTop: 4, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'left' },
  clientHeaderRight: { display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' },
  percentBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    background: '#e6fbff',
    color: '#007a9a',
    fontSize: 12,
    fontWeight: 800,
  },
  clientProgressWrap: { padding: '0 20px 18px' },
  progressTrack: { height: 8, borderRadius: 999, background: 'var(--border-default)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #00d7ff 0%, #00d7ff 100%)' },
  stepList: {
    borderTop: '1px solid #eef2f7',
    padding: '6px 20px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 0',
    borderBottom: '1px solid var(--surface-sunken)',
  },
  stepMain: { display: 'flex', gap: 12, minWidth: 0, flex: 1 },
  stepLabel: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 },
  stepDescription: { fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' },
  stepMeta: { marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' },
  stepAction: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  },
  stepActionPrimary: { background: '#e6fbff', color: '#007a9a', borderColor: '#99eeff' },
  stepActionSecondary: { background: 'var(--surface-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' },
};
