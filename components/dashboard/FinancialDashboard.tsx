import { useState } from 'react';
import type { UnifiedBusinessData, KPIDashboard, CashFlowPeriod, ARAgingBucket, Budget } from '../../types';
import PLWaterfall from '../charts/PLWaterfall';
import MarginTrendChart from '../charts/MarginTrendChart';
import RevenueChart from '../charts/RevenueChart';
import PLStatement from '../PLStatement';
import ValuationEstimator from './ValuationEstimator';
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

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` :
  n >= 1_000     ? `$${(n/1_000).toFixed(0)}k` :
  `$${n.toFixed(0)}`;

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
      <div className="grid grid-cols-4 gap-3">
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
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800/50">
              {['Period','Opening Balance','Receipts','Payments','Closing Balance','Net Flow'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => {
              const net = p.netCashFlow ?? (p.closingBalance - p.openingBalance);
              return (
                <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3 text-[12px] font-medium text-slate-200">{p.period}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-300">{fmt(p.openingBalance)}</td>
                  <td className="px-4 py-3 text-[12px] text-emerald-400">{fmt(p.receipts)}</td>
                  <td className="px-4 py-3 text-[12px] text-red-400">({fmt(p.payments)})</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-100">{fmt(p.closingBalance)}</td>
                  <td className={`px-4 py-3 text-[12px] font-medium ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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

