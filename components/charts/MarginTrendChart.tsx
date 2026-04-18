import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { UnifiedBusinessData } from '../../types';

interface Props { data: UnifiedBusinessData; }

export default function MarginTrendChart({ data }: Props) {
  const periods = data.revenue.byPeriod.filter(p => p.cogs != null);

  const chartData = periods.map(p => ({
    period: p.period.replace('2024-', ''),
    grossMargin: p.cogs ? +((((p.revenue - p.cogs) / p.revenue) * 100).toFixed(1)) : null,
    ebitdaMargin: null as number | null, // Would need OpEx per period
    revenue: Math.round(p.revenue / 1000),
  }));

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !(payload as unknown[])?.length) return null;
    const p = payload as { name: string; value: number; color: string }[];
    return (
      <div className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2.5 text-xs shadow-xl">
        <div className="text-slate-400 mb-1.5 font-medium">{label as string}</div>
        {p.map((item, i) => (
          <div key={i} style={{ color: item.color }} className="font-semibold">
            {item.name}: {item.value?.toFixed(1)}%
          </div>
        ))}
      </div>
    );
  };

  if (!chartData.length) {
    return (
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 flex items-center justify-center h-[200px]">
        <div className="text-[12px] text-slate-600">Upload data with COGS to see margin trends</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Margin Trends</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Gross margin over time</div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-[3px] rounded-full bg-indigo-500"/><span className="text-slate-500">Gross Margin</span></div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gmGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.07)" vertical={false}/>
          <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}/>
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} width={36}/>
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.1)', strokeWidth: 1 }}/>
          <Area type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="#6366f1" strokeWidth={2} fill="url(#gmGrad)" dot={false} activeDot={{ r: 4, fill: '#6366f1', stroke: '#0f172a', strokeWidth: 2 }}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
