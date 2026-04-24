// ─── /api/user/billing ────────────────────────────────────────────────────────
// GET — returns the authenticated user's Stripe customer ID and plan details.
// Used by AccountModal to open the Stripe customer portal.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const sql = getDb();

  const rows = await sql`
    SELECT p.stripe_customer_id, p.plan_id, p.subscription_id
    FROM bos_user_plans p
    JOIN bos_users u ON u.id::text = p.stripe_customer_id
       OR p.email = u.email
    WHERE u.email = ${user.email}
    LIMIT 1
  ` as unknown as { stripe_customer_id: string; plan_id: string; subscription_id: string }[];

  // Fall back to joining by email column if the above yields nothing
  if (!rows[0]) {
    const byEmail = await sql`
      SELECT stripe_customer_id, plan_id, subscription_id
      FROM bos_user_plans
      WHERE email = ${user.email}
      LIMIT 1
    ` as unknown as { stripe_customer_id: string; plan_id: string; subscription_id: string }[];
    if (!byEmail[0]) return res.json({ customerId: null, planId: 'starter' });
    return res.json({
      customerId: byEmail[0].stripe_customer_id,
      planId: byEmail[0].plan_id,
      subscriptionId: byEmail[0].subscription_id,
    });
  }

  return res.json({
    customerId: rows[0].stripe_customer_id,
    planId: rows[0].plan_id,
    subscriptionId: rows[0].subscription_id,
  });
}
