import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type CommandType = 'nav' | 'action' | 'ai';

interface Command {
  id: string;
  type: CommandType;
  label: string;
  description?: string;
  icon: string;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onAskAI: (msg: string) => void;
  onRunAction: (action: string) => void;
}

// ── AI suggestion prompts ─────────────────────────────────────────────────────

const AI_PROMPTS = [
  'What are my top 3 risks right now?',
  'Where should I cut costs first?',
  'How do I improve my EBITDA margin?',
  'Which customers are most at risk of churning?',
  'What deals should I prioritize closing this month?',
  'Generate a board update for this period',
  'Analyze my revenue growth trajectory',
  'What KPI needs the most attention?',
];

// ── Main component ────────────────────────────────────────────────────────────

export default function CommandPalette({ open, onClose, onNavigate, onAskAI, onRunAction }: CommandPaletteProps) {
  const [query, setQuery]       = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef                = useRef<HTMLInputElement>(null);
  const listRef                 = useRef<HTMLDivElement>(null);

  // All available commands
  const allCommands: Command[] = [
    // Navigation
    { id: 'nav-overview',     type: 'nav',    label: 'Overview',           description: 'Performance overview + CEO watchlist', icon: '▦', shortcut: '1', onSelect: () => { onNavigate('overview');     onClose(); } },
    { id: 'nav-financial',    type: 'nav',    label: 'Financial Analysis',  description: 'P&L, margins, cost waterfall',          icon: '▲', shortcut: '2', onSelect: () => { onNavigate('financial');    onClose(); } },
    { id: 'nav-customers',    type: 'nav',    label: 'Customer Intelligence', description: 'Concentration risk, retention',       icon: '◉', shortcut: '3', onSelect: () => { onNavigate('customers');    onClose(); } },
    { id: 'nav-operations',   type: 'nav',    label: 'Operations',          description: 'Headcount, utilization, OpEx',          icon: '⚙', shortcut: '4', onSelect: () => { onNavigate('operations');   onClose(); } },
    { id: 'nav-intelligence', type: 'nav',    label: 'AI Intelligence',     description: 'Weekly report, board deck, alerts',     icon: '✦', shortcut: '5', onSelect: () => { onNavigate('intelligence'); onClose(); } },
    { id: 'nav-pipeline',     type: 'nav',    label: 'Deal Pipeline',       description: 'Kanban CRM, deal tracking',             icon: '⬡', shortcut: '6', onSelect: () => { onNavigate('pipeline');     onClose(); } },
    { id: 'nav-automations',  type: 'nav',    label: 'Automations',         description: 'IF/THEN rules and triggers',            icon: '⚡', shortcut: '7', onSelect: () => { onNavigate('automations');  onClose(); } },
    { id: 'nav-scenarios',    type: 'nav',    label: 'Scenario Modeling',   description: 'What-if analysis with lever sliders',   icon: '◈', shortcut: '8', onSelect: () => { onNavigate('scenarios');    onClose(); } },
    { id: 'nav-data',         type: 'nav',    label: 'Data Sources',        description: 'Connect CSV, Google Sheets, Stripe',    icon: '◧', shortcut: '9', onSelect: () => { onNavigate('data');         onClose(); } },
    // Actions
    { id: 'act-report',  type: 'action', label: 'Run Full Report',     description: 'Generate weekly intelligence + board deck', icon: '📋', onSelect: () => { onRunAction('full-report'); onClose(); } },
    { id: 'act-kpis',    type: 'action', label: 'Refresh KPIs',        description: 'Recompute all KPI metrics',                icon: '↺',  onSelect: () => { onRunAction('compute-kpis'); onClose(); } },
    { id: 'act-insight', type: 'action', label: 'Weekly Insight',      description: 'Generate weekly narrative report',         icon: '◇',  onSelect: () => { onRunAction('weekly-insight'); onClose(); } },
    { id: 'act-deck',    type: 'action', label: 'Board Deck',          description: 'Generate board presentation deck',         icon: '◆',  onSelect: () => { onRunAction('board-deck'); onClose(); } },
    { id: 'act-alerts',  type: 'action', label: 'Scan for Risks',      description: 'Run AI risk detection',                   icon: '⚠',  onSelect: () => { onRunAction('alerts'); onClose(); } },
  ];

  const isAIMode = query.startsWith('>') || query.startsWith('?') || (query.length > 2 && !allCommands.some(c => c.label.toLowerCase().startsWith(query.toLowerCase().slice(0, 3))));

  const filteredCommands = query.trim() === '' || query.startsWith('>') || query.startsWith('?')
    ? allCommands
    : allCommands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.description?.toLowerCase().includes(query.toLowerCase()))
      );

  const suggestedPrompts = AI_PROMPTS.filter(p =>
    query.trim() === '' || query.startsWith('>') || query.startsWith('?')
      ? true
      : p.toLowerCase().includes(query.replace(/^[>?]\s*/, '').toLowerCase())
  ).slice(0, 3);

  const totalItems = isAIMode
    ? suggestedPrompts.length + 1  // +1 for "Ask AI: [query]"
    : filteredCommands.length + (suggestedPrompts.length > 0 ? suggestedPrompts.length : 0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const getAIQuery = () => query.replace(/^[>?]\s*/, '').trim() || query.trim();

  const handleSelect = useCallback((idx: number) => {
    if (isAIMode) {
      const q = getAIQuery();
      if (idx === 0 && q) {
        onAskAI(q);
        onClose();
      } else {
        const p = suggestedPrompts[idx - (q ? 1 : 0)];
        if (p) { onAskAI(p); onClose(); }
      }
      return;
    }
    const cmd = filteredCommands[idx];
    if (cmd) cmd.onSelect();
    else {
      const promptIdx = idx - filteredCommands.length;
      const p = suggestedPrompts[promptIdx];
      if (p) { onAskAI(p); onClose(); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIMode, filteredCommands, suggestedPrompts, query, onAskAI, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, totalItems - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); handleSelect(selected); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, selected, totalItems, handleSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const typeColor: Record<CommandType, string> = {
    nav:    'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    action: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    ai:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  const typeLabel: Record<CommandType, string> = { nav: 'Go to', action: 'Action', ai: 'AI' };

  const rawQ = getAIQuery();

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
      <div
        className="relative w-full max-w-xl bg-[#0d1117] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/60">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4 text-slate-500 flex-shrink-0">
            <circle cx="7" cy="7" r="5"/><path d="M12 12l3 3"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Search or type ">" for AI query…'
            className="flex-1 bg-transparent text-[14px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-600 hover:text-slate-400 text-lg leading-none flex-shrink-0">×</button>
          )}
          <kbd className="text-[10px] font-mono bg-slate-800 border border-slate-700/60 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">ESC</kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-1.5">

          {/* AI query mode */}
          {isAIMode && rawQ && (
            <>
              <div className="px-3 pb-1 pt-1.5">
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Ask AI</div>
              </div>
              <button
                data-idx={0}
                onClick={() => handleSelect(0)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selected === 0 ? 'bg-indigo-500/10' : 'hover:bg-slate-800/40'}`}
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 text-indigo-400">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-slate-300 truncate">Ask AI: <span className="text-slate-100 font-medium">"{rawQ}"</span></div>
                  <div className="text-[10px] text-slate-600">Opens AI CFO chat with this question</div>
                </div>
                {selected === 0 && <kbd className="text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded flex-shrink-0">↵</kbd>}
              </button>
            </>
          )}

          {/* Command results */}
          {!isAIMode && filteredCommands.length > 0 && (
            <>
              {filteredCommands.some(c => c.type === 'nav') && (
                <div className="px-3 pb-1 pt-1.5">
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Navigation</div>
                </div>
              )}
              {filteredCommands.filter(c => c.type === 'nav').map(cmd => {
                const idx = filteredCommands.indexOf(cmd);
                return (
                  <button key={cmd.id} data-idx={idx} onClick={() => handleSelect(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected === idx ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'}`}>
                    <div className="w-7 h-7 rounded-lg bg-slate-800/60 border border-slate-700/40 flex items-center justify-center flex-shrink-0 text-slate-400 text-[13px]">
                      {cmd.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-slate-200">{cmd.label}</div>
                      {cmd.description && <div className="text-[10px] text-slate-600 truncate">{cmd.description}</div>}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="text-[10px] font-mono bg-slate-800 border border-slate-700/60 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">{cmd.shortcut}</kbd>
                    )}
                  </button>
                );
              })}

              {filteredCommands.some(c => c.type === 'action') && (
                <div className="px-3 pb-1 pt-2.5 border-t border-slate-800/40 mt-1">
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Actions</div>
                </div>
              )}
              {filteredCommands.filter(c => c.type === 'action').map(cmd => {
                const idx = filteredCommands.indexOf(cmd);
                return (
                  <button key={cmd.id} data-idx={idx} onClick={() => handleSelect(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected === idx ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'}`}>
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400 text-[13px]">
                      {cmd.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-slate-200">{cmd.label}</div>
                      {cmd.description && <div className="text-[10px] text-slate-600 truncate">{cmd.description}</div>}
                    </div>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${typeColor[cmd.type]}`}>{typeLabel[cmd.type]}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* AI prompts section */}
          {suggestedPrompts.length > 0 && (
            <>
              <div className={`px-3 pb-1 pt-2.5 border-t border-slate-800/40 ${!isAIMode && filteredCommands.length > 0 ? 'mt-1' : 'mt-0'}`}>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">
                  {isAIMode ? 'Suggested Questions' : 'Ask AI'}
                </div>
              </div>
              {suggestedPrompts.map((prompt, i) => {
                const baseIdx = isAIMode ? (rawQ ? 1 : 0) + i : filteredCommands.length + i;
                return (
                  <button key={prompt} data-idx={baseIdx} onClick={() => handleSelect(baseIdx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${selected === baseIdx ? 'bg-emerald-500/[0.06]' : 'hover:bg-slate-800/30'}`}>
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 text-emerald-400">
                        <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                        <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                      </svg>
                    </div>
                    <div className="text-[12px] text-slate-400 flex-1 truncate">{prompt}</div>
                    {selected === baseIdx && <kbd className="text-[10px] font-mono bg-slate-800 border border-slate-700 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">↵</kbd>}
                  </button>
                );
              })}
            </>
          )}

          {/* Empty state */}
          {filteredCommands.length === 0 && suggestedPrompts.length === 0 && !isAIMode && query.trim() !== '' && (
            <div className="px-4 py-8 text-center">
              <div className="text-[12px] text-slate-600">No results for "{query}"</div>
              <div className="text-[11px] text-slate-700 mt-1">{'Try "> " to ask AI a question'}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/60 px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700">
            <kbd className="font-mono bg-slate-800/60 border border-slate-700/40 px-1 py-0.5 rounded text-slate-600">↑↓</kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700">
            <kbd className="font-mono bg-slate-800/60 border border-slate-700/40 px-1 py-0.5 rounded text-slate-600">↵</kbd>
            <span>select</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-700">
            <span className="font-mono bg-slate-800/60 border border-slate-700/40 px-1 py-0.5 rounded text-slate-600 text-[9px]">&gt;</span>
            <span>AI query</span>
          </div>
          <div className="ml-auto text-[10px] text-slate-700">
            <kbd className="font-mono bg-slate-800/60 border border-slate-700/40 px-1 py-0.5 rounded text-slate-600">⌘K</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
