// ─── /api/auth/change-password ────────────────────────────────────────────────
// POST — verify current password, then update to new password.
// Requires active session (Bearer token).

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';
import { hashPassword, verifyPassword } from './signup';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const sql = getDb();

  // Fetch current hash
  const rows = await sql`
    SELECT password_hash FROM bos_users WHERE email = ${user.email} LIMIT 1
  ` as unknown as { password_hash: string }[];

  if (!rows[0]) return res.status(404).json({ error: 'User not found' });

  const valid = await verifyPassword(currentPassword, rows[0].password_hash);
  if (!valid) return res.status(403).json({ error: 'Current password is incorrect' });

  const newHash = await hashPassword(newPassword);
  await sql`
    UPDATE bos_users SET password_hash = ${newHash}, updated_at = now()
    WHERE email = ${user.email}
  `;

  return res.json({ ok: true });
}
