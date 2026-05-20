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

  function parseMoneyText(text) {
    return Number(String(text || "").replace(/\s+/g, "").replace(/[^\d]/g, "")) || 0;
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
    return {
      title: item.nameRu || item.nameUz || "Товар",
      sku: item.id || "",
      brand: item.brand || "",
      category: item.category || "Аксессуары",
      price: parseMoneyText(item.price),
      oldPrice: parseMoneyText(item.oldPrice) || parseMoneyText(item.price),
      rating: Number(item.rating || 4.6),
      reviews: Number(item.reviews || 0),
      badge: item.promo === "yes" ? "sale" : item.express === "yes" ? "hit" : "new",
      image: Array.isArray(item.photos) ? item.photos[0] || "" : "",
      photos: Array.isArray(item.photos) ? item.photos.filter(Boolean) : [],
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

  async function fetchPublicCatalogProducts() {
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
    var res = await sb.from("orders").insert(payload).select("id").single();
    if (res.error) {
      console.warn("[Supabase] insertOrder", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, id: res.data && res.data.id };
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
    mapAdminPayloadToCatalogItem: mapAdminPayloadToCatalogItem,
    fetchPublicCatalogProducts: fetchPublicCatalogProducts,
    fetchProductForPageByTitle: fetchProductForPageByTitle,
    insertOrder: insertOrder,
    pullAdminProductsRaw: pullAdminProductsRaw,
    pushAdminProductsPayload: pushAdminProductsPayload,
    deleteAdminProduct: deleteAdminProduct,
    uploadAdminAsset: uploadAdminAsset,
    removeAdminAssetsByUrls: removeAdminAssetsByUrls
  };
})();
