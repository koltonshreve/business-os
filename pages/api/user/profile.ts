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
      SELECT name, company_name, company_profile FROM bos_users WHERE email = ${user.email} LIMIT 1
    ` as { name: string | null; company_name: string | null; company_profile: Record<string, unknown> | null }[];

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json({
      name: rows[0].name ?? '',
      companyName: rows[0].company_name ?? '',
      companyProfile: rows[0].company_profile ?? {},
    });
  }

  if (req.method === 'PATCH') {
    const { name, companyName, companyProfile } = req.body as {
      name?: string;
      companyName?: string;
      companyProfile?: { industry?: string; revenueModel?: string };
    };

    await sql`
      UPDATE bos_users SET
        name            = COALESCE(${name ?? null}, name),
        company_name    = COALESCE(${companyName ?? null}, company_name),
        company_profile = COALESCE(${companyProfile ? JSON.stringify(companyProfile) : null}::jsonb, company_profile),
        updated_at      = now()
      WHERE email = ${user.email}
    `;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
