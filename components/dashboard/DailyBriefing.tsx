import { useState, useEffect } from 'react';
import type { UnifiedBusinessData } from '../../types';

interface BriefingItem {
  type: 'action' | 'insight' | 'warning';
  priority: 'urgent' | 'high' | 'medium';
  title: string;
  body: string;
  metric?: string;
  metricValue?: string;
  cta?: string;
  ctaAction?: string;
}

interface DailyBriefingProps {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  companyName: string;
  onAskAI: (msg: string) => void;
  onNavigate: (view: string) => void;
}

// ── Generate briefing from data (pure function, no API) ──────────────────────

function generateBriefing(data: UnifiedBusinessData, prev?: UnifiedBusinessData): BriefingItem[] {
  const items: BriefingItem[] = [];
  const rev   = data.revenue.total;
  const cogs  = data.costs.totalCOGS;
  const opex  = data.costs.totalOpEx;
  const gp    = rev - cogs;
  const ebitda = gp - opex;
  const gpM   = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaM = rev > 0 ? (ebitda / rev) * 100 : 0;
  const prevRev = prev?.revenue.total;
  const revGrowth = prevRev && prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : null;
  const topCust = data.customers.topCustomers[0];
  const retention = (data.customers.retentionRate ?? 0.88) * 100;
  const cf = data.cashFlow ?? [];
  const cash = cf.length ? cf[cf.length - 1].closingBalance : null;
  const avgBurn = cf.length > 1 ? cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / cf.length : null;
  const runway = cash !== null && avgBurn !== null && avgBurn < 0 ? Math.abs(cash / avgBurn) : null;
  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

  // ─── Urgent items ───────────────────────────────────────────────────────────

  if (runway !== null && runway < 3) {
    items.push({
      type: 'warning', priority: 'urgent',
      title: 'Cash runway critical',
      body: `At current burn, you have ${runway.toFixed(1)} months of runway. Immediate action required — extend cash or cut costs now.`,
      metric: 'Runway', metricValue: `${runway.toFixed(1)} mo`,
      cta: 'Analyze cash', ctaAction: 'cash',
    });
  }

  if (ebitda < 0) {
    const gap = fmtN(Math.abs(ebitda));
    items.push({
      type: 'warning', priority: 'urgent',
      title: 'Business operating at a loss',
      body: `EBITDA is ${fmtN(ebitda)} this period. The fastest path to breakeven is reducing OpEx by ${gap} or growing revenue to ${fmtN(rev + Math.abs(ebitda) * (rev / Math.max(gp, 1)))}.`,
      metric: 'EBITDA', metricValue: fmtN(ebitda),
      cta: 'Review finances', ctaAction: 'financial',
    });
  }

  // ─── High priority items ────────────────────────────────────────────────────

  if (topCust && topCust.percentOfTotal > 30) {
    items.push({
      type: 'warning', priority: 'high',
      title: `${topCust.name} is ${topCust.percentOfTotal.toFixed(0)}% of revenue`,
      body: `High concentration risk. If this account churns, you lose ${topCust.percentOfTotal.toFixed(0)}% of revenue instantly. Prioritize diversification and relationship strengthening.`,
      metric: 'Top customer', metricValue: `${topCust.percentOfTotal.toFixed(0)}%`,
      cta: 'View customers', ctaAction: 'customers',
    });
  }

  if (retention < 80) {
    const lostEst = Math.round(data.customers.totalCount * (1 - retention / 100));
    items.push({
      type: 'action', priority: 'high',
      title: `Retention at ${retention.toFixed(0)}% — ${lostEst} customers at risk`,
      body: `Below-median retention is quietly compounding. A 5-point improvement would add ~${fmtN(data.customers.avgRevenuePerCustomer * lostEst * 0.05 * 12 || 0)} in annual revenue.`,
      metric: 'Retention', metricValue: `${retention.toFixed(0)}%`,
      cta: 'Churn analysis', ctaAction: 'customers',
    });
  }

  if (runway !== null && runway < 6 && runway >= 3) {
    items.push({
      type: 'warning', priority: 'high',
      title: `Cash runway: ${runway.toFixed(1)} months`,
      body: `Runway is tightening. At current burn, you hit zero in ${Math.round(runway)} months. Start conversations with investors or identify cost reduction opportunities now.`,
      metric: 'Cash', metricValue: cash !== null ? fmtN(cash) : '—',
      cta: 'Scenario model', ctaAction: 'scenarios',
    });
  }

  // ─── Medium priority / positive insights ───────────────────────────────────

  if (revGrowth !== null && revGrowth > 15) {
    items.push({
      type: 'insight', priority: 'medium',
      title: `Revenue grew ${revGrowth.toFixed(1)}% — momentum is building`,
      body: `Strong growth above 15%. Now is the time to lock in more recurring revenue and invest in sales capacity before growth normalizes.`,
      metric: 'Rev growth', metricValue: `+${revGrowth.toFixed(1)}%`,
      cta: 'Growth analysis', ctaAction: 'financial',
    });
  }

  if (gpM >= 55 && ebitdaM >= 15) {
    items.push({
      type: 'insight', priority: 'medium',
      title: `Strong margins — ${gpM.toFixed(0)}% gross, ${ebitdaM.toFixed(0)}% EBITDA`,
      body: `Your margin profile is above average. This is the right time to invest in growth levers — sales, marketing, or new product lines — while profitability is healthy.`,
      metric: 'EBITDA margin', metricValue: `${ebitdaM.toFixed(1)}%`,
      cta: 'See opportunities', ctaAction: 'intelligence',
    });
  }

  if (revGrowth !== null && revGrowth >= 0 && revGrowth <= 5 && ebitdaM < 15) {
    items.push({
      type: 'action', priority: 'medium',
      title: 'Slow growth + thin margins — act now',
      body: `Revenue growth at ${revGrowth.toFixed(1)}% with ${ebitdaM.toFixed(1)}% EBITDA margin is a warning zone. Price increases and upsell campaigns typically deliver the fastest margin improvement.`,
      metric: 'Growth', metricValue: `${revGrowth.toFixed(1)}%`,
      cta: 'Ask AI for plan', ctaAction: 'ai',
    });
  }

  if (data.customers.newThisPeriod > 0 && data.customers.churned === 0) {
    items.push({
      type: 'insight', priority: 'medium',
      title: `${data.customers.newThisPeriod} new customers, zero churn this period`,
      body: 'Perfect net retention this period. Document what drove zero churn — was it product, service quality, or pricing? Use these insights to build a repeatable retention playbook.',
      metric: 'Net new', metricValue: `+${data.customers.newThisPeriod}`,
    });
  }

  // Pipeline items
  if (data.pipeline && data.pipeline.length > 0) {
    const totalPipeline = data.pipeline.reduce((s, d) => s + d.value, 0);
    const weighted = data.pipeline.reduce((s, d) => s + d.value * (d.probability / 100), 0);
    const coverage = rev > 0 ? weighted / rev : null;
    if (coverage !== null && coverage < 0.5) {
      items.push({
        type: 'action', priority: 'high',
        title: `Pipeline coverage is thin — ${(coverage * 100).toFixed(0)}% of current revenue`,
        body: `Weighted pipeline of ${fmtN(weighted)} is well below the 2× coverage target. Add more leads to the top of your funnel or accelerate deals already in progress.`,
        metric: 'Pipeline', metricValue: fmtN(totalPipeline),
        cta: 'Open pipeline', ctaAction: 'pipeline',
      });
    }
  }

  // ─── Fill with generic positive if too few items ────────────────────────────
  if (items.length === 0) {
    items.push({
      type: 'insight', priority: 'medium',
      title: 'Business fundamentals look solid',
      body: `Revenue is ${fmtN(rev)} with ${gpM.toFixed(1)}% gross margin and ${ebitdaM.toFixed(1)}% EBITDA margin. No critical issues detected — focus on growth and margin expansion.`,
      cta: 'Run full analysis', ctaAction: 'intelligence',
    });
  }

  // Cap at 4 items, sorted by priority
  const order = { urgent: 0, high: 1, medium: 2 };
  return items.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 4);
}

