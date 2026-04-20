// ─── DailyPriorities ──────────────────────────────────────────────────────────
// "Today" view — surfaces overdue actions, due-today items, and deal tasks.
// Everything urgent in one place. Each item links into the full deal.

import React, { useState, useMemo } from 'react';
import {
  Deal, STAGE_LABEL, STAGE_COLOR,
  loadDeals, saveDeals, setNextAction, completeTask as completeTaskMutation,
  isActiveDeal, actionStatus, daysUntilAction,
  fmtMoney, fmtActionDate,
} from '../../lib/deals';

interface Props {
  onOpenDeal: (dealId: string) => void;   // Navigate into a deal detail
}

// ── Quick "mark done" action card ─────────────────────────────────────────────

interface ActionCardProps {
  deal: Deal;
  onOpenDeal: () => void;
  onSnooze: () => void;
  onLog: () => void;
  variant: 'overdue' | 'today' | 'upcoming';
}

function ActionCard({ deal, onOpenDeal, onSnooze, onLog, variant }: ActionCardProps) {
  const c = STAGE_COLOR[deal.stage];
  const days = daysUntilAction(deal);
  const daysAbs = Math.abs(days ?? 0);

  const urgencyBg =
    variant === 'overdue' ? 'bg-red-500/8 border-red-500/20 hover:bg-red-500/12' :
    variant === 'today'   ? 'bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/12' :
                            'bg-[#0d1117] border-slate-800/60 hover:bg-slate-800/20';

  const dateLabel =
    variant === 'overdue' ? `${daysAbs}d overdue` :
    variant === 'today'   ? 'Due today' :
                            fmtActionDate(deal.nextActionDate);

  const dateCls =
    variant === 'overdue' ? 'text-red-400 font-semibold' :
    variant === 'today'   ? 'text-amber-400 font-semibold' :
                            'text-slate-400';

  return (
    <div className={`border rounded-xl p-4 transition-colors ${urgencyBg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Deal name + stage */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={onOpenDeal}
              className="text-sm font-semibold text-slate-100 hover:text-white transition-colors truncate"
            >
              {deal.name}
            </button>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border shrink-0 ${c.bg} ${c.text} ${c.border}`}>
              <span className={`w-1 h-1 rounded-full ${c.dot}`} />
              {STAGE_LABEL[deal.stage]}
            </span>
          </div>

          {/* Action */}
          <div className="text-sm text-slate-300 mb-1">{deal.nextAction}</div>

          {/* Date + revenue context */}
          <div className="flex items-center gap-3">
            <span className={`text-xs ${dateCls}`}>{dateLabel}</span>
            {deal.revenue && (
              <span className="text-[11px] text-slate-600">{fmtMoney(deal.revenue)} rev</span>
            )}
            {deal.askingPrice && (
              <span className="text-[11px] text-slate-600">{fmtMoney(deal.askingPrice)} asking</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onLog}
            title="Mark complete & log"
            className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-medium rounded-lg transition-colors"
          >
            Done
          </button>
          <button
            onClick={onSnooze}
            title="Snooze 2 days"
            className="px-2.5 py-1.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 text-slate-400 text-xs font-medium rounded-lg transition-colors"
          >
            +2d
          </button>
          <button
            onClick={onOpenDeal}
            title="Open deal"
            className="p-1.5 hover:bg-slate-700/40 text-slate-500 hover:text-slate-300 rounded-lg transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M6 4l4 4-4 4"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Open task row ─────────────────────────────────────────────────────────────

interface TaskRowProps {
  dealName: string;
  taskTitle: string;
  dueDate?: string;
  onOpenDeal: () => void;
  onComplete: () => void;
}

function TaskRow({ dealName, taskTitle, dueDate, onOpenDeal, onComplete }: TaskRowProps) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = dueDate && dueDate < today;
  const isToday = dueDate === today;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-800/40 last:border-0 group">
      <button
        onClick={onComplete}
        className="w-4 h-4 rounded border border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center flex-shrink-0 transition-colors"
      >
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5 text-transparent group-hover:text-emerald-400 transition-colors">
          <path d="M2 5.5l2.5 2.5 4-5"/>
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-300 truncate">{taskTitle}</div>
        <button onClick={onOpenDeal} className="text-[11px] text-slate-500 hover:text-blue-400 transition-colors">{dealName}</button>
      </div>
      {dueDate && (
        <span className={`text-xs shrink-0 ${isOverdue ? 'text-red-400 font-medium' : isToday ? 'text-amber-400 font-medium' : 'text-slate-500'}`}>
          {isOverdue ? 'Overdue' : isToday ? 'Today' : dueDate}
        </span>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, count, accent }: { icon: React.ReactNode; label: string; count: number; accent: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${accent} mb-3`}>
      <div className="w-4 h-4">{icon}</div>
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      <span className="ml-auto text-xs font-bold opacity-70">{count}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DailyPriorities({ onOpenDeal }: Props) {
  const [deals, setDeals] = useState<Deal[]>(() => loadDeals());

  function persist(next: Deal[]) {
    setDeals(next);
    saveDeals(next);
  }

  // Mark action done: log completion, clear next action date (so it moves off list)
  function handleLogDone(dealId: string) {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    const updated = setNextAction(deal, deal.nextAction ?? '', undefined);
    // Set date far enough that it stops being urgent — user can set new date in detail
    persist(deals.map(d => d.id === dealId ? { ...updated, nextActionDate: undefined } : d));
  }

  // Snooze: push due date by 2 days
  function handleSnooze(dealId: string) {
    const deal = deals.find(d => d.id === dealId);
    if (!deal || !deal.nextActionDate) return;
    const current = new Date(deal.nextActionDate);
    current.setDate(current.getDate() + 2);
    const newDate = current.toISOString().split('T')[0];
    const updated = setNextAction(deal, deal.nextAction ?? '', newDate);
    persist(deals.map(d => d.id === dealId ? updated : d));
  }

  // Complete a deal task
  function handleCompleteTask(dealId: string, taskId: string) {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    const updated = completeTaskMutation(deal, taskId);
    persist(deals.map(d => d.id === dealId ? updated : d));
  }

  const active = deals.filter(d => isActiveDeal(d.stage));

  const overdue = active.filter(d => actionStatus(d) === 'overdue' && d.nextAction);
  const today = active.filter(d => actionStatus(d) === 'today' && d.nextAction);
  const upcoming = active.filter(d => actionStatus(d) === 'upcoming' && d.nextAction);

  // Open tasks across all deals with due dates in the next 7 days
  const todayStr = new Date().toISOString().split('T')[0];
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const openTasks = useMemo(() => {
    const items: { deal: Deal; taskId: string; title: string; dueDate?: string }[] = [];
    for (const d of active) {
      for (const t of d.tasks) {
        if (!t.done && t.dueDate && t.dueDate <= in7days) {
          items.push({ deal: d, taskId: t.id, title: t.title, dueDate: t.dueDate });
        }
      }
    }
    return items.sort((a, b) => (a.dueDate ?? 'z').localeCompare(b.dueDate ?? 'z'));
  }, [deals]);

  const allClear = overdue.length === 0 && today.length === 0;

  const IconAlert = (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full text-red-400">
      <path d="M8 2l6 12H2L8 2z"/><path d="M8 7v3M8 11.5v.5"/>
    </svg>
  );
  const IconClock = (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full text-amber-400">
      <circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2.5 2.5"/>
    </svg>
  );
  const IconCalendar = (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full text-blue-400">
      <rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M5 2v2M11 2v2M2 7h12"/>
    </svg>
  );
  const IconCheck = (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full text-slate-400">
      <path d="M3 8l4 4 6-6"/>
    </svg>
  );

  return (
    <div className="space-y-6">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {overdue.length > 0
              ? `${overdue.length} overdue action${overdue.length !== 1 ? 's' : ''} need attention`
              : today.length > 0
              ? `${today.length} action${today.length !== 1 ? 's' : ''} due today`
              : 'No urgent actions — good standing'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-red-400">{overdue.length}</div>
            <div className="text-[10px] text-slate-600 uppercase">Overdue</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-400">{today.length}</div>
            <div className="text-[10px] text-slate-600 uppercase">Today</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-400">{upcoming.length}</div>
            <div className="text-[10px] text-slate-600 uppercase">Upcoming</div>
          </div>
        </div>
      </div>

      {/* All clear state */}
      {allClear && overdue.length === 0 && today.length === 0 && (
        <div className="bg-emerald-500/6 border border-emerald-500/15 rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-emerald-400">
              <path d="M3 8l4 4 6-6"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-300">All caught up</div>
            <div className="text-xs text-slate-500 mt-0.5">No overdue or today actions. Review upcoming deals or add next steps.</div>
          </div>
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div>
          <SectionHeader
            icon={IconAlert}
            label="Overdue Actions"
            count={overdue.length}
            accent="bg-red-500/8 text-red-400"
          />
          <div className="space-y-2">
            {overdue.map(deal => (
              <ActionCard
                key={deal.id}
                deal={deal}
                variant="overdue"
                onOpenDeal={() => onOpenDeal(deal.id)}
                onSnooze={() => handleSnooze(deal.id)}
                onLog={() => handleLogDone(deal.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Due today */}
      {today.length > 0 && (
        <div>
          <SectionHeader
            icon={IconClock}
            label="Due Today"
            count={today.length}
            accent="bg-amber-500/8 text-amber-400"
          />
          <div className="space-y-2">
            {today.map(deal => (
              <ActionCard
                key={deal.id}
                deal={deal}
                variant="today"
                onOpenDeal={() => onOpenDeal(deal.id)}
                onSnooze={() => handleSnooze(deal.id)}
                onLog={() => handleLogDone(deal.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming (next 14 days) */}
      {upcoming.length > 0 && (
        <div>
          <SectionHeader
            icon={IconCalendar}
            label="Coming Up"
            count={upcoming.length}
            accent="bg-blue-500/8 text-blue-400"
          />
          <div className="space-y-2">
            {upcoming.slice(0, 5).map(deal => (
              <ActionCard
                key={deal.id}
                deal={deal}
                variant="upcoming"
                onOpenDeal={() => onOpenDeal(deal.id)}
                onSnooze={() => handleSnooze(deal.id)}
                onLog={() => handleLogDone(deal.id)}
              />
            ))}
            {upcoming.length > 5 && (
              <div className="text-xs text-slate-500 pl-4">+{upcoming.length - 5} more upcoming</div>
            )}
          </div>
        </div>
      )}

      {/* Open deal tasks */}
      {openTasks.length > 0 && (
        <div>
          <SectionHeader
            icon={IconCheck}
            label={`Deal Tasks — Next 7 Days`}
            count={openTasks.length}
            accent="bg-slate-800/40 text-slate-400"
          />
          <div className="bg-[#0d1117] border border-slate-800/60 rounded-xl px-4">
            {openTasks.map(({ deal, taskId, title, dueDate }) => (
              <TaskRow
                key={taskId}
                dealName={deal.name}
                taskTitle={title}
                dueDate={dueDate}
                onOpenDeal={() => onOpenDeal(deal.id)}
                onComplete={() => handleCompleteTask(deal.id, taskId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pipeline snapshot at bottom */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Active Pipeline</span>
          <div className="flex-1 h-px bg-slate-800/60" />
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {active.slice(0, 6).map(deal => {
            const status = actionStatus(deal);
            const c = STAGE_COLOR[deal.stage];
            return (
              <button
                key={deal.id}
                onClick={() => onOpenDeal(deal.id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0d1117] border border-slate-800/60 hover:bg-slate-800/30 hover:border-slate-700/50 transition-colors text-left group"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
                <span className="text-sm text-slate-300 flex-1 truncate group-hover:text-white transition-colors">{deal.name}</span>
                <span className={`text-[11px] ${c.text} shrink-0`}>{STAGE_LABEL[deal.stage]}</span>
                {status === 'overdue' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                {status === 'today' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
