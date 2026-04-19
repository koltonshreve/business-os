import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fmtMoney } from '../../lib/format';
import type { UnifiedBusinessData } from '../../types';
import RevenueRetentionChart from '../charts/RevenueRetentionChart';

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
  defaultExpanded, selectedCustomer, onSelectCustomer,
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
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-5 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-900/30 min-w-[480px]">
            <div>Customer</div>
            <div className="text-right">Revenue</div>
            <div className="text-right">% of Total</div>
            <div className="text-right">Share Trend</div>
            <div className="text-right">Risk</div>
          </div>
          <div className="divide-y divide-slate-800/30">
            {customers.map((c, i) => {
              const isSelected = selectedCustomer === c.id;
              const annualRev  = Math.round(c.revenue * (12 / periodCount));
              const ltvEst     = c.revenue / Math.max(1 - (retentionPct / 100), 0.01);
              return (
                <div key={c.id}>
                  <button
                    onClick={() => onSelectCustomer(isSelected ? null : c.id)}
                    className={`w-full grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 transition-colors text-left min-w-[480px] ${
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
                    <div className="text-[12px] text-slate-500 text-right">—</div>
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

export default function CustomerDashboard({ data, previousData, onAskAI }: Props) {
  const [sort, setSort]         = useState<SortKey>('revenue');
  const [search, setSearch]     = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const { customers } = data;
  const rev = data.revenue.total;

  const retentionPct = ((customers.retentionRate ?? 0.9) * 100);
  const top3Pct      = customers.topCustomers.slice(0, 3).reduce((s, c) => s + c.percentOfTotal, 0);
  const top5Pct      = customers.topCustomers.slice(0, 5).reduce((s, c) => s + c.percentOfTotal, 0);
  const netNew       = customers.newThisPeriod - customers.churned;
  const avgRev       = customers.avgRevenuePerCustomer ?? (rev / Math.max(customers.totalCount, 1));
  const ltv          = avgRev * (1 / Math.max(1 - (retentionPct / 100), 0.01)); // simplified LTV

  const sorted = [...customers.topCustomers]
    .filter(c => {
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

  return (
    <div className="space-y-5">
      {/* Health KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Customers', value: customers.totalCount.toString(), sub: 'active accounts', color: 'text-slate-100' },
          { label: 'Net New', value: netNew >= 0 ? `+${netNew}` : `${netNew}`, sub: `${customers.newThisPeriod} added · ${customers.churned} lost`, color: netNew > 0 ? 'text-emerald-400' : netNew < 0 ? 'text-red-400' : 'text-amber-400' },
          { label: 'Retention Rate', value: `${retentionPct.toFixed(1)}%`, sub: retentionPct >= 90 ? 'On target' : 'Below target', color: retentionPct >= 90 ? 'text-emerald-400' : retentionPct >= 80 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Avg Rev / Customer', value: fmt(avgRev), sub: 'per period', color: 'text-slate-100' },
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
          <div className="mt-4 pt-3 border-t border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Risk Thresholds</div>
            <div className="space-y-1">
              {[
                { color: 'bg-red-500', label: '>20% single customer — HIGH risk' },
                { color: 'bg-amber-500', label: '15-20% — watch list' },
                { color: 'bg-emerald-500', label: '<15% — acceptable' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 text-[10px] text-slate-500">
                  <div className={`w-2 h-2 rounded-full ${color}`}/>
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/60">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Est. LTV</div>
            <div className="text-[18px] font-bold text-slate-100">{fmt(ltv)}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">Avg Rev / (1 - Retention)</div>
          </div>
        </div>
      </div>

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

      {/* Customer list — segmented by concentration tier */}
      <div className="space-y-2">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[13px] font-semibold text-slate-100">Customer Accounts</div>
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
          />
        ))}

        <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 px-1">
          <div>Showing {sorted.length} account{sorted.length !== 1 ? 's' : ''} across {segments.length} tier{segments.length !== 1 ? 's' : ''}</div>
          <div>Total: <span className="text-slate-400 font-medium">{fmt(rev)}</span></div>
        </div>
      </div>
    </div>
  );
}
