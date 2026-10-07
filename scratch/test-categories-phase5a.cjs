/**
 * EMIRATE CO — PHASE 5A: CATEGORIES FOUNDATION AUTOMATED TEST SUITE
 * Validates:
 * 1. 0 duplicate category IDs
 * 2. 0 duplicate slugs
 * 3. Exactly 3 levels: Root -> Group -> Leaf
 * 4. Every cat_* has grp_* parent
 * 5. Every grp_* has root_* parent
 * 6. No cycles
 * 7. Category counts by level
 * 8. All 23 MATCH products get category_id
 * 9. All 13 NEEDS_REVIEW products remain category_id = null
 * 10. payload.category is never deleted or modified
 * 11. No DELETE FROM products in migration
 * 12. public.orders is not modified
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("================================================================");
console.log("EMIRATE CO — PHASE 5A: CATEGORIES FOUNDATION TEST SUITE");
console.log("================================================================\n");

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    console.log(`  [PASS ${total}/12] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL ${total}/12] ${name}`);
    console.error(`         Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
}

const migrationPath = path.join(__dirname, "../supabase/categories-foundation-migration.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

// Parse categories from SQL
function parseCategoriesFromSql(sqlContent) {
  const categories = [];
  // Restrict parsing to the categories insert statements before product mapping
  const insertSection = sqlContent.substring(
    sqlContent.indexOf("-- 5. SEED TAXONOMY"),
    sqlContent.indexOf("-- 6. PRODUCT MAPPING")
  );
  // Regex to match ('id', parent, 'name_ru', 'name_uz', 'slug', ...)
  const regex = /\('([a-z0-9_]+)',\s*(null|'([a-z0-9_]+)'),\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)'/gi;
  let match;
  while ((match = regex.exec(insertSection)) !== null) {
    categories.push({
      id: match[1],
      parentId: match[2] === "null" ? null : match[3],
      nameRu: match[4].replace(/''/g, "'"),
      nameUz: match[5].replace(/''/g, "'"),
      slug: match[6]
    });
  }
  return categories;
}

const categories = parseCategoriesFromSql(sql);
const categoriesMap = new Map();
categories.forEach(c => categoriesMap.set(c.id, c));

// 1. Duplicate IDs = 0
it("1. 0 duplicate category IDs in seed", () => {
  const idCounts = {};
  for (const c of categories) {
    idCounts[c.id] = (idCounts[c.id] || 0) + 1;
    if (idCounts[c.id] > 1) {
      throw new Error(`Duplicate category ID found: ${c.id}`);
    }
  }
  assert.strictEqual(categories.length, categoriesMap.size);
});

// 2. Duplicate Slugs = 0
it("2. 0 duplicate slugs in seed", () => {
  const slugCounts = {};
  for (const c of categories) {
    slugCounts[c.slug] = (slugCounts[c.slug] || 0) + 1;
    if (slugCounts[c.slug] > 1) {
      throw new Error(`Duplicate category slug found: ${c.slug}`);
    }
  }
});

// 3. Exactly 3 levels
it("3. strictly 3 levels in hierarchy (Root -> Group -> Leaf)", () => {
  for (const c of categories) {
    let depth = 1;
    let curr = c;
    const visited = new Set([curr.id]);

    while (curr.parentId) {
      curr = categoriesMap.get(curr.parentId);
      if (!curr) throw new Error(`Dangling parentId ${c.parentId} for category ${c.id}`);
      if (visited.has(curr.id)) throw new Error(`Cycle detected at ${curr.id}`);
      visited.add(curr.id);
      depth++;
    }

    if (depth > 3) {
      throw new Error(`Category ${c.id} exceeds maximum depth 3 (depth: ${depth})`);
    }
  }
});

// 4. Every cat_* has grp_* parent
it("4. every leaf cat_* has a grp_* parent", () => {
  const leafs = categories.filter(c => c.id.startsWith("cat_"));
  assert.ok(leafs.length > 0, "Must have leaf categories");
  for (const leaf of leafs) {
    assert.ok(leaf.parentId && leaf.parentId.startsWith("grp_"),
      `Leaf ${leaf.id} parent must start with grp_, got: ${leaf.parentId}`);
  }
});

// 5. Every grp_* has root_* parent
it("5. every group grp_* has a root_* parent", () => {
  const groups = categories.filter(c => c.id.startsWith("grp_"));
  assert.ok(groups.length > 0, "Must have group categories");
  for (const grp of groups) {
    assert.ok(grp.parentId && grp.parentId.startsWith("root_"),
      `Group ${grp.id} parent must start with root_, got: ${grp.parentId}`);
  }
});

// 6. Every root_* has null parent
it("6. every root_* category has parent_id = null", () => {
  const roots = categories.filter(c => c.id.startsWith("root_"));
  assert.ok(roots.length === 6, `Expected 6 roots, got ${roots.length}`);
  for (const root of roots) {
    assert.strictEqual(root.parentId, null, `Root ${root.id} must have null parent`);
  }
});

// 7. Category counts breakdown
it("7. category count verification by level", () => {
  const roots = categories.filter(c => c.id.startsWith("root_"));
  const groups = categories.filter(c => c.id.startsWith("grp_"));
  const leafs = categories.filter(c => c.id.startsWith("cat_"));

  assert.strictEqual(roots.length, 6, "Expected 6 root categories");
  assert.strictEqual(groups.length, 16, "Expected 16 group categories");
  assert.strictEqual(leafs.length, 45, "Expected 45 leaf categories");
  assert.strictEqual(categories.length, 67, "Expected 67 total categories");
});

// 8. 23 MATCH products get category_id
it("8. all 23 MATCH products have update statements with target category_id", () => {
  const matchIds = [
    'T17822', 'T32309', 'T35245', 'T77288', 'T85505', // Смартфоны (5)
    'T13710', 'T19398', 'T39761', 'T47092', 'T59239', 'T63219', 'T75439', // Наушники (7)
    'T42219', 'T44751', 'T60710', 'T90449', 'T98000', // Умные часы (5)
    'T48934', 'T50490', 'T68760', 'T99737', // Колонки (4)
    'T29290', // Фитнес-браслеты (1)
    'T93318'  // Зарядки (1)
  ];

  assert.strictEqual(matchIds.length, 23);
  for (const pid of matchIds) {
    assert.ok(sql.includes(`'${pid}'`), `Migration must include update for MATCH product ${pid}`);
  }
});

// 9. 13 NEEDS_REVIEW products are NOT updated in migration
it("9. all 13 NEEDS_REVIEW products are NOT updated and remain category_id = null", () => {
  const reviewIds = [
    'T21592', 'T21676', 'T27118', 'T28464', 'T38876',
    'T47697', 'T47839', 'T60742', 'T66150', 'T66446',
    'T69923', 'T73195', 'T79940'
  ];

  assert.strictEqual(reviewIds.length, 13);
  for (const pid of reviewIds) {
    // None of the review IDs should appear in any UPDATE statement in the SQL
    const updateSection = sql.substring(sql.indexOf("-- 6. PRODUCT MAPPING"));
    assert.ok(!updateSection.includes(`'${pid}'`),
      `NEEDS_REVIEW product ${pid} must NOT be updated automatically!`);
  }
});

// 10. payload is untouched and payload.category_id is strictly NOT created
it("10. payload is untouched: category_id set only on column, payload.category preserved", () => {
  // Must NOT contain jsonb_set for category_id
  assert.ok(!sql.includes("jsonb_set(payload, '{category_id}'"), "jsonb_set for category_id must NOT be present in migration");
  assert.ok(!sql.toLowerCase().includes("payload - 'category'"), "Migration must never remove category key from payload");
  assert.ok(!sql.includes("payload ="), "Migration updates must not modify payload");
});

// 11. No DELETE FROM products in migration
it("11. DELETE FROM products is strictly absent from migration", () => {
  assert.ok(!sql.toLowerCase().includes("delete from public.products"), "DELETE FROM products is forbidden");
  assert.ok(!sql.toLowerCase().includes("delete from products"), "DELETE FROM products is forbidden");
});

// 12. public.orders is not modified
it("12. public.orders is not modified by categories migration", () => {
  assert.ok(!sql.toLowerCase().includes("table public.orders"), "public.orders must not be modified");
  assert.ok(!sql.toLowerCase().includes("into public.orders"), "public.orders must not be modified");
  assert.ok(!sql.toLowerCase().includes("update public.orders"), "public.orders must not be modified");
});

console.log("\n================================================================");
console.log(`PHASE 5A TEST SUMMARY: ${passed}/${total} PASS`);
console.log("================================================================");

if (passed !== total) {
  process.exit(1);
} else {
  process.exit(0);
}
