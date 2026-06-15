/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useEffect, useState } from 'react';

const STAGES = [
  { key: 'clicks',         label: 'Total Clicks',     color: '#2563EB', lightColor: '#DBEAFE' },
  { key: 'website_clicks', label: 'Website Visits',   color: '#7C3AED', lightColor: '#EDE9FE' },
  { key: 'leads',          label: 'Leads',             color: '#059669', lightColor: '#D1FAE5' },
  { key: 'sales',          label: 'Conversions',       color: '#D97706', lightColor: '#FEF3C7' },
];

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}

export default function ROIFunnel({ clicks = 0, website_clicks = 0, leads = 0, sales = 0 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [clicks, website_clicks, leads, sales]);

  const values = { clicks, website_clicks, leads, sales };

  return (
    <div style={{ width: '100%', padding: '8px 0' }}>
      {STAGES.map((stage, i) => {
        const val      = values[stage.key] || 0;
        const prevVal  = i === 0 ? val : (values[STAGES[i - 1].key] || 1);
        const convPct  = i === 0 ? 100 : (prevVal > 0 ? Math.round((val / prevVal) * 100) : 0);
        // Funnel width: 100% at top, narrowing by 15% per stage
        const widthPct = 100 - i * 14;

        return (
          <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Trapezoid block */}
            <div
              style={{
                width: `${widthPct}%`,
                background: stage.lightColor,
                border: `2px solid ${stage.color}`,
                borderRadius: i === 0 ? '10px 10px 0 0' : i === STAGES.length - 1 ? '0 0 10px 10px' : '0',
                padding: '14px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'opacity 0.4s ease',
                transitionDelay: `${i * 100}ms`,
                opacity: visible ? 1 : 0,
                boxSizing: 'border-box',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: stage.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {fmt(val)}
                </div>
              </div>
              {i > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>conversion</div>
                  <div style={{
                    fontSize: 16, fontWeight: 700,
                    color: convPct >= 20 ? '#059669' : convPct >= 5 ? '#D97706' : '#EF4444',
                  }}>
                    {convPct}%
                  </div>
                </div>
              )}
            </div>

            {/* Connector arrow between stages */}
            {i < STAGES.length - 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
                <div style={{ width: 2, height: 8, background: '#CBD5E1' }} />
                <div style={{
                  width: 0, height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '8px solid #CBD5E1',
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
