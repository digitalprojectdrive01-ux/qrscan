-- =====================================================================
-- QR / Barcode Record Capture — Supabase setup
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

-- 1) Table -------------------------------------------------------------
create table if not exists public.scan_records (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  code          text not null,
  format        text,
  source        text,                       -- camera | image | manual
  session_label text,
  is_repeat     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Fast lookups per user, newest first
create index if not exists scan_records_user_created_idx
  on public.scan_records (user_id, created_at desc);

-- 2) Row Level Security ------------------------------------------------
alter table public.scan_records enable row level security;

-- Each user can only touch their own rows
drop policy if exists "read own records"   on public.scan_records;
drop policy if exists "insert own records" on public.scan_records;
drop policy if exists "delete own records" on public.scan_records;

create policy "read own records"
  on public.scan_records for select
  using (auth.uid() = user_id);

create policy "insert own records"
  on public.scan_records for insert
  with check (auth.uid() = user_id);

create policy "delete own records"
  on public.scan_records for delete
  using (auth.uid() = user_id);

-- =====================================================================
-- Optional: for an internal tool, turn OFF email confirmation so users
-- can sign in immediately after sign-up:
--   Dashboard → Authentication → Providers → Email → "Confirm email" = off
-- =====================================================================
