/* ========================================
   EMIRATE CO — Product Page v3
   ======================================== */

const ADMIN_PRODUCTS_KEY = "emirate_admin_products";
const SELECTED_PRODUCT_KEY = "emirate_selected_product";

const qtyMinusBtn = document.getElementById("qtyMinus");
const qtyPlusBtn = document.getElementById("qtyPlus");
const qtyValueEl = document.getElementById("qtyValue");
const buyNowBtn = document.getElementById("buyNowBtn");
const addToCartBtn = document.getElementById("addToCartBtn");
const mainImageEl = document.getElementById("productMainImage");
const productTitleEl = document.querySelector(".product-detail-title");
const skuChipEl = document.querySelector(".sku-chip");
const currentPriceEl = document.querySelector(".current-price");
const oldPriceEl = document.querySelector(".old-price");
const ratingChipEl = document.querySelector(".rating-chip");
const productThumbsEl = document.querySelector(".product-thumbs");
const breadcrumbProductEl = document.querySelector(".breadcrumbs > span:last-of-type");
const descriptionTabEl = document.getElementById("description");
const specsTabEl = document.getElementById("specs");
const colorValueLabelEl = document.getElementById("colorValueLabel");
const colorOptionsRowEl = document.getElementById("colorOptionsRow");
const defaultDescriptionHtml = descriptionTabEl?.innerHTML || "";
const defaultSpecsHtml = specsTabEl?.innerHTML || "";
let activePhotoIndex = 0;
let currentPhotos = [];
let dragStartX = 0;
let dragStartIndex = 0;
let isDraggingPhoto = false;
let activeColorId = "";
let currentColorVariants = [];
let colorRenderContext = { title: "Товар", fallbackPhotos: [] };

