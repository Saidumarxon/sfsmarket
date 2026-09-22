/**
 * SMS OTP: send + verify (single serverless function for Vercel Hobby limit).
 * POST /api/auth-sms
 * POST /api/auth-send-otp  (rewrite)
 * POST /api/auth-verify-otp (rewrite; body must include code)
 */
const eskiz = require("./_lib/eskiz-lib");
const otpLib = require("./_lib/sms-otp-lib");
const rateLimit = require("./_lib/sms-rate-limit");

async function handleSend(req, res, body) {
  const phone = body.phone || body.mobile_phone || "";
  const purpose = String(body.purpose || "login").trim() || "login";
  const normalized = eskiz.normalizeUzPhone(phone);

  if (!normalized) {
    return otpLib.corsJson(res, 400, { ok: false, error: "invalid_phone" });
  }
  if (!eskiz.isConfigured()) {
    return otpLib.corsJson(res, 503, { ok: false, error: "eskiz_not_configured" });
  }

  const cooldown = await rateLimit.consumeSmsCooldown(normalized);
  if (!cooldown.allowed) {
    return otpLib.corsJson(res, 200, {
      ok: true,
      phone: normalized,
      expires_in: otpLib.OTP_TTL_SEC,
      already_sent: true,
      retry_after_sec: cooldown.retryAfterSec,
    });
  }

  const quotaCheck = await rateLimit.consumeSmsSendQuota(req, normalized);
  if (!quotaCheck.allowed) {
    rateLimit.applyRateLimitHeaders(res, quotaCheck.quota);
    return otpLib.corsJson(res, 429, {
      ok: false,
      error: "rate_limited",
      scope: quotaCheck.scope,
      retry_after_sec: quotaCheck.quota.retryAfterSec,
    });
  }

  const result = await otpLib.issueOtp(normalized, purpose);
  if (!result.ok) {
    const status =
      result.error === "eskiz_not_configured" || result.error === "supabase_not_configured"
        ? 503
        : result.error === "eskiz_login_failed" || result.error === "eskiz_send_failed"
          ? 502
          : 400;
    return otpLib.corsJson(res, status, result);
  }

  rateLimit.applyRateLimitHeaders(res, quotaCheck.quota);
  return otpLib.corsJson(res, 200, result);
}

async function handleVerify(req, res, body) {
  const phone = body.phone || body.mobile_phone || "";
  const code = body.code || body.otp || "";
  const purpose = String(body.purpose || "login").trim() || "login";
  const fullName = String(body.full_name || body.fullName || body.name || "").trim();

  const result = await otpLib.completeOtpLogin(phone, code, purpose, fullName);
  if (!result.ok) {
    const statusMap = {
      invalid_phone: 400,
      invalid_code: 400,
      otp_not_found: 400,
      otp_expired: 400,
      otp_invalid: 400,
      otp_locked: 429,
      google_account_exists: 409,
      duplicate_phone_detected: 409,
      supabase_not_configured: 503,
      session_failed: 503,
      user_create_failed: 503,
    };
    const status = statusMap[result.error] || 400;
    return otpLib.corsJson(res, status, result);
  }

  return otpLib.corsJson(res, 200, {
    ok: true,
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    phone: result.phone,
    is_new_user: Boolean(result.is_new_user),
    needs_name: Boolean(result.needs_name),
    full_name: result.full_name || (result.user && result.user.user_metadata && result.user.user_metadata.full_name) || null,
  });
}

async function handleCheckPhone(req, res, body) {
  const phone = body.phone || body.mobile_phone || "";
  const currentUserId = String(body.user_id || body.userId || "").trim();
  const normalized = eskiz.normalizeUzPhone(phone);
  if (!normalized) {
    return otpLib.corsJson(res, 400, {
      ok: false,
      error: "invalid_phone",
      message: "Неверный формат номера телефона",
    });
  }
  const profiles = await otpLib.findCustomerProfilesByPhone(normalized);
  const otherProfiles = currentUserId ? profiles.filter(p => p.user_id !== currentUserId) : profiles;
  if (otherProfiles.length > 0) {
    return otpLib.corsJson(res, 200, {
      ok: true,
      available: false,
      error: "phone_already_taken",
      message: "Этот номер телефона уже привязан к другому аккаунту",
      provider: otherProfiles[0].provider || "unknown",
    });
  }
  return otpLib.corsJson(res, 200, { ok: true, available: true, phone: normalized });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return otpLib.corsJson(res, 204, {});
  }
  if (req.method !== "POST") {
    return otpLib.corsJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const action = String(body.action || "").trim().toLowerCase();
    const hasCode = Boolean(String(body.code || body.otp || "").replace(/\D/g, ""));

    if (action === "check_phone" || action === "checkphone") {
      return handleCheckPhone(req, res, body);
    }
    if (action === "verify" || hasCode) {
      return handleVerify(req, res, body);
    }
    return handleSend(req, res, body);
  } catch (err) {
    console.error("[auth-sms]", err);
    return otpLib.corsJson(res, 500, { ok: false, error: err.message || "server_error" });
  }
};
