import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import type { UnifiedBusinessData } from '../../types';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TONE = `
You are a sharp operating partner at a private equity firm and M&A advisor.
You work with lower-middle-market and middle-market companies ($5M–$250M revenue).
Be specific with numbers. Always answer "so what?" — causality-first, action-oriented.
No corporate jargon. Busy executives read the first sentence of each point only.
`;

interface CompanyProfile { industry?: string; revenueModel?: string; }

const INDUSTRY_LABELS: Record<string, string> = {
  'professional-services': 'Professional Services',
  'saas-technology': 'SaaS / Technology',
  'manufacturing': 'Manufacturing',
  'distribution': 'Distribution / Wholesale',
  'healthcare': 'Healthcare Services',
  'construction': 'Construction / Trades',
  'financial-services': 'Financial Services',
  'retail': 'Retail / E-commerce',
  'other': 'Other',
};
const REVENUE_MODEL_LABELS: Record<string, string> = {
  'recurring': 'Recurring / Subscription',
  'project': 'Project / Time & Materials',
  'transactional': 'Transactional / Product Sales',
  'mixed': 'Mixed',
};

function dataSummary(data: UnifiedBusinessData, prev?: UnifiedBusinessData, companyName?: string, companyProfile?: CompanyProfile): string {
  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const ebitda = rev - cogs - opex;
  const gp     = rev - cogs;
  const fmt    = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : `$${(n/1_000).toFixed(0)}k`;
  const pct    = (n: number, d: number) => d > 0 ? `${((n/d)*100).toFixed(1)}%` : 'N/A';

  const industryLine = companyProfile?.industry ? `Industry:       ${INDUSTRY_LABELS[companyProfile.industry] ?? companyProfile.industry}\n` : '';
  const revModelLine = companyProfile?.revenueModel ? `Revenue Model:  ${REVENUE_MODEL_LABELS[companyProfile.revenueModel] ?? companyProfile.revenueModel}\n` : '';

  return `${companyName ? `Company: ${companyName}\n` : ''}${industryLine}${revModelLine}
Revenue:        ${fmt(rev)}
COGS:           ${fmt(cogs)} (${pct(cogs, rev)} of revenue)
Gross Profit:   ${fmt(gp)} (${pct(gp, rev)} margin)
OpEx:           ${fmt(opex)} (${pct(opex, rev)} of revenue)
EBITDA:         ${fmt(ebitda)} (${pct(ebitda, rev)} margin)
Customers:      ${data.customers.totalCount} total, +${data.customers.newThisPeriod} new, -${data.customers.churned} churned
Retention Rate: ${((data.customers.retentionRate ?? 0.88) * 100).toFixed(1)}%
Top Customer:   ${data.customers.topCustomers[0]?.name ?? 'Unknown'} at ${data.customers.topCustomers[0]?.percentOfTotal?.toFixed(1) ?? 0}% of revenue
Top 3 Combined: ${data.customers.topCustomers.slice(0,3).reduce((s,c)=>s+c.percentOfTotal,0).toFixed(1)}% of revenue
${data.operations.headcount ? `Headcount:      ${data.operations.headcount} FTEs` : ''}
${prev ? `Prior Revenue:  ${fmt(prev.revenue.total)} (${(((rev - prev.revenue.total) / prev.revenue.total) * 100).toFixed(1)}% growth)` : ''}
Cost breakdown: ${data.costs.byCategory.map(c => `${c.category} $${(c.amount/1000).toFixed(0)}k`).join(', ')}
`.trim();
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned) as T; } catch {
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error('JSON parse failed');
  }
}

async function complete(prompt: string, maxTokens = 3000): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const r = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return r.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