// ── Briefing Card ─────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  warning: {
    border: 'border-red-500/20',
    bg:     'bg-red-500/[0.04]',
    dot:    'bg-red-400',
    title:  'text-red-300',
  },
  action: {
    border: 'border-amber-500/20',
    bg:     'bg-amber-500/[0.03]',
    dot:    'bg-amber-400',
    title:  'text-amber-300',
  },
  insight: {
    border: 'border-emerald-500/15',
    bg:     'bg-emerald-500/[0.03]',
    dot:    'bg-emerald-400',
    title:  'text-emerald-300',
  },
};

const PRIORITY_LABEL: Record<BriefingItem['priority'], string> = {
  urgent: 'URGENT',
  high: 'HIGH',
  medium: 'MEDIUM',
};

function BriefingCard({
  item,
  onCta,
  onAskAI,
}: {
  item: BriefingItem;
  onCta: (action: string) => void;
  onAskAI: (msg: string) => void;
}) {
  const s = TYPE_STYLES[item.type];
  return (
    <div className={`flex items-start gap-3.5 px-4 py-3.5 rounded-xl border ${s.border} ${s.bg} transition-all`}>
      <div className="flex-shrink-0 mt-1">
        <div className={`w-2 h-2 rounded-full ${s.dot} ${item.priority === 'urgent' ? 'animate-pulse' : ''}`}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[12px] font-semibold leading-snug ${s.title}`}>{item.title}</span>
          {item.metricValue && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded-full border border-slate-700/40">
              {item.metric}: {item.metricValue}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{item.body}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {item.cta && item.ctaAction && item.ctaAction !== 'ai' && (
            <button
              onClick={() => onCta(item.ctaAction!)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                item.type === 'warning' ? 'text-red-400 border-red-500/25 hover:border-red-500/50 hover:bg-red-500/10'
                : item.type === 'action' ? 'text-amber-400 border-amber-500/25 hover:border-amber-500/50 hover:bg-amber-500/10'
                : 'text-emerald-400 border-emerald-500/25 hover:border-emerald-500/50 hover:bg-emerald-500/10'
              }`}
            >
              {item.cta} →
            </button>
          )}
          <button
            onClick={() => onAskAI(`${item.title}. ${item.body} What's the best action I can take today?`)}
            className="text-[11px] text-slate-500 hover:text-indigo-400 font-medium transition-colors"
          >
            Ask AI →
          </button>
        </div>
      </div>
      <div className="flex-shrink-0">
        <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${
          item.priority === 'urgent' ? 'text-red-400 bg-red-500/10 border-red-500/20'
          : item.priority === 'high' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          : 'text-slate-600 bg-slate-800/40 border-slate-700/30'
        }`}>{PRIORITY_LABEL[item.priority]}</span>
      </div>
    </div>
  );
}

// ── Main DailyBriefing ─────────────────────────────────────────────────────────

export default function DailyBriefing({ data, previousData, companyName, onAskAI, onNavigate }: DailyBriefingProps) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [lastGenerated, setLastGenerated] = useState<string>('');

  useEffect(() => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    setLastGenerated(today);
  }, []);

  const briefing = generateBriefing(data, previousData);
  const visibleItems = briefing.filter((_, i) => !dismissed.has(i));
  const urgentCount  = visibleItems.filter(i => i.priority === 'urgent').length;
  const highCount    = visibleItems.filter(i => i.priority === 'high').length;

  const handleCta = (action: string) => {
    if (action === 'ai') {
      onAskAI('What are my most important actions today based on my current business metrics?');
    } else {
      onNavigate(action);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-800/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 text-indigo-400">
              <path d="M6 1L7.2 4.2H10.5L7.9 6.3 8.9 9.5 6 7.5 3.1 9.5 4.1 6.3 1.5 4.2H4.8L6 1z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-slate-100">AI Briefing</span>
              {lastGenerated && (
                <span className="text-[10px] text-slate-600">{lastGenerated}</span>
              )}
            </div>
            {!expanded && visibleItems.length > 0 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {urgentCount > 0 && (
                  <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">
                    {urgentCount} urgent
                  </span>
                )}
                {highCount > 0 && (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                    {highCount} high
                  </span>
                )}
                <span className="text-[10px] text-slate-600">{visibleItems.length} items</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {urgentCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
              {urgentCount}
            </span>
          )}
          <svg
            viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className={`w-3 h-3 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M2 3.5L5 6.5 8 3.5"/>
          </svg>
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-slate-800/40 pt-3">
          {visibleItems.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-[12px] text-slate-600">All items dismissed</div>
              <button
                onClick={() => setDismissed(new Set())}
                className="mt-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Restore
              </button>
            </div>
          ) : (
            visibleItems.map((item, i) => (
              <div key={i} className="relative group">
                <BriefingCard item={item} onCta={handleCta} onAskAI={onAskAI}/>
                <button
                  onClick={() => setDismissed(prev => new Set([...Array.from(prev), briefing.indexOf(item)]))}
                  className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-700 hover:text-slate-400 w-5 h-5 flex items-center justify-center"
                  title="Dismiss"
                >
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3">
                    <path d="M2 2l6 6M8 2L2 8"/>
                  </svg>
                </button>
              </div>
            ))
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => onAskAI(`Give me a comprehensive daily briefing for ${companyName}. What are my most important priorities today?`)}
              className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
              Ask AI for deeper analysis
            </button>
            <span className="text-[10px] text-slate-700">Auto-generated from your data</span>
          </div>
        </div>
      )}
    </div>
  );
}
