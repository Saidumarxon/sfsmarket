const eskiz = require("./eskiz-lib");
const otpLib = require("./sms-otp-lib");

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
    const code = body.code || body.otp || "";
    const purpose = String(body.purpose || "login").trim() || "login";

    const result = await otpLib.completeOtpLogin(phone, code, purpose);
    if (!result.ok) {
      const statusMap = {
        invalid_phone: 400,
        invalid_code: 400,
        otp_not_found: 400,
        otp_expired: 400,
        otp_invalid: 400,
        otp_locked: 429,
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
    });
  } catch (err) {
    console.error("[auth-verify-otp]", err);
    return otpLib.corsJson(res, 500, { ok: false, error: err.message || "server_error" });
  }
};
