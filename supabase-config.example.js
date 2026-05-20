/**
 * Local dev: copy to supabase-config.js and fill in real values.
 * Production (Vercel): set Environment Variables — file is generated at deploy:
 *   EMIRATE_SUPABASE_URL, EMIRATE_SUPABASE_ANON_KEY
 *   optional: EMIRATE_SUPABASE_STORAGE_BUCKET (default product-media)
 * Dashboard → Project Settings → Data API: Project URL + anon / publishable key.
 */
(function () {
  var url = "PASTE_PROJECT_URL_HERE";
  var anonKey = "PASTE_ANON_OR_PUBLISHABLE_KEY_HERE";
  var storageBucket = "product-media";

  if (!url || url.indexOf("PASTE_") === 0 || !anonKey || anonKey.indexOf("PASTE_") === 0) {
    console.info("[Supabase] Edit supabase-config.js: set url and anonKey.");
    return;
  }

  url = String(url || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");

  if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
    console.warn("[Supabase] Load supabase-js before supabase-config.js.");
    return;
  }

  window.emirateSupabaseUrl = url;
  window.emirateSupabaseStorageBucket = storageBucket;
  window.emirateSupabase = supabase.createClient(url, anonKey);
})();
