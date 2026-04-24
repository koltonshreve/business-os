// ─── SnapshotCompare ──────────────────────────────────────────────────────────
// Side-by-side delta view for any two snapshots.
// Computes a fixed set of headline metrics directly from UnifiedBusinessData.

import React, { useState, useMemo } from 'react';
import type { UnifiedBusinessData } from '../../types';

interface PeriodSnapshot {
  id: string;
  label: string;
  data: UnifiedBusinessData;
  createdAt: string;
}

interface Props {
  snapshots: PeriodSnapshot[];
  activeId: string;
  onClose: () => void;
}

// ── Metric computation ────────────────────────────────────────────────────────
function computeMetrics(d: UnifiedBusinessData) {
  const rev   = d.revenue.total;
  const cogs  = d.costs.totalCOGS;
  const opex  = d.costs.totalOpEx;
  const gp    = rev - cogs;
  const ebitda = gp - opex;
  const prevRevs = d.revenue.byPeriod;
  const prevRev  = prevRevs.length >= 2 ? prevRevs[prevRevs.length - 2]?.revenue ?? 0 : 0;
  const revGrowth = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0;
  const gmPct   = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaPct = rev > 0 ? (ebitda / rev) * 100 : 0;
  const retentionRate = (d.customers.retentionRate ?? 0) * 100;
  const headcount = d.operations?.headcount ?? 0;
  const revPerHead = headcount > 0 ? rev / headcount : 0;
  const topCust   = d.customers.topCustomers[0];
  const concentration = topCust?.percentOfTotal ?? 0;

  return {
    rev,
    gp,
    ebitda,
    revGrowth,
    gmPct,
    ebitdaPct,
    retentionRate,
    headcount,
    revPerHead,
    concentration,
    customers: d.customers.totalCount,
    newCustomers: d.customers.newThisPeriod,
    churned: d.customers.churned,
  };
}

type Metrics = ReturnType<typeof computeMetrics>;

const ROWS: {
  key: keyof Metrics;
  label: string;
  fmt: (v: number) => string;
  inverse?: boolean; // lower is better
  unit?: string;
}[] = [
  { key: 'rev',            label: 'Revenue',              fmt: v => fmtDollars(v) },
  { key: 'revGrowth',      label: 'Revenue Growth',       fmt: v => `${v.toFixed(1)}%`,    unit: '%' },
  { key: 'gp',             label: 'Gross Profit',         fmt: v => fmtDollars(v) },
  { key: 'gmPct',          label: 'Gross Margin',         fmt: v => `${v.toFixed(1)}%`,    unit: '%' },
  { key: 'ebitda',         label: 'EBITDA',               fmt: v => fmtDollars(v) },
  { key: 'ebitdaPct',      label: 'EBITDA Margin',        fmt: v => `${v.toFixed(1)}%`,    unit: '%' },
  { key: 'customers',      label: 'Total Customers',      fmt: v => v.toFixed(0) },
  { key: 'newCustomers',   label: 'New Customers',        fmt: v => `+${v.toFixed(0)}` },
  { key: 'churned',        label: 'Churned Customers',    fmt: v => v.toFixed(0), inverse: true },
  { key: 'retentionRate',  label: 'Retention Rate',       fmt: v => `${v.toFixed(1)}%`,    unit: '%' },
  { key: 'headcount',      label: 'Headcount',            fmt: v => v.toFixed(0) },
  { key: 'revPerHead',     label: 'Revenue / Employee',   fmt: v => fmtDollars(v) },
  { key: 'concentration',  label: 'Top Customer Conc.',   fmt: v => `${v.toFixed(1)}%`,    unit: '%', inverse: true },
];

function fmtDollars(n: number): string {
  const abs = Math.abs(n);
  const prefix = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${prefix}$${(abs / 1_000).toFixed(0)}k`;
  return `${prefix}$${abs.toFixed(0)}`;
}

function deltaColor(delta: number, inverse: boolean): string {
  const positive = inverse ? delta < 0 : delta > 0;
  const negative = inverse ? delta > 0 : delta < 0;
  if (positive) return 'text-emerald-400';
  if (negative) return 'text-red-400';
  return 'text-slate-500';
}

export default function SnapshotCompare({ snapshots, activeId, onClose }: Props) {
  const nonDemo = snapshots.filter(s => !['demo','prev-demo'].includes(s.id));
  const all     = snapshots; // include demo for comparison

  const [baseId, setBaseId]   = useState(activeId);
  const [cmpId,  setCmpId]    = useState(() => {
    // Default comparison: the snapshot before the active one
    const idx = all.findIndex(s => s.id === activeId);
    if (idx < all.length - 1) return all[idx + 1]!.id;
    if (idx > 0) return all[idx - 1]!.id;
    return all[0]!.id;
  });

  const baseSnap = all.find(s => s.id === baseId);
  const cmpSnap  = all.find(s => s.id === cmpId);

  const baseM = useMemo(() => baseSnap ? computeMetrics(baseSnap.data) : null, [baseSnap]);
  const cmpM  = useMemo(() => cmpSnap  ? computeMetrics(cmpSnap.data)  : null, [cmpSnap]);

  if (!baseM || !cmpM) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
      <div
        className="relative bg-[#0a0f1a] border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 flex-shrink-0">
          <div>
            <div className="text-[14px] font-semibold text-slate-100">Snapshot Compare</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Side-by-side metric delta</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13"/>
            </svg>
          </button>
        </div>

        {/* Snapshot pickers */}
        <div className="grid grid-cols-2 gap-3 px-5 py-3 border-b border-slate-800/40 flex-shrink-0">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Base</div>
            <select
              value={baseId}
              onChange={e => setBaseId(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/50"
            >
              {all.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Compare to</div>
            <select
              value={cmpId}
              onChange={e => setCmpId(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/50"
            >
              {all.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-[40%]">Metric</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-indigo-400/70 uppercase tracking-wider">
                  {baseSnap?.label ?? 'Base'}
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {cmpSnap?.label ?? 'Compare'}
                </th>
                <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Delta</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => {
                const bv = baseM[row.key] as number;
                const cv = cmpM[row.key] as number;
                const delta = bv - cv;
                const isZero = Math.abs(delta) < 0.001;
                const isDollar = !row.unit;
                const deltaTxt = isZero ? '—' : (delta >= 0 ? '+' : '') + (isDollar ? fmtDollars(delta) : `${delta.toFixed(1)}${row.unit ?? ''}`);
                const cls = isZero ? 'text-slate-600' : deltaColor(delta, row.inverse ?? false);

                return (
                  <tr key={row.key} className={`border-b border-slate-800/30 ${i % 2 === 0 ? '' : 'bg-slate-900/20'} hover:bg-slate-800/20 transition-colors`}>
                    <td className="px-5 py-2.5 text-slate-400 font-medium">{row.label}</td>
                    <td className="px-3 py-2.5 text-right text-slate-100 font-semibold tabular-nums">{row.fmt(bv)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{row.fmt(cv)}</td>
                    <td className={`px-5 py-2.5 text-right font-semibold tabular-nums ${cls}`}>{deltaTxt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-slate-800/40 flex-shrink-0">
          <div className="text-[10px] text-slate-600">Delta = Base minus Compare. Green = Base is better, Red = Base is worse.</div>
        </div>
      </div>
    </div>
  );
}
