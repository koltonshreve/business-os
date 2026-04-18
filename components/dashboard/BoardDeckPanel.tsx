import { useState } from 'react';
import type { BoardDeck } from '../../types';

interface Props {
  deck: BoardDeck | null;
  onGenerate: () => void;
  loading: boolean;
}

function SpinnerIcon() {
  return <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin flex-shrink-0"><path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/><path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/></svg>;
}

function printDeck(deck: BoardDeck) {
  const sections = [
    ['Executive Summary', deck.executiveSummary],
    ['Financial Performance', deck.financialPerformance],
    ['Operational Highlights', deck.operationalHighlights],
    ['Customer Update', deck.customerUpdate],
    ['Look Ahead', deck.lookAhead],
  ];
  const decisionsHtml = deck.keyDecisions?.length
    ? `<h2>Key Decisions Required</h2>${deck.keyDecisions.map(d => `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:10px 0;"><p style="font-weight:700;margin:0 0 4px">${d.decision}</p><p style="color:#4f46e5;margin:0 0 4px">→ ${d.recommendation}</p><p style="color:#6b7280;font-size:0.85em;margin:0">${d.rationale}</p></div>`).join('')}`
    : '';
  const risksHtml = deck.risks?.length
    ? `<h2>Risks</h2>${deck.risks.map(r => `<p>⚠ <strong>${r.risk}</strong><br><span style="color:#888">Mitigation: ${r.mitigation} · Owner: ${r.owner}</span></p>`).join('')}`
    : '';
  const html = `<!DOCTYPE html><html><head><title>Board Report — ${deck.month}</title><style>
    body{font-family:Georgia,serif;max-width:780px;margin:2.5rem auto;color:#111;padding:0 1rem;}
    h1{font-size:1.5rem;font-weight:700;margin-bottom:4px;} .meta{color:#888;font-size:.8rem;margin-bottom:2rem;}
    h2{font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin:2rem 0 .6rem;}
    p{line-height:1.75;margin:.5rem 0;} hr{border:none;border-top:1px solid #e5e7eb;margin:1.75rem 0;}
    @media print{body{margin:0;}}
  </style></head><body>
    <h1>Board Report — ${deck.month}</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
    ${sections.map(([h, c]) => `<h2>${h}</h2><p>${c}</p><hr>`).join('')}
    ${decisionsHtml}${risksHtml}
    <script>window.onload=()=>window.print();</script>
  </body></html>`;
  const w = window.open('', '_blank');
  w?.document.write(html);
  w?.document.close();
}

