/**
 * Eskiz.uz SMS gateway (notify.eskiz.uz).
 * Docs: https://documenter.getpostman.com/view/663428/RzfmES4z
 */
const ESKIZ_BASE = "https://notify.eskiz.uz/api";
const ESKIZ_EMAIL = String(process.env.ESKIZ_EMAIL || "").trim();
const ESKIZ_PASSWORD = String(process.env.ESKIZ_PASSWORD || "").trim();
const ESKIZ_FROM = String(process.env.ESKIZ_FROM || "4546").trim();
const ESKIZ_TEST_MODE = String(process.env.ESKIZ_TEST_MODE || "auto").trim().toLowerCase();

const TEST_TEMPLATES = [
  "This is test from Eskiz",
  "Bu Eskiz dan test",
  "Это тест от Eskiz",
];

let cachedToken = "";
let tokenExpiresAt = 0;

function isConfigured() {
  return !!(ESKIZ_EMAIL && ESKIZ_PASSWORD);
}

function isTestMode() {
  if (ESKIZ_TEST_MODE === "1" || ESKIZ_TEST_MODE === "true" || ESKIZ_TEST_MODE === "yes") return true;
  if (ESKIZ_TEST_MODE === "0" || ESKIZ_TEST_MODE === "false" || ESKIZ_TEST_MODE === "no") return false;
  return true;
}

function normalizeUzPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  if (digits.length !== 9) return "";
  return "998" + digits;
}

function formatPhoneDisplay(phone) {
  const digits = normalizeUzPhone(phone);
  if (!digits) return "";
  const local = digits.slice(3);
  return "+998 (" + local.slice(0, 2) + ") " + local.slice(2, 5) + "-" + local.slice(5, 7) + "-" + local.slice(7, 9);
}

async function login(force) {
  if (!isConfigured()) {
    throw new Error("eskiz_not_configured");
  }
  const now = Date.now();
  if (!force && cachedToken && tokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const res = await fetch(ESKIZ_BASE + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: ESKIZ_EMAIL, password: ESKIZ_PASSWORD }),
  });
  const json = await res.json().catch(function () {
    return null;
  });
  const token = json && json.data && json.data.token ? String(json.data.token).trim() : "";
  if (!res.ok || !token) {
    const err = new Error("eskiz_login_failed");
    err.details = {
      status: res.status,
      message: json && json.message ? String(json.message) : "",
    };
    throw err;
  }
  cachedToken = token;
  tokenExpiresAt = now + 25 * 24 * 60 * 60 * 1000;
  return token;
}

async function refreshToken() {
  if (!cachedToken) return login(true);
  const res = await fetch(ESKIZ_BASE + "/auth/refresh", {
    method: "PATCH",
    headers: {
      Authorization: "Bearer " + cachedToken,
      Accept: "application/json",
    },
  });
  const json = await res.json().catch(function () {
    return null;
  });
  const token = json && json.data && json.data.token ? String(json.data.token).trim() : "";
  if (!res.ok || !token) {
    cachedToken = "";
    return login(true);
  }
  cachedToken = token;
  tokenExpiresAt = Date.now() + 25 * 24 * 60 * 60 * 1000;
  return token;
}

function pickTestTemplate() {
  const preferred = String(process.env.ESKIZ_TEST_TEMPLATE || "This is test from Eskiz").trim();
  if (TEST_TEMPLATES.indexOf(preferred) !== -1) return preferred;
  return TEST_TEMPLATES[0];
}

function buildOtpMessage(code) {
  const custom = String(process.env.ESKIZ_OTP_MESSAGE || "").trim();
  if (custom) {
    return custom.split("{{code}}").join(String(code));
  }
  if (isTestMode()) {
    return pickTestTemplate();
  }
  return "Emirate Co kod: " + String(code);
}

function buildOrderMessage(orderId, lang) {
  const custom = String(process.env.ESKIZ_ORDER_MESSAGE || "").trim();
  const id = String(orderId || "").trim();
  if (custom) {
    return custom.split("{{id}}").join(id).split("{{orderId}}").join(id);
  }
  if (isTestMode()) {
    return "";
  }
  if (lang === "uz") {
    return "Emirate Co: buyurtmangiz qabul qilindi. #" + id.slice(0, 8);
  }
  return "Emirate Co: vash zakaz prinyat. #" + id.slice(0, 8);
}

async function sendSms(phone, message, options) {
  const opts = options || {};
  const normalized = normalizeUzPhone(phone);
  const text = String(message || "").trim();
  if (!normalized) {
    return { ok: false, error: "invalid_phone" };
  }
  if (!text) {
    return { ok: false, error: "empty_message", skipped: true };
  }
  if (!isConfigured()) {
    return { ok: false, error: "eskiz_not_configured" };
  }

  let token;
  try {
    token = await login(false);
  } catch (err) {
    return {
      ok: false,
      error: (err && err.message) || "eskiz_login_failed",
      details: (err && err.details) || null,
    };
  }
  const form = new FormData();
  form.append("mobile_phone", normalized);
  form.append("message", text);
  if (ESKIZ_FROM) form.append("from", ESKIZ_FROM);
  if (opts.callbackUrl) form.append("callback_url", String(opts.callbackUrl));

  let res = await fetch(ESKIZ_BASE + "/message/sms/send", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    body: form,
  });

  if (res.status === 401) {
    try {
      token = await refreshToken();
    } catch (err) {
      return {
        ok: false,
        error: (err && err.message) || "eskiz_login_failed",
        details: (err && err.details) || null,
      };
    }
    res = await fetch(ESKIZ_BASE + "/message/sms/send", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
      },
      body: form,
    });
  }

  const json = await res.json().catch(function () {
    return null;
  });
  if (!res.ok) {
    console.error("[eskiz-lib] sendSms", res.status, json);
    return { ok: false, error: "eskiz_send_failed", status: res.status, details: json };
  }
  return { ok: true, phone: normalized, data: json };
}

async function sendOtpSms(phone, code) {
  return sendSms(phone, buildOtpMessage(code));
}

async function sendOrderSms(phone, orderId, lang) {
  const message = buildOrderMessage(orderId, lang);
  if (!message) {
    return { ok: true, skipped: true, reason: "test_mode_no_template" };
  }
  return sendSms(phone, message);
}

module.exports = {
  TEST_TEMPLATES: TEST_TEMPLATES,
  isConfigured: isConfigured,
  isTestMode: isTestMode,
  normalizeUzPhone: normalizeUzPhone,
  formatPhoneDisplay: formatPhoneDisplay,
  buildOtpMessage: buildOtpMessage,
  buildOrderMessage: buildOrderMessage,
  sendSms: sendSms,
  sendOtpSms: sendOtpSms,
  sendOrderSms: sendOrderSms,
};
