/**
 * Deduplicate Sales Order `orderNumber` by created date: earliest SO keeps
 * the number, later duplicate rows get the next free **org-wide** sequence for that
 * calendar year (`SO-2026-nnnn` has no subsidiary in the string).
 * Updates Firestore `counters/so_global_{year}`.
 *
 * Auth (pick one):
 *   gcloud auth application-default login
 *   OR: GOOGLE_APPLICATION_CREDENTIALS=/path/sa.json
 *
 * Project:
 *   gcloud config set project YOUR_PROJECT
 *   OR: GOOGLE_CLOUD_PROJECT=… / GCLOUD_PROJECT=… / FIREBASE_PROJECT_ID=…
 *
 * Usage:
 *   node scripts/dedupe-sales-order-numbers.cjs              # dry-run
 *   node scripts/dedupe-sales-order-numbers.cjs --apply     # write
 *   node scripts/dedupe-sales-order-numbers.cjs --json      # machine-readable
 *
 * If a "loser" row is already linked to QBO, the script skips renumbering
 * that row unless you pass --force-qbo (QBO may still have the old DocNumber).
 *
 * Shorthand:
 *   ./scripts/run-dedupe-so-numbers.sh
 */

const admin = require('firebase-admin');

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'dawinos';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

const SO_COLLECTION = 'salesOrders';
const COUNTERS_COLLECTION = 'counters';

const DRY_RUN = !process.argv.includes('--apply');
const AS_JSON = process.argv.includes('--json');
const FORCE_QBO = process.argv.includes('--force-qbo');

function parseOrderNumber(num) {
  if (!num || typeof num !== 'string') return null;
  const m = num.match(/^SO-(\d{4})-(\d+)$/);
  if (!m) return null;
  return { year: parseInt(m[1], 10), seq: parseInt(m[2], 10) };
}

function formatSONumber(year, seq) {
  return `SO-${year}-${String(seq).padStart(4, '0')}`;
}

function getCreatedTime(data) {
  const ca = data.createdAt;
  if (ca && typeof ca.toDate === 'function') {
    return ca.toDate().getTime();
  }
  return 0;
}

/**
 * @returns {Promise<{
 *   all: { id: string, orderNumber: string, data: object }[],
 *   duplicateGroups: [string, any][],
 *   changes: object[],
 *   warnings: object[],
 *   finalMaxByYear: Map<number, number>,
 *   yearsToUpdateCounter: Set<number>
 * }>}
 */
