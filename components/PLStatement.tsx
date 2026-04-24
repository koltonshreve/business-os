/**
 * Collapsible P&L Statement
 * Renders rollup categories (COGS, Operating Expenses) that expand
 * to show individual line items — usable in Financial dashboard,
 * Operations, and any other panel.
 */
import { useState } from 'react';
import type { UnifiedBusinessData } from '../types';

interface Props {
  data: UnifiedBusinessData;
  previousData?: UnifiedBusinessData;
  /** Show change vs prior period column */
  showChange?: boolean;
  /** Show % of revenue column */
  showPct?: boolean;
  /** Start all sections expanded */
  defaultExpanded?: boolean;
  /** Compact row height for tight layouts */
  compact?: boolean;
  className?: string;
  /** Below-the-line items to extend P&L to Net Income */
  depreciation?: number;
  interestExpense?: number;
  taxRate?: number; // 0-100
}

const fmt = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(abs).toLocaleString('en-US')}`;
};


const COGS_KEYWORDS = ['cogs','cost of goods','cost of sales','materials','direct labor',
  'labor','direct cost','overhead','cost of revenue'];

function isCOGS(category: string): boolean {
  const c = category.toLowerCase();
  return COGS_KEYWORDS.some(k => c.includes(k));
}

// ── Expand toggle ─────────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      className={`w-2.5 h-2.5 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
      <path d="M2 3.5L5 6.5 8 3.5"/>
    </svg>
  );
}

