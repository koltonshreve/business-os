// ─── /api/digest ──────────────────────────────────────────────────────────────
// POST — generate or return today's AI daily digest
// Returns cached digest if generated today, otherwise generates a fresh one.

import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { getDb, isDbConfigured } from '../../lib/db';
import { getSessionUser } from '../../lib/session';

interface DigestSection {
  headline: string;
  body: string;
}

export interface DigestPayload {
  date: string;
  greeting: string;
  northStar: string;               // single sentence: the #1 thing today
  sections: DigestSection[];       // top 3 priority areas
  closingLine: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Accept either a user session or the cron secret (for server-to-server calls)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization ?? '';
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!isCron) {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    companyName = 'your company',
    data,
    forceRefresh = false,
  } = req.body ?? {};

  // ── Check for cached digest (same calendar day) ───────────────────────────
  if (isDbConfigured() && !forceRefresh) {
    try {
      const sql = getDb();
      const rows = await sql`
        SELECT payload FROM bos_digest
        WHERE date = CURRENT_DATE
        ORDER BY created_at DESC
        LIMIT 1
      ` as unknown as Record<string, unknown>[];
      const cached = rows[0];
      if (cached?.payload) {
        return res.status(200).json({ ...(cached.payload as object), cached: true });
      }
    } catch { /* fall through to generate */ }
  }

  // ── Generate via Claude ───────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const client = new Anthropic({ apiKey });

  // Build a compact data summary for the prompt
  const snap = data ?? {};
  const rev = snap?.revenue?.total ?? 0;
  const cogs = snap?.costs?.totalCOGS ?? 0;
  const opex = snap?.costs?.totalOpEx ?? 0;
  const ebitda = rev - cogs - opex;
  const ebitdaM = rev > 0 ? ((ebitda / rev) * 100).toFixed(1) : '?';
  const topCust = snap?.customers?.topCustomers?.[0];
  const retention = snap?.customers?.retentionRate != null
    ? (snap.customers.retentionRate * 100).toFixed(1) : null;
  const cf = snap?.cashFlow ?? [];
  const cash = cf.length ? cf[cf.length - 1].closingBalance : null;
  const avgBurn = cf.length ? cf.reduce((s: number, p: {netCashFlow?: number}) => s + (p.netCashFlow ?? 0), 0) / cf.length : null;
  const runway = cash != null && avgBurn != null && avgBurn < 0
    ? Math.abs(cash / avgBurn).toFixed(1) : null;

  const fmtN = (n: number) => { const abs = Math.abs(n); return abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; };

  const dataLines = [
    `Revenue: ${fmtN(rev)}`,
    `EBITDA: ${fmtN(ebitda)} (${ebitdaM}% margin)`,
    topCust ? `Top customer: ${topCust.name} at ${topCust.percentOfTotal?.toFixed(0)}% of revenue` : null,
    retention ? `Customer retention: ${retention}%` : null,
    cash != null ? `Cash: ${fmtN(cash)}` : null,
    runway ? `Cash runway: ~${runway} months` : null,
  ].filter(Boolean).join('\n');

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const prompt = `You are an AI operating system for ${companyName}, a business operator in the lower-middle market focused on SMB acquisitions and operations.

Today is ${today}.

Current business snapshot:
${dataLines}

Generate a concise daily operating brief. Return ONLY valid JSON with this exact shape:
{
  "greeting": "string (one sentence, direct, no fluff)",
  "northStar": "string (the single most important thing to do or watch today, max 15 words)",
  "sections": [
    { "headline": "string (2-4 words, category name)", "body": "string (1-2 sentences, specific and actionable)" },
    { "headline": "string", "body": "string" },
    { "headline": "string", "body": "string" }
  ],
  "closingLine": "string (one motivating sentence, max 12 words)"
}

Requirements:
- Be direct, operator-focused, no corporate language
- Every sentence should be actionable or inform a decision
- Sections should cover the 3 highest-signal areas today (e.g. cash, deals, revenue)
- If metrics are strong, say so briefly and point to growth; if weak, name the specific fix
- The north star should be the one thing that moves the needle most today`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();

    let parsed: Omit<DigestPayload, 'date'>;
    try {
      // Strip all markdown fences, skip preamble, trim trailing garbage
      let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace >= 0 && lastBrace < cleaned.length - 1) cleaned = cleaned.slice(0, lastBrace + 1);

      try {
        parsed = JSON.parse(cleaned) as Omit<DigestPayload, 'date'>;
      } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('No JSON object found');
        parsed = JSON.parse(m[0]) as Omit<DigestPayload, 'date'>;
      }
    } catch {
      throw new Error(`Claude returned non-JSON response: ${raw.slice(0, 200)}`);
    }

    const payload: DigestPayload = {
      date: new Date().toISOString().split('T')[0],
      ...parsed,
    };

    // ── Persist to DB if available ─────────────────────────────────────────
    if (isDbConfigured()) {
      try {
        const sql = getDb();
        await sql`
          INSERT INTO bos_digest (date, payload)
          VALUES (CURRENT_DATE, ${JSON.stringify(payload)})
          ON CONFLICT (date) DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
        `;
      } catch { /* non-fatal */ }
    }

    return res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
