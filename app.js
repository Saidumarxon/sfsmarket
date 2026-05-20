/* ========================================
   EMIRATE CO — Home Page v4
   Categories + Carousel + Lazy Loading
   (shared logic is in common.js)
   ======================================== */

// ===== PRODUCT DATA BY CATEGORY =====
const productData = {
  smartphones: [
    { title: "iPhone 15 Pro Max 256GB", price: "15 490 000", oldPrice: "16 900 000", discount: "-8%", rating: 4.9, reviews: 342, installment: "1 290 833", badge: "hit" },
    { title: "Samsung Galaxy S24 Ultra 12/256GB", price: "14 200 000", oldPrice: "15 500 000", discount: "-8%", rating: 4.8, reviews: 218, installment: "1 183 333", badge: "hit" },
    { title: "Xiaomi 14 Ultra 16/512GB", price: "12 800 000", oldPrice: "13 900 000", discount: "-8%", rating: 4.7, reviews: 95, installment: "1 066 667", badge: "sale" },
    { title: "Google Pixel 9 Pro 128GB", price: "11 800 000", oldPrice: "12 900 000", discount: "-9%", rating: 4.8, reviews: 19, installment: "983 333", badge: "new" },
    { title: "Samsung Galaxy Z Fold6 12/512GB", price: "22 900 000", oldPrice: "24 500 000", discount: "-7%", rating: 4.8, reviews: 45, installment: "1 908 333", badge: "new" },
    { title: "iPhone 15 128GB", price: "11 990 000", oldPrice: "12 500 000", discount: "-4%", rating: 4.8, reviews: 512, installment: "999 167", badge: "hit" },
    { title: "OnePlus 12 16/512GB", price: "9 500 000", oldPrice: "10 200 000", discount: "-7%", rating: 4.6, reviews: 78, installment: "791 667", badge: "sale" },
    { title: "Samsung Galaxy A55 5G 8/256GB", price: "4 200 000", oldPrice: "4 600 000", discount: "-9%", rating: 4.5, reviews: 230, installment: "350 000", badge: "hit" }
  ],
  appliances: [
    { title: "Xiaomi Robot Vacuum X20 Pro+", price: "5 790 000", oldPrice: "6 900 000", discount: "-16%", rating: 4.7, reviews: 89, installment: "482 500", badge: "sale" },
    { title: "Dyson V15 Detect Absolute", price: "8 350 000", oldPrice: "9 500 000", discount: "-12%", rating: 4.8, reviews: 195, installment: "695 833", badge: "sale" },
    { title: 'LG OLED55C4 55" 4K Smart TV', price: "12 400 000", oldPrice: "13 900 000", discount: "-11%", rating: 4.9, reviews: 73, installment: "1 033 333", badge: "hit" },
    { title: "Samsung Bespoke AI Washer 12kg", price: "7 200 000", oldPrice: "8 100 000", discount: "-11%", rating: 4.6, reviews: 156, installment: "600 000", badge: "hit" },
    { title: "Dyson Purifier Hot+Cool HP07", price: "6 900 000", oldPrice: "7 800 000", discount: "-12%", rating: 4.7, reviews: 64, installment: "575 000", badge: "sale" },
    { title: "Xiaomi Mi Air Purifier 4 Pro", price: "2 850 000", oldPrice: "3 200 000", discount: "-11%", rating: 4.5, reviews: 187, installment: "237 500", badge: "hit" },
    { title: 'Samsung 75" QLED 4K QN85B', price: "18 500 000", oldPrice: "20 900 000", discount: "-11%", rating: 4.8, reviews: 42, installment: "1 541 667", badge: "new" },
    { title: "iRobot Roomba j9+ Combo", price: "9 900 000", oldPrice: "11 200 000", discount: "-12%", rating: 4.7, reviews: 38, installment: "825 000", badge: "new" }
  ],
  accessories: [
    { title: "Sony WH-1000XM5 Wireless", price: "4 250 000", oldPrice: "4 990 000", discount: "-15%", rating: 4.8, reviews: 421, installment: "354 167", badge: "sale" },
    { title: "Apple Watch Ultra 2 GPS+Cellular", price: "11 100 000", oldPrice: "12 500 000", discount: "-11%", rating: 4.9, reviews: 267, installment: "925 000", badge: "hit" },
    { title: "JBL Tour Pro 3 TWS", price: "3 200 000", oldPrice: "3 700 000", discount: "-14%", rating: 4.7, reviews: 28, installment: "266 667", badge: "new" },
    { title: "iPad Pro M4 11\" 256GB Wi-Fi", price: "13 500 000", oldPrice: "14 200 000", discount: "-5%", rating: 4.9, reviews: 32, installment: "1 125 000", badge: "new" },
    { title: 'MacBook Air M3 15" 16/512GB', price: "17 900 000", oldPrice: "19 200 000", discount: "-7%", rating: 4.9, reviews: 156, installment: "1 491 667", badge: "hit" },
    { title: "Samsung Galaxy Buds3 Pro", price: "2 800 000", oldPrice: "3 100 000", discount: "-10%", rating: 4.6, reviews: 93, installment: "233 333", badge: "sale" },
    { title: "Apple AirPods Pro 2 USB-C", price: "3 400 000", oldPrice: "3 800 000", discount: "-11%", rating: 4.8, reviews: 614, installment: "283 333", badge: "hit" },
    { title: "Xiaomi Watch S3 Active", price: "1 450 000", oldPrice: "1 700 000", discount: "-15%", rating: 4.4, reviews: 112, installment: "120 833", badge: "sale" }
  ]
};

