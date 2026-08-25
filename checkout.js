const checkoutFormPageEl = document.getElementById("checkoutFormPage");
const checkoutCountEl = document.getElementById("checkoutCount");
const checkoutTotalEl = document.getElementById("checkoutTotal");
const checkoutItemsPreviewEl = document.getElementById("checkoutItemsPreview");
let checkoutJustPlaced = false;

function money(value) {
  return Number(value || 0).toLocaleString("ru-RU") + " сум";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getCartTotals() {
  const items = window.emirateGetCartItems?.() || [];
  const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);
  const count = items.reduce((sum, item) => sum + (item.qty || 1), 0);
  const applied = window.emiratePromos?.getAppliedPromo?.();
  let promoDiscount = 0;
  let promoCode = "";
  if (applied?.code && window.emiratePromos?.evaluatePromo) {
    const checked = window.emiratePromos.evaluatePromo(applied.code, subtotal, { skipAuth: window.emiratePromos.isCustomerRegistered?.() });
    if (checked.ok) {
      promoDiscount = checked.discount;
      promoCode = checked.promo.code;
    }
  }
  return { items, subtotal, total: Math.max(0, subtotal - promoDiscount), promoDiscount, promoCode, count };
}

function renderCheckoutSummary() {
  const { items, total, promoDiscount, promoCode, count } = getCartTotals();
  if (checkoutCountEl) checkoutCountEl.textContent = String(count);
  if (checkoutTotalEl) checkoutTotalEl.textContent = money(total);
  const discountRow = document.getElementById("checkoutDiscountRow");
  const discountEl = document.getElementById("checkoutDiscount");
  if (discountRow && discountEl) {
    discountRow.hidden = promoDiscount <= 0;
    discountEl.textContent = money(promoDiscount);
  }
  const codeInput = document.getElementById("checkoutPromoCode");
  if (codeInput && promoCode && !codeInput.value.trim()) codeInput.value = promoCode;

  if (checkoutItemsPreviewEl) {
    checkoutItemsPreviewEl.innerHTML = items
      .map((item, index) => `
        <div class="checkout-item-mini">
          <strong>${escapeHtml(window.emirateProductDisplayTitle?.(item) || item.title)}</strong>
          <div>${item.qty} шт. · ${money((item.price || 0) * (item.qty || 1))}</div>
          <button class="checkout-item-remove" type="button" data-index="${index}">Удалить</button>
        </div>
      `)
      .join("");
  }

  if (!count && !checkoutJustPlaced) {
    window.location.href = "catalog.html?cart=1";
  }
}

checkoutItemsPreviewEl?.addEventListener("click", (event) => {
  const btn = event.target.closest(".checkout-item-remove");
  if (!btn) return;
  const index = Number(btn.getAttribute("data-index"));
  const { items } = getCartTotals();
  const title = items[index]?.title;
  if (!title) return;
  window.emirateRemoveFromCart?.(title);
  renderCheckoutSummary();
});

