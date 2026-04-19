import { useState } from 'react';
import type { UnifiedBusinessData, Budget } from '../../types';
import BudgetVarianceWaterfall from '../charts/BudgetVarianceWaterfall';

interface Props {
  data: UnifiedBusinessData;
  budget: Budget;
  onSetBudget: (key: keyof Budget, value: Budget[keyof Budget]) => void;
  onAskAI?: (msg: string) => void;
}

const fmtAmt = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` :
  Math.abs(n) >= 1_000     ? `$${(n / 1_000).toFixed(0)}k` :
  `$${n.toFixed(0)}`;

const fmtDelta = (n: number) => (n >= 0 ? '+' : '') + fmtAmt(n);
const fmtPct   = (n: number, places = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(places)}%`;

type BudgetLineKey = 'revenue' | 'cogs' | 'opex';

export default function BudgetPanel({ data, budget, onSetBudget, onAskAI }: Props) {
  const [editing, setEditing] = useState<BudgetLineKey | string | null>(null);
  const [draft, setDraft] = useState('');

  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const gp     = rev - cogs;
  const ebitda = gp - opex;

  const budgetGP     = budget.revenue != null && budget.cogs != null
    ? budget.revenue - budget.cogs : undefined;
  const budgetEBITDA = budgetGP != null && budget.opex != null
    ? budgetGP - budget.opex : undefined;

  const hasBudget = budget.revenue != null || budget.cogs != null || budget.opex != null;

  const startEdit = (key: string, currentValue?: number) => {
    setDraft(currentValue != null ? String(currentValue) : '');
    setEditing(key);
  };

  const commitEdit = (key: string) => {
    const num = parseFloat(draft);
    if (key === 'revenue' || key === 'cogs' || key === 'opex') {
      if (!isNaN(num) && num >= 0) {
        onSetBudget(key as BudgetLineKey, num);
      } else if (draft === '') {
        onSetBudget(key as BudgetLineKey, undefined);
      }
    } else if (key.startsWith('cat:')) {
      const catName = key.slice(4);
      const catBudgetUpdated = { ...(budget.byCategory ?? {}) };
      if (!isNaN(num) && num >= 0) {
        catBudgetUpdated[catName] = num;
      } else if (draft === '') {
        delete catBudgetUpdated[catName];
      }
      onSetBudget('byCategory', catBudgetUpdated);
    }
    setEditing(null);
  };

  const useActuals = () => {
    onSetBudget('revenue', rev);
    onSetBudget('cogs', cogs);
    onSetBudget('opex', opex);
  };

  // Row definitions
  const rows: {
    key: BudgetLineKey | 'gp' | 'ebitda';
    label: string;
    actual: number;
    budgeted: number | undefined;
    editable: boolean;
    bold: boolean;
    separator?: boolean;
    isCost?: boolean;
  }[] = [
    { key: 'revenue', label: 'Revenue',       actual: rev,    budgeted: budget.revenue, editable: true,  bold: false },
    { key: 'cogs',    label: 'Cost of Goods',  actual: cogs,   budgeted: budget.cogs,    editable: true,  bold: false, isCost: true },
    { key: 'gp',      label: 'Gross Profit',   actual: gp,     budgeted: budgetGP,       editable: false, bold: true, separator: true },
    { key: 'opex',    label: 'Operating Exp.', actual: opex,   budgeted: budget.opex,    editable: true,  bold: false, isCost: true },
    { key: 'ebitda',  label: 'EBITDA',         actual: ebitda, budgeted: budgetEBITDA,   editable: false, bold: true, separator: true },
  ];

  // Summary attainment stat
  const revAttainment = budget.revenue && budget.revenue > 0
    ? (rev / budget.revenue) * 100 : null;
  const ebitdaAttainment = budgetEBITDA && budgetEBITDA > 0 && ebitda !== 0
    ? (ebitda / budgetEBITDA) * 100 : null;

  // Category breakdown if budget has category data
  const catBudget = budget.byCategory ?? {};

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-slate-500">
          {hasBudget
            ? 'Click any budget cell to edit · Enter to save'
            : 'No budget set — enter targets or use actuals as baseline'}
        </div>
        <div className="flex items-center gap-2">
          {!hasBudget && (
            <button
              onClick={useActuals}
              className="text-[11px] px-2.5 py-1 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-slate-200 rounded-lg transition-colors font-medium"
            >
              Use actuals as baseline
            </button>
          )}
          {hasBudget && onAskAI && (
            <button
              onClick={() => onAskAI(
                `My budget vs actuals: Revenue budgeted ${budget.revenue ? fmtAmt(budget.revenue) : 'n/a'} vs actual ${fmtAmt(rev)}` +
                (budget.cogs ? `, COGS budgeted ${fmtAmt(budget.cogs)} vs actual ${fmtAmt(cogs)}` : '') +
                (budget.opex ? `, OpEx budgeted ${fmtAmt(budget.opex)} vs actual ${fmtAmt(opex)}` : '') +
                (budgetEBITDA != null ? `, EBITDA budgeted ${fmtAmt(budgetEBITDA)} vs actual ${fmtAmt(ebitda)}` : '') +
                `. What are the most important variances to address?`
              )}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-colors"
            >
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
              </svg>
              Ask AI
            </button>
          )}
        </div>
      </div>

      {/* Attainment summary cards — only when budget is set */}
      {hasBudget && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Revenue Attainment',
              value: revAttainment,
              actual: fmtAmt(rev),
              budgeted: budget.revenue ? fmtAmt(budget.revenue) : '—',
              positive: true,
            },
            {
              label: 'EBITDA Attainment',
              value: ebitdaAttainment,
              actual: fmtAmt(ebitda),
              budgeted: budgetEBITDA != null ? fmtAmt(budgetEBITDA) : '—',
              positive: true,
            },
            {
              label: 'Gross Profit Attainment',
              value: budgetGP && budgetGP > 0 ? (gp / budgetGP) * 100 : null,
              actual: fmtAmt(gp),
              budgeted: budgetGP != null ? fmtAmt(budgetGP) : '—',
              positive: true,
            },
            {
              label: 'OpEx vs Budget',
              value: budget.opex && budget.opex > 0 ? (opex / budget.opex) * 100 : null,
              actual: fmtAmt(opex),
              budgeted: budget.opex ? fmtAmt(budget.opex) : '—',
              positive: false, // lower is better for costs
            },
          ].map(card => {
            const pct = card.value;
            const onTrack = pct != null && (card.positive ? pct >= 95 : pct <= 105);
            const over    = pct != null && (card.positive ? pct >= 100 : pct > 110);
            const color   = pct == null ? 'text-slate-500'
              : over    ? (card.positive ? 'text-emerald-400' : 'text-red-400')
              : onTrack ? 'text-amber-400'
              : (card.positive ? 'text-red-400' : 'text-emerald-400');
            const barColor = pct == null ? 'bg-slate-700'
              : over    ? (card.positive ? 'bg-emerald-500/50' : 'bg-red-500/50')
              : onTrack ? 'bg-amber-500/50'
              : (card.positive ? 'bg-red-500/50' : 'bg-emerald-500/50');

            return (
              <div key={card.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-2">{card.label}</div>
                <div className={`text-[20px] font-bold tracking-tight ${color}`}>
                  {pct != null ? `${pct.toFixed(0)}%` : '—'}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  {card.actual} <span className="text-slate-700">vs</span> {card.budgeted}
                </div>
                {pct != null && (
                  <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main comparison table */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_110px_110px_90px_80px_100px] gap-2 px-5 py-2.5 border-b border-slate-800/50 min-w-[580px]">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Line Item</div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] text-right">Budget</div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] text-right">Actual</div>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Variance $</div>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Variance %</div>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Attainment</div>
        </div>

        <div className="divide-y divide-slate-800/30">
          {rows.map(row => {
            const isEditing = editing === row.key;
            const bud = row.budgeted;
            const varAmt  = bud != null ? row.actual - bud : null;
            const varPct  = bud != null && bud !== 0 ? ((row.actual - bud) / Math.abs(bud)) * 100 : null;
            const attain  = bud != null && bud > 0 ? (row.actual / bud) * 100 : null;

            // For cost rows, favorable variance is negative (spent less than budgeted)
            const favorable = varAmt != null && (row.isCost ? varAmt <= 0 : varAmt >= 0);
            const deltaColor = varAmt == null ? 'text-slate-700'
              : varAmt === 0 ? 'text-slate-600'
              : favorable ? 'text-emerald-400' : 'text-red-400';

            const actualColor = row.bold
              ? (row.key === 'ebitda' || row.key === 'gp')
                ? (row.actual > 0 ? 'text-emerald-400' : 'text-red-400')
                : 'text-slate-100'
              : row.isCost ? 'text-red-400/80' : 'text-slate-200';

            return (
              <div key={row.key}>
                {row.separator && <div className="h-px bg-slate-800/60"/>}
                <div className={`grid grid-cols-[1fr_110px_110px_90px_80px_100px] gap-2 px-5 py-3 min-w-[580px] ${row.bold ? 'bg-slate-800/10' : ''}`}>
                  {/* Label */}
                  <div className={`text-[12px] ${row.bold ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>
                    {row.label}
                  </div>

                  {/* Budget (editable) */}
                  <div className="text-right font-mono">
                    {row.editable ? (
                      isEditing ? (
                        <input
                          autoFocus
                          type="number"
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(row.key);
                            if (e.key === 'Escape') setEditing(null);
                          }}
                          onBlur={() => commitEdit(row.key)}
                          placeholder="0"
                          className="w-full text-right bg-slate-800/80 border border-indigo-500/50 rounded px-1.5 py-0.5 text-[11px] text-slate-100 focus:outline-none tabular-nums"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(row.key, row.budgeted)}
                          className={`w-full text-right text-[12px] font-medium transition-colors rounded px-1 py-0.5 ${
                            bud != null
                              ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/40'
                              : 'text-slate-700 hover:text-slate-500 border border-dashed border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {bud != null ? fmtAmt(bud) : '+ set'}
                        </button>
                      )
                    ) : (
                      <span className={`text-[12px] ${bud != null ? 'text-slate-400' : 'text-slate-700'}`}>
                        {bud != null ? fmtAmt(bud) : '—'}
                      </span>
                    )}
                  </div>

                  {/* Actual */}
                  <div className={`text-right text-[12px] font-medium tabular-nums font-mono ${actualColor} ${row.bold ? 'font-bold' : ''}`}>
                    {fmtAmt(row.actual)}
                  </div>

                  {/* Variance $ */}
                  <div className={`text-right text-[12px] tabular-nums font-mono font-medium ${deltaColor}`}>
                    {varAmt != null ? fmtDelta(varAmt) : '—'}
                  </div>

                  {/* Variance % */}
                  <div className={`text-right text-[11px] tabular-nums font-mono ${deltaColor}`}>
                    {varPct != null ? fmtPct(varPct) : '—'}
                  </div>

                  {/* Attainment bar */}
                  <div className="flex items-center gap-2 justify-end">
                    {attain != null ? (
                      <>
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden max-w-[50px]">
                          <div
                            className={`h-full rounded-full ${favorable ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                            style={{ width: `${Math.min(attain, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-medium tabular-nums w-9 text-right ${deltaColor}`}>
                          {attain.toFixed(0)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-700">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {/* Category breakdown — always visible, inline editing */}
      {data.costs.byCategory.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/50 flex items-center justify-between">
            <div className="text-[12px] font-semibold text-slate-300">OpEx by Category</div>
            <div className="text-[10px] text-slate-600">Click budget cells to edit</div>
          </div>
          <div className="overflow-x-auto">
          <div className="grid grid-cols-[1fr_110px_110px_90px_80px_100px] gap-2 px-5 py-2 border-b border-slate-800/40 min-w-[580px]">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">Category</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] text-right">Budget</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] text-right">Actual</div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Var $</div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Var %</div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] text-right">Attain</div>
          </div>
          <div className="divide-y divide-slate-800/30">
            {data.costs.byCategory.map(cat => {
              const catKey = `cat:${cat.category}`;
              const bud = catBudget[cat.category];
              const isEditingCat = editing === catKey;
              const varAmt = bud != null ? cat.amount - bud : null;
              const varPct = bud != null && bud > 0 ? ((cat.amount - bud) / bud) * 100 : null;
              const attain = bud != null && bud > 0 ? (cat.amount / bud) * 100 : null;
              const favorable = varAmt != null && varAmt <= 0;
              const deltaColor = varAmt == null ? 'text-slate-700'
                : favorable ? 'text-emerald-400' : 'text-red-400';

              return (
                <div key={cat.category} className="grid grid-cols-[1fr_110px_110px_90px_80px_100px] gap-2 px-5 py-2.5 min-w-[580px]">
                  <div className="text-[12px] text-slate-400 pl-2">{cat.category}</div>
                  <div className="text-right font-mono">
                    {isEditingCat ? (
                      <input
                        autoFocus
                        type="number"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit(catKey);
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        onBlur={() => commitEdit(catKey)}
                        placeholder="0"
                        className="w-full text-right bg-slate-800/80 border border-indigo-500/50 rounded px-1.5 py-0.5 text-[11px] text-slate-100 focus:outline-none tabular-nums"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(catKey, bud)}
                        className={`w-full text-right text-[12px] font-medium transition-colors rounded px-1 py-0.5 ${
                          bud != null
                            ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/40'
                            : 'text-slate-700 hover:text-slate-500 border border-dashed border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {bud != null ? fmtAmt(bud) : '+ set'}
                      </button>
                    )}
                  </div>
                  <div className="text-right text-[12px] text-slate-300 font-mono tabular-nums">{fmtAmt(cat.amount)}</div>
                  <div className={`text-right text-[12px] font-mono font-medium tabular-nums ${deltaColor}`}>
                    {varAmt != null ? fmtDelta(varAmt) : '—'}
                  </div>
                  <div className={`text-right text-[11px] font-mono tabular-nums ${deltaColor}`}>
                    {varPct != null ? fmtPct(varPct) : '—'}
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    {attain != null ? (
                      <>
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden max-w-[40px]">
                          <div className={`h-full rounded-full ${favorable ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                            style={{ width: `${Math.min(attain, 100)}%` }}/>
                        </div>
                        <span className={`text-[11px] font-medium tabular-nums w-8 text-right ${deltaColor}`}>
                          {attain.toFixed(0)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-700">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {/* Budget Variance Waterfall — shown when budget is fully set */}
      {hasBudget && budget.revenue != null && budget.cogs != null && budget.opex != null && (
        <BudgetVarianceWaterfall data={data} budget={budget} />
      )}

      {/* Run-rate projection — when at least 2 periods of data */}
      {data.revenue.byPeriod.length >= 2 && (() => {
        const periods = data.revenue.byPeriod;
        const n = periods.length;
        // Last 3 periods average for stability
        const recentRevs = periods.slice(-Math.min(3, n)).map(p => p.revenue);
        const avgRev = recentRevs.reduce((s, v) => s + v, 0) / recentRevs.length;
        const yearEndRev = avgRev * 12;
        const lastCogs = periods.slice(-Math.min(3, n)).reduce((s, p) => s + (p.cogs ?? 0), 0);
        const lastRevs  = periods.slice(-Math.min(3, n)).reduce((s, p) => s + p.revenue, 0);
        const cogsRate  = lastRevs > 0 ? lastCogs / lastRevs : rev > 0 ? cogs / rev : 0;
        const yearEndCogs = yearEndRev * cogsRate;
        const opexRate = rev > 0 ? opex / rev : 0;
        const yearEndOpex = yearEndRev * opexRate;
        const yearEndGP = yearEndRev - yearEndCogs;
        const yearEndEBITDA = yearEndGP - yearEndOpex;

        const revVariance = budget.revenue ? ((yearEndRev - budget.revenue) / budget.revenue) * 100 : null;
        const ebitdaVariance = budgetEBITDA != null ? ((yearEndEBITDA - budgetEBITDA) / Math.abs(budgetEBITDA)) * 100 : null;

        return (
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[12px] font-semibold text-slate-200">Full-Year Run Rate</div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Annualized at avg of last {Math.min(3, n)} period{Math.min(3, n) !== 1 ? 's' : ''}
                </div>
              </div>
              {revVariance !== null && (
                <div className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${
                  revVariance >= 0
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  Rev {revVariance >= 0 ? '+' : ''}{revVariance.toFixed(0)}% vs budget
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Revenue Run Rate',     value: yearEndRev,    color: 'text-slate-100',   bud: budget.revenue },
                { label: 'Gross Profit',          value: yearEndGP,     color: 'text-sky-400',     bud: budgetGP },
                { label: 'EBITDA',                value: yearEndEBITDA, color: yearEndEBITDA > 0 ? 'text-emerald-400' : 'text-red-400', bud: budgetEBITDA },
                { label: 'EBITDA Margin',         value: null,          color: 'text-slate-300',   bud: null },
              ].map(({ label, value, color, bud }) => {
                const displayVal = label === 'EBITDA Margin'
                  ? (yearEndRev > 0 ? `${((yearEndEBITDA / yearEndRev) * 100).toFixed(1)}%` : '—')
                  : (value !== null ? fmtAmt(value) : '—');
                const delta = value !== null && bud && bud !== 0
                  ? ((value - bud) / Math.abs(bud)) * 100 : null;
                return (
                  <div key={label} className="bg-slate-800/30 rounded-xl px-3.5 py-3">
                    <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1.5">{label}</div>
                    <div className={`text-[16px] font-bold ${color} tabular-nums`}>{displayVal}</div>
                    {delta !== null && (
                      <div className={`text-[10px] font-semibold mt-0.5 ${delta >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                        {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs budget
                      </div>
                    )}
                    {bud == null && value == null && (
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {yearEndRev > 0 ? `${((yearEndEBITDA / yearEndRev) * 100).toFixed(1)}%` : '—'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-slate-700 leading-relaxed">
              Run rate is not a guarantee — it assumes recent trends continue for 12 months. Use this as a directional planning tool, not a forecast.
            </div>
          </div>
        );
      })()}

      {/* Tip when no budget set */}
      {!hasBudget && (
        <div className="text-center py-4 text-[12px] text-slate-600">
          Enter budgeted amounts above, or{' '}
          <button onClick={useActuals} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
            use current actuals as your baseline
          </button>
        </div>
      )}
    </div>
  );
}
