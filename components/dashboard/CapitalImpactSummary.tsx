// ── Capital Impact Summary ──────────────────────────────────────────────────
// Intelligent inventory & purchasing decision engine.
// Decides: WHAT to buy · WHEN to buy · HOW MUCH to buy · IF bulk is worth it.

import { useState, useMemo, useEffect } from 'react';
import type { UnifiedBusinessData } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiscountTier {
  label: string;
  minQty: number;
  unitCost: number;
}

interface PurchaseItem {
  id: string;
  name: string;
  sku: string;
  category: 'Raw Materials' | 'Packaging' | 'MRO' | 'Office & Tech' | 'Components' | 'Consumables';
  supplier: string;
  currentStock: number;
  unit: string;
  avgDailyUsage: number;
  leadTimeDays: number;
  safetyStockDays: number;
  unitCost: number;
  orderingCost: number;
  carryingCostPct: number; // annual, as decimal e.g. 0.25
  discountTiers: DiscountTier[];
  notes?: string;
}

type Urgency = 'critical' | 'warning' | 'soon' | 'stable';
type Rec     = 'BUY NOW' | 'ORDER SOON' | 'BULK OPPORTUNITY' | 'HOLD';

interface Metrics {
  item: PurchaseItem;
  daysOfSupply: number;
  reorderPoint: number;
  daysUntilReorder: number;
  eoq: number;
  annualDemand: number;
  urgency: Urgency;
  recommendation: Rec;
  recommendedQty: number;
  capitalRequired: number;
  // best bulk tier vs standard EOQ
  bestTier: DiscountTier;
  bestTierCapital: number;
  annualSavingsBestTier: number;   // vs ordering at standard price in EOQ lots
  breakEvenMonths: number | null;
  bulkROI: number | null;           // annual ROI % on extra capital
}

// ── Demo Data ─────────────────────────────────────────────────────────────────

