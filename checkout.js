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

checkoutFormPageEl?.addEventListener("submit", (event) => {
  event.preventDefault();
  alert("Заказ принят! Мы свяжемся с вами в ближайшее время.");
  window.emirateClearCart?.();
  checkoutFormPageEl.reset();
  window.location.href = "catalog.html?cart=1";
});

renderCheckoutSummary();