// Extra products pool for lazy-loaded feed (mixed products)
const feedProducts = [
  { title: 'MacBook Pro M3 Pro 14" 18/512GB', price: "25 900 000", oldPrice: "27 500 000", discount: "-6%", rating: 4.9, reviews: 204, installment: "2 158 333", badge: "hit" },
  { title: "ASUS ROG Strix G16 RTX 4070", price: "18 400 000", oldPrice: "20 000 000", discount: "-8%", rating: 4.7, reviews: 67, installment: "1 533 333", badge: "sale" },
  { title: "Lenovo ThinkPad X1 Carbon Gen 12", price: "21 500 000", oldPrice: "23 000 000", discount: "-7%", rating: 4.8, reviews: 89, installment: "1 791 667", badge: "hit" },
  { title: "HP Pavilion Plus 14 OLED", price: "11 200 000", oldPrice: "12 800 000", discount: "-13%", rating: 4.6, reviews: 45, installment: "933 333", badge: "sale" },
  { title: 'Samsung 65" Neo QLED QN90C', price: "15 800 000", oldPrice: "17 500 000", discount: "-10%", rating: 4.8, reviews: 85, installment: "1 316 667", badge: "hit" },
  { title: "JBL PartyBox 710", price: "8 500 000", oldPrice: "9 200 000", discount: "-8%", rating: 4.7, reviews: 134, installment: "708 333", badge: "hit" },
  { title: "Sony Bravia XR A95L OLED 55\"", price: "22 000 000", oldPrice: "24 500 000", discount: "-10%", rating: 4.9, reviews: 47, installment: "1 833 333", badge: "new" },
  { title: "Sonos Arc Soundbar", price: "9 200 000", oldPrice: "10 400 000", discount: "-12%", rating: 4.8, reviews: 178, installment: "766 667", badge: "sale" },
  { title: 'Dell XPS 15 OLED 15.6"', price: "19 800 000", oldPrice: "21 500 000", discount: "-8%", rating: 4.8, reviews: 112, installment: "1 650 000", badge: "hit" },
  { title: "Marshall Stanmore III BT", price: "5 400 000", oldPrice: "5 900 000", discount: "-8%", rating: 4.7, reviews: 256, installment: "450 000", badge: "hit" },
  { title: "Acer Swift Go 14 AI", price: "8 900 000", oldPrice: "9 800 000", discount: "-9%", rating: 4.5, reviews: 34, installment: "741 667", badge: "new" },
  { title: 'Samsung Galaxy Book4 Ultra 16"', price: "24 500 000", oldPrice: "26 000 000", discount: "-6%", rating: 4.7, reviews: 28, installment: "2 041 667", badge: "new" },
  { title: 'MacBook Air M2 13" 8/256GB', price: "10 900 000", oldPrice: "12 200 000", discount: "-11%", rating: 4.8, reviews: 389, installment: "908 333", badge: "sale" },
  { title: 'LG 50" UHD 4K Smart TV 50UR78', price: "5 200 000", oldPrice: "6 100 000", discount: "-15%", rating: 4.5, reviews: 312, installment: "433 333", badge: "sale" },
  { title: "Harman Kardon Onyx Studio 8", price: "3 100 000", oldPrice: "3 600 000", discount: "-14%", rating: 4.6, reviews: 97, installment: "258 333", badge: "sale" },
  { title: "Apple HomePod 2nd Gen", price: "4 200 000", oldPrice: "4 800 000", discount: "-13%", rating: 4.6, reviews: 63, installment: "350 000", badge: "new" },
  { title: "Nothing Phone (2a) 12/256GB", price: "3 800 000", oldPrice: "4 300 000", discount: "-12%", rating: 4.5, reviews: 76, installment: "316 667", badge: "sale" },
  { title: "Realme GT 6 16/512GB", price: "5 400 000", oldPrice: "5 900 000", discount: "-8%", rating: 4.6, reviews: 54, installment: "450 000", badge: "new" },
  { title: "Samsung Galaxy Tab S9 FE 128GB", price: "4 900 000", oldPrice: "5 500 000", discount: "-11%", rating: 4.7, reviews: 143, installment: "408 333", badge: "hit" },
  { title: "Baseus GaN5 Pro 100W Charger", price: "450 000", oldPrice: "550 000", discount: "-18%", rating: 4.8, reviews: 892, installment: "37 500", badge: "sale" },
  { title: "Anker Soundcore Space A40 TWS", price: "890 000", oldPrice: "1 050 000", discount: "-15%", rating: 4.6, reviews: 321, installment: "74 167", badge: "hit" },
  { title: "Xiaomi Redmi Pad Pro 8/256GB", price: "3 200 000", oldPrice: "3 600 000", discount: "-11%", rating: 4.5, reviews: 87, installment: "266 667", badge: "new" },
  { title: "Roborock S8 MaxV Ultra", price: "12 500 000", oldPrice: "14 200 000", discount: "-12%", rating: 4.9, reviews: 56, installment: "1 041 667", badge: "hit" },
  { title: "Philips Hue Starter Kit E27", price: "1 200 000", oldPrice: "1 400 000", discount: "-14%", rating: 4.7, reviews: 245, installment: "100 000", badge: "sale" }
];

