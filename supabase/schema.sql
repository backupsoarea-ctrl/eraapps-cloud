-- EraApps shared database foundation for Supabase.
-- Run in the Supabase SQL Editor. Browser clients must use the publishable/anon key only.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text not null default '',
  full_name text not null default '',
  role text not null check (role in ('admin', 'user')),
  user_type text not null default 'ERO',
  nik text not null default '',
  organization text not null default '',
  lob text not null default '',
  tsh text not null default '',
  store_code text not null default '',
  store_name text not null default '',
  must_change_password boolean not null default false,
  account_status text not null default 'approved',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  password_changed_at timestamptz,
  account_status_reason text not null default '',
  rejected_by uuid references public.profiles(id),
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists email text not null default '',
  add column if not exists user_type text not null default 'ERO',
  add column if not exists nik text not null default '',
  add column if not exists organization text not null default '',
  add column if not exists account_status text not null default 'approved',
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists password_changed_at timestamptz,
  add column if not exists account_status_reason text not null default '',
  add column if not exists rejected_by uuid references public.profiles(id),
  add column if not exists rejected_at timestamptz;

update public.profiles p
set email = lower(u.email)
from auth.users u
where p.id = u.id and p.email = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_user_type_check'
  ) then
    alter table public.profiles add constraint profiles_user_type_check
      check (user_type in ('LOB', 'TSH', 'Store Leader', 'ERO', 'Promotor'));
  end if;
end;
$$;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_scope_segments_check'
  ) then
    alter table public.profiles add constraint profiles_scope_segments_check
      check (position('|' in lob) = 0 and position('|' in tsh) = 0 and position('|' in store_code) = 0);
  end if;
end;
$$;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_account_status_check'
  ) then
    alter table public.profiles add constraint profiles_account_status_check
      check (account_status in ('pending', 'approved', 'rejected'));
  end if;
end;
$$;

create table if not exists public.staff (
  code text primary key,
  name text not null,
  nik text not null default '',
  lob text not null default '',
  tsh text not null default '',
  store_code text not null default '',
  store_name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.staff add column if not exists nik text not null default '';
create unique index if not exists staff_nik_unique_idx on public.staff(nik) where nik <> '';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.staff'::regclass and conname = 'staff_scope_segments_check'
  ) then
    alter table public.staff add constraint staff_scope_segments_check
      check (position('|' in lob) = 0 and position('|' in tsh) = 0 and position('|' in store_code) = 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.staff'::regclass and conname = 'staff_nik_format_check'
  ) then
    alter table public.staff add constraint staff_nik_format_check
      check (nik = '' or nik ~ '^[0-9]{16}$');
  end if;
end;
$$;

create table if not exists public.staff_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  staff_code text not null references public.staff(code) on delete cascade on update cascade,
  primary key (user_id, staff_code)
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  staff_code text not null references public.staff(code) on update cascade,
  occurred_at timestamptz not null default now(),
  local_date date not null default current_date,
  local_time text not null default '',
  action text not null,
  detail text not null default '',
  photo_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  staff_code text not null references public.staff(code),
  employee_name text not null,
  username text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create table if not exists public.admin_recovery_uses (
  token_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  used_at timestamptz not null default now()
);
alter table public.admin_recovery_uses enable row level security;
revoke all on public.admin_recovery_uses from anon, authenticated;
grant all on public.admin_recovery_uses to service_role;

