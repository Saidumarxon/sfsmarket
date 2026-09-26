/**
 * Shared categories registry (localStorage: emirate_admin_categories_v1)
 * Single source of truth for Admin Panel and Storefront.
 */
(function (globalScope) {
  var root = globalScope || (typeof window !== "undefined" ? window : global);
  var ADMIN_CATEGORIES_KEY = "emirate_admin_categories_v1";

  function transliterateRuToLat(text) {
    var ruMap = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y',
      'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
      'х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
    };
    return String(text || '').toLowerCase().split('').map(function (c) {
      return ruMap[c] !== undefined ? ruMap[c] : c;
    }).join('');
  }

  function slugifyCategory(value) {
    return transliterateRuToLat(String(value || ""))
      .trim()
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getDateTimeString() {
    var now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 19);
  }

  function normalizeCategorySpec(spec) {
    var row = spec || {};
    return {
      keyRu: String(row.keyRu || row.key_ru || row.nameRu || row.name_ru || row.key || row.name || "").trim(),
      keyUz: String(row.keyUz || row.key_uz || "").trim(),
      valueRu: String(row.valueRu || row.value_ru || row.value || "").trim(),
      valueUz: String(row.valueUz || row.value_uz || "").trim()
    };
  }

  function normalizeCategoryRecord(record) {
    var category = record || {};
    var nameRu = String(category.nameRu || category.name_ru || category.name || "").trim();
    var nameUz = String(category.nameUz || category.name_uz || "").trim();
    var slug = String(category.slug || slugifyCategory(nameRu)).trim() || slugifyCategory(nameRu);
    var parentId = String(category.parentId !== undefined ? (category.parentId || "") : (category.parent_id || "")).trim();
    var sortOrder = Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : (Number.isFinite(Number(category.sort_order)) ? Number(category.sort_order) : 100);
    var isActive = category.isActive !== undefined ? Boolean(category.isActive) : (category.is_active !== undefined ? Boolean(category.is_active) : (category.status !== "inactive"));
    
    var showInNav;
    if (category.showInNav !== undefined) {
      showInNav = Boolean(category.showInNav);
    } else if (category.show_in_nav !== undefined) {
      showInNav = Boolean(category.show_in_nav);
    } else {
      showInNav = !parentId;
    }

    var icon = String(category.icon || "").trim();

    var rawSpecs = Array.isArray(category.defaultSpecs) ? category.defaultSpecs : (Array.isArray(category.default_specs) ? category.default_specs : []);
    var defaultSpecs = rawSpecs.map(normalizeCategorySpec).filter(function (item) {
      return item.keyRu || item.keyUz;
    });

    var updatedAt = category.updatedAt || category.updated_at || getDateTimeString();

    return {
      id: category.id || "cat_" + (slug || Math.floor(Math.random() * 9000 + 1000)),
      nameRu: nameRu,
      name_ru: nameRu,
      nameUz: nameUz,
      name_uz: nameUz,
      slug: slug,
      parentId: parentId,
      parent_id: parentId || null,
      sortOrder: sortOrder,
      sort_order: sortOrder,
      isActive: isActive,
      is_active: isActive,
      showInNav: showInNav,
      show_in_nav: showInNav,
      icon: icon,
      defaultSpecs: defaultSpecs,
      default_specs: defaultSpecs,
      updatedAt: updatedAt,
      updated_at: updatedAt
    };
  }

  function nestedCategoryBlueprint() {
    var smartphoneSpecs = [
      { keyRu: "Память", keyUz: "Xotira", valueRu: "", valueUz: "" },
      { keyRu: "Экран", keyUz: "Ekran", valueRu: "", valueUz: "" },
      { keyRu: "Процессор", keyUz: "Protsessor", valueRu: "", valueUz: "" },
      { keyRu: "Камера", keyUz: "Kamera", valueRu: "", valueUz: "" },
      { keyRu: "Батарея", keyUz: "Batareya", valueRu: "", valueUz: "" }
    ];
    var laptopSpecs = [
      { keyRu: "Процессор", keyUz: "Protsessor", valueRu: "", valueUz: "" },
      { keyRu: "ОЗУ", keyUz: "Operativ xotira", valueRu: "", valueUz: "" },
      { keyRu: "Накопитель", keyUz: "Xotira", valueRu: "", valueUz: "" },
      { keyRu: "Экран", keyUz: "Ekran", valueRu: "", valueUz: "" }
    ];
    var watchSpecs = [
      { keyRu: "Тип экрана", keyUz: "Ekran turi", valueRu: "", valueUz: "" },
      { keyRu: "Цвет ремешка", keyUz: "Remeshok rangi", valueRu: "", valueUz: "" },
      { keyRu: "Always-On Display", keyUz: "Always-On Display", valueRu: "", valueUz: "" },
      { keyRu: "Размер корпуса", keyUz: "Korpus o'lchami", valueRu: "", valueUz: "" },
      { keyRu: "Совместимость", keyUz: "Moslik", valueRu: "", valueUz: "" }
    ];
    var fitbandSpecs = [
      { keyRu: "Тип экрана", keyUz: "Ekran turi", valueRu: "", valueUz: "" },
      { keyRu: "Цвет ремешка", keyUz: "Remeshok rangi", valueRu: "", valueUz: "" },
      { keyRu: "Датчики", keyUz: "Sensorlar", valueRu: "", valueUz: "" },
      { keyRu: "Защита", keyUz: "Himoya", valueRu: "", valueUz: "" }
    ];

    return [
      { id: "cat_smartphones", parentRu: "", nameRu: "Смартфоны", nameUz: "Smartfonlar", sortOrder: 1, showInNav: true },
      { id: "cat_smartphones_all", parentRu: "Смартфоны", nameRu: "Смартфоны", nameUz: "Smartfonlar", sortOrder: 1, specs: smartphoneSpecs, showInNav: false },
      { id: "cat_tablets", parentRu: "Смартфоны", nameRu: "Планшеты", nameUz: "Planshetlar", sortOrder: 2, showInNav: false },
      { id: "cat_wearables", parentRu: "Смартфоны", nameRu: "Умные часы и фитнес-браслеты", nameUz: "Aqlli soatlar va fitnes bilaguzuklar", sortOrder: 3, showInNav: false },
      { id: "cat_smartwatches", parentRu: "Умные часы и фитнес-браслеты", nameRu: "Умные часы", nameUz: "Aqlli soatlar", sortOrder: 1, specs: watchSpecs, showInNav: false },
      { id: "cat_fitbands", parentRu: "Умные часы и фитнес-браслеты", nameRu: "Фитнес-браслеты", nameUz: "Fitnes bilaguzuklar", sortOrder: 2, specs: fitbandSpecs, showInNav: false },

      { id: "cat_laptops", parentRu: "", nameRu: "Ноутбуки", nameUz: "Noutbuklar", sortOrder: 2, showInNav: true },
      { id: "cat_laptops_all", parentRu: "Ноутбуки", nameRu: "Ноутбуки", nameUz: "Noutbuklar", sortOrder: 1, specs: laptopSpecs, showInNav: false },
      { id: "cat_monitors", parentRu: "Ноутбуки", nameRu: "Мониторы", nameUz: "Monitorlar", sortOrder: 2, showInNav: false },
      { id: "cat_monoblocks", parentRu: "Ноутбуки", nameRu: "Моноблоки", nameUz: "Monobloklar", sortOrder: 3, showInNav: false },
      { id: "cat_pc_accessories", parentRu: "Ноутбуки", nameRu: "Компьютерные аксессуары", nameUz: "Kompyuter aksessuarlari", sortOrder: 4, showInNav: false },
      { id: "cat_keyboards", parentRu: "Компьютерные аксессуары", nameRu: "Клавиатуры", nameUz: "Klaviaturalar", sortOrder: 1, showInNav: false },
      { id: "cat_mice", parentRu: "Компьютерные аксессуары", nameRu: "Мыши", nameUz: "Sichqonchalar", sortOrder: 2, showInNav: false },
      { id: "cat_webcams", parentRu: "Компьютерные аксессуары", nameRu: "Веб-камеры", nameUz: "Veb-kameralar", sortOrder: 3, showInNav: false },

      { id: "cat_tv", parentRu: "", nameRu: "ТВ и аудио", nameUz: "TV va audio", sortOrder: 3, showInNav: true },
      { id: "cat_tvs", parentRu: "ТВ и аудио", nameRu: "Телевизоры", nameUz: "Televizorlar", sortOrder: 1, showInNav: false },
      { id: "cat_tv_led", parentRu: "Телевизоры", nameRu: "LED", nameUz: "LED", sortOrder: 1, showInNav: false },
      { id: "cat_tv_oled", parentRu: "Телевизоры", nameRu: "OLED", nameUz: "OLED", sortOrder: 2, showInNav: false },
      { id: "cat_headphones", parentRu: "ТВ и аудио", nameRu: "Наушники", nameUz: "Quloqchinlar", sortOrder: 2, showInNav: false },
      { id: "cat_speakers", parentRu: "ТВ и аудио", nameRu: "Колонки", nameUz: "Kolonkalar", sortOrder: 3, showInNav: false },
      { id: "cat_soundbars", parentRu: "ТВ и аудио", nameRu: "Саундбары", nameUz: "Saundbarlar", sortOrder: 4, showInNav: false },

      { id: "cat_appliances", parentRu: "", nameRu: "Бытовая техника", nameUz: "Maishiy texnika", sortOrder: 4, showInNav: true },
      { id: "cat_vacuums", parentRu: "Бытовая техника", nameRu: "Пылесосы", nameUz: "Changyutgichlar", sortOrder: 1, showInNav: false },
      { id: "cat_robot_vacuums", parentRu: "Пылесосы", nameRu: "Роботы-пылесосы", nameUz: "Robot changyutgichlar", sortOrder: 1, showInNav: false },
      { id: "cat_aircon", parentRu: "Бытовая техника", nameRu: "Кондиционеры", nameUz: "Konditsionerlar", sortOrder: 2, showInNav: false },
      { id: "cat_heaters", parentRu: "Бытовая техника", nameRu: "Обогреватели", nameUz: "Isitgichlar", sortOrder: 3, showInNav: false },
      { id: "cat_microwaves", parentRu: "Бытовая техника", nameRu: "Микроволновки", nameUz: "Mikroto'lqinli pechlar", sortOrder: 4, showInNav: false },
      { id: "cat_kettles", parentRu: "Бытовая техника", nameRu: "Чайники", nameUz: "Choynaklar", sortOrder: 5, showInNav: false },

      { id: "cat_accessories", parentRu: "", nameRu: "Аксессуары", nameUz: "Aksessuarlar", sortOrder: 5, showInNav: true },
      { id: "cat_cases", parentRu: "Аксессуары", nameRu: "Чехлы", nameUz: "G'iloflar", sortOrder: 1, showInNav: false },
      { id: "cat_glasses", parentRu: "Аксессуары", nameRu: "Защитные стёкла", nameUz: "Himoya oynalari", sortOrder: 2, showInNav: false },
      { id: "cat_powerbanks", parentRu: "Аксессуары", nameRu: "Power Bank", nameUz: "Power Bank", sortOrder: 3, showInNav: false },
      { id: "cat_chargers", parentRu: "Аксессуары", nameRu: "Зарядки", nameUz: "Zaryadlovchilar", sortOrder: 4, showInNav: false },
      { id: "cat_cables", parentRu: "Аксессуары", nameRu: "Кабели", nameUz: "Kabellar", sortOrder: 5, showInNav: false },
      { id: "cat_bags", parentRu: "Аксессуары", nameRu: "Сумки", nameUz: "Sumkalar", sortOrder: 6, showInNav: false },
      { id: "cat_docks", parentRu: "Аксессуары", nameRu: "Док-станции", nameUz: "Dok-stansiyalar", sortOrder: 7, showInNav: false },
      { id: "cat_adapters", parentRu: "Аксессуары", nameRu: "Адаптеры", nameUz: "Adapterlar", sortOrder: 8, showInNav: false },

      { id: "cat_home", parentRu: "", nameRu: "Товары для дома", nameUz: "Uy uchun tovarlar", sortOrder: 6, showInNav: true },
      { id: "cat_lamps", parentRu: "Товары для дома", nameRu: "Лампы", nameUz: "Lampalar", sortOrder: 1, showInNav: false },
      { id: "cat_smarthome", parentRu: "Товары для дома", nameRu: "Умный дом", nameUz: "Aqlli uy", sortOrder: 2, showInNav: false },
      { id: "cat_textile", parentRu: "Товары для дома", nameRu: "Текстиль", nameUz: "To'qimachilik", sortOrder: 3, showInNav: false },
      { id: "cat_storage", parentRu: "Товары для дома", nameRu: "Хранение", nameUz: "Saqlash", sortOrder: 4, showInNav: false },

      { id: "cat_beauty", parentRu: "", nameRu: "Красота и здоровье", nameUz: "Go'zallik va salomatlik", sortOrder: 7, showInNav: true },
      { id: "cat_hairdryers", parentRu: "Красота и здоровье", nameRu: "Фены", nameUz: "Fenlar", sortOrder: 1, showInNav: false },
      { id: "cat_trimmers", parentRu: "Красота и здоровье", nameRu: "Триммеры", nameUz: "Trimmerlar", sortOrder: 2, showInNav: false },
      { id: "cat_scales", parentRu: "Красота и здоровье", nameRu: "Весы", nameUz: "Tarozi", sortOrder: 3, showInNav: false },
      { id: "cat_beauty_care", parentRu: "Красота и здоровье", nameRu: "Уход", nameUz: "Parvarish", sortOrder: 4, showInNav: false }
    ];
  }

  function defaultCategoriesData() {
    var list = [];
    var firstByName = {};
    nestedCategoryBlueprint().forEach(function (row) {
      var parent = row.parentRu ? firstByName[String(row.parentRu).toLowerCase()] : null;
      if (row.parentRu && !parent) return;
      var rec = normalizeCategoryRecord({
        id: row.id,
        nameRu: row.nameRu,
        nameUz: row.nameUz,
        parentId: parent ? parent.id : "",
        sortOrder: row.sortOrder,
        showInNav: row.showInNav !== undefined ? row.showInNav : !row.parentRu,
        defaultSpecs: row.specs || [],
        isActive: true
      });
      list.push(rec);
      firstByName[String(rec.nameRu).toLowerCase()] = rec;
    });
    return list;
  }

  function loadCategoriesData() {
    try {
      var raw = localStorage.getItem(ADMIN_CATEGORIES_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(normalizeCategoryRecord);
      }
    } catch (_) {}
    var defaults = defaultCategoriesData();
    try {
      localStorage.setItem(ADMIN_CATEGORIES_KEY, JSON.stringify(defaults));
    } catch (_) {}
    return defaults;
  }

  function persistCategoriesData(categories) {
    try {
      localStorage.setItem(ADMIN_CATEGORIES_KEY, JSON.stringify(categories || []));
    } catch (_) {}
  }

  var _publicCategoriesCache = null;
  var _publicCategoriesPromise = null;

  async function ensurePublicCategoriesLoaded(forceReload) {
    if (_publicCategoriesCache && !forceReload) {
      return _publicCategoriesCache;
    }
    if (_publicCategoriesPromise && !forceReload) {
      return _publicCategoriesPromise;
    }
    _publicCategoriesPromise = (async function () {
      try {
        if (root.emirateSupabaseApi && typeof root.emirateSupabaseApi.fetchPublicCategories === "function") {
          var rows = await root.emirateSupabaseApi.fetchPublicCategories();
          if (Array.isArray(rows) && rows.length) {
            _publicCategoriesCache = rows.map(normalizeCategoryRecord);
            return _publicCategoriesCache;
          }
        }
      } catch (err) {
        console.warn("[Categories] ensurePublicCategoriesLoaded failed", err);
      }
      _publicCategoriesCache = loadCategoriesData();
      return _publicCategoriesCache;
    })();
    return _publicCategoriesPromise;
  }

  function getLoadedCategories(list) {
    var rawList = list || _publicCategoriesCache || loadCategoriesData();
    if (Array.isArray(rawList)) {
      return rawList.map(normalizeCategoryRecord);
    }
    return [];
  }

  function getNavCategories(lang, list) {
    var categories = getLoadedCategories(list);
    return categories
      .filter(function (cat) {
        return cat && cat.isActive !== false && cat.showInNav === true && (!cat.parentId && !cat.parent_id);
      })
      .sort(function (a, b) {
        var orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 100;
        var orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 100;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.nameRu || "").localeCompare(String(b.nameRu || ""), "ru");
      });
  }

  function getRootCategories(list) {
    var all = getLoadedCategories(list);
    return all
      .filter(function (cat) {
        return cat && (!cat.parentId && !cat.parent_id) && cat.isActive !== false;
      })
      .sort(function (a, b) {
        var orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 100;
        var orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 100;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.nameRu || "").localeCompare(String(b.nameRu || ""), "ru");
      });
  }

  function getCategoryChildren(parentId, list) {
    var pid = String(parentId || "").trim();
    if (!pid) return [];
    var all = getLoadedCategories(list);
    return all
      .filter(function (cat) {
        return cat && (cat.parentId === pid || cat.parent_id === pid) && cat.isActive !== false;
      })
      .sort(function (a, b) {
        var orderA = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 100;
        var orderB = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 100;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.nameRu || "").localeCompare(String(b.nameRu || ""), "ru");
      });
  }

  function getCategoryDisplayName(category, lang) {
    if (!category) return "";
    var code = String(lang || "ru").toLowerCase();
    var nameUz = category.nameUz || category.name_uz || "";
    var nameRu = category.nameRu || category.name_ru || category.name || "";
    if (code === "uz" && nameUz) return nameUz;
    return nameRu || nameUz || "";
  }

  function buildCategoryProductsUrl(category) {
    if (!category) return "catalog.html";
    var slug = category.slug || slugifyCategory(category.nameRu || category.nameUz || category.name || "");
    return "catalog.html?category=" + encodeURIComponent(slug);
  }

  function getCategoryById(id, list) {
    var key = String(id || "").trim();
    if (!key) return null;
    var all = getLoadedCategories(list);
    return all.find(function (item) { return item.id === key; }) || null;
  }

  function getCategoryBySlug(slug, list) {
    var key = String(slug || "").trim().toLowerCase();
    if (!key) return null;
    var all = getLoadedCategories(list);
    return all.find(function (item) {
      return String(item.slug || "").trim().toLowerCase() === key;
    }) || null;
  }

  function getCategoryBySlugOrId(slugOrId, list) {
    var key = String(slugOrId || "").trim();
    if (!key) return null;
    var lower = key.toLowerCase();
    var all = getLoadedCategories(list);
    return all.find(function (item) {
      return item.id === key || String(item.slug || "").trim().toLowerCase() === lower;
    }) || null;
  }

  function getCategoryByName(name, list) {
    var key = String(name || "").trim().toLowerCase();
    if (!key) return null;
    var all = getLoadedCategories(list);
    return all.find(function (item) {
      return (
        String(item.nameRu || "").trim().toLowerCase() === key ||
        String(item.nameUz || "").trim().toLowerCase() === key ||
        String(item.slug || "").trim().toLowerCase() === key ||
        item.id === name
      );
    }) || null;
  }

  function getLocalCategorySubtreeIds(slugOrId, list) {
    var cat = getCategoryBySlugOrId(slugOrId, list);
    if (!cat) return [];
    var all = getLoadedCategories(list);
    var result = [cat.id];
    var queue = [cat.id];
    var visited = {};
    visited[cat.id] = true;
    while (queue.length) {
      var currId = queue.shift();
      var children = all.filter(function (c) {
        var pid = c.parentId || c.parent_id;
        return pid === currId && c.isActive !== false && !visited[c.id];
      });
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        visited[child.id] = true;
        result.push(child.id);
        queue.push(child.id);
      }
    }
    return result;
  }

  function getCategoryPath(categoryOrId, list) {
    var all = getLoadedCategories(list);
    var item = typeof categoryOrId === "string" ? (getCategoryById(categoryOrId, all) || getCategoryBySlug(categoryOrId, all)) : categoryOrId;
    if (!item) return [];
    var chain = [item];
    var visited = {};
    visited[item.id] = true;
    var current = item;
    while (current.parentId || current.parent_id) {
      var pid = current.parentId || current.parent_id;
      if (visited[pid]) break;
      visited[pid] = true;
      var parent = getCategoryById(pid, all);
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
    }
    return chain;
  }

  var TAXONOMY_RULES = [
    {
      id: "cat_headphones",
      phrases: ["беспроводные наушники", "наушники bluetooth", "tws наушники", "проводные наушники", "накладные наушники", "полноразмерные наушники", "внутриканальные наушники", "simsiz quloqchin", "tws quloqchin"],
      keywords: ["наушники", "наушник", "earbuds", "headphones", "earphones", "airpods", "tws", "quloqchin", "quloqchinlar", "гарнитура", "buds"],
      exclude: ["чехол для наушников", "подставка для наушников", "амбушюры"]
    },
    {
      id: "cat_smartwatches",
      phrases: ["умные часы", "смарт-часы", "смарт часы", "smart watch", "smartwatch", "aqlli soat", "aqlli soatlar"],
      keywords: ["smartwatch", "ecg", "часы-телефон"],
      exclude: ["ремешок для часов", "наушники", "buds", "quloqchin", "защитная пленка для часов"]
    },
    {
      id: "cat_gimbals",
      phrases: ["стабилизатор для смартфона", "стабилизатор для телефона", "стабилизатор для камеры", "3-осевой гимбал", "3 o‘qli gimbal", "dji osmo mobile", "osmo mobile", "om 7p", "стедикам"],
      keywords: ["стабилизатор", "стедикам", "гимбал", "gimbal", "stabilizator"],
      exclude: ["стабилизатор напряжения"]
    },
    {
      id: "cat_action_cameras",
      phrases: ["экшн-камера", "экшн камера", "action camera", "action cam", "ekshn-kamera", "спортивная видеокамера", "спортивная камера"],
      keywords: ["экшнкамера", "gopro", "dv105"],
      exclude: []
    },
    {
      id: "cat_microphones",
      phrases: ["беспроводной микрофон", "петличный микрофон", "радиосистема", "микрофон петличка", "микрофонная система", "конденсаторный микрофон", "студийный микрофон", "simsiz mikrofon", "wireless mic", "lavalier mic", "lark a1", "lark a2", "hollyland lark"],
      keywords: ["микрофон", "микрофоны", "петличка", "microphone", "mikrofon", "petlichka"],
      exclude: ["наушники с микрофоном"]
    },
    {
      id: "cat_external_storage",
      phrases: ["внешний hdd", "внешний ssd", "внешний жесткий диск", "внешний накопитель", "портативный жесткий диск", "portable hdd", "portable ssd", "external hdd", "external ssd", "tashqi hdd", "tashqi ssd", "canvio basics"],
      keywords: ["hdd", "жесткий диск", "накопитель", "hard drive"],
      exclude: ["внутренний ssd", "внутренний hdd"]
    },
    {
      id: "cat_network_equipment",
      phrases: ["усилитель wi-fi", "усилитель wifi", "усилитель сигнала", "wi-fi роутер", "wifi роутер", "wi-fi репитер", "wi-fi усилитель", "wi-fi amplifier", "wifi repeater", "signal kuchaytirgichi", "wi-fi signal", "wi-fi router"],
      keywords: ["роутер", "репитер", "маршрутизатор", "точка доступа", "router", "repeater", "access point"],
      exclude: []
    },
    {
      id: "cat_laptop_stands",
      phrases: ["подставка для ноутбука", "подставка для noutbuk", "подставка с охлаждением", "охлаждающая подставка для ноутбука", "laptop stand", "notebook stand", "noutbuk stendi", "noutbuk tagligi"],
      keywords: [],
      exclude: []
    },
    {
      id: "cat_air_purifiers",
      phrases: ["очиститель воздуха", "увлажнитель воздуха", "мойка воздуха", "климатический комплекс", "air purifier", "air humidifier", "havo tozalagich", "havo namlagich"],
      keywords: ["hepa-фильтр", "hepa filtr", "hepa", "ионизатор"],
      exclude: []
    },
    {
      id: "cat_electric_toothbrushes",
      phrases: ["электрическая зубная щетка", "электрическая зубная щётка", "звуковая зубная щетка", "ультразвуковая зубная щетка", "electric toothbrush", "elektr tish cho‘tkasi", "tish yuvish mashinasi"],
      keywords: ["зубная щетка", "зубная щётка", "tish cho‘tkasi"],
      exclude: ["насадки для зубной щетки"]
    },
    {
      id: "cat_smartphones",
      phrases: ["сотовый телефон", "мобильный телефон", "apple iphone", "samsung galaxy", "xiaomi redmi", "google pixel"],
      keywords: ["смартфон", "смартфоны", "smartphone", "smartphones", "smartfon", "smartfonlar", "iphone"],
      exclude: ["чехол для", "стекло для", "пленка для", "подставка для смартфона", "стабилизатор для смартфона", "стабилизатор для телефона", "держатель для", "автодержатель"]
    },
    {
      id: "cat_tablets",
      phrases: ["графический планшет", "планшетный компьютер", "apple ipad", "samsung galaxy tab"],
      keywords: ["планшет", "планшеты", "tablet", "tablets", "planshet", "planshetlar", "ipad"],
      exclude: ["чехол для планшета", "стекло для планшета", "подставка для планшета", "стилус для планшета"]
    },
    {
      id: "cat_fitbands",
      phrases: ["фитнес-браслет", "фитнес браслет", "фитнес-трекер", "фитнес трекер", "fitness tracker", "fitness band", "fitnes bilaguzuk", "fitnes bilaguzuklar", "mi band", "mi smart band"],
      keywords: ["фитнес-браслет", "фитнес-трекер"],
      exclude: ["ремешок для фитнес-браслета"]
    },
    {
      id: "cat_cases",
      phrases: ["чехол для смартфона", "чехол для телефона", "чехол для iphone", "чехол-книжка", "чехол-накладка", "бампер для телефона", "silicone case", "leather case", "clear case"],
      keywords: ["чехол", "чехлы", "бампер", "case", "g‘ilof", "chehol"],
      exclude: ["сумка для ноутбука", "рюкзак"]
    },
    {
      id: "cat_glasses",
      phrases: ["защитное стекло", "стекло защитное", "бронестекло", "стекло для экрана", "стекло 3d", "стекло 9d", "стекло full glue", "tempered glass", "screen protector", "himoya oynasi", "himoya shishasi"],
      keywords: ["бронестекло"],
      exclude: []
    },
    {
      id: "cat_powerbanks",
      phrases: ["power bank", "powerbank", "портативный аккумулятор", "внешний аккумулятор", "tashqi akkumulyator", "quvvat banki"],
      keywords: ["повербанк", "пауэрбанк", "powerbank"],
      exclude: []
    },
    {
      id: "cat_chargers",
      phrases: ["сетевое зарядное устройство", "сетевая зарядка", "зарядное устройство", "беспроводная зарядка", "быстрая зарядка", "блок питания usb", "адаптер питания", "wall charger", "fast charger", "wireless charger", "quvvatlagich"],
      keywords: ["зарядка", "зарядное", "charger"],
      exclude: ["чехол", "автомобильный держатель"]
    },
    {
      id: "cat_cables",
      phrases: ["кабель type-c", "кабель lightning", "кабель micro-usb", "кабель usb", "кабель для зарядки", "шнур для зарядки", "kabel type-c", "kabel usb", "audio cable", "aux кабель"],
      keywords: ["кабель", "кабели", "переходник", "шнур", "cable", "cord", "kabel"],
      exclude: ["удлинитель сетевой"]
    },
    {
      id: "cat_laptops",
      phrases: ["игровой ноутбук", "ультрабук", "ноутбук игровой", "apple macbook", "macbook pro", "macbook air", "asus zenbook", "lenovo thinkpad"],
      keywords: ["ноутбук", "ноутбуки", "laptop", "laptops", "notebook", "noutbuk", "macbook", "ultrabook"],
      exclude: ["подставка для ноутбука", "сумка для ноутбука", "рюкзак для ноутбука", "чехол для ноутбука", "кулер для ноутбука", "насадка для ноутбука"]
    },
    {
      id: "cat_monoblocks",
      phrases: ["компьютер моноблок", "пк моноблок", "all-in-one pc", "aio pc", "apple imac"],
      keywords: ["моноблок", "моноблоки", "monoblok", "all-in-one", "imac"],
      exclude: []
    },
    {
      id: "cat_monitors",
      phrases: ["компьютерный монитор", "игровой монитор", "монитор для пк", "gaming monitor", "curved monitor"],
      keywords: ["монитор", "мониторы", "monitor", "monitors"],
      exclude: ["монитор артериального давления"]
    },
    {
      id: "cat_keyboards",
      phrases: ["механическая клавиатура", "беспроводная клавиатура", "игровая клавиатура", "gaming keyboard", "wireless keyboard", "mexanik klaviatura"],
      keywords: ["клавиатура", "клавиатуры", "keyboard", "klaviatura"],
      exclude: []
    },
    {
      id: "cat_mice",
      phrases: ["компьютерная мышь", "игровая мышь", "беспроводная мышь", "оптическая мышь", "gaming mouse", "wireless mouse", "kompyuter sichqonchasi"],
      keywords: ["мышь", "мышка", "mouse", "sichqoncha"],
      exclude: ["коврик для мыши"]
    },
    {
      id: "cat_webcams",
      phrases: ["веб-камера", "веб камера", "web camera", "veb kamera", "veb-kamera"],
      keywords: ["вебкамера", "webcam"],
      exclude: []
    },
    {
      id: "cat_docks",
      phrases: ["док-станция", "док станция", "usb-хаб", "usb хаб", "type-c хаб", "type-c hub", "usb hub", "docking station", "dock station"],
      keywords: ["док-станция", "хаб", "концентратор"],
      exclude: []
    },
    {
      id: "cat_adapters",
      phrases: ["сетевой адаптер", "сетевая карта", "ethernet адаптер", "usb ethernet", "wi-fi адаптер", "bluetooth адаптер", "network adapter", "ethernet adapter"],
      keywords: ["адаптер"],
      exclude: ["адаптер питания"]
    },
    {
      id: "cat_bags",
      phrases: ["сумка для ноутбука", "рюкзак для ноутбука", "чехол-конверт для ноутбука", "laptop bag", "laptop backpack", "noutbuk sumkasi", "noutbuk ryukzaki"],
      keywords: ["рюкзак", "сумка"],
      exclude: []
    },
    {
      id: "cat_speakers",
      phrases: ["портативная колонка", "bluetooth колонка", "беспроводная колонка", "умная колонка", "акустическая система", "portable speaker", "bluetooth speaker", "smart speaker", "portativ kolonka"],
      keywords: ["колонка", "колонки", "speaker", "speakers", "kolonka"],
      exclude: ["колонка газовая"]
    },
    {
      id: "cat_soundbars",
      phrases: ["саундбар", "саундбар для тв", "звуковая панель", "soundbar", "home theater soundbar"],
      keywords: ["саундбар", "soundbar"],
      exclude: []
    },
    {
      id: "cat_tv_led",
      phrases: ["led телевизор", "телевизор led", "smart tv led", "led tv", "телевизор 4k", "smart tv", "smart televizor"],
      keywords: ["телевизор", "televizor"],
      exclude: ["oled", "qled"]
    },
    {
      id: "cat_tv_oled",
      phrases: ["oled телевизор", "телевизор oled", "oled tv", "qled телевизор", "qled tv"],
      keywords: ["oled", "qled"],
      exclude: []
    },
    {
      id: "cat_aircon",
      phrases: ["инверторный кондиционер", "сплит-система", "сплит система", "air conditioner", "konditsioner"],
      keywords: ["кондиционер", "konditsioner"],
      exclude: ["кондиционер для белья", "кондиционер для волос"]
    },
    {
      id: "cat_heaters",
      phrases: ["масляный обогреватель", "конвекторный обогреватель", "тепловентилятор", "инфракрасный обогреватель", "isitgich", "elektr isitgich"],
      keywords: ["обогреватель", "конвектор", "радиатор", "heater", "isitgich"],
      exclude: []
    },
    {
      id: "cat_vacuums",
      phrases: ["вертикальный пылесос", "беспроводной пылесос", "моющий пылесос", "ручной пылесос", "vacuum cleaner", "changyutgich"],
      keywords: ["пылесос", "changyutgich"],
      exclude: ["робот-пылесос", "робот пылесос", "robot changyutgich"]
    },
    {
      id: "cat_robot_vacuums",
      phrases: ["робот-пылесос", "робот пылесос", "робот уборщик", "robot vacuum", "robot cleaner", "robot changyutgich"],
      keywords: ["робот-пылесос"],
      exclude: []
    },
    {
      id: "cat_kettles",
      phrases: ["электрический чайник", "электрочайник", "термопот", "electric kettle", "elektr choynak"],
      keywords: ["чайник", "choynak", "kettle"],
      exclude: ["заварочный чайник"]
    },
    {
      id: "cat_microwaves",
      phrases: ["микроволновая печь", "свч-печь", "свч печь", "микроволновка с грилем", "microwave oven"],
      keywords: ["микроволновка", "microwave"],
      exclude: []
    },
    {
      id: "cat_hairdryers",
      phrases: ["фен для волос", "фен-щетка", "стайлер для волос", "hair dryer", "hairdryer", "soch feni"],
      keywords: ["фен", "стайлер", "fen"],
      exclude: ["строительный фен", "промышленный фен"]
    },
    {
      id: "cat_trimmers",
      phrases: ["машинка для стрижки", "триммер для бороды", "триммер для носа", "электробритва", "electric shaver", "beard trimmer", "soch olish mashinasi"],
      keywords: ["триммер", "электробритва", "бритва", "trimmer", "shaver"],
      exclude: ["триммер садовый", "бензотриммер"]
    },
    {
      id: "cat_electric_toothbrushes",
      phrases: ["электрическая зубная щетка", "электрическая зубная щётка", "звуковая зубная щетка", "ультразвуковая зубная щетка", "electric toothbrush", "elektr tish cho‘tkasi", "tish yuvish mashinasi"],
      keywords: ["зубная щетка", "зубная щётка", "tish cho‘tkasi"],
      exclude: ["насадки для зубной щетки"]
    },
    {
      id: "cat_scales",
      phrases: ["напольные весы", "умные весы", "диагностические весы", "электронные весы напольные", "smart scale", "body fat scale", "aqlli tarozi"],
      keywords: ["весы", "tarozi", "scales"],
      exclude: ["кухонные весы"]
    },
    {
      id: "cat_beauty_care",
      phrases: ["массажер для лица", "ультразвуковой скрабер", "микротоковый массажер", "дарсонваль", "facial massager", "beauty care"],
      keywords: ["скрабер", "массажер"],
      exclude: []
    },
    {
      id: "cat_lamps",
      phrases: ["настольная лампа", "лампа настольная", "светодиодная лампа", "умный светильник", "ночник детский", "desk lamp", "table lamp", "yoritgich", "stol chirog‘i"],
      keywords: ["лампа", "светильник", "ночник", "люстра", "lamp", "chiroq"],
      exclude: []
    },
    {
      id: "cat_smarthome",
      phrases: ["умный дом", "умная розетка", "умный выключатель", "умное реле", "датчик температуры и влажности", "датчик протечки", "датчик движения", "smart home", "smart plug", "smart switch", "aqlli uy"],
      keywords: ["zigbee", "aqara"],
      exclude: ["умные часы", "умная колонка", "робот-пылесос"]
    },
    {
      id: "cat_storage",
      phrases: ["органайзер для проводов", "органайзер для кабелей", "коробка для хранения", "контейнер для хранения", "ящик для хранения", "storage box", "cable organizer"],
      keywords: ["органайзер", "контейнер"],
      exclude: []
    },
    {
      id: "cat_textile",
      phrases: ["постельное белье", "комплект постельного белья", "махровое полотенце", "плед микрофибра", "покрывало на кровать", "ортопедическая подушка", "towel", "blanket"],
      keywords: ["полотенце", "плед", "покрывало", "подушка", "текстиль"],
      exclude: []
    }
  ];

  function suggestProductCategory(product, categoriesList) {
    if (!product) return null;
    var p = product.payload || product;
    var all = categoriesList || loadCategoriesData();

    var titleRu = String(p.nameRu || p.name_ru || "").trim().toLowerCase();
    var titleUz = String(p.nameUz || p.name_uz || "").trim().toLowerCase();
    var model = String(p.model || "").trim().toLowerCase();
    var brand = String(p.brand || "").trim().toLowerCase();
    var descRu = String(p.descRu || p.desc_ru || "").trim().toLowerCase();
    var descUz = String(p.descUz || p.desc_uz || "").trim().toLowerCase();
    var legacyCategory = String(p.category || "").trim().toLowerCase();

    var textTitle = [titleRu, titleUz, model].filter(Boolean).join(" ");
    var textDesc = [descRu, descUz].filter(Boolean).join(" ");

    var bestMatch = null;
    var highestScore = 0;

    for (var i = 0; i < TAXONOMY_RULES.length; i++) {
      var rule = TAXONOMY_RULES[i];
      var score = 0;
      var reasons = [];

      // Exclusions
      var excluded = false;
      if (rule.exclude && rule.exclude.length) {
        for (var e = 0; e < rule.exclude.length; e++) {
          var ex = rule.exclude[e].toLowerCase();
          if (textTitle.indexOf(ex) !== -1) {
            excluded = true;
            break;
          }
        }
      }
      if (excluded) continue;

      // Phrase match in title/model (+50)
      for (var f = 0; f < rule.phrases.length; f++) {
        var phrase = rule.phrases[f].toLowerCase();
        if (textTitle.indexOf(phrase) !== -1) {
          score += 50;
          reasons.push("В названии найдено: «" + rule.phrases[f] + "»");
          break;
        }
      }

      // Keyword match in title/model (+30)
      for (var k = 0; k < rule.keywords.length; k++) {
        var kw = rule.keywords[k].toLowerCase();
        var re = new RegExp("(?:^|[\\s,.;:!?\"'()«»\\/\\-])" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:$|[\\s,.;:!?\"'()«»\\/\\-])", "i");
        if (re.test(textTitle)) {
          score += 30;
          reasons.push("Ключевое слово: «" + rule.keywords[k] + "»");
          break;
        }
      }

      // Match in description (+15)
      for (var d = 0; d < rule.phrases.length; d++) {
        var phDesc = rule.phrases[d].toLowerCase();
        if (textDesc.indexOf(phDesc) !== -1) {
          score += 15;
          reasons.push("В описании: «" + rule.phrases[d] + "»");
          break;
        }
      }

      // Legacy payload.category match (+15), only if title doesn't contradict
      if (legacyCategory) {
        var catObj = getCategoryById(rule.id, all);
        var catNameRu = catObj ? String(catObj.nameRu || "").toLowerCase() : "";
        var catNameUz = catObj ? String(catObj.nameUz || "").toLowerCase() : "";
        if (
          legacyCategory === catNameRu ||
          legacyCategory === catNameUz ||
          rule.phrases.some(function (p) { return p === legacyCategory; })
        ) {
          // If title has no match for this rule and title already strongly matched another rule, don't pollute
          score += 15;
          reasons.push("Совпадение со старой категорией: «" + (p.category || "") + "»");
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = {
          ruleId: rule.id,
          score: score,
          reasons: reasons
        };
      }
    }

    if (!bestMatch || highestScore < 20) {
      return null;
    }

    var leaf = getCategoryById(bestMatch.ruleId, all);
    if (!leaf) return null;

    var path = getCategoryPath(leaf, all);
    var pathLabel = path.map(function (item) { return item.nameRu || item.nameUz; }).join(" › ");

    var confidence = "LOW";
    if (highestScore >= 50) {
      confidence = "HIGH";
    } else if (highestScore >= 30) {
      confidence = "MEDIUM";
    }

    return {
      suggestedCategoryId: leaf.id,
      category: leaf,
      path: path,
      pathLabel: pathLabel,
      confidence: confidence,
      score: highestScore,
      reasons: bestMatch.reasons
    };
  }

  root.emirateCategories = {
    ADMIN_CATEGORIES_KEY: ADMIN_CATEGORIES_KEY,
    slugifyCategory: slugifyCategory,
    normalizeCategoryRecord: normalizeCategoryRecord,
    normalizeCategorySpec: normalizeCategorySpec,
    nestedCategoryBlueprint: nestedCategoryBlueprint,
    defaultCategoriesData: defaultCategoriesData,
    loadCategoriesData: loadCategoriesData,
    persistCategoriesData: persistCategoriesData,
    getNavCategories: getNavCategories,
    getCategoryDisplayName: getCategoryDisplayName,
    buildCategoryProductsUrl: buildCategoryProductsUrl,
    getCategoryById: getCategoryById,
    getCategoryBySlug: getCategoryBySlug,
    getCategoryBySlugOrId: getCategoryBySlugOrId,
    getCategoryByName: getCategoryByName,
    getRootCategories: getRootCategories,
    getCategoryChildren: getCategoryChildren,
    getLocalCategorySubtreeIds: getLocalCategorySubtreeIds,
    getCategoryPath: getCategoryPath,
    ensurePublicCategoriesLoaded: ensurePublicCategoriesLoaded,
    suggestProductCategory: suggestProductCategory,
    TAXONOMY_RULES: TAXONOMY_RULES
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.emirateCategories;
  }
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
