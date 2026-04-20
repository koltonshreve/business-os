import { useState, useMemo } from 'react';
import type { UnifiedBusinessData, SupplierRecord, SupplierData } from '../../types';
import { buildSupplierData } from '../../lib/data-connectors';
import Tooltip from '../ui/Tooltip';

// ── Demo data shown when no suppliers uploaded ────────────────────────────────
const DEMO_SUPPLIERS: SupplierRecord[] = [
  // Labor
  { id: 's1',  name: 'Acme Staffing Co',          category: 'Labor',          spend: 125000, invoiceCount: 12, paymentTerms: 'NET30', contractValue: 150000 },
  { id: 's2',  name: 'TechTalent Partners',        category: 'Labor',          spend: 48000,  invoiceCount: 6,  paymentTerms: 'NET30', contractValue: 60000 },
  { id: 's3',  name: 'Freelance — J. Smith',       category: 'Labor',          spend: 22000,  invoiceCount: 4,  paymentTerms: 'NET15' },
  { id: 's4',  name: 'Freelance — M. Chen',        category: 'Labor',          spend: 9600,   invoiceCount: 3 },
  // Cloud & Infrastructure
  { id: 's5',  name: 'AWS',                        category: 'Cloud',          spend: 72000,  invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's6',  name: 'Google Cloud Platform',      category: 'Cloud',          spend: 18000,  invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's7',  name: 'Cloudflare',                 category: 'Cloud',          spend: 4800,   invoiceCount: 12, paymentTerms: 'NET30' },
  // Software & SaaS
  { id: 's8',  name: 'Microsoft 365',              category: 'Software',       spend: 24000,  invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's9',  name: 'Salesforce',                 category: 'Software',       spend: 36000,  invoiceCount: 12, paymentTerms: 'NET30', contractValue: 36000 },
  { id: 's10', name: 'Slack',                      category: 'Software',       spend: 6000,   invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's11', name: 'Zoom',                       category: 'Software',       spend: 3600,   invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's12', name: 'QuickBooks Online',          category: 'Software',       spend: 3600,   invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's13', name: 'Adobe Creative Cloud',       category: 'Software',       spend: 2400,   invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's14', name: 'HubSpot CRM',                category: 'Software',       spend: 14400,  invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's15', name: 'Notion',                     category: 'Software',       spend: 1200,   invoiceCount: 12 },
  { id: 's16', name: 'GitHub Enterprise',          category: 'Software',       spend: 4800,   invoiceCount: 12, paymentTerms: 'NET30' },
  // Facilities
  { id: 's17', name: 'Office Lease — Main St',     category: 'Facilities',     spend: 96000,  invoiceCount: 12, contractValue: 120000, paymentTerms: 'NET15' },
  { id: 's18', name: 'WeWork Flex Offices',        category: 'Facilities',     spend: 18000,  invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's19', name: 'Parking & Utilities',        category: 'Facilities',     spend: 14400,  invoiceCount: 12 },
  { id: 's20', name: 'Building Maintenance Co.',   category: 'Facilities',     spend: 7200,   invoiceCount: 4 },
  // HR & Benefits
  { id: 's21', name: 'Fidelity Benefits',          category: 'HR & Benefits',  spend: 42000,  invoiceCount: 12 },
  { id: 's22', name: 'Gusto Payroll',              category: 'HR & Benefits',  spend: 4800,   invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's23', name: 'ADP — HR Platform',          category: 'HR & Benefits',  spend: 6000,   invoiceCount: 12, paymentTerms: 'NET30' },
  // Marketing
  { id: 's24', name: 'Google Ads',                 category: 'Marketing',      spend: 24000,  invoiceCount: 12 },
  { id: 's25', name: 'LinkedIn Ads',               category: 'Marketing',      spend: 12000,  invoiceCount: 12 },
  { id: 's26', name: 'Creative Agency — Brandwell',category: 'Marketing',      spend: 18000,  invoiceCount: 6,  contractValue: 36000 },
  { id: 's27', name: 'Mailchimp',                  category: 'Marketing',      spend: 1800,   invoiceCount: 12 },
  // Professional Services
  { id: 's28', name: 'Grant Thornton — Audit',     category: 'Professional',   spend: 28000,  invoiceCount: 2,  contractValue: 28000 },
  { id: 's29', name: 'Wilson Sonsini — Legal',     category: 'Professional',   spend: 36000,  invoiceCount: 6 },
  { id: 's30', name: 'CFO Advisory Group',         category: 'Professional',   spend: 15000,  invoiceCount: 12 },
  // Insurance & Compliance
  { id: 's31', name: 'Hiscox — Business Insurance',category: 'Insurance',      spend: 14400,  invoiceCount: 12, paymentTerms: 'NET30' },
  { id: 's32', name: 'Cyber Risk — Coalition',     category: 'Insurance',      spend: 9600,   invoiceCount: 12, paymentTerms: 'NET30' },
  // Travel & Expenses
  { id: 's33', name: 'Amex Corporate Cards',       category: 'Travel & Exp',   spend: 18000,  invoiceCount: 12 },
  { id: 's34', name: 'Navan (Travel Platform)',    category: 'Travel & Exp',   spend: 3600,   invoiceCount: 12, paymentTerms: 'NET30' },
  // Miscellaneous / Tail
  { id: 's35', name: 'FedEx Shipping',             category: 'Logistics',      spend: 2400,   invoiceCount: 12 },
  { id: 's36', name: 'UPS',                        category: 'Logistics',      spend: 1800,   invoiceCount: 8 },
  { id: 's37', name: 'Office Supplies — Staples',  category: 'Office Supplies',spend: 3600,   invoiceCount: 4 },
  { id: 's38', name: 'Amazon Business',            category: 'Office Supplies',spend: 4800,   invoiceCount: 12 },
  { id: 's39', name: 'Coffee & Catering',          category: 'Office Supplies',spend: 2400,   invoiceCount: 12 },
  { id: 's40', name: 'LinkedIn Recruiter',         category: 'Recruiting',     spend: 12000,  invoiceCount: 12, paymentTerms: 'NET30' },
];

