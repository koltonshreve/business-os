// ─── Event-Driven Rule Engine ─────────────────────────────────────────────────
// Rules evaluate live data and fire tasks when conditions are met.
// Each rule fires at most once per day per entity (deduped server-side).
// This is what makes the system feel like it "runs itself."

import type { UnifiedBusinessData } from '../types';
import type { CreateTaskInput } from './tasks';

export interface Rule {
  id:            string;
  name:          string;
  description:   string;
  cooldownDays:  number;   // minimum days between firings
  evaluate: (data: UnifiedBusinessData, extra?: RuleContext) => RuleFiring | null;
}

export interface RuleFiring {
  ruleId:  string;
  task:    Omit<CreateTaskInput, 'id' | 'created_at' | 'updated_at'>;
}

export interface RuleContext {
  acqTargets?: { id: string; name: string; stage: string; nextActionDate?: string; ebitda?: number; askingPrice?: number }[];
  goals?: { id: string; title: string; status: string; current: number; target: number; dueDate?: string }[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtN(n: number) {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
}

function daysUntil(iso?: string) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

// ─── Rule Definitions ─────────────────────────────────────────────────────────

export const RULES: Rule[] = [

  // ── Cash ──────────────────────────────────────────────────────────────────

  {
    id: 'cash-critical',
    name: 'Cash runway critical',
    description: 'Fires when cash runway drops below 3 months',
    cooldownDays: 1,
    evaluate(data) {
      const cf = data.cashFlow ?? [];
      if (!cf.length) return null;
      const cash = cf[cf.length - 1].closingBalance;
      const avgBurn = cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / cf.length;
      if (avgBurn >= 0) return null;
      const runway = Math.abs(cash / avgBurn);
      if (runway >= 3) return null;
      return {
        ruleId: this.id,
        task: {
          title: `Cash runway at ${runway.toFixed(1)} months — activate credit line`,
          context: `${fmtN(cash)} on hand. At current burn rate, operations stop in ${runway.toFixed(1)} months.`,
          impact: 'Without action, unable to fund operations or close acquisitions',
          priority: 'p1',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'metric',
          entity_name: 'Cash Runway',
          assignee: 'you',
          recurrence: 'none',
          metadata: { runway, cash },
        },
      };
    },
  },

  {
    id: 'cash-watch',
    name: 'Cash runway below 6 months',
    description: 'Fires when cash runway is 3–6 months',
    cooldownDays: 3,
    evaluate(data) {
      const cf = data.cashFlow ?? [];
      if (!cf.length) return null;
      const cash = cf[cf.length - 1].closingBalance;
      const avgBurn = cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / cf.length;
      if (avgBurn >= 0) return null;
      const runway = Math.abs(cash / avgBurn);
      if (runway < 3 || runway >= 6) return null;
      return {
        ruleId: this.id,
        task: {
          title: `Open a business line of credit — ${runway.toFixed(1)}mo runway`,
          context: `${fmtN(cash)} cash, burning ${fmtN(Math.abs(avgBurn * 4.33))}/wk. SBA lenders want 3+ months post-close.`,
          impact: 'Tight runway limits deal flexibility and creates negotiating weakness',
          priority: 'p2',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'metric',
          entity_name: 'Cash Runway',
          assignee: 'you',
          recurrence: 'none',
          metadata: { runway, cash },
        },
      };
    },
  },

  // ── EBITDA ────────────────────────────────────────────────────────────────

  {
    id: 'ebitda-negative',
    name: 'Negative EBITDA',
    description: 'Fires when EBITDA is negative',
    cooldownDays: 3,
    evaluate(data) {
      const rev = data.revenue.total;
      const ebitda = rev - data.costs.totalCOGS - data.costs.totalOpEx;
      if (ebitda >= 0) return null;
      return {
        ruleId: this.id,
        task: {
          title: `Cut ${fmtN(-ebitda)} to reach breakeven — EBITDA is negative`,
          context: `EBITDA is ${fmtN(ebitda)}. Negative operating profit kills acquisition financing.`,
          impact: 'Lenders require profitable operations for SBA 7(a) qualification',
          priority: 'p1',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'metric',
          entity_name: 'EBITDA',
          assignee: 'you',
          recurrence: 'none',
          metadata: { ebitda },
        },
      };
    },
  },

  {
    id: 'ebitda-margin-low',
    name: 'EBITDA margin below median',
    description: 'Fires when EBITDA margin is below 15%',
    cooldownDays: 7,
    evaluate(data) {
      const rev = data.revenue.total;
      if (!rev) return null;
      const ebitda = rev - data.costs.totalCOGS - data.costs.totalOpEx;
      const margin = (ebitda / rev) * 100;
      if (margin < 0 || margin >= 15) return null;
      return {
        ruleId: this.id,
        task: {
          title: `Expand EBITDA margin from ${margin.toFixed(1)}% to 15%+ — below LMM median`,
          context: `Lower-middle market services businesses trade at 14–20% EBITDA margins. Closing this gap adds ${fmtN((0.15 - margin / 100) * rev)} to annual EBITDA.`,
          impact: 'Each 1pp of EBITDA margin = significant valuation lift on portfolio exits',
          priority: 'p2',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'metric',
          entity_name: 'EBITDA Margin',
          assignee: 'you',
          recurrence: 'none',
          metadata: { margin },
        },
      };
    },
  },

  // ── Concentration ─────────────────────────────────────────────────────────

  {
    id: 'concentration-critical',
    name: 'Customer concentration critical',
    description: 'Fires when top customer exceeds 30% of revenue',
    cooldownDays: 7,
    evaluate(data) {
      const top = data.customers.topCustomers[0];
      if (!top || top.percentOfTotal <= 30) return null;
      return {
        ruleId: this.id,
        task: {
          title: `Reduce ${top.name} concentration — at ${top.percentOfTotal.toFixed(0)}% they're an existential risk`,
          context: `${top.name} represents ${top.percentOfTotal.toFixed(0)}% of revenue. SBA lenders flag anything above 25% and will discount loan sizing accordingly.`,
          impact: 'Losing this customer creates an unrecoverable cash shortfall',
          priority: 'p1',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'company',
          entity_name: top.name,
          assignee: 'you',
          recurrence: 'none',
          metadata: { pct: top.percentOfTotal, customer: top.name },
        },
      };
    },
  },

  // ── Retention ─────────────────────────────────────────────────────────────

  {
    id: 'retention-low',
    name: 'Retention below threshold',
    description: 'Fires when retention drops below 85%',
    cooldownDays: 7,
    evaluate(data) {
      const ret = (data.customers.retentionRate ?? 0.9) * 100;
      if (ret >= 85) return null;
      const lost = Math.round(data.customers.totalCount * (1 - ret / 100));
      return {
        ruleId: this.id,
        task: {
          title: `Fix churn — retention at ${ret.toFixed(0)}%, losing ~${lost} customers/year`,
          context: `${ret.toFixed(1)}% retention means losing ${lost} customers annually. Acquirers model forward revenue on current retention rates.`,
          impact: 'Poor retention compresses acquisition multiples and blocks earn-out achievement',
          priority: 'p2',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'metric',
          entity_name: 'Retention Rate',
          assignee: 'you',
          recurrence: 'none',
          metadata: { retention: ret, lost },
        },
      };
    },
  },

  // ── Acquisition deals ─────────────────────────────────────────────────────

  {
    id: 'deal-overdue-actions',
    name: 'Deals with overdue next actions',
    description: 'Fires when any active deal has a past-due next action date',
    cooldownDays: 1,
    evaluate(_data, ctx) {
      if (!ctx?.acqTargets) return null;
      const overdue = ctx.acqTargets.filter(t => {
        if (['closed-won','closed-lost'].includes(t.stage)) return false;
        if (!t.nextActionDate) return false;
        return new Date(t.nextActionDate) < new Date();
      });
      if (!overdue.length) return null;
      const names = overdue.slice(0, 3).map(d => d.name).join(', ');
      return {
        ruleId: this.id,
        task: {
          title: `${overdue.length} deal${overdue.length > 1 ? 's' : ''} with overdue actions — ${names}`,
          context: 'Stalled deals lose seller confidence. Brokers move to the next buyer when communication goes dark.',
          impact: 'Overdue touchpoints reduce close probability by ~30% per week of silence',
          priority: 'p1',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'deal',
          entity_name: names,
          assignee: 'you',
          recurrence: 'none',
          metadata: { count: overdue.length, deals: overdue.map(d => d.name) },
        },
      };
    },
  },

  {
    id: 'pipeline-thin',
    name: 'Acquisition pipeline thin',
    description: 'Fires when fewer than 5 active targets are in pipeline',
    cooldownDays: 3,
    evaluate(_data, ctx) {
      if (!ctx?.acqTargets) return null;
      const active = ctx.acqTargets.filter(t => !['closed-won','closed-lost'].includes(t.stage));
      if (active.length >= 5) return null;
      return {
        ruleId: this.id,
        task: {
          title: `Build pipeline — only ${active.length} active targets, need 50+ for one great deal`,
          context: 'Best-practice acquisition search requires 50–100 qualified targets in funnel to close one deal at the right price.',
          impact: 'Thin pipeline forces rushed decisions and premium pricing',
          priority: 'p2',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'metric',
          entity_name: 'Acquisition Pipeline',
          assignee: 'you',
          recurrence: 'none',
          metadata: { activeCount: active.length },
        },
      };
    },
  },

  {
    id: 'deal-loi-stale',
    name: 'LOI stage stale',
    description: 'Fires when a deal has been in LOI for more than 14 days',
    cooldownDays: 2,
    evaluate(_data, ctx) {
      if (!ctx?.acqTargets) return null;
      const stale = ctx.acqTargets.filter(t => t.stage === 'loi' && t.nextActionDate) .filter(t => daysUntil(t.nextActionDate) !== null && daysUntil(t.nextActionDate)! < 0);
      if (!stale.length) return null;
      return {
        ruleId: this.id,
        task: {
          title: `Advance ${stale[0].name} from LOI — exclusivity window is closing`,
          context: 'LOI exclusivity periods are typically 30–60 days. Delays give sellers time to shop the deal.',
          impact: 'Exclusivity expiration reopens the deal to competing buyers',
          priority: 'p1',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'deal',
          entity_name: stale[0].name,
          assignee: 'you',
          recurrence: 'none',
          metadata: { deal: stale[0].name },
        },
      };
    },
  },

  // ── Goals ─────────────────────────────────────────────────────────────────

  {
    id: 'goal-at-risk',
    name: 'Goal falling behind',
    description: 'Fires when a goal is at-risk and due within 30 days',
    cooldownDays: 3,
    evaluate(_data, ctx) {
      if (!ctx?.goals) return null;
      const atRisk = ctx.goals.filter(g =>
        g.status === 'at-risk' &&
        g.dueDate &&
        daysUntil(g.dueDate) !== null &&
        daysUntil(g.dueDate)! <= 30 &&
        daysUntil(g.dueDate)! > 0
      );
      if (!atRisk.length) return null;
      const g = atRisk[0];
      const pct = g.target > 0 ? Math.round((g.current / g.target) * 100) : 0;
      return {
        ruleId: this.id,
        task: {
          title: `"${g.title}" is at risk — ${pct}% complete with ${daysUntil(g.dueDate)} days left`,
          context: `Goal is behind target with ${daysUntil(g.dueDate)} days remaining. Current: ${g.current} of ${g.target}.`,
          impact: 'Missing acquisition goals delays portfolio build and extends break-even timeline',
          priority: 'p2',
          status: 'open',
          created_by: 'ai',
          trigger_id: this.id,
          entity_type: 'goal',
          entity_name: g.title,
          assignee: 'you',
          recurrence: 'none',
          metadata: { goal: g.title, pct, daysLeft: daysUntil(g.dueDate) },
        },
      };
    },
  },
];

// ─── Run all rules against current data ──────────────────────────────────────

export function evaluateRules(
  data: UnifiedBusinessData,
  ctx?: RuleContext
): RuleFiring[] {
  const firings: RuleFiring[] = [];
  for (const rule of RULES) {
    try {
      const firing = rule.evaluate(data, ctx);
      if (firing) firings.push(firing);
    } catch { /* rule errors are non-fatal */ }
  }
  return firings;
}
