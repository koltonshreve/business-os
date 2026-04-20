import { useState, useRef, useEffect, useCallback } from 'react';
import type { UnifiedBusinessData } from '../types';
import { loadSession, saveSession, incrementAIQuery, hasAIQueryBudget, PLANS } from '../lib/plan';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  data: UnifiedBusinessData;
  open: boolean;
  onClose: () => void;
  initialMessage?: string;
  onInitialMessageSent?: () => void;
  companyName?: string;
  activeView?: string;
  companyProfile?: { industry?: string; revenueModel?: string };
  onCreateTask?: (title: string, context: string) => void;
  onNavigate?: (view: string) => void;
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin">
      <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
      <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
    </svg>
  );
}

// ── Quick prompts ─────────────────────────────────────────────────────────────

function buildQuickPrompts(data: UnifiedBusinessData): string[] {
  const rev       = data.revenue.total;
  const cogs      = data.costs.totalCOGS;
  const opex      = data.costs.totalOpEx;
  const ebitda    = rev - cogs - opex;
  const gp        = rev - cogs;
  const ebitdaPct = rev > 0 ? (ebitda / rev) * 100 : 0;
  const gpPct     = rev > 0 ? (gp / rev) * 100 : 0;
  const topCust   = data.customers.topCustomers[0];
  const retention = (data.customers.retentionRate ?? 0.88) * 100;
  const prompts: string[] = [];

  prompts.push(
    ebitdaPct < 14
      ? `Why is EBITDA margin at ${ebitdaPct.toFixed(1)}%? Give me 3 specific actions to get above 18%.`
      : `Our EBITDA margin is ${ebitdaPct.toFixed(1)}% — what's the next lever to pull for more growth?`
  );
  prompts.push(
    gpPct < 45
      ? `Gross margin is ${gpPct.toFixed(1)}% — what are the top 3 ways to expand it?`
      : `Revenue is ${rev >= 1_000_000 ? `$${(rev/1_000_000).toFixed(1)}M` : `$${(rev/1_000).toFixed(0)}k`}. How do I accelerate growth?`
  );
  if (topCust && topCust.percentOfTotal > 15)
    prompts.push(`${topCust.name} is ${topCust.percentOfTotal.toFixed(1)}% of revenue. What's my churn risk and how do I reduce concentration?`);
  else
    prompts.push(`How do I improve my valuation multiple before a potential sale?`);

  prompts.push(
    retention < 88
      ? `Retention is ${retention.toFixed(0)}% — what's the fastest path to 92%+?`
      : `What should I focus on in the next 90 days to maximize business value?`
  );
  prompts.push(`Give me my top 3 priorities for this week with specific action steps.`);
  return prompts.slice(0, 5);
}

// ── Message rendering ─────────────────────────────────────────────────────────

