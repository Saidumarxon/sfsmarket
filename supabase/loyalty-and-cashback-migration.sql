-- ============================================================
-- EMIRATE CO — STAGE 2C-1: Loyalty / Cashback / Bonus Balance
-- Safe, idempotent, backward-compatible migration.
-- DO NOT RUN AUTOMATICALLY ON LIVE DB WITHOUT EXPLICIT APPROVAL.
-- ============================================================

-- 1. Extend customer_profiles
alter table public.customer_profiles
  add column if not exists bonus_balance numeric not null default 0,
  add column if not exists loyalty_tier text not null default 'standard',
  add column if not exists is_emirate_plus boolean not null default false,
  add column if not exists emirate_plus_until timestamptz;

-- 1b. Guard system fields on customer_profiles from direct manipulation by client users
create or replace function public.customer_profiles_guard_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Always preserve registered_at and update updated_at
  if tg_op = 'UPDATE' then
    new.registered_at := old.registered_at;
  end if;
  new.updated_at := now();

  -- If called from regular authenticated client session (not internal system/trigger bypass and not admin)
  -- prevent overwriting of financial / tier / counter columns
  if coalesce(current_setting('emirate.loyalty_bypass', true), 'false') <> 'true' then
    if auth.role() = 'authenticated' and not exists (select 1 from public.admin_users where user_id = auth.uid()) then
      new.bonus_balance := coalesce(old.bonus_balance, 0);
      new.loyalty_tier := coalesce(old.loyalty_tier, 'standard');
      new.orders_count := coalesce(old.orders_count, 0);
      new.orders_total := coalesce(old.orders_total, 0);
      new.is_emirate_plus := coalesce(old.is_emirate_plus, false);
      new.emirate_plus_until := old.emirate_plus_until;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists customer_profiles_guard_system_fields_trg on public.customer_profiles;
create trigger customer_profiles_guard_system_fields_trg
  before update on public.customer_profiles
  for each row execute function public.customer_profiles_guard_system_fields();

-- 2. Extend orders
alter table public.orders
  add column if not exists bonus_used numeric not null default 0,
  add column if not exists cashback_earned numeric not null default 0,
  add column if not exists cashback_status text not null default 'none';

-- Historical successful orders safeguard:
-- Any order that was already successful prior to loyalty migration must NOT be retroactively awarded cashback.
update public.orders
set cashback_status = 'archived'
where status = 'successful'
  and (cashback_status is null or cashback_status = 'none');

