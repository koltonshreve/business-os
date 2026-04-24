// ─── PWA Install Prompt ────────────────────────────────────────────────────────
// Shows a "Add to Home Screen" banner when the browser fires beforeinstallprompt.
// Only shown once per session. Stored dismissal in localStorage.

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'bos_pwa_dismissed';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or already installed
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-[72px] left-3 right-3 md:bottom-5 md:left-auto md:right-5 md:max-w-sm z-[130]
      bg-[#0b0f1a] border border-slate-700/50 rounded-2xl px-4 py-3.5 shadow-2xl
      flex items-center gap-3 animate-fade-in"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.15)' }}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
        <svg viewBox="0 0 12 12" fill="white" className="w-5 h-5">
          <rect x="1" y="1" width="4" height="4" rx="0.5"/>
          <rect x="7" y="1" width="4" height="4" rx="0.5"/>
          <rect x="1" y="7" width="4" height="4" rx="0.5"/>
          <rect x="7" y="7" width="4" height="4" rx="0.5"/>
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-slate-100 leading-tight">Install Business OS</div>
        <div className="text-[10.5px] text-slate-500 leading-tight mt-0.5">Add to home screen for instant access</div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={install}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg transition-colors"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-colors"
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-3 h-3">
            <path d="M3 3l8 8M11 3l-8 8"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
