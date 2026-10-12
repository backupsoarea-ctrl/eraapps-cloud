-- EraApps shared database foundation for Supabase.
-- Run in the Supabase SQL Editor. Browser clients must use the publishable/anon key only.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text not null default '',
  role text not null check (role in ('admin', 'user')),
  lob text not null default '',
  tsh text not null default '',
  store_code text not null default '',
  store_name text not null default '',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  code text primary key,
  name text not null,
  lob text not null default '',
  tsh text not null default '',
  store_code text not null default '',
  store_name text not null default '',
  created_at timestamptz not null default now()
);

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

create table if not exists public.promo_folders (
  id uuid primary key default gen_random_uuid(),
  path text unique not null,
  parent_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  folder_path text not null references public.promo_folders(path) on update cascade,
  title text not null default '',
  body text not null default '',
  file_path text,
  file_name text,
  content_type text,
  is_highlight boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id, value) values (true, '{}'::jsonb) on conflict (id) do nothing;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.current_user_can_access_staff(target_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_admin() or exists (
    select 1 from public.staff_access where user_id = auth.uid() and staff_code = target_code
  );
$$;

create or replace function public.mark_password_changed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;
revoke all on function public.mark_password_changed() from public;
grant execute on function public.mark_password_changed() to authenticated;

alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.staff_access enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.password_reset_requests enable row level security;
alter table public.promo_folders enable row level security;
alter table public.promos enable row level security;
alter table public.app_settings enable row level security;

create policy "profiles read self or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_user_is_admin());
create policy "profiles admin manage" on public.profiles for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "staff read authorized" on public.staff for select to authenticated
  using (public.current_user_can_access_staff(code));
create policy "staff admin manage" on public.staff for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "staff access read self or admin" on public.staff_access for select to authenticated
  using (user_id = auth.uid() or public.current_user_is_admin());
create policy "staff access admin manage" on public.staff_access for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "attendance read authorized" on public.attendance_logs for select to authenticated
  using (public.current_user_can_access_staff(staff_code));
create policy "attendance insert own staff" on public.attendance_logs for insert to authenticated
  with check (created_by = auth.uid() and public.current_user_can_access_staff(staff_code));
create policy "attendance admin manage" on public.attendance_logs for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

-- Password reset submissions should be validated by a Supabase Edge Function using the service role.
-- Do not grant anonymous insert/select access to this table.
create policy "reset requests admin read" on public.password_reset_requests for select to authenticated
  using (public.current_user_is_admin());
create policy "reset requests admin resolve" on public.password_reset_requests for update to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "promo folders authenticated read" on public.promo_folders for select to authenticated using (true);
create policy "promo folders admin manage" on public.promo_folders for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());
create policy "promos authenticated read" on public.promos for select to authenticated using (true);
create policy "promos admin manage" on public.promos for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

create policy "settings authenticated read" on public.app_settings for select to authenticated using (true);
create policy "settings admin manage" on public.app_settings for all to authenticated
  using (public.current_user_is_admin()) with check (public.current_user_is_admin());

insert into storage.buckets (id, name, public)
values ('attendance-proofs', 'attendance-proofs', false), ('app-media', 'app-media', false)
on conflict (id) do update set public = excluded.public;

create policy "attendance proof read authorized" on storage.objects for select to authenticated
  using (bucket_id = 'attendance-proofs' and public.current_user_can_access_staff((storage.foldername(name))[1]));
create policy "attendance proof insert authorized" on storage.objects for insert to authenticated
  with check (bucket_id = 'attendance-proofs' and public.current_user_can_access_staff((storage.foldername(name))[1]));
create policy "attendance proof admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attendance-proofs' and public.current_user_is_admin());
create policy "app media authenticated read" on storage.objects for select to authenticated
  using (bucket_id = 'app-media');
create policy "app media admin manage" on storage.objects for all to authenticated
  using (bucket_id = 'app-media' and public.current_user_is_admin())
  with check (bucket_id = 'app-media' and public.current_user_is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_logs') then
    alter publication supabase_realtime add table public.attendance_logs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'staff') then
    alter publication supabase_realtime add table public.staff;
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
end;
$$;
