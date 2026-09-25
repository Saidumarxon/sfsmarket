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
      nameRu: String(item.nameRu || "").trim(),
      nameUz: String(item.nameUz || "").trim(),
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

  function parseProductPayload(raw) {
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (_) { return {}; }
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.assign({}, raw);
  }

  function mapProductAdminRow(row) {
    if (!row) return null;
    var p = parseProductPayload(row.payload);
    p.id = String(row.admin_id || p.id || "").trim();
    if (!p.id) return null;
    if (row.status != null) p.status = row.status;
    if (row.priority != null) p.priority = row.priority;
    if (row.title && !p.nameRu && !p.nameUz) p.nameRu = row.title;
    return p;
  }

  function rowToCatalogItem(row) {
    var merged = mapProductAdminRow(row);
    if (!merged) return null;
    return mapAdminPayloadToCatalogItem(merged);
  }

  async function selectProductRows(activeOnly) {
    var sb = client();
    if (!sb) return { error: { message: "no_client" }, data: null };
    var query = sb
      .from("products")
      .select("admin_id,title,status,priority,payload")
      .order("priority", { ascending: true });
    if (activeOnly) query = query.eq("status", "active");
    return query;
  }

  async function fetchPublicCatalogProducts() {
    var sb = client();
    if (!sb) return [];
    var res = await selectProductRows(true);
    if (res.error) {
      console.warn("[Supabase] fetchPublicCatalogProducts", res.error);
      return [];
    }
    return (res.data || []).map(rowToCatalogItem).filter(Boolean);
  }

  async function fetchProductForPageByTitle(title) {
    var key = normalizeTitleKey(title);
    if (!key) return null;
    var list = await fetchPublicCatalogProducts();
    var found =
      list.find(function (p) {
        return (
          normalizeTitleKey(p.title) === key ||
          normalizeTitleKey(p.nameRu) === key ||
          normalizeTitleKey(p.nameUz) === key
        );
      }) || null;
    return found;
  }

  function readInsertedOrderNumber(data) {
    var n = Number(data && (data.order_number != null ? data.order_number : data.orderNumber));
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }

  async function insertOrder(payload) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    // status / order_number не передаём: их ставит default в базе
    var res = await sb.from("orders").insert(payload || {}).select("id").single();
    if (res.error && (res.error.code === "42703" || /delivery_estimate/i.test(String(res.error.message || ""))) && payload && payload.delivery_estimate) {
      var fallbackPayload = Object.assign({}, payload);
      var estimate = fallbackPayload.delivery_estimate;
      delete fallbackPayload.delivery_estimate;
      if (estimate) {
        fallbackPayload.comment_text = (fallbackPayload.comment_text ? fallbackPayload.comment_text + " | " : "") + "Срок доставки: " + estimate;
      }
      res = await sb.from("orders").insert(fallbackPayload).select("id").single();
    }
    if (res.error) {
      console.warn("[Supabase] insertOrder", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, id: res.data && res.data.id, orderNumber: readInsertedOrderNumber(res.data) };
  }

  async function pullAdminOrdersRaw() {
    var sb = client();
    if (!sb) return null;
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return null;
    var res = await sb
      .from("orders")
      .select(
        "id,order_number,phone,full_name,region,city,address,comment_text,delivery_method,delivery_estimate,payment_method,items,total_amount,status,created_at"
      )
      .order("created_at", { ascending: false });
    if (res.error) {
      res = await sb
        .from("orders")
        .select(
          "id,phone,full_name,region,city,address,comment_text,delivery_method,payment_method,items,total_amount,status,created_at"
        )
        .order("created_at", { ascending: false });
    }
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
    var res = await selectProductRows(false);
    if (res.error || !(res.data && res.data.length)) {
      if (res.error) console.warn("[Supabase] pullAdminProductsRaw", res.error);
      var pub = await selectProductRows(true);
      if (pub.error) {
        console.warn("[Supabase] pullAdminProductsRaw public fallback", pub.error);
        return res.error ? null : [];
      }
      res = pub;
    }
    return (res.data || []).map(mapProductAdminRow).filter(Boolean);
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

  async function fetchPublicHomeBanners() {
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

  function rowToPublicPromo(row) {
    if (!row) return null;
    var payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    payload.id = row.admin_id || payload.id;
    payload.code = row.code || payload.code;
    payload.isActive = row.is_active !== false;
    payload.usedCount = row.used_count != null ? row.used_count : payload.usedCount;
    payload.maxUses = row.max_uses != null ? row.max_uses : payload.maxUses;
    return payload;
  }

  async function fetchPublicPromos() {
    var sb = client();
    if (!sb) return [];
    var res = await sb
      .from("promos")
      .select("admin_id,code,is_active,used_count,max_uses,payload")
      .eq("is_active", true);
    if (res.error) {
      console.warn("[Supabase] fetchPublicPromos", res.error);
      return [];
    }
    return (res.data || []).map(rowToPublicPromo).filter(Boolean);
  }

  async function pullAdminPromosRaw() {
    var sb = client();
    if (!sb) return null;
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return null;
    var res = await sb
      .from("promos")
      .select("admin_id,code,is_active,used_count,max_uses,payload")
      .order("updated_at", { ascending: false });
    if (res.error) {
      console.warn("[Supabase] pullAdminPromosRaw", res.error);
      return null;
    }
    return (res.data || []).map(rowToPublicPromo);
  }

  async function pushAdminPromosPayload(promosArray) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var rows = (promosArray || []).map(function (item) {
      var payload = JSON.parse(JSON.stringify(item || {}));
      var adminId = String(payload.id || "").trim();
      var code = String(payload.code || "").trim().toUpperCase();
      if (!adminId || !code) return null;
      return {
        admin_id: adminId,
        code: code,
        is_active: payload.isActive !== false,
        used_count: Number(payload.usedCount) || 0,
        max_uses: Number(payload.maxUses) || 1,
        payload: payload,
        updated_at: new Date().toISOString()
      };
    }).filter(Boolean);
    if (!rows.length) return { ok: true, rows: 0 };
    var res = await sb.from("promos").upsert(rows, { onConflict: "admin_id" });
    if (res.error) {
      console.warn("[Supabase] pushAdminPromosPayload", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, rows: rows.length };
  }

  async function deleteAdminPromo(adminId) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    var res = await sb.from("promos").delete().eq("admin_id", String(adminId || "").trim());
    if (res.error) {
      console.warn("[Supabase] deleteAdminPromo", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true };
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

  async function fetchAdminContractors() {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };

    var cRes = await sb.from("contractors").select("*").order("name", { ascending: true });
    if (cRes.error) {
      console.warn("[Supabase] fetchAdminContractors", cRes.error);
      return { ok: false, error: cRes.error.message || String(cRes.error) };
    }

    var contractors = cRes.data || [];
    var summaryMap = {};

    var sRes = await sb.rpc("get_contractors_summary");
    if (!sRes.error && Array.isArray(sRes.data)) {
      sRes.data.forEach(function (row) {
        if (row && row.contractor_id) {
          summaryMap[row.contractor_id] = {
            receipts_count: Number(row.receipts_count) || 0,
            total_received_units: Number(row.total_received_units) || 0,
            total_receipt_amount: Number(row.total_receipt_amount) || 0,
            total_paid: Number(row.total_paid) || 0,
            current_debt: Number(row.current_debt) || 0
          };
        }
      });
    }

    var merged = contractors.map(function (c) {
      var s = summaryMap[c.id] || {
        receipts_count: 0,
        total_received_units: 0,
        total_receipt_amount: 0,
        total_paid: 0,
        current_debt: 0
      };
      return Object.assign({}, c, s);
    });

    return { ok: true, data: merged };
  }

  async function createAdminContractor(payload) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };

    var name = String((payload && payload.name) || "").trim();
    if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters" };

    var record = {
      name: name,
      phone: String((payload && payload.phone) || "").trim() || null,
      contact_person: String((payload && payload.contact_person) || "").trim() || null,
      inn: String((payload && payload.inn) || "").trim() || null,
      status: payload && payload.status === "inactive" ? "inactive" : "active"
    };

    var res = await sb.from("contractors").insert([record]).select("*");
    if (res.error) {
      console.warn("[Supabase] createAdminContractor", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, data: res.data && res.data[0] };
  }

  async function updateAdminContractor(id, payload) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    if (!id) return { ok: false, error: "id_required" };

    var name = String((payload && payload.name) || "").trim();
    if (name.length < 2) return { ok: false, error: "Name must be at least 2 characters" };

    var patch = {
      name: name,
      phone: String((payload && payload.phone) || "").trim() || null,
      contact_person: String((payload && payload.contact_person) || "").trim() || null,
      inn: String((payload && payload.inn) || "").trim() || null,
      status: payload && payload.status === "inactive" ? "inactive" : "active",
      updated_at: new Date().toISOString()
    };

    var res = await sb.from("contractors").update(patch).eq("id", id).select("*");
    if (res.error) {
      console.warn("[Supabase] updateAdminContractor", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, data: res.data && res.data[0] };
  }

  async function toggleAdminContractorStatus(id, nextStatus) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };

    var status = nextStatus === "inactive" ? "inactive" : "active";
    var res = await sb.from("contractors").update({ status: status, updated_at: new Date().toISOString() }).eq("id", id).select("*");
    if (res.error) {
      console.warn("[Supabase] toggleAdminContractorStatus", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, data: res.data && res.data[0] };
  }

  async function deleteAdminContractor(id) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    if (!id) return { ok: false, error: "id_required" };

    // Check if contractor is referenced in receipts or transactions
    var rCheck = await sb.from("receipts").select("id").eq("contractor_id", id).limit(1);
    var tCheck = await sb.from("contractor_transactions").select("id").eq("contractor_id", id).limit(1);

    var hasReceipts = rCheck.data && rCheck.data.length > 0;
    var hasTransactions = tCheck.data && tCheck.data.length > 0;

    if (hasReceipts || hasTransactions) {
      // Cannot delete physically: preserve history by deactivating
      await sb.from("contractors").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", id);
      return {
        ok: false,
        action: "deactivated",
        message: "Контрагент имеет историю операций (приёмки/платежи) и не может быть удален. Статус переведен в «Неактивный»."
      };
    }

    var res = await sb.from("contractors").delete().eq("id", id);
    if (res.error) {
      console.warn("[Supabase] deleteAdminContractor", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, action: "deleted" };
  }

  async function importAdminContractorsBatch(items) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };

    if (!Array.isArray(items) || !items.length) {
      return { ok: false, error: "No items to import" };
    }

    var rows = items.map(function (it) {
      var name = String((it && it.name) || "").trim();
      if (name.length < 2) return null;
      return {
        name: name,
        phone: String((it && it.phone) || "").trim() || null,
        contact_person: null,
        inn: null,
        status: it && it.status === "inactive" ? "inactive" : "active"
      };
    }).filter(Boolean);

    if (rows.length !== items.length) {
      return { ok: false, error: "One or more contractor names are invalid (minimum 2 characters)" };
    }

    var res = await sb.from("contractors").insert(rows).select("id");
    if (res.error) {
      console.warn("[Supabase] importAdminContractorsBatch", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }

    return { ok: true, inserted: res.data ? res.data.length : rows.length };
  }

  // --- INVENTORY & GOODS RECEIVING MODULE (PHASE 3) ---

  async function fetchAdminWarehouses() {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };

    var res = await sb.from("warehouses").select("*").order("name", { ascending: true });
    if (res.error) {
      console.warn("[Supabase] fetchAdminWarehouses", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, data: res.data || [] };
  }

  async function fetchAdminReceipts(filters) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };

    var query = sb.from("receipts")
      .select("*, contractor:contractors(id, name, phone), warehouse:warehouses(id, name, code), items:receipt_items(id, product_id, quantity, unit_cost, total_cost)")
      .order("created_at", { ascending: false });

    var f = filters || {};
    if (f.status && f.status !== "all") {
      query = query.eq("status", f.status);
    }
    if (f.contractor_id && f.contractor_id !== "all") {
      query = query.eq("contractor_id", f.contractor_id);
    }
    if (f.warehouse_id && f.warehouse_id !== "all") {
      query = query.eq("warehouse_id", f.warehouse_id);
    }
    if (f.created_from) {
      query = query.gte("created_at", f.created_from);
    }
    if (f.created_to) {
      query = query.lte("created_at", f.created_to + "T23:59:59.999Z");
    }
    if (f.received_from) {
      query = query.gte("received_at", f.received_from);
    }
    if (f.received_to) {
      query = query.lte("received_at", f.received_to);
    }
    if (f.search && f.search.trim()) {
      var s = f.search.trim();
      query = query.or("receipt_number.ilike.%" + s + "%,external_order_number.ilike.%" + s + "%");
    }

    var res = await query;
    if (res.error) {
      console.warn("[Supabase] fetchAdminReceipts", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, data: res.data || [] };
  }

  async function fetchAdminReceiptDetails(receiptId) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    if (!receiptId) return { ok: false, error: "receipt_id_required" };

    var res = await sb.from("receipts")
      .select("*, contractor:contractors(id, name, phone, contact_person, inn), warehouse:warehouses(id, name, code, address), items:receipt_items(*)")
      .eq("id", receiptId)
      .single();

    if (res.error) {
      console.warn("[Supabase] fetchAdminReceiptDetails", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }

    var receipt = res.data;
    if (!receipt) return { ok: false, error: "Receipt not found" };

    // Also fetch current stock balances for products in this receipt if any
    var items = receipt.items || [];
    var productIds = items.map(function (it) { return it.product_id; }).filter(Boolean);
    var stockMap = {};

    if (productIds.length > 0 && receipt.warehouse_id) {
      var stockRes = await sb.from("stock_balances")
        .select("product_id, quantity, reserved_quantity")
        .eq("warehouse_id", receipt.warehouse_id)
        .in("product_id", productIds);

      if (stockRes.data) {
        stockRes.data.forEach(function (sbRow) {
          stockMap[sbRow.product_id] = sbRow.quantity;
        });
      }
    }

    // Attach current stock to items
    receipt.items = items.map(function (it) {
      return Object.assign({}, it, {
        current_stock: stockMap[it.product_id] != null ? stockMap[it.product_id] : 0
      });
    });

    // Also fetch movements for this receipt if posted/cancelled
    var movRes = await sb.from("stock_movements")
      .select("*")
      .eq("reference_id", receiptId)
      .order("created_at", { ascending: true });

    receipt.movements = movRes.data || [];

    return { ok: true, data: receipt };
  }

  async function createAdminReceiptDraft(header, items) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };

    if (!header || !header.contractor_id) return { ok: false, error: "Contractor is required" };
    if (!header.warehouse_id) return { ok: false, error: "Warehouse is required" };

    var cleanItems = (Array.isArray(items) ? items : []).map(function (it) {
      var qty = parseInt(it.quantity, 10);
      var cost = Number(it.unit_cost);
      var sale = it.sale_price != null && it.sale_price !== "" ? Number(it.sale_price) : null;
      return {
        product_id: String(it.product_id || "").trim(),
        quantity: qty,
        unit_cost: isNaN(cost) ? 0 : cost,
        sale_price: sale,
        total_cost: (isNaN(qty) ? 0 : qty) * (isNaN(cost) ? 0 : cost)
      };
    });

    for (var i = 0; i < cleanItems.length; i++) {
      var item = cleanItems[i];
      if (!item.product_id) return { ok: false, error: "Product is required for line " + (i + 1) };
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return { ok: false, error: "Quantity must be an integer greater than 0 for line " + (i + 1) };
      }
      if (item.unit_cost < 0) {
        return { ok: false, error: "Purchase cost cannot be negative for line " + (i + 1) };
      }
    }

    var totalCost = cleanItems.reduce(function (sum, it) { return sum + it.total_cost; }, 0);
    var paidAmount = Number(header.paid_amount) || 0;
    if (paidAmount < 0) return { ok: false, error: "Paid amount cannot be negative" };
    if (paidAmount > totalCost) return { ok: false, error: "Paid amount cannot exceed total cost" };

    var receiptData = {
      contractor_id: header.contractor_id,
      warehouse_id: header.warehouse_id,
      received_at: header.received_at || new Date().toISOString().slice(0, 10),
      external_order_number: header.external_order_number ? String(header.external_order_number).trim() : null,
      payment_method: header.payment_method || "debt",
      currency: header.currency || "UZS",
      exchange_rate: Number(header.exchange_rate) || 1,
      total_cost: totalCost,
      paid_amount: paidAmount,
      debt_amount: Math.max(totalCost - paidAmount, 0),
      description: header.description ? String(header.description).trim() : null,
      status: "draft"
    };

    var rRes = await sb.from("receipts").insert([receiptData]).select("*");
    if (rRes.error) {
      console.warn("[Supabase] createAdminReceiptDraft receipt insert", rRes.error);
      return { ok: false, error: rRes.error.message || String(rRes.error) };
    }
    var receipt = rRes.data && rRes.data[0];
    if (!receipt) return { ok: false, error: "Failed to create receipt record" };

    if (cleanItems.length > 0) {
      var itemRows = cleanItems.map(function (it) {
        return {
          receipt_id: receipt.id,
          product_id: it.product_id,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          total_cost: it.total_cost,
          sale_price: it.sale_price
        };
      });
      var itRes = await sb.from("receipt_items").insert(itemRows).select("*");
      if (itRes.error) {
        console.warn("[Supabase] createAdminReceiptDraft items insert", itRes.error);
        return { ok: false, error: itRes.error.message || String(itRes.error), receipt_id: receipt.id };
      }
      receipt.items = itRes.data || [];
    } else {
      receipt.items = [];
    }

    return { ok: true, data: receipt };
  }

  async function updateAdminReceiptDraft(receiptId, header, items) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    if (!receiptId) return { ok: false, error: "receipt_id_required" };

    var currentRes = await sb.from("receipts").select("id, status, paid_amount, total_cost").eq("id", receiptId).single();
    if (currentRes.error || !currentRes.data) {
      return { ok: false, error: "Receipt not found: " + receiptId };
    }
    if (currentRes.data.status !== "draft") {
      return { ok: false, error: "Only draft receipts can be modified. Current status: " + currentRes.data.status };
    }

    var cleanItems = (Array.isArray(items) ? items : []).map(function (it) {
      var qty = parseInt(it.quantity, 10);
      var cost = Number(it.unit_cost);
      var sale = it.sale_price != null && it.sale_price !== "" ? Number(it.sale_price) : null;
      return {
        product_id: String(it.product_id || "").trim(),
        quantity: qty,
        unit_cost: isNaN(cost) ? 0 : cost,
        sale_price: sale,
        total_cost: (isNaN(qty) ? 0 : qty) * (isNaN(cost) ? 0 : cost)
      };
    });

    for (var i = 0; i < cleanItems.length; i++) {
      var item = cleanItems[i];
      if (!item.product_id) return { ok: false, error: "Product is required for line " + (i + 1) };
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return { ok: false, error: "Quantity must be an integer greater than 0 for line " + (i + 1) };
      }
      if (item.unit_cost < 0) {
        return { ok: false, error: "Purchase cost cannot be negative for line " + (i + 1) };
      }
    }

    var totalCost = cleanItems.reduce(function (sum, it) { return sum + it.total_cost; }, 0);
    var paidAmount = header.paid_amount != null ? Number(header.paid_amount) : currentRes.data.paid_amount;
    if (paidAmount < 0) return { ok: false, error: "Paid amount cannot be negative" };
    if (paidAmount > totalCost) return { ok: false, error: "Paid amount cannot exceed total cost" };

    var patch = {
      contractor_id: header.contractor_id,
      warehouse_id: header.warehouse_id,
      received_at: header.received_at,
      external_order_number: header.external_order_number ? String(header.external_order_number).trim() : null,
      payment_method: header.payment_method || "debt",
      currency: header.currency || "UZS",
      exchange_rate: Number(header.exchange_rate) || 1,
      total_cost: totalCost,
      paid_amount: paidAmount,
      debt_amount: Math.max(totalCost - paidAmount, 0),
      description: header.description ? String(header.description).trim() : null,
      updated_at: new Date().toISOString()
    };

    var uRes = await sb.from("receipts").update(patch).eq("id", receiptId).select("*");
    if (uRes.error) {
      console.warn("[Supabase] updateAdminReceiptDraft update header", uRes.error);
      return { ok: false, error: uRes.error.message || String(uRes.error) };
    }

    var delRes = await sb.from("receipt_items").delete().eq("receipt_id", receiptId);
    if (delRes.error) {
      console.warn("[Supabase] updateAdminReceiptDraft delete items", delRes.error);
      return { ok: false, error: delRes.error.message || String(delRes.error) };
    }

    var updatedItems = [];
    if (cleanItems.length > 0) {
      var itemRows = cleanItems.map(function (it) {
        return {
          receipt_id: receiptId,
          product_id: it.product_id,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          total_cost: it.total_cost,
          sale_price: it.sale_price
        };
      });
      var itRes = await sb.from("receipt_items").insert(itemRows).select("*");
      if (itRes.error) {
        console.warn("[Supabase] updateAdminReceiptDraft insert items", itRes.error);
        return { ok: false, error: itRes.error.message || String(itRes.error) };
      }
      updatedItems = itRes.data || [];
    }

    var updatedReceipt = uRes.data && uRes.data[0];
    if (updatedReceipt) updatedReceipt.items = updatedItems;
    return { ok: true, data: updatedReceipt };
  }

  async function postAdminReceipt(receiptId) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    if (!receiptId) return { ok: false, error: "receipt_id_required" };

    var res = await sb.rpc("post_receipt", { p_receipt_id: receiptId });
    if (res.error) {
      console.warn("[Supabase] postAdminReceipt", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, data: res.data };
  }

  async function cancelAdminReceipt(receiptId) {
    var sb = client();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session) return { ok: false, error: "no_session" };
    if (!receiptId) return { ok: false, error: "receipt_id_required" };

    var res = await sb.rpc("cancel_receipt", { p_receipt_id: receiptId });
    if (res.error) {
      console.warn("[Supabase] cancelAdminReceipt", res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    return { ok: true, data: res.data };
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
    fetchPublicPromos: fetchPublicPromos,
    pullAdminPromosRaw: pullAdminPromosRaw,
    pushAdminPromosPayload: pushAdminPromosPayload,
    deleteAdminPromo: deleteAdminPromo,
    uploadAdminAsset: uploadAdminAsset,
    removeAdminAssetsByUrls: removeAdminAssetsByUrls,
    fetchAdminContractors: fetchAdminContractors,
    createAdminContractor: createAdminContractor,
    updateAdminContractor: updateAdminContractor,
    toggleAdminContractorStatus: toggleAdminContractorStatus,
    deleteAdminContractor: deleteAdminContractor,
    importAdminContractorsBatch: importAdminContractorsBatch,
    fetchAdminWarehouses: fetchAdminWarehouses,
    fetchAdminReceipts: fetchAdminReceipts,
    fetchAdminReceiptDetails: fetchAdminReceiptDetails,
    createAdminReceiptDraft: createAdminReceiptDraft,
    updateAdminReceiptDraft: updateAdminReceiptDraft,
    postAdminReceipt: postAdminReceipt,
    cancelAdminReceipt: cancelAdminReceipt
  };
})();
