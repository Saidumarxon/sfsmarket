(function () {
  var Capacitor = window.Capacitor;
  if (!Capacitor || typeof Capacitor.isNativePlatform !== "function" || !Capacitor.isNativePlatform()) {
    return;
  }

  document.documentElement.classList.add("capacitor-app");

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

  if (StatusBar && StatusBar.setStyle) {
    void StatusBar.setStyle({ style: "LIGHT" });
  }
  if (StatusBar && StatusBar.setBackgroundColor) {
    void StatusBar.setBackgroundColor({ color: "#ffffff" });
  }
  function hideSplash() {
    if (SplashScreen && SplashScreen.hide) {
      void SplashScreen.hide();
    }
  }

  hideSplash();
  document.addEventListener("DOMContentLoaded", hideSplash);
  window.addEventListener("load", hideSplash);

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target.closest("a[href]");
      if (!link || !Browser || !Browser.open) return;
      var href = link.getAttribute("href");
      if (!isExternalHref(href)) return;
      event.preventDefault();
      void Browser.open({ url: href });
    },
    true
  );

  if (App && App.addListener) {
    App.addListener("backButton", function (payload) {
      if (payload && payload.canGoBack) {
        history.back();
        return;
      }
      if (App.minimizeApp) App.minimizeApp();
    });
  }
})();
