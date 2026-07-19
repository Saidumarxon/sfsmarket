/**
 * SMS OTP storage + Supabase phone user sessions.
 */
const crypto = require("crypto");
const eskiz = require("./eskiz-lib");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "https://efoujwgalbnfrodgkqyl.supabase.co").replace(/\/+$/, "");
const DEFAULT_SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU";
const SUPABASE_ANON = String(process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON).trim();
const SUPABASE_SERVICE = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ""
).trim();
const PHONE_AUTH_SECRET = String(process.env.ESKIZ_PHONE_AUTH_SECRET || process.env.SMS_PHONE_AUTH_SECRET || SUPABASE_SERVICE || "emirate-phone-auth").trim();

const OTP_TTL_SEC = Math.max(60, Number(process.env.SMS_OTP_TTL_SEC || 300) || 300);
const OTP_LENGTH = Math.min(8, Math.max(4, Number(process.env.SMS_OTP_LENGTH || 6) || 6));
const MAX_VERIFY_ATTEMPTS = 5;

const memoryOtps = new Map();

function corsJson(res, status, payload) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.status(status).json(payload);
}

function generateOtpCode() {
  const max = Math.pow(10, OTP_LENGTH);
  const num = crypto.randomInt(0, max);
  return String(num).padStart(OTP_LENGTH, "0");
}

function hashOtp(code, phone, purpose) {
  return crypto
    .createHash("sha256")
    .update(String(code) + "|" + String(phone) + "|" + String(purpose) + "|" + PHONE_AUTH_SECRET)
    .digest("hex");
}

function phoneEmail(phone) {
  return "p" + phone + "@phone.emirateco.uz";
}

function phonePassword(phone) {
  return crypto.createHmac("sha256", PHONE_AUTH_SECRET).update(String(phone)).digest("hex");
}

async function storeOtp(phone, purpose, code) {
  const codeHash = hashOtp(code, phone, purpose);
  if (SUPABASE_SERVICE) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/store_sms_otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE,
        Authorization: "Bearer " + SUPABASE_SERVICE,
      },
      body: JSON.stringify({
        p_phone: phone,
        p_purpose: purpose,
        p_code_hash: codeHash,
        p_ttl_seconds: OTP_TTL_SEC,
      }),
    });
    if (res.ok) return { ok: true };
    console.warn("[sms-otp-lib] storeOtp Supabase failed, memory fallback");
  }
  memoryOtps.set(phone + ":" + purpose, {
    codeHash: codeHash,
    expiresAt: Date.now() + OTP_TTL_SEC * 1000,
    attempts: 0,
  });
  return { ok: true };
}

async function verifyOtp(phone, purpose, code) {
  const codeHash = hashOtp(code, phone, purpose);
  if (SUPABASE_SERVICE) {
    const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/verify_sms_otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE,
        Authorization: "Bearer " + SUPABASE_SERVICE,
      },
      body: JSON.stringify({
        p_phone: phone,
        p_purpose: purpose,
        p_code_hash: codeHash,
        p_max_attempts: MAX_VERIFY_ATTEMPTS,
      }),
    });
    const json = await res.json().catch(function () {
      return null;
    });
    if (res.ok && json && typeof json.ok === "boolean") {
      return json;
    }
    console.warn("[sms-otp-lib] verifyOtp Supabase failed, memory fallback");
  }

  const key = phone + ":" + purpose;
  const row = memoryOtps.get(key);
  if (!row) return { ok: false, error: "otp_not_found" };
  if (row.expiresAt < Date.now()) {
    memoryOtps.delete(key);
    return { ok: false, error: "otp_expired" };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    memoryOtps.delete(key);
    return { ok: false, error: "otp_locked" };
  }
  if (row.codeHash !== codeHash) {
    row.attempts += 1;
    memoryOtps.set(key, row);
    return { ok: false, error: "otp_invalid" };
  }
  memoryOtps.delete(key);
  return { ok: true };
}

