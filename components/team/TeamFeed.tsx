// ─── Team Feed ────────────────────────────────────────────────────────────────
// Activity feed, comments, and task assignments for the acquisition team.
// Lightweight collaboration layer backed by localStorage.

import { useState, useEffect, useRef } from 'react';
import { addMemoryEntry } from '../../lib/memory';

// ─── Types ─────────────────────────────────────────────────────────────────

type FeedItemType = 'comment' | 'task' | 'deal-update' | 'file' | 'mention' | 'system';
type TaskStatus = 'open' | 'in-progress' | 'done';

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string;
}

interface FeedItem {
  id: string;
  type: FeedItemType;
  authorId: string;
  content: string;
  entityLabel?: string;      // Deal name, goal title, etc.
  entityType?: 'deal' | 'goal' | 'metric' | 'report';
  createdAt: string;
  edited?: boolean;
  reactions?: Record<string, string[]>; // emoji → memberIds
  // For tasks
  taskStatus?: TaskStatus;
  assigneeId?: string;
  dueDate?: string;
}

// ─── Seed data ─────────────────────────────────────────────────────────────

const TEAM_MEMBERS: TeamMember[] = [
  { id: 'you',    name: 'You',           initials: 'ME', role: 'Principal',    color: 'bg-indigo-500' },
  { id: 'alex',   name: 'Alex Chen',     initials: 'AC', role: 'Deal Analyst', color: 'bg-sky-500' },
  { id: 'morgan', name: 'Morgan Lee',    initials: 'ML', role: 'CFO Advisor',  color: 'bg-violet-500' },
  { id: 'taylor', name: 'Taylor Brooks', initials: 'TB', role: 'Legal',        color: 'bg-emerald-500' },
];

