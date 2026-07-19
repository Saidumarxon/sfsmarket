/**
 * Create order server-side (bypasses RLS). Requires SUPABASE_SERVICE_ROLE_KEY.
 */
const bot = require("./telegram-lib");
const eskiz = require("./eskiz-lib");

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

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const orderRow = body.order && typeof body.order === "object" ? body.order : body;
    const inserted = await bot.insertOrderViaService(orderRow);
    if (!inserted.ok) {
      const status = inserted.error === "service_role_missing" ? 503 : 400;
      return res.status(status).json(inserted);
    }
    await bot.notifyAdminNewOrder(Object.assign({ id: inserted.id }, inserted.order)).catch(function () {});

    const orderPhone = String((inserted.order && inserted.order.phone) || orderRow.phone || "").trim();
    if (orderPhone && eskiz.isConfigured()) {
      const lang = String(body.lang || orderRow.lang || "ru").trim().toLowerCase();
      void eskiz.sendOrderSms(orderPhone, inserted.id, lang).catch(function (err) {
        console.warn("[place-order] order sms", err && err.message ? err.message : err);
      });
    }

    return res.status(200).json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error("[place-order]", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};
