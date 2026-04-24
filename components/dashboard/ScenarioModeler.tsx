import { useState, useCallback, useId, useEffect } from 'react';
import type { UnifiedBusinessData } from '../../types';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';

interface Props {
  data: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
  /** Called whenever the active scenario changes so parent can propagate it to all modules */
  onScenarioChange?: (s: { name: string; revenueGrowthPct: number; grossMarginPct: number; opexChangePct: number; newHires: number; avgCompK: number; priceIncreasePct: number; newCustomers: number; churnRatePct: number; oneTimeExpense: number } | null) => void;
}

interface Scenario {
  id: string;
  name: string;
  color: string;
  notes?: string;             // optional advisor notes
  revenueGrowthPct: number;   // % change on base revenue
  grossMarginPct: number;     // target GM% (0–100)
  opexChangePct: number;      // % change to OpEx
  newHires: number;           // headcount additions
  avgCompK: number;           // avg annual comp for new hires ($k)
  priceIncreasePct: number;   // price/rate increase %
  newCustomers: number;       // new customer count added
  churnRatePct: number;       // additional churn % on top of base (0–50)
  oneTimeExpense: number;     // one-time below-the-line cost ($)
}

const SCENARIO_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981'];

const DEFAULT_SCENARIO: Omit<Scenario, 'id' | 'name' | 'color'> = {
  revenueGrowthPct: 0,
  grossMarginPct: 0,   // 0 = use current
  opexChangePct: 0,
  newHires: 0,
  avgCompK: 100,
  priceIncreasePct: 0,
  newCustomers: 0,
  churnRatePct: 0,
  oneTimeExpense: 0,
};

const fmt = (n: number, _compact = false) => {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
};

