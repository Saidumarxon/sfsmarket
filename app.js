/* ========================================
   EMIRATE CO — Home Page v4
   Categories + Carousel + Lazy Loading
   (shared logic is in common.js)
   ======================================== */

// ===== PRODUCT DATA BY CATEGORY (filled from Supabase or admin localStorage) =====
const productData = {
  smartphones: [],
  laptops: [],
  appliances: [],
  accessories: []
};

const HOME_CAROUSEL_IDS = [
  "carouselSmartphones",
  "carouselLaptops",
  "carouselAppliances",
  "carouselAccessories"
];

const feedProducts = [];

const ADMIN_PRODUCTS_KEY = "emirate_admin_products";
const ADMIN_BANNERS_KEY = "emirate_home_banners";
const SELECTED_PRODUCT_KEY = "emirate_selected_product";

const FEED_BATCH = 8; // products per batch
let feedIndex = 0;
const allProductsByTitle = new Map();
let homeStorefrontReady = false;

function isLiveStorefront() {
  return !!(window.emirateSupabaseApi?.isConfigured?.());
}

function setHomeStorefrontLoading(loading) {
  document.body.classList.toggle("home-storefront-loading", !!loading);
  const heroSlider = document.querySelector(".hero-slider");
  if (heroSlider) heroSlider.setAttribute("aria-busy", loading ? "true" : "false");
}

function renderCarouselSkeletonCard() {
  return `
    <article class="product-card product-card--skeleton" aria-hidden="true">
      <div class="product-card-top">
        <div class="product-image"></div>
      </div>
      <h3 class="product-title">—</h3>
      <div class="product-rating">—</div>
      <div class="product-price-row"><span class="product-price">—</span></div>
      <div class="product-installment">—</div>
      <div class="product-actions"><span class="add-to-cart-btn">—</span></div>
    </article>
  `;
}

function renderHomeCarouselSkeletons() {
  const skeleton = renderCarouselSkeletonCard().repeat(4);
  HOME_CAROUSEL_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = skeleton;
  });
}

function isNativeHome() {
  return document.documentElement.classList.contains("capacitor-app");
}

function updateCategorySectionsVisibility() {
  document.querySelectorAll(".category-section").forEach((section) => {
    if (isNativeHome()) {
      section.hidden = true;
      return;
    }
    const track = section.querySelector(".carousel-track");
    const count = track ? track.querySelectorAll(".product-card:not(.product-card--skeleton)").length : 0;
    section.hidden = count === 0;
  });
}

function collectAllHomeProducts() {
  const seen = new Set();
  const list = [];
  Object.values(productData).forEach((items) => {
    (items || []).forEach((item) => {
      const title = String(item?.title || "").trim();
      if (!title || seen.has(title)) return;
      seen.add(title);
      list.push(item);
    });
  });
  list.sort((a, b) => (Number(a.priority) || 300) - (Number(b.priority) || 300));
  return list;
}

function fillFeedProductsFromCatalog() {
  feedProducts.length = 0;
  collectAllHomeProducts().forEach((item) => feedProducts.push(item));
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseMoney(value) {
  return Number(String(value || "").replace(/\s+/g, "").replace(/[^\d]/g, "")) || 0;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function buildFallbackProductFromCard(card) {
  const title = card?.querySelector(".product-title")?.textContent?.trim() || "";
  if (!title) return null;
  return {
    title,
    brand: title.split(" ")[0] || "",
    category: "",
    price: parseMoney(card?.querySelector(".product-price")?.textContent),
    oldPrice: parseMoney(card?.querySelector(".product-old-price")?.textContent),
    rating: Number(card?.querySelector(".product-rating-num")?.textContent || 0) || 0,
    reviews: Number((card?.querySelector(".product-reviews")?.textContent || "").replace(/[^\d]/g, "")) || 0,
    badge: ""
  };
}

function toCatalogProductShape(product) {
  return {
    title: product.title,
    brand: product.brand || "",
    category: product.category || "",
    price: parseMoney(product.price),
    oldPrice: parseMoney(product.oldPrice),
    rating: Number(product.rating) || 0,
    reviews: Number(product.reviews) || 0,
    badge: product.badge || "",
    image: product.image || "",
    photos: Array.isArray(product.photos) ? product.photos.filter(Boolean) : (product.image ? [product.image] : []),
    priority: Number(product.priority) || 300,
    installmentStatus: product.installmentStatus || "active",
    express: product.express || "no"
  };
}

function saveSelectedProduct(product) {
  if (!product || typeof product !== "object") return;
  const media = window.emirateResolveProductMedia?.(product);
  const payload = media ? { ...product, image: media.image, photos: media.photos } : product;
  try {
    sessionStorage.setItem(SELECTED_PRODUCT_KEY, JSON.stringify(payload));
  } catch (_) {
    // Ignore quota/session errors for demo data.
  }
}

function mapAdminCategoryToHomeKey(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("\u0441\u043c\u0430\u0440\u0442\u0444")) return "smartphones";
  if (value.includes("\u043d\u043e\u0443\u0442\u0431") || value.includes("\u043d\u043e\u0443\u0442")) return "laptops";
  if (value.includes("\u0430\u043a\u0441\u0435\u0441\u0441") || value.includes("\u043a\u0440\u0430\u0441\u043e\u0442")) return "accessories";
  if (value.includes("\u0442\u0432") || value.includes("\u0430\u0443\u0434\u0438\u043e")) return "appliances";
  if (value.includes("\u0442\u0435\u0445\u043d\u0438\u043a") || value.includes("\u0434\u043e\u043c")) return "appliances";
  return "accessories";
}

function normalizeTitleKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/gb\b/g, "")
    .replace(/[^a-zа-я0-9]+/gi, "");
}

