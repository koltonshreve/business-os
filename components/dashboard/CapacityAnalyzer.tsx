import { useState, useMemo } from 'react';
import type { UnifiedBusinessData, CapacityResource, CapacityData } from '../../types';
import Tooltip from '../ui/Tooltip';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  data: UnifiedBusinessData;
  onDataUpdate?: (data: UnifiedBusinessData) => void;
  onAskAI?: (msg: string) => void;
}

type ViewMode   = 'simple' | 'advanced';
type SortKey    = 'name' | 'utilization' | 'costPerUnit' | 'totalCost' | 'category';
type ScenarioAction = 'increase_volume' | 'outsource' | 'reduce_capacity';

interface ScenarioState {
  resourceId: string | null;
  action: ScenarioAction;
  changePercent: number; // 0–100 delta
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_RESOURCES_RAW: Omit<CapacityResource, 'utilization' | 'totalCost' | 'costPerUnit' | 'costPerUnitAtCapacity' | 'isBottleneck' | 'isUnderutilized' | 'savingsAtCapacity'>[] = [
  { id: 'r1', name: 'Delivery Team — Senior',  category: 'People',      actualVolume: 1080, capacity: 1280, unit: 'hrs/mo', fixedCost: 28000, variableCostPerUnit: 12,  revenuePerUnit: 225 },
  { id: 'r2', name: 'Delivery Team — Mid',      category: 'People',      actualVolume: 960,  capacity: 1280, unit: 'hrs/mo', fixedCost: 18000, variableCostPerUnit: 8,   revenuePerUnit: 150 },
  { id: 'r3', name: 'Delivery Team — Junior',   category: 'People',      actualVolume: 640,  capacity: 1280, unit: 'hrs/mo', fixedCost: 12000, variableCostPerUnit: 5,   revenuePerUnit: 95  },
  { id: 'r4', name: 'Sales & BD',               category: 'People',      actualVolume: 280,  capacity: 480,  unit: 'hrs/mo', fixedCost: 22000, variableCostPerUnit: 0,   revenuePerUnit: 0   },
  { id: 'r5', name: 'Cloud Infrastructure',     category: 'Technology',  actualVolume: 720,  capacity: 1000, unit: 'units',  fixedCost: 4200,  variableCostPerUnit: 3.5, revenuePerUnit: 0   },
  { id: 'r6', name: 'SaaS Tooling',             category: 'Technology',  actualVolume: 18,   capacity: 25,   unit: 'seats',  fixedCost: 3600,  variableCostPerUnit: 0,   revenuePerUnit: 0   },
  { id: 'r7', name: 'Office Space',             category: 'Facilities',  actualVolume: 2800, capacity: 3200, unit: 'sq ft',  fixedCost: 9500,  variableCostPerUnit: 0,   revenuePerUnit: 0   },
  { id: 'r8', name: 'Specialist Contractors',   category: 'People',      actualVolume: 320,  capacity: 320,  unit: 'hrs/mo', fixedCost: 0,     variableCostPerUnit: 95,  revenuePerUnit: 185 },
  { id: 'r9', name: 'QA & Testing',             category: 'People',      actualVolume: 180,  capacity: 320,  unit: 'hrs/mo', fixedCost: 8500,  variableCostPerUnit: 4,   revenuePerUnit: 80  },
  { id: 'r10',name: 'Data & Analytics Tools',   category: 'Technology',  actualVolume: 12,   capacity: 20,   unit: 'seats',  fixedCost: 2800,  variableCostPerUnit: 0,   revenuePerUnit: 0   },
];

function computeResources(
  rawList: typeof DEMO_RESOURCES_RAW,
  overrides: Record<string, number>,
): CapacityResource[] {
  return rawList.map(r => {
    const actual   = overrides[r.id] !== undefined ? overrides[r.id] : r.actualVolume;
    const util     = r.capacity > 0 ? actual / r.capacity : 0;
    const total    = r.fixedCost + r.variableCostPerUnit * actual;
    const cpu      = actual > 0 ? total / actual : 0;
    const totalCap = r.fixedCost + r.variableCostPerUnit * r.capacity;
    const cpuCap   = r.capacity > 0 ? totalCap / r.capacity : 0;
    const savings  = actual > 0 && util < 0.5
      ? (total - (r.fixedCost * 0.1 + r.variableCostPerUnit * actual)) // ~90% fixed cost saved if shut down
      : 0;
    return {
      ...r,
      actualVolume:           actual,
      utilization:            parseFloat(util.toFixed(4)),
      totalCost:              Math.round(total),
      costPerUnit:            parseFloat(cpu.toFixed(2)),
      costPerUnitAtCapacity:  parseFloat(cpuCap.toFixed(2)),
      isBottleneck:           util >= 0.85,
      isUnderutilized:        util < 0.50,
      savingsAtCapacity:      Math.round(savings),
    };
  });
}

function buildCapacityData(
  rawList: typeof DEMO_RESOURCES_RAW,
  overrides: Record<string, number>,
): CapacityData {
  const resources = computeResources(rawList, overrides);
  const totalFixed    = resources.reduce((s, r) => s + r.fixedCost, 0);
  const totalVariable = resources.reduce((s, r) => s + (r.totalCost! - r.fixedCost), 0);
  const totalCost     = totalFixed + totalVariable;
  const totalCap      = resources.reduce((s, r) => s + r.capacity, 0);
  const totalActual   = resources.reduce((s, r) => s + r.actualVolume, 0);
  const weightedUtil  = totalCap > 0 ? totalActual / totalCap : 0;
  const bottlenecks   = resources.filter(r => r.isBottleneck).map(r => r.name);
  const underutilized = resources.filter(r => r.isUnderutilized).map(r => r.name);
  const potentialSavings = resources
    .filter(r => r.isUnderutilized)
    .reduce((s, r) => s + (r.savingsAtCapacity ?? 0), 0);
  return {
    resources,
    summary: { totalFixed, totalVariable, totalCost, weightedUtilization: parseFloat(weightedUtil.toFixed(4)), bottlenecks, underutilized, potentialSavings },
  };
}

// ── Util ──────────────────────────────────────────────────────────────────────
function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}
function fmtPct(n: number) { return `${(n * 100).toFixed(0)}%`; }
function fmtN(n: number)   { return n.toLocaleString(); }

