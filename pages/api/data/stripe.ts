// ─── Stripe Data Connector ────────────────────────────────────────────────────
// Pulls charges, subscriptions, and customers from the Stripe API and maps
// them into UnifiedBusinessData so every module picks up live Stripe data.

import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import type { UnifiedBusinessData, PeriodData, CustomerRecord } from '../../../types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secretKey, existingData } = req.body as {
    secretKey: string;
    existingData?: UnifiedBusinessData;
  };

  // Allow env-var fallback so the key can be pre-configured on Vercel
  const key = secretKey?.trim() || process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(400).json({ error: 'Stripe secret key is required' });
  if (!key.startsWith('sk_')) return res.status(400).json({ error: 'Invalid Stripe secret key format' });

  try {
    const stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });

    const now      = Math.floor(Date.now() / 1000);
    const since12m = now - 365 * 86400;

    // ── Fetch in parallel ──────────────────────────────────────────────────────
    const [chargesData, subscriptionsData, customersData] = await Promise.all([
      stripe.charges.list({ limit: 100, created: { gte: since12m } }),
      stripe.subscriptions.list({ limit: 100, status: 'active' }),
      stripe.customers.list({ limit: 100 }),
    ]);

    const charges       = chargesData.data.filter(c => c.paid && !c.refunded);
    const subscriptions = subscriptionsData.data;
    const customers     = customersData.data;

    // ── Revenue by month ───────────────────────────────────────────────────────
    const byMonthMap: Record<string, number> = {};
    for (const charge of charges) {
      const d   = new Date(charge.created * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonthMap[key] = (byMonthMap[key] ?? 0) + charge.amount / 100;
    }

    const byPeriod: PeriodData[] = Object.entries(byMonthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, revenue]) => ({
        period,
        periodType: 'monthly' as const,
        revenue,
        recurring: undefined,
        oneTime:   undefined,
      }));

    const ttmRevenue = byPeriod.reduce((s, p) => s + p.revenue, 0);

    // ── MRR / ARR from active subscriptions ───────────────────────────────────
    let mrr = 0;
    for (const sub of subscriptions) {
      for (const item of sub.items.data) {
        const price = item.price;
        const amount = (price.unit_amount ?? 0) / 100 * (item.quantity ?? 1);
        if (price.recurring?.interval === 'year') mrr += amount / 12;
        else if (price.recurring?.interval === 'month') mrr += amount;
        else if (price.recurring?.interval === 'week') mrr += amount * 4.33;
      }
    }
    const arr = mrr * 12;

    // ── Customer revenue map from charges ─────────────────────────────────────
    const custRevMap: Record<string, { name: string; revenue: number }> = {};
    for (const charge of charges) {
      const cid = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
      if (!cid) continue;
      if (!custRevMap[cid]) {
        const found = customers.find(c => c.id === cid);
        custRevMap[cid] = {
          name:    found?.name ?? found?.email ?? cid,
          revenue: 0,
        };
      }
      custRevMap[cid].revenue += charge.amount / 100;
    }

    const totalCustomerRevenue = Object.values(custRevMap).reduce((s, c) => s + c.revenue, 0);
    const topCustomers: CustomerRecord[] = Object.entries(custRevMap)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 20)
      .map(([id, c]) => ({
        id,
        name:           c.name,
        revenue:        c.revenue,
        percentOfTotal: totalCustomerRevenue > 0 ? (c.revenue / totalCustomerRevenue) * 100 : 0,
        revenueType:    'recurring' as const,
      }));

    // ── Canceled subscriptions in last 90 days (churn proxy) ──────────────────
    const canceledData = await stripe.subscriptions.list({
      limit: 100,
      status: 'canceled',
      created: { gte: now - 90 * 86400 },
    });
    const recentlyChurned = canceledData.data.length;

    // ── Assemble UnifiedBusinessData slice ────────────────────────────────────
    const stripeSlice: Partial<UnifiedBusinessData> = {
      revenue: {
        total:    ttmRevenue,
        byPeriod,
        recurring: arr,
        currency: 'USD',
      },
      customers: {
        totalCount:            customers.length,
        newThisPeriod:         0,
        churned:               recentlyChurned,
        topCustomers,
        avgRevenuePerCustomer: customers.length > 0 ? ttmRevenue / customers.length : 0,
        retentionRate:         subscriptions.length > 0
          ? 1 - recentlyChurned / Math.max(subscriptions.length + recentlyChurned, 1)
          : undefined,
      },
      metadata: {
        sources:        ['Stripe'],
        asOf:           new Date().toISOString(),
        coveragePeriod: {
          start: byPeriod[0]?.period ?? '',
          end:   byPeriod[byPeriod.length - 1]?.period ?? '',
        },
        completeness: ttmRevenue > 0 ? 0.7 : 0.2,
        warnings:     ttmRevenue === 0 ? ['No charges found in last 12 months'] : [],
      },
    };

    // Merge on top of existingData if provided
    let merged: UnifiedBusinessData;
    if (existingData) {
      merged = {
        ...existingData,
        revenue:   { ...existingData.revenue,   ...stripeSlice.revenue   },
        customers: { ...existingData.customers, ...stripeSlice.customers },
        metadata:  {
          ...existingData.metadata,
          sources: Array.from(new Set([...existingData.metadata.sources, 'Stripe'])),
          asOf:    new Date().toISOString(),
        },
      };
    } else {
      merged = {
        revenue:    stripeSlice.revenue!,
        costs:      { totalCOGS: 0, totalOpEx: 0, byCategory: [] },
        customers:  stripeSlice.customers!,
        operations: {},
        metadata:   stripeSlice.metadata!,
      };
    }

    return res.status(200).json({
      data: merged,
      summary: {
        ttmRevenue,
        mrr,
        arr,
        activeSubscriptions: subscriptions.length,
        customerCount:       customers.length,
        recentlyChurned,
        chargesCount:        charges.length,
        periodsImported:     byPeriod.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Stripe.errors.StripeAuthenticationError
      ? 'Invalid Stripe API key — check your secret key and try again'
      : err instanceof Stripe.errors.StripePermissionError
      ? 'Stripe key lacks required permissions (needs read access to charges, subscriptions, customers)'
      : err instanceof Error
      ? err.message
      : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