interface Props {
  data: UnifiedBusinessData;
  onDataUpdate?: (data: UnifiedBusinessData) => void;
  onAskAI?: (msg: string) => void;
}

type SortKey = 'spend' | 'name' | 'category' | 'spendPct';
type ViewMode = 'simple' | 'advanced';

function fmt$(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
       : n >= 1_000     ? `$${(n / 1_000).toFixed(0)}k`
       :                  `$${n.toFixed(0)}`;
}

function pct(n: number) { return `${n.toFixed(1)}%`; }

function RiskBadge({ level }: { level?: string }) {
  if (!level || level === 'low') return null;
  const cls = level === 'high'
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${cls} uppercase tracking-wide`}>
      {level}
    </span>
  );
}

function TailBadge() {
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-slate-800/60 text-slate-500 border-slate-700/40 uppercase tracking-wide">
      tail
    </span>
  );
}

// ── Horizontal bar mini-chart ─────────────────────────────────────────────────
function SpendBar({ pctVal, color }: { pctVal: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-800/50 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pctVal, 100)}%` }}/>
      </div>
      <span className="text-[10px] text-slate-500 font-mono w-10 text-right flex-shrink-0">{pct(pctVal)}</span>
    </div>
  );
}

// ── HHI gauge ────────────────────────────────────────────────────────────────
function HHIGauge({ hhi }: { hhi: number }) {
  const max = 10000;
  const w = Math.min((hhi / max) * 100, 100);
  const color = hhi >= 2500 ? 'bg-red-500' : hhi >= 1500 ? 'bg-amber-500' : 'bg-emerald-500';
  const label = hhi >= 2500 ? 'Highly Concentrated' : hhi >= 1500 ? 'Moderately Concentrated' : 'Diversified';
  const textColor = hhi >= 2500 ? 'text-red-400' : hhi >= 1500 ? 'text-amber-400' : 'text-emerald-400';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          HHI Score
          <Tooltip
            content="Herfindahl-Hirschman Index measures supplier concentration. Higher = more concentrated, more risk."
            formula={"HHI = Σ (supplier_spend / total_spend)² × 10,000\n< 1,500  Diversified\n1,500–2,500  Moderate\n> 2,500  Highly Concentrated"}
          />
        </span>
        <span className={`text-[11px] font-semibold ${textColor}`}>{hhi.toLocaleString()} — {label}</span>
      </div>
      <div className="bg-slate-800/60 rounded-full h-2 overflow-hidden relative">
        <div className="absolute inset-y-0 left-[15%] w-px bg-slate-600 opacity-50"/>
        <div className="absolute inset-y-0 left-[25%] w-px bg-slate-600 opacity-50"/>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }}/>
      </div>
      <div className="flex justify-between text-[9px] text-slate-600">
        <span>0 — Diverse</span>
        <span>1500 — Mod.</span>
        <span>2500 — High</span>
        <span>10000 — Monopoly</span>
      </div>
    </div>
  );
}

