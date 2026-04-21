import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import type { UnifiedBusinessData } from '../../types';
import { getDb, isDbConfigured } from '../../lib/db';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Server-side rate limiter ───────────────────────────────────────────────────
const HOURLY_HARD_LIMIT = Number(process.env.AI_HOURLY_LIMIT ?? 30);
const DEMO_BYPASS_KEY   = process.env.DEMO_BYPASS_KEY ?? '';

const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now    = Date.now();
  const hourMs = 60 * 60 * 1000;
  const bucket = ipBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + hourMs });
    return { allowed: true, remaining: HOURLY_HARD_LIMIT - 1, resetIn: 60 };
  }
  if (bucket.count >= HOURLY_HARD_LIMIT) {
    const resetIn = Math.ceil((bucket.resetAt - now) / 60_000);
    return { allowed: false, remaining: 0, resetIn };
  }
  bucket.count++;
  return { allowed: true, remaining: HOURLY_HARD_LIMIT - bucket.count, resetIn: 60 };
}

const PLAN_MONTHLY_LIMITS: Record<string, number> = {
  starter: 5,
  growth:  50,
  pro:     999,
};

interface Message { role: 'user' | 'assistant'; content: string; }

const VIEW_LABELS: Record<string, string> = {
  overview: 'Overview dashboard',
  financials: 'Financials tab',
  customers: 'Customers tab',
  operations: 'Operations tab',
  agents: 'AI Agents tab',
  data: 'Data Sources tab',
};

