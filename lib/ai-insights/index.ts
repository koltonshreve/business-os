import Anthropic from '@anthropic-ai/sdk';
import type {
  UnifiedBusinessData, KPIDashboard, WeeklyInsight,
  BoardDeck, AnomalyAlert
} from '../../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tone Foundation ──────────────────────────────────────────────────────────

const OPERATOR_TONE = `
You are a sharp operating partner at a private equity firm reviewing weekly business performance.
You think like an operator: causality-first, so-what focused, action-oriented.

RULES:
- Never describe metrics without explaining their cause
- Never state a problem without recommending an action
- Always answer "so what?" — why does this matter to the business?
- Use specific numbers, not approximations
- Bad: "Revenue decreased." Good: "Revenue declined 12% driven by lower project volume in the Southeast region, suggesting demand softness rather than pricing pressure."
- Operator language: "margin compression", "pull-forward demand", "churn acceleration", "CAC payback extending"
- No corporate jargon: no "synergies", "leverage", "robust pipeline"
- Be direct. Busy operators read the first sentence of each paragraph only.
`;

// ─── Weekly Insight Generation ────────────────────────────────────────────────

export async function generateWeeklyInsight(
  data: UnifiedBusinessData,
  dashboard: KPIDashboard,
  previousData?: UnifiedBusinessData,
  companyName?: string,
  additionalContext?: string
): Promise<WeeklyInsight> {
  const contextLine = [companyName ? `Company: ${companyName}` : '', additionalContext].filter(Boolean).join(' | ');
  const prompt = `${OPERATOR_TONE}

Generate a Weekly Executive Intelligence Report.${contextLine ? `\n${contextLine}` : ''}

CURRENT PERIOD DATA:
Revenue: $${(data.revenue.total / 1_000_000).toFixed(2)}M
COGS: $${(data.costs.totalCOGS / 1_000_000).toFixed(2)}M
OpEx: $${(data.costs.totalOpEx / 1_000_000).toFixed(2)}M
Customers Total: ${data.customers.totalCount}
New Customers: ${data.customers.newThisPeriod}
Churned: ${data.customers.churned}
Top Customer Concentration: ${data.customers.topCustomers.slice(0, 3).map(c => `${c.name}: ${c.percentOfTotal.toFixed(1)}%`).join(', ')}
${data.operations.headcount ? `Headcount: ${data.operations.headcount}` : ''}

KPI CHANGES:
${dashboard.kpis.map(k => `${k.name}: ${k.formattedValue}${k.changePercent !== undefined ? ` (${k.changePercent > 0 ? '+' : ''}${k.changePercent.toFixed(1)}% WoW)` : ''} [${k.status.toUpperCase()}]`).join('\n')}

ANOMALIES DETECTED:
${dashboard.anomalies.length ? dashboard.anomalies.map(a => `${a.severity}: ${a.metric} ${a.direction} — ${a.hypothesis}`).join('\n') : 'None'}

${previousData ? `PRIOR PERIOD REVENUE: $${(previousData.revenue.total/1_000_000).toFixed(2)}M` : ''}

Return ONLY valid JSON matching this exact schema:
{
  "weekOf": "${new Date().toISOString().slice(0, 10)}",
  "headline": "string — one sentence capturing the most important business development this week",
  "executiveSummary": "string — 3-4 sentences. What happened, what drove it, what it means, what needs attention.",
  "whatChanged": [
    { "area": "string", "observation": "string — specific change with numbers", "magnitude": "string — how big is this", "context": "string — why this matters" }
  ],
  "whyItMatters": [
    { "area": "string", "observation": "string", "magnitude": "string", "context": "string" }
  ],
  "whatToDoNext": [
    { "priority": "URGENT|HIGH|MEDIUM", "action": "string — specific action", "owner": "string — role", "deadline": "string", "expectedImpact": "string" }
  ],
  "metricsSnapshot": { "key": "formatted value string" }
}

Generate at least 3 items in whatChanged, 2 in whyItMatters, and 3 in whatToDoNext.`;

  const raw = await complete(prompt, 3000, true);
  return parseJSON<WeeklyInsight>(raw);
}

// ─── Anomaly Analysis ─────────────────────────────────────────────────────────

export async function analyzeAnomalies(
  anomalies: AnomalyAlert[],
  data: UnifiedBusinessData
): Promise<AnomalyAlert[]> {
  if (!anomalies.length) return [];

  const prompt = `${OPERATOR_TONE}

Analyze these performance anomalies and generate specific hypotheses and recommended actions.

BUSINESS CONTEXT:
Revenue: $${(data.revenue.total/1_000_000).toFixed(2)}M
Top customers: ${data.customers.topCustomers.slice(0,3).map(c => `${c.name} (${c.percentOfTotal.toFixed(1)}%)`).join(', ')}
Cost structure: COGS ${((data.costs.totalCOGS/data.revenue.total)*100).toFixed(1)}% of revenue

ANOMALIES TO ANALYZE:
${anomalies.map((a, i) => `${i+1}. ${a.metric}: ${a.direction} of ${a.deviation.toFixed(1)}σ — current: ${a.currentValue}`).join('\n')}

For each anomaly, provide:
1. Most likely root cause (specific, not generic)
2. What data to pull to confirm
3. Recommended action if confirmed

Return JSON array with same structure as input, but with enriched hypothesis and recommendedAction fields.`;

  const raw = await complete(prompt, 2000, true);
  try {
    return parseJSON<AnomalyAlert[]>(raw);
  } catch {
    return anomalies; // Return original if parsing fails
  }
}

