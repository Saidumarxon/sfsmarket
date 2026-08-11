/* ========================================
   EMIRATE CO — Catalog Page v2
   ======================================== */

const catalogProducts = [];
const ADMIN_PRODUCTS_KEY = "emirate_admin_products";
const SELECTED_PRODUCT_KEY = "emirate_selected_product";

const productsGridEl = document.getElementById("catalogProductsGrid");
const totalProductsEl = document.getElementById("totalProducts");
const sortSelectEl = document.getElementById("sortSelect");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");
const minPriceEl = document.getElementById("minPrice");
const maxPriceEl = document.getElementById("maxPrice");
const pageTitleEl = document.getElementById("catalogDefaultTitle");
const pageStatsEl = document.querySelector(".catalog-head p");
const foundLabelEl = pageStatsEl?.querySelector("[data-i18n='catalog.foundLabel']");
const foundSuffixEl = pageStatsEl?.querySelector("[data-i18n='catalog.found']");
const breadCatalogEl = document.querySelector(".breadcrumbs [data-i18n='catalog.breadCatalog']");
const filtersCardEl = document.querySelector(".filters-card");
const toolbarEl = document.querySelector(".catalog-toolbar");
const catalogLayoutEl = document.querySelector(".catalog-layout");
const viewedSectionEl = document.getElementById("viewedSection");
const viewedProductsGridEl = document.getElementById("viewedProductsGrid");
const cartSummaryCardEl = document.getElementById("cartSummaryCard");
const cartSummaryCountEl = document.getElementById("cartSummaryCount");
const cartSummarySubtotalEl = document.getElementById("cartSummarySubtotal");
const cartSummaryDiscountEl = document.getElementById("cartSummaryDiscount");
const cartSummaryTotalEl = document.getElementById("cartSummaryTotal");
const proceedCheckoutBtn = document.getElementById("proceedCheckoutBtn");
const clearCartBtn = document.getElementById("clearCartBtn");
const isFavoritesMode = new URLSearchParams(window.location.search).get("favorites") === "1";
const isCartMode = new URLSearchParams(window.location.search).get("cart") === "1";
const isPhotoSearchMode = new URLSearchParams(window.location.search).get("photo") === "1";
const textSearchQuery = (new URLSearchParams(window.location.search).get("q") || "").trim().toLowerCase();
const categoryFilter = (new URLSearchParams(window.location.search).get("category") || "").trim();
const catalogFilterRaw = (new URLSearchParams(window.location.search).get("catalog") || "").trim();
const brandFilterRaw = (new URLSearchParams(window.location.search).get("brand") || "").trim();
let activeStoreCatalog = catalogFilterRaw
  ? window.emirateCatalogs?.getCatalogBySlug?.(catalogFilterRaw) || null
  : null;
let catalogLinkedCategoryNames = [];

function refreshCatalogLinkedCategories() {
  if (!activeStoreCatalog || !window.emirateCatalogs?.getLinkedCategoryNames) {
    catalogLinkedCategoryNames = [];
    return;
  }
  const categories =
    window.emirateCatalogs.loadAdminCategoriesForResolve?.() || [];
  catalogLinkedCategoryNames = window.emirateCatalogs.getLinkedCategoryNames(
    activeStoreCatalog,
    categories
  );
}
refreshCatalogLinkedCategories();
const brandFilterBrand = window.emirateBrands?.resolveBrandFilterParam?.(brandFilterRaw) || null;
const brandFilter = brandFilterBrand?.nameRu || brandFilterRaw;
let photoSearchList = null;
let photoSearchLoading = false;
let photoSearchError = "";

function normalizeTitleKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/gb\b/g, "")
    .replace(/[^a-zа-я0-9]+/gi, "");
}

function loadAdminProductsForCatalog() {
  if (window.emirateSupabaseApi?.isConfigured?.()) {
    return [];
  }
  try {
    const raw = localStorage.getItem(ADMIN_PRODUCTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.status !== "inactive")
      .map((item) => {
        const marked = applyStorefrontPrices(item);
        const uploadedPhotos = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
        const media = window.emirateResolveProductMedia?.({
          title: item.nameRu || item.nameUz || "Товар",
          sku: item.id || "",
          brand: item.brand || "",
          category: item.category || "Аксессуары",
          photos: uploadedPhotos,
          image: uploadedPhotos[0] || ""
        }) || { image: uploadedPhotos[0] || "", photos: uploadedPhotos };
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
        reviewItems: Array.isArray(item.reviewItems) ? item.reviewItems : [],
        badge: item.promo === "yes" ? "sale" : (item.express === "yes" ? "hit" : "new"),
        image: media.image,
        photos: media.photos,
        descUz: String(item.descUz || "").trim(),
        descRu: String(item.descRu || "").trim(),
        specs: Array.isArray(item.specs)
          ? item.specs
              .map((spec) => ({
                keyRu: String(spec?.keyRu || spec?.key || "").trim(),
                keyUz: String(spec?.keyUz || "").trim(),
                valueRu: String(spec?.valueRu || spec?.value || "").trim(),
                valueUz: String(spec?.valueUz || "").trim(),
                key: String(spec?.keyRu || spec?.keyUz || spec?.key || "").trim(),
                value: String(spec?.valueRu || spec?.valueUz || spec?.value || "").trim()
              }))
              .filter((spec) => (spec.keyRu || spec.keyUz || spec.key) && (spec.valueRu || spec.valueUz || spec.value))
          : [],
        colors: Array.isArray(item.colors)
          ? item.colors
              .map((variant, index) => ({
                id: String(variant?.id || `color_${item.id || "p"}_${index}`),
                nameRu: String(variant?.nameRu || variant?.name || "").trim(),
                nameUz: String(variant?.nameUz || "").trim(),
                name: String(variant?.nameRu || variant?.nameUz || variant?.name || "").trim(),
                status: variant?.status === "inactive" ? "inactive" : "active",
                swatch: String(variant?.swatch || "").trim(),
                photos: Array.isArray(variant?.photos) ? variant.photos.filter(Boolean) : []
              }))
              .filter((variant) => variant.name)
          : [],
        colorMeta: {
          nameRu: String(item.colorMeta?.nameRu || "Цвет").trim() || "Цвет",
          nameUz: String(item.colorMeta?.nameUz || "rang").trim() || "rang",
          status: item.colorMeta?.status === "inactive" ? "inactive" : "active",
          type: item.colorMeta?.type === "text" ? "text" : "image"
        },
        memoryVariants: Array.isArray(item.memoryVariants) ? item.memoryVariants : [],
        memoryMeta: item.memoryMeta && typeof item.memoryMeta === "object"
          ? item.memoryMeta
          : { nameRu: "Память", nameUz: "Xotira", status: "active" },
        installmentStatus: item.installmentStatus === "inactive" ? "inactive" : "active",
        express: item.express === "yes" ? "yes" : "no",
        priority: Number(item.priority) || 300
      };
      });
  } catch (_) {
    return [];
  }
}

