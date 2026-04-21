import { useState, useEffect } from 'react';
import type { UnifiedBusinessData } from '../../types';

type AddBackCategory =
  | 'owner_comp' | 'excess_comp' | 'non_recurring'
  | 'non_cash' | 'related_party' | 'pro_forma' | 'other';

interface AddBack {
  id: string;
  category: AddBackCategory;
  description: string;
  amount: number;
  oneTime: boolean;
  notes?: string;
}

const CATS: Record<AddBackCategory, { label: string; hint: string; color: string }> = {
  owner_comp:    { label: "Owner's Comp",    hint: 'Salary above market replacement CEO cost',        color: 'text-indigo-400' },
  excess_comp:   { label: 'Excess Comp',     hint: 'Above-market pay to family / related parties',    color: 'text-violet-400' },
  non_recurring: { label: 'Non-Recurring',   hint: 'One-time costs: legal, restructuring, M&A fees',  color: 'text-amber-400'  },
  non_cash:      { label: 'Non-Cash',        hint: 'D&A, stock-based comp, impairments',              color: 'text-cyan-400'   },
  related_party: { label: 'Related Party',   hint: "Non-arm's-length rents, services, loans",         color: 'text-pink-400'   },
  pro_forma:     { label: 'Pro Forma',       hint: 'Expected post-close savings / synergies',         color: 'text-emerald-400'},
  other:         { label: 'Other',           hint: 'Other normalizing adjustment',                    color: 'text-slate-400'  },
};

const KEY = 'bos_addbacks';
const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1e6 ? `$${(abs/1e6).toFixed(2)}M` : `$${Math.round(abs).toLocaleString()}`;
  return n < 0 ? `(${s})` : s;
};
const pctOf = (n: number, d: number) => d > 0 ? `${((n/d)*100).toFixed(1)}%` : '—';

const BLANK: Omit<AddBack,'id'> = { category: 'owner_comp', description: '', amount: 0, oneTime: true };

