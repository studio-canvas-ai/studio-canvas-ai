-- Credit-pool schema marker (1 = legacy FHD/4K counts, 2 = unified pool in fhd_remaining).
alter table public.user_download_quota
  add column if not exists quota_schema_version integer not null default 1
  check (quota_schema_version >= 1);
