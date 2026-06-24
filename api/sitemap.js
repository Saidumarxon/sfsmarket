/**
 * Dynamic sitemap: static pages + active products from Supabase.
 */
const SITE = String(process.env.EMIRATE_SITE_URL || "https://www.emirateco.uz").replace(/\/+$/, "");
const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://efoujwgalbnfrodgkqyl.supabase.co").replace(/\/+$/, "");
const SUPABASE_ANON = String(
  process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU"
);

const STATIC_PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/catalog", changefreq: "daily", priority: "0.9" },
];

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc, opts) {
  const options = opts || {};
  let out = "  <url>\n    <loc>" + xmlEscape(loc) + "</loc>\n";
  if (options.lastmod) out += "    <lastmod>" + xmlEscape(options.lastmod) + "</lastmod>\n";
  if (options.changefreq) out += "    <changefreq>" + xmlEscape(options.changefreq) + "</changefreq>\n";
  if (options.priority) out += "    <priority>" + xmlEscape(options.priority) + "</priority>\n";
  out += "  </url>\n";
  return out;
}

async function fetchActiveProducts() {
  const endpoint =
    SUPABASE_URL +
    "/rest/v1/products?status=eq.active&select=title,updated_at&order=priority.asc&limit=5000";
  const res = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: "Bearer " + SUPABASE_ANON,
      Accept: "application/json",
    },
  });
  if (!res.ok) return [];
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows
    .map(function (row) {
      const title = String(row.title || "").trim();
      if (!title) return null;
      return {
        title: title,
        updatedAt: row.updated_at || null,
      };
    })
    .filter(Boolean);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");

  let body = '<?xml version="1.0" encoding="UTF-8"?>\n';
  body += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  STATIC_PAGES.forEach(function (page) {
    body += urlEntry(SITE + page.path, {
      changefreq: page.changefreq,
      priority: page.priority,
      lastmod: new Date().toISOString().slice(0, 10),
    });
  });

  try {
    const products = await fetchActiveProducts();
    products.forEach(function (product) {
      const loc = SITE + "/product?product=" + encodeURIComponent(product.title);
      const lastmod = product.updatedAt
        ? String(product.updatedAt).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      body += urlEntry(loc, {
        changefreq: "weekly",
        priority: "0.8",
        lastmod: lastmod,
      });
    });
  } catch (err) {
    console.warn("[sitemap]", err);
  }

  body += "</urlset>\n";
  return res.status(200).send(body);
};
