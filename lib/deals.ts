// ─── M&A Deal Flow — Core Data Model ──────────────────────────────────────────
// This is the M&A / acquisition DEAL FLOW system (sourcing → LOI → closing).
// Used by: components/deals/DealList.tsx, components/deals/DailyPriorities.tsx
// localStorage key: 'bos_deals_v2'
//
// ⚠  DO NOT CONFUSE WITH THE OTHER DEAL SYSTEMS IN THIS APP:
//   • 'bos_deals'      → CRM sales pipeline (KanbanBoard.tsx, types/index.ts Deal)
//                        Stages: lead, qualified, proposal, negotiation, closed-won/lost
//                        Fields: value, probability, closeDate, contactName, company
//   • 'bos_acq_targets'→ Acquisition targets (AcquisitionPipeline.tsx)
//                        Stages: sourcing, screening, loi, due-diligence, closing, integration
//                        Fields: revenue, ebitda, askingPrice, multiple, thesisMatch
//
// These three systems have overlapping stage names (loi, closing, closed-won) but
// represent fundamentally different workflows and data shapes. Never cross-read keys.

export type DealStage =
  | 'sourcing'
  | 'contacted'
  | 'nda'
  | 'cim'
  | 'loi'
  | 'due-diligence'
  | 'closing'
  | 'closed-won'
  | 'closed-lost'
  | 'passed';

export const STAGE_ORDER: DealStage[] = [
  'sourcing', 'contacted', 'nda', 'cim', 'loi',
  'due-diligence', 'closing', 'closed-won', 'closed-lost', 'passed',
];

export const STAGE_LABEL: Record<DealStage, string> = {
  'sourcing':       'Sourcing',
  'contacted':      'Contacted',
  'nda':            'NDA',
  'cim':            'CIM Review',
  'loi':            'LOI',
  'due-diligence':  'Due Diligence',
  'closing':        'Closing',
  'closed-won':     'Closed',
  'closed-lost':    'Dead',
  'passed':         'Passed',
};

export const STAGE_COLOR: Record<DealStage, { bg: string; text: string; border: string; dot: string }> = {
  'sourcing':       { bg: 'bg-slate-800/60',     text: 'text-slate-400',    border: 'border-slate-700/50',   dot: 'bg-slate-500' },
  'contacted':      { bg: 'bg-blue-500/10',      text: 'text-blue-400',     border: 'border-blue-500/25',    dot: 'bg-blue-400' },
  'nda':            { bg: 'bg-indigo-500/10',    text: 'text-indigo-400',   border: 'border-indigo-500/25',  dot: 'bg-indigo-400' },
  'cim':            { bg: 'bg-violet-500/10',    text: 'text-violet-400',   border: 'border-violet-500/25',  dot: 'bg-violet-400' },
  'loi':            { bg: 'bg-amber-500/10',     text: 'text-amber-400',    border: 'border-amber-500/25',   dot: 'bg-amber-400' },
  'due-diligence':  { bg: 'bg-orange-500/10',    text: 'text-orange-400',   border: 'border-orange-500/25',  dot: 'bg-orange-400' },
  'closing':        { bg: 'bg-emerald-500/10',   text: 'text-emerald-400',  border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  'closed-won':     { bg: 'bg-green-500/15',     text: 'text-green-400',    border: 'border-green-500/30',   dot: 'bg-green-500' },
  'closed-lost':    { bg: 'bg-red-500/8',        text: 'text-red-400',      border: 'border-red-500/20',     dot: 'bg-red-500' },
  'passed':         { bg: 'bg-slate-800/30',     text: 'text-slate-600',    border: 'border-slate-800/40',   dot: 'bg-slate-700' },
};

// Active = not terminal stage
export function isActiveDeal(stage: DealStage) {
  return !['closed-won', 'closed-lost', 'passed'].includes(stage);
}

// ── Sub-objects ───────────────────────────────────────────────────────────────

export interface DealNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface DealTask {
  id: string;
  title: string;
  dueDate?: string;
  done: boolean;
  doneAt?: string;
  createdAt: string;
}

export type TimelineEventType =
  | 'deal_created'
  | 'stage_changed'
  | 'note_added'
  | 'task_completed'
  | 'action_logged'
  | 'field_updated'
  | 'next_action_set';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  detail?: string;
  createdAt: string;
}

// ── Value Creation Tracking ───────────────────────────────────────────────────

