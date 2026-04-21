import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import type { CSVUpload } from '../../../types';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_TYPES: CSVUpload['type'][] = [
  'revenue','costs','customers','operations','pipeline',
  'payroll','cashflow','ar_aging','transactions','suppliers','capacity',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { rawCsv, filename = '' } = req.body as { rawCsv?: string; filename?: string };
  if (!rawCsv?.trim()) return res.status(400).json({ error: 'rawCsv required' });

  // Cap to first 40 lines to keep token usage minimal
  const sample = rawCsv.split('\n').slice(0, 40).join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      messages: [{
        role: 'user' as const,
        content: `You are a data analyst for a business intelligence platform used by lower-middle-market companies.

Filename: "${filename}"

CSV sample (up to 40 rows):
\`\`\`
${sample}
\`\`\`

Data type definitions:
- revenue: periodic revenue by month/quarter/year with optional COGS
- costs: expense categories and dollar amounts (OpEx breakdown)
- customers: customer names with revenue, churn status, industry
- operations: headcount, billable hours, utilization rates
- pipeline: sales deals — stage, value, probability, close date
- payroll: department-level headcount and total compensation
- cashflow: cash in/out by period with opening and closing balances
- ar_aging: accounts receivable by bucket (current, 30d, 60d, 90d+)
- transactions: individual line-item transactions with date, amount, category
- suppliers: vendor/supplier names with spend amounts and categories
- capacity: resources with actual vs max volume, fixed and variable costs

Respond ONLY with valid JSON — no markdown fences, no explanation:
{
  "detectedType": "<one of the 11 types above>",
  "confidence": <integer 0-100>,
  "rationale": "<one concise sentence>",
  "columns": [
    { "original": "<exact header from csv>", "mapped": "<semantic field name or null if irrelevant>" }
  ]
}`,
      }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(422).json({ error: 'Could not parse AI response' });

    const parsed = JSON.parse(jsonMatch[0]) as {
      detectedType: CSVUpload['type'];
      confidence: number;
      rationale: string;
      columns: { original: string; mapped: string | null }[];
    };

    if (!VALID_TYPES.includes(parsed.detectedType)) parsed.detectedType = 'revenue';
    parsed.confidence = Math.max(0, Math.min(100, Math.round(parsed.confidence)));

    return res.json(parsed);
  } catch (err) {
    console.error('AI map error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'AI mapping failed' });
  }
}
