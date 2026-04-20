import { useState, useMemo } from 'react';
import type { Transaction } from '../../types';

interface Props {
  transactions: Transaction[];
  onAskAI?: (msg: string) => void;
}

const fmt = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `$${(Math.abs(n) / 1_000_000).toFixed(2)}M` :
  Math.abs(n) >= 1_000     ? `$${(Math.abs(n) / 1_000).toFixed(1)}k` :
  `$${Math.abs(n).toFixed(2)}`;

type SortKey = 'date' | 'amount' | 'category' | 'description';
type SortDir = 'asc' | 'desc';

const TYPE_COLORS: Record<string, string> = {
  revenue:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  expense:  'bg-red-500/15 text-red-400 border-red-500/25',
  transfer: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  other:    'bg-slate-700/60 text-slate-400 border-slate-700/50',
};

export default function TransactionLedger({ transactions, onAskAI }: Props) {
  const [search,    setSearch]    = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [sortKey,   setSortKey]   = useState<SortKey>('date');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');
  const [page,      setPage]      = useState(0);
  const PAGE_SIZE = 25;

  const categories = useMemo(() =>
    ['all', ...Array.from(new Set(transactions.map(t => t.category))).sort()],
    [transactions]
  );

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.customer ?? '').toLowerCase().includes(q) ||
        (t.vendor ?? '').toLowerCase().includes(q) ||
        (t.invoiceId ?? '').toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter);
    if (catFilter  !== 'all') list = list.filter(t => t.category === catFilter);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date')        cmp = a.date.localeCompare(b.date);
      else if (sortKey === 'amount') cmp = Math.abs(a.amount) - Math.abs(b.amount);
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category);
      else                           cmp = a.description.localeCompare(b.description);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [transactions, search, typeFilter, catFilter, sortKey, sortDir]);

  const pageCount  = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalIn    = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut   = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const net        = totalIn - totalOut;

  const sort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <svg viewBox="0 0 8 10" fill="currentColor" className={`w-2 h-2.5 ml-0.5 inline-block ${sortKey === k ? 'text-slate-300' : 'text-slate-700'}`}>
      {sortDir === 'asc' || sortKey !== k
        ? <path d="M4 1L7 5H1L4 1z" opacity={sortKey === k && sortDir === 'desc' ? 0.3 : 1}/>
        : null}
      {sortDir === 'desc' || sortKey !== k
        ? <path d="M4 9L1 5h6L4 9z" opacity={sortKey === k && sortDir === 'asc' ? 0.3 : 1}/>
        : null}
    </svg>
  );

  if (!transactions.length) {
    return (
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-5 flex flex-col items-center justify-center h-[200px] text-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center mb-1">
          <svg viewBox="0 0 14 14" fill="currentColor" className="w-4 h-4 text-slate-600">
            <path d="M1 2h12v2H1V2zm0 3h12v1H1V5zm0 2h8v1H1V7zm0 2h6v1H1V9zm0 2h4v1H1v-1z"/>
          </svg>
        </div>
        <div className="text-[12px] font-semibold text-slate-500">No transactions yet</div>
        <div className="text-[11px] text-slate-700 max-w-[200px] leading-relaxed">
          Upload a transaction CSV to see your ledger with full search and filtering
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800/50">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <div className="text-[13px] font-semibold text-slate-100">Transaction Ledger</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{transactions.length.toLocaleString()} transactions</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                const header = 'Date,Description,Amount,Type,Category,Customer,Vendor,Invoice\n';
                const rows = filtered.map(t =>
                  [t.date, `"${t.description.replace(/"/g, '""')}"`, t.amount, t.type,
                   `"${t.category}"`, t.customer ?? '', t.vendor ?? '', t.invoiceId ?? ''].join(',')
                ).join('\n');
                const blob = new Blob([header + rows], { type: 'text/csv' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url; a.download = 'transactions.csv'; a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 border border-slate-700/50 hover:border-slate-600 px-2.5 py-1 rounded-lg transition-all font-medium"
              title="Download filtered transactions as CSV"
            >
              <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3"><path d="M7 1v8M4 6l3 3 3-3M2 11h10v2H2v-2z"/></svg>
              Export
            </button>
            {onAskAI && (
              <button
                onClick={() => onAskAI(
                  `My transaction ledger has ${transactions.length} transactions. ` +
                  `Total inflows: ${fmt(totalIn)}, outflows: ${fmt(totalOut)}, net: ${net >= 0 ? '+' : ''}${fmt(net)}. ` +
                  `What patterns or anomalies should I be aware of?`
                )}
                className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/50 px-2.5 py-1 rounded-lg transition-all font-medium"
              >
                <svg viewBox="0 0 14 14" fill="currentColor" className="w-3 h-3">
                  <path d="M7 1a5 5 0 015 5 5 5 0 01-3.5 4.75V12H5.5v-1.25A5 5 0 012 6a5 5 0 015-5z"/>
                  <rect x="5.5" y="12.5" width="3" height="1" rx="0.5"/>
                </svg>
                Ask AI
              </button>
            )}
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { label: 'Total Inflows',  value: fmt(totalIn),  color: 'text-emerald-400' },
            { label: 'Total Outflows', value: fmt(totalOut), color: 'text-red-400' },
            { label: 'Net',            value: `${net >= 0 ? '+' : '−'}${fmt(net)}`, color: net >= 0 ? 'text-emerald-400' : 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/40 rounded-lg px-3 py-2">
              <div className="text-[10px] text-slate-600 font-semibold uppercase tracking-[0.08em] mb-0.5">{s.label}</div>
              <div className={`text-[14px] font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        {(() => {
          const byCategory = Object.entries(
            transactions.reduce<Record<string, { in: number; out: number }>>((acc, t) => {
              if (!acc[t.category]) acc[t.category] = { in: 0, out: 0 };
              if (t.amount > 0) acc[t.category].in += t.amount;
              else acc[t.category].out += Math.abs(t.amount);
              return acc;
            }, {})
          )
            .map(([cat, v]) => ({ cat, total: v.in + v.out, net: v.in - v.out, inflow: v.in, outflow: v.out }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8);
          const maxTotal = Math.max(...byCategory.map(c => c.total), 1);
          return (
            <div className="mb-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">By Category</div>
              <div className="space-y-1.5">
                {byCategory.map(c => (
                  <button
                    key={c.cat}
                    onClick={() => { setCatFilter(c.cat === catFilter ? 'all' : c.cat); setPage(0); }}
                    className={`w-full flex items-center gap-2.5 text-left group transition-all rounded-lg px-2 py-1 ${catFilter === c.cat ? 'bg-indigo-500/10' : 'hover:bg-slate-800/40'}`}
                  >
                    <div className="text-[11px] font-medium text-slate-400 truncate w-28 flex-shrink-0">{c.cat}</div>
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${c.net >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                        style={{ width: `${(c.total / maxTotal) * 100}%` }}
                      />
                    </div>
                    <div className={`text-[11px] font-semibold tabular-nums flex-shrink-0 w-16 text-right ${c.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {c.net >= 0 ? '+' : '−'}{fmt(c.net)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Top 5 Largest Transactions */}
        {(() => {
          const top5 = [...transactions]
            .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
            .slice(0, 5);
          return (
            <div className="mb-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">5 Largest Transactions</div>
              <div className="space-y-1">
                {top5.map((t, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[11px] group cursor-pointer hover:bg-slate-800/30 rounded-lg px-1.5 py-0.5 -mx-1.5 transition-colors"
                    onClick={() => { setSearch(t.description.slice(0, 20)); setPage(0); }}>
                    <span className="w-4 text-[10px] font-bold text-slate-700 flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 text-slate-400 truncate">{t.description}</span>
                    <span className="text-slate-600 flex-shrink-0">{t.date}</span>
                    <span className={`font-semibold tabular-nums flex-shrink-0 w-14 text-right ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {t.amount >= 0 ? '+' : '−'}{fmt(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search description, customer, invoice…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="flex-1 min-w-[160px] bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
          />
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
            className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-300 focus:outline-none focus:border-indigo-500/50"
          >
            <option value="all">All types</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
            <option value="other">Other</option>
          </select>
          <select
            value={catFilter}
            onChange={e => { setCatFilter(e.target.value); setPage(0); }}
            className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-300 focus:outline-none focus:border-indigo-500/50"
          >
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </select>
          {(search || typeFilter !== 'all' || catFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('all'); setCatFilter('all'); setPage(0); }}
              className="text-[11px] text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
          {filtered.length !== transactions.length && (
            <span className="text-[11px] text-slate-500">{filtered.length.toLocaleString()} matches</span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-800/50 bg-[#060a12]/95 backdrop-blur-sm">
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => sort('date')} className="flex items-center text-[10px] font-semibold text-slate-500 hover:text-slate-300 uppercase tracking-[0.08em]">
                  Date <SortIcon k="date"/>
                </button>
              </th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => sort('description')} className="flex items-center text-[10px] font-semibold text-slate-500 hover:text-slate-300 uppercase tracking-[0.08em]">
                  Description <SortIcon k="description"/>
                </button>
              </th>
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => sort('category')} className="flex items-center text-[10px] font-semibold text-slate-500 hover:text-slate-300 uppercase tracking-[0.08em]">
                  Category <SortIcon k="category"/>
                </button>
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Type</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-[0.08em]">Customer / Vendor</th>
              <th className="px-4 py-2.5 text-right">
                <button onClick={() => sort('amount')} className="flex items-center ml-auto text-[10px] font-semibold text-slate-500 hover:text-slate-300 uppercase tracking-[0.08em]">
                  Amount <SortIcon k="amount"/>
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {paginated.map((t, i) => (
              <tr key={i} className={`hover:bg-slate-800/30 transition-colors ${i % 2 === 1 ? 'bg-slate-900/20' : ''}`}>
                <td className="px-4 py-2.5 text-[12px] text-slate-400 whitespace-nowrap font-mono">{t.date}</td>
                <td className="px-4 py-2.5 text-[12px] text-slate-200 max-w-[220px]">
                  <div className="truncate">{t.description}</div>
                  {t.invoiceId && <div className="text-[10px] text-slate-600 mt-0.5">#{t.invoiceId}</div>}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-slate-400">{t.category}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${TYPE_COLORS[t.type] ?? TYPE_COLORS.other}`}>
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[12px] text-slate-500 max-w-[140px]">
                  <div className="truncate">{t.customer ?? t.vendor ?? '—'}</div>
                </td>
                <td className={`px-4 py-2.5 text-[13px] font-semibold text-right tabular-nums font-mono ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.amount >= 0 ? '+' : '−'}{fmt(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="px-5 py-3 border-t border-slate-800/40 flex items-center justify-between">
          <div className="text-[11px] text-slate-600">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors text-[12px]">
              ‹
            </button>
            {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
              const p = pageCount <= 7 ? i : page < 4 ? i : page > pageCount - 4 ? pageCount - 7 + i : page - 3 + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg border text-[11px] font-medium transition-colors ${
                    p === page
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-700'
                  }`}>{p + 1}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors text-[12px]">
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
