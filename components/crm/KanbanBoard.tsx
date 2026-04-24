import { useState, useRef, useCallback, useEffect } from 'react';
import type { Deal, DealStage } from '../../types';
import { authHeaders, loadAuthSession } from '../../lib/auth';

// ─── Constants ────────────────────────────────────────────────────────────────
// ⚠  localStorage key is 'bos_deals' — this is the CRM sales pipeline.
//    DO NOT confuse with:
//      'bos_deals_v2'    → M&A deal flow (lib/deals.ts, DealList.tsx)
//      'bos_acq_targets' → Acquisition targets (AcquisitionPipeline.tsx)

const STORAGE_KEY = 'bos_deals';

const STAGES: { id: DealStage; label: string; color: string; border: string; header: string; dot: string }[] = [
  { id: 'lead',        label: 'Lead',        color: 'text-slate-400',  border: 'border-slate-700/50',   header: 'bg-slate-800/40',  dot: 'bg-slate-500'   },
  { id: 'qualified',   label: 'Qualified',   color: 'text-sky-400',    border: 'border-sky-500/25',     header: 'bg-sky-500/8',     dot: 'bg-sky-500'     },
  { id: 'proposal',    label: 'Proposal',    color: 'text-indigo-400', border: 'border-indigo-500/25',  header: 'bg-indigo-500/8',  dot: 'bg-indigo-500'  },
  { id: 'negotiation', label: 'Negotiation', color: 'text-violet-400', border: 'border-violet-500/25', header: 'bg-violet-500/8',  dot: 'bg-violet-500'  },
  { id: 'closed-won',  label: 'Closed Won',  color: 'text-emerald-400',border: 'border-emerald-500/25',header: 'bg-emerald-500/8', dot: 'bg-emerald-500' },
  { id: 'closed-lost', label: 'Closed Lost', color: 'text-red-400',   border: 'border-red-500/25',     header: 'bg-red-500/8',     dot: 'bg-red-500'     },
];

const OWNERS = ['Sarah K.', 'Mark D.', 'Alex R.', 'Jordan L.', 'You'];

