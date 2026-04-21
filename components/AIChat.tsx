import { useState, useRef, useEffect, useCallback } from 'react';
import type { UnifiedBusinessData } from '../types';
import { loadSession, incrementAIQuery, hasAIQueryBudget, PLANS } from '../lib/plan';

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

// ── Icons ──────────────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin">
      <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
      <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="5" width="7" height="8" rx="1.2"/>
      <path d="M9 5V3.5A1.5 1.5 0 007.5 2h-4A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5"/>
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M2.5 7l3 3 6-6"/>
    </svg>
  );
}

function AIIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className={className}>
      <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
      <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
    </svg>
  );
}

// ── Quick prompts ─────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  'Profitability':      '📊',
  'Growth':             '📈',
  'Concentration risk': '⚠️',
  'Valuation':          '💰',
  'Retention':          '🔄',
  'Priorities':         '🎯',
};

function buildQuickPrompts(data: UnifiedBusinessData): { text: string; category: string }[] {
  const rev       = data.revenue.total;
  const cogs      = data.costs.totalCOGS;
  const opex      = data.costs.totalOpEx;
  const ebitda    = rev - cogs - opex;
  const gp        = rev - cogs;
  const ebitdaPct = rev > 0 ? (ebitda / rev) * 100 : 0;
  const gpPct     = rev > 0 ? (gp / rev) * 100 : 0;
  const topCust   = data.customers.topCustomers[0];
  const retention = (data.customers.retentionRate ?? 0.88) * 100;
  const prompts: { text: string; category: string }[] = [];

  prompts.push({
    text: ebitdaPct < 14
      ? `Why is EBITDA margin at ${ebitdaPct.toFixed(1)}%? Give me 3 specific actions to get above 18%.`
      : `Our EBITDA margin is ${ebitdaPct.toFixed(1)}% — what's the next lever to pull for more growth?`,
    category: 'Profitability',
  });
  prompts.push({
    text: gpPct < 45
      ? `Gross margin is ${gpPct.toFixed(1)}% — what are the top 3 ways to expand it?`
      : `Revenue is ${rev >= 1_000_000 ? `$${(rev/1_000_000).toFixed(1)}M` : `$${(rev/1_000).toFixed(0)}k`}. How do I accelerate growth?`,
    category: 'Growth',
  });
  prompts.push({
    text: topCust && topCust.percentOfTotal > 15
      ? `${topCust.name} is ${topCust.percentOfTotal.toFixed(1)}% of revenue. What's my churn risk and how do I reduce concentration?`
      : `How do I improve my valuation multiple before a potential sale?`,
    category: topCust && topCust.percentOfTotal > 15 ? 'Concentration risk' : 'Valuation',
  });
  prompts.push({
    text: retention < 88
      ? `Retention is ${retention.toFixed(0)}% — what's the fastest path to 92%+?`
      : `What should I focus on in the next 90 days to maximize business value?`,
    category: 'Retention',
  });
  prompts.push({
    text: `Give me my top 3 priorities for this week with specific action steps.`,
    category: 'Priorities',
  });

  return prompts.slice(0, 5);
}

// ── Message rendering ─────────────────────────────────────────────────────────

