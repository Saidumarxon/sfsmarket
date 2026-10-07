-- ============================================================
-- EMIRATE CO — STAGE 2C-3A: Emirate Plus (DB Model & Security)
-- Safe, idempotent, backward-compatible migration.
-- DO NOT RUN AUTOMATICALLY ON LIVE DB WITHOUT EXPLICIT APPROVAL.
-- ============================================================

-- 1. Create public.plus_subscriptions table
create table if not exists public.plus_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  price numeric not null default 49900 check (price >= 0),
  payment_method text not null default 'card',
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled', 'refunded')),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plus_subscriptions_dates_check check (expires_at > starts_at)
);

create index if not exists plus_subscriptions_user_status_idx
  on public.plus_subscriptions (user_id, status, expires_at desc);

-- 2. Enable Row Level Security on plus_subscriptions
alter table public.plus_subscriptions enable row level security;

-- Client can only view their own subscriptions
drop policy if exists "plus_subscriptions read self" on public.plus_subscriptions;
create policy "plus_subscriptions read self"
  on public.plus_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

-- Admins can view all subscriptions
drop policy if exists "plus_subscriptions admin read all" on public.plus_subscriptions;
create policy "plus_subscriptions admin read all"
  on public.plus_subscriptions for select
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

-- Strictly revoke direct client writes (INSERT/UPDATE/DELETE)
revoke insert, update, delete on public.plus_subscriptions from anon, authenticated;

-- 3. Authoritative runtime helper: is_customer_plus_active
create or replace function public.is_customer_plus_active(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_plus boolean := false;
  v_until timestamptz;
  v_has_active_sub boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  -- Check cached customer_profiles values
  select is_emirate_plus, emirate_plus_until
  into v_is_plus, v_until
  from public.customer_profiles
  where user_id = p_user_id;

  -- If cached flag is not set or expiry date has passed, immediately false
  if coalesce(v_is_plus, false) is false or (v_until is not null and v_until <= now()) then
    return false;
  end if;

  -- Authoritative verification against plus_subscriptions audit history
  select exists (
    select 1 from public.plus_subscriptions
    where user_id = p_user_id
      and status = 'active'
      and starts_at <= now()
      and expires_at > now()
  ) into v_has_active_sub;

  return v_has_active_sub;
end;
$$;

-- 4. Trusted activation function (callable only by service_role / trusted backend / admin)
create or replace function public.activate_emirate_plus(
  p_user_id uuid,
  p_price numeric default 49900,
  p_payment_method text default 'card',
  p_duration_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_starts_at timestamptz := now();
  v_expires_at timestamptz;
  v_sub_id uuid;
  v_existing_expires timestamptz;
  v_is_admin boolean := false;
begin
  -- Security check: block direct unprivileged client calls
  if auth.role() in ('anon', 'authenticated')
     and coalesce(current_setting('emirate.loyalty_bypass', true), 'false') <> 'true' then
    select exists (select 1 from public.admin_users where user_id = auth.uid()) into v_is_admin;
    if not v_is_admin then
      raise exception 'Direct client activation of Emirate Plus is not permitted' using errcode = 'P0002';
    end if;
  end if;

  if p_user_id is null then
    raise exception 'User ID is required' using errcode = 'P0001';
  end if;

  if p_price < 0 then
    raise exception 'Price cannot be negative' using errcode = 'P0004';
  end if;

  if p_duration_days is null or p_duration_days <= 0 then
    p_duration_days := 30;
  end if;

  -- Check if user already has an active subscription to extend
  select max(expires_at) into v_existing_expires
  from public.plus_subscriptions
  where user_id = p_user_id
    and status = 'active'
    and expires_at > now();

  if v_existing_expires is not null and v_existing_expires > now() then
    v_starts_at := v_existing_expires;
    v_expires_at := v_existing_expires + (p_duration_days || ' days')::interval;
  else
    v_starts_at := now();
    v_expires_at := now() + (p_duration_days || ' days')::interval;
  end if;

  -- Insert active subscription
  insert into public.plus_subscriptions (
    user_id, starts_at, expires_at, price, payment_method, status
  ) values (
    p_user_id, v_starts_at, v_expires_at, p_price, p_payment_method, 'active'
  ) returning id into v_sub_id;

  -- Atomically update customer_profiles cache with loyalty_bypass
  perform set_config('emirate.loyalty_bypass', 'true', true);

  update public.customer_profiles
  set is_emirate_plus = true,
      emirate_plus_until = v_expires_at
  where user_id = p_user_id;

  if not found then
    insert into public.customer_profiles (
      user_id, is_emirate_plus, emirate_plus_until
    ) values (
      p_user_id, true, v_expires_at
    ) on conflict (user_id) do update
    set is_emirate_plus = true,
        emirate_plus_until = v_expires_at;
  end if;

  return jsonb_build_object(
    'ok', true,
    'subscription_id', v_sub_id,
    'user_id', p_user_id,
    'starts_at', v_starts_at,
    'expires_at', v_expires_at,
    'price', p_price,
    'status', 'active'
  );
end;
$$;

revoke execute on function public.activate_emirate_plus(uuid, numeric, text, integer) from public, anon, authenticated;
grant execute on function public.activate_emirate_plus(uuid, numeric, text, integer) to service_role;

-- 5. Helper to mark Plus usage (disables refund eligibility)
create or replace function public.mark_plus_used(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  update public.plus_subscriptions
  set used_at = coalesce(used_at, now()),
      updated_at = now()
  where user_id = p_user_id
    and status = 'active'
    and expires_at > now()
    and used_at is null;

  return found;
end;
$$;

-- 6. Trusted refund function (enforces <= 7 days and used_at IS NULL)
create or replace function public.refund_emirate_plus(
  p_subscription_id uuid,
  p_reason text default 'customer_request'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub record;
  v_is_admin boolean := false;
begin
  -- Security check: block direct client refunds
  if auth.role() in ('anon', 'authenticated')
     and coalesce(current_setting('emirate.loyalty_bypass', true), 'false') <> 'true' then
    select exists (select 1 from public.admin_users where user_id = auth.uid()) into v_is_admin;
    if not v_is_admin then
      raise exception 'Direct client refund of Emirate Plus is not permitted' using errcode = 'P0002';
    end if;
  end if;

  select * into v_sub
  from public.plus_subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'subscription_not_found');
  end if;

  if v_sub.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'subscription_not_active', 'status', v_sub.status);
  end if;

  -- 7-day refund window check
  if now() > (v_sub.starts_at + interval '7 days') then
    return jsonb_build_object('ok', false, 'error', 'refund_window_expired', 'starts_at', v_sub.starts_at);
  end if;

  -- Strictly forbidden if Plus was already used
  if v_sub.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'plus_already_used', 'used_at', v_sub.used_at);
  end if;

  -- Mark subscription refunded
  update public.plus_subscriptions
  set status = 'refunded',
      updated_at = now()
  where id = p_subscription_id;

  -- Sync customer_profiles cache if no other active subscription exists
  perform set_config('emirate.loyalty_bypass', 'true', true);

  if not exists (
    select 1 from public.plus_subscriptions
    where user_id = v_sub.user_id
      and status = 'active'
      and expires_at > now()
  ) then
    update public.customer_profiles
    set is_emirate_plus = false,
        emirate_plus_until = null
    where user_id = v_sub.user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'refunded', true,
    'subscription_id', p_subscription_id,
    'user_id', v_sub.user_id,
    'amount', v_sub.price,
    'reason', p_reason
  );
