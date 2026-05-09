import { useState, useEffect, useRef } from 'react';
import type { UnifiedBusinessData } from '../../types';
import { loadAuthSession, authHeaders } from '../../lib/auth';

interface CompanyProfile {
  industry?: string;
  revenueModel?: string;
}

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  companyName?: string;
  companyProfile?: CompanyProfile;
}

function Spinner() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin flex-shrink-0">
      <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
      <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
    </svg>
  );
}

const fmt = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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

// ── Print / Export utilities ─────────────────────────────────────────────────
function openPrintWindow(title: string, bodyHtml: string) {
  const html = `<!DOCTYPE html><html><head><title>${title}</title><style>
    body{font-family:Georgia,serif;max-width:780px;margin:2.5rem auto;color:#111;padding:0 1.5rem;line-height:1.6;}
    h1{font-size:1.4rem;font-weight:700;margin-bottom:4px;}
    h2{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#666;margin:2rem 0 .6rem;}
    p,li{font-size:.9rem;margin:.4rem 0;}
    ul{padding-left:1.2rem;} li{margin:.3rem 0;}
    .tag{display:inline-block;font-size:.7rem;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid #d1d5db;margin-right:6px;vertical-align:middle;}
    .tag-red{color:#dc2626;border-color:#fca5a5;} .tag-amber{color:#d97706;border-color:#fcd34d;} .tag-green{color:#059669;border-color:#6ee7b7;} .tag-blue{color:#4f46e5;border-color:#a5b4fc;}
    hr{border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;}
    .meta{color:#888;font-size:.75rem;margin-bottom:2rem;}
    @media print{body{margin:0;}}
  </style></head><body>${bodyHtml}<script>window.onload=()=>window.print();</script></body></html>`;
  const w = window.open('', '_blank');
  w?.document.write(html);
  w?.document.close();
}