// ── EXIT READINESS ─────────────────────────────────────────────────────────────
async function exitReadiness(data: UnifiedBusinessData, prev?: UnifiedBusinessData, companyName?: string, companyProfile?: CompanyProfile) {
  const prompt = `${TONE}

You are preparing a sell-side readiness assessment for a lower-middle-market company.

COMPANY DATA:
${dataSummary(data, prev, companyName, companyProfile)}

Return ONLY valid JSON with this exact structure (no markdown, no commentary):
{
  "overallScore": 72,
  "grade": "B+",
  "headline": "Strong margins with addressable concentration risk — 12-18 month window to optimize",
  "summary": "2-3 sentence executive summary of sell-side readiness.",
  "categories": [
    {
      "name": "Financial Health",
      "score": 75,
      "status": "strong",
      "findings": ["EBITDA margin of 12% is at LMM median", "Gross margin of 40% is healthy for sector"],
      "improvements": ["Cut 3-5% from COGS through vendor renegotiation", "Target 15%+ EBITDA to expand multiple range"]
    },
    {
      "name": "Customer Quality",
      "score": 58,
      "status": "adequate",
      "findings": ["Top customer at 20% creates concentration risk", "91% retention is above LMM median of 88%"],
      "improvements": ["Diversify top customer to <15% within 12 months", "Build 3-year contract renewals before process"]
    },
    {
      "name": "Operational Scalability",
      "score": 70,
      "status": "adequate",
      "findings": ["Revenue per employee is below $100k target", "No documented processes visible in data"],
      "improvements": ["Document key SOPs before diligence", "Build management depth to reduce founder dependency"]
    },
    {
      "name": "Growth Trajectory",
      "score": 65,
      "status": "adequate",
      "findings": ["Revenue growth is positive period-over-period", "Customer acquisition is net positive"],
      "improvements": ["Achieve 15%+ revenue growth to attract growth-oriented buyers", "Develop documented pipeline and sales process"]
    }
  ],
  "valuationRange": {
    "low": 4200000,
    "mid": 5800000,
    "high": 7400000,
    "ebitdaMultiple": "4.5–7.5x",
    "methodology": "Based on LTM EBITDA, adjusted for concentration risk and growth rate",
    "keyDrivers": ["Recurring revenue base", "Gross margin expansion potential", "Sector tailwinds"],
    "keyDetractors": ["Customer concentration", "Below-median EBITDA margin", "Headcount dependency"]
  },
  "topRisks": [
    { "risk": "Customer concentration", "detail": "Specific risk detail", "severity": "HIGH" },
    { "risk": "Second risk", "detail": "Specific detail", "severity": "MEDIUM" },
    { "risk": "Third risk", "detail": "Specific detail", "severity": "LOW" }
  ],
  "readinessActions": [
    { "action": "Specific action to take", "timeframe": "0-3 months", "impact": "HIGH", "category": "financial" },
    { "action": "Second action", "timeframe": "3-6 months", "impact": "HIGH", "category": "customers" },
    { "action": "Third action", "timeframe": "6-12 months", "impact": "MEDIUM", "category": "operations" },
    { "action": "Fourth action", "timeframe": "6-12 months", "impact": "MEDIUM", "category": "growth" }
  ],
  "timeline": "12-18 months to optimal exit window",
  "buyerProfile": "PE platform add-on or strategic acquirer in [sector]",
  "exitOptions": ["PE Sponsor Add-on", "Strategic Acquisition", "Management Buyout", "Partial Recapitalization"]
}

Be specific with every number. Use the actual company data provided. Do not use generic filler.`;

  const raw = await complete(prompt, 3500);
  return parseJSON(raw);
}

