// ─── /api/acq-targets/loi ────────────────────────────────────────────────────
// POST { target: AcquisitionTarget }
// Returns { subject, body } — a first-pass LOI draft for an acquisition target.

import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUser } from '../../../lib/session';
import type { AcquisitionTarget } from '../../../components/acquisition/AcquisitionPipeline';

const client = new Anthropic();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { target, buyerName } = req.body as { target?: AcquisitionTarget; buyerName?: string };
  if (!target) return res.status(400).json({ error: 'target required' });

  const buyer = buyerName || 'Buyer';
  const revenueM = target.revenue ? `$${(target.revenue / 1_000_000).toFixed(1)}M` : 'undisclosed';
  const ebitdaM  = target.ebitda  ? `$${(target.ebitda  / 1_000_000).toFixed(1)}M` : 'undisclosed';
  const askPrice = target.askingPrice ? `$${(target.askingPrice / 1_000_000).toFixed(1)}M` : 'to be negotiated';
  const multiple = target.multiple ? `${target.multiple.toFixed(1)}x EBITDA` : 'to be negotiated';

  const prompt = `You are an experienced lower middle market M&A attorney/advisor. Draft a non-binding Letter of Intent (LOI) for the following acquisition.

BUYER: ${buyer}
TARGET: ${target.name}
Industry: ${target.industry || 'undisclosed'}
Revenue: ${revenueM} | EBITDA: ${ebitdaM}
Asking Price: ${askPrice} (${multiple})
Stage: ${target.stage}
${target.thesisMatch ? `Strategic rationale: ${target.thesisMatch}` : ''}
${target.notes ? `Notes: ${target.notes}` : ''}

Write a professional, concise LOI (under 400 words) covering:
1. Parties and intent (non-binding)
2. Purchase price range and structure (% cash at close, % seller note, % earnout if applicable)
3. Key conditions (due diligence period, financing contingency, exclusivity period)
4. Confidentiality
5. Proposed timeline
6. Signature block placeholder

Use formal but readable language. Include [BRACKETED PLACEHOLDERS] for specific numbers or dates that need to be filled in. Mark the document DRAFT - NON-BINDING at the top.

Return valid JSON only: {"subject":"...", "body":"..."}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'Parse error', raw });

    return res.json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
