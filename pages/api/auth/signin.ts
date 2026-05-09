import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { verifyPassword, generateToken } from './signup';

// ── Brute-force protection ────────────────────────────────────────────────────
// Max 10 failed attempts per IP per 15-minute window, then lock for 1 hour.
const WINDOW_MS   = 15 * 60 * 1000;  // 15 minutes
const MAX_FAILS   = 10;
const LOCKOUT_MS  = 60 * 60 * 1000;  // 1 hour

interface FailRecord { count: number; windowStart: number; lockedUntil: number | null }
const failMap = new Map<string, FailRecord>();

function checkBruteForce(ip: string): { blocked: boolean; resetIn: number } {
  const now = Date.now();
  let rec = failMap.get(ip);
  if (!rec) { rec = { count: 0, windowStart: now, lockedUntil: null }; failMap.set(ip, rec); }
  // Clear lockout if expired
  if (rec.lockedUntil && now > rec.lockedUntil) { rec.count = 0; rec.lockedUntil = null; rec.windowStart = now; }
  if (rec.lockedUntil) return { blocked: true, resetIn: Math.ceil((rec.lockedUntil - now) / 60_000) };
  // Reset window if expired
  if (now - rec.windowStart > WINDOW_MS) { rec.count = 0; rec.windowStart = now; }
  return { blocked: false, resetIn: 0 };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const rec = failMap.get(ip)!;
  rec.count++;
  if (rec.count >= MAX_FAILS) { rec.lockedUntil = now + LOCKOUT_MS; }
}

function clearFailures(ip: string) {
  failMap.delete(ip);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Sign-in is not available in this preview. Please continue exploring the demo dashboard.' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown';
  const { blocked, resetIn } = checkBruteForce(ip);
  if (blocked) {
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${resetIn} minute${resetIn !== 1 ? 's' : ''}.` });
  }

  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
  if (!password) return res.status(400).json({ error: 'Password required' });

  try {
    const sql = getDb();
    await ensureSchema();

    const rows = await sql`
      SELECT id, password_hash FROM bos_users WHERE email = ${email.toLowerCase()} LIMIT 1
    ` as { id: string; password_hash: string }[];

    if (rows.length === 0) {
      recordFailure(ip);
      return res.status(401).json({ error: 'No account found for this email. Create one instead.' });
    }

    const user = rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      recordFailure(ip);
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Successful login — clear failure counter
    clearFailures(ip);

    // Expire old sessions for this user and create a fresh one
    await sql`DELETE FROM bos_sessions WHERE user_id = ${user.id} AND expires_at < now()`;

    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await sql`
      INSERT INTO bos_sessions (id, user_id, email, expires_at)
      VALUES (${token}, ${user.id}, ${email.toLowerCase()}, ${expires})
    `;

    return res.status(200).json({ token, email: email.toLowerCase() });
  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({ error: 'Sign-in failed. Please try again.' });
  }
}
