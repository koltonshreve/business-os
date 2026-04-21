import React, { useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { UnifiedBusinessData, KPIDashboard, WeeklyInsight, BoardDeck, Goals, Budget, CustomKPI, OnboardingData } from '../types';
import { DEMO_CUSTOMERS } from '../lib/demo-customers';
import { loadSession, saveSession, defaultSession } from '../lib/plan';
import { loadAuthSession, clearAuthSession } from '../lib/auth';
import KPIGrid from '../components/dashboard/KPIGrid';
import AlertFeed from '../components/dashboard/AlertFeed';
import AIChat from '../components/AIChat';
import OnboardingFlow from '../components/onboarding/OnboardingFlow';
import CommandPalette from '../components/CommandPalette';
import PricingModal from '../components/pricing/PricingModal';
import DailyBriefing from '../components/dashboard/DailyBriefing';
import DailyPriorities from '../components/deals/DailyPriorities';
import ConnectedModel from '../components/dashboard/ConnectedModel';
import type { CompanyProfile } from '../components/dashboard/DataSourcePanel';
import type { Threshold } from '../components/dashboard/MetricThresholdsPanel';
import AddBackTracker from '../components/dashboard/AddBackTracker';
import EBITDABridge from '../components/dashboard/EBITDABridge';
import RevenueBridge from '../components/dashboard/RevenueBridge';
import WorkingCapitalDashboard from '../components/dashboard/WorkingCapitalDashboard';
import CompanySwitcher from '../components/dashboard/CompanySwitcher';
import ManualEntryModal from '../components/ManualEntryModal';
import ErrorBoundary from '../components/ErrorBoundary';
import { loadDeals } from '../lib/deals';
import type { Deal } from '../lib/deals';
import { computeModelChain, applyScenario, ZERO_SCENARIO } from '../lib/model';
import type { ScenarioAdjustment } from '../lib/model';

// ── Shared loading skeleton for dynamic imports ───────────────────────────────
function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Section label */}
      <div className="flex items-center gap-3">
        <div className="h-2 w-16 bg-slate-800/60 rounded"/>
        <div className="flex-1 h-px bg-slate-800/40"/>
      </div>
      {/* Metric row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/40 rounded-xl h-[80px]"/>
        ))}
      </div>
      {/* Chart */}
      <div className="bg-slate-900/50 border border-slate-800/40 rounded-xl h-[220px]"/>
      {/* Section label */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-2 w-20 bg-slate-800/60 rounded"/>
        <div className="flex-1 h-px bg-slate-800/40"/>
      </div>
      {/* Cards row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800/40 rounded-xl h-[140px]"/>
        ))}
      </div>
    </div>
  );
}

const SKELETON = { loading: TabSkeleton };

// ── Dynamic imports (code-split heavy/tab-specific components) ────────────────
const RevenueChart        = dynamic(() => import('../components/charts/RevenueChart'),                     { ssr: false });
const CostBreakdownChart  = dynamic(() => import('../components/charts/CostBreakdownChart'),               { ssr: false });
const CustomerMetricsChart= dynamic(() => import('../components/charts/CustomerMetricsChart'),             { ssr: false });
const FinancialDashboard  = dynamic(() => import('../components/dashboard/FinancialDashboard'),            { ...SKELETON, ssr: false });
const CustomerDashboard   = dynamic(() => import('../components/dashboard/CustomerDashboard'),             { ...SKELETON, ssr: false });
const OperationsDashboard = dynamic(() => import('../components/dashboard/OperationsDashboard'),           { ...SKELETON, ssr: false });
const IntelligenceDashboard=dynamic(() => import('../components/dashboard/IntelligenceDashboard'),        { ...SKELETON, ssr: false });
const DataSourcePanel     = dynamic(() => import('../components/dashboard/DataSourcePanel'),               { ...SKELETON, ssr: false });
const ScenarioModeler     = dynamic(() => import('../components/dashboard/ScenarioModeler'),               { ...SKELETON, ssr: false });
const CustomKPIPanel      = dynamic(() => import('../components/dashboard/CustomKPIPanel'),                { ssr: false });
const TrendSignalsPanel   = dynamic(() => import('../components/dashboard/TrendSignalsPanel'),             { ssr: false });
const TransactionLedger   = dynamic(() => import('../components/dashboard/TransactionLedger'),             { ssr: false });
const MetricThresholdsPanel=dynamic(() => import('../components/dashboard/MetricThresholdsPanel'),        { ssr: false });
const AgentPanel          = dynamic(() => import('../components/dashboard/AgentPanel'),                    { ssr: false });
const IndustryBenchmarksPanel=dynamic(() => import('../components/dashboard/IndustryBenchmarksPanel'),    { ssr: false });
const PLStatement         = dynamic(() => import('../components/PLStatement'),                             { ssr: false });
const BudgetPanel         = dynamic(() => import('../components/dashboard/BudgetPanel'),                   { ssr: false });
const KanbanBoard         = dynamic(() => import('../components/crm/KanbanBoard'),                         { ...SKELETON, ssr: false });
const AutomationBuilder   = dynamic(() => import('../components/automation/AutomationBuilder'),             { ...SKELETON, ssr: false });
const AcquisitionPipeline = dynamic(() => import('../components/acquisition/AcquisitionPipeline'),         { ...SKELETON, ssr: false });
const GoalEngine          = dynamic(() => import('../components/goals/GoalEngine'),                        { ...SKELETON, ssr: false });
const DecisionEngine      = dynamic(() => import('../components/intelligence/DecisionEngine'),             { ssr: false });
const TeamFeed            = dynamic(() => import('../components/team/TeamFeed'),                           { ...SKELETON, ssr: false });
const CashRunway          = dynamic(() => import('../components/dashboard/CashRunway'),                    { ...SKELETON, ssr: false });
const TaskBoard           = dynamic(() => import('../components/tasks/TaskBoard'),                         { ...SKELETON, ssr: false });
const DealList            = dynamic(() => import('../components/deals/DealList'),                          { ...SKELETON, ssr: false });
const SupplierDashboard   = dynamic(() => import('../components/dashboard/SupplierDashboard'),              { ...SKELETON, ssr: false });
const SKUAnalyzer         = dynamic(() => import('../components/dashboard/SKUAnalyzer'),                    { ...SKELETON, ssr: false });
const CapacityAnalyzer    = dynamic(() => import('../components/dashboard/CapacityAnalyzer'),                { ...SKELETON, ssr: false });
const CapitalImpactSummary= dynamic(() => import('../components/dashboard/CapitalImpactSummary'),             { ...SKELETON, ssr: false });
const BenchmarkFeed       = dynamic(() => import('../components/dashboard/BenchmarkFeed'),                    { ssr: false });
const ValuationEstimator  = dynamic(() => import('../components/dashboard/ValuationEstimator'),               { ...SKELETON, ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────
type ActiveView = 'deals' | 'today' | 'overview' | 'financial' | 'customers' | 'operations' | 'intelligence' | 'scenarios' | 'data' | 'pipeline' | 'automations' | 'acquisitions' | 'goals' | 'team' | 'cash' | 'execute' | 'suppliers' | 'skus' | 'capacity' | 'purchasing' | 'valuation';
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
  const fmtN     = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };
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
  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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
      { period: 'Jan 2026', periodType: 'monthly', revenue: 178000, cogs: 107000, ebitda: 26700,  recurring: 104000, oneTime: 74000 },
      { period: 'Feb 2026', periodType: 'monthly', revenue: 192000, cogs: 115000, ebitda: 28800,  recurring: 113000, oneTime: 79000 },
      { period: 'Mar 2026', periodType: 'monthly', revenue: 205000, cogs: 123000, ebitda: 30750,  recurring: 122000, oneTime: 83000 },
      { period: 'Apr 2026', periodType: 'monthly', revenue: 188000, cogs: 113000, ebitda: 28200,  recurring: 112000, oneTime: 76000 },
      { period: 'May 2026', periodType: 'monthly', revenue: 220000, cogs: 132000, ebitda: 33000,  recurring: 132000, oneTime: 88000 },
      { period: 'Jun 2026', periodType: 'monthly', revenue: 245000, cogs: 147000, ebitda: 36750,  recurring: 154000, oneTime: 91000 },
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
    { name: 'TechStart Inc — Enterprise Plan',    stage: 'Negotiation', value: 125000, probability: 75, closeDate: '2026-07-31', owner: 'Sarah K.' },
    { name: 'Global Logistics LLC',               stage: 'Proposal',    value: 220000, probability: 40, closeDate: '2026-08-20', owner: 'Mark D.' },
    { name: 'Metro Health Partners',              stage: 'Discovery',   value: 180000, probability: 20, closeDate: '2026-09-30', owner: 'Sarah K.' },
    { name: 'Pinnacle Mfg — Renewal',             stage: 'Negotiation', value: 95000,  probability: 80, closeDate: '2026-07-15', owner: 'Mark D.' },
    { name: 'Westfield Retail Group',             stage: 'Proposal',    value: 145000, probability: 35, closeDate: '2026-08-15', owner: 'Alex R.' },
    { name: 'Summit Capital Partners',            stage: 'Closed Won',  value: 88000,  probability: 100,closeDate: '2026-06-30', owner: 'Alex R.' },
    { name: 'Horizon Biotech',                    stage: 'Discovery',   value: 310000, probability: 15, closeDate: '2026-10-31', owner: 'Sarah K.' },
    { name: 'Pacific Coast Distribution',        stage: 'Negotiation', value: 72000,  probability: 65, closeDate: '2026-07-20', owner: 'Mark D.' },
  ],
  payrollByDept: [
    { department: 'Delivery / Operations', headcount: 5,  totalCompensation: 195000, avgSalary: 39000 },
    { department: 'Sales',                 headcount: 3,  totalCompensation: 108000, avgSalary: 36000 },
    { department: 'Engineering',           headcount: 3,  totalCompensation: 96000,  avgSalary: 32000 },
    { department: 'G&A / Admin',           headcount: 2,  totalCompensation: 60000,  avgSalary: 30000 },
    { department: 'Leadership',            headcount: 1,  totalCompensation: 84000,  avgSalary: 84000 },
  ],
  cashFlow: [
    { period: 'Jan 2026', openingBalance: 420000, receipts: 165000, payments: 138000, closingBalance: 447000, netCashFlow: 27000 },
    { period: 'Feb 2026', openingBalance: 447000, receipts: 178000, payments: 152000, closingBalance: 473000, netCashFlow: 26000 },
    { period: 'Mar 2026', openingBalance: 473000, receipts: 195000, payments: 164000, closingBalance: 504000, netCashFlow: 31000 },
    { period: 'Apr 2026', openingBalance: 504000, receipts: 172000, payments: 147000, closingBalance: 529000, netCashFlow: 25000 },
    { period: 'May 2026', openingBalance: 529000, receipts: 208000, payments: 170000, closingBalance: 567000, netCashFlow: 38000 },
    { period: 'Jun 2026', openingBalance: 567000, receipts: 235000, payments: 185000, closingBalance: 617000, netCashFlow: 50000 },
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
    coveragePeriod: { start: 'Jan 2026', end: 'Jun 2026' },
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
      { period: 'Jul 2025', periodType: 'monthly', revenue: 148000, cogs: 89000,  ebitda: 22200 },
      { period: 'Aug 2025', periodType: 'monthly', revenue: 162000, cogs: 97000,  ebitda: 24300 },
      { period: 'Sep 2025', periodType: 'monthly', revenue: 175000, cogs: 105000, ebitda: 26250 },
      { period: 'Oct 2025', periodType: 'monthly', revenue: 165000, cogs: 99000,  ebitda: 24750 },
      { period: 'Nov 2025', periodType: 'monthly', revenue: 188000, cogs: 113000, ebitda: 28200 },
      { period: 'Dec 2025', periodType: 'monthly', revenue: 202000, cogs: 121000, ebitda: 30300 },
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
    { period: 'Jul 2025', openingBalance: 320000, receipts: 138000, payments: 118000, closingBalance: 340000, netCashFlow: 20000 },
    { period: 'Aug 2025', openingBalance: 340000, receipts: 150000, payments: 131000, closingBalance: 359000, netCashFlow: 19000 },
    { period: 'Sep 2025', openingBalance: 359000, receipts: 162000, payments: 140000, closingBalance: 381000, netCashFlow: 22000 },
    { period: 'Oct 2025', openingBalance: 381000, receipts: 152000, payments: 134000, closingBalance: 399000, netCashFlow: 18000 },
    { period: 'Nov 2025', openingBalance: 399000, receipts: 175000, payments: 151000, closingBalance: 423000, netCashFlow: 24000 },
    { period: 'Dec 2025', openingBalance: 423000, receipts: 188000, payments: 164000, closingBalance: 447000, netCashFlow: 24000 },
  ],
};

const DEMO_SNAPSHOT: PeriodSnapshot = { id: 'demo', label: 'Q2 2026 (Demo)', data: DEMO_DATA, createdAt: new Date().toISOString() };
const PREV_SNAPSHOT: PeriodSnapshot = { id: 'prev-demo', label: 'H2 2025 (Demo)', data: PREV_DEMO, createdAt: new Date().toISOString() };

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

  const fmtCur = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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
                <div className={`text-[10px] font-semibold ${attainment >= 100 ? 'text-emerald-400' : attainment >= 75 ? 'text-amber-400' : 'text-slate-600'}`}>
                  {attainment >= 100 ? '✓ On target' : `${attainment.toFixed(0)}%`}
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
  Pipeline:     () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M1 2h2.5v2H1V2zm0 4h2.5v2H1V6zm0 4h2.5v2H1v-2zm4-8h2.5v2H5V2zm0 4h2.5v2H5V6zm0 4h2.5v2H5v-2zm4-8h2.5v2H9V2zm0 4h2.5v2H9V6zm0 4h2.5v2H9v-2z"/></svg>,
  Automations:  () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M7 1L3 7h4l-1 6 5-6H8l1-6z"/></svg>,
  Acquisitions: () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M7 1l1.8 3.6 4 .6-2.9 2.8.7 4L7 10l-3.6 2 .7-4L1.2 5.2l4-.6L7 1z"/></svg>,
  Goals:        () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.25"/><circle cx="7" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.25"/><circle cx="7" cy="7" r="1"/></svg>,
  Team:         () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><circle cx="4.5" cy="4" r="2"/><path d="M0 11c0-2.2 2-4 4.5-4S9 8.8 9 11H0z"/><circle cx="10.5" cy="4.5" r="1.5"/><path d="M14 11c0-1.7-1.5-3-3.5-3-.7 0-1.3.2-1.8.5.8.7 1.3 1.5 1.3 2.5H14z"/></svg>,
  Cash:         () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><rect x="1" y="3" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.25"/><path d="M7 5.5v3M5.5 7h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><path d="M1 6h2M11 6h2M1 8h2M11 8h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/></svg>,
  Execute:      () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M1 3h12v1.5H1V3zm0 3.5h8v1.5H1V6.5zm0 3.5h10v1.5H1V10z"/><circle cx="11.5" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="1.25"/><path d="M11 6.3v1.4M10.3 7h1.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>,
  Deals:        () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0"><path d="M1 7.5L7 1l6 6.5V13H9v-3H5v3H1V7.5z"/></svg>,
  Today:        () => <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-3.5 h-3.5 flex-shrink-0"><rect x="1.5" y="2.5" width="11" height="10" rx="1.2"/><path d="M4.5 1.5v2M9.5 1.5v2M1.5 6h11"/><path d="M4.5 9l1.5 1.5L9.5 8" strokeWidth="1.6"/></svg>,
  Suppliers:    () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><path d="M2 4h10v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" fill="none" stroke="currentColor" strokeWidth="1.25"/><path d="M1 2h12v2H1V2z"/><path d="M5 7h4M5 9h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>,
  SKUs:         () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><rect x="1" y="1" width="5" height="5" rx="0.8"/><rect x="8" y="1" width="5" height="5" rx="0.8"/><rect x="1" y="8" width="5" height="5" rx="0.8"/><path d="M8 10.5h5M10.5 8v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/></svg>,
  Capacity:     () => <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0"><rect x="1" y="9" width="2.5" height="4" rx="0.5"/><rect x="4.5" y="6" width="2.5" height="7" rx="0.5"/><rect x="8" y="3.5" width="2.5" height="9.5" rx="0.5"/><rect x="11.5" y="1" width="1.5" height="12" rx="0.5"/><path d="M1 7.5l3-2.5 3-1.5 3.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>,
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

  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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
  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };
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

  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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

  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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

  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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

// ── Simple Mode Panel ─────────────────────────────────────────────────────────
// Minimal executive view: 4 key metrics + top actions + alerts + AI shortcut.
function SimpleModePanel({
  data, dashboard, onAskAI, onNavigate, onExitSimple,
}: {
  data: UnifiedBusinessData;
  dashboard: KPIDashboard | null;
  onAskAI?: (msg?: string) => void;
  onNavigate: (view: string) => void;
  onExitSimple: () => void;
}) {
  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const rev = data.revenue.total;
  const cogs = data.costs.totalCOGS;
  const opex = data.costs.totalOpEx;
  const gp = rev - cogs;
  const gm = rev > 0 ? gp / rev : 0;
  const ebitda = gp - opex;
  const em = rev > 0 ? ebitda / rev : 0;
  const cashLatest = data.cashFlow?.length ? data.cashFlow[data.cashFlow.length - 1].closingBalance : null;

  // Pull top 3 KPIs from computed dashboard or fallback to manual
  const keyKPIs: { label: string; value: string; status: string; sub?: string }[] = dashboard?.kpis.slice(0, 4).map(k => ({
    label: k.name,
    value: k.formattedValue,
    status: k.status,
    sub: k.description,
  })) ?? [
    { label: 'Revenue', value: fmtN(rev), status: 'neutral' },
    { label: 'Gross Margin', value: fmtPct(gm), status: gm > 0.4 ? 'green' : gm > 0.25 ? 'yellow' : 'red' },
    { label: 'EBITDA', value: fmtN(ebitda), status: ebitda >= 0 ? 'green' : 'red' },
    { label: 'EBITDA Margin', value: fmtPct(em), status: em > 0.1 ? 'green' : em > 0 ? 'yellow' : 'red' },
  ];

  const statusColor = (s: string) =>
    s === 'green' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
    : s === 'yellow' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
    : s === 'red' ? 'text-red-400 border-red-500/20 bg-red-500/5'
    : 'text-slate-200 border-slate-800/50 bg-slate-900/40';

  const quickLinks: { label: string; view: string; color: string }[] = [
    { label: 'Financial', view: 'financial', color: 'text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10' },
    { label: 'Customers', view: 'customers', color: 'text-violet-400 border-violet-500/20 hover:bg-violet-500/10' },
    { label: 'Cash', view: 'cash', color: 'text-teal-400 border-teal-500/20 hover:bg-teal-500/10' },
    { label: 'Deals', view: 'deals', color: 'text-blue-400 border-blue-500/20 hover:bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[20px] font-bold text-slate-100">Executive Summary</div>
          <div className="text-[12px] text-slate-500 mt-0.5">Simple mode — key metrics &amp; priorities only</div>
        </div>
        <button
          onClick={onExitSimple}
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600 px-3 py-1.5 rounded-lg transition-all"
        >
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
          Full dashboard
        </button>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {keyKPIs.map((kpi, i) => (
          <div key={i} className={`rounded-xl border px-4 py-3 ${statusColor(kpi.status)}`}>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">{kpi.label}</div>
            <div className="text-[20px] font-bold tabular-nums leading-tight">{kpi.value}</div>
            {kpi.sub && <div className="text-[10px] text-slate-600 mt-1 leading-snug truncate">{kpi.sub}</div>}
          </div>
        ))}
        {cashLatest !== null && (
          <div className={`rounded-xl border px-4 py-3 ${cashLatest > 0 ? 'text-slate-200 border-slate-800/50 bg-slate-900/40' : 'text-red-400 border-red-500/20 bg-red-500/5'}`}>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1">Cash</div>
            <div className="text-[20px] font-bold tabular-nums leading-tight">{fmtN(cashLatest)}</div>
            <div className="text-[10px] text-slate-600 mt-1">Latest closing balance</div>
          </div>
        )}
      </div>

      {/* Top actions */}
      <TopActionsWidget
        onRunAgent={() => onNavigate('intelligence')}
        onViewAll={() => onNavigate('intelligence')}
      />

      {/* Ask AI — big CTA */}
      <div className="bg-indigo-500/[0.06] border border-indigo-500/20 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-200">Ask your AI CFO anything</div>
          <div className="text-[12px] text-slate-500 mt-0.5">Get instant analysis, forecasts, or strategic advice based on your data.</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onAskAI?.('What are the 3 most important things I should focus on this week based on my current business data?')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[12px] font-semibold transition-all shadow-sm whitespace-nowrap"
          >
            Weekly priorities →
          </button>
          <button
            onClick={() => onAskAI?.()}
            className="px-4 py-2 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-400 rounded-xl text-[12px] font-semibold transition-all whitespace-nowrap"
          >
            Ask AI
          </button>
        </div>
      </div>

      {/* Quick navigation */}
      <div>
        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-2.5">Detailed Views</div>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map(link => (
            <button
              key={link.view}
              onClick={() => { onNavigate(link.view); onExitSimple(); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[12px] font-medium transition-all ${link.color}`}
            >
              {link.label} →
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Revenue Forecast Strip ────────────────────────────────────────────────────
function RevenueForecastStrip({ data, onAskAI }: { data: UnifiedBusinessData; onAskAI?: (msg: string) => void }) {
  const periods = data.revenue.byPeriod;
  if (periods.length < 3) return null; // need at least 3 data points

  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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
              {slope > 0 ? '↑' : slope < 0 ? '↓' : '→'} {Math.abs(growthPct).toFixed(1)}%/period trend
            </span>
            <span className="text-slate-700">·</span>
            <span className={`font-medium ${confidenceColor}`}>{confidenceLabel} accuracy</span>
          </div>
        </div>
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
        Based on {n} historical periods. Range shows projected variance. Low accuracy indicates high revenue variability — treat as directional.
      </div>
    </div>
  );
}

// ── Pipeline Revenue Forecast ─────────────────────────────────────────────────
// Forward 30/60/90-day view using weighted pipeline EV from active CRM deals
// Reads from the KanbanBoard localStorage key ('bos_deals')
interface CRMDeal { value: number; probability: number; closeDate: string; stage: string }

function PipelineRevenueForecast() {
  // Load CRM deals client-side to avoid SSR/hydration mismatch
  const [crmDeals, setCrmDeals] = useState<CRMDeal[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bos_deals');
      if (raw) setCrmDeals((JSON.parse(raw) as CRMDeal[]).filter(d => d.value && d.probability != null && d.closeDate));
    } catch { /* ignore */ }
  }, []);

  const today = new Date();
  const active = crmDeals.filter(d =>
    d.stage !== 'closed-lost' && d.closeDate && new Date(d.closeDate) >= today
  );
  if (active.length === 0) return null;

  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

  const buckets = [
    { label: 'Next 30 days', days: 30 },
    { label: 'Next 60 days', days: 60 },
    { label: 'Next 90 days', days: 90 },
  ].map(({ label, days }) => {
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + days);
    const inWindow = active.filter(d => new Date(d.closeDate) <= cutoff);
    const weighted = inWindow.reduce((s, d) => s + d.value * (d.probability / 100), 0);
    const gross    = inWindow.reduce((s, d) => s + d.value, 0);
    return { label, days, weighted, gross, count: inWindow.length };
  });

  const totalGross = buckets[2].gross;
  const totalWt    = buckets[2].weighted;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="text-[13px] font-semibold text-slate-100">Pipeline Revenue Forecast</div>
          <div className="text-[11px] text-slate-500">
            {active.length} active deal{active.length !== 1 ? 's' : ''} · {fmtN(totalWt)} weighted (90-day)
          </div>
        </div>
        <div className="text-[10px] text-slate-600">
          {totalGross > 0 ? `${((totalWt / totalGross) * 100).toFixed(0)}% avg probability` : ''}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {buckets.map((b, i) => (
          <div key={b.label} className={`rounded-xl border p-4 ${i === 0 ? 'border-sky-500/25 bg-sky-500/5' : 'border-slate-700/40 bg-slate-800/20'}`}>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1">{b.label}</div>
            <div className={`text-[18px] font-bold tracking-tight ${i === 0 ? 'text-sky-300' : 'text-slate-300'}`}>{fmtN(b.weighted)}</div>
            <div className="text-[11px] text-slate-600 mt-1">{b.count} deal{b.count !== 1 ? 's' : ''} · {fmtN(b.gross)} gross</div>
          </div>
        ))}
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

  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };

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
  const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };
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

// ── Snapshot Share ────────────────────────────────────────────────────────────
function generateShareURL(data: UnifiedBusinessData, label: string, companyName: string): string {
  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const gp     = rev - cogs;
  const ebitda = gp - opex;
  const cf = data.cashFlow ?? [];
  const cash = cf.length ? cf[cf.length - 1].closingBalance : null;
  const avgBurn = cf.length ? cf.reduce((s, p) => s + (p.netCashFlow ?? 0), 0) / cf.length : null;
  const runway = cash != null && avgBurn != null && avgBurn < 0 ? parseFloat(Math.abs(cash / avgBurn).toFixed(1)) : undefined;
  const payload = {
    v: 2,
    company: companyName,
    period: label,
    rev, cogs, opex, ebitda,
    gpMargin: rev > 0 ? parseFloat(((gp / rev) * 100).toFixed(1)) : 0,
    ebitdaMargin: rev > 0 ? parseFloat(((ebitda / rev) * 100).toFixed(1)) : 0,
    customers: data.customers.totalCount,
    newCust: data.customers.newThisPeriod,
    churned: data.customers.churned,
    retention: data.customers.retentionRate ?? 0.88,
    headcount: data.operations.headcount ?? undefined,
    runway,
    pipelineValue: data.pipeline?.reduce((s, p) => s + p.value * (p.probability / 100), 0),
    trend: data.revenue.byPeriod.slice(-8).map(p => ({ period: p.period, rev: p.revenue })),
    topCustomers: data.customers.topCustomers.slice(0, 5).map(c => ({ name: c.name, pct: c.percentOfTotal })),
    sharedAt: new Date().toISOString(),
  };
  const encoded = btoa(JSON.stringify(payload));
  return `${window.location.origin}/share#${encoded}`;
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
  const quick = ['Q2 2026','Q3 2026','Q1 2026','Q4 2025','Apr 2026','May 2026','Jun 2026','YTD 2026','Full Year 2025'];
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
  valuation:    { label: 'Valuation',             text: 'EV range, quality-of-earnings, and exit roadmap', link: 'text-purple-400 group-hover:text-purple-300',   border: 'hover:border-purple-500/30 group-hover:bg-purple-500/5',   titleColor: 'group-hover:text-purple-200'  },
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

// ── Data Freshness Bar ────────────────────────────────────────────────────────

function DataFreshnessBar({ snapshots, activeSnapshotId }: { snapshots: PeriodSnapshot[]; activeSnapshotId: string }) {
  const snap = snapshots.find(s => s.id === activeSnapshotId);
  if (!snap) return null;
  const end = snap.data.metadata?.coveragePeriod?.end;
  const daysSince = end ? Math.floor((Date.now() - new Date(end).getTime()) / 86400000) : null;
  const snapshotAge = Math.floor((Date.now() - new Date(snap.createdAt).getTime()) / 86400000);

  const freshColor = daysSince === null ? 'text-slate-500 border-slate-800/50 bg-slate-900/30'
    : daysSince > 60 ? 'text-red-400 border-red-500/20 bg-red-500/5'
    : daysSince > 30 ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
    : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';

  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${freshColor}`}>
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${daysSince === null ? 'bg-slate-600' : daysSince > 60 ? 'bg-red-400' : daysSince > 30 ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`}/>
        <div>
          <div className="text-[12px] font-semibold">
            {snap.label}
            {end && <span className="font-normal text-[11px] ml-2 opacity-70">· data through {new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          </div>
          <div className="text-[10px] opacity-60 mt-0.5">
            {daysSince !== null ? (daysSince === 0 ? 'Current period' : `Data is ${daysSince} days old`) : 'Coverage period unknown'}
            {' · '}snapshot loaded {snapshotAge === 0 ? 'today' : `${snapshotAge}d ago`}
          </div>
        </div>
      </div>
      {daysSince !== null && daysSince > 30 && (
        <div className="text-[10px] font-medium opacity-70 text-right">
          Upload newer data →<br/>
          <span className="opacity-60">to refresh analysis</span>
        </div>
      )}
    </div>
  );
}

// ── Session Manager Panel ─────────────────────────────────────────────────────

function SessionManagerPanel() {
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const BOS_KEYS = [
    'bos_session', 'bos_company', 'bos_company_profile',
    'bos_deals', 'bos_deals_v2', 'bos_acq_targets',
    'bos_goals', 'bos_memory', 'bos_automations', 'bos_tasks',
    'bos_custom_kpis', 'bos_thresholds', 'bos_budget',
    'bos_panel_notes', 'bos_annotations', 'bos_agent_results',
    'bos_weekly_insight', 'bos_board_deck', 'bos_alerts',
    'bos_report_timestamps', 'bos_onboarding',
  ];

  const exportSession = () => {
    const keys = includeSnapshots ? [...BOS_KEYS, 'bos_snapshots', 'bos_active_id'] : BOS_KEYS;
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), includesSnapshots: includeSnapshots };
    keys.forEach(key => {
      try {
        const val = localStorage.getItem(key);
        if (val) out[key] = JSON.parse(val);
      } catch { /* ignore */ }
    });
    const json = JSON.stringify(out, null, 2);
    const kb = Math.round(json.length / 1024);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `business-os-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    setImportStatus(`Exported ${kb}KB`);
    setTimeout(() => setImportStatus(null), 3000);
  };

  const importSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
        const allKeys = [...BOS_KEYS, 'bos_snapshots', 'bos_active_id'];
        let count = 0;
        allKeys.forEach(key => {
          if (parsed[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(parsed[key]));
            count++;
          }
        });
        setImportStatus(`Imported ${count} keys — reload to apply`);
      } catch { setImportStatus('Invalid backup file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-5">
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-3">Session Backup</div>
      <p className="text-[12px] text-slate-500 mb-4 leading-relaxed">
        Export your deals, acquisitions, goals, and settings as a JSON backup you can restore on any device.
      </p>

      {/* Include snapshots toggle */}
      <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
        <button
          type="button"
          onClick={() => setIncludeSnapshots(v => !v)}
          className={`relative flex-shrink-0 w-8 rounded-full border transition-all ${includeSnapshots ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}
          style={{ height: '18px' }}
          aria-checked={includeSnapshots}
          role="switch"
        >
          <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${includeSnapshots ? 'left-3.5' : 'left-0.5'}`}/>
        </button>
        <span className="text-[12px] text-slate-400">
          Include financial snapshots <span className="text-slate-600">(adds ~1–5MB)</span>
        </span>
      </label>

      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          onClick={exportSession}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-[12px] font-semibold rounded-xl transition-colors">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
            <path d="M7 1v7M4 5l3 3 3-3M2 11v1a1 1 0 001 1h8a1 1 0 001-1v-1"/>
          </svg>
          Export backup
        </button>
        <label className="flex items-center gap-2 px-4 py-2 border border-slate-700/60 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-[12px] font-semibold rounded-xl cursor-pointer transition-colors">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
            <path d="M7 9V2M4 5l3-3 3 3M2 11v1a1 1 0 001 1h8a1 1 0 001-1v-1"/>
          </svg>
          Import backup
          <input type="file" accept=".json" onChange={importSession} className="hidden"/>
        </label>
        {importStatus && (
          <span className={`text-[11px] font-medium ${importStatus.includes('Invalid') ? 'text-red-400' : 'text-emerald-400'}`}>
            {importStatus.includes('reload')
              ? <>{importStatus.split(' — ')[0]} — <button onClick={() => window.location.reload()} className="underline hover:no-underline">reload now</button></>
              : importStatus
            }
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BusinessOS() {
  const router = useRouter();

  // ── Auth gate (soft — loads session if present, never blocks access) ──────
  const [authEmail, setAuthEmail] = useState('');

  useEffect(() => {
    const session = loadAuthSession();
    if (session) setAuthEmail(session.email);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSignOut() {
    clearAuthSession();
    setAuthEmail('');
  }

  const [activeView, setActiveView]             = useState<ActiveView>('deals');
  const [jumpDealId, setJumpDealId]             = useState<string | null>(null);
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
  const [moreNavOpen, setMoreNavOpen]           = useState(false);
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
  const [paletteOpen, setPaletteOpen]             = useState(false);
  const [pricingOpen, setPricingOpen]             = useState(false);
  const [showDeepAnalysis, setShowDeepAnalysis]   = useState(false);
  const [simpleMode, setSimpleModeState]          = useState(false);
  const [showShareModal, setShowShareModal]        = useState(false);
  const [shareUrl, setShareUrl]                    = useState('');
  const [shareCopied, setShareCopied]              = useState(false);
  const [showManualEntry, setShowManualEntry]      = useState(false);

  // Run Report progress modal
  type StepStatus = 'pending' | 'running' | 'done' | 'error';
  type ReportStep = { id: string; label: string; status: StepStatus; detail?: string };
  const [reportProgress, setReportProgress]       = useState<ReportStep[] | null>(null);

  // Deal pipeline (loaded from localStorage, refreshed when switching to deals view)
  const [deals, setDeals]             = useState<Deal[]>([]);
  // Active scenario overlay — propagated to all modules
  const [scenarioAdj, setScenarioAdj] = useState<ScenarioAdjustment | null>(null);

  // ── Lifted IIFE states (avoid hooks-in-conditional error #310) ──────────────
  // Pricing Power Analyzer (Financial tab)
  const [pricingAnswer, setPricingAnswer] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingAnswers, setPricingAnswers] = useState<Record<string,string>>({});
  // Churn Risk Predictor (Customers tab)
  const [churnResult, setChurnResult] = useState('');
  const [churnLoading, setChurnLoading] = useState(false);
  // Investor Update Drafter (Intelligence tab)
  const [investorDraft, setInvestorDraft] = useState('');
  const [investorDraftLoading, setInvestorDraftLoading] = useState(false);
  const [investorAudience, setInvestorAudience] = useState<'lp'|'board'|'pe'>('board');
  // Deal Sourcing Brief (Acquisitions tab)
  const [dealBrief, setDealBrief] = useState('');
  const [dealBriefLoading, setDealBriefLoading] = useState(false);
  const [dealStratType, setDealStratType] = useState<'bolt-on'|'platform'|'geographic'|'vertical'>('bolt-on');
  // Market Sizing Calculator (Goals tab)
  const [mktInputs, setMktInputs] = useState<{tamDesc:string;tamSize:string;samPct:string;somPct:string;growthRate:string}>({ tamDesc: '', tamSize: '', samPct: '20', somPct: '3', growthRate: '8' });
  // Rolling 13-Week Cash Forecast (Cash tab)
  const [cashRows, setCashRows] = useState<{week:number;inflow:number;outflow:number}[]>(Array.from({length:13},(_,i)=>({week:i+1,inflow:0,outflow:0})));
  const [cashOpeningBal, setCashOpeningBal] = useState(0);
  const [cashMinBuffer, setCashMinBuffer] = useState(0);
  // Debt Service Tracker (Cash tab)
  const [debtPdfStatus, setDebtPdfStatus] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [debtPdfMsg, setDebtPdfMsg] = useState('');
  const [debtLines, setDebtLines] = useState<{id:string;name:string;balance:number;rate:number;payment:number;type:'term'|'revolver'|'mezz'}[]>([
    { id: 'd1', name: 'Senior Term Loan A', balance: 3_500_000, rate: 7.25, payment: 58_333, type: 'term' },
    { id: 'd2', name: 'Revolving Credit Facility', balance: 750_000, rate: 6.50, payment: 0, type: 'revolver' },
    { id: 'd3', name: 'Mezzanine Note', balance: 1_000_000, rate: 13.00, payment: 10_833, type: 'mezz' },
  ]);
  // ──────────────────────────────────────────────────────────────────────────

  // Load deals from localStorage
  useEffect(() => {
    setDeals(loadDeals());
  }, []);

  // Recompute deals when navigating to deals tab
  useEffect(() => {
    if (activeView === 'deals') setDeals(loadDeals());
  }, [activeView]);

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
    // Lifted IIFE states
    try { const s = localStorage.getItem('bos_market_sizing'); if (s) setMktInputs(JSON.parse(s)); } catch { /* ignore */ }
    try { const s = localStorage.getItem('bos_cash_forecast'); if (s) setCashRows(JSON.parse(s)); } catch { /* ignore */ }
    try { const s = localStorage.getItem('bos_cash_forecast_open'); if (s) setCashOpeningBal(parseFloat(s)); } catch { /* ignore */ }
    try { const s = localStorage.getItem('bos_cash_forecast_min'); if (s) setCashMinBuffer(parseFloat(s)); } catch { /* ignore */ }
    try { const s = localStorage.getItem('bos_debt_lines'); if (s) { const parsed = JSON.parse(s); if (Array.isArray(parsed) && parsed.length > 0) setDebtLines(parsed); } } catch { /* ignore */ }
    const savedCompare = localStorage.getItem('bos_compare_mode');
    if (savedCompare === 'true') setCompareMode(true);
    const savedUXMode = localStorage.getItem('bos_ux_mode');
    if (savedUXMode === 'simple') setSimpleModeState(true);
    try {
      const savedTs = localStorage.getItem('bos_report_timestamps');
      if (savedTs) setReportTimestamps(JSON.parse(savedTs));
    } catch { /* ignore */ }
    // Restore user-uploaded period snapshots
    let hasUserData = false;
    const savedSnaps = localStorage.getItem('bos_snapshots');
    if (savedSnaps) {
      let parsed: PeriodSnapshot[] | null = null;
      try {
        parsed = JSON.parse(savedSnaps) as PeriodSnapshot[];
      } catch {
        // Stale or corrupt snapshot data — clear it so it doesn't repeat on every load
        localStorage.removeItem('bos_snapshots');
        localStorage.removeItem('bos_active_id');
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        try {
          setSnapshots([...parsed, PREV_SNAPSHOT, DEMO_SNAPSHOT]);
          const savedActiveId = localStorage.getItem('bos_active_id');
          const restoredId = savedActiveId && parsed.find(s => s.id === savedActiveId) ? savedActiveId : parsed[0].id;
          setActiveSnapshotId(restoredId);
          hasUserData = true;
        } catch {
          localStorage.removeItem('bos_snapshots');
          localStorage.removeItem('bos_active_id');
        }
      }
    }
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

  const toggleSimpleMode = useCallback(() => {
    setSimpleModeState(prev => {
      const next = !prev;
      localStorage.setItem('bos_ux_mode', next ? 'simple' : 'advanced');
      return next;
    });
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

  // ── Handle Stripe billing return (needs addToast, so lives here) ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingStatus   = params.get('billing');
    const stripeSessionId = params.get('session_id');
    if (!billingStatus) return;

    if (billingStatus === 'success' && stripeSessionId) {
      fetch('/api/billing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: stripeSessionId }),
      })
        .then(r => r.json())
        .then(result => {
          if (result.planId) {
            const updated = {
              ...loadSession(),
              planId:              result.planId,
              stripeCustomerId:    result.customerId,
              stripeSubscriptionId: result.subscriptionId,
              customerEmail:       result.customerEmail,
              billingVerifiedAt:   new Date().toISOString(),
            };
            saveSession(updated);
            addToast('success', `You're now on the ${result.planId.charAt(0).toUpperCase() + result.planId.slice(1)} plan — all features unlocked!`);
          }
        })
        .catch(() => {});
      window.history.replaceState({}, '', '/');
    } else if (billingStatus === 'cancelled') {
      window.history.replaceState({}, '', '/');
    }
  }, [addToast]);

  // Derived state
  const activeSnapshot  = snapshots.find(s => s.id === activeSnapshotId) ?? snapshots[0];
  const data            = activeSnapshot.data;
  // Scenario-adjusted data — all downstream modules use this instead of raw data
  const effectiveData   = useMemo(() => applyScenario(data, scenarioAdj), [data, scenarioAdj]);
  // Connected model chain: Deals → Revenue → EBITDA → Cash → Runway
  const modelChain      = useMemo(() => computeModelChain(effectiveData, deals, scenarioAdj), [effectiveData, deals, scenarioAdj]);
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
        setDismissedAlerts([]);
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

  // ── Run Report — sequential steps with live progress ───────────────────────
  const runFullReport = useCallback(async () => {
    const steps: ReportStep[] = [
      { id: 'kpis',    label: 'Refresh KPIs & metrics',    status: 'pending' },
      { id: 'alerts',  label: 'Scan for risk alerts',       status: 'pending' },
      { id: 'insight', label: 'Generate weekly insight',    status: 'pending' },
    ];
    setReportProgress([...steps]);

    const post = (action: string) => fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data, previousData: prevSnapshot?.data ?? PREV_DEMO, companyName, companyProfile }),
    }).then(r => r.json());

    const mark = (id: string, status: StepStatus, detail?: string) =>
      setReportProgress(prev => prev?.map(s => s.id === id ? { ...s, status, detail } : s) ?? null);

    try {
      // Step 1: KPIs
      mark('kpis', 'running');
      const r1 = await post('compute-kpis');
      if (r1.error) { mark('kpis', 'error', r1.error); return; }
      if (r1.dashboard) setDashboard(r1.dashboard);
      mark('kpis', 'done', `${r1.dashboard?.kpis?.length ?? 0} metrics computed`);

      // Step 2: Alerts
      mark('alerts', 'running');
      const r2 = await post('alerts');
      if (r2.error) { mark('alerts', 'error', r2.error); return; }
      if (r2.alerts) {
        setAlerts(r2.alerts);
        try { localStorage.setItem('bos_alerts', JSON.stringify(r2.alerts)); } catch { /* ignore */ }
        setDismissedAlerts([]);
        const high = (r2.alerts as {severity:string}[]).filter(a => a.severity === 'HIGH').length;
        mark('alerts', 'done', `${r2.alerts.length} alert${r2.alerts.length !== 1 ? 's' : ''}${high > 0 ? ` — ${high} HIGH` : ''}`);
      } else {
        mark('alerts', 'done', 'No alerts found');
      }

      // Step 3: Weekly insight
      mark('insight', 'running');
      const r3 = await post('weekly-insight');
      if (r3.error) { mark('insight', 'error', r3.error); return; }
      if (r3.insight) {
        setWeeklyInsight(r3.insight);
        try { localStorage.setItem('bos_weekly_insight', JSON.stringify(r3.insight)); } catch { /* ignore */ }
        const ts = new Date().toISOString();
        setReportTimestamps(prev => ({ ...prev, 'weekly-insight': ts, 'alerts': ts }));
        mark('insight', 'done', 'Insight ready');
      } else {
        mark('insight', 'done', 'Complete');
      }

      // Navigate to intelligence after a short pause
      setTimeout(() => {
        setActiveView('intelligence');
        setReportProgress(null);
        addToast('success', 'Full report complete — check Intelligence tab');
      }, 1400);
    } catch {
      addToast('error', 'Report failed. Verify ANTHROPIC_API_KEY is configured.');
      setReportProgress(null);
    }
  }, [data, prevSnapshot, addToast, companyName, companyProfile, setDashboard, setAlerts, setWeeklyInsight, setDismissedAlerts, setReportTimestamps, setActiveView]);

  // ── Create task from an alert (alert → Execute tab) ──────────────────────────
  const createTaskFromAlert = useCallback(async (title: string, context: string) => {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, context, priority: 'p1', created_by: 'ai' }),
      });
      addToast('success', `Task created: ${title.slice(0, 50)}`);
    } catch {
      addToast('error', 'Failed to create task');
    }
  }, [addToast]);

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
      } catch (err) {
        const isQuota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
        addToast('error', isQuota
          ? 'Storage full — delete an old period in the Data tab to free space, then try again.'
          : 'Failed to save period data. Please try again.');
      }
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

  // ── Share snapshot ──────────────────────────────────────────────────────────
  const handleShare = useCallback(() => {
    const url = generateShareURL(effectiveData, activeSnapshot.label, companyName);
    setShareUrl(url);
    setShareCopied(false);
    setShowShareModal(true);
  }, [effectiveData, companyName, activeSnapshot]);

  // Keyboard shortcuts: 1–9 switch views, / or Cmd+K opens chat
  useEffect(() => {
    const viewOrder: ActiveView[] = ['deals', 'today', 'execute', 'overview', 'acquisitions', 'goals', 'team', 'cash', 'financial', 'customers', 'intelligence'];
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      // Cmd+K / Ctrl+K opens command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen(v => !v); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setPaletteOpen(v => !v); return; }
      if (e.key === '?') { e.preventDefault(); setShortcutsOpen(v => !v); return; }
      if (e.key === 'Escape') { setShortcutsOpen(false); setPaletteOpen(false); setMoreNavOpen(false); setShowShareModal(false); return; }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleShare(); return; }
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < viewOrder.length) setActiveView(viewOrder[idx]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openChat]);

  // Close More dropdown on outside click
  useEffect(() => {
    if (!moreNavOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-more-nav]')) setMoreNavOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreNavOpen]);

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

  // Session loaded once per render (localStorage read, safe in browser)
  const currentSession = loadSession();

  // Primary: 6 items always visible in header nav
  // Secondary: everything else, exposed via "More ⌄" dropdown
  const navItems: { id: ActiveView; label: string; Icon: () => JSX.Element; badge?: number; activeClass: string; primary?: boolean }[] = [
    { id: 'today',         label: 'Today',         Icon: Icons.Today,         activeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/20',    primary: true },
    { id: 'overview',      label: 'Overview',      Icon: Icons.Overview,      activeClass: 'bg-slate-800/80 text-slate-100',  badge: triggeredCount || undefined, primary: true },
    { id: 'deals',         label: 'Deals',         Icon: Icons.Deals,         activeClass: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',       primary: true },
    { id: 'financial',     label: 'Financial',     Icon: Icons.Financial,     activeClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20', primary: true },
    { id: 'customers',     label: 'Customers',     Icon: Icons.Customers,     activeClass: 'bg-violet-500/15 text-violet-300 border border-violet-500/20', primary: true },
    { id: 'intelligence',  label: 'Intelligence',  Icon: Icons.Intelligence,  activeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20', badge: highAlerts.length || undefined, primary: true },
    // ── Secondary ("More" dropdown) ──
    { id: 'acquisitions',  label: 'Acquisitions',  Icon: Icons.Acquisitions,  activeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/20' },
    { id: 'cash',          label: 'Cash',          Icon: Icons.Cash,          activeClass: 'bg-teal-500/15 text-teal-300 border border-teal-500/20' },
    { id: 'goals',         label: 'Goals',         Icon: Icons.Goals,         activeClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' },
    { id: 'operations',    label: 'Operations',    Icon: Icons.Operations,    activeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' },
    { id: 'scenarios',     label: 'Scenarios',     Icon: Icons.Scenarios,     activeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/20' },
    { id: 'pipeline',      label: 'CRM',           Icon: Icons.Pipeline,      activeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/20' },
    { id: 'execute',       label: 'Execute',       Icon: Icons.Execute,       activeClass: 'bg-orange-500/15 text-orange-300 border border-orange-500/20' },
    { id: 'automations',   label: 'Automations',   Icon: Icons.Automations,   activeClass: 'bg-rose-500/15 text-rose-300 border border-rose-500/20' },
    { id: 'team',          label: 'Team',          Icon: Icons.Team,          activeClass: 'bg-violet-500/15 text-violet-300 border border-violet-500/20' },
    { id: 'suppliers',     label: 'Suppliers',     Icon: Icons.Suppliers,     activeClass: 'bg-lime-500/15 text-lime-300 border border-lime-500/20' },
    { id: 'skus',          label: 'SKUs',          Icon: Icons.SKUs,          activeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/20' },
    { id: 'capacity',      label: 'Capacity',      Icon: Icons.Capacity,      activeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' },
    { id: 'purchasing',    label: 'Purchasing',    Icon: Icons.Suppliers,     activeClass: 'bg-orange-500/15 text-orange-300 border border-orange-500/20' },
    { id: 'valuation',     label: 'Valuation',     Icon: Icons.Acquisitions,  activeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/20' },
    { id: 'data',          label: 'Data',          Icon: Icons.Data,          activeClass: 'bg-slate-800/80 text-slate-100' },
  ];

  const pageTitle: Record<ActiveView, string> = {
    deals:        'Deals',
    today:        'Today',
    overview:     'Overview',
    financial:    'Financial',
    customers:    'Customers',
    operations:   'Operations',
    intelligence: 'Intelligence',
    pipeline:     'CRM',
    automations:  'Automations',
    scenarios:    'Scenarios',
    data:         'Data',
    acquisitions: 'Acquisitions',
    goals:        'Goals',
    team:         'Team Feed',
    cash:         'Cash Runway',
    execute:      'Task Execution',
    suppliers:    'Supplier Spend',
    skus:         'SKU Analyzer',
    capacity:     'Capacity & Cost',
    purchasing:   'Capital Impact Summary',
    valuation:    'Valuation Estimator',
  };

  const pageAccent: Record<ActiveView, string> = {
    deals:        'text-blue-400',
    today:        'text-amber-400',
    overview:     'text-slate-400',
    financial:    'text-indigo-400',
    customers:    'text-violet-400',
    operations:   'text-cyan-400',
    intelligence: 'text-emerald-400',
    pipeline:     'text-sky-400',
    automations:  'text-rose-400',
    scenarios:    'text-amber-400',
    data:         'text-slate-400',
    acquisitions: 'text-sky-400',
    goals:        'text-emerald-400',
    team:         'text-violet-400',
    cash:         'text-teal-400',
    execute:      'text-orange-400',
    suppliers:    'text-lime-400',
    skus:         'text-fuchsia-400',
    capacity:     'text-cyan-400',
    purchasing:   'text-orange-400',
    valuation:    'text-purple-400',
  };

  return (
    <>
      <Head>
        <title>{companyName} · Business OS</title>
        <meta name="description" content="AI-powered executive intelligence for your business"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
        <link rel="manifest" href="/manifest.json"/>
        <meta name="theme-color" content="#060a12"/>
        <meta property="og:title" content="Business OS — AI-powered intelligence for LMM operators"/>
        <meta property="og:description" content="Live P&L dashboard, AI CFO advisor, deal pipeline, and scenario modeling for lower middle market operators."/>
        <meta property="og:image" content="/api/og"/>
        <meta property="og:type" content="website"/>
        <meta name="twitter:card" content="summary_large_image"/>
        <meta name="twitter:image" content="/api/og"/>
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
          <div className="h-[52px] flex items-center">

            {/* Brand — matches sidebar width (176px) so logo aligns with nav */}
            <div className="hidden md:flex items-center gap-2.5 w-[176px] flex-shrink-0 px-4 border-r border-slate-800/50 h-full">
              <div className="w-[26px] h-[26px] rounded-[6px] bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shadow-sm flex-shrink-0">
                <svg viewBox="0 0 12 12" fill="white" className="w-3.5 h-3.5"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
              </div>
              <div>
                <CompanyNameEditor value={companyName} onChange={saveCompanyName} />
                <div className="text-[10px] font-medium text-slate-600 tracking-wide uppercase -mt-0.5">Business OS</div>
              </div>
            </div>

            {/* Mobile brand */}
            <div className="md:hidden flex items-center gap-2 px-3 flex-shrink-0">
              <div className="w-[24px] h-[24px] rounded-[5px] bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 12 12" fill="white" className="w-3 h-3"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
              </div>
              <span className="text-[13px] font-semibold text-slate-100 truncate max-w-[110px]">{companyName}</span>
            </div>

            {/* Right section — fills remaining width */}
            <div className="flex-1 flex items-center justify-between px-4 md:px-6 gap-3">

            {/* Mobile: current view label */}
            <div className="md:hidden flex-1 text-[12px] font-medium text-slate-400 truncate">
              {pageTitle[activeView]}
            </div>

            {/* Desktop: page title + period */}
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <span className={`text-[13px] font-semibold ${pageAccent[activeView]}`}>{pageTitle[activeView]}</span>
              <span className="text-slate-700">·</span>
              <span className="text-[11px] text-slate-500 font-medium truncate">{activeSnapshot.label}</span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              {/* Command palette trigger */}
              <button
                onClick={() => setPaletteOpen(true)}
                title="Command palette (⌘K)"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/50 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/60 text-slate-500 hover:text-slate-300 transition-all text-[12px]"
              >
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M11 11l2 2"/></svg>
                <span className="hidden md:inline text-[11px]">Search</span>
                <kbd className="text-[10px] font-mono text-slate-600">⌘K</kbd>
              </button>
              {usingDemo && (
                <span className="hidden lg:flex items-center gap-1.5 text-[11px] font-medium bg-amber-500/8 text-amber-400/80 border border-amber-500/15 px-2.5 py-[5px] rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse"/>Demo
                </span>
              )}
              <PeriodSelector snapshots={snapshots} activeId={activeSnapshotId} onSelect={id => { setActiveSnapshotId(id); localStorage.setItem('bos_active_id', id); addToast('info', `Viewing: ${snapshots.find(s => s.id === id)?.label}`); }} onDelete={handleDeleteSnapshot} onRename={handleRenameSnapshot}/>
              {/* Billing button */}
              {currentSession.planId !== 'starter' && !!currentSession.stripeCustomerId ? (
                <button
                  onClick={async () => {
                    const r = await fetch('/api/billing/portal', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ customerId: currentSession.stripeCustomerId, returnUrl: window.location.href }),
                    });
                    const d = await r.json();
                    if (d.url) window.location.href = d.url;
                  }}
                  className="hidden lg:flex items-center gap-1 text-[11px] font-medium text-emerald-400/80 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 px-2.5 py-1.5 rounded-lg transition-colors"
                  title="Manage your subscription"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>
                  {currentSession.planId.charAt(0).toUpperCase() + currentSession.planId.slice(1)} plan
                </button>
              ) : (
                <button
                  onClick={() => setPricingOpen(true)}
                  className="hidden lg:flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-colors"
                  title="View pricing plans"
                >
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1l1.5 3.5L12 5l-2.5 2.5.5 3.5L7 9.5 4 11l.5-3.5L2 5l3.5-.5L7 1z"/></svg>
                  Upgrade
                </button>
              )}
              {/* Simple / Advanced mode toggle */}
              <button
                onClick={toggleSimpleMode}
                title={simpleMode ? 'Switch to Advanced mode' : 'Switch to Simple mode'}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-[7px] rounded-lg border text-[11px] font-semibold transition-all ${
                  simpleMode
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                    : 'bg-slate-800/30 border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                {simpleMode ? (
                  <>
                    <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M6 1a4 4 0 100 8A4 4 0 006 1zm0 1.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"/></svg>
                    Simple
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3 flex-shrink-0"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
                    Advanced
                  </>
                )}
              </button>

              {/* Share snapshot */}
              <button
                onClick={handleShare}
                title="Share a read-only snapshot"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-[7px] rounded-lg border border-slate-700/50 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 transition-all text-[12px] font-medium"
              >
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 flex-shrink-0"><circle cx="11" cy="3" r="1.5"/><circle cx="3" cy="7" r="1.5"/><circle cx="11" cy="11" r="1.5"/><path d="M4.5 7.7l5 2.6M9.5 3.7l-5 2.6"/></svg>
                <span className="hidden lg:inline">Share</span>
              </button>

              {/* Ask AI CFO — primary action in header */}
              <button
                onClick={() => openChat()}
                className="flex items-center gap-1.5 px-3 py-[7px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[12px] font-semibold transition-all shadow-sm">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                  <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                  <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                </svg>
                <span className="hidden sm:inline">Ask AI</span>
              </button>

              {/* User / sign-out */}
              <div className="relative group hidden sm:block">
                <button
                  title={authEmail || 'Account'}
                  className="w-7 h-7 rounded-full bg-indigo-700/60 border border-indigo-500/30 flex items-center justify-center text-[11px] font-bold text-indigo-200 hover:bg-indigo-600/60 transition-colors"
                >
                  {authEmail ? authEmail[0].toUpperCase() : '?'}
                </button>
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#0d1117] border border-slate-700/60 rounded-xl shadow-2xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {authEmail && (
                    <div className="px-3 py-2 border-b border-slate-800/60">
                      <div className="text-[11px] text-slate-500 truncate">{authEmail}</div>
                    </div>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-[12px] text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-colors flex items-center gap-2"
                  >
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3">
                      <path d="M5 2H2v10h3M9 4l3 3-3 3M6 7h6"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>

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
            </div>{/* /right section */}
          </div>

          {/* Mobile nav drawer — shows all sections (bottom tab bar handles primary 5) */}
          {mobileNavOpen && (
            <div className="md:hidden border-t border-slate-800/60 bg-[#060a12]/98 px-3 py-2.5 flex flex-col gap-0.5 animate-fade-in max-h-[70vh] overflow-y-auto">
              <div className="text-[10px] font-semibold text-slate-700 uppercase tracking-[0.1em] px-3 pt-1 pb-0.5">All Sections</div>
              {navItems.map(({ id, label, Icon, badge, activeClass }) => (
                <button key={id} onClick={() => { setActiveView(id); setMobileNavOpen(false); }}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl text-[13px] font-medium transition-all min-h-[44px] ${
                    activeView === id ? activeClass : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'}`}>
                  <Icon/>{label}
                  {badge ? <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ml-auto">{badge}</span> : null}
                </button>
              ))}
              {/* Sign out — mobile */}
              <div className="border-t border-slate-800/50 mt-1 pt-1">
                {authEmail && <div className="px-3 py-1.5 text-[11px] text-slate-600 truncate">{authEmail}</div>}
                <button
                  onClick={() => { setMobileNavOpen(false); handleSignOut(); }}
                  className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-[13px] font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all min-h-[44px] w-full"
                >
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4 flex-shrink-0"><path d="M5 2H2v10h3M9 4l3 3-3 3M6 7h6"/></svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </header>

        {/* ── Body: sidebar + content ── */}
        <div className="flex flex-1 min-h-0">

        {/* Left sidebar — desktop only, all 16 sections always visible */}
        <aside className="hidden md:flex flex-col w-[176px] flex-shrink-0 border-r border-slate-800/50 sticky top-[52px] h-[calc(100vh-52px)] overflow-y-auto bg-[#060a12] no-print z-40">
          <nav className="flex flex-col py-3 px-2">
            <div className="px-2 pb-1.5 text-[9px] font-semibold tracking-widest uppercase text-slate-600">Main</div>
            {navItems.filter(n => n.primary).map(({ id, label, Icon, badge, activeClass }) => {
              const SideIcon = Icon;
              const health = getSectionHealth(id);
              const dotCls = health === 'green' ? 'bg-emerald-400' : health === 'amber' ? 'bg-amber-400' : health === 'red' ? 'bg-red-400' : null;
              return (
                <button key={id} onClick={() => setActiveView(id)}
                  className={`flex items-center gap-2 w-full px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-all text-left mb-0.5 ${
                    activeView === id ? activeClass : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                  }`}>
                  <SideIcon/>
                  <span className="flex-1 truncate">{label}</span>
                  {dotCls && !badge && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotCls} opacity-60`}/>}
                  {badge ? <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{badge}</span> : null}
                </button>
              );
            })}
            <div className="px-2 pt-3 pb-1.5 text-[9px] font-semibold tracking-widest uppercase text-slate-600">Tools</div>
            {navItems.filter(n => !n.primary).map(({ id, label, Icon, badge, activeClass }) => {
              const SideIcon = Icon;
              return (
                <button key={id} onClick={() => setActiveView(id)}
                  className={`flex items-center gap-2 w-full px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-all text-left mb-0.5 ${
                    activeView === id ? activeClass : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                  }`}>
                  <SideIcon/>
                  <span className="flex-1 truncate">{label}</span>
                  {badge ? <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{badge}</span> : null}
                </button>
              );
            })}
          </nav>
          {/* Company switcher — pinned to bottom of sidebar */}
          <div className="mt-auto border-t border-slate-800/50 pt-2">
            <CompanySwitcher/>
          </div>
        </aside>

        {/* Content column */}
        <div className="flex-1 min-w-0 flex flex-col">

        {/* ── Breadcrumb / page bar ── */}
        <div className="border-b border-slate-800/40 bg-slate-900/15">
          <div className="px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
            {/* Data status pill */}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${data.metadata.completeness >= 0.9 ? 'bg-emerald-400' : 'bg-amber-400'}`}/>
              <span className={`text-[11px] font-medium flex-shrink-0 ${data.metadata.completeness >= 0.9 ? 'text-emerald-500/70' : 'text-amber-500/70'}`}>
                {Math.round(data.metadata.completeness * 100)}% coverage
              </span>
              {!usingDemo && activeSnapshot.createdAt && (
                <>
                  <span className="hidden sm:inline text-slate-700 flex-shrink-0">·</span>
                  <span className="hidden sm:inline text-[11px] text-slate-600 flex-shrink-0">
                    updated {new Date(activeSnapshot.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </>
              )}
              {usingDemo && <span className="text-[11px] text-amber-400/60 flex-shrink-0">Demo data</span>}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-1.5 no-print">
              {/* Compare — only if prior period exists */}
              {prevSnapshot && (
                <button
                  onClick={toggleCompareMode}
                  title="Toggle period comparison"
                  className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg transition-all border min-h-[30px] ${
                    compareMode
                      ? 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10'
                      : 'text-slate-500 hover:text-slate-300 border-slate-800/60 hover:border-slate-700'
                  }`}>
                  <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0"><path d="M1 7h5V2L1 7zm7-5v5h5L8 2z"/></svg>
                  <span className="hidden sm:inline">Compare</span>
                </button>
              )}
              {/* Share */}
              <button
                onClick={handleShare}
                title="Share a read-only snapshot"
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-2.5 py-1 rounded-lg transition-all font-medium min-h-[30px]">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 flex-shrink-0">
                  <circle cx="11" cy="3" r="1.5"/><circle cx="3" cy="7" r="1.5"/><circle cx="11" cy="11" r="1.5"/>
                  <path d="M4.5 7.7l5 2.6M9.5 3.7l-5 2.6"/>
                </svg>
                <span className="hidden sm:inline">Share</span>
              </button>
              {/* Export PDF */}
              <button
                onClick={() => window.print()}
                title="Export to PDF"
                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-2.5 py-1 rounded-lg transition-all font-medium min-h-[30px]">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                  <path d="M3 1h8v4H3V1zM1 6h12v6H1V6zm2 2h2v1H3V8zm0 2h4v1H3v-1zM11 8h-1v1h1V8z"/>
                </svg>
                <span className="hidden md:inline">Export PDF</span>
              </button>
              {/* Refresh KPIs inline when on overview */}
              {activeView === 'overview' && (
                <button onClick={() => runAction('compute-kpis')} disabled={!!loading}
                  className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-2.5 py-1 rounded-lg transition-all disabled:opacity-40 font-medium min-h-[30px]">
                  {isLoading('compute-kpis') ? <><Icons.Spinner/>Computing…</> : '↺ KPIs'}
                </button>
              )}
              {/* Export CSV — hidden on small screens */}
              <button
                onClick={() => exportKPIsAsCSV(data, activeSnapshot.label)}
                className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-2.5 py-1 rounded-lg transition-all font-medium min-h-[30px]"
                title="Export CSV">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                  <path d="M7 1v7M4 5l3 3 3-3M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
                </svg>
                CSV
              </button>
              {/* Shortcuts */}
              <button
                onClick={() => setShortcutsOpen(true)}
                title="Keyboard shortcuts (?)"
                className="hidden xl:flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700 px-2.5 py-1 rounded-lg transition-all font-medium min-h-[30px]">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0"><rect x="1" y="1" width="3" height="3" rx="0.5"/><rect x="5.5" y="1" width="3" height="3" rx="0.5"/><rect x="10" y="1" width="3" height="3" rx="0.5"/><rect x="1" y="5.5" width="3" height="3" rx="0.5"/><rect x="5.5" y="5.5" width="3" height="3" rx="0.5"/><rect x="10" y="5.5" width="3" height="3" rx="0.5"/><rect x="3" y="10" width="8" height="3" rx="0.5"/></svg>
                Shortcuts
              </button>
            </div>
          </div>
        </div>

        {/* ── Print-only header ── */}
        <div className="print-header hidden">
          {companyName} · Business OS Report · {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        {/* ── Demo data banner (non-overview tabs) ── */}
        {usingDemo && activeView !== 'overview' && activeView !== 'data' && activeView !== 'pipeline' && activeView !== 'automations' && activeView !== 'acquisitions' && activeView !== 'goals' && activeView !== 'team' && activeView !== 'cash' && activeView !== 'execute' && (
          <div className="no-print border-b border-amber-500/10 bg-amber-500/[0.03]">
            <div className="px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
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
        <main className="px-4 sm:px-6 py-5 sm:py-6 flex-1 w-full pb-20 md:pb-6">

          {/* Period comparison strip */}
          {compareMode && prevSnapshot && (
            <ComparisonStrip
              current={data}
              previous={prevSnapshot.data}
              currentLabel={activeSnapshot.label}
              previousLabel={prevSnapshot.label}
            />
          )}

          {/* Data freshness warning — show if key data is stale (>30 days) */}
          {(() => {
            if (usingDemo) return null;
            try {
              const raw = localStorage.getItem('bos_import_meta');
              if (!raw) return null;
              const meta = JSON.parse(raw) as Record<string, { importedAt?: string; rows?: number }>;
              const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
              const stale = Object.entries(meta)
                .filter(([, v]) => v.importedAt && new Date(v.importedAt).getTime() < cutoff)
                .map(([type]) => type.replace(/_/g, ' '));
              if (stale.length === 0) return null;
              return (
                <div className="mb-5 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-amber-400 flex-shrink-0">⏱</span>
                    <div className="min-w-0">
                      <span className="text-[12px] font-medium text-amber-300">Stale data: </span>
                      <span className="text-[12px] text-amber-400/70">{stale.join(', ')} — last imported over 30 days ago</span>
                    </div>
                  </div>
                  <button onClick={() => setActiveView('data')}
                    className="flex-shrink-0 text-[11px] text-amber-400/80 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                    Re-import →
                  </button>
                </div>
              );
            } catch { return null; }
          })()}

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

          {/* Threshold violations banner */}
          {triggeredCount > 0 && activeView !== 'intelligence' && (
            <div className="mb-5 bg-orange-500/5 border border-orange-500/15 rounded-xl px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-orange-400 flex-shrink-0 font-bold text-sm">◉</span>
                <div>
                  <span className="text-[12px] font-semibold text-orange-300">{triggeredCount} metric threshold{triggeredCount > 1 ? 's' : ''} breached</span>
                  <span className="text-[12px] text-orange-400/60 ml-2">— configured limits exceeded</span>
                </div>
              </div>
              <button onClick={() => setActiveView('intelligence')}
                className="flex-shrink-0 text-[11px] text-orange-400/80 hover:text-orange-300 border border-orange-500/20 hover:border-orange-500/40 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                View →
              </button>
            </div>
          )}

          {/* ── Simple Mode ── */}
          {simpleMode && (
            <SimpleModePanel
              data={effectiveData}
              dashboard={dashboard}
              onAskAI={(msg) => openChat(msg)}
              onNavigate={v => setActiveView(v as ActiveView)}
              onExitSimple={toggleSimpleMode}
            />
          )}

          {/* ── Overview ── */}
          {!simpleMode && (
            <div className={activeView === 'overview' ? 'space-y-5' : 'hidden'}>

              {/* Connected model chain — always at the top of the overview */}
              <ConnectedModel chain={modelChain} onNavigate={v => setActiveView(v as ActiveView)}/>

              {/* Data status bar — replaces the old demo nudge */}
              {usingDemo ? (
                <div className="border border-indigo-500/15 bg-indigo-500/[0.04] rounded-xl px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"/>
                    <div className="text-[12px] text-slate-300">
                      Demo data · Model above uses sample numbers.{' '}
                      <span className="text-indigo-400">Upload your financials to see your real model.</span>
                    </div>
                  </div>
                  <button onClick={() => setActiveView('data')}
                    className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap">
                    Connect data →
                  </button>
                </div>
              ) : (
                <div className="border border-emerald-500/15 bg-emerald-500/[0.03] rounded-xl px-4 py-2.5 flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>
                  <div className="text-[11px] text-slate-400 flex-1">
                    Live data · as of {data.metadata.asOf ? new Date(data.metadata.asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'recent'}
                    {' · '}{data.metadata.sources.join(', ')}
                  </div>
                  {scenarioAdj && (
                    <button onClick={() => setScenarioAdj(null)} className="text-[10px] text-violet-400 hover:text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded transition-colors">
                      Clear scenario: {scenarioAdj.name}
                    </button>
                  )}
                </div>
              )}

              {/* ── Section: Priorities ─────────────────────────────── */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] flex-shrink-0">Priorities</span>
                <div className="flex-1 h-px bg-slate-800/50"/>
              </div>
              <DailyBriefing data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO} companyName={companyName} onAskAI={openChat} onNavigate={(v) => setActiveView(v as ActiveView)}/>
              <DecisionEngine data={effectiveData} companyName={companyName} onAskAI={openChat} onNavigate={(v) => setActiveView(v as ActiveView)}/>
              <CEOWatchlist data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO}/>

              {/* Data quality warnings */}
              {effectiveData.metadata.warnings.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
                  <span className="text-amber-400/70 text-sm flex-shrink-0 mt-0.5">⚠</span>
                  <div>
                    <div className="text-[11px] font-semibold text-amber-400/80 mb-1">Data quality notes</div>
                    <ul className="space-y-0.5">
                      {effectiveData.metadata.warnings.map((w, i) => (
                        <li key={i} className="text-[11px] text-amber-400/60">· {w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* ── Section: Key Metrics ─────────────────────────────── */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] flex-shrink-0">Key Metrics</span>
                <div className="flex-1 h-px bg-slate-800/50"/>
                <button onClick={() => runAction('compute-kpis')} disabled={!!loading}
                  className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors disabled:opacity-40 flex-shrink-0">
                  {isLoading('compute-kpis') ? 'Computing…' : '↺ Refresh'}
                </button>
              </div>
              <KPIGrid dashboard={dashboard} data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO} goals={goals} onNavigate={v => setActiveView(v as ActiveView)}/>

              {/* ── Revenue Quality Score ── */}
              {(() => {
                const rev = data.revenue.total;
                if (rev <= 0) return null;
                const retention = data.customers.retentionRate ?? 0.88;
                const topCust = data.customers.topCustomers[0]?.percentOfTotal ?? 0;
                const recurringPct = data.customers.topCustomers.length > 0
                  ? (data.customers.topCustomers.filter(c => c.revenueType === 'recurring').reduce((s,c) => s+c.revenue,0) / rev) * 100
                  : 50;
                const gm = rev > 0 ? ((rev - data.costs.totalCOGS) / rev) * 100 : 0;
                const periods = (data.revenue.byPeriod ?? []).length;

                // Score each dimension 0–100
                const dims = [
                  { label: 'Recurring Revenue', score: Math.min(100, recurringPct * 1.4), target: 70, fmt: `${recurringPct.toFixed(0)}%`, hint: '% of revenue that is contractual/subscription' },
                  { label: 'Customer Retention', score: Math.min(100, (retention - 0.7) / 0.3 * 100), target: 92, fmt: `${(retention*100).toFixed(1)}%`, hint: 'Period-over-period customer retention rate' },
                  { label: 'Concentration Risk', score: Math.max(0, 100 - topCust * 2.5), target: 80, fmt: `${topCust.toFixed(0)}% top`, hint: 'Inverse of top customer % — lower concentration = better' },
                  { label: 'Gross Margin Quality', score: Math.min(100, Math.max(0, (gm - 20) / 40 * 100)), target: 75, fmt: `${gm.toFixed(1)}%`, hint: 'Higher margin = more pricing power' },
                  { label: 'Revenue Predictability', score: Math.min(100, periods * 8), target: 80, fmt: `${periods} periods`, hint: 'Number of historical periods — more data = more predictable' },
                  { label: 'Customer Diversification', score: Math.min(100, data.customers.totalCount * 5), target: 80, fmt: `${data.customers.totalCount} customers`, hint: 'Broader base = lower concentration risk' },
                ];
                const overall = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
                const grade = overall >= 80 ? 'A' : overall >= 65 ? 'B' : overall >= 50 ? 'C' : overall >= 35 ? 'D' : 'F';
                const gradeColor = overall >= 80 ? 'text-emerald-400' : overall >= 65 ? 'text-sky-400' : overall >= 50 ? 'text-amber-400' : 'text-red-400';
                const narrative = overall >= 80 ? 'Premium quality of earnings — supports a top-tier valuation multiple.' :
                  overall >= 65 ? 'Good revenue quality with identifiable improvement areas. Addressable gaps could add 0.5–1× to exit multiple.' :
                  overall >= 50 ? 'Moderate quality. Buyers will apply risk discounts. Focus on recurring revenue and retention.' :
                  'Below-average quality — expect buyer scrutiny and multiple compression. Prioritize retention and contract conversion.';
                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Revenue Quality Score</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">PE / QoE framework · directly impacts valuation multiple</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[28px] font-bold ${gradeColor}`}>{grade}</div>
                        <div className={`text-[10px] ${gradeColor}`}>{overall}/100</div>
                      </div>
                    </div>
                    <div className="px-5 py-4 space-y-2.5">
                      {dims.map(d => (
                        <div key={d.label} className="flex items-center gap-3">
                          <div className="w-36 text-[11px] text-slate-400 flex-shrink-0" title={d.hint}>{d.label}</div>
                          <div className="flex-1 h-2 bg-slate-800/60 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${d.score >= 80 ? 'bg-emerald-500/60' : d.score >= 60 ? 'bg-sky-500/50' : d.score >= 40 ? 'bg-amber-500/50' : 'bg-red-500/50'}`} style={{ width: `${d.score}%` }}/>
                          </div>
                          <div className="w-20 text-right text-[11px] text-slate-400 flex-shrink-0">{d.fmt}</div>
                          <div className={`w-6 text-right text-[11px] font-bold flex-shrink-0 ${d.score >= d.target ? 'text-emerald-400' : 'text-amber-400'}`}>{Math.round(d.score)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 border-t border-slate-800/40 text-[11px] text-slate-400 leading-relaxed">{narrative}</div>
                  </div>
                );
              })()}

              {/* ── LMM Scorecard ──────────────────────────────────────── */}
              {(() => {
                const d = effectiveData;
                const rev    = d.revenue.total;
                const cogs   = d.costs.totalCOGS;
                const opex   = d.costs.totalOpEx;
                const gp     = rev - cogs;
                const ebitda = gp - opex;
                const gmPct  = rev > 0 ? (gp / rev) * 100 : 0;
                const ebitdaMarginPct = rev > 0 ? (ebitda / rev) * 100 : 0;
                const retentionRate = d.customers.retentionRate ?? null;
                const churn = retentionRate !== null ? (1 - retentionRate) * 100 : null;
                const utilization = d.operations.employeeUtilization ?? d.operations.utilizationRate ?? d.operations.capacityUtilization ?? null;
                const pipelineDeals = d.pipeline ?? [];
                const weightedPipeline = pipelineDeals.filter(p => p.stage !== 'Closed Won' && p.stage !== 'Closed Lost').reduce((s, p) => s + p.value * (p.probability / 100), 0);
                const revenueMultipleSba = rev > 0 ? (ebitda * 5.5) / rev : 0; // EV/Rev at 5.5× EBITDA

                type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
                const grade = (score: number): Grade => score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
                const gradeColor = (g: Grade) => g === 'A' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : g === 'B' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : g === 'C' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20';

                const metrics: { label: string; value: string; score: number; benchmark: string }[] = [
                  {
                    label: 'Gross Margin',
                    value: rev > 0 ? `${gmPct.toFixed(1)}%` : '—',
                    score: gmPct >= 60 ? 95 : gmPct >= 45 ? 80 : gmPct >= 30 ? 65 : gmPct >= 15 ? 45 : 20,
                    benchmark: '≥ 45% · LMM services benchmark',
                  },
                  {
                    label: 'EBITDA Margin',
                    value: rev > 0 ? `${ebitdaMarginPct.toFixed(1)}%` : '—',
                    score: ebitdaMarginPct >= 20 ? 95 : ebitdaMarginPct >= 15 ? 85 : ebitdaMarginPct >= 10 ? 70 : ebitdaMarginPct >= 5 ? 50 : ebitdaMarginPct >= 0 ? 30 : 10,
                    benchmark: '≥ 15% · SBA-financeable threshold',
                  },
                  {
                    label: 'Customer Retention',
                    value: churn !== null ? `${(100 - churn).toFixed(1)}%` : '—',
                    score: churn === null ? 50 : churn <= 2 ? 95 : churn <= 5 ? 80 : churn <= 10 ? 60 : churn <= 20 ? 40 : 15,
                    benchmark: '≥ 90% · Indicates recurring revenue quality',
                  },
                  {
                    label: 'Pipeline Coverage',
                    value: rev > 0 && weightedPipeline > 0 ? `${(weightedPipeline / (rev / 12)).toFixed(1)}×` : '—',
                    score: rev > 0 && weightedPipeline > 0 ? Math.min(95, ((weightedPipeline / (rev / 12)) / 3) * 90) : 30,
                    benchmark: '≥ 3× monthly rev · Weighted pipeline',
                  },
                  {
                    label: 'Capacity Utilization',
                    value: utilization !== null ? `${(utilization * 100).toFixed(0)}%` : '—',
                    score: utilization === null ? 50 : utilization >= 0.75 && utilization <= 0.92 ? 90 : utilization >= 0.60 ? 70 : utilization >= 0.45 ? 55 : 30,
                    benchmark: '75–90% · Sweet spot before burnout',
                  },
                  {
                    label: 'Revenue Scale',
                    value: rev >= 1_000_000 ? `$${(rev / 1_000_000).toFixed(1)}M` : `$${Math.round(rev).toLocaleString()}`,
                    score: rev >= 10_000_000 ? 95 : rev >= 5_000_000 ? 80 : rev >= 2_000_000 ? 65 : rev >= 1_000_000 ? 50 : 25,
                    benchmark: '≥ $2M · LMM entry threshold',
                  },
                ];

                const overallScore = Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length);
                const overallGrade = grade(overallScore);

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">LMM Scorecard</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Lower middle market benchmark grading</div>
                      </div>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-bold ${gradeColor(overallGrade)}`}>
                        {overallGrade}
                        <span className="text-[10px] font-normal opacity-70">{overallScore}/100</span>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-800/40">
                      {metrics.map(m => {
                        const g = grade(m.score);
                        const barWidth = `${m.score}%`;
                        return (
                          <div key={m.label} className="px-5 py-3 flex items-center gap-4">
                            <div className="w-32 flex-shrink-0">
                              <div className="text-[11px] font-medium text-slate-300">{m.label}</div>
                              <div className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{m.benchmark}</div>
                            </div>
                            <div className="flex-1">
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{
                                  width: barWidth,
                                  background: g === 'A' ? '#10b981' : g === 'B' ? '#3b82f6' : g === 'C' ? '#f59e0b' : '#ef4444',
                                }}/>
                              </div>
                            </div>
                            <div className="w-16 text-right text-[12px] font-semibold text-slate-200">{m.value}</div>
                            <div className={`w-7 h-7 flex items-center justify-center rounded-md border text-[11px] font-bold flex-shrink-0 ${gradeColor(g)}`}>{g}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-5 py-3 border-t border-slate-800/40 flex items-center justify-between flex-wrap gap-2">
                      <div className="text-[10px] text-slate-600">Benchmarks based on SBA 7(a) standards and LMM M&A deal data</div>
                      <button onClick={() => setActiveView('valuation')}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors">
                        Full valuation analysis →
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Section: Revenue ─────────────────────────────────── */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] flex-shrink-0">Revenue</span>
                <div className="flex-1 h-px bg-slate-800/50"/>
              </div>
              <RevenueChart data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO} revenueGoal={goals.revenue} annotations={annotations} onAnnotate={setAnnotation} onAskAI={openChat}/>
              <RevenueForecastStrip data={effectiveData} onAskAI={openChat}/>
              <PipelineRevenueForecast/>
              <PipelineSnapshot data={effectiveData} onAskAI={openChat}/>

              {/* ── Section: Breakdown ───────────────────────────────── */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] flex-shrink-0">Breakdown</span>
                <div className="flex-1 h-px bg-slate-800/50"/>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                <CostBreakdownChart data={data}/>
                <CustomerMetricsChart data={data}/>
                <AlertFeed
                  alerts={visibleAlerts}
                  onRunAlerts={() => runAction('alerts')}
                  loading={isLoading('alerts')}
                  onDismiss={dismissAlert}
                  onCreateTask={createTaskFromAlert}
                  onAskAI={openChat}
                  onNavigate={v => setActiveView(v as ActiveView)}
                />
              </div>

              {/* ── Deep analysis (expandable) ─────────────────────────── */}
              <button
                onClick={() => setShowDeepAnalysis(v => !v)}
                className="w-full flex items-center gap-3 py-2 group"
              >
                <div className="flex-1 h-px bg-slate-800/50 group-hover:bg-slate-700/50 transition-colors"/>
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 group-hover:text-slate-400 transition-colors whitespace-nowrap">
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                    className={`w-2.5 h-2.5 transition-transform ${showDeepAnalysis ? 'rotate-180' : ''}`}>
                    <path d="M2 3.5l3 3 3-3"/>
                  </svg>
                  {showDeepAnalysis ? 'Hide' : 'Show'} detailed analysis
                </span>
                <div className="flex-1 h-px bg-slate-800/50 group-hover:bg-slate-700/50 transition-colors"/>
              </button>

              {showDeepAnalysis && (
                <div className="space-y-4">
                  <NarrativeBar data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO}/>
                  <MonthlyTrendStrip data={data}/>
                  <BusinessHealthScore data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
                  <HealthScoreHistory snapshots={snapshots} activeId={activeSnapshotId}/>
                  <ExecutiveSummary data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO}/>
                  {prevSnapshot && <BiggestMovers data={effectiveData} previous={prevSnapshot.data}/>}
                  <RevenueQuality data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO}/>
                  <TrendSignalsPanel data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
                  <GoalsPanel data={effectiveData} goals={goals} onSetGoal={setGoal}/>
                  <TopActionsWidget onRunAgent={() => setActiveView('intelligence')} onViewAll={() => setActiveView('intelligence')}/>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ExitReadinessWidget onViewAll={() => setActiveView('intelligence')}/>
                    <GrowthPlaybookWidget onViewAll={() => setActiveView('intelligence')}/>
                  </div>
                  <CustomKPIPanel kpis={customKPIs} onChange={saveCustomKPIs} onAskAI={openChat}/>
                </div>
              )}

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

          {!simpleMode && (<>
          <div className={activeView === 'financial' ? 'space-y-4' : 'hidden'}>
              {usingDemo && (
                <div className="flex items-center justify-between gap-4 bg-indigo-500/8 border border-indigo-500/20 rounded-xl px-4 py-3">
                  <div className="text-[11px] text-indigo-300/80">
                    <span className="font-semibold">Demo data</span> — these are sample numbers. Enter your real data to see your actual financials.
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setShowManualEntry(true)} className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-100 border border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1.5 rounded-lg transition-colors">Enter manually</button>
                    <button onClick={() => setActiveView('data')} className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-100 border border-indigo-500/30 hover:border-indigo-500/60 px-3 py-1.5 rounded-lg transition-colors">Upload CSV</button>
                  </div>
                </div>
              )}
              <ErrorBoundary label="Financial tab">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-indigo-500/10"/>
                <SectionNote noteKey="financial" notes={panelNotes} onSave={setPanelNote}/>
                <div className="h-px flex-1 bg-indigo-500/10"/>
              </div>
              {/* ── AI P&L Narrative Generator ── */}
              {(() => {
                const [narrative, setNarrative] = React.useState('');
                const [narLoading, setNarLoading] = React.useState(false);
                const rev = data.revenue.total; const cogs = data.costs.totalCOGS; const opex = data.costs.totalOpEx;
                const gp = rev - cogs; const ebitda = gp - opex;
                const fmtN = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`;
                const periods = data.revenue.byPeriod ?? [];
                const prev = periods.length >= 2 ? periods[periods.length - 2] : null;
                const cur  = periods.length >= 1 ? periods[periods.length - 1] : null;
                const revChg = cur && prev && prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue * 100) : null;
                const generate = async () => {
                  setNarLoading(true);
                  try {
                    const prompt = `Write a concise, board-ready P&L narrative (3–4 sentences) for this period. Revenue: ${fmtN(rev)}${revChg !== null ? ` (${revChg >= 0 ? '+' : ''}${revChg.toFixed(1)}% vs prior period)` : ''}. Gross profit: ${fmtN(gp)} (${rev > 0 ? ((gp/rev)*100).toFixed(1) : 0}% margin). EBITDA: ${fmtN(ebitda)} (${rev > 0 ? ((ebitda/rev)*100).toFixed(1) : 0}% margin). OpEx: ${fmtN(opex)}. Top cost categories: ${data.costs.byCategory.slice(0,3).map(c => `${c.category} ${fmtN(c.amount)}`).join(', ')}. Write as if briefing the board: lead with the headline, explain the key drivers, and end with one forward-looking action item. No bullet points — flowing prose only.`;
                    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, data: effectiveData, history: [], companyName, planId: 'pro' }) });
                    const json = await res.json() as { reply?: string; error?: string };
                    setNarrative(json.reply ?? json.error ?? 'Failed to generate');
                  } catch { setNarrative('Error connecting to AI'); } finally { setNarLoading(false); }
                };
                return (
                  <div className="bg-gradient-to-br from-indigo-950/30 to-slate-900/50 border border-indigo-800/30 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">AI P&L Narrative</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Board-ready commentary generated from your live financials</div>
                      </div>
                      <button onClick={generate} disabled={narLoading}
                        className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-colors flex-shrink-0">
                        {narLoading ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Generating…</> : '✦ Generate Narrative'}
                      </button>
                    </div>
                    {narrative ? (
                      <div className="bg-slate-900/60 rounded-lg p-4">
                        <p className="text-[13px] text-slate-200 leading-relaxed">{narrative}</p>
                        <button onClick={() => { try { navigator.clipboard.writeText(narrative); } catch { /* ignore */ } }}
                          className="mt-3 text-[10px] text-slate-600 hover:text-slate-400 transition-colors">Copy to clipboard →</button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-600 italic">Click generate to create a board-ready P&L summary from your current numbers.</div>
                    )}
                  </div>
                );
              })()}

              <FinancialDashboard data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO} dashboard={dashboard} budget={budget} onSetBudget={setBudgetLine} annotations={annotations} onAnnotate={setAnnotation} onAskAI={openChat}/>
              <PLStatement data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} showChange showPct/>

              <BudgetPanel data={data} budget={budget} onSetBudget={setBudgetLine} onAskAI={openChat}/>

              {/* ── AR Follow-up Task Generator ── */}
              {(() => {
                const aging = data.arAging ?? [];
                const overdue = aging.filter(b => b.days60 + b.days90 + b.over90 > 0);
                const [generated, setGenerated] = React.useState(false);
                const [taskCount, setTaskCount] = React.useState(0);

                if (overdue.length === 0) return null;

                const totalOverdue = overdue.reduce((s, b) => s + b.days60 + b.days90 + b.over90, 0);
                const fmtD = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;

                const generateTasks = () => {
                  const tasks = overdue.map(b => {
                    const worst = b.over90 > 0 ? '90+d overdue' : b.days90 > 0 ? '61–90d overdue' : '31–60d overdue';
                    const amt = b.days60 + b.days90 + b.over90;
                    return {
                      id: `ar-${b.customer.replace(/\s+/g,'-').toLowerCase()}-${Date.now()}`,
                      title: `Follow up: ${b.customer} — ${fmtD(amt)} ${worst}`,
                      due: new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10),
                      priority: b.over90 > 0 ? 'high' : b.days90 > 0 ? 'high' : 'medium',
                      category: 'AR Collections',
                      done: false,
                    };
                  });
                  try {
                    const existing = JSON.parse(localStorage.getItem('bos_ar_tasks') ?? '[]');
                    localStorage.setItem('bos_ar_tasks', JSON.stringify([...existing, ...tasks]));
                  } catch { /* ignore */ }
                  setTaskCount(tasks.length);
                  setGenerated(true);
                  setTimeout(() => setGenerated(false), 4000);
                };

                return (
                  <div className="bg-slate-900/50 border border-amber-800/30 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="text-[12px] font-semibold text-amber-300 mb-0.5">AR Collections — {overdue.length} accounts overdue</div>
                        <div className="text-[11px] text-slate-500">{fmtD(totalOverdue)} past 30 days · Create follow-up tasks to your Execute board</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {overdue.map(b => {
                            const worst = b.over90 > 0 ? { label: '90+d', cls: 'bg-red-900/40 text-red-300 border-red-800/40' } :
                              b.days90 > 0 ? { label: '61–90d', cls: 'bg-orange-900/40 text-orange-300 border-orange-800/40' } :
                              { label: '31–60d', cls: 'bg-amber-900/40 text-amber-300 border-amber-800/40' };
                            return (
                              <span key={b.customer} className={`text-[10px] px-2 py-0.5 rounded-full border ${worst.cls}`}>
                                {b.customer} · {worst.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="flex flex-col gap-2">
                        {generated ? (
                          <div className="flex items-center gap-2 text-emerald-400 text-[12px] font-medium">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                            {taskCount} tasks created
                          </div>
                        ) : (
                          <button onClick={generateTasks}
                            className="px-4 py-2 text-[12px] font-semibold bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 text-amber-300 rounded-xl transition-colors">
                            Generate Follow-up Tasks
                          </button>
                        )}
                        {(() => {
                          const [emailTarget, setEmailTarget] = React.useState(overdue[0]?.customer ?? '');
                          const [emailText, setEmailText] = React.useState('');
                          const [emailLoading, setEmailLoading] = React.useState(false);
                          const selectedBucket = overdue.find(b => b.customer === emailTarget) ?? overdue[0];
                          const draftEmail = async () => {
                            if (!selectedBucket) return;
                            setEmailLoading(true);
                            const amt = selectedBucket.days60 + selectedBucket.days90 + selectedBucket.over90;
                            const age = selectedBucket.over90 > 0 ? '90+ days' : selectedBucket.days90 > 0 ? '61–90 days' : '31–60 days';
                            const tone = selectedBucket.over90 > 0 ? 'firm and urgent' : selectedBucket.days90 > 0 ? 'assertive but professional' : 'friendly and informative';
                            const prompt = `Write a ${tone} AR collections email to ${selectedBucket.customer} for $${Math.round(amt).toLocaleString()} that is ${age} past due. Keep it under 120 words. Include: subject line, greeting, the amount owed and age, a clear call to action with a payment deadline, and a professional sign-off. Format as: SUBJECT: [subject]\n\n[body]`;
                            try {
                              const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, data: effectiveData, history: [], companyName, planId: 'pro' }) });
                              const json = await res.json() as { reply?: string };
                              setEmailText(json.reply ?? 'Failed to generate');
                            } catch { setEmailText('Error'); } finally { setEmailLoading(false); }
                          };
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <select value={emailTarget} onChange={e => { setEmailTarget(e.target.value); setEmailText(''); }}
                                  className="flex-1 bg-slate-800/60 border border-amber-700/40 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none">
                                  {overdue.map(b => <option key={b.customer} value={b.customer}>{b.customer}</option>)}
                                </select>
                                <button onClick={draftEmail} disabled={emailLoading}
                                  className="px-3 py-1.5 text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/40 text-indigo-300 rounded-lg transition-colors flex-shrink-0">
                                  {emailLoading ? '…' : '✦ Draft Email'}
                                </button>
                              </div>
                              {emailText && (
                                <div className="bg-slate-900/80 border border-slate-700/40 rounded-lg p-3">
                                  <pre className="text-[10px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{emailText}</pre>
                                  <button onClick={() => { try { navigator.clipboard.writeText(emailText); } catch { /* ignore */ } }}
                                    className="mt-2 text-[9px] text-slate-600 hover:text-slate-400">Copy →</button>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── AP Aging & Cash Conversion Cycle ── */}
              {(() => {
                const rev   = data.revenue.total;
                const cogs  = data.costs.totalCOGS;
                const periods = data.revenue.byPeriod ?? [];

                // DSO from AR aging
                const totalAR  = data.arAging ? data.arAging.reduce((s,b) => s+b.total, 0) : null;
                const dso = totalAR !== null && rev > 0 ? (totalAR / (rev / 30)) : null;

                // AP aging — load from localStorage (operator-entered) or estimate from COGS
                const AP_KEY = 'bos_ap_aging';
                type APBucket = { vendor: string; current: number; days30: number; days60: number; days90: number; over90: number };
                let apBuckets: APBucket[] = [];
                try { const s = localStorage.getItem(AP_KEY); if (s) apBuckets = JSON.parse(s); } catch { /* ignore */ }

                const totalAP   = apBuckets.reduce((s,b) => s + b.current + b.days30 + b.days60 + b.days90 + b.over90, 0);
                const dpo = totalAP > 0 && cogs > 0 ? (totalAP / (cogs / 30)) : (cogs > 0 ? 30 : null); // estimate 30-day DPO if no AP data
                const hasRealAP = apBuckets.length > 0;

                // DIO — estimate from COGS if no inventory data
                const dio = 0; // most service businesses have no inventory

                // CCC = DSO + DIO - DPO
                const ccc = dso !== null && dpo !== null ? dso + dio - dpo : null;

                const fmtV = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString()}`; return n < 0 ? `(${s})` : s; };

                // MRR Movement from byPeriod recurring
                const hasMRR = periods.length >= 2 && periods.some(p => (p as {recurring?: number}).recurring != null);
                const mrrPeriods = periods.slice(-6).map((p, i, arr) => {
                  const rec = (p as {recurring?: number}).recurring ?? 0;
                  const prevRec = i > 0 ? ((arr[i-1] as {recurring?: number}).recurring ?? 0) : rec;
                  const newMRR  = Math.max(0, rec - prevRec);
                  const churnMRR = Math.max(0, prevRec - rec);
                  const netMRR  = rec - prevRec;
                  return { period: p.period.replace(/^20\d\d-/,''), mrr: rec, newMRR, churnMRR: -churnMRR, netMRR };
                });

                return (
                  <div className="space-y-4">
                    {/* Cash Conversion Cycle */}
                    {(dso !== null || dpo !== null) && (
                      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-[12px] font-semibold text-slate-100">Cash Conversion Cycle</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">DSO + DIO − DPO · how long cash is tied up in operations</div>
                          </div>
                          {ccc !== null && (
                            <div className={`text-right`}>
                              <div className={`text-[22px] font-bold tabular-nums ${ccc <= 30 ? 'text-emerald-400' : ccc <= 60 ? 'text-amber-400' : 'text-red-400'}`}>{ccc.toFixed(0)}d</div>
                              <div className="text-[10px] text-slate-600">{ccc <= 30 ? 'Healthy' : ccc <= 60 ? 'Watch' : 'Slow — cash at risk'}</div>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'DSO', sublabel: 'Days Sales Outstanding', value: dso, color: dso !== null && dso <= 30 ? 'text-emerald-400' : 'text-amber-400', hint: 'How long to collect from customers' },
                            { label: 'DIO', sublabel: 'Days Inventory Outstanding', value: dio, color: 'text-slate-400', hint: 'Days inventory sits before sold (0 = services)' },
                            { label: 'DPO', sublabel: 'Days Payable Outstanding', value: dpo, color: dpo !== null && dpo >= 30 ? 'text-emerald-400' : 'text-amber-400', hint: 'How long before you pay vendors' },
                          ].map(m => (
                            <div key={m.label} className="bg-slate-800/30 rounded-lg p-3 text-center">
                              <div className={`text-[22px] font-bold tabular-nums ${m.color}`}>{m.value !== null ? `${m.value.toFixed(0)}d` : '—'}</div>
                              <div className="text-[11px] font-semibold text-slate-300 mt-1">{m.label}</div>
                              <div className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">{m.sublabel}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 text-[10px] text-slate-600">
                          {!hasRealAP && 'DPO estimated at 30 days — add AP aging data below for accurate CCC · '}
                          Lower CCC = faster cash cycle. Target: DSO &lt; 30d, DPO ≥ 30d for positive working capital
                        </div>
                      </div>
                    )}

                    {/* AP Aging */}
                    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="text-[12px] font-semibold text-slate-100">Accounts Payable Aging</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">What you owe vendors · DPO and payment risk</div>
                        </div>
                        {hasRealAP && (
                          <div className="text-right">
                            <div className="text-[16px] font-bold text-slate-200">{fmtV(totalAP)}</div>
                            <div className="text-[10px] text-slate-600">total payables</div>
                          </div>
                        )}
                      </div>
                      {hasRealAP ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[480px]">
                            <thead>
                              <tr className="border-b border-slate-800/40">
                                {['Vendor','Current','1–30d','31–60d','61–90d','90+d','Total'].map(h => (
                                  <th key={h} className="px-4 py-2.5 text-right first:text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {apBuckets.map((b, i) => {
                                const total = b.current + b.days30 + b.days60 + b.days90 + b.over90;
                                const late  = b.days60 + b.days90 + b.over90;
                                return (
                                  <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20">
                                    <td className="px-4 py-2.5 text-[12px] font-medium text-slate-300">{b.vendor}</td>
                                    <td className="px-4 py-2.5 text-right text-[12px] text-emerald-400/80">{fmtV(b.current)}</td>
                                    <td className="px-4 py-2.5 text-right text-[12px] text-amber-400/80">{fmtV(b.days30)}</td>
                                    <td className="px-4 py-2.5 text-right text-[12px] text-orange-400/80">{fmtV(b.days60)}</td>
                                    <td className="px-4 py-2.5 text-right text-[12px] text-red-400/80">{fmtV(b.days90)}</td>
                                    <td className="px-4 py-2.5 text-right text-[12px] text-red-500/80">{fmtV(b.over90)}</td>
                                    <td className={`px-4 py-2.5 text-right text-[12px] font-semibold ${late > 0 ? 'text-red-300' : 'text-slate-200'}`}>{fmtV(total)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="px-5 py-5 flex items-start gap-4">
                          <div className="flex-1">
                            <div className="text-[12px] text-slate-400 mb-3">Upload your AP aging report (CSV) or add vendors manually to track payables.</div>
                            <div className="text-[11px] text-slate-600">Columns needed: vendor, current, 1-30 days, 31-60 days, 61-90 days, 90+ days</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* MRR Movement */}
                    {hasMRR && (
                      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                        <div className="text-[12px] font-semibold text-slate-100 mb-0.5">MRR Movement</div>
                        <div className="text-[10px] text-slate-500 mb-4">Monthly recurring revenue — new, churned, and net change</div>
                        <div className="space-y-2">
                          {mrrPeriods.slice(1).map((p, i) => {
                            const prev = mrrPeriods[i];
                            const netPositive = p.netMRR >= 0;
                            return (
                              <div key={p.period} className="flex items-center gap-3">
                                <div className="w-10 text-[10px] text-slate-600 flex-shrink-0">{p.period}</div>
                                <div className="flex-1 flex items-center h-6 gap-0.5">
                                  {p.newMRR > 0 && (
                                    <div className="h-full bg-emerald-500/50 rounded-l flex items-center justify-center"
                                      style={{ width: `${Math.min((p.newMRR / Math.max(prev.mrr, 1)) * 100 * 3, 40)}%`, minWidth: 4 }}>
                                    </div>
                                  )}
                                  <div className="h-full bg-slate-700/60 flex-1 rounded flex items-center px-2">
                                    <span className="text-[9px] text-slate-400">{fmtV(p.mrr)}</span>
                                  </div>
                                  {p.churnMRR < 0 && (
                                    <div className="h-full bg-red-500/40 rounded-r"
                                      style={{ width: `${Math.min((Math.abs(p.churnMRR) / Math.max(prev.mrr, 1)) * 100 * 3, 40)}%`, minWidth: 4 }}>
                                    </div>
                                  )}
                                </div>
                                <div className={`w-20 text-right text-[11px] font-semibold flex-shrink-0 ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {p.netMRR >= 0 ? '+' : ''}{fmtV(p.netMRR)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-[10px]">
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500/50"/><span className="text-slate-500">New MRR</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-slate-700/60"/><span className="text-slate-500">Retained</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500/40"/><span className="text-slate-500">Churned</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Year-over-Year Same-Period Comparison ── */}
              {(() => {
                const periods = data.revenue.byPeriod ?? [];
                if (periods.length < 2) return null;

                // Split periods into halves — current "year" vs prior "year"
                const half = Math.floor(periods.length / 2);
                const recent  = periods.slice(-half);
                const priorYr = periods.slice(-half * 2, -half);
                if (recent.length === 0 || priorYr.length === 0) return null;

                const sumRev  = (arr: typeof periods) => arr.reduce((s, p) => s + (p.revenue ?? 0), 0);
                const sumGP   = (arr: typeof periods) => arr.reduce((s, p) => s + (p.grossProfit ?? ((p.revenue ?? 0) - (p.cogs ?? 0))), 0);
                const sumEB   = (arr: typeof periods) => arr.reduce((s, p) => s + (p.ebitda ?? 0), 0);

                const curRev  = sumRev(recent);  const priRev  = sumRev(priorYr);
                const curGP   = sumGP(recent);   const priGP   = sumGP(priorYr);
                const curEB   = sumEB(recent);   const priEB   = sumEB(priorYr);
                const curGM   = curRev > 0 ? (curGP / curRev) * 100 : 0;
                const priGM   = priRev > 0 ? (priGP / priRev) * 100 : 0;
                const curEM   = curRev > 0 ? (curEB / curRev) * 100 : 0;
                const priEM   = priRev > 0 ? (priEB / priRev) * 100 : 0;

                const fmtV = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString()}`; return n < 0 ? `(${s})` : s; };
                const chg  = (cur: number, pri: number) => pri !== 0 ? ((cur - pri) / Math.abs(pri)) * 100 : 0;
                const arrow = (pct: number, posGood = true) => {
                  const up = pct >= 0;
                  const good = posGood ? up : !up;
                  return <span className={`text-[11px] font-semibold ml-1 ${good ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>;
                };

                const rows = [
                  { label: 'Revenue',    cur: curRev, pri: priRev, isCurrency: true, posGood: true },
                  { label: 'Gross Profit',cur: curGP,  pri: priGP,  isCurrency: true, posGood: true },
                  { label: 'GM %',       cur: curGM,  pri: priGM,  isCurrency: false, posGood: true },
                  { label: 'EBITDA',     cur: curEB,  pri: priEB,  isCurrency: true, posGood: true },
                  { label: 'EBITDA %',   cur: curEM,  pri: priEM,  isCurrency: false, posGood: true },
                ];

                const curLabel = `${recent[0].period.slice(0,7)} – ${recent[recent.length-1].period.slice(0,7)}`;
                const priLabel = `${priorYr[0].period.slice(0,7)} – ${priorYr[priorYr.length-1].period.slice(0,7)}`;

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Year-over-Year Comparison</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Same-period analysis from your imported data</div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="text-slate-600">{priLabel}</span>
                        <span className="text-slate-700">→</span>
                        <span className="text-slate-400 font-medium">{curLabel}</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-800/40">
                            <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Metric</th>
                            <th className="px-5 py-2.5 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Prior</th>
                            <th className="px-5 py-2.5 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Current</th>
                            <th className="px-5 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">YoY Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => {
                            const delta = chg(row.cur, row.pri);
                            return (
                              <tr key={row.label} className="border-b border-slate-800/30">
                                <td className="px-5 py-2.5 text-[12px] text-slate-400">{row.label}</td>
                                <td className="px-5 py-2.5 text-right text-[12px] text-slate-600">
                                  {row.isCurrency ? fmtV(row.pri) : `${row.pri.toFixed(1)}%`}
                                </td>
                                <td className="px-5 py-2.5 text-right text-[12px] font-semibold text-slate-200">
                                  {row.isCurrency ? fmtV(row.cur) : `${row.cur.toFixed(1)}%`}
                                </td>
                                <td className="px-5 py-2.5 text-right">
                                  {row.pri !== 0 && arrow(delta, row.posGood)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── Pricing Power Analyzer (uses component-level state) ── */}
              {(() => {
                // pricingAnswer, setPricingAnswer, pricingLoading, setPricingLoading, pricingAnswers, setPricingAnswers — lifted to component level
                const questions = [
                  { id: 'q1', label: 'What is your primary offering?', placeholder: 'e.g. B2B SaaS analytics platform' },
                  { id: 'q2', label: 'Current avg price per client/unit', placeholder: 'e.g. $2,500/month' },
                  { id: 'q3', label: 'Last time you raised prices?', placeholder: 'e.g. 18 months ago, never' },
                  { id: 'q4', label: 'Do clients complain about price?', placeholder: 'e.g. Rarely, sometimes, often' },
                  { id: 'q5', label: 'Top 2 competitors and their pricing', placeholder: 'e.g. Acme $1,800/mo, Rival $3,200/mo' },
                ];

                const allAnswered = questions.every(q => (pricingAnswers[q.id] ?? '').trim().length > 0);

                const analyze = async () => {
                  setPricingLoading(true); setPricingAnswer('');
                  const rev = effectiveData.revenue.total;
                  const gm = rev > 0 ? ((rev - effectiveData.costs.totalCOGS) / rev * 100).toFixed(1) : 'N/A';
                  const prompt = `You are a pricing strategist. Based on the inputs below, give a specific pricing power recommendation.

Business data: Revenue $${(rev/1e6).toFixed(2)}M, Gross Margin ${gm}%, ${effectiveData.customers.totalCount} customers, ${((effectiveData.customers.retentionRate ?? 0.88)*100).toFixed(1)}% retention.

Pricing inputs:
- Offering: ${pricingAnswers.q1}
- Current price: ${pricingAnswers.q2}
- Last price increase: ${pricingAnswers.q3}
- Client price sensitivity: ${pricingAnswers.q4}
- Competitors: ${pricingAnswers.q5}

Respond with: (1) Recommended price increase % and rationale, (2) How to frame it to clients, (3) Expected revenue impact, (4) Risk to watch. Be specific and direct. 150 words max.`;
                  try {
                    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: prompt, data: effectiveData, planId: 'pro', maxTokens: 500 }) });
                    const j = await r.json() as { reply?: string };
                    setPricingAnswer(j.reply ?? 'No response');
                  } catch { setPricingAnswer('Error — check your API key.'); }
                  setPricingLoading(false);
                };

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50">
                      <div className="text-[12px] font-semibold text-slate-100">Pricing Power Analyzer</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Answer 5 questions · AI recommends your optimal price increase</div>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {questions.map(q => (
                          <div key={q.id}>
                            <div className="text-[10px] font-semibold text-slate-500 mb-1">{q.label}</div>
                            <input value={pricingAnswers[q.id] ?? ''} onChange={e => setPricingAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              placeholder={q.placeholder}
                              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"/>
                          </div>
                        ))}
                      </div>
                      <button onClick={analyze} disabled={!allAnswered || pricingLoading}
                        className="w-full py-2 rounded-lg text-[12px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/40 text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {pricingLoading ? 'Analyzing pricing power…' : 'Analyze Pricing Power →'}
                      </button>
                      {pricingAnswer && (
                        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-lg p-4 text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{pricingAnswer}</div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <EBITDABridge data={effectiveData}/>
              <RevenueBridge data={effectiveData}/>
              <AddBackTracker data={effectiveData} onAskAI={openChat}/>
              <BenchmarkFeed data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onNavigate={v => setActiveView(v as ActiveView)} onAskAI={openChat}/>
              <IndustryBenchmarksPanel data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>
              <MetricThresholdsPanel data={data} thresholds={thresholds} onChange={saveThresholds}/>
              {data.transactions && data.transactions.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em]">Transaction Ledger</div>
                    <div className="flex-1 h-px bg-slate-800/50"/>
                  </div>
                  <TransactionLedger transactions={data.transactions} onAskAI={openChat}/>
                </div>
              )}
              </ErrorBoundary>
            </div>
          <div className={activeView === 'customers' ? 'space-y-4' : 'hidden'}>
              {usingDemo && (
                <div className="flex items-center justify-between gap-4 bg-violet-500/8 border border-violet-500/20 rounded-xl px-4 py-3">
                  <div className="text-[11px] text-violet-300/80">
                    <span className="font-semibold">Demo data</span> — customer metrics below are sample values. Enter your real data to track actual retention and concentration.
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setShowManualEntry(true)} className="text-[11px] font-semibold text-violet-300 hover:text-violet-100 border border-violet-500/30 hover:border-violet-500/60 px-3 py-1.5 rounded-lg transition-colors">Enter manually</button>
                    <button onClick={() => setActiveView('data')} className="text-[11px] font-semibold text-violet-300 hover:text-violet-100 border border-violet-500/30 hover:border-violet-500/60 px-3 py-1.5 rounded-lg transition-colors">Upload CSV</button>
                  </div>
                </div>
              )}
              <ErrorBoundary label="Customers tab">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-violet-500/10"/>
                <SectionNote noteKey="customers" notes={panelNotes} onSave={setPanelNote}/>
                <div className="h-px flex-1 bg-violet-500/10"/>
              </div>
              <CustomerDashboard data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>

              {/* ── Contract Renewal Tracker ── */}
              {(() => {
                const CONTRACTS_KEY = 'bos_contracts';
                type Contract = { id: string; customer: string; value: number; renewalDate: string; status: 'active' | 'at-risk' | 'renewed'; notes?: string };
                const [contracts, setContracts] = React.useState<Contract[]>(() => {
                  try { const s = localStorage.getItem(CONTRACTS_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
                });
                const [showAdd, setShowAdd] = React.useState(false);
                const [newContract, setNewContract] = React.useState<Omit<Contract,'id'>>({ customer: '', value: 0, renewalDate: '', status: 'active' });

                const save = (updated: Contract[]) => {
                  setContracts(updated);
                  try { localStorage.setItem(CONTRACTS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
                };

                const addContract = () => {
                  if (!newContract.customer || !newContract.renewalDate) return;
                  const next = [...contracts, { ...newContract, id: `c${Date.now()}` }];
                  save(next);
                  setNewContract({ customer: '', value: 0, renewalDate: '', status: 'active' });
                  setShowAdd(false);
                };

                const removeContract = (id: string) => save(contracts.filter(c => c.id !== id));
                const toggleStatus = (id: string) => save(contracts.map(c => c.id === id ? { ...c, status: c.status === 'active' ? 'at-risk' : c.status === 'at-risk' ? 'renewed' : 'active' } : c));

                const now = new Date(); now.setHours(0,0,0,0);
                const sorted = [...contracts].sort((a,b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime());
                const upcoming30  = sorted.filter(c => { const d = new Date(c.renewalDate); const diff = Math.ceil((d.getTime()-now.getTime())/86400000); return diff >= 0 && diff <= 30; });
                const upcoming90  = sorted.filter(c => { const d = new Date(c.renewalDate); const diff = Math.ceil((d.getTime()-now.getTime())/86400000); return diff > 30 && diff <= 90; });
                const overdue     = sorted.filter(c => new Date(c.renewalDate) < now && c.status !== 'renewed');
                const totalAtRisk = sorted.filter(c => c.status !== 'renewed').reduce((s,c) => s+c.value, 0);
                const fmtV = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n}`;

                const statusColor = (s: Contract['status']) =>
                  s === 'renewed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                  s === 'at-risk' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                                    'text-sky-400 bg-sky-500/10 border-sky-500/20';

                const urgencyBg = (c: Contract) => {
                  if (c.status === 'renewed') return 'opacity-50';
                  const diff = Math.ceil((new Date(c.renewalDate).getTime()-now.getTime())/86400000);
                  if (diff < 0) return 'border-red-500/30 bg-red-500/5';
                  if (diff <= 30) return 'border-amber-500/25 bg-amber-500/5';
                  return '';
                };

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Contract Renewal Tracker</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Upcoming expirations · stay ahead of renewals</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {contracts.length > 0 && (
                          <div className="flex items-center gap-3 text-[11px]">
                            {overdue.length > 0 && <span className="text-red-400 font-semibold">{overdue.length} overdue</span>}
                            {upcoming30.length > 0 && <span className="text-amber-400">{upcoming30.length} due in 30d</span>}
                            {totalAtRisk > 0 && <span className="text-slate-500">{fmtV(totalAtRisk)} at risk</span>}
                          </div>
                        )}
                        <button onClick={() => setShowAdd(v => !v)}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 px-3 py-1.5 rounded-lg transition-colors">
                          + Add Contract
                        </button>
                      </div>
                    </div>

                    {showAdd && (
                      <div className="px-5 py-4 border-b border-slate-800/40 bg-slate-800/20">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          <input placeholder="Customer name" value={newContract.customer}
                            onChange={e => setNewContract(p => ({...p, customer: e.target.value}))}
                            className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 col-span-2"/>
                          <input type="number" placeholder="Annual value ($)" value={newContract.value || ''}
                            onChange={e => setNewContract(p => ({...p, value: Number(e.target.value)}))}
                            className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"/>
                          <input type="date" value={newContract.renewalDate}
                            onChange={e => setNewContract(p => ({...p, renewalDate: e.target.value}))}
                            className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50"/>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={addContract} disabled={!newContract.customer || !newContract.renewalDate}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[12px] font-semibold rounded-lg transition-colors">
                            Save
                          </button>
                          <button onClick={() => setShowAdd(false)}
                            className="px-4 py-1.5 text-[12px] text-slate-400 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {contracts.length === 0 ? (
                      <div className="px-5 py-6 text-center">
                        <div className="text-[12px] text-slate-500 mb-1">No contracts tracked yet</div>
                        <div className="text-[11px] text-slate-600">Add customer contracts to get renewal alerts and track at-risk revenue</div>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/40">
                        {sorted.map(c => {
                          const days = Math.ceil((new Date(c.renewalDate).getTime()-now.getTime())/86400000);
                          return (
                            <div key={c.id} className={`px-5 py-3.5 flex items-center gap-4 border ${urgencyBg(c)}`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[12px] font-semibold text-slate-200">{c.customer}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusColor(c.status)} capitalize`}>{c.status}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {c.value > 0 && <span className="text-slate-400 font-medium">{fmtV(c.value)}/yr · </span>}
                                  Renews {new Date(c.renewalDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  {c.status !== 'renewed' && (
                                    <span className={` · ${days < 0 ? 'text-red-400 font-semibold' : days <= 30 ? 'text-amber-400' : 'text-slate-600'}`}>
                                      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => toggleStatus(c.id)}
                                  className="text-[10px] text-slate-500 hover:text-slate-300 border border-slate-700/50 px-2 py-1 rounded transition-colors">
                                  {c.status === 'renewed' ? 'Mark active' : c.status === 'at-risk' ? 'Mark renewed' : 'Mark at-risk'}
                                </button>
                                <button onClick={() => removeContract(c.id)}
                                  className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors px-1">✕</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── NPS Tracker ── */}
              {(() => {
                const NPS_KEY = 'bos_nps_history';
                type NPSEntry = { date: string; score: number; note?: string };
                const [npsHistory, setNpsHistory] = React.useState<NPSEntry[]>(() => {
                  try { const s = localStorage.getItem(NPS_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
                });
                const [npsInput, setNpsInput] = React.useState('');
                const [npsNote, setNpsNote] = React.useState('');
                const [npsAdded, setNpsAdded] = React.useState(false);

                const latestNPS = data.customers.nps ?? null;
                const allScores = latestNPS !== undefined && latestNPS !== null
                  ? [...npsHistory, { date: 'Current', score: latestNPS }]
                  : npsHistory;

                const addNPS = () => {
                  const score = parseInt(npsInput, 10);
                  if (isNaN(score) || score < -100 || score > 100) return;
                  const entry: NPSEntry = { date: new Date().toISOString().slice(0,7), score, note: npsNote || undefined };
                  const updated = [...npsHistory, entry].slice(-12);
                  setNpsHistory(updated);
                  try { localStorage.setItem(NPS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
                  setNpsInput(''); setNpsNote('');
                  setNpsAdded(true); setTimeout(() => setNpsAdded(false), 2500);
                };

                const currentScore = allScores.length > 0 ? allScores[allScores.length-1].score : null;
                const npsColor = currentScore === null ? 'text-slate-400' : currentScore >= 50 ? 'text-emerald-400' : currentScore >= 0 ? 'text-amber-400' : 'text-red-400';
                const npsLabel = currentScore === null ? '—' : currentScore >= 50 ? 'Excellent' : currentScore >= 20 ? 'Good' : currentScore >= 0 ? 'Neutral' : 'At Risk';
                const maxAbs = allScores.length > 0 ? Math.max(100, ...allScores.map(s => Math.abs(s.score))) : 100;

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Net Promoter Score (NPS)</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Track customer satisfaction over time · &lt;0 poor · 0–49 good · 50+ excellent</div>
                      </div>
                      {currentScore !== null && (
                        <div className="text-right">
                          <div className={`text-[22px] font-bold tabular-nums ${npsColor}`}>{currentScore > 0 ? '+' : ''}{currentScore}</div>
                          <div className={`text-[10px] ${npsColor}`}>{npsLabel}</div>
                        </div>
                      )}
                    </div>

                    {allScores.length > 0 && (
                      <div className="px-5 py-4 border-b border-slate-800/40">
                        <div className="space-y-2">
                          {allScores.map((entry, i) => {
                            const pct = (entry.score / maxAbs) * 50; // center-based
                            const positive = entry.score >= 0;
                            return (
                              <div key={i} className="flex items-center gap-3">
                                <div className="w-14 text-[10px] text-slate-600 flex-shrink-0 text-right">{entry.date}</div>
                                <div className="flex-1 h-5 flex items-center">
                                  <div className="flex-1 flex items-center justify-center relative">
                                    <div className="absolute inset-y-0 left-1/2 w-px bg-slate-700/60"/>
                                    {positive ? (
                                      <div className="absolute left-1/2 top-1 bottom-1 bg-emerald-500/40 rounded-r" style={{ width: `${pct}%` }}/>
                                    ) : (
                                      <div className="absolute right-1/2 top-1 bottom-1 bg-red-500/40 rounded-l" style={{ width: `${Math.abs(pct)}%` }}/>
                                    )}
                                  </div>
                                </div>
                                <div className={`w-10 text-right text-[11px] font-semibold flex-shrink-0 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {entry.score > 0 ? '+' : ''}{entry.score}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center mt-2 text-[10px] text-slate-600">
                          <div className="flex-1 text-left">← Detractors</div>
                          <div className="flex-1 text-center">NPS Scale (–100 to +100)</div>
                          <div className="flex-1 text-right">Promoters →</div>
                        </div>
                      </div>
                    )}

                    <div className="px-5 py-4">
                      <div className="text-[11px] font-semibold text-slate-400 mb-2">Log NPS Score</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="number" min={-100} max={100} value={npsInput} onChange={e => setNpsInput(e.target.value)}
                          placeholder="Score (−100 to +100)"
                          className="w-40 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60"/>
                        <input type="text" value={npsNote} onChange={e => setNpsNote(e.target.value)}
                          placeholder="Optional note (survey, Q2 2025…)"
                          className="flex-1 min-w-[160px] bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60"/>
                        <button onClick={addNPS}
                          className="px-4 py-2 text-[12px] font-semibold bg-violet-600/20 hover:bg-violet-600/30 border border-violet-600/40 text-violet-300 rounded-lg transition-colors flex-shrink-0">
                          {npsAdded ? '✓ Saved' : 'Add Score'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── CAC / LTV Dashboard ── */}
              {(() => {
                const rev = effectiveData.revenue.total;
                const customers = effectiveData.customers.totalCount || 1;
                const retention = effectiveData.customers.retentionRate ?? 0.88;
                const avgRev = rev / customers;
                const gm = rev > 0 ? (rev - effectiveData.costs.totalCOGS) / rev : 0.5;
                const churnRate = 1 - retention;
                // LTV = (avg revenue × gross margin) / churn rate
                const ltv = churnRate > 0 ? (avgRev * gm) / churnRate : avgRev * gm * 5;
                const opex = effectiveData.costs.totalOpEx;
                // CAC estimate — sales & marketing portion of opex (assume ~30% without breakdown)
                const newCustomers = effectiveData.customers.newThisPeriod || 1;
                const smCategories = effectiveData.costs.byCategory.filter(c => /sales|market|growth|bd|business dev/i.test(c.category));
                const smSpend = smCategories.length > 0 ? smCategories.reduce((s,c) => s+c.amount, 0) : opex * 0.3;
                const cac = smSpend / Math.max(newCustomers, 1);
                const ltvCac = cac > 0 ? ltv / cac : null;
                const paybackMonths = cac > 0 && avgRev > 0 ? Math.round(cac / (avgRev / 12 * gm)) : null;
                const fmtV = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n).toLocaleString()}`;

                const ltvCacColor = ltvCac === null ? 'text-slate-400' : ltvCac >= 3 ? 'text-emerald-400' : ltvCac >= 1.5 ? 'text-amber-400' : 'text-red-400';
                const ltvCacLabel = ltvCac === null ? '—' : ltvCac >= 3 ? 'Healthy' : ltvCac >= 1.5 ? 'Borderline' : 'Unsustainable';
                const paybackColor = paybackMonths === null ? 'text-slate-400' : paybackMonths <= 12 ? 'text-emerald-400' : paybackMonths <= 24 ? 'text-amber-400' : 'text-red-400';

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50">
                      <div className="text-[12px] font-semibold text-slate-100">CAC / LTV Economics</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Customer acquisition cost, lifetime value, and payback — core unit economics</div>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                        {[
                          { label: 'CAC', value: fmtV(cac), sub: `${newCustomers} new customers`, color: 'text-slate-200', hint: 'S&M spend ÷ new customers' },
                          { label: 'LTV', value: fmtV(ltv), sub: `${(churnRate*100).toFixed(1)}% churn rate`, color: 'text-violet-400', hint: 'Avg rev × GM ÷ churn' },
                          { label: 'LTV:CAC', value: ltvCac !== null ? `${ltvCac.toFixed(1)}×` : '—', sub: ltvCacLabel, color: ltvCacColor, hint: 'Target ≥ 3×' },
                          { label: 'Payback', value: paybackMonths !== null ? `${paybackMonths}mo` : '—', sub: paybackMonths !== null ? (paybackMonths <= 12 ? 'Excellent' : paybackMonths <= 24 ? 'Acceptable' : 'Too long') : 'N/A', color: paybackColor, hint: 'Months to recover CAC' },
                        ].map(m => (
                          <div key={m.label} className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 text-center">
                            <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{m.label}</div>
                            <div className={`text-[20px] font-bold ${m.color}`}>{m.value}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{m.sub}</div>
                            <div className="text-[9px] text-slate-700 mt-1">{m.hint}</div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {smCategories.length === 0 && (
                          <div className="text-[10px] text-amber-500/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2">
                            S&M spend estimated at 30% of OpEx — add a Sales or Marketing cost category for accurate CAC
                          </div>
                        )}
                        <div className="text-[10px] text-slate-600">
                          LMM benchmarks: LTV:CAC ≥ 3× healthy | payback ≤ 18 months | avg revenue per customer {fmtV(avgRev)}/yr
                        </div>
                        {ltvCac !== null && ltvCac < 2 && (
                          <div className="text-[11px] text-red-400/80">CAC recovery risk: LTV:CAC below 2× means you may be acquiring unprofitable customers — audit S&M spend and average deal size.</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── AI Churn Risk Predictor (uses component-level state) ── */}
              {(() => {
                // churnResult, setChurnResult, churnLoading, setChurnLoading — lifted to component level
                const customers = effectiveData.customers.topCustomers;
                const retention = effectiveData.customers.retentionRate ?? 0.88;
                const churned = effectiveData.customers.churned;

                const runChurnPredict = async () => {
                  setChurnLoading(true); setChurnResult('');
                  const contracts = (() => { try { const s = localStorage.getItem('bos_contracts'); return s ? JSON.parse(s) as {customer:string;value:number;renewalDate:string;status:string}[] : []; } catch { return []; } })();
                  const npsHist = (() => { try { const s = localStorage.getItem('bos_nps_history'); return s ? JSON.parse(s) as {date:string;score:number}[] : []; } catch { return []; } })();
                  const npsLatest = npsHist.length > 0 ? npsHist[npsHist.length-1].score : null;
                  const expiring90 = contracts.filter(c => { const d = new Date(c.renewalDate); const diff = (d.getTime()-Date.now())/86400000; return diff >= 0 && diff <= 90; });
                  const atRisk = contracts.filter(c => c.status === 'at-risk');

                  const f = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n)}`;
                  const topList = customers.slice(0,8).map(c => `${c.name}: ${c.percentOfTotal.toFixed(1)}% of rev, ${c.revenueType ?? 'unknown'}, ${f(c.revenue)}`).join('\n');
                  const expiringList = expiring90.map(c => `${c.customer}: ${f(c.value)} renews ${c.renewalDate}`).join(', ') || 'none tracked';

                  const prompt = `You are a customer success strategist. Analyze churn risk for this business and rank customers by risk.

Company data:
- Retention rate: ${(retention*100).toFixed(1)}% | Churned this period: ${churned}
- NPS: ${npsLatest ?? 'unknown'}
- Contracts expiring in 90 days: ${expiringList}
- At-risk contracts: ${atRisk.map(c=>c.customer).join(', ') || 'none'}

Top customers:
${topList}

Respond with:
🔴 HIGH CHURN RISK — name 1-3 specific customers and why
🟡 WATCH — 2-3 customers showing early warning signs
✅ STABLE — brief note on healthiest accounts
⚡ TOP ACTIONS — 3 specific retention moves to do this week

Be specific, use the actual names. 200 words max.`;
                  try {
                    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: prompt, data: effectiveData, planId: 'pro', maxTokens: 600 }) });
                    const j = await r.json() as { reply?: string };
                    setChurnResult(j.reply ?? 'No response');
                  } catch { setChurnResult('Error — check API key.'); }
                  setChurnLoading(false);
                };

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">AI Churn Risk Predictor</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Scores each customer by churn risk using contracts, NPS, concentration, and revenue type</div>
                      </div>
                      <button onClick={runChurnPredict} disabled={churnLoading}
                        className="text-[11px] px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-600/40 text-rose-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        {churnLoading ? 'Analyzing…' : 'Run Churn Analysis →'}
                      </button>
                    </div>
                    <div className="p-5">
                      {/* Quick risk grid from data */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                        {customers.slice(0,6).map(c => {
                          const contracts = (() => { try { const s = localStorage.getItem('bos_contracts'); return s ? JSON.parse(s) as {customer:string;status:string;renewalDate:string}[] : []; } catch { return []; } })();
                          const contract = contracts.find(ct => ct.customer.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
                          const isAtRisk = contract?.status === 'at-risk';
                          const isExpiring = contract ? (new Date(contract.renewalDate).getTime()-Date.now())/86400000 < 60 : false;
                          const highConc = c.percentOfTotal > 20;
                          const isOneTime = c.revenueType === 'project';
                          const riskCount = [isAtRisk, isExpiring, highConc, isOneTime].filter(Boolean).length;
                          const riskColor = riskCount >= 2 ? 'border-red-500/30 bg-red-500/5' : riskCount === 1 ? 'border-amber-500/20 bg-amber-500/5' : 'border-slate-700/30 bg-slate-800/20';
                          const riskLabel = riskCount >= 2 ? 'High' : riskCount === 1 ? 'Watch' : 'Stable';
                          const riskCls = riskCount >= 2 ? 'text-red-400' : riskCount === 1 ? 'text-amber-400' : 'text-emerald-400';
                          return (
                            <div key={c.name} className={`border rounded-lg p-3 ${riskColor}`}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-[11px] font-semibold text-slate-300 truncate">{c.name}</div>
                                <div className={`text-[10px] font-bold ${riskCls}`}>{riskLabel}</div>
                              </div>
                              <div className="text-[10px] text-slate-500">{c.percentOfTotal.toFixed(1)}% of rev · {c.revenueType ?? 'unknown'}</div>
                              {(isAtRisk || isExpiring || highConc) && (
                                <div className="text-[9px] text-amber-500/80 mt-1">
                                  {[isAtRisk && 'contract at-risk', isExpiring && 'expiring <60d', highConc && 'high concentration'].filter(Boolean).join(' · ')}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {churnResult ? (
                        <div className="bg-rose-950/20 border border-rose-500/20 rounded-lg p-4 text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{churnResult}</div>
                      ) : (
                        <div className="text-[10px] text-slate-600 text-center py-2">Run the AI analysis for a detailed per-customer risk assessment and action plan</div>
                      )}
                    </div>
                  </div>
                );
              })()}
              </ErrorBoundary>
            </div>
          <div className={activeView === 'operations' ? 'space-y-4' : 'hidden'}>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-cyan-500/10"/>
                <SectionNote noteKey="operations" notes={panelNotes} onSave={setPanelNote}/>
                <div className="h-px flex-1 bg-cyan-500/10"/>
              </div>
              <OperationsDashboard data={effectiveData} previousData={prevSnapshot?.data ?? PREV_DEMO} onAskAI={openChat}/>

              {/* ── Key Person Risk ── */}
              {(() => {
                const depts = effectiveData.payrollByDept ?? [];
                const rev   = effectiveData.revenue.total;
                if (depts.length < 2) return null;
                const totalComp = depts.reduce((s,d) => s + d.totalCompensation, 0);
                const sorted = [...depts].sort((a,b) => b.totalCompensation - a.totalCompensation);
                const top1Pct  = totalComp > 0 ? (sorted[0].totalCompensation / totalComp) * 100 : 0;
                const top2Pct  = totalComp > 0 && sorted[1] ? ((sorted[0].totalCompensation + sorted[1].totalCompensation) / totalComp) * 100 : top1Pct;
                const fmtV = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n}`;
                const risk = top1Pct > 40 ? 'high' : top1Pct > 25 ? 'medium' : 'low';
                const riskColor = risk === 'high' ? 'text-red-400' : risk === 'medium' ? 'text-amber-400' : 'text-emerald-400';
                const riskBg = risk === 'high' ? 'bg-red-500/5 border-red-500/15' : risk === 'medium' ? 'bg-amber-500/5 border-amber-500/15' : 'bg-slate-900/50 border-slate-800/50';
                return (
                  <div className={`rounded-xl border p-5 ${riskBg}`}>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Key Person Risk</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Department compensation concentration · M&A discount factor</div>
                      </div>
                      <div className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border capitalize ${riskColor} ${risk === 'high' ? 'bg-red-500/10 border-red-500/20' : risk === 'medium' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                        {risk} key-person risk
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {sorted.map((d, i) => {
                        const pct = totalComp > 0 ? (d.totalCompensation / totalComp) * 100 : 0;
                        const revPct = rev > 0 ? (d.totalCompensation / rev) * 100 : 0;
                        return (
                          <div key={d.department}>
                            <div className="flex items-center justify-between mb-1 text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${i < 2 ? 'text-slate-200' : 'text-slate-400'}`}>{d.department}</span>
                                <span className="text-slate-600">{d.headcount} person{d.headcount !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-500">{revPct.toFixed(1)}% of rev</span>
                                <span className={`font-semibold ${pct > 35 ? 'text-red-400' : pct > 20 ? 'text-amber-400' : 'text-slate-300'}`}>{pct.toFixed(0)}% of payroll</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct > 35 ? 'bg-red-500/60' : pct > 20 ? 'bg-amber-500/50' : 'bg-cyan-500/50'}`}
                                style={{ width: `${pct}%` }}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {risk !== 'low' && (
                      <div className={`mt-4 text-[11px] leading-relaxed ${riskColor}/80`}>
                        {risk === 'high'
                          ? `⚠ Top department = ${top1Pct.toFixed(0)}% of total payroll. Buyers will typically discount 10–20% for key-person dependency. Document processes and cross-train to de-risk.`
                          : `▲ Top 2 departments = ${top2Pct.toFixed(0)}% of payroll. Moderate concentration — acceptable but worth building redundancy.`}
                      </div>
                    )}
                    {openChat && (
                      <button onClick={() => openChat(`My top department is ${sorted[0].department} at ${top1Pct.toFixed(0)}% of total payroll (${fmtV(sorted[0].totalCompensation)}). Key person risk is rated ${risk}. What are the best ways to reduce key-person dependency and how does this affect my business valuation?`)}
                        className="mt-3 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                        Ask AI how to reduce key-person risk →
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* ── Payroll % of Revenue Trend ── */}
              {(() => {
                const periods = effectiveData.revenue.byPeriod ?? [];
                const depts   = effectiveData.payrollByDept ?? [];
                const rev     = effectiveData.revenue.total;
                if (periods.length < 2 || depts.length === 0) return null;
                const totalPayroll = depts.reduce((s,d) => s+d.totalCompensation, 0);
                if (totalPayroll === 0) return null;
                // Distribute payroll evenly across periods for trend (best estimate without per-period payroll)
                const payrollPerPeriod = totalPayroll / periods.length;
                const chartData = periods.slice(-8).map(p => ({
                  period: p.period.replace(/^20\d\d-/,''),
                  payrollPct: p.revenue > 0 ? (payrollPerPeriod / p.revenue) * 100 : 0,
                  rev: p.revenue,
                }));
                const latestPct = rev > 0 ? (totalPayroll / rev) * 100 : 0;
                const pctColor = latestPct < 40 ? 'text-emerald-400' : latestPct < 60 ? 'text-amber-400' : 'text-red-400';
                const fmtV = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n}`;
                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Payroll as % of Revenue</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Labor cost efficiency · LMM benchmark 35–55%</div>
                      </div>
                      <div className={`text-[22px] font-bold tabular-nums ${pctColor}`}>{latestPct.toFixed(1)}%</div>
                    </div>
                    <div className="space-y-1.5">
                      {chartData.map((d, i) => (
                        <div key={d.period} className="flex items-center gap-3">
                          <div className="w-10 text-[10px] text-slate-600 flex-shrink-0">{d.period}</div>
                          <div className="flex-1 h-4 bg-slate-800/60 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${d.payrollPct < 40 ? 'bg-emerald-500/50' : d.payrollPct < 60 ? 'bg-amber-500/50' : 'bg-red-500/50'}`}
                              style={{ width: `${Math.min(d.payrollPct, 100)}%` }}/>
                          </div>
                          <div className="w-12 text-right text-[11px] font-semibold text-slate-400 flex-shrink-0">{d.payrollPct.toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-800/40 text-center text-[10px] text-slate-600">
                      <div><div className="w-full h-1 bg-emerald-500/40 rounded mb-1"/>&lt;40% efficient</div>
                      <div><div className="w-full h-1 bg-amber-500/40 rounded mb-1"/>40–60% typical</div>
                      <div><div className="w-full h-1 bg-red-500/40 rounded mb-1"/>&gt;60% at risk</div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Operating Leverage Analysis ── */}
              {(() => {
                const rev = data.revenue.total; const cogs = data.costs.totalCOGS; const opex = data.costs.totalOpEx;
                if (rev <= 0) return null;
                const gp = rev - cogs; const gm = gp / rev;
                const fixedEst = opex * 0.65; const varEst = opex * 0.35;
                const contribMargin = gp - varEst; const cmPct = rev > 0 ? contribMargin / rev : 0;
                const breakEven = cmPct > 0 ? fixedEst / cmPct : null;
                const incrEBITDA10 = rev * 0.1 * cmPct; // incremental EBITDA from +10% revenue
                const fmtN = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`;
                const metrics = [
                  { label: 'Gross Margin', value: `${(gm*100).toFixed(1)}%`, sub: 'Revenue after COGS', color: gm >= 0.45 ? 'text-emerald-400' : gm >= 0.3 ? 'text-amber-400' : 'text-red-400' },
                  { label: 'Contribution Margin', value: `${(cmPct*100).toFixed(1)}%`, sub: 'After variable costs', color: cmPct >= 0.35 ? 'text-emerald-400' : cmPct >= 0.2 ? 'text-amber-400' : 'text-red-400' },
                  { label: 'Fixed Cost Est.', value: fmtN(fixedEst), sub: '~65% of OpEx', color: 'text-slate-400' },
                  { label: 'Break-even Revenue', value: breakEven !== null ? fmtN(breakEven) : '—', sub: 'Min to cover fixed costs', color: breakEven !== null && rev > breakEven ? 'text-emerald-400' : 'text-amber-400' },
                  { label: '+10% Revenue → EBITDA', value: fmtN(incrEBITDA10), sub: 'Incremental flow-through', color: 'text-indigo-400' },
                ];
                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                    <div className="text-[12px] font-semibold text-slate-100 mb-0.5">Operating Leverage</div>
                    <div className="text-[10px] text-slate-500 mb-4">How much revenue growth flows to the bottom line · fixed vs variable cost split</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {metrics.map(m => (
                        <div key={m.label} className="bg-slate-800/30 rounded-lg p-3 text-center">
                          <div className={`text-[18px] font-bold tabular-nums leading-none ${m.color}`}>{m.value}</div>
                          <div className="text-[11px] font-semibold text-slate-300 mt-1.5">{m.label}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">{m.sub}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/15 rounded-lg text-[11px] text-indigo-300/80 leading-relaxed">
                      At current cost structure, each additional $1 of revenue generates <strong className="text-indigo-300">${(cmPct).toFixed(2)} in contribution margin</strong> and approximately <strong className="text-indigo-300">${(cmPct * (1 - fixedEst/Math.max(gp,1))).toFixed(2)} of incremental EBITDA</strong> (after absorbing fixed overhead). {cmPct >= 0.3 ? 'Healthy operating leverage — growth will accelerate profitability.' : 'Low contribution margin — focus on pricing or variable cost reduction before scaling.'}
                    </div>
                  </div>
                );
              })()}

              {/* ── Cost Reduction Initiative Tracker ── */}
              {(() => {
                const COST_KEY = 'bos_cost_initiatives';
                type Initiative = { id: string; name: string; category: string; targetSavings: number; owner: string; status: 'planned' | 'in-progress' | 'completed' | 'stalled'; actualSavings?: number };
                const [initiatives, setInitiatives] = React.useState<Initiative[]>(() => {
                  try { const s = localStorage.getItem(COST_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
                });
                const [showAdd, setShowAdd] = React.useState(false);
                const [newInit, setNewInit] = React.useState<Omit<Initiative,'id'>>({ name: '', category: 'SG&A', targetSavings: 0, owner: '', status: 'planned' });

                const save = (updated: Initiative[]) => { setInitiatives(updated); try { localStorage.setItem(COST_KEY, JSON.stringify(updated)); } catch { /* ignore */ } };
                const addInit = () => { if (!newInit.name.trim()) return; save([...initiatives, { ...newInit, id: `ci${Date.now()}` }]); setNewInit({ name: '', category: 'SG&A', targetSavings: 0, owner: '', status: 'planned' }); setShowAdd(false); };
                const cycleStatus = (id: string) => { const c: Initiative['status'][] = ['planned','in-progress','completed','stalled']; save(initiatives.map(i => i.id === id ? { ...i, status: c[(c.indexOf(i.status)+1)%4] } : i)); };

                const totalTarget = initiatives.reduce((s, i) => s + i.targetSavings, 0);
                const totalActual = initiatives.reduce((s, i) => s + (i.actualSavings ?? 0), 0);
                const fmtN = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${n}`;
                const statusCfg: Record<Initiative['status'], { label: string; cls: string }> = {
                  'planned':     { label: 'Planned',     cls: 'bg-slate-700/40 text-slate-500 border-slate-700/40' },
                  'in-progress': { label: 'In Progress', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
                  'completed':   { label: 'Completed',   cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  'stalled':     { label: 'Stalled',     cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                };
                const cats = ['SG&A','COGS','Headcount','Technology','Facilities','Vendor','Other'];
                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Cost Reduction Initiatives</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{initiatives.length} initiatives · {fmtN(totalTarget)} target savings{totalActual > 0 ? ` · ${fmtN(totalActual)} realized` : ''}</div>
                      </div>
                      <button onClick={() => setShowAdd(v => !v)} className="text-[11px] px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-300 rounded-lg transition-colors">+ Add Initiative</button>
                    </div>
                    {showAdd && (
                      <div className="px-5 py-3 border-b border-slate-800/40 bg-slate-800/20 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input value={newInit.name} onChange={e => setNewInit(p => ({...p, name: e.target.value}))} placeholder="Initiative name"
                          className="col-span-2 sm:col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"/>
                        <select value={newInit.category} onChange={e => setNewInit(p => ({...p, category: e.target.value}))}
                          className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-300 focus:outline-none">
                          {cats.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <input type="number" value={newInit.targetSavings || ''} onChange={e => setNewInit(p => ({...p, targetSavings: +e.target.value}))} placeholder="Target savings $"
                          className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"/>
                        <input value={newInit.owner} onChange={e => setNewInit(p => ({...p, owner: e.target.value}))} placeholder="Owner"
                          className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"/>
                        <div className="flex gap-2">
                          <button onClick={addInit} className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold rounded-lg">Add</button>
                          <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-slate-500 hover:text-slate-300 text-[12px]">✕</button>
                        </div>
                      </div>
                    )}
                    {initiatives.length === 0 ? (
                      <div className="px-5 py-6 text-center text-[12px] text-slate-500">No initiatives yet — add cost reduction projects to track savings</div>
                    ) : (
                      <div className="divide-y divide-slate-800/30">
                        {initiatives.map(i => (
                          <div key={i.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[12px] font-semibold text-slate-200">{i.name}</span>
                                <span className="text-[10px] text-slate-600 bg-slate-800/40 px-1.5 py-0.5 rounded">{i.category}</span>
                                {i.owner && <span className="text-[10px] text-slate-600">@{i.owner}</span>}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Target: <span className="text-emerald-400 font-semibold">{fmtN(i.targetSavings)}</span>{i.actualSavings ? <> · Realized: <span className="text-emerald-300">{fmtN(i.actualSavings)}</span></> : null}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => cycleStatus(i.id)} className={`text-[9px] font-bold px-2 py-1 rounded border cursor-pointer transition-all ${statusCfg[i.status].cls}`}>{statusCfg[i.status].label}</button>
                              <button onClick={() => save(initiatives.filter(x => x.id !== i.id))} className="text-[10px] text-slate-700 hover:text-red-400">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {initiatives.length > 0 && totalTarget > 0 && (
                      <div className="px-5 py-3 border-t border-slate-800/40 grid grid-cols-3 gap-3 text-center text-[10px]">
                        <div><div className="text-[14px] font-bold text-slate-300">{fmtN(totalTarget)}</div><div className="text-slate-600">Total Target</div></div>
                        <div><div className="text-[14px] font-bold text-emerald-400">{fmtN(totalActual)}</div><div className="text-slate-600">Realized</div></div>
                        <div><div className="text-[14px] font-bold text-amber-400">{totalTarget > 0 ? ((totalActual/totalTarget)*100).toFixed(0) : 0}%</div><div className="text-slate-600">Captured</div></div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── AI Workflow Automation Tools ── */}
              {(() => {
                type ToolId = 'vendor'|'hire'|'automation'|'contract'|'subscription'|'expense';
                const [activeAI, setActiveAI] = React.useState<ToolId|null>(null);
                const [aiInput, setAiInput] = React.useState('');
                const [aiResult, setAiResult] = React.useState('');
                const [aiLoading, setAiLoading] = React.useState(false);

                const fmtN = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`;
                const rev = data.revenue.total; const headcount = data.operations.headcount ?? 0;
                const payroll = (data.payrollByDept ?? []).reduce((s, d) => s + d.totalCompensation, 0);

                const tools: { id: ToolId; label: string; icon: string; desc: string; inputPlaceholder: string }[] = [
                  { id: 'vendor',       label: 'Vendor Negotiation Brief',    icon: '🤝', desc: 'Enter a vendor + spend → one-page negotiation brief with benchmarks, leverage, and opening ask',                 inputPlaceholder: '"Salesforce — CRM software, $24k/yr"' },
                  { id: 'hire',         label: 'Hire vs. Contractor',          icon: '👥', desc: 'Compare fully-loaded FTE cost vs contractor — break-even hours, 3-year NPV, clear recommendation',             inputPlaceholder: '"Sales development rep, 40hrs/wk, ~$65k salary range"' },
                  { id: 'contract',     label: 'Contract Risk Analyzer',       icon: '📋', desc: 'Paste any vendor/customer contract clause → AI flags risk terms, auto-renewal traps, and redline suggestions', inputPlaceholder: 'Paste the contract text or specific clauses here…' },
                  { id: 'subscription', label: 'SaaS Subscription Audit',      icon: '💳', desc: 'List your software tools and costs → AI identifies redundant tools, consolidation plays, and estimated savings', inputPlaceholder: '"Salesforce $2k, HubSpot $800, Pipedrive $400, Monday $600, Notion $300…"' },
                  { id: 'expense',      label: 'Expense Benchmark & Cuts',     icon: '📉', desc: 'AI compares your cost categories to LMM benchmarks and identifies the top 3 above-market spending areas',      inputPlaceholder: 'Optional: add any context about recent spend changes or budget pressure' },
                  { id: 'automation',   label: 'AI Automation Roadmap',        icon: '⚡', desc: 'Scan your labor costs → specific AI tools and workflows that can cut 20–60% in each area with ROI estimates',   inputPlaceholder: 'Optional: describe your biggest time-consuming manual tasks' },
                ];

                const runAI = async (toolId: ToolId) => {
                  setAiLoading(true); setAiResult('');
                  let prompt = '';
                  if (toolId === 'vendor') {
                    prompt = `Vendor: ${aiInput || 'a major vendor'}. Write a concise negotiation brief (under 200 words). Include: 1) Market rate benchmark for this category, 2) Three specific leverage points, 3) Suggested opening ask (% or $), 4) Walk-away position, 5) One risk to flag. Bullet points under bold headers.`;
                  } else if (toolId === 'hire') {
                    const salaryGuess = headcount > 0 ? Math.round(payroll / Math.max(headcount, 1)) : 75000;
                    prompt = `Role: ${aiInput || 'a general business role'}. Context: ${headcount} employees, avg salary ~${fmtN(salaryGuess)}/yr, company revenue ${fmtN(rev)}. Compare: fully-loaded FTE (salary + 30% benefits/taxes + 10% overhead) vs contractor at market rates. Show break-even hours/year, 3-year total cost comparison, and a clear hire/contract recommendation with reasoning.`;
                  } else if (toolId === 'contract') {
                    prompt = `Review this contract language for an LMM business and flag: 1) Auto-renewal or lock-in traps, 2) Unfavorable liability or indemnification clauses, 3) Pricing escalation provisions, 4) IP ownership risks, 5) Exit/termination terms. For each issue found, write a specific redline suggestion. Contract text:\n\n${aiInput || '(paste contract text)'}`;
                  } else if (toolId === 'subscription') {
                    prompt = `SaaS stack: ${aiInput || '(no tools listed)'}. Company revenue: ${fmtN(rev)}, headcount: ${headcount}. Analyze for: 1) Redundant tools doing the same job, 2) Tools likely underutilized at this company size, 3) Consolidation plays (e.g. "replace X + Y with Z"), 4) Estimated annual savings. Format as a prioritized list with dollar estimates. Be specific about which tools to cut first and why.`;
                  } else if (toolId === 'expense') {
                    const cats = data.costs.byCategory.slice(0, 6).map(c => `${c.category}: ${fmtN(c.amount)} (${rev > 0 ? ((c.amount/rev)*100).toFixed(1) : 0}% of rev)`).join(', ');
                    prompt = `Expense benchmark analysis for an LMM business. Revenue: ${fmtN(rev)}, EBITDA margin: ${rev > 0 ? (((rev-data.costs.totalCOGS-data.costs.totalOpEx)/rev)*100).toFixed(1) : 0}%, headcount: ${headcount}. Cost categories: ${cats}. ${aiInput ? `Context: ${aiInput}.` : ''} Compare each category to typical LMM benchmarks (% of revenue). Identify the top 3 categories that appear above market. For each: state the benchmark, the gap in dollars, and one specific action to close it. End with the total potential EBITDA improvement if gaps are closed.`;
                  } else if (toolId === 'automation') {
                    prompt = `AI automation roadmap for an LMM business. Revenue: ${fmtN(rev)}, headcount: ${headcount}, payroll: ${fmtN(payroll)} (${rev > 0 ? ((payroll/rev)*100).toFixed(0) : 0}% of revenue). Cost breakdown: ${data.costs.byCategory.slice(0,5).map(c => `${c.category}: ${fmtN(c.amount)}`).join(', ')}. ${aiInput ? `Manual tasks: ${aiInput}.` : ''} Identify top 5 automation plays. For each: specific workflow to automate, exact AI tool or platform to use, realistic time/cost savings (hours/month + $ value), and implementation difficulty (Easy/Medium/Hard). Order by ROI. Include one "quick win" completable in under a week.`;
                  }
                  try {
                    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, data: effectiveData, history: [], companyName, planId: 'pro' }) });
                    const json = await res.json() as { reply?: string; error?: string };
                    setAiResult(json.reply ?? json.error ?? 'Failed');
                  } catch { setAiResult('Error connecting to AI'); } finally { setAiLoading(false); }
                };

                return (
                  <div className="bg-gradient-to-br from-violet-950/20 to-slate-900/50 border border-violet-800/30 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-violet-800/20">
                      <div className="text-[12px] font-semibold text-slate-100">AI Workflow Automation</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Cut costs and increase output with AI — practical tools for your operations</div>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {tools.map(t => (
                        <button key={t.id} onClick={() => { setActiveAI(activeAI === t.id ? null : t.id); setAiResult(''); setAiInput(''); }}
                          className={`text-left p-3.5 rounded-xl border transition-all ${activeAI === t.id ? 'border-violet-500/50 bg-violet-500/10' : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/50'}`}>
                          <div className="text-base mb-1.5">{t.icon}</div>
                          <div className="text-[11px] font-semibold text-slate-200 mb-1">{t.label}</div>
                          <div className="text-[10px] text-slate-500 leading-relaxed">{t.desc}</div>
                        </button>
                      ))}
                    </div>
                    {activeAI && (
                      <div className="px-4 pb-4 space-y-3">
                        <div className="flex items-center gap-2">
                          {activeAI === 'contract' ? (
                            <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} rows={4}
                              placeholder={tools.find(t => t.id === activeAI)?.inputPlaceholder ?? ''}
                              className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 resize-none"/>
                          ) : (
                            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
                              placeholder={tools.find(t => t.id === activeAI)?.inputPlaceholder ?? ''}
                              className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60"/>
                          )}
                          <button onClick={() => runAI(activeAI)} disabled={aiLoading}
                            className="px-4 py-2 text-[12px] font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl transition-colors flex-shrink-0 self-start">
                            {aiLoading ? <span className="flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Working…</span> : '✦ Run AI'}
                          </button>
                        </div>
                        {aiResult && (
                          <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
                            <pre className="text-[12px] text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">{aiResult}</pre>
                            <button onClick={() => { try { navigator.clipboard.writeText(aiResult); } catch { /* ignore */ } }}
                              className="mt-3 text-[10px] text-slate-600 hover:text-slate-400">Copy →</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          <div className={activeView === 'intelligence' ? 'space-y-6' : 'hidden'}>
              <IntelligenceDashboard weeklyInsight={weeklyInsight} boardDeck={boardDeck} alerts={alerts} loading={loading} onGenerate={runAction} reportTimestamps={reportTimestamps}/>

              {/* ── AI Cross-Module Diagnostics ── */}
              {(() => {
                const [diagnosis, setDiagnosis] = React.useState('');
                const [diagLoading, setDiagLoading] = React.useState(false);
                const [lastRun, setLastRun] = React.useState('');

                const runDiagnosis = async () => {
                  setDiagLoading(true); setDiagnosis('');
                  const f = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n).toLocaleString()}`;
                  const pct = (n: number, d: number) => d > 0 ? `${((n/d)*100).toFixed(1)}%` : '—';

                  // ── FINANCIALS ──────────────────────────────────────────────
                  const rev = effectiveData.revenue.total;
                  const cogs = effectiveData.costs.totalCOGS;
                  const opex = effectiveData.costs.totalOpEx;
                  const gp = rev - cogs; const ebitda = gp - opex;
                  const periods = effectiveData.revenue.byPeriod ?? [];
                  const revTrend = periods.length >= 2
                    ? ((periods[periods.length-1].revenue - periods[periods.length-2].revenue) / Math.max(periods[periods.length-2].revenue, 1) * 100) : null;
                  const revTrend3 = periods.length >= 4
                    ? ((periods.slice(-3).reduce((s,p)=>s+p.revenue,0)/3) - (periods.slice(-6,-3).reduce((s,p)=>s+p.revenue,0)/3)) / Math.max(periods.slice(-6,-3).reduce((s,p)=>s+p.revenue,0)/3, 1) * 100 : null;
                  const gmTrend = periods.length >= 2
                    ? ((periods[periods.length-1].grossProfit ?? 0) / Math.max(periods[periods.length-1].revenue,1)*100) - ((periods[periods.length-2].grossProfit ?? 0) / Math.max(periods[periods.length-2].revenue,1)*100) : null;
                  const costCats = effectiveData.costs.byCategory.map(c => `${c.category}: ${f(c.amount)} (${pct(c.amount,rev)} rev)`).join(' | ');
                  const budgetRevTarget = budget.revenue;
                  const budgetVar = budgetRevTarget ? ((rev - budgetRevTarget) / budgetRevTarget * 100) : null;
                  const budgetedGP = (budget.revenue != null && budget.cogs != null) ? budget.revenue - budget.cogs : null;
                  const budgetedEB = (budgetedGP != null && budget.opex != null) ? budgetedGP - budget.opex : null;
                  const ebitdaVar = budgetedEB ? ((ebitda - budgetedEB) / Math.abs(budgetedEB) * 100) : null;

                  // ── PAYROLL ─────────────────────────────────────────────────
                  const depts = effectiveData.payrollByDept ?? [];
                  const totalPayroll = depts.reduce((s,d)=>s+d.totalCompensation,0);
                  const headcount = effectiveData.operations.headcount ?? depts.reduce((s,d)=>s+d.headcount,0);
                  const topDept = [...depts].sort((a,b)=>b.totalCompensation-a.totalCompensation)[0];
                  const topDeptPct = totalPayroll > 0 && topDept ? ((topDept.totalCompensation/totalPayroll)*100).toFixed(0) : null;
                  const revPerHead = headcount > 0 ? rev / headcount : null;

                  // ── AR & CASH ────────────────────────────────────────────────
                  const arAging = effectiveData.arAging ?? [];
                  const totalAR = arAging.reduce((s,b)=>s+b.total,0);
                  const ar60plus = arAging.reduce((s,b)=>s+b.days60+b.days90+b.over90,0);
                  const ar90plus = arAging.reduce((s,b)=>s+b.days90+b.over90,0);
                  const dso = totalAR > 0 && rev > 0 ? (totalAR/(rev/30)).toFixed(0) : null;
                  const overdueAccounts = arAging.filter(b=>b.days60+b.days90+b.over90>0).map(b=>`${b.customer}: ${f(b.days60+b.days90+b.over90)}`);
                  const apBuckets = (() => { try { const s = localStorage.getItem('bos_ap_aging'); return s ? JSON.parse(s) as {vendor:string;current:number;days30:number;days60:number;days90:number;over90:number}[] : []; } catch { return []; } })();
                  const totalAP = apBuckets.reduce((s,b)=>s+b.current+b.days30+b.days60+b.days90+b.over90,0);
                  const dpo = totalAP > 0 && cogs > 0 ? (totalAP/(cogs/30)).toFixed(0) : null;
                  const ccc = dso && dpo ? (parseFloat(dso) - parseFloat(dpo)).toFixed(0) : null;
                  const cashFlow = effectiveData.cashFlow ?? [];
                  const latestCash = cashFlow.length > 0 ? cashFlow[cashFlow.length-1].closingBalance : null;
                  const cashTrend = cashFlow.length >= 2 ? cashFlow[cashFlow.length-1].closingBalance - cashFlow[cashFlow.length-2].closingBalance : null;

                  // ── CUSTOMERS ────────────────────────────────────────────────
                  const custs = effectiveData.customers;
                  const retention = (custs.retentionRate ?? 0.88) * 100;
                  const churnRate = (1 - (custs.retentionRate ?? 0.88)) * 100;
                  const topCustomers = custs.topCustomers.slice(0, 8).map(c =>
                    `${c.name}: ${pct(c.percentOfTotal,100)} rev (${c.revenueType ?? 'unknown'})${c.industry ? ` [${c.industry}]` : ''}`
                  ).join(' | ');
                  const top3Pct = custs.topCustomers.slice(0,3).reduce((s,c)=>s+c.percentOfTotal,0);
                  const recurringCusts = custs.topCustomers.filter(c=>c.revenueType==='recurring').length;
                  const npsHist = (() => { try { const s = localStorage.getItem('bos_nps_history'); return s ? JSON.parse(s) as {date:string;score:number;note?:string}[] : []; } catch { return []; } })();
                  const latestNPS = custs.nps ?? (npsHist.length > 0 ? npsHist[npsHist.length-1].score : null);
                  const npsTrend = npsHist.length >= 2 ? npsHist[npsHist.length-1].score - npsHist[npsHist.length-2].score : null;

                  // ── CONTRACTS ────────────────────────────────────────────────
                  const contracts = (() => { try { const s = localStorage.getItem('bos_contracts'); return s ? JSON.parse(s) as {customer:string;value:number;renewalDate:string;status:string}[] : []; } catch { return []; } })();
                  const today = new Date();
                  const expiring90 = contracts.filter(c => { const d = new Date(c.renewalDate); return c.status !== 'renewed' && (d.getTime()-today.getTime())/86400000 <= 90; });
                  const atRiskContracts = contracts.filter(c=>c.status==='at-risk');
                  const atRiskVal = atRiskContracts.reduce((s,c)=>s+c.value,0);
                  const expiring90Val = expiring90.reduce((s,c)=>s+c.value,0);

                  // ── CRM PIPELINE ─────────────────────────────────────────────
                  const deals = (() => { try { return JSON.parse(localStorage.getItem('bos_deals') ?? '[]') as {name?:string;stage:string;value:number;probability:number;daysInStage?:number;owner?:string;closeDate?:string}[]; } catch { return []; } })();
                  const activeDls = deals.filter(d=>d.stage!=='Closed Won'&&d.stage!=='Closed Lost');
                  const weighted = activeDls.reduce((s,d)=>s+(d.value*(d.probability/100)),0);
                  const staleDls = activeDls.filter(d=>(d.daysInStage??0)>30);
                  const stageBreakdown = ['Prospect','Qualified','Proposal','Negotiation'].map(st => {
                    const inStage = activeDls.filter(d=>d.stage===st);
                    return inStage.length > 0 ? `${st}: ${inStage.length} (${f(inStage.reduce((s,d)=>s+d.value,0))})` : null;
                  }).filter(Boolean).join(' | ');
                  const closingThisMonth = activeDls.filter(d => d.closeDate && new Date(d.closeDate).getMonth() === today.getMonth() && new Date(d.closeDate).getFullYear() === today.getFullYear());

                  // ── OPERATIONS ───────────────────────────────────────────────
                  const utilization = effectiveData.operations.employeeUtilization ?? effectiveData.operations.utilizationRate ?? effectiveData.operations.capacityUtilization ?? null;
                  const satisfaction: number | null = null;
                  const onTimeDelivery: number | null = null;

                  // ── STRATEGIC / STORED ────────────────────────────────────────
                  const moatScores = (() => { try { const s = localStorage.getItem('bos_moat_scores'); return s ? JSON.parse(s) as Record<string,number> : {}; } catch { return {}; } })();
                  const moatEntries = Object.entries(moatScores);
                  const moatAvg = moatEntries.length > 0 ? moatEntries.reduce((s,[,v])=>s+v,0)/moatEntries.length : null;
                  const moatWeak = moatEntries.filter(([,v])=>v<=4).map(([k])=>k);
                  const moatStrong = moatEntries.filter(([,v])=>v>=8).map(([k])=>k);

                  const exitChecked = (() => { try { const s = localStorage.getItem('bos_exit_readiness'); return s ? JSON.parse(s) as Record<string,boolean> : {}; } catch { return {}; } })();
                  const exitScore = Object.values(exitChecked).filter(Boolean).length;
                  const totalExitItems = 15;

                  const plan100 = (() => { try { const s = localStorage.getItem('bos_100day_plan'); return s ? JSON.parse(s) as {stream:string;done:boolean;day:number}[] : []; } catch { return []; } })();
                  const plan100Done = plan100.filter(t=>t.done).length;
                  const plan100Overdue = plan100.filter(t=>!t.done && t.day < 100).length;

                  const sprint = (() => { try { const s = localStorage.getItem('bos_sprint_board'); return s ? JSON.parse(s) as {quarter:string;initiatives:{title:string;status:string;milestones:{done:boolean}[]}[]} : null; } catch { return null; } })();
                  const sprintAtRisk = sprint?.initiatives.filter(i=>i.status==='at-risk') ?? [];
                  const sprintDone = sprint?.initiatives.filter(i=>i.status==='done') ?? [];

                  const costInits = (() => { try { const s = localStorage.getItem('bos_cost_initiatives'); return s ? JSON.parse(s) as {name:string;status:string;targetSavings:number;actualSavings?:number}[] : []; } catch { return []; } })();
                  const initTarget = costInits.reduce((s,i)=>s+i.targetSavings,0);
                  const initActual = costInits.reduce((s,i)=>s+(i.actualSavings??0),0);
                  const stalledInits = costInits.filter(i=>i.status==='stalled');

                  const execTasks = (() => { try { const s = localStorage.getItem('bos_tasks'); return s ? JSON.parse(s) as {title:string;status?:string;done?:boolean}[] : []; } catch { return []; } })();
                  const openTasks = execTasks.filter(t=>!t.done && t.status !== 'done');

                  const ceoNotes = (() => {
                    try {
                      const s = localStorage.getItem('bos_ceo_notes');
                      if (!s) return null;
                      const parsed = JSON.parse(s) as {date:string;text:string}[];
                      return parsed.slice(-3).map(n=>`[${n.date}] ${n.text}`).join(' | ');
                    } catch { return null; }
                  })();

                  const dataroom = (() => { try { const s = localStorage.getItem('bos_dataroom_checklist'); return s ? JSON.parse(s) as Record<string,boolean> : {}; } catch { return {}; } })();
                  const dataroomDone = Object.values(dataroom).filter(Boolean).length;

                  // ── BUILD FULL CONTEXT ────────────────────────────────────────
                  const ctx = `
COMPLETE BUSINESS DIAGNOSTIC — ${companyName || 'This Business'} — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}

═══ FINANCIALS ═══
P&L: Revenue ${f(rev)} | COGS ${f(cogs)} (${pct(cogs,rev)}) | Gross Profit ${f(gp)} (${pct(gp,rev)} GM) | OpEx ${f(opex)} | EBITDA ${f(ebitda)} (${pct(ebitda,rev)})
Cost breakdown: ${costCats}
Revenue trend: ${revTrend !== null ? `${revTrend>=0?'+':''}${revTrend.toFixed(1)}% last period` : 'no trend data'} | 3-period avg trend: ${revTrend3 !== null ? `${revTrend3>=0?'+':''}${revTrend3.toFixed(1)}%` : 'N/A'}
Gross margin trend: ${gmTrend !== null ? `${gmTrend>=0?'+':''}${gmTrend.toFixed(1)}pp` : 'N/A'}
${periods.length > 0 ? `Period history: ${periods.slice(-6).map(p=>`${p.period}: ${f(p.revenue)}`).join(' → ')}` : ''}
${budgetVar !== null ? `Budget vs Actual: Revenue ${budgetVar>=0?'+':''}${budgetVar.toFixed(1)}%${ebitdaVar !== null ? ` | EBITDA ${ebitdaVar>=0?'+':''}${ebitdaVar.toFixed(1)}%` : ''}` : 'No budget set'}
Payroll: ${f(totalPayroll)} (${pct(totalPayroll,rev)} revenue) | ${headcount} headcount | Rev/employee: ${revPerHead ? f(revPerHead) : 'N/A'}
${topDept && topDeptPct ? `Top dept: ${topDept.department} = ${topDeptPct}% of payroll (${topDept.headcount} people, ${f(topDept.totalCompensation)})` : ''}
${depts.length > 0 ? `Dept breakdown: ${depts.map(d=>`${d.department}: ${f(d.totalCompensation)} (${d.headcount} hc)`).join(' | ')}` : ''}

═══ CASH & WORKING CAPITAL ═══
AR: ${f(totalAR)} total | 60+ days overdue: ${f(ar60plus)} | 90+ days: ${f(ar90plus)} | DSO: ${dso ?? 'N/A'} days
${overdueAccounts.length > 0 ? `Overdue accounts: ${overdueAccounts.join(' | ')}` : ''}
AP: ${f(totalAP)} | DPO: ${dpo ?? 'N/A'} days
Cash Conversion Cycle: ${ccc ?? 'N/A'} days
${latestCash !== null ? `Cash balance: ${f(latestCash)} | Trend: ${cashTrend !== null ? (cashTrend>=0?'+':'')+f(cashTrend)+' period-over-period' : 'N/A'}` : ''}

═══ CUSTOMERS ═══
${custs.totalCount} total | +${custs.newThisPeriod} new | -${custs.churned} churned | ${retention.toFixed(1)}% retention (${churnRate.toFixed(1)}% churn)
Top 3 concentration: ${top3Pct.toFixed(1)}% of revenue | Recurring customers: ${recurringCusts}/${custs.topCustomers.length}
Customer breakdown: ${topCustomers}
${latestNPS !== null ? `NPS: ${latestNPS>0?'+':''}${latestNPS}${npsTrend !== null ? ` (${npsTrend>=0?'+':''}${npsTrend} trend)` : ''}` : ''}
${satisfaction !== null ? `Customer satisfaction: ${satisfaction}` : ''}
Contracts: ${contracts.length} tracked | At-risk: ${atRiskContracts.length} (${f(atRiskVal)}/yr) | Expiring in 90 days: ${expiring90.length} (${f(expiring90Val)}/yr)
${expiring90.length > 0 ? `Expiring: ${expiring90.map(c=>`${c.customer} ${c.renewalDate}`).join(' | ')}` : ''}

═══ CRM PIPELINE ═══
${activeDls.length} active deals | Weighted pipeline: ${f(weighted)}
Stage breakdown: ${stageBreakdown || 'no stage data'}
Stale (30+ days): ${staleDls.length} deals${staleDls.length > 0 ? ` — ${staleDls.slice(0,3).map(d=>d.name||'unnamed').join(', ')}` : ''}
Closing this month: ${closingThisMonth.length} deals (${f(closingThisMonth.reduce((s,d)=>s+d.value,0))})

═══ OPERATIONS ═══
${utilization !== null ? `Utilization: ${(utilization*100).toFixed(0)}%` : ''}
${onTimeDelivery !== null ? `On-time delivery: ${(onTimeDelivery*100).toFixed(0)}%` : ''}

═══ STRATEGIC ═══
Competitive moat: ${moatAvg !== null ? `${moatAvg.toFixed(1)}/10 avg (${moatEntries.length} dimensions)${moatWeak.length>0?` | Weak: ${moatWeak.join(', ')}`:''} ${moatStrong.length>0?`| Strong: ${moatStrong.join(', ')}` : ''}` : 'not assessed'}
Exit readiness: ${exitScore}/${totalExitItems} items complete (${Math.round(exitScore/totalExitItems*100)}%)
100-day plan: ${plan100Done}/${plan100.length} complete | ${plan100Overdue} overdue
Sprint board: ${sprint ? `${sprint.quarter} — ${sprint.initiatives.length} initiatives, ${sprintAtRisk.length} at-risk, ${sprintDone.length} done` : 'not set up'}
${sprintAtRisk.length > 0 ? `At-risk initiatives: ${sprintAtRisk.map(i=>i.title).join(' | ')}` : ''}
Cost reduction initiatives: ${costInits.length} total | ${f(initTarget)} targeted | ${f(initActual)} realized${stalledInits.length>0?` | ${stalledInits.length} stalled: ${stalledInits.map(i=>i.name).join(', ')}`:''}
Data room: ${dataroomDone}/19 items ready
Open execute tasks: ${openTasks.length}
${ceoNotes ? `CEO Notes (recent): ${ceoNotes}` : ''}
`.trim();

                  const prompt = `${ctx}

You are the best operating partner in the world. You have just received a COMPLETE data dump from every module of this business's intelligence dashboard. Your job is to find the non-obvious connections — patterns that only appear when you look across Financial + Customers + CRM + Operations + Strategic data simultaneously.

Produce a structured diagnostic in EXACTLY this format. Be brutally specific. Every bullet must cite data from at least 2 different modules. Use actual numbers from the data above:

🔴 CRITICAL RISKS — 3 bullets max. Each must connect multiple modules. Format: "[Module A] shows X AND [Module B] shows Y → combined risk is Z with estimated $ impact"

🟡 HIDDEN OPPORTUNITIES — 3 bullets max. Cross-module signals pointing to upside the operator may be missing.

⚡ QUICK WINS THIS MONTH — 3 specific actions, each with an estimated $ impact or time saved. Name the exact action, not a category.

📊 WATCH LIST — 3 leading indicators that aren't problems yet but could become one in 60–90 days.

🔗 CONNECT THE DOTS — 2 non-obvious correlations between data streams that a human looking at individual tabs would never see. This is your most important section.`;

                  try {
                    const res = await fetch('/api/chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: prompt, data: effectiveData, history: [], companyName, planId: 'pro', activeView: 'intelligence', maxTokens: 2000 })
                    });
                    const json = await res.json() as { reply?: string; error?: string };
                    setDiagnosis(json.reply ?? json.error ?? 'Failed');
                    setLastRun(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
                  } catch { setDiagnosis('Error connecting to AI'); } finally { setDiagLoading(false); }
                };

                return (
                  <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-violet-950/30 border border-indigo-700/30 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-indigo-700/20 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"/>
                          <div className="text-[13px] font-semibold text-slate-100">AI Cross-Module Diagnostics</div>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">Reads every module simultaneously — surfaces risks and opportunities that only appear when you connect the dots across Financial, CRM, Customers, Operations, and Strategic data</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {lastRun && <div className="text-[10px] text-slate-600">Last run: {lastRun}</div>}
                        <button onClick={runDiagnosis} disabled={diagLoading}
                          className="flex items-center gap-2 px-5 py-2.5 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-colors">
                          {diagLoading
                            ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Analyzing all modules…</>
                            : '✦ Run Full Diagnostic'}
                        </button>
                      </div>
                    </div>

                    {!diagnosis && !diagLoading && (
                      <div className="px-5 py-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Financial', items: ['P&L', 'EBITDA Bridge', 'AR Aging', 'Budget vs Actual'] },
                          { label: 'Customers', items: ['Health Scores', 'Retention', 'NPS', 'Contracts at Risk'] },
                          { label: 'CRM', items: ['Pipeline', 'Stale Deals', 'Win Rate', 'Weighted Value'] },
                          { label: 'Strategic', items: ['Moat Score', 'Cost Initiatives', 'Payroll %', 'Trends'] },
                        ].map(m => (
                          <div key={m.label} className="bg-slate-800/30 rounded-xl p-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-2">{m.label}</div>
                            {m.items.map(item => (
                              <div key={item} className="flex items-center gap-1.5 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 flex-shrink-0"/>
                                <div className="text-[10px] text-slate-500">{item}</div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {diagLoading && (
                      <div className="px-5 py-8 flex flex-col items-center gap-3">
                        <div className="flex gap-1.5">
                          {['Financial', 'Customers', 'CRM', 'Operations', 'Strategic'].map((m, i) => (
                            <div key={m} className="text-[10px] text-indigo-400/60 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }}>{m}</div>
                          ))}
                        </div>
                        <div className="text-[11px] text-slate-500">Cross-referencing all modules…</div>
                      </div>
                    )}

                    {diagnosis && (
                      <div className="px-5 py-5">
                        <div className="bg-slate-900/60 rounded-xl p-5">
                          <pre className="text-[13px] text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">{diagnosis}</pre>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <button onClick={runDiagnosis} disabled={diagLoading}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">↺ Re-run diagnostic</button>
                          <button onClick={() => { try { navigator.clipboard.writeText(diagnosis); } catch { /* ignore */ } }}
                            className="text-[10px] text-slate-600 hover:text-slate-400">Copy to clipboard →</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Weekly Digest Email Subscription ── */}
              {(() => {
                const [digestEmail, setDigestEmail] = React.useState(() => {
                  try { return localStorage.getItem('bos_digest_email') ?? ''; } catch { return ''; }
                });
                const [digestFreq, setDigestFreq] = React.useState<'daily'|'weekly'>(() => {
                  try { return (localStorage.getItem('bos_digest_freq') as 'daily'|'weekly') ?? 'weekly'; } catch { return 'weekly'; }
                });
                const [digestSaved, setDigestSaved] = React.useState(false);

                const saveDigest = () => {
                  try {
                    localStorage.setItem('bos_digest_email', digestEmail);
                    localStorage.setItem('bos_digest_freq', digestFreq);
                  } catch { /* ignore */ }
                  setDigestSaved(true);
                  setTimeout(() => setDigestSaved(false), 2500);
                };

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-slate-100 mb-0.5">Weekly AI Digest</div>
                        <div className="text-[11px] text-slate-500 leading-relaxed">
                          Get your AI-generated business brief delivered by email — P&L summary, top risks, deals to action, and the week ahead.
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {['daily','weekly'].map(f => (
                          <button key={f} onClick={() => setDigestFreq(f as 'daily'|'weekly')}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors capitalize ${digestFreq === f ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <input
                        type="email"
                        placeholder={authEmail || 'your@email.com'}
                        value={digestEmail}
                        onChange={e => setDigestEmail(e.target.value)}
                        className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
                      />
                      <button
                        onClick={saveDigest}
                        disabled={!digestEmail && !authEmail}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[12px] font-semibold rounded-xl transition-colors flex-shrink-0">
                        {digestSaved ? '✓ Saved' : 'Subscribe'}
                      </button>
                    </div>
                    {digestEmail && (
                      <div className="mt-2 text-[10px] text-slate-600">
                        Digest will be sent to <span className="text-slate-400">{digestEmail}</span> · {digestFreq === 'daily' ? 'Every morning at 7am' : 'Every Monday at 7am'}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Competitive Moat Self-Assessment ── */}
              {(() => {
                const MOAT_KEY = 'bos_moat_scores';
                type MoatQ = { id: string; label: string; hint: string; weight: number };
                const questions: MoatQ[] = [
                  { id: 'switching',  label: 'Switching Costs',        hint: 'How hard is it for customers to leave? (contracts, integrations, data lock-in)', weight: 1.5 },
                  { id: 'pricing',    label: 'Pricing Power',          hint: 'Can you raise prices without losing customers?', weight: 1.2 },
                  { id: 'recurring',  label: 'Recurring Revenue',      hint: 'What % of revenue is contractual / subscription-based?', weight: 1.3 },
                  { id: 'lockin',     label: 'Customer Lock-in',       hint: 'Do customers rely on you as a core workflow?', weight: 1.2 },
                  { id: 'regulatory', label: 'Regulatory / Scale Moat',hint: 'Are there licenses, scale advantages, or regulatory barriers to entry?', weight: 1.0 },
                  { id: 'brand',      label: 'Brand & Reputation',     hint: 'Would customers choose you at a premium over a cheaper alternative?', weight: 1.0 },
                  { id: 'ip',         label: 'IP / Proprietary Process',hint: 'Do you have unique processes, tools, or knowledge competitors can\'t replicate?', weight: 1.1 },
                ];

                const [scores, setScores] = React.useState<Record<string, number>>(() => {
                  try { const s = localStorage.getItem(MOAT_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
                });
                const [saved, setMoatSaved] = React.useState(false);

                const setScore = (id: string, val: number) => setScores(prev => ({ ...prev, [id]: val }));
                const saveScores = () => {
                  try { localStorage.setItem(MOAT_KEY, JSON.stringify(scores)); } catch { /* ignore */ }
                  setMoatSaved(true); setTimeout(() => setMoatSaved(false), 2500);
                };

                const answeredCount = Object.keys(scores).length;
                const totalWeight = questions.reduce((s, q) => s + q.weight, 0);
                const weightedScore = answeredCount >= 3
                  ? questions.reduce((s, q) => s + (scores[q.id] ?? 0) * q.weight, 0) / totalWeight * 10
                  : null;
                const moatLabel = weightedScore === null ? null :
                  weightedScore >= 8 ? 'Wide Moat' : weightedScore >= 6 ? 'Narrow Moat' : weightedScore >= 4 ? 'Emerging Moat' : 'Weak Moat';
                const moatColor = weightedScore === null ? 'text-slate-400' :
                  weightedScore >= 8 ? 'text-emerald-400' : weightedScore >= 6 ? 'text-sky-400' : weightedScore >= 4 ? 'text-amber-400' : 'text-red-400';
                const narrative = weightedScore === null ? null :
                  weightedScore >= 8 ? 'Your business has strong structural advantages that protect margins and create durable cash flows — a premium M&A multiple is well-supported.' :
                  weightedScore >= 6 ? 'Solid moat with a few vulnerabilities. Focus on reinforcing switching costs and recurring revenue to widen it.' :
                  weightedScore >= 4 ? 'Some defensive characteristics exist but the business is still exposed to competitive pressure. Prioritize lock-in and pricing power.' :
                  'Limited structural moat — the business competes primarily on price or relationships. Consider how to add stickier revenue or proprietary value.';

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Competitive Moat Self-Assessment</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Rate 1–10 · Weighted moat score · M&A valuation context</div>
                      </div>
                      {weightedScore !== null && (
                        <div className="text-right">
                          <div className={`text-[22px] font-bold tabular-nums ${moatColor}`}>{weightedScore.toFixed(1)}</div>
                          <div className={`text-[10px] font-semibold ${moatColor}`}>{moatLabel}</div>
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      {questions.map(q => (
                        <div key={q.id}>
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="text-[12px] font-medium text-slate-300">{q.label}</span>
                              <span className="text-[10px] text-slate-600 ml-2">{q.hint}</span>
                            </div>
                            <span className={`text-[13px] font-bold w-6 text-right ${scores[q.id] >= 8 ? 'text-emerald-400' : scores[q.id] >= 5 ? 'text-amber-400' : scores[q.id] ? 'text-red-400' : 'text-slate-700'}`}>
                              {scores[q.id] ?? '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <button key={n} onClick={() => setScore(q.id, n)}
                                className={`flex-1 h-5 rounded text-[9px] font-bold transition-all ${scores[q.id] === n ? 'bg-indigo-500 text-white' : scores[q.id] >= n ? 'bg-indigo-500/30 text-indigo-400' : 'bg-slate-800/60 text-slate-700 hover:bg-slate-700/60'}`}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {narrative && (
                        <div className={`mt-2 p-3 rounded-lg border text-[11px] leading-relaxed ${moatColor === 'text-emerald-400' ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-300/80' : moatColor === 'text-sky-400' ? 'bg-sky-500/5 border-sky-500/15 text-sky-300/80' : moatColor === 'text-amber-400' ? 'bg-amber-500/5 border-amber-500/15 text-amber-300/80' : 'bg-red-500/5 border-red-500/15 text-red-300/80'}`}>
                          {narrative}
                        </div>
                      )}
                      <div className="flex justify-end pt-1">
                        <button onClick={saveScores}
                          className="px-4 py-2 text-[12px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/40 text-indigo-300 rounded-lg transition-colors">
                          {saved ? '✓ Saved' : 'Save Assessment'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Investor Update Drafter (uses component-level state) ── */}
              {(() => {
                // investorDraft, setInvestorDraft, investorDraftLoading, setInvestorDraftLoading, investorAudience, setInvestorAudience — lifted to component level
                const updateDraft = investorDraft; const setUpdateDraft = setInvestorDraft;
                const updateLoading = investorDraftLoading; const setUpdateLoading = setInvestorDraftLoading;
                const audience = investorAudience; const setAudience = setInvestorAudience;

                const audienceOptions: { id: 'lp'|'board'|'pe'; label: string }[] = [
                  { id: 'board', label: 'Board of Directors' },
                  { id: 'lp', label: 'LP / Investors' },
                  { id: 'pe', label: 'PE Sponsor' },
                ];

                const draft = async () => {
                  setUpdateLoading(true); setUpdateDraft('');
                  const rev = effectiveData.revenue.total;
                  const cogs = effectiveData.costs.totalCOGS;
                  const opex = effectiveData.costs.totalOpEx;
                  const ebitda = rev - cogs - opex;
                  const gm = rev > 0 ? ((rev-cogs)/rev*100).toFixed(1) : 'N/A';
                  const f = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n)}`;
                  const prevRevs = effectiveData.revenue.byPeriod.slice(-4);
                  const trendStr = prevRevs.map(p => `${p.period}: ${f(p.revenue)}`).join(' → ');

                  const sprintData = (() => { try { const s = localStorage.getItem('bos_sprint_board'); return s ? JSON.parse(s) as {initiatives:{title:string;status:string}[]} : null; } catch { return null; } })();
                  const initiatives = sprintData?.initiatives.slice(0,3).map(i => `${i.title} (${i.status})`).join('; ') ?? 'none tracked';

                  const moatScores = (() => { try { const s = localStorage.getItem('bos_moat_scores'); return s ? JSON.parse(s) as Record<string,number> : {}; } catch { return {}; } })();
                  const moatAvg = Object.values(moatScores).length > 0 ? (Object.values(moatScores).reduce((a,b)=>a+b,0)/Object.values(moatScores).length).toFixed(1) : 'N/A';

                  const audienceLabel = audience === 'lp' ? 'limited partner / investor email' : audience === 'board' ? 'board of directors update memo' : 'PE sponsor operating update';
                  const ebitdaPct = rev > 0 ? ((ebitda/rev)*100).toFixed(1) : 'N/A';
                  const topCust = effectiveData.customers.topCustomers[0];
                  const concentration = topCust ? ` Top customer ${topCust.name} at ${topCust.percentOfTotal.toFixed(1)}% of revenue.` : '';

                  const prompt = `You are a sharp CFO writing a ${audienceLabel} for ${companyName ?? 'this company'}. Write like a seasoned operator — direct, numbers-first, no corporate filler. Investors have seen a hundred of these. Make yours land.

BUSINESS DATA:
Revenue: ${f(rev)} | Gross Margin: ${gm}% | EBITDA: ${f(ebitda)} (${ebitdaPct}% margin)
Customers: ${effectiveData.customers.totalCount} total | +${effectiveData.customers.newThisPeriod} new | -${effectiveData.customers.churned} churned | ${((effectiveData.customers.retentionRate ?? 0.88)*100).toFixed(1)}% retention${concentration}
Revenue trend: ${trendStr}
${moatAvg !== 'N/A' ? `Competitive moat score: ${moatAvg}/10` : ''}
${initiatives !== 'none tracked' ? `Initiatives in flight: ${initiatives}` : ''}

WRITE THIS EXACT FORMAT (no deviations):

SUBJECT: [One punchy subject line — lead with a number or outcome]

[Company name] — [Month/Period] Update

[ONE bold opening sentence: the single most important thing that happened. Start with a number.]

📊 THE NUMBERS
• [Metric]: [Value] — [1-sentence "so what"]
• [Metric]: [Value] — [1-sentence "so what"]
• [Metric]: [Value] — [1-sentence "so what"]

✅ WHAT'S WORKING
• [Specific win with numbers]
• [Specific win with numbers]

⚠️ WHERE WE'RE FOCUSED
• [Honest challenge + what you're doing about it — be specific]

🎯 NEXT 30 DAYS
• [Specific deliverable — owner, outcome, deadline]
• [Specific deliverable]

[1-sentence close: forward momentum or specific ask]

Rules: Every bullet has a number. No "we are pleased to report." No "it is worth noting." Speak like you own the outcome. ${audience === 'pe' ? 'PE sponsors want EBITDA trajectory and covenant headroom front and center.' : audience === 'lp' ? 'LPs want IRR trajectory and capital efficiency signals.' : 'Board members want decisions to make, not status updates.'} 250 words max.`;
                  try {
                    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: prompt, data: effectiveData, companyName, planId: 'pro', maxTokens: 800 }) });
                    const j = await r.json() as { reply?: string };
                    setUpdateDraft(j.reply ?? '');
                  } catch { setUpdateDraft('Error — check API key.'); }
                  setUpdateLoading(false);
                };

                const copyToClipboard = () => { if (updateDraft) { void navigator.clipboard.writeText(updateDraft); } };

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Investor Update Drafter</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">AI writes your monthly investor / board update email from live data</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded-lg overflow-hidden border border-slate-700/40 text-[11px]">
                          {audienceOptions.map(o => (
                            <button key={o.id} onClick={() => setAudience(o.id)}
                              className={`px-3 py-1.5 transition-colors ${audience === o.id ? 'bg-indigo-600/30 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={draft} disabled={updateLoading}
                          className="text-[11px] px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/40 text-indigo-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          {updateLoading ? 'Drafting…' : 'Draft Update →'}
                        </button>
                      </div>
                    </div>
                    {updateDraft && (
                      <div className="p-5">
                        <div className="bg-slate-800/40 border border-slate-700/30 rounded-lg p-4 text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">{updateDraft}</div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={copyToClipboard}
                            className="text-[11px] px-3 py-1.5 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/40 text-slate-300 rounded-lg transition-colors">
                            Copy to Clipboard
                          </button>
                          <button onClick={draft}
                            className="text-[11px] px-3 py-1.5 text-slate-500 hover:text-slate-300 transition-colors">
                            Regenerate
                          </button>
                        </div>
                      </div>
                    )}
                    {!updateDraft && !updateLoading && (
                      <div className="px-5 py-8 text-center text-[11px] text-slate-600">Select audience and click Draft Update — pulls live financial data automatically</div>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-800/60"/>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em]">AI Advisory Agents</div>
                <div className="h-px flex-1 bg-slate-800/60"/>
              </div>
              <AgentPanel data={data} previousData={prevSnapshot?.data ?? PREV_DEMO} companyName={companyName} companyProfile={companyProfile}/>
            </div>
          <div className={activeView === 'scenarios' ? 'space-y-4' : 'hidden'}>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-amber-500/10"/>
                <SectionNote noteKey="scenarios" notes={panelNotes} onSave={setPanelNote}/>
                <div className="h-px flex-1 bg-amber-500/10"/>
              </div>
              <ScenarioModeler
                data={data}
                onAskAI={openChat}
                onScenarioChange={s => setScenarioAdj(s && (s.revenueGrowthPct !== 0 || s.grossMarginPct !== 0 || s.opexChangePct !== 0 || s.newHires !== 0 || s.priceIncreasePct !== 0 || (s.newCustomers ?? 0) !== 0 || (s.churnRatePct ?? 0) !== 0 || (s.oneTimeExpense ?? 0) !== 0) ? { ...s, newCustomers: s.newCustomers ?? 0, churnRatePct: s.churnRatePct ?? 0, oneTimeExpense: s.oneTimeExpense ?? 0 } : null)}
              />

              {/* ── Sensitivity / Stress Test Grid ── */}
              {(() => {
                const rev = effectiveData.revenue.total;
                const cogs = effectiveData.costs.totalCOGS;
                const opex = effectiveData.costs.totalOpEx;
                const baseEBITDA = rev - cogs - opex;
                const baseGM = rev > 0 ? (rev - cogs) / rev : 0.5;
                const f = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n)}`;
                const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n*100).toFixed(1)}%`;

                const revDeltas = [-0.30, -0.20, -0.10, 0, 0.10, 0.20, 0.30];
                const marginDeltas = [-0.10, -0.05, 0, 0.05, 0.10];

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50">
                      <div className="text-[12px] font-semibold text-slate-100">Sensitivity / Stress Test</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">EBITDA at revenue and gross margin scenarios · green = expansion, red = contraction</div>
                    </div>
                    <div className="p-5 overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse min-w-[500px]">
                        <thead>
                          <tr>
                            <th className="text-left text-slate-600 pb-2 pr-4 font-medium">GM Δ \ Rev Δ</th>
                            {revDeltas.map(rd => (
                              <th key={rd} className={`text-center pb-2 px-2 font-medium ${rd < 0 ? 'text-red-400' : rd > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {pct(rd)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {marginDeltas.map(md => (
                            <tr key={md} className="border-t border-slate-800/40">
                              <td className={`py-2 pr-4 font-medium ${md < 0 ? 'text-red-400' : md > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {pct(md)}
                              </td>
                              {revDeltas.map(rd => {
                                const newRev = rev * (1 + rd);
                                const newGM = Math.max(0, baseGM + md);
                                const newCOGS = newRev * (1 - newGM);
                                const newEBITDA = newRev - newCOGS - opex;
                                const isBase = rd === 0 && md === 0;
                                const isNeg = newEBITDA < 0;
                                const isWorse = newEBITDA < baseEBITDA;
                                const bgCls = isBase ? 'bg-indigo-500/20 text-indigo-300 font-bold' :
                                              isNeg ? 'bg-red-500/20 text-red-400' :
                                              isWorse ? 'bg-amber-500/10 text-amber-400' :
                                              'bg-emerald-500/10 text-emerald-400';
                                return (
                                  <td key={rd} className={`text-center py-2 px-2 rounded ${bgCls}`}>
                                    {f(newEBITDA)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-600">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-500/40 inline-block"/>Base case ({f(baseEBITDA)})</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/20 inline-block"/>Expansion</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/10 inline-block"/>Contraction</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/20 inline-block"/>EBITDA negative</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          <div className={activeView === 'pipeline' ? 'space-y-4' : 'hidden'}>
              {/* ── Pipeline Velocity & Analytics ── */}
              {(() => {
                type LocalDeal = { id: string; name: string; company: string; value: number; stage: string; probability: number; closeDate?: string; owner?: string; createdAt: string; updatedAt: string; source?: string; lostReason?: string };
                let deals: LocalDeal[] = [];
                try { const s = localStorage.getItem('bos_deals'); if (s) deals = JSON.parse(s); } catch { /* ignore */ }
                if (!deals.length) return null;

                const STAGE_ORDER = ['lead','qualified','proposal','negotiation','closed-won','closed-lost'];
                const STAGE_LABEL: Record<string, string> = { lead:'Lead', qualified:'Qualified', proposal:'Proposal', negotiation:'Negotiation', 'closed-won':'Closed Won', 'closed-lost':'Closed Lost' };
                const active = deals.filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost');
                const won    = deals.filter(d => d.stage === 'closed-won');
                const lost   = deals.filter(d => d.stage === 'closed-lost');
                const total  = won.length + lost.length;
                const winRate = total > 0 ? (won.length / total) * 100 : 0;
                const avgDealSize = won.length > 0 ? won.reduce((s,d) => s + d.value, 0) / won.length : 0;
                const totalPipelineVal = active.reduce((s,d) => s + d.value * (d.probability / 100), 0);
                const fmtV = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${Math.round(n).toLocaleString()}`;

                // Avg days in each active stage (approx from updatedAt)
                const byStage = STAGE_ORDER.slice(0, 4).map(s => {
                  const inStage = active.filter(d => d.stage === s);
                  const avgDays = inStage.length > 0
                    ? inStage.reduce((acc, d) => acc + Math.max(0, Math.round((Date.now() - new Date(d.updatedAt).getTime()) / 86400000)), 0) / inStage.length
                    : 0;
                  const stageVal = inStage.reduce((acc, d) => acc + d.value, 0);
                  return { stage: s, label: STAGE_LABEL[s], count: inStage.length, avgDays: Math.round(avgDays), value: stageVal };
                });

                // Source breakdown of won deals
                const sourceMap: Record<string, number> = {};
                won.forEach(d => { const src = d.source ?? 'unknown'; sourceMap[src] = (sourceMap[src] ?? 0) + 1; });
                const sources = Object.entries(sourceMap).sort((a,b) => b[1]-a[1]);

                // Lost reasons
                const lostReasons = lost.filter(d => d.lostReason).map(d => d.lostReason!).slice(0, 3);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Funnel metrics */}
                    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 space-y-4">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Pipeline Velocity</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Active deals by stage · avg days · weighted value</div>
                      </div>
                      <div className="space-y-3">
                        {byStage.map((s, i) => {
                          const maxCount = Math.max(...byStage.map(x => x.count), 1);
                          const barW = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                          return (
                            <div key={s.stage}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold text-slate-500 w-4">{i+1}</span>
                                  <span className="text-[12px] font-medium text-slate-300">{s.label}</span>
                                  <span className="text-[10px] text-slate-600">{s.count} deal{s.count !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px]">
                                  {s.avgDays > 0 && <span className={`${s.avgDays > 21 ? 'text-amber-400' : 'text-slate-500'}`}>{s.avgDays}d avg</span>}
                                  <span className="font-semibold text-slate-300">{fmtV(s.value)}</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-sky-500/60 rounded-full transition-all" style={{ width: `${barW}%` }}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/40">
                        {[
                          { label: 'Win Rate',      value: `${winRate.toFixed(0)}%`,  color: winRate >= 30 ? 'text-emerald-400' : 'text-amber-400' },
                          { label: 'Avg Deal Size', value: fmtV(avgDealSize),          color: 'text-slate-200' },
                          { label: 'Wtd Pipeline',  value: fmtV(totalPipelineVal),     color: 'text-sky-300' },
                        ].map(m => (
                          <div key={m.label} className="text-center">
                            <div className={`text-[16px] font-bold ${m.color}`}>{m.value}</div>
                            <div className="text-[9px] text-slate-600 mt-0.5 uppercase tracking-wide">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Win/Loss analysis */}
                    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 space-y-4">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Win / Loss Analysis</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{won.length} won · {lost.length} lost · {active.length} active</div>
                      </div>
                      {/* Win/loss bar */}
                      <div>
                        <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden">
                          {total > 0 ? <>
                            <div className="h-full bg-emerald-500/60 rounded-l-full transition-all" style={{ width: `${winRate}%` }}/>
                            <div className="h-full bg-red-500/40 rounded-r-full transition-all" style={{ width: `${100 - winRate}%` }}/>
                          </> : <div className="h-full w-full bg-slate-800 rounded-full"/>}
                        </div>
                        <div className="flex justify-between text-[10px] mt-1">
                          <span className="text-emerald-400">{won.length} won ({winRate.toFixed(0)}%)</span>
                          <span className="text-red-400">{lost.length} lost ({(100-winRate).toFixed(0)}%)</span>
                        </div>
                      </div>
                      {/* Won by source */}
                      {sources.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Won by Source</div>
                          <div className="space-y-1.5">
                            {sources.map(([src, count]) => (
                              <div key={src} className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 capitalize">{src.replace(/-/g,' ')}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500/50 rounded-full" style={{ width: `${(count / won.length) * 100}%` }}/>
                                  </div>
                                  <span className="text-slate-500 w-4 text-right">{count}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Lost reasons */}
                      {lostReasons.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2">Recent Lost Reasons</div>
                          <div className="space-y-1">
                            {lostReasons.map((r, i) => (
                              <div key={i} className="text-[11px] text-slate-500 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-1.5 leading-relaxed">· {r}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Referral Source ROI ── */}
              {(() => {
                type LocalDeal = { id: string; name: string; value: number; stage: string; source?: string; probability: number };
                let deals: LocalDeal[] = [];
                try { const s = localStorage.getItem('bos_deals'); if (s) deals = JSON.parse(s); } catch { /* ignore */ }
                if (!deals.length) return null;

                const fmtV = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${Math.round(n)}`;
                const won  = deals.filter(d => d.stage === 'closed-won');
                const lost = deals.filter(d => d.stage === 'closed-lost');
                const all  = [...won, ...lost];
                if (all.length === 0) return null;

                const sources = Array.from(new Set(all.map(d => d.source ?? 'unknown')));
                const bySource = sources.map(src => {
                  const srcWon  = won.filter(d => (d.source ?? 'unknown') === src);
                  const srcLost = lost.filter(d => (d.source ?? 'unknown') === src);
                  const srcAll  = [...srcWon, ...srcLost];
                  const wonValue = srcWon.reduce((s,d) => s+d.value, 0);
                  const avgSize  = srcWon.length > 0 ? wonValue / srcWon.length : 0;
                  const winRate  = srcAll.length > 0 ? (srcWon.length / srcAll.length) * 100 : 0;
                  return { source: src, wonDeals: srcWon.length, lostDeals: srcLost.length, wonValue, avgSize, winRate, total: srcAll.length };
                }).sort((a,b) => b.wonValue - a.wonValue);

                const maxValue = Math.max(...bySource.map(s => s.wonValue), 1);

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50">
                      <div className="text-[12px] font-semibold text-slate-100">Referral Source ROI</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Closed-won value, avg deal size, and win rate by source</div>
                    </div>
                    <div className="divide-y divide-slate-800/40">
                      {bySource.map((s, i) => (
                        <div key={s.source} className="px-5 py-3.5 flex items-center gap-4">
                          <div className="w-5 text-[11px] font-bold text-slate-600 flex-shrink-0">{i+1}</div>
                          <div className="w-24 flex-shrink-0">
                            <div className="text-[12px] font-semibold text-slate-300 capitalize">{s.source.replace(/-/g,' ')}</div>
                            <div className="text-[10px] text-slate-600 mt-0.5">{s.wonDeals}W · {s.lostDeals}L · {s.total} total</div>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-indigo-500/60 rounded-full" style={{ width: `${(s.wonValue / maxValue) * 100}%` }}/>
                            </div>
                            <div className="text-[10px] text-slate-600">avg {fmtV(s.avgSize)}/deal</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[14px] font-bold text-slate-200">{fmtV(s.wonValue)}</div>
                            <div className={`text-[10px] font-semibold ${s.winRate >= 50 ? 'text-emerald-400' : s.winRate >= 30 ? 'text-amber-400' : 'text-red-400'}`}>{s.winRate.toFixed(0)}% win rate</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-5 py-3 border-t border-slate-800/40 text-[10px] text-slate-600">
                      Double down on the source with the highest value × win rate combination — that's your most efficient growth channel
                    </div>
                  </div>
                );
              })()}

              {/* ── Sales Velocity Calculator ── */}
              {(() => {
                let deals: { id: string; value: number; stage: string; probability: number; createdAt: string; updatedAt: string }[] = [];
                try { const s = localStorage.getItem('bos_deals'); if (s) deals = JSON.parse(s); } catch { /* ignore */ }
                if (!deals.length) return null;

                const won = deals.filter(d => d.stage === 'closed-won');
                const lost = deals.filter(d => d.stage === 'closed-lost');
                const active = deals.filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost');
                const total = won.length + lost.length;
                const winRate = total > 0 ? won.length / total : 0;
                const avgDealSize = won.length > 0 ? won.reduce((s,d)=>s+d.value,0)/won.length : 0;

                // Avg sales cycle: days from createdAt to updatedAt for won deals
                const avgCycleDays = won.length > 0
                  ? won.reduce((s,d) => s + Math.max(1, Math.round((new Date(d.updatedAt).getTime()-new Date(d.createdAt).getTime())/86400000)), 0) / won.length
                  : 30;

                // Sales Velocity = (# active deals × win rate × avg deal size) / avg cycle days
                const velocity = avgCycleDays > 0 ? (active.length * winRate * avgDealSize) / avgCycleDays : 0;
                const velocityMonthly = velocity * 30;

                const fmtV = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n)}`;

                // Levers: which factor improvement has most impact
                const levers = [
                  { label: 'Add 2 active deals', newVelocity: ((active.length+2)*winRate*avgDealSize/avgCycleDays)*30, factor: '+ 2 deals' },
                  { label: '+10% win rate', newVelocity: (active.length*Math.min(1,winRate+0.10)*avgDealSize/avgCycleDays)*30, factor: '+10% win rate' },
                  { label: '+20% deal size', newVelocity: (active.length*winRate*(avgDealSize*1.2)/avgCycleDays)*30, factor: '+20% avg deal size' },
                  { label: '−7 day cycle', newVelocity: avgCycleDays > 7 ? (active.length*winRate*avgDealSize/(avgCycleDays-7))*30 : velocityMonthly, factor: '−7 day cycle' },
                ].map(l => ({ ...l, delta: l.newVelocity - velocityMonthly }));

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50">
                      <div className="text-[12px] font-semibold text-slate-100">Sales Velocity</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">(Active deals × Win rate × Avg deal size) ÷ Cycle days = revenue throughput</div>
                    </div>
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Core metrics */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Active Deals',     value: active.length.toString(),           color: 'text-slate-200' },
                            { label: 'Win Rate',         value: `${(winRate*100).toFixed(0)}%`,     color: winRate >= 0.30 ? 'text-emerald-400' : 'text-amber-400' },
                            { label: 'Avg Deal Size',    value: fmtV(avgDealSize),                  color: 'text-slate-200' },
                            { label: 'Avg Sales Cycle',  value: `${Math.round(avgCycleDays)}d`,     color: avgCycleDays <= 30 ? 'text-emerald-400' : avgCycleDays <= 60 ? 'text-amber-400' : 'text-red-400' },
                          ].map(m => (
                            <div key={m.label} className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3 text-center">
                              <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{m.label}</div>
                              <div className={`text-[18px] font-bold ${m.color}`}>{m.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="bg-sky-950/30 border border-sky-500/20 rounded-lg p-4 text-center">
                          <div className="text-[10px] text-sky-500 uppercase tracking-wide mb-1">Monthly Sales Velocity</div>
                          <div className="text-[28px] font-bold text-sky-300">{fmtV(velocityMonthly)}</div>
                          <div className="text-[10px] text-slate-500 mt-1">revenue generating capacity per month</div>
                        </div>
                      </div>
                      {/* Lever analysis */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-400 mb-3">Velocity Levers — What moves the needle most?</div>
                        <div className="space-y-2">
                          {levers.sort((a,b)=>b.delta-a.delta).map(l => (
                            <div key={l.factor} className="flex items-center justify-between bg-slate-800/30 border border-slate-700/20 rounded-lg px-3 py-2.5">
                              <div>
                                <div className="text-[11px] font-medium text-slate-300">{l.factor}</div>
                                <div className="text-[10px] text-slate-600">→ {fmtV(l.newVelocity)}/mo</div>
                              </div>
                              <div className={`text-[13px] font-bold ${l.delta > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                +{fmtV(l.delta)}/mo
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-600 mt-3">Focus on the lever with the highest monthly revenue delta</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <KanbanBoard />
            </div>
          <div className={activeView === 'automations' ? 'space-y-4' : 'hidden'}>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-rose-500/10"/>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em]">IF / THEN Rules</div>
                <div className="h-px flex-1 bg-rose-500/10"/>
              </div>
              <AutomationBuilder />
            </div>
          <div className={activeView === 'acquisitions' ? 'space-y-4' : 'hidden'}>
              <AcquisitionPipeline onAskAI={openChat}/>

              {/* ── IRR / MOIC Return Calculator ── */}
              {(() => {
                const [entryMultiple, setEntryMultiple] = React.useState(5.5);
                const [equityPct, setEquityPct]         = React.useState(40);
                const [holdYears, setHoldYears]         = React.useState(5);
                const [exitMultiple, setExitMultiple]   = React.useState(7.0);
                const [mgmtFee, setMgmtFee]             = React.useState(2);

                const ebitda = data.revenue.total - data.costs.totalCOGS - data.costs.totalOpEx;
                const entryEV     = ebitda * entryMultiple;
                const debtPct     = 1 - equityPct / 100;
                const equityIn    = entryEV * (equityPct / 100);
                const debt        = entryEV * debtPct;
                const exitEV      = ebitda * exitMultiple * Math.pow(1.05, holdYears); // assume 5% EBITDA CAGR
                const debtRemain  = debt * Math.pow(1 - 0.07, holdYears); // ~7% annual paydown
                const exitEquity  = Math.max(0, exitEV - debtRemain);
                const fees        = equityIn * (mgmtFee / 100) * holdYears;
                const netEquity   = exitEquity - fees;
                const moic        = equityIn > 0 ? netEquity / equityIn : 0;
                const irr         = equityIn > 0 && holdYears > 0 ? (Math.pow(moic, 1 / holdYears) - 1) * 100 : 0;

                const fmtN = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;
                const SliderRow = ({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) => (
                  <div className="flex items-center gap-3">
                    <div className="w-36 text-[11px] text-slate-400 flex-shrink-0">{label}</div>
                    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)}
                      className="flex-1 h-1.5 accent-violet-500 cursor-pointer"/>
                    <div className="w-16 text-right text-[12px] font-semibold text-slate-200 flex-shrink-0">{value}{unit}</div>
                  </div>
                );

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">IRR / MOIC Return Calculator</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">PE return model · uses your current EBITDA as the acquisition base</div>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-center">
                          <div className={`text-[22px] font-bold tabular-nums ${irr >= 25 ? 'text-emerald-400' : irr >= 15 ? 'text-amber-400' : 'text-red-400'}`}>{irr.toFixed(1)}%</div>
                          <div className="text-[10px] text-slate-600">IRR</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-[22px] font-bold tabular-nums ${moic >= 3 ? 'text-emerald-400' : moic >= 2 ? 'text-amber-400' : 'text-red-400'}`}>{moic.toFixed(1)}×</div>
                          <div className="text-[10px] text-slate-600">MOIC</div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em]">Deal Structure</div>
                        <SliderRow label="Entry Multiple" value={entryMultiple} min={2} max={12} step={0.5} unit="×" onChange={setEntryMultiple}/>
                        <SliderRow label="Equity %"       value={equityPct}    min={10} max={70} step={5} unit="%" onChange={setEquityPct}/>
                        <SliderRow label="Hold Period"    value={holdYears}    min={2} max={10} step={1} unit="yr" onChange={setHoldYears}/>
                        <SliderRow label="Exit Multiple"  value={exitMultiple} min={2} max={15} step={0.5} unit="×" onChange={setExitMultiple}/>
                        <SliderRow label="Mgmt Fee"       value={mgmtFee}      min={0} max={4} step={0.5} unit="%" onChange={setMgmtFee}/>
                      </div>
                      <div className="bg-slate-800/30 rounded-xl p-4 space-y-2.5 text-[12px]">
                        <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-1">Return Summary</div>
                        {[
                          { label: 'Entry EV',       value: fmtN(entryEV),    sub: `${entryMultiple}× EBITDA` },
                          { label: 'Equity In',      value: fmtN(equityIn),   sub: `${equityPct}% of EV` },
                          { label: 'Senior Debt',    value: fmtN(debt),       sub: `${(100-equityPct)}% of EV` },
                          { label: 'Exit EV',        value: fmtN(exitEV),     sub: `${exitMultiple}× × EBITDA CAGR` },
                          { label: 'Exit Equity',    value: fmtN(netEquity),  sub: 'after debt paydown & fees' },
                          { label: 'MOIC',           value: `${moic.toFixed(2)}×`, sub: irr >= 25 ? 'Top quartile' : irr >= 15 ? 'Acceptable' : 'Below hurdle', bold: true },
                          { label: 'IRR',            value: `${irr.toFixed(1)}%`, sub: 'Unlevered ≈ ' + (irr * 0.65).toFixed(1) + '%', bold: true },
                        ].map(r => (
                          <div key={r.label} className={`flex items-center justify-between ${(r as {bold?:boolean}).bold ? 'pt-2 border-t border-slate-700/60' : ''}`}>
                            <span className={`${(r as {bold?:boolean}).bold ? 'font-semibold text-slate-200' : 'text-slate-500'}`}>{r.label}</span>
                            <div className="text-right">
                              <div className={`font-semibold tabular-nums ${(r as {bold?:boolean}).bold ? (irr >= 25 ? 'text-emerald-400' : irr >= 15 ? 'text-amber-400' : 'text-red-400') : 'text-slate-300'}`}>{r.value}</div>
                              <div className="text-[10px] text-slate-600">{r.sub}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 text-[10px] text-slate-600">Assumes 5% annual EBITDA growth, 7% annual debt paydown, management fees on initial equity. Model is directional — not a substitute for a full LBO model.</div>
                  </div>
                );
              })()}

              {/* ── 100-Day Value Creation Plan ── */}
              {(() => {
                const PLAN_KEY = 'bos_100day_plan';
                type Task100 = { id: string; stream: string; task: string; owner: string; day: number; done: boolean };
                const STREAMS = ['Finance & Reporting', 'Revenue & Sales', 'Operations & Costs', 'Team & Culture', 'Technology & Systems', 'Customer & Retention'];
                const DEFAULT_TASKS: Task100[] = [
                  { id: 'd1', stream: 'Finance & Reporting', task: 'Establish weekly flash P&L reporting', owner: 'CFO', day: 14, done: false },
                  { id: 'd2', stream: 'Finance & Reporting', task: 'Reconcile and normalize historical financials', owner: 'CFO', day: 30, done: false },
                  { id: 'd3', stream: 'Revenue & Sales', task: 'Interview top 10 customers (retention check)', owner: 'CEO', day: 21, done: false },
                  { id: 'd4', stream: 'Revenue & Sales', task: 'Audit pipeline and forecast accuracy', owner: 'Sales', day: 30, done: false },
                  { id: 'd5', stream: 'Operations & Costs', task: 'Review all vendor contracts for renegotiation', owner: 'COO', day: 45, done: false },
                  { id: 'd6', stream: 'Operations & Costs', task: 'Identify top 3 operational inefficiencies', owner: 'COO', day: 30, done: false },
                  { id: 'd7', stream: 'Team & Culture', task: 'Complete management assessment (stay/go)', owner: 'CEO', day: 45, done: false },
                  { id: 'd8', stream: 'Team & Culture', task: 'Establish leadership team cadence & KPIs', owner: 'CEO', day: 14, done: false },
                  { id: 'd9', stream: 'Technology & Systems', task: 'Audit tech stack and identify consolidation', owner: 'COO', day: 60, done: false },
                  { id: 'd10', stream: 'Customer & Retention', task: 'Re-execute all customer contracts to new entity', owner: 'Legal', day: 90, done: false },
                ];
                const [tasks, setTasks] = React.useState<Task100[]>(() => {
                  try { const s = localStorage.getItem(PLAN_KEY); return s ? JSON.parse(s) : DEFAULT_TASKS; } catch { return DEFAULT_TASKS; }
                });
                const [startDate] = React.useState(new Date().toISOString().slice(0, 10));
                const todayDay = Math.max(1, Math.ceil((new Date().getTime() - new Date(startDate).getTime()) / 86400000));

                const saveTasks = (updated: Task100[]) => { setTasks(updated); try { localStorage.setItem(PLAN_KEY, JSON.stringify(updated)); } catch { /* ignore */ } };
                const toggle = (id: string) => saveTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));

                const doneCount = tasks.filter(t => t.done).length;
                const overdue = tasks.filter(t => !t.done && t.day < todayDay);

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">100-Day Value Creation Plan</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Post-acquisition sprint · {doneCount}/{tasks.length} complete{overdue.length > 0 ? ` · ${overdue.length} overdue` : ''}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[16px] font-bold text-indigo-400">Day {Math.min(todayDay, 100)}</div>
                        <div className="text-[10px] text-slate-600">{Math.min(todayDay, 100)} of 100</div>
                      </div>
                    </div>
                    <div className="px-5 py-2">
                      <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden mt-1 mb-3">
                        <div className="h-full bg-indigo-500/70 rounded-full transition-all" style={{ width: `${(doneCount/tasks.length)*100}%` }}/>
                      </div>
                    </div>
                    {STREAMS.map(stream => {
                      const streamTasks = tasks.filter(t => t.stream === stream).sort((a,b) => a.day - b.day);
                      if (streamTasks.length === 0) return null;
                      const streamDone = streamTasks.filter(t => t.done).length;
                      return (
                        <div key={stream} className="border-t border-slate-800/40">
                          <div className="px-5 py-2.5 bg-slate-800/15 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">{stream}</span>
                            <span className="text-[10px] text-slate-600">{streamDone}/{streamTasks.length}</span>
                          </div>
                          {streamTasks.map(t => {
                            const isOverdue = !t.done && t.day < todayDay;
                            return (
                              <label key={t.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-800/20 cursor-pointer border-b border-slate-800/20 last:border-0">
                                <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-0 flex-shrink-0"/>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[12px] ${t.done ? 'line-through text-slate-600' : 'text-slate-300'}`}>{t.task}</div>
                                  <div className="text-[10px] text-slate-600 mt-0.5">@{t.owner} · Day {t.day}</div>
                                </div>
                                {isOverdue && <span className="text-[9px] font-bold text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded flex-shrink-0">Overdue</span>}
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ── Exit Readiness Score ── */}
              {(() => {
                const EXIT_KEY = 'bos_exit_readiness';
                type ExitItem = { id: string; category: string; label: string; weight: number };
                const EXIT_ITEMS: ExitItem[] = [
                  { id: 'e1',  category: 'Financials',     label: '3+ years of clean, audit-ready financial statements', weight: 3 },
                  { id: 'e2',  category: 'Financials',     label: 'Monthly reporting package with KPIs and variance analysis', weight: 2 },
                  { id: 'e3',  category: 'Financials',     label: 'Recurring revenue clearly identified and documented', weight: 2 },
                  { id: 'e4',  category: 'Financials',     label: 'Quality of Earnings adjustments identified and quantified', weight: 2 },
                  { id: 'e5',  category: 'Management',     label: 'Leadership team can operate independently of founder', weight: 3 },
                  { id: 'e6',  category: 'Management',     label: 'Management incentive plan aligned with buyer value creation', weight: 2 },
                  { id: 'e7',  category: 'Customers',      label: 'No single customer > 15% of revenue', weight: 3 },
                  { id: 'e8',  category: 'Customers',      label: 'Multi-year contracts or documented renewal history', weight: 2 },
                  { id: 'e9',  category: 'Customers',      label: 'NPS or customer satisfaction data available', weight: 1 },
                  { id: 'e10', category: 'Operations',     label: 'Documented processes and SOPs for all key workflows', weight: 2 },
                  { id: 'e11', category: 'Operations',     label: 'Technology systems not dependent on one person', weight: 2 },
                  { id: 'e12', category: 'Legal',          label: 'Clean cap table, IP fully assigned to company', weight: 3 },
                  { id: 'e13', category: 'Legal',          label: 'No material litigation or regulatory exposure', weight: 2 },
                  { id: 'e14', category: 'Growth Story',   label: 'Clear 3–5 year growth plan with supporting data', weight: 2 },
                  { id: 'e15', category: 'Growth Story',   label: 'Identified add-on acquisition or market expansion plays', weight: 1 },
                ];
                const [checked, setChecked] = React.useState<Record<string, boolean>>(() => {
                  try { const s = localStorage.getItem(EXIT_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
                });
                const toggle = (id: string) => {
                  const updated = { ...checked, [id]: !checked[id] };
                  setChecked(updated);
                  try { localStorage.setItem(EXIT_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
                };
                const totalWeight = EXIT_ITEMS.reduce((s, i) => s + i.weight, 0);
                const earnedWeight = EXIT_ITEMS.filter(i => checked[i.id]).reduce((s, i) => s + i.weight, 0);
                const score = Math.round((earnedWeight / totalWeight) * 100);
                const label = score >= 80 ? 'Exit-Ready' : score >= 60 ? 'Nearly Ready' : score >= 40 ? 'Moderate Gaps' : 'Significant Gaps';
                const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-sky-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';
                const cats = ['Financials', 'Management', 'Customers', 'Operations', 'Legal', 'Growth Story'];
                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Exit Readiness Score</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Weighted audit across 6 categories · used by PE firms to set deal process timing</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[22px] font-bold tabular-nums ${scoreColor}`}>{score}%</div>
                        <div className={`text-[10px] font-semibold ${scoreColor}`}>{label}</div>
                      </div>
                    </div>
                    <div className="px-5 py-2">
                      <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden mt-1 mb-2">
                        <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-sky-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }}/>
                      </div>
                    </div>
                    {cats.map(cat => {
                      const catItems = EXIT_ITEMS.filter(i => i.category === cat);
                      const catDone = catItems.filter(i => checked[i.id]).length;
                      return (
                        <div key={cat} className="border-t border-slate-800/40">
                          <div className="px-5 py-2.5 bg-slate-800/15 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.08em]">{cat}</span>
                            <span className="text-[10px] text-slate-600">{catDone}/{catItems.length}</span>
                          </div>
                          {catItems.map(item => (
                            <label key={item.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-800/20 cursor-pointer border-b border-slate-800/20 last:border-0">
                              <input type="checkbox" checked={!!checked[item.id]} onChange={() => toggle(item.id)} className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 flex-shrink-0"/>
                              <span className={`text-[12px] flex-1 ${checked[item.id] ? 'line-through text-slate-600' : 'text-slate-300'}`}>{item.label}</span>
                              <span className="flex-shrink-0 text-[9px] text-slate-700">{'●'.repeat(item.weight)}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ── M&A Data Room Readiness Checklist ── */}
              {(() => {
                const CHECKLIST_KEY = 'bos_dataroom_checklist';
                const ITEMS: { id: string; category: string; label: string; critical: boolean }[] = [
                  // Financial
                  { id: 'fin-1', category: 'Financials', label: '3 years audited or reviewed financial statements', critical: true },
                  { id: 'fin-2', category: 'Financials', label: 'YTD P&L and balance sheet (current year)', critical: true },
                  { id: 'fin-3', category: 'Financials', label: 'Monthly revenue breakdown by customer / product', critical: true },
                  { id: 'fin-4', category: 'Financials', label: '12-month cash flow forecast', critical: false },
                  { id: 'fin-5', category: 'Financials', label: 'AR aging report', critical: false },
                  { id: 'fin-6', category: 'Financials', label: 'Quality of earnings (QoE) analysis or adjustments', critical: false },
                  // Legal
                  { id: 'leg-1', category: 'Legal', label: 'Corporate formation documents (articles, bylaws)', critical: true },
                  { id: 'leg-2', category: 'Legal', label: 'Cap table / ownership structure', critical: true },
                  { id: 'leg-3', category: 'Legal', label: 'All material contracts (customers, vendors, leases)', critical: true },
                  { id: 'leg-4', category: 'Legal', label: 'IP assignments and ownership documentation', critical: false },
                  { id: 'leg-5', category: 'Legal', label: 'Litigation history or pending disputes', critical: false },
                  // Operations
                  { id: 'ops-1', category: 'Operations', label: 'Org chart and key employee list with comp', critical: true },
                  { id: 'ops-2', category: 'Operations', label: 'Top 10 customer list with revenue and contract terms', critical: true },
                  { id: 'ops-3', category: 'Operations', label: 'Top 10 vendor / supplier agreements', critical: false },
                  { id: 'ops-4', category: 'Operations', label: 'Employee handbook and benefit summaries', critical: false },
                  // Strategy
                  { id: 'str-1', category: 'Strategy', label: 'Company overview / CIM (Confidential Information Memo)', critical: true },
                  { id: 'str-2', category: 'Strategy', label: '3-year financial projections with assumptions', critical: true },
                  { id: 'str-3', category: 'Strategy', label: 'Revenue growth strategy and market sizing', critical: false },
                  { id: 'str-4', category: 'Strategy', label: 'Competitive landscape overview', critical: false },
                ];

                const [checked, setChecked] = React.useState<Record<string,boolean>>(() => {
                  try { const s = localStorage.getItem(CHECKLIST_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
                });

                const toggle = (id: string) => {
                  setChecked(prev => {
                    const next = { ...prev, [id]: !prev[id] };
                    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
                    return next;
                  });
                };

                const categories = Array.from(new Set(ITEMS.map(i => i.category)));
                const totalDone = ITEMS.filter(i => checked[i.id]).length;
                const criticalDone = ITEMS.filter(i => i.critical && checked[i.id]).length;
                const criticalTotal = ITEMS.filter(i => i.critical).length;
                const readinessPct = Math.round((totalDone / ITEMS.length) * 100);

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">M&A Data Room Readiness</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Check off items as you prepare your data room for buyer due diligence</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className={`text-[22px] font-bold tabular-nums ${readinessPct >= 80 ? 'text-emerald-400' : readinessPct >= 50 ? 'text-amber-400' : 'text-slate-300'}`}>{readinessPct}%</div>
                          <div className="text-[10px] text-slate-600">ready</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-[16px] font-bold ${criticalDone === criticalTotal ? 'text-emerald-400' : 'text-red-400'}`}>{criticalDone}/{criticalTotal}</div>
                          <div className="text-[10px] text-slate-600">critical items</div>
                        </div>
                      </div>
                    </div>
                    <div className="h-1 bg-slate-800">
                      <div className={`h-full transition-all ${readinessPct >= 80 ? 'bg-emerald-500' : readinessPct >= 50 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${readinessPct}%` }}/>
                    </div>
                    <div className="divide-y divide-slate-800/40">
                      {categories.map(cat => {
                        const catItems = ITEMS.filter(i => i.category === cat);
                        const catDone = catItems.filter(i => checked[i.id]).length;
                        return (
                          <div key={cat}>
                            <div className="px-5 py-2.5 bg-slate-800/20 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">{cat}</span>
                              <span className="text-[10px] text-slate-600">{catDone}/{catItems.length}</span>
                            </div>
                            {catItems.map(item => (
                              <div key={item.id}
                                onClick={() => toggle(item.id)}
                                className="px-5 py-3 flex items-start gap-3 hover:bg-slate-800/20 cursor-pointer transition-colors">
                                <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${checked[item.id] ? 'bg-emerald-500/20 border-emerald-500/50' : 'border-slate-700'}`}>
                                  {checked[item.id] && <svg viewBox="0 0 10 10" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>}
                                </div>
                                <div className="flex-1">
                                  <span className={`text-[12px] leading-relaxed ${checked[item.id] ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{item.label}</span>
                                </div>
                                {item.critical && !checked[item.id] && (
                                  <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded flex-shrink-0">Required</span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-5 py-3 border-t border-slate-800/40 flex items-center justify-between flex-wrap gap-2">
                      <div className="text-[10px] text-slate-600">Items marked "Required" are typically requested in the first week of buyer due diligence</div>
                      {openChat && (
                        <button onClick={() => openChat(`I'm preparing my business for sale. My data room is ${readinessPct}% complete — ${criticalDone}/${criticalTotal} critical items done. What should I focus on first and what do buyers scrutinize most in the first 30 days of due diligence?`)}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Ask AI about due diligence →</button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── Deal Sourcing Brief (uses component-level state) ── */}
              {(() => {
                // dealBrief, setDealBrief, dealBriefLoading, setDealBriefLoading, dealStratType, setDealStratType — lifted to component level
                const brief = dealBrief; const setBrief = setDealBrief;
                const briefLoading = dealBriefLoading; const setBriefLoading = setDealBriefLoading;
                const stratType = dealStratType; const setStratType = setDealStratType;

                const strategies = [
                  { id: 'bolt-on' as const, label: 'Bolt-On', desc: 'Tuck-in acquisition for synergies' },
                  { id: 'platform' as const, label: 'Platform', desc: 'Anchor for a buy-and-build' },
                  { id: 'geographic' as const, label: 'Geographic', desc: 'New market / region expansion' },
                  { id: 'vertical' as const, label: 'Vertical', desc: 'Adjacent industry or capability' },
                ];

                const generate = async () => {
                  setBriefLoading(true); setBrief('');
                  const rev = effectiveData.revenue.total;
                  const ebitda = rev - effectiveData.costs.totalCOGS - effectiveData.costs.totalOpEx;
                  const f = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n)}`;
                  const gm = rev > 0 ? ((rev-effectiveData.costs.totalCOGS)/rev*100).toFixed(1) : 'N/A';
                  const industries = Array.from(new Set(effectiveData.customers.topCustomers.map(c => c.industry).filter((x): x is NonNullable<typeof x> => x != null))).slice(0,4).join(', ');

                  const prompt = `You are an M&A advisor. Based on this acquirer profile, write a deal sourcing brief for a ${stratType} acquisition.

Acquirer profile:
- Revenue: ${f(rev)} | EBITDA: ${f(ebitda)} | Gross Margin: ${gm}%
- Customer industries: ${industries || 'not specified'}
- Customers: ${effectiveData.customers.totalCount} | Retention: ${((effectiveData.customers.retentionRate ?? 0.88)*100).toFixed(1)}%
- Company: ${companyName ?? 'undisclosed'}

Strategy type: ${stratType} (${strategies.find(s=>s.id===stratType)?.desc})

Write a concise deal sourcing brief with:
🎯 Target Profile (size range, geography, key characteristics — be specific)
📊 Financial Criteria (revenue range, EBITDA range, margin floors)
⚡ Must-Have Attributes (3-4 non-negotiables)
🔴 Red Flags / Avoid (3 deal-breakers for this acquirer)
📞 Sourcing Channels (where to find these deals — intermediaries, associations, events)
💰 Expected Multiple Range (EV/EBITDA, with rationale)

Specific and actionable, not generic. 200 words.`;
                  try {
                    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ message: prompt, data: effectiveData, companyName, planId: 'pro', maxTokens: 700 }) });
                    const j = await r.json() as { reply?: string };
                    setBrief(j.reply ?? '');
                  } catch { setBrief('Error — check API key.'); }
                  setBriefLoading(false);
                };

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Deal Sourcing Brief</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">AI generates an M&A target profile and sourcing strategy based on your business</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded-lg overflow-hidden border border-slate-700/40 text-[10px]">
                          {strategies.map(s => (
                            <button key={s.id} onClick={() => setStratType(s.id)}
                              className={`px-3 py-1.5 transition-colors ${stratType === s.id ? 'bg-amber-600/30 text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={generate} disabled={briefLoading}
                          className="text-[11px] px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 text-amber-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                          {briefLoading ? 'Generating…' : 'Generate Brief →'}
                        </button>
                      </div>
                    </div>
                    {brief ? (
                      <div className="p-5">
                        <div className="bg-amber-950/10 border border-amber-500/15 rounded-lg p-4 text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{brief}</div>
                        <button onClick={() => void navigator.clipboard.writeText(brief)}
                          className="mt-3 text-[11px] px-3 py-1.5 bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/40 text-slate-300 rounded-lg transition-colors">
                          Copy to Clipboard
                        </button>
                      </div>
                    ) : (
                      <div className="px-5 py-8 text-center text-[11px] text-slate-600">Select acquisition strategy type and generate your sourcing brief</div>
                    )}
                  </div>
                );
              })()}
            </div>
          <div className={activeView === 'valuation' ? 'space-y-4' : 'hidden'}>
              <ValuationEstimator data={effectiveData} previousData={prevSnapshot?.data} onAskAI={openChat}/>
            </div>
          <div className={activeView === 'goals' ? 'space-y-4' : 'hidden'}>
              <GoalEngine/>

              {/* ── 90-Day Sprint Board ── */}
              {(() => {
                const SPRINT_KEY = 'bos_sprint_board';
                type Milestone = { id: string; label: string; done: boolean };
                type Initiative = { id: string; title: string; owner: string; status: 'on-track' | 'at-risk' | 'done'; milestones: Milestone[] };
                type Sprint = { quarter: string; initiatives: Initiative[] };

                const now90 = new Date();
                const qtr = `Q${Math.ceil((now90.getMonth()+1)/3)} ${now90.getFullYear()}`;

                const [sprint, setSprint] = React.useState<Sprint>(() => {
                  try { const s = localStorage.getItem(SPRINT_KEY); return s ? JSON.parse(s) : { quarter: qtr, initiatives: [] }; } catch { return { quarter: qtr, initiatives: [] }; }
                });
                const [showAdd, setShowAdd] = React.useState(false);
                const [newTitle, setNewTitle] = React.useState('');
                const [newOwner, setNewOwner] = React.useState('');
                const [expandedId, setExpandedId] = React.useState<string|null>(null);
                const [newMilestone, setNewMilestone] = React.useState('');

                const save = (updated: Sprint) => {
                  setSprint(updated);
                  try { localStorage.setItem(SPRINT_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
                };

                const addInitiative = () => {
                  if (!newTitle.trim()) return;
                  const init: Initiative = { id: `i${Date.now()}`, title: newTitle.trim(), owner: newOwner.trim() || 'TBD', status: 'on-track', milestones: [] };
                  save({ ...sprint, initiatives: [...sprint.initiatives, init] });
                  setNewTitle(''); setNewOwner(''); setShowAdd(false);
                };

                const removeInitiative = (id: string) => save({ ...sprint, initiatives: sprint.initiatives.filter(i => i.id !== id) });

                const cycleStatus = (id: string) => {
                  const cycle: Initiative['status'][] = ['on-track','at-risk','done'];
                  save({ ...sprint, initiatives: sprint.initiatives.map(i => i.id === id ? { ...i, status: cycle[(cycle.indexOf(i.status)+1)%3] } : i) });
                };

                const addMilestone = (initId: string) => {
                  if (!newMilestone.trim()) return;
                  save({ ...sprint, initiatives: sprint.initiatives.map(i => i.id === initId ? { ...i, milestones: [...i.milestones, { id: `m${Date.now()}`, label: newMilestone.trim(), done: false }] } : i) });
                  setNewMilestone('');
                };

                const toggleMilestone = (initId: string, mId: string) => {
                  save({ ...sprint, initiatives: sprint.initiatives.map(i => i.id === initId ? { ...i, milestones: i.milestones.map(m => m.id === mId ? { ...m, done: !m.done } : m) } : i) });
                };

                const statusConfig: Record<Initiative['status'], { label: string; cls: string }> = {
                  'on-track': { label: 'On Track', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  'at-risk':  { label: 'At Risk',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  'done':     { label: 'Done',     cls: 'bg-slate-700/40 text-slate-500 border-slate-700/40' },
                };

                const onTrack = sprint.initiatives.filter(i => i.status === 'on-track').length;
                const atRisk  = sprint.initiatives.filter(i => i.status === 'at-risk').length;
                const done    = sprint.initiatives.filter(i => i.status === 'done').length;

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">90-Day Sprint Board</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{sprint.quarter} · {sprint.initiatives.length} initiatives · {done} done · {atRisk} at risk</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-2 text-[10px]">
                          {[['on-track', `${onTrack} on track`, 'text-emerald-400'], ['at-risk', `${atRisk} at risk`, 'text-amber-400'], ['done', `${done} done`, 'text-slate-500']].map(([,label,cls]) => (
                            <span key={label as string} className={cls as string}>{label as string}</span>
                          ))}
                        </div>
                        <button onClick={() => setShowAdd(v => !v)}
                          className="text-[11px] px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/40 text-indigo-300 rounded-lg transition-colors">
                          + Initiative
                        </button>
                      </div>
                    </div>

                    {showAdd && (
                      <div className="px-5 py-4 border-b border-slate-800/40 bg-slate-800/20 flex items-center gap-2 flex-wrap">
                        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                          placeholder="Initiative title…"
                          className="flex-1 min-w-[180px] bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
                        <input value={newOwner} onChange={e => setNewOwner(e.target.value)}
                          placeholder="Owner"
                          className="w-28 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"/>
                        <button onClick={addInitiative}
                          className="px-4 py-2 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">Add</button>
                        <button onClick={() => setShowAdd(false)}
                          className="px-3 py-2 text-[12px] text-slate-500 hover:text-slate-300">✕</button>
                      </div>
                    )}

                    {sprint.initiatives.length === 0 ? (
                      <div className="px-5 py-8 text-center">
                        <div className="text-[12px] text-slate-500 mb-1">No initiatives yet</div>
                        <div className="text-[11px] text-slate-600">Add your top priorities for this 90-day sprint</div>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/40">
                        {sprint.initiatives.map(init => {
                          const total = init.milestones.length;
                          const doneM = init.milestones.filter(m => m.done).length;
                          const progress = total > 0 ? (doneM / total) * 100 : 0;
                          const isExpanded = expandedId === init.id;
                          return (
                            <div key={init.id} className={`px-5 py-3.5 ${init.status === 'done' ? 'opacity-60' : ''}`}>
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[12px] font-semibold ${init.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{init.title}</span>
                                    <span className="text-[10px] text-slate-600">@{init.owner}</span>
                                    {total > 0 && <span className="text-[10px] text-slate-600">{doneM}/{total} milestones</span>}
                                  </div>
                                  {total > 0 && (
                                    <div className="mt-1.5 h-1 bg-slate-800/60 rounded-full overflow-hidden w-full max-w-xs">
                                      <div className="h-full bg-indigo-500/60 rounded-full transition-all" style={{ width: `${progress}%` }}/>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button onClick={() => cycleStatus(init.id)}
                                    className={`text-[9px] font-bold px-2 py-1 rounded border cursor-pointer transition-all ${statusConfig[init.status].cls}`}>
                                    {statusConfig[init.status].label}
                                  </button>
                                  <button onClick={() => setExpandedId(isExpanded ? null : init.id)}
                                    className="text-[10px] text-slate-600 hover:text-slate-400 px-1">
                                    {isExpanded ? '▲' : '▼'}
                                  </button>
                                  <button onClick={() => removeInitiative(init.id)}
                                    className="text-[10px] text-slate-700 hover:text-red-400 px-1">✕</button>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="mt-3 pl-2 border-l border-slate-800/60 space-y-1.5">
                                  {init.milestones.map(m => (
                                    <label key={m.id} className="flex items-center gap-2 cursor-pointer group">
                                      <input type="checkbox" checked={m.done} onChange={() => toggleMilestone(init.id, m.id)}
                                        className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-0"/>
                                      <span className={`text-[11px] ${m.done ? 'line-through text-slate-600' : 'text-slate-400 group-hover:text-slate-300'}`}>{m.label}</span>
                                    </label>
                                  ))}
                                  <div className="flex items-center gap-2 mt-2">
                                    <input value={newMilestone} onChange={e => setNewMilestone(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && addMilestone(init.id)}
                                      placeholder="Add milestone…"
                                      className="flex-1 bg-slate-800/60 border border-slate-700/40 rounded px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-indigo-500/50"/>
                                    <button onClick={() => addMilestone(init.id)}
                                      className="text-[10px] text-indigo-400 hover:text-indigo-300 px-1">Add</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Market Sizing Calculator (TAM/SAM/SOM) (uses component-level state) ── */}
              {(() => {
                // mktInputs, setMktInputs — lifted to component level
                const inputs = mktInputs;
                type MarketInput = { tamDesc: string; tamSize: string; samPct: string; somPct: string; growthRate: string };
                const setInput = (k: keyof MarketInput, v: string) => {
                  const next = { ...inputs, [k]: v };
                  setMktInputs(next);
                  try { localStorage.setItem('bos_market_sizing', JSON.stringify(next)); } catch { /* ignore */ }
                };

                const tam = parseFloat(inputs.tamSize) || 0;
                const sam = tam * (parseFloat(inputs.samPct) || 0) / 100;
                const som = sam * (parseFloat(inputs.somPct) || 0) / 100;
                const rev = effectiveData.revenue.total;
                const currentShare = sam > 0 ? (rev / sam) * 100 : 0;
                const g = parseFloat(inputs.growthRate) / 100;
                const tam5yr = tam * Math.pow(1 + g, 5);
                const fmtB = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : `$${Math.round(n).toLocaleString()}`;
                const fmtV = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n)}`;

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50">
                      <div className="text-[12px] font-semibold text-slate-100">Market Sizing — TAM / SAM / SOM</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Total addressable market, serviceable market, and your realistic capture — board deck ready</div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <div className="text-[10px] font-semibold text-slate-500 mb-1">Market description</div>
                          <input value={inputs.tamDesc} onChange={e => setInput('tamDesc', e.target.value)}
                            placeholder="e.g. B2B outsourced accounting software for US SMBs"
                            className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"/>
                        </div>
                        {[
                          { key: 'tamSize' as const, label: 'TAM ($M)', placeholder: 'e.g. 4200', suffix: 'M' },
                          { key: 'growthRate' as const, label: 'Market Growth Rate (%/yr)', placeholder: 'e.g. 8', suffix: '%' },
                          { key: 'samPct' as const, label: 'SAM (% of TAM you can serve)', placeholder: 'e.g. 20', suffix: '%' },
                          { key: 'somPct' as const, label: 'SOM (% of SAM realistic win)', placeholder: 'e.g. 3', suffix: '%' },
                        ].map(f => (
                          <div key={f.key}>
                            <div className="text-[10px] font-semibold text-slate-500 mb-1">{f.label}</div>
                            <input type="number" value={inputs[f.key]} onChange={e => setInput(f.key, e.target.value)}
                              placeholder={f.placeholder}
                              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"/>
                          </div>
                        ))}
                      </div>
                      {tam > 0 && (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: 'TAM', value: fmtB(tam*1e6), sub: '5yr: '+fmtB(tam5yr*1e6), color: 'text-slate-300', bg: 'bg-slate-800/40' },
                              { label: 'SAM', value: fmtB(sam*1e6), sub: `${inputs.samPct}% of TAM`, color: 'text-sky-300', bg: 'bg-sky-950/20 border-sky-500/10' },
                              { label: 'SOM', value: fmtB(som*1e6), sub: `${inputs.somPct}% of SAM`, color: 'text-indigo-300', bg: 'bg-indigo-950/20 border-indigo-500/10' },
                            ].map(m => (
                              <div key={m.label} className={`border rounded-lg p-3 text-center ${m.bg}`}>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{m.label}</div>
                                <div className={`text-[20px] font-bold ${m.color}`}>{m.value}</div>
                                <div className="text-[10px] text-slate-600 mt-0.5">{m.sub}</div>
                              </div>
                            ))}
                          </div>
                          <div className="bg-slate-800/30 rounded-lg p-3 grid grid-cols-2 gap-3 text-[11px]">
                            <div>
                              <span className="text-slate-500">Current revenue: </span>
                              <span className="text-slate-300 font-semibold">{fmtV(rev)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">SAM share today: </span>
                              <span className={`font-semibold ${currentShare < 1 ? 'text-amber-400' : currentShare < 5 ? 'text-sky-400' : 'text-emerald-400'}`}>
                                {currentShare.toFixed(2)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">Revenue to reach SOM: </span>
                              <span className="text-indigo-300 font-semibold">{fmtB(som*1e6)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Headroom to SOM: </span>
                              <span className="text-emerald-400 font-semibold">{fmtB(Math.max(0,som*1e6-rev))}</span>
                            </div>
                          </div>
                          {/* TAM funnel visual */}
                          <div className="space-y-2">
                            {[
                              { label: 'TAM', pct: 100, color: 'bg-slate-700/50' },
                              { label: 'SAM', pct: parseFloat(inputs.samPct)||0, color: 'bg-sky-600/40' },
                              { label: 'SOM', pct: (parseFloat(inputs.samPct)||0)*(parseFloat(inputs.somPct)||0)/100, color: 'bg-indigo-600/60' },
                            ].map(b => (
                              <div key={b.label} className="flex items-center gap-3">
                                <div className="w-8 text-[10px] text-slate-500 text-right">{b.label}</div>
                                <div className="flex-1 h-3 bg-slate-800/60 rounded-full overflow-hidden">
                                  <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${Math.min(100,b.pct)}%` }}/>
                                </div>
                                <div className="text-[10px] text-slate-500 w-10 text-right">{b.pct.toFixed(1)}%</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      {tam === 0 && (
                        <div className="text-center py-4 text-[11px] text-slate-600">Enter your TAM to see the market funnel</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          <div className={activeView === 'team' ? 'space-y-4' : 'hidden'}>
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-violet-500/10"/>
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em]">Deal Activity & Tasks</div>
                <div className="h-px flex-1 bg-violet-500/10"/>
              </div>
              <TeamFeed/>

              {/* ── Org Cost Efficiency Heatmap ── */}
              {(() => {
                const depts = effectiveData.payrollByDept ?? [];
                if (!depts.length) return null;
                const rev = effectiveData.revenue.total;
                const totalComp = depts.reduce((s,d) => s+d.totalCompensation, 0);
                const totalHC = depts.reduce((s,d) => s+d.headcount, 0);
                const fmtV = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n)}`;

                // Benchmark rev/FTE: $85k LMM median, $120k strong
                const BENCH_MED = 85000; const BENCH_STRONG = 120000;

                const rows = depts.map(d => {
                  const revShare = rev > 0 ? (d.headcount / Math.max(totalHC,1)) * rev : 0; // attributed rev
                  const revPerFTE = d.headcount > 0 ? rev / totalHC : 0; // company-wide rev/FTE (dept doesn't generate independently)
                  const compPerFTE = d.headcount > 0 ? d.totalCompensation / d.headcount : 0;
                  const compPctRev = rev > 0 ? (d.totalCompensation / rev) * 100 : 0;
                  const efficiency = compPerFTE > 0 ? revPerFTE / compPerFTE : 0; // rev : comp ratio
                  return { ...d, compPerFTE, compPctRev, efficiency, revPerFTE };
                }).sort((a,b) => b.totalCompensation - a.totalCompensation);

                const companyRevPerFTE = totalHC > 0 ? rev / totalHC : 0;
                const effColor = companyRevPerFTE >= BENCH_STRONG ? 'text-emerald-400' : companyRevPerFTE >= BENCH_MED ? 'text-amber-400' : 'text-red-400';

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Org Cost Efficiency</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Compensation by department vs revenue — identify over/under-staffed areas</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[18px] font-bold ${effColor}`}>{fmtV(companyRevPerFTE)}</div>
                        <div className="text-[10px] text-slate-600">rev / FTE (benchmark: {fmtV(BENCH_MED)} median)</div>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-800/40">
                      {rows.map(d => {
                        const barW = totalComp > 0 ? (d.totalCompensation / totalComp) * 100 : 0;
                        const effLabel = d.compPctRev > 20 ? 'High cost' : d.compPctRev < 8 ? 'Lean' : 'Normal';
                        const effCls = d.compPctRev > 20 ? 'text-red-400' : d.compPctRev < 8 ? 'text-emerald-400' : 'text-slate-400';
                        return (
                          <div key={d.department} className="px-5 py-3 flex items-center gap-4">
                            <div className="w-28 flex-shrink-0">
                              <div className="text-[12px] font-semibold text-slate-300">{d.department}</div>
                              <div className="text-[10px] text-slate-600">{d.headcount} FTE{d.headcount !== 1 ? 's' : ''}</div>
                            </div>
                            <div className="flex-1">
                              <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-1">
                                <div className="h-full bg-violet-500/50 rounded-full transition-all" style={{ width: `${barW}%` }}/>
                              </div>
                              <div className="text-[10px] text-slate-600">{fmtV(d.compPerFTE)}/FTE avg · {d.compPctRev.toFixed(1)}% of revenue</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-[13px] font-bold text-slate-300">{fmtV(d.totalCompensation)}</div>
                              <div className={`text-[10px] font-semibold ${effCls}`}>{effLabel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-5 py-3 border-t border-slate-800/40 text-[10px] text-slate-600">
                      High cost departments (&gt;20% of revenue) warrant ROI review · Rev/FTE target: {fmtV(BENCH_STRONG)}+ for strong LMM operators
                    </div>
                  </div>
                );
              })()}
            </div>
          <div className={activeView === 'cash' ? 'space-y-4' : 'hidden'}>
              <CashRunway data={effectiveData} onAskAI={openChat}/>
              <WorkingCapitalDashboard data={effectiveData} onAskAI={openChat}/>

              {/* ── Debt Service / Leverage Tracker ── */}
              {(() => {
                const rev = effectiveData.revenue.total;
                const ebitda = rev - effectiveData.costs.totalCOGS - effectiveData.costs.totalOpEx;
                const fmtV = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}k` : `$${Math.round(n).toLocaleString()}`;

                const saveDebt = (next: typeof debtLines) => {
                  setDebtLines(next);
                  try { localStorage.setItem('bos_debt_lines', JSON.stringify(next)); } catch { /* ignore */ }
                };
                const addLine = () => {
                  const next = [...debtLines, { id: `d${Date.now()}`, name: 'New Facility', balance: 0, rate: 6.5, payment: 0, type: 'term' as const }];
                  saveDebt(next);
                };
                const updateLine = (id: string, field: string, val: string | number) => {
                  saveDebt(debtLines.map(d => d.id === id ? { ...d, [field]: typeof val === 'string' ? (isNaN(parseFloat(val)) ? val : parseFloat(val)) : val } : d));
                };
                const removeLine = (id: string) => saveDebt(debtLines.filter(d => d.id !== id));

                // ── Auto-detect from financial data ──────────────────────────
                const autoDetectFromFinancials = () => {
                  const interestCats = effectiveData.costs.byCategory.filter(c =>
                    /interest|debt.*service|loan|finance.*charge|borrowing/i.test(c.category)
                  );
                  if (!interestCats.length) {
                    setDebtPdfMsg('No interest/debt expense found in cost categories. Add an "Interest Expense" category to your financial data.');
                    setDebtPdfStatus('error');
                    return;
                  }
                  const detected = interestCats.map((c, i) => {
                    const annualInterest = c.amount;
                    const assumedRate = 7.0;
                    const impliedBalance = Math.round((annualInterest / (assumedRate / 100)) / 1000) * 1000;
                    return {
                      id: `auto${Date.now()}${i}`,
                      name: c.category,
                      balance: impliedBalance,
                      rate: assumedRate,
                      payment: Math.round(annualInterest / 12),
                      type: 'term' as const,
                    };
                  });
                  saveDebt(detected);
                  setDebtPdfMsg(`Auto-detected ${detected.length} facilit${detected.length === 1 ? 'y' : 'ies'} from interest expense. Balance estimated at 7% rate — update to actual rate.`);
                  setDebtPdfStatus('done');
                };

                // ── PDF upload ───────────────────────────────────────────────
                const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.type !== 'application/pdf') {
                    setDebtPdfMsg('Please upload a PDF file.'); setDebtPdfStatus('error'); return;
                  }
                  setDebtPdfStatus('loading'); setDebtPdfMsg('Reading loan document…');
                  try {
                    const arrayBuffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                    const pdfBase64 = btoa(binary);

                    const r = await fetch('/api/data/loan-pdf', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ pdfBase64 }),
                    });
                    const j = await r.json() as { lines?: typeof debtLines; error?: string };
                    if (!r.ok || !j.lines) {
                      setDebtPdfMsg(j.error ?? 'Could not parse loan data from this document.');
                      setDebtPdfStatus('error');
                      return;
                    }
                    if (j.lines.length === 0) {
                      setDebtPdfMsg('No debt facilities found in this document. Try a term sheet, loan agreement, or credit agreement.');
                      setDebtPdfStatus('error');
                      return;
                    }
                    saveDebt([...debtLines.filter(d => !d.id.startsWith('d1') && !d.id.startsWith('d2') && !d.id.startsWith('d3')), ...j.lines]);
                    setDebtPdfMsg(`Imported ${j.lines.length} facilit${j.lines.length === 1 ? 'y' : 'ies'} from ${file.name}`);
                    setDebtPdfStatus('done');
                  } catch (err) {
                    setDebtPdfMsg(err instanceof Error ? err.message : 'Upload failed');
                    setDebtPdfStatus('error');
                  }
                  e.target.value = '';
                };

                const totalDebt = debtLines.reduce((s,d) => s+d.balance, 0);
                const totalAnnualService = debtLines.reduce((s,d) => s+(d.payment*12), 0);
                const totalInterest = debtLines.reduce((s,d) => s+(d.balance*d.rate/100), 0);
                const debtToEbitda = ebitda > 0 ? totalDebt / ebitda : null;
                const dscr = totalAnnualService > 0 ? ebitda / totalAnnualService : null;
                const interestCoverage = totalInterest > 0 ? ebitda / totalInterest : null;

                const dscrColor = dscr === null ? 'text-slate-400' : dscr >= 2 ? 'text-emerald-400' : dscr >= 1.25 ? 'text-amber-400' : 'text-red-400';
                const leverageColor = debtToEbitda === null ? 'text-slate-400' : debtToEbitda <= 3 ? 'text-emerald-400' : debtToEbitda <= 5 ? 'text-amber-400' : 'text-red-400';
                const icColor = interestCoverage === null ? 'text-slate-400' : interestCoverage >= 3 ? 'text-emerald-400' : interestCoverage >= 1.5 ? 'text-amber-400' : 'text-red-400';

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Debt Service / Leverage Tracker</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Live from EBITDA · import from balance sheet data or loan agreement PDF</div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={autoDetectFromFinancials}
                          className="text-[11px] px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-300 rounded-lg transition-colors">
                          ⚡ Auto-detect from Financials
                        </button>
                        <label className={`text-[11px] px-3 py-1.5 border rounded-lg transition-colors cursor-pointer ${debtPdfStatus === 'loading' ? 'opacity-50 cursor-not-allowed bg-slate-700/20 border-slate-700/40 text-slate-500' : 'bg-sky-600/20 hover:bg-sky-600/30 border-sky-600/40 text-sky-300'}`}>
                          {debtPdfStatus === 'loading' ? 'Parsing PDF…' : '↑ Upload Loan PDF'}
                          <input type="file" accept="application/pdf" className="hidden" disabled={debtPdfStatus === 'loading'} onChange={handlePdfUpload}/>
                        </label>
                        <button onClick={addLine}
                          className="text-[11px] px-3 py-1.5 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/40 text-slate-400 rounded-lg transition-colors">
                          + Manual
                        </button>
                      </div>
                    </div>
                    {debtPdfMsg && (
                      <div className={`px-5 py-2.5 text-[11px] border-b ${debtPdfStatus === 'done' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : debtPdfStatus === 'error' ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-sky-500/5 border-sky-500/20 text-sky-400'}`}>
                        {debtPdfMsg}
                        <button onClick={() => { setDebtPdfMsg(''); setDebtPdfStatus('idle'); }} className="ml-3 text-slate-600 hover:text-slate-400">×</button>
                      </div>
                    )}

                    {/* Covenant metrics */}
                    {totalDebt > 0 && (
                      <div className="grid grid-cols-3 gap-0 divide-x divide-slate-800/50 border-b border-slate-800/50">
                        {[
                          { label: 'Debt / EBITDA', value: debtToEbitda !== null ? `${debtToEbitda.toFixed(1)}×` : '—', sub: 'Target ≤ 4×', color: leverageColor },
                          { label: 'DSCR', value: dscr !== null ? `${dscr.toFixed(2)}×` : '—', sub: 'Target ≥ 1.25×', color: dscrColor },
                          { label: 'Interest Coverage', value: interestCoverage !== null ? `${interestCoverage.toFixed(1)}×` : '—', sub: 'Target ≥ 2×', color: icColor },
                        ].map(m => (
                          <div key={m.label} className="px-5 py-4 text-center">
                            <div className={`text-[22px] font-bold ${m.color}`}>{m.value}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                            <div className="text-[9px] text-slate-700 mt-0.5">{m.sub}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Debt lines */}
                    {debtLines.length > 0 ? (
                      <div className="divide-y divide-slate-800/40">
                        <div className="px-5 py-2 grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                          <div className="col-span-3">Facility</div>
                          <div className="col-span-2">Type</div>
                          <div className="col-span-2 text-right">Balance</div>
                          <div className="col-span-2 text-right">Rate %</div>
                          <div className="col-span-2 text-right">Mo. Payment</div>
                          <div className="col-span-1"/>
                        </div>
                        {debtLines.map(d => (
                          <div key={d.id} className="px-5 py-2.5 grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-3">
                              <input value={d.name} onChange={e => updateLine(d.id,'name',e.target.value)}
                                className="w-full bg-transparent text-[12px] text-slate-300 focus:outline-none border-b border-slate-700/40 focus:border-indigo-500/50"/>
                            </div>
                            <div className="col-span-2">
                              <select value={d.type} onChange={e => updateLine(d.id,'type',e.target.value)}
                                className="bg-slate-800/60 border border-slate-700/40 rounded px-1.5 py-1 text-[10px] text-slate-400 focus:outline-none w-full">
                                <option value="term">Term</option>
                                <option value="revolver">Revolver</option>
                                <option value="mezz">Mezz</option>
                              </select>
                            </div>
                            <div className="col-span-2 text-right">
                              <input type="number" value={d.balance/1000} onChange={e => updateLine(d.id,'balance',(parseFloat(e.target.value)||0)*1000)}
                                className="w-full bg-transparent text-[12px] text-slate-300 text-right focus:outline-none border-b border-slate-700/40 focus:border-indigo-500/50"/>
                              <div className="text-[9px] text-slate-700">$k</div>
                            </div>
                            <div className="col-span-2 text-right">
                              <input type="number" value={d.rate} onChange={e => updateLine(d.id,'rate',e.target.value)}
                                step="0.25"
                                className="w-full bg-transparent text-[12px] text-amber-400 text-right focus:outline-none border-b border-slate-700/40 focus:border-amber-500/50"/>
                            </div>
                            <div className="col-span-2 text-right">
                              <input type="number" value={d.payment/1000} onChange={e => updateLine(d.id,'payment',(parseFloat(e.target.value)||0)*1000)}
                                className="w-full bg-transparent text-[12px] text-slate-300 text-right focus:outline-none border-b border-slate-700/40 focus:border-indigo-500/50"/>
                              <div className="text-[9px] text-slate-700">$k/mo</div>
                            </div>
                            <div className="col-span-1 text-right">
                              <button onClick={() => removeLine(d.id)} className="text-slate-700 hover:text-red-400 transition-colors text-[14px]">×</button>
                            </div>
                          </div>
                        ))}
                        <div className="px-5 py-3 border-t border-slate-800/40 grid grid-cols-2 gap-4 text-[11px]">
                          <div><span className="text-slate-600">Total Debt: </span><span className="text-slate-300 font-semibold">{fmtV(totalDebt)}</span></div>
                          <div><span className="text-slate-600">Annual Debt Service: </span><span className="text-slate-300 font-semibold">{fmtV(totalAnnualService)}</span></div>
                          <div><span className="text-slate-600">Annual Interest: </span><span className="text-amber-400 font-semibold">{fmtV(totalInterest)}</span></div>
                          <div><span className="text-slate-600">EBITDA: </span><span className={`font-semibold ${ebitda >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtV(ebitda)}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-8 text-center text-[11px] text-slate-600">
                        No debt facilities tracked — click &quot;+ Add Facility&quot; to add term loans, revolvers, or mezz debt
                      </div>
                    )}
                    {/* Leverage-based pricing / covenant grid */}
                    <div className="border-t border-slate-800/40">
                      <div className="px-5 py-3 border-b border-slate-800/30">
                        <div className="text-[11px] font-semibold text-slate-400">Leverage-Based Pricing Grid</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">Hypothetical rate step-ups by Debt/EBITDA tier — typical senior credit covenant structure</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] min-w-[500px]">
                          <thead>
                            <tr className="border-b border-slate-800/40">
                              <th className="text-left text-slate-600 px-5 py-2 font-medium">Leverage Tier</th>
                              <th className="text-right text-slate-600 px-4 py-2 font-medium">Debt/EBITDA</th>
                              <th className="text-right text-slate-600 px-4 py-2 font-medium">Spread (SOFR+)</th>
                              <th className="text-right text-slate-600 px-4 py-2 font-medium">All-in Rate*</th>
                              <th className="text-right text-slate-600 px-5 py-2 font-medium">Annual Interest</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { tier: 'I — Low',      min: 0,   max: 2.0, spread: 2.00, label: '< 2.0×' },
                              { tier: 'II — Moderate', min: 2.0, max: 3.0, spread: 2.50, label: '2.0× – 3.0×' },
                              { tier: 'III — Elevated',min: 3.0, max: 4.0, spread: 3.25, label: '3.0× – 4.0×' },
                              { tier: 'IV — High',     min: 4.0, max: 5.0, spread: 4.00, label: '4.0× – 5.0×' },
                              { tier: 'V — Stressed',  min: 5.0, max: 99,  spread: 5.50, label: '> 5.0×' },
                            ].map(row => {
                              const sofrBase = 5.33; // approximate SOFR as of mid-2025
                              const allIn = sofrBase + row.spread;
                              const annualInterest = totalDebt * (allIn / 100);
                              const isCurrent = debtToEbitda !== null && debtToEbitda >= row.min && debtToEbitda < row.max;
                              return (
                                <tr key={row.tier} className={`border-b border-slate-800/30 ${isCurrent ? 'bg-indigo-500/10' : ''}`}>
                                  <td className="px-5 py-2 text-slate-400 font-medium">
                                    {isCurrent && <span className="text-indigo-400 mr-1.5">▶</span>}
                                    {row.tier}
                                  </td>
                                  <td className="px-4 py-2 text-right text-slate-500">{row.label}</td>
                                  <td className="px-4 py-2 text-right text-amber-400">+{row.spread.toFixed(2)}%</td>
                                  <td className={`px-4 py-2 text-right font-semibold ${isCurrent ? 'text-indigo-300' : 'text-slate-400'}`}>{allIn.toFixed(2)}%</td>
                                  <td className={`px-5 py-2 text-right font-bold ${isCurrent ? 'text-indigo-300' : 'text-slate-500'}`}>{fmtV(annualInterest)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-5 py-3 text-[10px] text-slate-600">
                        * SOFR base: ~5.33% · Spread varies by lender and credit quality · ▶ indicates your current leverage tier · Reducing Debt/EBITDA below 3.0× typically saves 75–150bps
                      </div>
                    </div>

                    <div className="px-5 py-3 border-t border-slate-800/40 text-[10px] text-slate-600">
                      LMM benchmarks: Debt/EBITDA ≤ 4× safe · DSCR ≥ 1.25× (most covenants) · Interest coverage ≥ 2× healthy
                    </div>
                  </div>
                );
              })()}
            </div>
          <div className={activeView === 'deals' ? '' : 'hidden'}>
            <DealList
              onAskAI={openChat}
              initialDealId={jumpDealId}
              key={jumpDealId ?? 'list'}
            />
          </div>
          <div className={activeView === 'today' ? 'space-y-4' : 'hidden'}>
              {/* Today — business health snapshot */}
              {(() => {
                const fmtN = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };
                const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
                const rev    = data.revenue.total;
                const cogs   = data.costs.totalCOGS;
                const opex   = data.costs.totalOpEx;
                const grossProfit = rev - cogs;
                const grossMargin = rev > 0 ? grossProfit / rev : 0;
                const ebitda = rev - cogs - opex;
                const ebitdaMargin = rev > 0 ? ebitda / rev : 0;
                const cashLatest = data.cashFlow?.length ? data.cashFlow[data.cashFlow.length - 1].closingBalance : null;
                const burnRate = data.cashFlow?.length && data.cashFlow.length >= 2
                  ? data.cashFlow[data.cashFlow.length - 1].closingBalance - data.cashFlow[data.cashFlow.length - 2].closingBalance
                  : null;
                const activeDeals = (data.pipeline ?? []).filter(d => d.stage !== 'Closed Won' && d.stage !== 'Closed Lost');
                const weighted = activeDeals.reduce((s, d) => s + d.value * (d.probability / 100), 0);
                const customers = data.customers;
                const churnRate = customers.retentionRate != null ? (1 - customers.retentionRate) : null;
                const utilization = data.operations.employeeUtilization ?? data.operations.utilizationRate ?? data.operations.capacityUtilization ?? null;

                type StatItem = { label: string; value: string; sub: string; color: string; border: string };
                const stats: StatItem[] = [
                  {
                    label: 'Revenue',
                    value: fmtN(rev),
                    sub: `Gross margin ${rev > 0 ? fmtPct(grossMargin) : '—'}`,
                    color: 'text-slate-100',
                    border: 'border-slate-800/50',
                  },
                  {
                    label: 'EBITDA',
                    value: fmtN(ebitda),
                    sub: `${rev > 0 ? fmtPct(ebitdaMargin) : '—'} margin`,
                    color: ebitda >= 0 ? 'text-emerald-400' : 'text-red-400',
                    border: ebitda >= 0 ? 'border-emerald-500/20' : 'border-red-500/20',
                  },
                  ...(cashLatest !== null ? [{
                    label: 'Cash',
                    value: fmtN(cashLatest),
                    sub: burnRate !== null ? (burnRate >= 0 ? `+${fmtN(burnRate)} last period` : `${fmtN(burnRate)} burn`) : 'Latest close',
                    color: cashLatest > 0 ? 'text-slate-100' : 'text-red-400',
                    border: cashLatest > 0 ? 'border-slate-800/50' : 'border-red-500/20',
                  } as StatItem] : []),
                  {
                    label: 'Pipeline (Wtd)',
                    value: fmtN(weighted),
                    sub: `${activeDeals.length} active deal${activeDeals.length !== 1 ? 's' : ''}`,
                    color: 'text-blue-300',
                    border: 'border-blue-500/15',
                  },
                  ...(churnRate !== null ? [{
                    label: 'Churn Rate',
                    value: fmtPct(churnRate),
                    sub: `${customers.totalCount ?? '—'} customers`,
                    color: churnRate <= 0.02 ? 'text-emerald-400' : churnRate <= 0.05 ? 'text-amber-400' : 'text-red-400',
                    border: churnRate <= 0.05 ? 'border-slate-800/50' : 'border-red-500/20',
                  } as StatItem] : []),
                  ...(utilization !== null ? [{
                    label: 'Utilization',
                    value: fmtPct(utilization),
                    sub: data.operations.headcount ? `${data.operations.headcount} headcount` : 'Team capacity',
                    color: utilization >= 0.75 ? 'text-emerald-400' : utilization >= 0.5 ? 'text-amber-400' : 'text-red-400',
                    border: 'border-slate-800/50',
                  } as StatItem] : []),
                ];

                return (
                  <div className="space-y-3">
                    <div className={`grid gap-3 ${stats.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
                      {stats.map(s => (
                        <div key={s.label} className={`bg-slate-900/50 border ${s.border} rounded-xl px-4 py-3`}>
                          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{s.label}</div>
                          <div className={`text-[18px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">{s.sub}</div>
                        </div>
                      ))}
                      <button
                        onClick={() => openChat('What should I focus on today? Summarize the top 3 priorities based on my current financial performance, pipeline, and any risks.')}
                        className="bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/15 hover:border-indigo-500/30 rounded-xl px-4 py-3 text-left transition-colors group">
                        <div className="text-[10px] font-semibold text-indigo-400/70 uppercase tracking-[0.08em] mb-1">AI Insight</div>
                        <div className="text-[13px] font-semibold text-indigo-300 group-hover:text-indigo-200">What to focus on →</div>
                        <div className="text-[10px] text-indigo-400/50 mt-0.5">Top 3 priorities</div>
                      </button>
                    </div>
                  </div>
                );
              })()}
              {/* ── Daily Action Checklist ──────────────────────────── */}
              {(() => {
                const d = effectiveData;
                const rev    = d.revenue.total;
                const cogs   = d.costs.totalCOGS;
                const opex   = d.costs.totalOpEx;
                const ebitda = rev - cogs - opex;
                const ebitdaMargin = rev > 0 ? ebitda / rev : 0;
                const cashPeriods = d.cashFlow ?? [];
                const cashLatestVal = cashPeriods.length ? cashPeriods[cashPeriods.length - 1].closingBalance : null;
                const burnRateVal = cashPeriods.length >= 2 ? cashPeriods[cashPeriods.length - 1].closingBalance - cashPeriods[cashPeriods.length - 2].closingBalance : null;
                const retentionVal = d.customers.retentionRate;
                const churnVal = retentionVal != null ? (1 - retentionVal) * 100 : null;
                const activeDealsVal = (d.pipeline ?? []).filter(dl => dl.stage !== 'Closed Won' && dl.stage !== 'Closed Lost');
                const overdueDeals = activeDealsVal.filter(dl => dl.daysInStage !== undefined && dl.daysInStage > 30);
                const riskAR = d.arAging ? d.arAging.reduce((s, b) => s + b.days60 + b.days90 + b.over90, 0) : 0;
                const utilVal = d.operations.employeeUtilization ?? d.operations.utilizationRate ?? d.operations.capacityUtilization ?? null;
                const top1Pct = d.customers.topCustomers[0]?.percentOfTotal ?? 0;

                type Action = { id: string; priority: 'critical' | 'high' | 'medium'; label: string; detail: string; cta: string; view: ActiveView | null; ask?: string };

                const actions: Action[] = [];

                // Critical: burning cash
                if (burnRateVal !== null && burnRateVal < 0 && cashLatestVal !== null) {
                  const runway = Math.abs(cashLatestVal / burnRateVal);
                  if (runway < 6) {
                    actions.push({
                      id: 'cash-burn',
                      priority: 'critical',
                      label: `Cash runway: ${runway.toFixed(1)} months`,
                      detail: `Burning ${(() => { const abs = Math.abs(burnRateVal); return abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString()}`; })()} per period. Review and cut discretionary OpEx today.`,
                      cta: 'Review Cash →',
                      view: 'cash',
                      ask: `My cash runway is ${runway.toFixed(1)} months. What are the fastest levers to extend runway without harming revenue?`,
                    });
                  }
                }

                // Critical: EBITDA negative
                if (ebitda < 0) {
                  actions.push({
                    id: 'ebitda-neg',
                    priority: 'critical',
                    label: 'EBITDA is negative',
                    detail: `Operating at a loss (${(ebitdaMargin * 100).toFixed(1)}% margin). Identify top cost drivers and model cuts in Scenarios.`,
                    cta: 'Model Scenarios →',
                    view: 'scenarios',
                    ask: `My EBITDA margin is ${(ebitdaMargin * 100).toFixed(1)}%. What are the most impactful cost reduction moves I should make this week?`,
                  });
                }

                // High: overdue deals
                if (overdueDeals.length > 0) {
                  actions.push({
                    id: 'overdue-deals',
                    priority: 'high',
                    label: `${overdueDeals.length} deal${overdueDeals.length > 1 ? 's' : ''} need follow-up today`,
                    detail: `${overdueDeals.map(dl => dl.name).slice(0, 3).join(', ')}${overdueDeals.length > 3 ? ` +${overdueDeals.length - 3} more` : ''}`,
                    cta: 'Open Deals →',
                    view: 'deals',
                  });
                }

                // High: 60+ day AR outstanding
                if (riskAR > 0) {
                  const fmtAR = riskAR >= 1_000_000 ? `$${(riskAR/1_000_000).toFixed(1)}M` : `$${Math.round(riskAR).toLocaleString()}`;
                  actions.push({
                    id: 'ar-risk',
                    priority: 'high',
                    label: `${fmtAR} AR is 60+ days overdue`,
                    detail: 'Aging receivables compress cash and signal collection risk. Send statements to 60+ day accounts.',
                    cta: 'View Financials →',
                    view: 'financial',
                    ask: `I have ${fmtAR} in 60+ day receivables. What collection actions should I take today?`,
                  });
                }

                // High: churn above 10%
                if (churnVal !== null && churnVal > 10) {
                  actions.push({
                    id: 'high-churn',
                    priority: 'high',
                    label: `${churnVal.toFixed(1)}% customer churn rate`,
                    detail: 'Above 10% churn compresses valuation multiples. Review at-risk accounts and add a retention touch this week.',
                    cta: 'View Customers →',
                    view: 'customers',
                    ask: `My churn rate is ${churnVal.toFixed(1)}%. What retention moves have the fastest payback in a service business?`,
                  });
                }

                // Medium: customer concentration
                if (top1Pct > 20) {
                  actions.push({
                    id: 'concentration',
                    priority: 'medium',
                    label: `Top customer = ${top1Pct.toFixed(0)}% of revenue`,
                    detail: `${d.customers.topCustomers[0]?.name ?? 'Top customer'} is above the 20% concentration risk threshold. Prioritize diversification.`,
                    cta: 'View Customers →',
                    view: 'customers',
                  });
                }

                // Medium: under-utilized
                if (utilVal !== null && utilVal < 0.55) {
                  actions.push({
                    id: 'low-util',
                    priority: 'medium',
                    label: `Team utilization low: ${(utilVal * 100).toFixed(0)}%`,
                    detail: 'Capacity is under-deployed. Shift team to pipeline development or billable projects to improve revenue per employee.',
                    cta: 'View Operations →',
                    view: 'operations',
                  });
                }

                // Medium: strong EBITDA — consider reinvesting
                if (ebitdaMargin >= 0.20 && ebitda > 0 && actions.filter(a => a.priority !== 'medium').length === 0) {
                  actions.push({
                    id: 'invest',
                    priority: 'medium',
                    label: `Strong ${(ebitdaMargin * 100).toFixed(0)}% EBITDA — model growth spend`,
                    detail: 'Healthy margins create room to reinvest. Run a scenario to see the impact of hiring or a price increase.',
                    cta: 'Run Scenarios →',
                    view: 'scenarios',
                    ask: `My EBITDA margin is ${(ebitdaMargin * 100).toFixed(0)}%. What are the highest-ROI ways to redeploy this cash flow for growth?`,
                  });
                }

                // Default if nothing surfaces
                if (actions.length === 0) {
                  actions.push({
                    id: 'default',
                    priority: 'medium',
                    label: 'No urgent items — stay proactive',
                    detail: 'Business metrics look stable. Review your pipeline coverage and check in on your top 3 accounts.',
                    cta: 'View Deals →',
                    view: 'deals',
                  });
                }

                const topActions = actions.slice(0, 4);
                const priorityStyle = (p: Action['priority']) =>
                  p === 'critical' ? { dot: 'bg-red-400 animate-pulse', label: 'Critical', badge: 'text-red-400 bg-red-500/10 border-red-500/20', border: 'border-l-red-500/50' } :
                  p === 'high'     ? { dot: 'bg-amber-400', label: 'High', badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20', border: 'border-l-amber-500/40' } :
                                     { dot: 'bg-blue-400', label: 'Focus', badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20', border: 'border-l-blue-500/30' };

                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] flex-shrink-0">Action Checklist</span>
                      <div className="flex-1 h-px bg-slate-800/50"/>
                      <span className="text-[10px] text-slate-600">{topActions.filter(a => a.priority === 'critical').length > 0 ? `${topActions.filter(a => a.priority === 'critical').length} critical` : 'No critical alerts'}</span>
                    </div>
                    <div className="space-y-2">
                      {topActions.map(action => {
                        const s = priorityStyle(action.priority);
                        return (
                          <div key={action.id} className={`bg-slate-900/50 border border-slate-800/50 border-l-2 ${s.border} rounded-xl px-4 py-3 flex items-start gap-3`}>
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`}/>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-[12px] font-semibold text-slate-100">{action.label}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>{s.label}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 leading-relaxed">{action.detail}</div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2">
                              {action.ask && openChat && (
                                <button onClick={() => openChat(action.ask!)}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors whitespace-nowrap">
                                  Ask AI
                                </button>
                              )}
                              {action.view && (
                                <button onClick={() => setActiveView(action.view!)}
                                  className="text-[11px] font-semibold text-slate-300 hover:text-slate-100 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                                  {action.cta}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              {/* ── Tax & Compliance Calendar ── */}
              {(() => {
                const TAX_KEY = 'bos_tax_checked';
                const now = new Date();
                const year = now.getFullYear();
                type TaxItem = { id: string; date: string; label: string; category: string; critical: boolean };
                const TAX_ITEMS: TaxItem[] = [
                  // Q1
                  { id: `q1-est-${year}`,   date: `${year}-04-15`, label: 'Q1 Estimated Tax Payment (Federal)',       category: 'Estimated Tax', critical: true  },
                  { id: `q1-payroll-${year}`,date: `${year}-04-30`, label: 'Q1 Payroll Tax Deposit (Form 941)',        category: 'Payroll',       critical: true  },
                  // Q2
                  { id: `q2-est-${year}`,   date: `${year}-06-17`, label: 'Q2 Estimated Tax Payment (Federal)',       category: 'Estimated Tax', critical: true  },
                  { id: `q2-payroll-${year}`,date: `${year}-07-31`, label: 'Q2 Payroll Tax Deposit (Form 941)',        category: 'Payroll',       critical: true  },
                  // Q3
                  { id: `q3-est-${year}`,   date: `${year}-09-16`, label: 'Q3 Estimated Tax Payment (Federal)',       category: 'Estimated Tax', critical: true  },
                  { id: `q3-payroll-${year}`,date: `${year}-10-31`, label: 'Q3 Payroll Tax Deposit (Form 941)',        category: 'Payroll',       critical: true  },
                  // Q4
                  { id: `q4-est-${year}`,   date: `${year}-01-15`, label: `Q4 Estimated Tax Payment (${year} tax yr)`,category: 'Estimated Tax', critical: true  },
                  { id: `q4-payroll-${year}`,date: `${year}-01-31`, label: 'Q4 Payroll Tax Deposit (Form 941)',        category: 'Payroll',       critical: true  },
                  // Annual
                  { id: `corp-return-${year}`,date:`${year}-03-15`, label: 'S-Corp / Partnership Return (Form 1120-S/1065)', category: 'Annual Filing', critical: true  },
                  { id: `personal-${year}`, date: `${year}-04-15`, label: 'Personal Tax Return (Form 1040)',          category: 'Annual Filing', critical: true  },
                  { id: `w2-${year}`,        date: `${year}-01-31`, label: 'W-2s to Employees',                       category: 'Payroll',       critical: true  },
                  { id: `1099-${year}`,      date: `${year}-01-31`, label: '1099-NEC to Contractors',                 category: 'Payroll',       critical: false },
                  { id: `sales-tax-q1-${year}`,date:`${year}-04-20`,label: 'Q1 Sales Tax Filing (varies by state)',   category: 'Sales Tax',     critical: false },
                  { id: `sales-tax-q2-${year}`,date:`${year}-07-20`,label: 'Q2 Sales Tax Filing (varies by state)',   category: 'Sales Tax',     critical: false },
                  { id: `sales-tax-q3-${year}`,date:`${year}-10-20`,label: 'Q3 Sales Tax Filing (varies by state)',   category: 'Sales Tax',     critical: false },
                  { id: `boi-${year}`,       date: `${year}-12-31`, label: 'FinCEN BOI Report (beneficial ownership)', category: 'Compliance',   critical: true  },
                ];

                const [taxChecked, setTaxChecked] = React.useState<Record<string,boolean>>(() => {
                  try { const s = localStorage.getItem(TAX_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
                });
                const toggleTax = (id: string) => {
                  setTaxChecked(prev => {
                    const next = { ...prev, [id]: !prev[id] };
                    try { localStorage.setItem(TAX_KEY, JSON.stringify(next)); } catch { /* ignore */ }
                    return next;
                  });
                };

                const todayMs = now.getTime();
                const upcoming = TAX_ITEMS
                  .filter(i => !taxChecked[i.id])
                  .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .slice(0, 6);

                const nextItem = upcoming[0];
                const daysUntilNext = nextItem ? Math.ceil((new Date(nextItem.date).getTime() - todayMs) / 86400000) : null;

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">Tax & Compliance Calendar</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Key US federal deadlines · check off when filed</div>
                      </div>
                      {daysUntilNext !== null && nextItem && (
                        <div className={`text-[11px] font-semibold ${daysUntilNext <= 14 ? 'text-red-400' : daysUntilNext <= 30 ? 'text-amber-400' : 'text-slate-400'}`}>
                          Next: {nextItem.label.split('(')[0].trim()} in {daysUntilNext}d
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-slate-800/30">
                      {upcoming.map(item => {
                        const daysAway = Math.ceil((new Date(item.date).getTime() - todayMs) / 86400000);
                        const isOverdue = daysAway < 0;
                        const isSoon = daysAway >= 0 && daysAway <= 14;
                        const urgencyDot = isOverdue ? 'bg-red-400 animate-pulse' : isSoon ? 'bg-amber-400' : 'bg-slate-600';
                        return (
                          <div key={item.id} onClick={() => toggleTax(item.id)}
                            className="px-5 py-3 flex items-center gap-3 hover:bg-slate-800/20 cursor-pointer transition-colors">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${urgencyDot}`}/>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] text-slate-300 leading-tight">{item.label}</div>
                              <div className="text-[10px] text-slate-600 mt-0.5">{item.category}</div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className={`text-[11px] font-semibold ${isOverdue ? 'text-red-400' : isSoon ? 'text-amber-400' : 'text-slate-500'}`}>
                                {isOverdue ? `${Math.abs(daysAway)}d overdue` : daysAway === 0 ? 'Today' : `${daysAway}d`}
                              </div>
                              <div className="text-[10px] text-slate-600">{new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>
                              <div className="w-4 h-4 rounded border border-slate-700 flex items-center justify-center">
                                {taxChecked[item.id] && <svg viewBox="0 0 10 10" fill="none" stroke="#10b981" strokeWidth="2" className="w-2.5 h-2.5"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-5 py-2.5 border-t border-slate-800/40 text-[10px] text-slate-700">
                      {TAX_ITEMS.filter(i => taxChecked[i.id]).length} of {TAX_ITEMS.length} items filed · Dates are federal — state deadlines may vary · Consult your CPA
                    </div>
                  </div>
                );
              })()}

              {/* ── Week at a Glance ── */}
              {(() => {
                type LocalDeal = { id: string; name: string; company: string; value: number; stage: string; closeDate?: string };
                let crmDeals: LocalDeal[] = [];
                try { const s = localStorage.getItem('bos_deals'); if (s) crmDeals = JSON.parse(s); } catch { /* ignore */ }
                const today = new Date();
                today.setHours(0,0,0,0);
                const days = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(today);
                  d.setDate(today.getDate() + i);
                  return d;
                });
                const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                // Map deals closing within 7 days
                const dealsThisWeek = crmDeals.filter(d => {
                  if (!d.closeDate || d.stage === 'closed-won' || d.stage === 'closed-lost') return false;
                  const cd = new Date(d.closeDate);
                  cd.setHours(0,0,0,0);
                  return cd >= today && cd <= days[6];
                });

                // Map pipeline deals from data closing this week
                const pipelineThisWeek = (data.pipeline ?? []).filter(d => {
                  if (!d.closeDate || d.stage === 'Closed Won' || d.stage === 'Closed Lost') return false;
                  const cd = new Date(d.closeDate);
                  cd.setHours(0,0,0,0);
                  return cd >= today && cd <= days[6];
                });

                if (dealsThisWeek.length === 0 && pipelineThisWeek.length === 0) return null;

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-800/50">
                      <div className="text-[12px] font-semibold text-slate-100">Week at a Glance</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Deals closing in the next 7 days</div>
                    </div>
                    <div className="grid grid-cols-7 divide-x divide-slate-800/40">
                      {days.map((d, i) => {
                        const isToday = i === 0;
                        const dayDeals = dealsThisWeek.filter(dl => {
                          const cd = new Date(dl.closeDate!); cd.setHours(0,0,0,0);
                          return cd.getTime() === d.getTime();
                        });
                        const dayPipeline = pipelineThisWeek.filter(dl => {
                          const cd = new Date(dl.closeDate!); cd.setHours(0,0,0,0);
                          return cd.getTime() === d.getTime();
                        });
                        const hasDeal = dayDeals.length > 0 || dayPipeline.length > 0;
                        return (
                          <div key={i} className={`p-2 min-h-[72px] ${isToday ? 'bg-indigo-500/5' : ''}`}>
                            <div className={`text-[10px] font-semibold mb-1 ${isToday ? 'text-indigo-400' : 'text-slate-600'}`}>{dayNames[d.getDay()]}</div>
                            <div className={`text-[13px] font-bold mb-1 ${isToday ? 'text-indigo-300' : 'text-slate-500'}`}>{d.getDate()}</div>
                            {hasDeal ? (
                              <div className="space-y-1">
                                {dayDeals.map(dl => (
                                  <div key={dl.id} className="text-[9px] bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded px-1 py-0.5 leading-tight truncate" title={dl.name}>{dl.company}</div>
                                ))}
                                {dayPipeline.map((dl, pi) => (
                                  <div key={pi} className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded px-1 py-0.5 leading-tight truncate" title={dl.name}>{dl.name}</div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[9px] text-slate-800">—</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── CEO Quick Notes ── */}
              {(() => {
                const NOTES_KEY = 'bos_ceo_notes';
                const todayKey = new Date().toISOString().slice(0, 10);
                const [noteText, setNoteText] = React.useState<string>(() => {
                  try {
                    const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
                    return all[todayKey] ?? '';
                  } catch { return ''; }
                });
                const [noteSaved, setNoteSaved] = React.useState(false);

                const saveNote = (val: string) => {
                  setNoteText(val);
                  try {
                    const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
                    all[todayKey] = val;
                    // Keep last 30 days only
                    const keys = Object.keys(all).sort().slice(-30);
                    const trimmed: Record<string, string> = {};
                    keys.forEach(k => { trimmed[k] = all[k]; });
                    localStorage.setItem(NOTES_KEY, JSON.stringify(trimmed));
                  } catch { /* ignore */ }
                  setNoteSaved(true);
                  setTimeout(() => setNoteSaved(false), 1500);
                };

                // Load last 3 days with notes for history
                const recentNotes: { date: string; text: string }[] = [];
                try {
                  const all = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
                  Object.entries(all)
                    .filter(([k]) => k !== todayKey)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .slice(0, 2)
                    .forEach(([k, v]) => recentNotes.push({ date: k, text: v as string }));
                } catch { /* ignore */ }

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-[12px] font-semibold text-slate-100">CEO Notes</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Saved locally</div>
                      </div>
                      {noteSaved && <span className="text-[11px] text-emerald-400 font-medium">Saved ✓</span>}
                    </div>
                    <textarea
                      rows={4}
                      placeholder="What's top of mind today? Key decisions, risks, ideas, follow-ups…"
                      value={noteText}
                      onChange={e => saveNote(e.target.value)}
                      className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none leading-relaxed transition-colors"
                    />
                    {recentNotes.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {recentNotes.map(n => (
                          <div key={n.date} className="bg-slate-800/20 rounded-lg px-3 py-2">
                            <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wide mb-1">{new Date(n.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                            <div className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">{n.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── AI Meeting → Action Items ── */}
              {(() => {
                const [notes, setNotes] = React.useState('');
                const [actions, setActions] = React.useState('');
                const [meetLoading, setMeetLoading] = React.useState(false);
                const [added, setAdded] = React.useState(false);

                const extract = async () => {
                  if (!notes.trim()) return;
                  setMeetLoading(true); setActions('');
                  const prompt = `Extract action items from these meeting notes. Format each as: "ACTION: [owner] → [specific task] · Due: [timeframe]". Then write a one-sentence meeting summary at the top labeled "SUMMARY:". Be specific — use names from the notes if present. Meeting notes:\n\n${notes}`;
                  try {
                    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, data: effectiveData, history: [], companyName, planId: 'pro' }) });
                    const json = await res.json() as { reply?: string };
                    setActions(json.reply ?? 'Failed to extract');
                  } catch { setActions('Error connecting to AI'); } finally { setMeetLoading(false); }
                };

                const addToBoard = () => {
                  if (!actions) return;
                  const lines = actions.split('\n').filter(l => l.startsWith('ACTION:'));
                  const tasks = lines.map(l => ({
                    id: `mt${Date.now()}-${Math.random()}`,
                    title: l.replace('ACTION:', '').trim(),
                    status: 'todo',
                    createdAt: new Date().toISOString(),
                    source: 'meeting',
                  }));
                  try {
                    const existing = JSON.parse(localStorage.getItem('bos_tasks') ?? '[]') as object[];
                    localStorage.setItem('bos_tasks', JSON.stringify([...existing, ...tasks]));
                  } catch { /* ignore */ }
                  setAdded(true); setTimeout(() => setAdded(false), 3000);
                };

                return (
                  <div className="bg-gradient-to-br from-emerald-950/20 to-slate-900/50 border border-emerald-800/30 rounded-xl p-5">
                    <div className="text-[12px] font-semibold text-slate-100 mb-0.5">AI Meeting → Action Items</div>
                    <div className="text-[10px] text-slate-500 mb-3">Paste raw meeting notes → AI extracts action items and adds them to your Execute board</div>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Paste meeting notes here… (names, decisions, follow-ups)"
                      rows={5}
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed mb-3"/>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={extract} disabled={meetLoading || !notes.trim()}
                        className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition-colors">
                        {meetLoading ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"/>Extracting…</> : '✦ Extract Actions'}
                      </button>
                      {actions && (
                        <button onClick={addToBoard}
                          className="px-4 py-2 text-[12px] font-semibold bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 text-slate-200 rounded-xl transition-colors">
                          {added ? '✓ Added to Execute Board' : '→ Add to Execute Board'}
                        </button>
                      )}
                    </div>
                    {actions && (
                      <div className="mt-3 bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
                        <pre className="text-[12px] text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">{actions}</pre>
                      </div>
                    )}
                  </div>
                );
              })()}

              <DailyPriorities
                onOpenDeal={(dealId) => {
                  setJumpDealId(dealId);
                  setActiveView('deals');
                  setTimeout(() => setJumpDealId(null), 100);
                }}
              />
            </div>
          <div className={activeView === 'execute' ? 'space-y-5' : 'hidden'}>
              <TaskBoard data={data} onAskAI={openChat}/>
            </div>
          <div className={activeView === 'suppliers' ? '' : 'hidden'}>
            <SupplierDashboard data={data} onDataUpdate={handleDataUpdate} onAskAI={openChat}/>
          </div>
          <div className={activeView === 'skus' ? '' : 'hidden'}>
            <SKUAnalyzer data={data} onDataUpdate={handleDataUpdate} onAskAI={openChat}/>
          </div>
          <div className={activeView === 'capacity' ? '' : 'hidden'}>
            <CapacityAnalyzer data={data} onDataUpdate={handleDataUpdate} onAskAI={openChat}/>
          </div>
          <div className={activeView === 'purchasing' ? '' : 'hidden'}>
            <CapitalImpactSummary data={data} onAskAI={openChat}/>
          </div>
          <div className={activeView === 'data' ? 'space-y-5' : 'hidden'}>
              {/* ── Connection Status Dashboard ── */}
              {(() => {
                const rev = data.revenue.total;
                const hasCOGS    = data.costs.totalCOGS > 0;
                const hasOpEx    = data.costs.totalOpEx > 0;
                const hasPeriods = (data.revenue.byPeriod ?? []).length > 0;
                const hasCustomers = (data.customers.totalCount ?? 0) > 0;
                const hasPayroll = (data.payrollByDept ?? []).length > 0;
                const hasDeals   = (() => { try { const s = localStorage.getItem('bos_deals'); return s ? JSON.parse(s).length > 0 : false; } catch { return false; } })();
                const hasARAging = (data.arAging ?? []).length > 0;
                const hasBudget  = !!(budget.revenue || budget.cogs || budget.opex);
                const hasTransactions = (data.transactions ?? []).length > 0;

                type Source = { label: string; key: string; status: 'connected' | 'partial' | 'missing'; detail: string; action?: string };
                const sources: Source[] = [
                  { label: 'Revenue & P&L',       key: 'revenue',   status: rev > 0 ? 'connected' : 'missing',    detail: rev > 0 ? `$${rev >= 1e6 ? (rev/1e6).toFixed(1)+'M' : Math.round(rev).toLocaleString()} total revenue` : 'No revenue data imported', action: rev > 0 ? undefined : 'Import CSV' },
                  { label: 'COGS & Gross Margin',  key: 'cogs',      status: hasCOGS ? 'connected' : 'missing',   detail: hasCOGS ? 'COGS data present' : 'No COGS — GP/margins unavailable', action: hasCOGS ? undefined : 'Add in Onboarding' },
                  { label: 'OpEx / Overhead',      key: 'opex',      status: hasOpEx ? 'connected' : 'missing',   detail: hasOpEx ? 'OpEx data loaded' : 'No OpEx — EBITDA not calculated', action: hasOpEx ? undefined : 'Add in Onboarding' },
                  { label: 'Time-Series Periods',  key: 'periods',   status: hasPeriods ? 'connected' : 'missing', detail: hasPeriods ? `${(data.revenue.byPeriod ?? []).length} periods loaded` : 'No period data — trends unavailable', action: hasPeriods ? undefined : 'Import CSV with dates' },
                  { label: 'Customer Data',        key: 'customers', status: hasCustomers ? 'connected' : 'missing', detail: hasCustomers ? `${data.customers.totalCount} customers` : 'No customer data', action: hasCustomers ? undefined : 'Add via Onboarding' },
                  { label: 'Payroll / Headcount',  key: 'payroll',   status: hasPayroll ? 'connected' : 'missing', detail: hasPayroll ? `${data.payrollByDept?.length} departments` : 'No payroll data — labor analytics unavailable', action: hasPayroll ? undefined : 'Add in Onboarding' },
                  { label: 'CRM Pipeline',         key: 'deals',     status: hasDeals ? 'connected' : 'missing',  detail: hasDeals ? 'Pipeline deals loaded' : 'No deals — CRM analytics unavailable', action: hasDeals ? undefined : 'Add deals in CRM tab' },
                  { label: 'AR Aging',             key: 'ar',        status: hasARAging ? 'connected' : 'missing', detail: hasARAging ? `${data.arAging?.length} AR buckets` : 'No AR aging — DSO/CCC estimates only', action: hasARAging ? undefined : 'Import AR report' },
                  { label: 'Budget',               key: 'budget',    status: hasBudget ? 'connected' : 'missing', detail: hasBudget ? 'Budget targets set' : 'No budget — variance tracking unavailable', action: hasBudget ? undefined : 'Set in Financial tab' },
                  { label: 'Transactions',         key: 'txns',      status: hasTransactions ? 'connected' : 'partial', detail: hasTransactions ? `${data.transactions?.length} transactions` : 'No transaction detail', action: hasTransactions ? undefined : 'Import bank export' },
                ];

                const connected = sources.filter(s => s.status === 'connected').length;
                const partial   = sources.filter(s => s.status === 'partial').length;
                const missing   = sources.filter(s => s.status === 'missing').length;
                const pct = Math.round(((connected + partial * 0.5) / sources.length) * 100);

                return (
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-800/50">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                        <div>
                          <div className="text-[12px] font-semibold text-slate-100">Data Connection Status</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{connected} of {sources.length} sources connected · {pct}% data completeness</div>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/><span className="text-slate-400">{connected} connected</span></span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/><span className="text-slate-400">{partial} partial</span></span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-700 inline-block"/><span className="text-slate-400">{missing} missing</span></span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-800/60 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-800/30">
                      {sources.map(src => (
                        <div key={src.key} className="px-5 py-3 flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${src.status === 'connected' ? 'bg-emerald-500' : src.status === 'partial' ? 'bg-amber-500' : 'bg-slate-700'}`}/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[12px] font-medium text-slate-300">{src.label}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${src.status === 'connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : src.status === 'partial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800/40 text-slate-600 border-slate-700/40'}`}>
                                {src.status === 'connected' ? 'Connected' : src.status === 'partial' ? 'Partial' : 'Not Connected'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">{src.detail}</div>
                          </div>
                          {src.action && src.status !== 'connected' && (
                            <button onClick={() => src.key === 'deals' ? setActiveView('crm' as ActiveView) : src.key === 'budget' ? setActiveView('financial' as ActiveView) : undefined}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors">
                              {src.action}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <DataFreshnessBar snapshots={snapshots} activeSnapshotId={activeSnapshotId}/>
              {/* localStorage storage indicator */}
              {(() => {
                try {
                  let totalBytes = 0;
                  const bosKeys: string[] = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i) ?? '';
                    const val = localStorage.getItem(key) ?? '';
                    totalBytes += key.length + val.length;
                    if (key.startsWith('bos_')) bosKeys.push(key);
                  }
                  const bosBytes = bosKeys.reduce((s, k) => {
                    const v = localStorage.getItem(k) ?? '';
                    return s + k.length + v.length;
                  }, 0);
                  const totalKB = (totalBytes / 1024).toFixed(0);
                  const bosKB   = (bosBytes  / 1024).toFixed(0);
                  const limitKB = 5120; // 5MB typical limit
                  const pct = Math.min((totalBytes / (limitKB * 1024)) * 100, 100);
                  const barColor = pct > 80 ? 'bg-red-500/60' : pct > 60 ? 'bg-amber-500/60' : 'bg-emerald-500/50';
                  const textColor = pct > 80 ? 'text-red-400' : pct > 60 ? 'text-amber-400' : 'text-slate-400';
                  return (
                    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-400">Browser Storage</span>
                          <span className={`text-[11px] font-semibold tabular-nums ${textColor}`}>
                            {totalKB} KB used · {bosKB} KB from Business OS
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }}/>
                        </div>
                        <div className="text-[10px] text-slate-700 mt-1">
                          {pct.toFixed(0)}% of ~5MB browser limit · clear old periods to free space
                        </div>
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
              {/* ── Manual entry shortcut ── */}
              <div className="bg-slate-900/40 border border-indigo-500/15 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[12px] font-semibold text-slate-200">Enter data manually</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">No CSV? Fill in a quick form and get your dashboard live in 60 seconds.</div>
                </div>
                <button
                  onClick={() => setShowManualEntry(true)}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-xl transition-colors"
                >
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-3 h-3"><path d="M6 2v8M2 6h8"/></svg>
                  Enter manually
                </button>
              </div>
              <DataSourcePanel data={data} onDataUpdate={handleDataUpdate} onSuccess={handleDataSuccess} companyProfile={companyProfile} onProfileChange={saveCompanyProfile}/>
              <SessionManagerPanel/>
            </div>
          </>)}
        </main>

        </div>{/* /content column */}
        </div>{/* /body flex row */}

        {/* ── Onboarding flow ── */}
        {showOnboarding && (
          <OnboardingFlow
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        )}

        {/* ── Manual data entry modal ── */}
        {showManualEntry && (
          <ManualEntryModal
            open={showManualEntry}
            onClose={() => setShowManualEntry(false)}
            onSubmit={(d) => { setShowManualEntry(false); handleDataUpdate(d); }}
          />
        )}

        {/* ── Period name modal ── */}
        {showPeriodModal && (
          <PeriodModal
            onConfirm={handlePeriodConfirm}
            onSkip={() => { handlePeriodConfirm('Imported Data'); }}
          />
        )}

        {/* ── Floating ⌘K button (desktop only, AI is now in header) ── */}
        {!chatOpen && !paletteOpen && (
          <button
            onClick={() => setPaletteOpen(true)}
            className="no-print hidden md:flex fixed bottom-5 right-5 z-[145] w-9 h-9 items-center justify-center bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 text-slate-400 hover:text-slate-200 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95"
            title="Command palette (⌘K)">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
              <circle cx="6.5" cy="6.5" r="4.5"/><path d="M11 11l2 2"/>
            </svg>
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
          onCreateTask={createTaskFromAlert}
          onNavigate={v => setActiveView(v as ActiveView)}
        />

        {/* ── Command palette ── */}
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(view) => setActiveView(view as ActiveView)}
          onAskAI={(msg) => { openChat(msg); setPaletteOpen(false); }}
          onRunAction={(action) => { runAction(action); setPaletteOpen(false); }}
          onEnterManually={() => { setShowManualEntry(true); setPaletteOpen(false); }}
          onBackupData={() => {
            // Trigger the SessionManagerPanel export inline
            const BOS_KEYS = ['bos_session','bos_company','bos_company_profile','bos_deals','bos_deals_v2','bos_acq_targets','bos_goals','bos_memory','bos_automations','bos_tasks','bos_custom_kpis','bos_thresholds','bos_budget','bos_panel_notes','bos_annotations','bos_agent_results','bos_weekly_insight','bos_board_deck','bos_alerts','bos_report_timestamps','bos_onboarding','bos_snapshots','bos_active_id'];
            const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
            BOS_KEYS.forEach(key => { try { const v = localStorage.getItem(key); if (v) out[key] = JSON.parse(v); } catch { /* ignore */ } });
            const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `business-os-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
            addToast('success', 'Backup downloaded');
            setPaletteOpen(false);
          }}
        />

        {/* ── Pricing modal ── */}
        <PricingModal
          open={pricingOpen}
          onClose={() => setPricingOpen(false)}
          currentPlan={currentSession.planId}
          onSelectPlan={(planId) => { if (planId === 'starter') { setPricingOpen(false); } }}
        />

        {/* ── Keyboard shortcuts modal ── */}
        {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)}/>}

        {/* ── Share snapshot modal ── */}
        {showShareModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
            <div className="relative bg-[#0d1117] border border-slate-700/60 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[15px] font-semibold text-slate-100">Share Snapshot</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">Read-only link · no login required</div>
                </div>
                <button onClick={() => setShowShareModal(false)} className="text-slate-600 hover:text-slate-300 text-xl leading-none transition-colors">×</button>
              </div>
              {/* Preview of what's included */}
              <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-3 mb-4 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-400 uppercase tracking-[0.08em] text-[10px] mb-1.5">Snapshot includes</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Revenue & margins</span>
                  <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> EBITDA</span>
                  <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Customer health</span>
                  <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Revenue trend</span>
                  <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Health score</span>
                  <span className="flex items-center gap-1.5"><span className="text-emerald-400">✓</span> Top customers</span>
                </div>
              </div>
              {/* URL field */}
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 min-w-0 bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2.5 text-[11px] text-slate-300 font-mono focus:outline-none select-all"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2500);
                    });
                  }}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all ${
                    shareCopied
                      ? 'bg-emerald-600 text-white border border-emerald-500'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {shareCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-600">
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3 flex-shrink-0"><rect x="4" y="1" width="6" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="6" width="12" height="7" rx="1.5"/><circle cx="7" cy="9.5" r="1"/></svg>
                Anyone with the link can view this read-only snapshot. No login required.
              </div>
              <div className="mt-3 flex justify-end">
                <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
                  Preview link →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Welcome modal (first visit) ── */}
        {showWelcome && (
          <WelcomeModal
            onDismiss={() => setShowWelcome(false)}
            onGoToData={() => { setShowWelcome(false); setActiveView('data'); }}
          />
        )}

        {/* ── Mobile bottom tab bar (md: hidden) ── */}
        <nav className="md:hidden no-print fixed bottom-0 left-0 right-0 z-[140] bg-[#060a12]/97 border-t border-slate-800/60 backdrop-blur-md flex">
          {(['today', 'overview', 'deals', 'financial', 'intelligence'] as const).map(id => {
            const item = navItems.find(n => n.id === id)!;
            const isActive = activeView === id;
            const TabIcon = item.Icon;
            return (
              <button key={id} onClick={() => { setActiveView(id); setMobileNavOpen(false); }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors ${
                  isActive ? 'text-indigo-300' : 'text-slate-600 hover:text-slate-400'}`}>
                <TabIcon/>
                <span className={`text-[9px] font-semibold uppercase tracking-[0.06em] ${isActive ? 'text-indigo-300' : 'text-slate-600'}`}>{item.label}</span>
              </button>
            );
          })}
          {/* More button opens mobile nav drawer */}
          <button
            onClick={() => setMobileNavOpen(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors ${
              mobileNavOpen || !['today','overview','deals','financial','intelligence'].includes(activeView)
                ? 'text-indigo-300' : 'text-slate-600 hover:text-slate-400'}`}>
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5">
              <circle cx="2" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="12" cy="7" r="1.2"/>
            </svg>
            <span className={`text-[9px] font-semibold uppercase tracking-[0.06em] ${
              mobileNavOpen || !['today','overview','deals','financial','intelligence'].includes(activeView)
                ? 'text-indigo-300' : 'text-slate-600'}`}>More</span>
          </button>
        </nav>

        {/* ── Toasts ── */}
        <ToastContainer toasts={toasts} dismiss={dismissToast}/>

        {/* ── Run Report progress overlay ── */}
        {reportProgress && (
          <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none">
            <div className="pointer-events-auto bg-[#0d1117] border border-slate-700/60 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[13px] font-semibold text-slate-100">Running full report…</div>
                <div className="flex gap-0.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }}/>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {reportProgress.map(step => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step.status === 'done' && (
                        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-emerald-400">
                          <path d="M2 5.5l2 2 4-4"/>
                        </svg>
                      )}
                      {step.status === 'running' && (
                        <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 text-indigo-400 animate-spin">
                          <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
                          <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
                        </svg>
                      )}
                      {step.status === 'pending' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-700"/>
                      )}
                      {step.status === 'error' && (
                        <svg viewBox="0 0 10 10" fill="currentColor" className="w-3.5 h-3.5 text-red-400">
                          <path d="M5 1L9 9H1L5 1z"/><path d="M5 4.5v2M5 7.5v.5" stroke="white" strokeWidth="1" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[12px] font-medium ${step.status === 'done' ? 'text-slate-300' : step.status === 'running' ? 'text-slate-100' : step.status === 'error' ? 'text-red-400' : 'text-slate-600'}`}>
                        {step.label}
                      </div>
                      {step.detail && (
                        <div className={`text-[10px] mt-0.5 ${step.status === 'error' ? 'text-red-400/70' : 'text-slate-500'}`}>{step.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
