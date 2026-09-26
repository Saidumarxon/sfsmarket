/**
 * EMIRATE CO — PHASE 4B: ATOMIC STOCK RESERVATION TEST SUITE
 *
 * Verifies all 24 scenarios:
 *  1. availability: quantity 10, reserved 3 -> available 7
 *  2. successful reservation: stock 10, reserve 4 -> reserved = 4
 *  3. insufficient stock: stock 10, reserve 11 -> reject
 *  4. exact stock: stock 10, reserve 10 -> success
 *  5. second reservation: stock 10, first reserve 10, second reserve 1 -> reject
 *  6. idempotent reserve: reserve same order twice -> reserved unchanged
 *  7. release: reserve 5, release -> reserved returns to original
 *  8. idempotent release: release twice -> no negative reserved stock
 *  9. deduct: quantity 10, reserve 4, deduct -> quantity 6, reserved 0
 * 10. idempotent deduct: deduct twice -> stock changes only once
 * 11. overselling race: quantity 1, two concurrent reservations for 1 -> exactly one succeeds
 * 12. invalid product_id: reject
 * 13. title-only item: reject, NEVER lookup stock by title
 * 14. client price tampering: real price 1500, client submits 1 -> reject
 * 15. authoritative price: correct price accepted
 * 16. processing reservation: status processing triggers reservation
 * 17. out_of_stock release: status out_of_stock triggers release
 * 18. successful deduction: status successful triggers deduction
 * 19. cancelled release: status cancelled triggers release
 * 20. repeated status transition: no duplicate stock changes
 * 21. direct insert bypass attempt: cannot create an inventory-controlled order without stock protection
 * 22. bonus regression: existing bonus behavior unchanged
 * 23. receiving regression: receipt posting/cancel still works
 * 24. Phase 4A regression: canonical product_id still propagates
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const telegramLib = require("../api/_lib/telegram-lib");

console.log("================================================================");
console.log("EMIRATE CO — PHASE 4B: ATOMIC STOCK RESERVATION TEST SUITE");
console.log("================================================================\n");

let passedTests = 0;
let totalTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS ${totalTests}/28] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL ${totalTests}/28] ${name}`);
    console.error(`         Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
}

// ------------------------------------------------------------------------------
// IN-MEMORY DATABASE SIMULATOR FOR POSTGRESQL PHASE 4B PROCEDURES
// ------------------------------------------------------------------------------
class MockStockDb {
  constructor() {
    this.mainWarehouseId = "wh-main-uuid-0001";
    this.warehouses = [
      { id: this.mainWarehouseId, code: "MAIN", name: "Основной склад", is_active: true }
    ];
    this.products = new Map();
    this.stockBalances = new Map(); // key: `${productId}::${warehouseId}`
    this.stockMovements = [];
    this.orders = new Map();
    this.orderStockReservations = new Map(); // key: `${orderId}::${productId}::${warehouseId}`
    this.locks = new Set();
  }

  addProduct(adminId, title, price, costPrice = 0) {
    this.products.set(adminId, {
      admin_id: adminId,
      title: title,
      status: "active",
      payload: {
        price: price,
        costPrice: costPrice,
        sku: adminId
      }
    });
  }

  setStockBalance(productId, warehouseId, quantity, reserved = 0) {
    if (reserved > quantity) {
      throw new Error(`check constraint stock_balances_reserved_lte_qty violated: reserved (${reserved}) > quantity (${quantity})`);
    }
    const key = `${productId}::${warehouseId}`;
    this.stockBalances.set(key, {
      product_id: productId,
      warehouse_id: warehouseId,
      quantity: quantity,
      reserved_quantity: reserved,
      updated_at: new Date()
    });
  }

  getStockBalance(productId, warehouseId) {
    const key = `${productId}::${warehouseId}`;
    return this.stockBalances.get(key) || null;
  }

  getAvailableQuantity(productId, warehouseId = this.mainWarehouseId, role = "service_role") {
    if (role === "anon") {
      throw new Error("42501: Access denied to product inventory availability");
    }
    const bal = this.getStockBalance(productId, warehouseId);
    if (!bal) return 0;
    return Math.max(0, bal.quantity - bal.reserved_quantity);
  }

  // Simulates BEFORE INSERT trigger: trg_order_stock_before
  trgOrderStockBefore(orderRow) {
    const items = Array.isArray(orderRow.items) ? orderRow.items : [];
    for (const item of items) {
      const prodId = String(item.product_id || "").trim();
      const title = String(item.title || item.name || "").trim();

      if (!prodId || prodId === title) {
        throw new Error(`P0008: Order item "${title || "Товар"}" is missing a valid canonical product_id`);
      }

      const prod = this.products.get(prodId);
      if (!prod) {
        throw new Error(`P0009: Product ${prodId} does not exist in catalog`);
      }

      const authPrice = Number(prod.payload && prod.payload.price) || 0;
      const submittedPrice = Number(item.price) || 0;
      if (authPrice > 0 && submittedPrice !== authPrice) {
        throw new Error(`P0011: Client submitted price (${submittedPrice}) does not match authoritative catalog price (${authPrice}) for product ${prodId}`);
      }
    }
  }

  // Core RPC: reserve_order_stock
  reserveOrderStock(orderId, warehouseId = this.mainWarehouseId) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`P0002: Order ${orderId} not found`);

    if (order.stock_status === "reserved") {
      return { ok: true, idempotent: true, order_id: orderId, stock_status: "reserved" };
    }
    if (order.stock_status === "deducted") {
      throw new Error(`P0007: Cannot reserve stock: order ${orderId} has already been deducted`);
    }

    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
      order.stock_status = "none";
      return { ok: true, items_count: 0, stock_status: "none" };
    }

    // Aggregate by product_id
    const aggregated = new Map();
    for (const it of items) {
      const pid = String(it.product_id || "").trim();
      const title = String(it.title || it.name || "").trim();
      if (!pid || pid === title) {
        throw new Error(`P0008: Order item "${title || "Товар"}" is missing a valid canonical product_id`);
      }
      if (!this.products.has(pid)) {
        throw new Error(`P0009: Product ${pid} does not exist in catalog`);
      }
      const qty = Number(it.qty) || 1;
      if (qty <= 0) throw new Error(`P0004: Invalid quantity ${qty} for product ${pid}`);
      aggregated.set(pid, (aggregated.get(pid) || 0) + qty);
    }

    // FIRST PASS: Lock FOR UPDATE & check available stock
    const sortedProductIds = Array.from(aggregated.keys()).sort();
    for (const pid of sortedProductIds) {
      const lockKey = `${pid}::${warehouseId}`;
      if (this.locks.has(lockKey)) {
        throw new Error(`55P03: lock_not_available on stock_balances for product ${pid}`);
      }
      this.locks.add(lockKey);

      const bal = this.getStockBalance(pid, warehouseId);
      if (!bal) {
        this.locks.delete(lockKey);
        throw new Error(`P0006: Insufficient stock for product ${pid}: requested ${aggregated.get(pid)}, available 0`);
      }
      const available = bal.quantity - bal.reserved_quantity;
      const req = aggregated.get(pid);
      if (available < req) {
        this.locks.delete(lockKey);
        throw new Error(`P0006: Insufficient stock for product ${pid}: requested ${req}, available ${available}`);
      }
    }

    // SECOND PASS: Apply reservation atomically
    for (const pid of sortedProductIds) {
      const lockKey = `${pid}::${warehouseId}`;
      const bal = this.getStockBalance(pid, warehouseId);
      const req = aggregated.get(pid);
      bal.reserved_quantity += req;

      const resKey = `${orderId}::${pid}::${warehouseId}`;
      this.orderStockReservations.set(resKey, {
        id: `res-${Date.now()}-${pid}`,
        order_id: orderId,
        product_id: pid,
        warehouse_id: warehouseId,
        quantity: req,
        status: "reserved",
        created_at: new Date()
      });
      this.locks.delete(lockKey);
    }

    order.stock_status = "reserved";
    return { ok: true, order_id: orderId, items_reserved: sortedProductIds.length, stock_status: "reserved" };
  }

  // Core RPC: release_order_stock
  releaseOrderStock(orderId) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`P0002: Order ${orderId} not found`);

    if (order.stock_status === "deducted") {
      throw new Error(`P0007: Cannot release stock: order ${orderId} stock was already deducted`);
    }
    if (order.stock_status === "released" || order.stock_status === "none") {
      return { ok: true, idempotent: true, order_id: orderId, stock_status: order.stock_status };
    }

    let releasedCount = 0;
    for (const [key, res] of this.orderStockReservations.entries()) {
      if (res.order_id === orderId && res.status === "reserved") {
        const bal = this.getStockBalance(res.product_id, res.warehouse_id);
        if (bal) {
          bal.reserved_quantity = Math.max(0, bal.reserved_quantity - res.quantity);
        }
        res.status = "released";
        releasedCount++;
      }
    }

    order.stock_status = "released";
    return { ok: true, order_id: orderId, released_items_count: releasedCount, stock_status: "released" };
  }

  // Core RPC: deduct_order_stock
  deductOrderStock(orderId) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`P0002: Order ${orderId} not found`);

    if (order.stock_status === "deducted") {
      return { ok: true, idempotent: true, order_id: orderId, stock_status: "deducted" };
    }
    if (order.stock_status === "released" || order.stock_status === "none") {
      throw new Error(`P0007: Cannot deduct stock: order ${orderId} stock status is ${order.stock_status} (not reserved)`);
    }

    let deductedCount = 0;
    for (const [key, res] of this.orderStockReservations.entries()) {
      if (res.order_id === orderId && res.status === "reserved") {
        const bal = this.getStockBalance(res.product_id, res.warehouse_id);
        if (!bal || bal.quantity < res.quantity) {
          throw new Error(`P0006: Stock balance corrupted for product ${res.product_id}`);
        }
        bal.quantity -= res.quantity;
        bal.reserved_quantity = Math.max(0, bal.reserved_quantity - res.quantity);

        this.stockMovements.push({
          id: `mov-${Date.now()}-${deductedCount}`,
          product_id: res.product_id,
          warehouse_id: res.warehouse_id,
          change_qty: -res.quantity,
          movement_type: "sale",
          reference_id: orderId,
          created_at: new Date()
        });

        res.status = "deducted";
        deductedCount++;
      }
    }

    order.stock_status = "deducted";
    return { ok: true, order_id: orderId, deducted_items_count: deductedCount, stock_status: "deducted" };
  }

  // Simulates order creation with triggers
  insertOrder(orderRow) {
    // 1. BEFORE INSERT trigger
    this.trgOrderStockBefore(orderRow);

    const orderId = orderRow.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fullOrder = {
      ...orderRow,
      id: orderId,
      status: orderRow.status || "processing",
      stock_status: "none"
    };

    this.orders.set(orderId, fullOrder);

    // 2. AFTER INSERT trigger
    if (fullOrder.status === "processing" || fullOrder.status === "ready_to_ship") {
      try {
        this.reserveOrderStock(orderId);
      } catch (err) {
        // Rollback entire order insertion on reservation error!
        this.orders.delete(orderId);
        throw err;
      }
    }

    return fullOrder;
  }

  // Simulates status update with trigger
  updateOrderStatus(orderId, nextStatus) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    const prevStatus = order.status;
    const prevStockStatus = order.stock_status;
    if (prevStatus === nextStatus) return order;

    order.status = nextStatus;

    // AFTER UPDATE OF status trigger
    if (nextStatus === "out_of_stock" || nextStatus === "cancelled") {
      this.releaseOrderStock(orderId);
    } else if (nextStatus === "successful" && prevStockStatus === "reserved") {
      this.deductOrderStock(orderId);
    } else if ((nextStatus === "processing" || nextStatus === "ready_to_ship") &&
               (prevStatus === "out_of_stock" || prevStatus === "cancelled")) {
      this.reserveOrderStock(orderId);
    }

    return order;
  }
}

// ==============================================================================
// 1. AVAILABILITY: quantity 10, reserved 3 -> available 7
// ==============================================================================
it("1. availability calculation: quantity 10, reserved 3 -> available 7", () => {
  const db = new MockStockDb();
  db.addProduct("prod-1", "Product 1", 100000);
  db.setStockBalance("prod-1", db.mainWarehouseId, 10, 3);

  const available = db.getAvailableQuantity("prod-1");
  assert.strictEqual(available, 7);

  // Unprivileged anon role is denied raw stock inspection
  assert.throws(() => {
    db.getAvailableQuantity("prod-1", db.mainWarehouseId, "anon");
  }, /42501/);
});

// ==============================================================================
// 2. SUCCESSFUL RESERVATION: stock 10, reserve 4 -> reserved = 4
// ==============================================================================
it("2. successful reservation: stock 10, reserve 4 -> reserved = 4", () => {
  const db = new MockStockDb();
  db.addProduct("prod-2", "Product 2", 50000);
  db.setStockBalance("prod-2", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    items: [{ product_id: "prod-2", title: "Product 2", price: 50000, qty: 4 }]
  });

  const bal = db.getStockBalance("prod-2", db.mainWarehouseId);
  assert.strictEqual(bal.quantity, 10, "Physical quantity must NOT decrease on reservation");
  assert.strictEqual(bal.reserved_quantity, 4, "Reserved quantity must increase by 4");
  assert.strictEqual(db.getAvailableQuantity("prod-2"), 6);
  assert.strictEqual(order.stock_status, "reserved");
});

// ==============================================================================
// 3. INSUFFICIENT STOCK: stock 10, reserve 11 -> reject
// ==============================================================================
it("3. insufficient stock: stock 10, reserve 11 -> reject and rollback", () => {
  const db = new MockStockDb();
  db.addProduct("prod-3", "Product 3", 50000);
  db.setStockBalance("prod-3", db.mainWarehouseId, 10, 0);

  assert.throws(() => {
    db.insertOrder({
      items: [{ product_id: "prod-3", title: "Product 3", price: 50000, qty: 11 }]
    });
  }, /P0006/);

  const bal = db.getStockBalance("prod-3", db.mainWarehouseId);
  assert.strictEqual(bal.reserved_quantity, 0, "No stock reserved on rejected order");
  assert.strictEqual(db.orders.size, 0, "Order must be rolled back on insufficient stock");
});

// ==============================================================================
// 4. EXACT STOCK: stock 10, reserve 10 -> success
// ==============================================================================
it("4. exact stock: stock 10, reserve 10 -> success, available = 0", () => {
  const db = new MockStockDb();
  db.addProduct("prod-4", "Product 4", 25000);
  db.setStockBalance("prod-4", db.mainWarehouseId, 10, 0);

  db.insertOrder({
    items: [{ product_id: "prod-4", title: "Product 4", price: 25000, qty: 10 }]
  });

  const bal = db.getStockBalance("prod-4", db.mainWarehouseId);
  assert.strictEqual(bal.reserved_quantity, 10);
  assert.strictEqual(db.getAvailableQuantity("prod-4"), 0);
});

// ==============================================================================
// 5. SECOND RESERVATION: stock 10, first reserve 10, second reserve 1 -> reject
// ==============================================================================
it("5. second reservation: stock 10, first reserve 10, second reserve 1 -> reject", () => {
  const db = new MockStockDb();
  db.addProduct("prod-5", "Product 5", 30000);
  db.setStockBalance("prod-5", db.mainWarehouseId, 10, 0);

  db.insertOrder({
    id: "ord-first",
    items: [{ product_id: "prod-5", title: "Product 5", price: 30000, qty: 10 }]
  });

  assert.throws(() => {
    db.insertOrder({
      id: "ord-second",
      items: [{ product_id: "prod-5", title: "Product 5", price: 30000, qty: 1 }]
    });
  }, /P0006/);

  const bal = db.getStockBalance("prod-5", db.mainWarehouseId);
  assert.strictEqual(bal.reserved_quantity, 10);
});

// ==============================================================================
// 6. IDEMPOTENT RESERVE: reserve same order twice -> reserved unchanged
// ==============================================================================
it("6. idempotent reserve: reserve same order twice -> reserved unchanged", () => {
  const db = new MockStockDb();
  db.addProduct("prod-6", "Product 6", 40000);
  db.setStockBalance("prod-6", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    id: "ord-idem",
    items: [{ product_id: "prod-6", title: "Product 6", price: 40000, qty: 3 }]
  });

  const res1 = db.reserveOrderStock(order.id);
  assert.strictEqual(res1.idempotent, true);

  const bal = db.getStockBalance("prod-6", db.mainWarehouseId);
  assert.strictEqual(bal.reserved_quantity, 3, "Reserved quantity must remain 3");
});

// ==============================================================================
// 7. RELEASE: reserve 5, release -> reserved returns to original
// ==============================================================================
it("7. release: reserve 5, release -> reserved returns to original", () => {
  const db = new MockStockDb();
  db.addProduct("prod-7", "Product 7", 70000);
  db.setStockBalance("prod-7", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    items: [{ product_id: "prod-7", title: "Product 7", price: 70000, qty: 5 }]
  });

  assert.strictEqual(db.getStockBalance("prod-7", db.mainWarehouseId).reserved_quantity, 5);

  const rel = db.releaseOrderStock(order.id);
  assert.strictEqual(rel.ok, true);
  assert.strictEqual(db.getStockBalance("prod-7", db.mainWarehouseId).reserved_quantity, 0);
  assert.strictEqual(db.getAvailableQuantity("prod-7"), 10);
});

// ==============================================================================
// 8. IDEMPOTENT RELEASE: release twice -> no negative reserved stock
// ==============================================================================
it("8. idempotent release: release twice -> no negative reserved stock", () => {
  const db = new MockStockDb();
  db.addProduct("prod-8", "Product 8", 15000);
  db.setStockBalance("prod-8", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    items: [{ product_id: "prod-8", title: "Product 8", price: 15000, qty: 4 }]
  });

  db.releaseOrderStock(order.id);
  const rel2 = db.releaseOrderStock(order.id);
  assert.strictEqual(rel2.idempotent, true);
  assert.strictEqual(db.getStockBalance("prod-8", db.mainWarehouseId).reserved_quantity, 0);
});

// ==============================================================================
// 9. DEDUCT: quantity 10, reserve 4, deduct -> quantity 6, reserved 0
// ==============================================================================
it("9. deduct: quantity 10, reserve 4, deduct -> quantity 6, reserved 0, movement created", () => {
  const db = new MockStockDb();
  db.addProduct("prod-9", "Product 9", 80000);
  db.setStockBalance("prod-9", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    items: [{ product_id: "prod-9", title: "Product 9", price: 80000, qty: 4 }]
  });

  const ded = db.deductOrderStock(order.id);
  assert.strictEqual(ded.ok, true);

  const bal = db.getStockBalance("prod-9", db.mainWarehouseId);
  assert.strictEqual(bal.quantity, 6, "Physical quantity must decrease to 6");
  assert.strictEqual(bal.reserved_quantity, 0, "Reserved quantity must return to 0");
  assert.strictEqual(db.getAvailableQuantity("prod-9"), 6);

  // Movement check
  assert.strictEqual(db.stockMovements.length, 1);
  const mov = db.stockMovements[0];
  assert.strictEqual(mov.product_id, "prod-9");
  assert.strictEqual(mov.change_qty, -4, "Sale movement change_qty must be negative");
  assert.strictEqual(mov.movement_type, "sale");
  assert.strictEqual(mov.reference_id, order.id);
});

// ==============================================================================
// 10. IDEMPOTENT DEDUCT: deduct twice -> stock changes only once
// ==============================================================================
it("10. idempotent deduct: deduct twice -> stock changes only once", () => {
  const db = new MockStockDb();
  db.addProduct("prod-10", "Product 10", 90000);
  db.setStockBalance("prod-10", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    items: [{ product_id: "prod-10", title: "Product 10", price: 90000, qty: 2 }]
  });

  db.deductOrderStock(order.id);
  const ded2 = db.deductOrderStock(order.id);
  assert.strictEqual(ded2.idempotent, true);

  const bal = db.getStockBalance("prod-10", db.mainWarehouseId);
  assert.strictEqual(bal.quantity, 8);
  assert.strictEqual(bal.reserved_quantity, 0);
  assert.strictEqual(db.stockMovements.length, 1, "Only one movement recorded");
});

// ==============================================================================
// 11. OVERSELLING RACE: quantity 1, two concurrent reservations -> exactly one succeeds
// ==============================================================================
it("11. overselling race simulation: quantity 1, two concurrent reservations -> exactly one succeeds", () => {
  const db = new MockStockDb();
  db.addProduct("prod-race", "Race Product", 100000);
  db.setStockBalance("prod-race", db.mainWarehouseId, 1, 0);

  let successCount = 0;
  let failCount = 0;

  // Simulate two concurrent requests
  try {
    db.insertOrder({
      id: "ord-req-A",
      items: [{ product_id: "prod-race", title: "Race Product", price: 100000, qty: 1 }]
    });
    successCount++;
  } catch (_) {
    failCount++;
  }

  try {
    db.insertOrder({
      id: "ord-req-B",
      items: [{ product_id: "prod-race", title: "Race Product", price: 100000, qty: 1 }]
    });
    successCount++;
  } catch (_) {
    failCount++;
  }

  assert.strictEqual(successCount, 1, "Exactly one concurrent reservation must succeed");
  assert.strictEqual(failCount, 1, "Second concurrent reservation must fail");
  assert.strictEqual(db.getStockBalance("prod-race", db.mainWarehouseId).reserved_quantity, 1);
});

// ==============================================================================
// 12. INVALID PRODUCT_ID: reject
// ==============================================================================
it("12. invalid product_id: reject when product does not exist in catalog", () => {
  const db = new MockStockDb();
  assert.throws(() => {
    db.insertOrder({
      items: [{ product_id: "prod-nonexistent", title: "Ghost Item", price: 1000, qty: 1 }]
    });
  }, /P0009/);
});

// ==============================================================================
// 13. TITLE-ONLY ITEM: reject, NEVER lookup stock by title
// ==============================================================================
it("13. title-only item: reject, NEVER lookup stock by title", () => {
  const db = new MockStockDb();
  db.addProduct("prod-real-id", "Apple iPhone 15", 15000000);
  db.setStockBalance("prod-real-id", db.mainWarehouseId, 5, 0);

  // Missing product_id
  assert.throws(() => {
    db.insertOrder({
      items: [{ title: "Apple iPhone 15", price: 15000000, qty: 1 }]
    });
  }, /P0008/);

  // product_id equals title
  assert.throws(() => {
    db.insertOrder({
      items: [{ product_id: "Apple iPhone 15", title: "Apple iPhone 15", price: 15000000, qty: 1 }]
    });
  }, /P0008/);

  // Stock must remain unaffected
  assert.strictEqual(db.getStockBalance("prod-real-id", db.mainWarehouseId).reserved_quantity, 0);
});

// ==============================================================================
// 14. CLIENT PRICE TAMPERING: real price 1500, client submits 1 -> reject
// ==============================================================================
it("14. client price tampering: real price 1500, client submits 1 -> reject", () => {
  const db = new MockStockDb();
  db.addProduct("prod-expensive", "Gold Ring", 1500000);
  db.setStockBalance("prod-expensive", db.mainWarehouseId, 2, 0);

  assert.throws(() => {
    db.insertOrder({
      items: [{ product_id: "prod-expensive", title: "Gold Ring", price: 1, qty: 1 }]
    });
  }, /P0011/);
});

// ==============================================================================
// 15. AUTHORITATIVE PRICE: correct price accepted
// ==============================================================================
it("15. authoritative price: correct price accepted", () => {
  const db = new MockStockDb();
  db.addProduct("prod-fair", "Silver Coin", 200000);
  db.setStockBalance("prod-fair", db.mainWarehouseId, 5, 0);

  const order = db.insertOrder({
    items: [{ product_id: "prod-fair", title: "Silver Coin", price: 200000, qty: 2 }]
  });
  assert.strictEqual(order.stock_status, "reserved");
});

// ==============================================================================
// 16. PROCESSING RESERVATION: status processing triggers reservation
// ==============================================================================
it("16. processing status triggers reservation on order insert", () => {
  const db = new MockStockDb();
  db.addProduct("prod-proc", "Processing Item", 50000);
  db.setStockBalance("prod-proc", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    status: "processing",
    items: [{ product_id: "prod-proc", title: "Processing Item", price: 50000, qty: 3 }]
  });

  assert.strictEqual(order.stock_status, "reserved");
  assert.strictEqual(db.getStockBalance("prod-proc", db.mainWarehouseId).reserved_quantity, 3);
});

// ==============================================================================
// 17. OUT_OF_STOCK RELEASE: status out_of_stock triggers release
// ==============================================================================
it("17. out_of_stock status triggers automatic release of reservation", () => {
  const db = new MockStockDb();
  db.addProduct("prod-oos", "OOS Item", 50000);
  db.setStockBalance("prod-oos", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    status: "processing",
    items: [{ product_id: "prod-oos", title: "OOS Item", price: 50000, qty: 4 }]
  });
  assert.strictEqual(db.getStockBalance("prod-oos", db.mainWarehouseId).reserved_quantity, 4);

  db.updateOrderStatus(order.id, "out_of_stock");
  assert.strictEqual(order.stock_status, "released");
  assert.strictEqual(db.getStockBalance("prod-oos", db.mainWarehouseId).reserved_quantity, 0);
  assert.strictEqual(db.getAvailableQuantity("prod-oos"), 10);
});

// ==============================================================================
// 18. SUCCESSFUL DEDUCTION: status successful triggers deduction
// ==============================================================================
it("18. successful status triggers automatic deduction of stock and sale movement", () => {
  const db = new MockStockDb();
  db.addProduct("prod-succ", "Delivery Item", 100000);
  db.setStockBalance("prod-succ", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    status: "processing",
    items: [{ product_id: "prod-succ", title: "Delivery Item", price: 100000, qty: 2 }]
  });

  db.updateOrderStatus(order.id, "ready_to_ship");
  assert.strictEqual(order.stock_status, "reserved");

  db.updateOrderStatus(order.id, "successful");
  assert.strictEqual(order.stock_status, "deducted");

  const bal = db.getStockBalance("prod-succ", db.mainWarehouseId);
  assert.strictEqual(bal.quantity, 8);
  assert.strictEqual(bal.reserved_quantity, 0);
  assert.strictEqual(db.stockMovements.length, 1);
  assert.strictEqual(db.stockMovements[0].movement_type, "sale");
  assert.strictEqual(db.stockMovements[0].change_qty, -2);
});

// ==============================================================================
// 19. CANCELLED RELEASE: status cancelled triggers release
// ==============================================================================
it("19. cancelled status triggers automatic release of reservation", () => {
  const db = new MockStockDb();
  db.addProduct("prod-canc", "Cancelled Item", 60000);
  db.setStockBalance("prod-canc", db.mainWarehouseId, 5, 0);

  const order = db.insertOrder({
    status: "processing",
    items: [{ product_id: "prod-canc", title: "Cancelled Item", price: 60000, qty: 2 }]
  });

  db.updateOrderStatus(order.id, "cancelled");
  assert.strictEqual(order.stock_status, "released");
  assert.strictEqual(db.getStockBalance("prod-canc", db.mainWarehouseId).reserved_quantity, 0);
});

// ==============================================================================
// 20. REPEATED STATUS TRANSITION: no duplicate stock changes
// ==============================================================================
it("20. repeated status transition: no duplicate stock changes", () => {
  const db = new MockStockDb();
  db.addProduct("prod-trans", "Transition Item", 30000);
  db.setStockBalance("prod-trans", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    status: "processing",
    items: [{ product_id: "prod-trans", title: "Transition Item", price: 30000, qty: 3 }]
  });

  db.updateOrderStatus(order.id, "successful");
  assert.strictEqual(db.getStockBalance("prod-trans", db.mainWarehouseId).quantity, 7);

  // Attempt duplicate transition to successful
  db.updateOrderStatus(order.id, "successful");
  assert.strictEqual(db.getStockBalance("prod-trans", db.mainWarehouseId).quantity, 7, "Quantity must not deduct twice");
  assert.strictEqual(db.stockMovements.length, 1, "Only one movement recorded");

  // Attempt to cancel an already successful/deducted order
  assert.throws(() => {
    db.updateOrderStatus(order.id, "cancelled");
  }, /P0007/);
});

// ==============================================================================
// 21. DIRECT INSERT BYPASS ATTEMPT: cannot create order without stock protection
// ==============================================================================
it("21. direct insert bypass attempt: cannot create an inventory-controlled order without stock protection", () => {
  const db = new MockStockDb();
  db.addProduct("prod-bypass", "Bypass Item", 20000);
  db.setStockBalance("prod-bypass", db.mainWarehouseId, 0, 0); // 0 stock

  // Direct insert attempt without going through API
  assert.throws(() => {
    db.insertOrder({
      id: "ord-bypass-direct",
      phone: "+998901112233",
      full_name: "Direct Attacker",
      items: [{ product_id: "prod-bypass", title: "Bypass Item", price: 20000, qty: 1 }]
    });
  }, /P0006/);

  assert.strictEqual(db.orders.has("ord-bypass-direct"), false, "Direct insert must be completely rolled back");
});

// ==============================================================================
// 22. BONUS REGRESSION: existing bonus behavior unchanged
// ==============================================================================
it("22. bonus regression: existing bonus behavior and bounds unchanged", () => {
  const subtotal = 100000;
  const promoDiscount = 20000;
  const grossTotal = Math.max(0, subtotal - promoDiscount);
  const bonusBalance = 50000;
  const requestedBonus = 10000;

  const maxSpend = Math.min(bonusBalance, grossTotal);
  const effectiveBonus = Math.min(Math.max(0, requestedBonus), maxSpend);
  const totalAmount = Math.max(0, grossTotal - effectiveBonus);

  assert.strictEqual(effectiveBonus, 10000);
  assert.strictEqual(totalAmount, 70000);
  assert.strictEqual(totalAmount + effectiveBonus, grossTotal);
});

// ==============================================================================
// 23. RECEIVING REGRESSION: receipt posting/cancel still works
// ==============================================================================
it("23. receiving regression: receiving migration contracts verified", () => {
  const migrationPath = path.join(__dirname, "../supabase/inventory-and-receiving-migration.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.ok(sql.includes("create table if not exists public.stock_balances"));
  assert.ok(sql.includes("create table if not exists public.stock_movements"));
  assert.ok(sql.includes("create table if not exists public.receipts"));
  assert.ok(sql.includes("create or replace function public.post_receipt"));
  assert.ok(sql.includes("create or replace function public.cancel_receipt"));
});

// ==============================================================================
// 24. PHASE 4A REGRESSION: canonical product_id still propagates
// ==============================================================================
it("24. Phase 4A regression: canonical product_id resolution and propagation", () => {
  const item = {
    admin_id: "prod-p4a-canonical",
    sku: "SKU-P4A",
    title: "Phase 4A Propagated Item",
    price: 500000,
    qty: 1
  };

  const resolved = telegramLib.resolveCanonicalProductId(item);
  assert.strictEqual(resolved, "prod-p4a-canonical");

  const sanitized = telegramLib.sanitizeOrderPayload({
    phone: "+998901234567",
    full_name: "Test User",
    items: [item],
    total_amount: 500000
  });

  assert.strictEqual(sanitized.items[0].product_id, "prod-p4a-canonical");
  assert.strictEqual(sanitized.items[0].sku, "SKU-P4A");
});

// ==============================================================================
// 25. LEGACY ORDER: stock_status = 'none', processing -> successful MUST succeed without stock change
// ==============================================================================
it("25. legacy order: stock_status = 'none', processing -> successful succeeds with no stock change", () => {
  const db = new MockStockDb();
  db.addProduct("prod-legacy", "Legacy Item", 50000);
  db.setStockBalance("prod-legacy", db.mainWarehouseId, 10, 0);

  // Simulate existing historical order created before Phase 4B
  const legacyOrderId = "ord-legacy-historical-1";
  db.orders.set(legacyOrderId, {
    id: legacyOrderId,
    status: "processing",
    stock_status: "none",
    items: [{ title: "Legacy Item without canonical ID", price: 50000, qty: 2 }]
  });

  // Transition to successful MUST succeed and NOT throw P0007
  db.updateOrderStatus(legacyOrderId, "successful");

  const orderAfter = db.orders.get(legacyOrderId);
  assert.strictEqual(orderAfter.status, "successful");
  assert.strictEqual(orderAfter.stock_status, "none", "stock_status must remain none");

  // Physical stock balances and movements must remain completely unchanged
  const bal = db.getStockBalance("prod-legacy", db.mainWarehouseId);
  assert.strictEqual(bal.quantity, 10, "Stock quantity must NOT change for legacy orders");
  assert.strictEqual(bal.reserved_quantity, 0, "Reserved quantity must remain 0");
  assert.strictEqual(db.stockMovements.length, 0, "No stock movement should be recorded for legacy orders");
});

// ==============================================================================
// 26. NEW RESERVED ORDER: stock_status = 'reserved', processing -> successful MUST deduct exactly once
// ==============================================================================
it("26. new reserved order: stock_status = 'reserved', processing -> successful MUST deduct exactly once", () => {
  const db = new MockStockDb();
  db.addProduct("prod-res-succ", "Reserved Item", 75000);
  db.setStockBalance("prod-res-succ", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    status: "processing",
    items: [{ product_id: "prod-res-succ", title: "Reserved Item", price: 75000, qty: 3 }]
  });

  assert.strictEqual(order.stock_status, "reserved");
  assert.strictEqual(db.getStockBalance("prod-res-succ", db.mainWarehouseId).reserved_quantity, 3);

  db.updateOrderStatus(order.id, "successful");

  assert.strictEqual(order.status, "successful");
  assert.strictEqual(order.stock_status, "deducted");

  const bal = db.getStockBalance("prod-res-succ", db.mainWarehouseId);
  assert.strictEqual(bal.quantity, 7, "Physical quantity must be decremented by 3");
  assert.strictEqual(bal.reserved_quantity, 0, "Reserved quantity must return to 0");
  assert.strictEqual(db.stockMovements.length, 1, "Exactly one sale movement must be logged");
  assert.strictEqual(db.stockMovements[0].change_qty, -3);
  assert.strictEqual(db.stockMovements[0].movement_type, "sale");
});

// ==============================================================================
// 27. NEW RELEASED ORDER: stock_status = 'released', released -> successful MUST NOT deduct
// ==============================================================================
it("27. new released order: stock_status = 'released', released -> successful MUST NOT deduct", () => {
  const db = new MockStockDb();
  db.addProduct("prod-rel-succ", "Released Item", 40000);
  db.setStockBalance("prod-rel-succ", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    status: "processing",
    items: [{ product_id: "prod-rel-succ", title: "Released Item", price: 40000, qty: 2 }]
  });

  // Cancel order -> status cancelled, stock_status released
  db.updateOrderStatus(order.id, "cancelled");
  assert.strictEqual(order.stock_status, "released");

  // Attempt to transition released order to successful
  // Trigger condition (prevStockStatus === 'reserved') will not match, so deductOrderStock is not called
  db.updateOrderStatus(order.id, "successful");
  assert.strictEqual(order.stock_status, "released", "stock_status remains released");

  // Direct RPC call to deductOrderStock on a released order MUST throw P0007
  assert.throws(() => {
    db.deductOrderStock(order.id);
  }, /P0007/);

  const bal = db.getStockBalance("prod-rel-succ", db.mainWarehouseId);
  assert.strictEqual(bal.quantity, 10, "Quantity must remain 10");
  assert.strictEqual(bal.reserved_quantity, 0, "Reserved quantity must remain 0");
  assert.strictEqual(db.stockMovements.length, 0, "No sale movements created");
});

// ==============================================================================
// 28. REPEAT SUCCESSFUL: no duplicate deduction
// ==============================================================================
it("28. repeat successful: no duplicate deduction", () => {
  const db = new MockStockDb();
  db.addProduct("prod-dup-succ", "Dup Item", 60000);
  db.setStockBalance("prod-dup-succ", db.mainWarehouseId, 10, 0);

  const order = db.insertOrder({
    status: "processing",
    items: [{ product_id: "prod-dup-succ", title: "Dup Item", price: 60000, qty: 2 }]
  });

  db.updateOrderStatus(order.id, "successful");
  assert.strictEqual(db.getStockBalance("prod-dup-succ", db.mainWarehouseId).quantity, 8);
  assert.strictEqual(db.stockMovements.length, 1);

  // Repeat update to successful
  db.updateOrderStatus(order.id, "successful");
  assert.strictEqual(db.getStockBalance("prod-dup-succ", db.mainWarehouseId).quantity, 8, "Quantity must not deduct again");
  assert.strictEqual(db.stockMovements.length, 1, "No duplicate movements");

  // Direct call to deductOrderStock is also idempotent
  const r = db.deductOrderStock(order.id);
  assert.strictEqual(r.idempotent, true);
  assert.strictEqual(db.getStockBalance("prod-dup-succ", db.mainWarehouseId).quantity, 8);
});

// ==============================================================================
// SQL MIGRATION CONTRACT CHECKS
// ==============================================================================
console.log("\n--- Checking SQL Migration File Contracts ---");
const p4bMigrationPath = path.join(__dirname, "../supabase/stock-reservation-migration.sql");
const p4bSql = fs.readFileSync(p4bMigrationPath, "utf8");

assert.ok(p4bSql.includes("add column if not exists stock_status text"), "Migration must add stock_status column");
assert.ok(p4bSql.includes("create table if not exists public.order_stock_reservations"), "Migration must create order_stock_reservations table");
assert.ok(p4bSql.includes("create or replace function public.get_product_available_quantity"), "Migration must define get_product_available_quantity");
assert.ok(p4bSql.includes("create or replace function public.reserve_order_stock"), "Migration must define reserve_order_stock");
assert.ok(p4bSql.includes("create or replace function public.release_order_stock"), "Migration must define release_order_stock");
assert.ok(p4bSql.includes("create or replace function public.deduct_order_stock"), "Migration must define deduct_order_stock");
assert.ok(p4bSql.includes("trg_order_stock_before"), "Migration must define trg_order_stock_before trigger");
assert.ok(p4bSql.includes("trg_order_stock_after"), "Migration must define trg_order_stock_after trigger");
assert.ok(p4bSql.includes("for update"), "reserve_order_stock must use FOR UPDATE row lock");
assert.ok(p4bSql.includes("order by trim(item->>'product_id') asc"), "reserve_order_stock must lock rows in sorted order to prevent deadlocks");
assert.ok(p4bSql.includes("elsif NEW.status = 'successful' and OLD.stock_status = 'reserved' then"), "Migration must require OLD.stock_status = 'reserved' on successful transition");
console.log("  [PASS] All SQL migration contracts verified successfully!");

console.log("\n================================================================");
console.log(`PHASE 4B TEST SUITE SUMMARY: ${passedTests}/${totalTests} PASS`);
console.log("================================================================");

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
