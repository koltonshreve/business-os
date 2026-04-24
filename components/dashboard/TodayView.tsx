// ─── TodayView ────────────────────────────────────────────────────────────────
// Extracted Today tab — business health snapshot, action checklist, tax calendar,
// week-at-a-glance, CEO notes, AI meeting parser, and daily priorities.

import React, { useState, useCallback, useMemo } from 'react';
import type { UnifiedBusinessData } from '../../types';
import DailyPriorities from '../deals/DailyPriorities';

type ActiveView = 'deals' | 'today' | 'overview' | 'financial' | 'customers' | 'operations' |
  'intelligence' | 'scenarios' | 'data' | 'pipeline' | 'automations' | 'acquisitions' |
  'goals' | 'team' | 'cash' | 'execute' | 'suppliers' | 'skus' | 'capacity' |
  'purchasing' | 'valuation';

interface Props {
  data: UnifiedBusinessData;
  effectiveData: UnifiedBusinessData;
  companyName: string;
  openChat: (msg?: string) => void;
  setActiveView: (v: ActiveView) => void;
  onOpenDeal: (dealId: string) => void;
}

// ── formatters ────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
}
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

// ── Tax calendar data ─────────────────────────────────────────────────────────

type TaxItem = { id: string; date: string; label: string; category: string; critical: boolean };

