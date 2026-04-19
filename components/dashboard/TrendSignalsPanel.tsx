import { fmtMoney } from '../../lib/format';
import type { UnifiedBusinessData } from '../../types';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

const fmt = fmtMoney;

type SignalSeverity = 'positive' | 'warning' | 'negative' | 'neutral' | 'info';

interface Signal {
  icon: string;
  title: string;
  body: string;
  severity: SignalSeverity;
}

const SEVERITY_STYLES: Record<SignalSeverity, { border: string; bg: string; icon: string; badge: string }> = {
  positive: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/4',  icon: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400' },
  warning:  { border: 'border-amber-500/20',   bg: 'bg-amber-500/4',    icon: 'text-amber-400',   badge: 'bg-amber-500/15 text-amber-400'   },
  negative: { border: 'border-red-500/20',     bg: 'bg-red-500/4',      icon: 'text-red-400',     badge: 'bg-red-500/15 text-red-400'       },
  neutral:  { border: 'border-slate-700/40',   bg: 'bg-slate-800/20',   icon: 'text-slate-400',   badge: 'bg-slate-700/40 text-slate-400'   },
  info:     { border: 'border-indigo-500/20',  bg: 'bg-indigo-500/4',   icon: 'text-indigo-400',  badge: 'bg-indigo-500/15 text-indigo-400' },
};

