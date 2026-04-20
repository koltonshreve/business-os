import { useState } from 'react';
import type { UnifiedBusinessData, KPIDashboard, CashFlowPeriod, ARAgingBucket, Budget } from '../../types';
import PLWaterfall from '../charts/PLWaterfall';
import MarginTrendChart from '../charts/MarginTrendChart';
import RevenueChart from '../charts/RevenueChart';
import PLStatement from '../PLStatement';
import BudgetPanel from './BudgetPanel';
import IndustryBenchmarksPanel from './IndustryBenchmarksPanel';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  dashboard: KPIDashboard | null;
  budget: Budget;
  onSetBudget: (key: keyof Budget, value: Budget[keyof Budget]) => void;
  annotations?: Record<string, string>;
  onAnnotate?: (period: string, note: string) => void;
  onAskAI?: (msg: string) => void;
}

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
};

const pctFmt = (n: number) => `${n.toFixed(1)}%`;

// ── Cash Flow Panel ────────────────────────────────────────────────────────────
function CashFlowPanel({ periods, onAskAI }: { periods: CashFlowPeriod[]; onAskAI?: (msg: string) => void }) {
  const latest = periods[periods.length - 1];
  const avgNetFlow = periods.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / Math.max(periods.length, 1);
  const isBurning = avgNetFlow < 0;
  const runway = isBurning && latest ? Math.abs(latest.closingBalance / avgNetFlow) : null;

  const chartData = periods.map(p => ({
    period: p.period,
    opening: p.openingBalance,
    closing: p.closingBalance,
    net: p.netCashFlow ?? (p.closingBalance - p.openingBalance),
  }));

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Current Cash',    value: fmt(latest?.closingBalance ?? 0), color: 'text-emerald-400' },
          { label: 'Avg Monthly Net', value: `${avgNetFlow >= 0 ? '+' : ''}${fmt(avgNetFlow)}`, color: avgNetFlow >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Cash Runway',     value: runway ? `${runway.toFixed(1)} mo` : '—', color: !runway ? 'text-emerald-400' : runway > 12 ? 'text-emerald-400' : runway > 6 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Periods Tracked', value: periods.length.toString(), color: 'text-slate-300' },
        ].map(m => (
          <div key={m.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{m.label}</div>
            <div className={`text-[18px] font-bold tracking-tight ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Cash balance chart */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-semibold text-slate-100">Cash Balance Trend</div>
          {onAskAI && (
            <button onClick={() => onAskAI(`My cash flow: current balance ${fmt(latest?.closingBalance ?? 0)}, average monthly net ${fmt(avgNetFlow)}. ${isBurning ? `Cash runway ~${runway?.toFixed(1)} months.` : 'Cash flow positive.'} What should I be doing with my cash position?`)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
              Ask AI
            </button>
          )}
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={24}>
              <XAxis dataKey="period" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false}/>
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`}/>
              <Tooltip
                contentStyle={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [fmt(v)]}
              />
              <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.net >= 0 ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-center text-[10px] text-slate-600">Net cash flow by period (green = inflow, red = outflow)</div>
      </div>

      {/* Period table */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-800/50 bg-[#060a12]/95 backdrop-blur-sm">
              {['Period','Opening Balance','Receipts','Payments','Closing Balance','Net Flow'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => {
              const net = p.netCashFlow ?? (p.closingBalance - p.openingBalance);
              return (
                <tr key={i} className={`border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors ${i % 2 === 1 ? 'bg-slate-900/20' : ''}`}>
                  <td className="px-4 py-3 text-xs font-medium text-slate-200">{p.period}</td>
                  <td className="px-4 py-3 text-xs text-slate-300 font-mono tabular-nums">{fmt(p.openingBalance)}</td>
                  <td className="px-4 py-3 text-xs text-emerald-400 font-mono tabular-nums">{fmt(p.receipts)}</td>
                  <td className="px-4 py-3 text-xs text-red-400 font-mono tabular-nums">({fmt(p.payments)})</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-100 font-mono tabular-nums">{fmt(p.closingBalance)}</td>
                  <td className={`px-4 py-3 text-xs font-medium font-mono tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {net >= 0 ? '+' : ''}{fmt(net)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── P&L Bridge (period-over-period EBITDA waterfall) ──────────────────────────
function PLBridge({ data, previousData }: { data: UnifiedBusinessData; previousData: UnifiedBusinessData }) {
  const curRev    = data.revenue.total;
  const curCOGS   = data.costs.totalCOGS;
  const curOpEx   = data.costs.totalOpEx;
  const curEBITDA = curRev - curCOGS - curOpEx;

  const prevRev    = previousData.revenue.total;
  const prevCOGS   = previousData.costs.totalCOGS;
  const prevOpEx   = previousData.costs.totalOpEx;
  const prevEBITDA = prevRev - prevCOGS - prevOpEx;

  const netChange = curEBITDA - prevEBITDA;

  // Bridge components: positive = good
  const revVar  = curRev - prevRev;                // positive = favorable
  const cogsVar = prevCOGS - curCOGS;             // positive = good (COGS reduced)
  const opexVar = prevOpEx - curOpEx;             // positive = good (OpEx reduced)

  const fmt2 = (n: number) => { const abs = Math.abs(n); return abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; };
  const fmtSgn = (n: number) => `${n >= 0 ? '+' : '−'}${fmt2(n)}`;

  // SVG waterfall
  const W = 560; const H = 160; const padL = 8; const padR = 8; const padT = 20; const padB = 36;
  const chartH = H - padT - padB;

  const segments = [
    { id: 'prior',   label: 'Prior EBITDA', value: prevEBITDA, type: 'anchor' as const },
    { id: 'rev',     label: 'Revenue',       value: revVar,     type: 'bridge' as const },
    { id: 'cogs',    label: 'COGS',          value: cogsVar,    type: 'bridge' as const },
    { id: 'opex',    label: 'OpEx',          value: opexVar,    type: 'bridge' as const },
    { id: 'current', label: 'EBITDA Now',    value: curEBITDA,  type: 'anchor' as const },
  ];

  const allValues = [prevEBITDA, curEBITDA];
  let rt = prevEBITDA;
  for (const s of segments.slice(1, -1)) { rt += Math.max(s.value, 0); allValues.push(rt); }
  let rb = prevEBITDA;
  for (const s of segments.slice(1, -1)) { rb += Math.min(s.value, 0); allValues.push(rb); }

  const minVal = Math.min(...allValues, 0);
  const maxVal = Math.max(...allValues, 0);
  const range  = Math.max(maxVal - minVal, 1);
  const scale  = (v: number) => ((maxVal - v) / range) * chartH;
  const zeroY  = padT + scale(0);

  const n = segments.length;
  const barW = Math.floor((W - padL - padR) / n) - 6;
  const gap  = Math.floor((W - padL - padR - barW * n) / (n - 1));

  const bars: { x: number; y: number; h: number; color: string; label: string; value: number; type: string }[] = [];
  let baseline = prevEBITDA;

  segments.forEach((seg, i) => {
    const x = padL + i * (barW + gap);
    if (seg.type === 'anchor') {
      const yTop = padT + scale(Math.max(seg.value, 0));
      const yBot = padT + scale(Math.min(seg.value, 0));
      const barH = Math.max(Math.abs(yBot - yTop), 2);
      const color = i === 0
        ? 'rgba(99,102,241,0.7)'
        : seg.value >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.65)';
      bars.push({ x, y: Math.min(yTop, yBot), h: barH, color, label: seg.label, value: seg.value, type: 'anchor' });
    } else {
      const from = baseline;
      const to   = baseline + seg.value;
      const yTop = padT + scale(Math.max(from, to));
      const yBot = padT + scale(Math.min(from, to));
      const barH = Math.max(Math.abs(yBot - yTop), 2);
      const color = seg.value >= 0 ? 'rgba(16,185,129,0.65)' : 'rgba(239,68,68,0.60)';
      bars.push({ x, y: yTop, h: barH, color, label: seg.label, value: seg.value, type: 'bridge' });
      baseline = to;
    }
  });

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">What drove the change in EBITDA this period?</div>
          <div className="text-[12px] mt-0.5">
            <span className="text-slate-400">Net change: </span>
            <span className={`font-bold ${netChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netChange >= 0 ? '+' : ''}{fmt(netChange)} ({netChange >= 0 ? '+' : ''}{prevEBITDA !== 0 ? ((netChange / Math.abs(prevEBITDA)) * 100).toFixed(1) : '0'}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/65"/><span className="text-slate-500">Favorable</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/60"/><span className="text-slate-500">Unfavorable</span></div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {zeroY > padT && zeroY < H - padB && (
          <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY}
            stroke="rgba(148,163,184,0.15)" strokeWidth="1" strokeDasharray="4 3"/>
        )}
        {bars.map((bar, i) => (
          <g key={i}>
            {bar.type === 'anchor' && i === 0 && bars[1] && (
              <line x1={bar.x + barW} y1={bar.y} x2={bars[1].x} y2={bar.y}
                stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="3 2"/>
            )}
            {bar.type === 'bridge' && bars[i + 1] && (
              <line x1={bar.x + barW}
                y1={bars[i].value >= 0 ? bar.y : bar.y + bar.h}
                x2={bars[i + 1].x}
                y2={bars[i].value >= 0 ? bar.y : bar.y + bar.h}
                stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="3 2"/>
            )}
            <rect x={bar.x} y={bar.y} width={barW} height={bar.h} rx="3" fill={bar.color}/>
            <text x={bar.x + barW / 2} y={bar.y - 5}
              textAnchor="middle"
              fill={bar.type === 'anchor' ? (bar.value >= 0 ? '#34d399' : '#f87171') : (bar.value >= 0 ? '#34d399' : '#f87171')}
              fontSize="10" fontWeight="600" className="font-mono">
              {bar.type === 'anchor' ? fmt2(bar.value) : fmtSgn(bar.value)}
            </text>
            <text x={bar.x + barW / 2} y={H - padB + 14}
              textAnchor="middle" fill="#64748b" fontSize="10">{bar.label}</text>
          </g>
        ))}
      </svg>

      <div className="mt-2 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-4 text-center">
        {[
          { label: 'Prior EBITDA',  value: fmt2(prevEBITDA),         color: 'text-indigo-400' },
          { label: 'Net Change',    value: (netChange >= 0 ? '+' : '') + fmt2(netChange), color: netChange >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Current EBITDA', value: fmt2(curEBITDA),          color: curEBITDA >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(s => (
          <div key={s.label}>
            <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-[0.08em] mb-0.5">{s.label}</div>
            <div className={`text-[14px] font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AR Aging Panel ─────────────────────────────────────────────────────────────
function ARAgingPanel({ buckets, revenue, onAskAI }: { buckets: ARAgingBucket[]; revenue: number; onAskAI?: (msg: string) => void }) {
  const totalAR     = buckets.reduce((s, b) => s + b.total, 0);
  const totalCurrent = buckets.reduce((s, b) => s + b.current, 0);
  const total30     = buckets.reduce((s, b) => s + b.days30, 0);
  const total60     = buckets.reduce((s, b) => s + b.days60, 0);
  const total90     = buckets.reduce((s, b) => s + b.days90, 0);
  const totalOver90 = buckets.reduce((s, b) => s + b.over90, 0);
  const pastDue     = total30 + total60 + total90 + totalOver90;
  const riskAR      = total60 + total90 + totalOver90; // 60+ days is collection risk

  // DSO = (Total AR / Revenue) × 30
  const dso = revenue > 0 ? (totalAR / revenue) * 30 : null;
  const dsoColor = dso == null ? 'text-slate-400'
    : dso < 30 ? 'text-emerald-400'
    : dso <= 45 ? 'text-amber-400'
    : 'text-red-400';
  const dsoStatus = dso == null ? 'No revenue data'
    : dso < 30 ? 'Healthy collections pace'
    : dso <= 45 ? 'Monitor — approaching risk threshold'
    : 'Elevated — collections risk';

  const ageSummary = [
    { label: 'Current',  value: totalCurrent, pct: totalAR > 0 ? (totalCurrent/totalAR)*100 : 0, color: 'bg-emerald-500/50', textColor: 'text-emerald-400' },
    { label: '1–30 days',value: total30,       pct: totalAR > 0 ? (total30/totalAR)*100 : 0,      color: 'bg-amber-500/50',   textColor: 'text-amber-400' },
    { label: '31–60 days',value: total60,      pct: totalAR > 0 ? (total60/totalAR)*100 : 0,      color: 'bg-orange-500/50',  textColor: 'text-orange-400' },
    { label: '61–90 days',value: total90,      pct: totalAR > 0 ? (total90/totalAR)*100 : 0,      color: 'bg-red-500/50',     textColor: 'text-red-400' },
    { label: '90+ days', value: totalOver90,   pct: totalAR > 0 ? (totalOver90/totalAR)*100 : 0,  color: 'bg-red-700/50',     textColor: 'text-red-500' },
  ];

  return (
    <div className="space-y-4">
      {/* DSO insight one-liner */}
      {dso !== null && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${dso < 30 ? 'bg-emerald-500/5 border-emerald-500/20' : dso <= 45 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <div className={`text-[22px] font-bold tracking-tight ${dsoColor}`}>{dso.toFixed(0)}d</div>
          <div>
            <div className={`text-[12px] font-semibold ${dsoColor}`}>DSO — Days Sales Outstanding</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Collections taking {dso.toFixed(0)} days on average. Benchmark: 30–35 days for professional services.
            </div>
          </div>
        </div>
      )}

      {/* AR KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Days Sales Outstanding', value: dso != null ? `${dso.toFixed(0)} days` : '—', color: dsoColor },
          { label: 'Total AR',       value: fmt(totalAR),   color: 'text-slate-100' },
          { label: '% Current',      value: totalAR > 0 ? `${((totalCurrent/totalAR)*100).toFixed(1)}%` : '—', color: 'text-emerald-400' },
          { label: 'Past Due',       value: fmt(pastDue),   color: pastDue / Math.max(totalAR, 1) > 0.3 ? 'text-red-400' : 'text-amber-400' },
          { label: 'At Risk (60d+)', value: fmt(riskAR),    color: riskAR > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{m.label}</div>
            <div className={`text-[18px] font-bold tracking-tight ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Aging bar */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-semibold text-slate-100">AR Aging Breakdown</div>
          {onAskAI && (
            <button onClick={() => onAskAI(`My AR aging: total ${fmt(totalAR)}, ${((totalCurrent/Math.max(totalAR,1))*100).toFixed(0)}% current, ${fmt(riskAR)} is 60+ days past due. What collection actions should I prioritize?`)}
              className="text-[11px] text-orange-400 hover:text-orange-300 font-medium flex items-center gap-1">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
              Ask AI
            </button>
          )}
        </div>

        {/* Stacked bar */}
        <div className="flex h-4 rounded-lg overflow-hidden mb-4 gap-px">
          {ageSummary.filter(a => a.value > 0).map(a => (
            <div key={a.label} className={`${a.color} transition-all`} style={{ width: `${a.pct}%` }} title={`${a.label}: ${fmt(a.value)}`}/>
          ))}
        </div>

        <div className="space-y-2">
          {ageSummary.map(a => (
            <div key={a.label} className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${a.color}`}/>
              <div className="flex-1 text-[12px] text-slate-300">{a.label}</div>
              <div className={`text-[12px] font-medium w-24 text-right ${a.textColor}`}>{fmt(a.value)}</div>
              <div className="text-[11px] text-slate-600 w-10 text-right">{a.pct.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer AR table */}
      {buckets.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/50">
            <div className="text-[13px] font-semibold text-slate-100">AR by Customer</div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-800/40 bg-[#060a12]/95 backdrop-blur-sm">
                {['Customer','Current','1–30','31–60','61–90','90+','Total'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-right first:text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.sort((a, b) => b.total - a.total).map((b, i) => (
                <tr key={i} className={`border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors ${i % 2 === 1 ? 'bg-slate-900/20' : ''}`}>
                  <td className="px-4 py-3 text-xs font-medium text-slate-200">{b.customer}</td>
                  <td className="px-4 py-3 text-xs text-right text-emerald-400/80 font-mono tabular-nums">{b.current > 0 ? fmt(b.current) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-right text-amber-400/80 font-mono tabular-nums">{b.days30 > 0 ? fmt(b.days30) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-right text-orange-400/80 font-mono tabular-nums">{b.days60 > 0 ? fmt(b.days60) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-right text-red-400/80 font-mono tabular-nums">{b.days90 > 0 ? fmt(b.days90) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-right text-red-500/80 font-medium font-mono tabular-nums">{b.over90 > 0 ? fmt(b.over90) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-right font-semibold text-slate-100 font-mono tabular-nums">{fmt(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, pct, indent = false, bold = false, border = false }: {
  label: string; value: string; pct?: string; indent?: boolean; bold?: boolean; border?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 py-1.5 ${border ? 'border-t border-slate-800/60 mt-1 pt-2.5' : ''}`}>
      <div className={`flex-1 text-[12px] ${indent ? 'pl-4 text-slate-400' : bold ? 'text-slate-100 font-semibold' : 'text-slate-300'}`}>
        {indent && <span className="text-slate-700 mr-1.5">—</span>}
        {label}
      </div>
      <div className={`text-[12px] font-medium w-20 text-right ${bold ? 'text-slate-100' : 'text-slate-300'}`}>{value}</div>
      {pct !== undefined && (
        <div className="text-[11px] text-slate-500 w-12 text-right">{pct}</div>
      )}
    </div>
  );
}

// ── P&L comparison table ───────────────────────────────────────────────────────
function PLComparison({ data, previousData }: { data: UnifiedBusinessData; previousData: UnifiedBusinessData }) {
  const fmtAmt = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };
  const fmtDelta = (n: number) => (n >= 0 ? '+' : '') + fmtAmt(n);
  const fmtPct   = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  const curRev   = data.revenue.total;
  const curCOGS  = data.costs.totalCOGS;
  const curOpEx  = data.costs.totalOpEx;
  const curGP    = curRev - curCOGS;
  const curEBITDA= curGP - curOpEx;

  const prevRev   = previousData.revenue.total;
  const prevCOGS  = previousData.costs.totalCOGS;
  const prevOpEx  = previousData.costs.totalOpEx;
  const prevGP    = prevRev - prevCOGS;
  const prevEBITDA= prevGP - prevOpEx;

  const chg = (cur: number, prev: number) => cur - prev;
  const chgPct = (cur: number, prev: number) => prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0;

  const rows = [
    { label: 'Revenue',         cur: curRev,    prev: prevRev,    bold: true,      highlight: 'none' as const },
    { label: 'Cost of Goods',   cur: -curCOGS,  prev: -prevCOGS,  bold: false,     highlight: 'cost' as const },
    { label: 'Gross Profit',    cur: curGP,     prev: prevGP,     bold: true,      highlight: 'gp' as const,   separator: true },
    { label: 'Operating Exp.',  cur: -curOpEx,  prev: -prevOpEx,  bold: false,     highlight: 'cost' as const },
    { label: 'EBITDA',          cur: curEBITDA, prev: prevEBITDA, bold: true,      highlight: 'ebitda' as const, separator: true },
  ];

  const curGPMargin     = curRev > 0 ? (curGP/curRev)*100 : 0;
  const prevGPMargin    = prevRev > 0 ? (prevGP/prevRev)*100 : 0;
  const curEBITDAMargin = curRev > 0 ? (curEBITDA/curRev)*100 : 0;
  const prevEBITDAMargin= prevRev > 0 ? (prevEBITDA/prevRev)*100 : 0;

  const marginRows = [
    { label: 'Gross Margin',   cur: curGPMargin,     prev: prevGPMargin,     isMargin: true },
    { label: 'EBITDA Margin',  cur: curEBITDAMargin, prev: prevEBITDAMargin, isMargin: true },
    { label: 'COGS %',         cur: curRev > 0 ? (curCOGS/curRev)*100 : 0, prev: prevRev > 0 ? (prevCOGS/prevRev)*100 : 0, isMargin: true, inverse: true },
  ];

  return (
    <div className="font-mono text-[12px] overflow-x-auto">
      {/* Headers */}
      <div className="grid grid-cols-[1fr_90px_90px_80px_70px] gap-2 pb-2 mb-2 border-b border-slate-800/60 min-w-[430px]">
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Line Item</div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] text-right">Current</div>
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Prior</div>
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Δ $</div>
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Δ %</div>
      </div>

      <div className="space-y-0.5">
        {rows.map(r => {
          const delta = chg(r.cur, r.prev);
          const dpct  = chgPct(r.cur, r.prev);
          const isNeg = r.cur < 0;
          const dispCur  = isNeg ? `(${fmtAmt(Math.abs(r.cur))})` : fmtAmt(r.cur);
          const dispPrev = r.prev < 0 ? `(${fmtAmt(Math.abs(r.prev))})` : fmtAmt(r.prev);

          // Color: for costs (negative), improvement is negative delta
          const isCost = r.highlight === 'cost';
          const deltaGood = isCost ? delta <= 0 : delta > 0;
          const deltaCls = delta === 0 ? 'text-slate-600' : deltaGood ? 'text-emerald-400' : 'text-red-400';

          const valColor = r.highlight === 'ebitda'
            ? (r.cur > 0 ? 'text-emerald-400' : 'text-red-400')
            : r.highlight === 'gp'
            ? (r.cur > 0 ? 'text-emerald-400' : 'text-red-400')
            : r.highlight === 'cost' ? 'text-red-400/80'
            : 'text-slate-200';

          return (
            <div key={r.label}>
              {r.separator && <div className="h-px bg-slate-800/60 my-1.5"/>}
              <div className={`grid grid-cols-[1fr_90px_90px_80px_70px] gap-2 py-1 rounded min-w-[430px] ${r.bold ? '' : ''}`}>
                <div className={`truncate ${r.bold ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>{r.label}</div>
                <div className={`text-right tabular-nums ${r.bold ? 'font-bold ' + valColor : valColor}`}>{dispCur}</div>
                <div className="text-right text-slate-600 tabular-nums">{dispPrev}</div>
                <div className={`text-right tabular-nums font-medium ${deltaCls}`}>{fmtDelta(delta)}</div>
                <div className={`text-right tabular-nums text-[11px] font-medium ${deltaCls}`}>{fmtPct(dpct)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Margin comparison */}
      <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-1">
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Margins</div>
        {marginRows.map(r => {
          const delta = r.cur - r.prev;
          const isCost = r.inverse;
          const deltaGood = isCost ? delta < 0 : delta > 0;
          const deltaCls = Math.abs(delta) < 0.1 ? 'text-slate-600' : deltaGood ? 'text-emerald-400' : 'text-red-400';
          return (
            <div key={r.label} className="grid grid-cols-[1fr_90px_90px_80px_70px] gap-2 py-0.5 min-w-[430px]">
              <div className="text-slate-500">{r.label}</div>
              <div className="text-right font-medium text-slate-200 tabular-nums">{r.cur.toFixed(1)}%</div>
              <div className="text-right text-slate-600 tabular-nums">{r.prev.toFixed(1)}%</div>
              <div className="text-right text-slate-600 tabular-nums text-[11px]">{delta >= 0 ? '+' : ''}{delta.toFixed(1)}pp</div>
              <div/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Working Capital Panel ──────────────────────────────────────────────────────
function WorkingCapitalPanel({ data, onAskAI }: { data: UnifiedBusinessData; onAskAI?: (msg: string) => void }) {
  const rev         = data.revenue.total;
  const periodCount = Math.max(data.revenue.byPeriod.length, 1);
  const monthlyRev  = rev / periodCount;

  const hasAR = data.arAging && data.arAging.length > 0;
  const totalAR     = hasAR ? data.arAging!.reduce((s, b) => s + b.total, 0) : null;
  const currentAR   = hasAR ? data.arAging!.reduce((s, b) => s + b.current, 0) : null;

  // DSO = (AR / Monthly Revenue) × 30
  const dso = totalAR != null && monthlyRev > 0
    ? (totalAR / monthlyRev) * 30 : null;

  // AR Turnover (annualized) = Annual Revenue / AR
  const annualRev = rev * (12 / periodCount);
  const arTurnover = totalAR != null && totalAR > 0
    ? annualRev / totalAR : null;

  // Collection efficiency = current AR / total AR
  const collectionEff = totalAR != null && totalAR > 0 && currentAR != null
    ? (currentAR / totalAR) * 100 : null;

  // Past-due rate
  const pastDueAR = hasAR
    ? data.arAging!.reduce((s, b) => s + b.days30 + b.days60 + b.days90 + b.over90, 0) : null;
  const pastDuePct = totalAR != null && totalAR > 0 && pastDueAR != null
    ? (pastDueAR / totalAR) * 100 : null;

  // Operating cash ratio from cash flow
  const hasCF = data.cashFlow && data.cashFlow.length > 0;
  const latestCash = hasCF
    ? data.cashFlow![data.cashFlow!.length - 1].closingBalance : null;
  const opCashRatio = latestCash != null && totalAR != null && totalAR > 0
    ? latestCash / totalAR : null;

  const dsoStatus = dso == null ? 'neutral'
    : dso <= 30 ? 'green' : dso <= 45 ? 'amber' : 'red';
  const dsoColor = dsoStatus === 'green' ? 'text-emerald-400'
    : dsoStatus === 'amber' ? 'text-amber-400' : 'text-red-400';

  const metrics = [
    {
      label: 'Days Sales Outstanding',
      value: dso != null ? `${dso.toFixed(0)} days` : '—',
      sub: dso != null ? (dso <= 30 ? 'Healthy' : dso <= 45 ? 'Monitor closely' : 'Elevated — collections risk') : 'Needs AR data',
      color: dso != null ? dsoColor : 'text-slate-500',
      show: true,
    },
    {
      label: 'AR Turnover',
      value: arTurnover != null ? `${arTurnover.toFixed(1)}×` : '—',
      sub: arTurnover != null ? `${(365 / arTurnover).toFixed(0)}-day average collection` : 'Needs AR data',
      color: arTurnover != null ? (arTurnover >= 8 ? 'text-emerald-400' : arTurnover >= 5 ? 'text-amber-400' : 'text-red-400') : 'text-slate-500',
      show: true,
    },
    {
      label: 'Collection Efficiency',
      value: collectionEff != null ? `${collectionEff.toFixed(1)}%` : '—',
      sub: collectionEff != null ? `${pastDuePct?.toFixed(1) ?? 0}% past due` : 'Needs AR data',
      color: collectionEff != null ? (collectionEff >= 80 ? 'text-emerald-400' : collectionEff >= 60 ? 'text-amber-400' : 'text-red-400') : 'text-slate-500',
      show: true,
    },
    {
      label: 'Cash-to-AR Ratio',
      value: opCashRatio != null ? `${opCashRatio.toFixed(2)}×` : '—',
      sub: opCashRatio != null
        ? (opCashRatio >= 1 ? 'Cash covers all AR' : 'AR exceeds cash balance')
        : hasAR ? 'Needs cash flow data' : 'Needs AR + cash data',
      color: opCashRatio != null ? (opCashRatio >= 1 ? 'text-emerald-400' : opCashRatio >= 0.5 ? 'text-amber-400' : 'text-red-400') : 'text-slate-500',
      show: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{m.label}</div>
            <div className={`text-[20px] font-bold tracking-tight ${m.color}`}>{m.value}</div>
            <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* AR aging breakdown mini-view */}
      {hasAR && totalAR != null && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-semibold text-slate-200">AR Aging Distribution</div>
            {onAskAI && dso != null && (
              <button
                onClick={() => onAskAI(
                  `My DSO is ${dso.toFixed(0)} days, AR turnover is ${arTurnover?.toFixed(1)}×, ` +
                  `${collectionEff?.toFixed(1)}% of AR is current, ${pastDuePct?.toFixed(1)}% is past due. ` +
                  `What are the best actions to improve collections and reduce DSO?`
                )}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
              >
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                  <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                  <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                </svg>
                Ask AI
              </button>
            )}
          </div>
          {(() => {
            const total = totalAR;
            const bands = [
              { label: 'Current',   val: data.arAging!.reduce((s,b)=>s+b.current,0), color: 'bg-emerald-500/50', text: 'text-emerald-400' },
              { label: '1–30 days', val: data.arAging!.reduce((s,b)=>s+b.days30,0),  color: 'bg-amber-500/50',   text: 'text-amber-400'   },
              { label: '31–60',     val: data.arAging!.reduce((s,b)=>s+b.days60,0),  color: 'bg-orange-500/50',  text: 'text-orange-400'  },
              { label: '61–90',     val: data.arAging!.reduce((s,b)=>s+b.days90,0),  color: 'bg-red-500/50',     text: 'text-red-400'     },
              { label: '90+',       val: data.arAging!.reduce((s,b)=>s+b.over90,0),  color: 'bg-red-700/60',     text: 'text-red-500'     },
            ].filter(b => b.val > 0);

            return (
              <>
                <div className="flex h-3 rounded-lg overflow-hidden gap-px mb-3">
                  {bands.map(b => (
                    <div key={b.label} className={`${b.color}`} style={{ width: `${(b.val/total)*100}%` }}
                      title={`${b.label}: ${fmt(b.val)} (${((b.val/total)*100).toFixed(1)}%)`}/>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {bands.map(b => (
                    <div key={b.label} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-sm ${b.color}`}/>
                      <span className="text-[11px] text-slate-500">{b.label}</span>
                      <span className={`text-[11px] font-medium ${b.text}`}>{((b.val/total)*100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {!hasAR && (
        <div className="bg-cyan-500/4 border border-cyan-500/15 rounded-xl p-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 text-lg">⚡</div>
          <div>
            <div className="text-[13px] font-semibold text-slate-200 mb-0.5">Upload AR Aging to unlock</div>
            <div className="text-[12px] text-slate-500">DSO, AR turnover, collection efficiency, and cash-to-AR ratio all require AR aging data. Upload a CSV from your accounting system in Data Sources.</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FinancialDashboard({ data, previousData, dashboard, budget, onSetBudget, annotations, onAnnotate, onAskAI }: Props) {
  const [showComparison, setShowComparison] = useState(false);
  const hasCashFlow = data.cashFlow && data.cashFlow.length > 0;
  const hasARaging  = data.arAging && data.arAging.length > 0;
  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const gp     = rev - cogs;
  const ebitda = gp - opex;

  const prevRev    = previousData?.revenue.total ?? 0;
  const prevCOGS   = previousData?.costs.totalCOGS ?? 0;
  const prevOpEx   = previousData?.costs.totalOpEx ?? 0;
  const prevGP     = prevRev - prevCOGS;
  const prevEBITDA = prevGP - prevOpEx;

  const chg = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0;

  const gpMargin     = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaMargin = rev > 0 ? (ebitda / rev) * 100 : 0;
  const cogsMargin   = rev > 0 ? (cogs / rev) * 100 : 0;
  const opexMargin   = rev > 0 ? (opex / rev) * 100 : 0;

  const prevGPMargin     = prevRev > 0 ? (prevGP / prevRev) * 100 : 0;
  const prevEBITDAMargin = prevRev > 0 ? (prevEBITDA / prevRev) * 100 : 0;

  const periodCount = data.revenue.byPeriod.length || 1;
  const runRate = Math.round((rev / periodCount) * 12); // annualized from monthly data

  // ── LTM (Last Twelve Months) / annualized metrics ──
  const byPeriod = data.revenue.byPeriod;
  const ltmPeriods = byPeriod.slice(-12);
  const ltmCount = Math.max(ltmPeriods.length, 1);
  const ltmRevRaw  = ltmPeriods.reduce((s, p) => s + p.revenue, 0);
  const ltmCOGSRaw = ltmPeriods.reduce((s, p) => s + (p.cogs ?? 0), 0);
  const ltmGPRaw   = ltmRevRaw - ltmCOGSRaw;
  // Annualize if fewer than 12 periods
  const annFactor = ltmCount < 12 ? 12 / ltmCount : 1;
  const ltmRev    = Math.round(ltmRevRaw * annFactor);
  const ltmGP     = Math.round(ltmGPRaw * annFactor);
  const ltmGPM    = ltmRev > 0 ? (ltmGP / ltmRev) * 100 : 0;
  // Annualized EBITDA: use period EBITDA if available, else derive from cost ratio
  const ltmEBITDARaw = ltmPeriods.reduce((s, p) => s + (p.ebitda ?? 0), 0);
  const hasEBITDAInPeriods = ltmPeriods.some(p => p.ebitda != null);
  const ebitdaMarginForLTM = rev > 0 ? ebitda / rev : 0;
  const ltmEBITDA = hasEBITDAInPeriods
    ? Math.round(ltmEBITDARaw * annFactor)
    : Math.round(ltmRev * ebitdaMarginForLTM);
  const ltmEBITDAM = ltmRev > 0 ? (ltmEBITDA / ltmRev) * 100 : 0;
  const isLTM = ltmCount >= 12;
  const ltmLabel = isLTM ? 'LTM' : `Ann. (${ltmCount}mo)`;

  // ── Recurring revenue ──
  const recurringRev = data.revenue.recurring ?? 0;
  const oneTimeRev   = data.revenue.oneTime ?? 0;
  const hasRecurring = recurringRev > 0 || oneTimeRev > 0;
  const recurringPct = rev > 0 && recurringRev > 0 ? (recurringRev / rev) * 100 : 0;
  const mrr = recurringRev > 0 ? recurringRev / 12 : 0;

  const summaryKPIs = [
    { label: 'Revenue',       value: fmt(rev),           change: prevRev ? chg(rev, prevRev) : undefined,       color: 'text-slate-100' },
    { label: 'Gross Profit',  value: fmt(gp),            change: prevGP ? chg(gp, prevGP) : undefined,          color: gp > 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'GM %',          value: pctFmt(gpMargin),   change: prevGPMargin ? gpMargin - prevGPMargin : undefined, color: gpMargin >= 40 ? 'text-emerald-400' : gpMargin >= 25 ? 'text-amber-400' : 'text-red-400' },
    { label: 'EBITDA',        value: fmt(ebitda),        change: prevEBITDA ? chg(ebitda, prevEBITDA) : undefined,  color: ebitda > 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'EBITDA %',      value: pctFmt(ebitdaMargin), change: prevEBITDAMargin ? ebitdaMargin - prevEBITDAMargin : undefined, color: ebitdaMargin >= 15 ? 'text-emerald-400' : ebitdaMargin >= 8 ? 'text-amber-400' : 'text-red-400' },
  ];

  return (
    <div className="space-y-5">
      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {summaryKPIs.map(kpi => (
          <div key={kpi.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{kpi.label}</div>
            <div className={`text-[20px] font-bold tracking-tight ${kpi.color}`}>{kpi.value}</div>
            {kpi.change !== undefined && (
              <div className={`text-[11px] mt-1 font-medium ${kpi.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.change >= 0 ? '↑' : '↓'} {Math.abs(kpi.change).toFixed(1)}% vs prior
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rule-based financial insights */}
      {(() => {
        const insights: { icon: string; text: string; color: string }[] = [];

        // 1. EBITDA margin vs benchmark
        const ebitdaGap = ebitdaMargin - 14;
        insights.push(ebitdaGap >= 4
          ? { icon: '◆', text: `EBITDA margin ${ebitdaMargin.toFixed(1)}% — ${ebitdaGap.toFixed(1)}pp above LMM 14% median`, color: 'text-emerald-400' }
          : ebitdaGap >= 0
          ? { icon: '◆', text: `EBITDA margin ${ebitdaMargin.toFixed(1)}% — at LMM median, ${(18 - ebitdaMargin).toFixed(1)}pp from "strong" threshold of 18%`, color: 'text-sky-400' }
          : { icon: '◆', text: `EBITDA margin ${ebitdaMargin.toFixed(1)}% — ${Math.abs(ebitdaGap).toFixed(1)}pp below LMM 14% median; ${fmt(Math.abs(ebitdaGap / 100 * rev))} EBITDA gap`, color: 'text-amber-400' }
        );

        // 2. Biggest cost driver
        if (data.costs.byCategory.length > 0) {
          const biggest = [...data.costs.byCategory].sort((a, b) => b.amount - a.amount)[0];
          insights.push({
            icon: '▲',
            text: `Largest cost driver: ${biggest.category} at ${fmt(biggest.amount)} (${biggest.percentOfRevenue.toFixed(1)}% of revenue)`,
            color: biggest.percentOfRevenue > 25 ? 'text-amber-400' : 'text-slate-400',
          });
        }

        // 3. Gross margin trend over periods
        const periodsWithCOGS = data.revenue.byPeriod.filter(p => p.cogs != null && p.cogs > 0);
        if (periodsWithCOGS.length >= 2) {
          const firstGM = ((periodsWithCOGS[0].revenue - periodsWithCOGS[0].cogs!) / periodsWithCOGS[0].revenue) * 100;
          const lastGM  = ((periodsWithCOGS[periodsWithCOGS.length - 1].revenue - periodsWithCOGS[periodsWithCOGS.length - 1].cogs!) / periodsWithCOGS[periodsWithCOGS.length - 1].revenue) * 100;
          const gmDelta = lastGM - firstGM;
          if (Math.abs(gmDelta) >= 0.5) {
            insights.push({
              icon: gmDelta > 0 ? '↑' : '↓',
              text: `Gross margin ${gmDelta > 0 ? 'expanded' : 'compressed'} ${Math.abs(gmDelta).toFixed(1)}pp over the period (${firstGM.toFixed(1)}% → ${lastGM.toFixed(1)}%)`,
              color: gmDelta > 0 ? 'text-emerald-400' : 'text-red-400',
            });
          }
        } else if (gpMargin > 0) {
          const gpGap = gpMargin - 42;
          insights.push({
            icon: '◈',
            text: `Gross margin ${gpMargin.toFixed(1)}% — ${gpGap >= 0 ? `${gpGap.toFixed(1)}pp above` : `${Math.abs(gpGap).toFixed(1)}pp below`} LMM 42% median`,
            color: gpGap >= 0 ? 'text-emerald-400' : 'text-amber-400',
          });
        }

        if (insights.length === 0) return null;
        return (
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 bg-slate-900/40 border border-slate-800/40 rounded-xl px-3.5 py-2.5 flex-1 min-w-0">
                <span className={`text-sm flex-shrink-0 mt-0.5 ${ins.color}`}>{ins.icon}</span>
                <span className={`text-[12px] font-medium leading-snug ${ins.color}`}>{ins.text}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* LTM / Annualized strip */}
      {(() => {
        // Build GM% sparkline from periods that have COGS data
        const periodsWithCOGS = data.revenue.byPeriod.filter(p => p.cogs != null && p.cogs > 0 && p.revenue > 0);
        const gmSparkline = periodsWithCOGS.slice(-12).map(p => ((p.revenue - p.cogs!) / p.revenue) * 100);
        const hasSparkline = gmSparkline.length >= 3;
        const gmFirst = hasSparkline ? gmSparkline[0] : null;
        const gmLast  = hasSparkline ? gmSparkline[gmSparkline.length - 1] : null;
        const gmDelta = gmFirst != null && gmLast != null ? gmLast - gmFirst : null;

        // SVG sparkline
        const sparkW = 80; const sparkH = 28;
        const minGM = hasSparkline ? Math.min(...gmSparkline) - 1 : 0;
        const maxGM = hasSparkline ? Math.max(...gmSparkline) + 1 : 100;
        const gmRange = Math.max(maxGM - minGM, 0.1);
        const sparkPts = hasSparkline
          ? gmSparkline.map((v, i) => {
              const x = (i / (gmSparkline.length - 1)) * sparkW;
              const y = sparkH - ((v - minGM) / gmRange) * sparkH;
              return `${x},${y}`;
            }).join(' ')
          : '';

        return (
          <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl px-5 py-3.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">
                {ltmLabel} Metrics
              </div>
              <div className="flex-1 h-px bg-slate-800/60"/>
              <div className="text-[10px] text-slate-600">
                {isLTM ? 'Trailing twelve months' : `Annualized from ${ltmCount} period${ltmCount !== 1 ? 's' : ''}`}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: `${ltmLabel} Revenue`,      value: fmt(ltmRev),     color: 'text-slate-100' },
                { label: `${ltmLabel} Gross Profit`, value: fmt(ltmGP),      color: ltmGP > 0 ? 'text-emerald-400' : 'text-red-400' },
                { label: `${ltmLabel} GM %`,         value: pctFmt(ltmGPM),  color: ltmGPM >= 40 ? 'text-emerald-400' : ltmGPM >= 25 ? 'text-amber-400' : 'text-red-400' },
                { label: `${ltmLabel} EBITDA`,       value: fmt(ltmEBITDA),  color: ltmEBITDA > 0 ? 'text-emerald-400' : 'text-red-400' },
              ].map(m => (
                <div key={m.label}>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{m.label}</div>
                  <div className={`text-[18px] font-bold ${m.color}`}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* GM% sparkline — only when per-period COGS available */}
            {hasSparkline && (
              <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex items-center gap-4">
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] flex-shrink-0">GM% Trend</div>
                <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="w-20 h-7 flex-shrink-0 overflow-visible">
                  <polyline points={sparkPts} fill="none"
                    stroke={gmDelta != null && gmDelta >= 0 ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.7)'}
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  {gmLast != null && (() => {
                    const lastX = sparkW;
                    const lastY = sparkH - ((gmLast - minGM) / gmRange) * sparkH;
                    return <circle cx={lastX} cy={lastY} r="2" fill={gmDelta != null && gmDelta >= 0 ? '#34d399' : '#f87171'}/>;
                  })()}
                </svg>
                <div className="flex items-center gap-3 flex-wrap text-[11px]">
                  {periodsWithCOGS.slice(-3).map((p, i) => {
                    const gm = ((p.revenue - p.cogs!) / p.revenue) * 100;
                    const isLast = i === periodsWithCOGS.slice(-3).length - 1;
                    return (
                      <span key={p.period} className={isLast ? 'font-semibold text-slate-200' : 'text-slate-600'}>
                        {p.period.replace(/\d{4}-/, '').replace(/^0/, '')}: {gm.toFixed(1)}%
                      </span>
                    );
                  })}
                  {gmDelta != null && (
                    <span className={`font-semibold ml-1 ${gmDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gmDelta >= 0 ? '↑' : '↓'}{Math.abs(gmDelta).toFixed(1)}pp
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Revenue Growth Momentum */}
      {data.revenue.byPeriod.length >= 3 && (() => {
        const periods = [...data.revenue.byPeriod].sort((a, b) => a.period.localeCompare(b.period));
        const firstRev = periods[0].revenue;
        const lastRev  = periods[periods.length - 1].revenue;
        const n        = periods.length - 1;

        // Determine period type for annualization
        const pType = periods[0].periodType ?? 'monthly';
        const periodsPerYear = pType === 'annual' ? 1 : pType === 'quarterly' ? 4 : 12;
        const years = n / periodsPerYear;

        // CAGR
        const cagr = years > 0 && firstRev > 0 && lastRev > 0
          ? (Math.pow(lastRev / firstRev, 1 / years) - 1) * 100
          : null;

        // Period-over-period growth rates
        const growthRates: number[] = [];
        for (let i = 1; i < periods.length; i++) {
          const prev = periods[i - 1].revenue;
          if (prev > 0) growthRates.push(((periods[i].revenue - prev) / prev) * 100);
        }

        // Acceleration: avg growth first half vs second half
        const midGR = Math.floor(growthRates.length / 2);
        const firstHalfAvg = midGR > 0 ? growthRates.slice(0, midGR).reduce((a, b) => a + b, 0) / midGR : null;
        const secondHalfAvg = midGR > 0 ? growthRates.slice(midGR).reduce((a, b) => a + b, 0) / (growthRates.length - midGR) : null;
        const accel = firstHalfAvg != null && secondHalfAvg != null ? secondHalfAvg - firstHalfAvg : null;

        // Most recent 3 growth rates for display
        const recentGR = growthRates.slice(-3);
        const latestGR = growthRates.length > 0 ? growthRates[growthRates.length - 1] : null;

        // Sparkline of growth rates
        const sparkW = 80; const sparkH = 28;
        const grMin = Math.min(...growthRates) - 1;
        const grMax = Math.max(...growthRates) + 1;
        const grRange = Math.max(grMax - grMin, 0.1);
        const grPts = growthRates.map((v, i) => {
          const x = (i / Math.max(growthRates.length - 1, 1)) * sparkW;
          const y = sparkH - ((v - grMin) / grRange) * sparkH;
          return `${x},${y}`;
        }).join(' ');

        const cagrColor = cagr == null ? 'text-slate-400' : cagr >= 20 ? 'text-emerald-400' : cagr >= 10 ? 'text-sky-400' : cagr >= 0 ? 'text-amber-400' : 'text-red-400';
        const latestColor = latestGR == null ? 'text-slate-400' : latestGR >= 15 ? 'text-emerald-400' : latestGR >= 5 ? 'text-sky-400' : latestGR >= 0 ? 'text-amber-400' : 'text-red-400';

        return (
          <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl px-5 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Revenue Growth Momentum</div>
              <div className="flex-1 h-px bg-slate-800/60"/>
              <div className="text-[10px] text-slate-600">{periods.length} periods · {years.toFixed(1)}yr span</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* CAGR */}
              <div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">CAGR</div>
                <div className={`text-[20px] font-bold ${cagrColor}`}>{cagr != null ? `${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%` : '—'}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">Compounded annual</div>
              </div>

              {/* Latest Period Growth */}
              <div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Latest Period</div>
                <div className={`text-[20px] font-bold ${latestColor}`}>{latestGR != null ? `${latestGR >= 0 ? '+' : ''}${latestGR.toFixed(1)}%` : '—'}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">MoM / QoQ / YoY</div>
              </div>

              {/* Acceleration */}
              <div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Acceleration</div>
                {accel != null ? (
                  <>
                    <div className={`text-[20px] font-bold ${accel > 2 ? 'text-emerald-400' : accel > -2 ? 'text-amber-400' : 'text-red-400'}`}>
                      {accel >= 0 ? '+' : ''}{accel.toFixed(1)}pp
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{accel > 0 ? 'Accelerating' : accel < -2 ? 'Decelerating' : 'Stable'}</div>
                  </>
                ) : (
                  <div className="text-[20px] font-bold text-slate-500">—</div>
                )}
              </div>

              {/* Sparkline + recent growth labels */}
              <div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Growth Trend</div>
                {growthRates.length >= 3 ? (
                  <div className="flex items-center gap-2">
                    <svg viewBox={`0 0 ${sparkW} ${sparkH}`} className="w-16 h-6 flex-shrink-0 overflow-visible">
                      {/* Zero line */}
                      {grMin < 0 && grMax > 0 && (
                        <line x1="0" y1={sparkH - ((0 - grMin) / grRange) * sparkH}
                              x2={sparkW} y2={sparkH - ((0 - grMin) / grRange) * sparkH}
                              stroke="rgba(100,116,139,0.2)" strokeWidth="1" strokeDasharray="2,2"/>
                      )}
                      <polyline points={grPts} fill="none"
                        stroke={accel != null && accel >= 0 ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.7)'}
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      {latestGR != null && (() => {
                        const lx = sparkW;
                        const ly = sparkH - ((latestGR - grMin) / grRange) * sparkH;
                        return <circle cx={lx} cy={ly} r="2" fill={accel != null && accel >= 0 ? '#34d399' : '#f87171'}/>;
                      })()}
                    </svg>
                    <div className="flex flex-col gap-0.5">
                      {recentGR.map((gr, i) => {
                        const periodIdx = periods.length - recentGR.length + i;
                        const label = periods[periodIdx]?.period.replace(/\d{4}-/, '').replace(/^0/, '') ?? '';
                        const isLast = i === recentGR.length - 1;
                        return (
                          <span key={i} className={`text-[10px] font-${isLast ? 'semibold' : 'normal'} ${isLast ? (gr >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-600'}`}>
                            {label}: {gr >= 0 ? '+' : ''}{gr.toFixed(1)}%
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-[20px] font-bold text-slate-500">—</div>
                )}
              </div>
            </div>

            {/* Contextual insight row */}
            {cagr != null && (
              <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex items-center gap-2">
                <span className={`text-[11px] font-semibold ${cagrColor}`}>
                  {cagr >= 25 ? '◆ Hypergrowth' : cagr >= 15 ? '◆ Strong Growth' : cagr >= 5 ? '◈ Moderate Growth' : cagr >= 0 ? '▽ Slow Growth' : '▼ Declining'}
                </span>
                <span className="text-[11px] text-slate-500">·</span>
                <span className="text-[11px] text-slate-500">
                  {cagr >= 20
                    ? `${fmt(lastRev)} revenue growing ${cagr.toFixed(1)}% CAGR — strong momentum for a quality valuation process`
                    : cagr >= 10
                    ? `${cagr.toFixed(1)}% CAGR is LMM-median range; focus on sustaining ${(cagr + 5).toFixed(0)}%+ to expand multiple`
                    : cagr >= 0
                    ? `Sub-10% CAGR; identify whether structural ceiling or execution gap before growth investments`
                    : `Negative CAGR — address root causes before focusing on multiple expansion`}
                </span>
                {accel != null && accel > 3 && (
                  <>
                    <span className="text-[11px] text-slate-500">·</span>
                    <span className="text-[11px] text-emerald-400 font-medium">Accelerating +{accel.toFixed(1)}pp — favorable trend</span>
                  </>
                )}
                {accel != null && accel < -3 && (
                  <>
                    <span className="text-[11px] text-slate-500">·</span>
                    <span className="text-[11px] text-amber-400 font-medium">Decelerating {accel.toFixed(1)}pp — monitor closely</span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Operating Leverage Insight */}
      {rev > 0 && (
        <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl px-5 py-3.5 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400 text-sm font-bold">%</div>
          <div className="flex-1">
            {(() => {
              // Contribution margin: (Rev - COGS) / Rev  (COGS = variable proxy)
              const contribMargin = rev > 0 ? ((rev - cogs) / rev) * 100 : 0;
              // Operating leverage: 10% rev increase → EBITDA grows by (10% × contribution margin) / EBITDA margin
              const ebitdaGrowthPer10 = ebitdaMargin > 0 ? (10 * contribMargin) / ebitdaMargin : 0;
              return (
                <>
                  <div className="text-[12px] font-semibold text-slate-200">
                    For every 10% revenue increase, EBITDA grows{' '}
                    <span className={ebitdaGrowthPer10 >= 15 ? 'text-emerald-400' : 'text-amber-400'}>
                      {ebitdaGrowthPer10 > 0 ? `${ebitdaGrowthPer10.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Contribution margin: {contribMargin.toFixed(1)}% (Revenue − COGS) / Revenue — COGS treated as variable cost proxy
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Break-Even Analysis */}
      {rev > 0 && (() => {
        const contribMarginPct = rev > 0 ? ((rev - cogs) / rev) * 100 : 0;
        // Break-even revenue = Fixed Costs (OpEx) / Contribution Margin %
        const breakEvenRev = contribMarginPct > 0 ? (opex / (contribMarginPct / 100)) : null;
        const buffer = breakEvenRev != null ? rev - breakEvenRev : null;
        const bufferPct = breakEvenRev != null && breakEvenRev > 0 ? (buffer! / breakEvenRev) * 100 : null;
        const isAbove = buffer != null && buffer > 0;
        // Revenue targets for margin milestones
        const target10 = contribMarginPct > 0 ? (opex + cogs + rev * 0.10) / (contribMarginPct / 100 + 0) : null;
        const target15 = contribMarginPct > 0 ? (opex + cogs + rev * 0.15) / (contribMarginPct / 100 + 0) : null;
        // Revenue needed to hit 10% and 15% EBITDA margin
        // EBITDA = Rev - COGS - OpEx = Rev × (1 - COGS%) - OpEx = target_margin × Rev
        // Rev × (1 - cogsMargin/100) - OpEx = target × Rev
        // Rev × (1 - cogsMargin/100 - target) = OpEx
        const cogsMarginFrac = rev > 0 ? cogs / rev : 0;
        const revFor10 = (1 - cogsMarginFrac - 0.10) > 0 ? opex / (1 - cogsMarginFrac - 0.10) : null;
        const revFor15 = (1 - cogsMarginFrac - 0.15) > 0 ? opex / (1 - cogsMarginFrac - 0.15) : null;
        const revFor20 = (1 - cogsMarginFrac - 0.20) > 0 ? opex / (1 - cogsMarginFrac - 0.20) : null;

        return (
          <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl px-5 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Break-Even Analysis</div>
              <div className="flex-1 h-px bg-slate-800/60"/>
              <div className="text-[10px] text-slate-600">Fixed costs vs contribution margin</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Break-Even Revenue</div>
                <div className="text-[18px] font-bold text-slate-300">{breakEvenRev != null ? fmt(breakEvenRev) : '—'}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">to cover all fixed costs</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">
                  {isAbove ? 'Revenue Buffer' : 'Revenue Gap'}
                </div>
                <div className={`text-[18px] font-bold ${isAbove ? 'text-emerald-400' : 'text-red-400'}`}>
                  {buffer != null ? (isAbove ? '+' : '') + fmt(buffer) : '—'}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {bufferPct != null ? `${Math.abs(bufferPct).toFixed(0)}% ${isAbove ? 'above' : 'below'} break-even` : ''}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Contribution Margin</div>
                <div className={`text-[18px] font-bold ${contribMarginPct >= 50 ? 'text-emerald-400' : contribMarginPct >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                  {pctFmt(contribMarginPct)}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">(Rev − COGS) / Rev</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Fixed Cost Base</div>
                <div className="text-[18px] font-bold text-slate-300">{fmt(opex)}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">total OpEx (proxy)</div>
              </div>
            </div>

            {/* EBITDA Margin Targets */}
            {(revFor10 != null || revFor15 != null) && (
              <div className="pt-3 border-t border-slate-800/60">
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2.5">Revenue Needed to Hit EBITDA Margin Targets</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { target: '10%', rev: revFor10, current: ebitdaMargin >= 10 },
                    { target: '15%', rev: revFor15, current: ebitdaMargin >= 15 },
                    { target: '20%', rev: revFor20, current: ebitdaMargin >= 20 },
                  ].map(t => {
                    if (!t.rev) return null;
                    const gap = t.rev - rev;
                    const achieved = t.current || gap <= 0;
                    return (
                      <div key={t.target} className={`rounded-xl border px-3.5 py-2.5 ${achieved ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/20 border-slate-700/40'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t.target} EBITDA</span>
                          {achieved && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded">✓ Achieved</span>}
                        </div>
                        {achieved ? (
                          <div className="text-[13px] font-bold text-emerald-400">Already above target</div>
                        ) : (
                          <>
                            <div className="text-[14px] font-bold text-slate-200">{fmt(t.rev)}</div>
                            <div className="text-[10px] text-amber-400/80 mt-0.5">+{fmt(gap)} needed ({((gap/rev)*100).toFixed(0)}% growth)</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* P&L Waterfall + Collapsible Income Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        <PLWaterfall data={data} />

        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-semibold text-slate-100">Income Statement</div>
            <div className="flex items-center gap-2">
              {previousData && (
                <button
                  onClick={() => setShowComparison(v => !v)}
                  className={`text-[11px] px-2 py-0.5 rounded-md border font-medium transition-colors ${
                    showComparison
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                      : 'text-slate-500 border-slate-800/50 hover:text-slate-300'
                  }`}
                >
                  {showComparison ? '← Statement' : 'Compare →'}
                </button>
              )}
              {!showComparison && <span className="text-[10px] text-slate-600">Click COGS / OpEx to expand</span>}
            </div>
          </div>
          {showComparison && previousData ? (
            <PLComparison data={data} previousData={previousData} />
          ) : (
            <PLStatement
              data={data}
              previousData={previousData}
              showChange
              showPct
              defaultExpanded={false}
            />
          )}
          <div className="mt-4 pt-3 border-t border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Annualized Run Rate</div>
            <div className="text-[13px] font-bold text-slate-300">{fmt(runRate)}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">Monthly average × 12</div>
          </div>
        </div>
      </div>

      {/* Period P&L Bridge — only when previous data available */}
      {previousData && (
        <PLBridge data={data} previousData={previousData} />
      )}

      {/* Revenue + Margin charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <RevenueChart data={data} annotations={annotations} onAnnotate={onAnnotate} onAskAI={onAskAI} />
        <MarginTrendChart data={data} />
      </div>

      {/* Revenue Quality Panel */}
      {hasRecurring && (() => {
        // Per-period trend if available
        const periods = data.revenue.byPeriod;
        const hasPeriodBreakdown = periods.some(p => p.recurring != null);
        const trendData = hasPeriodBreakdown
          ? periods.map(p => ({
              period: p.period.replace(' 20', ' \'').replace('20', '\''),
              recurring: p.recurring ?? 0,
              oneTime: p.oneTime ?? (p.revenue - (p.recurring ?? 0)),
              total: p.revenue,
              recPct: p.revenue > 0 ? ((p.recurring ?? 0) / p.revenue) * 100 : 0,
            }))
          : null;

        // Revenue quality score (0–100)
        const qScore = Math.min(100, Math.round(
          (recurringPct >= 80 ? 100 : recurringPct >= 60 ? 80 : recurringPct >= 40 ? 60 : recurringPct >= 20 ? 40 : 20) * 0.6 +
          (trendData && trendData.length >= 2 ? (trendData[trendData.length-1].recPct > trendData[0].recPct ? 100 : 60) : 70) * 0.25 +
          (mrr > 0 ? 100 : 50) * 0.15
        ));
        const qColor = qScore >= 80 ? 'text-emerald-400' : qScore >= 60 ? 'text-sky-400' : qScore >= 40 ? 'text-amber-400' : 'text-red-400';
        const qBorder = qScore >= 80 ? 'border-emerald-500/20' : qScore >= 60 ? 'border-sky-500/20' : qScore >= 40 ? 'border-amber-500/20' : 'border-red-500/20';
        const qBg = qScore >= 80 ? 'bg-emerald-500/4' : qScore >= 60 ? 'bg-sky-500/4' : qScore >= 40 ? 'bg-amber-500/4' : 'bg-red-500/4';

        return (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[13px] font-semibold text-slate-100">Revenue Quality</div>
                <div className="text-[11px] text-slate-600 mt-0.5">Recurring mix, predictability, and trend</div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`rounded-xl border px-3.5 py-2 text-center ${qBg} ${qBorder}`}>
                  <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">Quality Score</div>
                  <div className={`text-[22px] font-black ${qColor}`}>{qScore}</div>
                </div>
                {onAskAI && (
                  <button
                    onClick={() => onAskAI(
                      `Revenue quality score ${qScore}/100. Recurring mix: ${recurringPct.toFixed(1)}%, MRR: ${fmt(mrr)}. ` +
                      `${trendData ? `Recurring % trend: ${trendData.map(d => d.recPct.toFixed(0)+'%').join(' → ')}.` : ''} ` +
                      `How do I improve revenue quality and grow recurring revenue?`
                    )}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 border border-indigo-500/20 px-2.5 py-1 rounded-lg transition-colors">
                    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                      <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                      <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                    </svg>
                    Ask AI
                  </button>
                )}
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'ARR',           value: fmt(recurringRev),    color: 'text-indigo-400', sub: 'Annualised recurring rev' },
                { label: 'MRR',           value: fmt(mrr),             color: 'text-indigo-300', sub: 'Monthly recurring rev' },
                { label: 'Recurring Mix', value: `${recurringPct.toFixed(1)}%`, color: recurringPct >= 60 ? 'text-emerald-400' : recurringPct >= 30 ? 'text-amber-400' : 'text-red-400', sub: 'of total revenue' },
                { label: 'One-Time Rev',  value: fmt(oneTimeRev > 0 ? oneTimeRev : rev - recurringRev), color: 'text-slate-400', sub: 'Non-recurring / project' },
              ].map(m => (
                <div key={m.label} className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-3.5">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">{m.label}</div>
                  <div className={`text-[18px] font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Per-period stacked bar trend */}
            {trendData && trendData.length >= 2 && (
              <div className="mb-4">
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2.5">Recurring vs One-Time by Period</div>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={trendData} barSize={26} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="period" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false}/>
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const rec = (payload.find(p => p.dataKey === 'recurring')?.value as number) ?? 0;
                        const ot  = (payload.find(p => p.dataKey === 'oneTime')?.value as number) ?? 0;
                        const tot = rec + ot;
                        return (
                          <div className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-xs shadow-xl">
                            <div className="font-semibold text-slate-200 mb-1">{label}</div>
                            <div className="text-indigo-300">Recurring: {fmt(rec)} ({tot > 0 ? ((rec/tot)*100).toFixed(0) : 0}%)</div>
                            <div className="text-slate-400">One-time: {fmt(ot)}</div>
                          </div>
                        );
                      }}
                      cursor={{ fill: 'rgba(148,163,184,0.04)' }}
                    />
                    <Bar dataKey="recurring" stackId="a" fill="#6366f1" fillOpacity={0.7} radius={[0,0,0,0]}/>
                    <Bar dataKey="oneTime"   stackId="a" fill="#334155" fillOpacity={0.8} radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-indigo-500/70"/><span>Recurring</span></span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-600/80"/><span>One-time / project</span></span>
                  {trendData.length >= 2 && (
                    <span className={`ml-auto font-medium ${trendData[trendData.length-1].recPct > trendData[0].recPct ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {trendData[trendData.length-1].recPct > trendData[0].recPct
                        ? `↑ Recurring mix improving (+${(trendData[trendData.length-1].recPct - trendData[0].recPct).toFixed(1)}pp)`
                        : `↓ Mix shifting toward one-time (${(trendData[0].recPct - trendData[trendData.length-1].recPct).toFixed(1)}pp)`}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Summary bar */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
                <span className="text-indigo-400/70">Recurring {recurringPct.toFixed(1)}%</span>
                <span>One-time {(100 - recurringPct).toFixed(1)}%</span>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
                <div className="bg-indigo-500/60 transition-all" style={{ width: `${recurringPct}%` }}/>
                <div className="bg-slate-600/30 flex-1"/>
              </div>
              <div className={`text-[11px] mt-2 ${qColor}`}>
                {qScore >= 80 ? 'Strong revenue quality — predominantly recurring with growing mix'
                : qScore >= 60 ? 'Good quality — majority recurring, consider converting more project clients to retainers'
                : qScore >= 40 ? 'Moderate quality — significant project dependence creates revenue variability'
                : 'Revenue quality risk — high one-time exposure, focus on retainer conversion'}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Revenue by Product/Line */}
      {data.revenue.byProduct && data.revenue.byProduct.length > 0 && (() => {
        const products = [...data.revenue.byProduct].sort((a, b) => b.amount - a.amount);
        const maxAmt = Math.max(...products.map(p => p.amount), 1);
        const totalProdRev = products.reduce((s, p) => s + p.amount, 0);
        const avgMargin = products.filter(p => p.margin != null).length > 0
          ? products.filter(p => p.margin != null).reduce((s, p) => s + p.margin!, 0) / products.filter(p => p.margin != null).length
          : null;
        const COLORS = ['bg-indigo-500/60', 'bg-violet-500/60', 'bg-sky-500/60', 'bg-emerald-500/60', 'bg-amber-500/60', 'bg-rose-500/60', 'bg-teal-500/60', 'bg-pink-500/60'];
        const TEXT_COLORS = ['text-indigo-400', 'text-violet-400', 'text-sky-400', 'text-emerald-400', 'text-amber-400', 'text-rose-400', 'text-teal-400', 'text-pink-400'];
        return (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[13px] font-semibold text-slate-100">Revenue by Product / Service Line</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{products.length} lines · {fmt(totalProdRev)} total</div>
              </div>
              {avgMargin != null && (
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">Portfolio Avg Margin</div>
                  <div className={`text-[18px] font-bold ${avgMargin >= 50 ? 'text-emerald-400' : avgMargin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                    {avgMargin.toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            {/* Stacked proportion bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px mb-4">
              {products.map((p, i) => (
                <div key={p.name} className={COLORS[i % COLORS.length]}
                  style={{ width: `${totalProdRev > 0 ? (p.amount / totalProdRev) * 100 : 0}%` }}
                  title={`${p.name}: ${fmt(p.amount)}`}/>
              ))}
            </div>

            <div className="space-y-2.5">
              {products.map((p, i) => {
                const pct = totalProdRev > 0 ? (p.amount / totalProdRev) * 100 : 0;
                const barW = (p.amount / maxAmt) * 100;
                return (
                  <div key={p.name} className="group">
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${COLORS[i % COLORS.length].replace('/60', '')}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-medium text-slate-200 truncate">{p.name}</span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {p.margin != null && (
                              <span className={`text-[11px] font-semibold ${p.margin >= 50 ? 'text-emerald-400' : p.margin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>
                                {p.margin.toFixed(1)}% margin
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500">{pct.toFixed(1)}%</span>
                            <span className={`text-[13px] font-bold ${TEXT_COLORS[i % TEXT_COLORS.length]}`}>{fmt(p.amount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden ml-5">
                      <div className={`h-full rounded-full transition-all ${COLORS[i % COLORS.length]}`} style={{ width: `${barW}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insights row */}
            {products.length >= 2 && (() => {
              const top = products[0];
              const topPct = totalProdRev > 0 ? (top.amount / totalProdRev) * 100 : 0;
              const highMarginProduct = avgMargin != null
                ? products.filter(p => p.margin != null).sort((a, b) => b.margin! - a.margin!)[0]
                : null;
              const lowMarginProduct = avgMargin != null
                ? products.filter(p => p.margin != null).sort((a, b) => a.margin! - b.margin!)[0]
                : null;
              return (
                <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-300">{top.name}</span> drives {topPct.toFixed(0)}% of revenue
                    {topPct > 60 && <span className="text-amber-400"> — high product concentration risk</span>}
                  </div>
                  {highMarginProduct && highMarginProduct !== lowMarginProduct && (
                    <div className="text-[11px] text-slate-500">
                      Highest margin: <span className="font-semibold text-emerald-400">{highMarginProduct.name} ({highMarginProduct.margin?.toFixed(1)}%)</span>
                      {lowMarginProduct && lowMarginProduct.margin != null && lowMarginProduct.margin < 20 && (
                        <> · Lowest: <span className="text-red-400">{lowMarginProduct.name} ({lowMarginProduct.margin.toFixed(1)}%)</span></>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Cash Flow */}
      {hasCashFlow ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Cash Flow</div>
            <div className="flex-1 h-px bg-emerald-500/10"/>
          </div>
          <CashFlowPanel periods={data.cashFlow!} onAskAI={onAskAI}/>
          {/* Runway Scenarios — only when burning cash */}
          {(() => {
            const cf = data.cashFlow!;
            const latest = cf[cf.length - 1];
            const avgNet = cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / Math.max(cf.length, 1);
            if (avgNet >= 0 || !latest) return null;
            const cash = latest.closingBalance;
            const scenarios = [
              { label: 'Conservative', burnMult: 1.25, color: 'text-red-400',   bg: 'bg-red-500/8 border-red-500/15' },
              { label: 'Base Case',    burnMult: 1.0,  color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/15' },
              { label: 'Optimistic',   burnMult: 0.75, color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15' },
            ].map(s => ({
              ...s,
              months: Math.abs(cash / (avgNet * s.burnMult)),
              burnRate: fmt(Math.abs(avgNet * s.burnMult)) + '/mo',
            }));
            return (
              <div className="mt-4 bg-slate-900/30 border border-slate-800/40 rounded-xl p-4">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-3">Runway Scenarios</div>
                <div className="grid grid-cols-3 gap-3">
                  {scenarios.map(s => (
                    <div key={s.label} className={`rounded-xl border px-4 py-3 text-center ${s.bg}`}>
                      <div className="text-[10px] font-semibold text-slate-600 mb-1">{s.label}</div>
                      <div className={`text-[20px] font-bold ${s.color}`}>{s.months.toFixed(1)}<span className="text-[12px] font-medium ml-0.5">mo</span></div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{s.burnRate}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-slate-600 mt-2.5 text-center">Conservative assumes 25% higher burn · Optimistic assumes 25% lower</div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="bg-emerald-500/4 border border-emerald-500/15 rounded-xl p-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-lg">💰</div>
          <div>
            <div className="text-[13px] font-semibold text-slate-200 mb-0.5">Cash Flow Statement</div>
            <div className="text-[12px] text-slate-500">Upload your cash flow report to see runway analysis, balance trends, and period-by-period net flow</div>
          </div>
        </div>
      )}

      {/* AR Aging */}
      {hasARaging ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Accounts Receivable Aging</div>
            <div className="flex-1 h-px bg-orange-500/10"/>
          </div>
          <ARAgingPanel buckets={data.arAging!} revenue={rev} onAskAI={onAskAI}/>
        </div>
      ) : (
        <div className="bg-orange-500/4 border border-orange-500/15 rounded-xl p-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 text-lg">📋</div>
          <div>
            <div className="text-[13px] font-semibold text-slate-200 mb-0.5">AR Aging Report</div>
            <div className="text-[12px] text-slate-500">Upload AR aging to see collection risk, days sales outstanding, and past-due breakdown by customer</div>
          </div>
        </div>
      )}

      {/* Cost Structure */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="text-[13px] font-semibold text-slate-100 mb-4">Cost Structure Analysis</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">COGS Efficiency</div>
            <div className="text-[20px] font-bold text-slate-100">{pctFmt(cogsMargin)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">of revenue</div>
            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-red-500/60" style={{ width: `${Math.min(cogsMargin, 100)}%` }}/>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">OpEx Ratio</div>
            <div className="text-[20px] font-bold text-slate-100">{pctFmt(opexMargin)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">of revenue</div>
            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${Math.min(opexMargin, 100)}%` }}/>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Operating Efficiency</div>
            <div className={`text-[20px] font-bold ${ebitdaMargin >= 15 ? 'text-emerald-400' : ebitdaMargin >= 8 ? 'text-amber-400' : 'text-red-400'}`}>
              {pctFmt(ebitdaMargin)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">EBITDA margin</div>
            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${ebitdaMargin >= 15 ? 'bg-emerald-500/60' : ebitdaMargin >= 8 ? 'bg-amber-500/60' : 'bg-red-500/60'}`} style={{ width: `${Math.min(Math.max(ebitdaMargin, 0), 100) * 2}%` }}/>
            </div>
          </div>
        </div>
      </div>

      {/* Budget vs. Actual */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Budget vs. Actual</div>
          <div className="flex-1 h-px bg-amber-500/10"/>
        </div>
        <BudgetPanel data={data} budget={budget} onSetBudget={onSetBudget} onAskAI={onAskAI} />
      </div>

      {/* Working Capital */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Working Capital</div>
          <div className="flex-1 h-px bg-cyan-500/10"/>
        </div>
        <WorkingCapitalPanel data={data} onAskAI={onAskAI} />
      </div>

      {/* Industry Benchmarks */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Industry Benchmarks</div>
          <div className="flex-1 h-px bg-violet-500/10"/>
        </div>
        <IndustryBenchmarksPanel data={data} previousData={previousData} onAskAI={onAskAI} />
      </div>

    </div>
  );
}
