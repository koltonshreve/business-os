// ─── /api/tasks ───────────────────────────────────────────────────────────────
// GET  /api/tasks        — list tasks (filterable by status, priority)
// POST /api/tasks        — create a task

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured — connect Neon via Vercel Storage' });
  }

  try {
    await ensureSchema();
    const sql = getDb();

    if (req.method === 'GET') {
      const { status, priority } = req.query;

      let rows;
      if (status && priority) {
        const statuses = (status as string).split(',');
        rows = await sql`
          SELECT * FROM bos_tasks
          WHERE status = ANY(${statuses}) AND priority = ${priority as string}
          ORDER BY
            CASE priority WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
            CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
            due_date ASC,
            created_at DESC
        `;
      } else if (status) {
        const statuses = (status as string).split(',');
        rows = await sql`
          SELECT * FROM bos_tasks
          WHERE status = ANY(${statuses})
          ORDER BY
            CASE priority WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
            CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
            due_date ASC,
            created_at DESC
        `;
      } else if (priority) {
        rows = await sql`
          SELECT * FROM bos_tasks
          WHERE priority = ${priority as string}
          ORDER BY created_at DESC
        `;
      } else {
        rows = await sql`
          SELECT * FROM bos_tasks
          ORDER BY
            CASE status WHEN 'active' THEN 1 WHEN 'open' THEN 2 ELSE 3 END,
            CASE priority WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
            created_at DESC
          LIMIT 200
        `;
      }

      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const body = req.body;
      if (!body?.title) return res.status(400).json({ error: 'title required' });

      const insertRows = await sql`
        INSERT INTO bos_tasks (
          title, context, impact, priority, status, created_by,
          trigger_id, entity_type, entity_id, entity_name,
          assignee, due_date, metadata
        ) VALUES (
          ${body.title},
          ${body.context ?? null},
          ${body.impact ?? null},
          ${body.priority ?? 'p2'},
          ${body.status ?? 'open'},
          ${body.created_by ?? 'user'},
          ${body.trigger_id ?? null},
          ${body.entity_type ?? null},
          ${body.entity_id ?? null},
          ${body.entity_name ?? null},
          ${body.assignee ?? 'you'},
          ${body.due_date ?? null},
          ${JSON.stringify(body.metadata ?? {})}
        )
        RETURNING *
      ` as unknown as Record<string, unknown>[];
      const row = insertRows[0];

      // Log event
      await sql`
        INSERT INTO bos_events (type, summary, source, entity_type, entity_name)
        VALUES (
          'task_created',
          ${`Task created: ${body.title}`},
          ${body.created_by === 'ai' ? 'ai' : 'user'},
          ${body.entity_type ?? null},
          ${body.entity_name ?? null}
        )
      `;

      return res.status(201).json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
