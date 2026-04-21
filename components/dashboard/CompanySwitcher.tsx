import { useState, useEffect, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface CompanyRecord {
  id: string;
  name: string;
  createdAt: string;
}

// ── LocalStorage keys for company registry (NOT per-company) ──────────────────
const REGISTRY_KEY    = 'bos_companies';
const ACTIVE_CO_KEY   = 'bos_active_company';

// ── Per-company keys to bundle and restore ────────────────────────────────────
const PER_COMPANY_KEYS = [
  'bos_company',
  'bos_company_profile',
  'bos_snapshots',
  'bos_active_id',
  'bos_goals',
  'bos_budget',
  'bos_annotations',
  'bos_custom_kpis',
  'bos_thresholds',
  'bos_panel_notes',
  'bos_weekly_insight',
  'bos_board_deck',
  'bos_alerts',
  'bos_report_timestamps',
  'bos_addbacks',
  'bos_deals',
  'bos_agent_results',
  'bos_market_sizing',
  'bos_cash_forecast',
  'bos_cash_forecast_open',
  'bos_cash_forecast_min',
  'bos_debt_lines',
  'bos_compare_mode',
  'bos_import_meta',
  'bos_ar_tasks',
  'bos_contracts',
  'bos_nps_history',
  'bos_dataroom_checklist',
  'bos_ux_mode',
  'bos_visited',
];

function bundleKey(companyId: string) {
  return `bos_company_data_${companyId}`;
}

function saveCurrentState(companyId: string) {
  const bundle: Record<string, string | null> = {};
  for (const key of PER_COMPANY_KEYS) {
    bundle[key] = localStorage.getItem(key);
  }
  try {
    localStorage.setItem(bundleKey(companyId), JSON.stringify(bundle));
  } catch { /* quota */ }
}

function restoreState(companyId: string) {
  const raw = localStorage.getItem(bundleKey(companyId));
  // Clear all per-company keys first
  for (const key of PER_COMPANY_KEYS) {
    localStorage.removeItem(key);
  }
  if (raw) {
    try {
      const bundle = JSON.parse(raw) as Record<string, string | null>;
      for (const [key, val] of Object.entries(bundle)) {
        if (val !== null) localStorage.setItem(key, val);
      }
    } catch { /* corrupt — start fresh */ }
  }
}

export function loadCompanyRegistry(): { companies: CompanyRecord[]; activeId: string } {
  let companies: CompanyRecord[] = [];
  let activeId = '';
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (raw) companies = JSON.parse(raw) as CompanyRecord[];
  } catch { /* ignore */ }
  try {
    activeId = localStorage.getItem(ACTIVE_CO_KEY) ?? '';
  } catch { /* ignore */ }
  // Bootstrap: if registry is empty, create a default company based on existing data
  if (companies.length === 0) {
    const defaultName = localStorage.getItem('bos_company') ?? 'My Company';
    const defaultId = 'co-default';
    companies = [{ id: defaultId, name: defaultName, createdAt: new Date().toISOString() }];
    activeId = defaultId;
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(companies));
      localStorage.setItem(ACTIVE_CO_KEY, defaultId);
    } catch { /* ignore */ }
  }
  // If activeId is missing/invalid, fall back to first company
  if (!companies.find(c => c.id === activeId)) {
    activeId = companies[0].id;
    try { localStorage.setItem(ACTIVE_CO_KEY, activeId); } catch { /* ignore */ }
  }
  return { companies, activeId };
}

interface Props {
  collapsed?: boolean;
}

