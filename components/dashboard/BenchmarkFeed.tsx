// ─── BenchmarkFeed ────────────────────────────────────────────────────────────
// Real-time metric delta notifications. Compares current vs prior period and
// fires severity-ranked alerts when KPIs move beyond thresholds.
// Also provides internal SKU/customer benchmarking.

import { useState, useMemo } from 'react';
import type { UnifiedBusinessData } from '../../types';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onNavigate?: (view: string) => void;
  onAskAI?: (msg: string) => void;
}

type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

interface MetricAlert {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  rootCauseView?: string;
  rootCauseLabel?: string;
  delta?: number;
  unit?: string;
}

function fmtPct(n: number, decimals = 1) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`;
}
function fmtPp(n: number, decimals = 1) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}pp`;
}
function fmtN(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function computeAlerts(cur: UnifiedBusinessData, prev: UnifiedBusinessData): MetricAlert[] {
  const alerts: MetricAlert[] = [];

  const cRev  = cur.revenue.total;
  const cCogs = cur.costs.totalCOGS;
  const cOpex = cur.costs.totalOpEx;
  const cGP   = cRev - cCogs;
  const cEM   = cRev > 0 ? (cGP - cOpex) / cRev * 100 : 0;
  const cGM   = cRev > 0 ? cGP / cRev * 100 : 0;

  const pRev  = prev.revenue.total;
  const pCogs = prev.costs.totalCOGS;
  const pOpex = prev.costs.totalOpEx;
  const pGP   = pRev - pCogs;
  const pEM   = pRev > 0 ? (pGP - pOpex) / pRev * 100 : 0;
  const pGM   = pRev > 0 ? pGP / pRev * 100 : 0;

  // Revenue change
  const revDelta = pRev > 0 ? ((cRev - pRev) / pRev) * 100 : 0;
  if (Math.abs(revDelta) >= 5) {
    alerts.push({
      id: 'rev-delta',
      severity: Math.abs(revDelta) >= 15 ? 'HIGH' : 'MEDIUM',
      title: `Revenue ${revDelta >= 0 ? '↑' : '↓'} ${Math.abs(revDelta).toFixed(1)}%`,
      message: `Revenue moved from ${fmtN(pRev)} to ${fmtN(cRev)} vs prior period (${fmtPct(revDelta)}).`,
      rootCauseView: 'financial',
      rootCauseLabel: 'Financial',
      delta: revDelta,
      unit: '%',
    });
  }

  // Gross margin delta
  const gmDelta = cGM - pGM;
  if (Math.abs(gmDelta) >= 2) {
    alerts.push({
      id: 'gm-delta',
      severity: Math.abs(gmDelta) >= 5 ? 'HIGH' : 'MEDIUM',
      title: `Margin ${gmDelta >= 0 ? '↑' : '↓'} ${Math.abs(gmDelta).toFixed(1)}pp`,
      message: `Gross margin changed from ${pGM.toFixed(1)}% to ${cGM.toFixed(1)}% (${fmtPp(gmDelta)}).${gmDelta < 0 ? ' Check COGS — supplier costs or discounts may have increased.' : ''}`,
      rootCauseView: 'financial',
      rootCauseLabel: 'Financial',
      delta: gmDelta,
      unit: 'pp',
    });
  }

  // EBITDA margin delta
  const emDelta = cEM - pEM;
  if (Math.abs(emDelta) >= 2) {
    alerts.push({
      id: 'em-delta',
      severity: Math.abs(emDelta) >= 5 ? 'HIGH' : 'MEDIUM',
      title: `EBITDA margin ${emDelta >= 0 ? '↑' : '↓'} ${Math.abs(emDelta).toFixed(1)}pp`,
      message: `EBITDA margin moved from ${pEM.toFixed(1)}% to ${cEM.toFixed(1)}% (${fmtPp(emDelta)}).${emDelta < 0 ? ' OpEx growth may be outpacing revenue.' : ''}`,
      rootCauseView: 'financial',
      rootCauseLabel: 'Financial',
      delta: emDelta,
      unit: 'pp',
    });
  }

  // COGS as % of revenue
  const cCogsRatio = cRev > 0 ? cCogs / cRev * 100 : 0;
  const pCogsRatio = pRev > 0 ? pCogs / pRev * 100 : 0;
  const cogsDelta  = cCogsRatio - pCogsRatio;
  if (cogsDelta >= 2) {
    alerts.push({
      id: 'cogs-up',
      severity: cogsDelta >= 5 ? 'HIGH' : 'MEDIUM',
      title: `Supplier/delivery cost ↑ ${cogsDelta.toFixed(1)}pp`,
      message: `COGS as % of revenue rose from ${pCogsRatio.toFixed(1)}% to ${cCogsRatio.toFixed(1)}%. Review supplier pricing or delivery cost increases.`,
      rootCauseView: 'suppliers',
      rootCauseLabel: 'Suppliers',
      delta: cogsDelta,
      unit: 'pp',
    });
  }

  // OpEx ratio
  const cOpexRatio = cRev > 0 ? cOpex / cRev * 100 : 0;
  const pOpexRatio = pRev > 0 ? pOpex / pRev * 100 : 0;
  const opexDelta  = cOpexRatio - pOpexRatio;
  if (opexDelta >= 3) {
    alerts.push({
      id: 'opex-up',
      severity: opexDelta >= 6 ? 'HIGH' : 'MEDIUM',
      title: `OpEx ratio ↑ ${opexDelta.toFixed(1)}pp`,
      message: `Operating expenses as % of revenue grew from ${pOpexRatio.toFixed(1)}% to ${cOpexRatio.toFixed(1)}%.`,
      rootCauseView: 'financial',
      rootCauseLabel: 'Financial',
      delta: opexDelta,
      unit: 'pp',
    });
  }

  // Retention drop
  const cRet = (cur.customers.retentionRate ?? 0) * 100;
  const pRet = (prev.customers.retentionRate ?? 0) * 100;
  if (cRet > 0 && pRet > 0) {
    const retDelta = cRet - pRet;
    if (retDelta <= -3) {
      alerts.push({
        id: 'retention-drop',
        severity: retDelta <= -7 ? 'HIGH' : 'MEDIUM',
        title: `Retention ↓ ${Math.abs(retDelta).toFixed(1)}pp`,
        message: `Customer retention fell from ${pRet.toFixed(1)}% to ${cRet.toFixed(1)}%. Churn risk is elevated — review customer health.`,
        rootCauseView: 'customers',
        rootCauseLabel: 'Customers',
        delta: retDelta,
        unit: 'pp',
      });
    }
  }

  // Customer concentration increase
  const cTopPct = cur.customers.topCustomers[0]?.percentOfTotal ?? 0;
  const pTopPct = prev.customers.topCustomers[0]?.percentOfTotal ?? 0;
  const concDelta = cTopPct - pTopPct;
  if (concDelta >= 3 && cTopPct >= 20) {
    alerts.push({
      id: 'concentration-up',
      severity: cTopPct >= 35 ? 'HIGH' : 'MEDIUM',
      title: `Concentration ↑ ${concDelta.toFixed(1)}pp`,
      message: `Top customer now ${cTopPct.toFixed(0)}% of revenue (was ${pTopPct.toFixed(0)}%). Concentration risk is rising.`,
      rootCauseView: 'customers',
      rootCauseLabel: 'Customers',
      delta: concDelta,
      unit: 'pp',
    });
  }

  // Positive: margin improvement
  if (gmDelta >= 3 && !alerts.find(a => a.id === 'gm-delta')) {
    alerts.push({
      id: 'gm-up',
      severity: 'LOW',
      title: `Margin improved ${gmDelta.toFixed(1)}pp`,
      message: `Gross margin up from ${pGM.toFixed(1)}% to ${cGM.toFixed(1)}% — positive trend.`,
      rootCauseView: 'financial',
      rootCauseLabel: 'Financial',
      delta: gmDelta,
    });
  }

  return alerts.sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ── Internal SKU benchmarking ─────────────────────────────────────────────────
function InternalBenchmarks({ data }: { data: UnifiedBusinessData }) {
  const products = data.revenue.byProduct ?? [];
  const customers = data.customers.topCustomers ?? [];

  if (products.length < 2 && customers.length < 2) {
    return (
      <div className="text-[11px] text-slate-600 text-center py-4">
        Upload product and customer data to see internal benchmarks.
      </div>
    );
  }

  const totalRev = data.revenue.total;

  return (
    <div className="space-y-4">
      {/* SKU / Product benchmarking */}
      {products.length >= 2 && (
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-2.5">
            Product Performance
          </div>
          <div className="space-y-2">
            {products.map((p, i) => {
              const pct = totalRev > 0 ? (p.amount / totalRev) * 100 : 0;
              const margin = p.margin ? p.margin * 100 : null;
              const isTopMargin = products.every(q => !q.margin || p.margin! >= q.margin!);
              const isLowMargin = margin !== null && margin < 30;
              return (
                <div key={i} className="flex items-center gap-3 bg-slate-900/30 border border-slate-800/40 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-slate-200 truncate">{p.name}</span>
                      {isTopMargin && margin !== null && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Top margin</span>
                      )}
                      {isLowMargin && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Below 30%</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px] font-semibold text-slate-100 tabular-nums">{fmtN(p.amount)}</div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[10px] text-slate-500">{pct.toFixed(0)}% of rev</span>
                      {margin !== null && (
                        <span className={`text-[10px] font-semibold ${margin >= 40 ? 'text-emerald-400' : margin >= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                          {margin.toFixed(0)}% margin
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Margin dispersion */}
          {products.filter(p => p.margin != null).length >= 2 && (() => {
            const margins = products.filter(p => p.margin != null).map(p => p.margin! * 100);
            const spread  = Math.max(...margins) - Math.min(...margins);
            return spread > 10 ? (
              <div className="mt-2 flex items-start gap-2 text-[11px] text-amber-400/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                <span className="flex-shrink-0">⚠</span>
                <span>
                  {spread.toFixed(0)}pp margin spread across products — consider whether low-margin products are worth the overhead.
                </span>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Customer benchmarking */}
      {customers.length >= 2 && (
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-2.5">
            Customer Concentration
          </div>
          <div className="space-y-1.5">
            {customers.slice(0, 6).map((c, i) => {
              const pct = c.percentOfTotal;
              const isRisk = pct > 20;
              const barColor = isRisk ? 'bg-amber-500/50' : 'bg-indigo-500/40';
              return (
                <div key={c.id ?? i} className="flex items-center gap-3">
                  <div className="text-[11px] text-slate-400 w-28 truncate flex-shrink-0">{c.name}</div>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }}/>
                  </div>
                  <div className={`text-[11px] font-semibold tabular-nums w-10 text-right flex-shrink-0 ${isRisk ? 'text-amber-400' : 'text-slate-400'}`}>
                    {pct.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
          {customers[0]?.percentOfTotal > 25 && (
            <div className="mt-2 text-[10px] text-amber-400/70 font-medium">
              Top customer {customers[0].name} at {customers[0].percentOfTotal.toFixed(0)}% — above 20% risk threshold.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<Severity, { pill: string; row: string; icon: string }> = {
  HIGH:   { pill: 'text-red-400 bg-red-500/10 border-red-500/25',     row: 'border-red-500/15 bg-red-500/4',     icon: '🔴' },
  MEDIUM: { pill: 'text-amber-400 bg-amber-500/10 border-amber-500/25', row: 'border-amber-500/15 bg-amber-500/4', icon: '🟡' },
  LOW:    { pill: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', row: 'border-emerald-500/15',          icon: '🟢' },
};

export default function BenchmarkFeed({ data, previousData, onNavigate, onAskAI }: Props) {
  const [tab, setTab] = useState<'deltas' | 'internal'>('deltas');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts = useMemo(() => {
    if (!previousData) return [];
    return computeAlerts(data, previousData);
  }, [data, previousData]);

  const visible = alerts.filter(a => !dismissed.has(a.id));
  const highCount = visible.filter(a => a.severity === 'HIGH').length;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-[12px] font-semibold text-slate-200">Benchmarks & Signals</div>
          {highCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              {highCount} HIGH
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5">
          {(['deltas', 'internal'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                tab === t ? 'bg-slate-700/80 text-slate-100' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'deltas' ? 'Period Deltas' : 'Internal'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === 'deltas' && (
          <>
            {!previousData && (
              <div className="text-center py-6 text-[11px] text-slate-600">
                Upload a second period snapshot to see metric change signals.
              </div>
            )}
            {previousData && visible.length === 0 && (
              <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                <span className="text-emerald-400">✓</span>
                <span className="text-[12px] text-emerald-400">No significant metric shifts detected vs prior period.</span>
              </div>
            )}
            {visible.length > 0 && (
              <div className="space-y-2">
                {visible.map(alert => {
                  const s = SEVERITY_STYLE[alert.severity];
                  return (
                    <div key={alert.id} className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 group ${s.row}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.pill}`}>
                            {alert.severity}
                          </span>
                          <span className="text-[12px] font-semibold text-slate-100">{alert.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 leading-relaxed mb-1.5">{alert.message}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {alert.rootCauseView && onNavigate && (
                            <button
                              onClick={() => onNavigate(alert.rootCauseView!)}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-lg bg-slate-800/50 border border-slate-700/30 text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              View {alert.rootCauseLabel}
                              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2 h-2"><path d="M3.5 2.5l3 2.5-3 2.5"/></svg>
                            </button>
                          )}
                          {onAskAI && (
                            <button
                              onClick={() => onAskAI(`I have a metric change alert: ${alert.title}. ${alert.message} What should I investigate and do?`)}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-lg bg-indigo-500/8 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              Ask AI
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setDismissed(prev => new Set(Array.from(prev).concat(alert.id)))}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-slate-500 hover:text-slate-300 text-lg leading-none transition-all"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {dismissed.size > 0 && (
              <button
                onClick={() => setDismissed(new Set())}
                className="mt-3 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                Restore {dismissed.size} dismissed
              </button>
            )}
          </>
        )}

        {tab === 'internal' && (
          <InternalBenchmarks data={data} />
        )}
      </div>
    </div>
  );
}
