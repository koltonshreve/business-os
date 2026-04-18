import { useState, useRef, useEffect, useCallback } from 'react';
import type { UnifiedBusinessData } from '../types';

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
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin">
      <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
      <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
    </svg>
  );
}

function buildQuickPrompts(data: UnifiedBusinessData): string[] {
  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const ebitda = rev - cogs - opex;
  const gp     = rev - cogs;
  const ebitdaPct = rev > 0 ? (ebitda / rev) * 100 : 0;
  const gpPct     = rev > 0 ? (gp / rev) * 100 : 0;
  const topCust   = data.customers.topCustomers[0];
  const retention = (data.customers.retentionRate ?? 0.88) * 100;

  const prompts: string[] = [];

  if (ebitdaPct < 14) prompts.push(`Why is EBITDA margin at ${ebitdaPct.toFixed(1)}% and what would move it to 18%?`);
  else prompts.push(`Our EBITDA margin is ${ebitdaPct.toFixed(1)}% — where do we go from here?`);

  if (gpPct < 45) prompts.push(`Gross margin is ${gpPct.toFixed(1)}% — what are the highest-leverage ways to expand it?`);
  else prompts.push(`What's the biggest revenue growth opportunity right now?`);

  if (topCust && topCust.percentOfTotal > 15)
    prompts.push(`${topCust.name} is ${topCust.percentOfTotal.toFixed(1)}% of revenue — how do we reduce that risk?`);
  else
    prompts.push(`How can we improve customer concentration to increase our valuation?`);

  if (retention < 88)
    prompts.push(`Retention is ${retention.toFixed(0)}% — what's the fastest way to fix this?`);
  else
    prompts.push(`What KPI should I be most focused on improving before a potential sale?`);

  prompts.push(`Give me the top 3 actions to take in the next 30 days.`);

  return prompts.slice(0, 4);
}

export default function AIChat({ data, open, onClose, initialMessage, onInitialMessageSent }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);
  const sentInitial             = useRef(false);

  const quickPrompts = buildQuickPrompts(data);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Handle initial message passed from parent (e.g. "Analyze this customer")
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

    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          data,
          history: messages.slice(-6),
        }),
      });

      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
      }
    } catch {
      setError('Connection failed. Check your API key and try again.');
    } finally {
      setLoading(false);
    }
  }, [messages, data, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div className="fixed inset-0 z-[140] bg-black/40 md:hidden" onClick={onClose}/>

      {/* Panel */}
      <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-[150] flex flex-col w-[calc(100vw-2rem)] max-w-[380px] h-[min(540px,calc(100vh-5rem))] bg-[#0d1117] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 flex-shrink-0 bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 text-indigo-400">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-semibold text-slate-100 leading-none">AI CFO</div>
              <div className="text-[10px] text-indigo-400/70 mt-0.5">Ask anything about your business</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button onClick={clearChat}
                className="text-[11px] text-slate-600 hover:text-slate-400 px-2 py-1 rounded-lg hover:bg-slate-800/60 transition-colors font-medium">
                Clear
              </button>
            )}
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-all text-lg leading-none">
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">

          {/* Empty state with quick prompts */}
          {messages.length === 0 && !loading && (
            <div className="space-y-4">
              <div className="text-center pt-2 pb-1">
                <div className="text-[12px] text-slate-500 leading-relaxed">
                  I know your financials cold. Ask me anything.
                </div>
              </div>
              <div className="space-y-1.5">
                {quickPrompts.map((prompt, i) => (
                  <button key={i}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left text-[12px] text-slate-400 hover:text-slate-200 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/40 hover:border-slate-600/60 rounded-xl px-3.5 py-2.5 transition-all leading-snug">
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-700">or type your own question below</span>
              </div>
            </div>
          )}

          {/* Message history */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-5 h-5 rounded-md bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                  <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5 text-indigo-400">
                    <path d="M5 0.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-2.45 3.33V8H3.95v-.67A3.5 3.5 0 011.5 4 3.5 3.5 0 015 .5z"/>
                    <rect x="3.95" y="8.5" width="2.1" height="1" rx="0.4"/>
                  </svg>
                </div>
              )}
              <div className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600/90 text-white rounded-br-sm'
                  : 'bg-slate-800/60 border border-slate-700/40 text-slate-200 rounded-bl-sm'
              }`}>
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br/>}</span>
                ))}
              </div>
            </div>
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

        {/* Input */}
        <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t border-slate-800/60 bg-slate-900/20">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'; }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about margins, customers, growth…"
              disabled={loading}
              className="flex-1 bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none leading-snug transition-colors disabled:opacity-50"
              style={{ height: '40px', minHeight: '40px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm">
              {loading
                ? <SpinnerIcon/>
                : <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 text-white">
                    <path d="M1 7l5-5.5L7 2.9 3.8 6h9.2v2H3.8L7 11.1l-1 1.4L1 7z" transform="rotate(90 7 7)"/>
                  </svg>
              }
            </button>
          </div>
          <div className="text-[10px] text-slate-700 mt-1.5 text-center">Enter to send · Shift+Enter for new line</div>
        </div>
      </div>
    </>
  );
}
