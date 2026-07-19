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
