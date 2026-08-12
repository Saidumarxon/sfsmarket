(function () {
  var Capacitor = window.Capacitor;
  if (!Capacitor || typeof Capacitor.isNativePlatform !== "function" || !Capacitor.isNativePlatform()) {
    return;
  }

  document.documentElement.classList.add("capacitor-app");

  /* ===== Directional navigation animation =====
     The departing page records how the navigation happened (push = drill
     down, pop = back, tab = bottom-nav switch); the arriving page reads
     the flag in mobile-head.js before its first paint. */
  function markNav(kind) {
    try {
      sessionStorage.setItem("emirateNavKind", kind);
    } catch (_) {}
  }
  window.emirateMarkNavPop = function () {
    markNav("pop");
  };

  function syncCapacitorHeaderInset() {
    var header = document.querySelector(".header");
    if (!header) return;
    var style = window.getComputedStyle(header);
    if (style.display === "none" || style.visibility === "hidden") return;
    var height = Math.round(header.getBoundingClientRect().height);
    if (height > 0) {
      document.documentElement.style.setProperty("--app-header-height", height + "px");
    }
  }

  function plugin(name) {
    if (typeof Capacitor.registerPlugin === "function") {
      return Capacitor.registerPlugin(name);
    }
    return Capacitor.Plugins && Capacitor.Plugins[name];
  }

  var Browser = plugin("Browser");
  var App = plugin("App");
  var SplashScreen = plugin("SplashScreen");
  var StatusBar = plugin("StatusBar");

  function isExternalHref(href) {
    if (!href || href.charAt(0) === "#") return false;
    if (href.indexOf("javascript:") === 0) return false;
    if (href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return false;
    if (href.indexOf(".html") !== -1) return false;
    try {
      var url = new URL(href, window.location.href);
      return url.origin !== window.location.origin;
    } catch (_) {
      return false;
    }
  }

  function syncStatusBar() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (StatusBar && StatusBar.setStyle) {
      void StatusBar.setStyle({ style: dark ? "DARK" : "LIGHT" });
    }
    if (StatusBar && StatusBar.setBackgroundColor) {
      void StatusBar.setBackgroundColor({ color: dark ? "#0b0f17" : "#ffffff" });
    }
  }

  syncStatusBar();
  new MutationObserver(syncStatusBar).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  function hideSplash() {
    if (SplashScreen && SplashScreen.hide) {
      void SplashScreen.hide();
    }
  }

  hideSplash();
  document.addEventListener("DOMContentLoaded", function () {
    hideSplash();
    syncCapacitorHeaderInset();
  });
  window.addEventListener("load", function () {
    hideSplash();
    syncCapacitorHeaderInset();
  });
  window.addEventListener("resize", syncCapacitorHeaderInset);

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest("a[href]");
      if (!link) return;
      var href = link.getAttribute("href");
      if (isExternalHref(href)) {
        if (!Browser || !Browser.open) return;
        event.preventDefault();
        void Browser.open({ url: href });
        return;
      }
      if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return;
      markNav(link.closest(".mobile-nav") ? "tab" : "push");
    },
    true
  );

  document.addEventListener(
    "submit",
    function () {
      markNav("push");
    },
    true
  );

  /* ===== Native-style keyboard dismissal =====
     Tapping or dragging outside the focused field blurs it, which
     closes the on-screen keyboard — like a native app. */
  function focusedFormField() {
    var el = document.activeElement;
    if (!el) return null;
    var tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) return el;
    return null;
  }

  document.addEventListener(
    "touchstart",
    function (event) {
      var field = focusedFormField();
      if (!field) return;
      var target = event.target;
      if (field === target || field.contains(target)) return;
      if (target.closest && target.closest("input, textarea, select")) return;
      field.blur();
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "touchmove",
    function () {
      var field = focusedFormField();
      if (field) field.blur();
    },
    { capture: true, passive: true }
  );

  if (App && App.addListener) {
    App.addListener("backButton", function (payload) {
      if (payload && payload.canGoBack) {
        markNav("pop");
        history.back();
        return;
      }
      if (App.minimizeApp) App.minimizeApp();
    });
  }
})();
