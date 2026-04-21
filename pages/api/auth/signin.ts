// ─── Auth: Sign In ─────────────────────────────────────────────────────────────
// Accepts an email and returns a session token.
// Token is stored client-side in localStorage; no passwords required.
// For a hard-launch, replace with a real auth provider (Clerk, NextAuth, etc.).

import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, ensureSchema, isDbConfigured } from '../../../lib/db';

function generateToken(): string {
  const arr = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    // Node.js fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require('crypto');
    randomBytes(24).copy(Buffer.from(arr.buffer));
  }
  return Buffer.from(arr).toString('base64url');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body as { email?: string };
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const token = generateToken();

  // Persist to DB if configured (so we can see who signed up)
  if (isDbConfigured()) {
    try {
      const sql = getDb();
      await ensureSchema();
      // Upsert: email already exists → update token
      await sql`
        INSERT INTO bos_user_plans (stripe_customer_id, email, plan_id, updated_at)
        VALUES (${`email:${email}`}, ${email}, 'starter', now())
        ON CONFLICT (stripe_customer_id)
        DO UPDATE SET email = EXCLUDED.email, updated_at = now()
      `;
    } catch {
      // Non-fatal — token still returned
    }
  }

  return res.status(200).json({ token, email });
}