const SEED_DEALS: Deal[] = [
  { id: 'd1', name: 'Annual MSA Renewal', company: 'Acme Corp', value: 148000, stage: 'negotiation', probability: 80, closeDate: '2025-04-30', owner: 'Sarah K.', createdAt: '2025-02-15', updatedAt: '2025-04-01', contactName: 'Jim Halpert', contactEmail: 'jh@acme.com', source: 'renewal' },
  { id: 'd2', name: 'IT Infrastructure Audit', company: 'Blue Ridge Industries', value: 52000, stage: 'proposal', probability: 55, closeDate: '2025-05-15', owner: 'Mark D.', createdAt: '2025-03-01', updatedAt: '2025-04-05', contactName: 'Dana Mills', contactEmail: 'dana@bluridge.com', source: 'outbound' },
  { id: 'd3', name: 'Fractional CFO Services', company: 'Pinnacle Builders', value: 84000, stage: 'qualified', probability: 40, closeDate: '2025-06-01', owner: 'Alex R.', createdAt: '2025-03-20', updatedAt: '2025-04-08', contactName: 'Robert Chen', contactEmail: 'r.chen@pinnacle.com', source: 'referral' },
  { id: 'd4', name: 'Compliance Framework', company: 'Harbor Health', value: 235000, stage: 'proposal', probability: 60, closeDate: '2025-05-30', owner: 'Sarah K.', createdAt: '2025-02-28', updatedAt: '2025-04-10', contactName: 'Lisa Park', contactEmail: 'lpark@harborhealth.com', source: 'inbound' },
  { id: 'd5', name: 'ERP Implementation Advisory', company: 'Cascade Manufacturing', value: 310000, stage: 'negotiation', probability: 85, closeDate: '2025-04-25', owner: 'Mark D.', createdAt: '2025-01-10', updatedAt: '2025-04-12', contactName: 'Tom Bradley', contactEmail: 'tbradley@cascade.com', source: 'referral' },
  { id: 'd6', name: 'Interim Controller', company: 'Sterling Logistics', value: 72000, stage: 'closed-won', probability: 100, closeDate: '2025-03-31', owner: 'Alex R.', createdAt: '2025-02-01', updatedAt: '2025-04-01', contactName: 'Amy Torres', contactEmail: 'atorres@sterling.com', source: 'inbound' },
  { id: 'd7', name: 'Strategic Planning Retainer', company: 'Apex Tech Solutions', value: 96000, stage: 'lead', probability: 20, closeDate: '2025-07-15', owner: 'Jordan L.', createdAt: '2025-04-01', updatedAt: '2025-04-14', contactName: 'Ben Walsh', contactEmail: 'bwalsh@apex.com', source: 'outbound' },
  { id: 'd8', name: 'M&A Due Diligence', company: 'Riverstone Capital', value: 175000, stage: 'qualified', probability: 35, closeDate: '2025-06-30', owner: 'Sarah K.', createdAt: '2025-03-15', updatedAt: '2025-04-09', contactName: 'Claire Zhang', contactEmail: 'czhang@riverstone.com', source: 'referral' },
  { id: 'd9', name: 'Audit Prep Support', company: 'NorthStar Retail', value: 38000, stage: 'closed-lost', probability: 0, closeDate: '2025-03-15', owner: 'Mark D.', createdAt: '2025-02-10', updatedAt: '2025-03-20', contactName: 'Phil Mercer', contactEmail: 'pmercer@northstar.com', source: 'inbound', lostReason: 'Budget constraints — deferred to Q4' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const OWNER_COLORS: Record<string, string> = {
  'Sarah K.': 'bg-violet-500/20 text-violet-300',
  'Mark D.':  'bg-sky-500/20 text-sky-300',
  'Alex R.':  'bg-amber-500/20 text-amber-300',
  'Jordan L.':'bg-emerald-500/20 text-emerald-300',
  'You':      'bg-indigo-500/20 text-indigo-300',
};

function loadDeals(): Deal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Deal[];
  } catch { /* ignore */ }
  return SEED_DEALS;
}

function saveDeals(deals: Deal[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(deals)); } catch { /* ignore */ }
}

function newId() { return `d${Date.now()}`; }

