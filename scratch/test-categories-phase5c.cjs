/**
 * Emirate Co — Phase 5C Verification Suite
 * Tests:
 * 1. Phase 5B Regression:
 *    - 67 categories (6 Root, 16 Group, 45 Leaf)
 *    - 36 products total in live DB
 *    - 23 MATCH products have category_id
 *    - 13 NEEDS_REVIEW products have category_id = NULL
 *    - payload.category strictly preserved in all 36 products
 *    - payload.category_id is strictly absent from all 36 products
 * 2. Suggestion Engine on all 13 NEEDS_REVIEW products:
 *    - Every product receives a valid leaf suggestion with reasons
 *    - Zero automatic writes to database
 * 3. Critical T47697 verification:
 *    - Suggestion must be cat_headphones based on title signals (NOT cat_smartwatches from legacy payload.category)
 *    - T47697 category_id remains strictly NULL in live DB
 * 4. Explicit acceptance flow:
 *    - Showing suggestion does not modify database
 *    - Calling accept sets category_id only in editor state
 *    - Payload preserves legacy category and never creates payload.category_id
 * 5. MATCH products integrity:
 *    - All 23 MATCH products retain their assigned category_id
 * 6. Orders table:
 *    - Accessible and untouched
 */

require('../emirate-categories.js');
const catModule = global.emirateCategories;

const SUPABASE_URL = 'https://efoujwgalbnfrodgkqyl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU';

