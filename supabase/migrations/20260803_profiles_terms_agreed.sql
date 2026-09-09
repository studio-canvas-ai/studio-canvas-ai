-- Mandatory terms consent before a member counts as registered.
-- Apply in Supabase Dashboard → SQL Editor after 20260801_profiles_rls.sql

alter table public.profiles
  add column if not exists terms_agreed boolean not null default false;

alter table public.profiles
  add column if not exists terms_agreed_at timestamptz;

comment on column public.profiles.terms_agreed is
  'True only after the user accepts Terms of Service + Privacy Policy in-app.';

comment on column public.profiles.terms_agreed_at is
  'Timestamp when terms_agreed was set to true.';

create index if not exists profiles_terms_agreed_idx
  on public.profiles (terms_agreed)
  where terms_agreed = true;
