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

  function persistCustomerSession(session) {
    if (!session || !session.user) return null;
    var user = session.user;
    var meta = user.user_metadata || {};
    var customer = {
      id: user.id,
      email: String(user.email || "").trim(),
      name: String(meta.full_name || meta.name || meta.user_name || "").trim(),
      avatar: String(meta.avatar_url || meta.picture || "").trim(),
      provider: String(meta.provider || "google").trim(),
      ts: Date.now(),
    };
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    } catch (_) {}
    return customer;
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
      }
    });
  }

  window.emirateAuth = {
    signInWithGoogle: signInWithGoogle,
    completeOAuthFromUrl: completeOAuthFromUrl,
    persistCustomerSession: persistCustomerSession,
    syncSessionToCustomerStorage: syncSessionToCustomerStorage,
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
