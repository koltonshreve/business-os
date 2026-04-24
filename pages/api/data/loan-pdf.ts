import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUser } from '../../../lib/session';

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { pdfBase64 } = req.body as { pdfBase64?: string };
  if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 required' });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user' as const,
        content: [
          {
            type: 'document' as const,
            source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdfBase64 },
          },
          {
            type: 'text' as const,
            text: `Extract all debt facilities, loans, and credit lines from this document.

Return ONLY a valid JSON array — no markdown, no explanation, just the array:
[
  {
    "name": "Full facility name (e.g. 'Senior Term Loan A')",
    "balance": outstanding_principal_balance_in_dollars,
    "rate": annual_interest_rate_as_a_number (e.g. 7.25 for 7.25%),
    "payment": monthly_payment_in_dollars,
    "type": "term" or "revolver" or "mezz",
    "maturity": "YYYY-MM-DD or empty string if not found"
  }
]

Rules:
- balance, rate, payment must be numbers (not strings)
- If monthly payment not stated but annual payment is, divide by 12
- If a field is genuinely not found, use 0 for numbers and "" for strings
- type: use "term" for term loans, "revolver" for revolving credit / lines of credit, "mezz" for mezzanine/subordinated debt
- Include every facility found, even if partial data
- Return [] if no debt found`
          }
        ]
      }]
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Extract JSON array from response (may have markdown fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'No debt data found in document', rawText: text.slice(0, 500) });
    }

    type DebtLine = { name: string; balance: number; rate: number; payment: number; type: 'term' | 'revolver' | 'mezz'; maturity?: string };
    const lines = JSON.parse(jsonMatch[0]) as DebtLine[];

    // Sanitize + add IDs
    const sanitized = lines.map((l, i) => ({
      id: `pdf${Date.now()}${i}`,
      name:    String(l.name    || 'Unnamed Facility'),
      balance: Number(l.balance || 0),
      rate:    Number(l.rate    || 0),
      payment: Number(l.payment || 0),
      type:    (['term','revolver','mezz'].includes(l.type) ? l.type : 'term') as 'term' | 'revolver' | 'mezz',
    }));

    return res.json({ lines: sanitized });
  } catch (err) {
    console.error('Loan PDF parse error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Parse failed' });
  }
}
