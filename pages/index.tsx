import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import type { UnifiedBusinessData, KPIDashboard, WeeklyInsight, BoardDeck, Goals, Budget, CustomKPI, OnboardingData } from '../types';
import { DEMO_CUSTOMERS } from '../lib/demo-customers';
import { loadSession, saveSession, defaultSession } from '../lib/plan';
import KPIGrid from '../components/dashboard/KPIGrid';
import AlertFeed from '../components/dashboard/AlertFeed';
import RevenueChart from '../components/charts/RevenueChart';
import CostBreakdownChart from '../components/charts/CostBreakdownChart';
import CustomerMetricsChart from '../components/charts/CustomerMetricsChart';
import FinancialDashboard from '../components/dashboard/FinancialDashboard';
import CustomerDashboard from '../components/dashboard/CustomerDashboard';
import OperationsDashboard from '../components/dashboard/OperationsDashboard';
import IntelligenceDashboard from '../components/dashboard/IntelligenceDashboard';
import DataSourcePanel, { type CompanyProfile } from '../components/dashboard/DataSourcePanel';
import ScenarioModeler from '../components/dashboard/ScenarioModeler';
import CustomKPIPanel from '../components/dashboard/CustomKPIPanel';
import TrendSignalsPanel from '../components/dashboard/TrendSignalsPanel';
import AIChat from '../components/AIChat';
import TransactionLedger from '../components/dashboard/TransactionLedger';
import MetricThresholdsPanel, { type Threshold } from '../components/dashboard/MetricThresholdsPanel';
import AgentPanel from '../components/dashboard/AgentPanel';
import IndustryBenchmarksPanel from '../components/dashboard/IndustryBenchmarksPanel';
import PLStatement from '../components/PLStatement';
import BudgetPanel from '../components/dashboard/BudgetPanel';
import KanbanBoard from '../components/crm/KanbanBoard';
import AutomationBuilder from '../components/automation/AutomationBuilder';
import OnboardingFlow from '../components/onboarding/OnboardingFlow';

// ── Types ──────────────────────────────────────────────────────────────────────
type ActiveView = 'overview' | 'financial' | 'customers' | 'operations' | 'intelligence' | 'scenarios' | 'data' | 'pipeline' | 'automations';
type ToastType  = 'success' | 'error' | 'info';
interface ToastItem { id: string; type: ToastType; message: string; }
interface PeriodSnapshot { id: string; label: string; data: UnifiedBusinessData; createdAt: string; }

// ── Toast ──────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl border shadow-2xl text-[13px] backdrop-blur-sm ${
          t.type === 'success' ? 'bg-slate-950/95 border-emerald-500/30' :
          t.type === 'error'   ? 'bg-slate-950/95 border-red-500/30'     :
                                  'bg-slate-950/95 border-slate-700/60'
        }`}>
          <span className={`flex-shrink-0 text-sm font-bold ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-indigo-400'}`}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'i'}
          </span>
          <span className="text-slate-200 leading-snug max-w-[260px]">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="flex-shrink-0 text-slate-600 hover:text-slate-300 text-xl leading-none ml-1 transition-colors">×</button>
        </div>
      ))}
    </div>
  );
}