function mergeProductIntoList(merged, byKey, item) {
  const key = normalizeTitleKey(item.title);
  const existingIndex = byKey.get(key);
  if (existingIndex === undefined) {
    byKey.set(key, merged.length);
    merged.push(item);
    return;
  }
  merged[existingIndex] = {
    ...merged[existingIndex],
    ...item
  };
}

function buildSourceProducts(remoteList) {
  const merged = [];
  const byKey = new Map();
  const remote = Array.isArray(remoteList) ? remoteList : [];
  if (remote.length) {
    remote.forEach((item) => mergeProductIntoList(merged, byKey, item));
  } else {
    loadAdminProductsForCatalog().forEach((item) => mergeProductIntoList(merged, byKey, item));
    catalogProducts.forEach((item) => mergeProductIntoList(merged, byKey, item));
  }
  return merged.sort((a, b) => (Number(a.priority) || 300) - (Number(b.priority) || 300));
}

let sourceProducts = buildSourceProducts([]);

window.emirateLookupProduct = (title) => sourceProducts.find((item) => item.title === title);

function money(value) {
  return value.toLocaleString("ru-RU") + " сум";
}

function parseMoneyText(text) {
  return Number(String(text || "").replace(/\s+/g, "").replace(/[^\d]/g, "")) || 0;
}

function applyStorefrontPrices(itemOrPrice, oldPriceMaybe) {
  if (typeof itemOrPrice === "object" && itemOrPrice) {
    if (window.emirateExchange?.resolveStorefrontPricesFromProduct) {
      return window.emirateExchange.resolveStorefrontPricesFromProduct(itemOrPrice);
    }
    const row = itemOrPrice;
    itemOrPrice = parseMoneyText(row.price);
    oldPriceMaybe = parseMoneyText(row.oldPrice) || itemOrPrice;
  }
  if (window.emirateSupabaseApi?.applyStorefrontMarkupToPrices) {
    return window.emirateSupabaseApi.applyStorefrontMarkupToPrices(itemOrPrice, oldPriceMaybe);
  }
  const base = Number(itemOrPrice) || 0;
  const oldBase = Number(oldPriceMaybe) || 0;
  if (base <= 0) return { price: 0, oldPrice: 0 };
  const markedPrice = Math.round(base * 1.2);
  const markedOld = oldBase > 0 ? Math.round(oldBase * 1.2) : markedPrice;
  return { price: markedPrice, oldPrice: Math.max(markedOld, markedPrice) };
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value) {
  return escapeHtmlAttr(value);
}