function renderContent(text: string) {
  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // → Action line — highlighted callout
    const actionMatch = line.match(/^→\s+(.+)/);
    if (actionMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-2.5 mt-1 px-3 py-2.5 bg-indigo-500/8 border border-indigo-500/20 rounded-xl">
          <span className="text-indigo-400 font-bold text-[14px] leading-none flex-shrink-0 mt-0.5">→</span>
          <span className="text-[12.5px] text-slate-100 leading-snug font-medium">{inlineFormat(actionMatch[1])}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered list item: "1. "
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      elements.push(
        <div key={i} className="flex gap-2.5 my-0.5">
          <span className="text-indigo-400/60 font-bold flex-shrink-0 text-[11px] mt-0.5 w-4 text-right tabular-nums">{numberedMatch[1]}.</span>
          <span className="text-[12.5px] leading-snug">{inlineFormat(numberedMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Bullet: "• ", "- ", "* "
    const bulletMatch = line.match(/^[•\-\*]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5">
          <span className="text-indigo-400/40 flex-shrink-0 mt-[3px] text-[9px]">▸</span>
          <span className="text-[12.5px] leading-snug">{inlineFormat(bulletMatch[1])}</span>
        </div>
      );
      i++; continue;
    }

    // Section header: "### " or "## "
    const headerMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headerMatch) {
      elements.push(
        <div key={i} className="text-[11.5px] font-semibold text-slate-300 mt-3 mb-1 uppercase tracking-wide">
          {headerMatch[1]}
        </div>
      );
      i++; continue;
    }

    // Horizontal rule ---
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<div key={i} className="border-t border-slate-700/40 my-2"/>);
      i++; continue;
    }

    // Empty line → small gap
    if (line.trim() === '') {
      if (elements.length > 0) elements.push(<div key={i} className="h-1.5"/>);
      i++; continue;
    }

    // Normal paragraph — check if it's a bold-leading headline (the AI's opening line)
    const isHeadline = elements.length === 0 && line.startsWith('**') && line.includes('**', 2);
    elements.push(
      <p key={i} className={`leading-relaxed ${isHeadline ? 'text-[13px]' : 'text-[12.5px]'}`}>
        {inlineFormat(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

function inlineFormat(text: string): JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="font-mono text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded text-[11px]">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ── Action extraction ─────────────────────────────────────────────────────────

interface ExtractedAction { title: string; context: string; nav?: string; }

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
    const match = line.match(/^\d+\.\s+(.{15,120})/);
    if (match) {
      const title = match[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
      if (title.length > 10)
        actions.push({ title: title.slice(0, 80), context: content, nav: inferNav(title) });
    }
  }

  if (actions.length === 0) {
    for (const line of lines) {
      const m = line.match(/(?:action|priority|step|recommendation):\s*(.{10,100})/i);
      if (m)
        actions.push({ title: m[1].trim().slice(0, 80), context: content, nav: inferNav(m[1]) });
    }
  }

  return actions.slice(0, 3);
}

const NAV_LABEL: Record<string, string> = {
  cash: 'Cash', financial: 'Financials', customers: 'Customers',
  operations: 'Ops', deals: 'Deals',
};

// ── Assistant message ─────────────────────────────────────────────────────────

function AssistantMessage({
  content, onCreateTask, onNavigate, msgIdx, copiedIdx, onCopy,
}: {
  content: string;
  onCreateTask?: (title: string, context: string) => void;
  onNavigate?: (view: string) => void;
  msgIdx: number;
  copiedIdx: number | null;
  onCopy: (text: string, idx: number) => void;
}) {
  const [createdTasks, setCreatedTasks] = useState<Set<number>>(new Set());
  const actions = extractActions(content);
  const isCopied = copiedIdx === msgIdx;

  return (
    <div className="flex justify-start group/msg">
      {/* AI avatar */}
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/25 to-violet-600/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2.5">
        <AIIcon className="w-3 h-3 text-indigo-300"/>
      </div>

      <div className="max-w-[87%] min-w-0">
        {/* Message bubble */}
        <div className="relative bg-slate-800/50 border border-slate-700/40 text-slate-200 rounded-2xl rounded-tl-sm px-4 py-3">
          {renderContent(content)}

          {/* Copy button — appears on hover */}
          <button
            onClick={() => onCopy(content, msgIdx)}
            className="absolute -top-2 -right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity
              w-6 h-6 rounded-full bg-slate-700 border border-slate-600/60 flex items-center justify-center
              hover:bg-slate-600 shadow-md"
            title="Copy response"
          >
            {isCopied
              ? <CheckIcon className="w-3 h-3 text-emerald-400"/>
              : <CopyIcon className="w-3 h-3 text-slate-300"/>
            }
          </button>
        </div>

        {/* Action chips — always visible when present */}
        {actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actions.map((action, idx) => (
              <div key={idx} className="flex items-center gap-1">
                {onCreateTask && (
                  <button
                    onClick={() => {
                      onCreateTask(action.title, `AI CFO recommendation:\n${action.context.slice(0, 300)}`);
                      setCreatedTasks(prev => new Set(Array.from(prev).concat(idx)));
                    }}
                    disabled={createdTasks.has(idx)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-medium border transition-all ${
                      createdTasks.has(idx)
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 cursor-default'
                        : 'bg-slate-800/60 text-slate-400 border-slate-700/40 hover:text-slate-100 hover:bg-slate-700/60 hover:border-slate-600/60'
                    }`}
                  >
                    {createdTasks.has(idx)
                      ? <><CheckIcon className="w-2.5 h-2.5"/> Added to tasks</>
                      : <><span className="text-[9px]">+</span> Create task</>
                    }
                  </button>
                )}
                {action.nav && onNavigate && (
                  <button
                    onClick={() => onNavigate(action.nav!)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-medium border bg-slate-800/40 text-slate-500 border-slate-700/40 hover:text-slate-300 hover:bg-slate-700/40 hover:border-slate-600/50 transition-all"
                  >
                    <span className="text-[9px]">→</span> View {NAV_LABEL[action.nav]}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Streaming cursor ──────────────────────────────────────────────────────────

function StreamingCursor() {
  return (
    <span
      className="inline-block w-[2px] h-[13px] bg-indigo-400 ml-0.5 align-middle rounded-sm"
      style={{ animation: 'blink 0.9s step-end infinite' }}
    />
  );
}

// ── Main chat component ───────────────────────────────────────────────────────

const CHAT_HISTORY_KEY    = 'bos_chat_history';
const MAX_SAVED_MESSAGES  = 20;

export default function AIChat({
  data, open, onClose, initialMessage, onInitialMessageSent,
  companyName, activeView, companyProfile,
  onCreateTask, onNavigate,
}: Props) {
  const [messages,    setMessages]    = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_KEY);
      if (saved) return JSON.parse(saved) as Message[];
    } catch { /* ignore */ }
    return [];
  });
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [streaming,   setStreaming]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [copiedIdx,   setCopiedIdx]   = useState<number | null>(null);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);
  const streamRef   = useRef('');   // accumulates streaming content

  const sessionSnap  = loadSession();
  const planLimit    = PLANS[sessionSnap.planId].limits.aiQueriesPerMonth;
  const isUnlimited  = planLimit >= 999;
  const queriesLeft  = Math.max(0, planLimit - sessionSnap.aiQueriesUsed);
  const quickPrompts = buildQuickPrompts(data);

  // Context summary line
  const ctxParts: string[] = [];
  if (data.revenue.total > 0) {
    const r = data.revenue.total;
    ctxParts.push(r >= 1_000_000 ? `$${(r/1_000_000).toFixed(1)}M rev` : `$${(r/1_000).toFixed(0)}k rev`);
  }
  if (data.customers.totalCount > 0) ctxParts.push(`${data.customers.totalCount} customers`);
  if (data.cashFlow && data.cashFlow.length > 0) ctxParts.push('cash data');
  if (data.payrollByDept && data.payrollByDept.length > 0) ctxParts.push('payroll');
  if (activeView) ctxParts.push(`viewing ${activeView}`);
  const contextLine = ctxParts.join(' · ');

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
  }, [messages, loading, streaming]);

  // Focus on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  // Initial message
  useEffect(() => {
    if (open && initialMessage && !sentInitial.current) {
      sentInitial.current = true;
      sendMessage(initialMessage);
      onInitialMessageSent?.();
    }
    if (!open) sentInitial.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMessage]);

  const handleCopy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => null);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || streaming) return;

    const session = loadSession();
    if (!hasAIQueryBudget(session)) {
      const limit = PLANS[session.planId].limits.aiQueriesPerMonth;
      setError(`You've used all ${limit} AI queries on the ${session.planId} plan this month.`);
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);
    setError(null);
    streamRef.current = '';

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '40px';
    }

    try {
      const bypassKey = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_BYPASS_KEY) ?? '';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed, data, history: messages.slice(-6),
          companyName, activeView, companyProfile,
          planId: session.planId, queriesUsed: session.aiQueriesUsed,
          stripeCustomerId: session.stripeCustomerId ?? '', bypassKey,
          stream: true,
        }),
      });

      // Handle non-streaming error responses (limit checks return JSON)
      if (!res.ok) {
        let result: Record<string, unknown> = {};
        try { result = await res.json(); } catch { /* ignore */ }
        if (res.status === 402) {
          setError(`Monthly AI limit reached. ${(result.message as string) ?? ''} Upgrade your plan to continue.`);
        } else if (res.status === 429) {
          setError(`Hourly limit reached. ${(result.message as string) ?? 'Try again in an hour.'}`);
        } else {
          setError(`Request failed (${res.status}). ${(result.error as string) ?? 'Try again.'}`);
        }
        return;
      }

      // Stream OK — add empty assistant message and start reading tokens
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setLoading(false);
      setStreaming(true);

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { break outer; }
          try {
            const parsed = JSON.parse(raw) as { t?: string; error?: string };
            if (parsed.error) {
              setError(parsed.error);
              setMessages(prev => {
                const last = prev[prev.length - 1];
                return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
              });
              break outer;
            }
            if (parsed.t) {
              streamRef.current += parsed.t;
              const snap = streamRef.current;
              setMessages(prev => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = { role: 'assistant', content: snap };
                return msgs;
              });
            }
          } catch { /* skip malformed line */ }
        }
      }

      // Increment query count on successful completion
      incrementAIQuery(session);

    } catch {
      setError('Connection failed. Check your network and try again.');
      // Clean up empty assistant message if it was added
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
      });
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [messages, data, loading, streaming, companyName, activeView, companyProfile]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    try { localStorage.removeItem(CHAT_HISTORY_KEY); } catch { /* ignore */ }
  };

  if (!open) return null;

  const isLastMsgStreaming = streaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant';

  return (
    <>
      {/* Mobile backdrop */}
      <div className="fixed inset-0 z-[140] bg-black/50 md:hidden" onClick={onClose}/>

      {/* Panel */}
      <div
        className="animate-chat-enter fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[150] flex flex-col
          w-[calc(100vw-2rem)] max-w-[460px] h-[min(640px,calc(100vh-4rem))]
          bg-[#0b0f1a] border border-slate-700/50 rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.15), 0 0 40px rgba(99,102,241,0.06)' }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-slate-800/60"
          style={{ background: 'linear-gradient(to bottom, rgba(30,27,75,0.4), rgba(15,23,42,0.3))' }}
        >
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
              <AIIcon className="w-4 h-4 text-white"/>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-100 leading-none">AI CFO</span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25 text-indigo-400/80 leading-none">
                  Claude Sonnet
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>
                <span className="text-[10px] text-slate-500 leading-none">
                  {companyName && companyName !== 'My Company' ? companyName : 'Ready to advise'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {messages.length > 0 && (
              <button onClick={clearChat}
                className="text-[11px] text-slate-600 hover:text-slate-300 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/60 transition-colors">
                Clear
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-3.5 h-3.5">
                <path d="M3 3l8 8M11 3l-8 8"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Context line ── */}
        {contextLine && (
          <div className="px-4 py-1.5 bg-slate-900/30 border-b border-slate-800/30 flex-shrink-0">
            <span className="text-[10px] text-slate-600 leading-none">{contextLine}</span>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div className="space-y-4 pt-1">
              {/* Greeting */}
              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <AIIcon className="w-6 h-6 text-indigo-400"/>
                </div>
                <div className="text-[13px] font-semibold text-slate-200 mt-2">Your AI CFO is ready</div>
                <div className="text-[11px] text-slate-500 leading-relaxed max-w-[240px] mx-auto">
                  I know your numbers. Ask me anything and I'll give you a straight answer.
                </div>
              </div>

              {/* Quick prompts */}
              <div className="space-y-1.5">
                {quickPrompts.map((prompt, i) => (
                  <button key={i}
                    onClick={() => sendMessage(prompt.text)}
                    className="group w-full text-left bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/30 hover:border-indigo-500/25 rounded-xl px-3.5 py-2.5 transition-all duration-150"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-[15px] leading-none flex-shrink-0 mt-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                        {CATEGORY_EMOJI[prompt.category] ?? '💡'}
                      </span>
                      <div>
                        <div className="text-[9.5px] font-semibold text-indigo-400/50 group-hover:text-indigo-400/80 uppercase tracking-wider mb-0.5 transition-colors">
                          {prompt.category}
                        </div>
                        <div className="text-[11.5px] text-slate-400 group-hover:text-slate-200 leading-snug transition-colors">
                          {prompt.text}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message history */}
          {messages.map((msg, i) => {
            const isLastAndStreaming = i === messages.length - 1 && isLastMsgStreaming;
            return msg.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[12.5px] leading-relaxed text-white"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #6d28d9)' }}>
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i}>
                <AssistantMessage
                  content={msg.content}
                  onCreateTask={onCreateTask}
                  onNavigate={onNavigate}
                  msgIdx={i}
                  copiedIdx={copiedIdx}
                  onCopy={handleCopy}
                />
                {/* Streaming cursor on last message */}
                {isLastAndStreaming && msg.content && (
                  <div className="ml-[34px] mt-[-2px]">
                    <StreamingCursor/>
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator — only while waiting for first token */}
          {loading && (
            <div className="flex justify-start items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/25 to-violet-600/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
                <AIIcon className="w-3 h-3 text-indigo-300"/>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: '0ms' }}/>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: '130ms' }}/>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: '260ms' }}/>
                </div>
                <span className="text-[11px] text-slate-500">Analyzing your data…</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/8 border border-red-500/20 rounded-xl px-3.5 py-3 text-[12px] text-red-400 leading-relaxed">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-500"><path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 3.5v3m0 2v.5"/></svg>
              {error}
            </div>
          )}

          <div ref={bottomRef}/>
        </div>

        {/* ── Input ── */}
        <div className="flex-shrink-0 px-3 pb-3 pt-2.5 border-t border-slate-800/60 bg-slate-900/20">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about margins, cash, growth, customers…"
              disabled={loading || streaming}
              className="flex-1 bg-slate-800/50 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none leading-snug transition-colors disabled:opacity-50"
              style={{ height: '40px', minHeight: '40px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || streaming || !input.trim()}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: input.trim() ? 'linear-gradient(135deg, #4f46e5, #6d28d9)' : undefined, backgroundColor: input.trim() ? undefined : '#1e293b' }}
            >
              {(loading || streaming)
                ? <SpinnerIcon/>
                : <svg viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                    <path d="M12 7H2M8 3l4 4-4 4"/>
                  </svg>
              }
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-slate-700">⏎ send &nbsp;⇧⏎ new line</span>
            {!isUnlimited && (
              <span className={`text-[10px] font-medium ${queriesLeft <= 2 ? 'text-amber-500/80' : 'text-slate-700'}`}>
                {queriesLeft}/{planLimit} queries
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Blinking cursor keyframe — only needs to exist once in DOM */}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </>
  );
}
