import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  [PASS] ' + message);
    passed++;
  } else {
    console.error('  [FAIL] ' + message);
    failed++;
  }
}

console.log('\n--- 1. Verifying supabase/customer-addresses-migration.sql ---');
const migrationSql = fs.readFileSync(path.resolve('supabase/customer-addresses-migration.sql'), 'utf-8');
assert(migrationSql.includes('create table if not exists public.customer_addresses'), 'Creates customer_addresses table idempotently');
assert(migrationSql.includes('user_id uuid not null references auth.users(id)'), 'Foreign key to auth.users(id)');
assert(migrationSql.includes('customer_addresses_user_default_uidx') && migrationSql.includes('(is_default = true)'), 'Unique partial index enforces max 1 default address per user');
assert(migrationSql.includes('trg_customer_addresses_default'), 'Default address trigger defined');
assert(migrationSql.includes('alter table public.customer_addresses enable row level security'), 'RLS enabled');
assert(migrationSql.includes('auth.uid() = user_id'), 'RLS checks auth.uid() = user_id');
assert(migrationSql.includes('drop policy if exists "addresses customer read own"'), 'Idempotent select policy');
assert(migrationSql.includes('drop policy if exists "addresses customer insert own"'), 'Idempotent insert policy');
assert(migrationSql.includes('drop policy if exists "addresses customer update own"'), 'Idempotent update policy');
assert(migrationSql.includes('drop policy if exists "addresses customer delete own"'), 'Idempotent delete policy');

console.log('\n--- 2. Verifying emirate-auth.js address methods ---');
const authJs = fs.readFileSync(path.resolve('emirate-auth.js'), 'utf-8');
assert(authJs.includes('loadCustomerAddresses'), 'Exports loadCustomerAddresses');
assert(authJs.includes('saveCustomerAddress'), 'Exports saveCustomerAddress');
assert(authJs.includes('deleteCustomerAddress'), 'Exports deleteCustomerAddress');
assert(authJs.includes('setDefaultCustomerAddress'), 'Exports setDefaultCustomerAddress');
assert(authJs.includes('if (!city || !street)'), 'Validates required city and street_address fields');
assert(authJs.includes('.update({ is_default: false })'), 'Resets previous default addresses when new default is set');

console.log('\n--- 3. Verifying login.html Address Book UI ---');
const loginHtml = fs.readFileSync(path.resolve('login.html'), 'utf-8');
assert(loginHtml.includes('id="profileAddressesView"'), 'Contains #profileAddressesView container');
assert(loginHtml.includes('id="profileAddressesBack"'), 'Contains #profileAddressesBack button');
assert(loginHtml.includes('id="profileAddAddressBtn"'), 'Contains #profileAddAddressBtn button');
assert(loginHtml.includes('id="profileAddressesLoading"'), 'Contains #profileAddressesLoading state');
assert(loginHtml.includes('id="profileAddressesEmpty"'), 'Contains #profileAddressesEmpty state');
assert(loginHtml.includes('id="profileAddressesList"'), 'Contains #profileAddressesList grid');
assert(loginHtml.includes('id="profileAddressCount"'), 'Contains #profileAddressCount stat counter');
assert(loginHtml.includes('id="addressModal"'), 'Contains #addressModal dialog');
assert(loginHtml.includes('id="addressForm"'), 'Contains #addressForm form');
assert(loginHtml.includes('id="addressFormCity"'), 'Contains #addressFormCity input');
assert(loginHtml.includes('id="addressFormStreet"'), 'Contains #addressFormStreet input');
assert(loginHtml.includes('id="addressFormApartment"'), 'Contains #addressFormApartment input');
assert(loginHtml.includes('id="addressFormRegion"'), 'Contains #addressFormRegion input');
assert(loginHtml.includes('id="addressFormIsDefault"'), 'Contains #addressFormIsDefault checkbox');
assert(loginHtml.includes('data-profile-nav="addresses"'), 'Contains sidebar navigation link for addresses');
assert(loginHtml.includes('switchProfileTab("addresses")'), 'JS supports switching to addresses tab');
assert(loginHtml.includes('renderCustomerAddresses()'), 'JS contains renderCustomerAddresses function');
assert(loginHtml.includes('openAddressModal'), 'JS contains openAddressModal function');
assert(loginHtml.includes('closeAddressModal'), 'JS contains closeAddressModal function');

console.log('\n--- 4. Verifying checkout.html and checkout.js integration ---');
const checkoutHtml = fs.readFileSync(path.resolve('checkout.html'), 'utf-8');
const checkoutJs = fs.readFileSync(path.resolve('checkout.js'), 'utf-8');
assert(checkoutHtml.includes('id="checkoutSavedAddressesBlock"'), 'checkout.html contains #checkoutSavedAddressesBlock container');
assert(checkoutHtml.includes('id="checkoutAddressChips"'), 'checkout.html contains #checkoutAddressChips container');
assert(checkoutJs.includes('initCheckoutSavedAddresses'), 'checkout.js contains initCheckoutSavedAddresses');
assert(checkoutJs.includes('defaultAddr'), 'checkout.js selects default address');
assert(checkoutJs.includes('Ввести другой адрес вручную'), 'checkout.js provides manual address entry option');
assert(checkoutJs.includes('orderRow = {') && checkoutJs.includes('region: String(fd.get("region")') && checkoutJs.includes('address: String(fd.get("address")'), 'Orders record saves full address snapshot (region, city, address), NOT just address ID');
assert(!checkoutJs.includes('saveCustomerAddress'), 'checkout.js does NOT automatically mutate customer_addresses table on order placement');

console.log('\n--- 5. Verifying www/ synchronization ---');
const wwwLoginHtml = fs.readFileSync(path.resolve('www/login.html'), 'utf-8');
const wwwCheckoutHtml = fs.readFileSync(path.resolve('www/checkout.html'), 'utf-8');
const wwwCheckoutJs = fs.readFileSync(path.resolve('www/checkout.js'), 'utf-8');
assert(wwwLoginHtml.includes('id="profileAddressesView"'), 'www/login.html has profileAddressesView');
assert(wwwCheckoutHtml.includes('id="checkoutSavedAddressesBlock"'), 'www/checkout.html has checkoutSavedAddressesBlock');
assert(wwwCheckoutJs.includes('initCheckoutSavedAddresses'), 'www/checkout.js has initCheckoutSavedAddresses');

console.log('\n========================================');
console.log('Tests completed: ' + passed + ' passed, ' + failed + ' failed');
console.log('========================================\n');

if (failed > 0) process.exit(1);
