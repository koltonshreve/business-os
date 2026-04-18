import { useState } from 'react';
import type { WeeklyInsight } from '../../types';

interface Props {
  insight: WeeklyInsight | null;
  onGenerate: () => void;
  loading: boolean;
}

function SpinnerIcon() {
  return <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin flex-shrink-0"><path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/><path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/></svg>;
}

function printInsight(insight: WeeklyInsight) {
  const priorityLabel = (p: string) => `[${p}]`;
  const content = `
    <h1 style="font-size:1.4rem;font-weight:700;margin-bottom:4px;">${insight.headline}</h1>
    <p style="color:#888;font-size:0.8rem;margin-bottom:2rem;">Week of ${new Date(insight.weekOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
    <h2>Executive Summary</h2><p>${insight.executiveSummary}</p><hr>
    <h2>What Changed</h2>${insight.whatChanged.map(w => `<p><strong>${w.area}:</strong> ${w.observation}${w.context ? `<br><em style="color:#888">${w.context}</em>` : ''}</p>`).join('')}<hr>
    <h2>Why It Matters</h2>${insight.whyItMatters.map(w => `<p><strong>${w.area}:</strong> ${w.observation}${w.magnitude ? `<br><em style="color:#10b981">${w.magnitude}</em>` : ''}</p>`).join('')}<hr>
    <h2>Action Items</h2>${insight.whatToDoNext.map(a => `<p>${priorityLabel(a.priority)} <strong>${a.action}</strong><br><span style="color:#888">${a.owner} · Due: ${a.deadline}${a.expectedImpact ? ` · ${a.expectedImpact}` : ''}</span></p>`).join('')}
  `;
  const html = `<!DOCTYPE html><html><head><title>Weekly Intelligence Report</title><style>
    body{font-family:Georgia,serif;max-width:760px;margin:2.5rem auto;color:#111;padding:0 1rem;}
    h1{margin-bottom:4px;} h2{font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin:1.75rem 0 .6rem;}
    p{line-height:1.75;margin:.5rem 0;} hr{border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;}
    @media print{body{margin:0;}}
  </style></head><body>${content}<script>window.onload=()=>window.print();</script></body></html>`;
  const w = window.open('', '_blank');
  w?.document.write(html);
  w?.document.close();
}

