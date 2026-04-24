/**
 * Valuation Estimator
 * M&A-grade EBITDA-multiple range with quality-of-earnings adjustments.
 * Designed for lower middle market ($2M–$50M revenue).
 * Includes: Precedent Transactions, Public Comps, and DCF (3-method valuation).
 */
import { useState, useMemo, useEffect } from 'react';
import type { LiveComp } from '../../pages/api/data/public-comps';
import type { UnifiedBusinessData, CustomerIndustry } from '../../types';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
};

// ── Industry multiple ranges ──────────────────────────────────────────────────
const INDUSTRIES = [
  { id: 'professional',  label: 'Professional Services', low: 4.0, high: 7.0 },
  { id: 'tech-services', label: 'Technology Services',   low: 6.0, high: 9.5 },
  { id: 'manufacturing', label: 'Manufacturing',         low: 3.5, high: 6.0 },
  { id: 'distribution',  label: 'Distribution',          low: 3.0, high: 5.5 },
  { id: 'saas',          label: 'SaaS / Recurring Rev',  low: 8.0, high: 14.0 },
  { id: 'healthcare',    label: 'Healthcare Services',   low: 5.5, high: 9.0 },
  { id: 'construction',  label: 'Construction / Trades', low: 3.0, high: 5.0 },
  { id: 'other',         label: 'Other / General',       low: 4.0, high: 7.0 },
] as const;

type IndustryId = typeof INDUSTRIES[number]['id'];

// ── Map CustomerIndustry → IndustryId ────────────────────────────────────────
const INDUSTRY_MAP: Partial<Record<CustomerIndustry, IndustryId>> = {
  'professional-services': 'professional',
  'saas-technology':       'saas',
  'manufacturing':         'manufacturing',
  'healthcare':            'healthcare',
  'construction':          'construction',
  'distribution':          'distribution',
  'financial-services':    'professional',
  'retail':                'other',
};

function detectIndustry(data: UnifiedBusinessData): IndustryId {
  const revByIndustry: Partial<Record<IndustryId, number>> = {};
  for (const c of data.customers.topCustomers) {
    if (!c.industry) continue;
    const mapped = INDUSTRY_MAP[c.industry];
    if (!mapped) continue;
    revByIndustry[mapped] = (revByIndustry[mapped] ?? 0) + c.revenue;
  }
  let best: IndustryId = 'professional';
  let bestRev = 0;
  for (const [id, rev] of Object.entries(revByIndustry) as [IndustryId, number][]) {
    if (rev > bestRev) { bestRev = rev; best = id; }
  }
  return best;
}

// ── Quality factor definitions ────────────────────────────────────────────────
interface QualityFactor {
  id: string;
  label: string;
  description: string;
  delta: number; // multiple adjustment
  status: 'positive' | 'neutral' | 'negative';
  display: string;
}

function computeQualityFactors(
  data: UnifiedBusinessData,
  previousData?: UnifiedBusinessData
): QualityFactor[] {
  const rev          = data.revenue.total;
  const cogs         = data.costs.totalCOGS;
  const opex         = data.costs.totalOpEx;
  const gp           = rev - cogs;
  const ebitda       = gp - opex;
  const ebitdaMargin = rev > 0 ? (ebitda / rev) * 100 : 0;
  const gpMargin     = rev > 0 ? (gp / rev) * 100 : 0;
  const prevRev      = previousData?.revenue.total ?? 0;
  const revGrowth    = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0;
  const topCustPct   = data.customers.topCustomers[0]?.percentOfTotal ?? 0;
  const top3Pct      = data.customers.topCustomers.slice(0,3).reduce((s,c) => s + c.percentOfTotal, 0);
  const retention    = (data.customers.retentionRate ?? 0.88) * 100;
  const recurringRev = data.revenue.recurring;
  const recurringPct = recurringRev && rev > 0 ? (recurringRev / rev) * 100 : null;

  const factors: QualityFactor[] = [];

  // 1. Revenue growth
  {
    const delta = prevRev > 0
      ? (revGrowth >= 25 ? +1.5 : revGrowth >= 15 ? +0.75 : revGrowth >= 5 ? 0 : revGrowth >= 0 ? -0.5 : -1.5)
      : 0;
    factors.push({
      id: 'revenue-growth',
      label: 'Revenue Growth',
      description: prevRev > 0 ? `${revGrowth >= 0 ? '+' : ''}${revGrowth.toFixed(1)}% vs prior period` : 'No prior period comparison',
      delta,
      status: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      display: prevRev > 0 ? `${revGrowth >= 0 ? '+' : ''}${revGrowth.toFixed(1)}%` : 'N/A',
    });
  }

  // 2. EBITDA margin
  {
    const delta = ebitdaMargin >= 22 ? +1.0 : ebitdaMargin >= 15 ? +0.5 : ebitdaMargin >= 8 ? 0 : ebitdaMargin >= 0 ? -0.5 : -1.5;
    factors.push({
      id: 'ebitda-margin',
      label: 'EBITDA Margin',
      description: ebitdaMargin >= 20 ? 'Strong margins command premium' : ebitdaMargin >= 10 ? 'Healthy operating margin' : 'Margin improvement needed',
      delta,
      status: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      display: `${ebitdaMargin.toFixed(1)}%`,
    });
  }

  // 3. Customer concentration
  {
    const delta = topCustPct > 35 ? -1.5 : topCustPct > 25 ? -1.0 : topCustPct > 15 ? -0.5 : top3Pct < 30 ? +0.5 : 0;
    factors.push({
      id: 'concentration',
      label: 'Customer Concentration',
      description: topCustPct > 25 ? `Top customer is ${topCustPct.toFixed(0)}% of revenue — significant risk` :
        topCustPct > 15 ? `Top customer at ${topCustPct.toFixed(0)}% — watch list` :
        'Well-diversified revenue base',
      delta,
      status: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      display: `${topCustPct.toFixed(0)}% top`,
    });
  }

  // 4. Retention
  {
    const delta = retention >= 95 ? +1.0 : retention >= 90 ? +0.5 : retention >= 80 ? 0 : retention >= 70 ? -0.5 : -1.0;
    factors.push({
      id: 'retention',
      label: 'Customer Retention',
      description: retention >= 90 ? 'Best-in-class retention signals sticky revenue' :
        retention >= 80 ? 'Average retention — explore churn drivers' :
        'Elevated churn — requires immediate attention',
      delta,
      status: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      display: `${retention.toFixed(0)}%`,
    });
  }

  // 5. Revenue quality (recurring mix)
  if (recurringPct !== null) {
    const delta = recurringPct >= 70 ? +1.5 : recurringPct >= 50 ? +0.75 : recurringPct >= 30 ? 0 : -0.25;
    factors.push({
      id: 'recurring',
      label: 'Recurring Revenue',
      description: recurringPct >= 70 ? 'Highly predictable revenue — premium warranted' :
        recurringPct >= 40 ? 'Meaningful recurring base' :
        'Predominantly transactional — adds risk discount',
      delta,
      status: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      display: `${recurringPct.toFixed(0)}% recurring`,
    });
  }

  // 6. Scale
  {
    const delta = rev >= 25_000_000 ? +0.5 : rev >= 10_000_000 ? +0.25 : rev >= 5_000_000 ? 0 : -0.25;
    const periodCount = data.revenue.byPeriod.length || 1;
    const annualRev = Math.round((rev / periodCount) * 12);
    factors.push({
      id: 'scale',
      label: 'Business Scale',
      description: annualRev >= 25_000_000 ? 'Scale reduces buyer risk and widens buyer pool' :
        annualRev >= 10_000_000 ? 'Mid-market scale with good buyer interest' :
        'Smaller size — more buyer uncertainty',
      delta,
      status: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      display: fmt(annualRev) + '/yr est.',
    });
  }

  return factors;
}

// ── Value Creation Roadmap ────────────────────────────────────────────────────
interface RoadmapItem {
  id: string;
  action: string;
  currentDisplay: string;
  targetDisplay: string;
  potentialDelta: number; // additional × achievable
  timeframe: string;
  category: 'revenue' | 'margin' | 'risk' | 'scale';
}

