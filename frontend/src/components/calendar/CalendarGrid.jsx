/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import { useState } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  format, isSameMonth, isToday, getDay, isBefore, startOfDay,
} from 'date-fns';
import PostPill from './PostPill';
import NoteTooltip from './NoteTooltip';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// date-fns getDay returns 0=Sun…6=Sat, convert to 0=Mon…6=Sun
function getMondayIndex(d) {
  return (getDay(d) + 6) % 7;
}

export default function CalendarGrid({
  month, year, postsByDate, notesByDate,
  onDayClick, onPostClick, selectedPlatform,
}) {
  const [hoveredNote, setHoveredNote] = useState(null);
  const [notePos,     setNotePos]     = useState({ x: 0, y: 0 });

  const firstDay  = new Date(year, month - 1, 1);
  const lastDay   = endOfMonth(firstDay);
  const startPad  = getMondayIndex(firstDay);
  const allDays   = eachDayOfInterval({ start: firstDay, end: lastDay });

  // Pad with prev-month days
  const prevMonthDays = [];
  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(firstDay);
    d.setDate(d.getDate() - (i + 1));
    prevMonthDays.push(d);
  }

  // Pad with next-month days to complete last row
  const totalCells = prevMonthDays.length + allDays.length;
  const nextPad    = (7 - (totalCells % 7)) % 7;
  const nextMonthDays = [];
  for (let i = 1; i <= nextPad; i++) {
    const d = new Date(lastDay);
    d.setDate(d.getDate() + i);
    nextMonthDays.push(d);
  }

  const cells = [...prevMonthDays, ...allDays, ...nextMonthDays];

  function handleNoteHover(e, note) {
    const rect = e.currentTarget.getBoundingClientRect();
    setNotePos({ x: rect.right + 4, y: rect.top });
    setHoveredNote(note);
  }

  return (
    <div>
      {/* Weekday headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        background: '#F1F5F9', borderRadius: '8px 8px 0 0',
        border: '1px solid #E2E8F0', borderBottom: 'none',
        width: '100%',
      }}>
        {WEEKDAYS.map(d => (
          <div key={d} style={{
            padding: '10px 8px', textAlign: 'center',
            fontSize: 11, fontWeight: 700, color: '#64748B',
            letterSpacing: '.04em', textTransform: 'uppercase',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        border: '1px solid #E2E8F0', borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        overflow: 'hidden',
        width: '100%',
      }}>
        {cells.map((day, idx) => {
          const inMonth    = isSameMonth(day, firstDay);
          const today      = isToday(day);
          const pastDay    = inMonth && isBefore(startOfDay(day), startOfDay(new Date()));
          const canSchedule = inMonth && !pastDay;
          const dateStr    = format(day, 'yyyy-MM-dd');
          const posts      = (postsByDate[dateStr] || []).filter(p =>
            !selectedPlatform || selectedPlatform === 'all' || p.platform === selectedPlatform
          );
          const notes      = notesByDate?.[dateStr] || [];
          const extraPosts = posts.length > 3 ? posts.length - 3 : 0;

          return (
            <div
              key={idx}
              onClick={() => canSchedule && onDayClick && onDayClick(day)}
              style={{
                minHeight:  120,
                padding:    '6px 6px 4px',
                background: today ? '#EFF6FF' : pastDay ? '#F8FAFC' : inMonth ? '#fff' : '#F8FAFC',
                borderRight:  (idx + 1) % 7 !== 0 ? '1px solid #E2E8F0' : 'none',
                borderBottom: idx < cells.length - 7 ? '1px solid #E2E8F0' : 'none',
                cursor:  canSchedule ? 'pointer' : pastDay ? 'not-allowed' : 'default',
                transition: 'background 0.1s',
                position: 'relative',
                opacity: pastDay ? 0.8 : 1,
                minWidth: 0,
                boxSizing: 'border-box',
              }}
              onMouseEnter={e => {
                if (canSchedule) e.currentTarget.style.background = today ? '#DBEAFE' : '#F8FAFC';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = today ? '#EFF6FF' : pastDay ? '#F8FAFC' : inMonth ? '#fff' : '#F8FAFC';
              }}
            >
              {/* Day number */}
              <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background:  today ? '#2563EB' : 'transparent',
                  color:       today ? '#fff' : pastDay ? '#94A3B8' : inMonth ? '#1e293b' : '#CBD5E1',
                  fontSize:    13,
                  fontWeight:  today ? 700 : inMonth ? 500 : 400,
                  display:     'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink:  0,
                }}>
                  {format(day, 'd')}
                </div>
                {/* Note dots */}
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
                  {notes.slice(0, 3).map(note => (
                    <div
                      key={note.id}
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: note.color || '#2563EB',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.stopPropagation(); handleNoteHover(e, note); }}
                      onMouseLeave={() => setHoveredNote(null)}
                      title={note.title}
                    />
                  ))}
                </div>
              </div>

              {/* Post pills */}
              <div style={{ minWidth: 0 }}>
                {posts.slice(0, 3).map(post => (
                  <PostPill key={post.id} post={post} onClick={onPostClick} />
                ))}
                {extraPosts > 0 && (
                  <div style={{
                    fontSize: 10, color: '#2563EB', fontWeight: 600,
                    padding: '1px 4px', cursor: 'pointer',
                  }}>
                    +{extraPosts} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note tooltip portal */}
      {hoveredNote && (
        <div style={{
          position: 'fixed',
          left: notePos.x,
          top:  notePos.y,
          zIndex: 9999,
        }}>
          <NoteTooltip note={hoveredNote} />
        </div>
      )}
    </div>
  );
}
