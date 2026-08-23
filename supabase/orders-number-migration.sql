-- Run once in Supabase SQL Editor.
-- Adds a human order number: #1, #2, #3…
-- Existing orders are numbered by created_at. New orders take the next value.

create sequence if not exists public.orders_order_number_seq;

alter table public.orders
  add column if not exists order_number integer;

with numbered as (
  select
    id,
    coalesce((select max(order_number) from public.orders), 0)
      + row_number() over (order by created_at asc, id asc) as n
  from public.orders
  where order_number is null
)
update public.orders o
set order_number = numbered.n
from numbered
where o.id = numbered.id;

do $$
declare
  max_n integer;
begin
  select coalesce(max(order_number), 0) into max_n from public.orders;
  if max_n > 0 then
    perform setval('public.orders_order_number_seq', max_n, true);
  else
    perform setval('public.orders_order_number_seq', 1, false);
  end if;
end $$;

alter table public.orders
  alter column order_number set default nextval('public.orders_order_number_seq');

update public.orders
set order_number = nextval('public.orders_order_number_seq')
where order_number is null;

alter table public.orders
  alter column order_number set not null;

create unique index if not exists orders_order_number_uidx on public.orders (order_number);

grant usage, select on sequence public.orders_order_number_seq to anon, authenticated, service_role;
