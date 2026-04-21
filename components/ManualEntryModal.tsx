'use client';

import { useEffect, useRef, useState } from 'react';
import { UnifiedBusinessData } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UnifiedBusinessData) => void;
}

interface TopCustomerRow {
  name: string;
  revenue: string;
}

interface FormState {
  revenue: string;
  cogs: string;
  opex: string;
  period: string;
  totalCustomers: string;
  newThisPeriod: string;
  churned: string;
  topCustomers: TopCustomerRow[];
  headcount: string;
  recurringPct: number;
}

const DEFAULT_FORM: FormState = {
  revenue: '',
  cogs: '',
  opex: '',
  period: '',
  totalCustomers: '',
  newThisPeriod: '',
  churned: '',
  topCustomers: [{ name: '', revenue: '' }],
  headcount: '',
  recurringPct: 0,
};

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function parseNum(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

export default function ManualEntryModal({ open, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [revenueError, setRevenueError] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  // --- helpers ---
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setCustomer(index: number, field: keyof TopCustomerRow, value: string) {
    setForm((prev) => {
      const updated = prev.topCustomers.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      );
      return { ...prev, topCustomers: updated };
    });
  }

  function addCustomer() {
    if (form.topCustomers.length >= 3) return;
    setForm((prev) => ({
      ...prev,
      topCustomers: [...prev.topCustomers, { name: '', revenue: '' }],
    }));
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleReset() {
    setForm(DEFAULT_FORM);
    setRevenueError(false);
  }

  function handleSubmit() {
    const rev = parseNum(form.revenue);
    if (rev <= 0) {
      setRevenueError(true);
      return;
    }
    setRevenueError(false);

    const cogs = parseNum(form.cogs);
    const opex = parseNum(form.opex);
    const totalCount = parseNum(form.totalCustomers);
    const newThisPeriod = parseNum(form.newThisPeriod);
    const churned = parseNum(form.churned);
    const headcount = parseNum(form.headcount);
    const recurringFraction = clamp(form.recurringPct, 0, 100) / 100;

    const recurringRevenue = rev * recurringFraction;
    const oneTimeRevenue = rev * (1 - recurringFraction);

    const avgRevenuePerCustomer = rev / Math.max(totalCount, 1);

    const retentionBase = Math.max(totalCount - newThisPeriod + churned, 1);
    const retentionRate =
      totalCount > 0 ? clamp((totalCount - churned) / retentionBase, 0, 1) : undefined;

    const topCustomers = form.topCustomers
      .filter((c) => c.name.trim() !== '')
      .map((c, i) => {
        const custRev = parseNum(c.revenue);
        return {
          id: `manual-${i}`,
          name: c.name.trim(),
          revenue: custRev,
          percentOfTotal: rev > 0 ? (custRev / rev) * 100 : 0,
        };
      });

    const byCategory = [
      ...(cogs > 0
        ? [
            {
              category: 'Cost of Goods Sold',
              amount: cogs,
              percentOfRevenue: rev > 0 ? (cogs / rev) * 100 : 0,
            },
          ]
        : []),
      ...(opex > 0
        ? [
            {
              category: 'Operating Expenses',
              amount: opex,
              percentOfRevenue: rev > 0 ? (opex / rev) * 100 : 0,
            },
          ]
        : []),
    ];

    const period = form.period.trim() || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const data: UnifiedBusinessData = {
      revenue: {
        total: rev,
        byPeriod: [{ period, periodType: 'monthly', revenue: rev, cogs: cogs || undefined }],
        recurring: recurringRevenue,
        oneTime: oneTimeRevenue,
        currency: 'USD',
      },
      costs: {
        totalCOGS: cogs,
        totalOpEx: opex,
        byCategory,
      },
      customers: {
        totalCount,
        newThisPeriod,
        churned,
        topCustomers,
        avgRevenuePerCustomer,
        retentionRate,
      },
      operations: {
        headcount: headcount > 0 ? headcount : undefined,
      },
      metadata: {
        sources: ['manual'],
        asOf: new Date().toISOString(),
        coveragePeriod: { start: period, end: period },
        completeness: 0.7,
        warnings: [],
      },
    };

    onSubmit(data);
    onClose();
  }

  // --- shared input classnames ---
  const inputCls =
    'w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/50 rounded-xl px-3 py-2 text-[13px] text-slate-100 focus:outline-none placeholder-slate-500';

  const dollarInputCls =
    'w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/50 rounded-xl pl-6 pr-3 py-2 text-[13px] text-slate-100 focus:outline-none placeholder-slate-500';

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div className="max-w-lg w-full bg-[#0d1117] border border-slate-700/60 rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-100">Enter data manually</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              No CSV needed — fill in what you know
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors ml-4 mt-0.5"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-6">
          {/* ── Section 1: Revenue & Costs ── */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-3">
              Revenue &amp; Costs
            </p>
            <div className="space-y-3">
              {/* Revenue */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Revenue ($) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={form.revenue}
                    onChange={(e) => {
                      setField('revenue', e.target.value);
                      if (parseNum(e.target.value) > 0) setRevenueError(false);
                    }}
                    className={`${dollarInputCls} ${revenueError ? 'border-red-500/70' : ''}`}
                  />
                </div>
                {revenueError && (
                  <p className="text-[11px] text-red-400 mt-1">Revenue must be greater than 0.</p>
                )}
              </div>

              {/* COGS */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Cost of Goods Sold ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={form.cogs}
                    onChange={(e) => setField('cogs', e.target.value)}
                    className={dollarInputCls}
                  />
                </div>
              </div>

              {/* OpEx */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Operating Expenses — excl. COGS ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={form.opex}
                    onChange={(e) => setField('opex', e.target.value)}
                    className={dollarInputCls}
                  />
                </div>
              </div>

              {/* Period */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Period</label>
                <input
                  type="text"
                  placeholder="e.g. November 2024"
                  value={form.period}
                  onChange={(e) => setField('period', e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Customers ── */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-3">
              Customers <span className="normal-case text-[10px] text-slate-600">(optional)</span>
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Total</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.totalCustomers}
                    onChange={(e) => setField('totalCustomers', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">New</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.newThisPeriod}
                    onChange={(e) => setField('newThisPeriod', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Churned</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={form.churned}
                    onChange={(e) => setField('churned', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Top customers */}
              <div>
                <p className="text-[11px] text-slate-500 mb-2">Top customers</p>
                <div className="space-y-2">
                  {form.topCustomers.map((cust, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder={`Customer ${i + 1} name`}
                        value={cust.name}
                        onChange={(e) => setCustomer(i, 'name', e.target.value)}
                        className={inputCls}
                      />
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Revenue"
                          value={cust.revenue}
                          onChange={(e) => setCustomer(i, 'revenue', e.target.value)}
                          className={dollarInputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {form.topCustomers.length < 3 && (
                  <button
                    type="button"
                    onClick={addCustomer}
                    className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    + Add customer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 3: Operations ── */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-3">
              Operations <span className="normal-case text-[10px] text-slate-600">(optional)</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Headcount</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.headcount}
                  onChange={(e) => setField('headcount', e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Recurring revenue % */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-slate-400">Recurring revenue %</label>
                  <div className="relative w-16">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={form.recurringPct}
                      onChange={(e) =>
                        setField('recurringPct', clamp(parseNum(e.target.value), 0, 100))
                      }
                      className="w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/50 rounded-xl px-2 py-1.5 text-[12px] text-slate-100 focus:outline-none text-right pr-5"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                      %
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={form.recurringPct}
                  onChange={(e) => setField('recurringPct', Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-slate-700 accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                  <span>0% one-time</span>
                  <span>100% recurring</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2.5 text-[13px] font-semibold transition-colors"
            >
              Save data
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-[12px] text-slate-500 hover:text-slate-300 transition-colors py-1.5"
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
