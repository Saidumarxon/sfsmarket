import type { Product } from "./products";

/* ── Types ── */
export type CartItem = {
  slug: string;
  title: string;
  brand: string;
  price: number;
  oldPrice: number;
  qty: number;
};

/* ── External store (SSR-safe via useSyncExternalStore) ── */
const STORAGE_KEY = "emirate_cart";
let listeners: Array<() => void> = [];

/* Cached snapshots — React requires referential stability from getSnapshot */
let _cachedItems: CartItem[] = [];
let _cachedCount: number = 0;
let _cachedRaw: string = "[]";

function emit() {
  /* refresh cache before notifying React */
  refreshCache();
  listeners.forEach((l) => l());
}

function refreshCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "[]";
    if (raw !== _cachedRaw) {
      _cachedRaw = raw;
      _cachedItems = JSON.parse(raw) as CartItem[];
      _cachedCount = _cachedItems.reduce((s, i) => s + i.qty, 0);
    }
  } catch {
    _cachedItems = [];
    _cachedCount = 0;
    _cachedRaw = "[]";
  }
}

function readCart(): CartItem[] {
  refreshCache();
  return _cachedItems;
}

function writeCart(items: CartItem[]) {
  const json = JSON.stringify(items);
  localStorage.setItem(STORAGE_KEY, json);
  localStorage.setItem("emirate_cart_count", String(items.reduce((s, i) => s + i.qty, 0)));
  _cachedRaw = json;
  _cachedItems = items;
  _cachedCount = items.reduce((s, i) => s + i.qty, 0);
  listeners.forEach((l) => l());
}

/* ── Public API ── */
export function addToCart(product: Product, qty = 1) {
  const items = [...readCart()];
  const existing = items.find((i) => i.slug === product.slug);
  if (existing) {
    existing.qty += qty;
  } else {
    items.push({
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      price: product.price,
      oldPrice: product.oldPrice,
      qty,
    });
  }
  writeCart(items);
}

export function removeFromCart(slug: string) {
  writeCart(readCart().filter((i) => i.slug !== slug));
}

export function updateQty(slug: string, qty: number) {
  const items = [...readCart()];
  const item = items.find((i) => i.slug === slug);
  if (item) {
    item.qty = Math.max(1, Math.min(99, qty));
  }
  writeCart(items);
}

export function clearCart() {
  writeCart([]);
}

/* ── useSyncExternalStore helpers ── */
export function subscribeCart(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function getCartItemsSnapshot(): CartItem[] {
  refreshCache();
  return _cachedItems;          // same reference until data changes
}

const EMPTY_ITEMS: CartItem[] = [];
export function getCartItemsServerSnapshot(): CartItem[] {
  return EMPTY_ITEMS;           // stable reference for SSR
}

export function getCartCountSnapshot(): number {
  refreshCache();
  return _cachedCount;
}

export function getCartCountServerSnapshot(): number {
  return 0;
}
