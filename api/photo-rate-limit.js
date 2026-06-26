/**
 * Photo search rate limit: 3 requests per 5 minutes (per IP or user id).
 * Uses Supabase RPC when SUPABASE_SERVICE_ROLE_KEY is set; in-memory fallback otherwise.
 */
const crypto = require("crypto");

const WINDOW_MS = 5 * 60 * 1000;
const MAX_HITS = 3;

const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://efoujwgalbnfrodgkqyl.supabase.co").replace(
  /\/+$/,
  ""
);
const SUPABASE_SERVICE = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ""
).trim();

const memoryStore = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown").trim();
}

function buildClientKey(req, userId) {
  const id = String(userId || "").trim();
  if (id) return "user:" + id.slice(0, 64);
  const ip = getClientIp(req);
  const salt = String(process.env.PHOTO_RATE_SALT || SUPABASE_SERVICE || "emirate-photo-rate").trim();
  const hash = crypto.createHash("sha256").update(ip + ":" + salt).digest("hex").slice(0, 40);
  return "ip:" + hash;
}

function pruneMemoryHits(hits, now) {
  const cutoff = now - WINDOW_MS;
  return (hits || []).filter(function (time) {
    return time > cutoff;
  });
}

function consumeFromMemory(clientKey) {
  const now = Date.now();
  const hits = pruneMemoryHits(memoryStore.get(clientKey), now);

  if (hits.length >= MAX_HITS) {
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + WINDOW_MS - now) / 1000));
    memoryStore.set(clientKey, hits);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: retryAfterSec,
      limit: MAX_HITS,
    };
  }

  hits.push(now);
  memoryStore.set(clientKey, hits);
  return {
    allowed: true,
    remaining: Math.max(0, MAX_HITS - hits.length),
    retryAfterSec: 0,
    limit: MAX_HITS,
  };
}

async function consumeFromSupabase(clientKey) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/consume_photo_search_quota", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE,
      Authorization: "Bearer " + SUPABASE_SERVICE,
    },
    body: JSON.stringify({
      p_client_key: clientKey,
      p_max_hits: MAX_HITS,
      p_window_seconds: Math.floor(WINDOW_MS / 1000),
    }),
  });

  const json = await res.json().catch(function () {
    return null;
  });

  if (!res.ok || !json || typeof json.allowed !== "boolean") {
    throw new Error("rate_limit_store_failed");
  }

  return {
    allowed: json.allowed === true,
    remaining: Number(json.remaining) || 0,
    retryAfterSec: Math.max(0, Number(json.retry_after_sec) || 0),
    limit: Number(json.limit) || MAX_HITS,
  };
}

async function consumePhotoSearchQuota(req, userId) {
  const clientKey = buildClientKey(req, userId);

  if (SUPABASE_SERVICE) {
    try {
      return await consumeFromSupabase(clientKey);
    } catch (err) {
      console.warn("[photo-rate-limit] Supabase fallback to memory:", err && err.message ? err.message : err);
    }
  }

  return consumeFromMemory(clientKey);
}

function applyRateLimitHeaders(res, quota) {
  if (!quota) return;
  res.setHeader("X-RateLimit-Limit", String(quota.limit || MAX_HITS));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, quota.remaining || 0)));
  if (quota.retryAfterSec > 0) {
    res.setHeader("Retry-After", String(quota.retryAfterSec));
  }
}

module.exports = {
  MAX_HITS: MAX_HITS,
  WINDOW_MS: WINDOW_MS,
  consumePhotoSearchQuota: consumePhotoSearchQuota,
  applyRateLimitHeaders: applyRateLimitHeaders,
};
