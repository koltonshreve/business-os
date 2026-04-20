import { useState } from 'react';
import { PLANS, canAccess as canAccessFn } from '../../lib/plan';
import type { GatedFeature } from '../../lib/plan';
import type { PlanId } from '../../types';

// ── Feature comparison table ──────────────────────────────────────────────────

const FEATURE_ROWS: { label: string; starter: string | boolean; growth: string | boolean; pro: string | boolean }[] = [
  { label: 'Financial dashboard',      starter: true,     growth: true,          pro: true },
  { label: 'Customer tracking',        starter: true,     growth: true,          pro: true },
  { label: 'AI queries / month',       starter: '5',      growth: '50',          pro: 'Unlimited' },
  { label: 'Data snapshots',           starter: '1',      growth: 'Unlimited',   pro: 'Unlimited' },
  { label: 'Data connectors',          starter: 'CSV',    growth: 'CSV + Sheets + Stripe', pro: 'All + API' },
  { label: 'Deal pipeline (CRM)',       starter: false,    growth: true,          pro: true },
  { label: 'Weekly AI report',         starter: false,    growth: true,          pro: true },
  { label: 'Scenario modeling',        starter: false,    growth: true,          pro: true },
  { label: 'Automations',              starter: false,    growth: '5',           pro: 'Unlimited' },
  { label: 'Team members',             starter: '1',      growth: '5',           pro: 'Unlimited' },
  { label: 'Board deck generator',     starter: false,    growth: false,         pro: true },
  { label: 'Multi-entity support',     starter: false,    growth: false,         pro: true },
  { label: 'Custom KPI formulas',      starter: false,    growth: false,         pro: true },
  { label: 'API access',               starter: false,    growth: false,         pro: true },
  { label: 'Priority support',         starter: false,    growth: false,         pro: true },
];

// ── Import type re-export so callers get it ────────────────────────────────────

export type { GatedFeature };

// ── Gate wrapper ─────────────────────────────────────────────────────────────

interface GateProps {
  feature: GatedFeature;
  currentPlan: PlanId;
  onUpgrade: (feature: GatedFeature) => void;
  children: React.ReactNode;
}

export function FeatureGate({ feature, currentPlan, onUpgrade, children }: GateProps) {
  if (canAccessFn(feature, currentPlan)) return <>{children}</>;

  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <button
          onClick={() => onUpgrade(feature)}
          className="flex items-center gap-2 bg-[#0d1117]/90 border border-indigo-500/40 backdrop-blur-sm rounded-xl px-4 py-2.5 text-[12px] font-semibold text-indigo-300 hover:text-white hover:bg-indigo-600/80 transition-all shadow-xl"
        >
          <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
            <path d="M7 1l1.5 3.5L12 5l-2.5 2.5.5 3.5L7 9.5 4 11l.5-3.5L2 5l3.5-.5L7 1z"/>
          </svg>
          Upgrade to unlock
        </button>
      </div>
    </div>
  );
}

// ── Pricing Modal ─────────────────────────────────────────────────────────────

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan: PlanId;
  highlightFeature?: GatedFeature;
  onSelectPlan: (plan: PlanId) => void;
}

