/* ========================================
   EMIRATE CO — Catalog Page v2
   ======================================== */

const catalogProducts = [
  { title: "iPhone 15 Pro Max 256GB", brand: "Apple", category: "Смартфоны", price: 15490000, rating: 4.9, reviews: 342, oldPrice: 16900000, badge: "hit" },
  { title: "Samsung Galaxy S24 Ultra 12/256", brand: "Samsung", category: "Смартфоны", price: 14200000, rating: 4.8, reviews: 218, oldPrice: 15500000, badge: "hit" },
  { title: "Xiaomi 14 Ultra 16/512", brand: "Xiaomi", category: "Смартфоны", price: 11800000, rating: 4.7, reviews: 94, oldPrice: 12900000, badge: "sale" },
  { title: 'MacBook Air M3 15" 16/512', brand: "Apple", category: "Ноутбуки", price: 17900000, rating: 4.9, reviews: 156, oldPrice: 19200000, badge: "hit" },
  { title: "ASUS Zenbook 14 OLED UX3405", brand: "ASUS", category: "Ноутбуки", price: 12900000, rating: 4.7, reviews: 67, oldPrice: 13700000, badge: "sale" },
  { title: "Lenovo ThinkPad X1 Carbon Gen 12", brand: "Lenovo", category: "Ноутбуки", price: 18500000, rating: 4.8, reviews: 43, oldPrice: 19800000, badge: "new" },
  { title: 'LG OLED55C4 55" 4K Smart TV', brand: "LG", category: "ТВ", price: 12400000, rating: 4.8, reviews: 73, oldPrice: 13900000, badge: "hit" },
  { title: 'Samsung QLED QE55Q80D 55"', brand: "Samsung", category: "ТВ", price: 9950000, rating: 4.6, reviews: 112, oldPrice: 10850000, badge: "sale" },
  { title: "Sony WH-1000XM5 Wireless", brand: "Sony", category: "Аудио", price: 4250000, rating: 4.8, reviews: 421, oldPrice: 4990000, badge: "hit" },
  { title: "Xiaomi Buds 5 Pro", brand: "Xiaomi", category: "Аудио", price: 1990000, rating: 4.5, reviews: 189, oldPrice: 2350000, badge: "new" },
  { title: "JBL Tour Pro 3", brand: "JBL", category: "Аудио", price: 3200000, rating: 4.7, reviews: 56, oldPrice: 3700000, badge: "new" },
  { title: "Dyson V15 Detect Absolute", brand: "Dyson", category: "Техника", price: 8350000, rating: 4.8, reviews: 195, oldPrice: 9500000, badge: "sale" }
];
const ADMIN_PRODUCTS_KEY = "emirate_admin_products";
const SELECTED_PRODUCT_KEY = "emirate_selected_product";

const productsGridEl = document.getElementById("catalogProductsGrid");
const totalProductsEl = document.getElementById("totalProducts");
const sortSelectEl = document.getElementById("sortSelect");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetFiltersBtn = document.getElementById("resetFilters");
const minPriceEl = document.getElementById("minPrice");
const maxPriceEl = document.getElementById("maxPrice");
const pageTitleEl = document.querySelector(".catalog-head h1");
const pageStatsEl = document.querySelector(".catalog-head p");
const foundPrefixEl = pageStatsEl?.querySelector("[data-i18n='catalog.found']");
const foundSuffixEl = pageStatsEl?.querySelectorAll("[data-i18n='catalog.found']")?.[1] || null;
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
        category: item.category || "Аксессуары",
        price: marked.price,
        oldPrice: marked.oldPrice,
        rating: Number(item.rating || 4.6),
        reviews: Number(item.reviews || 0),
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
  const merged = [...catalogProducts];
  const byKey = new Map(merged.map((item, index) => [normalizeTitleKey(item.title), index]));
  loadAdminProductsForCatalog().forEach((item) => mergeProductIntoList(merged, byKey, item));
  (remoteList || []).forEach((item) => mergeProductIntoList(merged, byKey, item));
  return merged.sort((a, b) => (Number(a.priority) || 300) - (Number(b.priority) || 300));
}

let sourceProducts = buildSourceProducts([]);

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

