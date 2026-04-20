import { useState } from 'react';
import type { KPIDashboard, UnifiedBusinessData, KPIResult, Goals } from '../../types';

type SourceLabel = 'Imported' | 'Calculated' | 'User-set' | 'AI-generated';

// ── Linear regression helper ──────────────────────────────────────────────────
function linReg(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };
  const sx  = y.reduce((_, __, i) => _ + i, 0);
  const sy  = y.reduce((s, v) => s + v, 0);
  const sxy = y.reduce((s, v, i) => s + i * v, 0);
  const sxx = y.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

interface Props {
  dashboard: KPIDashboard | null;
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  goals?: Goals;
  onNavigate?: (view: string) => void;
}

// Industry benchmarks for LMM/MM companies ($5M-$250M revenue)
const BENCHMARKS: Record<string, { label: string; value: string; good: string }> = {
  'gross-margin':          { label: 'LMM median', value: '42%',  good: '>45% is strong' },
  'ebitda-margin':         { label: 'LMM median', value: '14%',  good: '>18% is strong' },
  'revenue-growth':        { label: 'LMM median', value: '12%',  good: '>20% is strong' },
  'customer-concentration':{ label: 'Safe max',   value: '20%',  good: '<15% per customer' },
  'retention-rate':        { label: 'LMM median', value: '88%',  good: '>92% is best-in-class' },
  'rev-per-employee':      { label: 'LMM median', value: '$85k', good: '>$120k is strong' },
  'gp-per-employee':       { label: 'Prof. services', value: '$60k', good: '>$100k is strong for professional services' },
  'ltv-cac':               { label: 'Healthy min', value: '3×',  good: '>3× sustainable growth; >5× excellent' },
  'ltv':                   { label: 'Context-dependent', value: '—', good: 'Higher is better; compare to CAC' },
  'cac':                   { label: 'Context-dependent', value: '—', good: 'Lower is better; compare to LTV' },
};

// Numeric benchmark values for inline bar comparison
const BENCHMARK_VALS: Partial<Record<string, { val: number; label: string; inverse?: boolean }>> = {
  'gross-margin':           { val: 42,    label: 'LMM 42%' },
  'ebitda-margin':          { val: 14,    label: 'LMM 14%' },
  'revenue-growth':         { val: 12,    label: 'LMM 12%' },
  'customer-concentration': { val: 20,    label: 'max 20%', inverse: true },
  'retention-rate':         { val: 88,    label: 'LMM 88%' },
  'rev-per-employee':       { val: 85000, label: 'LMM $85k' },
  'gp-per-employee':        { val: 60000, label: 'LMM $60k' },
  'ltv-cac':                { val: 3,     label: 'min 3×' },
};

// ── Source metadata ───────────────────────────────────────────────────────────
const METRIC_SOURCE: Record<string, SourceLabel> = {
  'total-revenue':          'Imported',
  'revenue-growth':         'Calculated',
  'gross-margin':           'Calculated',
  'ebitda-margin':          'Calculated',
  'ebitda':                 'Calculated',
  'customer-concentration': 'Calculated',
  'retention-rate':         'Imported',
  'net-new-customers':      'Calculated',
  'rev-per-employee':       'Calculated',
  'gp-per-employee':        'Calculated',
  'cash-balance':           'Imported',
  'cash-runway':            'Calculated',
  'net-cash-flow':          'Calculated',
  'ltv':                    'Calculated',
  'cac':                    'Calculated',
  'ltv-cac':                'Calculated',
};

const SOURCE_STYLE: Record<SourceLabel, string> = {
  'Imported':      'text-blue-400 bg-blue-500/8 border-blue-500/20',
  'Calculated':    'text-violet-400 bg-violet-500/8 border-violet-500/20',
  'User-set':      'text-amber-400 bg-amber-500/8 border-amber-500/20',
  'AI-generated':  'text-emerald-400 bg-emerald-500/8 border-emerald-500/20',
};

// Category → detailed tab for drilldown
const CATEGORY_DRILLDOWN: Record<string, string> = {
  revenue:       'financial',
  profitability: 'financial',
  customers:     'customers',
  operations:    'operations',
  cash:          'cash',
};

// ── Formula lineage — real values substituted in ──────────────────────────────
interface LineageStep { label: string; value: string; operator?: '−' | '+' | '÷' | '×' }
interface Lineage { steps: LineageStep[]; result: string; note?: string }