function getAdminProductsForStorefront() {
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
        const marked = window.emirateExchange?.resolveStorefrontPricesFromProduct
          ? window.emirateExchange.resolveStorefrontPricesFromProduct(item)
          : window.emirateSupabaseApi?.applyStorefrontMarkupToPrices
            ? window.emirateSupabaseApi.applyStorefrontMarkupToPrices(parseMoney(item.price), parseMoney(item.oldPrice))
            : (() => {
                const base = parseMoney(item.price);
                const oldBase = parseMoney(item.oldPrice);
                const price = Math.round(base * 1.2);
                const oldPrice = oldBase > 0 ? Math.round(oldBase * 1.2) : price;
                return { price, oldPrice: Math.max(oldPrice, price) };
              })();
        const priceNum = marked.price;
        const safeOldPrice = marked.oldPrice;
        const discount = Math.max(0, Math.round((1 - priceNum / (safeOldPrice || priceNum || 1)) * 100));
        const promoEnabled = item.promo === "yes";
        const expressEnabled = item.express === "yes";
        const installmentStatus = item.installmentStatus === "inactive" ? "inactive" : "active";
        const priority = Number(item.priority);
        return {
          title: item.nameRu || item.nameUz || "\u0422\u043e\u0432\u0430\u0440",
          price: formatMoney(priceNum),
          oldPrice: formatMoney(safeOldPrice),
          discount: discount > 0 ? `-${discount}%` : "",
          rating: 0,
          reviews: 0,
          installment: formatMoney(Math.round(priceNum / 12)),
          badge: promoEnabled ? "sale" : (expressEnabled ? "hit" : "new"),
          image: Array.isArray(item.photos) ? (item.photos[0] || "") : "",
          photos: Array.isArray(item.photos) ? item.photos.filter(Boolean) : [],
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
            nameRu: String(item.colorMeta?.nameRu || "\u0426\u0432\u0435\u0442").trim() || "\u0426\u0432\u0435\u0442",
            nameUz: String(item.colorMeta?.nameUz || "rang").trim() || "rang",
            status: item.colorMeta?.status === "inactive" ? "inactive" : "active",
            type: item.colorMeta?.type === "text" ? "text" : "image"
          },
          brand: item.brand || "",
          category: item.category || "",
          installmentStatus,
          express: expressEnabled ? "yes" : "no",
          priority: Number.isFinite(priority) ? priority : 300
        };
      });
  } catch (_) {
    return [];
  }
}

function applyLocalAdminProductsToHome() {
  productData.smartphones = [];
  productData.laptops = [];
  productData.appliances = [];
  productData.accessories = [];
  const adminItems = getAdminProductsForStorefront();
  if (!adminItems.length) return;
  applyProductsToHomeData(adminItems);
}

