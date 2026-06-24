const cartCountEl = document.getElementById("cartCount");
const catalogToggle = document.getElementById("catalogToggle") || document.getElementById("catalogBtn");
const catalogDropdown = document.getElementById("catalogDropdown");
const headerEl = document.querySelector(".header");
const scrollTopBtn = document.getElementById("scrollTop");

let cartCount = Number(localStorage.getItem("emirate_cart_count") || "0");
const CART_ITEMS_KEY = "emirate_cart_items";
const FAVORITES_KEY = "emirate_favorites";
const VIEWED_KEY = "emirate_viewed_products";
const VIEWED_LIMIT = 16;

function loadFavoriteIds() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeFavoriteId(item))
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

let favoriteIds = new Set(loadFavoriteIds());

function getCartLinks() {
  const links = new Set();
  document
    .querySelectorAll("[data-i18n='header.cart'], [data-i18n='mobnav.cart']")
    .forEach((label) => {
      const link = label.closest("a");
      if (link) links.add(link);
    });
  return Array.from(links);
}

function syncCartLinks() {
  getCartLinks().forEach((link) => {
    link.setAttribute("href", "catalog.html?cart=1");
  });
}

function syncCartCount() {
  if (cartCountEl) {
    cartCountEl.textContent = String(cartCount);
  }
  syncCartLinks();
}

function bumpCart() {
  if (!cartCountEl) return;
  cartCountEl.classList.remove("bump");
  void cartCountEl.offsetWidth;
  cartCountEl.classList.add("bump");
}

function incrementCart(by = 1) {
  cartCount += by;
  localStorage.setItem("emirate_cart_count", String(cartCount));
  syncCartCount();
  bumpCart();
}

function normalizeCartItem(input) {
  if (typeof input === "string") {
    const title = input.trim();
    if (!title) return null;
    return {
      title,
      brand: "",
      category: "",
      price: 0,
      oldPrice: 0,
      rating: 0,
      reviews: 0,
      badge: "",
      qty: 1
    };
  }

  const normalized = normalizeViewedProduct(input);
  if (!normalized) return null;
  const qty = Number(input?.qty);
  return {
    ...normalized,
    qty: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1
  };
}

function loadCartItems() {
  try {
    const raw = localStorage.getItem(CART_ITEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCartItem).filter(Boolean);
  } catch (_) {
    return [];
  }
}

let cartItems = loadCartItems();
cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
localStorage.setItem("emirate_cart_count", String(cartCount));

function saveCartItems() {
  localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(cartItems));
  cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  localStorage.setItem("emirate_cart_count", String(cartCount));
  syncCartCount();
}

function addToCart(product, by = 1) {
  const item = normalizeCartItem(product);
  const incrementBy = Number(by);
  if (!item || !Number.isFinite(incrementBy) || incrementBy <= 0) return;

  const idx = cartItems.findIndex((x) => x.title === item.title);
  if (idx === -1) {
    cartItems.push({ ...item, qty: Math.round(incrementBy) });
  } else {
    const current = cartItems[idx];
    cartItems[idx] = {
      ...current,
      ...item,
      qty: current.qty + Math.round(incrementBy)
    };
  }

  saveCartItems();
  bumpCart();
}

function setCartQty(productId, nextQty) {
  const id = String(productId || "").trim();
  if (!id) return;
  const qty = Math.round(Number(nextQty));
  const idx = cartItems.findIndex((x) => String(x.title || "").trim() === id);
  if (idx === -1) return;

  if (!Number.isFinite(qty) || qty <= 0) {
    cartItems.splice(idx, 1);
  } else {
    cartItems[idx].qty = qty;
  }
  saveCartItems();
}

function removeFromCart(productId) {
  setCartQty(productId, 0);
}

function clearCart() {
  cartItems = [];
  saveCartItems();
}

function getCartItems() {
  return cartItems.map((item) => ({ ...item }));
}

function normalizeFavoriteId(productId) {
  if (productId === null || productId === undefined) return "";
  return String(productId)
    .trim()
    .toLowerCase()
    .replace(/gb\b/g, "")
    .replace(/[^a-zа-я0-9]+/gi, "");
}

function saveFavoriteIds() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favoriteIds)));
}

function getFavoriteCount() {
  return favoriteIds.size;
}

function isFavorite(productId) {
  const id = normalizeFavoriteId(productId);
  return id ? favoriteIds.has(id) : false;
}

function syncWishlistButtons(scope = document) {
  scope.querySelectorAll(".wishlist-btn[data-product-id]").forEach((btn) => {
    const id = normalizeFavoriteId(btn.getAttribute("data-product-id"));
    const active = isFavorite(id);
    btn.classList.toggle("active", active);
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", active ? "#ef4444" : "none");
  });
}

function getFavoriteLinks() {
  const links = new Set();
  document
    .querySelectorAll("[data-i18n='header.favorites'], [data-i18n='mobnav.favorites']")
    .forEach((label) => {
      const link = label.closest("a");
      if (link) links.add(link);
    });
  return Array.from(links);
}

function syncFavoriteLinks() {
  const count = getFavoriteCount();
  getFavoriteLinks().forEach((link) => {
    link.setAttribute("href", "catalog.html?favorites=1");
    let badge = link.querySelector(".favorites-badge");
    if (!badge) {
      badge = document.createElement("i");
      badge.className = "cart-badge favorites-badge";
      link.appendChild(badge);
    }
    badge.textContent = String(count);
    badge.style.display = count > 0 ? "flex" : "none";
  });
}

function syncFavoritesUI(scope = document) {
  syncFavoriteLinks();
  syncWishlistButtons(scope);
}

function syncMobileNavActive() {
  const items = Array.from(document.querySelectorAll(".mobile-nav .mobile-nav-item"));
  if (!items.length) return;

  const { pathname, search } = window.location;
  const currentPath = pathname.split("/").pop() || "index.html";
  const params = new URLSearchParams(search);

  let activeKey = "";

  if (currentPath === "index.html" || currentPath === "") {
    activeKey = "home";
  } else if (currentPath === "login.html") {
    activeKey = "profile";
  } else if (currentPath === "catalog.html" && params.get("favorites") === "1") {
    activeKey = "favorites";
  } else if (currentPath === "catalog.html" && params.get("cart") === "1") {
    activeKey = "cart";
  } else if (currentPath === "catalog.html" || currentPath === "product.html" || currentPath === "checkout.html") {
    activeKey = "catalog";
  }

  items.forEach((item) => {
    const href = item.getAttribute("href") || "";
    let itemKey = "";

    if (href.includes("favorites=1")) {
      itemKey = "favorites";
    } else if (href.includes("cart=1")) {
      itemKey = "cart";
    } else if (href.includes("login.html")) {
      itemKey = "profile";
    } else if (href.includes("catalog.html")) {
      itemKey = "catalog";
    } else if (href.includes("index.html")) {
      itemKey = "home";
    }

    item.classList.toggle("active", itemKey === activeKey);
  });
}

