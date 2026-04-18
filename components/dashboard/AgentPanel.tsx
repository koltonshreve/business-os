import { useState } from 'react';
import type { UnifiedBusinessData } from '../../types';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
}

function Spinner() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin flex-shrink-0">
      <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
      <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
    </svg>
  );
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `$${(n/1_000).toFixed(0)}k` :
  `$${n.toFixed(0)}`;

// ── Score Gauge ──────────────────────────────────────────────────────────────
function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const clamp = Math.min(Math.max(score, 0), 100);
  const color = clamp >= 75 ? '#10b981' : clamp >= 55 ? '#f59e0b' : '#ef4444';
  const r = 36, cx = 48, cy = 48;
  const circumference = Math.PI * r; // half-circle
  const dashOffset = circumference * (1 - clamp / 100);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 96 56" className="w-32">
        {/* Track */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="8" strokeLinecap="round"/>
        {/* Fill */}
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}/>
      </svg>
      <div className="-mt-6 text-center">
        <div className="text-[28px] font-black tracking-tight" style={{ color }}>{score}</div>
        <div className="text-[16px] font-bold text-slate-300 -mt-1">{grade}</div>
        <div className="text-[10px] text-slate-600 mt-0.5">Exit Readiness</div>
      </div>
    </div>
  );
}