end;
$$;

revoke execute on function public.refund_emirate_plus(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_emirate_plus(uuid, text) to service_role;

-- 7. Effective cashback calculation helper (+1 percentage point for Plus, capped at 6%)
create or replace function public.calc_effective_cashback_pct(p_turnover numeric, p_is_plus boolean)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_base numeric := 1;
begin
  select pct into v_base from public.calc_loyalty_tier(p_turnover);
  if coalesce(p_is_plus, false) then
    return least(6, v_base + 1);
  end if;
  return v_base;
end;
$$;

-- 8. Updated Loyalty Summary RPC (preserves all existing fields, adds is_emirate_plus_active)
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
  v_is_plus_active boolean := false;
  v_effective_pct numeric := 1;
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

  -- Compute active Plus status & effective cashback percent
  v_is_plus_active := public.is_customer_plus_active(v_uid);
  v_effective_pct := public.calc_effective_cashback_pct(v_turnover, v_is_plus_active);

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
    'cashback_percent', v_effective_pct,
    'base_cashback_percent', v_pct,
    'turnover_successful', v_turnover,
    'next_tier', v_next_tier,
    'next_tier_threshold', v_next_threshold,
    'amount_to_next_tier', v_needed,
    'pending_cashback', v_pending,
    'is_emirate_plus', coalesce(v_profile.is_emirate_plus, false),
    'emirate_plus_until', v_profile.emirate_plus_until,
    'is_emirate_plus_active', v_is_plus_active,
    'recent_transactions', v_tx_list
  );
end;
$$;
