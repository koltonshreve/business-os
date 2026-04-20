// ─── DealList ─────────────────────────────────────────────────────────────────
// Primary CRM view. All deal management happens here.

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Deal, DealStage, STAGE_LABEL, STAGE_COLOR, STAGE_ORDER,
  loadDeals, saveDeals, createDeal, sortDealsByUrgency,
  isActiveDeal, actionStatus, daysUntilAction, fmtMoney, fmtActionDate,
} from '../../lib/deals';
import DealDetail from './DealDetail';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  onAskAI?: (prompt: string) => void;
  initialDealId?: string | null;      // Jump directly to a deal (from Today view)
}

interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' }

// ── Stage badge ───────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: DealStage }) {
  const c = STAGE_COLOR[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {STAGE_LABEL[stage]}
    </span>
  );
}

// ── Action date chip ──────────────────────────────────────────────────────────

function ActionChip({ deal }: { deal: Deal }) {
  const status = actionStatus(deal);
  const label = fmtActionDate(deal.nextActionDate);

  if (status === 'none') return <span className="text-slate-600 text-xs">No action set</span>;

  const cls =
    status === 'overdue' ? 'text-red-400 font-semibold' :
    status === 'today'   ? 'text-amber-400 font-semibold' :
                           'text-slate-400';
  return <span className={`text-xs ${cls}`}>{label}</span>;
}

// ── Add Deal Modal ────────────────────────────────────────────────────────────

const STAGE_OPTIONS = STAGE_ORDER.filter(s => !['closed-won','closed-lost','passed'].includes(s));

interface AddDealModalProps {
  onSave: (deal: Deal) => void;
  onClose: () => void;
}