export default function CompanySwitcher({ collapsed }: Props) {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [activeId, setActiveId] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => {
      const { companies: co, activeId: id } = loadCompanyRegistry();
      // Sync active company name with bos_company if it changed
      const currentName = localStorage.getItem('bos_company');
      if (currentName) {
        const idx = co.findIndex(c => c.id === id);
        if (idx !== -1 && co[idx].name !== currentName) {
          co[idx] = { ...co[idx], name: currentName };
          try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(co)); } catch { /* ignore */ }
        }
      }
      setCompanies([...co]);
      setActiveId(id);
    };
    load();
    const handler = (e: StorageEvent) => {
      if (e.key === 'bos_company' || e.key === REGISTRY_KEY || e.key === ACTIVE_CO_KEY) load();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeCompany = companies.find(c => c.id === activeId);

  const switchTo = (id: string) => {
    if (id === activeId) { setOpen(false); return; }
    // Save current state under current company
    saveCurrentState(activeId);
    // Restore target company state
    restoreState(id);
    // Update registry
    localStorage.setItem(ACTIVE_CO_KEY, id);
    // Reload to re-hydrate all React state
    window.location.reload();
  };

  const createCompany = () => {
    const name = newName.trim() || 'New Company';
    const id = `co-${Date.now()}`;
    const record: CompanyRecord = { id, name, createdAt: new Date().toISOString() };
    // Save current company state first
    saveCurrentState(activeId);
    // Create empty state for new company — just set a company name
    localStorage.setItem('bos_company', name);
    // Remove all other per-company keys so new company starts fresh
    for (const key of PER_COMPANY_KEYS) {
      if (key !== 'bos_company' && key !== 'bos_visited') localStorage.removeItem(key);
    }
    // Update registry
    const next = [...companies, record];
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(next));
    localStorage.setItem(ACTIVE_CO_KEY, id);
    // Save the empty state as this company's bundle
    saveCurrentState(id);
    window.location.reload();
  };

  const deleteCompany = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (companies.length <= 1) return; // can't delete last
    const next = companies.filter(c => c.id !== id);
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(next));
    // Also remove the bundle
    localStorage.removeItem(bundleKey(id));
    if (id === activeId) {
      // Switch to first remaining
      const fallback = next[0];
      restoreState(fallback.id);
      localStorage.setItem(ACTIVE_CO_KEY, fallback.id);
      window.location.reload();
    } else {
      setCompanies(next);
    }
  };

  if (collapsed) {
    return (
      <div className="px-2 pb-3">
        <button
          onClick={() => setOpen(v => !v)}
          title={activeCompany?.name ?? 'Switch company'}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-800/60 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M2 3h10v1H2V3zm0 3.5h10v1H2v-1zm0 3.5h6v1H2v-1z"/>
            <path d="M11 8l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="px-2 pb-3 relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800/50 border border-slate-800/40 hover:border-slate-700/60 transition-all group"
      >
        <div className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-bold text-indigo-400">
            {(activeCompany?.name ?? 'M')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[11px] font-semibold text-slate-300 truncate">{activeCompany?.name ?? 'My Company'}</div>
          {companies.length > 1 && (
            <div className="text-[9px] text-slate-600">{companies.length} companies</div>
          )}
        </div>
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={`w-2.5 h-2.5 text-slate-600 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 3.5L5 6.5 8 3.5"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-[#0d1117] border border-slate-700/60 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Company list */}
          <div className="py-1">
            {companies.map(co => (
              <div
                key={co.id}
                onClick={() => switchTo(co.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors group/item ${
                  co.id === activeId
                    ? 'bg-indigo-500/10 text-indigo-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
                  co.id === activeId ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'bg-slate-800 border border-slate-700/40 text-slate-500'
                }`}>
                  {co.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium truncate">{co.name}</div>
                </div>
                {co.id === activeId && (
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 text-indigo-400 flex-shrink-0">
                    <path d="M2 6l3 3 5-5"/>
                  </svg>
                )}
                {co.id !== activeId && companies.length > 1 && (
                  <button
                    onClick={e => deleteCompany(e, co.id)}
                    className="opacity-0 group-hover/item:opacity-100 text-slate-700 hover:text-red-400 transition-all text-sm leading-none flex-shrink-0"
                    title="Remove company"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add new company */}
          <div className="border-t border-slate-800/60 p-2">
            {creating ? (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { createCompany(); }
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="Company name…"
                  className="flex-1 min-w-0 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={createCompany}
                  className="flex-shrink-0 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition-colors"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setCreating(true); setNewName(''); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-[11px] text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-3 h-3">
                  <path d="M6 2v8M2 6h8"/>
                </svg>
                Add company
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
