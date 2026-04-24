// ─── /api/invites/accept ──────────────────────────────────────────────────────
// GET  ?token=<token> — validate an invite token (returns inviter/company info)
// POST { token }      — accept the invite (creates membership, marks invite accepted)

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured, ensureSchema } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });
  await ensureSchema();

  const sql = getDb();

  // ── GET: peek at token ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { token } = req.query as { token: string };
    if (!token) return res.status(400).json({ error: 'token required' });

    const rows = await sql`
      SELECT inviter_email, invitee_email, company_name, role, status, expires_at
      FROM bos_invites WHERE token = ${token} LIMIT 1
    ` as unknown as { inviter_email: string; invitee_email: string; company_name: string; role: string; status: string; expires_at: string }[];

    const row = (rows as typeof rows)[0];
    if (!row) return res.status(404).json({ error: 'Invite not found or already used' });
    if (row.status !== 'pending') return res.status(410).json({ error: 'Invite already accepted or revoked' });
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });

    return res.json({
      inviterEmail: row.inviter_email,
      companyName: row.company_name,
      role: row.role,
      inviteeEmail: row.invitee_email,
    });
  }

  // ── POST: accept ───────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { token } = req.body as { token: string };
    if (!token) return res.status(400).json({ error: 'token required' });

    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Must be signed in to accept invite' });

    const rows = await sql`
      SELECT id, inviter_email, invitee_email, company_name, role, status, expires_at
      FROM bos_invites WHERE token = ${token} LIMIT 1
    ` as unknown as { id: string; inviter_email: string; invitee_email: string; company_name: string; role: string; status: string; expires_at: string }[];

    const row = (rows as typeof rows)[0];
    if (!row) return res.status(404).json({ error: 'Invite not found' });
    if (row.status !== 'pending') return res.status(410).json({ error: 'Invite already accepted or revoked' });
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });

    // Upsert membership
    await sql`
      INSERT INTO bos_company_members (owner_email, member_email, role)
      VALUES (${row.inviter_email}, ${user.email}, ${row.role})
      ON CONFLICT (owner_email, member_email) DO UPDATE SET role = EXCLUDED.role
    `;

    // Mark invite accepted
    await sql`
      UPDATE bos_invites SET status = 'accepted', accepted_at = now() WHERE id = ${row.id}
    `;

    return res.json({ ok: true, ownerEmail: row.inviter_email, companyName: row.company_name, role: row.role });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
