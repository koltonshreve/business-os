import { useState, useMemo } from 'react';
import type { UnifiedBusinessData } from '../../types';
import Tooltip from '../ui/Tooltip';

// ── SKU data types ────────────────────────────────────────────────────────────
interface SKURecord {
  id: string;
  name: string;
  category: string;
  sku?: string;
  price: number;
  variableCost: number;
  unitsSold: number;
  // computed
  revenue: number;
  margin: number;        // (price - variableCost) / price
  contribution: number;  // revenue - (variableCost * unitsSold)
  revenuePct: number;
  contributionPct: number;
  // analysis
  cluster: 'star' | 'core' | 'tail' | 'kill';
  complexity: 'low' | 'medium' | 'high';
  killSignal: boolean;
  overrideKeep?: boolean;
  notes?: string;
  customerCount?: number;
}

interface Props {
  data: UnifiedBusinessData;
  onDataUpdate?: (data: UnifiedBusinessData) => void;
  onAskAI?: (msg: string) => void;
}

type SortKey = 'revenue' | 'margin' | 'contribution' | 'name' | 'category' | 'units';
type ViewMode = 'simple' | 'advanced';
type ClusterFilter = 'all' | 'star' | 'core' | 'tail' | 'kill';

// ── Demo SKU data ─────────────────────────────────────────────────────────────
const DEMO_SKUS_RAW = [
  { id: 'p1',  name: 'Managed Services — Enterprise', category: 'Managed Services', sku: 'MS-ENT',   price: 15000, variableCost: 7500,  unitsSold: 24, customerCount: 8 },
  { id: 'p2',  name: 'Managed Services — Mid-Market', category: 'Managed Services', sku: 'MS-MID',   price: 6000,  variableCost: 3200,  unitsSold: 36, customerCount: 18 },
  { id: 'p3',  name: 'Managed Services — SMB',        category: 'Managed Services', sku: 'MS-SMB',   price: 1800,  variableCost: 1100,  unitsSold: 48, customerCount: 32 },
  { id: 'p4',  name: 'Advisory Retainer — Monthly',   category: 'Advisory',         sku: 'ADV-RET',  price: 8500,  variableCost: 3400,  unitsSold: 18, customerCount: 12 },
  { id: 'p5',  name: 'Strategy Workshop (1-day)',      category: 'Advisory',         sku: 'ADV-WORK', price: 4500,  variableCost: 2000,  unitsSold: 14, customerCount: 10 },
  { id: 'p6',  name: 'Data Migration Project',        category: 'Project Work',     sku: 'PROJ-MIG', price: 22000, variableCost: 14000, unitsSold: 8,  customerCount: 5 },
  { id: 'p7',  name: 'System Integration',            category: 'Project Work',     sku: 'PROJ-INT', price: 35000, variableCost: 20000, unitsSold: 4,  customerCount: 3 },
  { id: 'p8',  name: 'Onboarding Setup Fee',          category: 'One-Time',         sku: 'ONCE-OB',  price: 2500,  variableCost: 1800,  unitsSold: 22, customerCount: 22 },
  { id: 'p9',  name: 'Custom Report Add-On',          category: 'Add-Ons',          sku: 'ADD-RPT',  price: 500,   variableCost: 350,   unitsSold: 18, customerCount: 14 },
  { id: 'p10', name: 'API Access — Basic',            category: 'Add-Ons',          sku: 'ADD-API',  price: 200,   variableCost: 80,    unitsSold: 45, customerCount: 30 },
  { id: 'p11', name: 'API Access — Premium',          category: 'Add-Ons',          sku: 'ADD-APIP', price: 600,   variableCost: 120,   unitsSold: 12, customerCount: 8 },
  { id: 'p12', name: 'Legacy Support — v1',           category: 'Legacy',           sku: 'LEG-V1',   price: 800,   variableCost: 650,   unitsSold: 6,  customerCount: 4 },
  { id: 'p13', name: 'Legacy Support — v2',           category: 'Legacy',           sku: 'LEG-V2',   price: 600,   variableCost: 520,   unitsSold: 4,  customerCount: 3 },
  { id: 'p14', name: 'Ad-Hoc Consulting (hourly)',    category: 'Advisory',         sku: 'ADV-ADHC', price: 250,   variableCost: 130,   unitsSold: 30, customerCount: 18 },
  { id: 'p15', name: 'Training Session (2h)',         category: 'Training',         sku: 'TRN-2H',   price: 400,   variableCost: 280,   unitsSold: 10, customerCount: 8 },
  { id: 'p16', name: 'Compliance Audit Package',     category: 'Project Work',     sku: 'PROJ-AUD', price: 9500,  variableCost: 6500,  unitsSold: 3,  customerCount: 2 },
];

