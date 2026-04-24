import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';
import type { Deal } from '../../../lib/deals';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await ensureSchema();
  const sql = getDb();

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT data FROM bos_m_deals
      WHERE user_email = ${user.email}
      ORDER BY starred DESC, updated_at DESC
    ` as { data: Deal }[];
    return res.json(rows.map(r => r.data));
  }

  if (req.method === 'POST') {
    // Bulk upsert — client sends full deals array
    const { deals } = req.body as { deals: Deal[] };
    if (!Array.isArray(deals)) return res.status(400).json({ error: 'deals array required' });

    // Upsert each deal
    await Promise.all(deals.map(deal =>
      sql`
        INSERT INTO bos_m_deals (id, user_email, data, stage, starred, updated_at)
        VALUES (${deal.id}, ${user.email}, ${JSON.stringify(deal)}::jsonb, ${deal.stage}, ${deal.starred}, ${deal.updatedAt ?? new Date().toISOString()})
        ON CONFLICT (id) DO UPDATE SET
          data       = EXCLUDED.data,
          stage      = EXCLUDED.stage,
          starred    = EXCLUDED.starred,
          updated_at = EXCLUDED.updated_at
        WHERE bos_m_deals.user_email = ${user.email}
      `
    ));

    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body as { id: string };
    if (!id) return res.status(400).json({ error: 'id required' });
    await sql`DELETE FROM bos_m_deals WHERE id = ${id} AND user_email = ${user.email}`;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
