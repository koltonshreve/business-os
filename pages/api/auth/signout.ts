import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured } from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: 'Token required' });

  if (isDbConfigured()) {
    try {
      const sql = getDb();
      await sql`DELETE FROM bos_sessions WHERE id = ${token}`;
    } catch { /* non-fatal */ }
  }

  return res.status(200).json({ ok: true });
}
