import { useState, useEffect } from 'react';
import type { UnifiedBusinessData } from '../../types';

const WC_STORAGE_KEY = 'bos_working_capital';

const fmt = (n: number) => {
  const abs = Math.abs(n);
  return abs >= 1e6 ? `$${(abs/1e6).toFixed(2)}M` : abs >= 1e3 ? `$${(abs/1e3).toFixed(0)}k` : `$${Math.round(abs).toLocaleString()}`;
};

function MetricCard({
  label, value, unit, benchmark, benchmarkLabel, note, color,
}: {
  label: string; value: number | null; unit: string;
  benchmark?: number; benchmarkLabel?: string;
  note?: string; color?: string;
}) {
  const display = value !== null ? `${Math.round(value)}${unit}` : 'N/A';
  const status = value === null ? 'neutral'
    : benchmark === undefined ? 'neutral'
    : unit === ' days' && label.includes('DSO') ? (value <= 30 ? 'green' : value <= 45 ? 'yellow' : 'red')
    : unit === ' days' && label.includes('DPO') ? (value >= 30 ? 'green' : value >= 20 ? 'yellow' : 'red')
    : unit === ' days' && label.includes('CCC') ? (value <= 30 ? 'green' : value <= 50 ? 'yellow' : 'red')
    : 'neutral';

  const statusColor = status === 'green' ? 'text-emerald-400' : status === 'yellow' ? 'text-amber-400' : status === 'red' ? 'text-red-400' : color ?? 'text-slate-200';

  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4">
      <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-[26px] font-bold tabular-nums leading-none ${statusColor}`}>{display}</div>
      {benchmark !== undefined && (
        <div className="text-[10px] text-slate-600 mt-1.5">
          Benchmark: <span className="text-slate-500">{benchmark}{unit}</span>
          {benchmarkLabel && ` (${benchmarkLabel})`}
        </div>
      )}
      {note && <div className="text-[10px] text-slate-600 mt-1 leading-relaxed">{note}</div>}
    </div>
  );
}

export default function WorkingCapitalDashboard({
  data, onAskAI,
}: { data: UnifiedBusinessData; onAskAI?: (m: string) => void }) {
  // Manually entered AP, inventory, accrued (since we typically don't have these in CSV)
  const [ap,          setAp]          = useState(() => {
    if (typeof window === 'undefined') return 0;
    try { return JSON.parse(localStorage.getItem(WC_STORAGE_KEY) ?? '{}').ap ?? 0; } catch { return 0; }
  });
  const [inventory,   setInventory]   = useState(() => {
    if (typeof window === 'undefined') return 0;
    try { return JSON.parse(localStorage.getItem(WC_STORAGE_KEY) ?? '{}').inventory ?? 0; } catch { return 0; }
  });
  const [accrued,     setAccrued]     = useState(() => {
    if (typeof window === 'undefined') return 0;
    try { return JSON.parse(localStorage.getItem(WC_STORAGE_KEY) ?? '{}').accrued ?? 0; } catch { return 0; }
  });
  const [showInputs,  setShowInputs]  = useState(false);
  const [pegMonths,   setPegMonths]   = useState(() => {
    if (typeof window === 'undefined') return 2.0;
    try { return JSON.parse(localStorage.getItem(WC_STORAGE_KEY) ?? '{}').pegMonths ?? 2.0; } catch { return 2.0; }
  });

  // Persist working capital inputs across refreshes
  useEffect(() => {
    try { localStorage.setItem(WC_STORAGE_KEY, JSON.stringify({ ap, inventory, accrued, pegMonths })); } catch { /* ignore */ }
  }, [ap, inventory, accrued, pegMonths]);

  const rev  = data.revenue.total;
  const cogs = data.costs.totalCOGS;

  // AR from arAging (total of all buckets)
  const totalAR = data.arAging?.reduce((s, b) => s + b.total, 0) ?? 0;

  // DSO = (AR / Revenue) * 365
  const dso = rev > 0 && totalAR > 0 ? (totalAR / rev) * 365 : null;

  // DPO = (AP / COGS) * 365  — requires AP input
  const dpo = cogs > 0 && ap > 0 ? (ap / cogs) * 365 : null;

  // DIO = (Inventory / COGS) * 365 — requires inventory input (0 for service cos)
  const dio = cogs > 0 && inventory > 0 ? (inventory / cogs) * 365 : 0;

  // CCC = DSO + DIO - DPO
  const ccc = dso !== null && dpo !== null ? dso + dio - dpo : dso !== null ? dso + dio : null;

  // NWC = AR + Inventory - AP - Accrued
  const nwc = totalAR + inventory - ap - accrued;

  // NWC Peg (target NWC for deal closing) = pegMonths × monthly revenue
  const monthlyRev = rev / 12;
  const nwcPeg = monthlyRev * pegMonths;
  const nwcVsPeg = nwc - nwcPeg;

  // Overdue AR analysis
  const overdue30  = data.arAging?.reduce((s,b) => s + b.days30,  0) ?? 0;
  const overdue60  = data.arAging?.reduce((s,b) => s + b.days60,  0) ?? 0;
  const overdue90  = data.arAging?.reduce((s,b) => s + b.days90,  0) ?? 0;
  const overdueOut = data.arAging?.reduce((s,b) => s + b.over90,  0) ?? 0;
  const current    = data.arAging?.reduce((s,b) => s + b.current, 0) ?? 0;
  const totalARCk  = current + overdue30 + overdue60 + overdue90 + overdueOut;

  const hasARData = totalARCk > 0;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/40 flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-slate-100">Working Capital Dashboard</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              DSO · DPO · CCC · NWC peg — key metrics for deal structuring
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowInputs(p => !p)}
              className="text-[11px] text-slate-500 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600 px-2.5 py-1 rounded-lg transition-colors font-medium">
              {showInputs ? 'Hide inputs' : 'Enter AP / Inventory'}
            </button>
            {onAskAI && (
              <button onClick={() => onAskAI(
                `Working capital metrics: DSO ${dso !== null ? Math.round(dso)+' days' : 'N/A'}, ` +
                `DPO ${dpo !== null ? Math.round(dpo)+' days' : 'N/A (AP not entered)'}, ` +
                `CCC ${ccc !== null ? Math.round(ccc)+' days' : 'N/A'}, ` +
                `NWC ${fmt(nwc)} vs peg of ${fmt(nwcPeg)}. ` +
                `What do these say about the business's cash conversion efficiency and what should we focus on?`
              )}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-colors font-medium">
                Ask AI
              </button>
            )}
          </div>
        </div>

        {/* Manual inputs */}
        {showInputs && (
          <div className="px-5 py-4 border-b border-slate-800/40 bg-slate-900/30">
            <div className="text-[11px] text-slate-500 mb-3">Enter balance sheet items to unlock DPO, CCC, and full NWC.</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Accounts Payable ($)', val: ap,        set: setAp,        hint: 'From balance sheet' },
                { label: 'Inventory ($)',         val: inventory, set: setInventory, hint: '0 for service biz' },
                { label: 'Accrued Liabilities ($)',val: accrued,  set: setAccrued,   hint: 'Wages, expenses owed' },
                { label: 'NWC Peg (months rev)',  val: pegMonths, set: setPegMonths, hint: 'Typically 1.5–3 months', step: 0.5, min: 0, max: 12 },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                  <input type="number" value={f.val} step={f.step ?? 1000} min={f.min ?? 0} max={f.max}
                    onChange={e => f.set(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/50"/>
                  <div className="text-[10px] text-slate-700 mt-0.5">{f.hint}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics grid */}
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="DSO" value={dso} unit=" days"
            benchmark={35} benchmarkLabel="LMM median"
            note={hasARData ? `AR: ${fmt(totalAR)}` : 'Upload AR aging to calculate'}/>
          <MetricCard label="DPO" value={dpo} unit=" days"
            benchmark={30} benchmarkLabel="typical target"
            note={ap > 0 ? `AP: ${fmt(ap)}` : 'Enter AP above to calculate'}/>
          <MetricCard label="DIO" value={dio || 0} unit=" days"
            note={inventory === 0 ? 'No inventory (service business)' : `Inventory: ${fmt(inventory)}`}/>
          <MetricCard label="CCC" value={ccc} unit=" days"
            benchmark={40} benchmarkLabel="LMM benchmark"
            note="DSO + DIO − DPO"/>
        </div>

        {/* NWC peg section */}
        <div className="mx-5 mb-5 bg-slate-800/30 border border-slate-700/40 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3 gap-3">
            <div>
              <div className="text-[12px] font-semibold text-slate-200">NWC Peg Analysis</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Working capital adjustment at closing · standard deal mechanic</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[11px] text-slate-500">Target peg</div>
              <div className="text-[16px] font-bold text-slate-200 tabular-nums">{fmt(nwcPeg)}</div>
              <div className="text-[10px] text-slate-600">{pegMonths} × monthly revenue</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Current AR',    val: totalAR,      color: 'text-slate-200' },
              { label: 'NWC (Current)', val: nwc,          color: nwc >= 0 ? 'text-slate-200' : 'text-red-400' },
              { label: 'vs Peg',        val: nwcVsPeg,     color: nwcVsPeg >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/40 rounded-lg px-3 py-2.5">
                <div className="text-[10px] text-slate-600 mb-1">{s.label}</div>
                <div className={`text-[15px] font-bold tabular-nums ${s.color}`}>
                  {s.label === 'vs Peg' ? (nwcVsPeg >= 0 ? `+${fmt(nwcVsPeg)}` : `(${fmt(Math.abs(nwcVsPeg))})`) : fmt(s.val)}
                </div>
              </div>
            ))}
          </div>
          {nwcVsPeg < 0 && (
            <div className="mt-3 text-[11px] text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              NWC is <span className="font-bold">{fmt(Math.abs(nwcVsPeg))}</span> below the peg — seller may owe a purchase price adjustment at closing.
              {' '}Improve AR collections or negotiate a lower peg with the buyer.
            </div>
          )}
          {nwcVsPeg >= 0 && nwc > 0 && (
            <div className="mt-3 text-[11px] text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
              NWC is <span className="font-bold">{fmt(nwcVsPeg)}</span> above the peg — seller may be entitled to a purchase price true-up at closing.
            </div>
          )}
        </div>
      </div>

      {/* AR Aging breakdown */}
      {hasARData && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/40">
            <div className="text-[12px] font-semibold text-slate-200">AR Aging Breakdown</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Total outstanding: {fmt(totalARCk)}</div>
          </div>
          <div className="px-5 py-4">
            {/* Bar chart */}
            {[
              { label: 'Current',  val: current,    color: 'bg-emerald-500/70' },
              { label: '1–30 days',val: overdue30,  color: 'bg-amber-500/60' },
              { label: '31–60 days',val: overdue60, color: 'bg-orange-500/60' },
              { label: '61–90 days',val: overdue90, color: 'bg-red-500/60' },
              { label: '90+ days', val: overdueOut, color: 'bg-red-700/80' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 mb-2 last:mb-0">
                <div className="w-20 text-right text-[11px] text-slate-500 flex-shrink-0">{row.label}</div>
                <div className="flex-1 h-5 bg-slate-800/40 rounded-md overflow-hidden">
                  <div className={`h-full rounded-md transition-all ${row.color}`}
                    style={{ width: totalARCk > 0 ? `${(row.val / totalARCk) * 100}%` : '0%' }}/>
                </div>
                <div className="w-20 text-right text-[11px] font-semibold text-slate-300 tabular-nums flex-shrink-0">{fmt(row.val)}</div>
                <div className="w-10 text-right text-[10px] text-slate-600 flex-shrink-0">
                  {totalARCk > 0 ? ((row.val/totalARCk)*100).toFixed(0) + '%' : '—'}
                </div>
              </div>
            ))}

            {/* At-risk customers */}
            {data.arAging && data.arAging.filter(b => b.over90 > 0 || b.days90 > 0).length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">At-risk AR (60+ days)</div>
                <div className="space-y-1">
                  {data.arAging
                    .filter(b => b.days60 + b.days90 + b.over90 > 0)
                    .sort((a,b) => (b.days60+b.days90+b.over90) - (a.days60+a.days90+a.over90))
                    .slice(0, 5)
                    .map(b => (
                      <div key={b.customer} className="flex items-center justify-between bg-slate-800/30 border border-red-500/10 rounded-lg px-3 py-2">
                        <span className="text-[11px] text-slate-300 truncate">{b.customer}</span>
                        <div className="flex gap-3 text-[10px] flex-shrink-0 ml-3">
                          {b.days60 > 0 && <span className="text-orange-400">60d: {fmt(b.days60)}</span>}
                          {b.days90 > 0 && <span className="text-red-400">90d: {fmt(b.days90)}</span>}
                          {b.over90 > 0 && <span className="text-red-600 font-semibold">90+: {fmt(b.over90)}</span>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
