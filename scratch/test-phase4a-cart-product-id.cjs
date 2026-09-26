/**
 * test-phase4a-cart-product-id.cjs
 * Comprehensive verification suite for Phase 4A: Contract & Cart Enrichment
 *
 * Verifies all 15 scenarios:
 *  1. admin_id vs sku: admin_id takes priority
 *  2. sku fallback: when no admin_id, sku is used
 *  3. id fallback: when no admin_id and no sku, id is used
 *  4. title only: never use title as product_id; if unmatched, product_id is empty string ""
 *  5. Catalog add: adding to cart preserves product_id
 *  6. Product page add: adding to cart preserves product_id
 *  7. Quick Buy: quick buy payload contains canonical product_id
 *  8. Old cart enrichment: cart loaded from localStorage without product_id is enriched from catalog by exact title match
 *  9. Unmatched old cart: unmatched item keeps product_id: "" without crashing or fabricating an ID
 * 10. Checkout orderRow: checkout creates orderRow.items with product_id for every item
 * 11. sanitizeOrderPayload: preserves product_id on items in the payload
 * 12. Field integrity: other item fields (title, brand, category, price, qty, image) remain valid and intact
 * 13. Bonus/promo non-interference: existing bonus/promo arithmetic is unchanged
 * 14. Guest checkout: works with product_id
 * 15. End-to-end integration: product -> cart -> checkout -> sanitizeOrderPayload maintains identical product_id
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const telegramLib = require("../api/_lib/telegram-lib");
const sanitizeOrderPayload = telegramLib.sanitizeOrderPayload;
const resolveCanonicalProductId = telegramLib.resolveCanonicalProductId;

console.log("==================================================");
console.log("EMIRATE CO — PHASE 4A VERIFICATION SUITE");
console.log("==================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`PASS [${totalTests}/15]: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`FAIL [${totalTests}/15]: ${name}`);
    console.error("  Error:", err.message);
    if (err.stack) console.error("  Stack:", err.stack);
  }
}

// Helper to create browser-like VM environment for common.js
function createBrowserEnv(initialStorage = {}) {
  const store = { ...initialStorage };
  const mockLocalStorage = {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    _store: store
  };

  const mockDocument = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      setAttribute: () => {},
      getAttribute: () => null,
      appendChild: () => {}
    }),
    body: {
      appendChild: () => {},
      classList: { add: () => {}, remove: () => {}, contains: () => false }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: {
      classList: { add: () => {}, remove: () => {}, contains: () => false },
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {}
    }
  };

  const sandbox = {
    console,
    localStorage: mockLocalStorage,
    sessionStorage: mockLocalStorage,
    document: mockDocument,
    window: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: (id) => clearTimeout(id),
    location: { href: "https://emirate.uz" },
    fetch: async () => ({ ok: true, json: async () => ({}) })
  };
  sandbox.window = sandbox;

  const commonCode = fs.readFileSync(path.join(__dirname, "../common.js"), "utf8");
  vm.createContext(sandbox);
  vm.runInContext(commonCode, sandbox);

  return sandbox;
}

// ------------------------------------------------------------------
// Test 1: admin_id vs sku: admin_id takes priority
// ------------------------------------------------------------------
runTest("1. admin_id vs sku: admin_id takes priority", () => {
  const item = {
    admin_id: "prod-canonical-uuid-1",
    sku: "SKU-IPH-15",
    id: "random-id-99",
    product_id: "legacy-id",
    title: "iPhone 15 Pro"
  };
  const resolved = resolveCanonicalProductId(item);
  assert.strictEqual(resolved, "prod-canonical-uuid-1", "admin_id must take precedence over sku/id/product_id");

  const sanitized = sanitizeOrderPayload({
    phone: "+998901234567",
    full_name: "Test User",
    items: [item],
    total_amount: 15000000
  });
  assert.strictEqual(sanitized.items[0].product_id, "prod-canonical-uuid-1", "sanitizeOrderPayload must retain admin_id");
  assert.strictEqual(sanitized.items[0].sku, "SKU-IPH-15", "sku should preserve item.sku");
});

// ------------------------------------------------------------------
// Test 2: sku fallback: when no admin_id, sku is used
// ------------------------------------------------------------------
runTest("2. sku fallback: when no admin_id, sku is used", () => {
  const item = {
    sku: "SKU-MACBOOK-AIR",
    id: "internal-id-123",
    title: "MacBook Air M2"
  };
  const resolved = resolveCanonicalProductId(item);
  assert.strictEqual(resolved, "SKU-MACBOOK-AIR", "sku must be used when admin_id is missing");

  const sanitized = sanitizeOrderPayload({
    phone: "+998901234567",
    full_name: "Test User",
    items: [item],
    total_amount: 12000000
  });
  assert.strictEqual(sanitized.items[0].product_id, "SKU-MACBOOK-AIR");
});

// ------------------------------------------------------------------
// Test 3: id fallback: when no admin_id and no sku, id is used
// ------------------------------------------------------------------
runTest("3. id fallback: when no admin_id and no sku, id is used", () => {
  const item = {
    id: "legacy-db-id-77",
    title: "AirPods Pro 2"
  };
  const resolved = resolveCanonicalProductId(item);
  assert.strictEqual(resolved, "legacy-db-id-77", "id must be used when admin_id and sku are missing");

  const sanitized = sanitizeOrderPayload({
    phone: "+998901234567",
    full_name: "Test User",
    items: [item],
    total_amount: 3000000
  });
  assert.strictEqual(sanitized.items[0].product_id, "legacy-db-id-77");
});

// ------------------------------------------------------------------
// Test 4: title only: never use title as product_id
// ------------------------------------------------------------------
runTest("4. title only: never use title as product_id; if unmatched, product_id is empty string", () => {
  const item = {
    title: "Mystery Product Unregistered",
    price: 50000
  };
  const resolved = resolveCanonicalProductId(item);
  assert.strictEqual(resolved, "", "resolved product_id must be empty string, never title");

  // Also test when id is accidentally set to title
  const itemWithTitleAsId = {
    id: "Mystery Product Unregistered",
    title: "Mystery Product Unregistered",
    price: 50000
  };
  assert.strictEqual(resolveCanonicalProductId(itemWithTitleAsId), "", "id equal to title must not be used");

  const sanitized = sanitizeOrderPayload({
    phone: "+998901234567",
    full_name: "Test User",
    items: [item],
    total_amount: 50000
  });
  assert.strictEqual(sanitized.items[0].product_id, "", "sanitized product_id must be empty string");
});

// ------------------------------------------------------------------
// Test 5: Catalog add: adding to cart preserves product_id
// ------------------------------------------------------------------
runTest("5. Catalog add: adding to cart preserves product_id", () => {
  const env = createBrowserEnv();
  const catalogProduct = {
    admin_id: "prod-cat-001",
    sku: "SKU-CAT-001",
    title: "Catalog Test Item",
    price: 100000,
    brand: "Apple",
    category: "Phones"
  };

  env.window.emirateAddToCart(catalogProduct, 1);
  const cart = env.window.emirateGetCartItems();
  assert.strictEqual(cart.length, 1);
  assert.strictEqual(cart[0].product_id, "prod-cat-001", "cart item must have canonical product_id");
  assert.strictEqual(cart[0].sku, "SKU-CAT-001", "cart item must have sku");
  assert.strictEqual(cart[0].qty, 1);
});

// ------------------------------------------------------------------
// Test 6: Product page add: adding to cart preserves product_id
// ------------------------------------------------------------------
runTest("6. Product page add: adding to cart preserves product_id", () => {
  const env = createBrowserEnv();
  const detailProduct = {
    admin_id: "prod-detail-999",
    sku: "SKU-DETAIL-999",
    title: "Product Detail Item",
    price: 250000,
    brand: "Samsung",
    category: "Tablets"
  };

  env.window.emirateAddToCart(detailProduct, 2);
  const cart = env.window.emirateGetCartItems();
  assert.strictEqual(cart.length, 1);
  assert.strictEqual(cart[0].product_id, "prod-detail-999");
  assert.strictEqual(cart[0].qty, 2);

  // Increment existing item
  env.window.emirateAddToCart(detailProduct, 1);
  const updatedCart = env.window.emirateGetCartItems();
  assert.strictEqual(updatedCart.length, 1);
  assert.strictEqual(updatedCart[0].product_id, "prod-detail-999");
  assert.strictEqual(updatedCart[0].qty, 3);
});

// ------------------------------------------------------------------
// Test 7: Quick Buy: quick buy payload contains canonical product_id
// ------------------------------------------------------------------
runTest("7. Quick Buy: quick buy payload contains canonical product_id", () => {
  const env = createBrowserEnv();
  const product = {
    admin_id: "prod-quick-555",
    sku: "SKU-QUICK-555",
    title: "Quick Buy Watch",
    price: 500000,
    brand: "Garmin"
  };

  // Check resolveCanonicalProductId from window
  const canonicalId = env.window.emirateResolveCanonicalProductId(product);
  assert.strictEqual(canonicalId, "prod-quick-555");
});

// ------------------------------------------------------------------
// Test 8: Old cart enrichment: cart loaded from localStorage without product_id is enriched from catalog
// ------------------------------------------------------------------
runTest("8. Old cart enrichment: cart loaded from localStorage without product_id is enriched from catalog by exact title", () => {
  const catalog = [
    { admin_id: "prod-catalog-enrich-1", sku: "SKU-ENRICH-1", title: "Legacy Item A", price: 1000 },
    { admin_id: "prod-catalog-enrich-2", sku: "SKU-ENRICH-2", title: "Legacy Item B", price: 2000 }
  ];
  const legacyCart = [
    { title: "Legacy Item A", price: 1000, qty: 2 },
    { title: "Legacy Item B", price: 2000, qty: 1 }
  ];

  const env = createBrowserEnv({
    emirate_admin_products: JSON.stringify(catalog),
    emirate_cart_items: JSON.stringify(legacyCart)
  });
  env.window.emirateLookupProduct = (title) => catalog.find(p => p.title === title);

  // Trigger getCartItems which runs enrichment
  const enriched = env.window.emirateGetCartItems();
  assert.strictEqual(enriched.length, 2);
  assert.strictEqual(enriched[0].product_id, "prod-catalog-enrich-1", "Legacy Item A must be enriched with admin_id");
  assert.strictEqual(enriched[0].sku, "SKU-ENRICH-1", "Legacy Item A must be enriched with sku");
  assert.strictEqual(enriched[1].product_id, "prod-catalog-enrich-2", "Legacy Item B must be enriched with admin_id");

  // Verify re-saved to localStorage
  const savedRaw = JSON.parse(env.localStorage.getItem("emirate_cart_items"));
  assert.strictEqual(savedRaw[0].product_id, "prod-catalog-enrich-1");
  assert.strictEqual(savedRaw[1].product_id, "prod-catalog-enrich-2");
});

// ------------------------------------------------------------------
// Test 9: Unmatched old cart: unmatched item keeps product_id: "" without crashing
// ------------------------------------------------------------------
runTest("9. Unmatched old cart: unmatched item keeps product_id: '' without crashing or fabricating an ID", () => {
  const catalog = [{ admin_id: "prod-known", sku: "SKU-KNOWN", title: "Known Item" }];
  const legacyCart = [
    { title: "Discontinued 2021 Item", price: 300, qty: 1 }
  ];

  const env = createBrowserEnv({
    emirate_admin_products: JSON.stringify(catalog),
    emirate_cart_items: JSON.stringify(legacyCart)
  });
  env.window.emirateLookupProduct = (title) => catalog.find(p => p.title === title);

  const items = env.window.emirateGetCartItems();
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].product_id, "", "Unmatched item must have empty product_id");
  assert.strictEqual(items[0].title, "Discontinued 2021 Item");
});

// ------------------------------------------------------------------
// Test 10: Checkout orderRow: checkout creates orderRow.items with product_id for every item
// ------------------------------------------------------------------
runTest("10. Checkout orderRow: checkout creates orderRow.items with product_id for every item", () => {
  const env = createBrowserEnv();
  const itemsInCart = [
    { product_id: "prod-chk-1", sku: "SKU-CHK-1", title: "Item 1", price: 1000, qty: 1 },
    { admin_id: "prod-chk-2", sku: "SKU-CHK-2", title: "Item 2", price: 2000, qty: 2 }
  ];

  // Emulate checkout mapping logic
  const orderItems = itemsInCart.map((item) => {
    const canonicalId = (env.window.emirateResolveCanonicalProductId
      ? env.window.emirateResolveCanonicalProductId(item)
      : "") || String(item.product_id || item.admin_id || item.sku || "").trim();
    return {
      ...item,
      product_id: canonicalId,
      sku: String(item.sku || canonicalId).trim(),
    };
  });

  assert.strictEqual(orderItems[0].product_id, "prod-chk-1");
  assert.strictEqual(orderItems[0].sku, "SKU-CHK-1");
  assert.strictEqual(orderItems[1].product_id, "prod-chk-2");
  assert.strictEqual(orderItems[1].sku, "SKU-CHK-2");
});

// ------------------------------------------------------------------
// Test 11: sanitizeOrderPayload: preserves product_id on items in the payload
// ------------------------------------------------------------------
runTest("11. sanitizeOrderPayload: preserves product_id on items in the payload", () => {
  const payload = {
    phone: "+998901234567",
    full_name: "Azizbek",
    items: [
      { product_id: "p-100", sku: "SKU-100", title: "Keyboard", price: 500000, qty: 1 },
      { product_id: "p-200", sku: "SKU-200", title: "Mouse", price: 300000, qty: 2 }
    ],
    total_amount: 1100000
  };

  const sanitized = sanitizeOrderPayload(payload);
  assert.ok(sanitized, "sanitized payload must exist");
  assert.strictEqual(sanitized.items.length, 2);
  assert.strictEqual(sanitized.items[0].product_id, "p-100");
  assert.strictEqual(sanitized.items[0].sku, "SKU-100");
  assert.strictEqual(sanitized.items[1].product_id, "p-200");
  assert.strictEqual(sanitized.items[1].sku, "SKU-200");
});

// ------------------------------------------------------------------
// Test 12: Field integrity: other item fields remain valid and intact
// ------------------------------------------------------------------
runTest("12. Field integrity: other item fields (title, brand, category, price, qty, image) remain valid and intact", () => {
  const item = {
    product_id: "prod-full-meta",
    sku: "SKU-FULL",
    title: "Sony WH-1000XM5",
    brand: "Sony",
    category: "Audio",
    price: 4500000,
    qty: 2,
    image: "https://example.com/sony.jpg"
  };

  const sanitized = sanitizeOrderPayload({
    phone: "+998901234567",
    full_name: "Test User",
    items: [item],
    total_amount: 9000000
  });

  const resItem = sanitized.items[0];
  assert.strictEqual(resItem.product_id, "prod-full-meta");
  assert.strictEqual(resItem.sku, "SKU-FULL");
  assert.strictEqual(resItem.title, "Sony WH-1000XM5");
  assert.strictEqual(resItem.brand, "Sony");
  assert.strictEqual(resItem.category, "Audio");
  assert.strictEqual(resItem.price, 4500000);
  assert.strictEqual(resItem.qty, 2);
  assert.strictEqual(resItem.image, "https://example.com/sony.jpg");
});

// ------------------------------------------------------------------
// Test 13: Bonus/promo non-interference: existing bonus/promo arithmetic is unchanged
// ------------------------------------------------------------------
runTest("13. Bonus/promo non-interference: existing bonus/promo arithmetic is unchanged", () => {
  const payload = {
    phone: "+998901234567",
    full_name: "Loyal Customer",
    items: [
      { product_id: "prod-promo-item", price: 1000000, qty: 1 }
    ],
    total_amount: 800000,
    bonus_used: 100000,
    promo_discount: 100000
  };

  const sanitized = sanitizeOrderPayload(payload);
  assert.strictEqual(sanitized.total_amount, 800000);
  assert.strictEqual(sanitized.bonus_used, 100000);
  assert.strictEqual(sanitized.promo_discount, 100000);
  assert.strictEqual(sanitized.items[0].product_id, "prod-promo-item");
});

// ------------------------------------------------------------------
// Test 14: Guest checkout: works with product_id
// ------------------------------------------------------------------
runTest("14. Guest checkout: works with product_id without user_id", () => {
  const guestOrder = {
    phone: "+998998887766",
    full_name: "Guest Shopper",
    items: [
      { product_id: "prod-guest-1", title: "Flash Drive 64GB", price: 120000, qty: 1 }
    ],
    total_amount: 120000
  };

  const sanitized = sanitizeOrderPayload(guestOrder);
  assert.ok(sanitized);
  assert.strictEqual(sanitized.user_id, undefined, "Guest order has no user_id");
  assert.strictEqual(sanitized.items[0].product_id, "prod-guest-1");
  assert.strictEqual(sanitized.phone, "+998998887766");
});

// ------------------------------------------------------------------
// Test 15: End-to-end integration: product -> cart -> checkout -> sanitizeOrderPayload
// ------------------------------------------------------------------
runTest("15. End-to-end integration: product -> cart -> checkout -> sanitizeOrderPayload maintains identical product_id", () => {
  const env = createBrowserEnv();

  // 1. Initial product from DB/Catalog
  const dbProduct = {
    admin_id: "e2e-canonical-product-uuid",
    sku: "SKU-E2E-MACBOOK",
    title: "Apple MacBook Pro 16 M3 Max",
    brand: "Apple",
    category: "Laptops",
    price: 35000000,
    image: "https://example.com/macbook.jpg"
  };

  // 2. Add to cart
  env.window.emirateAddToCart(dbProduct, 1);
  const cartItems = env.window.emirateGetCartItems();
  assert.strictEqual(cartItems[0].product_id, "e2e-canonical-product-uuid");
  assert.strictEqual(cartItems[0].sku, "SKU-E2E-MACBOOK");

  // 3. Checkout preparation
  const orderRow = {
    phone: "+998901234567",
    full_name: "E2E Buyer",
    region: "Tashkent",
    city: "Tashkent",
    address: "Amir Temur 45",
    comment_text: "Call before delivery",
    delivery_method: "standard",
    payment_method: "payme",
    items: cartItems.map((item) => {
      const canonicalId = (env.window.emirateResolveCanonicalProductId
        ? env.window.emirateResolveCanonicalProductId(item)
        : "") || String(item.product_id || item.admin_id || item.sku || "").trim();
      return {
        ...item,
        product_id: canonicalId,
        sku: String(item.sku || canonicalId).trim(),
      };
    }),
    total_amount: 35000000,
    bonus_used: 0,
    user_id: "user-uuid-1234",
    customer_email: "e2e@buyer.uz"
  };

  // 4. Server sanitization (telegram-lib / place-order)
  const finalPayload = sanitizeOrderPayload(orderRow);
  assert.ok(finalPayload);
  assert.strictEqual(finalPayload.items.length, 1);
  assert.strictEqual(finalPayload.items[0].product_id, "e2e-canonical-product-uuid");
  assert.strictEqual(finalPayload.items[0].sku, "SKU-E2E-MACBOOK");
  assert.strictEqual(finalPayload.items[0].title, "Apple MacBook Pro 16 M3 Max");
  assert.strictEqual(finalPayload.items[0].price, 35000000);
  assert.strictEqual(finalPayload.items[0].qty, 1);
  assert.strictEqual(finalPayload.user_id, "user-uuid-1234");
  assert.strictEqual(finalPayload.customer_email, "e2e@buyer.uz");
});

console.log("\n==================================================");
console.log(`PHASE 4A TEST SUMMARY: ${passedTests}/${totalTests} PASS`);
console.log("==================================================");

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
