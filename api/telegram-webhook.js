/**
 * Telegram Bot webhook — POST updates from Telegram.
 * Env: TELEGRAM_BOT_TOKEN, SUPABASE_ANON_KEY, optional TELEGRAM_WEBHOOK_SECRET
 */
const bot = require("./telegram-lib");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "emirate-telegram-webhook",
      configured: Boolean(bot.BOT_TOKEN),
      webhookSecret: Boolean(bot.WEBHOOK_SECRET),
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
