import { useState, useCallback } from 'react';
import type { UnifiedBusinessData, CSVUpload } from '../../types';
import { parseCSVUpload, mergeDataSources } from '../../lib/data-connectors';

export interface CompanyProfile {
  industry?: string;
  revenueModel?: string;
}

interface Props {
  data: UnifiedBusinessData;
  onDataUpdate: (data: UnifiedBusinessData) => void;
  onSuccess?: (message: string) => void;
  companyProfile?: CompanyProfile;
  onProfileChange?: (profile: CompanyProfile) => void;
}

type GsStep    = 'idle' | 'select-sheet' | 'map-columns' | 'connected';
type ExcelStep = 'idle' | 'listing' | 'select-file' | 'select-sheet' | 'connected';
interface SheetOption { id: string; name: string; modifiedTime?: string; }

function Spinner() {
  return (
    <svg viewBox="0 0 14 14" fill="currentColor" className="w-3.5 h-3.5 animate-spin flex-shrink-0">
      <path opacity="0.25" d="M7 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"/>
      <path d="M7 1.5a5.5 5.5 0 015.5 5.5h-1.5A4 4 0 007 3V1.5z"/>
    </svg>
  );
}

function SL({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">{children}</div>;
}

function ConnectedBadge() {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Connected
    </span>
  );
}
function ComingSoonBadge() {
  return <span className="text-[10px] font-medium text-slate-600 bg-slate-800/60 border border-slate-700/50 px-2 py-0.5 rounded-full">Soon</span>;
}
function NativeBadge() {
  return <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">Live</span>;
}

