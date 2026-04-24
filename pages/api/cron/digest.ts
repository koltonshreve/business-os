// ─── /api/cron/digest ─────────────────────────────────────────────────────────
// Called by Vercel Cron daily at 7:00 AM UTC.
// Sends the daily digest email to every registered user.
// Protected by CRON_SECRET env var (Vercel sets Authorization: Bearer <secret>).

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { sendEmail } from '../../../lib/email';
import type { DigestPayload } from '../digest';

function buildDigestHtml(digest: DigestPayload, companyName: string): string {
  const date = new Date(digest.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const sections = digest.sections.map(s => `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6366f1;margin-bottom:6px">${s.headline}</div>
      <div style="font-size:14px;color:#cbd5e1;line-height:1.6">${s.body}</div>
    </div>
  `).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#060a12;color:#e2e8f0">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:#4f46e5">
          <svg viewBox="0 0 12 12" fill="white" width="18" height="18"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#f1f5f9">${companyName}</div>
          <div style="font-size:11px;color:#475569">Business OS · Daily Digest</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin-bottom:16px">${date}</div>
      <div style="font-size:16px;font-weight:600;color:#f1f5f9;margin-bottom:20px">${digest.greeting}</div>

      <div style="background:#1e1b4b;border:1px solid #3730a3;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#818cf8;margin-bottom:6px">Today's North Star</div>
        <div style="font-size:15px;font-weight:600;color:#c7d2fe;line-height:1.4">${digest.northStar}</div>
      </div>

      <div style="border-top:1px solid #1e293b;padding-top:20px;margin-bottom:24px">
        ${sections}
      </div>

      <div style="border-top:1px solid #1e293b;padding-top:20px">
        <div style="font-size:13px;color:#64748b;font-style:italic">${digest.closingLine}</div>
      </div>

      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #0f172a">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://business-os-three-sand.vercel.app'}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
          Open Dashboard →
        </a>
        <div style="margin-top:16px;font-size:11px;color:#334155">
          Business OS · AI intelligence for LMM operators<br/>
          <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://business-os-three-sand.vercel.app'}/auth" style="color:#475569">Manage account</a>
        </div>
      </div>
    </div>
  `;
}

async function getOrGenerateDigest(baseUrl: string): Promise<DigestPayload | null> {
  // Try to use today's cached digest first
  if (isDbConfigured()) {
    try {
      const sql = getDb();
      const rows = await sql`
        SELECT payload FROM bos_digest WHERE date = CURRENT_DATE LIMIT 1
      ` as unknown as { payload: DigestPayload }[];
      if (rows[0]?.payload) return rows[0].payload;
    } catch { /* fall through */ }
  }

  // Generate a fresh digest (generic — no user-specific financial data at cron time)
  try {
    const cronSecret = process.env.CRON_SECRET;
    const res = await fetch(`${baseUrl}/api/digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cronSecret ? { 'Authorization': `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({ companyName: 'your company' }),
    });
    if (!res.ok) return null;
    return await res.json() as DigestPayload;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Vercel Cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  await ensureSchema();
  const sql = getDb();

  // Fetch all users
  const users = await sql`
    SELECT email, COALESCE(company_name, 'your company') as company_name
    FROM bos_users
    ORDER BY created_at ASC
  ` as unknown as { email: string; company_name: string }[];

  if (!users.length) {
    return res.json({ ok: true, sent: 0, skipped: 0, message: 'No users found' });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.host}`;
  const digest = await getOrGenerateDigest(baseUrl);

  if (!digest) {
    return res.status(502).json({ error: 'Failed to generate digest' });
  }

  const date = new Date(digest.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of users) {
    const html = buildDigestHtml(digest, user.company_name);
    const result = await sendEmail({
      to: user.email,
      subject: `${user.company_name} · Daily Digest — ${date}`,
      html,
    });

    if (result.ok) {
      sent++;
    } else {
      failed++;
      errors.push(`${user.email}: ${result.error ?? 'unknown'}`);
    }
  }

  console.log(`[cron/digest] sent=${sent} failed=${failed} date=${digest.date}`);

  return res.json({
    ok: true,
    sent,
    failed,
    date: digest.date,
    ...(errors.length ? { errors } : {}),
  });
}
