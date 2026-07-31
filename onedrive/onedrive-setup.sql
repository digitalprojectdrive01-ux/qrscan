-- Store for the rotating OneDrive refresh token (locked down: RLS on, no policies,
-- so only the service key used by the cron function can read/write it).
create table if not exists public.app_secrets (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
-- (No policies on purpose -> anon/authenticated get nothing; service key bypasses RLS.)
