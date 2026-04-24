// ─── Goal Engine ─────────────────────────────────────────────────────────────
// Acquisition-focused goal tracker: target acquisitions, EBITDA milestones,
// portfolio targets, and time-bound execution goals.

import { useState, useEffect } from 'react';
import { addMemoryEntry } from '../../lib/memory';
import { authHeaders, loadAuthSession } from '../../lib/auth';

// ─── Types ─────────────────────────────────────────────────────────────────

type GoalCategory = 'acquisition' | 'financial' | 'portfolio' | 'execution';
type GoalStatus = 'on-track' | 'at-risk' | 'behind' | 'complete' | 'not-started';

interface GoalMilestone {
  id: string;
  label: string;
  dueDate: string;
  complete: boolean;
}

interface AcqGoal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  status: GoalStatus;
  target: number;
  current: number;
  unit: string;       // '$', 'deals', '%', 'x', 'months'
  dueDate: string;    // ISO
  milestones: GoalMilestone[];
  linkedDealIds?: string[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

// ─── Seed goals ──────────────────────────────────────────────────────────────

function seedGoals(): AcqGoal[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'goal-1',
      title: 'Close 1st Platform Acquisition',
      description: 'Acquire a $1–5M EBITDA services business in the home services or industrial vertical',
      category: 'acquisition',
      status: 'on-track',
      target: 1,
      current: 0,
      unit: 'deals',
      dueDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
      milestones: [
        { id: 'm1', label: 'Source 20+ qualified targets', dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), complete: true },
        { id: 'm2', label: 'Sign 3 NDAs', dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), complete: true },
        { id: 'm3', label: 'Submit LOI', dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), complete: false },
        { id: 'm4', label: 'Complete due diligence', dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), complete: false },
        { id: 'm5', label: 'Close', dueDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(), complete: false },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'goal-2',
      title: 'Build $2M EBITDA Portfolio',
      description: 'Acquire and operate businesses generating $2M+ combined EBITDA within 18 months',
      category: 'financial',
      status: 'on-track',
      target: 2000000,
      current: 0,
      unit: '$',
      dueDate: new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000).toISOString(),
      milestones: [
        { id: 'm6', label: 'First acquisition ($500k+ EBITDA)', dueDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(), complete: false },
        { id: 'm7', label: 'Reach $1M EBITDA', dueDate: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000).toISOString(), complete: false },
        { id: 'm8', label: 'Reach $2M EBITDA', dueDate: new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000).toISOString(), complete: false },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'goal-3',
      title: 'Acquire at ≤5× EBITDA Multiple',
      description: 'Maintain acquisition discipline — all platform deals below 5× EBITDA',
      category: 'acquisition',
      status: 'on-track',
      target: 5,
      current: 0,
      unit: 'x',
      dueDate: new Date(Date.now() + 24 * 30 * 24 * 60 * 60 * 1000).toISOString(),
      milestones: [],
      createdAt: now,
      updatedAt: now,
      notes: 'Add-ons can be higher if strategic synergies justify premium',
    },
    {
      id: 'goal-4',
      title: 'Source 50 Qualified Targets This Quarter',
      description: 'Build top-of-funnel pipeline through broker outreach, direct mail, and referrals',
      category: 'execution',
      status: 'at-risk',
      target: 50,
      current: 18,
      unit: 'deals',
      dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      milestones: [
        { id: 'm9', label: 'Engage 10 brokers', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), complete: true },
        { id: 'm10', label: 'Launch direct mail campaign', dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), complete: false },
        { id: 'm11', label: 'Reach 50 targets in CRM', dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), complete: false },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtValue(val: number, unit: string): string {
  if (unit === '$') {
    const abs = Math.abs(val);
    const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
    return val < 0 ? `(${s})` : s;
  }
  if (unit === '%') return `${val.toFixed(1)}%`;
  if (unit === 'x') return `${val.toFixed(1)}×`;
  if (unit === 'months') return `${val} mo`;
  return `${val} ${unit}`;
}

