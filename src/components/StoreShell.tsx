"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useSyncExternalStore, useState } from "react";
import { usePathname } from "next/navigation";
import { subscribeCart, getCartCountSnapshot, getCartCountServerSnapshot } from "@/lib/cart";

type Props = { children: React.ReactNode };

export default function StoreShell({ children }: Props) {
  const pathname = usePathname();

  /* ── state ── */
  const cartCount = useSyncExternalStore(subscribeCart, getCartCountSnapshot, getCartCountServerSnapshot);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [lang, setLang] = useState<"ru" | "uz">("ru");

  /* close dropdown on route change */
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setDropdownOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [pathname]);

  /* scroll listener */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 10);
      setShowTop(y > 280);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTop = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);

  /* ── render ── */
  return (
    <>
      {/* ===== HEADER ===== */}
      <header className={`header${isScrolled ? " scrolled" : ""}`}>
        <div className="container header-inner">
          <Link className="logo" href="/">
            <img className="logo-img" src="/emirate-logo.svg" alt="Emirate Co" width="160" height="56" />
          </Link>

          <div className="catalog-control">
            <Link className="catalog-btn" href="/catalog">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              Каталог
            </Link>
            <button
              className="catalog-toggle"
              type="button"
              aria-label="Открыть категории"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((v) => !v)}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>

          <form className="search-bar" role="search">
            <svg className="search-icon" width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input type="search" placeholder="Поиск товаров, брендов и категорий..." />
            <button type="submit">Найти</button>
          </form>

          <div className="header-actions">
            <a href="#" className="header-action-btn" title="Избранное">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              <span>Избранное</span>
            </a>
            <button className="header-action-btn lang-switch" onClick={() => setLang(lang === "ru" ? "uz" : "ru")} title="Сменить язык">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>
              <span>{lang === "ru" ? "Рус" : "Uzb"}</span>
            </button>
            <a href="#" className="header-action-btn" title="Профиль">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>Войти</span>
            </a>
            <Link href="/cart" className="header-action-btn cart-action" title="Корзина">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
              <span>Корзина</span>
              <i className="cart-badge">{cartCount}</i>
            </Link>
          </div>
        </div>
      </header>

      {/* ===== CATALOG DROPDOWN ===== */}
      <div className={`catalog-dropdown${dropdownOpen ? " open" : ""}`}>
        <div className="container catalog-dropdown-inner">
          <div className="catalog-col">
            <h4>📱 Смартфоны и гаджеты</h4>
            <a href="#">Смартфоны</a>
            <a href="#">Умные часы</a>
            <a href="#">Фитнес-браслеты</a>
            <a href="#">Аксессуары</a>
          </div>
          <div className="catalog-col">
            <h4>💻 Ноутбуки и ПК</h4>
            <a href="#">Ноутбуки</a>
            <a href="#">Мониторы</a>
            <a href="#">Комплектующие</a>
            <a href="#">Периферия</a>
          </div>
          <div className="catalog-col">
            <h4>📺 ТВ и аудио</h4>
            <a href="#">Телевизоры</a>
            <a href="#">Саундбары</a>
            <a href="#">Наушники</a>
            <a href="#">Колонки</a>
          </div>
          <div className="catalog-col">
            <h4>🏠 Для дома</h4>
            <a href="#">Пылесосы</a>
            <a href="#">Климат</a>
            <a href="#">Кухонная техника</a>
            <a href="#">Красота и здоровье</a>
          </div>
        </div>
      </div>

      {/* ===== PAGE CONTENT ===== */}
      {children}

      {/* ===== FOOTER ===== */}
      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-about">
            <div className="footer-logo">
              <img className="logo-img" src="/emirate-logo.svg" alt="Emirate Co" width="160" height="56" />
            </div>
            <p>Интернет-магазин электроники, бытовой техники и товаров для дома с доставкой по Узбекистану.</p>
            <div className="footer-socials">
              <a href="#" title="Telegram"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6.54l-1.37 6.49c-.1.46-.37.57-.74.35l-2.05-1.51-1 .96c-.1.1-.2.2-.4.2l.15-2.08 3.82-3.45c.17-.15-.04-.23-.26-.09l-4.72 2.97-2.04-.63c-.44-.14-.45-.44.09-.66l7.98-3.08c.37-.14.69.09.54.53z"/></svg></a>
              <a href="#" title="Instagram"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85 0 3.2-.01 3.58-.07 4.85-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07-3.2 0-3.58-.01-4.85-.07-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85 0-3.2.01-3.58.07-4.85C2.38 3.86 3.9 2.31 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.7.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg></a>
              <a href="#" title="Facebook"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07c0 6.03 4.39 11.02 10.13 11.93v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.33l-.53 3.49h-2.8v8.44C19.61 23.09 24 18.1 24 12.07z"/></svg></a>
              <a href="#" title="YouTube"><svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 00.5 6.19 31.56 31.56 0 000 12a31.56 31.56 0 00.5 5.81 3.02 3.02 0 002.12 2.14c1.87.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 002.12-2.14A31.56 31.56 0 0024 12a31.56 31.56 0 00-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg></a>
            </div>
          </div>
          <div className="footer-col">
            <h4>Покупателям</h4>
            <a href="#">Доставка</a><a href="#">Оплата</a><a href="#">Рассрочка</a><a href="#">Гарантия и возврат</a><a href="#">FAQ</a>
          </div>
          <div className="footer-col">
            <h4>Компания</h4>
            <a href="#">О нас</a><a href="#">Контакты</a><a href="#">Вакансии</a><a href="#">Публичная оферта</a><a href="#">Политика конфиденциальности</a>
          </div>
          <div className="footer-col">
            <h4>Контакты</h4>
            <a href="tel:+998712000000">+998 71 200-00-00</a>
            <a href="mailto:info@emirateco.uz">info@emirateco.uz</a>
            <p className="footer-address">Ташкент, ул. Мустакиллик, 1</p>
            <p className="footer-schedule">Пн–Вс: 09:00–21:00</p>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container footer-bottom-inner">
            <p>© 2026 Emirate Co. Все права защищены.</p>
            <div className="payment-icons"><span>Payme</span><span>Click</span><span>Uzum</span><span>Visa</span><span>Mastercard</span></div>
          </div>
        </div>
      </footer>

      {/* ===== MOBILE NAVIGATION ===== */}
      <nav className="mobile-nav">
        <Link href="/" className={`mobile-nav-item${pathname === "/" ? " active" : ""}`}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          <span>Главная</span>
        </Link>
        <Link href="/catalog" className={`mobile-nav-item${pathname.startsWith("/catalog") ? " active" : ""}`}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          <span>Каталог</span>
        </Link>
        <a href="#" className="mobile-nav-item">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          <span>Избранное</span>
        </a>
        <Link href="/cart" className={`mobile-nav-item${pathname === "/cart" ? " active" : ""}`}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
          <span>Корзина</span>
        </Link>
        <a href="#" className="mobile-nav-item">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Профиль</span>
        </a>
      </nav>

      {/* ===== SCROLL TO TOP ===== */}
      <button className={`scroll-top${showTop ? " visible" : ""}`} onClick={goTop} title="Наверх">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>
      </button>
    </>
  );
}