// ── Exit Readiness Result ────────────────────────────────────────────────────
function ExitReadinessResult({ result }: { result: Record<string, unknown> }) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const cats = (result.categories as {name:string;score:number;status:string;findings:string[];improvements:string[]}[]) ?? [];
  const vr   = result.valuationRange as {low:number;mid:number;high:number;ebitdaMultiple:string;methodology:string;keyDrivers:string[];keyDetractors:string[]} | undefined;
  const risks = (result.topRisks as {risk:string;detail:string;severity:string}[]) ?? [];
  const actions = (result.readinessActions as {action:string;timeframe:string;impact:string;category:string}[]) ?? [];

  const statusColor = (s: string) => s === 'strong' ? 'text-emerald-400' : s === 'adequate' ? 'text-amber-400' : 'text-red-400';
  const scoreBar = (n: number) => (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
      <div className="h-full rounded-full transition-all"
        style={{ width: `${n}%`, background: n >= 70 ? '#10b981' : n >= 50 ? '#f59e0b' : '#ef4444' }}/>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-6">
        <div className="flex items-start gap-6">
          <ScoreGauge score={result.overallScore as number} grade={result.grade as string}/>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold text-slate-100 leading-snug mb-2">{result.headline as string}</div>
            <div className="text-[13px] text-slate-400 leading-relaxed mb-3">{result.summary as string}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500">Exit window:</span>
              <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">{result.timeline as string}</span>
              <span className="text-[11px] text-slate-500">Buyer:</span>
              <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded-full">{result.buyerProfile as string}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Valuation range */}
      {vr && (
        <div className="bg-gradient-to-br from-emerald-500/6 via-transparent to-transparent border border-emerald-500/15 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-1">Estimated Valuation Range</div>
              <div className="text-[13px] text-slate-400">{vr.methodology}</div>
            </div>
            <span className="text-[12px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-lg">{vr.ebitdaMultiple} EBITDA</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Conservative', value: vr.low, color: 'text-amber-400' },
              { label: 'Base Case',    value: vr.mid, color: 'text-emerald-400' },
              { label: 'Upside',       value: vr.high, color: 'text-emerald-300' },
            ].map(v => (
              <div key={v.label} className="bg-slate-800/40 rounded-xl px-4 py-3 text-center">
                <div className="text-[10px] text-slate-500 mb-1 font-semibold uppercase tracking-wider">{v.label}</div>
                <div className={`text-[20px] font-black tracking-tight ${v.color}`}>{fmt(v.value)}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <div className="text-slate-500 font-semibold mb-1.5">Value Drivers</div>
              {vr.keyDrivers.map((d, i) => <div key={i} className="text-emerald-400/80 flex gap-1.5 mt-0.5"><span>+</span>{d}</div>)}
            </div>
            <div>
              <div className="text-slate-500 font-semibold mb-1.5">Value Detractors</div>
              {vr.keyDetractors.map((d, i) => <div key={i} className="text-red-400/80 flex gap-1.5 mt-0.5"><span>−</span>{d}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cats.map(cat => (
          <div key={cat.name}
            className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedCat(expandedCat === cat.name ? null : cat.name)}
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-slate-800/20 transition-colors text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[12px] font-semibold text-slate-200">{cat.name}</div>
                  <div className={`text-[12px] font-bold ${statusColor(cat.status)}`}>{cat.score}</div>
                </div>
                {scoreBar(cat.score)}
              </div>
              <svg viewBox="0 0 14 14" fill="currentColor"
                className={`w-3.5 h-3.5 text-slate-600 transition-transform flex-shrink-0 ${expandedCat === cat.name ? 'rotate-180' : ''}`}>
                <path d="M2 4l5 6 5-6H2z"/>
              </svg>
            </button>
            {expandedCat === cat.name && (
              <div className="px-4 pb-4 border-t border-slate-800/40 pt-3 space-y-3">
                <div>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Findings</div>
                  {cat.findings.map((f, i) => (
                    <div key={i} className="text-[12px] text-slate-400 flex gap-2 mt-1">
                      <span className="text-indigo-400/60 flex-shrink-0">•</span>{f}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Improvements</div>
                  {cat.improvements.map((f, i) => (
                    <div key={i} className="text-[12px] text-emerald-400/80 flex gap-2 mt-1">
                      <span className="flex-shrink-0">→</span>{f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Risks + Actions side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="text-[12px] font-semibold text-slate-300 mb-3">Top Risks</div>
          <div className="space-y-2.5">
            {risks.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${
                  r.severity === 'HIGH' ? 'text-red-400 bg-red-500/10 border-red-500/25' :
                  r.severity === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
                  'text-slate-400 bg-slate-800/60 border-slate-700/50'
                }`}>{r.severity}</span>
                <div>
                  <div className="text-[12px] font-semibold text-slate-200">{r.risk}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="text-[12px] font-semibold text-slate-300 mb-3">Readiness Actions</div>
          <div className="space-y-2.5">
            {actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${
                  a.impact === 'HIGH' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' :
                  'text-slate-400 bg-slate-800/60 border-slate-700/50'
                }`}>{a.timeframe}</span>
                <div>
                  <div className="text-[12px] font-semibold text-slate-200">{a.action}</div>
                  <div className="text-[10px] text-indigo-400/60 mt-0.5 capitalize">{a.category}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Growth Playbook Result ───────────────────────────────────────────────────
function GrowthPlaybookResult({ result }: { result: Record<string, unknown> }) {
  const levers = (result.levers as {name:string;description:string;revenueOpportunity:string;timeToRealize:string;effort:string;confidence:string;actions:string[];owner:string}[]) ?? [];
  const pm     = result.priorityMatrix as {doNow:string[];planFor:string[];avoid:string[]} | undefined;
  const rm     = result.revenueModel as {currentMix:string;recommendedMix:string;rationale:string} | undefined;

  const effortColor = (e: string) => e === 'LOW' ? 'text-emerald-400' : e === 'MEDIUM' ? 'text-amber-400' : 'text-red-400';
  const confColor   = (c: string) => c === 'HIGH' ? 'text-emerald-400' : c === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-sky-500/6 via-transparent to-transparent border border-sky-500/15 rounded-2xl p-5">
        <div className="text-[10px] font-semibold text-sky-400/70 uppercase tracking-wider mb-1">Biggest Opportunity</div>
        <div className="text-[16px] font-bold text-slate-100 mb-2">{result.headline as string}</div>
        <div className="text-[20px] font-black text-sky-300">{result.totalOpportunity as string}</div>
        <div className="text-[12px] text-slate-500 mt-0.5">additional revenue achievable in 12 months</div>
      </div>

      {/* Growth levers */}
      <div className="space-y-3">
        {levers.map((lever, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-slate-100">{lever.name}</div>
                <div className="text-[12px] text-slate-400 mt-0.5 leading-snug">{lever.description}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[15px] font-bold text-emerald-400">{lever.revenueOpportunity}</div>
                <div className="text-[10px] text-slate-500">{lever.timeToRealize}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2.5">
              <span className={`text-[10px] font-bold ${effortColor(lever.effort)}`}>Effort: {lever.effort}</span>
              <span className="text-slate-700">·</span>
              <span className={`text-[10px] font-bold ${confColor(lever.confidence)}`}>Confidence: {lever.confidence}</span>
              <span className="text-slate-700">·</span>
              <span className="text-[10px] text-slate-500">{lever.owner}</span>
            </div>
            <div className="space-y-1">
              {lever.actions.map((a, j) => (
                <div key={j} className="text-[11px] text-slate-400 flex gap-2">
                  <span className="text-sky-400/60 flex-shrink-0">→</span>{a}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Priority matrix */}
      {pm && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Do Now', items: pm.doNow, color: 'text-emerald-400', bg: 'bg-emerald-500/5 border-emerald-500/15' },
            { label: 'Plan For', items: pm.planFor, color: 'text-amber-400', bg: 'bg-amber-500/5 border-amber-500/15' },
            { label: 'Avoid', items: pm.avoid, color: 'text-red-400', bg: 'bg-red-500/5 border-red-500/15' },
          ].map(col => (
            <div key={col.label} className={`rounded-xl border p-4 ${col.bg}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider mb-2.5 ${col.color}`}>{col.label}</div>
              <div className="space-y-1.5">
                {col.items.map((item, i) => (
                  <div key={i} className="text-[11px] text-slate-400 leading-snug">{item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Revenue model */}
      {rm && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-3">
          <div className="text-[12px] font-semibold text-slate-300">Revenue Mix Recommendation</div>
          <div className="grid grid-cols-2 gap-4 text-[12px]">
            <div><div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Current</div><div className="text-slate-400 leading-relaxed">{rm.currentMix}</div></div>
            <div><div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Recommended</div><div className="text-emerald-400/80 leading-relaxed">{rm.recommendedMix}</div></div>
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-800/60">{rm.rationale}</div>
        </div>
      )}
    </div>
  );
}

// ── 90-Day Action Plan Result ────────────────────────────────────────────────
function ActionPlanResult({ result }: { result: Record<string, unknown> }) {
  const [activeWeek, setActiveWeek] = useState<string | null>(null);
  const cats   = (result.categories as {name:string;goal:string;actions:{action:string;why:string;owner:string;deadline:string;expectedImpact:string;effort:string;priority:number}[]}[]) ?? [];
  const weeks  = (result.weekByWeek as {week:string;focus:string;deliverables:string[]}[]) ?? [];
  const metrics = (result.successMetrics as {metric:string;baseline:string;target:string;measurement:string}[]) ?? [];
  const risks   = (result.risks as string[]) ?? [];

  const effortColor = (e: string) => e === 'LOW' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : e === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-red-400 bg-red-500/10 border-red-500/25';

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-500/6 via-transparent to-transparent border border-violet-500/15 rounded-2xl p-5">
        <div className="text-[10px] font-semibold text-violet-400/70 uppercase tracking-wider mb-1">Quarter Theme</div>
        <div className="text-[16px] font-bold text-slate-100 mb-2">{result.theme as string}</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">North Star:</span>
          <span className="text-[12px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-lg">{result.northStar as string}</span>
        </div>
      </div>

      {/* Week-by-week timeline */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="text-[12px] font-semibold text-slate-300 mb-3">Week-by-Week Sprint Plan</div>
        <div className="space-y-2">
          {weeks.map((w, i) => (
            <button key={i}
              onClick={() => setActiveWeek(activeWeek === w.week ? null : w.week)}
              className={`w-full text-left rounded-xl p-3.5 border transition-all ${
                activeWeek === w.week ? 'bg-violet-500/8 border-violet-500/20' : 'bg-slate-800/20 border-slate-700/40 hover:bg-slate-800/40'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-slate-700/60 border border-slate-600/50 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400">{w.week}</div>
                    <div className="text-[12px] font-semibold text-slate-200">{w.focus}</div>
                  </div>
                </div>
                <svg viewBox="0 0 14 14" fill="currentColor"
                  className={`w-3.5 h-3.5 text-slate-600 transition-transform flex-shrink-0 ${activeWeek === w.week ? 'rotate-180' : ''}`}>
                  <path d="M2 4l5 6 5-6H2z"/>
                </svg>
              </div>
              {activeWeek === w.week && (
                <div className="mt-2.5 pl-9 space-y-1">
                  {w.deliverables.map((d, j) => (
                    <div key={j} className="text-[11px] text-violet-300/80 flex gap-2">
                      <span className="flex-shrink-0">✓</span>{d}
                    </div>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Category actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cats.map(cat => (
          <div key={cat.name} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="mb-3">
              <div className="text-[12px] font-semibold text-slate-100">{cat.name}</div>
              <div className="text-[11px] text-violet-400/70 mt-0.5">{cat.goal}</div>
            </div>
            <div className="space-y-2.5">
              {cat.actions.slice(0, 3).map((a, i) => (
                <div key={i} className="border-l-2 border-slate-700/60 pl-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${effortColor(a.effort)}`}>{a.effort}</span>
                    <span className="text-[11px] font-semibold text-slate-200 leading-snug">{a.action}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{a.owner} · {a.deadline}</div>
                  {a.expectedImpact && <div className="text-[10px] text-emerald-400/70 mt-0.5">{a.expectedImpact}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Metrics + Risks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-slate-300 mb-3">Success Metrics</div>
          <div className="space-y-2.5">
            {metrics.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 text-[12px] font-medium text-slate-300">{m.metric}</div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">{m.baseline}</div>
                  <div className="text-[12px] font-bold text-emerald-400">→ {m.target}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-slate-300 mb-3">Execution Risks</div>
          <div className="space-y-2">
            {risks.map((r, i) => (
              <div key={i} className="text-[11px] text-amber-400/80 flex gap-2">
                <span className="flex-shrink-0 mt-0.5">⚠</span>{r}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Board Prep Result ────────────────────────────────────────────────────────
function BoardPrepResult({ result }: { result: Record<string, unknown> }) {
  const [showAllQA, setShowAllQA] = useState(false);
  const points    = (result.talkingPoints as {point:string;category:string;priority:string}[]) ?? [];
  const qa        = (result.anticipatedQuestions as {question:string;suggestedAnswer:string;difficulty:string}[]) ?? [];
  const asks      = (result.keyAsks as {ask:string;rationale:string;category:string}[]) ?? [];
  const doNotSay  = (result.doNotSay as string[]) ?? [];

  const priorityColor = (p: string) =>
    p === 'OPEN' ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25' :
    p === 'PROACTIVE' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
    'text-slate-400 bg-slate-800/60 border-slate-700/50';

  const diffColor = (d: string) => d === 'hard' ? 'text-red-400' : d === 'medium' ? 'text-amber-400' : 'text-emerald-400';

  const visibleQA = showAllQA ? qa : qa.slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Opening + Closing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-indigo-500/6 to-transparent border border-indigo-500/15 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-indigo-400/70 uppercase tracking-wider mb-2">Opening Statement</div>
          <div className="text-[13px] text-slate-200 font-medium leading-relaxed italic">"{result.openingStatement as string}"</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/6 to-transparent border border-emerald-500/15 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider mb-2">Closing Ask</div>
          <div className="text-[13px] text-slate-200 font-medium leading-relaxed italic">"{result.closingAsk as string}"</div>
        </div>
      </div>

      {/* Talking points */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="text-[12px] font-semibold text-slate-300 mb-3">Talking Points ({points.length})</div>
        <div className="space-y-2">
          {points.map((p, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-slate-800/30 transition-colors">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${priorityColor(p.priority)}`}>{p.priority}</span>
              <div className="text-[12px] text-slate-300 leading-relaxed">{p.point}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Q&A Prep */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="text-[12px] font-semibold text-slate-300 mb-3">Anticipated Questions</div>
        <div className="space-y-3">
          {visibleQA.map((q, i) => (
            <div key={i} className="border-l-2 border-slate-700/50 pl-3 hover:border-indigo-500/40 transition-colors">
              <div className="flex items-start gap-2 mb-1">
                <span className={`text-[10px] font-bold capitalize flex-shrink-0 mt-0.5 ${diffColor(q.difficulty)}`}>{q.difficulty}</span>
                <div className="text-[12px] font-semibold text-slate-200">{q.question}</div>
              </div>
              <div className="text-[12px] text-slate-400 leading-relaxed">{q.suggestedAnswer}</div>
            </div>
          ))}
        </div>
        {qa.length > 3 && (
          <button onClick={() => setShowAllQA(!showAllQA)}
            className="mt-3 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            {showAllQA ? 'Show less' : `Show all ${qa.length} questions →`}
          </button>
        )}
      </div>

      {/* Key asks + Don't say */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-slate-300 mb-3">Key Asks ({asks.length})</div>
          <div className="space-y-3">
            {asks.map((a, i) => (
              <div key={i}>
                <div className="text-[12px] font-semibold text-slate-200">{a.ask}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{a.rationale}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-red-500/4 border border-red-500/15 rounded-xl p-4">
          <div className="text-[12px] font-semibold text-red-400/80 mb-3">Do Not Say</div>
          <div className="space-y-2">
            {doNotSay.map((d, i) => (
              <div key={i} className="text-[11px] text-slate-400 flex gap-2 leading-snug">
                <span className="text-red-400/60 flex-shrink-0">✕</span>{d}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Agent Card (idle state) ──────────────────────────────────────────────────
interface AgentConfig {
  id: string;
  label: string;
  tagline: string;
  description: string;
  emoji: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  estimatedTime: string;
  outputPreview: string[];
}

const AGENTS: AgentConfig[] = [
  {
    id:           'exit-readiness',
    label:        'Exit Readiness Score',
    tagline:      'Know your number before a buyer does',
    description:  'Full sell-side assessment: overall readiness score, valuation range with EBITDA multiples, category-by-category scoring, top risks, and a prioritized improvement roadmap.',
    emoji:        '🏷️',
    accent:       'text-emerald-400',
    accentBg:     'bg-emerald-500/8',
    accentBorder: 'border-emerald-500/20',
    estimatedTime: '~20 seconds',
    outputPreview: ['Readiness score + grade', 'Valuation range (low/mid/high)', 'Category scores', 'Risk matrix', 'Pre-exit action plan'],
  },
  {
    id:           'growth-playbook',
    label:        'Growth Playbook',
    tagline:      'Find the highest-ROI growth levers',
    description:  'Identifies your 4 biggest revenue growth opportunities with specific dollar amounts, effort ratings, confidence levels, and step-by-step action plans for each lever.',
    emoji:        '🚀',
    accent:       'text-sky-400',
    accentBg:     'bg-sky-500/8',
    accentBorder: 'border-sky-500/20',
    estimatedTime: '~18 seconds',
    outputPreview: ['Total revenue opportunity', '4+ growth levers', 'Effort vs. confidence matrix', 'Do now / plan for / avoid', 'Revenue mix recommendation'],
  },
  {
    id:           'action-plan',
    label:        '90-Day Action Plan',
    tagline:      'From insight to execution in one report',
    description:  'Prioritized 90-day execution roadmap with week-by-week sprint schedule, action owners, deadlines, expected impact, and success metrics to track progress.',
    emoji:        '📋',
    accent:       'text-violet-400',
    accentBg:     'bg-violet-500/8',
    accentBorder: 'border-violet-500/20',
    estimatedTime: '~20 seconds',
    outputPreview: ['Quarter theme + north star', 'Week-by-week sprints', '4 action categories', 'Owner + deadline per action', 'Success metrics baseline'],
  },
  {
    id:           'board-prep',
    label:        'Board Meeting Prep',
    tagline:      'Walk in confident and prepared',
    description:  'Complete board meeting prep package: opening statement, 6+ talking points, anticipated hard questions with model answers, key asks, and a closing ask.',
    emoji:        '🎯',
    accent:       'text-indigo-400',
    accentBg:     'bg-indigo-500/8',
    accentBorder: 'border-indigo-500/20',
    estimatedTime: '~18 seconds',
    outputPreview: ['Opening + closing statement', '6+ talking points', '5+ Q&A pairs', 'Key board asks', 'Do-not-say list'],
  },
];

// ── Main Component ───────────────────────────────────────────────────────────
export default function AgentPanel({ data, previousData }: Props) {
  const [results, setResults]   = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  async function runAgent(agentId: string) {
    setLoading(agentId);
    setError(null);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: agentId, data, previousData }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setResults(prev => ({ ...prev, [agentId]: json.result }));
        setActiveAgent(agentId);
      }
    } catch {
      setError('Agent failed. Check your API key and try again.');
    } finally {
      setLoading(null);
    }
  }

  const hasResult = (id: string) => !!results[id];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[14px] font-bold text-slate-100">AI Advisory Agents</div>
          <div className="text-[12px] text-slate-500 mt-0.5">Each agent runs a deep analysis of your business data and produces a structured, actionable output</div>
        </div>
        {activeAgent && (
          <button onClick={() => setActiveAgent(null)}
            className="text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
            ← All Agents
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 text-[13px] text-red-400">{error}</div>
      )}

      {/* Agent result view */}
      {activeAgent && results[activeAgent] ? (
        <div>
          <div className="flex items-center gap-3 mb-5">
            {AGENTS.filter(a => a.id === activeAgent).map(agent => (
              <div key={agent.id} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xl ${agent.accentBg} ${agent.accentBorder}`}>
                  {agent.emoji}
                </div>
                <div>
                  <div className={`text-[14px] font-bold ${agent.accent}`}>{agent.label}</div>
                  <div className="text-[11px] text-slate-500">{agent.tagline}</div>
                </div>
              </div>
            ))}
            <div className="ml-auto">
              <button
                onClick={() => runAgent(activeAgent)}
                disabled={loading === activeAgent}
                className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
                {loading === activeAgent ? <><Spinner/>Regenerating…</> : '↺ Regenerate'}
              </button>
            </div>
          </div>
          {activeAgent === 'exit-readiness' && <ExitReadinessResult result={results[activeAgent]}/>}
          {activeAgent === 'growth-playbook' && <GrowthPlaybookResult result={results[activeAgent]}/>}
          {activeAgent === 'action-plan'     && <ActionPlanResult result={results[activeAgent]}/>}
          {activeAgent === 'board-prep'      && <BoardPrepResult result={results[activeAgent]}/>}
        </div>
      ) : (
        /* Agent cards grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {AGENTS.map(agent => {
            const ran     = hasResult(agent.id);
            const isLoading = loading === agent.id;
            return (
              <div key={agent.id}
                className={`bg-slate-900/50 border rounded-2xl p-5 transition-all ${agent.accentBorder} ${ran ? agent.accentBg : 'border-slate-800/60'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-2xl flex-shrink-0 ${agent.accentBg} ${agent.accentBorder}`}>
                    {agent.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] font-bold ${agent.accent}`}>{agent.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{agent.tagline}</div>
                  </div>
                  {ran && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full flex-shrink-0">Done</span>}
                </div>

                <div className="text-[12px] text-slate-500 leading-relaxed mb-4">{agent.description}</div>

                <div className="space-y-1 mb-4">
                  {agent.outputPreview.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className={`flex-shrink-0 font-bold ${agent.accent}`}>✓</span>{item}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runAgent(agent.id)}
                    disabled={!!loading}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40 ${
                      ran ? `border ${agent.accentBorder} ${agent.accent} hover:opacity-80` :
                      'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}>
                    {isLoading
                      ? <><Spinner/>{ran ? 'Regenerating…' : 'Running…'}</>
                      : ran ? '↺ Regenerate' : `Run ${agent.label}`
                    }
                  </button>
                  {ran && (
                    <button
                      onClick={() => setActiveAgent(agent.id)}
                      className={`px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-all ${agent.accentBg} ${agent.accentBorder} ${agent.accent} hover:opacity-80`}>
                      View →
                    </button>
                  )}
                </div>
                {!ran && (
                  <div className="text-center mt-2 text-[10px] text-slate-700">{agent.estimatedTime}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