function renderProduct(product, options = {}) {
  const productHref = window.emirateProductHref
    ? window.emirateProductHref(product.title)
    : `product.html?product=${encodeURIComponent(product.title)}`;
  const cartControls = options.cartControls === true;
  const productId = product.title;
  const safeProductId = escapeHtmlAttr(productId);
  const isFavorite = window.emirateIsFavorite?.(productId) === true;
  const cartQty = Math.max(1, Number(product.qty) || 1);
  const installment = Math.round(product.price / 12);
  const discount = Math.round((1 - product.price / product.oldPrice) * 100);
  const lang = typeof window.emirateLang === "function" ? window.emirateLang() : "ru";
  const ratingHtml = window.emirateProductRatingHtml?.(product, lang) || "";

  const discountText = Number.isFinite(discount) && discount > 0 ? `-${discount}%` : "";
  const matchPct =
    options.matchScore != null && Number.isFinite(options.matchScore)
      ? Math.round(options.matchScore * 100)
      : null;
  const matchBadge =
    matchPct != null
      ? `<span class="badge-match" title="${typeof window.emirateT === "function" ? window.emirateT("photo.match") : "Совпадение"}">${matchPct}%</span>`
      : "";
  const badgeHTML = [matchBadge, discountText ? `<span class="badge-sale">${discountText}</span>` : ""]
    .filter(Boolean)
    .join("");

  const media = window.emirateResolveProductMedia?.(product) || {
    image: product.image,
    photos: product.photos || []
  };
  const imageHtml = media.image
    ? `<img class="product-image-real" src="${escapeHtmlAttr(media.image)}" alt="${escapeHtmlAttr(product.title)}" loading="lazy" decoding="async">`
    : `<div class="product-image-placeholder">
            <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            Фото
          </div>`;

  return `
    <article class="product-card" data-product-id="${safeProductId}">
      <div class="product-card-top">
        <div class="product-image">
          <div class="product-badges">${badgeHTML}</div>
          <button class="wishlist-btn ${isFavorite ? "active" : ""}" type="button" title="В избранное" data-product-id="${safeProductId}">
            <svg width="18" height="18" fill="${isFavorite ? "#ef4444" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
          ${imageHtml}
        </div>
      </div>
      <h3 class="product-title"><a class="product-link" href="${productHref}">${product.title}</a></h3>
      ${ratingHtml ? `<div class="product-rating">${ratingHtml}</div>` : ""}
      ${window.emirateProductPriceHtml?.(product.price, product.oldPrice) || ""}
      ${window.emirateProductInstallmentHtml?.(product, installment) || ""}
      ${
        cartControls
          ? `
          <div class="product-actions">
            <div class="cart-item-controls" data-product-id="${safeProductId}">
              <button class="cart-qty-btn" type="button" data-action="decrease" aria-label="Уменьшить">-</button>
              <span class="cart-qty-value">${cartQty}</span>
              <button class="cart-qty-btn" type="button" data-action="increase" aria-label="Увеличить">+</button>
              <button class="cart-remove-btn" type="button">Удалить</button>
            </div>
          </div>
        `
          : window.emirateProductActionsHtml?.(productHref, safeProductId) || ""
      }
    </article>
  `;
}

function productWord(count) {
  if (document.documentElement.lang === "uz") {
    return window.emirateT?.("catalog.productWordUz") || "ta mahsulot";
  }
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "товаров";
  if (n1 > 1 && n1 < 5) return "товара";
  if (n1 === 1) return "товар";
  return "товаров";
}

function syncCatalogPageLabels() {
  if (isFavoritesMode) {
    if (pageTitleEl) {
      pageTitleEl.removeAttribute("data-i18n");
      pageTitleEl.textContent = window.emirateT?.("catalog.favoritesTitle") || "Избранное";
    }
    if (breadCatalogEl) {
      breadCatalogEl.removeAttribute("data-i18n");
      breadCatalogEl.textContent = window.emirateT?.("catalog.breadFavorites") || "Избранное";
    }
    return;
  }
  if (isCartMode) {
    if (pageTitleEl) {
      pageTitleEl.removeAttribute("data-i18n");
      pageTitleEl.textContent = window.emirateT?.("cart.title") || "Корзина";
    }
    if (breadCatalogEl) {
      breadCatalogEl.removeAttribute("data-i18n");
      breadCatalogEl.textContent = window.emirateT?.("catalog.breadCart") || "Корзина";
    }
    return;
  }
  if (isPhotoSearchMode) {
    if (pageTitleEl) {
      pageTitleEl.removeAttribute("data-i18n");
      pageTitleEl.textContent = window.emirateT?.("photo.pageTitle") || "Результаты поиска по фото";
    }
    return;
  }
  if (textSearchQuery && pageTitleEl && !categoryFilter) {
    pageTitleEl.removeAttribute("data-i18n");
    pageTitleEl.textContent =
      (window.emirateT?.("catalog.searchTitle") || "Поиск") + ": " + textSearchQuery;
    return;
  }
  if (categoryFilter && pageTitleEl) {
    pageTitleEl.removeAttribute("data-i18n");
    pageTitleEl.textContent = categoryFilter;
  }
}

function buildFallbackProductFromCard(card) {
  const title = card?.querySelector(".product-title")?.textContent?.trim() || "";
  if (!title) return null;
  return {
    title,
    brand: title.split(" ")[0] || "",
    category: "",
    price: parseMoneyText(card?.querySelector(".product-price")?.textContent),
    oldPrice: parseMoneyText(card?.querySelector(".product-old-price")?.textContent),
    rating: Number(card?.querySelector(".product-rating-num")?.textContent || 0) || 0,
    reviews: Number((card?.querySelector(".product-reviews")?.textContent || "").replace(/[^\d]/g, "")) || 0,
    badge: ""
  };
}

function updateCatalogHeadCount(count) {
  if (!totalProductsEl) return;
  totalProductsEl.textContent = String(count);
  if (!foundLabelEl || !foundSuffixEl) return;
  if (isFavoritesMode) {
    foundLabelEl.textContent = window.emirateT?.("catalog.favoritesIn") || "В избранном";
    foundSuffixEl.textContent = productWord(count);
    return;
  }
  if (isCartMode) {
    foundLabelEl.textContent = window.emirateT?.("catalog.cartIn") || "В корзине";
    foundSuffixEl.textContent = productWord(count);
    return;
  }
  if (isPhotoSearchMode) {
    foundLabelEl.textContent = window.emirateT?.("photo.foundPrefix") || "Найдено";
    foundSuffixEl.textContent = window.emirateT?.("photo.foundSuffix") || "похожих";
    return;
  }
  foundLabelEl.textContent = window.emirateT?.("catalog.foundLabel") || "Найдено";
  foundSuffixEl.textContent = productWord(count);
}

