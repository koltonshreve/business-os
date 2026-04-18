import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { UnifiedBusinessData } from '../../types';

interface Props { data: UnifiedBusinessData; }

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export default function CostBreakdownChart({ data }: Props) {
  const totalRevenue = data.revenue.total;
  const totalCosts = data.costs.totalCOGS + data.costs.totalOpEx;
  const grossProfit = totalRevenue - data.costs.totalCOGS;
  const ebitda = totalRevenue - totalCosts;

  const categories = data.costs.byCategory.length > 0
    ? data.costs.byCategory
    : [
        { category: 'COGS', amount: data.costs.totalCOGS },
        { category: 'Operating Expenses', amount: data.costs.totalOpEx },
      ];

  const chartData = categories
    .filter(c => c.amount > 0)
    .map(c => ({
      name: c.category,
      value: c.amount,
      percent: totalRevenue > 0 ? ((c.amount / totalRevenue) * 100).toFixed(1) : '0',
    }));

  const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${(n/1_000).toFixed(0)}k`;

  const CustomTooltip = ({ active, payload }: Record<string, unknown>) => {
    if (!active || !(payload as unknown[])?.length) return null;
    const p = (payload as { name: string; value: number; payload: { percent: string } }[])[0];
    return (
      <div className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-xs shadow-xl">
        <div className="font-semibold text-slate-100 mb-1">{p.name}</div>
        <div className="text-slate-300">{fmt(p.value)}</div>
        <div className="text-slate-500 mt-0.5">{p.payload.percent}% of revenue</div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="text-[13px] font-semibold text-slate-100 mb-4">Cost Breakdown</div>

      {/* P&L strip */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Revenue',      value: totalRevenue, color: 'text-slate-100' },
          { label: 'Gross Profit', value: grossProfit,  color: grossProfit > 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'EBITDA',       value: ebitda,       color: ebitda > 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800/50 border border-slate-700/30 rounded-lg px-2.5 py-2 text-center">
            <div className="text-[10px] text-slate-500 mb-0.5 font-medium">{label}</div>
            <div className={`text-[13px] font-bold ${color}`}>{fmt(value)}</div>
          </div>
        ))}
      </div>

      {chartData.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-1.5 mt-1">
            {chartData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-400 truncate max-w-[110px]">{item.name}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-slate-600">{item.percent}%</span>
                  <span className="text-slate-300 font-medium w-14 text-right">{fmt(item.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-1">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-4 h-4 text-slate-600"><path d="M2 9h3v3H2V9zm4-4h2v7H6V5zm4-3h2v10h-2V2zM1 13h12v1H1v-1z"/></svg>
          </div>
          <div className="text-[12px] font-semibold text-slate-500">No cost data yet</div>
          <div className="text-[11px] text-slate-700 max-w-[160px] leading-relaxed">Upload a cost breakdown CSV to see your expense structure</div>
        </div>
      )}
    </div>
  );
}
