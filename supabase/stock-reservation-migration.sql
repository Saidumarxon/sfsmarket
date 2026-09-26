-- ==============================================================================
-- EMIRATE CO — PHASE 4B: ATOMIC STOCK RESERVATION MIGRATION
-- Database Foundation for Availability, Atomic Reservation, Deduction & Release.
-- Idempotent, backward-compatible, strictly preserves Phase 1-3 & Stage 2C schemas.
-- ==============================================================================

-- 1. Ensure stock_status column exists on public.orders for reservation state tracking
alter table public.orders
  add column if not exists stock_status text not null default 'none'
  check (stock_status in ('none', 'reserved', 'released', 'deducted'));

create index if not exists orders_stock_status_idx on public.orders(stock_status);

-- ------------------------------------------------------------------------------
-- 2. ORDER STOCK RESERVATIONS TABLE
-- Minimal tracking table linking specific orders to reserved warehouse stock.
-- Does not duplicate full order item payloads.
-- ------------------------------------------------------------------------------
create table if not exists public.order_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(admin_id),
  warehouse_id uuid not null references public.warehouses(id),
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved', 'released', 'deducted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_stock_reservations_order_prod_wh_uidx unique (order_id, product_id, warehouse_id)
);

create index if not exists order_stock_reservations_order_id_idx on public.order_stock_reservations(order_id);
create index if not exists order_stock_reservations_product_id_idx on public.order_stock_reservations(product_id);
create index if not exists order_stock_reservations_status_idx on public.order_stock_reservations(status);

alter table public.order_stock_reservations enable row level security;

-- Only authenticated admins and internal security-definer triggers have access
drop policy if exists "admin_all_order_stock_reservations" on public.order_stock_reservations;
create policy "admin_all_order_stock_reservations" on public.order_stock_reservations
  for all to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- 3. HELPER: GET MAIN WAREHOUSE ID
-- ------------------------------------------------------------------------------
create or replace function public.get_default_reservation_warehouse_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_wh_id uuid;
begin
  select id into v_wh_id from public.warehouses where code = 'MAIN' and is_active = true limit 1;
  if v_wh_id is null then
    select id into v_wh_id from public.warehouses where is_active = true order by created_at asc limit 1;
  end if;
  return v_wh_id;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC: GET PRODUCT AVAILABLE QUANTITY
