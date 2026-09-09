-- Align profiles with app upsert fields: name, avatar_url, app_user_id
-- Safe to re-run. Apply after 20260801 / 20260803 terms migration.

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists app_user_id text;

alter table public.profiles
  add column if not exists name text;

-- If legacy full_name exists, copy into name where name is empty
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
  ) then
    update public.profiles
    set name = coalesce(nullif(trim(name), ''), nullif(trim(full_name), ''))
    where name is null or trim(name) = '';
  end if;
end $$;

create index if not exists profiles_app_user_id_idx
  on public.profiles (app_user_id)
  where app_user_id is not null;
