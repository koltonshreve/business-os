import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

const PLAN_LIMITS: Record<string, number> = {
  starter: 5,
  growth:  50,
  pro:     999,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  await ensureSchema();
  const sql = getDb();

  const yearMonth = new Date().toISOString().slice(0, 7);

  const [userRows, usageRows] = await Promise.all([
    sql`SELECT plan_id FROM bos_users WHERE email = ${user.email} LIMIT 1` as unknown as Promise<{ plan_id: string }[]>,
    sql`SELECT count FROM bos_ai_usage WHERE user_email = ${user.email} AND year_month = ${yearMonth} LIMIT 1` as unknown as Promise<{ count: number }[]>,
  ]);

  const planId = userRows[0]?.plan_id ?? 'starter';
  const count  = usageRows[0]?.count ?? 0;
  const limit  = PLAN_LIMITS[planId] ?? PLAN_LIMITS.starter;

  return res.json({ count, limit, planId, yearMonth, remaining: Math.max(0, limit - count) });
}