function mapRemoteCatalogToHomeCard(item) {
  const priceNum = parseMoney(item.price);
  const oldPriceNum = parseMoney(item.oldPrice) || priceNum;
  const uploadedPhotos = Array.isArray(item.photos) ? item.photos.filter(Boolean) : [];
  const media = window.emirateResolveProductMedia?.({
    title: item.title || "Товар",
    sku: item.sku || "",
    brand: item.brand || "",
    category: item.category || "",
    photos: uploadedPhotos,
    image: item.image || uploadedPhotos[0] || ""
  }) || { image: item.image || uploadedPhotos[0] || "", photos: uploadedPhotos };
  return {
    title: item.title || "Товар",
    price: formatMoney(priceNum),
    oldPrice: formatMoney(oldPriceNum),
    discount: oldPriceNum > priceNum
      ? `-${Math.max(0, Math.round((1 - priceNum / Math.max(oldPriceNum, 1)) * 100))}%`
      : "",
    rating: Number(item.rating) || 0,
    reviews: Number(item.reviews) || 0,
    reviewItems: Array.isArray(item.reviewItems) ? item.reviewItems : [],
    installment: formatMoney(Math.round(priceNum / 12)),
    badge: item.badge || "new",
    image: media.image,
    photos: media.photos,
    descUz: String(item.descUz || "").trim(),
    descRu: String(item.descRu || "").trim(),
    specs: Array.isArray(item.specs) ? item.specs : [],
    colors: Array.isArray(item.colors) ? item.colors : [],
    colorMeta: item.colorMeta || {},
    memoryVariants: Array.isArray(item.memoryVariants) ? item.memoryVariants : [],
    memoryMeta: item.memoryMeta || {},
    brand: item.brand || "",
    category: item.category || "",
    installmentStatus: item.installmentStatus === "inactive" ? "inactive" : "active",
    express: item.express === "yes" ? "yes" : "no",
    priority: Number(item.priority) || 300
  };
}

function replaceHomeProductsFromRemote(items) {
  productData.smartphones = [];
  productData.laptops = [];
  productData.appliances = [];
  productData.accessories = [];
  (items || []).forEach((item) => {
    const card = mapRemoteCatalogToHomeCard(item);
    const key = mapAdminCategoryToHomeKey(card.category);
    const list = productData[key] || productData.accessories;
    list.push(card);
  });
  Object.values(productData).forEach((list) => {
    list.sort((a, b) => (Number(a.priority) || 300) - (Number(b.priority) || 300));
  });
}

function applyProductsToHomeData(items) {
  if (!items.length) return;
  const allCategoryLists = Object.values(productData);
  items.forEach((item) => {
    const itemKey = normalizeTitleKey(item.title);

    // Update existing product cards in any category if titles match.
    let replacedInAnyList = false;
    allCategoryLists.forEach((list) => {
      const idx = list.findIndex((x) => normalizeTitleKey(x.title) === itemKey);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          ...item,
          // Keep existing promo text style if already set.
          discount: item.discount || list[idx].discount,
          installment: item.installment || list[idx].installment
        };
        replacedInAnyList = true;
      }
    });

    // New products from admin go to their category only (not "\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u043c\u044b\u0435").
    const key = mapAdminCategoryToHomeKey(item.category);
    const list = productData[key] || productData.accessories;
    if (!replacedInAnyList && !list.some((x) => normalizeTitleKey(x.title) === itemKey)) {
      list.unshift(item);
    }
  });

  Object.values(productData).forEach((list) => {
    list.sort((a, b) => (Number(a.priority) || 300) - (Number(b.priority) || 300));
  });
}

function defaultHomeBanners() {
  return [
    {
      id: "home_default_1",
      tag: "\u0410\u043a\u0446\u0438\u044f \u043d\u0435\u0434\u0435\u043b\u0438",
      title: "\u0421\u043a\u0438\u0434\u043a\u0438 \u0434\u043e 30% \u043d\u0430 \u044d\u043b\u0435\u043a\u0442\u0440\u043e\u043d\u0438\u043a\u0443",
      desc: "\u0420\u0430\u0441\u0441\u0440\u043e\u0447\u043a\u0430 0-0-12 \u043c\u0435\u0441\u044f\u0446\u0435\u0432 \u0431\u0435\u0437 \u043f\u0435\u0440\u0435\u043f\u043b\u0430\u0442. \u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u0430\u044f \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0430 \u043f\u043e \u0422\u0430\u0448\u043a\u0435\u043d\u0442\u0443.",
      primaryText: "\u0421\u043c\u043e\u0442\u0440\u0435\u0442\u044c \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u044f",
      primaryUrl: "#",
      secondaryText: "\u041f\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u043a\u0430\u0442\u0430\u043b\u043e\u0433",
      secondaryUrl: "catalog.html",
      image: "",
      tagUz: "Hafta aksiyasi",
      titleUz: "Elektronikaga 30% gacha chegirma",
      descUz: "0-0-12 oy muddatli to'lov, ortiqcha to'lovsiz. Toshkent bo'ylab bepul yetkazib berish.",
      primaryTextUz: "Takliflarni ko'rish",
      secondaryTextUz: "Katalogga o'tish",
      imageUz: "",
      isActive: true,
      priority: 100
    }
  ];
}