function progressPct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min((current / target) * 100, 100);
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const CAT_COLORS: Record<GoalCategory, { bg: string; border: string; text: string; dot: string }> = {
  acquisition: { bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     text: 'text-sky-300',    dot: 'bg-sky-400' },
  financial:   { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  portfolio:   { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  text: 'text-violet-300', dot: 'bg-violet-400' },
  execution:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-300',  dot: 'bg-amber-400' },
};

const STATUS_COLORS: Record<GoalStatus, { text: string; bg: string; border: string }> = {
  'on-track':    { text: 'text-emerald-400', bg: 'bg-emerald-500/8',  border: 'border-emerald-500/20' },
  'at-risk':     { text: 'text-amber-400',   bg: 'bg-amber-500/8',    border: 'border-amber-500/20' },
  'behind':      { text: 'text-red-400',     bg: 'bg-red-500/8',      border: 'border-red-500/20' },
  'complete':    { text: 'text-sky-400',     bg: 'bg-sky-500/8',      border: 'border-sky-500/20' },
  'not-started': { text: 'text-slate-500',   bg: 'bg-slate-800/40',   border: 'border-slate-700/40' },
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  'on-track': 'On Track', 'at-risk': 'At Risk', 'behind': 'Behind', 'complete': 'Complete', 'not-started': 'Not Started',
};

// ─── Add Goal Modal ──────────────────────────────────────────────────────────

interface AddGoalModalProps {
  onAdd: (g: Omit<AcqGoal, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

function AddGoalModal({ onAdd, onClose }: AddGoalModalProps) {
  const [title, setTitle]     = useState('');
  const [desc, setDesc]       = useState('');
  const [cat, setCat]         = useState<GoalCategory>('acquisition');
  const [target, setTarget]   = useState('');
  const [current, setCurrent] = useState('0');
  const [unit, setUnit]       = useState('deals');
  const [due, setDue]         = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });

  const submit = () => {
    if (!title.trim() || !target) return;
    onAdd({
      title: title.trim(), description: desc.trim() || undefined,
      category: cat, status: 'not-started',
      target: parseFloat(target), current: parseFloat(current) || 0,
      unit, dueDate: new Date(due).toISOString(),
      milestones: [], notes: undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md"/>
      <div className="relative bg-[#0d1117] border border-slate-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-[15px] font-bold text-slate-100">New Goal</div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xl transition-colors">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5">Title</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Close 1st Acquisition"
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5">Category</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['acquisition', 'financial', 'portfolio', 'execution'] as GoalCategory[]).map(c => (
                <button key={c} onClick={() => setCat(c)}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-all border ${
                    cat === c ? `${CAT_COLORS[c].bg} ${CAT_COLORS[c].border} ${CAT_COLORS[c].text}` : 'bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5">Target</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)}
                placeholder="e.g. 5"
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5">Current</label>
              <input type="number" value={current} onChange={e => setCurrent(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-indigo-500/60"/>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5">Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-indigo-500/60">
                {['deals', '$', '%', 'x', 'months', 'targets', 'NDAs'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5">Due Date</label>
            <input type="date" value={due} onChange={e => setDue(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-indigo-500/60"/>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5">Description (optional)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="What does success look like?"
              className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 resize-none"/>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-300 border border-slate-700/50 rounded-xl transition-colors">Cancel</button>
          <button onClick={submit} disabled={!title.trim() || !target}
            className="flex-1 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl transition-colors">
            Create Goal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: AcqGoal;
  onUpdate: (g: AcqGoal) => void;
  onDelete: (id: string) => void;
}

function GoalCard({ goal, onUpdate, onDelete }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingProgress, setEditingProgress] = useState(false);
  const [draftProgress, setDraftProgress] = useState(String(goal.current));
  const [editingStatus, setEditingStatus] = useState(false);

  const cat    = CAT_COLORS[goal.category];
  const status = STATUS_COLORS[goal.status];
  const pct    = progressPct(goal.current, goal.target);
  const days   = daysUntil(goal.dueDate);
  const milestonesComplete = goal.milestones.filter(m => m.complete).length;

  const barColor = pct >= 100 ? 'bg-emerald-500'
    : goal.status === 'at-risk' ? 'bg-amber-500'
    : goal.status === 'behind'  ? 'bg-red-500'
    : goal.status === 'complete'? 'bg-sky-500'
    : 'bg-indigo-500';

  const commitProgress = () => {
    const n = parseFloat(draftProgress);
    if (!isNaN(n) && n >= 0) {
      const updated = { ...goal, current: n, updatedAt: new Date().toISOString() };
      onUpdate(updated);
      addMemoryEntry('goal-update', `Updated "${goal.title}" progress to ${fmtValue(n, goal.unit)}`);
    }
    setEditingProgress(false);
  };

  const toggleMilestone = (mid: string) => {
    const updated: AcqGoal = {
      ...goal,
      milestones: goal.milestones.map(m => m.id === mid ? { ...m, complete: !m.complete } : m),
      updatedAt: new Date().toISOString(),
    };
    onUpdate(updated);
  };

  return (
    <div className={`bg-slate-900/60 border rounded-xl transition-all ${cat.border}`}>
      {/* Header */}
      <div className="px-4 py-3.5 flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cat.dot}`}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-100 leading-snug">{goal.title}</div>
              {goal.description && (
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{goal.description}</div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
              {/* Status badge */}
              {editingStatus ? (
                <select autoFocus value={goal.status}
                  onChange={e => { onUpdate({ ...goal, status: e.target.value as GoalStatus, updatedAt: new Date().toISOString() }); setEditingStatus(false); }}
                  onBlur={() => setEditingStatus(false)}
                  className="bg-slate-800 border border-slate-600 text-slate-200 text-[11px] rounded-lg px-2 py-0.5 focus:outline-none">
                  {(['on-track','at-risk','behind','complete','not-started'] as GoalStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <button onClick={() => setEditingStatus(true)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${status.bg} ${status.border} ${status.text}`}>
                  {STATUS_LABELS[goal.status]}
                </button>
              )}
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${cat.bg} ${cat.border} ${cat.text} capitalize`}>
                {goal.category}
              </span>
              <button onClick={() => onDelete(goal.id)}
                className="text-slate-700 hover:text-red-400 transition-colors text-sm leading-none">×</button>
            </div>
          </div>

          {/* Progress row */}
          <div className="flex items-center gap-3">
            {/* Current value */}
            {editingProgress ? (
              <input autoFocus type="number" value={draftProgress}
                onChange={e => setDraftProgress(e.target.value)}
                onBlur={commitProgress}
                onKeyDown={e => { if (e.key === 'Enter') commitProgress(); if (e.key === 'Escape') setEditingProgress(false); }}
                className="w-20 bg-slate-800 border border-indigo-500/50 rounded px-2 py-0.5 text-[12px] text-slate-100 focus:outline-none tabular-nums"/>
            ) : (
              <button onClick={() => { setDraftProgress(String(goal.current)); setEditingProgress(true); }}
                className="text-[13px] font-bold text-slate-100 tabular-nums hover:text-indigo-300 transition-colors">
                {fmtValue(goal.current, goal.unit)}
              </button>
            )}
            <span className="text-[11px] text-slate-600">of</span>
            <span className="text-[13px] font-semibold text-slate-400 tabular-nums">{fmtValue(goal.target, goal.unit)}</span>
            <span className="text-[10px] font-semibold text-slate-600">·</span>
            <span className={`text-[11px] font-semibold tabular-nums ${pct >= 100 ? 'text-emerald-400' : pct >= 75 ? 'text-amber-400' : 'text-slate-500'}`}>
              {pct.toFixed(0)}%
            </span>
            <span className="flex-1"/>
            <span className={`text-[10px] font-medium ${days < 0 ? 'text-red-400' : days < 14 ? 'text-amber-400' : 'text-slate-600'}`}>
              {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }}/>
          </div>

          {/* Milestone count + expand */}
          {goal.milestones.length > 0 && (
            <button onClick={() => setExpanded(v => !v)}
              className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                className={`w-2.5 h-2.5 transition-transform ${expanded ? 'rotate-180' : ''}`}>
                <path d="M2 3.5L5 6.5 8 3.5"/>
              </svg>
              {milestonesComplete}/{goal.milestones.length} milestones
            </button>
          )}
        </div>
      </div>

      {/* Milestones */}
      {expanded && goal.milestones.length > 0 && (
        <div className="px-4 pb-3.5 border-t border-slate-800/40">
          <div className="pt-3 space-y-2">
            {goal.milestones.map(m => {
              const md = daysUntil(m.dueDate);
              return (
                <div key={m.id} className="flex items-center gap-2.5">
                  <button onClick={() => toggleMilestone(m.id)}
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                      m.complete ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-500'}`}>
                    {m.complete && (
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-2.5 h-2.5">
                        <path d="M2 5l2.5 2.5 4-4"/>
                      </svg>
                    )}
                  </button>
                  <span className={`text-[12px] flex-1 ${m.complete ? 'line-through text-slate-600' : 'text-slate-300'}`}>{m.label}</span>
                  <span className={`text-[10px] font-medium flex-shrink-0 ${
                    m.complete ? 'text-emerald-400/60' : md < 0 ? 'text-red-400' : md < 7 ? 'text-amber-400' : 'text-slate-600'}`}>
                    {m.complete ? '✓' : md < 0 ? `${Math.abs(md)}d late` : `in ${md}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Strip ────────────────────────────────────────────────────────────

function GoalSummary({ goals }: { goals: AcqGoal[] }) {
  const total    = goals.length;
  const complete = goals.filter(g => g.status === 'complete').length;
  const onTrack  = goals.filter(g => g.status === 'on-track').length;
  const atRisk   = goals.filter(g => g.status === 'at-risk').length;
  const behind   = goals.filter(g => g.status === 'behind').length;

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Total Goals',  value: total,    color: 'text-slate-300' },
        { label: 'On Track',     value: onTrack,  color: 'text-emerald-400' },
        { label: 'At Risk',      value: atRisk,   color: 'text-amber-400' },
        { label: 'Complete',     value: complete, color: 'text-sky-400' },
      ].map(s => (
        <div key={s.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3 text-center">
          <div className={`text-[22px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Next Actions derived from goals ─────────────────────────────────────────

function NextActions({ goals }: { goals: AcqGoal[] }) {
  // Find overdue milestones and at-risk goals
  const overdueMs: { goalTitle: string; ms: GoalMilestone }[] = [];
  const upcoming: { goalTitle: string; ms: GoalMilestone }[] = [];

  for (const g of goals) {
    if (g.status === 'complete') continue;
    for (const m of g.milestones) {
      if (m.complete) continue;
      const d = daysUntil(m.dueDate);
      if (d < 0)  overdueMs.push({ goalTitle: g.title, ms: m });
      else if (d <= 14) upcoming.push({ goalTitle: g.title, ms: m });
    }
  }

  const items = [...overdueMs.slice(0, 2), ...upcoming.slice(0, 3)];
  if (items.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/40">
        <div className="text-[12px] font-semibold text-slate-300">Next Actions</div>
        <div className="text-[11px] text-slate-600 mt-0.5">Milestones due or overdue across all goals</div>
      </div>
      <div className="divide-y divide-slate-800/40">
        {items.map(({ goalTitle, ms }, i) => {
          const d = daysUntil(ms.dueDate);
          const overdue = d < 0;
          return (
            <div key={`${i}-${ms.id}`} className="px-4 py-3 flex items-start gap-3">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${overdue ? 'bg-red-400' : 'bg-amber-400'}`}/>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-slate-100">{ms.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{goalTitle}</div>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                overdue ? 'text-red-400 bg-red-500/8 border-red-500/20' : 'text-amber-400 bg-amber-500/8 border-amber-500/20'}`}>
                {overdue ? `${Math.abs(d)}d overdue` : `in ${d}d`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GoalEngine() {
  const [goals, setGoals]       = useState<AcqGoal[]>([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [filter, setFilter]     = useState<GoalCategory | 'all'>('all');

  // Hydrate: DB prefs first, then localStorage fallback
  useEffect(() => {
    const session = loadAuthSession();
    if (session) {
      fetch('/api/user/prefs', { headers: authHeaders() })
        .then(r => r.ok ? r.json() : null)
        .then((prefs: { acqGoals?: AcqGoal[] } | null) => {
          if (prefs?.acqGoals && prefs.acqGoals.length > 0) {
            setGoals(prefs.acqGoals);
            try { localStorage.setItem('bos_acq_goals', JSON.stringify(prefs.acqGoals)); } catch { /* ignore */ }
          } else {
            // Fall back to localStorage, then push to DB
            try {
              const saved = localStorage.getItem('bos_acq_goals');
              const gs = saved ? JSON.parse(saved) as AcqGoal[] : seedGoals();
              setGoals(gs);
              if (!saved) localStorage.setItem('bos_acq_goals', JSON.stringify(gs));
              // Sync up to DB
              fetch('/api/user/prefs', {
                method: 'PATCH', headers: authHeaders(),
                body: JSON.stringify({ acqGoals: gs }),
              }).catch(() => null);
            } catch { setGoals(seedGoals()); }
          }
        })
        .catch(() => {
          try {
            const saved = localStorage.getItem('bos_acq_goals');
            if (saved) setGoals(JSON.parse(saved));
            else { const seeds = seedGoals(); setGoals(seeds); localStorage.setItem('bos_acq_goals', JSON.stringify(seeds)); }
          } catch { setGoals(seedGoals()); }
        });
    } else {
      try {
        const saved = localStorage.getItem('bos_acq_goals');
        if (saved) setGoals(JSON.parse(saved));
        else { const seeds = seedGoals(); setGoals(seeds); localStorage.setItem('bos_acq_goals', JSON.stringify(seeds)); }
      } catch { setGoals(seedGoals()); }
    }
  }, []);

  const persist = (gs: AcqGoal[]) => {
    setGoals(gs);
    try { localStorage.setItem('bos_acq_goals', JSON.stringify(gs)); } catch { /* ignore */ }
    const session = loadAuthSession();
    if (session) {
      fetch('/api/user/prefs', {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ acqGoals: gs }),
      }).catch(() => null);
    }
  };

  const addGoal = (data: Omit<AcqGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const g: AcqGoal = { ...data, id: `goal-${Date.now()}`, createdAt: now, updatedAt: now };
    persist([g, ...goals]);
    addMemoryEntry('goal-update', `Created goal: "${g.title}"`);
    setShowAdd(false);
  };

  const updateGoal = (updated: AcqGoal) => persist(goals.map(g => g.id === updated.id ? updated : g));
  const deleteGoal = (id: string) => persist(goals.filter(g => g.id !== id));

  const visible = filter === 'all' ? goals : goals.filter(g => g.category === filter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[16px] font-bold text-slate-100">Goal Engine</div>
          <div className="text-[12px] text-slate-500 mt-0.5">Track acquisitions, financial milestones, and execution goals</div>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3">
            <path d="M6 2v8M2 6h8"/>
          </svg>
          New Goal
        </button>
      </div>

      {/* Summary */}
      <GoalSummary goals={goals}/>

      {/* Next Actions */}
      <NextActions goals={goals}/>

      {/* Category filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['all', 'acquisition', 'financial', 'portfolio', 'execution'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-all border ${
              filter === f
                ? f === 'all'
                  ? 'bg-slate-700/60 border-slate-600 text-slate-100'
                  : `${CAT_COLORS[f as GoalCategory].bg} ${CAT_COLORS[f as GoalCategory].border} ${CAT_COLORS[f as GoalCategory].text}`
                : 'bg-transparent border-slate-800/60 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}>
            {f === 'all' ? 'All Goals' : f}
          </button>
        ))}
      </div>

      {/* Goal cards */}
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <div className="text-[13px] font-medium text-slate-500">No goals yet</div>
            <div className="text-[11px] mt-1">Create a goal to start tracking your acquisition journey</div>
          </div>
        ) : (
          visible.map(g => (
            <GoalCard key={g.id} goal={g} onUpdate={updateGoal} onDelete={deleteGoal}/>
          ))
        )}
      </div>

      {showAdd && <AddGoalModal onAdd={addGoal} onClose={() => setShowAdd(false)}/>}
    </div>
  );
}
