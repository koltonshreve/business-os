// ─── DealDetail ───────────────────────────────────────────────────────────────
// Full-screen detail view for a single deal.
// Tabs: Overview | Notes | Tasks | Timeline

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Deal, DealStage } from '../../lib/deals';
import {
  STAGE_LABEL, STAGE_COLOR, STAGE_ORDER,
  addNote, addTask, completeTask, changeDealStage, setNextAction, updateDeal,
  fmtMoney, fmtDate, fmtActionDate, actionStatus, impliedMultiple, isActiveDeal,
} from '../../lib/deals';

const DealValueTracker = dynamic(() => import('./DealValueTracker'), { ssr: false });

type Tab = 'overview' | 'notes' | 'tasks' | 'timeline' | 'value';

interface DealDetailProps {
  deal: Deal;
  onUpdate: (updated: Deal) => void;
  onDelete: () => void;
  onBack: () => void;
  onAskAI?: (msg: string) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StagePicker({ current, onChange }: { current: DealStage; onChange: (s: DealStage) => void }) {
  const [open, setOpen] = useState(false);
  const c = STAGE_COLOR[current];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${c.bg} ${c.border} ${c.text}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`}/>
        {STAGE_LABEL[current]}
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2.5 h-2.5 flex-shrink-0"><path d="M2 3.5L5 6.5 8 3.5"/></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}/>
          <div className="absolute left-0 top-full mt-1.5 z-40 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl w-48 py-1.5">
            {STAGE_ORDER.map(s => {
              const sc = STAGE_COLOR[s];
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors ${
                    s === current ? `${sc.bg} ${sc.text}` : 'text-slate-400 hover:bg-slate-800/60'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`}/>
                  {STAGE_LABEL[s]}
                  {s === current && <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5 ml-auto text-current"><path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FieldRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-800/50 last:border-0">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] flex-shrink-0 mt-px">{label}</span>
      <span className={`text-[13px] text-slate-200 text-right leading-snug ${mono ? 'tabular-nums font-medium' : ''}`}>{value}</span>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ deal, onUpdate, onToast }: { deal: Deal; onUpdate: (d: Deal) => void; onToast: (msg: string) => void }) {
  const [editingAction, setEditingAction] = useState(false);
  const [actionDraft, setActionDraft] = useState(deal.nextAction ?? '');
  const [dateDraft, setDateDraft] = useState(deal.nextActionDate ?? '');

  const saveAction = () => {
    const updated = setNextAction(deal, actionDraft.trim(), dateDraft || undefined);
    onUpdate(updated);
    setEditingAction(false);
    onToast('Next action updated');
  };

  const multiple = impliedMultiple(deal);
  const status = actionStatus(deal);

  return (
    <div className="space-y-5">
      {/* Next action card */}
      <div className={`rounded-xl border p-4 ${
        status === 'overdue' ? 'bg-red-500/5 border-red-500/20' :
        status === 'today' ? 'bg-amber-500/5 border-amber-500/20' :
        'bg-slate-800/40 border-slate-700/40'
      }`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className={`text-[10px] font-bold uppercase tracking-[0.1em] ${
            status === 'overdue' ? 'text-red-400/80' : status === 'today' ? 'text-amber-400/80' : 'text-slate-500'
          }`}>
            {status === 'overdue' ? '⚠ Overdue Action' : status === 'today' ? '⬤ Due Today' : 'Next Action'}
          </div>
          {deal.nextActionDate && (
            <span className={`text-[11px] font-semibold ${
              status === 'overdue' ? 'text-red-400' : status === 'today' ? 'text-amber-400' : 'text-slate-400'
            }`}>{fmtActionDate(deal.nextActionDate)}</span>
          )}
        </div>
        {editingAction ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={actionDraft}
              onChange={e => setActionDraft(e.target.value)}
              placeholder="What needs to happen next?"
              rows={2}
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateDraft}
                onChange={e => setDateDraft(e.target.value)}
                className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-[12px] text-slate-300 focus:outline-none focus:border-indigo-500/60"
              />
              <div className="flex-1"/>
              <button onClick={() => setEditingAction(false)} className="text-[11px] text-slate-600 hover:text-slate-400 px-2">Cancel</button>
              <button onClick={saveAction} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[12px] font-semibold transition-all">Save</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex-1 text-[13px] text-slate-200 leading-snug">
              {deal.nextAction ?? <span className="text-slate-600 italic">No next action set</span>}
            </div>
            <button onClick={() => { setActionDraft(deal.nextAction ?? ''); setDateDraft(deal.nextActionDate ?? ''); setEditingAction(true); }}
              className="flex-shrink-0 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/20 hover:border-indigo-500/40 px-2 py-1 rounded-lg transition-all">
              {deal.nextAction ? 'Edit' : 'Set'}
            </button>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Financials */}
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Financials</div>
          <FieldRow label="Revenue" value={fmtMoney(deal.revenue)} mono />
          <FieldRow label="EBITDA" value={fmtMoney(deal.ebitda)} mono />
          <FieldRow label="SDE" value={fmtMoney(deal.sde)} mono />
          <FieldRow label="Asking Price" value={fmtMoney(deal.askingPrice)} mono />
          <FieldRow label="Multiple"
            value={multiple != null ? (
              <span className={`font-bold ${multiple > 6 ? 'text-red-400' : multiple > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {multiple.toFixed(1)}×
                <span className="text-[10px] font-normal text-slate-600 ml-1">
                  ({deal.ebitda ? 'EBITDA' : 'SDE'})
                </span>
              </span>
            ) : '—'}
          />
          <FieldRow label="Employees" value={deal.employees ?? '—'} />
          <FieldRow label="Founded" value={deal.yearFounded ?? '—'} />
        </div>

        {/* Contact & Deal info */}
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Contact & Source</div>
          {deal.contactName && <FieldRow label="Owner" value={deal.contactName} />}
          {deal.contactEmail && (
            <FieldRow label="Email" value={
              <a href={`mailto:${deal.contactEmail}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">{deal.contactEmail}</a>
            }/>
          )}
          {deal.contactPhone && <FieldRow label="Phone" value={deal.contactPhone} />}
          {deal.brokerName && <FieldRow label="Broker" value={deal.brokerName} />}
          {deal.brokerFirm && <FieldRow label="Firm" value={deal.brokerFirm} />}
          <FieldRow label="Source" value={deal.source ?? '—'} />
          <FieldRow label="Industry" value={deal.industry ?? '—'} />
          <FieldRow label="Location" value={deal.location ?? '—'} />
          <FieldRow label="Added" value={fmtDate(deal.createdAt)} />
        </div>
      </div>

      {/* Description */}
      {deal.description && (
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Description</div>
          <p className="text-[13px] text-slate-400 leading-relaxed">{deal.description}</p>
        </div>
      )}

      {/* Key dates */}
      {(deal.loiDate || deal.closingDate) && (
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3">
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Key Dates</div>
          {deal.loiDate && <FieldRow label="LOI Date" value={fmtDate(deal.loiDate)} />}
          {deal.closingDate && <FieldRow label="Target Close" value={fmtDate(deal.closingDate)} />}
        </div>
      )}
    </div>
  );
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({ deal, onUpdate, onToast }: { deal: Deal; onUpdate: (d: Deal) => void; onToast: (msg: string) => void }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  const save = () => {
    if (!draft.trim()) return;
    setSaving(true);
    const updated = addNote(deal, draft.trim());
    onUpdate(updated);
    setDraft('');
    setSaving(false);
    onToast('Note saved');
  };

  return (
    <div className="space-y-4">
      {/* Add note */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <textarea
          ref={ta}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save(); }}
          placeholder="Add a note… (⌘Enter to save)"
          rows={3}
          className="w-full bg-slate-900/60 border border-slate-700/40 rounded-lg px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
        />
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-[10px] text-slate-700">⌘ Enter to save quickly</span>
          <button
            onClick={save}
            disabled={!draft.trim() || saving}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-[12px] font-semibold transition-all"
          >
            Save Note
          </button>
        </div>
      </div>

      {/* Note list */}
      {deal.notes.length === 0 ? (
        <div className="text-center py-10 text-slate-600 text-[13px]">No notes yet — add the first one above</div>
      ) : (
        <div className="space-y-3">
          {deal.notes.map(note => (
            <div key={note.id} className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4">
              <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">{note.content}</p>
              <div className="mt-2 text-[10px] text-slate-600">
                {new Date(note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tasks tab ─────────────────────────────────────────────────────────────────

function TasksTab({ deal, onUpdate, onToast }: { deal: Deal; onUpdate: (d: Deal) => void; onToast: (msg: string) => void }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  const add = () => {
    if (!title.trim()) return;
    const updated = addTask(deal, title.trim(), due || undefined);
    onUpdate(updated);
    setTitle('');
    setDue('');
    onToast('Task added');
  };

  const done = deal.tasks.filter(t => t.done);
  const open = deal.tasks.filter(t => !t.done);

  function fmtTaskDate(iso?: string) {
    if (!iso) return null;
    const days = Math.ceil((new Date(iso).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'text-red-400 bg-red-500/8 border-red-500/20' };
    if (days === 0) return { label: 'Today', cls: 'text-amber-400 bg-amber-500/8 border-amber-500/20' };
    if (days === 1) return { label: 'Tomorrow', cls: 'text-slate-400 bg-slate-800/60 border-slate-700/40' };
    return { label: `In ${days}d`, cls: 'text-slate-500 bg-slate-800/40 border-slate-700/30' };
  }

  return (
    <div className="space-y-4">
      {/* Add task */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="Add a task…"
          className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
        />
        <input
          type="date"
          value={due}
          onChange={e => setDue(e.target.value)}
          className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-400 focus:outline-none focus:border-indigo-500/50"
        />
        <button onClick={add} disabled={!title.trim()}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-[12px] font-semibold transition-all flex-shrink-0">
          Add
        </button>
      </div>

      {/* Open tasks */}
      {open.length > 0 && (
        <div className="space-y-2">
          {open.map(task => {
            const dateInfo = fmtTaskDate(task.dueDate);
            return (
              <div key={task.id} className="flex items-start gap-3 bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3 group">
                <button
                  onClick={() => { const u = completeTask(deal, task.id); onUpdate(u); onToast('Task completed'); }}
                  className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-slate-600 hover:border-emerald-500 mt-0.5 transition-all hover:bg-emerald-500/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-slate-200">{task.title}</div>
                  {dateInfo && (
                    <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${dateInfo.cls}`}>
                      {dateInfo.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open.length === 0 && done.length === 0 && (
        <div className="text-center py-10 text-slate-600 text-[13px]">No tasks yet</div>
      )}

      {/* Done tasks */}
      {done.length > 0 && (
        <div className="space-y-2 opacity-50">
          <div className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.1em]">Completed — {done.length}</div>
          {done.map(task => (
            <div key={task.id} className="flex items-start gap-3 bg-slate-900/20 rounded-xl px-4 py-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-emerald-600 bg-emerald-500/20 mt-0.5 flex items-center justify-center">
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2.5 h-2.5 text-emerald-400"><path d="M2 5l2 2 4-4"/></svg>
              </div>
              <div className="text-[12px] text-slate-500 line-through">{task.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Timeline tab ──────────────────────────────────────────────────────────────

const TIMELINE_ICON: Record<string, { icon: string; color: string }> = {
  'deal_created':    { icon: '⊕', color: 'text-slate-500' },
  'stage_changed':   { icon: '→', color: 'text-indigo-400' },
  'note_added':      { icon: '✎', color: 'text-blue-400' },
  'task_completed':  { icon: '✓', color: 'text-emerald-400' },
  'action_logged':   { icon: '◆', color: 'text-violet-400' },
  'field_updated':   { icon: '⤻', color: 'text-slate-400' },
  'next_action_set': { icon: '⬤', color: 'text-amber-400' },
};

function TimelineTab({ deal }: { deal: Deal }) {
  const events = [...deal.timeline].reverse();
  return (
    <div className="space-y-0">
      {events.length === 0 ? (
        <div className="text-center py-10 text-slate-600 text-[13px]">No activity yet</div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[18px] top-2 bottom-2 w-px bg-slate-800/60"/>
          <div className="space-y-0">
            {events.map((evt, i) => {
              const cfg = TIMELINE_ICON[evt.type] ?? { icon: '·', color: 'text-slate-600' };
              return (
                <div key={evt.id} className="relative flex items-start gap-4 pb-4">
                  {/* Dot */}
                  <div className={`relative z-10 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-slate-900 border border-slate-800/60 text-[14px] font-bold ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="text-[13px] font-medium text-slate-200">{evt.title}</div>
                    {evt.detail && <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">{evt.detail}</div>}
                    <div className="text-[10px] text-slate-700 mt-1">
                      {new Date(evt.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edit deal form ─────────────────────────────────────────────────────────────

function EditDealModal({ deal, onSave, onClose }: { deal: Deal; onSave: (d: Deal) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: deal.name,
    industry: deal.industry ?? '',
    location: deal.location ?? '',
    employees: deal.employees?.toString() ?? '',
    yearFounded: deal.yearFounded?.toString() ?? '',
    revenue: deal.revenue?.toString() ?? '',
    ebitda: deal.ebitda?.toString() ?? '',
    sde: deal.sde?.toString() ?? '',
    askingPrice: deal.askingPrice?.toString() ?? '',
    contactName: deal.contactName ?? '',
    contactEmail: deal.contactEmail ?? '',
    contactPhone: deal.contactPhone ?? '',
    brokerName: deal.brokerName ?? '',
    brokerFirm: deal.brokerFirm ?? '',
    source: deal.source ?? '',
    description: deal.description ?? '',
  });

  const set = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));
  const num = (v: string) => v ? parseFloat(v) : undefined;

  const save = () => {
    const updated = updateDeal(deal, {
      name: form.name.trim() || deal.name,
      industry: form.industry || undefined,
      location: form.location || undefined,
      employees: num(form.employees),
      yearFounded: num(form.yearFounded),
      revenue: num(form.revenue),
      ebitda: num(form.ebitda),
      sde: num(form.sde),
      askingPrice: num(form.askingPrice),
      contactName: form.contactName || undefined,
      contactEmail: form.contactEmail || undefined,
      contactPhone: form.contactPhone || undefined,
      brokerName: form.brokerName || undefined,
      brokerFirm: form.brokerFirm || undefined,
      source: form.source || undefined,
      description: form.description || undefined,
    }, 'Deal details updated');
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-12">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-[#0d1117] border border-slate-700/60 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <div className="text-[14px] font-semibold text-slate-100">Edit Deal</div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'name', label: 'Company Name *', span: 2 },
              { key: 'industry', label: 'Industry' },
              { key: 'location', label: 'Location' },
              { key: 'revenue', label: 'Revenue ($)', type: 'number' },
              { key: 'ebitda', label: 'EBITDA ($)', type: 'number' },
              { key: 'sde', label: 'SDE ($)', type: 'number' },
              { key: 'askingPrice', label: 'Asking Price ($)', type: 'number' },
              { key: 'employees', label: 'Employees', type: 'number' },
              { key: 'yearFounded', label: 'Year Founded', type: 'number' },
              { key: 'contactName', label: 'Owner / Contact Name' },
              { key: 'contactEmail', label: 'Contact Email' },
              { key: 'contactPhone', label: 'Contact Phone' },
              { key: 'brokerName', label: 'Broker Name' },
              { key: 'brokerFirm', label: 'Broker Firm' },
              { key: 'source', label: 'Source / Origin', span: 2 },
            ].map(field => (
              <div key={field.key} className={field.span === 2 ? 'sm:col-span-2' : ''}>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">{field.label}</label>
                <input
                  type={field.type ?? 'text'}
                  value={(form as Record<string, string>)[field.key]}
                  onChange={e => set(field.key, e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-indigo-500/60"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-indigo-500/60 resize-none"
              />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-800/60 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700/60 rounded-xl transition-colors">Cancel</button>
          <button onClick={save} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-semibold transition-all">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── Main DealDetail ───────────────────────────────────────────────────────────

export default function DealDetail({ deal, onUpdate, onDelete, onBack, onAskAI, onToast }: DealDetailProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const multiple = impliedMultiple(deal);
  const status = actionStatus(deal);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'notes', label: 'Notes', count: deal.notes.length || undefined },
    { id: 'tasks', label: 'Tasks', count: deal.tasks.filter(t => !t.done).length || undefined },
    { id: 'timeline', label: 'Timeline' },
    ...(deal.stage === 'closed-won' ? [{ id: 'value' as Tab, label: 'Value Creation' }] : []),
  ];

  return (
    <div className="min-h-0 flex flex-col">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3">
        {/* Back + actions row */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 transition-colors font-medium"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
              <path d="M6 2L3 5l3 3"/>
            </svg>
            All Deals
          </button>
          <div className="flex-1"/>
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Deal: ${deal.name} — Stage: ${STAGE_LABEL[deal.stage]}, Revenue: ${fmtMoney(deal.revenue)}, EBITDA: ${fmtMoney(deal.ebitda)}, Asking: ${fmtMoney(deal.askingPrice)}${multiple ? `, ${multiple.toFixed(1)}× multiple` : ''}. ${deal.description ?? ''} What should my next move be?`)}
              className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3"><path d="M6 1a4 4 0 014 4 4 4 0 01-2.8 3.8V10H4.8v-1.2A4 4 0 012 5a4 4 0 014-4z"/></svg>
              Ask AI
            </button>
          )}
          <button onClick={() => setShowEdit(true)}
            className="text-[11px] text-slate-500 hover:text-slate-300 font-medium border border-slate-700/50 hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-all">
            Edit
          </button>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-red-400">Delete?</span>
              <button onClick={onDelete} className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded transition-colors">Yes</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="text-[11px] text-slate-600 hover:text-slate-400 px-2 py-1 rounded transition-colors">No</button>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="text-[11px] text-slate-700 hover:text-red-400 font-medium px-2 py-1.5 rounded-lg transition-all">
              Delete
            </button>
          )}
        </div>

        {/* Deal name + meta */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[22px] font-bold text-slate-50 leading-tight">{deal.name}</h1>
              <button
                onClick={() => { const u = { ...deal, starred: !deal.starred, updatedAt: new Date().toISOString() }; onUpdate(u); }}
                className={`text-[18px] transition-all ${deal.starred ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400/60'}`}
              >★</button>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {deal.industry && <span className="text-[11px] text-slate-500">{deal.industry}</span>}
              {deal.location && <><span className="text-slate-700">·</span><span className="text-[11px] text-slate-500">{deal.location}</span></>}
              {multiple != null && (
                <><span className="text-slate-700">·</span>
                <span className="text-[11px] font-semibold text-slate-300">{multiple.toFixed(1)}× multiple</span></>
              )}
            </div>
          </div>
          <StagePicker
            current={deal.stage}
            onChange={s => { const u = changeDealStage(deal, s); onUpdate(u); onToast(`Moved to ${STAGE_LABEL[s]}`); }}
          />
        </div>

        {/* Quick stats bar */}
        {(deal.revenue || deal.ebitda || deal.askingPrice) && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {[
              { label: 'Revenue', value: fmtMoney(deal.revenue) },
              { label: 'EBITDA', value: fmtMoney(deal.ebitda) },
              { label: 'Asking', value: fmtMoney(deal.askingPrice) },
              { label: 'Multiple', value: multiple != null ? `${multiple.toFixed(1)}×` : '—' },
            ].map(s => (
              <div key={s.label} className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{s.label}</div>
                <div className="text-[15px] font-bold text-slate-100 tabular-nums mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 border-b border-slate-800/60 mb-5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium transition-all border-b-2 -mb-px ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview'  && <OverviewTab      deal={deal} onUpdate={onUpdate} onToast={onToast} />}
        {tab === 'notes'     && <NotesTab         deal={deal} onUpdate={onUpdate} onToast={onToast} />}
        {tab === 'tasks'     && <TasksTab         deal={deal} onUpdate={onUpdate} onToast={onToast} />}
        {tab === 'timeline'  && <TimelineTab      deal={deal} />}
        {tab === 'value'     && <DealValueTracker deal={deal} onUpdate={onUpdate} onToast={onToast} />}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditDealModal
          deal={deal}
          onSave={d => { onUpdate(d); onToast('Deal updated'); }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