function AddDealModal({ onSave, onClose }: AddDealModalProps) {
  const [form, setForm] = useState({
    name: '', stage: 'sourcing' as DealStage,
    industry: '', location: '',
    revenue: '', ebitda: '', sde: '', askingPrice: '',
    contactName: '', brokerName: '', brokerFirm: '',
    source: '', nextAction: '', nextActionDate: '',
    description: '',
  });
  const [error, setError] = useState('');

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setError('');
  }

  function handleSave() {
    if (!form.name.trim()) { setError('Deal name is required.'); return; }
    const deal = createDeal({
      name: form.name.trim(),
      stage: form.stage,
      industry: form.industry || undefined,
      location: form.location || undefined,
      revenue: form.revenue ? parseFloat(form.revenue) * 1000 : undefined,
      ebitda: form.ebitda ? parseFloat(form.ebitda) * 1000 : undefined,
      sde: form.sde ? parseFloat(form.sde) * 1000 : undefined,
      askingPrice: form.askingPrice ? parseFloat(form.askingPrice) * 1000 : undefined,
      contactName: form.contactName || undefined,
      brokerName: form.brokerName || undefined,
      brokerFirm: form.brokerFirm || undefined,
      source: form.source || undefined,
      nextAction: form.nextAction || undefined,
      nextActionDate: form.nextActionDate || undefined,
      description: form.description || undefined,
    });
    onSave(deal);
  }

  function Field({ label, k, type = 'text', placeholder = '' }: { label: string; k: keyof typeof form; type?: string; placeholder?: string }) {
    return (
      <div>
        <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">{label}</label>
        <input
          type={type}
          value={form[k] as string}
          onChange={e => set(k, e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#0d1117] border border-slate-700/60 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0d1117] border border-slate-700/60 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 sticky top-0 bg-[#0d1117] z-10">
          <h2 className="text-base font-semibold text-slate-100">Add Deal to Pipeline</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name + Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Business Name *</label>
              <input
                autoFocus
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Midwest HVAC Services"
                className="w-full bg-[#0d1117] border border-slate-700/60 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Stage</label>
              <select
                value={form.stage}
                onChange={e => set('stage', e.target.value)}
                className="w-full bg-[#0d1117] border border-slate-700/60 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              >
                {STAGE_OPTIONS.map(s => (
                  <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <Field label="Industry" k="industry" placeholder="HVAC, Landscaping…" />
          </div>

          {/* Location + Source */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Location" k="location" placeholder="Columbus, OH" />
            <Field label="Source" k="source" placeholder="BizBuySell, broker, direct…" />
          </div>

          {/* Financials */}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Financials (enter in thousands, e.g. 2500 = $2.5M)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Annual Revenue ($k)" k="revenue" type="number" placeholder="2500" />
              <Field label="EBITDA ($k)" k="ebitda" type="number" placeholder="420" />
              <Field label="SDE ($k)" k="sde" type="number" placeholder="510" />
              <Field label="Asking Price ($k)" k="askingPrice" type="number" placeholder="2100" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Owner / Contact Name" k="contactName" placeholder="Ron Kowalski" />
            <Field label="Broker Name" k="brokerName" placeholder="Dave Hoffman" />
            <Field label="Broker Firm" k="brokerFirm" placeholder="LINK Business Brokers" />
          </div>

          {/* Next action */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Next Action" k="nextAction" placeholder="Request CIM package…" />
            </div>
            <Field label="Due Date" k="nextActionDate" type="date" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Brief summary of the business…"
              className="w-full bg-[#0d1117] border border-slate-700/60 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800/60 bg-[#0d1117] sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            Add Deal
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ deals }: { deals: Deal[] }) {
  const active = deals.filter(d => isActiveDeal(d.stage));
  const advanced = deals.filter(d => ['loi','due-diligence','closing'].includes(d.stage));
  const overdue = deals.filter(d => actionStatus(d) === 'overdue' && isActiveDeal(d.stage));
  const pipelineValue = advanced.reduce((sum, d) => sum + (d.askingPrice ?? 0), 0);

  const stats = [
    { label: 'Total Deals', value: deals.length, sub: `${active.length} active` },
    { label: 'LOI / DD / Closing', value: advanced.length, sub: 'advanced stage', accent: advanced.length > 0 ? 'text-emerald-400' : undefined },
    { label: 'Pipeline Value', value: fmtMoney(pipelineValue), sub: 'advanced stage', accent: 'text-blue-400' },
    { label: 'Overdue Actions', value: overdue.length, sub: 'need attention', accent: overdue.length > 0 ? 'text-red-400' : undefined },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="bg-[#0d1117] border border-slate-800/60 rounded-xl p-4">
          <div className={`text-xl font-bold ${s.accent ?? 'text-slate-100'}`}>{s.value}</div>
          <div className="text-[11px] font-medium text-slate-400 mt-0.5">{s.label}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Deal row ──────────────────────────────────────────────────────────────────

function DealRow({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const status = actionStatus(deal);
  const openTasks = deal.tasks.filter(t => !t.done).length;

  return (
    <tr
      onClick={onClick}
      className="group border-b border-slate-800/40 hover:bg-slate-800/20 cursor-pointer transition-colors"
    >
      {/* Name + star */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          {deal.starred && (
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-amber-400 shrink-0">
              <path d="M8 1l1.9 3.8 4.1.6-3 2.9.7 4.2L8 10.4l-3.7 2.1.7-4.2L2 5.4l4.1-.6L8 1z"/>
            </svg>
          )}
          <div>
            <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{deal.name}</div>
            {deal.industry && <div className="text-[11px] text-slate-500 mt-0.5">{deal.industry}{deal.location ? ` · ${deal.location}` : ''}</div>}
          </div>
        </div>
      </td>

      {/* Stage */}
      <td className="px-4 py-3.5">
        <StageBadge stage={deal.stage} />
      </td>

      {/* Financials */}
      <td className="px-4 py-3.5 tabular-nums">
        <div className="text-sm text-slate-300">{fmtMoney(deal.revenue)}</div>
        <div className="text-[11px] text-slate-500">{deal.ebitda ? `${fmtMoney(deal.ebitda)} EBITDA` : '—'}</div>
      </td>

      {/* Asking price */}
      <td className="px-4 py-3.5 tabular-nums">
        <div className="text-sm text-slate-300">{fmtMoney(deal.askingPrice)}</div>
        {deal.askingPrice && (deal.ebitda || deal.sde) && (
          <div className="text-[11px] text-slate-500">
            {((deal.askingPrice / (deal.ebitda ?? deal.sde!)) ).toFixed(1)}× {deal.ebitda ? 'EBITDA' : 'SDE'}
          </div>
        )}
      </td>

      {/* Next action */}
      <td className="px-4 py-3.5 max-w-[200px]">
        <div className="text-xs text-slate-300 truncate">{deal.nextAction ?? <span className="text-slate-600">—</span>}</div>
        <ActionChip deal={deal} />
      </td>

      {/* Open tasks + chevron */}
      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-3">
          {openTasks > 0 && (
            <span className="text-[11px] text-slate-500">{openTasks} task{openTasks !== 1 ? 's' : ''}</span>
          )}
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors">
            <path d="M6 4l4 4-4 4"/>
          </svg>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DealList({ onAskAI, initialDealId }: Props) {
  const [deals, setDeals] = useState<Deal[]>(() => loadDeals());
  const [selectedId, setSelectedId] = useState<string | null>(initialDealId ?? null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<DealStage | 'all' | 'active'>('active');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  // ── Persistence ──────────────────────────────────────────────────────────────

  function persist(next: Deal[]) {
    setDeals(next);
    saveDeals(next);
  }

  // ── Toast ────────────────────────────────────────────────────────────────────

  const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastCounter.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  // ── Deal mutations ────────────────────────────────────────────────────────────

  function handleAddDeal(deal: Deal) {
    persist([deal, ...deals]);
    setShowAddModal(false);
    setSelectedId(deal.id);
    toast(`${deal.name} added to pipeline`);
  }

  function handleUpdateDeal(updated: Deal) {
    persist(deals.map(d => d.id === updated.id ? updated : d));
  }

  function handleDeleteDeal(id: string) {
    const deal = deals.find(d => d.id === id);
    persist(deals.filter(d => d.id !== id));
    setSelectedId(null);
    if (deal) toast(`${deal.name} removed`, 'info');
  }

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = sortDealsByUrgency(deals);

    if (stageFilter === 'active') {
      list = list.filter(d => isActiveDeal(d.stage));
    } else if (stageFilter !== 'all') {
      list = list.filter(d => d.stage === stageFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.industry?.toLowerCase().includes(q) ||
        d.location?.toLowerCase().includes(q) ||
        d.brokerName?.toLowerCase().includes(q) ||
        d.contactName?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [deals, search, stageFilter]);

  // ── Detail view ───────────────────────────────────────────────────────────────

  const selectedDeal = deals.find(d => d.id === selectedId);

  if (selectedDeal) {
    return (
      <DealDetail
        deal={selectedDeal}
        onUpdate={handleUpdateDeal}
        onDelete={() => handleDeleteDeal(selectedDeal.id)}
        onBack={() => setSelectedId(null)}
        onAskAI={onAskAI}
        onToast={toast}
      />
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  const overdueCt = deals.filter(d => actionStatus(d) === 'overdue' && isActiveDeal(d.stage)).length;

  return (
    <div className="space-y-5 relative">
      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl border transition-all
              ${t.type === 'success' ? 'bg-emerald-900/90 text-emerald-200 border-emerald-700/50' :
                t.type === 'error'   ? 'bg-red-900/90 text-red-200 border-red-700/50' :
                                       'bg-slate-800/90 text-slate-200 border-slate-700/50'}`}
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Stats */}
      <StatsBar deals={deals} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l3 3"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search deals…"
              className="w-full bg-[#0d1117] border border-slate-700/60 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>

          {/* Stage filter */}
          <select
            value={stageFilter}
            onChange={e => setStageFilter(e.target.value as typeof stageFilter)}
            className="bg-[#0d1117] border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
          >
            <option value="active">Active Deals</option>
            <option value="all">All Deals</option>
            {STAGE_ORDER.map(s => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </select>

          {/* Overdue alert */}
          {overdueCt > 0 && (
            <button
              onClick={() => setStageFilter('active')}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-400 font-medium hover:bg-red-500/15 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {overdueCt} overdue
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          Add Deal
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#0d1117] border border-slate-800/60 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-slate-600 text-sm">
              {search ? `No deals match "${search}"` : 'No deals in this view'}
            </div>
            {!search && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Add your first deal →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/60">
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-500 font-medium">Deal</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-500 font-medium">Stage</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-500 font-medium">Revenue</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-500 font-medium">Asking</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-500 font-medium">Next Action</th>
                <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide text-slate-500 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(deal => (
                <DealRow
                  key={deal.id}
                  deal={deal}
                  onClick={() => setSelectedId(deal.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Row count */}
      {filtered.length > 0 && (
        <div className="text-[11px] text-slate-600 px-1">
          {filtered.length} deal{filtered.length !== 1 ? 's' : ''}
          {stageFilter === 'active' ? ' · active only' : stageFilter !== 'all' ? ` · ${STAGE_LABEL[stageFilter as DealStage]}` : ''}
          {search ? ` · matching "${search}"` : ''}
        </div>
      )}

      {/* Add deal modal */}
      {showAddModal && (
        <AddDealModal
          onSave={handleAddDeal}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