function computeSKUs(raw: typeof DEMO_SKUS_RAW, overrides: Record<string, { keep?: boolean; notes?: string }>): SKURecord[] {
  const withRevenue = raw.map(r => ({
    ...r,
    revenue:      r.price * r.unitsSold,
    contribution: (r.price - r.variableCost) * r.unitsSold,
    margin:       r.price > 0 ? (r.price - r.variableCost) / r.price : 0,
  }));

  const totalRev  = withRevenue.reduce((s, r) => s + r.revenue, 0);
  const totalCont = withRevenue.reduce((s, r) => s + r.contribution, 0);

  return withRevenue
    .map(r => {
      const revPct  = totalRev  > 0 ? (r.revenue      / totalRev)  * 100 : 0;
      const contPct = totalCont > 0 ? (r.contribution / totalCont) * 100 : 0;

      // Complexity heuristic: low price range + unique category = higher complexity per $
      const complexity: SKURecord['complexity'] =
        r.price < 500 && r.unitsSold < 20  ? 'high'
        : r.price < 1500 || r.margin < 0.2 ? 'medium'
        : 'low';

      // Cluster assignment (Pareto-style)
      const cluster: SKURecord['cluster'] =
        revPct >= 15 && r.margin >= 0.35           ? 'star'
        : revPct >= 5  || (revPct >= 2 && r.margin >= 0.30) ? 'core'
        : revPct < 2 && r.margin < 0.15            ? 'kill'
        : 'tail';

      // Kill signal: low revenue + high complexity + poor margin
      const killSignal = cluster === 'kill' || (complexity === 'high' && r.margin < 0.2 && revPct < 3);

      const ov = overrides[r.id] ?? {};
      return {
        ...r,
        revenuePct:      parseFloat(revPct.toFixed(2)),
        contributionPct: parseFloat(contPct.toFixed(2)),
        complexity,
        cluster:         ov.keep ? 'core' : cluster,
        killSignal:      ov.keep ? false : killSignal,
        overrideKeep:    ov.keep,
        notes:           ov.notes ?? (r as SKURecord).notes,
      } as SKURecord;
    })
    .sort((a, b) => b.revenue - a.revenue);
}

