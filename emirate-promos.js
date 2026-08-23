/**
 * Shared promo codes for admin + checkout.
 */
(function () {
  var ADMIN_PROMOS_KEY = "emirate_admin_promos_v1";
  var PUBLIC_PROMOS_KEY = "emirate_public_promos_v1";
  var APPLIED_KEY = "emirate_applied_promo";

  function normalizePromoCode(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  }

  function normalizePromoRecord(record) {
    var promo = record || {};
    var code = normalizePromoCode(promo.code);
    var maxUses = Math.round(Number(promo.maxUses));
    var usedCount = Math.round(Number(promo.usedCount));
    return {
      id: String(promo.id || "promo_" + (code || Date.now())).trim(),
      code: code,
      type: promo.type === "percent" ? "percent" : "fixed",
      value: Math.max(0, Number(promo.value) || 0),
      maxUses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : 1,
      usedCount: Number.isFinite(usedCount) && usedCount > 0 ? usedCount : 0,
      isActive: promo.isActive !== false && promo.status !== "inactive",
      updatedAt: promo.updatedAt || new Date().toISOString(),
    };
  }

  function loadPromosData() {
    try {
      var publicRaw = localStorage.getItem(PUBLIC_PROMOS_KEY);
      if (publicRaw) {
        var publicParsed = JSON.parse(publicRaw);
        if (Array.isArray(publicParsed) && publicParsed.length) {
          return publicParsed.map(normalizePromoRecord);
        }
      }
      var raw = localStorage.getItem(ADMIN_PROMOS_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizePromoRecord);
    } catch (_) {
      return [];
    }
  }

  function persistPromosData(promos) {
    localStorage.setItem(ADMIN_PROMOS_KEY, JSON.stringify(promos || []));
    localStorage.setItem(
      PUBLIC_PROMOS_KEY,
      JSON.stringify((promos || []).filter(function (item) { return item.isActive; }))
    );
  }

  function getPromoByCode(code, promos) {
    var key = normalizePromoCode(code);
    if (!key) return null;
    return (promos || loadPromosData()).find(function (item) {
      return normalizePromoCode(item.code) === key;
    }) || null;
  }

  function computeDiscount(promo, subtotal) {
    var sum = Math.max(0, Math.round(Number(subtotal) || 0));
    if (!promo || sum <= 0) return 0;
    var off = promo.type === "percent"
      ? Math.round(sum * (Number(promo.value) || 0) / 100)
      : Math.round(Number(promo.value) || 0);
    if (off < 0) off = 0;
    if (off > sum) off = sum;
    return off;
  }

  function isCustomerRegistered() {
    try {
      var customer = window.emirateAuth && window.emirateAuth.loadCustomer
        ? window.emirateAuth.loadCustomer()
        : null;
      if (customer && (customer.id || customer.phone || customer.email)) return true;
    } catch (_) {}
    return false;
  }

  function authRequiredMessage() {
    var lang = typeof window.emirateLang === "function" ? window.emirateLang() : "ru";
    if (lang === "uz") return "Iltimos, avval ro‘yxatdan o‘ting";
    return "Пожалуйста, сначала зарегистрируйтесь";
  }

  function errorMessage(code) {
    var lang = typeof window.emirateLang === "function" ? window.emirateLang() : "ru";
    var uz = {
      auth_required: "Iltimos, avval ro‘yxatdan o‘ting",
      not_found: "Promokod topilmadi",
      inactive: "Bu promokod o‘chirilgan",
      limit: "Promokod limiti tugagan",
      no_discount: "Bu buyurtmaga chegirma qo‘llanilmaydi",
    };
    var ru = {
      auth_required: "Пожалуйста, сначала зарегистрируйтесь",
      not_found: "Промокод не найден",
      inactive: "Этот промокод отключён",
      limit: "Лимит использований исчерпан",
      no_discount: "Для этого заказа скидка не применяется",
    };
    return (lang === "uz" ? uz : ru)[code] || code;
  }

  function evaluatePromo(code, subtotal, options) {
    var opts = options || {};
    if (!opts.skipAuth && !isCustomerRegistered()) {
      return { ok: false, error: "auth_required", message: authRequiredMessage() };
    }
    var promo = getPromoByCode(code);
    if (!promo) return { ok: false, error: "not_found", message: errorMessage("not_found") };
    if (!promo.isActive) return { ok: false, error: "inactive", message: errorMessage("inactive") };
    if (promo.usedCount >= promo.maxUses) return { ok: false, error: "limit", message: errorMessage("limit") };
    var discount = computeDiscount(promo, subtotal);
    if (discount <= 0) return { ok: false, error: "no_discount", message: errorMessage("no_discount") };
    return {
      ok: true,
      promo: promo,
      discount: discount,
      payable: Math.max(0, Math.round(Number(subtotal) || 0) - discount),
    };
  }

  function getAppliedPromo() {
    try {
      var raw = sessionStorage.getItem(APPLIED_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || !parsed.code) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function setAppliedPromo(payload) {
    if (!payload || !payload.code) {
      sessionStorage.removeItem(APPLIED_KEY);
      return null;
    }
    sessionStorage.setItem(APPLIED_KEY, JSON.stringify(payload));
    return payload;
  }

  function clearAppliedPromo() {
    sessionStorage.removeItem(APPLIED_KEY);
  }

  function applyPromoToSubtotal(code, subtotal) {
    var result = evaluatePromo(code, subtotal);
    if (!result.ok) {
      clearAppliedPromo();
      return result;
    }
    setAppliedPromo({
      code: result.promo.code,
      type: result.promo.type,
      value: result.promo.value,
      discount: result.discount,
    });
    return result;
  }

  function markPromoUsed(code) {
    var list = loadPromosData();
    var key = normalizePromoCode(code);
    var next = list.map(function (item) {
      if (normalizePromoCode(item.code) !== key) return item;
      return normalizePromoRecord({
        ...item,
        usedCount: (Number(item.usedCount) || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
    });
    persistPromosData(next);
    return getPromoByCode(code, next);
  }

  async function refreshPublicPromosFromRemote() {
    if (!window.emirateSupabaseApi || !window.emirateSupabaseApi.fetchPublicPromos) {
      return loadPromosData();
    }
    try {
      var remote = await window.emirateSupabaseApi.fetchPublicPromos();
      if (Array.isArray(remote) && remote.length) {
        var normalized = remote.map(normalizePromoRecord);
        localStorage.setItem(PUBLIC_PROMOS_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch (_) {}
    return loadPromosData();
  }

  window.emiratePromos = {
    ADMIN_PROMOS_KEY: ADMIN_PROMOS_KEY,
    normalizePromoCode: normalizePromoCode,
    normalizePromoRecord: normalizePromoRecord,
    loadPromosData: loadPromosData,
    persistPromosData: persistPromosData,
    getPromoByCode: getPromoByCode,
    computeDiscount: computeDiscount,
    isCustomerRegistered: isCustomerRegistered,
    authRequiredMessage: authRequiredMessage,
    errorMessage: errorMessage,
    evaluatePromo: evaluatePromo,
    getAppliedPromo: getAppliedPromo,
    setAppliedPromo: setAppliedPromo,
    clearAppliedPromo: clearAppliedPromo,
    applyPromoToSubtotal: applyPromoToSubtotal,
    markPromoUsed: markPromoUsed,
    refreshPublicPromosFromRemote: refreshPublicPromosFromRemote,
  };
})();
