/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Loader2, Inbox } from 'lucide-react';

import EmptyState from './EmptyState';

/**
 * DataTable — modern table with sticky header, sortable columns, pagination,
 * row hover, and inline empty state.
 *
 * Props:
 *   columns: [
 *     {
 *       key:       string,                    // unique id
 *       header:    string | ReactNode,
 *       accessor?: (row) => any,              // value used for sorting + default render
 *       render?:   (row, index) => ReactNode, // custom cell content
 *       sortable?: boolean,                   // default true if accessor present
 *       width?:    string | number,
 *       align?:    'left' | 'center' | 'right',
 *     }
 *   ]
 *   rows: array of any (rowId derives from rowKey or index)
 *   rowKey:    string | (row) => any           — defaults to 'id' or row index
 *   onRowClick: (row, index) => void           — makes row clickable + keyboard-focusable
 *   loading:    boolean
 *   pageSize:   number (default 25; pass 0/falsy to disable pagination)
 *   emptyState: { icon, title, description, action }
 *   stickyHeader: boolean (default true)
 *   className:  passes through to wrapper
 *
 * Sorting state is internal; pass server-sorted data to skip client sort.
 */
export default function DataTable({
  columns,
  rows = [],
  rowKey,
  onRowClick,
  loading = false,
  pageSize = 25,
  emptyState,
  stickyHeader = true,
  className,
  style,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.accessor) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, columns, sortKey, sortDir]);

  const total = sorted.length;
  const paged = pageSize ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;
  const pageCount = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  function toggleSort(col) {
    if (col.sortable === false) return;
    if (!col.accessor && !col.sortable) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  }

  function getRowKey(row, idx) {
    if (typeof rowKey === 'function') return rowKey(row);
    if (typeof rowKey === 'string')   return row[rowKey];
    return row?.id ?? idx;
  }

  function renderCell(col, row, idx) {
    if (col.render) return col.render(row, idx);
    if (col.accessor) return col.accessor(row);
    return row?.[col.key];
  }

  return (
    <div
      className={className}
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        >
          <thead>
            <tr>
              {columns.map((col) => {
                const sortable = col.sortable !== false && (col.accessor || col.sortable);
                const isActive = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => sortable && toggleSort(col)}
                    aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    style={{
                      position: stickyHeader ? 'sticky' : undefined,
                      top: stickyHeader ? 0 : undefined,
                      zIndex: stickyHeader ? 1 : undefined,
                      textAlign: col.align || 'left',
                      padding: '11px 16px',
                      width: col.width,
                      background: 'var(--surface-sunken)',
                      color: 'var(--text-tertiary)',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.header}
                      {sortable && <SortIcon active={isActive} dir={sortDir} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} style={cellStateStyle}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={14} className="ds-table-spin" /> Loading…
                  </span>
                </td>
              </tr>
            )}
            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                  <EmptyState
                    icon={emptyState?.icon || Inbox}
                    title={emptyState?.title || 'Nothing here yet'}
                    description={emptyState?.description}
                    action={emptyState?.action}
                  />
                </td>
              </tr>
            )}
            {!loading && paged.map((row, i) => {
              const k = getRowKey(row, i);
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row, i); } } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  className="ds-table-row"
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        textAlign: col.align || 'left',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        verticalAlign: 'middle',
                      }}
                    >
                      {renderCell(col, row, i)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageSize > 0 && total > pageSize && (
        <Pagination page={page} pageCount={pageCount} pageSize={pageSize} total={total} onChange={setPage} />
      )}

      <style>{`
        .ds-table-row:hover { background: var(--surface-hover); }
        .ds-table-row:focus-visible {
          outline: 2px solid var(--brand-primary);
          outline-offset: -2px;
        }
        .ds-table-spin { animation: ds-spin 0.9s linear infinite; }
        @keyframes ds-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={12} aria-hidden style={{ opacity: 0.5 }} />;
  return dir === 'asc'
    ? <ChevronUp size={12} aria-hidden />
    : <ChevronDown size={12} aria-hidden />;
}

function Pagination({ page, pageCount, pageSize, total, onChange }) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--surface-card)',
      fontSize: 12,
      color: 'var(--text-secondary)',
    }}>
      <span>Showing {start}–{end} of {total}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <PageBtn disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={14} />
        </PageBtn>
        <span style={{ padding: '0 8px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {page} / {pageCount}
        </span>
        <PageBtn disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight size={14} />
        </PageBtn>
      </div>
    </div>
  );
}

function PageBtn({ disabled, onClick, children, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-card)',
        color: 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'var(--transition-fast)',
        padding: 0,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

const cellStateStyle = {
  padding: 24,
  textAlign: 'center',
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-subtle)',
};
