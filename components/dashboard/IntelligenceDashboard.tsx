import { useState } from 'react';
import type { WeeklyInsight, BoardDeck } from '../../types';
import WeeklyInsightCard from './WeeklyInsightCard';
import BoardDeckPanel from './BoardDeckPanel';

interface Alert { severity: string; title: string; message: string; action: string; }

interface Props {
  weeklyInsight: WeeklyInsight | null;
  boardDeck: BoardDeck | null;
  alerts: Alert[];
  loading: string | null;
  onGenerate: (action: string) => void;
  reportTimestamps?: Record<string, string>;
}

type IntelTab = 'weekly' | 'board' | 'alerts';

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin flex-shrink-0">
      <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
      <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
    </svg>
  );
}

function relativeTime(isoTs?: string): string | null {
  if (!isoTs) return null;
  const ms = Date.now() - new Date(isoTs).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs  = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

export default function IntelligenceDashboard({ weeklyInsight, boardDeck, alerts, loading, onGenerate, reportTimestamps }: Props) {
  const [tab, setTab] = useState<IntelTab>('weekly');

  const isLoading = (action: string) => loading === action;

  const TS_KEYS: Record<IntelTab, string> = { weekly: 'weekly-insight', board: 'board-deck', alerts: 'alerts' };

  const tabs: { id: IntelTab; label: string; badge?: number }[] = [
    { id: 'weekly', label: 'Weekly Intel' },
    { id: 'board',  label: 'Board Deck' },
    { id: 'alerts', label: 'Risk Alerts', badge: alerts.filter(a => a.severity === 'HIGH').length || undefined },
  ];

  const pillStyle = (s: string) =>
    s === 'HIGH'   ? 'text-red-400 bg-red-500/10 border-red-500/25' :
    s === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
                     'text-slate-400 bg-slate-800 border-slate-700/50';

  return (
    <div className="space-y-5">
      {/* Header bar with tabs + generate all */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1 flex-wrap">
          {tabs.map(t => {
            const ts = relativeTime(reportTimestamps?.[TS_KEYS[t.id]]);
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
                  tab === t.id ? 'bg-slate-800 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>{t.label}</span>
                {t.badge ? (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {t.badge}
                  </span>
                ) : ts ? (
                  <span className="text-[9px] text-slate-600 font-normal">{ts}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onGenerate('full-report')}
          disabled={!!loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm flex-shrink-0"
        >
          {isLoading('full-report') ? <><SpinnerIcon /> Generating All…</> : '✦ Generate Full Report'}
        </button>
      </div>

      {/* Stale data warning */}
      {(() => {
        const tsKey = TS_KEYS[tab];
        const ts = reportTimestamps?.[tsKey];
        if (!ts) return null;
        const age = Date.now() - new Date(ts).getTime();
        const days = Math.floor(age / 86400000);
        if (days < 7) return null;
        return (
          <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2.5 text-[11px]">
            <span className="text-amber-400 flex-shrink-0">⚠</span>
            <span className="text-amber-400/80 font-medium">This report was generated {days} days ago.</span>
            <span className="text-slate-500">Regenerate to reflect your latest data.</span>
            <button
              onClick={() => onGenerate(tsKey)}
              disabled={!!loading}
              className="ml-auto flex-shrink-0 text-[11px] text-amber-400 hover:text-amber-300 font-semibold border border-amber-500/25 hover:border-amber-500/50 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50">
              Regenerate
            </button>
          </div>
        );
      })()}

      {/* Tab content */}
      {tab === 'weekly' && (
        <div>
          {!weeklyInsight && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0 text-indigo-400 text-base">✦</div>
                    <div className="text-[14px] font-bold text-slate-100">Weekly Intelligence Report</div>
                  </div>
                  <div className="text-[12px] text-slate-500 mb-3 leading-relaxed">
                    AI analyzes your business data and produces a structured executive brief. You&apos;ll receive:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {[
                      'Headline summary of the week',
                      'What changed across revenue, costs & customers',
                      'Why each change matters strategically',
                      '3–5 prioritized actions with owners & deadlines',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] text-slate-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 flex-shrink-0"/>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
                  <button
                    onClick={() => { onGenerate('weekly-insight'); setTab('weekly'); }}
                    disabled={!!loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm"
                  >
                    {isLoading('weekly-insight') ? <><SpinnerIcon />Generating…</> : '✦ Generate Report'}
                  </button>
                  <div className="text-[10px] text-slate-600">~15 seconds · Powered by Claude AI</div>
                </div>
              </div>
            </div>
          )}
          <WeeklyInsightCard
            insight={weeklyInsight}
            onGenerate={() => { onGenerate('weekly-insight'); setTab('weekly'); }}
            loading={isLoading('weekly-insight')}
          />
        </div>
      )}

      {tab === 'board' && (
        <div>
          {!boardDeck && (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-6 mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0 text-violet-400 text-base">◈</div>
                    <div className="text-[14px] font-bold text-slate-100">Monthly Board Deck</div>
                  </div>
                  <div className="text-[12px] text-slate-500 mb-3 leading-relaxed">
                    AI generates board-ready commentary with context, narrative, and strategic framing. Includes:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {[
                      'Executive performance narrative',
                      'KPIs vs targets with variance analysis',
                      'Decisions needed from the board',
                      'Risk register with mitigation plans',
                      'Look-ahead: next 30/60/90 days',
                      'CEO confidence score + commentary',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] text-slate-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 flex-shrink-0"/>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2 flex-shrink-0">
                  <button
                    onClick={() => { onGenerate('board-deck'); setTab('board'); }}
                    disabled={!!loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm"
                  >
                    {isLoading('board-deck') ? <><SpinnerIcon />Generating…</> : '◈ Generate Deck'}
                  </button>
                  <div className="text-[10px] text-slate-600">~20 seconds · Powered by Claude AI</div>
                </div>
              </div>
            </div>
          )}
          <BoardDeckPanel
            deck={boardDeck}
            onGenerate={() => { onGenerate('board-deck'); setTab('board'); }}
            loading={isLoading('board-deck')}
          />
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] text-slate-400">
              {alerts.length
                ? `${alerts.length} alert${alerts.length > 1 ? 's' : ''} — ${alerts.filter(a => a.severity === 'HIGH').length} high priority`
                : 'No active alerts'}
            </div>
            <button
              onClick={() => onGenerate('alerts')}
              disabled={!!loading}
              className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all font-medium"
            >
              {isLoading('alerts') ? <><SpinnerIcon />Scanning…</> : '↺ Refresh Alerts'}
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-10 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-3">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-slate-500">
                  <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 110 2 1 1 0 010-2zm-1 4h2v5H7V8z"/>
                </svg>
              </div>
              <div className="text-[13px] font-semibold text-slate-300 mb-1">No risk alerts</div>
              <div className="text-[12px] text-slate-600 mb-4 leading-relaxed max-w-[200px]">AI scans margins, concentration, cash, and retention for anomalies</div>
              <button onClick={() => onGenerate('alerts')} disabled={!!loading}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
                {isLoading('alerts') ? <><SpinnerIcon />Scanning…</> : 'Run Scan →'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {['HIGH', 'MEDIUM', 'LOW'].map(sev => {
                const sevAlerts = alerts.filter(a => a.severity === sev);
                if (!sevAlerts.length) return null;
                return (
                  <div key={sev}>
                    <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">{sev} PRIORITY</div>
                    <div className="space-y-2">
                      {sevAlerts.map((a, i) => (
                        <div key={i} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border mt-0.5 flex-shrink-0 ${pillStyle(a.severity)}`}>
                              {a.severity}
                            </span>
                            <div className="flex-1">
                              <div className="text-[13px] font-semibold text-slate-100 mb-1">{a.title}</div>
                              <div className="text-[12px] text-slate-400 leading-relaxed mb-2">{a.message}</div>
                              <div className="text-[12px] text-indigo-400 font-medium">→ {a.action}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
