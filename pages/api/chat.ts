import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import type { UnifiedBusinessData } from '../../types';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  const fmt    = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : `$${(n/1_000).toFixed(0)}k`;
  const pct    = (n: number, d: number) => d > 0 ? `${((n/d)*100).toFixed(1)}%` : 'N/A';

  const companyLine = companyName ? `Company: ${companyName}\n` : '';
  const viewLine = activeView && VIEW_LABELS[activeView]
    ? `The user is currently viewing the ${VIEW_LABELS[activeView]}.\n`
    : '';
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

HOW TO RESPOND:
- Be concise and direct — 2-5 sentences max unless asked to elaborate
- Always use the actual numbers from the data above
- Lead with the most important insight
- End with one specific, actionable recommendation
- If you spot a pattern in the trend data, mention it
- Don't say "based on the data" — just say the answer
- No disclaimers or caveats about being an AI`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured — add it to Vercel environment variables.' });
  }

  const { message, data, history = [], companyName, activeView, companyProfile }: { message: string; data: UnifiedBusinessData; history: Message[]; companyName?: string; activeView?: string; companyProfile?: { industry?: string; revenueModel?: string } } = req.body;

  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  try {
    const profileLine = companyProfile?.industry || companyProfile?.revenueModel
      ? `${companyProfile.industry ? `Industry: ${companyProfile.industry}` : ''}${companyProfile.revenueModel ? ` | Revenue model: ${companyProfile.revenueModel}` : ''}`.trim()
      : undefined;
    const systemContext = buildSystemContext(data, companyName, activeView, profileLine);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemContext,
      messages: [
        ...history.slice(-6).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
    });

    const reply = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Chat failed' });
  }
}