function renderViewedProducts() {
  if (!viewedSectionEl || !viewedProductsGridEl) return;
  if (!isFavoritesMode && !isCartMode) {
    viewedSectionEl.hidden = true;
    viewedProductsGridEl.innerHTML = "";
    return;
  }

  const excludedTitles = new Set((window.emirateGetCartItems?.() || []).map((item) => item.title));
  const viewed = (window.emirateGetViewedProducts?.() || [])
    .filter((item) => item && item.title)
    .filter((item) => !excludedTitles.has(item.title))
    .filter((item) => !window.emirateIsFavorite?.(item.title))
    .slice(0, 10);

  if (!viewed.length) {
    viewedSectionEl.hidden = true;
    viewedProductsGridEl.innerHTML = "";
    return;
  }

  viewedProductsGridEl.innerHTML = viewed.map((item) => renderProduct(item, { cartControls: false })).join("");
  window.emirateSyncFavoritesUI?.(viewedProductsGridEl);
  viewedSectionEl.hidden = false;
}

function getCartTotals() {
  const items = window.emirateGetCartItems?.() || [];
  const subtotal = items.reduce((sum, item) => sum + (item.oldPrice || item.price || 0) * (item.qty || 1), 0);
  const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);
  const discount = Math.max(0, subtotal - total);
  const count = items.reduce((sum, item) => sum + (item.qty || 1), 0);
  return { items, subtotal, total, discount, count };
}

function renderCartPanels() {
  if (!isCartMode) return;
  const { subtotal, total, discount, count } = getCartTotals();
  document.body.classList.toggle("cart-empty-mode", count === 0);
  if (cartSummaryCardEl) {
    cartSummaryCardEl.hidden = count === 0;
  }
  if (cartSummaryCountEl) cartSummaryCountEl.textContent = String(count);
  if (cartSummarySubtotalEl) cartSummarySubtotalEl.textContent = money(subtotal);
  if (cartSummaryDiscountEl) cartSummaryDiscountEl.textContent = `-${money(discount)}`;
  if (cartSummaryTotalEl) cartSummaryTotalEl.textContent = money(total);
}

function getCheckedValues(selector) {
  return Array.from(document.querySelectorAll(selector))
    .filter(x => x.checked)
    .map(x => x.value);
}

function matchesTextSearch(product) {
  if (!textSearchQuery) return true;
  const haystack = [product.title, product.brand, product.category, product.sku]
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
  return haystack.includes(textSearchQuery);
}

function applyFiltersAndSort() {
  const categories = getCheckedValues(".filter-category");
  const brands = getCheckedValues(".filter-brand");
  const ratings = getCheckedValues(".filter-rating").map(Number);
  const min = minPriceEl?.value ? Number(minPriceEl.value) : null;
  const max = maxPriceEl?.value ? Number(maxPriceEl.value) : null;
  const sort = sortSelectEl?.value || "popular";

  let list;

  if (isPhotoSearchMode) {
    if (photoSearchLoading) {
      if (productsGridEl) {
        productsGridEl.innerHTML = renderPhotoSearchLoadingHtml();
      }
      updateCatalogHeadCount(0);
      return;
    }
    list = Array.isArray(photoSearchList) ? photoSearchList : [];
  } else {
    list = isCartMode
      ? (window.emirateGetCartItems?.() || [])
      : sourceProducts.filter(p => {
          if (!matchesTextSearch(p)) return false;
          if (catalogLinkedCategoryNames.length) {
            if (!catalogLinkedCategoryNames.includes(String(p.category || "").trim())) return false;
          } else if (categories.length && !categories.includes(p.category)) {
            return false;
          }
          if (brands.length && !brands.includes(p.brand)) return false;
          if (min !== null && p.price < min) return false;
          if (max !== null && p.price > max) return false;
          if (ratings.length && !ratings.some(r => p.rating >= r)) return false;
          return true;
        });
  }

  if (isFavoritesMode) {
    list = list.filter((p) => window.emirateIsFavorite?.(p.title) === true);
  }

  if (!isPhotoSearchMode) {
    if (sort === "price_asc") list.sort((a, b) => a.price - b.price);
    if (sort === "price_desc") list.sort((a, b) => b.price - a.price);
    if (sort === "rating_desc") list.sort((a, b) => b.rating - a.rating);
  }

  if (productsGridEl) {
    productsGridEl.innerHTML = list.length
      ? list.map((item) =>
          renderProduct(item, {
            cartControls: isCartMode,
            matchScore: item._matchScore
          })
        ).join("")
      : `<div class="catalog-empty">
          <svg width="48" height="48" fill="none" stroke="#94a3b8" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <p>${
            isPhotoSearchMode
              ? photoSearchError || (window.emirateT?.("photo.empty") || "Похожие товары не найдены")
              : isFavoritesMode
                ? (window.emirateT?.("catalog.favoritesEmpty") || "В избранном пока пусто")
                : isCartMode
                  ? (window.emirateT?.("catalog.cartEmpty") || "Корзина пока пуста")
                  : textSearchQuery
                    ? (window.emirateT?.("catalog.searchNotFound") || "Ничего не найдено")
                    : (window.emirateT?.("catalog.notFound") || "Товары не найдены")
          }</p>
          <span>${
            isPhotoSearchMode
              ? (window.emirateT?.("photo.emptyHint") || "Попробуйте другое фото")
              : isFavoritesMode
                ? (window.emirateT?.("catalog.favoritesEmptyHint") || "Добавьте товары, нажимая на сердечко")
                : isCartMode
                  ? (window.emirateT?.("catalog.cartEmptyHint") || "Добавьте товары из каталога")
                  : textSearchQuery
                    ? (window.emirateT?.("catalog.searchNotFoundHint") || "Измените запрос или сбросьте фильтры")
                    : (window.emirateT?.("catalog.notFoundHint") || "Попробуйте изменить фильтры")
          }</span>
          ${isCartMode ? '<a class="btn-primary cart-empty-home-btn" href="catalog.html">' + (window.emirateT?.("cart.goShopping") || "Перейти в каталог") + "</a>" : ""}
          ${isPhotoSearchMode ? '<button type="button" class="btn-primary photo-empty-retry-btn" id="photoSearchRetry">' + (window.emirateT?.("photo.change") || "Другое фото") + "</button>" : ""}
        </div>`;
    window.emirateSyncFavoritesUI?.(productsGridEl);
    productsGridEl.querySelector("#photoSearchRetry")?.addEventListener("click", () => {
      document.querySelector(".search-photo-btn")?.click();
    });
  }
  updateCatalogHeadCount(list.length);
  updateSeoCatalogLinks(isPhotoSearchMode || isCartMode || isFavoritesMode ? [] : list);
  renderCartPanels();
  renderViewedProducts();
}

