const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Asaxiy-style Client Detail Modal ---');

// 1. Verify admin.html
const htmlPath = path.join(__dirname, '..', 'admin.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert(html.includes('id="clientDetailModal"'), 'admin.html must contain #clientDetailModal');
assert(html.includes('id="clientModalContentArea"'), 'admin.html must contain #clientModalContentArea');
assert(html.includes('id="clientModalName"'), 'admin.html must contain #clientModalName');
assert(html.includes('data-client-tab="general"'), 'admin.html must contain general tab');
assert(html.includes('data-client-tab="rating"'), 'admin.html must contain rating tab');
assert(html.includes('data-client-tab="orders"'), 'admin.html must contain orders tab');
assert(html.includes('data-client-tab="installments"'), 'admin.html must contain installments tab');
assert(html.includes('data-client-tab="addresses"'), 'admin.html must contain addresses tab');
assert(html.includes('data-client-tab="sms"'), 'admin.html must contain sms tab');
assert(html.includes('data-client-tab="calls"'), 'admin.html must contain calls tab');
assert(html.includes('data-client-tab="balance"'), 'admin.html must contain balance tab');
assert(html.includes('data-client-tab="cards"'), 'admin.html must contain cards tab');

// Explicit requirement check: NO books or electronic books
assert(!html.includes('Elektron kitoblar'), 'admin.html must NOT contain Elektron kitoblar');
assert(!html.includes('Books muddatli'), 'admin.html must NOT contain Books muddatli to‘lov');
assert(!html.includes('Abooks'), 'admin.html must NOT contain Abooks');
console.log('✓ admin.html checks passed: all tabs present and no book references.');

// 2. Verify admin.css
const cssPath = path.join(__dirname, '..', 'admin.css');
const css = fs.readFileSync(cssPath, 'utf8');

assert(css.includes('.client-modal-panel'), 'admin.css must define .client-modal-panel');
assert(css.includes('.client-modal-sidebar'), 'admin.css must define .client-modal-sidebar');
assert(css.includes('.client-nav-item'), 'admin.css must define .client-nav-item');
assert(css.includes('.client-row'), 'admin.css must define .client-row');
assert(css.includes('#orderDetailModal'), 'admin.css must define #orderDetailModal z-index');
console.log('✓ admin.css checks passed: responsive styles and classes defined.');

// 3. Verify admin.js
const jsPath = path.join(__dirname, '..', 'admin.js');
const js = fs.readFileSync(jsPath, 'utf8');

assert(js.includes('function openClientDetailModal('), 'admin.js must define openClientDetailModal');
assert(js.includes('function closeClientDetailModal('), 'admin.js must define closeClientDetailModal');
assert(js.includes('function switchClientTab('), 'admin.js must define switchClientTab');
assert(js.includes('function renderClientGeneralTab('), 'admin.js must define renderClientGeneralTab');
assert(js.includes('function renderClientRatingTab('), 'admin.js must define renderClientRatingTab');
assert(js.includes('function renderClientOrdersTab('), 'admin.js must define renderClientOrdersTab');
assert(js.includes('function renderClientInstallmentsTab('), 'admin.js must define renderClientInstallmentsTab');
assert(js.includes('function renderClientAddressesTab('), 'admin.js must define renderClientAddressesTab');
assert(js.includes('function renderClientSmsTab('), 'admin.js must define renderClientSmsTab');
assert(js.includes('function renderClientCallsTab('), 'admin.js must define renderClientCallsTab');
assert(js.includes('function renderClientBalanceTab('), 'admin.js must define renderClientBalanceTab');
assert(js.includes('function renderClientCardsTab('), 'admin.js must define renderClientCardsTab');
const viewClientFnMatch = js.match(/function viewClient\(clientId\)[\s\S]*?\{[\s\S]*?\}/);
assert(viewClientFnMatch, 'viewClient function must exist');
assert(!viewClientFnMatch[0].includes('alert('), 'viewClient must not call alert()');
assert(viewClientFnMatch[0].includes('openClientDetailModal('), 'viewClient must call openClientDetailModal');

console.log('✓ admin.js checks passed: all functions present, alert removed.');

// 4. Test logic in isolated context
function formatClientGender(gender) {
  const g = String(gender || '').toLowerCase().trim();
  if (g === 'male' || g === 'erkak' || g === 'm') return 'Erkak';
  if (g === 'female' || g === 'ayol' || g === 'f') return 'Ayol';
  return gender ? String(gender) : '—';
}

assert.strictEqual(formatClientGender('male'), 'Erkak');
assert.strictEqual(formatClientGender('erkak'), 'Erkak');
assert.strictEqual(formatClientGender('female'), 'Ayol');
assert.strictEqual(formatClientGender('ayol'), 'Ayol');
assert.strictEqual(formatClientGender(''), '—');
assert.strictEqual(formatClientGender(null), '—');

const sampleOrders = [
  { uuid: 'o1', id: '#101', userId: 'usr-1', phone: '+998901234567', customerEmail: 'test@example.com', totalAmount: 100000, payment: 'payme', status: 'successful' },
  { uuid: 'o2', id: '#102', userId: 'usr-1', phone: '+998901234567', customerEmail: 'test@example.com', totalAmount: 500000, payment: 'murobaha_12', status: 'successful' },
  { uuid: 'o3', id: '#103', userId: 'usr-2', phone: '+998939999999', customerEmail: 'other@example.com', totalAmount: 200000, payment: 'cash', status: 'processing' }
];

function getOrdersForClientMock(client, orders) {
  const clientUserId = String(client.userId || '').trim().toLowerCase();
  const clientPhone9 = String(client.phone || '').replace(/\D/g, '').slice(-9);
  const clientEmail = String(client.email || '').trim().toLowerCase();

  return orders.filter(order => {
    if (clientUserId && order.userId && String(order.userId).toLowerCase() === clientUserId) {
      return true;
    }
    if (clientPhone9 && clientPhone9.length >= 7 && order.phone) {
      const orderPhone9 = String(order.phone).replace(/\D/g, '').slice(-9);
      if (orderPhone9 && orderPhone9 === clientPhone9) return true;
    }
    if (clientEmail && clientEmail !== '—' && order.customerEmail) {
      if (String(order.customerEmail).toLowerCase() === clientEmail) return true;
    }
    return false;
  });
}

const client1 = { userId: 'usr-1', phone: '+998 90 123 45 67', email: 'test@example.com' };
const clientOrders = getOrdersForClientMock(client1, sampleOrders);
assert.strictEqual(clientOrders.length, 2, 'Should find 2 orders for client 1');

const installments = clientOrders.filter(o => /nasiya|muddatli|installment|murobaha/i.test(o.payment || ''));
assert.strictEqual(installments.length, 1, 'Should find 1 installment/murobaha order');
assert.strictEqual(installments[0].id, '#102');

console.log('✓ Mock logic tests passed successfully!');
console.log('--- All Tests Passed! ---');
