// ─── /api/invites ─────────────────────────────────────────────────────────────
// GET  — list pending invites sent by the current user + accepted members
// POST — send a team invite (creates invite record + sends email via Resend)
// DELETE ?id=<id> — revoke a pending invite

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, isDbConfigured, ensureSchema } from '../../../lib/db';
import { getSessionUser } from '../../../lib/session';
import crypto from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';

async function sendInviteEmail(opts: {
  toEmail: string;
  inviterName: string;
  companyName: string;
  role: string;
  acceptUrl: string;
}) {
  if (!RESEND_API_KEY) return;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#e2e8f0;background:#0d1117">
      <h2 style="color:#fff;font-size:18px;margin:0 0 8px">You've been invited to Business OS</h2>
      <p style="color:#94a3b8;margin:0 0 20px">${opts.inviterName} has invited you to access <strong style="color:#e2e8f0">${opts.companyName}</strong> as a <strong>${opts.role}</strong>.</p>
      <a href="${opts.acceptUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Accept Invitation →</a>
      <p style="color:#475569;font-size:12px;margin-top:24px">This invite expires in 7 days. If you didn't expect this, you can safely ignore this email.</p>
    </div>
  `;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Business OS <noreply@businessos.app>',
      to: opts.toEmail,
      subject: `${opts.inviterName} invited you to ${opts.companyName} on Business OS`,
      html,
    }),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isDbConfigured()) return res.status(503).json({ error: 'Database not configured' });
  await ensureSchema();

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const sql = getDb();

  // ── GET: list invites + members ────────────────────────────────────────────
  if (req.method === 'GET') {
    const [invites, members] = await Promise.all([
      sql`SELECT id, invitee_email, role, status, created_at, expires_at FROM bos_invites WHERE inviter_email = ${user.email} ORDER BY created_at DESC` as unknown as Promise<{id:string;invitee_email:string;role:string;status:string;created_at:string;expires_at:string}[]>,
      sql`SELECT id, member_email, role, joined_at FROM bos_company_members WHERE owner_email = ${user.email} ORDER BY joined_at DESC` as unknown as Promise<{id:string;member_email:string;role:string;joined_at:string}[]>,
    ]);
    return res.json({ invites: await invites, members: await members });
  }

  // ── POST: send invite ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { email: inviteeEmail, role = 'viewer' } = req.body as { email: string; role?: string };
    if (!inviteeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    if (inviteeEmail.toLowerCase() === user.email.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot invite yourself' });
    }
    if (!['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be viewer or editor' });
    }

    // Check existing active invite
    const existing = await sql`
      SELECT id FROM bos_invites
      WHERE inviter_email = ${user.email} AND invitee_email = ${inviteeEmail.toLowerCase()} AND status = 'pending'
      LIMIT 1
    ` as unknown as {id:string}[];
    if ((existing as {id:string}[]).length > 0) {
      return res.status(409).json({ error: 'Invite already sent to this email' });
    }

    // Get inviter's name + company
    const profileRows = await sql`SELECT name, company_name FROM bos_users WHERE email = ${user.email} LIMIT 1` as unknown as {name:string;company_name:string}[];
    const profile = (profileRows as {name:string;company_name:string}[])[0] ?? { name: user.email, company_name: 'Business OS' };

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.host}`;
    const acceptUrl = `${baseUrl}/accept-invite?token=${token}`;

    await sql`
      INSERT INTO bos_invites (inviter_email, invitee_email, company_name, token, role, status, expires_at)
      VALUES (${user.email}, ${inviteeEmail.toLowerCase()}, ${profile.company_name ?? ''}, ${token}, ${role}, 'pending', ${expiresAt})
    `;

    // Fire-and-forget email
    sendInviteEmail({
      toEmail: inviteeEmail,
      inviterName: profile.name ?? user.email,
      companyName:  profile.company_name ?? 'Business OS',
      role,
      acceptUrl,
    }).catch(() => null);

    return res.status(201).json({ ok: true, message: `Invite sent to ${inviteeEmail}` });
  }

  // ── DELETE: revoke invite ──────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query as { id: string };
    if (!id) return res.status(400).json({ error: 'id required' });
    await sql`DELETE FROM bos_invites WHERE id = ${id} AND inviter_email = ${user.email}`;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
