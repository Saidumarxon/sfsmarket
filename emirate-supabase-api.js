/**
 * Shared Supabase helpers for static pages (catalog, product, checkout, admin).
 * Depends on: UMD supabase-js, supabase-config.js (window.emirateSupabase).
 */
(function () {
  function client() {
    return window.emirateSupabase || null;
  }

  function isConfigured() {
    return !!client();
  }

  function getStorageBucket() {
    return String(window.emirateSupabaseStorageBucket || "product-media").trim() || "product-media";
  }

  function getProjectUrl() {
    return String(window.emirateSupabaseUrl || "").replace(/\/+$/, "");
  }

  function safeFileName(name) {
    return String(name || "file")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "file";
  }

  function buildStoragePublicPrefix(bucket) {
    var projectUrl = getProjectUrl();
    if (!projectUrl) return "";
    return projectUrl + "/storage/v1/object/public/" + bucket + "/";
  }

  function extractStoragePathFromUrl(url, bucket) {
    var prefix = buildStoragePublicPrefix(bucket);
    var value = String(url || "");
    if (!prefix || !value || value.indexOf(prefix) !== 0) return null;
    return decodeURIComponent(value.slice(prefix.length).split("?")[0]);
  }

  var STOREFRONT_MARKUP_RATE = 1.2;

  function parseMoneyText(text) {
    return Number(String(text || "").replace(/\s+/g, "").replace(/[^\d]/g, "")) || 0;
  }

  /**
   * Asaxiy-style charm: 3 899 000 / 99 000 / 3 999 000
   * (…9000 — ends with 000, 9 before zeros; never above the raw amount).
   */
  function roundCharmPrice(amount) {
    var n = Math.round(Number(amount) || 0);
    if (n <= 0) return 0;
    if (n < 1000) return Math.max(9, Math.floor(n / 10) * 10 + 9);
    if (n < 10000) {
      var k = Math.floor(n / 1000);
      return Math.max(1000, (k >= 9 ? 9 : k) * 1000);
    }
    var tier = Math.round(n / 10000);
    var charm = tier * 10000 - 1000;
    if (charm > n) charm = (tier - 1) * 10000 - 1000;
    return charm >= 9000 ? charm : 9000;
  }

  /** Admin base price → vitrina (+20%, then …9). Base prices stay in DB/admin. */
  function applyStorefrontMarkupToPrices(basePrice, baseOldPrice) {
    var base = Number(basePrice) || 0;
    var oldBase = Number(baseOldPrice) || 0;
    if (base <= 0) return { price: 0, oldPrice: 0 };
    var price = roundCharmPrice(Math.round(base * STOREFRONT_MARKUP_RATE));
    var oldPrice = oldBase > 0 ? roundCharmPrice(Math.round(oldBase * STOREFRONT_MARKUP_RATE)) : price;
    if (oldPrice < price) oldPrice = price;
    return { price: price, oldPrice: oldPrice };
  }

  function normalizeTitleKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/gb\b/g, "")
      .replace(/[^a-zа-я0-9]+/gi, "");
  }

  /** Admin storage row → same shape as loadAdminProductsForCatalog() in catalog.js */
  function mapAdminPayloadToCatalogItem(item) {
    if (!item || typeof item !== "object") return null;
    if (item.status === "inactive") return null;
    var marked =
      window.emirateExchange && window.emirateExchange.resolveStorefrontPricesFromProduct
        ? window.emirateExchange.resolveStorefrontPricesFromProduct(item)
        : applyStorefrontMarkupToPrices(
            parseMoneyText(item.price),
            parseMoneyText(item.oldPrice) || parseMoneyText(item.price)
          );
    var uploadedPhotos = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
    var media = window.emirateResolveProductMedia
      ? window.emirateResolveProductMedia({
          title: item.nameRu || item.nameUz || "Товар",
          sku: item.id || "",
          brand: item.brand || "",
          category: item.category || "Аксессуары",
          photos: uploadedPhotos,
          image: uploadedPhotos[0] || ""
        })
      : { image: uploadedPhotos[0] || "", photos: uploadedPhotos };
    return {
      title: item.nameRu || item.nameUz || "Товар",
      sku: item.id || "",
      brand: item.brand || "",
      model: String(item.model || "").trim(),
      category: item.category || "Аксессуары",
      price: marked.price,
      oldPrice: marked.oldPrice,
      rating: Number(item.rating) || 0,
      reviews: Number(item.reviews) || 0,
      reviewItems: Array.isArray(item.reviewItems)
        ? item.reviewItems
            .map(function (review) {
              return {
                author: String((review && review.author) || (review && review.name) || "").trim(),
                date: String((review && review.date) || (review && review.createdAt) || "").trim(),
                rating: Number(review && review.rating) || 0,
                text: String((review && review.text) || (review && review.comment) || "").trim()
              };
            })
            .filter(function (review) {
              return review.author || review.text;
            })
        : [],
      badge: item.promo === "yes" ? "sale" : item.express === "yes" ? "hit" : "new",
      image: media.image,
      photos: media.photos,
      descUz: String(item.descUz || "").trim(),
      descRu: String(item.descRu || "").trim(),
      specs: Array.isArray(item.specs)
        ? item.specs
            .map(function (spec) {
              return {
                keyRu: String(spec && (spec.keyRu || spec.key) || "").trim(),
                keyUz: String(spec && (spec.keyUz || "") || "").trim(),
                valueRu: String(spec && (spec.valueRu || spec.value) || "").trim(),
                valueUz: String(spec && (spec.valueUz || "") || "").trim(),
                key: String(spec && (spec.keyRu || spec.keyUz || spec.key) || "").trim(),
                value: String(spec && (spec.valueRu || spec.valueUz || spec.value) || "").trim()
              };
            })
            .filter(function (spec) {
              return (spec.keyRu || spec.keyUz || spec.key) && (spec.valueRu || spec.valueUz || spec.value);
            })
        : [],
      colors: Array.isArray(item.colors)
        ? item.colors
            .map(function (variant, index) {
              return {
                id: String((variant && variant.id) || "color_" + (item.id || "p") + "_" + index),
                nameRu: String((variant && variant.nameRu) || (variant && variant.name) || "").trim(),
                nameUz: String((variant && variant.nameUz) || "").trim(),
                name: String((variant && variant.nameRu) || (variant && variant.nameUz) || (variant && variant.name) || "").trim(),
                status: variant && variant.status === "inactive" ? "inactive" : "active",
                swatch: String((variant && variant.swatch) || "").trim(),
                photos: Array.isArray(variant && variant.photos) ? variant.photos.filter(Boolean) : []
              };
            })
            .filter(function (variant) {
              return variant.name;
            })
        : [],
      memoryVariants: Array.isArray(item.memoryVariants)
        ? item.memoryVariants
            .map(function (variant, index) {
              return {
                id: String((variant && variant.id) || "memory_" + (item.id || "p") + "_" + index),
                nameRu: String((variant && variant.nameRu) || (variant && variant.name) || "").trim(),
                nameUz: String((variant && variant.nameUz) || "").trim(),
                name: String((variant && variant.nameRu) || (variant && variant.nameUz) || (variant && variant.name) || "").trim(),
                status: variant && variant.status === "inactive" ? "inactive" : "active",
                priceUsd: variant && variant.priceUsd != null ? variant.priceUsd : "",
                oldPriceUsd: variant && variant.oldPriceUsd != null ? variant.oldPriceUsd : "",
                price: String((variant && variant.price) || "").trim(),
                oldPrice: String((variant && variant.oldPrice) || "").trim()
              };
            })
            .filter(function (variant) {
              return variant.name;
            })
        : [],
      memoryMeta: {
        nameRu: String((item.memoryMeta && item.memoryMeta.nameRu) || "Память").trim() || "Память",
        nameUz: String((item.memoryMeta && item.memoryMeta.nameUz) || "Xotira").trim() || "Xotira",
        status: item.memoryMeta && item.memoryMeta.status === "inactive" ? "inactive" : "active"
      },
      colorMeta: {
        nameRu: String((item.colorMeta && item.colorMeta.nameRu) || "Цвет").trim() || "Цвет",
        nameUz: String((item.colorMeta && item.colorMeta.nameUz) || "rang").trim() || "rang",
        status: item.colorMeta && item.colorMeta.status === "inactive" ? "inactive" : "active",
        type: item.colorMeta && item.colorMeta.type === "text" ? "text" : "image"
      },
      installmentStatus: item.installmentStatus === "inactive" ? "inactive" : "active",
      express: item.express === "yes" ? "yes" : "no",
      priority: Number(item.priority) || 300
    };
  }

  function rowToCatalogItem(row) {
    if (!row || !row.payload) return null;
    var merged = Object.assign({}, row.payload, {
      id: row.admin_id,
      status: row.status != null ? row.status : row.payload.status,
      priority: row.priority != null ? row.priority : row.payload.priority
    });
    return mapAdminPayloadToCatalogItem(merged);
  }

  /* ===== Stale-while-revalidate cache for public storefront data =====
     Every bottom-nav switch is a full page load, so without a cache each
     switch refetches everything and the UI rebuilds from skeletons.
     Fresh cache (< TTL) is served with no network at all; stale cache is
     still served instantly, then revalidated in the background.
     "emirate:data-updated" fires only when revalidation found changes. */
  var SWR_TTL_MS = 3 * 60 * 1000;
  var swrInflight = {};

  function swrStorageKey(name) {
    return "emirate_swr_" + name + "_v1";
  }

  function swrRead(name) {
    try {
      var raw = localStorage.getItem(swrStorageKey(name));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data) || !parsed.data.length) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function swrWrite(name, data) {
    try {
      localStorage.setItem(swrStorageKey(name), JSON.stringify({ t: Date.now(), data: data }));
    } catch (_) {}
  }

  function swrRevalidate(name, fetcher, prevData) {
    if (swrInflight[name]) return;
    swrInflight[name] = Promise.resolve()
      .then(fetcher)
      .then(function (fresh) {
        delete swrInflight[name];
        if (!Array.isArray(fresh) || !fresh.length) return;
        var changed = JSON.stringify(fresh) !== JSON.stringify(prevData);
        swrWrite(name, fresh);
        if (changed) {
          try {
            window.dispatchEvent(new CustomEvent("emirate:data-updated", { detail: { key: name } }));
          } catch (_) {}
        }
      })
      .catch(function () {
        delete swrInflight[name];
      });
  }

  function swrFetch(name, fetcher) {
    var cached = swrRead(name);
    if (cached) {
      if (Date.now() - cached.t > SWR_TTL_MS) swrRevalidate(name, fetcher, cached.data);
      return Promise.resolve(cached.data);
    }
    if (!swrInflight[name]) {
      swrInflight[name] = Promise.resolve()
        .then(fetcher)
        .then(function (fresh) {
          delete swrInflight[name];
          if (Array.isArray(fresh) && fresh.length) swrWrite(name, fresh);
          return fresh;
        })
        .catch(function (err) {
          delete swrInflight[name];
          throw err;
        });
    }
    return swrInflight[name];
  }

  async function fetchPublicCatalogProductsRemote() {
    var sb = client();
    if (!sb) return [];
    var res = await sb
      .from("products")
      .select("admin_id,title,status,priority,payload")
      .eq("status", "active")
      .order("priority", { ascending: true });
    if (res.error) {
      console.warn("[Supabase] fetchPublicCatalogProducts", res.error);
      return [];
    }
    var list = (res.data || [])
      .map(rowToCatalogItem)
      .filter(Boolean);
    return list;
  }

  function fetchPublicCatalogProducts() {
    return swrFetch("products", fetchPublicCatalogProductsRemote);
  }

  /* Synchronous cache readers: let pages render cached content during the
     initial script run, before first paint, instead of in a later microtask. */
  function readCachedProducts() {
    var cached = swrRead("products");
    return cached ? cached.data : null;
  }

  function readCachedBanners() {
    var cached = swrRead("banners");
    return cached ? cached.data : null;
  }

  async function fetchProductForPageByTitle(title) {
    var key = normalizeTitleKey(title);
    if (!key) return null;
    var list = await fetchPublicCatalogProducts();
    var found =
      list.find(function (p) {
        return normalizeTitleKey(p.title) === key;
      }) || null;
    return found;
  }

  async function insertOrder(payload) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    // status не передаём: в старых БД колонки может не быть; после миграции сработает default 'processing'
    var res = await sb.from("orders").insert(payload || {}).select("id").single();
    if (res.error) {
      console.warn("[Supabase] insertOrder", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, id: res.data && res.data.id };
  }

  async function pullAdminOrdersRaw() {
    var sb = client();
    if (!sb) return null;
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return null;
    var res = await sb
      .from("orders")
      .select(
        "id,phone,full_name,region,city,address,comment_text,delivery_method,payment_method,items,total_amount,status,created_at"
      )
      .order("created_at", { ascending: false });
    if (res.error) {
      console.warn("[Supabase] pullAdminOrdersRaw", res.error);
      return null;
    }
    return res.data || [];
  }

  async function updateAdminOrderStatus(orderId, status) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var normalized = String(status || "").trim().toLowerCase();
    var res = await sb.from("orders").update({ status: normalized }).eq("id", String(orderId || "").trim());
    if (res.error) {
      console.warn("[Supabase] updateAdminOrderStatus", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true };
  }

  async function pullAdminProductsRaw() {
    var sb = client();
    if (!sb) return null;
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return null;
    var res = await sb
      .from("products")
      .select("admin_id,status,priority,payload")
      .order("priority", { ascending: true });
    if (res.error) {
      console.warn("[Supabase] pullAdminProductsRaw", res.error);
      return null;
    }
    return (res.data || []).map(function (row) {
      var p = row.payload && typeof row.payload === "object" ? Object.assign({}, row.payload) : {};
      p.id = row.admin_id;
      p.status = row.status || p.status || "active";
      p.priority = row.priority != null ? row.priority : p.priority;
      return p;
    });
  }

  async function pushAdminProductsPayload(productsArray) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var rows = (productsArray || []).map(function (item) {
      var payload = JSON.parse(JSON.stringify(item || {}));
      var adminId = String(payload.id || "").trim();
      if (!adminId) return null;
      var title = String(payload.nameRu || payload.nameUz || payload.title || "Товар").trim() || "Товар";
      var status = payload.status === "inactive" ? "inactive" : "active";
      var priority = Number(payload.priority) || 300;
      return { admin_id: adminId, title: title, status: status, priority: priority, payload: payload };
    }).filter(Boolean);
    if (!rows.length) return { ok: true, rows: 0 };
    var res = await sb.from("products").upsert(rows, { onConflict: "admin_id" });
    if (res.error) {
      console.warn("[Supabase] pushAdminProductsPayload", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, rows: rows.length };
  }

  function rowToHomeBanner(row) {
    if (!row || !row.payload) return null;
    var merged = Object.assign({}, row.payload, {
      id: row.admin_id,
      isActive: row.is_active != null ? row.is_active : row.payload.isActive,
      priority: row.priority != null ? row.priority : row.payload.priority
    });
    return merged;
  }

  async function fetchPublicHomeBannersRemote() {
    var sb = client();
    if (!sb) return [];
    var res = await sb
      .from("banners")
      .select("admin_id,is_active,priority,payload")
      .eq("is_active", true)
      .order("priority", { ascending: true });
    if (res.error) {
      console.warn("[Supabase] fetchPublicHomeBanners", res.error);
      return [];
    }
    return (res.data || []).map(rowToHomeBanner).filter(Boolean);
  }

  function fetchPublicHomeBanners() {
    return swrFetch("banners", fetchPublicHomeBannersRemote);
  }

  async function pullAdminBannersRaw() {
    var sb = client();
    if (!sb) return null;
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return null;
    var res = await sb
      .from("banners")
      .select("admin_id,is_active,priority,payload")
      .order("priority", { ascending: true });
    if (res.error) {
      console.warn("[Supabase] pullAdminBannersRaw", res.error);
      return null;
    }
    return (res.data || []).map(function (row) {
      var p = row.payload && typeof row.payload === "object" ? Object.assign({}, row.payload) : {};
      p.id = row.admin_id;
      p.isActive = row.is_active != null ? row.is_active : p.isActive !== false;
      p.priority = row.priority != null ? row.priority : p.priority;
      return p;
    });
  }

  async function pushAdminBannersPayload(bannersArray) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var rows = (bannersArray || []).map(function (item) {
      var payload = JSON.parse(JSON.stringify(item || {}));
      var adminId = String(payload.id || "").trim();
      if (!adminId) return null;
      return {
        admin_id: adminId,
        is_active: payload.isActive !== false,
        priority: Number(payload.priority) || 100,
        payload: payload
      };
    }).filter(Boolean);
    if (!rows.length) return { ok: true, rows: 0 };
    var res = await sb.from("banners").upsert(rows, { onConflict: "admin_id" });
    if (res.error) {
      console.warn("[Supabase] pushAdminBannersPayload", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, rows: rows.length };
  }

  async function deleteAdminBanner(adminId) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var res = await sb.from("banners").delete().eq("admin_id", String(adminId || "").trim());
    if (res.error) {
      console.warn("[Supabase] deleteAdminBanner", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true };
  }

  async function deleteAdminProduct(adminId) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var res = await sb.from("products").delete().eq("admin_id", String(adminId || "").trim());
    if (res.error) {
      console.warn("[Supabase] deleteAdminProduct", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true };
  }

  function rowToPublicBrand(row) {
    if (!row) return null;
    var payload = row.payload && typeof row.payload === "object" ? Object.assign({}, row.payload) : {};
    payload.id = row.admin_id;
    payload.isActive = row.is_active != null ? row.is_active : payload.isActive !== false;
    payload.sortOrder = row.sort_order != null ? row.sort_order : payload.sortOrder;
    return payload;
  }

  async function fetchPublicBrands() {
    var sb = client();
    if (!sb) return [];
    var res = await sb
      .from("brands")
      .select("admin_id,is_active,sort_order,payload")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (res.error) {
      console.warn("[Supabase] fetchPublicBrands", res.error);
      return [];
    }
    return (res.data || []).map(rowToPublicBrand).filter(Boolean);
  }

  async function pullAdminBrandsRaw() {
    var sb = client();
    if (!sb) return null;
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return null;
    var res = await sb
      .from("brands")
      .select("admin_id,is_active,sort_order,payload")
      .order("sort_order", { ascending: true });
    if (res.error) {
      console.warn("[Supabase] pullAdminBrandsRaw", res.error);
      return null;
    }
    return (res.data || []).map(rowToPublicBrand);
  }

  async function pushAdminBrandsPayload(brandsArray) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var rows = (brandsArray || []).map(function (item) {
      var payload = JSON.parse(JSON.stringify(item || {}));
      var adminId = String(payload.id || "").trim();
      if (!adminId) return null;
      return {
        admin_id: adminId,
        is_active: payload.isActive !== false,
        sort_order: Number(payload.sortOrder) || 100,
        payload: payload
      };
    }).filter(Boolean);
    if (!rows.length) return { ok: true, rows: 0 };
    var res = await sb.from("brands").upsert(rows, { onConflict: "admin_id" });
    if (res.error) {
      console.warn("[Supabase] pushAdminBrandsPayload", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, rows: rows.length };
  }

  async function deleteAdminBrand(adminId) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var res = await sb.from("brands").delete().eq("admin_id", String(adminId || "").trim());
    if (res.error) {
      console.warn("[Supabase] deleteAdminBrand", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true };
  }

  async function uploadAdminAsset(file, options) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var bucket = getStorageBucket();
    var folder = String(options && options.folder || "products").replace(/^\/+|\/+$/g, "") || "products";
    var fileName = safeFileName(file && file.name || "image");
    var stamp = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    var path = folder + "/" + stamp + "_" + fileName;
    var res = await sb.storage.from(bucket).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file && file.type ? file.type : "application/octet-stream"
    });
    if (res.error) {
      console.warn("[Supabase] uploadAdminAsset", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    var publicRes = sb.storage.from(bucket).getPublicUrl(path);
    var publicUrl = publicRes && publicRes.data && publicRes.data.publicUrl || "";
    return { ok: true, url: publicUrl, path: path, bucket: bucket };
  }

  async function removeAdminAssetsByUrls(urls) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var bucket = getStorageBucket();
    var paths = Array.from(new Set((Array.isArray(urls) ? urls : [])
      .map(function (url) { return extractStoragePathFromUrl(url, bucket); })
      .filter(Boolean)));
    if (!paths.length) return { ok: true, removed: 0 };
    var res = await sb.storage.from(bucket).remove(paths);
    if (res.error) {
      console.warn("[Supabase] removeAdminAssetsByUrls", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, removed: paths.length };
  }

  window.emirateSupabaseApi = {
    isConfigured: isConfigured,
    client: client,
    getStorageBucket: getStorageBucket,
    normalizeTitleKey: normalizeTitleKey,
    parseMoneyText: parseMoneyText,
    applyStorefrontMarkupToPrices: applyStorefrontMarkupToPrices,
    roundCharmPrice: roundCharmPrice,
    storefrontMarkupRate: STOREFRONT_MARKUP_RATE,
    mapAdminPayloadToCatalogItem: mapAdminPayloadToCatalogItem,
    fetchPublicCatalogProducts: fetchPublicCatalogProducts,
    readCachedProducts: readCachedProducts,
    readCachedBanners: readCachedBanners,
    fetchProductForPageByTitle: fetchProductForPageByTitle,
    insertOrder: insertOrder,
    pullAdminOrdersRaw: pullAdminOrdersRaw,
    updateAdminOrderStatus: updateAdminOrderStatus,
    pullAdminProductsRaw: pullAdminProductsRaw,
    pushAdminProductsPayload: pushAdminProductsPayload,
    deleteAdminProduct: deleteAdminProduct,
    fetchPublicHomeBanners: fetchPublicHomeBanners,
    pullAdminBannersRaw: pullAdminBannersRaw,
    pushAdminBannersPayload: pushAdminBannersPayload,
    deleteAdminBanner: deleteAdminBanner,
    fetchPublicBrands: fetchPublicBrands,
    pullAdminBrandsRaw: pullAdminBrandsRaw,
    pushAdminBrandsPayload: pushAdminBrandsPayload,
    deleteAdminBrand: deleteAdminBrand,
    uploadAdminAsset: uploadAdminAsset,
    removeAdminAssetsByUrls: removeAdminAssetsByUrls
  };
})();
