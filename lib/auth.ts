// ─── Auth session utilities ────────────────────────────────────────────────────
// Thin localStorage wrapper for the email-based auth session.
// Lives in lib/ so it can be imported from pages, API routes, and components
// without creating circular page-to-page imports.

const AUTH_KEY = 'bos_auth_session';

export interface AuthSession {
  email: string;
  token: string;
  createdAt: string;
}

export function saveAuthSession(email: string, token: string): void {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ email, token, createdAt: new Date().toISOString() }));
  } catch { /* ignore */ }
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch { return null; }
}

export function clearAuthSession(): void {
  try { localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ }
}
