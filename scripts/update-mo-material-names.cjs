/**
 * UPDATE MO MATERIAL NAMES
 *
 * Backfills existing Manufacturing Orders with inventory product names
 * by looking up each MO's project material palette.
 *
 * Updates:
 *   - bom[].itemName  (sheet-goods BOM entries)
 *   - parts[].materialName
 *
 * DRY RUN by default — pass --execute to apply changes.
 *
 * Usage:
 *   node scripts/update-mo-material-names.cjs            # dry run
 *   node scripts/update-mo-material-names.cjs --execute   # apply
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

// ── Firebase CLI access token ────────────────────────────────────
const firebaseConfigPath = path.join(
  os.homedir(),
  '.config',
  'configstore',
  'firebase-tools.json',
);

function getAccessToken() {
  const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  if (!config.tokens || !config.tokens.access_token) {
    throw new Error('No Firebase CLI access token found. Run: firebase login');
  }
  if (config.tokens.expires_at < Date.now()) {
    throw new Error(
      'Firebase CLI access token expired. Run: firebase login --reauth',
    );
  }
  return config.tokens.access_token;
}

const ACCESS_TOKEN = getAccessToken();
const PROJECT_ID = 'dawinos';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Config ──────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--execute');
const SYSTEM_USER = 'SYSTEM_MO_MATERIAL_NAMES';

// ── REST Helpers ─────────────────────────────────────────────────

async function firestoreGet(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore GET ${res.status}: ${text}`);
  }
  return res.json();
}

async function firestorePatch(url, fields) {
  const updateMask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${f}`)
    .join('&');
  const res = await fetch(`${url}?${updateMask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore PATCH ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Fetch all documents from a collection (handles pagination).
 */
async function fetchCollection(collection) {
  const docs = [];
  let pageToken = '';
  do {
    const sep = pageToken ? '&' : '?';
    const url = `${BASE_URL}/${collection}?pageSize=300${pageToken ? `${sep}pageToken=${pageToken}` : ''}`;
    const data = await firestoreGet(url);
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/**
 * Fetch a single document.
 */
async function fetchDoc(collection, docId) {
  try {
    return await firestoreGet(`${BASE_URL}/${collection}/${docId}`);
  } catch {
    return null;
  }
}

// ── Firestore Value Converters ──────────────────────────────────

function toJsValue(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) {
    const obj = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
      obj[k] = toJsValue(val);
    }
    return obj;
  }
  if ('arrayValue' in v) {
    return (v.arrayValue.values || []).map(toJsValue);
  }
  if ('timestampValue' in v) return v.timestampValue;
  return undefined;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  }
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) {
      if (val !== undefined) fields[k] = toFirestoreValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function docToJs(doc) {
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = toJsValue(v);
  }
  // Extract doc ID from the name path
  const parts = doc.name.split('/');
  obj._id = parts[parts.length - 1];
  return obj;
}

// ── Name Normalization (mirrors materialHarvester.ts) ───────────

