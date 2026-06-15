/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
/**
 * AgencyBillingPage — agency-side billing.
 *
 * Mirrors EndUserBillingPage but scoped to the user's primary agency. Plans
 * shown are the agency-* tiers; the only usage meter is `managed_clients`
 * (the cap that gates send + accept).
 *
 * Lives at /admin/billing (under the existing AppShell). The agency owner /
 * admin resolves their agency via /auth/me → primary_agency_slug, same path
 * the marketplace profile editor uses.
 */
import { useEffect, useState } from 'react';
import {
  CreditCard, Check, Sparkles, AlertTriangle, RefreshCw, FileText,
  XCircle, ArrowRight,
} from 'lucide-react';

import { agencyBillingAPI, billingAPI, authAPI } from '../../services/api';
import toast from '../../components/ui/toast';


function formatPrice(p, currency) {
  if (p == null) return 'Custom';
  if (p === 0)   return 'Free';
  return `${currency} ${(p / 100).toLocaleString('en-IN')}`;
}


export default function AgencyBillingPage() {
  const [slug,     setSlug]     = useState(null);
  const [plans,    setPlans]    = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [loading,  setLoading]  = useState(true);

  // Resolve agency slug from /auth/me (same plumbing as the marketplace profile editor)
  useEffect(() => {
    let cancelled = false;
    authAPI.me()
      .then((r) => {
        if (cancelled) return;
        const s = r.data?.primary_agency_slug;
        if (s) setSlug(s);
        else { setLoading(false); toast.error('No agency profile resolved for your account.'); }
      })
      .catch(() => { setLoading(false); toast.error('Could not load profile'); });
    return () => { cancelled = true; };
  }, []);

  function loadAll() {
    if (!slug) return;
    setLoading(true);
    Promise.all([
      billingAPI.plans('agency'),
      agencyBillingAPI.subscription(slug),
      agencyBillingAPI.invoices(slug),
    ])
      .then(([rP, rS, rI]) => {
        setPlans(rP.data?.plans || []);
        setSnapshot(rS.data || null);
        setInvoices(rI.data?.invoices || []);
      })
      .catch(() => toast.error('Could not load billing'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (slug) loadAll(); /* eslint-disable-next-line */ }, [slug]);

  const currentPlan = snapshot?.subscription?.plan;

  async function upgrade(plan) {
    if (!slug || busy) return;
    if (PLAN_NEEDS_SALES.includes(plan)) {
      toast('Enterprise is sales-led — drop us a line at hello@socialstats.app');
      return;
    }
    setBusy(true);
    try {
      const r = await agencyBillingAPI.checkout(slug, plan);
      const data = r.data;
      if (data.test_mode) {
        await agencyBillingAPI.confirm(slug, { plan, order_id: data.order_id });
        toast.success(`Upgraded to ${plan} (test mode)`);
        loadAll();
        return;
      }
      if (!window.Razorpay) {
        toast.error('Razorpay is not loaded; please retry shortly');
        return;
      }
      new window.Razorpay({
        key: data.key_id, amount: data.amount, currency: data.currency, order_id: data.order_id,
        name: 'Social Stats', description: `Upgrade to ${plan}`,
        handler: async (resp) => {
          try {
            await agencyBillingAPI.confirm(slug, {
              plan,
              order_id:    resp.razorpay_order_id,
              payment_id:  resp.razorpay_payment_id,
              signature:   resp.razorpay_signature,
            });
            toast.success(`Welcome to ${plan}!`);
            loadAll();
          } catch {
            toast.error('Payment captured but confirmation failed; support has been notified.');
          }
        },
      }).open();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not start checkout');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!slug) return;
    if (!window.confirm('Cancel at the end of the current period?')) return;
    try {
      await agencyBillingAPI.cancel(slug);
      toast.success('Cancellation scheduled');
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not cancel');
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-tertiary)' }}>Loading…</div>;
  if (!slug) {
    return (
      <div style={{ padding: 32, color: 'var(--text-secondary)' }}>
        We couldn't find an agency for your account. If your team owns an agency,
        ask them to add you, then come back here.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={iconWrap}><CreditCard size={20} strokeWidth={2.2} /></span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Agency billing
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Plan tier sets your maximum active managed clients. Upgrade as your roster grows.
          </p>
        </div>
        <button type="button" onClick={loadAll} style={btnGhost}><RefreshCw size={13} /> Refresh</button>
      </header>

      {snapshot && (
        <section style={card}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-primary-hover)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Current plan
              </div>
              <h2 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                {snapshot.subscription.plan_label} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)' }}>· {snapshot.subscription.plan}</span>
              </h2>
              {snapshot.subscription.cancel_at_period_end && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <AlertTriangle size={12} /> Cancellation scheduled for {snapshot.subscription.current_period_end ? new Date(snapshot.subscription.current_period_end).toLocaleDateString() : 'period end'}
                </div>
              )}
            </div>
            {snapshot.subscription.plan !== 'agency-starter' && !snapshot.subscription.cancel_at_period_end && (
              <button type="button" onClick={cancel} style={btnGhostMuted}>
                <XCircle size={13} /> Cancel at period end
              </button>
            )}
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
            {snapshot.usage.map((u) => <UsageMeter key={u.key} row={u} />)}
          </div>
        </section>
      )}

      <section>
        <h2 style={sectionH}>Choose a plan</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {plans.map((p) => (
            <PlanCard
              key={p.sku}
              plan={p}
              isCurrent={p.sku === currentPlan}
              busy={busy}
              onUpgrade={() => upgrade(p.sku)}
            />
          ))}
        </div>
      </section>

      <section style={card}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Invoices</h2>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{invoices.length} on file</span>
        </header>
        {invoices.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-tertiary)' }}>No invoices yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={cell}>Date</th>
                <th style={cell}>Period</th>
                <th style={{ ...cell, textAlign: 'right' }}>Amount</th>
                <th style={cell}>Status</th>
                <th style={cell}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={cell}>{i.created_at ? new Date(i.created_at).toLocaleDateString() : '—'}</td>
                  <td style={cell}>
                    {i.period_start && i.period_end
                      ? `${new Date(i.period_start).toLocaleDateString()} → ${new Date(i.period_end).toLocaleDateString()}`
                      : '—'}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {i.currency} {Number(i.amount).toLocaleString()}
                  </td>
                  <td style={cell}>
                    <span style={{
                      padding: '2px 8px', fontSize: 10, fontWeight: 600,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      borderRadius: 'var(--radius-pill)',
                      color:      i.status === 'paid' ? 'var(--success)' : i.status === 'failed' ? 'var(--danger)' : 'var(--text-tertiary)',
                      background: i.status === 'paid' ? 'var(--success-bg)' : i.status === 'failed' ? 'var(--danger-bg)' : 'var(--surface-sunken)',
                      border: '1px solid currentColor',
                    }}>{i.status}</span>
                  </td>
                  <td style={cell}>
                    {i.pdf_url
                      ? <a href={i.pdf_url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary-hover)' }}><FileText size={12} style={{ verticalAlign: '-2px' }} /> view</a>
                      : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}


const PLAN_NEEDS_SALES = ['agency-enterprise'];


function UsageMeter({ row }) {
  const isUnlimited = row.limit === null || row.limit === undefined;
  const pct = row.percent ?? 0;
  const danger = !isUnlimited && pct >= 90;
  const warn   = !isUnlimited && pct >= 70 && !danger;
  return (
    <div style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {row.key.replace(/_/g, ' ')}
      </div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {row.current ?? 0}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          / {isUnlimited ? '∞' : row.limit}
        </span>
      </div>
      {!isUnlimited && (
        <div style={{ marginTop: 8, height: 5, background: 'var(--border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, pct)}%`,
            height: '100%',
            background: danger ? 'var(--danger)' : warn ? 'var(--warning)' : 'var(--brand-primary)',
            transition: 'width 200ms',
          }} />
        </div>
      )}
    </div>
  );
}


function PlanCard({ plan, isCurrent, busy, onUpgrade }) {
  const highlight = plan.sku === 'agency-growth';
  const isSalesLed = PLAN_NEEDS_SALES.includes(plan.sku);
  return (
    <div style={{
      padding: 18,
      background: highlight ? 'var(--brand-primary-soft)' : 'var(--surface-card)',
      border: `1px solid ${highlight ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-lg)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? 'var(--brand-primary-hover)' : 'var(--text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {plan.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {formatPrice(plan.price, plan.currency)} {plan.price > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>/mo</span>}
          </div>
        </div>
        {isCurrent && (
          <span style={{ padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius-pill)' }}>
            <Check size={10} style={{ verticalAlign: '-1px', marginRight: 2 }} /> Current
          </span>
        )}
        {highlight && !isCurrent && (
          <span style={{ padding: '2px 8px', fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', background: 'var(--brand-primary)', color: '#fff', borderRadius: 'var(--radius-pill)' }}>
            <Sparkles size={10} style={{ verticalAlign: '-1px', marginRight: 2 }} /> Most chosen
          </span>
        )}
      </header>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 6 }}>
            <Check size={13} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <button type="button" disabled style={{ ...btnGhost, justifyContent: 'center', cursor: 'default' }}>You're on this plan</button>
      ) : isSalesLed ? (
        <a href="mailto:hello@socialstats.app?subject=Social Stats+Enterprise" style={{ ...btnGhost, justifyContent: 'center', textDecoration: 'none' }}>
          Talk to sales <ArrowRight size={13} />
        </a>
      ) : (
        <button type="button" onClick={onUpgrade} disabled={busy} style={{ ...btnPrimary, justifyContent: 'center' }}>
          {busy ? 'Working…' : <>Upgrade <ArrowRight size={13} /></>}
        </button>
      )}
    </div>
  );
}


const card = {
  padding: 18,
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
};

const iconWrap = {
  width: 40, height: 40,
  background: 'var(--brand-primary-glow)',
  color: 'var(--brand-primary-hover)',
  borderRadius: 'var(--radius-md)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const sectionH = {
  margin: '0 0 10px',
  fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
};

const cell = { padding: '8px 10px', verticalAlign: 'middle', color: 'var(--text-secondary)' };

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 14px',
  background: 'var(--brand-primary)', color: '#fff',
  border: 'none', borderRadius: 'var(--radius-md)',
  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  background: 'var(--surface-card)', color: 'var(--text-secondary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
};

const btnGhostMuted = { ...btnGhost, color: 'var(--text-tertiary)' };
