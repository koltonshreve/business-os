// ─── SnapshotTrend ────────────────────────────────────────────────────────────
// SVG line chart showing how key metrics evolved across all saved snapshots.
// Reads snapshot list from props (non-demo only when 2+ real snapshots exist).

import React, { useState } from 'react';
import type { UnifiedBusinessData } from '../../types';

interface PeriodSnapshot {
  id: string;
  label: string;
  data: UnifiedBusinessData;
  createdAt: string;
}

interface Props {
  snapshots: PeriodSnapshot[];
}

type MetricKey = 'revenue' | 'grossMargin' | 'ebitdaMargin' | 'customers';

function extractMetric(d: UnifiedBusinessData, key: MetricKey): number {
  const rev  = d.revenue.total;
  const cogs = d.costs.totalCOGS;
  const opex = d.costs.totalOpEx;
  const gp   = rev - cogs;
  switch (key) {
    case 'revenue':     return rev;
    case 'grossMargin': return rev > 0 ? (gp / rev) * 100 : 0;
    case 'ebitdaMargin':return rev > 0 ? ((gp - opex) / rev) * 100 : 0;
    case 'customers':   return d.customers.totalCount;
  }
}

const METRICS: { key: MetricKey; label: string; color: string; format: (v: number) => string; unit: string }[] = [
  { key: 'revenue',      label: 'Revenue',       color: '#6366f1', format: v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}k`, unit: '$' },
  { key: 'grossMargin',  label: 'Gross Margin',  color: '#10b981', format: v => `${v.toFixed(1)}%`, unit: '%' },
  { key: 'ebitdaMargin', label: 'EBITDA Margin', color: '#f59e0b', format: v => `${v.toFixed(1)}%`, unit: '%' },
  { key: 'customers',    label: 'Customers',     color: '#8b5cf6', format: v => v.toFixed(0), unit: '' },
];

// Simple SVG polyline chart
function LineChart({
  points,
  color,
  width,
  height,
  minY,
  maxY,
}: {
  points: number[];
  color: string;
  width: number;
  height: number;
  minY: number;
  maxY: number;
}) {
  if (points.length < 2) return null;
  const range = maxY - minY || 1;
  const pad = 8;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * chartW;
    const y = pad + chartH - ((v - minY) / range) * chartH;
    return [x, y] as [number, number];
  });

  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  // Gradient fill
  const fillId = `fill-${color.replace('#', '')}`;
  const lastPt = coords[coords.length - 1]!;
  const firstPt = coords[0]!;
  const fillPath = `${d} L ${lastPt[0].toFixed(1)} ${(pad + chartH).toFixed(1)} L ${firstPt[0].toFixed(1)} ${(pad + chartH).toFixed(1)} Z`;

  return (
    <g>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${fillId})`}/>
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={color} stroke="#0a0f1a" strokeWidth="1.5"/>
      ))}
    </g>
  );
}

export default function SnapshotTrend({ snapshots }: Props) {
  const [active, setActive] = useState<MetricKey>('revenue');

  // Use only non-demo snapshots in chronological order
  const ordered = [...snapshots]
    .filter(s => !['demo', 'prev-demo'].includes(s.id))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Minimum 2 real snapshots to show the chart
  if (ordered.length < 2) return null;

  const metric = METRICS.find(m => m.key === active)!;
  const values = ordered.map(s => extractMetric(s.data, active));
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const pad = (maxV - minV) * 0.1 || maxV * 0.1 || 1;

  const first = values[0]!;
  const last  = values[values.length - 1]!;
  const delta = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  const deltaPositive = active === 'ebitdaMargin' || active === 'grossMargin' || active === 'revenue' || active === 'customers'
    ? delta > 0
    : delta < 0;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[12px] font-semibold text-slate-100">Snapshot Trend</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{ordered.length} periods · {ordered[0]!.label} → {ordered[ordered.length - 1]!.label}</div>
        </div>

        {/* Metric selector */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700/40 text-[11px]">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap ${active === m.key ? 'text-slate-100 bg-slate-700/60' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 pt-4 pb-2">
        {/* Delta pill */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-[22px] font-bold text-slate-100">{metric.format(last)}</div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            deltaPositive
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : delta < 0
              ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : 'text-slate-500 bg-slate-800 border-slate-700/50'
          }`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% overall
          </span>
          <span className="text-[10px] text-slate-600">from {metric.format(first)}</span>
        </div>

        <svg width="100%" height="120" viewBox={`0 0 600 120`} preserveAspectRatio="none">
          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75].map(t => (
            <line
              key={t}
              x1="8" y1={8 + (1 - t) * 104}
              x2="592" y2={8 + (1 - t) * 104}
              stroke="#1e293b" strokeWidth="1"
            />
          ))}
          <LineChart
            points={values}
            color={metric.color}
            width={600}
            height={120}
            minY={minV - pad}
            maxY={maxV + pad}
          />
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1 px-2">
          {ordered.map((s, i) => (
            <div key={s.id} className="text-[9px] text-slate-600 text-center" style={{ flex: 1, minWidth: 0 }}>
              <div className="truncate">{s.label}</div>
              <div className="text-slate-700">{metric.format(values[i]!)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