function parsePriceText(text) {
  return Number(String(text || "").replace(/\s+/g, "").replace(/[^\d]/g, "")) || 0;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function normalizeTitleKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/gb\b/g, "")
    .replace(/[^a-zа-я0-9]+/gi, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getActiveLang() {
  const lang = typeof window.emirateLang === "function"
    ? window.emirateLang()
    : (localStorage.getItem("emirate_lang") || "ru");
  return lang === "uz" ? "uz" : "ru";
}

function normalizeSpec(spec) {
  const keyRu = String(spec?.keyRu || spec?.key || "").trim();
  const keyUz = String(spec?.keyUz || "").trim();
  const valueRu = String(spec?.valueRu || spec?.value || "").trim();
  const valueUz = String(spec?.valueUz || "").trim();
  if (!(keyRu || keyUz) || !(valueRu || valueUz)) return null;
  return {
    keyRu,
    keyUz,
    valueRu,
    valueUz,
    key: keyRu || keyUz,
    value: valueRu || valueUz
  };
}

function normalizeColorVariant(variant) {
  const nameRu = String(variant?.nameRu || variant?.name || "").trim();
  const nameUz = String(variant?.nameUz || "").trim();
  const photos = Array.isArray(variant?.photos) ? variant.photos.filter(Boolean) : [];
  if (!(nameRu || nameUz)) return null;
  const swatchRaw = String(variant?.swatch || "").trim().replace(/^#/, "");
  const swatch = /^[0-9a-f]{3,8}$/i.test(swatchRaw) ? `#${swatchRaw}` : "";
  return {
    id: String(variant?.id || `color_${nameRu || nameUz}`),
    nameRu,
    nameUz,
    name: nameRu || nameUz,
    status: variant?.status === "inactive" ? "inactive" : "active",
    swatch,
    photos
  };
}

function readSelectedProduct() {
  try {
    const raw = sessionStorage.getItem(SELECTED_PRODUCT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function readAdminProducts() {
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
        const title = item.nameRu || item.nameUz || "Товар";
        const rawPrice = parsePriceText(item.price);
        const rawOldPrice = parsePriceText(item.oldPrice) || rawPrice;
        const marked = window.emirateExchange?.resolveStorefrontPricesFromProduct
          ? window.emirateExchange.resolveStorefrontPricesFromProduct(item)
          : window.emirateSupabaseApi?.applyStorefrontMarkupToPrices
            ? window.emirateSupabaseApi.applyStorefrontMarkupToPrices(rawPrice, rawOldPrice)
            : (() => {
                const price = Math.round(rawPrice * 1.2);
                const oldPrice = rawOldPrice > 0 ? Math.round(rawOldPrice * 1.2) : price;
                return { price, oldPrice: Math.max(oldPrice, price) };
              })();
        const price = marked.price;
        const oldPrice = marked.oldPrice;
        const photos = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
        return {
          title,
          brand: item.brand || title.split(" ")[0] || "",
          category: item.category || "Смартфоны",
          price,
          oldPrice,
          rating: Number(item.rating || 4.6),
          reviews: Number(item.reviews || 0),
          badge: item.promo === "yes" ? "sale" : (item.express === "yes" ? "hit" : "new"),
          image: photos[0] || "",
          photos,
          sku: item.id || "",
          descUz: String(item.descUz || "").trim(),
          descRu: String(item.descRu || "").trim(),
          specs: Array.isArray(item.specs)
            ? item.specs.map((spec) => normalizeSpec(spec)).filter(Boolean)
            : [],
          colors: Array.isArray(item.colors)
            ? item.colors.map((variant) => normalizeColorVariant(variant)).filter(Boolean)
            : []
        };
      });
  } catch (_) {
    return [];
  }
}

function fallbackCurrentProduct() {
  const title = productTitleEl?.textContent?.trim() || "Товар";
  const ratingText = ratingChipEl?.textContent || "";
  const ratingMatch = ratingText.match(/(\d+(?:[.,]\d+)?)/);
  const reviewsMatch = ratingText.match(/\((\d+)/);
  return {
    title,
    brand: title.split(" ")[0] || "",
    category: "Смартфоны",
    price: parsePriceText(currentPriceEl?.textContent),
    oldPrice: parsePriceText(oldPriceEl?.textContent),
    rating: ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : 0,
    reviews: reviewsMatch ? Number(reviewsMatch[1]) : 0,
    badge: "hit",
    image: "",
    photos: [],
    sku: "",
    descUz: "",
    descRu: "",
    specs: [],
    colors: []
  };
}

function resolvePageProduct() {
  const selected = readSelectedProduct();
  const adminProducts = readAdminProducts();
  const queryTitle = new URLSearchParams(window.location.search).get("product") || "";
  const queryKey = normalizeTitleKey(queryTitle);
  const selectedKey = normalizeTitleKey(selected?.title || "");
  const targetKey = queryKey || selectedKey;
  const selectedSku = String(selected?.sku || "").trim();
  const adminMatch = targetKey
    ? adminProducts.find((item) => normalizeTitleKey(item.title) === targetKey)
    : null;
  const adminMatchBySku = selectedSku
    ? adminProducts.find((item) => String(item.sku || "").trim() === selectedSku)
    : null;
  const resolvedAdmin = adminMatch || adminMatchBySku;

  if (resolvedAdmin && selected) {
    return {
      ...selected,
      ...resolvedAdmin,
      photos: resolvedAdmin.photos?.length ? resolvedAdmin.photos : (selected.photos || []),
      image: resolvedAdmin.image || selected.image || ""
    };
  }

  if (queryKey) {
    if (resolvedAdmin) return resolvedAdmin;
    if (selected && normalizeTitleKey(selected.title) === queryKey) {
      return selected;
    }
  }

  return resolvedAdmin || selected || fallbackCurrentProduct();
}

let currentProduct = resolvePageProduct();

function renderMainImage(src, title, options = {}) {
  if (!mainImageEl) return;
  const animate = options.animate === true;
  const direction = options.direction === "left" ? "left" : "right";

  if (animate) {
    mainImageEl.classList.remove("turn-left", "turn-right");
  }

  if (src) {
    mainImageEl.innerHTML = `<img class="product-main-photo" src="${src}" alt="${title}">`;
  } else {
    mainImageEl.innerHTML = `
      <svg width="80" height="80" fill="none" stroke="#cbd5e1" stroke-width="1" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <path d="M21 15l-5-5L5 21"/>
      </svg>
      <span>${title}</span>
    `;
  }

  if (animate) {
    const className = direction === "left" ? "turn-left" : "turn-right";
    mainImageEl.classList.add(className);
    setTimeout(() => mainImageEl.classList.remove(className), 520);
  }
}

function renderThumbs(photos, title) {
  if (!productThumbsEl) return;
  const list = photos.length ? photos : [""];
  currentPhotos = list.slice(0, 6);
  productThumbsEl.innerHTML = list
    .slice(0, 6)
    .map((src, idx) => `
      <button class="thumb ${idx === 0 ? "active" : ""}" type="button" data-idx="${idx}" data-image="${src}">
        ${src
          ? `<img class="product-thumb-photo" src="${src}" alt="${title} ${idx + 1}">`
          : `<svg width="28" height="28" fill="none" stroke="#94a3b8" stroke-width="1" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`
        }
      </button>
    `)
    .join("");
}

function setActiveThumb(index) {
  if (!productThumbsEl) return;
  productThumbsEl.querySelectorAll(".thumb").forEach((item) => {
    const thumbIndex = Number(item.getAttribute("data-idx") || -1);
    item.classList.toggle("active", thumbIndex === index);
  });
}

function getPhotoAt(index) {
  if (!currentPhotos.length) return "";
  const next = Math.max(0, Math.min(currentPhotos.length - 1, Number(index) || 0));
  return currentPhotos[next] || "";
}

function setPhotoFrame(index, options = {}) {
  if (!currentPhotos.length) return;
  const nextIndex = Math.max(0, Math.min(currentPhotos.length - 1, Number(index) || 0));
  if (nextIndex === activePhotoIndex && !options.force) return;
  const direction = nextIndex < activePhotoIndex ? "left" : "right";
  activePhotoIndex = nextIndex;
  setActiveThumb(nextIndex);
  renderMainImage(getPhotoAt(nextIndex), currentProduct.title || "Товар", {
    animate: options.animate !== false,
    direction
  });
}

function getColorDisplayName(variant, lang) {
  return lang === "uz"
    ? (variant.nameUz || variant.nameRu || variant.name || "")
    : (variant.nameRu || variant.nameUz || variant.name || "");
}

function renderColorButtons(lang) {
  if (!colorOptionsRowEl || !currentColorVariants.length) return;
  colorOptionsRowEl.innerHTML = currentColorVariants
    .map((variant) => `
      <button
        type="button"
        class="option-btn color-option-btn ${variant.id === activeColorId ? "active" : ""}"
        data-color-id="${escapeHtml(variant.id)}"
        style="${variant.swatch ? `--swatch:${escapeHtml(variant.swatch)}` : ""}"
      >${escapeHtml(getColorDisplayName(variant, lang))}</button>
    `)
    .join("");
}

function applyActiveColorVariant(lang) {
  if (!currentColorVariants.length) return;
  const activeVariant = currentColorVariants.find((item) => item.id === activeColorId) || currentColorVariants[0];
  activeColorId = activeVariant.id;
  if (colorValueLabelEl) {
    colorValueLabelEl.textContent = getColorDisplayName(activeVariant, lang);
  }
  renderColorButtons(lang);

  const photos = activeVariant.photos.length ? activeVariant.photos : colorRenderContext.fallbackPhotos;
  activePhotoIndex = 0;
  renderMainImage(photos[0] || "", colorRenderContext.title);
  renderThumbs(photos, colorRenderContext.title);
}

function hydratePageProduct(product) {
  const title = product.title || "Товар";
  const price = Number(product.price) || 0;
  const oldPrice = Number(product.oldPrice) || price;
  const rating = Number(product.rating) || 4.6;
  const reviews = Number(product.reviews) || 0;
  const sku = product.sku || `${(product.brand || "PRD").slice(0, 3).toUpperCase()}-${normalizeTitleKey(title).slice(0, 8).toUpperCase()}`;
  const photos = Array.isArray(product.photos) ? product.photos.filter(Boolean) : (product.image ? [product.image] : []);
  const descRu = String(product.descRu || "").trim();
  const descUz = String(product.descUz || "").trim();
  const specs = Array.isArray(product.specs)
    ? product.specs.map((item) => normalizeSpec(item)).filter(Boolean)
    : [];
  const colorVariants = Array.isArray(product.colors)
    ? product.colors.map((item) => normalizeColorVariant(item)).filter(Boolean)
    : [];
  const activeColorVariants = colorVariants.filter((item) => item.status !== "inactive");
  const lang = getActiveLang();

  if (productTitleEl) productTitleEl.textContent = title;
  if (breadcrumbProductEl) breadcrumbProductEl.textContent = title;
  if (currentPriceEl) currentPriceEl.textContent = `${formatMoney(price)} сум`;
  if (oldPriceEl) oldPriceEl.textContent = oldPrice > price ? `${formatMoney(oldPrice)} сум` : "";
  if (skuChipEl) skuChipEl.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ${sku}`;
  if (ratingChipEl) {
    ratingChipEl.innerHTML = `<svg width="14" height="14" fill="#f59e0b" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> ${rating.toFixed(1)} <span class="reviews-count">(${reviews} отзыва)</span>`;
  }

  document.title = `${title} — Emirate Co`;

  colorRenderContext = { title, fallbackPhotos: photos };
  currentColorVariants = activeColorVariants;

  if (currentColorVariants.length) {
    if (!activeColorId || !currentColorVariants.some((item) => item.id === activeColorId)) {
      activeColorId = currentColorVariants[0].id;
    }
    applyActiveColorVariant(lang);
  } else {
    activeColorId = "";
    activePhotoIndex = 0;
    renderMainImage(photos[0] || product.image || "", title);
    renderThumbs(photos, title);
  }

  if (descriptionTabEl) {
    const descriptionText = lang === "uz" ? (descUz || descRu) : (descRu || descUz);
    const aboutTitle = window.emirateT?.("product.aboutTitle") || (lang === "uz" ? "Mahsulot haqida" : "О товаре");
    if (descriptionText) {
      const paragraphs = descriptionText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("");
      descriptionTabEl.innerHTML = `<h3>${escapeHtml(aboutTitle)}</h3>${paragraphs}`;
    } else {
      descriptionTabEl.innerHTML = defaultDescriptionHtml;
    }
  }

  if (specsTabEl) {
    if (specs.length) {
      specsTabEl.innerHTML = `
        <div class="specs-list">
          ${specs.map((spec) => {
            const key = lang === "uz" ? (spec.keyUz || spec.keyRu) : (spec.keyRu || spec.keyUz);
            const value = lang === "uz" ? (spec.valueUz || spec.valueRu) : (spec.valueRu || spec.valueUz);
            return `<div class="spec-row"><span class="spec-label">${escapeHtml(key)}</span><span class="spec-value">${escapeHtml(value)}</span></div>`;
          }).join("")}
        </div>
      `;
    } else {
      specsTabEl.innerHTML = defaultSpecsHtml;
    }
  }
}

hydratePageProduct(currentProduct);
window.emirateAddViewedProduct?.(currentProduct);

void (async () => {
  const api = window.emirateSupabaseApi;
  if (!api || !api.isConfigured()) return;
  const q = new URLSearchParams(window.location.search).get("product") || "";
  if (!q.trim()) return;
  try {
    const remote = await api.fetchProductForPageByTitle(q);
    if (!remote) return;
    currentProduct = { ...currentProduct, ...remote };
    hydratePageProduct(currentProduct);
    document.querySelectorAll(".wishlist-btn").forEach((btn) => {
      btn.setAttribute("data-product-id", currentProduct.title || "product");
    });
    window.emirateSyncFavoritesUI?.();
  } catch (err) {
    console.warn("[Supabase] product", err);
  }
})();

colorOptionsRowEl?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-color-id]");
  if (!button) return;
  const colorId = button.getAttribute("data-color-id");
  if (!colorId || colorId === activeColorId) return;
  activeColorId = colorId;
  applyActiveColorVariant(getActiveLang());
});
document.getElementById("langSwitch")?.addEventListener("click", () => {
  hydratePageProduct(currentProduct);
});

document.querySelectorAll(".wishlist-btn").forEach((btn) => {
  btn.setAttribute("data-product-id", currentProduct.title || "product");
});
window.emirateSyncFavoritesUI?.();

let qty = 1;

function renderQty() {
  if (qtyValueEl) qtyValueEl.textContent = String(qty);
}

qtyMinusBtn?.addEventListener("click", () => {
  qty = Math.max(1, qty - 1);
  renderQty();
});

qtyPlusBtn?.addEventListener("click", () => {
  qty = Math.min(99, qty + 1);
  renderQty();
});

addToCartBtn?.addEventListener("click", () => {
  window.emirateAddToCart?.(currentProduct, qty);
  addToCartBtn.classList.add("added");
  addToCartBtn.innerHTML = `
    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
    Добавлено (${qty})
  `;
  setTimeout(() => {
    addToCartBtn.classList.remove("added");
    addToCartBtn.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
      </svg>
      В корзину
    `;
  }, 1500);
});