export default function BoardDeckPanel({ deck, onGenerate, loading }: Props) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedAll, setCopiedAll]         = useState(false);
  const [collapsed, setCollapsed]         = useState<Set<string>>(new Set());

  if (!deck) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-indigo-400">
            <path d="M3 12h3v5H3v-5zm5-6h4v11H8V6zm6 3h3v8h-3V9zM2 18h16v1H2v-1z"/>
          </svg>
        </div>
        <div className="text-[17px] font-bold text-slate-100 mb-2 tracking-tight">Monthly Board Deck</div>
        <div className="text-[13px] text-slate-500 mb-8 max-w-sm leading-relaxed">
          Executive-level monthly commentary with performance analysis, key decisions needed, and risk assessment — ready to share with your board.
        </div>
        <button onClick={onGenerate} disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[13px] font-semibold transition-all shadow-md">
          {loading ? <><SpinnerIcon/>Generating…</> : '✦ Generate Board Deck'}
        </button>
        <p className="text-[11px] text-slate-600 mt-4">Takes ~20 seconds · Powered by Claude AI</p>
      </div>
    );
  }

  const copySection = async (title: string, content: string) => {
    await navigator.clipboard.writeText(`${title}\n\n${content}`);
    setCopiedSection(title);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyAll = async () => {
    const sections = [
      ['Executive Summary', deck.executiveSummary],
      ['Financial Performance', deck.financialPerformance],
      ['Operational Highlights', deck.operationalHighlights],
      ['Customer Update', deck.customerUpdate],
      ['Look Ahead', deck.lookAhead],
    ];
    if (deck.keyDecisions?.length) sections.push(['Key Decisions', deck.keyDecisions.map(d => `${d.decision}\n→ ${d.recommendation}\n${d.rationale}`).join('\n\n')]);
    if (deck.risks?.length) sections.push(['Risks', deck.risks.map(r => `${r.risk}\nMitigation: ${r.mitigation} · Owner: ${r.owner}`).join('\n\n')]);
    await navigator.clipboard.writeText(`Board Report — ${deck.month}\n\n` + sections.map(([h, c]) => `── ${h} ──\n${c}`).join('\n\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const toggleCollapse = (id: string) => setCollapsed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const SL = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">{children}</div>
  );

  const Section = ({ id, title, content }: { id: string; title: string; content: string }) => (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden group">
      <div className="px-5 py-3.5 flex items-center justify-between gap-3">
        <button onClick={() => toggleCollapse(id)} className="flex items-center gap-2 flex-1 text-left">
          <SL>{title}</SL>
          <svg viewBox="0 0 14 14" fill="currentColor" className={`w-3.5 h-3.5 text-slate-700 group-hover:text-slate-500 transition-transform flex-shrink-0 ${collapsed.has(id) ? '-rotate-90' : ''}`}><path d="M2 4l5 6 5-6H2z"/></svg>
        </button>
        <button
          onClick={() => copySection(title, content)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-slate-600 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-2 py-1 rounded-md font-medium flex-shrink-0">
          {copiedSection === title ? '✓' : '⎘'}
        </button>
      </div>
      {!collapsed.has(id) && (
        <div className="px-5 pb-4 border-t border-slate-800/40 pt-3">
          <div className="text-[13px] text-slate-300 leading-relaxed">{content}</div>
        </div>
      )}
    </div>
  );

  const sections: [string, string][] = [
    ['Executive Summary',      deck.executiveSummary],
    ['Financial Performance',  deck.financialPerformance],
    ['Operational Highlights', deck.operationalHighlights],
    ['Customer Update',        deck.customerUpdate],
    ['Look Ahead',             deck.lookAhead],
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1">Board Report</div>
          <h1 className="text-[18px] font-bold text-slate-100 tracking-tight">{deck.month}</h1>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-shrink-0">
          <button onClick={copyAll}
            className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-200 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
            {copiedAll ? '✓ Copied' : '⎘ Copy All'}
          </button>
          <button onClick={() => printDeck(deck)}
            className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-200 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium">
            ↓ Export PDF
          </button>
          <button onClick={onGenerate} disabled={loading}
            className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg disabled:opacity-40 transition-all font-medium">
            {loading ? <><SpinnerIcon/>Refreshing…</> : '↺ Refresh'}
          </button>
        </div>
      </div>

      {/* Toggle all */}
      <div className="flex items-center gap-2">
        <button onClick={() => setCollapsed(new Set(sections.map(([t]) => t)))}
          className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors font-medium">
          Collapse all
        </button>
        <span className="text-slate-800">·</span>
        <button onClick={() => setCollapsed(new Set())}
          className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors font-medium">
          Expand all
        </button>
      </div>

      {/* Sections */}
      {sections.map(([title, content]) => (
        <Section key={title} id={title} title={title} content={content}/>
      ))}

      {/* Key Decisions — interactive */}
      {deck.keyDecisions?.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-4">Key Decisions Required</div>
          <div className="space-y-3">
            {deck.keyDecisions.map((d, i) => (
              <DecisionCard key={i} decision={d}/>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      {deck.risks?.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-4">Risk Register</div>
          <div className="space-y-3">
            {deck.risks.map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-400 text-[10px] font-bold">!</span>
                </div>
                <div>
                  <div className="text-[13px] text-slate-100 font-semibold leading-snug">{r.risk}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    <span className="text-indigo-400/80">Mitigation:</span> {r.mitigation}
                    <span className="mx-1.5 text-slate-700">·</span>
                    Owner: {r.owner}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Decision card with vote interaction
type VoteStatus = 'approve' | 'defer' | 'discuss' | null;
function DecisionCard({ decision }: { decision: { decision: string; recommendation: string; rationale: string } }) {
  const [vote, setVote] = useState<VoteStatus>(null);
  return (
    <div className={`border rounded-xl p-4 transition-all ${
      vote === 'approve' ? 'border-emerald-500/30 bg-emerald-500/5' :
      vote === 'defer'   ? 'border-amber-500/30 bg-amber-500/5' :
      vote === 'discuss' ? 'border-indigo-500/30 bg-indigo-500/5' :
                           'border-indigo-800/30 bg-indigo-500/5'
    }`}>
      <div className="text-[13px] font-semibold text-slate-100 mb-1">{decision.decision}</div>
      <div className="text-[12px] text-indigo-300/80 mb-2">→ {decision.recommendation}</div>
      <div className="text-[11px] text-slate-500 leading-relaxed mb-3">{decision.rationale}</div>
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/40">
        <span className="text-[10px] text-slate-600 font-medium mr-1">Mark as:</span>
        {([['approve','Approve','text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'],['defer','Defer','text-amber-400 border-amber-500/30 hover:bg-amber-500/10'],['discuss','Needs Discussion','text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10']] as const).map(([v,label,cls]) => (
          <button key={v} onClick={() => setVote(vote === v ? null : v as VoteStatus)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${cls} ${vote === v ? cls.replace('hover:','') : 'border-slate-700/60 text-slate-500 hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
