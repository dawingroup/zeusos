const fs = require('fs');
const os = require('os');
const path = require('path');

const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const j = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Refresh token first
async function refreshToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi&refresh_token=' + encodeURIComponent(j.tokens.refresh_token) + '&grant_type=refresh_token'
  });
  const d = await res.json();
  if (d.access_token) {
    j.tokens.access_token = d.access_token;
    j.tokens.expires_at = Date.now() + (d.expires_in * 1000);
    fs.writeFileSync(configPath, JSON.stringify(j, null, 2));
    return d.access_token;
  }
  throw new Error('Token refresh failed: ' + JSON.stringify(d));
}

const BASE = 'https://firestore.googleapis.com/v1/projects/dawinos/databases/(default)/documents';

async function get(token, path) {
  const res = await fetch(BASE + '/' + path, {
    headers: { Authorization: 'Bearer ' + token }
  });
  return res.json();
}

async function query(token, collection, field, op, value) {
  const res = await fetch(BASE + ':runQuery', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: op,
            value: { stringValue: value },
          }
        },
        limit: 10,
      }
    }),
  });
  return res.json();
}

async function main() {
  const token = await refreshToken();
  console.log('Token refreshed.\n');

  // 1. Check MO status
  console.log('=== Manufacturing Orders ===');
  const moData = await get(token, 'manufacturingOrders?pageSize=5');
  const mos = moData.documents || [];
  for (const mo of mos) {
    const f = mo.fields || {};
    console.log('  MO:', f.moNumber && f.moNumber.stringValue);
    console.log('  Status:', f.status && f.status.stringValue);
    console.log('  SubsidiaryId:', f.subsidiaryId && f.subsidiaryId.stringValue);
    const bom = f.bom && f.bom.arrayValue && f.bom.arrayValue.values;
    if (bom) {
      console.log('  BOM entries:', bom.length);
      for (const b of bom) {
        const bf = b.mapValue.fields;
        console.log('    -', bf.itemName && bf.itemName.stringValue,
          '| inventoryItemId:', bf.inventoryItemId && bf.inventoryItemId.stringValue,
          '| sku:', bf.sku && bf.sku.stringValue);
      }
    }
    const reservations = f.materialReservations && f.materialReservations.arrayValue && f.materialReservations.arrayValue.values;
    console.log('  Reservations:', reservations ? reservations.length : 0);
  }

  // 2. Check warehouses
  console.log('\n=== Warehouses ===');
  const whData = await get(token, 'warehouses?pageSize=20');
  const warehouses = whData.documents || [];
  if (warehouses.length === 0) {
    console.log('  NO WAREHOUSES FOUND');
  }
  for (const wh of warehouses) {
    const f = wh.fields || {};
    console.log('  -', f.name && f.name.stringValue,
      '| subsidiaryId:', f.subsidiaryId && f.subsidiaryId.stringValue,
      '| id:', wh.name.split('/').pop());
  }

  // 3. Check stock levels for inventory item GXjMfOCVT7rp634ZZKRn
  console.log('\n=== Stock Levels for Blockboard (GXjMfOCVT7rp634ZZKRn) ===');
  const slData = await query(token, 'stockLevels', 'inventoryItemId', 'EQUAL', 'GXjMfOCVT7rp634ZZKRn');
  if (Array.isArray(slData)) {
    for (const item of slData) {
      if (item.document) {
        const f = item.document.fields || {};
        console.log('  quantityOnHand:', f.quantityOnHand && (f.quantityOnHand.integerValue || f.quantityOnHand.doubleValue));
        console.log('  quantityReserved:', f.quantityReserved && (f.quantityReserved.integerValue || f.quantityReserved.doubleValue));
        console.log('  quantityAvailable:', f.quantityAvailable && (f.quantityAvailable.integerValue || f.quantityAvailable.doubleValue));
        console.log('  warehouseId:', f.warehouseId && f.warehouseId.stringValue);
      } else {
        console.log('  No stock level records found');
      }
    }
  }
}

main().catch(e => console.error('Error:', e.message));