function normalizeHomeBanner(record) {
  const banner = record || {};
  const priority = Number(banner.priority);
  return {
    id: banner.id || `home_banner_${Date.now()}`,
    tag: String(banner.tag || "").trim() || "\u0410\u043a\u0446\u0438\u044f",
    title: String(banner.title || "").trim() || "\u0410\u043a\u0446\u0438\u043e\u043d\u043d\u044b\u0439 \u0431\u0430\u043d\u043d\u0435\u0440",
    desc: String(banner.desc || "").trim() || "",
    primaryText: String(banner.primaryText || "").trim() || "",
    primaryUrl: String(banner.primaryUrl || "").trim() || "#",
    secondaryText: String(banner.secondaryText || "").trim() || "",
    secondaryUrl: String(banner.secondaryUrl || "").trim() || "#",
    image: typeof banner.image === "string" ? banner.image : "",
    imageMobile: typeof banner.imageMobile === "string" ? banner.imageMobile : "",
    tagUz: String(banner.tagUz || "").trim() || "",
    titleUz: String(banner.titleUz || "").trim() || "",
    descUz: String(banner.descUz || "").trim() || "",
    primaryTextUz: String(banner.primaryTextUz || "").trim() || "",
    secondaryTextUz: String(banner.secondaryTextUz || "").trim() || "",
    imageUz: typeof banner.imageUz === "string" ? banner.imageUz : "",
    imageMobileUz: typeof banner.imageMobileUz === "string" ? banner.imageMobileUz : "",
    isActive: banner.isActive !== false,
    priority: Number.isFinite(priority) ? priority : 100
  };
}

function resolveHomeBannerForLang(banner, lang) {
  const normalized = normalizeHomeBanner(banner);
  if (lang !== "uz") return normalized;
  return {
    ...normalized,
    tag: normalized.tagUz || normalized.tag,
    title: normalized.titleUz || normalized.title,
    desc: normalized.descUz || normalized.desc,
    primaryText: normalized.primaryTextUz || normalized.primaryText,
    secondaryText: normalized.secondaryTextUz || normalized.secondaryText,
    image: normalized.imageUz || normalized.image,
    imageMobile: normalized.imageMobileUz || normalized.imageMobile || normalized.imageUz || normalized.image
  };
}

function isCompactHomeHero() {
  return document.documentElement.classList.contains("capacitor-app")
    || (window.matchMedia && window.matchMedia("(max-width: 680px)").matches);
}

function buildHeroBannerPictureHtml(banner, index) {
  const desktopImage = banner.image || "";
  const mobileImage = banner.imageMobile || desktopImage;
  const alt = banner.title || "Баннер";
  const loading = index === 0 ? "eager" : "lazy";
  const fetchPriority = index === 0 ? ' fetchpriority="high"' : "";
  const preferMobile = isCompactHomeHero();
  const imgSrc = preferMobile ? (mobileImage || desktopImage) : (desktopImage || mobileImage);
  const mobileSource =
    !preferMobile && mobileImage && mobileImage !== desktopImage
      ? `<source media="(max-width: 680px)" srcset="${escapeHtmlAttr(mobileImage)}">`
      : "";
  const sizes = preferMobile ? ' width="750" height="360"' : ' width="1200" height="430"';
  return `<picture class="hero-banner-picture">${mobileSource}<img class="hero-banner-img" src="${escapeHtmlAttr(imgSrc)}" alt="${escapeHtmlAttr(alt)}" loading="${loading}" decoding="async"${fetchPriority}${sizes}></picture>`;
}

const PUBLIC_BANNERS_CACHE_KEY = "emirate_public_home_banners_v1";
let remoteHomeBannersCache = null;

