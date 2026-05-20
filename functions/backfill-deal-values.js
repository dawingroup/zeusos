/**
 * Backfill CRM deal values from linked design project estimates.
 * Run with: node functions/backfill-deal-values.js
 */

const admin = require('firebase-admin');

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'dawinos' });
}
const db = admin.firestore();

const STAGE_PROBABILITY = {
  lead: 10,
  qualification: 20,
  site_visit: 35,
  design_proposal: 50,
  quotation: 65,
  negotiation: 80,
  won: 100,
  lost: 0,
  on_hold: 0,
};

async function backfillDealValues() {
  console.log('Fetching all CRM deals...');
  const dealsSnap = await db.collection('crmDeals').get();
  console.log(`Found ${dealsSnap.size} deals`);

  let updated = 0;
  let skipped = 0;
  let noProject = 0;
  let noEstimate = 0;

  for (const dealDoc of dealsSnap.docs) {
    const deal = dealDoc.data();
    const dealId = dealDoc.id;

    // Only process deals linked to a design project
    if (!deal.linkedProjectId) {
      skipped++;
      continue;
    }

    // Fetch the linked project
    const projectDoc = await db.collection('designProjects').doc(deal.linkedProjectId).get();
    if (!projectDoc.exists) {
      console.log(`  [SKIP] Deal "${deal.title}" — project ${deal.linkedProjectId} not found`);
      noProject++;
      continue;
    }

    const project = projectDoc.data();
    const estimate = project.consolidatedEstimate;

    if (!estimate || !estimate.total) {
      console.log(`  [SKIP] Deal "${deal.title}" — no estimate on project`);
      noEstimate++;
      continue;
    }

    // Calculate weighted value
    const probability = STAGE_PROBABILITY[deal.stage] ?? 0;
    const weightedValue = estimate.total * (probability / 100);

    console.log(`  [UPDATE] "${deal.title}" — ${estimate.currency || 'UGX'} ${estimate.total.toLocaleString()} (was ${(deal.estimatedValue || 0).toLocaleString()})`);

    await dealDoc.ref.update({
      estimatedValue: estimate.total,
      currency: estimate.currency || deal.currency || 'UGX',
      weightedValue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'backfill-script',
    });

    updated++;
  }

  console.log('\n--- Summary ---');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no linkedProjectId): ${skipped}`);
  console.log(`Skipped (project not found): ${noProject}`);
  console.log(`Skipped (no estimate): ${noEstimate}`);
  console.log(`Total: ${dealsSnap.size}`);
}

backfillDealValues()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
