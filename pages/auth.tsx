import { useState, useEffect, type FormEvent } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { saveAuthSession } from '../lib/auth';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

export default function AuthPage() {
  const router  = useRouter();
  const [mode, setMode]         = useState<Mode>('signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [name, setName]         = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  // Pick up ?reset=<token> from the URL
  useEffect(() => {
    const token = router.query.reset as string | undefined;
    if (token) { setResetToken(token); setMode('reset'); }
  }, [router.query.reset]);

  function switchMode(m: Mode) {
    setMode(m); setError(''); setSuccess('');
    setPassword(''); setConfirm('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');

    if (mode === 'signup' && password !== confirm) { setError('Passwords do not match.'); return; }
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'forgot') {
        const res  = await fetch('/api/auth/forgot-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json() as { ok?: boolean; resetUrl?: string; error?: string };
        if (!res.ok) { setError(data.error ?? 'Request failed.'); return; }
        setSuccess(data.resetUrl
          ? `Reset link generated. Copy it:\n${data.resetUrl}`
          : 'If that email exists, a reset link has been sent.');
        return;
      }

      if (mode === 'reset') {
        const res  = await fetch('/api/auth/reset-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await res.json() as { ok?: boolean; token?: string; email?: string; error?: string };
        if (!res.ok || !data.token) { setError(data.error ?? 'Reset failed.'); return; }
        saveAuthSession(data.email!, data.token);
        void router.replace('/');
        return;
      }

      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
      const body = mode === 'signup'
        ? { email, password, name: name.trim() || undefined }
        : { email, password };

      const res  = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { token?: string; error?: string };

      if (!res.ok || !data.token) { setError(data.error ?? 'Something went wrong. Try again.'); return; }
      saveAuthSession(email.toLowerCase(), data.token);
      void router.replace((router.query.next as string) || '/');
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset  = mode === 'reset';

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

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
            <svg viewBox="0 0 12 12" fill="white" className="w-6 h-6"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Business OS</h1>
          <p className="text-slate-500 text-sm mt-1">AI-powered intelligence for LMM operators</p>
        </div>

        <div className="w-full max-w-sm">

          {/* Mode toggle — only for sign-in / sign-up */}
          {!isForgot && !isReset && (
            <div className="flex bg-slate-900/60 border border-slate-800/60 rounded-xl p-1 mb-4">
              {(['signin', 'signup'] as Mode[]).map(m => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-colors ${
                    mode === m ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          )}

          <div className="bg-slate-900/70 border border-slate-800/60 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-[15px] font-semibold text-slate-200 mb-1">
              {isForgot ? 'Reset your password' : isReset ? 'Choose a new password' : isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-[13px] text-slate-500 mb-6">
              {isForgot ? "Enter your email and we'll generate a reset link."
                : isReset ? 'Enter your new password below.'
                : isSignup ? 'Start with a free account.'
                : 'Sign in to your Business OS.'}
            </p>

            {success ? (
              <div className="text-[13px] text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-3 whitespace-pre-wrap break-all">
                {success}
                <button onClick={() => switchMode('signin')} className="block mt-3 text-indigo-400 hover:text-indigo-300 text-[12px]">← Back to sign in</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                {isSignup && (
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Name <span className="text-slate-600">(optional)</span></label>
                    <input type="text" autoComplete="name" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors"/>
                  </div>
                )}

                {!isReset && (
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Work email</label>
                    <input type="email" autoComplete="email" required placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors"/>
                  </div>
                )}

                {!isForgot && (
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">
                      {isReset ? 'New password' : 'Password'}
                    </label>
                    <input type="password" autoComplete={isSignup || isReset ? 'new-password' : 'current-password'}
                      required placeholder={isSignup || isReset ? 'Min. 8 characters' : '••••••••'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors"/>
                  </div>
                )}

                {(isSignup || isReset) && (
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Confirm password</label>
                    <input type="password" autoComplete="new-password" required placeholder="••••••••"
                      value={confirm} onChange={e => setConfirm(e.target.value)}
                      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors"/>
                  </div>
                )}

                {error && (
                  <div className="text-[12px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
                )}

                <button type="submit" disabled={loading || (!isForgot && !isReset && (!email || !password))}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[14px] font-semibold transition-colors mt-1">
                  {loading ? '…' : isForgot ? 'Send reset link →' : isReset ? 'Set new password →' : isSignup ? 'Create account →' : 'Sign in →'}
                </button>

                {mode === 'signin' && (
                  <button type="button" onClick={() => switchMode('forgot')}
                    className="w-full text-center text-[12px] text-slate-600 hover:text-slate-400 transition-colors pt-1">
                    Forgot password?
                  </button>
                )}
                {isForgot && (
                  <button type="button" onClick={() => switchMode('signin')}
                    className="w-full text-center text-[12px] text-slate-600 hover:text-slate-400 transition-colors pt-1">
                    ← Back to sign in
                  </button>
                )}
              </form>
            )}

            <p className="text-[11px] text-slate-600 text-center mt-5">By continuing you agree to our terms of service.</p>
          </div>

          {!isForgot && !isReset && (
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
          )}
        </div>
      </div>
    </>
  );
}
