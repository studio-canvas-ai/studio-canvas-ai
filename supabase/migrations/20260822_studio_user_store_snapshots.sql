-- Point-in-time backups of studio_user_stores for admin rollback.
-- Apply in Supabase Dashboard → SQL Editor after 20260822_studio_user_stores.sql.

create table if not exists public.studio_user_store_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  app_user_id text not null,
  reason text not null default 'autosave',
  counts jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists studio_store_snapshots_app_user_idx
  on public.studio_user_store_snapshots (app_user_id, created_at desc);

create index if not exists studio_store_snapshots_user_idx
  on public.studio_user_store_snapshots (user_id, created_at desc)
  where user_id is not null;

alter table public.studio_user_store_snapshots enable row level security;

-- No end-user policies: only the service role (admin / API) reads and writes snapshots.
drop policy if exists "studio_snapshots_no_direct_access" on public.studio_user_store_snapshots;
