// ─── Stripe Checkout Session ──────────────────────────────────────────────────
// Creates a hosted Stripe Checkout session for plan upgrades.
// Redirects user to Stripe's payment page; on success Stripe redirects back
// to /?billing=success&session_id=cs_xxx so the app can verify and unlock.

import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const PRICE_MAP: Record<string, string | undefined> = {
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro:    process.env.STRIPE_PRICE_PRO,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment variables.' });

  const { planId, appUrl } = req.body as { planId: string; appUrl: string };
  const priceId = PRICE_MAP[planId];

  if (!priceId) {
    return res.status(400).json({
      error: `No Stripe price configured for plan "${planId}". Add STRIPE_PRICE_${planId.toUpperCase()} to environment variables.`,
    });
  }

  try {
    const stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });

    const session = await stripe.checkout.sessions.create({
      mode:                'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/?billing=cancelled`,
      metadata:    { planId },
      subscription_data: {
        metadata: { planId },
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Stripe.errors.StripeError ? err.message : 'Checkout session creation failed';
    return res.status(500).json({ error: msg });
  }
}
