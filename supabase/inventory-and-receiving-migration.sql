-- ==============================================================================
-- EMIRATE CO / SFS MARKET — INVENTORY, RECEIVING & CONTRACTORS MODULE
-- Migration: supabase/inventory-and-receiving-migration.sql
-- Phase 1: Database Foundation
--
-- Tables:
--   1. public.contractors
--   2. public.warehouses
--   3. public.receipts
--   4. public.receipt_items
--   5. public.stock_balances
--   6. public.stock_movements (immutable ledger)
--   7. public.contractor_transactions (settlements ledger)
--
-- Security:
--   - RLS enabled on all 7 tables
--   - Full access restricted to trusted admins (public.admin_users) and service_role
--   - Public/anon roles cannot read purchase costs, stock balances, or debts
--
-- Atomic Procedures:
--   - public.post_receipt(p_receipt_id uuid)
--   - public.cancel_receipt(p_receipt_id uuid)
--   - public.record_contractor_payment(...)
--   - public.get_contractor_summary(...)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. HELPER FUNCTION: Trusted Admin Check
-- ------------------------------------------------------------------------------
create or replace function public.is_trusted_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.admin_users u where u.user_id = auth.uid()
  ) or coalesce(auth.role(), '') = 'service_role';
$$;

grant execute on function public.is_trusted_admin() to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 1. CONTRACTORS (ПОСТАВЩИКИ / КОНТРАГЕНТЫ)
-- ------------------------------------------------------------------------------
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  contact_person text,
  inn text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contractors_status_check check (status in ('active', 'inactive')),
  constraint contractors_name_not_empty check (length(trim(name)) > 0)
);

create index if not exists contractors_status_idx on public.contractors(status);
create index if not exists contractors_name_idx on public.contractors(name);

-- ------------------------------------------------------------------------------
-- 2. WAREHOUSES (СКЛАДЫ)
-- ------------------------------------------------------------------------------
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint warehouses_code_not_empty check (length(trim(code)) > 0)
);

-- Seed initial default warehouse (idempotent)
insert into public.warehouses (name, code, address, is_active)
values ('Основной склад', 'MAIN', 'г. Ташкент', true)
on conflict (code) do nothing;

-- ------------------------------------------------------------------------------
-- 3. SEQUENCE FOR RECEIPT NUMBER
-- ------------------------------------------------------------------------------
create sequence if not exists public.receipts_seq;

create or replace function public.generate_receipt_number()
returns text
language plpgsql
as $$
declare
  v_year text;
  v_seq bigint;
begin
  v_year := to_char(current_date, 'YYYY');
  v_seq := nextval('public.receipts_seq');
  return 'REC-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. RECEIPTS (ПРИЁМКА ТОВАРОВ — ШАПКА ДОКУМЕНТА)
-- ------------------------------------------------------------------------------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique not null,
  contractor_id uuid not null references public.contractors(id),
  warehouse_id uuid not null references public.warehouses(id),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  received_at date not null default current_date,
  external_order_number text,
  payment_method text not null default 'debt',
  currency text not null default 'UZS',
  exchange_rate numeric not null default 1,
  total_cost numeric not null default 0,
  paid_amount numeric not null default 0,
  debt_amount numeric not null default 0,
  description text,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint receipts_status_check check (status in ('draft', 'posted', 'cancelled')),
  constraint receipts_payment_method_check check (payment_method in ('cash', 'bank_transfer', 'debt')),
  constraint receipts_total_cost_non_negative check (total_cost >= 0),
  constraint receipts_paid_amount_non_negative check (paid_amount >= 0),
  constraint receipts_paid_lte_total check (paid_amount <= total_cost),
  constraint receipts_debt_amount_non_negative check (debt_amount >= 0)
);

create index if not exists receipts_contractor_id_idx on public.receipts(contractor_id);
create index if not exists receipts_warehouse_id_idx on public.receipts(warehouse_id);
create index if not exists receipts_status_idx on public.receipts(status);
create index if not exists receipts_created_at_idx on public.receipts(created_at);
create index if not exists receipts_received_at_idx on public.receipts(received_at);