const pct = (n: number) => n < 0 ? `(${Math.abs(n).toFixed(1)}%)` : `+${n.toFixed(1)}%`;
const delta = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n, true)}`;

// ── Compute projected P&L from scenario levers ────────────────────────────────
function project(base: UnifiedBusinessData, s: Scenario) {
  const baseRev  = base.revenue.total;
  const baseCOGS = base.costs.totalCOGS;
  const baseOpEx = base.costs.totalOpEx;
  const baseGP   = baseRev - baseCOGS;
  const baseGM   = baseRev > 0 ? (baseGP / baseRev) * 100 : 40;
  const customerCount = base.customers.totalCount || 1;
  const avgRevPerCustomer = baseRev / customerCount;

  // Revenue: base × (1 + volume_growth%) × (1 + price_increase%) + new customer revenue
  const newCustomerRevenue = s.newCustomers * avgRevPerCustomer;
  const projRev = (baseRev + newCustomerRevenue)
    * (1 + s.revenueGrowthPct / 100)
    * (1 + s.priceIncreasePct / 100);

  // Gross Margin: use slider target if set, otherwise keep current
  const gmPct = s.grossMarginPct > 0 ? s.grossMarginPct : baseGM;
  const projGP   = projRev * (gmPct / 100);
  const projCOGS = projRev - projGP;

  // OpEx: base × (1 + change%) + new hire cost
  const hireCost = s.newHires * s.avgCompK * 1000;
  const projOpEx = baseOpEx * (1 + s.opexChangePct / 100) + hireCost;

  // Churn: additional revenue lost from incremental churn rate
  const churnRevLost = projRev * (s.churnRatePct / 100);
  const projRevAfterChurn = projRev - churnRevLost;
  const projGPAfterChurn  = projRevAfterChurn * (gmPct / 100);
  const projCOGSAfterChurn = projRevAfterChurn - projGPAfterChurn;

  // One-time expense hits EBITDA directly
  const projEBITDA     = projGPAfterChurn - projOpEx - (s.oneTimeExpense ?? 0);
  const projEBITDAMargin = projRevAfterChurn > 0 ? (projEBITDA / projRevAfterChurn) * 100 : 0;

  const baseEBITDA = baseGP - baseOpEx;

  return {
    revenue:           projRevAfterChurn,
    cogs:              projCOGSAfterChurn,
    grossProfit:       projGPAfterChurn,
    opex:              projOpEx,
    ebitda:            projEBITDA,
    ebitdaMargin:      projEBITDAMargin,
    gmPct,
    newCustomerRevenue,
    churnRevLost,
    oneTimeExpense:    s.oneTimeExpense ?? 0,
    // Deltas vs base
    dRevenue:          projRevAfterChurn - baseRev,
    dGP:               projGPAfterChurn - baseGP,
    dOpEx:             projOpEx - baseOpEx,
    dEBITDA:           projEBITDA - baseEBITDA,
    // Break-even
    breakEven:         projOpEx + projCOGSAfterChurn,
  };
}

// ── Slider component ──────────────────────────────────────────────────────────
function Lever({
  label, hint, value, min, max, step, format, accentColor,
  onChange,
}: {
  label: string; hint: string;
  value: number; min: number; max: number; step: number;
  format: (v: number) => string; accentColor: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const pct01 = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const isNonZero = value !== 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[12px] font-medium text-slate-300">{label}</label>
        <span className={`text-[13px] font-bold tabular-nums ${isNonZero ? accentColor : 'text-slate-500'}`}>
          {format(value)}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1.5 bg-slate-800 rounded-full"/>
        {/* Filled portion — for bipolar sliders (min < 0), fill from value to center */}
        {min < 0 ? (
          value < 0 ? (
            <div className="absolute h-1.5 rounded-l-full transition-all" style={{
              left: `${((value - min) / (max - min)) * 100}%`,
              width: `${((-value) / (max - min)) * 100}%`,
              background: isNonZero ? accentColor.replace('text-', '').replace('-400', '') : '#334155',
            }}/>
          ) : (
            <div className="absolute h-1.5 rounded-r-full transition-all" style={{
              left: '50%',
              width: `${(value / (max - min)) * 100}%`,
              background: isNonZero ? accentColor.replace('text-', '').replace('-400', '') : '#334155',
            }}/>
          )
        ) : (
          <div className="absolute h-1.5 rounded-full transition-all" style={{
            left: 0,
            width: `${pct01 * 100}%`,
            background: isNonZero ? accentColor.replace('text-', '').replace('-400', '') : '#334155',
          }}/>
        )}
        <input
          id={id}
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-5 z-10"
        />
        {/* Thumb */}
        <div className="absolute w-3.5 h-3.5 rounded-full border-2 border-slate-900 shadow transition-all pointer-events-none"
          style={{
            left: `calc(${pct01 * 100}% - 7px)`,
            backgroundColor: isNonZero ? '#6366f1' : '#475569',
          }}/>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-700">
        <span>{format(min)}</span>
        <span className="text-slate-600">{hint}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

// ── Revenue bridge — volume/price/customers/churn → final revenue ────────────
function RevenueWaterfall({ base, projected, active }: {
  base: UnifiedBusinessData;
  projected: ReturnType<typeof project>;
  active: Scenario;
}) {
  const baseRev = base.revenue.total;
  const baseGP  = baseRev - base.costs.totalCOGS;
  const baseGM  = baseRev > 0 ? (baseGP / baseRev) * 100 : 40;

  type WBar = { name: string; cumBefore: number; cumAfter: number; type: 'base' | 'up' | 'down' | 'final' };
  const bars: WBar[] = [];
  bars.push({ name: 'Base', cumBefore: 0, cumAfter: baseRev, type: 'base' });

  const leverDefs = [
    { key: 'revenueGrowthPct' as keyof Scenario, label: 'Volume',  skip: active.revenueGrowthPct === 0 },
    { key: 'priceIncreasePct' as keyof Scenario, label: 'Price',   skip: active.priceIncreasePct === 0 },
    { key: 'newCustomers'     as keyof Scenario, label: '+Custs.', skip: active.newCustomers === 0 },
    { key: 'churnRatePct'     as keyof Scenario, label: 'Churn',   skip: active.churnRatePct === 0 },
  ];

  let running = baseRev;
  let partialSc: Scenario = { id: '', name: '', color: '', ...DEFAULT_SCENARIO, grossMarginPct: baseGM };

  for (const lev of leverDefs) {
    if (lev.skip) continue;
    const prevSc = { ...partialSc };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partialSc = { ...partialSc, [lev.key]: (active as any)[lev.key] };
    const prevR = project(base, prevSc).revenue;
    const nextR = project(base, partialSc).revenue;
    const d = nextR - prevR;
    if (Math.abs(d) < 1) continue;
    bars.push({ name: lev.label, cumBefore: running, cumAfter: running + d, type: d >= 0 ? 'up' : 'down' });
    running += d;
  }

  bars.push({ name: 'Final', cumBefore: 0, cumAfter: projected.revenue, type: 'final' });

  if (bars.length === 2) return null; // no revenue levers active

  const svgW = 500; const svgH = 140; const padL = 52; const padR = 8; const padT = 8; const padB = 28;
  const chartW = svgW - padL - padR; const chartH = svgH - padT - padB;
  const allY = bars.flatMap(b => [b.cumBefore, b.cumAfter, 0]);
  const rawMin = Math.min(...allY); const rawMax = Math.max(...allY);
  const yPad = (rawMax - rawMin) * 0.18 || 1;
  const domMin = rawMin - yPad; const domMax = rawMax + yPad;
  const toY = (v: number) => padT + (1 - (v - domMin) / (domMax - domMin)) * chartH;
  const slotW = chartW / bars.length;
  const barW = Math.min(38, slotW * 0.65);
  const bx = (i: number) => padL + i * slotW + (slotW - barW) / 2;
  const COLORS: Record<string, string> = { base: '#6366f1', up: 'rgba(16,185,129,0.78)', down: 'rgba(239,68,68,0.78)', final: projected.revenue >= baseRev ? '#10b981' : '#ef4444' };
  const ticks = [0.25, 0.5, 0.75].map(t => domMin + t * (domMax - domMin));

  return (
    <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={toY(v)} x2={svgW - padR} y2={toY(v)} stroke="#1e293b" strokeWidth="1"/>
          <text x={padL - 4} y={toY(v)} textAnchor="end" dominantBaseline="middle" fill="#475569" fontSize="8">{fmt(v)}</text>
        </g>
      ))}
      {bars.map((bar, i) => {
        const x = bx(i);
        const isAnchor = bar.type === 'base' || bar.type === 'final';
        const lo = isAnchor ? Math.min(0, bar.cumAfter) : Math.min(bar.cumBefore, bar.cumAfter);
        const hi = isAnchor ? Math.max(0, bar.cumAfter) : Math.max(bar.cumBefore, bar.cumAfter);
        const rectTop = toY(hi); const rectH = Math.max(1, Math.abs(toY(lo) - toY(hi)));
        const connY = toY(bar.cumAfter);
        const nextBar = bars[i + 1];
        const d = bar.cumAfter - bar.cumBefore;
        return (
          <g key={i}>
            {nextBar && bar.type !== 'final' && (
              <line x1={x + barW} y1={connY} x2={bx(i + 1)} y2={connY} stroke="#334155" strokeWidth="1" strokeDasharray="3,2"/>
            )}
            <rect x={x} y={rectTop} width={barW} height={rectH} fill={COLORS[bar.type]} rx={2}/>
            {rectH >= 14 && (
              <text x={x + barW / 2} y={rectTop + rectH / 2} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.9)" fontSize="8" fontWeight="600" fontFamily="monospace">
                {isAnchor ? fmt(bar.cumAfter) : `${d >= 0 ? '+' : ''}${fmt(d)}`}
              </text>
            )}
            <text x={x + barW / 2} y={svgH - padB + 10} textAnchor="middle" fill="#475569" fontSize="9">{bar.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Waterfall chart showing individual lever impact ───────────────────────────
function ImpactWaterfall({ base, projected, active }: {
  base: UnifiedBusinessData;
  projected: ReturnType<typeof project>;
  active: Scenario;
}) {
  const baseRev     = base.revenue.total;
  const baseGP      = baseRev - base.costs.totalCOGS;
  const baseGM      = baseRev > 0 ? (baseGP / baseRev) * 100 : 40;
  const baseEBITDA  = baseGP - base.costs.totalOpEx;

  type WBar = { name: string; cumBefore: number; cumAfter: number; type: 'base' | 'up' | 'down' | 'projected' };

  // Sequential lever list — apply one-by-one, accumulating scenario
  const leverDefs = [
    { key: 'revenueGrowthPct' as keyof Scenario, label: 'Volume',   skip: active.revenueGrowthPct === 0 },
    { key: 'priceIncreasePct' as keyof Scenario, label: 'Price',    skip: active.priceIncreasePct === 0 },
    { key: 'newCustomers'     as keyof Scenario, label: '+Custs.',  skip: active.newCustomers === 0 },
    { key: 'churnRatePct'     as keyof Scenario, label: 'Churn',    skip: active.churnRatePct === 0 },
    { key: 'grossMarginPct'   as keyof Scenario, label: 'Margin',   skip: Math.abs((active.grossMarginPct || baseGM) - baseGM) <= 0.5 },
    { key: 'opexChangePct'    as keyof Scenario, label: 'OpEx Δ',   skip: active.opexChangePct === 0 },
    { key: 'newHires'         as keyof Scenario, label: 'Hires',    skip: active.newHires === 0 },
    { key: 'oneTimeExpense'   as keyof Scenario, label: 'One-Time', skip: !active.oneTimeExpense },
  ];

  const bars: WBar[] = [];
  bars.push({ name: 'Base', cumBefore: 0, cumAfter: baseEBITDA, type: 'base' });

  let running = baseEBITDA;
  let partialSc: Scenario = { id: '', name: '', color: '', ...DEFAULT_SCENARIO, grossMarginPct: baseGM };

  for (const lev of leverDefs) {
    if (lev.skip) continue;
    const prevSc = { ...partialSc };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partialSc = { ...partialSc, [lev.key]: (active as any)[lev.key] };
    const prevE = project(base, prevSc).ebitda;
    const nextE = project(base, partialSc).ebitda;
    const d = nextE - prevE;
    if (Math.abs(d) < 1) continue;
    bars.push({ name: lev.label, cumBefore: running, cumAfter: running + d, type: d >= 0 ? 'up' : 'down' });
    running += d;
  }

  bars.push({ name: 'Final', cumBefore: 0, cumAfter: projected.ebitda, type: 'projected' });

  // SVG layout
  const svgW = 600;
  const svgH = 200;
  const padL = 58;
  const padR = 8;
  const padT = 10;
  const padB = 34;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const allY = bars.flatMap(b => [b.cumBefore, b.cumAfter, 0]);
  const rawMin = Math.min(...allY);
  const rawMax = Math.max(...allY);
  const yRange = rawMax - rawMin || 1;
  const yPad   = yRange * 0.18;
  const domMin = rawMin - yPad;
  const domMax = rawMax + yPad;

  const toY = (v: number) => padT + (1 - (v - domMin) / (domMax - domMin)) * chartH;
  const zeroY = toY(0);

  const n       = bars.length;
  const slotW   = chartW / n;
  const barW    = Math.min(44, slotW * 0.68);
  const bx      = (i: number) => padL + i * slotW + (slotW - barW) / 2;

  const COLORS = { base: '#6366f1', up: 'rgba(16,185,129,0.78)', down: 'rgba(239,68,68,0.78)', projected: projected.ebitda >= baseEBITDA ? '#10b981' : '#ef4444' };

  // Y-axis ticks
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => domMin + (i / tickCount) * (domMax - domMin));

  const noChanges = bars.length === 2; // only base + final, no levers

  return (
    <div className="relative w-full" style={{ height: svgH }}>
      {noChanges && (
        <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-600">
          Adjust levers to see the bridge
        </div>
      )}
      <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
        {/* Y-axis grid lines + labels */}
        {ticks.map((v, i) => {
          const py = toY(v);
          return (
            <g key={i}>
              <line x1={padL} y1={py} x2={svgW - padR} y2={py} stroke="#1e293b" strokeWidth="1"/>
              <text x={padL - 5} y={py} textAnchor="end" dominantBaseline="middle" fill="#475569" fontSize="9">
                {fmt(v)}
              </text>
            </g>
          );
        })}

        {/* Zero line (only when negative values exist) */}
        {domMin < 0 && domMax > 0 && (
          <line x1={padL} y1={zeroY} x2={svgW - padR} y2={zeroY} stroke="#334155" strokeWidth="1.5"/>
        )}

        {/* Bars + connectors */}
        {bars.map((bar, i) => {
          const x = bx(i);
          let rectTop: number, rectH: number;

          if (bar.type === 'base' || bar.type === 'projected') {
            // Anchored at zero
            const lo = Math.min(0, bar.cumAfter);
            const hi = Math.max(0, bar.cumAfter);
            rectTop = toY(hi);
            rectH   = Math.max(1, Math.abs(toY(lo) - toY(hi)));
          } else {
            // Floating between cumBefore and cumAfter
            const lo = Math.min(bar.cumBefore, bar.cumAfter);
            const hi = Math.max(bar.cumBefore, bar.cumAfter);
            rectTop = toY(hi);
            rectH   = Math.max(1, Math.abs(toY(lo) - toY(hi)));
          }

          // Connector dashed line from this bar's "after" level to next bar's start position
          const nextBar = bars[i + 1];
          const connectorY = (bar.type === 'base' || bar.type === 'projected') ? toY(bar.cumAfter) : toY(bar.cumAfter);
          const connectorLine = nextBar && bar.type !== 'projected' ? (
            <line
              x1={x + barW} y1={connectorY}
              x2={bx(i + 1)} y2={connectorY}
              stroke="#334155" strokeWidth="1" strokeDasharray="3,2"
            />
          ) : null;

          // Delta label — inside bar if tall enough, above otherwise
          const d = bar.cumAfter - bar.cumBefore;
          const label = bar.type === 'base' || bar.type === 'projected' ? fmt(bar.cumAfter) : `${d >= 0 ? '+' : ''}${fmt(d)}`;
          const labelInside = rectH >= 18;
          const labelY = labelInside ? rectTop + rectH / 2 : (bar.type === 'down' ? rectTop + rectH + 11 : rectTop - 5);

          return (
            <g key={i}>
              {connectorLine}
              <rect x={x} y={rectTop} width={barW} height={rectH} fill={COLORS[bar.type]} rx={2}/>
              {/* Value label */}
              <text
                x={x + barW / 2} y={labelY}
                textAnchor="middle" dominantBaseline={labelInside ? 'middle' : 'auto'}
                fill={labelInside ? 'rgba(255,255,255,0.9)' : (bar.type === 'up' || bar.type === 'projected' && projected.ebitda >= baseEBITDA ? '#6ee7b7' : bar.type === 'down' ? '#fca5a5' : '#e2e8f0')}
                fontSize="8.5" fontWeight="600" fontFamily="monospace"
              >
                {label}
              </text>
              {/* X-axis bar name */}
              <text x={x + barW / 2} y={svgH - padB + 11} textAnchor="middle" fill="#475569" fontSize="9.5">
                {bar.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Scenario Card (saved) ─────────────────────────────────────────────────────
function ScenarioCard({
  scenario, proj, base, isActive, onClick, onDelete,
}: {
  scenario: Scenario;
  proj: ReturnType<typeof project>;
  base: UnifiedBusinessData;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const baseEBITDA = base.revenue.total - base.costs.totalCOGS - base.costs.totalOpEx;
  const ebitdaDelta = proj.ebitda - baseEBITDA;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className={`relative text-left p-4 rounded-xl border transition-all group cursor-pointer ${
        isActive
          ? 'bg-indigo-500/10 border-indigo-500/40'
          : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700'
      }`}>
      <button onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-700 hover:text-red-400 text-xs w-5 h-5 flex items-center justify-center rounded">
        &times;
      </button>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: scenario.color }}/>
        <div className="text-[12px] font-semibold text-slate-100 truncate pr-4">{scenario.name}</div>
      </div>
      <div className="text-[11px] text-slate-400 mb-1">{fmt(proj.revenue, true)} rev</div>
      <div className={`text-[13px] font-bold ${ebitdaDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {delta(ebitdaDelta)} EBITDA
      </div>
      <div className="text-[10px] text-slate-600 mt-0.5">{proj.ebitdaMargin.toFixed(1)}% margin</div>
      {scenario.notes && (
        <div className="text-[10px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-800/60 line-clamp-2 italic">{scenario.notes}</div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ScenarioModeler({ data, onAskAI, onScenarioChange }: Props) {
  const baseRev      = data.revenue.total;
  const baseCOGS     = data.costs.totalCOGS;
  const baseOpEx     = data.costs.totalOpEx;
  const baseGP       = baseRev - baseCOGS;
  const baseEBITDA   = baseGP - baseOpEx;
  const baseGM       = baseRev > 0 ? (baseGP / baseRev) * 100 : 40;

  // Current cash on hand — from last cashflow period's closing balance
  const currentCash = (() => {
    const cf = data.cashFlow ?? [];
    if (cf.length === 0) return 0;
    return cf[cf.length - 1].closingBalance;
  })();

  // Given projected EBITDA and cash on hand, returns months of runway (null = infinite/profitable)
  const calcRunway = (projEBITDA: number): number | null => {
    if (projEBITDA >= 0 || currentCash <= 0) return null;
    return currentCash / (-projEBITDA / 12);
  };
  const fmtRunway = (mo: number | null) =>
    mo === null ? '∞' : mo >= 120 ? '10+ yr' : mo >= 24 ? `${(mo / 12).toFixed(1)} yr` : `${Math.round(mo)} mo`;

  const [active, setActive] = useState<Scenario>({
    id: 'current', name: 'New Scenario',
    color: SCENARIO_COLORS[0],
    ...DEFAULT_SCENARIO,
    grossMarginPct: baseGM,
  });

  const [saved, setSaved]         = useState<Scenario[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const s = localStorage.getItem('bos_scenarios');
      if (s) return JSON.parse(s) as Scenario[];
    } catch { /* ignore */ }
    return [];
  });
  const [nameInput, setNameInput] = useState('');
  const [showSave, setShowSave]   = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [targetMargin, setTargetMargin] = useState(0); // 0 = disabled
  // SBA Acquisition Calculator state
  const [sbaMultiple,      setSbaMultiple]      = useState(5);
  const [sbaDownPct,       setSbaDownPct]       = useState(20);
  const [sbAInterestRate,  setSbAInterestRate]  = useState(7.5);
  const [sbaTerm,          setSbaTerm]          = useState(10);
  // Opt/Base/Pes range mode
  const [opbpMode, setOpbpMode] = useState(false);
  // Probability weights for saved scenarios (id → 0-100)
  const [probs, setProbs] = useState<Record<string, number>>({});
  // Customer economics
  const [cac, setCac] = useState(0);
  // Net income bridge
  const [daEstimate, setDaEstimate]   = useState(0);
  const [interestExp, setInterestExp] = useState(0);
  const [taxRate, setTaxRate]         = useState(25);
  // Existing debt service DSCR
  const [existingDebtSvc, setExistingDebtSvc] = useState(0);
  // Concentration risk
  const [concPct, setConcPct] = useState(0);
  // Save modal notes
  const [notesInput, setNotesInput] = useState('');
  // Share link
  const [linkCopied, setLinkCopied] = useState(false);

  const proj = project(data, active);

  const set = useCallback((key: keyof Scenario, val: number) => {
    setActive(prev => {
      const next = { ...prev, [key]: val };
      onScenarioChange?.({
        name: next.name,
        revenueGrowthPct: next.revenueGrowthPct,
        grossMarginPct:   next.grossMarginPct,
        opexChangePct:    next.opexChangePct,
        newHires:         next.newHires,
        avgCompK:         next.avgCompK,
        priceIncreasePct: next.priceIncreasePct,
        newCustomers:     next.newCustomers,
        churnRatePct:     next.churnRatePct,
        oneTimeExpense:   next.oneTimeExpense,
      });
      return next;
    });
  }, [onScenarioChange]);

  // Persist saved scenarios
  useEffect(() => {
    try { localStorage.setItem('bos_scenarios', JSON.stringify(saved)); } catch { /* ignore */ }
  }, [saved]);

  const saveScenario = () => {
    const name = nameInput.trim() || `Scenario ${saved.length + 1}`;
    const scenario: Scenario = { ...active, id: `s-${Date.now()}`, name, color: SCENARIO_COLORS[saved.length % SCENARIO_COLORS.length], notes: notesInput.trim() || undefined };
    setSaved(prev => [...prev, scenario]);
    setShowSave(false);
    setNameInput('');
    setNotesInput('');
  };

  const copyLink = async () => {
    if (typeof window === 'undefined') return;
    const payload = { revenueGrowthPct: active.revenueGrowthPct, grossMarginPct: active.grossMarginPct, opexChangePct: active.opexChangePct, newHires: active.newHires, avgCompK: active.avgCompK, priceIncreasePct: active.priceIncreasePct, newCustomers: active.newCustomers, churnRatePct: active.churnRatePct, oneTimeExpense: active.oneTimeExpense, name: active.name };
    const encoded = btoa(JSON.stringify(payload));
    const url = `${window.location.origin}${window.location.pathname}?scenario=${encoded}`;
    try { await navigator.clipboard.writeText(url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); } catch { /* ignore */ }
  };

  // Load scenario from URL param on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('scenario');
    if (!encoded) return;
    try {
      const decoded = JSON.parse(atob(encoded));
      setActive(prev => ({ ...prev, ...decoded }));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScenario = (s: Scenario) => {
    setActive({ ...s });
  };

  const deleteScenario = (id: string) => {
    setSaved(prev => prev.filter(s => s.id !== id));
  };

  const resetLevers = () => {
    setActive(prev => ({ ...prev, ...DEFAULT_SCENARIO, grossMarginPct: baseGM }));
  };

  const [copied, setCopied] = useState(false);
  const copyScenario = async () => {
    const lines = [
      `SCENARIO: ${active.name}`,
      `Revenue: ${fmt(proj.revenue, true)} (${proj.dRevenue >= 0 ? '+' : ''}${fmt(proj.dRevenue, true)} vs base)`,
      `Gross Margin: ${proj.gmPct.toFixed(1)}%`,
      `OpEx: ${fmt(proj.opex, true)}`,
      `EBITDA: ${fmt(proj.ebitda, true)} (${proj.ebitdaMargin.toFixed(1)}% margin)`,
      active.newHires ? `New Hires: ${active.newHires} @ $${active.avgCompK}k avg` : '',
      active.priceIncreasePct ? `Price increase: ${active.priceIncreasePct}%` : '',
      active.newCustomers ? `New Customers: +${active.newCustomers} (${fmt(proj.newCustomerRevenue, true)} rev)` : '',
      active.churnRatePct ? `Additional Churn: +${active.churnRatePct}% (${fmt(proj.churnRevLost, true)} lost)` : '',
      active.oneTimeExpense ? `One-Time Expense: ${fmt(active.oneTimeExpense, true)}` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const hasChanges = active.revenueGrowthPct !== 0 || active.opexChangePct !== 0 ||
    active.newHires !== 0 || active.priceIncreasePct !== 0 || active.newCustomers !== 0 ||
    active.churnRatePct !== 0 || active.oneTimeExpense !== 0 ||
    Math.abs(active.grossMarginPct - baseGM) > 0.5;

  const ebitdaChange = proj.ebitda - baseEBITDA;
  const ebitdaChangePct = baseEBITDA !== 0 ? (ebitdaChange / Math.abs(baseEBITDA)) * 100 : 0;

  // Rule of 40: revenue growth % (vs base) + EBITDA margin %
  const revGrowthPctVsBase = baseRev > 0 ? (proj.dRevenue / baseRev) * 100 : 0;
  const rule40 = revGrowthPctVsBase + proj.ebitdaMargin;

  // Burn multiple: |EBITDA burn| / net new revenue (only meaningful when losing money but growing)
  const burnMultiple = proj.ebitda < 0 && proj.dRevenue > 0
    ? Math.abs(proj.ebitda) / proj.dRevenue
    : null;

  // Customer economics
  const customerCount       = data.customers.totalCount || 1;
  const avgRevPerCustomer   = baseRev / customerCount;
  const baseAnnualChurnEst  = 0.10; // assume 10% base annual churn
  const effectiveChurn      = Math.max(0.01, baseAnnualChurnEst + active.churnRatePct / 100);
  const ltv                 = cac > 0 || true ? (avgRevPerCustomer * proj.gmPct / 100) / effectiveChurn : 0;
  const ltvCac              = cac > 0 ? ltv / cac : null;
  const cacPaybackMo        = cac > 0 && avgRevPerCustomer > 0 ? Math.ceil(cac / (avgRevPerCustomer * proj.gmPct / 100 / 12)) : null;

  // Net income bridge
  const projEBIT        = proj.ebitda - daEstimate;
  const projEBT         = projEBIT - interestExp;
  const projNetIncome   = projEBT > 0 ? projEBT * (1 - taxRate / 100) : projEBT;

  // Concentration risk
  const concRevLost     = concPct > 0 ? proj.revenue * (concPct / 100) : 0;
  const concGPLost      = concRevLost * (proj.gmPct / 100);
  const concEBITDA      = proj.ebitda - concGPLost;

  // Existing debt DSCR
  const existingDSCR    = existingDebtSvc > 0 ? proj.ebitda / existingDebtSvc : null;

  // Optimistic / Pessimistic lever scaling
  const makeVariant = (s: Scenario, mult: number): Scenario => {
    const gmDelta = s.grossMarginPct > 0 ? (s.grossMarginPct - baseGM) * mult : 0;
    return {
      ...s,
      revenueGrowthPct: s.revenueGrowthPct * mult,
      priceIncreasePct: s.priceIncreasePct * mult,
      newCustomers:     Math.round(s.newCustomers * mult),
      churnRatePct:     Math.max(0, s.churnRatePct / mult),   // less churn = optimistic
      grossMarginPct:   s.grossMarginPct > 0 ? Math.min(80, Math.max(10, baseGM + gmDelta)) : s.grossMarginPct,
      opexChangePct:    s.opexChangePct <= 0 ? s.opexChangePct * mult : s.opexChangePct / mult,
      oneTimeExpense:   Math.max(0, s.oneTimeExpense / mult),  // less one-time = optimistic
    };
  };
  const projOpt = project(data, makeVariant(active, 1.5));
  const projPes = project(data, makeVariant(active, 0.5));

  // Quick scenario presets
  // Presets start from DEFAULT_SCENARIO so no stale lever values bleed through
  const PRESET_BASE = { ...DEFAULT_SCENARIO, grossMarginPct: baseGM };
  const PRESETS = [
    { label: '🚀 +20% Revenue',     apply: () => setActive(p => ({ ...p, ...PRESET_BASE, revenueGrowthPct: 20, opexChangePct: 5 })) },
    { label: '✂️ Cut OpEx 15%',     apply: () => setActive(p => ({ ...p, ...PRESET_BASE, opexChangePct: -15 })) },
    { label: '📈 Raise Prices 10%', apply: () => setActive(p => ({ ...p, ...PRESET_BASE, priceIncreasePct: 10 })) },
    { label: '👥 Hire 5 People',    apply: () => setActive(p => ({ ...p, ...PRESET_BASE, newHires: 5, avgCompK: 100 })) },
    { label: '💰 Expand Margins',   apply: () => setActive(p => ({ ...p, ...PRESET_BASE, grossMarginPct: Math.min(baseGM + 5, 80) })) },
    { label: '📉 Recession -25%',   apply: () => setActive(p => ({ ...p, ...PRESET_BASE, revenueGrowthPct: -25, opexChangePct: -10, churnRatePct: 15 })) },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Scenario Modeling</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Adjust levers to model your P&L under different assumptions</div>
        </div>
        <div className="flex items-center gap-2">
          {saved.length > 1 && (
            <button onClick={() => setCompareMode(v => !v)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all ${
                compareMode ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' : 'text-slate-400 border-slate-700/60 hover:border-slate-600'}`}>
              {compareMode ? '✓ Comparing' : 'Compare Saved'}
            </button>
          )}
          {hasChanges && (
            <button onClick={() => setOpbpMode(v => !v)}
              className={`text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all ${
                opbpMode ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'text-slate-400 border-slate-700/60 hover:border-slate-600'}`}>
              {opbpMode ? '✓ O/B/P' : 'Opt / Base / Pes'}
            </button>
          )}
          {hasChanges && (
            <button onClick={() => setShowSave(true)}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all">
              Save Scenario
            </button>
          )}
          {hasChanges && onAskAI && (
            <button onClick={() => onAskAI(
              `Based on my business data — Revenue: ${fmt(baseRev)}, EBITDA: ${fmt(baseEBITDA)} (${(baseRev > 0 ? baseEBITDA/baseRev*100 : 0).toFixed(1)}% margin), Gross Margin: ${baseGM.toFixed(1)}%, ${customerCount} customers — suggest 3 specific, named scenarios I should model. For each scenario, provide exact lever values: revenueGrowthPct, priceIncreasePct, opexChangePct, newHires, churnRatePct, grossMarginPct. Format as a brief table with rationale. Make the scenarios meaningfully different: one conservative, one growth-oriented, one defensive/cost-cut.`
            )}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg border text-violet-400 border-violet-500/30 bg-violet-500/8 hover:bg-violet-500/15 transition-all">
              Suggest Scenarios
            </button>
          )}
          {hasChanges && (
            <button onClick={copyLink}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg border text-slate-400 border-slate-700/60 hover:border-slate-600 transition-all">
              {linkCopied ? '✓ Link Copied' : '⎘ Share Link'}
            </button>
          )}
          {hasChanges && (
            <button onClick={resetLevers}
              className="text-[12px] text-slate-500 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Quick presets */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] flex-shrink-0">Quick preset:</span>
        {PRESETS.map(p => (
          <button key={p.label} onClick={p.apply}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-100 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap">
            {p.label}
          </button>
        ))}
      </div>

      {/* Saved scenarios */}
      {saved.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {saved.map(s => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              proj={project(data, s)}
              base={data}
              isActive={active.id === s.id}
              onClick={() => loadScenario(s)}
              onDelete={() => setSaved(prev => prev.filter(sc => sc.id !== s.id))}
            />
          ))}
        </div>
      )}

      {/* Main modeling area */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">

        {/* ── Left: Levers ── */}
        <div className="space-y-5">
          {/* Revenue levers */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="text-[11px] font-semibold text-indigo-400/80 uppercase tracking-[0.1em] mb-4">Revenue Levers</div>
            <div className="space-y-5">
              <Lever
                label="Volume Growth"
                hint="% change in customers/units"
                value={active.revenueGrowthPct}
                min={-50} max={100} step={1}
                format={v => `${v >= 0 ? '+' : ''}${v}%`}
                accentColor="text-indigo-400"
                onChange={v => set('revenueGrowthPct', v)}
              />
              <Lever
                label="Price / Rate Increase"
                hint="applied on top of volume"
                value={active.priceIncreasePct}
                min={-20} max={30} step={0.5}
                format={v => `${v >= 0 ? '+' : ''}${v}%`}
                accentColor="text-sky-400"
                onChange={v => set('priceIncreasePct', v)}
              />
              <Lever
                label="New Customers"
                hint="incremental accounts added"
                value={active.newCustomers}
                min={0} max={50} step={1}
                format={v => `+${v}`}
                accentColor="text-violet-400"
                onChange={v => set('newCustomers', v)}
              />
              <Lever
                label="Additional Churn"
                hint="extra % of customers lost vs baseline"
                value={active.churnRatePct}
                min={0} max={50} step={1}
                format={v => `+${v}%`}
                accentColor="text-red-400"
                onChange={v => set('churnRatePct', v)}
              />
            </div>
          </div>

          {/* Cost levers */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-[0.1em] mb-4">Cost Levers</div>
            <div className="space-y-5">
              <Lever
                label="Target Gross Margin"
                hint="adjust delivery/service efficiency"
                value={active.grossMarginPct}
                min={10} max={80} step={0.5}
                format={v => `${v.toFixed(1)}%`}
                accentColor="text-emerald-400"
                onChange={v => set('grossMarginPct', v)}
              />
              <Lever
                label="OpEx Change"
                hint="overhead, software, marketing"
                value={active.opexChangePct}
                min={-40} max={60} step={1}
                format={v => `${v >= 0 ? '+' : ''}${v}%`}
                accentColor="text-amber-400"
                onChange={v => set('opexChangePct', v)}
              />
              <Lever
                label="One-Time Expense"
                hint="below-the-line hit (legal, capex, etc.)"
                value={active.oneTimeExpense}
                min={0} max={500_000} step={5_000}
                format={v => v === 0 ? '$0' : fmt(v)}
                accentColor="text-orange-400"
                onChange={v => set('oneTimeExpense', v)}
              />
            </div>
          </div>

          {/* Headcount levers */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="text-[11px] font-semibold text-pink-400/80 uppercase tracking-[0.1em] mb-4">Headcount</div>
            <div className="space-y-5">
              <Lever
                label="New Hires"
                hint="net headcount change"
                value={active.newHires}
                min={-10} max={20} step={1}
                format={v => `${v >= 0 ? '+' : ''}${v} FTE`}
                accentColor="text-pink-400"
                onChange={v => set('newHires', v)}
              />
              {active.newHires > 0 && (
                <Lever
                  label="Avg Annual Comp"
                  hint="fully-loaded cost per hire"
                  value={active.avgCompK}
                  min={40} max={250} step={5}
                  format={v => `$${v}k`}
                  accentColor="text-pink-400"
                  onChange={v => set('avgCompK', v)}
                />
              )}
              {active.newHires > 0 && (() => {
                const hireCostAnnual = active.newHires * active.avgCompK * 1000;
                // Break-even revenue per hire: salary / GM% = revenue needed to cover cost
                const breakEvenRevPerHire = active.avgCompK * 1000 / Math.max(0.01, proj.gmPct / 100);
                // Payback: months of incremental revenue to cover hire cost
                const incRevPerHire = proj.dRevenue / active.newHires;
                const paybackMo = incRevPerHire > 0
                  ? Math.ceil((breakEvenRevPerHire) / (incRevPerHire / 12))
                  : null;
                return (
                  <div className="pt-3 mt-1 border-t border-slate-800/40 grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <div className="text-[10px] text-slate-500 mb-0.5">Total Hire Cost</div>
                      <div className="text-[13px] font-bold text-pink-400">{fmt(hireCostAnnual)}<span className="text-[10px] text-slate-500 font-normal">/yr</span></div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 mb-0.5">Break-Even Rev / Hire</div>
                      <div className="text-[13px] font-bold text-slate-200">{fmt(breakEvenRevPerHire)}</div>
                    </div>
                    {paybackMo !== null ? (
                      <div className="col-span-2">
                        <div className="text-[10px] text-slate-500 mb-0.5">Payback Period</div>
                        <div className={`text-[13px] font-bold ${paybackMo <= 12 ? 'text-emerald-400' : paybackMo <= 24 ? 'text-amber-400' : 'text-red-400'}`}>
                          {paybackMo} mo
                        </div>
                      </div>
                    ) : (
                      <div className="col-span-2 text-[10px] text-slate-600">No incremental revenue modeled — hires are pure cost drag</div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ── Right: Output ── */}
        <div className="space-y-4">

          {/* P&L summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { label: 'Revenue',      base: baseRev,    proj: proj.revenue,     d: proj.dRevenue,   color: 'text-slate-100' },
              { label: 'Gross Profit', base: baseGP,     proj: proj.grossProfit, d: proj.dGP,        color: proj.grossProfit >= baseGP ? 'text-emerald-400' : 'text-red-400' },
              { label: 'GM %',         base: baseGM,     proj: proj.gmPct,       d: proj.gmPct - baseGM, color: proj.gmPct >= baseGM ? 'text-emerald-400' : 'text-red-400', isPct: true },
              { label: 'OpEx',         base: baseOpEx,   proj: proj.opex,        d: proj.dOpEx,      color: proj.dOpEx <= 0 ? 'text-emerald-400' : 'text-amber-400', inverted: true },
              { label: 'EBITDA',       base: baseEBITDA, proj: proj.ebitda,      d: ebitdaChange,    color: proj.ebitda >= baseEBITDA ? 'text-emerald-400' : 'text-red-400' },
            ].map(m => (
              <div key={m.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1.5">{m.label}</div>
                <div className={`text-[17px] font-bold tracking-tight ${m.color}`}>
                  {m.isPct ? `${m.proj.toFixed(1)}%` : fmt(m.proj, true)}
                </div>
                <div className="text-[10px] text-slate-600 mt-1">{m.isPct ? `base ${m.base.toFixed(1)}%` : `base ${fmt(m.base, true)}`}</div>
                {m.d !== 0 && (
                  <div className={`text-[10px] font-semibold mt-0.5 ${
                    m.inverted
                      ? (m.d <= 0 ? 'text-emerald-400/70' : 'text-red-400/70')
                      : (m.d >= 0 ? 'text-emerald-400/70' : 'text-red-400/70')
                  }`}>
                    {m.isPct ? pct(m.d) : delta(m.d)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Opt / Base / Pes range strip */}
          {opbpMode && hasChanges && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800/50 flex items-center gap-3">
                <span className="text-[11px] font-semibold text-violet-300">Scenario Range</span>
                <span className="text-[10px] text-slate-600">Pessimistic (levers ×0.5) · Base · Optimistic (levers ×1.5)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr className="border-b border-slate-800/40">
                      <th className="px-4 py-2 text-left text-[10px] text-slate-600 font-semibold uppercase tracking-wide">Metric</th>
                      <th className="px-4 py-2 text-right text-[10px] text-red-400/80 font-semibold uppercase tracking-wide">Pessimistic</th>
                      <th className="px-4 py-2 text-right text-[10px] text-slate-300 font-semibold uppercase tracking-wide">Base</th>
                      <th className="px-4 py-2 text-right text-[10px] text-emerald-400/80 font-semibold uppercase tracking-wide">Optimistic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Revenue',     pes: projPes.revenue,       base: proj.revenue,       opt: projOpt.revenue,       fn: fmt },
                      { label: 'Gross Profit',pes: projPes.grossProfit,   base: proj.grossProfit,   opt: projOpt.grossProfit,   fn: fmt },
                      { label: 'EBITDA',      pes: projPes.ebitda,        base: proj.ebitda,        opt: projOpt.ebitda,        fn: fmt, bold: true },
                      { label: 'EBITDA %',    pes: projPes.ebitdaMargin,  base: proj.ebitdaMargin,  opt: projOpt.ebitdaMargin,  isPct: true, bold: true },
                      { label: 'EV @ 5.5×',  pes: projPes.ebitda * 5.5,  base: proj.ebitda * 5.5,  opt: projOpt.ebitda * 5.5,  fn: fmt },
                    ].map(row => (
                      <tr key={row.label} className="border-b border-slate-800/30">
                        <td className={`px-4 py-2 text-[12px] ${row.bold ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>{row.label}</td>
                        <td className={`px-4 py-2 text-right text-[12px] font-medium tabular-nums ${row.pes < row.base ? 'text-red-400' : 'text-slate-400'}`}>
                          {row.isPct ? `${row.pes.toFixed(1)}%` : fmt(row.pes)}
                        </td>
                        <td className="px-4 py-2 text-right text-[12px] font-semibold tabular-nums text-slate-100">
                          {row.isPct ? `${row.base.toFixed(1)}%` : fmt(row.base)}
                        </td>
                        <td className={`px-4 py-2 text-right text-[12px] font-medium tabular-nums ${row.opt > row.base ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {row.isPct ? `${row.opt.toFixed(1)}%` : fmt(row.opt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EBITDA impact gauge */}
          <div className={`border rounded-xl p-5 ${
            ebitdaChange > 0 ? 'bg-emerald-500/5 border-emerald-500/20' :
            ebitdaChange < 0 ? 'bg-red-500/5 border-red-500/20' :
                               'bg-slate-900/50 border-slate-800/50'
          }`}>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">EBITDA Impact</div>
                <div className={`text-[28px] font-bold tracking-tight ${ebitdaChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {delta(ebitdaChange)}
                </div>
                <div className={`text-[13px] font-medium mt-1 ${ebitdaChangePct >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                  {pct(ebitdaChangePct)} vs base · {proj.ebitdaMargin.toFixed(1)}% margin
                </div>
                {/* Rule of 40 */}
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                    rule40 >= 40 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                    rule40 >= 20 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                   'text-red-400 bg-red-500/10 border-red-500/20'
                  }`}>R40: {rule40.toFixed(0)}</span>
                  <span className="text-[10px] text-slate-600">
                    {revGrowthPctVsBase.toFixed(1)}% growth + {proj.ebitdaMargin.toFixed(1)}% margin
                  </span>
                </div>
                {/* Burn multiple */}
                {burnMultiple !== null && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      burnMultiple <= 1 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                      burnMultiple <= 2 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                          'text-red-400 bg-red-500/10 border-red-500/20'
                    }`}>Burn {burnMultiple.toFixed(1)}×</span>
                    <span className="text-[10px] text-slate-600">burn ÷ net new revenue</span>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="text-right">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Break-Even Revenue</div>
                  <div className="text-[18px] font-bold text-slate-200">{fmt(proj.breakEven, true)}</div>
                  <div className={`text-[11px] mt-1 ${proj.revenue >= proj.breakEven ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                    {proj.revenue >= proj.breakEven
                      ? `${fmt(proj.revenue - proj.breakEven, true)} above`
                      : `${fmt(proj.breakEven - proj.revenue, true)} below`}
                  </div>
                </div>
                {currentCash > 0 && (() => {
                  const runwayMo = calcRunway(proj.ebitda);
                  const runwayOk = runwayMo === null || runwayMo >= 12;
                  return (
                    <div className="text-right border-l border-slate-700/40 pl-4">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Cash Runway</div>
                      <div className={`text-[18px] font-bold ${runwayOk ? (runwayMo === null ? 'text-slate-200' : 'text-emerald-400') : 'text-red-400'}`}>
                        {fmtRunway(runwayMo)}
                      </div>
                      <div className="text-[11px] mt-1 text-slate-500">{fmt(currentCash)} on hand</div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={copyScenario}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 font-medium border border-slate-700/50 hover:border-slate-600 px-3 py-2 rounded-lg transition-all">
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
                {onAskAI && (
                  <button onClick={() => onAskAI(
                    `Scenario analysis — ${active.name}:\n` +
                    `Revenue: ${fmt(proj.revenue)} (${delta(proj.dRevenue)} vs base)\n` +
                    `Gross Margin: ${proj.gmPct.toFixed(1)}% | OpEx: ${fmt(proj.opex)} (${delta(proj.dOpEx)})\n` +
                    `EBITDA: ${fmt(proj.ebitda)} (${proj.ebitdaMargin.toFixed(1)}% margin, ${delta(ebitdaChange)} vs base)\n` +
                    `Rule of 40: ${rule40.toFixed(0)} | Break-even: ${fmt(proj.breakEven)}\n` +
                    (burnMultiple !== null ? `Burn multiple: ${burnMultiple.toFixed(1)}×\n` : '') +
                    (active.newHires > 0 ? `New hires: ${active.newHires} @ $${active.avgCompK}k avg ($${active.newHires * active.avgCompK}k/yr total)\n` : '') +
                    `\nIs this scenario realistic? What are the key risks, and which lever should I prioritize to improve EBITDA most efficiently?`
                  )}
                    className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/25 hover:border-indigo-500/50 bg-indigo-500/8 hover:bg-indigo-500/15 px-3 py-2 rounded-lg transition-all">
                    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
                    Ask AI
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Goal Calculator */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[12px] font-semibold text-slate-300">Goal Calculator</div>
              <div className="text-[11px] text-slate-500">What revenue do I need to hit a target margin?</div>
            </div>
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <span className="text-[12px] text-slate-400">Target EBITDA margin:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[10, 15, 20, 25, 30].map(t => (
                  <button key={t} onClick={() => setTargetMargin(targetMargin === t ? 0 : t)}
                    className={`text-[12px] font-semibold px-3 py-1 rounded-lg border transition-all ${
                      targetMargin === t
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                    }`}>
                    {t}%
                  </button>
                ))}
              </div>
            </div>
            {targetMargin > 0 && (() => {
              const gmFrac = proj.gmPct / 100;
              const targetFrac = targetMargin / 100;
              const feasible = gmFrac > targetFrac;
              // EBITDA = Rev × gmFrac - OpEx = Rev × targetFrac
              // Rev × (gmFrac - targetFrac) = OpEx
              const requiredRev  = feasible ? proj.opex / (gmFrac - targetFrac) : null;
              const requiredDelta = requiredRev !== null ? requiredRev - baseRev : null;
              const currentMargin = proj.revenue > 0 ? (proj.ebitda / proj.revenue) * 100 : 0;
              const isAlreadyMet  = currentMargin >= targetMargin;

              return (
                <div className={`rounded-xl p-4 border ${
                  isAlreadyMet ? 'bg-emerald-500/6 border-emerald-500/20' :
                  !feasible    ? 'bg-red-500/6 border-red-500/20' :
                                  'bg-indigo-500/6 border-indigo-500/20'
                }`}>
                  {isAlreadyMet ? (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <span className="text-lg">✓</span>
                      <span className="text-[13px] font-semibold">
                        Current scenario already hits {targetMargin}% margin ({currentMargin.toFixed(1)}% projected)
                      </span>
                    </div>
                  ) : !feasible ? (
                    <div className="flex items-start gap-2 text-red-400">
                      <span className="text-lg flex-shrink-0">⚠</span>
                      <div>
                        <div className="text-[13px] font-semibold">Not achievable at current gross margin</div>
                        <div className="text-[11px] text-red-400/70 mt-0.5">
                          Gross margin ({proj.gmPct.toFixed(1)}%) must exceed target EBITDA margin ({targetMargin}%).
                          Improve GM first before this scenario can hit {targetMargin}%.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Required Revenue</div>
                        <div className="text-[18px] font-bold text-indigo-300">{fmt(requiredRev!, true)}</div>
                        <div className={`text-[11px] mt-0.5 font-medium ${requiredDelta! >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {requiredDelta! >= 0 ? '+' : ''}{fmt(requiredDelta!, true)} vs current
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Required Growth</div>
                        <div className="text-[18px] font-bold text-slate-200">
                          {baseRev > 0 ? `${(((requiredRev! - baseRev) / baseRev) * 100).toFixed(1)}%` : '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">from base revenue</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Implied EBITDA</div>
                        <div className="text-[18px] font-bold text-emerald-400">
                          {fmt(requiredRev! * targetFrac, true)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">at {targetMargin}% margin</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── Break-Even Analysis (table) ── */}
          {(() => {
            const gap = proj.revenue - proj.breakEven;
            const safetyMargin = proj.breakEven > 0 ? (gap / proj.breakEven) * 100 : 0;
            const aboveBreakEven = proj.revenue >= proj.breakEven;
            return (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-slate-300">Break-Even Analysis</div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${aboveBreakEven ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                    {aboveBreakEven ? `${fmt(gap)} above` : `${fmt(Math.abs(gap))} below`}
                  </span>
                </div>
                <div className="divide-y divide-slate-800/40">
                  {[
                    { label: 'Break-Even Revenue',  value: fmt(proj.breakEven),          sub: `GM% ${proj.gmPct.toFixed(1)}% covering fixed costs`,   color: 'text-amber-400' },
                    { label: 'Projected Revenue',   value: fmt(proj.revenue),             sub: hasChanges ? `${delta(proj.dRevenue)} vs base` : 'current base', color: 'text-slate-100' },
                    { label: 'Safety Margin',       value: `${safetyMargin.toFixed(1)}%`, sub: aboveBreakEven ? 'revenue could fall before loss' : 'revenue needed to break even', color: aboveBreakEven ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'Fixed Costs (OpEx)',  value: fmt(proj.opex),                sub: 'operating expenses driving break-even',                  color: 'text-slate-300' },
                    { label: 'Gross Margin',        value: `${proj.gmPct.toFixed(1)}%`,   sub: `${fmt(proj.grossProfit)} gross profit on ${fmt(proj.revenue)} revenue`, color: 'text-slate-300' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between px-5 py-2.5">
                      <div>
                        <div className="text-[12px] font-medium text-slate-400">{row.label}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">{row.sub}</div>
                      </div>
                      <div className={`text-[13px] font-bold tabular-nums ${row.color}`}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Customer Economics ── */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="text-[11px] font-semibold text-cyan-400/80 uppercase tracking-[0.1em] mb-4">Customer Economics</div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">Avg Rev / Customer</div>
                  <div className="text-[13px] font-bold text-slate-200">{fmt(avgRevPerCustomer)}<span className="text-[10px] text-slate-500 font-normal">/yr</span></div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">LTV (at {effectiveChurn*100 < 1 ? (effectiveChurn*100).toFixed(1) : Math.round(effectiveChurn*100)}% churn)</div>
                  <div className="text-[13px] font-bold text-cyan-400">{fmt(ltv)}</div>
                </div>
              </div>
              <Lever
                label="CAC (Cost to Acquire)"
                hint="fully-loaded customer acquisition cost"
                value={cac}
                min={0} max={50_000} step={500}
                format={v => v === 0 ? '$0' : fmt(v)}
                accentColor="text-cyan-400"
                onChange={setCac}
              />
              {cac > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">LTV : CAC</div>
                    <div className={`text-[15px] font-bold ${ltvCac! >= 3 ? 'text-emerald-400' : ltvCac! >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
                      {ltvCac!.toFixed(1)}×
                    </div>
                    <div className="text-[9px] text-slate-600 mt-0.5">target ≥ 3×</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">CAC Payback</div>
                    <div className={`text-[15px] font-bold ${cacPaybackMo! <= 12 ? 'text-emerald-400' : cacPaybackMo! <= 24 ? 'text-amber-400' : 'text-red-400'}`}>
                      {cacPaybackMo} mo
                    </div>
                    <div className="text-[9px] text-slate-600 mt-0.5">target &lt; 12 mo</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Concentration Risk ── */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="text-[11px] font-semibold text-orange-400/80 uppercase tracking-[0.1em] mb-4">Concentration Risk</div>
            <Lever
              label="Top Customer % of Revenue"
              hint="what if this customer churns?"
              value={concPct}
              min={0} max={80} step={5}
              format={v => v === 0 ? 'None set' : `${v}%`}
              accentColor="text-orange-400"
              onChange={setConcPct}
            />
            {concPct > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">Revenue at Risk</div>
                  <div className="text-[13px] font-bold text-orange-400">{fmt(concRevLost)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">EBITDA if Lost</div>
                  <div className={`text-[13px] font-bold ${concEBITDA >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(concEBITDA)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-slate-500 mb-0.5">Resulting EBITDA Margin</div>
                  <div className={`text-[13px] font-bold ${concEBITDA >= 0 ? 'text-slate-200' : 'text-red-400'}`}>
                    {proj.revenue - concRevLost > 0 ? ((concEBITDA / (proj.revenue - concRevLost)) * 100).toFixed(1) : '—'}%
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Acquisition Analysis divider ── */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-slate-800/60"/>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] flex items-center gap-2">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 text-indigo-500/60"><path d="M7 1v12M1 7h12" strokeLinecap="round"/></svg>
              Acquisition Analysis
            </div>
            <div className="flex-1 h-px bg-slate-800/60"/>
          </div>

          {/* ── Existing Debt Service / DSCR ── */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[12px] font-semibold text-slate-300">Existing Debt Service</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Impact on DSCR at projected EBITDA</div>
              </div>
              {existingDSCR !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${existingDSCR >= 1.25 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : existingDSCR >= 1 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  DSCR {existingDSCR.toFixed(2)}× {existingDSCR >= 1.25 ? '✓ Bankable' : existingDSCR >= 1 ? '⚠ Tight' : '✗ Below 1.0×'}
                </div>
              )}
            </div>
            <Lever
              label="Annual Debt Service (P+I)"
              hint="existing loan payments per year"
              value={existingDebtSvc}
              min={0} max={2_000_000} step={25_000}
              format={v => v === 0 ? 'None' : fmt(v) + '/yr'}
              accentColor="text-rose-400"
              onChange={setExistingDebtSvc}
            />
            {existingDebtSvc > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">EBITDA</div>
                  <div className="text-[13px] font-bold text-slate-200">{fmt(proj.ebitda)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">Debt Service</div>
                  <div className="text-[13px] font-bold text-rose-400">{fmt(existingDebtSvc)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">Net After Debt</div>
                  <div className={`text-[13px] font-bold ${proj.ebitda - existingDebtSvc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(proj.ebitda - existingDebtSvc)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Valuation Estimator ── */}
          {(() => {
            const ebitda = proj.ebitda;
            if (ebitda <= 0) return null;
            const multiples = [3.5, 4.5, 5.5, 6.5, 7.5];
            const baseEBITDA = data.revenue.total - data.costs.totalCOGS - data.costs.totalOpEx;
            const sbaLTV = 0.80; // SBA 7(a) typical LTV
            const ebitdaImprovement = ebitda - baseEBITDA;
            const midMultiple = 5.5;
            const valuationLift = ebitdaImprovement * midMultiple;

            return (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold text-slate-100">Valuation Estimator</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">EV/EBITDA multiples · LMM services benchmark 4–7×</div>
                  </div>
                  {ebitdaImprovement !== 0 && (
                    <div className={`text-right text-[11px] font-semibold ${ebitdaImprovement > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {ebitdaImprovement > 0 ? '+' : ''}{fmt(valuationLift)} valuation impact
                      <div className="text-[10px] font-normal text-slate-500">at {midMultiple}× mid-market</div>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead>
                      <tr className="border-b border-slate-800/40">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Multiple</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Enterprise Value</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Equity (20% down)</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">SBA Debt</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">vs Base</th>
                      </tr>
                    </thead>
                    <tbody>
                      {multiples.map(m => {
                        const ev        = ebitda * m;
                        const equity    = ev * (1 - sbaLTV);
                        const debt      = ev * sbaLTV;
                        const baseEV    = baseEBITDA * m;
                        const evDelta   = ev - baseEV;
                        const isMid     = m === midMultiple;
                        return (
                          <tr key={m} className={`border-b border-slate-800/30 transition-colors ${isMid ? 'bg-indigo-500/5' : 'hover:bg-slate-800/20'}`}>
                            <td className="px-4 py-3">
                              <span className={`text-[13px] font-bold ${isMid ? 'text-indigo-300' : 'text-slate-300'}`}>{m}×</span>
                              {isMid && <span className="ml-2 text-[9px] text-indigo-400/70 font-semibold uppercase tracking-wide">Mid-market</span>}
                            </td>
                            <td className={`px-4 py-3 text-right text-[13px] font-semibold ${isMid ? 'text-indigo-200' : 'text-slate-200'}`}>{fmt(ev)}</td>
                            <td className="px-4 py-3 text-right text-[12px] text-slate-300">{fmt(equity)}</td>
                            <td className="px-4 py-3 text-right text-[12px] text-slate-500">{fmt(debt)}</td>
                            <td className={`px-4 py-3 text-right text-[12px] font-medium ${evDelta > 0 ? 'text-emerald-400' : evDelta < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                              {evDelta === 0 ? '—' : `${evDelta > 0 ? '+' : ''}${fmt(evDelta)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-800/40 flex items-center gap-4 flex-wrap">
                  <div className="text-[10px] text-slate-600">
                    Assumes SBA 7(a) at 80% LTV · Equity = down payment required · Actual multiples vary by industry, growth, and deal structure
                  </div>
                  {onAskAI && (
                    <button onClick={() => onAskAI(
                      `My business shows projected EBITDA of ${fmt(ebitda)} (${proj.ebitdaMargin.toFixed(1)}% margin). ` +
                      `At a 5.5× multiple that's a ${fmt(ebitda * 5.5)} enterprise value. ` +
                      `What would I need to do to command a 7× or higher multiple? What factors compress multiples in LMM deals?`
                    )} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex-shrink-0 transition-colors">
                      Ask AI about multiples →
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── 12-Month Forward Projection ── */}
          {(() => {
            const monthlyBaseRev    = data.revenue.total / 12;
            const monthlyBaseEBITDA = (data.revenue.total - data.costs.totalCOGS - data.costs.totalOpEx) / 12;
            const monthlyProjRev    = proj.revenue / 12;
            const monthlyProjEBITDA = proj.ebitda / 12;

            // Monthly growth rate from annual growth pct
            const annualRevGrowth  = proj.revenue / data.revenue.total - 1;
            const monthlyRevGrowth = Math.pow(1 + annualRevGrowth, 1 / 12) - 1;

            const months = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'];
            const chartData = months.map((month, i) => {
              const multiplier = Math.pow(1 + monthlyRevGrowth, i + 1);
              const projRev    = monthlyProjRev * multiplier;
              const baseRev    = monthlyBaseRev;
              // EBITDA scales with revenue changes; opex is fixed cost base
              const monthlyOpex     = proj.opex / 12;
              const projEBITDA = projRev * (proj.gmPct / 100) - monthlyOpex;
              return {
                month,
                baseRev:    Math.round(baseRev),
                projRev:    Math.round(projRev),
                baseEBITDA: Math.round(monthlyBaseEBITDA),
                projEBITDA: Math.round(projEBITDA),
              };
            });

            const hasScenario = proj.dRevenue !== 0 || proj.dEBITDA !== 0;
            if (!hasScenario) return null;

            return (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[12px] font-semibold text-slate-100">12-Month Forward Projection</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Monthly ramp assuming scenario growth compounds linearly</div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-slate-700"/><span className="text-slate-500">Base</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-indigo-500"/><span className="text-slate-400">Projected Revenue</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"/><span className="text-slate-400">Projected EBITDA</span></div>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.03}/>
                        </linearGradient>
                        <linearGradient id="gradEBITDA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.03}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
                      <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false}/>
                      <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => fmt(v)}/>
                      <Tooltip
                        contentStyle={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                        formatter={(v: number, name: string) => [fmt(v), name]}
                      />
                      <Area type="monotone" dataKey="baseRev"    name="Base Revenue"     stroke="#334155" strokeWidth={1.5} fill="none" strokeDasharray="4 3"/>
                      <Area type="monotone" dataKey="projRev"    name="Proj. Revenue"    stroke="#6366f1" strokeWidth={2}   fill="url(#gradRev)"/>
                      <Area type="monotone" dataKey="projEBITDA" name="Proj. EBITDA"     stroke="#10b981" strokeWidth={2}   fill="url(#gradEBITDA)"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'M3 Revenue',     val: chartData[2].projRev    },
                    { label: 'M6 Revenue',     val: chartData[5].projRev    },
                    { label: 'M12 Revenue',    val: chartData[11].projRev   },
                    { label: 'M3 EBITDA',      val: chartData[2].projEBITDA },
                    { label: 'M6 EBITDA',      val: chartData[5].projEBITDA },
                    { label: 'M12 EBITDA',     val: chartData[11].projEBITDA },
                  ].map(m => (
                    <div key={m.label} className="bg-slate-800/30 rounded-lg p-3">
                      <div className="text-[10px] text-slate-500 mb-1">{m.label}</div>
                      <div className={`text-[14px] font-bold ${m.val >= 0 ? 'text-slate-200' : 'text-red-400'}`}>{fmt(m.val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── SBA Acquisition Calculator ── */}
          {(() => {
            const baseEBITDA = data.revenue.total - data.costs.totalCOGS - data.costs.totalOpEx;
            if (baseEBITDA <= 0) return null;

            const purchaseMultiple = sbaMultiple;
            const purchasePrice    = baseEBITDA * purchaseMultiple;
            const downPayment      = purchasePrice * (sbaDownPct / 100);
            const loanAmount       = purchasePrice - downPayment;
            const annualRate       = sbAInterestRate / 100;
            const monthlyRate      = annualRate / 12;
            const nPayments        = sbaTerm * 12;
            // Monthly payment via standard amortization formula
            const monthlyPayment   = loanAmount > 0 && monthlyRate > 0
              ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1)
              : loanAmount / nPayments;
            const annualDebtService = monthlyPayment * 12;
            const dscr             = annualDebtService > 0 ? baseEBITDA / annualDebtService : Infinity;
            const cashOnCash       = downPayment > 0 ? ((baseEBITDA - annualDebtService) / downPayment) * 100 : 0;
            const dscrOk           = dscr >= 1.25;

            return (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-[12px] font-semibold text-slate-100">SBA Acquisition Calculator</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Model a leveraged buyout with SBA 7(a) financing</div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${dscrOk ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    <span>DSCR {isFinite(dscr) ? dscr.toFixed(2) : '∞'}×</span>
                    <span className="opacity-60">{dscrOk ? '✓ Bankable' : '✗ Below 1.25× threshold'}</span>
                  </div>
                </div>

                {/* Inputs */}
                <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-slate-800/40">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Purchase Multiple</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={2} max={10} step={0.5} value={sbaMultiple}
                        onChange={e => setSbaMultiple(Number(e.target.value))}
                        className="flex-1 accent-indigo-500"/>
                      <span className="text-[13px] font-bold text-indigo-300 w-12 text-right">{sbaMultiple}×</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">Purchase price: {fmt(purchasePrice)}</div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Down Payment</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={10} max={50} step={5} value={sbaDownPct}
                        onChange={e => setSbaDownPct(Number(e.target.value))}
                        className="flex-1 accent-indigo-500"/>
                      <span className="text-[13px] font-bold text-indigo-300 w-12 text-right">{sbaDownPct}%</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">Equity needed: {fmt(downPayment)}</div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Interest Rate</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={5} max={12} step={0.25} value={sbAInterestRate}
                        onChange={e => setSbAInterestRate(Number(e.target.value))}
                        className="flex-1 accent-indigo-500"/>
                      <span className="text-[13px] font-bold text-indigo-300 w-12 text-right">{sbAInterestRate}%</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">SBA prime + spread (est.)</div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Loan Term</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={5} max={25} step={5} value={sbaTerm}
                        onChange={e => setSbaTerm(Number(e.target.value))}
                        className="flex-1 accent-indigo-500"/>
                      <span className="text-[13px] font-bold text-indigo-300 w-14 text-right">{sbaTerm} yr</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">SBA 7(a) max 25yr RE / 10yr working capital</div>
                  </div>
                </div>

                {/* Results */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-800/40">
                  {[
                    { label: 'Purchase Price',    value: fmt(purchasePrice),                color: 'text-slate-200' },
                    { label: 'Loan Amount',       value: fmt(loanAmount),                   color: 'text-slate-200' },
                    { label: 'Monthly Payment',   value: fmt(monthlyPayment),               color: 'text-slate-200' },
                    { label: 'Annual Debt Svc',   value: fmt(annualDebtService),            color: dscrOk ? 'text-slate-200' : 'text-red-400' },
                    { label: 'Net Cash (yr 1)',   value: fmt(baseEBITDA - annualDebtService), color: baseEBITDA - annualDebtService >= 0 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'Cash-on-Cash',      value: `${cashOnCash.toFixed(1)}%`,       color: cashOnCash >= 15 ? 'text-emerald-400' : cashOnCash >= 0 ? 'text-slate-200' : 'text-red-400' },
                    { label: 'DSCR',              value: `${isFinite(dscr) ? dscr.toFixed(2) : '∞'}×`, color: dscrOk ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'EBITDA (current)',  value: fmt(baseEBITDA),                   color: 'text-slate-200' },
                  ].map(r => (
                    <div key={r.label} className="px-4 py-3">
                      <div className="text-[10px] text-slate-500 mb-1">{r.label}</div>
                      <div className={`text-[14px] font-bold tabular-nums ${r.color}`}>{r.value}</div>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-3 border-t border-slate-800/40 flex items-center gap-4 flex-wrap">
                  <div className="text-[10px] text-slate-600 flex-1">
                    SBA 7(a) requires DSCR ≥ 1.25× · Results are estimates — consult an SBA lender for actual terms
                  </div>
                  {onAskAI && (
                    <button onClick={() => onAskAI(
                      `I'm modeling an SBA acquisition of a business with $${Math.round(baseEBITDA).toLocaleString()} EBITDA at a ${sbaMultiple}× multiple ($${Math.round(purchasePrice).toLocaleString()} purchase price). ` +
                      `With ${sbaDownPct}% down ($${Math.round(downPayment).toLocaleString()}), a ${sbAInterestRate}% rate over ${sbaTerm} years, my DSCR is ${isFinite(dscr) ? dscr.toFixed(2) : '∞'}×. ` +
                      `${!dscrOk ? 'The deal doesn\'t meet the 1.25× DSCR threshold. ' : ''}What should I know about structuring this deal and improving my odds of SBA approval?`
                    )} className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex-shrink-0 transition-colors">
                      Ask AI about this deal →
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Revenue Bridge */}
          {proj.dRevenue !== 0 && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[12px] font-semibold text-slate-300">Revenue Bridge</div>
                <div className={`text-[11px] font-semibold ${proj.dRevenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {delta(proj.dRevenue)} · {fmt(proj.revenue)} final
                </div>
              </div>
              <RevenueWaterfall base={data} projected={proj} active={active}/>
            </div>
          )}

          {/* EBITDA Bridge */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="text-[12px] font-semibold text-slate-300 mb-3">EBITDA Bridge — Base to Projected</div>
            <ImpactWaterfall base={data} projected={proj} active={active}/>
          </div>

          {/* ── Net Income Bridge ── */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between">
              <div>
                <div className="text-[12px] font-semibold text-slate-100">Net Income Bridge</div>
                <div className="text-[10px] text-slate-500 mt-0.5">EBITDA → EBIT → EBT → Net Income</div>
              </div>
              <div className={`text-[13px] font-bold ${projNetIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(projNetIncome)} net
              </div>
            </div>
            <div className="px-5 py-4 grid grid-cols-3 gap-4 border-b border-slate-800/40">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">D&A Estimate</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={500_000} step={5_000} value={daEstimate} onChange={e => setDaEstimate(Number(e.target.value))} className="flex-1 accent-indigo-500"/>
                  <span className="text-[11px] font-bold text-slate-300 w-20 text-right">{daEstimate === 0 ? '$0' : fmt(daEstimate)}</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Interest Expense</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={500_000} step={5_000} value={interestExp} onChange={e => setInterestExp(Number(e.target.value))} className="flex-1 accent-indigo-500"/>
                  <span className="text-[11px] font-bold text-slate-300 w-20 text-right">{interestExp === 0 ? '$0' : fmt(interestExp)}</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Tax Rate</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={0} max={45} step={1} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="flex-1 accent-indigo-500"/>
                  <span className="text-[11px] font-bold text-slate-300 w-12 text-right">{taxRate}%</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-800/40">
              {[
                { label: 'EBITDA',      value: proj.ebitda,   color: 'text-slate-100', indent: false },
                { label: 'Less: D&A',   value: -daEstimate,   color: daEstimate > 0 ? 'text-red-400/80' : 'text-slate-500', indent: true },
                { label: 'EBIT',        value: projEBIT,      color: projEBIT >= 0 ? 'text-slate-200' : 'text-red-400', indent: false, bold: true },
                { label: 'Less: Interest', value: -interestExp, color: interestExp > 0 ? 'text-red-400/80' : 'text-slate-500', indent: true },
                { label: 'EBT',         value: projEBT,       color: projEBT >= 0 ? 'text-slate-200' : 'text-red-400', indent: false, bold: true },
                { label: `Less: Tax (${taxRate}%)`, value: projEBT > 0 ? -(projEBT * taxRate / 100) : 0, color: 'text-red-400/80', indent: true },
                { label: 'Net Income',  value: projNetIncome, color: projNetIncome >= 0 ? 'text-emerald-400' : 'text-red-400', indent: false, bold: true },
              ].map(row => (
                <div key={row.label} className={`flex items-center justify-between px-5 py-2 ${row.bold ? 'bg-slate-800/20' : ''}`}>
                  <span className={`text-[12px] ${row.indent ? 'pl-4 text-slate-500' : 'font-medium text-slate-300'}`}>{row.label}</span>
                  <span className={`text-[12px] font-semibold tabular-nums ${row.color}`}>{row.value === 0 ? '—' : fmt(row.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sensitivity Analysis */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-[12px] font-semibold text-slate-100">Sensitivity Analysis</div>
                <div className="text-[10px] text-slate-500 mt-0.5">EBITDA at each lever setting — heat color shows impact magnitude</div>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(16,185,129,0.25)' }}/><span className="text-slate-500">Positive</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.25)' }}/><span className="text-slate-500">Negative</span></div>
              </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b border-slate-800/40 bg-slate-900/30">
                  <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] w-44">Lever</th>
                  {['−20%', '−10%', 'Current', '+10%', '+20%'].map(h => (
                    <th key={h} className={`px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] ${h === 'Current' ? 'text-slate-300' : 'text-slate-600'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const baseEBITDA = baseRev - baseCOGS - baseOpEx;
                  type SensRow = { label: string; field: keyof Scenario; delta20: number; delta10: number; delta0: number };
                  const rows: SensRow[] = [
                    { label: 'Revenue Volume',  field: 'revenueGrowthPct', delta20: -20, delta10: -10, delta0: active.revenueGrowthPct },
                    { label: 'Price / Rate',    field: 'priceIncreasePct', delta20: -20, delta10: -10, delta0: active.priceIncreasePct },
                    { label: 'Gross Margin',    field: 'grossMarginPct',   delta20: -20, delta10: -10, delta0: active.grossMarginPct },
                    { label: 'OpEx',            field: 'opexChangePct',    delta20: -20, delta10: -10, delta0: active.opexChangePct },
                    { label: 'Customer Churn',  field: 'churnRatePct',     delta20: 20,  delta10: 10,  delta0: active.churnRatePct },
                  ];

                  function ebitdaAt(field: keyof Scenario, val: number): number {
                    return project(data, { ...active, [field]: val }).ebitda;
                  }

                  // Compute all swings first so we can find the overall max for heat scaling
                  const computed = rows.map(row => {
                    const base0 = ebitdaAt(row.field, row.delta0);
                    const low10 = ebitdaAt(row.field, row.delta0 + row.delta10);
                    const low20 = ebitdaAt(row.field, row.delta0 + row.delta20);
                    const hi10  = ebitdaAt(row.field, row.delta0 - row.delta10);
                    const hi20  = ebitdaAt(row.field, row.delta0 - row.delta20);
                    const maxSwing = Math.max(Math.abs(hi20 - base0), Math.abs(low20 - base0));
                    return { row, base0, low10, low20, hi10, hi20, maxSwing };
                  });
                  const overallMaxSwing = Math.max(...computed.map(c => c.maxSwing), 1);
                  const mostSensitiveIdx = computed.reduce((best, c, i) =>
                    c.maxSwing > computed[best].maxSwing ? i : best, 0);

                  return computed.map(({ row, base0, low10, low20, hi10, hi20, maxSwing }, rowIdx) => {
                    const isChurn = row.field === 'churnRatePct';
                    const isMostSensitive = rowIdx === mostSensitiveIdx;

                    function cell(val: number, isCurrent = false) {
                      const d = val - baseEBITDA;
                      const isPos = d >= 0;
                      const intensity = isCurrent ? 0 : Math.min(1, Math.abs(d) / (maxSwing || 1));
                      const bgColor = isCurrent
                        ? 'rgba(100,116,139,0.12)'
                        : isPos
                          ? `rgba(16,185,129,${(0.05 + intensity * 0.20).toFixed(2)})`
                          : `rgba(239,68,68,${(0.05 + intensity * 0.20).toFixed(2)})`;
                      return (
                        <td key={val} className="px-3 py-0 text-right" style={{ backgroundColor: bgColor }}>
                          <div className="py-1.5">
                            <div className={`text-[11px] font-semibold tabular-nums leading-tight ${isCurrent ? 'text-slate-200' : isPos ? 'text-emerald-300' : 'text-red-300'}`}>
                              {fmt(val)}
                            </div>
                            {!isCurrent && (
                              <div className={`text-[9px] tabular-nums leading-tight ${isPos ? 'text-emerald-500/70' : 'text-red-500/70'}`}>
                                {d >= 0 ? '+' : ''}{fmt(d)}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    }

                    const vals = isChurn
                      ? [hi20, hi10, base0, low10, low20]
                      : [low20, low10, base0, hi10, hi20];

                    return (
                      <tr key={row.label} className={`border-b border-slate-800/30 ${isMostSensitive ? 'border-l-2 border-l-amber-500/60' : ''}`}>
                        <td className="px-4 py-1.5">
                          <div className="flex items-center gap-1.5">
                            {isMostSensitive && (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-px rounded">TOP</span>
                            )}
                            <div className="text-[11px] text-slate-200 font-medium">{row.label}</div>
                            <div className="flex-1 mx-1.5 h-0.5 bg-slate-800 rounded-full overflow-hidden min-w-[20px]">
                              <div className="h-full rounded-full bg-amber-500/50" style={{ width: `${(maxSwing / overallMaxSwing) * 100}%` }}/>
                            </div>
                            <span className="text-[9px] text-slate-600 tabular-nums flex-shrink-0">±{fmt(maxSwing)}</span>
                          </div>
                        </td>
                        {vals.map((v, i) => cell(v, i === 2))}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-800/40 text-[10px] text-slate-700">
              Heat intensity scales within each row · TOP = highest EBITDA sensitivity lever · Values show projected annual EBITDA
            </div>
          </div>

          {/* Detailed assumptions table */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800/50">
              <div className="text-[12px] font-semibold text-slate-100">Scenario Assumptions</div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[440px]">
              <thead>
                <tr className="border-b border-slate-800/40">
                  {['Line Item','Base','Projected','Change','% Change'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-right first:text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Revenue',       base: baseRev,    p: proj.revenue,     d: proj.dRevenue },
                  ...(active.newCustomers > 0 ? [{ label: '  New Customers', base: 0, p: proj.newCustomerRevenue, d: proj.newCustomerRevenue, hint: `${active.newCustomers} × ${fmt(baseRev / (data.customers.totalCount || 1), true)} avg` }] : []),
                  { label: '  COGS',        base: baseCOGS,   p: proj.cogs,        d: proj.cogs - baseCOGS },
                  { label: '  Gross Profit',base: baseGP,     p: proj.grossProfit, d: proj.dGP },
                  { label: '  GM %',        base: baseGM,     p: proj.gmPct,       d: proj.gmPct - baseGM, isPct: true },
                  { label: 'OpEx',          base: baseOpEx,   p: proj.opex,        d: proj.dOpEx },
                  { label: 'EBITDA',        base: baseEBITDA, p: proj.ebitda,      d: ebitdaChange, bold: true },
                  { label: 'EBITDA %',      base: baseRev > 0 ? (baseEBITDA/baseRev)*100 : 0, p: proj.ebitdaMargin, d: proj.ebitdaMargin - (baseRev > 0 ? (baseEBITDA/baseRev)*100 : 0), isPct: true, bold: true },
                ].map(row => {
                  const dPct = row.base !== 0 ? (row.d / Math.abs(row.base)) * 100 : 0;
                  const isPositive = row.label.includes('OpEx') || row.label.includes('COGS') ? row.d <= 0 : row.d >= 0;
                  return (
                    <tr key={row.label} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                      <td className={`px-4 py-2.5 text-[12px] ${row.bold ? 'font-semibold text-slate-100' : 'text-slate-400'} ${row.label.startsWith(' ') ? 'pl-7' : ''}`}>
                        {row.label.trim()}
                        {'hint' in row && row.hint && <span className="text-slate-600 text-[10px] ml-1.5">({row.hint})</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-right text-slate-400">
                        {'hint' in row ? '—' : row.isPct ? `${row.base.toFixed(1)}%` : fmt(row.base, true)}
                      </td>
                      <td className={`px-4 py-2.5 text-[12px] text-right font-medium ${row.bold ? 'text-slate-100' : 'text-slate-300'}`}>
                        {row.isPct ? `${row.p.toFixed(1)}%` : fmt(row.p, true)}
                      </td>
                      <td className={`px-4 py-2.5 text-[12px] text-right font-medium ${row.d === 0 ? 'text-slate-600' : isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {row.d === 0 ? '—' : row.isPct ? pct(row.d) : delta(row.d)}
                      </td>
                      <td className={`px-4 py-2.5 text-[11px] text-right ${row.d === 0 ? 'text-slate-700' : isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                        {row.d === 0 ? '—' : pct(dPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>{/* /overflow-x-auto */}
          </div>
        </div>
      </div>

      {/* Comparison table — all saved scenarios */}
      {compareMode && saved.length > 1 && (() => {
        // Probability weighting
        const probVals = saved.map(s => probs[s.id] ?? Math.round(100 / saved.length));
        const totalProb = probVals.reduce((a, b) => a + b, 0);
        const weightedEBITDA = saved.reduce((sum, s, i) => sum + project(data, s).ebitda * (probVals[i] / Math.max(1, totalProb)), 0);
        const weightedRevenue = saved.reduce((sum, s, i) => sum + project(data, s).revenue * (probVals[i] / Math.max(1, totalProb)), 0);

        return (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[12px] font-semibold text-slate-100">Scenario Comparison</div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>Set probability weights:</span>
              {saved.map((s, i) => (
                <label key={s.id} className="flex items-center gap-1">
                  <span style={{ color: s.color }} className="font-medium truncate max-w-[60px]">{s.name}</span>
                  <input
                    type="number" min={0} max={100} step={5}
                    value={probVals[i]}
                    onChange={e => setProbs(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
                    className="w-12 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 text-[10px] tabular-nums text-right"
                  />
                  <span>%</span>
                </label>
              ))}
              <span className={`font-semibold ${totalProb === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>{totalProb}% total</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/40">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Metric</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Base</th>
                  {saved.map(s => (
                    <th key={s.id} className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em]">
                      <span style={{ color: s.color }}>{s.name}</span>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-violet-400/80 uppercase tracking-[0.08em]">Wtd. Exp.</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Revenue',      base: baseRev,    get: (p: ReturnType<typeof project>) => p.revenue },
                  { label: 'Gross Profit', base: baseGP,     get: (p: ReturnType<typeof project>) => p.grossProfit },
                  { label: 'GM %',         base: baseGM,     get: (p: ReturnType<typeof project>) => p.gmPct, isPct: true },
                  { label: 'OpEx',         base: baseOpEx,   get: (p: ReturnType<typeof project>) => p.opex },
                  { label: 'EBITDA',       base: baseEBITDA, get: (p: ReturnType<typeof project>) => p.ebitda, bold: true },
                  { label: 'EBITDA %',     base: baseRev > 0 ? (baseEBITDA/baseRev)*100 : 0, get: (p: ReturnType<typeof project>) => p.ebitdaMargin, isPct: true, bold: true },
                  { label: '— EV @ 3.5×', base: baseEBITDA * 3.5, get: (p: ReturnType<typeof project>) => p.ebitda * 3.5, isEV: true },
                  { label: '— EV @ 5.5×', base: baseEBITDA * 5.5, get: (p: ReturnType<typeof project>) => p.ebitda * 5.5, isEV: true },
                  { label: '— EV @ 7.5×', base: baseEBITDA * 7.5, get: (p: ReturnType<typeof project>) => p.ebitda * 7.5, isEV: true },
                ].map(row => {
                  const wtdVal = saved.reduce((sum, s, i) => sum + row.get(project(data, s)) * (probVals[i] / Math.max(1, totalProb)), 0);
                  return (
                  <tr key={row.label} className={`border-b border-slate-800/30 ${(row as {isEV?:boolean}).isEV ? 'bg-purple-950/10' : ''}`}>
                    <td className={`px-4 py-2.5 text-[12px] ${row.bold ? 'font-semibold text-slate-100' : (row as {isEV?:boolean}).isEV ? 'text-purple-400/80 pl-6' : 'text-slate-400'}`}>{row.label}</td>
                    <td className="px-4 py-2.5 text-[12px] text-right text-slate-500">
                      {row.isPct ? `${row.base.toFixed(1)}%` : fmt(row.base, true)}
                    </td>
                    {saved.map(s => {
                      const p = project(data, s);
                      const val = row.get(p);
                      const d   = val - row.base;
                      const isPos = row.label === 'OpEx' ? d <= 0 : d >= 0;
                      return (
                        <td key={s.id} className="px-4 py-2.5 text-right">
                          <div className={`text-[12px] font-medium ${row.bold ? (isPos ? 'text-emerald-400' : 'text-red-400') : (row as {isEV?:boolean}).isEV ? (isPos ? 'text-purple-300' : 'text-red-400') : 'text-slate-300'}`}>
                            {row.isPct ? `${val.toFixed(1)}%` : fmt(val, true)}
                          </div>
                          {d !== 0 && (
                            <div className={`text-[10px] ${isPos ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                              {row.isPct ? pct(d) : delta(d)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className={`px-4 py-2.5 text-right text-[12px] font-semibold tabular-nums text-violet-300`}>
                      {row.isPct ? `${wtdVal.toFixed(1)}%` : fmt(wtdVal, true)}
                    </td>
                  </tr>
                  );
                })}
                {/* Rule of 40 row */}
                <tr className="border-b border-slate-800/30 bg-indigo-950/10">
                  <td className="px-4 py-2.5 text-[12px] text-indigo-300/80 font-medium">Rule of 40</td>
                  <td className="px-4 py-2.5 text-[12px] text-right text-slate-500">
                    {(0 + (baseRev > 0 ? (baseEBITDA / baseRev) * 100 : 0)).toFixed(0)}
                  </td>
                  {saved.map(s => {
                    const p = project(data, s);
                    const r40 = ((p.revenue - baseRev) / Math.max(1, baseRev) * 100) + p.ebitdaMargin;
                    return (
                      <td key={s.id} className={`px-4 py-2.5 text-right text-[12px] font-bold ${r40 >= 40 ? 'text-emerald-400' : r40 >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                        {r40.toFixed(0)}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right text-[11px] text-slate-600">—</td>
                </tr>
                {/* Cash Runway row */}
                {currentCash > 0 && (
                  <tr className="border-b border-slate-800/30 bg-sky-950/10">
                    <td className="px-4 py-2.5 text-[12px] text-sky-400/80 font-medium">Cash Runway</td>
                    <td className="px-4 py-2.5 text-[12px] text-right text-slate-500">
                      {fmtRunway(calcRunway(baseEBITDA))}
                    </td>
                    {saved.map(s => {
                      const p = project(data, s);
                      const runwayMo = calcRunway(p.ebitda);
                      const runwayOk = runwayMo === null || runwayMo >= 12;
                      return (
                        <td key={s.id} className={`px-4 py-2.5 text-right text-[12px] font-semibold ${runwayOk ? (runwayMo === null ? 'text-slate-300' : 'text-emerald-400') : 'text-red-400'}`}>
                          {fmtRunway(runwayMo)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right text-[11px] text-slate-600">—</td>
                  </tr>
                )}
                {/* Probability-weighted expected value summary */}
                <tr className="bg-violet-950/20">
                  <td className="px-4 py-3 text-[12px] font-semibold text-violet-300">Expected EBITDA</td>
                  <td className="px-4 py-3 text-[12px] text-right text-slate-500">{fmt(baseEBITDA)}</td>
                  {saved.map(s => {
                    const p = project(data, s);
                    return <td key={s.id} className="px-4 py-3 text-right text-[11px] text-slate-500">{fmt(p.ebitda)}</td>;
                  })}
                  <td className="px-4 py-3 text-right text-[14px] font-bold text-violet-300 tabular-nums">
                    {fmt(weightedEBITDA)}
                    <div className="text-[9px] text-violet-500/60 font-normal">prob-weighted</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* Save modal */}
      {showSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSave(false)}/>
          <div className="relative bg-[#0d1117] border border-slate-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-[14px] font-semibold text-slate-100 mb-1">Save Scenario</div>
            <div className="text-[12px] text-slate-400 mb-4">Give this scenario a name to compare it against others</div>
            <input autoFocus type="text" placeholder="e.g. Conservative, Aggressive Growth…"
              value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveScenario(); if (e.key === 'Escape') setShowSave(false); }}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 mb-3"/>
            <textarea
              placeholder="Notes / rationale (optional)"
              value={notesInput} onChange={e => setNotesInput(e.target.value)}
              rows={2}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-[12px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none mb-4"/>
            <div className="flex gap-2">
              <button onClick={() => setShowSave(false)}
                className="flex-1 px-4 py-2 text-[12px] text-slate-400 border border-slate-700/60 rounded-xl hover:border-slate-600 transition-colors">
                Cancel
              </button>
              <button onClick={saveScenario}
                className="flex-1 px-4 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
