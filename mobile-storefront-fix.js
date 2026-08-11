(function () {
  if (!document.documentElement.classList.contains("capacitor-app")) return;

  function ensureBottomNavFavorites() {
    var nav = document.querySelector(".mobile-nav");
    if (!nav || nav.querySelector('[href*="favorites=1"]')) return;

    var catalogItem = null;
    var items = nav.querySelectorAll(".mobile-nav-item");
    for (var i = 0; i < items.length; i++) {
      var href = items[i].getAttribute("href") || "";
      if (
        href.indexOf("catalog.html") !== -1 &&
        href.indexOf("cart=1") === -1 &&
        href.indexOf("favorites=1") === -1
      ) {
        catalogItem = items[i];
        break;
      }
    }
    if (!catalogItem) return;

    var fav = document.createElement("a");
    fav.href = "catalog.html?favorites=1";
    fav.className = "mobile-nav-item";
    fav.innerHTML =
      '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' +
      '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>' +
      '<span data-i18n="mobnav.favorites">Избранное</span>';

    var cartItem = nav.querySelector('[href*="cart=1"]');
    if (cartItem) nav.insertBefore(fav, cartItem);
    else catalogItem.parentNode.insertBefore(fav, catalogItem.nextSibling);
  }

  function syncBottomNav() {
    ensureBottomNavFavorites();
    if (typeof window.emirateEnsureMobileNavFavorites === "function") {
      window.emirateEnsureMobileNavFavorites();
    }
    if (typeof window.emirateSyncMobileNavActive === "function") {
      window.emirateSyncMobileNavActive();
    }
  }

  function patchLegacyHeroSlides() {
    var slider = document.querySelector(".hero-slider");
    if (!slider || slider.classList.contains("hero-slider--carousel")) return;

    var slides = slider.querySelectorAll(".hero-slide");
    var patched = false;

    slides.forEach(function (slide) {
      var img = slide.querySelector(".hero-slide-photo, .hero-banner-img");
      var hasBg = slide.style.backgroundImage && slide.style.backgroundImage !== "none";
      if (!img && !hasBg) return;

      slide.querySelectorAll(".hero-slide-text, .hero-btns").forEach(function (node) {
        node.remove();
      });
      slide.classList.remove("hero-slide--image");
      slide.classList.add("hero-slide--banner");
      patched = true;
    });

    if (patched) {
      slider.classList.add("hero-slider--carousel");
    }
  }

  function refreshHomeBanners() {
    if (typeof window.emirateRefreshHomeBanners === "function") {
      window.emirateRefreshHomeBanners();
    }
    patchLegacyHeroSlides();
  }

  /* ===== Real-app page chrome =====
     Root pages (home, catalogs tab, profile) keep the full toolbar.
     Favorites / cart tabs get a plain title bar; every other page
     (product, catalog listing, checkout, info pages) gets a compact
     "back + title" bar like a native app. Runs at script eval so the
     compact bar is part of the page's first paint. */
  function setupAppChrome() {
    var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (!page) page = "index.html";
    var params = new URLSearchParams(location.search);
    /* Only the home tab keeps the full logo + search toolbar.
       (Class logic mirrors mobile-head.js, which runs pre-paint.) */
    var SKIP_PAGES = { "index.html": 1, "auth-callback.html": 1, "admin.html": 1 };
    if (SKIP_PAGES[page]) return;

    var isCart = page === "catalog.html" && params.get("cart") === "1";
    var isFavorites = page === "catalog.html" && params.get("favorites") === "1";
    var isTabRoot = isCart || isFavorites || page === "catalogs.html" || page === "login.html";
    var root = document.documentElement;

    /* Tab root pages already show their title in the content — no top bar
       at all, content starts right below the status bar. */
    if (isTabRoot) {
      root.classList.add("app-no-header");
      return;
    }

    var header = document.querySelector(".header");
    if (!header || header.querySelector(".app-subheader")) return;

    root.classList.add("app-compact-header");
    root.classList.add("app-hide-tabbar");

    function pickTitleSource() {
      if (page === "product.html") return document.querySelector(".product-detail-title");
      if (page === "catalog.html") {
        if (params.get("brand") || params.get("catalog")) {
          return document.getElementById("catalogBrandHeroTitle");
        }
        return document.getElementById("catalogDefaultTitle") || document.querySelector("main h1");
      }
      return document.querySelector("main h1") || document.querySelector(".section-head h2");
    }

    var bar = document.createElement("div");
    bar.className = "app-subheader";

    var back = document.createElement("button");
    back.type = "button";
    back.className = "app-subheader-back";
    back.setAttribute("aria-label", "Назад");
    back.innerHTML =
      '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
    back.addEventListener("click", function () {
      if (typeof window.emirateMarkNavPop === "function") window.emirateMarkNavPop();
      if (history.length > 1) history.back();
      else location.href = "index.html";
    });

    var title = document.createElement("div");
    title.className = "app-subheader-title";

    bar.appendChild(back);
    bar.appendChild(title);
    header.appendChild(bar);

    var titleEl = pickTitleSource();
    function syncTitle() {
      var text = titleEl && titleEl.textContent ? titleEl.textContent.trim() : "";
      if (!text || text === "—") text = document.title || "";
      title.textContent = text;
    }
    syncTitle();
    if (titleEl && window.MutationObserver) {
      new MutationObserver(syncTitle).observe(titleEl, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  }

  setupAppChrome();

  function boot() {
    syncBottomNav();
    if (document.querySelector(".hero-slider")) {
      refreshHomeBanners();
    }
  }

  function scheduleBoot() {
    boot();
    window.setTimeout(boot, 0);
    window.setTimeout(boot, 400);
    window.setTimeout(function () {
      syncBottomNav();
      refreshHomeBanners();
    }, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBoot);
  } else {
    scheduleBoot();
  }
  window.addEventListener("load", scheduleBoot);
  window.addEventListener("pageshow", scheduleBoot);
})();