// ── BOARD MEETING PREP ─────────────────────────────────────────────────────────
async function boardMeetingPrep(data: UnifiedBusinessData, prev?: UnifiedBusinessData, companyName?: string, companyProfile?: CompanyProfile) {
  const prompt = `${TONE}

Prepare a board member for their upcoming board meeting. They need to walk in confident and prepared.

COMPANY DATA:
${dataSummary(data, prev, companyName, companyProfile)}

Return ONLY valid JSON:
{
  "talkingPoints": [
    { "point": "Lead with the revenue story: $820k this period, X% above prior — driven by Y", "category": "financial", "priority": "OPEN" },
    { "point": "Acknowledge the concentration risk proactively — show you have a plan", "category": "risk", "priority": "PROACTIVE" }
  ],
  "anticipatedQuestions": [
    {
      "question": "What's driving the margin compression this quarter?",
      "suggestedAnswer": "Specific, honest answer with a plan",
      "difficulty": "hard"
    },
    {
      "question": "How are we thinking about our top customer dependency?",
      "suggestedAnswer": "Specific plan to diversify",
      "difficulty": "medium"
    },
    {
      "question": "What's the outlook for next quarter?",
      "suggestedAnswer": "Forward-looking answer with specifics",
      "difficulty": "easy"
    }
  ],
  "keyAsks": [
    { "ask": "Approve $X capex investment for Y initiative", "rationale": "Will generate Z% return in 18 months", "category": "investment" },
    { "ask": "Endorse new customer diversification strategy", "rationale": "Reduces concentration risk before any exit process", "category": "strategy" }
  ],
  "doNotSay": [
    "Avoid saying 'we expect things to improve' without a specific plan",
    "Do not downplay the concentration risk — address it head-on"
  ],
  "openingStatement": "One strong sentence to open the meeting that sets the right tone",
  "closingAsk": "One specific thing you want the board to leave the meeting ready to do"
}

Generate 6+ talking points, 5+ Q&A pairs, 2-3 key asks. Make answers specific to this company's data.`;

  const raw = await complete(prompt, 3000);
  return parseJSON(raw);
}

// ── 90-DAY ACTION PLAN ─────────────────────────────────────────────────────────
async function actionPlan90Day(data: UnifiedBusinessData, prev?: UnifiedBusinessData, companyName?: string, companyProfile?: CompanyProfile) {
  const prompt = `${TONE}

Create a prioritized 90-day execution plan for this business. Focus on the highest-leverage actions.

COMPANY DATA:
${dataSummary(data, prev, companyName, companyProfile)}

Return ONLY valid JSON:
{
  "theme": "One sentence describing the quarter's strategic focus",
  "northStar": "The single most important metric to move this quarter",
  "categories": [
    {
      "name": "Revenue Growth",
      "goal": "Specific, measurable goal for the quarter",
      "actions": [
        {
          "action": "Specific action — what exactly to do",
          "why": "Why this matters to the business",
          "owner": "CEO / VP Sales / CFO etc.",
          "deadline": "Week 2",
          "expectedImpact": "$Xk additional ARR or X% improvement",
          "effort": "LOW",
          "priority": 1
        }
      ]
    },
    {
      "name": "Cost & Margin",
      "goal": "Specific margin target",
      "actions": []
    },
    {
      "name": "Customer Retention",
      "goal": "Specific retention or NPS goal",
      "actions": []
    },
    {
      "name": "Operations & Team",
      "goal": "Specific operational objective",
      "actions": []
    }
  ],
  "weekByWeek": [
    { "week": "Week 1-2", "focus": "Sprint focus description", "deliverables": ["Deliverable 1", "Deliverable 2"] },
    { "week": "Week 3-4", "focus": "Sprint focus", "deliverables": ["Deliverable 1"] },
    { "week": "Week 5-8", "focus": "Mid-quarter focus", "deliverables": ["Key milestone"] },
    { "week": "Week 9-12", "focus": "Close and measure", "deliverables": ["Review and adjust"] }
  ],
  "successMetrics": [
    { "metric": "Revenue", "baseline": "$820k", "target": "$X", "measurement": "Monthly revenue report" }
  ],
  "risks": ["Risk that could derail the plan", "Second risk"]
}

Generate 3-4 actions per category. Be specific — no generic advice. Use actual company data.`;

  const raw = await complete(prompt, 3500);
  return parseJSON(raw);
}

