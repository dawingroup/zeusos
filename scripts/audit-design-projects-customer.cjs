/**
 * Audit Design Projects — Customer Linkage (P5)
 *
 * READ-ONLY script. Produces a structured report of DesignProject documents
 * with missing or malformed `customerId` — the precondition for safely
 * deploying the P5 Firestore rule that enforces `customerId` as non-empty.
 *
 * Checks:
 *   1. Missing `customerId`     — field absent / null / undefined
 *   2. Empty `customerId`       — empty string
 *   3. Non-string `customerId`  — unexpected type
 *   4. Missing `customerName`   — FK is set but cached name isn't
 *   5. Dangling `customerId`    — id set but no matching customer doc
 *
 * Run: NODE_PATH=functions/node_modules node scripts/audit-design-projects-customer.cjs
 *
 * Output: a JSON-ish summary to stdout plus a CSV of affected project ids
 * written to ./tmp/design-projects-customer-audit-<date>.csv for handoff
 * to the operator running the backfill.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Auditing designProjects.customerId …\n');

  const snap = await db.collection('designProjects').get();
  const total = snap.size;

  const missing = [];            // customerId absent or null/undefined
  const empty = [];              // customerId === ''
  const nonString = [];          // customerId is not a string
  const missingName = [];        // customerId set but customerName missing/empty
  const dangling = [];           // customerId set but no matching customer doc
  const ok = [];                 // fully valid

  // Cache customer id lookups to avoid quadratic reads
  const customerCache = new Map(); // id → exists (bool)

  async function customerExists(id) {
    if (customerCache.has(id)) return customerCache.get(id);
    const doc = await db.collection('customers').doc(id).get();
    const exists = doc.exists;
    customerCache.set(id, exists);
    return exists;
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    const id = doc.id;
    const row = {
      id,
      code: data.code,
      name: data.name,
      status: data.status,
      createdAt: data.createdAt?.toDate?.().toISOString(),
      customerId: data.customerId,
      customerName: data.customerName,
    };

    if (data.customerId === undefined || data.customerId === null) {
      missing.push(row);
      continue;
    }
    if (typeof data.customerId !== 'string') {
      nonString.push(row);
      continue;
    }
    if (data.customerId === '') {
      empty.push(row);
      continue;
    }

    // customerId is a non-empty string — check dangling + missing name
    const exists = await customerExists(data.customerId);
    if (!exists) {
      dangling.push(row);
      continue;
    }
    if (!data.customerName || typeof data.customerName !== 'string' || data.customerName === '') {
      missingName.push(row);
      continue;
    }
    ok.push(row);
  }

  const report = {
    scannedAt: new Date().toISOString(),
    totalProjects: total,
    fullyValid: ok.length,
    issues: {
      missingCustomerId: missing.length,
      emptyCustomerId: empty.length,
      nonStringCustomerId: nonString.length,
      danglingCustomerId: dangling.length,
      missingCustomerName: missingName.length,
    },
    samples: {
      missingCustomerId: missing.slice(0, 10),
      emptyCustomerId: empty.slice(0, 10),
      nonStringCustomerId: nonString.slice(0, 10),
      danglingCustomerId: dangling.slice(0, 10),
      missingCustomerName: missingName.slice(0, 10),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  // CSV of every affected project for operator handoff
  const affected = [
    ...missing.map((r) => ({ ...r, issue: 'missing' })),
    ...empty.map((r) => ({ ...r, issue: 'empty' })),
    ...nonString.map((r) => ({ ...r, issue: 'non_string' })),
    ...dangling.map((r) => ({ ...r, issue: 'dangling' })),
    ...missingName.map((r) => ({ ...r, issue: 'missing_name' })),
  ];

  if (affected.length > 0) {
    const outDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const outPath = path.join(outDir, `design-projects-customer-audit-${stamp}.csv`);

    const header = ['issue', 'id', 'code', 'name', 'status', 'customerId', 'customerName', 'createdAt'];
    const rows = [header.join(',')];
    for (const r of affected) {
      rows.push(header.map((k) => csvCell(r[k])).join(','));
    }
    fs.writeFileSync(outPath, rows.join('\n'), 'utf8');
    console.log(`\nWrote ${affected.length} affected project(s) to ${outPath}`);
  } else {
    console.log('\nAll designProjects have valid customer linkage — safe to deploy P5 rules.');
  }

  await admin.app().delete();
}

function csvCell(v) {
  if (v === undefined || v === null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
