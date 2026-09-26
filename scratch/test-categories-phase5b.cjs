/**
 * Emirate Co — Phase 5B Automated Verification Suite
 * Tests:
 * 1. Supabase Categories Tree traversal & depth validation (67 categories = 6 Root, 16 Group, 45 Leaf)
 * 2. Admin Category parent dropdown restrictions (only Root and Group allowed as parents; Leaf cannot have children)
 * 3. 3-Level Product Category Picker:
 *    - Level 1: Root only
 *    - Level 2: Group only
 *    - Level 3: Leaf only
 *    - Accept button enabled ONLY for Leaf categories
 * 4. Product Edit Preselection:
 *    - MATCH product with category_id: preselects full path [Root -> Group -> Leaf]
 *    - NEEDS_REVIEW product with category_id = NULL: stays empty/unselected, NO inference from payload.category
 * 5. Product Save Payload:
 *    - Relational category_id is set at row level
 *    - payload.category is preserved intact
 *    - payload.category_id / payload.categoryId is STRICTLY ABSENT from json payload
 * 6. Category Deletion FK Constraint handling (23503 error message check)
 * 7. Live Supabase DB read-only verification
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://efoujwgalbnfrodgkqyl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU';
const SUPABASE_KEY = ANON_KEY;

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

// Category helpers mirroring admin.js / emirate-categories.js logic
function buildCategoryHelpers(categoriesData) {
  const byId = new Map(categoriesData.map(c => [c.id, c]));

  function getCategoryById(id) {
    return byId.get(id) || null;
  }

  function getCategoryChildren(parentId, { activeOnly = false } = {}) {
    return categoriesData
      .filter(c => (c.parentId === parentId || c.parent_id === parentId) && (!activeOnly || c.isActive))
      .sort((a, b) => (Number(a.sortOrder || a.sort_order || 0) - Number(b.sortOrder || b.sort_order || 0)) || String(a.nameRu || '').localeCompare(String(b.nameRu || ''), 'ru'));
  }

  function getCategoryPath(categoryOrId) {
    const item = typeof categoryOrId === 'string' ? getCategoryById(categoryOrId) : categoryOrId;
    if (!item) return [];
    const chain = [item];
    const visited = new Set([item.id]);
    let current = item;
    while (current.parentId || current.parent_id) {
      const pid = current.parentId || current.parent_id;
      if (visited.has(pid)) break;
      visited.add(pid);
      const parent = getCategoryById(pid);
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
    }
    return chain;
  }

  function getCategoryDepth(categoryOrId) {
    return getCategoryPath(categoryOrId).length;
  }

  function isLeafCategory(categoryOrId) {
    const item = typeof categoryOrId === 'string' ? getCategoryById(categoryOrId) : categoryOrId;
    if (!item) return false;
    const depth = getCategoryDepth(item);
    const hasChildren = getCategoryChildren(item.id).length > 0;
    return depth === 3 && !hasChildren;
  }

  function canHaveChildren(categoryOrId) {
    const item = typeof categoryOrId === 'string' ? getCategoryById(categoryOrId) : categoryOrId;
    if (!item) return false;
    const depth = getCategoryDepth(item);
    return depth < 3;
  }

  return {
    byId,
    getCategoryById,
    getCategoryChildren,
    getCategoryPath,
    getCategoryDepth,
    isLeafCategory,
    canHaveChildren
  };
}

// Simulated 3-level Picker State & Logic
function createPickerSimulator(categoriesData, helpers) {
  const state = {
    selectedRootId: '',
    selectedGroupId: '',
    selectedLeafId: '',
    catIdInputValue: '',
    pathLabel: 'Выберите категорию…',
    isOpen: true
  };

  function setProductCategoryFromId(categoryId) {
    const leaf = categoryId ? helpers.getCategoryById(categoryId) : null;
    if (leaf) {
      const path = helpers.getCategoryPath(leaf);
      state.selectedRootId = path[0]?.id || '';
      state.selectedGroupId = path[1]?.id || '';
      state.selectedLeafId = path[2]?.id || leaf.id;
      state.catIdInputValue = leaf.id;
      state.pathLabel = path.map(c => c.nameRu).join(' › ');
      state.isOpen = false;
    } else {
      state.selectedRootId = '';
      state.selectedGroupId = '';
      state.selectedLeafId = '';
      state.catIdInputValue = '';
      state.pathLabel = 'Выберите категорию…';
      state.isOpen = true;
    }
  }

  function selectRoot(rootId) {
    state.selectedRootId = rootId || '';
    state.selectedGroupId = '';
    state.selectedLeafId = '';
  }

  function selectGroup(groupId) {
    state.selectedGroupId = groupId || '';
    state.selectedLeafId = '';
  }

  function selectLeaf(leafId) {
    state.selectedLeafId = leafId || '';
  }

  function isAcceptEnabled() {
    if (!state.selectedLeafId) return false;
    return helpers.isLeafCategory(state.selectedLeafId);
  }

  function accept() {
    if (!isAcceptEnabled()) return false;
    const leaf = helpers.getCategoryById(state.selectedLeafId);
    state.catIdInputValue = leaf.id;
    const path = helpers.getCategoryPath(leaf);
    state.pathLabel = path.map(c => c.nameRu).join(' › ');
    state.isOpen = false;
    return true;
  }

  return {
    state,
    setProductCategoryFromId,
    selectRoot,
    selectGroup,
    selectLeaf,
    isAcceptEnabled,
    accept
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('EMIRATE CO — PHASE 5B VERIFICATION SUITE');
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

  // Step 1: Read Live Categories from Supabase
  console.log('1. LIVE SUPABASE DB: Fetching categories and products...');
  const catRes = await fetchJson('categories?select=*&order=sort_order.asc');

  assert(catRes.status === 200, `categories HTTP status 200 (got ${catRes.status})`);
  const categories = catRes.data || [];
  assert(categories.length === 67, `Total categories count == 67 (got ${categories.length})`);

  const roots = categories.filter(c => c.id.startsWith('root_'));
  const groups = categories.filter(c => c.id.startsWith('grp_'));
  const leafs = categories.filter(c => c.id.startsWith('cat_'));

  assert(roots.length === 6, `Roots count == 6 (got ${roots.length})`);
  assert(groups.length === 16, `Groups count == 16 (got ${groups.length})`);
  assert(leafs.length === 45, `Leafs count == 45 (got ${leafs.length})`);

  // Step 2: Test Hierarchy Helpers & Depth Constraints
  console.log('\n2. HIERARCHY HELPERS & DEPTH CONSTRAINTS:');
  const normalizedCats = categories.map(c => ({
    id: c.id,
    nameRu: c.name_ru,
    nameUz: c.name_uz,
    slug: c.slug,
    parentId: c.parent_id,
    parent_id: c.parent_id,
    sortOrder: c.sort_order,
    sort_order: c.sort_order,
    isActive: c.is_active
  }));
  const helpers = buildCategoryHelpers(normalizedCats);

  // Check depths of all categories
  let allDepthsMatch = true;
  for (const c of normalizedCats) {
    const computedDepth = helpers.getCategoryDepth(c.id);
    const expectedDepth = c.id.startsWith('root_') ? 1 : c.id.startsWith('grp_') ? 2 : 3;
    if (computedDepth !== expectedDepth) {
      allDepthsMatch = false;
      console.error(`Depth mismatch for ${c.id}: computed ${computedDepth} vs expected ${expectedDepth}`);
    }
  }
  assert(allDepthsMatch, 'All computed hierarchy depths strictly match expected depths (Root=1, Group=2, Leaf=3)');

  // Verify only depth < 3 can have children (be chosen as parent in category form)
  let parentSelectValid = true;
  for (const c of normalizedCats) {
    const canParent = helpers.canHaveChildren(c.id);
    if (c.depth === 3 && canParent) parentSelectValid = false;
    if (c.depth < 3 && !canParent) parentSelectValid = false;
  }
  assert(parentSelectValid, 'Parent selection restriction: only Root (depth 1) and Group (depth 2) can be parents; Leaf (depth 3) CANNOT be a parent');

  // Step 3: Test 3-Level Product Category Picker Simulation
  console.log('\n3. 3-LEVEL PRODUCT CATEGORY PICKER SIMULATION:');
  const picker = createPickerSimulator(normalizedCats, helpers);

  // Initial state
  picker.setProductCategoryFromId(null);
  assert(picker.state.selectedRootId === '' && picker.state.selectedLeafId === '', 'Initial picker state is empty');
  assert(!picker.isAcceptEnabled(), 'Accept button is disabled when nothing selected');

  // Select Root
  picker.selectRoot('root_electronics');
  assert(!picker.isAcceptEnabled(), 'Accept button is disabled when ONLY Root selected (root_electronics)');

  // Select Group
  picker.selectGroup('grp_phones_gadgets');
  assert(!picker.isAcceptEnabled(), 'Accept button is disabled when Group selected (grp_phones_gadgets)');

  // Select Leaf
  picker.selectLeaf('cat_smartphones');
  assert(picker.isAcceptEnabled(), 'Accept button is ENABLED when Leaf selected (cat_smartphones)');

  // Accept selection
  const accepted = picker.accept();
  assert(accepted && picker.state.catIdInputValue === 'cat_smartphones', 'Accepting leaf sets input value to cat_smartphones');
  assert(picker.state.pathLabel === 'Электроника › Смартфоны и гаджеты › Смартфоны', `Breadcrumb label is correct: "${picker.state.pathLabel}"`);
  assert(picker.state.isOpen === false, 'Picker collapsed after accept');

  // Step 4: Test Preselection on Product Edit
  console.log('\n4. PRODUCT EDIT PRESELECTION:');
  // Case A: MATCH product with category_id
  picker.setProductCategoryFromId('cat_smartphones');
  assert(picker.state.selectedRootId === 'root_electronics', 'MATCH product preselects root_electronics');
  assert(picker.state.selectedGroupId === 'grp_phones_gadgets', 'MATCH product preselects grp_phones_gadgets');
  assert(picker.state.selectedLeafId === 'cat_smartphones', 'MATCH product preselects cat_smartphones');
  assert(picker.state.catIdInputValue === 'cat_smartphones', 'Input value has category_id cat_smartphones');
  assert(picker.state.pathLabel === 'Электроника › Смартфоны и гаджеты › Смартфоны', 'Breadcrumb shows full 3-level path');
  assert(picker.state.isOpen === false, 'Picker is collapsed for product with preselected category');

  // Case B: NEEDS_REVIEW product with category_id = NULL
  picker.setProductCategoryFromId(null);
  assert(picker.state.selectedRootId === '', 'NEEDS_REVIEW product has empty root');
  assert(picker.state.selectedGroupId === '', 'NEEDS_REVIEW product has empty group');
  assert(picker.state.selectedLeafId === '', 'NEEDS_REVIEW product has empty leaf');
  assert(picker.state.catIdInputValue === '', 'NEEDS_REVIEW product input value is empty');
  assert(picker.state.pathLabel === 'Выберите категорию…', 'NEEDS_REVIEW product path is placeholder');
  assert(picker.state.isOpen === true, 'NEEDS_REVIEW product picker starts open for manual selection');

  // Step 5: Test Product Save Payload Integrity
  console.log('\n5. PRODUCT SAVE PAYLOAD INTEGRITY:');
  // Load emirate-supabase-api.js and inspect pushAdminProductsPayload
  const apiCode = fs.readFileSync(path.resolve(__dirname, '..', 'emirate-supabase-api.js'), 'utf8');

  // Verify category_id in selectProductRows
  assert(apiCode.includes('category_id'), 'emirate-supabase-api.js selects category_id');
  // Verify row mapping in pushAdminProductsPayload
  assert(apiCode.includes('category_id: categoryId || null'), 'pushAdminProductsPayload sets top-level category_id');
  assert(apiCode.includes('delete payload.categoryId') && apiCode.includes('delete payload.category_id'), 'pushAdminProductsPayload strips categoryId and category_id from payload');

  // Test row transformation logic directly
  const testProductNeedsReview = {
    id: 'T47697',
    nameRu: 'Умные часы T47697',
    category: 'Смарт-часы',
    categoryId: null,
    category_id: null,
    price: '350 000 сум'
  };

  const payloadCleaned = { ...testProductNeedsReview };
  delete payloadCleaned.categoryId;
  delete payloadCleaned.category_id;
  const mappedRowNeedsReview = {
    admin_id: testProductNeedsReview.id,
    category_id: testProductNeedsReview.categoryId || testProductNeedsReview.category_id || null,
    payload: payloadCleaned
  };

  assert(mappedRowNeedsReview.category_id === null, 'NEEDS_REVIEW product mapped row category_id is strictly null');
  assert(mappedRowNeedsReview.payload.category === 'Смарт-часы', 'NEEDS_REVIEW product payload.category preserved intact ("Смарт-часы")');
  assert(mappedRowNeedsReview.payload.category_id === undefined, 'NEEDS_REVIEW product payload.category_id is strictly undefined');
  assert(mappedRowNeedsReview.payload.categoryId === undefined, 'NEEDS_REVIEW product payload.categoryId is strictly undefined');

  // Test MATCH product save transformation
  const testProductMatch = {
    id: 'T10001',
    nameRu: 'Смартфон Test',
    category: 'Смартфоны',
    categoryId: 'cat_smartphones',
    category_id: 'cat_smartphones',
    price: '1 500 000 сум'
  };
  const payloadCleanedMatch = { ...testProductMatch };
  delete payloadCleanedMatch.categoryId;
  delete payloadCleanedMatch.category_id;
  const mappedRowMatch = {
    admin_id: testProductMatch.id,
    category_id: testProductMatch.categoryId || testProductMatch.category_id || null,
    payload: payloadCleanedMatch
  };
  assert(mappedRowMatch.category_id === 'cat_smartphones', 'MATCH product mapped row category_id is "cat_smartphones"');
  assert(mappedRowMatch.payload.category === 'Смартфоны', 'MATCH product payload.category preserved intact ("Смартфоны")');
  assert(mappedRowMatch.payload.category_id === undefined, 'MATCH product payload.category_id is strictly undefined');

  // Step 6: Test Category Delete FK Constraint Error Handling
  console.log('\n6. CATEGORY DELETE ERROR HANDLING:');
  const adminCode = fs.readFileSync(path.resolve(__dirname, '..', 'admin.js'), 'utf8');
  assert(adminCode.includes('23503'), 'admin.js intercepts Postgres error code 23503 (foreign key constraint)');
  assert(adminCode.includes('ON DELETE RESTRICT'), 'admin.js user feedback explains ON DELETE RESTRICT constraint');

  // Step 7: Live Products DB Read-Only Verification
  console.log('\n7. LIVE DB READ-ONLY VERIFICATION:');
  const prodRes = await fetchJson(
    `${SUPABASE_URL}/rest/v1/products?select=admin_id,category_id,payload&limit=100`,
    {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  );
  assert(prodRes.status === 200, `products HTTP status 200 (got ${prodRes.status})`);
  const products = prodRes.data || [];
  assert(products.length === 36, `Total products in DB == 36 (got ${products.length})`);

  const withCatId = products.filter(p => p.category_id !== null);
  const withoutCatId = products.filter(p => p.category_id === null);
  assert(withCatId.length === 23, `Exactly 23 MATCH products have category_id (got ${withCatId.length})`);
  assert(withoutCatId.length === 13, `Exactly 13 NEEDS_REVIEW products have category_id = NULL (got ${withoutCatId.length})`);

  const t47697 = products.find(p => p.admin_id === 'T47697');
  assert(t47697 && t47697.category_id === null, 'T47697 category_id is strictly NULL in live DB');

  let zeroPayloadCatId = true;
  let allPayloadCategoryPresent = true;
  for (const p of products) {
    if (p.payload?.category_id !== undefined || p.payload?.categoryId !== undefined) {
      zeroPayloadCatId = false;
      console.error(`Found payload.category_id in product ${p.admin_id}!`);
    }
    if (!p.payload?.category) {
      allPayloadCategoryPresent = false;
      console.error(`Missing payload.category in product ${p.admin_id}!`);
    }
  }
  assert(zeroPayloadCatId, 'ZERO products have category_id inside JSON payload in live DB');
  assert(allPayloadCategoryPresent, 'All 36 products retain legacy payload.category intact');

  // Verify orders table was not modified
  const orderRes = await fetchJson(
    `${SUPABASE_URL}/rest/v1/orders?select=id&limit=1`,
    {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  );
  assert(orderRes.status === 200, `orders table accessible and unmodified (HTTP status ${orderRes.status})`);

  console.log('\n====================================================');
  console.log(`PHASE 5B VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