function buildPlainText(agentId: string, result: Record<string, unknown>): string {
  const lines: string[] = [];
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (agentId === 'exit-readiness') {
    const cats = (result.categories as {name:string;score:number;findings:string[];improvements:string[]}[]) ?? [];
    const vr = result.valuationRange as {low:number;mid:number;high:number;ebitdaMultiple:string;methodology:string} | undefined;
    const risks = (result.topRisks as {risk:string;detail:string;severity:string}[]) ?? [];
    const actions = (result.readinessActions as {action:string;timeframe:string;impact:string}[]) ?? [];
    const fmtN = (n: number) => { const abs = Math.abs(n); return abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; };
    lines.push(`EXIT READINESS REPORT — ${date}`);
    lines.push(`Score: ${result.overallScore}/100 (${result.grade})`);
    lines.push('');
    lines.push(String(result.headline ?? ''));
    lines.push(String(result.summary ?? ''));
    if (vr) { lines.push(''); lines.push(`VALUATION: ${fmtN(vr.low)} – ${fmtN(vr.mid)} – ${fmtN(vr.high)} (${vr.ebitdaMultiple} EBITDA)`); lines.push(vr.methodology); }
    lines.push(''); lines.push('CATEGORY SCORES');
    cats.forEach(c => { lines.push(`${c.name}: ${c.score}/100`); c.findings.forEach(f => lines.push(`  • ${f}`)); c.improvements.forEach(i => lines.push(`  → ${i}`)); lines.push(''); });
    lines.push('TOP RISKS');
    risks.forEach(r => lines.push(`[${r.severity}] ${r.risk}: ${r.detail}`));
    lines.push(''); lines.push('ACTIONS');
    actions.forEach(a => lines.push(`[${a.timeframe}] ${a.action}`));
    lines.push(''); lines.push(`Exit Window: ${result.timeline as string} | Buyer: ${result.buyerProfile as string}`);
  } else if (agentId === 'growth-playbook') {
    const levers = (result.levers as {name:string;description:string;revenueOpportunity:string;timeToRealize:string;effort:string;actions:string[]}[]) ?? [];
    const pm = result.priorityMatrix as {doNow:string[];planFor:string[];avoid:string[]} | undefined;
    lines.push(`GROWTH PLAYBOOK — ${date}`);
    lines.push(String(result.headline ?? ''));
    lines.push(`Total opportunity: ${result.totalOpportunity as string}`);
    levers.forEach(l => { lines.push(''); lines.push(`${l.name} — ${l.revenueOpportunity} (${l.timeToRealize}, effort: ${l.effort})`); lines.push(l.description); l.actions.forEach(a => lines.push(`  → ${a}`)); });
    if (pm) { lines.push(''); lines.push('DO NOW: ' + pm.doNow.join('; ')); lines.push('PLAN FOR: ' + pm.planFor.join('; ')); lines.push('AVOID: ' + pm.avoid.join('; ')); }
  } else if (agentId === 'action-plan') {
    const cats  = (result.categories as {name:string;goal:string;actions:{action:string;owner:string;deadline:string;expectedImpact:string}[]}[]) ?? [];
    const weeks = (result.weekByWeek as {week:string;focus:string;deliverables:string[]}[]) ?? [];
    const metrics = (result.successMetrics as {metric:string;baseline:string;target:string}[]) ?? [];
    lines.push(`90-DAY ACTION PLAN — ${date}`);
    lines.push(`Theme: ${result.theme as string}`);
    lines.push(`North Star: ${result.northStar as string}`);
    lines.push(''); lines.push('SPRINT SCHEDULE');
    weeks.forEach(w => { lines.push(`${w.week} — ${w.focus}`); w.deliverables.forEach(d => lines.push(`  ✓ ${d}`)); });
    cats.forEach(c => { lines.push(''); lines.push(`${c.name.toUpperCase()} — Goal: ${c.goal}`); c.actions.forEach(a => lines.push(`  [${a.deadline}] ${a.action} (${a.owner})${a.expectedImpact ? ` → ${a.expectedImpact}` : ''}`)); });
    lines.push(''); lines.push('METRICS');
    metrics.forEach(m => lines.push(`${m.metric}: ${m.baseline} → ${m.target}`));
  } else if (agentId === 'board-prep') {
    const points = (result.talkingPoints as {point:string;priority:string}[]) ?? [];
    const qa     = (result.anticipatedQuestions as {question:string;suggestedAnswer:string;difficulty:string}[]) ?? [];
    const asks   = (result.keyAsks as {ask:string;rationale:string}[]) ?? [];
    const dns    = (result.doNotSay as string[]) ?? [];
    lines.push(`BOARD MEETING PREP — ${date}`);
    lines.push(`Opening: "${result.openingStatement as string}"`);
    lines.push(`Closing Ask: "${result.closingAsk as string}"`);
    lines.push(''); lines.push('TALKING POINTS');
    points.forEach(p => lines.push(`[${p.priority}] ${p.point}`));
    lines.push(''); lines.push('Q&A PREP');
    qa.forEach(q => { lines.push(`Q [${q.difficulty}]: ${q.question}`); lines.push(`A: ${q.suggestedAnswer}`); lines.push(''); });
    lines.push('KEY ASKS');
    asks.forEach(a => { lines.push(`• ${a.ask}`); lines.push(`  ${a.rationale}`); });
    if (dns.length) { lines.push(''); lines.push('DO NOT SAY'); dns.forEach(d => lines.push(`✕ ${d}`)); }
  } else if (agentId === 'cfo-scorecard') {
    const kpis    = (result.kpis as {name:string;value:string;status:string;trend:string;insight:string;action:string}[]) ?? [];
    const risks   = (result.topRisks as {risk:string;detail:string;urgency:string}[]) ?? [];
    const cfoPris = (result.cfoPriorities as {priority:string;why:string;by:string}[]) ?? [];
    lines.push(`CFO SCORECARD — ${date}`);
    lines.push(`Overall Health: ${result.overallHealth as string}`);
    lines.push(`${result.headline as string}`);
    lines.push(''); lines.push('KPIs');
    kpis.forEach(k => lines.push(`[${k.status}] ${k.name}: ${k.value} (${k.trend})${k.status !== 'GREEN' ? ` → ${k.action}` : ''}`));
    lines.push(''); lines.push('TOP RISKS');
    risks.forEach(r => lines.push(`[${r.urgency}] ${r.risk}: ${r.detail}`));
    lines.push(''); lines.push('CFO PRIORITIES');
    cfoPris.forEach(p => lines.push(`• ${p.priority} (${p.by}) — ${p.why}`));
  } else if (agentId === 'cash-working-capital') {
    const dso  = result.dso as {estimate:number;status:string;insight:string;action:string} | undefined;
    const dpo  = result.dpo as {estimate:number;status:string;insight:string} | undefined;
    const ccc  = result.cashConversionCycle as {estimate:number;insight:string;improvement:string} | undefined;
    const wca  = (result.workingCapitalActions as {action:string;cashImpact:string;timeframe:string}[]) ?? [];
    const cfRisks = (result.cashFlowRisks as {risk:string;impact:string;mitigation:string}[]) ?? [];
    lines.push(`CASH & WORKING CAPITAL ANALYSIS — ${date}`);
    lines.push(`Cash Health: ${result.cashHealth as string} | Runway: ${result.runwayMonths} months`);
    lines.push(result.headline as string);
    if (dso) lines.push(`DSO: ${dso.estimate} days [${dso.status}] — ${dso.insight}`);
    if (dpo) lines.push(`DPO: ${dpo.estimate} days [${dpo.status}] — ${dpo.insight}`);
    if (ccc) lines.push(`CCC: ${ccc.estimate} days — ${ccc.insight}`);
    lines.push(''); lines.push('WORKING CAPITAL ACTIONS');
    wca.forEach(a => lines.push(`• ${a.action} (${a.cashImpact}, ${a.timeframe})`));
    lines.push(''); lines.push('CASH FLOW RISKS');
    cfRisks.forEach(r => lines.push(`⚠ ${r.risk} (${r.impact}) → ${r.mitigation}`));
  }
  return lines.join('\n');
}

