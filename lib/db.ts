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
      recurrence   text NOT NULL DEFAULT 'none',
      metadata     jsonb DEFAULT '{}',
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Migration: add recurrence column to existing tables
  await sql`ALTER TABLE bos_tasks ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none'`;
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
  await sql`
    CREATE TABLE IF NOT EXISTS bos_users (
      id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email         text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      name          text,
      plan_id       text NOT NULL DEFAULT 'starter',
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_sessions (
      id         text PRIMARY KEY,
      user_id    text NOT NULL,
      email      text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_snapshots (
      id         text PRIMARY KEY,
      user_email text NOT NULL,
      label      text NOT NULL,
      data       jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bos_snapshots_email_idx ON bos_snapshots(user_email)`;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_password_resets (
      id         text PRIMARY KEY,
      user_email text NOT NULL,
      used       boolean NOT NULL DEFAULT false,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_ai_usage (
      id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_email text NOT NULL,
      year_month text NOT NULL,
      count      int  NOT NULL DEFAULT 0,
      UNIQUE (user_email, year_month)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bos_ai_usage_email_idx ON bos_ai_usage(user_email)`;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_m_deals (
      id         text PRIMARY KEY,
      user_email text NOT NULL,
      data       jsonb NOT NULL DEFAULT '{}',
      stage      text NOT NULL DEFAULT 'sourcing',
      starred    boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bos_m_deals_email_idx ON bos_m_deals(user_email)`;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_acq_targets (
      id         text PRIMARY KEY,
      user_email text NOT NULL,
      data       jsonb NOT NULL DEFAULT '{}',
      stage      text NOT NULL DEFAULT 'sourcing',
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bos_acq_targets_email_idx ON bos_acq_targets(user_email)`;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_crm_deals (
      id         text PRIMARY KEY,
      user_email text NOT NULL,
      data       jsonb NOT NULL DEFAULT '{}',
      stage      text NOT NULL DEFAULT 'lead',
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bos_crm_deals_email_idx ON bos_crm_deals(user_email)`;
  // Add columns to bos_users if not present (idempotent via DO block)
  await sql`
    DO $$ BEGIN
      BEGIN ALTER TABLE bos_users ADD COLUMN company_name text; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE bos_users ADD COLUMN company_profile jsonb DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END;
      BEGIN ALTER TABLE bos_users ADD COLUMN prefs jsonb DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END $$
  `;
  // Add user_email to bos_tasks for per-user scoping
  await sql`
    DO $$ BEGIN
      BEGIN ALTER TABLE bos_tasks ADD COLUMN user_email text; EXCEPTION WHEN duplicate_column THEN NULL; END;
    END $$
  `;
  // Team invites
  await sql`
    CREATE TABLE IF NOT EXISTS bos_invites (
      id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      inviter_email text NOT NULL,
      invitee_email text NOT NULL,
      company_name  text,
      token         text NOT NULL UNIQUE,
      role          text NOT NULL DEFAULT 'viewer',
      status        text NOT NULL DEFAULT 'pending',
      expires_at    timestamptz NOT NULL,
      accepted_at   timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bos_invites_inviter_idx ON bos_invites(inviter_email)`;
  await sql`CREATE INDEX IF NOT EXISTS bos_invites_token_idx ON bos_invites(token)`;
  await sql`
    CREATE TABLE IF NOT EXISTS bos_company_members (
      id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_email  text NOT NULL,
      member_email text NOT NULL,
      role         text NOT NULL DEFAULT 'viewer',
      joined_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (owner_email, member_email)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bos_company_members_owner_idx ON bos_company_members(owner_email)`;
}