function readCachedPublicBanners() {
  try {
    const raw = localStorage.getItem(PUBLIC_BANNERS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeCachedPublicBanners(banners) {
  try {
    localStorage.setItem(PUBLIC_BANNERS_CACHE_KEY, JSON.stringify(banners || []));
  } catch (_) {}
}

function loadHomeBanners() {
  if (window.emirateSupabaseApi?.isConfigured?.()) {
    if (Array.isArray(remoteHomeBannersCache) && remoteHomeBannersCache.length) {
      return remoteHomeBannersCache
        .map(normalizeHomeBanner)
        .filter((banner) => banner.isActive)
        .sort((a, b) => Number(a.priority) - Number(b.priority));
    }
    const cached = readCachedPublicBanners();
    if (cached.length) {
      return cached
        .map(normalizeHomeBanner)
        .filter((banner) => banner.isActive)
        .sort((a, b) => Number(a.priority) - Number(b.priority));
    }
    return [];
  }
  try {
    const raw = localStorage.getItem(ADMIN_BANNERS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const source = Array.isArray(parsed) && parsed.length ? parsed : defaultHomeBanners();
    return source
      .map(normalizeHomeBanner)
      .filter((banner) => banner.isActive)
      .sort((a, b) => Number(a.priority) - Number(b.priority));
  } catch (_) {
    return defaultHomeBanners().map(normalizeHomeBanner);
  }
}

function setActiveHeroSlide(index) {
  const slides = Array.from(document.querySelectorAll(".hero-slider .hero-slide"));
  const dots = Array.from(document.querySelectorAll(".hero-dots .dot"));
  if (!slides.length) return;
  const safeIndex = Math.max(0, Math.min(index, slides.length - 1));
  slides.forEach((slide, i) => slide.classList.toggle("active", i === safeIndex));
  dots.forEach((dot, i) => dot.classList.toggle("active", i === safeIndex));
}

const HERO_AUTOPLAY_MS = 5500;
let heroAutoplayTimer = null;

function getHeroSlidesCount() {
  return document.querySelectorAll(".hero-slider .hero-slide").length;
}

function getActiveHeroIndex() {
  const slides = Array.from(document.querySelectorAll(".hero-slider .hero-slide"));
  return Math.max(0, slides.findIndex((slide) => slide.classList.contains("active")));
}

function stepHeroSlide(direction = 1) {
  const total = getHeroSlidesCount();
  if (total <= 1) return;
  const current = getActiveHeroIndex();
  const nextIndex = (current + direction + total) % total;
  setActiveHeroSlide(nextIndex);
}

function stopHeroAutoplay() {
  if (heroAutoplayTimer) {
    clearInterval(heroAutoplayTimer);
    heroAutoplayTimer = null;
  }
}

function startHeroAutoplay() {
  stopHeroAutoplay();
  if (getHeroSlidesCount() <= 1) return;
  heroAutoplayTimer = setInterval(() => {
    stepHeroSlide(1);
  }, HERO_AUTOPLAY_MS);
}

function renderHeroBanners() {
  const heroSlider = document.querySelector(".hero-slider");
  if (!heroSlider) return;

  const lang = typeof window.emirateLang === "function" ? window.emirateLang() : "ru";
  const banners = loadHomeBanners().map((banner) => resolveHomeBannerForLang(banner, lang));
  const safeBanners = banners.length
    ? banners
    : isLiveStorefront() && !homeStorefrontReady
      ? []
      : defaultHomeBanners().map((banner) => resolveHomeBannerForLang(banner, lang));
  if (!safeBanners.length) return;

  const slidesHtml = safeBanners.map((banner, index) => {
    const desktopImage = banner.image || "";
    const mobileImage = banner.imageMobile || desktopImage;
    const hasImage = Boolean(desktopImage || mobileImage);
    const linkUrl = String(banner.primaryUrl || "").trim();

    if (hasImage) {
      const pictureHtml = buildHeroBannerPictureHtml(banner, index);
      const content =
        linkUrl && linkUrl !== "#"
          ? `<a href="${escapeHtmlAttr(linkUrl)}" class="hero-banner-link">${pictureHtml}</a>`
          : pictureHtml;
      return `<div class="hero-slide hero-slide--banner ${index === 0 ? "active" : ""}">${content}</div>`;
    }

    return `
      <div class="hero-slide hero-slide--fallback ${index === 0 ? "active" : ""}">
        <div class="hero-slide-text">
          <span class="hero-tag">${escapeHtmlText(banner.tag)}</span>
          <h1>${escapeHtmlText(banner.title)}</h1>
          <p>${escapeHtmlText(banner.desc)}</p>
        </div>
      </div>
    `;
  }).join("");

  const dotsHtml = safeBanners
    .map((_, index) => `<button class="dot ${index === 0 ? "active" : ""}" type="button" data-hero-index="${index}"></button>`)
    .join("");

  const arrowsHtml = safeBanners.length > 1
    ? `<button class="hero-nav-btn hero-nav-btn--prev" type="button" aria-label="Предыдущий слайд">‹</button>
       <button class="hero-nav-btn hero-nav-btn--next" type="button" aria-label="Следующий слайд">›</button>`
    : "";

  heroSlider.classList.add("hero-slider--carousel");
  heroSlider.innerHTML = `${slidesHtml}${arrowsHtml}<div class="hero-dots">${dotsHtml}</div>`;

  document.querySelectorAll(".hero-dots .dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.getAttribute("data-hero-index"));
      setActiveHeroSlide(Number.isFinite(index) ? index : 0);
      startHeroAutoplay();
    });
  });

  const prevBtn = heroSlider.querySelector(".hero-nav-btn--prev");
  const nextBtn = heroSlider.querySelector(".hero-nav-btn--next");

  prevBtn?.addEventListener("click", () => {
    stepHeroSlide(-1);
    startHeroAutoplay();
  });

  nextBtn?.addEventListener("click", () => {
    stepHeroSlide(1);
    startHeroAutoplay();
  });

  heroSlider.addEventListener("mouseenter", stopHeroAutoplay);
  heroSlider.addEventListener("mouseleave", startHeroAutoplay);
  heroSlider.addEventListener("focusin", stopHeroAutoplay);
  heroSlider.addEventListener("focusout", startHeroAutoplay);

  startHeroAutoplay();
}

window.emirateRefreshHomeBanners = renderHeroBanners;

function rebuildAllProductsIndex() {
  allProductsByTitle.clear();
  Object.values(productData).forEach((items) => {
    items.forEach((item) => {
      allProductsByTitle.set(item.title, toCatalogProductShape(item));
    });
  });
  feedProducts.forEach((item) => {
    allProductsByTitle.set(item.title, toCatalogProductShape(item));
  });
}

rebuildAllProductsIndex();

window.emirateLookupProduct = (title) => allProductsByTitle.get(title);

// ===== RENDER PRODUCT CARD =====
function renderProductCard(product) {
  const productId = product.title;
  const safeProductId = escapeHtmlAttr(productId);
  const isFavorite = window.emirateIsFavorite?.(productId) === true;
  const lang = typeof window.emirateLang === "function" ? window.emirateLang() : "ru";
  const ratingHtml = window.emirateProductRatingHtml?.(product, lang) || "";

  const productHref = window.emirateProductHref
    ? window.emirateProductHref(product.title)
    : `product.html?product=${encodeURIComponent(product.title)}`;
  const discountText = String(product.discount || "").trim();
  const badgeHTML = discountText ? `<span class="badge-sale">${discountText}</span>` : "";

  const media = window.emirateResolveProductMedia?.(product) || {
    image: product.image,
    photos: product.photos || []
  };
  const imageHtml = media.image
    ? `<img class="product-image-real" src="${escapeHtmlAttr(media.image)}" alt="" loading="lazy" decoding="async" onerror="window.emirateOnProductImageError&&window.emirateOnProductImageError(this)">`
    : `<div class="product-image-placeholder">
            <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            Фото
            </div>`;

  const priceValue = window.emirateParsePriceValue?.(product.price) || 0;
  const installmentValue = Math.round(priceValue / 12);

  return `
    <article class="product-card" data-product-title="${safeProductId}">
      <div class="product-card-top">
        <div class="product-image">
          <div class="product-badges">${badgeHTML}</div>
          <button class="wishlist-btn ${isFavorite ? "active" : ""}" type="button" title="В избранное" data-product-id="${safeProductId}">
            <svg width="18" height="18" fill="${isFavorite ? "#ef4444" : "none"}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
          <a class="product-image-link product-link" href="${productHref}" title="Открыть товар">
            ${imageHtml}
          </a>
        </div>
      </div>
      <h3 class="product-title"><a class="product-link" href="${productHref}">${product.title}</a></h3>
      ${ratingHtml ? `<div class="product-rating">${ratingHtml}</div>` : ""}
      ${window.emirateProductPriceHtml?.(product.price, product.oldPrice) || ""}
      ${window.emirateProductInstallmentHtml?.(product, installmentValue) || ""}
      ${window.emirateProductActionsHtml?.(productHref, safeProductId) || ""}
    </article>
  `;
}

// ===== INIT CAROUSELS =====
function initCarousel(trackEl) {
  if (!trackEl) return;
  const wrapper = trackEl.closest(".carousel-wrapper");
  if (!wrapper) return;

  const leftBtn = wrapper.querySelector(".carousel-arrow--left");
  const rightBtn = wrapper.querySelector(".carousel-arrow--right");

  // Scroll by exactly one card width + gap
  function getScrollAmount() {
    const card = trackEl.querySelector(".product-card");
    if (!card) return 280;
    const gap = parseFloat(getComputedStyle(trackEl).gap) || 16;
    return card.offsetWidth + gap;
  }

  function updateArrows() {
    if (!leftBtn || !rightBtn) return;
    leftBtn.disabled = trackEl.scrollLeft <= 4;
    rightBtn.disabled = trackEl.scrollLeft + trackEl.clientWidth >= trackEl.scrollWidth - 4;
  }

  if (leftBtn) {
    leftBtn.addEventListener("click", () => {
      trackEl.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
    });
  }

  if (rightBtn) {
    rightBtn.addEventListener("click", () => {
      trackEl.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
    });
  }

  trackEl.addEventListener("scroll", updateArrows, { passive: true });
  updateArrows();

  // Re-check arrows after images or content might load
  setTimeout(updateArrows, 100);
}

// Render initial carousels
function renderInitialCarousels() {
  const map = {
    smartphones: document.getElementById("carouselSmartphones"),
    laptops: document.getElementById("carouselLaptops"),
    appliances: document.getElementById("carouselAppliances"),
    accessories: document.getElementById("carouselAccessories")
  };

  for (const [key, el] of Object.entries(map)) {
    if (el && productData[key]) {
      el.innerHTML = productData[key].map(renderProductCard).join("");
      window.emirateSyncFavoritesUI?.(el);
      initCarousel(el);
    }
  }
}

function renderHomeBrands() {
  const grid = document.getElementById("homeBrandsGrid");
  if (!grid || !window.emirateBrands) return;

  const brands = window.emirateBrands.getActiveBrands();
  if (!brands.length) return;

  grid.classList.remove("is-marquee");
  grid.innerHTML = brands
    .map(function (brand) {
      const url = window.emirateBrands.buildBrandCatalogUrl(brand);
      const logo = brand.logoUrl
        ? `<img class="brand-card-logo" src="${escapeHtmlAttr(brand.logoUrl)}" alt="" loading="lazy">`
        : "";
      const name = window.emirateBrands.getBrandDisplayName
        ? window.emirateBrands.getBrandDisplayName(brand, window.emirateLang?.() || "ru")
        : brand.nameRu;
      return `<a href="${escapeHtmlAttr(url)}" class="brand-card">${logo}<span>${escapeHtml(name)}</span></a>`;
    })
    .join("");
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setupHomeMarquee(container, durationSec) {
  if (!container || prefersReducedMotion()) return;

  const items = Array.from(container.children).filter(function (el) {
    return !el.classList.contains("marquee-track");
  });
  if (items.length < 2) return;

  const track = document.createElement("div");
  track.className = "marquee-track";
  const group = document.createElement("div");
  group.className = "marquee-group";
  items.forEach(function (el) {
    group.appendChild(el);
  });
  const clone = group.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("a, button").forEach(function (el) {
    el.setAttribute("tabindex", "-1");
  });
  track.appendChild(group);
  track.appendChild(clone);
  container.appendChild(track);
  container.classList.add("is-marquee");
  container.style.setProperty("--marquee-duration", (durationSec || 32) + "s");

  if (container.dataset.marqueeBound === "1") return;
  container.dataset.marqueeBound = "1";

  let resumeTimer = 0;
  const pause = function () {
    container.classList.add("is-paused");
    window.clearTimeout(resumeTimer);
  };
  const resume = function () {
    window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(function () {
      container.classList.remove("is-paused");
    }, 1400);
  };
  container.addEventListener("pointerdown", pause);
  container.addEventListener("pointerup", resume);
  container.addEventListener("pointercancel", resume);
  container.addEventListener("mouseleave", resume);

  if (!window.emirateMarqueeObserver) {
    window.emirateMarqueeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("is-offscreen", !entry.isIntersecting);
      });
    }, { threshold: 0.12 });
  }
  window.emirateMarqueeObserver.observe(container);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function initHomeStorefront() {
  if (window.emirateBrands?.refreshPublicBrandsFromRemote) {
    await window.emirateBrands.refreshPublicBrandsFromRemote();
  }
  renderHomeBrands();
  if (!isLiveStorefront()) {
    applyLocalAdminProductsToHome();
    rebuildAllProductsIndex();
    homeStorefrontReady = true;
    renderHeroBanners();
    renderInitialCarousels();
    updateCategorySectionsVisibility();
    renderNativeHomeFeed();
    finishHomeShellMode();
    return;
  }

  setHomeStorefrontLoading(true);
  productData.smartphones = [];
  productData.laptops = [];
  productData.appliances = [];
  productData.accessories = [];
  renderHomeCarouselSkeletons();
  renderHeroBanners();

  const api = window.emirateSupabaseApi;
  try {
    const bannersPromise = api.fetchPublicHomeBanners().then((remoteBanners) => {
      if (Array.isArray(remoteBanners) && remoteBanners.length) {
        remoteHomeBannersCache = remoteBanners;
        writeCachedPublicBanners(remoteBanners);
        renderHeroBanners();
      }
    });
    const productsPromise = api.fetchPublicCatalogProducts().then((remoteProducts) => {
      if (Array.isArray(remoteProducts) && remoteProducts.length) {
        replaceHomeProductsFromRemote(remoteProducts);
        rebuildAllProductsIndex();
      }
    });
    await Promise.all([bannersPromise, productsPromise]);
  } catch (err) {
    console.warn("[Supabase] home storefront", err);
  } finally {
    homeStorefrontReady = true;
    setHomeStorefrontLoading(false);
    renderHeroBanners();
    renderInitialCarousels();
    updateCategorySectionsVisibility();
    renderNativeHomeFeed();
    if (typeof translatePage === "function") {
      translatePage();
    }
    finishHomeShellMode();
  }
}