export default function AddBackTracker({
  data, onAskAI,
}: { data: UnifiedBusinessData; onAskAI?: (m: string) => void }) {
  const [items,   setItems]   = useState<AddBack[]>([]);
  const [draft,   setDraft]   = useState<Omit<AddBack,'id'>>(BLANK);
  const [adding,  setAdding]  = useState(false);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [multiple,setMultiple]= useState(6.0);

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setItems(JSON.parse(s)); } catch {}
  }, []);

  const persist = (next: AddBack[]) => {
    setItems(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  };

  const addItem = () => {
    if (!draft.description.trim() || draft.amount <= 0) return;
    persist([...items, { ...draft, id: `ab${Date.now()}` }]);
    setDraft(BLANK); setAdding(false);
  };

  const del  = (id: string)  => persist(items.filter(i => i.id !== id));
  const upd  = (id: string, patch: Partial<AddBack>) =>
    persist(items.map(i => i.id === id ? { ...i, ...patch } : i));

  const rev  = data.revenue.total;
  const cogs = data.costs.totalCOGS;
  const opex = data.costs.totalOpEx;
  const reported = rev - cogs - opex;
  const totalAB  = items.reduce((s, i) => s + i.amount, 0);
  const adjusted = reported + totalAB;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/40 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">EBITDA Normalization &amp; Add-back Tracker</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Adjust reported EBITDA for M&A — owner comp, one-time items, non-cash charges
          </div>
        </div>
        {onAskAI && (
          <button
            onClick={() => onAskAI(
              `Reported EBITDA: ${fmt(reported)}. Add-backs totaling ${fmt(totalAB)} give adjusted EBITDA of ${fmt(adjusted)} (${pctOf(adjusted, rev)} margin). ` +
              `Add-backs: ${items.map(i => `${i.description} $${i.amount.toLocaleString()}`).join('; ')}. ` +
              `Are these normalizations defensible to a sophisticated PE buyer? What will they push back on?`
            )}
            className="flex-shrink-0 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-colors font-medium">
            Ask AI
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 divide-x divide-slate-800/50 border-b border-slate-800/40 bg-slate-900/30">
        {[
          { label: 'Reported EBITDA',  val: reported, sub: pctOf(reported, rev) + ' margin', color: reported >= 0 ? 'text-slate-100' : 'text-red-400' },
          { label: 'Total Add-backs',  val: totalAB,  sub: `${items.length} item${items.length !== 1 ? 's' : ''}`,              color: 'text-emerald-400' },
          { label: 'Adjusted EBITDA',  val: adjusted, sub: pctOf(adjusted, rev) + ' margin', color: adjusted >= 0 ? 'text-indigo-300' : 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="px-5 py-4">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{s.label}</div>
            <div className={`text-[22px] font-bold tabular-nums ${s.color}`}>{fmt(s.val)}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* EBITDA bridge bar */}
      {items.length > 0 && rev > 0 && (() => {
        const max = Math.max(Math.abs(reported), Math.abs(adjusted), 1);
        return (
          <div className="px-5 py-3 border-b border-slate-800/40 space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Bridge</div>
            {[
              { label: 'Reported EBITDA', val: reported, color: 'bg-slate-600' },
              ...items.map(i => ({ label: i.description, val: i.amount, color: 'bg-emerald-500/70' })),
              { label: 'Adjusted EBITDA', val: adjusted, color: 'bg-indigo-500' },
            ].map((row, idx, arr) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-32 text-[10px] text-slate-500 text-right truncate flex-shrink-0" title={row.label}>{row.label}</div>
                <div className="flex-1 h-4 bg-slate-800/50 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all ${row.color} ${idx === arr.length - 1 ? 'opacity-100' : 'opacity-80'}`}
                    style={{ width: `${Math.min(Math.abs(row.val) / max * 100, 100)}%` }}
                  />
                </div>
                <div className="w-20 text-[11px] font-semibold tabular-nums text-right flex-shrink-0 text-slate-300">{fmt(row.val)}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Items list */}
      <div className="px-5 py-4 space-y-2">
        {items.length === 0 && !adding && (
          <div className="text-center py-5">
            <div className="text-[11px] text-slate-600">No add-backs recorded yet.</div>
            <div className="text-[10px] text-slate-700 mt-0.5">Common examples: owner salary above market, one-time legal fees, D&amp;A, rent adjustments.</div>
          </div>
        )}

        {items.map(item => {
          const cfg = CATS[item.category];
          const isEd = editId === item.id;
          return (
            <div key={item.id} className="bg-slate-800/30 border border-slate-700/30 rounded-xl px-4 py-3">
              {!isEd ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-900 border border-slate-700/60 ${cfg.color}`}>{cfg.label}</span>
                      {item.oneTime && <span className="text-[9px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-semibold">one-time</span>}
                    </div>
                    <div className="text-[12px] font-medium text-slate-200">{item.description}</div>
                    {item.notes && <div className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{item.notes}</div>}
                  </div>
                  <div className="text-[16px] font-bold text-emerald-400 tabular-nums flex-shrink-0">{fmt(item.amount)}</div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditId(item.id)} className="text-[10px] text-slate-600 hover:text-slate-300 transition-colors px-2 py-1 border border-slate-700/40 rounded-lg">edit</button>
                    <button onClick={() => del(item.id)} className="text-[10px] text-slate-700 hover:text-red-400 transition-colors px-2 py-1 border border-slate-700/40 hover:border-red-500/30 rounded-lg">×</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select value={item.category} onChange={e => upd(item.id, { category: e.target.value as AddBackCategory })}
                      className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50">
                      {Object.entries(CATS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <input type="number" value={item.amount} onChange={e => upd(item.id, { amount: parseFloat(e.target.value)||0 })}
                      className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50"/>
                    <input value={item.description} onChange={e => upd(item.id, { description: e.target.value })}
                      className="col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50"/>
                    <input value={item.notes ?? ''} onChange={e => upd(item.id, { notes: e.target.value })} placeholder="Notes (optional)"
                      className="col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-400 focus:outline-none focus:border-indigo-500/50"/>
                    <label className="flex items-center gap-2 col-span-2 cursor-pointer">
                      <input type="checkbox" checked={item.oneTime} onChange={e => upd(item.id, { oneTime: e.target.checked })} className="rounded accent-indigo-500"/>
                      <span className="text-[11px] text-slate-400">One-time (exclude from run-rate)</span>
                    </label>
                  </div>
                  <button onClick={() => setEditId(null)} className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">Done</button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add form */}
        {adding ? (
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-2.5">
            <div className="text-[12px] font-semibold text-slate-200">New Add-back</div>
            <div className="grid grid-cols-2 gap-2">
              <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value as AddBackCategory }))}
                className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50">
                {Object.entries(CATS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input type="number" placeholder="Amount ($)" value={draft.amount || ''}
                onChange={e => setDraft(d => ({ ...d, amount: parseFloat(e.target.value)||0 }))}
                className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50"/>
              <input placeholder={`Description — e.g. ${CATS[draft.category].hint}`} value={draft.description}
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                className="col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50"/>
              <input placeholder="Notes (optional)" value={draft.notes ?? ''}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                className="col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-400 focus:outline-none focus:border-indigo-500/50"/>
              <label className="flex items-center gap-2 col-span-2 cursor-pointer">
                <input type="checkbox" checked={draft.oneTime} onChange={e => setDraft(d => ({ ...d, oneTime: e.target.checked }))} className="rounded accent-indigo-500"/>
                <span className="text-[11px] text-slate-400">One-time (not in run-rate)</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setDraft(BLANK); }}
                className="text-[11px] text-slate-500 hover:text-slate-300 border border-slate-700/50 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
              <button onClick={addItem} disabled={!draft.description.trim() || draft.amount <= 0}
                className="text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg transition-colors">
                Add Add-back
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full py-2 text-[12px] font-semibold text-slate-500 hover:text-slate-300 border border-dashed border-slate-700/60 hover:border-slate-600 rounded-xl transition-colors">
            + Add Normalization Item
          </button>
        )}
      </div>

      {/* Valuation impact */}
      {items.length > 0 && (
        <div className="px-5 py-4 border-t border-slate-800/40 bg-slate-900/30">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-semibold text-slate-400">Valuation Impact</div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-600">Multiple:</span>
              <input type="number" step="0.5" min="1" max="20" value={multiple}
                onChange={e => setMultiple(parseFloat(e.target.value) || 6)}
                className="w-14 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[12px] text-slate-100 text-center focus:outline-none focus:border-indigo-500/50"/>
              <span className="text-[11px] text-slate-600">× EBITDA</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'On Reported EBITDA',  val: reported * multiple, color: 'text-slate-300', sub: fmt(reported) + ' base' },
              { label: 'On Adjusted EBITDA',  val: adjusted * multiple, color: 'text-indigo-300', sub: fmt(adjusted) + ' base' },
            ].map(v => (
              <div key={v.label} className="bg-slate-800/30 border border-slate-700/30 rounded-xl px-4 py-3">
                <div className="text-[10px] text-slate-500 mb-1">{v.label}</div>
                <div className={`text-[20px] font-bold tabular-nums ${v.color}`}>{fmt(v.val)}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{v.sub}</div>
              </div>
            ))}
          </div>
          {totalAB > 0 && (
            <div className="mt-3 text-[11px] text-slate-500 bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2">
              Add-backs create <span className="text-emerald-400 font-semibold">{fmt(totalAB * multiple)}</span> of additional enterprise value at {multiple}× —
              {' '}{pctOf(totalAB * multiple, reported * multiple)} uplift vs reported basis.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
