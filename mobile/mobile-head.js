/**
 * Runs in <head>, before the first paint: applies the native-app chrome
 * classes so the very first rendered frame (and the view-transition
 * snapshot) already has the right page structure. Without this the page
 * paints website chrome first and the toolbar visibly blinks on
 * navigation. No-op in the browser.
 */
(function () {
  var C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== "function" || !C.isNativePlatform()) return;
  var root = document.documentElement;
  root.classList.add("capacitor-app");

  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!page) page = "index.html";
  var params = new URLSearchParams(location.search);
  var isCart = page === "catalog.html" && params.get("cart") === "1";
  var isFavorites = page === "catalog.html" && params.get("favorites") === "1";
  var isTabRoot = isCart || isFavorites || page === "catalogs.html" || page === "login.html";
  var SKIP = { "index.html": 1, "auth-callback.html": 1, "admin.html": 1 };

  if (isTabRoot) {
    root.classList.add("app-no-header");
  } else if (!SKIP[page]) {
    root.classList.add("app-compact-header");
    root.classList.add("app-hide-tabbar");
  }

  try {
    var navKind = sessionStorage.getItem("emirateNavKind");
    if (navKind) {
      sessionStorage.removeItem("emirateNavKind");
      root.classList.add("app-nav-" + navKind);
    }
  } catch (_) {}
})();
