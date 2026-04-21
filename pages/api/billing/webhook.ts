// ─── Stripe Webhook Handler ────────────────────────────────────────────────────
// Listens for subscription lifecycle events from Stripe and updates the user's
// plan in the database. Set STRIPE_WEBHOOK_SECRET in Vercel env vars and point
// the Stripe dashboard webhook to: https://your-domain.com/api/billing/webhook
//
// Events handled:
//   customer.subscription.created   → activate plan
//   customer.subscription.updated   → update plan (upgrade / downgrade)
//   customer.subscription.deleted   → downgrade to starter

import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';

export const config = { api: { bodyParser: false } };

async function buffer(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const PLAN_ID_FROM_PRICE: Record<string, string> = {
  [process.env.STRIPE_PRICE_GROWTH ?? '']: 'growth',
  [process.env.STRIPE_PRICE_PRO   ?? '']: 'pro',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const stripe = new Stripe(secret, { apiVersion: '2026-03-25.dahlia' });
  const raw = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig as string, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return res.status(400).json({ error: msg });
  }

  const sub = event.data.object as Stripe.Subscription;

  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const priceId = sub.items?.data?.[0]?.price?.id ?? '';
      const planId  = PLAN_ID_FROM_PRICE[priceId] ?? 'starter';
      const custId  = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? '';

      if (isDbConfigured()) {
        const sql = getDb();
        await ensureSchema();
        // Upsert user plan record keyed by Stripe customer ID
        await sql`
          INSERT INTO bos_user_plans (stripe_customer_id, plan_id, subscription_id, updated_at)
          VALUES (${custId}, ${planId}, ${sub.id}, now())
          ON CONFLICT (stripe_customer_id)
          DO UPDATE SET
            plan_id         = EXCLUDED.plan_id,
            subscription_id = EXCLUDED.subscription_id,
            updated_at      = now()
        `;
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? '';
      if (isDbConfigured()) {
        const sql = getDb();
        await sql`
          UPDATE bos_user_plans
          SET plan_id = 'starter', updated_at = now()
          WHERE stripe_customer_id = ${custId}
        `;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[webhook]', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
