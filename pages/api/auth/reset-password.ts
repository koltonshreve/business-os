import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../../lib/db';
import { hashPassword, generateToken } from './signup';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const { token, password } = req.body as { token?: string; password?: string };
  if (!token) return res.status(400).json({ error: 'Reset token required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const sql = getDb();

  const rows = await sql`
    SELECT id, user_email FROM bos_password_resets
    WHERE id = ${token} AND used = false AND expires_at > now()
    LIMIT 1
  ` as { id: string; user_email: string }[];

  if (rows.length === 0) return res.status(400).json({ error: 'Reset link is invalid or has expired.' });

  const { user_email } = rows[0];
  const passwordHash = await hashPassword(password);

  await Promise.all([
    sql`UPDATE bos_users SET password_hash = ${passwordHash}, updated_at = now() WHERE email = ${user_email}`,
    sql`UPDATE bos_password_resets SET used = true WHERE id = ${token}`,
    sql`DELETE FROM bos_sessions WHERE email = ${user_email}`, // invalidate all existing sessions
  ]);

  // Create a fresh session so the user is logged in immediately
  const sessionToken = generateToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const userRow = await sql`SELECT id FROM bos_users WHERE email = ${user_email} LIMIT 1` as { id: string }[];
  if (userRow.length > 0) {
    await sql`INSERT INTO bos_sessions (id, user_id, email, expires_at) VALUES (${sessionToken}, ${userRow[0].id}, ${user_email}, ${expires})`;
  }

  return res.json({ ok: true, token: sessionToken, email: user_email });
}
