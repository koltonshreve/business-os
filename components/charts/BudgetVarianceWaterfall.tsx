import { memo } from 'react';
import type { Budget, UnifiedBusinessData } from '../../types';

interface Props {
  data: UnifiedBusinessData;
  budget: Budget;
}

const fmt = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(abs).toLocaleString('en-US')}`;
};

const fmtSigned = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(n)}`;

function BudgetVarianceWaterfall({ data, budget }: Props) {
  const actRev    = data.revenue.total;
  const actCOGS   = data.costs.totalCOGS;
  const actOpEx   = data.costs.totalOpEx;
  const actGP     = actRev - actCOGS;
  const actEBITDA = actGP - actOpEx;

  const budRev    = budget.revenue    ?? 0;
  const budCOGS   = budget.cogs       ?? 0;
  const budOpEx   = budget.opex       ?? 0;
  const budGP     = budRev - budCOGS;
  const budEBITDA = budGP - budOpEx;

  const hasBudget = budRev > 0 || budCOGS > 0 || budOpEx > 0;
  if (!hasBudget) return null;

  // Variance (positive = favorable)
  const revVar    = actRev  - budRev;     // favorable if positive
  const cogsVar   = budCOGS - actCOGS;   // favorable if positive (spent less)
  const opexVar   = budOpEx - actOpEx;   // favorable if positive

  // SVG dimensions
  const W = 560; const H = 160; const padL = 8; const padR = 8; const padT = 20; const padB = 36;
  const chartH = H - padT - padB;

  const segments = [
    { id: 'budget',   label: 'Budget',        value: budEBITDA,  type: 'anchor' as const },
    { id: 'rev',      label: 'Revenue',        value: revVar,     type: 'bridge' as const },
    { id: 'cogs',     label: 'COGS',           value: cogsVar,    type: 'bridge' as const },
    { id: 'opex',     label: 'OpEx',           value: opexVar,    type: 'bridge' as const },
    { id: 'actual',   label: 'Actual',         value: actEBITDA,  type: 'anchor' as const },
  ];

  // Compute running baseline for each bridge segment
  const bars: { x: number; y: number; h: number; color: string; label: string; value: number; type: string }[] = [];
  const n = segments.length;
  const barW = Math.floor((W - padL - padR) / n) - 6;
  const gap  = Math.floor((W - padL - padR - barW * n) / (n - 1));

  // Determine scale
  const allValues = [budEBITDA, actEBITDA];
  let runningTop = budEBITDA;
  for (const s of segments.slice(1, -1)) {
    runningTop += Math.max(s.value, 0);
    allValues.push(runningTop);
  }
  let runningBot = budEBITDA;
  for (const s of segments.slice(1, -1)) {
    runningBot += Math.min(s.value, 0);
    allValues.push(runningBot);
  }

  const minVal = Math.min(...allValues, 0);
  const maxVal = Math.max(...allValues, 0);
  const range  = Math.max(maxVal - minVal, 1);
  const scale  = (v: number) => ((maxVal - v) / range) * chartH;
  const zeroY  = scale(0);

  let baseline = budEBITDA;
  segments.forEach((seg, i) => {
    const x = padL + i * (barW + gap);
    if (seg.type === 'anchor') {
      const top  = Math.min(seg.value, 0);
      const bot  = Math.max(seg.value, 0);
      const yTop = padT + scale(Math.max(seg.value, 0));
      const yBot = padT + scale(Math.min(seg.value, 0));
      const barH = Math.abs(yBot - yTop) || 2;
      const color = i === 0
        ? 'rgba(99,102,241,0.7)'  // budget = indigo
        : seg.value >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.65)';
      bars.push({ x, y: Math.min(yTop, yBot), h: Math.max(barH, 2), color, label: seg.label, value: seg.value, type: seg.type });
    } else {
      const from = baseline;
      const to   = baseline + seg.value;
      const yTop = padT + scale(Math.max(from, to));
      const yBot = padT + scale(Math.min(from, to));
      const barH = Math.abs(yBot - yTop) || 2;
      const color = seg.value >= 0 ? 'rgba(16,185,129,0.65)' : 'rgba(239,68,68,0.60)';
      bars.push({ x, y: yTop, h: Math.max(barH, 2), color, label: seg.label, value: seg.value, type: 'bridge' });
      baseline = to;
    }
  });

  const zeroLineY = padT + zeroY;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Budget Variance Bridge</div>
          <div className="text-[11px] text-slate-500 mt-0.5">How budget EBITDA became actual EBITDA</div>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/65"/>
            <span className="text-slate-500">Favorable</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500/65"/>
            <span className="text-slate-500">Unfavorable</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
        {/* Zero line */}
        {zeroLineY > padT && zeroLineY < H - padB && (
          <line x1={padL} y1={zeroLineY} x2={W - padR} y2={zeroLineY}
            stroke="rgba(148,163,184,0.15)" strokeWidth="1" strokeDasharray="4 3"/>
        )}

        {bars.map((bar, i) => (
          <g key={i}>
            {/* Connector line to next bridge bar */}
            {bar.type === 'anchor' && i === 0 && bars[1] && (
              <line
                x1={bar.x + barW} y1={bar.y}
                x2={bars[1].x} y2={bar.y}
                stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="3 2"/>
            )}
            {bar.type === 'bridge' && bars[i + 1] && (
              <line
                x1={bar.x + barW}
                y1={bars[i].value >= 0 ? bar.y : bar.y + bar.h}
                x2={bars[i + 1].x}
                y2={bars[i].value >= 0 ? bar.y : bar.y + bar.h}
                stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="3 2"/>
            )}

            {/* Bar */}
            <rect x={bar.x} y={bar.y} width={barW} height={bar.h} rx="3" fill={bar.color}/>

            {/* Value label above/below bar */}
            <text
              x={bar.x + barW / 2}
              y={bar.y - 5}
              textAnchor="middle"
              fill={bar.value >= 0 || bar.type === 'anchor' ? (bar.value >= 0 ? '#34d399' : '#f87171') : '#f87171'}
              fontSize="10"
              fontWeight="600"
              className="font-mono"
            >
              {bar.type === 'anchor' ? fmt(bar.value) : fmtSigned(bar.value)}
            </text>

            {/* X-axis label */}
            <text
              x={bar.x + barW / 2}
              y={H - padB + 14}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
            >
              {bar.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Summary row */}
      <div className="mt-2 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-4 text-center">
        {[
          { label: 'Budget EBITDA',  value: fmt(budEBITDA),  color: 'text-indigo-400' },
          { label: 'Total Variance', value: fmtSigned(actEBITDA - budEBITDA), color: actEBITDA >= budEBITDA ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Actual EBITDA',  value: fmt(actEBITDA),  color: actEBITDA >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(s => (
          <div key={s.label}>
            <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-[0.08em] mb-0.5">{s.label}</div>
            <div className={`text-[14px] font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(BudgetVarianceWaterfall);
