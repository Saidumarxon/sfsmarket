-- ============================================================
-- EMIRATE CO — Delivery Estimate Column Migration
-- Adds delivery_estimate column to orders table for snapshotting
-- calculated delivery time at time of order creation.
-- Idempotent and safe for repeated execution.
-- ============================================================

alter table public.orders 
  add column if not exists delivery_estimate text;
