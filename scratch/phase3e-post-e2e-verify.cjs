/**
 * EMIRATE CO / SFS MARKET
 * Phase 3E Post-E2E Verification Script (Read-Only via PostgREST)
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

async function verifyLivePostE2E() {
  console.log('=== PHASE 3E: LIVE AUDIT AFTER E2E EXECUTION ===\n');

  // 1. Check Product T79940 Integrity
  console.log('--- 1. PRODUCT T79940 INTEGRITY ---');
  const pRes = await fetchSupabase('products?admin_id=eq.T79940&select=admin_id,title,status,updated_at');
  console.log('Product T79940 status:', pRes.status, pRes.json);

  // 2. Check Total Products Count
  console.log('\n--- 2. TOTAL PRODUCTS COUNT ---');
  const allProds = await fetchSupabase('products?select=admin_id&limit=100', { headers: { Prefer: 'count=exact' } });
  console.log('Total products count:', allProds.json?.length, 'content-range:', allProds.headers['content-range']);

  // 3. Check Stock Balance for T79940
  console.log('\n--- 3. STOCK BALANCE FOR T79940 ---');
  const stockRes = await fetchSupabase('stock_balances?product_id=eq.T79940&select=*');
  console.log('Stock balance query status:', stockRes.status, 'rows:', stockRes.json);

  // 4. Check Core Tables Integrity
  console.log('\n--- 4. CORE TABLES INTEGRITY ---');
  const coreTables = ['orders', 'customer_profiles', 'bonus_transactions', 'admin_users'];
  for (const t of coreTables) {
    const res = await fetchSupabase(`${t}?select=*&limit=1`, { headers: { Prefer: 'count=exact' } });
    console.log(`Core table ${t}: HTTP ${res.status} | range: ${res.headers['content-range'] || 'N/A'}`);
  }

  // 5. Check Loyalty RPC
  console.log('\n--- 5. CORE LOYALTY RPC ---');
  const loy = await fetchSupabase('rpc/get_customer_loyalty_summary', { method: 'POST', body: {} });
  console.log('get_customer_loyalty_summary status:', loy.status, loy.json);
}

verifyLivePostE2E();
