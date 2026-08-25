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
const memoryOptionsRowEl = document.getElementById("memoryOptionsRow");
const memoryOptionGroupEl = document.getElementById("memoryOptionGroup");
const memoryValueLabelEl = document.getElementById("memoryValueLabel");
const memoryAttrLabelEl = document.getElementById("memoryAttrLabel");
const installmentAmountEl = document.getElementById("installmentAmount");
const defaultDescriptionHtml = descriptionTabEl?.innerHTML || "";
const defaultSpecsHtml = specsTabEl?.innerHTML || "";
const reviewsTabEl = document.getElementById("reviews");
const reviewsTabBtn = document.querySelector('.tab-btn[data-tab="reviews"]');
const similarSectionEl = document.getElementById("similarProductsSection");
const similarGridEl = document.getElementById("similarProductsGrid");
const similarCategoryLinkEl = document.getElementById("similarCategoryLink");
const productFactsEl = document.getElementById("productFacts");
const productSkuCopyBtn = document.getElementById("productSkuCopyBtn");
let similarProductsSource = [];
let activePhotoIndex = 0;
let currentPhotos = [];
let dragStartX = 0;
let dragStartIndex = 0;
let isDraggingPhoto = false;
let activeMemoryId = "";
let currentMemoryVariants = [];
let baseProductPrices = { price: 0, oldPrice: 0 };
let activeColorId = "";
let currentColorVariants = [];
let colorRenderContext = { title: "Товар", fallbackPhotos: [] };

function readRequestedColorId() {
  const fromUrl = (new URLSearchParams(window.location.search).get("color") || "").trim();
  if (fromUrl) return fromUrl;
  return String(currentProduct?.listingColorId || currentProduct?.colorId || "").trim();
}

function findColorVariantByQuery(variants, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q || !Array.isArray(variants)) return null;
  return (
    variants.find((item) => String(item.id || "").toLowerCase() === q) ||
    variants.find((item) =>
      [item.name, item.nameRu, item.nameUz].some((name) => String(name || "").trim().toLowerCase() === q)
    ) ||
    null
  );
}