-- 3. Create bonus_transactions table
create table if not exists public.bonus_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  type text not null check (type in ('cashback_earned', 'bonus_spent', 'bonus_refunded', 'manual_adjustment')),
  amount numeric not null,
  balance_after numeric not null default 0,
  description text,
  status text not null default 'completed' check (status in ('pending', 'completed', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indexes for bonus_transactions
create index if not exists bonus_transactions_user_id_idx
  on public.bonus_transactions (user_id, created_at desc);

create index if not exists bonus_transactions_order_id_idx
  on public.bonus_transactions (order_id);

-- Enforce EXACTLY ONE cashback transaction per order (guarantees idempotency)
create unique index if not exists bonus_transactions_order_cashback_uidx
  on public.bonus_transactions (order_id)
  where (type = 'cashback_earned');

-- 4. Enable RLS on bonus_transactions
alter table public.bonus_transactions enable row level security;

-- Client can ONLY view their own bonus transactions
drop policy if exists "bonus_transactions read self" on public.bonus_transactions;
create policy "bonus_transactions read self"
  on public.bonus_transactions for select
  to authenticated
  using (auth.uid() = user_id);

-- Admins can view all bonus transactions
drop policy if exists "bonus_transactions admin read all" on public.bonus_transactions;
create policy "bonus_transactions admin read all"
  on public.bonus_transactions for select
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

-- 5. Helper function to compute tier and cashback percentage
create or replace function public.calc_loyalty_tier(p_turnover numeric)
returns table (tier text, pct numeric, next_tier text, next_threshold numeric, amount_needed numeric)
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_turnover >= 30000000 then
    return query select 'platinum'::text, 5::numeric, null::text, 30000000::numeric, 0::numeric;
  elsif p_turnover >= 15000000 then
    return query select 'gold'::text, 3::numeric, 'platinum'::text, 30000000::numeric, (30000000 - p_turnover)::numeric;
  elsif p_turnover >= 5000000 then
    return query select 'silver'::text, 2::numeric, 'gold'::text, 15000000::numeric, (15000000 - p_turnover)::numeric;
  else
    return query select 'standard'::text, 1::numeric, 'silver'::text, 5000000::numeric, (5000000 - p_turnover)::numeric;
  end if;
end;
$$;

-- 6. Triggers to handle order cashback lifecycle (BEFORE/AFTER architecture for FK integrity)

-- 6A. BEFORE trigger: sets cashback_earned and cashback_status on NEW row
create or replace function public.trg_order_cashback_before_handler()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_turnover numeric := 0;
  v_tier text := 'standard';
  v_pct numeric := 1;
  v_cashback numeric := 0;
  v_is_admin boolean := false;
begin
  -- 1. Ignore orders without user_id (guest checkout)
  if NEW.user_id is null then
    NEW.cashback_earned := 0;
    NEW.cashback_status := 'none';
    return NEW;
  end if;

  -- 2. Ignore admin users (admin_users table primary, and hardcoded known admin UUID as defense-in-depth)
  select exists (select 1 from public.admin_users where user_id = NEW.user_id) into v_is_admin;
  if v_is_admin or NEW.user_id = '7e7a515a-5727-434a-a313-4fc3d27313be'::uuid then
    NEW.cashback_earned := 0;
    NEW.cashback_status := 'none';
    return NEW;
  end if;

  -- 3. Calculate current customer turnover from existing SUCCESSFUL orders (excluding this order)
  select coalesce(sum(total_amount), 0)
  into v_turnover
  from public.orders
  where user_id = NEW.user_id
    and status = 'successful'
    and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Determine tier & cashback percentage
  select t.tier, t.pct into v_tier, v_pct from public.calc_loyalty_tier(v_turnover) t;

  -- Calculate cashback amount (1% to 5% of order total, rounded to whole UZS)
  v_cashback := round((coalesce(NEW.total_amount, 0) * v_pct) / 100.0);

  -- INSERT: Order created
  if tg_op = 'INSERT' then
    NEW.cashback_earned := v_cashback;
    if NEW.status = 'successful' then
      NEW.cashback_status := 'credited';
    else
      NEW.cashback_status := 'pending';
    end if;
    return NEW;
  end if;

  -- UPDATE: Status or order changed
  if tg_op = 'UPDATE' then
    -- Guard 1: Already credited or archived orders must NEVER receive cashback again
    if OLD.cashback_status in ('credited', 'archived') then
      return NEW;
    end if;

    -- Guard 2: Historical pre-existing successful orders (with status 'none' or null) must NOT receive retroactive cashback on resave
    if OLD.status = 'successful' and (OLD.cashback_status is null or OLD.cashback_status = 'none') then
      NEW.cashback_status := 'archived';
      return NEW;
    end if;

    -- Case A: Transition into 'successful' from processing, ready_to_ship, etc.
    if NEW.status = 'successful' and OLD.status is distinct from 'successful' then
      v_cashback := coalesce(NEW.cashback_earned, v_cashback);
      if v_cashback <= 0 then
        v_cashback := round((coalesce(NEW.total_amount, 0) * v_pct) / 100.0);
      end if;
      NEW.cashback_earned := v_cashback;
      NEW.cashback_status := 'credited';

    -- Case B: Order cancelled or out of stock
    elsif NEW.status = 'out_of_stock' and OLD.cashback_status = 'pending' then
      NEW.cashback_status := 'cancelled';
    end if;

    return NEW;
  end if;

  return NEW;
end;
$$;

-- 6B. AFTER trigger: handles bonus_transactions and customer_profiles once the orders row exists
create or replace function public.trg_order_cashback_after_handler()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_turnover numeric := 0;
  v_new_balance numeric := 0;
  v_is_admin boolean := false;
begin
  -- 1. Ignore orders without user_id (guest checkout)
  if NEW.user_id is null then
    return NEW;
  end if;

  -- 2. Ignore admin users
  select exists (select 1 from public.admin_users where user_id = NEW.user_id) into v_is_admin;
  if v_is_admin or NEW.user_id = '7e7a515a-5727-434a-a313-4fc3d27313be'::uuid then
    return NEW;
  end if;

  -- INSERT: The row in public.orders now exists!
  if tg_op = 'INSERT' then
    if NEW.cashback_status = 'credited' and coalesce(NEW.cashback_earned, 0) > 0 then
      -- Calculate turnover from prior successful orders
      select coalesce(sum(total_amount), 0)
      into v_turnover
      from public.orders
      where user_id = NEW.user_id
        and status = 'successful'
        and id <> NEW.id;

      -- Bypass client guard for system loyalty update
      perform set_config('emirate.loyalty_bypass', 'true', true);

      -- Upsert customer profile
      insert into public.customer_profiles (
        user_id, bonus_balance, orders_count, orders_total, loyalty_tier
      ) values (
        NEW.user_id, NEW.cashback_earned, 1, coalesce(NEW.total_amount, 0),
        (select t.tier from public.calc_loyalty_tier(v_turnover + NEW.total_amount) t)
      )
      on conflict (user_id) do update
      set bonus_balance = coalesce(public.customer_profiles.bonus_balance, 0) + NEW.cashback_earned,
          orders_count = coalesce(public.customer_profiles.orders_count, 0) + 1,
          orders_total = coalesce(public.customer_profiles.orders_total, 0) + NEW.total_amount,
          loyalty_tier = (select t.tier from public.calc_loyalty_tier(v_turnover + NEW.total_amount) t)
      returning bonus_balance into v_new_balance;

      -- Insert completed bonus transaction
      insert into public.bonus_transactions (
        user_id, order_id, type, amount, balance_after, description, status, expires_at
      ) values (
        NEW.user_id, NEW.id, 'cashback_earned', NEW.cashback_earned, coalesce(v_new_balance, NEW.cashback_earned),
        'Кэшбэк за заказ #' || substring(NEW.id::text, 1, 8),
        'completed', now() + interval '180 days'
      ) on conflict (order_id) where (type = 'cashback_earned') do nothing;

    elsif NEW.cashback_status = 'pending' and coalesce(NEW.cashback_earned, 0) > 0 then
      -- Insert pending bonus transaction
      insert into public.bonus_transactions (
        user_id, order_id, type, amount, balance_after, description, status, expires_at
      ) values (
        NEW.user_id, NEW.id, 'cashback_earned', NEW.cashback_earned, 0,
        'Кэшбэк за заказ #' || substring(NEW.id::text, 1, 8) || ' (ожидает вручения)',
        'pending', null
      ) on conflict (order_id) where (type = 'cashback_earned') do nothing;
    end if;

    return NEW;
  end if;

  -- UPDATE: Handled only when cashback state changes
  if tg_op = 'UPDATE' then
    -- Guard 1: Idempotency - if already credited or archived prior to this update, do nothing
    if OLD.cashback_status in ('credited', 'archived') then
      return NEW;
    end if;

    -- Case A: Order transitioned into credited
    if NEW.cashback_status = 'credited' and OLD.cashback_status is distinct from 'credited' then
      -- Calculate turnover from other successful orders
      select coalesce(sum(total_amount), 0)
      into v_turnover
      from public.orders
      where user_id = NEW.user_id
        and status = 'successful'
        and id <> NEW.id;

      -- Bypass client guard for system loyalty update
      perform set_config('emirate.loyalty_bypass', 'true', true);

      -- Upsert customer profile
      insert into public.customer_profiles (
        user_id, bonus_balance, orders_count, orders_total, loyalty_tier
      ) values (
        NEW.user_id, NEW.cashback_earned, 1, coalesce(NEW.total_amount, 0),
        (select t.tier from public.calc_loyalty_tier(v_turnover + NEW.total_amount) t)
      )
      on conflict (user_id) do update
      set bonus_balance = coalesce(public.customer_profiles.bonus_balance, 0) + NEW.cashback_earned,
          orders_count = coalesce(public.customer_profiles.orders_count, 0) + 1,
          orders_total = coalesce(public.customer_profiles.orders_total, 0) + NEW.total_amount,
          loyalty_tier = (select t.tier from public.calc_loyalty_tier(v_turnover + NEW.total_amount) t)
      returning bonus_balance into v_new_balance;

      -- Update existing pending transaction or insert if none
      update public.bonus_transactions
      set status = 'completed',
          amount = NEW.cashback_earned,
          balance_after = coalesce(v_new_balance, NEW.cashback_earned),
          description = 'Кэшбэк за заказ #' || substring(NEW.id::text, 1, 8),
          expires_at = now() + interval '180 days'
      where order_id = NEW.id and type = 'cashback_earned';

      if not found then
        insert into public.bonus_transactions (
          user_id, order_id, type, amount, balance_after, description, status, expires_at
        ) values (
          NEW.user_id, NEW.id, 'cashback_earned', NEW.cashback_earned, coalesce(v_new_balance, NEW.cashback_earned),
          'Кэшбэк за заказ #' || substring(NEW.id::text, 1, 8),
          'completed', now() + interval '180 days'
        ) on conflict (order_id) where (type = 'cashback_earned') do nothing;
      end if;

    -- Case B: Order cancelled or out of stock
    elsif NEW.cashback_status = 'cancelled' and OLD.cashback_status = 'pending' then
      update public.bonus_transactions
      set status = 'cancelled',
          description = description || ' (отменён)'
      where order_id = NEW.id and type = 'cashback_earned' and status = 'pending';
    end if;

    return NEW;
  end if;

  return NEW;
end;
$$;

-- Drop previous triggers if exist
drop trigger if exists trg_order_cashback on public.orders;
drop trigger if exists trg_order_cashback_before on public.orders;
drop trigger if exists trg_order_cashback_after on public.orders;

-- Attach BEFORE trigger: sets cashback_earned and cashback_status
create trigger trg_order_cashback_before
  before insert or update on public.orders
  for each row execute function public.trg_order_cashback_before_handler();

-- Attach AFTER trigger: manages bonus_transactions and customer_profiles
create trigger trg_order_cashback_after
  after insert or update on public.orders
  for each row execute function public.trg_order_cashback_after_handler();

-- 7. Client RPC: get_customer_loyalty_summary
create or replace function public.get_customer_loyalty_summary()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile record;
  v_turnover numeric := 0;
  v_tier text := 'standard';
  v_pct numeric := 1;
  v_next_tier text := 'silver';
  v_next_threshold numeric := 5000000;
  v_needed numeric := 5000000;
  v_pending numeric := 0;
  v_tx_list jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  -- Load profile
  select bonus_balance, loyalty_tier, is_emirate_plus, emirate_plus_until
  into v_profile
  from public.customer_profiles
  where user_id = v_uid;

  -- Compute actual successful turnover
  select coalesce(sum(total_amount), 0)
  into v_turnover
  from public.orders
  where user_id = v_uid and status = 'successful';

  -- Compute tier parameters
  select t.tier, t.pct, t.next_tier, t.next_threshold, t.amount_needed
  into v_tier, v_pct, v_next_tier, v_next_threshold, v_needed
  from public.calc_loyalty_tier(v_turnover) t;

  -- Compute pending cashback
  select coalesce(sum(amount), 0)
  into v_pending
  from public.bonus_transactions
  where user_id = v_uid and status = 'pending';

  -- Fetch last 10 transactions
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tx.id,
      'type', tx.type,
      'amount', tx.amount,
      'balance_after', tx.balance_after,
      'status', tx.status,
      'description', tx.description,
      'expires_at', tx.expires_at,
      'created_at', tx.created_at
    ) order by tx.created_at desc
  ), '[]'::jsonb)
  into v_tx_list
  from (
    select * from public.bonus_transactions
    where user_id = v_uid
    order by created_at desc
    limit 10
  ) tx;

  return jsonb_build_object(
    'ok', true,
    'bonus_balance', coalesce(v_profile.bonus_balance, 0),
    'loyalty_tier', v_tier,
    'cashback_percent', v_pct,
    'turnover_successful', v_turnover,
    'next_tier', v_next_tier,
    'next_tier_threshold', v_next_threshold,
    'amount_to_next_tier', v_needed,
    'pending_cashback', v_pending,
    'is_emirate_plus', coalesce(v_profile.is_emirate_plus, false),
    'emirate_plus_until', v_profile.emirate_plus_until,
    'recent_transactions', v_tx_list
  );
end;
$$;

-- Grant execution
grant execute on function public.get_customer_loyalty_summary() to authenticated;
grant execute on function public.calc_loyalty_tier(numeric) to authenticated, anon;
