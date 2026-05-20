/**
 * Writes supabase-config.js for static deploy (Vercel, etc.).
 * Set env vars in the hosting dashboard:
 *   EMIRATE_SUPABASE_URL  — Project URL (https://xxx.supabase.co)
 *   EMIRATE_SUPABASE_ANON_KEY — anon / publishable key
 * Optional: EMIRATE_SUPABASE_STORAGE_BUCKET (default: product-media)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "supabase-config.js");

const prodFallback = path.join(root, "supabase-config.prod.js");

const url = (process.env.EMIRATE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const anonKey = (process.env.EMIRATE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
const storageBucket = (process.env.EMIRATE_SUPABASE_STORAGE_BUCKET || "product-media").trim() || "product-media";

if (!url || !anonKey) {
  if (fs.existsSync(prodFallback)) {
    fs.copyFileSync(prodFallback, outPath);
    console.log("[supabase-config] Using supabase-config.prod.js → supabase-config.js");
    process.exit(0);
  }
  if (fs.existsSync(outPath)) {
    console.log("[supabase-config] Env not set; keeping existing supabase-config.js");
    process.exit(0);
  }
  console.warn(
    "[supabase-config] No env vars and no supabase-config.prod.js — Supabase will not work on the server."
  );
  process.exit(0);
}

const contents = `/**
 * Generated at deploy time — do not commit (see .gitignore).
 */
(function () {
  var url = ${JSON.stringify(url)};
  var anonKey = ${JSON.stringify(anonKey)};
  var storageBucket = ${JSON.stringify(storageBucket)};

  url = String(url || "").replace(/\\/rest\\/v1\\/?$/i, "").replace(/\\/+$/, "");

  if (typeof supabase === "undefined" || typeof supabase.createClient !== "function") {
    console.warn("[Supabase] Load supabase-js before supabase-config.js.");
    return;
  }

  window.emirateSupabaseUrl = url;
  window.emirateSupabaseStorageBucket = storageBucket;
  window.emirateSupabase = supabase.createClient(url, anonKey);
})();
`;

fs.writeFileSync(outPath, contents, "utf8");
console.log("[supabase-config] Wrote", outPath);