-- Trigger to guarantee receipt_number and debt_amount on insert
create or replace function public.receipts_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.receipt_number is null or length(trim(new.receipt_number)) = 0 then
    new.receipt_number := public.generate_receipt_number();
  end if;
  if new.debt_amount is null or new.debt_amount = 0 then
    new.debt_amount := greatest(new.total_cost - new.paid_amount, 0);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_receipts_before_insert on public.receipts;
create trigger trg_receipts_before_insert
  before insert on public.receipts
  for each row
  execute function public.receipts_before_insert();

-- ------------------------------------------------------------------------------
-- 5. RECEIPT ITEMS (СТРОКИ ПРИЁМКИ)
-- ------------------------------------------------------------------------------
create table if not exists public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  product_id text not null references public.products(admin_id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric not null check (unit_cost >= 0),
  total_cost numeric not null check (total_cost >= 0),
  sale_price numeric,
  created_at timestamptz not null default now(),
  constraint receipt_items_calc_check check (total_cost = (quantity * unit_cost))
);

create index if not exists receipt_items_receipt_id_idx on public.receipt_items(receipt_id);
create index if not exists receipt_items_product_id_idx on public.receipt_items(product_id);

-- ------------------------------------------------------------------------------
-- 6. STOCK BALANCES (ТЕКУЩИЕ ОСТАТКИ ПО СКЛАДАМ)
-- ------------------------------------------------------------------------------
create table if not exists public.stock_balances (
  product_id text not null references public.products(admin_id),
  warehouse_id uuid not null references public.warehouses(id),
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, warehouse_id),
  constraint stock_balances_reserved_lte_qty check (reserved_quantity <= quantity)
);

create index if not exists stock_balances_warehouse_id_idx on public.stock_balances(warehouse_id);
create index if not exists stock_balances_product_id_idx on public.stock_balances(product_id);

-- ------------------------------------------------------------------------------
-- 7. STOCK MOVEMENTS (НЕИЗМЕНЯЕМЫЙ ЖУРНАЛ ДВИЖЕНИЙ СКЛАДА)
-- ------------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(admin_id),
  warehouse_id uuid not null references public.warehouses(id),
  change_qty integer not null,
  movement_type text not null check (movement_type in ('receipt', 'sale', 'adjustment', 'return')),
  reference_id uuid,
  created_at timestamptz not null default now(),
  constraint stock_movements_qty_direction check (
    (movement_type = 'receipt' and change_qty > 0) or
    (movement_type = 'sale' and change_qty < 0) or
    (movement_type = 'return' and change_qty > 0) or
    (movement_type = 'adjustment' and change_qty <> 0)
  )
);

create index if not exists stock_movements_product_id_idx on public.stock_movements(product_id);
create index if not exists stock_movements_warehouse_id_idx on public.stock_movements(warehouse_id);
create index if not exists stock_movements_reference_id_idx on public.stock_movements(reference_id);
create index if not exists stock_movements_created_at_idx on public.stock_movements(created_at);

-- Guard: stock movements are strictly append-only (immutable)
create or replace function public.stock_movements_immutable_guard()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Stock movements are immutable and cannot be updated or deleted' using errcode = 'P0003';
end;
$$;

drop trigger if exists trg_stock_movements_immutable on public.stock_movements;
create trigger trg_stock_movements_immutable
  before update or delete on public.stock_movements
  for each row
  execute function public.stock_movements_immutable_guard();

-- ------------------------------------------------------------------------------
-- 8. CONTRACTOR TRANSACTIONS (ВЗАИМОРАСЧЁТЫ И ПЛАТЕЖИ ПОСТАВЩИКАМ)
-- ------------------------------------------------------------------------------
create table if not exists public.contractor_transactions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id),
  receipt_id uuid references public.receipts(id),
  amount numeric not null check (amount > 0),
  type text not null check (type in ('receipt_accrual', 'payment', 'accrual_reversal', 'payment_reversal')),
  payment_method text,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists contractor_transactions_contractor_id_idx on public.contractor_transactions(contractor_id);
create index if not exists contractor_transactions_receipt_id_idx on public.contractor_transactions(receipt_id);
create index if not exists contractor_transactions_created_at_idx on public.contractor_transactions(created_at);

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
alter table public.contractors enable row level security;
alter table public.warehouses enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_items enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_movements enable row level security;
alter table public.contractor_transactions enable row level security;

