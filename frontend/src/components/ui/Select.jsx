/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search as SearchIcon } from 'lucide-react';

/**
 * Select — accessible custom dropdown.
 *
 * Props:
 *   options:    [{ value, label, icon?, disabled?, group? }]
 *   value:      currently selected value (controlled)
 *   onChange:   (value) => void
 *   placeholder
 *   label, hint, error
 *   searchable: enables a search input inside the popover (default false)
 *   size:       'sm' | 'md' | 'lg'
 *   disabled:   bool
 *   fullWidth:  default true
 *
 * Multi-select is intentionally NOT covered here — for that, use a chip-input
 * variant (future work). This is the workhorse single-select.
 */
const Select = forwardRef(function Select(
  {
    options = [],
    value,
    onChange,
    placeholder = 'Select…',
    label,
    hint,
    error,
    searchable = false,
    size = 'md',
    disabled = false,
    fullWidth = true,
    id,
    className,
    style,
  },
  ref,
) {
  const reactId = useId();
  const fieldId = id || `sel-${reactId}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const listboxId = `${fieldId}-list`;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reset search when closing
  useEffect(() => {
    if (!open) { setQuery(''); setActiveIdx(-1); }
  }, [open]);

  const filtered = useMemo(() => {
    if (!searchable || !query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => (o.label || '').toLowerCase().includes(q));
  }, [options, query, searchable]);

  const selected = options.find((o) => o.value === value);

  const heights = { sm: 32, md: 40, lg: 48 };
  const h = heights[size] || heights.md;

  const borderColor = error
    ? 'var(--danger)'
    : open
      ? 'var(--brand-primary)'
      : 'var(--border-default)';

  function commit(v) {
    onChange?.(v);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      if (!open) { e.preventDefault(); setOpen(true); return; }
    }
    if (open) {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        const opt = filtered[activeIdx];
        if (opt && !opt.disabled) commit(opt.value);
      }
    }
  }

  return (
    <div ref={wrapperRef} className={className} style={{ position: 'relative', width: fullWidth ? '100%' : undefined, ...style }}>
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-secondary)',
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      )}

      <button
        ref={ref}
        id={fieldId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          height: h,
          minHeight: 'auto',
          padding: '0 10px 0 12px',
          background: 'var(--surface-card)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: open ? 'var(--shadow-glow)' : 'var(--shadow-xs)',
          color: 'var(--text-primary)',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left',
          transition: 'var(--transition-fast)',
        }}
      >
        {selected?.icon && (
          <selected.icon size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        )}
        <span style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontWeight: selected ? 500 : 400,
        }}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={15}
          aria-hidden
          style={{
            color: 'var(--text-tertiary)',
            flexShrink: 0,
            transition: 'var(--transition-fast)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          id={listboxId}
          tabIndex={-1}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 'var(--z-popover)',
            maxHeight: 320,
            overflow: 'auto',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
          }}
        >
          {searchable && (
            <div style={{
              position: 'sticky', top: 0,
              background: 'var(--surface-elevated)',
              padding: '4px 4px 6px', marginBottom: 4,
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ position: 'relative' }}>
                <SearchIcon size={13} aria-hidden style={{
                  position: 'absolute', top: 8, left: 8, color: 'var(--text-tertiary)',
                }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
                  placeholder="Search…"
                  autoFocus
                  style={{
                    width: '100%', height: 30, minHeight: 'auto',
                    padding: '0 8px 0 26px',
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13, color: 'var(--text-primary)',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
              No options
            </div>
          )}

          {filtered.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isActive = idx === activeIdx;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => !opt.disabled && commit(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '8px 10px', minHeight: 'auto',
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'var(--surface-hover)' : 'transparent',
                  color: opt.disabled ? 'var(--text-quaternary)' : 'var(--text-primary)',
                  border: 'none', cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  textAlign: 'left',
                }}
              >
                {opt.icon && <opt.icon size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
                {isSelected && <Check size={14} style={{ color: 'var(--brand-primary-hover)' }} />}
              </button>
            );
          })}
        </div>
      )}

      {(error || hint) && (
        <div
          role={error ? 'alert' : undefined}
          aria-live={error ? 'polite' : undefined}
          style={{
            marginTop: 6,
            fontSize: 12,
            color: error ? 'var(--danger)' : 'var(--text-tertiary)',
          }}
        >
          {error || hint}
        </div>
      )}
    </div>
  );
});

export default Select;