function computeSignals(data: UnifiedBusinessData, previousData?: UnifiedBusinessData): Signal[] {
  const signals: Signal[] = [];
  const periods = data.revenue.byPeriod;
  if (periods.length < 2) return signals;

  const revs = periods.map(p => p.revenue);
  const n    = revs.length;

  // ── 1. Consecutive growth / decline streak ──────────────────────────────
  let streak = 1;
  let streakDir: 'up' | 'down' = revs[n - 1] >= revs[n - 2] ? 'up' : 'down';
  for (let i = n - 2; i > 0; i--) {
    if (streakDir === 'up'   && revs[i] >= revs[i - 1]) streak++;
    else if (streakDir === 'down' && revs[i] <= revs[i - 1]) streak++;
    else break;
  }
  if (streak >= 2) {
    const pct = ((revs[n - 1] - revs[n - streak]) / revs[n - streak]) * 100;
    signals.push({
      icon: streakDir === 'up' ? '↑' : '↓',
      title: `${streak}-period ${streakDir === 'up' ? 'growth streak' : 'decline streak'}`,
      body: streakDir === 'up'
        ? `Revenue has grown for ${streak} consecutive periods (+${pct.toFixed(1)}% cumulatively). Strong momentum.`
        : `Revenue has declined for ${streak} consecutive periods (${pct.toFixed(1)}% cumulatively). Investigate the cause.`,
      severity: streakDir === 'up' ? (streak >= 3 ? 'positive' : 'info') : (streak >= 3 ? 'negative' : 'warning'),
    });
  }

  // ── 2. Peak / trough identification ─────────────────────────────────────
  const maxRev  = Math.max(...revs);
  const minRev  = Math.min(...revs);
  const maxIdx  = revs.indexOf(maxRev);
  const minIdx  = revs.indexOf(minRev);
  const isAtPeak   = maxIdx === n - 1;
  const isAtTrough = minIdx === n - 1;

  if (isAtPeak && n >= 3) {
    signals.push({
      icon: '⭐',
      title: `Peak revenue — ${periods[maxIdx].period}`,
      body: `${fmt(maxRev)} is the highest revenue in the dataset. You're at an all-time high for this period.`,
      severity: 'positive',
    });
  } else if (isAtTrough && n >= 3) {
    signals.push({
      icon: '⚠',
      title: `Lowest revenue — ${periods[minIdx].period}`,
      body: `${fmt(minRev)} is the lowest in the dataset. Current revenue is ${(((maxRev - minRev) / maxRev) * 100).toFixed(1)}% below the peak of ${fmt(maxRev)}.`,
      severity: 'negative',
    });
  } else if (n >= 3) {
    signals.push({
      icon: '◎',
      title: `Peak: ${periods[maxIdx].period} · Low: ${periods[minIdx].period}`,
      body: `Highest period was ${fmt(maxRev)} (+${(((maxRev - minRev) / minRev) * 100).toFixed(1)}% above trough of ${fmt(minRev)}).`,
      severity: 'neutral',
    });
  }

  // ── 3. Growth acceleration / deceleration ───────────────────────────────
  if (n >= 4) {
    const recentGrowths = revs.slice(-3).map((r, i, arr) =>
      i > 0 ? ((r - arr[i - 1]) / arr[i - 1]) * 100 : null
    ).filter((g): g is number => g !== null);

    if (recentGrowths.length >= 2) {
      const latestGrowth   = recentGrowths[recentGrowths.length - 1];
      const previousGrowth = recentGrowths[recentGrowths.length - 2];
      const acceleration   = latestGrowth - previousGrowth;

      if (Math.abs(acceleration) >= 3) {
        const isAccelerating = acceleration > 0;
        signals.push({
          icon: isAccelerating ? '⚡' : '🔻',
          title: isAccelerating ? 'Growth accelerating' : 'Growth decelerating',
          body: isAccelerating
            ? `MoM growth improved from ${previousGrowth.toFixed(1)}% to ${latestGrowth.toFixed(1)}% — positive momentum building.`
            : `MoM growth slowed from ${previousGrowth.toFixed(1)}% to ${latestGrowth.toFixed(1)}%. Watch for continued deceleration.`,
          severity: isAccelerating ? 'positive' : 'warning',
        });
      }
    }
  }

  // ── 4. Moving average comparison ────────────────────────────────────────
  if (n >= 3) {
    const ma3 = revs.slice(-3, -1).reduce((s, r) => s + r, 0) / 2;
    const latest = revs[n - 1];
    const diff   = ((latest - ma3) / ma3) * 100;

    if (Math.abs(diff) >= 5) {
      signals.push({
        icon: diff > 0 ? '↗' : '↘',
        title: diff > 0 ? 'Above 2-period average' : 'Below 2-period average',
        body: `Latest revenue (${fmt(latest)}) is ${Math.abs(diff).toFixed(1)}% ${diff > 0 ? 'above' : 'below'} the prior 2-period average of ${fmt(ma3)}.`,
        severity: diff > 0 ? 'positive' : 'warning',
      });
    }
  }

  // ── 5. Seasonality (requires ≥12 periods) ───────────────────────────────
  if (n >= 12) {
    const byMonth: Record<string, number[]> = {};
    periods.forEach(p => {
      // Extract month name from period string
      const match = p.period.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
      if (match) {
        const mo = match[1];
        if (!byMonth[mo]) byMonth[mo] = [];
        byMonth[mo].push(p.revenue);
      }
    });
    const monthAvgs = Object.entries(byMonth)
      .filter(([, vals]) => vals.length >= 2)
      .map(([mo, vals]) => ({ mo, avg: vals.reduce((s, v) => s + v, 0) / vals.length }))
      .sort((a, b) => b.avg - a.avg);

    if (monthAvgs.length >= 3) {
      const peak   = monthAvgs[0];
      const trough = monthAvgs[monthAvgs.length - 1];
      const swing  = ((peak.avg - trough.avg) / trough.avg) * 100;
      signals.push({
        icon: '📅',
        title: `Seasonal pattern detected`,
        body: `${peak.mo} tends to be your strongest month (avg ${fmt(peak.avg)}); ${trough.mo} your weakest (avg ${fmt(trough.avg)}). Seasonal swing: ${swing.toFixed(0)}%.`,
        severity: 'info',
      });
    }
  }

  // ── 6. Revenue forecast via linear regression ───────────────────────────
  if (n >= 3) {
    const xMean = (n - 1) / 2;
    const yMean = revs.reduce((s, v) => s + v, 0) / n;
    const num   = revs.reduce((s, v, i) => s + (i - xMean) * (v - yMean), 0);
    const den   = revs.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;
    const nextEst = intercept + slope * n;
    const ssRes = revs.reduce((s, v, i) => s + (v - (intercept + slope * i)) ** 2, 0);
    const ssTot = revs.reduce((s, v) => s + (v - yMean) ** 2, 0);
    const rSq   = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
    const projGrowth = revs[n - 1] > 0 ? ((nextEst - revs[n - 1]) / revs[n - 1]) * 100 : 0;
    const confidence = rSq >= 0.85 ? 'high confidence' : rSq >= 0.55 ? 'moderate confidence' : 'low confidence';
    if (nextEst > 0 && Math.abs(projGrowth) >= 1) {
      signals.push({
        icon: '🎯',
        title: `Forecast: ${fmt(nextEst)} next period`,
        body: `Linear trend projects ${projGrowth >= 0 ? '+' : ''}${projGrowth.toFixed(1)}% (${fmt(nextEst)}) in the next period. ${confidence} — R² = ${(rSq * 100).toFixed(0)}% based on ${n} periods.`,
        severity: projGrowth >= 10 ? 'positive' : projGrowth >= 0 ? 'info' : projGrowth >= -5 ? 'warning' : 'negative',
      });
    }
  }

  // ── 7. Period-over-period vs prior year (previously 6) ───────────────────
  if (previousData && previousData.revenue.byPeriod.length > 0) {
    const curTotal  = data.revenue.total;
    const prevTotal = previousData.revenue.total;
    const yoy = prevTotal > 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : null;
    if (yoy !== null) {
      signals.push({
        icon: yoy >= 0 ? '↑' : '↓',
        title: `${Math.abs(yoy).toFixed(1)}% ${yoy >= 0 ? 'growth' : 'decline'} vs prior period`,
        body: yoy >= 0
          ? `Revenue grew ${yoy.toFixed(1)}% from ${fmt(prevTotal)} to ${fmt(curTotal)} compared to the prior period snapshot.`
          : `Revenue declined ${Math.abs(yoy).toFixed(1)}% from ${fmt(prevTotal)} to ${fmt(curTotal)} vs prior period. Review the drivers.`,
        severity: yoy >= 15 ? 'positive' : yoy >= 0 ? 'info' : yoy >= -10 ? 'warning' : 'negative',
      });
    }
  }

  // ── 8. Margin trend ──────────────────────────────────────────────────────
  const periodsWithCOGS = periods.filter(p => p.cogs != null && p.cogs > 0);
  if (periodsWithCOGS.length >= 3) {
    const margins = periodsWithCOGS.map(p => ((p.revenue - p.cogs!) / p.revenue) * 100);
    const recentMargin = margins[margins.length - 1];
    const prevMargin   = margins[margins.length - 2];
    const firstMargin  = margins[0];
    const overallDelta = recentMargin - firstMargin;

    if (Math.abs(overallDelta) >= 2) {
      signals.push({
        icon: overallDelta > 0 ? '▲' : '▼',
        title: `Gross margin ${overallDelta > 0 ? 'expanding' : 'compressing'}`,
        body: `Gross margin ${overallDelta > 0 ? 'improved' : 'declined'} from ${firstMargin.toFixed(1)}% to ${recentMargin.toFixed(1)}% (${Math.abs(overallDelta).toFixed(1)}pp ${overallDelta > 0 ? 'improvement' : 'deterioration'}).`,
        severity: overallDelta > 0 ? 'positive' : overallDelta >= -3 ? 'warning' : 'negative',
      });
    }
    if (recentMargin < prevMargin - 2) {
      signals.push({
        icon: '⚠',
        title: 'Margin dropped last period',
        body: `Gross margin fell from ${prevMargin.toFixed(1)}% to ${recentMargin.toFixed(1)}% — a ${(prevMargin - recentMargin).toFixed(1)}pp drop. Check COGS for unusual costs.`,
        severity: 'warning',
      });
    }
  }

  return signals;
}