// ── AR Aging Panel ─────────────────────────────────────────────────────────────
function ARAgingPanel({ buckets, onAskAI }: { buckets: ARAgingBucket[]; onAskAI?: (msg: string) => void }) {
  const totalAR     = buckets.reduce((s, b) => s + b.total, 0);
  const totalCurrent = buckets.reduce((s, b) => s + b.current, 0);
  const total30     = buckets.reduce((s, b) => s + b.days30, 0);
  const total60     = buckets.reduce((s, b) => s + b.days60, 0);
  const total90     = buckets.reduce((s, b) => s + b.days90, 0);
  const totalOver90 = buckets.reduce((s, b) => s + b.over90, 0);
  const pastDue     = total30 + total60 + total90 + totalOver90;
  const riskAR      = total60 + total90 + totalOver90; // 60+ days is collection risk

  const ageSummary = [
    { label: 'Current',  value: totalCurrent, pct: totalAR > 0 ? (totalCurrent/totalAR)*100 : 0, color: 'bg-emerald-500/50', textColor: 'text-emerald-400' },
    { label: '1–30 days',value: total30,       pct: totalAR > 0 ? (total30/totalAR)*100 : 0,      color: 'bg-amber-500/50',   textColor: 'text-amber-400' },
    { label: '31–60 days',value: total60,      pct: totalAR > 0 ? (total60/totalAR)*100 : 0,      color: 'bg-orange-500/50',  textColor: 'text-orange-400' },
    { label: '61–90 days',value: total90,      pct: totalAR > 0 ? (total90/totalAR)*100 : 0,      color: 'bg-red-500/50',     textColor: 'text-red-400' },
    { label: '90+ days', value: totalOver90,   pct: totalAR > 0 ? (totalOver90/totalAR)*100 : 0,  color: 'bg-red-700/50',     textColor: 'text-red-500' },
  ];

  return (
    <div className="space-y-4">
      {/* AR KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
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
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/40">
                {['Customer','Current','1–30','31–60','61–90','90+','Total'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-right first:text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.sort((a, b) => b.total - a.total).map((b, i) => (
                <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3 text-[12px] font-medium text-slate-200">{b.customer}</td>
                  <td className="px-4 py-3 text-[12px] text-right text-emerald-400/80">{b.current > 0 ? fmt(b.current) : '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-right text-amber-400/80">{b.days30 > 0 ? fmt(b.days30) : '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-right text-orange-400/80">{b.days60 > 0 ? fmt(b.days60) : '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-right text-red-400/80">{b.days90 > 0 ? fmt(b.days90) : '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-right text-red-500/80 font-medium">{b.over90 > 0 ? fmt(b.over90) : '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-right font-semibold text-slate-100">{fmt(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const fmtAmt = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` :
    Math.abs(n) >= 1_000     ? `$${(n/1_000).toFixed(0)}k` :
    `$${n.toFixed(0)}`;
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
    <div className="font-mono text-[12px]">
      {/* Headers */}
      <div className="grid grid-cols-[1fr_90px_90px_80px_70px] gap-2 pb-2 mb-2 border-b border-slate-800/60">
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
              <div className={`grid grid-cols-[1fr_90px_90px_80px_70px] gap-2 py-1 rounded ${r.bold ? '' : ''}`}>
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
            <div key={r.label} className="grid grid-cols-[1fr_90px_90px_80px_70px] gap-2 py-0.5">
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
      <div className="grid grid-cols-4 gap-3">
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
      <div className="grid grid-cols-5 gap-3">
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

      {/* LTM / Annualized strip */}
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
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: `${ltmLabel} Revenue`,    value: fmt(ltmRev),    color: 'text-slate-100' },
            { label: `${ltmLabel} Gross Profit`, value: fmt(ltmGP),   color: ltmGP > 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: `${ltmLabel} GM %`,        value: pctFmt(ltmGPM), color: ltmGPM >= 40 ? 'text-emerald-400' : ltmGPM >= 25 ? 'text-amber-400' : 'text-red-400' },
            { label: `${ltmLabel} EBITDA`,      value: fmt(ltmEBITDA), color: ltmEBITDA > 0 ? 'text-emerald-400' : 'text-red-400' },
          ].map(m => (
            <div key={m.label}>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{m.label}</div>
              <div className={`text-[18px] font-bold ${m.color}`}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* P&L Waterfall + Collapsible Income Statement */}
      <div className="grid grid-cols-[1fr_340px] gap-5">
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
            <div className="text-[11px] text-slate-600 mt-0.5">Annualized run rate (monthly avg × 12)</div>
          </div>
        </div>
      </div>

      {/* Revenue + Margin charts */}
      <div className="grid grid-cols-2 gap-5">
        <RevenueChart data={data} annotations={annotations} onAnnotate={onAnnotate} onAskAI={onAskAI} />
        <MarginTrendChart data={data} />
      </div>

      {/* Recurring Revenue — only if data present */}
      {hasRecurring && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-semibold text-slate-100">Recurring Revenue</div>
            {onAskAI && (
              <button
                onClick={() => onAskAI(
                  `My recurring revenue is ${fmt(recurringRev)} (${recurringPct.toFixed(1)}% of total revenue). ` +
                  `MRR is ${fmt(mrr)}. What's the best way to grow recurring revenue?`
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
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              { label: 'ARR',              value: fmt(recurringRev),    color: 'text-indigo-400', sub: 'Annual recurring rev' },
              { label: 'MRR',              value: fmt(mrr),             color: 'text-indigo-300', sub: 'Monthly recurring rev' },
              { label: 'Recurring Mix',    value: `${recurringPct.toFixed(1)}%`, color: recurringPct >= 60 ? 'text-emerald-400' : recurringPct >= 30 ? 'text-amber-400' : 'text-red-400', sub: 'of total revenue' },
              { label: 'One-Time Rev',     value: oneTimeRev > 0 ? fmt(oneTimeRev) : fmt(rev - recurringRev), color: 'text-slate-400', sub: 'Non-recurring' },
            ].map(m => (
              <div key={m.label} className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{m.label}</div>
                <div className={`text-[20px] font-bold ${m.color}`}>{m.value}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>
          {/* Recurring vs one-time bar */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1.5">
              <span>Recurring</span><span>{recurringPct.toFixed(1)}%</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-800">
              <div className="bg-indigo-500/60 transition-all" style={{ width: `${recurringPct}%` }}/>
              <div className="bg-slate-600/30 flex-1"/>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-600 mt-1">
              <span className="text-indigo-400/60">Recurring: {fmt(recurringRev)}</span>
              <span>One-time: {fmt(rev - recurringRev)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {hasCashFlow ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Cash Flow</div>
            <div className="flex-1 h-px bg-emerald-500/10"/>
          </div>
          <CashFlowPanel periods={data.cashFlow!} onAskAI={onAskAI}/>
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
          <ARAgingPanel buckets={data.arAging!} onAskAI={onAskAI}/>
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
        <div className="grid grid-cols-3 gap-4">
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

      {/* Valuation Estimator */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Business Valuation</div>
          <div className="flex-1 h-px bg-indigo-500/10"/>
        </div>
        <ValuationEstimator data={data} previousData={previousData} onAskAI={onAskAI} />
      </div>
    </div>
  );
}
