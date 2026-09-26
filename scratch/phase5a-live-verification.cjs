/**
 * EMIRATE CO / SFS MARKET
 * Phase 5A: Live Post-Migration Verification Script
 */

const SUPABASE_URL = 'https://efoujwgalbnfrodgkqyl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU';

async function fetchSupabase(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    method: options.method || 'GET',
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text, json };
}

async function runLiveVerification() {
  console.log('================================================================');
  console.log('EMIRATE CO — PHASE 5A: LIVE POST-MIGRATION VERIFICATION');
  console.log('================================================================\n');

  let passes = 0;
  let fails = 0;

  function check(name, condition, errorMsg = '') {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passes++;
    } else {
      console.error(`  [FAIL] ${name}: ${errorMsg}`);
      fails++;
    }
  }

  // 1. Check categories table accessibility
  console.log('--- 1. CATEGORIES TABLE ACCESSIBILITY ---');
  const catRes = await fetchSupabase('categories?select=*&order=sort_order.asc');
  check('categories table returns HTTP 200', catRes.status === 200, `Got HTTP ${catRes.status}: ${catRes.text}`);

  if (catRes.status !== 200 || !Array.isArray(catRes.json)) {
    console.error('\n[ABORT] categories table not yet present in LIVE schema cache.');
    console.error('Please ensure supabase/categories-foundation-migration.sql was executed in Supabase SQL Editor.');
    process.exit(1);
  }

  const allCategories = catRes.json;
  console.log(`Total categories in LIVE: ${allCategories.length}`);
  check('total categories count is exactly 67', allCategories.length === 67, `Got ${allCategories.length}`);

  // 2. Breakdown by levels
  console.log('\n--- 2. CATEGORIES BREAKDOWN BY LEVELS ---');
  const roots = allCategories.filter(c => c.id.startsWith('root_'));
  const groups = allCategories.filter(c => c.id.startsWith('grp_'));
  const leafs = allCategories.filter(c => c.id.startsWith('cat_'));

  check('roots count is 6', roots.length === 6, `Got ${roots.length}`);
  check('groups count is 16', groups.length === 16, `Got ${groups.length}`);
  check('leafs count is 45', leafs.length === 45, `Got ${leafs.length}`);

  // Check parent_id constraints
  const allIds = new Set(allCategories.map(c => c.id));
  const rootsHaveNullParent = roots.every(r => r.parent_id === null);
  check('all roots have parent_id = null', rootsHaveNullParent);

  const groupsHaveRootParent = groups.every(g => g.parent_id && g.parent_id.startsWith('root_') && allIds.has(g.parent_id));
  check('all groups have root_* parent_id', groupsHaveRootParent);

  const leafsHaveGroupParent = leafs.every(l => l.parent_id && l.parent_id.startsWith('grp_') && allIds.has(l.parent_id));
  check('all leafs have grp_* parent_id', leafsHaveGroupParent);

  // Check unique slugs
  const slugs = allCategories.map(c => c.slug);
  const uniqueSlugs = new Set(slugs);
  check('0 duplicate slugs', slugs.length === uniqueSlugs.size, `Duplicate slugs found: ${slugs.length - uniqueSlugs.size}`);

  // 3. Products verification
  console.log('\n--- 3. PRODUCTS VERIFICATION (ALL 36 PRODUCTS) ---');
  const prodRes = await fetchSupabase('products?select=admin_id,title,category_id,payload&order=admin_id.asc');
  check('products table returns HTTP 200', prodRes.status === 200);

  const products = prodRes.json || [];
  check('total products count remains exactly 36', products.length === 36, `Got ${products.length}`);

  const matchIds = [
    'T17822', 'T32309', 'T35245', 'T77288', 'T85505', // Смартфоны (5)
    'T13710', 'T19398', 'T39761', 'T47092', 'T59239', 'T63219', 'T75439', // Наушники (7)
    'T42219', 'T44751', 'T60710', 'T90449', 'T98000', // Умные часы (5)
    'T48934', 'T50490', 'T68760', 'T99737', // Колонки (4)
    'T29290', // Фитнес-браслеты (1)
    'T93318'  // Зарядки (1)
  ];

  const reviewIds = [
    'T21592', 'T21676', 'T27118', 'T28464', 'T38876',
    'T47697', 'T47839', 'T60742', 'T66150', 'T66446',
    'T69923', 'T73195', 'T79940'
  ];

  const withCategory = products.filter(p => p.category_id !== null && p.category_id !== undefined);
  const withoutCategory = products.filter(p => p.category_id === null || p.category_id === undefined);

  check('exactly 23 products have category_id assigned', withCategory.length === 23, `Got ${withCategory.length}`);
  check('exactly 13 products remain category_id = null', withoutCategory.length === 13, `Got ${withoutCategory.length}`);

  // Check 23 MATCH items match expected IDs
  const actualMatchIds = withCategory.map(p => p.admin_id).sort();
  const expectedMatchIds = [...matchIds].sort();
  check('matched product IDs strictly equal 23 expected MATCH IDs',
    JSON.stringify(actualMatchIds) === JSON.stringify(expectedMatchIds));

  // Check 13 NEEDS_REVIEW items match expected IDs
  const actualReviewIds = withoutCategory.map(p => p.admin_id).sort();
  const expectedReviewIds = [...reviewIds].sort();
  check('unmatched product IDs strictly equal 13 expected NEEDS_REVIEW IDs',
    JSON.stringify(actualReviewIds) === JSON.stringify(expectedReviewIds));

  // 4. Critical T47697 Check
  console.log('\n--- 4. CRITICAL T47697 AUDIT ---');
  const t47697 = products.find(p => p.admin_id === 'T47697');
  check('T47697 exists', Boolean(t47697));
  check('T47697 category_id is strictly null', t47697?.category_id === null, `Got ${t47697?.category_id}`);
  check('T47697 is NOT assigned to cat_smartwatches', t47697?.category_id !== 'cat_smartwatches');

  // 5. Payload.category preservation
  console.log('\n--- 5. PAYLOAD.CATEGORY PRESERVATION ---');
  let payloadCategoryMissing = 0;
  for (const p of products) {
    if (!p.payload || !p.payload.category) {
      payloadCategoryMissing++;
    }
  }
  check('all 36 products preserve payload.category', payloadCategoryMissing === 0, `Missing in ${payloadCategoryMissing} products`);

  let payloadCategoryIdPresent = 0;
  for (const p of products) {
    if (p.payload && p.payload.category_id !== undefined) {
      payloadCategoryIdPresent++;
    }
  }
  check('0 products have payload.category_id (pure single source of truth)', payloadCategoryIdPresent === 0, `Found in ${payloadCategoryIdPresent} products`);

  // 6. Orders table check
  console.log('\n--- 6. ORDERS TABLE INTEGRITY ---');
  const orderRes = await fetchSupabase('orders?select=id&limit=1', { headers: { Prefer: 'count=exact' } });
  check('orders table is accessible (HTTP 200)', orderRes.status === 200);

  // 7. RPC get_category_subtree_ids check
  console.log('\n--- 7. RPC get_category_subtree_ids VERIFICATION ---');
  const rpcRes = await fetchSupabase('rpc/get_category_subtree_ids', {
    method: 'POST',
    body: { p_category_slug_or_id: 'elektronika' }
  });
  check('rpc/get_category_subtree_ids works (HTTP 200)', rpcRes.status === 200, `Got ${rpcRes.status}: ${rpcRes.text}`);
  if (Array.isArray(rpcRes.json)) {
    console.log(`Subtree 'elektronika' returned ${rpcRes.json.length} category IDs`);
    check('subtree includes root and child categories', rpcRes.json.length > 5);
  }

  console.log('\n================================================================');
  console.log(`PHASE 5A LIVE VERIFICATION SUMMARY: ${passes} PASS / ${fails} FAIL`);
  console.log('================================================================');

  if (fails > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLiveVerification().catch(console.error);
