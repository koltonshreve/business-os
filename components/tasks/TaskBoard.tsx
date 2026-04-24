// ─── TaskBoard ────────────────────────────────────────────────────────────────
// The execution engine UI. Shows AI-generated + user tasks, grouped by priority.
// Full CRUD: create, complete, dismiss, snooze.

import { useState, useEffect, useCallback } from 'react';
import type { Task, TaskPriority, TaskStatus, TaskRecurrence } from '../../lib/tasks';
import { fetchTasks, createTask, updateTask, dismissTask, completeTask, PRIORITY_LABEL, PRIORITY_COLOR, RECURRENCE_LABEL } from '../../lib/tasks';
import type { UnifiedBusinessData } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface TaskBoardProps {
  data: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.ceil((d.getTime() - today.setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return `In ${diff}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Create task form ──────────────────────────────────────────────────────────

function CreateTaskForm({ onCreated }: { onCreated: (task: Task) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('p2');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const task = await createTask({
        title: title.trim(), priority, created_by: 'user',
        ...(dueDate ? { due_date: dueDate } : {}),
        recurrence,
      });
      onCreated(task);
      setTitle(''); setDueDate(''); setRecurrence('none');
      setOpen(false);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-slate-700/60 hover:border-slate-600 text-[12px] text-slate-600 hover:text-slate-400 transition-all"
      >
        <span className="text-lg leading-none">+</span>
        Add task
      </button>
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="What needs to happen?"
        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
      />
      <div className="flex items-center gap-2 flex-wrap">
        {(['p1','p2','p3'] as TaskPriority[]).map(p => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
              priority === p
                ? `${PRIORITY_COLOR[p].bg} ${PRIORITY_COLOR[p].border} ${PRIORITY_COLOR[p].text}`
                : 'bg-transparent border-slate-700/40 text-slate-600 hover:text-slate-400'
            }`}
          >
            {PRIORITY_LABEL[p]}
          </button>
        ))}
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="bg-slate-900/60 border border-slate-700/40 rounded-lg px-2 py-1 text-[11px] text-slate-400 focus:outline-none focus:border-indigo-500/60"/>
        <select value={recurrence} onChange={e => setRecurrence(e.target.value as TaskRecurrence)}
          className="bg-slate-900/60 border border-slate-700/40 rounded-lg px-2 py-1 text-[11px] text-slate-400 focus:outline-none">
          {(['none','weekly','monthly','daily'] as TaskRecurrence[]).map(r => (
            <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>
          ))}
        </select>
        <div className="flex-1"/>
        <button onClick={() => setOpen(false)} className="text-[11px] text-slate-600 hover:text-slate-400 px-2 py-1">Cancel</button>
        <button
          onClick={submit}
          disabled={saving || !title.trim()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-[12px] font-semibold transition-all"
        >
          {saving ? 'Adding…' : 'Add task'}
        </button>
      </div>
    </div>
  );
}

// ── Single task card ──────────────────────────────────────────────────────────