buyNowBtn?.addEventListener("click", () => {
  window.emirateAddToCart?.(currentProduct, qty);
  buyNowBtn.innerHTML = `
    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
    Оформляем...
  `;
  setTimeout(() => {
    buyNowBtn.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      Купить сейчас
    `;
  }, 1500);
});

productThumbsEl?.addEventListener("click", (event) => {
  const thumb = event.target.closest(".thumb");
  if (!thumb) return;
  const nextIndex = Number(thumb.getAttribute("data-idx") || 0);
  setPhotoFrame(nextIndex, { animate: true });
});

mainImageEl?.addEventListener("pointerdown", (event) => {
  if (!currentPhotos.length || currentPhotos.length < 2) return;
  dragStartX = event.clientX;
  dragStartIndex = activePhotoIndex;
  isDraggingPhoto = true;
  mainImageEl.classList.add("is-dragging");
  mainImageEl.setPointerCapture?.(event.pointerId);
});

mainImageEl?.addEventListener("pointermove", (event) => {
  if (!isDraggingPhoto || !currentPhotos.length || currentPhotos.length < 2) return;
  const shift = event.clientX - dragStartX;
  const stepPx = Math.max(36, mainImageEl.clientWidth / Math.max(2, currentPhotos.length - 1));
  const frameShift = Math.round(shift / stepPx);
  const target = dragStartIndex + frameShift;
  setPhotoFrame(target, { animate: true });
});

function releasePhotoDrag(pointerId) {
  isDraggingPhoto = false;
  mainImageEl?.classList.remove("is-dragging");
  if (pointerId !== undefined) {
    mainImageEl?.releasePointerCapture?.(pointerId);
  }
}

mainImageEl?.addEventListener("pointerup", (event) => releasePhotoDrag(event.pointerId));
mainImageEl?.addEventListener("pointercancel", (event) => releasePhotoDrag(event.pointerId));
mainImageEl?.addEventListener("pointerleave", () => releasePhotoDrag());

document.querySelectorAll(".option-row").forEach((row) => {
  if (row.getAttribute("data-role") === "color-options" && currentColorVariants.length) return;
  row.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      row.querySelectorAll(".option-btn").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
    });
  });
});

const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-tab");
    tabBtns.forEach((item) => item.classList.remove("active"));
    tabContents.forEach((item) => item.classList.remove("active"));
    btn.classList.add("active");
    if (target) document.getElementById(target)?.classList.add("active");
  });
});

document.querySelectorAll(".wishlist-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const isActive = window.emirateToggleFavorite?.(currentProduct.title || "product");
    btn.classList.toggle("active", Boolean(isActive));
    const svg = btn.querySelector("svg");
    if (svg) svg.setAttribute("fill", isActive ? "#ef4444" : "none");
  });
});