function exportExitReadiness(result: Record<string, unknown>) {
  const cats = (result.categories as {name:string;score:number;status:string;findings:string[];improvements:string[]}[]) ?? [];
  const vr   = result.valuationRange as {low:number;mid:number;high:number;ebitdaMultiple:string;methodology:string;keyDrivers:string[];keyDetractors:string[]} | undefined;
  const risks = (result.topRisks as {risk:string;detail:string;severity:string}[]) ?? [];
  const actions = (result.readinessActions as {action:string;timeframe:string;impact:string;category:string}[]) ?? [];
  const fmtN = (n: number) => { const abs = Math.abs(n); return abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; };
  const body = `
    <h1>Exit Readiness Score: ${result.overallScore} / 100 (${result.grade})</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    <p><strong>${result.headline as string}</strong></p>
    <p>${result.summary as string}</p>
    <hr>
    ${vr ? `<h2>Valuation Range (${vr.ebitdaMultiple} EBITDA)</h2>
    <p>Conservative: ${fmtN(vr.low)} &nbsp;|&nbsp; Base: ${fmtN(vr.mid)} &nbsp;|&nbsp; Upside: ${fmtN(vr.high)}</p>
    <p>${vr.methodology}</p><hr>` : ''}
    <h2>Category Scores</h2>
    ${cats.map(c => `<p><strong>${c.name} — ${c.score}/100</strong><br>
      ${c.findings.map(f => `&nbsp;&nbsp;• ${f}`).join('<br>')}<br>
      <em>Improvements: ${c.improvements.join(' / ')}</em></p>`).join('')}
    <hr>
    <h2>Top Risks</h2>
    ${risks.map(r => `<p><span class="tag tag-${r.severity==='HIGH'?'red':r.severity==='MEDIUM'?'amber':'green'}">${r.severity}</span><strong>${r.risk}</strong> — ${r.detail}</p>`).join('')}
    <hr>
    <h2>Readiness Actions</h2>
    ${actions.map(a => `<p><span class="tag tag-blue">${a.timeframe}</span>${a.action}</p>`).join('')}
    <hr>
    <p><strong>Exit Window:</strong> ${result.timeline as string} &nbsp;|&nbsp; <strong>Buyer Profile:</strong> ${result.buyerProfile as string}</p>
  `;
  openPrintWindow('Exit Readiness Report', body);
}

function exportGrowthPlaybook(result: Record<string, unknown>) {
  const levers = (result.levers as {name:string;description:string;revenueOpportunity:string;timeToRealize:string;effort:string;confidence:string;actions:string[];owner:string}[]) ?? [];
  const pm = result.priorityMatrix as {doNow:string[];planFor:string[];avoid:string[]} | undefined;
  const rm = result.revenueModel as {currentMix:string;recommendedMix:string;rationale:string} | undefined;
  const body = `
    <h1>Growth Playbook</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    <p><strong>${result.headline as string}</strong></p>
    <p>Total opportunity: <strong>${result.totalOpportunity as string}</strong></p>
    <hr>
    <h2>Growth Levers</h2>
    ${levers.map(l => `<p><strong>${l.name}</strong> — <span style="color:#059669">${l.revenueOpportunity}</span> in ${l.timeToRealize}<br>
      ${l.description}<br>
      Effort: ${l.effort} · Confidence: ${l.confidence} · Owner: ${l.owner}<br>
      ${l.actions.map(a => `→ ${a}`).join('<br>')}</p>`).join('<hr style="border-color:#f3f4f6">')}
    ${pm ? `<hr><h2>Priority Matrix</h2>
      <p><strong>Do Now:</strong> ${pm.doNow.join('; ')}</p>
      <p><strong>Plan For:</strong> ${pm.planFor.join('; ')}</p>
      <p><strong>Avoid:</strong> ${pm.avoid.join('; ')}</p>` : ''}
    ${rm ? `<hr><h2>Revenue Mix Recommendation</h2>
      <p>Current: ${rm.currentMix}</p>
      <p>Recommended: ${rm.recommendedMix}</p>
      <p>${rm.rationale}</p>` : ''}
  `;
  openPrintWindow('Growth Playbook', body);
}

function exportActionPlan(result: Record<string, unknown>) {
  const cats  = (result.categories as {name:string;goal:string;actions:{action:string;why:string;owner:string;deadline:string;expectedImpact:string;effort:string}[]}[]) ?? [];
  const weeks = (result.weekByWeek as {week:string;focus:string;deliverables:string[]}[]) ?? [];
  const metrics = (result.successMetrics as {metric:string;baseline:string;target:string}[]) ?? [];
  const risks = (result.risks as string[]) ?? [];
  const body = `
    <h1>90-Day Action Plan</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    <p><strong>Theme:</strong> ${result.theme as string}</p>
    <p><strong>North Star:</strong> ${result.northStar as string}</p>
    <hr>
    <h2>Sprint Schedule</h2>
    ${weeks.map(w => `<p><strong>${w.week} — ${w.focus}</strong><br>${w.deliverables.map(d => `&nbsp;&nbsp;✓ ${d}`).join('<br>')}</p>`).join('')}
    <hr>
    ${cats.map(c => `<h2>${c.name}</h2><p><em>Goal: ${c.goal}</em></p>
      ${c.actions.map(a => `<p>[${a.effort}] <strong>${a.action}</strong><br>
        Owner: ${a.owner} · ${a.deadline}${a.expectedImpact ? ` · ${a.expectedImpact}` : ''}</p>`).join('')}`).join('<hr style="border-color:#f3f4f6">')}
    <hr>
    <h2>Success Metrics</h2>
    ${metrics.map(m => `<p>${m.metric}: ${m.baseline} → <strong>${m.target}</strong></p>`).join('')}
    ${risks.length ? `<hr><h2>Execution Risks</h2>${risks.map(r => `<p>⚠ ${r}</p>`).join('')}` : ''}
  `;
  openPrintWindow('90-Day Action Plan', body);
}