export default function TrendSignalsPanel({ data, previousData, onAskAI }: Props) {
  const signals = computeSignals(data, previousData);

  if (signals.length === 0) {
    return null;
  }

  const positiveCount = signals.filter(s => s.severity === 'positive').length;
  const warningCount  = signals.filter(s => s.severity === 'warning' || s.severity === 'negative').length;

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Trend Signals</div>
          <div className="flex items-center gap-2 mt-0.5">
            {positiveCount > 0 && (
              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full">
                {positiveCount} positive
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full">
                {warningCount} watch
              </span>
            )}
          </div>
        </div>
        {onAskAI && (
          <button
            onClick={() => onAskAI(
              `Here are my business trend signals: ${signals.map(s => `${s.title}: ${s.body}`).join(' | ')}. ` +
              `What are the most important patterns I should act on?`
            )}
            className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1.5 rounded-lg transition-all font-medium"
          >
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
              <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
              <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
            </svg>
            Ask AI
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {signals.map((signal, i) => {
          const styles = SEVERITY_STYLES[signal.severity];
          return (
            <div key={i} className={`border ${styles.border} ${styles.bg} rounded-xl p-4`}>
              <div className="flex items-start gap-3">
                <div className={`text-[16px] flex-shrink-0 leading-none mt-0.5 ${styles.icon}`}>
                  {signal.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-slate-200 leading-snug mb-1">
                    {signal.title}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed">
                    {signal.body}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
