// ─── /api/acq-targets/meeting-prep ────────────────────────────────────────────
// POST { target: AcquisitionTarget }
// Generates a pre-call briefing with talking points, questions, and red flags.
// Uses Claude Haiku for speed.

import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUser } from '../../../lib/session';
import type { AcquisitionTarget } from '../../../components/acquisition/AcquisitionPipeline';

const client = new Anthropic();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { target } = req.body as { target?: AcquisitionTarget };
  if (!target) return res.status(400).json({ error: 'target required' });

  const revenueM = target.revenue ? `$${(target.revenue / 1_000_000).toFixed(1)}M` : 'unknown';
  const ebitdaM  = target.ebitda  ? `$${(target.ebitda  / 1_000_000).toFixed(1)}M` : 'unknown';
  const margin   = target.revenue && target.ebitda ? `${((target.ebitda / target.revenue) * 100).toFixed(1)}%` : 'unknown';
  const multiple = target.multiple ? `${target.multiple.toFixed(1)}x EBITDA` : 'unknown';

  const prompt = `You are an experienced lower middle market M&A advisor helping a buyer prepare for a call with a business owner.

Business: ${target.name}
Industry: ${target.industry}
Location: ${target.geography}
Revenue: ${revenueM} | EBITDA: ${ebitdaM} | EBITDA Margin: ${margin}
Asking Price: $${(target.askingPrice / 1_000_000).toFixed(1)}M at ${multiple}
Stage: ${target.stage}
Source: ${target.source}
Thesis Match: ${target.thesisMatch ?? 'not assessed'}
${target.notes ? `Notes: ${target.notes}` : ''}
${target.nextAction ? `Next Action: ${target.nextAction}` : ''}

Generate a concise pre-call meeting prep briefing. Return ONLY a JSON object (no markdown) with this exact structure:
{
  "talkingPoints": ["3-4 opening talking points to build rapport and establish credibility"],
  "questionsToAsk": ["5-6 specific, insightful due diligence questions appropriate for the current stage"],
  "redFlagsToProbe": ["3-4 specific risk areas to probe given the business profile"],
  "keyNumbers": ["3-4 important financial/operational metrics to validate on the call"]
}

Make it specific to this business. Questions should be appropriate for ${target.stage} stage.`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Failed to parse AI response' });

    const result = JSON.parse(match[0]) as {
      talkingPoints: string[];
      questionsToAsk: string[];
      redFlagsToProbe: string[];
      keyNumbers: string[];
    };

    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI request failed';
    return res.status(500).json({ error: msg });
  }
}