function toggleFavorite(productId, forceState) {
  const id = normalizeFavoriteId(productId);
  if (!id) return false;

  const nextState = typeof forceState === "boolean" ? forceState : !favoriteIds.has(id);
  if (nextState) {
    favoriteIds.add(id);
  } else {
    favoriteIds.delete(id);
  }

  saveFavoriteIds();
  syncFavoritesUI();
  return nextState;
}

function normalizeViewedProduct(product) {
  if (!product || typeof product !== "object") return null;
  const title = typeof product.title === "string" ? product.title.trim() : "";
  if (!title) return null;

  const normalizeNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    title,
    brand: typeof product.brand === "string" ? product.brand : "",
    category: typeof product.category === "string" ? product.category : "",
    price: normalizeNumber(product.price),
    oldPrice: normalizeNumber(product.oldPrice),
    rating: normalizeNumber(product.rating),
    reviews: normalizeNumber(product.reviews),
    badge: typeof product.badge === "string" ? product.badge : "",
    image: typeof product.image === "string" ? product.image : ""
  };
}

function getViewedProducts() {
  try {
    const raw = localStorage.getItem(VIEWED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeViewedProduct).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function addViewedProduct(product) {
  const normalized = normalizeViewedProduct(product);
  if (!normalized) return;

  const list = getViewedProducts().filter((item) => item.title !== normalized.title);
  list.unshift(normalized);
  localStorage.setItem(VIEWED_KEY, JSON.stringify(list.slice(0, VIEWED_LIMIT)));
}

function emirateProductMediaSeed(product) {
  const parts = [product?.sku, product?.title, product?.brand, product?.category].filter(Boolean);
  const raw = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return raw.slice(0, 48) || "emirate-product";
}

/** Stock photos when admin has not uploaded images yet (stable per product). */
function emirateFallbackProductPhotos(product, count = 4) {
  const seed = emirateProductMediaSeed(product);
  const total = Math.max(1, Math.min(Number(count) || 4, 6));
  return Array.from({ length: total }, (_, index) =>
    `https://picsum.photos/seed/${encodeURIComponent(`${seed}-${index}`)}/800/800`
  );
}

function emirateParsePriceValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return Number(String(value || "").replace(/\s+/g, "").replace(/[^\d]/g, "")) || 0;
}

function emirateFormatPriceParts(value) {
  const amount = emirateParsePriceValue(value);
  return {
    amount: amount.toLocaleString("ru-RU"),
    currency: "сум"
  };
}

function emirateProductPriceHtml(price, oldPrice) {
  const priceNum = emirateParsePriceValue(price);
  const oldNum = emirateParsePriceValue(oldPrice);
  const current = emirateFormatPriceParts(priceNum);
  const old = emirateFormatPriceParts(oldNum);
  const showOld = oldNum > priceNum && priceNum > 0;
  return `
    <div class="product-price-block">
      <div class="product-price-row">
        <div class="product-price">
          <span class="product-price-value">${current.amount}</span>
          <span class="product-price-currency">${current.currency}</span>
        </div>
        ${
          showOld
            ? `<span class="product-old-price"><span class="product-old-price-value">${old.amount}</span><span class="product-old-price-currency">${old.currency}</span></span>`
            : ""
        }
      </div>
    </div>
  `;
}

function emirateNormalizeReviewItem(item) {
  if (!item || typeof item !== "object") return null;
  var author = String(item.author || item.name || item.userName || "").trim();
  var text = String(item.text || item.comment || item.body || "").trim();
  var rating = Number(item.rating);
  if (!Number.isFinite(rating)) rating = 0;
  rating = Math.max(0, Math.min(5, rating));
  if (!author && !text) return null;
  if (rating <= 0 && !text) return null;
  return {
    author: author || "Покупатель",
    date: String(item.date || item.createdAt || item.created_at || "").trim(),
    rating: rating,
    text: text
  };
}

function emirateResolveProductReviews(product) {
  var items = Array.isArray(product && product.reviewItems)
    ? product.reviewItems.map(emirateNormalizeReviewItem).filter(Boolean)
    : [];
  var count = Math.max(0, Number(product && product.reviews) || 0);
  var rating = Number(product && product.rating);
  if (!Number.isFinite(rating)) rating = 0;

  if (items.length) {
    count = items.length;
    rating = items.reduce(function (sum, row) { return sum + row.rating; }, 0) / count;
  } else if (count <= 0) {
    rating = 0;
  }

  rating = Math.round(Math.max(0, Math.min(5, rating)) * 10) / 10;
  return { rating: rating, count: count, items: items };
}

function emirateFormatReviewStars(rating) {
  var value = Math.max(0, Math.min(5, Number(rating) || 0));
  var full = Math.floor(value);
  var half = value - full >= 0.5 ? 1 : 0;
  return "\u2605".repeat(full) + (half ? "\u00BD" : "");
}

function emirateReviewsCountLabel(count, lang) {
  var n = Math.max(0, Number(count) || 0);
  if (lang === "uz") return n + " sharh";
  var mod10 = n % 10;
  var mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return n + " \u043e\u0442\u0437\u044b\u0432\u043e\u0432";
  if (mod10 === 1) return n + " \u043e\u0442\u0437\u044b\u0432";
  if (mod10 >= 2 && mod10 <= 4) return n + " \u043e\u0442\u0437\u044b\u0432\u0430";
  return n + " \u043e\u0442\u0437\u044b\u0432\u043e\u0432";
}

function emirateFormatReviewDate(value) {
  if (!value) return "";
  var parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return String(value).trim();
}

function emirateProductRatingHtml(product, lang) {
  var reviewData = emirateResolveProductReviews(product || {});
  if (reviewData.count <= 0) return "";
  return (
    '<span class="product-stars">' + emirateFormatReviewStars(reviewData.rating) + "</span>" +
    '<span class="product-rating-num">' + reviewData.rating.toFixed(1) + "</span>" +
    '<span class="product-reviews">(' + reviewData.count + ")</span>"
  );
}

function emirateProductRatingChipHtml(product, lang) {
  var reviewData = emirateResolveProductReviews(product || {});
  if (reviewData.count <= 0) return "";
  var label = emirateReviewsCountLabel(reviewData.count, lang);
  return (
    '<svg width="14" height="14" fill="#f59e0b" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ' +
    reviewData.rating.toFixed(1) +
    ' <span class="reviews-count">(' + label + ")</span>"
  );
}

function emirateProductInstallmentHtml(product, installmentValue) {
  if (product && product.installmentStatus === "inactive") {
    return `<div class="product-installment product-installment--muted">Без рассрочки</div>`;
  }
  const part = emirateFormatPriceParts(installmentValue);
  return `<div class="product-installment"><span class="product-installment-value">${part.amount} ${part.currency}</span><span class="product-installment-term">× 12 мес</span></div>`;
}

function emirateProductActionsHtml(productHref, safeProductId) {
  return `
    <div class="product-actions">
      <button class="product-buy-btn quick-buy-open" type="button" data-product-title="${safeProductId}">Купить</button>
      <button class="product-cart-icon-btn add-to-cart-btn" type="button" title="В корзину" aria-label="В корзину">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
        </svg>
      </button>
    </div>
  `;
}

function emirateResolveProductMedia(product) {
  const item = product || {};
  let photos = Array.isArray(item.photos)
    ? item.photos.map((url) => String(url || "").trim()).filter(Boolean)
    : [];
  if (!photos.length && item.image) {
    photos = [String(item.image).trim()];
  }
  const fromUpload = photos.length > 0;
  if (!fromUpload) {
    photos = emirateFallbackProductPhotos(item, 4);
  }
  return {
    image: photos[0] || "",
    photos,
    fromUpload
  };
}

syncCartCount();
syncFavoritesUI();
syncMobileNavActive();
window.emirateResolveProductMedia = emirateResolveProductMedia;
window.emirateFallbackProductPhotos = emirateFallbackProductPhotos;
window.emirateProductPriceHtml = emirateProductPriceHtml;
window.emirateProductInstallmentHtml = emirateProductInstallmentHtml;
window.emirateProductActionsHtml = emirateProductActionsHtml;
window.emirateParsePriceValue = emirateParsePriceValue;
window.emirateResolveProductReviews = emirateResolveProductReviews;
window.emirateFormatReviewStars = emirateFormatReviewStars;
window.emirateReviewsCountLabel = emirateReviewsCountLabel;
window.emirateFormatReviewDate = emirateFormatReviewDate;
window.emirateProductRatingHtml = emirateProductRatingHtml;
window.emirateProductRatingChipHtml = emirateProductRatingChipHtml;

function escapeQuickBuyHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildQuickBuyProductFromCard(card) {
  if (!card) return null;
  const title =
    card.getAttribute("data-product-title") ||
    card.getAttribute("data-product-id") ||
    card.querySelector(".product-title")?.textContent?.trim() ||
    "";
  if (!title) return null;
  const price = emirateParsePriceValue(
    card.querySelector(".product-price-value")?.textContent ||
      card.querySelector(".product-price")?.textContent
  );
  const imageEl = card.querySelector(".product-image-real");
  const media = window.emirateResolveProductMedia?.({ title, image: imageEl?.getAttribute("src") || "" });
  return normalizeViewedProduct({
    title,
    price,
    image: media?.image || imageEl?.getAttribute("src") || "",
    brand: "",
    category: "",
    rating: Number(card.querySelector(".product-rating-num")?.textContent) || 0,
    reviews: Number((card.querySelector(".product-reviews")?.textContent || "").replace(/[^\d]/g, "")) || 0
  });
}

function resolveQuickBuyProduct(card, triggerBtn) {
  const title =
    triggerBtn?.getAttribute("data-product-title") ||
    card?.getAttribute("data-product-title") ||
    card?.getAttribute("data-product-id") ||
    "";
  if (title && typeof window.emirateLookupProduct === "function") {
    const found = window.emirateLookupProduct(title);
    if (found) return normalizeViewedProduct(found);
  }
  return buildQuickBuyProductFromCard(card);
}

let quickBuyState = { product: null, qty: 1 };

function formatQuickBuyMoney(value) {
  return `${emirateParsePriceValue(value).toLocaleString("ru-RU")} сум`;
}

function normalizeQuickBuyPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  if (local.length !== 9) return "";
  return `+998${local}`;
}