// ── GROWTH PLAYBOOK ────────────────────────────────────────────────────────────
async function growthPlaybook(data: UnifiedBusinessData, prev?: UnifiedBusinessData, companyName?: string, companyProfile?: CompanyProfile) {
  const prompt = `${TONE}

Build a revenue growth playbook for this business. Identify the highest-ROI growth levers.

COMPANY DATA:
${dataSummary(data, prev, companyName, companyProfile)}

Return ONLY valid JSON:
{
  "headline": "One sentence: the biggest untapped growth opportunity",
  "totalOpportunity": "$X additional revenue achievable in 12 months",
  "levers": [
    {
      "name": "Expand existing accounts",
      "description": "Specific opportunity based on company data",
      "revenueOpportunity": "$150k",
      "timeToRealize": "3-6 months",
      "effort": "LOW",
      "confidence": "HIGH",
      "actions": ["Specific action 1", "Specific action 2"],
      "owner": "Account Management / CEO"
    },
    {
      "name": "Reduce churn",
      "description": "Specific retention opportunity",
      "revenueOpportunity": "$80k saved annually",
      "timeToRealize": "1-3 months",
      "effort": "MEDIUM",
      "confidence": "HIGH",
      "actions": ["Action 1", "Action 2"],
      "owner": "Customer Success"
    },
    {
      "name": "New customer acquisition",
      "description": "Specific acquisition strategy",
      "revenueOpportunity": "$200k",
      "timeToRealize": "6-12 months",
      "effort": "HIGH",
      "confidence": "MEDIUM",
      "actions": ["Action 1", "Action 2"],
      "owner": "Sales / Marketing"
    },
    {
      "name": "Pricing optimization",
      "description": "Specific pricing opportunity",
      "revenueOpportunity": "$60k",
      "timeToRealize": "1-2 months",
      "effort": "LOW",
      "confidence": "MEDIUM",
      "actions": ["Action 1"],
      "owner": "CEO / Finance"
    }
  ],
  "priorityMatrix": {
    "doNow": ["Quick wins achievable in 30 days"],
    "planFor": ["Medium-term plays requiring 60-90 days"],
    "avoid": ["Growth traps that look attractive but drain resources"]
  },
  "customerInsights": {
    "expandAccounts": ["Specific upsell opportunities from customer data"],
    "churnRisk": ["Customers showing churn signals"],
    "referralPotential": "Specific referral strategy based on customer base"
  },
  "revenueModel": {
    "currentMix": "Description of current revenue composition",
    "recommendedMix": "What the revenue mix should look like in 12 months",
    "rationale": "Why this mix change increases business value"
  }
}

Generate 4+ growth levers with specific dollar amounts. Use actual company numbers throughout.`;

  const raw = await complete(prompt, 3000);
  return parseJSON(raw);
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured. Add it in Vercel → Settings → Environment Variables.' });
  }

  const { agent, data, previousData, companyName, companyProfile }: { agent: string; data: UnifiedBusinessData; previousData?: UnifiedBusinessData; companyName?: string; companyProfile?: CompanyProfile } = req.body;

  const name = (companyName && companyName !== 'My Company') ? companyName : undefined;
  const profile = (companyProfile?.industry || companyProfile?.revenueModel) ? companyProfile : undefined;
  try {
    let result;
    if      (agent === 'exit-readiness') result = await exitReadiness(data, previousData, name, profile);
    else if (agent === 'board-prep')     result = await boardMeetingPrep(data, previousData, name, profile);
    else if (agent === 'action-plan')    result = await actionPlan90Day(data, previousData, name, profile);
    else if (agent === 'growth-playbook')result = await growthPlaybook(data, previousData, name, profile);
    else return res.status(400).json({ error: 'Unknown agent' });

    return res.json({ result, agent });
  } catch (err) {
    console.error(`Agent ${agent} failed:`, err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Agent failed' });
  }
}
