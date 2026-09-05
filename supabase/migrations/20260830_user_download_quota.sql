-- Durable FHD/4K download quota per app user (survives Vercel cold starts + deploys).
-- Service role (API) reads/writes; no end-user RLS policies.

create table if not exists public.user_download_quota (
  app_user_id text primary key,
  user_id uuid references auth.users (id) on delete set null,
  fhd_remaining integer not null check (fhd_remaining >= 0),
  uhd4k_remaining integer not null check (uhd4k_remaining >= 0),
  quota_period_start bigint not null,
  quota_period_end bigint,
  general_photo_download_count integer not null default 0 check (general_photo_download_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists user_download_quota_user_id_idx
  on public.user_download_quota (user_id)
  where user_id is not null;

create index if not exists user_download_quota_updated_idx
  on public.user_download_quota (updated_at desc);

alter table public.user_download_quota enable row level security;
