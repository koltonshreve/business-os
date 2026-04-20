import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { UnifiedBusinessData } from '../../types';

interface Props { data: UnifiedBusinessData; }

export default function CustomerMetricsChart({ data }: Props) {
  const { customers } = data;

  const topCustomersData = customers.topCustomers.slice(0, 6).map(c => ({
    name: c.name.length > 13 ? c.name.slice(0, 12) + '…' : c.name,
    fullName: c.name,
    revenue: c.revenue,
    percent: c.percentOfTotal,
    isConcentrated: c.percentOfTotal > 20,
  }));

  const fmt = (n: number) => { const abs = Math.abs(n); return abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; };
  const top3Pct = customers.topCustomers.slice(0, 3).reduce((s, c) => s + c.percentOfTotal, 0);
  const retentionPct = ((customers.retentionRate ?? 0.9) * 100).toFixed(1);

  const CustomTooltip = ({ active, payload }: Record<string, unknown>) => {
    if (!active || !(payload as unknown[])?.length) return null;
    const p = (payload as { payload: typeof topCustomersData[0] }[])[0];
    return (
      <div className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-xs shadow-xl">
        <div className="font-semibold text-slate-100 mb-1">{p.payload.fullName}</div>
        <div className="text-slate-300">{fmt(p.payload.revenue)}</div>
        <div className={p.payload.isConcentrated ? 'text-red-400 mt-0.5' : 'text-slate-500 mt-0.5'}>
          {p.payload.percent.toFixed(1)}% of revenue
          {p.payload.isConcentrated && ' · concentration risk'}
        </div>
      </div>
    );
  };

  const statItems = [
    { label: 'Customers',    value: customers.totalCount.toString(),         color: 'text-slate-100' },
    { label: 'Net New',      value: `+${customers.newThisPeriod - customers.churned}`, color: customers.newThisPeriod > customers.churned ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Retention',    value: `${retentionPct}%`,                      color: +retentionPct >= 90 ? 'text-emerald-400' : +retentionPct >= 80 ? 'text-amber-400' : 'text-red-400' },
    { label: 'Top 3 Conc.',  value: `${top3Pct.toFixed(0)}%`,               color: top3Pct > 60 ? 'text-red-400' : top3Pct > 40 ? 'text-amber-400' : 'text-emerald-400' },
  ];

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="text-[13px] font-semibold text-slate-100 mb-4">Customer Overview</div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {statItems.map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800/50 border border-slate-700/30 rounded-lg px-2 py-2 text-center">
            <div className="text-[10px] text-slate-500 mb-0.5 font-medium">{label}</div>
            <div className={`text-[13px] font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {topCustomersData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={145}>
            <BarChart data={topCustomersData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.04)' }} />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
                {topCustomersData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isConcentrated ? '#ef4444' : entry.percent > 15 ? '#f59e0b' : '#6366f1'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block"/>Normal</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block"/>&gt;15%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block"/>&gt;20% risk</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-1">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-4 h-4 text-slate-600"><circle cx="5" cy="4" r="2.5"/><path d="M0 12c0-2.76 2.24-5 5-5s5 2.24 5 5H0z"/><circle cx="11" cy="5" r="1.8"/><path d="M14 12c0-1.66-1.34-3-3-3-.48 0-.93.12-1.33.32A6.02 6.02 0 0111 12h3z"/></svg>
          </div>
          <div className="text-[12px] font-semibold text-slate-500">No customer data yet</div>
          <div className="text-[11px] text-slate-700 max-w-[160px] leading-relaxed">Upload a customer list CSV to see revenue concentration</div>
        </div>
      )}
    </div>
  );
}
