/**
 * Customer auth — Google OAuth via Supabase.
 *
 * Supabase Dashboard setup:
 * 1) Authentication → Providers → Google → Enable
 * 2) Google Cloud Console → OAuth client → Authorized redirect URI:
 *    https://<project-ref>.supabase.co/auth/v1/callback
 * 3) Authentication → URL Configuration → Redirect URLs:
 *    https://www.emirateco.uz/auth-callback.html
 *    http://localhost:5500/auth-callback.html  (local testing)
 */
(function () {
  var CUSTOMER_KEY = "emirate_customer";
  var otpSendLocks = {};

  function siteOrigin() {
    return String(window.EMIRATE_SITE_URL || window.location.origin).replace(/\/+$/, "");
  }

  function supabaseClient() {
    return window.emirateSupabase || null;
  }

  function isConfigured() {
    return !!(window.emirateSupabaseApi && window.emirateSupabaseApi.isConfigured && window.emirateSupabaseApi.isConfigured());
  }

  function getOAuthRedirectUrl(nextPath) {
    var url = siteOrigin() + "/auth-callback.html";
    if (nextPath) url += "?next=" + encodeURIComponent(nextPath);
    return url;
  }

  async function syncCustomerProfileToDb(user) {
    var sb = supabaseClient();
    if (!sb || !user || !user.id) return { ok: false };

    try {
      var isAdmin = await isAdminUser(user.id);
      if (isAdmin) return { ok: true, skipped: "admin" };
    } catch (_) {}

    var profile = extractProfile(user);
    if (!profile) return { ok: false };

    var row = {
      user_id: user.id,
      email: profile.email || null,
      full_name: profile.name || null,
      phone: profile.phone || null,
      avatar_url: profile.avatar || null,
      provider: profile.provider || "google",
      passport: profile.passport || null,
      birthday: profile.birthday || null,
      gender: profile.gender || null,
      address: profile.address || null,
      work_address: profile.workAddress || null,
      last_seen_at: new Date().toISOString(),
    };

    if (user.created_at) {
      row.registered_at = user.created_at;
    }

    try {
      var res = await sb.from("customer_profiles").upsert(row, { onConflict: "user_id" });
      if (res.error) return { ok: false, error: res.error };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function persistCustomerSession(session) {
    if (!session || !session.user) return null;
    var profile = extractProfile(session.user);
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(profile));
    } catch (_) {}
    void syncCustomerProfileToDb(session.user);
    return profile;
  }

  function detectProvider(user) {
    if (!user) return "unknown";
    var appMeta = user.app_metadata || {};
    if (appMeta.provider) return String(appMeta.provider);
    if (Array.isArray(user.identities) && user.identities[0] && user.identities[0].provider) {
      return String(user.identities[0].provider);
    }
    return "email";
  }

  function isPhoneAuthEmail(email) {
    return /^p\d{9,12}@phone\.emirateco\.uz$/i.test(String(email || "").trim());
  }

  function phoneFromAuthEmail(email) {
    var match = String(email || "").trim().match(/^p(\d{9,12})@phone\.emirateco\.uz$/i);
    if (!match) return "";
    var digits = match[1];
    if (digits.length === 9) return "998" + digits;
    if (digits.startsWith("998")) return digits.slice(0, 12);
    return digits;
  }

  function normalizePhoneDigits(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.indexOf("998") === 0) digits = digits.slice(3);
    digits = digits.slice(0, 9);
    if (digits.length !== 9) return "";
    return "998" + digits;
  }

  function formatUzPhoneDisplay(value) {
    var digits = normalizePhoneDigits(value);
    if (!digits) return "";
    var local = digits.slice(3);
    return "+998 (" + local.slice(0, 2) + ") " + local.slice(2, 5) + "-" + local.slice(5, 7) + "-" + local.slice(7, 9);
  }

  function getProfileInitials(name, email, phone) {
    var source = String(name || "").trim();
    if (source) {
      var parts = source.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      return source.slice(0, 2).toUpperCase();
    }
    if (phone) {
      var local = normalizePhoneDigits(phone).slice(-2);
      return local || "EC";
    }
    var mail = String(email || "").trim();
    if (isPhoneAuthEmail(mail)) return "EC";
    if (mail.indexOf("@") > 0) return mail.split("@")[0].slice(0, 2).toUpperCase();
    return "EC";
  }

  function getCustomerDisplayName(input, lang) {
    var profile = input && input.user_metadata ? extractProfile(input) : input || {};
    var name = String(profile.name || "").trim();
    if (name) return name;
    var phone = String(profile.phone || "").trim() || phoneFromAuthEmail(profile.email);
    if (phone) return formatUzPhoneDisplay(phone);
    var email = String(profile.email || "").trim();
    if (email && !isPhoneAuthEmail(email)) {
      var local = email.split("@")[0];
      return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return lang === "uz" ? "Mijoz" : "Покупатель";
  }

  function extractProfile(user) {
    if (!user) return null;
    var meta = user.user_metadata || {};
    var email = String(user.email || "").trim();
    var phone = String(meta.phone || meta.phone_number || "").trim();
    if (!phone && isPhoneAuthEmail(email)) phone = phoneFromAuthEmail(email);
    phone = normalizePhoneDigits(phone) || phone;
    return {
      id: user.id,
      email: email,
      name: String(meta.full_name || meta.name || meta.user_name || "").trim(),
      avatar: String(meta.avatar_url || meta.picture || "").trim(),
      provider: detectProvider(user),
      passport: String(meta.passport || "").trim(),
      birthday: String(meta.birthday || meta.birth_date || "").trim(),
      phone: phone,
      address: String(meta.address || "").trim(),
      workAddress: String(meta.work_address || "").trim(),
      gender: String(meta.gender || "").trim(),
      ts: Date.now(),
    };
  }

  function formatGenderLabel(gender, lang) {
    var key = String(gender || "").toLowerCase();
    var ru = { male: "Мужской", female: "Женский", unknown: "Не указан" };
    var uz = { male: "Erkak", female: "Ayol", unknown: "Noma'lum" };
    var table = lang === "uz" ? uz : ru;
    return table[key] || table.unknown;
  }

  async function updateCustomerProfile(fields) {
    var sb = supabaseClient();
    if (!sb) return { ok: false, error: { message: "Supabase не настроен" } };

    var payload = {
      full_name: String(fields.fullName || "").trim(),
      passport: String(fields.passport || "").trim(),
      birthday: String(fields.birthday || "").trim(),
      birth_date: String(fields.birthday || "").trim(),
      phone: String(fields.phone || "").trim(),
      phone_number: String(fields.phone || "").trim(),
      address: String(fields.address || "").trim(),
      work_address: String(fields.workAddress || "").trim(),
      gender: String(fields.gender || "unknown").trim(),
    };

    if (fields.avatarUrl) {
      payload.avatar_url = String(fields.avatarUrl).trim();
      payload.picture = String(fields.avatarUrl).trim();
    }

    var res = await sb.auth.updateUser({ data: payload });
    if (res.error) return { ok: false, error: res.error };

    var sessionRes = await sb.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (session) persistCustomerSession(session);
    return { ok: true, user: res.data.user, session: session };
  }

  async function uploadCustomerAvatar(file, userId) {
    var sb = supabaseClient();
    if (!sb || !file || !userId) return { ok: false, error: { message: "no_file" } };

    var ext = String(file.name || "").split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "webp"].indexOf(ext) === -1) ext = "jpg";
    var path = userId + "/avatar." + ext;

    try {
      var uploaded = await sb.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (uploaded.error) return { ok: false, error: uploaded.error };
      var publicUrl = sb.storage.from("avatars").getPublicUrl(path);
      return { ok: true, url: publicUrl.data && publicUrl.data.publicUrl };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function loadCustomer() {
    try {
      var raw = localStorage.getItem(CUSTOMER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  async function loadCustomerForCheckout() {
    var local = loadCustomer();
    var sb = supabaseClient();
    if (!sb) return local;

    var sessionRes = await sb.auth.getSession();
    var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
    if (!user) return local;

    var profile = extractProfile(user) || {};
    var merged = {
      id: user.id,
      email: String(user.email || profile.email || (local && local.email) || "").trim(),
      name: String(profile.name || (local && local.name) || "").trim(),
      phone: String(profile.phone || (local && local.phone) || "").trim(),
      address: String(profile.address || (local && local.address) || "").trim(),
      avatar: String(profile.avatar || (local && local.avatar) || "").trim(),
    };

    try {
      var dbRes = await sb
        .from("customer_profiles")
        .select("full_name,phone,email,address")
        .eq("user_id", user.id)
        .maybeSingle();
      if (dbRes.data) {
        var row = dbRes.data;
        if (row.full_name) merged.name = String(row.full_name).trim();
        if (row.phone) merged.phone = String(row.phone).trim();
        if (row.email) merged.email = String(row.email).trim();
        if (row.address) merged.address = String(row.address).trim();
      }
    } catch (_) {}

    return merged;
  }

  async function getActiveUserId() {
    var sb = supabaseClient();
    if (!sb) return null;
    try {
      var sessionRes = await sb.auth.getSession();
      var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
      return user && user.id ? user.id : null;
    } catch (_) {
      return null;
    }
  }

  function clearCustomerSession() {
    try {
      localStorage.removeItem(CUSTOMER_KEY);
    } catch (_) {}
  }

  async function isAdminUser(userId) {
    var sb = supabaseClient();
    if (!sb || !userId) return false;
    try {
      var res = await sb.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
      return !!(res.data && res.data.user_id);
    } catch (_) {
      return false;
    }
  }

  async function signInWithGoogle(options) {
    var opts = options || {};
    if (!isConfigured()) {
      return { ok: false, error: { message: "Supabase не настроен" } };
    }
    var sb = supabaseClient();
    var next = opts.next || "login.html";
    var redirectTo = getOAuthRedirectUrl(next);
    var res = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (res.error) return { ok: false, error: res.error };
    return { ok: true, data: res.data };
  }

  async function completeOAuthFromUrl() {
    var sb = supabaseClient();
    if (!sb) return { ok: false, error: "no_client" };

    var params = new URLSearchParams(window.location.search);
    var code = params.get("code");
    var authError = params.get("error_description") || params.get("error");

    if (authError) {
      return { ok: false, error: String(authError) };
    }

    if (code) {
      var exchanged = await sb.auth.exchangeCodeForSession(code);
      if (exchanged.error) {
        return { ok: false, error: exchanged.error.message || "oauth_exchange_failed" };
      }
    }

    var sessionRes = await sb.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (!session) {
      return { ok: false, error: "no_session" };
    }

    var customer = persistCustomerSession(session);
    var admin = await isAdminUser(session.user && session.user.id);
    return { ok: true, session: session, customer: customer, isAdmin: admin };
  }

  async function signOutCustomer() {
    var sb = supabaseClient();
    clearCustomerSession();
    if (sb) {
      try {
        await sb.auth.signOut();
      } catch (_) {}
    }
  }

  async function requestPhoneOtp(phone, purpose) {
    var normalized = String(phone || "").replace(/\D/g, "");
    if (normalized.indexOf("998") === 0) normalized = normalized.slice(3);
    if (normalized.length !== 9) {
      return { ok: false, error: "invalid_phone" };
    }
    var lockKey = normalized + ":" + String(purpose || "login");
    if (otpSendLocks[lockKey]) {
      return otpSendLocks[lockKey];
    }
    otpSendLocks[lockKey] = (async function () {
      try {
        var res = await fetch("/api/auth-send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalized, purpose: purpose || "login" }),
        });
        var data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error || "send_failed",
            retry_after_sec: data.retry_after_sec,
            debug_code: data.debug_code,
            details: data.details || null,
          };
        }
        return {
          ok: true,
          phone: data.phone,
          expires_in: data.expires_in,
          test_mode: data.test_mode,
          debug_code: data.debug_code,
          already_sent: data.already_sent === true,
        };
      } catch (err) {
        return { ok: false, error: err && err.message ? err.message : "network_error" };
      }
    })().finally(function () {
      delete otpSendLocks[lockKey];
    });
    return otpSendLocks[lockKey];
  }

  async function verifyPhoneOtp(phone, code, purpose) {
    if (!isConfigured()) {
      return { ok: false, error: { message: "Supabase не настроен" } };
    }
    var sb = supabaseClient();
    if (!sb) {
      return { ok: false, error: { message: "Supabase не настроен" } };
    }
    try {
      var res = await fetch("/api/auth-verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone, code: code, purpose: purpose || "login" }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.ok || !data.access_token) {
        var errKey = data.error || "verify_failed";
        var messages = {
          otp_invalid: "Неверный код",
          otp_expired: "Код истёк — запросите новый",
          otp_locked: "Слишком много попыток",
          invalid_phone: "Неверный номер телефона",
        };
        return { ok: false, error: { message: messages[errKey] || errKey } };
      }
      var sessionRes = await sb.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionRes.error) {
        return { ok: false, error: sessionRes.error };
      }
      var active = await sb.auth.getSession();
      var session = active.data && active.data.session;
      if (!session) {
        return { ok: false, error: { message: "session_failed" } };
      }
      var customer = persistCustomerSession(session);
      syncCustomerAuthUi();
      return { ok: true, session: session, customer: customer, phone: data.phone };
    } catch (err) {
      return { ok: false, error: { message: err && err.message ? err.message : "network_error" } };
    }
  }

  async function syncSessionToCustomerStorage() {
    var sb = supabaseClient();
    if (!sb) return null;
    var res = await sb.auth.getSession();
    var session = res.data && res.data.session;
    if (!session) {
      clearCustomerSession();
      return null;
    }
    return persistCustomerSession(session);
  }

  function syncCustomerAuthUi() {
    var customer = loadCustomer();
    document.querySelectorAll('a[href="login.html"], a[href="./login.html"]').forEach(function (link) {
      var label = link.querySelector("[data-i18n='header.login']");
      if (!label) return;
      if (customer && customer.name) {
        label.textContent = customer.name.split(" ")[0] || getCustomerDisplayName(customer) || label.textContent;
      } else if (customer) {
        label.textContent = getCustomerDisplayName(customer) || label.textContent;
      }
    });
    if (typeof window.emirateUpdateProfileDropdown === "function") {
      window.emirateUpdateProfileDropdown();
    }
  }

  window.emirateAuth = {
    signInWithGoogle: signInWithGoogle,
    requestPhoneOtp: requestPhoneOtp,
    verifyPhoneOtp: verifyPhoneOtp,
    completeOAuthFromUrl: completeOAuthFromUrl,
    persistCustomerSession: persistCustomerSession,
    extractProfile: extractProfile,
    getCustomerDisplayName: getCustomerDisplayName,
    getProfileInitials: getProfileInitials,
    formatUzPhoneDisplay: formatUzPhoneDisplay,
    isPhoneAuthEmail: isPhoneAuthEmail,
    phoneFromAuthEmail: phoneFromAuthEmail,
    updateCustomerProfile: updateCustomerProfile,
    uploadCustomerAvatar: uploadCustomerAvatar,
    formatGenderLabel: formatGenderLabel,
    syncSessionToCustomerStorage: syncSessionToCustomerStorage,
    syncCustomerProfileToDb: syncCustomerProfileToDb,
    loadCustomer: loadCustomer,
    loadCustomerForCheckout: loadCustomerForCheckout,
    getActiveUserId: getActiveUserId,
    clearCustomerSession: clearCustomerSession,
    signOutCustomer: signOutCustomer,
    isAdminUser: isAdminUser,
    syncCustomerAuthUi: syncCustomerAuthUi,
    isConfigured: isConfigured,
  };

  window.emirateSignInWithGoogle = signInWithGoogle;
  window.emiratePersistCustomerSession = persistCustomerSession;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      syncSessionToCustomerStorage().then(syncCustomerAuthUi);
    });
  } else {
    syncSessionToCustomerStorage().then(syncCustomerAuthUi);
  }
})();
