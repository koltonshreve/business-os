import { useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
  Bar, BarChart, Cell, Line, ComposedChart,
} from 'recharts';
import type { UnifiedBusinessData, PeriodData } from '../../types';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  revenueGoal?: number;
  annotations?: Record<string, string>;
  onAnnotate?: (period: string, note: string) => void;
  onAskAI?: (msg: string) => void;
}

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
};

// ── Forecast helpers ──────────────────────────────────────────────────────────
function linReg(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0 };
  const sx = y.reduce((_, __, i) => _ + i, 0);
  const sy = y.reduce((s, v) => s + v, 0);
  const sxy = y.reduce((s, v, i) => s + i * v, 0);
  const sxx = y.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  return { slope, intercept: (sy - slope * sx) / n };
}

function nextMonthLabel(last: string, offset: number): string {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = last.match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return `+${offset}`;
  const idx = M.indexOf(m[1]);
  if (idx === -1) return `+${offset}`;
  const total = idx + offset;
  return `${M[((total % 12) + 12) % 12]} ${parseInt(m[2]) + Math.floor(total / 12)}`;
}

function PeriodDrawer({
  period, annotation, onAnnotate, onClose, onAskAI,
}: {
  period: PeriodData;
  annotation?: string;
  onAnnotate?: (period: string, note: string) => void;
  onClose: () => void;
  onAskAI?: (msg: string) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState(annotation ?? '');

  const gp     = period.cogs ? period.revenue - period.cogs : null;
  const gpPct  = gp && period.revenue ? (gp / period.revenue) * 100 : null;
  const ebitda = period.ebitda ?? null;

  const cogsSub   = period.cogs && period.revenue ? `${((period.cogs / period.revenue) * 100).toFixed(1)}% of rev` : undefined;
  const ebitdaSub = ebitda !== null && period.revenue ? `${((ebitda / period.revenue) * 100).toFixed(1)}% margin` : undefined;
  const ebitdaCol = ebitda !== null && ebitda > 0 ? 'text-emerald-400' : 'text-red-400';

  const rows: { label: string; value: string; sub?: string; color?: string }[] = [
    { label: 'Revenue', value: fmt(period.revenue) },
    ...(period.cogs ? [{ label: 'COGS', value: fmt(period.cogs), sub: cogsSub, color: 'text-red-400' }] : []),
    ...(gp !== null ? [{ label: 'Gross Profit', value: fmt(gp), sub: gpPct ? `${gpPct.toFixed(1)}% margin` : undefined, color: 'text-emerald-400' }] : []),
    ...(ebitda !== null ? [{ label: 'EBITDA', value: fmt(ebitda), sub: ebitdaSub, color: ebitdaCol }] : []),
    ...(period.cashCollected ? [{ label: 'Cash Collected', value: fmt(period.cashCollected) }] : []),
  ];

  const saveNote = () => {
    onAnnotate?.(period.period, draft.trim());
    setEditingNote(false);
  };

  return (
    <div className="mt-4 bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
        <div>
          <div className="text-[12px] font-semibold text-slate-100">{period.period}</div>
          <div className="text-[10px] text-slate-500 capitalize">{period.periodType} detail</div>
        </div>
        <div className="flex items-center gap-2">
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Break down ${period.period}: revenue ${fmt(period.revenue)}${period.cogs ? `, COGS ${fmt(period.cogs)}, gross profit ${fmt(period.revenue - period.cogs)}` : ''}. What drove the results and what should I focus on?`)}
              className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all font-medium">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
              Ask AI
            </button>
          )}
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors">×</button>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        {rows.map(row => (
          <div key={row.label} className="bg-slate-800/30 rounded-lg px-3 py-2.5">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">{row.label}</div>
            <div className={`text-[16px] font-bold ${row.color ?? 'text-slate-100'}`}>{row.value}</div>
            {row.sub && <div className={`text-[10px] mt-0.5 ${row.color ?? 'text-slate-500'}`}>{row.sub}</div>}
          </div>
        ))}
      </div>

      {/* Period note */}
      {onAnnotate && (
        <div className="px-4 pb-4">
          <div className="border border-slate-800/60 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/20">
              <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Period Note</span>
              {!editingNote && (
                <button
                  onClick={() => { setDraft(annotation ?? ''); setEditingNote(true); }}
                  className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {annotation ? 'Edit' : '+ Add note'}
                </button>
              )}
            </div>
            {editingNote ? (
              <div className="p-2 space-y-2">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setEditingNote(false); }}
                  placeholder="e.g. Ran summer promo, lost key account, hired 2 engineers…"
                  rows={2}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingNote(false)}
                    className="text-[11px] text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors">
                    Cancel
                  </button>
                  <button onClick={saveNote}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/30 px-3 py-1 rounded-lg transition-colors">
                    Save
                  </button>
                </div>
              </div>
            ) : annotation ? (
              <div className="px-3 py-2.5 text-[12px] text-slate-400 leading-relaxed">{annotation}</div>
            ) : (
              <div className="px-3 py-2.5 text-[11px] text-slate-700 italic">No note — click Add note to record context for this period</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RevenueChart({ data, previousData, revenueGoal, annotations = {}, onAnnotate, onAskAI }: Props) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodData | null>(null);
  const [viewMode, setViewMode]             = useState<'area' | 'bar'>('area');
  const [showPrior, setShowPrior]           = useState(false);
  const [showMA, setShowMA]                 = useState(false);
  const [showForecast, setShowForecast]     = useState(false);

  const periods = data.revenue.byPeriod;
  const prevPeriods = previousData?.revenue.byPeriod ?? [];

  // Build a prior-period lookup by index
  const prevByIndex: Record<number, number> = {};
  prevPeriods.forEach((p, i) => { prevByIndex[i] = Math.round(p.revenue / 1000); });

  const rawChartData = periods.map((p, i) => ({
    period:      p.period.replace('2024-', '').replace('2025-', ''),
    revenue:     Math.round(p.revenue / 1000),
    grossProfit: p.cogs ? Math.round((p.revenue - p.cogs) / 1000) : null,
    margin:      p.cogs ? Math.round(((p.revenue - p.cogs) / p.revenue) * 100) : null,
    prior:       prevByIndex[i] ?? null,
    raw:         p,
  }));

  // 3-period moving average
  const chartData = rawChartData.map((d, i) => {
    const window = rawChartData.slice(Math.max(0, i - 2), i + 1);
    const ma = Math.round(window.reduce((s, w) => s + w.revenue, 0) / window.length);
    return { ...d, ma };
  });

  // Forecast: linear regression on revenue → 3 projected months
  const n = chartData.length;
  const { slope, intercept } = linReg(chartData.map(d => d.revenue));
  const predict = (i: number) => Math.max(0, Math.round(intercept + slope * i));
  const lastLabel = periods[periods.length - 1]?.period ?? '';
  const displayData = showForecast
    ? [
        ...chartData.map((d, i) => ({
          ...d,
          forecast: i === n - 1 ? predict(i) : undefined as number | undefined,
        })),
        ...[1, 2, 3].map(j => ({
          period: nextMonthLabel(lastLabel, j),
          revenue: undefined as number | undefined,
          grossProfit: undefined as number | undefined,
          margin: null as number | null,
          prior: undefined as number | undefined,
          ma: undefined as number | undefined,
          raw: null as typeof chartData[0]['raw'] | null,
          forecast: predict(n - 1 + j),
        })),
      ]
    : chartData.map(d => ({ ...d, forecast: undefined as number | undefined }));

  const avgRevenue = chartData.length
    ? Math.round(chartData.reduce((s, d) => s + d.revenue, 0) / chartData.length)
    : 0;
  const goalLineK  = revenueGoal ? Math.round(revenueGoal / (periods.length || 1) / 1000) : null;

  // Peak / low detection
  const maxRev = Math.max(...chartData.map(d => d.revenue));
  const minRev = Math.min(...chartData.map(d => d.revenue));

  // Period-over-period growth
  const growthData = chartData.map((d, i) => ({
    ...d,
    growth: i > 0 && chartData[i - 1].revenue > 0
      ? ((d.revenue - chartData[i - 1].revenue) / chartData[i - 1].revenue) * 100
      : null,
  }));

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !(payload as unknown[])?.length) return null;
    const p = payload as { value: number; name: string }[];
    const note = annotations[periods.find(per =>
      per.period.replace('2024-', '').replace('2025-', '') === (label as string))?.period ?? ''];
    return (
      <div className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-3 text-xs shadow-xl max-w-[200px]">
        <div className="text-slate-400 mb-2 font-medium">{label as string}</div>
        <div className="text-slate-100 font-semibold">${p[0]?.value}k revenue</div>
        {p[1]?.value && <div className="text-emerald-400 mt-0.5">${p[1].value}k gross profit</div>}
        {note && <div className="text-amber-400/80 mt-2 text-[10px] leading-relaxed border-t border-slate-800 pt-1.5">📌 {note}</div>}
        <div className="text-[10px] text-indigo-400/70 mt-2">Click to drill down →</div>
      </div>
    );
  };

  const BarTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !(payload as unknown[])?.length) return null;
    const p = payload as { value: number; name: string }[];
    return (
      <div className="bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-3 text-xs shadow-xl">
        <div className="text-slate-400 mb-1.5 font-medium">{label as string}</div>
        <div className="text-slate-100 font-semibold">${p[0]?.value}k revenue</div>
        {p[1]?.value != null && (
          <div className={`mt-0.5 font-medium ${(p[1].value as number) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {(p[1].value as number) >= 0 ? '+' : ''}{(p[1].value as number).toFixed(1)}% MoM
          </div>
        )}
        <div className="text-[10px] text-indigo-400/70 mt-2">Click to drill down →</div>
      </div>
    );
  };

  const handleClick = (d: { raw?: PeriodData } | null) => {
    if (!d?.raw) return;
    setSelectedPeriod(prev => prev?.period === d.raw!.period ? null : d.raw!);
  };

  // Trend summary
  const first = periods[0]?.revenue ?? 0;
  const last  = periods[periods.length - 1]?.revenue ?? 0;
  const overallGrowth = first > 0 ? ((last - first) / first) * 100 : null;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Revenue Trend</div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="text-[11px] text-slate-500">
              {periods[0]?.period} → {periods[periods.length - 1]?.period}
            </div>
            {overallGrowth !== null && (
              <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${overallGrowth >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                {overallGrowth >= 0 ? '+' : ''}{overallGrowth.toFixed(1)}% over period
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Analyze my revenue trend from ${periods[0]?.period} to ${periods[periods.length-1]?.period}. What's driving the trend and what should I do next?`)}
              className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1.5 rounded-lg transition-all font-medium">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
              Analyze
            </button>
          )}
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-800/60 rounded-lg p-0.5">
            {(['area', 'bar'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize ${viewMode === mode ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
                {mode}
              </button>
            ))}
          </div>
          {/* Legend + toggles */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-[3px] rounded-full bg-indigo-500"/>
              <span className="text-[11px] text-slate-500">Revenue</span>
            </div>
            {viewMode === 'area' && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-[3px] rounded-full bg-emerald-500"/>
                <span className="text-[11px] text-slate-500">Gross Profit</span>
              </div>
            )}
            {viewMode === 'area' && (
              <button onClick={() => setShowMA(v => !v)}
                className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${showMA ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>
                <div className={`w-2.5 h-[3px] rounded-full ${showMA ? 'bg-amber-400' : 'bg-slate-700'}`}/>
                3-MA
              </button>
            )}
            {prevPeriods.length > 0 && (
              <button onClick={() => setShowPrior(v => !v)}
                className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${showPrior ? 'text-slate-400' : 'text-slate-600 hover:text-slate-400'}`}>
                <div className={`w-2.5 h-[3px] rounded-full border-t border-dashed ${showPrior ? 'border-slate-400' : 'border-slate-700'}`}/>
                Prior
              </button>
            )}
            {viewMode === 'area' && n >= 2 && (
              <button onClick={() => setShowForecast(v => !v)}
                className={`flex items-center gap-1.5 text-[11px] font-medium transition-colors ${showForecast ? 'text-violet-400' : 'text-slate-600 hover:text-slate-400'}`}>
                <div className={`w-4 h-[2px] ${showForecast ? 'bg-violet-400' : 'bg-slate-700'}`} style={{ borderTop: '2px dashed', borderColor: showForecast ? '#a78bfa' : '#334155' }}/>
                Forecast
              </button>
            )}
            {revenueGoal && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-[3px] rounded-full border-t border-dashed border-amber-500/60"/>
                <span className="text-[11px] text-amber-500/70">Target</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="cursor-pointer">
        {viewMode === 'area' ? (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart
              data={displayData}
              margin={{ top: 4, right: 2, left: 0, bottom: 0 }}
              onClick={(d) => { if (d?.activePayload?.[0]) handleClick(d.activePayload[0].payload); }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false}/>
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}k`} width={42}/>
              <Tooltip content={<CustomTooltip/>} cursor={{ stroke: 'rgba(148,163,184,0.1)', strokeWidth: 1 }}/>
              <ReferenceLine y={avgRevenue} stroke="rgba(148,163,184,0.12)" strokeDasharray="4 4"
                label={{ value: 'avg', fill: '#475569', fontSize: 10, position: 'insideTopRight' }}/>
              {goalLineK && (
                <ReferenceLine y={goalLineK} stroke="rgba(245,158,11,0.35)" strokeDasharray="6 3"
                  label={{ value: 'target', fill: '#d97706', fontSize: 9, position: 'insideTopRight' }}/>
              )}
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2}
                fill="url(#revenueGrad)" dot={false}
                activeDot={{ r: 5, fill: '#6366f1', stroke: '#0f172a', strokeWidth: 2, cursor: 'pointer' }}/>
              <Area type="monotone" dataKey="grossProfit" stroke="#10b981" strokeWidth={1.5}
                fill="url(#gpGrad)" dot={false}
                activeDot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                strokeDasharray="5 3"/>
              {showPrior && prevPeriods.length > 0 && (
                <Area type="monotone" dataKey="prior" stroke="rgba(148,163,184,0.35)" strokeWidth={1.5}
                  fill="none" dot={false} strokeDasharray="4 2"/>
              )}
              {showMA && (
                <Line type="monotone" dataKey="ma" stroke="rgba(245,158,11,0.7)" strokeWidth={1.5}
                  dot={false} strokeDasharray="3 2"/>
              )}
              {showForecast && (
                <Line type="monotone" dataKey="forecast" stroke="#a78bfa" strokeWidth={1.5}
                  strokeDasharray="6 3" dot={{ r: 3, fill: '#a78bfa', stroke: '#0f172a', strokeWidth: 1.5 }}
                  activeDot={{ r: 4, fill: '#a78bfa' }} connectNulls/>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={growthData}
              margin={{ top: 4, right: 2, left: 0, bottom: 0 }}
              barSize={20}
              onClick={(d) => { if (d?.activePayload?.[0]) handleClick(d.activePayload[0].payload); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false}/>
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}k`} width={42}/>
              <Tooltip content={<BarTooltip/>} cursor={{ fill: 'rgba(148,163,184,0.04)' }}/>
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {growthData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={selectedPeriod?.period === d.raw.period ? '#818cf8' : '#6366f1'}
                    opacity={selectedPeriod && selectedPeriod.period !== d.raw.period ? 0.5 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Period detail drawer */}
      {selectedPeriod && (
        <PeriodDrawer
          period={selectedPeriod}
          annotation={annotations[selectedPeriod.period]}
          onAnnotate={onAnnotate}
          onClose={() => setSelectedPeriod(null)}
          onAskAI={onAskAI}
        />
      )}

      {/* Period table */}
      {periods.length > 0 && (
        <div className="mt-4 border-t border-slate-800/50 pt-4 overflow-x-auto">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Period Breakdown — click any row to drill down
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_80px_80px_40px] gap-3 px-3 mb-1 min-w-[420px]">
            {['Period', 'Revenue', 'Gross Profit', 'MoM', 'Signal', ''].map((h, i) => (
              <div key={i} className="text-[9px] font-semibold text-slate-700 uppercase tracking-wider">{h}</div>
            ))}
          </div>
          <div className="space-y-1">
            {periods.map((p, i) => {
              const gp     = p.cogs ? p.revenue - p.cogs : null;
              const gpPct  = gp && p.revenue ? (gp / p.revenue) * 100 : null;
              const prev   = i > 0 ? periods[i - 1].revenue : null;
              const growth = prev ? ((p.revenue - prev) / prev) * 100 : null;
              const isSelected = selectedPeriod?.period === p.period;
              const revK = Math.round(p.revenue / 1000);
              const isPeak = revK === maxRev && chartData.length > 2;
              const isLow  = revK === minRev && chartData.length > 2;
              const hasNote = !!annotations[p.period];

              return (
                <button
                  key={p.period}
                  onClick={() => setSelectedPeriod(prev => prev?.period === p.period ? null : p)}
                  className={`w-full grid grid-cols-[1fr_1fr_1fr_80px_80px_40px] gap-3 px-3 py-2 rounded-lg text-left transition-all min-w-[420px] ${
                    isSelected ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-slate-800/30 border border-transparent'
                  }`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[12px] font-medium text-slate-300 truncate">{p.period}</span>
                    {hasNote && <span className="text-amber-400/70 text-[10px] flex-shrink-0" title={annotations[p.period]}>&#128204;</span>}
                  </div>
                  <div className="text-[12px] text-slate-200 font-semibold">{fmt(p.revenue)}</div>
                  <div className="text-[12px] text-slate-400">
                    {gp !== null ? <span className="text-emerald-400">{fmt(gp)}</span> : <span className="text-slate-700">—</span>}
                    {gpPct !== null && <span className="text-[10px] text-slate-600 ml-1.5">{gpPct.toFixed(1)}%</span>}
                  </div>
                  <div className={`text-[12px] font-medium ${growth === null ? 'text-slate-700' : growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {growth !== null ? `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%` : '—'}
                  </div>
                  <div className="flex items-center gap-1">
                    {isPeak && <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">Peak</span>}
                    {isLow  && <span className="text-[9px] font-bold bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">Low</span>}
                  </div>
                  <div className="text-[11px] text-indigo-400/60 text-right">{isSelected ? '▲' : '→'}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
