"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { products, formatMoney, monthlyFrom } from "@/lib/products";
import { addToCart as addItemToCart } from "@/lib/cart";

export default function ProductDetailsPage() {
  const params = useParams<{ slug: string }>();
  const product = useMemo(
    () => products.find((p) => p.slug === params.slug) ?? products[0],
    [params.slug]
  );

  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<"description" | "specs" | "reviews">("description");
  const [activeThumb, setActiveThumb] = useState(0);
  const [wish, setWish] = useState(false);

  const discount = useMemo(
    () => Math.round((1 - product.price / product.oldPrice) * 100),
    [product.price, product.oldPrice]
  );

  const [added, setAdded] = useState(false);

  const handleAddToCart = (count: number) => {
    addItemToCart(product, count);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  return (
    <main className="container product-page">

      {/* Breadcrumbs */}
      <nav className="breadcrumbs">
        <Link href="/">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          Главная
        </Link>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        <Link href="/catalog">Каталог</Link>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        <span>{product.title}</span>
      </nav>

      {/* Product Layout */}
      <section className="product-layout">

        {/* ── Gallery ── */}
        <div className="product-gallery-card">
          <div className="product-gallery-badges">
            {product.badge === "hit" && <span className="badge-hit">Хит</span>}
            <span className="badge-sale">-{discount}%</span>
          </div>
          <button
            className={`product-gallery-wishlist wishlist-btn${wish ? " active" : ""}`}
            type="button"
            title="В избранное"
            onClick={() => setWish((v) => !v)}
          >
            <svg width="20" height="20" fill={wish ? "#ef4444" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
          <div className="product-main-image" id="productMainImage">
            <svg width="80" height="80" fill="none" stroke="#cbd5e1" strokeWidth="1" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            <span>{product.title}</span>
          </div>
          <div className="product-thumbs">
            {[0, 1, 2, 3].map((i) => (
              <button key={i} className={`thumb${activeThumb === i ? " active" : ""}`} type="button" onClick={() => setActiveThumb(i)}>
                <svg width="28" height="28" fill="none" stroke="#94a3b8" strokeWidth="1" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
              </button>
            ))}
          </div>
        </div>

        {/* ── Product Info ── */}
        <div className="product-info-card">
          <h1 className="product-detail-title">{product.title}</h1>

          <div className="product-info-meta">
            <span className="rating-chip">
              <svg width="14" height="14" fill="#f59e0b" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              {product.rating}
              <span className="reviews-count">({product.reviews} отзыва)</span>
            </span>
            <span className="sku-chip">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              {product.slug.toUpperCase().replace(/-/g, "-")}
            </span>
            <span className="stock-chip in-stock">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              В наличии
            </span>
          </div>

          {/* Price Box */}
          <div className="product-price-box">
            <div className="price-main-row">
              <p className="current-price">{formatMoney(product.price)}</p>
              <p className="old-price">{formatMoney(product.oldPrice)}</p>
            </div>
            <div className="installment-row">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
              <span>от <strong>{monthlyFrom(product.price)}</strong> в рассрочку 0-0-12</span>
            </div>
          </div>

          {/* Options */}
          <div className="product-options">
            <div className="option-group">
              <p className="option-label">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
                Цвет: <strong>Natural Titanium</strong>
              </p>
              <div className="option-row">
                <button type="button" className="option-btn active" style={{ "--swatch": "#c4b5a0" } as React.CSSProperties}>Natural</button>
                <button type="button" className="option-btn" style={{ "--swatch": "#4a6d8c" } as React.CSSProperties}>Blue</button>
                <button type="button" className="option-btn" style={{ "--swatch": "#2c2c2e" } as React.CSSProperties}>Black</button>
                <button type="button" className="option-btn" style={{ "--swatch": "#f5f5f0" } as React.CSSProperties}>White</button>
              </div>
            </div>
            <div className="option-group">
              <p className="option-label">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 7h10v10H7z"/></svg>
                Память
              </p>
              <div className="option-row">
                <button type="button" className="option-btn active">256 GB</button>
                <button type="button" className="option-btn">512 GB</button>
                <button type="button" className="option-btn">1 TB</button>
              </div>
            </div>
          </div>

          {/* Buy Box */}
          <div className="buy-box">
            <div className="qty-box">
              <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
              </button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((v) => Math.min(99, v + 1))}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
            <button className="btn-buy-now" type="button" onClick={() => handleAddToCart(qty)}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Купить сейчас
            </button>
            <button className={`btn-add-cart${added ? " added" : ""}`} type="button" onClick={() => handleAddToCart(qty)}>
              {added ? (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
                  Добавлено
                </>
              ) : (
                <>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
                  В корзину
                </>
              )}
            </button>
          </div>

          {/* Delivery Info */}
          <div className="delivery-info">
            <div className="delivery-item">
              <svg width="18" height="18" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8zM5 21a2 2 0 100-4 2 2 0 000 4zM19 21a2 2 0 100-4 2 2 0 000 4z"/></svg>
              <div>
                <strong>Доставка по Ташкенту за 24 часа</strong>
                <span>Бесплатно от 500 000 сум</span>
              </div>
            </div>
            <div className="delivery-item">
              <svg width="18" height="18" fill="none" stroke="var(--accent)" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
              <div>
                <strong>Оплата: наличные, карта, рассрочка</strong>
                <span>Payme, Click, Uzum, Visa, Mastercard</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <section className="section product-tabs-card">
        <div className="product-tabs">
          <button className={`tab-btn${tab === "description" ? " active" : ""}`} type="button" onClick={() => setTab("description")}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Описание
          </button>
          <button className={`tab-btn${tab === "specs" ? " active" : ""}`} type="button" onClick={() => setTab("specs")}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>
            Характеристики
          </button>
          <button className={`tab-btn${tab === "reviews" ? " active" : ""}`} type="button" onClick={() => setTab("reviews")}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Отзывы ({product.reviews})
          </button>
        </div>

        {/* Description */}
        <div className={`tab-content${tab === "description" ? " active" : ""}`}>
          <h3>О товаре</h3>
          <p>{product.title} — флагманский продукт от {product.brand} с передовыми технологиями и премиальным качеством сборки. Идеальный выбор для тех, кто ценит производительность и надёжность.</p>
          <p>Поддержка новейших стандартов связи, эргономичный дизайн и расширенная гарантия. Рассрочка 0-0-12 без переплат.</p>
        </div>

        {/* Specs */}
        <div className={`tab-content${tab === "specs" ? " active" : ""}`}>
          <div className="specs-list">
            <div className="spec-row"><span className="spec-label">Бренд</span><span className="spec-value">{product.brand}</span></div>
            <div className="spec-row"><span className="spec-label">Категория</span><span className="spec-value">{product.category}</span></div>
            <div className="spec-row"><span className="spec-label">Рейтинг</span><span className="spec-value">{product.rating} / 5</span></div>
            <div className="spec-row"><span className="spec-label">Отзывы</span><span className="spec-value">{product.reviews} отзывов</span></div>
            <div className="spec-row"><span className="spec-label">Артикул</span><span className="spec-value">{product.slug.toUpperCase()}</span></div>
            <div className="spec-row"><span className="spec-label">Гарантия</span><span className="spec-value">12 месяцев</span></div>
            <div className="spec-row"><span className="spec-label">Страна</span><span className="spec-value">Оригинал</span></div>
          </div>
        </div>

        {/* Reviews */}
        <div className={`tab-content${tab === "reviews" ? " active" : ""}`}>
          <div className="review-summary">
            <div className="review-score">
              <span className="score-number">{product.rating}</span>
              <div className="score-stars">★★★★★</div>
              <span className="score-count">{product.reviews} отзыва</span>
            </div>
          </div>
          <div className="review-item">
            <div className="review-header">
              <strong>Алексей К.</strong>
              <span className="review-date">12.03.2026</span>
              <span className="review-rating">★★★★★</span>
            </div>
            <p>Отличный товар! Качество на высоте, доставили за один день. Рекомендую всем.</p>
          </div>
          <div className="review-item">
            <div className="review-header">
              <strong>Мадина Р.</strong>
              <span className="review-date">08.03.2026</span>
              <span className="review-rating">★★★★★</span>
            </div>
            <p>Очень довольна покупкой. Быстрый, качественный, стоит своих денег. Спасибо Emirate Co!</p>
          </div>
        </div>
      </section>
    </main>
  );
}
