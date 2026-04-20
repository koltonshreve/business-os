// ─── DealValueTracker ─────────────────────────────────────────────────────────
// Post-acquisition value creation tracker.
// Shows: baseline metrics → initiatives → periodic snapshots → value created.

import { useState } from 'react';
import type { Deal, ValueInitiative, ValueSnapshot } from '../../lib/deals';
import { updateDeal } from '../../lib/deals';

interface Props {
  deal: Deal;
  onUpdate: (d: Deal) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function fmtN(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ── Baseline Setup ────────────────────────────────────────────────────────────
function BaselineSetup({ deal, onUpdate, onToast }: Props) {
  const vt = deal.valueTracking;
  const [editing, setEditing] = useState(!vt?.acquisitionDate);
  const [form, setForm] = useState({
    acquisitionDate: vt?.acquisitionDate ?? deal.closingDate ?? '',
    baselineRevenue: vt?.baselineRevenue != null ? String(vt.baselineRevenue / 1000) : (deal.revenue != null ? String(deal.revenue / 1000) : ''),
    baselineEbitda: vt?.baselineEbitda != null ? String(vt.baselineEbitda / 1000) : (deal.ebitda != null ? String(deal.ebitda / 1000) : ''),
    baselineHeadcount: vt?.baselineHeadcount != null ? String(vt.baselineHeadcount) : (deal.employees != null ? String(deal.employees) : ''),
  });

  function save() {
    const rev = parseFloat(form.baselineRevenue) * 1000;
    const eb  = parseFloat(form.baselineEbitda) * 1000;
    const hc  = parseInt(form.baselineHeadcount, 10);
    const updated = updateDeal(deal, {
      valueTracking: {
        ...deal.valueTracking,
        acquisitionDate: form.acquisitionDate || undefined,
        baselineRevenue: !isNaN(rev) ? rev : undefined,
        baselineEbitda:  !isNaN(eb) ? eb : undefined,
        baselineHeadcount: !isNaN(hc) ? hc : undefined,
        initiatives: deal.valueTracking?.initiatives ?? [],
        snapshots: deal.valueTracking?.snapshots ?? [],
      },
    });
    onUpdate(updated);
    setEditing(false);
    onToast('Baseline saved', 'success');
  }

  if (!editing && vt?.acquisitionDate) {
    return (
      <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Acquisition Baseline</div>
          <button onClick={() => setEditing(true)} className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors">Edit</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Baseline Revenue', value: fmtN(vt.baselineRevenue) },
            { label: 'Baseline EBITDA', value: fmtN(vt.baselineEbitda) },
            { label: 'Headcount', value: vt.baselineHeadcount ?? '—' },
          ].map(m => (
            <div key={m.label}>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] mb-0.5">{m.label}</div>
              <div className="text-[16px] font-bold text-slate-100 tabular-nums">{m.value}</div>
            </div>
          ))}
        </div>
        {vt.acquisitionDate && (
          <div className="mt-2 text-[10px] text-slate-600">
            Acquired {new Date(vt.acquisitionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 border border-indigo-500/20 rounded-xl p-4">
      <div className="text-[12px] font-semibold text-slate-200 mb-3">
        {vt?.acquisitionDate ? 'Edit Baseline' : 'Set Acquisition Baseline'}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] block mb-1">Acquisition Date</label>
          <input type="date" value={form.acquisitionDate} onChange={e => setForm(f => ({ ...f, acquisitionDate: e.target.value }))}
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] block mb-1">Headcount</label>
          <input type="number" value={form.baselineHeadcount} onChange={e => setForm(f => ({ ...f, baselineHeadcount: e.target.value }))}
            placeholder="e.g. 12" min={0}
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] block mb-1">Revenue (in $k)</label>
          <input type="number" value={form.baselineRevenue} onChange={e => setForm(f => ({ ...f, baselineRevenue: e.target.value }))}
            placeholder="e.g. 2800"
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] block mb-1">EBITDA (in $k)</label>
          <input type="number" value={form.baselineEbitda} onChange={e => setForm(f => ({ ...f, baselineEbitda: e.target.value }))}
            placeholder="e.g. 420"
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[12px] font-semibold transition-colors">
          Save Baseline
        </button>
        {vt?.acquisitionDate && (
          <button onClick={() => setEditing(false)} className="px-3.5 py-1.5 border border-slate-700/60 text-slate-400 hover:text-slate-200 rounded-lg text-[12px] font-medium transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Value Delta Card ──────────────────────────────────────────────────────────
function ValueDeltaCard({ deal }: { deal: Deal }) {
  const vt = deal.valueTracking;
  if (!vt) return null;

  const snapshots = [...(vt.snapshots ?? [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latest = snapshots[snapshots.length - 1];
  if (!latest && !vt.baselineRevenue) return null;

  const curRev  = latest?.revenue ?? vt.baselineRevenue;
  const curEB   = latest?.ebitda ?? vt.baselineEbitda;
  const baseRev = vt.baselineRevenue;
  const baseEB  = vt.baselineEbitda;

  const revDelta   = curRev != null && baseRev ? curRev - baseRev : null;
  const ebDelta    = curEB != null && baseEB ? curEB - baseEB : null;
  const revDeltaPct = baseRev && revDelta != null ? (revDelta / baseRev) * 100 : null;
  const ebDeltaPct  = baseEB && ebDelta != null ? (ebDelta / baseEB) * 100 : null;

  if (revDelta == null && ebDelta == null) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {revDelta != null && (
        <div className={`rounded-xl border px-4 py-3 ${revDelta >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Revenue Created</div>
          <div className={`text-[20px] font-bold tabular-nums ${revDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {revDelta >= 0 ? '+' : ''}{fmtN(revDelta)}
          </div>
          {revDeltaPct != null && (
            <div className={`text-[11px] font-semibold mt-0.5 ${revDelta >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              {revDelta >= 0 ? '+' : ''}{revDeltaPct.toFixed(1)}% vs baseline
            </div>
          )}
        </div>
      )}
      {ebDelta != null && (
        <div className={`rounded-xl border px-4 py-3 ${ebDelta >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">EBITDA Created</div>
          <div className={`text-[20px] font-bold tabular-nums ${ebDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {ebDelta >= 0 ? '+' : ''}{fmtN(ebDelta)}
          </div>
          {ebDeltaPct != null && (
            <div className={`text-[11px] font-semibold mt-0.5 ${ebDelta >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              {ebDelta >= 0 ? '+' : ''}{ebDeltaPct.toFixed(1)}% vs baseline
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Initiatives List ──────────────────────────────────────────────────────────
function InitiativesList({ deal, onUpdate, onToast }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', estimatedImpact: '' });

  const initiatives = deal.valueTracking?.initiatives ?? [];

  function addInitiative() {
    if (!draft.title.trim()) return;
    const init: ValueInitiative = {
      id: `init_${uid()}`,
      title: draft.title.trim(),
      estimatedImpact: draft.estimatedImpact.trim() || undefined,
      status: 'planned',
      createdAt: new Date().toISOString(),
    };
    const updated = updateDeal(deal, {
      valueTracking: {
        ...deal.valueTracking,
        initiatives: [...initiatives, init],
        snapshots: deal.valueTracking?.snapshots ?? [],
      },
    });
    onUpdate(updated);
    setDraft({ title: '', estimatedImpact: '' });
    setAdding(false);
    onToast('Initiative added', 'success');
  }

  function cycleStatus(initId: string) {
    const order: ValueInitiative['status'][] = ['planned', 'in-progress', 'completed'];
    const updated = updateDeal(deal, {
      valueTracking: {
        ...deal.valueTracking,
        initiatives: initiatives.map(i => {
          if (i.id !== initId) return i;
          const next = order[(order.indexOf(i.status) + 1) % order.length];
          return { ...i, status: next, completedAt: next === 'completed' ? new Date().toISOString() : undefined };
        }),
        snapshots: deal.valueTracking?.snapshots ?? [],
      },
    });
    onUpdate(updated);
  }

  function removeInitiative(initId: string) {
    const updated = updateDeal(deal, {
      valueTracking: {
        ...deal.valueTracking,
        initiatives: initiatives.filter(i => i.id !== initId),
        snapshots: deal.valueTracking?.snapshots ?? [],
      },
    });
    onUpdate(updated);
  }

  const statusStyle: Record<ValueInitiative['status'], { badge: string; dot: string }> = {
    'planned':     { badge: 'bg-slate-800/60 text-slate-400 border-slate-700/50',     dot: 'bg-slate-500' },
    'in-progress': { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25',     dot: 'bg-amber-400' },
    'completed':   { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-500' },
  };

  const statusLabel: Record<ValueInitiative['status'], string> = {
    planned: 'Planned', 'in-progress': 'In Progress', completed: 'Done',
  };

  const completedCount = initiatives.filter(i => i.status === 'completed').length;

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[12px] font-semibold text-slate-200">Value Initiatives</div>
          {initiatives.length > 0 && (
            <span className="text-[10px] font-semibold text-emerald-400/80">
              {completedCount}/{initiatives.length} done
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 rounded-lg transition-all"
        >
          + Add
        </button>
      </div>

      {adding && (
        <div className="px-4 py-3 border-b border-slate-800/40 space-y-2.5 bg-indigo-500/[0.03]">
          <input
            autoFocus
            value={draft.title}
            onChange={e => setDraft(f => ({ ...f, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') addInitiative(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Initiative title (e.g. 'Implement route optimization')"
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
          />
          <input
            value={draft.estimatedImpact}
            onChange={e => setDraft(f => ({ ...f, estimatedImpact: e.target.value }))}
            placeholder="Estimated impact (e.g. '+$80k EBITDA')"
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
          />
          <div className="flex gap-2">
            <button onClick={addInitiative} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition-colors">
              Add Initiative
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-slate-500 hover:text-slate-300 text-[11px] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {initiatives.length === 0 && !adding && (
        <div className="px-4 py-5 text-center text-[11px] text-slate-600">
          No initiatives yet. Add value creation initiatives to track post-acquisition improvements.
        </div>
      )}

      <div>
        {initiatives.map(init => {
          const s = statusStyle[init.status];
          return (
            <div key={init.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-800/30 last:border-0 group">
              <button
                onClick={() => cycleStatus(init.id)}
                title="Click to advance status"
                className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${s.badge}`}
              >
                {init.status === 'completed' && (
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-2.5 h-2.5">
                    <path d="M2 5.5l2 2 4-4"/>
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[12px] font-medium leading-snug ${init.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {init.title}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${s.badge}`}>
                    {statusLabel[init.status]}
                  </span>
                </div>
                {init.estimatedImpact && (
                  <div className="text-[10px] font-semibold text-emerald-400/80 mt-0.5">{init.estimatedImpact}</div>
                )}
              </div>
              <button
                onClick={() => removeInitiative(init.id)}
                className="flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-slate-600 hover:text-red-400 text-lg leading-none transition-all"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Periodic Snapshots ────────────────────────────────────────────────────────
function SnapshotsList({ deal, onUpdate, onToast }: Props) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', date: '', revenue: '', ebitda: '', headcount: '', notes: '' });

  const snapshots = [...(deal.valueTracking?.snapshots ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  function addSnapshot() {
    if (!form.label.trim() || !form.date) return;
    const snap: ValueSnapshot = {
      id: `snap_${uid()}`,
      date: form.date,
      label: form.label.trim(),
      revenue: form.revenue ? parseFloat(form.revenue) * 1000 : undefined,
      ebitda: form.ebitda ? parseFloat(form.ebitda) * 1000 : undefined,
      headcount: form.headcount ? parseInt(form.headcount, 10) : undefined,
      notes: form.notes.trim() || undefined,
    };
    const updated = updateDeal(deal, {
      valueTracking: {
        ...deal.valueTracking,
        snapshots: [...(deal.valueTracking?.snapshots ?? []), snap],
        initiatives: deal.valueTracking?.initiatives ?? [],
      },
    });
    onUpdate(updated);
    setForm({ label: '', date: '', revenue: '', ebitda: '', headcount: '', notes: '' });
    setAdding(false);
    onToast('Snapshot added', 'success');
  }

  function removeSnapshot(id: string) {
    const updated = updateDeal(deal, {
      valueTracking: {
        ...deal.valueTracking,
        snapshots: (deal.valueTracking?.snapshots ?? []).filter(s => s.id !== id),
        initiatives: deal.valueTracking?.initiatives ?? [],
      },
    });
    onUpdate(updated);
  }

  const baseline = deal.valueTracking;

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/40 flex items-center justify-between">
        <div className="text-[12px] font-semibold text-slate-200">Performance Snapshots</div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 rounded-lg transition-all"
        >
          + Add Snapshot
        </button>
      </div>

      {adding && (
        <div className="px-4 py-3 border-b border-slate-800/40 space-y-2.5 bg-indigo-500/[0.03]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] block mb-1">Label</label>
              <input autoFocus value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Month 6" className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] block mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] block mb-1">Revenue ($k)</label>
              <input type="number" value={form.revenue} onChange={e => setForm(f => ({ ...f, revenue: e.target.value }))}
                placeholder="e.g. 3200" className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] block mb-1">EBITDA ($k)</label>
              <input type="number" value={form.ebitda} onChange={e => setForm(f => ({ ...f, ebitda: e.target.value }))}
                placeholder="e.g. 510" className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
            </div>
          </div>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)" className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
          <div className="flex gap-2">
            <button onClick={addSnapshot} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition-colors">Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-slate-500 hover:text-slate-300 text-[11px] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {snapshots.length === 0 && !adding && (
        <div className="px-4 py-5 text-center text-[11px] text-slate-600">
          No snapshots yet. Add periodic snapshots to track value creation over time.
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800/40">
                {['Period', 'Revenue', 'EBITDA', 'Rev Δ', 'EBITDA Δ'].map(h => (
                  <th key={h} className="px-4 py-2 text-[9px] font-semibold text-slate-600 uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-2 w-8"/>
              </tr>
            </thead>
            <tbody>
              {/* Baseline row */}
              {baseline?.baselineRevenue != null && (
                <tr className="border-b border-slate-800/30 bg-slate-800/20">
                  <td className="px-4 py-2.5">
                    <div className="text-[11px] font-semibold text-slate-300">Baseline</div>
                    {baseline.acquisitionDate && <div className="text-[10px] text-slate-600">{new Date(baseline.acquisitionDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-slate-300 tabular-nums">{fmtN(baseline.baselineRevenue)}</td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-slate-300 tabular-nums">{fmtN(baseline.baselineEbitda)}</td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-600">—</td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-600">—</td>
                  <td className="px-4 py-2.5"/>
                </tr>
              )}
              {snapshots.map(s => {
                const revDelta = baseline?.baselineRevenue && s.revenue != null ? s.revenue - baseline.baselineRevenue : null;
                const ebDelta  = baseline?.baselineEbitda && s.ebitda != null  ? s.ebitda  - baseline.baselineEbitda  : null;
                return (
                  <tr key={s.id} className="border-b border-slate-800/30 last:border-0 group hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="text-[11px] font-semibold text-slate-200">{s.label}</div>
                      <div className="text-[10px] text-slate-600">{new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      {s.notes && <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">{s.notes}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-medium text-slate-200 tabular-nums">{fmtN(s.revenue)}</td>
                    <td className="px-4 py-2.5 text-[12px] font-medium text-slate-200 tabular-nums">{fmtN(s.ebitda)}</td>
                    <td className="px-4 py-2.5">
                      {revDelta != null && (
                        <span className={`text-[11px] font-semibold tabular-nums ${revDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {revDelta >= 0 ? '+' : ''}{fmtN(revDelta)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {ebDelta != null && (
                        <span className={`text-[11px] font-semibold tabular-nums ${ebDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {ebDelta >= 0 ? '+' : ''}{fmtN(ebDelta)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 w-8">
                      <button onClick={() => removeSnapshot(s.id)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-slate-600 hover:text-red-400 text-lg leading-none transition-all">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DealValueTracker({ deal, onUpdate, onToast }: Props) {
  const vt = deal.valueTracking;
  const initiatives = vt?.initiatives ?? [];
  const completedCount = initiatives.filter(i => i.status === 'completed').length;
  const totalEstimatedImpact = initiatives
    .filter(i => i.estimatedImpact)
    .map(i => {
      const m = i.estimatedImpact!.match(/[+-]?\$?([\d,]+)k?/i);
      if (!m) return 0;
      const n = parseFloat(m[1].replace(/,/g, ''));
      return i.estimatedImpact!.includes('k') ? n * 1000 : n;
    })
    .reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] mb-1">Initiatives</div>
          <div className="text-[18px] font-bold text-slate-100">{initiatives.length}</div>
          <div className="text-[10px] text-slate-600">{completedCount} completed</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] mb-1">Est. Impact</div>
          <div className="text-[18px] font-bold text-emerald-400 tabular-nums">
            {totalEstimatedImpact > 0 ? `+${fmtN(totalEstimatedImpact)}` : '—'}
          </div>
          <div className="text-[10px] text-slate-600">from initiatives</div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] mb-1">Snapshots</div>
          <div className="text-[18px] font-bold text-slate-100">{vt?.snapshots?.length ?? 0}</div>
          <div className="text-[10px] text-slate-600">periods tracked</div>
        </div>
      </div>

      {/* Value delta summary */}
      <ValueDeltaCard deal={deal} />

      {/* Baseline setup */}
      <BaselineSetup deal={deal} onUpdate={onUpdate} onToast={onToast} />

      {/* Initiatives */}
      <InitiativesList deal={deal} onUpdate={onUpdate} onToast={onToast} />

      {/* Periodic snapshots */}
      <SnapshotsList deal={deal} onUpdate={onUpdate} onToast={onToast} />
    </div>
  );
}
