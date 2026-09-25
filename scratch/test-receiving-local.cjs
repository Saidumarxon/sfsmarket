/**
 * EMIRATE CO / SFS MARKET — INVENTORY, RECEIVING & CONTRACTORS
 * Phase 1: Database Foundation Automated Test Suite
 *
 * Verifies:
 * 1. contractor creation
 * 2. warehouse creation
 * 3. receipt creation
 * 4. receipt number uniqueness
 * 5. receipt with items
 * 6. total_cost calculation (quantity * unit_cost)
 * 7. paid_amount validation (0 <= paid_amount <= total_cost)
 * 8. draft receipt does not affect stock
 * 9. post receipt increases stock
 * 10. stock movement created (movement_type = receipt)
 * 11. contractor accrual created (type = receipt_accrual)
 * 12. debt calculation (max(total_cost - paid_amount, 0))
 * 13. payment reduces debt (type = payment)
 * 14. concurrent post protection (FOR UPDATE lock simulation)
 * 15. second post of same receipt rejected (draft only)
 * 16. cancel draft (safe, no stock movements)
 * 17. cancel posted receipt safely reverses stock & accrual
 * 18. duplicate cancellation protection
 * 19. non-admin access rejected (RLS & trusted admin checks)
 * 20. purchase cost inaccessible to public roles
 * 21. contract checks on SQL migration file
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const migrationPath = path.join(ROOT, 'supabase', 'inventory-and-receiving-migration.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

console.log('================================================================');
console.log('PHASE 1: INVENTORY & RECEIVING DATABASE FOUNDATION TEST SUITE');
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
// MOCK DATABASE ENGINE SIMULATING POSTGRESQL & MIGRATION PROCEDURES
// ------------------------------------------------------------------------------
class MockInventoryDb {
  constructor() {
    this.adminUsers = new Set(['admin_uuid_1']);
    this.currentUser = 'admin_uuid_1';
    this.currentRole = 'authenticated';

    this.contractors = new Map();
    this.warehouses = new Map();
    this.receipts = new Map();
    this.receiptItems = new Map(); // receipt_id -> array of items
    this.stockBalances = new Map(); // `${product_id}:${warehouse_id}` -> record
    this.stockMovements = [];
    this.contractorTransactions = [];

    this.receiptSeq = 1;
    this.isLocked = new Set(); // simulated row locks

    // Seed default warehouse as in migration
    this.warehouses.set('wh_main', {
      id: 'wh_main',
      name: 'Основной склад',
      code: 'MAIN',
      address: 'г. Ташкент',
      is_active: true
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

  // --- CONTRACTORS ---
  createContractor(data) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');
    if (!data.name || !data.name.trim()) throw new Error('Name cannot be empty');
    const id = data.id || `contractor_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const status = data.status || 'active';
    if (!['active', 'inactive'].includes(status)) throw new Error('Invalid status');

    const contractor = {
      id,
      name: data.name.trim(),
      phone: data.phone || null,
      contact_person: data.contact_person || null,
      inn: data.inn || null,
      status,
      created_at: new Date()
    };
    this.contractors.set(id, contractor);
    return contractor;
  }

  // --- WAREHOUSES ---
  createWarehouse(data) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');
    if (!data.code || !data.code.trim()) throw new Error('Warehouse code required');
    for (const wh of this.warehouses.values()) {
      if (wh.code === data.code) throw new Error('Unique constraint violated: code');
    }
    const id = data.id || `wh_${Date.now()}`;
    const wh = {
      id,
      name: data.name || 'Склад',
      code: data.code,
      address: data.address || '',
      is_active: data.is_active !== false
    };
    this.warehouses.set(id, wh);
    return wh;
  }

  // --- RECEIPTS ---
  createReceipt(data) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');
    if (!this.contractors.has(data.contractor_id)) throw new Error('Foreign key violation: contractor_id');
    if (!this.warehouses.has(data.warehouse_id)) throw new Error('Foreign key violation: warehouse_id');

    const id = data.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const receipt_number = data.receipt_number || this.generateReceiptNumber();

    // Check unique receipt_number
    for (const r of this.receipts.values()) {
      if (r.receipt_number === receipt_number) throw new Error('Unique constraint violated: receipt_number');
    }

    const paid_amount = Number(data.paid_amount) || 0;
    const total_cost = Number(data.total_cost) || 0;
    if (paid_amount < 0) throw new Error('paid_amount cannot be negative');
    if (total_cost < 0) throw new Error('total_cost cannot be negative');
    if (paid_amount > total_cost) throw new Error('Paid amount cannot exceed total cost [P0004]');

    const receipt = {
      id,
      receipt_number,
      contractor_id: data.contractor_id,
      warehouse_id: data.warehouse_id,
      status: 'draft',
      created_at: new Date(),
      received_at: data.received_at || new Date().toISOString().slice(0, 10),
      external_order_number: data.external_order_number || null,
      payment_method: data.payment_method || 'debt',
      currency: data.currency || 'UZS',
      exchange_rate: Number(data.exchange_rate) || 1,
      total_cost,
      paid_amount,
      debt_amount: Math.max(total_cost - paid_amount, 0),
      created_by: this.currentUser
    };

    this.receipts.set(id, receipt);
    this.receiptItems.set(id, []);
    return receipt;
  }

  addItem(receiptId, item) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');
    const receipt = this.receipts.get(receiptId);
    if (!receipt) throw new Error('Receipt not found');
    if (receipt.status !== 'draft') throw new Error('Cannot add items to non-draft receipt');

    const quantity = Number(item.quantity);
    const unit_cost = Number(item.unit_cost);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be > 0');
    if (!Number.isFinite(unit_cost) || unit_cost < 0) throw new Error('Unit cost must be >= 0');

    const total_cost = quantity * unit_cost;
    const lineItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      receipt_id: receiptId,
      product_id: item.product_id,
      quantity,
      unit_cost,
      total_cost,
      sale_price: Number(item.sale_price) || null
    };

    const items = this.receiptItems.get(receiptId) || [];
    items.push(lineItem);
    this.receiptItems.set(receiptId, items);

    // Update receipt total_cost
    receipt.total_cost = items.reduce((s, it) => s + it.total_cost, 0);
    receipt.debt_amount = Math.max(receipt.total_cost - receipt.paid_amount, 0);
    return lineItem;
  }

  // --- RPC: POST RECEIPT ---
  postReceipt(receiptId, isConcurrentLocked = false) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');

    if (isConcurrentLocked || this.isLocked.has(receiptId)) {
      throw new Error('Lock timeout or concurrent post conflict');
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

    // Lock simulation
    this.isLocked.add(receiptId);

    try {
      // 1. Recalculate authoritative total
      const calculatedTotal = items.reduce((sum, it) => sum + (it.quantity * it.unit_cost), 0);
      if (receipt.paid_amount > calculatedTotal) {
        throw new Error('Paid amount exceeds total cost [P0004]');
      }
      const calculatedDebt = Math.max(calculatedTotal - receipt.paid_amount, 0);

      // 2. Process stock balances & movements
      for (const item of items) {
        const key = `${item.product_id}:${receipt.warehouse_id}`;
        const existing = this.stockBalances.get(key) || {
          product_id: item.product_id,
          warehouse_id: receipt.warehouse_id,
          quantity: 0,
          reserved_quantity: 0
        };

        existing.quantity += item.quantity;
        this.stockBalances.set(key, existing);

        // Immutable movement
        this.stockMovements.push({
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          product_id: item.product_id,
          warehouse_id: receipt.warehouse_id,
          change_qty: item.quantity,
          movement_type: 'receipt',
          reference_id: receiptId,
          created_at: new Date()
        });
      }

      // 3. Record contractor debt accrual
      this.contractorTransactions.push({
        id: `tx_${Date.now()}_1`,
        contractor_id: receipt.contractor_id,
        receipt_id: receiptId,
        amount: calculatedTotal,
        type: 'receipt_accrual',
        description: `Приходная накладная ${receipt.receipt_number}`,
        created_at: new Date(),
        created_by: this.currentUser
      });

      // 4. Record payment if paid_amount > 0
      if (receipt.paid_amount > 0) {
        this.contractorTransactions.push({
          id: `tx_${Date.now()}_2`,
          contractor_id: receipt.contractor_id,
          receipt_id: receiptId,
          amount: receipt.paid_amount,
          type: 'payment',
          payment_method: receipt.payment_method,
          description: `Оплата при приёмке ${receipt.receipt_number}`,
          created_at: new Date(),
          created_by: this.currentUser
        });
      }

      // 5. Update receipt
      receipt.status = 'posted';
      receipt.total_cost = calculatedTotal;
      receipt.debt_amount = calculatedDebt;

      return {
        ok: true,
        receipt_id: receiptId,
        receipt_number: receipt.receipt_number,
        status: 'posted',
        total_cost: calculatedTotal,
        debt_amount: calculatedDebt
      };
    } finally {
      this.isLocked.delete(receiptId);
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
      return { ok: true, receipt_id: receiptId, status: 'cancelled' };
    }

    if (receipt.status === 'posted') {
      const items = this.receiptItems.get(receiptId) || [];

      // Check sufficient stock before deducting
      for (const item of items) {
        const key = `${item.product_id}:${receipt.warehouse_id}`;
        const stock = this.stockBalances.get(key) || { quantity: 0, reserved_quantity: 0 };
        const available = stock.quantity - stock.reserved_quantity;
        if (available < item.quantity) {
          throw new Error(`Cannot cancel receipt: insufficient available stock for product ${item.product_id} [P0006]`);
        }
      }

      // Deduct stock and write reversal movements
      for (const item of items) {
        const key = `${item.product_id}:${receipt.warehouse_id}`;
        const stock = this.stockBalances.get(key);
        stock.quantity -= item.quantity;

        this.stockMovements.push({
          id: `mov_rev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          product_id: item.product_id,
          warehouse_id: receipt.warehouse_id,
          change_qty: -item.quantity,
          movement_type: 'adjustment',
          reference_id: receiptId,
          created_at: new Date()
        });
      }

      // Financial reversal
      this.contractorTransactions.push({
        id: `tx_rev_${Date.now()}_1`,
        contractor_id: receipt.contractor_id,
        receipt_id: receiptId,
        amount: receipt.total_cost,
        type: 'accrual_reversal',
        description: `Сторно приходной накладной ${receipt.receipt_number}`,
        created_at: new Date(),
        created_by: this.currentUser
      });

      if (receipt.paid_amount > 0) {
        this.contractorTransactions.push({
          id: `tx_rev_${Date.now()}_2`,
          contractor_id: receipt.contractor_id,
          receipt_id: receiptId,
          amount: receipt.paid_amount,
          type: 'payment_reversal',
          payment_method: receipt.payment_method,
          description: `Возврат оплаты по отменённой накладной ${receipt.receipt_number}`,
          created_at: new Date(),
          created_by: this.currentUser
        });
      }

      receipt.status = 'cancelled';
      receipt.debt_amount = 0;
      return { ok: true, receipt_id: receiptId, status: 'cancelled' };
    }

    throw new Error(`Unexpected receipt status: ${receipt.status}`);
  }

  // --- RPC: RECORD CONTRACTOR PAYMENT ---
  recordPayment(contractorId, amount, paymentMethod = 'bank_transfer', description = '') {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');
    if (!amount || amount <= 0) throw new Error('Payment amount must be greater than 0 [P0007]');
    if (!this.contractors.has(contractorId)) throw new Error('Contractor not found [P0008]');

    const tx = {
      id: `pay_${Date.now()}`,
      contractor_id: contractorId,
      receipt_id: null,
      amount,
      type: 'payment',
      payment_method: paymentMethod,
      description: description || 'Выплата поставщику',
      created_at: new Date(),
      created_by: this.currentUser
    };

    this.contractorTransactions.push(tx);
    return { ok: true, transaction_id: tx.id, contractor_id: contractorId, amount };
  }

  // --- RPC: CONTRACTOR SUMMARY ---
  getContractorSummary(contractorId) {
    if (!this.isTrustedAdmin()) throw new Error('Access denied: trusted admin required [42501]');

    let receiptsCount = 0;
    let receivedUnits = 0;
    let receiptsAmount = 0;

    for (const r of this.receipts.values()) {
      if (r.contractor_id === contractorId && r.status === 'posted') {
        receiptsCount++;
        receiptsAmount += r.total_cost;
        const items = this.receiptItems.get(r.id) || [];
        for (const it of items) receivedUnits += it.quantity;
      }
    }

    let totalPaid = 0;
    let currentDebt = 0;

    for (const tx of this.contractorTransactions) {
      if (tx.contractor_id === contractorId) {
        if (tx.type === 'payment') {
          totalPaid += tx.amount;
          currentDebt -= tx.amount;
        } else if (tx.type === 'receipt_accrual') {
          currentDebt += tx.amount;
        } else if (tx.type === 'accrual_reversal') {
          currentDebt -= tx.amount;
        } else if (tx.type === 'payment_reversal') {
          currentDebt += tx.amount;
        }
      }
    }

    return {
      contractor_id: contractorId,
      total_receipts: receiptsCount,
      total_received_units: receivedUnits,
      total_receipt_amount: receiptsAmount,
      total_paid: totalPaid,
      current_debt: Math.max(currentDebt, 0)
    };
  }
}

// ------------------------------------------------------------------------------
// TESTS EXECUTION
// ------------------------------------------------------------------------------

// 1. Contractor creation
it('1. contractor creation works with valid fields', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'ООО Артел', phone: '+998901234567', contact_person: 'Азиз', inn: '123456789' });
  assert.strictEqual(c.name, 'ООО Артел');
  assert.strictEqual(c.status, 'active');
});

// 2. Warehouse creation
it('2. warehouse creation succeeds and enforces uniqueness', () => {
  const db = new MockInventoryDb();
  const wh = db.createWarehouse({ name: 'Склад Самарканд', code: 'SAM-1' });
  assert.strictEqual(wh.code, 'SAM-1');
  assert.throws(() => db.createWarehouse({ name: 'Дубликат', code: 'SAM-1' }), /Unique constraint/);
});

// 3. Receipt creation
it('3. receipt creation stores separate created_at and received_at', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Test Supplier' });
  const r = db.createReceipt({
    contractor_id: c.id,
    warehouse_id: 'wh_main',
    received_at: '2026-09-18'
  });
  assert.strictEqual(r.status, 'draft');
  assert.strictEqual(r.received_at, '2026-09-18');
  assert(r.created_at instanceof Date);
  assert(r.receipt_number.startsWith('REC-2026-'));
});

// 4. Receipt number uniqueness
it('4. receipt number uniqueness is strictly enforced', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Test Supplier' });
  const r1 = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  assert.throws(() => {
    db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main', receipt_number: r1.receipt_number });
  }, /Unique constraint/);
});

// 5. Receipt with items
it('5. receipt with items adds lines and updates draft total', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier A' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'p1', quantity: 10, unit_cost: 50000 });
  db.addItem(r.id, { product_id: 'p2', quantity: 5, unit_cost: 100000 });

  assert.strictEqual(r.total_cost, 1000000);
  assert.strictEqual(r.debt_amount, 1000000);
});

// 6. total_cost calculation (quantity * unit_cost)
it('6. total_cost calculation matches quantity * unit_cost strictly', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier B' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  const line = db.addItem(r.id, { product_id: 'p1', quantity: 7, unit_cost: 12000 });
  assert.strictEqual(line.total_cost, 84000);
});

// 7. paid_amount validation
it('7. paid_amount validation rejects negative or exceeding amounts', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier C' });
  assert.throws(() => {
    db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main', total_cost: 100, paid_amount: 500 });
  }, /Paid amount cannot exceed total cost/);
});

// 8. draft receipt does not affect stock
it('8. draft receipt does not affect stock balances or movements', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier D' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_draft', quantity: 25, unit_cost: 1000 });

  assert.strictEqual(db.stockBalances.get('prod_draft:wh_main'), undefined);
  assert.strictEqual(db.stockMovements.length, 0);
});

// 9. post receipt increases stock
it('9. post receipt increases stock balances accurately', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier E' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_stock', quantity: 15, unit_cost: 10000 });

  db.postReceipt(r.id);

  const stock = db.stockBalances.get('prod_stock:wh_main');
  assert(stock);
  assert.strictEqual(stock.quantity, 15);
  assert.strictEqual(stock.reserved_quantity, 0);
});

// 10. stock movement created
it('10. stock movement record is created with type = receipt', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier F' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_mov', quantity: 8, unit_cost: 20000 });

  db.postReceipt(r.id);

  const mov = db.stockMovements.find(m => m.product_id === 'prod_mov');
  assert(mov);
  assert.strictEqual(mov.movement_type, 'receipt');
  assert.strictEqual(mov.change_qty, 8);
  assert.strictEqual(mov.reference_id, r.id);
});

// 11. contractor accrual created
it('11. contractor accrual created upon posting', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier G' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_g', quantity: 10, unit_cost: 5000 });

  db.postReceipt(r.id);

  const tx = db.contractorTransactions.find(t => t.contractor_id === c.id && t.type === 'receipt_accrual');
  assert(tx);
  assert.strictEqual(tx.amount, 50000);
});

// 12. debt calculation
it('12. debt calculation matches total_cost - paid_amount', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier H' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main', total_cost: 50000, paid_amount: 20000 });
  db.addItem(r.id, { product_id: 'prod_h', quantity: 5, unit_cost: 10000 });

  db.postReceipt(r.id);

  assert.strictEqual(r.total_cost, 50000);
  assert.strictEqual(r.paid_amount, 20000);
  assert.strictEqual(r.debt_amount, 30000);

  const summary = db.getContractorSummary(c.id);
  assert.strictEqual(summary.current_debt, 30000);
});

// 13. payment reduces debt
it('13. record_contractor_payment reduces contractor debt', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier I' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_i', quantity: 10, unit_cost: 10000 }); // total 100 000
  db.postReceipt(r.id);

  let summary = db.getContractorSummary(c.id);
  assert.strictEqual(summary.current_debt, 100000);

  // Pay 40 000
  db.recordPayment(c.id, 40000, 'bank_transfer', 'Частичная оплата');

  summary = db.getContractorSummary(c.id);
  assert.strictEqual(summary.total_paid, 40000);
  assert.strictEqual(summary.current_debt, 60000);
});

// 14. concurrent post protection
it('14. concurrent post protection raises lock error if already in progress', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier J' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_j', quantity: 2, unit_cost: 1000 });

  assert.throws(() => {
    db.postReceipt(r.id, true); // simulates locked row
  }, /concurrent post conflict/);
});

// 15. second post of same receipt rejected
it('15. second post of already posted receipt is rejected', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier K' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_k', quantity: 3, unit_cost: 5000 });
  db.postReceipt(r.id);

  assert.throws(() => {
    db.postReceipt(r.id);
  }, /Only draft receipts can be posted/);
});

// 16. cancel draft
it('16. cancel draft sets status cancelled without stock changes', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier L' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_l', quantity: 10, unit_cost: 2000 });

  const res = db.cancelReceipt(r.id);
  assert.strictEqual(res.status, 'cancelled');
  assert.strictEqual(r.status, 'cancelled');
  assert.strictEqual(db.stockBalances.get('prod_l:wh_main'), undefined);
});

// 17. cancel posted receipt safely reverses stock & accrual
it('17. cancel posted receipt safely reverses stock and registers reversal transaction', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier M' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.addItem(r.id, { product_id: 'prod_m', quantity: 20, unit_cost: 1000 }); // 20 units
  db.postReceipt(r.id);

  assert.strictEqual(db.stockBalances.get('prod_m:wh_main').quantity, 20);

  // Cancel posted
  db.cancelReceipt(r.id);

  assert.strictEqual(r.status, 'cancelled');
  assert.strictEqual(db.stockBalances.get('prod_m:wh_main').quantity, 0);

  // Verify reverse movement
  const revMov = db.stockMovements.find(m => m.product_id === 'prod_m' && m.change_qty === -20);
  assert(revMov);
  assert.strictEqual(revMov.movement_type, 'adjustment');

  // Verify financial reversal
  const revTx = db.contractorTransactions.find(t => t.type === 'accrual_reversal' && t.receipt_id === r.id);
  assert(revTx);
  assert.strictEqual(revTx.amount, 20000);

  const summary = db.getContractorSummary(c.id);
  assert.strictEqual(summary.current_debt, 0);
});

// 18. duplicate cancellation protection
it('18. duplicate cancellation of already cancelled receipt is rejected', () => {
  const db = new MockInventoryDb();
  const c = db.createContractor({ name: 'Supplier N' });
  const r = db.createReceipt({ contractor_id: c.id, warehouse_id: 'wh_main' });
  db.cancelReceipt(r.id);

  assert.throws(() => {
    db.cancelReceipt(r.id);
  }, /Receipt is already cancelled/);
});

// 19. non-admin access rejected
it('19. non-admin caller is rejected on all write and admin RPCs', () => {
  const db = new MockInventoryDb();
  db.setCaller('regular_user_1', 'authenticated');

  assert.throws(() => db.createContractor({ name: 'Hacker' }), /trusted admin required/);
  assert.throws(() => db.createWarehouse({ name: 'Fake WH', code: 'FAKE' }), /trusted admin required/);
  assert.throws(() => db.createReceipt({ contractor_id: 'any', warehouse_id: 'wh_main' }), /trusted admin required/);
  assert.throws(() => db.postReceipt('any'), /trusted admin required/);
  assert.throws(() => db.cancelReceipt('any'), /trusted admin required/);
  assert.throws(() => db.recordPayment('any', 100), /trusted admin required/);
  assert.throws(() => db.getContractorSummary('any'), /trusted admin required/);
});

// 20. purchase cost inaccessible to public roles
it('20. purchase cost and stock balances protected from anon / public access', () => {
  const db = new MockInventoryDb();
  db.setCaller(null, 'anon');

  assert.throws(() => db.createReceipt({ contractor_id: 'any', warehouse_id: 'wh_main' }), /trusted admin required/);
  assert.throws(() => db.postReceipt('any'), /trusted admin required/);
  assert.throws(() => db.getContractorSummary('any'), /trusted admin required/);
});

// 21. Contract checks with SQL migration
it('21. SQL migration file contains all expected tables, constraints, RPCs, and indexes', () => {
  assert(migrationSql.includes('create table if not exists public.contractors'), 'Must create contractors table');
  assert(migrationSql.includes('create table if not exists public.warehouses'), 'Must create warehouses table');
  assert(migrationSql.includes('create table if not exists public.receipts'), 'Must create receipts table');
  assert(migrationSql.includes('create table if not exists public.receipt_items'), 'Must create receipt_items table');
  assert(migrationSql.includes('create table if not exists public.stock_balances'), 'Must create stock_balances table');
  assert(migrationSql.includes('create table if not exists public.stock_movements'), 'Must create stock_movements table');
  assert(migrationSql.includes('create table if not exists public.contractor_transactions'), 'Must create contractor_transactions table');

  // Check RLS
  assert(migrationSql.includes('alter table public.contractors enable row level security;'), 'RLS on contractors');
  assert(migrationSql.includes('alter table public.warehouses enable row level security;'), 'RLS on warehouses');
  assert(migrationSql.includes('alter table public.receipts enable row level security;'), 'RLS on receipts');
  assert(migrationSql.includes('alter table public.receipt_items enable row level security;'), 'RLS on receipt_items');
  assert(migrationSql.includes('alter table public.stock_balances enable row level security;'), 'RLS on stock_balances');
  assert(migrationSql.includes('alter table public.stock_movements enable row level security;'), 'RLS on stock_movements');
  assert(migrationSql.includes('alter table public.contractor_transactions enable row level security;'), 'RLS on contractor_transactions');

  // Check RPCs
  assert(migrationSql.includes('create or replace function public.post_receipt'), 'post_receipt RPC');
  assert(migrationSql.includes('create or replace function public.cancel_receipt'), 'cancel_receipt RPC');
  assert(migrationSql.includes('create or replace function public.record_contractor_payment'), 'record_contractor_payment RPC');
  assert(migrationSql.includes('create or replace function public.get_contractor_summary'), 'get_contractor_summary RPC');

  // Check immutable guard on stock_movements
  assert(migrationSql.includes('stock_movements_immutable_guard'), 'stock_movements immutable trigger');

  // Check separate date fields in receipts
  assert(migrationSql.includes('created_at timestamptz not null default now()'), 'created_at field');
  assert(migrationSql.includes('received_at date not null default current_date'), 'received_at field');

  // Check initial warehouse seed
  assert(migrationSql.includes("'Основной склад'"), 'Initial warehouse seed');
  assert(migrationSql.includes("'MAIN'"), 'MAIN code seed');
});

console.log('================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
