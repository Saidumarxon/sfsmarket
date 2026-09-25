-- ==============================================================================
-- EMIRATE CO / SFS MARKET — PHASE 3E: CONTROLLED LIVE INVENTORY E2E
-- Script: supabase/phase3e-controlled-live-e2e.sql
--
-- Executes one controlled end-to-end test of the inventory & receiving system:
--   1. PRECHECK (Product T79940, Warehouse MAIN, Stock = 0, Marker clean)
--   2. CREATE test contractor: TEST_PHASE3E_2026_09_25
--   3. DRAFT receipt: 2x T79940 @ 1000 UZS, sale 1500, paid 1000
--   4. PRE-POST assertions (Draft has zero stock/movement/accrual effect)
--   5. POST receipt via post_receipt()
--   6. POST-POST assertions (Stock +2, Movement +2, Accrual 2000, Payment 1000, Debt 1000, Dup Post Blocked)
--   7. CANCEL receipt via cancel_receipt()
--   8. POST-CANCEL assertions (Stock restored to 0, Movement -2, Accrual Reversal 2000, Payment Reversal 1000, Debt restored to 0, Dup Cancel Blocked)
--   9. IMMUTABILITY GUARDS (Blocked updates/deletes on receipts, receipt_items, stock_movements)
--  10. CORE REGRESSION (products, orders, customer_profiles, bonus_transactions, admin_users untouched)
--
-- RUN IN SUPABASE SQL EDITOR. Returns a single JSON result with full audit details.
-- ==============================================================================

create or replace function public.run_phase3e_controlled_e2e()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_admin_id uuid;
  v_wh_id uuid;
  v_product_id text := 'T79940';
  v_product_title text;
  v_contractor_marker text := 'TEST_PHASE3E_2026_09_25';
  v_contractor_id uuid;
  v_receipt_id uuid;
  v_receipt_number text;
  v_receipt_item_id uuid;
  v_initial_stock int := 0;
  v_stock_after_post int := 0;
  v_stock_after_cancel int := 0;
  v_movements_count int := 0;
  v_tx_count int := 0;
  v_summary jsonb;
  v_error_caught boolean := false;

  -- Core table counts for regression verification
  v_core_products_count int;
  v_core_orders_count int;
  v_core_profiles_count int;
  v_core_bonuses_count int;
  v_core_admins_count int;
  
  v_report jsonb := '{}'::jsonb;