async function ensurePhoneUser(phone) {
  const email = phoneEmail(phone);
  const password = phonePassword(phone);
  if (!SUPABASE_SERVICE || !SUPABASE_ANON) {
    return { ok: false, error: "supabase_not_configured" };
  }

  const signInRes = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      Authorization: "Bearer " + SUPABASE_ANON,
    },
    body: JSON.stringify({ email: email, password: password }),
  });
  const signInJson = await signInRes.json().catch(function () {
    return null;
  });
  if (signInRes.ok && signInJson && signInJson.access_token) {
    return {
      ok: true,
      access_token: signInJson.access_token,
      refresh_token: signInJson.refresh_token,
      user: signInJson.user || null,
    };
  }

  const createRes = await fetch(SUPABASE_URL + "/auth/v1/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE,
      Authorization: "Bearer " + SUPABASE_SERVICE,
    },
    body: JSON.stringify({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        phone: phone,
        phone_number: phone,
        full_name: "",
        provider: "phone",
      },
      app_metadata: {
        provider: "phone",
      },
    }),
  });
  const createJson = await createRes.json().catch(function () {
    return null;
  });
  if (!createRes.ok && createRes.status !== 422) {
    console.error("[sms-otp-lib] ensurePhoneUser create", createRes.status, createJson);
    return { ok: false, error: "user_create_failed" };
  }

  const retryRes = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      Authorization: "Bearer " + SUPABASE_ANON,
    },
    body: JSON.stringify({ email: email, password: password }),
  });
  const retryJson = await retryRes.json().catch(function () {
    return null;
  });
  if (!retryRes.ok || !retryJson || !retryJson.access_token) {
    console.error("[sms-otp-lib] ensurePhoneUser signIn", retryRes.status, retryJson);
    return { ok: false, error: "session_failed" };
  }
  return {
    ok: true,
    access_token: retryJson.access_token,
    refresh_token: retryJson.refresh_token,
    user: retryJson.user || null,
  };
}

async function upsertCustomerProfile(user, phone) {
  if (!SUPABASE_SERVICE || !user || !user.id) return;
  await fetch(SUPABASE_URL + "/rest/v1/customer_profiles?on_conflict=user_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE,
      Authorization: "Bearer " + SUPABASE_SERVICE,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      user_id: user.id,
      phone: phone,
      provider: "phone",
      last_seen_at: new Date().toISOString(),
      registered_at: user.created_at || new Date().toISOString(),
    }),
  }).catch(function () {});
}

async function issueOtp(phone, purpose) {
  const normalized = eskiz.normalizeUzPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone" };
  }
  if (!eskiz.isConfigured()) {
    return { ok: false, error: "eskiz_not_configured" };
  }
  const code = generateOtpCode();
  const stored = await storeOtp(normalized, purpose, code);
  if (!stored.ok) {
    return { ok: false, error: "otp_store_failed" };
  }
  const sent = await eskiz.sendOtpSms(normalized, code);
  if (!sent.ok) {
    return { ok: false, error: sent.error || "sms_send_failed", details: sent.details || null };
  }
  const payload = {
    ok: true,
    phone: normalized,
    expires_in: OTP_TTL_SEC,
    test_mode: eskiz.isTestMode(),
  };
  if (String(process.env.ESKIZ_DEBUG_OTP || "").trim() === "1") {
    payload.debug_code = code;
  }
  return payload;
}

async function completeOtpLogin(phone, code, purpose) {
  const normalized = eskiz.normalizeUzPhone(phone);
  if (!normalized) {
    return { ok: false, error: "invalid_phone" };
  }
  const cleanCode = String(code || "").replace(/\D/g, "");
  if (cleanCode.length < 4) {
    return { ok: false, error: "invalid_code" };
  }

  const verified = await verifyOtp(normalized, purpose, cleanCode);
  if (!verified.ok) {
    return { ok: false, error: verified.error || "otp_invalid" };
  }

  const session = await ensurePhoneUser(normalized);
  if (!session.ok) {
    return session;
  }
  await upsertCustomerProfile(session.user, normalized);
  return {
    ok: true,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    phone: normalized,
    user: session.user,
  };
}

module.exports = {
  OTP_TTL_SEC: OTP_TTL_SEC,
  corsJson: corsJson,
  issueOtp: issueOtp,
  completeOtpLogin: completeOtpLogin,
};
