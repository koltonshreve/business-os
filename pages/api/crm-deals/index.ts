// ─── /api/crm-deals ───────────────────────────────────────────────────────────
// GET    — return all CRM pipeline deals for the authenticated user
// POST   — bulk upsert deals (keyed by id)
// DELETE — delete a deal by id

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';
import type { Deal } from '../../../types/index';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await ensureSchema();
  const sql = getDb();
  const userEmail = user.email;

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT data FROM bos_crm_deals
      WHERE user_email = ${userEmail}
      ORDER BY updated_at DESC
    ` as unknown as { data: Deal }[];
    return res.json(rows.map(r => r.data));
  }

  if (req.method === 'POST') {
    const deals = req.body as Deal[];
    if (!Array.isArray(deals)) return res.status(400).json({ error: 'Array body required' });

    for (const d of deals) {
      if (!d.id) continue;
      await sql`
        INSERT INTO bos_crm_deals (id, user_email, data, stage, updated_at, created_at)
        VALUES (
          ${d.id},
          ${userEmail},
          ${JSON.stringify(d)}::jsonb,
          ${d.stage},
          ${d.updatedAt ?? new Date().toISOString()},
          ${d.createdAt ?? new Date().toISOString()}
        )
        ON CONFLICT (id) DO UPDATE SET
          data       = EXCLUDED.data,
          stage      = EXCLUDED.stage,
          updated_at = EXCLUDED.updated_at
        WHERE bos_crm_deals.user_email = ${userEmail}
      `;
    }
    return res.json({ ok: true, count: deals.length });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body as { id: string };
    if (!id) return res.status(400).json({ error: 'id required' });
    await sql`
      DELETE FROM bos_crm_deals
      WHERE id = ${id} AND user_email = ${userEmail}
    `;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