function exportBoardPrep(result: Record<string, unknown>) {
  const points   = (result.talkingPoints as {point:string;category:string;priority:string}[]) ?? [];
  const qa       = (result.anticipatedQuestions as {question:string;suggestedAnswer:string;difficulty:string}[]) ?? [];
  const asks     = (result.keyAsks as {ask:string;rationale:string}[]) ?? [];
  const doNotSay = (result.doNotSay as string[]) ?? [];
  const body = `
    <h1>Board Meeting Prep</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    <p><strong>Opening:</strong> "${result.openingStatement as string}"</p>
    <p><strong>Closing Ask:</strong> "${result.closingAsk as string}"</p>
    <hr>
    <h2>Talking Points (${points.length})</h2>
    ${points.map(p => `<p><span class="tag tag-blue">${p.priority}</span>${p.point}</p>`).join('')}
    <hr>
    <h2>Anticipated Q&A</h2>
    ${qa.map(q => `<p><strong>[${q.difficulty.toUpperCase()}] ${q.question}</strong><br>${q.suggestedAnswer}</p>`).join('')}
    <hr>
    <h2>Key Asks</h2>
    ${asks.map(a => `<p><strong>${a.ask}</strong><br>${a.rationale}</p>`).join('')}
    ${doNotSay.length ? `<hr><h2>Do Not Say</h2>${doNotSay.map(d => `<p>✕ ${d}</p>`).join('')}` : ''}
  `;
  openPrintWindow('Board Meeting Prep', body);
}

function exportCfoScorecard(result: Record<string, unknown>) {
  const kpis    = (result.kpis as {name:string;value:string;benchmark:string;status:string;trend:string;insight:string;action:string}[]) ?? [];
  const risks   = (result.topRisks as {risk:string;detail:string;urgency:string}[]) ?? [];
  const cfoPris = (result.cfoPriorities as {priority:string;why:string;by:string}[]) ?? [];
  const date    = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const statusColor = (s: string) => s === 'GREEN' ? '#10b981' : s === 'YELLOW' ? '#f59e0b' : '#ef4444';
  const body = `
    <h1>CFO Scorecard — Overall: ${result.overallHealth as string}</h1>
    <div class="meta">Generated ${date}</div>
    <p>${result.headline as string}</p>
    <hr>
    <h2>KPI Dashboard</h2>
    ${kpis.map(k => `<p style="border-left:3px solid ${statusColor(k.status)};padding-left:8px;margin:8px 0"><strong>[${k.status}] ${k.name}: ${k.value}</strong><br><em>${k.benchmark}</em><br>${k.insight}${k.status !== 'GREEN' ? `<br>→ ${k.action}` : ''}</p>`).join('')}
    <hr>
    <h2>Top Risks</h2>
    ${risks.map(r => `<p><strong>[${r.urgency}] ${r.risk}</strong><br>${r.detail}</p>`).join('')}
    <hr>
    <h2>CFO Priorities</h2>
    ${cfoPris.map(p => `<p><strong>${p.priority}</strong> (${p.by})<br>${p.why}</p>`).join('')}
  `;
  openPrintWindow('CFO Scorecard', body);
}

function exportCashWorkingCapital(result: Record<string, unknown>) {
  const dso   = result.dso as {estimate:number;status:string;insight:string;action:string} | undefined;
  const dpo   = result.dpo as {estimate:number;status:string;insight:string} | undefined;
  const ccc   = result.cashConversionCycle as {estimate:number;insight:string;improvement:string} | undefined;
  const wca   = (result.workingCapitalActions as {action:string;cashImpact:string;timeframe:string}[]) ?? [];
  const cfRisks = (result.cashFlowRisks as {risk:string;impact:string;mitigation:string}[]) ?? [];
  const outlook = result.thirteenWeekOutlook as {trend:string;recommendation:string} | undefined;
  const date  = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const body = `
    <h1>Cash &amp; Working Capital Analysis</h1>
    <div class="meta">Generated ${date}</div>
    <p><strong>Cash Health: ${result.cashHealth as string}</strong> | Runway: ${result.runwayMonths} months</p>
    <p>${result.headline as string}</p>
    <hr>
    <h2>Working Capital Metrics</h2>
    ${dso ? `<p><strong>DSO: ${dso.estimate} days [${dso.status}]</strong><br>${dso.insight}<br>→ ${dso.action}</p>` : ''}
    ${dpo ? `<p><strong>DPO: ${dpo.estimate} days [${dpo.status}]</strong><br>${dpo.insight}</p>` : ''}
    ${ccc ? `<p><strong>Cash Conversion Cycle: ${ccc.estimate} days</strong><br>${ccc.insight}<br>→ ${ccc.improvement}</p>` : ''}
    <hr>
    <h2>Working Capital Actions</h2>
    ${wca.map(a => `<p>• ${a.action} — <strong>${a.cashImpact}</strong> (${a.timeframe})</p>`).join('')}
    <hr>
    <h2>Cash Flow Risks</h2>
    ${cfRisks.map(r => `<p>⚠ <strong>${r.risk}</strong> (${r.impact})<br>→ ${r.mitigation}</p>`).join('')}
    ${outlook ? `<hr><h2>13-Week Outlook: ${outlook.trend}</h2><p>${outlook.recommendation}</p>` : ''}
  `;
  openPrintWindow('Cash & Working Capital', body);
}

