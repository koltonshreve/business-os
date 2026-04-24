// ─── /api/acq-targets/score ───────────────────────────────────────────────────
// POST { target } → { score: number, rationale: string[] }
// Uses Claude Haiku to score an acquisition target 1-10 with rationale bullets.

import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUser } from '../../../lib/session';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { target } = req.body as { target: Record<string, unknown> };
  if (!target) return res.status(400).json({ error: 'target required' });

  const { name, industry, geography, revenue, ebitda, askingPrice, multiple, stage, thesisMatch, notes, tags } =
    target as {
      name: string; industry: string; geography: string;
      revenue: number; ebitda: number; askingPrice: number; multiple: number;
      stage: string; thesisMatch?: string; notes?: string; tags?: string[];
    };

  const ebitdaMargin = revenue > 0 ? ((ebitda / revenue) * 100).toFixed(1) + '%' : 'N/A';
  const revenueMultiple = revenue > 0 ? (askingPrice / revenue).toFixed(2) + 'x' : 'N/A';

  const prompt = `You are a seasoned LMM (Lower Middle Market) M&A analyst specializing in acquisitions of businesses with $1M–$10M EBITDA. Score this acquisition target from 1–10 based on attractiveness, and give exactly 3 concise bullet rationale points (each under 15 words).

TARGET PROFILE
Company: ${name}
Industry: ${industry}
Geography: ${geography}
Revenue: $${(revenue || 0).toLocaleString()} | EBITDA: $${(ebitda || 0).toLocaleString()} (${ebitdaMargin} margin)
Asking: $${(askingPrice || 0).toLocaleString()} at ${(multiple || 0).toFixed(1)}x EBITDA (${revenueMultiple} revenue)
Stage: ${stage} | Thesis Match: ${thesisMatch ?? 'not evaluated'}
Tags: ${(tags ?? []).join(', ') || 'none'}
Notes: ${notes || 'none'}

SCORING CRITERIA
10 = Exceptional: ≤4x EBITDA, ≥20% margin, recurring revenue, motivated seller, strong thesis fit
7-9 = Attractive: solid fundamentals, minor concerns, fits LMM playbook
5-6 = Watchlist: mixed signals, negotiation needed to make it work
3-4 = Challenged: thin margins, high multiple, or poor thesis fit
1-2 = Pass: below 10% EBITDA margin, >7x multiple, or major red flags

Respond with valid JSON only (no markdown, no explanation outside JSON):
{"score":<integer 1-10>,"rationale":["bullet1","bullet2","bullet3"]}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Invalid AI response format' });

    const result = JSON.parse(match[0]) as { score: number; rationale: string[] };
    result.score = Math.min(10, Math.max(1, Math.round(result.score)));
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'AI scoring failed' });
  }
}
