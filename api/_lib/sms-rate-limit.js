/**
 * SMS send rate limit (per phone + per IP).
 */
const crypto = require("crypto");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://efoujwgalbnfrodgkqyl.supabase.co").replace(/\/+$/, "");
const SUPABASE_SERVICE = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ""
).trim();

const PHONE_WINDOW_MS = 15 * 60 * 1000;
const PHONE_MAX_HITS = 3;
const PHONE_COOLDOWN_MS = 55 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_HITS = 20;

const memoryStore = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown").trim();
}

function hashIp(ip) {
  const salt = String(process.env.SMS_RATE_SALT || SUPABASE_SERVICE || "emirate-sms-rate").trim();
  return crypto.createHash("sha256").update(String(ip || "") + ":" + salt).digest("hex").slice(0, 40);
}

function pruneHits(hits, now, windowMs) {
  const cutoff = now - windowMs;
  return (hits || []).filter(function (time) {
    return time > cutoff;
  });
}

function consumeFromMemory(clientKey, maxHits, windowMs) {
  const now = Date.now();
  const hits = pruneHits(memoryStore.get(clientKey), now, windowMs);
  if (hits.length >= maxHits) {
    const retryAfterSec = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    memoryStore.set(clientKey, hits);
    return { allowed: false, remaining: 0, retryAfterSec: retryAfterSec, limit: maxHits };
  }
  hits.push(now);
  memoryStore.set(clientKey, hits);
  return {
    allowed: true,
    remaining: Math.max(0, maxHits - hits.length),
    retryAfterSec: 0,
    limit: maxHits,
  };
}

async function consumeFromSupabase(clientKey, maxHits, windowSeconds) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/consume_sms_send_quota", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE,
      Authorization: "Bearer " + SUPABASE_SERVICE,
    },
    body: JSON.stringify({
      p_client_key: clientKey,
      p_max_hits: maxHits,
      p_window_seconds: windowSeconds,
    }),
  });
  const json = await res.json().catch(function () {
    return null;
  });
  if (!res.ok || !json || typeof json.allowed !== "boolean") {
    throw new Error("sms_rate_limit_store_failed");
  }
  return {
    allowed: json.allowed === true,
    remaining: Number(json.remaining) || 0,
    retryAfterSec: Math.max(0, Number(json.retry_after_sec) || 0),
    limit: Number(json.limit) || maxHits,
  };
}

async function consumeQuota(clientKey, maxHits, windowMs) {
  if (SUPABASE_SERVICE) {
    try {
      return await consumeFromSupabase(clientKey, maxHits, Math.floor(windowMs / 1000));
    } catch (err) {
      console.warn("[sms-rate-limit] Supabase fallback:", err && err.message ? err.message : err);
    }
  }
  return consumeFromMemory(clientKey, maxHits, windowMs);
}

async function consumeSmsCooldown(phone) {
  const normalized = String(phone || "").replace(/\D/g, "");
  return consumeQuota("sms:cooldown:" + normalized, 1, PHONE_COOLDOWN_MS);
}

async function consumeSmsSendQuota(req, phone) {
  const normalized = String(phone || "").replace(/\D/g, "");
  const phoneKey = "sms:phone:" + normalized;
  const ipKey = "sms:ip:" + hashIp(getClientIp(req));

  const phoneQuota = await consumeQuota(phoneKey, PHONE_MAX_HITS, PHONE_WINDOW_MS);
  if (!phoneQuota.allowed) {
    return { allowed: false, scope: "phone", quota: phoneQuota };
  }
  const ipQuota = await consumeQuota(ipKey, IP_MAX_HITS, IP_WINDOW_MS);
  if (!ipQuota.allowed) {
    return { allowed: false, scope: "ip", quota: ipQuota };
  }
  return { allowed: true, scope: "ok", quota: phoneQuota };
}

function applyRateLimitHeaders(res, quota) {
  if (!quota) return;
  res.setHeader("X-RateLimit-Limit", String(quota.limit || PHONE_MAX_HITS));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, quota.remaining || 0)));
  if (quota.retryAfterSec > 0) {
    res.setHeader("Retry-After", String(quota.retryAfterSec));
  }
}

module.exports = {
  consumeSmsSendQuota: consumeSmsSendQuota,
  consumeSmsCooldown: consumeSmsCooldown,
  applyRateLimitHeaders: applyRateLimitHeaders,
};
