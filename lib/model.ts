// ─── Unified Business Model ────────────────────────────────────────────────────
// Central computation layer that connects all modules.
// Every number a user sees flows through here so changes propagate everywhere.

import type { UnifiedBusinessData } from '../types';
import type { Deal } from './deals';

// ── Scenario overlay ───────────────────────────────────────────────────────────

export interface ScenarioAdjustment {
  name:             string;
  revenueGrowthPct: number;   // % change on base revenue
  grossMarginPct:   number;   // 0 = keep current
  opexChangePct:    number;   // % change to OpEx
  newHires:         number;
  avgCompK:         number;   // annual compensation per hire ($k)
  priceIncreasePct: number;
  newCustomers:     number;   // incremental customers added (revenue = n × avg rev/customer)
  churnRatePct:     number;   // additional % of revenue lost to churn above baseline
  oneTimeExpense:   number;   // one-time below-the-line cost ($)
}

export const ZERO_SCENARIO: ScenarioAdjustment = {
  name: 'Base',
  revenueGrowthPct: 0,
  grossMarginPct:   0,
  opexChangePct:    0,
  newHires:         0,
  avgCompK:         100,
  priceIncreasePct: 0,
  newCustomers:     0,
  churnRatePct:     0,
  oneTimeExpense:   0,
};

/**
 * Apply a scenario overlay to base data.
 * Returns an adjusted copy — all modules receive this instead of raw data.
 */
export function applyScenario(
  base: UnifiedBusinessData,
  s: ScenarioAdjustment | null
): UnifiedBusinessData {
  if (!s || isZeroScenario(s)) return base;

  const baseRev  = base.revenue.total;
  const baseCOGS = base.costs.totalCOGS;
  const baseGP   = baseRev - baseCOGS;
  const baseGM   = baseRev > 0 ? (baseGP / baseRev) * 100 : 40;

  const customerCount     = base.customers.totalCount || 1;
  const avgRevPerCustomer = baseRev / customerCount;
  const newCustomerRev    = (s.newCustomers ?? 0) * avgRevPerCustomer;

  const preChurnRev = (baseRev + newCustomerRev)
    * (1 + s.revenueGrowthPct / 100)
    * (1 + s.priceIncreasePct / 100);

  // Additional churn beyond baseline (affects top-line revenue)
  const churnRevLost = preChurnRev * ((s.churnRatePct ?? 0) / 100);
  const projRev      = preChurnRev - churnRevLost;

  const gmPct    = s.grossMarginPct > 0 ? s.grossMarginPct : baseGM;
  const projCOGS = projRev * (1 - gmPct / 100);
  const hireCost   = s.newHires * s.avgCompK * 1_000;
  const projOpEx   = base.costs.totalOpEx * (1 + s.opexChangePct / 100) + hireCost;
  const oneTimeCost = s.oneTimeExpense ?? 0;

  return {
    ...base,
    revenue: { ...base.revenue, total: projRev },
    costs:   { ...base.costs,   totalCOGS: projCOGS, totalOpEx: projOpEx + oneTimeCost },
  };
}

export function isZeroScenario(s: ScenarioAdjustment): boolean {
  return (
    s.revenueGrowthPct === 0 &&
    s.grossMarginPct   === 0 &&
    s.opexChangePct    === 0 &&
    s.newHires         === 0 &&
    s.priceIncreasePct === 0 &&
    (s.newCustomers    ?? 0) === 0 &&
    (s.churnRatePct    ?? 0) === 0 &&
    (s.oneTimeExpense  ?? 0) === 0
  );
}

// ── Pipeline analysis ─────────────────────────────────────────────────────────

export interface PipelineMetrics {
  totalDeals:    number;
  activeDeals:   number;
  totalEV:       number;   // sum of askingPrice for all active deals
  weightedEV:    number;   // probability-weighted (uses stage probability)
  lateStageEV:   number;   // LOI + DD + Closing only
  lateStageCount:number;
  closingThisQuarter: number;   // deals expected to close in next 90 days
}

