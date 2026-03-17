import { useMemo, useEffect, useRef } from 'react';
import { eachDayOfInterval, format, startOfMonth, endOfMonth } from 'date-fns';

const INTENSITY_COLORS = ['#F1F5F9', '#BFDBFE', '#60A5FA', '#2563EB'];

function getColor(count) {
  if (count === 0) return INTENSITY_COLORS[0];
  if (count === 1) return INTENSITY_COLORS[1];
  if (count === 2) return INTENSITY_COLORS[2];
  return INTENSITY_COLORS[3];
}

export default function HeatmapCalendar({ month, year, postsByDate }) {
  const containerRef = useRef(null);

  const days = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1, 1));
    const end   = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  }, [month, year]);

  // Animate squares left-to-right on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const squares = containerRef.current.querySelectorAll('.hm-sq');
    squares.forEach((sq, i) => {
      sq.style.opacity  = '0';
      sq.style.transform= 'scale(0.5)';
      setTimeout(() => {
        sq.style.opacity   = '1';
        sq.style.transform = 'scale(1)';
        sq.style.transition = 'opacity 0.2s, transform 0.2s';
      }, i * 12);
    });
  }, [month, year, postsByDate]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const count   = (postsByDate[dateStr] || []).length;
        const color   = getColor(count);
        return (
          <div
            key={dateStr}
            className="hm-sq"
            title={`${format(day, 'MMM d')}: ${count} post${count !== 1 ? 's' : ''}`}
            style={{
              width: 12, height: 12,
              borderRadius: 2,
              background: color,
              cursor: 'default',
            }}
          />
        );
      })}
      {/* Legend */}
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center',
        gap: 6, marginTop: 8, fontSize: 10, color: '#64748B',
      }}>
        <span>Less</span>
        {INTENSITY_COLORS.map(c => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
