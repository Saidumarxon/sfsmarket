-- Run once in Supabase SQL Editor if you already applied schema.sql before banners support.

create table if not exists public.banners (
  admin_id text primary key,
  priority int not null default 100,
  is_active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists banners_active_priority_idx on public.banners (is_active, priority);

alter table public.banners enable row level security;

create policy "banners public read active"
  on public.banners for select
  to anon, authenticated
  using (is_active = true);

create policy "banners admin all"
  on public.banners for all
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));