function utilColor(u: number) {
  if (u >= 0.85) return { bar: 'bg-red-500',   text: 'text-red-400',   badge: 'bg-red-500/15 text-red-300 border border-red-500/20' };
  if (u >= 0.65) return { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' };
  if (u >= 0.50) return { bar: 'bg-amber-500',  text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/20' };
  return { bar: 'bg-slate-600', text: 'text-slate-500', badge: 'bg-slate-700/40 text-slate-400 border border-slate-700/40' };
}

function utilLabel(u: number) {
  if (u >= 0.85) return 'Bottleneck';
  if (u >= 0.65) return 'Healthy';
  if (u >= 0.50) return 'Low';
  return 'Underused';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CapacityAnalyzer({ data, onDataUpdate, onAskAI }: Props) {
  const [view,       setView]       = useState<ViewMode>('simple');
  const [sort,       setSort]       = useState<SortKey>('utilization');
  const [sortDir,    setSortDir]    = useState<'asc' | 'desc'>('desc');
  const [catFilter,  setCatFilter]  = useState<string>('all');
  const [overrides,  setOverrides]  = useState<Record<string, number>>({});
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editVal,    setEditVal]    = useState('');
  const [scenario,   setScenario]   = useState<ScenarioState>({
    resourceId: null,
    action:     'increase_volume',
    changePercent: 20,
  });

  const isDemo = !data?.capacity?.resources?.length;
  const rawList = isDemo ? DEMO_RESOURCES_RAW : (data.capacity!.resources as typeof DEMO_RESOURCES_RAW);

  const cap = useMemo(() => buildCapacityData(rawList, overrides), [rawList, overrides]);

  // ── Sorted / filtered table ──
  const categories = ['all', ...Array.from(new Set(cap.resources.map(r => r.category))).sort()];

  const tableRows = useMemo(() => {
    let rows = cap.resources.filter(r => catFilter === 'all' || r.category === catFilter);
    rows = [...rows].sort((a, b) => {
      let av = 0, bv = 0;
      if (sort === 'name')        { av = a.name.localeCompare(b.name); return sortDir === 'asc' ? av : -av; }
      if (sort === 'utilization') { av = a.utilization!; bv = b.utilization!; }
      if (sort === 'costPerUnit') { av = a.costPerUnit!; bv = b.costPerUnit!; }
      if (sort === 'totalCost')   { av = a.totalCost!;   bv = b.totalCost!; }
      if (sort === 'category')    { av = a.category.localeCompare(b.category); return sortDir === 'asc' ? av : -av; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return rows;
  }, [cap, sort, sortDir, catFilter]);

  function toggleSort(key: SortKey) {
    if (sort === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setSortDir('desc'); }
  }

  // ── Scenario simulation ──
  const scenarioResult = useMemo(() => {
    if (!scenario.resourceId) return null;
    const res = cap.resources.find(r => r.id === scenario.resourceId);
    if (!res) return null;
    const delta = scenario.changePercent / 100;
    let newVol = res.actualVolume;
    if (scenario.action === 'increase_volume') newVol = Math.min(res.capacity, res.actualVolume * (1 + delta));
    if (scenario.action === 'reduce_capacity') newVol = res.actualVolume * (1 - delta);
    if (scenario.action === 'outsource')       newVol = res.actualVolume * (1 - delta); // portion outsourced removes internal volume

    const newTotal    = res.fixedCost + res.variableCostPerUnit * newVol;
    const newCPU      = newVol > 0 ? newTotal / newVol : 0;
    const newUtil     = res.capacity > 0 ? newVol / res.capacity : 0;
    const costDelta   = newTotal - res.totalCost!;
    const cpuDelta    = newCPU - res.costPerUnit!;

    let revDelta = 0;
    if (res.revenuePerUnit && res.revenuePerUnit > 0) {
      revDelta = (newVol - res.actualVolume) * res.revenuePerUnit;
    }

    // outsourcing cost: market rate typically 1.4x variable cost
    let outsourceCost = 0;
    if (scenario.action === 'outsource') {
      const outsourcedVol = res.actualVolume * delta;
      outsourceCost = outsourcedVol * res.variableCostPerUnit * 1.4;
    }

    return {
      res,
      newVol:       Math.round(newVol),
      newTotal:     Math.round(newTotal),
      newCPU:       parseFloat(newCPU.toFixed(2)),
      newUtil:      parseFloat(newUtil.toFixed(4)),
      costDelta:    Math.round(costDelta + outsourceCost),
      cpuDelta:     parseFloat(cpuDelta.toFixed(2)),
      revDelta:     Math.round(revDelta),
      marginDelta:  Math.round(revDelta - costDelta - outsourceCost),
    };
  }, [scenario, cap]);

  // ── Render ────────────────────────────────────────────────────────────────
  const { summary } = cap;

  function SortTh({ label, col }: { label: string; col: SortKey }) {
    const active = sort === col;
    return (
      <th
        className="px-3 py-2 text-left text-[10px] font-semibold tracking-wider uppercase text-slate-500 cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
        onClick={() => toggleSort(col)}
      >
        {label}
        <span className="ml-1 opacity-60">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </th>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Demo banner */}
      {isDemo && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2.5 flex items-center gap-2.5">
          <span className="text-cyan-400 text-xs">Demo data — upload your own in</span>
          <span className="text-[10px] font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 rounded px-2 py-0.5">Data</span>
          <span className="text-cyan-400 text-xs">tab (Resources template)</span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-semibold text-white">Capacity &amp; Cost</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Cost per unit · utilization · bottlenecks · scenario modeling</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-800">
            {(['simple','advanced'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${view === v ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {v === 'simple' ? 'Overview' : 'Advanced'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Monthly Cost',
            labelTip: <Tooltip content="Sum of all fixed + variable costs across every tracked resource. Fixed costs don't change with volume; variable costs scale with output." formula="Total = Σ (Fixed Cost + Variable Cost/Unit × Actual Volume)"/>,
            value: fmtMoney(summary.totalCost),
            sub: `${fmtMoney(summary.totalFixed)} fixed · ${fmtMoney(summary.totalVariable)} variable`,
            color: 'text-cyan-400', border: 'border-cyan-500/20',
          },
          {
            label: 'Avg Utilization',
            labelTip: <Tooltip content="Capacity-weighted average utilization across all resources. 65–85% is the healthy zone — higher risks bottlenecks, lower means fixed costs are poorly amortized." formula="Utilization = Actual Volume ÷ Capacity\nWeighted by each resource's max capacity"/>,
            value: fmtPct(summary.weightedUtilization),
            sub: summary.weightedUtilization >= 0.65 ? 'Healthy range' : summary.weightedUtilization >= 0.50 ? 'Room to grow' : 'Underutilized',
            color: summary.weightedUtilization >= 0.65 ? 'text-emerald-400' : summary.weightedUtilization >= 0.50 ? 'text-amber-400' : 'text-slate-400',
            border: 'border-slate-700/60',
          },
          {
            label: 'Bottlenecks',
            labelTip: <Tooltip content="Resources at ≥85% utilization. These constrain your maximum output — any demand spike has no room to absorb, creating delivery risk or customer SLA failures." formula="Bottleneck = Actual Volume ÷ Capacity ≥ 85%"/>,
            value: String(summary.bottlenecks.length),
            sub: summary.bottlenecks.length > 0 ? summary.bottlenecks.slice(0,2).join(', ') : 'None detected',
            color: summary.bottlenecks.length > 0 ? 'text-red-400' : 'text-emerald-400',
            border: 'border-slate-700/60',
          },
          {
            label: 'Potential Savings',
            labelTip: <Tooltip content="Estimated monthly cost reduction if underutilized resources were outsourced or right-sized. Assumes ~90% of fixed costs are recoverable by eliminating the resource." formula="Savings ≈ Fixed Cost × (1 − Utilization)\nFor each resource < 50% utilized"/>,
            value: fmtMoney(summary.potentialSavings),
            sub: `${summary.underutilized.length} underutilized resource${summary.underutilized.length !== 1 ? 's' : ''}`,
            color: 'text-amber-400', border: 'border-amber-500/20',
          },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border ${c.border} bg-slate-900/60 px-4 py-3`}>
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              {c.label}{c.labelTip}
            </div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Utilization bars */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-slate-300 flex items-center gap-1">
            Resource Utilization
            <Tooltip content="How much of each resource's available capacity is currently in use. Red = bottleneck (≥85%), Green = healthy (65–85%), Amber = low (50–65%), Gray = underused (<50%)." formula="Utilization = Actual Volume ÷ Capacity"/>
          </span>
          <div className="flex gap-1">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium capitalize transition-colors ${catFilter === c ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/25' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-800/50">
          {tableRows.map(r => {
            const col = utilColor(r.utilization!);
            return (
              <div key={r.id} className="px-4 py-3 hover:bg-slate-800/20 transition-colors">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-medium text-slate-200 truncate">{r.name}</span>
                    <span className="text-[9px] text-slate-600 bg-slate-800/50 border border-slate-700/50 rounded px-1.5 py-0.5 shrink-0">{r.category}</span>
                    {r.isBottleneck    && <span className="text-[9px] rounded px-1.5 py-0.5 shrink-0 bg-red-500/15 text-red-300 border border-red-500/20">Bottleneck</span>}
                    {r.isUnderutilized && <span className="text-[9px] rounded px-1.5 py-0.5 shrink-0 bg-slate-700/40 text-slate-400 border border-slate-700/40">Underused</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    <span className={col.text + ' font-semibold'}>{fmtPct(r.utilization!)}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">{fmtN(r.actualVolume)}/{fmtN(r.capacity)} {r.unit}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">{fmtMoney(r.totalCost!)} / mo</span>
                    {r.costPerUnit! > 0 && <>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-500">${r.costPerUnit!.toFixed(1)}/{r.unit}</span>
                    </>}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${col.bar}`}
                    style={{ width: `${Math.min(100, r.utilization! * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced view */}
      {view === 'advanced' && (
        <>
          {/* Bottleneck & Underutilized panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Bottlenecks */}
            <div className="rounded-xl border border-red-500/20 bg-slate-900/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-red-500/10">
                <span className="text-[12px] font-semibold text-red-300">Bottleneck Detection</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Resources at ≥85% utilization — constrain your output</p>
              </div>
              <div className="p-3 space-y-2">
                {cap.resources.filter(r => r.isBottleneck).length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-slate-600">No bottlenecks detected — all resources under 85%</div>
                ) : cap.resources.filter(r => r.isBottleneck).map(r => (
                  <div key={r.id} className="rounded-lg bg-red-500/8 border border-red-500/15 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-semibold text-red-200">{r.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{fmtN(r.actualVolume)} / {fmtN(r.capacity)} {r.unit} — {r.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-red-300">{fmtPct(r.utilization!)}</div>
                        <div className="text-[10px] text-slate-500">{fmtN(r.capacity - r.actualVolume)} units headroom</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-400 bg-slate-800/40 rounded px-2 py-1.5">
                      💡 Insight: Adding {fmtN(Math.round((r.capacity - r.actualVolume) * 0.5))} {r.unit} capacity could relieve constraint
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Underutilized */}
            <div className="rounded-xl border border-amber-500/20 bg-slate-900/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-500/10">
                <span className="text-[12px] font-semibold text-amber-300">Underutilized Resources</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Below 50% utilization — fixed costs spread thin</p>
              </div>
              <div className="p-3 space-y-2">
                {cap.resources.filter(r => r.isUnderutilized).length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-slate-600">All resources above 50% utilization</div>
                ) : cap.resources.filter(r => r.isUnderutilized).map(r => {
                  const excessCost = r.fixedCost * (1 - r.utilization!);
                  return (
                    <div key={r.id} className="rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-semibold text-amber-200">{r.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{fmtPct(r.utilization!)} utilized · ${r.costPerUnit!.toFixed(1)}/{r.unit}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-amber-300">~{fmtMoney(excessCost)} / mo</div>
                          <div className="text-[10px] text-slate-500">excess fixed cost</div>
                        </div>
                      </div>
                      <div className="mt-2 text-[10px] text-slate-400 bg-slate-800/40 rounded px-2 py-1.5">
                        💡 At 60% util, cost per unit drops from ${r.costPerUnit!.toFixed(1)} to ${((r.fixedCost / (r.capacity * 0.6)) + r.variableCostPerUnit).toFixed(1)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scenario Simulator */}
          <div className="rounded-xl border border-violet-500/20 bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-violet-500/10 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-violet-300">Scenario Simulator</span>
              <span className="text-[9px] bg-violet-500/15 text-violet-300 border border-violet-500/20 rounded px-1.5 py-0.5 font-medium">INTERACTIVE</span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Select Resource</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none focus:border-violet-500/50"
                    value={scenario.resourceId ?? ''}
                    onChange={e => setScenario(s => ({ ...s, resourceId: e.target.value || null }))}
                  >
                    <option value="">— choose a resource —</option>
                    {cap.resources.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({fmtPct(r.utilization!)} utilized)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Action</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'increase_volume', label: 'Increase Volume', hint: 'Fill unused capacity' },
                      { id: 'outsource',       label: 'Outsource Portion', hint: 'External delivery' },
                      { id: 'reduce_capacity', label: 'Reduce Capacity',  hint: 'Right-size resources' },
                    ] as const).map(a => (
                      <button
                        key={a.id}
                        onClick={() => setScenario(s => ({ ...s, action: a.id }))}
                        className={`rounded-lg border px-2 py-2 text-left transition-colors ${scenario.action === a.id ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}
                      >
                        <div className="text-[11px] font-semibold">{a.label}</div>
                        <div className="text-[9px] text-slate-600 mt-0.5">{a.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Change: {scenario.changePercent}%
                    {scenario.resourceId && scenarioResult && (
                      <span className="ml-2 font-normal text-slate-500 normal-case tracking-normal">
                        ({fmtN(scenarioResult.res.actualVolume)} → {fmtN(scenarioResult.newVol)} {scenarioResult.res.unit})
                      </span>
                    )}
                  </label>
                  <input
                    type="range" min={5} max={80} step={5}
                    value={scenario.changePercent}
                    onChange={e => setScenario(s => ({ ...s, changePercent: parseInt(e.target.value) }))}
                    className="w-full accent-violet-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                    <span>5%</span><span>40%</span><span>80%</span>
                  </div>
                </div>
              </div>

              {/* Result */}
              <div className="flex flex-col justify-center">
                {!scenarioResult ? (
                  <div className="text-center text-[11px] text-slate-600 py-8">
                    Select a resource and action to model the impact
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-[11px] font-semibold text-slate-300">
                      {scenario.action === 'increase_volume' ? `Increase ${scenarioResult.res.name} by ${scenario.changePercent}%`
                       : scenario.action === 'outsource' ? `Outsource ${scenario.changePercent}% of ${scenarioResult.res.name}`
                       : `Reduce ${scenarioResult.res.name} capacity by ${scenario.changePercent}%`}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'New Utilization',  cur: fmtPct(scenarioResult.res.utilization!), nxt: fmtPct(scenarioResult.newUtil), delta: null },
                        { label: 'Monthly Cost',     cur: fmtMoney(scenarioResult.res.totalCost!),  nxt: fmtMoney(scenarioResult.newTotal), delta: scenarioResult.costDelta },
                        { label: 'Cost per Unit',    cur: `$${scenarioResult.res.costPerUnit!}`,    nxt: `$${scenarioResult.newCPU}`,        delta: scenarioResult.cpuDelta * 10 },
                        ...(scenarioResult.res.revenuePerUnit! > 0 ? [
                          { label: 'Revenue Impact', cur: '—', nxt: (scenarioResult.revDelta >= 0 ? '+' : '') + fmtMoney(scenarioResult.revDelta), delta: scenarioResult.revDelta },
                          { label: 'Margin Impact',  cur: '—', nxt: (scenarioResult.marginDelta >= 0 ? '+' : '') + fmtMoney(scenarioResult.marginDelta), delta: scenarioResult.marginDelta },
                        ] : []),
                      ].map(row => (
                        <div key={row.label} className="rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2">
                          <div className="text-[9px] text-slate-500 mb-1">{row.label}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 line-through">{row.cur}</span>
                            <span className="text-[10px] text-slate-600">→</span>
                            <span className={`text-[12px] font-bold ${row.delta === null ? 'text-slate-200' : row.delta > 0 ? (row.label.includes('Cost') ? 'text-red-300' : 'text-emerald-300') : (row.label.includes('Cost') ? 'text-emerald-300' : 'text-red-300')}`}>{row.nxt}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {scenarioResult.costDelta !== 0 && (
                      <div className={`rounded-lg border px-3 py-2 text-[10px] ${scenarioResult.costDelta < 0 ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300' : 'border-amber-500/20 bg-amber-500/8 text-amber-300'}`}>
                        {scenarioResult.costDelta < 0
                          ? `💰 This saves ${fmtMoney(Math.abs(scenarioResult.costDelta))}/mo in total cost`
                          : `📈 This increases cost by ${fmtMoney(scenarioResult.costDelta)}/mo — check revenue impact`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cost per unit comparison table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <span className="text-[12px] font-semibold text-slate-300 flex items-center gap-1">
            Cost per Unit — Current vs Full Capacity
            <Tooltip content="Fixed costs are spread over more units as volume increases, so cost per unit falls. This shows how much cheaper each unit becomes if you operate at full capacity." formula={"Cost/Unit = (Fixed Cost + Variable Cost × Volume) ÷ Volume\nAt capacity: Volume = Max Capacity"}/>
          </span>
              <p className="text-[10px] text-slate-500 mt-0.5">How unit economics change if you fill available capacity</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800/70 bg-slate-900/40">
                    <SortTh label="Resource"     col="name" />
                    <SortTh label="Category"     col="category" />
                    <SortTh label="Utilization"  col="utilization" />
                    <SortTh label="Total Cost"   col="totalCost" />
                    <SortTh label="Cost/Unit Now" col="costPerUnit" />
                    <th className="px-3 py-2 text-left text-[10px] font-semibold tracking-wider uppercase text-slate-500 whitespace-nowrap">Cost/Unit @ Capacity</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold tracking-wider uppercase text-slate-500 whitespace-nowrap">Improvement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {tableRows.filter(r => r.costPerUnit! > 0).map(r => {
                    const improvement = r.costPerUnitAtCapacity! > 0 ? ((r.costPerUnit! - r.costPerUnitAtCapacity!) / r.costPerUnit!) : 0;
                    const col = utilColor(r.utilization!);
                    return (
                      <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-200 whitespace-nowrap">{r.name}</td>
                        <td className="px-3 py-2.5 text-slate-500">{r.category}</td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${col.badge}`}>{fmtPct(r.utilization!)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums">{fmtMoney(r.totalCost!)}</td>
                        <td className="px-3 py-2.5 text-slate-300 tabular-nums font-medium">${r.costPerUnit!.toFixed(1)}</td>
                        <td className="px-3 py-2.5 text-slate-400 tabular-nums">${r.costPerUnitAtCapacity!.toFixed(1)}</td>
                        <td className="px-3 py-2.5">
                          {improvement > 0 ? (
                            <span className="text-emerald-400 font-medium">▼ {fmtPct(improvement)}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action center */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <span className="text-[12px] font-semibold text-slate-300">Action Center</span>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  title: 'Outsource Underused Capacity',
                  desc:  `${summary.underutilized.length} resource${summary.underutilized.length !== 1 ? 's' : ''} below 50% util. Consider outsourcing fixed-cost portions to reduce overhead.`,
                  badge: 'Cost Reduction',
                  color: 'border-amber-500/20 bg-amber-500/8',
                  badge_c: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
                  ai:   `Give me a plan to outsource underutilized capacity. Resources: ${summary.underutilized.join(', ')}. Total potential savings: ${fmtMoney(summary.potentialSavings)}/mo.`,
                },
                {
                  title: 'Relieve Bottlenecks',
                  desc:  `${summary.bottlenecks.length} resource${summary.bottlenecks.length !== 1 ? 's' : ''} at capacity risk. Expand these before they limit growth: ${summary.bottlenecks.slice(0,2).join(', ')}.`,
                  badge: 'Growth Unlock',
                  color: 'border-red-500/20 bg-red-500/8',
                  badge_c: 'bg-red-500/15 text-red-300 border-red-500/20',
                  ai:   `Analyze my bottleneck resources and recommend how to expand capacity: ${summary.bottlenecks.join(', ')}. Include hire vs contract vs outsource tradeoffs.`,
                },
                {
                  title: 'Increase Volume on Fixed-Cost Resources',
                  desc:  'Spread fixed costs over more output. Identify which resources benefit most from volume increases.',
                  badge: 'Margin Improvement',
                  color: 'border-emerald-500/20 bg-emerald-500/8',
                  badge_c: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
                  ai:   `Which of my resources have the highest fixed-cost leverage? Show me which ones would see the biggest cost-per-unit improvement if I increase volume by 20%.`,
                },
                {
                  title: 'Shut Down Underused Capacity',
                  desc:  'Consolidate duplicate or redundant capacity. Recommend resources to right-size or eliminate.',
                  badge: 'OpEx Reduction',
                  color: 'border-slate-700/60 bg-slate-800/40',
                  badge_c: 'bg-slate-700/40 text-slate-400 border-slate-700/40',
                  ai:   `Which resources should I consider shutting down or consolidating? Current avg utilization: ${fmtPct(summary.weightedUtilization)}. List the lowest-ROI capacity and estimated savings.`,
                },
              ].map(a => (
                <div key={a.title} className={`rounded-lg border ${a.color} p-3 flex flex-col gap-2`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-200">{a.title}</span>
                    <span className={`text-[9px] font-medium border rounded px-1.5 py-0.5 shrink-0 ${a.badge_c}`}>{a.badge}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">{a.desc}</p>
                  {onAskAI && (
                    <button
                      onClick={() => onAskAI(a.ai)}
                      className="self-start text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                    >Ask AI →</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Prompt cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Make vs Buy Analysis',     prompt: `Compare make vs buy for my highest-cost resources. Total monthly cost: ${fmtMoney(summary.totalCost)}. Avg utilization: ${fmtPct(summary.weightedUtilization)}. Which functions should I outsource vs keep in-house?` },
              { label: 'Capacity Expansion Plan',  prompt: `I have ${summary.bottlenecks.length} bottleneck${summary.bottlenecks.length !== 1 ? 's' : ''} (${summary.bottlenecks.join(', ')}). Build a phased capacity expansion plan with cost estimates.` },
              { label: 'Unit Economics Deep Dive', prompt: `My weighted utilization is ${fmtPct(summary.weightedUtilization)} with total fixed cost ${fmtMoney(summary.totalCost)}. What are my unit economics at 70%, 80%, and 90% utilization? Show cost/unit at each level.` },
            ].map(p => (
              <button
                key={p.label}
                disabled={!onAskAI}
                onClick={() => onAskAI?.(p.prompt)}
                className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 p-3 text-left transition-colors group"
              >
                <div className="text-[10px] font-semibold text-cyan-300 mb-1">🤖 {p.label}</div>
                <div className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors line-clamp-2">{p.prompt.slice(0,90)}…</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
