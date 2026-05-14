export type Product = {
  slug: string;
  title: string;
  brand: string;
  category: "Смартфоны" | "Ноутбуки" | "ТВ" | "Аудио" | "Техника";
  price: number;
  oldPrice: number;
  rating: number;
  reviews: number;
  badge: "hit" | "sale" | "new";
};

export const products: Product[] = [
  { slug: "iphone-15-pro-max-256", title: "iPhone 15 Pro Max 256GB", brand: "Apple", category: "Смартфоны", price: 15490000, oldPrice: 16900000, rating: 4.9, reviews: 342, badge: "hit" },
  { slug: "samsung-s24-ultra-256", title: "Samsung Galaxy S24 Ultra 12/256", brand: "Samsung", category: "Смартфоны", price: 14200000, oldPrice: 15500000, rating: 4.8, reviews: 218, badge: "hit" },
  { slug: "xiaomi-14-ultra-512", title: "Xiaomi 14 Ultra 16/512", brand: "Xiaomi", category: "Смартфоны", price: 11800000, oldPrice: 12900000, rating: 4.7, reviews: 94, badge: "sale" },
  { slug: "macbook-air-m3-15", title: "MacBook Air M3 15\" 16/512", brand: "Apple", category: "Ноутбуки", price: 17900000, oldPrice: 19200000, rating: 4.9, reviews: 156, badge: "hit" },
  { slug: "asus-zenbook-14-oled", title: "ASUS Zenbook 14 OLED UX3405", brand: "ASUS", category: "Ноутбуки", price: 12900000, oldPrice: 13700000, rating: 4.7, reviews: 67, badge: "sale" },
  { slug: "lg-oled55c4-4k-tv", title: "LG OLED55C4 55\" 4K Smart TV", brand: "LG", category: "ТВ", price: 12400000, oldPrice: 13900000, rating: 4.8, reviews: 73, badge: "hit" },
  { slug: "sony-wh1000xm5", title: "Sony WH-1000XM5 Wireless", brand: "Sony", category: "Аудио", price: 4250000, oldPrice: 4990000, rating: 4.8, reviews: 421, badge: "hit" },
  { slug: "dyson-v15-detect", title: "Dyson V15 Detect Absolute", brand: "Dyson", category: "Техника", price: 8350000, oldPrice: 9500000, rating: 4.8, reviews: 195, badge: "sale" },
];

export function formatMoney(value: number): string {
  return `${value.toLocaleString("ru-RU")} сум`;
}

export function monthlyFrom(price: number): string {
  return formatMoney(Math.round(price / 12));
}
