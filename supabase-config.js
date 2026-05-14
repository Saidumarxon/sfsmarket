/**
 * Supabase: paste values from Dashboard → Project Settings → Data API (or API).
 * Use: Project URL + anon or publishable key only (never service_role / secret).
 */
(function () {
  var url = "https://efoujwgalbnfrodgkqyl.supabase.co/rest/v1/";
  var anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU";

  if (!url || url.indexOf("PASTE_") === 0 || !anonKey || anonKey.indexOf("PASTE_") === 0) {
    console.info("[Supabase] Edit supabase-config.js: set url and anonKey.");
    return;
  }

  if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
    console.warn("[Supabase] Load supabase-js before supabase-config.js (see catalog.html).");
    return;
  }

  window.emirateSupabase = supabase.createClient(url, anonKey);
})();
