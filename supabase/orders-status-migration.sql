-- Run in Supabase SQL Editor if orders table already exists without status column.

alter table public.orders
  add column if not exists status text not null default 'processing';

drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update"
  on public.orders for update
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));
