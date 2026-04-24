// ─── Email via Resend ─────────────────────────────────────────────────────────
// Requires RESEND_API_KEY env var. Falls back gracefully if not set.
// Get a free key at resend.com — 3,000 emails/month, no credit card.

interface SendOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' };

  const from = process.env.EMAIL_FROM ?? 'Business OS <noreply@business-os.app>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
}

export function passwordResetEmail(resetUrl: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#060a12;color:#e2e8f0">
      <div style="margin-bottom:32px">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:#4f46e5;margin-bottom:16px">
          <svg viewBox="0 0 12 12" fill="white" width="24" height="24"><rect x="1" y="1" width="4" height="4" rx="0.5"/><rect x="7" y="1" width="4" height="4" rx="0.5"/><rect x="1" y="7" width="4" height="4" rx="0.5"/><rect x="7" y="7" width="4" height="4" rx="0.5"/></svg>
        </div>
        <h1 style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9">Reset your password</h1>
      </div>
      <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px">
        Click the button below to set a new password for your Business OS account. This link expires in 1 hour.
      </p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:white;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px">
        Reset password →
      </a>
      <p style="color:#475569;font-size:12px;margin-top:32px;line-height:1.5">
        If you didn't request this, you can safely ignore this email. Your password won't change.
      </p>
    </div>
  `;
}
