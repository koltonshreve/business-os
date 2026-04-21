// ─── Database client (Neon serverless) ───────────────────────────────────────
// Uses POSTGRES_URL injected by Vercel Neon integration.
// Falls back gracefully when DB is not yet configured.

import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchConnectionCache = true;

let _sql: ReturnType<typeof neon> | null = null;

export function getDb() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL not set — connect Neon via Vercel Storage tab');
  }
  if (!_sql) _sql = neon(process.env.POSTGRES_URL);
  return _sql;
}

export function isDbConfigured(): boolean {
  return !!process.env.POSTGRES_URL;
}

// ─── Schema bootstrap (run once on first API call) ───────────────────────────
// Idempotent — safe to call on every cold start.

export async function ensureSchema(): Promise<void> {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS bos_tasks (
      id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title        text NOT NULL,
      context      text,
      impact       text,
      priority     text NOT NULL DEFAULT 'p2',
      status       text NOT NULL DEFAULT 'open',
      created_by   text NOT NULL DEFAULT 'user',
      trigger_id   text,
      entity_type  text,
      entity_id    text,
      entity_name  text,
      assignee     text DEFAULT 'you',
      due_date     timestamptz,
      completed_at timestamptz,
      snoozed_until timestamptz,
      metadata     jsonb DEFAULT '{}',
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_events (
      id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      type        text NOT NULL,
      summary     text NOT NULL,
      detail      jsonb DEFAULT '{}',
      source      text DEFAULT 'system',
      entity_type text,
      entity_id   text,
      entity_name text,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_digest (
      id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      date       date NOT NULL UNIQUE,
      payload    jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_rule_firings (
      id       text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      rule_id  text NOT NULL,
      task_id  text,
      fired_at timestamptz NOT NULL DEFAULT now(),
      date     date NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE (rule_id, date)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_user_plans (
      id                 text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      stripe_customer_id text NOT NULL UNIQUE,
      plan_id            text NOT NULL DEFAULT 'starter',
      subscription_id    text,
      email              text,
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now()
    )
  `;
}
