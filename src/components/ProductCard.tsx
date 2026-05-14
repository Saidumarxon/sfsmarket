"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import { formatMoney, monthlyFrom } from "@/lib/products";
import { addToCart } from "@/lib/cart";

type Props = {
  product: Product;
};

function badgeMarkup(product: Product, discount: number) {
  if (product.badge === "sale") return <span className="badge-sale">-{discount}%</span>;
  if (product.badge === "new") return <span className="badge-new">Новинка</span>;
  return (
    <>
      <span className="badge-hit">Хит</span>
      <span className="badge-sale">-{discount}%</span>
    </>
  );
}

export default function ProductCard({ product }: Props) {
  const [wish, setWish] = useState(false);
  const [added, setAdded] = useState(false);

  const discount = useMemo(
    () => Math.round((1 - product.price / product.oldPrice) * 100),
    [product.price, product.oldPrice]
  );
  const stars = `${"★".repeat(Math.floor(product.rating))}${product.rating % 1 >= 0.5 ? "½" : ""}`;

  const handleAdd = () => {
    addToCart(product, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article className="product-card">
      <div className="product-card-top">
        <div className="product-image">
          <div className="product-badges">{badgeMarkup(product, discount)}</div>
          <button
            className={`wishlist-btn ${wish ? "active" : ""}`}
            type="button"
            title="В избранное"
            onClick={() => setWish((v) => !v)}
          >
            <svg width="18" height="18" fill={wish ? "#ef4444" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
          <Link className="product-image-link" href={`/product/${product.slug}`} title="Открыть товар">
            <div className="product-image-placeholder">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              Фото
            </div>
          </Link>
        </div>
      </div>

      <h3 className="product-title">
        <Link href={`/product/${product.slug}`}>{product.title}</Link>
      </h3>

      <div className="product-rating">
        <span className="product-stars">{stars}</span>
        <span className="product-rating-num">{product.rating}</span>
        <span className="product-reviews">({product.reviews})</span>
      </div>

      <div className="product-price-row">
        <span className="product-price">{formatMoney(product.price)}</span>
        <span className="product-old-price">{formatMoney(product.oldPrice)}</span>
      </div>

      <div className="product-installment">от {monthlyFrom(product.price)}/мес</div>

      <div className="product-actions">
        <button className={`add-to-cart-btn ${added ? "added" : ""}`} type="button" onClick={handleAdd}>
          {added ? (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Добавлено
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              В корзину
            </>
          )}
        </button>
        <Link className="quick-buy-btn" href={`/product/${product.slug}`} title="Подробнее">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
