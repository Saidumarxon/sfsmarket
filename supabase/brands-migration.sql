-- Run once in Supabase SQL Editor for public brand registry sync.

create table if not exists public.brands (
  admin_id text primary key,
  is_active boolean not null default true,
  sort_order int not null default 100,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists brands_active_sort_idx on public.brands (is_active, sort_order);

alter table public.brands enable row level security;

create policy "brands public read active"
  on public.brands for select
  to anon, authenticated
  using (is_active = true);

create policy "brands admin all"
  on public.brands for all
  to authenticated
  using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );
