/**
 * Create order server-side (bypasses RLS). Requires SUPABASE_SERVICE_ROLE_KEY.
 */
const bot = require("./_lib/telegram-lib");
const eskiz = require("./_lib/eskiz-lib");

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
    const promoCode = String(orderRow.promo_code || body.promo_code || "").trim().toUpperCase();
    if (promoCode && !String(orderRow.user_id || "").trim()) {
      return res.status(401).json({ ok: false, error: "auth_required" });
    }

    // Recompute items subtotal authoritatively from submitted items
    const items = Array.isArray(orderRow.items) ? orderRow.items : [];
    const subtotal = items.reduce(function (sum, item) {
      const price = Math.max(0, Number(item && item.price) || 0);
      const qty = Math.max(1, Math.min(99, Number(item && item.qty) || 1));
      return sum + price * qty;
    }, 0);

    let promoDiscount = 0;
    if (promoCode) {
      const promoCheck = await bot.validateAndGetPromoViaService(promoCode, subtotal);
      if (!promoCheck.ok) {
        return res.status(400).json({ ok: false, error: promoCheck.error || "promo_invalid" });
      }
      promoDiscount = promoCheck.discount;
      const note = String(orderRow.comment_text || "").trim();
      orderRow.comment_text = (note ? note + "\n" : "") + "[PROMO " + promoCode + (promoDiscount ? " −" + promoDiscount : "") + "]";
    }

    const grossTotal = Math.max(0, subtotal - promoDiscount);
    const requestedBonus = Math.max(0, Math.round(Number(orderRow.bonus_used) || 0));
    if (requestedBonus > 0 && !String(orderRow.user_id || "").trim()) {
      return res.status(401).json({ ok: false, error: "auth_required" });
    }
    const bonusUsed = Math.min(requestedBonus, grossTotal);
    const authoritativeTotal = Math.max(0, grossTotal - bonusUsed);

    orderRow.total_amount = authoritativeTotal;
    orderRow.bonus_used = bonusUsed;
    orderRow.promo_discount = promoDiscount;

    const inserted = await bot.insertOrderViaService(orderRow);
    if (!inserted.ok) {
      const status = inserted.error === "service_role_missing" ? 503 : 400;
      return res.status(status).json(inserted);
    }
    if (promoCode && inserted.ok) {
      await bot.redeemPromoViaService(promoCode).catch(function () {});
    }
    await bot.notifyAdminNewOrder(
      Object.assign({ id: inserted.id, order_number: inserted.orderNumber }, inserted.order)
    ).catch(function () {});

    const orderPhone = String((inserted.order && inserted.order.phone) || orderRow.phone || "").trim();
    if (orderPhone && eskiz.isConfigured()) {
      const lang = String(body.lang || orderRow.lang || "ru").trim().toLowerCase();
      void eskiz.sendOrderSms(orderPhone, inserted.orderNumber || inserted.id, lang).catch(function (err) {
        console.warn("[place-order] order sms", err && err.message ? err.message : err);
      });
    }

    return res.status(200).json({
      ok: true,
      id: inserted.id,
      orderNumber: inserted.orderNumber || null,
    });
  } catch (err) {
    console.error("[place-order]", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};
