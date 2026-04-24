// ─── /api/user/export ─────────────────────────────────────────────────────────
// GET — exports all user data as a JSON file download.
// Includes: snapshots, tasks, CRM deals, acq targets, prefs, profile.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const sql = getDb();
  const email = user.email;

  const [profile, prefs, snapshots, tasks, crmDeals, acqTargets, mDeals, aiUsage] = await Promise.all([
    sql`SELECT email, name, company_name, plan_id, created_at FROM bos_users WHERE email = ${email} LIMIT 1`,
    sql`SELECT prefs FROM bos_users WHERE email = ${email} LIMIT 1`,
    sql`SELECT id, label, data, created_at FROM bos_snapshots WHERE user_email = ${email} ORDER BY created_at DESC`,
    sql`SELECT * FROM bos_tasks WHERE user_email = ${email} ORDER BY created_at DESC`,
    sql`SELECT data FROM bos_crm_deals WHERE user_email = ${email} ORDER BY updated_at DESC`,
    sql`SELECT data FROM bos_acq_targets WHERE user_email = ${email} ORDER BY updated_at DESC`,
    sql`SELECT data FROM bos_m_deals WHERE user_email = ${email} ORDER BY updated_at DESC`,
    sql`SELECT year_month, count FROM bos_ai_usage WHERE user_email = ${email} ORDER BY year_month DESC`,
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    email,
    profile:     (profile as unknown[])[0] ?? null,
    prefs:       ((prefs as unknown as { prefs: unknown }[])[0]?.prefs) ?? {},
    snapshots:   snapshots as unknown[],
    tasks:       tasks as unknown[],
    crmDeals:    (crmDeals as unknown as { data: unknown }[]).map(r => r.data),
    acqTargets:  (acqTargets as unknown as { data: unknown }[]).map(r => r.data),
    mAndADeals:  (mDeals as unknown as { data: unknown }[]).map(r => r.data),
    aiUsage:     aiUsage as unknown[],
  };

  const json = JSON.stringify(payload, null, 2);
  const filename = `business-os-export-${new Date().toISOString().slice(0, 10)}.json`;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(json);
}
