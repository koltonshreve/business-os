import { useState } from 'react';
import type { CustomKPI } from '../../types';

interface Props {
  kpis: CustomKPI[];
  onChange: (kpis: CustomKPI[]) => void;
  onAskAI?: (msg: string) => void;
}

function fmtValue(kpi: CustomKPI): string {
  const unit = kpi.unit === 'custom' ? (kpi.customUnit ?? '') : kpi.unit;
  if (kpi.unit === '$') {
    const v = kpi.value;
    return v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M`
      : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}k`
      : `$${v.toFixed(0)}`;
  }
  if (kpi.unit === '%') return `${kpi.value.toFixed(1)}%`;
  if (kpi.unit === 'x')  return `${kpi.value.toFixed(2)}×`;
  if (kpi.unit === 'days') return `${kpi.value.toFixed(0)} days`;
  return `${kpi.value.toLocaleString()} ${unit}`.trim();
}

const UNIT_OPTIONS: { value: CustomKPI['unit']; label: string }[] = [
  { value: '$',      label: '$ (currency)' },
  { value: '%',      label: '% (percentage)' },
  { value: 'x',      label: '× (multiple)' },
  { value: 'days',   label: 'days' },
  { value: 'custom', label: 'Other…' },
];

const BLANK_KPI: Omit<CustomKPI, 'id'> = {
  name: '',
  value: 0,
  unit: '$',
  higherIsBetter: true,
};