// ─── Board Deck Generation ────────────────────────────────────────────────────

export async function generateBoardDeck(
  data: UnifiedBusinessData,
  dashboard: KPIDashboard,
  historicalData?: UnifiedBusinessData[],
  companyName?: string,
  additionalContext?: string
): Promise<BoardDeck> {
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const contextLine = [companyName ? `Company: ${companyName}` : '', additionalContext].filter(Boolean).join(' | ');

  const prompt = `${OPERATOR_TONE}

Generate a Monthly Board Commentary for executive reporting.
Month: ${month}${contextLine ? `\n${contextLine}` : ''}

PERFORMANCE DATA:
Revenue: $${(data.revenue.total/1_000_000).toFixed(2)}M
EBITDA: $${((data.revenue.total - data.costs.totalCOGS - data.costs.totalOpEx)/1_000_000).toFixed(2)}M
Gross Margin: ${(((data.revenue.total - data.costs.totalCOGS)/data.revenue.total)*100).toFixed(1)}%
Net New Customers: ${data.customers.newThisPeriod - data.customers.churned}
Total Customers: ${data.customers.totalCount}
${data.operations.headcount ? `Headcount: ${data.operations.headcount}` : ''}

KPIs:
${dashboard.kpis.map(k => `${k.name}: ${k.formattedValue} (${k.status})`).join('\n')}

${dashboard.anomalies.length ? `Anomalies: ${dashboard.anomalies.map(a => `${a.metric}: ${a.direction}`).join(', ')}` : ''}

${historicalData?.length ? `Historical Revenue: ${historicalData.map((d, i) => `Month -${historicalData.length-i}: $${(d.revenue.total/1_000_000).toFixed(2)}M`).join(', ')}` : ''}

Return JSON:
{
  "month": "${month}",
  "executiveSummary": "string — 2-3 sentences, board-level, strategic framing",
  "financialPerformance": "string — detailed financial commentary with comparisons and analysis",
  "operationalHighlights": "string — operational efficiency, capacity, delivery performance",
  "customerUpdate": "string — customer health, concentration changes, notable wins/losses",
  "lookAhead": "string — next 30/60/90 day outlook with specific milestones",
  "keyDecisions": [
    { "decision": "string", "recommendation": "string", "rationale": "string" }
  ],
  "risks": [
    { "risk": "string", "mitigation": "string", "owner": "string" }
  ]
}

Board tone: factual, analytical, no spin. Boards need bad news framed honestly, not buried.
Include at least 2 key decisions and 3 risks.`;

  const raw = await complete(prompt, 3000);
  return parseJSON<BoardDeck>(raw);
}

// ─── Alert Generation ─────────────────────────────────────────────────────────

export async function generateAlerts(dashboard: KPIDashboard): Promise<{
  alerts: { severity: string; title: string; message: string; action: string }[];
}> {
  const redKPIs = dashboard.kpis.filter(k => k.status === 'red');
  const yellowKPIs = dashboard.kpis.filter(k => k.status === 'yellow');
  const anomalies = dashboard.anomalies;

  const alerts = [
    ...redKPIs.map(k => ({
      severity: 'HIGH',
      title: `${k.name} Below Threshold`,
      message: `${k.name} is ${k.formattedValue}${k.changePercent !== undefined ? `, down ${Math.abs(k.changePercent).toFixed(1)}% vs prior period` : ''}. ${k.description}`,
      action: `Review ${k.category} drivers immediately. Check for structural vs one-time factors.`,
    })),
    ...anomalies.filter(a => a.severity === 'HIGH').map(a => ({
      severity: 'HIGH',
      title: `Anomaly: ${a.metric}`,
      message: `${a.metric} shows unusual ${a.direction}: ${a.hypothesis}`,
      action: a.recommendedAction,
    })),
    ...yellowKPIs.map(k => ({
      severity: 'MEDIUM',
      title: `${k.name} Watch`,
      message: `${k.name} at ${k.formattedValue} — approaching threshold. Monitor closely.`,
      action: `Track daily for next 5 business days.`,
    })),
    ...anomalies.filter(a => a.severity === 'MEDIUM').map(a => ({
      severity: 'MEDIUM',
      title: `Watch: ${a.metric}`,
      message: a.hypothesis,
      action: a.recommendedAction,
    })),
  ];

  return { alerts };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function complete(prompt: string, maxTokens: number, fast = false): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Add it in Vercel → Settings → Environment Variables.');
  }
  const response = await client.messages.create({
    model: fast ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`JSON parse failed: ${cleaned.slice(0, 100)}`);
  }
}
