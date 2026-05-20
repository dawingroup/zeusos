/**
 * Operational Analytics -> BigQuery sync
 *
 * Streams Firestore snapshots for operational entities into BigQuery so
 * reporting can run without stressing transactional Firestore queries.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const DATASET = process.env.BIGQUERY_OPERATIONAL_DATASET || 'dawinos_operational';
const TABLES = {
  inventory: 'inventory_items_snapshots',
  stockLevels: 'stock_levels_snapshots',
  salesOrders: 'sales_orders_snapshots',
  projects: 'projects_snapshots',
  customers: 'customers_snapshots',
  suppliers: 'suppliers_snapshots',
};

function timestampToIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toJSONString(value) {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (err) {
    logger.warn('Failed to JSON stringify value for BigQuery', err);
    return null;
  }
}

function getBigQueryTable(tableName) {
  const { BigQuery } = require('@google-cloud/bigquery');
  const bigquery = new BigQuery();
  return bigquery.dataset(DATASET).table(tableName);
}

async function insertRows(tableName, rows) {
  if (!rows.length) return;
  try {
    const table = getBigQueryTable(tableName);
    await table.insert(rows, { ignoreUnknownValues: true, skipInvalidRows: true });
  } catch (err) {
    logger.warn(`[BigQuery] Insert warning (${tableName})`, err?.message || err);
  }
}

function mapInventoryRow(docId, data, operation, eventId) {
  const updatedAtIso = timestampToIso(data?.updatedAt) || new Date().toISOString();
  return {
    snapshot_id: `${docId}_${updatedAtIso}_${operation}`,
    event_id: eventId || null,
    operation,
    item_id: docId,
    sku: data?.sku || null,
    name: data?.name || null,
    display_name: data?.displayName || null,
    category: data?.category || null,
    subcategory: data?.subcategory || null,
    status: data?.status || null,
    tier: data?.tier || null,
    source: data?.source || null,
    classification: data?.classification || null,
    item_type: data?.itemType || null,
    family_id: data?.familyId || null,
    is_family: Boolean(data?.isFamily),
    is_orderable: data?.isOrderable === undefined ? null : Boolean(data?.isOrderable),
    inventory_in_stock: toNumber(data?.inventory?.inStock, 0),
    reorder_level: toNumber(data?.inventory?.reorderLevel, 0),
    cost_per_unit: toNumber(data?.pricing?.costPerUnit, 0),
    cost_currency: data?.pricing?.currency || null,
    cost_unit: data?.pricing?.unit || null,
    tags_json: toJSONString(data?.tags || []),
    linked_project_ids_json: toJSONString(data?.linkedProjectIds || []),
    created_at: timestampToIso(data?.createdAt),
    updated_at: timestampToIso(data?.updatedAt),
    captured_at: new Date().toISOString(),
  };
}

function mapStockLevelRow(docId, data, operation, eventId) {
  const updatedAtIso = timestampToIso(data?.updatedAt) || new Date().toISOString();
  return {
    snapshot_id: `${docId}_${updatedAtIso}_${operation}`,
    event_id: eventId || null,
    operation,
    stock_level_id: docId,
    inventory_item_id: data?.inventoryItemId || null,
    warehouse_id: data?.warehouseId || null,
    sku: data?.sku || null,
    item_name: data?.itemName || null,
    quantity_on_hand: toNumber(data?.quantityOnHand, 0),
    quantity_reserved: toNumber(data?.quantityReserved, 0),
    quantity_available: toNumber(data?.quantityAvailable, 0),
    reorder_level: toNumber(data?.reorderLevel, 0),
    last_received_at: timestampToIso(data?.lastReceivedAt),
    last_consumed_at: timestampToIso(data?.lastConsumedAt),
    updated_at: timestampToIso(data?.updatedAt),
    captured_at: new Date().toISOString(),
  };
}

function mapSalesOrderRow(docId, data, operation, eventId) {
  const updatedAtIso = timestampToIso(data?.updatedAt) || new Date().toISOString();
  return {
    snapshot_id: `${docId}_${updatedAtIso}_${operation}`,
    event_id: eventId || null,
    operation,
    sales_order_id: docId,
    order_number: data?.orderNumber || null,
    subsidiary_id: data?.subsidiaryId || null,
    status: data?.status || null,
    customer_id: data?.customerId || null,
    customer_name: data?.customerName || null,
    design_project_id: data?.designProjectId || null,
    quote_id: data?.quoteId || null,
    currency: data?.currency || null,
    original_quote_amount: toNumber(data?.originalQuoteAmount, 0),
    current_amount: toNumber(data?.currentAmount, 0),
    total_discount_amount: toNumber(data?.totalDiscountAmount, 0),
    total_discount_percent: toNumber(data?.totalDiscountPercent, 0),
    total_change_order_value: toNumber(data?.totalChangeOrderValue, 0),
    total_paid: toNumber(data?.totalPaid, 0),
    balance_remaining: toNumber(data?.balanceRemaining, 0),
    line_item_count: Array.isArray(data?.scopeItems) ? data.scopeItems.length : 0,
    risk_flag_count: Array.isArray(data?.riskFlags) ? data.riskFlags.length : 0,
    payment_count: Array.isArray(data?.payments) ? data.payments.length : 0,
    gates_json: toJSONString(data?.gates || {}),
    payment_terms_json: toJSONString(data?.paymentTerms || {}),
    created_at: timestampToIso(data?.createdAt),
    updated_at: timestampToIso(data?.updatedAt),
    expected_delivery_date: timestampToIso(data?.expectedDeliveryDate),
    captured_at: new Date().toISOString(),
  };
}

function mapProjectRow(docId, data, operation, eventId, sourceCollection = 'projects') {
  const updatedAtIso = timestampToIso(data?.updatedAt) || new Date().toISOString();
  return {
    snapshot_id: `${sourceCollection}_${docId}_${updatedAtIso}_${operation}`,
    event_id: eventId || null,
    operation,
    source_collection: sourceCollection,
    project_id: docId,
    code: data?.code || data?.projectCode || null,
    name: data?.name || data?.title || null,
    project_type: data?.type || data?.projectType || null,
    status: data?.status || null,
    subsidiary_id: data?.subsidiaryId || null,
    customer_id: data?.customerId || data?.clientId || null,
    customer_name: data?.customerName || data?.clientName || null,
    owner_id: data?.ownerId || data?.projectManagerId || null,
    budget_amount: toNumber(data?.budget?.amount ?? data?.budgetAmount ?? data?.totalBudget, 0),
    budget_currency: data?.budget?.currency || data?.currency || null,
    start_date: timestampToIso(data?.startDate),
    due_date: timestampToIso(data?.dueDate),
    end_date: timestampToIso(data?.endDate || data?.completedDate),
    created_at: timestampToIso(data?.createdAt),
    updated_at: timestampToIso(data?.updatedAt),
    metadata_json: toJSONString(data),
    captured_at: new Date().toISOString(),
  };
}

function mapCustomerRow(docId, data, operation, eventId, sourceCollection = 'customers') {
  const updatedAtIso = timestampToIso(data?.updatedAt) || new Date().toISOString();
  return {
    snapshot_id: `${sourceCollection}_${docId}_${updatedAtIso}_${operation}`,
    event_id: eventId || null,
    operation,
    source_collection: sourceCollection,
    customer_id: docId,
    code: data?.code || null,
    name: data?.name || data?.customerName || null,
    customer_type: data?.type || data?.customerType || null,
    status: data?.status || null,
    email: data?.email || null,
    phone: data?.phone || data?.phoneNumber || null,
    city: data?.billingAddress?.city || data?.address?.city || null,
    country: data?.billingAddress?.country || data?.address?.country || null,
    tags_json: toJSONString(data?.tags || []),
    external_ids_json: toJSONString(data?.externalIds || {}),
    created_at: timestampToIso(data?.createdAt),
    updated_at: timestampToIso(data?.updatedAt),
    metadata_json: toJSONString(data),
    captured_at: new Date().toISOString(),
  };
}

function mapSupplierRow(docId, data, operation, eventId, sourceCollection = 'platform/suppliers/records') {
  const updatedAtIso = timestampToIso(data?.updatedAt || data?.audit?.updatedAt) || new Date().toISOString();
  return {
    snapshot_id: `${sourceCollection.replace(/\//g, '_')}_${docId}_${updatedAtIso}_${operation}`,
    event_id: eventId || null,
    operation,
    source_collection: sourceCollection,
    supplier_id: docId,
    code: data?.code || null,
    name: data?.name || data?.tradeName || data?.companyName || null,
    contact_person: data?.contactPerson || data?.contactName || null,
    status: data?.status || null,
    email: data?.email || null,
    phone: data?.phone || null,
    city: data?.address?.city || data?.city || null,
    country: data?.address?.country || data?.country || null,
    categories_json: toJSONString(data?.categories || data?.materialCategories || []),
    subsidiaries_json: toJSONString(data?.subsidiaries || []),
    rating: toNumber(data?.rating, 0),
    total_orders: toNumber(data?.totalOrders, 0),
    total_value_amount: toNumber(data?.totalValue?.amount ?? data?.totalValue, 0),
    total_value_currency: data?.totalValue?.currency || data?.currency || null,
    external_ids_json: toJSONString(data?.externalIds || {}),
    created_at: timestampToIso(data?.createdAt || data?.audit?.createdAt),
    updated_at: timestampToIso(data?.updatedAt || data?.audit?.updatedAt),
    metadata_json: toJSONString(data),
    captured_at: new Date().toISOString(),
  };
}

async function syncFirestoreWrite(event, tableName, mapper) {
  const beforeExists = event.data?.before?.exists;
  const afterExists = event.data?.after?.exists;

  let operation = null;
  let docId = null;
  let payload = null;

  if (!beforeExists && afterExists) {
    operation = 'CREATE';
    docId = event.data.after.id;
    payload = event.data.after.data();
  } else if (beforeExists && afterExists) {
    operation = 'UPDATE';
    docId = event.data.after.id;
    payload = event.data.after.data();
  } else if (beforeExists && !afterExists) {
    operation = 'DELETE';
    docId = event.data.before.id;
    payload = event.data.before.data();
  } else {
    return;
  }

  const row = mapper(docId, payload, operation, event.id);
  await insertRows(tableName, [row]);
}

async function backfillCollection(collectionName, tableName, mapper, limitCount = 500) {
  const snap = await db.collection(collectionName).limit(limitCount).get();
  if (snap.empty) return 0;

  const rows = snap.docs.map((doc) =>
    mapper(doc.id, doc.data(), 'SNAPSHOT', `backfill-${collectionName}`)
  );
  await insertRows(tableName, rows);
  return rows.length;
}

async function backfillCollectionWithSource(collectionName, tableName, mapper, sourceCollection, limitCount = 500) {
  const snap = await db.collection(collectionName).limit(limitCount).get();
  if (snap.empty) return 0;

  const rows = snap.docs.map((doc) =>
    mapper(doc.id, doc.data(), 'SNAPSHOT', `backfill-${collectionName}`, sourceCollection)
  );
  await insertRows(tableName, rows);
  return rows.length;
}

const onInventoryItemWritten = onDocumentWritten(
  {
    document: 'inventoryItems/{itemId}',
    region: 'us-central1',
  },
  async (event) => syncFirestoreWrite(event, TABLES.inventory, mapInventoryRow)
);

const onStockLevelWritten = onDocumentWritten(
  {
    document: 'stockLevels/{stockLevelId}',
    region: 'us-central1',
  },
  async (event) => syncFirestoreWrite(event, TABLES.stockLevels, mapStockLevelRow)
);

const onSalesOrderWritten = onDocumentWritten(
  {
    document: 'salesOrders/{orderId}',
    region: 'us-central1',
  },
  async (event) => syncFirestoreWrite(event, TABLES.salesOrders, mapSalesOrderRow)
);

const onProjectWritten = onDocumentWritten(
  {
    document: 'projects/{projectId}',
    region: 'us-central1',
  },
  async (event) =>
    syncFirestoreWrite(event, TABLES.projects, (docId, data, operation, eventId) =>
      mapProjectRow(docId, data, operation, eventId, 'projects')
    )
);

const onMatflowProjectWritten = onDocumentWritten(
  {
    document: 'matflow_projects/{projectId}',
    region: 'us-central1',
  },
  async (event) =>
    syncFirestoreWrite(event, TABLES.projects, (docId, data, operation, eventId) =>
      mapProjectRow(docId, data, operation, eventId, 'matflow_projects')
    )
);

const onCustomerWritten = onDocumentWritten(
  {
    document: 'customers/{customerId}',
    region: 'us-central1',
  },
  async (event) =>
    syncFirestoreWrite(event, TABLES.customers, (docId, data, operation, eventId) =>
      mapCustomerRow(docId, data, operation, eventId, 'customers')
    )
);

const onAdvisoryCustomerWritten = onDocumentWritten(
  {
    document: 'advisoryPlatform/matflow/customers/{customerId}',
    region: 'us-central1',
  },
  async (event) =>
    syncFirestoreWrite(event, TABLES.customers, (docId, data, operation, eventId) =>
      mapCustomerRow(docId, data, operation, eventId, 'advisoryPlatform/matflow/customers')
    )
);

const onSupplierWritten = onDocumentWritten(
  {
    document: 'platform/suppliers/records/{supplierId}',
    region: 'us-central1',
  },
  async (event) =>
    syncFirestoreWrite(event, TABLES.suppliers, (docId, data, operation, eventId) =>
      mapSupplierRow(docId, data, operation, eventId, 'platform/suppliers/records')
    )
);

const onAdvisorySupplierWritten = onDocumentWritten(
  {
    document: 'advisoryPlatform/matflow/suppliers/{supplierId}',
    region: 'us-central1',
  },
  async (event) =>
    syncFirestoreWrite(event, TABLES.suppliers, (docId, data, operation, eventId) =>
      mapSupplierRow(docId, data, operation, eventId, 'advisoryPlatform/matflow/suppliers')
    )
);

const onLegacySupplierWritten = onDocumentWritten(
  {
    document: 'suppliers/{supplierId}',
    region: 'us-central1',
  },
  async (event) =>
    syncFirestoreWrite(event, TABLES.suppliers, (docId, data, operation, eventId) =>
      mapSupplierRow(docId, data, operation, eventId, 'suppliers')
    )
);

const backfillOperationalBigQuery = onCall(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: '512MiB',
    region: 'us-central1',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userRole = request.auth.token?.role;
    const isAdmin =
      request.auth.token?.admin === true ||
      userRole === 'admin' ||
      userRole === 'owner' ||
      userRole === 'superadmin';

    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Admin role required');
    }

    const limitCount = Math.min(Number(request.data?.limit) || 500, 5000);

    const [
      inventoryRows,
      stockRows,
      soRows,
      projectRows,
      matflowProjectRows,
      customerRows,
      advisoryCustomerRows,
      supplierRows,
      advisorySupplierRows,
      legacySupplierRows,
    ] = await Promise.all([
      backfillCollection('inventoryItems', TABLES.inventory, mapInventoryRow, limitCount),
      backfillCollection('stockLevels', TABLES.stockLevels, mapStockLevelRow, limitCount),
      backfillCollection('salesOrders', TABLES.salesOrders, mapSalesOrderRow, limitCount),
      backfillCollectionWithSource('projects', TABLES.projects, mapProjectRow, 'projects', limitCount),
      backfillCollectionWithSource('matflow_projects', TABLES.projects, mapProjectRow, 'matflow_projects', limitCount),
      backfillCollectionWithSource('customers', TABLES.customers, mapCustomerRow, 'customers', limitCount),
      backfillCollectionWithSource(
        'advisoryPlatform/matflow/customers',
        TABLES.customers,
        mapCustomerRow,
        'advisoryPlatform/matflow/customers',
        limitCount
      ),
      backfillCollectionWithSource(
        'platform/suppliers/records',
        TABLES.suppliers,
        mapSupplierRow,
        'platform/suppliers/records',
        limitCount
      ),
      backfillCollectionWithSource(
        'advisoryPlatform/matflow/suppliers',
        TABLES.suppliers,
        mapSupplierRow,
        'advisoryPlatform/matflow/suppliers',
        limitCount
      ),
      backfillCollectionWithSource('suppliers', TABLES.suppliers, mapSupplierRow, 'suppliers', limitCount),
    ]);

    return {
      success: true,
      dataset: DATASET,
      limit: limitCount,
      inserted: {
        inventoryItems: inventoryRows,
        stockLevels: stockRows,
        salesOrders: soRows,
        projects: projectRows + matflowProjectRows,
        customers: customerRows + advisoryCustomerRows,
        suppliers: supplierRows + advisorySupplierRows + legacySupplierRows,
      },
    };
  }
);

module.exports = {
  onInventoryItemWritten,
  onStockLevelWritten,
  onSalesOrderWritten,
  onProjectWritten,
  onMatflowProjectWritten,
  onCustomerWritten,
  onAdvisoryCustomerWritten,
  onSupplierWritten,
  onAdvisorySupplierWritten,
  onLegacySupplierWritten,
  backfillOperationalBigQuery,
};
