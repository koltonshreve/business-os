import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await ensureSchema();
  const sql = getDb();

  // ── GET: list all snapshots for this user ────────────────────────────────
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, label, data, created_at
      FROM bos_snapshots
      WHERE user_email = ${user.email}
      ORDER BY created_at DESC
      LIMIT 20
    ` as { id: string; label: string; data: unknown; created_at: string }[];

    return res.json(rows.map(r => ({
      id: r.id,
      label: r.label,
      data: r.data,
      createdAt: r.created_at,
    })));
  }

  // ── POST: save a new snapshot ────────────────────────────────────────────
  if (req.method === 'POST') {
    const { id, label, data } = req.body as { id?: string; label?: string; data?: unknown };
    if (!id || !label || !data) return res.status(400).json({ error: 'id, label and data required' });

    await sql`
      INSERT INTO bos_snapshots (id, user_email, label, data)
      VALUES (${id}, ${user.email}, ${label}, ${JSON.stringify(data)})
      ON CONFLICT (id) DO UPDATE
        SET label = EXCLUDED.label, data = EXCLUDED.data, updated_at = now()
    `;
    return res.status(201).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
