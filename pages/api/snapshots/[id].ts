import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query as { id: string };
  const sql = getDb();

  // ── PATCH: rename ────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { label } = req.body as { label?: string };
    if (!label?.trim()) return res.status(400).json({ error: 'label required' });

    await sql`
      UPDATE bos_snapshots SET label = ${label.trim()}, updated_at = now()
      WHERE id = ${id} AND user_email = ${user.email}
    `;
    return res.json({ ok: true });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    await sql`
      DELETE FROM bos_snapshots WHERE id = ${id} AND user_email = ${user.email}
    `;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
