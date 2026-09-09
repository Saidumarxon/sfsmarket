/**
 * Shared categories registry (localStorage: emirate_admin_categories_v1)
 * Single source of truth for Admin Panel and Storefront.
 */
(function () {
  var ADMIN_CATEGORIES_KEY = "emirate_admin_categories_v1";

  function slugifyCategory(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9\u0400-\u04ff]+/gi, "-")
      .replace(/^-+|-+$/g, "");
  }

  function getDateTimeString() {
    var now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 19);
  }

  function normalizeCategorySpec(spec) {
    var row = spec || {};
    return {
      keyRu: String(row.keyRu || row.nameRu || row.key || row.name || "").trim(),
      keyUz: String(row.keyUz || "").trim(),
      valueRu: String(row.valueRu || row.value || "").trim(),
      valueUz: String(row.valueUz || "").trim()
    };
  }

  function normalizeCategoryRecord(record) {
    var category = record || {};
    var nameRu = String(category.nameRu || category.name || "").trim();
    var nameUz = String(category.nameUz || "").trim();
    var slug = String(category.slug || slugifyCategory(nameRu)).trim() || slugifyCategory(nameRu);
    var parentId = String(category.parentId || "").trim();
    var sortOrder = Number.isFinite(Number(category.sortOrder)) ? Number(category.sortOrder) : 100;
    var isActive = category.isActive !== false && category.status !== "inactive";
    
    // showInNav is explicitly supported. Default to true for root/top-level categories if undefined.
    var showInNav;
    if (category.showInNav !== undefined) {
      showInNav = Boolean(category.showInNav);
    } else if (category.show_in_nav !== undefined) {
      showInNav = Boolean(category.show_in_nav);
    } else {
      showInNav = !parentId; // top-level categories visible by default
    }

    var defaultSpecs = Array.isArray(category.defaultSpecs)
      ? category.defaultSpecs.map(normalizeCategorySpec).filter(function (item) {
          return item.keyRu || item.keyUz;
        })
      : [];

    return {
      id: category.id || "cat_" + (slug || Math.floor(Math.random() * 9000 + 1000)),
      nameRu: nameRu,
      nameUz: nameUz,
      slug: slug,
      parentId: parentId,
      sortOrder: sortOrder,
      isActive: isActive,
      showInNav: showInNav,
      defaultSpecs: defaultSpecs,
      updatedAt: category.updatedAt || getDateTimeString()
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

  function getNavCategories(lang) {
    var categories = loadCategoriesData();
    return categories
      .filter(function (cat) {
        return cat && cat.isActive !== false && cat.showInNav === true;
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
    if (code === "uz" && category.nameUz) return category.nameUz;
    return category.nameRu || category.nameUz || "";
  }

  function buildCategoryProductsUrl(category) {
    if (!category) return "catalog.html";
    var query = category.nameRu || category.nameUz || category.slug || "";
    return "catalog.html?category=" + encodeURIComponent(query);
  }

  function getCategoryById(id, list) {
    var key = String(id || "").trim();
    if (!key) return null;
    var all = list || loadCategoriesData();
    return all.find(function (item) { return item.id === key; }) || null;
  }

  function getCategoryByName(name, list) {
    var key = String(name || "").trim().toLowerCase();
    if (!key) return null;
    var all = list || loadCategoriesData();
    return all.find(function (item) {
      return (
        String(item.nameRu || "").trim().toLowerCase() === key ||
        String(item.nameUz || "").trim().toLowerCase() === key ||
        String(item.slug || "").trim().toLowerCase() === key
      );
    }) || null;
  }

  window.emirateCategories = {
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
    getCategoryByName: getCategoryByName
  };
})();
