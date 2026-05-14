"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { products } from "@/lib/products";

const categories = ["Смартфоны", "Ноутбуки", "ТВ", "Аудио", "Техника"] as const;
const brands = ["Apple", "Samsung", "Xiaomi", "Sony", "LG", "ASUS"] as const;

export default function CatalogPage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("popular");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (selectedCategories.length && !selectedCategories.includes(p.category)) return false;
      if (selectedBrands.length && !selectedBrands.includes(p.brand)) return false;
      if (minPrice && p.price < Number(minPrice)) return false;
      if (maxPrice && p.price > Number(maxPrice)) return false;
      if (selectedRatings.length) {
        const minRating = Math.min(...selectedRatings.map(Number));
        if (p.rating < minRating) return false;
      }
      return true;
    });
    if (sort === "price_asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price_desc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "rating_desc") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [selectedCategories, selectedBrands, selectedRatings, minPrice, maxPrice, sort]);

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) =>
    set(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

  const resetFilters = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedRatings([]);
    setMinPrice("");
    setMaxPrice("");
    setSort("popular");
  };

  return (
    <main className="container catalog-page">

      {/* Breadcrumbs */}
      <nav className="breadcrumbs">
        <Link href="/">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
          Главная
        </Link>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        <span>Каталог</span>
      </nav>

      {/* Title */}
      <section className="catalog-head">
        <h1>Каталог товаров</h1>
        <p>Найдено <strong>{filtered.length}</strong> товаров</p>
      </section>

      {/* Layout */}
      <section className="catalog-layout">

        {/* ── Filters Sidebar ── */}
        <aside className="filters-card">
          <div className="filters-header">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            <h3>Фильтры</h3>
          </div>

          {/* Category */}
          <div className="filter-group">
            <p className="filter-title">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              Категория
            </p>
            {categories.map((cat) => (
              <label className="filter-label" key={cat}>
                <input type="checkbox" checked={selectedCategories.includes(cat)} onChange={() => toggle(selectedCategories, cat, setSelectedCategories)} />
                <span>{cat === "ТВ" ? "Телевизоры" : cat}</span>
              </label>
            ))}
          </div>

          {/* Price */}
          <div className="filter-group">
            <p className="filter-title">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              Цена (сум)
            </p>
            <div className="price-inputs">
              <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} type="number" placeholder="От 0" />
              <span className="price-dash">—</span>
              <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" placeholder="До 50 000 000" />
            </div>
          </div>

          {/* Brand */}
          <div className="filter-group">
            <p className="filter-title">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              Бренд
            </p>
            {brands.map((brand) => (
              <label className="filter-label" key={brand}>
                <input type="checkbox" checked={selectedBrands.includes(brand)} onChange={() => toggle(selectedBrands, brand, setSelectedBrands)} />
                <span>{brand}</span>
              </label>
            ))}
          </div>

          {/* Rating */}
          <div className="filter-group">
            <p className="filter-title">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Рейтинг
            </p>
            {["4.5", "4.0"].map((r) => (
              <label className="filter-label" key={r}>
                <input type="checkbox" checked={selectedRatings.includes(r)} onChange={() => toggle(selectedRatings, r, setSelectedRatings)} />
                <span>★ {r} и выше</span>
              </label>
            ))}
          </div>

          {/* Actions */}
          <div className="filter-actions">
            <button className="btn-primary filter-apply-btn" type="button">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Применить
            </button>
            <button className="btn-filter-reset" type="button" onClick={resetFilters}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
              Сбросить
            </button>
          </div>
        </aside>

        {/* ── Catalog Content ── */}
        <div className="catalog-content">
          {/* Toolbar */}
          <div className="catalog-toolbar">
            <div className="toolbar-left">
              <label className="sort-label">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 5h10M11 9h7M11 13h4M3 17l4 4 4-4M7 3v18"/></svg>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="popular">По популярности</option>
                  <option value="price_asc">Сначала дешевле</option>
                  <option value="price_desc">Сначала дороже</option>
                  <option value="rating_desc">По рейтингу</option>
                </select>
              </label>
            </div>
            <div className="toolbar-right">
              <button className={`view-btn${view === "grid" ? " active" : ""}`} type="button" title="Сетка" onClick={() => setView("grid")}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
              <button className={`view-btn${view === "list" ? " active" : ""}`} type="button" title="Список" onClick={() => setView("list")}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Products Grid */}
          <div className="products-grid catalog-products-grid">
            {filtered.length ? (
              filtered.map((p) => <ProductCard key={p.slug} product={p} />)
            ) : (
              <div className="catalog-empty">
                <svg width="48" height="48" fill="none" stroke="#94a3b8" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/></svg>
                <p>Товары не найдены</p>
                <span>Попробуйте изменить фильтры</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
