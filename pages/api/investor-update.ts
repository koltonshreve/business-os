// ─── /api/investor-update ─────────────────────────────────────────────────────
// POST { data: UnifiedBusinessData, kpis: KPIResult[], goals: Goals, companyName: string }
// Returns { subject, body } — a formatted investor/board update memo.
// Uses Claude Haiku for speed + cost.

import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUser } from '../../lib/session';
import type { UnifiedBusinessData, KPIResult, Goals } from '../../types';

const client = new Anthropic();

function fmt(n: number, unit: string): string {
  if (unit === '$') {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
    return `$${n.toFixed(0)}`;
  }
  if (unit === '%') return `${n.toFixed(1)}%`;
  if (unit === '×') return `${n.toFixed(1)}×`;
  return n.toFixed(1);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { data, kpis, goals, companyName, period } = req.body as {
    data?: UnifiedBusinessData;
    kpis?: KPIResult[];
    goals?: Goals;
    companyName?: string;
    period?: string;
  };

  if (!data || !kpis) return res.status(400).json({ error: 'data and kpis required' });

  const name = companyName && companyName !== 'My Company' ? companyName : 'the company';
  const per  = period ?? 'this period';

  // Pick headline KPIs for the prompt
  const headline = (kpis as KPIResult[]).filter(k =>
    ['total-revenue','gross-margin','ebitda-margin','revenue-growth','retention-rate','cash-runway'].includes(k.id)
  ).slice(0, 6);

  const kpiLines = headline.map(k =>
    `• ${k.name}: ${fmt(k.value, k.unit ?? '')}${k.changePercent !== undefined ? ` (${k.changePercent >= 0 ? '+' : ''}${k.changePercent.toFixed(1)}% vs prior period)` : ''} — ${k.status === 'green' ? 'on track' : k.status === 'red' ? 'needs attention' : 'neutral'}`
  ).join('\n');

  const goalsObj = goals ?? {};
  const goalLines = Object.entries(goalsObj)
    .filter(([, v]) => v != null && (v as number) > 0)
    .slice(0, 4)
    .map(([k, v]) => `• ${k}: target ${fmt(v as number, k.includes('margin') || k.includes('growth') || k.includes('rate') ? '%' : '$')}`)
    .join('\n');

  const prompt = `You are a CFO advisor helping a lower middle market business owner write a concise investor/board update memo.

Company: ${name}
Period: ${per}
Revenue: ${fmt(data.revenue.total, '$')}
Employees: ${data.operations?.headcount ?? 'unknown'}

Key Metrics:
${kpiLines || '(no metrics available)'}

${goalLines ? `Active Goals:\n${goalLines}` : ''}

Write a professional, factual investor update memo. Use this structure:
1. SUBJECT LINE (one line, for email)
2. PERFORMANCE SUMMARY (2-3 sentences hitting the headline numbers)
3. HIGHLIGHTS (2-3 bullet points — what went well)
4. WATCH ITEMS (1-2 bullet points — what needs attention, if any)
5. FOCUS FOR NEXT PERIOD (1-2 bullet points — key priorities)

Tone: direct, no fluff, written as if the founder is sending it themselves. Avoid corporate jargon. Keep the whole thing under 250 words.

Respond with valid JSON only, no markdown fence:
{"subject":"...","body":"..."}`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'AI response parse error', raw });

    const result = JSON.parse(match[0]) as { subject: string; body: string };
    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