create table if not exists public.login_attempts (
  username text primary key,
  failed_attempts integer not null default 0,
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;
grant all on public.login_attempts to service_role;

create table if not exists public.promo_folders (
  id uuid primary key default gen_random_uuid(),
  path text unique not null,
  parent_path text,
  scope_type text not null default 'global',
  scope_value text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
insert into public.promo_folders (path, parent_path)
values ('Umum', null), ('Highlight', null)
on conflict (path) do nothing;

create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  folder_path text not null references public.promo_folders(path) on update cascade,
  title text not null default '',
  body text not null default '',
  file_path text,
  file_name text,
  content_type text,
  storage_bucket text not null default 'app-media',
  is_highlight boolean not null default false,
  scope_type text not null default 'global',
  scope_value text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.promo_folders
  add column if not exists scope_type text not null default 'global',
  add column if not exists scope_value text not null default '';
alter table public.promos
  add column if not exists storage_bucket text not null default 'app-media',
  add column if not exists scope_type text not null default 'global',
  add column if not exists scope_value text not null default '';
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.promo_folders'::regclass and conname = 'promo_folders_scope_type_check'
  ) then
    alter table public.promo_folders add constraint promo_folders_scope_type_check
      check (scope_type in ('global', 'lob', 'tsh', 'store'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.promos'::regclass and conname = 'promos_scope_type_check'
  ) then
    alter table public.promos add constraint promos_scope_type_check
      check (scope_type in ('global', 'lob', 'tsh', 'store'));
  end if;
end;
$$;
create index if not exists profiles_hierarchy_scope_idx
  on public.profiles (user_type, lob, tsh, store_code, account_status);
create index if not exists staff_hierarchy_scope_idx
  on public.staff (lob, tsh, store_code, code);

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id, value) values (true, '{}'::jsonb) on conflict (id) do nothing;

create table if not exists public.admin_content (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.admin_content(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('folder', 'link', 'image', 'video', 'file')),
  target_roles text[] not null default array['LOB', 'TSH', 'Store Leader', 'ERO', 'Promotor'],
  url text not null default '',
  description text not null default '',
  file_path text,
  file_name text,
  content_type text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_content_target_roles_check
    check (cardinality(target_roles) > 0 and target_roles <@ array['LOB', 'TSH', 'Store Leader', 'ERO', 'Promotor']::text[]),
  constraint admin_content_payload_check
    check ((kind = 'folder' and file_path is null and url = '')
      or (kind = 'link' and url ~* '^https?://' and file_path is null)
      or (kind in ('image', 'video', 'file') and file_path is not null and url = ''))
);
create index if not exists admin_content_parent_order_idx on public.admin_content(parent_id, sort_order, title);

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.current_user_is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (
      role = 'admin'
      or (
        account_status = 'approved'
        and coalesce(password_changed_at, created_at) >= now() - interval '90 days'
        and not exists (
          select 1 from public.login_attempts a
          where a.username = public.profiles.username and a.locked_at is not null
        )
      )
    )
  );
$$;

