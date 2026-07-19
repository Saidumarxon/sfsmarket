/**
 * Telegram order notifications + admin order panel.
 */
const bot = require("../server/telegram-lib");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!bot.BOT_TOKEN) {
    return res.status(503).json({ ok: false, error: "bot_not_configured" });
  }
  if (!bot.hasAdminTargets()) {
    return res.status(503).json({ ok: false, error: "admin_not_configured" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const orderId = String(body.orderId || body.id || "").trim();
    let order = body.order && typeof body.order === "object" ? body.order : null;

    if (orderId) {
      const verified = await bot.fetchOrderById(orderId);
      if (verified) order = verified;
    }
    if (!order) {
      return res.status(400).json({ ok: false, error: "order_missing" });
    }
    if (orderId && !order.id) order.id = orderId;

    const result = await bot.notifyAdminNewOrder(order);
    return res.status(result.ok ? 200 : 500).json(result);
  } catch (err) {
    console.error("[telegram-notify-order]", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};