export interface ValueInitiative {
  id: string;
  title: string;
  status: 'planned' | 'in-progress' | 'completed';
  estimatedImpact?: string;   // e.g. "+$50k EBITDA"
  completedAt?: string;
  createdAt: string;
}

export interface ValueSnapshot {
  id: string;
  date: string;               // ISO date
  label: string;              // e.g. "Month 6"
  revenue?: number;
  ebitda?: number;
  headcount?: number;
  notes?: string;
}

export interface DealValueTracking {
  // Baseline at time of acquisition
  baselineRevenue?: number;
  baselineEbitda?: number;
  baselineHeadcount?: number;
  acquisitionDate?: string;   // ISO date

  // Initiatives tracked post-acquisition
  initiatives: ValueInitiative[];

  // Periodic snapshots to track progress
  snapshots: ValueSnapshot[];
}

// ── Primary Deal object ───────────────────────────────────────────────────────

export interface Deal {
  id: string;
  name: string;
  stage: DealStage;

  // Business profile
  industry?: string;
  location?: string;
  description?: string;
  employees?: number;
  yearFounded?: number;

  // Financials
  revenue?: number;
  ebitda?: number;
  sde?: number;           // Seller's Discretionary Earnings
  askingPrice?: number;

  // Contact
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  brokerName?: string;
  brokerFirm?: string;

  // Deal mechanics
  source?: string;        // BizBuySell, broker outreach, direct, etc.
  nextAction?: string;
  nextActionDate?: string; // ISO date string (YYYY-MM-DD)
  loiDate?: string;
  closingDate?: string;

  // Meta
  starred: boolean;

  // Rich data (arrays of sub-objects)
  notes: DealNote[];
  tasks: DealTask[];
  timeline: TimelineEvent[];

  // Post-acquisition value creation tracking (optional, set when closed)
  valueTracking?: DealValueTracking;

  createdAt: string;
  updatedAt: string;
}

// ── Derived helpers ───────────────────────────────────────────────────────────

export function impliedMultiple(deal: Deal): number | null {
  const denominator = deal.ebitda ?? deal.sde ?? null;
  if (!denominator || !deal.askingPrice) return null;
  return deal.askingPrice / denominator;
}

export function daysUntilAction(deal: Deal): number | null {
  if (!deal.nextActionDate) return null;
  const diff = new Date(deal.nextActionDate).getTime() - new Date().setHours(0,0,0,0);
  return Math.ceil(diff / 86400000);
}

export function actionStatus(deal: Deal): 'overdue' | 'today' | 'upcoming' | 'none' {
  const d = daysUntilAction(deal);
  if (d === null) return 'none';
  if (d < 0) return 'overdue';
  if (d === 0) return 'today';
  return 'upcoming';
}

// ── Sort helpers ──────────────────────────────────────────────────────────────

export function sortDealsByUrgency(deals: Deal[]): Deal[] {
  return [...deals].sort((a, b) => {
    // Terminal stages sink to bottom
    const aActive = isActiveDeal(a.stage) ? 0 : 1;
    const bActive = isActiveDeal(b.stage) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;

    // Overdue → today → no action → upcoming
    const aStatus = actionStatus(a);
    const bStatus = actionStatus(b);
    const rank = { overdue: 0, today: 1, none: 2, upcoming: 3 };
    if (rank[aStatus] !== rank[bStatus]) return rank[aStatus] - rank[bStatus];

    // Within overdue/today: most overdue first
    if (aStatus === 'overdue' || aStatus === 'today') {
      const aD = daysUntilAction(a) ?? 0;
      const bD = daysUntilAction(b) ?? 0;
      return aD - bD;
    }

    // Otherwise: stage (advanced first)
    const aIdx = STAGE_ORDER.indexOf(a.stage);
    const bIdx = STAGE_ORDER.indexOf(b.stage);
    return bIdx - aIdx;
  });
}

// ── localStorage persistence ──────────────────────────────────────────────────

const KEY = 'bos_deals_v2';

export function loadDeals(): Deal[] {
  if (typeof window === 'undefined') return SEED_DEALS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Deal[];
  } catch { /* ignore */ }
  return SEED_DEALS;
}

export function saveDeals(deals: Deal[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(deals)); } catch { /* ignore */ }
}

