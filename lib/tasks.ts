// ─── Task Execution Engine ────────────────────────────────────────────────────
// The system of record for everything that needs to happen.
// Tasks are created by AI (from rules) or by users.
// Completion triggers events that feed back into the system.

export type TaskPriority = 'p1' | 'p2' | 'p3';
export type TaskStatus   = 'open' | 'active' | 'done' | 'blocked' | 'dismissed';
export type TaskCreator  = 'ai' | 'user';

export interface Task {
  id:           string;
  title:        string;
  context?:     string;     // why this matters
  impact?:      string;     // what happens if not done
  priority:     TaskPriority;
  status:       TaskStatus;
  created_by:   TaskCreator;
  trigger_id?:  string;     // which rule fired this
  entity_type?: 'deal' | 'goal' | 'metric' | 'company';
  entity_id?:   string;
  entity_name?: string;
  assignee:     string;
  due_date?:    string;
  completed_at?: string;
  snoozed_until?: string;
  metadata:     Record<string, unknown>;
  created_at:   string;
  updated_at:   string;
}

export type CreateTaskInput = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'metadata'> & {
  metadata?: Record<string, unknown>;
};

// ─── API helpers ──────────────────────────────────────────────────────────────

export async function fetchTasks(filter?: {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority;
}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filter?.status) {
    const s = Array.isArray(filter.status) ? filter.status.join(',') : filter.status;
    params.set('status', s);
  }
  if (filter?.priority) params.set('priority', filter.priority);

  const res = await fetch(`/api/tasks?${params}`);
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function createTask(input: Partial<CreateTaskInput> & { title: string }): Promise<Task> {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priority: 'p2',
      status: 'open',
      created_by: 'user',
      assignee: 'you',
      metadata: {},
      ...input,
    }),
  });
  if (!res.ok) throw new Error('Failed to create task');
  return res.json();
}

export async function updateTask(id: string, patch: Partial<Pick<Task, 'status' | 'priority' | 'assignee' | 'due_date' | 'title' | 'context' | 'snoozed_until'>>): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

export async function completeTask(id: string): Promise<Task> {
  return updateTask(id, { status: 'done' });
}

export async function dismissTask(id: string): Promise<Task> {
  return updateTask(id, { status: 'dismissed' });
}

// ─── Priority labels ──────────────────────────────────────────────────────────

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  p1: 'Critical',
  p2: 'High',
  p3: 'Normal',
};

export const PRIORITY_COLOR: Record<TaskPriority, { dot: string; text: string; bg: string; border: string }> = {
  p1: { dot: 'bg-red-500',     text: 'text-red-300',    bg: 'bg-red-500/8',    border: 'border-red-500/20' },
  p2: { dot: 'bg-amber-400',   text: 'text-amber-300',  bg: 'bg-amber-500/8',  border: 'border-amber-500/20' },
  p3: { dot: 'bg-slate-500',   text: 'text-slate-400',  bg: 'bg-slate-800/40', border: 'border-slate-700/40' },
};