const ADMIN_PRODUCTS_KEY = "emirate_admin_products";
const ADMIN_BANNERS_KEY = "emirate_home_banners";
const SELECTED_PRODUCT_KEY = "emirate_selected_product";

const FEED_BATCH = 8; // products per batch
let feedIndex = 0;
const allProductsByTitle = new Map();

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
  try {
    sessionStorage.setItem(SELECTED_PRODUCT_KEY, JSON.stringify(product));
  } catch (_) {
    // Ignore quota/session errors for demo data.
  }
}

function mapAdminCategoryToHomeKey(category) {
  const value = String(category || "").toLowerCase();
  if (value.includes("\u0441\u043c\u0430\u0440\u0442\u0444")) return "smartphones";
  if (value.includes("\u0442\u0432") || value.includes("\u0430\u0443\u0434\u0438\u043e")) return "appliances";
  if (value.includes("\u043d\u043e\u0443\u0442")) return "accessories";
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
          rating: 4.6,
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

function applyAdminProductsToHomeData() {
  const adminItems = getAdminProductsForStorefront();
  if (!adminItems.length) return;
  applyProductsToHomeData(adminItems);
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

applyAdminProductsToHomeData();

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
    isActive: banner.isActive !== false,
    priority: Number.isFinite(priority) ? priority : 100
  };
}

let remoteHomeBannersCache = null;

