/**
 * QuickBooks Item Resolution Service
 * Resolves DawinOS items to QBO items: search by name, create if missing, cache for reuse.
 * DawinOS is the source of truth for line items on Sales Orders, Invoices, and Bills.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { refreshTokens, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('./auth');
const { ALLOWED_ORIGINS } = require('../../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

// ----------------------------------------------------------------------------
// HELPER: Authenticated QBO API Request
// ----------------------------------------------------------------------------

async function qboRequest(endpoint, options = {}) {
  const tokens = await refreshTokens(TOKEN_ENCRYPTION_KEY.value());

  const url = `${QBO_API_BASE}/${tokens.realm_id}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ----------------------------------------------------------------------------
// ACCOUNT RESOLUTION HELPERS
// ----------------------------------------------------------------------------

/**
 * Resolve revenue (Income) account for a QBO Item based on DawinOS category
 */
function resolveRevenueAccount(category, classification, config) {
  const m = config.accountMapping || {};
  const cat = (category || '').toLowerCase();

  if (['material', 'hardware', 'finishing', 'procurement', 'product'].includes(cat))
    return m.revenueProducts || m.revenue;
  if (['labor', 'construction', 'outsourcing'].includes(cat))
    return m.revenueServicesAndProjects || m.revenue;
  if (cat === 'shipping')
    return m.revenueShipping || m.revenue;

  // Classification fallback
  const cls = (classification || '').toLowerCase();
  if (cls === 'product' || cls === 'material') return m.revenueProducts || m.revenue;

  return m.revenue;
}

/**
 * Resolve expense (COGS) account for a QBO Item based on DawinOS category
 */
function resolveExpenseAccount(category, classification, config) {
  const m = config.accountMapping || {};
  const cat = (category || '').toLowerCase();

  if (['material', 'hardware', 'finishing', 'procurement'].includes(cat))
    return m.cogsMaterials || m.cogs;
  if (cat === 'product') return m.cogsProducts || m.cogs;
  if (cat === 'labor') return m.cogsLabour || m.cogs;
  if (cat === 'construction') return m.cogsServicesAndProjects || m.cogs;
  if (cat === 'outsourcing') return m.cogsOutsourced || m.cogs;

  return m.cogs;
}

/**
 * Resolve QBO Item Type from DawinOS category/classification
 * - Service: labor, construction, outsourcing
 * - NonInventory: physical goods (DawinOS tracks stock, not QBO)
 */
function resolveQBOItemType(category, classification) {
  const cat = (category || '').toLowerCase();
  if (['labor', 'construction', 'outsourcing'].includes(cat)) return 'Service';
  if (['material', 'product', 'hardware', 'finishing', 'procurement'].includes(cat)) return 'NonInventory';

  const cls = (classification || '').toLowerCase();
  if (['material', 'product', 'kit'].includes(cls)) return 'NonInventory';

  return 'Service';
}

// ----------------------------------------------------------------------------
// QBO ITEM CATALOG (for fuzzy matching)
// ----------------------------------------------------------------------------

const CATALOG_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch all active QBO items into a local catalog with Firestore TTL cache.
 * Used for fuzzy name matching when exact search fails.
 */
async function fetchQBOItemCatalog() {
  const catalogRef = db.collection('integrations').doc('qbo_item_catalog');
  const catalogDoc = await catalogRef.get();

  if (catalogDoc.exists) {
    const data = catalogDoc.data();
    const fetchedAt = data.fetchedAt?.toMillis?.() || 0;
    if (Date.now() - fetchedAt < CATALOG_TTL_MS && Array.isArray(data.items)) {
      console.log(`[ItemResolution] Using cached QBO item catalog (${data.items.length} items)`);
      return data.items;
    }
  }

  // Fetch from QBO API with pagination
  console.log('[ItemResolution] Fetching QBO item catalog from API...');
  const allItems = [];
  let startPosition = 1;
  const maxResults = 1000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = encodeURIComponent(
      `SELECT Id, Name, Type, Active FROM Item WHERE Active = true STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    );
    const response = await qboRequest(`/query?query=${query}`);
    const items = response.QueryResponse?.Item || [];
    allItems.push(...items.map(i => ({ Id: i.Id, Name: i.Name, Type: i.Type })));

    if (items.length < maxResults) break;
    startPosition += maxResults;
  }

  // Cache in Firestore
  await catalogRef.set({
    items: allItems,
    itemCount: allItems.length,
    fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[ItemResolution] Cached ${allItems.length} QBO items in catalog`);
  return allItems;
}

