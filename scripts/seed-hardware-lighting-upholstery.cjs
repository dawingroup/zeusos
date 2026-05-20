/**
 * Seed Hardware, Lighting & Upholstery Materials
 *
 * Enriches existing inventoryItems with catalog data from the Hardware,
 * Lighting & Upholstery libraries, and creates new Family/SKU hierarchies
 * for unmatched items.
 *
 * Run with:
 *   node scripts/seed-hardware-lighting-upholstery.cjs
 *   node scripts/seed-hardware-lighting-upholstery.cjs --dry-run
 *   node scripts/seed-hardware-lighting-upholstery.cjs --force
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

// ─── CLI Flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

if (DRY_RUN) console.log('\n  DRY RUN — no documents will be written\n');
if (FORCE) console.log('  FORCE — will overwrite existing field values\n');

// ─── Constants ───────────────────────────────────────────────────────────────

const INVENTORY_COLLECTION = 'inventoryItems';
const BATCH_LIMIT = 499;
const SEED_TAG = 'hardware-lighting-upholstery-seed';

// ─── Category Mapping ────────────────────────────────────────────────────────

const CATEGORY_MAP = {
  CABINET_HARDWARE: 'hardware',
  CABINET_LIGHTING: 'hardware',
  UPHOLSTERY: 'other',
};

const UOM_MAP = {
  piece: 'pcs',
  pair: 'pair',
  set: 'set',
  roll: 'roll',
  linear_m: 'lm',
  linear_ft: 'lft',
  sq_ft: 'sqft',
  cone: 'ea',
  box_or_roll: 'ea',
  length: 'pcs',
  sheet: 'sheet',
  box: 'box',
};

const VARIANT_ATTR_DEFS = {
  CABINET_HARDWARE: ['quality_tier', 'brand', 'model'],
  CABINET_LIGHTING: ['quality_tier', 'brand', 'model'],
  UPHOLSTERY: ['quality_tier', 'size_label'],
};

// ─── Seed Data ───────────────────────────────────────────────────────────────

const SEED_DATA = [

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_HARDWARE — HINGES
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'HNG-CONC-110-FO',
    name: 'Concealed Hinge — 110° Full Overlay, Soft-Close',
    description: 'Standard cabinet door hinge. Full overlay (door covers full side panel). 35mm cup, soft-close damped.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy DTC-GTV', quality_tier: 'Economy', brand: 'DTC-GTV', model: null, est_price_aed: null },
      { size_label: 'Standard STARKE SH-H8152021', quality_tier: 'Standard', brand: 'STARKE', model: 'SH-H8152021', est_price_aed: 5.25 },
      { size_label: 'Premium SALICE C7P6AE9', quality_tier: 'Premium', brand: 'SALICE', model: 'C7P6AE9', est_price_aed: 15.50 },
    ],
  },
  {
    sku_prefix: 'HNG-CONC-110-HO',
    name: 'Concealed Hinge — 110° Half Overlay, Soft-Close',
    description: 'Half overlay concealed hinge. Door covers half the side panel. 35mm cup, soft-close damped.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy DTC-GTV', quality_tier: 'Economy', brand: 'DTC-GTV', model: null, est_price_aed: null },
      { size_label: 'Standard STARKE SH-H8052001', quality_tier: 'Standard', brand: 'STARKE', model: 'SH-H8052001', est_price_aed: 3.75 },
      { size_label: 'Premium SALICE Silentia+ 700 HO', quality_tier: 'Premium', brand: 'SALICE', model: 'Silentia+ 700 HO', est_price_aed: 15.50 },
    ],
  },
  {
    sku_prefix: 'HNG-CONC-110-IN',
    name: 'Concealed Hinge — 110° Inset, Soft-Close',
    description: 'Inset concealed hinge. Door sits flush within frame. 35mm cup, soft-close damped.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy DTC-GTV', quality_tier: 'Economy', brand: 'DTC-GTV', model: null, est_price_aed: null },
      { size_label: 'Standard STARKE', quality_tier: 'Standard', brand: 'STARKE', model: null, est_price_aed: 5.25 },
      { size_label: 'Premium SALICE Silentia+ 700 IN', quality_tier: 'Premium', brand: 'SALICE', model: 'Silentia+ 700 IN', est_price_aed: 15.50 },
    ],
  },
  {
    sku_prefix: 'HNG-CONC-155-FO',
    name: 'Concealed Hinge — 155° Full Overlay, Soft-Close',
    description: 'Wide-opening 155° concealed hinge. Full overlay, soft-close damped. For pantry and wide-swing doors.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Standard STARKE SH-H8072021', quality_tier: 'Standard', brand: 'STARKE', model: 'SH-H8072021', est_price_aed: 10.00 },
      { size_label: 'Premium SALICE C2PKAE9-I', quality_tier: 'Premium', brand: 'SALICE', model: 'C2PKAE9-I', est_price_aed: 40.50 },
    ],
  },
  {
    sku_prefix: 'HNG-CONC-45-FO',
    name: 'Concealed Hinge — 45° Corner Cabinet, Soft-Close',
    description: '45° corner cabinet hinge. For angled corner door applications. Soft-close damped.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Premium SALICE Silentia+ 700 45°', quality_tier: 'Premium', brand: 'SALICE', model: 'Silentia+ 700 45°', est_price_aed: 15.50 },
    ],
  },
  {
    sku_prefix: 'HNG-CONC-90-FO',
    name: 'Concealed Hinge — 90° Blind Corner, Soft-Close',
    description: '90° blind corner cabinet hinge. Soft-close damped.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Standard STARKE SH-H8091010', quality_tier: 'Standard', brand: 'STARKE', model: 'SH-H8091010', est_price_aed: 5.00 },
    ],
  },
  {
    sku_prefix: 'HNG-CONC-PTO',
    name: 'Concealed Hinge — Push-to-Open (Handle-less)',
    description: 'Push-to-open concealed hinge for handle-less cabinet doors. Soft-close damped.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Premium SALICE Silentia+ 700 PTO', quality_tier: 'Premium', brand: 'SALICE', model: 'Silentia+ 700 PTO', est_price_aed: 18.00 },
    ],
  },
  {
    sku_prefix: 'HNG-CONC-HIDDEN',
    name: 'Concealed Hinge — Fully Hidden (No Visible Cup)',
    description: 'Fully hidden concealed hinge with no visible cup. Premium aesthetic for high-end cabinetry.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Premium SALICE Conecta nickel', quality_tier: 'Premium', brand: 'SALICE', model: 'Conecta Series nickel', est_price_aed: 161.50 },
      { size_label: 'Premium SALICE Conecta titanium', quality_tier: 'Premium', brand: 'SALICE', model: 'Conecta Series titanium', est_price_aed: 161.50 },
    ],
  },
  {
    sku_prefix: 'HNG-CONC-MINI',
    name: 'Concealed Hinge — Compact/Mini Cup (Thin Doors)',
    description: 'Compact/mini cup concealed hinge for thin door panels.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'pair',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Premium SALICE Air Series', quality_tier: 'Premium', brand: 'SALICE', model: 'Air Series', est_price_aed: 204.50 },
    ],
  },
  {
    sku_prefix: 'HNG-PIVOT',
    name: 'Pivot Hinge — Decorative/Glass Door',
    description: 'Pivot hinge for decorative and glass door applications.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'pair',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Standard STARKE SH-H8110001 black', quality_tier: 'Standard', brand: 'STARKE', model: 'SH-H8110001 black', est_price_aed: 82.25 },
    ],
  },
  {
    sku_prefix: 'HNG-ALUM-FRAME',
    name: 'Aluminium Frame Hinge',
    description: 'Hinge for aluminium-framed cabinet doors.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Standard STARKE SH-H8022501', quality_tier: 'Standard', brand: 'STARKE', model: 'SH-H8022501', est_price_aed: 3.75 },
    ],
  },
  {
    sku_prefix: 'HNG-PLATE',
    name: 'Hinge Mounting Plate',
    description: 'Mounting plate for concealed hinges. Various types including inline and height-adjustable.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HINGES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Standard STARKE inline', quality_tier: 'Standard', brand: 'STARKE', model: 'inline', est_price_aed: 2.00 },
      { size_label: 'Premium SALICE B2V3H29-I inline', quality_tier: 'Premium', brand: 'SALICE', model: 'B2V3H29-I inline', est_price_aed: 4.00 },
      { size_label: 'Premium SALICE B2V3H39-I height_adj', quality_tier: 'Premium', brand: 'SALICE', model: 'B2V3H39-I height_adjustable', est_price_aed: 5.50 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_HARDWARE — DRAWER_SLIDES
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'SLD-UNDER-SC',
    name: 'Undermount Drawer Slide — Full Extension, Soft-Close',
    description: 'Undermount full-extension drawer slide with soft-close mechanism.',
    category: 'CABINET_HARDWARE',
    subcategory: 'DRAWER_SLIDES',
    uom: 'pair',
    suppliers: [],
    supplier_locations: [],
    variants: [
      // Standard / STARKE / Concelio
      { size_label: '250mm', quality_tier: 'Standard', brand: 'STARKE', model: 'Concelio', est_price_aed: 34.00 },
      { size_label: '300mm', quality_tier: 'Standard', brand: 'STARKE', model: 'Concelio', est_price_aed: 34.00 },
      { size_label: '350mm', quality_tier: 'Standard', brand: 'STARKE', model: 'Concelio', est_price_aed: 36.00 },
      { size_label: '400mm', quality_tier: 'Standard', brand: 'STARKE', model: 'Concelio', est_price_aed: 38.00 },
      { size_label: '450mm', quality_tier: 'Standard', brand: 'STARKE', model: 'Concelio', est_price_aed: 40.00 },
      { size_label: '500mm', quality_tier: 'Standard', brand: 'STARKE', model: 'Concelio', est_price_aed: 42.00 },
      { size_label: '550mm', quality_tier: 'Standard', brand: 'STARKE', model: 'Concelio', est_price_aed: 44.00 },
      // Premium / SALICE / Futura Smove
      { size_label: '300mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Smove', est_price_aed: 74.75 },
      { size_label: '350mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Smove', est_price_aed: 76.75 },
      { size_label: '400mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Smove', est_price_aed: 78.75 },
      { size_label: '450mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Smove', est_price_aed: 80.75 },
      { size_label: '500mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Smove', est_price_aed: 82.75 },
      { size_label: '550mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Smove', est_price_aed: 85.00 },
    ],
  },
  {
    sku_prefix: 'SLD-UNDER-PTO',
    name: 'Undermount Drawer Slide — Full Extension, Push-to-Open',
    description: 'Undermount full-extension drawer slide with push-to-open mechanism for handle-less drawers.',
    category: 'CABINET_HARDWARE',
    subcategory: 'DRAWER_SLIDES',
    uom: 'pair',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '300mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Push', est_price_aed: 70.00 },
      { size_label: '400mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Push', est_price_aed: 74.00 },
      { size_label: '500mm', quality_tier: 'Premium', brand: 'SALICE', model: 'Futura Push', est_price_aed: 78.00 },
    ],
  },
  {
    sku_prefix: 'SLD-BB-FULL',
    name: 'Ball Bearing Side-Mount Slide — Full Extension',
    description: 'Ball bearing side-mount full-extension drawer slide.',
    category: 'CABINET_HARDWARE',
    subcategory: 'DRAWER_SLIDES',
    uom: 'pair',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '300mm 25kg', quality_tier: 'Economy', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: '350mm 25kg', quality_tier: 'Economy', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: '400mm 35kg', quality_tier: 'Economy', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: '450mm 35kg', quality_tier: 'Economy', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: '500mm 45kg', quality_tier: 'Standard', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: '550mm 45kg', quality_tier: 'Standard', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: '600mm 45kg', quality_tier: 'Standard', brand: 'Generic', model: null, est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_HARDWARE — DRAWER_BOX_SYSTEMS
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'DRW-BOX-STD',
    name: 'Metal-Sided Drawer Box — Standard Height',
    description: 'Standard height metal-sided drawer box system.',
    category: 'CABINET_HARDWARE',
    subcategory: 'DRAWER_BOX_SYSTEMS',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '300mm depth', quality_tier: 'Standard', brand: 'STARKE', model: 'Vario', est_price_aed: 64.25 },
      { size_label: '400mm depth', quality_tier: 'Standard', brand: 'STARKE', model: 'Vario', est_price_aed: 70.00 },
      { size_label: '500mm depth', quality_tier: 'Standard', brand: 'STARKE', model: 'Vario', est_price_aed: 76.00 },
    ],
  },
  {
    sku_prefix: 'DRW-BOX-SLIM',
    name: 'Metal-Sided Drawer Box — Slim/Low-Cut',
    description: 'Slim/low-cut metal-sided drawer box system.',
    category: 'CABINET_HARDWARE',
    subcategory: 'DRAWER_BOX_SYSTEMS',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '300mm depth', quality_tier: 'Standard', brand: 'STARKE', model: 'Jane Low-Cut', est_price_aed: 78.25 },
      { size_label: '400mm depth', quality_tier: 'Standard', brand: 'STARKE', model: 'Jane Low-Cut', est_price_aed: 84.00 },
      { size_label: '500mm depth', quality_tier: 'Standard', brand: 'STARKE', model: 'Jane Low-Cut', est_price_aed: 90.00 },
    ],
  },
  {
    sku_prefix: 'DRW-BOX-GLASS',
    name: 'Metal-Sided Drawer Box — Glass Panel + LED',
    description: 'Premium metal-sided drawer box with glass side panel and integrated LED lighting.',
    category: 'CABINET_HARDWARE',
    subcategory: 'DRAWER_BOX_SYSTEMS',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '400mm depth', quality_tier: 'Premium', brand: 'STARKE', model: 'Jane High-Cut Glass', est_price_aed: 120.50 },
      { size_label: '500mm depth', quality_tier: 'Premium', brand: 'STARKE', model: 'Jane High-Cut Glass', est_price_aed: 130.00 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_HARDWARE — LIFT_SYSTEMS
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'LIFT-FLAP-SC',
    name: 'Flap Door Lift Stay — Soft-Close',
    description: 'Flap door lift stay with soft-close mechanism for wall cabinets.',
    category: 'CABINET_HARDWARE',
    subcategory: 'LIFT_SYSTEMS',
    uom: 'pair',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '2.5-5kg door', quality_tier: 'Standard', brand: 'STARKE', model: 'Astra', est_price_aed: 101.25 },
      { size_label: '2.5-8kg door', quality_tier: 'Premium', brand: 'SALICE', model: 'Evolift Flap', est_price_aed: 121.00 },
    ],
  },
  {
    sku_prefix: 'LIFT-BIFOLD',
    name: 'Bi-Fold Lift System',
    description: 'Bi-fold lift system for tall wall cabinet doors.',
    category: 'CABINET_HARDWARE',
    subcategory: 'LIFT_SYSTEMS',
    uom: 'pair',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '691-750mm door height', quality_tier: 'Premium', brand: 'SALICE', model: 'Evolift Bi-fold', est_price_aed: 152.00 },
    ],
  },
  {
    sku_prefix: 'LIFT-COMPACT',
    name: 'Compact Lift System — Heavy/Wide Doors',
    description: 'Compact lift system for heavy and wide cabinet doors.',
    category: 'CABINET_HARDWARE',
    subcategory: 'LIFT_SYSTEMS',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Complete set', quality_tier: 'Premium', brand: 'SALICE', model: 'Wind', est_price_aed: 461.75 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_HARDWARE — SHELF_SUPPORTS
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'SHELF-PIN',
    name: 'Shelf Support Pin — 5mm',
    description: '5mm shelf support pin for adjustable cabinet shelves.',
    category: 'CABINET_HARDWARE',
    subcategory: 'SHELF_SUPPORTS',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Metal only', quality_tier: 'Economy', brand: 'Schamfer-Generic', model: 'SH-A-2050', est_price_aed: 0.25 },
      { size_label: 'Metal + plastic cap', quality_tier: 'Standard', brand: 'Schamfer-Generic', model: 'SH-A-6050', est_price_aed: 0.50 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_HARDWARE — CATCHES_AND_DAMPERS
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'PTO-CATCH',
    name: 'Push-to-Open Catch (Magnetic)',
    description: 'Magnetic push-to-open catch for handle-less cabinet doors.',
    category: 'CABINET_HARDWARE',
    subcategory: 'CATCHES_AND_DAMPERS',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Adhesive mount', quality_tier: 'Standard', brand: 'SALICE', model: 'DP38XX91', est_price_aed: 3.00 },
      { size_label: 'Screw mount adjustable', quality_tier: 'Premium', brand: 'SALICE', model: 'DP39XXG', est_price_aed: 12.50 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_HARDWARE — STORAGE_ORGANIZATION
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'STOR-WASTE-PULL',
    name: 'Pull-Out Waste Bin',
    description: 'Pull-out waste bin system for kitchen cabinets.',
    category: 'CABINET_HARDWARE',
    subcategory: 'STORAGE_ORGANIZATION',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '2x30L (450-600mm cab)', quality_tier: 'Standard', brand: 'STARKE', model: null, est_price_aed: null },
      { size_label: 'Swing-out under-sink', quality_tier: 'Economy', brand: 'STARKE', model: null, est_price_aed: 114.75 },
    ],
  },
  {
    sku_prefix: 'STOR-MAGIC-CORNER',
    name: 'Magic Corner Pull-Out',
    description: 'Magic corner pull-out system for corner cabinets.',
    category: 'CABINET_HARDWARE',
    subcategory: 'STORAGE_ORGANIZATION',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '4-box set', quality_tier: 'Premium', brand: 'STARKE', model: 'Prisma', est_price_aed: 843.25 },
    ],
  },
  {
    sku_prefix: 'STOR-TALL-PANTRY',
    name: 'Pull-Out Tall Pantry Unit',
    description: 'Pull-out tall pantry unit for tall kitchen cabinets.',
    category: 'CABINET_HARDWARE',
    subcategory: 'STORAGE_ORGANIZATION',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Mini pantry', quality_tier: 'Standard', brand: 'STARKE', model: 'Melora', est_price_aed: 596.50 },
      { size_label: '3-tier + drawer', quality_tier: 'Premium', brand: 'STARKE', model: 'Melora', est_price_aed: 904.50 },
      { size_label: 'Rotatable full', quality_tier: 'Premium', brand: 'STARKE', model: 'Melora', est_price_aed: 2535.75 },
    ],
  },
  {
    sku_prefix: 'STOR-SHOE-RACK',
    name: 'Wardrobe Shoe Rack — 360° Rotatable',
    description: '360° rotatable wardrobe shoe rack.',
    category: 'CABINET_HARDWARE',
    subcategory: 'STORAGE_ORGANIZATION',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Full rotation', quality_tier: 'Premium', brand: 'STARKE', model: 'Maverick', est_price_aed: 1380.00 },
    ],
  },
  {
    sku_prefix: 'STOR-TROUSER-RACK',
    name: 'Pull-Out Trouser Rack — Soft-Close',
    description: 'Soft-close pull-out trouser rack for wardrobes.',
    category: 'CABINET_HARDWARE',
    subcategory: 'STORAGE_ORGANIZATION',
    uom: 'set',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Standard', quality_tier: 'Premium', brand: 'STARKE', model: 'SH-C6100490', est_price_aed: 330.00 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_HARDWARE — HANDLES
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'HDL-GOLA',
    name: 'Gola Handle Profile (Integrated/Handle-less)',
    description: 'Integrated gola handle profile for handle-less kitchen cabinets.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HANDLES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'L-Type Horizontal', quality_tier: 'Standard', brand: 'STARKE', model: 'L-Type Horizontal', est_price_aed: 87.25 },
      { size_label: 'C-Type Horizontal', quality_tier: 'Standard', brand: 'STARKE', model: 'C-Type Horizontal', est_price_aed: 95.75 },
      { size_label: 'Single Door Vertical', quality_tier: 'Standard', brand: 'STARKE', model: 'Single Door Vertical', est_price_aed: 109.75 },
      { size_label: 'Double Door Vertical', quality_tier: 'Standard', brand: 'STARKE', model: 'Double Door Vertical', est_price_aed: 127.25 },
    ],
  },
  {
    sku_prefix: 'HDL-BAR',
    name: 'Bar Handle — Round or Square Profile',
    description: 'Bar handle with round or square profile for cabinets and drawers.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HANDLES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'C/C 96mm', quality_tier: 'Economy', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: 'C/C 128mm', quality_tier: 'Economy', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: 'C/C 160mm', quality_tier: 'Standard', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: 'C/C 192mm', quality_tier: 'Standard', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: 'C/C 256mm', quality_tier: 'Standard', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: 'C/C 320mm', quality_tier: 'Premium', brand: 'Generic', model: null, est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'HDL-KNOB',
    name: 'Cabinet Knob',
    description: 'Round cabinet knob for doors and drawers.',
    category: 'CABINET_HARDWARE',
    subcategory: 'HANDLES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '30mm round', quality_tier: 'Economy', brand: 'Generic', model: null, est_price_aed: null },
      { size_label: '35mm round', quality_tier: 'Standard', brand: 'Generic', model: null, est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_LIGHTING — LED_PROFILES
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'LED-PROF-SURFACE',
    name: 'LED Profile — Surface Mount',
    description: 'Surface mount LED aluminium profile for under-cabinet and display lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_PROFILES',
    uom: 'length',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'LP STAR 15x6mm slim', quality_tier: 'Economy', brand: 'LP', model: 'STAR 15x6mm slim', est_price_aed: null },
      { size_label: 'LP STAR 17x8mm standard', quality_tier: 'Economy', brand: 'LP', model: 'STAR 17x8mm standard', est_price_aed: null },
      { size_label: 'LP STAR 23x10mm wide', quality_tier: 'Economy', brand: 'LP', model: 'STAR 23x10mm wide', est_price_aed: null },
      { size_label: 'LP STAR 30x10mm extra-wide', quality_tier: 'Economy', brand: 'LP', model: 'STAR 30x10mm extra-wide', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-PROF-RECESS',
    name: 'LED Profile — Recessed/Flush Mount',
    description: 'Recessed/flush mount LED aluminium profile for integrated cabinet lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_PROFILES',
    uom: 'length',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'LP STAR 23x8mm std recess', quality_tier: 'Economy', brand: 'LP', model: 'STAR 23x8mm std recess', est_price_aed: null },
      { size_label: 'LP STAR 30x10mm wide recess', quality_tier: 'Economy', brand: 'LP', model: 'STAR 30x10mm wide recess', est_price_aed: null },
      { size_label: 'LP STAR 55x9mm ultra-wide', quality_tier: 'Economy', brand: 'LP', model: 'STAR 55x9mm ultra-wide', est_price_aed: null },
      { size_label: 'LP STAR 12x8mm narrow deep', quality_tier: 'Economy', brand: 'LP', model: 'STAR 12x8mm narrow deep', est_price_aed: null },
      { size_label: 'LP STAR trimless plaster-in', quality_tier: 'Standard', brand: 'LP', model: 'STAR trimless plaster-in', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-PROF-CORNER',
    name: 'LED Profile — 45° Corner Mount',
    description: '45° corner mount LED aluminium profile for cabinet edge lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_PROFILES',
    uom: 'length',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'LP STAR 16x16mm V-shape', quality_tier: 'Economy', brand: 'LP', model: 'STAR 16x16mm V-shape', est_price_aed: null },
      { size_label: 'LP STAR 18x18mm large V', quality_tier: 'Economy', brand: 'LP', model: 'STAR 18x18mm large V', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-PROF-CABINET',
    name: 'LED Profile — Wardrobe/Cabinet Specific',
    description: 'LED aluminium profile designed specifically for wardrobe and cabinet interiors.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_PROFILES',
    uom: 'length',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'LP STAR wardrobe rail combo', quality_tier: 'Standard', brand: 'LP', model: 'STAR wardrobe rail combo', est_price_aed: null },
      { size_label: 'LP STAR shelf-edge clip-on', quality_tier: 'Standard', brand: 'LP', model: 'STAR shelf-edge clip-on', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-PROF-PENDANT',
    name: 'LED Profile — Pendant/Suspended',
    description: 'Pendant/suspended LED aluminium profile for hanging cabinet and display lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_PROFILES',
    uom: 'length',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'LP STAR 35mm round pendant', quality_tier: 'Standard', brand: 'LP', model: 'STAR 35mm round pendant', est_price_aed: null },
      { size_label: 'LP STAR 60mm round pendant', quality_tier: 'Standard', brand: 'LP', model: 'STAR 60mm round pendant', est_price_aed: null },
      { size_label: 'LP STAR 50x75mm rect pendant', quality_tier: 'Standard', brand: 'LP', model: 'STAR 50x75mm rect pendant', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-PROF-FLEX',
    name: 'LED Profile — Flexible/Bendable',
    description: 'Flexible/bendable LED profile for curved cabinet lighting applications.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_PROFILES',
    uom: 'length',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'LP STAR 18mm flex silicone', quality_tier: 'Standard', brand: 'LP', model: 'STAR 18mm flex silicone', est_price_aed: null },
      { size_label: 'LP STAR 12mm neon flex', quality_tier: 'Standard', brand: 'LP', model: 'STAR 12mm neon flex', est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_LIGHTING — LED_STRIPS
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'LED-STRIP-2835',
    name: 'LED Strip — 2835 SMD (General Cabinet Lighting)',
    description: '2835 SMD LED strip for general cabinet and under-cabinet lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_STRIPS',
    uom: 'roll',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '60LED/m 4.8W 3000K', quality_tier: 'Economy', brand: 'Generic', model: '60LED/m 4.8W 3000K', est_price_aed: null },
      { size_label: '120LED/m 9.6W 3000K', quality_tier: 'Standard', brand: 'Generic', model: '120LED/m 9.6W 3000K', est_price_aed: null },
      { size_label: '120LED/m 9.6W 4000K', quality_tier: 'Standard', brand: 'Generic', model: '120LED/m 9.6W 4000K', est_price_aed: null },
      { size_label: '120LED/m 9.6W 6000K', quality_tier: 'Standard', brand: 'Generic', model: '120LED/m 9.6W 6000K', est_price_aed: null },
      { size_label: '240LED/m 19.2W 3000K', quality_tier: 'Premium', brand: 'Generic', model: '240LED/m 19.2W 3000K', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-STRIP-COB',
    name: 'LED Strip — COB (Dot-Free, Premium Cabinet Lighting)',
    description: 'COB LED strip for premium dot-free cabinet lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_STRIPS',
    uom: 'roll',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'COB 320LED/m 10W 3000K', quality_tier: 'Premium', brand: 'Generic', model: 'COB 320LED/m 10W 3000K', est_price_aed: null },
      { size_label: 'COB 512LED/m 16W 3000K', quality_tier: 'Premium', brand: 'Generic', model: 'COB 512LED/m 16W 3000K', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-STRIP-5050',
    name: 'LED Strip — 5050 SMD (Accent/RGB)',
    description: '5050 SMD LED strip for accent and RGB cabinet lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_STRIPS',
    uom: 'roll',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '30LED/m 7.2W RGB', quality_tier: 'Economy', brand: 'Generic', model: '30LED/m 7.2W RGB', est_price_aed: null },
      { size_label: '60LED/m 14.4W RGB', quality_tier: 'Standard', brand: 'Generic', model: '60LED/m 14.4W RGB', est_price_aed: null },
      { size_label: '60LED/m 14.4W RGBW', quality_tier: 'Standard', brand: 'Generic', model: '60LED/m 14.4W RGBW', est_price_aed: null },
      { size_label: '60LED/m 14.4W warm white', quality_tier: 'Standard', brand: 'Generic', model: '60LED/m 14.4W warm white', est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // CABINET_LIGHTING — LED_DRIVERS & ACCESSORIES
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'LED-DRV',
    name: 'LED Power Supply / Driver',
    description: 'LED power supply / driver for cabinet LED strip and profile lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_DRIVERS',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '12V 1A 12W', quality_tier: 'Economy', brand: 'Generic', model: '12V 1A 12W', est_price_aed: null },
      { size_label: '12V 2A 24W', quality_tier: 'Economy', brand: 'Generic', model: '12V 2A 24W', est_price_aed: null },
      { size_label: '12V 5A 60W', quality_tier: 'Standard', brand: 'Generic', model: '12V 5A 60W', est_price_aed: null },
      { size_label: '24V 2.5A 60W', quality_tier: 'Standard', brand: 'Generic', model: '24V 2.5A 60W', est_price_aed: null },
      { size_label: '24V 5A 120W', quality_tier: 'Standard', brand: 'Generic', model: '24V 5A 120W', est_price_aed: null },
      { size_label: '24V 8.3A 200W', quality_tier: 'Premium', brand: 'Mean Well', model: '24V 8.3A 200W', est_price_aed: null },
      { size_label: '24V 12.5A 300W', quality_tier: 'Premium', brand: 'Mean Well', model: '24V 12.5A 300W', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-SENS-DOOR',
    name: 'Cabinet Door Sensor Switch (IR)',
    description: 'Infrared door sensor switch for automatic cabinet lighting.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_ACCESSORIES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Standard IR sensor', quality_tier: 'Standard', brand: 'Generic', model: 'IR door sensor', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-LIGHT-MOTION',
    name: 'Rechargeable Motion-Sensor Cabinet Light (Standalone)',
    description: 'Rechargeable standalone motion-sensor cabinet light.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_ACCESSORIES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Rechargeable USB motion light', quality_tier: 'Standard', brand: 'Generic', model: 'USB motion sensor light', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'LED-CONN',
    name: 'LED Strip Connector (Solderless)',
    description: 'Solderless connector for LED strips.',
    category: 'CABINET_LIGHTING',
    subcategory: 'LED_ACCESSORIES',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '2-pin 8mm single colour', quality_tier: 'Economy', brand: 'Generic', model: '2-pin 8mm', est_price_aed: null },
      { size_label: '2-pin 10mm single colour', quality_tier: 'Economy', brand: 'Generic', model: '2-pin 10mm', est_price_aed: null },
      { size_label: '4-pin 10mm RGB', quality_tier: 'Economy', brand: 'Generic', model: '4-pin 10mm RGB', est_price_aed: null },
      { size_label: '5-pin 12mm RGBW', quality_tier: 'Standard', brand: 'Generic', model: '5-pin 12mm RGBW', est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // UPHOLSTERY — LEATHER
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'UPH-LEATHER',
    name: 'Upholstery Leather (Genuine)',
    description: 'Genuine upholstery leather for furniture.',
    category: 'UPHOLSTERY',
    subcategory: 'LEATHER',
    uom: 'sq_ft',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy split leather', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Standard top-grain', quality_tier: 'Standard', est_price_aed: null },
      { size_label: 'Premium full-grain', quality_tier: 'Premium', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-PU',
    name: 'PU/Faux Leather',
    description: 'PU/faux leather for budget-friendly upholstery.',
    category: 'UPHOLSTERY',
    subcategory: 'FAUX_LEATHER',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy basic PU', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Standard textured PU', quality_tier: 'Standard', est_price_aed: null },
      { size_label: 'Premium marine-grade PU', quality_tier: 'Premium', est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // UPHOLSTERY — FABRIC
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'UPH-FAB-LINEN',
    name: 'Linen / Linen-Blend Upholstery Fabric',
    description: 'Linen and linen-blend upholstery fabric.',
    category: 'UPHOLSTERY',
    subcategory: 'FABRIC',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy linen-poly blend', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Standard linen blend', quality_tier: 'Standard', est_price_aed: null },
      { size_label: 'Premium pure linen', quality_tier: 'Premium', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-FAB-VELVET',
    name: 'Velvet Upholstery Fabric',
    description: 'Velvet upholstery fabric.',
    category: 'UPHOLSTERY',
    subcategory: 'FABRIC',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy poly velvet', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Standard cotton velvet', quality_tier: 'Standard', est_price_aed: null },
      { size_label: 'Premium performance velvet', quality_tier: 'Premium', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-FAB-CHENILLE',
    name: 'Chenille Upholstery Fabric',
    description: 'Chenille upholstery fabric.',
    category: 'UPHOLSTERY',
    subcategory: 'FABRIC',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy chenille blend', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Standard chenille', quality_tier: 'Standard', est_price_aed: null },
      { size_label: 'Premium heavy chenille', quality_tier: 'Premium', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-FAB-SUEDE',
    name: 'Microsuede / Microfiber Upholstery Fabric',
    description: 'Microsuede and microfiber upholstery fabric.',
    category: 'UPHOLSTERY',
    subcategory: 'FABRIC',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy microfiber', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Standard microsuede', quality_tier: 'Standard', est_price_aed: null },
      { size_label: 'Premium stain-resist microsuede', quality_tier: 'Premium', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-FAB-OUTDOOR',
    name: 'Outdoor Upholstery Fabric (UV/Water Resistant)',
    description: 'UV and water resistant outdoor upholstery fabric.',
    category: 'UPHOLSTERY',
    subcategory: 'FABRIC',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy outdoor poly', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Standard Olefin', quality_tier: 'Standard', est_price_aed: null },
      { size_label: 'Premium Sunbrella-type', quality_tier: 'Premium', est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // UPHOLSTERY — FOAM
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'UPH-FOAM',
    name: 'Upholstery Foam Sheet',
    description: 'Upholstery foam sheets of various densities and thicknesses.',
    category: 'UPHOLSTERY',
    subcategory: 'FOAM',
    uom: 'sheet',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'D18 25mm', quality_tier: 'Economy', density_kg_m3: 18, thickness_mm: 25, est_price_aed: null },
      { size_label: 'D18 50mm', quality_tier: 'Economy', density_kg_m3: 18, thickness_mm: 50, est_price_aed: null },
      { size_label: 'D22 25mm', quality_tier: 'Economy', density_kg_m3: 22, thickness_mm: 25, est_price_aed: null },
      { size_label: 'D22 50mm', quality_tier: 'Economy', density_kg_m3: 22, thickness_mm: 50, est_price_aed: null },
      { size_label: 'D22 75mm', quality_tier: 'Economy', density_kg_m3: 22, thickness_mm: 75, est_price_aed: null },
      { size_label: 'D22 100mm', quality_tier: 'Economy', density_kg_m3: 22, thickness_mm: 100, est_price_aed: null },
      { size_label: 'D28 25mm', quality_tier: 'Standard', density_kg_m3: 28, thickness_mm: 25, est_price_aed: null },
      { size_label: 'D28 50mm', quality_tier: 'Standard', density_kg_m3: 28, thickness_mm: 50, est_price_aed: null },
      { size_label: 'D28 75mm', quality_tier: 'Standard', density_kg_m3: 28, thickness_mm: 75, est_price_aed: null },
      { size_label: 'D28 100mm', quality_tier: 'Standard', density_kg_m3: 28, thickness_mm: 100, est_price_aed: null },
      { size_label: 'D35 25mm', quality_tier: 'Standard', density_kg_m3: 35, thickness_mm: 25, est_price_aed: null },
      { size_label: 'D35 50mm', quality_tier: 'Standard', density_kg_m3: 35, thickness_mm: 50, est_price_aed: null },
      { size_label: 'D35 75mm', quality_tier: 'Standard', density_kg_m3: 35, thickness_mm: 75, est_price_aed: null },
      { size_label: 'D35 100mm', quality_tier: 'Standard', density_kg_m3: 35, thickness_mm: 100, est_price_aed: null },
      { size_label: 'D40 50mm', quality_tier: 'Premium', density_kg_m3: 40, thickness_mm: 50, est_price_aed: null },
      { size_label: 'D40 100mm', quality_tier: 'Premium', density_kg_m3: 40, thickness_mm: 100, est_price_aed: null },
      { size_label: 'Memory D50 50mm', quality_tier: 'Premium', density_kg_m3: 50, thickness_mm: 50, foam_type: 'memory', est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // UPHOLSTERY — SUSPENSION
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'UPH-SPRING-ZIG',
    name: 'Sinuous (Zig-Zag) Spring',
    description: 'Sinuous zig-zag spring for seat and back suspension.',
    category: 'UPHOLSTERY',
    subcategory: 'SUSPENSION',
    uom: 'linear_ft',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '8 gauge standard', quality_tier: 'Economy', gauge: 8, est_price_aed: null },
      { size_label: '9 gauge medium', quality_tier: 'Standard', gauge: 9, est_price_aed: null },
      { size_label: '11 gauge heavy', quality_tier: 'Premium', gauge: 11, est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-WEBBING-ELASTIC',
    name: 'Elastic Rubber Webbing',
    description: 'Elastic rubber webbing for seat suspension.',
    category: 'UPHOLSTERY',
    subcategory: 'SUSPENSION',
    uom: 'roll',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '2in standard', quality_tier: 'Standard', width_in: 2, est_price_aed: null },
      { size_label: '3in wide', quality_tier: 'Standard', width_in: 3, est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-WEBBING-JUTE',
    name: 'Jute Webbing',
    description: 'Traditional jute webbing for seat suspension.',
    category: 'UPHOLSTERY',
    subcategory: 'SUSPENSION',
    uom: 'roll',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '3.5in natural jute', quality_tier: 'Standard', width_in: 3.5, est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-SPRING-CLIP',
    name: 'Sinuous Spring Attachment Clip',
    description: 'Attachment clip for sinuous zig-zag springs.',
    category: 'UPHOLSTERY',
    subcategory: 'SUSPENSION',
    uom: 'piece',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Standard metal clip', quality_tier: 'Standard', est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // UPHOLSTERY — BATTING
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'UPH-BATTING',
    name: 'Polyester / Dacron Batting',
    description: 'Polyester/Dacron batting for wrapping foam cushions and padding.',
    category: 'UPHOLSTERY',
    subcategory: 'BATTING',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '2oz thin wrap', quality_tier: 'Economy', weight_oz: 2, est_price_aed: null },
      { size_label: '4oz standard wrap', quality_tier: 'Standard', weight_oz: 4, est_price_aed: null },
      { size_label: '6oz medium wrap', quality_tier: 'Standard', weight_oz: 6, est_price_aed: null },
      { size_label: '8oz heavy wrap', quality_tier: 'Premium', weight_oz: 8, est_price_aed: null },
      { size_label: '12oz extra-heavy', quality_tier: 'Premium', weight_oz: 12, est_price_aed: null },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // UPHOLSTERY — ACCESSORIES
  // ══════════════════════════════════════════════════════════════════════════════

  {
    sku_prefix: 'UPH-ACC-ZIPPER',
    name: 'Continuous Nylon Zipper (Cushion Covers)',
    description: 'Continuous nylon zipper for cushion cover fabrication.',
    category: 'UPHOLSTERY',
    subcategory: 'ACCESSORIES',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '#3 light duty', quality_tier: 'Economy', zipper_size: 3, est_price_aed: null },
      { size_label: '#5 standard duty', quality_tier: 'Standard', zipper_size: 5, est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-ACC-VELCRO',
    name: 'Hook-and-Loop (Velcro) Tape',
    description: 'Hook-and-loop (Velcro) tape for cushion and cover attachment.',
    category: 'UPHOLSTERY',
    subcategory: 'ACCESSORIES',
    uom: 'roll',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: '20mm sew-on', quality_tier: 'Economy', width_mm: 20, est_price_aed: null },
      { size_label: '25mm adhesive-back', quality_tier: 'Standard', width_mm: 25, est_price_aed: null },
      { size_label: '50mm heavy-duty', quality_tier: 'Premium', width_mm: 50, est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-ACC-PIPING',
    name: 'Piping / Welt Cord',
    description: 'Piping/welt cord for upholstery edge finishing.',
    category: 'UPHOLSTERY',
    subcategory: 'ACCESSORIES',
    uom: 'roll',
    suppliers: [],
    supplier_locations: [],
    variants: [
    { size_label: '3/16in (5mm) small', quality_tier: 'Economy', diameter_in: 0.1875, est_price_aed: null },
      { size_label: '1/4in (6mm) standard', quality_tier: 'Standard', diameter_in: 0.25, est_price_aed: null },
      { size_label: '5/16in (8mm) medium', quality_tier: 'Standard', diameter_in: 0.3125, est_price_aed: null },
      { size_label: '1/2in (12mm) jumbo', quality_tier: 'Premium', diameter_in: 0.5, est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-ACC-THREAD',
    name: 'Upholstery Thread (Heavy-Duty)',
    description: 'Heavy-duty upholstery thread for sewing furniture covers.',
    category: 'UPHOLSTERY',
    subcategory: 'ACCESSORIES',
    uom: 'cone',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'T70 polyester', quality_tier: 'Standard', thread_size: 'T70', est_price_aed: null },
      { size_label: 'T90 polyester', quality_tier: 'Standard', thread_size: 'T90', est_price_aed: null },
      { size_label: 'T135 bonded nylon', quality_tier: 'Premium', thread_size: 'T135', est_price_aed: null },
      { size_label: 'T210 extra-heavy', quality_tier: 'Premium', thread_size: 'T210', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-ACC-BUTTON',
    name: 'Self-Cover Tufting Button Forms',
    description: 'Self-cover tufting button forms for upholstery tufting.',
    category: 'UPHOLSTERY',
    subcategory: 'ACCESSORIES',
    uom: 'box',
    suppliers: [],
    supplier_locations: [],
    variants: [
    { size_label: '16mm (100pc)', quality_tier: 'Economy', diameter_mm: 16, qty_per_box: 100, est_price_aed: null },
      { size_label: '20mm (100pc)', quality_tier: 'Economy', diameter_mm: 20, qty_per_box: 100, est_price_aed: null },
      { size_label: '25mm (100pc)', quality_tier: 'Standard', diameter_mm: 25, qty_per_box: 100, est_price_aed: null },
      { size_label: '30mm (50pc)', quality_tier: 'Standard', diameter_mm: 30, qty_per_box: 50, est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-ACC-TACK',
    name: 'Tack Strip (Cardboard or Flexible Metal)',
    description: 'Tack strip for upholstery edge attachment.',
    category: 'UPHOLSTERY',
    subcategory: 'ACCESSORIES',
    uom: 'box_or_roll',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Cardboard tack strip 1/2in', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Cardboard tack strip 3/4in', quality_tier: 'Standard', est_price_aed: null },
      { size_label: 'Flexible metal tack strip', quality_tier: 'Premium', est_price_aed: null },
    ],
  },
  {
    sku_prefix: 'UPH-ACC-CAMBRIC',
    name: 'Cambric / Dust Cover Fabric',
    description: 'Cambric/dust cover fabric for finishing the underside of upholstered furniture.',
    category: 'UPHOLSTERY',
    subcategory: 'ACCESSORIES',
    uom: 'linear_m',
    suppliers: [],
    supplier_locations: [],
    variants: [
      { size_label: 'Economy non-woven', quality_tier: 'Economy', est_price_aed: null },
      { size_label: 'Standard woven cambric', quality_tier: 'Standard', est_price_aed: null },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a material name for matching.
 * Lowercase, collapse whitespace, strip common suffixes.
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();
}

/**
 * Build variant attributes array from a variant object based on category.
 */
