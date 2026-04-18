import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import type { UnifiedBusinessData, KPIDashboard, WeeklyInsight, BoardDeck, Goals, Budget, CustomKPI } from '../types';
import KPIGrid from '../components/dashboard/KPIGrid';
import AlertFeed from '../components/dashboard/AlertFeed';
import RevenueChart from '../components/charts/RevenueChart';
import CostBreakdownChart from '../components/charts/CostBreakdownChart';
import CustomerMetricsChart from '../components/charts/CustomerMetricsChart';
import FinancialDashboard from '../components/dashboard/FinancialDashboard';
import CustomerDashboard from '../components/dashboard/CustomerDashboard';
import OperationsDashboard from '../components/dashboard/OperationsDashboard';
import IntelligenceDashboard from '../components/dashboard/IntelligenceDashboard';
import DataSourcePanel from '../components/dashboard/DataSourcePanel';
import ScenarioModeler from '../components/dashboard/ScenarioModeler';
import CustomKPIPanel from '../components/dashboard/CustomKPIPanel';
import TrendSignalsPanel from '../components/dashboard/TrendSignalsPanel';
import AIChat from '../components/AIChat';

// ── Types ──────────────────────────────────────────────────────────────────────
type ActiveView = 'overview' | 'financial' | 'customers' | 'operations' | 'intelligence' | 'scenarios' | 'data';
type ToastType  = 'success' | 'error' | 'info';
interface ToastItem { id: string; type: ToastType; message: string; }
interface PeriodSnapshot { id: string; label: string; data: UnifiedBusinessData; createdAt: string; }

// ── Toast ──────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl border shadow-2xl text-[13px] backdrop-blur-sm ${
          t.type === 'success' ? 'bg-slate-950/95 border-emerald-500/30' :
          t.type === 'error'   ? 'bg-slate-950/95 border-red-500/30'     :
                                  'bg-slate-950/95 border-slate-700/60'
        }`}>
          <span className={`flex-shrink-0 text-sm font-bold ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-indigo-400'}`}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'i'}
          </span>
          <span className="text-slate-200 leading-snug max-w-[260px]">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="flex-shrink-0 text-slate-600 hover:text-slate-300 text-xl leading-none ml-1 transition-colors">×</button>
        </div>
      ))}
    </div>
  );
}

