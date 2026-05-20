/**
 * Re-sequence Sales Order numbers for unsynced SOs.
 *
 * Rules:
 * - SOs synced to QBO (have qboInvoiceId or qboSalesOrderId) keep their current number (pinned)
 * - All unsynced SOs are re-assigned sequential numbers based on createdAt order
 * - Pinned numbers are reserved — unsynced SOs skip over them
 * - Format: SO-{year}-{0001..9999}
 *
 * Run: NODE_PATH=functions/node_modules node scripts/resequence-sales-order-numbers.cjs
 * Add --dry-run to preview changes without writing (default is dry-run)
 * Add --apply to actually write changes
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  console.log(`\n=== Sales Order Number Re-sequencing ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (use --apply to write)' : '⚠️  LIVE — writing changes'}\n`);

  // 1. Fetch all SOs
  const snapshot = await db.collection('salesOrders').orderBy('createdAt', 'asc').get();
  console.log(`Total Sales Orders: ${snapshot.size}`);

  const allSOs = snapshot.docs.map(doc => ({
    id: doc.id,
    orderNumber: doc.data().orderNumber,
    createdAt: doc.data().createdAt,
    status: doc.data().status,
    qboInvoiceId: doc.data().qboInvoiceId || null,
    qboSalesOrderId: doc.data().qboSalesOrderId || null,
    subsidiaryId: doc.data().subsidiaryId || 'default',
    customerName: doc.data().customerName || '—',
  }));

  // 2. Identify synced (pinned) vs unsynced
  const pinned = allSOs.filter(so => so.qboInvoiceId || so.qboSalesOrderId);
  const unsynced = allSOs.filter(so => !so.qboInvoiceId && !so.qboSalesOrderId);

  console.log(`Pinned (synced to QBO): ${pinned.length}`);
  console.log(`Unsynced (will re-sequence): ${unsynced.length}`);

  // 3. Show duplicates
  const numberCounts = {};
  for (const so of allSOs) {
    numberCounts[so.orderNumber] = (numberCounts[so.orderNumber] || 0) + 1;
  }
  const duplicates = Object.entries(numberCounts).filter(([, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`\nDuplicate numbers found:`);
    for (const [num, count] of duplicates) {
      const owners = allSOs.filter(so => so.orderNumber === num);
      console.log(`  ${num} (×${count}):`);
      for (const o of owners) {
        const syncTag = (o.qboInvoiceId || o.qboSalesOrderId) ? ' [SYNCED/PINNED]' : ' [unsynced]';
        console.log(`    - ${o.id} | ${o.customerName} | ${o.status}${syncTag}`);
      }
    }
  } else {
    console.log('\nNo duplicate numbers found.');
  }

  // 4. Build pinned number set (reserved numbers by year)
  // Parse year from order number: SO-2026-0001 → { year: 2026, seq: 1 }
  function parseOrderNumber(num) {
    const match = num?.match(/^SO-(\d{4})-(\d+)$/);
    if (!match) return null;
    return { year: parseInt(match[1]), seq: parseInt(match[2]) };
  }

  const pinnedByYear = {}; // { 2026: Set([1, 3, 5]) }
  for (const so of pinned) {
    const parsed = parseOrderNumber(so.orderNumber);
    if (!parsed) continue;
    if (!pinnedByYear[parsed.year]) pinnedByYear[parsed.year] = new Set();
    pinnedByYear[parsed.year].add(parsed.seq);
  }

  // 5. Re-sequence unsynced SOs
  // Group unsynced by year (from createdAt)
  const unsyncedByYear = {};
  for (const so of unsynced) {
    const date = so.createdAt?.toDate ? so.createdAt.toDate() : new Date();
    const year = date.getFullYear();
    if (!unsyncedByYear[year]) unsyncedByYear[year] = [];
    unsyncedByYear[year].push(so);
  }

  const changes = []; // { id, oldNumber, newNumber }

  for (const [yearStr, sos] of Object.entries(unsyncedByYear)) {
    const year = parseInt(yearStr);
    const reserved = pinnedByYear[year] || new Set();

    // Sort by createdAt (already sorted from query, but ensure)
    sos.sort((a, b) => {
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return aTime - bTime;
    });

    let seq = 1;
    for (const so of sos) {
      // Skip reserved (pinned) numbers
      while (reserved.has(seq)) {
        seq++;
      }
      const newNumber = `SO-${year}-${String(seq).padStart(4, '0')}`;
      if (so.orderNumber !== newNumber) {
        changes.push({
          id: so.id,
          oldNumber: so.orderNumber,
          newNumber,
          customerName: so.customerName,
          status: so.status,
        });
      }
      seq++;
    }
  }

  // 6. Report
  if (changes.length === 0) {
    console.log('\n✅ No changes needed — all numbers are already correct.');
    return;
  }

  console.log(`\n${changes.length} SOs will be renumbered:\n`);
  console.log('  Old Number       → New Number       | Customer              | Status');
  console.log('  ' + '-'.repeat(85));
  for (const c of changes) {
    const customer = c.customerName.substring(0, 20).padEnd(20);
    console.log(`  ${c.oldNumber.padEnd(16)} → ${c.newNumber.padEnd(16)} | ${customer} | ${c.status}`);
  }

  // 7. Apply if not dry run
  if (DRY_RUN) {
    console.log(`\n⏸️  Dry run complete. Run with --apply to execute changes.`);
    return;
  }

  console.log(`\nApplying ${changes.length} changes...`);
  const batch = db.batch();
  for (const c of changes) {
    const ref = db.collection('salesOrders').doc(c.id);
    batch.update(ref, {
      orderNumber: c.newNumber,
      _previousOrderNumber: c.oldNumber,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'SYSTEM_RESEQUENCE',
    });
  }

  await batch.commit();
  console.log(`\n✅ ${changes.length} Sales Orders renumbered successfully.`);
  console.log('Previous numbers saved in _previousOrderNumber field for audit.');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