checkoutFormPageEl?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const typedPromo = String(document.getElementById("checkoutPromoCode")?.value || "").trim();
  const { items, total, promoDiscount, promoCode, count } = getCartTotals();
  if (!count) return;
  if ((typedPromo || promoCode) && !window.emiratePromos?.isCustomerRegistered?.()) {
    alert(window.emiratePromos?.authRequiredMessage?.() || "Iltimos, avval ro‘yxatdan o‘ting");
    return;
  }

  const fd = new FormData(checkoutFormPageEl);
  let customer = null;
  if (window.emirateAuth?.loadCustomerForCheckout) {
    try {
      customer = await window.emirateAuth.loadCustomerForCheckout();
    } catch (_) {
      customer = window.emirateAuth?.loadCustomer?.() || null;
    }
  } else {
    customer = window.emirateAuth?.loadCustomer?.() || null;
  }
  const userId = customer?.id || (window.emirateAuth?.getActiveUserId
    ? await window.emirateAuth.getActiveUserId()
    : null);

  const orderRow = {
    phone: String(fd.get("phone") || "").trim(),
    full_name: String(fd.get("full_name") || "").trim(),
    region: String(fd.get("region") || "").trim(),
    city: String(fd.get("city") || "").trim(),
    address: String(fd.get("address") || "").trim(),
    comment_text: String(fd.get("comment") || "").trim(),
    delivery_method: String(fd.get("delivery") || "").trim(),
    payment_method: String(fd.get("payment") || "").trim(),
    items,
    total_amount: total,
    user_id: userId || null,
    customer_email: customer?.email || "",
    promo_code: promoCode || "",
    promo_discount: promoDiscount || 0,
  };

  const submitBtn = checkoutFormPageEl.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Отправка...";
  }

  let placed = { ok: true, id: "", orderNumber: null };
  if (window.emirateSupabaseApi?.isConfigured?.()) {
    placed = (await window.emiratePlaceOrder?.(orderRow)) || { ok: false };
    if (!placed.ok) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Заказать";
      }
      alert(
        "Не удалось сохранить заказ в Supabase. Проверьте таблицу orders и политики RLS (файл supabase/schema.sql).\n" +
          (placed.error || "")
      );
      return;
    }
  }

  if (userId && window.emirateAuth?.updateCustomerProfile) {
    void window.emirateAuth.updateCustomerProfile({
      fullName: orderRow.full_name,
      phone: orderRow.phone,
      address: orderRow.address,
    });
  }

  if (promoCode) window.emiratePromos?.markPromoUsed?.(promoCode);
  window.emiratePromos?.clearAppliedPromo?.();
  checkoutJustPlaced = true;
  window.emirateClearCart?.();
  checkoutFormPageEl.reset();
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Заказать";
  }
  if (window.emirateShowOrderSuccess) {
    window.emirateShowOrderSuccess({
      id: placed.id,
      orderNumber: placed.orderNumber,
      onClose: function () {
        window.location.href = "index.html";
      },
    });
    return;
  }
  alert("Заказ принят! Мы свяжемся с вами в ближайшее время.");
  window.location.href = "index.html";
});

async function prefillCheckoutForm() {
  if (!checkoutFormPageEl) return;
  let customer = null;
  if (window.emirateAuth?.loadCustomerForCheckout) {
    try {
      customer = await window.emirateAuth.loadCustomerForCheckout();
    } catch (_) {
      customer = window.emirateAuth?.loadCustomer?.() || null;
    }
  } else {
    customer = window.emirateAuth?.loadCustomer?.() || null;
  }
  if (!customer) return;
  const set = (name, value) => {
    const el = checkoutFormPageEl.querySelector(`[name="${name}"]`);
    if (el && value) el.value = String(value).trim();
  };
  set("phone", customer.phone);
  set("full_name", customer.name);
  set("address", customer.address);
}

function setCheckoutPromoStatus(text, isError) {
  const el = document.getElementById("checkoutPromoStatus");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("is-error", !!isError);
}

document.getElementById("checkoutPromoApply")?.addEventListener("click", async function () {
  const code = document.getElementById("checkoutPromoCode")?.value || "";
  if (window.emiratePromos?.refreshPublicPromosFromRemote) {
    await window.emiratePromos.refreshPublicPromosFromRemote();
  }
  const { subtotal } = getCartTotals();
  if (!window.emiratePromos?.isCustomerRegistered?.()) {
    window.emiratePromos?.clearAppliedPromo?.();
    setCheckoutPromoStatus(window.emiratePromos?.authRequiredMessage?.() || "Iltimos, avval ro‘yxatdan o‘ting", true);
    renderCheckoutSummary();
    return;
  }
  const result = window.emiratePromos.applyPromoToSubtotal(code, subtotal);
  setCheckoutPromoStatus(result.ok ? (`−${money(result.discount)}`) : (result.message || ""), !result.ok);
  renderCheckoutSummary();
});

void (async () => {
  if (window.emiratePromos?.refreshPublicPromosFromRemote) {
    await window.emiratePromos.refreshPublicPromosFromRemote();
  }
  const applied = window.emiratePromos?.getAppliedPromo?.();
  const input = document.getElementById("checkoutPromoCode");
  if (applied?.code && input) input.value = applied.code;
  renderCheckoutSummary();
})();

renderCheckoutSummary();
void prefillCheckoutForm();