function buildTaxItems(year: number): TaxItem[] {
  return [
    { id: `q1-est-${year}`,     date: `${year}-04-15`, label: 'Q1 Estimated Tax Payment (Federal)',        category: 'Estimated Tax', critical: true  },
    { id: `q1-payroll-${year}`, date: `${year}-04-30`, label: 'Q1 Payroll Tax Deposit (Form 941)',         category: 'Payroll',       critical: true  },
    { id: `q2-est-${year}`,     date: `${year}-06-17`, label: 'Q2 Estimated Tax Payment (Federal)',        category: 'Estimated Tax', critical: true  },
    { id: `q2-payroll-${year}`, date: `${year}-07-31`, label: 'Q2 Payroll Tax Deposit (Form 941)',         category: 'Payroll',       critical: true  },
    { id: `q3-est-${year}`,     date: `${year}-09-16`, label: 'Q3 Estimated Tax Payment (Federal)',        category: 'Estimated Tax', critical: true  },
    { id: `q3-payroll-${year}`, date: `${year}-10-31`, label: 'Q3 Payroll Tax Deposit (Form 941)',         category: 'Payroll',       critical: true  },
    { id: `q4-est-${year}`,     date: `${year}-01-15`, label: `Q4 Estimated Tax Payment (${year} tax yr)`, category: 'Estimated Tax', critical: true  },
    { id: `q4-payroll-${year}`, date: `${year}-01-31`, label: 'Q4 Payroll Tax Deposit (Form 941)',         category: 'Payroll',       critical: true  },
    { id: `corp-return-${year}`,date: `${year}-03-15`, label: 'S-Corp / Partnership Return (Form 1120-S/1065)', category: 'Annual Filing', critical: true },
    { id: `personal-${year}`,   date: `${year}-04-15`, label: 'Personal Tax Return (Form 1040)',           category: 'Annual Filing', critical: true  },
    { id: `w2-${year}`,         date: `${year}-01-31`, label: 'W-2s to Employees',                        category: 'Payroll',       critical: true  },
    { id: `1099-${year}`,       date: `${year}-01-31`, label: '1099-NEC to Contractors',                  category: 'Payroll',       critical: false },
    { id: `sales-tax-q1-${year}`, date: `${year}-04-20`, label: 'Q1 Sales Tax Filing (varies by state)', category: 'Sales Tax',  critical: false },
    { id: `sales-tax-q2-${year}`, date: `${year}-07-20`, label: 'Q2 Sales Tax Filing (varies by state)', category: 'Sales Tax',  critical: false },
    { id: `sales-tax-q3-${year}`, date: `${year}-10-20`, label: 'Q3 Sales Tax Filing (varies by state)', category: 'Sales Tax',  critical: false },
    { id: `boi-${year}`,        date: `${year}-12-31`, label: 'FinCEN BOI Report (beneficial ownership)', category: 'Compliance', critical: true  },
  ];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricGrid({ data, effectiveData, openChat }: { data: UnifiedBusinessData; effectiveData: UnifiedBusinessData; openChat: (msg?: string) => void }) {
  const rev          = data.revenue.total;
  const cogs         = data.costs.totalCOGS;
  const opex         = data.costs.totalOpEx;
  const grossProfit  = rev - cogs;
  const grossMargin  = rev > 0 ? grossProfit / rev : 0;
  const ebitda       = rev - cogs - opex;
  const ebitdaMargin = rev > 0 ? ebitda / rev : 0;
  const cashLatest   = data.cashFlow?.length ? data.cashFlow[data.cashFlow.length - 1].closingBalance : null;
  const burnRate     = data.cashFlow && data.cashFlow.length >= 2
    ? data.cashFlow[data.cashFlow.length - 1].closingBalance - data.cashFlow[data.cashFlow.length - 2].closingBalance
    : null;
  const activeDeals  = (data.pipeline ?? []).filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');
  const weighted     = activeDeals.reduce((s, d) => s + d.value * (d.probability / 100), 0);
  const customers    = data.customers;
  const churnRate    = customers.retentionRate != null ? (1 - customers.retentionRate) : null;
  const utilization  = data.operations.employeeUtilization ?? data.operations.utilizationRate ?? data.operations.capacityUtilization ?? null;

  type Stat = { label: string; value: string; sub: string; color: string; border: string };
  const stats: Stat[] = [
    {
      label: 'Revenue',
      value: fmtMoney(rev),
      sub: `Gross margin ${rev > 0 ? fmtPct(grossMargin) : '—'}`,
      color: 'text-slate-100',
      border: 'border-slate-800/50',
    },
    {
      label: 'EBITDA',
      value: fmtMoney(ebitda),
      sub: `${rev > 0 ? fmtPct(ebitdaMargin) : '—'} margin`,
      color: ebitda >= 0 ? 'text-emerald-400' : 'text-red-400',
      border: ebitda >= 0 ? 'border-emerald-500/20' : 'border-red-500/20',
    },
    ...(cashLatest !== null ? [{
      label: 'Cash',
      value: fmtMoney(cashLatest),
      sub: burnRate !== null ? (burnRate >= 0 ? `+${fmtMoney(burnRate)} last period` : `${fmtMoney(burnRate)} burn`) : 'Latest close',
      color: cashLatest > 0 ? 'text-slate-100' : 'text-red-400',
      border: cashLatest > 0 ? 'border-slate-800/50' : 'border-red-500/20',
    } as Stat] : []),
    {
      label: 'Pipeline (Wtd)',
      value: fmtMoney(weighted),
      sub: `${activeDeals.length} active deal${activeDeals.length !== 1 ? 's' : ''}`,
      color: 'text-blue-300',
      border: 'border-blue-500/15',
    },
    ...(churnRate !== null ? [{
      label: 'Churn Rate',
      value: fmtPct(churnRate),
      sub: `${customers.totalCount ?? '—'} customers`,
      color: churnRate <= 0.02 ? 'text-emerald-400' : churnRate <= 0.05 ? 'text-amber-400' : 'text-red-400',
      border: churnRate <= 0.05 ? 'border-slate-800/50' : 'border-red-500/20',
    } as Stat] : []),
    ...(utilization !== null ? [{
      label: 'Utilization',
      value: fmtPct(utilization),
      sub: data.operations.headcount ? `${data.operations.headcount} headcount` : 'Team capacity',
      color: utilization >= 0.75 ? 'text-emerald-400' : utilization >= 0.5 ? 'text-amber-400' : 'text-red-400',
      border: 'border-slate-800/50',
    } as Stat] : []),
  ];

  // Responsive columns based on stat count (not including the AI card)
  const cols = stats.length <= 2 ? 'grid-cols-2' :
               stats.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' :
               'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${cols}`}>
        {stats.map(s => (
          <div key={s.label} className={`bg-slate-900/50 border ${s.border} rounded-xl px-4 py-3`}>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{s.label}</div>
            <div className={`text-[18px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>
      {/* AI insight — full-width row below stats */}
      <button
        onClick={() => openChat('What should I focus on today? Summarize the top 3 priorities based on my current financial performance, pipeline, and any risks.')}
        className="w-full bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/15 hover:border-indigo-500/30 rounded-xl px-5 py-3 text-left transition-colors group flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold text-indigo-400/70 uppercase tracking-[0.08em] mb-0.5">AI Insight</div>
          <div className="text-[13px] font-semibold text-indigo-300 group-hover:text-indigo-200">What should I focus on today?</div>
        </div>
        <div className="text-[20px] text-indigo-500/40 group-hover:text-indigo-400/60 transition-colors ml-4">→</div>
      </button>
    </div>
  );
}

type ActionPriority = 'critical' | 'high' | 'medium';
type Action = { id: string; priority: ActionPriority; label: string; detail: string; cta: string; view: ActiveView | null; ask?: string };

function ActionChecklist({ data, setActiveView, openChat }: { data: UnifiedBusinessData; setActiveView: (v: ActiveView) => void; openChat: (msg?: string) => void }) {
  const rev          = data.revenue.total;
  const cogs         = data.costs.totalCOGS;
  const opex         = data.costs.totalOpEx;
  const ebitda       = rev - cogs - opex;
  const ebitdaMargin = rev > 0 ? ebitda / rev : 0;
  const cashPeriods  = data.cashFlow ?? [];
  const cashLatest   = cashPeriods.length ? cashPeriods[cashPeriods.length - 1].closingBalance : null;
  const burnRateVal  = cashPeriods.length >= 2 ? cashPeriods[cashPeriods.length - 1].closingBalance - cashPeriods[cashPeriods.length - 2].closingBalance : null;
  const retentionVal = data.customers.retentionRate;
  const churnVal     = retentionVal != null ? (1 - retentionVal) * 100 : null;
  const activeDeals  = (data.pipeline ?? []).filter(dl => dl.stage !== 'Closed Won' && dl.stage !== 'Closed Lost');
  const overdueDeals = activeDeals.filter(dl => dl.daysInStage !== undefined && dl.daysInStage > 30);
  const riskAR       = data.arAging ? data.arAging.reduce((s, b) => s + b.days60 + b.days90 + b.over90, 0) : 0;
  const utilVal      = data.operations.employeeUtilization ?? data.operations.utilizationRate ?? data.operations.capacityUtilization ?? null;
  const top1Pct      = data.customers.topCustomers[0]?.percentOfTotal ?? 0;

  const actions: Action[] = [];

  if (burnRateVal !== null && burnRateVal < 0 && cashLatest !== null) {
    const runway = Math.abs(cashLatest / burnRateVal);
    if (runway < 6) {
      const burnFmt = Math.abs(burnRateVal) >= 1_000_000
        ? `$${(Math.abs(burnRateVal) / 1_000_000).toFixed(1)}M`
        : `$${Math.round(Math.abs(burnRateVal)).toLocaleString()}`;
      actions.push({
        id: 'cash-burn', priority: 'critical',
        label: `Cash runway: ${runway.toFixed(1)} months`,
        detail: `Burning ${burnFmt} per period. Review and cut discretionary OpEx today.`,
        cta: 'Review Cash →', view: 'cash',
        ask: `My cash runway is ${runway.toFixed(1)} months. What are the fastest levers to extend runway without harming revenue?`,
      });
    }
  }

  if (ebitda < 0) {
    actions.push({
      id: 'ebitda-neg', priority: 'critical',
      label: 'EBITDA is negative',
      detail: `Operating at a loss (${(ebitdaMargin * 100).toFixed(1)}% margin). Identify top cost drivers and model cuts in Scenarios.`,
      cta: 'Model Scenarios →', view: 'scenarios',
      ask: `My EBITDA margin is ${(ebitdaMargin * 100).toFixed(1)}%. What are the most impactful cost reduction moves I should make this week?`,
    });
  }

  if (overdueDeals.length > 0) {
    actions.push({
      id: 'overdue-deals', priority: 'high',
      label: `${overdueDeals.length} deal${overdueDeals.length > 1 ? 's' : ''} need follow-up today`,
      detail: `${overdueDeals.map(dl => dl.name).slice(0, 3).join(', ')}${overdueDeals.length > 3 ? ` +${overdueDeals.length - 3} more` : ''}`,
      cta: 'Open Deals →', view: 'deals',
    });
  }

  if (riskAR > 0) {
    const fmtAR = riskAR >= 1_000_000 ? `$${(riskAR / 1_000_000).toFixed(1)}M` : `$${Math.round(riskAR).toLocaleString()}`;
    actions.push({
      id: 'ar-risk', priority: 'high',
      label: `${fmtAR} AR is 60+ days overdue`,
      detail: 'Aging receivables compress cash and signal collection risk. Send statements to 60+ day accounts.',
      cta: 'View Financials →', view: 'financial',
      ask: `I have ${fmtAR} in 60+ day receivables. What collection actions should I take today?`,
    });
  }

  if (churnVal !== null && churnVal > 10) {
    actions.push({
      id: 'high-churn', priority: 'high',
      label: `${churnVal.toFixed(1)}% customer churn rate`,
      detail: 'Above 10% churn compresses valuation multiples. Review at-risk accounts and add a retention touch this week.',
      cta: 'View Customers →', view: 'customers',
      ask: `My churn rate is ${churnVal.toFixed(1)}%. What retention moves have the fastest payback in a service business?`,
    });
  }

  if (top1Pct > 20) {
    actions.push({
      id: 'concentration', priority: 'medium',
      label: `Top customer = ${top1Pct.toFixed(0)}% of revenue`,
      detail: `${data.customers.topCustomers[0]?.name ?? 'Top customer'} is above the 20% concentration risk threshold. Prioritize diversification.`,
      cta: 'View Customers →', view: 'customers',
    });
  }

  if (utilVal !== null && utilVal < 0.55) {
    actions.push({
      id: 'low-util', priority: 'medium',
      label: `Team utilization low: ${(utilVal * 100).toFixed(0)}%`,
      detail: 'Capacity is under-deployed. Shift team to pipeline development or billable projects to improve revenue per employee.',
      cta: 'View Operations →', view: 'operations',
    });
  }

  if (ebitdaMargin >= 0.20 && ebitda > 0 && actions.filter(a => a.priority !== 'medium').length === 0) {
    actions.push({
      id: 'invest', priority: 'medium',
      label: `Strong ${(ebitdaMargin * 100).toFixed(0)}% EBITDA — model growth spend`,
      detail: 'Healthy margins create room to reinvest. Run a scenario to see the impact of hiring or a price increase.',
      cta: 'Run Scenarios →', view: 'scenarios',
      ask: `My EBITDA margin is ${(ebitdaMargin * 100).toFixed(0)}%. What are the highest-ROI ways to redeploy this cash flow for growth?`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'default', priority: 'medium',
      label: 'No urgent items — stay proactive',
      detail: 'Business metrics look stable. Review your pipeline coverage and check in on your top 3 accounts.',
      cta: 'View Deals →', view: 'deals',
    });
  }

  const topActions = actions.slice(0, 4);
  const priorityStyle = (p: ActionPriority) =>
    p === 'critical' ? { dot: 'bg-red-400 animate-pulse', label: 'Critical', badge: 'text-red-400 bg-red-500/10 border-red-500/20', border: 'border-l-red-500/50' } :
    p === 'high'     ? { dot: 'bg-amber-400', label: 'High', badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20', border: 'border-l-amber-500/40' } :
                       { dot: 'bg-blue-400', label: 'Focus', badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20', border: 'border-l-blue-500/30' };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] flex-shrink-0">Action Checklist</span>
        <div className="flex-1 h-px bg-slate-800/50"/>
        <span className="text-[10px] text-slate-600">
          {topActions.filter(a => a.priority === 'critical').length > 0
            ? `${topActions.filter(a => a.priority === 'critical').length} critical`
            : 'No critical alerts'}
        </span>
      </div>
      <div className="space-y-2">
        {topActions.map(action => {
          const s = priorityStyle(action.priority);
          return (
            <div key={action.id} className={`bg-slate-900/50 border border-slate-800/50 border-l-2 ${s.border} rounded-xl px-4 py-3 flex items-start gap-3`}>
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`}/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[12px] font-semibold text-slate-100">{action.label}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>{s.label}</span>
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed">{action.detail}</div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-2">
                {action.ask && (
                  <button onClick={() => openChat(action.ask!)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors whitespace-nowrap">
                    Ask AI
                  </button>
                )}
                {action.view && (
                  <button onClick={() => setActiveView(action.view!)}
                    className="text-[11px] font-semibold text-slate-300 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                    {action.cta}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaxCalendar() {
  const TAX_KEY = 'bos_tax_checked';
  const now = new Date();
  const year = now.getFullYear();
  const TAX_ITEMS = useMemo(() => buildTaxItems(year), [year]);

  const [taxChecked, setTaxChecked] = useState<Record<string, boolean>>(() => {
    try { const s = localStorage.getItem(TAX_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });

  const toggleTax = useCallback((id: string) => {
    setTaxChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(TAX_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const todayMs = now.getTime();
  const upcoming = TAX_ITEMS
    .filter(i => !taxChecked[i.id])
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  const nextItem = upcoming[0];
  const daysUntilNext = nextItem ? Math.ceil((new Date(nextItem.date).getTime() - todayMs) / 86400000) : null;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[12px] font-semibold text-slate-100">Tax & Compliance Calendar</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Key US federal deadlines · check off when filed</div>
        </div>
        {daysUntilNext !== null && nextItem && (
          <div className={`text-[11px] font-semibold ${daysUntilNext <= 14 ? 'text-red-400' : daysUntilNext <= 30 ? 'text-amber-400' : 'text-slate-400'}`}>
            Next: {nextItem.label.split('(')[0].trim()} in {daysUntilNext}d
          </div>
        )}
      </div>
      <div className="divide-y divide-slate-800/30">
        {upcoming.map(item => {
          const daysAway = Math.ceil((new Date(item.date).getTime() - todayMs) / 86400000);
          const isOverdue = daysAway < 0;
          const isSoon = daysAway >= 0 && daysAway <= 14;
          const urgencyDot = isOverdue ? 'bg-red-400 animate-pulse' : isSoon ? 'bg-amber-400' : 'bg-slate-600';
          return (
            <div key={item.id} onClick={() => toggleTax(item.id)}
              className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/20 cursor-pointer transition-colors">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${urgencyDot}`}/>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-slate-300 leading-tight">{item.label}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{item.category}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className={`text-[11px] font-semibold ${isOverdue ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-slate-500'}`}>
                  {isOverdue ? `${Math.abs(daysAway)}d overdue` : daysAway === 0 ? 'Today' : `${daysAway}d`}
                </div>
                <div className="text-[10px] text-slate-600">
                  {new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="w-4 h-4 rounded border border-slate-700 flex items-center justify-center flex-shrink-0">
                  {taxChecked[item.id] && (
                    <svg viewBox="0 0 10 10" fill="none" stroke="#10b981" strokeWidth="2" className="w-2.5 h-2.5">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-2.5 border-t border-slate-800/40 text-[10px] text-slate-700">
        {TAX_ITEMS.filter(i => taxChecked[i.id]).length} of {TAX_ITEMS.length} items filed · Dates are federal — state deadlines may vary · Consult your CPA
      </div>
    </div>
  );
}

function WeekAtAGlance({ data }: { data: UnifiedBusinessData }) {
  type LocalDeal = { id: string; name: string; company: string; value: number; stage: string; closeDate?: string };
  let crmDeals: LocalDeal[] = [];
  try { const s = localStorage.getItem('bos_deals'); if (s) crmDeals = JSON.parse(s); } catch { /* ignore */ }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const dealsThisWeek = crmDeals.filter(d => {
    if (!d.closeDate || d.stage === 'closed-won' || d.stage === 'closed-lost') return false;
    const cd = new Date(d.closeDate); cd.setHours(0, 0, 0, 0);
    return cd >= today && cd <= days[6];
  });

  const pipelineThisWeek = (data.pipeline ?? []).filter(d => {
    if (!d.closeDate || d.stage === 'Closed Won' || d.stage === 'Closed Lost') return false;
    const cd = new Date(d.closeDate); cd.setHours(0, 0, 0, 0);
    return cd >= today && cd <= days[6];
  });

  if (dealsThisWeek.length === 0 && pipelineThisWeek.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800/50">
        <div className="text-[12px] font-semibold text-slate-100">Week at a Glance</div>
        <div className="text-[10px] text-slate-500 mt-0.5">Deals closing in the next 7 days</div>
      </div>
      <div className="grid grid-cols-7 divide-x divide-slate-800/40">
        {days.map((d, i) => {
          const isToday = i === 0;
          const dayDeals = dealsThisWeek.filter(dl => { const cd = new Date(dl.closeDate!); cd.setHours(0, 0, 0, 0); return cd.getTime() === d.getTime(); });
          const dayPipeline = pipelineThisWeek.filter(dl => { const cd = new Date(dl.closeDate!); cd.setHours(0, 0, 0, 0); return cd.getTime() === d.getTime(); });
          const hasDeal = dayDeals.length > 0 || dayPipeline.length > 0;
          return (
            <div key={i} className={`p-2 min-h-[72px] ${isToday ? 'bg-indigo-500/5' : ''}`}>
              <div className={`text-[10px] font-semibold mb-1 ${isToday ? 'text-indigo-400' : 'text-slate-600'}`}>{dayNames[d.getDay()]}</div>
              <div className={`text-[13px] font-bold mb-1 ${isToday ? 'text-indigo-300' : 'text-slate-500'}`}>{d.getDate()}</div>
              {hasDeal ? (
                <div className="space-y-1">
                  {dayDeals.map(dl => (
                    <div key={dl.id} className="text-[9px] bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded px-1 py-0.5 leading-tight truncate" title={dl.name}>{dl.company}</div>
                  ))}
                  {dayPipeline.map((dl, pi) => (
                    <div key={pi} className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded px-1 py-0.5 leading-tight truncate" title={dl.name}>{dl.name}</div>
                  ))}
                </div>
              ) : (
                <div className="text-[9px] text-slate-800">—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CEONotes() {
  const NOTES_KEY = 'bos_ceo_notes';
  const todayKey = new Date().toISOString().slice(0, 10);

  const [noteText, setNoteText] = useState<string>(() => {
    try { const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}'); return all[todayKey] ?? ''; } catch { return ''; }
  });
  const [noteSaved, setNoteSaved] = useState(false);

  const saveNote = useCallback((val: string) => {
    setNoteText(val);
    try {
      const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
      all[todayKey] = val;
      const keys = Object.keys(all).sort().slice(-30);
      const trimmed: Record<string, string> = {};
      keys.forEach(k => { trimmed[k] = all[k]; });
      localStorage.setItem(NOTES_KEY, JSON.stringify(trimmed));
    } catch { /* ignore */ }
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  }, [todayKey]);

  const recentNotes: { date: string; text: string }[] = useMemo(() => {
    try {
      const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
      const result: { date: string; text: string }[] = [];
      Object.entries(all)
        .filter(([k]) => k !== todayKey)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 2)
        .forEach(([k, v]) => result.push({ date: k, text: v as string }));
      return result;
    } catch { return []; }
  }, [todayKey]);

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] font-semibold text-slate-100">CEO Notes</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Saved locally
          </div>
        </div>
        {noteSaved && <span className="text-[11px] text-emerald-400 font-medium">Saved ✓</span>}
      </div>
      <textarea
        rows={4}
        placeholder="What's top of mind today? Key decisions, risks, ideas, follow-ups…"
        value={noteText}
        onChange={e => saveNote(e.target.value)}
        className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none leading-relaxed transition-colors"
      />
      {recentNotes.length > 0 && (
        <div className="mt-3 space-y-2">
          {recentNotes.map(n => (
            <div key={n.date} className="bg-slate-800/20 rounded-lg px-3 py-2">
              <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                {new Date(n.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{n.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingExtractor({ effectiveData, companyName }: { effectiveData: UnifiedBusinessData; companyName: string }) {
  const [notes, setNotes] = useState('');
  const [actions, setActions] = useState('');
  const [meetLoading, setMeetLoading] = useState(false);
  const [added, setAdded] = useState(false);

  const extract = useCallback(async () => {
    if (!notes.trim()) return;
    setMeetLoading(true); setActions('');
    const prompt = `Extract action items from these meeting notes. Format each as: "ACTION: [owner] → [specific task] · Due: [timeframe]". Then write a one-sentence meeting summary at the top labeled "SUMMARY:". Be specific — use names from the notes if present. Meeting notes:\n\n${notes}`;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, data: effectiveData, history: [], companyName, planId: 'pro' }),
      });
      const json = await res.json() as { reply?: string };
      setActions(json.reply ?? 'Failed to extract');
    } catch { setActions('Error connecting to AI'); }
    finally { setMeetLoading(false); }
  }, [notes, effectiveData, companyName]);

  const addToBoard = useCallback(() => {
    if (!actions) return;
    const lines = actions.split('\n').filter(l => l.startsWith('ACTION:'));
    const tasks = lines.map(l => ({
      id: `mt${Date.now()}-${Math.random()}`,
      title: l.replace('ACTION:', '').trim(),
      status: 'todo',
      createdAt: new Date().toISOString(),
      source: 'meeting',
    }));
    try {
      const existing = JSON.parse(localStorage.getItem('bos_tasks') ?? '[]') as object[];
      localStorage.setItem('bos_tasks', JSON.stringify([...existing, ...tasks]));
    } catch { /* ignore */ }
    setAdded(true); setTimeout(() => setAdded(false), 3000);
  }, [actions]);

  return (
    <div className="bg-gradient-to-br from-emerald-950/20 to-slate-900/50 border border-emerald-800/30 rounded-xl p-5">
      <div className="text-[12px] font-semibold text-slate-100 mb-0.5">AI Meeting → Action Items</div>
      <div className="text-[10px] text-slate-500 mb-3">Paste raw meeting notes → AI extracts action items and adds them to your Execute board</div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Paste meeting notes here… (names, decisions, follow-ups)"
        rows={5}
        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed mb-3"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={extract}
          disabled={meetLoading || !notes.trim()}
          className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-colors">
          {meetLoading
            ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Extracting…</>
            : '✦ Extract Actions'}
        </button>
        {actions && (
          <button
            onClick={addToBoard}
            className="px-4 py-2 text-[12px] font-semibold bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 text-slate-200 rounded-xl transition-colors">
            {added ? '✓ Added to Execute Board' : '→ Add to Execute Board'}
          </button>
        )}
      </div>
      {actions && (
        <div className="mt-3 bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
          <pre className="text-[12px] text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">{actions}</pre>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

const TodayView = React.memo(function TodayView({ data, effectiveData, companyName, openChat, setActiveView, onOpenDeal }: Props) {
  return (
    <div className="space-y-4">
      <MetricGrid data={data} effectiveData={effectiveData} openChat={openChat} />
      <ActionChecklist data={effectiveData} setActiveView={setActiveView} openChat={openChat} />
      <TaxCalendar />
      <WeekAtAGlance data={data} />
      <CEONotes />
      <MeetingExtractor effectiveData={effectiveData} companyName={companyName} />
      <DailyPriorities onOpenDeal={onOpenDeal} />
    </div>
  );
});

export default TodayView;
