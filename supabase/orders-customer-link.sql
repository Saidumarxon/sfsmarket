-- Link orders to logged-in customers
alter table public.orders
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.orders
  add column if not exists customer_email text;

create index if not exists orders_user_id_idx on public.orders (user_id);

-- Logged-in customers can read their own orders
drop policy if exists "orders customer read own" on public.orders;
create policy "orders customer read own"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);