// ── Mutation helpers ──────────────────────────────────────────────────────────

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createDeal(input: Partial<Deal> & { name: string }): Deal {
  const now = new Date().toISOString();
  const { notes, tasks, timeline, ...rest } = input;
  return {
    id: `deal_${uid()}`,
    starred: false,
    createdAt: now,
    updatedAt: now,
    ...rest,
    stage: rest.stage ?? 'sourcing',
    notes: notes ?? [],
    tasks: tasks ?? [],
    timeline: timeline ?? [{
      id: `evt_${uid()}`,
      type: 'deal_created' as TimelineEventType,
      title: 'Deal added to pipeline',
      createdAt: now,
    }],
  };
}

export function updateDeal(deal: Deal, patch: Partial<Deal>, eventTitle?: string): Deal {
  const now = new Date().toISOString();
  const timeline = eventTitle
    ? [...deal.timeline, { id: `evt_${uid()}`, type: 'field_updated' as TimelineEventType, title: eventTitle, createdAt: now }]
    : deal.timeline;
  return { ...deal, ...patch, timeline, updatedAt: now };
}

export function changeDealStage(deal: Deal, stage: DealStage): Deal {
  const now = new Date().toISOString();
  return {
    ...deal,
    stage,
    updatedAt: now,
    timeline: [...deal.timeline, {
      id: `evt_${uid()}`,
      type: 'stage_changed',
      title: `Moved to ${STAGE_LABEL[stage]}`,
      createdAt: now,
    }],
  };
}

export function addNote(deal: Deal, content: string): Deal {
  const now = new Date().toISOString();
  const note: DealNote = { id: `note_${uid()}`, content, createdAt: now };
  return {
    ...deal,
    notes: [note, ...deal.notes],
    updatedAt: now,
    timeline: [...deal.timeline, {
      id: `evt_${uid()}`,
      type: 'note_added',
      title: 'Note added',
      detail: content.slice(0, 80) + (content.length > 80 ? '…' : ''),
      createdAt: now,
    }],
  };
}

export function addTask(deal: Deal, title: string, dueDate?: string): Deal {
  const now = new Date().toISOString();
  const task: DealTask = { id: `task_${uid()}`, title, dueDate, done: false, createdAt: now };
  return { ...deal, tasks: [...deal.tasks, task], updatedAt: now };
}

export function completeTask(deal: Deal, taskId: string): Deal {
  const now = new Date().toISOString();
  const task = deal.tasks.find(t => t.id === taskId);
  return {
    ...deal,
    tasks: deal.tasks.map(t => t.id === taskId ? { ...t, done: true, doneAt: now } : t),
    updatedAt: now,
    timeline: [...deal.timeline, {
      id: `evt_${uid()}`,
      type: 'task_completed',
      title: 'Task completed',
      detail: task?.title,
      createdAt: now,
    }],
  };
}

export function setNextAction(deal: Deal, action: string, date?: string): Deal {
  const now = new Date().toISOString();
  return {
    ...deal,
    nextAction: action,
    nextActionDate: date,
    updatedAt: now,
    timeline: [...deal.timeline, {
      id: `evt_${uid()}`,
      type: 'next_action_set',
      title: 'Next action set',
      detail: action + (date ? ` — due ${date}` : ''),
      createdAt: now,
    }],
  };
}