function syncColorQuery(colorId) {
  try {
    const url = new URL(window.location.href);
    if (colorId) url.searchParams.set("color", colorId);
    else url.searchParams.delete("color");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch (_) {}
}

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

function renderDescriptionBlock(descriptionText, aboutTitle) {
  if (!descriptionText) return "";
  const lang = getActiveLang();
  const moreLabel = lang === "uz" ? "Batafsil" : "Подробнее";
  const lessLabel = lang === "uz" ? "Yopish" : "Свернуть";
  let bodyHtml = "";
  if (/<[a-z][\s\S]*>/i.test(descriptionText)) {
    bodyHtml = descriptionText;
  } else {
    bodyHtml = descriptionText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");
  }
  return `
    <h3>${escapeHtml(aboutTitle)}</h3>
    <div class="product-desc-clamp" id="productDescClamp">
      <div class="product-desc-body">${bodyHtml}</div>
    </div>
    <button type="button" class="product-desc-more" id="productDescMoreBtn" data-more="${escapeHtml(moreLabel)}" data-less="${escapeHtml(lessLabel)}" hidden>${escapeHtml(moreLabel)}</button>
  `;
}

function setupDescriptionClamp() {
  const clamp = document.getElementById("productDescClamp");
  const btn = document.getElementById("productDescMoreBtn");
  if (!clamp || !btn) return;
  clamp.classList.remove("is-expanded");
  // Measure after paint
  requestAnimationFrame(() => {
    const overflows = clamp.scrollHeight > clamp.clientHeight + 8;
    btn.hidden = !overflows;
    btn.textContent = btn.getAttribute("data-more") || "Подробнее";
    btn.onclick = () => {
      const expanded = clamp.classList.toggle("is-expanded");
      btn.textContent = expanded
        ? (btn.getAttribute("data-less") || "Свернуть")
        : (btn.getAttribute("data-more") || "Подробнее");
    };
  });
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

function normalizeMemoryVariant(variant) {
  const nameRu = String(variant?.nameRu || variant?.name || "").trim();
  const nameUz = String(variant?.nameUz || "").trim();
  if (!(nameRu || nameUz)) return null;
  return {
    id: String(variant?.id || `memory_${nameRu || nameUz}`),
    nameRu,
    nameUz,
    name: nameRu || nameUz,
    status: variant?.status === "inactive" ? "inactive" : "active",
    priceUsd: variant?.priceUsd != null ? variant.priceUsd : "",
    oldPriceUsd: variant?.oldPriceUsd != null ? variant.oldPriceUsd : "",
    price: String(variant?.price || "").trim(),
    oldPrice: String(variant?.oldPrice || "").trim()
  };
}

function resolveMemoryVariantPrices(variant) {
  if (!variant) return { price: 0, oldPrice: 0 };
  if (window.emirateExchange?.resolveStorefrontPricesFromProduct) {
    return window.emirateExchange.resolveStorefrontPricesFromProduct(variant);
  }
  if (window.emirateSupabaseApi?.applyStorefrontMarkupToPrices) {
    const rawPrice = parsePriceText(variant.price);
    const rawOldPrice = parsePriceText(variant.oldPrice) || rawPrice;
    return window.emirateSupabaseApi.applyStorefrontMarkupToPrices(rawPrice, rawOldPrice);
  }
  const price = parsePriceText(variant.price);
  const oldPrice = parsePriceText(variant.oldPrice) || price;
  return { price, oldPrice: Math.max(oldPrice, price) };
}

function getMemoryDisplayName(variant, lang) {
  return lang === "uz"
    ? (variant.nameUz || variant.nameRu || variant.name || "")
    : (variant.nameRu || variant.nameUz || variant.name || "");
}

function updateProductPriceUi(price, oldPrice) {
  if (currentPriceEl) currentPriceEl.textContent = `${formatMoney(price)} сум`;
  if (oldPriceEl) oldPriceEl.textContent = oldPrice > price ? `${formatMoney(oldPrice)} сум` : "";
  if (installmentAmountEl) {
    installmentAmountEl.textContent = `${formatMoney(Math.round(price / 12))} сум/мес`;
  }
  currentProduct.price = price;
  currentProduct.oldPrice = oldPrice;
}

function renderMemoryButtons(lang) {
  if (!memoryOptionsRowEl) return;
  memoryOptionsRowEl.innerHTML = currentMemoryVariants
    .map((variant) => `
      <button
        type="button"
        class="option-btn memory-option-btn ${variant.id === activeMemoryId ? "active" : ""}"
        data-memory-id="${escapeHtml(variant.id)}"
      >${escapeHtml(getMemoryDisplayName(variant, lang))}</button>
    `)
    .join("");
}

function applyActiveMemoryVariant(lang) {
  if (!currentMemoryVariants.length) {
    if (memoryOptionGroupEl) memoryOptionGroupEl.hidden = true;
    updateProductPriceUi(baseProductPrices.price, baseProductPrices.oldPrice);
    return;
  }

  const activeVariant = currentMemoryVariants.find((item) => item.id === activeMemoryId) || currentMemoryVariants[0];
  activeMemoryId = activeVariant.id;
  const marked = resolveMemoryVariantPrices(activeVariant);
  if (memoryOptionGroupEl) memoryOptionGroupEl.hidden = false;
  if (memoryAttrLabelEl) {
    const attrLabel = lang === "uz"
      ? (currentProduct.memoryMeta?.nameUz || currentProduct.memoryMeta?.nameRu || "Xotira")
      : (currentProduct.memoryMeta?.nameRu || currentProduct.memoryMeta?.nameUz || "Память");
    memoryAttrLabelEl.textContent = attrLabel;
  }
  if (memoryValueLabelEl) {
    memoryValueLabelEl.textContent = getMemoryDisplayName(activeVariant, lang);
  }
  renderMemoryButtons(lang);
  updateProductPriceUi(marked.price, marked.oldPrice);
  currentProduct.selectedMemory = getMemoryDisplayName(activeVariant, lang);
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
        const uploadedPhotos = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
        const media = window.emirateResolveProductMedia?.({
          title,
          sku: item.id || "",
          brand: item.brand || "",
          category: item.category || "Смартфоны",
          photos: uploadedPhotos,
          image: uploadedPhotos[0] || ""
        }) || { image: uploadedPhotos[0] || "", photos: uploadedPhotos };
        return {
          title,
          nameRu: String(item.nameRu || "").trim(),
          nameUz: String(item.nameUz || "").trim(),
          brand: item.brand || "",
          model: String(item.model || "").trim(),
          category: item.category || "Смартфоны",
          price,
          oldPrice,
          rating: Number(item.rating) || 0,
          reviews: Number(item.reviews) || 0,
          reviewItems: Array.isArray(item.reviewItems) ? item.reviewItems : [],
          badge: item.promo === "yes" ? "sale" : (item.express === "yes" ? "hit" : "new"),
          image: media.image,
          photos: media.photos,
          sku: item.id || "",
          descUz: String(item.descUz || "").trim(),
          descRu: String(item.descRu || "").trim(),
          seoTitleRu: String(item.seoTitleRu || "").trim(),
          seoTitleUz: String(item.seoTitleUz || "").trim(),
          seoDescRu: String(item.seoDescRu || "").trim(),
          seoDescUz: String(item.seoDescUz || "").trim(),
          specs: Array.isArray(item.specs)
            ? item.specs.map((spec) => normalizeSpec(spec)).filter(Boolean)
            : [],
          colors: Array.isArray(item.colors)
            ? item.colors.map((variant) => normalizeColorVariant(variant)).filter(Boolean)
            : [],
          memoryVariants: Array.isArray(item.memoryVariants)
            ? item.memoryVariants.map((variant) => normalizeMemoryVariant(variant)).filter(Boolean)
            : [],
          memoryMeta: item.memoryMeta && typeof item.memoryMeta === "object"
            ? {
                nameRu: String(item.memoryMeta.nameRu || "Память").trim() || "Память",
                nameUz: String(item.memoryMeta.nameUz || "Xotira").trim() || "Xotira",
                status: item.memoryMeta.status === "inactive" ? "inactive" : "active"
              }
            : { nameRu: "Память", nameUz: "Xotira", status: "active" }
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
    ? adminProducts.find((item) =>
        normalizeTitleKey(item.title) === targetKey ||
        normalizeTitleKey(item.nameRu) === targetKey ||
        normalizeTitleKey(item.nameUz) === targetKey
      )
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

  const resolved = resolvedAdmin || selected || fallbackCurrentProduct();
  const media = window.emirateResolveProductMedia?.(resolved);
  if (!media) return resolved;
  return { ...resolved, image: media.image, photos: media.photos };
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
  renderGalleryDots(0);
}

function setActiveThumb(index) {
  if (!productThumbsEl) return;
  productThumbsEl.querySelectorAll(".thumb").forEach((item) => {
    const thumbIndex = Number(item.getAttribute("data-idx") || -1);
    item.classList.toggle("active", thumbIndex === index);
  });
  renderGalleryDots(index);
}

function renderGalleryDots(activeIndex = activePhotoIndex) {
  const dotsEl = document.getElementById("productGalleryDots");
  if (!dotsEl) return;
  const count = currentPhotos.length;
  if (count < 2) {
    dotsEl.hidden = true;
    dotsEl.innerHTML = "";
    return;
  }
  dotsEl.hidden = false;
  dotsEl.innerHTML = currentPhotos
    .map((_, idx) => `<button type="button" class="product-gallery-dot ${idx === activeIndex ? "is-active" : ""}" data-idx="${idx}" aria-label="Фото ${idx + 1}"></button>`)
    .join("");
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

function renderProductReviews(product, lang) {
  var reviewData = window.emirateResolveProductReviews
    ? window.emirateResolveProductReviews(product)
    : { rating: 0, count: 0, items: [] };
  var count = reviewData.count;
  var rating = reviewData.rating;
  var items = reviewData.items;
  var noReviewsText = window.emirateT?.("product.noReviews") || "Пока нет отзывов";
  var noReviewsHint = window.emirateT?.("product.noReviewsHint") || "Оставьте отзыв после покупки";
  var tabReviewsLabel = window.emirateT?.("product.tabReviews") || "Отзывы";

  if (ratingChipEl) {
    var chipHtml = window.emirateProductRatingChipHtml?.(product, lang) || "";
    ratingChipEl.innerHTML = chipHtml;
    ratingChipEl.hidden = !chipHtml;
  }

  if (reviewsTabBtn) {
    reviewsTabBtn.innerHTML =
      '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> ' +
      tabReviewsLabel +
      (count > 0 ? " (" + count + ")" : "");
  }

  if (!reviewsTabEl) return;

  if (count <= 0) {
    reviewsTabEl.innerHTML =
      '<div class="reviews-empty">' +
        '<p class="reviews-empty-title">' + escapeHtml(noReviewsText) + "</p>" +
        '<p class="reviews-empty-hint">' + escapeHtml(noReviewsHint) + "</p>" +
      "</div>";
    return;
  }

  var stars = window.emirateFormatReviewStars?.(rating) || "";
  var countLabel = window.emirateReviewsCountLabel?.(count, lang) || String(count);
  var itemsHtml = items.map(function (review) {
    var itemStars = window.emirateFormatReviewStars?.(review.rating) || "";
    var dateText = window.emirateFormatReviewDate?.(review.date) || "";
    return (
      '<div class="review-item">' +
        '<div class="review-header">' +
          "<strong>" + escapeHtml(review.author) + "</strong>" +
          (dateText ? '<span class="review-date">' + escapeHtml(dateText) + "</span>" : "") +
          '<span class="review-rating">' + itemStars + "</span>" +
        "</div>" +
        (review.text ? "<p>" + escapeHtml(review.text) + "</p>" : "") +
      "</div>"
    );
  }).join("");

  reviewsTabEl.innerHTML =
    '<div class="review-summary">' +
      '<div class="review-score">' +
        '<span class="score-number">' + rating.toFixed(1) + "</span>" +
        '<div class="score-stars">' + stars + "</div>" +
        '<span class="score-count">' + escapeHtml(countLabel) + "</span>" +
      "</div>" +
    "</div>" +
    itemsHtml;
}

function renderProductFacts(product, lang, skuValue) {
  if (!productFactsEl) return;

  const sku = String(skuValue || product.sku || "").trim();
  const brand = String(product.brand || "").trim();
  const model = String(product.model || "").trim();

  productFactsEl.hidden = false;

  const skuEl = document.getElementById("productFactSku");
  if (skuEl) skuEl.textContent = sku || "—";

  const brandRow = document.getElementById("productBrandRow");
  const brandLink = document.getElementById("productBrandLink");
  const brandNameEl = document.getElementById("productBrandName");
  const brandLogoEl = document.getElementById("productBrandLogo");

  if (brand && brandRow && brandLink && brandNameEl) {
    brandRow.hidden = false;
    const brandMeta = window.emirateBrands?.getBrandByName?.(brand);
    const displayName =
      window.emirateBrands?.getBrandDisplayName?.(brandMeta || { nameRu: brand, nameUz: brand }, lang) || brand;
    brandNameEl.textContent = displayName;
    brandLink.href =
      window.emirateBrands?.buildBrandCatalogUrl?.(brandMeta || { nameRu: brand }) ||
      ("catalog.html?brand=" + encodeURIComponent(brand));
    if (brandLogoEl) {
      if (brandMeta?.logoUrl) {
        brandLogoEl.src = brandMeta.logoUrl;
        brandLogoEl.alt = displayName;
        brandLogoEl.hidden = false;
      } else {
        brandLogoEl.hidden = true;
        brandLogoEl.removeAttribute("src");
      }
    }
  } else if (brandRow) {
    brandRow.hidden = true;
  }

  const modelRow = document.getElementById("productModelRow");
  const modelEl = document.getElementById("productFactModel");
  if (model && modelRow && modelEl) {
    modelRow.hidden = false;
    modelEl.textContent = model;
  } else if (modelRow) {
    modelRow.hidden = true;
  }
}

function hydratePageProduct(product) {
  const title = product.title || "Товар";
  const displayTitle = window.emirateProductDisplayTitle?.(product) || title;
  const price = Number(product.price) || 0;
  const oldPrice = Number(product.oldPrice) || price;
  const sku = product.sku || `${(product.brand || "PRD").slice(0, 3).toUpperCase()}-${normalizeTitleKey(title).slice(0, 8).toUpperCase()}`;
  const media = window.emirateResolveProductMedia?.(product) || {
    image: product.image || "",
    photos: Array.isArray(product.photos) ? product.photos.filter(Boolean) : (product.image ? [product.image] : [])
  };
  const photos = media.photos;
  const descRu = String(product.descRu || "").trim();
  const descUz = String(product.descUz || "").trim();
  const specs = Array.isArray(product.specs)
    ? product.specs.map((item) => normalizeSpec(item)).filter(Boolean)
    : [];
  const colorVariants = Array.isArray(product.colors)
    ? product.colors.map((item) => normalizeColorVariant(item)).filter(Boolean)
    : [];
  const activeColorVariants = colorVariants.filter((item) => item.status !== "inactive");
  const memoryVariants = Array.isArray(product.memoryVariants)
    ? product.memoryVariants.map((item) => normalizeMemoryVariant(item)).filter(Boolean)
    : [];
  const activeMemoryVariants = memoryVariants.filter((item) => item.status !== "inactive");
  const lang = getActiveLang();

  baseProductPrices = { price, oldPrice };
  currentMemoryVariants = activeMemoryVariants;
  if (product.memoryMeta) currentProduct.memoryMeta = product.memoryMeta;

  if (productTitleEl) productTitleEl.textContent = displayTitle;
  if (breadcrumbProductEl) breadcrumbProductEl.textContent = displayTitle;
  if (currentPriceEl) currentPriceEl.textContent = `${formatMoney(price)} сум`;
  if (oldPriceEl) oldPriceEl.textContent = oldPrice > price ? `${formatMoney(oldPrice)} сум` : "";
  if (skuChipEl) skuChipEl.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ${sku}`;
  renderProductFacts(product, lang, sku);
  renderProductReviews(product, lang);

  window.emirateProductSeo?.(product);

  colorRenderContext = { title, fallbackPhotos: photos };
  currentColorVariants = activeColorVariants;

  if (currentColorVariants.length) {
    const requested = findColorVariantByQuery(currentColorVariants, readRequestedColorId());
    if (requested) {
      activeColorId = requested.id;
    } else if (!activeColorId || !currentColorVariants.some((item) => item.id === activeColorId)) {
      activeColorId = currentColorVariants[0].id;
    }
    applyActiveColorVariant(lang);
  } else {
    activeColorId = "";
    activePhotoIndex = 0;
    renderMainImage(photos[0] || product.image || "", title);
    renderThumbs(photos, title);
  }

  if (currentMemoryVariants.length) {
    if (!activeMemoryId || !currentMemoryVariants.some((item) => item.id === activeMemoryId)) {
      activeMemoryId = currentMemoryVariants[0].id;
    }
    applyActiveMemoryVariant(lang);
  } else {
    activeMemoryId = "";
    applyActiveMemoryVariant(lang);
  }

  if (descriptionTabEl) {
    const descriptionText = lang === "uz" ? (descUz || descRu) : (descRu || descUz);
    const aboutTitle = window.emirateT?.("product.aboutTitle") || (lang === "uz" ? "Mahsulot haqida" : "О товаре");
    if (descriptionText) {
      descriptionTabEl.innerHTML = renderDescriptionBlock(descriptionText, aboutTitle);
      setupDescriptionClamp();
    } else {
      descriptionTabEl.innerHTML = defaultDescriptionHtml;
      setupDescriptionClamp();
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

  void loadSimilarProducts(product);
}

function pickSimilarProducts(allProducts, currentProduct, limit = 8) {
  const currentKey = normalizeTitleKey(currentProduct?.title);
  const category = String(currentProduct?.category || "").trim();
  if (!category) return [];

  const sameCategory = (allProducts || [])
    .filter((item) => normalizeTitleKey(item.title) !== currentKey && item.category === category);

  return sameCategory.slice(0, limit);
}

async function loadSimilarProducts(product) {
  if (!similarSectionEl || !similarGridEl || !product) return;

  let catalog = [];
  const api = window.emirateSupabaseApi;
  if (api?.isConfigured?.()) {
    try {
      catalog = await api.fetchPublicCatalogProducts();
    } catch (err) {
      console.warn("[Similar products]", err);
    }
  }
  if (!catalog.length) {
    catalog = readAdminProducts();
  }

  const similar = pickSimilarProducts(catalog, product, 8);
  if (!similar.length) {
    similarProductsSource = [];
    similarSectionEl.hidden = true;
    similarGridEl.innerHTML = "";
    return;
  }

  similarProductsSource = similar;
  const similarCards = window.emirateExpandColorListings
    ? window.emirateExpandColorListings(similar).slice(0, 8)
    : similar;
  similarGridEl.innerHTML = similarCards
    .map((item) => window.emirateRenderProductCard?.(item) || "")
    .join("");
  window.emirateSyncFavoritesUI?.(similarGridEl);

  if (similarCategoryLinkEl) {
    const category = String(product.category || "").trim();
    if (category) {
      similarCategoryLinkEl.href = "catalog.html?category=" + encodeURIComponent(category);
      similarCategoryLinkEl.hidden = false;
    } else {
      similarCategoryLinkEl.href = "catalog.html";
    }
  }

  similarSectionEl.hidden = false;
}

function buildSimilarProductFromCard(card) {
  if (!card) return null;
  const title =
    card.getAttribute("data-product-id") ||
    card.getAttribute("data-product-title") ||
    card.querySelector(".product-title")?.textContent?.trim() ||
    "";
  if (!title) return null;
  return (
    similarProductsSource.find((item) => item.title === title) ||
    window.emirateLookupProduct?.(title) ||
    null
  );
}

function onSimilarProductsGridClick(e) {
  const quickBuyBtn = e.target.closest("button.quick-buy-open");
  if (quickBuyBtn) {
    e.preventDefault();
    e.stopPropagation();
    const card = quickBuyBtn.closest(".product-card");
    let product = buildSimilarProductFromCard(card);
    if (!product && card) {
      const title = card.getAttribute("data-product-id") || "";
      const price = window.emirateParsePriceValue?.(
        card.querySelector(".product-price-value")?.textContent ||
          card.querySelector(".product-price")?.textContent
      );
      const imageEl = card.querySelector(".product-image-real");
      product = {
        title,
        price: price || 0,
        image: imageEl?.getAttribute("src") || "",
        brand: "",
        category: "",
      };
    }
    if (product?.title) window.emirateOpenQuickBuy?.(product, 1);
    return;
  }

  const cartBtn = e.target.closest(".add-to-cart-btn");
  if (cartBtn) {
    const card = cartBtn.closest(".product-card");
    const product = buildSimilarProductFromCard(card);
    if (product) window.emirateAddToCart?.(product, 1);
    cartBtn.classList.add("added");
    setTimeout(() => cartBtn.classList.remove("added"), 1500);
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
    return;
  }

  const productLink = e.target.closest(".product-link");
  if (productLink) {
    const card = productLink.closest(".product-card");
    const product = buildSimilarProductFromCard(card);
    if (product) {
      window.emirateAddViewedProduct?.(product);
      try {
        sessionStorage.setItem(SELECTED_PRODUCT_KEY, JSON.stringify(product));
      } catch (_) {}
    }
  }
}

similarGridEl?.addEventListener("click", onSimilarProductsGridClick);

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
    const merged = { ...currentProduct, ...remote };
    const media = window.emirateResolveProductMedia?.(merged);
    currentProduct = media ? { ...merged, image: media.image, photos: media.photos } : merged;
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
  syncColorQuery(colorId);
  applyActiveColorVariant(getActiveLang());
});

memoryOptionsRowEl?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-memory-id]");
  if (!button) return;
  const memoryId = button.getAttribute("data-memory-id");
  if (!memoryId || memoryId === activeMemoryId) return;
  activeMemoryId = memoryId;
  applyActiveMemoryVariant(getActiveLang());
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
  const stickyAdd = document.getElementById("stickyAddToCartBtn");
  if (stickyAdd) {
    stickyAdd.classList.add("added");
    stickyAdd.textContent = `Добавлено (${qty})`;
  }
  setTimeout(() => {
    addToCartBtn.classList.remove("added");
    addToCartBtn.innerHTML = `
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
      </svg>
      В корзину
    `;
    if (stickyAdd) {
      stickyAdd.classList.remove("added");
      stickyAdd.textContent = window.emirateT?.("product.addCart") || "В корзину";
    }
  }, 1500);
});

document.getElementById("stickyBuyNowBtn")?.addEventListener("click", () => {
  buyNowBtn?.click();
});
document.getElementById("stickyAddToCartBtn")?.addEventListener("click", () => {
  addToCartBtn?.click();
});

buyNowBtn?.addEventListener("click", () => {
  const qtyValue = Number(qtyValueEl?.textContent || qty) || 1;
  const payload = {
    ...currentProduct,
    price: parsePriceText(currentPriceEl?.textContent) || currentProduct.price,
    oldPrice: parsePriceText(oldPriceEl?.textContent) || currentProduct.oldPrice,
    image:
      currentProduct.image ||
      mainImageEl?.querySelector(".product-main-photo")?.getAttribute("src") ||
      "",
  };
  window.emirateOpenQuickBuy?.(payload, qtyValue);
});

productThumbsEl?.addEventListener("click", (event) => {
  const thumb = event.target.closest(".thumb");
  if (!thumb) return;
  const nextIndex = Number(thumb.getAttribute("data-idx") || 0);
  setPhotoFrame(nextIndex, { animate: true });
});

mainImageEl?.addEventListener("pointerdown", (event) => {
  if (!currentPhotos.length || currentPhotos.length < 2) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  dragStartX = event.clientX;
  dragStartIndex = activePhotoIndex;
  isDraggingPhoto = true;
  mainImageEl.classList.add("is-dragging");
  try {
    mainImageEl.setPointerCapture?.(event.pointerId);
  } catch (_) {}
});

mainImageEl?.addEventListener("pointermove", (event) => {
  if (!isDraggingPhoto) return;
  // Preview offset lightly without changing frame until release
  const shift = event.clientX - dragStartX;
  const photo = mainImageEl.querySelector(".product-main-photo");
  if (photo && Math.abs(shift) > 4) {
    photo.style.transform = `translateX(${shift * 0.35}px)`;
    photo.style.transition = "none";
  }
});

function releasePhotoDrag(event) {
  if (!isDraggingPhoto) return;
  const clientX = event?.clientX ?? dragStartX;
  const shift = clientX - dragStartX;
  const photo = mainImageEl?.querySelector(".product-main-photo");
  if (photo) {
    photo.style.transform = "";
    photo.style.transition = "";
  }
  isDraggingPhoto = false;
  mainImageEl?.classList.remove("is-dragging");
  if (event?.pointerId !== undefined) {
    try {
      mainImageEl?.releasePointerCapture?.(event.pointerId);
    } catch (_) {}
  }
  if (!currentPhotos.length || currentPhotos.length < 2) return;
  if (Math.abs(shift) < 40) return;
  if (shift < 0) {
    setPhotoFrame(Math.min(currentPhotos.length - 1, dragStartIndex + 1), { animate: true });
  } else {
    setPhotoFrame(Math.max(0, dragStartIndex - 1), { animate: true });
  }
}

mainImageEl?.addEventListener("pointerup", releasePhotoDrag);
mainImageEl?.addEventListener("pointercancel", releasePhotoDrag);
mainImageEl?.addEventListener("pointerleave", (event) => {
  if (isDraggingPhoto) releasePhotoDrag(event);
});

document.getElementById("productGalleryDots")?.addEventListener("click", (event) => {
  const dot = event.target.closest(".product-gallery-dot");
  if (!dot) return;
  setPhotoFrame(Number(dot.getAttribute("data-idx") || 0), { animate: true });
});

document.querySelectorAll(".option-row").forEach((row) => {
  if (row.getAttribute("data-role") === "color-options" && currentColorVariants.length) return;
  if (row.id === "memoryOptionsRow" && currentMemoryVariants.length) return;
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

productSkuCopyBtn?.addEventListener("click", function () {
  const sku = document.getElementById("productFactSku")?.textContent?.trim();
  if (!sku || sku === "—") return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(sku).catch(function () {});
  }
});
