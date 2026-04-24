// ─── /api/cron/weekly ─────────────────────────────────────────────────────────
// Called by Vercel Cron every Monday at 8:00 AM UTC.
// Sends a weekly activity summary email to every registered user.
// Protected by CRON_SECRET env var.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { sendEmail } from '../../../lib/email';

function buildWeeklyHtml(userName: string, companyName: string, stats: {
  tasksOpen: number;
  tasksCompleted: number;
  aiQueries: number;
  dealsActive: number;
}): string {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const statRows = [
    { label: 'Open Tasks', value: String(stats.tasksOpen), note: 'requiring action' },
    { label: 'Completed', value: String(stats.tasksCompleted), note: 'tasks closed this week' },
    { label: 'AI Queries', value: String(stats.aiQueries), note: 'this month' },
    { label: 'Active Deals', value: String(stats.dealsActive), note: 'in your pipeline' },
  ].map(s => `
    <div style="text-align:center;padding:12px 8px">
      <div style="font-size:24px;font-weight:800;color:#c7d2fe;font-variant-numeric:tabular-nums">${s.value}</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6366f1;margin-top:2px">${s.label}</div>
      <div style="font-size:10px;color:#475569;margin-top:1px">${s.note}</div>
    </div>
  `).join('');

  const greeting = userName ? `Good morning, ${userName.split(' ')[0]}.` : 'Good morning.';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#060a12;color:#e2e8f0">
      <!-- Logo -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:#4f46e5">
          <svg viewBox="0 0 12 12" fill="white" width="18" height="18"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#f1f5f9">${companyName}</div>
          <div style="font-size:11px;color:#475569">Business OS · Weekly Summary</div>
        </div>
      </div>

      <!-- Week label -->
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin-bottom:16px">${weekLabel}</div>

      <!-- Greeting -->
      <div style="font-size:16px;font-weight:600;color:#f1f5f9;margin-bottom:6px">${greeting}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:24px">Here's your weekly snapshot from Business OS.</div>

      <!-- Stats grid -->
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;margin-bottom:24px;overflow:hidden">
        ${statRows}
      </div>

      <!-- Nudge -->
      ${stats.tasksOpen > 0 ? `
      <div style="background:#1e1b4b;border:1px solid #3730a3;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#818cf8;margin-bottom:6px">This Week's Focus</div>
        <div style="font-size:14px;color:#c7d2fe;line-height:1.5">You have <strong>${stats.tasksOpen} open task${stats.tasksOpen === 1 ? '' : 's'}</strong> waiting. Start the week by clearing your highest-priority item first.</div>
      </div>
      ` : `
      <div style="background:#052e16;border:1px solid #166534;border-radius:12px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#4ade80;margin-bottom:6px">Clear Board</div>
        <div style="font-size:14px;color:#bbf7d0;line-height:1.5">No open tasks — you're running clean. Use today to get ahead of next week.</div>
      </div>
      `}

      <!-- CTA -->
      <div style="margin-top:8px;padding-top:20px;border-top:1px solid #1e293b">
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

  // Fetch all users with their names and company names
  const users = await sql`
    SELECT
      email,
      COALESCE(name, '') as name,
      COALESCE(company_name, 'your company') as company_name
    FROM bos_users
    ORDER BY created_at ASC
  ` as unknown as { email: string; name: string; company_name: string }[];

  if (!users.length) {
    return res.json({ ok: true, sent: 0, message: 'No users found' });
  }

  const yearMonth = new Date().toISOString().slice(0, 7);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of users) {
    // Gather per-user stats
    const [taskStats, usageRow, dealCount] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('open','active')) as open_count,
          COUNT(*) FILTER (WHERE status = 'done' AND completed_at >= now() - interval '7 days') as completed_count
        FROM bos_tasks
        WHERE user_email = ${user.email}
      ` as unknown as Promise<{ open_count: string; completed_count: string }[]>,
      sql`
        SELECT count FROM bos_ai_usage
        WHERE user_email = ${user.email} AND year_month = ${yearMonth}
        LIMIT 1
      ` as unknown as Promise<{ count: number }[]>,
      sql`
        SELECT COUNT(*) as deal_count FROM bos_crm_deals
        WHERE user_email = ${user.email} AND stage NOT IN ('closed-won','closed-lost')
      ` as unknown as Promise<{ deal_count: string }[]>,
    ]);

    const stats = {
      tasksOpen:      parseInt(taskStats[0]?.open_count ?? '0'),
      tasksCompleted: parseInt(taskStats[0]?.completed_count ?? '0'),
      aiQueries:      usageRow[0]?.count ?? 0,
      dealsActive:    parseInt(dealCount[0]?.deal_count ?? '0'),
    };

    const html = buildWeeklyHtml(user.name, user.company_name, stats);
    const result = await sendEmail({
      to: user.email,
      subject: `${user.company_name} · Weekly Summary — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html,
    });

    if (result.ok) sent++;
    else { failed++; errors.push(`${user.email}: ${result.error ?? 'unknown'}`); }
  }

  console.log(`[cron/weekly] sent=${sent} failed=${failed}`);
  return res.json({ ok: true, sent, failed, ...(errors.length ? { errors } : {}) });
}