create or replace function public.current_user_can_read_admin_content(target_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or (
      public.current_user_is_approved()
      and exists (
        select 1 from public.admin_content c
        join public.profiles p on p.id = auth.uid()
        where c.file_path = target_path and p.user_type = any(c.target_roles)
      )
    );
$$;

create or replace function public.current_user_can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when actor.role = 'admin' then true
    when actor.id = target_user_id then true
    when not public.current_user_is_approved() then false
    when target.account_status not in ('approved', 'pending') then false
    when actor.user_type = 'LOB' then
      actor.lob <> '' and lower(actor.lob) = lower(target.lob)
      and target.user_type in ('TSH', 'Store Leader', 'ERO', 'Promotor')
    when actor.user_type = 'TSH' then
      actor.lob <> '' and actor.tsh <> ''
      and lower(actor.lob) = lower(target.lob) and lower(actor.tsh) = lower(target.tsh)
      and target.user_type in ('Store Leader', 'ERO', 'Promotor')
    when actor.user_type = 'Store Leader' then
      actor.lob <> '' and actor.tsh <> '' and actor.store_code <> ''
      and lower(actor.lob) = lower(target.lob) and lower(actor.tsh) = lower(target.tsh)
      and upper(actor.store_code) = upper(target.store_code)
      and target.user_type in ('ERO', 'Promotor')
    else false
  end
  from public.profiles actor
  left join public.profiles target on target.id = target_user_id
  where actor.id = auth.uid() and target.id is not null;
$$;

create or replace function public.current_user_can_access_staff(target_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when actor.role = 'admin' then true
    when not public.current_user_is_approved() or actor.user_type = 'LOB' then false
    when actor.user_type = 'TSH' then
      actor.lob <> '' and actor.tsh <> ''
      and lower(actor.lob) = lower(person.lob) and lower(actor.tsh) = lower(person.tsh)
    when actor.user_type = 'Store Leader' then
      actor.lob <> '' and actor.tsh <> '' and actor.store_code <> ''
      and lower(actor.lob) = lower(person.lob) and lower(actor.tsh) = lower(person.tsh)
      and upper(actor.store_code) = upper(person.store_code)
    else exists (
      select 1 from public.staff_access
      where user_id = actor.id and staff_code = target_code
    )
  end
  from public.profiles actor
  left join public.staff person on person.code = target_code
  where actor.id = auth.uid() and person.code is not null;
$$;

create or replace function public.current_user_can_view_staff(target_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when actor.role = 'admin' then true
    when not public.current_user_is_approved() then false
    when actor.user_type = 'LOB' then actor.lob <> '' and lower(actor.lob) = lower(person.lob)
    when actor.user_type = 'TSH' then
      actor.lob <> '' and actor.tsh <> ''
      and lower(actor.lob) = lower(person.lob) and lower(actor.tsh) = lower(person.tsh)
    when actor.user_type = 'Store Leader' then
      actor.lob <> '' and actor.tsh <> '' and actor.store_code <> ''
      and lower(actor.lob) = lower(person.lob) and lower(actor.tsh) = lower(person.tsh)
      and upper(actor.store_code) = upper(person.store_code)
    else exists (
      select 1 from public.staff_access
      where user_id = actor.id and staff_code = target_code
    )
  end
  from public.profiles actor
  left join public.staff person on person.code = target_code
  where actor.id = auth.uid() and person.code is not null;
$$;

create or replace function public.current_user_can_record_attendance(target_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin() or (
    public.current_user_is_approved()
    and (select user_type from public.profiles where id = auth.uid()) <> 'LOB'
    and public.current_user_can_access_staff(target_code)
  );
$$;

create or replace function public.current_user_can_approve_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when actor.role = 'admin' then true
    when not public.current_user_is_approved() or target.account_status <> 'pending' then false
    when target.user_type = 'LOB' then false
    when target.user_type = 'TSH' then actor.user_type = 'LOB'
      and actor.lob <> '' and lower(actor.lob) = lower(target.lob)
    when target.user_type = 'Store Leader' then actor.user_type = 'TSH'
      and actor.lob <> '' and actor.tsh <> ''
      and lower(actor.lob) = lower(target.lob) and lower(actor.tsh) = lower(target.tsh)
    when target.user_type in ('ERO', 'Promotor') then actor.user_type = 'Store Leader'
      and actor.lob <> '' and actor.tsh <> '' and actor.store_code <> ''
      and lower(actor.lob) = lower(target.lob) and lower(actor.tsh) = lower(target.tsh)
      and upper(actor.store_code) = upper(target.store_code)
    else false
  end
  from public.profiles actor
  join public.profiles target on target.id = target_user_id
  where actor.id = auth.uid();
$$;

create or replace function public.current_user_can_view_promo(target_scope_type text, target_scope_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when actor.role = 'admin' then true
    when not public.current_user_is_approved() then false
    when target_scope_type = 'global' then true
    when target_scope_type = 'lob' then actor.lob <> '' and lower(actor.lob) = lower(target_scope_value)
    when target_scope_type = 'tsh' then
      (actor.user_type = 'TSH' and actor.lob <> '' and actor.tsh <> ''
        and lower(actor.lob || '|' || actor.tsh) = lower(target_scope_value))
      or (actor.user_type in ('Store Leader', 'ERO', 'Promotor') and actor.lob <> '' and actor.tsh <> ''
        and lower(actor.lob || '|' || actor.tsh) = lower(target_scope_value))
      or (actor.user_type = 'LOB' and actor.lob <> '' and exists (
        select 1 from public.profiles scoped
        where scoped.user_type = 'TSH' and lower(scoped.lob) = lower(actor.lob)
          and lower(scoped.lob || '|' || scoped.tsh) = lower(target_scope_value)
      ))
    when target_scope_type = 'store' then
      (actor.user_type in ('Store Leader', 'ERO', 'Promotor') and actor.lob <> '' and actor.tsh <> '' and actor.store_code <> ''
        and lower(actor.lob || '|' || actor.tsh || '|' || actor.store_code) = lower(target_scope_value))
      or (actor.user_type = 'TSH' and actor.lob <> '' and actor.tsh <> '' and exists (
        select 1 from public.staff scoped
        where lower(scoped.lob || '|' || scoped.tsh || '|' || scoped.store_code) = lower(target_scope_value)
          and lower(scoped.lob) = lower(actor.lob) and lower(scoped.tsh) = lower(actor.tsh)
      ))
      or (actor.user_type = 'TSH' and actor.lob <> '' and actor.tsh <> '' and exists (
        select 1 from public.profiles scoped
        where scoped.user_type = 'Store Leader' and scoped.account_status = 'approved'
          and lower(scoped.lob || '|' || scoped.tsh || '|' || scoped.store_code) = lower(target_scope_value)
          and lower(scoped.lob) = lower(actor.lob) and lower(scoped.tsh) = lower(actor.tsh)
      ))
      or (actor.user_type = 'LOB' and actor.lob <> '' and exists (
        select 1 from public.staff scoped
        where lower(scoped.lob || '|' || scoped.tsh || '|' || scoped.store_code) = lower(target_scope_value)
          and lower(scoped.lob) = lower(actor.lob)
      ))
      or (actor.user_type = 'LOB' and actor.lob <> '' and exists (
        select 1 from public.profiles scoped
        where scoped.user_type = 'Store Leader' and scoped.account_status = 'approved'
          and lower(scoped.lob || '|' || scoped.tsh || '|' || scoped.store_code) = lower(target_scope_value)
          and lower(scoped.lob) = lower(actor.lob)
      ))
    else false
  end
  from public.profiles actor
  where actor.id = auth.uid();
$$;

create or replace function public.current_user_can_manage_promo(target_scope_type text, target_scope_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when actor.role = 'admin' then true
    when not public.current_user_is_approved() then false
    when actor.user_type = 'LOB' and target_scope_type = 'lob' then actor.lob <> '' and lower(actor.lob) = lower(target_scope_value)
    else false
  end
  from public.profiles actor
  where actor.id = auth.uid();
$$;

create or replace function public.current_user_can_download_promo(target_scope_type text, target_scope_value text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_view_promo(target_scope_type, target_scope_value)
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and (role = 'admin' or user_type <> 'Promotor')
    );
$$;

create or replace function public.current_user_can_read_media(target_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or (
      public.current_user_is_approved()
      and (
        exists (
          select 1 from public.app_settings
          where value ->> 'bgImage' = target_path or value ->> 'logo' = target_path
        )
        or exists (
          select 1 from public.promos p
          where p.file_path = target_path
            and p.storage_bucket = 'app-media'
            and public.current_user_can_view_promo(p.scope_type, p.scope_value)
            and (
              public.current_user_can_download_promo(p.scope_type, p.scope_value)
              or lower(coalesce(p.content_type, '')) like 'image/%'
              or lower(coalesce(p.file_name, '')) ~ '\.(jpe?g|png|gif|webp|bmp|avif)$'
            )
        )
      )
    );
$$;

create or replace function public.current_user_can_upload_promo_media(target_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and public.current_user_is_approved()
        and split_part(target_path, '/', 1) = 'promos'
        and (
          (p.user_type = 'LOB' and split_part(target_path, '/', 2) = 'lob'
            and split_part(target_path, '/', 3) = regexp_replace(lower(trim(p.lob)), '[^a-z0-9_-]+', '-', 'g'))
          or (p.user_type = 'TSH' and split_part(target_path, '/', 2) = 'tsh'
            and split_part(target_path, '/', 3) = regexp_replace(lower(trim(p.lob)), '[^a-z0-9_-]+', '-', 'g')
            and split_part(target_path, '/', 4) = regexp_replace(lower(trim(p.tsh)), '[^a-z0-9_-]+', '-', 'g'))
          or (p.user_type = 'Store Leader' and split_part(target_path, '/', 2) = 'store'
            and split_part(target_path, '/', 3) = regexp_replace(lower(trim(p.lob)), '[^a-z0-9_-]+', '-', 'g')
            and split_part(target_path, '/', 4) = regexp_replace(lower(trim(p.tsh)), '[^a-z0-9_-]+', '-', 'g')
            and split_part(target_path, '/', 5) = regexp_replace(lower(trim(p.store_code)), '[^a-z0-9_-]+', '-', 'g'))
        )
    );
$$;

create or replace function public.current_user_can_delete_promo_media(target_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_upload_promo_media(target_path);
$$;

create or replace function public.mark_password_changed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false, password_changed_at = now()
  where id = auth.uid();
$$;
revoke all on function public.mark_password_changed() from public;
grant execute on function public.mark_password_changed() to authenticated;

create or replace function public.record_login_failure(target_username text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  attempts integer;
  normalized_username text := lower(trim(target_username));
begin
  if normalized_username !~ '^[a-z0-9._-]{3,40}$' then
    raise exception 'Username tidak valid.';
  end if;
  insert into public.login_attempts (username, failed_attempts, locked_at)
  values (normalized_username, 1, null)
  on conflict (username) do update
    set failed_attempts = case
          when public.login_attempts.locked_at is null then public.login_attempts.failed_attempts + 1
          else public.login_attempts.failed_attempts
        end,
        locked_at = case
          when public.login_attempts.locked_at is null
            and public.login_attempts.failed_attempts + 1 > 3 then now()
          else public.login_attempts.locked_at
        end,
        updated_at = now()
  returning failed_attempts into attempts;
  return attempts;
end;
$$;
revoke all on function public.record_login_failure(text) from public, anon, authenticated;
grant execute on function public.record_login_failure(text) to service_role;

create or replace function public.clear_login_failures(target_username text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.login_attempts
  set failed_attempts = 0, locked_at = null, updated_at = now()
  where username = lower(trim(target_username));
$$;
revoke all on function public.clear_login_failures(text) from public, anon, authenticated;
grant execute on function public.clear_login_failures(text) to service_role;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_username text := lower(trim(coalesce(metadata ->> 'username', '')));
  profile_name text := trim(coalesce(metadata ->> 'full_name', ''));
  profile_type text := coalesce(metadata ->> 'user_type', 'ERO');
  profile_status text := 'pending';
begin
  if profile_username !~ '^[a-z0-9._-]{3,40}$' then
    raise exception 'Username harus berisi 3-40 karakter huruf kecil, angka, titik, garis bawah, atau tanda hubung.';
  end if;
  if profile_type not in ('LOB', 'TSH', 'Store Leader', 'ERO', 'Promotor') then
    profile_type := 'ERO';
  end if;
  if profile_name = '' then
    raise exception 'Nama pengguna wajib diisi.';
  end if;
  if coalesce(metadata ->> 'lob', '') like '%|%'
    or coalesce(metadata ->> 'tsh', '') like '%|%'
    or coalesce(metadata ->> 'store_code', '') like '%|%' then
    raise exception 'Nama LOB, TSH, dan kode toko tidak boleh berisi karakter |.';
  end if;
  if profile_type = 'LOB' and (
    trim(coalesce(metadata ->> 'organization', '')) = ''
    or trim(coalesce(metadata ->> 'lob', '')) = ''
  ) then
    raise exception 'Organisasi dan LOB wajib diisi.';
  elsif profile_type = 'TSH' and (
    trim(coalesce(metadata ->> 'organization', '')) = ''
    or trim(coalesce(metadata ->> 'lob', '')) = ''
    or trim(coalesce(metadata ->> 'tsh', '')) = ''
  ) then
    raise exception 'Organisasi, LOB, dan TSH wajib diisi.';
  elsif profile_type = 'Store Leader' and (
    trim(coalesce(metadata ->> 'organization', '')) = ''
    or trim(coalesce(metadata ->> 'lob', '')) = ''
    or trim(coalesce(metadata ->> 'tsh', '')) = ''
    or trim(coalesce(metadata ->> 'store_code', '')) = ''
    or trim(coalesce(metadata ->> 'store_name', '')) = ''
  ) then
    raise exception 'Organisasi, LOB, TSH, dan data toko wajib diisi.';
  elsif profile_type in ('ERO', 'Promotor') and (
    trim(coalesce(metadata ->> 'organization', '')) = ''
    or trim(coalesce(metadata ->> 'lob', '')) = ''
    or trim(coalesce(metadata ->> 'tsh', '')) = ''
    or trim(coalesce(metadata ->> 'store_code', '')) = ''
    or trim(coalesce(metadata ->> 'store_name', '')) = ''
  ) then
    raise exception 'Organisasi, LOB, TSH, dan data toko wajib diisi.';
  end if;

  insert into public.profiles (
    id, username, email, full_name, role, user_type, nik, organization,
    lob, tsh, store_code, store_name, account_status, password_changed_at
  ) values (
    new.id, profile_username, lower(new.email), profile_name, 'user', profile_type,
    trim(coalesce(metadata ->> 'nik', '')),
    trim(coalesce(metadata ->> 'organization', '')),
    trim(coalesce(metadata ->> 'lob', '')),
    trim(coalesce(metadata ->> 'tsh', '')),
    upper(trim(coalesce(metadata ->> 'store_code', ''))),
    trim(coalesce(metadata ->> 'store_name', '')), profile_status, now()
  );
  return new;
end;
$$;

create or replace function public.sync_profile_email_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_email_after_auth_email_change on auth.users;
create trigger sync_profile_email_after_auth_email_change
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email_from_auth_user();

drop trigger if exists create_profile_after_auth_signup on auth.users;
create trigger create_profile_after_auth_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

revoke all on function public.current_user_is_admin() from public;
revoke all on function public.current_user_is_approved() from public;
revoke all on function public.current_user_can_view_profile(uuid) from public;
revoke all on function public.current_user_can_access_staff(text) from public;
revoke all on function public.current_user_can_view_staff(text) from public;
revoke all on function public.current_user_can_record_attendance(text) from public;
revoke all on function public.current_user_can_approve_profile(uuid) from public;
revoke all on function public.current_user_can_view_promo(text, text) from public;
revoke all on function public.current_user_can_manage_promo(text, text) from public;
revoke all on function public.current_user_can_download_promo(text, text) from public;
revoke all on function public.current_user_can_read_media(text) from public;
revoke all on function public.current_user_can_upload_promo_media(text) from public;
revoke all on function public.current_user_can_delete_promo_media(text) from public;
revoke all on function public.current_user_can_read_admin_content(text) from public;
revoke all on function public.create_profile_for_auth_user() from public;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_user_is_approved() to authenticated;
grant execute on function public.current_user_can_view_profile(uuid) to authenticated;
grant execute on function public.current_user_can_access_staff(text) to authenticated;
grant execute on function public.current_user_can_view_staff(text) to authenticated;
grant execute on function public.current_user_can_record_attendance(text) to authenticated;
grant execute on function public.current_user_can_approve_profile(uuid) to authenticated;
grant execute on function public.current_user_can_view_promo(text, text) to authenticated;
grant execute on function public.current_user_can_manage_promo(text, text) to authenticated;
grant execute on function public.current_user_can_download_promo(text, text) to authenticated;
grant execute on function public.current_user_can_read_media(text) to authenticated;
grant execute on function public.current_user_can_upload_promo_media(text) to authenticated;
grant execute on function public.current_user_can_delete_promo_media(text) to authenticated;
grant execute on function public.current_user_can_read_admin_content(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.staff_access enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.password_reset_requests enable row level security;
alter table public.promo_folders enable row level security;
alter table public.promos enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_content enable row level security;

drop policy if exists "profiles read self or admin" on public.profiles;
drop policy if exists "profiles read hierarchy" on public.profiles;
drop policy if exists "profiles admin manage" on public.profiles;
drop policy if exists "staff read authorized" on public.staff;
drop policy if exists "staff admin manage" on public.staff;
drop policy if exists "staff access read self or admin" on public.staff_access;
drop policy if exists "staff access admin manage" on public.staff_access;
drop policy if exists "attendance read authorized" on public.attendance_logs;
drop policy if exists "attendance insert own staff" on public.attendance_logs;
drop policy if exists "attendance admin manage" on public.attendance_logs;
drop policy if exists "reset requests admin read" on public.password_reset_requests;
drop policy if exists "reset requests admin resolve" on public.password_reset_requests;
drop policy if exists "promo folders authenticated read" on public.promo_folders;
drop policy if exists "promo folders scoped read" on public.promo_folders;
drop policy if exists "promo folders scoped insert" on public.promo_folders;
drop policy if exists "promo folders scoped update" on public.promo_folders;
drop policy if exists "promo folders scoped delete" on public.promo_folders;
drop policy if exists "promos authenticated read" on public.promos;
drop policy if exists "promos scoped read" on public.promos;
drop policy if exists "promos scoped insert" on public.promos;
drop policy if exists "promos scoped update" on public.promos;
drop policy if exists "promos scoped delete" on public.promos;
drop policy if exists "settings authenticated read" on public.app_settings;
drop policy if exists "settings admin manage" on public.app_settings;
drop policy if exists "admin content read by role" on public.admin_content;
drop policy if exists "admin content admin manage" on public.admin_content;

create policy "profiles read self or admin" on public.profiles for select to authenticated
  using (public.current_user_can_view_profile(id));
create policy "profiles admin manage" on public.profiles for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "staff read authorized" on public.staff for select to authenticated
  using (public.current_user_can_view_staff(code));
create policy "staff admin manage" on public.staff for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "staff access read self or admin" on public.staff_access for select to authenticated
  using (user_id = auth.uid() or public.current_user_is_admin() or public.current_user_can_view_profile(user_id));
create policy "staff access admin manage" on public.staff_access for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "attendance read authorized" on public.attendance_logs for select to authenticated
  using (public.current_user_can_access_staff(staff_code));
create policy "attendance insert own staff" on public.attendance_logs for insert to authenticated
  with check (created_by = auth.uid() and public.current_user_can_record_attendance(staff_code));
create policy "attendance admin manage" on public.attendance_logs for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- Password reset submissions should be validated by a Supabase Edge Function using the service role.
-- Do not grant anonymous insert/select access to this table.
create policy "reset requests admin read" on public.password_reset_requests for select to authenticated
  using (public.current_user_is_admin());
create policy "reset requests admin resolve" on public.password_reset_requests for update to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "promo folders scoped read" on public.promo_folders for select to authenticated
  using (public.current_user_can_view_promo(scope_type, scope_value));
create policy "promo folders scoped insert" on public.promo_folders for insert to authenticated
  with check (created_by = auth.uid() and public.current_user_can_manage_promo(scope_type, scope_value));
create policy "promo folders scoped update" on public.promo_folders for update to authenticated
  using (public.current_user_can_manage_promo(scope_type, scope_value))
  with check (public.current_user_can_manage_promo(scope_type, scope_value));
create policy "promo folders scoped delete" on public.promo_folders for delete to authenticated
  using (public.current_user_can_manage_promo(scope_type, scope_value));
create policy "promos scoped read" on public.promos for select to authenticated
  using (public.current_user_can_view_promo(scope_type, scope_value));
create policy "promos scoped insert" on public.promos for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.current_user_can_manage_promo(scope_type, scope_value)
    and (scope_type <> 'global' or public.current_user_is_admin())
  );
create policy "promos scoped update" on public.promos for update to authenticated
  using (public.current_user_can_manage_promo(scope_type, scope_value))
  with check (public.current_user_can_manage_promo(scope_type, scope_value));
create policy "promos scoped delete" on public.promos for delete to authenticated
  using (public.current_user_can_manage_promo(scope_type, scope_value));

create policy "settings authenticated read" on public.app_settings for select to authenticated using (public.current_user_is_approved());
create policy "settings admin manage" on public.app_settings for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "admin content read by role" on public.admin_content for select to authenticated
  using (
    public.current_user_is_admin()
    or (public.current_user_is_approved() and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.user_type = any(target_roles)
    ))
  );
create policy "admin content admin manage" on public.admin_content for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

insert into storage.buckets (id, name, public)
values ('attendance-proofs', 'attendance-proofs', false), ('app-media', 'app-media', false), ('admin-content', 'admin-content', false)
on conflict (id) do update set public = excluded.public;
update storage.buckets set file_size_limit = 5242880 where id = 'admin-content';

drop policy if exists "attendance proof read authorized" on storage.objects;
drop policy if exists "attendance proof insert authorized" on storage.objects;
drop policy if exists "attendance proof admin delete" on storage.objects;
drop policy if exists "app media authenticated read" on storage.objects;
drop policy if exists "app media admin manage" on storage.objects;
drop policy if exists "app media scoped read" on storage.objects;
drop policy if exists "app media scoped insert" on storage.objects;
drop policy if exists "app media scoped delete" on storage.objects;
drop policy if exists "admin content media read scoped" on storage.objects;
drop policy if exists "admin content media admin manage" on storage.objects;

create policy "attendance proof read authorized" on storage.objects for select to authenticated
  using (bucket_id = 'attendance-proofs' and public.current_user_can_access_staff((storage.foldername(name))[1]));
create policy "attendance proof insert authorized" on storage.objects for insert to authenticated
  with check (bucket_id = 'attendance-proofs' and public.current_user_can_record_attendance((storage.foldername(name))[1]));
create policy "attendance proof admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attendance-proofs' and public.current_user_is_admin());
create policy "app media scoped read" on storage.objects for select to authenticated
  using (bucket_id = 'app-media' and public.current_user_can_read_media(name));
create policy "app media scoped insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'app-media'
    and (
      (public.current_user_is_admin() and split_part(name, '/', 1) <> 'promos')
      or public.current_user_can_upload_promo_media(name)
    )
  );
create policy "app media scoped delete" on storage.objects for delete to authenticated
  using (bucket_id = 'app-media' and public.current_user_can_delete_promo_media(name));
create policy "admin content media read scoped" on storage.objects for select to authenticated
  using (bucket_id = 'admin-content' and public.current_user_can_read_admin_content(name));
create policy "admin content media admin manage" on storage.objects for all to authenticated
  using (bucket_id = 'admin-content' and public.current_user_is_admin())
  with check (bucket_id = 'admin-content' and public.current_user_is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_logs') then
    alter publication supabase_realtime add table public.attendance_logs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff') then
    alter publication supabase_realtime add table public.staff;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff_access') then
    alter publication supabase_realtime add table public.staff_access;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'promos') then
    alter publication supabase_realtime add table public.promos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'promo_folders') then
    alter publication supabase_realtime add table public.promo_folders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings') then
    alter publication supabase_realtime add table public.app_settings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_content') then
    alter publication supabase_realtime add table public.admin_content;
  end if;
end;
$$;