// Implicit probability by stage (absence of explicit field)
const STAGE_PROB: Record<string, number> = {
  sourcing:        0.05,
  contacted:       0.10,
  nda:             0.20,
  cim:             0.30,
  loi:             0.55,
  'due-diligence': 0.70,
  closing:         0.85,
  'closed-won':    1.00,
  'closed-lost':   0.00,
  passed:          0.00,
};

export function computePipelineMetrics(deals: Deal[]): PipelineMetrics {
  const active     = deals.filter(d => !['closed-won', 'closed-lost', 'passed'].includes(d.stage));
  const lateStages = ['loi', 'due-diligence', 'closing'];
  const lateStage  = active.filter(d => lateStages.includes(d.stage));
  const now        = Date.now();
  const q90        = now + 90 * 86_400_000;

  return {
    totalDeals:    deals.length,
    activeDeals:   active.length,
    totalEV:       active.reduce((s, d) => s + (d.askingPrice ?? 0), 0),
    weightedEV:    active.reduce((s, d) => s + (d.askingPrice ?? 0) * (STAGE_PROB[d.stage] ?? 0), 0),
    lateStageEV:   lateStage.reduce((s, d) => s + (d.askingPrice ?? 0), 0),
    lateStageCount:lateStage.length,
    closingThisQuarter: active.filter(d => {
      if (!d.closingDate) return false;
      const t = new Date(d.closingDate).getTime();
      return t > now && t <= q90;
    }).length,
  };
}

// ── Cash & runway ─────────────────────────────────────────────────────────────

export interface RunwayMetrics {
  cashBalance:     number;
  avgMonthlyNet:   number;   // positive = generating cash, negative = burning
  runwayMonths:    number | null;
  source:          string;
}

export function computeRunway(data: UnifiedBusinessData): RunwayMetrics {
  const cf = data.cashFlow ?? [];

  if (cf.length > 0) {
    const latest   = cf[cf.length - 1];
    const avgNet   = cf.reduce((s, p) => s + (p.netCashFlow ?? (p.closingBalance - p.openingBalance)), 0) / cf.length;
    const isBurn   = avgNet < 0;
    return {
      cashBalance:   latest.closingBalance,
      avgMonthlyNet: avgNet,
      runwayMonths:  isBurn ? Math.abs(latest.closingBalance / avgNet) : null,
      source:        `Cash Flow Stmt · ${cf.length}-period avg`,
    };
  }

  // Fallback: infer from P&L
  const rev    = data.revenue.total;
  const ebitda = rev - data.costs.totalCOGS - data.costs.totalOpEx;
  const monthly = ebitda / 12;
  const estCash = rev / 12; // rough: 1 month of revenue as working capital estimate
  return {
    cashBalance:   estCash,
    avgMonthlyNet: monthly,
    runwayMonths:  monthly < 0 ? estCash / Math.abs(monthly) : null,
    source:        'Estimated from P&L',
  };
}

// ── Full connected model chain ────────────────────────────────────────────────

export interface ModelChain {
  // Pipeline
  pipeline:         PipelineMetrics;

  // Revenue
  ttmRevenue:       number;
  revenueGrowthPct: number | null;
  grossMarginPct:   number;

  // Profitability
  ebitda:           number;
  ebitdaMarginPct:  number;

  // Cash + runway
  runway:           RunwayMetrics;

  // Scenario state
  hasScenario:      boolean;
  scenarioName:     string;
}