-- Returns quantity - reserved_quantity for product and warehouse.
-- Protected from raw anon public exposure; accessible by admins/service_role.
-- ------------------------------------------------------------------------------
create or replace function public.get_product_available_quantity(
  p_product_id text,
  p_warehouse_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wh_id uuid := p_warehouse_id;
  v_qty integer := 0;
  v_res integer := 0;
begin
  if auth.role() = 'anon' and coalesce(current_setting('emirate.inventory_bypass', true), 'false') <> 'true' then
    raise exception 'Access denied to product inventory availability' using errcode = '42501';
  end if;

  if v_wh_id is null then
    v_wh_id := public.get_default_reservation_warehouse_id();
  end if;

  if v_wh_id is null or p_product_id is null or trim(p_product_id) = '' then
    return 0;
  end if;

  select quantity, reserved_quantity into v_qty, v_res
  from public.stock_balances
  where product_id = p_product_id and warehouse_id = v_wh_id;

  if not found then
    return 0;
  end if;

  return greatest(0, v_qty - v_res);
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. CORE RPC: RESERVE ORDER STOCK
-- Atomic, row-locked (FOR UPDATE), all-or-nothing, idempotent.
-- ------------------------------------------------------------------------------
create or replace function public.reserve_order_stock(
  p_order_id uuid,
  p_warehouse_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order record;
  v_wh_id uuid := p_warehouse_id;
  v_item record;
  v_prod_id text;
  v_req_qty integer;
  v_curr_qty integer;
  v_curr_res integer;
  v_available integer;
  v_items_count integer := 0;
begin
  -- 1. Lock and fetch order
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;

  -- 2. Idempotency check: if order is already reserved, do not reserve again
  if v_order.stock_status = 'reserved' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_id', p_order_id,
      'stock_status', 'reserved'
    );
  end if;

  if v_order.stock_status = 'deducted' then
    raise exception 'Cannot reserve stock: order % has already been deducted', p_order_id using errcode = 'P0007';
  end if;

  -- 3. Resolve warehouse
  if v_wh_id is null then
    v_wh_id := public.get_default_reservation_warehouse_id();
  end if;

  if v_wh_id is null then
    raise exception 'No active warehouse found for stock reservation' using errcode = 'P0003';
  end if;

  -- 4. Check items presence
  if v_order.items is null or jsonb_typeof(v_order.items) <> 'array' or jsonb_array_length(v_order.items) = 0 then
    -- Order has no items, set stock_status to none
    update public.orders set stock_status = 'none' where id = p_order_id;
    return jsonb_build_object('ok', true, 'items_count', 0, 'stock_status', 'none');
  end if;

  -- 5. FIRST PASS: Validate all items and lock stock_balances rows in deterministic product_id order
  -- Deterministic order (order by product_id asc) strictly prevents deadlock between concurrent transactions!
  for v_item in
    select
      trim(item->>'product_id') as product_id,
      trim(item->>'title') as title,
      sum(
        case
          when jsonb_typeof(item->'qty') = 'number' then (item->>'qty')::integer
          when (item->>'qty') ~ '^[0-9]+$' then (item->>'qty')::integer
          else 1
        end
      ) as total_qty
    from jsonb_array_elements(v_order.items) as item
    group by trim(item->>'product_id'), trim(item->>'title')
    order by trim(item->>'product_id') asc
  loop
    v_prod_id := v_item.product_id;
    v_req_qty := v_item.total_qty;
    v_items_count := v_items_count + 1;

    -- Strict validation: never allow title as product_id or empty product_id
    if v_prod_id is null or v_prod_id = '' or v_prod_id = v_item.title then
      raise exception 'Order item "%" is missing a valid canonical product_id', coalesce(v_item.title, 'Товар')
        using errcode = 'P0008';
    end if;

    if not exists (select 1 from public.products where admin_id = v_prod_id) then
      raise exception 'Product % does not exist in catalog', v_prod_id
        using errcode = 'P0009';
    end if;

    if v_req_qty <= 0 then
      raise exception 'Invalid quantity % for product %', v_req_qty, v_prod_id
        using errcode = 'P0004';
    end if;

    -- Lock stock_balances row FOR UPDATE
    select quantity, reserved_quantity into v_curr_qty, v_curr_res
    from public.stock_balances
    where product_id = v_prod_id and warehouse_id = v_wh_id
    for update;

    if not found then
      raise exception 'Insufficient stock for product %: requested %, available 0', v_prod_id, v_req_qty
        using errcode = 'P0006';
    end if;

    v_available := v_curr_qty - v_curr_res;
    if v_available < v_req_qty then
      raise exception 'Insufficient stock for product %: requested %, available %', v_prod_id, v_req_qty, v_available
        using errcode = 'P0006';
    end if;
  end loop;

  -- 6. SECOND PASS: Apply reservation (all items verified available)
  for v_item in
    select
      trim(item->>'product_id') as product_id,
      sum(
        case
          when jsonb_typeof(item->'qty') = 'number' then (item->>'qty')::integer
          when (item->>'qty') ~ '^[0-9]+$' then (item->>'qty')::integer
          else 1
        end
      ) as total_qty
    from jsonb_array_elements(v_order.items) as item
    group by trim(item->>'product_id')
  loop
    v_prod_id := v_item.product_id;
    v_req_qty := v_item.total_qty;

    update public.stock_balances
    set reserved_quantity = reserved_quantity + v_req_qty,
        updated_at = now()
    where product_id = v_prod_id and warehouse_id = v_wh_id;

    insert into public.order_stock_reservations (
      order_id,
      product_id,
      warehouse_id,
      quantity,
      status,
      created_at,
      updated_at
    ) values (
      p_order_id,
      v_prod_id,
      v_wh_id,
      v_req_qty,
      'reserved',
      now(),
      now()
    )
    on conflict (order_id, product_id, warehouse_id)
    do update set
      quantity = EXCLUDED.quantity,
      status = 'reserved',
      updated_at = now();
  end loop;

  update public.orders
  set stock_status = 'reserved'
  where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'warehouse_id', v_wh_id,
    'items_reserved', v_items_count,
    'stock_status', 'reserved'
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. CORE RPC: RELEASE ORDER STOCK
-- Releases reserved stock back to available pool. Idempotent, safe against underflow.
-- ------------------------------------------------------------------------------
create or replace function public.release_order_stock(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res record;
  v_released_count integer := 0;
  v_stock_status text;
begin
  select stock_status into v_stock_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;

  -- Cannot release stock after it has been already deducted (sold)
  if v_stock_status = 'deducted' then
    raise exception 'Cannot release stock: order % stock was already deducted', p_order_id using errcode = 'P0007';
  end if;

  -- Idempotency: if already released or none, return ok
  if v_stock_status in ('released', 'none') then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_id', p_order_id,
      'stock_status', v_stock_status
    );
  end if;

  for v_res in
    select *
    from public.order_stock_reservations
    where order_id = p_order_id and status = 'reserved'
    for update
  loop
    -- Lock stock_balances and decrease reserved_quantity safely
    update public.stock_balances
    set reserved_quantity = greatest(0, reserved_quantity - v_res.quantity),
        updated_at = now()
    where product_id = v_res.product_id and warehouse_id = v_res.warehouse_id;

    update public.order_stock_reservations
    set status = 'released',
        updated_at = now()
    where id = v_res.id;

    v_released_count := v_released_count + 1;
  end loop;

  update public.orders
  set stock_status = 'released'
  where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'released_items_count', v_released_count,
    'stock_status', 'released'
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 7. CORE RPC: DEDUCT ORDER STOCK
-- Transitions reserved stock to fulfilled/sold stock.
-- Decrements quantity & reserved_quantity atomically.
-- Creates immutable movement (type='sale', change_qty < 0). Idempotent.
-- ------------------------------------------------------------------------------
create or replace function public.deduct_order_stock(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res record;
  v_deducted_count integer := 0;
  v_stock_status text;
  v_curr_qty integer;
  v_curr_res integer;
begin
  select stock_status into v_stock_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;

  -- Idempotency: if already deducted, do not deduct again
  if v_stock_status = 'deducted' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'order_id', p_order_id,
      'stock_status', 'deducted'
    );
  end if;

  if v_stock_status in ('released', 'none') then
    raise exception 'Cannot deduct stock: order % stock status is % (not reserved)', p_order_id, v_stock_status
      using errcode = 'P0007';
  end if;

  for v_res in
    select *
    from public.order_stock_reservations
    where order_id = p_order_id and status = 'reserved'
    for update
  loop
    select quantity, reserved_quantity into v_curr_qty, v_curr_res
    from public.stock_balances
    where product_id = v_res.product_id and warehouse_id = v_res.warehouse_id
    for update;

    if not found or v_curr_qty < v_res.quantity then
      raise exception 'Stock balance corrupted for product %: physical quantity % < reserved %',
        v_res.product_id, coalesce(v_curr_qty, 0), v_res.quantity
        using errcode = 'P0006';
    end if;

    -- Decrement quantity and reserved_quantity
    update public.stock_balances
    set quantity = quantity - v_res.quantity,
        reserved_quantity = greatest(0, reserved_quantity - v_res.quantity),
        updated_at = now()
    where product_id = v_res.product_id and warehouse_id = v_res.warehouse_id;

    -- Append immutable stock movement
    insert into public.stock_movements (
      product_id,
      warehouse_id,
      change_qty,
      movement_type,
      reference_id,
      created_at
    ) values (
      v_res.product_id,
      v_res.warehouse_id,
      -v_res.quantity,
      'sale',
      p_order_id,
      now()
    );

    update public.order_stock_reservations
    set status = 'deducted',
        updated_at = now()
    where id = v_res.id;

    v_deducted_count := v_deducted_count + 1;
  end loop;

  update public.orders
  set stock_status = 'deducted'
  where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'deducted_items_count', v_deducted_count,
    'stock_status', 'deducted'
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. TRIGGER: BEFORE INSERT ON ORDERS (SECURITY & AUTHORITATIVE PRICE VALIDATION)
-- Blocks direct PostgREST inserts with tampered prices or missing canonical IDs.
-- ------------------------------------------------------------------------------
create or replace function public.trg_order_stock_before_handler()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_prod_id text;
  v_item_price numeric;
  v_auth_price numeric;
  v_auth_row record;
begin
  -- Validate items structure
  if NEW.items is not null and jsonb_typeof(NEW.items) = 'array' and jsonb_array_length(NEW.items) > 0 then
    for v_item in
      select
        trim(item->>'product_id') as product_id,
        trim(item->>'title') as title,
        case
          when jsonb_typeof(item->'price') = 'number' then (item->>'price')::numeric
          when (item->>'price') ~ '^[0-9]+(\.[0-9]+)?$' then (item->>'price')::numeric
          else 0
        end as price
      from jsonb_array_elements(NEW.items) as item
    loop
      v_prod_id := v_item.product_id;
      v_item_price := v_item.price;

      if v_prod_id is null or v_prod_id = '' or v_prod_id = v_item.title then
        raise exception 'Order item "%" is missing a valid canonical product_id', coalesce(v_item.title, 'Товар')
          using errcode = 'P0008';
      end if;

      select admin_id, payload into v_auth_row
      from public.products
      where admin_id = v_prod_id;

      if not found then
        raise exception 'Product % does not exist in catalog', v_prod_id
          using errcode = 'P0009';
      end if;

      -- Check authoritative price from product payload
      if v_auth_row.payload is not null and v_auth_row.payload ? 'price' then
        v_auth_price := (v_auth_row.payload->>'price')::numeric;
        if v_auth_price is not null and v_auth_price > 0 and v_item_price <> v_auth_price then
          raise exception 'Client submitted price (%) does not match authoritative catalog price (%) for product %',
            v_item_price, v_auth_price, v_prod_id
            using errcode = 'P0011';
        end if;
      end if;
    end loop;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_order_stock_before on public.orders;
create trigger trg_order_stock_before
  before insert on public.orders
  for each row
  execute function public.trg_order_stock_before_handler();

-- ------------------------------------------------------------------------------
-- 9. TRIGGER: AFTER INSERT & UPDATE ON ORDERS (ATOMIC STATUS SYNCHRONIZATION)
-- Automatically executes reservation, deduction, or release based on status.
-- ------------------------------------------------------------------------------
create or replace function public.trg_order_stock_after_handler()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 1. On INSERT: default processing status triggers atomic reservation
  if TG_OP = 'INSERT' then
    if NEW.status in ('processing', 'ready_to_ship') then
      perform public.reserve_order_stock(NEW.id);
    end if;
    return NEW;
  end if;

  -- 2. On UPDATE of status:
  if TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
    -- Out of stock or cancelled -> release reserved stock
    if NEW.status in ('out_of_stock', 'cancelled') then
      perform public.release_order_stock(NEW.id);

    -- Successful / Delivered -> deduct reserved stock
    elsif NEW.status = 'successful' and OLD.stock_status = 'reserved' then
      perform public.deduct_order_stock(NEW.id);

    -- Back to processing or ready_to_ship from cancelled/out_of_stock -> re-reserve
    elsif NEW.status in ('processing', 'ready_to_ship') and OLD.status in ('out_of_stock', 'cancelled') then
      perform public.reserve_order_stock(NEW.id);
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_order_stock_after on public.orders;
create trigger trg_order_stock_after
  after insert or update of status on public.orders
  for each row
  execute function public.trg_order_stock_after_handler();

-- ------------------------------------------------------------------------------
-- 10. GRANTS
-- ------------------------------------------------------------------------------
grant select on table public.order_stock_reservations to authenticated;
grant execute on function public.get_product_available_quantity(text, uuid) to anon, authenticated, service_role;
grant execute on function public.reserve_order_stock(uuid, uuid) to authenticated, service_role;
grant execute on function public.release_order_stock(uuid) to authenticated, service_role;
grant execute on function public.deduct_order_stock(uuid) to authenticated, service_role;
