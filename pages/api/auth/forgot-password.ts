import type { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { sendEmail, passwordResetEmail } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const { email } = req.body as { email?: string };
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  await ensureSchema();
  const sql = getDb();

  // Always return success to avoid email enumeration
  const rows = await sql`SELECT id FROM bos_users WHERE email = ${email.toLowerCase()} LIMIT 1` as { id: string }[];
  if (rows.length === 0) return res.json({ ok: true });

  // Invalidate old reset tokens for this user
  await sql`UPDATE bos_password_resets SET used = true WHERE user_email = ${email.toLowerCase()} AND used = false`;

  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  await sql`
    INSERT INTO bos_password_resets (id, user_email, expires_at)
    VALUES (${token}, ${email.toLowerCase()}, ${expires})
  `;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.host}`;
  const resetUrl = `${baseUrl}/auth?reset=${token}`;

  const emailResult = await sendEmail({
    to: email.toLowerCase(),
    subject: 'Reset your Business OS password',
    html: passwordResetEmail(resetUrl),
  });

  // If email is not configured, surface the URL directly so dev/staging still works
  if (!emailResult.ok) {
    return res.json({ ok: true, resetUrl });
  }
  return res.json({ ok: true });
}
