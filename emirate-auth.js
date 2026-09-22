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

  function normalizeUzPhone(value) {
    if (value === null || value === undefined) return "";
    var raw = String(value).trim();
    if (!raw) return "";

    var digits = raw.replace(/\D/g, "");
    var local = "";

    if (digits.length === 12 && digits.indexOf("998") === 0) {
      local = digits.slice(3);
    } else if (digits.length === 10 && digits.charAt(0) === "8") {
      local = digits.slice(1);
    } else if (digits.length === 9) {
      local = digits;
    } else {
      return "";
    }

    if (!/^[2-9]\d{8}$/.test(local)) {
      return "";
    }

    return "+998" + local;
  }

  function toEskizDigits(value) {
    var canon = normalizeUzPhone(value);
    return canon ? canon.slice(1) : "";
  }

  function normalizePhoneDigits(value) {
    return normalizeUzPhone(value);
  }

  function formatUzPhoneDisplay(value) {
    var canon = normalizeUzPhone(value);
    if (!canon) return String(value || "");
    var local = canon.slice(4); // 9 digits
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

    var phoneInput = String(fields.phone || "").trim();
    var canonicalPhone = "";
    if (phoneInput) {
      canonicalPhone = normalizeUzPhone(phoneInput);
      if (!canonicalPhone) {
        return { ok: false, error: { message: "Неверный номер телефона. Формат: +998 (XX) XXX-XX-XX" } };
      }

      var activeUserId = await getActiveUserId();
      try {
        var checkRes = await fetch("/api/auth-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "check_phone",
            phone: canonicalPhone,
            user_id: activeUserId || "",
          }),
        });
        var checkJson = await checkRes.json().catch(function () {
          return null;
        });
        if (checkJson && checkJson.available === false) {
          return {
            ok: false,
            error: {
              message: checkJson.message || "Этот номер телефона уже привязан к другому аккаунту",
              code: "phone_already_taken",
            },
          };
        }
      } catch (_) {}
    }

    var payload = {
      full_name: String(fields.fullName || "").trim(),
      passport: String(fields.passport || "").trim(),
      birthday: String(fields.birthday || "").trim(),
      birth_date: String(fields.birthday || "").trim(),
      phone: canonicalPhone || (phoneInput ? phoneInput : ""),
      phone_number: canonicalPhone || (phoneInput ? phoneInput : ""),
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
    var canon = normalizeUzPhone(phone);
    if (!canon) {
      return { ok: false, error: "invalid_phone" };
    }
    var eskizNumber = toEskizDigits(canon);
    var lockKey = eskizNumber + ":" + String(purpose || "login");
    if (otpSendLocks[lockKey]) {
      return otpSendLocks[lockKey];
    }
    otpSendLocks[lockKey] = (async function () {
      try {
        var res = await fetch("/api/auth-send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: eskizNumber, purpose: purpose || "login" }),
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
          phone: canon,
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

  async function verifyPhoneOtp(phone, code, purpose, fullName) {
    if (!isConfigured()) {
      return { ok: false, error: { message: "Supabase не настроен" } };
    }
    var sb = supabaseClient();
    if (!sb) {
      return { ok: false, error: { message: "Supabase не настроен" } };
    }
    var canon = normalizeUzPhone(phone);
    if (!canon) {
      return { ok: false, error: { message: "Неверный номер телефона" } };
    }
    try {
      var payload = {
        phone: canon,
        code: code,
        purpose: purpose || "login",
      };
      if (fullName && typeof fullName === "string" && fullName.trim()) {
        payload.full_name = fullName.trim();
      }
      var res = await fetch("/api/auth-verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
          google_account_exists:
            data.message || "Этот номер уже привязан к аккаунту Google. Пожалуйста, войдите через Google.",
          duplicate_phone_detected:
            data.message || "Обнаружено несколько аккаунтов с этим номером. Пожалуйста, обратитесь в службу поддержки.",
        };
        return {
          ok: false,
          error: {
            message: messages[errKey] || data.message || errKey,
            code: errKey,
            email_hint: data.email_hint || null,
          },
        };
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
      return {
        ok: true,
        session: session,
        customer: customer,
        phone: data.phone || canon,
        is_new_user: Boolean(data.is_new_user),
        needs_name: Boolean(data.needs_name),
        full_name: data.full_name || (customer && customer.name) || (session && session.user && session.user.user_metadata && session.user.user_metadata.full_name) || null,
      };
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

  async function linkGuestOrdersForCurrentUser() {
    var sb = supabaseClient();
    if (!sb) return { ok: false, count: 0 };
    try {
      var res = await sb.rpc("link_guest_orders_for_current_user");
      if (res.error) {
        return { ok: false, error: res.error.message, count: 0 };
      }
      return { ok: true, count: Number(res.data) || 0 };
    } catch (e) {
      return { ok: false, error: String(e), count: 0 };
    }
  }

  async function loadCustomerOrders() {
    var sb = supabaseClient();
    if (!sb) return [];
    var sessionRes = await sb.auth.getSession();
    var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
    if (!user || !user.id) return [];

    try {
      void linkGuestOrdersForCurrentUser();
    } catch (_) {}

    var res = await sb
      .from("orders")
      .select("id,phone,full_name,region,city,address,comment_text,delivery_method,payment_method,items,total_amount,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (res.error) {
      console.warn("[emirateAuth] loadCustomerOrders error", res.error);
      return [];
    }
    return res.data || [];
  }

  async function loadOrderStatusHistory(orderId) {
    var sb = supabaseClient();
    if (!sb || !orderId) return [];
    try {
      var res = await sb
        .from("order_status_history")
        .select("id,order_id,status,comment,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (res.error) {
        return [];
      }
      return res.data || [];
    } catch (err) {
      return [];
    }
  }

  async function loadCustomerAddresses() {
    var sb = supabaseClient();
    if (!sb) return [];
    var sessionRes = await sb.auth.getSession();
    var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
    if (!user || !user.id) return [];

    try {
      var res = await sb
        .from("customer_addresses")
        .select("id,user_id,title,region,city,street_address,apartment_office,is_default,created_at,updated_at")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (res.error) {
        return [];
      }
      return res.data || [];
    } catch (_) {
      return [];
    }
  }

  async function saveCustomerAddress(addressData) {
    var sb = supabaseClient();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
    if (!user || !user.id) return { ok: false, error: "not_authenticated" };

    var title = String(addressData.title || "Дом").trim();
    var city = String(addressData.city || "").trim();
    var street = String(addressData.street_address || addressData.streetAddress || "").trim();
    if (!city || !street) {
      return { ok: false, error: "Заполните город и улицу" };
    }

    var isDefault = Boolean(addressData.is_default || addressData.isDefault);

    var payload = {
      user_id: user.id,
      title: title,
      city: city,
      street_address: street,
      region: String(addressData.region || "").trim(),
      apartment_office: String(addressData.apartment_office || addressData.apartmentOffice || "").trim(),
      is_default: isDefault,
      updated_at: new Date().toISOString()
    };

    try {
      if (isDefault) {
        await sb
          .from("customer_addresses")
          .update({ is_default: false })
          .eq("user_id", user.id)
          .neq("id", addressData.id || "00000000-0000-0000-0000-000000000000");
      }

      var res;
      if (addressData.id) {
        res = await sb
          .from("customer_addresses")
          .update(payload)
          .eq("id", addressData.id)
          .eq("user_id", user.id)
          .select()
          .single();
      } else {
        res = await sb
          .from("customer_addresses")
          .insert(payload)
          .select()
          .single();
      }
      if (res.error) return { ok: false, error: res.error.message || String(res.error) };
      return { ok: true, data: res.data };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async function deleteCustomerAddress(addressId) {
    var sb = supabaseClient();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
    if (!user || !user.id) return { ok: false, error: "not_authenticated" };

    try {
      var res = await sb
        .from("customer_addresses")
        .delete()
        .eq("id", addressId)
        .eq("user_id", user.id);

      if (res.error) return { ok: false, error: res.error.message || String(res.error) };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  async function setDefaultCustomerAddress(addressId) {
    var sb = supabaseClient();
    if (!sb) return { ok: false, error: "no_client" };
    var sessionRes = await sb.auth.getSession();
    var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
    if (!user || !user.id) return { ok: false, error: "not_authenticated" };

    try {
      await sb
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("id", addressId);

      var res = await sb
        .from("customer_addresses")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", addressId)
        .eq("user_id", user.id);

      if (res.error) return { ok: false, error: res.error.message || String(res.error) };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  function calculateLoyaltyTier(turnover) {
    var t = Number(turnover) || 0;
    if (t >= 30000000) {
      return { tier: "platinum", pct: 5, next_tier: null, next_threshold: 30000000, amount_needed: 0 };
    }
    if (t >= 15000000) {
      return { tier: "gold", pct: 3, next_tier: "platinum", next_threshold: 30000000, amount_needed: 30000000 - t };
    }
    if (t >= 5000000) {
      return { tier: "silver", pct: 2, next_tier: "gold", next_threshold: 15000000, amount_needed: 15000000 - t };
    }
    return { tier: "standard", pct: 1, next_tier: "silver", next_threshold: 5000000, amount_needed: 5000000 - t };
  }

  async function loadLoyaltySummary() {
    var sb = supabaseClient();
    if (!sb) {
      return {
        ok: true,
        bonus_balance: 0,
        loyalty_tier: "standard",
        cashback_percent: 1,
        turnover_successful: 0,
        next_tier: "silver",
        next_tier_threshold: 5000000,
        amount_to_next_tier: 5000000,
        pending_cashback: 0,
        is_emirate_plus: false,
        recent_transactions: [],
      };
    }
    var sessionRes = await sb.auth.getSession();
    var user = sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
    if (!user || !user.id) {
      return { ok: false, error: "unauthorized" };
    }

    try {
      var rpcRes = await sb.rpc("get_customer_loyalty_summary");
      if (!rpcRes.error && rpcRes.data && rpcRes.data.ok) {
        return rpcRes.data;
      }

      // Safe fallback if RPC is not yet created in DB
      var profileRes = await sb
        .from("customer_profiles")
        .select("bonus_balance, loyalty_tier, is_emirate_plus, emirate_plus_until")
        .eq("user_id", user.id)
        .maybeSingle();

      var ordersRes = await sb
        .from("orders")
        .select("total_amount, status")
        .eq("user_id", user.id)
        .eq("status", "successful");

      var successfulTurnover = (ordersRes.data || []).reduce(function (sum, o) {
        return sum + (Number(o.total_amount) || 0);
      }, 0);

      var p = profileRes.data || {};
      var tierInfo = calculateLoyaltyTier(successfulTurnover);

      return {
        ok: true,
        bonus_balance: Number(p.bonus_balance) || 0,
        loyalty_tier: p.loyalty_tier || tierInfo.tier,
        cashback_percent: tierInfo.pct,
        turnover_successful: successfulTurnover,
        next_tier: tierInfo.next_tier,
        next_tier_threshold: tierInfo.next_threshold,
        amount_to_next_tier: tierInfo.amount_needed,
        pending_cashback: 0,
        is_emirate_plus: Boolean(p.is_emirate_plus),
        emirate_plus_until: p.emirate_plus_until || null,
        recent_transactions: [],
      };
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? err.message : String(err),
      };
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
    normalizeUzPhone: normalizeUzPhone,
    toEskizDigits: toEskizDigits,
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
    linkGuestOrdersForCurrentUser: linkGuestOrdersForCurrentUser,
    loadCustomerOrders: loadCustomerOrders,
    loadOrderStatusHistory: loadOrderStatusHistory,
    loadCustomerAddresses: loadCustomerAddresses,
    saveCustomerAddress: saveCustomerAddress,
    deleteCustomerAddress: deleteCustomerAddress,
    setDefaultCustomerAddress: setDefaultCustomerAddress,
    calculateLoyaltyTier: calculateLoyaltyTier,
    loadLoyaltySummary: loadLoyaltySummary,
  };

  window.emirateNormalizeUzPhone = normalizeUzPhone;
  window.emirateFormatUzPhoneDisplay = formatUzPhoneDisplay;
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
