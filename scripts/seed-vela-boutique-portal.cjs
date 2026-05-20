/**
 * Seed Vela Boutique — Client Portal demo project.
 *
 * Creates a realistic Finishes DesignProject + linked SalesOrder that
 * matches the wireframe (Vela Boutique — DIFC · 412 m² · contract value
 * UGX 2.84Bn · handover 11 Jul 2026). Optionally grants portal access
 * to a Firebase Auth UID so a client user can sign in and see it.
 *
 * Run:
 *   node scripts/seed-vela-boutique-portal.cjs --dry-run
 *   node scripts/seed-vela-boutique-portal.cjs
 *   node scripts/seed-vela-boutique-portal.cjs --client-uid <FIREBASE_UID>
 *   node scripts/seed-vela-boutique-portal.cjs --client-email selina@naqaa.example
 *
 * If `--client-email` is provided, the script looks up the matching Firebase
 * Auth user (must already exist — create via console or magic-link sign-in)
 * and adds their UID to `clientPortalUserIds`.
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const clientUidArg = args.find((a, i) => args[i - 1] === '--client-uid') ?? null;
const clientEmailArg = args.find((a, i) => args[i - 1] === '--client-email') ?? null;

const PROJECT_CODE = 'VELA-2026-014';
const PROJECT_NAME = 'Vela Boutique — DIFC';
const SUBSIDIARY_ID = 'finishes';
const CUSTOMER_ID = 'cust-naqaa-holding';
const CUSTOMER_NAME = 'Naqaa Holding';
const SEED_TAG = 'portal-demo-seed';

function dateTs(year, monthIndex, day) {
  return Timestamp.fromDate(new Date(Date.UTC(year, monthIndex, day)));
}

async function resolveClientUid() {
  if (clientUidArg) return clientUidArg;
  if (clientEmailArg) {
    try {
      const user = await admin.auth().getUserByEmail(clientEmailArg);
      console.log(`  resolved ${clientEmailArg} -> ${user.uid}`);
      return user.uid;
    } catch (e) {
      console.warn(`  ! ${clientEmailArg} has no Firebase Auth account yet — leaving access list empty.`);
      console.warn('    Have the client sign in once via /portal/sign-in to create the account, then re-run with --client-uid.');
      return null;
    }
  }
  return null;
}

async function ensureCustomer() {
  const ref = db.collection('customers').doc(CUSTOMER_ID);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`  ✓ customer ${CUSTOMER_ID} exists`);
    return;
  }
  if (DRY_RUN) {
    console.log(`  + would create customer ${CUSTOMER_ID}`);
    return;
  }
  await ref.set({
    id: CUSTOMER_ID,
    name: CUSTOMER_NAME,
    type: 'organization',
    subsidiaryId: SUBSIDIARY_ID,
    primaryContact: { name: 'Selina Saleh', email: 'selina@naqaa.example' },
    seedTag: SEED_TAG,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  console.log(`  + created customer ${CUSTOMER_ID}`);
}

async function seedProject(clientUid) {
  const projects = await db.collection('designProjects').where('code', '==', PROJECT_CODE).get();

  const milestones = [
    { id: 'm-joinery-install', label: 'Joinery install starts',  detail: '4 days on site · zone A,B', owner: 'Falcon Joinery', date: dateTs(2026, 4, 22), weekLabel: 'Wk 15', category: 'construction', status: 'upcoming' },
    { id: 'm-stone-arrival',   label: 'Stone arrival on site',  detail: 'Calacatta 18.4 m² · IT',     owner: 'Marmi Bruno',     date: dateTs(2026, 4, 26), weekLabel: 'Wk 15', category: 'construction', status: 'upcoming' },
    { id: 'm-mep-first-fix',   label: 'MEP first fix complete', detail: 'Inspection scheduled',       owner: 'Contractor',      date: dateTs(2026, 5, 2),  weekLabel: 'Wk 17', category: 'construction', status: 'upcoming' },
    { id: 'm-lighting-comm',   label: 'Lighting commissioning', detail: 'Vibia on site 4 days',       owner: 'Vibia ES',        date: dateTs(2026, 5, 8),  weekLabel: 'Wk 18', category: 'construction', status: 'upcoming' },
    { id: 'm-finishes-touch',  label: 'Finishes touch-up',      detail: 'Walk-through',               owner: 'Contractor',      date: dateTs(2026, 5, 11), weekLabel: 'Wk 19', category: 'snagging',     status: 'upcoming' },
    { id: 'm-practical-comp',  label: 'Practical completion',   detail: 'Handover walk',               owner: 'Project team',    date: dateTs(2026, 6, 11), weekLabel: 'Wk 22', category: 'handover',     status: 'upcoming' },
  ];

  const risks = [
    {
      id: 'r-stone-q019',
      title: 'Stone slot dependent on Q-019 signoff',
      mitigation: 'Mitigation: client review 16 May',
      severity: 'high',
      category: 'schedule',
    },
    {
      id: 'r-lighting-finish',
      title: 'Lighting finish decision pending',
      mitigation: 'Mitigation: site visit 12 May',
      severity: 'medium',
      category: 'design',
    },
    {
      id: 'r-supplier-shipping',
      title: 'Supplier longshoring delay risk',
      mitigation: 'Italy → Jebel Ali · 4 days buffer',
      severity: 'low',
      category: 'supplier',
    },
  ];

  const sitePhotos = [
    { id: 'p-zone-a',      label: 'Zone A',      tone: 'site',          capturedAt: dateTs(2026, 4, 12) },
    { id: 'p-zone-b',      label: 'Zone B',      tone: 'interior-warm', capturedAt: dateTs(2026, 4, 12) },
    { id: 'p-zone-c',      label: 'Zone C',      tone: 'fabric',        capturedAt: dateTs(2026, 4, 12) },
    { id: 'p-storefront',  label: 'Storefront',  tone: 'light',         capturedAt: dateTs(2026, 4, 11) },
    { id: 'p-joinery',     label: 'Joinery',     tone: 'render',        capturedAt: dateTs(2026, 4, 11) },
    { id: 'p-stone',       label: 'Stone',       tone: 'interior',      capturedAt: dateTs(2026, 4, 10) },
    { id: 'p-mep',         label: 'MEP',         tone: 'site',          capturedAt: dateTs(2026, 4, 9) },
    { id: 'p-plinths',     label: 'Plinths',     tone: 'render-2',      capturedAt: dateTs(2026, 4, 9) },
  ];

  const projectData = {
    code: PROJECT_CODE,
    name: PROJECT_NAME,
    description: 'Luxury boutique fit-out in DIFC. 412 m² flagship store.',
    customerId: CUSTOMER_ID,
    customerName: CUSTOMER_NAME,
    status: 'active',
    startDate: dateTs(2026, 1, 4),    // 4 Feb 2026
    baselineDate: dateTs(2026, 1, 4),
    dueDate: dateTs(2026, 6, 11),     // 11 Jul 2026
    siteLocation: {
      address: 'Gate Village 11, DIFC, Dubai, UAE',
      city: 'Dubai',
      country: 'United Arab Emirates',
    },
    physicalProgress: 62,
    phaseCompletion: {
      design: 100,
      procurement: 94,
      construction: 58,
      snagging: 0,
    },
    milestones,
    risks,
    sitePhotos,
    clientPortalUserIds: clientUid ? [clientUid] : [],
    seedTag: SEED_TAG,
    updatedAt: Timestamp.now(),
    updatedBy: 'seed-script',
  };

  let projectRef;
  if (!projects.empty) {
    projectRef = projects.docs[0].ref;
    console.log(`  ~ project ${PROJECT_CODE} exists (${projectRef.id}) — ${DRY_RUN ? 'would update' : 'updating'}`);
    if (!DRY_RUN) await projectRef.set(projectData, { merge: true });
  } else {
    if (DRY_RUN) {
      console.log(`  + would create project ${PROJECT_CODE}`);
      return null;
    }
    projectRef = db.collection('designProjects').doc();
    await projectRef.set({
      ...projectData,
      id: projectRef.id,
      createdAt: Timestamp.now(),
      createdBy: 'seed-script',
    });
    console.log(`  + created project ${PROJECT_CODE} (${projectRef.id})`);
  }

  return projectRef;
}

async function seedSalesOrder(projectRef, clientUid) {
  if (!projectRef) return null;

  const existing = await db.collection('salesOrders').where('designProjectId', '==', projectRef.id).get();

  const soData = {
    designProjectId: projectRef.id,
    customerId: CUSTOMER_ID,
    customerName: CUSTOMER_NAME,
    subsidiaryId: SUBSIDIARY_ID,

    // Mirror of the parent project's portal whitelist. Firestore rules
    // read this directly on the SO doc so portal Financials reads don't
    // need a cross-collection get() to enforce access.
    clientPortalUserIds: clientUid ? [clientUid] : [],
    orderNumber: 'SO-VELA-2026-014',
    title: 'Vela Boutique — DIFC · fit-out',
    description: 'Full fit-out: joinery, stone, lighting, MEP, FF&E.',

    originalQuoteAmount: 2_840_000_000,
    currentAmount: 2_840_000_000,
    currency: 'UGX',

    discounts: [],
    totalDiscountAmount: 0,
    totalDiscountPercent: 0,

    scopeVersion: 3,
    scopeDescription: 'Phase 1 design sealed; Phase 2 procurement complete; Phase 3 construction in progress.',
    scopeItems: [],
    scopeFrozen: true,
    scopeFrozenAt: Timestamp.now(),
    scopeFrozenBy: 'seed-script',

    changeOrders: [],
    totalChangeOrderValue: 0,
    pendingChangeOrders: 0,

    gates: {},

    paymentTerms: {
      depositRequired: true,
      depositPercent: 20,
      paymentDueDays: 14,
      milestonePayments: [
        { label: 'Mobilisation',     percentage: 20 },
        { label: 'Design closeout',  percentage: 15 },
        { label: 'Procurement 50%',  percentage: 30 },
        { label: 'Construction 50%', percentage: 20 },
        { label: 'Handover',         percentage: 15 },
      ],
    },

    expectedDeliveryDate: dateTs(2026, 6, 11),
    installationRequired: true,

    status: 'active',
    statusHistory: [],

    attachments: [],
    riskFlags: [],

    // Three settled payments + one open milestone billing trigger.
    // Amounts sum to the seeded totalPaid (51% of UGX 2.84Bn).
    payments: [
      {
        id: 'PMT-001',
        type: 'deposit',
        method: 'Bank Transfer',
        amount: 568_000_000,         // 20% Mobilisation
        currency: 'UGX',
        paymentDate: dateTs(2026, 2, 14),
        receiptRef: 'INV-010',
        receiptDocumentNumber: 'RCP-2026-014-001',
        sharedViaWhatsApp: false,
        recordedAt: dateTs(2026, 2, 14),
        recordedBy: 'seed-script',
      },
      {
        id: 'PMT-002',
        type: 'milestone',
        method: 'Bank Transfer',
        amount: 426_000_000,         // 15% Design closeout
        currency: 'UGX',
        paymentDate: dateTs(2026, 3, 20),
        receiptRef: 'INV-011',
        receiptDocumentNumber: 'RCP-2026-014-002',
        sharedViaWhatsApp: false,
        recordedAt: dateTs(2026, 3, 20),
        recordedBy: 'seed-script',
      },
      {
        id: 'PMT-003',
        type: 'milestone',
        method: 'Bank Transfer',
        amount: 852_000_000,         // 30% Procurement 50%
        currency: 'UGX',
        paymentDate: dateTs(2026, 4, 28),
        receiptRef: 'INV-012',
        receiptDocumentNumber: 'RCP-2026-014-003',
        sharedViaWhatsApp: false,
        recordedAt: dateTs(2026, 4, 28),
        recordedBy: 'seed-script',
      },
    ],
    totalPaid: 1_846_000_000,    // 65% — matches three milestone payments above
    balanceRemaining: 994_000_000,

    seedTag: SEED_TAG,
    updatedAt: Timestamp.now(),
    updatedBy: 'seed-script',
  };

  let soRef;
  if (!existing.empty) {
    soRef = existing.docs[0].ref;
    console.log(`  ~ sales order for ${projectRef.id} exists (${soRef.id}) — ${DRY_RUN ? 'would update' : 'updating'}`);
    if (!DRY_RUN) await soRef.set(soData, { merge: true });
  } else {
    if (DRY_RUN) {
      console.log(`  + would create sales order for ${projectRef.id}`);
      return null;
    }
    soRef = db.collection('salesOrders').doc();
    await soRef.set({
      ...soData,
      id: soRef.id,
      createdAt: Timestamp.now(),
      createdBy: 'seed-script',
    });
    // Link back from project
    await projectRef.set({ linkedSalesOrderId: soRef.id }, { merge: true });
    console.log(`  + created sales order ${soRef.id}`);
  }

  return soRef;
}

// ─── seed quotations: 1 pre-contract clientQuote + 1 sealed historical CO ───
async function seedQuotations(soRef, projectRef, clientUid) {
  if (!soRef || !projectRef) return;

  // ── ClientQuote: original quote that became the contract ────
  const existingQuote = await db.collection('clientQuotes')
    .where('projectId', '==', projectRef.id)
    .where('seedTag', '==', SEED_TAG)
    .get();

  const quoteData = {
    projectId: projectRef.id,
    projectCode: 'VELA-2026-014',
    projectName: 'Vela Boutique — DIFC',
    customerId: CUSTOMER_ID,
    customerName: CUSTOMER_NAME,
    clientName: 'Selina Saleh',
    clientEmail: 'onzimai@dawin.group',

    quoteNumber: 'QT-2026-001',
    quoteDate: dateTs(2026, 1, 14),
    title: 'Fit-out master quote v3',
    description: 'Full scope: joinery, stone, lighting, MEP and FF&E for the 412 m² Vela Boutique flagship at DIFC. Sealed and locked into the master contract on 4 Feb 2026.',

    status: 'approved',
    lineItems: [],
    procurementItems: [],

    subtotal: 2_704_000_000,
    taxRate: 5,
    taxAmount: 135_200_000,
    total: 2_840_000_000,
    currency: 'UGX',

    validUntil: dateTs(2026, 2, 14),
    paymentTerms: '20% deposit · 5 milestone schedule',
    depositRequired: 20,
    depositType: 'percentage',

    accessToken: 'seed-portal-token-vela-014',
    version: 3,

    createdAt: dateTs(2026, 1, 14),
    createdBy: 'seed-script',
    sentAt: dateTs(2026, 1, 18),
    viewedAt: dateTs(2026, 1, 19),
    respondedAt: dateTs(2026, 2, 4),

    clientResponse: {
      status: 'approved',
      notes: 'Approved as sealed scope. Proceed to contract.',
      respondedAt: dateTs(2026, 2, 4),
      respondedBy: 'Selina Saleh',
    },

    seedTag: SEED_TAG,
  };

  if (!existingQuote.empty) {
    const ref = existingQuote.docs[0].ref;
    console.log(`  ~ client quote ${quoteData.quoteNumber} exists (${ref.id}) — ${DRY_RUN ? 'would update' : 'updating'}`);
    if (!DRY_RUN) await ref.set(quoteData, { merge: true });
  } else if (!DRY_RUN) {
    const ref = db.collection('clientQuotes').doc();
    await ref.set({ ...quoteData, id: ref.id });
    console.log(`  + created client quote ${ref.id} (${quoteData.quoteNumber})`);
  } else {
    console.log(`  + would create client quote ${quoteData.quoteNumber}`);
  }

  // ── Sealed historical change order: Q-017 MEP package ─────
  // We tag this one differently so the seeded "awaiting client" CO
  // from seedApprovals() and this sealed historical CO co-exist.
  const sealedTag = `${SEED_TAG}--sealed`;
  const existingSealedCO = await db.collection('changeOrders')
    .where('salesOrderId', '==', soRef.id)
    .where('seedTag', '==', sealedTag)
    .get();

  const sealedCO = {
    subsidiaryId: SUBSIDIARY_ID,
    salesOrderId: soRef.id,
    changeOrderNumber: 'Q-017',

    type: 'scope_addition',
    title: 'MEP package — additional sub-contractor scope',
    description: 'Adds mechanical and electrical sub-contractor scope for back-of-house plant. Sealed on 28 Apr.',
    reason: 'Identified during design closeout — original quote had MEP as a provisional sum.',
    requestedBy: 'internal',

    priceImpact: 184_500_000,
    previousOrderTotal: 2_655_500_000,
    newOrderTotal: 2_840_000_000,

    itemsAdded: [],
    itemsRemoved: [],
    itemsModified: [],

    deliveryDateImpact: 0,

    status: 'approved',
    internalApprovalRequired: true,
    internalApprovedBy: 'D. Wahab',
    internalApprovedAt: dateTs(2026, 4, 14),
    clientApprovalRequired: true,
    clientApprovedAt: dateTs(2026, 4, 28),
    clientApprovalEvidence: 'portal:onzimai@dawin.group',

    submittedForInternalAt: dateTs(2026, 4, 12),
    submittedForInternalBy: 'D. Wahab',
    submittedToClientAt: dateTs(2026, 4, 14),
    submittedToClientBy: 'D. Wahab',
    sentToClientVia: ['client_portal'],

    appliedAt: dateTs(2026, 4, 28),
    appliedBy: 'system',

    isPostScopeFreeze: true,
    scopeVersionBefore: 2,
    scopeVersionAfter: 3,

    seedTag: sealedTag,
    createdAt: dateTs(2026, 4, 10),
    updatedAt: Timestamp.now(),
    createdBy: 'seed-script',
  };

  if (!existingSealedCO.empty) {
    const ref = existingSealedCO.docs[0].ref;
    console.log(`  ~ sealed change order ${sealedCO.changeOrderNumber} exists (${ref.id}) — ${DRY_RUN ? 'would update' : 'updating'}`);
    if (!DRY_RUN) await ref.set(sealedCO, { merge: true });
  } else if (!DRY_RUN) {
    const ref = db.collection('changeOrders').doc();
    await ref.set({ ...sealedCO, id: ref.id });
    console.log(`  + created sealed change order ${ref.id} (${sealedCO.changeOrderNumber})`);
  } else {
    console.log(`  + would create sealed change order ${sealedCO.changeOrderNumber}`);
  }
  // clientUid is unused but accepted for symmetry with seedApprovals.
  void clientUid;
}

// ─── seed materials: subcollection with portal-visible material schedule ───
async function seedMaterials(projectRef) {
  if (!projectRef) return;

  // Each material doc lives under designProjects/<projectId>/materials/<id>.
  // Standard schema fields (code, name, category, etc.) + a small set
  // of portal-only extras (portalStatus, portalZone, portalDisplaySpec,
  // portalTone) that the editorial portal hook reads to render the
  // material schedule cards.
  const materials = [
    {
      id: 'M-STN-01',
      code: 'M-STN-01', name: 'Calacatta Borghini 20mm',
      description: 'Italy · book-matched · 18.4 m² · sealed finish',
      category: 'stone-composite', subcategory: 'Natural Stone',
      tier: 'project', status: 'active',
      portalStatus: 'open', portalZone: 'A',
      portalDisplaySpec: 'Italy · book-matched · 18.4 m²',
      portalQty: '18.4 m²', portalTone: 'stone',
    },
    {
      id: 'M-STN-02',
      code: 'M-STN-02', name: 'Travertine roman 30mm',
      description: 'Tivoli quarry · honed surface · 6.2 m²',
      category: 'stone-composite', subcategory: 'Natural Stone',
      tier: 'project', status: 'active',
      portalStatus: 'sealed', portalZone: 'C',
      portalDisplaySpec: 'Tivoli · honed · 6.2 m²',
      portalQty: '6.2 m²', portalTone: 'stone',
    },
    {
      id: 'M-TIM-01',
      code: 'M-TIM-01', name: 'Walnut veneer A1',
      description: 'Falcon · 124 m² · oiled finish',
      category: 'sheet-goods', subcategory: 'Veneer',
      tier: 'project', status: 'active',
      portalStatus: 'ordered', portalZone: 'A,B',
      portalDisplaySpec: 'Falcon · 124 m² · oiled',
      portalQty: '124 m²', portalTone: 'interior-warm',
    },
    {
      id: 'M-TIM-02',
      code: 'M-TIM-02', name: 'European oak floor',
      description: 'Brushed · UV-oil · 312 m²',
      category: 'solid-wood', subcategory: 'Hardwood',
      tier: 'project', status: 'active',
      portalStatus: 'on_site', portalZone: 'A,B',
      portalDisplaySpec: 'Brushed · UV-oil · 312 m²',
      portalQty: '312 m²', portalTone: 'interior',
    },
    {
      id: 'M-FAB-01',
      code: 'M-FAB-01', name: 'Kvadrat Fiord 0961',
      description: 'Wool · upholstery · 28 m',
      category: 'fabric-upholstery', subcategory: 'Fabric',
      tier: 'project', status: 'active',
      portalStatus: 'sealed', portalZone: 'C',
      portalDisplaySpec: 'Wool · upholstery · 28 m',
      portalQty: '28 m', portalTone: 'fabric',
    },
    {
      id: 'M-LGT-01',
      code: 'M-LGT-01', name: 'Vibia North 5650',
      description: 'Pendant · 12 fittings · bronze',
      category: 'hardware', subcategory: 'Lighting',
      tier: 'project', status: 'active',
      portalStatus: 'open', portalZone: 'A',
      portalDisplaySpec: 'Pendant · 12 fittings · bronze',
      portalQty: '12 ea', portalTone: 'light',
    },
    {
      id: 'M-LGT-02',
      code: 'M-LGT-02', name: 'Track head ALR-3',
      description: '28 fixtures · bronze/black TBD',
      category: 'hardware', subcategory: 'Lighting',
      tier: 'project', status: 'active',
      portalStatus: 'open', portalZone: 'A,C',
      portalDisplaySpec: '28 fixtures · bronze/black TBD',
      portalQty: '28 ea', portalTone: 'light',
    },
    {
      id: 'M-HW-01',
      code: 'M-HW-01', name: 'Sugatsune door pulls',
      description: 'Satin bronze · 42 doors',
      category: 'hardware', subcategory: 'Handles/Knobs',
      tier: 'project', status: 'active',
      portalStatus: 'ordered', portalZone: 'A,B',
      portalDisplaySpec: 'Satin bronze · 42 doors',
      portalQty: '84 ea', portalTone: 'render',
    },
  ];

  const materialsRef = db.collection('designProjects').doc(projectRef.id).collection('materials');

  for (const m of materials) {
    const ref = materialsRef.doc(m.id);
    const data = {
      ...m,
      seedTag: SEED_TAG,
      createdAt: dateTs(2026, 0, 14),
      createdBy: 'seed-script',
      updatedAt: Timestamp.now(),
      updatedBy: 'seed-script',
    };
    if (DRY_RUN) {
      console.log(`  + would write material ${m.id}`);
    } else {
      await ref.set(data, { merge: true });
    }
  }
  if (!DRY_RUN) {
    console.log(`  + wrote ${materials.length} materials to designProjects/${projectRef.id}/materials`);
  }
}

// ─── seed advisory: Naqaa Retail Rollout programme (DesignProject + 14 stores) ───
const NAQAA_PROJECT_CODE = 'NAQAA-2026-008';
const NAQAA_PROJECT_NAME = 'Naqaa Retail Rollout 2026';

async function seedAdvisoryProgramme(clientUid) {
  const projects = await db.collection('designProjects').where('code', '==', NAQAA_PROJECT_CODE).get();

  const stores = [
    { id: 'naqaa-01', code: 'Naqaa-01', name: 'Dubai Mall',         format: 'Flagship · 312 m²', region: 'UAE',   phaseStatus: 'Live',           boqStatus: 'v4 sealed',  openDateLabel: '14 Feb' },
    { id: 'naqaa-02', code: 'Naqaa-02', name: 'Mall of Emirates',   format: 'Standard · 224 m²', region: 'UAE',   phaseStatus: 'Live',           boqStatus: 'v3 sealed',  openDateLabel: '28 Mar' },
    { id: 'naqaa-03', code: 'Naqaa-03', name: 'Riyadh Park',        format: 'Standard · 240 m²', region: 'KSA',   phaseStatus: 'Live',           boqStatus: 'v3 sealed',  openDateLabel: '22 Apr' },
    { id: 'naqaa-04', code: 'Naqaa-04', name: 'The Avenues',        format: 'Standard · 198 m²', region: 'KSA',   phaseStatus: 'Fit-out · Wk 6', boqStatus: 'v3 sealed',  openDateLabel: '4 Jun' },
    { id: 'naqaa-05', code: 'Naqaa-05', name: 'Yas Mall',           format: 'Standard · 264 m²', region: 'UAE',   phaseStatus: 'Fit-out · Wk 2', boqStatus: 'v3 sealed',  openDateLabel: '22 Jun' },
    { id: 'naqaa-08', code: 'Naqaa-08', name: 'Riyadh Front',       format: 'Flagship · 380 m²', region: 'KSA',   phaseStatus: 'BOQ approval',   boqStatus: 'v3 review',  openDateLabel: '14 Aug', signal: true },
    { id: 'naqaa-09', code: 'Naqaa-09', name: 'Red Sea Mall',       format: 'Standard · 218 m²', region: 'KSA',   phaseStatus: 'BOQ approval',   boqStatus: 'v3 review',  openDateLabel: '28 Aug', signal: true },
    { id: 'naqaa-10', code: 'Naqaa-10 to 14', name: 'pending design', format: '5 stores',         region: 'Mixed', phaseStatus: 'Schematic',      boqStatus: '—',          openDateLabel: 'Q4 26', dim: true },
  ];

  const programme = {
    phaseLabel: 'Phase 2 of 5 · Implementation',
    progress: 28,
    storesLive: 3,
    storesTotal: 14,
    storesInFitOut: 2,
    totalValue: 45_900_000_000,    // UGX 45.9Bn
    committedCapex: 17_800_000_000,// UGX 17.8Bn (39%)
    forecastAtCompletion: 45_600_000_000, // -0.7% vs baseline
    currency: 'UGX',
    phases: [
      { label: 'Phase 1 · Design',                            progress: 100 },
      { label: 'Phase 2 · Implementation · 5 stores',        progress: 58 },
      { label: 'Phase 3 · Rollout · 9 stores',               progress: 12 },
      { label: 'Phase 4 · Operations handover',              progress: 0 },
    ],
    openApproval: {
      label: 'BOQ pack v3',
      sub: 'Naqaa-08 Riyadh · Naqaa-09 Jeddah',
      value: 6_810_000_000,
      dueDate: dateTs(2026, 4, 16),
    },
    procurement: {
      openPOs: 22,
      pendingRFQs: 6,
      costVariancePct: -0.8,
      vettedVendors: 22,
    },
  };

  const projectData = {
    code: NAQAA_PROJECT_CODE,
    name: NAQAA_PROJECT_NAME,
    description: 'Retail rollout programme — 14 stores across KSA + UAE for Naqaa Holding.',
    customerId: CUSTOMER_ID,
    customerName: CUSTOMER_NAME,
    subsidiaryId: 'advisory',
    status: 'active',
    startDate: dateTs(2026, 0, 4),
    baselineDate: dateTs(2026, 0, 4),
    dueDate: dateTs(2026, 11, 31),
    physicalProgress: programme.progress,
    programme,
    programmeStores: stores,
    clientPortalUserIds: clientUid ? [clientUid] : [],
    seedTag: SEED_TAG,
    updatedAt: Timestamp.now(),
    updatedBy: 'seed-script',
  };

  let projectRef;
  if (!projects.empty) {
    projectRef = projects.docs[0].ref;
    console.log(`  ~ project ${NAQAA_PROJECT_CODE} exists (${projectRef.id}) — ${DRY_RUN ? 'would update' : 'updating'}`);
    if (!DRY_RUN) await projectRef.set(projectData, { merge: true });
  } else if (!DRY_RUN) {
    projectRef = db.collection('designProjects').doc();
    await projectRef.set({
      ...projectData,
      id: projectRef.id,
      createdAt: Timestamp.now(),
      createdBy: 'seed-script',
    });
    console.log(`  + created project ${projectRef.id} (${NAQAA_PROJECT_CODE})`);
  } else {
    console.log(`  + would create project ${NAQAA_PROJECT_CODE}`);
  }
}

// ─── seed approvals: 1 design signoff + 1 change order, both awaiting client ───
async function seedApprovals(soRef, projectRef) {
  if (!soRef || !projectRef) return;

  // Re-use existing seed-tagged docs if present, so re-running the seed is idempotent.
  const existingSO = await db.collection('designSignOffs')
    .where('salesOrderId', '==', soRef.id)
    .where('seedTag', '==', SEED_TAG)
    .get();
  const existingCO = await db.collection('changeOrders')
    .where('salesOrderId', '==', soRef.id)
    .where('seedTag', '==', SEED_TAG)
    .get();

  // ── Design SignOff: SD-104 Rev C · Cashwrap joinery ────────────
  const signOffData = {
    subsidiaryId: SUBSIDIARY_ID,
    salesOrderId: soRef.id,
    designProjectId: projectRef.id,

    designVersion: 3,
    scopeVersion: 3,
    signOffNumber: 'SD-104 Rev C',

    title: 'Cashwrap joinery — Revision C',
    description: 'Veneer now runs vertically on front face per client direction. Cable tray detail updated to suit POS unit footprint. 4 sheets · 3 pins outstanding.',
    designDocuments: [
      { id: 'doc-1', fileName: 'SD-104_cashwrap_plan_RevC.pdf',     storagePath: 'gs://vela/sd-104/plan.pdf',     type: 'floor_plan',          description: 'Plan view' },
      { id: 'doc-2', fileName: 'SD-104_cashwrap_elevA_RevC.pdf',    storagePath: 'gs://vela/sd-104/elev-a.pdf',   type: 'elevation',           description: 'Elevation A (front face)' },
      { id: 'doc-3', fileName: 'SD-104_cashwrap_elevB_RevC.pdf',    storagePath: 'gs://vela/sd-104/elev-b.pdf',   type: 'elevation',           description: 'Elevation B (side)' },
      { id: 'doc-4', fileName: 'SD-104_cashwrap_section_RevC.pdf',  storagePath: 'gs://vela/sd-104/section.pdf',  type: 'specification_sheet', description: 'Section through till station' },
    ],
    itemsCovered: ['cashwrap-unit'],
    specificationsSnapshot: 'Walnut veneer, vertical grain, book-matched. Brushed bronze toe-kick. 1080 mm overall height.',

    status: 'sent_to_client',
    sentToClientAt: dateTs(2026, 5, 8),
    sentToClientVia: 'client_portal',

    clientApprovalMethod: 'portal_acceptance',
    expiresAt: dateTs(2026, 5, 18),
    isValid: true,

    disclaimerText: 'By approving this design, you confirm the specifications and authorise the fabrication.',
    termsAccepted: false,

    seedTag: SEED_TAG,
    createdAt: dateTs(2026, 5, 7),
    createdBy: 'seed-script',
  };

  let soOffRef;
  if (!existingSO.empty) {
    soOffRef = existingSO.docs[0].ref;
    console.log(`  ~ design signoff ${signOffData.signOffNumber} exists (${soOffRef.id}) — ${DRY_RUN ? 'would update' : 'updating'}`);
    if (!DRY_RUN) await soOffRef.set(signOffData, { merge: true });
  } else if (!DRY_RUN) {
    soOffRef = db.collection('designSignOffs').doc();
    await soOffRef.set({ ...signOffData, id: soOffRef.id });
    console.log(`  + created design signoff ${soOffRef.id} (${signOffData.signOffNumber})`);
  } else {
    console.log(`  + would create design signoff ${signOffData.signOffNumber}`);
  }

  // ── Additional drawings to populate the index page ─────────────
  const extraDrawings = [
    {
      tag: `${SEED_TAG}--sd-106`,
      number: 'SD-106 Rev A',
      title: 'Stone wall panel — Revision A',
      description: 'Calacatta wall panel layout for the back-of-house gallery. 2 sheets covering plan + elevation.',
      version: 1,
      status: 'sent_to_client',
      sentAt: dateTs(2026, 5, 12),
      expires: dateTs(2026, 5, 25),
      docs: [
        { id: 'sd106-1', fileName: 'SD-106_stone_wall_plan_RevA.pdf', storagePath: 'gs://vela/sd-106/plan.pdf',  type: 'floor_plan', description: 'Plan' },
        { id: 'sd106-2', fileName: 'SD-106_stone_wall_elev_RevA.pdf', storagePath: 'gs://vela/sd-106/elev.pdf',  type: 'elevation',  description: 'Elevation' },
      ],
    },
    {
      tag: `${SEED_TAG}--sd-099`,
      number: 'SD-099 Rev B',
      title: 'Storefront glazing — Revision B',
      description: 'Privacy film treatment, frame profile, and threshold detail for the boutique entrance.',
      version: 2,
      status: 'approved',
      sentAt: dateTs(2026, 5, 4),
      approvedAt: dateTs(2026, 5, 6),
      docs: [
        { id: 'sd099-1', fileName: 'SD-099_storefront_RevB.pdf', storagePath: 'gs://vela/sd-099/plan.pdf', type: 'floor_plan', description: 'Plan + section' },
      ],
    },
    {
      tag: `${SEED_TAG}--sd-097`,
      number: 'SD-097 Rev C',
      title: 'Reception desk — Revision C',
      description: 'Reception desk with integrated POS, sealed at Rev C ahead of fabrication.',
      version: 3,
      status: 'approved',
      sentAt: dateTs(2026, 4, 22),
      approvedAt: dateTs(2026, 4, 24),
      docs: [
        { id: 'sd097-1', fileName: 'SD-097_reception_RevC.pdf', storagePath: 'gs://vela/sd-097/plan.pdf', type: 'floor_plan', description: 'Plan' },
        { id: 'sd097-2', fileName: 'SD-097_reception_elev_RevC.pdf', storagePath: 'gs://vela/sd-097/elev.pdf', type: 'elevation', description: 'Elevation' },
      ],
    },
  ];

  for (const e of extraDrawings) {
    const exists = await db.collection('designSignOffs')
      .where('salesOrderId', '==', soRef.id)
      .where('seedTag', '==', e.tag)
      .get();

    const data = {
      subsidiaryId: SUBSIDIARY_ID,
      salesOrderId: soRef.id,
      designProjectId: projectRef.id,
      designVersion: e.version,
      scopeVersion: 3,
      signOffNumber: e.number,
      title: e.title,
      description: e.description,
      designDocuments: e.docs,
      itemsCovered: [],
      specificationsSnapshot: '',
      status: e.status,
      sentToClientAt: e.sentAt,
      sentToClientVia: 'client_portal',
      clientApprovalMethod: 'portal_acceptance',
      ...(e.approvedAt ? { clientApprovedAt: e.approvedAt, approvedByName: 'Selina Saleh', approvedByEmail: 'onzimai@dawin.group' } : {}),
      ...(e.expires ? { expiresAt: e.expires } : {}),
      isValid: true,
      disclaimerText: 'By approving this design, you confirm the specifications and authorise the fabrication.',
      termsAccepted: e.status === 'approved',
      seedTag: e.tag,
      createdAt: e.sentAt,
      createdBy: 'seed-script',
    };

    if (!exists.empty) {
      console.log(`  ~ design signoff ${e.number} exists (${exists.docs[0].ref.id}) — ${DRY_RUN ? 'would update' : 'updating'}`);
      if (!DRY_RUN) await exists.docs[0].ref.set(data, { merge: true });
    } else if (!DRY_RUN) {
      const ref = db.collection('designSignOffs').doc();
      await ref.set({ ...data, id: ref.id });
      console.log(`  + created design signoff ${ref.id} (${e.number})`);
    } else {
      console.log(`  + would create design signoff ${e.number}`);
    }
  }

  // ── Change Order: Q-019 v2 · Stone variation ──────────────────
  const coData = {
    subsidiaryId: SUBSIDIARY_ID,
    salesOrderId: soRef.id,
    changeOrderNumber: 'Q-019 v2',

    type: 'specification_change',
    title: 'Stone variation — Calacatta upgrade',
    description: 'Calacatta Borghini slab upgraded to 20 mm thickness with book-matched layout. Locks the stone install slot in week 15.',
    reason: 'Client direction on 7 May call — finer veining and heavier visual weight at counter face. Revised after slab thickness review.',
    requestedBy: 'client',

    negotiatedPriceAdjustment: 0,
    priceImpact: 42_800_000,
    previousOrderTotal: 2_797_200_000,
    newOrderTotal: 2_840_000_000,

    itemsAdded: [
      {
        id: 'li-co19-1', lineNumber: 1, description: 'Calacatta Borghini slab 20mm',
        specification: 'Italy · book-matched · sealed',
        quantity: 18.4, unit: 'm²', unitPrice: 5_240_000, totalPrice: 96_416_000,
        category: 'materials', fromQuoteVersion: 2, isActive: true,
      },
      {
        id: 'li-co19-2', lineNumber: 2, description: 'Edge polishing & water-jet cuts',
        specification: 'Workshop · 4 days',
        quantity: 1, unit: 'lot', unitPrice: 28_300_000, totalPrice: 28_300_000,
        category: 'fabrication', fromQuoteVersion: 2, isActive: true,
      },
      {
        id: 'li-co19-3', lineNumber: 3, description: 'Templating & install on site',
        specification: '3 days · 2 fitters',
        quantity: 1, unit: 'lot', unitPrice: 41_200_000, totalPrice: 41_200_000,
        category: 'installation', fromQuoteVersion: 2, isActive: true,
      },
      {
        id: 'li-co19-4', lineNumber: 4, description: 'Sealing & maintenance kit',
        specification: '6-month seal warranty',
        quantity: 1, unit: 'lot', unitPrice: 18_350_000, totalPrice: 18_350_000,
        category: 'finishing', fromQuoteVersion: 2, isActive: true,
      },
    ],
    itemsRemoved: [],
    itemsModified: [],

    deliveryDateImpact: 0,

    status: 'pending_client',
    internalApprovalRequired: true,
    internalApprovedBy: 'D. Wahab',
    internalApprovedAt: dateTs(2026, 5, 9),
    clientApprovalRequired: true,

    submittedForInternalAt: dateTs(2026, 5, 8),
    submittedForInternalBy: 'D. Wahab',
    submittedToClientAt: dateTs(2026, 5, 9),
    submittedToClientBy: 'D. Wahab',
    sentToClientVia: ['client_portal', 'email'],

    isPostScopeFreeze: true,
    scopeVersionBefore: 3,
    scopeVersionAfter: 3,

    seedTag: SEED_TAG,
    createdAt: dateTs(2026, 5, 7),
    updatedAt: Timestamp.now(),
    createdBy: 'seed-script',
  };

  let coRef;
  if (!existingCO.empty) {
    coRef = existingCO.docs[0].ref;
    console.log(`  ~ change order ${coData.changeOrderNumber} exists (${coRef.id}) — ${DRY_RUN ? 'would update' : 'updating'}`);
    if (!DRY_RUN) await coRef.set(coData, { merge: true });
  } else if (!DRY_RUN) {
    coRef = db.collection('changeOrders').doc();
    await coRef.set({ ...coData, id: coRef.id });
    console.log(`  + created change order ${coRef.id} (${coData.changeOrderNumber})`);
  } else {
    console.log(`  + would create change order ${coData.changeOrderNumber}`);
  }
}

// ─── seed drawing pins: 3 sample pins on SD-104 Rev C ───
async function seedDrawingPins() {
  // Locate the signoff doc by seedTag so we don't have to thread its
  // ref through the call chain.
  const signOffSnap = await db.collection('designSignOffs')
    .where('seedTag', '==', SEED_TAG)
    .where('signOffNumber', '==', 'SD-104 Rev C')
    .limit(1)
    .get();
  if (signOffSnap.empty) {
    console.log(`  ! no SD-104 signoff found — skipping drawing-pin seed`);
    return;
  }
  const signOffId = signOffSnap.docs[0].id;

  // Wipe any existing seeded pins so re-runs are deterministic.
  const existing = await db.collection('drawingPins')
    .where('signOffId', '==', signOffId)
    .where('seedTag', '==', SEED_TAG)
    .get();
  if (!existing.empty) {
    if (!DRY_RUN) {
      const batch = db.batch();
      existing.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    console.log(`  ~ cleared ${existing.size} existing seeded pins on SD-104`);
  }

  const wahabComment = (body, dayOffset) => ({
    id: 'c-wahab-' + Math.random().toString(36).slice(2, 8),
    body,
    at: dateTs(2026, 4, 8 + dayOffset),
    by: 'staff-wahab',
    byName: 'D. Wahab',
    isClient: false,
  });
  const clientComment = (body, dayOffset) => ({
    id: 'c-client-' + Math.random().toString(36).slice(2, 8),
    body,
    at: dateTs(2026, 4, 8 + dayOffset),
    by: 'client-onzimai',
    byName: 'Selina Saleh',
    isClient: true,
  });

  const pins = [
    {
      signOffId,
      x: 32, y: 38, n: 1,
      status: 'open',
      comments: [
        wahabComment('Grain match between adjacent panels — book-matched per spec.', 1),
        clientComment('Looks good. Confirm sample matches photo from 4 May.', 2),
      ],
      createdAt: dateTs(2026, 4, 9),
      createdBy: 'staff-wahab',
      createdByName: 'D. Wahab',
      createdByIsClient: false,
    },
    {
      signOffId,
      x: 56, y: 55, n: 2,
      status: 'open',
      comments: [
        clientComment('Confirm POS cable cut-out dimensions — POS unit is now 90mm wider than v1.', 0),
        wahabComment('Will widen by 95mm on Rev D. Sketching now.', 1),
      ],
      createdAt: dateTs(2026, 4, 8),
      createdBy: 'client-onzimai',
      createdByName: 'Selina Saleh',
      createdByIsClient: true,
    },
    {
      signOffId,
      x: 72, y: 78, n: 3,
      status: 'resolved',
      comments: [
        { id: 'c-othmani-1', body: 'Plinth height — confirm 100mm vs 80mm.', at: dateTs(2026, 4, 7), by: 'staff-othmani', byName: 'M. Othmani', isClient: false },
        clientComment('100mm matches the FF&E plinth across the rest of the store. Approve.', 1),
      ],
      createdAt: dateTs(2026, 4, 7),
      createdBy: 'staff-othmani',
      createdByName: 'M. Othmani',
      createdByIsClient: false,
      resolvedAt: dateTs(2026, 4, 9),
      resolvedBy: 'client-onzimai',
      resolvedByName: 'Selina Saleh',
    },
  ];

  for (const p of pins) {
    const ref = db.collection('drawingPins').doc();
    const data = { ...p, seedTag: SEED_TAG };
    if (DRY_RUN) {
      console.log(`  + would create drawing pin #${p.n} on SD-104`);
    } else {
      await ref.set(data);
    }
  }
  if (!DRY_RUN) console.log(`  + wrote ${pins.length} drawing pins to drawingPins for SD-104`);
}

(async () => {
  try {
    console.log('\n  Vela Boutique portal seed');
    console.log('  ────────────────────────────');
    if (DRY_RUN) console.log('  DRY RUN — no documents will be written\n');

    const clientUid = await resolveClientUid();
    if (clientUid) {
      console.log(`  client portal access: ${clientUid}`);
    } else {
      console.log(`  client portal access: none (re-run with --client-uid or --client-email later)`);
    }

    await ensureCustomer();
    const projectRef = await seedProject(clientUid);
    const soRef = await seedSalesOrder(projectRef, clientUid);
    await seedApprovals(soRef, projectRef);
    await seedQuotations(soRef, projectRef, clientUid);
    await seedMaterials(projectRef);
    await seedAdvisoryProgramme(clientUid);
    await seedDrawingPins();

    console.log('\n  ✓ done\n');
    process.exit(0);
  } catch (err) {
    console.error('\n  ✗ seed failed:', err);
    process.exit(1);
  }
})();