// ── Single P&L row ─────────────────────────────────────────────────────────────
function PLRow({
  label, value, pctOfRev, changePct, changeAbs,
  level = 0, bold = false, separator = false, subtotal = false,
  color, compact, showPct, showChange, expandable, expanded, onToggle,
}: {
  label: string; value: number; pctOfRev?: number;
  changePct?: number; changeAbs?: number;
  level?: number; bold?: boolean; separator?: boolean; subtotal?: boolean;
  color?: string; compact?: boolean; showPct?: boolean; showChange?: boolean;
  expandable?: boolean; expanded?: boolean; onToggle?: () => void;
}) {
  const isNeg = value < 0;
  const displayValue = isNeg ? `(${fmt(Math.abs(value))})` : fmt(value);
  const textColor = color ?? (
    bold && value > 0  ? 'text-emerald-400' :
    bold && value < 0  ? 'text-red-400' :
    level > 0          ? 'text-slate-400' :
    'text-slate-200'
  );
  const labelColor = level > 0 ? 'text-slate-400' : bold ? 'text-slate-100' : 'text-slate-300';
  const rowPad     = compact ? 'py-1' : 'py-1.5';

  return (
    <>
      {separator && <div className="h-px bg-slate-800/60 my-1"/>}
      <div
        className={`flex items-center gap-2 ${rowPad} rounded transition-colors ${
          expandable ? 'cursor-pointer hover:bg-slate-800/30 -mx-1 px-1' : ''
        } ${subtotal ? 'bg-slate-800/20 -mx-2 px-2 rounded-lg' : ''}`}
        onClick={expandable ? onToggle : undefined}
      >
        {/* Indent guide */}
        {level > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0" style={{ width: level * 16 }}>
            <div className="w-px h-full bg-slate-800/60"/>
            <div className="w-2 h-px bg-slate-800/60"/>
          </div>
        )}

        {/* Label */}
        <div className={`flex-1 min-w-0 flex items-center gap-1.5 ${compact ? 'text-[11px]' : 'text-[12px]'} font-${bold ? 'semibold' : 'normal'} ${labelColor}`}>
          {expandable && <Chevron open={expanded ?? false}/>}
          {level > 0 && !expandable && <span className="text-slate-700 text-[10px] select-none">—</span>}
          <span className="truncate">{label}</span>
        </div>

        {/* Pct of revenue */}
        {showPct && (
          <div className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-slate-600 w-12 text-right flex-shrink-0`}>
            {pctOfRev !== undefined ? `${pctOfRev.toFixed(1)}%` : ''}
          </div>
        )}

        {/* Change vs prior */}
        {showChange && (
          <div className={`${compact ? 'text-[10px]' : 'text-[11px]'} w-16 text-right flex-shrink-0 font-medium`}>
            {changePct !== undefined ? (
              <span className={
                (label.toLowerCase().includes('expense') || label.toLowerCase().includes('cogs') || label.toLowerCase().includes('cost'))
                ? (changePct <= 0 ? 'text-emerald-400/70' : 'text-red-400/70')
                : (changePct >= 0 ? 'text-emerald-400/70' : 'text-red-400/70')
              }>
                {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
              </span>
            ) : ''}
          </div>
        )}

        {/* Value */}
        <div className={`${compact ? 'text-[12px]' : 'text-[13px]'} font-${bold ? 'bold' : 'medium'} ${textColor} w-20 text-right flex-shrink-0 tabular-nums`}>
          {displayValue}
        </div>
      </div>
    </>
  );
}

// ── Expandable section ─────────────────────────────────────────────────────────
function PLSection({
  label, total, pctOfRev, changePct, items, defaultExpanded,
  color, compact, showPct, showChange,
}: {
  label: string; total: number; pctOfRev: number; changePct?: number;
  items: { label: string; amount: number; pct: number }[];
  defaultExpanded?: boolean; color?: string;
  compact?: boolean; showPct?: boolean; showChange?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded ?? false);

  return (
    <div>
      <PLRow
        label={label} value={-total} pctOfRev={pctOfRev} changePct={changePct}
        expandable={items.length > 0} expanded={open} onToggle={() => setOpen(v => !v)}
        color={color} compact={compact} showPct={showPct} showChange={showChange}
      />
      {open && items.map((item, i) => (
        <PLRow
          key={i}
          label={item.label} value={-item.amount}
          pctOfRev={item.pct}
          level={1} compact={compact} showPct={showPct} showChange={showChange}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PLStatement({
  data, previousData,
  showChange = true, showPct = true,
  defaultExpanded = false, compact = false,
  className = '',
  depreciation = 0,
  interestExpense = 0,
  taxRate = 0,
}: Props) {
  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const gp     = rev - cogs;
  const ebitda = gp - opex;

  const prevRev    = previousData?.revenue.total ?? 0;
  const prevCOGS   = previousData?.costs.totalCOGS ?? 0;
  const prevOpEx   = previousData?.costs.totalOpEx ?? 0;
  const prevGP     = prevRev - prevCOGS;
  const prevEBITDA = prevGP - prevOpEx;

  const chgPct = (cur: number, prev: number) =>
    prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined;

  // Split categories
  const cogsItems = data.costs.byCategory.filter(c => isCOGS(c.category));
  const opexItems = data.costs.byCategory.filter(c => !isCOGS(c.category));

  // If no line items split available, compute from totals
  const cogsTotal = cogsItems.length > 0
    ? cogsItems.reduce((s, c) => s + c.amount, 0)
    : cogs;
  const opexTotal = opexItems.length > 0
    ? opexItems.reduce((s, c) => s + c.amount, 0)
    : opex;

  const cogsSection = cogsItems.map(c => ({
    label: c.category,
    amount: c.amount,
    pct: rev > 0 ? (c.amount / rev) * 100 : 0,
  }));

  const opexSection = opexItems.map(c => ({
    label: c.category,
    amount: c.amount,
    pct: rev > 0 ? (c.amount / rev) * 100 : 0,
  }));

  const spacing = compact ? '' : 'space-y-0.5';

  return (
    <div className={`${className} font-mono overflow-x-auto`}>
      {/* Column headers */}
      <div className="flex items-center gap-2 mb-2 border-b border-slate-800/60 pb-2">
        <div className={`flex-1 ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold text-slate-600 uppercase tracking-[0.08em]`}>Line Item</div>
        {showPct    && <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold text-slate-600 uppercase tracking-[0.08em] w-12 text-right`}>% Rev</div>}
        {showChange && <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold text-slate-600 uppercase tracking-[0.08em] w-16 text-right`}>vs Prior</div>}
        <div className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold text-slate-600 uppercase tracking-[0.08em] w-20 text-right`}>Amount</div>
      </div>

      <div className={spacing}>
        {/* Revenue */}
        <PLRow
          label="Revenue" value={rev}
          pctOfRev={100}
          changePct={prevRev ? chgPct(rev, prevRev) : undefined}
          bold color="text-slate-100"
          compact={compact} showPct={showPct} showChange={showChange}
        />

        {/* Revenue sub-items if available */}
        {data.revenue.recurring !== undefined && data.revenue.recurring > 0 && (
          <PLRow label="Recurring Revenue" value={data.revenue.recurring}
            pctOfRev={rev > 0 ? (data.revenue.recurring/rev)*100 : 0}
            level={1} compact={compact} showPct={showPct} showChange={showChange}/>
        )}
        {data.revenue.oneTime !== undefined && data.revenue.oneTime > 0 && (
          <PLRow label="One-Time Revenue" value={data.revenue.oneTime}
            pctOfRev={rev > 0 ? (data.revenue.oneTime/rev)*100 : 0}
            level={1} compact={compact} showPct={showPct} showChange={showChange}/>
        )}

        {/* COGS Section */}
        <PLSection
          label="Cost of Goods Sold" total={cogsTotal}
          pctOfRev={rev > 0 ? (cogsTotal/rev)*100 : 0}
          changePct={prevCOGS ? chgPct(cogsTotal, prevCOGS) : undefined}
          items={cogsSection} defaultExpanded={defaultExpanded}
          color="text-red-400/80"
          compact={compact} showPct={showPct} showChange={showChange}
        />

        {/* Gross Profit */}
        <PLRow
          label="Gross Profit" value={gp}
          pctOfRev={rev > 0 ? (gp/rev)*100 : 0}
          changePct={prevGP ? chgPct(gp, prevGP) : undefined}
          bold separator subtotal
          color={gp > 0 ? 'text-emerald-400' : 'text-red-400'}
          compact={compact} showPct={showPct} showChange={showChange}
        />

        {/* Operating Expenses Section */}
        <PLSection
          label="Operating Expenses" total={opexTotal}
          pctOfRev={rev > 0 ? (opexTotal/rev)*100 : 0}
          changePct={prevOpEx ? chgPct(opexTotal, prevOpEx) : undefined}
          items={opexSection} defaultExpanded={defaultExpanded}
          color="text-amber-400/80"
          compact={compact} showPct={showPct} showChange={showChange}
        />

        {/* EBITDA */}
        <PLRow
          label="EBITDA" value={ebitda}
          pctOfRev={rev > 0 ? (ebitda/rev)*100 : 0}
          changePct={prevEBITDA ? chgPct(ebitda, prevEBITDA) : undefined}
          bold separator subtotal
          color={ebitda > 0 ? 'text-emerald-400' : 'text-red-400'}
          compact={compact} showPct={showPct} showChange={showChange}
        />

        {/* Below-the-line: EBIT → Net Income (only when any field set) */}
        {(depreciation > 0 || interestExpense > 0 || taxRate > 0) && (() => {
          const ebit = ebitda - depreciation;
          const ebt  = ebit - interestExpense;
          const tax  = ebt > 0 ? ebt * (taxRate / 100) : 0;
          const ni   = ebt - tax;
          return (
            <>
              {depreciation > 0 && (
                <PLRow label="Depreciation & Amortization" value={-depreciation}
                  pctOfRev={rev > 0 ? (depreciation/rev)*100 : 0}
                  color="text-slate-500" level={1}
                  compact={compact} showPct={showPct} showChange={false}/>
              )}
              <PLRow label="EBIT" value={ebit}
                pctOfRev={rev > 0 ? (ebit/rev)*100 : 0}
                bold subtotal
                color={ebit >= 0 ? 'text-slate-200' : 'text-red-400'}
                compact={compact} showPct={showPct} showChange={false}/>
              {interestExpense > 0 && (
                <PLRow label="Interest Expense" value={-interestExpense}
                  pctOfRev={rev > 0 ? (interestExpense/rev)*100 : 0}
                  color="text-slate-500" level={1}
                  compact={compact} showPct={showPct} showChange={false}/>
              )}
              <PLRow label="EBT" value={ebt}
                pctOfRev={rev > 0 ? (ebt/rev)*100 : 0}
                bold subtotal
                color={ebt >= 0 ? 'text-slate-200' : 'text-red-400'}
                compact={compact} showPct={showPct} showChange={false}/>
              {taxRate > 0 && ebt > 0 && (
                <PLRow label={`Income Tax (${taxRate}%)`} value={-tax}
                  pctOfRev={rev > 0 ? (tax/rev)*100 : 0}
                  color="text-slate-500" level={1}
                  compact={compact} showPct={showPct} showChange={false}/>
              )}
              <PLRow label="Net Income" value={ni}
                pctOfRev={rev > 0 ? (ni/rev)*100 : 0}
                bold separator subtotal
                color={ni >= 0 ? 'text-emerald-400' : 'text-red-400'}
                compact={compact} showPct={showPct} showChange={false}/>
            </>
          );
        })()}
      </div>
    </div>
  );
}
