// ─── Connected Business Model ─────────────────────────────────────────────────
// Shows the full Deals → Revenue → EBITDA → Cash → Runway chain in a single row.
// Every number is live-computed from the unified model. Click any node to drill in.

import type { ModelChain } from '../../lib/model';

interface Props {
  chain: ModelChain;
  onNavigate: (view: string) => void;
}

function fmt(n: number, _compact = true): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
}

function fmtPct(n: number): string { return `${n.toFixed(1)}%`; }

function Arrow() {
  return (
    <div className="flex items-center justify-center flex-shrink-0 px-1">
      <svg viewBox="0 0 20 14" fill="none" className="w-5 h-3.5 text-slate-700">
        <path d="M0 7h16M12 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

interface NodeProps {
  label:    string;
  primary:  string;
  sub?:     string;
  sub2?:    string;
  status?:  'good' | 'warn' | 'bad' | 'neutral';
  view:     string;
  onNav:    (v: string) => void;
  accent:   string;  // tailwind text color class
  badge?:   string;
}

function Node({ label, primary, sub, sub2, status, view, onNav, accent, badge }: NodeProps) {
  const statusDot =
    status === 'good'    ? 'bg-emerald-400' :
    status === 'warn'    ? 'bg-amber-400'   :
    status === 'bad'     ? 'bg-red-400'     :
    'bg-slate-600';

  return (
    <button
      onClick={() => onNav(view)}
      className="group flex-1 min-w-0 bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800/50 hover:border-slate-700/60 rounded-xl px-3.5 py-3 text-left transition-all"
    >
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-2">
        {status && <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`}/>}
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 truncate flex-1">{label}</div>
        {badge && (
          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 flex-shrink-0">
            {badge}
          </span>
        )}
      </div>

      {/* Primary value */}
      <div className={`text-[17px] font-bold tabular-nums leading-none tracking-tight ${accent}`}>
        {primary}
      </div>

      {/* Sub-values */}
      {sub && (
        <div className="text-[10px] text-slate-500 mt-1.5 leading-snug">{sub}</div>
      )}
      {sub2 && (
        <div className="text-[10px] text-slate-600 mt-0.5 leading-snug">{sub2}</div>
      )}

      {/* Drill-in hint */}
      <div className={`text-[9px] font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${accent}`}>
        View {label} →
      </div>
    </button>
  );
}

export default function ConnectedModel({ chain, onNavigate }: Props) {
  const { pipeline, ttmRevenue, revenueGrowthPct, grossMarginPct, ebitda, ebitdaMarginPct, runway, hasScenario, scenarioName } = chain;

  // Node status signals
  const revenueStatus: NodeProps['status'] = revenueGrowthPct === null ? 'neutral' : revenueGrowthPct >= 10 ? 'good' : revenueGrowthPct >= 0 ? 'warn' : 'bad';
  const ebitdaStatus:  NodeProps['status'] = ebitdaMarginPct >= 15 ? 'good' : ebitdaMarginPct >= 5 ? 'warn' : 'bad';
  const cashStatus:    NodeProps['status'] = runway.cashBalance > 0 ? 'good' : 'bad';
  const runwayStatus:  NodeProps['status'] = runway.runwayMonths === null ? 'good' : runway.runwayMonths > 12 ? 'good' : runway.runwayMonths > 6 ? 'warn' : 'bad';

  const pipelineLabel = pipeline.lateStageCount > 0
    ? `${pipeline.lateStageCount} late-stage`
    : pipeline.activeDeals > 0
    ? `${pipeline.activeDeals} active`
    : undefined;

  const runwayDisplay = runway.runwayMonths === null ? '∞' : runway.runwayMonths > 24 ? '24+ mo' : `${runway.runwayMonths.toFixed(1)} mo`;
  const runwayMNNet   = runway.avgMonthlyNet;

  return (
    <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">Business Model</div>
          <div className="w-px h-3 bg-slate-800"/>
          <div className="text-[10px] text-slate-600">Deals → Revenue → EBITDA → Cash → Runway</div>
        </div>
        {hasScenario && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-violet-500/10 text-violet-400 border-violet-500/20 flex-shrink-0">
            Scenario: {scenarioName}
          </span>
        )}
      </div>

      {/* Connected chain */}
      <div className="flex items-stretch gap-1 overflow-x-auto">
        {/* Deals */}
        <Node
          label="Deals"
          primary={pipeline.activeDeals > 0 ? `${pipeline.activeDeals}` : '—'}
          sub={pipeline.totalEV > 0 ? `${fmt(pipeline.totalEV)} pipeline` : 'No active deals'}
          sub2={pipeline.weightedEV > 0 ? `${fmt(pipeline.weightedEV)} weighted` : undefined}
          status={pipeline.activeDeals > 0 ? 'neutral' : 'neutral'}
          view="deals"
          onNav={onNavigate}
          accent="text-blue-400"
          badge={pipelineLabel}
        />

        <Arrow/>

        {/* Revenue */}
        <Node
          label="Revenue"
          primary={fmt(ttmRevenue)}
          sub={revenueGrowthPct !== null
            ? `${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct.toFixed(1)}% growth`
            : 'No prior period'}
          sub2={`${fmtPct(grossMarginPct)} gross margin`}
          status={revenueStatus}
          view="financial"
          onNav={onNavigate}
          accent="text-indigo-400"
        />

        <Arrow/>

        {/* EBITDA */}
        <Node
          label="EBITDA"
          primary={fmt(Math.abs(ebitda))}
          sub={`${fmtPct(ebitdaMarginPct)} margin`}
          sub2={ebitda < 0 ? 'Operating at a loss' : ebitdaMarginPct >= 15 ? 'Above LMM median (14%)' : 'Below LMM median (14%)'}
          status={ebitdaStatus}
          view="financial"
          onNav={onNavigate}
          accent={ebitda >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />

        <Arrow/>

        {/* Cash */}
        <Node
          label="Cash"
          primary={fmt(runway.cashBalance)}
          sub={runway.source}
          sub2={runwayMNNet !== 0
            ? `${runwayMNNet >= 0 ? '+' : ''}${fmt(runwayMNNet, true)}/mo net`
            : undefined}
          status={cashStatus}
          view="cash"
          onNav={onNavigate}
          accent="text-amber-400"
        />

        <Arrow/>

        {/* Runway */}
        <Node
          label="Runway"
          primary={runwayDisplay}
          sub={runway.runwayMonths === null
            ? 'Cash-flow positive'
            : `${runway.runwayMonths.toFixed(0)} months at burn rate`}
          sub2={runway.runwayMonths !== null && runway.runwayMonths < 12
            ? `⚠ Raise or cut costs`
            : runway.runwayMonths === null
            ? 'No active burn'
            : 'Healthy buffer'}
          status={runwayStatus}
          view="cash"
          onNav={onNavigate}
          accent={runway.runwayMonths === null ? 'text-emerald-400' : runway.runwayMonths > 12 ? 'text-emerald-400' : runway.runwayMonths > 6 ? 'text-amber-400' : 'text-red-400'}
        />
      </div>

      {/* Bottom: scenario note or data freshness */}
      <div className="mt-2.5 px-0.5 flex items-center gap-3">
        {hasScenario ? (
          <div className="text-[9px] text-violet-400/60">
            All values reflect &ldquo;{scenarioName}&rdquo; scenario · Click Scenarios tab to adjust
          </div>
        ) : (
          <div className="text-[9px] text-slate-700">
            Click any node to drill in · All figures auto-calculated from uploaded data
          </div>
        )}
        <div className="ml-auto text-[9px] text-slate-700">
          {pipeline.lateStageCount > 0 && `${pipeline.lateStageCount} deal${pipeline.lateStageCount > 1 ? 's' : ''} in late stage`}
        </div>
      </div>
    </div>
  );
}
