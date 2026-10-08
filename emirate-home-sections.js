/**
 * emirate-home-sections.js
 * Storefront Home Sections (Vitrina) Management
 * Allows reordering, toggling ON/OFF, and renaming homepage blocks
 * (brands, smartphones, accessories, smart_feed, laptops, appliances).
 */
(function (root) {
  "use strict";

  var ADMIN_HOME_SECTIONS_KEY = "emirate_admin_home_sections_v1";
  var PUBLIC_HOME_SECTIONS_KEY = "emirate_public_home_sections_v1";

  var DEFAULT_HOME_SECTIONS = [
    {
      id: "brands",
      type: "brands",
      titleRu: "Популярные бренды",
      titleUz: "Mashhur brendlar",
      linkTextRu: "Все →",
      linkTextUz: "Barchasi →",
      linkUrl: "catalog.html",
      sortOrder: 1,
      isActive: true,
      description: "Карусель / сетка популярных брендов"
    },
    {
      id: "smartphones",
      type: "carousel",
      titleRu: "Смартфоны",
      titleUz: "Smartfonlar",
      linkTextRu: "Все товары →",
      linkTextUz: "Barcha tovarlar →",
      linkUrl: "catalog.html?category=smartfony",
      sortOrder: 2,
      isActive: true,
      description: "Карусель с карточками смартфонов"
    },
    {
      id: "accessories",
      type: "carousel",
      titleRu: "Аксессуары",
      titleUz: "Aksessuarlar",
      linkTextRu: "Все товары →",
      linkTextUz: "Barcha tovarlar →",
      linkUrl: "catalog.html?category=aksessuary",
      sortOrder: 3,
      isActive: true,
      description: "Карусель с наушниками, часами и аксессуарами"
    },
    {
      id: "smart_feed",
      type: "smart_feed",
      titleRu: "Общие товары",
      titleUz: "Umumiy tovarlar",
      linkTextRu: "Все товары →",
      linkTextUz: "Barcha tovarlar →",
      linkUrl: "catalog.html",
      sortOrder: 4,
      isActive: true,
      description: "Умная бесконечная лента всех товаров магазина"
    },
    {
      id: "laptops",
      type: "carousel",
      titleRu: "Ноутбуки",
      titleUz: "Noutbuklar",
      linkTextRu: "Все товары →",
      linkTextUz: "Barcha tovarlar →",
      linkUrl: "catalog.html?category=noutbuki",
      sortOrder: 5,
      isActive: true,
      description: "Карусель с ноутбуками и компьютерами"
    },
    {
      id: "appliances",
      type: "carousel",
      titleRu: "Бытовая техника",
      titleUz: "Maishiy texnika",
      linkTextRu: "Все товары →",
      linkTextUz: "Barcha tovarlar →",
      linkUrl: "catalog.html?category=bytovaya-tekhnika",
      sortOrder: 6,
      isActive: true,
      description: "Карусель с техникой для дома"
    }
  ];

  function normalizeHomeSection(item, index) {
    if (!item || typeof item !== "object") return null;
    var id = String(item.id || "").trim();
    if (!id) return null;
    var fallback = DEFAULT_HOME_SECTIONS.find(function (d) { return d.id === id; });
    return {
      id: id,
      type: item.type || (fallback ? fallback.type : "carousel"),
      titleRu: String(item.titleRu !== undefined ? item.titleRu : (fallback ? fallback.titleRu : id)).trim(),
      titleUz: String(item.titleUz !== undefined ? item.titleUz : (fallback ? fallback.titleUz : (item.titleRu || id))).trim(),
      linkTextRu: String(item.linkTextRu !== undefined ? item.linkTextRu : (fallback ? fallback.linkTextRu : "Все товары →")).trim(),
      linkTextUz: String(item.linkTextUz !== undefined ? item.linkTextUz : (fallback ? fallback.linkTextUz : "Barcha tovarlar →")).trim(),
      linkUrl: String(item.linkUrl !== undefined ? item.linkUrl : (fallback ? fallback.linkUrl : "catalog.html")).trim(),
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : (index + 1),
      isActive: item.isActive !== false,
      description: item.description || (fallback ? fallback.description : "")
    };
  }

  function loadHomeSections() {
    try {
      var raw = localStorage.getItem(ADMIN_HOME_SECTIONS_KEY) || localStorage.getItem(PUBLIC_HOME_SECTIONS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          var mapped = parsed.map(normalizeHomeSection).filter(Boolean);
          // If any default sections are missing, append them
          DEFAULT_HOME_SECTIONS.forEach(function (def) {
            if (!mapped.some(function (m) { return m.id === def.id; })) {
              mapped.push(normalizeHomeSection(def, mapped.length));
            }
          });
          return mapped;
        }
      }
    } catch (_) {}
    return DEFAULT_HOME_SECTIONS.map(normalizeHomeSection).filter(Boolean);
  }

  function persistHomeSections(sections) {
    var valid = (sections || []).map(normalizeHomeSection).filter(Boolean);
    try {
      localStorage.setItem(ADMIN_HOME_SECTIONS_KEY, JSON.stringify(valid));
      localStorage.setItem(PUBLIC_HOME_SECTIONS_KEY, JSON.stringify(valid));
    } catch (_) {}
    if (root.emirateSupabaseApi && typeof root.emirateSupabaseApi.pushAdminHomeSectionsPayload === "function") {
      void root.emirateSupabaseApi.pushAdminHomeSectionsPayload(valid);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("emirate:home-sections-changed", { detail: valid }));
    }
    return valid;
  }

  async function ensurePublicHomeSectionsLoaded() {
    try {
      if (root.emirateSupabaseApi && typeof root.emirateSupabaseApi.fetchPublicHomeSections === "function") {
        var remote = await root.emirateSupabaseApi.fetchPublicHomeSections();
        if (Array.isArray(remote) && remote.length) {
          var valid = remote.map(normalizeHomeSection).filter(Boolean);
          // Ensure all default sections are present
          DEFAULT_HOME_SECTIONS.forEach(function (def) {
            if (!valid.some(function (v) { return v.id === def.id; })) {
              valid.push(normalizeHomeSection(def, valid.length));
            }
          });
          try {
            localStorage.setItem(ADMIN_HOME_SECTIONS_KEY, JSON.stringify(valid));
            localStorage.setItem(PUBLIC_HOME_SECTIONS_KEY, JSON.stringify(valid));
          } catch (_) {}
          return valid;
        }
      }
    } catch (e) {
      console.warn("[HomeSections] fetch error", e);
    }
    return loadHomeSections();
  }

  function applyHomeSectionsToDOM() {
    if (typeof document === "undefined") return;
    var main = document.querySelector("main");
    if (!main) return;
    var sections = loadHomeSections();
    var lang = typeof root.emirateLang === "function" ? root.emirateLang() : "ru";

    // Sort by sortOrder
    sections.sort(function (a, b) { return a.sortOrder - b.sortOrder; });

    var sectionMap = {
      brands: main.querySelector('[data-home-section-id="brands"]'),
      smartphones: main.querySelector('[data-home-section-id="smartphones"]'),
      accessories: main.querySelector('[data-home-section-id="accessories"]'),
      smart_feed: main.querySelector('[data-home-section-id="smart_feed"]'),
      laptops: main.querySelector('[data-home-section-id="laptops"]'),
      appliances: main.querySelector('[data-home-section-id="appliances"]')
    };

    var trigger = document.getElementById("smartFeedTrigger");
    var perks = main.querySelector(".section--perks");

    sections.forEach(function (sec) {
      var el = sectionMap[sec.id];
      if (!el) return;

      if (!sec.isActive) {
        el.hidden = true;
        el.style.display = "none";
        return;
      }

      // Active section
      el.style.display = "";
      if (sec.id !== "smart_feed") {
        var isCategory = el.classList.contains("category-section");
        if (!isCategory) {
          el.hidden = false;
        }
      }

      // Update title
      var h2 = el.querySelector(".section-header h2");
      if (h2) {
        var title = lang === "uz" ? sec.titleUz : sec.titleRu;
        if (title) {
          h2.textContent = title;
        }
      }

      // Update link
      var link = el.querySelector(".section-header .section-link");
      if (link) {
        var linkText = lang === "uz" ? sec.linkTextUz : sec.linkTextRu;
        if (linkText) link.textContent = linkText;
        if (sec.linkUrl) link.setAttribute("href", sec.linkUrl);
      }

      // Re-order node in main before perks
      if (perks) {
        main.insertBefore(el, perks);
      } else {
        main.appendChild(el);
      }

      // If smart_feed, ensure trigger is immediately after it
      if (sec.id === "smart_feed" && trigger) {
        if (perks) {
          main.insertBefore(trigger, perks);
        } else {
          main.appendChild(trigger);
        }
      }
    });
  }

  root.emirateHomeSections = {
    ADMIN_HOME_SECTIONS_KEY: ADMIN_HOME_SECTIONS_KEY,
    PUBLIC_HOME_SECTIONS_KEY: PUBLIC_HOME_SECTIONS_KEY,
    DEFAULT_HOME_SECTIONS: DEFAULT_HOME_SECTIONS,
    normalizeHomeSection: normalizeHomeSection,
    loadHomeSections: loadHomeSections,
    persistHomeSections: persistHomeSections,
    ensurePublicHomeSectionsLoaded: ensurePublicHomeSectionsLoaded,
    applyHomeSectionsToDOM: applyHomeSectionsToDOM
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.emirateHomeSections;
  }
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