function renderQuickBuySummary() {
  const product = quickBuyState.product;
  if (!product) return;
  const imageEl = document.getElementById("quickBuyImage");
  const titleEl = document.getElementById("quickBuyTitle");
  const priceEl = document.getElementById("quickBuyPrice");
  const qtyEl = document.getElementById("quickBuyQty");
  const media = window.emirateResolveProductMedia?.(product);
  if (imageEl) {
    imageEl.src = media?.image || product.image || "";
    imageEl.alt = product.title;
  }
  if (titleEl) titleEl.textContent = product.title;
  if (priceEl) priceEl.textContent = formatQuickBuyMoney(product.price * quickBuyState.qty);
  if (qtyEl) qtyEl.textContent = String(quickBuyState.qty);
}

function ensureQuickBuyModal() {
  if (document.getElementById("quickBuyModal")) return;

  const overlay = document.createElement("div");
  overlay.id = "quickBuyModal";
  overlay.className = "quick-buy-modal";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="quick-buy-dialog" role="dialog" aria-modal="true" aria-labelledby="quickBuyTitle">
      <div class="quick-buy-header">
        <h2 class="quick-buy-heading">Купить в один клик</h2>
        <button type="button" class="quick-buy-close" id="quickBuyClose" aria-label="Закрыть">×</button>
      </div>
      <div class="quick-buy-product">
        <img id="quickBuyImage" class="quick-buy-image" src="" alt="">
        <div class="quick-buy-product-main">
          <div id="quickBuyTitle" class="quick-buy-product-title"></div>
          <div class="quick-buy-price-row">
            <div id="quickBuyPrice" class="quick-buy-price"></div>
            <div class="quick-buy-qty" aria-label="Количество">
              <button type="button" class="quick-buy-qty-btn" id="quickBuyQtyMinus" aria-label="Меньше">−</button>
              <span id="quickBuyQty" class="quick-buy-qty-value">1</span>
              <button type="button" class="quick-buy-qty-btn" id="quickBuyQtyPlus" aria-label="Больше">+</button>
            </div>
          </div>
        </div>
      </div>
      <form id="quickBuyForm" class="quick-buy-form">
        <label class="quick-buy-field">
          <span class="quick-buy-label">Номер телефона</span>
          <div class="quick-buy-phone-row">
            <span class="quick-buy-phone-prefix">+998</span>
            <input type="tel" id="quickBuyPhone" name="phone" inputmode="numeric" autocomplete="tel" placeholder="90 123 45 67" maxlength="12" required>
          </div>
        </label>
        <label class="quick-buy-field">
          <span class="quick-buy-label">Имя и фамилия</span>
          <input type="text" id="quickBuyName" name="full_name" autocomplete="name" placeholder="Введите имя и фамилию" required>
        </label>
        <div class="quick-buy-actions">
          <button type="submit" class="quick-buy-submit" id="quickBuySubmit">Купить</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeQuickBuyModal();
  });
  document.getElementById("quickBuyClose")?.addEventListener("click", closeQuickBuyModal);
  document.getElementById("quickBuyQtyMinus")?.addEventListener("click", () => {
    quickBuyState.qty = Math.max(1, quickBuyState.qty - 1);
    renderQuickBuySummary();
  });
  document.getElementById("quickBuyQtyPlus")?.addEventListener("click", () => {
    quickBuyState.qty = Math.min(99, quickBuyState.qty + 1);
    renderQuickBuySummary();
  });
  document.getElementById("quickBuyForm")?.addEventListener("submit", submitQuickBuyOrder);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) closeQuickBuyModal();
  });
}

