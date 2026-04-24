// ─── /api/tasks/[id] ─────────────────────────────────────────────────────────
// PATCH  /api/tasks/:id  — update task (status, priority, etc.)
// DELETE /api/tasks/:id  — hard delete

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });

  try {
    const sql = getDb();
    const user = await getSessionUser(req);
    const userEmail = user?.email ?? null;

    if (req.method === 'PATCH') {
      const patch = req.body ?? {};
      const allowed = ['status','priority','title','context','impact','assignee','due_date','snoozed_until','recurrence'];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in patch) updates[key] = patch[key];
      }

      // Auto-set completed_at when marking done
      if (patch.status === 'done') updates.completed_at = new Date().toISOString();

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Build dynamic SET clause
      const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
      const values = [id, ...Object.values(updates)];

      const rows = await sql.query(
        `UPDATE bos_tasks SET ${setClauses}, updated_at = now() WHERE id = $1 AND (user_email = $${values.length + 1} OR user_email IS NULL) RETURNING *`,
        [...values, userEmail]
      ) as unknown as Record<string, unknown>[];

      const row = rows[0];
      if (!row) return res.status(404).json({ error: 'Task not found' });

      // Log completion event
      if (patch.status === 'done') {
        await sql`
          INSERT INTO bos_events (type, summary, source, entity_type, entity_name)
          VALUES (
            'task_completed',
            ${`Task completed: ${row.title}`},
            'user',
            ${row.entity_type ?? null},
            ${row.entity_name ?? null}
          )
        `;

        // Auto-spawn next occurrence for recurring tasks
        const recurrence = row.recurrence as string ?? 'none';
        if (recurrence !== 'none') {
          const baseDate = row.due_date ? new Date(row.due_date as string) : new Date();
          let nextDate = new Date(baseDate);
          if (recurrence === 'daily')   nextDate.setDate(nextDate.getDate() + 1);
          if (recurrence === 'weekly')  nextDate.setDate(nextDate.getDate() + 7);
          if (recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          // Ensure next date is in the future
          const now = new Date();
          while (nextDate <= now) {
            if (recurrence === 'daily')   nextDate.setDate(nextDate.getDate() + 1);
            if (recurrence === 'weekly')  nextDate.setDate(nextDate.getDate() + 7);
            if (recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          }
          await sql`
            INSERT INTO bos_tasks (
              title, context, impact, priority, status, created_by,
              entity_type, entity_id, entity_name, assignee,
              due_date, recurrence, metadata, user_email
            ) VALUES (
              ${row.title as string},
              ${row.context as string | null},
              ${row.impact as string | null},
              ${row.priority as string},
              'open',
              'user',
              ${row.entity_type as string | null},
              ${row.entity_id as string | null},
              ${row.entity_name as string | null},
              ${row.assignee as string},
              ${nextDate.toISOString()},
              ${recurrence},
              ${JSON.stringify(row.metadata ?? {})}::jsonb,
              ${userEmail}
            )
          `;
        }
      }

      return res.status(200).json(row);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM bos_tasks WHERE id = ${id} AND (user_email = ${userEmail} OR user_email IS NULL)`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
