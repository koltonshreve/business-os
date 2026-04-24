// ─── Stripe Customer Portal ───────────────────────────────────────────────────
// Creates a portal session so users can manage their subscription,
// update payment methods, download invoices, or cancel — without contacting support.

import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured' });

  const { customerId, returnUrl } = req.body as { customerId: string; returnUrl: string };
  if (!customerId) return res.status(400).json({ error: 'Customer ID required' });

  try {
    const stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: returnUrl,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Stripe.errors.StripeError ? err.message : 'Portal session creation failed';
    return res.status(500).json({ error: msg });
  }
}
