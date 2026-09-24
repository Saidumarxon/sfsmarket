const checkoutFormPageEl = document.getElementById("checkoutFormPage");
const checkoutCountEl = document.getElementById("checkoutCount");
const checkoutTotalEl = document.getElementById("checkoutTotal");
const checkoutItemsPreviewEl = document.getElementById("checkoutItemsPreview");
let checkoutJustPlaced = false;
let customerBonusBalance = 0;
let isUsingBonus = false;
let bonusToSpend = 0;

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
  const grossTotal = Math.max(0, subtotal - promoDiscount);
  let effectiveBonus = 0;
  if (isUsingBonus && customerBonusBalance > 0) {
    const maxSpend = Math.min(customerBonusBalance, grossTotal);
    effectiveBonus = Math.min(Math.max(0, Math.round(Number(bonusToSpend) || 0)), maxSpend);
  }
  const total = Math.max(0, grossTotal - effectiveBonus);
  return { items, subtotal, grossTotal, total, promoDiscount, promoCode, bonusUsed: effectiveBonus, count };
}

function renderCheckoutSummary() {
  const { items, total, promoDiscount, promoCode, bonusUsed, count } = getCartTotals();
  if (checkoutCountEl) checkoutCountEl.textContent = String(count);
  if (checkoutTotalEl) checkoutTotalEl.textContent = money(total);
  const discountRow = document.getElementById("checkoutDiscountRow");
  const discountEl = document.getElementById("checkoutDiscount");
  if (discountRow && discountEl) {
    discountRow.hidden = promoDiscount <= 0;
    discountEl.textContent = money(promoDiscount);
  }
  const bonusRow = document.getElementById("checkoutBonusRow");
  const bonusDiscountEl = document.getElementById("checkoutBonusDiscount");
  if (bonusRow && bonusDiscountEl) {
    bonusRow.hidden = bonusUsed <= 0;
    bonusDiscountEl.textContent = "−" + money(bonusUsed);
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
  const { items, total, promoDiscount, promoCode, bonusUsed, count } = getCartTotals();
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

  const deliveryMethod = String(fd.get("delivery") || "").trim();
  const deliveryCity = String(fd.get("city") || "").trim();
  const deliveryEstimateObj = (window.emirateDelivery && window.emirateDelivery.calculateDeliveryEstimate)
    ? window.emirateDelivery.calculateDeliveryEstimate({ deliveryMethod, city: deliveryCity, items })
    : null;
  const deliveryEstimate = deliveryEstimateObj ? deliveryEstimateObj.text : "";

  const orderRow = {
    phone: String(fd.get("phone") || "").trim(),
    full_name: String(fd.get("full_name") || "").trim(),
    region: String(fd.get("region") || "").trim(),
    city: deliveryCity,
    address: String(fd.get("address") || "").trim(),
    comment_text: String(fd.get("comment") || "").trim(),
    delivery_method: deliveryMethod,
    delivery_estimate: deliveryEstimate,
    payment_method: String(fd.get("payment") || "").trim(),
    items,
    total_amount: total,
    bonus_used: bonusUsed || 0,
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

function getAddressIcon(title) {
  const t = String(title || "").toLowerCase();
  if (t.includes("дом") || t.includes("uy") || t.includes("home")) return "🏠";
  if (t.includes("работ") || t.includes("ish") || t.includes("work") || t.includes("офис")) return "💼";
  return "📍";
}

function updateCheckoutDeliveryEstimate() {
  const card = document.getElementById("checkoutDeliveryEstimateCard");
  if (!card || !checkoutFormPageEl) return;

  const deliveryRadio = checkoutFormPageEl.querySelector('input[name="delivery"]:checked');
  const deliveryMethod = deliveryRadio ? deliveryRadio.value : "door";
  const cityInput = checkoutFormPageEl.querySelector('input[name="city"]');
  const city = cityInput ? cityInput.value : "";
  const { items } = getCartTotals();

  const estimate = (window.emirateDelivery && window.emirateDelivery.calculateDeliveryEstimate)
    ? window.emirateDelivery.calculateDeliveryEstimate({ deliveryMethod, city, items })
    : {
        text: deliveryMethod === "pickup" ? "Самовывоз: ул. Мустакиллик, 1" : "Доставка 2–5 рабочих дней",
        badge: deliveryMethod === "pickup" ? "Самовывоз" : "Срок доставки",
        desc: "",
        priceHint: "Бесплатно от 500 000 сум",
        type: deliveryMethod === "pickup" ? "pickup" : "region"
      };

  const badgeEl = document.getElementById("checkoutDeliveryEstimateBadge");
  const titleEl = document.getElementById("checkoutDeliveryEstimateTitle");
  const descEl = document.getElementById("checkoutDeliveryEstimateDesc");
  const hintEl = document.getElementById("checkoutDeliveryPriceHint");

  if (badgeEl) badgeEl.textContent = estimate.badge || "";
  if (titleEl) titleEl.textContent = estimate.text || "";
  if (descEl) descEl.textContent = estimate.desc || "";
  if (hintEl) hintEl.textContent = estimate.priceHint || "";

  card.classList.remove("is-standard", "is-pickup");
  if (estimate.type === "pickup") {
    card.classList.add("is-pickup");
  } else if (estimate.type !== "express_24h" && estimate.type !== "express_next_day") {
    card.classList.add("is-standard");
  }
}

async function initCheckoutSavedAddresses(customer) {
  const block = document.getElementById("checkoutSavedAddressesBlock");
  const chipsContainer = document.getElementById("checkoutAddressChips");
  if (!block || !chipsContainer) return;

  const setAddressFields = (region, city, streetAddress) => {
    const rEl = checkoutFormPageEl.querySelector('[name="region"]');
    const cEl = checkoutFormPageEl.querySelector('[name="city"]');
    const aEl = checkoutFormPageEl.querySelector('[name="address"]');
    if (rEl) rEl.value = region || "";
    if (cEl) cEl.value = city || "";
    if (aEl) aEl.value = streetAddress || "";
    updateCheckoutDeliveryEstimate();
  };

  try {
    const addresses = window.emirateAuth?.loadCustomerAddresses
      ? await window.emirateAuth.loadCustomerAddresses()
      : [];

    if (!addresses || !addresses.length) {
      block.hidden = true;
      if (customer?.address) {
        const aEl = checkoutFormPageEl.querySelector('[name="address"]');
        if (aEl && !aEl.value) aEl.value = customer.address;
      }
      updateCheckoutDeliveryEstimate();
      return;
    }

    block.hidden = false;
    chipsContainer.innerHTML = "";

    let defaultAddr = addresses.find((a) => a.is_default) || addresses[0];

    addresses.forEach((addr) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "checkout-address-chip" + (addr.id === defaultAddr?.id ? " is-selected" : "");
      const icon = getAddressIcon(addr.title);
      const isDef = addr.is_default ? '<span class="chip-badge">Основной</span>' : "";
      const fullText = [addr.city, addr.street_address, addr.apartment_office ? "кв./оф. " + addr.apartment_office : ""].filter(Boolean).join(", ");
      chip.innerHTML = `${icon} <strong>${escapeHtml(addr.title)}:</strong> ${escapeHtml(fullText)} ${isDef}`;

      chip.addEventListener("click", () => {
        chipsContainer.querySelectorAll(".checkout-address-chip").forEach((c) => c.classList.remove("is-selected"));
        chip.classList.add("is-selected");
        const streetStr = addr.street_address + (addr.apartment_office ? ", кв./оф. " + addr.apartment_office : "");
        setAddressFields(addr.region, addr.city, streetStr);
      });

      chipsContainer.appendChild(chip);
    });

    const manualChip = document.createElement("button");
    manualChip.type = "button";
    manualChip.className = "checkout-address-chip";
    manualChip.innerHTML = `✏️ <span>Ввести другой адрес вручную</span>`;
    manualChip.addEventListener("click", () => {
      chipsContainer.querySelectorAll(".checkout-address-chip").forEach((c) => c.classList.remove("is-selected"));
      manualChip.classList.add("is-selected");
      const aEl = checkoutFormPageEl.querySelector('[name="address"]');
      if (aEl) {
        aEl.value = "";
        aEl.focus();
      }
      updateCheckoutDeliveryEstimate();
    });
    chipsContainer.appendChild(manualChip);

    if (defaultAddr) {
      const streetStr = defaultAddr.street_address + (defaultAddr.apartment_office ? ", кв./оф. " + defaultAddr.apartment_office : "");
      setAddressFields(defaultAddr.region, defaultAddr.city, streetStr);
    }
  } catch (err) {
    console.warn("[checkout] initSavedAddresses error", err);
    block.hidden = true;
  }
  updateCheckoutDeliveryEstimate();
}

async function prefillCheckoutForm() {
  if (!checkoutFormPageEl) return;

  // Delivery radio handler to toggle address visibility and update estimate
  checkoutFormPageEl.querySelectorAll('input[name="delivery"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const isPickup = e.target.value === "pickup";
      const block = document.getElementById("checkoutSavedAddressesBlock");
      const addrField = document.getElementById("checkoutAddressField");
      if (block) block.hidden = isPickup;
      if (addrField) {
        const input = addrField.querySelector('input[name="address"]');
        if (input) input.required = !isPickup;
        addrField.hidden = isPickup;
      }
      updateCheckoutDeliveryEstimate();
    });
  });

  const cityInput = checkoutFormPageEl.querySelector('input[name="city"]');
  if (cityInput) {
    cityInput.addEventListener("input", updateCheckoutDeliveryEstimate);
    cityInput.addEventListener("change", updateCheckoutDeliveryEstimate);
  }

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

  void initCheckoutSavedAddresses(customer);
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

