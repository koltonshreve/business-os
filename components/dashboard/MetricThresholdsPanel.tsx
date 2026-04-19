import { useState } from 'react';
import type { UnifiedBusinessData } from '../../types';

export interface Threshold {
  id: string;
  metricKey: string;
  label: string;
  operator: '>' | '<';
  value: number;
  enabled: boolean;
}

interface Props {
  data: UnifiedBusinessData;
  thresholds: Threshold[];
  onChange: (thresholds: Threshold[]) => void;
}

type MetricKey = 'grossMargin' | 'ebitdaMargin' | 'revenue' | 'cashBalance' | 'retentionRate' | 'topCustomerPct' | 'revenueGrowth' | 'cogsMargin';

const METRIC_OPTIONS: { key: MetricKey; label: string; unit: string; defaultOp: '<' | '>'; defaultVal: number; hint: string }[] = [
  { key: 'grossMargin',    label: 'Gross Margin',          unit: '%',  defaultOp: '<', defaultVal: 40,  hint: 'Alert if gross margin drops below this %' },
  { key: 'ebitdaMargin',   label: 'EBITDA Margin',         unit: '%',  defaultOp: '<', defaultVal: 10,  hint: 'Alert if EBITDA margin drops below this %' },
  { key: 'revenue',        label: 'Revenue (min)',          unit: '$',  defaultOp: '<', defaultVal: 0,   hint: 'Alert if total revenue falls below this amount' },
  { key: 'retentionRate',  label: 'Customer Retention',    unit: '%',  defaultOp: '<', defaultVal: 85,  hint: 'Alert if retention drops below this %' },
  { key: 'topCustomerPct', label: 'Top Customer Conc.',    unit: '%',  defaultOp: '>', defaultVal: 30,  hint: 'Alert if top customer exceeds this % of revenue' },
  { key: 'cogsMargin',     label: 'COGS % of Revenue',     unit: '%',  defaultOp: '>', defaultVal: 60,  hint: 'Alert if COGS ratio exceeds this %' },
  { key: 'cashBalance',    label: 'Cash Balance (min)',     unit: '$',  defaultOp: '<', defaultVal: 0,   hint: 'Alert if cash balance drops below this amount' },
];

function getMetricValue(key: string, data: UnifiedBusinessData): number | null {
  const rev    = data.revenue.total;
  const cogs   = data.costs.totalCOGS;
  const opex   = data.costs.totalOpEx;
  const gp     = rev - cogs;
  const ebitda = gp - opex;
  switch (key) {
    case 'grossMargin':    return rev > 0 ? (gp / rev) * 100 : null;
    case 'ebitdaMargin':   return rev > 0 ? (ebitda / rev) * 100 : null;
    case 'revenue':        return rev;
    case 'cogsMargin':     return rev > 0 ? (cogs / rev) * 100 : null;
    case 'retentionRate':  return (data.customers.retentionRate ?? null) != null ? (data.customers.retentionRate! * 100) : null;
    case 'topCustomerPct': return data.customers.topCustomers[0]?.percentOfTotal ?? null;
    case 'cashBalance':    return data.cashFlow?.length ? data.cashFlow[data.cashFlow.length - 1].closingBalance : null;
    default: return null;
  }
}

