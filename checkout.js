const checkoutFormPageEl = document.getElementById("checkoutFormPage");
const checkoutCountEl = document.getElementById("checkoutCount");
const checkoutTotalEl = document.getElementById("checkoutTotal");
const checkoutItemsPreviewEl = document.getElementById("checkoutItemsPreview");

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
  const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 1), 0);
  const count = items.reduce((sum, item) => sum + (item.qty || 1), 0);
  return { items, total, count };
}

function renderCheckoutSummary() {
  const { items, total, count } = getCartTotals();
  if (checkoutCountEl) checkoutCountEl.textContent = String(count);
  if (checkoutTotalEl) checkoutTotalEl.textContent = money(total);

  if (checkoutItemsPreviewEl) {
    checkoutItemsPreviewEl.innerHTML = items
      .map((item, index) => `
        <div class="checkout-item-mini">
          <strong>${escapeHtml(item.title)}</strong>
          <div>${item.qty} шт. · ${money((item.price || 0) * (item.qty || 1))}</div>
          <button class="checkout-item-remove" type="button" data-index="${index}">Удалить</button>
        </div>
      `)
      .join("");
  }

  if (!count) {
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
  const { items, total, count } = getCartTotals();
  if (!count) return;

  const fd = new FormData(checkoutFormPageEl);
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
    total_amount: total
  };

  if (window.emirateSupabaseApi?.isConfigured?.()) {
    const res = await window.emirateSupabaseApi.insertOrder(orderRow);
    if (!res.ok) {
      alert(
        "Не удалось сохранить заказ в Supabase. Проверьте таблицу orders и политики RLS (файл supabase/schema.sql).\n" +
          (res.error || "")
      );
      return;
    }
    fetch("/api/telegram-notify-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: res.id, order: orderRow }),
    }).catch(function () {});
  }

  alert("Заказ принят! Мы свяжемся с вами в ближайшее время.");
  window.emirateClearCart?.();
  checkoutFormPageEl.reset();
  window.location.href = "catalog.html?cart=1";
});

renderCheckoutSummary();
