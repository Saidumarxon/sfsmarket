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

syncCartCount();
syncFavoritesUI();
syncMobileNavActive();
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