function finishHomeShellMode() {
  const root = document.documentElement;
  if (!root.classList.contains("home-shell-loading")) return;
  root.classList.add("home-shell-ready");
  window.setTimeout(function () {
    root.classList.remove("home-shell-loading", "home-shell-ready");
  }, 260);
}

window.setTimeout(finishHomeShellMode, 3500);

void initHomeStorefront();
setupHomeMarquee(document.querySelector(".perks-row"), 22);

// ===== LAZY LOADING — product feed via IntersectionObserver =====
const feedSection = document.getElementById("feedSection");
const feedGrid = document.getElementById("feedGrid");
const feedTrigger = document.getElementById("feedTrigger");
let feedObserver = null;

function loadFeedBatch() {
  if (!feedGrid || feedIndex >= feedProducts.length) return false;

  const batch = feedProducts.slice(feedIndex, feedIndex + FEED_BATCH);
  feedIndex += batch.length;

  const html = batch.map(renderProductCard).join("");
  feedGrid.insertAdjacentHTML("beforeend", html);
  window.emirateSyncFavoritesUI?.(feedGrid);

  if (feedSection) {
    feedSection.hidden = false;
    feedSection.style.display = "";
  }

  if (typeof translatePage === "function") {
    translatePage();
  }

  return feedIndex < feedProducts.length;
}