async function initCheckoutBonusWidget() {
  const block = document.getElementById("checkoutBonusBlock");
  const availEl = document.getElementById("checkoutBonusAvail");
  const useCheckbox = document.getElementById("checkoutUseBonus");
  const inputRow = document.getElementById("checkoutBonusInputRow");
  const inputEl = document.getElementById("checkoutBonusInput");
  const maxBtn = document.getElementById("checkoutBonusAllBtn");
  if (!block || !useCheckbox) return;

  try {
    let summary = null;
    if (window.emirateAuth?.loadLoyaltySummary) {
      summary = await window.emirateAuth.loadLoyaltySummary();
    }
    customerBonusBalance = Number(summary?.bonus_balance) || 0;
    if (customerBonusBalance <= 0) {
      block.hidden = true;
      return;
    }

    block.hidden = false;
    if (availEl) availEl.textContent = money(customerBonusBalance);

    useCheckbox.addEventListener("change", () => {
      isUsingBonus = useCheckbox.checked;
      if (inputRow) inputRow.hidden = !isUsingBonus;
      if (isUsingBonus) {
        const { grossTotal } = getCartTotals();
        const maxPossible = Math.min(customerBonusBalance, grossTotal);
        bonusToSpend = maxPossible;
        if (inputEl) inputEl.value = String(bonusToSpend);
      } else {
        bonusToSpend = 0;
      }
      renderCheckoutSummary();
    });

    inputEl?.addEventListener("input", () => {
      const { grossTotal } = getCartTotals();
      const maxPossible = Math.min(customerBonusBalance, grossTotal);
      let val = Math.round(Number(inputEl.value) || 0);
      if (val < 0) val = 0;
      if (val > maxPossible) val = maxPossible;
      bonusToSpend = val;
      renderCheckoutSummary();
    });

    maxBtn?.addEventListener("click", () => {
      const { grossTotal } = getCartTotals();
      const maxPossible = Math.min(customerBonusBalance, grossTotal);
      bonusToSpend = maxPossible;
      if (inputEl) inputEl.value = String(maxPossible);
      renderCheckoutSummary();
    });
  } catch (err) {
    console.warn("[checkout] initCheckoutBonusWidget", err);
    block.hidden = true;
  }
}

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
void initCheckoutBonusWidget();