function buildVariantAttributes(seedCategory, variant) {
  const attrs = [];

  if (seedCategory === 'CABINET_HARDWARE' || seedCategory === 'CABINET_LIGHTING') {
    if (variant.quality_tier != null) attrs.push({ key: 'quality_tier', value: String(variant.quality_tier) });
    if (variant.brand != null) attrs.push({ key: 'brand', value: String(variant.brand) });
    if (variant.model != null) attrs.push({ key: 'model', value: String(variant.model) });
  } else if (seedCategory === 'UPHOLSTERY') {
    if (variant.quality_tier != null) attrs.push({ key: 'quality_tier', value: String(variant.quality_tier) });
    if (variant.size_label != null) attrs.push({ key: 'size_label', value: String(variant.size_label) });
  }

  return attrs;
}

/**
 * Build parametric tags (extra metadata) from a variant based on category.
 */
function buildParametricTags(seedCategory, variant, parent) {
  const tags = {};

  if (seedCategory === 'CABINET_HARDWARE') {
    if (variant.quality_tier) tags.quality_tier = variant.quality_tier;
    if (variant.brand) tags.brand = variant.brand;
    if (variant.model) tags.model = variant.model;
    // Spec fields
    if (variant.cup_diameter_mm != null) tags.cup_diameter_mm = String(variant.cup_diameter_mm);
    if (variant.opening_angle_deg != null) tags.opening_angle_deg = String(variant.opening_angle_deg);
    if (variant.overlay_type) tags.overlay_type = variant.overlay_type;
    if (variant.load_capacity_kg != null) tags.load_capacity_kg = String(variant.load_capacity_kg);
    if (variant.extension_type) tags.extension_type = variant.extension_type;
  } else if (seedCategory === 'CABINET_LIGHTING') {
    if (variant.quality_tier) tags.quality_tier = variant.quality_tier;
    if (variant.brand) tags.brand = variant.brand;
    if (variant.model) tags.model = variant.model;
  } else if (seedCategory === 'UPHOLSTERY') {
    if (variant.quality_tier) tags.quality_tier = variant.quality_tier;
    if (variant.density_kg_m3 != null) tags.density_kg_m3 = String(variant.density_kg_m3);
    if (variant.thickness_mm != null) tags.thickness_mm = String(variant.thickness_mm);
    if (variant.foam_type) tags.foam_type = variant.foam_type;
    if (variant.gauge != null) tags.gauge = String(variant.gauge);
    if (variant.width_in != null) tags.width_in = String(variant.width_in);
    if (variant.weight_oz != null) tags.weight_oz = String(variant.weight_oz);
    if (variant.zipper_size != null) tags.zipper_size = String(variant.zipper_size);
    if (variant.width_mm != null) tags.width_mm = String(variant.width_mm);
    if (variant.diameter_in != null) tags.diameter_in = String(variant.diameter_in);
    if (variant.thread_size) tags.thread_size = variant.thread_size;
    if (variant.diameter_mm != null) tags.diameter_mm = String(variant.diameter_mm);
    if (variant.qty_per_box != null) tags.qty_per_box = String(variant.qty_per_box);
  }

  return tags;
}

