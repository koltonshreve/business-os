import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { verifyPassword, generateToken } from './signup';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured — connect Neon in Vercel Storage.' });
  }

  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  if (!password) return res.status(400).json({ error: 'Password required' });

  try {
    const sql = getDb();
    await ensureSchema();

    const rows = await sql`
      SELECT id, password_hash FROM bos_users WHERE email = ${email.toLowerCase()} LIMIT 1
    ` as { id: string; password_hash: string }[];

    if (rows.length === 0) {
      return res.status(401).json({ error: 'No account found for this email. Create one instead.' });
    }

    const user = rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

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