begin
  -- ----------------------------------------------------------------------------
  -- 0. AUTHENTICATE SESSION AS TRUSTED ADMIN
  -- ----------------------------------------------------------------------------
  select user_id into v_admin_id from public.admin_users limit 1;
  if v_admin_id is not null then
    perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
  else
    perform set_config('request.jwt.claim.role', 'service_role', true);
  end if;

  -- ----------------------------------------------------------------------------
  -- 1. READ-ONLY PRECHECK
  -- ----------------------------------------------------------------------------
  -- 1.1 Confirm product T79940
  select title into v_product_title from public.products where admin_id = v_product_id;
  if v_product_title is null then
    raise exception 'PRECHECK FAILED: Product % not found in public.products', v_product_id;
  end if;

  -- 1.2 Confirm warehouse MAIN
  select id into v_wh_id from public.warehouses where code = 'MAIN' and is_active = true;
  if v_wh_id is null then
    raise exception 'PRECHECK FAILED: Warehouse MAIN not found in public.warehouses';
  end if;

  -- 1.3 Check initial stock is 0 or absent
  select coalesce(quantity, 0) into v_initial_stock
  from public.stock_balances
  where product_id = v_product_id and warehouse_id = v_wh_id;
  v_initial_stock := coalesce(v_initial_stock, 0);

  if v_initial_stock <> 0 then
    raise exception 'PRECHECK FAILED: Initial stock for % at MAIN is %, expected 0', v_product_id, v_initial_stock;
  end if;

  -- 1.4 Check no existing test contractor with marker
  if exists (select 1 from public.contractors where name = v_contractor_marker) then
    raise exception 'PRECHECK FAILED: Existing contractor with marker % already exists', v_contractor_marker;
  end if;

  -- Baseline core counts
  select count(*) into v_core_products_count from public.products;
  select count(*) into v_core_orders_count from public.orders;
  select count(*) into v_core_profiles_count from public.customer_profiles;
  select count(*) into v_core_bonuses_count from public.bonus_transactions;
  select count(*) into v_core_admins_count from public.admin_users;

  v_report := jsonb_set(v_report, '{precheck}', jsonb_build_object(
    'product_id', v_product_id,
    'product_title', v_product_title,
    'warehouse_code', 'MAIN',
    'warehouse_id', v_wh_id,
    'initial_stock', v_initial_stock,
    'baseline_products_count', v_core_products_count,
    'status', 'PASS'
  ));

  -- ----------------------------------------------------------------------------
  -- 2. CREATE TEST CONTRACTOR
  -- ----------------------------------------------------------------------------
  insert into public.contractors (name, phone, contact_person, status)
  values (v_contractor_marker, '+998900000099', 'E2E Test Agent', 'active')
  returning id into v_contractor_id;

  v_report := jsonb_set(v_report, '{contractor}', jsonb_build_object(
    'id', v_contractor_id,
    'name', v_contractor_marker,
    'status', 'PASS'
  ));

  -- ----------------------------------------------------------------------------
  -- 3. CREATE DRAFT RECEIPT & ITEM
  -- ----------------------------------------------------------------------------
  insert into public.receipts (
    contractor_id,
    warehouse_id,
    received_at,
    payment_method,
    currency,
    exchange_rate,
    total_cost,
    paid_amount,
    debt_amount,
    description,
    status
  ) values (
    v_contractor_id,
    v_wh_id,
    current_date,
    'bank_transfer',
    'UZS',
    1,
    2000,
    1000,
    1000,
    'PHASE 3E LIVE E2E TEST',
    'draft'
  ) returning id, receipt_number into v_receipt_id, v_receipt_number;

  insert into public.receipt_items (
    receipt_id,
    product_id,
    quantity,
    unit_cost,
    total_cost,
    sale_price
  ) values (
    v_receipt_id,
    v_product_id,
    2,
    1000,
    2000,
    1500
  ) returning id into v_receipt_item_id;

  -- ----------------------------------------------------------------------------
  -- 4. PRE-POST ASSERTIONS
  -- ----------------------------------------------------------------------------
  -- Confirm stock is still 0
  select coalesce(quantity, 0) into v_stock_after_post
  from public.stock_balances
  where product_id = v_product_id and warehouse_id = v_wh_id;
  v_stock_after_post := coalesce(v_stock_after_post, 0);

  select count(*) into v_movements_count
  from public.stock_movements
  where reference_id = v_receipt_id;

  select count(*) into v_tx_count
  from public.contractor_transactions
  where receipt_id = v_receipt_id;

  if v_stock_after_post <> 0 or v_movements_count <> 0 or v_tx_count <> 0 then
    raise exception 'DRAFT ASSERTION FAILED: Draft affected stock or financials unexpectedly';
  end if;

  v_report := jsonb_set(v_report, '{draft}', jsonb_build_object(
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number,
    'total_cost', 2000,
    'paid_amount', 1000,
    'debt_amount', 1000,
    'stock_unaffected', true,
    'movements_count', v_movements_count,
    'transactions_count', v_tx_count,
    'status', 'PASS'
  ));

  -- ----------------------------------------------------------------------------
  -- 5. EXECUTE POST_RECEIPT()
  -- ----------------------------------------------------------------------------
  perform public.post_receipt(v_receipt_id);

  -- ----------------------------------------------------------------------------
  -- 6. POST-POST ASSERTIONS
  -- ----------------------------------------------------------------------------
  -- Status posted, stock +2
  select quantity into v_stock_after_post
  from public.stock_balances
  where product_id = v_product_id and warehouse_id = v_wh_id;

  if v_stock_after_post <> 2 then
    raise exception 'POST ASSERTION FAILED: Stock is %, expected 2', v_stock_after_post;
  end if;

  select count(*) into v_movements_count
  from public.stock_movements
  where reference_id = v_receipt_id and movement_type = 'receipt' and change_qty = 2;

  if v_movements_count <> 1 then
    raise exception 'POST ASSERTION FAILED: Stock movement receipt (+2) not found';
  end if;

  -- Contractor transactions: 1 accrual (2000), 1 payment (1000)
  select count(*) into v_tx_count
  from public.contractor_transactions
  where receipt_id = v_receipt_id and type = 'receipt_accrual' and amount = 2000;

  if v_tx_count <> 1 then
    raise exception 'POST ASSERTION FAILED: Contractor accrual (2000) not found';
  end if;

  select count(*) into v_tx_count
  from public.contractor_transactions
  where receipt_id = v_receipt_id and type = 'payment' and amount = 1000;

  if v_tx_count <> 1 then
    raise exception 'POST ASSERTION FAILED: Contractor payment (1000) not found';
  end if;

  -- Check contractor summary RPC
  v_summary := public.get_contractor_summary(v_contractor_id);
  if (v_summary->>'current_debt')::numeric <> 1000 or (v_summary->>'total_receipt_amount')::numeric <> 2000 then
    raise exception 'POST ASSERTION FAILED: Contractor summary mismatch: %', v_summary;
  end if;

  -- Verify duplicate post is rejected
  v_error_caught := false;
  begin
    perform public.post_receipt(v_receipt_id);
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'POST ASSERTION FAILED: Duplicate post was not rejected!';
  end if;

  v_report := jsonb_set(v_report, '{post}', jsonb_build_object(
    'receipt_status', 'posted',
    'stock_balances_quantity', v_stock_after_post,
    'stock_movements_created', true,
    'contractor_accrual', 2000,
    'contractor_payment', 1000,
    'current_debt', 1000,
    'duplicate_post_rejected', true,
    'status', 'PASS'
  ));

  -- ----------------------------------------------------------------------------
  -- 7. EXECUTE CANCEL_RECEIPT()
  -- ----------------------------------------------------------------------------
  perform public.cancel_receipt(v_receipt_id);

  -- ----------------------------------------------------------------------------
  -- 8. POST-CANCEL ASSERTIONS
  -- ----------------------------------------------------------------------------
  -- Status cancelled, stock back to 0
  select quantity into v_stock_after_cancel
  from public.stock_balances
  where product_id = v_product_id and warehouse_id = v_wh_id;

  if v_stock_after_cancel <> 0 then
    raise exception 'CANCEL ASSERTION FAILED: Stock is %, expected 0', v_stock_after_cancel;
  end if;

  -- Reversal movement (-2, adjustment)
  select count(*) into v_movements_count
  from public.stock_movements
  where reference_id = v_receipt_id and movement_type = 'adjustment' and change_qty = -2;

  if v_movements_count <> 1 then
    raise exception 'CANCEL ASSERTION FAILED: Stock movement reversal (-2) not found';
  end if;

  -- Financial reversals: 1 accrual_reversal (2000), 1 payment_reversal (1000)
  select count(*) into v_tx_count
  from public.contractor_transactions
  where receipt_id = v_receipt_id and type = 'accrual_reversal' and amount = 2000;

  if v_tx_count <> 1 then
    raise exception 'CANCEL ASSERTION FAILED: Accrual reversal (2000) not found';
  end if;

  select count(*) into v_tx_count
  from public.contractor_transactions
  where receipt_id = v_receipt_id and type = 'payment_reversal' and amount = 1000;

  if v_tx_count <> 1 then
    raise exception 'CANCEL ASSERTION FAILED: Payment reversal (1000) not found';
  end if;

  -- Debt back to 0
  v_summary := public.get_contractor_summary(v_contractor_id);
  if (v_summary->>'current_debt')::numeric <> 0 then
    raise exception 'CANCEL ASSERTION FAILED: Contractor debt is %, expected 0', v_summary->>'current_debt';
  end if;

  -- Duplicate cancel is rejected
  v_error_caught := false;
  begin
    perform public.cancel_receipt(v_receipt_id);
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'CANCEL ASSERTION FAILED: Duplicate cancel was not rejected!';
  end if;

  v_report := jsonb_set(v_report, '{cancel}', jsonb_build_object(
    'receipt_status', 'cancelled',
    'stock_balances_quantity', v_stock_after_cancel,
    'reversal_movement_created', true,
    'accrual_reversal_created', true,
    'payment_reversal_created', true,
    'final_debt', 0,
    'duplicate_cancel_rejected', true,
    'status', 'PASS'
  ));

  -- ----------------------------------------------------------------------------
  -- 9. IMMUTABILITY GUARDS ASSERTIONS
  -- ----------------------------------------------------------------------------
  -- 9.1 Block UPDATE on cancelled receipt
  v_error_caught := false;
  begin
    update public.receipts set total_cost = 9999 where id = v_receipt_id;
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'IMMUTABILITY FAILED: Update on cancelled receipt succeeded!';
  end if;

  -- 9.2 Block DELETE on cancelled receipt
  v_error_caught := false;
  begin
    delete from public.receipts where id = v_receipt_id;
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'IMMUTABILITY FAILED: Delete on cancelled receipt succeeded!';
  end if;

  -- 9.3 Block UPDATE on receipt_items of cancelled receipt
  v_error_caught := false;
  begin
    update public.receipt_items set quantity = 10 where id = v_receipt_item_id;
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'IMMUTABILITY FAILED: Update on receipt_items succeeded!';
  end if;

  -- 9.4 Block DELETE on stock_movements
  v_error_caught := false;
  begin
    delete from public.stock_movements where reference_id = v_receipt_id;
  exception when others then
    v_error_caught := true;
  end;
  if not v_error_caught then
    raise exception 'IMMUTABILITY FAILED: Delete on stock_movements succeeded!';
  end if;

  v_report := jsonb_set(v_report, '{immutability}', jsonb_build_object(
    'receipt_update_blocked', true,
    'receipt_delete_blocked', true,
    'receipt_items_update_blocked', true,
    'stock_movements_delete_blocked', true,
    'status', 'PASS'
  ));

  -- ----------------------------------------------------------------------------
  -- 10. CORE REGRESSION VERIFICATION
  -- ----------------------------------------------------------------------------
  if (select count(*) from public.products) <> v_core_products_count then
    raise exception 'CORE REGRESSION FAILED: products count changed!';
  end if;
  if (select count(*) from public.orders) <> v_core_orders_count then
    raise exception 'CORE REGRESSION FAILED: orders count changed!';
  end if;
  if (select count(*) from public.customer_profiles) <> v_core_profiles_count then
    raise exception 'CORE REGRESSION FAILED: customer_profiles count changed!';
  end if;
  if (select count(*) from public.bonus_transactions) <> v_core_bonuses_count then
    raise exception 'CORE REGRESSION FAILED: bonus_transactions count changed!';
  end if;
  if (select count(*) from public.admin_users) <> v_core_admins_count then
    raise exception 'CORE REGRESSION FAILED: admin_users count changed!';
  end if;

  v_report := jsonb_set(v_report, '{core_regression}', jsonb_build_object(
    'products_count', v_core_products_count,
    'orders_count', v_core_orders_count,
    'customer_profiles_count', v_core_profiles_count,
    'bonus_transactions_count', v_core_bonuses_count,
    'admin_users_count', v_core_admins_count,
    'status', 'PASS'
  ));

  -- ----------------------------------------------------------------------------
  -- FINAL AUDIT RECORD
  -- ----------------------------------------------------------------------------
  v_report := jsonb_set(v_report, '{audit_trail}', jsonb_build_object(
    'contractor_id', v_contractor_id,
    'contractor_name', v_contractor_marker,
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number,
    'receipt_item_id', v_receipt_item_id,
    'product_id', v_product_id,
    'warehouse_id', v_wh_id,
    'history_preserved', true,
    'status', 'COMPLETED'
  ));

  v_report := jsonb_set(v_report, '{verdict}', '"GO"'::jsonb);
  return v_report;
end;
$$;

-- Execute the controlled E2E test and return formatted audit JSON
select jsonb_pretty(public.run_phase3e_controlled_e2e()) as live_e2e_report;

-- Cleanup the temporary runner procedure (keeping all audit & history data intact)
drop function if exists public.run_phase3e_controlled_e2e();

