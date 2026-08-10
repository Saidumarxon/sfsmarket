(function () {
  const gridEl = document.getElementById("ozonCatalogsGrid");
  const emptyEl = document.getElementById("ozonCatalogsEmpty");
  const pageTitleEl = document.getElementById("ozonCatalogsTitle");

  const CARD_TONES = [
    "#e8f1ff",
    "#efe9ff",
    "#e7f8ef",
    "#fff3e8",
    "#ffe8f0",
    "#e8faf8",
    "#f3f4f6",
    "#fff8e1",
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCatalogs() {
    if (!gridEl) return;
    const lang = window.emirateLang?.() || "ru";
    const catalogs = window.emirateCatalogs?.getActiveCatalogs?.() || [];

    if (pageTitleEl) {
      pageTitleEl.textContent = lang === "uz" ? "Katalog" : "Каталог";
    }

    if (!catalogs.length) {
      gridEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;

    gridEl.innerHTML = catalogs
      .map(function (catalog, index) {
        const title = window.emirateCatalogs.getCatalogDisplayName(catalog, lang) || catalog.nameRu;
        const href = window.emirateCatalogs.buildCatalogProductsUrl(catalog);
        const tone = CARD_TONES[index % CARD_TONES.length];
        const image = catalog.imageUrl
          ? `<img class="ozon-catalog-card-img" src="${escapeHtml(catalog.imageUrl)}" alt="${escapeHtml(title)}" loading="lazy">`
          : `<div class="ozon-catalog-card-placeholder" aria-hidden="true"></div>`;
        return `
          <a class="ozon-catalog-card" href="${escapeHtml(href)}" style="--ozon-card-bg:${tone}">
            <span class="ozon-catalog-card-title">${escapeHtml(title)}</span>
            ${image}
          </a>
        `;
      })
      .join("");
  }

  async function init() {
    renderCatalogs();
    document.addEventListener("emirate:langchange", renderCatalogs);
  }

  void init();
  window.emirateRenderStoreCatalogs = renderCatalogs;
})();