function ConnectorCard({
  icon, name, desc, accentColor, badge, statusBadge, children,
}: {
  icon: React.ReactNode; name: string; desc: string;
  accentColor?: string; badge?: string; statusBadge?: React.ReactNode; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bg-slate-900/50 border rounded-xl overflow-hidden transition-all ${open ? 'border-slate-700/70' : 'border-slate-800/50'}`}>
      <button
        className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-800/20 transition-colors text-left"
        onClick={() => children && setOpen(o => !o)}>
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${accentColor ?? 'bg-slate-800/60 border-slate-700/40'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-100">{name}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{desc}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge && <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">{badge}</span>}
          {statusBadge}
          {children && (
            <svg viewBox="0 0 14 14" fill="currentColor" className={`w-3.5 h-3.5 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`}>
              <path d="M2 4l5 6 5-6H2z"/>
            </svg>
          )}
        </div>
      </button>
      {open && children && (
        <div className="px-5 pb-4 border-t border-slate-800/40 pt-4">{children}</div>
      )}
    </div>
  );
}

// ── Category connector grid ──────────────────────────────────────────────────
interface MiniConnector {
  name: string;
  tag?: string;
  tagColor?: string;
}

function CategorySection({
  title,
  emoji,
  accentClass,
  borderClass,
  description,
  connectors,
  exportTip,
}: {
  title: string;
  emoji: string;
  accentClass: string;
  borderClass: string;
  description: string;
  connectors: MiniConnector[];
  exportTip?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bg-slate-900/40 border ${borderClass} rounded-xl overflow-hidden transition-all`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-slate-800/20 transition-colors text-left">
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 text-base ${accentClass}`}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-100">{title}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{description}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-slate-500 font-medium">{connectors.length} systems</span>
          <svg viewBox="0 0 14 14" fill="currentColor" className={`w-3.5 h-3.5 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M2 4l5 6 5-6H2z"/>
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-800/40 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {connectors.map(c => (
              <div key={c.name} className="flex items-center justify-between bg-slate-800/40 border border-slate-700/30 rounded-lg px-3 py-2">
                <span className="text-[12px] font-medium text-slate-300">{c.name}</span>
                {c.tag && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                    c.tagColor === 'green'  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                    c.tagColor === 'blue'   ? 'text-sky-400 bg-sky-500/10 border-sky-500/20' :
                    c.tagColor === 'violet' ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' :
                    c.tagColor === 'amber'  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                                              'text-slate-500 bg-slate-800/60 border-slate-700/50'
                  }`}>{c.tag}</span>
                )}
              </div>
            ))}
          </div>
          {exportTip && (
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2.5">
              <div className="text-[10px] font-semibold text-slate-500 mb-1">CSV Export</div>
              <div className="text-[11px] text-slate-500 leading-relaxed">{exportTip}</div>
            </div>
          )}
          <div className="text-center">
            <span className="text-[11px] text-indigo-400/70 font-medium">Native API connections in development — upload CSV export in the meantime</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CSV templates ────────────────────────────────────────────────────────────
const CSV_TEMPLATES: Record<string, { label: string; content: string }> = {
  revenue:    { label: 'Revenue',      content: 'Period,Revenue,COGS\nApr 2026,250000,150000\nMay 2026,275000,160000\nJun 2026,290000,168000\nJul 2026,310000,175000\n' },
  costs:      { label: 'Costs',        content: 'Category,Amount\nLabor,95000\nMaterials,40000\nOverhead,18000\nSales & Marketing,28000\nG&A,22000\nTech & Systems,8000\n' },
  customers:  { label: 'Customers',    content: 'Name,Revenue,Status\nAcme Corp,75000,active\nBeta Industries,55000,active\nGamma LLC,42000,active\nDelta Partners,28000,active\nNew Customer,0,new\nOld Client,0,churned\n' },
  operations: { label: 'Operations',   content: 'Headcount,OpenPositions,BillableHours,TotalHours,CapacityUtilization,AssetUtilization\n18,2,1200,1440,0.84,0.72\n' },
  pipeline:   { label: 'Pipeline',     content: 'DealName,Stage,Value,Probability,CloseDate,Owner\nAcme Expansion,Proposal,85000,60,2025-06-30,Jane Smith\nNew Corp Deal,Negotiation,140000,80,2025-05-15,John Doe\nSmall Account,Qualified,22000,40,2025-07-01,Jane Smith\nEnterprise RFP,Discovery,300000,25,2025-09-30,John Doe\n' },
  payroll:    { label: 'Payroll/HR',   content: 'Department,Headcount,TotalSalary,AvgSalary\nEngineering,5,650000,130000\nSales,3,360000,120000\nOperations,4,340000,85000\nG&A,2,220000,110000\nMarketing,2,200000,100000\n' },
  cashflow:   { label: 'Cash Flow',    content: 'Period,OpeningBalance,Receipts,Payments,ClosingBalance\nApr 2026,180000,245000,210000,215000\nMay 2026,215000,268000,225000,258000\nJun 2026,258000,290000,240000,308000\n' },
  ar_aging:     { label: 'AR Aging',      content: 'Customer,Current,Days30,Days60,Days90,Over90\nAcme Corp,45000,12000,0,0,0\nBeta Industries,30000,8000,5000,0,0\nGamma LLC,22000,0,0,3000,2000\nDelta Partners,18000,6000,0,0,0\n' },
  transactions: { label: 'Transactions',  content: 'Date,Description,Amount,Type,Category,Customer,InvoiceId\n2026-04-05,Invoice #1001 - Acme Corp,45000,revenue,Services,Acme Corp,INV-1001\n2026-04-10,AWS Hosting,-3200,expense,Technology,,\n2026-04-15,Office Rent,-8500,expense,Facilities,,\n2026-04-20,Invoice #1002 - Beta Inc,32000,revenue,Services,Beta Inc,INV-1002\n2026-04-25,Payroll - Engineering,-28000,expense,Payroll,,\n' },
  suppliers:    { label: 'Suppliers',     content: 'Supplier,Category,Spend,InvoiceCount,LastInvoiceDate,ContractValue,PaymentTerms,Contact\nAcme Staffing Co,Labor,125000,12,2026-06-30,150000,NET30,billing@acme.com\nAWS,Technology,48000,12,2026-06-30,,NET30,\nMicrosoft 365,Technology,24000,12,2026-05-31,,NET30,\nQuickBooks Online,Software,3600,12,2026-06-30,,NET30,\nFidelity Benefits,HR & Benefits,32000,12,2026-06-15,,,\nOffice Lease - Main St,Facilities,96000,12,2026-06-30,120000,NET15,\nParking & Utilities,Facilities,18000,12,2026-06-30,,,\nAdobe Creative Cloud,Software,2400,12,2026-05-31,,NET30,\nSlack,Software,4800,12,2026-06-30,,NET30,\nGoogle Workspace,Technology,8400,12,2026-06-30,,NET30,\nFreelance Dev - J.Smith,Labor,22000,4,2026-05-31,,,\nInsurance - Hiscox,Insurance,14400,12,2026-06-30,,NET30,\n' },
};

function downloadTemplate(type: string) {
  const tpl = CSV_TEMPLATES[type];
  if (!tpl) return;
  const blob = new Blob([tpl.content], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${type}_template.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Upload categories config ─────────────────────────────────────────────────
const UPLOAD_CATEGORIES: {
  type: CSVUpload['type'];
  label: string;
  emoji: string;
  desc: string;
  hint: string;
  accent: string;
  accentText: string;
}[] = [
  {
    type:       'revenue',
    label:      'Revenue / P&L',
    emoji:      '📈',
    desc:       'Period revenue, COGS, and gross profit by month/quarter',
    hint:       'Period, Revenue, COGS',
    accent:     'text-indigo-400',
    accentText: 'bg-indigo-500/8 border-indigo-500/20',
  },
  {
    type:       'costs',
    label:      'Cost Breakdown',
    emoji:      '🧾',
    desc:       'Operating expenses by category (Labor, Marketing, G&A…)',
    hint:       'Category, Amount',
    accent:     'text-amber-400',
    accentText: 'bg-amber-500/8 border-amber-500/20',
  },
  {
    type:       'customers',
    label:      'Customer / Account List',
    emoji:      '👥',
    desc:       'Customer names, revenue, and status (active / new / churned)',
    hint:       'Name, Revenue, Status',
    accent:     'text-violet-400',
    accentText: 'bg-violet-500/8 border-violet-500/20',
  },
  {
    type:       'pipeline',
    label:      'Sales Pipeline / CRM',
    emoji:      '🎯',
    desc:       'Open deals with stage, value, probability, and close date',
    hint:       'DealName, Stage, Value, Probability',
    accent:     'text-sky-400',
    accentText: 'bg-sky-500/8 border-sky-500/20',
  },
  {
    type:       'payroll',
    label:      'Payroll / Headcount',
    emoji:      '🏢',
    desc:       'Department headcount, total compensation, and avg salary',
    hint:       'Department, Headcount, TotalSalary',
    accent:     'text-pink-400',
    accentText: 'bg-pink-500/8 border-pink-500/20',
  },
  {
    type:       'cashflow',
    label:      'Cash Flow Statement',
    emoji:      '💰',
    desc:       'Opening/closing balance, receipts, and payments by period',
    hint:       'Period, Opening, Receipts, Payments, Closing',
    accent:     'text-emerald-400',
    accentText: 'bg-emerald-500/8 border-emerald-500/20',
  },
  {
    type:       'ar_aging',
    label:      'AR Aging Report',
    emoji:      '📋',
    desc:       'Accounts receivable by age bucket (current, 30, 60, 90+ days)',
    hint:       'Customer, Current, Days30, Days60, Days90, Over90',
    accent:     'text-orange-400',
    accentText: 'bg-orange-500/8 border-orange-500/20',
  },
  {
    type:       'operations',
    label:      'Operations / Utilization',
    emoji:      '⚙️',
    desc:       'Headcount, billable hours, capacity & asset utilization rates',
    hint:       'Headcount, BillableHours, TotalHours, CapacityUtilization, AssetUtilization',
    accent:     'text-cyan-400',
    accentText: 'bg-cyan-500/8 border-cyan-500/20',
  },
  {
    type:       'transactions',
    label:      'Transaction Ledger',
    emoji:      '🗂️',
    desc:       'Individual transactions with date, amount, category, and counterparty',
    hint:       'Date, Description, Amount, Type, Category, Customer',
    accent:     'text-slate-400',
    accentText: 'bg-slate-800/40 border-slate-700/40',
  },
  {
    type:       'suppliers',
    label:      'Supplier / Vendor Spend',
    emoji:      '🏭',
    desc:       'Supplier names, categories, spend amounts — auto-calculates concentration & redundancy',
    hint:       'Supplier, Category, Spend, InvoiceCount, ContractValue',
    accent:     'text-lime-400',
    accentText: 'bg-lime-500/8 border-lime-500/20',
  },
];

// ── CSV Upload Section ───────────────────────────────────────────────────────
function CSVUploadSection({ data, onDataUpdate, onSuccess }: Props) {
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const handleUpload = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: CSVUpload['type']
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatuses(prev => ({ ...prev, [type]: `Processing ${file.name}…` }));
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch('/api/data/csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uploads: [{ type, filename: file.name, content: reader.result }],
            existingData: data,
          }),
        });
        if (!res.ok) {
          let errMsg = `Upload failed (${res.status})`;
          try { const e = await res.json(); errMsg = e.error ?? errMsg; } catch { /* ignore */ }
          setStatuses(prev => ({ ...prev, [type]: `Error: ${errMsg}` }));
          return;
        }
        const result = await res.json();
        if (result.data) {
          onDataUpdate(result.data);
          const msg = `${file.name} — ${result.results?.[0]?.rowCount ?? '?'} rows imported`;
          setStatuses(prev => ({ ...prev, [type]: `✓ ${msg}` }));
          onSuccess?.(msg);
        } else {
          setStatuses(prev => ({ ...prev, [type]: `Error: ${result.error ?? 'Upload failed'}` }));
        }
      } catch {
        setStatuses(prev => ({ ...prev, [type]: 'Error: Upload failed' }));
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }, [data, onDataUpdate, onSuccess]);

  return (
    <div className="space-y-2">
      {UPLOAD_CATEGORIES.map(cat => {
        const status    = statuses[cat.type] ?? '';
        const isSuccess = status.startsWith('✓');
        const isError   = status.startsWith('Error');
        const isLoading = status.startsWith('Processing');

        return (
          <div key={cat.type}
            className={`bg-slate-900/40 border rounded-xl p-4 transition-all ${
              isSuccess ? 'border-emerald-500/25 bg-emerald-500/4' :
              isError   ? 'border-red-500/25' :
                          'border-slate-800/50 hover:border-slate-700/60'
            }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 text-base ${cat.accentText}`}>
                {cat.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`text-[13px] font-semibold ${cat.accent}`}>{cat.label}</div>
                  {isSuccess && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-semibold">Imported</span>}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{cat.desc}</div>
                {status && (
                  <div className={`text-[11px] mt-1.5 font-medium ${isSuccess ? 'text-emerald-400' : isError ? 'text-red-400' : 'text-slate-400'}`}>
                    {status}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => downloadTemplate(cat.type)}
                  className="text-[11px] text-slate-600 hover:text-slate-400 border border-slate-800/60 hover:border-slate-700 px-2 py-1 rounded-lg transition-colors font-medium whitespace-nowrap">
                  ↓ Template
                </button>
                <label className="cursor-pointer">
                  <span className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                    isLoading
                      ? 'text-slate-500 border-slate-700/50 cursor-not-allowed'
                      : 'text-slate-200 border-slate-700/60 hover:border-slate-500 hover:bg-slate-800/40 cursor-pointer'
                  }`}>
                    {isLoading ? <><Spinner/>Processing…</> : '↑ Upload CSV'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    disabled={isLoading}
                    onChange={e => handleUpload(e, cat.type)}
                  />
                </label>
              </div>
            </div>
            <div className="mt-2 ml-12 text-[10px] text-slate-700 font-mono">{cat.hint}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Google Sheets Connector ──────────────────────────────────────────────────
function GoogleSheetsConnector({ data, onDataUpdate, onSuccess }: Props) {
  const [step, setStep] = useState<GsStep>('idle');
  const [gsToken, setGsToken] = useState('');
  const [spreadsheets, setSpreadsheets] = useState<SheetOption[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState({ revenue: '', costs: '', customers: '' });
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch('/api/data/google-sheets?action=auth-url');
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setConfigured(d.configured !== false);
      if (!d.configured) { setLoading(false); return; }
      const popup = window.open(d.url, 'google-oauth', 'width=500,height=600');
      const listener = async (e: MessageEvent) => {
        if (e.data?.type === 'google-oauth-callback' && e.data.code) {
          window.removeEventListener('message', listener);
          popup?.close();
          try {
            const tokenRes = await fetch('/api/data/google-sheets?action=callback', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: e.data.code }),
            });
            if (!tokenRes.ok) { setLoading(false); return; }
            const { tokens } = await tokenRes.json();
            setGsToken(tokens.access_token);
            const sheetsRes = await fetch('/api/data/google-sheets?action=list-sheets', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: tokens.access_token }),
            });
            if (!sheetsRes.ok) { setLoading(false); return; }
            const { sheets } = await sheetsRes.json();
            setSpreadsheets(sheets ?? []);
            setStep('select-sheet');
          } catch { /* OAuth flow failed */ }
          setLoading(false);
        }
      };
      window.addEventListener('message', listener);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function selectSpreadsheet(id: string) {
    setSelectedSheet(id);
    try {
      const res = await fetch('/api/data/google-sheets?action=sheet-names', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: gsToken, spreadsheetId: id }),
      });
      if (!res.ok) return;
      const { names } = await res.json();
      setSheetNames(names ?? []);
    } catch { /* ignore */ }
    setStep('map-columns');
  }

  async function importData() {
    setLoading(true);
    try {
      const res = await fetch('/api/data/google-sheets?action=fetch-data', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: gsToken, spreadsheetId: selectedSheet, sheets: columnMap }),
      });
      if (res.ok) {
        const { data: gsData } = await res.json();
        if (gsData) { onDataUpdate(gsData); setStep('connected'); onSuccess?.('Google Sheets data imported successfully'); }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  if (step === 'connected') return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-emerald-400 font-medium">Synced from Google Sheets</span>
      <button onClick={() => setStep('idle')} className="text-[12px] text-slate-500 hover:text-slate-300 font-medium">Reconnect</button>
    </div>
  );

  return (
    <div className="space-y-3">
      {configured === false && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5 text-[12px] text-amber-400">
          Add <code className="bg-slate-800 px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="bg-slate-800 px-1 rounded">GOOGLE_CLIENT_SECRET</code> to Vercel env vars.
        </div>
      )}
      {step === 'idle' && (
        <button onClick={start} disabled={loading}
          className="w-full py-2.5 border border-slate-700 hover:border-slate-500 rounded-lg text-[13px] text-slate-300 hover:text-slate-100 transition-all disabled:opacity-40 flex items-center justify-center gap-2 font-medium">
          {loading ? <><Spinner/>Connecting…</> : '→ Connect Google Sheets'}
        </button>
      )}
      {step === 'select-sheet' && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {spreadsheets.map(s => (
            <button key={s.id} onClick={() => selectSpreadsheet(s.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-[13px] text-slate-100 font-medium transition-all">
              {s.name}
            </button>
          ))}
        </div>
      )}
      {step === 'map-columns' && (
        <div className="space-y-2.5">
          {[
            { key: 'revenue', label: 'Revenue tab', hint: 'Period, Revenue, COGS' },
            { key: 'costs',   label: 'Costs tab',   hint: 'Category, Amount' },
            { key: 'customers', label: 'Customers tab', hint: 'Name, Revenue, Status' },
          ].map(({ key, label, hint }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="w-32 flex-shrink-0">
                <div className="text-[12px] font-medium text-slate-300">{label}</div>
                <div className="text-[10px] text-slate-600 font-mono">{hint}</div>
              </div>
              <select value={columnMap[key as keyof typeof columnMap]}
                onChange={e => setColumnMap(prev => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[12px] text-slate-200 focus:outline-none focus:border-indigo-500/60">
                <option value="">Select tab…</option>
                {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
          <button onClick={importData} disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-2">
            {loading ? <><Spinner/>Importing…</> : 'Import Data'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Stripe Connector ─────────────────────────────────────────────────────────
interface StripeSummary {
  ttmRevenue: number;
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  customerCount: number;
  recentlyChurned: number;
  periodsImported: number;
}

function StripeConnector({ data, onDataUpdate, onSuccess }: Props) {
  const [step, setStep] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<StripeSummary | null>(null);
  const hasEnvKey = false; // server-side check — always show input client-side

  const fmt = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n/1_000).toFixed(0)}k` : `$${n.toFixed(0)}`;

  async function connect() {
    if (!key.trim() && !hasEnvKey) { setError('Enter your Stripe secret key'); return; }
    setStep('loading'); setError('');
    try {
      const res = await fetch('/api/data/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: key.trim(), existingData: data }),
      });
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try { const e = await res.json(); msg = e.error ?? msg; } catch { /* ignore */ }
        setError(msg); setStep('error'); return;
      }
      const result = await res.json();
      if (result.data) {
        onDataUpdate(result.data);
        setSummary(result.summary);
        setStep('connected');
        onSuccess?.(`Stripe connected — ${result.summary.periodsImported} months of revenue imported`);
      } else {
        setError(result.error ?? 'Connection failed');
        setStep('error');
      }
    } catch {
      setError('Network error — check your connection');
      setStep('error');
    }
  }

  if (step === 'connected' && summary) return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'TTM Revenue', value: fmt(summary.ttmRevenue) },
          { label: 'MRR',        value: fmt(summary.mrr) },
          { label: 'Customers',  value: `${summary.customerCount}` },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2 text-center">
            <div className="text-[15px] font-bold text-slate-100 tabular-nums">{m.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-medium">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-emerald-400 font-medium">
          {summary.periodsImported} months · {summary.activeSubscriptions} active subscriptions
          {summary.recentlyChurned > 0 && ` · ${summary.recentlyChurned} churned (90d)`}
        </div>
        <button onClick={() => { setStep('idle'); setKey(''); setSummary(null); }}
          className="text-[11px] text-slate-500 hover:text-slate-300 font-medium transition-colors">
          Reconnect
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-500 leading-relaxed">
        Pulls 12 months of charges, active subscriptions, and customer data directly from your Stripe account.
        Use a <span className="text-slate-400 font-medium">Restricted Key</span> with read-only access to Charges, Customers, and Subscriptions.
      </div>
      <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg px-3 py-2.5">
        <div className="text-[10px] font-semibold text-slate-500 mb-1">How to get a restricted key</div>
        <div className="text-[11px] text-slate-500 leading-relaxed">
          Stripe Dashboard → Developers → API Keys → Create restricted key → enable read-only on Charges, Customers, Subscriptions.
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && connect()}
          placeholder="sk_live_… or sk_test_…"
          className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[12px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 font-mono"
        />
        <button
          onClick={connect}
          disabled={step === 'loading' || (!key.trim())}
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap">
          {step === 'loading' ? <><Spinner/>Connecting…</> : 'Connect Stripe'}
        </button>
      </div>
      {(error || step === 'error') && (
        <div className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          {error || 'Connection failed'}
        </div>
      )}
      <div className="text-[10px] text-slate-700">
        Key is sent directly to your Vercel function and never stored. Use a restricted read-only key for safety.
      </div>
    </div>
  );
}

// ── Excel Connector ──────────────────────────────────────────────────────────
function ExcelConnector({ data, onDataUpdate, onSuccess }: Props) {
  const [step, setStep] = useState<ExcelStep>('idle');
  const [token, setToken] = useState('');
  const [files, setFiles] = useState<{ id: string; name: string; lastModifiedDateTime: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [dataType, setDataType] = useState<CSVUpload['type']>('revenue');
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');

  async function startOneDrive() {
    setLoading(true);
    try {
      const res = await fetch('/api/data/excel?action=auth-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) { setLoading(false); return; }
      const d = await res.json();
      setConfigured(d.configured !== false);
      if (!d.configured) { setLoading(false); return; }
      const popup = window.open(d.url, 'ms-oauth', 'width=500,height=600');
      const listener = async (e: MessageEvent) => {
        if (e.data?.type === 'ms-oauth-callback' && e.data.code) {
          window.removeEventListener('message', listener);
          popup?.close();
          try {
            const r = await fetch('/api/data/excel', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'callback', code: e.data.code }),
            });
            if (!r.ok) { setLoading(false); return; }
            const { tokens } = await r.json();
            setToken(tokens.access_token);
            const filesRes = await fetch('/api/data/excel', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'list-files', accessToken: tokens.access_token }),
            });
            if (!filesRes.ok) { setLoading(false); return; }
            const { files: f } = await filesRes.json();
            setFiles(f ?? []);
            setStep('select-file');
          } catch { /* OAuth flow failed */ }
          setLoading(false);
        }
      };
      window.addEventListener('message', listener);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function selectFile(id: string) {
    setSelectedFile(id);
    try {
      const r = await fetch('/api/data/excel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list-sheets', accessToken: token, fileId: id }),
      });
      if (!r.ok) return;
      const { sheets: s } = await r.json();
      setSheets(s ?? []);
    } catch { /* ignore */ }
    setStep('select-sheet');
  }

  async function importSheet() {
    if (!selectedSheet) return;
    setLoading(true);
    try {
      const r = await fetch('/api/data/excel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-sheet', accessToken: token, fileId: selectedFile, sheetName: selectedSheet, dataType, existingData: data }),
      });
      if (r.ok) {
        const result = await r.json();
        if (result.data) { onDataUpdate(result.data); setStep('connected'); onSuccess?.(`Excel data imported — ${result.rowCount ?? 0} rows`); }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: CSVUpload['type']) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus(`Processing ${file.name}…`);
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      const res = await fetch('/api/data/excel', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import-csv', csvContent: content, dataType: type, filename: file.name, existingData: data }),
      });
      const result = await res.json();
      if (result.data) {
        onDataUpdate(result.data);
        const msg = `${file.name} — ${result.rowCount ?? '?'} rows`;
        setUploadStatus(`✓ ${msg}`);
        onSuccess?.(msg);
      } else {
        setUploadStatus(`Error: ${result.error}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  if (step === 'connected') return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-emerald-400 font-medium">Synced from Excel Online</span>
      <button onClick={() => setStep('select-sheet')} className="text-[12px] text-slate-500 hover:text-slate-300 font-medium">Import another</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-semibold text-slate-500 mb-2">Option A — Excel Online / OneDrive (live sync)</div>
        {configured === false && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-[12px] text-amber-400 mb-2">
            Add <code className="bg-slate-800 px-1 rounded">MICROSOFT_CLIENT_ID</code> + <code className="bg-slate-800 px-1 rounded">MICROSOFT_CLIENT_SECRET</code> to enable.
          </div>
        )}
        {step === 'idle' && (
          <button onClick={startOneDrive} disabled={loading}
            className="w-full py-2.5 border border-slate-700 hover:border-slate-500 rounded-lg text-[13px] text-slate-300 hover:text-slate-100 transition-all disabled:opacity-40 flex items-center justify-center gap-2 font-medium">
            {loading ? <><Spinner/>Connecting…</> : '→ Connect OneDrive / Excel Online'}
          </button>
        )}
        {step === 'select-file' && (
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {files.map(f => (
              <button key={f.id} onClick={() => selectFile(f.id)}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 transition-all">
                <div className="text-[13px] text-slate-100 font-medium">{f.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Modified {new Date(f.lastModifiedDateTime).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        )}
        {step === 'select-sheet' && (
          <div className="space-y-2">
            <select value={selectedSheet} onChange={e => setSelectedSheet(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[12px] text-slate-200 focus:outline-none">
              <option value="">Select worksheet…</option>
              {sheets.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={dataType} onChange={e => setDataType(e.target.value as CSVUpload['type'])}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-1.5 text-[12px] text-slate-200 focus:outline-none">
              {UPLOAD_CATEGORIES.map(c => <option key={c.type} value={c.type}>{c.label}</option>)}
            </select>
            <button onClick={importSheet} disabled={loading || !selectedSheet}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2">
              {loading ? <><Spinner/>Importing…</> : 'Import from Excel'}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-slate-800/60 pt-4">
        <div className="text-[11px] font-semibold text-slate-500 mb-2">Option B — Upload local file</div>
        <div className="grid grid-cols-2 gap-2">
          {UPLOAD_CATEGORIES.map(cat => (
            <label key={cat.type} className="cursor-pointer">
              <span className="flex items-center gap-2 text-[12px] font-medium text-slate-400 hover:text-slate-100 border border-slate-700/60 hover:border-slate-500 px-3 py-2 rounded-lg transition-all">
                <span>{cat.emoji}</span>{cat.label}
              </span>
              <input type="file" accept=".csv,.xlsx,.xls,.tsv" className="hidden" onChange={e => handleFileUpload(e, cat.type)}/>
            </label>
          ))}
        </div>
        {uploadStatus && (
          <div className={`mt-2 text-[12px] px-3 py-2 rounded-lg border font-medium ${
            uploadStatus.startsWith('✓') ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20' :
            uploadStatus.startsWith('Error') ? 'text-red-400 bg-red-500/5 border-red-500/20' :
            'text-slate-400 bg-slate-800/60 border-slate-700/50'
          }`}>{uploadStatus}</div>
        )}
      </div>
    </div>
  );
}

// ── Integration category definitions ─────────────────────────────────────────
const INTEGRATION_CATEGORIES = [
  {
    title: 'Accounting & ERP',
    emoji: '📊',
    accentClass: 'bg-green-500/10 border-green-500/25',
    borderClass: 'border-green-500/15',
    description: 'P&L, balance sheet, AP/AR, and general ledger',
    exportTip: 'QuickBooks: Reports → Profit & Loss → Export to CSV. Xero: Accounting → Reports → P&L. FreshBooks: Reports → Export.',
    connectors: [
      { name: 'QuickBooks Online', tag: 'OAuth', tagColor: 'green' },
      { name: 'QuickBooks Desktop', tag: 'CSV', tagColor: 'blue' },
      { name: 'Xero', tag: 'OAuth', tagColor: 'green' },
      { name: 'FreshBooks', tag: 'OAuth', tagColor: 'green' },
      { name: 'Wave Accounting', tag: 'CSV', tagColor: 'blue' },
      { name: 'Sage Intacct', tag: 'API', tagColor: 'violet' },
      { name: 'Sage 50', tag: 'CSV', tagColor: 'blue' },
      { name: 'NetSuite (Oracle)', tag: 'API', tagColor: 'violet' },
      { name: 'SAP Business One', tag: 'API', tagColor: 'violet' },
      { name: 'Microsoft Dynamics', tag: 'API', tagColor: 'violet' },
      { name: 'Zoho Books', tag: 'OAuth', tagColor: 'green' },
      { name: 'Bench Accounting', tag: 'CSV', tagColor: 'blue' },
    ] as MiniConnector[],
  },
  {
    title: 'CRM & Sales',
    emoji: '🎯',
    accentClass: 'bg-sky-500/10 border-sky-500/25',
    borderClass: 'border-sky-500/15',
    description: 'Pipeline, contacts, deals, and bookings data',
    exportTip: 'Salesforce: Reports → New Report → Opportunities → Export. HubSpot: CRM → Deals → Export. Pipedrive: Deals → Export to spreadsheet.',
    connectors: [
      { name: 'Salesforce', tag: 'OAuth', tagColor: 'green' },
      { name: 'HubSpot', tag: 'OAuth', tagColor: 'green' },
      { name: 'Pipedrive', tag: 'API', tagColor: 'violet' },
      { name: 'Zoho CRM', tag: 'OAuth', tagColor: 'green' },
      { name: 'Close CRM', tag: 'API', tagColor: 'violet' },
      { name: 'Monday.com CRM', tag: 'API', tagColor: 'violet' },
      { name: 'Copper', tag: 'API', tagColor: 'violet' },
      { name: 'Freshsales', tag: 'API', tagColor: 'violet' },
      { name: 'ActiveCampaign', tag: 'API', tagColor: 'violet' },
      { name: 'Keap (Infusionsoft)', tag: 'CSV', tagColor: 'blue' },
    ] as MiniConnector[],
  },
  {
    title: 'Payments & Revenue',
    emoji: '💳',
    accentClass: 'bg-violet-500/10 border-violet-500/25',
    borderClass: 'border-violet-500/15',
    description: 'Transaction volume, MRR, churn, and subscription metrics',
    exportTip: 'Stripe: Dashboard → Revenue → Export CSV. Square: Analytics → Sales → Export. PayPal: Activity → Statements → Download.',
    connectors: [
      { name: 'Stripe', tag: 'API', tagColor: 'violet' },
      { name: 'Square', tag: 'API', tagColor: 'violet' },
      { name: 'PayPal', tag: 'API', tagColor: 'violet' },
      { name: 'Braintree', tag: 'API', tagColor: 'violet' },
      { name: 'Recurly', tag: 'API', tagColor: 'violet' },
      { name: 'Chargebee', tag: 'API', tagColor: 'violet' },
      { name: 'Paddle', tag: 'API', tagColor: 'violet' },
      { name: 'Authorize.net', tag: 'CSV', tagColor: 'blue' },
      { name: 'Clover', tag: 'CSV', tagColor: 'blue' },
      { name: 'Toast POS', tag: 'CSV', tagColor: 'blue' },
    ] as MiniConnector[],
  },
  {
    title: 'E-Commerce & Retail',
    emoji: '🛍️',
    accentClass: 'bg-emerald-500/10 border-emerald-500/25',
    borderClass: 'border-emerald-500/15',
    description: 'Orders, GMV, SKU performance, and customer LTV',
    exportTip: 'Shopify: Analytics → Reports → Export. WooCommerce: WooCommerce → Reports → Orders → Export CSV. Amazon Seller: Reports → Business Reports.',
    connectors: [
      { name: 'Shopify', tag: 'API', tagColor: 'violet' },
      { name: 'WooCommerce', tag: 'API', tagColor: 'violet' },
      { name: 'BigCommerce', tag: 'API', tagColor: 'violet' },
      { name: 'Amazon Seller Central', tag: 'CSV', tagColor: 'blue' },
      { name: 'Etsy', tag: 'API', tagColor: 'violet' },
      { name: 'eBay', tag: 'API', tagColor: 'violet' },
      { name: 'Wix Commerce', tag: 'CSV', tagColor: 'blue' },
      { name: 'Squarespace Commerce', tag: 'CSV', tagColor: 'blue' },
      { name: 'Lightspeed', tag: 'API', tagColor: 'violet' },
      { name: 'Magento / Adobe Commerce', tag: 'CSV', tagColor: 'blue' },
    ] as MiniConnector[],
  },
  {
    title: 'HR, Payroll & Benefits',
    emoji: '🏢',
    accentClass: 'bg-pink-500/10 border-pink-500/25',
    borderClass: 'border-pink-500/15',
    description: 'Headcount, compensation, org structure, and benefits cost',
    exportTip: 'Gusto: People → Team → Export. ADP: Reports → Payroll Summary → Export. Rippling: HR → Reports → Headcount Export.',
    connectors: [
      { name: 'Gusto', tag: 'API', tagColor: 'violet' },
      { name: 'ADP Workforce Now', tag: 'CSV', tagColor: 'blue' },
      { name: 'ADP Run', tag: 'CSV', tagColor: 'blue' },
      { name: 'Rippling', tag: 'API', tagColor: 'violet' },
      { name: 'Paychex', tag: 'CSV', tagColor: 'blue' },
      { name: 'BambooHR', tag: 'API', tagColor: 'violet' },
      { name: 'Workday', tag: 'API', tagColor: 'violet' },
      { name: 'Namely', tag: 'API', tagColor: 'violet' },
      { name: 'Justworks', tag: 'CSV', tagColor: 'blue' },
      { name: 'TriNet', tag: 'CSV', tagColor: 'blue' },
      { name: 'Lattice', tag: 'CSV', tagColor: 'blue' },
      { name: 'Deel (contractors)', tag: 'CSV', tagColor: 'blue' },
    ] as MiniConnector[],
  },
  {
    title: 'Banking & Cash',
    emoji: '🏦',
    accentClass: 'bg-amber-500/10 border-amber-500/25',
    borderClass: 'border-amber-500/15',
    description: 'Bank balances, transactions, and cash position',
    exportTip: 'Most banks: Accounts → Download Transactions → CSV / OFX format. Mercury: Transactions → Export. Plaid links most US banks automatically.',
    connectors: [
      { name: 'Plaid (bank feed)', tag: 'API', tagColor: 'violet' },
      { name: 'Mercury', tag: 'API', tagColor: 'violet' },
      { name: 'Brex', tag: 'API', tagColor: 'violet' },
      { name: 'Ramp', tag: 'API', tagColor: 'violet' },
      { name: 'Chase Business', tag: 'CSV', tagColor: 'blue' },
      { name: 'Bank of America', tag: 'CSV', tagColor: 'blue' },
      { name: 'Wells Fargo', tag: 'CSV', tagColor: 'blue' },
      { name: 'Silicon Valley Bank', tag: 'CSV', tagColor: 'blue' },
      { name: 'First Republic', tag: 'CSV', tagColor: 'blue' },
      { name: 'Kabbage / American Express', tag: 'CSV', tagColor: 'blue' },
    ] as MiniConnector[],
  },
  {
    title: 'Project Management & Ops',
    emoji: '📋',
    accentClass: 'bg-cyan-500/10 border-cyan-500/25',
    borderClass: 'border-cyan-500/15',
    description: 'Project status, utilization, time tracking, and delivery metrics',
    exportTip: 'Jira: Reports → Export. Asana: My Tasks → Export CSV. Monday: Board → Export. ClickUp: Export to Excel/CSV from any view.',
    connectors: [
      { name: 'Jira', tag: 'API', tagColor: 'violet' },
      { name: 'Asana', tag: 'API', tagColor: 'violet' },
      { name: 'Monday.com', tag: 'API', tagColor: 'violet' },
      { name: 'ClickUp', tag: 'API', tagColor: 'violet' },
      { name: 'Linear', tag: 'API', tagColor: 'violet' },
      { name: 'Basecamp', tag: 'CSV', tagColor: 'blue' },
      { name: 'Trello', tag: 'CSV', tagColor: 'blue' },
      { name: 'Smartsheet', tag: 'API', tagColor: 'violet' },
      { name: 'Harvest (time tracking)', tag: 'API', tagColor: 'violet' },
      { name: 'Toggl Track', tag: 'API', tagColor: 'violet' },
      { name: 'Teamwork', tag: 'API', tagColor: 'violet' },
      { name: 'Wrike', tag: 'API', tagColor: 'violet' },
    ] as MiniConnector[],
  },
  {
    title: 'Analytics & Business Intelligence',
    emoji: '📈',
    accentClass: 'bg-indigo-500/10 border-indigo-500/25',
    borderClass: 'border-indigo-500/15',
    description: 'Web traffic, product metrics, and custom BI dashboards',
    exportTip: 'Google Analytics: Explore → Export → CSV. Mixpanel: Insights → Export. Amplitude: Charts → Download CSV. Looker: Explore → Download.',
    connectors: [
      { name: 'Google Analytics 4', tag: 'API', tagColor: 'violet' },
      { name: 'Mixpanel', tag: 'API', tagColor: 'violet' },
      { name: 'Amplitude', tag: 'API', tagColor: 'violet' },
      { name: 'Looker / Google Looker Studio', tag: 'CSV', tagColor: 'blue' },
      { name: 'Power BI', tag: 'CSV', tagColor: 'blue' },
      { name: 'Tableau', tag: 'CSV', tagColor: 'blue' },
      { name: 'Domo', tag: 'API', tagColor: 'violet' },
      { name: 'Metabase', tag: 'CSV', tagColor: 'blue' },
      { name: 'Chartmogul (SaaS metrics)', tag: 'API', tagColor: 'violet' },
      { name: 'Baremetrics', tag: 'API', tagColor: 'violet' },
    ] as MiniConnector[],
  },
  {
    title: 'Customer Success & Support',
    emoji: '🎧',
    accentClass: 'bg-orange-500/10 border-orange-500/25',
    borderClass: 'border-orange-500/15',
    description: 'Ticket volume, NPS, churn signals, and CSAT',
    exportTip: 'Zendesk: Reports → Export. Intercom: Reports → Customer Data → Export. Freshdesk: Reports → Overview → Export.',
    connectors: [
      { name: 'Zendesk', tag: 'API', tagColor: 'violet' },
      { name: 'Intercom', tag: 'API', tagColor: 'violet' },
      { name: 'Freshdesk', tag: 'API', tagColor: 'violet' },
      { name: 'Help Scout', tag: 'API', tagColor: 'violet' },
      { name: 'Gorgias', tag: 'API', tagColor: 'violet' },
      { name: 'Front', tag: 'API', tagColor: 'violet' },
      { name: 'Delighted (NPS)', tag: 'API', tagColor: 'violet' },
      { name: 'Gainsight', tag: 'CSV', tagColor: 'blue' },
      { name: 'ChurnZero', tag: 'CSV', tagColor: 'blue' },
      { name: 'Totango', tag: 'CSV', tagColor: 'blue' },
    ] as MiniConnector[],
  },
  {
    title: 'Marketing & Advertising',
    emoji: '📣',
    accentClass: 'bg-rose-500/10 border-rose-500/25',
    borderClass: 'border-rose-500/15',
    description: 'CAC, campaign performance, and marketing spend attribution',
    exportTip: 'Google Ads: Reports → Download. Meta Ads: Ads Manager → Export. Mailchimp: Campaigns → Export. LinkedIn Ads: Campaign Manager → Export.',
    connectors: [
      { name: 'Google Ads', tag: 'API', tagColor: 'violet' },
      { name: 'Meta / Facebook Ads', tag: 'API', tagColor: 'violet' },
      { name: 'LinkedIn Ads', tag: 'CSV', tagColor: 'blue' },
      { name: 'Mailchimp', tag: 'API', tagColor: 'violet' },
      { name: 'Klaviyo', tag: 'API', tagColor: 'violet' },
      { name: 'HubSpot Marketing', tag: 'OAuth', tagColor: 'green' },
      { name: 'Marketo', tag: 'API', tagColor: 'violet' },
      { name: 'Pardot', tag: 'API', tagColor: 'violet' },
      { name: 'Outreach', tag: 'API', tagColor: 'violet' },
      { name: 'Apollo.io', tag: 'CSV', tagColor: 'blue' },
    ] as MiniConnector[],
  },
];

const INDUSTRIES = [
  { id: 'professional-services', label: 'Professional Services' },
  { id: 'saas-technology',       label: 'SaaS / Technology' },
  { id: 'manufacturing',         label: 'Manufacturing' },
  { id: 'distribution',          label: 'Distribution / Wholesale' },
  { id: 'healthcare',            label: 'Healthcare Services' },
  { id: 'construction',          label: 'Construction / Trades' },
  { id: 'financial-services',    label: 'Financial Services' },
  { id: 'retail',                label: 'Retail / E-commerce' },
  { id: 'other',                 label: 'Other' },
] as const;

const REVENUE_MODELS = [
  { id: 'recurring',  label: 'Recurring / Subscription' },
  { id: 'project',    label: 'Project / Time & Materials' },
  { id: 'transactional', label: 'Transactional / Product Sales' },
  { id: 'mixed',      label: 'Mixed' },
] as const;

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function DataSourcePanel({ data, onDataUpdate, onSuccess, companyProfile, onProfileChange }: Props) {
  const completeness     = Math.round(data.metadata.completeness * 100);
  const isDemo           = data.metadata.sources.includes('Demo Data');
  const connectedSources = data.metadata.sources.filter(s => s !== 'Demo Data');

  const completenessItems = [
    { label: 'Revenue & P&L',       done: data.revenue.total > 0 && data.revenue.byPeriod.length > 0 },
    { label: 'Cost structure',      done: data.costs.totalCOGS > 0 || data.costs.totalOpEx > 0 },
    { label: 'Customer list',       done: data.customers.totalCount > 0 },
    { label: 'Headcount data',      done: !!data.operations.headcount },
    { label: 'Sales pipeline',      done: !!data.operations.projectCount },
    { label: 'Cash flow / AR',      done: false },
  ];

  const completedCount = completenessItems.filter(i => i.done).length;

  return (
    <div className="max-w-3xl space-y-6">

      {/* Company Profile */}
      {onProfileChange && (
        <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5">
          <div className="text-[12px] font-semibold text-slate-300 mb-3">Company Profile</div>
          <div className="text-[11px] text-slate-500 mb-4 leading-relaxed">
            Industry and revenue model are used to benchmark your metrics against peers and improve AI analysis accuracy.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Industry</label>
              <select
                value={companyProfile?.industry ?? ''}
                onChange={e => onProfileChange({ ...(companyProfile ?? {}), industry: e.target.value || undefined })}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors">
                <option value="">Select industry…</option>
                {INDUSTRIES.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Revenue Model</label>
              <select
                value={companyProfile?.revenueModel ?? ''}
                onChange={e => onProfileChange({ ...(companyProfile ?? {}), revenueModel: e.target.value || undefined })}
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-[13px] text-slate-100 focus:outline-none focus:border-indigo-500/50 transition-colors">
                <option value="">Select model…</option>
                {REVENUE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {(companyProfile?.industry || companyProfile?.revenueModel) && (
            <div className="flex items-center gap-1.5 mt-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"/>
              <span className="text-[11px] text-emerald-400/80 font-medium">Profile saved — AI will use this context for analysis</span>
            </div>
          )}
        </div>
      )}

      {/* Quick-start guide (demo only) */}
      {isDemo && (
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-[12px] font-bold flex-shrink-0">1</div>
            <div className="text-[13px] font-semibold text-slate-100">Start here — 3 uploads unlock 90% of features</div>
          </div>
          <div className="space-y-3">
            {[
              {
                step: '1', time: '2 min', icon: '📈', label: 'Revenue / P&L',
                desc: 'Monthly revenue + COGS unlocks KPI grid, trend signals, health score, and AI analysis.',
                type: 'revenue' as const,
                tip: 'QuickBooks: Reports → P&L → Export CSV · Xero: Accounting → Reports · Excel: your monthly revenue sheet',
              },
              {
                step: '2', time: '1 min', icon: '👥', label: 'Customer List',
                desc: 'Customer names + revenue unlocks concentration risk, retention analysis, and customer dashboard.',
                type: 'customers' as const,
                tip: 'CRM export or spreadsheet: Customer Name, Revenue, Status (active/churned)',
              },
              {
                step: '3', time: '2 min', icon: '🏦', label: 'Cash Flow',
                desc: 'Monthly cash balances unlock runway calculator, burn rate analysis, and scenario modeling.',
                type: 'cashflow' as const,
                tip: 'Bank statement export or QuickBooks: Reports → Cash Flow Statement',
              },
            ].map((item, idx) => (
              <div key={item.step} className="flex items-start gap-3 bg-slate-800/30 border border-slate-700/40 rounded-xl p-3.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-[12px] font-bold text-indigo-400 flex-shrink-0 mt-0.5">{item.step}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[14px]">{item.icon}</span>
                    <span className="text-[13px] font-semibold text-slate-100">{item.label}</span>
                    <span className="text-[10px] text-slate-600 font-medium">{item.time}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed mb-1.5">{item.desc}</div>
                  <div className="text-[10px] text-slate-600 leading-relaxed font-medium">{item.tip}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <label className="cursor-pointer">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                      Upload CSV
                    </span>
                    <input type="file" accept=".csv,.tsv" className="hidden" onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const content = await new Promise<string>(resolve => {
                        const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsText(file);
                      });
                      const res = await fetch('/api/data/csv', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ uploads: [{ type: item.type, filename: file.name, content }], existingData: data }),
                      });
                      if (!res.ok) { e.target.value = ''; return; }
                      const result = await res.json();
                      if (result.data) { onDataUpdate(result.data); onSuccess?.(`${item.label} imported — ${result.results?.[0]?.rowCount ?? '?'} rows`); }
                      e.target.value = '';
                    }}/>
                  </label>
                  <button onClick={() => downloadTemplate(item.type)}
                    className="text-[10px] text-slate-600 hover:text-slate-400 font-medium transition-colors whitespace-nowrap">
                    ↓ template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress banner */}
      <div className={`border rounded-xl p-5 ${isDemo
        ? 'bg-gradient-to-br from-indigo-500/8 to-transparent border-indigo-500/15'
        : 'bg-slate-900/50 border-slate-800/50'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[14px] font-semibold text-slate-100">
              {isDemo ? 'Connect your data — replace demo numbers' : 'Data Coverage'}
            </div>
            <div className="text-[12px] text-slate-400 mt-0.5 leading-relaxed max-w-lg">
              {isDemo
                ? 'Upload CSV exports from your accounting system, CRM, or payroll platform. Most clients are live in under 10 minutes.'
                : `${connectedSources.join(', ')} · Last updated ${new Date(data.metadata.asOf).toLocaleDateString()}`
              }
            </div>
          </div>
          {isDemo && (
            <span className="text-[10px] font-semibold text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full whitespace-nowrap">Demo mode</span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${(completedCount / completenessItems.length) * 100}%`,
              background: completedCount >= 5 ? '#10b981' : completedCount >= 3 ? '#f59e0b' : '#6366f1',
            }}/>
          </div>
          <span className="text-[12px] font-semibold text-slate-300 flex-shrink-0">{completedCount}/{completenessItems.length} complete</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {completenessItems.map(item => (
            <div key={item.label} className={`flex items-center gap-1.5 text-[11px] ${item.done ? 'text-emerald-400/80' : 'text-slate-600'}`}>
              <span className={`text-[10px] font-bold ${item.done ? 'text-emerald-400' : 'text-slate-700'}`}>{item.done ? '✓' : '○'}</span>
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Section: Live Integrations */}
      <div>
        <SL>Live Integrations — Ready Now</SL>
        <div className="space-y-2">
          <ConnectorCard
            icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm1 3h10v1H5V6zm0 3h10v1H5V9zm0 3h7v1H5v-1z"/></svg>}
            accentColor="bg-emerald-500/10 border-emerald-500/25"
            name="Google Sheets" desc="Import P&L, costs, and customer data from any Google Sheet — manual or formula-driven"
            badge="OAuth"
            statusBadge={data.metadata.sources.includes('Google Sheets') ? <ConnectedBadge/> : <NativeBadge/>}>
            <GoogleSheetsConnector data={data} onDataUpdate={onDataUpdate} onSuccess={onSuccess}/>
          </ConnectorCard>

          <ConnectorCard
            icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-400"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm2 3h8v2H6V6zm0 4h8v2H6v-2zm0 4h5v1H6v-1z"/></svg>}
            accentColor="bg-blue-500/10 border-blue-500/25"
            name="Microsoft Excel / OneDrive" desc="Live sync from Excel Online, or upload any .xlsx / .csv file directly"
            badge="OAuth"
            statusBadge={data.metadata.sources.some(s => s.startsWith('Excel')) ? <ConnectedBadge/> : <NativeBadge/>}>
            <ExcelConnector data={data} onDataUpdate={onDataUpdate} onSuccess={onSuccess}/>
          </ConnectorCard>

          <ConnectorCard
            icon={
              <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm.92 11.42c-.24.08-.44.14-.62.18-.18.04-.38.06-.6.06-.56 0-.98-.13-1.26-.39-.28-.26-.42-.65-.42-1.17 0-.19.02-.39.06-.6.04-.21.1-.44.17-.7l.59-2.07c.07-.26.13-.5.17-.72.04-.22.06-.42.06-.6 0-.32-.07-.55-.2-.67-.13-.12-.38-.18-.74-.18-.18 0-.37.03-.56.08-.19.05-.36.1-.5.15l.19-.77c.2-.07.39-.14.56-.19.18-.05.34-.08.5-.08.55 0 .97.13 1.24.4.27.27.41.65.41 1.16 0 .1-.01.29-.04.56-.03.27-.09.52-.18.77l-.59 2.06c-.06.22-.12.46-.16.71-.04.25-.06.44-.06.56 0 .34.08.57.23.69.15.12.4.18.76.18.17 0 .36-.03.57-.08.21-.05.37-.1.47-.14l-.19.77zm-.13-8.17c-.27.25-.6.37-.97.37-.37 0-.7-.12-.97-.37-.27-.25-.41-.55-.41-.9s.14-.65.41-.9c.27-.25.6-.37.97-.37.37 0 .7.12.97.37.27.25.41.55.41.9s-.14.65-.41.9z" fill="#6366f1"/>
              </svg>
            }
            accentColor="bg-violet-500/10 border-violet-500/25"
            name="Stripe" desc="Live revenue from charges, subscriptions, MRR/ARR, and customer data — 12-month history"
            badge="API Key"
            statusBadge={data.metadata.sources.includes('Stripe') ? <ConnectedBadge/> : <NativeBadge/>}>
            <StripeConnector data={data} onDataUpdate={onDataUpdate} onSuccess={onSuccess}/>
          </ConnectorCard>
        </div>
      </div>

      {/* Section: Software Ecosystem */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SL>Connect by Software Category</SL>
          <span className="text-[11px] text-slate-600 -mt-3">100+ systems · expand any category</span>
        </div>
        <div className="space-y-2">
          {INTEGRATION_CATEGORIES.map(cat => (
            <CategorySection key={cat.title} {...cat}/>
          ))}
        </div>
      </div>

      {/* Section: CSV Upload */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SL>Manual Upload — All Data Categories</SL>
          <span className="text-[11px] text-slate-500 -mt-3">Export CSV from any system and upload here</span>
        </div>
        <CSVUploadSection data={data} onDataUpdate={onDataUpdate} onSuccess={onSuccess}/>
      </div>

      {/* Footer: legend */}
      <div className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-4">
        <div className="text-[11px] font-semibold text-slate-500 mb-2.5">Connection Types</div>
        <div className="flex flex-wrap gap-3 text-[11px]">
          {[
            { tag: 'Live', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', desc: 'Native live integration available now' },
            { tag: 'OAuth', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', desc: 'One-click auth, auto-sync' },
            { tag: 'API', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20', desc: 'API key, in development' },
            { tag: 'CSV', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', desc: 'Upload CSV export today' },
          ].map(({ tag, color, desc }) => (
            <div key={tag} className="flex items-center gap-1.5">
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${color}`}>{tag}</span>
              <span className="text-slate-600">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