export default function SupplierDashboard({ data, onDataUpdate, onAskAI }: Props) {
  const [view, setView] = useState<ViewMode>('simple');
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [localOverrides, setLocalOverrides] = useState<Record<string, number>>({});

  const isDemo = !data.suppliers;

  // Merge overrides into suppliers for live recalc
  const supplierData: SupplierData = useMemo(() => {
    const base = isDemo ? DEMO_SUPPLIERS : data.suppliers!.suppliers;
    const withOverrides = base.map(s => ({
      ...s,
      spendOverride: localOverrides[s.id] ?? s.spendOverride,
    }));
    return buildSupplierData(withOverrides);
  }, [data.suppliers, localOverrides, isDemo]);

  const { suppliers, totalSpend, byCategory, redundancies, tailSuppliers, hhi, concentrationRisk } = supplierData;

  // Apply search + category filter
  const filtered = useMemo(() => {
    let list = suppliers;
    if (catFilter !== 'all') list = list.filter(s => s.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      if (sortKey === 'spend')    { va = a.spendOverride ?? a.spend; vb = b.spendOverride ?? b.spend; }
      if (sortKey === 'spendPct') { va = a.spendPct ?? 0;            vb = b.spendPct ?? 0; }
      if (sortKey === 'name')     { va = a.name;                     vb = b.name; }
      if (sortKey === 'category') { va = a.category;                 vb = b.category; }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [suppliers, catFilter, search, sortKey, sortDir]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(suppliers.map(s => s.category))).sort()], [suppliers]);

  const tailSpend = suppliers.filter(s => s.isTail).reduce((sum, s) => sum + (s.spendOverride ?? s.spend), 0);
  const tailSpendPct = totalSpend > 0 ? (tailSpend / totalSpend) * 100 : 0;

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function commitOverride(id: string) {
    const val = parseFloat(editVal.replace(/[^0-9.]/g, ''));
    if (!isNaN(val) && val >= 0) setLocalOverrides(o => ({ ...o, [id]: val }));
    setEditId(null);
  }

  function removeOverride(id: string) {
    setLocalOverrides(o => { const next = { ...o }; delete next[id]; return next; });
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-slate-700">↕</span>;
    return <span className="text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // Category color palette
  const catColors = ['bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500', 'bg-pink-500'];
  const catColorMap: Record<string, string> = {};
  categories.filter(c => c !== 'all').forEach((c, i) => { catColorMap[c] = catColors[i % catColors.length]; });

  return (
    <div className="space-y-5">

      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-100">Supplier Spend Intelligence</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isDemo ? 'Demo data — upload your supplier CSV to see your real analysis' : `${suppliers.length} suppliers · ${byCategory.length} categories`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-900/60 border border-slate-800/60 rounded-lg p-0.5">
            {(['simple', 'advanced'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-all ${
                  view === v ? 'bg-slate-800 text-slate-100 shadow' : 'text-slate-500 hover:text-slate-300'}`}>
                {v === 'simple' ? 'Simple' : 'Advanced'}
              </button>
            ))}
          </div>
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Analyze my supplier spend. Total: ${fmt$(totalSpend)}, ${suppliers.length} suppliers across ${byCategory.length} categories. HHI: ${hhi}. Top category: ${byCategory[0]?.category} at ${pct(byCategory[0]?.spendPct ?? 0)}. Identify risks and cost reduction opportunities.`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/25 text-indigo-300 rounded-lg text-[11px] font-semibold transition-all">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/></svg>
              AI Analysis
            </button>
          )}
        </div>
      </div>

      {isDemo && (
        <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"/>
          <span className="text-[11px] text-amber-400/80">Showing demo supplier data — go to <strong>Data</strong> tab and upload a Supplier CSV to see your real spend.</span>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Total Spend</div>
          <div className="text-[20px] font-bold text-slate-100 tabular-nums">{fmt$(totalSpend)}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{suppliers.length} suppliers</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">Categories</div>
          <div className="text-[20px] font-bold text-slate-100 tabular-nums">{byCategory.length}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{redundancies.length} with redundancy</div>
        </div>
        <div className={`bg-slate-900/50 border rounded-xl px-4 py-3 ${tailSuppliers.length > 0 ? 'border-amber-500/20' : 'border-slate-800/50'}`}>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1 flex items-center gap-1">
            Tail Suppliers
            <Tooltip content="Suppliers whose spend is less than 2% of your total. They add admin overhead (invoices, contracts, AP) without meaningful purchasing leverage. Consider consolidating." formula="Tail = supplier_spend < 2% of total_spend"/>
          </div>
          <div className={`text-[20px] font-bold tabular-nums ${tailSuppliers.length > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
            {tailSuppliers.length}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">{pct(tailSpendPct)} of total spend</div>
        </div>
        <div className={`bg-slate-900/50 border rounded-xl px-4 py-3 ${
          concentrationRisk === 'high' ? 'border-red-500/25' : concentrationRisk === 'medium' ? 'border-amber-500/20' : 'border-emerald-500/15'}`}>
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1 flex items-center gap-1">
            Concentration
            <Tooltip content="Based on HHI score. High concentration means a few suppliers dominate your spend — pricing power and supply risk increase." formula={"High   HHI > 2,500\nMedium HHI 1,500–2,500\nLow    HHI < 1,500"}/>
          </div>
          <div className={`text-[20px] font-bold tabular-nums capitalize ${
            concentrationRisk === 'high' ? 'text-red-400' : concentrationRisk === 'medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
            {concentrationRisk}
          </div>
          <div className="text-[10px] text-slate-600 mt-0.5">HHI {hhi.toLocaleString()}</div>
        </div>
      </div>

      {/* ── Advanced-only: HHI gauge + redundancy + AI insights ── */}
      {view === 'advanced' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* HHI + concentration */}
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em]">Concentration Analysis</div>
            <HHIGauge hhi={hhi}/>
            <div className="space-y-2 pt-1">
              {byCategory.map(cat => (
                <div key={cat.category} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 font-medium">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-mono">{fmt$(cat.spend)}</span>
                      {cat.isConcentrated && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20 uppercase tracking-wide">high</span>
                      )}
                    </div>
                  </div>
                  <SpendBar pctVal={cat.spendPct} color={catColorMap[cat.category] ?? 'bg-slate-500'}/>
                </div>
              ))}
            </div>
          </div>

          {/* Redundancy + tail analysis */}
          <div className="space-y-4">
            {/* Redundancy */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3 flex items-center gap-1">
                Supplier Redundancy
                <Tooltip content="Two or more suppliers serving the same category. Redundancy increases admin and reduces negotiating leverage, but may be intentional for risk diversification." formula="Savings estimate = combined_spend × 15%\n(industry standard consolidation uplift)"/>
              </div>
              {redundancies.length === 0 ? (
                <div className="text-[12px] text-slate-500">No redundancies detected — each category has a single supplier.</div>
              ) : (
                <div className="space-y-3">
                  {redundancies.map(r => (
                    <div key={r.category} className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-slate-200">{r.category}</span>
                        <span className="text-[11px] text-amber-400">{fmt$(r.combinedSpend)} combined</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mb-1">{r.suppliers.join(', ')}</div>
                      <div className="text-[10px] text-emerald-400/80">
                        Potential savings: ~{fmt$(r.potentialSavings)} if consolidated
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tail spend */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-3 flex items-center gap-1">
                Tail Spend ({tailSuppliers.length} suppliers)
                <Tooltip content="Suppliers under 2% of total spend. Each requires AP processing, contract management, and vendor oversight — disproportionate admin cost relative to value."/>
              </div>
              {tailSuppliers.length === 0 ? (
                <div className="text-[12px] text-slate-500">No tail suppliers — all suppliers exceed 2% of total spend.</div>
              ) : (
                <div className="space-y-1.5">
                  {suppliers.filter(s => s.isTail).sort((a, b) => (b.spendPct ?? 0) - (a.spendPct ?? 0)).map(s => (
                    <div key={s.id} className="flex items-center justify-between py-1 border-b border-slate-800/30 last:border-0">
                      <div>
                        <div className="text-[11px] text-slate-300">{s.name}</div>
                        <div className="text-[10px] text-slate-600">{s.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-mono text-slate-400">{fmt$(s.spendOverride ?? s.spend)}</div>
                        <div className="text-[10px] text-slate-600">{pct(s.spendPct ?? 0)}</div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 text-[10px] text-emerald-400/80">
                    Review {tailSuppliers.length} tail suppliers — consider consolidating or eliminating to reduce admin overhead.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Category spend bars (Simple view) ── */}
      {view === 'simple' && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Spend by Category</div>
          <div className="space-y-2.5">
            {byCategory.map(cat => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-300 font-medium">{cat.category}</span>
                    <span className="text-[10px] text-slate-600">{cat.supplierCount} supplier{cat.supplierCount !== 1 ? 's' : ''}</span>
                    {cat.isConcentrated && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20 uppercase tracking-wide">concentrated</span>
                    )}
                  </div>
                  <span className="text-[12px] font-semibold text-slate-200 font-mono">{fmt$(cat.spend)}</span>
                </div>
                <SpendBar pctVal={cat.spendPct} color={catColorMap[cat.category] ?? 'bg-slate-500'}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Supplier table ── */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
        {/* Table controls */}
        <div className="px-4 py-3 border-b border-slate-800/40 flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="flex-1 relative">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600">
              <circle cx="6" cy="6" r="4"/><path d="M10 10l2 2"/>
            </svg>
            <input
              type="text"
              placeholder="Search suppliers…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-800/40 border border-slate-700/40 rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/40"
            />
          </div>
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-1.5 text-[12px] text-slate-400 outline-none focus:border-indigo-500/40"
          >
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </select>
          <span className="text-[11px] text-slate-600 flex-shrink-0">{filtered.length} of {suppliers.length}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-800/40 bg-slate-900/60">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('name')}>
                  Supplier <SortIcon k="name"/>
                </th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('category')}>
                  Category <SortIcon k="category"/>
                </th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none" onClick={() => handleSort('spend')}>
                  Spend <SortIcon k="spend"/>
                </th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-500 cursor-pointer select-none min-w-[120px]" onClick={() => handleSort('spendPct')}>
                  % of Total <SortIcon k="spendPct"/>
                </th>
                {view === 'advanced' && (
                  <>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Invoices</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Terms</th>
                  </>
                )}
                <th className="text-center px-4 py-2.5 font-semibold text-slate-500">
                  <span className="flex items-center justify-center gap-1">Flags
                    <Tooltip content="Tail: spend < 2% of total. Risk: High ≥20% of total spend, Medium ≥10%. Redundant: another supplier serves the same category." side="bottom"/>
                  </span>
                </th>
                {view === 'advanced' && <th className="px-4 py-2.5"/>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const effectiveSpend = s.spendOverride ?? s.spend;
                const hasOverride    = localOverrides[s.id] !== undefined || s.spendOverride !== undefined;
                return (
                  <tr key={s.id} className={`border-b border-slate-800/30 last:border-0 hover:bg-slate-800/20 transition-colors ${i % 2 === 1 ? 'bg-slate-900/20' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-200 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${catColorMap[s.category] ?? 'bg-slate-500'}`}/>
                        <span className="text-slate-400">{s.category}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {editId === s.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            autoFocus
                            type="text"
                            defaultValue={effectiveSpend.toString()}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitOverride(s.id); if (e.key === 'Escape') setEditId(null); }}
                            className="w-24 bg-slate-800 border border-indigo-500/50 rounded px-2 py-0.5 text-right text-[12px] text-slate-100 outline-none"
                          />
                          <button onClick={() => commitOverride(s.id)} className="text-emerald-400 hover:text-emerald-300 text-[11px]">✓</button>
                          <button onClick={() => setEditId(null)} className="text-slate-600 hover:text-slate-400 text-[11px]">✕</button>
                        </div>
                      ) : (
                        <span className={hasOverride ? 'text-indigo-300' : 'text-slate-200'}>
                          {fmt$(effectiveSpend)}
                          {hasOverride && <span className="text-[9px] text-indigo-400/60 ml-1">override</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 min-w-[120px]">
                      <SpendBar pctVal={s.spendPct ?? 0} color={catColorMap[s.category] ?? 'bg-slate-500'}/>
                    </td>
                    {view === 'advanced' && (
                      <>
                        <td className="px-4 py-2.5 text-right text-slate-500">{s.invoiceCount ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{s.paymentTerms ?? '—'}</td>
                      </>
                    )}
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {s.isTail && <TailBadge/>}
                        {s.riskLevel && s.riskLevel !== 'low' && <RiskBadge level={s.riskLevel}/>}
                        {s.isRedundant && view === 'advanced' && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-violet-500/10 text-violet-400 border-violet-500/20 uppercase tracking-wide">redundant</span>
                        )}
                      </div>
                    </td>
                    {view === 'advanced' && (
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditId(s.id); setEditVal(effectiveSpend.toString()); }}
                            title="Override spend"
                            className="w-6 h-6 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-colors">
                            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
                              <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z"/>
                            </svg>
                          </button>
                          {hasOverride && (
                            <button onClick={() => removeOverride(s.id)}
                              title="Remove override"
                              className="w-6 h-6 flex items-center justify-center rounded text-indigo-600 hover:text-red-400 hover:bg-slate-800/60 transition-colors">
                              <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Advanced: AI-powered recommendations ── */}
      {view === 'advanced' && onAskAI && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              title: 'Consolidation Opportunities',
              prompt: `I have ${redundancies.length} supplier redundancies in my spend data: ${redundancies.map(r => `${r.category} (${r.suppliers.join(', ')})`).join('; ')}. Total combined spend in redundant categories: ${fmt$(redundancies.reduce((s, r) => s + r.combinedSpend, 0))}. What's the best consolidation approach and what savings should I expect?`,
              desc: `${redundancies.length} categories with multiple suppliers`,
              color: 'border-violet-500/20 bg-violet-500/5 text-violet-300',
            },
            {
              title: 'Tail Spend Review',
              prompt: `I have ${tailSuppliers.length} tail suppliers (under 2% of total spend each): ${tailSuppliers.slice(0, 8).join(', ')}${tailSuppliers.length > 8 ? ` and ${tailSuppliers.length - 8} more` : ''}. They represent ${pct(tailSpendPct)} of my ${fmt$(totalSpend)} total spend. Should I eliminate or consolidate any of these?`,
              desc: `${tailSuppliers.length} suppliers under 2% threshold`,
              color: 'border-amber-500/20 bg-amber-500/5 text-amber-300',
            },
            {
              title: 'Benchmark My Spend',
              prompt: `My total supplier spend is ${fmt$(totalSpend)}. Breakdown: ${byCategory.slice(0, 5).map(c => `${c.category}: ${fmt$(c.spend)} (${pct(c.spendPct)})`).join(', ')}. How does this compare to industry benchmarks for a business at my revenue level (${fmt$(data.revenue.total)})? What categories seem over/under-spent?`,
              desc: 'Compare vs. industry norms',
              color: 'border-sky-500/20 bg-sky-500/5 text-sky-300',
            },
          ].map(card => (
            <button key={card.title} onClick={() => onAskAI(card.prompt)}
              className={`text-left p-4 rounded-xl border transition-all hover:brightness-110 ${card.color}`}>
              <div className="text-[12px] font-semibold mb-1">{card.title}</div>
              <div className="text-[10px] opacity-70">{card.desc}</div>
              <div className="text-[10px] mt-2 opacity-50">Ask AI →</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
