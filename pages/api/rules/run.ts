// ─── /api/rules/run ───────────────────────────────────────────────────────────
// POST — evaluate all rules against current data, deduplicate, fire tasks
//
// Body: { data: UnifiedBusinessData, acqTargets?, goals? }
// Returns: { fired: number, tasks: Task[], skipped: number }

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured, ensureSchema } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';
import { evaluateRules, type RuleContext } from '../../../lib/rules';
import type { UnifiedBusinessData } from '../../../types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { data, acqTargets, goals } = req.body ?? {};
  if (!data) return res.status(400).json({ error: 'data required' });

  try {
    await ensureSchema();
    const sql = getDb();

    // Evaluate all rules
    const ctx: RuleContext = { acqTargets, goals };
    const firings = evaluateRules(data as UnifiedBusinessData, ctx);

    if (firings.length === 0) {
      return res.status(200).json({ fired: 0, tasks: [], skipped: 0 });
    }

    // Load which rules have already fired today (or within cooldown window)
    const ruleIds = firings.map(f => f.ruleId);
    const recentFirings = await sql`
      SELECT rule_id, MAX(fired_at) as last_fired
      FROM bos_rule_firings
      WHERE rule_id = ANY(${ruleIds})
      GROUP BY rule_id
    ` as unknown as { rule_id: string; last_fired: string }[];
    const lastFiredMap = new Map<string, Date>();
    for (const row of recentFirings) {
      lastFiredMap.set(row.rule_id, new Date(row.last_fired));
    }

    // Import RULES to get cooldown info
    const { RULES } = await import('../../../lib/rules');
    const cooldownMap = new Map(RULES.map(r => [r.id, r.cooldownDays]));

    const toFire = firings.filter(f => {
      const lastFired = lastFiredMap.get(f.ruleId);
      if (!lastFired) return true;
      const cooldown = cooldownMap.get(f.ruleId) ?? 1;
      const daysSinceFired = (Date.now() - lastFired.getTime()) / 86_400_000;
      return daysSinceFired >= cooldown;
    });

    const skipped = firings.length - toFire.length;

    if (toFire.length === 0) {
      return res.status(200).json({ fired: 0, tasks: [], skipped });
    }

    // Also check for open tasks with the same trigger_id (avoid re-creating)
    const triggerIds = toFire.map(f => f.ruleId);
    const existingTasks = await sql`
      SELECT trigger_id FROM bos_tasks
      WHERE trigger_id = ANY(${triggerIds})
        AND status IN ('open', 'active')
    ` as unknown as { trigger_id: string }[];
    const existingTriggers = new Set(existingTasks.map(r => r.trigger_id));

    const newFirings = toFire.filter(f => !existingTriggers.has(f.ruleId));

    if (newFirings.length === 0) {
      return res.status(200).json({ fired: 0, tasks: [], skipped: firings.length });
    }

    // Insert tasks and record firings
    const createdTasks: Record<string, unknown>[] = [];
    for (const firing of newFirings) {
      const t = firing.task;
      const taskRows = await sql`
        INSERT INTO bos_tasks (
          title, context, impact, priority, status, created_by,
          trigger_id, entity_type, entity_id, entity_name,
          assignee, due_date, metadata, user_email
        ) VALUES (
          ${t.title},
          ${t.context ?? null},
          ${t.impact ?? null},
          ${t.priority ?? 'p2'},
          ${'open'},
          ${'ai'},
          ${firing.ruleId},
          ${t.entity_type ?? null},
          ${t.entity_id ?? null},
          ${t.entity_name ?? null},
          ${t.assignee ?? 'you'},
          ${t.due_date ?? null},
          ${JSON.stringify(t.metadata ?? {})},
          ${user.email}
        )
        RETURNING *
      ` as unknown as Record<string, unknown>[];
      const row = taskRows[0];
      createdTasks.push(row);

      // Record the rule firing
      await sql`
        INSERT INTO bos_rule_firings (rule_id, fired_at, task_id)
        VALUES (${firing.ruleId}, now(), ${row.id as string})
      `;

      // Log event
      await sql`
        INSERT INTO bos_events (type, summary, source, entity_type, entity_name)
        VALUES (
          'rule_fired',
          ${`AI task created: ${t.title}`},
          'ai',
          ${t.entity_type ?? null},
          ${t.entity_name ?? null}
        )
      `;
    }

    return res.status(200).json({
      fired: createdTasks.length,
      tasks: createdTasks,
      skipped: firings.length - newFirings.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
