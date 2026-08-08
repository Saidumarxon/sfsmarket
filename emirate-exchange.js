/**
 * NBU USD sell rate + storefront price (rate × USD × 20% markup).
 */
(function () {
  var CACHE_KEY = "emirate_nbu_usd_sell";
  var CACHE_MS = 60 * 60 * 1000;
  var FALLBACK_RATE = 12120;

  var state = {
    rate: FALLBACK_RATE,
    fetchedAt: 0,
    source: "fallback",
  };

  function parseUsdInput(value) {
    return Number(String(value || "").replace(/\s+/g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0;
  }

  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.rate > 0) {
        state.rate = Number(parsed.rate);
        state.fetchedAt = Number(parsed.fetchedAt) || 0;
        state.source = parsed.source || "cache";
      }
    } catch (_) {}
  }

  function saveCache() {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          rate: state.rate,
          fetchedAt: state.fetchedAt,
          source: state.source,
        })
      );
    } catch (_) {}
  }

  loadCache();

  function getNbuUsdSellRate() {
    return Number(state.rate) || FALLBACK_RATE;
  }

  function getNbuRateMeta() {
    return {
      rate: getNbuUsdSellRate(),
      fetchedAt: state.fetchedAt,
      source: state.source,
    };
  }

  async function refreshNbuUsdSellRate(force) {
    var now = Date.now();
    if (!force && state.fetchedAt && now - state.fetchedAt < CACHE_MS) {
      return { ok: true, rate: getNbuUsdSellRate(), cached: true, source: state.source };
    }

    try {
      var apiBase = String(window.emirateApiBase || "").replace(/\/+$/, "");
      var apiPath = "/api/nbu-usd-sell";
      var res = await fetch(apiBase ? apiBase + apiPath : apiPath);
      var data = await res.json();
      if (data && data.ok && data.rate > 0) {
        state.rate = Number(data.rate);
        state.fetchedAt = now;
        state.source = data.source || "nbu.uz";
        saveCache();
        return { ok: true, rate: state.rate, cached: false, source: state.source };
      }
    } catch (err) {
      console.warn("[NBU] rate fetch", err);
    }

    if (state.fetchedAt) {
      return { ok: true, rate: getNbuUsdSellRate(), cached: true, source: state.source, stale: true };
    }

    state.rate = FALLBACK_RATE;
    state.source = "fallback";
    return { ok: false, rate: FALLBACK_RATE, error: "nbu_rate_unavailable" };
  }

  function usdToBaseUzs(usd) {
    return Math.round(parseUsdInput(usd) * getNbuUsdSellRate());
  }

  function roundCharmPrice(amount) {
    if (window.emirateSupabaseApi && typeof window.emirateSupabaseApi.roundCharmPrice === "function") {
      return window.emirateSupabaseApi.roundCharmPrice(amount);
    }
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

  function parseMoneyLocal(text) {
    if (window.emirateSupabaseApi && window.emirateSupabaseApi.parseMoneyText) {
      return window.emirateSupabaseApi.parseMoneyText(text);
    }
    return Number(String(text || "").replace(/\s+/g, "").replace(/[^\d]/g, "")) || 0;
  }

  function resolveStorefrontPricesFromProduct(item) {
    var markup = window.emirateSupabaseApi?.applyStorefrontMarkupToPrices;
    var applyMarkup = markup || function (base, oldBase) {
      var baseNum = Number(base) || 0;
      var oldNum = Number(oldBase) || 0;
      if (baseNum <= 0) return { price: 0, oldPrice: 0 };
      var price = roundCharmPrice(Math.round(baseNum * 1.2));
      var oldPrice = oldNum > 0 ? roundCharmPrice(Math.round(oldNum * 1.2)) : price;
      if (oldPrice < price) oldPrice = price;
      return { price: price, oldPrice: oldPrice };
    };

    var priceUsd = parseUsdInput(item && (item.priceUsd != null ? item.priceUsd : item.price_usd));
    if (priceUsd > 0) {
      var oldUsd = parseUsdInput(item && (item.oldPriceUsd != null ? item.oldPriceUsd : item.old_price_usd));
      var base = usdToBaseUzs(priceUsd);
      var oldBase = oldUsd > 0 ? usdToBaseUzs(oldUsd) : base;
      var computed = applyMarkup(base, oldBase);
      // Explicit final vitrina UZS (admin edited / auto-filled). Legacy rows without the flag keep live USD calc.
      var overridePrice = parseMoneyLocal(item && item.price);
      if (item && item.priceIsStorefront && overridePrice > 0) {
        var overrideOld = parseMoneyLocal(item && item.oldPrice);
        var finalPrice = roundCharmPrice(overridePrice);
        var finalOld = overrideOld > 0 ? roundCharmPrice(overrideOld) : finalPrice;
        if (finalOld < finalPrice) finalOld = finalPrice;
        return { price: finalPrice, oldPrice: finalOld };
      }
      return computed;
    }

    var raw = parseMoneyLocal(item && item.price);
    var rawOld = parseMoneyLocal(item && item.oldPrice) || raw;
    return applyMarkup(raw, rawOld);
  }

  function formatUzs(amount) {
    return (Number(amount) || 0).toLocaleString("ru-RU") + " сум";
  }

  function previewStorefrontFromUsd(priceUsd, oldPriceUsd) {
    var base = usdToBaseUzs(priceUsd);
    var oldBase = parseUsdInput(oldPriceUsd) > 0 ? usdToBaseUzs(oldPriceUsd) : base;
    var rawMarked = Math.round(base * 1.2);
    var rawOldMarked = oldBase > 0 ? Math.round(oldBase * 1.2) : rawMarked;
    var marked = resolveStorefrontPricesFromProduct({
      priceUsd: priceUsd,
      oldPriceUsd: oldPriceUsd,
    });
    return {
      base: base,
      oldBase: oldBase,
      rawMarked: rawMarked,
      rawOldMarked: rawOldMarked,
      price: marked.price,
      oldPrice: marked.oldPrice,
      rate: getNbuUsdSellRate(),
    };
  }

  window.emirateExchange = {
    getNbuUsdSellRate: getNbuUsdSellRate,
    getNbuRateMeta: getNbuRateMeta,
    refreshNbuUsdSellRate: refreshNbuUsdSellRate,
    parseUsdInput: parseUsdInput,
    usdToBaseUzs: usdToBaseUzs,
    roundCharmPrice: roundCharmPrice,
    resolveStorefrontPricesFromProduct: resolveStorefrontPricesFromProduct,
    previewStorefrontFromUsd: previewStorefrontFromUsd,
    formatUzs: formatUzs,
  };

  void refreshNbuUsdSellRate(false);
})();
