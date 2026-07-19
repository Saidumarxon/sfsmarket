/**
 * Telegram Bot webhook — POST updates from Telegram.
 * Env: TELEGRAM_BOT_TOKEN, SUPABASE_ANON_KEY, optional TELEGRAM_WEBHOOK_SECRET
 */
const bot = require("../server/telegram-lib");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const setupSecret = String(process.env.TELEGRAM_SETUP_SECRET || "").trim();
    const provided = String(req.query?.secret || "").trim();
    const isSetup = String(req.query?.setup || req.query?.register || "") === "1" || Boolean(setupSecret && provided);

    if (isSetup) {
      if (!setupSecret || provided !== setupSecret) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
      if (!bot.BOT_TOKEN) {
        return res.status(503).json({ ok: false, error: "TELEGRAM_BOT_TOKEN missing" });
      }
      try {
        if (String(req.query?.status || "") === "1") {
          const info = await bot.getWebhookInfo();
          return res.status(200).json({
            ok: true,
            webhook: info.url || "",
            pendingUpdates: info.pending_update_count || 0,
            lastError: info.last_error_message || "",
            lastErrorDate: info.last_error_date || 0,
          });
        }
        const webhookUrl = String(req.query?.url || bot.SITE + "/api/telegram-webhook").trim();
        await bot.registerWebhook(webhookUrl);
        await bot.registerCommands();
        const products = await bot.fetchProducts();
        return res.status(200).json({
          ok: true,
          webhook: webhookUrl,
          productsCached: Array.isArray(products) ? products.length : 0,
        });
      } catch (err) {
        console.error("[telegram-webhook setup]", err);
        return res.status(500).json({ ok: false, error: err.message || String(err) });
      }
    }

    const products = await bot.fetchProducts();
    return res.status(200).json({
      ok: true,
      service: "emirate-telegram-webhook",
      configured: Boolean(bot.BOT_TOKEN),
      webhookSecret: Boolean(bot.WEBHOOK_SECRET),
      supabaseConfigured: Boolean(bot.SUPABASE_ANON),
      adminConfigured: bot.hasAdminTargets(),
      productsCached: Array.isArray(products) ? products.length : 0,
    });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!bot.BOT_TOKEN) {
    return res.status(503).json({ ok: false, error: "bot_not_configured" });
  }
  if (!bot.verifyWebhookSecret(req)) {
    return res.status(403).json({ ok: false, error: "invalid_secret" });
  }

  try {
    const update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    await bot.handleUpdate(update || {});
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[telegram-webhook]", err);
    return res.status(200).json({ ok: true });
  }
};