function renderProduct(product, options = {}) {
  const productHref = `product.html?product=${encodeURIComponent(product.title)}`;
  const cartControls = options.cartControls === true;
  const productId = product.title;
  const safeProductId = escapeHtmlAttr(productId);
  const isFavorite = window.emirateIsFavorite?.(productId) === true;
  const cartQty = Math.max(1, Number(product.qty) || 1);
  const installment = Math.round(product.price / 12);
  const discount = Math.round((1 - product.price / product.oldPrice) * 100);
  const stars = "★".repeat(Math.floor(product.rating)) + (product.rating % 1 >= 0.5 ? "½" : "");

  const discountText = Number.isFinite(discount) && discount > 0 ? `-${discount}%` : "";
  const badgeHTML = discountText ? `<span class="badge-sale">${discountText}</span>` : "";

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
      <div class="product-rating">
        <span class="product-stars">${stars}</span>
        <span class="product-rating-num">${product.rating}</span>
        <span class="product-reviews">(${product.reviews})</span>
      </div>
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
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "товаров";
  if (n1 > 1 && n1 < 5) return "товара";
  if (n1 === 1) return "товар";
  return "товаров";
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
  if (isFavoritesMode) {
    if (foundPrefixEl) foundPrefixEl.textContent = "В избранном";
    if (foundSuffixEl) foundSuffixEl.textContent = productWord(count);
    return;
  }
  if (isCartMode) {
    if (foundPrefixEl) foundPrefixEl.textContent = "В корзине";
    if (foundSuffixEl) foundSuffixEl.textContent = productWord(count);
  }
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

function applyFiltersAndSort() {
  const categories = getCheckedValues(".filter-category");
  const brands = getCheckedValues(".filter-brand");
  const ratings = getCheckedValues(".filter-rating").map(Number);
  const min = minPriceEl?.value ? Number(minPriceEl.value) : null;
  const max = maxPriceEl?.value ? Number(maxPriceEl.value) : null;
  const sort = sortSelectEl?.value || "popular";

  let list = isCartMode
    ? (window.emirateGetCartItems?.() || [])
    : sourceProducts.filter(p => {
        if (categories.length && !categories.includes(p.category)) return false;
        if (brands.length && !brands.includes(p.brand)) return false;
        if (min !== null && p.price < min) return false;
        if (max !== null && p.price > max) return false;
        if (ratings.length && !ratings.some(r => p.rating >= r)) return false;
        return true;
      });

  if (isFavoritesMode) {
    list = list.filter((p) => window.emirateIsFavorite?.(p.title) === true);
  }

  if (sort === "price_asc") list.sort((a, b) => a.price - b.price);
  if (sort === "price_desc") list.sort((a, b) => b.price - a.price);
  if (sort === "rating_desc") list.sort((a, b) => b.rating - a.rating);

  if (productsGridEl) {
    productsGridEl.innerHTML = list.length
      ? list.map((item) => renderProduct(item, { cartControls: isCartMode })).join("")
      : `<div class="catalog-empty">
          <svg width="48" height="48" fill="none" stroke="#94a3b8" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <p>${isFavoritesMode ? "В избранном пока пусто" : isCartMode ? "Корзина пока пуста" : "Товары не найдены"}</p>
          <span>${isFavoritesMode ? "Добавьте товары, нажимая на сердечко" : isCartMode ? "Начните с основ или найдите продукт с помощью функции поиска." : "Попробуйте изменить фильтры"}</span>
          ${isCartMode ? '<a class="btn-primary cart-empty-home-btn" href="index.html">Главное меню</a>' : ""}
        </div>`;
    window.emirateSyncFavoritesUI?.(productsGridEl);
  }
  updateCatalogHeadCount(list.length);
  renderCartPanels();
  renderViewedProducts();
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

function resetFilters() {
  document.querySelectorAll(".filter-category, .filter-brand, .filter-rating").forEach(item => {
    item.checked = false;
  });
  if (minPriceEl) minPriceEl.value = "";
  if (maxPriceEl) maxPriceEl.value = "";
  if (sortSelectEl) sortSelectEl.value = "popular";
  applyFiltersAndSort();
}

// Init
if (isFavoritesMode || isCartMode) {
  if (filtersCardEl) filtersCardEl.hidden = true;
  if (toolbarEl) toolbarEl.hidden = true;
  if (catalogLayoutEl) catalogLayoutEl.classList.add("catalog-layout--favorites");
}
if (isFavoritesMode) {
  document.body.classList.add("favorites-mode");
  if (pageTitleEl) pageTitleEl.textContent = "Избранные товары";
}
if (isCartMode) {
  document.body.classList.add("cart-mode");
  if (pageTitleEl) pageTitleEl.textContent = "Корзина";
}

applyFiltersAndSort();

void (async () => {
  const api = window.emirateSupabaseApi;
  if (!api || !api.isConfigured()) return;
  try {
    const remote = await api.fetchPublicCatalogProducts();
    if (!remote.length) return;
    sourceProducts = buildSourceProducts(remote);
    applyFiltersAndSort();
  } catch (err) {
    console.warn("[Supabase] catalog", err);
  }
})();

// Events
applyFiltersBtn?.addEventListener("click", applyFiltersAndSort);
sortSelectEl?.addEventListener("change", applyFiltersAndSort);
resetFiltersBtn?.addEventListener("click", resetFilters);

function onProductGridClick(e) {
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
