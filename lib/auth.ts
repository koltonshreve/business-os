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

/** Returns headers with Bearer token for authenticated API calls. */
export function authHeaders(): Record<string, string> {
  const session = loadAuthSession();
  if (!session?.token) return { 'Content-Type': 'application/json' };
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` };
}

export async function signOut(): Promise<void> {
  const session = loadAuthSession();
  if (session?.token) {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: session.token }),
      });
    } catch { /* non-fatal */ }
  }
  clearAuthSession();
}
