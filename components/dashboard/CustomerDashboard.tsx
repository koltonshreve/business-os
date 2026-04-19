import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { fmtMoney } from '../../lib/format';
import type { UnifiedBusinessData, CustomerIndustry, CustomerRevenueType } from '../../types';
import { INDUSTRY_META, ALL_INDUSTRIES } from '../../lib/demo-customers';
import RevenueRetentionChart from '../charts/RevenueRetentionChart';

// ── Industry Revenue Mix ──────────────────────────────────────────────────────
const INDUSTRY_COLORS: Record<string, string> = {
  'healthcare':           '#f43f5e',
  'professional-services':'#6366f1',
  'saas-technology':      '#0ea5e9',
  'manufacturing':        '#f59e0b',
  'construction':         '#f97316',
  'distribution':         '#14b8a6',
  'financial-services':   '#10b981',
  'retail':               '#8b5cf6',
};

function IndustryRevenueMix({ customers, totalRevenue }: {
  customers: UnifiedBusinessData['customers']['topCustomers'];
  totalRevenue: number;
}) {
  const hasIndustry = customers.some(c => c.industry);
  if (!hasIndustry) return null;

  // Aggregate by industry
  const byIndustry: Record<string, { revenue: number; count: number; recurring: number; project: number }> = {};
  for (const c of customers) {
    if (!c.industry) continue;
    if (!byIndustry[c.industry]) byIndustry[c.industry] = { revenue: 0, count: 0, recurring: 0, project: 0 };
    byIndustry[c.industry].revenue += c.revenue;
    byIndustry[c.industry].count++;
    if (c.revenueType === 'recurring') byIndustry[c.industry].recurring += c.revenue;
    else if (c.revenueType === 'project') byIndustry[c.industry].project += c.revenue;
    else { // mixed: split 50/50
      byIndustry[c.industry].recurring += c.revenue * 0.5;
      byIndustry[c.industry].project += c.revenue * 0.5;
    }
  }

  const sorted = Object.entries(byIndustry)
    .map(([ind, data]) => ({
      industry: ind as CustomerIndustry,
      ...data,
      pct: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      recurringPct: data.revenue > 0 ? (data.recurring / data.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const pieData = sorted.map(d => ({
    name: INDUSTRY_META[d.industry]?.label ?? d.industry,
    value: d.revenue,
    color: INDUSTRY_COLORS[d.industry] ?? '#64748b',
  }));

  const fmtMon = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="text-[13px] font-semibold text-slate-100 mb-4">Revenue by Industry</div>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
        {/* Donut chart */}
        <div className="flex justify-center">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85}/>)}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0];
                  return (
                    <div className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-xs shadow-xl">
                      <div className="font-semibold text-slate-100">{d.name}</div>
                      <div className="text-slate-300">{fmtMon(d.value as number)}</div>
                      <div className="text-slate-500">{totalRevenue > 0 ? ((d.value as number / totalRevenue) * 100).toFixed(1) : 0}% of total</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Ranked list */}
        <div className="space-y-2">
          {sorted.map(d => {
            const meta = INDUSTRY_META[d.industry];
            const color = INDUSTRY_COLORS[d.industry] ?? '#64748b';
            return (
              <div key={d.industry} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px]">{meta?.icon}</span>
                    <span className="text-[12px] font-medium text-slate-200">{meta?.label ?? d.industry}</span>
                    <span className="text-[10px] text-slate-600">· {d.count} accounts</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${d.pct * 1.5}%`, background: color, opacity: 0.6 }}/>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[12px] font-semibold text-slate-200">{fmtMon(d.revenue)}</div>
                  <div className="text-[10px] text-slate-600">{d.pct.toFixed(1)}%</div>
                </div>
                <div className={`text-[10px] font-medium flex-shrink-0 w-14 text-right ${d.recurringPct >= 70 ? 'text-emerald-400' : d.recurringPct >= 40 ? 'text-amber-400' : 'text-orange-400'}`}>
                  {d.recurringPct.toFixed(0)}% rec
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue quality callout */}
      {(() => {
        const totalRec = sorted.reduce((s, d) => s + d.recurring, 0);
        const recPct = totalRevenue > 0 ? (totalRec / totalRevenue) * 100 : 0;
        const topInd = sorted[0];
        return (
          <div className="mt-4 pt-3 border-t border-slate-800/40 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Portfolio-wide recurring:</span>
              <span className={`font-semibold ${recPct >= 60 ? 'text-emerald-400' : recPct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{recPct.toFixed(0)}%</span>
            </div>
            {topInd && (
              <>
                <span className="hidden sm:block text-slate-800">·</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Largest segment:</span>
                  <span className="font-medium text-slate-300">{INDUSTRY_META[topInd.industry]?.label} ({topInd.pct.toFixed(1)}%)</span>
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── Customer Economics (LTV / LTV:CAC) ───────────────────────────────────────
function CustomerEconomics({ data }: { data: UnifiedBusinessData }) {
  const [cac, setCac] = useState('');
  const { customers } = data;
  const rev = data.revenue.total;
  const retentionRate = customers.retentionRate ?? 0.9;
  const annualChurn = Math.max(1 - retentionRate, 0.01); // cap at 1% to avoid infinite LTV
  const avgRevPerCustomer = customers.avgRevenuePerCustomer ?? (rev / Math.max(customers.totalCount, 1));
  const ltv = avgRevPerCustomer / annualChurn;

  const cacNum = parseFloat(cac);
  const hasCAC = !isNaN(cacNum) && cacNum > 0;
  const ltvCacRatio = hasCAC ? ltv / cacNum : null;
  const ltvCacColor = ltvCacRatio == null ? 'text-slate-400'
    : ltvCacRatio >= 3 ? 'text-emerald-400'
    : ltvCacRatio >= 2 ? 'text-amber-400'
    : 'text-red-400';

  const fmt2 = fmtMoney;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="text-[13px] font-semibold text-slate-100 mb-4">Customer Economics</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Avg Rev / Customer</div>
          <div className="text-[18px] font-bold text-slate-100">{fmt2(avgRevPerCustomer)}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">per period</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Annual Churn Rate</div>
          <div className={`text-[18px] font-bold ${annualChurn <= 0.05 ? 'text-emerald-400' : annualChurn <= 0.15 ? 'text-amber-400' : 'text-red-400'}`}>
            {(annualChurn * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">1 − retention rate</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Estimated LTV</div>
          <div className="text-[18px] font-bold text-indigo-400">{fmt2(ltv)}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">Avg Rev / Churn Rate</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">LTV:CAC Ratio</div>
          {hasCAC ? (
            <>
              <div className={`text-[18px] font-bold ${ltvCacColor}`}>{ltvCacRatio!.toFixed(1)}×</div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                {ltvCacRatio! >= 3 ? 'Strong unit economics' : ltvCacRatio! >= 2 ? 'Acceptable — watch trends' : 'Below target — review acquisition costs'}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-slate-600 mt-1">Enter CAC below</div>
          )}
        </div>
      </div>

      {/* CAC input */}
      <div className="flex items-center gap-3">
        <label className="text-[11px] text-slate-500 flex-shrink-0">Customer Acquisition Cost (CAC):</label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[11px]">$</span>
          <input
            type="number"
            value={cac}
            onChange={e => setCac(e.target.value)}
            placeholder="e.g. 2500"
            className="bg-slate-800/50 border border-slate-700/60 rounded-lg pl-6 pr-3 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 w-36"
          />
        </div>
        {hasCAC && ltvCacRatio !== null && (
          <div className={`text-[12px] font-semibold ${ltvCacColor}`}>
            For every $1 spent acquiring a customer, you recover ${ltvCacRatio.toFixed(1)} over their lifetime.
          </div>
        )}
        {!hasCAC && (
          <div className="text-[11px] text-slate-600 italic">Enter your CAC to see LTV:CAC ratio</div>
        )}
      </div>
    </div>
  );
}

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

const fmt = fmtMoney;

type SortKey = 'revenue' | 'percent' | 'name';

// ── Customer Segment (collapsible tier group) ─────────────────────────────────
interface SegmentConfig {
  id: string;
  label: string;
  description: string;
  accent: string;
  bg: string;
  border: string;
  badge: string;
}

const SEGMENT_CONFIGS: Record<string, SegmentConfig> = {
  anchor: {
    id: 'anchor',
    label: 'Anchor Accounts',
    description: '>20% of revenue — high concentration risk',
    accent: 'text-red-400',
    bg: 'bg-red-500/5',
    border: 'border-red-500/15',
    badge: 'bg-red-500/10 border-red-500/20 text-red-400',
  },
  watch: {
    id: 'watch',
    label: 'Watch List',
    description: '10–20% of revenue — monitor closely',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/15',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  },
  core: {
    id: 'core',
    label: 'Core Accounts',
    description: '3–10% of revenue — diversified base',
    accent: 'text-indigo-400',
    bg: 'bg-indigo-500/5',
    border: 'border-indigo-500/15',
    badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  },
  tail: {
    id: 'tail',
    label: 'Tail Accounts',
    description: '<3% of revenue — long tail',
    accent: 'text-slate-400',
    bg: 'bg-slate-800/20',
    border: 'border-slate-700/30',
    badge: 'bg-slate-800/40 border-slate-700/40 text-slate-400',
  },
};

function getSegmentId(pct: number): string {
  if (pct > 20) return 'anchor';
  if (pct > 10) return 'watch';
  if (pct > 3)  return 'core';
  return 'tail';
}

function CustomerSegmentGroup({
  segmentId, customers, totalRevenue, retentionPct, periodCount, onAskAI,
  defaultExpanded, selectedCustomer, onSelectCustomer, previousData,
}: {
  segmentId: string;
  customers: UnifiedBusinessData['customers']['topCustomers'];
  totalRevenue: number;
  retentionPct: number;
  periodCount: number;
  onAskAI?: (msg: string) => void;
  defaultExpanded?: boolean;
  selectedCustomer: string | null;
  onSelectCustomer: (id: string | null) => void;
  previousData?: UnifiedBusinessData;
}) {
  const [open, setOpen] = useState(defaultExpanded ?? false);
  const cfg = SEGMENT_CONFIGS[segmentId];
  if (!cfg || customers.length === 0) return null;

  const segRevTotal = customers.reduce((s, c) => s + c.revenue, 0);
  const segRevPct   = totalRevenue > 0 ? (segRevTotal / totalRevenue) * 100 : 0;
  const avgPct      = customers.length > 0 ? customers.reduce((s, c) => s + c.percentOfTotal, 0) / customers.length : 0;

  const riskColor = (pct: number) =>
    pct > 20 ? 'text-red-400' : pct > 15 ? 'text-amber-400' : 'text-emerald-400';
  const riskBg = (pct: number) =>
    pct > 20 ? 'bg-red-500/10 border-red-500/20' : pct > 15 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20';
  const riskLabel = (pct: number) =>
    pct > 20 ? 'High Risk' : pct > 15 ? 'Watch' : 'Normal';

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      {/* Segment header — click to expand */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-800/20 transition-colors text-left">
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          className={`w-2.5 h-2.5 flex-shrink-0 ${cfg.accent} transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          <path d="M2 3.5L5 6.5 8 3.5"/>
        </svg>

        {/* Label + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-semibold ${cfg.accent}`}>{cfg.label}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
              {customers.length} account{customers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">{cfg.description}</div>
        </div>

        {/* Summary stats */}
        <div className="hidden sm:flex items-center gap-4 lg:gap-6 flex-shrink-0">
          <div className="text-center">
            <div className="text-[10px] text-slate-600">Avg %</div>
            <div className={`text-[12px] font-bold ${cfg.accent}`}>{avgPct.toFixed(1)}%</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-600">Segment Rev</div>
            <div className={`text-[13px] font-bold ${cfg.accent}`}>{fmt(segRevTotal)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-slate-600">% of Total</div>
            <div className={`text-[12px] font-bold ${cfg.accent}`}>{segRevPct.toFixed(1)}%</div>
          </div>
        </div>
      </button>

      {/* Expanded customer rows */}
      {open && (
        <div className="border-t border-slate-800/40">
          <div className="overflow-x-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-900/30 min-w-[580px]">
            <div>Customer</div>
            <div className="text-right">Revenue</div>
            <div className="text-right">% of Total</div>
            <div>Industry</div>
            <div className="text-right">Share Trend</div>
            <div className="text-right">Risk</div>
          </div>
          <div className="divide-y divide-slate-800/30">
            {customers.map((c, i) => {
              const isSelected = selectedCustomer === c.id;
              const annualRev  = Math.round(c.revenue * (12 / periodCount));
              const ltvEst     = c.revenue / Math.max(1 - (retentionPct / 100), 0.01);

              // Trend signal vs previousData
              let trendBadge: { label: string; cls: string } | null = null;
              if (previousData) {
                const prevByCustomer = previousData.revenue.byCustomer;
                const prevEntry = prevByCustomer?.find(x => x.id === c.id || x.name === c.name);
                if (prevEntry) {
                  const delta = c.percentOfTotal - prevEntry.percent;
                  if (delta > 2) trendBadge = { label: '▲ Growing', cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' };
                  else if (delta < -2) trendBadge = { label: '▼ Declining', cls: 'bg-red-500/10 border-red-500/20 text-red-400' };
                  else trendBadge = { label: '→ Stable', cls: 'bg-slate-800/60 border-slate-700/40 text-slate-400' };
                }
              }

              return (
                <div key={c.id}>
                  <button
                    onClick={() => onSelectCustomer(isSelected ? null : c.id)}
                    className={`w-full grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 transition-colors text-left min-w-[580px] ${
                      isSelected ? 'bg-indigo-500/8 border-l-2 border-l-indigo-500/60' : 'hover:bg-slate-800/20 border-l-2 border-l-transparent'
                    }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700/50 flex items-center justify-center text-[10px] font-bold text-slate-400 flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="text-[13px] font-medium text-slate-200 truncate">{c.name}</div>
                      {isSelected && <span className="text-[10px] text-indigo-400/70 font-medium ml-1">▲</span>}
                    </div>
                    <div className="text-[13px] text-slate-300 font-medium text-right">{fmt(c.revenue)}</div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.percentOfTotal > 20 ? 'bg-red-500' : c.percentOfTotal > 15 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(c.percentOfTotal * 2.5, 100)}%` }}/>
                        </div>
                        <span className="text-[12px] text-slate-400">{c.percentOfTotal.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div>
                      {c.industry ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px]">{INDUSTRY_META[c.industry as CustomerIndustry]?.icon ?? ''}</span>
                          <span className={`text-[10px] font-medium truncate max-w-[80px] ${INDUSTRY_META[c.industry as CustomerIndustry]?.accent ?? 'text-slate-500'}`}>
                            {INDUSTRY_META[c.industry as CustomerIndustry]?.label ?? c.industry}
                          </span>
                          {c.revenueType && (
                            <span className={`text-[9px] ml-0.5 ${c.revenueType === 'recurring' ? 'text-emerald-500/60' : c.revenueType === 'project' ? 'text-amber-500/60' : 'text-slate-600'}`}>
                              {c.revenueType === 'recurring' ? '↻' : c.revenueType === 'project' ? '◈' : '⊕'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                      )}
                    </div>
                    <div className="text-right">
                      {trendBadge ? (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${trendBadge.cls}`}>{trendBadge.label}</span>
                      ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${riskBg(c.percentOfTotal)} ${riskColor(c.percentOfTotal)}`}>
                        {riskLabel(c.percentOfTotal)}
                      </span>
                    </div>
                  </button>
                  {isSelected && (
                    <div className="mx-5 mb-3 bg-slate-800/25 border border-slate-700/40 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[13px] font-semibold text-slate-100">{c.name} — Detail</div>
                        {onAskAI && (
                          <button
                            onClick={() => onAskAI(`Tell me about ${c.name}: they're ${c.percentOfTotal.toFixed(1)}% of total revenue (${fmt(c.revenue)} this period). What are the key risks with this customer and how should we manage or grow this relationship?`)}
                            className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all font-medium">
                            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                              <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                              <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                            </svg>
                            Ask AI
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-800/40 rounded-lg px-3 py-2.5">
                          <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Period Revenue</div>
                          <div className="text-[15px] font-bold text-slate-100">{fmt(c.revenue)}</div>
                        </div>
                        <div className="bg-slate-800/40 rounded-lg px-3 py-2.5">
                          <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Rev Share</div>
                          <div className={`text-[15px] font-bold ${riskColor(c.percentOfTotal)}`}>{c.percentOfTotal.toFixed(1)}%</div>
                        </div>
                        <div className="bg-slate-800/40 rounded-lg px-3 py-2.5">
                          <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Annualized Est.</div>
                          <div className="text-[15px] font-bold text-slate-200">{fmt(annualRev)}</div>
                        </div>
                        <div className="bg-slate-800/40 rounded-lg px-3 py-2.5">
                          <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">LTV Est.</div>
                          <div className="text-[15px] font-bold text-slate-200">{fmt(ltvEst)}</div>
                          <div className="text-[9px] text-slate-600 mt-0.5">at {retentionPct.toFixed(0)}% retention</div>
                        </div>
                      </div>
                      {c.percentOfTotal > 15 && (
                        <div className={`mt-3 flex items-start gap-2 text-[11px] leading-relaxed ${c.percentOfTotal > 20 ? 'text-red-400/80' : 'text-amber-400/80'}`}>
                          <span className="flex-shrink-0 mt-0.5">{c.percentOfTotal > 20 ? '⚠' : '▲'}</span>
                          <span>
                            {c.percentOfTotal > 20
                              ? `High concentration risk — this customer represents ${c.percentOfTotal.toFixed(1)}% of revenue. Loss would directly impact EBITDA and depress valuation. Target: reduce below 15% within 12 months.`
                              : `Watch-list concentration — ${c.percentOfTotal.toFixed(1)}% is approaching the 20% high-risk threshold. Monitor closely and work to diversify revenue mix.`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </div>{/* /overflow-x-auto */}
        </div>
      )}
    </div>
  );
}

// ── Industry Stats Panel ─────────────────────────────────────────────────────
function IndustryStatsPanel({ industry, customers, totalRevenue }: {
  industry: CustomerIndustry;
  customers: UnifiedBusinessData['customers']['topCustomers'];
  totalRevenue: number;
}) {
  const meta = INDUSTRY_META[industry];
  if (!customers.length) return null;

  const industryCustomers = customers.filter(c => c.industry === industry);
  if (!industryCustomers.length) return null;

  const indRev   = industryCustomers.reduce((s, c) => s + c.revenue, 0);
  const indPct   = totalRevenue > 0 ? (indRev / totalRevenue) * 100 : 0;
  const avgRev   = indRev / industryCustomers.length;
  const recurring = industryCustomers.filter(c => c.revenueType === 'recurring');
  const project   = industryCustomers.filter(c => c.revenueType === 'project');
  const mixed     = industryCustomers.filter(c => c.revenueType === 'mixed');
  const recurringRev = recurring.reduce((s, c) => s + c.revenue, 0);
  const projectRev   = project.reduce((s, c) => s + c.revenue, 0);
  const topCust  = [...industryCustomers].sort((a, b) => b.revenue - a.revenue)[0];

  const fmtMon = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  const industryKPIs: { label: string; value: string; sub?: string }[] = [
    { label: 'Accounts', value: String(industryCustomers.length), sub: `${indPct.toFixed(1)}% of total rev` },
    { label: 'Segment Revenue', value: fmtMon(indRev), sub: `avg ${fmtMon(avgRev)}/acct` },
    { label: 'Recurring', value: `${indRev > 0 ? ((recurringRev / indRev) * 100).toFixed(0) : 0}%`, sub: `${recurring.length} accounts` },
    { label: 'Project-Based', value: `${indRev > 0 ? ((projectRev / indRev) * 100).toFixed(0) : 0}%`, sub: `${project.length + mixed.length} accounts` },
  ];

  // Industry-specific bonus KPI
  const bonusKPI = (() => {
    switch (industry) {
      case 'saas-technology': {
        const mrrEst = recurringRev / 6; // ~6 periods
        return { label: 'Est. Avg MRR/Acct', value: fmtMon(mrrEst / Math.max(recurring.length, 1)), sub: 'from subscription rev' };
      }
      case 'construction':
        return { label: 'Avg Project Value', value: fmtMon(indRev / Math.max(industryCustomers.length, 1)), sub: 'per engagement' };
      case 'healthcare':
        return { label: 'Compliance Accounts', value: `${recurring.length}`, sub: 'HIPAA-active contracts' };
      case 'manufacturing':
        return { label: 'Supply Contracts', value: `${recurring.length}`, sub: 'standing agreements' };
      case 'financial-services':
        return { label: 'AUA Est.', value: fmtMon(indRev * 15), sub: 'at 0.5% advisory fee rate' };
      default:
        return { label: 'Top Account', value: topCust ? topCust.name.split(' ').slice(0, 2).join(' ') : '—', sub: topCust ? fmtMon(topCust.revenue) : '' };
    }
  })();

  return (
    <div className={`rounded-xl border border-slate-700/40 bg-slate-800/20 p-4 mb-3`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{meta.icon}</span>
        <span className={`text-[13px] font-semibold ${meta.accent}`}>{meta.label} — Industry Snapshot</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[...industryKPIs, bonusKPI].map(kpi => (
          <div key={kpi.label} className="bg-slate-900/40 rounded-lg p-2.5">
            <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{kpi.label}</div>
            <div className={`text-[15px] font-bold ${meta.accent}`}>{kpi.value}</div>
            {kpi.sub && <div className="text-[9px] text-slate-600 mt-0.5">{kpi.sub}</div>}
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        {recurringRev > 0 && (
          <div className="flex items-start gap-2 text-slate-500">
            <span className="flex-shrink-0 text-emerald-400 mt-0.5">↻</span>
            <span>{meta.recurringNote}</span>
          </div>
        )}
        {projectRev > 0 && (
          <div className="flex items-start gap-2 text-slate-500">
            <span className="flex-shrink-0 text-amber-400 mt-0.5">◈</span>
            <span>{meta.projectNote}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerDashboard({ data, previousData, onAskAI }: Props) {
  const [sort, setSort]             = useState<SortKey>('revenue');
  const [search, setSearch]         = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [industryFilter, setIndustryFilter]     = useState<CustomerIndustry | 'all'>('all');
  const { customers } = data;
  const rev = data.revenue.total;

  const retentionPct = ((customers.retentionRate ?? 0.9) * 100);
  const top3Pct      = customers.topCustomers.slice(0, 3).reduce((s, c) => s + c.percentOfTotal, 0);
  const top5Pct      = customers.topCustomers.slice(0, 5).reduce((s, c) => s + c.percentOfTotal, 0);
  const netNew       = customers.newThisPeriod - customers.churned;
  const avgRev       = customers.avgRevenuePerCustomer ?? (rev / Math.max(customers.totalCount, 1));
  const ltv          = avgRev * (1 / Math.max(1 - (retentionPct / 100), 0.01)); // simplified LTV

  // Detect which industries are present in this data
  const presentIndustries = ALL_INDUSTRIES.filter(ind =>
    customers.topCustomers.some(c => c.industry === ind)
  );
  const hasIndustryData = presentIndustries.length > 0;

  const sorted = [...customers.topCustomers]
    .filter(c => {
      if (industryFilter !== 'all' && c.industry !== industryFilter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'name')    return a.name.localeCompare(b.name);
      if (sort === 'percent') return b.percentOfTotal - a.percentOfTotal;
      return b.revenue - a.revenue;
    });

  // Group into segments
  const segmentOrder = ['anchor', 'watch', 'core', 'tail'] as const;
  const segments = segmentOrder.map(id => ({
    id,
    customers: sorted.filter(c => getSegmentId(c.percentOfTotal) === id),
  })).filter(s => s.customers.length > 0);

  const chartData = customers.topCustomers.slice(0, 8).map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name,
    fullName: c.name,
    revenue: c.revenue,
    percent: c.percentOfTotal,
    risk: c.percentOfTotal > 20,
  }));

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => setSort(k)}
      className={`text-[11px] px-2 py-0.5 rounded-md transition-colors font-medium ${sort === k ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
    >
      {label}
    </button>
  );

  // Net Revenue Retention (NRR) approximation
  const nrr = (() => {
    const curRec  = data.revenue.recurring;
    const prevRec = previousData?.revenue.recurring;
    if (!curRec || !prevRec || prevRec <= 0) return null;
    // Subtract estimated new-customer recurring to isolate retained cohort
    const newCustFrac = customers.newThisPeriod / Math.max(customers.totalCount, 1);
    const retainedRecurring = curRec * (1 - newCustFrac);
    return (retainedRecurring / prevRec) * 100;
  })();

  return (
    <div className="space-y-5">
      {/* Health KPIs */}
      <div className={`grid grid-cols-2 ${nrr !== null ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
        {[
          { label: 'Total Customers', value: customers.totalCount.toString(), sub: 'active accounts', color: 'text-slate-100' },
          { label: 'Net New', value: netNew >= 0 ? `+${netNew}` : `${netNew}`, sub: `${customers.newThisPeriod} added · ${customers.churned} lost`, color: netNew > 0 ? 'text-emerald-400' : netNew < 0 ? 'text-red-400' : 'text-amber-400' },
          { label: 'Retention Rate', value: `${retentionPct.toFixed(1)}%`, sub: retentionPct >= 90 ? 'On target' : 'Below target', color: retentionPct >= 90 ? 'text-emerald-400' : retentionPct >= 80 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Avg Rev / Customer', value: fmt(avgRev), sub: 'per period', color: 'text-slate-100' },
          ...(nrr !== null ? [{
            label: 'Net Rev Retention',
            value: `${nrr.toFixed(0)}%`,
            sub: nrr >= 110 ? 'Expansion growth ↑' : nrr >= 100 ? 'Retained + flat' : 'Revenue contracting',
            color: nrr >= 110 ? 'text-emerald-400' : nrr >= 100 ? 'text-sky-400' : 'text-amber-400',
          }] : []),
        ].map(kpi => (
          <div key={kpi.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{kpi.label}</div>
            <div className={`text-[20px] font-bold tracking-tight ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[11px] text-slate-600 mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-5">
        {/* Customer revenue bar chart */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-semibold text-slate-100">Revenue by Customer</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Top {chartData.length} accounts</div>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-indigo-500"/><span className="text-slate-500">Normal</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500"/><span className="text-slate-500">&gt;20% concentration</span></span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false}/>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} width={40}/>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-xs shadow-xl">
                      <div className="font-semibold text-slate-100 mb-1">{d.fullName}</div>
                      <div className="text-slate-300">{fmt(d.revenue)}</div>
                      <div className={d.risk ? 'text-red-400 mt-0.5' : 'text-slate-500 mt-0.5'}>{d.percent.toFixed(1)}% of revenue</div>
                    </div>
                  );
                }}
                cursor={{ fill: 'rgba(148,163,184,0.04)' }}
              />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.risk ? '#ef4444' : d.percent > 15 ? '#f59e0b' : '#6366f1'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Concentration risk panel */}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="text-[13px] font-semibold text-slate-100 mb-4">Concentration Risk</div>
          <div className="space-y-3">
            {[
              { label: 'Top Customer', value: customers.topCustomers[0]?.percentOfTotal ?? 0 },
              { label: 'Top 3 Combined', value: top3Pct },
              { label: 'Top 5 Combined', value: top5Pct },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-400">{label}</span>
                  <span className={`text-[12px] font-bold ${value > 20 ? 'text-red-400' : value > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>{value.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${value > 20 ? 'bg-red-500' : value > 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(value * 1.5, 100)}%` }}/>
                </div>
              </div>
            ))}
          </div>
          {/* HHI Concentration Index */}
          {(() => {
            const hhi = customers.topCustomers.reduce((s, c) => s + (c.percentOfTotal / 100) ** 2, 0) * 10000;
            const hhiLabel = hhi < 1000 ? 'Diversified' : hhi < 1800 ? 'Moderate' : hhi < 2500 ? 'Concentrated' : 'Highly Concentrated';
            const hhiColor = hhi < 1000 ? 'text-emerald-400' : hhi < 1800 ? 'text-sky-400' : hhi < 2500 ? 'text-amber-400' : 'text-red-400';
            const hhiBg    = hhi < 1000 ? 'bg-emerald-500/10 border-emerald-500/20' : hhi < 1800 ? 'bg-sky-500/10 border-sky-500/20' : hhi < 2500 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
            // Gauge: HHI 0→4000 mapped to 0→100%
            const gaugeW = Math.min((hhi / 4000) * 100, 100);
            const hhiBuyerNote = hhi < 1000
              ? 'Clean concentration profile — M&A buyers will not require a discount'
              : hhi < 1800
              ? 'Moderate concentration — sophisticated buyers may request customer history'
              : hhi < 2500
              ? 'Elevated concentration — expect buyer due diligence focus and possible multiple discount'
              : 'High concentration — likely valuation haircut unless customer relationships are contractual';
            return (
              <div className="mt-4 pt-3 border-t border-slate-800/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">HHI Index</div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${hhiBg} ${hhiColor}`}>{hhiLabel}</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className={`text-[22px] font-bold tabular-nums ${hhiColor}`}>{Math.round(hhi).toLocaleString()}</span>
                  <span className="text-[10px] text-slate-600">/ 10,000</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${hhi < 1000 ? 'bg-emerald-500' : hhi < 1800 ? 'bg-sky-500' : hhi < 2500 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${gaugeW}%` }}/>
                </div>
                <div className="text-[10px] text-slate-600 leading-relaxed">{hhiBuyerNote}</div>
              </div>
            );
          })()}
          <div className="mt-4 pt-3 border-t border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Est. LTV</div>
            <div className="text-[18px] font-bold text-slate-100">{fmt(ltv)}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">Avg Rev / (1 - Retention)</div>
          </div>
        </div>
      </div>

      {/* Industry Revenue Mix */}
      <IndustryRevenueMix customers={customers.topCustomers} totalRevenue={rev} />

      {/* NRR KPI Card — prominent, above retention chart */}
      {(() => {
        // Derive NRR from retention data: NRR = retention × (1 + expansion) — approximate using retentionRate
        // If the data has nrr directly, use it; otherwise approximate from retentionRate
        const nrrPct = (data.customers as { nrr?: number }).nrr != null
          ? ((data.customers as { nrr?: number }).nrr! * 100)
          : retentionPct; // fallback: NRR ≈ retention when no expansion data
        const nrrColor = nrrPct >= 100 ? 'text-emerald-400' : nrrPct >= 90 ? 'text-amber-400' : 'text-red-400';
        const nrrBorderColor = nrrPct >= 100 ? 'border-emerald-500/25' : nrrPct >= 90 ? 'border-amber-500/25' : 'border-red-500/25';
        const nrrBg = nrrPct >= 100 ? 'bg-emerald-500/5' : nrrPct >= 90 ? 'bg-amber-500/5' : 'bg-red-500/5';
        return (
          <div className={`rounded-xl border ${nrrBorderColor} ${nrrBg} px-5 py-4 flex items-center gap-5`}>
            <div className="flex-shrink-0">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1">Net Revenue Retention (NRR)</div>
              <div className={`text-[32px] font-black tracking-tight ${nrrColor}`}>{nrrPct.toFixed(1)}%</div>
            </div>
            <div className="flex-1 border-l border-slate-800/60 pl-5">
              <div className={`text-[13px] font-semibold ${nrrColor}`}>
                {nrrPct >= 100
                  ? 'Expanding revenue from existing customers — upsell/expansion is working'
                  : nrrPct >= 90
                  ? 'Near-neutral — some revenue shrinkage from churn, offset partially by expansion'
                  : 'Revenue shrinking from churn — retention must improve before growth is sustainable'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {'>100% = expanding revenue from existing customers · <100% = revenue shrinking from churn'}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Customer Health Score + Revenue Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Portfolio Health Score */}
        {(() => {
          const topPct  = customers.topCustomers[0]?.percentOfTotal ?? 0;
          const top3    = customers.topCustomers.slice(0,3).reduce((s,c) => s + c.percentOfTotal, 0);
          // HHI-based concentration score: lower is safer
          const hhi     = customers.topCustomers.reduce((s,c) => s + (c.percentOfTotal/100)**2, 0);
          const hhiNorm = Math.min(hhi * 100, 100); // 0-100, lower = good
          // Scoring components
          const concScore   = Math.round(Math.max(0, 100 - hhiNorm * 1.2)); // concentration
          const retScore    = Math.round(Math.max(0, Math.min(100, retentionPct >= 95 ? 100 : retentionPct >= 90 ? 85 : retentionPct >= 80 ? 65 : retentionPct >= 70 ? 45 : 25)));
          const growthScore = netNew > 0 ? Math.min(100, 60 + netNew * 8) : netNew === 0 ? 55 : Math.max(20, 55 + netNew * 10);
          const divScore    = Math.min(100, customers.totalCount >= 20 ? 100 : customers.totalCount >= 10 ? 80 : customers.totalCount >= 5 ? 60 : 40);
          const overallScore = Math.round(concScore * 0.35 + retScore * 0.30 + growthScore * 0.20 + divScore * 0.15);
          const grade   = overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : overallScore >= 40 ? 'D' : 'F';
          const gc      = overallScore >= 85 ? 'text-emerald-400' : overallScore >= 70 ? 'text-sky-400' : overallScore >= 55 ? 'text-amber-400' : 'text-red-400';
          const bc      = overallScore >= 85 ? 'bg-emerald-500/60' : overallScore >= 70 ? 'bg-sky-500/60' : overallScore >= 55 ? 'bg-amber-500/60' : 'bg-red-500/60';
          const components = [
            { label: 'Concentration', score: concScore,   hint: topPct > 25 ? `Top customer at ${topPct.toFixed(0)}%` : `HHI: ${hhiNorm.toFixed(0)}` },
            { label: 'Retention',     score: retScore,    hint: `${retentionPct.toFixed(1)}% retention` },
            { label: 'Growth',        score: growthScore, hint: netNew >= 0 ? `+${netNew} net new` : `${netNew} net loss` },
            { label: 'Diversification', score: divScore,  hint: `${customers.totalCount} active accounts` },
          ];
          return (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
              <div className="text-[13px] font-semibold text-slate-100 mb-4">Customer Portfolio Health</div>
              <div className="flex items-start gap-5 mb-5">
                <div className="flex-shrink-0 text-center">
                  <div className={`text-[44px] font-black tracking-tight leading-none ${gc}`}>{grade}</div>
                  <div className={`text-[12px] font-semibold mt-1 ${gc}`}>{overallScore}/100</div>
                </div>
                <div className="flex-1 space-y-2">
                  {components.map(c => (
                    <div key={c.label}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-slate-500">{c.label}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{c.score}/100 · <span className="text-slate-600">{c.hint}</span></span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${c.score >= 75 ? 'bg-emerald-500/60' : c.score >= 50 ? 'bg-amber-500/60' : 'bg-red-500/60'}`}
                          style={{ width: `${c.score}%` }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {onAskAI && (
                <button
                  onClick={() => onAskAI(
                    `Customer portfolio health score: ${overallScore}/100 (${grade}). ` +
                    `Concentration score: ${concScore}, Retention: ${retScore} (${retentionPct.toFixed(1)}%), ` +
                    `Growth: ${growthScore} (${netNew >= 0 ? '+' : ''}${netNew} net new), Diversification: ${divScore}. ` +
                    `Top customer is ${topPct.toFixed(1)}% of revenue. What are the highest-priority improvements?`
                  )}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 border border-violet-500/25 hover:border-violet-500/40 px-3 py-2 rounded-lg transition-all font-medium"
                >
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                  Improve my customer health score
                </button>
              )}
            </div>
          );
        })()}

        {/* Revenue Retention Dynamics */}
        <RevenueRetentionChart data={data} />
      </div>

      {/* Customer Economics: LTV / LTV:CAC */}
      <CustomerEconomics data={data} />

      {/* Churn Revenue at Risk */}
      {(() => {
        const retention = customers.retentionRate ?? 0.9;
        const churnRate = 1 - retention;
        if (churnRate <= 0) return null;

        const totalCount = customers.totalCount;
        const avgRevPerCustomer = totalCount > 0 ? rev / totalCount : 0;

        // Customers at risk of churning this period
        const customersAtRisk = totalCount * churnRate;
        const revenueAtRisk = customersAtRisk * avgRevPerCustomer;

        // Annualized churn revenue (assumes period-level data)
        const periods = data.revenue.byPeriod.length || 1;
        const periodsPerYear = periods >= 10 ? 12 : periods >= 4 ? 4 : 1;
        const annualizedAtRisk = revenueAtRisk * periodsPerYear;

        // Impact of +5pp retention improvement
        const improvedRetention = Math.min(1, retention + 0.05);
        const improvedChurn = 1 - improvedRetention;
        const savedCustomers = (churnRate - improvedChurn) * totalCount;
        const savedRevenue = savedCustomers * avgRevPerCustomer * periodsPerYear;

        const churnPct = churnRate * 100;
        const severity = churnPct > 20 ? 'red' : churnPct > 10 ? 'amber' : 'slate';
        const severityText = severity === 'red' ? 'text-red-400' : severity === 'amber' ? 'text-amber-400' : 'text-slate-400';
        const severityBg = severity === 'red' ? 'bg-red-500/5 border-red-500/15' : severity === 'amber' ? 'bg-amber-500/5 border-amber-500/15' : 'bg-slate-900/50 border-slate-800/50';

        const fmtMon = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

        return (
          <div className={`rounded-xl border p-5 ${severityBg}`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="text-[13px] font-semibold text-slate-100">Churn Revenue at Risk</div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  severity === 'red' ? 'text-red-400 bg-red-500/10 border-red-500/25' :
                  severity === 'amber' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
                  'text-slate-400 bg-slate-800 border-slate-700/50'
                }`}>{churnPct.toFixed(1)}% churn rate</span>
              </div>
              {onAskAI && (
                <button
                  onClick={() => onAskAI(
                    `My customer churn rate is ${churnPct.toFixed(1)}% (retention: ${(retention * 100).toFixed(1)}%). ` +
                    `With ${totalCount} customers averaging ${fmtMon(avgRevPerCustomer)}/customer, ` +
                    `I'm losing ~${fmtMon(annualizedAtRisk)}/year to churn. ` +
                    `A +5pp retention improvement would save ${fmtMon(savedRevenue)}/year. ` +
                    `What are the highest-ROI actions to reduce churn?`
                  )}
                  className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-all"
                >
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                  How to reduce churn
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Customers at Risk</div>
                <div className={`text-[22px] font-bold tabular-nums leading-none ${severityText}`}>
                  {customersAtRisk < 1 ? customersAtRisk.toFixed(1) : Math.round(customersAtRisk)}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">per period</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Revenue at Risk</div>
                <div className={`text-[22px] font-bold tabular-nums leading-none ${severityText}`}>
                  {fmtMon(revenueAtRisk)}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">per period</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Annualized Risk</div>
                <div className="text-[22px] font-bold tabular-nums leading-none text-red-400">
                  {fmtMon(annualizedAtRisk)}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">projected annual loss</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">+5pp Retention Saves</div>
                <div className="text-[22px] font-bold tabular-nums leading-none text-emerald-400">
                  {fmtMon(savedRevenue)}
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">annualized</div>
              </div>
            </div>

            {/* Retention improvement impact bar */}
            <div className="bg-slate-800/40 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-500">Current retention: <span className="font-semibold text-slate-300">{(retention * 100).toFixed(1)}%</span></span>
                  <span className="text-[11px] text-slate-500">Target: <span className="font-semibold text-emerald-400">{(improvedRetention * 100).toFixed(1)}% (+5pp)</span></span>
                </div>
                <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/40 rounded-full" style={{ width: `${retention * 100}%` }}/>
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/60 flex-shrink-0"/>
                  <span className="text-[10px] text-slate-500">Each additional retention point saves ~{fmtMon(savedRevenue / 5)}/year</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Customer list — segmented by concentration tier */}
      <div className="space-y-2">
        {/* Industry filter tabs */}
        {hasIndustryData && (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-2.5">Filter by Industry</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setIndustryFilter('all'); setSelectedCustomer(null); }}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                  industryFilter === 'all'
                    ? 'bg-slate-700 text-slate-100 border-slate-600'
                    : 'text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                All ({customers.topCustomers.length})
              </button>
              {presentIndustries.map(ind => {
                const meta = INDUSTRY_META[ind];
                const count = customers.topCustomers.filter(c => c.industry === ind).length;
                const isActive = industryFilter === ind;
                return (
                  <button
                    key={ind}
                    onClick={() => { setIndustryFilter(ind); setSelectedCustomer(null); }}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? `bg-slate-700 ${meta.accent} border-slate-600`
                        : 'text-slate-500 border-slate-700/50 hover:text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span className={`text-[10px] ${isActive ? 'opacity-70' : 'opacity-50'}`}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Industry stats panel */}
        {industryFilter !== 'all' && (
          <IndustryStatsPanel
            industry={industryFilter}
            customers={customers.topCustomers}
            totalRevenue={rev}
          />
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[13px] font-semibold text-slate-100">
            {industryFilter !== 'all' ? (
              <span className="flex items-center gap-2">
                <span>{INDUSTRY_META[industryFilter].icon}</span>
                <span className={INDUSTRY_META[industryFilter].accent}>{INDUSTRY_META[industryFilter].label}</span>
                <span className="text-slate-600 font-normal">accounts</span>
              </span>
            ) : 'Customer Accounts'}
          </div>
          <div className="flex-1 min-w-0"/>
          <input
            type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            className="bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 w-40"/>
          <SortBtn k="revenue" label="Revenue" />
          <SortBtn k="percent" label="%" />
          <SortBtn k="name" label="Name" />
        </div>

        {segments.map(({ id, customers: segCusts }) => (
          <CustomerSegmentGroup
            key={id}
            segmentId={id}
            customers={segCusts}
            totalRevenue={rev}
            retentionPct={retentionPct}
            periodCount={data.revenue.byPeriod.length || 1}
            onAskAI={onAskAI}
            defaultExpanded={id === 'anchor' || id === 'watch'}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            previousData={previousData}
          />
        ))}

        <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 px-1">
          <div>
            Showing {sorted.length} account{sorted.length !== 1 ? 's' : ''}
            {industryFilter !== 'all' && <span className="text-slate-500"> · {INDUSTRY_META[industryFilter].label} only</span>}
            {' '}across {segments.length} tier{segments.length !== 1 ? 's' : ''}
          </div>
          <div>
            {industryFilter !== 'all' ? (
              <span>
                Segment: <span className="text-slate-400 font-medium">
                  {(() => { const v = sorted.reduce((s, c) => s + c.revenue, 0); return v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}k` : `$${v.toFixed(0)}`; })()}
                </span>
              </span>
            ) : (
              <span>Total: <span className="text-slate-400 font-medium">{fmt(rev)}</span></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
