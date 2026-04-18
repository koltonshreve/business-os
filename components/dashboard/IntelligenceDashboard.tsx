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

export default function IntelligenceDashboard({ weeklyInsight, boardDeck, alerts, loading, onGenerate }: Props) {
  const [tab, setTab] = useState<IntelTab>('weekly');

  const isLoading = (action: string) => loading === action;

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
                tab === t.id ? 'bg-slate-800 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <button
          onClick={() => onGenerate('full-report')}
          disabled={!!loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm"
        >
          {isLoading('full-report') ? <><SpinnerIcon /> Generating All…</> : '✦ Generate Full Report'}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'weekly' && (
        <div>
          {!weeklyInsight && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-5 py-4 text-[13px] text-indigo-300/80 mb-4 flex items-center justify-between">
              <span>Generate your weekly intelligence report — AI analyzes what changed, why it matters, and what to do next.</span>
              <button
                onClick={() => { onGenerate('weekly-insight'); setTab('weekly'); }}
                disabled={!!loading}
                className="flex items-center gap-1.5 flex-shrink-0 ml-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[12px] font-semibold"
              >
                {isLoading('weekly-insight') ? <><SpinnerIcon />Generating…</> : 'Generate →'}
              </button>
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
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-5 py-4 text-[13px] text-indigo-300/80 mb-4 flex items-center justify-between">
              <span>Generate your monthly board deck — executive commentary with performance analysis, decisions needed, and risk assessment.</span>
              <button
                onClick={() => { onGenerate('board-deck'); setTab('board'); }}
                disabled={!!loading}
                className="flex items-center gap-1.5 flex-shrink-0 ml-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[12px] font-semibold"
              >
                {isLoading('board-deck') ? <><SpinnerIcon />Generating…</> : 'Generate →'}
              </button>
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
              <div className="text-[13px] font-medium text-slate-400 mb-1">No alerts generated yet</div>
              <div className="text-[12px] text-slate-600 mb-4">Alerts are generated from KPI anomalies and threshold breaches</div>
              <button onClick={() => onGenerate('alerts')} disabled={!!loading}
                className="text-[12px] font-semibold text-indigo-400 hover:text-indigo-300">
                Generate Risk Alerts →
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