function setupFeedObserver() {
  if (!feedGrid || !feedTrigger) return;
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }
  if (feedIndex >= feedProducts.length) return;
  feedObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const hasMore = loadFeedBatch();
      if (!hasMore && feedObserver) {
        feedObserver.disconnect();
        feedObserver = null;
      }
    });
  }, {
    rootMargin: "300px 0px",
    threshold: 0
  });
  feedObserver.observe(feedTrigger);
}

function renderNativeHomeFeed() {
  if (!isNativeHome() || !feedSection || !feedGrid) return;
  fillFeedProductsFromCatalog();
  rebuildAllProductsIndex();
  feedIndex = 0;
  feedGrid.innerHTML = "";
  document.body.classList.add("native-home-feed");

  const titleEl = feedSection.querySelector(".section-header h2");
  if (titleEl) {
    titleEl.removeAttribute("data-i18n");
    titleEl.setAttribute("data-i18n", "section.homeAll");
    titleEl.textContent = window.emirateT?.("section.homeAll") || "Все товары";
  }

  if (!feedProducts.length) {
    feedSection.hidden = true;
    return;
  }

  feedSection.hidden = false;
  feedSection.style.display = "";
  loadFeedBatch();
  loadFeedBatch();
  setupFeedObserver();
}

// ===== ADD TO CART =====
document.addEventListener("click", (e) => {
  const productLink = e.target.closest(".product-link");
  if (productLink) {
    const card = productLink.closest(".product-card");
    const productTitle = card?.getAttribute("data-product-title");
    const product = productTitle ? allProductsByTitle.get(productTitle) : null;
    if (product) {
      window.emirateAddViewedProduct?.(product);
      saveSelectedProduct(product);
    }
  }

  const cartBtn = e.target.closest(".add-to-cart-btn");
  if (cartBtn) {
    const card = cartBtn.closest(".product-card");
    const productTitle = card?.getAttribute("data-product-title");
    const product = (productTitle ? allProductsByTitle.get(productTitle) : null) || buildFallbackProductFromCard(card);
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
    return;
  }
});

// ===== HERO DOTS =====

