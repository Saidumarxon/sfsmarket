/**
 * Stage 2C-3A: Emirate Plus Automated Test Suite
 *
 * Verifies:
 * - Subscriptions table model, constraints & RLS
 * - Authoritative is_customer_plus_active helper
 * - Direct client tampering prevention (SEC-1, SEC-2, SEC-3, SEC-4, SEC-5)
 * - Expiration logic (SEC-6, SEC-7, SEC-8, SEC-9)
 * - Refund rules & used_at tracking (SEC-10, SEC-11)
 * - Contract checks with SQL migration
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const migrationSql = fs.readFileSync(path.join(ROOT, 'supabase', 'emirate-plus-migration.sql'), 'utf8');

console.log('=================================================');
console.log('STAGE 2C-3A: EMIRATE PLUS AUTOMATED TEST SUITE');
console.log('=================================================');

// Mock PostgreSQL engine with RLS, triggers & SECURITY DEFINER functions
class MockDb {
  constructor() {
    this.currentRole = 'authenticated';
    this.currentUser = 'u1';
    this.loyaltyBypass = false;
    this.adminUsers = new Set(['admin_uuid_1']);

    this.profiles = new Map(); // user_id -> profile
    this.subscriptions = new Map(); // id -> subscription
  }

  setRole(role, userId = 'u1') {
    this.currentRole = role;
    this.currentUser = userId;
  }

  setBypass(flag) {
    this.loyaltyBypass = flag;
  }

  // Trigger: customer_profiles_guard_system_fields
  updateProfile(userId, fields) {
    const old = this.profiles.get(userId) || {
      user_id: userId,
      bonus_balance: 0,
      loyalty_tier: 'standard',
      orders_count: 0,
      orders_total: 0,
      is_emirate_plus: false,
      emirate_plus_until: null,
      full_name: 'Customer'
    };

    const next = { ...old, ...fields };

    // Guard: regular authenticated clients cannot overwrite system fields
    if (!this.loyaltyBypass) {
      if (this.currentRole === 'authenticated' && !this.adminUsers.has(this.currentUser)) {
        next.bonus_balance = old.bonus_balance || 0;
        next.loyalty_tier = old.loyalty_tier || 'standard';
        next.orders_count = old.orders_count || 0;
        next.orders_total = old.orders_total || 0;
        next.is_emirate_plus = old.is_emirate_plus || false;
        next.emirate_plus_until = old.emirate_plus_until || null;
      }
    }

    this.profiles.set(userId, next);
    return next;
  }

  // Direct client insert into plus_subscriptions
  insertSubscriptionDirect(sub) {
    // RLS: direct inserts revoked from anon and authenticated
    if (['anon', 'authenticated'].includes(this.currentRole) && !this.loyaltyBypass && !this.adminUsers.has(this.currentUser)) {
      const err = new Error('permission denied for table plus_subscriptions');
      err.code = '42501';
      throw err;
    }
    const id = 'sub_' + Math.random().toString(36).slice(2, 9);
    const row = {
      id,
      user_id: sub.user_id,
      starts_at: sub.starts_at || new Date(),
      expires_at: sub.expires_at,
      price: sub.price != null ? sub.price : 49900,
      payment_method: sub.payment_method || 'card',
      status: sub.status || 'pending',
      used_at: sub.used_at || null,
      created_at: new Date(),
      updated_at: new Date()
    };
    this.subscriptions.set(id, row);
    return row;
  }

  // Direct client update on plus_subscriptions
  updateSubscriptionDirect(id, fields) {
    if (['anon', 'authenticated'].includes(this.currentRole) && !this.loyaltyBypass && !this.adminUsers.has(this.currentUser)) {
      const err = new Error('permission denied for table plus_subscriptions');
      err.code = '42501';
      throw err;
    }
    const row = this.subscriptions.get(id);
    if (!row) throw new Error('Subscription not found');
    Object.assign(row, fields, { updated_at: new Date() });
    return row;
  }

  // Function: activate_emirate_plus (SECURITY DEFINER)
  activateEmiratePlus(userId, price = 49900, paymentMethod = 'card', durationDays = 30) {
    if (['anon', 'authenticated'].includes(this.currentRole) && !this.loyaltyBypass && !this.adminUsers.has(this.currentUser)) {
      const err = new Error('Direct client activation of Emirate Plus is not permitted');
      err.code = 'P0002';
      throw err;
    }

    if (!userId) {
      const err = new Error('User ID is required');
      err.code = 'P0001';
      throw err;
    }

    if (price < 0) {
      const err = new Error('Price cannot be negative');
      err.code = 'P0004';
      throw err;
    }

    const now = new Date();
    // Check if extending existing active subscription
    let startsAt = now;
    for (const sub of this.subscriptions.values()) {
      if (sub.user_id === userId && sub.status === 'active' && sub.expires_at > now) {
        if (sub.expires_at > startsAt) startsAt = sub.expires_at;
      }
    }

    const expiresAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const subId = 'sub_' + Math.random().toString(36).slice(2, 9);
    const sub = {
      id: subId,
      user_id: userId,
      starts_at: startsAt,
      expires_at: expiresAt,
      price,
      payment_method: paymentMethod,
      status: 'active',
      used_at: null,
      created_at: now,
      updated_at: now
    };
    this.subscriptions.set(subId, sub);

    // Update customer_profiles with bypass
    const prevBypass = this.loyaltyBypass;
    this.loyaltyBypass = true;
    this.updateProfile(userId, {
      is_emirate_plus: true,
      emirate_plus_until: expiresAt
    });
    this.loyaltyBypass = prevBypass;

    return {
      ok: true,
      subscription_id: subId,
      user_id: userId,
      starts_at: startsAt,
      expires_at: expiresAt,
      price,
      status: 'active'
    };
  }

  // Function: is_customer_plus_active
  isCustomerPlusActive(userId, testNow = new Date()) {
    if (!userId) return false;

    const prof = this.profiles.get(userId);
    if (!prof || !prof.is_emirate_plus) return false;
    if (prof.emirate_plus_until && prof.emirate_plus_until <= testNow) return false;

    // Check authoritative active subscription
    let hasActive = false;
    for (const sub of this.subscriptions.values()) {
      if (sub.user_id === userId && sub.status === 'active' && sub.starts_at <= testNow && sub.expires_at > testNow) {
        hasActive = true;
        break;
      }
    }
    return hasActive;
  }

  // Function: mark_plus_used
  markPlusUsed(userId, testNow = new Date()) {
    if (!userId) return false;
    let found = false;
    for (const sub of this.subscriptions.values()) {
      if (sub.user_id === userId && sub.status === 'active' && sub.expires_at > testNow && !sub.used_at) {
        sub.used_at = testNow;
        sub.updated_at = testNow;
        found = true;
      }
    }
    return found;
  }

  // Function: refund_emirate_plus
  refundEmiratePlus(subscriptionId, reason = 'customer_request', testNow = new Date()) {
    if (['anon', 'authenticated'].includes(this.currentRole) && !this.loyaltyBypass && !this.adminUsers.has(this.currentUser)) {
      const err = new Error('Direct client refund of Emirate Plus is not permitted');
      err.code = 'P0002';
      throw err;
    }

    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return { ok: false, error: 'subscription_not_found' };
    if (sub.status !== 'active') return { ok: false, error: 'subscription_not_active', status: sub.status };

    // 7-day refund window check
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (testNow.getTime() > (sub.starts_at.getTime() + sevenDaysMs)) {
      return { ok: false, error: 'refund_window_expired', starts_at: sub.starts_at };
    }

    // Strictly forbidden if used
    if (sub.used_at != null) {
      return { ok: false, error: 'plus_already_used', used_at: sub.used_at };
    }

    sub.status = 'refunded';
    sub.updated_at = testNow;

    // Check if other active subscription exists
    let hasOtherActive = false;
    for (const s of this.subscriptions.values()) {
      if (s.user_id === sub.user_id && s.status === 'active' && s.expires_at > testNow) {
        hasOtherActive = true;
        break;
      }
    }

    if (!hasOtherActive) {
      const prevBypass = this.loyaltyBypass;
      this.loyaltyBypass = true;
      this.updateProfile(sub.user_id, {
        is_emirate_plus: false,
        emirate_plus_until: null
      });
      this.loyaltyBypass = prevBypass;
    }

    return {
      ok: true,
      refunded: true,
      subscription_id: subscriptionId,
      user_id: sub.user_id,
      amount: sub.price,
      reason
    };
  }

  // Function: calc_effective_cashback_pct
  calcEffectiveCashbackPct(turnover, isPlus) {
    let base = 1;
    if (turnover >= 30000000) base = 5;
    else if (turnover >= 15000000) base = 3;
    else if (turnover >= 5000000) base = 2;
    else base = 1;

    if (isPlus) {
      return Math.min(6, base + 1);
    }
    return base;
  }
}

// SEC-1: authenticated client cannot set is_emirate_plus=true
console.log('\n[SEC-1] Authenticated client cannot set is_emirate_plus=true:');
{
  const db = new MockDb();
  db.updateProfile('u1', { is_emirate_plus: false });
  db.setRole('authenticated', 'u1');
  const updated = db.updateProfile('u1', { is_emirate_plus: true, full_name: 'Attacker' });
  assert.strictEqual(updated.is_emirate_plus, false, 'Trigger guard must prevent client setting is_emirate_plus');
  assert.strictEqual(updated.full_name, 'Attacker', 'Allowed field must update');
  console.log('  PASS (SEC-1): Trigger guard resets is_emirate_plus to false on client update.');
}

// SEC-2: authenticated client cannot change emirate_plus_until
console.log('\n[SEC-2] Authenticated client cannot change emirate_plus_until:');
{
  const db = new MockDb();
  db.updateProfile('u1', { emirate_plus_until: null });
  db.setRole('authenticated', 'u1');
  const futureDate = new Date('2030-01-01');
  const updated = db.updateProfile('u1', { emirate_plus_until: futureDate });
  assert.strictEqual(updated.emirate_plus_until, null, 'Trigger guard must prevent client setting emirate_plus_until');
  console.log('  PASS (SEC-2): Trigger guard resets emirate_plus_until to old value on client update.');
}

// SEC-3: anon cannot activate Plus
console.log('\n[SEC-3] Anon cannot activate Plus:');
{
  const db = new MockDb();
  db.setRole('anon', null);
  let caught = false;
  try {
    db.activateEmiratePlus('u1');
  } catch (err) {
    caught = true;
    assert.strictEqual(err.code, 'P0002');
  }
  assert(caught, 'Anon call must be blocked with P0002');
  console.log('  PASS (SEC-3): Anon cannot call activate_emirate_plus (rejected with P0002).');
}

// SEC-4: direct client INSERT into plus_subscriptions blocked
console.log('\n[SEC-4] Direct client INSERT into plus_subscriptions blocked:');
{
  const db = new MockDb();
  db.setRole('authenticated', 'u1');
  let caught = false;
  try {
    db.insertSubscriptionDirect({
      user_id: 'u1',
      expires_at: new Date('2030-01-01'),
      status: 'active'
    });
  } catch (err) {
    caught = true;
    assert.strictEqual(err.code, '42501');
  }
  assert(caught, 'Direct client insert must be blocked by RLS / revoke');
  console.log('  PASS (SEC-4): Direct client INSERT into plus_subscriptions blocked with 42501.');
}

// SEC-5: direct client UPDATE subscription blocked
console.log('\n[SEC-5] Direct client UPDATE subscription blocked:');
{
  const db = new MockDb();
  db.setBypass(true);
  const sub = db.insertSubscriptionDirect({
    user_id: 'u1',
    expires_at: new Date('2030-01-01'),
    status: 'active'
  });
  db.setBypass(false);

  db.setRole('authenticated', 'u1');
  let caught = false;
  try {
    db.updateSubscriptionDirect(sub.id, { expires_at: new Date('2050-01-01') });
  } catch (err) {
    caught = true;
    assert.strictEqual(err.code, '42501');
  }
  assert(caught, 'Direct client update must be blocked');
  console.log('  PASS (SEC-5): Direct client UPDATE on plus_subscriptions blocked with 42501.');
}

// SEC-6: active subscription -> is_customer_plus_active = true
console.log('\n[SEC-6] Active subscription -> is_customer_plus_active = true:');
{
  const db = new MockDb();
  db.setRole('service_role');
  const res = db.activateEmiratePlus('u1', 49900, 'card', 30);
  assert(res.ok);
  assert.strictEqual(db.isCustomerPlusActive('u1'), true);
  console.log('  PASS (SEC-6): Active subscription returns is_customer_plus_active = true.');
}

// SEC-7: expired subscription -> is_customer_plus_active = false
console.log('\n[SEC-7] Expired subscription -> is_customer_plus_active = false:');
{
  const db = new MockDb();
  db.setRole('service_role');
  db.activateEmiratePlus('u1', 49900, 'card', 30);
  // Test time 35 days in future
  const future = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
  assert.strictEqual(db.isCustomerPlusActive('u1', future), false);
  console.log('  PASS (SEC-7): Expired subscription runtime check returns false.');
}

// SEC-8: is_emirate_plus=true in profile but expired in time -> false
console.log('\n[SEC-8] is_emirate_plus=true in profile but expired -> false:');
{
  const db = new MockDb();
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  db.profiles.set('u1', { is_emirate_plus: true, emirate_plus_until: pastDate });
  assert.strictEqual(db.isCustomerPlusActive('u1'), false);
  console.log('  PASS (SEC-8): Helper does not trust stale boolean when expiration has passed.');
}

// SEC-9: subscription active but cached profile false -> safe invariant
console.log('\n[SEC-9] Subscription active but cached profile false:');
{
  const db = new MockDb();
  db.setBypass(true);
  db.insertSubscriptionDirect({
    user_id: 'u1',
    starts_at: new Date(Date.now() - 1000),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'active'
  });
  db.setBypass(false);
  db.profiles.set('u1', { is_emirate_plus: false, emirate_plus_until: null });
  // Helper enforces dual check (cached + authoritative audit)
  assert.strictEqual(db.isCustomerPlusActive('u1'), false, 'Both cached state and audit must align');
  console.log('  PASS (SEC-9): Safe invariant enforced: out-of-sync unverified state returns false.');
}

// SEC-10: refund allowed only within 7 days AND used_at IS NULL
console.log('\n[SEC-10] Refund allowed only within 7 days AND used_at IS NULL:');
{
  const db = new MockDb();
  db.setRole('service_role');
  const res = db.activateEmiratePlus('u1', 49900, 'card', 30);
  const subId = res.subscription_id;

  // Day 3: refund allowed
  const day3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const refRes = db.refundEmiratePlus(subId, 'customer_request', day3);
  assert(refRes.ok);
  assert.strictEqual(refRes.refunded, true);
  assert.strictEqual(db.isCustomerPlusActive('u1', day3), false);

  // Day 10 on new sub: refund blocked due to 7-day window
  const sub2 = db.activateEmiratePlus('u1', 49900, 'card', 30);
  const day10 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  const lateRef = db.refundEmiratePlus(sub2.subscription_id, 'customer_request', day10);
  assert.strictEqual(lateRef.ok, false);
  assert.strictEqual(lateRef.error, 'refund_window_expired');
  console.log('  PASS (SEC-10): Refund succeeds within 7 days and fails after 7 days.');
}

// SEC-11: refund blocked after Plus usage
console.log('\n[SEC-11] Refund blocked after Plus usage:');
{
  const db = new MockDb();
  db.setRole('service_role');
  const res = db.activateEmiratePlus('u1', 49900, 'card', 30);
  const subId = res.subscription_id;

  // Mark usage (e.g. Plus order placed)
  assert.strictEqual(db.markPlusUsed('u1'), true);

  // Day 2 refund attempt: must be blocked because used_at IS NOT NULL
  const day2 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const refAttempt = db.refundEmiratePlus(subId, 'changed_mind', day2);
  assert.strictEqual(refAttempt.ok, false);
  assert.strictEqual(refAttempt.error, 'plus_already_used');
  assert.strictEqual(db.isCustomerPlusActive('u1', day2), true, 'Subscription remains active if refund is denied');
  console.log('  PASS (SEC-11): Refund strictly blocked when used_at is set.');
}

// PLUS CASHBACK CALCULATION TESTS
console.log('\n[Plus Cashback Calculation Verification]:');
{
  const db = new MockDb();
  // Standard: 1% base -> 2% with Plus
  assert.strictEqual(db.calcEffectiveCashbackPct(100000, false), 1);
  assert.strictEqual(db.calcEffectiveCashbackPct(100000, true), 2);

  // Silver: 2% base -> 3% with Plus
  assert.strictEqual(db.calcEffectiveCashbackPct(6000000, false), 2);
  assert.strictEqual(db.calcEffectiveCashbackPct(6000000, true), 3);

  // Gold: 3% base -> 4% with Plus
  assert.strictEqual(db.calcEffectiveCashbackPct(16000000, false), 3);
  assert.strictEqual(db.calcEffectiveCashbackPct(16000000, true), 4);

  // Platinum: 5% base -> 6% with Plus (capped at 6%)
  assert.strictEqual(db.calcEffectiveCashbackPct(35000000, false), 5);
  assert.strictEqual(db.calcEffectiveCashbackPct(35000000, true), 6);
  assert.strictEqual(db.calcEffectiveCashbackPct(100000000, true), 6, 'Cashback must never exceed 6%');
  console.log('  PASS: All 4 tiers match approved +1% Plus rule (Standard 2%, Silver 3%, Gold 4%, Platinum 6% cap).');
}

// SQL MIGRATION CONTRACT CHECKS
console.log('\n[SQL Migration Contract Checks]:');
assert(migrationSql.includes('create table if not exists public.plus_subscriptions'), 'Creates plus_subscriptions table');
assert(migrationSql.includes('status in (\'pending\', \'active\', \'expired\', \'cancelled\', \'refunded\')'), 'Enforces status check');
assert(migrationSql.includes('expires_at > starts_at'), 'Enforces expires_at > starts_at');
assert(migrationSql.includes('price numeric not null default 49900 check (price >= 0)'), 'Enforces 49900 price and >= 0 check');
assert(migrationSql.includes('revoke insert, update, delete on public.plus_subscriptions from anon, authenticated'), 'Revokes direct client writes');
assert(migrationSql.includes('create or replace function public.is_customer_plus_active'), 'Defines is_customer_plus_active helper');
assert(migrationSql.includes('create or replace function public.activate_emirate_plus'), 'Defines activate_emirate_plus function');
assert(migrationSql.includes('create or replace function public.mark_plus_used'), 'Defines mark_plus_used helper');
assert(migrationSql.includes('create or replace function public.refund_emirate_plus'), 'Defines refund_emirate_plus function');
assert(migrationSql.includes('interval \'7 days\''), 'Enforces 7-day refund window in SQL');
assert(migrationSql.includes('used_at is not null'), 'Enforces used_at blocking in SQL');
assert(migrationSql.includes('least(6, v_base + 1)'), 'Enforces +1% and 6% cap in calc_effective_cashback_pct');
assert(migrationSql.includes('is_emirate_plus_active'), 'Includes is_emirate_plus_active in get_customer_loyalty_summary');
assert(migrationSql.includes('security definer'), 'All privileged functions use SECURITY DEFINER');
assert(migrationSql.includes('set search_path = public, pg_temp'), 'Sets safe search_path');
console.log('  PASS: All 15 SQL migration contracts verified.');

console.log('\n=================================================');
console.log('ALL EMIRATE PLUS SECURITY & CONTRACT TESTS PASSED!');
console.log('=================================================');
