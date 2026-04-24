// ─── /api/user/prefs ──────────────────────────────────────────────────────────
// GET  — returns user prefs (goals, budget, custom settings)
// PATCH — merges partial update into prefs JSONB

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await ensureSchema();
  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT prefs FROM bos_users WHERE email = ${user.email} LIMIT 1
    ` as { prefs: Record<string, unknown> | null }[];
    return res.json(rows[0]?.prefs ?? {});
  }

  if (req.method === 'PATCH') {
    const patch = req.body as Record<string, unknown>;
    if (!patch || typeof patch !== 'object') return res.status(400).json({ error: 'Object body required' });

    // Deep merge patch into existing prefs
    await sql`
      UPDATE bos_users
      SET prefs = COALESCE(prefs, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
          updated_at = now()
      WHERE email = ${user.email}
    `;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
