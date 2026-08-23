-- Run once in Supabase SQL Editor for promo codes.

create table if not exists public.promos (
  admin_id text primary key,
  code text not null unique,
  is_active boolean not null default true,
  used_count int not null default 0,
  max_uses int not null default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists promos_code_idx on public.promos (code);
create index if not exists promos_active_idx on public.promos (is_active);

alter table public.promos enable row level security;

drop policy if exists "promos public read active" on public.promos;
create policy "promos public read active"
  on public.promos for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "promos admin all" on public.promos;
create policy "promos admin all"
  on public.promos for all
  to authenticated
  using (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.admin_users au where au.user_id = auth.uid())
  );
