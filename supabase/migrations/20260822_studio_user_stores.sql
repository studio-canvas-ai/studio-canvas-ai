-- Durable studio stores: recent files, upload vault, trained vault.
-- Service role (API) writes; authenticated users may read their own rows.
-- Apply in Supabase Dashboard → SQL Editor (or supabase db push).

create extension if not exists "pgcrypto";

create table if not exists public.studio_user_stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  app_user_id text,
  kind text not null check (
    kind in (
      'recent_shared',
      'recent_photo',
      'upload_vault',
      'trained_vault'
    )
  ),
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint studio_user_stores_owner_chk check (
    user_id is not null or (app_user_id is not null and length(trim(app_user_id)) > 0)
  )
);

create unique index if not exists studio_user_stores_user_kind_uidx
  on public.studio_user_stores (user_id, kind)
  where user_id is not null;

create unique index if not exists studio_user_stores_app_kind_uidx
  on public.studio_user_stores (app_user_id, kind)
  where app_user_id is not null and user_id is null;

create index if not exists studio_user_stores_app_user_idx
  on public.studio_user_stores (app_user_id);

create index if not exists studio_user_stores_kind_updated_idx
  on public.studio_user_stores (kind, updated_at desc);

alter table public.studio_user_stores enable row level security;

drop policy if exists "studio_stores_select_own" on public.studio_user_stores;
create policy "studio_stores_select_own"
  on public.studio_user_stores
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "studio_stores_insert_own" on public.studio_user_stores;
create policy "studio_stores_insert_own"
  on public.studio_user_stores
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "studio_stores_update_own" on public.studio_user_stores;
create policy "studio_stores_update_own"
  on public.studio_user_stores
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_studio_user_stores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists studio_user_stores_set_updated_at on public.studio_user_stores;
create trigger studio_user_stores_set_updated_at
  before update on public.studio_user_stores
  for each row execute function public.set_studio_user_stores_updated_at();