/**
 * Build dimensions object.
 * For hardware/lighting/upholstery, just pass through any dimension fields.
 */
function buildDimensions(seedCategory, variant, parent) {
  if (variant.thickness_mm != null) {
    return {
      thickness: variant.thickness_mm,
    };
  }
  return null;
}

/**
 * Build enrichment update for an existing parent/family document.
 */
function buildParentEnrichment(seedItem, existingData) {
  const update = {};
  const category = CATEGORY_MAP[seedItem.category];

  // Only set fields if empty or --force
  function setIfEmpty(field, value) {
    if (value == null || value === '') return;
    if (!FORCE && existingData[field] != null && existingData[field] !== '' && existingData[field] !== 0) return;
    update[field] = value;
  }

  setIfEmpty('category', category);
  setIfEmpty('subcategory', seedItem.subcategory);
  setIfEmpty('classification', 'material');

  // Description
  setIfEmpty('description', seedItem.description || '');

  // Supplier
  if (seedItem.suppliers && seedItem.suppliers.length > 0) {
    setIfEmpty('preferredSupplierName', seedItem.suppliers[0]);
  }

  // Variant attribute definitions
  const attrDefs = VARIANT_ATTR_DEFS[seedItem.category];
  if (attrDefs) {
    const existingDefs = existingData.variantAttributeDefinitions || [];
    if (existingDefs.length === 0 || FORCE) {
      update.variantAttributeDefinitions = attrDefs;
    }
  }

  // Parametric tags
  const pTags = {};
  if (seedItem.suppliers && seedItem.suppliers.length > 0) pTags.suppliers = seedItem.suppliers.join(', ');
  if (seedItem.supplier_locations && seedItem.supplier_locations.length > 0) {
    pTags.supplier_locations = seedItem.supplier_locations.join(', ');
  }
  pTags.seed_sku_prefix = seedItem.sku_prefix;

  if (Object.keys(pTags).length > 0) {
    const existingPTags = existingData.parametricTags || {};
    update.parametricTags = { ...existingPTags, ...pTags };
  }

  // Tags — merge
  const existingTags = existingData.tags || [];
  const newTags = new Set(existingTags);
  newTags.add(SEED_TAG);
  if (seedItem.subcategory) newTags.add(seedItem.subcategory.toLowerCase().replace(/_/g, '-'));
  for (const loc of (seedItem.supplier_locations || [])) {
    newTags.add(loc.toLowerCase());
  }
  const mergedTags = Array.from(newTags);
  if (mergedTags.length > existingTags.length) {
    update.tags = mergedTags;
  }

  // UoM
  const mappedUom = UOM_MAP[seedItem.uom] || seedItem.uom;
  setIfEmpty('purchaseUom', mappedUom);
  setIfEmpty('stockUom', mappedUom);

  // Timestamps
  update.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  update.updatedBy = 'system-seed';

  return update;
}

