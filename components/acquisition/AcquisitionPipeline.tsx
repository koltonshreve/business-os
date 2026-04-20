import { useState, useRef, useCallback } from 'react';
import { addMemoryEntry } from '../../lib/memory';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AcqStage =
  | 'sourcing'
  | 'screening'
  | 'loi'
  | 'due-diligence'
  | 'closing'
  | 'closed-won'
  | 'closed-lost'
  | 'integration';

export interface AcquisitionTarget {
  id: string;
  name: string;
  industry: string;
  geography: string;
  revenue: number;
  ebitda: number;
  askingPrice: number;
  multiple: number;          // askingPrice / ebitda
  stage: AcqStage;
  source: 'broker' | 'direct' | 'outbound' | 'referral' | 'proprietary';
  ownerName: string;
  ownerEmail?: string;
  dealOwner: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string;
  nextAction?: string;
  nextActionDate?: string;
  notes?: string;
  score?: number;            // 1-10 attractiveness
  tags?: string[];
  thesisMatch?: 'strong' | 'moderate' | 'weak';
  lostReason?: string;
  closedAt?: string;
  finalPrice?: number;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES: { id: AcqStage; label: string; color: string; bg: string; border: string; dot: string; short: string }[] = [
  { id: 'sourcing',      label: 'Sourcing',       short: 'Source',  color: 'text-slate-400',   bg: 'bg-slate-800/40',    border: 'border-slate-700/60', dot: 'bg-slate-500' },
  { id: 'screening',     label: 'Screening',      short: 'Screen',  color: 'text-sky-400',     bg: 'bg-sky-500/8',      border: 'border-sky-500/20',   dot: 'bg-sky-400' },
  { id: 'loi',           label: 'LOI',            short: 'LOI',     color: 'text-indigo-400',  bg: 'bg-indigo-500/8',   border: 'border-indigo-500/20', dot: 'bg-indigo-400' },
  { id: 'due-diligence', label: 'Due Diligence',  short: 'DD',      color: 'text-violet-400',  bg: 'bg-violet-500/8',   border: 'border-violet-500/20', dot: 'bg-violet-400' },
  { id: 'closing',       label: 'Closing',        short: 'Close',   color: 'text-amber-400',   bg: 'bg-amber-500/8',    border: 'border-amber-500/20',  dot: 'bg-amber-400' },
  { id: 'integration',   label: 'Integration',    short: 'Integ.',  color: 'text-emerald-400', bg: 'bg-emerald-500/8',  border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  { id: 'closed-won',    label: 'Closed Won',     short: 'Won',     color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-300' },
  { id: 'closed-lost',   label: 'Passed',         short: 'Passed',  color: 'text-slate-600',   bg: 'bg-slate-900/30',   border: 'border-slate-800/40',  dot: 'bg-slate-700' },
];

const ACTIVE_STAGES: AcqStage[] = ['sourcing', 'screening', 'loi', 'due-diligence', 'closing', 'integration'];

const SOURCE_LABELS: Record<AcquisitionTarget['source'], string> = {
  broker: 'Broker', direct: 'Direct', outbound: 'Outbound', referral: 'Referral', proprietary: 'Proprietary'
};

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED: AcquisitionTarget[] = [
  {
    id: 'acq-1', name: 'Midwest HVAC Services', industry: 'HVAC / Trades', geography: 'Columbus, OH',
    revenue: 3800000, ebitda: 760000, askingPrice: 3800000, multiple: 5.0,
    stage: 'due-diligence', source: 'broker', ownerName: 'Rick Daniels', ownerEmail: 'rick@midwesthvac.com',
    dealOwner: 'You', createdAt: '2025-01-15T10:00:00Z', updatedAt: '2025-03-10T14:00:00Z',
    lastContactAt: '2025-03-08T10:00:00Z',
    nextAction: 'Review QoE report from accountant', nextActionDate: '2025-03-15',
    score: 8, thesisMatch: 'strong',
    notes: 'Owner retiring, motivated seller. 18-year-old business, recurring maintenance contracts.',
    tags: ['recurring', 'motivated-seller', 'trades'],
  },
  {
    id: 'acq-2', name: 'Peak Performance Staffing', industry: 'Staffing', geography: 'Denver, CO',
    revenue: 5200000, ebitda: 520000, askingPrice: 2600000, multiple: 5.0,
    stage: 'screening', source: 'broker', ownerName: 'Sandra Wu', dealOwner: 'You',
    createdAt: '2025-02-01T10:00:00Z', updatedAt: '2025-03-05T09:00:00Z',
    lastContactAt: '2025-03-01T10:00:00Z',
    nextAction: 'Request 3 years P&L and client concentration data', nextActionDate: '2025-03-12',
    score: 6, thesisMatch: 'moderate',
    tags: ['staffing', 'needs-financials'],
  },
  {
    id: 'acq-3', name: 'Precision Industrial Cleaning', industry: 'Facility Services', geography: 'Houston, TX',
    revenue: 2100000, ebitda: 504000, askingPrice: 2268000, multiple: 4.5,
    stage: 'loi', source: 'direct', ownerName: 'Marcus Johnson', dealOwner: 'You',
    createdAt: '2025-01-28T10:00:00Z', updatedAt: '2025-03-11T16:00:00Z',
    lastContactAt: '2025-03-11T10:00:00Z',
    nextAction: 'Send revised LOI — adjust to 4.3x after reviewing margins', nextActionDate: '2025-03-14',
    score: 9, thesisMatch: 'strong',
    notes: 'Industrial clients, 5-year contracts. Owner wants to stay on for 2 years. Excellent fit.',
    tags: ['industrial', 'sticky-clients', 'owner-stay'],
  },
  {
    id: 'acq-4', name: 'Blue Ridge IT Solutions', industry: 'Managed IT Services', geography: 'Charlotte, NC',
    revenue: 1800000, ebitda: 360000, askingPrice: 1980000, multiple: 5.5,
    stage: 'sourcing', source: 'outbound', ownerName: 'Tom Hendricks', dealOwner: 'You',
    createdAt: '2025-03-05T10:00:00Z', updatedAt: '2025-03-09T10:00:00Z',
    nextAction: 'Send initial outreach email + NDA', nextActionDate: '2025-03-13',
    score: 7, thesisMatch: 'moderate',
    tags: ['msp', 'recurring-mrr'],
  },
  {
    id: 'acq-5', name: 'Premier Landscape Group', industry: 'Landscaping', geography: 'Nashville, TN',
    revenue: 4500000, ebitda: 900000, askingPrice: 3150000, multiple: 3.5,
    stage: 'closing', source: 'referral', ownerName: 'Gary Patterson', dealOwner: 'You',
    createdAt: '2024-11-20T10:00:00Z', updatedAt: '2025-03-10T11:00:00Z',
    lastContactAt: '2025-03-10T10:00:00Z',
    nextAction: 'Sign purchase agreement + wire 10% deposit', nextActionDate: '2025-03-13',
    score: 10, thesisMatch: 'strong',
    notes: 'Commercial + HOA contracts. Deal agreed at 3.5x. Closing ETA March 28.',
    tags: ['commercial', 'hoa', 'closing-soon'],
    finalPrice: 3150000,
  },
  {
    id: 'acq-6', name: 'Clearwater Plumbing Co.', industry: 'Plumbing / Trades', geography: 'Phoenix, AZ',
    revenue: 2900000, ebitda: 232000, askingPrice: 1160000, multiple: 5.0,
    stage: 'closed-lost', source: 'broker', ownerName: 'Dave McCoy', dealOwner: 'You',
    createdAt: '2024-10-01T10:00:00Z', updatedAt: '2025-02-15T09:00:00Z',
    score: 4, thesisMatch: 'weak', lostReason: 'Margins too thin — EBITDA 8% below thesis minimum',
    tags: ['passed'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function daysAgo(iso?: string) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function isOverdue(dateStr?: string) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ─── Target Card ─────────────────────────────────────────────────────────────

function TargetCard({ target, onOpen, onDragStart }: {
  target: AcquisitionTarget;
  onOpen: (t: AcquisitionTarget) => void;
  onDragStart: (id: string) => void;
}) {
  const stage = STAGES.find(s => s.id === target.stage)!;
  const da = daysAgo(target.lastContactAt);
  const overdue = isOverdue(target.nextActionDate);
  const matchColor = target.thesisMatch === 'strong' ? 'text-emerald-400' : target.thesisMatch === 'moderate' ? 'text-amber-400' : 'text-red-400';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(target.id)}
      onClick={() => onOpen(target)}
      className="bg-[#0d1117] border border-slate-800/60 hover:border-slate-700/80 rounded-xl p-3.5 cursor-pointer transition-all hover:shadow-lg hover:shadow-black/30 group select-none"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="font-semibold text-[12px] text-slate-100 leading-tight">{target.name}</div>
        {target.score && (
          <div className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            target.score >= 8 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
            target.score >= 6 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
            'text-slate-500 bg-slate-800/50 border-slate-700/40'
          }`}>{target.score}/10</div>
        )}
      </div>

      <div className="text-[10px] text-slate-500 mb-2.5">{target.industry} · {target.geography}</div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-1 mb-2.5">
        {[
          { label: 'EBITDA', val: fmt(target.ebitda) },
          { label: 'Ask',    val: fmt(target.askingPrice) },
          { label: 'Multiple', val: `${target.multiple.toFixed(1)}x` },
        ].map(m => (
          <div key={m.label} className="bg-slate-900/60 rounded-lg px-2 py-1.5 text-center">
            <div className="text-[9px] text-slate-600 uppercase tracking-wide">{m.label}</div>
            <div className="text-[11px] font-bold text-slate-200 tabular-nums">{m.val}</div>
          </div>
        ))}
      </div>

      {/* Next action */}
      {target.nextAction && (
        <div className={`flex items-start gap-1.5 text-[10px] mb-2 ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
          <span className="flex-shrink-0 mt-0.5">{overdue ? '⚠' : '→'}</span>
          <span className="leading-snug line-clamp-2">{target.nextAction}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/40">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${matchColor}`}>
            {target.thesisMatch ?? 'unscored'}
          </span>
          <span className="text-[9px] text-slate-700">·</span>
          <span className="text-[9px] text-slate-600">{SOURCE_LABELS[target.source]}</span>
        </div>
        {da !== null && (
          <span className={`text-[9px] font-medium ${da > 7 ? 'text-red-500/70' : da > 3 ? 'text-amber-500/70' : 'text-slate-600'}`}>
            {da === 0 ? 'today' : `${da}d ago`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Valuation Analysis ───────────────────────────────────────────────────────

function ValuationAnalysis({ target }: { target: AcquisitionTarget }) {
  const ebitdaMargin  = target.revenue > 0 ? (target.ebitda / target.revenue) * 100 : 0;
  const revenueMultiple = target.revenue > 0 ? target.askingPrice / target.revenue : 0;
  const ebitdaMultiple  = target.multiple; // already askingPrice / ebitda

  // LMM benchmarks
  const multipleRating = ebitdaMultiple <= 4 ? 'attractive' : ebitdaMultiple <= 5.5 ? 'fair' : ebitdaMultiple <= 7 ? 'premium' : 'expensive';
  const marginRating   = ebitdaMargin >= 20 ? 'strong' : ebitdaMargin >= 15 ? 'acceptable' : ebitdaMargin >= 10 ? 'thin' : 'poor';

  // Verdict
  let verdict: 'BUY' | 'WATCH' | 'PASS';
  let verdictReason: string;
  if (ebitdaMultiple <= 5 && ebitdaMargin >= 18 && target.thesisMatch !== 'weak') {
    verdict = 'BUY';
    verdictReason = `${ebitdaMultiple.toFixed(1)}x multiple with ${ebitdaMargin.toFixed(1)}% EBITDA margin — compelling entry point`;
  } else if (ebitdaMultiple <= 6.5 && ebitdaMargin >= 12) {
    verdict = 'WATCH';
    verdictReason = multipleRating === 'premium' ? `Multiple above median — negotiate to ${(ebitdaMultiple * 0.9).toFixed(1)}x before advancing` : `Margins need improvement to clear 18% threshold`;
  } else {
    verdict = 'PASS';
    verdictReason = ebitdaMargin < 10 ? `${ebitdaMargin.toFixed(1)}% EBITDA margin below 10% minimum threshold` : `${ebitdaMultiple.toFixed(1)}x ask price is above LMM ceiling for this margin profile`;
  }

  const verdictStyle = verdict === 'BUY'
    ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
    : verdict === 'WATCH'
    ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
    : 'text-red-300 bg-red-500/10 border-red-500/25';

  const bar = (label: string, val: string, rating: string, benchmarkNote: string) => {
    const color = rating === 'attractive' || rating === 'strong'
      ? 'text-emerald-400' : rating === 'fair' || rating === 'acceptable'
      ? 'text-sky-400' : rating === 'thin' || rating === 'premium'
      ? 'text-amber-400' : 'text-red-400';
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-slate-800/40 last:border-0">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-700">{benchmarkNote}</span>
          <span className={`text-[12px] font-bold tabular-nums ${color}`}>{val}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Valuation Analysis</div>

      {/* Verdict */}
      <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${verdictStyle} mb-3`}>
        <div className="text-[11px] text-slate-400 leading-snug flex-1 pr-3">{verdictReason}</div>
        <span className={`flex-shrink-0 text-[13px] font-black tracking-wide ${verdictStyle.split(' ')[0]}`}>{verdict}</span>
      </div>

      {/* Metrics */}
      <div className="bg-slate-900/40 rounded-xl px-3.5 py-1">
        {bar('EBITDA Multiple', `${ebitdaMultiple.toFixed(2)}x`, multipleRating, 'LMM median 4–5x')}
        {bar('Revenue Multiple', revenueMultiple > 0 ? `${revenueMultiple.toFixed(2)}x` : '—', revenueMultiple <= 1.5 ? 'attractive' : revenueMultiple <= 2.5 ? 'fair' : 'premium', 'median 0.5–1.5x')}
        {bar('EBITDA Margin', `${ebitdaMargin.toFixed(1)}%`, marginRating, 'strong >20%')}
      </div>
    </div>
  );
}

// ─── Target Drawer ────────────────────────────────────────────────────────────

function TargetDrawer({ target, onClose, onUpdate }: {
  target: AcquisitionTarget;
  onClose: () => void;
  onUpdate: (t: AcquisitionTarget) => void;
}) {
  const [draft, setDraft] = useState(target);
  const [editing, setEditing] = useState(false);
  const stage = STAGES.find(s => s.id === draft.stage)!;

  const save = () => { onUpdate(draft); setEditing(false); };
  const field = (label: string, val: string, key: keyof AcquisitionTarget, type = 'text') => (
    <div>
      <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{label}</div>
      {editing ? (
        <input type={type} value={String(val)}
          onChange={e => setDraft(d => ({ ...d, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
          className="w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/60 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-200 focus:outline-none"/>
      ) : (
        <div className="text-[13px] text-slate-200">{val || '—'}</div>
      )}
    </div>
  );

  const prevStageIdx = STAGES.findIndex(s => s.id === draft.stage);
  const canAdvance = prevStageIdx < STAGES.length - 3; // not won/lost/integration
  const nextStage  = STAGES[prevStageIdx + 1];

  return (
    <div className="fixed inset-0 z-[200] flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-[#0d1117] border-l border-slate-800/60 overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-800/50 ${stage.bg}`}>
          <div>
            <div className="text-[16px] font-bold text-slate-100 mb-0.5">{draft.name}</div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${stage.border} ${stage.color}`}>{stage.label}</span>
              <span className="text-[11px] text-slate-500">{draft.industry} · {draft.geography}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={save} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg transition-colors">Save</button>
                <button onClick={() => { setDraft(target); setEditing(false); }} className="px-3 py-1.5 border border-slate-700 text-slate-400 hover:text-slate-200 text-[11px] rounded-lg transition-colors">Cancel</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 border border-slate-700 hover:border-slate-600 text-slate-400 hover:text-slate-200 text-[11px] rounded-lg transition-colors">Edit</button>
            )}
            <button onClick={onClose} className="text-slate-600 hover:text-slate-300 text-xl w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800/60 transition-colors">×</button>
          </div>
        </div>

        {/* Key metrics strip */}
        <div className="grid grid-cols-4 border-b border-slate-800/50">
          {[
            { label: 'Revenue',  val: fmt(draft.revenue) },
            { label: 'EBITDA',   val: fmt(draft.ebitda) },
            { label: 'Ask Price',val: fmt(draft.askingPrice) },
            { label: 'Multiple', val: `${draft.multiple.toFixed(1)}x` },
          ].map(m => (
            <div key={m.label} className="px-4 py-3 border-r border-slate-800/50 last:border-r-0">
              <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider">{m.label}</div>
              <div className="text-[16px] font-bold text-slate-100 tabular-nums mt-0.5">{m.val}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 flex-1">

          {/* Advance stage */}
          {!editing && canAdvance && nextStage && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="text-[12px] text-slate-300">Ready to advance to <span className={`font-semibold ${nextStage.color}`}>{nextStage.label}</span>?</div>
              <button
                onClick={() => {
                  const updated = { ...draft, stage: nextStage.id, updatedAt: new Date().toISOString() };
                  setDraft(updated);
                  onUpdate(updated);
                  addMemoryEntry('deal-action', `Advanced "${draft.name}" to ${nextStage.label}`, { entityId: draft.id, entityType: 'deal' });
                }}
                className="flex-shrink-0 ml-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg transition-colors"
              >
                Advance →
              </button>
            </div>
          )}

          {/* Valuation */}
          {draft.askingPrice > 0 && draft.ebitda > 0 && (
            <ValuationAnalysis target={draft} />
          )}

          {/* Next action */}
          <div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Next Action</div>
            {editing ? (
              <div className="space-y-2">
                <input value={draft.nextAction ?? ''} onChange={e => setDraft(d => ({ ...d, nextAction: e.target.value }))}
                  placeholder="What's the next step?"
                  className="w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none"/>
                <input type="date" value={draft.nextActionDate ?? ''}
                  onChange={e => setDraft(d => ({ ...d, nextActionDate: e.target.value }))}
                  className="bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/60 rounded-lg px-3 py-2 text-[12px] text-slate-200 focus:outline-none"/>
              </div>
            ) : (
              <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${
                isOverdue(draft.nextActionDate) ? 'border-red-500/20 bg-red-500/5 text-red-300' : 'border-slate-700/40 text-slate-300'
              }`}>
                <span className="flex-shrink-0 mt-0.5">{isOverdue(draft.nextActionDate) ? '⚠' : '→'}</span>
                <div>
                  <div className="text-[12px] font-medium">{draft.nextAction ?? 'No next action set'}</div>
                  {draft.nextActionDate && (
                    <div className={`text-[10px] mt-0.5 ${isOverdue(draft.nextActionDate) ? 'text-red-400' : 'text-slate-600'}`}>
                      Due {fmtDate(draft.nextActionDate)}{isOverdue(draft.nextActionDate) ? ' — OVERDUE' : ''}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            {field('Owner Name', draft.ownerName, 'ownerName')}
            {field('Owner Email', draft.ownerEmail ?? '', 'ownerEmail')}
            {field('Deal Owner', draft.dealOwner, 'dealOwner')}
            {field('Source', SOURCE_LABELS[draft.source], 'source')}
          </div>

          {/* Thesis match */}
          <div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Thesis Match</div>
            {editing ? (
              <div className="flex gap-2">
                {(['strong', 'moderate', 'weak'] as const).map(m => (
                  <button key={m} onClick={() => setDraft(d => ({ ...d, thesisMatch: m }))}
                    className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold capitalize transition-all ${
                      draft.thesisMatch === m
                        ? m === 'strong' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : m === 'moderate' ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                          : 'border-red-500/50 bg-red-500/10 text-red-300'
                        : 'border-slate-700/50 text-slate-500 hover:border-slate-600'
                    }`}>{m}</button>
                ))}
              </div>
            ) : (
              <span className={`text-[12px] font-semibold capitalize ${
                draft.thesisMatch === 'strong' ? 'text-emerald-400' :
                draft.thesisMatch === 'moderate' ? 'text-amber-400' : 'text-red-400'
              }`}>{draft.thesisMatch ?? '—'}</span>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Notes</div>
            {editing ? (
              <textarea value={draft.notes ?? ''} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={4} placeholder="Deal notes, key observations..."
                className="w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-[12px] text-slate-200 focus:outline-none resize-none"/>
            ) : (
              <div className="text-[12px] text-slate-400 leading-relaxed whitespace-pre-wrap">{draft.notes || <span className="text-slate-700 italic">No notes</span>}</div>
            )}
          </div>

          {/* Tags */}
          {(draft.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(draft.tags ?? []).map(tag => (
                <span key={tag} className="text-[10px] font-medium text-slate-500 bg-slate-800/60 border border-slate-700/40 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Timeline */}
          <div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Timeline</div>
            <div className="space-y-1.5 text-[11px] text-slate-600">
              {draft.closedAt && <div>Closed: {fmtDate(draft.closedAt)}</div>}
              <div>Updated: {fmtDate(draft.updatedAt)}</div>
              <div>Created: {fmtDate(draft.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Target Modal ─────────────────────────────────────────────────────────

function AddTargetModal({ onSave, onCancel }: { onSave: (t: AcquisitionTarget) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [geography, setGeography] = useState('');
  const [revenue, setRevenue] = useState('');
  const [ebitda, setEbitda] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [source, setSource] = useState<AcquisitionTarget['source']>('broker');
  const [notes, setNotes] = useState('');

  const rev = parseFloat(revenue) || 0;
  const ebd = parseFloat(ebitda) || 0;
  const ask = parseFloat(askingPrice) || 0;
  const multiple = ebd > 0 ? ask / ebd : 0;

  const canSave = name.trim().length > 0 && ebd > 0;
  const inputCls = "w-full bg-slate-800/60 border border-slate-700/60 focus:border-indigo-500/50 rounded-xl px-3.5 py-2.5 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none";
  const labelCls = "block text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em] mb-1.5";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
      <div className="relative bg-[#0d1117] border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/50">
          <div className="text-[14px] font-bold text-slate-100">Add Acquisition Target</div>
          <button onClick={onCancel} className="text-slate-600 hover:text-slate-300 text-xl w-7 h-7 flex items-center justify-center">×</button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Company Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Acme HVAC Services" autoFocus className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Industry</label>
              <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="HVAC / Trades" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Geography</label>
              <input value={geography} onChange={e => setGeography(e.target.value)} placeholder="Columbus, OH" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Revenue ($)</label>
              <input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="2500000" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>EBITDA ($) *</label>
              <input type="number" value={ebitda} onChange={e => setEbitda(e.target.value)} placeholder="500000" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Asking Price ($)</label>
              <input type="number" value={askingPrice} onChange={e => setAskingPrice(e.target.value)} placeholder="2500000" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Implied Multiple</label>
              <div className={`${inputCls} text-indigo-300 font-bold`}>
                {multiple > 0 ? `${multiple.toFixed(1)}x` : '—'}
              </div>
            </div>
            <div>
              <label className={labelCls}>Owner Name</label>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="John Smith" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <select value={source} onChange={e => setSource(e.target.value as AcquisitionTarget['source'])}
                className={inputCls + ' cursor-pointer'}>
                <option value="broker">Broker</option>
                <option value="direct">Direct</option>
                <option value="outbound">Outbound</option>
                <option value="referral">Referral</option>
                <option value="proprietary">Proprietary</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Key observations, deal thesis..."
                className={inputCls + ' resize-none'}/>
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 px-5 py-4 border-t border-slate-800/50">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-700/60 text-slate-400 hover:text-slate-200 text-[12px] font-medium rounded-xl transition-colors">Cancel</button>
          <button
            onClick={() => {
              const t: AcquisitionTarget = {
                id: `acq-${Date.now()}`, name: name.trim(), industry, geography,
                revenue: rev, ebitda: ebd, askingPrice: ask || ebd * 5, multiple: multiple || 5,
                stage: 'sourcing', source, ownerName, dealOwner: 'You',
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                notes: notes || undefined, score: 5, thesisMatch: 'moderate',
              };
              addMemoryEntry('deal-action', `Added new target: "${t.name}" (${fmt(t.ebitda)} EBITDA)`, { entityId: t.id, entityType: 'deal' });
              onSave(t);
            }}
            disabled={!canSave}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[12px] font-semibold rounded-xl transition-colors"
          >
            Add Target
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main AcquisitionPipeline ─────────────────────────────────────────────────

export default function AcquisitionPipeline({ onAskAI }: { onAskAI?: (msg: string) => void }) {
  const loadTargets = (): AcquisitionTarget[] => {
    try {
      const raw = localStorage.getItem('bos_acq_targets');
      if (raw) return JSON.parse(raw) as AcquisitionTarget[];
    } catch { /* ignore */ }
    return SEED;
  };

  const [targets, setTargetsState] = useState<AcquisitionTarget[]>(loadTargets);
  const [selected, setSelected] = useState<AcquisitionTarget | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterStage, setFilterStage] = useState<AcqStage | 'all'>('all');
  const [filterMatch, setFilterMatch] = useState<'all' | 'strong' | 'moderate' | 'weak'>('all');
  const dragId = useRef<string | null>(null);

  const save = useCallback((list: AcquisitionTarget[]) => {
    setTargetsState(list);
    try { localStorage.setItem('bos_acq_targets', JSON.stringify(list)); } catch { /* ignore */ }
  }, []);

  const updateTarget = useCallback((t: AcquisitionTarget) => {
    save(targets.map(x => x.id === t.id ? { ...t, updatedAt: new Date().toISOString() } : x));
    setSelected(t);
  }, [targets, save]);

  const addTarget = useCallback((t: AcquisitionTarget) => {
    save([t, ...targets]);
    setShowAdd(false);
  }, [targets, save]);

  const handleDrop = useCallback((stage: AcqStage) => {
    if (!dragId.current) return;
    const t = targets.find(x => x.id === dragId.current);
    if (t && t.stage !== stage) {
      const updated = { ...t, stage, updatedAt: new Date().toISOString() };
      addMemoryEntry('deal-action', `Moved "${t.name}" to ${stage}`, { entityId: t.id, entityType: 'deal' });
      save(targets.map(x => x.id === dragId.current ? updated : x));
    }
    dragId.current = null;
  }, [targets, save]);

  // Stats
  const active = targets.filter(t => ACTIVE_STAGES.includes(t.stage));
  const totalEBITDA = active.reduce((s, t) => s + t.ebitda, 0);
  const totalAsk    = active.reduce((s, t) => s + t.askingPrice, 0);
  const won         = targets.filter(t => t.stage === 'closed-won');
  const overdue     = active.filter(t => isOverdue(t.nextActionDate));

  const visibleColumns = ACTIVE_STAGES.filter(s => filterStage === 'all' || filterStage === s);
  const filterTargets  = (stage: AcqStage) =>
    targets.filter(t => t.stage === stage && (filterMatch === 'all' || t.thesisMatch === filterMatch));

  return (
    <div className="space-y-4 h-full">

      {/* Stats header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Targets',    value: String(active.length),      sub: `${won.length} won this year`,         color: 'text-slate-100' },
          { label: 'Total EBITDA',      value: fmt(totalEBITDA),           sub: 'in active pipeline',                   color: 'text-emerald-400' },
          { label: 'Total Consideration', value: fmt(totalAsk),            sub: `avg ${(totalAsk / Math.max(active.length,1) / 1e6).toFixed(1)}M per deal`, color: 'text-indigo-400' },
          { label: 'Overdue Actions',   value: String(overdue.length),     sub: overdue.length > 0 ? 'need immediate follow-up' : 'all actions current', color: overdue.length > 0 ? 'text-red-400' : 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{s.label}</div>
            <div className={`text-[20px] font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-xl transition-all">
          + Add Target
        </button>

        {/* Stage filter */}
        <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1">
          <button onClick={() => setFilterStage('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${filterStage === 'all' ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
            All
          </button>
          {STAGES.slice(0, 6).map(s => (
            <button key={s.id} onClick={() => setFilterStage(s.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap ${filterStage === s.id ? `bg-slate-700 ${s.color}` : 'text-slate-500 hover:text-slate-300'}`}>
              {s.short}
            </button>
          ))}
        </div>

        {/* Match filter */}
        <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800/50 rounded-xl p-1">
          {(['all', 'strong', 'moderate', 'weak'] as const).map(m => (
            <button key={m} onClick={() => setFilterMatch(m)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition-all ${
                filterMatch === m
                  ? m === 'strong' ? 'bg-emerald-500/15 text-emerald-300' : m === 'moderate' ? 'bg-amber-500/15 text-amber-300' : m === 'weak' ? 'bg-red-500/15 text-red-300' : 'bg-slate-700 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>{m}</button>
          ))}
        </div>

        {onAskAI && (
          <button
            onClick={() => onAskAI(`I have ${active.length} active acquisition targets totaling ${fmt(totalAsk)} in consideration with ${fmt(totalEBITDA)} EBITDA across the pipeline. ${overdue.length > 0 ? `${overdue.length} deals have overdue next actions. ` : ''}Which deal should I prioritize this week and what's the single most important action I should take?`)}
            className="ml-auto flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium border border-indigo-500/25 hover:border-indigo-500/50 px-3 py-2 rounded-xl transition-all">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/><rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/></svg>
            Ask AI: prioritize pipeline
          </button>
        )}
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto pb-2 -mx-0">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {STAGES.filter(s => !['closed-won', 'closed-lost'].includes(s.id)).map(stage => {
            if (filterStage !== 'all' && filterStage !== stage.id) return null;
            const stageTargets = filterTargets(stage.id);
            return (
              <div
                key={stage.id}
                className="flex-shrink-0"
                style={{ minWidth: '200px', maxWidth: '280px', width: '240px' }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${stage.bg} border ${stage.border}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dot}`}/>
                    <span className={`text-[11px] font-bold ${stage.color}`}>{stage.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-900/50 px-1.5 py-0.5 rounded-full border border-slate-700/40">
                    {stageTargets.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[120px]">
                  {stageTargets.map(t => (
                    <TargetCard
                      key={t.id}
                      target={t}
                      onOpen={setSelected}
                      onDragStart={id => { dragId.current = id; }}
                    />
                  ))}
                  {stageTargets.length === 0 && (
                    <div className="border border-dashed border-slate-800/60 rounded-xl p-4 text-center text-[11px] text-slate-700">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Won column (collapsed summary) */}
          {(filterStage === 'all' || filterStage === 'closed-won') && (() => {
            const wonTargets = targets.filter(t => t.stage === 'closed-won');
            const stage = STAGES.find(s => s.id === 'closed-won')!;
            return (
              <div key="won" className="w-48 flex-shrink-0">
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${stage.bg} border ${stage.border}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.dot}`}/>
                    <span className={`text-[11px] font-bold ${stage.color}`}>{stage.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-900/50 px-1.5 py-0.5 rounded-full border border-slate-700/40">{wonTargets.length}</span>
                </div>
                <div className="space-y-2">
                  {wonTargets.map(t => (
                    <button key={t.id} onClick={() => setSelected(t)}
                      className="w-full text-left bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 hover:bg-emerald-500/10 transition-colors">
                      <div className="text-[11px] font-semibold text-emerald-300 truncate">{t.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{fmt(t.finalPrice ?? t.askingPrice)} · {t.multiple.toFixed(1)}x</div>
                    </button>
                  ))}
                  {wonTargets.length === 0 && (
                    <div className="border border-dashed border-emerald-500/15 rounded-xl p-4 text-center text-[11px] text-slate-700">First close pending</div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Modals */}
      {selected && <TargetDrawer target={selected} onClose={() => setSelected(null)} onUpdate={updateTarget}/>}
      {showAdd && <AddTargetModal onSave={addTarget} onCancel={() => setShowAdd(false)}/>}
    </div>
  );
}
