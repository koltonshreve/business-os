// ─── Auth / Sign-In Page ───────────────────────────────────────────────────────
// Shown to unauthenticated visitors. Captures email and creates a local session.
// Swap this for Clerk/NextAuth for a production-grade auth layer.

import { useState, type FormEvent } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { saveAuthSession } from '../lib/auth';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json() as { token?: string; error?: string };

      if (!res.ok || !data.token) {
        setError(data.error ?? 'Sign-in failed. Try again.');
        return;
      }

      saveAuthSession(email, data.token);
      const next = (router.query.next as string) || '/';
      void router.replace(next);
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign In — Business OS</title>
        <meta name="description" content="AI-powered business intelligence for LMM operators"/>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
        <meta property="og:title" content="Business OS — AI intelligence for LMM operators"/>
        <meta property="og:description" content="Live P&L dashboard, AI CFO advisor, and deal pipeline. Built for lower middle market operators."/>
        <meta property="og:image" content="/api/og"/>
        <meta name="twitter:card" content="summary_large_image"/>
        <meta name="twitter:image" content="/api/og"/>
      </Head>
      <div className="min-h-screen bg-[#060a12] flex flex-col items-center justify-center px-4">

        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <svg viewBox="0 0 12 12" fill="white" className="w-6 h-6"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Business OS</h1>
          <p className="text-slate-500 text-sm mt-1">AI-powered intelligence for LMM operators</p>
        </div>

        {/* Sign-in card */}
        <div className="w-full max-w-sm">
          <div className="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-[15px] font-semibold text-slate-200 mb-1">Get started</h2>
            <p className="text-[13px] text-slate-500 mb-6">Enter your email to access the dashboard.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-slate-400 mb-1.5" htmlFor="email">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-slate-800/80 transition-colors"
                />
              </div>

              {error && (
                <div className="text-[12px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-semibold transition-colors"
              >
                {loading ? 'Signing in…' : 'Continue →'}
              </button>
            </form>

            <p className="text-[11px] text-slate-600 text-center mt-5">
              By continuing you agree to our terms of service.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: '📊', label: 'Live P&L Dashboard' },
              { icon: '🤖', label: 'AI CFO Advisor' },
              { icon: '🎯', label: 'Deal Pipeline CRM' },
            ].map(f => (
              <div key={f.label} className="bg-slate-900/40 border border-slate-800/40 rounded-xl p-3">
                <div className="text-lg mb-1">{f.icon}</div>
                <div className="text-[10px] text-slate-500 font-medium">{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