function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n/1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function computeLineage(id: string, data: UnifiedBusinessData, previousData?: UnifiedBusinessData): Lineage | null {
  const rev  = data.revenue.total;
  const cogs = data.costs.totalCOGS;
  const opex = data.costs.totalOpEx;
  const gp   = rev - cogs;

  switch (id) {
    case 'total-revenue':
      return { steps: [{ label: 'Sum of all revenue streams', value: fmtShort(rev) }], result: fmtShort(rev), note: 'Sourced directly from revenue data' };

    case 'ebitda':
      return {
        steps: [
          { label: 'Revenue',  value: fmtShort(rev) },
          { label: 'COGS',     value: fmtShort(cogs), operator: '−' },
          { label: 'OpEx',     value: fmtShort(opex), operator: '−' },
        ],
        result: fmtShort(gp - opex),
        note: 'Earnings before interest, taxes, depreciation & amortization',
      };

    case 'gross-margin': {
      const gm = rev > 0 ? (gp / rev) * 100 : 0;
      return {
        steps: [
          { label: 'Gross Profit', value: fmtShort(gp) },
          { label: 'Revenue',      value: fmtShort(rev), operator: '÷' },
          { label: '× 100',        value: '' },
        ],
        result: `${gm.toFixed(1)}%`,
        note: `GP of ${fmtShort(gp)} ÷ Revenue of ${fmtShort(rev)}`,
      };
    }

    case 'ebitda-margin': {
      const ebitda = gp - opex;
      const margin = rev > 0 ? (ebitda / rev) * 100 : 0;
      return {
        steps: [
          { label: 'EBITDA',   value: fmtShort(ebitda) },
          { label: 'Revenue',  value: fmtShort(rev), operator: '÷' },
          { label: '× 100',    value: '' },
        ],
        result: `${margin.toFixed(1)}%`,
        note: `${fmtShort(ebitda)} ÷ ${fmtShort(rev)}`,
      };
    }

    case 'revenue-growth': {
      if (!previousData) return null;
      const prev = previousData.revenue.total;
      const growth = prev > 0 ? ((rev - prev) / prev) * 100 : 0;
      return {
        steps: [
          { label: 'Current Revenue',  value: fmtShort(rev) },
          { label: 'Prior Revenue',    value: fmtShort(prev), operator: '−' },
          { label: 'Prior Revenue',    value: fmtShort(prev), operator: '÷' },
          { label: '× 100',           value: '' },
        ],
        result: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`,
        note: `${fmtShort(rev - prev)} increase over ${fmtShort(prev)} base`,
      };
    }

    case 'customer-concentration': {
      const top3 = data.customers.topCustomers.slice(0, 3);
      const top3pct = top3.reduce((s, c) => s + c.percentOfTotal, 0);
      return {
        steps: top3.map((c, i) => ({ label: c.name, value: `${c.percentOfTotal.toFixed(1)}%`, operator: i > 0 ? '+' as const : undefined })),
        result: `${top3pct.toFixed(1)}%`,
        note: 'Share of total revenue from top 3 customers',
      };
    }

    case 'net-new-customers': {
      const { newThisPeriod, churned } = data.customers;
      return {
        steps: [
          { label: 'New Added', value: `+${newThisPeriod}` },
          { label: 'Churned',   value: `${churned}`, operator: '−' },
        ],
        result: `${newThisPeriod - churned >= 0 ? '+' : ''}${newThisPeriod - churned}`,
        note: `${newThisPeriod} gained, ${churned} lost`,
      };
    }

    case 'rev-per-employee': {
      const hc = data.operations.headcount;
      if (!hc) return null;
      return {
        steps: [
          { label: 'Revenue',   value: fmtShort(rev) },
          { label: 'Headcount', value: `${hc} people`, operator: '÷' },
        ],
        result: fmtShort(rev / hc),
      };
    }

    case 'cash-balance': {
      if (!data.cashFlow?.length) return null;
      const latest = data.cashFlow[data.cashFlow.length - 1];
      return {
        steps: [{ label: `Closing balance — ${latest.period}`, value: fmtShort(latest.closingBalance) }],
        result: fmtShort(latest.closingBalance),
        note: 'Latest period closing cash balance',
      };
    }

    case 'cash-runway': {
      if (!data.cashFlow?.length) return null;
      const cf = data.cashFlow;
      const latest = cf[cf.length - 1];
      const avg = cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / cf.length;
      if (avg >= 0) return null;
      return {
        steps: [
          { label: 'Cash Balance', value: fmtShort(latest.closingBalance) },
          { label: 'Avg Monthly Burn', value: fmtShort(Math.abs(avg)), operator: '÷' },
        ],
        result: `${Math.abs(latest.closingBalance / avg).toFixed(1)} months`,
        note: `${fmtShort(Math.abs(avg))}/mo burn rate`,
      };
    }

    case 'ltv-cac': {
      const churnFrac = 1 - (((data.customers.retentionRate ?? 0.88)));
      const arpcVal = data.customers.avgRevenuePerCustomer ?? (data.customers.totalCount > 0 ? rev / data.customers.totalCount : 0);
      const gmFrac  = rev > 0 ? (rev - cogs) / rev : 0;
      const ltvVal  = churnFrac > 0 ? (arpcVal * gmFrac) / churnFrac : 0;
      const smCat   = data.costs.byCategory?.find(c => /sales|marketing/i.test(c.category));
      const cacVal  = smCat && data.customers.newThisPeriod > 0 ? smCat.amount / data.customers.newThisPeriod : 0;
      if (ltvVal === 0 || cacVal === 0) return null;
      return {
        steps: [
          { label: 'ARPC',                 value: fmtShort(arpcVal) },
          { label: 'Gross Margin %',        value: `${(gmFrac * 100).toFixed(1)}%`, operator: '×' },
          { label: 'Churn Rate',            value: `${(churnFrac * 100).toFixed(1)}%`, operator: '÷' },
          { label: '= LTV',                 value: fmtShort(ltvVal) },
          { label: `S&M Spend (${smCat?.category ?? 'S&M'})`, value: fmtShort(smCat?.amount ?? 0) },
          { label: 'New Customers',         value: `${data.customers.newThisPeriod}`, operator: '÷' },
          { label: '= CAC',                 value: fmtShort(cacVal) },
        ],
        result: `${(ltvVal / cacVal).toFixed(1)}×`,
        note: 'Contribution-margin LTV ÷ period CAC',
      };
    }

    default:
      return null;
  }
}

// Maps KPI IDs to Goals keys
const KPI_GOAL_MAP: Partial<Record<string, keyof Goals>> = {
  'total-revenue':    'revenue',
  'ebitda-margin':    'ebitdaMargin',
  'gross-margin':     'grossMargin',
  'retention-rate':   'retentionRate',
  'revenue-growth':   'revenueGrowth',
  'rev-per-employee': 'revPerEmployee',
  'net-new-customers':'netNewCustomers',
};

// Category config: label, accent, icon
const CATEGORY_CONFIG: Record<string, { label: string; accent: string; bg: string; border: string; icon: JSX.Element }> = {
  revenue: {
    label: 'Revenue',
    accent: 'text-indigo-400',
    bg: 'bg-indigo-500/5',
    border: 'border-indigo-500/15',
    icon: <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><path d="M2 9h3v3H2V9zm4-4h2v7H6V5zm4-3h2v10h-2V2zM1 13h12v1H1v-1z"/></svg>,
  },
  profitability: {
    label: 'Profitability',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/15',
    icon: <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><path d="M7 1a6 6 0 100 12A6 6 0 007 1zm.5 8.5h-1v-4h1v4zm0-5.5h-1V3h1v1z"/></svg>,
  },
  customers: {
    label: 'Customers',
    accent: 'text-violet-400',
    bg: 'bg-violet-500/5',
    border: 'border-violet-500/15',
    icon: <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><circle cx="5" cy="4" r="2.5"/><path d="M0 12c0-2.76 2.24-5 5-5s5 2.24 5 5H0z"/><circle cx="11" cy="5" r="1.8"/><path d="M14 12c0-1.66-1.34-3-3-3-.48 0-.93.12-1.33.32A6.02 6.02 0 0111 12h3z"/></svg>,
  },
  operations: {
    label: 'Operations',
    accent: 'text-cyan-400',
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/15',
    icon: <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><path d="M6 1a1 1 0 00-1 1v.26A5 5 0 002.37 8.5H2a1 1 0 000 2h.37A5 5 0 009 13.74V14a1 1 0 002 0v-.26A5 5 0 0013.63 8.5H14a1 1 0 000-2h-.37A5 5 0 009 2.26V2a1 1 0 00-1-1H6zm1 3a3 3 0 110 6 3 3 0 010-6z"/></svg>,
  },
  cash: {
    label: 'Cash',
    accent: 'text-amber-400',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/15',
    icon: <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><rect x="1" y="3" width="12" height="8" rx="1.5"/><path d="M4 7h6M7 5v4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  },
};

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  if (values.length < 2) return null;
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const range = max - min || 1;
  const W = 64; const H = 20; const pad = 2;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (W - pad * 2) + pad,
    H - pad - ((v - min) / range) * (H - pad * 2),
  ]);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const isUp = values[values.length - 1] >= values[0];
  const stroke = (positive ? isUp : !isUp) ? '#10b981' : '#ef4444';
  return (
    <svg width={W} height={H} className="overflow-visible opacity-60">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function computeKPIs(data: UnifiedBusinessData, prev?: UnifiedBusinessData): KPIResult[] {
  const rev          = data.revenue.total;
  const prevRev      = prev?.revenue.total;
  const cogs         = data.costs.totalCOGS;
  const opex         = data.costs.totalOpEx;
  const ebitda       = rev - cogs - opex;
  const grossProfit  = rev - cogs;
  const pct = (cur: number, p?: number) => p && p !== 0 ? ((cur - p) / Math.abs(p)) * 100 : undefined;
  const fmtV = (val: number, unit: string) => {
    if (unit === '$') {
      if (Math.abs(val) >= 1_000_000) return `$${(val/1_000_000).toFixed(1)}M`;
      if (Math.abs(val) >= 1_000)     return `$${(val/1_000).toFixed(0)}k`;
      return `$${val.toFixed(0)}`;
    }
    return `${val.toFixed(1)}%`;
  };
  const trendFn = (cur: number, p?: number): KPIResult['trend'] => {
    if (!p) return 'unknown';
    if (Math.abs(cur - p) < 0.01) return 'flat';
    return cur > p ? 'up' : 'down';
  };
  const statusFn = (val: number, g: number, y: number): KPIResult['status'] =>
    val >= g ? 'green' : val >= y ? 'yellow' : val > 0 ? 'neutral' : 'red';

  // Sparklines from period data
  const periods = data.revenue.byPeriod;
  const revSparkline   = periods.length > 1 ? periods.map(p => p.revenue) : undefined;
  const gpSparkline    = periods.length > 1 ? periods.map(p => p.revenue - (p.cogs ?? 0)) : undefined;
  const gmSparkline    = periods.length > 1 ? periods.map(p => p.revenue > 0 ? ((p.revenue - (p.cogs ?? 0)) / p.revenue) * 100 : 0) : undefined;

  const revenueGrowth  = prevRev ? pct(rev, prevRev) : undefined;
  const grossMargin    = rev > 0 ? (grossProfit / rev) * 100 : 0;
  const ebitdaMargin   = rev > 0 ? (ebitda / rev) * 100 : 0;
  const prevCogs       = prev?.costs.totalCOGS ?? 0;
  const prevOpex       = prev?.costs.totalOpEx ?? 0;
  const prevEbitda     = prevRev ? prevRev - prevCogs - prevOpex : undefined;
  const prevGrossMargin= prevRev ? ((prevRev - prevCogs) / prevRev) * 100 : undefined;
  const { totalCount, newThisPeriod, churned, topCustomers, retentionRate, avgRevenuePerCustomer } = data.customers;
  const top3        = topCustomers.slice(0, 3).reduce((s, c) => s + c.percentOfTotal, 0);
  const retention   = (retentionRate ?? ((totalCount - churned) / Math.max(totalCount - newThisPeriod + churned, 1))) * 100;
  const netNew      = newThisPeriod - churned;
  const headcount   = data.operations.headcount;
  const revPerEmp   = headcount ? rev / headcount : 0;

  // LTV / CAC calculation
  const churnRate   = 1 - (retention / 100);
  const arpc        = avgRevenuePerCustomer ?? (totalCount > 0 ? rev / totalCount : 0);
  const grossMarginFrac = rev > 0 ? (rev - cogs) / rev : 0;
  // LTV = (ARPC × Gross Margin) / Churn Rate  — contribution-margin LTV
  const ltv         = churnRate > 0 ? (arpc * grossMarginFrac) / churnRate : 0;
  // CAC = S&M spend / new customers acquired this period
  const smSpend     = data.costs.byCategory?.find(c => /sales|marketing/i.test(c.category))?.amount ?? 0;
  const cac         = newThisPeriod > 0 && smSpend > 0 ? smSpend / newThisPeriod : 0;
  const ltvCacRatio = cac > 0 && ltv > 0 ? ltv / cac : 0;

  // Cash KPIs from cash flow data
  const cashKPIs: KPIResult[] = [];
  if (data.cashFlow && data.cashFlow.length > 0) {
    const cf        = data.cashFlow;
    const latest    = cf[cf.length - 1];
    const avgNet    = cf.reduce((s, p) => s + (p.netCashFlow ?? (p.closingBalance - p.openingBalance)), 0) / cf.length;
    const isBurning = avgNet < 0;
    const runway    = isBurning ? Math.abs(latest.closingBalance / avgNet) : null;
    const cfSpark   = cf.map(p => p.closingBalance);
    const netSpark  = cf.map(p => p.netCashFlow ?? (p.closingBalance - p.openingBalance));

    cashKPIs.push({
      id: 'cash-balance', name: 'Cash Balance',
      value: latest.closingBalance, formattedValue: fmtV(latest.closingBalance,'$'),
      unit: '$', trend: trendFn(latest.closingBalance, cf[0]?.closingBalance),
      status: latest.closingBalance > 0 ? 'green' : 'red',
      description: 'Current cash position (latest period)', formula: 'Latest closing cash balance',
      category: 'cash', sparkline: cfSpark,
    });
    if (runway !== null) {
      cashKPIs.push({
        id: 'cash-runway', name: 'Cash Runway',
        value: runway, formattedValue: `${runway.toFixed(1)} mo`,
        unit: 'mo', trend: 'unknown',
        status: runway > 12 ? 'green' : runway > 6 ? 'yellow' : 'red',
        description: 'Months of runway at current burn rate', formula: 'Cash Balance / Avg Monthly Burn',
        category: 'cash',
      });
    }
    cashKPIs.push({
      id: 'net-cash-flow', name: 'Avg Net Cash Flow',
      value: avgNet, formattedValue: `${avgNet >= 0 ? '+' : ''}${fmtV(Math.abs(avgNet),'$')}`,
      unit: '$', trend: avgNet > 0 ? 'up' : 'down',
      status: avgNet > 0 ? 'green' : 'red',
      description: 'Average net cash flow per period', formula: 'Avg(Receipts − Payments)',
      category: 'cash', sparkline: netSpark,
    });
  }

  return [
    { id: 'total-revenue',          name: 'Revenue',             value: rev,            formattedValue: fmtV(rev,'$'),                  unit: '$', previousValue: prevRev,       changePercent: pct(rev, prevRev),            trend: trendFn(rev, prevRev),          status: 'neutral', description: 'Total period revenue',              formula: 'Sum of all revenue',            category: 'revenue',       sparkline: revSparkline },
    { id: 'revenue-growth',         name: 'Revenue Growth',      value: revenueGrowth ?? 0, formattedValue: fmtV(revenueGrowth ?? 0,'%'), unit: '%', changePercent: revenueGrowth, trend: revenueGrowth ? (revenueGrowth > 0 ? 'up' : 'down') : 'unknown', status: statusFn(revenueGrowth ?? 0, 10, 5), description: 'Period-over-period growth', formula: '(Current − Prior) / Prior', category: 'revenue' },
    { id: 'gross-margin',           name: 'Gross Margin',        value: grossMargin,    formattedValue: fmtV(grossMargin,'%'),           unit: '%', previousValue: prevGrossMargin, changePercent: prevGrossMargin !== undefined ? grossMargin - prevGrossMargin : undefined, trend: trendFn(grossMargin, prevGrossMargin), status: statusFn(grossMargin, 50, 30), description: 'Gross profit as % of revenue', formula: '(Revenue − COGS) / Revenue', category: 'profitability', sparkline: gmSparkline },
    { id: 'ebitda-margin',          name: 'EBITDA Margin',       value: ebitdaMargin,   formattedValue: fmtV(ebitdaMargin,'%'),          unit: '%', previousValue: prevEbitda !== undefined && prevRev ? (prevEbitda/prevRev)*100 : undefined, changePercent: prevEbitda !== undefined && prevRev ? ebitdaMargin - (prevEbitda/prevRev)*100 : undefined, trend: trendFn(ebitdaMargin, prevEbitda !== undefined && prevRev ? (prevEbitda/prevRev)*100 : undefined), status: statusFn(ebitdaMargin, 20, 10), description: 'Operating earnings as % of revenue', formula: 'EBITDA / Revenue', category: 'profitability' },
    { id: 'ebitda',                 name: 'EBITDA',              value: ebitda,         formattedValue: fmtV(ebitda,'$'),                unit: '$', previousValue: prevEbitda,     changePercent: pct(ebitda, prevEbitda),       trend: trendFn(ebitda, prevEbitda),     status: ebitda > 0 ? 'green' : 'red',    description: 'Earnings before interest, taxes, D&A', formula: 'Revenue − COGS − OpEx', category: 'profitability', sparkline: gpSparkline },
    { id: 'customer-concentration', name: 'Top 3 Concentration', value: top3,           formattedValue: fmtV(top3,'%'),                  unit: '%', trend: 'unknown',              status: top3 > 60 ? 'red' : top3 > 40 ? 'yellow' : 'green', description: '% of revenue from top 3 customers', formula: 'Sum(Top3 Revenue) / Total Revenue', category: 'customers' },
    { id: 'retention-rate',         name: 'Retention Rate',      value: retention,      formattedValue: fmtV(retention,'%'),             unit: '%', trend: 'unknown',              status: statusFn(retention, 90, 80), description: '% of customers retained this period', formula: '(End Customers − New) / Start Customers', category: 'customers' },
    { id: 'net-new-customers',      name: 'Net New',             value: netNew,         formattedValue: netNew >= 0 ? `+${netNew}` : `${netNew}`, unit: '', trend: netNew > 0 ? 'up' : netNew < 0 ? 'down' : 'flat', status: netNew > 0 ? 'green' : netNew === 0 ? 'yellow' : 'red', description: 'New customers minus churned', formula: 'New Added − Churned', category: 'customers' },
    ...(ltv > 0 ? [
      { id: 'ltv',       name: 'LTV',         value: ltv,         formattedValue: fmtV(ltv,'$'),          unit: '$', trend: 'unknown' as const, status: 'neutral' as const, description: '(ARPC × Gross Margin) ÷ Churn Rate — contribution-margin lifetime value per customer', formula: '(ARPC × GM%) / Churn Rate', category: 'customers' as const },
    ] : []),
    ...(cac > 0 ? [
      { id: 'cac',       name: 'CAC',         value: cac,         formattedValue: fmtV(cac,'$'),          unit: '$', trend: 'unknown' as const, status: 'neutral' as const, description: 'Sales & Marketing spend ÷ new customers acquired this period', formula: 'S&M Spend / New Customers', category: 'customers' as const },
    ] : []),
    ...(ltvCacRatio > 0 ? [
      { id: 'ltv-cac',   name: 'LTV / CAC',   value: ltvCacRatio, formattedValue: `${ltvCacRatio.toFixed(1)}×`, unit: 'x', trend: 'unknown' as const, status: ltvCacRatio >= 3 ? 'green' as const : ltvCacRatio >= 1 ? 'yellow' as const : 'red' as const, description: 'Customer lifetime value vs. acquisition cost — 3× or above is healthy', formula: 'LTV / CAC', category: 'customers' as const },
    ] : []),
    ...(headcount ? [
      { id: 'rev-per-employee', name: 'Rev / Employee', value: revPerEmp, formattedValue: fmtV(revPerEmp,'$'), unit: '$', trend: 'unknown' as const, status: 'neutral' as const, description: 'Revenue generated per team member', formula: 'Revenue / Headcount', category: 'operations' as const },
      { id: 'gp-per-employee',  name: 'GP / Employee',  value: grossProfit / headcount, formattedValue: fmtV(grossProfit / headcount,'$'), unit: '$', trend: 'unknown' as const, status: (grossProfit/headcount) >= 100000 ? 'green' as const : (grossProfit/headcount) >= 60000 ? 'yellow' as const : 'red' as const, description: 'Gross profit generated per team member — shows delivery efficiency', formula: '(Revenue − COGS) / Headcount', category: 'operations' as const },
    ] : []),
    ...cashKPIs,
  ];
}

// ── KPI detail modal ───────────────────────────────────────────────────────────
function KPIDetailModal({
  kpi, goal, onClose, data, previousData, onNavigate,
}: {
  kpi: KPIResult;
  goal?: number;
  onClose: () => void;
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onNavigate?: (view: string) => void;
}) {
  const bench = BENCHMARKS[kpi.id];
  const source = METRIC_SOURCE[kpi.id];
  const lineage = computeLineage(kpi.id, data, previousData);
  const drillView = CATEGORY_DRILLDOWN[kpi.category];
  const attainment = goal !== undefined && goal !== 0 ? (kpi.value / goal) * 100 : undefined;
  const goalFmt = goal !== undefined
    ? kpi.unit === '$'
      ? goal >= 1_000_000 ? `$${(goal/1_000_000).toFixed(1)}M` : goal >= 1_000 ? `$${(goal/1_000).toFixed(0)}k` : `$${goal}`
      : `${goal}%`
    : undefined;

  const CATEGORY_LABEL: Record<string, string> = {
    revenue: 'Revenue', profitability: 'Profitability', customers: 'Customers',
    operations: 'Operations', cash: 'Cash'
  };
  const TAB_LABEL: Record<string, string> = {
    financial: 'Financial', customers: 'Customers', operations: 'Operations', cash: 'Cash'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div className="relative bg-[#0d1117] border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-[#0d1117] border-b border-slate-800/60 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{CATEGORY_LABEL[kpi.category] ?? kpi.category}</span>
              {source && (
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${SOURCE_STYLE[source]}`}>
                  {source}
                </span>
              )}
            </div>
            <div className="text-[18px] font-bold text-slate-100 tracking-tight">{kpi.name}</div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xl leading-none mt-0.5 transition-colors flex-shrink-0">×</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Value hero */}
          <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-4 text-center">
            <div className="text-[32px] font-bold text-slate-100 tracking-tight">{kpi.formattedValue}</div>
            {kpi.changePercent !== undefined && (
              <div className={`text-[13px] font-medium mt-1 ${kpi.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpi.changePercent >= 0 ? '↑' : '↓'} {Math.abs(kpi.changePercent).toFixed(1)}% vs prior period
              </div>
            )}
            {kpi.sparkline && (
              <div className="mt-3 flex justify-center">
                <Sparkline values={kpi.sparkline} positive={!kpi.id.includes('concentration')}/>
              </div>
            )}
          </div>

          {/* Formula lineage — real values */}
          {lineage && (
            <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">How It&apos;s Calculated</div>
              <div className="space-y-1.5">
                {lineage.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {step.operator ? (
                      <span className="w-4 text-center text-slate-500 text-sm font-medium flex-shrink-0">{step.operator}</span>
                    ) : (
                      <span className="w-4 flex-shrink-0"/>
                    )}
                    <div className="flex-1 flex items-center justify-between gap-3 bg-[#0d1117] border border-slate-800/40 rounded-lg px-3 py-1.5">
                      <span className="text-[11px] text-slate-400">{step.label}</span>
                      {step.value && <span className="text-[12px] font-mono font-semibold text-slate-200 tabular-nums">{step.value}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/40 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">= Result</span>
                <span className="text-[14px] font-bold text-slate-100 font-mono tabular-nums">{lineage.result}</span>
              </div>
              {lineage.note && (
                <div className="mt-1.5 text-[10px] text-slate-600 italic">{lineage.note}</div>
              )}
            </div>
          )}

          {/* Abstract formula fallback when no lineage */}
          {!lineage && (
            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Formula</div>
              <div className="text-[12px] text-slate-400 font-mono bg-slate-900/40 border border-slate-800/40 rounded-lg px-3 py-2">{kpi.formula}</div>
            </div>
          )}

          {/* Trajectory projection */}
          {kpi.sparkline && kpi.sparkline.length >= 2 && (() => {
            const { slope, intercept } = linReg(kpi.sparkline);
            const n = kpi.sparkline.length;
            const proj3 = intercept + slope * (n + 2);
            const isImproving = kpi.id.includes('concentration') ? slope < 0 : slope > 0;
            const projFmt = kpi.unit === '$'
              ? (Math.abs(proj3) >= 1_000_000 ? `$${(proj3/1_000_000).toFixed(1)}M` : Math.abs(proj3) >= 1_000 ? `$${(proj3/1_000).toFixed(0)}k` : `$${proj3.toFixed(0)}`)
              : `${proj3.toFixed(1)}%`;
            return (
              <div className={`rounded-xl border px-3.5 py-3 ${isImproving ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-slate-500">Trend Projection</div>
                <div className={`text-[12px] font-semibold ${isImproving ? 'text-emerald-400' : 'text-red-400'}`}>
                  At the current trend, {kpi.name} will reach {projFmt} in 3 periods
                </div>
                <div className="text-[10px] text-slate-600 mt-1">
                  Linear regression on {n} data points · slope: {slope >= 0 ? '+' : ''}{kpi.unit === '$' ? `$${slope.toFixed(0)}` : `${slope.toFixed(2)}pp`}/period
                </div>
              </div>
            );
          })()}

          {/* Goal attainment */}
          {attainment !== undefined && goalFmt && (
            <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-400">Target: {goalFmt}</span>
                <span className={`text-[12px] font-bold ${attainment >= 100 ? 'text-emerald-400' : attainment >= 75 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {attainment >= 100 ? '✓ Goal met' : `${attainment.toFixed(0)}% of target`}
                </span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${attainment >= 100 ? 'bg-emerald-500' : attainment >= 75 ? 'bg-amber-500' : 'bg-indigo-500/50'}`}
                  style={{ width: `${Math.min(attainment, 100)}%` }}/>
              </div>
            </div>
          )}

          {/* Benchmark */}
          {bench && (
            <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3.5">
              <div className="text-[10px] font-semibold text-indigo-400/70 uppercase tracking-wider mb-2">Industry Benchmark</div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-400">{bench.label}</span>
                <span className="text-[13px] font-bold text-slate-200">{bench.value}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5 italic">{bench.good}</div>
            </div>
          )}

          <div className="text-[12px] text-slate-500 leading-relaxed">{kpi.description}</div>

          {/* Drilldown action */}
          {drillView && onNavigate && (
            <button
              onClick={() => { onNavigate(drillView); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 rounded-xl text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              View full {TAB_LABEL[drillView]} analysis
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M6 4l4 4-4 4"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────────
function KPICard({
  kpi, goal, data, previousData, onNavigate,
}: {
  kpi: KPIResult;
  goal?: number;
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onNavigate?: (view: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied]         = useState(false);
  const source = METRIC_SOURCE[kpi.id];

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(kpi.formattedValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const statusStyles = {
    green:   { border: 'border-l-emerald-500', bg: 'bg-emerald-500/[0.04]' },
    yellow:  { border: 'border-l-amber-500',   bg: 'bg-amber-500/[0.04]'   },
    red:     { border: 'border-l-red-500',      bg: 'bg-red-500/[0.04]'     },
    neutral: { border: 'border-l-slate-700',    bg: ''                       },
  }[kpi.status] ?? { border: 'border-l-slate-700', bg: '' };

  const isInverse  = kpi.id.includes('concentration');
  const trendUp    = kpi.trend === 'up';
  const trendDown  = kpi.trend === 'down';
  const trendGood  = isInverse ? trendDown : trendUp;
  const trendBad   = isInverse ? trendUp   : trendDown;
  const arrow      = trendUp ? '↑' : trendDown ? '↓' : '→';
  const changeCls  = trendGood ? 'text-emerald-400' : trendBad ? 'text-red-400' : 'text-slate-500';
  const pillCls    = kpi.changePercent !== undefined
    ? trendGood ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    : trendBad  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700/50'
    : '';

  // Goal attainment
  const attainment = goal !== undefined && goal !== 0 ? Math.min((kpi.value / goal) * 100, 100) : undefined;
  const attainmentColor = attainment !== undefined
    ? attainment >= 100 ? 'bg-emerald-500' : attainment >= 75 ? 'bg-amber-500' : 'bg-indigo-500/50'
    : '';

  return (
    <>
      <button onClick={() => setShowDetail(true)}
        className={`group w-full text-left ${statusStyles.bg} hover:bg-slate-800/60 border border-slate-800/50 border-l-2 ${statusStyles.border} rounded-xl p-3.5 relative transition-all cursor-pointer print-break-avoid`}>
        {kpi.isAnomalous && <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>}
        {/* Name row */}
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] truncate mb-2">{kpi.name}</div>
        {/* Value + change pill */}
        <div className="flex items-end justify-between gap-1">
          <div
            className="text-[18px] font-bold tracking-tight text-slate-100 leading-none cursor-copy group-hover:text-indigo-100 transition-colors relative"
            onClick={handleCopy}
            title="Click to copy"
          >
            {copied ? <span className="text-xs text-emerald-400 font-semibold">✓ Copied</span> : kpi.formattedValue}
          </div>
          {kpi.changePercent !== undefined && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${pillCls}`}>
              {arrow}{Math.abs(kpi.changePercent).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Sparkline */}
        {kpi.sparkline && kpi.sparkline.length > 1 && (
          <div className="mt-2">
            <Sparkline values={kpi.sparkline} positive={!isInverse}/>
          </div>
        )}

        {/* Benchmark — single text line, no bar */}
        {(() => {
          const bv = BENCHMARK_VALS[kpi.id];
          if (!bv) return null;
          const isInvB = bv.inverse ?? false;
          const diff = kpi.value - bv.val;
          const isAhead = isInvB ? diff < 0 : diff > 0;
          const absDiff = Math.abs(diff);
          const isMonetary = kpi.unit === '$';
          const fmtDiff = isMonetary
            ? (absDiff >= 1_000_000 ? `$${(absDiff/1_000_000).toFixed(1)}M` : absDiff >= 1000 ? `$${(absDiff/1000).toFixed(0)}k` : `$${absDiff.toFixed(0)}`)
            : `${absDiff.toFixed(1)}pp`;
          return (
            <div className={`mt-2 text-[10px] font-medium tabular-nums ${isAhead ? 'text-emerald-400/60' : 'text-amber-400/60'}`}>
              {isAhead ? `+${fmtDiff} vs` : `${fmtDiff} below`} {bv.label}
            </div>
          );
        })()}
      </button>
      {showDetail && (
        <KPIDetailModal
          kpi={kpi} goal={goal}
          data={data} previousData={previousData}
          onNavigate={onNavigate}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}

// ── Category group ─────────────────────────────────────────────────────────────
function KPIGroup({
  categoryId, kpis, goals, data, previousData, onNavigate, defaultExpanded = true,
}: {
  categoryId: string;
  kpis: KPIResult[];
  goals?: Goals;
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onNavigate?: (view: string) => void;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);
  const cfg = CATEGORY_CONFIG[categoryId] ?? CATEGORY_CONFIG.revenue;

  const headline = kpis[0];
  const greenCount  = kpis.filter(k => k.status === 'green').length;
  const redCount    = kpis.filter(k => k.status === 'red').length;

  // Goal attainment summary for this group
  const kpisWithGoals = kpis.filter(k => {
    const goalKey = KPI_GOAL_MAP[k.id];
    return goalKey && goals?.[goalKey] !== undefined;
  });
  const goalsOnTrack = kpisWithGoals.filter(k => {
    const goalKey = KPI_GOAL_MAP[k.id]!;
    const goalVal = goals![goalKey]!;
    return goalVal > 0 && (k.value / goalVal) >= 1.0;
  }).length;

  const statusSummary =
    redCount > 0   ? `${redCount} needs attention` :
    greenCount > 0 ? `${greenCount} on track` : '';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${cfg.border} ${open ? cfg.bg : 'border-slate-800/50 bg-slate-900/30'}`}
      data-collapsible-body={open ? undefined : 'true'}>
      {/* Group header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/20 transition-colors text-left no-print">
        <div className={`flex-shrink-0 ${cfg.accent}`}>{cfg.icon}</div>
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <span className={`text-[12px] font-semibold flex-shrink-0 ${cfg.accent}`}>{cfg.label}</span>
          {headline && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[12px] font-bold text-slate-200 flex-shrink-0">{headline.formattedValue}</span>
              <span className="text-[11px] text-slate-600 truncate hidden sm:block">{headline.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusSummary && (
            <span className={`hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              redCount > 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>{statusSummary}</span>
          )}
          {kpisWithGoals.length > 0 && goalsOnTrack > 0 && (
            <span className="hidden lg:inline text-[10px] font-medium px-2 py-0.5 rounded-full border bg-indigo-500/8 text-indigo-400/70 border-indigo-500/15">
              {goalsOnTrack}/{kpisWithGoals.length}
            </span>
          )}
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className={`w-2.5 h-2.5 text-slate-600 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
            <path d="M2 3.5L5 6.5 8 3.5"/>
          </svg>
        </div>
      </button>

      {/* Print: always show label */}
      <div className="hidden print:block px-4 py-2 border-b border-slate-800/30">
        <span className={`text-[11px] font-semibold ${cfg.accent}`}>{cfg.label}</span>
      </div>

      {/* Expanded KPI cards */}
      {open && (
        <div className="px-4 pb-4 pt-1">
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-2.5">
            {kpis.map(kpi => {
              const goalKey = KPI_GOAL_MAP[kpi.id];
              const goal    = goalKey ? goals?.[goalKey] : undefined;
              return <KPICard key={kpi.id} kpi={kpi} goal={goal} data={data} previousData={previousData} onNavigate={onNavigate}/>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Grid ───────────────────────────────────────────────────────────────────────
export default function KPIGrid({ dashboard, data, previousData, goals, onNavigate }: Props) {
  const kpis = dashboard?.kpis ?? computeKPIs(data, previousData);

  const categories = ['revenue', 'profitability', 'customers', 'operations', 'cash'] as const;
  const grouped = categories
    .map(cat => ({ cat, items: kpis.filter(k => k.category === cat) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="space-y-2">
      {grouped.map(({ cat, items }) => (
        <KPIGroup
          key={cat}
          categoryId={cat}
          kpis={items}
          goals={goals}
          data={data}
          previousData={previousData}
          onNavigate={onNavigate}
          defaultExpanded={cat === 'revenue' || cat === 'profitability'}
        />
      ))}
    </div>
  );
}
