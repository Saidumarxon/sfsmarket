/**
 * SEO helpers: canonical, Open Graph, Twitter, JSON-LD.
 * Optional verification codes (set before this script loads):
 *   window.EMIRATE_GSC_VERIFICATION = "google-code";
 *   window.EMIRATE_YANDEX_VERIFICATION = "yandex-code";
 */
(function () {
  var DEFAULT_SITE = "https://www.emirateco.uz";
  var DEFAULT_OG_IMAGE = DEFAULT_SITE + "/images/og-emirate.png?v=3";

  window.EMIRATE_SITE_URL = String(window.EMIRATE_SITE_URL || DEFAULT_SITE).replace(/\/+$/, "");

  function absUrl(path) {
    if (!path) return window.EMIRATE_SITE_URL + "/";
    if (/^https?:\/\//i.test(path)) return path;
    var normalized = String(path).charAt(0) === "/" ? path : "/" + path;
    return window.EMIRATE_SITE_URL + normalized;
  }

  function upsertMeta(attr, key, content) {
    if (content === null || content === undefined || content === "") return;
    var selector = 'meta[' + attr + '="' + key + '"]';
    var el = document.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", String(content));
  }

  function upsertLink(rel, href) {
    if (!href) return;
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function upsertHreflang(path) {
    var pagePath = path != null ? path : window.location.pathname + window.location.search;
    var pageUrl = absUrl(pagePath);
    ["ru", "uz", "x-default"].forEach(function (lang) {
      var selector = 'link[rel="alternate"][hreflang="' + lang + '"]';
      var el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", "alternate");
        el.setAttribute("hreflang", lang);
        document.head.appendChild(el);
      }
      el.setAttribute("href", pageUrl);
    });
  }

  function upsertJsonLd(id, data) {
    if (!data) return;
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function applyVerificationTags() {
    if (window.EMIRATE_GSC_VERIFICATION) {
      upsertMeta("name", "google-site-verification", window.EMIRATE_GSC_VERIFICATION);
    }
    if (window.EMIRATE_YANDEX_VERIFICATION) {
      upsertMeta("name", "yandex-verification", window.EMIRATE_YANDEX_VERIFICATION);
    }
  }

  window.emirateApplySeo = function (opts) {
    var options = opts || {};
    var title = options.title || document.title;
    var description = options.description || "";
    var path = options.path != null ? options.path : window.location.pathname + window.location.search;
    var url = absUrl(path);
    var image = absUrl(options.image || DEFAULT_OG_IMAGE);
    var type = options.type || "website";
    var robots = options.noindex ? "noindex, nofollow" : "index, follow";

    if (title) document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", robots);
    upsertLink("canonical", options.canonical || url);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:site_name", "Emirate Co");
    upsertMeta("property", "og:locale", "ru_RU");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", image);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);
    upsertHreflang(path);

    if (options.jsonLd) upsertJsonLd("emirate-jsonld", options.jsonLd);
    if (options.productJsonLd) upsertJsonLd("emirate-product-jsonld", options.productJsonLd);
    applyVerificationTags();
  };

  function stripHtml(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  window.emirateProductSeo = function (product) {
    if (!product || typeof product !== "object") return;
    var lang = document.documentElement.lang === "uz" ? "uz" : "ru";
    var pageTitle = String(product.title || "Товар").trim();
    var seoTitleRu = String(product.seoTitleRu || "").trim();
    var seoTitleUz = String(product.seoTitleUz || "").trim();
    var seoDescRu = String(product.seoDescRu || "").trim();
    var seoDescUz = String(product.seoDescUz || "").trim();
    var descRu = String(product.descRu || "").trim();
    var descUz = String(product.descUz || "").trim();
    var metaTitle =
      (lang === "uz" ? seoTitleUz || seoTitleRu : seoTitleRu || seoTitleUz) ||
      pageTitle + " — Emirate Co";
    var description =
      (lang === "uz" ? seoDescUz || seoDescRu : seoDescRu || seoDescUz) ||
      stripHtml(descRu || descUz) ||
      ("Купить " + pageTitle + " в Emirate Co. Рассрочка, доставка по Узбекистану.");
    var media = window.emirateResolveProductMedia
      ? window.emirateResolveProductMedia(product)
      : { image: product.image || "", photos: product.photos || [] };
    var image = media.image || DEFAULT_OG_IMAGE;
    var path = "/product?product=" + encodeURIComponent(pageTitle);
    var price = Number(product.price) || 0;
    var brand = String(product.brand || "Emirate Co").trim();

    window.emirateApplySeo({
      title: metaTitle,
      description: description.slice(0, 160),
      path: path,
      image: image,
      type: "product",
      productJsonLd: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: pageTitle,
        description: description.slice(0, 500),
        image: image ? [absUrl(image)] : [DEFAULT_OG_IMAGE],
        sku: String(product.sku || ""),
        brand: { "@type": "Brand", name: brand },
        offers: {
          "@type": "Offer",
          url: absUrl(path),
          priceCurrency: "UZS",
          price: price > 0 ? price : undefined,
          availability: "https://schema.org/InStock",
        },
      },
    });
  };

  function initOrganizationJsonLd() {
    upsertJsonLd("emirate-org-jsonld", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Emirate Co",
      url: window.EMIRATE_SITE_URL,
      logo: absUrl("/icons/icon-512.png"),
      email: "info@emirateco.uz",
      telephone: "+998508868844",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Ташкент",
        addressCountry: "UZ",
      },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: "+998508868844",
        contactType: "customer service",
        areaServed: "UZ",
        availableLanguage: ["Russian", "Uzbek"],
      },
    });

    upsertJsonLd("emirate-website-jsonld", {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Emirate Co",
      url: window.EMIRATE_SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: window.EMIRATE_SITE_URL + "/catalog?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    });
  }

  function initProductUrlSeo() {
    var path = window.location.pathname || "";
    if (!/\/product\/?$/i.test(path) && !/\/product\.html$/i.test(path)) return false;
    var params = new URLSearchParams(window.location.search);
    var raw = params.get("product");
    if (!raw) {
      window.emirateApplySeo({
        title: "Товар — Emirate Co",
        description: "Каталог товаров Emirate Co.",
        path: "/product",
        noindex: true,
      });
      return true;
    }
    var title = String(raw).trim();
    if (!title) return false;
    var productPath = "/product?product=" + encodeURIComponent(title);
    window.emirateApplySeo({
      title: title + " — Emirate Co",
      description: ("Купить " + title + " в Emirate Co. Рассрочка, доставка по Узбекистану.").slice(0, 160),
      path: productPath,
      type: "product",
    });
    return true;
  }

  function initFromDocument() {
    var html = document.documentElement;
    if (initProductUrlSeo()) return;

    var seoTitle = html.getAttribute("data-seo-title");
    var seoDescription = html.getAttribute("data-seo-description");
    var seoPath = html.getAttribute("data-seo-path");
    var seoImage = html.getAttribute("data-seo-image");
    var seoType = html.getAttribute("data-seo-type");
    var noindex = html.getAttribute("data-seo-noindex") === "1";

    if (seoTitle || seoDescription || seoPath) {
      window.emirateApplySeo({
        title: seoTitle || document.title,
        description: seoDescription || "",
        path: seoPath || "/",
        image: seoImage || DEFAULT_OG_IMAGE,
        type: seoType || "website",
        noindex: noindex,
      });
    } else {
      applyVerificationTags();
    }

    if (html.getAttribute("data-seo-org") === "1") {
      initOrganizationJsonLd();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFromDocument);
  } else {
    initFromDocument();
  }
})();
