// ─── Server-side session validation ──────────────────────────────────────────
// Call getSessionUser(req) in API routes to identify the caller.

import type { NextApiRequest } from 'next';
import { getDb, isDbConfigured } from './db';

export interface SessionUser { email: string }

export async function getSessionUser(req: NextApiRequest): Promise<SessionUser | null> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !isDbConfigured()) return null;
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT email FROM bos_sessions
      WHERE id = ${token} AND expires_at > now()
      LIMIT 1
    ` as { email: string }[];
    return rows[0] ? { email: rows[0].email } : null;
  } catch { return null; }
}