-- Drop previous policies if they exist to allow clean reruns
drop policy if exists "admin_all_contractors" on public.contractors;
drop policy if exists "admin_all_warehouses" on public.warehouses;
drop policy if exists "admin_all_receipts" on public.receipts;
drop policy if exists "admin_all_receipt_items" on public.receipt_items;
drop policy if exists "admin_all_stock_balances" on public.stock_balances;
drop policy if exists "admin_all_stock_movements" on public.stock_movements;
drop policy if exists "admin_all_contractor_transactions" on public.contractor_transactions;

create policy "admin_all_contractors" on public.contractors for all to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

create policy "admin_all_warehouses" on public.warehouses for all to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

create policy "admin_all_receipts" on public.receipts for all to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

create policy "admin_all_receipt_items" on public.receipt_items for all to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

create policy "admin_all_stock_balances" on public.stock_balances for all to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

create policy "admin_all_stock_movements" on public.stock_movements for all to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

create policy "admin_all_contractor_transactions" on public.contractor_transactions for all to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- 10. ATOMIC RPC: POST RECEIPT (ПРОВЕДЕНИЕ ПРИЁМКИ)
-- ------------------------------------------------------------------------------
create or replace function public.post_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_receipt public.receipts%rowtype;
  v_item record;
  v_item_count int := 0;
  v_calculated_total numeric := 0;
  v_calculated_debt numeric := 0;
