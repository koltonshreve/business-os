// ─── /api/acq-targets ─────────────────────────────────────────────────────────
// GET  — return all acquisition targets for the authenticated user
// POST — bulk upsert targets (full replace strategy keyed by id)
// DELETE — delete a target by id

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';
import type { AcquisitionTarget } from '../../../components/acquisition/AcquisitionPipeline';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await ensureSchema();
  const sql = getDb();
  const userEmail = user.email;

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT data FROM bos_acq_targets
      WHERE user_email = ${userEmail}
      ORDER BY
        CASE WHEN (data->>'stage') IN ('closing','loi','due-diligence') THEN 0 ELSE 1 END,
        updated_at DESC
    ` as unknown as { data: AcquisitionTarget }[];
    return res.json(rows.map(r => r.data));
  }

  if (req.method === 'POST') {
    const targets = req.body as AcquisitionTarget[];
    if (!Array.isArray(targets)) return res.status(400).json({ error: 'Array body required' });

    // Bulk upsert
    for (const t of targets) {
      if (!t.id) continue;
      await sql`
        INSERT INTO bos_acq_targets (id, user_email, data, stage, updated_at, created_at)
        VALUES (
          ${t.id},
          ${userEmail},
          ${JSON.stringify(t)}::jsonb,
          ${t.stage},
          ${t.updatedAt ?? new Date().toISOString()},
          ${t.createdAt ?? new Date().toISOString()}
        )
        ON CONFLICT (id) DO UPDATE SET
          data       = EXCLUDED.data,
          stage      = EXCLUDED.stage,
          updated_at = EXCLUDED.updated_at
        WHERE bos_acq_targets.user_email = ${userEmail}
      `;
    }
    return res.json({ ok: true, count: targets.length });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body as { id: string };
    if (!id) return res.status(400).json({ error: 'id required' });
    await sql`
      DELETE FROM bos_acq_targets
      WHERE id = ${id} AND user_email = ${userEmail}
    `;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
