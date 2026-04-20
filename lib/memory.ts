// ─── Persistent memory + context system ──────────────────────────────────────
// Stores user history, AI query results, and key facts for recall.
// Acts as the "brain" that makes the AI feel aware of prior work.

export type MemoryCategory =
  | 'ai-query'
  | 'decision'
  | 'deal-action'
  | 'goal-update'
  | 'alert-dismissed'
  | 'report-generated'
  | 'data-connected'
  | 'insight';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  timestamp: string;       // ISO
  summary: string;         // short human-readable label
  detail?: string;         // longer context or AI response excerpt
  entityId?: string;       // deal ID, goal ID, etc.
  entityType?: 'deal' | 'goal' | 'report' | 'metric';
  tags?: string[];
}

export interface ContextFact {
  key: string;             // e.g. 'acquisition-target-multiple', 'primary-industry'
  value: string;
  source: 'onboarding' | 'ai-query' | 'user-set' | 'inferred';
  updatedAt: string;
}

export interface AppMemory {
  entries: MemoryEntry[];         // rolling timeline, capped at 200
  facts: Record<string, ContextFact>;  // key → fact
  lastActiveAt: string;
  sessionCount: number;
}

const KEY = 'bos_memory';

// ─── Load / save ──────────────────────────────────────────────────────────────

export function loadMemory(): AppMemory {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppMemory;
  } catch { /* ignore */ }
  return { entries: [], facts: {}, lastActiveAt: new Date().toISOString(), sessionCount: 1 };
}

export function saveMemory(m: AppMemory): void {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

// ─── Add an entry ─────────────────────────────────────────────────────────────

export function addMemoryEntry(
  category: MemoryCategory,
  summary: string,
  opts: Partial<Omit<MemoryEntry, 'id' | 'category' | 'timestamp' | 'summary'>> = {}
): void {
  const mem = loadMemory();
  const entry: MemoryEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category,
    timestamp: new Date().toISOString(),
    summary,
    ...opts,
  };
  // Prepend and cap at 200
  mem.entries = [entry, ...mem.entries].slice(0, 200);
  mem.lastActiveAt = new Date().toISOString();
  saveMemory(mem);
}

// ─── Update a context fact ────────────────────────────────────────────────────

export function setContextFact(
  key: string,
  value: string,
  source: ContextFact['source'] = 'user-set'
): void {
  const mem = loadMemory();
  mem.facts[key] = { key, value, source, updatedAt: new Date().toISOString() };
  saveMemory(mem);
}

// ─── Build AI context string ──────────────────────────────────────────────────
// Called before any AI request to inject memory as context.

export function buildAIContext(): string {
  const mem = loadMemory();
  const parts: string[] = [];

  // Key facts
  const facts = Object.values(mem.facts);
  if (facts.length > 0) {
    parts.push('USER CONTEXT:\n' + facts.map(f => `- ${f.key}: ${f.value}`).join('\n'));
  }

  // Recent activity (last 10 entries)
  const recent = mem.entries.slice(0, 10);
  if (recent.length > 0) {
    parts.push(
      'RECENT ACTIVITY:\n' +
      recent.map(e => `- [${new Date(e.timestamp).toLocaleDateString()}] ${e.summary}`).join('\n')
    );
  }

  return parts.join('\n\n');
}

// ─── Get entries by category ──────────────────────────────────────────────────

export function getEntriesByCategory(category: MemoryCategory, limit = 20): MemoryEntry[] {
  const mem = loadMemory();
  return mem.entries.filter(e => e.category === category).slice(0, limit);
}

// ─── Clear memory ─────────────────────────────────────────────────────────────

export function clearMemory(): void {
  saveMemory({ entries: [], facts: {}, lastActiveAt: new Date().toISOString(), sessionCount: 0 });
}

// ─── Tick session count ───────────────────────────────────────────────────────

export function tickSession(): void {
  const mem = loadMemory();
  mem.sessionCount += 1;
  mem.lastActiveAt = new Date().toISOString();
  saveMemory(mem);
}
