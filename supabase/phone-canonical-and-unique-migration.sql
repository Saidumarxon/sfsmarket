-- =====================================================================
-- МИГРАЦИЯ: КАНОНИЗАЦИЯ ТЕЛЕФОНОВ И УНИКАЛЬНЫЙ ИНДЕКС CUSTOMER_PROFILES
-- ВЫПОЛНЯТЬ В SUPABASE SQL EDITOR ПОСЛЕ УСТРАНЕНИЯ ДУБЛЯ 770176699
-- =====================================================================

begin;

-- 1. Каноническая функция нормализации узбекских номеров в PostgreSQL
create or replace function public.normalize_uz_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  raw_digits text;
  local_num text;
begin
  if p_phone is null or trim(p_phone) = '' then
    return null;
  end if;

  raw_digits := regexp_replace(p_phone, '\D', '', 'g');

  if length(raw_digits) = 12 and raw_digits like '998%' then
    local_num := substr(raw_digits, 4);
  elsif length(raw_digits) = 10 and raw_digits like '8%' then
    local_num := substr(raw_digits, 2);
  elsif length(raw_digits) = 9 then
    local_num := raw_digits;
  else
    return null;
  end if;

  -- Проверка допустимости оператора (9 цифр, первая от 2 до 9)
  if local_num !~ '^[2-9]\d{8}$' then
    return null;
  end if;

  return '+998' || local_num;
end;
$$;

-- 2. Канонизация существующих валидных номеров в таблице customer_profiles
update public.customer_profiles
set
  phone = public.normalize_uz_phone(phone),
  updated_at = now()
where phone is not null
  and trim(phone) != ''
  and public.normalize_uz_phone(phone) is not null
  and phone != public.normalize_uz_phone(phone);

-- 3. Проверка на дубликаты перед созданием индекса (предохранитель)
do $$
declare
  dup_count int;
begin
  select count(*) into dup_count
  from (
    select phone
    from public.customer_profiles
    where phone is not null and trim(phone) != ''
    group by phone
    having count(*) > 1
  ) dups;

  if dup_count > 0 then
    raise exception 'Миграция остановлена: в таблице customer_profiles обнаружено % дубликатов телефонов! Сначала устраните дубли.', dup_count;
  end if;
end $$;

-- 4. Создание частичного уникального индекса (разрешает multiple NULL, но гарантирует уникальность заполненных номеров)
create unique index if not exists customer_profiles_phone_uidx
  on public.customer_profiles (phone)
  where phone is not null and trim(phone) != '';

commit;

-- =====================================================================
-- ROLLBACK (ПЛАН ОТКАТА):
-- drop index if exists public.customer_profiles_phone_uidx;
-- drop function if exists public.normalize_uz_phone(text);
-- =====================================================================