export function computeModelChain(
  data: UnifiedBusinessData,
  deals: Deal[],
  scenario: ScenarioAdjustment | null
): ModelChain {
  const effective = applyScenario(data, scenario);
  const rev    = effective.revenue.total;
  const cogs   = effective.costs.totalCOGS;
  const opex   = effective.costs.totalOpEx;
  const gp     = rev - cogs;
  const ebitda = gp - opex;

  const gmPct     = rev > 0 ? (gp   / rev) * 100 : 0;
  const ebitdaPct = rev > 0 ? (ebitda / rev) * 100 : 0;

  // YoY revenue growth from period data
  const periods = data.revenue.byPeriod;
  let revenueGrowthPct: number | null = null;
  if (periods.length >= 2) {
    const cur  = periods[periods.length - 1].revenue;
    const prev = periods[periods.length - 2].revenue;
    revenueGrowthPct = prev > 0 ? ((cur - prev) / prev) * 100 : null;
  }

  return {
    pipeline:         computePipelineMetrics(deals),
    ttmRevenue:       rev,
    revenueGrowthPct,
    grossMarginPct:   gmPct,
    ebitda,
    ebitdaMarginPct:  ebitdaPct,
    runway:           computeRunway(effective),
    hasScenario:      !!scenario && !isZeroScenario(scenario),
    scenarioName:     scenario?.name ?? 'Base',
  };
}

// ── Metric lineage record ─────────────────────────────────────────────────────

export interface MetricLineage {
  metricId:   string;
  label:      string;
  value:      string;
  formula:    string;
  inputs:     { label: string; value: string; source: string }[];
  dataSource: string;
  refreshed:  string;  // ISO timestamp
}

export function buildLineageMap(
  data: UnifiedBusinessData,
  chain: ModelChain,
  effectiveData?: UnifiedBusinessData
): Record<string, MetricLineage> {
  const src  = effectiveData ?? data;
  const rev  = chain.ttmRevenue;
  const cogs = src.costs.totalCOGS;
  const opex = src.costs.totalOpEx;
  const gp   = rev - cogs;
  const ebitda = chain.ebitda;
  const fmtM   = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };
  const now    = data.metadata.asOf;

  return {
    revenue: {
      metricId: 'revenue', label: 'Total Revenue', value: fmtM(rev),
      formula: 'Sum of all revenue streams',
      inputs: [{ label: 'Revenue', value: fmtM(rev), source: data.metadata.sources[0] ?? 'Uploaded data' }],
      dataSource: data.metadata.sources.join(', '),
      refreshed: now,
    },
    ebitda: {
      metricId: 'ebitda', label: 'EBITDA', value: fmtM(ebitda),
      formula: 'Revenue − COGS − OpEx',
      inputs: [
        { label: 'Revenue',  value: fmtM(rev),    source: 'P&L' },
        { label: '− COGS',   value: fmtM(cogs),   source: 'P&L' },
        { label: '− OpEx',   value: fmtM(opex),   source: 'P&L' },
      ],
      dataSource: 'P&L Statement',
      refreshed: now,
    },
    grossMargin: {
      metricId: 'grossMargin', label: 'Gross Margin', value: `${chain.grossMarginPct.toFixed(1)}%`,
      formula: '(Revenue − COGS) / Revenue',
      inputs: [
        { label: 'Gross Profit', value: fmtM(gp),  source: 'P&L' },
        { label: '÷ Revenue',    value: fmtM(rev),  source: 'P&L' },
      ],
      dataSource: 'P&L Statement',
      refreshed: now,
    },
    cashRunway: {
      metricId: 'cashRunway', label: 'Cash Runway',
      value: chain.runway.runwayMonths !== null ? `${chain.runway.runwayMonths.toFixed(1)} months` : '∞',
      formula: 'Cash Balance ÷ Avg Monthly Burn',
      inputs: [
        { label: 'Cash Balance',    value: fmtM(chain.runway.cashBalance),         source: chain.runway.source },
        { label: 'Avg Monthly Net', value: fmtM(Math.abs(chain.runway.avgMonthlyNet)), source: 'Cash Flow Stmt' },
      ],
      dataSource: chain.runway.source,
      refreshed: now,
    },
  };
}
