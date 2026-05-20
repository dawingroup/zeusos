/**
 * align-transfer-references.cjs
 *
 * Backfill / re-align transfer references for existing fund transfers
 * across all advisory programs.
 *
 * Format:  TRF-{YEAR}-{NNN}   (e.g. TRF-2025-001, TRF-2026-002)
 *
 * The year is derived from each transfer's `transferDate`.
 * Sequence numbers are assigned per-program, per-year, ordered by transferDate.
 *
 * Usage:
 *   NODE_PATH=functions/node_modules node scripts/align-transfer-references.cjs
 *
 * Options:
 *   --dry-run    Print what would change without writing (default)
 *   --apply      Actually write changes to Firestore
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const SYSTEM_USER = 'system-script';
const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  if (DRY_RUN) {
    console.log('🔍 DRY RUN — no changes will be written. Pass --apply to commit.\n');
  } else {
    console.log('⚡ LIVE RUN — changes will be written to Firestore.\n');
  }

  // 1. Fetch all advisory programs
  const programsSnap = await db.collection('advisory_programs').get();
  console.log(`Found ${programsSnap.size} advisory program(s).\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const programDoc of programsSnap.docs) {
    const programData = programDoc.data();
    const programId = programDoc.id;
    const programName = programData.name || programData.code || programId;

    // 2. Fetch all fund_transfers for this program
    const transfersSnap = await db
      .collection('advisory_programs')
      .doc(programId)
      .collection('fund_transfers')
      .orderBy('transferDate', 'asc')
      .get();

    if (transfersSnap.empty) {
      console.log(`  [SKIP] ${programName} — no transfers`);
      continue;
    }

    console.log(`  📋 ${programName} — ${transfersSnap.size} transfer(s)`);

    // 3. Group transfers by year (from transferDate)
    const byYear = {};
    for (const doc of transfersSnap.docs) {
      const data = doc.data();
      let date;
      if (data.transferDate && data.transferDate._seconds) {
        date = new Date(data.transferDate._seconds * 1000);
      } else if (data.transferDate && data.transferDate.toDate) {
        date = data.transferDate.toDate();
      } else if (data.transferDate) {
        date = new Date(data.transferDate);
      } else {
        // Fallback to createdAt
        if (data.createdAt && data.createdAt._seconds) {
          date = new Date(data.createdAt._seconds * 1000);
        } else {
          date = new Date(); // last resort
        }
      }

      const year = date.getFullYear();
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push({ doc, date, data });
    }

    // 4. Assign sequential references per year
    for (const [year, entries] of Object.entries(byYear)) {
      // Sort by date within the year (should already be sorted, but be safe)
      entries.sort((a, b) => a.date.getTime() - b.date.getTime());

      for (let i = 0; i < entries.length; i++) {
        const { doc, data } = entries[i];
        const seq = i + 1;
        const newRef = `TRF-${year}-${String(seq).padStart(3, '0')}`;
        const oldRef = data.reference || '(none)';

        if (oldRef === newRef) {
          console.log(`     [OK]   ${doc.id}  ${oldRef} — already correct`);
          totalSkipped++;
          continue;
        }

        console.log(`     [UPD]  ${doc.id}  "${oldRef}" → "${newRef}"`);

        if (!DRY_RUN) {
          await db
            .collection('advisory_programs')
            .doc(programId)
            .collection('fund_transfers')
            .doc(doc.id)
            .update({
              reference: newRef,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: SYSTEM_USER,
            });
        }

        totalUpdated++;
      }
    }

    console.log('');
  }

  console.log('────────────────────────────────────');
  console.log(`✅ Done.  Updated: ${totalUpdated}  |  Already correct: ${totalSkipped}`);
  if (DRY_RUN && totalUpdated > 0) {
    console.log('   ⚠️  This was a dry run. Run with --apply to write changes.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
