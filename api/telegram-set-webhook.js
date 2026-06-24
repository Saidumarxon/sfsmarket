/**
 * One-time setup: register Telegram webhook + bot commands.
 * GET /api/telegram-set-webhook?secret=YOUR_TELEGRAM_SETUP_SECRET
 * Env: TELEGRAM_BOT_TOKEN, TELEGRAM_SETUP_SECRET
 */
const bot = require("./telegram-lib");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const setupSecret = String(process.env.TELEGRAM_SETUP_SECRET || "").trim();
  const provided = String(req.query?.secret || "").trim();
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
    console.error("[telegram-set-webhook]", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};