function openQuickBuyModal(product, qty = 1) {
  const normalized = normalizeViewedProduct({
    ...product,
    price: emirateParsePriceValue(product?.price),
    oldPrice: emirateParsePriceValue(product?.oldPrice)
  });
  if (!normalized) return;
  ensureQuickBuyModal();
  quickBuyState = { product: normalized, qty: Math.max(1, Math.min(99, Number(qty) || 1)) };
  const overlay = document.getElementById("quickBuyModal");
  const phoneEl = document.getElementById("quickBuyPhone");
  const nameEl = document.getElementById("quickBuyName");
  if (phoneEl) phoneEl.value = "";
  if (nameEl) nameEl.value = "";
  renderQuickBuySummary();
  if (overlay) {
    overlay.hidden = false;
    document.body.classList.add("quick-buy-open");
    phoneEl?.focus();
  }
}

function closeQuickBuyModal() {
  const overlay = document.getElementById("quickBuyModal");
  if (!overlay) return;
  overlay.hidden = true;
  document.body.classList.remove("quick-buy-open");
  quickBuyState = { product: null, qty: 1 };
}

async function submitQuickBuyOrder(event) {
  event.preventDefault();
  const product = quickBuyState.product;
  if (!product) return;

  const phoneRaw = document.getElementById("quickBuyPhone")?.value || "";
  const fullName = String(document.getElementById("quickBuyName")?.value || "").trim();
  const phone = normalizeQuickBuyPhone(phoneRaw);
  if (!phone) {
    alert("Введите номер телефона в формате 90 123 45 67");
    return;
  }
  if (!fullName) {
    alert("Введите имя и фамилию");
    return;
  }

  const submitBtn = document.getElementById("quickBuySubmit");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Отправка...";
  }

  const qty = quickBuyState.qty;
  const lineTotal = emirateParsePriceValue(product.price) * qty;
  const orderRow = {
    phone,
    full_name: fullName,
    region: "",
    city: "",
    address: "",
    comment_text: "Быстрый заказ с сайта",
    delivery_method: "quick_buy",
    payment_method: "callback",
    items: [{ ...product, qty }],
    total_amount: lineTotal
  };

  try {
    if (window.emirateSupabaseApi?.isConfigured?.()) {
      const res = await window.emirateSupabaseApi.insertOrder(orderRow);
      if (!res?.ok) {
        alert("Не удалось отправить заказ. Попробуйте позже или позвоните нам.\n" + (res?.error || ""));
        return;
      }
    }
    alert("Заказ принят! Мы свяжемся с вами в ближайшее время.");
    closeQuickBuyModal();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Купить";
    }
  }
}

document.addEventListener("click", (event) => {
  const btn = event.target.closest(".quick-buy-open");
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  const card = btn.closest(".product-card");
  const product = resolveQuickBuyProduct(card, btn);
  if (product) openQuickBuyModal(product, 1);
});

window.emirateOpenQuickBuy = openQuickBuyModal;
window.emirateCloseQuickBuy = closeQuickBuyModal;
window.emirateIncrementCart = incrementCart;
window.emirateAddToCart = addToCart;
window.emirateSetCartQty = setCartQty;
window.emirateRemoveFromCart = removeFromCart;
window.emirateClearCart = clearCart;
window.emirateGetCartItems = getCartItems;
window.emirateToggleFavorite = toggleFavorite;
window.emirateIsFavorite = isFavorite;
window.emirateGetFavorites = () => Array.from(favoriteIds);
window.emirateSyncFavoritesUI = syncFavoritesUI;
window.emirateAddViewedProduct = addViewedProduct;
window.emirateGetViewedProducts = getViewedProducts;

window.addEventListener("storage", (event) => {
  if (event.key === FAVORITES_KEY) {
    favoriteIds = new Set(loadFavoriteIds());
    syncFavoritesUI();
    return;
  }
  if (event.key === CART_ITEMS_KEY || event.key === "emirate_cart_count") {
    cartItems = loadCartItems();
    cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
    localStorage.setItem("emirate_cart_count", String(cartCount));
    syncCartCount();
  }
});

