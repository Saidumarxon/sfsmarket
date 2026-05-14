/**
 * Copy to supabase-config.js and fill in real values.
 * Dashboard → Project Settings → Data API (or API): Project URL + anon / publishable key.
 */
(function () {
  var url = "PASTE_PROJECT_URL_HERE";
  var anonKey = "PASTE_ANON_OR_PUBLISHABLE_KEY_HERE";

  if (!url || url.indexOf("PASTE_") === 0 || !anonKey || anonKey.indexOf("PASTE_") === 0) {
    console.info("[Supabase] Edit supabase-config.js: set url and anonKey.");
    return;
  }

  if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
    console.warn("[Supabase] Load supabase-js before supabase-config.js.");
    return;
  }

  window.emirateSupabase = supabase.createClient(url, anonKey);
})();
