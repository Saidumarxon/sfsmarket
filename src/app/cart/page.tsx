"use client";

import Link from "next/link";
import { useSyncExternalStore, useCallback } from "react";
import {
  subscribeCart,
  getCartItemsSnapshot,
  getCartItemsServerSnapshot,
  updateQty,
  removeFromCart,
  clearCart,
  type CartItem,
} from "@/lib/cart";
import { formatMoney, monthlyFrom } from "@/lib/products";

export default function CartPage() {
  const items: CartItem[] = useSyncExternalStore(
    subscribeCart,
    getCartItemsSnapshot,
    getCartItemsServerSnapshot
  );

  const totalPrice = items.reduce((s, i) => s + i.price * i.qty, 0);
  const totalOld = items.reduce((s, i) => s + i.oldPrice * i.qty, 0);
  const totalDiscount = totalOld - totalPrice;
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  const handleClear = useCallback(() => {
    if (window.confirm("Очистить корзину?")) clearCart();
  }, []);

  if (items.length === 0) {
    return (
      <main className="container cart-page">
        <nav className="breadcrumbs">
          <Link href="/">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            Главная
          </Link>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          <span>Корзина</span>
        </nav>

        <div className="cart-empty">
          <div className="cart-empty-icon">
            <svg width="80" height="80" fill="none" stroke="#cbd5e1" strokeWidth="1" viewBox="0 0 24 24">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
            </svg>
          </div>
          <h1>Корзина пуста</h1>
          <p>Добавьте товары из каталога, чтобы они появились здесь</p>
          <Link href="/catalog" className="btn-primary cart-empty-btn">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            Перейти в каталог
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container cart-page">
      {/* Breadcrumbs */}
      <nav className="breadcrumbs">
        <Link href="/">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          Главная
        </Link>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        <span>Корзина</span>
      </nav>

      {/* Title */}
      <section className="cart-head">
        <h1>
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
          </svg>
          Корзина
        </h1>
        <span className="cart-count-label">{totalQty} {pluralItem(totalQty)}</span>
      </section>

      {/* Layout: Items + Summary */}
      <section className="cart-layout">
        {/* Items list */}
        <div className="cart-items">
          <div className="cart-items-header">
            <span>Товар</span>
            <span>Цена</span>
            <span>Количество</span>
            <span>Итого</span>
            <span></span>
          </div>

          {items.map((item) => (
            <CartRow key={item.slug} item={item} />
          ))}

          <div className="cart-items-footer">
            <button className="btn-clear-cart" type="button" onClick={handleClear}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Очистить корзину
            </button>
            <Link href="/catalog" className="btn-continue-shopping">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              Продолжить покупки
            </Link>
          </div>
        </div>

        {/* Summary card */}
        <aside className="cart-summary">
          <h3>Итого по заказу</h3>

          <div className="summary-row">
            <span>Товары ({totalQty})</span>
            <span>{formatMoney(totalOld)}</span>
          </div>

          <div className="summary-row summary-discount">
            <span>Скидка</span>
            <span>−{formatMoney(totalDiscount)}</span>
          </div>

          <div className="summary-row summary-delivery">
            <span>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8zM5 21a2 2 0 100-4 2 2 0 000 4zM19 21a2 2 0 100-4 2 2 0 000 4z"/></svg>
              Доставка
            </span>
            <span className="delivery-free">Бесплатно</span>
          </div>

          <div className="summary-divider" />

          <div className="summary-total">
            <span>К оплате</span>
            <span>{formatMoney(totalPrice)}</span>
          </div>

          <div className="summary-installment">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
            <span>или от <strong>{monthlyFrom(totalPrice)}/мес</strong> в рассрочку</span>
          </div>

          <button className="btn-checkout" type="button">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Оформить заказ
          </button>

          <div className="summary-guarantees">
            <div className="guarantee-item">
              <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Гарантия оригинальности</span>
            </div>
            <div className="guarantee-item">
              <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
              <span>Возврат в течение 14 дней</span>
            </div>
            <div className="guarantee-item">
              <svg width="16" height="16" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
              <span>Безопасная оплата</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

/* ── Cart row component ── */
function CartRow({ item }: { item: CartItem }) {
  const discount = Math.round((1 - item.price / item.oldPrice) * 100);

  return (
    <div className="cart-item">
      <div className="cart-item-product">
        <Link href={`/product/${item.slug}`} className="cart-item-image">
          <svg width="48" height="48" fill="none" stroke="#cbd5e1" strokeWidth="1" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        </Link>
        <div className="cart-item-info">
          <Link href={`/product/${item.slug}`} className="cart-item-title">{item.title}</Link>
          <span className="cart-item-brand">{item.brand}</span>
          <span className="cart-item-discount-tag">−{discount}%</span>
        </div>
      </div>

      <div className="cart-item-price">
        <span className="cart-price-current">{formatMoney(item.price)}</span>
        <span className="cart-price-old">{formatMoney(item.oldPrice)}</span>
      </div>

      <div className="cart-item-qty">
        <div className="qty-box">
          <button type="button" onClick={() => updateQty(item.slug, item.qty - 1)}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
          </button>
          <span>{item.qty}</span>
          <button type="button" onClick={() => updateQty(item.slug, item.qty + 1)}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>

      <div className="cart-item-total">
        <span>{formatMoney(item.price * item.qty)}</span>
      </div>

      <button className="cart-item-remove" type="button" title="Удалить" onClick={() => removeFromCart(item.slug)}>
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>
  );
}

/* ── Helper ── */
function pluralItem(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "товаров";
  if (last > 1 && last < 5) return "товара";
  if (last === 1) return "товар";
  return "товаров";
}