if (catalogToggle && catalogDropdown) {
  const catalogBackdrop = document.getElementById("catalogDropdownBackdrop");

  function syncCatalogDropdownPosition() {
    if (!headerEl) return;
    const top = Math.round(headerEl.getBoundingClientRect().bottom);
    catalogDropdown.style.top = top + "px";
    if (catalogBackdrop) catalogBackdrop.style.top = top + "px";
  }

  function setCatalogDropdownOpen(isOpen) {
    syncCatalogDropdownPosition();
    catalogDropdown.classList.toggle("open", isOpen);
    catalogToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    catalogToggle.classList.toggle("is-open", isOpen);
    if (catalogBackdrop) {
      if (isOpen) catalogBackdrop.removeAttribute("hidden");
      else catalogBackdrop.setAttribute("hidden", "");
    }
    document.body.classList.toggle("catalog-menu-open", isOpen);
  }

  catalogToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = !catalogDropdown.classList.contains("open");
    setCatalogDropdownOpen(willOpen);
  });

  catalogBackdrop?.addEventListener("click", () => setCatalogDropdownOpen(false));

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (!catalogToggle.contains(event.target) && !catalogDropdown.contains(event.target)) {
      setCatalogDropdownOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setCatalogDropdownOpen(false);
  });

  window.addEventListener("resize", syncCatalogDropdownPosition);
  window.addEventListener("scroll", () => {
    if (catalogDropdown.classList.contains("open")) syncCatalogDropdownPosition();
  }, { passive: true });
}

window.addEventListener(
  "scroll",
  () => {
    const y = window.scrollY;
    if (headerEl) {
      headerEl.classList.toggle("scrolled", y > 10);
    }
    if (scrollTopBtn) {
      scrollTopBtn.classList.toggle("visible", y > 280);
    }
  },
  { passive: true }
);

if (scrollTopBtn) {
  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ══════════════════════════════════════════
   ══  i18n — Language Switcher Engine  ══
   ══════════════════════════════════════════ */

const T = window.TRANSLATIONS || {};
let currentLang = localStorage.getItem("emirate_lang") || "ru";

function t(key) {
  const entry = T[key];
  if (!entry) return null;
  return entry[currentLang] || entry["ru"] || null;
}

function applyTranslations() {
  /* data-i18n="key" → textContent */
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const val = t(el.getAttribute("data-i18n"));
    if (val !== null) el.textContent = val;
  });

  /* data-i18n-html="key" → innerHTML (for strings with <span> etc) */
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const val = t(el.getAttribute("data-i18n-html"));
    if (val !== null) el.innerHTML = val;
  });

  /* data-i18n-placeholder="key" → placeholder */
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const val = t(el.getAttribute("data-i18n-placeholder"));
    if (val !== null) el.placeholder = val;
  });

  /* Update <html lang> */
  document.documentElement.lang = currentLang === "uz" ? "uz" : "ru";
}

/* Apply on page load (in case user previously chose UZ) */
applyTranslations();

/* ══════════════════════════════════════════
   ══  Theme (light / dark)             ══
   ══════════════════════════════════════════ */

const THEME_KEY = "emirate_theme";

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch (_) {
    return "light";
  }
}

function syncThemeMeta(theme) {
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b0f17" : "#0f172a");
}

function syncThemeStatusBar(theme) {
  var Capacitor = window.Capacitor;
  if (!Capacitor || typeof Capacitor.isNativePlatform !== "function" || !Capacitor.isNativePlatform()) {
    return;
  }
  var StatusBar = typeof Capacitor.registerPlugin === "function"
    ? Capacitor.registerPlugin("StatusBar")
    : Capacitor.Plugins && Capacitor.Plugins.StatusBar;
  if (!StatusBar) return;
  if (StatusBar.setStyle) {
    void StatusBar.setStyle({ style: theme === "dark" ? "DARK" : "LIGHT" });
  }
  if (StatusBar.setBackgroundColor) {
    void StatusBar.setBackgroundColor({ color: theme === "dark" ? "#0b0f17" : "#ffffff" });
  }
}

function syncThemeLogos(theme) {
  var darkSrc = "images/emirate-logo-dark.svg";
  var lightSrc = "images/emirate-logo.svg";
  document.querySelectorAll(".logo-img").forEach(function (img) {
    if (!img.dataset.logoDefault) {
      img.dataset.logoDefault = img.getAttribute("src") || lightSrc;
    }
    img.setAttribute("src", theme === "dark" ? darkSrc : img.dataset.logoDefault);
  });
}

function syncThemeUi(theme) {
  document.querySelectorAll(".theme-switch").forEach(function (btn) {
    btn.classList.toggle("is-dark", theme === "dark");
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  });
  document.querySelectorAll("[data-theme-state]").forEach(function (el) {
    el.textContent = theme === "dark"
      ? (t("profile.themeOn") || "Включена")
      : (t("profile.themeOff") || "Выключена");
  });
  syncThemeLogos(theme);
}

function applyTheme(theme, options) {
  var opts = options || {};
  var next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  if (opts.persist) {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_) {}
  }
  syncThemeMeta(next);
  syncThemeStatusBar(next);
  syncThemeUi(next);
}

function toggleTheme() {
  applyTheme(getStoredTheme() === "dark" ? "light" : "dark", { persist: true });
}

applyTheme(getStoredTheme(), { persist: false });

document.querySelectorAll("#themeSwitch, #profileThemeSwitch").forEach(function (btn) {
  btn.addEventListener("click", toggleTheme);
});

window.emirateTheme = getStoredTheme;
window.emirateApplyTheme = applyTheme;
window.emirateToggleTheme = toggleTheme;

/* Language switch button */
const langSwitch = document.getElementById("langSwitch");
if (langSwitch) {
  langSwitch.addEventListener("click", () => {
    currentLang = currentLang === "ru" ? "uz" : "ru";
    localStorage.setItem("emirate_lang", currentLang);
    applyTranslations();
    syncThemeUi(getStoredTheme());
  });
}

/* Expose for other scripts */
window.emirateLang = () => currentLang;
window.emirateT = t;

/* ===== Desktop auth modal (web) vs profile page (app / mobile) ===== */
function isNativeApp() {
  return document.documentElement.classList.contains("capacitor-app");
}

function shouldUseDesktopAuthModal() {
  if (isNativeApp()) return false;
  if (document.body && document.body.classList.contains("profile-page")) return false;
  return window.matchMedia("(min-width: 681px)").matches;
}

