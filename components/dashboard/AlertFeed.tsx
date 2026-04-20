import { useState } from 'react';

interface Alert {
  severity: string;
  title: string;
  message: string;
  action: string;
}

interface Props {
  alerts: Alert[];
  onRunAlerts: () => void;
  loading: boolean;
  onDismiss?: (index: number) => void;
  onCreateTask?: (title: string, context: string) => void;
  onAskAI?: (msg: string) => void;
  onNavigate?: (view: string) => void;
}

// Map alert title keywords → relevant tab
function inferView(alert: Alert): string | null {
  const t = (alert.title + ' ' + alert.message).toLowerCase();
  if (t.includes('cash') || t.includes('runway') || t.includes('burn')) return 'cash';
  if (t.includes('margin') || t.includes('ebitda') || t.includes('revenue') || t.includes('cost') || t.includes('profit')) return 'financial';
  if (t.includes('customer') || t.includes('churn') || t.includes('retention') || t.includes('concentration')) return 'customers';
  if (t.includes('headcount') || t.includes('employee') || t.includes('operations')) return 'operations';
  return null;
}

const TAB_LABEL: Record<string, string> = {
  financial: 'Financial', customers: 'Customers', operations: 'Operations', cash: 'Cash'
};

function AlertRow({
  alert, index, onDismiss, onCreateTask, onAskAI, onNavigate,
}: {
  alert: Alert;
  index: number;
  onDismiss?: (i: number) => void;
  onCreateTask?: (title: string, ctx: string) => void;
  onAskAI?: (msg: string) => void;
  onNavigate?: (view: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);
  const view = inferView(alert);

  const pillStyle =
    alert.severity === 'HIGH'   ? 'text-red-400 bg-red-500/10 border-red-500/25' :
    alert.severity === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
                                   'text-slate-400 bg-slate-800 border-slate-700/50';

  function handleCreateTask() {
    if (!onCreateTask) return;
    onCreateTask(
      `Review: ${alert.title}`,
      `Alert (${alert.severity}): ${alert.message}\n\nRecommended action: ${alert.action}`
    );
    setTaskCreated(true);
  }

  function handleAskAI() {
    if (!onAskAI) return;
    onAskAI(
      `I have a ${alert.severity} alert: "${alert.title}". ${alert.message} Recommended action was: ${alert.action}. What should I prioritize and how should I approach this?`
    );
  }

  return (
    <div className={`px-4 py-3 group border-b border-slate-800/40 last:border-0 ${alert.severity === 'HIGH' ? 'bg-red-500/3' : ''}`}>
      {/* Header row */}
      <div className="flex items-start gap-2 mb-1.5">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${pillStyle}`}>
          {alert.severity}
        </span>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 text-left text-[12px] font-medium text-slate-200 hover:text-white transition-colors"
        >
          {alert.title}
        </button>
        {onDismiss && (
          <button
            onClick={() => onDismiss(index)}
            title="Mark as reviewed"
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 text-lg leading-none transition-all"
          >
            ×
          </button>
        )}
      </div>

      {/* Detail */}
      <div className="text-[11px] text-slate-500 leading-relaxed mb-2 pl-0">{alert.message}</div>

      {/* Recommended action — now highlighted */}
      <div className="text-[11px] text-amber-400/90 font-medium mb-2.5 flex items-start gap-1.5">
        <span className="flex-shrink-0 mt-px">→</span>
        <span>{alert.action}</span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {onCreateTask && (
          <button
            onClick={handleCreateTask}
            disabled={taskCreated}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
              taskCreated
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 cursor-default'
                : 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border-slate-700/40 hover:text-white'
            }`}
          >
            {taskCreated ? (
              <>
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><path d="M2 5.5l2 2 4-4"/></svg>
                Task created
              </>
            ) : (
              <>
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5"><path d="M5 2v6M2 5h6"/></svg>
                Create task
              </>
            )}
          </button>
        )}
        {onAskAI && (
          <button
            onClick={handleAskAI}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border bg-indigo-500/8 hover:bg-indigo-500/15 text-indigo-400 border-indigo-500/20 transition-colors"
          >
            <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5"><path d="M5 0.5a4 4 0 014 4 4 4 0 01-2.8 3.8v1l-1.2-.9-1-.4A4 4 0 015 0.5z"/></svg>
            Ask AI
          </button>
        )}
        {view && onNavigate && (
          <button
            onClick={() => onNavigate(view)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border bg-slate-800/40 hover:bg-slate-700/40 text-slate-400 hover:text-slate-200 border-slate-700/30 transition-colors"
          >
            View {TAB_LABEL[view]}
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2.5 h-2.5"><path d="M3.5 2.5l3 2.5-3 2.5"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function AlertFeed({ alerts, onRunAlerts, loading, onDismiss, onCreateTask, onAskAI, onNavigate }: Props) {
  const highCount = alerts.filter(a => a.severity === 'HIGH').length;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="text-[12px] font-semibold text-slate-200">Alerts</div>
          {highCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              {highCount} HIGH
            </span>
          )}
        </div>
        <button
          onClick={onRunAlerts}
          disabled={loading}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40 px-2 py-1 rounded-md hover:bg-slate-800/60"
        >
          {loading ? (
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin">
              <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
              <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
            </svg>
          ) : '↺ Refresh'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {!alerts.length ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center px-5">
            <div className="w-9 h-9 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-3">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-slate-500">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a1 1 0 110 2 1 1 0 010-2zm-1 4h2v5H7V8z"/>
              </svg>
            </div>
            <div className="text-[12px] font-semibold text-slate-300 mb-1">No risk alerts</div>
            <div className="text-[11px] text-slate-600 mb-4 leading-relaxed max-w-[160px]">
              AI scans margins, concentration, cash, and retention for anomalies.
            </div>
            <button
              onClick={onRunAlerts}
              disabled={loading}
              className="text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
            >
              {loading ? 'Scanning…' : 'Run scan →'}
            </button>
          </div>
        ) : (
          <div>
            {alerts.map((a, i) => (
              <AlertRow
                key={i}
                alert={a}
                index={i}
                onDismiss={onDismiss}
                onCreateTask={onCreateTask}
                onAskAI={onAskAI}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