const CHECK = (
  <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CROSS = (
  <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-slate-700">
    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

function CellValue({ val }: { val: string | boolean }) {
  if (val === true)  return CHECK;
  if (val === false) return CROSS;
  return <span className="text-[11px] font-medium text-slate-300">{val}</span>;
}

export default function PricingModal({ open, onClose, currentPlan, highlightFeature, onSelectPlan }: PricingModalProps) {
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const plans: PlanId[] = ['starter', 'growth', 'pro'];

  async function handleUpgrade(planId: PlanId) {
    if (planId === 'starter') { onSelectPlan(planId); return; }
    setLoading(planId); setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, appUrl: window.location.origin }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Checkout failed — please try again');
        setLoading(null);
      }
    } catch {
      setError('Network error — please try again');
      setLoading(null);
    }
  }
  const planColors: Record<PlanId, { accent: string; ring: string; btn: string; badge: string }> = {
    starter: {
      accent: 'text-slate-300',
      ring:   'border-slate-700/60',
      btn:    'bg-slate-700 hover:bg-slate-600 text-white',
      badge:  '',
    },
    growth: {
      accent: 'text-indigo-300',
      ring:   'border-indigo-500/40',
      btn:    'bg-indigo-600 hover:bg-indigo-500 text-white',
      badge:  'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
    },
    pro: {
      accent: 'text-violet-300',
      ring:   'border-violet-500/30',
      btn:    'bg-violet-700 hover:bg-violet-600 text-white',
      badge:  '',
    },
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md"/>
      <div
        className="relative bg-[#0a0f1a] border border-slate-700/50 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-7 pb-5 text-center border-b border-slate-800/50">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-600 hover:text-slate-300 text-xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800/60">×</button>
          <div className="text-[22px] font-bold text-slate-100 mb-1.5">Simple, transparent pricing</div>
          <div className="text-[13px] text-slate-400">Start free. Upgrade when you need more power.</div>
          {highlightFeature && (
            <div className="mt-3 inline-flex items-center gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3.5 py-2 text-[12px] text-amber-300">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-amber-400">
                <path d="M7 1l1.5 3.5L12 5l-2.5 2.5.5 3.5L7 9.5 4 11l.5-3.5L2 5l3.5-.5L7 1z"/>
              </svg>
              Upgrade to unlock this feature
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
          {plans.map(planId => {
            const plan   = PLANS[planId];
            const colors = planColors[planId];
            const isCurrent = planId === currentPlan;
            return (
              <div
                key={planId}
                className={`relative flex flex-col bg-slate-900/60 border rounded-2xl p-5 transition-all ${colors.ring} ${planId === 'growth' ? 'ring-1 ring-indigo-500/20' : ''}`}
              >
                {plan.badge && (
                  <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full border ${colors.badge}`}>
                    {plan.badge}
                  </div>
                )}

                <div className="mb-4">
                  <div className={`text-[15px] font-bold mb-1 ${colors.accent}`}>{plan.name}</div>
                  <div className="flex items-end gap-1 mb-1.5">
                    <span className="text-[28px] font-bold text-slate-100 leading-none">${plan.price}</span>
                    {plan.price > 0 && <span className="text-[12px] text-slate-500 mb-0.5">/mo</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-snug">{plan.description}</div>
                </div>

                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-400">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-[11px] text-slate-400 leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(planId)}
                  disabled={isCurrent || loading !== null}
                  className={`w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-slate-800/60 text-slate-500 cursor-default border border-slate-700/40'
                      : loading === planId
                      ? 'opacity-70 cursor-wait ' + colors.btn
                      : colors.btn
                  }`}
                >
                  {loading === planId ? (
                    <>
                      <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin">
                        <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
                        <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
                      </svg>
                      Redirecting to Stripe…
                    </>
                  ) : isCurrent ? 'Current plan' : planId === 'starter' ? 'Downgrade' : 'Upgrade →'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 px-4 py-3 bg-red-500/8 border border-red-500/25 rounded-xl text-[12px] text-red-400">
            {error}
          </div>
        )}

        {/* Feature table */}
        <div className="px-6 pb-6">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">Full feature comparison</div>
          <div className="border border-slate-800/50 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 bg-slate-900/50 border-b border-slate-800/50">
              <div className="px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Feature</div>
              {plans.map(p => (
                <div key={p} className={`px-4 py-2.5 text-[11px] font-bold text-center ${planColors[p].accent}`}>
                  {PLANS[p].name}
                </div>
              ))}
            </div>
            {/* Rows */}
            {FEATURE_ROWS.map((row, i) => (
              <div key={i} className={`grid grid-cols-4 border-b border-slate-800/30 last:border-0 ${i % 2 === 0 ? 'bg-transparent' : 'bg-slate-900/20'}`}>
                <div className="px-4 py-2.5 text-[11px] text-slate-400">{row.label}</div>
                <div className="px-4 py-2.5 flex items-center justify-center"><CellValue val={row.starter}/></div>
                <div className="px-4 py-2.5 flex items-center justify-center"><CellValue val={row.growth}/></div>
                <div className="px-4 py-2.5 flex items-center justify-center"><CellValue val={row.pro}/></div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center text-[11px] text-slate-600">
            All plans include 14-day free trial · No credit card required · Cancel anytime
          </div>
        </div>
      </div>
    </div>
  );
}
