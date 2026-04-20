import { useState, useCallback, useId, useEffect } from 'react';
import type { UnifiedBusinessData } from '../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

interface Props {
  data: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
  /** Called whenever the active scenario changes so parent can propagate it to all modules */
  onScenarioChange?: (s: { name: string; revenueGrowthPct: number; grossMarginPct: number; opexChangePct: number; newHires: number; avgCompK: number; priceIncreasePct: number } | null) => void;
}

interface Scenario {
  id: string;
  name: string;
  color: string;
  revenueGrowthPct: number;   // % change on base revenue
  grossMarginPct: number;     // target GM% (0–100)
  opexChangePct: number;      // % change to OpEx
  newHires: number;           // headcount additions
  avgCompK: number;           // avg annual comp for new hires ($k)
  priceIncreasePct: number;   // price/rate increase %
  newCustomers: number;       // new customer count added
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
};

const fmt = (n: number, compact = false) =>
  compact
    ? n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`
    : n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(1)}k` : `$${n.toFixed(0)}`;

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
const delta = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n, true)}`;

// ── Compute projected P&L from scenario levers ────────────────────────────────
function project(base: UnifiedBusinessData, s: Scenario) {
  const baseRev  = base.revenue.total;
  const baseCOGS = base.costs.totalCOGS;
  const baseOpEx = base.costs.totalOpEx;
  const baseGP   = baseRev - baseCOGS;
  const baseGM   = baseRev > 0 ? (baseGP / baseRev) * 100 : 40;

  // Revenue: base × (1 + volume_growth%) × (1 + price_increase%)
  const projRev = baseRev
    * (1 + s.revenueGrowthPct / 100)
    * (1 + s.priceIncreasePct / 100);

  // Gross Margin: use slider target if set, otherwise keep current
  const gmPct = s.grossMarginPct > 0 ? s.grossMarginPct : baseGM;
  const projGP   = projRev * (gmPct / 100);
  const projCOGS = projRev - projGP;

  // OpEx: base × (1 + change%) + new hire cost
  const hireCost = s.newHires * s.avgCompK * 1000;
  const projOpEx = baseOpEx * (1 + s.opexChangePct / 100) + hireCost;

  const projEBITDA     = projGP - projOpEx;
  const projEBITDAMargin = projRev > 0 ? (projEBITDA / projRev) * 100 : 0;

  const baseEBITDA = baseGP - baseOpEx;

  return {
    revenue:      projRev,
    cogs:         projCOGS,
    grossProfit:  projGP,
    opex:         projOpEx,
    ebitda:       projEBITDA,
    ebitdaMargin: projEBITDAMargin,
    gmPct,
    // Deltas vs base
    dRevenue:     projRev - baseRev,
    dGP:          projGP - baseGP,
    dOpEx:        projOpEx - baseOpEx,
    dEBITDA:      projEBITDA - baseEBITDA,
    // Break-even
    breakEven:    projOpEx + projCOGS,
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

// ── Waterfall chart showing lever impact ──────────────────────────────────────
function ImpactWaterfall({ base, projected }: { base: UnifiedBusinessData; projected: ReturnType<typeof project> }) {
  const baseEBITDA = base.revenue.total - base.costs.totalCOGS - base.costs.totalOpEx;
  const dRevEffect = projected.dRevenue * (projected.gmPct / 100);
  const dMarginEffect = projected.dGP - dRevEffect;
  const dOpExEffect = -projected.dOpEx;

  const bars = [
    { name: 'Base EBITDA', value: baseEBITDA, cumulative: baseEBITDA, type: 'base' },
    { name: 'Revenue ↑', value: dRevEffect, cumulative: baseEBITDA + dRevEffect, type: dRevEffect >= 0 ? 'up' : 'down' },
    { name: 'Margin', value: dMarginEffect, cumulative: baseEBITDA + dRevEffect + dMarginEffect, type: dMarginEffect >= 0 ? 'up' : 'down' },
    { name: 'OpEx', value: dOpExEffect, cumulative: projected.ebitda, type: dOpExEffect >= 0 ? 'up' : 'down' },
    { name: 'Projected', value: projected.ebitda, cumulative: projected.ebitda, type: 'projected' },
  ];

  const allVals = bars.flatMap(b => [b.cumulative, b.cumulative - b.value]);
  const minVal  = Math.min(...allVals, 0);
  const maxVal  = Math.max(...allVals);

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bars} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={32}>
          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false}/>
          <YAxis domain={[minVal * 1.1, maxVal * 1.1]} tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => fmt(v, true)}/>
          <Tooltip
            contentStyle={{ background: '#0d1117', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [fmt(v, true), '']}
          />
          <ReferenceLine y={0} stroke="#1e293b" strokeWidth={1}/>
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {bars.map((b, i) => (
              <Cell key={i} fill={
                b.type === 'base'      ? '#6366f1' :
                b.type === 'projected' ? (projected.ebitda >= baseEBITDA ? '#10b981' : '#ef4444') :
                b.type === 'up'        ? 'rgba(16,185,129,0.6)' :
                                         'rgba(239,68,68,0.6)'
              }/>
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
    const scenario: Scenario = { ...active, id: `s-${Date.now()}`, name, color: SCENARIO_COLORS[saved.length % SCENARIO_COLORS.length] };
    setSaved(prev => [...prev, scenario]);
    setShowSave(false);
    setNameInput('');
  };

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
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const hasChanges = active.revenueGrowthPct !== 0 || active.opexChangePct !== 0 ||
    active.newHires !== 0 || active.priceIncreasePct !== 0 || active.newCustomers !== 0 ||
    Math.abs(active.grossMarginPct - baseGM) > 0.5;

  const ebitdaChange = proj.ebitda - baseEBITDA;
  const ebitdaChangePct = baseEBITDA !== 0 ? (ebitdaChange / Math.abs(baseEBITDA)) * 100 : 0;

  // Quick scenario presets
  const PRESETS = [
    { label: '🚀 +20% Revenue',     apply: () => setActive(p => ({ ...p, revenueGrowthPct: 20, opexChangePct: 5 })) },
    { label: '✂️ Cut OpEx 15%',     apply: () => setActive(p => ({ ...p, opexChangePct: -15 })) },
    { label: '📈 Raise Prices 10%', apply: () => setActive(p => ({ ...p, priceIncreasePct: 10 })) },
    { label: '👥 Hire 5 People',    apply: () => setActive(p => ({ ...p, newHires: 5, avgCompK: 100 })) },
    { label: '💰 Expand Margins',   apply: () => setActive(p => ({ ...p, grossMarginPct: Math.min(baseGM + 5, 80) })) },
    { label: '📉 Recession -25%',   apply: () => setActive(p => ({ ...p, revenueGrowthPct: -25, opexChangePct: -10 })) },
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
            <button onClick={() => setShowSave(true)}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all">
              Save Scenario
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

          {/* EBITDA impact gauge */}
          <div className={`border rounded-xl p-5 ${
            ebitdaChange > 0 ? 'bg-emerald-500/5 border-emerald-500/20' :
            ebitdaChange < 0 ? 'bg-red-500/5 border-red-500/20' :
                               'bg-slate-900/50 border-slate-800/50'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">EBITDA Impact</div>
                <div className={`text-[28px] font-bold tracking-tight ${ebitdaChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {delta(ebitdaChange)}
                </div>
                <div className={`text-[13px] font-medium mt-1 ${ebitdaChangePct >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                  {pct(ebitdaChangePct)} vs base · {proj.ebitdaMargin.toFixed(1)}% projected margin
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Break-Even Revenue</div>
                <div className="text-[18px] font-bold text-slate-200">{fmt(proj.breakEven, true)}</div>
                <div className={`text-[11px] mt-1 ${proj.revenue >= proj.breakEven ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                  {proj.revenue >= proj.breakEven
                    ? `${fmt(proj.revenue - proj.breakEven, true)} above break-even`
                    : `${fmt(proj.breakEven - proj.revenue, true)} below break-even`}
                </div>
              </div>
              <button onClick={copyScenario}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 font-medium border border-slate-700/50 hover:border-slate-600 px-3 py-2 rounded-lg transition-all flex-shrink-0">
                {copied ? '✓ Copied' : '⎘ Copy'}
              </button>
              {onAskAI && (
                <button onClick={() => onAskAI(
                  `I'm modeling a scenario: revenue ${delta(proj.dRevenue)} to ${fmt(proj.revenue, true)}, gross margin ${proj.gmPct.toFixed(1)}%, OpEx ${delta(proj.dOpEx)} to ${fmt(proj.opex, true)}, EBITDA ${delta(ebitdaChange)} to ${fmt(proj.ebitda, true)} (${proj.ebitdaMargin.toFixed(1)}% margin). ` +
                  `Is this scenario realistic and achievable? What are the risks I'm not accounting for?`
                )}
                  className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/25 hover:border-indigo-500/50 bg-indigo-500/8 hover:bg-indigo-500/15 px-3 py-2 rounded-lg transition-all flex-shrink-0">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
                  Validate with AI
                </button>
              )}
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

          {/* Waterfall */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="text-[12px] font-semibold text-slate-300 mb-3">EBITDA Bridge — Base to Projected</div>
            <ImpactWaterfall base={data} projected={proj}/>
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
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-right text-slate-400">
                        {row.isPct ? `${row.base.toFixed(1)}%` : fmt(row.base, true)}
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
      {compareMode && saved.length > 1 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/50">
            <div className="text-[12px] font-semibold text-slate-100">Scenario Comparison</div>
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
                ].map(row => (
                  <tr key={row.label} className="border-b border-slate-800/30">
                    <td className={`px-4 py-2.5 text-[12px] ${row.bold ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>{row.label}</td>
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
                          <div className={`text-[12px] font-medium ${row.bold ? (isPos ? 'text-emerald-400' : 'text-red-400') : 'text-slate-300'}`}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 mb-4"/>
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