export default function CustomKPIPanel({ kpis, onChange, onAskAI }: Props) {
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState<Omit<CustomKPI, 'id'>>(BLANK_KPI);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openAdd = () => {
    setForm(BLANK_KPI);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (kpi: CustomKPI) => {
    setForm({ name: kpi.name, value: kpi.value, unit: kpi.unit, customUnit: kpi.customUnit, target: kpi.target, higherIsBetter: kpi.higherIsBetter, notes: kpi.notes });
    setEditId(kpi.id);
    setShowForm(true);
  };

  const save = () => {
    if (!form.name.trim()) return;
    if (editId) {
      onChange(kpis.map(k => k.id === editId ? { ...form, id: editId } : k));
    } else {
      onChange([...kpis, { ...form, id: `ckpi-${Date.now()}` }]);
    }
    setShowForm(false);
    setEditId(null);
  };

  const remove = (id: string) => {
    onChange(kpis.filter(k => k.id !== id));
    setConfirmDelete(null);
  };

  const set = <K extends keyof typeof form>(key: K, val: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Custom Metrics</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Track industry-specific KPIs alongside your financial data</div>
        </div>
        <div className="flex items-center gap-2">
          {onAskAI && kpis.length > 0 && (
            <button
              onClick={() => onAskAI(
                `My custom metrics: ${kpis.map(k => `${k.name}: ${fmtValue(k)}${k.target ? ` (target: ${k.target})` : ''}`).join(', ')}. How do these compare to industry benchmarks and what should I focus on?`
              )}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1"
            >
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
              Ask AI
            </button>
          )}
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 hover:border-indigo-500/50 px-3 py-1.5 rounded-lg transition-all"
          >
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
            Add Metric
          </button>
        </div>
      </div>

      {/* KPI cards grid */}
      {kpis.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-4">
          {kpis.map(kpi => {
            const attain = kpi.target && kpi.target > 0
              ? Math.min((kpi.value / kpi.target) * 100, 150) : null;
            const onTarget = attain != null && (kpi.higherIsBetter ? attain >= 100 : attain <= 100);
            const barColor = attain == null ? 'bg-slate-700'
              : onTarget ? 'bg-emerald-500/60'
              : attain >= 75 ? 'bg-amber-500/60' : 'bg-red-500/50';
            const valueColor = attain == null ? 'text-slate-100'
              : onTarget ? 'text-emerald-400' : attain >= 75 ? 'text-amber-400' : 'text-slate-100';

            return (
              <div key={kpi.id}
                className="group relative bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 hover:border-slate-700/60 transition-all"
              >
                {/* Edit / Delete controls */}
                <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
                  <button onClick={() => openEdit(kpi)}
                    className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                    <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5">
                      <path d="M6.5 1.5l2 2-5 5H1.5v-2l5-5z"/>
                    </svg>
                  </button>
                  {confirmDelete === kpi.id ? (
                    <button onClick={() => remove(kpi.id)}
                      className="text-[9px] font-bold text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors">
                      Delete?
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDelete(kpi.id)}
                      className="w-5 h-5 rounded flex items-center justify-center text-slate-700 hover:text-red-400 hover:bg-slate-800 transition-colors">
                      <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                      </svg>
                    </button>
                  )}
                </div>

                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-2 pr-8 leading-tight">
                  {kpi.name}
                </div>
                <div className={`text-[20px] font-bold tracking-tight ${valueColor}`}>
                  {fmtValue(kpi)}
                </div>
                {kpi.target && (
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    Target: {fmtValue({ ...kpi, value: kpi.target })}
                  </div>
                )}
                {attain != null && (
                  <>
                    <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${Math.min(attain, 100)}%` }}/>
                    </div>
                    <div className={`text-[9px] font-semibold mt-1 ${onTarget ? 'text-emerald-400' : attain >= 75 ? 'text-amber-400' : 'text-slate-600'}`}>
                      {onTarget ? '✓ On target' : `${attain.toFixed(0)}% of target`}
                    </div>
                  </>
                )}
                {kpi.notes && (
                  <div className="text-[10px] text-slate-600 mt-1.5 leading-snug">{kpi.notes}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : !showForm ? (
        <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center mb-4">
          <div className="text-[12px] text-slate-600 mb-2">No custom metrics yet</div>
          <div className="text-[11px] text-slate-700 max-w-xs mx-auto leading-relaxed">
            Track metrics specific to your business — jobs completed, avg ticket size, utilization rate, NPS, or anything else
          </div>
          <button onClick={openAdd}
            className="mt-3 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            + Add your first metric
          </button>
        </div>
      ) : null}

      {/* Add / Edit form */}
      {showForm && (
        <div className="border border-slate-700/50 rounded-xl p-4 space-y-3 bg-slate-900/40">
          <div className="text-[12px] font-semibold text-slate-300">
            {editId ? 'Edit Metric' : 'New Custom Metric'}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Name */}
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Metric Name</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setShowForm(false); }}
                placeholder="e.g. Jobs Completed, NPS Score, Utilization Rate"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Value */}
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Current Value</label>
              <input
                type="number"
                value={form.value || ''}
                onChange={e => set('value', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Unit */}
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Unit</label>
              <select
                value={form.unit}
                onChange={e => set('unit', e.target.value as CustomKPI['unit'])}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50"
              >
                {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Custom unit label */}
            {form.unit === 'custom' && (
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Unit Label</label>
                <input
                  type="text"
                  value={form.customUnit ?? ''}
                  onChange={e => set('customUnit', e.target.value)}
                  placeholder="e.g. jobs, tickets, sq ft"
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            )}

            {/* Target */}
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Target (optional)</label>
              <input
                type="number"
                value={form.target ?? ''}
                onChange={e => set('target', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Leave blank if no target"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Higher is better */}
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => set('higherIsBetter', !form.higherIsBetter)}
                  className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${form.higherIsBetter ? 'bg-emerald-500/60' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${form.higherIsBetter ? 'left-4' : 'left-0.5'}`}/>
                </div>
                <span className="text-[11px] text-slate-400">
                  {form.higherIsBetter ? 'Higher is better' : 'Lower is better'}
                </span>
              </label>
            </div>

            {/* Notes */}
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Notes (optional)</label>
              <input
                type="text"
                value={form.notes ?? ''}
                onChange={e => set('notes', e.target.value || undefined)}
                placeholder="Context about this metric"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="flex-1 px-3 py-2 text-[12px] text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!form.name.trim()}
              className="flex-1 px-3 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {editId ? 'Save Changes' : 'Add Metric'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
