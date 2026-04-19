import { useState } from 'react';
import type { UnifiedBusinessData, PipelineDeal, PayrollRecord } from '../../types';
import CostBreakdownChart from '../charts/CostBreakdownChart';

// ── Collapsible cost group ─────────────────────────────────────────────────────
const COGS_KEYWORDS = ['cogs','cost of goods','cost of sales','materials','direct labor',
  'labor','direct cost','overhead','cost of revenue'];
function isCOGS(cat: string) {
  const c = cat.toLowerCase();
  return COGS_KEYWORDS.some(k => c.includes(k));
}

function CostGroupRow({
  label, amount, pct, color, barColor, indent = false,
}: { label: string; amount: number; pct: number; color: string; barColor: string; indent?: boolean }) {
  return (
    <div className={indent ? 'pl-4' : ''}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {indent
            ? <span className="text-slate-700 text-[10px] select-none">—</span>
            : <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${barColor.replace('/50','')}`}/>}
          <span className={`text-[12px] ${color}`}>{label}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500">{pct.toFixed(1)}%</span>
          <span className="text-[12px] font-medium text-slate-200 w-16 text-right">
            {amount >= 1_000_000 ? `$${(amount/1_000_000).toFixed(1)}M` : amount >= 1_000 ? `$${(amount/1_000).toFixed(0)}k` : `$${amount.toFixed(0)}`}
          </span>
        </div>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct * 2, 100)}%` }}/>
      </div>
    </div>
  );
}

