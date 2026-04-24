import type { NextApiRequest, NextApiResponse } from 'next';
import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';

const pbkdf2Async = promisify(pbkdf2);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key  = await pbkdf2Async(password, salt, 100_000, 32, 'sha256');
  return `pbkdf2:sha256:100000:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 5) return false;
  const [, , iters, salt, storedKey] = parts;
  const key = await pbkdf2Async(password, salt, parseInt(iters, 10), 32, 'sha256');
  const a = Buffer.from(key.toString('hex'));
  const b = Buffer.from(storedKey);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured — connect Neon in Vercel Storage.' });
  }

  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const sql = getDb();
    await ensureSchema();

    // Check for existing account
    const existing = await sql`SELECT id FROM bos_users WHERE email = ${email.toLowerCase()} LIMIT 1` as { id: string }[];
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    await sql`
      INSERT INTO bos_users (id, email, password_hash, name)
      VALUES (${userId}, ${email.toLowerCase()}, ${passwordHash}, ${name?.trim() || null})
    `;

    // Create session (30-day expiry)
    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await sql`
      INSERT INTO bos_sessions (id, user_id, email, expires_at)
      VALUES (${token}, ${userId}, ${email.toLowerCase()}, ${expires})
    `;

    return res.status(201).json({ token, email: email.toLowerCase() });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Sign-up failed. Please try again.' });
  }
}