const DEMO: PurchaseItem[] = [
  {
    id: '1', name: 'Corrugated Shipping Boxes (12×10×8")', sku: 'PKG-001', category: 'Packaging',
    supplier: 'PackRight Supply Co.', unit: 'units', currentStock: 340,
    avgDailyUsage: 45, leadTimeDays: 7, safetyStockDays: 3,
    unitCost: 0.85, orderingCost: 75, carryingCostPct: 0.25,
    discountTiers: [
      { label: 'Standard', minQty: 1,    unitCost: 0.85 },
      { label: '500+',     minQty: 500,  unitCost: 0.79 },
      { label: '1,000+',   minQty: 1000, unitCost: 0.72 },
      { label: '2,500+',   minQty: 2500, unitCost: 0.65 },
    ],
    notes: 'Primary outbound shipment box. Demand spikes in Q4.',
  },
  {
    id: '2', name: 'Thermal Label Rolls (4×6", 500/roll)', sku: 'CSM-004', category: 'Consumables',
    supplier: 'LabelPro Direct', unit: 'rolls', currentStock: 12,
    avgDailyUsage: 1.8, leadTimeDays: 2, safetyStockDays: 1,
    unitCost: 18.00, orderingCost: 35, carryingCostPct: 0.22,
    discountTiers: [
      { label: 'Standard', minQty: 1,   unitCost: 18.00 },
      { label: '24+',      minQty: 24,  unitCost: 16.00 },
      { label: '48+',      minQty: 48,  unitCost: 13.50 },
      { label: '100+',     minQty: 100, unitCost: 11.00 },
    ],
    notes: 'Used for all outbound shipping labels.',
  },
  {
    id: '3', name: 'Void Fill Packing Peanuts (20 cu ft bag)', sku: 'PKG-008', category: 'Packaging',
    supplier: 'PackRight Supply Co.', unit: 'bags', currentStock: 15,
    avgDailyUsage: 2.1, leadTimeDays: 4, safetyStockDays: 3,
    unitCost: 16.00, orderingCost: 60, carryingCostPct: 0.20,
    discountTiers: [
      { label: 'Standard', minQty: 1,   unitCost: 16.00 },
      { label: '25+',      minQty: 25,  unitCost: 14.00 },
      { label: '50+',      minQty: 50,  unitCost: 12.50 },
      { label: '100+',     minQty: 100, unitCost: 11.00 },
    ],
  },
  {
    id: '4', name: 'Industrial HEPA Filter (OEM Replacement)', sku: 'MRO-012', category: 'MRO',
    supplier: 'FilterTech Industrial', unit: 'units', currentStock: 2,
    avgDailyUsage: 0.15, leadTimeDays: 14, safetyStockDays: 5,
    unitCost: 145.00, orderingCost: 0, carryingCostPct: 0.20,
    discountTiers: [
      { label: 'Standard', minQty: 1, unitCost: 145.00 },
      { label: '3+',       minQty: 3, unitCost: 128.00 },
    ],
    notes: 'Long lead time — single-source vendor. Critical for operations.',
  },
  {
    id: '5', name: 'Stretch Wrap Pallet Film (15"×1500\')', sku: 'PKG-015', category: 'Packaging',
    supplier: 'WrapMaster Inc.', unit: 'rolls', currentStock: 6,
    avgDailyUsage: 0.9, leadTimeDays: 5, safetyStockDays: 3,
    unitCost: 42.00, orderingCost: 50, carryingCostPct: 0.22,
    discountTiers: [
      { label: 'Standard', minQty: 1,  unitCost: 42.00 },
      { label: '12+',      minQty: 12, unitCost: 37.00 },
      { label: '24+',      minQty: 24, unitCost: 32.00 },
    ],
  },
  {
    id: '6', name: 'Nitrile Safety Gloves (100/box)', sku: 'MRO-003', category: 'MRO',
    supplier: 'SafeGuard Industrial', unit: 'boxes', currentStock: 6,
    avgDailyUsage: 0.8, leadTimeDays: 5, safetyStockDays: 2,
    unitCost: 12.00, orderingCost: 30, carryingCostPct: 0.25,
    discountTiers: [
      { label: 'Standard', minQty: 1,  unitCost: 12.00 },
      { label: '10+',      minQty: 10, unitCost: 10.50 },
      { label: '25+',      minQty: 25, unitCost: 9.00  },
    ],
  },
  {
    id: '7', name: 'HP LaserJet Toner Cartridges', sku: 'OFC-007', category: 'Office & Tech',
    supplier: 'Office Depot Business', unit: 'units', currentStock: 3,
    avgDailyUsage: 0.15, leadTimeDays: 3, safetyStockDays: 2,
    unitCost: 79.00, orderingCost: 20, carryingCostPct: 0.20,
    discountTiers: [
      { label: 'Standard', minQty: 1,  unitCost: 79.00 },
      { label: '5+',       minQty: 5,  unitCost: 69.00 },
      { label: '10+',      minQty: 10, unitCost: 58.00 },
    ],
  },
  {
    id: '8', name: 'Letter Paper (case, 10 reams)', sku: 'OFC-001', category: 'Office & Tech',
    supplier: 'Office Depot Business', unit: 'cases', currentStock: 4,
    avgDailyUsage: 0.5, leadTimeDays: 2, safetyStockDays: 1,
    unitCost: 38.00, orderingCost: 20, carryingCostPct: 0.18,
    discountTiers: [
      { label: 'Standard', minQty: 1,  unitCost: 38.00 },
      { label: '10+',      minQty: 10, unitCost: 34.00 },
      { label: '20+',      minQty: 20, unitCost: 30.00 },
    ],
  },
  {
    id: '9', name: 'Bubble Wrap Roll (12"×100\')', sku: 'PKG-003', category: 'Packaging',
    supplier: 'PackRight Supply Co.', unit: 'rolls', currentStock: 8,
    avgDailyUsage: 1.2, leadTimeDays: 3, safetyStockDays: 2,
    unitCost: 24.50, orderingCost: 45, carryingCostPct: 0.22,
    discountTiers: [
      { label: 'Standard', minQty: 1,  unitCost: 24.50 },
      { label: '12+',      minQty: 12, unitCost: 22.00 },
      { label: '24+',      minQty: 24, unitCost: 19.50 },
    ],
  },
  {
    id: '10', name: 'USB-C Cables 6ft (5-pack)', sku: 'OFC-011', category: 'Components',
    supplier: 'TechSource Direct', unit: 'packs', currentStock: 4,
    avgDailyUsage: 0.1, leadTimeDays: 4, safetyStockDays: 2,
    unitCost: 29.00, orderingCost: 15, carryingCostPct: 0.20,
    discountTiers: [
      { label: 'Standard', minQty: 1,  unitCost: 29.00 },
      { label: '10+',      minQty: 10, unitCost: 24.00 },
      { label: '25+',      minQty: 25, unitCost: 19.00 },
    ],
  },
  {
    id: '11', name: 'Floor Marking Safety Tape (50m)', sku: 'MRO-021', category: 'MRO',
    supplier: 'SafeGuard Industrial', unit: 'rolls', currentStock: 8,
    avgDailyUsage: 0.3, leadTimeDays: 3, safetyStockDays: 2,
    unitCost: 18.00, orderingCost: 25, carryingCostPct: 0.22,
    discountTiers: [
      { label: 'Standard', minQty: 1,  unitCost: 18.00 },
      { label: '12+',      minQty: 12, unitCost: 15.00 },
      { label: '24+',      minQty: 24, unitCost: 12.00 },
    ],
  },
  {
    id: '12', name: 'Shrink Wrap Film (12"×1500\')', sku: 'PKG-019', category: 'Packaging',
    supplier: 'WrapMaster Inc.', unit: 'rolls', currentStock: 3,
    avgDailyUsage: 0.6, leadTimeDays: 5, safetyStockDays: 2,
    unitCost: 52.00, orderingCost: 55, carryingCostPct: 0.22,
    discountTiers: [
      { label: 'Standard', minQty: 1, unitCost: 52.00 },
      { label: '6+',       minQty: 6, unitCost: 47.00 },
      { label: '12+',      minQty: 12, unitCost: 41.00 },
    ],
    notes: 'Overlaps with stretch wrap — evaluate consolidation.',
  },
];

// ── Computation ───────────────────────────────────────────────────────────────

function eoq(annualDemand: number, orderingCost: number, holdingCostPerUnit: number): number {
  if (holdingCostPerUnit <= 0 || annualDemand <= 0) return Math.ceil(annualDemand / 12);
  return Math.max(1, Math.round(Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit)));
}

function annualTotalCost(
  annualDemand: number, orderQty: number, unitCost: number,
  orderingCost: number, carryingCostPct: number,
): number {
  const purchaseCost = annualDemand * unitCost;
  const orderFreqCost = (annualDemand / Math.max(orderQty, 1)) * orderingCost;
  const holdingCost = (orderQty / 2) * unitCost * carryingCostPct;
  return purchaseCost + orderFreqCost + holdingCost;
}

