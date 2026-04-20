// ─── Decision Engine ──────────────────────────────────────────────────────────
// Replaces generic dashboards with actionable "What should I do next?" cards
// specifically tuned for SMB acquisition and operations context.

import { useState, useEffect } from 'react';
import type { UnifiedBusinessData } from '../../types';
import { loadMemory, addMemoryEntry } from '../../lib/memory';

// ─── Types ─────────────────────────────────────────────────────────────────

type DecisionPriority = 'critical' | 'high' | 'medium' | 'info';
type DecisionArea = 'acquisition' | 'financial' | 'operations' | 'risk' | 'growth';

interface Decision {
  id: string;
  priority: DecisionPriority;
  area: DecisionArea;
  headline: string;
  context: string;         // 1-2 sentence situation summary
  action: string;          // the specific thing to do NOW
  why: string;             // consequence of inaction
  effort: 'low' | 'medium' | 'high';
  timeframe: string;       // "Today", "This week", "30 days"
  metric?: string;         // supporting metric
  dismissed: boolean;
}

// ─── Derive decisions from live data + memory ────────────────────────────────

function deriveDecisions(data: UnifiedBusinessData, companyName: string): Decision[] {
  const rev      = data.revenue.total;
  const cogs     = data.costs.totalCOGS;
  const opex     = data.costs.totalOpEx;
  const gp       = rev - cogs;
  const ebitda   = gp - opex;
  const ebitdaM  = rev > 0 ? (ebitda / rev) * 100 : 0;
  const gpMargin = rev > 0 ? (gp / rev) * 100 : 0;
  const retention = (data.customers.retentionRate ?? 0.88) * 100;
  const topCust  = data.customers.topCustomers[0];

  const cf = data.cashFlow ?? [];
  const latestCash = cf.length ? cf[cf.length - 1].closingBalance : null;
  const avgBurn    = cf.length ? cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / cf.length : null;
  const runway     = latestCash != null && avgBurn != null && avgBurn < 0
    ? Math.abs(latestCash / avgBurn) : null;

  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

  // Pull acquisition pipeline from memory/localStorage
  let acqTargets: { stage: string; name: string; nextActionDate?: string; overdue?: boolean }[] = [];
  try {
    const raw = localStorage.getItem('bos_acq_targets');
    if (raw) {
      const parsed = JSON.parse(raw);
      acqTargets = parsed.map((t: { stage: string; name: string; nextActionDate?: string }) => ({
        stage: t.stage, name: t.name,
        overdue: t.nextActionDate ? new Date(t.nextActionDate) < new Date() : false,
      }));
    }
  } catch { /* ignore */ }

  const overdueDeals = acqTargets.filter(t => t.overdue && !['closed-won','closed-lost'].includes(t.stage));
  const dealsInLOI   = acqTargets.filter(t => t.stage === 'loi');
  const dealsInDD    = acqTargets.filter(t => t.stage === 'due-diligence');
  const dealsInClosing = acqTargets.filter(t => t.stage === 'closing');

  const decisions: Decision[] = [];

  // ── Critical ────────────────────────────────────────────────────────────────

  if (runway !== null && runway < 3) {
    decisions.push({
      id: 'cash-critical',
      priority: 'critical',
      area: 'risk',
      headline: `Cash runway critical — ${runway.toFixed(1)} months remaining`,
      context: `At current burn rate, ${companyName} runs out of cash in ${runway.toFixed(1)} months (${fmtN(latestCash!)} remaining).`,
      action: 'Call your bank TODAY — activate a credit line or receivables factoring to bridge the gap',
      why: 'Without intervention, operations halt before acquisitions can close',
      effort: 'high',
      timeframe: 'Today',
      metric: `${fmtN(latestCash!)} cash · ${runway.toFixed(1)}mo runway`,
      dismissed: false,
    });
  }

  if (ebitda < 0) {
    decisions.push({
      id: 'ebitda-negative',
      priority: 'critical',
      area: 'financial',
      headline: 'Operating at a loss — EBITDA is negative',
      context: `EBITDA is ${fmtN(ebitda)} — ${companyName} is burning cash from operations. Lenders and buyers look at this first.`,
      action: `Cut at least ${fmtN(-ebitda)} from operating expenses — identify and eliminate the 3 largest discretionary line items`,
      why: 'Negative EBITDA kills acquisition financing and implies deteriorating value',
      effort: 'medium',
      timeframe: 'This week',
      metric: `EBITDA ${fmtN(ebitda)}`,
      dismissed: false,
    });
  }

  // ── High ─────────────────────────────────────────────────────────────────────

  if (dealsInLOI.length > 0) {
    decisions.push({
      id: 'loi-active',
      priority: 'high',
      area: 'acquisition',
      headline: `${dealsInLOI.length} deal${dealsInLOI.length > 1 ? 's' : ''} at LOI stage — move to due diligence`,
      context: `${dealsInLOI.map(d => d.name).join(', ')} ${dealsInLOI.length > 1 ? 'have' : 'has'} signed LOI. The clock is running on exclusivity.`,
      action: 'Kick off QoE, legal, and operational DD checklists immediately — exclusivity windows are 30–60 days',
      why: 'Delays in DD extend the deal timeline and give sellers cold feet',
      effort: 'high',
      timeframe: 'This week',
      metric: `${dealsInLOI.length} LOI active`,
      dismissed: false,
    });
  }

  if (dealsInClosing.length > 0) {
    decisions.push({
      id: 'closing-active',
      priority: 'high',
      area: 'acquisition',
      headline: `${dealsInClosing.length} deal${dealsInClosing.length > 1 ? 's' : ''} in closing — finalize financing`,
      context: `${dealsInClosing.map(d => d.name).join(', ')} ${dealsInClosing.length > 1 ? 'are' : 'is'} in the closing stage. Confirm SBA/financing, legal docs, and transition plan.`,
      action: 'Confirm lender commitment letter and wire schedule — flag any open reps & warranties issues',
      why: 'Last-minute financing issues are the top deal killer at closing',
      effort: 'high',
      timeframe: 'Today',
      metric: `${dealsInClosing.length} at closing`,
      dismissed: false,
    });
  }

  if (overdueDeals.length > 0) {
    decisions.push({
      id: 'overdue-actions',
      priority: 'high',
      area: 'acquisition',
      headline: `${overdueDeals.length} deal${overdueDeals.length > 1 ? 's have' : ' has'} overdue next actions`,
      context: `${overdueDeals.map(d => d.name).join(', ')} — scheduled touchpoints are past due. Stalled deals lose momentum fast.`,
      action: 'Open each deal in the Acquisitions tab and complete or reschedule the overdue action',
      why: 'Sellers and brokers move to the next buyer when communication goes dark',
      effort: 'low',
      timeframe: 'Today',
      metric: `${overdueDeals.length} overdue`,
      dismissed: false,
    });
  }

  if (retention < 80) {
    decisions.push({
      id: 'retention-critical',
      priority: 'high',
      area: 'risk',
      headline: `Retention at ${retention.toFixed(0)}% — fix before acquiring`,
      context: `Customer retention is ${retention.toFixed(1)}%, meaning ~${Math.round(data.customers.totalCount * (1 - retention / 100))} customers lost per year. Buyers and lenders will flag this.`,
      action: 'Identify the top 3 churn reasons this week — run a win/loss survey on churned accounts',
      why: 'Acquiring businesses while your current customer base leaks destroys total value',
      effort: 'medium',
      timeframe: 'This week',
      metric: `${retention.toFixed(1)}% retention`,
      dismissed: false,
    });
  }

  if (topCust && topCust.percentOfTotal > 30) {
    decisions.push({
      id: 'concentration-high',
      priority: 'high',
      area: 'risk',
      headline: `${topCust.name} is ${topCust.percentOfTotal.toFixed(0)}% of revenue — existential risk`,
      context: `Single-customer concentration above 30% will block SBA financing on acquisitions and compress any exit multiple.`,
      action: 'Start 3 new outbound sales sequences targeting similar-sized customers today',
      why: 'Losing this customer before diversifying creates an unrecoverable cash shortfall',
      effort: 'medium',
      timeframe: 'This week',
      metric: `${topCust.percentOfTotal.toFixed(0)}% concentration`,
      dismissed: false,
    });
  }

  // ── Medium ────────────────────────────────────────────────────────────────────

  if (dealsInDD.length > 0) {
    decisions.push({
      id: 'dd-active',
      priority: 'medium',
      area: 'acquisition',
      headline: `${dealsInDD.length} deal${dealsInDD.length > 1 ? 's' : ''} in due diligence`,
      context: `${dealsInDD.map(d => d.name).join(', ')} — stay on top of the DD checklist and track open items.`,
      action: 'Review your DD tracker and close out at least 3 open items before the weekend',
      why: 'Incomplete DD leads to price renegotiation or deal collapse',
      effort: 'medium',
      timeframe: 'This week',
      metric: `${dealsInDD.length} in DD`,
      dismissed: false,
    });
  }

  if (ebitdaM < 15 && ebitdaM >= 0) {
    decisions.push({
      id: 'ebitda-margin-low',
      priority: 'medium',
      area: 'financial',
      headline: `EBITDA margin ${ebitdaM.toFixed(1)}% — below 15% lower-middle market median`,
      context: `LMM services businesses typically trade at 15–25% EBITDA margins. Closing this gap increases valuation multiples on future exits.`,
      action: 'Identify 2–3 OpEx line items above 10% of revenue and benchmark against comparable businesses',
      why: 'Each 1pp of EBITDA margin at 5× EV/EBITDA is worth $50k per $1M revenue',
      effort: 'medium',
      timeframe: '30 days',
      metric: `${ebitdaM.toFixed(1)}% EBITDA margin`,
      dismissed: false,
    });
  }

  if (gpMargin < 35) {
    decisions.push({
      id: 'gross-margin-low',
      priority: 'medium',
      area: 'financial',
      headline: `Gross margin ${gpMargin.toFixed(1)}% — pricing or COGS issue`,
      context: `Healthy services businesses typically run 40–70% gross margins. At ${gpMargin.toFixed(1)}%, either pricing is too low or direct costs are too high.`,
      action: 'Map your top 5 service lines by gross margin — identify which to reprice or discontinue',
      why: 'Low gross margin constrains operating leverage as you scale the portfolio',
      effort: 'medium',
      timeframe: '30 days',
      metric: `${gpMargin.toFixed(1)}% gross margin`,
      dismissed: false,
    });
  }

  if (runway !== null && runway < 6 && runway >= 3) {
    decisions.push({
      id: 'cash-watch',
      priority: 'medium',
      area: 'risk',
      headline: `Cash runway ${runway.toFixed(1)} months — build a buffer`,
      context: `${fmtN(latestCash!)} on hand with ${runway.toFixed(1)} months runway. SBA lenders want to see 3+ months post-close.`,
      action: 'Explore a business line of credit now — easier to qualify before you need it',
      why: 'Tight runway restricts deal flexibility and creates negotiating weakness',
      effort: 'low',
      timeframe: '30 days',
      metric: `${fmtN(latestCash!)} · ${runway.toFixed(1)}mo runway`,
      dismissed: false,
    });
  }

  // ── Info ──────────────────────────────────────────────────────────────────────

  if (acqTargets.filter(t => !['closed-won','closed-lost'].includes(t.stage)).length < 5) {
    decisions.push({
      id: 'pipeline-thin',
      priority: 'info',
      area: 'acquisition',
      headline: 'Pipeline is thin — need more qualified targets',
      context: 'Best-practice acquisition search requires 50–100 qualified targets in funnel to find 1 great deal.',
      action: 'Reach out to 3 new brokers this week and set up deal alerts in your target verticals',
      why: 'Thin pipeline forces rushed decisions and premium pricing',
      effort: 'low',
      timeframe: 'This week',
      metric: `${acqTargets.filter(t => !['closed-won','closed-lost'].includes(t.stage)).length} active targets`,
      dismissed: false,
    });
  }

  return decisions;
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<DecisionPriority, { label: string; dot: string; card: string; border: string; hdr: string }> = {
  critical: { label: 'CRITICAL', dot: 'bg-red-500',     card: 'bg-red-500/5',     border: 'border-red-500/20',    hdr: 'text-red-300' },
  high:     { label: 'HIGH',     dot: 'bg-amber-400',   card: 'bg-amber-500/5',   border: 'border-amber-500/20',  hdr: 'text-amber-300' },
  medium:   { label: 'MEDIUM',   dot: 'bg-blue-400',    card: 'bg-blue-500/5',    border: 'border-blue-500/20',   hdr: 'text-blue-300' },
  info:     { label: 'INFO',     dot: 'bg-slate-500',   card: 'bg-slate-900/40',  border: 'border-slate-700/40',  hdr: 'text-slate-400' },
};

const AREA_LABELS: Record<DecisionArea, string> = {
  acquisition: 'Acquisition', financial: 'Financial', operations: 'Operations', risk: 'Risk', growth: 'Growth',
};

const EFFORT_CONFIG: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Low effort',    cls: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/20' },
  medium: { label: 'Medium effort', cls: 'text-amber-400 bg-amber-500/8 border-amber-500/20' },
  high:   { label: 'High effort',   cls: 'text-red-400 bg-red-500/8 border-red-500/20' },
};