function TaskCard({ task, onUpdate, onAskAI }: {
  task: Task;
  onUpdate: (id: string, updated: Task | null) => void;
  onAskAI?: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const pc = PRIORITY_COLOR[task.priority];
  const dueStr = fmtDate(task.due_date);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  const handleComplete = async () => {
    try {
      const updated = await completeTask(task.id);
      onUpdate(task.id, updated);
    } catch { /* ignore */ }
  };

  const handleDismiss = async () => {
    try {
      const updated = await dismissTask(task.id);
      onUpdate(task.id, updated);
    } catch { /* ignore */ }
  };

  const handleActivate = async () => {
    try {
      const updated = await updateTask(task.id, { status: 'active' });
      onUpdate(task.id, updated);
    } catch { /* ignore */ }
  };

  return (
    <div className={`group bg-slate-900/50 border rounded-xl transition-all ${pc.border} hover:border-opacity-50`}>
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Complete checkbox */}
        <button
          onClick={handleComplete}
          title="Mark complete"
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 transition-all hover:scale-110 ${
            task.status === 'done'
              ? 'bg-emerald-500 border-emerald-500'
              : `border-slate-600 hover:border-emerald-500/70 ${pc.bg}`
          }`}
        >
          {task.status === 'done' && (
            <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" className="w-full h-full p-0.5">
              <path d="M2 5l2.5 2.5 3.5-4"/>
            </svg>
          )}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <div
              className={`text-[13px] font-medium leading-snug flex-1 min-w-0 cursor-pointer select-none ${
                task.status === 'done' ? 'line-through text-slate-600' : 'text-slate-100'
              }`}
              onClick={() => setExpanded(v => !v)}
            >
              {task.title}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
              {/* Priority badge */}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${pc.bg} ${pc.border} ${pc.text}`}>
                {PRIORITY_LABEL[task.priority]}
              </span>
              {/* AI badge */}
              {task.created_by === 'ai' && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border bg-indigo-500/8 border-indigo-500/20 text-indigo-400 uppercase tracking-wide">
                  AI
                </span>
              )}
              {/* Due date */}
              {dueStr && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                  isOverdue ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-slate-800/60 border-slate-700/40 text-slate-500'
                }`}>
                  {dueStr}
                </span>
              )}
              {/* Recurrence badge */}
              {task.recurrence && task.recurrence !== 'none' && (
                <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-violet-500/8 border-violet-500/20 text-violet-400 uppercase tracking-wide">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-2 h-2"><path d="M9 5A4 4 0 112 2.5M9 5V2M9 5H6"/></svg>
                  {RECURRENCE_LABEL[task.recurrence]}
                </span>
              )}
              {/* Status */}
              {task.status === 'active' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-sky-500/10 border-sky-500/20 text-sky-400 uppercase tracking-wide">
                  Active
                </span>
              )}
            </div>
          </div>

          {/* Entity name */}
          {task.entity_name && (
            <div className="text-[10px] text-slate-600 mt-0.5 truncate">{task.entity_type}: {task.entity_name}</div>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-2.5 space-y-2">
              {task.context && (
                <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                  <div className="text-[9px] font-bold text-slate-600 uppercase tracking-wide mb-1">Context</div>
                  <div className="text-[12px] text-slate-400 leading-relaxed">{task.context}</div>
                </div>
              )}
              {task.impact && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                  <div className="text-[9px] font-bold text-red-500/60 uppercase tracking-wide mb-1">If not done</div>
                  <div className="text-[12px] text-red-400/70 leading-relaxed">{task.impact}</div>
                </div>
              )}
              <div className="text-[10px] text-slate-700">Created {timeAgo(task.created_at)} · {task.assignee}</div>
            </div>
          )}
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status === 'open' && (
            <button
              onClick={handleActivate}
              title="Mark as in progress"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-sky-400 hover:bg-sky-500/10 transition-all text-[10px] font-bold"
            >
              ▶
            </button>
          )}
          {onAskAI && task.status !== 'done' && (
            <button
              onClick={() => onAskAI(`Help me with this task: "${task.title}". ${task.context ? `Context: ${task.context}` : ''} What's the best approach?`)}
              title="Ask AI for help"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
            >
              <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3"><path d="M6 1a4 4 0 014 4 4 4 0 01-2.8 3.8V10H4.8v-1.2A4 4 0 012 5a4 4 0 014-4z"/><rect x="4.8" y="10.5" width="2.4" height="0.8" rx="0.4"/></svg>
            </button>
          )}
          {task.status !== 'dismissed' && task.status !== 'done' && (
            <button
              onClick={handleDismiss}
              title="Dismiss"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-700 hover:text-slate-400 hover:bg-slate-800/60 transition-all text-[13px]"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stats strip ───────────────────────────────────────────────────────────────

function TaskStats({ tasks }: { tasks: Task[] }) {
  const open = tasks.filter(t => t.status === 'open').length;
  const active = tasks.filter(t => t.status === 'active').length;
  const done = tasks.filter(t => t.status === 'done').length;
  const p1 = tasks.filter(t => t.priority === 'p1' && t.status !== 'done' && t.status !== 'dismissed').length;
  const aiCreated = tasks.filter(t => t.created_by === 'ai' && t.status !== 'done' && t.status !== 'dismissed').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'Open',     value: open,      color: 'text-slate-300' },
        { label: 'Active',   value: active,    color: 'text-sky-400' },
        { label: 'Critical', value: p1,        color: p1 > 0 ? 'text-red-400' : 'text-slate-500' },
        { label: 'AI Tasks', value: aiCreated, color: 'text-indigo-400' },
        { label: 'Done',     value: done,      color: 'text-emerald-400' },
      ].map(s => (
        <div key={s.label} className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-3 py-2.5 text-center">
          <div className={`text-[22px] font-bold tabular-nums leading-none ${s.color}`}>{s.value}</div>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── DB unavailable notice ─────────────────────────────────────────────────────

function NoDbNotice() {
  return (
    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-5 py-4 flex items-start gap-3">
      <span className="text-amber-400/70 mt-0.5 flex-shrink-0">⚠</span>
      <div>
        <div className="text-[13px] font-semibold text-amber-400/80 mb-1">Database not connected</div>
        <div className="text-[12px] text-slate-400 leading-relaxed">
          Tasks persist in Neon (Postgres). Connect via Vercel Dashboard → Storage → Neon to enable this feature.
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskBoard({ data, onAskAI }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(true);
  const [runningRules, setRunningRules] = useState(false);
  const [rulesRan, setRulesRan] = useState(false);
  const [rulesSummary, setRulesSummary] = useState<{ fired: number; skipped: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'active' | 'done'>('open');
  const [showDismissed, setShowDismissed] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const all = await fetchTasks();
      setTasks(all);
      setDbAvailable(true);
    } catch {
      setDbAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Run rule engine on mount (once per session)
  useEffect(() => {
    const ranKey = 'bos_rules_ran_' + new Date().toISOString().split('T')[0];
    if (sessionStorage.getItem(ranKey)) { setRulesRan(true); return; }

    const runRules = async () => {
      setRunningRules(true);
      try {
        // Load acq targets from localStorage
        let acqTargets;
        try {
          const saved = localStorage.getItem('bos_acq_targets');
          if (saved) acqTargets = JSON.parse(saved);
        } catch { /* ignore */ }
        let goals;
        try {
          const saved = localStorage.getItem('bos_acq_goals');
          if (saved) {
            const parsed = JSON.parse(saved);
            goals = parsed.map((g: {id: string; title: string; status: string; current: number; target: number; dueDate?: string}) => ({
              id: g.id, title: g.title, status: g.status,
              current: g.current, target: g.target, dueDate: g.dueDate,
            }));
          }
        } catch { /* ignore */ }

        const res = await fetch('/api/rules/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, acqTargets, goals }),
        });
        if (res.ok) {
          const result = await res.json() as { fired: number; skipped: number; tasks: Task[] };
          setRulesSummary({ fired: result.fired, skipped: result.skipped });
          if (result.fired > 0) {
            setTasks(prev => [...result.tasks, ...prev]);
          }
          sessionStorage.setItem(ranKey, '1');
          setRulesRan(true);
        }
      } catch { /* non-fatal */ } finally {
        setRunningRules(false);
      }
    };
    runRules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTaskUpdate = useCallback((id: string, updated: Task | null) => {
    setTasks(prev => updated
      ? prev.map(t => t.id === id ? updated : t)
      : prev.filter(t => t.id !== id)
    );
  }, []);

  const handleTaskCreated = useCallback((task: Task) => {
    setTasks(prev => [task, ...prev]);
  }, []);

  // Filter tasks
  const visibleTasks = tasks.filter(t => {
    if (t.status === 'dismissed' && !showDismissed) return false;
    if (filter === 'all') return t.status !== 'dismissed';
    if (filter === 'open') return t.status === 'open';
    if (filter === 'active') return t.status === 'active';
    if (filter === 'done') return t.status === 'done';
    return true;
  });

  // Group by priority for non-done views
  const p1Tasks = visibleTasks.filter(t => t.priority === 'p1' && t.status !== 'done' && t.status !== 'dismissed');
  const p2Tasks = visibleTasks.filter(t => t.priority === 'p2' && t.status !== 'done' && t.status !== 'dismissed');
  const p3Tasks = visibleTasks.filter(t => t.priority === 'p3' && t.status !== 'done' && t.status !== 'dismissed');
  const doneTasks = visibleTasks.filter(t => t.status === 'done');
  const dismissedTasks = tasks.filter(t => t.status === 'dismissed');

  const activeTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'dismissed');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-600 text-[13px]">
        <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0110 10"/></svg>
        Loading tasks…
      </div>
    );
  }

  if (!dbAvailable) return <NoDbNotice />;

  return (
    <div className="space-y-5">

      {/* Header + run rules button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold text-slate-200">Task Execution Engine</div>
          <div className="text-[11px] text-slate-600 mt-0.5">AI-generated + user tasks · sorted by priority</div>
        </div>
        <div className="flex items-center gap-2">
          {rulesRan && rulesSummary && rulesSummary.fired > 0 && (
            <span className="text-[11px] text-indigo-400/80 bg-indigo-500/8 border border-indigo-500/15 px-2.5 py-1 rounded-lg font-medium">
              ✦ {rulesSummary.fired} new AI task{rulesSummary.fired > 1 ? 's' : ''} created
            </span>
          )}
          <button
            onClick={async () => {
              setRunningRules(true);
              sessionStorage.removeItem('bos_rules_ran_' + new Date().toISOString().split('T')[0]);
              try {
                const res = await fetch('/api/rules/run', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ data }),
                });
                if (res.ok) {
                  const result = await res.json() as { fired: number; skipped: number; tasks: Task[] };
                  setRulesSummary({ fired: result.fired, skipped: result.skipped });
                  if (result.fired > 0) {
                    setTasks(prev => [...result.tasks, ...prev]);
                  }
                }
              } catch { /* ignore */ } finally {
                setRunningRules(false);
                setRulesRan(true);
              }
            }}
            disabled={runningRules}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[12px] font-semibold transition-all"
          >
            {runningRules ? (
              <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".2"/><path d="M12 2a10 10 0 0110 10"/></svg>Running…</>
            ) : '✦ Run AI Rules'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <TaskStats tasks={tasks} />

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {(['open','active','done','all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all capitalize ${
              filter === f
                ? 'bg-slate-800/80 text-slate-100'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
            }`}
          >
            {f}
          </button>
        ))}
        {dismissedTasks.length > 0 && (
          <button
            onClick={() => setShowDismissed(v => !v)}
            className="ml-auto text-[11px] text-slate-700 hover:text-slate-500 transition-colors"
          >
            {showDismissed ? 'Hide dismissed' : `Show ${dismissedTasks.length} dismissed`}
          </button>
        )}
      </div>

      {/* Create task */}
      {(filter === 'open' || filter === 'all') && (
        <CreateTaskForm onCreated={handleTaskCreated} />
      )}

      {/* Task list */}
      {activeTasks.length === 0 && filter !== 'done' ? (
        <div className="text-center py-12 text-slate-600 text-[13px]">
          <div className="text-3xl mb-3">✓</div>
          <div className="font-medium text-slate-500">No open tasks</div>
          <div className="text-[11px] mt-1">Run AI Rules to generate tasks from your business data</div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* P1 Critical */}
          {p1Tasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"/>
                <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-[0.1em]">Critical — {p1Tasks.length}</span>
                <div className="flex-1 h-px bg-red-500/10"/>
              </div>
              {p1Tasks.map(t => (
                <TaskCard key={t.id} task={t} onUpdate={handleTaskUpdate} onAskAI={onAskAI} />
              ))}
            </div>
          )}

          {/* P2 High */}
          {p2Tasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"/>
                <span className="text-[10px] font-bold text-amber-400/80 uppercase tracking-[0.1em]">High Priority — {p2Tasks.length}</span>
                <div className="flex-1 h-px bg-amber-500/10"/>
              </div>
              {p2Tasks.map(t => (
                <TaskCard key={t.id} task={t} onUpdate={handleTaskUpdate} onAskAI={onAskAI} />
              ))}
            </div>
          )}

          {/* P3 Normal */}
          {p3Tasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0"/>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Normal — {p3Tasks.length}</span>
                <div className="flex-1 h-px bg-slate-800/60"/>
              </div>
              {p3Tasks.map(t => (
                <TaskCard key={t.id} task={t} onUpdate={handleTaskUpdate} onAskAI={onAskAI} />
              ))}
            </div>
          )}

          {/* Done */}
          {doneTasks.length > 0 && (filter === 'done' || filter === 'all') && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"/>
                <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-[0.1em]">Completed — {doneTasks.length}</span>
                <div className="flex-1 h-px bg-emerald-500/10"/>
              </div>
              {doneTasks.map(t => (
                <TaskCard key={t.id} task={t} onUpdate={handleTaskUpdate} onAskAI={onAskAI} />
              ))}
            </div>
          )}

          {/* Dismissed */}
          {showDismissed && dismissedTasks.length > 0 && (
            <div className="space-y-2 opacity-50">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-slate-700 flex-shrink-0"/>
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.1em]">Dismissed — {dismissedTasks.length}</span>
                <div className="flex-1 h-px bg-slate-800/60"/>
              </div>
              {dismissedTasks.map(t => (
                <TaskCard key={t.id} task={t} onUpdate={handleTaskUpdate} onAskAI={onAskAI} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