function fmtVal(key: string, v: number) {
  if (['grossMargin','ebitdaMargin','retentionRate','topCustomerPct','cogsMargin'].includes(key)) return `${v.toFixed(1)}%`;
  return v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}k` : `$${v.toFixed(0)}`;
}

export default function MetricThresholdsPanel({ data, thresholds, onChange }: Props) {
  const [adding, setAdding]  = useState(false);
  const [newKey, setNewKey]  = useState<MetricKey>('grossMargin');
  const [newOp,  setNewOp]   = useState<'>' | '<'>('<');
  const [newVal, setNewVal]  = useState('');

  const addThreshold = () => {
    const num = parseFloat(newVal);
    if (isNaN(num)) return;
    const meta = METRIC_OPTIONS.find(m => m.key === newKey);
    if (!meta) return;
    onChange([...thresholds, {
      id: `${newKey}-${Date.now()}`,
      metricKey: newKey,
      label: meta.label,
      operator: newOp,
      value: num,
      enabled: true,
    }]);
    setAdding(false);
    setNewVal('');
  };

  const remove  = (id: string) => onChange(thresholds.filter(t => t.id !== id));
  const toggle  = (id: string) => onChange(thresholds.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));

  // Evaluate thresholds
  const evaluated = thresholds.map(t => {
    const cur = getMetricValue(t.metricKey, data);
    const triggered = cur !== null && t.enabled && (
      t.operator === '<' ? cur < t.value : cur > t.value
    );
    const missing = cur === null;
    const delta   = cur !== null ? Math.abs(cur - t.value) : null;
    return { ...t, cur, triggered, missing, delta };
  });

  const triggered = evaluated.filter(t => t.triggered);
  const passing   = evaluated.filter(t => !t.triggered && !t.missing && t.enabled);
  const disabled  = evaluated.filter(t => !t.enabled || t.missing);

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800/50 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">Custom Alert Thresholds</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Define limits — get flagged when your business crosses them</div>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
            adding ? 'text-slate-400 border-slate-700 bg-slate-800/60' : 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/15'
          }`}
        >
          {adding ? '✕ Cancel' : '+ Add threshold'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="px-5 py-4 border-b border-slate-800/50 bg-slate-800/20">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-[0.08em] mb-1.5">Metric</div>
              <select
                value={newKey}
                onChange={e => {
                  const k = e.target.value as MetricKey;
                  setNewKey(k);
                  const meta = METRIC_OPTIONS.find(m => m.key === k);
                  if (meta) { setNewOp(meta.defaultOp); setNewVal(String(meta.defaultVal)); }
                }}
                className="bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"
              >
                {METRIC_OPTIONS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-[0.08em] mb-1.5">Condition</div>
              <select
                value={newOp}
                onChange={e => setNewOp(e.target.value as '>' | '<')}
                className="bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60"
              >
                <option value="<">Below (&lt;)</option>
                <option value=">">Above (&gt;)</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-[0.08em] mb-1.5">
                Value ({METRIC_OPTIONS.find(m => m.key === newKey)?.unit ?? ''})
              </div>
              <input
                type="number"
                value={newVal}
                onChange={e => setNewVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addThreshold()}
                placeholder={String(METRIC_OPTIONS.find(m => m.key === newKey)?.defaultVal ?? '')}
                className="w-28 bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-100 focus:outline-none focus:border-indigo-500/60"
              />
            </div>
            <button
              onClick={addThreshold}
              disabled={!newVal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-[12px] font-semibold transition-colors"
            >
              Add
            </button>
          </div>
          <div className="text-[10px] text-slate-600 mt-2">
            {METRIC_OPTIONS.find(m => m.key === newKey)?.hint}
          </div>
        </div>
      )}

      {/* No thresholds */}
      {thresholds.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center py-8 text-center px-5 gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-1">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-4 h-4 text-slate-600">
              <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 9a1 1 0 110-2 1 1 0 010 2zm0-3V4"/>
            </svg>
          </div>
          <div className="text-[12px] font-semibold text-slate-500">No thresholds defined</div>
          <div className="text-[11px] text-slate-700 max-w-[200px] leading-relaxed">
            Add thresholds and get instant alerts when your metrics cross them
          </div>
        </div>
      )}

      {/* Triggered alerts */}
      {triggered.length > 0 && (
        <div className="divide-y divide-slate-800/30">
          {triggered.map(t => (
            <div key={t.id} className="px-5 py-3 flex items-center gap-3 bg-red-500/3">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse"/>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-red-300">
                  {t.label} {t.operator === '<' ? 'below' : 'above'} {fmtVal(t.metricKey, t.value)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Current: <span className="text-red-400 font-medium">{t.cur !== null ? fmtVal(t.metricKey, t.cur) : '—'}</span>
                  {t.delta !== null && <span className="text-slate-600 ml-1">({t.operator === '<' ? '-' : '+'}{fmtVal(t.metricKey, t.delta)} from threshold)</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-red-500/10 border-red-500/25 text-red-400">ALERT</span>
                <button onClick={() => remove(t.id)} className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Passing */}
      {passing.length > 0 && (
        <div className="divide-y divide-slate-800/20">
          {passing.map(t => (
            <div key={t.id} className="px-5 py-2.5 flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 flex-shrink-0"/>
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-[12px] text-slate-400">{t.label}</span>
                <span className="text-[11px] text-slate-600">{t.operator === '<' ? '≥' : '≤'} {fmtVal(t.metricKey, t.value)}</span>
                <span className="text-[11px] text-emerald-400/80 font-medium">{t.cur !== null ? fmtVal(t.metricKey, t.cur) : '—'}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-emerald-500/8 border-emerald-500/20 text-emerald-400/80">OK</span>
                <button onClick={() => toggle(t.id)} className="text-slate-600 hover:text-slate-400 transition-colors text-[10px] font-medium border border-slate-800 px-1.5 py-0.5 rounded">Pause</button>
                <button onClick={() => remove(t.id)} className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none">×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disabled/missing data */}
      {disabled.length > 0 && (
        <div className="px-5 py-2.5 border-t border-slate-800/40">
          <div className="flex flex-wrap gap-2">
            {disabled.map(t => (
              <div key={t.id} className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-800/40 border border-slate-800/60 rounded-lg px-2.5 py-1">
                <span>{t.label} {t.operator} {fmtVal(t.metricKey, t.value)}</span>
                {t.missing && <span className="text-slate-700">(no data)</span>}
                {!t.enabled && (
                  <button onClick={() => toggle(t.id)} className="text-slate-600 hover:text-slate-300 transition-colors font-medium ml-0.5">Enable</button>
                )}
                <button onClick={() => remove(t.id)} className="text-slate-700 hover:text-red-400 transition-colors leading-none ml-0.5">×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
