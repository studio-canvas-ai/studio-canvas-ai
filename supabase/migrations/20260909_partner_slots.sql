-- Fixed YouTuber partner slots (10) + referral attribution + 10% commissions.
-- Service role (API) reads/writes; no end-user RLS policies for public access.

create table if not exists public.partner_slots (
  id text primary key check (id ~ '^partner(0[1-9]|10)$'),
  code text not null unique check (code ~ '^partner(0[1-9]|10)$'),
  access_token text not null unique,
  email text,
  channel_name text,
  channel_url text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.partner_slots (id) on delete cascade,
  app_user_id text not null unique,
  supabase_user_id uuid references auth.users (id) on delete set null,
  email text,
  attributed_at timestamptz not null default now()
);

create index if not exists partner_referrals_partner_idx
  on public.partner_referrals (partner_id, attributed_at desc);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.partner_slots (id) on delete cascade,
  app_user_id text not null,
  order_id text not null unique,
  plan_id text,
  billing_interval text,
  amount_krw integer not null default 0,
  amount_usd numeric(12, 2) not null default 0,
  commission_krw integer not null default 0,
  commission_usd numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists partner_commissions_partner_idx
  on public.partner_commissions (partner_id, created_at desc);

alter table public.partner_slots enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_commissions enable row level security;

-- Seed empty slots partner01–partner10 (tokens rotatable later via admin API).
insert into public.partner_slots (id, code, access_token)
select
  'partner' || lpad(g::text, 2, '0'),
  'partner' || lpad(g::text, 2, '0'),
  'pt_' || encode(gen_random_bytes(24), 'hex')
from generate_series(1, 10) as g
on conflict (id) do nothing;