function loadHomeBanners() {
  if (window.emirateSupabaseApi?.isConfigured?.()) {
    if (Array.isArray(remoteHomeBannersCache) && remoteHomeBannersCache.length) {
      return remoteHomeBannersCache
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

  const banners = loadHomeBanners();
  const safeBanners = banners.length ? banners : defaultHomeBanners();

  const slidesHtml = safeBanners.map((banner, index) => {
    const hasImage = Boolean(banner.image);
    const primaryButton = banner.primaryText
      ? `<a href="${escapeHtmlAttr(banner.primaryUrl || "#")}" class="btn-primary">${escapeHtmlText(banner.primaryText)}</a>`
      : "";
    const secondaryButton = banner.secondaryText
      ? `<a href="${escapeHtmlAttr(banner.secondaryUrl || "#")}" class="btn-outline">${escapeHtmlText(banner.secondaryText)}</a>`
      : "";
    const visualHtml = hasImage
      ? ""
      : `<div class="hero-slide-visual"><div class="hero-device-mockup"><svg width="120" height="120" fill="none" stroke="#4db8e8" stroke-width="1.2" viewBox="0 0 24 24" opacity=".4"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg></div></div>`;
    const slideStyle = hasImage
      ? ` style="background-image: linear-gradient(100deg, rgba(5,10,22,0.88) 0%, rgba(7,24,46,0.78) 45%, rgba(9,37,67,0.30) 74%, rgba(9,37,67,0.12) 100%), url('${escapeHtmlAttr(banner.image)}');"`
      : "";

    return `
      <div class="hero-slide ${index === 0 ? "active" : ""} ${hasImage ? "hero-slide--image" : ""}"${slideStyle}>
        <div class="hero-slide-text">
          <span class="hero-tag">${escapeHtmlText(banner.tag)}</span>
          <h1>${escapeHtmlText(banner.title)}</h1>
          <p>${escapeHtmlText(banner.desc)}</p>
          <div class="hero-btns">
            ${primaryButton}
            ${secondaryButton}
          </div>
        </div>
        ${visualHtml}
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

renderHeroBanners();

void (async () => {
  const api = window.emirateSupabaseApi;
  if (!api || !api.isConfigured()) return;
  try {
    const remote = await api.fetchPublicHomeBanners();
    if (!remote.length) return;
    remoteHomeBannersCache = remote;
    renderHeroBanners();
  } catch (err) {
    console.warn("[Supabase] home banners", err);
  }
})();

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

// ===== RENDER PRODUCT CARD =====
function renderProductCard(product) {
  const productId = product.title;
  const safeProductId = escapeHtmlAttr(productId);
  const isFavorite = window.emirateIsFavorite?.(productId) === true;
  const stars = "\u2605".repeat(Math.floor(product.rating)) +
                (product.rating % 1 >= 0.5 ? "\u00BD" : "");

  const productHref = `product.html?product=${encodeURIComponent(product.title)}`;
  const discountText = String(product.discount || "").trim();
  const badgeHTML = discountText ? `<span class="badge-sale">${discountText}</span>` : "";

  const imageHtml = product.image
    ? `<img class="product-image-real" src="${escapeHtmlAttr(product.image)}" alt="${escapeHtmlAttr(product.title)}">`
    : `<div class="product-image-placeholder">
            <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            Фото
            </div>`;

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
      <div class="product-rating">
        <span class="product-stars">${stars}</span>
        <span class="product-rating-num">${product.rating}</span>
        <span class="product-reviews">(${product.reviews})</span>
      </div>
      <div class="product-price-row">
        <span class="product-price">${product.price} сум</span>
        <span class="product-old-price">${product.oldPrice}</span>
      </div>
      <div class="product-installment">${product.installmentStatus === "inactive" ? "Без рассрочки" : `от ${product.installment} сум/мес`}</div>
      <div class="product-actions">
        <button class="add-to-cart-btn" type="button">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
          </svg>
          В корзину
        </button>
          <a class="quick-buy-btn product-link" href="${productHref}" title="Подробнее">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </a>
      </div>
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
    return card.offsetWidth + 16; // card width + gap
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

renderInitialCarousels();

void (async () => {
  const api = window.emirateSupabaseApi;
  if (!api || !api.isConfigured()) return;
  try {
    const remote = await api.fetchPublicCatalogProducts();
    if (!remote.length) return;
    const mapped = remote.map((item) => {
      const priceNum = parseMoney(item.price);
      const oldPriceNum = parseMoney(item.oldPrice) || priceNum;
      return {
        title: item.title || "Товар",
        price: formatMoney(priceNum),
        oldPrice: formatMoney(oldPriceNum),
        discount: oldPriceNum > priceNum ? `-${Math.max(0, Math.round((1 - priceNum / Math.max(oldPriceNum, 1)) * 100))}%` : "",
        rating: Number(item.rating || 4.6),
        reviews: Number(item.reviews || 0),
        installment: formatMoney(Math.round(priceNum / 12)),
        badge: item.badge || "new",
        image: item.image || "",
        photos: Array.isArray(item.photos) ? item.photos.filter(Boolean) : [],
        descUz: String(item.descUz || "").trim(),
        descRu: String(item.descRu || "").trim(),
        specs: Array.isArray(item.specs) ? item.specs : [],
        colors: Array.isArray(item.colors) ? item.colors : [],
        colorMeta: item.colorMeta || {},
        brand: item.brand || "",
        category: item.category || "",
        installmentStatus: item.installmentStatus === "inactive" ? "inactive" : "active",
        express: item.express === "yes" ? "yes" : "no",
        priority: Number(item.priority) || 300
      };
    });
    applyProductsToHomeData(mapped);
    rebuildAllProductsIndex();
    renderInitialCarousels();
  } catch (err) {
    console.warn("[Supabase] home", err);
  }
})();

// ===== LAZY LOADING — product feed via IntersectionObserver =====
const feedSection = document.getElementById("feedSection");
const feedGrid = document.getElementById("feedGrid");
const feedTrigger = document.getElementById("feedTrigger");

function loadFeedBatch() {
  if (feedIndex >= feedProducts.length) return false;

  const batch = feedProducts.slice(feedIndex, feedIndex + FEED_BATCH);
  feedIndex += batch.length;

  const html = batch.map(renderProductCard).join("");
  feedGrid.insertAdjacentHTML("beforeend", html);
  window.emirateSyncFavoritesUI?.(feedGrid);

  // Show section on first load
  if (feedSection.style.display === "none") {
    feedSection.style.display = "";
  }

  // Apply translation if active
  if (typeof translatePage === "function") {
    translatePage();
  }

  return feedIndex < feedProducts.length; // true if more products remain
}

if (feedGrid && feedTrigger) {
  const feedObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const hasMore = loadFeedBatch();
        if (!hasMore) {
          feedObserver.disconnect();
        }
      }
    });
  }, {
    rootMargin: "300px 0px",
    threshold: 0
  });

  feedObserver.observe(feedTrigger);
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