// ----------------------------------------------------------------------------
// FUZZY MATCHING
// ----------------------------------------------------------------------------

/**
 * Normalize a string for comparison: lowercase, strip special chars, collapse whitespace.
 */
function normalizeForMatch(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize a string into unique words.
 */
function tokenize(str) {
  return [...new Set(normalizeForMatch(str).split(' ').filter(Boolean))];
}

/**
 * Compute token overlap score between two strings.
 * Returns 0–1 where 1 = perfect overlap.
 */
function tokenOverlapScore(a, b) {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const overlap = tokensA.filter(t => setB.has(t)).length;
  return overlap / Math.max(tokensA.length, tokensB.length);
}

/**
 * Find the best matching QBO item from the catalog using fuzzy matching.
 * @param {string} searchName - The DawinOS item name to search for
 * @param {string|null} searchSku - Optional SKU for prefix matching
 * @param {Array} catalogItems - Array of { Id, Name, Type }
 * @param {number} threshold - Minimum score to accept (default 0.6)
 * @returns {{ qboItem: Object, score: number, matchType: 'exact'|'fuzzy' } | null}
 */
function findBestQBOMatch(searchName, searchSku, catalogItems, threshold = 0.6) {
  if (!catalogItems || catalogItems.length === 0) return null;

  const normalizedSearch = normalizeForMatch(searchName);
  const normalizedSku = searchSku ? normalizeForMatch(searchSku) : null;

  let bestMatch = null;
  let bestScore = 0;

  for (const item of catalogItems) {
    const normalizedItem = normalizeForMatch(item.Name);

    // Exact match (normalized)
    if (normalizedItem === normalizedSearch) {
      return { qboItem: item, score: 1.0, matchType: 'exact' };
    }

    // SKU prefix match — QBO item name starts with the SKU
    if (normalizedSku && normalizedItem.startsWith(normalizedSku)) {
      const score = 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { qboItem: item, score, matchType: 'fuzzy' };
      }
      continue;
    }

    // Token overlap
    const score = tokenOverlapScore(searchName, item.Name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { qboItem: item, score, matchType: 'fuzzy' };
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return bestMatch;
  }

  return null;
}

/**
 * Log item resolution to Firestore for review/audit.
 */
async function logResolution(entry) {
  try {
    await db.collection('integrations').doc('qbo_item_cache')
      .collection('resolution_log').add({
        ...entry,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.warn('[ItemResolution] Failed to write resolution log:', err.message);
  }
}

// ----------------------------------------------------------------------------
// CACHE KEY HELPERS
// ----------------------------------------------------------------------------

/**
 * Build a Firestore-safe cache key from SKU or name
 */
function buildCacheKey(sku, name) {
  const raw = sku || name || 'unknown';
  // Firestore doc IDs: no /, max 1500 bytes. Sanitize and truncate.
  return raw
    .replace(/[/\\]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200)
    .toLowerCase();
}

/**
 * Build a QBO-safe item name: "SKU - Name" truncated to 100 chars
 */
function buildQBOItemName(sku, name) {
  if (sku && name) {
    const full = `${sku} - ${name}`;
    return full.substring(0, 100);
  }
  return (name || sku || 'Unnamed Item').substring(0, 100);
}

// ----------------------------------------------------------------------------
// CORE: RESOLVE OR CREATE QBO ITEM
// ----------------------------------------------------------------------------

/**
 * Resolve a DawinOS item to a QBO Item ID.
 * Resolution chain:
 *   1. Check Firestore cache
 *   2. Check inventoryItem.qboItemId
 *   3. Exact name match via QBO item catalog
 *   4. Fuzzy match via QBO item catalog (token overlap, score >= 0.6)
 *   5. Create in QBO if no match found
 *
 * DawinOS is the source of truth — items flow DawinOS → QBO.
 *
 * @param {Object} itemInfo
 * @param {string} itemInfo.name          - Display name
 * @param {string} [itemInfo.sku]         - DawinOS SKU
 * @param {string} itemInfo.category      - DawinOS category (material/labor/hardware/etc.)
 * @param {string} [itemInfo.classification] - material/product/kit
 * @param {number} [itemInfo.unitPrice]   - Selling price
 * @param {number} [itemInfo.purchaseCost]- Purchase cost
 * @param {string} [itemInfo.description] - Item description
 * @param {string} [itemInfo.inventoryItemId] - DawinOS inventoryItems doc ID
 * @param {Object} config                 - The quickbooks_config document data
 * @returns {Promise<{qboItemId: string, qboItemName: string, action: 'cached'|'linked'|'matched'|'created'}>}
 */
async function resolveOrCreateQBOItem(itemInfo, config) {
  const { name, sku, category, classification, unitPrice, purchaseCost, description, inventoryItemId } = itemInfo;

  const cacheKey = buildCacheKey(sku, name);
  const qboName = buildQBOItemName(sku, name);

  // --- Step 1: Check Firestore cache ---
  const cacheRef = db.collection('integrations').doc('qbo_item_cache').collection('items').doc(cacheKey);
  const cacheDoc = await cacheRef.get();

  if (cacheDoc.exists && cacheDoc.data().qboItemId) {
    console.log(`[ItemResolution] Cache hit for "${cacheKey}" → QBO Item ${cacheDoc.data().qboItemId}`);
    await cacheRef.update({ lastUsedAt: admin.firestore.FieldValue.serverTimestamp() });
    return {
      qboItemId: cacheDoc.data().qboItemId,
      qboItemName: cacheDoc.data().qboItemName || qboName,
      action: 'cached',
    };
  }

  // --- Step 2: Check inventory item for existing qboItemId ---
  if (inventoryItemId) {
    const invDoc = await db.collection('inventoryItems').doc(inventoryItemId).get();
    if (invDoc.exists && invDoc.data().qboItemId) {
      const qboItemId = invDoc.data().qboItemId;
      console.log(`[ItemResolution] Inventory item ${inventoryItemId} already linked → QBO Item ${qboItemId}`);

      // Warm the cache
      await cacheRef.set({
        cacheKey,
        qboItemId,
        qboItemName: qboName,
        dawinosSku: sku || null,
        dawinosInventoryItemId: inventoryItemId,
        category: category || null,
        classification: classification || null,
        matchType: 'linked',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { qboItemId, qboItemName: qboName, action: 'linked' };
    }
  }

  // --- Step 3 & 4: Search QBO catalog (exact + fuzzy) ---
  let qboItem = null;
  let matchType = null;
  let matchScore = null;

  try {
    const catalog = await fetchQBOItemCatalog();
    const match = findBestQBOMatch(qboName, sku, catalog);

    if (match) {
      qboItem = match.qboItem;
      matchType = match.matchType;
      matchScore = match.score;
      console.log(`[ItemResolution] ${match.matchType} match: "${qboName}" → QBO "${qboItem.Name}" (score: ${match.score.toFixed(2)})`);
    }
  } catch (catalogError) {
    // Fallback: try direct QBO API exact search if catalog fetch fails
    console.warn(`[ItemResolution] Catalog search failed, trying direct API:`, catalogError.message);
    try {
      const escapedName = qboName.replace(/'/g, "\\'");
      const query = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${escapedName}'`);
      const response = await qboRequest(`/query?query=${query}`);
      const items = response.QueryResponse?.Item || [];
      if (items.length > 0) {
        qboItem = items[0];
        matchType = 'exact';
        matchScore = 1.0;
      }
    } catch (searchError) {
      console.warn(`[ItemResolution] Direct search also failed for "${qboName}":`, searchError.message);
    }
  }

  // --- Step 5: Create in QBO if no match found ---
  if (!qboItem) {
    const incomeAccountId = resolveRevenueAccount(category, classification, config);
    const expenseAccountId = resolveExpenseAccount(category, classification, config);
    const itemType = resolveQBOItemType(category, classification);

    if (!incomeAccountId) {
      throw new Error(`Cannot create QBO item "${qboName}": no revenue account mapped for category "${category}". Configure revenue accounts in QBO Settings.`);
    }
    if (!expenseAccountId) {
      throw new Error(`Cannot create QBO item "${qboName}": no expense/COGS account mapped for category "${category}". Configure COGS accounts in QBO Settings.`);
    }

    const itemPayload = {
      Name: qboName,
      Type: itemType,
      Description: (description || '').substring(0, 4000),
      IncomeAccountRef: { value: incomeAccountId },
      ExpenseAccountRef: { value: expenseAccountId },
      Active: true,
    };

    if (unitPrice != null && unitPrice > 0) {
      itemPayload.UnitPrice = unitPrice;
    }
    if (purchaseCost != null && purchaseCost > 0) {
      itemPayload.PurchaseCost = purchaseCost;
    }

    try {
      console.log(`[ItemResolution] Creating QBO Item: "${qboName}" (${itemType})`);
      const createResponse = await qboRequest('/item', {
        method: 'POST',
        body: JSON.stringify(itemPayload),
      });
      qboItem = createResponse.Item;
      matchType = 'created';
      matchScore = null;
      console.log(`[ItemResolution] Created QBO Item: ${qboItem.Id} "${qboItem.Name}"`);
    } catch (createError) {
      // Handle duplicate name race condition: search again
      if (createError.message.includes('Duplicate') || createError.message.includes('already exists')) {
        console.warn(`[ItemResolution] Duplicate detected, re-searching for "${qboName}"`);
        const escapedName = qboName.replace(/'/g, "\\'");
        const query = encodeURIComponent(`SELECT * FROM Item WHERE Name = '${escapedName}'`);
        const retryResponse = await qboRequest(`/query?query=${query}`);
        const retryItems = retryResponse.QueryResponse?.Item || [];

        if (retryItems.length > 0) {
          qboItem = retryItems[0];
          matchType = 'exact';
          matchScore = 1.0;
        } else {
          throw createError;
        }
      } else {
        throw createError;
      }
    }
  }

  // --- Step 6: Cache the result and write back to inventory item ---
  const qboItemId = qboItem.Id;

  // Determine review status for fuzzy matches
  const reviewStatus = matchType === 'fuzzy' && matchScore < 0.8
    ? 'pending-review'
    : 'auto-approved';

  await cacheRef.set({
    cacheKey,
    qboItemId,
    qboItemName: qboItem.Name,
    dawinosSku: sku || null,
    dawinosInventoryItemId: inventoryItemId || null,
    category: category || null,
    classification: classification || null,
    matchType: matchType || 'linked',
    matchScore: matchScore ?? null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log resolution for audit / user review
  await logResolution({
    dawinosName: name,
    dawinosSku: sku || null,
    dawinosInventoryItemId: inventoryItemId || null,
    dawinosCategory: category || null,
    qboItemId,
    qboItemName: qboItem.Name,
    matchType: matchType || 'linked',
    matchScore: matchScore ?? null,
    status: reviewStatus,
  });

  // Write qboItemId back to inventory item
  if (inventoryItemId) {
    try {
      await db.collection('inventoryItems').doc(inventoryItemId).update({
        qboItemId,
        qboSyncStatus: 'synced',
        qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[ItemResolution] Wrote qboItemId ${qboItemId} back to inventoryItem ${inventoryItemId}`);
    } catch (writeBackError) {
      console.warn(`[ItemResolution] Failed to write back qboItemId to inventory item:`, writeBackError.message);
    }
  }

  return {
    qboItemId,
    qboItemName: qboItem.Name,
    action: matchType || 'linked',
  };
}

// ----------------------------------------------------------------------------
// BULK INVENTORY SYNC CALLABLE
// ----------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bulk sync DawinOS inventory items to QuickBooks.
 * Creates or links each active inventory item as a QBO Item.
 */
exports.syncInventoryItemsToQBO = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  timeoutSeconds: 540,
  memory: '512MiB',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { classification, category, batchSize = 50 } = request.data || {};

  // 1. Fetch config
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    throw new HttpsError('failed-precondition', 'QuickBooks configuration is not complete. Please configure account mappings first.');
  }
  const config = configDoc.data();

  // 2. Query inventory items (optionally filtered)
  let query = db.collection('inventoryItems').where('status', '==', 'active');

  if (classification) {
    query = query.where('classification', '==', classification);
  }

  const snapshot = await query.limit(batchSize).get();

  if (snapshot.empty) {
    return { success: true, synced: 0, failed: 0, results: [], errors: [] };
  }

  // 3. Resolve each item
  const results = [];
  const errors = [];

  for (const doc of snapshot.docs) {
    const item = doc.data();

    // Skip family parents — only sync transactable items
    if (item.isFamily) continue;

    try {
      const resolved = await resolveOrCreateQBOItem({
        name: item.displayName || item.name,
        sku: item.sku,
        category: item.category || 'material',
        classification: item.classification || 'material',
        unitPrice: item.pricing?.costPerUnit,
        purchaseCost: item.pricing?.costPerUnit,
        description: item.description,
        inventoryItemId: doc.id,
      }, config);

      results.push({
        inventoryItemId: doc.id,
        sku: item.sku,
        name: item.displayName || item.name,
        qboItemId: resolved.qboItemId,
        action: resolved.action,
      });

      // Rate limit: 200ms between QBO API calls
      await sleep(200);
    } catch (error) {
      console.error(`[ItemResolution] Failed to sync item ${doc.id} (${item.sku}):`, error.message);
      errors.push({
        inventoryItemId: doc.id,
        sku: item.sku,
        name: item.displayName || item.name,
        error: error.message,
      });
    }
  }

  return {
    success: errors.length === 0,
    synced: results.length,
    failed: errors.length,
    total: snapshot.docs.length,
    results,
    errors,
  };
});

// ----------------------------------------------------------------------------
// UPDATE QBO ITEM
// ----------------------------------------------------------------------------

/**
 * Update an existing QBO Item when the DawinOS inventory item changes.
 * Uses SyncToken for optimistic concurrency (required by QBO API).
 */
async function updateQBOItem(qboItemId, updates) {
  // Fetch current item to get SyncToken
  const existing = await qboRequest(`/item/${qboItemId}`);
  const currentItem = existing.Item;

  const payload = {
    Id: qboItemId,
    SyncToken: currentItem.SyncToken,
    sparse: true,
    ...updates,
  };

  console.log(`[ItemResolution] Updating QBO Item ${qboItemId}:`, JSON.stringify(updates));
  const response = await qboRequest('/item', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.Item;
}

/**
 * Deactivate a QBO Item (set Active: false).
 * Used when inventory items are deleted or discontinued.
 */
async function deactivateQBOItem(qboItemId) {
  console.log(`[ItemResolution] Deactivating QBO Item ${qboItemId}`);
  return updateQBOItem(qboItemId, { Active: false });
}

/**
 * Remove a cache entry for a given inventory item.
 */
async function removeCacheEntry(sku, name) {
  const cacheKey = buildCacheKey(sku, name);
  const cacheRef = db.collection('integrations').doc('qbo_item_cache').collection('items').doc(cacheKey);
  const cacheDoc = await cacheRef.get();

  if (cacheDoc.exists) {
    await cacheRef.delete();
    console.log(`[ItemResolution] Removed cache entry: ${cacheKey}`);
  }
}

// ----------------------------------------------------------------------------
// FIRESTORE TRIGGERS: INVENTORY ITEM SYNC
// ----------------------------------------------------------------------------

/**
 * Auto-sync when an inventory item is updated.
 * Updates the corresponding QBO Item if one is linked.
 */
exports.onInventoryItemUpdated = onDocumentUpdated({
  document: 'inventoryItems/{itemId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const itemId = event.params.itemId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // Skip if not linked to QBO
  const qboItemId = afterData.qboItemId;
  if (!qboItemId) {
    return;
  }

  // Skip if the update was from our own sync (avoid loops)
  if (afterData.qboSyncStatus !== beforeData.qboSyncStatus &&
      afterData.qboSyncStatus === 'synced') {
    return;
  }

  // Check if relevant fields changed
  const relevantFields = ['name', 'displayName', 'description', 'sku', 'status'];
  const pricingChanged = JSON.stringify(beforeData.pricing) !== JSON.stringify(afterData.pricing);
  const hasRelevantChanges = pricingChanged || relevantFields.some(
    field => beforeData[field] !== afterData[field]
  );

  if (!hasRelevantChanges) {
    return;
  }

  console.log(`[ItemResolution] Inventory item updated: ${itemId} (QBO Item ${qboItemId})`);

  try {
    // Handle discontinuation / deactivation
    if (afterData.status === 'discontinued' && beforeData.status !== 'discontinued') {
      await deactivateQBOItem(qboItemId);

      await db.collection('inventoryItems').doc(itemId).update({
        qboSyncStatus: 'synced',
        qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[ItemResolution] Deactivated QBO Item ${qboItemId} (item discontinued)`);
      return;
    }

    // Build update payload
    const updates = {};
    const newName = buildQBOItemName(afterData.sku, afterData.displayName || afterData.name);

    if (newName !== buildQBOItemName(beforeData.sku, beforeData.displayName || beforeData.name)) {
      updates.Name = newName;
    }

    if (afterData.description !== beforeData.description) {
      updates.Description = (afterData.description || '').substring(0, 4000);
    }

    if (pricingChanged && afterData.pricing?.costPerUnit != null) {
      updates.UnitPrice = afterData.pricing.costPerUnit;
      updates.PurchaseCost = afterData.pricing.costPerUnit;
    }

    // Reactivate if previously discontinued
    if (beforeData.status === 'discontinued' && afterData.status === 'active') {
      updates.Active = true;
    }

    if (Object.keys(updates).length === 0) {
      console.log(`[ItemResolution] No QBO-relevant changes for item ${itemId}, skipping`);
      return;
    }

    await updateQBOItem(qboItemId, updates);

    // Update cache if name changed
    if (updates.Name) {
      // Remove old cache entry
      await removeCacheEntry(beforeData.sku, beforeData.displayName || beforeData.name);
      // New cache will be created on next resolveOrCreateQBOItem call
      const newCacheKey = buildCacheKey(afterData.sku, afterData.displayName || afterData.name);
      const cacheRef = db.collection('integrations').doc('qbo_item_cache').collection('items').doc(newCacheKey);
      await cacheRef.set({
        cacheKey: newCacheKey,
        qboItemId,
        qboItemName: updates.Name,
        dawinosSku: afterData.sku || null,
        dawinosInventoryItemId: itemId,
        category: afterData.category || null,
        classification: afterData.classification || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await db.collection('inventoryItems').doc(itemId).update({
      qboSyncStatus: 'synced',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[ItemResolution] Successfully updated QBO Item ${qboItemId}`);
  } catch (error) {
    console.error(`[ItemResolution] Failed to sync inventory item update ${itemId}:`, error);

    await db.collection('inventoryItems').doc(itemId).update({
      qboSyncStatus: 'error',
      qboSyncError: error.message || 'Failed to update QBO item',
      qboSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Don't throw — allow the Firestore update to succeed even if QBO sync fails
  }
});

/**
 * Auto-deactivate QBO Item when an inventory item is deleted.
 * Also cleans up the cache entry.
 */
exports.onInventoryItemDeleted = onDocumentDeleted({
  document: 'inventoryItems/{itemId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const itemId = event.params.itemId;
  const deletedData = event.data.data();

  const qboItemId = deletedData?.qboItemId;
  if (!qboItemId) {
    return;
  }

  console.log(`[ItemResolution] Inventory item deleted: ${itemId} (QBO Item ${qboItemId})`);

  try {
    // Deactivate in QBO (don't delete — preserve audit trail)
    await deactivateQBOItem(qboItemId);
    console.log(`[ItemResolution] Deactivated QBO Item ${qboItemId} (inventory item deleted)`);

    // Clean up cache
    await removeCacheEntry(deletedData.sku, deletedData.displayName || deletedData.name);
  } catch (error) {
    console.error(`[ItemResolution] Failed to deactivate QBO item for deleted inventory ${itemId}:`, error);
    // Don't throw — the item is already deleted from Firestore
  }
});

// Export core function for use by other sync services
exports.resolveOrCreateQBOItem = resolveOrCreateQBOItem;
exports.resolveRevenueAccount = resolveRevenueAccount;
exports.resolveExpenseAccount = resolveExpenseAccount;