function computeMetrics(item: PurchaseItem): Metrics {
  const annualDemand = item.avgDailyUsage * 365;
  const holdingCostPerUnit = item.unitCost * item.carryingCostPct;
  const stdEOQ = eoq(annualDemand, item.orderingCost, holdingCostPerUnit);
  const stdAnnualCost = annualTotalCost(annualDemand, stdEOQ, item.unitCost, item.orderingCost, item.carryingCostPct);

  const reorderPoint = Math.ceil((item.leadTimeDays + item.safetyStockDays) * item.avgDailyUsage);
  const daysOfSupply = item.avgDailyUsage > 0 ? item.currentStock / item.avgDailyUsage : 999;
  const daysUntilReorder = daysOfSupply - item.leadTimeDays - item.safetyStockDays;

  // Urgency
  let urgency: Urgency;
  if (daysUntilReorder <= 0)   urgency = 'critical';
  else if (daysUntilReorder <= 5)  urgency = 'warning';
  else if (daysUntilReorder <= 14) urgency = 'soon';
  else                              urgency = 'stable';

  // Find best bulk tier by total annual cost
  let bestTier = item.discountTiers[0];
  let bestAnnualCost = stdAnnualCost;
  for (const tier of item.discountTiers.slice(1)) {
    const tierHolding = tier.unitCost * item.carryingCostPct;
    const tierEOQ = eoq(annualDemand, item.orderingCost, tierHolding);
    const orderQty = Math.max(tier.minQty, tierEOQ);
    const cost = annualTotalCost(annualDemand, orderQty, tier.unitCost, item.orderingCost, item.carryingCostPct);
    if (cost < bestAnnualCost) { bestAnnualCost = cost; bestTier = tier; }
  }

  const annualSavingsBestTier = stdAnnualCost - bestAnnualCost;
  const bestTierQty = Math.max(bestTier.minQty, eoq(annualDemand, item.orderingCost, bestTier.unitCost * item.carryingCostPct));
  const bestTierCapital = bestTierQty * bestTier.unitCost;

  // Break-even: extra capital invested / monthly savings
  const stdCapital = stdEOQ * item.unitCost;
  const extraCapital = bestTierCapital - stdCapital;
  const breakEvenMonths = extraCapital > 0 && annualSavingsBestTier > 0
    ? (extraCapital / (annualSavingsBestTier / 12))
    : null;
  const bulkROI = extraCapital > 0 && annualSavingsBestTier > 0
    ? (annualSavingsBestTier / extraCapital) * 100
    : null;

  // Recommendation
  let recommendation: Rec;
  if (urgency === 'critical' || urgency === 'warning') recommendation = 'BUY NOW';
  else if (urgency === 'soon')                          recommendation = 'ORDER SOON';
  else if (bestTier !== item.discountTiers[0] && annualSavingsBestTier > 50) recommendation = 'BULK OPPORTUNITY';
  else                                                  recommendation = 'HOLD';

  const recommendedQty = recommendation === 'BULK OPPORTUNITY'
    ? bestTierQty : stdEOQ;
  const capitalRequired = recommendedQty * item.unitCost;

  return {
    item, daysOfSupply, reorderPoint, daysUntilReorder,
    eoq: stdEOQ, annualDemand, urgency, recommendation,
    recommendedQty, capitalRequired,
    bestTier, bestTierCapital, annualSavingsBestTier,
    breakEvenMonths, bulkROI,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtD = (n: number) => n < 0 ? `${Math.abs(Math.round(n))}d overdue` : `${Math.round(n)}d`;
const fmtM = (n: number) => { const abs = Math.abs(n); const s = abs >= 1_000_000 ? `$${(abs/1_000_000).toFixed(1)}M` : `$${Math.round(abs).toLocaleString('en-US')}`; return n < 0 ? `(${s})` : s; };
const fmtU = (n: number, u: string) => `${Math.round(n).toLocaleString('en-US')} ${u}`;

const URGENCY_STYLES: Record<Urgency, { dot: string; text: string; bg: string; border: string; label: string }> = {
  critical: { dot: 'bg-red-400',     text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',    label: 'CRITICAL'  },
  warning:  { dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',  label: 'ORDER SOON' },
  soon:     { dot: 'bg-yellow-400',  text: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20', label: 'MONITOR'   },
  stable:   { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',label: 'STABLE'    },
};

const REC_STYLES: Record<Rec, { bg: string; text: string; border: string }> = {
  'BUY NOW':          { bg: 'bg-red-500/15',     text: 'text-red-300',     border: 'border-red-500/25'     },
  'ORDER SOON':       { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/25'   },
  'BULK OPPORTUNITY': { bg: 'bg-indigo-500/15',  text: 'text-indigo-300',  border: 'border-indigo-500/25'  },
  'HOLD':             { bg: 'bg-slate-800/40',   text: 'text-slate-400',   border: 'border-slate-700/40'   },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Packaging':    'text-cyan-400    bg-cyan-500/10    border-cyan-500/20',
  'Consumables':  'text-violet-400  bg-violet-500/10  border-violet-500/20',
  'MRO':          'text-amber-400   bg-amber-500/10   border-amber-500/20',
  'Office & Tech':'text-sky-400     bg-sky-500/10     border-sky-500/20',
  'Components':   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'Raw Materials':'text-rose-400    bg-rose-500/10    border-rose-500/20',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, accent, icon }: { label: string; value: string; sub?: string; accent: string; icon: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${accent}`}>{label}</div>
        <span className="text-[16px] opacity-60">{icon}</span>
      </div>
      <div className="text-[22px] font-bold text-slate-100 tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function DaysBar({ days, leadTime, max = 60 }: { days: number; leadTime: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (days / max) * 100));
  const ltPct = Math.min(100, (leadTime / max) * 100);
  const color = days <= 0 ? 'bg-red-500' : days <= leadTime ? 'bg-amber-500' : days <= leadTime * 2 ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden w-full mt-1">
      <div className={`absolute top-0 left-0 h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }}/>
      <div className="absolute top-0 h-full w-px bg-slate-500/60" style={{ left: `${ltPct}%` }} title={`Lead time: ${leadTime}d`}/>
    </div>
  );
}

// ── Bulk Analysis Card ────────────────────────────────────────────────────────

function BulkCard({ m }: { m: Metrics }) {
  const [expanded, setExpanded] = useState(false);
  const item = m.item;
  const tiers = item.discountTiers;
  const stdAnnualDemand = m.annualDemand;
  const std = tiers[0];

  const tierAnalysis = tiers.map(tier => {
    const holdingPerUnit = tier.unitCost * item.carryingCostPct;
    const teoq = eoq(stdAnnualDemand, item.orderingCost, holdingPerUnit);
    const orderQty = Math.max(tier.minQty, teoq);
    const annCost = annualTotalCost(stdAnnualDemand, orderQty, tier.unitCost, item.orderingCost, item.carryingCostPct);
    const stdCost = annualTotalCost(stdAnnualDemand, m.eoq, std.unitCost, item.orderingCost, std.unitCost * item.carryingCostPct);
    const annualSavings = stdCost - annCost;
    const capitalNeeded = orderQty * tier.unitCost;
    const extraCapital = capitalNeeded - m.eoq * std.unitCost;
    const beMo = extraCapital > 0 && annualSavings > 0 ? extraCapital / (annualSavings / 12) : null;
    const roi  = extraCapital > 0 && annualSavings > 0 ? (annualSavings / extraCapital) * 100 : null;
    const isBest = tier === m.bestTier;
    return { tier, orderQty, annCost, annualSavings, capitalNeeded, extraCapital, beMo, roi, isBest };
  });

  const hasBulk = m.annualSavingsBestTier > 0 && m.bestTier !== std;
  if (!hasBulk && tiers.length <= 1) return null;

  return (
    <div className={`border rounded-xl overflow-hidden ${hasBulk ? 'border-indigo-500/20' : 'border-slate-800/50'}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/20 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.urgency === 'critical' ? 'bg-red-400' : hasBulk ? 'bg-indigo-400' : 'bg-slate-600'}`}/>
          <div>
            <div className="text-[13px] font-semibold text-slate-100">{item.name}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{item.supplier} · {tiers.length} pricing tiers</div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {hasBulk && (
            <div className="text-right">
              <div className="text-[12px] font-bold text-emerald-400">{fmtM(m.annualSavingsBestTier)}/yr</div>
              <div className="text-[10px] text-slate-500">potential savings</div>
            </div>
          )}
          {m.breakEvenMonths !== null && (
            <div className="text-right">
              <div className="text-[12px] font-bold text-indigo-400">{m.breakEvenMonths.toFixed(1)} mo</div>
              <div className="text-[10px] text-slate-500">break-even</div>
            </div>
          )}
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            className={`w-3 h-3 text-slate-600 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path d="M2 3.5L5 6.5 8 3.5"/>
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800/50 p-4 space-y-4">
          {/* Tier comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-800/60">
                  {['Tier', 'Min Qty', 'Unit Cost', 'Disc %', 'Opt. Order Qty', 'Capital Needed', 'Extra Capital', 'Annual Savings', 'Break-even', 'ROI', 'Verdict'].map(h => (
                    <th key={h} className="text-left py-1.5 pr-4 text-slate-600 font-semibold uppercase tracking-[0.06em] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tierAnalysis.map(({ tier, orderQty, annualSavings, capitalNeeded, extraCapital, beMo, roi, isBest }) => {
                  const discPct = ((std.unitCost - tier.unitCost) / std.unitCost) * 100;
                  const verdict = tier === std ? 'Baseline' : annualSavings > 0 ? (isBest ? '✓ Best' : 'Viable') : 'Skip';
                  const verdictColor = verdict === '✓ Best' ? 'text-emerald-400 font-bold' : verdict === 'Viable' ? 'text-indigo-400' : verdict === 'Baseline' ? 'text-slate-500' : 'text-red-400';
                  return (
                    <tr key={tier.label} className={`border-b border-slate-800/30 last:border-0 ${isBest ? 'bg-indigo-500/5' : ''}`}>
                      <td className="py-2 pr-4 font-semibold text-slate-300">{tier.label}</td>
                      <td className="py-2 pr-4 text-slate-400 tabular-nums">{tier.minQty.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-slate-300 tabular-nums">{fmtM(tier.unitCost)}</td>
                      <td className={`py-2 pr-4 tabular-nums ${discPct > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {discPct > 0 ? `-${discPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2 pr-4 text-slate-400 tabular-nums">{fmtU(orderQty, item.unit)}</td>
                      <td className="py-2 pr-4 text-slate-300 tabular-nums">{fmtM(capitalNeeded)}</td>
                      <td className={`py-2 pr-4 tabular-nums ${extraCapital > 0 ? 'text-amber-400/80' : 'text-slate-600'}`}>
                        {extraCapital > 0 ? `+${fmtM(extraCapital)}` : '—'}
                      </td>
                      <td className={`py-2 pr-4 tabular-nums font-medium ${annualSavings > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {annualSavings > 0 ? fmtM(annualSavings) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-slate-400 tabular-nums">{beMo !== null ? `${beMo.toFixed(1)} mo` : '—'}</td>
                      <td className={`py-2 pr-4 tabular-nums ${roi !== null && roi > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {roi !== null ? `${roi.toFixed(0)}%` : '—'}
                      </td>
                      <td className={`py-2 ${verdictColor}`}>{verdict}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Plain-language recommendation */}
          {hasBulk && (
            <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-lg p-3 text-[11px] text-slate-400 leading-relaxed">
              <span className="text-indigo-300 font-semibold">Recommendation: </span>
              Order {fmtU(Math.max(m.bestTier.minQty, m.eoq), item.unit)} at the <strong className="text-slate-200">{m.bestTier.label}</strong> tier ({fmtM(m.bestTier.unitCost)}/{item.unit}).
              {' '}Capital required: <strong className="text-slate-200">{fmtM(m.bestTierCapital)}</strong>
              {m.breakEvenMonths !== null && ` · Pays back in ${m.breakEvenMonths.toFixed(1)} months`}
              {m.bulkROI !== null && ` · ${m.bulkROI.toFixed(0)}% annual ROI on extra capital tied up`}.
              {' '}Annual savings vs. standard ordering: <strong className="text-emerald-400">{fmtM(m.annualSavingsBestTier)}</strong>.
              {item.notes && <span className="block mt-1 text-slate-600 italic">{item.notes}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Order Calendar Row ────────────────────────────────────────────────────────

function CalendarRow({ m, weekWidth }: { m: Metrics; weekWidth: number }) {
  const orderInDays = Math.max(0, m.daysUntilReorder);
  const stockoutInDays = Math.max(0, m.daysOfSupply);
  const MAX = 56; // 8 weeks
  const color = m.urgency === 'critical' ? '#ef4444' : m.urgency === 'warning' ? '#f59e0b' : m.urgency === 'soon' ? '#eab308' : '#10b981';

  const orderX = Math.min((orderInDays / MAX) * 100, 95);
  const stockX = Math.min((stockoutInDays / MAX) * 100, 99);

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800/30 last:border-0">
      <div className="w-40 flex-shrink-0">
        <div className="text-[11px] font-medium text-slate-300 truncate">{m.item.name.split(' (')[0]}</div>
        <div className="text-[10px] text-slate-600">{m.item.supplier.split(' ')[0]}</div>
      </div>
      <div className="flex-1 relative h-6">
        {/* background */}
        <div className="absolute inset-y-1 left-0 right-0 bg-slate-800/40 rounded-full"/>
        {/* stock bar */}
        <div className="absolute inset-y-1.5 left-0 rounded-full" style={{ width: `${stockX}%`, background: `${color}25` }}/>
        {/* order marker */}
        {orderInDays > 0 && orderInDays < MAX && (
          <div className="absolute top-0 bottom-0 w-0.5 rounded-full" style={{ left: `${orderX}%`, background: color }}/>
        )}
        {/* stockout marker */}
        {stockoutInDays < MAX && (
          <div className="absolute top-0 bottom-0 w-px rounded-full bg-red-500/60" style={{ left: `${stockX}%` }}/>
        )}
        {/* today marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-500/60" style={{ left: 0 }}/>
      </div>
      <div className="w-24 text-right flex-shrink-0">
        <div className={`text-[11px] font-semibold tabular-nums ${orderInDays <= 0 ? 'text-red-400' : 'text-slate-300'}`}>
          {orderInDays <= 0 ? 'OVERDUE' : `Order in ${Math.round(orderInDays)}d`}
        </div>
        <div className="text-[10px] text-slate-600">{Math.round(m.daysOfSupply)}d supply left</div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  data: UnifiedBusinessData;
  onAskAI?: (msg: string) => void;
}

type Tab = 'overview' | 'decisions' | 'bulk' | 'calendar';
type SortKey = 'urgency' | 'days' | 'capital' | 'savings' | 'name';

const STORAGE_KEY = 'bos_inventory_items';

const BLANK_ITEM: Omit<PurchaseItem, 'id' | 'discountTiers'> = {
  name: '', sku: '', category: 'Raw Materials', supplier: '',
  currentStock: 0, unit: 'units', avgDailyUsage: 1,
  leadTimeDays: 7, safetyStockDays: 3,
  unitCost: 10, orderingCost: 50, carryingCostPct: 0.25,
};

export default function CapitalImpactSummary({ data, onAskAI }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sortKey, setSortKey] = useState<SortKey>('urgency');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [recFilter, setRecFilter] = useState<string>('All');
  const [budgetInput, setBudgetInput] = useState<string>('5000');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Persisted user inventory items
  const [userItems, setUserItems] = useState<PurchaseItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<PurchaseItem, 'id' | 'discountTiers'>>(BLANK_ITEM);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setUserItems(JSON.parse(s));
    } catch {}
  }, []);

  const persistItems = (next: PurchaseItem[]) => {
    setUserItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const saveItem = () => {
    if (!draft.name.trim() || draft.avgDailyUsage <= 0) return;
    const newItem: PurchaseItem = {
      ...draft,
      // carryingCostPct entered as integer % (e.g. 25) — store as decimal
      carryingCostPct: draft.carryingCostPct > 1 ? draft.carryingCostPct / 100 : draft.carryingCostPct,
      id: `inv_${Date.now()}`,
      discountTiers: [{ label: 'Standard', minQty: 1, unitCost: draft.unitCost }],
    };
    persistItems([...userItems, newItem]);
    setDraft(BLANK_ITEM);
    setAddOpen(false);
  };

  const deleteItem = (id: string) => persistItems(userItems.filter(i => i.id !== id));

  const isDemo = userItems.length === 0;
  const activeItems = isDemo ? DEMO : userItems;

  const metrics = useMemo(() => activeItems.map(computeMetrics), [activeItems]);

  const categories = ['All', ...Array.from(new Set(activeItems.map(d => d.category)))];

  const sorted = useMemo(() => {
    const urgencyOrder: Record<Urgency, number> = { critical: 0, warning: 1, soon: 2, stable: 3 };
    return [...metrics]
      .filter(m => catFilter === 'All' || m.item.category === catFilter)
      .filter(m => recFilter === 'All' || m.recommendation === recFilter)
      .sort((a, b) => {
        if (sortKey === 'urgency') return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || a.daysUntilReorder - b.daysUntilReorder;
        if (sortKey === 'days')    return a.daysUntilReorder - b.daysUntilReorder;
        if (sortKey === 'capital') return b.capitalRequired - a.capitalRequired;
        if (sortKey === 'savings') return b.annualSavingsBestTier - a.annualSavingsBestTier;
        return a.item.name.localeCompare(b.item.name);
      });
  }, [metrics, catFilter, recFilter, sortKey]);

  // Portfolio KPIs
  const portfolio = useMemo(() => {
    const critical  = metrics.filter(m => m.urgency === 'critical').length;
    const warning   = metrics.filter(m => m.urgency === 'warning').length;
    const totalCapReq = metrics.filter(m => m.recommendation !== 'HOLD').reduce((s, m) => s + m.capitalRequired, 0);
    const totalSavings = metrics.reduce((s, m) => s + m.annualSavingsBestTier, 0);
    const bulkOpps  = metrics.filter(m => m.recommendation === 'BULK OPPORTUNITY').length;
    const buyNow    = metrics.filter(m => m.recommendation === 'BUY NOW').length;
    return { critical, warning, totalCapReq, totalSavings, bulkOpps, buyNow };
  }, [metrics]);

  // Budget optimizer
  const budget = parseFloat(budgetInput) || 0;
  const optimized = useMemo(() => {
    if (budget <= 0) return [];
    const candidates = [...metrics]
      .filter(m => m.recommendation !== 'HOLD')
      .sort((a, b) => {
        const urgOrd: Record<Urgency, number> = { critical: 100, warning: 75, soon: 50, stable: 10 };
        const aScore = urgOrd[a.urgency] + (a.annualSavingsBestTier / Math.max(a.capitalRequired, 1)) * 10;
        const bScore = urgOrd[b.urgency] + (b.annualSavingsBestTier / Math.max(b.capitalRequired, 1)) * 10;
        return bScore - aScore;
      });
    let remaining = budget;
    const selected: (Metrics & { afforded: boolean })[] = [];
    for (const m of candidates) {
      if (remaining >= m.capitalRequired) {
        selected.push({ ...m, afforded: true });
        remaining -= m.capitalRequired;
      } else if (remaining > 0) {
        selected.push({ ...m, afforded: false });
      }
    }
    return selected;
  }, [metrics, budget]);

  const recs = ['All', 'BUY NOW', 'ORDER SOON', 'BULK OPPORTUNITY', 'HOLD'];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',   label: 'Overview'       },
    { id: 'decisions',  label: 'Decision Engine' },
    { id: 'bulk',       label: 'Bulk Analysis'   },
    { id: 'calendar',   label: 'Order Calendar'  },
  ];

  const thCls = 'text-left py-2 pr-3 text-[10px] font-semibold text-slate-600 uppercase tracking-[0.07em] whitespace-nowrap cursor-pointer hover:text-slate-400 select-none';

  return (
    <div className="space-y-5">

      {/* ── Demo banner ── */}
      {isDemo && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
          <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 text-amber-400 flex-shrink-0">
            <path d="M7 1L1 12h12L7 1zm0 3.5l2.5 5.5h-5L7 4.5z"/>
          </svg>
          <div className="text-[11px] text-amber-300/80 flex-1">
            Showing <span className="font-semibold text-amber-300">demo inventory</span> — add your real items with the button below.
          </div>
          <button onClick={() => setAddOpen(true)}
            className="text-[10px] font-semibold text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg hover:bg-amber-500/10 transition-colors flex-shrink-0">
            Add Item
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[15px] font-bold text-slate-100">Capital Impact Summary</div>
            {!isDemo && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {userItems.length} items
              </span>
            )}
          </div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            Intelligent purchasing engine · {metrics.length} items tracked · {portfolio.critical + portfolio.warning} require action
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isDemo && (
            <button onClick={() => setAddOpen(true)}
              className="text-[11px] font-semibold text-slate-400 border border-slate-700/50 hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-colors">
              + Add Item
            </button>
          )}
        {onAskAI && (
          <button
            onClick={() => onAskAI(
              `Here is my purchasing summary: ${portfolio.buyNow} items need immediate ordering, ${portfolio.bulkOpps} bulk opportunities worth ${fmtM(portfolio.totalSavings)}/yr in annual savings. Total capital required for all pending orders: ${fmtM(portfolio.totalCapReq)}. ` +
              `Critical items: ${metrics.filter(m => m.urgency === 'critical').map(m => m.item.name).join(', ')}. ` +
              `What should I prioritize and are any of these bulk discounts worth the capital commitment?`
            )}
            className="flex-shrink-0 flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 px-2.5 py-1.5 rounded-lg transition-all font-medium"
          >
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
              <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
            </svg>
            Ask AI
          </button>
        )}
        </div>
      </div>

      {/* ── Add Item Modal ── */}
      {addOpen && (
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-slate-100">Add Inventory Item</div>
            <button onClick={() => setAddOpen(false)} className="text-slate-600 hover:text-slate-300 text-lg leading-none">×</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { label: 'Item Name',         key: 'name',             type: 'text',   placeholder: 'Corrugated Boxes 12×10×8"' },
              { label: 'SKU / Code',        key: 'sku',              type: 'text',   placeholder: 'PKG-001' },
              { label: 'Supplier',          key: 'supplier',         type: 'text',   placeholder: 'PackRight Supply Co.' },
              { label: 'Unit',             key: 'unit',             type: 'text',   placeholder: 'units / rolls / cases' },
              { label: 'Current Stock',     key: 'currentStock',     type: 'number', placeholder: '200' },
              { label: 'Avg Daily Usage',   key: 'avgDailyUsage',    type: 'number', placeholder: '15' },
              { label: 'Lead Time (days)',  key: 'leadTimeDays',     type: 'number', placeholder: '7' },
              { label: 'Safety Stock (days)', key: 'safetyStockDays', type: 'number', placeholder: '3' },
              { label: 'Unit Cost ($)',     key: 'unitCost',         type: 'number', placeholder: '0.85' },
              { label: 'Ordering Cost ($)', key: 'orderingCost',     type: 'number', placeholder: '75' },
              { label: 'Carrying Cost %',  key: 'carryingCostPct',  type: 'number', placeholder: '25' },
            ] as { label: string; key: keyof typeof draft; type: string; placeholder: string }[]).map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={String(draft[f.key])}
                  onChange={e => setDraft(d => ({ ...d, [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                  className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2 text-[12px] text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/50"
                />
              </div>
            ))}
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Category</label>
              <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value as PurchaseItem['category'] }))}
                className="w-full bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2 text-[12px] text-slate-200 outline-none focus:border-indigo-500/50">
                {(['Raw Materials','Packaging','MRO','Office & Tech','Components','Consumables'] as const).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-[9px] text-slate-600">Carrying cost entered as % (e.g. 25 = 25% annual). Discount tiers can be added after saving.</div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAddOpen(false)} className="text-[11px] text-slate-500 border border-slate-700/40 px-3 py-1.5 rounded-lg">Cancel</button>
            <button onClick={saveItem} disabled={!draft.name.trim()}
              className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-4 py-1.5 rounded-lg hover:bg-emerald-500/20 disabled:opacity-40 transition-colors">
              Save Item
            </button>
          </div>
        </div>
      )}

      {/* ── User item list (when real data) ── */}
      {!isDemo && (
        <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Inventory ({userItems.length} items)</div>
          <div className="space-y-1.5">
            {userItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-slate-800/30 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-medium text-slate-200 truncate">{item.name}</span>
                  <span className="text-[10px] text-slate-500 ml-2">{item.sku} · {item.supplier}</span>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0">{item.currentStock} {item.unit} on hand</span>
                <button onClick={() => deleteItem(item.id)} className="text-[10px] text-slate-700 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded border border-slate-700/40 hover:border-red-500/30 flex-shrink-0">×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Capital Required (Pending)" value={fmtM(portfolio.totalCapReq)} sub={`${portfolio.buyNow} buy now · ${metrics.filter(m=>m.recommendation==='ORDER SOON').length} order soon`} accent="text-red-400" icon="⚡"/>
        <KPICard label="Annual Savings Available" value={fmtM(portfolio.totalSavings)} sub={`${portfolio.bulkOpps} bulk opportunities`} accent="text-emerald-400" icon="💰"/>
        <KPICard label="Items Below Reorder Point" value={`${portfolio.critical}`} sub={`+${portfolio.warning} within lead time`} accent="text-amber-400" icon="⚠"/>
        <KPICard label="Avg Discount ROI (Bulk Opps)" value={`${(metrics.filter(m => m.bulkROI !== null).reduce((s,m)=>s+(m.bulkROI??0),0)/Math.max(1,metrics.filter(m=>m.bulkROI!==null).length)).toFixed(0)}%`} sub="annualized on extra capital" accent="text-indigo-400" icon="📊"/>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[12px] font-medium transition-all ${
              activeTab === t.id
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Top urgencies */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="text-[13px] font-semibold text-slate-100 mb-4">Action Queue</div>
            <div className="space-y-3">
              {metrics
                .filter(m => m.recommendation !== 'HOLD')
                .sort((a,b) => {
                  const u: Record<Urgency,number> = {critical:0,warning:1,soon:2,stable:3};
                  return u[a.urgency]-u[b.urgency];
                })
                .map(m => {
                  const us = URGENCY_STYLES[m.urgency];
                  const rs = REC_STYLES[m.recommendation];
                  return (
                    <div key={m.item.id} className="flex items-center gap-3 py-2 border-b border-slate-800/30 last:border-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${us.dot}`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[12px] font-medium text-slate-200 truncate">{m.item.name.split(' (')[0]}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[m.item.category] ?? ''}`}>
                            {m.item.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {m.daysOfSupply < 0 ? 'Stockout risk' : `${Math.round(m.daysOfSupply)}d supply`}
                          {' · '}{m.item.supplier}
                        </div>
                        <DaysBar days={m.daysOfSupply} leadTime={m.item.leadTimeDays}/>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <div className="text-[12px] font-semibold text-slate-200 tabular-nums">{fmtM(m.capitalRequired)}</div>
                          <div className="text-[10px] text-slate-600">{m.recommendedQty.toLocaleString()} {m.item.unit}</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${rs.bg} ${rs.text} ${rs.border}`}>
                          {m.recommendation}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Budget Allocator */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[13px] font-semibold text-slate-100">Budget Optimizer</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Set your purchasing budget — we'll rank which orders to place first for maximum capital efficiency.</div>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-1.5">
                <span className="text-[12px] text-slate-400">$</span>
                <input
                  type="number"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  className="w-24 bg-transparent text-[13px] font-semibold text-slate-100 outline-none tabular-nums"
                  placeholder="5000"
                />
              </div>
            </div>
            {optimized.length > 0 ? (
              <div className="space-y-2">
                {optimized.map(m => {
                  const rs = REC_STYLES[m.recommendation];
                  return (
                    <div key={m.item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${m.afforded ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-slate-800/30 opacity-50'}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${m.afforded ? 'bg-indigo-500/20' : 'bg-slate-800'}`}>
                        <span className="text-[10px]">{m.afforded ? '✓' : '—'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-medium text-slate-200">{m.item.name.split(' (')[0]}</span>
                        <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${rs.bg} ${rs.text} ${rs.border}`}>{m.recommendation}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[12px] font-semibold tabular-nums text-slate-200">{fmtM(m.capitalRequired)}</div>
                        {m.annualSavingsBestTier > 0 && <div className="text-[10px] text-emerald-400">{fmtM(m.annualSavingsBestTier)}/yr saved</div>}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-2 border-t border-slate-800/50 text-[12px]">
                  <span className="text-slate-500">
                    Budget: <span className="text-slate-300 font-semibold">{fmtM(budget)}</span>
                    {' · '}
                    Allocated: <span className="text-indigo-300 font-semibold">
                      {fmtM(optimized.filter(m=>m.afforded).reduce((s,m)=>s+m.capitalRequired,0))}
                    </span>
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    {fmtM(optimized.filter(m=>m.afforded).reduce((s,m)=>s+m.annualSavingsBestTier,0))}/yr savings
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-slate-600 text-center py-4">Enter a budget above to see optimized order recommendations.</div>
            )}
          </div>
        </div>
      )}

      {/* ══ DECISION ENGINE TAB ══════════════════════════════════════════════ */}
      {activeTab === 'decisions' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          {/* Filters */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-800/50 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${catFilter === c ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20' : 'text-slate-500 border-slate-800/50 hover:text-slate-300'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-slate-800 hidden sm:block"/>
            <div className="flex gap-1.5 flex-wrap">
              {recs.map(r => (
                <button key={r} onClick={() => setRecFilter(r)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${recFilter === r ? 'bg-slate-700/60 text-slate-200 border-slate-600/50' : 'text-slate-500 border-slate-800/50 hover:text-slate-300'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-800/50">
                <tr>
                  {[
                    { key: 'name',    label: 'Item' },
                    { key: 'urgency', label: 'Urgency' },
                    { key: 'days',    label: 'Days of Supply' },
                    { key: null,      label: 'Reorder Point' },
                    { key: null,      label: 'EOQ' },
                    { key: null,      label: 'Rec. Qty' },
                    { key: 'capital', label: 'Capital Req.' },
                    { key: 'savings', label: 'Annual Savings' },
                    { key: null,      label: 'Action' },
                  ].map(col => (
                    <th key={col.label} className={thCls} onClick={() => col.key && setSortKey(col.key as SortKey)}>
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.key && sortKey === col.key && <span className="text-indigo-400">↑</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(m => {
                  const us = URGENCY_STYLES[m.urgency];
                  const rs = REC_STYLES[m.recommendation];
                  const isExp = expanded === m.item.id;
                  return [
                    <tr key={m.item.id}
                      onClick={() => setExpanded(isExp ? null : m.item.id)}
                      className="border-b border-slate-800/30 hover:bg-slate-800/20 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 pr-3 pl-4">
                        <div className="text-[12px] font-medium text-slate-200 max-w-[200px] leading-snug">{m.item.name.split(' (')[0]}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5 truncate max-w-[200px]">{m.item.supplier}</div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${us.dot}`}/>
                          <span className={`text-[10px] font-bold ${us.text}`}>{us.label}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="text-[12px] font-semibold text-slate-300 tabular-nums">
                          {m.daysOfSupply > 99 ? '99+' : Math.round(m.daysOfSupply)}d
                        </div>
                        <DaysBar days={m.daysOfSupply} leadTime={m.item.leadTimeDays}/>
                      </td>
                      <td className="py-2.5 pr-3 text-[12px] text-slate-400 tabular-nums">{m.reorderPoint.toLocaleString()} {m.item.unit}</td>
                      <td className="py-2.5 pr-3 text-[12px] text-slate-400 tabular-nums">{m.eoq.toLocaleString()} {m.item.unit}</td>
                      <td className="py-2.5 pr-3 text-[12px] font-semibold text-slate-200 tabular-nums">{m.recommendedQty.toLocaleString()} {m.item.unit}</td>
                      <td className="py-2.5 pr-3 text-[12px] font-semibold text-slate-200 tabular-nums">{fmtM(m.capitalRequired)}</td>
                      <td className="py-2.5 pr-3">
                        {m.annualSavingsBestTier > 0
                          ? <span className="text-[12px] font-semibold text-emerald-400 tabular-nums">{fmtM(m.annualSavingsBestTier)}/yr</span>
                          : <span className="text-[12px] text-slate-600">—</span>}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${rs.bg} ${rs.text} ${rs.border}`}>
                          {m.recommendation}
                        </span>
                      </td>
                    </tr>,
                    isExp && (
                      <tr key={`${m.item.id}-detail`} className="bg-slate-800/10">
                        <td colSpan={9} className="px-4 pb-4 pt-2">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                            {[
                              { label: 'Current Stock',    value: fmtU(m.item.currentStock, m.item.unit) },
                              { label: 'Daily Usage',      value: `${m.item.avgDailyUsage} ${m.item.unit}/day` },
                              { label: 'Lead Time',        value: `${m.item.leadTimeDays} days` },
                              { label: 'Safety Stock',     value: `${m.item.safetyStockDays} days` },
                              { label: 'Standard Price',   value: `${fmtM(m.item.unitCost)}/${m.item.unit}` },
                              { label: 'Best Tier',        value: `${fmtM(m.bestTier.unitCost)}/${m.item.unit} (${m.bestTier.label})` },
                              { label: 'Carrying Cost',    value: `${(m.item.carryingCostPct * 100).toFixed(0)}%/yr` },
                              { label: 'Ordering Cost',    value: m.item.orderingCost > 0 ? fmtM(m.item.orderingCost) : 'Included' },
                            ].map(d => (
                              <div key={d.label} className="bg-slate-800/40 rounded-lg p-2">
                                <div className="text-slate-600 uppercase tracking-[0.06em] text-[9px] font-semibold">{d.label}</div>
                                <div className="text-slate-200 font-semibold mt-0.5">{d.value}</div>
                              </div>
                            ))}
                          </div>
                          {m.item.notes && <div className="mt-2 text-[11px] text-slate-500 italic">{m.item.notes}</div>}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ BULK ANALYSIS TAB ════════════════════════════════════════════════ */}
      {activeTab === 'bulk' && (
        <div className="space-y-3">
          <div className="bg-slate-900/30 border border-slate-800/30 rounded-xl p-4 text-[12px] text-slate-400 leading-relaxed">
            <strong className="text-slate-200">How this works:</strong> For each item, we calculate the Economic Order Quantity (EOQ) at standard price, then model every discount tier.
            We compare total annual cost (purchase + ordering + holding) across tiers to find the optimal order size.
            Break-even = months until extra capital tied up in bulk pays back through savings. ROI = annual savings ÷ extra capital.
          </div>
          {metrics.map(m => <BulkCard key={m.item.id} m={m}/>)}
        </div>
      )}

      {/* ══ ORDER CALENDAR TAB ══════════════════════════════════════════════ */}
      {activeTab === 'calendar' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800/50">
            <div className="text-[13px] font-semibold text-slate-100 mb-1">8-Week Order Horizon</div>
            <div className="text-[11px] text-slate-500">Vertical lines: order trigger date · Faded bar: remaining stock · Red dashes: projected stockout</div>
          </div>
          {/* Week headers */}
          <div className="flex px-4 pt-3 pb-1 border-b border-slate-800/30">
            <div className="w-40 flex-shrink-0"/>
            <div className="flex-1 flex">
              {Array.from({ length: 8 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i * 7);
                return (
                  <div key={i} className="flex-1 text-[9px] text-slate-600 font-semibold uppercase">
                    Wk {i + 1}
                    <div className="text-slate-700 font-normal normal-case">
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="w-24"/>
          </div>
          <div className="px-4 py-2">
            {[...metrics]
              .sort((a, b) => a.daysUntilReorder - b.daysUntilReorder)
              .map(m => <CalendarRow key={m.item.id} m={m} weekWidth={100 / 8}/>)
            }
          </div>
          <div className="px-4 pb-4 pt-2 flex items-center gap-5 text-[10px] text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Stock level</span>
            <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-slate-500 inline-block"/>Order trigger</span>
            <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-red-500/60 inline-block"/>Projected stockout</span>
          </div>
        </div>
      )}

    </div>
  );
}
