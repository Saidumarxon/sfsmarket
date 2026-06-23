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
  catalogToggle.addEventListener("click", () => {
    const isOpen = catalogDropdown.classList.toggle("open");
    catalogToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (!catalogToggle.contains(event.target) && !catalogDropdown.contains(event.target)) {
      catalogDropdown.classList.remove("open");
      catalogToggle.setAttribute("aria-expanded", "false");
    }
  });
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

/* Language switch button */
const langSwitch = document.getElementById("langSwitch");
if (langSwitch) {
  langSwitch.addEventListener("click", () => {
    currentLang = currentLang === "ru" ? "uz" : "ru";
    localStorage.setItem("emirate_lang", currentLang);
    applyTranslations();
  });
}

/* Expose for other scripts */
window.emirateLang = () => currentLang;
window.emirateT = t;