const CATEGORY_STYLE: Record<RoadmapItem['category'], { label: string; color: string; bg: string }> = {
  revenue: { label: 'Revenue',   color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20' },
  margin:  { label: 'Margin',    color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/15' },
  risk:    { label: 'Risk',      color: 'text-amber-400',   bg: 'bg-amber-500/8 border-amber-500/15' },
  scale:   { label: 'Scale',     color: 'text-violet-400',  bg: 'bg-violet-500/8 border-violet-500/15' },
};

function buildRoadmap(data: UnifiedBusinessData, previousData?: UnifiedBusinessData): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  const rev          = data.revenue.total;
  const cogs         = data.costs.totalCOGS;
  const opex         = data.costs.totalOpEx;
  const gp           = rev - cogs;
  const ebitda       = gp - opex;
  const ebitdaMargin = rev > 0 ? (ebitda / rev) * 100 : 0;
  const prevRev      = previousData?.revenue.total ?? 0;
  const revGrowth    = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0;
  const topCustPct   = data.customers.topCustomers[0]?.percentOfTotal ?? 0;
  const retention    = (data.customers.retentionRate ?? 0.88) * 100;
  const recurringRev = data.revenue.recurring;
  const recurringPct = recurringRev && rev > 0 ? (recurringRev / rev) * 100 : null;
  const periodCount  = data.revenue.byPeriod.length || 1;
  const annualRev    = Math.round((rev / periodCount) * 12);

  // Revenue growth
  if (prevRev > 0 && revGrowth < 25) {
    const cur = revGrowth >= 15 ? 0.75 : revGrowth >= 5 ? 0 : revGrowth >= 0 ? -0.5 : -1.5;
    const potential = 1.5 - cur;
    if (potential > 0) items.push({
      id: 'grow-revenue',
      action: 'Accelerate revenue growth to 25%+ YoY',
      currentDisplay: `${revGrowth.toFixed(1)}% growth`,
      targetDisplay: '25%+ YoY',
      potentialDelta: potential,
      timeframe: '12–18 months',
      category: 'revenue',
    });
  }

  // Recurring mix
  if (recurringPct !== null && recurringPct < 70) {
    const cur = recurringPct >= 50 ? 0.75 : recurringPct >= 30 ? 0 : -0.25;
    const potential = 1.5 - cur;
    if (potential > 0) items.push({
      id: 'grow-recurring',
      action: 'Convert project work to recurring retainers',
      currentDisplay: `${recurringPct.toFixed(0)}% recurring`,
      targetDisplay: '70%+ recurring',
      potentialDelta: potential,
      timeframe: '12–24 months',
      category: 'revenue',
    });
  }

  // EBITDA margin
  if (ebitdaMargin < 22) {
    const cur = ebitdaMargin >= 15 ? 0.5 : ebitdaMargin >= 8 ? 0 : ebitdaMargin >= 0 ? -0.5 : -1.5;
    const potential = 1.0 - cur;
    if (potential > 0) items.push({
      id: 'improve-margin',
      action: 'Improve EBITDA margin above 22%',
      currentDisplay: `${ebitdaMargin.toFixed(1)}% EBITDA`,
      targetDisplay: '22%+ EBITDA',
      potentialDelta: potential,
      timeframe: '6–12 months',
      category: 'margin',
    });
  }

  // Customer concentration
  if (topCustPct > 15) {
    const cur = topCustPct > 35 ? -1.5 : topCustPct > 25 ? -1.0 : -0.5;
    const potential = 0.5 - cur; // from negative → +0.5 (diversified)
    items.push({
      id: 'reduce-concentration',
      action: 'Diversify — reduce top customer below 15%',
      currentDisplay: `${topCustPct.toFixed(0)}% top customer`,
      targetDisplay: '<15% top customer',
      potentialDelta: potential,
      timeframe: '18–24 months',
      category: 'risk',
    });
  }

  // Retention
  if (retention < 95) {
    const cur = retention >= 90 ? 0.5 : retention >= 80 ? 0 : retention >= 70 ? -0.5 : -1.0;
    const potential = 1.0 - cur;
    if (potential > 0) items.push({
      id: 'improve-retention',
      action: 'Improve customer retention to 95%+',
      currentDisplay: `${retention.toFixed(0)}% retained`,
      targetDisplay: '95%+ retention',
      potentialDelta: potential,
      timeframe: '6–18 months',
      category: 'risk',
    });
  }

  // Scale
  if (annualRev < 10_000_000) {
    items.push({
      id: 'scale',
      action: 'Scale annual revenue above $10M',
      currentDisplay: `${fmt(annualRev)}/yr est.`,
      targetDisplay: '$10M+ ARR',
      potentialDelta: 0.25,
      timeframe: '24–36 months',
      category: 'scale',
    });
  }

  return items.sort((a, b) => b.potentialDelta - a.potentialDelta);
}

function ValuationRoadmap({
  items, currentAdjMid,
}: { items: RoadmapItem[]; currentAdjMid: number }) {
  const maxPotential = items.reduce((s, i) => s + i.potentialDelta, 0);
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/20 transition-colors text-left">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold text-slate-100">Value Creation Roadmap</span>
          <span className="text-[11px] text-slate-500">
            {items.length} action{items.length !== 1 ? 's' : ''} identified
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-indigo-400">
            Up to +{maxPotential.toFixed(1)}× potential
          </span>
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className={`w-2.5 h-2.5 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M2 3.5L5 6.5 8 3.5"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-800/40">
          {/* Context bar */}
          <div className="px-5 py-3 bg-slate-900/30 flex items-center gap-3 flex-wrap">
            <div className="text-[11px] text-slate-500">
              Current adjusted mid: <span className="text-slate-200 font-semibold">{currentAdjMid.toFixed(1)}×</span>
            </div>
            <div className="text-slate-700">·</div>
            <div className="text-[11px] text-slate-500">
              Max achievable: <span className="text-indigo-300 font-semibold">{(currentAdjMid + maxPotential).toFixed(1)}×</span>
            </div>
            <div className="text-slate-700">·</div>
            <div className="text-[11px] text-slate-500">Actions ranked by multiple impact</div>
          </div>

          <div className="divide-y divide-slate-800/30">
            {items.map((item, i) => {
              const style = CATEGORY_STYLE[item.category];
              const barWidth = Math.min(100, (item.potentialDelta / Math.max(...items.map(x => x.potentialDelta))) * 100);
              return (
                <div key={item.id} className="px-5 py-4 flex items-start gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center text-[11px] font-bold text-slate-400">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div>
                        <div className="text-[13px] font-medium text-slate-100">{item.action}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${style.bg} ${style.color}`}>
                            {style.label}
                          </span>
                          <span className="text-[11px] text-slate-500">{item.currentDisplay}</span>
                          <span className="text-slate-700 text-[10px]">→</span>
                          <span className="text-[11px] text-slate-300">{item.targetDisplay}</span>
                          <span className="text-[10px] text-slate-600">·</span>
                          <span className="text-[11px] text-slate-500">{item.timeframe}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-[14px] font-bold text-emerald-400">+{item.potentialDelta.toFixed(1)}×</div>
                        <div className="text-[10px] text-slate-600">to multiple</div>
                      </div>
                    </div>
                    {/* Impact bar */}
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500/50 transition-all" style={{ width: `${barWidth}%` }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {items.length === 0 && (
            <div className="px-5 py-6 text-center text-[12px] text-slate-500">
              No major improvements identified — this business scores well across all valuation factors.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Precedent Transaction Market Data (aggregate, by industry) ───────────────
// WHY NOT SEC FILINGS: LMM precedent transactions are private M&A deals — the
// buyer and seller are typically private companies, so no SEC filing is required.
// Deal terms are reported voluntarily to proprietary databases (GF Data, IBBA,
// PitchBook, CapIQ) by participating advisors. Coverage is therefore incomplete,
// but these aggregates represent the best available benchmarks for LMM M&A.
//
// Sources: GF Data M&A Report (2024 Annual, published Q1 2025),
//          IBBA Market Pulse (Q4 2024 / Q1 2025),
//          Kroll Cost of Capital Navigator 2025,
//          Irving Levin Associates (healthcare),
//          FMI Capital Advisors (construction),
//          Corum Group Tech M&A Report 2024/2025
interface PrecedentData {
  industry: string;
  medianEVEBITDA: number; p25EVEBITDA: number; p75EVEBITDA: number;
  medianEVRevenue: number;
  dealSizeRange: string;
  dealCountNote: string;
  primarySource: string;
  secondarySource: string;
  periodCovered: string;
  notes: string;
}

const PRECEDENT_BY_INDUSTRY: Record<string, PrecedentData> = {
  professional: {
    industry: 'professional',
    medianEVEBITDA: 8.0, p25EVEBITDA: 6.0, p75EVEBITDA: 10.5,
    medianEVRevenue: 1.2,
    dealSizeRange: '$10M–$150M EV', dealCountNote: '~80–100 reported deals/yr',
    primarySource:   'GF Data M&A Report, 2024 Annual (Business/Professional Services sector, published Q1 2025)',
    secondarySource: 'IBBA Market Pulse Q4 2024 / Q1 2025 (Advisory & Consulting)',
    periodCovered: '2023–2025',
    notes: 'Multiples firmed modestly in 2024–2025 as PE platform demand remained strong. Higher end (9–11×) for firms with >70% recurring retainer revenue. Platform add-ons often at 1–1.5× premium to standalone.',
  },
  'tech-services': {
    industry: 'tech-services',
    medianEVEBITDA: 10.5, p25EVEBITDA: 8.0, p75EVEBITDA: 14.0,
    medianEVRevenue: 2.0,
    dealSizeRange: '$10M–$200M EV', dealCountNote: '~120–150 reported deals/yr',
    primarySource:   'GF Data M&A Report, 2024 Annual (Technology & Software sector, published Q1 2025)',
    secondarySource: 'Corum Group Tech M&A Report 2024/2025; 451 Research',
    periodCovered: '2023–2025',
    notes: 'AI/automation service layer and MSSPs commanding premium (12–16×) as buyers pay for recurring managed revenue. Pure T&M staffing remains 6–8×. Data center buildout driving infrastructure services demand.',
  },
  saas: {
    industry: 'saas',
    medianEVEBITDA: 15.5, p25EVEBITDA: 11.5, p75EVEBITDA: 20.5,
    medianEVRevenue: 4.5,
    dealSizeRange: '$10M–$250M EV', dealCountNote: '~60–80 reported profitable SaaS deals/yr',
    primarySource:   'Sapphire Ventures SaaS Valuation Report 2024/2025; Battery Ventures State of the OpenCloud 2025',
    secondarySource: 'SaaS Capital Index Q1 2025; Bessemer Cloud Index (private comp discount applied)',
    periodCovered: '2023–2025',
    notes: 'SaaS multiples recovered through 2024 as rate environment stabilized. Profitable LMM SaaS 3.5–6× ARR or 11–20× EBITDA. NRR >110% commands significant premium. AI-embedded SaaS seeing buyer interest at the high end.',
  },
  manufacturing: {
    industry: 'manufacturing',
    medianEVEBITDA: 7.0, p25EVEBITDA: 5.2, p75EVEBITDA: 8.8,
    medianEVRevenue: 0.8,
    dealSizeRange: '$10M–$150M EV', dealCountNote: '~100–130 reported deals/yr',
    primarySource:   'GF Data M&A Report, 2024 Annual (Manufacturing & Distribution sector, published Q1 2025)',
    secondarySource: 'Kroll Cost of Capital Navigator 2025; ACG DealSource',
    periodCovered: '2023–2025',
    notes: 'Defense/aerospace sub-tier commands 7.5–10× (strong DoD backlog). Commodity manufacturers 4.5–6×. Proprietary products or critical supply-chain positioning can reach 9–12×.',
  },
  distribution: {
    industry: 'distribution',
    medianEVEBITDA: 6.5, p25EVEBITDA: 4.8, p75EVEBITDA: 8.2,
    medianEVRevenue: 0.6,
    dealSizeRange: '$10M–$100M EV', dealCountNote: '~45–60 reported deals/yr',
    primarySource:   'GF Data M&A Report, 2024 Annual (Manufacturing & Distribution sector, published Q1 2025)',
    secondarySource: 'NAED (National Assn. of Electrical Distributors) M&A Study 2024/2025',
    periodCovered: '2023–2025',
    notes: 'Electrical/data center supply chain distributors seeing elevated activity and premiums (7–9×) from infrastructure buildout. Specialty/value-added distributors (VADs) at 1–2× premium to broadline.',
  },
  healthcare: {
    industry: 'healthcare',
    medianEVEBITDA: 9.5, p25EVEBITDA: 7.0, p75EVEBITDA: 12.5,
    medianEVRevenue: 1.5,
    dealSizeRange: '$10M–$200M EV', dealCountNote: '~65–85 reported deals/yr',
    primarySource:   'GF Data M&A Report, 2024 Annual (Healthcare sector, published Q1 2025)',
    secondarySource: 'Irving Levin Associates Health Care M&A Report 2025',
    periodCovered: '2023–2025',
    notes: 'RCM and outsourced billing typically 8–11×. Home health and behavioral health 10–14× supported by favorable reimbursement trends. Regulatory scrutiny on larger platforms has modestly pressured the upper end.',
  },
  construction: {
    industry: 'construction',
    medianEVEBITDA: 6.8, p25EVEBITDA: 5.0, p75EVEBITDA: 8.8,
    medianEVRevenue: 0.7,
    dealSizeRange: '$5M–$100M EV', dealCountNote: '~35–50 reported deals/yr',
    primarySource:   'FMI Capital Advisors Construction M&A Activity Report 2024/2025',
    secondarySource: 'GF Data M&A Report, 2024 Annual (Business Services sector — construction sub, published Q1 2025)',
    periodCovered: '2023–2025',
    notes: 'Specialty trades (MEP, electrical, fire protection) command 7–10× driven by data center and electrification demand. Service/maintenance recurring backlog is the key value driver. General contractors typically 4–6×.',
  },
  other: {
    industry: 'other',
    medianEVEBITDA: 7.5, p25EVEBITDA: 5.5, p75EVEBITDA: 9.8,
    medianEVRevenue: 1.0,
    dealSizeRange: '$10M–$100M EV', dealCountNote: 'All-sector LMM aggregate',
    primarySource:   'GF Data M&A Report, 2024 Annual (All Sectors, $10M–$250M EV, published Q1 2025)',
    secondarySource: 'IBBA Market Pulse Q4 2024 / Q1 2025 (All Industries)',
    periodCovered: '2023–2025',
    notes: 'Broad LMM aggregate. Multiples firmed modestly in 2024–2025. Actual multiple for your business will vary significantly based on growth rate, revenue quality, and buyer competitive dynamics.',
  },
};

// ── Public Comparables (real publicly traded companies) ───────────────────────
// Source: SEC EDGAR annual filings (10-K / 20-F) — FY2024 filings filed in Q1 2025.
//         EV/EBITDA and EV/Revenue multiples approximate NTM consensus per
//         S&P Capital IQ / Bloomberg as of Q2 2025.
//         Multiples fluctuate daily — verify against current data before any transaction.
//
// WHY SEC FILINGS: Public comps are listed companies — they file annual reports
// (10-K/20-F) with the SEC, making financial data publicly available. This is
// distinct from precedent transactions, which are private deals with no SEC filing.

/** Displayed vintage of the public comp multiples data */
const COMPS_AS_OF = 'Q2 2025';

interface PublicComp {
  ticker: string; name: string; industry: string;
  evEBITDA: number; evRevenue: number; revenueGrowthPct: number; ebitdaMarginPct: number;
  marketCapB: number; // in $B
  secFiling: string; // most recent annual filing cited
}

const PUBLIC_COMPS: PublicComp[] = [
  // ── Professional Services ──────────────────────────────────────────────────
  // Huron Consulting Group (HURN): management consulting & professional services
  { ticker: 'HURN', name: 'Huron Consulting Group',   industry: 'professional',  evEBITDA: 15.2, evRevenue: 1.3, revenueGrowthPct: 14, ebitdaMarginPct: 10, marketCapB: 2.3, secFiling: '10-K FY2024' },
  // FTI Consulting (FCN): economic consulting, restructuring, forensics
  { ticker: 'FCN',  name: 'FTI Consulting',           industry: 'professional',  evEBITDA: 14.5, evRevenue: 1.6, revenueGrowthPct:  5, ebitdaMarginPct: 11, marketCapB: 4.1, secFiling: '10-K FY2024' },
  // ICF International (ICFI): government & commercial advisory
  { ticker: 'ICFI', name: 'ICF International',        industry: 'professional',  evEBITDA: 12.5, evRevenue: 1.0, revenueGrowthPct:  7, ebitdaMarginPct:  9, marketCapB: 2.0, secFiling: '10-K FY2024' },
  // CRA International / Charles River Associates (CRAI): expert witness, litigation consulting
  { ticker: 'CRAI', name: 'Charles River Associates', industry: 'professional',  evEBITDA: 13.2, evRevenue: 1.2, revenueGrowthPct:  8, ebitdaMarginPct: 10, marketCapB: 0.8, secFiling: '10-K FY2024' },

  // ── Technology Services ────────────────────────────────────────────────────
  // EPAM Systems (EPAM): software engineering & IT outsourcing
  { ticker: 'EPAM', name: 'EPAM Systems',             industry: 'tech-services', evEBITDA: 18.5, evRevenue: 2.5, revenueGrowthPct:  1, ebitdaMarginPct: 14, marketCapB:10.5, secFiling: '10-K FY2024' },
  // Globant (GLOB): digital transformation & software development
  { ticker: 'GLOB', name: 'Globant',                  industry: 'tech-services', evEBITDA: 21.5, evRevenue: 3.4, revenueGrowthPct: 16, ebitdaMarginPct: 16, marketCapB: 6.5, secFiling: '20-F FY2024' },
  // Kforce (KFRC): technology staffing & solutions
  { ticker: 'KFRC', name: 'Kforce Inc.',              industry: 'tech-services', evEBITDA:  8.5, evRevenue: 0.4, revenueGrowthPct: -8, ebitdaMarginPct:  4, marketCapB: 0.8, secFiling: '10-K FY2024' },
  // Insight Enterprises (NSIT): IT solutions & managed services
  { ticker: 'NSIT', name: 'Insight Enterprises',      industry: 'tech-services', evEBITDA:  9.5, evRevenue: 0.4, revenueGrowthPct:  3, ebitdaMarginPct:  4, marketCapB: 3.2, secFiling: '10-K FY2024' },

  // ── SaaS / Recurring Revenue ───────────────────────────────────────────────
  // Paylocity (PCTY): cloud HCM & payroll SaaS (FYE June)
  { ticker: 'PCTY', name: 'Paylocity',                industry: 'saas',          evEBITDA: 28.0, evRevenue: 7.5, revenueGrowthPct: 14, ebitdaMarginPct: 27, marketCapB: 8.8, secFiling: '10-K FY2025' },
  // Veeva Systems (VEEV): life sciences cloud SaaS (FYE Jan)
  { ticker: 'VEEV', name: 'Veeva Systems',            industry: 'saas',          evEBITDA: 38.5, evRevenue:10.0, revenueGrowthPct: 14, ebitdaMarginPct: 28, marketCapB:40.0, secFiling: '10-K FY2025' },
  // Bentley Systems (BSY): infrastructure engineering SaaS
  { ticker: 'BSY',  name: 'Bentley Systems',          industry: 'saas',          evEBITDA: 33.0, evRevenue: 7.8, revenueGrowthPct: 13, ebitdaMarginPct: 24, marketCapB:13.0, secFiling: '10-K FY2024' },
  // Braze (BRZE): customer engagement platform (FYE Jan) — unprofitable SaaS contrast
  { ticker: 'BRZE', name: 'Braze (unprofitable)',     industry: 'saas',          evEBITDA: 99.0, evRevenue: 9.0, revenueGrowthPct: 25, ebitdaMarginPct:  2, marketCapB: 5.2, secFiling: '10-K FY2025' },

  // ── Manufacturing ──────────────────────────────────────────────────────────
  // Watts Water Technologies (WTS): flow control & water quality products
  { ticker: 'WTS',  name: 'Watts Water Technologies', industry: 'manufacturing', evEBITDA: 16.0, evRevenue: 2.1, revenueGrowthPct:  5, ebitdaMarginPct: 14, marketCapB: 3.8, secFiling: '10-K FY2024' },
  // Haynes International (HAYN): high-performance alloys (aerospace demand)
  { ticker: 'HAYN', name: 'Haynes International',     industry: 'manufacturing', evEBITDA: 11.5, evRevenue: 1.0, revenueGrowthPct:  8, ebitdaMarginPct: 10, marketCapB: 0.7, secFiling: '10-K FY2024' },
  // NN Inc. (NNBR): precision components manufacturer
  { ticker: 'NNBR', name: 'NN Inc.',                  industry: 'manufacturing', evEBITDA:  8.2, evRevenue: 0.6, revenueGrowthPct:  0, ebitdaMarginPct:  7, marketCapB: 0.2, secFiling: '10-K FY2024' },
  // Tennant Company (TNC): industrial cleaning equipment
  { ticker: 'TNC',  name: 'Tennant Company',          industry: 'manufacturing', evEBITDA: 12.5, evRevenue: 1.2, revenueGrowthPct:  5, ebitdaMarginPct: 10, marketCapB: 1.3, secFiling: '10-K FY2024' },

  // ── Distribution ───────────────────────────────────────────────────────────
  // WESCO International (WCC): electrical & industrial distribution
  { ticker: 'WCC',  name: 'WESCO International',      industry: 'distribution',  evEBITDA: 10.5, evRevenue: 0.5, revenueGrowthPct:  3, ebitdaMarginPct:  5, marketCapB: 5.8, secFiling: '10-K FY2024' },
  // Applied Industrial Technologies (AIT): industrial distribution & services (FYE June)
  { ticker: 'AIT',  name: 'Applied Industrial',       industry: 'distribution',  evEBITDA: 13.5, evRevenue: 1.3, revenueGrowthPct:  5, ebitdaMarginPct: 10, marketCapB: 4.8, secFiling: '10-K FY2024' },
  // DXP Enterprises (DXPE): industrial distribution & service centers
  { ticker: 'DXPE', name: 'DXP Enterprises',          industry: 'distribution',  evEBITDA: 10.2, evRevenue: 0.8, revenueGrowthPct:  8, ebitdaMarginPct:  8, marketCapB: 0.8, secFiling: '10-K FY2024' },

  // ── Healthcare Services ────────────────────────────────────────────────────
  // Acadia Healthcare (ACHC): behavioral health services
  { ticker: 'ACHC', name: 'Acadia Healthcare',        industry: 'healthcare',    evEBITDA: 11.5, evRevenue: 1.8, revenueGrowthPct:  8, ebitdaMarginPct: 16, marketCapB: 3.2, secFiling: '10-K FY2024' },
  // Addus HomeCare (ADUS): home & community-based care
  { ticker: 'ADUS', name: 'Addus HomeCare',           industry: 'healthcare',    evEBITDA: 15.0, evRevenue: 1.8, revenueGrowthPct: 12, ebitdaMarginPct: 12, marketCapB: 1.8, secFiling: '10-K FY2024' },
  // National HealthCare Corp (NHC): long-term care & senior living
  { ticker: 'NHC',  name: 'National HealthCare Corp', industry: 'healthcare',    evEBITDA: 12.0, evRevenue: 1.0, revenueGrowthPct:  7, ebitdaMarginPct:  8, marketCapB: 1.2, secFiling: '10-K FY2024' },

  // ── Construction / Trades ──────────────────────────────────────────────────
  // EMCOR Group (EME): electrical & mechanical — major beneficiary of data center buildout
  { ticker: 'EME',  name: 'EMCOR Group',              industry: 'construction',  evEBITDA: 21.5, evRevenue: 1.1, revenueGrowthPct: 16, ebitdaMarginPct:  7, marketCapB:20.0, secFiling: '10-K FY2024' },
  // Comfort Systems USA (FIX): HVAC & mechanical — data center cooling demand surge
  { ticker: 'FIX',  name: 'Comfort Systems USA',      industry: 'construction',  evEBITDA: 23.5, evRevenue: 1.5, revenueGrowthPct: 16, ebitdaMarginPct:  8, marketCapB:14.0, secFiling: '10-K FY2024' },
  // MYR Group (MYRG): electrical construction services
  { ticker: 'MYRG', name: 'MYR Group',                industry: 'construction',  evEBITDA: 13.5, evRevenue: 0.7, revenueGrowthPct: 11, ebitdaMarginPct:  5, marketCapB: 2.8, secFiling: '10-K FY2024' },
];

// ── Precedent Transactions Panel ──────────────────────────────────────────────
function PrecedentTransPanel({
  industryId, ebitda, revenue, onAskAI,
}: { industryId: string; ebitda: number; revenue?: number; onAskAI?: (msg: string) => void }) {
  const d = PRECEDENT_BY_INDUSTRY[industryId] ?? PRECEDENT_BY_INDUSTRY['other'];
  const implied = ebitda > 0 ? ebitda * d.medianEVEBITDA : 0;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800/40 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Precedent Transactions</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{d.dealSizeRange} · {d.dealCountNote} · {d.periodCovered}</div>
        </div>
        {onAskAI && ebitda > 0 && (
          <button onClick={() => onAskAI(`Precedent transactions in my industry show a median EV/EBITDA of ${d.medianEVEBITDA}× (IQR: ${d.p25EVEBITDA}–${d.p75EVEBITDA}×). At my EBITDA of ${fmt(ebitda)}, the median implies ${fmt(implied)}. Source: ${d.primarySource}. What factors would push my deal toward the 75th percentile (${d.p75EVEBITDA}×) vs. the 25th percentile (${d.p25EVEBITDA}×)?`)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 flex-shrink-0">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
            Ask AI
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 divide-x divide-slate-800/40 border-b border-slate-800/40">
        {[
          { label: '25th Pct.',   value: `${d.p25EVEBITDA.toFixed(1)}×`, color: 'text-slate-400' },
          { label: 'Median',      value: `${d.medianEVEBITDA.toFixed(1)}×`, color: 'text-amber-300' },
          { label: '75th Pct.',   value: `${d.p75EVEBITDA.toFixed(1)}×`, color: 'text-slate-300' },
          { label: 'Implied EV',  value: ebitda > 0 ? fmt(implied) : '—', color: 'text-amber-300' },
        ].map(s => (
          <div key={s.label} className="px-4 py-3 text-center">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{s.label}</div>
            <div className={`text-[15px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Visual IQR range */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-[10px] text-slate-600 w-12 text-right tabular-nums">{d.p25EVEBITDA.toFixed(1)}×</div>
          <div className="flex-1 relative h-5 flex items-center">
            <div className="absolute w-full h-1.5 bg-slate-800 rounded-full"/>
            {(() => {
              const range = d.p75EVEBITDA - d.p25EVEBITDA;
              const iqrLeft = 0;
              const iqrW = ((d.p75EVEBITDA - d.p25EVEBITDA) / (d.p75EVEBITDA + 2 - d.p25EVEBITDA + 2)) * 100;
              const medPos = ((d.medianEVEBITDA - d.p25EVEBITDA) / range) * 100;
              return (
                <>
                  <div className="absolute h-1.5 rounded-full bg-amber-500/25 border border-amber-500/30" style={{ left: '10%', width: '80%' }}/>
                  <div className="absolute h-4 w-0.5 bg-amber-400 rounded-full" style={{ left: `calc(10% + ${medPos * 0.8}%)` }}/>
                </>
              );
            })()}
          </div>
          <div className="text-[10px] text-slate-600 w-12 tabular-nums">{d.p75EVEBITDA.toFixed(1)}×</div>
        </div>
        <div className="text-center text-[10px] text-slate-600">IQR (25th–75th percentile) · median marked</div>

        {/* Notes */}
        <div className="mt-3 text-[11px] text-slate-500 leading-relaxed bg-slate-900/40 rounded-lg px-3 py-2.5 border border-slate-800/30">
          {d.notes}
        </div>
      </div>

      {/* Sources */}
      <div className="px-5 pb-3 space-y-1">
        <div className="text-[9px] text-slate-600 font-semibold uppercase tracking-[0.08em]">Sources</div>
        <div className="text-[10px] text-slate-600">① {d.primarySource}</div>
        <div className="text-[10px] text-slate-600">② {d.secondarySource}</div>
        <div className="text-[9px] text-slate-700 mt-1.5 leading-relaxed">
          <span className="text-amber-700/70 font-semibold">Why not SEC filings?</span> Precedent transactions are private M&A deals — neither buyer nor seller is required to file deal terms with the SEC. Data is sourced from proprietary databases (GF Data, IBBA, PitchBook) where advisors voluntarily report closed transactions. Coverage is incomplete but represents the best available LMM benchmarks. Full underlying data requires paid subscriptions.
        </div>
      </div>
    </div>
  );
}

// ── Public Comps Panel ─────────────────────────────────────────────────────────
function PublicCompsPanel({
  industryId, ebitda, revenue, onAskAI, liveComps, compsAsOf, compsLoading,
}: {
  industryId: string; ebitda: number; revenue?: number; onAskAI?: (msg: string) => void;
  liveComps?: LiveComp[] | null; compsAsOf?: string | null; compsLoading?: boolean;
}) {
  const allComps = liveComps ?? PUBLIC_COMPS;
  const comps    = allComps.filter(c => c.industry === industryId);
  const isLive   = !!liveComps;

  // Format "as of" date
  const asOfDisplay = compsAsOf
    ? new Date(compsAsOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : COMPS_AS_OF;

  if (!compsLoading && comps.length === 0) return null;

  const med = <T,>(arr: T[], key: (v: T) => number): number => {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => key(a) - key(b));
    return key(s[Math.floor(s.length / 2)]);
  };

  const medMultiple = med(comps, c => c.evEBITDA);
  const medRevMult  = med(comps, c => c.evRevenue);
  const medGrowth   = med(comps, c => c.revenueGrowthPct);
  const medMargin   = med(comps, c => c.ebitdaMarginPct);

  const DISCOUNT = 0.30;
  const discountedMed = medMultiple * (1 - DISCOUNT);
  const implied = ebitda > 0 ? ebitda * discountedMed : 0;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800/40 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[13px] font-semibold text-slate-100">Public Company Comparables</div>
            {compsLoading ? (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-500 uppercase tracking-[0.08em] animate-pulse">
                loading live data…
              </span>
            ) : (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-[0.08em] ${
                isLive
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-violet-500/30 bg-violet-500/10 text-violet-400'
              }`}>
                {isLive ? `live · as of ${asOfDisplay}` : `snapshot · ${asOfDisplay}`}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {compsLoading ? 'Fetching from SEC EDGAR + market data…' : `${comps.length} companies · ${isLive ? 'SEC EDGAR XBRL + Yahoo Finance (live)' : 'SEC 10-K/20-F FY2024 · NTM multiples per S&P CapIQ/Bloomberg'} · 30% private co. discount applied`}
          </div>
        </div>
        {onAskAI && ebitda > 0 && (
          <button onClick={() => onAskAI(`Public comps in my industry (${comps.map(c => c.ticker).join(', ')}) trade at a median ${medMultiple.toFixed(1)}× NTM EV/EBITDA per S&P Capital IQ / Bloomberg consensus (Q1 2025). After a 30% private company discount for size and illiquidity, the implied multiple is ${discountedMed.toFixed(1)}× — implying ${fmt(implied)} for my EBITDA of ${fmt(ebitda)}. Is 30% an appropriate discount, and how should I think about size and liquidity adjustments for my specific business?`)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 flex-shrink-0">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
            Ask AI
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {compsLoading && (
        <div className="px-5 py-8 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-violet-500/40 border-t-violet-400 rounded-full animate-spin"/>
          <div className="text-[11px] text-slate-500">Fetching live data from SEC EDGAR &amp; market feeds…</div>
        </div>
      )}

      {!compsLoading && comps.length === 0 && (
        <div className="px-5 py-6 text-center text-[12px] text-slate-500">
          No comparable companies loaded for this industry. Using static fallback — check back shortly.
        </div>
      )}

      {!compsLoading && comps.length > 0 && (
      <>
      <div className="grid grid-cols-4 divide-x divide-slate-800/40 border-b border-slate-800/40">
        {[
          { label: 'Public Median', value: `${medMultiple.toFixed(1)}×`,    color: 'text-slate-300' },
          { label: '−30% Discount', value: `${discountedMed.toFixed(1)}×`,  color: 'text-violet-300' },
          { label: 'Implied EV',    value: ebitda > 0 ? fmt(implied) : '—', color: 'text-violet-300' },
          { label: 'Comps Count',   value: `${comps.length} cos.`,          color: 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="px-4 py-3 text-center">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{s.label}</div>
            <div className={`text-[15px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px]">
          <thead>
            <tr className="border-b border-slate-800/30 bg-slate-900/30">
              {['Ticker', 'Company', 'Mkt Cap', 'EV/EBITDA', 'EV/Revenue', 'Rev Growth', 'EBITDA Mgn', 'Filing'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/20">
            {comps.map((c, i) => (
              <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-3 py-2 text-[11px] font-bold text-violet-400 font-mono">{c.ticker}</td>
                <td className="px-3 py-2 text-[11px] text-slate-300 max-w-[160px] truncate">{c.name}</td>
                <td className="px-3 py-2 text-[11px] text-slate-500 tabular-nums">${c.marketCapB.toFixed(1)}B</td>
                <td className="px-3 py-2 text-[12px] font-semibold text-violet-300 tabular-nums">{c.evEBITDA >= 90 ? 'N/M' : `${c.evEBITDA.toFixed(1)}×`}</td>
                <td className="px-3 py-2 text-[11px] text-slate-400 tabular-nums">{c.evRevenue.toFixed(1)}×</td>
                <td className={`px-3 py-2 text-[11px] tabular-nums ${c.revenueGrowthPct >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>{c.revenueGrowthPct >= 0 ? '+' : ''}{c.revenueGrowthPct}%</td>
                <td className="px-3 py-2 text-[11px] text-slate-400 tabular-nums">{c.ebitdaMarginPct}%</td>
                <td className="px-3 py-2 text-[9px] text-slate-600 font-mono">{c.secFiling}</td>
              </tr>
            ))}
            <tr className="bg-violet-500/5 border-t border-violet-500/15">
              <td className="px-3 py-2 text-[11px] font-bold text-slate-400" colSpan={3}>Median</td>
              <td className="px-3 py-2 text-[12px] font-bold text-violet-300 tabular-nums">{medMultiple.toFixed(1)}×</td>
              <td className="px-3 py-2 text-[11px] font-semibold text-slate-300 tabular-nums">{medRevMult.toFixed(1)}×</td>
              <td className="px-3 py-2 text-[11px] font-semibold text-emerald-400/80 tabular-nums">{medGrowth >= 0 ? '+' : ''}{medGrowth}%</td>
              <td className="px-3 py-2 text-[11px] font-semibold text-slate-300 tabular-nums">{medMargin}%</td>
              <td/>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2.5 space-y-1 border-t border-slate-800/30">
        <div className="text-[9px] text-slate-600 font-semibold uppercase tracking-[0.08em]">Sources &amp; Methodology</div>
        {isLive ? (
          <>
            <div className="text-[10px] text-slate-600">① <span className="text-slate-500 font-medium">Financials:</span> SEC EDGAR XBRL Company Facts API — data.sec.gov/api/xbrl/companyfacts/</div>
            <div className="text-[10px] text-slate-600">② <span className="text-slate-500 font-medium">Market data:</span> Yahoo Finance real-time price / market cap — refreshed {asOfDisplay}</div>
            <div className="text-[10px] text-emerald-700/80 mt-1 leading-relaxed">
              ✓ Live data: EV computed from current market cap + EDGAR debt/cash. EBITDA = Operating Income + D&A from most recent annual 10-K/20-F. Refreshes every 24h.
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] text-slate-600">① <span className="text-slate-500 font-medium">Financials:</span> SEC EDGAR 10-K / 20-F annual filings — sec.gov/cgi-bin/browse-edgar</div>
            <div className="text-[10px] text-slate-600">② <span className="text-slate-500 font-medium">Multiples:</span> S&P Capital IQ / Bloomberg NTM consensus, approx. {COMPS_AS_OF}</div>
          </>
        )}
        <div className="text-[10px] text-amber-700/80 mt-1 leading-relaxed">
          ⚠ Public comps trade at a structural premium vs. LMM private businesses (size, liquidity, analyst coverage). A 25–40% discount is typical for sub-$50M EBITDA businesses. Verify before any transaction.
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// ── DCF Panel ─────────────────────────────────────────────────────────────────
function DCFPanel({
  ebitda, revenue, onAskAI,
}: { ebitda: number; revenue: number; onAskAI?: (msg: string) => void }) {
  const [revenueGrowth, setRevenueGrowth] = useState(15);    // % YoY
  const [marginExpansion, setMarginExpansion] = useState(0.5); // pp per year
  const [capexPct, setCapexPct] = useState(3);               // % of revenue
  const [taxRate, setTaxRate] = useState(25);                 // %
  const [wacc, setWacc] = useState(18);                       // % — LMM discount rate
  const [terminalGrowth, setTerminalGrowth] = useState(3);   // %

  // Live 10-yr Treasury rate from FRED
  const [rfRate, setRfRate] = useState<number | null>(null);
  const [rateDate, setRateDate] = useState<string | undefined>(undefined);
  useEffect(() => {
    fetch('/api/data/macro-rates')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.tenYrYield != null) {
          setRfRate(d.tenYrYield);
          setRateDate(d.rateDate);
        }
      })
      .catch(() => {});
  }, []);

  // WACC build-up components (LMM convention)
  const erp        = 5.5;  // Equity Risk Premium — Damodaran Jan 2025 US implied ERP
  const sizePrem   = 4.0;  // Size/illiquidity premium for LMM private companies
  const waccFloor  = rfRate != null ? parseFloat((rfRate + erp + sizePrem).toFixed(1)) : null;
  const waccCeiling = waccFloor != null ? parseFloat((waccFloor + 5).toFixed(1)) : null;

  const baseRev     = revenue;
  const baseEBITDA  = ebitda;
  const baseMargin  = baseRev > 0 ? (baseEBITDA / baseRev) * 100 : 0;

  // Build 5-year projection
  const years = [1, 2, 3, 4, 5];
  const projections = years.map(yr => {
    const rev       = baseRev * Math.pow(1 + revenueGrowth / 100, yr);
    const margin    = Math.min(baseMargin + marginExpansion * yr, 45); // cap at 45%
    const ebitdaP   = rev * (margin / 100);
    const capex     = rev * (capexPct / 100);
    const nopat     = ebitdaP * (1 - taxRate / 100); // simplified: EBITDA × (1-t), ignores D&A
    const fcf       = nopat - capex;
    const pv        = fcf / Math.pow(1 + wacc / 100, yr);
    return { yr, rev, ebitdaP, margin, capex, nopat, fcf, pv };
  });

  const sumPV = projections.reduce((s, p) => s + p.pv, 0);

  // Terminal value (Gordon Growth on Year 5 FCF)
  const fcf5 = projections[4].fcf;
  const tv   = wacc > terminalGrowth ? fcf5 * (1 + terminalGrowth / 100) / ((wacc - terminalGrowth) / 100) : 0;
  const pvTV = tv / Math.pow(1 + wacc / 100, 5);
  const ev   = sumPV + pvTV;
  const impliedMultiple = ebitda > 0 ? ev / ebitda : 0;

  const sliders = [
    { label: 'Revenue Growth (YoY)', value: revenueGrowth, set: setRevenueGrowth, min: 0,   max: 50,  step: 1,   fmt: (v: number) => `${v}%` },
    { label: 'Margin Expansion (pp/yr)', value: marginExpansion, set: setMarginExpansion, min: -2, max: 5, step: 0.5, fmt: (v: number) => `${v >= 0 ? '+' : ''}${v}pp` },
    { label: 'CapEx (% Revenue)',     value: capexPct,      set: setCapexPct,      min: 0,   max: 15,  step: 0.5, fmt: (v: number) => `${v}%` },
    { label: 'Tax Rate',              value: taxRate,       set: setTaxRate,       min: 0,   max: 40,  step: 1,   fmt: (v: number) => `${v}%` },
    { label: 'Discount Rate (WACC)',  value: wacc,          set: setWacc,          min: 10,  max: 35,  step: 0.5, fmt: (v: number) => `${v}%` },
    { label: 'Terminal Growth Rate',  value: terminalGrowth,set: setTerminalGrowth,min: 1,   max: 6,   step: 0.5, fmt: (v: number) => `${v}%` },
  ];

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800/40 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Discounted Cash Flow</div>
          <div className="text-[11px] text-slate-500 mt-0.5">5-year FCF projection · Gordon Growth terminal value</div>
        </div>
        {onAskAI && ebitda > 0 && (
          <button onClick={() => onAskAI(`My DCF analysis: base EBITDA ${fmt(ebitda)}, ${revenueGrowth}% annual revenue growth, ${marginExpansion}pp/yr margin expansion, ${wacc}% WACC, ${terminalGrowth}% terminal growth. The model produces an enterprise value of ${fmt(ev)} (${impliedMultiple.toFixed(1)}× current EBITDA). Sum of PV of FCFs is ${fmt(sumPV)}, PV of terminal value is ${fmt(pvTV)} (${((pvTV/ev)*100).toFixed(0)}% of total). Are these assumptions reasonable for a lower middle market professional services business?`)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 flex-shrink-0">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
            Ask AI
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Assumption sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {sliders.map(s => (
            <div key={s.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-400">{s.label}</label>
                <span className="text-[12px] font-bold text-teal-300 tabular-nums">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-teal-400"/>
            </div>
          ))}
        </div>

        {/* Live WACC build-up callout */}
        {rfRate != null && waccFloor != null && waccCeiling != null && (
          <div className="bg-slate-900/60 border border-teal-500/20 rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">WACC Build-Up (LMM)</span>
              <span className="text-[10px] text-emerald-400 font-medium">
                live · FRED {rateDate ? rateDate : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {[
                { label: '10-Yr Treasury (Rf)', value: `${rfRate.toFixed(2)}%`, note: 'FRED DGS10' },
                { label: 'Equity Risk Premium', value: `${erp}%`,              note: 'Damodaran 2025' },
                { label: 'Size / Illiquidity',   value: `${sizePrem}%`,         note: 'LMM private co.' },
                { label: 'Suggested WACC Range', value: `${waccFloor}–${waccCeiling}%`, note: '+0–5% co.-specific', highlight: true },
              ].map(item => (
                <div key={item.label} className={`rounded-lg px-2 py-2 ${item.highlight ? 'bg-teal-500/10 border border-teal-500/25' : 'bg-slate-800/40'}`}>
                  <div className={`text-[12px] font-bold tabular-nums ${item.highlight ? 'text-teal-300' : 'text-slate-200'}`}>{item.value}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">{item.label}</div>
                  <div className="text-[8px] text-slate-600 leading-tight">{item.note}</div>
                </div>
              ))}
            </div>
            {wacc < waccFloor && (
              <div className="text-[10px] text-amber-400/80 flex items-center gap-1">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M7 1L1 12h12L7 1zm0 3l3.5 7h-7L7 4z"/></svg>
                Current WACC ({wacc}%) is below the LMM floor ({waccFloor}%) — consider adjusting upward.
              </div>
            )}
          </div>
        )}

        {/* 5-year projection table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/40">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800/40">
                {['', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'].map(h => (
                  <th key={h} className="px-4 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/20">
              {[
                { label: 'Revenue',       vals: projections.map(p => fmt(p.rev)),    color: 'text-slate-200' },
                { label: 'EBITDA',        vals: projections.map(p => fmt(p.ebitdaP)),color: 'text-slate-300' },
                { label: 'EBITDA Margin', vals: projections.map(p => `${p.margin.toFixed(1)}%`), color: 'text-slate-400' },
                { label: 'CapEx',         vals: projections.map(p => `(${fmt(p.capex)})`), color: 'text-slate-500' },
                { label: 'Free Cash Flow',vals: projections.map(p => fmt(p.fcf)),    color: 'text-teal-400' },
                { label: 'PV of FCF',     vals: projections.map(p => fmt(p.pv)),     color: 'text-teal-400/70' },
              ].map(row => (
                <tr key={row.label} className="hover:bg-slate-800/10">
                  <td className="px-4 py-2 text-[11px] font-medium text-slate-500">{row.label}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} className={`px-4 py-2 text-[11px] tabular-nums text-right ${row.color}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* EV bridge */}
        <div className="bg-slate-900/40 border border-teal-500/15 rounded-xl divide-y divide-slate-800/40">
          {[
            { label: 'Sum of PV (FCFs, Yrs 1–5)', value: fmt(sumPV),   color: 'text-teal-400' },
            { label: `PV of Terminal Value (${((pvTV/Math.max(ev,1))*100).toFixed(0)}% of EV)`, value: fmt(pvTV), color: 'text-teal-400' },
            { label: 'Enterprise Value (DCF)',     value: fmt(ev),      color: 'text-teal-300', bold: true },
            { label: 'Implied EV/EBITDA Multiple', value: `${impliedMultiple.toFixed(1)}×`, color: 'text-slate-300', bold: false },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-5 py-2.5">
              <div className={`text-[12px] ${row.bold ? 'font-bold text-slate-200' : 'font-medium text-slate-500'}`}>{row.label}</div>
              <div className={`text-[13px] ${row.bold ? 'font-bold' : 'font-semibold'} tabular-nums ${row.color}`}>{row.value}</div>
            </div>
          ))}
        </div>

        <div className="text-[9px] text-slate-700 leading-relaxed">
          Simplified DCF. FCF = EBITDA × (1−tax) − CapEx. Excludes D&amp;A tax shield, working capital changes, and debt. WACC of {wacc}% reflects typical LMM private equity return expectations. Terminal value uses Gordon Growth Model.
          {rfRate != null && ` Risk-free rate ${rfRate.toFixed(2)}% (FRED DGS10${rateDate ? ` as of ${rateDate}` : ''}); ERP 5.5% (Damodaran Jan 2025); size/illiquidity premium 4.0%.`}
        </div>
      </div>
    </div>
  );
}

// ── 3-Method Valuation Summary ────────────────────────────────────────────────
function ValuationSummary({
  ebitda, adjLow, adjMid, adjHigh,
  industryId,
}: { ebitda: number; adjLow: number; adjMid: number; adjHigh: number; industryId: string }) {
  const precedentData = PRECEDENT_BY_INDUSTRY[industryId] ?? PRECEDENT_BY_INDUSTRY['other'];
  const comps  = PUBLIC_COMPS.filter(c => c.industry === industryId);
  const DISC   = 0.30;

  const precedentMed = precedentData.medianEVEBITDA;
  const compsMed = comps.length > 0
    ? [...comps].sort((a, b) => a.evEBITDA - b.evEBITDA)[Math.floor(comps.length / 2)].evEBITDA * (1 - DISC)
    : null;

  const methods = [
    { label: 'EBITDA Multiples',          low: ebitda * adjLow,  mid: ebitda * adjMid,           high: ebitda * adjHigh,           color: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' },
    { label: 'Precedent Transactions', low: ebitda * precedentData.p25EVEBITDA, mid: ebitda * precedentData.medianEVEBITDA, high: ebitda * precedentData.p75EVEBITDA, color: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
    compsMed     ? { label: 'Public Comps (discounted)',low: ebitda * (compsMed - 0.5),   mid: ebitda * compsMed,         high: ebitda * (compsMed + 0.5),     color: 'bg-violet-500/10 border-violet-500/20 text-violet-300' } : null,
  ].filter(Boolean) as { label: string; low: number; mid: number; high: number; color: string }[];

  if (methods.length === 0 || ebitda <= 0) return null;

  const allMids = methods.map(m => m.mid);
  const blendedLow = Math.min(...methods.map(m => m.low));
  const blendedHigh = Math.max(...methods.map(m => m.high));
  const blendedMid  = allMids.reduce((s, v) => s + v, 0) / allMids.length;

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-slate-700/40 rounded-xl p-5">
      <div className="text-[12px] font-bold text-slate-300 mb-4 uppercase tracking-[0.08em]">3-Method Valuation Summary</div>
      <div className="space-y-3 mb-4">
        {methods.map(m => {
          const rangeW = m.high - m.low;
          const midOffset = rangeW > 0 ? ((m.mid - m.low) / rangeW) * 100 : 50;
          return (
            <div key={m.label} className="flex items-center gap-3">
              <div className="text-[11px] text-slate-400 w-48 flex-shrink-0">{m.label}</div>
              <div className="flex-1 flex items-center gap-2">
                <div className="text-[10px] text-slate-600 w-16 text-right tabular-nums">{fmt(m.low)}</div>
                <div className="flex-1 relative h-4 flex items-center">
                  <div className={`absolute h-1.5 rounded-full opacity-30 w-full border ${m.color}`}/>
                  <div className="absolute h-3.5 w-0.5 bg-slate-300 rounded-full" style={{ left: `${midOffset}%` }}/>
                </div>
                <div className="text-[10px] text-slate-600 w-16 tabular-nums">{fmt(m.high)}</div>
              </div>
              <div className={`text-[12px] font-bold tabular-nums w-20 text-right flex-shrink-0 ${m.color.split(' ').find(c => c.startsWith('text-'))}`}>
                {fmt(m.mid)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-700/40 pt-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400 font-semibold">Blended Range</div>
          <div className="text-[10px] text-slate-600 mt-0.5">Equal-weight average of {methods.length} methods</div>
        </div>
        <div className="text-right">
          <div className="text-[20px] font-bold text-slate-100 tabular-nums">{fmt(blendedMid)}</div>
          <div className="text-[11px] text-slate-500">{fmt(blendedLow)} — {fmt(blendedHigh)} range</div>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ValuationEstimator({ data, previousData, onAskAI }: Props) {
  const [industry, setIndustry] = useState<IndustryId>(() => detectIndustry(data));
  const [showFactors, setShowFactors] = useState(true);

  // Live public-comp data from SEC EDGAR + Yahoo Finance
  const [liveComps,    setLiveComps]    = useState<LiveComp[] | null>(null);
  const [compsAsOf,    setCompsAsOf]    = useState<string | null>(null);
  const [compsLoading, setCompsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data/public-comps')
      .then(r => r.ok ? r.json() : null)
      .then((d: { comps: LiveComp[]; asOf: string } | null) => {
        if (d && d.comps?.length > 0) {
          setLiveComps(d.comps);
          setCompsAsOf(d.asOf);
        }
      })
      .catch(() => {})
      .finally(() => setCompsLoading(false));
  }, []);

  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const ebitda = rev - cogs - opex;

  const ind        = INDUSTRIES.find(i => i.id === industry) ?? INDUSTRIES[0];
  const factors    = computeQualityFactors(data, previousData);
  const totalDelta = factors.reduce((s, f) => s + f.delta, 0);
  const roadmap    = useMemo(() => buildRoadmap(data, previousData), [data, previousData]);

  // Apply quality delta to the midpoint, clamped sensibly
  const baseMid = (ind.low + ind.high) / 2;
  const adjMid  = Math.max(1.5, baseMid + totalDelta);
  const adjLow  = Math.max(1.0, ind.low  + totalDelta * 0.6);
  const adjHigh = Math.max(2.0, ind.high + totalDelta * 0.8);

  const evLow  = ebitda > 0 ? ebitda * adjLow  : 0;
  const evMid  = ebitda > 0 ? ebitda * adjMid  : 0;
  const evHigh = ebitda > 0 ? ebitda * adjHigh : 0;

  const positiveFactors  = factors.filter(f => f.status === 'positive');
  const negativeFactors  = factors.filter(f => f.status === 'negative');
  const neutralFactors   = factors.filter(f => f.status === 'neutral');

  const deltaColor = totalDelta > 0 ? 'text-emerald-400' : totalDelta < 0 ? 'text-red-400' : 'text-slate-400';

  const statusIcon = (s: QualityFactor['status']) =>
    s === 'positive' ? <span className="text-emerald-400">▲</span> :
    s === 'negative' ? <span className="text-red-400">▼</span> :
    <span className="text-slate-600">—</span>;

  const statusStyle = (s: QualityFactor['status']) =>
    s === 'positive' ? 'border-emerald-500/15 bg-emerald-500/4' :
    s === 'negative' ? 'border-red-500/15 bg-red-500/4' :
    'border-slate-800/50 bg-slate-900/30';

  return (
    <div className="space-y-4">
      {/* Industry selector */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-shrink-0 pt-0.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Industry</span>
          {detectIndustry(data) === industry && (
            <div className="text-[9px] text-indigo-400/70 mt-0.5 whitespace-nowrap">auto-detected</div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {INDUSTRIES.map(i => (
            <button key={i.id} onClick={() => setIndustry(i.id)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                industry === i.id
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                  : 'bg-slate-900/50 border-slate-800/50 text-slate-500 hover:text-slate-300 hover:border-slate-700'
              }`}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {ebitda <= 0 ? (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 flex items-start gap-3">
          <span className="text-amber-400 text-lg flex-shrink-0">⚠</span>
          <div>
            <div className="text-[13px] font-semibold text-amber-300 mb-1">Negative EBITDA</div>
            <div className="text-[12px] text-amber-400/70 leading-relaxed">
              EBITDA-based valuation requires positive earnings. At ${data.revenue.total > 0 ? fmt(ebitda) : '$0'} EBITDA,
              the business would be valued on revenue multiples or strategic factors. Reach profitability before seeking an exit.
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* EV Range card */}
          <div className="bg-gradient-to-br from-indigo-500/8 via-transparent to-transparent border border-indigo-500/20 rounded-xl p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-[11px] font-semibold text-indigo-400/70 uppercase tracking-[0.08em] mb-1">Estimated Enterprise Value</div>
                <div className="text-[11px] text-slate-500">Based on {ind.label} · EBITDA: {fmt(ebitda)}</div>
              </div>
              {onAskAI && (
                <button
                  onClick={() => onAskAI(`Evaluate my business valuation: EBITDA of ${fmt(ebitda)}, industry is ${ind.label}, base multiple range ${ind.low}–${ind.high}x, quality adjustments total ${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(1)}x. Implied EV range is ${fmt(evLow)}–${fmt(evHigh)}. What are the 3 most important things I should do to improve valuation before an exit?`)}
                  className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all font-medium flex-shrink-0">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
                  Valuation analysis
                </button>
              )}
            </div>

            {/* EV range visualization */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Low Case',  ev: evLow,  mult: adjLow,  color: 'text-slate-400', bg: 'bg-slate-800/40 border-slate-700/40' },
                { label: 'Mid Case',  ev: evMid,  mult: adjMid,  color: 'text-indigo-300', bg: 'bg-indigo-500/10 border-indigo-500/25' },
                { label: 'High Case', ev: evHigh, mult: adjHigh, color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20' },
              ].map(c => (
                <div key={c.label} className={`${c.bg} border rounded-xl p-4 text-center`}>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{c.label}</div>
                  <div className={`text-[22px] font-bold tracking-tight ${c.color}`}>{fmt(c.ev)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.mult.toFixed(1)}× EBITDA</div>
                </div>
              ))}
            </div>

            {/* Multiple breakdown */}
            <div className="flex flex-wrap items-center gap-2 text-[12px] bg-slate-900/40 rounded-lg px-4 py-2.5 border border-slate-800/40">
              <span className="text-slate-500">Base range:</span>
              <span className="text-slate-200 font-semibold">{ind.low}–{ind.high}×</span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-500">Quality adj:</span>
              <span className={`font-semibold ${deltaColor}`}>{totalDelta >= 0 ? '+' : ''}{totalDelta.toFixed(1)}×</span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-500">Adjusted range:</span>
              <span className="text-slate-100 font-bold">{adjLow.toFixed(1)}–{adjHigh.toFixed(1)}×</span>
            </div>
          </div>

          {/* EV Sensitivity Matrix */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800/40 flex items-center justify-between">
              <div className="text-[12px] font-semibold text-slate-200">EV Sensitivity Matrix</div>
              <div className="text-[10px] text-slate-600">EBITDA scenario × multiple</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px]">
                <thead>
                  <tr className="border-b border-slate-800/40">
                    <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">EBITDA</th>
                    {[`${adjLow.toFixed(1)}× Low`, `${adjMid.toFixed(1)}× Mid`, `${adjHigh.toFixed(1)}× High`].map(h => (
                      <th key={h} className="px-4 py-2 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {[
                    { label: `Base — ${fmt(ebitda)}`,      ebitdaMult: 1.0 },
                    { label: `+10% — ${fmt(ebitda * 1.1)}`, ebitdaMult: 1.1 },
                    { label: `+20% — ${fmt(ebitda * 1.2)}`, ebitdaMult: 1.2 },
                    { label: `+30% — ${fmt(ebitda * 1.3)}`, ebitdaMult: 1.3 },
                  ].map((row, ri) => (
                    <tr key={ri} className={ri === 0 ? 'bg-indigo-500/[0.03]' : ''}>
                      <td className={`px-4 py-2.5 text-[11px] font-medium ${ri === 0 ? 'text-slate-200' : 'text-slate-500'}`}>
                        {row.label}
                      </td>
                      {[adjLow, adjMid, adjHigh].map((mult, ci) => {
                        const ev = ebitda * row.ebitdaMult * mult;
                        return (
                          <td key={ci} className={`px-4 py-2.5 text-right tabular-nums text-[12px] font-semibold ${
                            ri === 0 && ci === 1 ? 'text-indigo-300' : ri === 0 ? 'text-slate-300' : 'text-slate-500'
                          }`}>{fmt(ev)}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quality of Earnings factors */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowFactors(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/20 transition-colors text-left">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-slate-100">Quality of Earnings Factors</span>
                <span className="text-[11px] text-slate-500">
                  {positiveFactors.length} positive · {negativeFactors.length} risk{negativeFactors.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[12px] font-semibold ${deltaColor}`}>
                  Net: {totalDelta >= 0 ? '+' : ''}{totalDelta.toFixed(1)}× to multiple
                </span>
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  className={`w-2.5 h-2.5 text-slate-600 transition-transform ${showFactors ? 'rotate-180' : ''}`}>
                  <path d="M2 3.5L5 6.5 8 3.5"/>
                </svg>
              </div>
            </button>

            {showFactors && (
              <div className="border-t border-slate-800/40 overflow-x-auto">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_100px_90px_80px] gap-3 px-5 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider bg-slate-900/30 min-w-[420px]">
                  <div>Factor</div>
                  <div className="text-center">Current</div>
                  <div className="text-center">Impact</div>
                  <div className="text-right">Multiple Δ</div>
                </div>
                <div className="divide-y divide-slate-800/30">
                  {[...positiveFactors, ...neutralFactors, ...negativeFactors].map(f => (
                    <div key={f.id} className={`grid grid-cols-[1fr_100px_90px_80px] gap-3 px-5 py-3 items-start min-w-[420px] ${f.status === 'negative' ? 'bg-red-500/[0.02]' : f.status === 'positive' ? 'bg-emerald-500/[0.02]' : ''}`}>
                      <div>
                        <div className="text-[12px] font-medium text-slate-200">{f.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{f.description}</div>
                      </div>
                      <div className="text-[12px] font-medium text-slate-300 text-center pt-0.5">{f.display}</div>
                      <div className={`flex items-center justify-center gap-1 pt-0.5 text-[11px] font-semibold ${
                        f.status === 'positive' ? 'text-emerald-400' :
                        f.status === 'negative' ? 'text-red-400' : 'text-slate-600'
                      }`}>
                        {statusIcon(f.status)}
                        {f.status !== 'neutral' && <span className="ml-0.5">
                          {f.status === 'positive' ? 'Positive' : 'Risk'}
                        </span>}
                        {f.status === 'neutral' && <span className="text-slate-600">Neutral</span>}
                      </div>
                      <div className={`text-[12px] font-bold text-right pt-0.5 tabular-nums ${
                        f.delta > 0 ? 'text-emerald-400' : f.delta < 0 ? 'text-red-400' : 'text-slate-700'
                      }`}>
                        {f.delta !== 0 ? (f.delta > 0 ? `+${f.delta.toFixed(1)}×` : `${f.delta.toFixed(1)}×`) : '—'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary row */}
                <div className="border-t border-slate-700/40 bg-slate-800/20 px-5 py-3 grid grid-cols-[1fr_100px_90px_80px] gap-3 items-center min-w-[420px]">
                  <div className="text-[11px] font-semibold text-slate-400">Net Multiple Adjustment</div>
                  <div/>
                  <div/>
                  <div className={`text-[13px] font-bold text-right tabular-nums ${deltaColor}`}>
                    {totalDelta >= 0 ? '+' : ''}{totalDelta.toFixed(1)}×
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Value Creation Roadmap */}
          {roadmap.length > 0 && (
            <ValuationRoadmap items={roadmap} currentAdjMid={adjMid}/>
          )}

          {/* Precedent Transactions */}
          <PrecedentTransPanel industryId={industry} ebitda={ebitda} revenue={rev} onAskAI={onAskAI}/>

          {/* Public Comps */}
          <PublicCompsPanel
            industryId={industry} ebitda={ebitda} revenue={rev} onAskAI={onAskAI}
            liveComps={liveComps} compsAsOf={compsAsOf} compsLoading={compsLoading}
          />

          {/* DCF */}
          <DCFPanel ebitda={ebitda} revenue={rev} onAskAI={onAskAI}/>

          {/* 3-Method Summary */}
          <ValuationSummary ebitda={ebitda} adjLow={adjLow} adjMid={adjMid} adjHigh={adjHigh} industryId={industry}/>

          {/* Disclaimer */}
          <div className="text-[10px] text-slate-700 leading-relaxed px-1">
            Estimates are indicative only. Actual transaction value depends on deal structure, buyer synergies, working capital adjustments,
            debt levels, and market conditions. Consult a qualified M&A advisor for a formal valuation engagement.
          </div>
        </>
      )}
    </div>
  );
}