function formatUzPhone(value) {
  var raw = String(value || "");
  if (raw.indexOf("@") !== -1) return raw.trim();
  var digits = raw.replace(/\D/g, "");
  if (digits.indexOf("998") === 0) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  var out = "+998";
  if (!digits.length) return out;
  out += " (" + digits.slice(0, 2);
  if (digits.length <= 2) return out;
  out += ") " + digits.slice(2, 5);
  if (digits.length <= 5) return out;
  out += "-" + digits.slice(5, 7);
  if (digits.length <= 7) return out;
  out += "-" + digits.slice(7, 9);
  return out;
}

var AUTH_ADMIN_SECRET_PHONES = ["998000000000"];
var AUTH_ADMIN_SECRET_EMAILS = ["admin@emirate.co", "office@emirateco.uz"];

function isAdminSecretPhone(value) {
  var digits = String(value || "").replace(/\D/g, "");
  if (AUTH_ADMIN_SECRET_PHONES.indexOf(digits) !== -1) return true;
  return digits === "000000000";
}

function isAdminSecretEmail(value) {
  var email = String(value || "").trim().toLowerCase();
  return AUTH_ADMIN_SECRET_EMAILS.indexOf(email) !== -1;
}

function setAuthAdminMode(modal, seedValue) {
  if (!modal) return;
  modal.classList.add("is-admin-auth");
  var emailPanel = modal.querySelector("#authEmailPanel");
  if (emailPanel) emailPanel.removeAttribute("hidden");
  var emailInput = modal.querySelector("#authEmail");
  var seed = String(seedValue || "").trim();
  if (emailInput && seed.indexOf("@") !== -1) {
    emailInput.value = seed;
  }
  showAuthMessage("");
  if (emailInput) emailInput.focus();
  else modal.querySelector("#authPass")?.focus();
}

function resetAuthCustomerMode(modal) {
  if (!modal) return;
  modal.classList.remove("is-admin-auth");
  var emailPanel = modal.querySelector("#authEmailPanel");
  if (emailPanel) emailPanel.setAttribute("hidden", "");
  var phoneInput = modal.querySelector("#authPhone");
  var emailInput = modal.querySelector("#authEmail");
  var passInput = modal.querySelector("#authPass");
  if (phoneInput) phoneInput.value = "";
  if (emailInput) emailInput.value = "";
  if (passInput) passInput.value = "";
}

function tryOpenAdminAuthFromInput(modal, rawValue) {
  var value = String(rawValue || "").trim();
  if (!isAdminSecretPhone(value) && !isAdminSecretEmail(value)) return false;
  setAuthAdminMode(modal, isAdminSecretEmail(value) ? value : "");
  return true;
}

function ensureAuthModal() {
  if (document.getElementById("authModal")) return document.getElementById("authModal");

  var modal = document.createElement("div");
  modal.id = "authModal";
  modal.className = "auth-modal";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML =
    '<div class="auth-modal-dialog" role="dialog" aria-labelledby="authModalTitle">' +
      '<button type="button" class="auth-modal-close" id="authModalClose" aria-label="Закрыть">&times;</button>' +
      '<div class="auth-modal-grid">' +
        '<div class="auth-modal-form">' +
          '<h2 class="auth-modal-title" id="authModalTitle" data-i18n="auth.title">Войти или создать личный кабинет</h2>' +
          '<form id="authForm" class="auth-customer-block" novalidate>' +
            '<label class="auth-field-label" for="authPhone" data-i18n="auth.phone">Телефон</label>' +
            '<input class="auth-phone-input" type="tel" id="authPhone" inputmode="tel" autocomplete="tel" data-i18n-placeholder="auth.phonePlaceholder" placeholder="+998 (__) ___-__-__">' +
            '<button type="submit" class="auth-primary-btn" id="authPhoneSubmit" data-i18n="auth.getCode">Получить код активации</button>' +
          '</form>' +
          '<div class="auth-customer-block auth-divider"><span data-i18n="auth.or">Или</span></div>' +
          '<div class="auth-customer-block auth-social-row">' +
            '<button type="button" class="auth-social-btn auth-social-btn--google" id="authGoogleBtn">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>' +
              '<span data-i18n="auth.googleBtn">Войти через Google</span>' +
            '</button>' +
            '<button type="button" class="auth-social-btn auth-social-btn--facebook" id="authFacebookBtn" aria-label="Facebook" hidden>f</button>' +
          '</div>' +
          '<div class="auth-email-panel" id="authEmailPanel" hidden>' +
            '<label class="auth-field-label" for="authEmail" data-i18n="auth.emailLabel">Email или логин</label>' +
            '<input class="auth-phone-input" type="text" id="authEmail" autocomplete="username">' +
            '<label class="auth-field-label" for="authPass" data-i18n="auth.passLabel">Пароль</label>' +
            '<input class="auth-phone-input" type="password" id="authPass" autocomplete="current-password">' +
            '<button type="button" class="auth-primary-btn" id="authEmailSubmit" data-i18n="header.login">Войти</button>' +
          '</div>' +
          '<p class="auth-error" id="authError" aria-live="polite"></p>' +
        '</div>' +
        '<aside class="auth-modal-benefits">' +
          '<div class="auth-benefit">' +
            '<div class="auth-benefit-icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg></div>' +
            '<div><p class="auth-benefit-title" data-i18n="auth.benefit1Title">Не нужно ходить на базар</p><p class="auth-benefit-text" data-i18n="auth.benefit1Text">У нас удобные цены и доставка на дом</p></div>' +
          '</div>' +
          '<div class="auth-benefit">' +
            '<div class="auth-benefit-icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8zM5 19a2 2 0 104 0 2 2 0 00-4 0M15 19a2 2 0 104 0 2 2 0 00-4 0"/></svg></div>' +
            '<div><p class="auth-benefit-title" data-i18n="auth.benefit2Title">Быстрая доставка</p><p class="auth-benefit-text" data-i18n="auth.benefit2Text">Наш сервис вас приятно удивит</p></div>' +
          '</div>' +
          '<div class="auth-benefit">' +
            '<div class="auth-benefit-icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>' +
            '<div><p class="auth-benefit-title" data-i18n="auth.benefit3Title">Удобства для вас</p><p class="auth-benefit-text" data-i18n="auth.benefit3Text">Быстрое оформление и гарантия возврата</p></div>' +
          '</div>' +
          '<div class="auth-benefit">' +
            '<div class="auth-benefit-icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></div>' +
            '<div><p class="auth-benefit-title" data-i18n="auth.benefit4Title">Рассрочка</p><p class="auth-benefit-text" data-i18n="auth.benefit4Text">Без предоплаты</p></div>' +
          '</div>' +
        '</aside>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  applyTranslations();

  var phoneInput = modal.querySelector("#authPhone");
  phoneInput.addEventListener("input", function () {
    phoneInput.value = formatUzPhone(phoneInput.value);
  });

  modal.querySelector("#authModalClose").addEventListener("click", closeAuthModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeAuthModal();
  });

  modal.querySelector("#authGoogleBtn").addEventListener("click", async function () {
    if (!window.emirateSupabaseApi || !window.emirateSupabaseApi.isConfigured()) {
      showAuthMessage(t("auth.socialSoon") || "Скоро будет доступно");
      return;
    }
    try {
      if (!window.emirateSignInWithGoogle) {
        await loadScriptOnce("emirate-auth.js");
      }
      showAuthMessage(t("auth.googleRedirect") || "Переход в Google…");
      var next =
        window.location.pathname.indexOf("catalog") !== -1
          ? "catalog.html"
          : window.location.pathname.indexOf("product") !== -1
            ? "product.html" + window.location.search
            : "index.html";
      var res = await window.emirateSignInWithGoogle({ next: next });
      if (res.error) {
        showAuthMessage(res.error.message || t("auth.googleError") || "Ошибка Google");
      }
    } catch (_) {
      showAuthMessage(t("auth.googleError") || "Ошибка Google");
    }
  });

  modal.querySelector("#authFacebookBtn")?.addEventListener("click", function () {
    showAuthMessage(t("auth.socialSoon") || "Скоро будет доступно");
  });

  modal.querySelector("#authForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (modal.classList.contains("is-admin-auth")) {
      submitAuthEmailLogin();
      return;
    }
    var rawPhone = phoneInput.value;
    if (tryOpenAdminAuthFromInput(modal, rawPhone)) return;
    var phone = rawPhone.replace(/\D/g, "");
    if (phone.length >= 12) {
      showAuthMessage(t("auth.codeSoon") || "Вход по СМС скоро будет доступен");
      return;
    }
    showAuthMessage(t("auth.phonePlaceholder") || "+998");
  });

  modal.querySelector("#authEmailSubmit").addEventListener("click", function () {
    submitAuthEmailLogin();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && !modal.hidden) closeAuthModal();
  });

  return modal;
}