function CostGroup({
  label, total, totalRev, items, accentColor, barColor, tagLabel, defaultExpanded = false,
}: {
  label: string; total: number; totalRev: number; defaultExpanded?: boolean;
  items: { category: string; amount: number }[];
  accentColor: string; barColor: string; tagLabel: string;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const pct = totalRev > 0 ? (total / totalRev) * 100 : 0;
  const fmtAmt = (n: number) =>
    n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-slate-800/30 transition-colors group">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className={`w-2.5 h-2.5 flex-shrink-0 ${accentColor} transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
            <path d="M2 3.5L5 6.5 8 3.5"/>
          </svg>
          <span className={`text-[12px] font-semibold ${accentColor}`}>{label}</span>
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${barColor.includes('red') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
            {tagLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500">{pct.toFixed(1)}% of rev</span>
          <span className={`text-[13px] font-bold ${accentColor} tabular-nums`}>{fmtAmt(total)}</span>
        </div>
      </button>
      {open && (
        <div className="mt-1 mb-2 pl-2 border-l border-slate-800/60 space-y-2.5">
          {items.length > 0 ? items.map((item, i) => (
            <CostGroupRow
              key={i}
              label={item.category}
              amount={item.amount}
              pct={totalRev > 0 ? (item.amount / totalRev) * 100 : 0}
              color="text-slate-400"
              barColor={barColor}
              indent
            />
          )) : (
            <div className="text-[11px] text-slate-600 py-1 pl-4">No line items available</div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `$${(n/1_000).toFixed(0)}k` :
  `$${n.toFixed(0)}`;

// ── Pipeline Stage config ─────────────────────────────────────────────────────
const STAGE_ORDER = ['discovery', 'qualified', 'proposal', 'negotiation', 'closed won', 'closed lost'];
const STAGE_COLORS: Record<string, string> = {
  discovery:    'bg-slate-700/60 text-slate-400',
  qualified:    'bg-sky-500/20 text-sky-400',
  proposal:     'bg-indigo-500/20 text-indigo-400',
  negotiation:  'bg-violet-500/20 text-violet-400',
  'closed won': 'bg-emerald-500/20 text-emerald-400',
  'closed lost':'bg-red-500/20 text-red-400',
};

function normalizeStage(stage: string): string {
  const s = stage.toLowerCase().trim();
  if (s.includes('discovery') || s.includes('prospect')) return 'discovery';
  if (s.includes('qualif')) return 'qualified';
  if (s.includes('proposal') || s.includes('demo')) return 'proposal';
  if (s.includes('negotiat') || s.includes('contract')) return 'negotiation';
  if (s.includes('won') || s.includes('closed won') || s.includes('win')) return 'closed won';
  if (s.includes('lost') || s.includes('closed lost')) return 'closed lost';
  return s;
}

// ── Pipeline Panel ─────────────────────────────────────────────────────────────
function PipelinePanel({ deals, totalRevenue }: { deals: PipelineDeal[]; totalRevenue: number }) {
  const activeDeals = deals.filter(d => !['closed won','closed lost'].includes(normalizeStage(d.stage)));
  const wonDeals    = deals.filter(d => normalizeStage(d.stage) === 'closed won');
  const lostDeals   = deals.filter(d => normalizeStage(d.stage) === 'closed lost');
  const totalPipeline  = deals.reduce((s, d) => s + d.value, 0);
  const weightedPipeline = deals.reduce((s, d) => s + d.value * (d.probability / 100), 0);
  const avgDealSize = activeDeals.length > 0 ? activeDeals.reduce((s, d) => s + d.value, 0) / activeDeals.length : 0;

  // Deal Velocity: avg days from created to closed (for won deals with dates)
  const closedWithDates = wonDeals.filter(d => d.createdDate && d.closeDate);
  const avgDaysToClose  = closedWithDates.length > 0
    ? closedWithDates.reduce((s, d) => {
        const ms = new Date(d.closeDate!).getTime() - new Date(d.createdDate!).getTime();
        return s + ms / (1000 * 60 * 60 * 24);
      }, 0) / closedWithDates.length
    : null;

  // Stuck deals: daysInStage > 30 (or derived from stageEnteredDate)
  const stuckDeals = activeDeals.filter(d => (d.daysInStage ?? 0) > 30);

  // Win rate
  const closedDeals = wonDeals.length + lostDeals.length;
  const winRate = closedDeals > 0 ? (wonDeals.length / closedDeals) * 100 : null;

  // Stage grouping
  const byStage: Record<string, { count: number; value: number }> = {};
  for (const d of activeDeals) {
    const stage = normalizeStage(d.stage);
    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0 };
    byStage[stage].count++;
    byStage[stage].value += d.value;
  }

  const orderedStages = STAGE_ORDER.filter(s => s !== 'closed won' && s !== 'closed lost' && byStage[s]);
  const maxValue = Math.max(...orderedStages.map(s => byStage[s]?.value ?? 0), 1);

  const pipelineCoverage = totalRevenue > 0 ? (weightedPipeline / totalRevenue) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Pipeline KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open Deals',         value: activeDeals.length.toString(),  color: 'text-sky-400' },
          { label: 'Total Pipeline',     value: fmt(totalPipeline),             color: 'text-slate-100' },
          { label: 'Weighted Pipeline',  value: fmt(weightedPipeline),          color: 'text-indigo-400' },
          { label: 'Avg Deal Size',      value: fmt(avgDealSize),               color: 'text-violet-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{m.label}</div>
            <div className={`text-[20px] font-bold tracking-tight ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Deal Velocity Metrics */}
      {(avgDaysToClose !== null || winRate !== null || stuckDeals.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {avgDaysToClose !== null && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">Avg Days to Close</div>
              <div className={`text-[20px] font-bold tracking-tight ${avgDaysToClose <= 30 ? 'text-emerald-400' : avgDaysToClose <= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {Math.round(avgDaysToClose)}d
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">{closedWithDates.length} won deals w/ dates</div>
            </div>
          )}
          {winRate !== null && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">Win Rate</div>
              <div className={`text-[20px] font-bold tracking-tight ${winRate >= 40 ? 'text-emerald-400' : winRate >= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                {winRate.toFixed(0)}%
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">{wonDeals.length}W / {lostDeals.length}L</div>
            </div>
          )}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">Stuck Deals</div>
            <div className={`text-[20px] font-bold tracking-tight ${stuckDeals.length === 0 ? 'text-emerald-400' : stuckDeals.length <= 2 ? 'text-amber-400' : 'text-red-400'}`}>
              {stuckDeals.length}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">30+ days in same stage</div>
          </div>
        </div>
      )}

      {/* Stuck deals callout */}
      {stuckDeals.length > 0 && (
        <div className="bg-amber-500/4 border border-amber-500/15 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-amber-300 mb-2">
            {stuckDeals.length} deal{stuckDeals.length !== 1 ? 's' : ''} stalled for 30+ days
          </div>
          <div className="space-y-1">
            {stuckDeals.slice(0,5).map((d, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 truncate">{d.name}</span>
                <span className="text-amber-400/70 flex-shrink-0 ml-2">{d.daysInStage}d in {d.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline coverage */}
      {totalRevenue > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-semibold text-slate-300">Pipeline Coverage Ratio</div>
            <div className={`text-[13px] font-bold ${pipelineCoverage >= 300 ? 'text-emerald-400' : pipelineCoverage >= 150 ? 'text-amber-400' : 'text-red-400'}`}>
              {pipelineCoverage.toFixed(0)}%
            </div>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1.5">
            <div className={`h-full rounded-full transition-all ${pipelineCoverage >= 300 ? 'bg-emerald-500/60' : pipelineCoverage >= 150 ? 'bg-amber-500/60' : 'bg-red-500/60'}`}
              style={{ width: `${Math.min(pipelineCoverage / 4, 100)}%` }}/>
          </div>
          <div className="text-[11px] text-slate-600">
            {pipelineCoverage >= 300 ? 'Strong pipeline — well-covered against revenue target' :
             pipelineCoverage >= 150 ? 'Adequate pipeline — some risk if conversion rates drop' :
             'Thin pipeline — needs immediate top-of-funnel attention'}
          </div>
        </div>
      )}

      {/* Stage Funnel */}
      {orderedStages.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="text-[13px] font-semibold text-slate-100 mb-4">Pipeline by Stage</div>
          <div className="space-y-2">
            {orderedStages.map(stage => {
              const info = byStage[stage];
              const barWidth = (info.value / maxValue) * 100;
              const colorClass = STAGE_COLORS[stage] ?? 'bg-slate-700/60 text-slate-400';
              const [bgColor] = colorClass.split(' ');
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold capitalize px-2 py-0.5 rounded-md ${colorClass}`}>{stage}</span>
                      <span className="text-[11px] text-slate-500">{info.count} deal{info.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-[12px] font-medium text-slate-200">{fmt(info.value)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bgColor} transition-all`} style={{ width: `${barWidth}%` }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deals Table */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between">
          <div className="text-[13px] font-semibold text-slate-100">Deal List</div>
          <span className="text-[11px] text-slate-500">{activeDeals.length} active</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/40">
                {['Deal Name','Stage','Value','Probability','Weighted','Close Date','Owner'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDeals.sort((a, b) => b.value - a.value).map((deal, i) => {
                const stage = normalizeStage(deal.stage);
                const colorClass = STAGE_COLORS[stage] ?? 'text-slate-400';
                const [, textColor] = colorClass.split(' ');
                const weighted = deal.value * (deal.probability / 100);
                return (
                  <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 text-[12px] font-medium text-slate-100">{deal.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold capitalize px-2 py-0.5 rounded-md ${colorClass}`}>{deal.stage}</span>
                    </td>
                    <td className="px-4 py-3 text-[12px] font-medium text-slate-200">{fmt(deal.value)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500/50 rounded-full" style={{ width: `${deal.probability}%` }}/>
                        </div>
                        <span className="text-[11px] text-slate-400">{deal.probability}%</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-[12px] font-medium ${textColor}`}>{fmt(weighted)}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{deal.closeDate ?? '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{deal.owner ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Payroll Breakdown ─────────────────────────────────────────────────────────
function PayrollBreakdown({ departments }: { departments: PayrollRecord[] }) {
  const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0);
  const totalComp = departments.reduce((s, d) => s + d.totalCompensation, 0);
  const sorted = [...departments].sort((a, b) => b.totalCompensation - a.totalCompensation);

  const DEPT_COLORS = ['bg-indigo-500/50', 'bg-violet-500/50', 'bg-sky-500/50', 'bg-cyan-500/50', 'bg-pink-500/50', 'bg-amber-500/50', 'bg-emerald-500/50', 'bg-rose-500/50'];

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-semibold text-slate-100">Headcount by Department</div>
        <div className="text-[12px] text-slate-500">{totalHeadcount} total · {fmt(totalComp)} total comp</div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-px">
        {sorted.map((d, i) => (
          <div key={d.department} title={`${d.department}: ${d.headcount}`}
            className={`${DEPT_COLORS[i % DEPT_COLORS.length]} transition-all`}
            style={{ width: `${(d.headcount / totalHeadcount) * 100}%` }}/>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((dept, i) => {
          const hcPct   = totalHeadcount > 0 ? (dept.headcount / totalHeadcount) * 100 : 0;
          const compPct = totalComp > 0 ? (dept.totalCompensation / totalComp) * 100 : 0;
          const avgSal  = dept.avgSalary ?? (dept.headcount > 0 ? dept.totalCompensation / dept.headcount : 0);
          return (
            <div key={dept.department} className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${DEPT_COLORS[i % DEPT_COLORS.length]}`}/>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-slate-200">{dept.department}</div>
              </div>
              <div className="text-[11px] text-slate-500 w-8 text-right">{dept.headcount}</div>
              <div className="text-[11px] text-slate-600 w-8 text-right">{hcPct.toFixed(0)}%</div>
              <div className="text-[12px] font-medium text-slate-300 w-16 text-right">{fmt(dept.totalCompensation)}</div>
              {avgSal > 0 && <div className="text-[11px] text-slate-600 w-20 text-right">{fmt(avgSal)}/yr</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function OperationsDashboard({ data, previousData, onAskAI }: Props) {
  const { operations, revenue, costs, customers } = data;
  const headcount    = operations.headcount ?? 0;
  const rev          = revenue.total;
  const cogs         = costs.totalCOGS;
  const opex         = costs.totalOpEx;
  const totalCost    = cogs + opex;
  const ebitda       = rev - totalCost;

  const revPerEmp    = headcount > 0 ? rev / headcount : 0;
  const cogsPerEmp   = headcount > 0 ? cogs / headcount : 0;
  const ebitdaPerEmp = headcount > 0 ? ebitda / headcount : 0;
  const costPerEmp   = headcount > 0 ? totalCost / headcount : 0;
  const grossProfit  = rev - cogs;
  const gpPerEmp     = headcount > 0 ? grossProfit / headcount : 0;

  const prevHeadcount   = previousData?.operations.headcount ?? 0;
  const prevRev         = previousData?.revenue.total ?? 0;
  const prevRevPerEmp   = prevHeadcount > 0 ? prevRev / prevHeadcount : 0;
  const chg = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0;

  const utilizationRate = operations.utilizationRate;
  // Utilization impact: unused capacity revenue = (1 - utilization) × (revPerEmp × headcount)
  const unusedCapacityRev = utilizationRate != null && utilizationRate < 0.9 && headcount > 0
    ? (1 - utilizationRate) * (revPerEmp * headcount)
    : null;

  const efficiencyMetrics = [
    {
      label: 'Revenue / Employee',
      value: revPerEmp,
      change: prevRevPerEmp ? chg(revPerEmp, prevRevPerEmp) : undefined,
      target: 100000,
      targetLabel: '$100k target',
      color: revPerEmp >= 100000 ? 'text-emerald-400' : revPerEmp >= 60000 ? 'text-amber-400' : 'text-red-400',
      sub: undefined as string | undefined,
    },
    {
      label: 'GP / Employee',
      value: gpPerEmp,
      change: undefined,
      targetLabel: '>$100k is strong',
      color: gpPerEmp >= 100000 ? 'text-emerald-400' : gpPerEmp >= 60000 ? 'text-amber-400' : 'text-red-400',
      sub: 'More meaningful than revenue/employee',
    },
    {
      label: 'EBITDA / Employee',
      value: ebitdaPerEmp,
      change: undefined,
      targetLabel: '',
      color: ebitdaPerEmp > 0 ? 'text-emerald-400' : 'text-red-400',
      sub: undefined as string | undefined,
    },
    {
      label: 'Revenue / $ of OpEx',
      value: opex > 0 ? rev / opex : 0,
      change: undefined,
      targetLabel: 'operating leverage',
      color: rev / Math.max(opex, 1) >= 3 ? 'text-emerald-400' : 'text-amber-400',
      isMult: true,
      sub: undefined as string | undefined,
    },
  ];

  const hasPipeline    = data.pipeline && data.pipeline.length > 0;
  const hasPayrollDept = data.payrollByDept && data.payrollByDept.length > 0;

  return (
    <div className="space-y-5">

      {/* Headcount banner */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Current Headcount</div>
            {headcount > 0 ? (
              <>
                <div className="text-[28px] font-bold text-slate-100 tracking-tight">{headcount}</div>
                <div className="text-[12px] text-slate-500 mt-1">full-time equivalents</div>
              </>
            ) : (
              <div className="text-[14px] text-slate-500">Connect payroll data or upload operations CSV to see headcount metrics</div>
            )}
          </div>
          {headcount > 0 && (
            <div className="grid grid-cols-3 gap-5 text-center">
              <div>
                <div className="text-[10px] text-slate-500 mb-1">Revenue / Head</div>
                <div className="text-[16px] font-bold text-slate-100">{fmt(revPerEmp)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-1">COGS / Head</div>
                <div className="text-[16px] font-bold text-slate-100">{fmt(cogsPerEmp)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-1">Customers / Head</div>
                <div className="text-[16px] font-bold text-slate-100">
                  {(customers.totalCount / Math.max(headcount, 1)).toFixed(1)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Efficiency KPIs */}
      {headcount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {efficiencyMetrics.map(m => (
            <div key={m.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{m.label}</div>
              <div className={`text-[18px] font-bold tracking-tight ${m.color}`}>
                {m.isMult ? `${(m.value).toFixed(1)}×` : fmt(m.value)}
              </div>
              {m.change !== undefined && (
                <div className={`text-[11px] mt-1 font-medium ${m.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.change >= 0 ? '↑' : '↓'} {Math.abs(m.change).toFixed(1)}%
                </div>
              )}
              {m.targetLabel && m.change === undefined && (
                <div className="text-[11px] text-slate-600 mt-1">{m.targetLabel}</div>
              )}
              {m.sub && (
                <div className="text-[10px] text-slate-700 mt-0.5 leading-snug">{m.sub}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Utilization Impact Analysis */}
      {utilizationRate != null && utilizationRate < 0.9 && unusedCapacityRev != null && headcount > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-3.5 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400 font-bold text-sm">
            {Math.round(utilizationRate * 100)}%
          </div>
          <div>
            <div className="text-[12px] font-semibold text-amber-300">
              At {(utilizationRate * 100).toFixed(0)}% utilization, you&apos;re leaving approximately {fmt(unusedCapacityRev)} of billable capacity unrealized.
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Unused capacity = (1 − utilization) × (revenue per employee × headcount). Reaching 90% utilization unlocks this revenue.
            </div>
          </div>
        </div>
      )}

      {/* Payroll breakdown */}
      {hasPayrollDept && <PayrollBreakdown departments={data.payrollByDept!}/>}

      {/* Cost breakdown + OpEx detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CostBreakdownChart data={data} />

        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="text-[13px] font-semibold text-slate-100 mb-1">Cost Detail</div>
          <div className="text-[11px] text-slate-600 mb-4">Expand each category to see line items</div>

          {data.costs.byCategory.length > 0 ? (() => {
            const cogsItems = data.costs.byCategory.filter(c => isCOGS(c.category));
            const opexItems = data.costs.byCategory.filter(c => !isCOGS(c.category));
            const cogsTotal = cogsItems.reduce((s, c) => s + c.amount, cogs > 0 && cogsItems.length === 0 ? cogs : 0);
            const opexTotal = opexItems.reduce((s, c) => s + c.amount, opex > 0 && opexItems.length === 0 ? opex : 0);
            return (
              <div className="space-y-1 divide-y divide-slate-800/40">
                <CostGroup
                  label="Cost of Goods Sold" total={cogsTotal > 0 ? cogsTotal : cogs}
                  totalRev={rev} items={cogsItems}
                  accentColor="text-red-400" barColor="bg-red-500/50"
                  tagLabel="COGS" defaultExpanded={false}
                />
                <div className="pt-1">
                  <CostGroup
                    label="Operating Expenses" total={opexTotal > 0 ? opexTotal : opex}
                    totalRev={rev} items={opexItems}
                    accentColor="text-amber-400" barColor="bg-amber-500/50"
                    tagLabel="OpEx" defaultExpanded={false}
                  />
                </div>
              </div>
            );
          })() : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-1">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-4 h-4 text-slate-600"><path d="M2 9h3v3H2V9zm4-4h2v7H6V5zm4-3h2v10h-2V2zM1 13h12v1H1v-1z"/></svg>
              </div>
              <div className="text-[12px] font-semibold text-slate-500">No cost detail yet</div>
              <div className="text-[11px] text-slate-700 max-w-[180px] leading-relaxed">Upload a cost breakdown CSV to see COGS and OpEx by category</div>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-slate-600 mb-1">Total COGS</div>
              <div className="text-[14px] font-bold text-red-400">{fmt(cogs)}</div>
              <div className="text-[10px] text-slate-600">{rev > 0 ? ((cogs/rev)*100).toFixed(1) : '0'}% of revenue</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-600 mb-1">Total OpEx</div>
              <div className="text-[14px] font-bold text-amber-400">{fmt(opex)}</div>
              <div className="text-[10px] text-slate-600">{rev > 0 ? ((opex/rev)*100).toFixed(1) : '0'}% of revenue</div>
            </div>
          </div>
        </div>
      </div>

      {/* Operating ratios */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-semibold text-slate-100">Key Operating Ratios</div>
          {onAskAI && (
            <button onClick={() => onAskAI(`My operations: ${headcount} headcount, revenue/employee is ${fmt(revPerEmp)}, operating leverage is ${opex > 0 ? (rev/opex).toFixed(1) : '?'}x. Where are the biggest efficiency opportunities?`)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
              Ask AI
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'OpEx as % of Gross Profit', value: rev > 0 && (rev - cogs) > 0 ? ((opex / (rev - cogs)) * 100).toFixed(1) + '%' : '—', hint: 'Measures OpEx efficiency against gross profit' },
            { label: 'COGS as % of Revenue', value: rev > 0 ? ((cogs/rev)*100).toFixed(1) + '%' : '—', hint: 'Cost intensity of service/product delivery' },
            { label: 'Operating Leverage', value: opex > 0 ? `${(rev/opex).toFixed(1)}×` : '—', hint: 'Revenue generated per $1 of OpEx' },
            { label: 'Customer Efficiency', value: customers.totalCount > 0 ? fmt(rev/customers.totalCount) : '—', hint: 'Revenue per active customer relationship' },
          ].map(({ label, value, hint }) => (
            <div key={label} className="bg-slate-800/30 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-300 mb-1.5">{label}</div>
              <div className="text-[18px] font-bold text-slate-100">{value}</div>
              <div className="text-[10px] text-slate-600 mt-1 leading-relaxed">{hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sales Pipeline */}
      {hasPipeline ? (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Sales Pipeline</div>
            <div className="flex-1 h-px bg-sky-500/10"/>
            {onAskAI && (
              <button onClick={() => onAskAI(`Analyze my sales pipeline: ${data.pipeline!.length} deals, weighted pipeline of ${fmt(data.pipeline!.reduce((s, d) => s + d.value * d.probability / 100, 0))}. What should I prioritize to close more deals this quarter?`)}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
                Ask AI
              </button>
            )}
          </div>
          <PipelinePanel deals={data.pipeline!} totalRevenue={rev}/>
        </div>
      ) : (
        <div className="bg-sky-500/4 border border-sky-500/15 rounded-xl p-5 flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0 text-lg">🎯</div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-slate-200 mb-0.5">Sales Pipeline</div>
            <div className="text-[12px] text-slate-500">Upload your CRM pipeline export to see deal funnel, weighted pipeline value, and coverage ratio</div>
          </div>
        </div>
      )}
    </div>
  );
}
