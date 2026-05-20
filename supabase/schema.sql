-- SFS Market / Emirate Co — run once in Supabase SQL Editor
--
-- After this script:
-- 1) Authentication → Users: add user (email + password) for the admin panel.
-- 2) Link that user to admin_users, e.g.:
--    insert into public.admin_users (user_id)
--    select id from auth.users where email = 'your@email.com' limit 1
--    on conflict do nothing;
-- 3) For scalable product photos, create a public Storage bucket:
--    insert into storage.buckets (id, name, public)
--    values ('product-media', 'product-media', true)
--    on conflict (id) do nothing;
-- 4) Add Storage policies for authenticated admins:
--    create policy "product-media public read"
--      on storage.objects for select
--      to public
--      using (bucket_id = 'product-media');
--    create policy "product-media admin write"
--      on storage.objects for all
--      to authenticated
--      using (
--        bucket_id = 'product-media'
--        and exists (select 1 from public.admin_users u where u.user_id = auth.uid())
--      )
--      with check (
--        bucket_id = 'product-media'
--        and exists (select 1 from public.admin_users u where u.user_id = auth.uid())
--      );

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.products (
  admin_id text primary key,
  title text not null,
  status text not null default 'active',
  priority int not null default 300,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists products_status_priority_idx on public.products (status, priority);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  full_name text not null,
  region text,
  city text,
  address text,
  comment_text text,
  delivery_method text,
  payment_method text,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.admin_users enable row level security;

-- Admins can only see their own row (enough for RLS checks on products)
create policy "admin_users read self"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid());

-- Catalog: guests see active products only
create policy "products public read active"
  on public.products for select
  to anon, authenticated
  using (status = 'active');

-- Admins: full access to products when listed in admin_users
create policy "products admin all"
  on public.products for all
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

-- Guest checkout: insert orders only
create policy "orders insert anyone"
  on public.orders for insert
  to anon, authenticated
  with check (true);

-- Optional: allow authenticated admins to read orders later (none for anon read)
create policy "orders admin read"
  on public.orders for select
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));
