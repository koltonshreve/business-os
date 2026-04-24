// ─── /api/cron/task-reminders ─────────────────────────────────────────────────
// Called by Vercel Cron daily at 8:00 AM UTC.
// Sends a task reminder email to every user who has tasks due today or overdue.
// Protected by CRON_SECRET env var.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';
import { sendEmail } from '../../../lib/email';

function buildReminderHtml(tasks: { title: string; due_date: string | null; priority: string; overdue: boolean }[], companyName: string, baseUrl: string): string {
  const overdueItems = tasks.filter(t => t.overdue);
  const todayItems   = tasks.filter(t => !t.overdue);

  const taskRow = (t: { title: string; due_date: string | null; priority: string; overdue: boolean }) => {
    const dot = t.priority === 'p1' ? '#ef4444' : t.priority === 'p2' ? '#f59e0b' : '#64748b';
    const badge = t.overdue ? `<span style="color:#f87171;font-size:10px;font-weight:600">${Math.floor((Date.now() - new Date(t.due_date!).getTime()) / 86400000)}d overdue</span>` : `<span style="color:#94a3b8;font-size:10px">Due today</span>`;
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #1e293b">
        <div style="width:8px;height:8px;border-radius:50%;background:${dot};margin-top:4px;flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:13px;color:#e2e8f0;margin-bottom:2px">${t.title}</div>
          ${badge}
        </div>
      </div>
    `;
  };

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#060a12;color:#e2e8f0">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:#4f46e5">
          <svg viewBox="0 0 12 12" fill="white" width="18" height="18"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
        </div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#f1f5f9">${companyName}</div>
          <div style="font-size:11px;color:#475569">Business OS · Task Reminder</div>
        </div>
      </div>

      <div style="font-size:16px;font-weight:600;color:#f1f5f9;margin-bottom:6px">You have ${tasks.length} task${tasks.length !== 1 ? 's' : ''} that need attention</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:24px">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>

      ${overdueItems.length > 0 ? `
        <div style="margin-bottom:20px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#f87171;margin-bottom:8px">Overdue (${overdueItems.length})</div>
          ${overdueItems.map(taskRow).join('')}
        </div>
      ` : ''}

      ${todayItems.length > 0 ? `
        <div style="margin-bottom:24px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:8px">Due Today (${todayItems.length})</div>
          ${todayItems.map(taskRow).join('')}
        </div>
      ` : ''}

      <a href="${baseUrl}" style="display:inline-block;padding:10px 20px;background:#4f46e5;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
        Open Task Board →
      </a>

      <div style="margin-top:32px;font-size:11px;color:#334155">
        Business OS · You're receiving this because you have tasks due.<br/>
        <a href="${baseUrl}/auth" style="color:#475569">Manage account</a>
      </div>
    </div>
  `;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.host}`;

  // Find all users with tasks due today or overdue (not done/dismissed)
  const tasksByUser = await sql`
    SELECT
      t.user_email,
      t.title,
      t.due_date,
      t.priority,
      t.due_date < CURRENT_DATE AS overdue,
      u.name,
      COALESCE(u.company_name, 'your company') AS company_name
    FROM bos_tasks t
    JOIN bos_users u ON u.email = t.user_email
    WHERE t.status NOT IN ('done', 'dismissed')
      AND t.due_date IS NOT NULL
      AND DATE(t.due_date) <= CURRENT_DATE
      AND t.user_email IS NOT NULL
    ORDER BY t.user_email, t.due_date ASC
  ` as unknown as { user_email: string; title: string; due_date: string; priority: string; overdue: boolean; name: string | null; company_name: string }[];

  if (!tasksByUser.length) {
    return res.json({ ok: true, sent: 0, message: 'No tasks due today' });
  }

  // Group by user
  const grouped = new Map<string, typeof tasksByUser>();
  for (const row of tasksByUser) {
    if (!grouped.has(row.user_email)) grouped.set(row.user_email, []);
    grouped.get(row.user_email)!.push(row);
  }

  let sent = 0, failed = 0;
  const errors: string[] = [];

  for (const [email, tasks] of Array.from(grouped.entries())) {
    const companyName = tasks[0]!.company_name;
    const html = buildReminderHtml(tasks, companyName, baseUrl);
    const overdueCount = tasks.filter((t: { overdue: boolean }) => t.overdue).length;
    const subject = overdueCount > 0
      ? `${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''} — ${companyName}`
      : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} due today — ${companyName}`;

    const result = await sendEmail({ to: email, subject, html });
    if (result.ok) sent++;
    else { failed++; errors.push(`${email}: ${result.error ?? 'unknown'}`); }
  }

  console.log(`[cron/task-reminders] sent=${sent} failed=${failed}`);
  return res.json({ ok: true, sent, failed, ...(errors.length ? { errors } : {}) });
}
