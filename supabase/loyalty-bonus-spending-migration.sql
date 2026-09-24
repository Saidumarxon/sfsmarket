-- ============================================================
-- EMIRATE CO — STAGE 2C-2: Bonus Spending During Checkout
-- Safe, idempotent, backward-compatible migration.
-- DO NOT RUN AUTOMATICALLY ON LIVE DB WITHOUT EXPLICIT APPROVAL.
-- ============================================================

-- 1. Ensure promo_discount column exists on public.orders for authoritative arithmetic validation
alter table public.orders
  add column if not exists promo_discount numeric not null default 0;

-- 2. BEFORE INSERT TRIGGER: Validates channel, balance, and authoritative order arithmetic
create or replace function public.trg_order_bonus_before_handler()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_available numeric := 0;
  v_items_sum numeric := 0;
  v_promo numeric := 0;
  v_gross numeric := 0;
begin
  -- If bonus_used is not specified or 0, ensure it is set to 0 and allow
  if NEW.bonus_used is null or NEW.bonus_used <= 0 then
    NEW.bonus_used := 0;
    return NEW;
  end if;

  -- 1. Guest customers cannot spend bonuses
  if NEW.user_id is null then
    raise exception 'Guest customers cannot spend bonuses' using errcode = 'P0001';
  end if;

  -- 2. Reject bonus-spending orders arriving through an unprivileged direct client connection
  -- Direct PostgREST requests run as 'anon' or 'authenticated'.
  -- Privileged requests from /api/place-order run as service_role or with loyalty_bypass.
  if auth.role() in ('anon', 'authenticated')
     and coalesce(current_setting('emirate.loyalty_bypass', true), 'false') <> 'true'
     and not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'Direct client bonus spending is not permitted. Orders with bonuses must be placed via the secure API.' using errcode = 'P0002';
  end if;

  -- 3. Lock customer_profiles row FOR UPDATE and verify balance
  select bonus_balance into v_available
  from public.customer_profiles
  where user_id = NEW.user_id
  for update;

  if v_available is null or v_available < NEW.bonus_used then
    raise exception 'Insufficient bonus balance: requested %, available %', NEW.bonus_used, coalesce(v_available, 0) using errcode = 'P0003';
  end if;

  -- 4. Calculate items sum from NEW.items JSONB
  select coalesce(sum(
    case
      when jsonb_typeof(item->'price') = 'number' and jsonb_typeof(item->'qty') = 'number'
      then (item->>'price')::numeric * (item->>'qty')::numeric
      when (item->>'price') ~ '^[0-9]+(\.[0-9]+)?$' and (item->>'qty') ~ '^[0-9]+$'
      then (item->>'price')::numeric * (item->>'qty')::numeric
      else 0
    end
  ), 0)
  into v_items_sum
  from jsonb_array_elements(case when jsonb_typeof(NEW.items) = 'array' then NEW.items else '[]'::jsonb end) as item;

  -- 5. Arithmetic validation: items_sum - promo_discount = total_amount + bonus_used
  v_promo := coalesce(NEW.promo_discount, 0);
  if v_promo < 0 then
    raise exception 'Promo discount cannot be negative' using errcode = 'P0004';
  end if;

  v_gross := greatest(0, v_items_sum - v_promo);

  if NEW.bonus_used > v_gross then
    raise exception 'Bonus spend (%) cannot exceed gross order total (%)', NEW.bonus_used, v_gross using errcode = 'P0005';
  end if;

  if (coalesce(NEW.total_amount, 0) + NEW.bonus_used) <> v_gross then
    raise exception 'Order total arithmetic mismatch: expected total + bonus = %, got total(%) + bonus(%)',
      v_gross, coalesce(NEW.total_amount, 0), NEW.bonus_used using errcode = 'P0006';
  end if;

  if coalesce(NEW.total_amount, 0) < 0 then
    raise exception 'Total payable amount cannot be negative' using errcode = 'P0007';
  end if;

  return NEW;
end;
$$;

-- 3. AFTER INSERT/UPDATE TRIGGER: Handles atomic deduction and cancellation refund
create or replace function public.trg_order_bonus_after_handler()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_balance numeric := 0;
  v_already_refunded boolean := false;
begin
  -- INSERT: Deduct bonuses and record bonus_spent
  if tg_op = 'INSERT' then
    if coalesce(NEW.bonus_used, 0) > 0 then
      perform set_config('emirate.loyalty_bypass', 'true', true);

      update public.customer_profiles
      set bonus_balance = bonus_balance - NEW.bonus_used
      where user_id = NEW.user_id
      returning bonus_balance into v_new_balance;

      insert into public.bonus_transactions (
        user_id, order_id, type, amount, balance_after, description, status, expires_at
      ) values (
        NEW.user_id, NEW.id, 'bonus_spent', -NEW.bonus_used, coalesce(v_new_balance, 0),
        'Оплата заказа #' || substring(NEW.id::text, 1, 8),
        'completed', null
      );
    end if;
    return NEW;
  end if;

  -- UPDATE: Refund bonuses when order transitions to out_of_stock
  if tg_op = 'UPDATE' then
    if NEW.status = 'out_of_stock'
       and (OLD.status is distinct from 'out_of_stock')
       and coalesce(NEW.bonus_used, 0) > 0 then
      
      select exists (
        select 1 from public.bonus_transactions
        where order_id = NEW.id and type = 'bonus_refunded'
      ) into v_already_refunded;

      if not v_already_refunded then
        perform set_config('emirate.loyalty_bypass', 'true', true);

        update public.customer_profiles
        set bonus_balance = coalesce(bonus_balance, 0) + NEW.bonus_used
        where user_id = NEW.user_id
        returning bonus_balance into v_new_balance;

        insert into public.bonus_transactions (
          user_id, order_id, type, amount, balance_after, description, status, expires_at
        ) values (
          NEW.user_id, NEW.id, 'bonus_refunded', NEW.bonus_used, coalesce(v_new_balance, NEW.bonus_used),
          'Возврат бонусов за заказ #' || substring(NEW.id::text, 1, 8),
          'completed', null
        );
      end if;
    end if;
    return NEW;
  end if;

  return NEW;
end;
$$;

-- 4. Attach Triggers to public.orders
drop trigger if exists trg_order_bonus_before on public.orders;
create trigger trg_order_bonus_before
  before insert on public.orders
  for each row execute function public.trg_order_bonus_before_handler();

drop trigger if exists trg_order_bonus_after on public.orders;
create trigger trg_order_bonus_after
  after insert or update on public.orders
  for each row execute function public.trg_order_bonus_after_handler();
