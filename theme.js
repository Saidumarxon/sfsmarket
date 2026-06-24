(function () {
  try {
    if (localStorage.getItem("emirate_theme") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (_) {}
})();
