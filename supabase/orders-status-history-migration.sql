-- ============================================================
-- EMIRATE CO — Order Status History & Safe Guest Orders Linking
-- Migration is idempotent and can be safely re-run.
-- ============================================================

-- 1. Table: order_status_history
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  comment text,
  created_at timestamptz not null default now()
);

-- 2. Indexes
create index if not exists order_status_history_order_id_idx
  on public.order_status_history (order_id);

create index if not exists order_status_history_created_at_idx
  on public.order_status_history (created_at asc);

-- 3. Row Level Security
alter table public.order_status_history enable row level security;

-- Logged-in customer can read history for their own orders only
drop policy if exists "status_history customer read own" on public.order_status_history;
create policy "status_history customer read own"
  on public.order_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and o.user_id = auth.uid()
    )
  );

-- Admins can read all status histories
drop policy if exists "status_history admin read" on public.order_status_history;
create policy "status_history admin read"
  on public.order_status_history for select
  to authenticated
  using (
    exists (select 1 from public.admin_users u where u.user_id = auth.uid())
  );

-- 4. Trigger Function: automatically log status insertions and updates
create or replace function public.trg_order_status_history_log()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.order_status_history (order_id, status, comment, created_at)
    values (
      NEW.id,
      coalesce(NEW.status, 'processing'),
      case
        when NEW.status = 'ready_to_ship' then 'Готовится к отправке'
        when NEW.status = 'successful' then 'Доставлен / Заказ выполнен'
        when NEW.status = 'out_of_stock' then 'Товар требует уточнения'
        else 'Заказ принят / В обработке'
      end,
      coalesce(NEW.created_at, now())
    );
    return NEW;
  elsif (TG_OP = 'UPDATE') then
    -- Do not insert a duplicate entry if status hasn't changed
    if (OLD.status is distinct from NEW.status) then
      insert into public.order_status_history (order_id, status, comment, created_at)
      values (
        NEW.id,
        NEW.status,
        case
          when NEW.status = 'processing' then 'Заказ принят / В обработке'
          when NEW.status = 'ready_to_ship' then 'Готовится к отправке'
          when NEW.status = 'successful' then 'Доставлен / Заказ выполнен'
          when NEW.status = 'out_of_stock' then 'Товар требует уточнения'
          else 'Статус обновлен'
        end,
        now()
      );
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_orders_status_history on public.orders;
create trigger trg_orders_status_history
  after insert or update of status on public.orders
  for each row
  execute function public.trg_order_status_history_log();

-- 5. Safe Guest Orders Linker Function:
-- Only links guest orders (user_id IS NULL) whose normalized 9 phone digits match
-- the verified phone of the currently authenticated customer in customer_profiles.
create or replace function public.link_guest_orders_for_current_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_phone text;
  v_digits text;
  v_count integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return 0;
  end if;

  select phone into v_phone
  from public.customer_profiles
  where user_id = v_user_id;

  if v_phone is null or length(trim(v_phone)) = 0 then
    return 0;
  end if;

  v_digits := right(regexp_replace(v_phone, '\D', '', 'g'), 9);
  if length(v_digits) <> 9 then
    return 0;
  end if;

  with updated as (
    update public.orders
    set user_id = v_user_id
    where user_id is null
      and right(regexp_replace(phone, '\D', '', 'g'), 9) = v_digits
    returning id
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$$;

grant execute on function public.link_guest_orders_for_current_user to authenticated;

-- 6. Backfill existing orders that lack a status history entry
insert into public.order_status_history (order_id, status, comment, created_at)
select
  o.id,
  coalesce(o.status, 'processing'),
  case
    when o.status = 'ready_to_ship' then 'Готовится к отправке'
    when o.status = 'successful' then 'Доставлен / Заказ выполнен'
    when o.status = 'out_of_stock' then 'Товар требует уточнения'
    else 'Заказ принят / В обработке'
  end,
  coalesce(o.created_at, now())
from public.orders o
where not exists (
  select 1 from public.order_status_history h where h.order_id = o.id
);
