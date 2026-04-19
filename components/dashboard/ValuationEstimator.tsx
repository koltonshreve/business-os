/**
 * Valuation Estimator
 * M&A-grade EBITDA-multiple range with quality-of-earnings adjustments.
 * Designed for lower middle market ($2M–$50M revenue).
 */
import { useState, useMemo } from 'react';
import type { UnifiedBusinessData, CustomerIndustry } from '../../types';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` :
  n >= 1_000     ? `$${(n/1_000).toFixed(0)}k` :
  `$${n.toFixed(0)}`;

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

// ── Component ─────────────────────────────────────────────────────────────────
export default function ValuationEstimator({ data, previousData, onAskAI }: Props) {
  const [industry, setIndustry] = useState<IndustryId>(() => detectIndustry(data));
  const [showFactors, setShowFactors] = useState(true);

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