function renderContent(text: string) {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Numbered list item: "1. ", "2. ", etc.
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-indigo-400/70 font-bold flex-shrink-0 text-[11px] mt-0.5 w-4 text-right">{numberedMatch[1]}.</span>
          <span>{inlineFormat(numberedMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Bullet: "• ", "- ", "* "
    const bulletMatch = line.match(/^[•\-\*]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-slate-500 flex-shrink-0 mt-0.5">·</span>
          <span>{inlineFormat(bulletMatch[1])}</span>
        </div>
      );
      i++; continue;
    }

    // Section header: "### " or "**Header:**"
    const headerMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headerMatch) {
      elements.push(
        <div key={i} className="text-[12px] font-bold text-slate-200 mt-2.5 mb-1">
          {headerMatch[1]}
        </div>
      );
      i++; continue;
    }

    // Empty line → spacing
    if (line.trim() === '') {
      if (elements.length > 0) elements.push(<div key={i} className="h-1.5"/>);
      i++; continue;
    }

    // Normal paragraph
    elements.push(
      <p key={i} className="leading-relaxed">
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5 text-[12.5px]">{elements}</div>;
}

function inlineFormat(text: string): JSX.Element {
  // Handle **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="text-slate-100 font-semibold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="font-mono text-emerald-400 bg-emerald-500/8 px-1 py-0.5 rounded text-[11px]">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Action extraction ─────────────────────────────────────────────────────────

interface ExtractedAction {
  title: string;
  context: string;
  nav?: string;
}

const NAV_KEYWORDS: [string[], string][] = [
  [['cash', 'runway', 'burn', 'liquidity'], 'cash'],
  [['ebitda', 'margin', 'profitability', 'gross profit', 'revenue'], 'financial'],
  [['customer', 'churn', 'retention', 'concentration'], 'customers'],
  [['headcount', 'operations', 'employee', 'utilization'], 'operations'],
  [['deal', 'pipeline', 'acquisition', 'target'], 'deals'],
];

function inferNav(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [keywords, view] of NAV_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return view;
  }
  return undefined;
}

function extractActions(content: string): ExtractedAction[] {
  const actions: ExtractedAction[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Numbered action items
    const match = line.match(/^\d+\.\s+(.{15,120})/);
    if (match) {
      const title = match[1]
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .trim();
      if (title.length > 10) {
        actions.push({ title: title.slice(0, 80), context: content, nav: inferNav(title) });
      }
    }
  }

  // Fallback: pull "Action:" / "Priority:" lines
  if (actions.length === 0) {
    for (const line of lines) {
      const m = line.match(/(?:action|priority|step|recommendation):\s*(.{10,100})/i);
      if (m) {
        actions.push({ title: m[1].trim().slice(0, 80), context: content, nav: inferNav(m[1]) });
      }
    }
  }

  return actions.slice(0, 4);
}

const NAV_LABEL: Record<string, string> = {
  cash: 'Cash', financial: 'Financial', customers: 'Customers',
  operations: 'Operations', deals: 'Deals',
};

// ── Message component ─────────────────────────────────────────────────────────

function AssistantMessage({
  content, onCreateTask, onNavigate,
}: {
  content: string;
  onCreateTask?: (title: string, context: string) => void;
  onNavigate?: (view: string) => void;
}) {
  const [createdTasks, setCreatedTasks] = useState<Set<number>>(new Set());
  const [showActions, setShowActions] = useState(false);
  const actions = extractActions(content);

  const handleCreateTask = (action: ExtractedAction, idx: number) => {
    onCreateTask?.(action.title, `AI CFO recommendation:\n${action.context.slice(0, 300)}`);
    setCreatedTasks(prev => new Set(Array.from(prev).concat(idx)));
  };

  return (
    <div className="flex justify-start">
      <div className="w-5 h-5 rounded-md bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
        <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5 text-indigo-400">
          <path d="M5 0.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-2.45 3.33V8H3.95v-.67A3.5 3.5 0 011.5 4 3.5 3.5 0 015 .5z"/>
          <rect x="3.95" y="8.5" width="2.1" height="1" rx="0.4"/>
        </svg>
      </div>
      <div className="max-w-[86%]">
        <div className="bg-slate-800/60 border border-slate-700/40 text-slate-200 rounded-xl rounded-bl-sm px-3.5 py-2.5">
          {renderContent(content)}
        </div>

        {/* Action bar */}
        {actions.length > 0 && (
          <div className="mt-1.5 space-y-1">
            <button
              onClick={() => setShowActions(v => !v)}
              className="flex items-center gap-1 text-[10px] text-indigo-400/70 hover:text-indigo-400 transition-colors"
            >
              <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5">
                <path d="M5 1v4M5 7v2M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
              {showActions ? 'Hide' : 'Act on'} {actions.length} insight{actions.length > 1 ? 's' : ''}
              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                className={`w-2 h-2 transition-transform ${showActions ? 'rotate-180' : ''}`}>
                <path d="M1 2.5l3 3 3-3"/>
              </svg>
            </button>

            {showActions && (
              <div className="space-y-1.5 pl-0.5">
                {actions.map((action, idx) => (
                  <div key={idx} className="bg-slate-900/60 border border-slate-800/50 rounded-lg px-3 py-2">
                    <div className="text-[11px] text-slate-300 leading-snug mb-1.5">{action.title}</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {onCreateTask && (
                        <button
                          onClick={() => handleCreateTask(action, idx)}
                          disabled={createdTasks.has(idx)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                            createdTasks.has(idx)
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-default'
                              : 'bg-slate-800/60 text-slate-400 border-slate-700/40 hover:text-white hover:bg-slate-700/60'
                          }`}
                        >
                          {createdTasks.has(idx) ? (
                            <>
                              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" className="w-2 h-2"><path d="M1.5 4l2 2 3-3"/></svg>
                              Added
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" className="w-2 h-2"><path d="M4 1.5v5M1.5 4h5"/></svg>
                              Create task
                            </>
                          )}
                        </button>
                      )}
                      {action.nav && onNavigate && (
                        <button
                          onClick={() => onNavigate(action.nav!)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border bg-slate-800/40 text-slate-400 border-slate-700/40 hover:text-slate-200 hover:bg-slate-700/40 transition-colors"
                        >
                          <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2 h-2"><path d="M2.5 1.5l3 2.5-3 2.5"/></svg>
                          View {NAV_LABEL[action.nav]}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main chat component ───────────────────────────────────────────────────────

const CHAT_HISTORY_KEY = 'bos_chat_history';
const MAX_SAVED_MESSAGES = 20;

export default function AIChat({
  data, open, onClose, initialMessage, onInitialMessageSent,
  companyName, activeView, companyProfile,
  onCreateTask, onNavigate,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_KEY);
      if (saved) return JSON.parse(saved) as Message[];
    } catch { /* ignore */ }
    return [];
  });
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLTextAreaElement>(null);
  const sentInitial           = useRef(false);

  // Compute usage for footer display (re-reads localStorage each render cycle)
  const sessionSnap = loadSession();
  const planLimit   = PLANS[sessionSnap.planId].limits.aiQueriesPerMonth;
  const isUnlimited = planLimit >= 999;
  const queriesLeft = Math.max(0, planLimit - sessionSnap.aiQueriesUsed);

  const quickPrompts = buildQuickPrompts(data);

  // Persist history
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)));
    } catch { /* ignore */ }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Send initial message
  useEffect(() => {
    if (open && initialMessage && !sentInitial.current) {
      sentInitial.current = true;
      sendMessage(initialMessage);
      onInitialMessageSent?.();
    }
    if (!open) sentInitial.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMessage]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // Check client-side budget before hitting the server
    const session = loadSession();
    if (!hasAIQueryBudget(session)) {
      const limit = PLANS[session.planId].limits.aiQueriesPerMonth;
      setError(`You've used all ${limit} AI queries on the ${session.planId} plan this month. Upgrade to get more.`);
      return;
    }

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const bypassKey = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_BYPASS_KEY) ?? '';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          data,
          history: messages.slice(-6),
          companyName,
          activeView,
          companyProfile,
          planId: session.planId,
          queriesUsed: session.aiQueriesUsed,
          bypassKey,
        }),
      });
      let result: Record<string, unknown> = {};
      try {
        result = await res.json();
      } catch {
        setError('Server returned an unexpected response. Try again.');
        return;
      }
      if (res.status === 402) {
        setError(`Monthly AI limit reached. ${(result.message as string) ?? ''} Upgrade your plan to continue.`);
      } else if (res.status === 429) {
        setError(`Hourly limit reached. ${(result.message as string) ?? 'Try again in an hour.'}`);
      } else if (!res.ok) {
        setError(`Request failed (${res.status}). ${(result.error as string) ?? 'Try again.'}`);
      } else if (result.error) {
        setError(result.error as string);
      } else {
        // Success — increment query count in session
        incrementAIQuery(session);
        setMessages(prev => [...prev, { role: 'assistant', content: result.reply as string }]);
      }
    } catch {
      setError('Connection failed. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }, [messages, data, loading, companyName, activeView, companyProfile]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    try { localStorage.removeItem(CHAT_HISTORY_KEY); } catch { /* ignore */ }
  };

  if (!open) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div className="fixed inset-0 z-[140] bg-black/40 md:hidden" onClick={onClose}/>

      {/* Panel */}
      <div
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[150] flex flex-col w-[calc(100vw-2rem)] max-w-[420px] h-[min(620px,calc(100vh-4rem))] bg-[#0d1117] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.12)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 flex-shrink-0 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/30 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 text-indigo-300">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-slate-100 leading-none">AI CFO</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>
                <span className="text-[10px] text-slate-500">
                  {companyName && companyName !== 'My Company' ? companyName : 'Ready to advise'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={clearChat}
                className="text-[11px] text-slate-600 hover:text-slate-400 px-2 py-1 rounded-lg hover:bg-slate-800/60 transition-colors">
                Clear
              </button>
            )}
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-all text-lg leading-none">
              ×
            </button>
          </div>
        </div>

        {/* Context pill — shows what data is loaded */}
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/30 border-b border-slate-800/40 flex-shrink-0 overflow-x-auto">
          {[
            data.revenue.total > 0 && `$${data.revenue.total >= 1_000_000 ? (data.revenue.total/1_000_000).toFixed(1)+'M' : (data.revenue.total/1_000).toFixed(0)+'k'} revenue`,
            data.customers.totalCount > 0 && `${data.customers.totalCount} customers`,
            data.cashFlow && data.cashFlow.length > 0 && 'Cash data',
            data.payrollByDept && data.payrollByDept.length > 0 && 'Payroll',
          ].filter(Boolean).map((tag, i) => (
            <span key={i} className="flex-shrink-0 text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/40 text-slate-500">
              {tag}
            </span>
          ))}
          {activeView && (
            <span className="flex-shrink-0 text-[9px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/8 border border-indigo-500/20 text-indigo-400/70 ml-auto">
              Context: {activeView}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div className="space-y-3">
              <div className="text-center pt-1 pb-1">
                <div className="text-[12px] font-medium text-slate-400">I know your numbers cold.</div>
                <div className="text-[11px] text-slate-600 mt-0.5">Ask me anything — I'll explain why and tell you what to do.</div>
              </div>
              <div className="space-y-1.5">
                {quickPrompts.map((prompt, i) => (
                  <button key={i}
                    onClick={() => sendMessage(prompt)}
                    className="group w-full text-left text-[11.5px] text-slate-400 hover:text-slate-100 bg-slate-800/30 hover:bg-slate-800/70 border border-slate-700/40 hover:border-indigo-500/30 rounded-xl px-3.5 py-2.5 transition-all leading-snug flex items-start gap-2.5">
                    <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5 text-indigo-500/50 flex-shrink-0 mt-0.5 group-hover:text-indigo-400 transition-colors">
                      <path d="M5 0.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-2.45 3.33V8H3.95v-.67A3.5 3.5 0 011.5 4 3.5 3.5 0 015 .5z"/>
                      <rect x="3.95" y="8.5" width="2.1" height="1" rx="0.4"/>
                    </svg>
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
              <div className="text-center text-[10px] text-slate-700">or type your own question below</div>
            </div>
          )}

          {/* Message history */}
          {messages.map((msg, i) => (
            msg.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[82%] rounded-xl rounded-br-sm px-3.5 py-2.5 text-[12.5px] leading-relaxed bg-indigo-600/90 text-white">
                  {msg.content}
                </div>
              </div>
            ) : (
              <AssistantMessage
                key={i}
                content={msg.content}
                onCreateTask={onCreateTask}
                onNavigate={onNavigate}
              />
            )
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="w-5 h-5 rounded-md bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5 text-indigo-400">
                  <path d="M5 0.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-2.45 3.33V8H3.95v-.67A3.5 3.5 0 011.5 4 3.5 3.5 0 015 .5z"/>
                  <rect x="3.95" y="8.5" width="2.1" height="1" rx="0.4"/>
                </svg>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }}/>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }}/>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }}/>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3.5 py-2.5 text-[12px] text-red-400 leading-relaxed">
              {error}
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t border-slate-800/60 bg-slate-900/20">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about margins, cash, growth, customers…"
              disabled={loading}
              className="flex-1 bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none leading-snug transition-colors disabled:opacity-50"
              style={{ height: '40px', minHeight: '40px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all">
              {loading
                ? <SpinnerIcon/>
                : <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 text-white">
                    <path d="M1 7l5-5.5L7 2.9 3.8 6h9.2v2H3.8L7 11.1l-1 1.4L1 7z" transform="rotate(90 7 7)"/>
                  </svg>
              }
            </button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-700">Enter to send · Shift+Enter for new line</span>
            {!isUnlimited && (
              <span className={`text-[10px] font-medium ${queriesLeft <= 2 ? 'text-amber-500/80' : 'text-slate-700'}`}>
                {queriesLeft} / {planLimit} queries left
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