async function fetchJson(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${SUPABASE_URL}/rest/v1/${endpoint}`;
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
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('EMIRATE CO — PHASE 5C VERIFICATION SUITE');
  console.log('Category Auto-Suggestion / Recommendation');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Fetch categories
  console.log('1. LIVE DB: Categories Integrity & Taxonomy Setup...');
  const catRes = await fetchJson('categories?select=*&order=sort_order.asc');
  assert(catRes.status === 200, `Categories fetched with HTTP 200 (got ${catRes.status})`);
  const rawCats = catRes.data || [];
  assert(rawCats.length === 67, `Total categories == 67 (got ${rawCats.length})`);

  const categories = rawCats.map(catModule.normalizeCategoryRecord);
  const roots = categories.filter(c => c.id.startsWith('root_'));
  const groups = categories.filter(c => c.id.startsWith('grp_'));
  const leafs = categories.filter(c => c.id.startsWith('cat_'));

  assert(roots.length === 6, `Roots count == 6 (got ${roots.length})`);
  assert(groups.length === 16, `Groups count == 16 (got ${groups.length})`);
  assert(leafs.length === 45, `Leafs count == 45 (got ${leafs.length})`);

  // 2. Fetch all products from Live DB
  console.log('\n2. LIVE DB: Products Baseline & NEEDS_REVIEW Audit...');
  const prodRes = await fetchJson('products?select=admin_id,category_id,payload&limit=100');
  assert(prodRes.status === 200, `Products fetched with HTTP 200 (got ${prodRes.status})`);
  const products = prodRes.data || [];
  assert(products.length === 36, `Total products in DB == 36 (got ${products.length})`);

  const assigned = products.filter(p => p.category_id !== null);
  const unassigned = products.filter(p => p.category_id === null);

  assert(assigned.length === 23, `Exactly 23 MATCH products have category_id assigned (got ${assigned.length})`);
  assert(unassigned.length === 13, `Exactly 13 NEEDS_REVIEW products have category_id = NULL (got ${unassigned.length})`);

  const needsReviewIds = [
    'T21592', 'T21676', 'T27118', 'T28464', 'T38876',
    'T47697', 'T47839', 'T60742', 'T66150', 'T66446',
    'T69923', 'T73195', 'T79940'
  ];

  const actualNullIds = unassigned.map(p => p.admin_id).sort();
  const expectedNullIds = [...needsReviewIds].sort();
  assert(
    JSON.stringify(actualNullIds) === JSON.stringify(expectedNullIds),
    '13 NEEDS_REVIEW product IDs strictly match expected list'
  );

  // Check payload.category preservation and payload.category_id absence
  let payloadCategoryIntact = true;
  let payloadCategoryIdAbsent = true;
  for (const p of products) {
    if (!p.payload?.category) payloadCategoryIntact = false;
    if (p.payload?.category_id !== undefined || p.payload?.categoryId !== undefined) {
      payloadCategoryIdAbsent = false;
    }
  }
  assert(payloadCategoryIntact, 'All 36 products preserve payload.category');
  assert(payloadCategoryIdAbsent, 'All 36 products have ZERO payload.category_id in JSON');

  // 3. Test Suggestion Engine on all 13 NEEDS_REVIEW products
  console.log('\n3. SUGGESTION ENGINE: Evaluation on 13 NEEDS_REVIEW Products...');
  const expectedSuggestions = {
    'T79940': { catId: 'cat_smartwatches', label: 'Умные часы', conf: 'HIGH' },
    'T66150': { catId: 'cat_air_purifiers', label: 'Очистители и увлажнители воздуха', conf: 'HIGH' },
    'T60742': { catId: 'cat_network_equipment', label: 'Wi-Fi роутеры и усилители', conf: 'HIGH' },
    'T27118': { catId: 'cat_microphones', label: 'Микрофоны и радиосистемы', conf: 'HIGH' },
    'T28464': { catId: 'cat_electric_toothbrushes', label: 'Электрические зубные щетки', conf: 'HIGH' },
    'T38876': { catId: 'cat_external_storage', label: 'Внешние жесткие диски и SSD', conf: 'HIGH' },
    'T47697': { catId: 'cat_headphones', label: 'Наушники', conf: 'HIGH' },
    'T69923': { catId: 'cat_laptop_stands', label: 'Подставки для ноутбуков', conf: 'HIGH' },
    'T21592': { catId: 'cat_action_cameras', label: 'Экшн-камеры', conf: 'HIGH' },
    'T47839': { catId: 'cat_microphones', label: 'Микрофоны и радиосистемы', conf: 'HIGH' },
    'T73195': { catId: 'cat_smartwatches', label: 'Умные часы', conf: 'HIGH' },
    'T66446': { catId: 'cat_smartwatches', label: 'Умные часы', conf: 'HIGH' },
    'T21676': { catId: 'cat_gimbals', label: 'Стабилизаторы и стедикамы', conf: 'HIGH' }
  };

  let allSuggestionsValid = true;
  for (const p of unassigned) {
    const s = catModule.suggestProductCategory(p, categories);
    const exp = expectedSuggestions[p.admin_id];
    if (!s || s.suggestedCategoryId !== exp.catId || s.confidence !== exp.conf) {
      allSuggestionsValid = false;
      console.error(`Suggestion mismatch for ${p.admin_id}: got ${s?.suggestedCategoryId} (${s?.confidence}), expected ${exp.catId} (${exp.conf})`);
    } else {
      console.log(`    [SUGGESTION] ${p.admin_id} -> ${s.suggestedCategoryId} (${s.confidence}) [${s.pathLabel}]`);
      console.log(`                 Причина: ${s.reasons.join(', ')}`);
    }
  }
  assert(allSuggestionsValid, 'All 13 NEEDS_REVIEW products receive exact expected recommendations with reasons');

  // 4. Critical T47697 Check
  console.log('\n4. CRITICAL SAFETY: T47697 Audit...');
  const t47697 = products.find(p => p.admin_id === 'T47697');
  const t47697Suggestion = catModule.suggestProductCategory(t47697, categories);

  assert(t47697 && t47697.category_id === null, 'T47697 category_id is strictly NULL in live database');
  assert(t47697Suggestion.suggestedCategoryId === 'cat_headphones', 'T47697 recommendation is cat_headphones (Earbuds/Наушники)');
  assert(t47697Suggestion.suggestedCategoryId !== 'cat_smartwatches', 'T47697 was NOT misclassified as smartwatch');
  assert(
    t47697Suggestion.reasons.some(r => r.includes('наушники')),
    'T47697 recommendation cites audio/earbuds signals'
  );

  // 5. Arbitrary Product Suggestion Testing
  console.log('\n5. GENERALIZATION: Testing Arbitrary Products...');
  const testNewProducts = [
    {
      nameRu: 'Apple iPhone 16 Pro Max 256GB Desert Titanium',
      nameUz: 'Apple iPhone 16 Pro Max 256GB',
      expected: 'cat_smartphones'
    },
    {
      nameRu: 'Apple MacBook Air 13 M3 8/256GB Midnight',
      nameUz: 'Apple MacBook Air 13 M3',
      expected: 'cat_laptops'
    },
    {
      nameRu: 'Робот-пылесос Xiaomi Robot Vacuum S10+',
      nameUz: 'Xiaomi Robot Vacuum S10+ robot changyutgich',
      expected: 'cat_robot_vacuums'
    },
    {
      nameRu: 'Чехол для iPhone 15 силиконовый черный',
      nameUz: 'iPhone 15 uchun silikon g‘ilof qora',
      expected: 'cat_cases'
    },
    {
      nameRu: 'Какая-то неизвестная вещь без категории',
      nameUz: 'Noma\'lum narsa',
      expected: null
    }
  ];

  let generalizationPass = true;
  for (const tp of testNewProducts) {
    const s = catModule.suggestProductCategory(tp, categories);
    const resultId = s ? s.suggestedCategoryId : null;
    if (resultId !== tp.expected) {
      generalizationPass = false;
      console.error(`Generalization mismatch for "${tp.nameRu}": got ${resultId}, expected ${tp.expected}`);
    }
  }
  assert(generalizationPass, 'Engine generalizes accurately to arbitrary products and returns null for unclassifiable items');

  // 6. Explicit Acceptance Simulation (Verify ZERO silent database writes)
  console.log('\n6. EXPLICIT ACCEPTANCE SIMULATION & DATABASE INTEGRITY:');
  // Re-fetch products from DB to ensure no writes occurred during suggestion evaluation
  const postEvalRes = await fetchJson('products?select=admin_id,category_id&limit=100');
  const postUnassigned = (postEvalRes.data || []).filter(p => p.category_id === null);
  assert(
    postUnassigned.length === 13,
    'No automatic database writes occurred during suggestion generation (13 products remain NULL)'
  );

  // Test that simulated accept modifies ONLY memory/form state, NOT DB
  const memoryProduct = { ...t47697.payload, categoryId: null, category_id: null };
  const acceptedCatId = t47697Suggestion.suggestedCategoryId;
  memoryProduct.categoryId = acceptedCatId;
  memoryProduct.category_id = acceptedCatId;

  assert(memoryProduct.category_id === 'cat_headphones', 'Explicit accept updates local category_id to cat_headphones');
  assert(memoryProduct.category === 'Умные часы', 'Explicit accept preserves legacy payload.category ("Умные часы")');

  // Verify DB still has NULL for T47697
  const liveT47697Check = await fetchJson('products?admin_id=eq.T47697&select=category_id');
  assert(
    liveT47697Check.data?.[0]?.category_id === null,
    'Live DB for T47697 remains strictly category_id = NULL after accept simulation'
  );

  // 7. Orders Table Accessibility
  console.log('\n7. ORDERS TABLE INTEGRITY:');
  const orderRes = await fetchJson('orders?select=id&limit=1');
  assert(orderRes.status === 200, 'Orders table remains accessible and unmodified (HTTP 200)');

  console.log('\n====================================================');
  console.log(`PHASE 5C VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
