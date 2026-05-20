/**
 * CREATE SALES ORDERS FROM APPROVED QUOTATIONS
 *
 * Scans `clientQuotes` for quotes with status = 'approved' that do NOT
 * already have a corresponding `salesOrders` document (matched by quoteId).
 * For each unmatched approved quote, creates a draft sales order.
 *
 * DRY RUN by default — set DRY_RUN=false to apply changes.
 *
 * Usage:
 *   DRY_RUN=true  node scripts/create-sales-orders-from-approved-quotes.cjs
 *   DRY_RUN=false node scripts/create-sales-orders-from-approved-quotes.cjs
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DRY_RUN !== 'false';
const SYSTEM_USER = 'SYSTEM_AUTO_SO_CREATION';
const DEFAULT_SUBSIDIARY = 'dawin-finishes';

const QUOTES_COLLECTION = 'clientQuotes';
const SO_COLLECTION = 'salesOrders';
const DEALS_COLLECTION = 'crmDeals';
const EVENTS_COLLECTION = 'businessEvents';

// Default payment terms
const DEFAULT_PAYMENT_TERMS = {
  depositRequired: true,
  depositPercent: 50,
  paymentDueDays: 30,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount, currency = 'UGX') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Next global `SO-{year}-{nnnn}` (aligns with `salesOrderService.generateSONumber`).
 */
async function allocateNextGlobalSONumberSeeded(db, year) {
  const yearLo = `SO-${year}-`;
  const yearHi = `SO-${year + 1}-`;
  const ordersSnap = await db
    .collection(SO_COLLECTION)
    .where('orderNumber', '>=', yearLo)
    .where('orderNumber', '<', yearHi)
    .get();
  let maxFromOrders = 0;
  const re = new RegExp(`^SO-${year}-(\\d+)$`);
  for (const d of ordersSnap.docs) {
    const on = d.data().orderNumber;
    if (typeof on !== 'string') continue;
    const m = on.match(re);
    if (m) maxFromOrders = Math.max(maxFromOrders, parseInt(m[1], 10));
  }

  const counterRef = db.collection('counters').doc(`so_global_${year}`);
  const counterSnap = await counterRef.get();
  const cur = counterSnap.exists ? counterSnap.data().value ?? 0 : 0;
  const target = Math.max(cur, maxFromOrders);
  if (target > cur || !counterSnap.exists) {
    await counterRef.set(
      { value: target, prefix: 'SO', year, scheme: 'global' },
      { merge: true },
    );
  }

  return db.runTransaction(async (t) => {
    const snap = await t.get(counterRef);
    let current = 0;
    if (snap.exists) current = snap.data().value ?? 0;
    const next = current + 1;
    t.set(counterRef, { value: next, prefix: 'SO', year, scheme: 'global' }, { merge: true });
    return next;
  });
}

/**
 * Find the CRM deal linked to a project (if any).
 */