function updateSeoCatalogLinks(list) {
  const el = document.getElementById("seoCatalogLinks");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = list
    .slice(0, 200)
    .map(
      (product) =>
        '<a href="' +
        (window.emirateProductHref ? window.emirateProductHref(product.title) : "product.html?product=" + encodeURIComponent(product.title)) +
        '">' +
        escapeHtmlAttr(product.title) +
        "</a>"
    )
    .join("");
}

function syncCatalogSeoMeta() {
  if (!window.emirateApplySeo) return;
  if (isPhotoSearchMode || isCartMode || isFavoritesMode || textSearchQuery) {
    window.emirateApplySeo({
      title: document.title,
      description: "Emirate Co",
      path: window.location.pathname + window.location.search,
      noindex: true,
    });
    return;
  }
  if (categoryFilter) {
    window.emirateApplySeo({
      title: categoryFilter + " — каталог Emirate Co",
      description:
        "Купить " +
        categoryFilter +
        " в Emirate Co. Доставка по Узбекистану, рассрочка, гарантия.",
      path: "/catalog?category=" + encodeURIComponent(categoryFilter),
    });
    return;
  }
  window.emirateApplySeo({
    title: "Каталог товаров — Emirate Co",
    description:
      "Каталог Emirate Co: смартфоны, ноутбуки, телевизоры, аудио и бытовая техника с доставкой по Узбекистану.",
    path: "/catalog",
  });
}

function renderPhotoSearchLoadingHtml() {
  const label = window.emirateT?.("photo.searching") || "Ищем похожие товары…";
  return (
    '<div class="photo-search-loading">' +
      '<div class="photo-search-spinner" aria-hidden="true"></div>' +
      '<p>' + label + "</p>" +
      '<span class="photo-search-progress" id="photoSearchProgress"></span>' +
    "</div>"
  );
}

