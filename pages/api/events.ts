// ─── /api/events ─────────────────────────────────────────────────────────────
// GET  — recent event log
// POST — log an event (used by client-side actions)

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../lib/db';
import { getSessionUser } from '../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const sql = getDb();

    if (req.method === 'GET') {
      const { limit = '50' } = req.query;
      const rows = await sql`
        SELECT * FROM bos_events
        ORDER BY created_at DESC
        LIMIT ${parseInt(limit as string, 10)}
      `;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const { type, summary, source, entity_type, entity_id, entity_name, detail } = req.body ?? {};
      if (!type || !summary) return res.status(400).json({ error: 'type and summary required' });

      const eventRows = await sql`
        INSERT INTO bos_events (type, summary, source, entity_type, entity_id, entity_name, detail)
        VALUES (
          ${type}, ${summary}, ${source ?? 'user'},
          ${entity_type ?? null}, ${entity_id ?? null}, ${entity_name ?? null},
          ${JSON.stringify(detail ?? {})}
        )
        RETURNING *
      ` as unknown as Record<string, unknown>[];
      return res.status(201).json(eventRows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