async function findDealForProject(projectId) {
  const snap = await db
    .collection(DEALS_COLLECTION)
    .where('linkedProjectId', '==', projectId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Initialize gate statuses for a new SO.
 */
function initializeGates(amount, hasDiscount, depositRequired) {
  return {
    clientAcceptance: {
      required: true,
      status: 'approved', // Quote was already approved
      approvedBy: SYSTEM_USER,
      approvedAt: Timestamp.now(),
      evidence: 'Auto-approved: quote was already client-approved',
    },
    discountApproval: {
      required: hasDiscount,
      status: hasDiscount ? 'not_started' : 'approved',
    },
    designSignOff: {
      required: true,
      status: 'not_started',
    },
    scopeFreeze: {
      required: true,
      status: 'not_started',
    },
    internalReview: {
      required: amount >= 10000000, // 10M UGX threshold
      status: amount >= 10000000 ? 'not_started' : 'approved',
    },
    depositReceived: {
      required: depositRequired,
      status: depositRequired ? 'not_started' : 'approved',
    },
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   CREATE SALES ORDERS FROM APPROVED QUOTATIONS      ║');
  console.log(`║   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : '🔴 LIVE — changes will be applied'}   ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // 1. Fetch all approved quotes
  console.log('📋 Fetching approved quotations...');
  const quotesSnap = await db
    .collection(QUOTES_COLLECTION)
    .where('status', '==', 'approved')
    .get();

  if (quotesSnap.empty) {
    console.log('  ℹ️  No approved quotations found.');
    process.exit(0);
  }
  console.log(`  Found ${quotesSnap.size} approved quotation(s)\n`);

  // 2. Fetch all existing SO quoteIds to avoid duplicates
  console.log('📋 Checking existing sales orders...');
  const existingSOSnap = await db.collection(SO_COLLECTION).get();
  const existingQuoteIds = new Set();
  existingSOSnap.forEach((doc) => {
    const data = doc.data();
    if (data.quoteId) existingQuoteIds.add(data.quoteId);
  });
  console.log(`  Found ${existingSOSnap.size} existing SO(s), ${existingQuoteIds.size} linked to quotes\n`);

  // 3. Process each approved quote
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const quoteDoc of quotesSnap.docs) {
    const quote = { id: quoteDoc.id, ...quoteDoc.data() };
    const label = `${quote.quoteNumber || quote.id} (${quote.customerName || 'Unknown'})`;

    // Skip if SO already exists for this quote
    if (existingQuoteIds.has(quote.id)) {
      console.log(`  ⏭️  ${label} — SO already exists, skipping`);
      skipped++;
      continue;
    }

    try {
      const subsidiaryId = quote.subsidiaryId || DEFAULT_SUBSIDIARY;

      // Find linked CRM deal (optional)
      const deal = quote.projectId ? await findDealForProject(quote.projectId) : null;

      const year = new Date().getFullYear();
      const nextSeq = await allocateNextGlobalSONumberSeeded(db, year);
      const orderNumber = `SO-${year}-${String(nextSeq).padStart(4, '0')}`;

      // Map line items
      const lineItems = (quote.lineItems || []);
      const scopeItems = lineItems.map((li, idx) => ({
        id: `item-${idx + 1}`,
        lineNumber: idx + 1,
        description: li.description || '',
        specification: '',
        quantity: li.quantity || 1,
        unit: li.unit || 'pcs',
        unitPrice: li.unitPrice || 0,
        totalPrice: (li.quantity || 1) * (li.unitPrice || 0),
        category: li.category || 'other',
        fromQuoteVersion: 1,
        isActive: true,
      }));

      const totalAmount = scopeItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const currency = quote.currency || 'UGX';

      // Payment terms
      const depositRequired = !!quote.depositRequired;
      const depositPercent = typeof quote.depositRequired === 'number' ? quote.depositRequired : DEFAULT_PAYMENT_TERMS.depositPercent;
      const paymentTerms = {
        ...DEFAULT_PAYMENT_TERMS,
        depositRequired,
        depositPercent,
        depositAmount: depositRequired ? Math.round(totalAmount * (depositPercent / 100)) : 0,
      };

      const gates = initializeGates(totalAmount, false, depositRequired);

      const now = Timestamp.now();
      const soData = {
        subsidiaryId,
        orderNumber,
        title: quote.title || `Sales Order for ${quote.customerName}`,
        description: quote.description || `Auto-created from approved quote ${quote.quoteNumber || quote.id}`,
        designProjectId: quote.projectId || '',
        crmDealId: deal?.id || '',
        customerId: quote.customerId || '',
        customerName: quote.customerName || '',
        customerEmail: quote.customerEmail || '',
        quoteId: quote.id,
        originalQuoteAmount: quote.total || totalAmount,
        currentAmount: totalAmount,
        currency,
        discounts: [],
        totalDiscountAmount: 0,
        totalDiscountPercent: 0,
        scopeVersion: 1,
        scopeDescription: quote.title || '',
        scopeItems,
        scopeFrozen: false,
        changeOrders: [],
        totalChangeOrderValue: 0,
        pendingChangeOrders: 0,
        gates,
        paymentTerms,
        status: 'client_accepted',
        riskFlags: [],
        attachments: [],
        statusHistory: [
          {
            fromStatus: null,
            toStatus: 'draft',
            changedAt: now,
            changedBy: SYSTEM_USER,
            notes: 'Auto-created from approved quotation',
          },
          {
            fromStatus: 'draft',
            toStatus: 'client_accepted',
            changedAt: now,
            changedBy: SYSTEM_USER,
            notes: 'Client already approved the quotation',
          },
        ],
        createdAt: now,
        createdBy: SYSTEM_USER,
        updatedAt: now,
        updatedBy: SYSTEM_USER,
      };

      console.log(`  ✅ ${label}`);
      console.log(`      → ${orderNumber} | ${fmt(totalAmount, currency)} | ${scopeItems.length} item(s)`);
      if (deal) console.log(`      → Linked to CRM deal: ${deal.dealNumber || deal.id}`);

      if (!DRY_RUN) {
        const docRef = await db.collection(SO_COLLECTION).add(soData);
        console.log(`      → Created: ${docRef.id}`);

        // Emit business event
        await db.collection(EVENTS_COLLECTION).add({
          type: 'sales_order.created_from_quote',
          module: 'sales-orders',
          entityType: 'sales_order',
          entityId: docRef.id,
          data: {
            orderNumber,
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            customerId: quote.customerId,
            amount: totalAmount,
            currency,
          },
          createdAt: now,
          createdBy: SYSTEM_USER,
        });
      }

      created++;
    } catch (err) {
      console.error(`  ❌ ${label} — Error: ${err.message}`);
      errors++;
    }
  }

  // Summary
  console.log('\n' + '─'.repeat(56));
  console.log(`\n📊 Summary:`);
  console.log(`   Created:  ${created}`);
  console.log(`   Skipped:  ${skipped} (SO already exists)`);
  console.log(`   Errors:   ${errors}`);
  console.log(`   Total:    ${quotesSnap.size} approved quote(s)`);

  if (DRY_RUN && created > 0) {
    console.log('\n⚠️  DRY RUN — no changes were made.');
    console.log('   Run with DRY_RUN=false to create sales orders.');
  }

  console.log('');
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
