import { useState } from 'react';
import type { UnifiedBusinessData } from '../../types';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

type Industry =
  | 'professional_services'
  | 'saas'
  | 'manufacturing'
  | 'construction'
  | 'healthcare'
  | 'retail';

interface BenchmarkRange {
  low: number;
  median: number;
  high: number;
  unit: '%' | 'x' | 'days' | '$';
  higherIsBetter: boolean;
  note?: string;
}

interface IndustryBenchmarks {
  label: string;
  grossMargin: BenchmarkRange;
  ebitdaMargin: BenchmarkRange;
  revenueGrowth: BenchmarkRange;
  revenuePerEmployee: BenchmarkRange;
  dso: BenchmarkRange;
  opexRatio: BenchmarkRange;
}

const INDUSTRY_BENCHMARKS: Record<Industry, IndustryBenchmarks> = {
  professional_services: {
    label: 'Professional Services',
    grossMargin:         { low: 45, median: 58, high: 72, unit: '%', higherIsBetter: true },
    ebitdaMargin:        { low: 10, median: 18, high: 28, unit: '%', higherIsBetter: true },
    revenueGrowth:       { low: 5,  median: 12, high: 25, unit: '%', higherIsBetter: true },
    revenuePerEmployee:  { low: 80000, median: 145000, high: 250000, unit: '$', higherIsBetter: true },
    dso:                 { low: 25, median: 40, high: 65, unit: 'days', higherIsBetter: false, note: 'Days Sales Outstanding' },
    opexRatio:           { low: 28, median: 38, high: 52, unit: '%', higherIsBetter: false, note: 'OpEx as % of Revenue' },
  },
  saas: {
    label: 'SaaS / Software',
    grossMargin:         { low: 60, median: 72, high: 85, unit: '%', higherIsBetter: true },
    ebitdaMargin:        { low: -5, median: 12, high: 35, unit: '%', higherIsBetter: true },
    revenueGrowth:       { low: 15, median: 35, high: 80, unit: '%', higherIsBetter: true },
    revenuePerEmployee:  { low: 120000, median: 200000, high: 400000, unit: '$', higherIsBetter: true },
    dso:                 { low: 20, median: 35, high: 55, unit: 'days', higherIsBetter: false },
    opexRatio:           { low: 40, median: 60, high: 85, unit: '%', higherIsBetter: false, note: 'OpEx as % of Revenue' },
  },
  manufacturing: {
    label: 'Manufacturing',
    grossMargin:         { low: 20, median: 32, high: 48, unit: '%', higherIsBetter: true },
    ebitdaMargin:        { low: 5,  median: 11, high: 20, unit: '%', higherIsBetter: true },
    revenueGrowth:       { low: 2,  median: 6,  high: 15, unit: '%', higherIsBetter: true },
    revenuePerEmployee:  { low: 100000, median: 165000, high: 280000, unit: '$', higherIsBetter: true },
    dso:                 { low: 30, median: 48, high: 75, unit: 'days', higherIsBetter: false },
    opexRatio:           { low: 12, median: 20, high: 32, unit: '%', higherIsBetter: false },
  },
  construction: {
    label: 'Construction',
    grossMargin:         { low: 15, median: 22, high: 35, unit: '%', higherIsBetter: true },
    ebitdaMargin:        { low: 3,  median: 7,  high: 14, unit: '%', higherIsBetter: true },
    revenueGrowth:       { low: 3,  median: 8,  high: 20, unit: '%', higherIsBetter: true },
    revenuePerEmployee:  { low: 180000, median: 280000, high: 450000, unit: '$', higherIsBetter: true },
    dso:                 { low: 35, median: 55, high: 90, unit: 'days', higherIsBetter: false },
    opexRatio:           { low: 8,  median: 14, high: 22, unit: '%', higherIsBetter: false },
  },
  healthcare: {
    label: 'Healthcare / Medical',
    grossMargin:         { low: 35, median: 48, high: 65, unit: '%', higherIsBetter: true },
    ebitdaMargin:        { low: 8,  median: 15, high: 26, unit: '%', higherIsBetter: true },
    revenueGrowth:       { low: 4,  median: 10, high: 20, unit: '%', higherIsBetter: true },
    revenuePerEmployee:  { low: 85000, median: 130000, high: 210000, unit: '$', higherIsBetter: true },
    dso:                 { low: 30, median: 50, high: 80, unit: 'days', higherIsBetter: false },
    opexRatio:           { low: 22, median: 32, high: 48, unit: '%', higherIsBetter: false },
  },
  retail: {
    label: 'Retail / E-Commerce',
    grossMargin:         { low: 25, median: 38, high: 55, unit: '%', higherIsBetter: true },
    ebitdaMargin:        { low: 3,  median: 8,  high: 18, unit: '%', higherIsBetter: true },
    revenueGrowth:       { low: 3,  median: 10, high: 28, unit: '%', higherIsBetter: true },
    revenuePerEmployee:  { low: 90000, median: 150000, high: 260000, unit: '$', higherIsBetter: true },
    dso:                 { low: 0,  median: 5,  high: 20, unit: 'days', higherIsBetter: false, note: 'Lower for B2C; higher for B2B retail' },
    opexRatio:           { low: 18, median: 28, high: 45, unit: '%', higherIsBetter: false },
  },
};

