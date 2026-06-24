-- Fix: guests can create orders (quick buy + checkout).
-- Run in Supabase → SQL Editor if you see:
-- "new row violates row-level security policy for table orders"

alter table public.orders enable row level security;

drop policy if exists "orders insert anyone" on public.orders;
create policy "orders insert anyone"
  on public.orders for insert
  to anon, authenticated
  with check (true);

drop policy if exists "orders admin read" on public.orders;
create policy "orders admin read"
  on public.orders for select
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update"
  on public.orders for update
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));