function fmt$(n: number, compact = false) {
  if (compact) return n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function pct(n: number) { return `${(n).toFixed(1)}%`; }

const CLUSTER_META = {
  star:  { label: 'Star',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', dot: 'bg-emerald-400', desc: 'High revenue + strong margin — protect & grow' },
  core:  { label: 'Core',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/25',       dot: 'bg-blue-400',    desc: 'Solid contributors — maintain & optimise' },
  tail:  { label: 'Tail',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/25',     dot: 'bg-amber-400',   desc: 'Low contribution — review for pruning or upsell' },
  kill:  { label: 'Kill',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/25',         dot: 'bg-red-400',     desc: 'High complexity, low margin — eliminate' },
};

const COMPLEXITY_META = {
  low:    { color: 'text-emerald-400', bg: 'bg-emerald-500/8 border-emerald-500/20' },
  medium: { color: 'text-amber-400',   bg: 'bg-amber-500/8 border-amber-500/20' },
  high:   { color: 'text-red-400',     bg: 'bg-red-500/8 border-red-500/20' },
};

export default function SKUAnalyzer({ data, onAskAI }: Props) {
  const [view, setView] = useState<ViewMode>('simple');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [clusterFilter, setClusterFilter] = useState<ClusterFilter>('all');
  const [search, setSearch] = useState('');
  const [overrides, setOverrides] = useState<Record<string, { keep?: boolean; notes?: string }>>({});
  const [scenarioMode, setScenarioMode] = useState(false);
  const [scenarioExcluded, setScenarioExcluded] = useState<Set<string>>(new Set());

  const skus = useMemo(() => computeSKUs(DEMO_SKUS_RAW, overrides), [overrides]);

  const filtered = useMemo(() => {
    let list = skus;
    if (clusterFilter !== 'all') list = list.filter(s => s.cluster === clusterFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || (s.sku ?? '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const map: Record<SortKey, number> = {
        revenue: a.revenue - b.revenue,
        margin: a.margin - b.margin,
        contribution: a.contribution - b.contribution,
        units: a.unitsSold - b.unitsSold,
        name: a.name.localeCompare(b.name),
        category: a.category.localeCompare(b.category),
      };
      return sortDir === 'asc' ? map[sortKey] : -map[sortKey];
    });
  }, [skus, clusterFilter, search, sortKey, sortDir]);

  const totalRev  = skus.reduce((s, r) => s + r.revenue, 0);
  const totalCont = skus.reduce((s, r) => s + r.contribution, 0);
  const killSkus  = skus.filter(s => s.killSignal && !s.overrideKeep);

  // Scenario: simulated impact of removing excluded SKUs
  const scenarioRev  = scenarioMode ? skus.filter(s => !scenarioExcluded.has(s.id)).reduce((s, r) => s + r.revenue, 0) : totalRev;
  const scenarioCont = scenarioMode ? skus.filter(s => !scenarioExcluded.has(s.id)).reduce((s, r) => s + r.contribution, 0) : totalCont;
  const scenarioDelta = scenarioCont - totalCont;

  // Pareto: top N SKUs covering 80% of revenue
  let cumRev = 0, paretoN = 0;
  for (const s of skus) {
    cumRev += s.revenue;
    paretoN++;
    if (totalRev > 0 && cumRev / totalRev >= 0.8) break;
  }

  // Cluster summary
  const clusterSummary = (['star', 'core', 'tail', 'kill'] as const).map(c => ({
    cluster: c,
    count: skus.filter(s => s.cluster === c).length,
    revenue: skus.filter(s => s.cluster === c).reduce((s, r) => s + r.revenue, 0),
    contribution: skus.filter(s => s.cluster === c).reduce((s, r) => s + r.contribution, 0),
  }));

  // Category rollup
  const catMap: Record<string, { revenue: number; contribution: number; count: number; avgMargin: number }> = {};
  for (const s of skus) {
    if (!catMap[s.category]) catMap[s.category] = { revenue: 0, contribution: 0, count: 0, avgMargin: 0 };
    catMap[s.category].revenue += s.revenue;
    catMap[s.category].contribution += s.contribution;
    catMap[s.category].count++;
    catMap[s.category].avgMargin += s.margin;
  }
  const categories = Object.entries(catMap).map(([cat, d]) => ({
    category: cat, ...d, avgMargin: d.avgMargin / d.count,
  })).sort((a, b) => b.revenue - a.revenue);

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }

  function toggleScenario(id: string) {
    setScenarioExcluded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-slate-700">↕</span>;
    return <span className="text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const catColors = ['bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500'];
  const catColorMap: Record<string, string> = {};
  categories.forEach((c, i) => { catColorMap[c.category] = catColors[i % catColors.length]; });

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-100">SKU / Product Analyzer</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {skus.length} products · {categories.length} categories · Pareto: {paretoN} SKUs = 80% of revenue
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-900/60 border border-slate-800/60 rounded-lg p-0.5">
            {(['simple', 'advanced'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-all ${
                  view === v ? 'bg-slate-800 text-slate-100 shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                {v === 'simple' ? 'Simple' : 'Advanced'}
              </button>
            ))}
          </div>
          {view === 'advanced' && (
            <button onClick={() => { setScenarioMode(m => !m); setScenarioExcluded(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-[7px] rounded-lg border text-[11px] font-semibold transition-all ${
                scenarioMode ? 'bg-violet-600/15 border-violet-500/30 text-violet-300' : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="w-3 h-3">
                <path d="M1 10h3v3H1v-3zm4-4h2v7H5V6zm4-5h2v12H9V1z"/>
                <path d="M7 4.5L9.5 2 12 4.5" fill="none" strokeLinejoin="round"/>
              </svg>
              {scenarioMode ? 'Exit Scenario' : 'Simulate'}
            </button>
          )}
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Analyze my product/SKU mix. ${killSkus.length} kill-signal SKUs: ${killSkus.slice(0,5).map(s => s.name).join(', ')}. Combined revenue of kill SKUs: ${fmt$(killSkus.reduce((s,r)=>s+r.revenue,0), true)}. If cut, estimated contribution uplift: ${fmt$(killSkus.reduce((s,r)=>s-r.contribution,0)*-1, true)} from freed complexity. What should I cut first and how do I manage customer impact?`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/25 text-indigo-300 rounded-lg text-[11px] font-semibold transition-all">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/></svg>
              AI Analysis
            </button>
          )}
        </div>
      </div>

      {/* ── Scenario banner ── */}
      {scenarioMode && (
        <div className={`border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          scenarioDelta > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-violet-500/5 border-violet-500/20'}`}>
          <div>
            <div className="text-[12px] font-semibold text-slate-200">Scenario Mode — click any SKU row to toggle removal</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {scenarioExcluded.size} SKU{scenarioExcluded.size !== 1 ? 's' : ''} removed · Revenue: {fmt$(scenarioRev, true)} · Contribution: {fmt$(scenarioCont, true)}
              {scenarioExcluded.size > 0 && (
                <span className={`ml-2 font-semibold ${scenarioDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ({scenarioDelta >= 0 ? '+' : ''}{fmt$(scenarioDelta, true)} contribution)
                </span>
              )}
            </div>
          </div>
          {scenarioExcluded.size > 0 && onAskAI && (
            <button onClick={() => {
              const names = Array.from(scenarioExcluded).map(id => skus.find(s => s.id === id)?.name).filter(Boolean);
              const revImpact = Array.from(scenarioExcluded).reduce((s, id) => s + (skus.find(sk => sk.id === id)?.revenue ?? 0), 0);
              const custImpact = Array.from(scenarioExcluded).reduce((s, id) => s + (skus.find(sk => sk.id === id)?.customerCount ?? 0), 0);
              onAskAI(`I'm considering removing these ${names.length} products: ${names.join(', ')}. Combined revenue at risk: ${fmt$(revImpact, true)}. Estimated ${custImpact} customers affected. What's the best approach to communicate this discontinuation and transition affected customers?`);
            }}
              className="flex-shrink-0 text-[11px] font-semibold text-indigo-300 border border-indigo-500/25 bg-indigo-600/10 hover:bg-indigo-600/20 px-3 py-1.5 rounded-lg transition-all">
              Ask AI about impact →
            </button>
          )}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Total Revenue</div>
          <div className="text-[20px] font-bold text-slate-100 tabular-nums">{fmt$(totalRev, true)}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{skus.length} SKUs</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1 flex items-center gap-1">
            Total Contribution
            <Tooltip content="Sum of contribution dollars across all SKUs. Contribution = the money left over after variable costs — it funds your fixed costs and profit." formula="Contribution = (Price − Variable Cost) × Units Sold"/>
          </div>
          <div className="text-[20px] font-bold text-emerald-400 tabular-nums">{fmt$(totalCont, true)}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{totalRev > 0 ? pct((totalCont/totalRev)*100) : '—'} avg margin</div>
        </div>
        <div className={`bg-slate-900/50 border rounded-xl px-4 py-3 ${killSkus.length > 0 ? 'border-red-500/20' : 'border-slate-800/50'}`}>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1 flex items-center gap-1">
            Kill Candidates
            <Tooltip content="SKUs flagged for elimination. Triggered if: kill cluster (< 2% revenue + < 15% margin), OR high complexity + margin < 20% + revenue < 3%. These SKUs consume disproportionate ops overhead relative to contribution." formula={"Kill cluster: rev% < 2% AND margin < 15%\nKill signal:  (complexity=high) AND (margin < 20%) AND (rev% < 3%)"}/>
          </div>
          <div className={`text-[20px] font-bold tabular-nums ${killSkus.length > 0 ? 'text-red-400' : 'text-slate-100'}`}>{killSkus.length}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{fmt$(killSkus.reduce((s,r)=>s+r.revenue,0), true)} revenue at risk</div>
        </div>
        <div className="bg-slate-900/50 border border-indigo-500/15 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1 flex items-center gap-1">
            Pareto (80/20)
            <Tooltip content="The fewest top-performing SKUs that together account for 80% of total revenue. A lower number means revenue is highly concentrated — a risk if those SKUs churn or get disrupted." formula={"Sort SKUs by revenue descending\nCount until cumulative rev ≥ 80% of total"}/>
          </div>
          <div className="text-[20px] font-bold text-indigo-300 tabular-nums">{paretoN} SKUs</div>
          <div className="text-[10px] text-slate-600 mt-0.5">drive 80% of revenue</div>
        </div>
      </div>

      {/* ── Cluster matrix ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {clusterSummary.map(c => {
          const meta = CLUSTER_META[c.cluster];
          return (
            <button key={c.cluster}
              onClick={() => setClusterFilter(clusterFilter === c.cluster ? 'all' : c.cluster)}
              className={`text-left p-3.5 rounded-xl border transition-all ${meta.bg} ${clusterFilter === c.cluster ? 'ring-1 ring-inset ring-current' : ''}`}>
              <div className={`text-[10px] font-bold uppercase tracking-[0.1em] mb-1 ${meta.color}`}>{meta.label}</div>
              <div className={`text-[18px] font-bold tabular-nums ${meta.color}`}>{c.count}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{fmt$(c.revenue, true)} revenue</div>
              <div className={`text-[9px] mt-1 opacity-70 ${meta.color}`}>{meta.desc}</div>
            </button>
          );
        })}
      </div>

      {/* ── Advanced: category breakdown + contribution chart ── */}
      {view === 'advanced' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Revenue & Margin by Category</div>
            <div className="space-y-3">
              {categories.map(cat => {
                const revPct = totalRev > 0 ? (cat.revenue / totalRev) * 100 : 0;
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${catColorMap[cat.category]}`}/>
                        <span className="text-[11px] text-slate-300 font-medium">{cat.category}</span>
                        <span className="text-[10px] text-slate-600">{cat.count} SKU{cat.count !== 1?'s':''}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500 font-mono">{pct(cat.avgMargin * 100)} margin</span>
                        <span className="text-[11px] text-slate-200 font-semibold font-mono">{fmt$(cat.revenue, true)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 h-2">
                      <div className={`rounded-l-full h-full ${catColorMap[cat.category]}`} style={{ width: `${Math.min(revPct, 100)}%` }}/>
                      <div className="rounded-r-full h-full bg-slate-800/40 flex-1"/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Kill Candidates — Detailed</div>
            {killSkus.length === 0 ? (
              <div className="text-[12px] text-slate-500">No kill-signal SKUs detected.</div>
            ) : (
              <div className="space-y-2">
                {killSkus.map(s => (
                  <div key={s.id} className="bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-slate-200 truncate">{s.name}</div>
                        <div className="text-[10px] text-slate-500">{s.category} · {s.sku}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-mono text-slate-400">{fmt$(s.revenue, true)}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">
                          {pct(s.margin * 100)} margin
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="text-[10px] text-slate-500">
                        {s.customerCount} customer{(s.customerCount ?? 0) !== 1 ? 's' : ''} · {s.unitsSold} units
                      </div>
                      <button
                        onClick={() => setOverrides(o => ({ ...o, [s.id]: { ...o[s.id], keep: !o[s.id]?.keep } }))}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                          overrides[s.id]?.keep
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
                        {overrides[s.id]?.keep ? '✓ Keep (override)' : 'Override → Keep'}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pt-2 text-[10px] text-emerald-400/80">
                  Cutting {killSkus.filter(s => !s.overrideKeep).length} SKUs could free ~{fmt$(killSkus.filter(s=>!s.overrideKeep).reduce((s,r)=>s+r.contribution,0)*-0.8, true)} in contribution margin via complexity reduction.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SKU table ── */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800/40 flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex-1 relative">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600">
              <circle cx="6" cy="6" r="4"/><path d="M10 10l2 2"/>
            </svg>
            <input type="text" placeholder="Search SKUs…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-800/40 border border-slate-700/40 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/40"/>
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'star', 'core', 'tail', 'kill'] as ClusterFilter[]).map(c => (
              <button key={c} onClick={() => setClusterFilter(c)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all border ${
                  clusterFilter === c
                    ? c === 'all' ? 'bg-slate-800 text-slate-200 border-slate-700'
                      : `${CLUSTER_META[c as keyof typeof CLUSTER_META]?.bg} ${CLUSTER_META[c as keyof typeof CLUSTER_META]?.color}`
                    : 'border-transparent text-slate-600 hover:text-slate-400'}`}>
                {c}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-600 flex-shrink-0">{filtered.length} of {skus.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-800/40 bg-slate-900/60">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('name')}>Product <SortIcon k="name"/></th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('category')}>Category <SortIcon k="category"/></th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('revenue')}>Revenue <SortIcon k="revenue"/></th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('margin')}>
                  <span className="inline-flex items-center justify-end gap-1">Margin <SortIcon k="margin"/>
                    <Tooltip content="The % of each revenue dollar left after variable costs. Higher = more efficient." formula="Margin = (Price − Variable Cost) ÷ Price" side="bottom"/>
                  </span>
                </th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('contribution')}>
                  <span className="inline-flex items-center justify-end gap-1">Contribution <SortIcon k="contribution"/>
                    <Tooltip content="Dollars toward fixed costs + profit from this SKU after covering variable costs." formula="= (Price − Var. Cost) × Units" side="bottom"/>
                  </span>
                </th>
                {view === 'advanced' && <th className="text-right px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('units')}>Units <SortIcon k="units"/></th>}
                <th className="text-center px-4 py-2.5 font-semibold text-slate-500">
                  <span className="inline-flex items-center justify-center gap-1">Cluster
                    <Tooltip content="Star: ≥15% rev + ≥35% margin. Core: ≥5% rev. Tail: low revenue. Kill: <2% rev + <15% margin." side="bottom"/>
                  </span>
                </th>
                {view === 'advanced' && <th className="text-center px-4 py-2.5 font-semibold text-slate-500">
                  <span className="inline-flex items-center justify-center gap-1">Complexity
                    <Tooltip content="Delivery complexity. High = custom/bespoke. High complexity + low revenue triggers a kill signal." side="bottom"/>
                  </span>
                </th>}
                {view === 'advanced' && <th className="px-4 py-2.5"/>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const meta = CLUSTER_META[s.cluster];
                const cx = COMPLEXITY_META[s.complexity];
                const excluded = scenarioExcluded.has(s.id);
                return (
                  <tr key={s.id}
                    onClick={() => scenarioMode && toggleScenario(s.id)}
                    className={`border-b border-slate-800/30 last:border-0 transition-colors ${
                      scenarioMode ? 'cursor-pointer' : ''} ${
                      excluded ? 'opacity-40 bg-red-500/5' : i % 2 === 1 ? 'bg-slate-900/20 hover:bg-slate-800/20' : 'hover:bg-slate-800/10'}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-200 leading-tight">{s.name}</div>
                      {s.sku && <div className="text-[10px] text-slate-600 font-mono">{s.sku}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${catColorMap[s.category] ?? 'bg-slate-500'}`}/>
                        <span className="text-slate-400">{s.category}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-200">{fmt$(s.revenue, true)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className={s.margin >= 0.35 ? 'text-emerald-400' : s.margin >= 0.2 ? 'text-amber-400' : 'text-red-400'}>
                        {pct(s.margin * 100)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">{fmt$(s.contribution, true)}</td>
                    {view === 'advanced' && <td className="px-4 py-2.5 text-right text-slate-500">{s.unitsSold}</td>}
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    {view === 'advanced' && (
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${cx.bg} ${cx.color}`}>
                          {s.complexity}
                        </span>
                      </td>
                    )}
                    {view === 'advanced' && (
                      <td className="px-4 py-2.5 text-center">
                        {s.killSignal && !s.overrideKeep && (
                          <button onClick={e => { e.stopPropagation(); setOverrides(o => ({ ...o, [s.id]: { ...o[s.id], keep: true } })); }}
                            className="text-[10px] text-slate-600 hover:text-emerald-400 border border-slate-700/40 hover:border-emerald-500/30 px-2 py-0.5 rounded transition-colors">
                            Keep
                          </button>
                        )}
                        {s.overrideKeep && (
                          <button onClick={e => { e.stopPropagation(); setOverrides(o => { const n={...o}; delete n[s.id]; return n; }); }}
                            className="text-[10px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/8 px-2 py-0.5 rounded">
                            ✓ Kept
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Advanced: AI recommendation cards ── */}
      {view === 'advanced' && onAskAI && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              title: 'Cut Kill SKUs',
              prompt: `I have ${killSkus.length} kill-signal SKUs: ${killSkus.map(s=>`${s.name} (${pct(s.margin*100)} margin, ${fmt$(s.revenue,true)} rev)`).join('; ')}. Total revenue at risk: ${fmt$(killSkus.reduce((s,r)=>s+r.revenue,0),true)}. Suggest a 90-day plan to discontinue these products, prioritising customer impact mitigation.`,
              desc: `${killSkus.length} SKUs flagged for elimination`,
              color: 'border-red-500/20 bg-red-500/5 text-red-300',
            },
            {
              title: 'Grow Star SKUs',
              prompt: `My star SKUs are: ${skus.filter(s=>s.cluster==='star').map(s=>`${s.name} (${fmt$(s.revenue,true)} rev, ${pct(s.margin*100)} margin)`).join('; ')}. How should I invest to scale these? What pricing, packaging, or go-to-market changes would maximise contribution growth?`,
              desc: `${skus.filter(s=>s.cluster==='star').length} high-value products to scale`,
              color: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
            },
            {
              title: 'Bundle Tail SKUs',
              prompt: `My tail SKUs are: ${skus.filter(s=>s.cluster==='tail').map(s=>s.name).join(', ')}. Revenue of tail SKUs: ${fmt$(skus.filter(s=>s.cluster==='tail').reduce((s,r)=>s+r.revenue,0),true)}. Should I bundle any of these together or upsell them into higher-tier plans? Suggest 2-3 bundling strategies.`,
              desc: `${skus.filter(s=>s.cluster==='tail').length} tail products to bundle or merge`,
              color: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
            },
          ].map(card => (
            <button key={card.title} onClick={() => onAskAI(card.prompt)}
              className={`text-left p-4 rounded-xl border transition-all hover:brightness-110 ${card.color}`}>
              <div className="text-[12px] font-semibold mb-1">{card.title}</div>
              <div className="text-[10px] opacity-70">{card.desc}</div>
              <div className="text-[10px] mt-2 opacity-50">Ask AI →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