function normalizeMaterialName(name) {
  if (!name) return 'unknown';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\bmm\b/gi, '')
    .replace(/\d+\s*mm/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a name resolver from a project's material palette.
 * Returns (materialName, thickness?) => inventoryName or original.
 */
function buildResolver(palette) {
  if (!palette || !palette.entries || palette.entries.length === 0) {
    return (name) => name;
  }

  const map = new Map();
  for (const entry of palette.entries) {
    if (entry.inventoryName) {
      map.set(`${entry.normalizedName}|${entry.thickness}`, entry.inventoryName);
    }
  }
  if (map.size === 0) return (name) => name;

  return (materialName, thickness) => {
    const normalized = normalizeMaterialName(materialName);
    // Exact match with thickness
    if (thickness !== undefined && thickness !== null) {
      const exact = map.get(`${normalized}|${thickness}`);
      if (exact) return exact;
    }
    // Fuzzy: match by normalized name only
    for (const [key, invName] of map) {
      if (key.startsWith(normalized + '|')) return invName;
    }
    return materialName;
  };
}

/**
 * Build a metadata resolver from a project's material palette.
 * Returns (materialName, thickness?) => { name, inventoryItemId, inventorySku } or null.
 */
function buildMetadataResolver(palette) {
  if (!palette || !palette.entries || palette.entries.length === 0) {
    return () => null;
  }

  // Index by normalizedName|thickness
  const map = new Map();
  // Also index by inventoryName (for entries already resolved to inventory names)
  const byInventoryName = new Map();

  for (const entry of palette.entries) {
    if (entry.inventoryName || entry.inventoryItemId || entry.inventoryId) {
      const meta = {
        name: entry.inventoryName || entry.designName,
        // inventoryId holds the document ID; inventoryItemId is an alias
        inventoryItemId: entry.inventoryItemId || entry.inventoryId || '',
        inventorySku: entry.inventorySku || '',
      };
      map.set(`${entry.normalizedName}|${entry.thickness}`, meta);
      // Also allow lookup by the inventory name itself (for already-migrated BOM entries)
      if (entry.inventoryName) {
        byInventoryName.set(entry.inventoryName.toLowerCase().trim(), meta);
      }
    }
  }
  if (map.size === 0 && byInventoryName.size === 0) return () => null;

  return (materialName, thickness) => {
    const normalized = normalizeMaterialName(materialName);
    // Exact match by normalizedName|thickness
    if (thickness !== undefined && thickness !== null) {
      const exact = map.get(`${normalized}|${thickness}`);
      if (exact) return exact;
    }
    // Fuzzy by normalizedName
    for (const [key, meta] of map) {
      if (key.startsWith(normalized + '|')) return meta;
    }
    // Try matching by inventory name (for BOM entries already carrying the resolved name)
    const byName = byInventoryName.get((materialName || '').toLowerCase().trim());
    if (byName) return byName;

    return null;
  };
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Update MO Material Names ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : '*** LIVE ***'}\n`);

  // 1. Fetch all MOs
  console.log('Fetching manufacturing orders...');
  const moDocs = await fetchCollection('manufacturingOrders');
  console.log(`Found ${moDocs.length} manufacturing orders\n`);

  if (moDocs.length === 0) {
    console.log('No MOs to update.');
    return;
  }

  // Convert to JS objects
  const mos = moDocs.map((d) => ({ ...docToJs(d), _docName: d.name }));

  // 2. Collect unique project IDs
  const projectIds = new Set();
  for (const mo of mos) {
    if (mo.projectId) projectIds.add(mo.projectId);
  }
  console.log(`Spanning ${projectIds.size} projects\n`);

  // 3. Fetch all project palettes in one pass
  console.log('Fetching project palettes...');
  const paletteCache = new Map(); // projectId → { resolve, resolveMeta }
  const noopResolver = (name) => name;
  const noopMetaResolver = () => null;
  for (const pid of projectIds) {
    try {
      const projDoc = await fetchDoc('designProjects', pid);
      if (projDoc && projDoc.fields) {
        const project = docToJs(projDoc);
        paletteCache.set(pid, {
          resolve: buildResolver(project.materialPalette),
          resolveMeta: buildMetadataResolver(project.materialPalette),
        });
      } else {
        paletteCache.set(pid, { resolve: noopResolver, resolveMeta: noopMetaResolver });
      }
    } catch (err) {
      console.warn(`  Warning: Could not fetch project ${pid}: ${err.message}`);
      paletteCache.set(pid, { resolve: noopResolver, resolveMeta: noopMetaResolver });
    }
  }
  console.log(`Loaded ${paletteCache.size} project palettes\n`);

  // 4. Process each MO
  let updated = 0;
  let skipped = 0;

  for (const mo of mos) {
    const cached = paletteCache.get(mo.projectId) || { resolve: noopResolver, resolveMeta: noopMetaResolver };
    const { resolve, resolveMeta } = cached;

    let changed = false;

    // Resolve BOM item names AND inventory IDs (sheet-goods primarily)
    const newBom = (mo.bom || []).map((entry) => {
      let resolvedName = entry.itemName;
      let inventoryItemId = entry.inventoryItemId || '';
      let sku = entry.sku || '';

      if (entry.category === 'sheet-goods') {
        // Try to extract thickness from the existing name like "Plywood 18mm"
        const thicknessMatch = (entry.itemName || '').match(/(\d+)\s*mm/i);
        const thickness = thicknessMatch
          ? parseInt(thicknessMatch[1], 10)
          : undefined;
        resolvedName = resolve(entry.itemName, thickness);

        // Also resolve inventory metadata (ID + SKU)
        const meta = resolveMeta(entry.itemName, thickness);
        if (meta) {
          if (meta.inventoryItemId && !inventoryItemId) {
            inventoryItemId = meta.inventoryItemId;
          }
          if (meta.inventorySku && !sku) {
            sku = meta.inventorySku;
          }
        }
      }

      const nameChanged = resolvedName !== entry.itemName;
      const idChanged = inventoryItemId !== (entry.inventoryItemId || '');
      const skuChanged = sku !== (entry.sku || '');

      if (nameChanged || idChanged || skuChanged) {
        changed = true;
        return { ...entry, itemName: resolvedName, inventoryItemId, sku };
      }
      return entry;
    });

    // Resolve part material names
    const newParts = (mo.parts || []).map((part) => {
      const thickness = part.thickness || undefined;
      const resolved = resolve(part.materialName || '', thickness);
      if (resolved !== (part.materialName || '')) {
        changed = true;
        return { ...part, materialName: resolved };
      }
      return part;
    });

    if (!changed) {
      skipped++;
      continue;
    }

    console.log(
      `  > ${mo.moNumber || mo._id} (project: ${mo.projectCode || mo.projectId})`,
    );

    // Log specific changes
    for (let i = 0; i < newBom.length; i++) {
      const oldEntry = (mo.bom || [])[i];
      const newEntry = newBom[i];
      if (newEntry.itemName !== oldEntry?.itemName) {
        console.log(
          `    BOM name: "${oldEntry?.itemName}" -> "${newEntry.itemName}"`,
        );
      }
      if (newEntry.inventoryItemId !== (oldEntry?.inventoryItemId || '')) {
        console.log(
          `    BOM inventoryItemId: "${oldEntry?.inventoryItemId || ''}" -> "${newEntry.inventoryItemId}"`,
        );
      }
      if (newEntry.sku !== (oldEntry?.sku || '')) {
        console.log(
          `    BOM sku: "${oldEntry?.sku || ''}" -> "${newEntry.sku}"`,
        );
      }
    }
    for (let i = 0; i < newParts.length; i++) {
      if (newParts[i].materialName !== (mo.parts || [])[i]?.materialName) {
        console.log(
          `    Part: "${(mo.parts || [])[i]?.materialName}" -> "${newParts[i].materialName}"`,
        );
      }
    }

    if (!DRY_RUN) {
      const docUrl = `${BASE_URL}/manufacturingOrders/${mo._id}`;
      await firestorePatch(docUrl, {
        bom: toFirestoreValue(newBom),
        parts: toFirestoreValue(newParts),
        updatedAt: { timestampValue: new Date().toISOString() },
        updatedBy: { stringValue: SYSTEM_USER },
      });
    }

    updated++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (no changes): ${skipped}`);
  console.log(`  Total:   ${mos.length}`);

  if (DRY_RUN && updated > 0) {
    console.log(`\nRe-run with --execute to apply changes.`);
  }
}

main().catch(console.error);