const INDUSTRY_OPTIONS: { value: Industry; label: string }[] = [
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'saas',                  label: 'SaaS / Software' },
  { value: 'manufacturing',         label: 'Manufacturing' },
  { value: 'construction',          label: 'Construction' },
  { value: 'healthcare',            label: 'Healthcare / Medical' },
  { value: 'retail',                label: 'Retail / E-Commerce' },
];

function fmtBenchmark(v: number, unit: BenchmarkRange['unit']): string {
  if (unit === '$') {
    return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}k`
      : `$${v.toFixed(0)}`;
  }
  if (unit === '%') return `${v >= 0 ? '' : ''}${v.toFixed(0)}%`;
  if (unit === 'days') return `${v.toFixed(0)}d`;
  return `${v.toFixed(1)}x`;
}

/** Returns percentile position 0–100 within benchmark range */
function getPercentile(value: number, range: BenchmarkRange): number {
  const { low, high } = range;
  if (high === low) return 50;
  const clamped = Math.max(low, Math.min(high, value));
  return ((clamped - low) / (high - low)) * 100;
}

interface MetricRowProps {
  label: string;
  value: number | null;
  range: BenchmarkRange;
  note?: string;
}

function MetricRow({ label, value, range }: MetricRowProps) {
  if (value == null) return null;

  const pct = getPercentile(value, range);
  const isGood = range.higherIsBetter ? pct >= 50 : pct <= 50;
  const isGreat = range.higherIsBetter ? pct >= 75 : pct <= 25;
  const isBad = range.higherIsBetter ? pct <= 25 : pct >= 75;

  const dotColor = isGreat ? 'bg-emerald-400' : isGood ? 'bg-amber-400' : 'bg-red-400';
  const valueColor = isGreat ? 'text-emerald-400' : isGood ? 'text-amber-400' : 'text-red-400';
  const labelColor = isGreat
    ? 'bg-emerald-500/10 text-emerald-400'
    : isGood ? 'bg-amber-500/10 text-amber-400'
    : 'bg-red-500/10 text-red-400';

  const posLabel = isGreat
    ? range.higherIsBetter ? 'Top quartile' : 'Best-in-class'
    : isGood ? 'On par' : 'Below median';

  // Marker position for "your value" on the bar
  const markerPct = Math.max(2, Math.min(98, pct));

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[11px] font-semibold text-slate-300">{label}</div>
          {range.note && <div className="text-[10px] text-slate-600 mt-0.5">{range.note}</div>}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${labelColor}`}>
          {posLabel}
        </span>
      </div>

      {/* Bar */}
      <div className="relative h-2 bg-slate-800 rounded-full overflow-visible mb-3">
        {/* Gradient fill: low → median → high */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 via-amber-500/30 to-emerald-500/30"/>
        {/* Median tick */}
        <div className="absolute top-0 h-full w-px bg-slate-600/80" style={{ left: '50%' }}/>
        {/* Your value marker */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-slate-900 shadow-lg ${dotColor}`}
          style={{ left: `${markerPct}%`, transform: 'translateX(-50%) translateY(-50%)' }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-[9px] text-slate-600 font-mono mb-2">
        <span>{fmtBenchmark(range.low, range.unit)}</span>
        <span className="text-slate-500">median {fmtBenchmark(range.median, range.unit)}</span>
        <span>{fmtBenchmark(range.high, range.unit)}</span>
      </div>

      {/* Your value + gap to median */}
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-[18px] font-bold tabular-nums ${valueColor}`}>
            {fmtBenchmark(value, range.unit)}
          </span>
          <span className="text-[10px] text-slate-600">your value</span>
        </div>
        {(() => {
          const gapRaw  = value - range.median;
          const gapAbs  = Math.abs(gapRaw);
          if (gapAbs < 0.5) return <span className="text-[10px] font-semibold text-slate-500">= median</span>;
          const aboveMedian = range.higherIsBetter ? gapRaw > 0 : gapRaw < 0;
          const sign  = gapRaw > 0 ? '+' : '−';
          const color = aboveMedian ? 'text-emerald-400/80' : 'text-amber-400/80';
          return (
            <span className={`text-[10px] font-semibold tabular-nums ${color}`}>
              {sign}{fmtBenchmark(gapAbs, range.unit)} vs median
            </span>
          );
        })()}
      </div>
    </div>
  );
}

