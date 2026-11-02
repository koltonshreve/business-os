import Head from 'next/head';
import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

type Profile = {
  industry: string;
  revenue: string;
  timeline: string;
  concern: string;
};

const questions: Record<string, Array<{ question: string; evidence: string; gap: string }>> = {
  quality: [
    { question: 'How much of recent growth is repeatable rather than one-time?', evidence: 'Monthly revenue bridge by customer, product, channel, price, and volume for at least 24 months.', gap: 'Management cannot reconcile growth to source data or explain material monthly movements.' },
    { question: 'Which customers, products, or locations create economic profit?', evidence: 'Gross-margin and contribution analysis using consistent cost allocation.', gap: 'Reported company margin masks loss-making accounts, products, or locations.' },
    { question: 'How resilient are earnings after owner adjustments?', evidence: 'Documented EBITDA bridge with invoices, payroll records, and recurring/nonrecurring classification.', gap: 'Add-backs are unsupported, recurring, or inconsistent with buyer convention.' },
  ],
  concentration: [
    { question: 'What happens if the largest customer leaves or reprices?', evidence: 'Customer concentration, cohort retention, contract terms, and a downside case.', gap: 'Top-customer exposure is material and no credible retention or diversification plan exists.' },
    { question: 'Are key customer relationships institutional or owner-dependent?', evidence: 'Relationship map, renewal history, account ownership, and executive-contact coverage.', gap: 'Commercial relationships sit primarily with the founder.' },
    { question: 'Do contracts transfer cleanly in a transaction?', evidence: 'Executed agreements with assignment, change-of-control, termination, and pricing terms indexed.', gap: 'Missing contracts or consent requirements could slow closing.' },
  ],
  reporting: [
    { question: 'Can management produce consistent monthly financials quickly?', evidence: 'Twelve monthly closes, trial balances, KPI definitions, and close calendar.', gap: 'Numbers change between management, lender, tax, and diligence versions.' },
    { question: 'Can every headline KPI be traced to a source?', evidence: 'KPI dictionary with owner, calculation, source system, and reconciliation.', gap: 'Metrics are manually assembled or definitions change over time.' },
    { question: 'Are forecasts grounded in operating drivers?', evidence: 'Driver-based forecast with assumptions, actual-versus-budget history, and sensitivity cases.', gap: 'Forecasts are top-down and have limited accountability.' },
  ],
  management: [
    { question: 'Can the company perform without daily founder intervention?', evidence: 'Decision-rights map, management cadence, role scorecards, and delegated approvals.', gap: 'Critical approvals, relationships, and operating knowledge remain founder-dependent.' },
    { question: 'Is there a credible second layer of leadership?', evidence: 'Organization chart, retention history, incentive plans, and succession coverage.', gap: 'Key-person risk is visible and leadership retention has not been addressed.' },
    { question: 'Are recurring processes documented and followed?', evidence: 'Current SOPs, workflow owners, exception logs, and proof of operating cadence.', gap: 'Processes live in individual memory and vary by person.' },
  ],
};

const common = [
  { question: 'What working-capital level is required to operate the business normally?', evidence: 'Monthly AR, AP, inventory, deferred revenue, and normalized net-working-capital schedule.', gap: 'Seasonality, aging, or classification issues could create a purchase-price dispute.' },
  { question: 'What could cause a buyer to retrade value after initial interest?', evidence: 'A reconciled quality-of-earnings bridge, risk register, and support for every material claim.', gap: 'Headline performance cannot be reproduced quickly from buyer-ready evidence.' },
];

function concernLabel(value: string) {
  return {
    quality: 'earnings quality and margin durability',
    concentration: 'customer concentration and commercial durability',
    reporting: 'financial reporting and forecast credibility',
    management: 'founder dependence and management depth',
  }[value] || 'transaction readiness';
}