// ─── DealCard ─────────────────────────────────────────────────────────────────

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function DealCard({ deal, onDragStart, onClick }: {
  deal: Deal;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: (deal: Deal) => void;
}) {
  const due = daysUntil(deal.closeDate);
  const dueColor = due < 0 ? 'text-red-400' : due <= 7 ? 'text-amber-400' : 'text-slate-500';
  const dueLabel = due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? 'Due today' : `${due}d`;
  const idleDays = daysSince(deal.updatedAt);
  const isTerminal = deal.stage === 'closed-won' || deal.stage === 'closed-lost';
  const isIdle = !isTerminal && idleDays >= 7;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.id)}
      onClick={() => onClick(deal)}
      className="bg-[#0d1117] border border-slate-800/80 rounded-xl p-3.5 cursor-grab active:cursor-grabbing hover:border-slate-700 hover:bg-slate-900/70 transition-all select-none group"
    >
      {/* Idle warning */}
      {isIdle && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-amber-500/8 border border-amber-500/20">
          <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5 text-amber-500 flex-shrink-0"><path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 2.5a.5.5 0 01.5.5v2.25l1.25.72a.5.5 0 01-.5.87l-1.5-.87A.5.5 0 015.5 6.5V4a.5.5 0 01.5-.5z"/></svg>
          <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-wide">{idleDays}d idle — needs attention</span>
        </div>
      )}

      {/* Deal name + company */}
      <div className="mb-2.5">
        <div className="text-[13px] font-semibold text-slate-100 leading-snug mb-0.5">{deal.name}</div>
        <div className="text-[11px] text-slate-500">{deal.company}</div>
      </div>

      {/* Value + probability */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[15px] font-bold text-slate-200 tabular-nums">{fmt(deal.value)}</span>
        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md border tabular-nums ${
          deal.probability >= 70 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          : deal.probability >= 40 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          : 'text-slate-400 bg-slate-800/60 border-slate-700/40'
        }`}>{deal.probability}%</span>
      </div>

      {/* Footer: due date + owner */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium ${dueColor}`}>{dueLabel}</span>
        <div className="flex items-center gap-1.5">
          {deal.source && (
            <span className="text-[9px] font-medium text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded">{deal.source}</span>
          )}
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${OWNER_COLORS[deal.owner] ?? 'bg-slate-800 text-slate-400'}`}>
            {initials(deal.owner)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DealDrawer ───────────────────────────────────────────────────────────────

function DealDrawer({ deal, onClose, onSave, onDelete }: {
  deal: Deal | null;
  onClose: () => void;
  onSave: (d: Deal) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Deal | null>(deal);

  if (!deal) return null;
  if (draft?.id !== deal.id) setDraft(deal);

  const d = editing ? draft! : deal;

  const handleSave = () => {
    if (draft) { onSave(draft); setEditing(false); }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{label}</div>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40 backdrop-blur-sm" />
      <div className="w-[420px] bg-[#0a0e17] border-l border-slate-800/80 flex flex-col h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-800/60 sticky top-0 bg-[#0a0e17] z-10">
          <div className="flex-1 min-w-0 pr-4">
            {editing ? (
              <input value={draft!.name} onChange={e => setDraft(p => p ? { ...p, name: e.target.value } : p)}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[15px] font-semibold text-slate-100 focus:outline-none focus:border-indigo-500/60"/>
            ) : (
              <div className="text-[15px] font-semibold text-slate-100 leading-snug">{deal.name}</div>
            )}
            <div className="text-[12px] text-slate-500 mt-0.5">{deal.company}</div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={handleSave} className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-lg hover:bg-emerald-500/15 transition-colors">Save</button>
                <button onClick={() => { setDraft(deal); setEditing(false); }} className="text-[11px] text-slate-500 hover:text-slate-300 px-2 py-1.5 rounded-lg transition-colors">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="text-[11px] font-medium text-slate-400 hover:text-slate-200 border border-slate-800/60 hover:border-slate-700 px-3 py-1.5 rounded-lg transition-all">Edit</button>
            )}
            <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors p-1">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
                <path d="M2 2l10 10M12 2L2 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-5 py-4 space-y-4">
          {/* Idle warning banner */}
          {(() => {
            const idle = daysSince(deal.updatedAt);
            const terminal = deal.stage === 'closed-won' || deal.stage === 'closed-lost';
            if (!terminal && idle >= 7) return (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 text-amber-400 flex-shrink-0"><path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 2.5a.5.5 0 01.5.5v3l1.5.87a.5.5 0 01-.5.87l-2-1.16A.5.5 0 016.5 7V4a.5.5 0 01.5-.5z"/></svg>
                <span className="text-[11px] text-amber-400 font-medium">No activity in {idle} days — update notes or stage to keep pipeline current</span>
              </div>
            );
            return null;
          })()}

          {/* Value + probability */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Value</div>
              {editing ? (
                <input type="number" value={draft!.value}
                  onChange={e => setDraft(p => p ? { ...p, value: parseFloat(e.target.value) || 0 } : p)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded px-2 py-1 text-[16px] font-bold text-slate-100 focus:outline-none"/>
              ) : (
                <div className="text-[20px] font-bold text-slate-100">{fmt(deal.value)}</div>
              )}
            </div>
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">Probability</div>
              {editing ? (
                <input type="number" min="0" max="100" value={draft!.probability}
                  onChange={e => setDraft(p => p ? { ...p, probability: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) } : p)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded px-2 py-1 text-[16px] font-bold text-slate-100 focus:outline-none"/>
              ) : (
                <div className={`text-[20px] font-bold ${deal.probability >= 70 ? 'text-emerald-400' : deal.probability >= 40 ? 'text-amber-400' : 'text-slate-400'}`}>{deal.probability}%</div>
              )}
            </div>
          </div>

          {/* Stage */}
          <Field label="Stage">
            {editing ? (
              <select value={draft!.stage}
                onChange={e => setDraft(p => p ? { ...p, stage: e.target.value as DealStage } : p)}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none">
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            ) : (
              <span className={`text-[13px] font-semibold capitalize ${STAGES.find(s => s.id === deal.stage)?.color}`}>
                {STAGES.find(s => s.id === deal.stage)?.label}
              </span>
            )}
          </Field>

          {/* Owner + Close Date */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              {editing ? (
                <select value={draft!.owner}
                  onChange={e => setDraft(p => p ? { ...p, owner: e.target.value } : p)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 focus:outline-none">
                  {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${OWNER_COLORS[deal.owner] ?? 'bg-slate-800 text-slate-400'}`}>{initials(deal.owner)}</div>
                  <span className="text-[13px] text-slate-300">{deal.owner}</span>
                </div>
              )}
            </Field>
            <Field label="Close Date">
              {editing ? (
                <input type="date" value={draft!.closeDate}
                  onChange={e => setDraft(p => p ? { ...p, closeDate: e.target.value } : p)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 focus:outline-none"/>
              ) : (
                <span className="text-[13px] text-slate-300">{new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
            </Field>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Name">
              {editing ? (
                <input value={draft!.contactName ?? ''} onChange={e => setDraft(p => p ? { ...p, contactName: e.target.value } : p)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 focus:outline-none placeholder:text-slate-600" placeholder="Full name"/>
              ) : (
                <span className="text-[13px] text-slate-300">{deal.contactName ?? '—'}</span>
              )}
            </Field>
            <Field label="Contact Email">
              {editing ? (
                <input value={draft!.contactEmail ?? ''} onChange={e => setDraft(p => p ? { ...p, contactEmail: e.target.value } : p)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 focus:outline-none placeholder:text-slate-600" placeholder="email@company.com"/>
              ) : (
                <span className="text-[13px] text-slate-300 truncate">{deal.contactEmail ?? '—'}</span>
              )}
            </Field>
          </div>

          {/* Notes */}
          <Field label="Notes">
            {editing ? (
              <textarea value={draft!.notes ?? ''} onChange={e => setDraft(p => p ? { ...p, notes: e.target.value } : p)}
                rows={3}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none placeholder:text-slate-600 resize-none" placeholder="Add context, next steps, or blockers…"/>
            ) : (
              <p className="text-[12px] text-slate-400 leading-relaxed">{deal.notes || <span className="text-slate-700 italic">No notes</span>}</p>
            )}
          </Field>

          {/* Lost reason (if closed-lost) */}
          {deal.stage === 'closed-lost' && (
            <Field label="Lost Reason">
              {editing ? (
                <input value={draft!.lostReason ?? ''} onChange={e => setDraft(p => p ? { ...p, lostReason: e.target.value } : p)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 focus:outline-none placeholder:text-slate-600" placeholder="Why did we lose this deal?"/>
              ) : (
                <span className="text-[12px] text-red-400/80">{deal.lostReason ?? '—'}</span>
              )}
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800/60 flex items-center justify-between">
          <div className="text-[10px] text-slate-700">
            Updated {new Date(deal.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <button
            onClick={() => { if (confirm('Delete this deal?')) { onDelete(deal.id); onClose(); } }}
            className="text-[11px] text-red-400/70 hover:text-red-400 font-medium transition-colors">
            Delete deal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AddDealModal ─────────────────────────────────────────────────────────────

function AddDealModal({ defaultStage, onClose, onAdd }: {
  defaultStage: DealStage;
  onClose: () => void;
  onAdd: (deal: Deal) => void;
}) {
  const [form, setForm] = useState({
    name: '', company: '', value: '', probability: '50',
    stage: defaultStage, closeDate: '', owner: 'You',
    contactName: '', contactEmail: '', source: 'inbound', notes: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.company.trim() || !form.value) return;
    onAdd({
      id: newId(),
      name: form.name.trim(),
      company: form.company.trim(),
      value: parseFloat(form.value),
      stage: form.stage,
      probability: parseInt(form.probability),
      closeDate: form.closeDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      owner: form.owner,
      contactName: form.contactName || undefined,
      contactEmail: form.contactEmail || undefined,
      source: form.source || undefined,
      notes: form.notes || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0d1117] border border-slate-800/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-slate-100">New Deal</div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4"><path d="M2 2l10 10M12 2L2 12"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Deal Name *</label>
              <input autoFocus value={form.name} onChange={set('name')} required
                placeholder="e.g. Annual Retainer" className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Company *</label>
              <input value={form.company} onChange={set('company')} required
                placeholder="Acme Corp" className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Value ($) *</label>
              <input type="number" value={form.value} onChange={set('value')} required min="0"
                placeholder="50000" className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Probability (%)</label>
              <input type="number" value={form.probability} onChange={set('probability')} min="0" max="100"
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Close Date</label>
              <input type="date" value={form.closeDate} onChange={set('closeDate')}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none focus:border-indigo-500/60"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Stage</label>
              <select value={form.stage} onChange={set('stage')}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none">
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Owner</label>
              <select value={form.owner} onChange={set('owner')}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none">
                {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Contact Name</label>
              <input value={form.contactName} onChange={set('contactName')}
                placeholder="Jane Smith" className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Source</label>
              <select value={form.source} onChange={set('source')}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 focus:outline-none">
                {['inbound', 'outbound', 'referral', 'renewal', 'event', 'other'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              placeholder="Key context, next steps, or blockers…"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none"/>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-[13px] text-slate-500 hover:text-slate-300 px-4 py-2 rounded-lg transition-colors">Cancel</button>
            <button type="submit" className="text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-xl transition-colors shadow-md">Add Deal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

function KanbanColumn({ stage, deals, onDragStart, onDrop, onDragOver, onDealClick, onAddDeal }: {
  stage: typeof STAGES[0];
  deals: Deal[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, stageId: DealStage) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDealClick: (deal: Deal) => void;
  onAddDeal: (stage: DealStage) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const total = deals.reduce((s, d) => s + d.value, 0);
  const weighted = deals.reduce((s, d) => s + d.value * (d.probability / 100), 0);

  return (
    <div className="flex flex-col w-[220px] flex-shrink-0">
      {/* Column header */}
      <div className={`rounded-xl border ${stage.border} ${stage.header} px-3 py-2.5 mb-2`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${stage.dot}`}/>
            <span className={`text-[12px] font-semibold ${stage.color}`}>{stage.label}</span>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800/60 ${stage.color}`}>{deals.length}</span>
        </div>
        {deals.length > 0 && (
          <div className="text-[10px] text-slate-600 tabular-nums">
            {fmt(total)} total · {fmt(weighted)} wtd
          </div>
        )}
      </div>

      {/* Cards */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); onDragOver(e); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { setIsDragOver(false); onDrop(e, stage.id); }}
        className={`flex-1 min-h-[120px] space-y-2 rounded-xl p-1 transition-colors ${isDragOver ? 'bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/20' : ''}`}
      >
        {deals.map(deal => (
          <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} onClick={onDealClick}/>
        ))}

        {/* Add deal button */}
        <button
          onClick={() => onAddDeal(stage.id)}
          className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:text-slate-400 hover:bg-slate-800/30 rounded-xl transition-all text-[11px] font-medium border border-transparent hover:border-slate-800/60"
        >
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3 flex-shrink-0">
            <path d="M6 1v10M1 6h10"/>
          </svg>
          Add deal
        </button>
      </div>
    </div>
  );
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

function CSVImportModal({ onClose, onImport }: { onClose: () => void; onImport: (deals: Deal[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { setError('CSV must have a header row and at least one data row.'); return; }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const col = (name: string) => {
      const idx = headers.findIndex(h => h.includes(name));
      return idx >= 0 ? idx : -1;
    };

    const parsed: Deal[] = [];
    const errs: string[] = [];

    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return;
      // Handle quoted fields
      const cells: string[] = [];
      let cur = '', inQ = false;
      for (const ch of line + ',') {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }

      const get = (name: string) => (col(name) >= 0 ? cells[col(name)]?.trim() ?? '' : '');

      const name = get('name') || get('deal');
      const company = get('company') || get('account');
      if (!name || !company) { errs.push(`Row ${i + 2}: missing name or company`); return; }

      const rawValue = get('value') || get('amount') || get('revenue');
      const value = parseFloat(rawValue.replace(/[$,]/g, '')) || 0;
      const probability = Math.min(100, Math.max(0, parseInt(get('probability') || get('prob') || '50') || 50));

      const rawStage = get('stage').toLowerCase().replace(/\s+/g, '-');
      const stageMatch = STAGES.find(s => s.id === rawStage || s.label.toLowerCase() === rawStage);
      const stage: DealStage = stageMatch?.id ?? 'lead';

      const rawDate = get('closedate') || get('close') || get('date');
      const closeDate = rawDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      const owner = get('owner') || get('rep') || 'You';
      const source = get('source') || 'import';
      const notes = get('notes') || get('note') || get('description') || '';
      const contactName = get('contactname') || get('contact') || '';
      const contactEmail = get('email') || get('contactemail') || '';

      parsed.push({
        id: `csv-${Date.now()}-${i}`,
        name, company, value, probability, stage, closeDate,
        owner: OWNERS.includes(owner) ? owner : 'You',
        source, notes: notes || undefined, contactName: contactName || undefined,
        contactEmail: contactEmail || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    if (parsed.length === 0) {
      setError(errs.length > 0 ? errs.join('; ') : 'No valid rows found. Check the CSV format.');
      return;
    }
    if (errs.length > 0) setError(`Imported ${parsed.length} rows. Skipped: ${errs.join('; ')}`);
    else setError(null);
    setPreview(parsed);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please upload a .csv file.'); return;
    }
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target?.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0d1117] border border-slate-800/80 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <div>
            <div className="text-[14px] font-bold text-slate-100">Import Deals from CSV</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Columns: name, company, value, stage, probability, closeDate, owner, source, contactName, notes</div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 p-1">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4"><path d="M2 2l10 10M12 2L2 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!preview ? (
            <>
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-slate-700/60 hover:border-slate-600'
                }`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileRef.current?.click()}
              >
                <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-slate-600 mx-auto mb-3">
                  <path d="M6 22v4a2 2 0 002 2h16a2 2 0 002-2v-4M16 6v16M10 12l6-6 6 6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-[13px] font-medium text-slate-400">Drop your CSV here or <span className="text-indigo-400">click to browse</span></div>
                <div className="text-[11px] text-slate-600 mt-1">One header row required</div>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}/>
              </div>

              {/* Template hint */}
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Example CSV format</div>
                <code className="text-[10px] text-slate-500 font-mono leading-relaxed block whitespace-pre">
                  {`name,company,value,stage,probability,closeDate,owner
Annual Retainer,Acme Corp,120000,proposal,60,2026-06-30,You
Software Audit,Blue Sky Inc,48000,qualified,40,2026-07-15,Sarah K.`}
                </code>
              </div>
            </>
          ) : (
            <div>
              <div className="text-[12px] text-slate-400 mb-3 font-medium">{preview.length} deal{preview.length !== 1 ? 's' : ''} ready to import</div>
              <div className="border border-slate-800/60 rounded-xl overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800/60 bg-slate-900/50">
                      {['Name', 'Company', 'Value', 'Stage', 'Prob.', 'Owner'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((d, i) => (
                      <tr key={i} className="border-b border-slate-800/30 last:border-0 hover:bg-slate-900/30">
                        <td className="px-3 py-2 text-slate-200 truncate max-w-[120px]">{d.name}</td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-[100px]">{d.company}</td>
                        <td className="px-3 py-2 text-slate-300 tabular-nums">{fmt(d.value)}</td>
                        <td className="px-3 py-2"><span className={`${STAGES.find(s => s.id === d.stage)?.color ?? 'text-slate-400'} capitalize`}>{STAGES.find(s => s.id === d.stage)?.label ?? d.stage}</span></td>
                        <td className="px-3 py-2 text-slate-400">{d.probability}%</td>
                        <td className="px-3 py-2 text-slate-400">{d.owner}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr><td colSpan={6} className="px-3 py-2 text-[10px] text-slate-600">+{preview.length - 10} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <span className="text-amber-400 text-[11px] flex-1">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800/60 flex items-center justify-between">
          <button onClick={() => { setPreview(null); setError(null); }} className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors">
            {preview ? '← Re-upload' : 'Cancel'}
          </button>
          {preview && (
            <button
              onClick={() => { onImport(preview); onClose(); }}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition-colors">
              Import {preview.length} deal{preview.length !== 1 ? 's' : ''} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main KanbanBoard ─────────────────────────────────────────────────────────

export default function KanbanBoard() {
  const [deals, setDeals] = useState<Deal[]>(() => loadDeals());
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [addingToStage, setAddingToStage] = useState<DealStage | null>(null);
  const [filterOwner, setFilterOwner] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<DealStage | 'all'>('all');
  const [showImport, setShowImport] = useState(false);
  const dragId = useRef<string | null>(null);

  // ── DB sync ────────────────────────────────────────────────────────────────
  const syncToDb = useCallback((list: Deal[]) => {
    if (!loadAuthSession()) return;
    fetch('/api/crm-deals', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(list),
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (!loadAuthSession()) return;
    fetch('/api/crm-deals', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((dbDeals: Deal[] | null) => {
        if (dbDeals && dbDeals.length > 0) {
          setDeals(dbDeals);
          saveDeals(dbDeals);
        } else {
          syncToDb(loadDeals());
        }
      })
      .catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistDeals = (updated: Deal[]) => {
    setDeals(updated);
    saveDeals(updated);
    syncToDb(updated);
  };

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, stageId: DealStage) => {
    e.preventDefault();
    const id = dragId.current;
    if (!id) return;
    persistDeals(deals.map(d => d.id === id ? { ...d, stage: stageId, updatedAt: new Date().toISOString() } : d));
    dragId.current = null;
  }, [deals]);

  const handleSave = (updated: Deal) => {
    persistDeals(deals.map(d => d.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : d));
    setSelectedDeal(updated);
  };

  const handleDelete = (id: string) => {
    persistDeals(deals.filter(d => d.id !== id));
    if (loadAuthSession()) {
      fetch('/api/crm-deals', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      }).catch(() => null);
    }
  };

  const handleAdd = (deal: Deal) => persistDeals([...deals, deal]);

  const filteredDeals = deals.filter(d => {
    if (filterOwner !== 'all' && d.owner !== filterOwner) return false;
    if (filterStage !== 'all' && d.stage !== filterStage) return false;
    return true;
  });

  const activeDeals = deals.filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost');
  const wonDeals = deals.filter(d => d.stage === 'closed-won');
  const totalPipeline = activeDeals.reduce((s, d) => s + d.value, 0);
  const weightedPipeline = activeDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);
  const winRate = deals.filter(d => ['closed-won', 'closed-lost'].includes(d.stage)).length > 0
    ? (wonDeals.length / deals.filter(d => ['closed-won', 'closed-lost'].includes(d.stage)).length) * 100
    : null;

  // Pipeline health score (0–100)
  const pipelineHealth = (() => {
    if (activeDeals.length === 0) return 0;
    const sevenDays = 7 * 86400000;
    const now = Date.now();
    const idleCount = activeDeals.filter(d => d.updatedAt && now - new Date(d.updatedAt).getTime() >= sevenDays).length;
    const idlePct = (idleCount / activeDeals.length) * 100;
    const stagesUsed = new Set(activeDeals.map(d => d.stage)).size;
    const activeStages = STAGES.filter(s => !['closed-won','closed-lost'].includes(s.id)).length;

    let score = 0;
    // Deal volume (max 30): 10+ deals = full, scales from 0
    score += Math.min(30, (activeDeals.length / 10) * 30);
    // Win rate (max 25): 50%+ = full
    if (winRate !== null) score += Math.min(25, (winRate / 50) * 25);
    else score += 12; // neutral if no closed deals
    // Idle deals (max 25): 0% idle = full, 50%+ = 0
    score += Math.max(0, 25 - (idlePct / 50) * 25);
    // Stage spread (max 20): all stages used = full
    score += Math.min(20, (stagesUsed / activeStages) * 20);

    return Math.round(Math.min(100, score));
  })();

  const healthColor = pipelineHealth >= 70 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : pipelineHealth >= 40 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20';
  const healthLabel = pipelineHealth >= 70 ? 'Healthy' : pipelineHealth >= 40 ? 'Fair' : 'Weak';

  const uniqueOwners = Array.from(new Set(deals.map(d => d.owner)));

  return (
    <div className="flex flex-col h-full">
      {/* Pipeline header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Open Deals',        value: activeDeals.length.toString(),            color: 'text-slate-100' },
            { label: 'Total Pipeline',    value: fmt(totalPipeline),                       color: 'text-slate-100' },
            { label: 'Weighted Pipeline', value: fmt(weightedPipeline),                   color: 'text-indigo-300' },
            { label: 'Win Rate',          value: winRate ? `${winRate.toFixed(0)}%` : '—', color: winRate && winRate >= 40 ? 'text-emerald-400' : 'text-amber-400' },
          ].map(m => (
            <div key={m.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">{m.label}</div>
              <div className={`text-[18px] font-bold tabular-nums ${m.color}`}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Pipeline health badge */}
        <div className={`hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold ${healthColor} flex-shrink-0`}
          title={`Pipeline health: ${pipelineHealth}/100 — based on deal volume, win rate, idle deals, and stage spread`}>
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
            <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 2a1 1 0 011 1v2.586l1.707 1.707a1 1 0 01-1.414 1.414L5.586 8A1 1 0 015 7V4a1 1 0 011-1z"/>
          </svg>
          {pipelineHealth}/100 · {healthLabel}
        </div>

        {/* Filters + Add */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
            className="bg-slate-900/60 border border-slate-800/60 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 focus:outline-none">
            <option value="all">All owners</option>
            {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 border border-slate-700/60 hover:border-slate-600 hover:text-slate-200 px-3 py-1.5 rounded-xl transition-colors">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3"><path d="M6 1v7M3 5l3 3 3-3M1 9v1a1 1 0 001 1h8a1 1 0 001-1V9"/></svg>
            Import CSV
          </button>
          <button
            onClick={() => setAddingToStage('lead')}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 rounded-xl transition-colors shadow-md">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3"><path d="M6 1v10M1 6h10"/></svg>
            New Deal
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
        {STAGES.map(stage => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={filteredDeals.filter(d => d.stage === stage.id)}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onDealClick={setSelectedDeal}
            onAddDeal={setAddingToStage}
          />
        ))}
      </div>

      {/* Deal drawer */}
      <DealDrawer
        deal={selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* Add deal modal */}
      {addingToStage && (
        <AddDealModal
          defaultStage={addingToStage}
          onClose={() => setAddingToStage(null)}
          onAdd={handleAdd}
        />
      )}

      {/* CSV import modal */}
      {showImport && (
        <CSVImportModal
          onClose={() => setShowImport(false)}
          onImport={imported => {
            const merged = [...deals, ...imported];
            persistDeals(merged);
          }}
        />
      )}
    </div>
  );
}