function seedFeed(): FeedItem[] {
  const now = Date.now();
  return [
    {
      id: 'f1', type: 'deal-update', authorId: 'alex',
      content: 'Spoke with Rick at Apex HVAC — owner is motivated, wants to close before year-end tax event. Suggested we fast-track to LOI.',
      entityLabel: 'Apex HVAC Services', entityType: 'deal',
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'f2', type: 'task', authorId: 'you',
      content: 'Get QoE firm engaged for due diligence on Metro Staffing',
      entityLabel: 'Metro Staffing Group', entityType: 'deal',
      taskStatus: 'in-progress', assigneeId: 'morgan',
      dueDate: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'f3', type: 'comment', authorId: 'morgan',
      content: 'EBITDA margins look compressed due to owner compensation add-back. My recast puts normalized EBITDA at $420k vs the $380k stated. Still within our 4.8× target at $2.1M ask.',
      entityLabel: 'Industrial Clean Co', entityType: 'deal',
      createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      reactions: { '🔥': ['you'], '👍': ['alex', 'taylor'] },
    },
    {
      id: 'f4', type: 'task', authorId: 'taylor',
      content: 'Review SBA 7(a) docs and confirm buyer rep qualification for Apex HVAC',
      taskStatus: 'open', assigneeId: 'taylor',
      dueDate: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'f5', type: 'system', authorId: 'you',
      content: 'Apex HVAC Services moved from Screening → LOI',
      entityLabel: 'Apex HVAC Services', entityType: 'deal',
      createdAt: new Date(now - 36 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'f6', type: 'comment', authorId: 'alex',
      content: 'Just got off a call with Sunbelt Brokers — they have 3 new landscaping businesses in TX/FL range, sending CIMs this week. All mid-$400k EBITDA.',
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'f7', type: 'task', authorId: 'you',
      content: 'Build 100-day integration playbook template for post-close ops',
      taskStatus: 'open', assigneeId: 'you',
      dueDate: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMember(id: string): TeamMember {
  return TEAM_MEMBERS.find(m => m.id === id) ?? { id, name: 'Unknown', initials: '?', role: '', color: 'bg-slate-600' };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)     return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; cls: string; dot: string }> = {
  'open':        { label: 'Open',        cls: 'text-slate-400 bg-slate-800/60 border-slate-700/40', dot: 'bg-slate-500' },
  'in-progress': { label: 'In Progress', cls: 'text-amber-400 bg-amber-500/8 border-amber-500/20',  dot: 'bg-amber-400' },
  'done':        { label: 'Done',        cls: 'text-emerald-400 bg-emerald-500/8 border-emerald-500/20', dot: 'bg-emerald-400' },
};

const REACTIONS = ['👍', '🔥', '✅', '❓', '⚡'];

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ memberId, size = 'sm' }: { memberId: string; size?: 'sm' | 'md' }) {
  const m = getMember(memberId);
  const sizeClass = size === 'md' ? 'w-8 h-8 text-[12px]' : 'w-6 h-6 text-[10px]';
  return (
    <div className={`${sizeClass} rounded-full ${m.color} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {m.initials}
    </div>
  );
}

// ─── Feed Item Component ──────────────────────────────────────────────────────

function FeedCard({ item, onReact, onUpdateTask }: {
  item: FeedItem;
  onReact: (id: string, emoji: string) => void;
  onUpdateTask: (id: string, status: TaskStatus) => void;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const author = getMember(item.authorId);

  const isSystem = item.type === 'system';
  const isTask   = item.type === 'task';

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2">
        <div className="flex-1 h-px bg-slate-800/40"/>
        <div className="text-[11px] text-slate-600 whitespace-nowrap">{item.content}</div>
        <div className="flex-1 h-px bg-slate-800/40"/>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 py-3 px-4 group transition-colors hover:bg-slate-800/20 rounded-xl ${isTask ? 'bg-slate-900/30 border border-slate-800/40' : ''}`}>
      <Avatar memberId={item.authorId} size="md"/>
      <div className="flex-1 min-w-0">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-[12px] font-semibold text-slate-200">{author.name}</span>
          <span className="text-[10px] text-slate-600">{author.role}</span>
          {item.entityLabel && (
            <>
              <span className="text-slate-700 text-[10px]">·</span>
              <span className="text-[10px] text-sky-400/80">{item.entityLabel}</span>
            </>
          )}
          <span className="text-slate-700 text-[10px]">·</span>
          <span className="text-[10px] text-slate-600">{relativeTime(item.createdAt)}</span>
          {item.edited && <span className="text-[9px] text-slate-700">(edited)</span>}
        </div>

        {/* Content */}
        {isTask ? (
          <div className="space-y-2">
            <div className="text-[12px] text-slate-300 leading-relaxed">{item.content}</div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status selector */}
              <select
                value={item.taskStatus ?? 'open'}
                onChange={e => onUpdateTask(item.id, e.target.value as TaskStatus)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${TASK_STATUS_CONFIG[item.taskStatus ?? 'open'].cls} bg-transparent focus:outline-none cursor-pointer`}>
                {(['open','in-progress','done'] as TaskStatus[]).map(s => (
                  <option key={s} value={s} className="bg-slate-900">{TASK_STATUS_CONFIG[s].label}</option>
                ))}
              </select>
              {item.assigneeId && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Avatar memberId={item.assigneeId} size="sm"/>
                  <span>{getMember(item.assigneeId).name}</span>
                </div>
              )}
              {item.dueDate && (() => {
                const d = daysUntil(item.dueDate);
                return (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                    d < 0 ? 'text-red-400 bg-red-500/8 border-red-500/20'
                    : d <= 3 ? 'text-amber-400 bg-amber-500/8 border-amber-500/20'
                    : 'text-slate-500 bg-slate-800/40 border-slate-700/40'}`}>
                    {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Due today' : `Due in ${d}d`}
                  </span>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="text-[12px] text-slate-300 leading-relaxed">{item.content}</div>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {Object.entries(item.reactions ?? {}).map(([emoji, members]) => (
            members.length > 0 && (
              <button key={emoji} onClick={() => onReact(item.id, emoji)}
                className="flex items-center gap-1 text-[11px] bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 px-1.5 py-0.5 rounded-lg transition-all">
                {emoji} <span className="text-slate-400 text-[10px]">{members.length}</span>
              </button>
            )
          ))}
          <div className="relative">
            <button onClick={() => setShowReactions(v => !v)}
              className="opacity-0 group-hover:opacity-100 text-[11px] text-slate-600 hover:text-slate-400 transition-all bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 px-1.5 py-0.5 rounded-lg">
              + React
            </button>
            {showReactions && (
              <div className="absolute bottom-full mb-1 left-0 bg-[#0d1117] border border-slate-700/60 rounded-xl p-2 flex gap-1.5 shadow-xl z-10">
                {REACTIONS.map(e => (
                  <button key={e} onClick={() => { onReact(item.id, e); setShowReactions(false); }}
                    className="text-[16px] hover:scale-125 transition-transform">{e}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compose Box ──────────────────────────────────────────────────────────────

function ComposeBox({ onSubmit }: { onSubmit: (content: string, type: FeedItemType, assigneeId?: string, dueDate?: string) => void }) {
  const [content, setContent]     = useState('');
  const [type, setType]           = useState<FeedItemType>('comment');
  const [assignee, setAssignee]   = useState('you');
  const [due, setDue]             = useState('');
  const [showOpts, setShowOpts]   = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    if (!content.trim()) return;
    onSubmit(content.trim(), type, type === 'task' ? assignee : undefined, type === 'task' ? (due ? new Date(due).toISOString() : undefined) : undefined);
    setContent('');
    setDue('');
    setType('comment');
  };

  return (
    <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <Avatar memberId="you" size="md"/>
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onFocus={() => setShowOpts(true)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder={type === 'task' ? 'Describe the task…' : 'Add a comment, deal note, or update…'}
            rows={2}
            className="w-full bg-transparent text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none leading-relaxed"
          />
          {showOpts && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Type selector */}
              <div className="flex items-center gap-1 border border-slate-700/50 rounded-lg p-0.5 bg-slate-800/40">
                {(['comment', 'task', 'deal-update'] as FeedItemType[]).map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold capitalize transition-all ${
                      type === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t === 'deal-update' ? 'Deal Update' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              {type === 'task' && (
                <>
                  <select value={assignee} onChange={e => setAssignee(e.target.value)}
                    className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none">
                    {TEAM_MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input type="date" value={due} onChange={e => setDue(e.target.value)}
                    className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none"/>
                </>
              )}
              <button onClick={submit} disabled={!content.trim()}
                className="ml-auto px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-[11px] font-semibold transition-all">
                Post <span className="text-[9px] opacity-60">⌘↵</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task Board ───────────────────────────────────────────────────────────────

function TaskBoard({ items }: { items: FeedItem[] }) {
  const tasks = items.filter(i => i.type === 'task');
  if (tasks.length === 0) return null;

  const open       = tasks.filter(t => t.taskStatus === 'open');
  const inProgress = tasks.filter(t => t.taskStatus === 'in-progress');
  const done       = tasks.filter(t => t.taskStatus === 'done');

  const cols = [
    { label: 'Open',        tasks: open,       color: 'text-slate-400', dot: 'bg-slate-500' },
    { label: 'In Progress', tasks: inProgress, color: 'text-amber-400', dot: 'bg-amber-400' },
    { label: 'Done',        tasks: done,       color: 'text-emerald-400', dot: 'bg-emerald-400' },
  ];

  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4">
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Team Tasks</div>
      <div className="grid grid-cols-3 gap-3">
        {cols.map(col => (
          <div key={col.label}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`w-1.5 h-1.5 rounded-full ${col.dot}`}/>
              <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${col.color}`}>{col.label}</span>
              <span className="text-[10px] text-slate-600">{col.tasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.tasks.map(t => {
                const assignee = t.assigneeId ? getMember(t.assigneeId) : null;
                const due = t.dueDate ? daysUntil(t.dueDate) : null;
                return (
                  <div key={t.id} className="bg-slate-800/40 border border-slate-700/30 rounded-lg px-2.5 py-2">
                    <div className="text-[11px] text-slate-300 leading-snug line-clamp-2">{t.content}</div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {assignee && <Avatar memberId={assignee.id} size="sm"/>}
                      {due !== null && (
                        <span className={`text-[9px] font-medium ml-auto ${due < 0 ? 'text-red-400' : due <= 3 ? 'text-amber-400' : 'text-slate-600'}`}>
                          {due < 0 ? `${Math.abs(due)}d late` : due === 0 ? 'Today' : `${due}d`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {col.tasks.length === 0 && (
                <div className="text-[10px] text-slate-700 py-2 text-center">—</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TeamFeed() {
  const [items, setItems]         = useState<FeedItem[]>([]);
  const [showTasks, setShowTasks] = useState(false);
  const [filterMember, setFilterMember] = useState<string | 'all'>('all');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bos_team_feed');
      if (saved) setItems(JSON.parse(saved));
      else {
        const seeds = seedFeed();
        setItems(seeds);
        localStorage.setItem('bos_team_feed', JSON.stringify(seeds));
      }
    } catch { setItems(seedFeed()); }
  }, []);

  const persist = (next: FeedItem[]) => {
    setItems(next);
    try { localStorage.setItem('bos_team_feed', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const addItem = (content: string, type: FeedItemType, assigneeId?: string, dueDate?: string) => {
    const item: FeedItem = {
      id: `f-${Date.now()}`,
      type, authorId: 'you', content,
      createdAt: new Date().toISOString(),
      ...(type === 'task' ? { taskStatus: 'open', assigneeId, dueDate } : {}),
    };
    persist([item, ...items]);
    addMemoryEntry('decision', `Posted ${type}: "${content.slice(0, 60)}${content.length > 60 ? '…' : ''}"`);
  };

  const react = (id: string, emoji: string) => {
    persist(items.map(item => {
      if (item.id !== id) return item;
      const reactions = { ...(item.reactions ?? {}) };
      const members = reactions[emoji] ?? [];
      reactions[emoji] = members.includes('you')
        ? members.filter(m => m !== 'you')
        : [...members, 'you'];
      return { ...item, reactions };
    }));
  };

  const updateTaskStatus = (id: string, status: TaskStatus) => {
    persist(items.map(item => item.id === id ? { ...item, taskStatus: status } : item));
    if (status === 'done') {
      addMemoryEntry('decision', `Completed task: "${items.find(i => i.id === id)?.content?.slice(0, 60) ?? id}"`);
    }
  };

  const visible = items.filter(i =>
    (filterMember === 'all' || i.authorId === filterMember || i.assigneeId === filterMember)
  );

  const openTasks = items.filter(i => i.type === 'task' && i.taskStatus !== 'done');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[16px] font-bold text-slate-100">Team Feed</div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            {items.length} updates · {openTasks.length} open task{openTasks.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTasks(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
              showTasks ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300' : 'border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600'}`}>
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3">
              <path d="M2 6l2.5 2.5 5.5-5"/>
            </svg>
            Tasks {openTasks.length > 0 && <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">{openTasks.length}</span>}
          </button>
        </div>
      </div>

      {/* Team members filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setFilterMember('all')}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${filterMember === 'all' ? 'bg-slate-700/60 border-slate-600 text-slate-200' : 'border-slate-800/60 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}>
          All
        </button>
        {TEAM_MEMBERS.map(m => (
          <button key={m.id} onClick={() => setFilterMember(filterMember === m.id ? 'all' : m.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
              filterMember === m.id ? 'bg-slate-700/60 border-slate-600 text-slate-200' : 'border-slate-800/60 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}>
            <div className={`w-4 h-4 rounded-full ${m.color} flex items-center justify-center text-[8px] font-bold text-white`}>{m.initials}</div>
            <span>{m.name === 'You' ? 'You' : m.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Task board */}
      {showTasks && <TaskBoard items={items}/>}

      {/* Compose */}
      <ComposeBox onSubmit={addItem}/>

      {/* Feed */}
      <div className="bg-slate-900/40 border border-slate-800/40 rounded-2xl overflow-hidden divide-y divide-slate-800/30">
        {visible.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <div className="text-[13px] font-medium text-slate-500">No activity yet</div>
            <div className="text-[11px] mt-1">Post a comment or create a task above</div>
          </div>
        ) : (
          visible.map(item => (
            <FeedCard key={item.id} item={item} onReact={react} onUpdateTask={updateTaskStatus}/>
          ))
        )}
      </div>
    </div>
  );
}
