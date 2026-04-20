import { useEffect, useState } from 'react';
import Head from 'next/head';

// ── Minimal share payload (encoded in URL hash) ───────────────────────────────
interface SharePayload {
  v: 1;                    // version
  company: string;
  period: string;
  rev: number;
  cogs: number;
  opex: number;
  customers: number;
  newCust: number;
  churned: number;
  retention: number;
  headcount?: number;
  trend: { period: string; rev: number }[];
  topCustomers: { name: string; pct: number }[];
  sharedAt: string;
}

const fmt = (n: number) => {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M` : `$${Math.round(abs).toLocaleString('en-US')}`;
  return n < 0 ? `(${s})` : s;
};

const pct = (n: number, d: number) =>
  d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—';

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3">
      <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1">{label}</div>
      <div className={`text-[20px] font-bold tabular-nums ${accent ?? 'text-slate-100'}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function SharePage() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (!hash) { setError('No snapshot data found in this link.'); return; }
      const decoded = JSON.parse(atob(hash)) as SharePayload;
      if (decoded.v !== 1) { setError('Unrecognized snapshot format.'); return; }
      setPayload(decoded);
    } catch {
      setError('This link appears to be invalid or corrupted.');
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#060a12] text-slate-100 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-[40px] mb-4">⚠</div>
          <div className="text-[16px] font-bold text-slate-100 mb-2">Invalid snapshot link</div>
          <div className="text-[13px] text-slate-500">{error}</div>
          <a href="/" className="inline-block mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold rounded-xl transition-colors">
            Open Business OS →
          </a>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-[#060a12] flex items-center justify-center">
        <div className="text-slate-600 text-[13px]">Loading snapshot…</div>
      </div>
    );
  }

  const gp     = payload.rev - payload.cogs;
  const ebitda = gp - payload.opex;
  const gpMargin    = parseFloat(pct(gp, payload.rev));
  const ebitdaMargin = parseFloat(pct(ebitda, payload.rev));

  const ogTitle       = `${payload.company} · ${payload.period} Performance`;
  const ogDescription = `Revenue ${fmt(payload.rev)} · GP margin ${pct(gp, payload.rev)} · EBITDA ${pct(ebitda, payload.rev)} · ${payload.customers} customers`;

  return (
    <>
      <Head>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDescription}/>
        <meta name="robots" content="noindex, nofollow"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        {/* Open Graph */}
        <meta property="og:type"        content="website"/>
        <meta property="og:title"       content={ogTitle}/>
        <meta property="og:description" content={ogDescription}/>
        <meta property="og:site_name"   content="Business OS"/>
        {/* Twitter Card */}
        <meta name="twitter:card"        content="summary"/>
        <meta name="twitter:title"       content={ogTitle}/>
        <meta name="twitter:description" content={ogDescription}/>
      </Head>

      <div className="min-h-screen bg-[#060a12] text-slate-100">

        {/* Header */}
        <div className="border-b border-slate-800/60 bg-[#060a12]/95 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-[6px] bg-gradient-to-br from-indigo-400 to-indigo-700 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 12 12" fill="white" className="w-3.5 h-3.5">
                <rect x="1" y="1" width="4" height="4" rx="0.5"/>
                <rect x="7" y="1" width="4" height="4" rx="0.5"/>
                <rect x="1" y="7" width="4" height="4" rx="0.5"/>
                <rect x="7" y="7" width="4" height="4" rx="0.5"/>
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-bold text-slate-100">{payload.company}</div>
              <div className="text-[10px] text-slate-500">{payload.period} · read-only snapshot</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600">
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1a6 6 0 100 12A6 6 0 007 1zm0 2a4 4 0 110 8A4 4 0 017 3zm0 1.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/></svg>
              Shared {new Date(payload.sharedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <a href="/" className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold rounded-xl transition-colors">
              Open Business OS →
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* Read-only badge */}
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><rect x="4" y="1" width="6" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="6" width="12" height="7" rx="1.5"/><circle cx="7" cy="9.5" r="1"/></svg>
            Read-only view · data as of {payload.period}
          </div>

          {/* Core financial metrics */}
          <div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-3">Financial Overview</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Revenue"      value={fmt(payload.rev)}   accent="text-slate-100"/>
              <MetricCard label="Gross Profit" value={fmt(gp)}            sub={`${pct(gp, payload.rev)} margin`} accent={gpMargin >= 40 ? 'text-emerald-400' : gpMargin >= 25 ? 'text-amber-400' : 'text-red-400'}/>
              <MetricCard label="EBITDA"       value={fmt(ebitda)}        sub={`${pct(ebitda, payload.rev)} margin`} accent={ebitdaMargin >= 14 ? 'text-emerald-400' : ebitdaMargin >= 5 ? 'text-amber-400' : 'text-red-400'}/>
              <MetricCard label="OpEx"         value={fmt(payload.opex)}  sub={pct(payload.opex, payload.rev) + ' of revenue'}/>
            </div>
          </div>

          {/* Customer metrics */}
          <div>
            <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-3">Customer Health</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Total Customers" value={String(payload.customers)}/>
              <MetricCard label="New This Period"  value={`+${payload.newCust}`}  accent="text-emerald-400"/>
              <MetricCard label="Churned"          value={String(payload.churned)} accent={payload.churned > 0 ? 'text-red-400' : 'text-slate-100'}/>
              <MetricCard label="Retention"        value={`${(payload.retention * 100).toFixed(1)}%`} accent={payload.retention >= 0.92 ? 'text-emerald-400' : payload.retention >= 0.85 ? 'text-amber-400' : 'text-red-400'}/>
            </div>
          </div>

          {/* Revenue trend */}
          {payload.trend.length > 1 && (
            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-3">Revenue Trend</div>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
                <div className="flex items-end gap-2 h-16">
                  {payload.trend.map((p, i) => {
                    const maxRev = Math.max(...payload.trend.map(t => t.rev));
                    const h = maxRev > 0 ? Math.round((p.rev / maxRev) * 100) : 0;
                    const isLast = i === payload.trend.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-[9px] text-slate-600 tabular-nums">{fmt(p.rev)}</div>
                        <div
                          className={`w-full rounded-t-md transition-all ${isLast ? 'bg-indigo-500' : 'bg-slate-700/60'}`}
                          style={{ height: `${Math.max(h, 4)}%`, minHeight: '4px' }}
                        />
                        <div className="text-[9px] text-slate-600 truncate w-full text-center">{p.period}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Top customers */}
          {payload.topCustomers.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.1em] mb-3">Customer Concentration</div>
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl divide-y divide-slate-800/50">
                {payload.topCustomers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-[9px] font-bold text-slate-500">
                        {i + 1}
                      </div>
                      <span className="text-[12px] text-slate-300">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full ${c.pct > 20 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(c.pct, 100)}%` }}/>
                      </div>
                      <span className={`text-[11px] font-semibold tabular-nums w-10 text-right ${c.pct > 20 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {c.pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-700">
            <span>Generated by Business OS · {payload.company}</span>
            <a href="/" className="hover:text-slate-400 transition-colors">businessos.app →</a>
          </div>
        </div>
      </div>
    </>
  );
}