// ── Narrative Summary Bar ─────────────────────────────────────────────────────
function NarrativeBar({ data, previousData }: { data: UnifiedBusinessData; previousData?: UnifiedBusinessData }) {
  const rev      = data.revenue.total;
  const cogs     = data.costs.totalCOGS;
  const opex     = data.costs.totalOpEx;
  const gp       = rev - cogs;
  const ebitda   = gp - opex;
  const prevRev  = previousData?.revenue.total;
  const fmtN     = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;
  const gpMargin = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaM  = rev > 0 ? (ebitda / rev) * 100 : 0;
  const revGrowth = prevRev && prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : null;
  const topCust  = data.customers.topCustomers[0];
  const hasCash  = data.cashFlow && data.cashFlow.length > 0;
  const cash     = hasCash ? data.cashFlow![data.cashFlow!.length - 1].closingBalance : null;
  const avgBurn  = hasCash ? data.cashFlow!.reduce((s,p) => s + (p.netCashFlow ?? 0), 0) / data.cashFlow!.length : null;
  const runway   = cash != null && avgBurn != null && avgBurn < 0 ? Math.abs(cash / avgBurn) : null;

  const insights: { text: string; color: string; icon: string }[] = [];

  if (revGrowth !== null) {
    const dir = revGrowth >= 0 ? 'up' : 'down';
    insights.push({
      text: `Revenue ${dir} ${Math.abs(revGrowth).toFixed(1)}% vs prior period — ${fmtN(rev)} total`,
      color: revGrowth >= 0 ? 'text-emerald-400' : 'text-red-400',
      icon: revGrowth >= 0 ? '↑' : '↓',
    });
  }

  insights.push({
    text: `Gross margin ${gpMargin.toFixed(1)}% · EBITDA margin ${ebitdaM.toFixed(1)}%`,
    color: ebitdaM >= 15 ? 'text-emerald-400' : ebitdaM >= 5 ? 'text-amber-400' : 'text-red-400',
    icon: '◆',
  });

  if (topCust && topCust.percentOfTotal > 20) {
    insights.push({
      text: `Concentration risk: ${topCust.name} is ${topCust.percentOfTotal.toFixed(0)}% of revenue`,
      color: 'text-amber-400',
      icon: '⚠',
    });
  } else if (runway !== null && runway < 6) {
    insights.push({
      text: `Cash runway: ~${runway.toFixed(1)} months at current burn rate`,
      color: runway < 3 ? 'text-red-400' : 'text-amber-400',
      icon: '⚡',
    });
  } else if (ebitda > 0) {
    insights.push({
      text: `EBITDA positive — ${fmtN(ebitda)} operating profit this period`,
      color: 'text-emerald-400',
      icon: '✓',
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] flex-shrink-0 sm:w-20">Snapshot</div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-5 flex-1 min-w-0">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[11px] flex-shrink-0 ${ins.color}`}>{ins.icon}</span>
            <span className={`text-[12px] font-medium truncate ${ins.color}`}>{ins.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CEO Watchlist ─────────────────────────────────────────────────────────────
function CEOWatchlist({ data, previousData }: { data: UnifiedBusinessData; previousData?: UnifiedBusinessData }) {
  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  const rev      = data.revenue.total;
  const cogs     = data.costs.totalCOGS;
  const opex     = data.costs.totalOpEx;
  const gp       = rev - cogs;
  const ebitda   = gp - opex;
  const gpMargin = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaMargin = rev > 0 ? (ebitda / rev) * 100 : 0;
  const prevRev  = previousData?.revenue.total;
  const revGrowth = prevRev && prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : null;
  const topCust  = data.customers.topCustomers[0];
  const retention = (data.customers.retentionRate ?? 0.9) * 100;

  // Cash runway
  const cf = data.cashFlow ?? [];
  const latestCash = cf.length ? cf[cf.length - 1].closingBalance : null;
  const avgBurn = cf.length ? cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / cf.length : null;
  const runway = latestCash != null && avgBurn != null && avgBurn < 0
    ? Math.abs(latestCash / avgBurn) : null;

  interface WatchItem {
    priority: number;
    metric: string;
    current: string;
    benchmark: string;
    action: string;
    severity: 'red' | 'amber';
  }

  const items: WatchItem[] = [];

  // Rules checked in priority order
  if (runway !== null && runway < 6) {
    const deadlineMonth = new Date();
    deadlineMonth.setMonth(deadlineMonth.getMonth() + Math.round(runway));
    items.push({
      priority: 1, metric: 'Cash Runway', current: `${runway.toFixed(1)} months`,
      benchmark: '6+ months minimum',
      action: `Extend runway: raise or cut costs before ${deadlineMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} deadline`,
      severity: 'red',
    });
  }

  if (ebitda < 0) {
    const revenueNeeded = opex > 0 ? ((cogs + opex) - rev) / (1 - cogs / Math.max(rev, 1)) : -ebitda;
    const costCut = -ebitda;
    items.push({
      priority: items.length + 1, metric: 'EBITDA', current: fmtN(ebitda),
      benchmark: 'Breakeven minimum',
      action: `Reach breakeven: need ${fmtN(Math.max(revenueNeeded, 0))} more revenue at current margins OR cut ${fmtN(costCut)} in costs`,
      severity: 'red',
    });
  }

  if (topCust && topCust.percentOfTotal > 30) {
    items.push({
      priority: items.length + 1, metric: 'Customer Concentration',
      current: `${topCust.percentOfTotal.toFixed(0)}% (${topCust.name})`,
      benchmark: '<20% single customer',
      action: `Reduce concentration: ${topCust.name} at ${topCust.percentOfTotal.toFixed(0)}% poses existential churn risk`,
      severity: 'red',
    });
  }

  if (retention < 80) {
    const lostPerYear = Math.round(data.customers.totalCount * (1 - retention / 100));
    items.push({
      priority: items.length + 1, metric: 'Retention Rate',
      current: `${retention.toFixed(1)}%`,
      benchmark: '88%+ sector median',
      action: `Fix churn: ${retention.toFixed(0)}% retention means losing ~${lostPerYear} customers/year`,
      severity: 'red',
    });
  }

  if (gpMargin < 30) {
    items.push({
      priority: items.length + 1, metric: 'Gross Margin',
      current: `${gpMargin.toFixed(1)}%`,
      benchmark: '40%+ healthy services',
      action: `Improve gross margins: at ${gpMargin.toFixed(1)}% you're below the minimum for a healthy services business`,
      severity: 'red',
    });
  }

  if (ebitda >= 0 && ebitdaMargin < 10 && ebitdaMargin >= 0) {
    const gap = 15 - ebitdaMargin;
    items.push({
      priority: items.length + 1, metric: 'EBITDA Margin',
      current: `${ebitdaMargin.toFixed(1)}%`,
      benchmark: '14% LMM median',
      action: `Expand EBITDA margin from ${ebitdaMargin.toFixed(1)}% to 15%+ — closes ${gap.toFixed(1)}pp gap to benchmark`,
      severity: 'amber',
    });
  }

  if (revGrowth !== null && revGrowth < 5) {
    items.push({
      priority: items.length + 1, metric: 'Revenue Growth',
      current: `${revGrowth.toFixed(1)}%`,
      benchmark: '10%+ sustainable pace',
      action: `Accelerate growth: ${revGrowth.toFixed(1)}% growth is below sustainable pace for a services business`,
      severity: 'amber',
    });
  }

  if (topCust && topCust.percentOfTotal > 20 && topCust.percentOfTotal <= 30) {
    items.push({
      priority: items.length + 1, metric: 'Concentration Watch',
      current: `${topCust.percentOfTotal.toFixed(0)}% (${topCust.name})`,
      benchmark: '<20% threshold',
      action: `Watch concentration: ${topCust.name} trending toward risk threshold`,
      severity: 'amber',
    });
  }

  const top3 = items.slice(0, 3);

  const severityStyles = {
    red:   { dot: 'bg-red-500',   num: 'bg-red-500/15 text-red-400 border-red-500/25',   row: 'border-red-500/15 bg-red-500/4' },
    amber: { dot: 'bg-amber-400', num: 'bg-amber-500/15 text-amber-400 border-amber-500/25', row: 'border-amber-500/15 bg-amber-500/4' },
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-[13px] font-semibold text-slate-100">CEO Watchlist</div>
        <div className="text-[11px] text-slate-600">— top issues ranked by business impact</div>
      </div>

      {top3.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">✓</div>
          <div>
            <div className="text-[13px] font-semibold text-emerald-400">Strong foundation — focus on growth</div>
            <div className="text-[11px] text-slate-500 mt-0.5">No critical issues detected across runway, profitability, concentration, retention, or margins.</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {top3.map(item => {
            const s = severityStyles[item.severity];
            return (
              <div key={item.priority} className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${s.row}`}>
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 ${s.num}`}>
                  {item.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[12px] font-bold text-slate-100">{item.metric}</span>
                    <span className="text-[11px] font-semibold text-slate-400">{item.current}</span>
                    <span className="text-[10px] text-slate-600">· benchmark: {item.benchmark}</span>
                  </div>
                  <div className={`text-[12px] font-medium leading-relaxed ${item.severity === 'red' ? 'text-red-300' : 'text-amber-300'}`}>
                    {item.action}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Score history sparkline ───────────────────────────────────────────────────
function computeHealthScore(d: UnifiedBusinessData, prev?: UnifiedBusinessData): number {
  const rev = d.revenue.total, cogs = d.costs.totalCOGS, opex = d.costs.totalOpEx;
  const gp = rev - cogs, ebitda = gp - opex;
  const gpM = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaM = rev > 0 ? (ebitda / rev) * 100 : 0;
  const prevRev = prev?.revenue.total ?? 0;
  const revGrowth = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0;
  const topCustPct = d.customers.topCustomers[0]?.percentOfTotal ?? 0;
  const ret = (d.customers.retentionRate ?? 0.88) * 100;
  const rs = Math.round(prevRev > 0 ? Math.max(0, Math.min(100, 50 + revGrowth * 2)) : 60);
  const ms = Math.max(0, Math.min(100, ebitdaM >= 20 ? 100 : ebitdaM >= 10 ? 75 : ebitdaM >= 0 ? 50 : 25));
  const gs = Math.max(0, Math.min(100, gpM >= 60 ? 100 : gpM >= 40 ? 80 : gpM >= 25 ? 60 : 40));
  const cs = Math.max(0, Math.min(100, topCustPct <= 15 ? 100 : topCustPct <= 25 ? 75 : topCustPct <= 40 ? 50 : 25));
  const res = Math.max(0, Math.min(100, ret >= 95 ? 100 : ret >= 85 ? 75 : ret >= 70 ? 50 : 25));
  return Math.round(rs * 0.25 + ms * 0.25 + gs * 0.20 + cs * 0.15 + res * 0.15);
}

function HealthScoreHistory({ snapshots, activeId }: { snapshots: PeriodSnapshot[]; activeId: string }) {
  // Only show for non-demo user snapshots
  const userSnaps = snapshots.filter(s => !['demo', 'prev-demo'].includes(s.id));
  if (userSnaps.length < 2) return null;

  // Compute scores for each snapshot (each vs. the one before it in chronological order)
  const sorted = [...userSnaps].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const scored = sorted.map((snap, i) => ({
    label: snap.label,
    id: snap.id,
    score: computeHealthScore(snap.data, sorted[i - 1]?.data),
    isActive: snap.id === activeId,
  }));

  const min = Math.max(0, Math.min(...scored.map(s => s.score)) - 10);
  const max = Math.min(100, Math.max(...scored.map(s => s.score)) + 10);
  const range = max - min || 1;

  const W = 240, H = 48, pad = 8;
  const pts = scored.map((s, i) => {
    const x = pad + (i / Math.max(scored.length - 1, 1)) * (W - pad * 2);
    const y = H - pad - ((s.score - min) / range) * (H - pad * 2);
    return { x, y, ...s };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');

  const latest = scored[scored.length - 1];
  const prev2  = scored[scored.length - 2];
  const delta  = latest && prev2 ? latest.score - prev2.score : null;

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3 flex items-center gap-4">
      <div className="flex-shrink-0">
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Health Score Trend</div>
        <div className="flex items-center gap-2">
          <span className="text-[20px] font-bold text-slate-200 tabular-nums">{latest?.score ?? '—'}</span>
          {delta !== null && (
            <span className={`text-[11px] font-semibold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '→'} {Math.abs(delta)} pts
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-600 mt-0.5">{scored.length} periods tracked</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="flex-1 min-w-0 max-w-[240px]" style={{ height: H }}>
        {/* Area fill */}
        <defs>
          <linearGradient id="hst-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0"/>
          </linearGradient>
        </defs>
        {pts.length > 1 && (
          <polygon
            points={`${pts[0].x},${H - pad} ${polyline} ${pts[pts.length - 1].x},${H - pad}`}
            fill="url(#hst-grad)"
          />
        )}
        {/* Line */}
        {pts.length > 1 && (
          <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        )}
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.isActive ? 4 : 2.5}
            fill={p.isActive ? '#818cf8' : '#475569'}
            stroke={p.isActive ? '#312e81' : 'none'} strokeWidth="1.5">
            <title>{p.label}: {p.score}</title>
          </circle>
        ))}
      </svg>
      <div className="hidden sm:flex flex-col gap-1 flex-shrink-0 max-w-[100px]">
        {scored.slice(-3).map((s, i) => (
          <div key={i} className={`flex items-center justify-between gap-2 text-[10px] ${s.isActive ? 'text-indigo-300 font-semibold' : 'text-slate-600'}`}>
            <span className="truncate">{s.label.slice(0, 12)}</span>
            <span className="tabular-nums flex-shrink-0">{s.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Business Health Score ──────────────────────────────────────────────────────
function BusinessHealthScore({ data, previousData, onAskAI }: { data: UnifiedBusinessData; previousData?: UnifiedBusinessData; onAskAI?: (msg: string) => void }) {
  const rev      = data.revenue.total;
  const cogs     = data.costs.totalCOGS;
  const opex     = data.costs.totalOpEx;
  const gp       = rev - cogs;
  const ebitda   = gp - opex;
  const prevRev  = previousData?.revenue.total ?? 0;
  const gpMargin     = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaMargin = rev > 0 ? (ebitda / rev) * 100 : 0;
  const revGrowth    = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0;
  const topCustPct   = data.customers.topCustomers[0]?.percentOfTotal ?? 0;
  const retention    = (data.customers.retentionRate ?? 0.88) * 100;

  // Score components (0–100 each)
  const revScore    = Math.round(prevRev > 0 ? Math.max(0, Math.min(100, 50 + revGrowth * 2)) : 60);
  const marginScore = Math.max(0, Math.min(100, ebitdaMargin >= 20 ? 100 : ebitdaMargin >= 10 ? 75 : ebitdaMargin >= 0 ? 50 : 25));
  const gpScore     = Math.max(0, Math.min(100, gpMargin >= 60 ? 100 : gpMargin >= 40 ? 80 : gpMargin >= 25 ? 60 : 40));
  const custScore   = Math.max(0, Math.min(100, topCustPct <= 15 ? 100 : topCustPct <= 25 ? 75 : topCustPct <= 40 ? 50 : 25));
  const retScore    = Math.max(0, Math.min(100, retention >= 95 ? 100 : retention >= 85 ? 75 : retention >= 70 ? 50 : 25));

  const total = Math.round((revScore * 0.25 + marginScore * 0.25 + gpScore * 0.20 + custScore * 0.15 + retScore * 0.15));

  // Previous period score for delta
  const prevTotal = (() => {
    if (!previousData) return null;
    const pr = previousData.revenue.total, pc = previousData.costs.totalCOGS, po = previousData.costs.totalOpEx;
    const pg = pr - pc, pe = pg - po;
    const pPrevRev = prevRev; // already computed above
    const prevRevGrowth = pPrevRev > 0 ? ((pr - pPrevRev) / pPrevRev) * 100 : 0;
    const pRevS = Math.round(pPrevRev > 0 ? Math.max(0, Math.min(100, 50 + prevRevGrowth * 2)) : 60);
    const pEM   = pr > 0 ? (pe / pr) * 100 : 0;
    const pGM   = pr > 0 ? (pg / pr) * 100 : 0;
    const pTopC = previousData.customers.topCustomers[0]?.percentOfTotal ?? 0;
    const pRet  = (previousData.customers.retentionRate ?? 0.88) * 100;
    const pMarS = Math.max(0, Math.min(100, pEM >= 20 ? 100 : pEM >= 10 ? 75 : pEM >= 0 ? 50 : 25));
    const pGpS  = Math.max(0, Math.min(100, pGM >= 60 ? 100 : pGM >= 40 ? 80 : pGM >= 25 ? 60 : 40));
    const pCuS  = Math.max(0, Math.min(100, pTopC <= 15 ? 100 : pTopC <= 25 ? 75 : pTopC <= 40 ? 50 : 25));
    const pReS  = Math.max(0, Math.min(100, pRet >= 95 ? 100 : pRet >= 85 ? 75 : pRet >= 70 ? 50 : 25));
    return Math.round(pRevS * 0.25 + pMarS * 0.25 + pGpS * 0.20 + pCuS * 0.15 + pReS * 0.15);
  })();
  const scoreDelta = prevTotal !== null ? total - prevTotal : null;

  const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'F';
  const gradeColor = total >= 85 ? 'text-emerald-400' : total >= 70 ? 'text-sky-400' : total >= 55 ? 'text-amber-400' : 'text-red-400';
  const arcColor   = total >= 85 ? '#10b981' : total >= 70 ? '#38bdf8' : total >= 55 ? '#f59e0b' : '#ef4444';

  // SVG arc gauge
  const r = 54; const cx = 70; const cy = 70;
  const startAngle = -210; const sweepAngle = 240;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (pct: number) => {
    const end = startAngle + sweepAngle * (pct / 100);
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const large = sweepAngle * (pct / 100) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const components = [
    { label: 'Revenue Trend',    score: revScore,    icon: '↑' },
    { label: 'EBITDA Margin',    score: marginScore, icon: '◈' },
    { label: 'Gross Margin',     score: gpScore,     icon: '▲' },
    { label: 'Customer Risk',    score: custScore,   icon: '◎' },
    { label: 'Retention',        score: retScore,    icon: '↻' },
  ];

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
      {/* Gauge */}
      <div className="flex-shrink-0">
        <svg width="140" height="120" viewBox="0 0 140 110">
          {/* Track */}
          <path d={arcPath(100)} fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"/>
          {/* Fill */}
          {total > 0 && <path d={arcPath(total)} fill="none" stroke={arcColor} strokeWidth="8" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${arcColor}60)` }}/>}
          {/* Score */}
          <text x={cx} y={cy + 6} textAnchor="middle" className="font-bold" style={{ fill: arcColor, fontSize: 22, fontWeight: 700 }}>{total}</text>
          <text x={cx} y={cy + 22} textAnchor="middle" style={{ fill: '#64748b', fontSize: 10 }}>/ 100</text>
          {/* Grade */}
          <text x={cx} y={cy - 16} textAnchor="middle" style={{ fill: arcColor, fontSize: 11, fontWeight: 600 }}>{grade}</text>
        </svg>
        <div className="text-center -mt-2 text-[11px] font-semibold text-slate-500">Business Health</div>
        {scoreDelta !== null && (
          <div className={`text-center text-[10px] font-semibold mt-0.5 tabular-nums ${scoreDelta > 0 ? 'text-emerald-400/70' : scoreDelta < 0 ? 'text-red-400/70' : 'text-slate-600'}`}>
            {scoreDelta > 0 ? `▲ +${scoreDelta} vs prior` : scoreDelta < 0 ? `▼ ${scoreDelta} vs prior` : '→ unchanged'}
          </div>
        )}
      </div>

      {/* Components */}
      <div className="flex-1 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
        {components.map(c => {
          const color = c.score >= 75 ? 'text-emerald-400' : c.score >= 50 ? 'text-amber-400' : 'text-red-400';
          const bar   = c.score >= 75 ? 'bg-emerald-500/50' : c.score >= 50 ? 'bg-amber-500/50' : 'bg-red-500/50';
          return (
            <div key={c.label} className="space-y-1.5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] leading-tight">{c.label}</div>
              <div className={`text-[18px] font-bold ${color}`}>{c.score}</div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${c.score}%` }}/>
              </div>
            </div>
          );
        })}
        {onAskAI && (
          <div className="col-span-2 xs:col-span-3 sm:col-span-5 mt-1 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-600 leading-relaxed">
              {total >= 85 ? 'Strong across all dimensions — focus on growth.' :
               total >= 70 ? 'Solid fundamentals with room to improve.' :
               total >= 55 ? 'Some areas need attention — prioritize margin and retention.' :
               'Significant risks identified — review all components.'}
            </div>
            <button onClick={() => onAskAI(`My business health score is ${total}/100 (${grade}). Revenue trend ${revScore}/100, EBITDA margin ${marginScore}/100, gross margin ${gpScore}/100, customer concentration ${custScore}/100, retention ${retScore}/100. What are my top 3 most actionable improvements?`)}
              className="flex-shrink-0 ml-3 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
              Improve score
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Demo data ──────────────────────────────────────────────────────────────────
// All figures are internally consistent: total = sum(byPeriod), COGS/OpEx add up correctly.
const DEMO_DATA: UnifiedBusinessData = {
  revenue: {
    // Sum of 6 monthly periods below = 1,228,000
    total: 1228000, currency: 'USD',
    recurring: 737000,   // ~60% recurring (retainer / managed services)
    oneTime:   491000,   // ~40% project / one-time
    byPeriod: [
      { period: 'Oct 2024', periodType: 'monthly', revenue: 178000, cogs: 107000, ebitda: 26700,  recurring: 104000, oneTime: 74000 },
      { period: 'Nov 2024', periodType: 'monthly', revenue: 192000, cogs: 115000, ebitda: 28800,  recurring: 113000, oneTime: 79000 },
      { period: 'Dec 2024', periodType: 'monthly', revenue: 205000, cogs: 123000, ebitda: 30750,  recurring: 122000, oneTime: 83000 },
      { period: 'Jan 2025', periodType: 'monthly', revenue: 188000, cogs: 113000, ebitda: 28200,  recurring: 112000, oneTime: 76000 },
      { period: 'Feb 2025', periodType: 'monthly', revenue: 220000, cogs: 132000, ebitda: 33000,  recurring: 132000, oneTime: 88000 },
      { period: 'Mar 2025', periodType: 'monthly', revenue: 245000, cogs: 147000, ebitda: 36750,  recurring: 154000, oneTime: 91000 },
    ],
    byProduct: [
      { name: 'Managed Services',     amount: 614000, margin: 0.44 },
      { name: 'Consulting / Advisory', amount: 368000, margin: 0.42 },
      { name: 'Project Work',          amount: 246000, margin: 0.32 },
    ],
    byCustomer: DEMO_CUSTOMERS.slice(0, 8).map(c => ({ id: c.id, name: c.name, amount: c.revenue, percent: c.percentOfTotal })),
  },
  costs: {
    // COGS (737,000) + OpEx (307,000) = 1,044,000 total costs
    // GP = 1,228,000 − 737,000 = 491,000 (40.0% GM)
    // EBITDA = 491,000 − 307,000 = 184,000 (15.0% margin)
    totalCOGS: 737000,
    totalOpEx:  307000,
    byCategory: [
      // COGS categories (total 737,000)
      { category: 'Labor — Delivery',   amount: 445000, percentOfRevenue: 36.2 },
      { category: 'Subcontractors',     amount: 197000, percentOfRevenue: 16.0 },
      { category: 'Direct Overhead',    amount: 95000,  percentOfRevenue: 7.7  },
      // OpEx categories (total 307,000)
      { category: 'Sales & Marketing',  amount: 98000,  percentOfRevenue: 8.0  },
      { category: 'G&A',                amount: 118000, percentOfRevenue: 9.6  },
      { category: 'Tech & Systems',     amount: 91000,  percentOfRevenue: 7.4  },
    ],
    laborCost: 445000,
  },
  customers: {
    totalCount: 120, newThisPeriod: 8, churned: 3,
    topCustomers: DEMO_CUSTOMERS,
    avgRevenuePerCustomer: Math.round(1228000 / 120),
    retentionRate: 0.91,
    nps: 52,
  },
  operations: {
    headcount: 14,
    revenuePerEmployee: 87714,
    openPositions: 2,
    utilizationRate: 0.82,
  },
  pipeline: [
    { name: 'TechStart Inc — Enterprise Plan',    stage: 'Negotiation', value: 125000, probability: 75, closeDate: '2025-04-30', owner: 'Sarah K.' },
    { name: 'Global Logistics LLC',               stage: 'Proposal',    value: 220000, probability: 40, closeDate: '2025-05-20', owner: 'Mark D.' },
    { name: 'Metro Health Partners',              stage: 'Discovery',   value: 180000, probability: 20, closeDate: '2025-06-30', owner: 'Sarah K.' },
    { name: 'Pinnacle Mfg — Renewal',             stage: 'Negotiation', value: 95000,  probability: 80, closeDate: '2025-04-15', owner: 'Mark D.' },
    { name: 'Westfield Retail Group',             stage: 'Proposal',    value: 145000, probability: 35, closeDate: '2025-05-15', owner: 'Alex R.' },
    { name: 'Summit Capital Partners',            stage: 'Closed Won',  value: 88000,  probability: 100,closeDate: '2025-03-31', owner: 'Alex R.' },
    { name: 'Horizon Biotech',                    stage: 'Discovery',   value: 310000, probability: 15, closeDate: '2025-07-31', owner: 'Sarah K.' },
    { name: 'Pacific Coast Distribution',        stage: 'Negotiation', value: 72000,  probability: 65, closeDate: '2025-04-20', owner: 'Mark D.' },
  ],
  payrollByDept: [
    { department: 'Delivery / Operations', headcount: 5,  totalCompensation: 195000, avgSalary: 39000 },
    { department: 'Sales',                 headcount: 3,  totalCompensation: 108000, avgSalary: 36000 },
    { department: 'Engineering',           headcount: 3,  totalCompensation: 96000,  avgSalary: 32000 },
    { department: 'G&A / Admin',           headcount: 2,  totalCompensation: 60000,  avgSalary: 30000 },
    { department: 'Leadership',            headcount: 1,  totalCompensation: 84000,  avgSalary: 84000 },
  ],
  cashFlow: [
    { period: 'Oct 2024', openingBalance: 420000, receipts: 165000, payments: 138000, closingBalance: 447000, netCashFlow: 27000 },
    { period: 'Nov 2024', openingBalance: 447000, receipts: 178000, payments: 152000, closingBalance: 473000, netCashFlow: 26000 },
    { period: 'Dec 2024', openingBalance: 473000, receipts: 195000, payments: 164000, closingBalance: 504000, netCashFlow: 31000 },
    { period: 'Jan 2025', openingBalance: 504000, receipts: 172000, payments: 147000, closingBalance: 529000, netCashFlow: 25000 },
    { period: 'Feb 2025', openingBalance: 529000, receipts: 208000, payments: 170000, closingBalance: 567000, netCashFlow: 38000 },
    { period: 'Mar 2025', openingBalance: 567000, receipts: 235000, payments: 185000, closingBalance: 617000, netCashFlow: 50000 },
  ],
  arAging: [
    { customer: 'Acme Corp',       current: 68000, days30: 24000, days60: 0,     days90: 0,    over90: 0,    total: 92000 },
    { customer: 'Beta Industries', current: 52000, days30: 0,     days60: 14000, days90: 0,    over90: 0,    total: 66000 },
    { customer: 'Gamma LLC',       current: 38000, days30: 18000, days60: 0,     days90: 6000, over90: 0,    total: 62000 },
    { customer: 'Delta Partners',  current: 24000, days30: 8000,  days60: 0,     days90: 0,    over90: 0,    total: 32000 },
    { customer: 'Echo Systems',    current: 18000, days30: 0,     days60: 7000,  days90: 0,    over90: 4000, total: 29000 },
    { customer: 'Foxtrot Group',   current: 14000, days30: 0,     days60: 0,     days90: 0,    over90: 0,    total: 14000 },
  ],
  metadata: {
    sources: ['Demo Data'],
    asOf: new Date().toISOString(),
    coveragePeriod: { start: 'Oct 2024', end: 'Mar 2025' },
    completeness: 1.0,
    warnings: [],
  },
};

const PREV_DEMO: UnifiedBusinessData = {
  ...DEMO_DATA,
  revenue: {
    ...DEMO_DATA.revenue,
    total: 1040000,
    recurring: 624000,
    oneTime:   416000,
    byPeriod: [
      { period: 'Apr 2024', periodType: 'monthly', revenue: 148000, cogs: 89000,  ebitda: 22200 },
      { period: 'May 2024', periodType: 'monthly', revenue: 162000, cogs: 97000,  ebitda: 24300 },
      { period: 'Jun 2024', periodType: 'monthly', revenue: 175000, cogs: 105000, ebitda: 26250 },
      { period: 'Jul 2024', periodType: 'monthly', revenue: 165000, cogs: 99000,  ebitda: 24750 },
      { period: 'Aug 2024', periodType: 'monthly', revenue: 188000, cogs: 113000, ebitda: 28200 },
      { period: 'Sep 2024', periodType: 'monthly', revenue: 202000, cogs: 121000, ebitda: 30300 },
    ],
  },
  costs: {
    ...DEMO_DATA.costs,
    totalCOGS: 624000,
    totalOpEx:  260000,
  },
  customers: {
    ...DEMO_DATA.customers,
    totalCount: 112, newThisPeriod: 4, churned: 5,
    retentionRate: 0.87,
    // Scale prior-period revenues ~15% lower for byCustomer comparison
    topCustomers: DEMO_CUSTOMERS.map(c => ({
      ...c,
      revenue: Math.round(c.revenue * 0.85),
      percentOfTotal: parseFloat((c.percentOfTotal * 0.85).toFixed(1)),
    })),
  },
  cashFlow: [
    { period: 'Apr 2024', openingBalance: 320000, receipts: 138000, payments: 118000, closingBalance: 340000, netCashFlow: 20000 },
    { period: 'May 2024', openingBalance: 340000, receipts: 150000, payments: 131000, closingBalance: 359000, netCashFlow: 19000 },
    { period: 'Jun 2024', openingBalance: 359000, receipts: 162000, payments: 140000, closingBalance: 381000, netCashFlow: 22000 },
    { period: 'Jul 2024', openingBalance: 381000, receipts: 152000, payments: 134000, closingBalance: 399000, netCashFlow: 18000 },
    { period: 'Aug 2024', openingBalance: 399000, receipts: 175000, payments: 151000, closingBalance: 423000, netCashFlow: 24000 },
    { period: 'Sep 2024', openingBalance: 423000, receipts: 188000, payments: 164000, closingBalance: 447000, netCashFlow: 24000 },
  ],
};

const DEMO_SNAPSHOT: PeriodSnapshot = { id: 'demo', label: 'Q1 2025 (Demo)', data: DEMO_DATA, createdAt: new Date().toISOString() };
const PREV_SNAPSHOT: PeriodSnapshot = { id: 'prev-demo', label: 'Q2–Q3 2024 (Demo)', data: PREV_DEMO, createdAt: new Date().toISOString() };

// ── Goals Panel ───────────────────────────────────────────────────────────────
type GoalKey = keyof Goals;
interface GoalRowDef {
  key: GoalKey;
  label: string;
  actual: number;
  format: (v: number) => string;
  placeholder: string;
  step: number;
}

function GoalsPanel({ data, goals, onSetGoal }: {
  data: UnifiedBusinessData;
  goals: Goals;
  onSetGoal: (key: GoalKey, value: number | undefined) => void;
}) {
  const [editing, setEditing] = useState<GoalKey | null>(null);
  const [draft, setDraft] = useState('');

  const rev      = data.revenue.total;
  const cogs     = data.costs.totalCOGS;
  const opex     = data.costs.totalOpEx;
  const gp       = rev - cogs;
  const ebitda   = gp - opex;
  const retention = (data.customers.retentionRate ?? 0.88) * 100;

  const fmtCur = (n: number) =>
    n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  const rows: GoalRowDef[] = [
    { key: 'revenue',       label: 'Revenue',       actual: rev,                                         format: fmtCur, placeholder: 'e.g. 1200000', step: 50000 },
    { key: 'ebitdaMargin',  label: 'EBITDA Margin', actual: rev > 0 ? (ebitda/rev)*100 : 0,              format: v => `${v.toFixed(1)}%`,   placeholder: 'e.g. 20',    step: 1 },
    { key: 'grossMargin',   label: 'Gross Margin',  actual: rev > 0 ? (gp/rev)*100 : 0,                  format: v => `${v.toFixed(1)}%`,   placeholder: 'e.g. 55',    step: 1 },
    { key: 'retentionRate', label: 'Retention',     actual: retention,                                   format: v => `${v.toFixed(1)}%`,   placeholder: 'e.g. 92',    step: 1 },
    { key: 'revenueGrowth', label: 'Rev Growth',    actual: (() => { const periods = data.revenue.byPeriod; if (periods.length >= 2) { const last = periods[periods.length - 1].revenue; const prev2 = periods[periods.length - 2].revenue; return prev2 > 0 ? ((last - prev2) / prev2) * 100 : 0; } return 0; })(),             format: v => `${v.toFixed(1)}%`,   placeholder: 'e.g. 20',    step: 1 },
  ];

  const startEdit = (key: GoalKey) => {
    const cur = goals[key];
    setDraft(cur !== undefined ? String(cur) : '');
    setEditing(key);
  };

  const commitEdit = (key: GoalKey) => {
    const num = parseFloat(draft);
    if (!isNaN(num) && num > 0) onSetGoal(key, num);
    else if (draft === '') onSetGoal(key, undefined);
    setEditing(null);
  };

  // Summary: how many goals are set and how many are on track
  const setGoals = rows.filter(r => goals[r.key] != null && (goals[r.key] as number) > 0);
  const onTrack  = setGoals.filter(r => {
    const target = goals[r.key] as number;
    return r.actual >= target;
  });

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-3">
          <div className="text-[12px] font-semibold text-slate-300">Performance Targets</div>
          {setGoals.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {setGoals.map(r => {
                  const target = goals[r.key] as number;
                  const pct = r.actual / target;
                  return (
                    <div key={r.key}
                      className={`w-2 h-2 rounded-full ${pct >= 1 ? 'bg-emerald-400' : pct >= 0.75 ? 'bg-amber-400' : 'bg-slate-600'}`}
                      title={`${r.label}: ${(pct * 100).toFixed(0)}% of target`}/>
                  );
                })}
              </div>
              <span className="text-[10px] font-semibold text-slate-500">
                {onTrack.length}/{setGoals.length} on track
              </span>
            </div>
          )}
        </div>
        <div className="text-[10px] text-slate-600">Click any target to edit · Enter to save</div>
      </div>
      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
        {rows.map(row => {
          const target = goals[row.key];
          const attainment = target && target > 0 && row.actual > 0
            ? Math.min((row.actual / target) * 100, 150)
            : undefined;
          const isEditing = editing === row.key;
          const barColor = attainment !== undefined
            ? attainment >= 100 ? 'bg-emerald-500' : attainment >= 75 ? 'bg-amber-500' : 'bg-indigo-500/50'
            : 'bg-slate-700';

          return (
            <div key={row.key} className="space-y-1.5">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">{row.label}</div>
              <div className="text-[14px] font-bold text-slate-100">{row.format(row.actual)}</div>

              {/* Editable target */}
              {isEditing ? (
                <input
                  autoFocus
                  type="number"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(row.key); if (e.key === 'Escape') setEditing(null); }}
                  onBlur={() => commitEdit(row.key)}
                  placeholder={row.placeholder}
                  step={row.step}
                  className="w-full bg-slate-800/80 border border-indigo-500/50 rounded-md px-2 py-0.5 text-[11px] text-slate-100 focus:outline-none tabular-nums"
                />
              ) : (
                <button
                  onClick={() => startEdit(row.key)}
                  className={`w-full text-left text-[11px] font-medium px-1.5 py-0.5 rounded border transition-colors ${
                    target
                      ? 'text-slate-400 border-slate-800/40 hover:border-slate-700/60 hover:text-slate-300'
                      : 'text-slate-700 border-dashed border-slate-800/60 hover:border-slate-700 hover:text-slate-500'
                  }`}>
                  {target ? `Target: ${row.format(target)}` : '+ Set target'}
                </button>
              )}

              {/* Attainment bar */}
              <div className="h-1 bg-slate-800/60 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: attainment !== undefined ? `${Math.min(attainment, 100)}%` : '0%' }}/>
              </div>
              {attainment !== undefined && (
                <div className={`text-[9px] font-semibold ${attainment >= 100 ? 'text-emerald-400' : attainment >= 75 ? 'text-amber-400' : 'text-slate-600'}`}>
                  {attainment >= 100 ? '✓ On target' : `${attainment.toFixed(0)}% of target`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const Icons = {
  Overview: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/><rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/></svg>,
  Financial: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M2 9h3v3H2V9zm4-4h2v7H6V5zm4-3h2v10h-2V2zM1 13h12v1H1v-1z"/></svg>,
  Customers: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><circle cx="5" cy="4" r="2.5"/><path d="M0 12c0-2.76 2.24-5 5-5s5 2.24 5 5H0z"/><circle cx="11" cy="5" r="1.8"/><path d="M14 12c0-1.66-1.34-3-3-3-.48 0-.93.12-1.33.32A6.02 6.02 0 0111 12h3z"/></svg>,
  Operations: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M6 1a1 1 0 00-1 1v.26A5 5 0 002.37 8.5H2a1 1 0 000 2h.37A5 5 0 009 13.74V14a1 1 0 002 0v-.26A5 5 0 0013.63 8.5H14a1 1 0 000-2h-.37A5 5 0 009 2.26V2a1 1 0 00-1-1H6zm1 3a3 3 0 110 6 3 3 0 010-6z"/></svg>,
  Intelligence: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>,
  Data: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><ellipse cx="7" cy="3.5" rx="4.5" ry="2"/><path d="M2.5 6c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V3.5c0 1.1-2 2-4.5 2S2.5 4.6 2.5 3.5V6z"/><path d="M2.5 8.5c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V6c0 1.1-2 2-4.5 2S2.5 7.1 2.5 6v2.5z"/><path d="M2.5 11c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V8.5c0 1.1-2 2-4.5 2S2.5 9.6 2.5 8.5V11z"/></svg>,
  Scenarios: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M1 10h3v3H1v-3zm4-4h2v7H5V6zm4-5h2v12H9V1z"/><path d="M7 4.5L9.5 2 12 4.5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Pipeline:   () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M1 2h2.5v2H1V2zm0 4h2.5v2H1V6zm0 4h2.5v2H1v-2zm4-8h2.5v2H5V2zm0 4h2.5v2H5V6zm0 4h2.5v2H5v-2zm4-8h2.5v2H9V2zm0 4h2.5v2H9V6zm0 4h2.5v2H9v-2z"/></svg>,
  Automations: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M7 1L3 7h4l-1 6 5-6H8l1-6z"/></svg>,
  Spinner: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin flex-shrink-0"><path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/><path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/></svg>,
  Chevron: () => <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-2.5 h-2.5 flex-shrink-0"><path d="M2 3.5L5 6.5 8 3.5"/></svg>,
  Clock: () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="w-3 h-3 flex-shrink-0"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3.5l2 1.5"/></svg>,
  Check: () => <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 flex-shrink-0"><path d="M2 6l3 3 5-5"/></svg>,
  Pencil: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8zM11 3l-1-1-7 7v1h1l7-7z"/></svg>,
  Alert: () => <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path d="M7.02 1.5l-6 11A1 1 0 002 14h12a1 1 0 00.98-1.5l-6-11a1 1 0 00-1.96 0zM9 11H7v2h2v-2zm0-5H7v4h2V6z"/></svg>,
};

// ── Revenue Mix & Quality ─────────────────────────────────────────────────────
function RevenueQuality({ data, previousData }: { data: UnifiedBusinessData; previousData?: UnifiedBusinessData }) {
  const rev        = data.revenue.total;
  const recurring  = data.revenue.recurring ?? 0;
  const oneTime    = data.revenue.oneTime ?? (rev - recurring);
  const recurringPct = rev > 0 ? (recurring / rev) * 100 : 0;
  const oneTimePct   = rev > 0 ? (oneTime  / rev) * 100 : 0;
  const products   = data.revenue.byProduct ?? [];

  const prevRecurring    = previousData?.revenue.recurring;
  const prevRev          = previousData?.revenue.total ?? 0;
  const prevRecurringPct = prevRev > 0 && prevRecurring ? (prevRecurring / prevRev) * 100 : null;
  const recDelta         = prevRecurringPct !== null ? recurringPct - prevRecurringPct : null;

  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  // Revenue quality score (0–100)
  const recScore    = Math.min(100, recurringPct * 1.2);  // 83% recurring → 100
  const productHHI  = products.length > 0
    ? products.reduce((s, p) => { const pct = rev > 0 ? (p.amount / rev) * 100 : 0; return s + pct * pct; }, 0) / 10000
    : 1;
  const diversScore = Math.max(0, 100 - productHHI * 100 * 1.5);  // HHI 0→100
  const qualScore   = Math.round(recScore * 0.6 + diversScore * 0.4);
  const qualLabel   = qualScore >= 75 ? 'High Quality' : qualScore >= 50 ? 'Moderate' : 'Needs Work';
  const qualColor   = qualScore >= 75 ? 'text-emerald-400' : qualScore >= 50 ? 'text-amber-400' : 'text-red-400';
  const qualBg      = qualScore >= 75 ? 'bg-emerald-500/10 border-emerald-500/20' : qualScore >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';

  if (!recurring && !oneTime && products.length === 0) return null;

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 sm:px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Revenue Mix & Quality</div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${qualBg} ${qualColor}`}>
          {qualLabel} · {qualScore}/100
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Recurring vs one-time bar */}
        {(recurring > 0 || oneTime > 0) && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-medium text-slate-400">Recurring vs One-Time</div>
              {recDelta !== null && Math.abs(recDelta) >= 0.5 && (
                <div className={`text-[10px] font-semibold ${recDelta > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {recDelta > 0 ? '↑' : '↓'}{Math.abs(recDelta).toFixed(1)}pp MoM
                </div>
              )}
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {recurringPct > 0 && (
                <div className="bg-emerald-500/50 rounded-l-full transition-all" style={{ width: `${recurringPct}%` }}
                  title={`Recurring: ${fmtN(recurring)} (${recurringPct.toFixed(1)}%)`}/>
              )}
              {oneTimePct > 0 && (
                <div className="bg-slate-600/60 rounded-r-full transition-all" style={{ width: `${oneTimePct}%` }}
                  title={`One-time: ${fmtN(oneTime)} (${oneTimePct.toFixed(1)}%)`}/>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500/60 flex-shrink-0"/>
                <span className="text-[11px] text-slate-400">Recurring <span className="font-semibold text-emerald-400">{recurringPct.toFixed(0)}%</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-600/70 flex-shrink-0"/>
                <span className="text-[11px] text-slate-400">One-time <span className="font-semibold text-slate-300">{oneTimePct.toFixed(0)}%</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Product breakdown */}
        {products.length > 0 && (
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-slate-400 mb-1.5">By Product / Service</div>
            <div className="space-y-1.5">
              {products.slice(0, 3).map((p, i) => {
                const pct = rev > 0 ? (p.amount / rev) * 100 : 0;
                const COLORS = ['bg-indigo-500/50', 'bg-sky-500/50', 'bg-violet-500/50'];
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="text-[11px] text-slate-500 truncate flex-1 min-w-0">{p.name}</div>
                    <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden flex-shrink-0">
                      <div className={`h-full rounded-full ${COLORS[i]}`} style={{ width: `${pct}%` }}/>
                    </div>
                    <div className="text-[11px] font-medium text-slate-300 w-8 text-right tabular-nums">{pct.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {recurringPct < 40 && rev > 0 && (
        <div className="mt-3 text-[11px] text-amber-400/80 font-medium">
          ⚠ {recurringPct.toFixed(0)}% recurring revenue is below the 60% threshold that buyers reward with premium valuation multiples.
        </div>
      )}
    </div>
  );
}

// ── Rule-based Executive Summary ─────────────────────────────────────────────
function ExecutiveSummary({ data, previousData }: { data: UnifiedBusinessData; previousData?: UnifiedBusinessData }) {
  const rev   = data.revenue.total;
  const cogs  = data.costs.totalCOGS;
  const opex  = data.costs.totalOpEx;
  const gp    = rev - cogs;
  const ebitda = gp - opex;
  const prevRev = previousData?.revenue.total;
  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;
  const gpM   = rev > 0 ? (gp / rev) * 100 : 0;
  const ebitdaM = rev > 0 ? (ebitda / rev) * 100 : 0;
  const growth  = prevRev && prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : null;
  const topCust = data.customers.topCustomers[0];
  const retention = (data.customers.retentionRate ?? 0) * 100;
  const cf = data.cashFlow ?? [];
  const cash = cf.length ? cf[cf.length - 1].closingBalance : null;
  const avgBurn = cf.length ? cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / cf.length : null;

  const sentences: string[] = [];

  // Revenue sentence
  if (growth !== null) {
    sentences.push(
      `Revenue is ${fmtN(rev)}, ${growth >= 0 ? 'up' : 'down'} ${Math.abs(growth).toFixed(1)}% vs the prior period, with gross margin at ${gpM.toFixed(1)}% and EBITDA margin at ${ebitdaM.toFixed(1)}%.`
    );
  } else {
    sentences.push(
      `Revenue totals ${fmtN(rev)} with ${gpM.toFixed(1)}% gross margin and ${ebitdaM.toFixed(1)}% EBITDA margin.`
    );
  }

  // Profitability / margin sentence
  if (ebitdaM < 0) {
    sentences.push(`The business is operating at a loss — EBITDA is ${fmtN(ebitda)}, suggesting the cost structure needs review before profitability can be achieved.`);
  } else if (ebitdaM < 10) {
    sentences.push(`EBITDA margin of ${ebitdaM.toFixed(1)}% is below the lower-middle-market median of 14%; improving delivery efficiency or pricing could close this gap.`);
  } else if (ebitdaM >= 20) {
    sentences.push(`EBITDA margin of ${ebitdaM.toFixed(1)}% is above the 20% threshold that typically commands premium valuation multiples.`);
  }

  // Customer / concentration risk
  if (topCust && topCust.percentOfTotal > 25) {
    sentences.push(`Customer concentration is elevated — ${topCust.name} represents ${topCust.percentOfTotal.toFixed(0)}% of revenue, which poses meaningful churn risk.`);
  } else if (retention > 0 && retention < 85) {
    sentences.push(`Retention at ${retention.toFixed(0)}% is below the 88% sector median — reducing churn by even 5 points would materially improve NRR and valuation.`);
  } else if (data.customers.totalCount >= 20) {
    sentences.push(`The customer base of ${data.customers.totalCount} accounts is reasonably diversified, with ${retention > 0 ? `${retention.toFixed(0)}% retention` : 'no retention data yet'}.`);
  }

  // Cash position
  if (cash !== null && avgBurn !== null && avgBurn < 0) {
    const runway = Math.abs(cash / avgBurn);
    sentences.push(
      runway < 6
        ? `Cash runway is a critical ${runway.toFixed(1)} months — fundraising or cost reduction should be the immediate priority.`
        : `Cash runway is approximately ${runway.toFixed(1)} months at current burn; ${runway < 12 ? 'preserve runway while working toward breakeven' : 'the balance sheet is in a healthy position'}.`
    );
  } else if (cash !== null && avgBurn !== null && avgBurn > 0) {
    sentences.push(`The business is cash flow positive, generating an average of ${fmtN(avgBurn)} per period with ${fmtN(cash)} in current cash.`);
  }

  if (sentences.length === 0) return null;

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 sm:px-5 py-3.5">
      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-2">Executive Summary</div>
      <div className="space-y-1">
        {sentences.map((s, i) => (
          <p key={i} className="text-[12px] text-slate-400 leading-relaxed">{s}</p>
        ))}
      </div>
    </div>
  );
}

// ── Biggest Movers Widget ─────────────────────────────────────────────────────
function BiggestMovers({ data, previous }: { data: UnifiedBusinessData; previous: UnifiedBusinessData }) {
  const calc = (d: UnifiedBusinessData) => {
    const rev = d.revenue.total, cogs = d.costs.totalCOGS, opex = d.costs.totalOpEx;
    const gp = rev - cogs, ebitda = gp - opex;
    return {
      'Revenue':        rev,
      'Gross Margin':   rev > 0 ? (gp / rev) * 100 : 0,
      'EBITDA Margin':  rev > 0 ? (ebitda / rev) * 100 : 0,
      'Customers':      d.customers.totalCount,
      'Retention':      (d.customers.retentionRate ?? 0) * 100,
      'Top Cust %':     d.customers.topCustomers[0]?.percentOfTotal ?? 0,
    };
  };
  const cur  = calc(data);
  const prev = calc(previous);

  // Inverse metrics (lower = better)
  const inverse = new Set(['Top Cust %']);

  const movers = (Object.keys(cur) as (keyof typeof cur)[]).map(key => {
    const c = cur[key], p = prev[key];
    const delta = p !== 0 ? ((c - p) / Math.abs(p)) * 100 : 0;
    const isGood = inverse.has(key) ? delta < 0 : delta > 0;
    return { key, delta, isGood };
  }).filter(m => Math.abs(m.delta) >= 0.5)
    .sort((a, b) => (b.isGood ? 1 : -1) - (a.isGood ? 1 : -1) || Math.abs(b.delta) - Math.abs(a.delta));

  const gainers = movers.filter(m => m.isGood  && m.delta > 0).slice(0, 3);
  const laggards = movers.filter(m => !m.isGood).slice(0, 3);

  if (!gainers.length && !laggards.length) return null;

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 sm:px-5 py-3.5">
      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em] mb-3">Biggest Movers vs Prior Period</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {gainers.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-emerald-500/60 uppercase tracking-[0.08em] mb-1.5">Improved</div>
            <div className="space-y-1.5">
              {gainers.map(m => (
                <div key={m.key} className="flex items-center gap-2">
                  <span className="text-emerald-400 text-xs flex-shrink-0">▲</span>
                  <span className="text-[12px] text-slate-300 flex-1">{m.key}</span>
                  <span className="text-[12px] font-semibold text-emerald-400 tabular-nums">{m.delta > 0 ? '+' : ''}{m.delta.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {laggards.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-red-500/60 uppercase tracking-[0.08em] mb-1.5">Declined</div>
            <div className="space-y-1.5">
              {laggards.map(m => (
                <div key={m.key} className="flex items-center gap-2">
                  <span className="text-red-400 text-xs flex-shrink-0">▼</span>
                  <span className="text-[12px] text-slate-300 flex-1">{m.key}</span>
                  <span className="text-[12px] font-semibold text-red-400 tabular-nums">{m.delta.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pipeline Snapshot ─────────────────────────────────────────────────────────
function PipelineSnapshot({ data, onAskAI }: { data: UnifiedBusinessData; onAskAI?: (msg: string) => void }) {
  const pipeline = data.pipeline;
  if (!pipeline || pipeline.length === 0) return null;

  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  const totalValue    = pipeline.reduce((s, d) => s + d.value, 0);
  const weightedValue = pipeline.reduce((s, d) => s + d.value * (d.probability / 100), 0);
  const coverage      = data.revenue.total > 0 ? weightedValue / data.revenue.total : null;

  // Group by stage
  const byStage: Record<string, { count: number; value: number; weighted: number }> = {};
  for (const deal of pipeline) {
    if (!byStage[deal.stage]) byStage[deal.stage] = { count: 0, value: 0, weighted: 0 };
    byStage[deal.stage].count++;
    byStage[deal.stage].value  += deal.value;
    byStage[deal.stage].weighted += deal.value * (deal.probability / 100);
  }

  const stageOrder = ['Prospect', 'Qualified', 'Proposal', 'Negotiation', 'Closing'];
  const stages = Object.entries(byStage).sort(([a], [b]) => {
    const ai = stageOrder.findIndex(s => a.toLowerCase().includes(s.toLowerCase()));
    const bi = stageOrder.findIndex(s => b.toLowerCase().includes(s.toLowerCase()));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const coverageColor = coverage === null ? 'text-slate-400' : coverage >= 2 ? 'text-emerald-400' : coverage >= 1 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-sky-500/15 border border-sky-500/25 flex items-center justify-center flex-shrink-0 text-sky-400 text-[10px] font-bold">⬡</div>
          <div className="text-[13px] font-semibold text-slate-100">Pipeline Snapshot</div>
          <div className="text-[11px] text-slate-600">{pipeline.length} deal{pipeline.length !== 1 ? 's' : ''}</div>
        </div>
        {onAskAI && (
          <button onClick={() => onAskAI(
            `My sales pipeline has ${pipeline.length} deals. ` +
            `Total pipeline value: ${fmtN(totalValue)}. Weighted (probability-adjusted): ${fmtN(weightedValue)}. ` +
            `Coverage ratio: ${coverage !== null ? coverage.toFixed(2) + 'x' : 'N/A'}. ` +
            `Stages: ${stages.map(([s, v]) => `${s}: ${v.count} deals worth ${fmtN(v.value)}`).join(', ')}. ` +
            `What should I focus on to close more pipeline this period?`
          )}
            className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
            Ask AI
          </button>
        )}
      </div>
      <div className="p-5">
        {/* Top stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Total Pipeline</div>
            <div className="text-[20px] font-bold text-slate-100 tabular-nums">{fmtN(totalValue)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Weighted Value</div>
            <div className="text-[20px] font-bold text-sky-400 tabular-nums">{fmtN(weightedValue)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Coverage Ratio</div>
            <div className={`text-[20px] font-bold tabular-nums ${coverageColor}`}>
              {coverage !== null ? `${coverage.toFixed(1)}×` : '—'}
            </div>
            <div className="text-[10px] text-slate-600">vs current ARR</div>
          </div>
        </div>

        {/* Stage funnel */}
        <div className="space-y-1.5">
          {stages.map(([stage, vals]) => {
            const pct = totalValue > 0 ? (vals.value / totalValue) * 100 : 0;
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className="text-[11px] text-slate-500 w-24 flex-shrink-0 truncate">{stage}</div>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500/50 rounded-full" style={{ width: `${pct}%` }}/>
                </div>
                <div className="text-[11px] text-slate-400 font-medium tabular-nums w-14 text-right">{fmtN(vals.value)}</div>
                <div className="text-[10px] text-slate-600 w-8 text-right">{vals.count}</div>
              </div>
            );
          })}
        </div>

        {coverage !== null && coverage < 1 && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-red-400/80 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
            <span className="flex-shrink-0">⚠</span>
            Pipeline coverage below 1× — not enough deals to replace current revenue.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Exit Readiness Widget (reads persisted exit-readiness agent result) ────────
function ExitReadinessWidget({ onViewAll }: { onViewAll?: () => void }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const loadResult = () => {
    try {
      const saved = localStorage.getItem('bos_agent_results');
      if (saved) {
        const all = JSON.parse(saved) as Record<string, unknown>;
        if (all['exit-readiness']) setResult(all['exit-readiness'] as Record<string, unknown>);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadResult();
    const onStorage = (e: StorageEvent) => { if (e.key === 'bos_agent_results') loadResult(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  if (!result) {
    return (
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0 text-violet-400 text-[11px] font-bold">◈</div>
          <div className="text-[12px] font-semibold text-slate-300">Exit Readiness</div>
        </div>
        <div className="text-[11px] text-slate-600 leading-relaxed">Run the Exit Readiness agent to see your score, valuation range, and top risks.</div>
        {onViewAll && (
          <button onClick={onViewAll} className="self-start text-[11px] text-violet-400 hover:text-violet-300 font-semibold border border-violet-500/25 hover:border-violet-500/50 px-2.5 py-1 rounded-lg transition-all">
            Run assessment →
          </button>
        )}
      </div>
    );
  }

  const score = result.overallScore as number | undefined;
  const grade = result.grade as string | undefined;
  const headline = result.headline as string | undefined;
  const vr = result.valuationRange as { low?: number; mid?: number; high?: number; ebitdaMultiple?: number } | undefined;
  const topRisks = result.topRisks as Array<{ risk: string; severity: string }> | undefined;
  const timeline = result.timeline as string | undefined;

  const scoreColor = (score ?? 0) >= 75 ? 'text-emerald-400' : (score ?? 0) >= 55 ? 'text-amber-400' : 'text-red-400';
  const scoreBg    = (score ?? 0) >= 75 ? 'bg-emerald-500/10 border-emerald-500/25' : (score ?? 0) >= 55 ? 'bg-amber-500/10 border-amber-500/25' : 'bg-red-500/10 border-red-500/25';

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0 text-violet-400 text-[10px] font-bold">◈</div>
          <div className="text-[12px] font-semibold text-slate-100">Exit Readiness</div>
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="text-[10px] text-violet-400 hover:text-violet-300 font-medium border border-violet-500/20 hover:border-violet-500/40 px-2 py-0.5 rounded-lg transition-all">
            Details →
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {/* Score + grade */}
        <div className="flex items-center gap-3">
          <div className={`text-[28px] font-bold tabular-nums leading-none ${scoreColor}`}>{score ?? '—'}</div>
          <div className="flex flex-col gap-0.5">
            <div className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${scoreBg} ${scoreColor}`}>Grade {grade ?? '—'}</div>
            {timeline && <div className="text-[10px] text-slate-600">{timeline}</div>}
          </div>
          {vr?.mid && (
            <div className="ml-auto text-right">
              <div className="text-[11px] font-bold text-slate-100">{fmtN(vr.mid)}</div>
              <div className="text-[10px] text-slate-600">mid valuation</div>
            </div>
          )}
        </div>
        {/* Valuation range bar */}
        {vr?.low && vr?.high && (
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
              <span>{fmtN(vr.low)} low</span>
              <span>{fmtN(vr.high)} high</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
              <div className="absolute inset-y-0 bg-violet-500/40 rounded-full" style={{
                left: '0%', right: '0%',
              }}/>
              {vr.mid && vr.low && vr.high && (
                <div className="absolute top-0 h-full w-0.5 bg-violet-400" style={{
                  left: `${((vr.mid - vr.low) / (vr.high - vr.low)) * 100}%`,
                }}/>
              )}
            </div>
            {vr.ebitdaMultiple && (
              <div className="text-[10px] text-slate-600 mt-1">{vr.ebitdaMultiple}× EBITDA implied</div>
            )}
          </div>
        )}
        {headline && <div className="text-[11px] text-slate-400 leading-relaxed">{headline}</div>}
        {/* Top risk */}
        {topRisks && topRisks.length > 0 && (
          <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
            <span className="text-red-400 text-[10px] flex-shrink-0 mt-0.5">⚠</span>
            <div className="text-[11px] text-red-400/80">{topRisks[0].risk}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Growth Playbook Widget (reads persisted growth-playbook agent result) ───────
function GrowthPlaybookWidget({ onViewAll }: { onViewAll?: () => void }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const loadResult = () => {
    try {
      const saved = localStorage.getItem('bos_agent_results');
      if (saved) {
        const all = JSON.parse(saved) as Record<string, unknown>;
        if (all['growth-playbook']) setResult(all['growth-playbook'] as Record<string, unknown>);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadResult();
    const onStorage = (e: StorageEvent) => { if (e.key === 'bos_agent_results') loadResult(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  if (!result) {
    return (
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 text-emerald-400 text-[11px] font-bold">↑</div>
          <div className="text-[12px] font-semibold text-slate-300">Growth Playbook</div>
        </div>
        <div className="text-[11px] text-slate-600 leading-relaxed">Run the Growth Playbook agent to see your top revenue opportunities and levers.</div>
        {onViewAll && (
          <button onClick={onViewAll} className="self-start text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold border border-emerald-500/25 hover:border-emerald-500/50 px-2.5 py-1 rounded-lg transition-all">
            Run analysis →
          </button>
        )}
      </div>
    );
  }

  const headline = result.headline as string | undefined;
  const totalOpp = result.totalOpportunity as number | string | undefined;
  const levers = result.levers as Array<{ name: string; revenueOpportunity?: number | string; effort?: string; confidence?: string }> | undefined;

  const effortColor = (e?: string) => {
    const effort = (e ?? '').toUpperCase();
    return effort === 'LOW' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : effort === 'MEDIUM' || effort === 'MED' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
      : 'text-red-400 bg-red-500/10 border-red-500/20';
  };

  const top3Levers = (levers ?? []).slice(0, 3);

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 text-emerald-400 text-[11px] font-bold">↑</div>
          <div className="text-[12px] font-semibold text-slate-100">Growth Playbook</div>
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium border border-emerald-500/20 hover:border-emerald-500/40 px-2 py-0.5 rounded-lg transition-all">
            Details →
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {/* Total opportunity */}
        {totalOpp != null && (
          <div className="flex items-center gap-2">
            <div className="text-[22px] font-bold text-emerald-400 tabular-nums leading-none">
              {typeof totalOpp === 'number' ? fmtN(totalOpp) : totalOpp}
            </div>
            <div className="text-[11px] text-slate-500">total opportunity<br/>identified</div>
          </div>
        )}
        {headline && <div className="text-[11px] text-slate-400 leading-relaxed">{headline}</div>}
        {/* Top levers */}
        {top3Levers.length > 0 && (
          <div className="space-y-2">
            {top3Levers.map((lever, i) => (
              <div key={i} className="flex items-center gap-2.5 bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-[9px] font-bold text-emerald-400 flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-200 truncate">{lever.name}</div>
                  {lever.revenueOpportunity != null && (
                    <div className="text-[10px] text-emerald-400/80 font-medium">
                      {typeof lever.revenueOpportunity === 'number' ? fmtN(lever.revenueOpportunity) : lever.revenueOpportunity}
                    </div>
                  )}
                </div>
                {lever.effort && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide flex-shrink-0 ${effortColor(lever.effort)}`}>
                    {lever.effort}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Top Priority Actions (reads persisted action-plan agent result) ───────────
function TopActionsWidget({ onRunAgent, onViewAll }: { onRunAgent?: () => void; onViewAll?: () => void }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const loadResult = () => {
    try {
      const saved = localStorage.getItem('bos_agent_results');
      if (saved) {
        const all = JSON.parse(saved) as Record<string, unknown>;
        if (all['action-plan']) setResult(all['action-plan'] as Record<string, unknown>);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadResult();
    const onStorage = (e: StorageEvent) => { if (e.key === 'bos_agent_results') loadResult(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) {
    return (
      <div className="bg-indigo-500/[0.04] border border-indigo-500/15 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-200 mb-0.5">90-Day Action Plan</div>
          <div className="text-[12px] text-slate-500">Run the AI Action Plan agent to see your top prioritized actions here, updated with every new period.</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onViewAll && (
            <button onClick={onViewAll}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm whitespace-nowrap">
              Generate plan →
            </button>
          )}
        </div>
      </div>
    );
  }

  const theme = result.theme as string | undefined;
  const northStar = result.northStar as string | undefined;
  const categories = result.categories as Array<{ name: string; actions: Array<{ action: string; why: string; owner: string; deadline: string; expectedImpact: string; effort: string; priority: number }> }> | undefined;

  // Flatten all actions and sort by priority, take top 3
  const allActions = (categories ?? []).flatMap(c => (c.actions ?? []).map(a => ({ ...a, category: c.name })));
  allActions.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  const top3 = allActions.slice(0, 3);

  if (top3.length === 0) return null;

  const effortColor = (e: string) => {
    const effort = (e ?? '').toUpperCase();
    return effort === 'LOW' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
      : effort === 'MEDIUM' || effort === 'MED' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
      : 'bg-red-500/10 border-red-500/20 text-red-400';
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 10 10" fill="currentColor" className="w-2.5 h-2.5 text-indigo-400">
              <path d="M1 5l3 3 5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div className="text-[13px] font-semibold text-slate-100">Top Priority Actions</div>
          {theme && <div className="hidden sm:block text-[11px] text-slate-500 truncate">— {theme}</div>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {northStar && (
            <div className="hidden md:flex items-center gap-1.5 text-[10px] font-semibold text-amber-400/80 bg-amber-500/8 border border-amber-500/15 px-2 py-0.5 rounded-full">
              ★ {northStar}
            </div>
          )}
          {onViewAll && (
            <button onClick={onViewAll}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all">
              Full plan →
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-slate-800/40">
        {top3.map((action, i) => (
          <div key={i} className="px-5 py-3.5 flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-indigo-400 flex-shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="text-[13px] font-semibold text-slate-100 leading-snug flex-1 min-w-0">{action.action}</div>
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                  {action.effort && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${effortColor(action.effort)}`}>
                      {action.effort}
                    </span>
                  )}
                  {action.deadline && (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-800/60 border border-slate-700/40 px-1.5 py-0.5 rounded">
                      {action.deadline}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {action.why && <div className="text-[11px] text-slate-500 leading-relaxed flex-1">{action.why}</div>}
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {action.owner && (
                  <span className="text-[10px] font-medium text-slate-600">Owner: <span className="text-slate-400">{action.owner}</span></span>
                )}
                {action.expectedImpact && (
                  <span className="text-[10px] font-semibold text-emerald-400/80">{action.expectedImpact}</span>
                )}
                {action.category && (
                  <span className="text-[10px] text-slate-700">{action.category}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Revenue Forecast Strip ────────────────────────────────────────────────────
function RevenueForecastStrip({ data, onAskAI }: { data: UnifiedBusinessData; onAskAI?: (msg: string) => void }) {
  const periods = data.revenue.byPeriod;
  if (periods.length < 3) return null; // need at least 3 data points

  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  // Simple linear regression on revenue
  const n = periods.length;
  const xs = periods.map((_, i) => i);
  const ys = periods.map(p => p.revenue);
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  const ssXX = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  const ssXY = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0);
  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;

  // R² for confidence
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Project next 3 periods
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const lastPeriod = periods[periods.length - 1].period;
  // Try to parse last period label to derive next labels
  function nextPeriodLabel(current: string, offset: number): string {
    // Match "Mon YYYY" pattern
    const match = current.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!match) return `Period +${offset}`;
    const monthIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === match[1].slice(0, 3).toLowerCase());
    if (monthIdx === -1) return `Period +${offset}`;
    const year = parseInt(match[2], 10);
    const newMonth = (monthIdx + offset) % 12;
    const yearOffset = Math.floor((monthIdx + offset) / 12);
    return `${MONTH_NAMES[newMonth]} ${year + yearOffset}`;
  }

  const forecasts = [1, 2, 3].map(offset => {
    const x = n - 1 + offset;
    const projected = slope * x + intercept;
    const stdErr = Math.sqrt(ssRes / Math.max(n - 2, 1));
    const uncertainty = stdErr * 1.5; // ~1.5 std devs for rough 85% interval
    return {
      label: nextPeriodLabel(lastPeriod, offset),
      value: Math.max(projected, 0),
      low: Math.max(projected - uncertainty, 0),
      high: projected + uncertainty,
    };
  });

  const growthPct = periods[0].revenue > 0 ? ((slope / meanY) * 100) : 0;
  const trendColor = slope > 0 ? 'text-emerald-400' : slope < 0 ? 'text-red-400' : 'text-slate-400';
  const confidenceLabel = r2 >= 0.85 ? 'High' : r2 >= 0.6 ? 'Moderate' : 'Low';
  const confidenceColor = r2 >= 0.85 ? 'text-emerald-400/70' : r2 >= 0.6 ? 'text-amber-400/70' : 'text-slate-500';

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="text-[13px] font-semibold text-slate-100">Revenue Forecast</div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`font-semibold ${trendColor}`}>
              {slope > 0 ? '↑' : slope < 0 ? '↓' : '→'} {Math.abs(growthPct).toFixed(1)}% avg/period trend
            </span>
            <span className="text-slate-700">·</span>
            <span className={`font-medium ${confidenceColor}`}>{confidenceLabel} confidence (R²={r2.toFixed(2)})</span>
          </div>
        </div>
        {onAskAI && (
          <button onClick={() => onAskAI(
            `My revenue trend over ${n} periods shows a ${slope > 0 ? 'positive' : 'negative'} slope of ${fmtN(Math.abs(slope))}/period (${Math.abs(growthPct).toFixed(1)}% avg growth). ` +
            `Forecasted next 3 periods: ${forecasts.map(f => `${f.label}: ${fmtN(f.value)}`).join(', ')}. ` +
            `R² = ${r2.toFixed(2)}. Is this trajectory realistic, and what risks could alter it?`
          )}
            className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
            Ask AI
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {forecasts.map((f, i) => {
          const vsLast = periods[periods.length - 1].revenue > 0 ? ((f.value - periods[periods.length - 1].revenue) / periods[periods.length - 1].revenue) * 100 : 0;
          const isUp = f.value >= periods[periods.length - 1].revenue;
          return (
            <div key={f.label} className={`rounded-xl border p-4 ${i === 0 ? 'border-indigo-500/25 bg-indigo-500/5' : 'border-slate-700/40 bg-slate-800/20'}`}>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1">{f.label}</div>
              <div className={`text-[18px] font-bold tracking-tight ${i === 0 ? 'text-indigo-300' : 'text-slate-300'}`}>{fmtN(f.value)}</div>
              <div className={`text-[11px] font-medium mt-1 ${isUp ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                {isUp ? '↑' : '↓'} {Math.abs(vsLast).toFixed(1)}% vs last
              </div>
              <div className="text-[10px] text-slate-700 mt-0.5">{fmtN(f.low)} – {fmtN(f.high)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-[10px] text-slate-700 leading-relaxed">
        Linear trend projection based on {n} historical periods. Range shows ±1.5 standard errors. Low confidence (R²&lt;0.6) indicates high revenue variability — treat as directional only.
      </div>
    </div>
  );
}

// ── Latest Period MoM Strip ───────────────────────────────────────────────────
function MonthlyTrendStrip({ data }: { data: UnifiedBusinessData }) {
  const periods = data.revenue.byPeriod;
  if (periods.length < 2) return null;
  const latest = periods[periods.length - 1];
  const prev   = periods[periods.length - 2];

  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  const revChange = prev.revenue > 0 ? ((latest.revenue - prev.revenue) / prev.revenue) * 100 : null;

  const latestGP = latest.revenue - (latest.cogs ?? 0);
  const prevGP   = prev.revenue   - (prev.cogs   ?? 0);
  const latestGM = latest.revenue > 0 ? (latestGP / latest.revenue) * 100 : null;
  const prevGM   = prev.revenue   > 0 ? (prevGP   / prev.revenue)   * 100 : null;
  const gmDelta  = latestGM !== null && prevGM !== null ? latestGM - prevGM : null;

  const latestEM = latest.revenue > 0 && latest.ebitda != null ? (latest.ebitda / latest.revenue) * 100 : null;
  const prevEM   = prev.revenue   > 0 && prev.ebitda   != null ? (prev.ebitda   / prev.revenue)   * 100 : null;
  const emDelta  = latestEM !== null && prevEM !== null ? latestEM - prevEM : null;

  const recurringPct = latest.recurring && latest.revenue > 0 ? (latest.recurring / latest.revenue) * 100 : null;

  const stats: { label: string; value: string; sub: string; good: boolean | null }[] = [];

  stats.push({
    label: 'Revenue',
    value: fmtN(latest.revenue),
    sub: revChange !== null ? `${revChange >= 0 ? '+' : ''}${revChange.toFixed(1)}% MoM` : `prev ${fmtN(prev.revenue)}`,
    good: revChange !== null ? revChange >= 0 : null,
  });

  if (latestGM !== null) {
    stats.push({
      label: 'Gross Margin',
      value: `${latestGM.toFixed(1)}%`,
      sub: gmDelta !== null ? `${gmDelta >= 0 ? '+' : ''}${gmDelta.toFixed(1)}pp MoM` : `${latestGM.toFixed(1)}% this period`,
      good: gmDelta !== null ? gmDelta >= 0 : latestGM >= 40,
    });
  }

  if (latestEM !== null) {
    stats.push({
      label: 'EBITDA Margin',
      value: `${latestEM.toFixed(1)}%`,
      sub: emDelta !== null ? `${emDelta >= 0 ? '+' : ''}${emDelta.toFixed(1)}pp MoM` : `14% LMM median`,
      good: emDelta !== null ? emDelta >= 0 : latestEM >= 14,
    });
  }

  if (recurringPct !== null) {
    stats.push({
      label: 'Recurring Mix',
      value: `${recurringPct.toFixed(0)}%`,
      sub: 'of period revenue',
      good: recurringPct >= 50,
    });
  }

  return (
    <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-slate-800/30">
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/50 flex-shrink-0"/>
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Latest Period</span>
        <span className="text-[12px] font-semibold text-slate-200">{latest.period}</span>
        <span className="text-slate-700 text-[10px]">vs</span>
        <span className="text-[11px] text-slate-500">{prev.period}</span>
      </div>
      <div className={`grid grid-cols-2 ${stats.length >= 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {stats.map((s, i) => (
          <div key={s.label} className={`px-4 py-3 ${i > 0 ? 'border-l border-slate-800/30' : ''}`}>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] mb-1">{s.label}</div>
            <div className="text-[15px] font-bold text-slate-100 tabular-nums">{s.value}</div>
            <div className={`text-[11px] font-semibold mt-0.5 tabular-nums ${
              s.good === true ? 'text-emerald-400' : s.good === false ? 'text-red-400' : 'text-slate-500'
            }`}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Period Comparison Strip ────────────────────────────────────────────────────
function ComparisonStrip({ current, previous, currentLabel, previousLabel }: {
  current: UnifiedBusinessData;
  previous: UnifiedBusinessData;
  currentLabel: string;
  previousLabel: string;
}) {
  const fmtN = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;
  const calc = (d: UnifiedBusinessData) => {
    const rev = d.revenue.total, cogs = d.costs.totalCOGS, opex = d.costs.totalOpEx;
    const gp = rev - cogs, ebitda = gp - opex;
    return {
      revenue: rev,
      grossMargin:  rev > 0 ? (gp / rev) * 100 : 0,
      ebitdaMargin: rev > 0 ? (ebitda / rev) * 100 : 0,
      customers: d.customers.totalCount,
      retention: (d.customers.retentionRate ?? 0) * 100,
      cash: d.cashFlow?.length ? d.cashFlow[d.cashFlow.length - 1].closingBalance : null,
    };
  };
  const cur  = calc(current);
  const prev = calc(previous);

  const metrics: { label: string; cur: string; prev: string; delta: number | null; isPoint?: boolean }[] = [
    { label: 'Revenue',      cur: fmtN(cur.revenue),                   prev: fmtN(prev.revenue),                   delta: prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : null },
    { label: 'Gross Margin', cur: `${cur.grossMargin.toFixed(1)}%`,    prev: `${prev.grossMargin.toFixed(1)}%`,    delta: cur.grossMargin - prev.grossMargin,  isPoint: true },
    { label: 'EBITDA Margin',cur: `${cur.ebitdaMargin.toFixed(1)}%`,   prev: `${prev.ebitdaMargin.toFixed(1)}%`,   delta: cur.ebitdaMargin - prev.ebitdaMargin, isPoint: true },
    { label: 'Customers',    cur: String(cur.customers),               prev: String(prev.customers),               delta: prev.customers > 0 ? ((cur.customers - prev.customers) / prev.customers) * 100 : null },
    ...(cur.cash !== null && prev.cash !== null ? [
      { label: 'Cash Balance', cur: fmtN(cur.cash), prev: fmtN(prev.cash), delta: prev.cash > 0 ? ((cur.cash - prev.cash) / prev.cash) * 100 : null }
    ] : [
      { label: 'Retention',  cur: `${cur.retention.toFixed(1)}%`, prev: `${prev.retention.toFixed(1)}%`, delta: cur.retention - prev.retention, isPoint: true }
    ]),
  ];

  return (
    <div className="mb-5 bg-slate-900/50 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-2 border-b border-slate-800/40 flex items-center gap-2.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Comparing</span>
        <span className="text-[12px] font-semibold text-indigo-300">{currentLabel}</span>
        <span className="text-[10px] text-slate-700">vs</span>
        <span className="text-[12px] font-medium text-slate-500">{previousLabel}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5">
        {metrics.map((m, i) => {
          const up    = m.delta !== null && m.delta > 0;
          const down  = m.delta !== null && m.delta < 0;
          const color = up ? 'text-emerald-400' : down ? 'text-red-400' : 'text-slate-500';
          return (
            <div key={m.label} className={`px-3 sm:px-5 py-3.5 ${i > 0 ? 'border-l border-slate-800/40' : ''}`}>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] mb-1 leading-tight">{m.label}</div>
              <div className="text-[15px] font-bold text-slate-100 tabular-nums">{m.cur}</div>
              {m.delta !== null ? (
                <div className={`text-[11px] font-semibold mt-0.5 tabular-nums ${color}`}>
                  {up ? '▲' : down ? '▼' : '—'} {Math.abs(m.delta).toFixed(1)}{m.isPoint ? 'pp' : '%'}
                </div>
              ) : <div className="text-[11px] text-slate-700 mt-0.5">—</div>}
              <div className="text-[10px] text-slate-600 mt-0.5 tabular-nums">prev: {m.prev}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Keyboard Shortcuts Modal ───────────────────────────────────────────────────
function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const rows = [
    { key: '⌘K',    desc: 'Open the AI chat assistant (Cmd+K / Ctrl+K)' },
    { key: '/',      desc: 'Open the AI chat assistant' },
    { key: '1 – 9',  desc: 'Jump to Overview, Financial, Customers, Operations, Intelligence, Pipeline, Automations, Scenarios, or Data Sources' },
    { key: '?',      desc: 'Open this shortcuts guide' },
    { key: 'Esc',    desc: 'Close any open overlay or modal' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm"/>
      <div className="relative bg-[#0d1117] border border-slate-700/60 rounded-2xl p-5 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[13px] font-semibold text-slate-100">Keyboard Shortcuts</div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xl leading-none transition-colors">×</button>
        </div>
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.key} className="flex items-start gap-3">
              <kbd className="text-[11px] font-mono font-bold bg-slate-800 border border-slate-700/60 text-slate-300 px-2 py-0.5 rounded-md flex-shrink-0 min-w-[38px] text-center mt-px">{r.key}</kbd>
              <span className="text-[12px] text-slate-400 leading-snug">{r.desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] text-slate-600">
          Shortcuts are inactive when a text input is focused
        </div>
      </div>
    </div>
  );
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportKPIsAsCSV(data: UnifiedBusinessData, label: string) {
  const rev = data.revenue.total;
  const cogs = data.costs.totalCOGS;
  const opex = data.costs.totalOpEx;
  const gp   = rev - cogs;
  const ebitda = gp - opex;
  const gm    = rev > 0 ? (gp / rev) * 100 : 0;
  const em    = rev > 0 ? (ebitda / rev) * 100 : 0;

  const rows: string[][] = [];
  rows.push(['Business OS Export', label, new Date().toLocaleDateString()]);
  rows.push([]);
  rows.push(['== KEY METRICS ==']);
  rows.push(['Metric', 'Value']);
  rows.push(['Revenue', `$${rev.toLocaleString()}`]);
  rows.push(['COGS', `$${cogs.toLocaleString()}`]);
  rows.push(['Gross Profit', `$${gp.toLocaleString()}`]);
  rows.push(['Gross Margin', `${gm.toFixed(1)}%`]);
  rows.push(['OpEx', `$${opex.toLocaleString()}`]);
  rows.push(['EBITDA', `$${ebitda.toLocaleString()}`]);
  rows.push(['EBITDA Margin', `${em.toFixed(1)}%`]);
  rows.push(['Total Customers', String(data.customers.totalCount)]);
  rows.push(['New This Period', String(data.customers.newThisPeriod)]);
  rows.push(['Churned', String(data.customers.churned)]);
  if (data.customers.retentionRate != null) rows.push(['Retention Rate', `${(data.customers.retentionRate * 100).toFixed(1)}%`]);
  if (data.operations.headcount) rows.push(['Headcount', String(data.operations.headcount)]);
  rows.push([]);

  if (data.revenue.byPeriod.length > 0) {
    rows.push(['== PERIOD DATA ==']);
    rows.push(['Period', 'Revenue', 'COGS', 'Gross Profit', 'GM %', 'EBITDA', 'EBITDA %', 'Recurring', 'One-Time']);
    for (const p of data.revenue.byPeriod) {
      const pGP = p.revenue - (p.cogs ?? 0);
      const pGM = p.revenue > 0 && p.cogs != null ? ((pGP / p.revenue) * 100).toFixed(1) : '';
      const pEM = p.revenue > 0 && p.ebitda != null ? ((p.ebitda / p.revenue) * 100).toFixed(1) : '';
      rows.push([
        p.period,
        p.revenue.toString(),
        (p.cogs ?? '').toString(),
        p.cogs != null ? pGP.toString() : '',
        pGM ? `${pGM}%` : '',
        (p.ebitda ?? '').toString(),
        pEM ? `${pEM}%` : '',
        (p.recurring ?? '').toString(),
        (p.oneTime ?? '').toString(),
      ]);
    }
    rows.push([]);
  }

  if (data.costs.byCategory.length > 0) {
    rows.push(['== COST BREAKDOWN ==']);
    rows.push(['Category', 'Amount', '% of Revenue']);
    for (const c of data.costs.byCategory) {
      rows.push([c.category, `$${c.amount.toLocaleString()}`, `${c.percentOfRevenue.toFixed(1)}%`]);
    }
    rows.push([]);
  }

  if (data.customers.topCustomers.length > 0) {
    rows.push(['== TOP CUSTOMERS ==']);
    rows.push(['Name', 'Revenue', '% of Total', 'Industry', 'Type']);
    for (const c of data.customers.topCustomers.slice(0, 20)) {
      rows.push([c.name, `$${c.revenue.toLocaleString()}`, `${c.percentOfTotal.toFixed(1)}%`, c.industry ?? '', c.revenueType ?? '']);
    }
  }

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `business-os-${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Section Note ──────────────────────────────────────────────────────────────
function SectionNote({ noteKey, notes, onSave }: {
  noteKey: string;
  notes: Record<string, string>;
  onSave: (key: string, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const note = notes[noteKey] ?? '';

  const open  = () => { setDraft(note); setEditing(true); };
  const save  = () => { onSave(noteKey, draft.trim()); setEditing(false); };
  const clear = (e: React.MouseEvent) => { e.stopPropagation(); onSave(noteKey, ''); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <input
          autoFocus type="text" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          placeholder="Add a note for this section…"
          className="w-44 bg-slate-800/80 border border-indigo-500/40 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
        />
        <button onClick={save} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium flex-shrink-0">Save</button>
        {note && <button onClick={clear} className="text-[10px] text-slate-600 hover:text-red-400 font-medium flex-shrink-0">Clear</button>}
        <button onClick={() => setEditing(false)} className="text-slate-600 hover:text-slate-300 text-lg leading-none flex-shrink-0">×</button>
      </div>
    );
  }

  if (note) {
    return (
      <button onClick={open}
        title="Click to edit note"
        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 px-2.5 py-1 rounded-lg transition-all max-w-[200px] group">
        <span className="text-amber-400/70 flex-shrink-0">📝</span>
        <span className="truncate">{note}</span>
      </button>
    );
  }

  return (
    <button onClick={open}
      className="text-[11px] text-slate-700 hover:text-slate-500 font-medium px-2 py-1 rounded-lg transition-colors">
      + note
    </button>
  );
}

// ── Period selector ────────────────────────────────────────────────────────────
function PeriodSelector({ snapshots, activeId, onSelect, onDelete, onRename }: {
  snapshots: PeriodSnapshot[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newLabel: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const active = snapshots.find(s => s.id === activeId);
  if (snapshots.length <= 1) return null;
  const isDemoId = (id: string) => id === 'demo' || id === 'prev-demo';

  const startEdit = (s: PeriodSnapshot, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditValue(s.label);
  };
  const commitEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed && onRename) onRename(id, trimmed);
    setEditingId(null);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl text-[12px] font-medium text-slate-300 transition-all">
        <Icons.Clock /><span className="max-w-[120px] truncate">{active?.label ?? 'Select Period'}</span><Icons.Chevron />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setOpen(false); setEditingId(null); }}/>
          <div className="absolute right-0 top-full mt-1.5 z-40 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl w-64 py-1.5">
            <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Period History</div>
            {snapshots.map(s => (
              <div key={s.id} className="flex items-center group">
                {editingId === s.id ? (
                  <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5">
                    <input autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(s.id); if (e.key === 'Escape') setEditingId(null); }}
                      onBlur={() => commitEdit(s.id)}
                      className="flex-1 bg-slate-800 border border-indigo-500/50 rounded-lg px-2 py-1 text-[12px] text-slate-100 focus:outline-none min-w-0"
                      onClick={e => e.stopPropagation()}
                    />
                    <button onClick={e => { e.stopPropagation(); commitEdit(s.id); }}
                      className="flex-shrink-0 text-indigo-400 hover:text-indigo-300 text-[11px] font-medium px-1.5 py-1 rounded">
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => { onSelect(s.id); setOpen(false); }}
                      className={`flex-1 flex items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] transition-colors ${
                        s.id === activeId ? 'text-indigo-300 bg-indigo-500/10' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                      <div className="min-w-0">
                        <div className="truncate">{s.label}</div>
                        {!isDemoId(s.id) && (
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isDemoId(s.id) && <span className="text-[9px] text-amber-400/70 font-medium">demo</span>}
                        {s.id === activeId && <Icons.Check />}
                      </div>
                    </button>
                    {!isDemoId(s.id) && (
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                        {onRename && (
                          <button onClick={e => startEdit(s, e)} title="Rename"
                            className="p-1.5 text-slate-600 hover:text-slate-300 rounded">
                            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="w-3 h-3">
                              <path d="M2 9.5h1.5l4.5-4.5-1.5-1.5L2 8V9.5zM8.5 2.5l1 1"/>
                              <path d="M7 4l1.5 1.5"/>
                            </svg>
                          </button>
                        )}
                        {onDelete && (
                          <button onClick={e => { e.stopPropagation(); onDelete(s.id); setOpen(false); }} title="Delete"
                            className="p-1.5 text-slate-600 hover:text-red-400 rounded">
                            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Period name modal ──────────────────────────────────────────────────────────
function PeriodModal({ onConfirm, onSkip }: { onConfirm: (label: string) => void; onSkip: () => void }) {
  const [label, setLabel] = useState('');
  const quick = ['Q1 2025','Q2 2025','Q3 2025','Q4 2025','Jan 2025','Feb 2025','Mar 2025','YTD 2025','Full Year 2024'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onSkip}/>
      <div className="relative bg-[#0d1117] border border-slate-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="mb-4">
          <div className="text-[14px] font-semibold text-slate-100 mb-1">Name This Period</div>
          <div className="text-[12px] text-slate-400 leading-relaxed">Label this snapshot so you can navigate back to it and compare against future periods.</div>
        </div>
        <input autoFocus type="text" placeholder="e.g. Q1 2025, January 2025…"
          value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && label.trim()) onConfirm(label.trim()); if (e.key === 'Escape') onSkip(); }}
          className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 mb-3"/>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {quick.map(q => (
            <button key={q} onClick={() => setLabel(q)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${label === q ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onSkip} className="flex-1 px-4 py-2 text-[12px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-colors">Skip</button>
          <button onClick={() => onConfirm(label.trim() || 'Imported Data')}
            className="flex-1 px-4 py-2 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
            Save Period
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Company name editor (inline) ───────────────────────────────────────────────
function CompanyNameEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = () => { const v = draft.trim() || value; onChange(v); setEditing(false); };
  if (editing) {
    return (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className="bg-slate-800/80 border border-indigo-500/50 rounded-md px-2 py-0.5 text-[13px] font-semibold text-slate-100 focus:outline-none w-40"/>
    );
  }
  return (
    <button onClick={() => { setDraft(value); setEditing(true); }}
      className="group flex items-center gap-1.5 text-[13px] font-semibold text-slate-100 hover:text-slate-200 transition-colors">
      <span>{value}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-slate-400"><Icons.Pencil /></span>
    </button>
  );
}

// ── Quick-nav card colors (static classes — required for Tailwind JIT) ─────────
const NAV_CARD_COLORS: Record<string, { label: string; text: string; link: string; border: string; titleColor: string }> = {
  financial:    { label: 'Financials',            text: 'P&L, margins, cost waterfall, AR aging',          link: 'text-indigo-400 group-hover:text-indigo-300',   border: 'hover:border-indigo-500/30 group-hover:bg-indigo-500/5',   titleColor: 'group-hover:text-indigo-200'  },
  customers:    { label: 'Customers',             text: 'Concentration risk, LTV, retention cohorts',      link: 'text-violet-400 group-hover:text-violet-300',   border: 'hover:border-violet-500/30 group-hover:bg-violet-500/5',   titleColor: 'group-hover:text-violet-200'  },
  operations:   { label: 'Operations',            text: 'Headcount, pipeline, utilization, OpEx ratios',   link: 'text-cyan-400 group-hover:text-cyan-300',       border: 'hover:border-cyan-500/30 group-hover:bg-cyan-500/5',       titleColor: 'group-hover:text-cyan-200'    },
  intelligence: { label: 'AI Intelligence',       text: 'Weekly narrative, board deck, risk scan',         link: 'text-emerald-400 group-hover:text-emerald-300', border: 'hover:border-emerald-500/30 group-hover:bg-emerald-500/5', titleColor: 'group-hover:text-emerald-200' },
  scenarios:    { label: 'Scenarios',             text: 'Model what-if outcomes with lever sliders',       link: 'text-amber-400 group-hover:text-amber-300',     border: 'hover:border-amber-500/30 group-hover:bg-amber-500/5',     titleColor: 'group-hover:text-amber-200'   },
};

// ── Welcome modal (first visit, no real data) ─────────────────────────────────
function WelcomeModal({ onDismiss, onGoToData }: { onDismiss: () => void; onGoToData: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onDismiss}/>
      <div className="relative bg-[#0a0f1a] border border-slate-700/60 rounded-2xl p-7 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shadow-lg flex-shrink-0">
            <svg viewBox="0 0 12 12" fill="white" className="w-5 h-5"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
          </div>
          <div>
            <div className="text-[16px] font-bold text-slate-100">Welcome to Business OS</div>
            <div className="text-[12px] text-slate-500">AI-powered executive intelligence for your business</div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {[
            { n: '1', icon: '📤', title: 'Connect your data', desc: 'Upload a CSV or connect Google Sheets — revenue, costs, customers, cash flow.' },
            { n: '2', icon: '✦', title: 'Get AI analysis', desc: 'Instant KPIs, trend signals, benchmarks vs your industry, and CEO watchlist.' },
            { n: '3', icon: '📋', title: 'Generate reports', desc: 'Weekly intelligence brief, board deck, exit readiness score, and 90-day plan.' },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-4 bg-slate-900/50 border border-slate-800/60 rounded-xl p-4">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-[13px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step.n}</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">{step.icon}</span>
                  <span className="text-[13px] font-semibold text-slate-100">{step.title}</span>
                </div>
                <div className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onGoToData}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[13px] font-semibold transition-all shadow-sm">
            Connect my data →
          </button>
          <button
            onClick={onDismiss}
            className="px-5 py-2.5 text-[13px] font-medium text-slate-400 hover:text-slate-200 border border-slate-700/60 hover:border-slate-600 rounded-xl transition-colors">
            Explore demo
          </button>
        </div>
        <div className="text-center mt-3 text-[11px] text-slate-700">You're currently viewing demo data · Your real data stays in your browser</div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BusinessOS() {
  const [activeView, setActiveView]             = useState<ActiveView>('overview');
  const [snapshots, setSnapshots]               = useState<PeriodSnapshot[]>([DEMO_SNAPSHOT, PREV_SNAPSHOT]);
  const [activeSnapshotId, setActiveSnapshotId] = useState(DEMO_SNAPSHOT.id);
  const [pendingData, setPendingData]           = useState<UnifiedBusinessData | null>(null);
  const [showPeriodModal, setShowPeriodModal]   = useState(false);
  const [dashboard, setDashboard]               = useState<KPIDashboard | null>(null);
  const [weeklyInsight, setWeeklyInsight]       = useState<WeeklyInsight | null>(null);
  const [boardDeck, setBoardDeck]               = useState<BoardDeck | null>(null);
  const [alerts, setAlerts]                     = useState<{ severity: string; title: string; message: string; action: string }[]>([]);
  const [loading, setLoading]                   = useState<string | null>(null);
  const [toasts, setToasts]                     = useState<ToastItem[]>([]);
  const [companyName, setCompanyName]           = useState('My Company');
  const [chatOpen, setChatOpen]                 = useState(false);
  const [chatInitialMsg, setChatInitialMsg]     = useState<string | undefined>(undefined);
  const [mobileNavOpen, setMobileNavOpen]       = useState(false);
  const [goals, setGoals]                       = useState<Goals>({});
  const [budget, setBudget]                     = useState<Budget>({});
  const [annotations, setAnnotations]           = useState<Record<string, string>>({});
  const [customKPIs, setCustomKPIs]             = useState<CustomKPI[]>([]);
  const [thresholds, setThresholds]             = useState<Threshold[]>([]);
  const [compareMode, setCompareMode]           = useState(false);
  const [panelNotes, setPanelNotesState]        = useState<Record<string, string>>({});
  const [shortcutsOpen, setShortcutsOpen]       = useState(false);
  const [dismissedAlerts, setDismissedAlerts]   = useState<number[]>([]);
  const [showWelcome, setShowWelcome]           = useState(false);
  const [companyProfile, setCompanyProfileState] = useState<CompanyProfile>({});
  const [reportTimestamps, setReportTimestamps]   = useState<Record<string, string>>({});
  const [showOnboarding, setShowOnboarding]       = useState(false);

  // Hydrate persisted state from localStorage (client-side only)
  useEffect(() => {
    const savedCompany = localStorage.getItem('bos_company');
    if (savedCompany) setCompanyName(savedCompany);
    try {
      const savedProfile = localStorage.getItem('bos_company_profile');
      if (savedProfile) setCompanyProfileState(JSON.parse(savedProfile));
    } catch { /* ignore */ }
    try {
      const savedGoals = localStorage.getItem('bos_goals');
      if (savedGoals) setGoals(JSON.parse(savedGoals));
    } catch { /* ignore */ }
    try {
      const savedBudget = localStorage.getItem('bos_budget');
      if (savedBudget) setBudget(JSON.parse(savedBudget));
    } catch { /* ignore */ }
    try {
      const savedAnnotations = localStorage.getItem('bos_annotations');
      if (savedAnnotations) setAnnotations(JSON.parse(savedAnnotations));
    } catch { /* ignore */ }
    try {
      const savedCustomKPIs = localStorage.getItem('bos_custom_kpis');
      if (savedCustomKPIs) setCustomKPIs(JSON.parse(savedCustomKPIs));
    } catch { /* ignore */ }
    try {
      const savedThresholds = localStorage.getItem('bos_thresholds');
      if (savedThresholds) setThresholds(JSON.parse(savedThresholds));
    } catch { /* ignore */ }
    try {
      const savedPanelNotes = localStorage.getItem('bos_panel_notes');
      if (savedPanelNotes) setPanelNotesState(JSON.parse(savedPanelNotes));
    } catch { /* ignore */ }
    try {
      const savedInsight = localStorage.getItem('bos_weekly_insight');
      if (savedInsight) setWeeklyInsight(JSON.parse(savedInsight));
    } catch { /* ignore */ }
    try {
      const savedDeck = localStorage.getItem('bos_board_deck');
      if (savedDeck) setBoardDeck(JSON.parse(savedDeck));
    } catch { /* ignore */ }
    try {
      const savedAlerts = localStorage.getItem('bos_alerts');
      if (savedAlerts) setAlerts(JSON.parse(savedAlerts));
    } catch { /* ignore */ }
    const savedCompare = localStorage.getItem('bos_compare_mode');
    if (savedCompare === 'true') setCompareMode(true);
    try {
      const savedTs = localStorage.getItem('bos_report_timestamps');
      if (savedTs) setReportTimestamps(JSON.parse(savedTs));
    } catch { /* ignore */ }
    // Restore user-uploaded period snapshots
    let hasUserData = false;
    try {
      const savedSnaps = localStorage.getItem('bos_snapshots');
      if (savedSnaps) {
        const parsed = JSON.parse(savedSnaps) as PeriodSnapshot[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSnapshots([...parsed, PREV_SNAPSHOT, DEMO_SNAPSHOT]);
          const savedActiveId = localStorage.getItem('bos_active_id');
          const restoredId = savedActiveId && parsed.find(s => s.id === savedActiveId) ? savedActiveId : parsed[0].id;
          setActiveSnapshotId(restoredId);
          hasUserData = true;
        }
      }
    } catch { /* ignore */ }
    // Check onboarding status
    const session = loadSession();
    if (!session.onboarded) {
      setShowOnboarding(true);
    }

    // Show welcome modal for first-time visitors with no prior session (fallback)
    const hasAnyPriorVisit = localStorage.getItem('bos_visited');
    if (!hasAnyPriorVisit && !hasUserData && session.onboarded) {
      setShowWelcome(true);
    }
    localStorage.setItem('bos_visited', '1');
  }, []);

  const saveCompanyName = useCallback((name: string) => {
    setCompanyName(name);
    localStorage.setItem('bos_company', name);
  }, []);

  const setGoal = useCallback((key: GoalKey, value: number | undefined) => {
    setGoals(prev => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      localStorage.setItem('bos_goals', JSON.stringify(next));
      return next;
    });
  }, []);

  const setBudgetLine = useCallback((key: keyof Budget, value: Budget[keyof Budget]) => {
    setBudget(prev => {
      const next = { ...prev, [key]: value };
      if (value === undefined) delete next[key];
      localStorage.setItem('bos_budget', JSON.stringify(next));
      return next;
    });
  }, []);

  const saveCustomKPIs = useCallback((kpis: CustomKPI[]) => {
    setCustomKPIs(kpis);
    localStorage.setItem('bos_custom_kpis', JSON.stringify(kpis));
  }, []);

  const saveThresholds = useCallback((t: Threshold[]) => {
    setThresholds(t);
    localStorage.setItem('bos_thresholds', JSON.stringify(t));
  }, []);

  const setPanelNote = useCallback((key: string, note: string) => {
    setPanelNotesState(prev => {
      const next = { ...prev };
      if (note) next[key] = note;
      else delete next[key];
      localStorage.setItem('bos_panel_notes', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleCompareMode = useCallback(() => {
    setCompareMode(prev => {
      localStorage.setItem('bos_compare_mode', String(!prev));
      return !prev;
    });
  }, []);

  const setAnnotation = useCallback((period: string, note: string) => {
    setAnnotations(prev => {
      const next = { ...prev };
      if (note) next[period] = note;
      else delete next[period];
      localStorage.setItem('bos_annotations', JSON.stringify(next));
      return next;
    });
  }, []);

  // Toast helpers
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = String(Date.now());
    setToasts(prev => [...prev.slice(-2), { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // Derived state
  const activeSnapshot  = snapshots.find(s => s.id === activeSnapshotId) ?? snapshots[0];
  const data            = activeSnapshot.data;
  const usingDemo       = activeSnapshot.id === DEMO_SNAPSHOT.id || activeSnapshot.id === PREV_SNAPSHOT.id;
  const prevSnapshot    = snapshots.find(s => s.id !== activeSnapshotId);
  const visibleAlerts   = alerts.filter((_, i) => !dismissedAlerts.includes(i));
  const highAlerts      = visibleAlerts.filter(a => a.severity === 'HIGH');
  const triggeredCount  = thresholds.filter(t => {
    if (!t.enabled) return false;
    const rev = data.revenue.total, cogs = data.costs.totalCOGS, opex = data.costs.totalOpEx;
    const gp = rev - cogs, ebitda = gp - opex;
    const vals: Record<string, number | null> = {
      grossMargin:  rev > 0 ? (gp / rev) * 100 : null,
      ebitdaMargin: rev > 0 ? (ebitda / rev) * 100 : null,
      revenue: rev, cogsMargin: rev > 0 ? (cogs / rev) * 100 : null,
      retentionRate: (data.customers.retentionRate ?? null) != null ? data.customers.retentionRate! * 100 : null,
      topCustomerPct: data.customers.topCustomers[0]?.percentOfTotal ?? null,
      cashBalance: data.cashFlow?.length ? data.cashFlow[data.cashFlow.length - 1].closingBalance : null,
    };
    const cur = vals[t.metricKey];
    return cur !== null && (t.operator === '<' ? cur < t.value : cur > t.value);
  }).length;

  const dismissAlert = useCallback((index: number) => {
    setDismissedAlerts(prev => [...prev, index]);
  }, []);

  const runAction = useCallback(async (action: string) => {
    setLoading(action);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data, previousData: prevSnapshot?.data ?? PREV_DEMO, companyName, companyProfile }),
      });
      const result = await res.json();

      if (result.error) {
        addToast('error', result.error);
        return;
      }
      if (result.dashboard) {
        setDashboard(result.dashboard);
        if (action === 'compute-kpis') addToast('success', 'KPIs refreshed');
      }
      if (result.insight) {
        setWeeklyInsight(result.insight);
        try { localStorage.setItem('bos_weekly_insight', JSON.stringify(result.insight)); } catch { /* ignore */ }
        const insightTs = new Date().toISOString();
        setReportTimestamps(prev => { const next = { ...prev, 'weekly-insight': insightTs }; try { localStorage.setItem('bos_report_timestamps', JSON.stringify(next)); } catch { /* ignore */ } return next; });
        setActiveView('intelligence');
        addToast('success', 'Weekly intelligence report generated');
      }
      if (result.deck) {
        setBoardDeck(result.deck);
        try { localStorage.setItem('bos_board_deck', JSON.stringify(result.deck)); } catch { /* ignore */ }
        const deckTs = new Date().toISOString();
        setReportTimestamps(prev => { const next = { ...prev, 'board-deck': deckTs }; try { localStorage.setItem('bos_report_timestamps', JSON.stringify(next)); } catch { /* ignore */ } return next; });
        setActiveView('intelligence');
        addToast('success', 'Board deck generated');
      }
      if (result.alerts) {
        setAlerts(result.alerts);
        try { localStorage.setItem('bos_alerts', JSON.stringify(result.alerts)); } catch { /* ignore */ }
        const alertsTs = new Date().toISOString();
        setReportTimestamps(prev => { const next = { ...prev, 'alerts': alertsTs }; try { localStorage.setItem('bos_report_timestamps', JSON.stringify(next)); } catch { /* ignore */ } return next; });
        setDismissedAlerts([]);
        const high = (result.alerts as {severity: string}[]).filter(a => a.severity === 'HIGH').length;
        addToast(high > 0 ? 'error' : 'success', `${result.alerts.length} risk alert${result.alerts.length !== 1 ? 's' : ''} identified${high > 0 ? ` — ${high} high priority` : ''}`);
        setActiveView('intelligence');
      }
      if (action === 'full-report') {
        addToast('success', 'Full report generated — check the Intelligence tab');
        setActiveView('intelligence');
      }
    } catch {
      addToast('error', 'Generation failed. Verify ANTHROPIC_API_KEY is set in Vercel environment variables.');
    } finally {
      setLoading(null);
    }
  }, [data, prevSnapshot, addToast, companyName, companyProfile]);

  const handleDataUpdate = useCallback((newData: UnifiedBusinessData) => {
    setPendingData(newData);
    setShowPeriodModal(true);
  }, []);

  const handlePeriodConfirm = useCallback((label: string) => {
    if (!pendingData) return;
    const snap: PeriodSnapshot = { id: `snap-${Date.now()}`, label, data: pendingData, createdAt: new Date().toISOString() };
    setSnapshots(prev => {
      const userSnaps = prev.filter(s => !['demo','prev-demo'].includes(s.id));
      const next = [snap, ...userSnaps, PREV_SNAPSHOT, DEMO_SNAPSHOT];
      // Persist user snapshots (cap at 8 to avoid localStorage quota)
      try {
        const toSave = [snap, ...userSnaps].slice(0, 8);
        localStorage.setItem('bos_snapshots', JSON.stringify(toSave));
      } catch { /* storage quota exceeded — silently skip */ }
      return next;
    });
    localStorage.setItem('bos_active_id', snap.id);
    setActiveSnapshotId(snap.id);
    setPendingData(null);
    setShowPeriodModal(false);
    setActiveView('overview');
    setDashboard(null);
    setWeeklyInsight(null);
    setBoardDeck(null);
    setAlerts([]);
    try { localStorage.removeItem('bos_weekly_insight'); localStorage.removeItem('bos_board_deck'); localStorage.removeItem('bos_alerts'); localStorage.removeItem('bos_report_timestamps'); } catch { /* ignore */ }
    setReportTimestamps({});
    addToast('success', `Period "${label}" saved — your data will persist on refresh`);
  }, [pendingData, addToast]);

  const handleDataSuccess = useCallback((msg: string) => {
    addToast('success', msg);
  }, [addToast]);

  const handleDeleteSnapshot = useCallback((id: string) => {
    setSnapshots(prev => {
      const next = prev.filter(s => s.id !== id);
      const userSnaps = next.filter(s => !['demo','prev-demo'].includes(s.id));
      try { localStorage.setItem('bos_snapshots', JSON.stringify(userSnaps)); } catch { /* ignore */ }
      return next;
    });
    // If we deleted the active snapshot, fall back to demo
    if (activeSnapshotId === id) {
      setActiveSnapshotId(DEMO_SNAPSHOT.id);
      localStorage.setItem('bos_active_id', DEMO_SNAPSHOT.id);
    }
    addToast('info', 'Period deleted');
  }, [activeSnapshotId, addToast]);

  const saveCompanyProfile = useCallback((profile: CompanyProfile) => {
    setCompanyProfileState(profile);
    try { localStorage.setItem('bos_company_profile', JSON.stringify(profile)); } catch { /* ignore */ }
  }, []);

  const handleRenameSnapshot = useCallback((id: string, newLabel: string) => {
    setSnapshots(prev => {
      const next = prev.map(s => s.id === id ? { ...s, label: newLabel } : s);
      const userSnaps = next.filter(s => !['demo','prev-demo'].includes(s.id));
      try { localStorage.setItem('bos_snapshots', JSON.stringify(userSnaps)); } catch { /* ignore */ }
      return next;
    });
    addToast('success', `Renamed to "${newLabel}"`);
  }, [addToast]);

  const openChat = useCallback((msg?: string) => {
    setChatInitialMsg(msg);
    setChatOpen(true);
  }, []);

  const handleOnboardingComplete = useCallback((od: OnboardingData) => {
    // Mark session as onboarded
    const session = loadSession();
    const updated = { ...session, onboarded: true };
    saveSession(updated);
    setShowOnboarding(false);
    // Pre-fill company name from onboarding
    if (od.companyName) saveCompanyName(od.companyName);
    addToast('success', `Welcome, ${od.companyName}! Your dashboard is ready.`);
  }, [addToast, saveCompanyName]);

  const handleOnboardingSkip = useCallback(() => {
    const session = loadSession();
    saveSession({ ...session, onboarded: true });
    setShowOnboarding(false);
  }, []);

  // Keyboard shortcuts: 1–9 switch views, / or Cmd+K opens chat
  useEffect(() => {
    const viewOrder: ActiveView[] = ['overview', 'financial', 'customers', 'operations', 'intelligence', 'scenarios', 'data', 'pipeline', 'automations'];
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      // Cmd+K / Ctrl+K opens chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openChat(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); openChat(); return; }
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(v => !v); return; }
      if (e.key === 'Escape') { setShortcutsOpen(false); return; }
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < viewOrder.length) setActiveView(viewOrder[idx]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openChat]);

  const isLoading = (action: string) => loading === action;

  // Per-section health dot (green/amber/red) derived from current data
  const getSectionHealth = (id: ActiveView): 'green' | 'amber' | 'red' | null => {
    const rev   = data.revenue.total;
    const cogs  = data.costs.totalCOGS;
    const opex  = data.costs.totalOpEx;
    const gp    = rev - cogs;
    const ebitda = gp - opex;
    switch (id) {
      case 'financial': {
        const em = rev > 0 ? (ebitda / rev) * 100 : 0;
        const gm = rev > 0 ? (gp / rev) * 100 : 0;
        return em >= 15 && gm >= 40 ? 'green' : em >= 8 ? 'amber' : 'red';
      }
      case 'customers': {
        const topPct = data.customers.topCustomers[0]?.percentOfTotal ?? 0;
        const ret    = (data.customers.retentionRate ?? 0.88) * 100;
        return topPct <= 20 && ret >= 88 ? 'green' : topPct <= 35 && ret >= 75 ? 'amber' : 'red';
      }
      case 'operations': {
        const util = data.operations.utilizationRate;
        if (util == null) return null;
        return util >= 0.8 ? 'green' : util >= 0.6 ? 'amber' : 'red';
      }
      case 'intelligence':
        return highAlerts.length > 0 ? 'red' : visibleAlerts.length > 0 ? 'amber' : null;
      default: return null;
    }
  };

  const navItems: { id: ActiveView; label: string; Icon: () => JSX.Element; badge?: number; activeClass: string }[] = [
    { id: 'overview',     label: 'Overview',     Icon: Icons.Overview,     activeClass: 'bg-slate-800/80 text-slate-100', badge: triggeredCount || undefined },
    { id: 'financial',    label: 'Financial',    Icon: Icons.Financial,    activeClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20' },
    { id: 'customers',    label: 'Customers',    Icon: Icons.Customers,    activeClass: 'bg-violet-500/15 text-violet-300 border border-violet-500/20' },
    { id: 'operations',   label: 'Operations',   Icon: Icons.Operations,   activeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' },
    { id: 'intelligence', label: 'Intelligence', Icon: Icons.Intelligence, activeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20', badge: highAlerts.length || undefined },
    { id: 'pipeline',     label: 'Pipeline',     Icon: Icons.Pipeline,     activeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/20' },
    { id: 'automations',  label: 'Automations',  Icon: Icons.Automations,  activeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/20' },
    { id: 'scenarios',    label: 'Scenarios',    Icon: Icons.Scenarios,    activeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/20' },
    { id: 'data',         label: 'Data Sources', Icon: Icons.Data,         activeClass: 'bg-slate-800/80 text-slate-100' },
  ];

  const pageTitle: Record<ActiveView, string> = {
    overview:     'Performance Overview',
    financial:    'Financial Analysis',
    customers:    'Customer Intelligence',
    operations:   'Operations & Efficiency',
    intelligence: 'AI Intelligence',
    pipeline:     'Deal Pipeline',
    automations:  'Automations',
    scenarios:    'Scenario Modeling',
    data:         'Data Sources',
  };

  const pageAccent: Record<ActiveView, string> = {
    overview:     'text-slate-400',
    financial:    'text-indigo-400',
    customers:    'text-violet-400',
    operations:   'text-cyan-400',
    intelligence: 'text-emerald-400',
    pipeline:     'text-sky-400',
    automations:  'text-rose-400',
    scenarios:    'text-amber-400',
    data:         'text-slate-400',
  };

  return (
    <>
      <Head>
        <title>{companyName} · Business OS</title>
        <meta name="description" content="AI-powered executive intelligence for your business"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
      </Head>

      <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col">

        {/* ── Print header (hidden on screen, shown when printing) ── */}
        <div className="hidden print:block print:mb-6 print:pb-4 print:border-b print:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[18px] font-bold text-slate-100">{companyName}</div>
              <div className="text-[12px] text-slate-400 mt-0.5">{pageTitle[activeView]} · {activeSnapshot.label}</div>
            </div>
            <div className="text-right text-[11px] text-slate-500">
              <div>Business OS</div>
              <div>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
        </div>

        {/* ── Header ── */}
        <header className="no-print border-b border-slate-800/60 bg-[#060a12]/95 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-[1440px] mx-auto px-3 sm:px-4 md:px-6 h-[52px] flex items-center gap-2.5 md:gap-4">

            {/* Brand */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-[26px] h-[26px] rounded-[6px] bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shadow-sm flex-shrink-0">
                <svg viewBox="0 0 12 12" fill="white" className="w-3.5 h-3.5"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
              </div>
              <div className="hidden sm:block">
                <CompanyNameEditor value={companyName} onChange={saveCompanyName} />
                <div className="text-[9px] font-medium text-slate-600 tracking-wide uppercase -mt-0.5">Business OS</div>
              </div>
              <div className="sm:hidden text-[13px] font-semibold text-slate-100 truncate max-w-[100px]">{companyName}</div>
            </div>

            <div className="hidden md:block h-4 w-px bg-slate-800/80 flex-shrink-0"/>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto">
              {navItems.map(({ id, label, Icon, badge, activeClass }) => {
                const health = getSectionHealth(id);
                const dotCls = health === 'green' ? 'bg-emerald-400' : health === 'amber' ? 'bg-amber-400' : health === 'red' ? 'bg-red-400' : null;
                return (
                  <button key={id} onClick={() => setActiveView(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      activeView === id ? activeClass : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30 border border-transparent'}`}>
                    <Icon/>{label}
                    {dotCls && !badge && (
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls} opacity-60`}/>
                    )}
                    {badge ? <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ml-0.5">{badge}</span> : null}
                  </button>
                );
              })}
            </nav>

            {/* Mobile: current view label */}
            <div className="md:hidden flex-1 text-[12px] font-medium text-slate-400 truncate">
              {pageTitle[activeView]}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              {usingDemo && (
                <span className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium bg-amber-500/8 text-amber-400/80 border border-amber-500/15 px-2.5 py-[5px] rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse"/>Demo
                </span>
              )}
              <PeriodSelector snapshots={snapshots} activeId={activeSnapshotId} onSelect={id => { setActiveSnapshotId(id); localStorage.setItem('bos_active_id', id); addToast('info', `Viewing: ${snapshots.find(s => s.id === id)?.label}`); }} onDelete={handleDeleteSnapshot} onRename={handleRenameSnapshot}/>
              <button onClick={() => runAction('full-report')} disabled={!!loading}
                className="flex items-center gap-1.5 px-2.5 md:px-3.5 py-[7px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[12px] font-semibold transition-all shadow-sm">
                {isLoading('full-report') ? <><Icons.Spinner/><span className="hidden sm:inline">Running…</span></> : <><span className="hidden sm:inline">✦ Run Report</span><span className="sm:hidden">✦</span></>}
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileNavOpen(v => !v)}
                className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  {mobileNavOpen
                    ? <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                    : <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  }
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile nav drawer */}
          {mobileNavOpen && (
            <div className="md:hidden border-t border-slate-800/60 bg-[#060a12]/98 px-3 py-2.5 flex flex-col gap-0.5 animate-fade-in">
              {navItems.map(({ id, label, Icon, badge, activeClass }) => (
                <button key={id} onClick={() => { setActiveView(id); setMobileNavOpen(false); }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                    activeView === id ? activeClass : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'}`}>
                  <Icon/>{label}
                  {badge ? <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ml-auto">{badge}</span> : null}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ── Breadcrumb / page bar ── */}
        <div className="border-b border-slate-800/40 bg-slate-900/15">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className={`text-[13px] font-semibold flex-shrink-0 ${pageAccent[activeView]}`}>{pageTitle[activeView]}</span>
              <span className="text-slate-700 flex-shrink-0">·</span>
              <span className="text-[11px] text-slate-500 font-medium truncate min-w-0">{activeSnapshot.label}</span>
              <span className="hidden sm:inline text-slate-700 flex-shrink-0">·</span>
              <span className={`hidden sm:inline text-[11px] font-medium flex-shrink-0 ${data.metadata.completeness >= 0.9 ? 'text-emerald-500/70' : 'text-amber-500/70'}`}>
                {Math.round(data.metadata.completeness * 100)}% coverage
              </span>
              {!usingDemo && activeSnapshot.createdAt && (
                <>
                  <span className="hidden md:inline text-slate-700 flex-shrink-0">·</span>
                  <span className="hidden md:inline text-[11px] text-slate-600 flex-shrink-0">
                    uploaded {new Date(activeSnapshot.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 no-print">
              {activeView === 'overview' && (
                <button onClick={() => runAction('compute-kpis')} disabled={!!loading}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-3 py-1 rounded-lg transition-all disabled:opacity-40 font-medium">
                  {isLoading('compute-kpis') ? <><Icons.Spinner/>Computing…</> : '↺ Refresh KPIs'}
                </button>
              )}
              {prevSnapshot && (
                <button
                  onClick={toggleCompareMode}
                  title="Toggle period comparison view"
                  className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-lg transition-all border ${
                    compareMode
                      ? 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10'
                      : 'text-slate-500 hover:text-slate-300 border-slate-800/60 hover:border-slate-700'
                  }`}>
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M1 7h5V2L1 7zm7-5v5h5L8 2z"/></svg>
                  Compare
                </button>
              )}
              <button
                onClick={() => setShortcutsOpen(true)}
                title="Keyboard shortcuts (?)"
                className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-3 py-1 rounded-lg transition-all font-medium">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0"><rect x="1" y="1" width="3" height="3" rx="0.5"/><rect x="5.5" y="1" width="3" height="3" rx="0.5"/><rect x="10" y="1" width="3" height="3" rx="0.5"/><rect x="1" y="5.5" width="3" height="3" rx="0.5"/><rect x="5.5" y="5.5" width="3" height="3" rx="0.5"/><rect x="10" y="5.5" width="3" height="3" rx="0.5"/><rect x="3" y="10" width="8" height="3" rx="0.5"/></svg>
                Shortcuts
              </button>
              <button
                onClick={() => exportKPIsAsCSV(data, activeSnapshot.label)}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-3 py-1 rounded-lg transition-all font-medium"
                title="Download KPIs, period data, and customers as CSV">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                  <path d="M7 1v7M4 5l3 3 3-3M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-3 py-1 rounded-lg transition-all font-medium"
                title="Export to PDF — use browser Print → Save as PDF">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                  <path d="M3 1h8v4H3V1zM1 6h12v6H1V6zm2 2h2v1H3V8zm0 2h4v1H3v-1zM11 8h-1v1h1V8z"/>
                </svg>
                Export PDF
              </button>
            </div>
          </div>
        </div>

        {/* ── Print-only header ── */}
        <div className="print-header hidden">
          {companyName} · Business OS Report · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        {/* ── Demo data banner (non-overview tabs) ── */}
        {usingDemo && activeView !== 'overview' && activeView !== 'data' && activeView !== 'pipeline' && activeView !== 'automations' && (
          <div className="no-print border-b border-amber-500/10 bg-amber-500/[0.03]">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-pulse flex-shrink-0"/>
                <span className="text-[11px] text-amber-400/70">You're viewing demo data — analysis below reflects simulated numbers</span>
              </div>
              <button onClick={() => setActiveView('data')}
                className="text-[11px] font-semibold text-amber-400/80 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 px-2.5 py-1 rounded-lg transition-all flex-shrink-0 whitespace-nowrap">
                Use my data →
              </button>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 sm:py-6 flex-1 w-full">

          {/* Period comparison strip */}
          {compareMode && prevSnapshot && (
            <ComparisonStrip
              current={data}
              previous={prevSnapshot.data}
              currentLabel={activeSnapshot.label}
              previousLabel={prevSnapshot.label}
            />
          )}

          {/* High-priority alert banner (visible on all tabs except intelligence) */}
          {highAlerts.length > 0 && activeView !== 'intelligence' && (
            <div className="mb-5 bg-red-500/5 border border-red-500/20 rounded-xl px-4 sm:px-5 py-3.5 flex items-start gap-3">
              <span className="text-red-400 mt-0.5 flex-shrink-0"><Icons.Alert/></span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-red-300 mb-1">{highAlerts.length} high-priority alert{highAlerts.length > 1 ? 's' : ''} need attention</div>
                <div className="space-y-0.5">{highAlerts.map((a, i) => <div key={i} className="text-xs text-red-400/80 truncate">{a.title}: {a.message}</div>)}</div>
              </div>
              <button onClick={() => setActiveView('intelligence')}
                className="flex-shrink-0 text-[11px] text-red-400/70 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                Review →
              </button>
            </div>
          )}

          {/* ── Overview ── */}
          {activeView === 'overview' && (
            <div className="space-y-5">

              {/* Demo nudge */}
              {usingDemo && (
                <div className="border border-indigo-500/15 bg-indigo-500/[0.04] rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"/>
                      <div className="text-[13px] font-semibold text-slate-200">You're viewing demo data</div>
                    </div>
                    <div className="text-[12px] text-slate-400 leading-relaxed">
                      Connect your accounting, CRM, or billing system to unlock live AI analysis on your real numbers.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setActiveView('data')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm whitespace-nowrap">
                      Connect data →
                    </button>
                  </div>
                </div>
              )}

              <MonthlyTrendStrip data={data}/>
              <CEOWatchlist data={data} previousData={prevSnapshot?.data ?? PREV_DEMO}/>
              <TopActionsWidget onRunAgent={() => setActiveView('intelligence')} onViewAll={() => setActiveView('intelligence')}/>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ExitReadinessWidget onViewAll={() => setActiveView('intelligence')}/>
                <GrowthPlaybookWidget onViewAll={() => setActiveView('intelligence')}/>
              </div>
              <ExecutiveSummary data={data} previousData={prevSnapshot?.data ?? PREV_DEMO}/>
              {prevSnapshot && <BiggestMovers data={data} previous={prevSnapshot.data}/>}
              <RevenueQuality data={data} previousData={prevSnapshot?.data ?? PREV_DEMO}/>
              <NarrativeBar data={data} previousData={prevSnapshot?.data ?? PREV_DEMO}/>
              <HealthScoreHistory snapshots={snapshots} activeId={activeSnapshotId}/>
              <BusinessHealthScore data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>

              {/* Data quality warnings */}
              {data.metadata.warnings.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
                  <span className="text-amber-400/70 text-sm flex-shrink-0 mt-0.5">⚠</span>
                  <div>
                    <div className="text-[11px] font-semibold text-amber-400/80 mb-1">Data quality notes</div>
                    <ul className="space-y-0.5">
                      {data.metadata.warnings.map((w, i) => (
                        <li key={i} className="text-[11px] text-amber-400/60">· {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <GoalsPanel data={data} goals={goals} onSetGoal={setGoal}/>
              <KPIGrid dashboard={dashboard} data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} goals={goals}/>
              <RevenueChart data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} revenueGoal={goals.revenue} annotations={annotations} onAnnotate={setAnnotation} onAskAI={openChat}/>

              <RevenueForecastStrip data={data} onAskAI={openChat}/>

              <PipelineSnapshot data={data} onAskAI={openChat}/>

              <TrendSignalsPanel data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                <CostBreakdownChart data={data}/>
                <CustomerMetricsChart data={data}/>
                <AlertFeed alerts={visibleAlerts} onRunAlerts={() => runAction('alerts')} loading={isLoading('alerts')} onDismiss={dismissAlert}/>
              </div>

              <MetricThresholdsPanel data={data} thresholds={thresholds} onChange={saveThresholds}/>

              <CustomKPIPanel kpis={customKPIs} onChange={saveCustomKPIs} onAskAI={openChat}/>

              {/* Quick nav cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 pt-1">
                {(Object.entries(NAV_CARD_COLORS) as [ActiveView, typeof NAV_CARD_COLORS[string]][]).map(([id, cfg]) => (
                  <button key={id} onClick={() => setActiveView(id)}
                    className={`group bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 text-left transition-all ${cfg.border}`}>
                    <div className={`text-[12px] font-semibold text-slate-200 mb-1 transition-colors ${cfg.titleColor}`}>{cfg.label}</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed mb-2">{cfg.text}</div>
                    <div className={`text-[11px] font-medium transition-colors ${cfg.link}`}>Open →</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeView === 'financial' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-indigo-500/10"/>
                <SectionNote noteKey="financial" notes={panelNotes} onSave={setPanelNote}/>
                <button onClick={() => openChat('Analyze my P&L: revenue, margins, cost structure. What are the biggest risks and the top 2 actions I should take?')}
                  className="flex items-center gap-1.5 text-[12px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/8 hover:bg-indigo-500/15 border border-indigo-500/25 hover:border-indigo-500/50 px-3 py-1.5 rounded-lg transition-all font-medium">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                  Ask AI CFO about financials
                </button>
                <div className="h-px flex-1 bg-indigo-500/10"/>
              </div>
              <FinancialDashboard data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} dashboard={dashboard} budget={budget} onSetBudget={setBudgetLine} annotations={annotations} onAnnotate={setAnnotation} onAskAI={openChat}/>
              <PLStatement data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} showChange showPct/>
              <BudgetPanel data={data} budget={budget} onSetBudget={setBudgetLine} onAskAI={openChat}/>
              <IndustryBenchmarksPanel data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
              {data.transactions && data.transactions.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Transaction Ledger</div>
                    <div className="flex-1 h-px bg-slate-800/50"/>
                  </div>
                  <TransactionLedger transactions={data.transactions} onAskAI={openChat}/>
                </div>
              )}
            </div>
          )}
          {activeView === 'customers' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-violet-500/10"/>
                <SectionNote noteKey="customers" notes={panelNotes} onSave={setPanelNote}/>
                <button onClick={() => openChat(`Analyze my customer base: ${data.customers.totalCount} total customers, top customer at ${data.customers.topCustomers[0]?.percentOfTotal?.toFixed(1)}%, ${((data.customers.retentionRate ?? 0.88)*100).toFixed(0)}% retention. What's the biggest customer risk and how do I address it?`)}
                  className="flex items-center gap-1.5 text-[12px] text-violet-400 hover:text-violet-300 bg-violet-500/8 hover:bg-violet-500/15 border border-violet-500/25 hover:border-violet-500/50 px-3 py-1.5 rounded-lg transition-all font-medium">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                  Ask AI CFO about customers
                </button>
                <div className="h-px flex-1 bg-violet-500/10"/>
              </div>
              <CustomerDashboard data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
            </div>
          )}
          {activeView === 'operations' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-cyan-500/10"/>
                <SectionNote noteKey="operations" notes={panelNotes} onSave={setPanelNote}/>
                <button onClick={() => openChat(`Analyze my operations: ${data.operations.headcount ?? 'unknown'} headcount, OpEx is ${((data.costs.totalOpEx / data.revenue.total)*100).toFixed(1)}% of revenue. Where are the biggest efficiency opportunities?`)}
                  className="flex items-center gap-1.5 text-[12px] text-cyan-400 hover:text-cyan-300 bg-cyan-500/8 hover:bg-cyan-500/15 border border-cyan-500/25 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-all font-medium">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                    <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                  </svg>
                  Ask AI CFO about operations
                </button>
                <div className="h-px flex-1 bg-cyan-500/10"/>
              </div>
              <OperationsDashboard data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
            </div>
          )}
          {activeView === 'intelligence' && (
            <div className="space-y-6">
              <IntelligenceDashboard weeklyInsight={weeklyInsight} boardDeck={boardDeck} alerts={alerts} loading={loading} onGenerate={runAction} reportTimestamps={reportTimestamps}/>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-800/60"/>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em]">AI Advisory Agents</div>
                <div className="h-px flex-1 bg-slate-800/60"/>
              </div>
              <AgentPanel data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} companyName={companyName} companyProfile={companyProfile}/>
            </div>
          )}
          {activeView === 'scenarios'   && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-amber-500/10"/>
                <SectionNote noteKey="scenarios" notes={panelNotes} onSave={setPanelNote}/>
                <button onClick={() => openChat('Help me understand what scenario I should be planning for. Based on my current financials, what are the most important variables to model — revenue growth, margins, or headcount?')}
                  className="flex items-center gap-1.5 text-[12px] text-amber-400 hover:text-amber-300 bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/25 hover:border-amber-500/50 px-3 py-1.5 rounded-lg transition-all font-medium">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
                  Ask AI what to model
                </button>
                <div className="h-px flex-1 bg-amber-500/10"/>
              </div>
              <ScenarioModeler data={data} onAskAI={openChat}/>
            </div>
          )}
          {activeView === 'pipeline' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-sky-500/10"/>
                <button onClick={() => openChat('Analyze my deal pipeline. What deals are at risk, which should I prioritize to hit my number this quarter, and what actions should I take today?')}
                  className="flex items-center gap-1.5 text-[12px] text-sky-400 hover:text-sky-300 bg-sky-500/8 hover:bg-sky-500/15 border border-sky-500/25 hover:border-sky-500/50 px-3 py-1.5 rounded-lg transition-all font-medium">
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
                  Ask AI about pipeline
                </button>
                <div className="h-px flex-1 bg-sky-500/10"/>
              </div>
              <KanbanBoard />
            </div>
          )}
          {activeView === 'automations' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-rose-500/10"/>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em]">IF / THEN Rules</div>
                <div className="h-px flex-1 bg-rose-500/10"/>
              </div>
              <AutomationBuilder />
            </div>
          )}
          {activeView === 'data'         && <DataSourcePanel data={data} onDataUpdate={handleDataUpdate} onSuccess={handleDataSuccess} companyProfile={companyProfile} onProfileChange={saveCompanyProfile}/>}
        </main>

        {/* ── Onboarding flow ── */}
        {showOnboarding && (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        )}

        {/* ── Period name modal ── */}
        {showPeriodModal && (
          <PeriodModal
            onConfirm={handlePeriodConfirm}
            onSkip={() => { handlePeriodConfirm('Imported Data'); }}
          />
        )}

        {/* ── Floating AI Chat button ── */}
        {!chatOpen && (
          <button
            onClick={() => openChat()}
            className="no-print fixed bottom-5 right-5 z-[145] flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[13px] font-semibold shadow-2xl transition-all hover:scale-105 active:scale-95"
            style={{ boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
              <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
              <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
            </svg>
            Ask AI
            <span className="hidden sm:inline text-[10px] opacity-60 font-normal">⌘K</span>
          </button>
        )}

        {/* ── AI Chat panel ── */}
        <AIChat
          data={data}
          open={chatOpen}
          onClose={() => { setChatOpen(false); setChatInitialMsg(undefined); }}
          initialMessage={chatInitialMsg}
          onInitialMessageSent={() => setChatInitialMsg(undefined)}
          companyName={companyName}
          activeView={activeView}
          companyProfile={companyProfile}
        />

        {/* ── Keyboard shortcuts modal ── */}
        {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)}/>}

        {/* ── Welcome modal (first visit) ── */}
        {showWelcome && (
          <WelcomeModal
            onDismiss={() => setShowWelcome(false)}
            onGoToData={() => { setShowWelcome(false); setActiveView('data'); }}
          />
        )}

        {/* ── Toasts ── */}
        <ToastContainer toasts={toasts} dismiss={dismissToast}/>
      </div>
    </>
  );
}
