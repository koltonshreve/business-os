import type { UnifiedBusinessData } from '../../types';

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1e6 ? `$${(abs/1e6).toFixed(2)}M` : abs >= 1e3 ? `$${(abs/1e3).toFixed(0)}k` : `$${Math.round(abs).toLocaleString()}`;
  return n < 0 ? `(${s})` : n > 0 ? `+${s}` : s;
};
const fmtAbs = (n: number) => {
  const abs = Math.abs(n);
  return abs >= 1e6 ? `$${(abs/1e6).toFixed(2)}M` : abs >= 1e3 ? `$${(abs/1e3).toFixed(0)}k` : `$${Math.round(abs).toLocaleString()}`;
};

interface BridgeBar {
  label: string;
  value: number;       // the delta or total
  isTotal: boolean;    // true = show as full bar
  color: string;
}

export default function EBITDABridge({ data }: { data: UnifiedBusinessData }) {
  const periods = data.revenue.byPeriod ?? [];

  // Need at least 2 periods to build a bridge
  if (periods.length < 2) {
    return (
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="text-[13px] font-semibold text-slate-100 mb-1">EBITDA Bridge</div>
        <div className="text-[11px] text-slate-500">Upload at least 2 periods of revenue data to generate the bridge.</div>
      </div>
    );
  }

  // Take last two periods
  const prev = periods[periods.length - 2];
  const curr = periods[periods.length - 1];

  // Derive COGS ratio from totals (use per-period if available)
  const cogsRatio = data.revenue.total > 0 ? data.costs.totalCOGS / data.revenue.total : 0;
  const opexRatio = data.revenue.total > 0 ? data.costs.totalOpEx  / data.revenue.total : 0;

  const prevCOGS = prev.cogs ?? prev.revenue * cogsRatio;
  const currCOGS = curr.cogs ?? curr.revenue * cogsRatio;
  const prevOpEx = prev.revenue * opexRatio;
  const currOpEx = curr.revenue * opexRatio;

  const prevEBITDA = prev.ebitda ?? (prev.revenue - prevCOGS - prevOpEx);
  const currEBITDA = curr.ebitda ?? (curr.revenue - currCOGS - currOpEx);

  const revDelta   = curr.revenue - prev.revenue;
  const cogsDelta  = -(currCOGS - prevCOGS);   // positive = improvement (lower COGS)
  const opexDelta  = -(currOpEx - prevOpEx);    // positive = improvement (lower OpEx)
  const totalDelta = currEBITDA - prevEBITDA;

  const bars: BridgeBar[] = [
    { label: prev.period,   value: prevEBITDA,  isTotal: true,  color: '#6366f1' },
    { label: 'Revenue',     value: revDelta,    isTotal: false, color: revDelta  >= 0 ? '#10b981' : '#ef4444' },
    { label: 'COGS',        value: cogsDelta,   isTotal: false, color: cogsDelta >= 0 ? '#10b981' : '#ef4444' },
    { label: 'OpEx',        value: opexDelta,   isTotal: false, color: opexDelta >= 0 ? '#10b981' : '#ef4444' },
    { label: curr.period,   value: currEBITDA,  isTotal: true,  color: currEBITDA >= prevEBITDA ? '#10b981' : '#ef4444' },
  ];

  // Also show per-category breakdown if available
  const opexCats = data.costs.byCategory.filter(c => !['Labor','Materials','Overhead'].includes(c.category));

  const maxAbs = Math.max(...bars.map(b => Math.abs(b.value)), 1);
  const prevM  = data.revenue.total > 0 && prev.revenue > 0 ? ((prevEBITDA / prev.revenue) * 100).toFixed(1) : '—';
  const currM  = data.revenue.total > 0 && curr.revenue > 0 ? ((currEBITDA / curr.revenue) * 100).toFixed(1) : '—';

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/40 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">EBITDA Bridge</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Period-over-period drivers · {prev.period} → {curr.period}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] flex-shrink-0">
          <span className="text-slate-600">{prevM}%</span>
          <span className="text-slate-700">→</span>
          <span className={parseFloat(currM) >= parseFloat(prevM) ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{currM}%</span>
          <span className="text-slate-600">EBITDA margin</span>
        </div>
      </div>

      <div className="px-5 py-5 space-y-2.5">
        {bars.map((bar, i) => {
          const widthPct = Math.min((Math.abs(bar.value) / maxAbs) * 100, 100);
          const isPos = bar.value >= 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-20 text-right text-[11px] text-slate-500 flex-shrink-0 font-medium truncate" title={bar.label}>{bar.label}</div>
              <div className="flex-1 relative h-7 bg-slate-800/40 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    background: bar.color,
                    opacity: bar.isTotal ? 1 : 0.75,
                  }}
                />
                {bar.isTotal && (
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-[11px] font-bold text-white/90">{fmtAbs(bar.value)}</span>
                  </div>
                )}
              </div>
              <div className={`w-20 text-right text-[12px] font-semibold tabular-nums flex-shrink-0 ${
                bar.isTotal ? 'text-slate-200' : bar.value > 0 ? 'text-emerald-400' : bar.value < 0 ? 'text-red-400' : 'text-slate-500'
              }`}>
                {bar.isTotal ? fmtAbs(bar.value) : fmt(bar.value)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Net change callout */}
      <div className={`mx-5 mb-5 px-4 py-3 rounded-xl border text-[11px] leading-relaxed ${
        totalDelta >= 0 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400/90' : 'bg-red-500/5 border-red-500/20 text-red-400/90'
      }`}>
        EBITDA {totalDelta >= 0 ? 'improved' : 'declined'} by <span className="font-bold">{fmtAbs(totalDelta)}</span> from {prev.period} to {curr.period}.
        {' '}Revenue {revDelta >= 0 ? 'growth' : 'decline'} of <span className="font-semibold">{fmtAbs(revDelta)}</span> was the primary driver
        {Math.abs(cogsDelta) > 0 ? `, with COGS ${cogsDelta >= 0 ? 'efficiency gain' : 'headwind'} of ${fmtAbs(cogsDelta)}` : ''}.
        {opexCats.length > 0 && ` Largest OpEx line: ${opexCats[0].category} (${fmtAbs(opexCats[0].amount)}).`}
      </div>

      {/* Cost breakdown mini-table */}
      {opexCats.length > 0 && (
        <div className="px-5 pb-5">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Cost Breakdown (current period)</div>
          <div className="grid grid-cols-2 gap-1">
            {opexCats.slice(0, 8).map(c => (
              <div key={c.category} className="flex items-center justify-between bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-1.5">
                <span className="text-[11px] text-slate-400 truncate">{c.category}</span>
                <span className="text-[11px] font-semibold text-slate-300 tabular-nums ml-2 flex-shrink-0">{fmtAbs(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
