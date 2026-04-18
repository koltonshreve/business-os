interface Props {
  alerts: { severity: string; title: string; message: string; action: string }[];
  onRunAlerts: () => void;
  loading: boolean;
}

export default function AlertFeed({ alerts, onRunAlerts, loading }: Props) {
  const pillStyle = (s: string) =>
    s === 'HIGH'   ? 'text-red-400 bg-red-500/10 border-red-500/25' :
    s === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
                     'text-slate-400 bg-slate-800 border-slate-700/50';

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between flex-shrink-0">
        <div className="text-[12px] font-semibold text-slate-200">Alerts</div>
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
          <div className="divide-y divide-slate-800/50">
            {alerts.map((a, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${pillStyle(a.severity)}`}>
                    {a.severity}
                  </span>
                  <span className="text-[12px] font-medium text-slate-200 truncate">{a.title}</span>
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed mb-1.5">{a.message}</div>
                <div className="text-[11px] text-indigo-400/80 font-medium">→ {a.action}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
