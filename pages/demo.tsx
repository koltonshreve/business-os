import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

const periods = [
  { month: 'May', revenue: 2.31, margin: 35.8, ebitda: 0.32 },
  { month: 'Jun', revenue: 2.42, margin: 35.1, ebitda: 0.31 },
  { month: 'Jul', revenue: 2.48, margin: 34.2, ebitda: 0.29 },
  { month: 'Aug', revenue: 2.51, margin: 32.9, ebitda: 0.25 },
  { month: 'Sep', revenue: 2.57, margin: 31.7, ebitda: 0.22 },
  { month: 'Oct', revenue: 2.63, margin: 30.8, ebitda: 0.19 },
];

const workflow = [
  { id: 'detect', label: 'Detect', title: 'Gross margin declined 500 bps', detail: 'Revenue grew 14%, but freight, product mix, and discounting reduced contribution.', tone: 'text-rose-300 bg-rose-500/10 border-rose-500/20' },
  { id: 'diagnose', label: 'Diagnose', title: 'Two drivers explain 78% of the change', detail: 'West-region freight rose $96K and discount-heavy Product C gained 9 points of mix.', tone: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  { id: 'model', label: 'Model', title: 'Targeted intervention restores 240 bps', detail: 'A 3% price action on Product C plus freight minimums produces $63K monthly EBITDA upside.', tone: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
  { id: 'assign', label: 'Assign', title: 'Owners and deadlines are explicit', detail: 'Commercial owns price communication; operations owns carrier rebid; CFO validates realized margin.', tone: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
  { id: 'measure', label: 'Measure', title: 'Decision closes only when value is verified', detail: 'Track realized price, freight per shipment, product mix, gross margin, and customer retention weekly.', tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
];

export default function Demo() {
  const [active, setActive] = useState('detect');
  const [price, setPrice] = useState(3);
  const [freight, setFreight] = useState(18);
  const current = workflow.find((item) => item.id === active) || workflow[0];
  const monthlyUpside = Math.round(price * 13 + freight * 1.35);
  const marginLift = (price * 0.48 + freight * 0.055).toFixed(1);

  return (
    <>
      <Head>
        <title>Business OS Demonstration | Glacier Lake Partners</title>
        <meta name="description" content="Follow a sample operating issue from signal to diagnosis, intervention, ownership, and measured value." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="min-h-screen bg-[#060d18] text-slate-100">
        <header className="border-b border-slate-800 bg-[#08111f]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div><Link href="/landing" className="font-semibold text-white">Glacier Lake <span className="text-indigo-400">Business OS</span></Link><p className="mt-1 text-xs text-slate-500">Interactive sample company · No client data</p></div>
            <div className="flex items-center gap-3"><Link href="/buyers-lens" className="text-sm text-slate-400 hover:text-white">Buyer&apos;s Lens</Link><a href="https://glacierlakepartners.com/contact?engagementType=Operational+Advisory&ref=business-os-demo" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950">Discuss a workflow</a></div>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-indigo-400">Sample operating case</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">From margin signal to accountable action.</h1><p className="mt-4 max-w-3xl text-slate-400">Northstar Industrial Supply is growing revenue while losing margin. Follow how Business OS turns that signal into a quantified intervention and a management cadence.</p></div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4"><p className="text-xs uppercase tracking-wider text-slate-500">Case objective</p><p className="mt-1 font-semibold text-white">Restore 200+ bps without impairing retention</p></div>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Revenue', '$2.63M', '+14.0% vs. May', 'text-emerald-400'],
              ['Gross margin', '30.8%', '−500 bps vs. May', 'text-rose-400'],
              ['Monthly EBITDA', '$190K', '−$130K vs. May', 'text-rose-400'],
              ['Modeled upside', `$${monthlyUpside}K`, `+${marginLift} margin points`, 'text-cyan-400'],
            ].map(([label, value, delta, color]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p><p className={`mt-2 text-xs ${color}`}>{delta}</p></div>)}
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Performance signal</p><h2 className="mt-1 text-lg font-semibold text-white">Revenue growth is not converting to earnings</h2></div><span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">Management attention</span></div>
              <div className="mt-8 grid h-64 grid-cols-6 items-end gap-3 border-b border-l border-slate-700 px-3 pb-3">
                {periods.map((period) => <div key={period.month} className="flex h-full flex-col items-center justify-end gap-2"><div className="w-full rounded-t bg-indigo-500/70" style={{ height: `${period.revenue * 25}%` }} title={`Revenue $${period.revenue}M`} /><div className="w-full rounded-t bg-rose-400/70" style={{ height: `${period.margin * 1.7}%` }} title={`Margin ${period.margin}%`} /><span className="text-xs text-slate-500">{period.month}</span></div>)}
              </div>
              <div className="mt-4 flex gap-5 text-xs text-slate-400"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-500" />Revenue index</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-400" />Gross-margin index</span></div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Intervention model</p><h2 className="mt-1 text-lg font-semibold text-white">Pressure-test the recommendation</h2>
              <label className="mt-8 block"><span className="flex justify-between text-sm text-slate-300"><span>Product C price action</span><strong>{price}%</strong></span><input type="range" min="0" max="6" step="1" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-3 w-full accent-cyan-400" /></label>
              <label className="mt-7 block"><span className="flex justify-between text-sm text-slate-300"><span>Freight-cost reduction</span><strong>{freight}%</strong></span><input type="range" min="0" max="30" step="2" value={freight} onChange={(e) => setFreight(Number(e.target.value))} className="mt-3 w-full accent-cyan-400" /></label>
              <div className="mt-8 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5"><p className="text-xs uppercase tracking-wider text-cyan-400">Illustrative monthly impact</p><p className="mt-2 text-3xl font-semibold text-white">${monthlyUpside}K</p><p className="mt-2 text-sm text-slate-400">Approximately {marginLift} points of modeled gross-margin recovery before implementation costs.</p></div>
              <p className="mt-4 text-xs leading-5 text-slate-500">The model uses fixed sample assumptions. It is not a forecast and does not use AI-generated financial calculations.</p>
            </section>
          </div>

          <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Closed-loop workflow</p><h2 className="mt-1 text-lg font-semibold text-white">The differentiator is the decision trail—not another dashboard.</h2></div>
            <div className="mt-7 grid gap-3 md:grid-cols-5">{workflow.map((item) => <button key={item.id} onClick={() => setActive(item.id)} className={`rounded-lg border p-4 text-left transition ${active === item.id ? item.tone : 'border-slate-800 bg-slate-950/40 text-slate-500 hover:border-slate-700'}`}><span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span><p className="mt-2 text-sm font-medium text-slate-200">{item.title}</p></button>)}</div>
            <div className={`mt-5 rounded-xl border p-6 ${current.tone}`}><p className="text-xs font-semibold uppercase tracking-wider">{current.label}</p><h3 className="mt-2 text-xl font-semibold text-white">{current.title}</h3><p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{current.detail}</p></div>
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {[
              ['Decision', 'Approve a targeted Product C price action and launch a 30-day freight bid.', 'CEO + CFO', 'Nov 6'],
              ['Success measure', 'Realized price ≥2.5%, freight per shipment −15%, retention ≥97%.', 'Commercial + Ops', 'Weekly'],
              ['Evidence', 'Price realization report, carrier quotes, margin bridge, churn exceptions.', 'Controller', 'Month-end'],
            ].map(([label, text, owner, timing]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">{label}</p><p className="mt-3 text-sm leading-6 text-slate-200">{text}</p><div className="mt-5 flex justify-between border-t border-slate-800 pt-3 text-xs text-slate-500"><span>{owner}</span><span>{timing}</span></div></div>)}
          </div>

          <section className="mt-12 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-8 text-center"><p className="text-xs font-semibold uppercase tracking-[.2em] text-indigo-300">What this demonstrates</p><h2 className="mx-auto mt-3 max-w-3xl text-2xl font-semibold text-white">Business OS connects financial visibility to a decision, an owner, and verified value.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400">The live client environment would use approved company data, role-based access, review controls, and an implementation cadence designed around the operating team.</p><a href="https://glacierlakepartners.com/contact?engagementType=Business+OS&ref=business-os-demo" className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950">Discuss a client dashboard</a></section>
        </section>
        <footer className="border-t border-slate-800 px-6 py-8 text-center text-xs text-slate-500">Glacier Lake Partners · Sample company and figures are illustrative</footer>
      </main>
    </>
  );
}