function buildSystemContext(data: UnifiedBusinessData, companyName?: string, activeView?: string, profileLine?: string): string {
  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const ebitda = rev - cogs - opex;
  const gp     = rev - cogs;
  const fmt    = (n: number) => { const abs = Math.abs(n); return abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; };
  const pct    = (n: number, d: number) => d > 0 ? `${((n/d)*100).toFixed(1)}%` : 'N/A';

  const companyLine  = companyName ? `Company: ${companyName}\n` : '';
  const viewLine     = activeView && VIEW_LABELS[activeView] ? `The user is currently viewing the ${VIEW_LABELS[activeView]}.\n` : '';
  const industryLine = profileLine ? `${profileLine}\n` : '';

  return `You are an expert CFO and business analyst embedded inside a live business intelligence dashboard. You have complete access to this company's financial data and respond like a trusted advisor who knows the numbers cold.
${companyLine}${industryLine}${viewLine}

CURRENT COMPANY DATA:
- Revenue: ${fmt(rev)} | COGS: ${fmt(cogs)} (${pct(cogs,rev)}) | Gross Profit: ${fmt(gp)} (${pct(gp,rev)} margin)
- EBITDA: ${fmt(ebitda)} (${pct(ebitda,rev)} margin) | OpEx: ${fmt(opex)} (${pct(opex,rev)})
- Customers: ${data.customers.totalCount} total | +${data.customers.newThisPeriod} new | -${data.customers.churned} churned | ${((data.customers.retentionRate ?? 0.88)*100).toFixed(1)}% retention
- Top customers: ${data.customers.topCustomers.slice(0,4).map(c => `${c.name} ${c.percentOfTotal.toFixed(1)}%`).join(', ')}
${data.operations.headcount ? `- Headcount: ${data.operations.headcount} FTEs | Rev/employee: ${fmt(rev / data.operations.headcount)}` : ''}
- Revenue trend: ${data.revenue.byPeriod.map(p => `${p.period} ${fmt(p.revenue)}`).join(' → ')}
- Cost breakdown: ${data.costs.byCategory.map(c => `${c.category} ${fmt(c.amount)}`).join(', ')}
- Data period: ${data.metadata.coveragePeriod?.start ?? 'N/A'} to ${data.metadata.coveragePeriod?.end ?? 'N/A'}

LMM/MM BENCHMARKS FOR CONTEXT:
- Gross margin: median 42%, strong >48%
- EBITDA margin: median 14%, strong >20%
- Customer concentration: <15% per customer is acceptable, >20% is high risk
- Revenue retention: median 88%, strong >92%
- Revenue per employee: median $85k, strong >$120k

RESPONSE FORMAT — follow this structure exactly:

[status emoji] **[Bold headline: the single most important number or finding — max 12 words]**

[1–2 short sentences of context. Max 18 words each. Use the actual numbers. No filler.]

→ [One specific action. Start with a verb. Max 20 words.]

FORMATTING RULES:
- Open with exactly ONE status emoji that signals the finding's tone, followed by the bold headline:
    📉 declining metric  📈 growing metric  ✅ healthy / on track  ⚠️ risk or warning
    💡 insight or opportunity  🎯 target / goal  💰 money / profitability  👥 customers
- Always wrap the headline text in **double asterisks** (after the emoji)
- Always start the action line with "→ " (arrow + space)
- Use blank lines between the headline, context, and action
- Format numbers as: $26k, 12%, 3.2x, 94 days — never spell them out
- For lists (when asked), number them: "1. " "2. " "3. " — put a single relevant emoji before each item
- Never use "---" dividers
- Never say "Based on the data" or "It appears that"
- No disclaimers, caveats, or AI self-references
- If asked to elaborate, add a second context paragraph — still end with "→ " action`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured — add it to Vercel environment variables.' });
  }

  const {
    message, data, history = [], companyName, activeView, companyProfile,
    planId: clientPlanId = 'starter', queriesUsed = 0, bypassKey = '',
    stripeCustomerId = '', maxTokens = 600, stream: wantStream = false,
  }: {
    message: string; data: UnifiedBusinessData; history: Message[];
    companyName?: string; activeView?: string;
    companyProfile?: { industry?: string; revenueModel?: string };
    planId?: string; queriesUsed?: number; bypassKey?: string;
    stripeCustomerId?: string; maxTokens?: number; stream?: boolean;
  } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  // ── Demo bypass: operator key skips all limits ────────────────────────────
  const isDemoBypass = DEMO_BYPASS_KEY && bypassKey === DEMO_BYPASS_KEY;

  // ── Server-side plan verification ────────────────────────────────────────
  let planId = clientPlanId;
  if (!isDemoBypass && isDbConfigured() && stripeCustomerId) {
    try {
      const sql = getDb();
      const rows = await sql`
        SELECT plan_id FROM bos_user_plans WHERE stripe_customer_id = ${stripeCustomerId} LIMIT 1
      ` as { plan_id: string }[];
      if (rows.length > 0) planId = rows[0].plan_id;
    } catch { /* non-fatal: fall back to client-reported plan */ }
  }

  if (!isDemoBypass) {
    const monthlyLimit = PLAN_MONTHLY_LIMITS[planId] ?? PLAN_MONTHLY_LIMITS.starter;
    if (monthlyLimit < 999 && queriesUsed >= monthlyLimit) {
      return res.status(402).json({
        error: 'monthly_limit_reached',
        message: `You've used all ${monthlyLimit} AI queries on the ${planId} plan this month.`,
        upgradeRequired: true,
      });
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? 'unknown';
    const { allowed, remaining, resetIn } = checkRateLimit(ip);

    if (!allowed) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Hourly AI limit reached. Resets in ${resetIn} minute${resetIn !== 1 ? 's' : ''}.`,
        resetIn,
      });
    }

    if (remaining <= 5) res.setHeader('X-RateLimit-Remaining', remaining);
  }

  const profileLine = companyProfile?.industry || companyProfile?.revenueModel
    ? `${companyProfile.industry ? `Industry: ${companyProfile.industry}` : ''}${companyProfile.revenueModel ? ` | Revenue model: ${companyProfile.revenueModel}` : ''}`.trim()
    : undefined;
  const systemContext = buildSystemContext(data, companyName, activeView, profileLine);
  const msgList = [
    ...history.slice(-6).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];
  const tokenLimit = Math.min(Math.max(maxTokens, 200), 4000);

  // ── Non-streaming path (inline callers: P&L narrative, AR email, etc.) ────
  if (!wantStream) {
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: tokenLimit,
        system: systemContext,
        messages: msgList,
      });
      const reply = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
      return res.json({ reply });
    } catch (err) {
      console.error('Chat error:', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Chat failed' });
    }
  }

  // ── Streaming path (AIChat component) ─────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: tokenLimit,
      system: systemContext,
      messages: msgList,
    });

    stream.on('text', (textDelta: string) => {
      res.write(`data: ${JSON.stringify({ t: textDelta })}\n\n`);
    });

    await stream.finalMessage();
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Chat stream error:', err);
    const errMsg = err instanceof Error ? err.message : 'Chat failed';
    try {
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      res.end();
    } catch { /* response already ended */ }
  }
}