// ─── Decision Card ────────────────────────────────────────────────────────────

function DecisionCard({ decision, onDismiss, onAskAI }: {
  decision: Decision;
  onDismiss: () => void;
  onAskAI?: (msg: string) => void;
}) {
  const cfg    = PRIORITY_CONFIG[decision.priority];
  const effort = EFFORT_CONFIG[decision.effort];

  return (
    <div className={`rounded-xl border ${cfg.card} ${cfg.border} overflow-hidden`}>
      <div className="px-4 pt-3.5 pb-1 flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${cfg.dot}`}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[9px] font-bold tracking-[0.1em] uppercase ${cfg.hdr}`}>{cfg.label}</span>
                <span className="text-[9px] font-semibold text-slate-600 uppercase tracking-[0.08em]">{AREA_LABELS[decision.area]}</span>
                {decision.metric && (
                  <span className="text-[10px] font-mono text-slate-500">{decision.metric}</span>
                )}
              </div>
              <div className="text-[13px] font-semibold text-slate-100 leading-snug">{decision.headline}</div>
            </div>
            <button onClick={onDismiss}
              className="flex-shrink-0 text-slate-700 hover:text-slate-400 transition-colors text-sm leading-none mt-0.5">×</button>
          </div>

          <div className="mt-2 text-[12px] text-slate-400 leading-relaxed">{decision.context}</div>
        </div>
      </div>

      {/* Action block */}
      <div className="mx-4 my-3 bg-slate-900/60 border border-slate-700/40 rounded-xl px-4 py-3">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-1.5">Action</div>
        <div className="text-[12px] font-semibold text-slate-100 leading-snug">{decision.action}</div>
        <div className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
          <span className="text-slate-600">Why now: </span>{decision.why}
        </div>
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${effort.cls}`}>{effort.label}</span>
          <span className="text-[10px] font-medium text-slate-500 bg-slate-800/60 border border-slate-700/40 px-2 py-0.5 rounded">{decision.timeframe}</span>
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Help me with: ${decision.action}\n\nContext: ${decision.context}\n\nWhy it matters: ${decision.why}`)}
              className="ml-auto flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
              Ask AI
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface DecisionEngineProps {
  data: UnifiedBusinessData;
  companyName?: string;
  onAskAI?: (msg: string) => void;
  onNavigate?: (view: string) => void;
}

