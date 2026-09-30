-- Suvo Music database setup (run in Supabase SQL Editor).
-- Create the first admin using Supabase Dashboard > Authentication > Users.
-- IMPORTANT: set that user's UUID below, then run the ADMIN CONFIG section.

create extension if not exists pgcrypto;

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  artist text not null check (char_length(artist) between 1 and 100),
  genre text not null default 'Independent',
  playlist text not null default 'New Releases',
  audio_url text not null,
  audio_path text not null,
  cover_url text,
  cover_path text,
  views bigint not null default 0 check (views >= 0),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.songs enable row level security;

-- Public can only read published songs. Only the configured admin can insert/update/delete.
drop policy if exists "Public can read songs" on public.songs;
create policy "Public can read songs" on public.songs for select using (true);

-- Replace the UUID in this table with the UUID of your admin account.
create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.site_admins enable row level security;
drop policy if exists "Admins can read own admin row" on public.site_admins;
create policy "Admins can read own admin row" on public.site_admins for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.is_site_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.site_admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

drop policy if exists "Admin inserts songs" on public.songs;
create policy "Admin inserts songs" on public.songs for insert to authenticated
with check (public.is_site_admin() and owner_id = (select auth.uid()));
drop policy if exists "Admin updates songs" on public.songs;
create policy "Admin updates songs" on public.songs for update to authenticated
using (public.is_site_admin()) with check (public.is_site_admin());
drop policy if exists "Admin deletes songs" on public.songs;
create policy "Admin deletes songs" on public.songs for delete to authenticated
using (public.is_site_admin());

-- Views can be incremented by visitors, but the client cannot edit arbitrary song fields.
create or replace function public.increment_song_views(song_id uuid)
returns void language sql security definer
set search_path = '' as $$
  update public.songs set views = views + 1 where id = song_id;
$$;
revoke all on function public.increment_song_views(uuid) from public;
grant execute on function public.increment_song_views(uuid) to anon, authenticated;

-- Storage buckets: public reads, admin-only uploads/deletes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('songs','songs',true,20971520,array['audio/mpeg'])
on conflict (id) do update set public = true, file_size_limit = 20971520, allowed_mime_types = array['audio/mpeg'];
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers','covers',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public reads song files" on storage.objects;
create policy "Public reads song files" on storage.objects for select using (bucket_id in ('songs','covers'));

drop policy if exists "Admins upload song files" on storage.objects;
create policy "Admins upload song files" on storage.objects for insert to authenticated
with check (bucket_id in ('songs','covers') and public.is_site_admin() and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Admins delete own song files" on storage.objects;
create policy "Admins delete own song files" on storage.objects for delete to authenticated
using (bucket_id in ('songs','covers') and public.is_site_admin() and (storage.foldername(name))[1] = (select auth.uid())::text);

-- IMPORTANT ADMIN SETUP:
-- 1) Create an account through Supabase Authentication > Users, or sign up in the site.
-- 2) Copy that user's UUID from Authentication > Users.
-- 3) Run this command with the REAL UUID (replace the placeholder; do not leave it as-is):
-- insert into public.site_admins(user_id) values ('YOUR-ADMIN-USER-UUID');
-- 4) Disable public signups in Supabase Auth settings after your admin account is created.