function showAuthMessage(message) {
  var err = document.getElementById("authError");
  if (!err) return;
  err.textContent = message || "";
}

async function submitAuthEmailLogin() {
  var loginEl = document.getElementById("authEmail");
  var passEl = document.getElementById("authPass");
  if (!loginEl || !passEl) return;

  var login = loginEl.value.trim();
  var pass = passEl.value;
  if (!login || !pass) {
    showAuthMessage(t("auth.passLabel") + "?");
    return;
  }

  if (window.emirateSupabaseApi && window.emirateSupabaseApi.isConfigured()) {
    var sb = window.emirateSupabase;
    var res = await sb.auth.signInWithPassword({ email: login, password: pass });
    if (res.error) {
      showAuthMessage(res.error.message || "Ошибка входа");
      return;
    }
    var em = (res.data.user && res.data.user.email) || login;
    localStorage.setItem("emirate_admin", JSON.stringify({ user: em, role: "admin", ts: Date.now() }));
    window.location.href = "admin.html";
    return;
  }

  if (login === "admin" && pass === "admin123") {
    localStorage.setItem("emirate_admin", JSON.stringify({ user: "admin", role: "admin", ts: Date.now() }));
    window.location.href = "admin.html";
    return;
  }

  showAuthMessage("Неверный логин или пароль");
}

function openAuthModal(options) {
  var opts = options || {};
  if (!shouldUseDesktopAuthModal()) {
    window.location.href = opts.admin ? "login.html?admin=1" : "login.html";
    return;
  }
  var modal = ensureAuthModal();
  showAuthMessage("");
  resetAuthCustomerMode(modal);
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-modal-open");
  if (opts.admin) {
    setAuthAdminMode(modal, "");
  } else {
    var phone = modal.querySelector("#authPhone");
    if (phone) phone.focus();
  }
}

function closeAuthModal() {
  var modal = document.getElementById("authModal");
  if (!modal) return;
  resetAuthCustomerMode(modal);
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-modal-open");
  if (window.history && window.history.replaceState) {
    var url = new URL(window.location.href);
    if (url.searchParams.has("auth")) {
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }
}

function initAuthLinks() {
  document.addEventListener("click", function (e) {
    var link = e.target.closest('a[href="login.html"], a[href="./login.html"]');
    if (!link || !shouldUseDesktopAuthModal()) return;
    e.preventDefault();
    openAuthModal();
  });
}

initAuthLinks();

if (shouldUseDesktopAuthModal()) {
  try {
    var authParam = new URLSearchParams(window.location.search).get("auth");
    if (authParam === "admin") {
      openAuthModal({ admin: true });
    } else if (authParam === "1" || authParam === "open") {
      openAuthModal();
    }
  } catch (_) {}
}

window.emirateOpenAuthModal = openAuthModal;
window.emirateCloseAuthModal = closeAuthModal;
window.emirateShouldUseDesktopAuthModal = shouldUseDesktopAuthModal;

/* ===== Photo search (visual) ===== */
function loadScriptOnce(src) {
  return new Promise(function (resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) {
      resolve();
      return;
    }
    var s = document.createElement("script");
    s.src = src;
    s.onload = function () {
      resolve();
    };
    s.onerror = function () {
      reject(new Error("script_load_failed"));
    };
    document.body.appendChild(s);
  });
}

async function ensureImageSearchApi() {
  if (window.emirateImageSearch) return window.emirateImageSearch;
  await loadScriptOnce("emirate-image-search.js");
  return window.emirateImageSearch;
}