export function logAction(deal: Deal, note: string): Deal {
  const now = new Date().toISOString();
  return {
    ...deal,
    updatedAt: now,
    timeline: [...deal.timeline, {
      id: `evt_${uid()}`,
      type: 'action_logged',
      title: note,
      createdAt: now,
    }],
  };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtMoney(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtActionDate(iso?: string): string {
  if (!iso) return '—';
  const days = daysUntilAction({ nextActionDate: iso } as Deal);
  if (days === null) return '—';
  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days === -1) return 'Yesterday';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days}d`;
  return fmtDate(iso);
}

// ── Seed data ─────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}
function daysFrom(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString().split('T')[0];
}
function daysAgoDate(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
}

export const SEED_DEALS: Deal[] = [
  {
    id: 'seed_1',
    name: 'Midwest HVAC Services',
    stage: 'loi',
    industry: 'HVAC / Mechanical',
    location: 'Columbus, OH',
    revenue: 2800000,
    ebitda: 420000,
    sde: 510000,
    askingPrice: 2100000,
    employees: 18,
    yearFounded: 2009,
    source: 'BizBuySell — LINK Business Brokers',
    brokerName: 'Dave Hoffman',
    brokerFirm: 'LINK Business Brokers',
    contactName: 'Ron Kowalski',
    contactEmail: 'ron@midwesthvac.example.com',
    contactPhone: '(614) 555-0142',
    description: 'Residential and light commercial HVAC service and installation. 85% repeat customers. 3 service vans. Active service contracts provide ~$180k recurring annually.',
    nextAction: 'Review exclusivity clause — extend from 45 to 60 days',
    nextActionDate: daysAgoDate(2),
    starred: true,
    notes: [
      {
        id: 'n1a',
        content: 'Met with Ron (owner) for 2hr call. Motivated to close by Q2 — divorce situation, wants clean exit. Firm on no earnout. Open to 10–15% seller note. Says a competitor offered $1.85M in 2023.',
        createdAt: daysAgo(5),
      },
      {
        id: 'n1b',
        content: 'Received LOI draft from broker. Price at $2.1M (4.1x EBITDA / 5.0x SDE) is fair for this market. Issue: exclusivity clause is 45 days — our DD will take 60 minimum. Need to push back on this before signing.',
        createdAt: daysAgo(1),
      },
    ],
    tasks: [
      { id: 't1a', title: 'Review LOI draft with attorney — flag exclusivity clause', done: false, dueDate: daysFrom(1), createdAt: daysAgo(1) },
      { id: 't1b', title: 'Request 3 years tax returns + P&Ls', done: false, dueDate: daysFrom(3), createdAt: daysAgo(1) },
      { id: 't1c', title: 'Confirm SBA lender pre-qualification', done: true, doneAt: daysAgo(3), createdAt: daysAgo(5) },
      { id: 't1d', title: 'Order QoE (Quality of Earnings) — Midview Advisors', done: false, dueDate: daysFrom(5), createdAt: daysAgo(1) },
    ],
    timeline: [
      { id: 'e1a', type: 'deal_created',  title: 'Deal added to pipeline', createdAt: daysAgo(14) },
      { id: 'e1b', type: 'stage_changed', title: 'Moved to Contacted', detail: 'Called Dave Hoffman, scheduled intro call', createdAt: daysAgo(12) },
      { id: 'e1c', type: 'stage_changed', title: 'Moved to NDA', detail: 'Signed mutual NDA, requested CIM', createdAt: daysAgo(10) },
      { id: 'e1d', type: 'stage_changed', title: 'Moved to CIM Review', detail: 'Received 47-page CIM', createdAt: daysAgo(8) },
      { id: 'e1e', type: 'task_completed', title: 'Task completed', detail: 'Confirm SBA lender pre-qualification', createdAt: daysAgo(3) },
      { id: 'e1f', type: 'note_added',    title: 'Note added', detail: 'Met with Ron — motivated seller, no earnout', createdAt: daysAgo(5) },
      { id: 'e1g', type: 'stage_changed', title: 'Moved to LOI', detail: 'Submitted LOI at $2.1M / 5× SDE', createdAt: daysAgo(3) },
      { id: 'e1h', type: 'note_added',    title: 'Note added', detail: 'Received LOI draft back — exclusivity issue', createdAt: daysAgo(1) },
    ],
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
  },
  {
    id: 'seed_2',
    name: 'Southwest Landscaping Group',
    stage: 'due-diligence',
    industry: 'Landscaping / Property Services',
    location: 'Phoenix, AZ',
    revenue: 3400000,
    ebitda: 510000,
    sde: 590000,
    askingPrice: 2800000,
    employees: 24,
    yearFounded: 2005,
    source: 'Direct outreach via LinkedIn',
    contactName: 'Maria Delgado',
    contactEmail: 'mdelgado@swlandscaping.example.com',
    contactPhone: '(602) 555-0291',
    description: 'Commercial landscaping and property maintenance. 80% recurring HOA/commercial contracts. Owner has agreed to 12-month transition. Clean books, outsourced accounting.',
    nextAction: 'Schedule site visit and equipment walkthrough',
    nextActionDate: daysFrom(1),
    starred: true,
    notes: [
      {
        id: 'n2a',
        content: 'QoE report received. Revenue is clean — 82% from multi-year contracts. One customer (Sunbelt HOA) is 22% of revenue, needs risk mitigation in APA. EBITDA confirmed at $510k.',
        createdAt: daysAgo(4),
      },
      {
        id: 'n2b',
        content: 'Spoke with Maria about equipment. 3 trucks are 2021+, 2 are 2018. She owns the commercial sprayer outright ($85k replacement value). Factor into asset schedule.',
        createdAt: daysAgo(2),
      },
    ],
    tasks: [
      { id: 't2a', title: 'Schedule site visit and equipment walkthrough', done: false, dueDate: daysFrom(1), createdAt: daysAgo(3) },
      { id: 't2b', title: 'Review customer contracts — concentration risk', done: false, dueDate: daysFrom(4), createdAt: daysAgo(3) },
      { id: 't2c', title: 'Confirm LOI exclusivity period — expires in 18 days', done: false, dueDate: daysFrom(2), createdAt: daysAgo(1) },
      { id: 't2d', title: 'Receive QoE report from Midview Advisors', done: true, doneAt: daysAgo(4), createdAt: daysAgo(7) },
    ],
    timeline: [
      { id: 'e2a', type: 'deal_created',  title: 'Deal added to pipeline', createdAt: daysAgo(21) },
      { id: 'e2b', type: 'stage_changed', title: 'Moved to Contacted', createdAt: daysAgo(19) },
      { id: 'e2c', type: 'stage_changed', title: 'Moved to NDA', createdAt: daysAgo(17) },
      { id: 'e2d', type: 'stage_changed', title: 'Moved to CIM Review', createdAt: daysAgo(14) },
      { id: 'e2e', type: 'stage_changed', title: 'Moved to LOI', detail: 'Submitted LOI at $2.8M', createdAt: daysAgo(10) },
      { id: 'e2f', type: 'stage_changed', title: 'Moved to Due Diligence', detail: 'LOI executed, exclusivity running', createdAt: daysAgo(6) },
      { id: 'e2g', type: 'task_completed', title: 'Task completed', detail: 'Receive QoE report', createdAt: daysAgo(4) },
      { id: 'e2h', type: 'note_added',    title: 'Note added', detail: 'QoE confirmed — revenue clean, 82% recurring', createdAt: daysAgo(4) },
    ],
    createdAt: daysAgo(21),
    updatedAt: daysAgo(2),
  },
  {
    id: 'seed_3',
    name: 'Gulf Coast Pool Services',
    stage: 'nda',
    industry: 'Pool Service / Maintenance',
    location: 'Tampa, FL',
    revenue: 1200000,
    ebitda: 195000,
    sde: 240000,
    askingPrice: 960000,
    employees: 8,
    yearFounded: 2014,
    source: 'BizBuySell — Transworld Business Advisors',
    brokerName: 'Chris Palmer',
    brokerFirm: 'Transworld Business Advisors',
    contactName: 'Steve Nguyen',
    description: '95% residential recurring pool maintenance. Owner-operator. Very clean route density (Tampa Bay area only). Low CAPEX — chemicals + trucks.',
    nextAction: 'Review NDA and request CIM',
    nextActionDate: daysFrom(3),
    starred: false,
    notes: [
      {
        id: 'n3a',
        content: 'Initial call with broker Chris. Owner has run it solo + 3 part-time techs. Looking for all-cash deal. $960k asking = 4.0× SDE which is aggressive for owner-operator risk. Counter at $840k.',
        createdAt: daysAgo(3),
      },
    ],
    tasks: [
      { id: 't3a', title: 'Sign NDA and request CIM package', done: false, dueDate: daysFrom(3), createdAt: daysAgo(3) },
      { id: 't3b', title: 'Research Tampa pool service comps on BizBuySell', done: true, doneAt: daysAgo(2), createdAt: daysAgo(3) },
    ],
    timeline: [
      { id: 'e3a', type: 'deal_created',  title: 'Deal added to pipeline', createdAt: daysAgo(5) },
      { id: 'e3b', type: 'stage_changed', title: 'Moved to Contacted', detail: 'Intro call with broker Chris Palmer', createdAt: daysAgo(4) },
      { id: 'e3c', type: 'stage_changed', title: 'Moved to NDA', detail: 'Broker sent NDA', createdAt: daysAgo(3) },
      { id: 'e3d', type: 'note_added',    title: 'Note added', detail: 'Broker call — all-cash, $960k ask', createdAt: daysAgo(3) },
      { id: 'e3e', type: 'task_completed', title: 'Task completed', detail: 'Research Tampa pool service comps', createdAt: daysAgo(2) },
    ],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(2),
  },
  {
    id: 'seed_4',
    name: 'Pacific Coast Plumbing',
    stage: 'cim',
    industry: 'Plumbing / Mechanical',
    location: 'San Diego, CA',
    revenue: 1900000,
    ebitda: 285000,
    sde: 340000,
    askingPrice: 1400000,
    employees: 12,
    yearFounded: 2011,
    source: 'IBBA Member Broker — R&R Business Advisors',
    brokerName: 'Liz Torres',
    brokerFirm: 'R&R Business Advisors',
    description: 'Residential plumbing service and repair. Strong Yelp/Google presence — 4.8 stars, 420 reviews. 70% repeat/referral. Owner retiring after 13 years.',
    nextAction: 'Request Q2 2026 P&L and updated customer list',
    nextActionDate: daysFrom(5),
    starred: false,
    notes: [
      {
        id: 'n4a',
        content: 'CIM received. Financials look clean, margin is consistent at ~15%. California comps typically 4–5× SDE so $1.4M asking (4.1× SDE) is reasonable. Main risk: owner is the brand — need to see how referral network transfers.',
        createdAt: daysAgo(2),
      },
    ],
    tasks: [
      { id: 't4a', title: 'Request Q2 2026 P&L and customer concentration data', done: false, dueDate: daysFrom(5), createdAt: daysAgo(2) },
      { id: 't4b', title: 'Schedule call with owner to discuss transition plan', done: false, dueDate: daysFrom(8), createdAt: daysAgo(2) },
    ],
    timeline: [
      { id: 'e4a', type: 'deal_created',  title: 'Deal added to pipeline', createdAt: daysAgo(9) },
      { id: 'e4b', type: 'stage_changed', title: 'Moved to Contacted', createdAt: daysAgo(8) },
      { id: 'e4c', type: 'stage_changed', title: 'Moved to NDA', createdAt: daysAgo(7) },
      { id: 'e4d', type: 'stage_changed', title: 'Moved to CIM Review', detail: 'Received CIM package', createdAt: daysAgo(5) },
      { id: 'e4e', type: 'note_added',    title: 'Note added', detail: 'CIM review — clean 15% margins, $1.4M asking', createdAt: daysAgo(2) },
    ],
    createdAt: daysAgo(9),
    updatedAt: daysAgo(2),
  },
  {
    id: 'seed_5',
    name: 'Great Plains Auto Repair',
    stage: 'contacted',
    industry: 'Auto Service / Repair',
    location: 'Omaha, NE',
    revenue: 850000,
    ebitda: 128000,
    sde: 175000,
    employees: 6,
    yearFounded: 2007,
    source: 'BizBuySell',
    brokerName: 'Terry Walsh',
    brokerFirm: 'Sunbelt Business Brokers',
    description: 'General auto repair shop. ASE-certified technicians. Strong local reputation. Owner has been approached before but not ready to sell until now.',
    nextAction: 'Follow up with broker Terry Walsh — 2nd call to discuss financials',
    nextActionDate: daysFrom(7),
    starred: false,
    notes: [],
    tasks: [
      { id: 't5a', title: 'Schedule second call with broker Terry Walsh', done: false, dueDate: daysFrom(7), createdAt: daysAgo(1) },
    ],
    timeline: [
      { id: 'e5a', type: 'deal_created',  title: 'Deal added to pipeline', createdAt: daysAgo(3) },
      { id: 'e5b', type: 'stage_changed', title: 'Moved to Contacted', detail: 'Left voicemail for broker, received call back', createdAt: daysAgo(1) },
    ],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
  },
  {
    id: 'seed_6',
    name: 'Mountain States IT Services',
    stage: 'sourcing',
    industry: 'Managed IT Services',
    location: 'Denver, CO',
    revenue: undefined,
    ebitda: undefined,
    source: 'Direct outreach — LinkedIn',
    description: 'MSP with strong SMB client base in Denver metro. Identified via LinkedIn. Owner posted that he\'s "considering options." No asking price yet.',
    nextAction: 'Send intro email and request NDA',
    nextActionDate: undefined,
    starred: false,
    notes: [],
    tasks: [
      { id: 't6a', title: 'Draft intro email and send to owner', done: false, createdAt: daysAgo(0) },
    ],
    timeline: [
      { id: 'e6a', type: 'deal_created', title: 'Deal added to pipeline', createdAt: daysAgo(1) },
    ],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];
