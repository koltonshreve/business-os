import type { Plan, PlanId, PlanLimits, AppSession } from '../types';

// ─── Plan Definitions ─────────────────────────────────────────────────────────

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 0,
    description: 'For solo founders getting their numbers in order',
    features: [
      'Financial dashboard',
      'Customer tracking',
      'CSV data import',
      '1 data snapshot',
      '5 AI queries/month',
      'Basic KPI grid',
    ],
    limits: {
      snapshots: 1,
      dataConnectors: 1,
      aiQueriesPerMonth: 5,
      automations: 0,
      teamMembers: 1,
    },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 29,
    description: 'For growing teams who need more insight and automation',
    badge: 'Most Popular',
    features: [
      'Everything in Starter',
      'Unlimited data snapshots',
      'Google Sheets + Stripe sync',
      'Deal pipeline (CRM)',
      '50 AI queries/month',
      '5 automations',
      'Weekly AI Intelligence Report',
      'Scenario modeling',
      'Team export (PDF/CSV)',
    ],
    limits: {
      snapshots: 999,
      dataConnectors: 3,
      aiQueriesPerMonth: 50,
      automations: 5,
      teamMembers: 5,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 79,
    description: 'For operators who want a full AI CFO layer',
    features: [
      'Everything in Growth',
      'Unlimited AI queries',
      'Unlimited automations',
      'Board deck generator',
      'Multi-entity support',
      'API access',
      'Priority support',
      'Custom KPI formulas',
      'Unlimited team members',
    ],
    limits: {
      snapshots: 999,
      dataConnectors: 999,
      aiQueriesPerMonth: 999,
      automations: 999,
      teamMembers: 999,
    },
  },
};

// ─── Feature Gates ────────────────────────────────────────────────────────────

export type GatedFeature =
  | 'multiple-snapshots'
  | 'google-sheets'
  | 'stripe-sync'
  | 'deal-pipeline'
  | 'automations'
  | 'weekly-report'
  | 'board-deck'
  | 'scenario-modeling'
  | 'api-access'
  | 'multi-entity';

const FEATURE_PLAN_MAP: Record<GatedFeature, PlanId> = {
  'multiple-snapshots': 'growth',
  'google-sheets': 'growth',
  'stripe-sync': 'growth',
  'deal-pipeline': 'growth',
  'automations': 'growth',
  'weekly-report': 'growth',
  'board-deck': 'pro',
  'scenario-modeling': 'growth',
  'api-access': 'pro',
  'multi-entity': 'pro',
};

const PLAN_RANK: Record<PlanId, number> = { starter: 0, growth: 1, pro: 2 };

export function canAccess(feature: GatedFeature, planId: PlanId): boolean {
  const required = FEATURE_PLAN_MAP[feature];
  return PLAN_RANK[planId] >= PLAN_RANK[required];
}

export function requiredPlan(feature: GatedFeature): Plan {
  return PLANS[FEATURE_PLAN_MAP[feature]];
}

// ─── Session Persistence ──────────────────────────────────────────────────────

const SESSION_KEY = 'bos_session';

export function loadSession(): AppSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppSession;
      // Reset monthly AI query count if needed
      const resetDate = new Date(s.aiQueriesResetAt);
      const now = new Date();
      if (now.getFullYear() !== resetDate.getFullYear() || now.getMonth() !== resetDate.getMonth()) {
        s.aiQueriesUsed = 0;
        s.aiQueriesResetAt = new Date().toISOString();
        saveSession(s);
      }
      return s;
    }
  } catch { /* ignore */ }
  return defaultSession();
}

export function saveSession(session: AppSession): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
}

export function defaultSession(): AppSession {
  return {
    planId: 'growth', // default to growth for demo purposes
    aiQueriesUsed: 0,
    aiQueriesResetAt: new Date().toISOString(),
    onboarded: false,
  };
}

export function incrementAIQuery(session: AppSession): AppSession {
  const updated = { ...session, aiQueriesUsed: session.aiQueriesUsed + 1 };
  saveSession(updated);
  return updated;
}

export function hasAIQueryBudget(session: AppSession): boolean {
  const limit = PLANS[session.planId].limits.aiQueriesPerMonth;
  return limit === 999 || session.aiQueriesUsed < limit;
}
