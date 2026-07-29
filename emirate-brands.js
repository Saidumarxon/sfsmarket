/**
 * Shared brands registry (localStorage) for admin + storefront.
 */
(function () {
  var ADMIN_BRANDS_KEY = "emirate_admin_brands_v1";

  function slugifyBrand(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9\u0400-\u04ff]+/gi, "-")
      .replace(/^-+|-+$/g, "");
  }

  function defaultBrandsData() {
    var seed = [
      "Apple",
      "Samsung",
      "Xiaomi",
      "Huawei",
      "Sony",
      "LG",
      "Dyson",
      "Honor",
      "UGREEN",
      "JBL",
    ];
    return seed.map(function (name, index) {
      return normalizeBrandRecord({
        id: "brand_" + slugifyBrand(name),
        nameRu: name,
        nameUz: name,
        slug: slugifyBrand(name),
        sortOrder: index + 1,
        isActive: true,
      });
    });
  }

  function normalizeBrandRecord(record) {
    var brand = record || {};
    var nameRu = String(brand.nameRu || brand.name || "").trim();
    var slug = String(brand.slug || slugifyBrand(nameRu)).trim() || slugifyBrand(nameRu);
    return {
      id: brand.id || "brand_" + (slug || Math.floor(Math.random() * 9000 + 1000)),
      nameRu: nameRu,
      nameUz: String(brand.nameUz || nameRu).trim(),
      slug: slug,
      logoUrl: String(brand.logoUrl || "").trim(),
      sortOrder: Number.isFinite(Number(brand.sortOrder)) ? Number(brand.sortOrder) : 100,
      isActive: brand.isActive !== false && brand.status !== "inactive",
      updatedAt: brand.updatedAt || new Date().toISOString(),
    };
  }

  function loadBrandsData() {
    try {
      var publicRaw = localStorage.getItem("emirate_public_brands_v1");
      if (publicRaw) {
        var publicParsed = JSON.parse(publicRaw);
        if (Array.isArray(publicParsed) && publicParsed.length) {
          return publicParsed.map(normalizeBrandRecord);
        }
      }
      var raw = localStorage.getItem(ADMIN_BRANDS_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(parsed) || !parsed.length) {
        return defaultBrandsData();
      }
      return parsed.map(normalizeBrandRecord);
    } catch (_) {
      return defaultBrandsData();
    }
  }

  async function refreshPublicBrandsFromRemote() {
    if (!window.emirateSupabaseApi || !window.emirateSupabaseApi.fetchPublicBrands) {
      return loadBrandsData();
    }
    try {
      var remote = await window.emirateSupabaseApi.fetchPublicBrands();
      if (Array.isArray(remote) && remote.length) {
        var normalized = remote.map(normalizeBrandRecord);
        localStorage.setItem("emirate_public_brands_v1", JSON.stringify(normalized));
        return normalized;
      }
    } catch (_) {}
    return loadBrandsData();
  }

  function persistBrandsData(brands) {
    localStorage.setItem(ADMIN_BRANDS_KEY, JSON.stringify(brands || []));
  }

  function getActiveBrands(brands) {
    return (brands || loadBrandsData())
      .filter(function (item) {
        return item.isActive;
      })
      .sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
  }

  function getBrandByName(name, brands) {
    var key = String(name || "").trim().toLowerCase();
    if (!key) return null;
    return (brands || loadBrandsData()).find(function (item) {
      return (
        String(item.nameRu || "").trim().toLowerCase() === key ||
        String(item.nameUz || "").trim().toLowerCase() === key
      );
    }) || null;
  }

  function getBrandBySlug(slug, brands) {
    var key = String(slug || "").trim().toLowerCase();
    if (!key) return null;
    return (brands || loadBrandsData()).find(function (item) {
      return String(item.slug || "").trim().toLowerCase() === key;
    }) || null;
  }

  function resolveBrandFilterParam(value, brands) {
    var raw = String(value || "").trim();
    if (!raw) return null;
    var list = brands || loadBrandsData();
    return (
      getBrandByName(raw, list) ||
      getBrandBySlug(raw, list) ||
      getBrandBySlug(slugifyBrand(raw), list) ||
      null
    );
  }

  function getBrandDisplayName(brand, lang) {
    if (!brand) return "";
    var code = String(lang || "ru").toLowerCase();
    if (code === "uz" && brand.nameUz) return brand.nameUz;
    return brand.nameRu || brand.nameUz || "";
  }

  function buildBrandCatalogUrl(brand) {
    if (!brand) return "catalog.html";
    var name = encodeURIComponent(brand.nameRu || brand.nameUz || brand.slug || "");
    return "catalog.html?brand=" + name;
  }

  window.emirateBrands = {
    ADMIN_BRANDS_KEY: ADMIN_BRANDS_KEY,
    slugifyBrand: slugifyBrand,
    defaultBrandsData: defaultBrandsData,
    normalizeBrandRecord: normalizeBrandRecord,
    loadBrandsData: loadBrandsData,
    persistBrandsData: persistBrandsData,
    getActiveBrands: getActiveBrands,
    getBrandByName: getBrandByName,
    getBrandBySlug: getBrandBySlug,
    resolveBrandFilterParam: resolveBrandFilterParam,
    getBrandDisplayName: getBrandDisplayName,
    buildBrandCatalogUrl: buildBrandCatalogUrl,
    refreshPublicBrandsFromRemote: refreshPublicBrandsFromRemote,
  };
})();
