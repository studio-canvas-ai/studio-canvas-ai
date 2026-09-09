-- Account-scoped SCA recent files (SCREEN-007 / 008 / 010).
-- Service role (API) writes; authenticated users may read/update their own rows.
-- Apply in Supabase Dashboard → SQL Editor (or supabase db push).

create extension if not exists "pgcrypto";

create table if not exists public.user_saved_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  app_user_id text not null,
  screen_id text not null check (
    screen_id in ('screen_007', 'screen_008', 'screen_010')
  ),
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_saved_forms_owner_chk check (
    user_id is not null
    or (app_user_id is not null and length(trim(app_user_id)) > 0)
  )
);

create unique index if not exists user_saved_forms_user_screen_uidx
  on public.user_saved_forms (user_id, screen_id)
  where user_id is not null;

create unique index if not exists user_saved_forms_app_screen_uidx
  on public.user_saved_forms (app_user_id, screen_id);

create index if not exists user_saved_forms_app_user_idx
  on public.user_saved_forms (app_user_id);

create index if not exists user_saved_forms_updated_idx
  on public.user_saved_forms (updated_at desc);

alter table public.user_saved_forms enable row level security;

drop policy if exists "user_saved_forms_select_own" on public.user_saved_forms;
create policy "user_saved_forms_select_own"
  on public.user_saved_forms
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_saved_forms_insert_own" on public.user_saved_forms;
create policy "user_saved_forms_insert_own"
  on public.user_saved_forms
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_saved_forms_update_own" on public.user_saved_forms;
create policy "user_saved_forms_update_own"
  on public.user_saved_forms
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_user_saved_forms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_saved_forms_set_updated_at on public.user_saved_forms;
create trigger user_saved_forms_set_updated_at
  before update on public.user_saved_forms
  for each row execute function public.set_user_saved_forms_updated_at();
