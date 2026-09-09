-- Single active login session per member (kick previous devices).
-- Privileged admin emails are exempt in app code (never forced off).
-- Apply in Supabase Dashboard → SQL Editor.

alter table public.profiles
  add column if not exists active_session_id text;

alter table public.profiles
  add column if not exists active_session_at timestamptz;

comment on column public.profiles.active_session_id is
  'Latest browser session UUID claimed on login; used to revoke older devices.';

comment on column public.profiles.active_session_at is
  'When active_session_id was last claimed.';

create index if not exists profiles_active_session_id_idx
  on public.profiles (active_session_id)
  where active_session_id is not null;