export default function IndustryBenchmarksPanel({ data, previousData, onAskAI }: Props) {
  const [industry, setIndustry] = useState<Industry>('professional_services');
  const benchmarks = INDUSTRY_BENCHMARKS[industry];

  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const gp     = rev - cogs;
  const ebitda = gp - opex;

  const gpMargin     = rev > 0 ? (gp / rev) * 100 : null;
  const ebitdaMargin = rev > 0 ? (ebitda / rev) * 100 : null;
  const opexRatio    = rev > 0 ? (opex / rev) * 100 : null;

  // Revenue growth vs prior
  const prevRev = previousData?.revenue.total;
  const revenueGrowth = prevRev && prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : null;

  // Revenue per employee
  const headcount = data.operations.headcount;
  const revenuePerEmployee = headcount && headcount > 0 ? rev / headcount : null;

  // DSO from AR aging
  const arAging = data.arAging;
  const periodCount = Math.max(data.revenue.byPeriod.length, 1);
  const monthlyRev = rev / periodCount;
  const totalAR = arAging ? arAging.reduce((s, b) => s + b.total, 0) : null;
  const dso = totalAR != null && monthlyRev > 0 ? (totalAR / monthlyRev) * 30 : null;

  const metrics: { key: keyof IndustryBenchmarks; label: string; value: number | null }[] = [
    { key: 'grossMargin',        label: 'Gross Margin',          value: gpMargin },
    { key: 'ebitdaMargin',       label: 'EBITDA Margin',         value: ebitdaMargin },
    { key: 'revenueGrowth',      label: 'Revenue Growth',        value: revenueGrowth },
    { key: 'revenuePerEmployee', label: 'Revenue / Employee',    value: revenuePerEmployee },
    { key: 'dso',                label: 'Days Sales Outstanding', value: dso },
    { key: 'opexRatio',          label: 'OpEx Ratio',            value: opexRatio },
  ];

  const scored = metrics.filter(m => m.value != null);
  const goodCount = scored.filter(m => {
    const pct = getPercentile(m.value!, benchmarks[m.key as keyof Omit<IndustryBenchmarks, 'label'>] as BenchmarkRange);
    const b = benchmarks[m.key as keyof Omit<IndustryBenchmarks, 'label'>] as BenchmarkRange;
    return b.higherIsBetter ? pct >= 50 : pct <= 50;
  }).length;

  const summaryForAI = metrics
    .filter(m => m.value != null)
    .map(m => {
      const b = benchmarks[m.key as keyof Omit<IndustryBenchmarks, 'label'>] as BenchmarkRange;
      const pct = getPercentile(m.value!, b);
      const position = b.higherIsBetter
        ? pct >= 75 ? 'top quartile' : pct >= 50 ? 'above median' : 'below median'
        : pct <= 25 ? 'best-in-class' : pct <= 50 ? 'above median' : 'below median';
      return `${m.label}: ${fmtBenchmark(m.value!, b.unit)} (${position} vs ${benchmarks.label})`;
    })
    .join(', ');

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Industry Benchmarks</div>
          <div className="text-[11px] text-slate-600 mt-0.5">
            See how your metrics compare to industry peers
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onAskAI && (
            <button
              onClick={() => onAskAI(
                `My business benchmarks vs ${benchmarks.label}: ${summaryForAI}. ` +
                `Where am I strongest? Where should I focus to improve relative to peers?`
              )}
              className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1.5 rounded-lg transition-all font-medium"
            >
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
              Ask AI
            </button>
          )}
          <select
            value={industry}
            onChange={e => setIndustry(e.target.value as Industry)}
            className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50"
          >
            {INDUSTRY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Score summary strip */}
      {scored.length > 0 && (
        <div className="bg-slate-800/20 rounded-lg px-4 py-3 mb-5 flex items-center justify-between">
          <div className="text-[12px] text-slate-400">
            <span className="font-semibold text-slate-200">{goodCount}</span> of{' '}
            <span className="font-semibold text-slate-200">{scored.length}</span> metrics at or above industry median
          </div>
          <div className="flex gap-1">
            {['⬛', '⬛', '⬛', '⬛', '⬛', '⬛'].map((_, i) => (
              <div
                key={i}
                className={`w-5 h-1.5 rounded-full ${i < goodCount ? 'bg-emerald-500/70' : 'bg-slate-700/60'}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Metric grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map(m => (
          <MetricRow
            key={m.key}
            label={m.label}
            value={m.value}
            range={benchmarks[m.key as keyof Omit<IndustryBenchmarks, 'label'>] as BenchmarkRange}
          />
        ))}
      </div>

      {/* Priority improvement callout */}
      {(() => {
        const belowMedian = metrics
          .filter(m => m.value != null)
          .map(m => {
            const b = benchmarks[m.key as keyof Omit<IndustryBenchmarks, 'label'>] as BenchmarkRange;
            const pct = getPercentile(m.value!, b);
            const isBelow = b.higherIsBetter ? pct < 50 : pct > 50;
            const gapPct  = b.higherIsBetter
              ? ((b.median - m.value!) / Math.abs(b.median)) * 100
              : ((m.value! - b.median) / Math.abs(b.median)) * 100;
            return { ...m, b, pct, isBelow, gapPct };
          })
          .filter(m => m.isBelow && m.gapPct >= 5)
          .sort((a, b) => b.gapPct - a.gapPct);

        if (belowMedian.length === 0) return null;
        const worst = belowMedian[0];
        return (
          <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 text-sm flex-shrink-0 mt-0.5">⚠</span>
            <div>
              <div className="text-[12px] font-semibold text-amber-300 mb-0.5">
                Priority gap: {worst.label}
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed">
                Your {worst.label.toLowerCase()} is{' '}
                <span className="text-amber-400 font-medium">{fmtBenchmark(worst.value!, worst.b.unit)}</span>{' '}
                vs industry median of{' '}
                <span className="text-slate-300 font-medium">{fmtBenchmark(worst.b.median, worst.b.unit)}</span>{' '}
                — closing this gap to median would be the highest-leverage benchmark improvement.
              </div>
            </div>
          </div>
        );
      })()}

      <div className="mt-4 pt-3 border-t border-slate-800/40 text-[10px] text-slate-700">
        Benchmarks are typical ranges for {benchmarks.label} businesses. Low = bottom quartile, High = top quartile. Sources: industry surveys, Dun & Bradstreet, BizStats.
      </div>
    </div>
  );
}
