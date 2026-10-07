-- ============================================================
-- EMIRATE CO — Customer Addresses Migration
-- Migration is idempotent and safe for repeated execution.
-- ============================================================

-- 1. Table: customer_addresses
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Дом',
  region text,
  city text not null,
  street_address text not null,
  apartment_office text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Indexes
create index if not exists customer_addresses_user_id_idx
  on public.customer_addresses (user_id);

-- Enforce at most one default address per user
create unique index if not exists customer_addresses_user_default_uidx
  on public.customer_addresses (user_id)
  where (is_default = true);

-- 3. Default Address Trigger:
-- When an address is inserted or updated with is_default = true,
-- automatically reset is_default = false on all other addresses of that user.
create or replace function public.trg_customer_addresses_default_handler()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.is_default = true then
    update public.customer_addresses
    set is_default = false
    where user_id = NEW.user_id
      and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_customer_addresses_default on public.customer_addresses;
create trigger trg_customer_addresses_default
  before insert or update of is_default on public.customer_addresses
  for each row
  when (NEW.is_default = true)
  execute function public.trg_customer_addresses_default_handler();

-- 4. Row Level Security
alter table public.customer_addresses enable row level security;

-- Customer can read only their own addresses
drop policy if exists "addresses customer read own" on public.customer_addresses;
create policy "addresses customer read own"
  on public.customer_addresses for select
  to authenticated
  using (auth.uid() = user_id);

-- Customer can insert only for themselves
drop policy if exists "addresses customer insert own" on public.customer_addresses;
create policy "addresses customer insert own"
  on public.customer_addresses for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Customer can update only their own addresses
drop policy if exists "addresses customer update own" on public.customer_addresses;
create policy "addresses customer update own"
  on public.customer_addresses for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Customer can delete only their own addresses
drop policy if exists "addresses customer delete own" on public.customer_addresses;
create policy "addresses customer delete own"
  on public.customer_addresses for delete
  to authenticated
  using (auth.uid() = user_id);

-- Admins can view customer addresses in admin CRM
drop policy if exists "addresses admin read" on public.customer_addresses;
create policy "addresses admin read"
  on public.customer_addresses for select
  to authenticated
  using (
    exists (select 1 from public.admin_users u where u.user_id = auth.uid())
  );
