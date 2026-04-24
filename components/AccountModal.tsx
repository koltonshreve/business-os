// ─── Account & Plan Modal ──────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { authHeaders, loadAuthSession, signOut } from '../lib/auth';

interface Props {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  onSignOut: () => void;
  companyName: string;
  onCompanyNameChange: (name: string) => void;
}

interface Usage {
  count: number;
  limit: number;
  planId: string;
  remaining: number;
}

interface BillingInfo {
  customerId: string | null;
  planId: string;
}

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', growth: 'Growth', pro: 'Pro' };
const PLAN_COLOR: Record<string, string> = {
  starter: 'text-slate-300 bg-slate-800/60 border-slate-700/40',
  growth:  'text-indigo-300 bg-indigo-500/10 border-indigo-500/25',
  pro:     'text-violet-300 bg-violet-500/10 border-violet-500/25',
};

type Tab = 'account' | 'plan' | 'security' | 'team';

export default function AccountModal({ open, onClose, onUpgrade, onSignOut, companyName, onCompanyNameChange }: Props) {
  const [tab, setTab]               = useState<Tab>('account');
  const [usage, setUsage]           = useState<Usage | null>(null);
  const [billing, setBilling]       = useState<BillingInfo | null>(null);

  // Account tab
  const [nameEdit, setNameEdit]       = useState(companyName);
  const [displayName, setDisplayName] = useState('');
  const [nameSaved, setNameSaved]     = useState(false);
  const [dnSaved, setDnSaved]         = useState(false);

  // Security tab
  const [pwMode, setPwMode]           = useState<'idle' | 'direct' | 'email'>('idle');
  const [curPw, setCurPw]             = useState('');
  const [newPw, setNewPw]             = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [pwError, setPwError]         = useState('');
  const [pwOk, setPwOk]               = useState(false);
  const [pwLoading, setPwLoading]     = useState(false);

  // Portal
  const [portalLoading, setPortalLoading] = useState(false);

  // Team tab
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviteRole, setInviteRole]     = useState<'viewer' | 'editor'>('viewer');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [teamData, setTeamData]         = useState<{ invites: { id: string; invitee_email: string; role: string; status: string; created_at: string }[]; members: { id: string; member_email: string; role: string }[] } | null>(null);

  const session = loadAuthSession();

  useEffect(() => {
    if (!open || !session?.token) return;
    setNameEdit(companyName);
    setPwMode('idle'); setCurPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); setPwOk(false);

    Promise.all([
      fetch('/api/user/usage',   { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
      fetch('/api/user/billing', { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
      fetch('/api/user/profile', { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
      fetch('/api/invites',      { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
    ]).then(([u, b, p, t]) => {
      if (u) setUsage(u as Usage);
      if (b) setBilling(b as BillingInfo);
      if (p?.name) setDisplayName(p.name);
      if (t) setTeamData(t as typeof teamData);
    }).catch(() => null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveCompanyName() {
    if (!nameEdit.trim() || nameEdit === companyName) return;
    onCompanyNameChange(nameEdit.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }

  async function handleSaveDisplayName() {
    if (!displayName.trim()) return;
    await fetch('/api/user/profile', {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ name: displayName.trim() }),
    }).catch(() => null);
    setDnSaved(true);
    setTimeout(() => setDnSaved(false), 2000);
  }

  async function handleChangePw() {
    setPwError('');
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      if (res.ok) {
        setPwOk(true);
        setCurPw(''); setNewPw(''); setConfirmPw('');
        setTimeout(() => { setPwOk(false); setPwMode('idle'); }, 3000);
      } else {
        const err = await res.json() as { error?: string };
        setPwError(err.error ?? 'Password change failed');
      }
    } finally {
      setPwLoading(false);
    }
  }

  async function handleSendReset() {
    if (!session?.email) return;
    setPwLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email }),
      });
      setPwOk(true);
    } finally {
      setPwLoading(false);
    }
  }

  async function handleOpenPortal() {
    if (!billing?.customerId) return;
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ customerId: billing.customerId, returnUrl: window.location.href }),
      });
      if (res.ok) {
        const { url } = await res.json() as { url: string };
        window.location.href = url;
      }
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteMsg(null);
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const j = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (res.ok && j.ok) {
        setInviteMsg({ type: 'ok', text: j.message ?? `Invite sent to ${inviteEmail}` });
        setInviteEmail('');
        // refresh team data
        fetch('/api/invites', { headers: authHeaders() })
          .then(r => r.ok ? r.json() : null)
          .then(t => { if (t) setTeamData(t as typeof teamData); })
          .catch(() => null);
      } else {
        setInviteMsg({ type: 'err', text: j.error ?? 'Failed to send invite' });
      }
    } catch {
      setInviteMsg({ type: 'err', text: 'Network error' });
    } finally {
      setInviteSending(false);
    }
  }

  async function handleRevokeInvite(id: string) {
    await fetch(`/api/invites?id=${id}`, { method: 'DELETE', headers: authHeaders() }).catch(() => null);
    setTeamData(d => d ? { ...d, invites: d.invites.filter(i => i.id !== id) } : d);
  }

  const planId = usage?.planId ?? billing?.planId ?? 'starter';
  const isUnlimited = (usage?.limit ?? 0) >= 999;
  const isPaid = planId !== 'starter';

  const inputCls = "w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors";

  const TAB_ITEMS: { id: Tab; label: string }[] = [
    { id: 'account',  label: 'Account' },
    { id: 'plan',     label: 'Plan & Billing' },
    { id: 'security', label: 'Security' },
    { id: 'team',     label: 'Team' },
  ];

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0b0f1a] border border-slate-700/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-700/40 border border-indigo-500/30 flex items-center justify-center text-[14px] font-bold text-indigo-200">
              {(displayName || session?.email)?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="text-[13px] font-semibold text-slate-100">{displayName || 'Account & Plan'}</div>
              <div className="text-[11px] text-slate-500 truncate max-w-[220px]">{session?.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-3 h-3"><path d="M3 3l8 8M11 3l-8 8"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800/60">
          {TAB_ITEMS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-[12px] font-medium transition-colors ${tab === t.id ? 'text-indigo-300 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* ── ACCOUNT TAB ──────────────────────────────────────────────── */}
          {tab === 'account' && (
            <>
              {/* Display name */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Your name</label>
                <div className="flex gap-2">
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveDisplayName()}
                    placeholder="Jane Smith" className={inputCls}/>
                  <button onClick={handleSaveDisplayName}
                    disabled={!displayName.trim()}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold rounded-xl transition-colors whitespace-nowrap">
                    {dnSaved ? '✓' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Company name */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Company name</label>
                <div className="flex gap-2">
                  <input value={nameEdit} onChange={e => setNameEdit(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveCompanyName()}
                    placeholder="My Company" className={inputCls}/>
                  <button onClick={handleSaveCompanyName}
                    disabled={!nameEdit.trim() || nameEdit === companyName}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold rounded-xl transition-colors whitespace-nowrap">
                    {nameSaved ? '✓' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Email address</label>
                <div className="px-3.5 py-2.5 bg-slate-800/30 border border-slate-800/60 rounded-xl text-[13px] text-slate-500">
                  {session?.email}
                </div>
              </div>

              {/* Export data */}
              <button
                onClick={async () => {
                  const res = await fetch('/api/user/export', { headers: authHeaders() });
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `business-os-export-${new Date().toISOString().slice(0,10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left rounded-xl border border-slate-800/50 hover:border-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
                  <path d="M7 1v8M4 6l3 3 3-3"/><path d="M2 11h10"/>
                </svg>
                <span className="text-[12.5px] font-medium">Export all data</span>
              </button>

              {/* Sign out */}
              <button onClick={() => { onClose(); onSignOut(); }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-left rounded-xl border border-slate-800/50 hover:bg-red-500/5 hover:border-red-500/20 text-slate-500 hover:text-red-400 transition-colors">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5">
                  <path d="M5 2H2v10h3M9 4l3 3-3 3M6 7h6"/>
                </svg>
                <span className="text-[12.5px] font-medium">Sign out</span>
              </button>
            </>
          )}

          {/* ── PLAN TAB ─────────────────────────────────────────────────── */}
          {tab === 'plan' && (
            <>
              {/* Plan badge */}
              <div className={`flex items-start justify-between px-4 py-3.5 rounded-xl border ${PLAN_COLOR[planId]}`}>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70 mb-0.5">Current plan</div>
                  <div className="text-[15px] font-bold leading-none">{PLAN_LABEL[planId] ?? 'Starter'}</div>
                  {usage && !isUnlimited && (
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[10.5px] mb-1 opacity-70">
                        <span>AI queries this month</span>
                        <span>{usage.count} / {usage.limit}</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (usage.count / usage.limit) * 100)}%`,
                            background: usage.count >= usage.limit ? '#ef4444' : usage.count >= usage.limit * 0.8 ? '#f59e0b' : '#6366f1',
                          }}/>
                      </div>
                      <div className="text-[10px] opacity-60 mt-1">{usage.remaining} queries remaining</div>
                    </div>
                  )}
                  {usage && isUnlimited && (
                    <div className="text-[10.5px] mt-1.5 opacity-70">Unlimited AI queries · {usage.count} used this month</div>
                  )}
                </div>
                {planId !== 'pro' && (
                  <button onClick={() => { onClose(); onUpgrade(); }}
                    className="flex-shrink-0 ml-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg transition-colors">
                    Upgrade
                  </button>
                )}
              </div>

              {/* Plan comparison */}
              <div className="space-y-1.5">
                {[
                  { id: 'starter', name: 'Starter', price: 'Free',   ai: '10 queries/mo',   features: ['Core dashboard', 'File uploads', 'CRM pipeline'] },
                  { id: 'growth',  name: 'Growth',  price: '$49/mo', ai: '50 queries/mo',   features: ['Everything in Starter', 'Daily digest email', 'Priority AI'] },
                  { id: 'pro',     name: 'Pro',     price: '$149/mo',ai: 'Unlimited',        features: ['Everything in Growth', 'Weekly summaries', 'API access'] },
                ].map(p => (
                  <div key={p.id} className={`px-3.5 py-3 rounded-xl border transition-all ${planId === p.id ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-slate-800/50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-slate-200">{p.name}</span>
                        {planId === p.id && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">CURRENT</span>}
                      </div>
                      <span className="text-[12px] font-bold text-slate-300">{p.price}</span>
                    </div>
                    <div className="text-[10.5px] text-indigo-400 mb-1">{p.ai}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {p.features.map(f => <span key={f} className="text-[10px] text-slate-600">{f}</span>)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Manage subscription (paid users) */}
              {isPaid && billing?.customerId && (
                <button onClick={handleOpenPortal} disabled={portalLoading}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-700/50 hover:border-slate-600 text-slate-300 hover:text-slate-100 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 text-slate-500">
                      <rect x="1" y="3" width="12" height="9" rx="1.5"/><path d="M1 6h12"/>
                    </svg>
                    <span className="text-[12.5px] font-medium">{portalLoading ? 'Opening…' : 'Manage subscription & invoices'}</span>
                  </div>
                  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3 text-slate-600">
                    <path d="M5 3l4 4-4 4"/>
                  </svg>
                </button>
              )}
            </>
          )}

          {/* ── SECURITY TAB ─────────────────────────────────────────────── */}
          {tab === 'security' && (
            <>
              {pwOk && pwMode === 'direct' && (
                <div className="px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-[12px] text-emerald-400">
                  Password changed successfully.
                </div>
              )}
              {pwOk && pwMode === 'email' && (
                <div className="px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-[12px] text-emerald-400">
                  Reset link sent to {session?.email}. Check your inbox.
                </div>
              )}

              {pwMode === 'idle' && !pwOk && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-400 mb-2">Change your password</div>
                  <button onClick={() => setPwMode('direct')}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-800/50 hover:border-slate-700 text-slate-300 hover:text-slate-100 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 text-slate-500">
                        <rect x="2" y="6" width="10" height="7" rx="1.5"/><path d="M5 6V4a2 2 0 014 0v2"/>
                      </svg>
                      <span className="text-[12.5px] font-medium">Change password directly</span>
                    </div>
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3 text-slate-600"><path d="M5 3l4 4-4 4"/></svg>
                  </button>
                  <button onClick={() => setPwMode('email')}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-800/50 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5 text-slate-500">
                        <rect x="1" y="3" width="12" height="9" rx="1.5"/><path d="M1 6l6 4 6-4"/>
                      </svg>
                      <span className="text-[12.5px] font-medium">Send reset link via email</span>
                    </div>
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3 h-3 text-slate-600"><path d="M5 3l4 4-4 4"/></svg>
                  </button>
                </div>
              )}

              {pwMode === 'direct' && !pwOk && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => setPwMode('idle')} className="text-slate-500 hover:text-slate-300 transition-colors">
                      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5"><path d="M9 3L5 7l4 4"/></svg>
                    </button>
                    <div className="text-[12px] font-semibold text-slate-300">Change password</div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">Current password</label>
                    <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)}
                      placeholder="••••••••" className={inputCls}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">New password</label>
                    <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                      placeholder="Minimum 8 characters" className={inputCls}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">Confirm new password</label>
                    <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleChangePw()}
                      placeholder="••••••••" className={inputCls}/>
                  </div>
                  {pwError && <div className="text-[11px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">{pwError}</div>}
                  <button onClick={handleChangePw} disabled={pwLoading || !curPw || !newPw || !confirmPw}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold rounded-xl transition-colors">
                    {pwLoading ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              )}

              {pwMode === 'email' && !pwOk && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => setPwMode('idle')} className="text-slate-500 hover:text-slate-300 transition-colors">
                      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-3.5 h-3.5"><path d="M9 3L5 7l4 4"/></svg>
                    </button>
                    <div className="text-[12px] font-semibold text-slate-300">Send reset link</div>
                  </div>
                  <p className="text-[12px] text-slate-400 leading-relaxed">
                    We'll send a password reset link to <span className="text-slate-200">{session?.email}</span>.
                  </p>
                  <button onClick={handleSendReset} disabled={pwLoading}
                    className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-[12px] font-semibold rounded-xl transition-colors">
                    {pwLoading ? 'Sending…' : 'Send reset email →'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── TEAM TAB ─────────────────────────────────────────────────── */}
          {tab === 'team' && (
            <>
              {/* Invite form */}
              <div>
                <div className="text-[11px] font-medium text-slate-400 mb-2">Invite a team member</div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
                    placeholder="colleague@company.com"
                    className={inputCls + ' flex-1'}/>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as 'viewer' | 'editor')}
                    className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-2.5 py-2 text-[12px] text-slate-300 focus:outline-none cursor-pointer">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    onClick={handleSendInvite}
                    disabled={inviteSending || !inviteEmail.trim()}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[12px] font-semibold rounded-xl transition-colors whitespace-nowrap">
                    {inviteSending ? '…' : 'Invite'}
                  </button>
                </div>
                {inviteMsg && (
                  <div className={`text-[11px] px-3 py-2 rounded-lg border ${inviteMsg.type === 'ok' ? 'text-emerald-400 bg-emerald-500/8 border-emerald-500/20' : 'text-red-400 bg-red-500/8 border-red-500/20'}`}>
                    {inviteMsg.text}
                  </div>
                )}
              </div>

              {/* Active members */}
              {(teamData?.members ?? []).length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-slate-500 mb-2">Members</div>
                  <div className="space-y-1.5">
                    {(teamData?.members ?? []).map(m => (
                      <div key={m.id} className="flex items-center justify-between px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/40">
                        <span className="text-[12px] text-slate-300 truncate">{m.member_email}</span>
                        <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${m.role === 'editor' ? 'text-indigo-300 border-indigo-500/20 bg-indigo-500/8' : 'text-slate-500 border-slate-700/40 bg-slate-800/40'}`}>{m.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending invites */}
              {(teamData?.invites ?? []).filter(i => i.status === 'pending').length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-slate-500 mb-2">Pending invites</div>
                  <div className="space-y-1.5">
                    {(teamData?.invites ?? []).filter(i => i.status === 'pending').map(inv => (
                      <div key={inv.id} className="flex items-center justify-between px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/40">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] text-slate-400 truncate">{inv.invitee_email}</div>
                          <div className="text-[10px] text-slate-600 capitalize">{inv.role} · Pending</div>
                        </div>
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="flex-shrink-0 ml-2 text-[10px] text-slate-600 hover:text-red-400 transition-colors">
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!teamData && (
                <div className="py-4 text-center text-[11px] text-slate-600">Loading team…</div>
              )}
              {teamData && (teamData.members.length + teamData.invites.filter(i=>i.status==='pending').length) === 0 && !inviteMsg && (
                <div className="py-4 text-center text-[11px] text-slate-600">No team members yet — invite someone above</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
