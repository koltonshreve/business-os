// ─── /api/digest/email ────────────────────────────────────────────────────────
// POST — generate today's digest and email it to the authenticated user.
// Requires RESEND_API_KEY + ANTHROPIC_API_KEY.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '../../../lib/session';
import { sendEmail } from '../../../lib/email';
import type { DigestPayload } from '../digest';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

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
      <!-- Logo -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:#4f46e5">
          <svg viewBox="0 0 12 12" fill="white" width="18" height="18"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#f1f5f9">${companyName}</div>
          <div style="font-size:11px;color:#475569">Business OS · Daily Digest</div>
        </div>
      </div>

      <!-- Date -->
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin-bottom:16px">${date}</div>

      <!-- Greeting -->
      <div style="font-size:16px;font-weight:600;color:#f1f5f9;margin-bottom:20px">${digest.greeting}</div>

      <!-- North Star -->
      <div style="background:#1e1b4b;border:1px solid #3730a3;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#818cf8;margin-bottom:6px">Today's North Star</div>
        <div style="font-size:15px;font-weight:600;color:#c7d2fe;line-height:1.4">${digest.northStar}</div>
      </div>

      <!-- Sections -->
      <div style="border-top:1px solid #1e293b;padding-top:20px;margin-bottom:24px">
        ${sections}
      </div>

      <!-- Closing -->
      <div style="border-top:1px solid #1e293b;padding-top:20px">
        <div style="font-size:13px;color:#64748b;font-style:italic">${digest.closingLine}</div>
      </div>

      <!-- Footer -->
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { companyName = 'your company', data } = req.body ?? {};

  // Generate or retrieve today's digest via the existing /api/digest endpoint
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.host}`;
  let digest: DigestPayload;
  try {
    const digestRes = await fetch(`${baseUrl}/api/digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization ?? '' },
      body: JSON.stringify({ companyName, data }),
    });
    if (!digestRes.ok) {
      const err = await digestRes.json() as { error?: string };
      return res.status(502).json({ error: err.error ?? 'Digest generation failed' });
    }
    digest = await digestRes.json() as DigestPayload;
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'Digest fetch failed' });
  }

  const html = buildDigestHtml(digest, companyName);
  const date = new Date(digest.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const result = await sendEmail({
    to: user.email,
    subject: `${companyName} · Daily Digest — ${date}`,
    html,
  });

  if (!result.ok) {
    return res.status(502).json({ error: result.error ?? 'Email send failed', digest });
  }

  return res.json({ ok: true, sentTo: user.email, date: digest.date });
}
