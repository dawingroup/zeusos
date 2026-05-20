-- ============================================================================
-- DawinOS Operational Analytics - BigQuery Schema
-- Dataset: dawinos_operational
-- ============================================================================

-- Create dataset (example):
-- bq mk --dataset --location=US dawinos:dawinos_operational

-- ============================================================================
-- 1) INVENTORY ITEM SNAPSHOTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `dawinos_operational.inventory_items_snapshots` (
  snapshot_id STRING NOT NULL,
  event_id STRING,
  operation STRING, -- CREATE | UPDATE | DELETE | SNAPSHOT
  item_id STRING NOT NULL,
  sku STRING,
  name STRING,
  display_name STRING,
  category STRING,
  subcategory STRING,
  status STRING,
  tier STRING,
  source STRING,
  classification STRING,
  item_type STRING,
  family_id STRING,
  is_family BOOL,
  is_orderable BOOL,
  inventory_in_stock FLOAT64,
  reorder_level FLOAT64,
  cost_per_unit FLOAT64,
  cost_currency STRING,
  cost_unit STRING,
  tags_json STRING,
  linked_project_ids_json STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(captured_at)
CLUSTER BY item_id, category, status;

-- ============================================================================
-- 2) STOCK LEVEL SNAPSHOTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `dawinos_operational.stock_levels_snapshots` (
  snapshot_id STRING NOT NULL,
  event_id STRING,
  operation STRING, -- CREATE | UPDATE | DELETE | SNAPSHOT
  stock_level_id STRING NOT NULL,
  inventory_item_id STRING,
  warehouse_id STRING,
  sku STRING,
  item_name STRING,
  quantity_on_hand FLOAT64,
  quantity_reserved FLOAT64,
  quantity_available FLOAT64,
  reorder_level FLOAT64,
  last_received_at TIMESTAMP,
  last_consumed_at TIMESTAMP,
  updated_at TIMESTAMP,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(captured_at)
CLUSTER BY inventory_item_id, warehouse_id;

-- ============================================================================
-- 3) SALES ORDER SNAPSHOTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS `dawinos_operational.sales_orders_snapshots` (
  snapshot_id STRING NOT NULL,
  event_id STRING,
  operation STRING, -- CREATE | UPDATE | DELETE | SNAPSHOT
  sales_order_id STRING NOT NULL,
  order_number STRING,
  subsidiary_id STRING,
  status STRING,
  customer_id STRING,
  customer_name STRING,
  design_project_id STRING,
  quote_id STRING,
  currency STRING,
  original_quote_amount FLOAT64,
  current_amount FLOAT64,
  total_discount_amount FLOAT64,
  total_discount_percent FLOAT64,
  total_change_order_value FLOAT64,
  total_paid FLOAT64,
  balance_remaining FLOAT64,
  line_item_count INT64,
  risk_flag_count INT64,
  payment_count INT64,
  gates_json STRING,
  payment_terms_json STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  expected_delivery_date TIMESTAMP,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(captured_at)
CLUSTER BY sales_order_id, status, subsidiary_id;

-- ============================================================================
-- 4) PROJECT SNAPSHOTS (Core + Advisory/MatFlow)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `dawinos_operational.projects_snapshots` (
  snapshot_id STRING NOT NULL,
  event_id STRING,
  operation STRING, -- CREATE | UPDATE | DELETE | SNAPSHOT
  source_collection STRING,
  project_id STRING NOT NULL,
  code STRING,
  name STRING,
  project_type STRING,
  status STRING,
  subsidiary_id STRING,
  customer_id STRING,
  customer_name STRING,
  owner_id STRING,
  budget_amount FLOAT64,
  budget_currency STRING,
  start_date TIMESTAMP,
  due_date TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  metadata_json STRING,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(captured_at)
CLUSTER BY project_id, source_collection, status;

-- ============================================================================
-- 5) CUSTOMER SNAPSHOTS (Core + Advisory/MatFlow)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `dawinos_operational.customers_snapshots` (
  snapshot_id STRING NOT NULL,
  event_id STRING,
  operation STRING, -- CREATE | UPDATE | DELETE | SNAPSHOT
  source_collection STRING,
  customer_id STRING NOT NULL,
  code STRING,
  name STRING,
  customer_type STRING,
  status STRING,
  email STRING,
  phone STRING,
  city STRING,
  country STRING,
  tags_json STRING,
  external_ids_json STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  metadata_json STRING,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(captured_at)
CLUSTER BY customer_id, source_collection, status;

-- ============================================================================
-- 6) SUPPLIER SNAPSHOTS (Unified + Advisory + Legacy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `dawinos_operational.suppliers_snapshots` (
  snapshot_id STRING NOT NULL,
  event_id STRING,
  operation STRING, -- CREATE | UPDATE | DELETE | SNAPSHOT
  source_collection STRING,
  supplier_id STRING NOT NULL,
  code STRING,
  name STRING,
  contact_person STRING,
  status STRING,
  email STRING,
  phone STRING,
  city STRING,
  country STRING,
  categories_json STRING,
  subsidiaries_json STRING,
  rating FLOAT64,
  total_orders INT64,
  total_value_amount FLOAT64,
  total_value_currency STRING,
  external_ids_json STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  metadata_json STRING,
  captured_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(captured_at)
CLUSTER BY supplier_id, source_collection, status;