export default function WeeklyInsightCard({ insight, onGenerate, loading }: Props) {
  const [doneItems, setDoneItems] = useState<Set<number>>(new Set());
  const [copied, setCopied]       = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (!insight) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-indigo-400">
            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/>
          </svg>
        </div>
        <div className="text-[17px] font-bold text-slate-100 mb-2 tracking-tight">Weekly Intelligence Report</div>
        <div className="text-[13px] text-slate-500 mb-8 max-w-sm leading-relaxed">
          AI-generated analysis of what changed in your business, why it matters, and the top actions to take this week.
        </div>
        <button onClick={onGenerate} disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[13px] font-semibold transition-all shadow-md">
          {loading ? <><SpinnerIcon/>Generating…</> : '✦ Generate Weekly Report'}
        </button>
        <p className="text-[11px] text-slate-600 mt-4">Takes ~15 seconds · Powered by Claude AI</p>
      </div>
    );
  }

  const priorityPill = (p: string) =>
    p === 'URGENT' ? 'text-red-400 bg-red-500/10 border-red-500/25' :
    p === 'HIGH'   ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
                     'text-indigo-400 bg-indigo-500/10 border-indigo-500/25';

  const toggleDone = (i: number) => setDoneItems(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  const doneCount  = doneItems.size;
  const totalItems = insight?.whatToDoNext.length ?? 0;

  async function copyReport() {
    if (!insight) return;
    const text = [
      `Weekly Intelligence — ${insight.headline}`,
      `Week of ${new Date(insight.weekOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      '',
      '── Executive Summary ──',
      insight.executiveSummary,
      '',
      '── What Changed ──',
      ...insight.whatChanged.map(w => `• ${w.area}: ${w.observation}`),
      '',
      '── Why It Matters ──',
      ...insight.whyItMatters.map(w => `• ${w.area}: ${w.observation}`),
      '',
      '── Actions ──',
      ...insight.whatToDoNext.map(a => `[${a.priority}] ${a.action} — ${a.owner}, ${a.deadline}`),
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const SL = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">{children}</div>
  );

  const toggleSection = (id: string) => setExpandedSection(prev => prev === id ? null : id);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1">
            Week of {new Date(insight.weekOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </div>
          <h1 className="text-[18px] font-bold text-slate-100 leading-snug tracking-tight">{insight.headline}</h1>
          {doneCount > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-24">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(doneCount / totalItems) * 100}%` }}/>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">{doneCount}/{totalItems} actions done</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={copyReport}
            className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-200 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
          <button onClick={() => printInsight(insight)}
            className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-200 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
            ↓ Export
          </button>
          <button onClick={onGenerate} disabled={loading}
            className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg disabled:opacity-40 transition-all font-medium">
            {loading ? <><SpinnerIcon/>Refreshing…</> : '↺ Refresh'}
          </button>
        </div>
      </div>

      {/* Executive summary — collapsible */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <button onClick={() => toggleSection('summary')} className="w-full px-5 pt-4 pb-3 flex items-center justify-between text-left hover:bg-slate-800/10 transition-colors">
          <SL>Executive Summary</SL>
          <svg viewBox="0 0 14 14" fill="currentColor" className={`w-3.5 h-3.5 text-slate-600 transition-transform flex-shrink-0 ${expandedSection !== 'summary' ? '' : 'rotate-180'}`}><path d="M2 4l5 6 5-6H2z"/></svg>
        </button>
        {expandedSection !== 'summary' && (
          <div className="px-5 pb-4 text-[13px] text-slate-300 leading-relaxed">{insight.executiveSummary}</div>
        )}
      </div>

      {/* What changed / why it matters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <SL>What Changed</SL>
          <div className="space-y-3">
            {insight.whatChanged.map((item, i) => (
              <div key={i} className="border-l-2 border-slate-700 pl-3 hover:border-slate-500 transition-colors cursor-default">
                <div className="text-[12px] font-semibold text-slate-200">{item.area}</div>
                <div className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">{item.observation}</div>
                {item.context && <div className="text-[11px] text-slate-600 mt-0.5 italic">{item.context}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <SL>Why It Matters</SL>
          <div className="space-y-3">
            {insight.whyItMatters.map((item, i) => (
              <div key={i} className="border-l-2 border-indigo-700/60 pl-3 hover:border-indigo-500/60 transition-colors cursor-default">
                <div className="text-[12px] font-semibold text-slate-200">{item.area}</div>
                <div className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">{item.observation}</div>
                {item.magnitude && <div className="text-[11px] text-emerald-500/80 mt-0.5 font-medium">{item.magnitude}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action items — interactive */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <SL>Action Items</SL>
          {doneCount > 0 && (
            <button onClick={() => setDoneItems(new Set())} className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
              Reset
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {insight.whatToDoNext.map((item, i) => (
            <div key={i}
              onClick={() => toggleDone(i)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                doneItems.has(i)
                  ? 'bg-slate-800/20 border-slate-800/40 opacity-50'
                  : 'bg-slate-800/30 border-slate-700/40 hover:bg-slate-800/50 hover:border-slate-700/60'
              }`}>
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                doneItems.has(i) ? 'bg-emerald-500/20 border-emerald-500/40' : 'border-slate-700'
              }`}>
                {doneItems.has(i) && (
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-2.5 h-2.5 text-emerald-400">
                    <path d="M2 5l2 2.5 4-4"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border flex-shrink-0 mt-0.5 ${priorityPill(item.priority)}`}>{item.priority}</span>
                  <span className={`text-[13px] font-semibold leading-snug transition-colors ${doneItems.has(i) ? 'line-through text-slate-500' : 'text-slate-100'}`}>{item.action}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 ml-[3.5rem]">{item.owner} · {item.deadline}</div>
                {item.expectedImpact && <div className="text-[11px] text-emerald-400/70 mt-0.5 ml-[3.5rem] font-medium">{item.expectedImpact}</div>}
              </div>
            </div>
          ))}
        </div>
        {doneCount === totalItems && totalItems > 0 && (
          <div className="mt-3 text-center text-[13px] text-emerald-400 font-medium">All actions complete 🎉</div>
        )}
      </div>
    </div>
  );
}
