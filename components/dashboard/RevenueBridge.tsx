import type { UnifiedBusinessData } from '../../types';

const fmtAbs = (n: number) => {
  const abs = Math.abs(n);
  return abs >= 1e6 ? `$${(abs/1e6).toFixed(2)}M` : abs >= 1e3 ? `$${(abs/1e3).toFixed(0)}k` : `$${Math.round(abs).toLocaleString()}`;
};
const fmtDelta = (n: number) => {
  if (n === 0) return '—';
  const s = fmtAbs(n);
  return n > 0 ? `+${s}` : `(${s})`;
};
const pctChg = (a: number, b: number) => b > 0 ? (((a - b) / b) * 100).toFixed(1) + '%' : '—';

interface BridgeRow { label: string; value: number; sub?: string; color: string; isTotal?: boolean }

export default function RevenueBridge({ data }: { data: UnifiedBusinessData }) {
  const periods = data.revenue.byPeriod ?? [];
  const customers = data.customers;

  // Need at least 2 periods
  if (periods.length < 2) {
    return (
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="text-[13px] font-semibold text-slate-100 mb-1">Revenue Bridge</div>
        <div className="text-[11px] text-slate-500">Upload at least 2 periods of revenue data to generate the bridge.</div>
      </div>
    );
  }

  const prev = periods[periods.length - 2];
  const curr = periods[periods.length - 1];
  const totalDelta = curr.revenue - prev.revenue;

  // Decompose revenue change using available signals
  // New customers: customers.newThisPeriod × avgRevPerCustomer
  const avgRev = customers.avgRevenuePerCustomer || (customers.totalCount > 0 ? data.revenue.total / customers.totalCount : 0);
  const newRevenue     = customers.newThisPeriod > 0 ? customers.newThisPeriod * avgRev : 0;
  const churnedRevenue = customers.churned > 0 ? -(customers.churned * avgRev) : 0;

  // Recurring vs one-time split (use per-period if available)
  const recurringCurr = curr.recurring ?? data.revenue.recurring ?? 0;
  const recurringPrev = prev.recurring ?? data.revenue.recurring ?? 0;
  const oneTimeCurr   = curr.oneTime   ?? data.revenue.oneTime   ?? 0;
  const oneTimePrev   = prev.oneTime   ?? data.revenue.oneTime   ?? 0;
  const hasRecurring  = recurringCurr > 0 || recurringPrev > 0;

  // Residual = expansion / contraction not explained by new/churn/mix
  let explained = newRevenue + churnedRevenue;
  const expansion = hasRecurring
    ? (recurringCurr - recurringPrev) - (newRevenue + churnedRevenue)
    : totalDelta - explained;
  explained = newRevenue + churnedRevenue + (hasRecurring ? expansion : 0);

  const rows: BridgeRow[] = [
    { label: prev.period,    value: prev.revenue,    isTotal: true,  color: '#6366f1', sub: `starting` },
    ...(newRevenue !== 0     ? [{ label: 'New Customers',    value: newRevenue,     color: '#10b981', sub: `${customers.newThisPeriod} new accts` }] : []),
    ...(churnedRevenue !== 0 ? [{ label: 'Churn / Lost',     value: churnedRevenue, color: '#ef4444', sub: `${customers.churned} accounts` }] : []),
    ...(hasRecurring && Math.abs(expansion) > 0
      ? [{ label: 'Expansion / Contraction', value: expansion, color: expansion >= 0 ? '#10b981' : '#ef4444', sub: 'existing accounts' }]
      : []
    ),
    ...(!hasRecurring && Math.abs(totalDelta) > 0
      ? [{ label: totalDelta >= 0 ? 'Volume / Price Growth' : 'Volume / Price Decline', value: totalDelta, color: totalDelta >= 0 ? '#10b981' : '#ef4444', sub: 'net change' }]
      : []
    ),
    { label: curr.period,    value: curr.revenue,    isTotal: true,  color: curr.revenue >= prev.revenue ? '#10b981' : '#ef4444', sub: 'ending' },
  ];

  const maxVal = Math.max(...rows.map(r => Math.abs(r.value)), 1);

  // Recurring revenue stats
  const retentionRate = customers.retentionRate ?? null;
  const netRetention  = retentionRate !== null ? ((1 + (expansion > 0 ? expansion / Math.max(prev.revenue,1) : 0)) * retentionRate * 100).toFixed(0) : null;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/40 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Revenue Bridge</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Revenue change decomposed · {prev.period} → {curr.period}
          </div>
        </div>
        <div className={`flex-shrink-0 text-[13px] font-bold tabular-nums ${totalDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {fmtDelta(totalDelta)} ({pctChg(curr.revenue, prev.revenue)})
        </div>
      </div>

      {/* Bridge bars */}
      <div className="px-5 py-5 space-y-2.5">
        {rows.map((row, i) => {
          const pct = Math.min((Math.abs(row.value) / maxVal) * 100, 100);
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-28 text-right flex-shrink-0">
                <div className="text-[11px] text-slate-300 font-medium truncate">{row.label}</div>
                {row.sub && <div className="text-[9px] text-slate-600">{row.sub}</div>}
              </div>
              <div className="flex-1 h-7 bg-slate-800/40 rounded-lg overflow-hidden relative">
                <div className="h-full rounded-lg transition-all duration-500"
                  style={{ width: `${pct}%`, background: row.color, opacity: row.isTotal ? 1 : 0.75 }}/>
                {row.isTotal && (
                  <div className="absolute inset-0 flex items-center px-3">
                    <span className="text-[11px] font-bold text-white/90">{fmtAbs(row.value)}</span>
                  </div>
                )}
              </div>
              <div className={`w-20 text-right text-[12px] font-semibold tabular-nums flex-shrink-0 ${
                row.isTotal ? 'text-slate-200' : row.value > 0 ? 'text-emerald-400' : row.value < 0 ? 'text-red-400' : 'text-slate-500'
              }`}>
                {row.isTotal ? fmtAbs(row.value) : fmtDelta(row.value)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-800/50 border-t border-slate-800/40">
        {[
          { label: 'Revenue Growth',    value: pctChg(curr.revenue, prev.revenue), color: totalDelta >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Logo Retention',    value: retentionRate !== null ? ((retentionRate)*100).toFixed(0)+'%' : 'N/A', color: retentionRate && retentionRate >= 0.92 ? 'text-emerald-400' : retentionRate && retentionRate >= 0.85 ? 'text-amber-400' : 'text-red-400' },
          { label: 'New Accts',         value: customers.newThisPeriod > 0 ? String(customers.newThisPeriod) : 'N/A', color: 'text-slate-200' },
          { label: 'Churned Accts',     value: customers.churned > 0 ? String(customers.churned) : 'N/A', color: 'text-slate-200' },
        ].map(s => (
          <div key={s.label} className="px-4 py-3">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">{s.label}</div>
            <div className={`text-[18px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Recurring/one-time split if available */}
      {hasRecurring && (
        <div className="px-5 py-3 border-t border-slate-800/40 bg-slate-900/20">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Revenue Mix</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-indigo-500/80 transition-all" style={{ width: curr.revenue > 0 ? `${(recurringCurr/curr.revenue)*100}%` : '0%' }}/>
              <div className="h-full bg-amber-500/60 transition-all" style={{ width: curr.revenue > 0 ? `${(oneTimeCurr/curr.revenue)*100}%` : '0%' }}/>
            </div>
            <div className="flex gap-3 text-[10px] flex-shrink-0">
              <span className="flex items-center gap-1 text-indigo-400"><span className="w-2 h-2 rounded-full bg-indigo-500/80"/>Recurring {fmtAbs(recurringCurr)}</span>
              <span className="flex items-center gap-1 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500/60"/>One-time {fmtAbs(oneTimeCurr)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
