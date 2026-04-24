// ─── SetupChecklist ───────────────────────────────────────────────────────────
// Floating "5 things to set up" checklist for new users.
// Persisted to localStorage under 'bos_setup_checklist'.
// Dismissed permanently via 'bos_setup_checklist_done'.

import React, { useState, useEffect, useCallback } from 'react';

export interface ChecklistState {
  companyName: boolean;   // Company name changed from default
  dataUploaded: boolean;  // At least one KPI snapshot exists with data
  kpiThreshold: boolean;  // At least one KPI threshold set
  dealAdded: boolean;     // At least one CRM deal created
  goalSet: boolean;       // At least one goal set
}

interface SetupChecklistProps {
  companyName: string;
  hasThresholds: boolean;
  hasGoals: boolean;
  onNavigate: (view: string) => void;
}

const STEPS: {
  key: keyof ChecklistState;
  label: string;
  description: string;
  action: string;
  nav: string;
}[] = [
  {
    key: 'companyName',
    label: 'Name your company',
    description: 'Set your company name so reports and emails are personalised',
    action: 'Open Account',
    nav: 'account',
  },
  {
    key: 'dataUploaded',
    label: 'Upload financial data',
    description: 'Import a CSV or enter figures manually to see your KPI dashboard',
    action: 'Enter Data',
    nav: 'data',
  },
  {
    key: 'kpiThreshold',
    label: 'Set a KPI alert threshold',
    description: 'Get notified when revenue, margin, or cash falls outside your target',
    action: 'Set Thresholds',
    nav: 'data',
  },
  {
    key: 'dealAdded',
    label: 'Add a CRM deal',
    description: 'Track active opportunities through your pipeline',
    action: 'Open Pipeline',
    nav: 'pipeline',
  },
  {
    key: 'goalSet',
    label: 'Set a goal',
    description: 'Define a revenue, EBITDA, or growth target to track progress',
    action: 'Set Goals',
    nav: 'goals',
  },
];

const STORAGE_KEY  = 'bos_setup_checklist';
const DISMISS_KEY  = 'bos_setup_checklist_done';

export default function SetupChecklist({ companyName, hasThresholds, hasGoals, onNavigate }: SetupChecklistProps) {
  const [open, setOpen]           = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [checks, setChecks]       = useState<ChecklistState>({
    companyName: false,
    dataUploaded: false,
    kpiThreshold: false,
    dealAdded: false,
    goalSet: false,
  });

  // Hydrate from localStorage and live props
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if permanently dismissed
    if (localStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true);
      return;
    }

    const next: ChecklistState = {
      companyName: companyName !== 'My Company' && companyName.trim().length > 0,
      dataUploaded: (() => {
        try {
          const snapshots = localStorage.getItem('bos_snapshots');
          const list = snapshots ? JSON.parse(snapshots) as { data?: unknown }[] : [];
          return list.length > 0;
        } catch { return false; }
      })(),
      kpiThreshold: hasThresholds,
      dealAdded: (() => {
        try {
          const raw = localStorage.getItem('bos_deals');
          const list = raw ? JSON.parse(raw) as unknown[] : [];
          return list.length > 0;
        } catch { return false; }
      })(),
      goalSet: hasGoals,
    };

    setChecks(next);

    // If all done, dismiss automatically
    const allDone = Object.values(next).every(Boolean);
    if (allDone) {
      localStorage.setItem(DISMISS_KEY, '1');
      setDismissed(true);
      return;
    }

    // Restore open state
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'open') setOpen(true);
  }, [companyName, hasThresholds, hasGoals]);

  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? 'open' : 'closed'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
    setOpen(false);
  }, []);

  const handleStep = useCallback((nav: string) => {
    if (nav === 'account') {
      // Trigger account modal — we can't open it directly, so navigate to overview + hint
      onNavigate('overview');
    } else {
      onNavigate(nav);
    }
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, 'closed'); } catch { /* ignore */ }
  }, [onNavigate]);

  if (dismissed) return null;

  const done  = Object.values(checks).filter(Boolean).length;
  const total = STEPS.length;
  const pct   = Math.round((done / total) * 100);

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
      {/* ── Expanded panel ─────────────────────────────────────────── */}
      {open && (
        <div
          className="pointer-events-auto w-[300px] rounded-2xl border border-slate-700/60 bg-[#0c1120]/95 backdrop-blur-md shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
            <div>
              <div className="text-[13px] font-semibold text-slate-100">Getting started</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{done} of {total} complete</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={dismiss}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-1.5 py-0.5 rounded"
                title="Dismiss checklist"
              >
                Dismiss
              </button>
              <button
                onClick={toggle}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                aria-label="Close"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-4 pt-3 pb-1">
            <div className="h-1 rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="px-4 py-3 space-y-0.5">
            {STEPS.map(step => {
              const isDone = checks[step.key];
              return (
                <div
                  key={step.key}
                  className={`flex items-start gap-3 rounded-lg px-2 py-2 group transition-colors ${isDone ? 'opacity-50' : 'hover:bg-slate-800/40 cursor-pointer'}`}
                  onClick={isDone ? undefined : () => handleStep(step.nav)}
                >
                  {/* Checkbox */}
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                    isDone
                      ? 'bg-emerald-500/20 border-emerald-500/60'
                      : 'border-slate-600/60 group-hover:border-slate-500'
                  }`}>
                    {isDone && (
                      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M2 5l2.5 2.5L8 3"/>
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-medium leading-tight ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {step.label}
                    </div>
                    {!isDone && (
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{step.description}</div>
                    )}
                  </div>

                  {/* Arrow */}
                  {!isDone && (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 mt-0.5 flex-shrink-0 transition-colors" fill="currentColor">
                      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FAB trigger ────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-slate-700/60 bg-[#0c1120]/95 backdrop-blur-md px-3.5 py-2 shadow-lg hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all"
        title="Setup checklist"
      >
        {/* Ring progress */}
        <div className="relative w-6 h-6">
          <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
            <circle cx="12" cy="12" r="9" fill="none" stroke="#1e293b" strokeWidth="2.5"/>
            <circle
              cx="12" cy="12" r="9" fill="none"
              stroke={pct === 100 ? '#10b981' : '#6366f1'}
              strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 9}`}
              strokeDashoffset={`${2 * Math.PI * 9 * (1 - pct / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-300">
            {done}/{total}
          </span>
        </div>

        <span className="text-[12px] font-medium text-slate-300 whitespace-nowrap">
          {pct === 100 ? 'All set!' : 'Setup'}
        </span>

        {/* Chevron */}
        <svg
          viewBox="0 0 16 16"
          className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        >
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>
    </div>
  );
}
