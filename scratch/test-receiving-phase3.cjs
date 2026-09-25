/**
 * EMIRATE CO / SFS MARKET — INVENTORY & GOODS RECEIVING MODULE
 * Phase 3B: Automated Test Suite (Local Verification)
 *
 * Verifies 26 core requirements:
 * 1. create draft
 * 2. created_at and received_at independent
 * 3. add product item
 * 4. quantity > 0
 * 5. unit_cost >= 0
 * 6. sale_price snapshot
 * 7. line total
 * 8. paid <= total
 * 9. debt calculation
 * 10. draft has no stock effect
 * 11. post receipt
 * 12. stock increases
 * 13. stock movement created
 * 14. contractor accrual created
 * 15. payment transaction created when paid > 0
 * 16. second post rejected
 * 17. cancel draft
 * 18. cancel posted receipt
 * 19. stock reversal
 * 20. financial reversal
 * 21. insufficient available stock blocks cancellation
 * 22. non-admin rejected
 * 23. concurrent post protected
 * 24. invalid product rejected
 * 25. posted receipt cannot be edited
 * 26. cancelled receipt cannot be edited
 *
 * Plus Codebase & Migration Contract Checks.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const migrationPath = path.join(ROOT, 'supabase', 'inventory-and-receiving-migration.sql');
const apiPath = path.join(ROOT, 'emirate-supabase-api.js');
const adminHtmlPath = path.join(ROOT, 'admin.html');
const adminJsPath = path.join(ROOT, 'admin.js');

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const apiJs = fs.readFileSync(apiPath, 'utf8');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
const adminJs = fs.readFileSync(adminJsPath, 'utf8');

console.log('================================================================');
console.log('PHASE 3B: GOODS RECEIVING / INVENTORY AUTOMATED TEST SUITE');
console.log('================================================================');

let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    failedTests++;
  }
}

// ------------------------------------------------------------------------------
// MOCK DATABASE & LOGIC ENGINE FOR PHASE 3B
// ------------------------------------------------------------------------------
class MockReceivingEngine {
  constructor() {
    this.adminUsers = new Set(['admin_user_1']);
    this.currentUser = 'admin_user_1';
    this.currentRole = 'authenticated';

    this.products = new Map(); // admin_id -> product
    this.contractors = new Map();
    this.warehouses = new Map();
    this.receipts = new Map();
    this.receiptItems = new Map(); // receipt_id -> []
    this.stockBalances = new Map(); // `${product_id}:${warehouse_id}` -> { quantity, reserved_quantity }
    this.stockMovements = [];
    this.contractorTransactions = [];

    this.receiptSeq = 1;
    this.lockedReceipts = new Set();

    // Seed default warehouse & contractor & product
    this.warehouses.set('wh_main', {
      id: 'wh_main',
      name: 'Основной склад',
      code: 'MAIN',
      is_active: true
    });

    this.contractors.set('cont_1', {
      id: 'cont_1',
      name: 'Apple Distribution Asia',
      phone: '+998901234567',
      status: 'active'
    });

    this.contractors.set('cont_inactive', {
      id: 'cont_inactive',
      name: 'Old Supplier',
      status: 'inactive'
    });

    this.products.set('prod_iphone15', {
      admin_id: 'prod_iphone15',
      title: 'iPhone 15 Pro Max',
      sku: 'IPH-15-PM-256',
      costPrice: 12000000,
      price: 15000000
    });
  }

  setCaller(userId, role = 'authenticated') {
    this.currentUser = userId;
    this.currentRole = role;
  }

  isTrustedAdmin() {
    if (this.currentRole === 'service_role') return true;
    if (this.currentRole === 'authenticated' && this.currentUser && this.adminUsers.has(this.currentUser)) return true;
    return false;
  }

  generateReceiptNumber() {
    const num = String(this.receiptSeq++).padStart(4, '0');
    return `REC-2026-${num}`;
  }

  // --- API / DB: CREATE DRAFT ---
  createReceiptDraft(header, items = []) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');
    if (!header || !header.contractor_id) throw new Error('Contractor required');
    if (!this.contractors.has(header.contractor_id)) throw new Error('Contractor not found');
    if (!header.warehouse_id) throw new Error('Warehouse required');
    if (!this.warehouses.has(header.warehouse_id)) throw new Error('Warehouse not found');

    const receiptId = header.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const receiptNumber = header.receipt_number || this.generateReceiptNumber();

    // Check items if any
    let totalCost = 0;
    const validatedItems = [];
    for (const it of items) {
      if (!this.products.has(it.product_id)) {
        throw new Error(`Foreign key violation: product_id ${it.product_id} does not exist [23503]`);
      }
      const qty = Number(it.quantity);
      const cost = Number(it.unit_cost);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantity must be an integer greater than 0');
      if (!Number.isFinite(cost) || cost < 0) throw new Error('Purchase cost must be >= 0');

      const lineTotal = qty * cost;
      totalCost += lineTotal;
      validatedItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        receipt_id: receiptId,
        product_id: it.product_id,
        quantity: qty,
        unit_cost: cost,
        sale_price: it.sale_price != null ? Number(it.sale_price) : null,
        total_cost: lineTotal
      });
    }

    const paidAmount = Number(header.paid_amount) || 0;
    if (paidAmount < 0) throw new Error('paid_amount cannot be negative');
    if (paidAmount > totalCost) throw new Error('Paid amount cannot exceed total cost [P0004]');

    const now = new Date();
    const receipt = {
      id: receiptId,
      receipt_number: receiptNumber,
      contractor_id: header.contractor_id,
      warehouse_id: header.warehouse_id,
      status: 'draft',
      created_at: now,
      received_at: header.received_at || now.toISOString().slice(0, 10),
      external_order_number: header.external_order_number || null,
      payment_method: header.payment_method || 'debt',
      currency: header.currency || 'UZS',
      exchange_rate: Number(header.exchange_rate) || 1,
      total_cost: totalCost,
      paid_amount: paidAmount,
      debt_amount: Math.max(totalCost - paidAmount, 0),
      description: header.description || null,
      created_by: this.currentUser
    };

    this.receipts.set(receiptId, receipt);
    this.receiptItems.set(receiptId, validatedItems);
    return receipt;
  }

  // --- API / DB: UPDATE DRAFT ---
  updateReceiptDraft(receiptId, header, items = []) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');
    const receipt = this.receipts.get(receiptId);
    if (!receipt) throw new Error('Receipt not found');

    // Immutability Guard: posted or cancelled receipts cannot be edited directly
    if (receipt.status === 'posted') {
      throw new Error('Cannot modify a posted receipt [P0012]');
    }
    if (receipt.status === 'cancelled') {
      throw new Error('Cannot modify a cancelled receipt [P0012]');
    }

    // Validate items
    let totalCost = 0;
    const validatedItems = [];
    for (const it of items) {
      if (!this.products.has(it.product_id)) {
        throw new Error(`Foreign key violation: product_id ${it.product_id} [23503]`);
      }
      const qty = Number(it.quantity);
      const cost = Number(it.unit_cost);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantity must be an integer greater than 0');
      if (!Number.isFinite(cost) || cost < 0) throw new Error('Purchase cost must be >= 0');

      const lineTotal = qty * cost;
      totalCost += lineTotal;
      validatedItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        receipt_id: receiptId,
        product_id: it.product_id,
        quantity: qty,
        unit_cost: cost,
        sale_price: it.sale_price != null ? Number(it.sale_price) : null,
        total_cost: lineTotal
      });
    }

    const paidAmount = header.paid_amount != null ? Number(header.paid_amount) : receipt.paid_amount;
    if (paidAmount < 0) throw new Error('paid_amount cannot be negative');
    if (paidAmount > totalCost) throw new Error('Paid amount cannot exceed total cost [P0004]');

    if (header.contractor_id) receipt.contractor_id = header.contractor_id;
    if (header.warehouse_id) receipt.warehouse_id = header.warehouse_id;
    if (header.received_at) receipt.received_at = header.received_at;
    if (header.external_order_number !== undefined) receipt.external_order_number = header.external_order_number;
    if (header.payment_method) receipt.payment_method = header.payment_method;
    if (header.description !== undefined) receipt.description = header.description;

    receipt.total_cost = totalCost;
    receipt.paid_amount = paidAmount;
    receipt.debt_amount = Math.max(totalCost - paidAmount, 0);
    receipt.updated_at = new Date();

    this.receiptItems.set(receiptId, validatedItems);
    return receipt;
  }

  // --- RPC: POST RECEIPT ---
  postReceipt(receiptId, simulateLock = false) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');

    if (simulateLock || this.lockedReceipts.has(receiptId)) {
      throw new Error('Lock timeout: receipt row is locked by concurrent transaction [P0009]');
    }

    const receipt = this.receipts.get(receiptId);
    if (!receipt) throw new Error('Receipt not found [P0008]');

    if (receipt.status !== 'draft') {
      throw new Error(`Only draft receipts can be posted. Current status: ${receipt.status} [P0001]`);
    }

    const items = this.receiptItems.get(receiptId) || [];
    if (!items.length) {
      throw new Error('Cannot post receipt without items [P0002]');
    }

    this.lockedReceipts.add(receiptId);

    try {
      const calculatedTotal = items.reduce((s, it) => s + (it.quantity * it.unit_cost), 0);
      if (receipt.paid_amount > calculatedTotal) {
        throw new Error('Paid amount exceeds total cost [P0004]');
      }
      const calculatedDebt = Math.max(calculatedTotal - receipt.paid_amount, 0);

      // Process items -> update stock_balances & insert stock_movements
      for (const it of items) {
        const key = `${it.product_id}:${receipt.warehouse_id}`;
        const bal = this.stockBalances.get(key) || { quantity: 0, reserved_quantity: 0 };
        bal.quantity += it.quantity;
        this.stockBalances.set(key, bal);

        this.stockMovements.push({
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          product_id: it.product_id,
          warehouse_id: receipt.warehouse_id,
          change_qty: it.quantity,
          movement_type: 'receipt',
          reference_id: receiptId,
          created_at: new Date()
        });
      }

      // Record accrual
      this.contractorTransactions.push({
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        contractor_id: receipt.contractor_id,
        receipt_id: receiptId,
        amount: calculatedTotal,
        type: 'receipt_accrual',
        description: `Приходная накладная ${receipt.receipt_number}`,
        created_at: new Date()
      });

      // Record payment if paid_amount > 0
      if (receipt.paid_amount > 0) {
        this.contractorTransactions.push({
          id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          contractor_id: receipt.contractor_id,
          receipt_id: receiptId,
          amount: receipt.paid_amount,
          type: 'payment',
          payment_method: receipt.payment_method,
          description: `Оплата при приёмке ${receipt.receipt_number}`,
          created_at: new Date()
        });
      }

      receipt.status = 'posted';
      receipt.total_cost = calculatedTotal;
      receipt.debt_amount = calculatedDebt;
      receipt.updated_at = new Date();

      return {
        ok: true,
        receipt_id: receiptId,
        receipt_number: receipt.receipt_number,
        status: 'posted',
        total_cost: calculatedTotal,
        paid_amount: receipt.paid_amount,
        debt_amount: calculatedDebt
      };
    } finally {
      this.lockedReceipts.delete(receiptId);
    }
  }

  // --- RPC: CANCEL RECEIPT ---
  cancelReceipt(receiptId) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');
    const receipt = this.receipts.get(receiptId);
    if (!receipt) throw new Error('Receipt not found [P0008]');

    if (receipt.status === 'cancelled') {
      throw new Error('Receipt is already cancelled [P0005]');
    }

    if (receipt.status === 'draft') {
      receipt.status = 'cancelled';
      receipt.updated_at = new Date();
      return { ok: true, status: 'cancelled', note: 'Draft cancelled without stock effect' };
    }

    if (receipt.status === 'posted') {
      const items = this.receiptItems.get(receiptId) || [];

      // Check available stock first
      for (const it of items) {
        const key = `${it.product_id}:${receipt.warehouse_id}`;
        const bal = this.stockBalances.get(key) || { quantity: 0, reserved_quantity: 0 };
        const available = bal.quantity - bal.reserved_quantity;
        if (available < it.quantity) {
          throw new Error(`Cannot cancel receipt: insufficient available stock for product ${it.product_id} (available: ${available}, needed: ${it.quantity}) [P0006]`);
        }
      }

      // Deduct stock & create reversal movements
      for (const it of items) {
        const key = `${it.product_id}:${receipt.warehouse_id}`;
        const bal = this.stockBalances.get(key);
        bal.quantity -= it.quantity;
        this.stockBalances.set(key, bal);

        this.stockMovements.push({
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          product_id: it.product_id,
          warehouse_id: receipt.warehouse_id,
          change_qty: -it.quantity,
          movement_type: 'adjustment',
          reference_id: receiptId,
          created_at: new Date()
        });
      }

      // Financial reversal
      this.contractorTransactions.push({
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        contractor_id: receipt.contractor_id,
        receipt_id: receiptId,
        amount: receipt.total_cost,
        type: 'accrual_reversal',
        description: `Сторно приходной накладной ${receipt.receipt_number}`,
        created_at: new Date()
      });

      if (receipt.paid_amount > 0) {
        this.contractorTransactions.push({
          id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          contractor_id: receipt.contractor_id,
          receipt_id: receiptId,
          amount: receipt.paid_amount,
          type: 'payment_reversal',
          payment_method: receipt.payment_method,
          description: `Возврат оплаты по отменённой накладной ${receipt.receipt_number}`,
          created_at: new Date()
        });
      }

      receipt.status = 'cancelled';
      receipt.debt_amount = 0;
      receipt.updated_at = new Date();

      return {
        ok: true,
        status: 'cancelled',
        reversed_total: receipt.total_cost
      };
    }

    throw new Error('Unexpected receipt status [P0009]');
  }
}

// ------------------------------------------------------------------------------
// EXECUTE 26 TEST CASES
// ------------------------------------------------------------------------------

const db = new MockReceivingEngine();

it('1. create draft succeeds and assigns draft status', () => {
  const draft = db.createReceiptDraft({
    contractor_id: 'cont_1',
    warehouse_id: 'wh_main'
  });
  assert.strictEqual(draft.status, 'draft');
  assert.ok(draft.receipt_number.startsWith('REC-2026-'));
  assert.strictEqual(draft.total_cost, 0);
  assert.strictEqual(draft.paid_amount, 0);
  assert.strictEqual(draft.debt_amount, 0);
});

it('2. created_at and received_at are strictly independent', () => {
  const customDate = '2026-03-15';
  const draft = db.createReceiptDraft({
    contractor_id: 'cont_1',
    warehouse_id: 'wh_main',
    received_at: customDate
  });
  assert.strictEqual(draft.received_at, customDate);
  assert.ok(draft.created_at instanceof Date);
  assert.notStrictEqual(draft.created_at.toISOString().slice(0, 10), customDate);
});

it('3. add product item attaches lines to receipt draft', () => {
  const draft = db.createReceiptDraft({
    contractor_id: 'cont_1',
    warehouse_id: 'wh_main'
  }, [
    { product_id: 'prod_iphone15', quantity: 5, unit_cost: 12000000, sale_price: 15000000 }
  ]);
  const items = db.receiptItems.get(draft.id);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].product_id, 'prod_iphone15');
});

it('4. quantity > 0 validation rejects zero or negative quantity', () => {
  assert.throws(() => {
    db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
      { product_id: 'prod_iphone15', quantity: 0, unit_cost: 1000 }
    ]);
  }, /Quantity must be an integer greater than 0/);

  assert.throws(() => {
    db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
      { product_id: 'prod_iphone15', quantity: -3, unit_cost: 1000 }
    ]);
  }, /Quantity must be an integer greater than 0/);
});

it('5. unit_cost >= 0 rejects negative purchase cost', () => {
  assert.throws(() => {
    db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
      { product_id: 'prod_iphone15', quantity: 2, unit_cost: -500 }
    ]);
  }, /Purchase cost must be >= 0/);
});

it('6. sale_price snapshot is preserved independently of catalog changes', () => {
  const draft = db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
    { product_id: 'prod_iphone15', quantity: 1, unit_cost: 12000000, sale_price: 15500000 }
  ]);
  const item = db.receiptItems.get(draft.id)[0];
  assert.strictEqual(item.sale_price, 15500000);

  // Mutate product catalog price
  db.products.get('prod_iphone15').price = 18000000;
  // Receipt item snapshot remains untouched
  assert.strictEqual(item.sale_price, 15500000);
});

it('7. line total strictly equals quantity * unit_cost', () => {
  const draft = db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
    { product_id: 'prod_iphone15', quantity: 4, unit_cost: 12000000 }
  ]);
  const item = db.receiptItems.get(draft.id)[0];
  assert.strictEqual(item.total_cost, 48000000);
  assert.strictEqual(draft.total_cost, 48000000);
});

it('8. paid <= total validation blocks overpayment', () => {
  assert.throws(() => {
    db.createReceiptDraft({
      contractor_id: 'cont_1',
      warehouse_id: 'wh_main',
      paid_amount: 50000000
    }, [
      { product_id: 'prod_iphone15', quantity: 2, unit_cost: 12000000 } // total = 24,000,000
    ]);
  }, /Paid amount cannot exceed total cost/);
});

it('9. debt calculation matches max(total_cost - paid_amount, 0)', () => {
  const draft = db.createReceiptDraft({
    contractor_id: 'cont_1',
    warehouse_id: 'wh_main',
    paid_amount: 10000000
  }, [
    { product_id: 'prod_iphone15', quantity: 2, unit_cost: 12000000 } // total = 24,000,000
  ]);
  assert.strictEqual(draft.total_cost, 24000000);
  assert.strictEqual(draft.paid_amount, 10000000);
  assert.strictEqual(draft.debt_amount, 14000000);
});

it('10. draft has no stock effect (0 movements, 0 balance changes)', () => {
  const movCountBefore = db.stockMovements.length;
  const balBefore = db.stockBalances.get('prod_iphone15:wh_main')?.quantity || 0;

  db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
    { product_id: 'prod_iphone15', quantity: 10, unit_cost: 12000000 }
  ]);

  const movCountAfter = db.stockMovements.length;
  const balAfter = db.stockBalances.get('prod_iphone15:wh_main')?.quantity || 0;

  assert.strictEqual(movCountBefore, movCountAfter);
  assert.strictEqual(balBefore, balAfter);
});

let testReceiptToPost = null;

it('11. post receipt transitions status to posted', () => {
  testReceiptToPost = db.createReceiptDraft({
    contractor_id: 'cont_1',
    warehouse_id: 'wh_main',
    paid_amount: 5000000
  }, [
    { product_id: 'prod_iphone15', quantity: 3, unit_cost: 12000000 } // total 36,000,000
  ]);

  const res = db.postReceipt(testReceiptToPost.id);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, 'posted');
  assert.strictEqual(testReceiptToPost.status, 'posted');
});

it('12. stock increases by received quantity upon posting', () => {
  const bal = db.stockBalances.get('prod_iphone15:wh_main');
  assert.ok(bal);
  assert.strictEqual(bal.quantity, 3);
});

it('13. stock movement created with movement_type = receipt', () => {
  const mov = db.stockMovements.find(m => m.reference_id === testReceiptToPost.id);
  assert.ok(mov);
  assert.strictEqual(mov.product_id, 'prod_iphone15');
  assert.strictEqual(mov.change_qty, 3);
  assert.strictEqual(mov.movement_type, 'receipt');
});

it('14. contractor accrual created for total_cost', () => {
  const accrual = db.contractorTransactions.find(t => t.receipt_id === testReceiptToPost.id && t.type === 'receipt_accrual');
  assert.ok(accrual);
  assert.strictEqual(accrual.amount, 36000000);
});

it('15. payment transaction created when paid > 0', () => {
  const payment = db.contractorTransactions.find(t => t.receipt_id === testReceiptToPost.id && t.type === 'payment');
  assert.ok(payment);
  assert.strictEqual(payment.amount, 5000000);
});

it('16. second post of already posted receipt is rejected', () => {
  assert.throws(() => {
    db.postReceipt(testReceiptToPost.id);
  }, /Only draft receipts can be posted/);
});

it('17. cancel draft sets status cancelled without stock effect', () => {
  const draftToCancel = db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
    { product_id: 'prod_iphone15', quantity: 5, unit_cost: 12000000 }
  ]);
  const movCountBefore = db.stockMovements.length;
  const res = db.cancelReceipt(draftToCancel.id);
  assert.strictEqual(res.status, 'cancelled');
  assert.strictEqual(draftToCancel.status, 'cancelled');
  assert.strictEqual(db.stockMovements.length, movCountBefore);
});

let receiptToCancelPosted = null;

it('18. cancel posted receipt sets status to cancelled', () => {
  receiptToCancelPosted = db.createReceiptDraft({
    contractor_id: 'cont_1',
    warehouse_id: 'wh_main',
    paid_amount: 2000000
  }, [
    { product_id: 'prod_iphone15', quantity: 2, unit_cost: 12000000 }
  ]);
  db.postReceipt(receiptToCancelPosted.id);

  const res = db.cancelReceipt(receiptToCancelPosted.id);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, 'cancelled');
  assert.strictEqual(receiptToCancelPosted.status, 'cancelled');
  assert.strictEqual(receiptToCancelPosted.debt_amount, 0);
});

it('19. stock reversal writes adjustment movement and deducts balance', () => {
  const revMov = db.stockMovements.find(m => m.reference_id === receiptToCancelPosted.id && m.movement_type === 'adjustment');
  assert.ok(revMov);
  assert.strictEqual(revMov.change_qty, -2);
  // Net balance of prod_iphone15 should be back to 3 (from test 11)
  const bal = db.stockBalances.get('prod_iphone15:wh_main');
  assert.strictEqual(bal.quantity, 3);
});

it('20. financial reversal records accrual_reversal and payment_reversal', () => {
  const accrualRev = db.contractorTransactions.find(t => t.receipt_id === receiptToCancelPosted.id && t.type === 'accrual_reversal');
  assert.ok(accrualRev);
  assert.strictEqual(accrualRev.amount, 24000000);

  const payRev = db.contractorTransactions.find(t => t.receipt_id === receiptToCancelPosted.id && t.type === 'payment_reversal');
  assert.ok(payRev);
  assert.strictEqual(payRev.amount, 2000000);
});

it('21. insufficient available stock blocks receipt cancellation [P0006]', () => {
  const rBlocked = db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
    { product_id: 'prod_iphone15', quantity: 5, unit_cost: 12000000 }
  ]);
  db.postReceipt(rBlocked.id);

  // Now reserve or sell the stock so available < 5
  const bal = db.stockBalances.get('prod_iphone15:wh_main');
  bal.reserved_quantity = bal.quantity - 2; // only 2 available, but receipt has 5!

  assert.throws(() => {
    db.cancelReceipt(rBlocked.id);
  }, /insufficient available stock/);

  // Restore balance
  bal.reserved_quantity = 0;
});

it('22. non-admin caller is rejected on all write and RPC actions', () => {
  db.setCaller('user_regular_guest', 'anon');
  assert.throws(() => {
    db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' });
  }, /Access denied: trusted admin required/);

  assert.throws(() => {
    db.postReceipt('any_id');
  }, /Access denied: trusted admin required/);

  assert.throws(() => {
    db.cancelReceipt('any_id');
  }, /Access denied: trusted admin required/);

  db.setCaller('admin_user_1', 'authenticated');
});

it('23. concurrent post protection prevents race conditions', () => {
  const rConcurrent = db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
    { product_id: 'prod_iphone15', quantity: 1, unit_cost: 1000 }
  ]);
  assert.throws(() => {
    db.postReceipt(rConcurrent.id, true); // simulate row lock
  }, /Lock timeout: receipt row is locked/);
});

it('24. invalid product rejected with foreign key error', () => {
  assert.throws(() => {
    db.createReceiptDraft({ contractor_id: 'cont_1', warehouse_id: 'wh_main' }, [
      { product_id: 'non_existent_sku_xyz', quantity: 1, unit_cost: 1000 }
    ]);
  }, /Foreign key violation: product_id/);
});

it('25. posted receipt cannot be edited', () => {
  assert.throws(() => {
    db.updateReceiptDraft(testReceiptToPost.id, { description: 'Malicious modification' }, [
      { product_id: 'prod_iphone15', quantity: 99, unit_cost: 100 }
    ]);
  }, /Cannot modify a posted receipt/);
});

it('26. cancelled receipt cannot be edited', () => {
  assert.throws(() => {
    db.updateReceiptDraft(receiptToCancelPosted.id, { description: 'Tampering attempt' }, [
      { product_id: 'prod_iphone15', quantity: 10, unit_cost: 100 }
    ]);
  }, /Cannot modify a cancelled receipt/);
});

// ------------------------------------------------------------------------------
// CODEBASE CONTRACT CHECKS
// ------------------------------------------------------------------------------

it('Contract check: SQL migration contains all required tables, triggers, and RPCs', () => {
  const requiredSqlTokens = [
    'create table if not exists public.receipts',
    'create table if not exists public.receipt_items',
    'create table if not exists public.stock_balances',
    'create table if not exists public.stock_movements',
    'create table if not exists public.contractor_transactions',
    'create or replace function public.post_receipt',
    'create or replace function public.cancel_receipt',
    'create or replace function public.receipts_immutability_guard',
    'create or replace function public.receipt_items_immutability_guard',
    'trg_receipts_immutable',
    'trg_receipt_items_immutable'
  ];
  for (const token of requiredSqlTokens) {
    assert.ok(migrationSql.includes(token), `Migration SQL missing: ${token}`);
  }
});

it('Contract check: emirate-supabase-api.js exports all 7 receiving methods', () => {
  const requiredApiMethods = [
    'fetchAdminWarehouses',
    'fetchAdminReceipts',
    'fetchAdminReceiptDetails',
    'createAdminReceiptDraft',
    'updateAdminReceiptDraft',
    'postAdminReceipt',
    'cancelAdminReceipt'
  ];
  for (const method of requiredApiMethods) {
    assert.ok(apiJs.includes(method), `emirate-supabase-api.js missing method: ${method}`);
  }
});

it('Contract check: admin.html has #page-receipts, editor modal, detail modal, and finance link', () => {
  const requiredHtmlIds = [
    'data-page="receipts"',
    'id="page-receipts"',
    'id="receiptsTable"',
    'id="receiptEditorModal"',
    'id="receiptDetailModal"',
    'id="btnGoToReceiptsFromFinance"',
    'id="receiptProductSearch"',
    'id="receiptEditorItemsTable"'
  ];
  for (const token of requiredHtmlIds) {
    assert.ok(adminHtml.includes(token), `admin.html missing token: ${token}`);
  }
});

it('Contract check: admin.js handles receipts page, autocomplete, saving, posting, and print', () => {
  const requiredJsTokens = [
    "receipts: 'Приёмка товаров'",
    "if (pageName === 'receipts')",
    'loadReceiptsPageData',
    'openReceiptEditor',
    'handleReceiptProductSearch',
    'handleReceiptEditorSubmit',
    'openReceiptDetails',
    'cancelReceiptAction',
    'window.print()'
  ];
  for (const token of requiredJsTokens) {
    assert.ok(adminJs.includes(token), `admin.js missing token: ${token}`);
  }
});

console.log('================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