export default function DecisionEngine({ data, companyName = 'Your Company', onAskAI, onNavigate }: DecisionEngineProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [filterArea, setFilterArea] = useState<DecisionArea | 'all'>('all');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bos_decision_dismissed');
      if (saved) setDismissed(JSON.parse(saved));
    } catch { /* ignore */ }
    setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
  }, []);

  const allDecisions = deriveDecisions(data, companyName);
  const visible = allDecisions.filter(d => !dismissed.includes(d.id) && (filterArea === 'all' || d.area === filterArea));

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem('bos_decision_dismissed', JSON.stringify(next)); } catch { /* ignore */ }
    addMemoryEntry('alert-dismissed', `Dismissed decision: ${allDecisions.find(d => d.id === id)?.headline ?? id}`);
  };

  const resetDismissed = () => {
    setDismissed([]);
    try { localStorage.removeItem('bos_decision_dismissed'); } catch { /* ignore */ }
  };

  const critical = visible.filter(d => d.priority === 'critical');
  const high     = visible.filter(d => d.priority === 'high');
  const medium   = visible.filter(d => d.priority === 'medium');
  const info     = visible.filter(d => d.priority === 'info');

  const memFacts = Object.values(loadMemory().facts);
  const recentEntries = loadMemory().entries.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[16px] font-bold text-slate-100">Decision Engine</div>
            <div className="text-[10px] font-semibold text-slate-600 bg-slate-800/60 border border-slate-700/40 px-2 py-0.5 rounded-full uppercase tracking-[0.08em]">
              Live
            </div>
          </div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            {visible.length} action{visible.length !== 1 ? 's' : ''} · updated {lastUpdated}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dismissed.length > 0 && (
            <button onClick={resetDismissed} className="text-[11px] text-slate-600 hover:text-slate-400 border border-slate-800/60 hover:border-slate-700 px-2.5 py-1.5 rounded-lg transition-all">
              Reset ({dismissed.length} hidden)
            </button>
          )}
          {onNavigate && (
            <button onClick={() => onNavigate('acquisitions')}
              className="flex items-center gap-1.5 text-[11px] text-sky-400 hover:text-sky-300 border border-sky-500/20 hover:border-sky-500/40 px-2.5 py-1.5 rounded-lg transition-all font-medium">
              Acquisitions →
            </button>
          )}
        </div>
      </div>

      {/* Area filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'acquisition', 'financial', 'risk', 'operations', 'growth'] as const).map(area => {
          const count = area === 'all' ? visible.length : visible.filter(d => d.area === area).length;
          return (
            <button key={area} onClick={() => setFilterArea(area)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all border ${
                filterArea === area
                  ? 'bg-slate-700/60 border-slate-600 text-slate-200'
                  : 'border-slate-800/60 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}>
              {area === 'all' ? 'All' : AREA_LABELS[area as DecisionArea]}
              {count > 0 && <span className="ml-1.5 text-[9px] font-bold text-slate-500">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* No decisions state */}
      {visible.length === 0 && (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800/40 rounded-2xl">
          <div className="text-[28px] mb-3">✓</div>
          <div className="text-[14px] font-semibold text-slate-300">All clear</div>
          <div className="text-[12px] text-slate-600 mt-1">No high-priority decisions right now — check back after market hours</div>
          {dismissed.length > 0 && (
            <button onClick={resetDismissed} className="mt-4 text-[11px] text-slate-600 hover:text-slate-400 border border-slate-800 px-3 py-1.5 rounded-lg transition-all">
              Show {dismissed.length} dismissed
            </button>
          )}
        </div>
      )}

      {/* Critical */}
      {critical.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold text-red-400 uppercase tracking-[0.1em]">Critical — Act Now</div>
            <div className="flex-1 h-px bg-red-500/15"/>
          </div>
          {critical.map(d => <DecisionCard key={d.id} decision={d} onDismiss={() => dismiss(d.id)} onAskAI={onAskAI}/>)}
        </div>
      )}

      {/* High */}
      {high.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.1em]">High Priority — This Week</div>
            <div className="flex-1 h-px bg-amber-500/15"/>
          </div>
          {high.map(d => <DecisionCard key={d.id} decision={d} onDismiss={() => dismiss(d.id)} onAskAI={onAskAI}/>)}
        </div>
      )}

      {/* Medium */}
      {medium.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.1em]">Medium Priority — 30 Days</div>
            <div className="flex-1 h-px bg-blue-500/15"/>
          </div>
          {medium.map(d => <DecisionCard key={d.id} decision={d} onDismiss={() => dismiss(d.id)} onAskAI={onAskAI}/>)}
        </div>
      )}

      {/* Info */}
      {info.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">For Your Awareness</div>
            <div className="flex-1 h-px bg-slate-800/40"/>
          </div>
          {info.map(d => <DecisionCard key={d.id} decision={d} onDismiss={() => dismiss(d.id)} onAskAI={onAskAI}/>)}
        </div>
      )}

      {/* Memory context */}
      {(memFacts.length > 0 || recentEntries.length > 0) && (
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3.5">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2.5">AI Memory Context</div>
          <div className="space-y-1.5">
            {memFacts.slice(0, 4).map(f => (
              <div key={f.key} className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-600 w-3">·</span>
                <span className="text-slate-500">{f.key}:</span>
                <span className="text-slate-300">{f.value}</span>
              </div>
            ))}
            {recentEntries.map(e => (
              <div key={e.id} className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-700 w-3">·</span>
                <span className="text-slate-600">{new Date(e.timestamp).toLocaleDateString()}</span>
                <span className="text-slate-500 truncate">{e.summary}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
