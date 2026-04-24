// ─── /api/automations/fire ────────────────────────────────────────────────────
// POST { webhookUrl, payload? }
// Fires a webhook server-side (avoids CORS issues from the browser).
// Used by AutomationBuilder "Test" button.

import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '../../../lib/session';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { webhookUrl, payload } = req.body as { webhookUrl?: string; payload?: Record<string, unknown> };
  if (!webhookUrl) return res.status(400).json({ error: 'webhookUrl required' });

  // Basic URL validation — must be https
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only HTTPS webhooks are supported' });
  }

  const body = JSON.stringify({
    source: 'business-os',
    event: 'automation.fire',
    timestamp: new Date().toISOString(),
    userEmail: user.email,
    ...(payload ?? {}),
  });

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Business-OS/1.0' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    return res.json({ ok: true, status: r.status, statusText: r.statusText });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook delivery failed';
    return res.status(502).json({ error: msg });
  }
}
