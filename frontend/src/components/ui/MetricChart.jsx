/* ============================================================================
 *  Social Stats — Social Media Management & Marketing Platform
 *  Author    : Chandrabhan Shekhawat
 *  Company   : Gigai Kripa Services
 *  Website   : https://gigaikripaservices.com/
 *  Copyright (c) 2026 Chandrabhan Shekhawat / Gigai Kripa Services.
 *  Released under the MIT License — see LICENSE. Keep this notice.
 * ========================================================================== */
import {
  AreaChart, Area,
  LineChart, Line,
  BarChart,  Bar,
  ResponsiveContainer,
  CartesianGrid, XAxis, YAxis, Tooltip as RTooltip,
  Legend,
} from 'recharts';

import EmptyState from './EmptyState';
import { LineChart as ChartIcon } from 'lucide-react';

/**
 * MetricChart — themed Recharts wrapper. Consistent across the app.
 *
 * Props:
 *   type:    'area' (default) | 'line' | 'bar'
 *   data:    array of objects: [{ x: 'Jan', value: 12, ... }]
 *   xKey:    field for x axis  (default 'x')
 *   series:  [{ key, name?, color? }]   one entry per line/area/bar
 *   height:  number   chart height in px (default 220)
 *   showGrid:        bool   default true
 *   showLegend:      bool   default false (legend is rarely needed; the page header usually labels)
 *   yTickFormatter:  function for y-axis values
 *   xTickFormatter:  function for x-axis values
 *   tooltipFormatter: function for tooltip values
 *
 * The component owns color assignment when series[].color is omitted —
 * the first series gets the brand cyan, the rest cycle through a small
 * palette designed to read in both light and dark mode.
 */
const FALLBACK_PALETTE = ['#00CCF5', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export default function MetricChart({
  type = 'area',
  data,
  xKey = 'x',
  series = [{ key: 'value' }],
  height = 220,
  showGrid = true,
  showLegend = false,
  yTickFormatter,
  xTickFormatter,
  tooltipFormatter,
  emptyTitle = 'No data yet',
  emptyDescription,
}) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }}>
        <EmptyState icon={ChartIcon} title={emptyTitle} description={emptyDescription} compact />
      </div>
    );
  }

  const resolvedSeries = series.map((s, i) => ({
    ...s,
    color: s.color || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length],
    name: s.name || s.key,
  }));

  const ChartComp = type === 'line' ? LineChart : type === 'bar' ? BarChart : AreaChart;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComp data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {resolvedSeries.map((s) => (
            <linearGradient key={s.key} id={`mc-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>

        {showGrid && (
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" vertical={false} />
        )}

        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          stroke="var(--text-tertiary)"
          fontSize={11}
          tickFormatter={xTickFormatter}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          stroke="var(--text-tertiary)"
          fontSize={11}
          width={36}
          tickFormatter={yTickFormatter}
        />

        <RTooltip
          cursor={{ stroke: 'var(--brand-primary-glow)', strokeWidth: 1 }}
          formatter={tooltipFormatter}
          contentStyle={{
            background: 'var(--surface-overlay)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            fontSize: 12,
            color: 'var(--text-primary)',
            padding: '8px 12px',
          }}
          labelStyle={{ color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 4 }}
          itemStyle={{ color: 'var(--text-primary)', padding: 0 }}
        />

        {showLegend && (
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
          />
        )}

        {resolvedSeries.map((s) => {
          if (type === 'bar') {
            return <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} />;
          }
          if (type === 'line') {
            return (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            );
          }
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#mc-grad-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          );
        })}
      </ChartComp>
    </ResponsiveContainer>
  );
}