export default function BuyersLens() {
  const [profile, setProfile] = useState<Profile>({ industry: 'Business services', revenue: '$10M–$25M', timeline: '12–24 months', concern: 'quality' });
  const [submitted, setSubmitted] = useState(false);
  const findings = useMemo(() => [...(questions[profile.concern] || questions.quality), ...common].slice(0, 5), [profile.concern]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    window.setTimeout(() => document.getElementById('buyer-findings')?.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  return (
    <>
      <Head>
        <title>Buyer&apos;s Lens | Glacier Lake Partners</title>
        <meta name="description" content="See the questions a buyer is likely to ask, the evidence needed, and the gaps to address before a sale process." />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="min-h-screen bg-[#07111f] text-slate-100">
        <header className="border-b border-slate-800/80 bg-[#07111f]/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link href="/landing" className="font-semibold tracking-tight text-white">Glacier Lake <span className="text-cyan-400">Business OS</span></Link>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">Illustrative assessment</span>
          </div>
        </header>

        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[.22em] text-cyan-400">Transaction readiness</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">See your business through a buyer&apos;s lens.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">A focused preview of the questions, evidence, and preparation gaps that may shape buyer confidence. Built for founders before a formal sale process begins.</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {['5 likely buyer questions', 'Evidence checklist', 'Preparation sequence'].map((item) => <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">{item}</div>)}
            </div>
          </div>

          <form onSubmit={submit} className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 md:p-8">
            <h2 className="text-xl font-semibold text-white">Company profile</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">No documents or confidential financial information are required.</p>
            <div className="mt-7 space-y-5">
              {[
                ['industry', 'Industry', ['Business services', 'Manufacturing', 'Distribution', 'Healthcare services', 'Software / technology', 'Consumer services']],
                ['revenue', 'Approximate annual revenue', ['$5M–$10M', '$10M–$25M', '$25M–$50M', '$50M–$100M', '$100M+']],
                ['timeline', 'Potential sale timeline', ['Under 12 months', '12–24 months', '2–3 years', 'No fixed timeline']],
                ['concern', 'Primary concern', [
                  ['quality', 'Earnings quality and margins'],
                  ['concentration', 'Customer concentration'],
                  ['reporting', 'Reporting and forecasting'],
                  ['management', 'Founder dependence'],
                ]],
              ].map(([key, label, options]) => (
                <label key={key as string} className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">{label as string}</span>
                  <select value={profile[key as keyof Profile]} onChange={(e) => { setProfile({ ...profile, [key as string]: e.target.value }); setSubmitted(false); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white">
                    {(options as Array<string | string[]>).map((option) => {
                      const value = Array.isArray(option) ? option[0] : option;
                      const text = Array.isArray(option) ? option[1] : option;
                      return <option key={value} value={value}>{text}</option>;
                    })}
                  </select>
                </label>
              ))}
            </div>
            <button className="mt-7 w-full rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300" type="submit">Generate buyer-readiness preview</button>
            <p className="mt-4 text-center text-xs leading-5 text-slate-500">Educational decision support only. Not a valuation, fairness opinion, or indication of buyer interest.</p>
          </form>
        </section>

        {submitted && (
          <section id="buyer-findings" className="border-t border-slate-800 bg-slate-950/40 px-6 py-16">
            <div className="mx-auto max-w-6xl">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-400">Buyer-readiness preview</p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">Likely diligence focus for a {profile.industry.toLowerCase()} business</h2>
                  <p className="mt-3 max-w-3xl text-slate-400">Profile: {profile.revenue} revenue · {profile.timeline} · Focused on {concernLabel(profile.concern)}.</p>
                </div>
                <button onClick={() => window.print()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500">Print / save PDF</button>
              </div>

              <div className="mt-10 space-y-4">
                {findings.map((item, index) => (
                  <article key={item.question} className="grid gap-5 rounded-xl border border-slate-800 bg-slate-900/60 p-6 lg:grid-cols-[48px_1fr_1fr]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 font-semibold text-cyan-300">{index + 1}</div>
                    <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Likely buyer question</p><h3 className="mt-2 text-lg font-semibold text-white">{item.question}</h3><p className="mt-5 text-xs font-semibold uppercase tracking-wider text-emerald-400">Evidence to prepare</p><p className="mt-2 text-sm leading-6 text-slate-300">{item.evidence}</p></div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Gap that can reduce confidence</p><p className="mt-3 text-sm leading-6 text-slate-300">{item.gap}</p></div>
                  </article>
                ))}
              </div>

              <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_.7fr]">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Suggested preparation sequence</p>
                  <ol className="mt-5 space-y-4 text-sm text-slate-300">
                    <li><strong className="text-white">1. Reconcile.</strong> Establish one source of truth for historical financial and operating performance.</li>
                    <li><strong className="text-white">2. Evidence.</strong> Build support files for earnings adjustments, concentration, contracts, KPIs, and working capital.</li>
                    <li><strong className="text-white">3. Pressure-test.</strong> Rehearse buyer questions and quantify downside cases before materials go to market.</li>
                    <li><strong className="text-white">4. Sequence.</strong> Resolve high-confidence gaps first; disclose and frame what cannot be fixed in time.</li>
                  </ol>
                </div>
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Important limitation</p>
                  <p className="mt-4 text-sm leading-6 text-slate-300">This preview uses profile selections, not company records. A transaction-readiness review should verify the facts, quantify materiality, and prioritize preparation against the actual timeline.</p>
                  <a href="https://glacierlakepartners.com/contact?engagementType=Transaction+Readiness&ref=buyers-lens" className="mt-6 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">Discuss the findings</a>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="border-t border-slate-800 px-6 py-8 text-center text-xs text-slate-500">Glacier Lake Partners · Illustrative tool · No submitted information is stored by this prototype</footer>
      </main>
    </>
  );
}