// ── Business Health Score ──────────────────────────────────────────────────────
function BusinessHealthScore({ data, previousData, onAskAI }: { data: UnifiedBusinessData; previousData?: UnifiedBusinessData; onAskAI?: (msg: string) => void }) {
  const rev      = data.revenue.total;
  const cogs     = data.costs.totalCOGS;
  const opex     = data.costs.totalOpEx;
  const gp       = rev - cogs;
  const ebitda   = gp - opex;
  const prevRev  = previousData?.revenue.total ?? 0;
  const gpMargin     = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaMargin = rev > 0 ? (ebitda / rev) * 100 : 0;
  const revGrowth    = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0;
  const topCustPct   = data.customers.topCustomers[0]?.percentOfTotal ?? 0;
  const retention    = (data.customers.retentionRate ?? 0.88) * 100;

  // Score components (0–100 each)
  const revScore    = prevRev > 0 ? Math.max(0, Math.min(100, 50 + revGrowth * 2))           : 60;
  const marginScore = Math.max(0, Math.min(100, ebitdaMargin >= 20 ? 100 : ebitdaMargin >= 10 ? 75 : ebitdaMargin >= 0 ? 50 : 25));
  const gpScore     = Math.max(0, Math.min(100, gpMargin >= 60 ? 100 : gpMargin >= 40 ? 80 : gpMargin >= 25 ? 60 : 40));
  const custScore   = Math.max(0, Math.min(100, topCustPct <= 15 ? 100 : topCustPct <= 25 ? 75 : topCustPct <= 40 ? 50 : 25));
  const retScore    = Math.max(0, Math.min(100, retention >= 95 ? 100 : retention >= 85 ? 75 : retention >= 70 ? 50 : 25));

  const total = Math.round((revScore * 0.25 + marginScore * 0.25 + gpScore * 0.20 + custScore * 0.15 + retScore * 0.15));

  const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'F';
  const gradeColor = total >= 85 ? 'text-emerald-400' : total >= 70 ? 'text-sky-400' : total >= 55 ? 'text-amber-400' : 'text-red-400';
  const arcColor   = total >= 85 ? '#10b981' : total >= 70 ? '#38bdf8' : total >= 55 ? '#f59e0b' : '#ef4444';

  // SVG arc gauge
  const r = 54; const cx = 70; const cy = 70;
  const startAngle = -210; const sweepAngle = 240;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (pct: number) => {
    const end = startAngle + sweepAngle * (pct / 100);
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const large = sweepAngle * (pct / 100) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const components = [
    { label: 'Revenue Trend',    score: revScore,    icon: '↑' },
    { label: 'EBITDA Margin',    score: marginScore, icon: '◈' },
    { label: 'Gross Margin',     score: gpScore,     icon: '▲' },
    { label: 'Customer Risk',    score: custScore,   icon: '◎' },
    { label: 'Retention',        score: retScore,    icon: '↻' },
  ];

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
      {/* Gauge */}
      <div className="flex-shrink-0">
        <svg width="140" height="120" viewBox="0 0 140 110">
          {/* Track */}
          <path d={arcPath(100)} fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"/>
          {/* Fill */}
          {total > 0 && <path d={arcPath(total)} fill="none" stroke={arcColor} strokeWidth="8" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${arcColor}60)` }}/>}
          {/* Score */}
          <text x={cx} y={cy + 6} textAnchor="middle" className="font-bold" style={{ fill: arcColor, fontSize: 22, fontWeight: 700 }}>{total}</text>
          <text x={cx} y={cy + 22} textAnchor="middle" style={{ fill: '#64748b', fontSize: 10 }}>/ 100</text>
          {/* Grade */}
          <text x={cx} y={cy - 16} textAnchor="middle" style={{ fill: arcColor, fontSize: 11, fontWeight: 600 }}>{grade}</text>
        </svg>
        <div className="text-center -mt-2 text-[11px] font-semibold text-slate-500">Business Health</div>
      </div>

      {/* Components */}
      <div className="flex-1 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
        {components.map(c => {
          const color = c.score >= 75 ? 'text-emerald-400' : c.score >= 50 ? 'text-amber-400' : 'text-red-400';
          const bar   = c.score >= 75 ? 'bg-emerald-500/50' : c.score >= 50 ? 'bg-amber-500/50' : 'bg-red-500/50';
          return (
            <div key={c.label} className="space-y-1.5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] leading-tight">{c.label}</div>
              <div className={`text-[18px] font-bold ${color}`}>{c.score}</div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${c.score}%` }}/>
              </div>
            </div>
          );
        })}
        {onAskAI && (
          <div className="col-span-2 xs:col-span-3 sm:col-span-5 mt-1 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-600 leading-relaxed">
              {total >= 85 ? 'Strong across all dimensions — focus on growth.' :
               total >= 70 ? 'Solid fundamentals with room to improve.' :
               total >= 55 ? 'Some areas need attention — prioritize margin and retention.' :
               'Significant risks identified — review all components.'}
            </div>
            <button onClick={() => onAskAI(`My business health score is ${total}/100 (${grade}). Revenue trend ${revScore}/100, EBITDA margin ${marginScore}/100, gross margin ${gpScore}/100, customer concentration ${custScore}/100, retention ${retScore}/100. What are my top 3 most actionable improvements?`)}
              className="flex-shrink-0 ml-3 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
              Improve score
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Demo data ──────────────────────────────────────────────────────────────────
// All figures are internally consistent: total = sum(byPeriod), COGS/OpEx add up correctly.
const DEMO_DATA: UnifiedBusinessData = {
  revenue: {
    // Sum of 6 monthly periods below = 1,228,000
    total: 1228000, currency: 'USD',
    recurring: 737000,   // ~60% recurring (retainer / managed services)
    oneTime:   491000,   // ~40% project / one-time
    byPeriod: [
      { period: 'Oct 2024', periodType: 'monthly', revenue: 178000, cogs: 107000, ebitda: 26700  },
      { period: 'Nov 2024', periodType: 'monthly', revenue: 192000, cogs: 115000, ebitda: 28800  },
      { period: 'Dec 2024', periodType: 'monthly', revenue: 205000, cogs: 123000, ebitda: 30750  },
      { period: 'Jan 2025', periodType: 'monthly', revenue: 188000, cogs: 113000, ebitda: 28200  },
      { period: 'Feb 2025', periodType: 'monthly', revenue: 220000, cogs: 132000, ebitda: 33000  },
      { period: 'Mar 2025', periodType: 'monthly', revenue: 245000, cogs: 147000, ebitda: 36750  },
    ],
    byProduct: [
      { name: 'Managed Services',     amount: 614000, margin: 0.44 },
      { name: 'Consulting / Advisory', amount: 368000, margin: 0.42 },
      { name: 'Project Work',          amount: 246000, margin: 0.32 },
    ],
    byCustomer: [
      { id: 'acme',    name: 'Acme Corp',        amount: 245600, percent: 20   },
      { id: 'beta',    name: 'Beta Industries',   amount: 184200, percent: 15   },
      { id: 'gamma',   name: 'Gamma LLC',         amount: 147360, percent: 12   },
      { id: 'delta',   name: 'Delta Partners',    amount: 98240,  percent: 8    },
      { id: 'echo',    name: 'Echo Systems',       amount: 73680,  percent: 6    },
      { id: 'foxtrot', name: 'Foxtrot Group',      amount: 61400,  percent: 5    },
    ],
  },
  costs: {
    // COGS (737,000) + OpEx (307,000) = 1,044,000 total costs
    // GP = 1,228,000 − 737,000 = 491,000 (40.0% GM)
    // EBITDA = 491,000 − 307,000 = 184,000 (15.0% margin)
    totalCOGS: 737000,
    totalOpEx:  307000,
    byCategory: [
      // COGS categories (total 737,000)
      { category: 'Labor — Delivery',   amount: 445000, percentOfRevenue: 36.2 },
      { category: 'Subcontractors',     amount: 197000, percentOfRevenue: 16.0 },
      { category: 'Direct Overhead',    amount: 95000,  percentOfRevenue: 7.7  },
      // OpEx categories (total 307,000)
      { category: 'Sales & Marketing',  amount: 98000,  percentOfRevenue: 8.0  },
      { category: 'G&A',                amount: 118000, percentOfRevenue: 9.6  },
      { category: 'Tech & Systems',     amount: 91000,  percentOfRevenue: 7.4  },
    ],
    laborCost: 445000,
  },
  customers: {
    totalCount: 52, newThisPeriod: 5, churned: 2,
    topCustomers: [
      { id: 'acme',    name: 'Acme Corp',        revenue: 245600, percentOfTotal: 20.0 },
      { id: 'beta',    name: 'Beta Industries',   revenue: 184200, percentOfTotal: 15.0 },
      { id: 'gamma',   name: 'Gamma LLC',         revenue: 147360, percentOfTotal: 12.0 },
      { id: 'delta',   name: 'Delta Partners',    revenue: 98240,  percentOfTotal: 8.0  },
      { id: 'echo',    name: 'Echo Systems',       revenue: 73680,  percentOfTotal: 6.0  },
      { id: 'foxtrot', name: 'Foxtrot Group',      revenue: 61400,  percentOfTotal: 5.0  },
      { id: 'golf',    name: 'Gulf Dynamics',      revenue: 49120,  percentOfTotal: 4.0  },
      { id: 'hotel',   name: 'Harbor Tech',        revenue: 36840,  percentOfTotal: 3.0  },
      { id: 'india',   name: 'Inland Logistics',   revenue: 24560,  percentOfTotal: 2.0  },
      { id: 'juliet',  name: 'Juniper Capital',    revenue: 18420,  percentOfTotal: 1.5  },
    ],
    avgRevenuePerCustomer: 23615,
    retentionRate: 0.91,
    nps: 52,
  },
  operations: {
    headcount: 14,
    revenuePerEmployee: 87714,
    openPositions: 2,
    utilizationRate: 0.82,
  },
  pipeline: [
    { name: 'TechStart Inc — Enterprise Plan',    stage: 'Negotiation', value: 125000, probability: 75, closeDate: '2025-04-30', owner: 'Sarah K.' },
    { name: 'Global Logistics LLC',               stage: 'Proposal',    value: 220000, probability: 40, closeDate: '2025-05-20', owner: 'Mark D.' },
    { name: 'Metro Health Partners',              stage: 'Discovery',   value: 180000, probability: 20, closeDate: '2025-06-30', owner: 'Sarah K.' },
    { name: 'Pinnacle Mfg — Renewal',             stage: 'Negotiation', value: 95000,  probability: 80, closeDate: '2025-04-15', owner: 'Mark D.' },
    { name: 'Westfield Retail Group',             stage: 'Proposal',    value: 145000, probability: 35, closeDate: '2025-05-15', owner: 'Alex R.' },
    { name: 'Summit Capital Partners',            stage: 'Closed Won',  value: 88000,  probability: 100,closeDate: '2025-03-31', owner: 'Alex R.' },
    { name: 'Horizon Biotech',                    stage: 'Discovery',   value: 310000, probability: 15, closeDate: '2025-07-31', owner: 'Sarah K.' },
    { name: 'Pacific Coast Distribution',        stage: 'Negotiation', value: 72000,  probability: 65, closeDate: '2025-04-20', owner: 'Mark D.' },
  ],
  payrollByDept: [
    { department: 'Delivery / Operations', headcount: 5,  totalCompensation: 195000, avgSalary: 39000 },
    { department: 'Sales',                 headcount: 3,  totalCompensation: 108000, avgSalary: 36000 },
    { department: 'Engineering',           headcount: 3,  totalCompensation: 96000,  avgSalary: 32000 },
    { department: 'G&A / Admin',           headcount: 2,  totalCompensation: 60000,  avgSalary: 30000 },
    { department: 'Leadership',            headcount: 1,  totalCompensation: 84000,  avgSalary: 84000 },
  ],
  cashFlow: [
    { period: 'Oct 2024', openingBalance: 420000, receipts: 165000, payments: 138000, closingBalance: 447000, netCashFlow: 27000 },
    { period: 'Nov 2024', openingBalance: 447000, receipts: 178000, payments: 152000, closingBalance: 473000, netCashFlow: 26000 },
    { period: 'Dec 2024', openingBalance: 473000, receipts: 195000, payments: 164000, closingBalance: 504000, netCashFlow: 31000 },
    { period: 'Jan 2025', openingBalance: 504000, receipts: 172000, payments: 147000, closingBalance: 529000, netCashFlow: 25000 },
    { period: 'Feb 2025', openingBalance: 529000, receipts: 208000, payments: 170000, closingBalance: 567000, netCashFlow: 38000 },
    { period: 'Mar 2025', openingBalance: 567000, receipts: 235000, payments: 185000, closingBalance: 617000, netCashFlow: 50000 },
  ],
  arAging: [
    { customer: 'Acme Corp',       current: 68000, days30: 24000, days60: 0,     days90: 0,    over90: 0,    total: 92000 },
    { customer: 'Beta Industries', current: 52000, days30: 0,     days60: 14000, days90: 0,    over90: 0,    total: 66000 },
    { customer: 'Gamma LLC',       current: 38000, days30: 18000, days60: 0,     days90: 6000, over90: 0,    total: 62000 },
    { customer: 'Delta Partners',  current: 24000, days30: 8000,  days60: 0,     days90: 0,    over90: 0,    total: 32000 },
    { customer: 'Echo Systems',    current: 18000, days30: 0,     days60: 7000,  days90: 0,    over90: 4000, total: 29000 },
    { customer: 'Foxtrot Group',   current: 14000, days30: 0,     days60: 0,     days90: 0,    over90: 0,    total: 14000 },
  ],
  metadata: {
    sources: ['Demo Data'],
    asOf: new Date().toISOString(),
    coveragePeriod: { start: 'Oct 2024', end: 'Mar 2025' },
    completeness: 1.0,
    warnings: [],
  },
};

const PREV_DEMO: UnifiedBusinessData = {
  ...DEMO_DATA,
  revenue: {
    ...DEMO_DATA.revenue,
    total: 1040000,
    recurring: 624000,
    oneTime:   416000,
    byPeriod: [
      { period: 'Apr 2024', periodType: 'monthly', revenue: 148000, cogs: 89000,  ebitda: 22200 },
      { period: 'May 2024', periodType: 'monthly', revenue: 162000, cogs: 97000,  ebitda: 24300 },
      { period: 'Jun 2024', periodType: 'monthly', revenue: 175000, cogs: 105000, ebitda: 26250 },
      { period: 'Jul 2024', periodType: 'monthly', revenue: 165000, cogs: 99000,  ebitda: 24750 },
      { period: 'Aug 2024', periodType: 'monthly', revenue: 188000, cogs: 113000, ebitda: 28200 },
      { period: 'Sep 2024', periodType: 'monthly', revenue: 202000, cogs: 121000, ebitda: 30300 },
    ],
  },
  costs: {
    ...DEMO_DATA.costs,
    totalCOGS: 624000,
    totalOpEx:  260000,
  },
  customers: {
    ...DEMO_DATA.customers,
    totalCount: 47, newThisPeriod: 3, churned: 3,
    retentionRate: 0.87,
  },
  cashFlow: [
    { period: 'Apr 2024', openingBalance: 320000, receipts: 138000, payments: 118000, closingBalance: 340000, netCashFlow: 20000 },
    { period: 'May 2024', openingBalance: 340000, receipts: 150000, payments: 131000, closingBalance: 359000, netCashFlow: 19000 },
    { period: 'Jun 2024', openingBalance: 359000, receipts: 162000, payments: 140000, closingBalance: 381000, netCashFlow: 22000 },
    { period: 'Jul 2024', openingBalance: 381000, receipts: 152000, payments: 134000, closingBalance: 399000, netCashFlow: 18000 },
    { period: 'Aug 2024', openingBalance: 399000, receipts: 175000, payments: 151000, closingBalance: 423000, netCashFlow: 24000 },
    { period: 'Sep 2024', openingBalance: 423000, receipts: 188000, payments: 164000, closingBalance: 447000, netCashFlow: 24000 },
  ],
};

const DEMO_SNAPSHOT: PeriodSnapshot = { id: 'demo', label: 'Q1 2025 (Demo)', data: DEMO_DATA, createdAt: new Date().toISOString() };
const PREV_SNAPSHOT: PeriodSnapshot = { id: 'prev-demo', label: 'Q2–Q3 2024 (Demo)', data: PREV_DEMO, createdAt: new Date().toISOString() };

// ── Goals Panel ───────────────────────────────────────────────────────────────
type GoalKey = keyof Goals;
interface GoalRowDef {
  key: GoalKey;
  label: string;
  actual: number;
  format: (v: number) => string;
  placeholder: string;
  step: number;
}

function GoalsPanel({ data, goals, onSetGoal }: {
  data: UnifiedBusinessData;
  goals: Goals;
  onSetGoal: (key: GoalKey, value: number | undefined) => void;
}) {
  const [editing, setEditing] = useState<GoalKey | null>(null);
  const [draft, setDraft] = useState('');

  const rev      = data.revenue.total;
  const cogs     = data.costs.totalCOGS;
  const opex     = data.costs.totalOpEx;
  const gp       = rev - cogs;
  const ebitda   = gp - opex;
  const retention = (data.customers.retentionRate ?? 0.88) * 100;

  const fmtCur = (n: number) =>
    n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  const rows: GoalRowDef[] = [
    { key: 'revenue',       label: 'Revenue',       actual: rev,                                         format: fmtCur, placeholder: 'e.g. 1200000', step: 50000 },
    { key: 'ebitdaMargin',  label: 'EBITDA Margin', actual: rev > 0 ? (ebitda/rev)*100 : 0,              format: v => `${v.toFixed(1)}%`,   placeholder: 'e.g. 20',    step: 1 },
    { key: 'grossMargin',   label: 'Gross Margin',  actual: rev > 0 ? (gp/rev)*100 : 0,                  format: v => `${v.toFixed(1)}%`,   placeholder: 'e.g. 55',    step: 1 },
    { key: 'retentionRate', label: 'Retention',     actual: retention,                                   format: v => `${v.toFixed(1)}%`,   placeholder: 'e.g. 92',    step: 1 },
    { key: 'revenueGrowth', label: 'Rev Growth',    actual: (() => { const periods = data.revenue.byPeriod; if (periods.length >= 2) { const last = periods[periods.length - 1].revenue; const prev2 = periods[periods.length - 2].revenue; return prev2 > 0 ? ((last - prev2) / prev2) * 100 : 0; } return 0; })(),             format: v => `${v.toFixed(1)}%`,   placeholder: 'e.g. 20',    step: 1 },
  ];

  const startEdit = (key: GoalKey) => {
    const cur = goals[key];
    setDraft(cur !== undefined ? String(cur) : '');
    setEditing(key);
  };

  const commitEdit = (key: GoalKey) => {
    const num = parseFloat(draft);
    if (!isNaN(num) && num > 0) onSetGoal(key, num);
    else if (draft === '') onSetGoal(key, undefined);
    setEditing(null);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="text-[12px] font-semibold text-slate-300">Performance Targets</div>
        <div className="hidden sm:block text-[10px] text-slate-600">Click any target to edit · Enter to save</div>
      </div>
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
        {rows.map(row => {
          const target = goals[row.key];
          const attainment = target && target > 0 && row.actual > 0
            ? Math.min((row.actual / target) * 100, 150)
            : undefined;
          const isEditing = editing === row.key;
          const barColor = attainment !== undefined
            ? attainment >= 100 ? 'bg-emerald-500' : attainment >= 75 ? 'bg-amber-500' : 'bg-indigo-500/50'
            : 'bg-slate-700';

          return (
            <div key={row.key} className="space-y-1.5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">{row.label}</div>
              <div className="text-[14px] font-bold text-slate-100">{row.format(row.actual)}</div>

              {/* Editable target */}
              {isEditing ? (
                <input
                  autoFocus
                  type="number"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(row.key); if (e.key === 'Escape') setEditing(null); }}
                  onBlur={() => commitEdit(row.key)}
                  placeholder={row.placeholder}
                  step={row.step}
                  className="w-full bg-slate-800/80 border border-indigo-500/50 rounded-md px-2 py-0.5 text-[11px] text-slate-100 focus:outline-none tabular-nums"
                />
              ) : (
                <button
                  onClick={() => startEdit(row.key)}
                  className={`w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
                    target
                      ? 'text-slate-400 border-slate-800/40 hover:border-slate-700/60 hover:text-slate-300'
                      : 'text-slate-700 border-dashed border-slate-800/60 hover:border-slate-700 hover:text-slate-500'
                  }`}>
                  {target ? `Target: ${row.format(target)}` : '+ Set target'}
                </button>
              )}

              {/* Attainment bar */}
              <div className="h-1 bg-slate-800/60 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: attainment !== undefined ? `${Math.min(attainment, 100)}%` : '0%' }}/>
              </div>
              {attainment !== undefined && (
                <div className={`text-[9px] font-semibold ${attainment >= 100 ? 'text-emerald-400' : attainment >= 75 ? 'text-amber-400' : 'text-slate-600'}`}>
                  {attainment >= 100 ? '✓ On target' : `${attainment.toFixed(0)}% of target`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const Icons = {
  Overview: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>,
  Financial: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M2 9h3v3H2V9zm4-4h2v7H6V5zm4-3h2v10h-2V2zM1 13h12v1H1v-1z"/></svg>,
  Customers: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><circle cx="5" cy="4" r="2.5"/><path d="M0 12c0-2.76 2.24-5 5-5s5 2.24 5 5H0z"/><circle cx="11" cy="5" r="1.8"/><path d="M14 12c0-1.66-1.34-3-3-3-.48 0-.93.12-1.33.32A6.02 6.02 0 0111 12h3z"/></svg>,
  Operations: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M6 1a1 1 0 00-1 1v.26A5 5 0 002.37 8.5H2a1 1 0 000 2h.37A5 5 0 009 13.74V14a1 1 0 002 0v-.26A5 5 0 0013.63 8.5H14a1 1 0 000-2h-.37A5 5 0 009 2.26V2a1 1 0 00-1-1H6zm1 3a3 3 0 110 6 3 3 0 010-6z"/></svg>,
  Intelligence: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>,
  Data: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><ellipse cx="7" cy="3.5" rx="4.5" ry="2"/><path d="M2.5 6c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V3.5c0 1.1-2 2-4.5 2S2.5 4.6 2.5 3.5V6z"/><path d="M2.5 8.5c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V6c0 1.1-2 2-4.5 2S2.5 7.1 2.5 6v2.5z"/><path d="M2.5 11c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V8.5c0 1.1-2 2-4.5 2S2.5 9.6 2.5 8.5V11z"/></svg>,
  Scenarios: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M1 10h3v3H1v-3zm4-4h2v7H5V6zm4-5h2v12H9V1z"/><path d="M7 4.5L9.5 2 12 4.5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Spinner: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin flex-shrink-0"><path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/><path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/></svg>,
  Chevron: () => <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-2.5 h-2.5 flex-shrink-0"><path d="M2 3.5L5 6.5 8 3.5"/></svg>,
  Clock: () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="w-3 h-3 flex-shrink-0"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3.5l2 1.5"/></svg>,
  Check: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 flex-shrink-0"><path d="M2 6l3 3 5-5"/></svg>,
  Pencil: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8zM11 3l-1-1-7 7v1h1l7-7z"/></svg>,
  Alert: () => <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path d="M7.02 1.5l-6 11A1 1 0 002 14h12a1 1 0 00.98-1.5l-6-11a1 1 0 00-1.96 0zM9 11H7v2h2v-2zm0-5H7v4h2V6z"/></svg>,
};

// ── Period selector ────────────────────────────────────────────────────────────
function PeriodSelector({ snapshots, activeId, onSelect }: { snapshots: PeriodSnapshot[]; activeId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const active = snapshots.find(s => s.id === activeId);
  if (snapshots.length <= 1) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl text-[12px] font-medium text-slate-300 transition-all">
        <Icons.Clock /><span className="max-w-[120px] truncate">{active?.label ?? 'Select Period'}</span><Icons.Chevron />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}/>
          <div className="absolute right-0 top-full mt-1.5 z-40 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl w-60 py-1.5">
            <div className="px-3 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Period History</div>
            {snapshots.map(s => (
              <button key={s.id} onClick={() => { onSelect(s.id); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] transition-colors ${
                  s.id === activeId ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                <span className="truncate">{s.label}</span>
                {s.id === activeId && <Icons.Check />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Period name modal ──────────────────────────────────────────────────────────
function PeriodModal({ onConfirm, onSkip }: { onConfirm: (label: string) => void; onSkip: () => void }) {
  const [label, setLabel] = useState('');
  const quick = ['Q1 2025','Q2 2025','Q3 2025','Q4 2025','Jan 2025','Feb 2025','Mar 2025','YTD 2025','Full Year 2024'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onSkip}/>
      <div className="relative bg-[#0d1117] border border-slate-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="mb-4">
          <div className="text-[14px] font-semibold text-slate-100 mb-1">Name This Period</div>
          <div className="text-[12px] text-slate-400 leading-relaxed">Label this snapshot so you can navigate back to it and compare against future periods.</div>
        </div>
        <input autoFocus type="text" placeholder="e.g. Q1 2025, January 2025…"
          value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && label.trim()) onConfirm(label.trim()); if (e.key === 'Escape') onSkip(); }}
          className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 mb-3"/>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {quick.map(q => (
            <button key={q} onClick={() => setLabel(q)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${label === q ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onSkip} className="flex-1 px-4 py-2 text-[12px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-colors">Skip</button>
          <button onClick={() => onConfirm(label.trim() || 'Imported Data')}
            className="flex-1 px-4 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
            Save Period
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Company name editor (inline) ───────────────────────────────────────────────
function CompanyNameEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = () => { const v = draft.trim() || value; onChange(v); setEditing(false); };
  if (editing) {
    return (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className="bg-slate-800/80 border border-indigo-500/50 rounded-md px-2 py-0.5 text-[13px] font-semibold text-slate-100 focus:outline-none w-40"/>
    );
  }
  return (
    <button onClick={() => { setDraft(value); setEditing(true); }}
      className="group flex items-center gap-1.5 text-[13px] font-semibold text-slate-100 hover:text-slate-200 transition-colors">
      <span>{value}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-slate-400"><Icons.Pencil /></span>
    </button>
  );
}

// ── Quick-nav card colors (static classes — required for Tailwind JIT) ─────────
const NAV_CARD_COLORS: Record<string, { label: string; text: string; link: string; border: string; titleColor: string }> = {
  financial:    { label: 'Financials',            text: 'P&L, margins, cost waterfall, AR aging',          link: 'text-indigo-400 group-hover:text-indigo-300',   border: 'hover:border-indigo-500/30 group-hover:bg-indigo-500/5',   titleColor: 'group-hover:text-indigo-200'  },
  customers:    { label: 'Customers',             text: 'Concentration risk, LTV, retention cohorts',      link: 'text-violet-400 group-hover:text-violet-300',   border: 'hover:border-violet-500/30 group-hover:bg-violet-500/5',   titleColor: 'group-hover:text-violet-200'  },
  operations:   { label: 'Operations',            text: 'Headcount, pipeline, utilization, OpEx ratios',   link: 'text-cyan-400 group-hover:text-cyan-300',       border: 'hover:border-cyan-500/30 group-hover:bg-cyan-500/5',       titleColor: 'group-hover:text-cyan-200'    },
  intelligence: { label: 'AI Intelligence',       text: 'Weekly narrative, board deck, risk scan',         link: 'text-emerald-400 group-hover:text-emerald-300', border: 'hover:border-emerald-500/30 group-hover:bg-emerald-500/5', titleColor: 'group-hover:text-emerald-200' },
  scenarios:    { label: 'Scenarios',             text: 'Model what-if outcomes with lever sliders',       link: 'text-amber-400 group-hover:text-amber-300',     border: 'hover:border-amber-500/30 group-hover:bg-amber-500/5',     titleColor: 'group-hover:text-amber-200'   },
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function BusinessOS() {
  const [activeView, setActiveView]             = useState<ActiveView>('overview');
  const [snapshots, setSnapshots]               = useState<PeriodSnapshot[]>([DEMO_SNAPSHOT, PREV_SNAPSHOT]);
  const [activeSnapshotId, setActiveSnapshotId] = useState(DEMO_SNAPSHOT.id);
  const [pendingData, setPendingData]           = useState<UnifiedBusinessData | null>(null);
  const [showPeriodModal, setShowPeriodModal]   = useState(false);
  const [dashboard, setDashboard]               = useState<KPIDashboard | null>(null);
  const [weeklyInsight, setWeeklyInsight]       = useState<WeeklyInsight | null>(null);
  const [boardDeck, setBoardDeck]               = useState<BoardDeck | null>(null);
  const [alerts, setAlerts]                     = useState<{ severity: string; title: string; message: string; action: string }[]>([]);
  const [loading, setLoading]                   = useState<string | null>(null);
  const [toasts, setToasts]                     = useState<ToastItem[]>([]);
  const [companyName, setCompanyName]           = useState('My Company');
  const [chatOpen, setChatOpen]                 = useState(false);
  const [chatInitialMsg, setChatInitialMsg]     = useState<string | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen]       = useState(false);
  const [goals, setGoals]                       = useState<Goals>({});
  const [budget, setBudget]                     = useState<Budget>({});
  const [annotations, setAnnotations]           = useState<Record<string, string>>({});
  const [customKPIs, setCustomKPIs]             = useState<CustomKPI[]>([]);

  // Hydrate persisted state from localStorage (client-side only)
  useEffect(() => {
    const savedCompany = localStorage.getItem('bos_company');
    if (savedCompany) setCompanyName(savedCompany);
    try {
      const savedGoals = localStorage.getItem('bos_goals');
      if (savedGoals) setGoals(JSON.parse(savedGoals));
    } catch { /* ignore */ }
    try {
      const savedBudget = localStorage.getItem('bos_budget');
      if (savedBudget) setBudget(JSON.parse(savedBudget));
    } catch { /* ignore */ }
    try {
      const savedAnnotations = localStorage.getItem('bos_annotations');
      if (savedAnnotations) setAnnotations(JSON.parse(savedAnnotations));
    } catch { /* ignore */ }
    try {
      const savedCustomKPIs = localStorage.getItem('bos_custom_kpis');
      if (savedCustomKPIs) setCustomKPIs(JSON.parse(savedCustomKPIs));
    } catch { /* ignore */ }
  }, []);

  const saveCompanyName = useCallback((name: string) => {
    setCompanyName(name);
    localStorage.setItem('bos_company', name);
  }, []);

  const setGoal = useCallback((key: GoalKey, value: number | undefined) => {
    setGoals(prev => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      localStorage.setItem('bos_goals', JSON.stringify(next));
      return next;
    });
  }, []);

  const setBudgetLine = useCallback((key: keyof Budget, value: Budget[keyof Budget]) => {
    setBudget(prev => {
      const next = { ...prev, [key]: value };
      if (value === undefined) delete next[key];
      localStorage.setItem('bos_budget', JSON.stringify(next));
      return next;
    });
  }, []);

  const saveCustomKPIs = useCallback((kpis: CustomKPI[]) => {
    setCustomKPIs(kpis);
    localStorage.setItem('bos_custom_kpis', JSON.stringify(kpis));
  }, []);

  const setAnnotation = useCallback((period: string, note: string) => {
    setAnnotations(prev => {
      const next = { ...prev };
      if (note) next[period] = note;
      else delete next[period];
      localStorage.setItem('bos_annotations', JSON.stringify(next));
      return next;
    });
  }, []);

  // Toast helpers
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = String(Date.now());
    setToasts(prev => [...prev.slice(-2), { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // Derived state
  const activeSnapshot = snapshots.find(s => s.id === activeSnapshotId) ?? snapshots[0];
  const data           = activeSnapshot.data;
  const usingDemo      = activeSnapshot.id === DEMO_SNAPSHOT.id || activeSnapshot.id === PREV_SNAPSHOT.id;
  const prevSnapshot   = snapshots.find(s => s.id !== activeSnapshotId);
  const highAlerts     = alerts.filter(a => a.severity === 'HIGH');

  const runAction = useCallback(async (action: string) => {
    setLoading(action);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data, previousData: prevSnapshot?.data ?? PREV_DEMO }),
      });
      const result = await res.json();

      if (result.error) {
        addToast('error', result.error);
        return;
      }
      if (result.dashboard) {
        setDashboard(result.dashboard);
        if (action === 'compute-kpis') addToast('success', 'KPIs refreshed');
      }
      if (result.insight) {
        setWeeklyInsight(result.insight);
        setActiveView('intelligence');
        addToast('success', 'Weekly intelligence report generated');
      }
      if (result.deck) {
        setBoardDeck(result.deck);
        setActiveView('intelligence');
        addToast('success', 'Board deck generated');
      }
      if (result.alerts) {
        setAlerts(result.alerts);
        const high = (result.alerts as {severity: string}[]).filter(a => a.severity === 'HIGH').length;
        addToast(high > 0 ? 'error' : 'success', `${result.alerts.length} risk alert${result.alerts.length !== 1 ? 's' : ''} identified${high > 0 ? ` — ${high} high priority` : ''}`);
        setActiveView('intelligence');
      }
      if (action === 'full-report') {
        addToast('success', 'Full report generated — check the Intelligence tab');
        setActiveView('intelligence');
      }
    } catch {
      addToast('error', 'Generation failed. Verify ANTHROPIC_API_KEY is set in Vercel environment variables.');
    } finally {
      setLoading(null);
    }
  }, [data, prevSnapshot, addToast]);

  const handleDataUpdate = useCallback((newData: UnifiedBusinessData) => {
    setPendingData(newData);
    setShowPeriodModal(true);
  }, []);

  const handlePeriodConfirm = useCallback((label: string) => {
    if (!pendingData) return;
    const snap: PeriodSnapshot = { id: `snap-${Date.now()}`, label, data: pendingData, createdAt: new Date().toISOString() };
    setSnapshots(prev => [snap, ...prev.filter(s => !['demo','prev-demo'].includes(s.id)), PREV_SNAPSHOT, DEMO_SNAPSHOT]);
    setActiveSnapshotId(snap.id);
    setPendingData(null);
    setShowPeriodModal(false);
    setActiveView('overview');
    setDashboard(null);
    setWeeklyInsight(null);
    setBoardDeck(null);
    setAlerts([]);
    addToast('success', `Period "${label}" saved — viewing your real data`);
  }, [pendingData, addToast]);

  const handleDataSuccess = useCallback((msg: string) => {
    addToast('success', msg);
  }, [addToast]);

  const openChat = useCallback((msg?: string) => {
    setChatInitialMsg(msg);
    setChatOpen(true);
  }, []);

  // Keyboard shortcuts: 1–7 switch views, / opens chat
  useEffect(() => {
    const viewOrder: ActiveView[] = ['overview', 'financial', 'customers', 'operations', 'intelligence', 'scenarios', 'data'];
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); openChat(); return; }
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < viewOrder.length) setActiveView(viewOrder[idx]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openChat]);

  const isLoading = (action: string) => loading === action;

  const navItems: { id: ActiveView; label: string; Icon: () => JSX.Element; badge?: number; activeClass: string }[] = [
    { id: 'overview',     label: 'Overview',     Icon: Icons.Overview,     activeClass: 'bg-slate-800/80 text-slate-100' },
    { id: 'financial',    label: 'Financial',    Icon: Icons.Financial,    activeClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' },
    { id: 'customers',    label: 'Customers',    Icon: Icons.Customers,    activeClass: 'bg-violet-500/15 text-violet-300 border border-violet-500/20' },
    { id: 'operations',   label: 'Operations',   Icon: Icons.Operations,   activeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' },
    { id: 'intelligence', label: 'Intelligence', Icon: Icons.Intelligence, activeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20', badge: highAlerts.length || undefined },
    { id: 'scenarios',    label: 'Scenarios',    Icon: Icons.Scenarios,    activeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/20' },
    { id: 'data',         label: 'Data Sources', Icon: Icons.Data,         activeClass: 'bg-slate-800/80 text-slate-100' },
  ];

  const pageTitle: Record<ActiveView, string> = {
    overview:     'Performance Overview',
    financial:    'Financial Analysis',
    customers:    'Customer Intelligence',
    operations:   'Operations & Efficiency',
    intelligence: 'AI Intelligence',
    scenarios:    'Scenario Modeling',
    data:         'Data Sources',
  };

  const pageAccent: Record<ActiveView, string> = {
    overview:     'text-slate-400',
    financial:    'text-indigo-400',
    customers:    'text-violet-400',
    operations:   'text-cyan-400',
    intelligence: 'text-emerald-400',
    scenarios:    'text-amber-400',
    data:         'text-slate-400',
  };

  return (
    <>
      <Head>
        <title>{companyName} · Business OS</title>
        <meta name="description" content="AI-powered executive intelligence for your business"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
      </Head>

      <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col">

        {/* ── Print header (hidden on screen, shown when printing) ── */}
        <div className="hidden print:block print:mb-6 print:pb-4 print:border-b print:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[18px] font-bold text-slate-100">{companyName}</div>
              <div className="text-[12px] text-slate-400 mt-0.5">{pageTitle[activeView]} · {activeSnapshot.label}</div>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <div>Business OS</div>
              <div>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
        </div>

        {/* ── Header ── */}
        <header className="no-print border-b border-slate-800/60 bg-[#060a12]/95 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6 h-[52px] flex items-center gap-2.5 md:gap-4">

            {/* Brand */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-[26px] h-[26px] rounded-[6px] bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shadow-sm flex-shrink-0">
                <svg viewBox="0 0 12 12" fill="white" className="w-3.5 h-3.5"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
              </div>
              <div className="hidden sm:block">
                <CompanyNameEditor value={companyName} onChange={saveCompanyName} />
                <div className="text-[9px] font-medium text-slate-600 tracking-wide uppercase -mt-0.5">Business OS</div>
              </div>
              <div className="sm:hidden text-[13px] font-semibold text-slate-100 truncate max-w-[100px]">{companyName}</div>
            </div>

            <div className="hidden md:block h-4 w-px bg-slate-800/80 flex-shrink-0"/>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto">
              {navItems.map(({ id, label, Icon, badge, activeClass }) => (
                <button key={id} onClick={() => setActiveView(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    activeView === id ? activeClass : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 border border-transparent'}`}>
                  <Icon/>{label}
                  {badge ? <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ml-0.5">{badge}</span> : null}
                </button>
              ))}
            </nav>

            {/* Mobile: current view label */}
            <div className="md:hidden flex-1 text-[12px] font-medium text-slate-400 truncate">
              {pageTitle[activeView]}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              {usingDemo && (
                <span className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium bg-amber-500/8 text-amber-400/80 border border-amber-500/15 px-2.5 py-[5px] rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse"/>Demo
                </span>
              )}
              <PeriodSelector snapshots={snapshots} activeId={activeSnapshotId} onSelect={id => { setActiveSnapshotId(id); addToast('info', `Viewing: ${snapshots.find(s => s.id === id)?.label}`); }}/>
              <button onClick={() => runAction('full-report')} disabled={!!loading}
                className="flex items-center gap-1.5 px-2.5 md:px-3.5 py-[7px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[12px] font-semibold transition-all shadow-sm">
                {isLoading('full-report') ? <><Icons.Spinner/><span className="hidden sm:inline">Running…</span></> : <><span className="hidden sm:inline">✦ Run Report</span><span className="sm:hidden">✦</span></>}
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileNavOpen(v => !v)}
                className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  {mobileNavOpen
                    ? <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                    : <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile nav drawer */}
          {mobileNavOpen && (
            <div className="md:hidden border-t border-slate-800/60 bg-[#060a12]/98 px-3 py-2.5 flex flex-col gap-0.5 animate-fade-in">
              {navItems.map(({ id, label, Icon, badge, activeClass }) => (
                <button key={id} onClick={() => { setActiveView(id); setMobileNavOpen(false); }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    activeView === id ? activeClass : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'}`}>
                  <Icon/>{label}
                  {badge ? <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ml-auto">{badge}</span> : null}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ── Breadcrumb / page bar ── */}
        <div className="border-b border-slate-800/40 bg-slate-900/15">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className={`text-[13px] font-semibold flex-shrink-0 ${pageAccent[activeView]}`}>{pageTitle[activeView]}</span>
              <span className="text-slate-700">·</span>
              <span className="text-[11px] text-slate-500 font-medium">{activeSnapshot.label}</span>
              <span className="text-slate-700">·</span>
              <span className={`text-[11px] font-medium ${data.metadata.completeness >= 0.9 ? 'text-emerald-500/70' : 'text-amber-500/70'}`}>
                {Math.round(data.metadata.completeness * 100)}% coverage
              </span>
            </div>
            <div className="flex items-center gap-2 no-print">
              {activeView === 'overview' && (
                <button onClick={() => runAction('compute-kpis')} disabled={!!loading}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-3 py-1 rounded-lg transition-all disabled:opacity-40 font-medium">
                  {isLoading('compute-kpis') ? <><Icons.Spinner/>Computing…</> : '↺ Refresh KPIs'}
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-3 py-1 rounded-lg transition-all font-medium"
                title="Export to PDF — use browser Print → Save as PDF">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                  <path d="M3 1h8v4H3V1zM1 6h12v6H1V6zm2 2h2v1H3V8zm0 2h4v1H3v-1zM11 8h-1v1h1V8z"/>
                </svg>
                Export PDF
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 sm:py-6 flex-1 w-full">

          {/* High-priority alert banner (visible on all tabs except intelligence) */}
          {highAlerts.length > 0 && activeView !== 'intelligence' && (
            <div className="mb-5 bg-red-500/5 border border-red-500/20 rounded-xl px-4 sm:px-5 py-3.5 flex items-start gap-3">
              <span className="text-red-400 mt-0.5 flex-shrink-0"><Icons.Alert/></span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-red-300 mb-1">{highAlerts.length} high-priority alert{highAlerts.length > 1 ? 's' : ''} need attention</div>
                <div className="space-y-0.5">{highAlerts.map((a, i) => <div key={i} className="text-xs text-red-400/80 truncate">{a.title}: {a.message}</div>)}</div>
              </div>
              <button onClick={() => setActiveView('intelligence')}
                className="flex-shrink-0 text-[11px] text-red-400/70 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                Review →
              </button>
            </div>
          )}

          {/* ── Overview ── */}
          {activeView === 'overview' && (
            <div className="space-y-5">

              {/* Demo nudge */}
              {usingDemo && (
                <div className="border border-indigo-500/15 bg-indigo-500/[0.04] rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"/>
                      <div className="text-[13px] font-semibold text-slate-200">You're viewing demo data</div>
                    </div>
                    <div className="text-[12px] text-slate-400 leading-relaxed">
                      Connect your accounting, CRM, or billing system to unlock live AI analysis on your real numbers.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setActiveView('data')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm whitespace-nowrap">
                      Connect data →
                    </button>
                  </div>
                </div>
              )}

              <BusinessHealthScore data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
              <GoalsPanel data={data} goals={goals} onSetGoal={setGoal}/>
              <KPIGrid dashboard={dashboard} data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} goals={goals}/>
              <RevenueChart data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} revenueGoal={goals.revenue} annotations={annotations} onAnnotate={setAnnotation} onAskAI={openChat}/>

              <TrendSignalsPanel data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                <CostBreakdownChart data={data}/>
                <CustomerMetricsChart data={data}/>
                <AlertFeed alerts={alerts} onRunAlerts={() => runAction('alerts')} loading={isLoading('alerts')}/>
              </div>

              <CustomKPIPanel kpis={customKPIs} onChange={saveCustomKPIs} onAskAI={openChat}/>

              {/* Quick nav cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 pt-1">
                {(Object.entries(NAV_CARD_COLORS) as [ActiveView, typeof NAV_CARD_COLORS[string]][]).map(([id, cfg]) => (
                  <button key={id} onClick={() => setActiveView(id)}
                    className={`group bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-left transition-all ${cfg.border}`}>
                    <div className={`text-[12px] font-semibold text-slate-200 mb-1 transition-colors ${cfg.titleColor}`}>{cfg.label}</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed mb-2">{cfg.text}</div>
                    <div className={`text-[11px] font-medium transition-colors ${cfg.link}`}>Open →</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeView === 'financial' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-px flex-1 bg-indigo-500/10"/>
                <button onClick={() => openChat('Analyze my P&L: revenue, margins, cost structure. What are the biggest risks and the top 2 actions I should take?')}
                  className="flex items-center gap-1.5 text-[12px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/8 hover:bg-indigo-500/15 border border-indigo-500/25 hover:border-indigo-500/50 px-3 py-1.5 rounded-lg transition-all font-medium mx-3">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                  Ask AI CFO about financials
                </button>
                <div className="h-px flex-1 bg-indigo-500/10"/>
              </div>
              <FinancialDashboard data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} dashboard={dashboard} budget={budget} onSetBudget={setBudgetLine} annotations={annotations} onAnnotate={setAnnotation} onAskAI={openChat}/>
            </div>
          )}
          {activeView === 'customers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-px flex-1 bg-violet-500/10"/>
                <button onClick={() => openChat(`Analyze my customer base: ${data.customers.totalCount} total customers, top customer at ${data.customers.topCustomers[0]?.percentOfTotal?.toFixed(1)}%, ${((data.customers.retentionRate ?? 0.88)*100).toFixed(0)}% retention. What's the biggest customer risk and how do I address it?`)}
                  className="flex items-center gap-1.5 text-[12px] text-violet-400 hover:text-violet-300 bg-violet-500/8 hover:bg-violet-500/15 border border-violet-500/25 hover:border-violet-500/50 px-3 py-1.5 rounded-lg transition-all font-medium mx-3">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                  Ask AI CFO about customers
                </button>
                <div className="h-px flex-1 bg-violet-500/10"/>
              </div>
              <CustomerDashboard data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
            </div>
          )}
          {activeView === 'operations' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-px flex-1 bg-cyan-500/10"/>
                <button onClick={() => openChat(`Analyze my operations: ${data.operations.headcount ?? 'unknown'} headcount, OpEx is ${((data.costs.totalOpEx / data.revenue.total)*100).toFixed(1)}% of revenue. Where are the biggest efficiency opportunities?`)}
                  className="flex items-center gap-1.5 text-[12px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/8 hover:bg-cyan-500/15 border border-cyan-500/25 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-all font-medium mx-3">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                  Ask AI CFO about operations
                </button>
                <div className="h-px flex-1 bg-cyan-500/10"/>
              </div>
              <OperationsDashboard data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
            </div>
          )}
          {activeView === 'intelligence' && <IntelligenceDashboard weeklyInsight={weeklyInsight} boardDeck={boardDeck} alerts={alerts} loading={loading} onGenerate={runAction}/>}
          {activeView === 'scenarios'   && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-px flex-1 bg-amber-500/10"/>
                <button onClick={() => openChat('Help me understand what scenario I should be planning for. Based on my current financials, what are the most important variables to model — revenue growth, margins, or headcount?')}
                  className="flex items-center gap-1.5 text-[12px] text-amber-400 hover:text-amber-300 bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/25 hover:border-amber-500/50 px-3 py-1.5 rounded-lg transition-all font-medium mx-3">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
                  Ask AI what to model
                </button>
                <div className="h-px flex-1 bg-amber-500/10"/>
              </div>
              <ScenarioModeler data={data} onAskAI={openChat}/>
            </div>
          )}
          {activeView === 'data'         && <DataSourcePanel data={data} onDataUpdate={handleDataUpdate} onSuccess={handleDataSuccess}/>}
        </main>

        {/* ── Period name modal ── */}
        {showPeriodModal && (
          <PeriodModal
            onConfirm={handlePeriodConfirm}
            onSkip={() => { handlePeriodConfirm('Imported Data'); }}
          />
        )}

        {/* ── Floating AI Chat button ── */}
        {!chatOpen && (
          <button
            onClick={() => openChat()}
            className="no-print fixed bottom-5 right-5 z-[145] flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[13px] font-semibold shadow-2xl transition-all hover:scale-105 active:scale-95"
            style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
              <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
              <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
            </svg>
            Ask AI
          </button>
        )}

        {/* ── AI Chat panel ── */}
        <AIChat
          data={data}
          open={chatOpen}
          onClose={() => { setChatOpen(false); setChatInitialMsg(undefined); }}
          initialMessage={chatInitialMsg}
          onInitialMessageSent={() => setChatInitialMsg(undefined)}
        />

        {/* ── Toasts ── */}
        <ToastContainer toasts={toasts} dismiss={dismissToast}/>
      </div>
    </>
  );
}