/**
 * Get the pricing cost and currency for a variant.
 */
function getVariantPricing(variant) {
  if (variant.est_price_aed != null) {
    return { cost: variant.est_price_aed, currency: 'AED' };
  }
  if (variant.est_price_ugx != null) {
    return { cost: variant.est_price_ugx, currency: 'UGX' };
  }
  return { cost: 0, currency: 'AED' };
}

/**
 * Build a complete new family document.
 */
function buildNewFamilyDoc(seedItem, familyId, skuIds) {
  const category = CATEGORY_MAP[seedItem.category];
  const mappedUom = UOM_MAP[seedItem.uom] || seedItem.uom;
  const attrDefs = VARIANT_ATTR_DEFS[seedItem.category] || [];

  const tags = [SEED_TAG];
  if (seedItem.subcategory) tags.push(seedItem.subcategory.toLowerCase().replace(/_/g, '-'));
  for (const loc of (seedItem.supplier_locations || [])) {
    tags.push(loc.toLowerCase());
  }

  const pTags = {};
  if (seedItem.suppliers && seedItem.suppliers.length > 0) pTags.suppliers = seedItem.suppliers.join(', ');
  if (seedItem.supplier_locations && seedItem.supplier_locations.length > 0) {
    pTags.supplier_locations = seedItem.supplier_locations.join(', ');
  }
  pTags.seed_sku_prefix = seedItem.sku_prefix;

  const doc = {
    sku: seedItem.sku_prefix,
    name: seedItem.name,
    displayName: seedItem.name,
    description: seedItem.description || '',
    classification: 'material',
    category,
    subcategory: seedItem.subcategory,
    tags,
    // Family hierarchy
    isFamily: true,
    isOrderable: false,
    isBomSelectable: false,
    familyId: null,
    skuIds,
    variantAttributeDefinitions: attrDefs,
    // UoM
    purchaseUom: mappedUom,
    stockUom: mappedUom,
    // Supplier
    preferredSupplierName: (seedItem.suppliers && seedItem.suppliers[0]) || '',
    // Pricing (family level = 0)
    pricing: {
      costPerUnit: 0,
      currency: 'AED',
      unit: mappedUom,
    },
    inventory: { inStock: 0 },
    status: 'active',
    source: 'manual',
    tier: 'global',
    parametricTags: pTags,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system-seed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'system-seed',
  };

  return doc;
}