// ── CFO Scorecard Result ─────────────────────────────────────────────────────
function CfoScorecardResult({ result }: { result: Record<string, unknown> }) {
  const kpis    = (result.kpis as {name:string;value:string;benchmark:string;status:string;trend:string;insight:string;action:string}[]) ?? [];
  const risks   = (result.topRisks as {risk:string;detail:string;urgency:string}[]) ?? [];
  const opps    = (result.topOpportunities as {opportunity:string;impact:string;effort:string}[]) ?? [];
  const cfoPris = (result.cfoPriorities as {priority:string;why:string;by:string}[]) ?? [];
  const cash    = result.cashPosition as {status:string;insight:string;action:string|null} | undefined;

  const statusDot = (s: string) =>
    s === 'GREEN'  ? 'bg-emerald-400' :
    s === 'YELLOW' ? 'bg-amber-400' :
    'bg-red-400';
  const statusText = (s: string) =>
    s === 'GREEN'  ? 'text-emerald-400' :
    s === 'YELLOW' ? 'text-amber-400' :
    'text-red-400';
  const trendArrow = (t: string) => t === 'UP' ? '↑' : t === 'DOWN' ? '↓' : '→';
  const urgencyColor = (u: string) => u === 'IMMEDIATE' ? 'text-red-400 bg-red-500/10 border-red-500/25' : u === 'THIS_MONTH' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' : 'text-slate-400 bg-slate-800/60 border-slate-700/40';

  const overall = result.overallHealth as string;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-3">
          <div className={`w-4 h-4 rounded-full ${statusDot(overall)} flex-shrink-0`}/>
          <div className={`text-[15px] font-bold ${statusText(overall)}`}>Overall: {overall}</div>
        </div>
        <div className="text-[13px] text-slate-300 leading-relaxed">{result.headline as string}</div>
      </div>

      {/* KPI Grid */}
      <div>
        <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-3">Financial KPIs</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {kpis.map((kpi, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusDot(kpi.status)}`}/>
                  <span className="text-[11px] font-semibold text-slate-400">{kpi.name}</span>
                </div>
                <span className="text-[10px] text-slate-600">{trendArrow(kpi.trend)}</span>
              </div>
              <div className={`text-[18px] font-black ${statusText(kpi.status)} mb-0.5`}>{kpi.value}</div>
              <div className="text-[10px] text-slate-600 mb-2">{kpi.benchmark}</div>
              <div className="text-[11px] text-slate-400 leading-snug mb-1.5">{kpi.insight}</div>
              {kpi.status !== 'GREEN' && (
                <div className="text-[10px] text-indigo-400 bg-indigo-500/8 border border-indigo-500/20 rounded-lg px-2 py-1">
                  → {kpi.action}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cash + Risks side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cash && (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${statusDot(cash.status)}`}/>
              <div className="text-[11px] font-semibold text-slate-400">Cash Position</div>
            </div>
            <div className="text-[12px] text-slate-300 leading-snug mb-2">{cash.insight}</div>
            {cash.action && <div className="text-[10px] text-indigo-400">→ {cash.action}</div>}
          </div>
        )}
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Top Risks</div>
          <div className="space-y-2">
            {risks.slice(0,3).map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${urgencyColor(r.urgency)}`}>{r.urgency.replace('_',' ')}</span>
                <div>
                  <div className="text-[11px] font-semibold text-slate-300">{r.risk}</div>
                  <div className="text-[10px] text-slate-500">{r.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Opportunities + CFO Priorities */}
      {opps.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-3">Top Opportunities</div>
          <div className="space-y-2">
            {opps.map((o, i) => (
              <div key={i} className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div className="text-[12px] text-slate-300">{o.opportunity}</div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-bold text-emerald-400">{o.impact}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${o.effort === 'LOW' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : o.effort === 'HIGH' ? 'text-red-400 bg-red-500/10 border-red-500/25' : 'text-amber-400 bg-amber-500/10 border-amber-500/25'}`}>{o.effort}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cfoPris.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-3">CFO Priorities This Month</div>
          <div className="space-y-2">
            {cfoPris.map((p, i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="text-[12px] font-semibold text-slate-200">{i+1}. {p.priority}</div>
                  <span className="text-[10px] text-slate-600 flex-shrink-0">{p.by}</span>
                </div>
                <div className="text-[11px] text-slate-500">{p.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cash & Working Capital Result ─────────────────────────────────────────────
function CashWorkingCapitalResult({ result }: { result: Record<string, unknown> }) {
  const dso    = result.dso as {estimate:number;benchmark:string;status:string;insight:string;action:string} | undefined;
  const dpo    = result.dpo as {estimate:number;benchmark:string;status:string;insight:string;action:string|null} | undefined;
  const ccc    = result.cashConversionCycle as {estimate:number;insight:string;improvement:string} | undefined;
  const risks  = (result.cashFlowRisks as {risk:string;impact:string;likelihood:string;mitigation:string}[]) ?? [];
  const wca    = (result.workingCapitalActions as {action:string;cashImpact:string;timeframe:string;effort:string}[]) ?? [];
  const outlook = result.thirteenWeekOutlook as {trend:string;keyAssumptions:string[];risks:string[];recommendation:string} | undefined;
  const vendor = result.vendorTerms as {opportunity:string;estimatedCashBenefit:string;action:string} | undefined;

  const statusDot  = (s: string) => s === 'GREEN' ? 'bg-emerald-400' : s === 'YELLOW' ? 'bg-amber-400' : 'bg-red-400';
  const statusText = (s: string) => s === 'GREEN' ? 'text-emerald-400' : s === 'YELLOW' ? 'text-amber-400' : 'text-red-400';
  const trendColor = (t: string) => t === 'IMPROVING' ? 'text-emerald-400' : t === 'DETERIORATING' ? 'text-red-400' : 'text-slate-400';
  const effortColor = (e: string) => e === 'LOW' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' : e === 'HIGH' ? 'text-red-400 bg-red-500/10 border-red-500/25' : 'text-amber-400 bg-amber-500/10 border-amber-500/25';

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-slate-900/60 border border-slate-800/50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${statusDot(result.cashHealth as string)}`}/>
          <span className={`text-[13px] font-bold ${statusText(result.cashHealth as string)}`}>Cash Health: {result.cashHealth as string}</span>
          {result.runwayMonths != null && <span className="text-[11px] text-slate-500 ml-auto">{Number(result.runwayMonths).toFixed(1)} mo runway</span>}
        </div>
        <div className="text-[13px] text-slate-300 leading-relaxed">{result.headline as string}</div>
      </div>

      {/* DSO / DPO / CCC row */}
      <div className="grid grid-cols-3 gap-3">
        {dso && (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3">
            <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider mb-1">DSO</div>
            <div className={`text-[22px] font-black ${statusText(dso.status)}`}>{dso.estimate}d</div>
            <div className="text-[10px] text-slate-600">{dso.benchmark}</div>
          </div>
        )}
        {dpo && (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3">
            <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider mb-1">DPO</div>
            <div className={`text-[22px] font-black ${statusText(dpo.status)}`}>{dpo.estimate}d</div>
            <div className="text-[10px] text-slate-600">{dpo.benchmark}</div>
          </div>
        )}
        {ccc && (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3">
            <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider mb-1">CCC</div>
            <div className="text-[22px] font-black text-slate-200">{ccc.estimate}d</div>
            <div className="text-[10px] text-slate-600">Cash conversion</div>
          </div>
        )}
      </div>

      {/* Insights for DSO/DPO/CCC */}
      <div className="space-y-2">
        {[dso, dpo].filter(Boolean).map((m, i) => m && (
          <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
            <div className="text-[11px] text-slate-400 mb-1">{m.insight}</div>
            {m.action && <div className="text-[10px] text-indigo-400">→ {m.action}</div>}
          </div>
        ))}
        {ccc && (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
            <div className="text-[11px] text-slate-400 mb-1">{ccc.insight}</div>
            <div className="text-[10px] text-indigo-400">→ {ccc.improvement}</div>
          </div>
        )}
      </div>

      {/* Working Capital Actions */}
      {wca.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-3">Working Capital Actions</div>
          <div className="space-y-2">
            {wca.map((a, i) => (
              <div key={i} className="bg-teal-500/5 border border-teal-500/15 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-slate-300">{a.action}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{a.timeframe}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-bold text-teal-400">{a.cashImpact}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${effortColor(a.effort)}`}>{a.effort}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Flow Risks */}
      {risks.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest mb-3">Cash Flow Risks</div>
          <div className="space-y-2">
            {risks.map((r, i) => (
              <div key={i} className="bg-slate-900/50 border border-red-500/15 rounded-xl px-4 py-3">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="text-[12px] font-semibold text-slate-300">{r.risk}</div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] text-slate-500">{r.impact}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${r.likelihood === 'HIGH' ? 'text-red-400 bg-red-500/10 border-red-500/25' : r.likelihood === 'LOW' ? 'text-slate-400 bg-slate-800/60 border-slate-700/40' : 'text-amber-400 bg-amber-500/10 border-amber-500/25'}`}>{r.likelihood}</span>
                  </div>
                </div>
                <div className="text-[10px] text-indigo-400">→ {r.mitigation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 13-week outlook */}
      {outlook && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-widest">13-Week Outlook</div>
            <span className={`text-[10px] font-bold ml-auto ${trendColor(outlook.trend)}`}>{outlook.trend}</span>
          </div>
          <div className="text-[12px] text-slate-300 mb-3">{outlook.recommendation}</div>
          {outlook.risks.length > 0 && (
            <div className="space-y-1">
              {outlook.risks.map((r, i) => (
                <div key={i} className="text-[11px] text-slate-500">⚠ {r}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vendor terms */}
      {vendor && (
        <div className="bg-teal-500/5 border border-teal-500/15 rounded-xl px-4 py-3">
          <div className="text-[11px] font-semibold text-teal-400 mb-1">Vendor Term Opportunity · {vendor.estimatedCashBenefit}</div>
          <div className="text-[12px] text-slate-300 mb-1.5">{vendor.opportunity}</div>
          <div className="text-[10px] text-indigo-400">→ {vendor.action}</div>
        </div>
      )}
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
  {
    id:           'cfo-scorecard',
    label:        'CFO Scorecard',
    tagline:      'Monthly red/yellow/green health check',
    description:  'Instant financial health dashboard across 8 KPIs — gross margin, EBITDA, retention, concentration, and more — each benchmarked against LMM peers with a specific action for every yellow or red.',
    emoji:        '📊',
    accent:       'text-amber-400',
    accentBg:     'bg-amber-500/8',
    accentBorder: 'border-amber-500/20',
    estimatedTime: '~15 seconds',
    outputPreview: ['8 KPIs with RED/YELLOW/GREEN status', 'LMM benchmark per KPI', 'Top risks + opportunities', 'CFO priority actions', 'Cash position assessment'],
  },
  {
    id:           'cash-working-capital',
    label:        'Cash & Working Capital',
    tagline:      'Know your cash position inside-out',
    description:  'Deep working capital analysis: DSO/DPO estimates, cash conversion cycle, 13-week outlook, and specific actions to free up cash — without waiting for your accountant.',
    emoji:        '💵',
    accent:       'text-teal-400',
    accentBg:     'bg-teal-500/8',
    accentBorder: 'border-teal-500/20',
    estimatedTime: '~15 seconds',
    outputPreview: ['DSO + DPO estimates', 'Cash conversion cycle', '13-week trend outlook', 'Working capital actions', 'Vendor term opportunities'],
  },
];

// ── Progress state type ──────────────────────────────────────────────────────
interface ProgressState { message: string; step: number; total: number; }

// ── Main Component ───────────────────────────────────────────────────────────
const AGENT_RESULTS_KEY = 'bos_agent_results';

export default function AgentPanel({ data, previousData, companyName, companyProfile }: Props) {
  const [results, setResults]   = useState<Record<string, Record<string, unknown>>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(AGENT_RESULTS_KEY);
      if (saved) return JSON.parse(saved) as Record<string, Record<string, unknown>>;
    } catch {
      localStorage.removeItem(AGENT_RESULTS_KEY);
    }
    return {};
  });
  const [loading, setLoading]       = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const [runAllStep, setRunAllStep] = useState<{ current: number; total: number } | null>(null);
  const [progress, setProgress]     = useState<Record<string, ProgressState>>({});
  const [runTimestamps, setRunTimestamps] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try { const s = localStorage.getItem('bos_agent_timestamps'); return s ? JSON.parse(s) as Record<string, number> : {}; } catch { return {}; }
  });
  const isAuthRef = useRef(false);

  // Persist results to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(results).length === 0) return;
    try { localStorage.setItem(AGENT_RESULTS_KEY, JSON.stringify(results)); } catch { /* ignore */ }
  }, [results]);

  // Load persisted results from Neon for authenticated users
  useEffect(() => {
    const session = loadAuthSession();
    if (!session?.token) return;
    isAuthRef.current = true;
    fetch('/api/ai-outputs', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((payload: { results: Record<string, Record<string, unknown>> } | null) => {
        if (payload?.results && Object.keys(payload.results).length > 0) {
          setResults(prev => ({ ...prev, ...payload.results }));
        }
      })
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async (agentId: string) => {
    const r = results[agentId];
    if (!r) return;
    const text = buildPlainText(agentId, r);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  async function runAgent(agentId: string): Promise<boolean> {
    setLoading(agentId);
    setError(null);
    setProgress(prev => ({ ...prev, [agentId]: { message: 'Starting analysis…', step: 0, total: 1 } }));

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agent: agentId, data, previousData, companyName, companyProfile }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setError(json.error ?? 'Agent failed. Check your API key and try again.');
        return false;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let agentResult: Record<string, unknown> | null = null;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break outer;
          try {
            const parsed = JSON.parse(raw) as { type: string; message?: string; step?: number; total?: number; data?: Record<string, unknown>; agent?: string; error?: string };
            if (parsed.type === 'progress') {
              setProgress(prev => ({
                ...prev,
                [agentId]: { message: parsed.message ?? '…', step: parsed.step ?? 0, total: parsed.total ?? 1 },
              }));
            } else if (parsed.type === 'result' && parsed.data) {
              agentResult = parsed.data;
              setResults(prev => ({ ...prev, [agentId]: parsed.data! }));
              setRunTimestamps(prev => {
                const next = { ...prev, [agentId]: Date.now() };
                try { localStorage.setItem('bos_agent_timestamps', JSON.stringify(next)); } catch { /* ignore */ }
                return next;
              });
              setActiveAgent(agentId);
            } else if (parsed.type === 'error') {
              setError(parsed.error ?? 'Agent failed');
            }
          } catch { /* skip malformed line */ }
        }
      }

      // Persist to Neon for authenticated users
      if (agentResult && isAuthRef.current) {
        fetch('/api/ai-outputs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ agentId, result: agentResult }),
        }).catch(() => null);
      }

      return !!agentResult;

    } catch {
      setError('Agent failed. Check your API key and try again.');
      return false;
    } finally {
      setLoading(null);
      setProgress(prev => { const next = { ...prev }; delete next[agentId]; return next; });
    }
  }

  const hasResult = (id: string) => !!results[id];

  async function runAllAgents() {
    setRunAllStep({ current: 0, total: AGENTS.length });
    // Run all agents in parallel — results are stored independently by agentId
    let completed = 0;
    await Promise.allSettled(
      AGENTS.map(agent =>
        runAgent(agent.id).then(() => {
          completed++;
          setRunAllStep({ current: completed, total: AGENTS.length });
        })
      )
    );
    setRunAllStep(null);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-bold text-slate-100">AI Advisory Agents</div>
          <div className="text-[12px] text-slate-500 mt-0.5">Deep analysis of your business data — structured, actionable, exportable</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeAgent ? (
            <button onClick={() => setActiveAgent(null)}
              className="text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
              ← All Agents
            </button>
          ) : (
            <button
              onClick={runAllAgents}
              disabled={!!loading}
              className="flex items-center gap-1.5 text-[12px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 bg-indigo-500/8 hover:bg-indigo-500/15 px-3 py-1.5 rounded-lg transition-all font-medium disabled:opacity-40">
              {loading && runAllStep
                ? <><Spinner/>{runAllStep.current}/{runAllStep.total} — {AGENTS.find(a => a.id === loading)?.label ?? 'Running'}…</>
                : loading ? <><Spinner/>Running…</> : '✦ Run All Agents'
              }
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-[13px] text-red-400">{error}</span>
          {activeAgent && (
            <button
              onClick={() => { setError(null); void runAgent(activeAgent); }}
              className="flex-shrink-0 text-[11px] font-medium text-red-300 hover:text-red-100 border border-red-500/30 hover:border-red-500/60 px-2.5 py-1 rounded-lg transition-all"
            >
              Retry
            </button>
          )}
        </div>
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
                  <div className="text-[11px] text-slate-500">
                    {agent.tagline}
                    {runTimestamps[agent.id] && (
                      <span className="ml-2 text-slate-600">
                        · updated {new Date(runTimestamps[agent.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => handleCopy(activeAgent)}
                className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
                {copied ? '✓ Copied' : '⎘ Copy'}
              </button>
              <button
                onClick={() => {
                  const r = results[activeAgent];
                  if (activeAgent === 'exit-readiness') exportExitReadiness(r);
                  else if (activeAgent === 'growth-playbook') exportGrowthPlaybook(r);
                  else if (activeAgent === 'action-plan') exportActionPlan(r);
                  else if (activeAgent === 'board-prep') exportBoardPrep(r);
                  else if (activeAgent === 'cfo-scorecard') exportCfoScorecard(r);
                  else if (activeAgent === 'cash-working-capital') exportCashWorkingCapital(r);
                }}
                className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
                ↓ Export PDF
              </button>
              <button
                onClick={() => runAgent(activeAgent)}
                disabled={loading === activeAgent}
                className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
                {loading === activeAgent ? <><Spinner/>Regenerating…</> : '↺ Regenerate'}
              </button>
            </div>
          </div>
          {activeAgent === 'exit-readiness'       && <ExitReadinessResult result={results[activeAgent]}/>}
          {activeAgent === 'growth-playbook'      && <GrowthPlaybookResult result={results[activeAgent]}/>}
          {activeAgent === 'action-plan'          && <ActionPlanResult result={results[activeAgent]}/>}
          {activeAgent === 'board-prep'           && <BoardPrepResult result={results[activeAgent]}/>}
          {activeAgent === 'cfo-scorecard'        && <CfoScorecardResult result={results[activeAgent]}/>}
          {activeAgent === 'cash-working-capital' && <CashWorkingCapitalResult result={results[activeAgent]}/>}
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
                  {ran && (
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">Done</span>
                      {runTimestamps[agent.id] && (
                        <span className="text-[9px] text-slate-600">{new Date(runTimestamps[agent.id]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-[12px] text-slate-500 leading-relaxed mb-4">{agent.description}</div>

                <div className="space-y-1 mb-4">
                  {agent.outputPreview.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className={`flex-shrink-0 font-bold ${agent.accent}`}>✓</span>{item}
                    </div>
                  ))}
                </div>

                {/* Progress bar — shown while this agent is running */}
                {isLoading && progress[agent.id] && (
                  <div className="mb-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 leading-snug">{progress[agent.id].message}</span>
                      <span className="text-[10px] text-slate-600 tabular-nums flex-shrink-0">{progress[agent.id].step}/{progress[agent.id].total}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round((progress[agent.id].step / progress[agent.id].total) * 100)}%`,
                          background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                        }}
                      />
                    </div>
                  </div>
                )}

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
                {!ran && !isLoading && (
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