function ensurePhotoSearchModal() {
  if (document.getElementById("photoSearchModal")) return document.getElementById("photoSearchModal");

  var modal = document.createElement("div");
  modal.id = "photoSearchModal";
  modal.className = "photo-search-modal";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML =
    '<div class="photo-search-dialog" role="dialog" aria-labelledby="photoSearchTitle">' +
      '<button type="button" class="photo-search-close" id="photoSearchClose" aria-label="Закрыть">&times;</button>' +
      '<h2 class="photo-search-title" id="photoSearchTitle" data-i18n="photo.title">Поиск по фото</h2>' +
      '<p class="photo-search-subtitle" data-i18n="photo.subtitle">Сделайте фото или загрузите изображение — мы найдём похожие товары</p>' +
      '<div class="photo-search-drop" id="photoSearchDrop">' +
        '<img class="photo-search-preview" id="photoSearchPreview" alt="" hidden>' +
        '<div class="photo-search-drop-empty" id="photoSearchDropEmpty">' +
          '<svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' +
          '<span data-i18n="photo.dropHint">Перетащите фото сюда или выберите файл</span>' +
        '</div>' +
      '</div>' +
      '<div class="photo-search-actions">' +
        '<label class="photo-search-secondary-btn">' +
          '<span data-i18n="photo.take">Сделать фото</span>' +
          '<input type="file" id="photoSearchCamera" accept="image/*" capture="environment" hidden>' +
        '</label>' +
        '<label class="photo-search-secondary-btn">' +
          '<span data-i18n="photo.upload">Загрузить</span>' +
          '<input type="file" id="photoSearchFile" accept="image/*" hidden>' +
        '</label>' +
      '</div>' +
      '<button type="button" class="photo-search-primary-btn" id="photoSearchSubmit" data-i18n="photo.findBtn">Найти похожие</button>' +
      '<p class="photo-search-status" id="photoSearchStatus" aria-live="polite"></p>' +
    '</div>';

  document.body.appendChild(modal);
  applyTranslations();

  var preview = modal.querySelector("#photoSearchPreview");
  var dropEmpty = modal.querySelector("#photoSearchDropEmpty");
  var statusEl = modal.querySelector("#photoSearchStatus");
  var pendingFile = null;

  function setPreviewFromFile(file) {
    if (!file || !file.type || file.type.indexOf("image/") !== 0) return;
    pendingFile = file;
    var url = URL.createObjectURL(file);
    preview.onload = function () {
      URL.revokeObjectURL(url);
    };
    preview.src = url;
    preview.hidden = false;
    dropEmpty.hidden = true;
    statusEl.textContent = "";
    modal.querySelector("#photoSearchSubmit").disabled = false;
  }

  modal._photoSearchSetFile = setPreviewFromFile;

  function wireFileInput(input) {
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) setPreviewFromFile(input.files[0]);
      input.value = "";
    });
  }

  wireFileInput(modal.querySelector("#photoSearchCamera"));
  wireFileInput(modal.querySelector("#photoSearchFile"));

  modal.querySelector("#photoSearchDrop").addEventListener("dragover", function (e) {
    e.preventDefault();
    modal.querySelector("#photoSearchDrop").classList.add("is-dragover");
  });
  modal.querySelector("#photoSearchDrop").addEventListener("dragleave", function () {
    modal.querySelector("#photoSearchDrop").classList.remove("is-dragover");
  });
  modal.querySelector("#photoSearchDrop").addEventListener("drop", function (e) {
    e.preventDefault();
    modal.querySelector("#photoSearchDrop").classList.remove("is-dragover");
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) setPreviewFromFile(file);
  });

  modal.querySelector("#photoSearchClose").addEventListener("click", closePhotoSearchModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closePhotoSearchModal();
  });

  modal.querySelector("#photoSearchSubmit").addEventListener("click", async function () {
    if (!pendingFile) {
      statusEl.textContent = t("photo.noImage") || "Выберите изображение";
      return;
    }
    var btn = modal.querySelector("#photoSearchSubmit");
    btn.disabled = true;
    statusEl.textContent = t("photo.searching") || "Ищем…";
    try {
      var api = await ensureImageSearchApi();
      var img = await api.loadImageFromFile(pendingFile);
      var dataUrl = await api.compressToDataUrl(img);
      api.saveQueryImage(dataUrl);
      window.location.href = "catalog.html?photo=1";
    } catch (_) {
      statusEl.textContent = t("photo.noImage") || "Ошибка загрузки";
      btn.disabled = false;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal && !modal.hidden) closePhotoSearchModal();
  });

  return modal;
}

function openPhotoSearchModal(options) {
  var opts = options || {};
  var modal = ensurePhotoSearchModal();
  if (opts.file && modal._photoSearchSetFile) {
    modal._photoSearchSetFile(opts.file);
  }
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("photo-search-open");
  applyTranslations();
}

function openPhotoSearchModalWithFile(file) {
  openPhotoSearchModal({ file: file });
}

function closePhotoSearchModal() {
  var modal = document.getElementById("photoSearchModal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("photo-search-open");
}

function initPhotoSearchUI() {
  document.querySelectorAll(".search-bar").forEach(function (bar) {
    var input = bar.querySelector('input[type="search"]');
    if (!input || bar.querySelector(".search-photo-btn")) return;

    var field = input.closest(".search-bar-field");
    if (!field) {
      field = document.createElement("div");
      field.className = "search-bar-field";
      input.parentNode.insertBefore(field, input);
      field.appendChild(input);
    }

    var pickInput = document.createElement("input");
    pickInput.type = "file";
    pickInput.accept = "image/*";
    pickInput.setAttribute("capture", "environment");
    pickInput.hidden = true;
    bar.appendChild(pickInput);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "search-photo-btn";
    btn.setAttribute("aria-label", t("header.photoSearch") || "Поиск по фото");
    btn.setAttribute("title", t("header.photoSearch") || "Поиск по фото");
    btn.innerHTML =
      '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
        '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>' +
        '<circle cx="12" cy="13" r="4"/>' +
      "</svg>";
    field.appendChild(btn);

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      pickInput.click();
    });

    pickInput.addEventListener("change", function () {
      var file = pickInput.files && pickInput.files[0];
      pickInput.value = "";
      if (file) openPhotoSearchModalWithFile(file);
    });
  });
}

function initHeaderSearchForms() {
  document.querySelectorAll(".search-bar").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="search"]');
      var q = (input && input.value ? input.value : "").trim();
      if (!q) return;
      window.location.href = "catalog.html?q=" + encodeURIComponent(q);
    });
  });
}

initPhotoSearchUI();
initHeaderSearchForms();
window.emirateOpenPhotoSearchModal = openPhotoSearchModal;
window.emirateOpenPhotoSearchModalWithFile = openPhotoSearchModalWithFile;
