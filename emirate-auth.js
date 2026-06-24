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

  function extractProfile(user) {
    if (!user) return null;
    var meta = user.user_metadata || {};
    return {
      id: user.id,
      email: String(user.email || "").trim(),
      name: String(meta.full_name || meta.name || meta.user_name || "").trim(),
      avatar: String(meta.avatar_url || meta.picture || "").trim(),
      provider: detectProvider(user),
      passport: String(meta.passport || "").trim(),
      birthday: String(meta.birthday || meta.birth_date || "").trim(),
      phone: String(meta.phone || meta.phone_number || "").trim(),
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
        label.textContent = customer.name.split(" ")[0] || customer.email || label.textContent;
      } else if (customer && customer.email) {
        label.textContent = customer.email.split("@")[0] || label.textContent;
      }
    });
    if (typeof window.emirateUpdateProfileDropdown === "function") {
      window.emirateUpdateProfileDropdown();
    }
  }

  window.emirateAuth = {
    signInWithGoogle: signInWithGoogle,
    completeOAuthFromUrl: completeOAuthFromUrl,
    persistCustomerSession: persistCustomerSession,
    extractProfile: extractProfile,
    updateCustomerProfile: updateCustomerProfile,
    uploadCustomerAvatar: uploadCustomerAvatar,
    formatGenderLabel: formatGenderLabel,
    syncSessionToCustomerStorage: syncSessionToCustomerStorage,
    syncCustomerProfileToDb: syncCustomerProfileToDb,
    loadCustomer: loadCustomer,
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
