// ─── Accept Invite page ───────────────────────────────────────────────────────
// Reached via email link: /accept-invite?token=<token>
// Shows invite details and lets the signed-in user accept.

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { loadAuthSession } from '../lib/auth';

interface InviteInfo {
  inviterEmail: string;
  companyName: string;
  role: string;
  inviteeEmail: string;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = router.query as { token?: string };
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);
  const session = loadAuthSession();

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invites/accept?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((j: InviteInfo & { error?: string }) => {
        if (j.error) setError(j.error);
        else setInfo(j);
      })
      .catch(() => setError('Failed to load invite'));
  }, [token]);

  const accept = async () => {
    if (!token || !session) return;
    setAccepting(true);
    try {
      const r = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.token}` },
        body: JSON.stringify({ token }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) setDone(true);
      else setError(j.error ?? 'Failed to accept invite');
    } catch {
      setError('Network error');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <>
      <Head><title>Accept Invite — Business OS</title></Head>
      <div className="min-h-screen bg-[#060a12] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0d1117] border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-800/50">
            <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-[0.08em] mb-1">Business OS</div>
            <h1 className="text-[18px] font-bold text-slate-100">Team Invitation</h1>
          </div>

          <div className="p-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-[12px] text-red-400 mb-4">{error}</div>
            )}

            {done ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-slate-100 mb-1">You&apos;re in!</div>
                  <div className="text-[12px] text-slate-500">You now have {info?.role} access to {info?.companyName}.</div>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold rounded-xl transition-colors">
                  Go to Dashboard →
                </button>
              </div>
            ) : info ? (
              <div className="space-y-5">
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 space-y-2.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-600">From</span>
                    <span className="text-slate-300 font-medium">{info.inviterEmail}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-600">Company</span>
                    <span className="text-slate-300 font-medium">{info.companyName || '—'}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-600">Your role</span>
                    <span className={`font-semibold capitalize ${info.role === 'editor' ? 'text-indigo-400' : 'text-slate-400'}`}>{info.role}</span>
                  </div>
                </div>

                {!session ? (
                  <div className="space-y-3">
                    <div className="text-[12px] text-amber-400 bg-amber-500/8 border border-amber-500/15 rounded-xl px-3.5 py-2.5">
                      Sign in or create an account to accept this invitation.
                    </div>
                    <button
                      onClick={() => router.push(`/login?redirect=/accept-invite?token=${token}`)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold rounded-xl transition-colors">
                      Sign in to Accept →
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={accept}
                    disabled={accepting}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl transition-colors">
                    {accepting ? 'Accepting…' : 'Accept Invitation'}
                  </button>
                )}
              </div>
            ) : !error ? (
              <div className="py-8 text-center text-[12px] text-slate-600">Loading invite details…</div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