async function plan() {
  const snap = await db.collection(SO_COLLECTION).get();
  const all = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.orderNumber == null) continue;
    all.push({ id: doc.id, orderNumber: d.orderNumber, data: d });
  }

  const byNumber = new Map();
  for (const e of all) {
    if (!byNumber.has(e.orderNumber)) byNumber.set(e.orderNumber, []);
    byNumber.get(e.orderNumber).push(e);
  }

  const duplicateGroups = [...byNumber.entries()].filter(([, list]) => list.length > 1);

  const renumberQueue = [];
  const warnings = [];

  for (const [orderNumber, list] of duplicateGroups) {
    const sorted = [...list].sort((a, b) => {
      const diff = getCreatedTime(a.data) - getCreatedTime(b.data);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    for (let i = 1; i < sorted.length; i++) {
      const loser = sorted[i];
      const hasQbo = !!(loser.data.qboInvoiceId || loser.data.qboSalesOrderId);
      if (hasQbo && !FORCE_QBO) {
        warnings.push({
          type: 'skipped_qbo',
          id: loser.id,
          orderNumber,
          message:
            'Loser is linked in QBO; skipped. Re-run with --force-qbo to renumber in Dawin only.',
        });
        continue;
      }
      renumberQueue.push({
        id: loser.id,
        oldNumber: orderNumber,
        subsidiaryId: loser.data.subsidiaryId || 'default',
        hasQbo,
        createdMs: getCreatedTime(loser.data),
        customerName: loser.data.customerName || '—',
        status: loser.data.status || '—',
      });
    }
  }

  const renumberIdSet = new Set(renumberQueue.map((q) => q.id));

  /** @type {Map<number, Set<number>>} */
  const usedSeqByYear = new Map();
  for (const e of all) {
    if (renumberIdSet.has(e.id)) continue;
    const p = parseOrderNumber(e.orderNumber);
    if (!p) {
      warnings.push({ type: 'bad_format', id: e.id, message: `Unparseable orderNumber: ${e.orderNumber}` });
      continue;
    }
    if (!usedSeqByYear.has(p.year)) usedSeqByYear.set(p.year, new Set());
    usedSeqByYear.get(p.year).add(p.seq);
  }

  renumberQueue.sort((a, b) => {
    if (a.createdMs !== b.createdMs) return a.createdMs - b.createdMs;
    return a.id.localeCompare(b.id);
  });

  const changes = [];
  for (const c of renumberQueue) {
    const parsed = parseOrderNumber(c.oldNumber);
    if (!parsed) {
      warnings.push({ type: 'bad_format', id: c.id, message: `Unparseable: ${c.oldNumber}` });
      continue;
    }
    const { year } = parsed;
    if (!usedSeqByYear.has(year)) usedSeqByYear.set(year, new Set());
    const set = usedSeqByYear.get(year);
    let max = 0;
    for (const s of set) {
      if (s > max) max = s;
    }
    const next = max + 1;
    set.add(next);
    changes.push({
      ...c,
      newNumber: formatSONumber(year, next),
    });
  }

  const newById = new Map(changes.map((c) => [c.id, c.newNumber]));
  const finalMaxByYear = new Map();
  for (const e of all) {
    const on = newById.get(e.id) || e.orderNumber;
    const p = parseOrderNumber(on);
    if (!p) continue;
    const cur = finalMaxByYear.get(p.year) || 0;
    if (p.seq > cur) finalMaxByYear.set(p.year, p.seq);
  }

  const yearsToUpdateCounter = new Set();
  for (const c of changes) {
    const p = parseOrderNumber(c.oldNumber);
    if (p) yearsToUpdateCounter.add(p.year);
  }

  return { all, duplicateGroups, changes, warnings, finalMaxByYear, yearsToUpdateCounter };
}

async function main() {
  if (!AS_JSON) {
    console.log('\n=== Sales order number deduplication (oldest keeps number) ===');
    console.log(`Project: ${PROJECT_ID}`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (add --apply to write)' : '⚠️  LIVE — writing'}\n`);
  }

  const { duplicateGroups, changes, warnings, finalMaxByYear, yearsToUpdateCounter } = await plan();

  if (duplicateGroups.length === 0 && !AS_JSON) {
    console.log('No duplicate orderNumber values found.');
  } else if (!AS_JSON && duplicateGroups.length > 0) {
    console.log('Duplicate orderNumber values (oldest in group keeps the number):');
    for (const [num, list] of duplicateGroups) {
      console.log(`\n  ${num} (×${list.length}):`);
      const sorted = [...list].sort((a, b) => getCreatedTime(a.data) - getCreatedTime(b.data));
      for (let i = 0; i < sorted.length; i++) {
        const e = sorted[i];
        const t = e.data.createdAt?.toDate ? e.data.createdAt.toDate().toISOString() : 'no date';
        const qbo = e.data.qboInvoiceId || e.data.qboSalesOrderId ? ' [QBO]' : '';
        const tag = i === 0 ? '→ keep' : '→ renumber (if not skipped)';
        console.log(`    ${tag} ${e.id} | ${e.data.customerName || '—'} | ${t}${qbo}`);
      }
    }
  }

  if (warnings.length && !AS_JSON) {
    console.log('\nWarnings:');
    for (const w of warnings) {
      console.log(`  [${w.type}] ${w.id || ''} — ${w.message || ''}`);
    }
  }

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        {
          projectId: PROJECT_ID,
          dryRun: DRY_RUN,
          duplicateGroupCount: duplicateGroups.length,
          changeCount: changes.length,
          changes,
          warnings,
          counterUpdates: [...yearsToUpdateCounter].map((y) => ({
            docId: `so_global_${y}`,
            year: y,
            value: finalMaxByYear.get(y),
          })),
        },
        null,
        2,
      ),
    );
    if (DRY_RUN) return;
  } else {
    if (changes.length > 0) {
      console.log(`\n${changes.length} sales order(s) to renumber:\n`);
      for (const c of changes) {
        const q = c.hasQbo ? ' [was QBO-linked]' : '';
        console.log(`  ${c.oldNumber} → ${c.newNumber}  |  ${c.id}  |  ${c.customerName}${q}`);
      }
    } else if (duplicateGroups.length > 0) {
      console.log(
        '\nNo automatic renumbering to apply (e.g. all duplicate "losers" are QBO-linked; use --force-qbo to override).',
      );
    } else {
      console.log('\nNo renumbering needed.');
    }
    if (DRY_RUN && changes.length > 0) {
      console.log('\n⏸️  Dry run. Run with --apply to write.');
    }
  }

  if (DRY_RUN) return;

  if (changes.length === 0) {
    if (!AS_JSON) {
      console.log('\nNo Firestore writes (nothing to renumber, or all duplicate rows were QBO-skipped).');
    }
    return;
  }

  let batch = db.batch();
  let n = 0;
  for (const c of changes) {
    batch.update(db.collection(SO_COLLECTION).doc(c.id), {
      orderNumber: c.newNumber,
      _dedupePreviousOrderNumber: c.oldNumber,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'SYSTEM_DEDUPE_SALES_ORDER_NUMBERS',
    });
    n++;
    if (n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (n % 400 !== 0) {
    await batch.commit();
  }

  for (const year of yearsToUpdateCounter) {
    const maxSeq = finalMaxByYear.get(year);
    if (maxSeq == null) continue;
    await db
      .collection(COUNTERS_COLLECTION)
      .doc(`so_global_${year}`)
      .set(
        {
          value: maxSeq,
          prefix: 'SO',
          year,
          scheme: 'global',
          updatedBy: 'SYSTEM_DEDUPE_SALES_ORDER_NUMBERS',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }

  if (!AS_JSON) {
    console.log(
      `\n✅ Updated ${changes.length} sales order(s) and ${yearsToUpdateCounter.size} global counter document(s).`,
    );
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