/**
 * Build a new SKU (child variant) document.
 */
function buildNewSkuDoc(seedItem, variant, familyId) {
  const category = CATEGORY_MAP[seedItem.category];
  const mappedUom = UOM_MAP[seedItem.uom] || seedItem.uom;
  const variantSku = `${seedItem.sku_prefix}-${variant.size_label}`;
  const variantName = `${seedItem.name} — ${variant.size_label}`;
  const variantAttributes = buildVariantAttributes(seedItem.category, variant);
  const parametricTags = buildParametricTags(seedItem.category, variant, seedItem);
  const { cost, currency } = getVariantPricing(variant);
  const dims = buildDimensions(seedItem.category, variant, seedItem);

  const doc = {
    sku: variantSku,
    name: variantName,
    displayName: variantName,
    description: '',
    classification: 'material',
    category,
    subcategory: seedItem.subcategory,
    tags: [SEED_TAG],
    // SKU hierarchy
    isFamily: false,
    isOrderable: true,
    isBomSelectable: true,
    familyId,
    // Variant attributes
    variantAttributes,
    // UoM
    purchaseUom: mappedUom,
    stockUom: mappedUom,
    // Supplier (inherited from parent)
    preferredSupplierName: (seedItem.suppliers && seedItem.suppliers[0]) || '',
    // Pricing
    pricing: {
      costPerUnit: cost,
      currency,
      unit: mappedUom,
    },
    inventory: { inStock: 0 },
    status: 'active',
    source: 'manual',
    tier: 'global',
    parametricTags,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system-seed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'system-seed',
  };

  if (dims) doc.dimensions = dims;

  return doc;
}

