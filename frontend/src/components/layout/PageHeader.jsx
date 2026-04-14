import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function PageHeader({ title, subtitle, action, actions, backHref, meta = [], eyebrow = null }) {
  const navigate = useNavigate();
  const actionContent = action || actions || null;

  return (
    <div style={{
      padding: '16px 16px 8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      background: '#f6f8fc',
      position: 'sticky',
      top: 56,
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        {backHref && (
          <button
            onClick={() => navigate(backHref)}
            style={{
              width: 36, height: 36,
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <ChevronLeft size={18} color="#0f172a" />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actionContent && <div style={{ flexShrink: 0 }}>{actionContent}</div>}
    </div>
  );
}
