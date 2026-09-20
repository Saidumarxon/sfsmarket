-- =====================================================================
-- ИНСТРУКЦИЯ ДЛЯ УСТРАНЕНИЯ ТЕКУЩЕГО LIVE-ДУБЛЯ 770176699
-- ВЫПОЛНЯТЬ В SUPABASE SQL EDITOR ТОЛЬКО ПОСЛЕ ПОДТВЕРЖДЕНИЯ!
-- =====================================================================
--
-- Анализ конфликта:
-- 1. Google-профиль (Primary):
--    user_id = 'b57cf47d-4ab9-4b94-b670-6fed49adfe9a'
--    email = 'shohruh8646@gmail.com'
--    full_name = 'Shohruh Mamasharifov'
--    provider = 'google'
--    phone = '998770176699'
--    orders = 0
--
-- 2. SMS duplicate (Secondary):
--    user_id = '730c2173-4efa-400f-adb4-174aa893631c'
--    email = 'p998770176699@phone.emirateco.uz'
--    full_name = NULL
--    provider = 'phone'
--    phone = '998770176699'
--    orders = 0
--
-- 3. Администратор (ИЗОЛИРОВАН, НЕ ТРОГАТЬ):
--    user_id = '7e7a515a-5727-434a-a313-4fc3d27313be'
--    email = 'admin@gmail.com'
--    Saidumarxon, 4 заказа — НЕ ЗАТРАГИВАЕТСЯ!

begin;

-- Шаг 1: Освобождаем уникальность номера на вторичном SMS-профиле
-- (не удаляя auth.users и не удаляя строку, а обнуляя телефон или архивируя)
update public.customer_profiles
set
  phone = null,
  updated_at = now()
where user_id = '730c2173-4efa-400f-adb4-174aa893631c'
  and phone in ('998770176699', '+998770176699');

-- Шаг 2: Приводим телефон на Google-профиле к каноническому формату +998770176699
update public.customer_profiles
set
  phone = '+998770176699',
  updated_at = now()
where user_id = 'b57cf47d-4ab9-4b94-b670-6fed49adfe9a';

-- Шаг 3: Проверка результатов (должна остаться ровно 1 запись с этим номером)
select
  user_id,
  email,
  full_name,
  phone,
  provider,
  orders_count
from public.customer_profiles
where phone in ('+998770176699', '998770176699');

commit;
