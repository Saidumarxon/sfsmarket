const eskiz = require("./eskiz-lib");
const otpLib = require("./sms-otp-lib");
const rateLimit = require("./sms-rate-limit");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return otpLib.corsJson(res, 204, {});
  }
  if (req.method !== "POST") {
    return otpLib.corsJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const phone = body.phone || body.mobile_phone || "";
    const purpose = String(body.purpose || "login").trim() || "login";
    const normalized = eskiz.normalizeUzPhone(phone);

    if (!normalized) {
      return otpLib.corsJson(res, 400, { ok: false, error: "invalid_phone" });
    }
    if (!eskiz.isConfigured()) {
      return otpLib.corsJson(res, 503, { ok: false, error: "eskiz_not_configured" });
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
      const status = result.error === "eskiz_not_configured" ? 503 : 400;
      return otpLib.corsJson(res, status, result);
    }

    rateLimit.applyRateLimitHeaders(res, quotaCheck.quota);
    return otpLib.corsJson(res, 200, result);
  } catch (err) {
    console.error("[auth-send-otp]", err);
    return otpLib.corsJson(res, 500, { ok: false, error: err.message || "server_error" });
  }
};
