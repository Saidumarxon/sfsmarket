/**
 * Public Supabase client config (anon key is safe to publish; access is limited by RLS).
 * Copied to supabase-config.js on deploy when Vercel env vars are not set.
 */
(function () {
  var url = "https://efoujwgalbnfrodgkqyl.supabase.co";
  var anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU";
  var storageBucket = "product-media";

  url = String(url || "").replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");

  if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
    console.warn("[Supabase] Load supabase-js before supabase-config.");
    return;
  }

  window.emirateSupabaseUrl = url;
  window.emirateSupabaseStorageBucket = storageBucket;
  window.emirateSupabase = supabase.createClient(url, anonKey);
})();
