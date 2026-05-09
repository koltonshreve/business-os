import { memo } from 'react';
import type { UnifiedBusinessData } from '../../types';

interface Props { data: UnifiedBusinessData; }

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
};

const pct = (n: number, total: number) =>
  total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—';

function PLWaterfall({ data }: Props) {
  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const gp     = rev - cogs;
  const ebitda = gp - opex;
  const gpMargin     = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaMargin = rev > 0 ? (ebitda / rev) * 100 : 0;

  const categories = data.costs.byCategory.length > 0
    ? data.costs.byCategory.filter(c => !['Labor','Materials','Overhead'].includes(c.category))
    : [];

  // SVG waterfall
  const W = 520, H = 140, pad = 12;
  const segments = [
    { label: 'Revenue',      val: rev,    from: 0,    to: rev,   color: '#6366f1', type: 'bar' },
    { label: 'COGS',         val: cogs,   from: gp,   to: rev,   color: '#ef4444', type: 'fall' },
    { label: 'Gross Profit', val: gp,     from: 0,    to: gp,    color: '#6366f1', type: 'sub' },
    { label: 'OpEx',         val: opex,   from: ebitda, to: gp,  color: '#f59e0b', type: 'fall' },
    { label: 'EBITDA',       val: ebitda, from: 0,    to: Math.max(ebitda, 0), color: ebitda >= 0 ? '#10b981' : '#ef4444', type: 'total' },
  ];

  const barW = 64, gap = (W - pad*2 - segments.length * barW) / (segments.length - 1);
  const scale = (v: number) => (v / rev) * (H - 20);

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">P&amp;L Waterfall</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Income statement bridge</div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/40">
            <span className="text-slate-500">GM</span>
            <span className={`font-semibold ${gpMargin >= 50 ? 'text-emerald-400' : gpMargin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>{gpMargin.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700/40">
            <span className="text-slate-500">EBITDA</span>
            <span className={`font-semibold ${ebitdaMargin >= 20 ? 'text-emerald-400' : ebitdaMargin >= 10 ? 'text-amber-400' : 'text-red-400'}`}>{ebitdaMargin.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H + 36}`} className="w-full overflow-visible">
        {segments.map((seg, i) => {
          const x   = pad + i * (barW + gap);
          const top = (H - 20) - scale(seg.to);
          const h   = Math.max(scale(seg.to - seg.from), 2);
          const textY = top - 5;
          return (
            <g key={i}>
              {/* Connector line to next bar */}
              {i < segments.length - 1 && seg.type !== 'sub' && (
                <line
                  x1={x + barW} y1={top + (seg.type === 'fall' ? h : 0)}
                  x2={x + barW + gap} y2={top + (seg.type === 'fall' ? h : 0)}
                  stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" strokeWidth={1}
                />
              )}
              <rect
                x={x} y={top} width={barW} height={h}
                fill={seg.color} fillOpacity={seg.type === 'sub' ? 0.3 : 0.85} rx={3}
              />
              {/* Value label */}
              <text x={x + barW/2} y={Math.max(textY, 8)} textAnchor="middle" fontSize={10} fill="#e2e8f0" fontWeight={600}>
                {fmt(seg.val)}
              </text>
              {/* Axis label */}
              <text x={x + barW/2} y={H + 14} textAnchor="middle" fontSize={9.5} fill="#64748b">
                {seg.label}
              </text>
              <text x={x + barW/2} y={H + 26} textAnchor="middle" fontSize={9} fill="#475569">
                {pct(seg.val, rev)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Detailed cost table */}
      {data.costs.byCategory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800/60">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2.5">Cost Detail</div>
          <div className="space-y-1.5">
            {data.costs.byCategory.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-[12px] text-slate-400 w-40 flex-shrink-0 truncate">{c.category}</div>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min((c.amount / rev) * 100 * 2.5, 100)}%`, background: `hsl(${220 + i * 25}, 60%, 55%)` }}
                  />
                </div>
                <div className="text-[12px] text-slate-300 font-medium w-14 text-right">{fmt(c.amount)}</div>
                <div className="text-[11px] text-slate-500 w-10 text-right">{pct(c.amount, rev)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(PLWaterfall);
