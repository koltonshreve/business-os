// ─── /api/tasks/[id] ─────────────────────────────────────────────────────────
// PATCH  /api/tasks/:id  — update task (status, priority, etc.)
// DELETE /api/tasks/:id  — hard delete

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });

  try {
    const sql = getDb();

    if (req.method === 'PATCH') {
      const patch = req.body ?? {};
      const allowed = ['status','priority','title','context','impact','assignee','due_date','snoozed_until'];
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
        `UPDATE bos_tasks SET ${setClauses}, updated_at = now() WHERE id = $1 RETURNING *`,
        values
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
      }

      return res.status(200).json(row);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM bos_tasks WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
