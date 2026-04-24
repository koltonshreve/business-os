// ─── Verify Checkout Session ──────────────────────────────────────────────────
// Called after Stripe redirects back with ?session_id=cs_xxx.
// Returns the plan unlocked and the Stripe customer ID for re-verification.

import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId?.startsWith('cs_')) return res.status(400).json({ error: 'Invalid session ID' });

  try {
    const stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const planId = (session.metadata?.planId ?? 'growth') as 'growth' | 'pro';
    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? '';
    const customerEmail = typeof session.customer === 'object' && session.customer !== null
      ? (session.customer as Stripe.Customer).email ?? ''
      : '';
    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? '';

    // Upgrade bos_users.plan_id for the authenticated user
    if (isDbConfigured()) {
      try {
        await ensureSchema();
        const sql = getDb();
        // Prefer session user; fall back to Stripe customer email
        const sessionUser = await getSessionUser(req);
        const emailToUpdate = sessionUser?.email ?? customerEmail.toLowerCase();
        if (emailToUpdate) {
          await sql`
            UPDATE bos_users SET plan_id = ${planId}, updated_at = now()
            WHERE email = ${emailToUpdate}
          `;
        }
      } catch { /* non-fatal */ }
    }

    return res.status(200).json({
      planId,
      customerId,
      customerEmail,
      subscriptionId,
    });
  } catch (err) {
    const msg = err instanceof Stripe.errors.StripeError ? err.message : 'Verification failed';
    return res.status(500).json({ error: msg });
  }
}
