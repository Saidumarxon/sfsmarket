-- ==============================================================================
-- EMIRATE CO — PHASE 5A: CATEGORIES SYSTEM FOUNDATION & SEED MIGRATION
-- Database Foundation for Hierarchical Categories, Subtree Queries & Product Mapping.
-- Strictly 3-level tree (Root -> Group -> Leaf).
-- Idempotent, zero-downtime, preserves Phase 1-4 and loyalty schemas.
-- ==============================================================================

-- 1. Create public.categories table
create table if not exists public.categories (
  id text primary key,
  parent_id text references public.categories(id) on delete set null,
  name_ru text not null,
  name_uz text not null default '',
  slug text not null unique,
  sort_order int not null default 100,
  is_active boolean not null default true,
  show_in_nav boolean not null default false,
  icon text not null default '',
  default_specs jsonb not null default '[]'::jsonb,
  external_source text default null,
  external_id text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists categories_slug_idx on public.categories(slug);
create index if not exists categories_active_sort_idx on public.categories(is_active, sort_order);

-- 2. Add category_id column to public.products with ON DELETE RESTRICT
alter table public.products
  add column if not exists category_id text references public.categories(id) on delete restrict;

create index if not exists products_category_id_idx on public.products(category_id);

-- 3. Enable RLS on public.categories
alter table public.categories enable row level security;

drop policy if exists "categories_read_public" on public.categories;
create policy "categories_read_public" on public.categories
  for select
  to anon, authenticated
  using (
    is_active = true
    or exists (select 1 from public.admin_users u where u.user_id = auth.uid())
  );

drop policy if exists "categories_admin_all" on public.categories;
create policy "categories_admin_all" on public.categories
  for all
  to authenticated
  using (exists (select 1 from public.admin_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users u where u.user_id = auth.uid()));

-- Grants
grant select on public.categories to anon, authenticated, service_role;
grant all on public.categories to authenticated, service_role;

-- 4. RPC: get_category_subtree_ids
create or replace function public.get_category_subtree_ids(p_category_slug_or_id text)
returns table(category_id text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recursive category_tree as (
    select id
    from public.categories
    where (id = p_category_slug_or_id or slug = p_category_slug_or_id)
      and is_active = true

    union all

    select c.id
    from public.categories c
    inner join category_tree ct on c.parent_id = ct.id
    where c.is_active = true
  )
  select id from category_tree;
$$;

grant execute on function public.get_category_subtree_ids(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. SEED TAXONOMY (STRICTLY 3-LEVEL TREE: Root -> Group -> Leaf)
-- ------------------------------------------------------------------------------

-- Level 1: Roots (parent_id IS NULL)
insert into public.categories (id, parent_id, name_ru, name_uz, slug, sort_order, is_active, show_in_nav, icon, external_source)
values
  ('root_electronics', null, 'Электроника', 'Elektronika', 'elektronika', 1, true, true, 'smartphone', 'custom'),
  ('root_computers', null, 'Компьютеры и ноутбуки', 'Kompyuterlar va noutbuklar', 'kompyutery-i-noutbuki', 2, true, true, 'laptop', 'custom'),
  ('root_appliances', null, 'Бытовая техника', 'Maishiy texnika', 'bytovaya-tehnika', 3, true, true, 'appliance', 'custom'),
  ('root_accessories', null, 'Аксессуары', 'Aksessuarlar', 'aksessuary', 4, true, true, 'accessories', 'custom'),
  ('root_home', null, 'Товары для дома', 'Uy uchun tovarlar', 'dlya-doma', 5, true, true, 'home', 'custom'),
  ('root_beauty', null, 'Красота и здоровье', 'Go''zallik va salomatlik', 'krasota-i-zdorove', 6, true, true, 'beauty', 'custom')
on conflict (id) do update set
  name_ru = excluded.name_ru,
  name_uz = excluded.name_uz,
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  show_in_nav = excluded.show_in_nav,
  icon = excluded.icon,
  updated_at = now();

-- Level 2: Groups (parent_id REFERENCES root_*)
insert into public.categories (id, parent_id, name_ru, name_uz, slug, sort_order, is_active, show_in_nav, icon, external_source)
values
  -- Под root_electronics
  ('grp_phones_gadgets', 'root_electronics', 'Смартфоны и гаджеты', 'Smartfonlar va gadjetlar', 'smartfony-i-gadzhety', 1, true, false, 'smartphone', 'custom'),
  ('grp_audio', 'root_electronics', 'Аудиотехника', 'Audiotexnika', 'audiotehnika', 2, true, false, 'tv', 'custom'),
  ('grp_tv_video', 'root_electronics', 'Телевизоры и видео', 'Televizorlar va video', 'televizory-i-video', 3, true, false, 'tv', 'custom'),
  ('grp_photo_video', 'root_electronics', 'Фото и видеосъемка', 'Foto va videotasvir', 'foto-i-video', 4, true, false, 'tv', 'yandex'),

  -- Под root_computers
  ('grp_computers', 'root_computers', 'Компьютеры', 'Kompyuterlar', 'kompyutery', 1, true, false, 'laptop', 'custom'),
  ('grp_periphery', 'root_computers', 'Периферия', 'Periferiya', 'periferiya', 2, true, false, 'laptop', 'custom'),
  ('grp_storage_devices', 'root_computers', 'Накопители данных', 'Ma''lumot saqlagichlar', 'nakopiteli-dannyh', 3, true, false, 'laptop', 'yandex'),
  ('grp_network', 'root_computers', 'Сетевое оборудование', 'Tarmoq uskunalari', 'setevoe-oborudovanie', 4, true, false, 'laptop', 'yandex'),

  -- Под root_appliances
  ('grp_climate', 'root_appliances', 'Климатическая техника', 'Iqlim texnikasi', 'klimaticheskaya-tehnika', 1, true, false, 'appliance', 'yandex'),
  ('grp_cleaning', 'root_appliances', 'Техника для уборки', 'Tozalash texnikasi', 'tehnika-dlya-uborki', 2, true, false, 'appliance', 'custom'),
  ('grp_kitchen', 'root_appliances', 'Техника для кухни', 'Oshxona texnikasi', 'tehnika-dlya-kuhni', 3, true, false, 'appliance', 'custom'),

  -- Под root_accessories
  ('grp_phone_acc', 'root_accessories', 'Для телефонов и планшетов', 'Telefonlar va planshetlar uchun', 'aksessuary-dlya-telefonov', 1, true, false, 'accessories', 'custom'),
  ('grp_pc_acc', 'root_accessories', 'Для компьютеров и ноутбуков', 'Kompyuterlar va noutbuklar uchun', 'aksessuary-dlya-kompyuterov', 2, true, false, 'accessories', 'custom'),

  -- Под root_home
  ('grp_home_comfort', 'root_home', 'Освещение и уют', 'Yoritish va qulaylik', 'osveshchenie-i-uyut', 1, true, false, 'home', 'custom'),

  -- Под root_beauty
  ('grp_personal_care', 'root_beauty', 'Приборы для ухода', 'Parvarish asboblari', 'pribory-dlya-uhoda', 1, true, false, 'beauty', 'custom'),
  ('grp_oral_care', 'root_beauty', 'Уход за полостью рта', 'Og''iz bo''shlig''i parvarishi', 'uhod-za-polostyu-rta', 2, true, false, 'beauty', 'yandex')
on conflict (id) do update set
  parent_id = excluded.parent_id,
  name_ru = excluded.name_ru,
  name_uz = excluded.name_uz,
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  show_in_nav = excluded.show_in_nav,
  icon = excluded.icon,
  updated_at = now();

-- Level 3: Leafs (parent_id REFERENCES grp_*)
insert into public.categories (id, parent_id, name_ru, name_uz, slug, sort_order, is_active, show_in_nav, default_specs, external_source)
values
  -- Смартфоны и гаджеты
  ('cat_smartphones', 'grp_phones_gadgets', 'Смартфоны', 'Smartfonlar', 'smartfony', 1, true, false,
   '[{"keyRu":"Память","keyUz":"Xotira"},{"keyRu":"Экран","keyUz":"Ekran"},{"keyRu":"Процессор","keyUz":"Protsessor"},{"keyRu":"Камера","keyUz":"Kamera"},{"keyRu":"Батарея","keyUz":"Batareya"}]'::jsonb, 'custom'),
  ('cat_tablets', 'grp_phones_gadgets', 'Планшеты', 'Planshetlar', 'planshety', 2, true, false,
   '[{"keyRu":"Экран","keyUz":"Ekran"},{"keyRu":"Память","keyUz":"Xotira"},{"keyRu":"Процессор","keyUz":"Protsessor"}]'::jsonb, 'custom'),
  ('cat_smartwatches', 'grp_phones_gadgets', 'Умные часы', 'Aqlli soatlar', 'umnye-chasy', 3, true, false,
   '[{"keyRu":"Тип экрана","keyUz":"Ekran turi"},{"keyRu":"Размер корпуса","keyUz":"Korpus o''lchami"},{"keyRu":"Датчики","keyUz":"Sensorlar"},{"keyRu":"Защита","keyUz":"Himoya"}]'::jsonb, 'custom'),
  ('cat_fitbands', 'grp_phones_gadgets', 'Фитнес-браслеты', 'Fitnes bilaguzuklar', 'fitnes-braslety', 4, true, false,
   '[{"keyRu":"Тип экрана","keyUz":"Ekran turi"},{"keyRu":"Датчики","keyUz":"Sensorlar"},{"keyRu":"Защита","keyUz":"Himoya"}]'::jsonb, 'custom'),

  -- Аудиотехника
  ('cat_headphones', 'grp_audio', 'Наушники', 'Quloqchinlar', 'naushniki', 1, true, false,
   '[{"keyRu":"Тип подключения","keyUz":"Ulanish turi"},{"keyRu":"Шумоподавление","keyUz":"Shovqinni pasaytirish"},{"keyRu":"Время работы","keyUz":"Ishlash vaqti"}]'::jsonb, 'custom'),
  ('cat_speakers', 'grp_audio', 'Колонки', 'Kolonkalar', 'kolonki', 2, true, false,
   '[{"keyRu":"Мощность","keyUz":"Quvvat"},{"keyRu":"Время работы","keyUz":"Ishlash vaqti"},{"keyRu":"Влагозащита","keyUz":"Namdan himoya"}]'::jsonb, 'custom'),
  ('cat_soundbars', 'grp_audio', 'Саундбары', 'Saundbarlar', 'saundbary', 3, true, false,
   '[{"keyRu":"Мощность","keyUz":"Quvvat"},{"keyRu":"Интерфейсы","keyUz":"Interfeyslar"}]'::jsonb, 'custom'),
  ('cat_microphones', 'grp_audio', 'Микрофоны и радиосистемы', 'Mikrofonlar va radiotizimlar', 'mikrofony', 4, true, false,
   '[{"keyRu":"Тип микрофона","keyUz":"Mikrofon turi"},{"keyRu":"Дальность действия","keyUz":"Ish masofasi"}]'::jsonb, 'yandex'),

  -- Телевизоры и видео
  ('cat_tv_led', 'grp_tv_video', 'LED телевизоры', 'LED televizorlar', 'led-televizory', 1, true, false,
   '[{"keyRu":"Диагональ","keyUz":"Diagonal"},{"keyRu":"Разрешение","keyUz":"Aniqlik"},{"keyRu":"Smart TV","keyUz":"Smart TV"}]'::jsonb, 'custom'),
  ('cat_tv_oled', 'grp_tv_video', 'OLED телевизоры', 'OLED televizorlar', 'oled-televizory', 2, true, false,
   '[{"keyRu":"Диагональ","keyUz":"Diagonal"},{"keyRu":"Частота обновления","keyUz":"Yangilanish chastotasi"}]'::jsonb, 'custom'),

  -- Фото и видеосъемка
  ('cat_action_cameras', 'grp_photo_video', 'Экшн-камеры', 'Ekshn kameralar', 'ekshn-kamery', 1, true, false,
   '[{"keyRu":"Разрешение видео","keyUz":"Video aniqligi"},{"keyRu":"Стабилизация","keyUz":"Stabilizatsiya"}]'::jsonb, 'yandex'),
  ('cat_gimbals', 'grp_photo_video', 'Стабилизаторы и стедикамы', 'Stabilizatorlar va stedikamlar', 'stabilizatory', 2, true, false,
   '[{"keyRu":"Тип стабилизатора","keyUz":"Stabilizator turi"},{"keyRu":"Совместимость","keyUz":"Moslik"}]'::jsonb, 'yandex'),

  -- Компьютеры
  ('cat_laptops', 'grp_computers', 'Ноутбуки', 'Noutbuklar', 'noutbuki', 1, true, false,
   '[{"keyRu":"Процессор","keyUz":"Protsessor"},{"keyRu":"ОЗУ","keyUz":"Operativ xotira"},{"keyRu":"Накопитель","keyUz":"Xotira"},{"keyRu":"Экран","keyUz":"Ekran"}]'::jsonb, 'custom'),
  ('cat_monitors', 'grp_computers', 'Мониторы', 'Monitorlar', 'monitory', 2, true, false,
   '[{"keyRu":"Диагональ","keyUz":"Diagonal"},{"keyRu":"Частота","keyUz":"Chastota"},{"keyRu":"Матрица","keyUz":"Matritsa"}]'::jsonb, 'custom'),
  ('cat_monoblocks', 'grp_computers', 'Моноблоки', 'Monobloklar', 'monobloki', 3, true, false,
   '[{"keyRu":"Процессор","keyUz":"Protsessor"},{"keyRu":"ОЗУ","keyUz":"Operativ xotira"}]'::jsonb, 'custom'),

  -- Периферия
  ('cat_keyboards', 'grp_periphery', 'Клавиатуры', 'Klaviaturalar', 'klaviatury', 1, true, false,
   '[{"keyRu":"Тип клавиатуры","keyUz":"Klaviatura turi"},{"keyRu":"Подключение","keyUz":"Ulanish"}]'::jsonb, 'custom'),
  ('cat_mice', 'grp_periphery', 'Компьютерные мыши', 'Sichqonchalar', 'kompyuternye-myshi', 2, true, false,
   '[{"keyRu":"Тип сенсора","keyUz":"Sensor turi"},{"keyRu":"DPI","keyUz":"DPI"}]'::jsonb, 'custom'),
  ('cat_webcams', 'grp_periphery', 'Веб-камеры', 'Veb-kameralar', 'veb-kamery', 3, true, false,
   '[{"keyRu":"Разрешение","keyUz":"Aniqlik"},{"keyRu":"Микрофон","keyUz":"Mikrofon"}]'::jsonb, 'custom'),

  -- Накопители данных
  ('cat_external_storage', 'grp_storage_devices', 'Внешние жесткие диски и SSD', 'Tashqi qattiq disklar va SSD', 'vneshnie-nakopiteli', 1, true, false,
   '[{"keyRu":"Объем","keyUz":"Hajm"},{"keyRu":"Интерфейс","keyUz":"Interfeys"}]'::jsonb, 'yandex'),

  -- Сетевое оборудование
  ('cat_network_equipment', 'grp_network', 'Wi-Fi роутеры и усилители', 'Wi-Fi routerlar va kuchaytirgichlar', 'wifi-i-routery', 1, true, false,
   '[{"keyRu":"Стандарт Wi-Fi","keyUz":"Wi-Fi standarti"},{"keyRu":"Скорость","keyUz":"Tezlik"}]'::jsonb, 'yandex'),

  -- Климатическая техника
  ('cat_air_purifiers', 'grp_climate', 'Очистители и увлажнители воздуха', 'Havo tozalagichlar va namlagichlar', 'ochistiteli-vozduha', 1, true, false,
   '[{"keyRu":"Площадь помещения","keyUz":"Xona maydoni"},{"keyRu":"Фильтры","keyUz":"Filtrlar"}]'::jsonb, 'yandex'),
  ('cat_aircon', 'grp_climate', 'Кондиционеры', 'Konditsionerlar', 'konditsionery', 2, true, false,
   '[{"keyRu":"Площадь","keyUz":"Maydon"},{"keyRu":"Инвертор","keyUz":"Invertor"}]'::jsonb, 'custom'),
  ('cat_heaters', 'grp_climate', 'Обогреватели', 'Isitgichlar', 'obogrevateli', 3, true, false,
   '[{"keyRu":"Мощность","keyUz":"Quvvat"}]'::jsonb, 'custom'),

  -- Техника для уборки
  ('cat_vacuums', 'grp_cleaning', 'Пылесосы', 'Changyutgichlar', 'pylesosy', 1, true, false,
   '[{"keyRu":"Мощность всасывания","keyUz":"Tortish quvvati"}]'::jsonb, 'custom'),
  ('cat_robot_vacuums', 'grp_cleaning', 'Роботы-пылесосы', 'Robot changyutgichlar', 'roboty-pylesosy', 2, true, false,
   '[{"keyRu":"Влажная уборка","keyUz":"Nam tozalash"},{"keyRu":"Навигация","keyUz":"Navigatsiya"}]'::jsonb, 'custom'),

  -- Техника для кухни
  ('cat_microwaves', 'grp_kitchen', 'Микроволновки', 'Mikroto''lqinli pechlar', 'mikrovolnovki', 1, true, false,
   '[{"keyRu":"Объем","keyUz":"Hajm"},{"keyRu":"Мощность","keyUz":"Quvvat"}]'::jsonb, 'custom'),
  ('cat_kettles', 'grp_kitchen', 'Электрочайники', 'Choynaklar', 'chainiki', 2, true, false,
   '[{"keyRu":"Объем","keyUz":"Hajm"},{"keyRu":"Материал корпуса","keyUz":"Korpus materiali"}]'::jsonb, 'custom'),

  -- Для телефонов и планшетов
  ('cat_cases', 'grp_phone_acc', 'Чехлы', 'G''iloflar', 'chehly', 1, true, false,
   '[{"keyRu":"Материал","keyUz":"Material"},{"keyRu":"Совместимость","keyUz":"Moslik"}]'::jsonb, 'custom'),
  ('cat_glasses', 'grp_phone_acc', 'Защитные стёкла', 'Himoya oynalari', 'zashchitnye-stekla', 2, true, false,
   '[{"keyRu":"Твердость","keyUz":"Qattiqlik"},{"keyRu":"Совместимость","keyUz":"Moslik"}]'::jsonb, 'custom'),
  ('cat_powerbanks', 'grp_phone_acc', 'Power Bank', 'Power Bank', 'power-bank', 3, true, false,
   '[{"keyRu":"Емкость","keyUz":"Sig''im"},{"keyRu":"Быстрая зарядка","keyUz":"Tezkor quvvatlash"}]'::jsonb, 'custom'),
  ('cat_chargers', 'grp_phone_acc', 'Сетевые зарядки', 'Zaryadlovchilar', 'zaryadnye-ustroystva', 4, true, false,
   '[{"keyRu":"Мощность","keyUz":"Quvvat"},{"keyRu":"Разъемы","keyUz":"Ulagichlar"}]'::jsonb, 'custom'),
  ('cat_cables', 'grp_phone_acc', 'Кабели и переходники', 'Kabellar va adapterlar', 'kabeli', 5, true, false,
   '[{"keyRu":"Разъем","keyUz":"Ulagich"},{"keyRu":"Длина","keyUz":"Uzunlik"}]'::jsonb, 'custom'),

  -- Для компьютеров и ноутбуков
  ('cat_docks', 'grp_pc_acc', 'Док-станции и хабы', 'Dok-stansiyalar va xablar', 'dok-stantsii', 1, true, false,
   '[{"keyRu":"Разъемы","keyUz":"Ulagichlar"}]'::jsonb, 'custom'),
  ('cat_adapters', 'grp_pc_acc', 'Сетевые адаптеры', 'Adapterlar', 'adaptery', 2, true, false,
   '[{"keyRu":"Интерфейс","keyUz":"Interfeys"}]'::jsonb, 'custom'),
  ('cat_bags', 'grp_pc_acc', 'Сумки и рюкзаки', 'Sumkalar va ryukzaklar', 'sumki-dlya-noutbukov', 3, true, false,
   '[{"keyRu":"Диагональ ноутбука","keyUz":"Noutbuk diagonali"}]'::jsonb, 'custom'),
  ('cat_laptop_stands', 'grp_pc_acc', 'Подставки для ноутбуков', 'Noutbuk tagliklari', 'podstavki-dlya-noutbukov', 4, true, false,
   '[{"keyRu":"Охлаждение","keyUz":"Sovutish"},{"keyRu":"Диагональ","keyUz":"Diagonal"}]'::jsonb, 'yandex'),

  -- Освещение и уют
  ('cat_lamps', 'grp_home_comfort', 'Лампы и светильники', 'Lampalar', 'lampy', 1, true, false,
   '[{"keyRu":"Тип цоколя","keyUz":"Sokol turi"}]'::jsonb, 'custom'),
  ('cat_smarthome', 'grp_home_comfort', 'Умный дом', 'Aqlli uy', 'umnyy-dom', 2, true, false,
   '[{"keyRu":"Экосистема","keyUz":"Ekotizim"},{"keyRu":"Протокол связи","keyUz":"Aloqa protokoli"}]'::jsonb, 'custom'),
  ('cat_textile', 'grp_home_comfort', 'Текстиль', 'To''qimachilik', 'tekstil', 3, true, false,
   '[{"keyRu":"Материал","keyUz":"Material"}]'::jsonb, 'custom'),
  ('cat_storage', 'grp_home_comfort', 'Хранение и органайзеры', 'Saqlash va organayzerlar', 'khranenie', 4, true, false,
   '[{"keyRu":"Материал","keyUz":"Material"}]'::jsonb, 'custom'),

  -- Приборы для ухода
  ('cat_hairdryers', 'grp_personal_care', 'Фены', 'Fenlar', 'feny', 1, true, false,
   '[{"keyRu":"Мощность","keyUz":"Quvvat"},{"keyRu":"Ионизация","keyUz":"Ionizatsiya"}]'::jsonb, 'custom'),
  ('cat_trimmers', 'grp_personal_care', 'Триммеры', 'Trimmerlar', 'trimmery', 2, true, false,
   '[{"keyRu":"Назначение","keyUz":"Vazifasi"},{"keyRu":"Питание","keyUz":"Quvvat manbai"}]'::jsonb, 'custom'),
  ('cat_scales', 'grp_personal_care', 'Напольные весы', 'Tarozilar', 'vesy', 3, true, false,
   '[{"keyRu":"Максимальная нагрузка","keyUz":"Maksimal yuk"}]'::jsonb, 'custom'),
  ('cat_beauty_care', 'grp_personal_care', 'Косметический уход', 'Parvarish', 'kosmeticheskiy-uhod', 4, true, false,
   '[{"keyRu":"Тип прибора","keyUz":"Asbob turi"}]'::jsonb, 'custom'),

  -- Уход за полостью рта
  ('cat_electric_toothbrushes', 'grp_oral_care', 'Электрические зубные щетки', 'Elektr tish cho''tkalari', 'elektricheskie-shchetki', 1, true, false,
   '[{"keyRu":"Количество режимов","keyUz":"Rejimlar soni"},{"keyRu":"Питание","keyUz":"Quvvat manbai"}]'::jsonb, 'yandex')
on conflict (id) do update set
  parent_id = excluded.parent_id,
  name_ru = excluded.name_ru,
  name_uz = excluded.name_uz,
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  show_in_nav = excluded.show_in_nav,
  default_specs = excluded.default_specs,
  external_source = excluded.external_source,
  updated_at = now();

-- ------------------------------------------------------------------------------
-- 6. PRODUCT MAPPING: UPDATE 23 MATCH PRODUCTS
-- 13 NEEDS_REVIEW PRODUCTS REMAIN WITH category_id = NULL
-- payload.category IS NEVER REMOVED OR CHANGED
-- ------------------------------------------------------------------------------

-- Смартфоны (5 товаров)
update public.products
set category_id = 'cat_smartphones'
where admin_id in ('T17822', 'T32309', 'T35245', 'T77288', 'T85505')
  and payload->>'category' = 'Смартфоны';

-- Наушники (7 товаров)
update public.products
set category_id = 'cat_headphones'
where admin_id in ('T13710', 'T19398', 'T39761', 'T47092', 'T59239', 'T63219', 'T75439')
  and payload->>'category' = 'Наушники';

-- Умные часы (5 товаров)
update public.products
set category_id = 'cat_smartwatches'
where admin_id in ('T42219', 'T44751', 'T60710', 'T90449', 'T98000')
  and payload->>'category' = 'Умные часы';

-- Колонки (4 товара)
update public.products
set category_id = 'cat_speakers'
where admin_id in ('T48934', 'T50490', 'T68760', 'T99737')
  and payload->>'category' = 'Колонки';

-- Фитнес-браслеты (1 товар)
update public.products
set category_id = 'cat_fitbands'
where admin_id = 'T29290'
  and payload->>'category' = 'Фитнес-браслеты';

-- Зарядки (1 товар)
update public.products
set category_id = 'cat_chargers'
where admin_id = 'T93318'
  and payload->>'category' = 'Зарядки';
