import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { UnifiedBusinessData } from '../../types';

interface Props { data: UnifiedBusinessData; }

const fmt = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(abs).toLocaleString('en-US')}`;
};

export default function RevenueRetentionChart({ data }: Props) {
  const periods = data.revenue.byPeriod;
  if (periods.length < 2) return null;

  // Period-over-period decomposition: retained / new / churned
  const chartData = periods.slice(1).map((cur, i) => {
    const prev = periods[i];
    const retained  = Math.min(cur.revenue, prev.revenue);
    const newRev    = Math.max(0, cur.revenue - prev.revenue);
    const churned   = Math.max(0, prev.revenue - cur.revenue);
    const netRetention = prev.revenue > 0 ? (cur.revenue / prev.revenue) * 100 : 100;
    return {
      period: cur.period.replace(/^20\d\d-/, ''),
      retained,
      new: newRev,
      churned: -churned,  // negative for visual below axis
      net: cur.revenue - prev.revenue,
      netRetention,
    };
  });

  const avgNRR = chartData.length > 0
    ? chartData.reduce((s, d) => s + d.netRetention, 0) / chartData.length
    : 100;

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !(payload as unknown[])?.length) return null;
    const p = payload as { name: string; value: number; color: string }[];
    return (
      <div className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2.5 text-xs shadow-xl">
        <div className="text-slate-400 mb-1.5 font-medium">{label as string}</div>
        {p.filter(item => item.value !== 0).map((item, i) => (
          <div key={i} style={{ color: item.color }} className="font-semibold">
            {item.name}: {item.name === 'Churned' ? `-${fmt(Math.abs(item.value))}` : fmt(item.value)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Revenue Dynamics</div>
          <div className="text-[11px] text-slate-500 mt-0.5">New, retained, and churned revenue by period</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`text-[14px] font-bold ${avgNRR >= 100 ? 'text-emerald-400' : avgNRR >= 90 ? 'text-amber-400' : 'text-red-400'}`}>
            {avgNRR.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500">Avg Net Retention</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={16} barGap={2}>
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}/>
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
            tickFormatter={v => `${v >= 0 ? '' : '-'}${fmt(Math.abs(v))}`} width={40}/>
          <Tooltip content={<CustomTooltip/>} cursor={{ fill: 'rgba(148,163,184,0.05)' }}/>
          <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" strokeWidth={1}/>
          <Bar dataKey="retained" name="Retained" stackId="a" fill="rgba(99,102,241,0.55)" radius={[0,0,0,0]}/>
          <Bar dataKey="new"      name="New"       stackId="a" fill="rgba(16,185,129,0.65)" radius={[3,3,0,0]}/>
          <Bar dataKey="churned"  name="Churned"              fill="rgba(239,68,68,0.55)"  radius={[0,0,3,3]}/>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-[3px] rounded-full bg-indigo-500/55"/><span className="text-slate-500">Retained</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-[3px] rounded-full bg-emerald-500/65"/><span className="text-slate-500">New/Expansion</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-[3px] rounded-full bg-red-500/55"/><span className="text-slate-500">Churned/Contraction</span></div>
      </div>
    </div>
  );
}
