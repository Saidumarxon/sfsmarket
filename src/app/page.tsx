import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/products";

export default function Home() {
  const hit = products.slice(0, 4);
  const fresh = products.slice(4, 8);

  return (
    <main>

      {/* ===== HERO ===== */}
      <section className="hero hero--full container">
        <div className="hero-main">
          <div className="hero-slider">
            <div className="hero-slide active">
              <div className="hero-slide-text">
                <span className="hero-tag">🔥 Акция недели</span>
                <h1>Скидки до <span className="text-accent">30%</span> на&nbsp;электронику</h1>
                <p>Рассрочка 0-0-12 месяцев без переплат. Бесплатная доставка по Ташкенту.</p>
                <div className="hero-btns">
                  <Link href="/catalog" className="btn-primary">Смотреть предложения</Link>
                  <Link href="/catalog" className="btn-outline">Перейти в каталог</Link>
                </div>
              </div>
              <div className="hero-slide-visual">
                <div className="hero-device-mockup">
                  <svg width="120" height="120" fill="none" stroke="#4db8e8" strokeWidth="1.2" viewBox="0 0 24 24" opacity=".4"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                </div>
              </div>
            </div>
            <div className="hero-dots">
              <button className="dot active" />
              <button className="dot" />
              <button className="dot" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== HIT PRODUCTS ===== */}
      <section className="container section">
        <div className="section-header">
          <h2>Хиты продаж</h2>
          <Link href="/catalog" className="section-link">Все товары →</Link>
        </div>
        <div className="products-grid">
          {hit.map((product) => <ProductCard key={product.slug} product={product} />)}
        </div>
      </section>

      {/* ===== NEW ARRIVALS ===== */}
      <section className="container section">
        <div className="section-header">
          <h2>Новинки</h2>
          <Link href="/catalog" className="section-link">Смотреть все →</Link>
        </div>
        <div className="products-grid">
          {fresh.map((product) => <ProductCard key={product.slug} product={product} />)}
        </div>
      </section>

      {/* ===== BRANDS ===== */}
      <section className="container section">
        <div className="section-header">
          <h2>Популярные бренды</h2>
        </div>
        <div className="brands-grid">
          <a href="#" className="brand-card">Apple</a>
          <a href="#" className="brand-card">Samsung</a>
          <a href="#" className="brand-card">Xiaomi</a>
          <a href="#" className="brand-card">Sony</a>
          <a href="#" className="brand-card">LG</a>
          <a href="#" className="brand-card">Dyson</a>
          <a href="#" className="brand-card">Huawei</a>
          <a href="#" className="brand-card">JBL</a>
        </div>
      </section>

      {/* ===== PERKS ===== */}
      <section className="container section">
        <div className="perks-grid">
          <article className="perk-card">
            <div className="perk-icon">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
            </div>
            <h3>0-0-12</h3>
            <p>Рассрочка без переплат на любой товар</p>
          </article>
          <article className="perk-card">
            <div className="perk-icon">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8zM5 21a2 2 0 100-4 2 2 0 000 4zM19 21a2 2 0 100-4 2 2 0 000 4z"/></svg>
            </div>
            <h3>24 часа</h3>
            <p>Бесплатная доставка по Ташкенту</p>
          </article>
          <article className="perk-card">
            <div className="perk-icon">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>Гарантия</h3>
            <p>Только оригинальная продукция</p>
          </article>
          <article className="perk-card">
            <div className="perk-icon">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <h3>Поддержка</h3>
            <p>Консультация 7 дней в неделю</p>
          </article>
        </div>
      </section>

    </main>
  );
}
