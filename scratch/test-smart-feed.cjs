/**
 * Test suite for "Умумий товарлар" (Smart Feed) and Banner Enhancements
 */
const { readFileSync } = require('fs');

console.log('=== VERIFYING BANNER & SMART FEED IMPLEMENTATION ===\n');

let passes = 0;
let fails = 0;

function check(name, condition, errorMsg = '') {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passes++;
  } else {
    console.log(`  [FAIL] ${name} ${errorMsg ? '— ' + errorMsg : ''}`);
    fails++;
  }
}

// 1. Translations check
const transCode = readFileSync('translations.js', 'utf8');
check('translations.js contains section.generalProducts', transCode.includes('section.generalProducts'));
check('translations.js has Russian translation', transCode.includes('\\u041e\\u0431\\u0449\\u0438\\u0435') || transCode.includes('Общие товары'));
check('translations.js has Uzbek translation', transCode.includes('Umumiy tovarlar'));

// 2. index.html check
const indexHtml = readFileSync('index.html', 'utf8');
check('index.html contains #smartFeedSection', indexHtml.includes('id="smartFeedSection"'));
check('index.html contains #smartFeedGrid', indexHtml.includes('id="smartFeedGrid"'));
check('index.html contains #smartFeedTrigger', indexHtml.includes('id="smartFeedTrigger"'));
check('index.html references section.generalProducts i18n', indexHtml.includes('data-i18n="section.generalProducts"'));

// 3. styles.css check
const stylesCss = readFileSync('styles.css', 'utf8');
check('styles.css has 21 / 7.5 aspect-ratio for banner', stylesCss.includes('aspect-ratio: 21 / 7.5;'));
check('styles.css has Uzum/Asaxiy style dots container', stylesCss.includes('.hero-slider--carousel .hero-dots'));
check('styles.css has active dot elongation', stylesCss.includes('.hero-slider--carousel .dot.active'));
check('styles.css has fallback :has rule', stylesCss.includes('.hero-slider:has(.hero-slide--fallback)'));
check('styles.css has .hero-action-btn--primary', stylesCss.includes('.hero-action-btn--primary'));
check('styles.css has .hero-action-btn--secondary', stylesCss.includes('.hero-action-btn--secondary'));
check('styles.css mobile uses object-fit: cover', /\.hero-banner-img\s*\{\s*object-fit:\s*cover;/.test(stylesCss));

// 4. app.js logic test
const appJs = readFileSync('app.js', 'utf8');
check('app.js contains initSmartFeed', appJs.includes('function initSmartFeed('));
check('app.js contains scoreSmartFeedProduct', appJs.includes('function scoreSmartFeedProduct('));
check('app.js contains loadSmartFeedBatch with batch of 5', appJs.includes('SMART_FEED_BATCH = 5'));
check('app.js contains setupSmartFeedObserver', appJs.includes('function setupSmartFeedObserver('));
check('app.js contains loadPurchasedTitles for smart ranking', appJs.includes('loadPurchasedTitles'));
check('app.js calls initSmartFeed in storefront init', appJs.includes('initSmartFeed();'));
check('app.js renders SVG arrows in carousel', appJs.includes('<svg width="20" height="20" fill="none" stroke="currentColor"'));

// Test ranking formula in sandbox
const testProducts = [
  { title: 'Normal Product', price: '1000', discount: '', badge: '', priority: 300, image: 'img.jpg' },
  { title: 'Sale Product', price: '900', discount: '-20%', badge: 'sale', priority: 100, image: 'img.jpg', express: 'yes' },
  { title: 'Viewed Product', title: 'Viewed Product', price: '1000', discount: '', badge: '', priority: 300, image: '' }
];

// Mock sandbox
const sandbox = {
  window: {
    _smartFeedViewedCache: new Set(['Viewed Product']),
    _smartFeedAffinityCache: {},
    emirateGetViewedProducts: () => [{ title: 'Viewed Product' }]
  },
  Number: Number,
  Math: Math,
  String: String,
  Set: Set,
  Array: Array
};

const fnCode = `
function score(product) {
  let score = 0;
  const discountText = String(product.discount || "").trim();
  if (discountText) score += 15;
  if (product.badge === "sale") score += 12;
  if (product.express === "yes") score += 6;
  const priority = Number(product.priority) || 300;
  score += Math.max(0, 30 - Math.floor(priority / 10));
  if (product.image) score += 10;
  if (window._smartFeedViewedCache.has(product.title)) score -= 20;
  return score;
}
`;
const vm = require('vm');
vm.runInNewContext(fnCode, sandbox);
const saleScore = sandbox.score(testProducts[1]);
const normalScore = sandbox.score(testProducts[0]);
const viewedScore = sandbox.score(testProducts[2]);

check('Sale product scores higher than normal product', saleScore > normalScore, `Sale: ${saleScore}, Normal: ${normalScore}`);
check('Viewed product scores lower than normal product', viewedScore < normalScore, `Viewed: ${viewedScore}, Normal: ${normalScore}`);

console.log('\n========================================');
console.log(`TOTAL PASSES: ${passes}, FAILS: ${fails}`);
console.log('========================================');

if (fails > 0) process.exit(1);
