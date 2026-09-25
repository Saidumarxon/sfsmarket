/**
 * EMIRATE CO / SFS MARKET
 * Phase 3D: Live Post-Migration Verification Script
 */

const SUPABASE_URL = 'https://efoujwgalbnfrodgkqyl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmb3Vqd2dhbGJuZnJvZGdrcXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM0MDcsImV4cCI6MjA5NDIzOTQwN30.NbE5q-vi1YTlp7hGvGZmRGZgjnv2SW1S6kYfQMT5KBU';

async function fetchSupabase(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
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

async function verifyAll() {
  console.log('=== PHASE 3D LIVE VERIFICATION ===\n');

  // 1. Inventory Tables
  console.log('--- 1. INVENTORY TABLES ---');
  const inventoryTables = [
    'contractors',
    'warehouses',
    'receipts',
    'receipt_items',
    'stock_balances',
    'stock_movements',
    'contractor_transactions'
  ];
  for (const t of inventoryTables) {
    const res = await fetchSupabase(`${t}?select=*&limit=1`, { headers: { Prefer: 'count=exact' } });
    console.log(`Table ${t}: HTTP ${res.status} | code: ${res.json?.code || 'N/A'} | msg: ${res.json?.message || (res.status === 200 ? 'OK' : res.text)}`);
  }

  // 2. Warehouses (MAIN)
  console.log('\n--- 2. WAREHOUSE MAIN ---');
  const whRes = await fetchSupabase(`warehouses?code=eq.MAIN&select=*`);
  console.log(`warehouses?code=eq.MAIN: HTTP ${whRes.status} | msg: ${whRes.json?.message || whRes.text}`);

  // 3. Products Compatibility & Integrity
  console.log('\n--- 3. PRODUCTS INTEGRITY ---');
  const prodsRes = await fetchSupabase('products?select=admin_id,title,updated_at&order=admin_id.asc&limit=100', {
    headers: { Prefer: 'count=exact' }
  });
  if (Array.isArray(prodsRes.json)) {
    const ids = prodsRes.json.map(p => p.admin_id);
    const uniqueIds = new Set(ids);
    console.log(`Products count: ${prodsRes.json.length}`);
    console.log(`Unique admin_ids: ${uniqueIds.size}`);
    console.log(`Duplicate IDs: ${ids.length - uniqueIds.size}`);
    console.log(`Non-string IDs: ${ids.filter(id => typeof id !== 'string').length}`);
    console.log(`Empty IDs: ${ids.filter(id => !id || !id.trim()).length}`);
  } else {
    console.log(`Products query failed: HTTP ${prodsRes.status}`, prodsRes.text);
  }

  // 4. Core Customer / Order / Loyalty Tables
  console.log('\n--- 4. CORE CUSTOMER / ORDER / LOYALTY TABLES ---');
  const coreTables = ['orders', 'customer_profiles', 'bonus_transactions', 'admin_users'];
  for (const t of coreTables) {
    const res = await fetchSupabase(`${t}?select=*&limit=1`, { headers: { Prefer: 'count=exact' } });
    console.log(`Core table ${t}: HTTP ${res.status} | range: ${res.headers['content-range'] || 'N/A'}`);
  }

  // 5. RPC Functions
  console.log('\n--- 5. RPC FUNCTIONS ---');
  const rpcs = [
    { name: 'post_receipt', method: 'POST', body: {} },
    { name: 'cancel_receipt', method: 'POST', body: {} },
    { name: 'record_contractor_payment', method: 'POST', body: {} },
    { name: 'get_contractor_summary', method: 'POST', body: {} },
    { name: 'get_contractors_summary', method: 'POST', body: {} },
    { name: 'is_trusted_admin', method: 'POST', body: {} },
    { name: 'generate_receipt_number', method: 'POST', body: {} },
    { name: 'get_customer_loyalty_summary', method: 'POST', body: {} }
  ];
  for (const r of rpcs) {
    const res = await fetchSupabase(`rpc/${r.name}`, { method: r.method, body: r.body });
    console.log(`RPC ${r.name}: HTTP ${res.status} | code: ${res.json?.code || 'N/A'} | msg: ${res.json?.message || res.text.slice(0, 80)}`);
  }
}

verifyAll();
