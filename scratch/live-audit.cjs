const SUPABASE_URL = 'https://efoujwgalbnfrodgkqyl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU';

async function fetchFromSupabase(endpoint, headers = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      ...headers
    }
  });
  const text = await res.text();
  try {
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), data: JSON.parse(text) };
  } catch (_) {
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), data: text };
  }
}

async function runComprehensiveAudit() {
  console.log('================================================================');
  console.log('LIVE READ-ONLY AUDIT: EMIRATE CO / SFS MARKET');
  console.log('================================================================\n');

  // --- SECTION 1: PRODUCTS ---
  console.log('--- 1. PRODUCTS COMPATIBILITY ---');
  // Get product count using count=exact
  const prodCountRes = await fetchFromSupabase('products?select=admin_id,title,status,priority,updated_at', {
    'Prefer': 'count=exact',
    'Range': '0-0'
  });
  const totalProducts = prodCountRes.headers['content-range'] || 'unknown';
  console.log('Products Content-Range header:', totalProducts);

  // Fetch all product admin_ids to check count and duplicates
  const allProdsRes = await fetchFromSupabase('products?select=admin_id,title,status&limit=1000');
  if (Array.isArray(allProdsRes.data)) {
    console.log('Total fetched products:', allProdsRes.data.length);
    const adminIds = allProdsRes.data.map(p => p.admin_id);
    const uniqueIds = new Set(adminIds);
    console.log('Unique admin_id count:', uniqueIds.size);
    console.log('Duplicate IDs found:', adminIds.length - uniqueIds.size);
    console.log('Sample admin_ids:', adminIds.slice(0, 8));
    const nonStringIds = adminIds.filter(id => typeof id !== 'string');
    console.log('Non-string admin_ids:', nonStringIds.length);
    console.log('Empty or blank admin_ids:', adminIds.filter(id => !id || !id.trim()).length);
  } else {
    console.log('Failed to fetch products:', allProdsRes);
  }

  // --- SECTION 2: INVENTORY TABLES ---
  console.log('\n--- 2. INVENTORY TABLES EXISTENCE & STATUS ---');
  const inventoryTables = [
    'contractors',
    'warehouses',
    'receipts',
    'receipt_items',
    'stock_balances',
    'stock_movements',
    'contractor_transactions'
  ];

  for (const table of inventoryTables) {
    const res = await fetchFromSupabase(`${table}?select=*&limit=1`, {
      'Prefer': 'count=exact'
    });
    console.log(`Table '${table}': HTTP ${res.status}`);
    if (res.status === 200) {
      console.log(`  -> EXISTS! Rows:`, res.headers['content-range'] || res.data?.length, `Sample:`, res.data);
    } else if (res.status === 404) {
      console.log(`  -> ABSENT (HTTP 404 - Not in schema cache / not created yet)`);
    } else if (res.status === 401 || res.status === 403) {
      console.log(`  -> PROTECTED BY RLS or PERMISSIONS (HTTP ${res.status}):`, res.data?.message || res.data);
    } else {
      console.log(`  -> Status ${res.status}:`, res.data);
    }
  }

  // --- SECTION 3: OTHER RELEVANT OBJECTS ---
  console.log('\n--- 3. CHECKING ADMIN USERS & RPCs ---');
  const adminCheck = await fetchFromSupabase('admin_users?select=*&limit=5');
  console.log('admin_users table:', adminCheck.status, Array.isArray(adminCheck.data) ? `rows: ${adminCheck.data.length}` : adminCheck.data);

  // Check RPCs existence via POST with dummy params (expecting error or 404)
  const rpcsToCheck = ['post_receipt', 'cancel_receipt', 'get_contractor_summary', 'get_contractors_summary', 'is_trusted_admin'];
  for (const rpc of rpcsToCheck) {
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const rpcText = await rpcRes.text();
    console.log(`RPC '${rpc}': HTTP ${rpcRes.status} -> ${rpcText.slice(0, 120)}`);
  }

  // --- SECTION 4: CUSTOMER / ORDER CORE TABLES (SAFETY AUDIT) ---
  console.log('\n--- 4. CORE CUSTOMER / ORDER TABLES INTEGRITY ---');
  const coreTables = ['orders', 'order_items', 'customer_profiles', 'bonus_transactions'];
  for (const table of coreTables) {
    const res = await fetchFromSupabase(`${table}?select=*&limit=1`, { 'Prefer': 'count=exact' });
    console.log(`Core table '${table}': HTTP ${res.status}, count-range: ${res.headers['content-range'] || 'N/A'}`);
  }
}

runComprehensiveAudit();