function ensurePhotoSearchBanner() {
  if (!isPhotoSearchMode || document.getElementById("photoSearchBanner")) return;
  const head = document.querySelector(".catalog-head");
  if (!head) return;
  const queryImg =
    window.emirateImageSearch?.loadQueryImage?.() ||
    sessionStorage.getItem("emirate_photo_search_query") ||
    "";
  const banner = document.createElement("div");
  banner.id = "photoSearchBanner";
  banner.className = "photo-search-banner";
  banner.innerHTML =
    (queryImg ? '<img class="photo-search-banner-img" src="' + queryImg.replace(/"/g, "&quot;") + '" alt="">' : "") +
    '<div class="photo-search-banner-text">' +
      '<p class="photo-search-banner-label">' + (window.emirateT?.("photo.pageTitle") || "Результаты поиска по фото") + "</p>" +
      '<button type="button" class="photo-search-banner-change" id="photoSearchChange">' +
        (window.emirateT?.("photo.change") || "Другое фото") +
      "</button>" +
    "</div>";
  head.appendChild(banner);
  banner.querySelector("#photoSearchChange")?.addEventListener("click", () => {
    document.querySelector(".search-photo-btn")?.click();
  });
}

async function loadImageSearchScript() {
  if (window.emirateImageSearch) return window.emirateImageSearch;
  await new Promise((resolve, reject) => {
    if (document.querySelector('script[src="emirate-image-search.js"]')) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "emirate-image-search.js";
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
  return window.emirateImageSearch;
}

async function runPhotoSearch() {
  if (!isPhotoSearchMode) return;
  photoSearchLoading = true;
  photoSearchError = "";
  applyFiltersAndSort();

  const api = await loadImageSearchScript();
  ensurePhotoSearchBanner();
  const queryData = api.loadQueryImage();
  if (!queryData) {
    photoSearchLoading = false;
    photoSearchError = window.emirateT?.("photo.noImage") || "Изображение не найдено";
    photoSearchList = [];
    applyFiltersAndSort();
    return;
  }

  if (!sourceProducts.length) {
    photoSearchLoading = false;
    photoSearchError = window.emirateT?.("photo.empty") || "Каталог пуст";
    photoSearchList = [];
    applyFiltersAndSort();
    return;
  }

  try {
    if (api.assertPhotoSearchAllowed) {
      api.assertPhotoSearchAllowed();
    }
    const progressEl = document.getElementById("photoSearchProgress");
    if (progressEl) {
      progressEl.textContent = window.emirateT?.("photo.aiAnalyzing") || "AI анализирует фото…";
    }
    const results = await api.searchProducts(queryData, sourceProducts, {
      onProgress(done, total) {
        if (progressEl) {
          if (total <= 1) {
            progressEl.textContent = window.emirateT?.("photo.aiAnalyzing") || "AI анализирует фото…";
          } else {
            progressEl.textContent =
              (window.emirateT?.("photo.progress") || "Анализ каталога") + ": " + done + " / " + total;
          }
        }
      }
    });
    photoSearchList = results.map((entry) => ({
      ...entry.product,
      _matchScore: entry.score,
      _matchSource: entry.source || "local"
    }));
    if (!photoSearchList.length) {
      photoSearchError = window.emirateT?.("photo.empty") || "Похожие товары не найдены";
    }
  } catch (err) {
    console.warn("[photo-search]", err);
    photoSearchList = [];
    if (String(err && err.message) === "rate_limit_exceeded") {
      const quota = api.getPhotoSearchQuota?.() || { retryAfterSec: 0 };
      const time = api.formatPhotoSearchRetry
        ? api.formatPhotoSearchRetry(quota.retryAfterSec)
        : String(quota.retryAfterSec || 0);
      photoSearchError =
        (window.emirateT?.("photo.quotaWait") || "Лимит исчерпан. Попробуйте через {time}").replace("{time}", time);
    } else {
      photoSearchError =
        window.emirateT?.("photo.engineError") ||
        "Не удалось запустить поиск по фото. Проверьте интернет и попробуйте снова.";
    }
  } finally {
    photoSearchLoading = false;
    applyFiltersAndSort();
  }
}

window.addEventListener("emirate:data-updated", function (event) {
  var key = event && event.detail && event.detail.key;
  if (key !== "products") return;
  refreshCatalogFromRemote().then(function () {
    applyFiltersAndSort();
  });
});

async function refreshCatalogFromRemote() {
  const api = window.emirateSupabaseApi;
  if (!api || !api.isConfigured()) return;
  try {
    const remote = await api.fetchPublicCatalogProducts();
    sourceProducts = buildSourceProducts(remote);
  } catch (err) {
    console.warn("[Supabase] catalog", err);
  }
}

function findCartCardByProductId(productId) {
  if (!productsGridEl) return null;
  return Array.from(productsGridEl.querySelectorAll(".product-card")).find(
    (card) => card.getAttribute("data-product-id") === productId
  ) || null;
}

function updateCartItemCard(productId) {
  const card = findCartCardByProductId(productId);
  if (!card) return;
  const item = (window.emirateGetCartItems?.() || []).find((x) => x.title === productId);
  if (!item) {
    card.remove();
    const hasCards = productsGridEl?.querySelector(".product-card");
    if (!hasCards) {
      applyFiltersAndSort();
      return;
    }
  } else {
    const qtyEl = card.querySelector(".cart-qty-value");
    if (qtyEl) qtyEl.textContent = String(Math.max(1, Number(item.qty) || 1));
  }
  renderCartPanels();
  renderViewedProducts();
}

function applyCategoryFilterFromUrl() {
  if (catalogLinkedCategoryNames.length) {
    document.querySelectorAll(".filter-category").forEach((item) => {
      item.checked = catalogLinkedCategoryNames.includes(item.value);
    });
    return;
  }
  if (!categoryFilter || brandFilter) return;
  document.querySelectorAll(".filter-category").forEach((item) => {
    item.checked = item.value === categoryFilter;
  });
  if (pageTitleEl) {
    pageTitleEl.textContent = categoryFilter;
  }
}

function renderCatalogBrandHero() {
  const hero = document.getElementById("catalogBrandHero");
  const defaultTitle = document.getElementById("catalogDefaultTitle");
  if (!hero) return;

  const lang = window.emirateLang?.() || "ru";
  let title = "";
  let imageUrl = "";
  let kicker = "";

  if (activeStoreCatalog) {
    title =
      window.emirateCatalogs?.getCatalogDisplayName?.(activeStoreCatalog, lang) ||
      activeStoreCatalog.nameRu ||
      catalogFilterRaw;
    imageUrl = activeStoreCatalog.imageUrl || "";
    kicker = lang === "uz" ? "Katalog" : "Каталог";
  } else if (brandFilter) {
    const brand = brandFilterBrand || window.emirateBrands?.getBrandByName?.(brandFilter);
    title =
      window.emirateBrands?.getBrandDisplayName?.(brand || { nameRu: brandFilter, nameUz: brandFilter }, lang) ||
      brandFilter;
    imageUrl = brand?.logoUrl || "";
    kicker = lang === "uz" ? "Brend" : "Бренд";
  } else {
    return;
  }

  hero.hidden = false;
  if (defaultTitle) defaultTitle.hidden = true;

  const kickerEl = hero.querySelector(".catalog-brand-hero-kicker");
  if (kickerEl) {
    kickerEl.removeAttribute("data-i18n");
    kickerEl.textContent = kicker;
  }

  const titleEl = document.getElementById("catalogBrandHeroTitle");
  if (titleEl) titleEl.textContent = title;

  const logoEl = document.getElementById("catalogBrandHeroLogo");
  if (logoEl) {
    if (imageUrl) {
      logoEl.src = imageUrl;
      logoEl.alt = title;
      logoEl.hidden = false;
    } else {
      logoEl.hidden = true;
      logoEl.removeAttribute("src");
    }
  }

  const breadCatalogEl = document.querySelector('.breadcrumbs [data-i18n="catalog.breadCatalog"]');
  if (breadCatalogEl) {
    breadCatalogEl.removeAttribute("data-i18n");
    if (activeStoreCatalog) {
      breadCatalogEl.textContent = "";
      const link = document.createElement("a");
      link.href = "catalogs.html";
      link.textContent = lang === "uz" ? "Katalog" : "Каталог";
      breadCatalogEl.appendChild(link);
      breadCatalogEl.appendChild(document.createTextNode(" / " + title));
    } else {
      breadCatalogEl.textContent = title;
    }
  }
}

function renderBrandFilters() {
  const container = document.getElementById("brandFiltersContainer");
  if (!container) return;

  const active = window.emirateBrands?.getActiveBrands?.() || [];
  const known = new Set(active.map((item) => item.nameRu));
  const extras = [...new Set(sourceProducts.map((item) => String(item.brand || "").trim()).filter(Boolean))]
    .filter((name) => !known.has(name))
    .sort((a, b) => a.localeCompare(b, "ru"));

  const selected = getCheckedValues(".filter-brand");
  let html = "";

  active.forEach((brand) => {
    const checked = selected.includes(brand.nameRu) || brandFilter === brand.nameRu ? " checked" : "";
    html += `<label class="filter-label"><input type="checkbox" class="filter-brand" value="${escapeHtml(brand.nameRu)}"${checked}> <span>${escapeHtml(brand.nameRu)}</span></label>`;
  });

  extras.forEach((name) => {
    const checked = selected.includes(name) || brandFilter === name ? " checked" : "";
    html += `<label class="filter-label"><input type="checkbox" class="filter-brand" value="${escapeHtml(name)}"${checked}> <span>${escapeHtml(name)}</span></label>`;
  });

  if (!html) {
    html = '<p class="filter-empty">—</p>';
  }

  container.innerHTML = html;
}

function applyBrandFilterFromUrl() {
  if (activeStoreCatalog || brandFilter) {
    renderCatalogBrandHero();
  }
  if (!brandFilter) return;
  document.querySelectorAll(".filter-brand").forEach((item) => {
    item.checked = item.value === brandFilter;
  });
}

function resetFilters() {
  document.querySelectorAll(".filter-category, .filter-brand, .filter-rating").forEach(item => {
    item.checked = false;
  });
  if (minPriceEl) minPriceEl.value = "";
  if (maxPriceEl) maxPriceEl.value = "";
  if (sortSelectEl) sortSelectEl.value = "popular";
  applyFiltersAndSort();
}

async function initCatalogBrands() {
  if (window.emirateBrands?.refreshPublicBrandsFromRemote) {
    await window.emirateBrands.refreshPublicBrandsFromRemote();
  }
}

function finishCatalogShellMode() {
  const root = document.documentElement;
  if (!root.classList.contains("catalog-shell-loading")) return;
  root.classList.add("catalog-shell-ready");
  window.setTimeout(function () {
    root.classList.remove("catalog-shell-loading", "catalog-shell-ready");
  }, 260);
}

document.addEventListener("DOMContentLoaded", finishCatalogShellMode);
window.setTimeout(finishCatalogShellMode, 600);

// Init
if (isFavoritesMode || isCartMode || isPhotoSearchMode) {
  if (filtersCardEl) filtersCardEl.hidden = true;
  if (toolbarEl) toolbarEl.hidden = true;
  if (catalogLayoutEl) catalogLayoutEl.classList.add("catalog-layout--favorites");
}
if (isFavoritesMode) {
  document.body.classList.add("favorites-mode");
}
if (isCartMode) {
  document.body.classList.add("cart-mode");
}
if (isPhotoSearchMode) {
  document.body.classList.add("photo-search-mode");
}
syncCatalogPageLabels();
if (textSearchQuery && !categoryFilter && !isPhotoSearchMode && !isCartMode && !isFavoritesMode) {
  const searchInput = document.querySelector('.search-bar input[type="search"]');
  if (searchInput) searchInput.value = textSearchQuery;
}

// Warm SWR cache: build and render the catalog synchronously so content is
// part of the first paint (and of the view-transition snapshot). The async
// init below refines it (brands, URL filters, revalidation).
const warmCatalogProducts = window.emirateSupabaseApi?.readCachedProducts?.() || null;
if (Array.isArray(warmCatalogProducts) && warmCatalogProducts.length && !isPhotoSearchMode) {
  sourceProducts = buildSourceProducts(warmCatalogProducts);
  if (!isCartMode && !isFavoritesMode) {
    renderBrandFilters();
    applyCategoryFilterFromUrl();
    applyBrandFilterFromUrl();
  }
  applyFiltersAndSort();
  finishCatalogShellMode();
}

if (isPhotoSearchMode) {
  void (async () => {
    try {
      syncCatalogSeoMeta();
      await refreshCatalogFromRemote();
      await runPhotoSearch();
    } finally {
      finishCatalogShellMode();
    }
  })();
} else if (isCartMode || isFavoritesMode) {
  syncCatalogSeoMeta();
  if (isFavoritesMode && window.emirateSupabaseApi?.isConfigured?.()) {
    void (async () => {
      try {
        await refreshCatalogFromRemote();
        applyFiltersAndSort();
      } finally {
        finishCatalogShellMode();
      }
    })();
  } else {
    applyFiltersAndSort();
    finishCatalogShellMode();
  }
} else {
  syncCatalogSeoMeta();
  void (async () => {
    await initCatalogBrands();
    renderBrandFilters();
    applyCategoryFilterFromUrl();
    applyBrandFilterFromUrl();
    if (window.emirateSupabaseApi?.isConfigured?.()) {
      try {
        await refreshCatalogFromRemote();
        renderBrandFilters();
        applyCategoryFilterFromUrl();
        applyBrandFilterFromUrl();
        applyFiltersAndSort();
      } finally {
        finishCatalogShellMode();
      }
    } else {
      applyFiltersAndSort();
      finishCatalogShellMode();
    }
  })();
}

// Events
applyFiltersBtn?.addEventListener("click", applyFiltersAndSort);
sortSelectEl?.addEventListener("change", applyFiltersAndSort);
resetFiltersBtn?.addEventListener("click", resetFilters);

function onProductGridClick(e) {
  const quickBuyBtn = e.target.closest("button.quick-buy-open");
  if (quickBuyBtn) {
    e.preventDefault();
    e.stopPropagation();
    const card = quickBuyBtn.closest(".product-card");
    const title =
      quickBuyBtn.getAttribute("data-product-title") ||
      card?.getAttribute("data-product-id") ||
      "";
    const source = isCartMode ? (window.emirateGetCartItems?.() || []) : sourceProducts;
    const product =
      (title ? source.find((item) => item.title === title) : null) ||
      buildFallbackProductFromCard(card);
    if (product) {
      window.emirateOpenQuickBuy?.(product, 1);
    }
    return;
  }

  const saveSelectedProduct = (product) => {
    if (!product || typeof product !== "object") return;
    const media = window.emirateResolveProductMedia?.(product);
    const payload = media ? { ...product, image: media.image, photos: media.photos } : product;
    try {
      sessionStorage.setItem(SELECTED_PRODUCT_KEY, JSON.stringify(payload));
    } catch (_) {
      // Ignore storage errors.
    }
  };

  const qtyBtn = e.target.closest(".cart-qty-btn");
  if (qtyBtn && isCartMode) {
    const controls = qtyBtn.closest(".cart-item-controls");
    const productId = controls?.getAttribute("data-product-id");
    if (!productId) return;
    const current = (window.emirateGetCartItems?.() || []).find((item) => item.title === productId);
    const currentQty = Math.max(1, Number(current?.qty) || 1);
    const action = qtyBtn.getAttribute("data-action");
    const nextQty = action === "increase" ? currentQty + 1 : currentQty - 1;
    window.emirateSetCartQty?.(productId, nextQty);
    updateCartItemCard(productId);
    return;
  }

  const removeBtn = e.target.closest(".cart-remove-btn");
  if (removeBtn && isCartMode) {
    const controls = removeBtn.closest(".cart-item-controls");
    const productId = controls?.getAttribute("data-product-id");
    if (!productId) return;
    window.emirateRemoveFromCart?.(productId);
    applyFiltersAndSort();
    return;
  }

  const productLink = e.target.closest(".product-link");
  if (productLink) {
    const card = productLink.closest(".product-card");
    const title = card?.getAttribute("data-product-id");
    const source = isCartMode ? (window.emirateGetCartItems?.() || []) : sourceProducts;
    const product = title ? source.find((item) => item.title === title) : null;
    if (product) {
      window.emirateAddViewedProduct?.(product);
      saveSelectedProduct(product);
    }
  }

  const cartBtn = e.target.closest(".add-to-cart-btn");
  if (cartBtn) {
    const card = cartBtn.closest(".product-card");
    const title = card?.getAttribute("data-product-id");
    const product = (title ? sourceProducts.find((item) => item.title === title) : null) || buildFallbackProductFromCard(card);
    if (product) window.emirateAddToCart?.(product, 1);
    cartBtn.classList.add("added");
    cartBtn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      Добавлено
    `;
    setTimeout(() => {
      cartBtn.classList.remove("added");
      cartBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
        </svg>
        В корзину
      `;
    }, 1500);
    return;
  }

  const wishBtn = e.target.closest(".wishlist-btn");
  if (wishBtn) {
    const productId = wishBtn.getAttribute("data-product-id");
    if (!productId) return;

    const isActive = window.emirateToggleFavorite?.(productId);
    wishBtn.classList.toggle("active", Boolean(isActive));
    const svg = wishBtn.querySelector("svg");
    if (svg) svg.setAttribute("fill", isActive ? "#ef4444" : "none");

    if (isFavoritesMode && !isActive) {
      applyFiltersAndSort();
    } else if (isFavoritesMode) {
      renderViewedProducts();
    }
  }
}

// Add to cart / favorites delegation
productsGridEl?.addEventListener("click", onProductGridClick);
viewedProductsGridEl?.addEventListener("click", onProductGridClick);

proceedCheckoutBtn?.addEventListener("click", () => {
  const { count } = getCartTotals();
  if (!count) return;
  window.location.href = "checkout.html";
});

clearCartBtn?.addEventListener("click", () => {
  window.emirateClearCart?.();
  applyFiltersAndSort();
});

// View toggle
document.querySelectorAll(".view-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

window.emirateSyncCatalogPageLabels = syncCatalogPageLabels;
window.emirateRefreshCatalogView = applyFiltersAndSort;