/**
 * Strip undefined values from an object before Firestore write.
 */
function stripUndefined(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof admin.firestore.Timestamp)) {
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        result[key] = stripUndefined(value);
        continue;
      }
    }
    result[key] = value;
  }
  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Seed Hardware, Lighting & Upholstery Materials ===\n');

  // ── Phase 1: Load existing items ──
  console.log('1. Loading existing inventory items...');
  const snapshot = await db.collection(INVENTORY_COLLECTION).get();
  console.log(`   Found ${snapshot.size} existing items\n`);

  // Build name lookup: normalized name → array of { id, data }
  const nameLookup = new Map();
  const familyChildren = new Map(); // familyId → [{ id, data }]

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const normalized = normalizeName(data.name || '');

    if (!nameLookup.has(normalized)) {
      nameLookup.set(normalized, []);
    }
    nameLookup.get(normalized).push({ id: doc.id, data });

    // Also index by familyId for enriching children
    if (data.familyId) {
      if (!familyChildren.has(data.familyId)) {
        familyChildren.set(data.familyId, []);
      }
      familyChildren.get(data.familyId).push({ id: doc.id, data });
    }
  }

  console.log(`   Name lookup: ${nameLookup.size} unique normalized names`);
  console.log(`   Families with children: ${familyChildren.size}\n`);

  // ── Phase 2: Match and plan operations ──
  console.log('2. Matching seed data against existing items...\n');

  const updates = [];   // { ref, data } for batch.update()
  const creates = [];   // { ref, data } for batch.set()
  let matchCount = 0;
  let createCount = 0;

  for (const seedItem of SEED_DATA) {
    const seedNormalized = normalizeName(seedItem.name);
    const matches = nameLookup.get(seedNormalized) || [];

    let bestMatch = null;
    if (matches.length === 1) {
      bestMatch = matches[0];
    } else if (matches.length > 1) {
      // Prefer family items over flat items
      bestMatch = matches.find(m => m.data.isFamily) || matches[0];
    }

    if (bestMatch) {
      // ── ENRICH existing item ──
      matchCount++;
      console.log(`   MATCH: "${seedItem.name}" → existing "${bestMatch.data.name}" (${bestMatch.id})`);

      const enrichment = buildParentEnrichment(seedItem, bestMatch.data);
      if (Object.keys(enrichment).length > 2) { // more than just updatedAt/updatedBy
        updates.push({
          ref: db.collection(INVENTORY_COLLECTION).doc(bestMatch.id),
          data: stripUndefined(enrichment),
        });
      }

      // Enrich existing children if this is a family
      if (bestMatch.data.isFamily) {
        const children = familyChildren.get(bestMatch.id) || [];
        console.log(`          Family has ${children.length} existing SKU children`);

        for (const child of children) {
          // Try matching child to a seed variant by size_label or variant attributes
          const childAttrs = child.data.variantAttributes || [];
          const childSizeLabel = child.data.sku?.split('-').pop() || '';

          const matchedVariant = seedItem.variants.find(v => {
            // Match by size_label in SKU
            if (childSizeLabel && v.size_label === childSizeLabel) return true;
            // Match by variant attributes
            if (childAttrs.length > 0) {
              const seedAttrs = buildVariantAttributes(seedItem.category, v);
              return seedAttrs.every(sa => childAttrs.some(ca => ca.key === sa.key && ca.value === sa.value));
            }
            return false;
          });

          if (matchedVariant) {
            const childUpdate = {};
            const { cost, currency } = getVariantPricing(matchedVariant);
            if (cost > 0 && (FORCE || !child.data.pricing?.costPerUnit)) {
              childUpdate['pricing.costPerUnit'] = cost;
              childUpdate['pricing.currency'] = currency;
            }

            const dims = buildDimensions(seedItem.category, matchedVariant, seedItem);
            if (dims && (FORCE || !child.data.dimensions)) {
              childUpdate.dimensions = dims;
            }

            const pTags = buildParametricTags(seedItem.category, matchedVariant, seedItem);
            if (Object.keys(pTags).length > 0) {
              childUpdate.parametricTags = { ...(child.data.parametricTags || {}), ...pTags };
            }

            // Merge seed tag
            const childTags = new Set(child.data.tags || []);
            childTags.add(SEED_TAG);
            childUpdate.tags = Array.from(childTags);

            childUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            childUpdate.updatedBy = 'system-seed';

            updates.push({
              ref: db.collection(INVENTORY_COLLECTION).doc(child.id),
              data: stripUndefined(childUpdate),
            });
          }
        }
      }
    } else {
      // ── CREATE new family + SKUs ──
      createCount++;
      console.log(`   CREATE: "${seedItem.name}" (${seedItem.sku_prefix}) — ${seedItem.variants.length} variants`);

      // Generate IDs upfront
      const familyRef = db.collection(INVENTORY_COLLECTION).doc();
      const familyId = familyRef.id;
      const skuRefs = seedItem.variants.map(() => db.collection(INVENTORY_COLLECTION).doc());
      const skuIds = skuRefs.map(ref => ref.id);

      // Build family document
      const familyDoc = buildNewFamilyDoc(seedItem, familyId, skuIds);
      creates.push({ ref: familyRef, data: stripUndefined(familyDoc) });

      // Build SKU documents
      for (let i = 0; i < seedItem.variants.length; i++) {
        const variant = seedItem.variants[i];
        const skuDoc = buildNewSkuDoc(seedItem, variant, familyId);
        creates.push({ ref: skuRefs[i], data: stripUndefined(skuDoc) });
      }
    }
  }

  console.log(`\n   Summary: ${matchCount} matched (enrich), ${createCount} unmatched (create)`);
  console.log(`   Operations: ${updates.length} updates, ${creates.length} creates\n`);

  // ── Phase 3: Batch write ──
  console.log('3. Writing to Firestore...\n');

  const allOps = [
    ...updates.map(u => ({ type: 'update', ...u })),
    ...creates.map(c => ({ type: 'set', ...c })),
  ];

  if (allOps.length === 0) {
    console.log('   Nothing to write. All items already up to date.');
    process.exit(0);
  }

  // Chunk into batches
  const chunks = [];
  for (let i = 0; i < allOps.length; i += BATCH_LIMIT) {
    chunks.push(allOps.slice(i, i + BATCH_LIMIT));
  }

  console.log(`   Total operations: ${allOps.length} across ${chunks.length} batch(es)`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (DRY_RUN) {
      console.log(`   [DRY] Batch ${i + 1}: ${chunk.length} operations`);
      for (const op of chunk) {
        const label = op.type === 'update' ? 'UPDATE' : 'CREATE';
        const name = op.data.name || op.data.displayName || op.ref.id;
        console.log(`         ${label}: ${name}`);
      }
    } else {
      const batch = db.batch();
      for (const op of chunk) {
        if (op.type === 'update') {
          batch.update(op.ref, op.data);
        } else {
          batch.set(op.ref, op.data);
        }
      }
      await batch.commit();
      console.log(`   Batch ${i + 1}: committed ${chunk.length} operations`);
    }
  }

  // ── Phase 4: Summary ──
  console.log('\n=== Summary ===');
  console.log(`   Seed items processed: ${SEED_DATA.length}`);
  console.log(`   Matched & enriched: ${matchCount}`);
  console.log(`   New families created: ${createCount}`);
  console.log(`   Total updates: ${updates.length}`);
  console.log(`   Total creates: ${creates.length}`);

  if (DRY_RUN) {
    console.log('\n   (Dry run — no changes were made)');
  }

  console.log('\nDone!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
