/**
 * Shared storefront catalogs (Ozon-style tiles) for admin + storefront.
 * Links one catalog → many product categories.
 */
(function () {
  var ADMIN_CATALOGS_KEY = "emirate_admin_catalogs_v1";
  var PUBLIC_CATALOGS_KEY = "emirate_public_catalogs_v1";

  function slugifyCatalog(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9\u0400-\u04ff]+/gi, "-")
      .replace(/^-+|-+$/g, "");
  }

  function defaultCatalogsData() {
    return [
      normalizeCatalogRecord({
        id: "catalog_electronics",
        nameRu: "Электроника",
        nameUz: "Elektronika",
        slug: "elektronika",
        categoryIds: ["cat_electronics"],
        sortOrder: 1,
        isActive: true,
      }),
      normalizeCatalogRecord({
        id: "catalog_appliances",
        nameRu: "Бытовая техника",
        nameUz: "Maishiy texnika",
        slug: "bytovaya-tehnika",
        categoryIds: ["cat_appliances"],
        sortOrder: 2,
        isActive: true,
      }),
      normalizeCatalogRecord({
        id: "catalog_home",
        nameRu: "Дом и сад",
        nameUz: "Uy va bog'",
        slug: "dom-i-sad",
        categoryIds: ["cat_home"],
        sortOrder: 3,
        isActive: true,
      }),
      normalizeCatalogRecord({
        id: "catalog_beauty",
        nameRu: "Красота и здоровье",
        nameUz: "Go'zallik va salomatlik",
        slug: "krasota-i-zdorove",
        categoryIds: ["cat_beauty"],
        sortOrder: 4,
        isActive: true,
      }),
      normalizeCatalogRecord({
        id: "catalog_accessories",
        nameRu: "Аксессуары",
        nameUz: "Aksessuarlar",
        slug: "aksessuary",
        categoryIds: ["cat_accessories"],
        sortOrder: 5,
        isActive: true,
      }),
      normalizeCatalogRecord({
        id: "catalog_computers",
        nameRu: "Компьютеры",
        nameUz: "Kompyuterlar",
        slug: "kompyutery",
        categoryIds: ["cat_computers"],
        sortOrder: 6,
        isActive: true,
      }),
    ];
  }

  function normalizeCatalogRecord(record) {
    var item = record || {};
    var nameRu = String(item.nameRu || item.name || "").trim();
    var slug = String(item.slug || slugifyCatalog(nameRu)).trim() || slugifyCatalog(nameRu);
    var categoryIds = Array.isArray(item.categoryIds)
      ? item.categoryIds.map(function (id) {
          return String(id || "").trim();
        }).filter(Boolean)
      : [];
    var categoryNames = Array.isArray(item.categoryNames)
      ? item.categoryNames.map(function (name) {
          return String(name || "").trim();
        }).filter(Boolean)
      : [];
    return {
      id: item.id || "catalog_" + (slug || Math.floor(Math.random() * 9000 + 1000)),
      nameRu: nameRu,
      nameUz: String(item.nameUz || nameRu).trim(),
      slug: slug,
      imageUrl: String(item.imageUrl || "").trim(),
      categoryIds: categoryIds,
      categoryNames: categoryNames,
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 100,
      isActive: item.isActive !== false && item.status !== "inactive",
      updatedAt: item.updatedAt || new Date().toISOString(),
    };
  }

  function loadCatalogsData() {
    try {
      var publicRaw = localStorage.getItem(PUBLIC_CATALOGS_KEY);
      if (publicRaw) {
        var publicParsed = JSON.parse(publicRaw);
        if (Array.isArray(publicParsed) && publicParsed.length) {
          return publicParsed.map(normalizeCatalogRecord);
        }
      }
      var raw = localStorage.getItem(ADMIN_CATALOGS_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(parsed) || !parsed.length) {
        return defaultCatalogsData();
      }
      return parsed.map(normalizeCatalogRecord);
    } catch (_) {
      return defaultCatalogsData();
    }
  }

  function persistCatalogsData(catalogs) {
    localStorage.setItem(ADMIN_CATALOGS_KEY, JSON.stringify(catalogs || []));
    localStorage.setItem(PUBLIC_CATALOGS_KEY, JSON.stringify(catalogs || []));
  }

  function getActiveCatalogs(catalogs) {
    return (catalogs || loadCatalogsData())
      .filter(function (item) {
        return item.isActive;
      })
      .sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
  }

  function getCatalogBySlug(slug, catalogs) {
    var key = String(slug || "").trim().toLowerCase();
    if (!key) return null;
    return (catalogs || loadCatalogsData()).find(function (item) {
      return String(item.slug || "").toLowerCase() === key || String(item.id || "").toLowerCase() === key;
    }) || null;
  }

  function getCatalogDisplayName(catalog, lang) {
    if (!catalog) return "";
    if (lang === "uz") return catalog.nameUz || catalog.nameRu || "";
    return catalog.nameRu || catalog.nameUz || "";
  }

  function buildCatalogProductsUrl(catalog) {
    var slug = catalog && (catalog.slug || catalog.id);
    if (!slug) return "catalog.html";
    return "catalog.html?catalog=" + encodeURIComponent(slug);
  }

  function collectDescendantIds(rootId, categories) {
    var list = Array.isArray(categories) ? categories : [];
    var result = [];
    var queue = [String(rootId || "")];
    var seen = {};
    while (queue.length) {
      var current = queue.shift();
      if (!current || seen[current]) continue;
      seen[current] = true;
      result.push(current);
      list.forEach(function (cat) {
        if (String(cat.parentId || "") === current) {
          queue.push(String(cat.id || ""));
        }
      });
    }
    return result;
  }

  /** Resolve linked category ids → product category name strings (incl. children). */
  function getLinkedCategoryNames(catalog, categories) {
    var ids = (catalog && Array.isArray(catalog.categoryIds) ? catalog.categoryIds : []).filter(Boolean);
    var list = Array.isArray(categories) ? categories : [];
    var names = {};
    (Array.isArray(catalog && catalog.categoryNames) ? catalog.categoryNames : []).forEach(function (name) {
      if (name) names[String(name).trim()] = true;
    });
    ids.forEach(function (id) {
      collectDescendantIds(id, list).forEach(function (catId) {
        var cat = list.find(function (item) {
          return String(item.id) === String(catId);
        });
        if (!cat) return;
        if (cat.nameRu) names[String(cat.nameRu).trim()] = true;
        if (cat.nameUz) names[String(cat.nameUz).trim()] = true;
      });
    });
    return Object.keys(names).filter(Boolean);
  }

  function loadAdminCategoriesForResolve() {
    try {
      var raw = localStorage.getItem("emirate_admin_categories_v1");
      var parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  window.emirateCatalogs = {
    ADMIN_CATALOGS_KEY: ADMIN_CATALOGS_KEY,
    PUBLIC_CATALOGS_KEY: PUBLIC_CATALOGS_KEY,
    slugifyCatalog: slugifyCatalog,
    defaultCatalogsData: defaultCatalogsData,
    normalizeCatalogRecord: normalizeCatalogRecord,
    loadCatalogsData: loadCatalogsData,
    persistCatalogsData: persistCatalogsData,
    getActiveCatalogs: getActiveCatalogs,
    getCatalogBySlug: getCatalogBySlug,
    getCatalogDisplayName: getCatalogDisplayName,
    buildCatalogProductsUrl: buildCatalogProductsUrl,
    getLinkedCategoryNames: getLinkedCategoryNames,
    loadAdminCategoriesForResolve: loadAdminCategoriesForResolve,
  };
})();
