// ─── 13-Week Cash Flow Forecast ──────────────────────────────────────────────
// Treasury / FP&A format: line-items-as-rows × weeks-as-columns.
// Every line is derived from actual financial statement data — no manual overrides.

import { useMemo } from 'react';
import type { UnifiedBusinessData } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type LineCategory = 'receipt' | 'disbursement';
type LinePattern  = 'weekly' | 'biweekly' | 'monthly-week1' | 'none';

interface ForecastLine {
  id:       string;
  category: LineCategory;
  group:    string;
  label:    string;
  /** Weekly-equivalent base amount (pattern logic converts to per-occurrence). */
  baseAmt:  number;
  pattern:  LinePattern;
  /** Human-readable source attribution, e.g. "Cash Flow Stmt · 8-period avg" */
  source:   string;
}

interface WeekMeta {
  num:     number;   // 1–13
  isoDate: string;   // Monday ISO date string
  label:   string;   // "Apr 21"
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number, compact = false): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (compact) {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}k`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtDisb(n: number): string {
  return n > 0 ? `(${fmt(n)})` : fmt(n);
}

// ── Week metadata ─────────────────────────────────────────────────────────────

function buildWeeks(): WeekMeta[] {
  const today = new Date();
  const day = today.getDay();
  const daysToMon = day === 0 ? 1 : (8 - day) % 7 || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMon);

  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i * 7);
    return {
      num:     i + 1,
      isoDate: d.toISOString(),
      label:   d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });
}

// ── Per-week amount ───────────────────────────────────────────────────────────

function weekAmt(line: ForecastLine, week: WeekMeta): number {
  switch (line.pattern) {
    case 'none':    return 0;
    case 'weekly':  return line.baseAmt;
    // Biweekly: fires odd weeks, pays 2 weeks' worth so average = baseAmt/wk
    case 'biweekly': return week.num % 2 === 1 ? line.baseAmt * 2 : 0;
    // Monthly: fires on the week containing the 1st of the month
    case 'monthly-week1': {
      const d = new Date(week.isoDate);
      const end = new Date(d);
      end.setDate(d.getDate() + 6);
      const fires = d.getDate() <= 7 || end.getDate() <= 7;
      // baseAmt = monthly amount; show full monthly payment when it fires
      return fires ? line.baseAmt : 0;
    }
    default: return line.baseAmt;
  }
}

// ── Derive line items from financial data ─────────────────────────────────────
//
// Priority order per item:
//   1. data.cashFlow (actuals) → receipts
//   2. data.transactions (actuals) → receipts, debt service, categorized spend
//   3. data.payrollByDept (actuals) → payroll
//   4. data.costs.byCategory (P&L detail) → categorized disbursements
//   5. data.costs.{laborCost,materialsCost,totalCOGS,totalOpEx} (aggregates) → fallbacks

function deriveLines(data: UnifiedBusinessData): ForecastLine[] {
  const cf          = data.cashFlow       ?? [];
  const tx          = data.transactions   ?? [];
  const payrollData = data.payrollByDept  ?? [];
  const costCats    = data.costs.byCategory ?? [];
  const hc          = data.operations.headcount;

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Sum cost-category amounts whose name contains any of the keywords. */
  function catAmt(...keywords: string[]): number {
    return costCats
      .filter(c => keywords.some(k => c.category.toLowerCase().includes(k)))
      .reduce((s, c) => s + c.amount, 0);
  }

  /** Mark categories as used so they don't appear in "unmapped" bucket. */
  const usedCats = new Set<string>();
  function consumeCats(...keywords: string[]): { category: string; amount: number }[] {
    const matches = costCats.filter(
      c => !usedCats.has(c.category) &&
           keywords.some(k => c.category.toLowerCase().includes(k))
    );
    matches.forEach(c => usedCats.add(c.category));
    return matches;
  }

  /** Average weekly spend from transaction records. */
  function txWeekly(type: 'revenue' | 'expense', ...kws: string[]): number {
    const filtered = tx.filter(t =>
      t.type === type &&
      (kws.length === 0 || kws.some(k => (t.category ?? '').toLowerCase().includes(k)))
    );
    if (!filtered.length) return 0;
    const ms = filtered.map(t => +new Date(t.date));
    const spanWeeks = Math.max(1, (Math.max(...ms) - Math.min(...ms)) / 604_800_000);
    return filtered.reduce((s, t) => s + Math.abs(t.amount), 0) / spanWeeks;
  }

  // ── RECEIPTS: Customer Collections ──────────────────────────────────────

  let weeklyCollections: number;
  let collectionsSource: string;

  if (cf.length >= 2 && cf.some(p => p.receipts > 0)) {
    weeklyCollections = (cf.reduce((s, p) => s + p.receipts, 0) / cf.length) / 4.33;
    collectionsSource = `Cash Flow Stmt · ${cf.length}-period avg`;
  } else if (tx.some(t => t.type === 'revenue')) {
    weeklyCollections = txWeekly('revenue');
    collectionsSource = `Transactions · ${tx.filter(t => t.type === 'revenue').length} records`;
  } else {
    // Revenue / 52 with ~5% DSO haircut
    weeklyCollections = (data.revenue.total / 52) * 0.95;
    collectionsSource = 'P&L · Revenue ÷ 52 (−5% DSO)';
  }

  // ── PAYROLL ──────────────────────────────────────────────────────────────

  // Consume payroll-related cost categories so they don't end up in unmapped
  const payrollCatKws = ['payroll', 'wages', 'salaries', 'compensation', 'labor'];
  consumeCats(...payrollCatKws);

  let annualPayroll: number;
  let payrollSource: string;

  if (payrollData.length > 0) {
    annualPayroll = payrollData.reduce((s, p) => s + p.totalCompensation, 0);
    const depts = payrollData.map(p => p.department).slice(0, 3).join(', ');
    payrollSource = `Payroll Data · ${depts}${payrollData.length > 3 ? ` +${payrollData.length - 3}` : ''}`;
  } else if (data.costs.laborCost && data.costs.laborCost > 0) {
    annualPayroll = data.costs.laborCost;
    payrollSource = 'P&L · Labor Cost';
  } else {
    const fromCat = catAmt(...payrollCatKws);
    if (fromCat > 0) {
      annualPayroll = fromCat;
      payrollSource = 'P&L · Payroll / Wages line';
    } else {
      annualPayroll = data.costs.totalOpEx * 0.40;
      payrollSource = 'P&L · OpEx (est. 40% labor)';
    }
  }
  // Weekly equivalent; biweekly pattern fires odd weeks × 2 → per-run = annualPayroll/26
  const payrollWeekly = annualPayroll / 52;

  // ── CATEGORIZED DISBURSEMENTS ────────────────────────────────────────────

  type CatDef = { kws: string[]; group: string; pattern: LinePattern };
  const COST_MAP: CatDef[] = [
    { kws: ['cost of goods', 'cogs', 'direct material', 'inventory', 'parts', 'supply', 'supplies'],
      group: 'Direct Costs', pattern: 'weekly' },
    { kws: ['subcontract', 'outside labor', 'freelance', 'contract labor'],
      group: 'Direct Costs', pattern: 'weekly' },
    { kws: ['rent', 'lease', 'facilit', 'real estate', 'property'],
      group: 'Overhead', pattern: 'monthly-week1' },
    { kws: ['utilit', 'electric', 'gas ', 'water', 'phone', 'internet', 'telecom'],
      group: 'Overhead', pattern: 'monthly-week1' },
    { kws: ['insurance'],
      group: 'Overhead', pattern: 'monthly-week1' },
    { kws: ['software', 'saas', 'subscript', 'cloud', 'technology', 'it services', 'hosting'],
      group: 'Technology', pattern: 'monthly-week1' },
    { kws: ['market', 'advertis', 'advertising', 'promotion', 'digital ads', 'seo'],
      group: 'Sales & Marketing', pattern: 'weekly' },
    { kws: ['sales commission', 'commission'],
      group: 'Sales & Marketing', pattern: 'weekly' },
    { kws: ['legal', 'attorney', 'accounting', 'audit', 'consult', 'professional service'],
      group: 'Professional Svcs', pattern: 'monthly-week1' },
    { kws: ['travel', 'entertainment', 'meals'],
      group: 'G&A', pattern: 'weekly' },
    { kws: ['office', 'office supplies', 'postage', 'shipping'],
      group: 'G&A', pattern: 'weekly' },
    { kws: ['interest', 'debt service', 'loan payment', 'mortgage', 'note payable'],
      group: 'Debt Service', pattern: 'monthly-week1' },
    // Non-cash — skip in CF
    { kws: ['depreciation', 'amortization'],
      group: '__skip__', pattern: 'none' },
  ];

  const catLines: ForecastLine[] = [];
  let coveredCOGS = 0;

  for (const def of COST_MAP) {
    const matches = consumeCats(...def.kws);
    for (const cat of matches) {
      if (def.group === '__skip__') continue;
      // baseAmt = monthly amount for monthly-week1, weekly amount otherwise
      const baseAmt = def.pattern === 'monthly-week1'
        ? cat.amount / 12
        : cat.amount / 52;
      if (baseAmt <= 0) continue;
      if (def.group === 'Direct Costs') coveredCOGS += cat.amount;
      catLines.push({
        id: `cat-${cat.category.replace(/\W+/g, '-').toLowerCase()}`,
        category: 'disbursement',
        group: def.group,
        label: cat.category,
        baseAmt,
        pattern: def.pattern,
        source: `P&L · ${cat.category}`,
      });
    }
  }

  // ── COGS fallback ────────────────────────────────────────────────────────
  // If COGS wasn't pulled from byCategory, use aggregate or materialsCost
  const hasCOGSFromCats = coveredCOGS > 0;
  const fallbackCOGS = data.costs.materialsCost && data.costs.materialsCost > 0
    ? data.costs.materialsCost
    : (!hasCOGSFromCats ? data.costs.totalCOGS : 0);

  // ── Unmapped cost categories ─────────────────────────────────────────────
  const unmapped = costCats.filter(c => !usedCats.has(c.category) && c.amount > 0);

  // ── Debt service from transactions ────────────────────────────────────────
  const txDebt = txWeekly('expense', 'loan', 'debt service', 'mortgage', 'note payable', 'interest expense');

  // ── Other income receipts ─────────────────────────────────────────────────
  const txOtherIncome = txWeekly('revenue', 'other income', 'interest income', 'misc');

  // ── Remaining OpEx after all categorized items ───────────────────────────
  // Compute how much OpEx has been accounted for
  const accountedOpEx = annualPayroll
    + catLines.reduce((s, l) => {
        const annual = l.pattern === 'weekly' ? l.baseAmt * 52
          : l.pattern === 'biweekly' ? l.baseAmt * 26
          : l.baseAmt * 12;
        return s + annual;
      }, 0)
    + unmapped.reduce((s, c) => s + c.amount, 0);

  const remainingOpEx = Math.max(0, data.costs.totalOpEx - accountedOpEx);

  // ── Assemble lines ───────────────────────────────────────────────────────

  const lines: ForecastLine[] = [
    // ── RECEIPTS ──────────────────────────────────────────────────────────
    {
      id: 'collections', category: 'receipt', group: 'Operating Receipts',
      label: 'Customer Collections',
      baseAmt: weeklyCollections, pattern: 'weekly',
      source: collectionsSource,
    },
    ...(txOtherIncome > 50 ? [{
      id: 'other-income', category: 'receipt' as LineCategory, group: 'Operating Receipts',
      label: 'Other Income',
      baseAmt: txOtherIncome, pattern: 'weekly' as LinePattern,
      source: 'Transactions · Other income records',
    }] : []),

    // ── PAYROLL ───────────────────────────────────────────────────────────
    {
      id: 'payroll', category: 'disbursement', group: 'Payroll',
      label: hc ? `Payroll (${hc} headcount)` : 'Payroll',
      baseAmt: payrollWeekly, pattern: 'biweekly',
      source: payrollSource,
    },
    {
      id: 'payroll-taxes', category: 'disbursement', group: 'Payroll',
      label: 'Payroll Taxes & Benefits',
      baseAmt: payrollWeekly * 0.22, pattern: 'biweekly',
      source: 'Calc · 22% of payroll (FICA + benefits)',
    },

    // ── COGS fallback ─────────────────────────────────────────────────────
    ...(fallbackCOGS > 500 ? [{
      id: 'cogs-ap', category: 'disbursement' as LineCategory, group: 'Direct Costs',
      label: 'Vendor / AP Payments (COGS)',
      baseAmt: fallbackCOGS / 52, pattern: 'weekly' as LinePattern,
      source: data.costs.materialsCost
        ? 'P&L · Materials Cost'
        : 'P&L · Cost of Goods Sold',
    }] : []),

    // ── Category-derived lines ────────────────────────────────────────────
    ...catLines,

    // ── Unmapped P&L categories ───────────────────────────────────────────
    ...unmapped.map(cat => ({
      id: `other-${cat.category.replace(/\W+/g, '-').toLowerCase()}`,
      category: 'disbursement' as LineCategory,
      group: 'Other Operating',
      label: cat.category,
      baseAmt: cat.amount / 52,
      pattern: 'weekly' as LinePattern,
      source: `P&L · ${cat.category}`,
    })),

    // ── Remaining OpEx catch-all ──────────────────────────────────────────
    ...(remainingOpEx > 1_000 ? [{
      id: 'remaining-opex', category: 'disbursement' as LineCategory, group: 'Other Operating',
      label: 'Other Operating Expenses',
      baseAmt: remainingOpEx / 52, pattern: 'weekly' as LinePattern,
      source: 'P&L · OpEx (uncategorized remainder)',
    }] : []),

    // ── Debt service from transactions ────────────────────────────────────
    ...(txDebt > 100 ? [{
      id: 'debt-service', category: 'disbursement' as LineCategory, group: 'Debt Service',
      label: 'Debt Service / Interest',
      baseAmt: txDebt, pattern: 'weekly' as LinePattern,
      source: 'Transactions · Debt / loan payments',
    }] : []),
  ];

  return lines.filter(l => l.baseAmt > 0);
}

// ── Forecast computation ──────────────────────────────────────────────────────

interface WeekSummary {
  week:          WeekMeta;
  receipts:      number;
  disbursements: number;
  netCash:       number;
  endBalance:    number;
}

function computeForecast(
  lines: ForecastLine[],
  weeks: WeekMeta[],
  opening: number
): WeekSummary[] {
  let balance = opening;
  return weeks.map(week => {
    const receipts      = lines.filter(l => l.category === 'receipt').reduce((s, l) => s + weekAmt(l, week), 0);
    const disbursements = lines.filter(l => l.category === 'disbursement').reduce((s, l) => s + weekAmt(l, week), 0);
    const net = receipts - disbursements;
    balance += net;
    return { week, receipts, disbursements, netCash: net, endBalance: balance };
  });
}

// ── Runway gauge ──────────────────────────────────────────────────────────────

function RunwayGauge({
  months, cash, weeklyNet, minBalance, week13Balance,
}: {
  months: number | null; cash: number; weeklyNet: number;
  minBalance: number; week13Balance: number;
}) {
  const color  = months === null ? 'text-emerald-400' : months < 3 ? 'text-red-400' : months < 6 ? 'text-amber-400' : 'text-emerald-400';
  const bg     = months === null ? 'bg-emerald-500/6'  : months < 3 ? 'bg-red-500/8'  : months < 6 ? 'bg-amber-500/8'  : 'bg-emerald-500/6';
  const border = months === null ? 'border-emerald-500/20' : months < 3 ? 'border-red-500/20' : months < 6 ? 'border-amber-500/20' : 'border-emerald-500/20';
  const bar    = months === null ? 'bg-emerald-500' : months < 3 ? 'bg-red-500' : months < 6 ? 'bg-amber-500' : 'bg-emerald-500';
  const pct    = months === null ? 100 : Math.min((months / 18) * 100, 100);

  const stats = [
    { label: 'Cash on Hand',       value: fmt(cash, true),            color: 'text-slate-100' },
    { label: 'Avg Weekly Net',     value: `${weeklyNet >= 0 ? '+' : ''}${fmt(weeklyNet, true)}`, color: weeklyNet >= 0 ? 'text-emerald-400' : 'text-red-400' },
    { label: 'Min 13-Wk Balance',  value: fmt(minBalance, true),      color: minBalance < 0 ? 'text-red-400' : minBalance < 50_000 ? 'text-amber-400' : 'text-slate-300' },
    { label: 'Balance at Week 13', value: fmt(week13Balance, true),   color: week13Balance >= cash ? 'text-emerald-400' : 'text-red-400' },
  ];

  return (
    <div className={`${bg} border ${border} rounded-xl p-5`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-1">Cash Runway</div>
          <div className={`text-[40px] font-bold tabular-nums leading-none tracking-tight ${color}`}>
            {months === null ? '∞' : months > 24 ? '24+' : months.toFixed(1)}
          </div>
          <div className="text-[12px] text-slate-500 mt-1">months at current rate</div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-right">
          {stats.map(s => (
            <div key={s.label}>
              <div className={`text-[14px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }}/>
      </div>
      {months !== null && months < 6 && (
        <div className="text-[11px] font-medium text-red-400/90 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0"/>
          Cash exhaustion projected{' '}
          {months < 1
            ? 'within weeks'
            : `~${new Date(Date.now() + months * 30.5 * 86_400_000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
        </div>
      )}
      {minBalance < 0 && (
        <div className="text-[11px] font-medium text-red-400/90 flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"/>
          Projected shortfall within 13-week window — review disbursement timing
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  data: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

export default function CashRunway({ data, onAskAI }: Props) {
  const weeks = useMemo(() => buildWeeks(), []);
  const lines = useMemo(() => deriveLines(data), [data]);

  // Opening balance: latest cash flow period closing balance, else estimated
  const cf = data.cashFlow ?? [];
  const opening = cf.length ? cf[cf.length - 1].closingBalance : data.revenue.total / 12;
  const openingSource = cf.length
    ? `Cash Flow Stmt · ${cf[cf.length - 1].period} closing balance`
    : 'Estimated · Revenue ÷ 12';

  const summary = useMemo(() => computeForecast(lines, weeks, opening), [lines, weeks, opening]);

  // Derived stats
  const avgWeeklyReceipts  = summary.reduce((s, w) => s + w.receipts, 0) / 13;
  const avgWeeklyDisb      = summary.reduce((s, w) => s + w.disbursements, 0) / 13;
  const avgWeeklyNet       = avgWeeklyReceipts - avgWeeklyDisb;
  const monthlyNet         = avgWeeklyNet * 4.33;
  const runwayMonths       = monthlyNet < 0 ? opening / Math.abs(monthlyNet) : null;
  const minBalance         = Math.min(...summary.map(s => s.endBalance));
  const week13Balance      = summary[12]?.endBalance ?? opening;

  const aiContext = `13-week cash forecast: opening ${fmt(opening, true)}, avg weekly receipts ${fmt(avgWeeklyReceipts, true)}, avg weekly disbursements ${fmt(avgWeeklyDisb, true)}, net ${avgWeeklyNet >= 0 ? '+' : ''}${fmt(avgWeeklyNet, true)}/wk, runway ${runwayMonths !== null ? runwayMonths.toFixed(1) + ' months' : 'indefinite'}, min 13-wk balance ${fmt(minBalance, true)}, week-13 balance ${fmt(week13Balance, true)}.`;

  // Build the Opening Balance row source label in the table
  // (We pass a custom component to ForecastMatrix via a ref-free trick — inject via a separate row approach)
  // Instead, ForecastMatrix accepts openingSource as a prop:

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[16px] font-bold text-slate-100">13-Week Cash Flow Forecast</div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            Treasury format · All line items pulled from financial statements · Read-only
          </div>
        </div>
        {onAskAI && (
          <button
            onClick={() => onAskAI(aiContext + ' Analyze my cash position and provide concrete recommendations for extending runway, optimizing collection timing, and managing the minimum balance.')}
            className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1.5 rounded-lg transition-all font-medium"
          >
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
              <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
            </svg>
            Ask AI
          </button>
        )}
      </div>

      {/* Runway gauge */}
      <RunwayGauge
        months={runwayMonths}
        cash={opening}
        weeklyNet={avgWeeklyNet}
        minBalance={minBalance}
        week13Balance={week13Balance}
      />

      {/* Opening balance */}
      <div className="flex items-center gap-3 bg-slate-900/40 border border-slate-800/40 rounded-xl px-4 py-3">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Opening Cash Balance</div>
        <div className="text-[15px] font-bold text-slate-100 tabular-nums">{fmt(opening)}</div>
        <div className="text-[11px] text-slate-600">· {openingSource}</div>
      </div>

      {/* Historical context */}
      {cf.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">
            Historical Cash Flow ({cf.length} periods)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cf.slice(-4).map(p => (
              <div key={p.period} className="text-center">
                <div className="text-[10px] text-slate-600 mb-1">{p.period}</div>
                <div className="text-[13px] font-bold text-slate-200 tabular-nums">{fmt(p.closingBalance, true)}</div>
                {p.netCashFlow !== undefined && (
                  <div className={`text-[10px] font-medium ${p.netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {p.netCashFlow >= 0 ? '+' : ''}{fmt(p.netCashFlow, true)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data sources summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Cash Flow Periods', value: cf.length > 0 ? `${cf.length} periods` : 'Not uploaded', ok: cf.length > 0 },
          { label: 'Payroll Data',      value: data.payrollByDept?.length ? `${data.payrollByDept.length} dept${data.payrollByDept.length > 1 ? 's' : ''}` : 'Not uploaded', ok: !!data.payrollByDept?.length },
          { label: 'Cost Categories',   value: data.costs.byCategory?.length ? `${data.costs.byCategory.length} lines` : 'Aggregates only', ok: !!data.costs.byCategory?.length },
          { label: 'Transactions',      value: (data.transactions?.length ?? 0) > 0 ? `${data.transactions!.length} records` : 'Not uploaded', ok: (data.transactions?.length ?? 0) > 0 },
        ].map(s => (
          <div key={s.label} className={`rounded-lg border px-3 py-2 ${s.ok ? 'border-emerald-500/20 bg-emerald-500/4' : 'border-slate-800/40 bg-slate-900/30'}`}>
            <div className={`text-[11px] font-semibold ${s.ok ? 'text-emerald-400' : 'text-slate-600'}`}>{s.value}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 13-week matrix */}
      <ForecastMatrixWithSource
        lines={lines}
        weeks={weeks}
        summary={summary}
        opening={opening}
        openingSource={openingSource}
      />

      {/* Methodology footnote */}
      <div className="text-[10px] text-slate-700 leading-relaxed px-1 space-y-1">
        <div>Receipts: pulled from cash flow statement actuals (avg period receipts ÷ 4.33 weeks) when available, then transaction records, then P&L revenue ÷ 52.</div>
        <div>Payroll: pulled from payroll-by-department upload when available, then P&L labor cost, then payroll cost category. Fires biweekly (odd weeks). Taxes &amp; benefits estimated at 22%.</div>
        <div>All other disbursements: mapped line-by-line from P&L cost categories. Monthly items fire in the week containing the 1st of the month.</div>
      </div>
    </div>
  );
}

// ── ForecastMatrix with opening source label ──────────────────────────────────
// Separate wrapper to pass openingSource into the opening row without prop-drilling the full data object.

function ForecastMatrixWithSource({
  lines, weeks, summary, opening, openingSource,
}: {
  lines: ForecastLine[];
  weeks: WeekMeta[];
  summary: WeekSummary[];
  opening: number;
  openingSource: string;
}) {
  const minBal     = Math.min(...summary.map(s => s.endBalance));
  const minBalWeek = summary.find(s => s.endBalance === minBal)?.week.num ?? 0;

  const receiptGroups = Array.from(new Set(lines.filter(l => l.category === 'receipt').map(l => l.group)));
  const disbGroups    = Array.from(new Set(lines.filter(l => l.category === 'disbursement').map(l => l.group)));

  function sectionTotal(cat: LineCategory, weekNum: number): number {
    const week = weeks.find(w => w.num === weekNum)!;
    return lines.filter(l => l.category === cat).reduce((s, l) => s + weekAmt(l, week), 0);
  }

  function GrandTotal(cat: LineCategory): number {
    return summary.reduce((s, ws) => s + (cat === 'receipt' ? ws.receipts : ws.disbursements), 0);
  }

  function LineRows({ category, groups }: { category: LineCategory; groups: string[] }) {
    const isReceipt = category === 'receipt';
    return (
      <>
        <tr className="bg-slate-800/40">
          <td colSpan={15} className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-800/40">
            {isReceipt ? 'CASH RECEIPTS' : 'CASH DISBURSEMENTS'}
          </td>
        </tr>
        {groups.map(group =>
          lines.filter(l => l.category === category && l.group === group).map(line => {
            const lineTotal = weeks.reduce((s, w) => s + weekAmt(line, w), 0);
            return (
              <tr key={line.id} className="border-b border-slate-800/20 hover:bg-slate-800/10">
                <td className="px-4 py-1.5 sticky left-0 bg-[#060a12]/95 min-w-[200px] max-w-[240px]">
                  <div className="text-[11px] text-slate-300 truncate">{line.label}</div>
                  <div className="text-[9px] text-slate-600 truncate mt-0.5">↳ {line.source}</div>
                </td>
                {weeks.map(w => {
                  const amt = weekAmt(line, w);
                  return (
                    <td key={w.num} className="px-2 py-1.5 text-right">
                      <span className={`text-[11px] tabular-nums ${amt === 0 ? 'text-slate-700' : isReceipt ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                        {amt === 0 ? '—' : isReceipt ? fmt(amt) : fmtDisb(amt)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right text-[11px] tabular-nums font-semibold text-slate-300 bg-slate-800/20 border-l border-slate-800/40">
                  {fmt(lineTotal, true)}
                </td>
              </tr>
            );
          })
        )}
        <tr className="bg-slate-800/25 border-b border-slate-700/30">
          <td className="px-4 py-2 sticky left-0 bg-slate-800/40 text-[11px] font-bold text-slate-200 uppercase tracking-wide">
            Total {isReceipt ? 'Receipts' : 'Disbursements'}
          </td>
          {weeks.map(w => (
            <td key={w.num} className={`px-2 py-2 text-right text-[11px] font-bold tabular-nums ${isReceipt ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(sectionTotal(category, w.num), true)}
            </td>
          ))}
          <td className={`px-3 py-2 text-right text-[11px] font-bold tabular-nums bg-slate-800/30 border-l border-slate-700/40 ${isReceipt ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(GrandTotal(category), true)}
          </td>
        </tr>
      </>
    );
  }

  const totalNet = summary.reduce((s, ws) => s + ws.netCash, 0);

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/40 flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold text-slate-200">13-Week Cash Flow Forecast</div>
          <div className="text-[10px] text-slate-600 mt-0.5">
            All figures derived from financial statements · Wk {minBalWeek} = min balance ({fmt(minBal, true)})
          </div>
        </div>
        {minBal < 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/8 border border-red-500/20 px-2.5 py-1.5 rounded-lg flex-shrink-0">
            ⚠ Shortfall Wk {minBalWeek}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ minWidth: '1120px' }}>
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-900/80">
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] sticky left-0 bg-slate-900/80 min-w-[200px]">
                Line Item / Source
              </th>
              {weeks.map(w => (
                <th key={w.num} className={`text-right px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] min-w-[68px] ${w.num === minBalWeek ? 'text-amber-400' : 'text-slate-600'}`}>
                  Wk {w.num}
                  <div className="text-[8px] font-normal text-slate-700 normal-case tracking-normal">{w.label}</div>
                </th>
              ))}
              <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.06em] min-w-[80px] bg-slate-800/20 border-l border-slate-800/40">
                13-Wk Total
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Opening balance */}
            <tr className="border-b border-slate-800/40 bg-slate-900/30">
              <td className="px-4 py-2 sticky left-0 bg-slate-900/50">
                <div className="text-[11px] font-semibold text-slate-300">Opening Balance</div>
                <div className="text-[9px] text-slate-600 mt-0.5">↳ {openingSource}</div>
              </td>
              <td className="px-2 py-2 text-right text-[12px] font-bold tabular-nums text-slate-100">
                {fmt(opening)}
              </td>
              {weeks.slice(1).map((_, i) => (
                <td key={i} className="px-2 py-2 text-right text-[11px] tabular-nums text-slate-600">
                  {fmt(summary[i].endBalance)}
                </td>
              ))}
              <td className="px-3 py-2 bg-slate-800/20 border-l border-slate-800/40"/>
            </tr>

            <LineRows category="receipt" groups={receiptGroups}/>
            <LineRows category="disbursement" groups={disbGroups}/>

            {/* Net cash flow */}
            <tr className="border-b border-slate-700/40 bg-slate-800/20">
              <td className="px-4 py-2.5 sticky left-0 bg-slate-800/40 text-[11px] font-bold text-slate-100 uppercase tracking-wide">
                Net Cash Flow
              </td>
              {summary.map(s => (
                <td key={s.week.num} className={`px-2 py-2.5 text-right text-[11px] font-bold tabular-nums ${s.netCash >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.netCash >= 0 ? '+' : ''}{fmt(s.netCash, true)}
                </td>
              ))}
              <td className={`px-3 py-2.5 text-right text-[11px] font-bold tabular-nums bg-slate-800/30 border-l border-slate-700/40 ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(totalNet, true)}
              </td>
            </tr>

            {/* Ending balance */}
            <tr className="bg-slate-800/30">
              <td className="px-4 py-3 sticky left-0 bg-slate-800/50 text-[12px] font-bold text-slate-100 uppercase tracking-wide">
                Ending Balance
              </td>
              {summary.map(s => (
                <td key={s.week.num} className={`px-2 py-3 text-right text-[11px] font-bold tabular-nums ${
                  s.week.num === minBalWeek ? 'bg-amber-500/10' : ''
                } ${
                  s.endBalance < 0 ? 'text-red-400' : s.endBalance < 50_000 ? 'text-amber-400' : 'text-slate-100'
                }`}>
                  {fmt(s.endBalance, true)}
                </td>
              ))}
              <td className="px-3 py-3 bg-slate-800/30 border-l border-slate-700/40"/>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