begin
  -- 1. Verify caller is trusted admin
  if not public.is_trusted_admin() then
    raise exception 'Access denied: trusted admin required' using errcode = '42501';
  end if;

  -- 2. Lock receipt row FOR UPDATE
  select * into v_receipt
  from public.receipts
  where id = p_receipt_id
  for update;

  if not found then
    raise exception 'Receipt not found: %', p_receipt_id using errcode = 'P0008';
  end if;

  -- 3. Check status is draft
  if v_receipt.status <> 'draft' then
    raise exception 'Only draft receipts can be posted. Current status: %', v_receipt.status using errcode = 'P0001';
  end if;

  -- 4. Count items and calculate authoritative total
  select count(*), coalesce(sum(quantity * unit_cost), 0)
  into v_item_count, v_calculated_total
  from public.receipt_items
  where receipt_id = p_receipt_id;

  if v_item_count = 0 then
    raise exception 'Cannot post receipt without items' using errcode = 'P0002';
  end if;

  -- 5. Recalculate each item total_cost
  update public.receipt_items
  set total_cost = quantity * unit_cost
  where receipt_id = p_receipt_id;

  -- 6. Validate paid_amount
  if v_receipt.paid_amount > v_calculated_total then
    raise exception 'Paid amount (%) exceeds total cost (%)', v_receipt.paid_amount, v_calculated_total using errcode = 'P0004';
  end if;

  v_calculated_debt := greatest(v_calculated_total - v_receipt.paid_amount, 0);

  -- 7. Process each item: update stock balances & record movement
  for v_item in (
    select product_id, quantity, unit_cost
    from public.receipt_items
    where receipt_id = p_receipt_id
    order by product_id
  ) loop
    -- Upsert stock balance atomically
    insert into public.stock_balances (product_id, warehouse_id, quantity, reserved_quantity, updated_at)
    values (v_item.product_id, v_receipt.warehouse_id, v_item.quantity, 0, now())
    on conflict (product_id, warehouse_id) do update
    set quantity = public.stock_balances.quantity + excluded.quantity,
        updated_at = now();

    -- Create immutable stock movement
    insert into public.stock_movements (product_id, warehouse_id, change_qty, movement_type, reference_id, created_at)
    values (v_item.product_id, v_receipt.warehouse_id, v_item.quantity, 'receipt', p_receipt_id, now());
  end loop;

  -- 8. Record contractor debt accrual
  insert into public.contractor_transactions (contractor_id, receipt_id, amount, type, description, created_at, created_by)
  values (
    v_receipt.contractor_id,
    p_receipt_id,
    v_calculated_total,
    'receipt_accrual',
    'Приходная накладная ' || v_receipt.receipt_number,
    now(),
    auth.uid()
  );

  -- 9. Record initial payment transaction if paid_amount > 0
  if v_receipt.paid_amount > 0 then
    insert into public.contractor_transactions (contractor_id, receipt_id, amount, type, payment_method, description, created_at, created_by)
    values (
      v_receipt.contractor_id,
      p_receipt_id,
      v_receipt.paid_amount,
      'payment',
      v_receipt.payment_method,
      'Оплата при приёмке ' || v_receipt.receipt_number,
      now(),
      auth.uid()
    );
  end if;

  -- 10. Update receipt to posted
  update public.receipts
  set status = 'posted',
      total_cost = v_calculated_total,
      debt_amount = v_calculated_debt,
      updated_at = now()
  where id = p_receipt_id;

  return jsonb_build_object(
    'ok', true,
    'receipt_id', p_receipt_id,
    'receipt_number', v_receipt.receipt_number,
    'status', 'posted',
    'total_cost', v_calculated_total,
    'paid_amount', v_receipt.paid_amount,
    'debt_amount', v_calculated_debt
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 11. ATOMIC RPC: CANCEL RECEIPT (ОТМЕНА ПРИЁМКИ)
-- ------------------------------------------------------------------------------
create or replace function public.cancel_receipt(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_receipt public.receipts%rowtype;
  v_item record;
  v_stock public.stock_balances%rowtype;
begin
  -- 1. Verify caller is trusted admin
  if not public.is_trusted_admin() then
    raise exception 'Access denied: trusted admin required' using errcode = '42501';
  end if;

  -- 2. Lock receipt row FOR UPDATE
  select * into v_receipt
  from public.receipts
  where id = p_receipt_id
  for update;

  if not found then
    raise exception 'Receipt not found: %', p_receipt_id using errcode = 'P0008';
  end if;

  -- 3. Check not already cancelled
  if v_receipt.status = 'cancelled' then
    raise exception 'Receipt is already cancelled' using errcode = 'P0005';
  end if;

  -- 4. Case: DRAFT receipt (cancel without affecting stock)
  if v_receipt.status = 'draft' then
    update public.receipts
    set status = 'cancelled',
        updated_at = now()
    where id = p_receipt_id;

    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'status', 'cancelled',
      'note', 'Draft receipt cancelled without stock changes'
    );
  end if;

  -- 5. Case: POSTED receipt (must safely reverse stock & financials)
  if v_receipt.status = 'posted' then
    -- Verify available stock for each item before modifying anything
    for v_item in (
      select product_id, quantity
      from public.receipt_items
      where receipt_id = p_receipt_id
      order by product_id
    ) loop
      select * into v_stock
      from public.stock_balances
      where product_id = v_item.product_id and warehouse_id = v_receipt.warehouse_id
      for update;

      if not found or (v_stock.quantity - v_stock.reserved_quantity) < v_item.quantity then
        raise exception 'Cannot cancel receipt: insufficient available stock for product % (available: %, needed: %)',
          v_item.product_id,
          coalesce(v_stock.quantity - v_stock.reserved_quantity, 0),
          v_item.quantity
          using errcode = 'P0006';
      end if;
    end loop;

    -- Deduct stock and write reversal movements
    for v_item in (
      select product_id, quantity
      from public.receipt_items
      where receipt_id = p_receipt_id
      order by product_id
    ) loop
      update public.stock_balances
      set quantity = quantity - v_item.quantity,
          updated_at = now()
      where product_id = v_item.product_id and warehouse_id = v_receipt.warehouse_id;

      insert into public.stock_movements (product_id, warehouse_id, change_qty, movement_type, reference_id, created_at)
      values (v_item.product_id, v_receipt.warehouse_id, -v_item.quantity, 'adjustment', p_receipt_id, now());
    end loop;

    -- Financial reversal: reverse accrual
    insert into public.contractor_transactions (contractor_id, receipt_id, amount, type, description, created_at, created_by)
    values (
      v_receipt.contractor_id,
      p_receipt_id,
      v_receipt.total_cost,
      'accrual_reversal',
      'Сторно приходной накладной ' || v_receipt.receipt_number,
      now(),
      auth.uid()
    );

    -- If initial payment was made with this receipt, reverse payment
    if v_receipt.paid_amount > 0 then
      insert into public.contractor_transactions (contractor_id, receipt_id, amount, type, payment_method, description, created_at, created_by)
      values (
        v_receipt.contractor_id,
        p_receipt_id,
        v_receipt.paid_amount,
        'payment_reversal',
        v_receipt.payment_method,
        'Возврат оплаты по отменённой накладной ' || v_receipt.receipt_number,
        now(),
        auth.uid()
      );
    end if;

    -- Set receipt status to cancelled
    update public.receipts
    set status = 'cancelled',
        debt_amount = 0,
        updated_at = now()
    where id = p_receipt_id;

    return jsonb_build_object(
      'ok', true,
      'receipt_id', p_receipt_id,
      'status', 'cancelled',
      'reversed_total', v_receipt.total_cost,
      'note', 'Posted receipt safely reversed'
    );
  end if;

  raise exception 'Unexpected receipt status: %', v_receipt.status using errcode = 'P0009';
end;
$$;

-- ------------------------------------------------------------------------------
-- 11B. GUARDS: IMMUTABILITY OF POSTED & CANCELLED RECEIPTS
-- ------------------------------------------------------------------------------
create or replace function public.receipt_items_immutability_guard()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.receipts
  where id = coalesce(new.receipt_id, old.receipt_id);

  if v_status is not null and v_status in ('posted', 'cancelled') then
    raise exception 'Cannot modify items of a % receipt', v_status using errcode = 'P0010';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_receipt_items_immutable on public.receipt_items;
create trigger trg_receipt_items_immutable
  before insert or update or delete on public.receipt_items
  for each row
  execute function public.receipt_items_immutability_guard();

create or replace function public.receipts_immutability_guard()
returns trigger
language plpgsql
as $$
begin
  -- Block deletion of posted or cancelled receipts
  if TG_OP = 'DELETE' then
    if old.status in ('posted', 'cancelled') then
      raise exception 'Cannot delete a % receipt', old.status using errcode = 'P0011';
    end if;
    return old;
  end if;

  -- Allow status transition from posted -> cancelled (inside cancel_receipt)
  if old.status = 'posted' and new.status = 'cancelled' then
    return new;
  end if;

  -- Allow any update while receipt is in draft
  if old.status = 'draft' then
    return new;
  end if;

  -- Block any other update on posted or cancelled receipt
  raise exception 'Cannot modify a % receipt', old.status using errcode = 'P0012';
end;
$$;

drop trigger if exists trg_receipts_immutable on public.receipts;
create trigger trg_receipts_immutable
  before update or delete on public.receipts
  for each row
  execute function public.receipts_immutability_guard();

-- ------------------------------------------------------------------------------
-- 12. ATOMIC RPC: RECORD CONTRACTOR PAYMENT (ВЫПЛАТА ПОСТАВЩИКУ)
-- ------------------------------------------------------------------------------
create or replace function public.record_contractor_payment(
  p_contractor_id uuid,
  p_amount numeric,
  p_payment_method text default 'bank_transfer',
  p_description text default null,
  p_receipt_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_contractor public.contractors%rowtype;
  v_tx_id uuid;
begin
  -- 1. Trusted admin check
  if not public.is_trusted_admin() then
    raise exception 'Access denied: trusted admin required' using errcode = '42501';
  end if;

  -- 2. Validate positive amount
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than 0' using errcode = 'P0007';
  end if;

  -- 3. Verify contractor exists
  select * into v_contractor
  from public.contractors
  where id = p_contractor_id;

  if not found then
    raise exception 'Contractor not found: %', p_contractor_id using errcode = 'P0008';
  end if;

  -- 4. Insert payment transaction
  insert into public.contractor_transactions (
    contractor_id,
    receipt_id,
    amount,
    type,
    payment_method,
    description,
    created_at,
    created_by
  ) values (
    p_contractor_id,
    p_receipt_id,
    p_amount,
    'payment',
    coalesce(p_payment_method, 'bank_transfer'),
    coalesce(p_description, 'Выплата поставщику ' || v_contractor.name),
    now(),
    auth.uid()
  ) returning id into v_tx_id;

  return jsonb_build_object(
    'ok', true,
    'transaction_id', v_tx_id,
    'contractor_id', p_contractor_id,
    'amount', p_amount,
    'payment_method', coalesce(p_payment_method, 'bank_transfer')
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 13. BALANCE & DEBT QUERIES (SUMMARY RPC)
-- ------------------------------------------------------------------------------
create or replace function public.get_contractor_summary(p_contractor_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  v_receipts_count int := 0;
  v_received_units bigint := 0;
  v_receipts_amount numeric := 0;
  v_total_paid numeric := 0;
  v_current_debt numeric := 0;
begin
  -- Check admin access
  if not public.is_trusted_admin() then
    raise exception 'Access denied: trusted admin required' using errcode = '42501';
  end if;

  -- 1. Receipts statistics
  select
    count(distinct r.id),
    coalesce(sum(ri.quantity), 0),
    coalesce(sum(r.total_cost), 0)
  into v_receipts_count, v_received_units, v_receipts_amount
  from public.receipts r
  left join public.receipt_items ri on ri.receipt_id = r.id
  where r.contractor_id = p_contractor_id and r.status = 'posted';

  -- 2. Ledger balance: Debt = Accruals - Payments + Reversals
  select
    coalesce(sum(case when type = 'payment' then amount else 0 end), 0),
    coalesce(sum(
      case
        when type = 'receipt_accrual' then amount
        when type = 'payment_reversal' then amount
        when type = 'payment' then -amount
        when type = 'accrual_reversal' then -amount
        else 0
      end
    ), 0)
  into v_total_paid, v_current_debt
  from public.contractor_transactions
  where contractor_id = p_contractor_id;

  return jsonb_build_object(
    'contractor_id', p_contractor_id,
    'total_receipts', v_receipts_count,
    'total_received_units', v_received_units,
    'total_receipt_amount', v_receipts_amount,
    'total_paid', v_total_paid,
    'current_debt', greatest(v_current_debt, 0)
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 14. BATCH CONTRACTORS SUMMARY RPC
-- ------------------------------------------------------------------------------
create or replace function public.get_contractors_summary()
returns table (
  contractor_id uuid,
  receipts_count bigint,
  total_received_units numeric,
  total_receipt_amount numeric,
  total_paid numeric,
  current_debt numeric
)
language plpgsql
security definer
stable
as $$
begin
  if not public.is_trusted_admin() then
    raise exception 'Access denied: trusted admin required' using errcode = '42501';
  end if;

  return query
  with receipt_stats as (
    select
      r.contractor_id as c_id,
      count(distinct r.id)::bigint as r_count,
      coalesce(sum(ri.quantity), 0)::numeric as r_units,
      coalesce(sum(r.total_cost), 0)::numeric as r_amount
    from public.receipts r
    left join public.receipt_items ri on ri.receipt_id = r.id
    where r.status = 'posted'
    group by r.contractor_id
  ),
  tx_stats as (
    select
      t.contractor_id as c_id,
      coalesce(sum(case when t.type = 'payment' then t.amount else 0 end), 0)::numeric as t_paid,
      coalesce(sum(
        case
          when t.type = 'receipt_accrual' then t.amount
          when t.type = 'payment_reversal' then t.amount
          when t.type = 'payment' then -t.amount
          when t.type = 'accrual_reversal' then -t.amount
          else 0
        end
      ), 0)::numeric as t_debt
    from public.contractor_transactions t
    group by t.contractor_id
  )
  select
    c.id as contractor_id,
    coalesce(rs.r_count, 0::bigint) as receipts_count,
    coalesce(rs.r_units, 0::numeric) as total_received_units,
    coalesce(rs.r_amount, 0::numeric) as total_receipt_amount,
    coalesce(ts.t_paid, 0::numeric) as total_paid,
    greatest(coalesce(ts.t_debt, 0::numeric), 0::numeric) as current_debt
  from public.contractors c
  left join receipt_stats rs on rs.c_id = c.id
  left join tx_stats ts on ts.c_id = c.id;
end;
$$;

-- Grant permissions to RPCs
grant execute on function public.post_receipt(uuid) to authenticated, service_role;
grant execute on function public.cancel_receipt(uuid) to authenticated, service_role;
grant execute on function public.record_contractor_payment(uuid, numeric, text, text, uuid) to authenticated, service_role;
grant execute on function public.get_contractor_summary(uuid) to authenticated, service_role;
grant execute on function public.get_contractors_summary() to authenticated, service_role;

