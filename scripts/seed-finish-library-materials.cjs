/**
 * Seed Finish Library Materials
 *
 * Enriches existing inventoryItems with catalog data from the Finish Library,
 * and creates new Family/SKU hierarchies for unmatched items.
 *
 * Run with:
 *   node scripts/seed-finish-library-materials.cjs
 *   node scripts/seed-finish-library-materials.cjs --dry-run
 *   node scripts/seed-finish-library-materials.cjs --force
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
const SEED_TAG = 'finish-library-seed';

// ─── Category Mapping ────────────────────────────────────────────────────────

const CATEGORY_MAP = {
  SOLID_TIMBER: 'solid-wood',
  ENGINEERED_BOARD: 'sheet-goods',
  PAINT_AND_FINISH: 'finishing',
  FASTENERS: 'fasteners',
  STEEL_SECTIONS: 'other',
};

const UOM_MAP = {
  piece: 'pcs',
  sheet: 'sheet',
  tin: 'ea',
  box: 'box',
  case: 'box',
  kg: 'kg',
  length: 'pcs',
};

const VARIANT_ATTR_DEFS = {
  SOLID_TIMBER: ['width_in', 'thickness_in', 'length_ft'],
  ENGINEERED_BOARD: ['thickness_mm'],
  PAINT_AND_FINISH: ['volume'],
  FASTENERS: ['size_label'],
  STEEL_SECTIONS: ['size_label'],
};

// ─── Seed Data ───────────────────────────────────────────────────────────────

const SEED_DATA = [
  // ── SOLID TIMBER: Premium Hardwood (Class 1A) ──
  {
    sku_prefix: 'TIM-MAH',
    name: 'Mahogany',
    local_name: 'Various spp. (incl. Khaya, Congo Mahogany)',
    category: 'SOLID_TIMBER',
    subcategory: 'PREMIUM_HARDWOOD',
    timber_class: '1A',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd', 'Denis Timber Sales', 'Esther Mahogany Timber'],
    supplier_locations: ['Ntinda', 'Ndeeba'],
    primary_uses: 'Premium furniture, door panels, cabinetry, ceiling boards, sculptures, export',
    notes: 'Much of supply sourced from DRC. Lengths vary with natural forest harvest.',
    variants: [
      { size_label: '12x2x18', width_in: 12, thickness_in: 2, length_ft: 18, width_mm: 304.8, thickness_mm: 50.8, length_mm: 5486.4, volume_ft3: 3.00, volume_m3: 0.0850, est_price_ugx: 230000 },
      { size_label: '12x2x14', width_in: 12, thickness_in: 2, length_ft: 14, width_mm: 304.8, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 2.33, volume_m3: 0.0661, est_price_ugx: 200000 },
      { size_label: '12x2x9',  width_in: 12, thickness_in: 2, length_ft: 9,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2743.2, volume_ft3: 1.50, volume_m3: 0.0425, est_price_ugx: 120000 },
      { size_label: '12x2x7',  width_in: 12, thickness_in: 2, length_ft: 7,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '12x1x14', width_in: 12, thickness_in: 1, length_ft: 14, width_mm: 304.8, thickness_mm: 25.4, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '12x4x9',  width_in: 12, thickness_in: 4, length_ft: 9,  width_mm: 304.8, thickness_mm: 101.6, length_mm: 2743.2, volume_ft3: 3.00, volume_m3: 0.0850, est_price_ugx: 230000 },
      { size_label: '8x2x18',  width_in: 8,  thickness_in: 2, length_ft: 18, width_mm: 203.2, thickness_mm: 50.8, length_mm: 5486.4, volume_ft3: 2.00, volume_m3: 0.0566, est_price_ugx: null },
      { size_label: '8x2x14',  width_in: 8,  thickness_in: 2, length_ft: 14, width_mm: 203.2, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.56, volume_m3: 0.0441, est_price_ugx: null },
      { size_label: '8x2x9',   width_in: 8,  thickness_in: 2, length_ft: 9,  width_mm: 203.2, thickness_mm: 50.8, length_mm: 2743.2, volume_ft3: 1.00, volume_m3: 0.0283, est_price_ugx: null },
      { size_label: '8x2x7',   width_in: 8,  thickness_in: 2, length_ft: 7,  width_mm: 203.2, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 0.78, volume_m3: 0.0220, est_price_ugx: null },
      { size_label: '8x4x9',   width_in: 8,  thickness_in: 4, length_ft: 9,  width_mm: 203.2, thickness_mm: 101.6, length_mm: 2743.2, volume_ft3: 2.00, volume_m3: 0.0566, est_price_ugx: null },
      { size_label: '6x2x18',  width_in: 6,  thickness_in: 2, length_ft: 18, width_mm: 152.4, thickness_mm: 50.8, length_mm: 5486.4, volume_ft3: 1.50, volume_m3: 0.0425, est_price_ugx: null },
      { size_label: '6x2x14',  width_in: 6,  thickness_in: 2, length_ft: 14, width_mm: 152.4, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '6x4x9',   width_in: 6,  thickness_in: 4, length_ft: 9,  width_mm: 152.4, thickness_mm: 101.6, length_mm: 2743.2, volume_ft3: 1.50, volume_m3: 0.0425, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'TIM-MVL',
    name: 'Muvule',
    local_name: 'Milicia excelsa (Iroko)',
    category: 'SOLID_TIMBER',
    subcategory: 'PREMIUM_HARDWOOD',
    timber_class: '1A',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd'],
    supplier_locations: ['Ntinda'],
    primary_uses: 'High-end furniture, joinery, boat building, heavy construction, carving',
    notes: 'Increasingly scarce. Premium pricing. Exceptionally durable and termite-resistant.',
    variants: [
      { size_label: '12x2x14', width_in: 12, thickness_in: 2, length_ft: 14, width_mm: 304.8, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 2.33, volume_m3: 0.0661, est_price_ugx: null },
      { size_label: '12x2x9',  width_in: 12, thickness_in: 2, length_ft: 9,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2743.2, volume_ft3: 1.50, volume_m3: 0.0425, est_price_ugx: null },
      { size_label: '12x2x8',  width_in: 12, thickness_in: 2, length_ft: 8,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2438.4, volume_ft3: 1.33, volume_m3: 0.0378, est_price_ugx: null },
      { size_label: '12x1x14', width_in: 12, thickness_in: 1, length_ft: 14, width_mm: 304.8, thickness_mm: 25.4, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '12x1x7',  width_in: 12, thickness_in: 1, length_ft: 7,  width_mm: 304.8, thickness_mm: 25.4, length_mm: 2133.6, volume_ft3: 0.58, volume_m3: 0.0165, est_price_ugx: null },
      { size_label: '8x2x14',  width_in: 8,  thickness_in: 2, length_ft: 14, width_mm: 203.2, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.56, volume_m3: 0.0441, est_price_ugx: null },
      { size_label: '8x2x7',   width_in: 8,  thickness_in: 2, length_ft: 7,  width_mm: 203.2, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 0.78, volume_m3: 0.0220, est_price_ugx: null },
      { size_label: '6x2x14',  width_in: 6,  thickness_in: 2, length_ft: 14, width_mm: 152.4, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
    ],
  },

  // ── SOLID TIMBER: High-Value Hardwood (Class 1B) ──
  {
    sku_prefix: 'TIM-NKL',
    name: 'Nkalati',
    local_name: 'Chrysophyllum albidum',
    category: 'SOLID_TIMBER',
    subcategory: 'HIGH_VALUE_HARDWOOD',
    timber_class: '1B',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd'],
    supplier_locations: ['Ntinda'],
    primary_uses: 'Furniture, construction, flooring, joinery',
    notes: 'Good workability. Medium-to-high density.',
    variants: [
      { size_label: '12x2x14', width_in: 12, thickness_in: 2, length_ft: 14, width_mm: 304.8, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 2.33, volume_m3: 0.0661, est_price_ugx: null },
      { size_label: '12x2x9',  width_in: 12, thickness_in: 2, length_ft: 9,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2743.2, volume_ft3: 1.50, volume_m3: 0.0425, est_price_ugx: null },
      { size_label: '12x2x8',  width_in: 12, thickness_in: 2, length_ft: 8,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2438.4, volume_ft3: 1.33, volume_m3: 0.0378, est_price_ugx: null },
      { size_label: '12x2x7',  width_in: 12, thickness_in: 2, length_ft: 7,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '12x1x14', width_in: 12, thickness_in: 1, length_ft: 14, width_mm: 304.8, thickness_mm: 25.4, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '8x2x14',  width_in: 8,  thickness_in: 2, length_ft: 14, width_mm: 203.2, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.56, volume_m3: 0.0441, est_price_ugx: null },
      { size_label: '6x2x14',  width_in: 6,  thickness_in: 2, length_ft: 14, width_mm: 152.4, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'TIM-ETK',
    name: 'Elgon Teak',
    local_name: 'Olea welwitschii / capensis',
    category: 'SOLID_TIMBER',
    subcategory: 'HIGH_VALUE_HARDWOOD',
    timber_class: '1B',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd'],
    supplier_locations: ['Ntinda'],
    primary_uses: 'Durable furniture, flooring, heavy structural, tool handles',
    notes: 'Very hard and dense. Excellent durability.',
    variants: [
      { size_label: '12x2x14', width_in: 12, thickness_in: 2, length_ft: 14, width_mm: 304.8, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 2.33, volume_m3: 0.0661, est_price_ugx: null },
      { size_label: '12x2x12', width_in: 12, thickness_in: 2, length_ft: 12, width_mm: 304.8, thickness_mm: 50.8, length_mm: 3657.6, volume_ft3: 2.00, volume_m3: 0.0566, est_price_ugx: null },
      { size_label: '12x2x8',  width_in: 12, thickness_in: 2, length_ft: 8,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2438.4, volume_ft3: 1.33, volume_m3: 0.0378, est_price_ugx: null },
      { size_label: '12x2x7',  width_in: 12, thickness_in: 2, length_ft: 7,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '8x2x14',  width_in: 8,  thickness_in: 2, length_ft: 14, width_mm: 203.2, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.56, volume_m3: 0.0441, est_price_ugx: null },
      { size_label: '8x2x12',  width_in: 8,  thickness_in: 2, length_ft: 12, width_mm: 203.2, thickness_mm: 50.8, length_mm: 3657.6, volume_ft3: 1.33, volume_m3: 0.0378, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'TIM-MNY',
    name: 'Munyenye',
    local_name: 'Entandrophragma spp.',
    category: 'SOLID_TIMBER',
    subcategory: 'HIGH_VALUE_HARDWOOD',
    timber_class: '1B',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd'],
    supplier_locations: ['Ntinda'],
    primary_uses: 'Quality furniture, veneers, decorative panels, joinery',
    notes: 'Related to African Mahogany family. Good figure grain.',
    variants: [
      { size_label: '12x2x14', width_in: 12, thickness_in: 2, length_ft: 14, width_mm: 304.8, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 2.33, volume_m3: 0.0661, est_price_ugx: null },
      { size_label: '12x2x13', width_in: 12, thickness_in: 2, length_ft: 13, width_mm: 304.8, thickness_mm: 50.8, length_mm: 3962.4, volume_ft3: 2.17, volume_m3: 0.0614, est_price_ugx: null },
      { size_label: '12x2x12', width_in: 12, thickness_in: 2, length_ft: 12, width_mm: 304.8, thickness_mm: 50.8, length_mm: 3657.6, volume_ft3: 2.00, volume_m3: 0.0566, est_price_ugx: null },
      { size_label: '12x1x14', width_in: 12, thickness_in: 1, length_ft: 14, width_mm: 304.8, thickness_mm: 25.4, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '12x1x7',  width_in: 12, thickness_in: 1, length_ft: 7,  width_mm: 304.8, thickness_mm: 25.4, length_mm: 2133.6, volume_ft3: 0.58, volume_m3: 0.0165, est_price_ugx: null },
      { size_label: '8x2x14',  width_in: 8,  thickness_in: 2, length_ft: 14, width_mm: 203.2, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.56, volume_m3: 0.0441, est_price_ugx: null },
      { size_label: '8x2x13',  width_in: 8,  thickness_in: 2, length_ft: 13, width_mm: 203.2, thickness_mm: 50.8, length_mm: 3962.4, volume_ft3: 1.44, volume_m3: 0.0409, est_price_ugx: null },
      { size_label: '8x2x12',  width_in: 8,  thickness_in: 2, length_ft: 12, width_mm: 203.2, thickness_mm: 50.8, length_mm: 3657.6, volume_ft3: 1.33, volume_m3: 0.0378, est_price_ugx: null },
      { size_label: '8x2x7',   width_in: 8,  thickness_in: 2, length_ft: 7,  width_mm: 203.2, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 0.78, volume_m3: 0.0220, est_price_ugx: null },
    ],
  },

  // ── SOLID TIMBER: Medium Hardwood (Class 2) ──
  {
    sku_prefix: 'TIM-MGV',
    name: 'Mugavu',
    local_name: 'Albizia coriaria',
    category: 'SOLID_TIMBER',
    subcategory: 'MEDIUM_HARDWOOD',
    timber_class: '2',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd'],
    supplier_locations: ['Ntinda'],
    primary_uses: 'General furniture, construction timber, cabinet making, turnery',
    notes: 'Widely available. Nitrogen-fixing tree common across Uganda.',
    variants: [
      { size_label: '12x2x14', width_in: 12, thickness_in: 2, length_ft: 14, width_mm: 304.8, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 2.33, volume_m3: 0.0661, est_price_ugx: null },
      { size_label: '12x2x9',  width_in: 12, thickness_in: 2, length_ft: 9,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2743.2, volume_ft3: 1.50, volume_m3: 0.0425, est_price_ugx: null },
      { size_label: '12x2x7',  width_in: 12, thickness_in: 2, length_ft: 7,  width_mm: 304.8, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '12x1x14', width_in: 12, thickness_in: 1, length_ft: 14, width_mm: 304.8, thickness_mm: 25.4, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '8x2x14',  width_in: 8,  thickness_in: 2, length_ft: 14, width_mm: 203.2, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.56, volume_m3: 0.0441, est_price_ugx: null },
      { size_label: '8x2x7',   width_in: 8,  thickness_in: 2, length_ft: 7,  width_mm: 203.2, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 0.78, volume_m3: 0.0220, est_price_ugx: null },
      { size_label: '6x2x14',  width_in: 6,  thickness_in: 2, length_ft: 14, width_mm: 152.4, thickness_mm: 50.8, length_mm: 4267.2, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'TIM-MSB',
    name: 'Musambya',
    local_name: 'Markhamia lutea',
    category: 'SOLID_TIMBER',
    subcategory: 'MEDIUM_HARDWOOD',
    timber_class: '2',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd'],
    supplier_locations: ['Ntinda'],
    primary_uses: 'Construction, roofing, general furniture, poles, farm tools',
    notes: 'Commonly available in shorter lengths (7ft). Popular budget hardwood.',
    variants: [
      { size_label: '12x2x7',  width_in: 12, thickness_in: 2, length_ft: 7, width_mm: 304.8, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 1.17, volume_m3: 0.0330, est_price_ugx: null },
      { size_label: '12x1x7',  width_in: 12, thickness_in: 1, length_ft: 7, width_mm: 304.8, thickness_mm: 25.4, length_mm: 2133.6, volume_ft3: 0.58, volume_m3: 0.0165, est_price_ugx: null },
      { size_label: '10x1x7',  width_in: 10, thickness_in: 1, length_ft: 7, width_mm: 254.0, thickness_mm: 25.4, length_mm: 2133.6, volume_ft3: 0.49, volume_m3: 0.0138, est_price_ugx: null },
      { size_label: '8x2x7',   width_in: 8,  thickness_in: 2, length_ft: 7, width_mm: 203.2, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 0.78, volume_m3: 0.0220, est_price_ugx: null },
      { size_label: '6x2x7',   width_in: 6,  thickness_in: 2, length_ft: 7, width_mm: 152.4, thickness_mm: 50.8, length_mm: 2133.6, volume_ft3: 0.58, volume_m3: 0.0165, est_price_ugx: null },
      { size_label: '4x4x7',   width_in: 4,  thickness_in: 4, length_ft: 7, width_mm: 101.6, thickness_mm: 101.6, length_mm: 2133.6, volume_ft3: 0.78, volume_m3: 0.0220, est_price_ugx: null },
      { size_label: '4x2x7',   width_in: 4,  thickness_in: 2, length_ft: 7, width_mm: 101.6, thickness_mm: 50.8,  length_mm: 2133.6, volume_ft3: 0.39, volume_m3: 0.0110, est_price_ugx: null },
      { size_label: '3x3x7',   width_in: 3,  thickness_in: 3, length_ft: 7, width_mm: 76.2,  thickness_mm: 76.2,  length_mm: 2133.6, volume_ft3: 0.44, volume_m3: 0.0124, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'TIM-MSZ',
    name: 'Musizi',
    local_name: 'Maesopsis eminii (Umbrella Tree)',
    category: 'SOLID_TIMBER',
    subcategory: 'MEDIUM_HARDWOOD',
    timber_class: '2',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd'],
    supplier_locations: ['Ntinda'],
    primary_uses: 'Light furniture, plywood core, general construction, boxes',
    notes: 'Fast-growing indigenous hardwood. Lighter weight.',
    variants: [
      { size_label: '12x1x12', width_in: 12, thickness_in: 1, length_ft: 12, width_mm: 304.8, thickness_mm: 25.4, length_mm: 3657.6, volume_ft3: 1.00, volume_m3: 0.0283, est_price_ugx: null },
      { size_label: '12x1x7',  width_in: 12, thickness_in: 1, length_ft: 7,  width_mm: 304.8, thickness_mm: 25.4, length_mm: 2133.6, volume_ft3: 0.58, volume_m3: 0.0165, est_price_ugx: null },
      { size_label: '8x2x12',  width_in: 8,  thickness_in: 2, length_ft: 12, width_mm: 203.2, thickness_mm: 50.8, length_mm: 3657.6, volume_ft3: 1.33, volume_m3: 0.0378, est_price_ugx: null },
    ],
  },

  // ── SOLID TIMBER: Utility Hardwood (Class 3) ──
  {
    sku_prefix: 'TIM-KRD',
    name: 'Kirundu',
    local_name: 'Antiaris toxicaria',
    category: 'SOLID_TIMBER',
    subcategory: 'UTILITY_HARDWOOD',
    timber_class: '3',
    uom: 'piece',
    suppliers: ['Erimu Company Ltd', 'Waismart Enterprises'],
    supplier_locations: ['Ntinda', 'Central Division'],
    primary_uses: 'Ceiling boards, light panelling, interior trim, face boards',
    notes: 'Single standard size. Very light softish hardwood.',
    variants: [
      { size_label: '9x1x10', width_in: 9, thickness_in: 1, length_ft: 10, width_mm: 228.6, thickness_mm: 25.4, length_mm: 3048.0, volume_ft3: 0.63, volume_m3: 0.0177, est_price_ugx: 8000 },
    ],
  },

  // ── SOLID TIMBER: Softwood — Plantation ──
  {
    sku_prefix: 'TIM-PIN',
    name: 'Pine',
    local_name: 'Pinus caribaea / patula (Plantation)',
    category: 'SOLID_TIMBER',
    subcategory: 'SOFTWOOD_PLANTATION',
    timber_class: '2',
    uom: 'piece',
    suppliers: ['Denis Timber Sales', 'Besepo Uganda Ltd', 'Waismart Enterprises'],
    supplier_locations: ['Ndeeba', 'Central Division'],
    primary_uses: 'Roofing (trusses, purlins, wall plate), wall framing, formwork, light furniture, mouldings',
    notes: 'Most standardised timber in Uganda. 13ft standard plantation length. Easy to work.',
    variants: [
      { size_label: '12x1x13', width_in: 12, thickness_in: 1, length_ft: 13, width_mm: 304.8, thickness_mm: 25.4, length_mm: 3962.4, volume_ft3: 1.08, volume_m3: 0.0307, est_price_ugx: 20000 },
      { size_label: '10x1x13', width_in: 10, thickness_in: 1, length_ft: 13, width_mm: 254.0, thickness_mm: 25.4, length_mm: 3962.4, volume_ft3: 0.90, volume_m3: 0.0256, est_price_ugx: null },
      { size_label: '9x1x13',  width_in: 9,  thickness_in: 1, length_ft: 13, width_mm: 228.6, thickness_mm: 25.4, length_mm: 3962.4, volume_ft3: 0.81, volume_m3: 0.0230, est_price_ugx: null },
      { size_label: '8x1x13',  width_in: 8,  thickness_in: 1, length_ft: 13, width_mm: 203.2, thickness_mm: 25.4, length_mm: 3962.4, volume_ft3: 0.72, volume_m3: 0.0204, est_price_ugx: null },
      { size_label: '6x2x13',  width_in: 6,  thickness_in: 2, length_ft: 13, width_mm: 152.4, thickness_mm: 50.8, length_mm: 3962.4, volume_ft3: 1.08, volume_m3: 0.0307, est_price_ugx: 9000 },
      { size_label: '4x4x13',  width_in: 4,  thickness_in: 4, length_ft: 13, width_mm: 101.6, thickness_mm: 101.6, length_mm: 3962.4, volume_ft3: 1.44, volume_m3: 0.0409, est_price_ugx: null },
      { size_label: '4x3x13',  width_in: 4,  thickness_in: 3, length_ft: 13, width_mm: 101.6, thickness_mm: 76.2,  length_mm: 3962.4, volume_ft3: 1.08, volume_m3: 0.0307, est_price_ugx: null },
      { size_label: '4x2x13',  width_in: 4,  thickness_in: 2, length_ft: 13, width_mm: 101.6, thickness_mm: 50.8,  length_mm: 3962.4, volume_ft3: 0.72, volume_m3: 0.0204, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'TIM-EUC',
    name: 'Eucalyptus',
    local_name: 'Eucalyptus grandis (Kalitunsi — Plantation)',
    category: 'SOLID_TIMBER',
    subcategory: 'SOFTWOOD_PLANTATION',
    timber_class: '2',
    uom: 'piece',
    suppliers: ['Waismart Enterprises', 'Amon Timber Dealers'],
    supplier_locations: ['Central Division', 'Ndeeba'],
    primary_uses: 'Roofing structure, trusses, purlins, poles, formwork, fencing',
    notes: 'Strong and durable for the price. Available in 10ft and 13ft lengths.',
    variants: [
      { size_label: '6x2x13',  width_in: 6,  thickness_in: 2, length_ft: 13, width_mm: 152.4, thickness_mm: 50.8,  length_mm: 3962.4, volume_ft3: 1.08, volume_m3: 0.0307, est_price_ugx: 9000 },
      { size_label: '6x2x10',  width_in: 6,  thickness_in: 2, length_ft: 10, width_mm: 152.4, thickness_mm: 50.8,  length_mm: 3048.0, volume_ft3: 0.83, volume_m3: 0.0236, est_price_ugx: 6000 },
      { size_label: '4x3x13',  width_in: 4,  thickness_in: 3, length_ft: 13, width_mm: 101.6, thickness_mm: 76.2,  length_mm: 3962.4, volume_ft3: 1.08, volume_m3: 0.0307, est_price_ugx: 9000 },
      { size_label: '4x3x10',  width_in: 4,  thickness_in: 3, length_ft: 10, width_mm: 101.6, thickness_mm: 76.2,  length_mm: 3048.0, volume_ft3: 0.83, volume_m3: 0.0236, est_price_ugx: 6000 },
      { size_label: '4x2x13',  width_in: 4,  thickness_in: 2, length_ft: 13, width_mm: 101.6, thickness_mm: 50.8,  length_mm: 3962.4, volume_ft3: 0.72, volume_m3: 0.0204, est_price_ugx: null },
      { size_label: '4x2x10',  width_in: 4,  thickness_in: 2, length_ft: 10, width_mm: 101.6, thickness_mm: 50.8,  length_mm: 3048.0, volume_ft3: 0.56, volume_m3: 0.0157, est_price_ugx: 4000 },
      { size_label: '3x2x13',  width_in: 3,  thickness_in: 2, length_ft: 13, width_mm: 76.2,  thickness_mm: 50.8,  length_mm: 3962.4, volume_ft3: 0.54, volume_m3: 0.0153, est_price_ugx: null },
      { size_label: '3x2x10',  width_in: 3,  thickness_in: 2, length_ft: 10, width_mm: 76.2,  thickness_mm: 50.8,  length_mm: 3048.0, volume_ft3: 0.42, volume_m3: 0.0118, est_price_ugx: 3000 },
    ],
  },

  // ── ENGINEERED BOARD ──
  {
    sku_prefix: 'BRD-MFC',
    name: 'PG Bison MelaWood MFC',
    local_name: 'Melamine Faced Chipboard',
    category: 'ENGINEERED_BOARD',
    subcategory: 'MFC_MELAMINE_FACED_CHIPBOARD',
    uom: 'sheet',
    suppliers: ['PG Bison (U) Limited'],
    supplier_locations: ['Plot 121, 7th Street, Industrial Area'],
    primary_uses: 'Cabinetry, wardrobes, kitchen units, office furniture, shelving',
    notes: '18mm carries full decor range (40+ colours). 16mm only in Super White. 22mm in 14 curated decors.',
    sheet_width_mm: 1830,
    sheet_length_mm: 2750,
    variants: [
      { size_label: '2750x1830x16mm', thickness_mm: 16, sheet_area_m2: 5.03, volume_m3: 0.0806, finish: 'Peen', colour_options: 'Super White only', est_price_ugx: null },
      { size_label: '2750x1830x18mm', thickness_mm: 18, sheet_area_m2: 5.03, volume_m3: 0.0906, finish: 'Peen/Fusion/Linear/Natural Touch', colour_options: '40+ decors (see full catalog)', est_price_ugx: null },
      { size_label: '2750x1830x22mm', thickness_mm: 22, sheet_area_m2: 5.03, volume_m3: 0.1107, finish: 'Peen/Fusion/Natural Touch', colour_options: '14 curated decors', est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'BRD-MDF-PG',
    name: 'PG Bison SupaWood Plain MDF',
    local_name: 'Medium Density Fibreboard',
    category: 'ENGINEERED_BOARD',
    subcategory: 'MDF_RAW',
    uom: 'sheet',
    suppliers: ['PG Bison (U) Limited'],
    supplier_locations: ['Plot 121, 7th Street, Industrial Area'],
    primary_uses: 'Spray painting, PVC wrap, veneering, furniture components',
    notes: '',
    sheet_width_mm: 1830,
    sheet_length_mm: 2750,
    variants: [
      { size_label: '2750x1830x3mm',  thickness_mm: 3,  sheet_area_m2: 5.03, volume_m3: 0.0151, est_price_ugx: null },
      { size_label: '2750x1830x6mm',  thickness_mm: 6,  sheet_area_m2: 5.03, volume_m3: 0.0302, est_price_ugx: null },
      { size_label: '2750x1830x9mm',  thickness_mm: 9,  sheet_area_m2: 5.03, volume_m3: 0.0453, est_price_ugx: null },
      { size_label: '2750x1830x12mm', thickness_mm: 12, sheet_area_m2: 5.03, volume_m3: 0.0604, est_price_ugx: null },
      { size_label: '2750x1830x18mm', thickness_mm: 18, sheet_area_m2: 5.03, volume_m3: 0.0906, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'BRD-PLY-NP',
    name: 'Nile Ply Plywood',
    local_name: 'Plywood',
    category: 'ENGINEERED_BOARD',
    subcategory: 'PLYWOOD',
    uom: 'sheet',
    suppliers: ['Nile Plywoods (U) Ltd'],
    supplier_locations: ['Plot 15/17 Nkrumah Road', 'Plot 142/148, 6th Street Industrial Area'],
    primary_uses: 'Furniture, cabinetry, construction, formwork',
    notes: '',
    sheet_width_mm: 1220,
    sheet_length_mm: 2440,
    variants: [
      { size_label: '2440x1220x3mm',  thickness_mm: 3,  sheet_area_m2: 2.98, volume_m3: 0.0089, est_price_ugx: 8500 },
      { size_label: '2440x1220x6mm',  thickness_mm: 6,  sheet_area_m2: 2.98, volume_m3: 0.0179, est_price_ugx: 25000 },
      { size_label: '2440x1220x9mm',  thickness_mm: 9,  sheet_area_m2: 2.98, volume_m3: 0.0268, est_price_ugx: null },
      { size_label: '2440x1220x12mm', thickness_mm: 12, sheet_area_m2: 2.98, volume_m3: 0.0357, est_price_ugx: null },
      { size_label: '2440x1220x18mm', thickness_mm: 18, sheet_area_m2: 2.98, volume_m3: 0.0536, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'BRD-BLK-NP',
    name: 'Nile Ply Block Board',
    local_name: 'Block Board',
    category: 'ENGINEERED_BOARD',
    subcategory: 'BLOCKBOARD',
    uom: 'sheet',
    suppliers: ['Nile Plywoods (U) Ltd'],
    supplier_locations: ['Plot 15/17 Nkrumah Road'],
    primary_uses: 'Long tables, shelves, doors, partitions',
    notes: '',
    sheet_width_mm: 1220,
    sheet_length_mm: 2440,
    variants: [
      { size_label: '2440x1220x12mm', thickness_mm: 12, sheet_area_m2: 2.98, volume_m3: 0.0357, est_price_ugx: null },
      { size_label: '2440x1220x18mm', thickness_mm: 18, sheet_area_m2: 2.98, volume_m3: 0.0536, est_price_ugx: null },
      { size_label: '2440x1220x25mm', thickness_mm: 25, sheet_area_m2: 2.98, volume_m3: 0.0745, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'BRD-MDF-NP',
    name: 'Nile Ply MDF',
    local_name: 'Medium Density Fibreboard',
    category: 'ENGINEERED_BOARD',
    subcategory: 'MDF_RAW',
    uom: 'sheet',
    suppliers: ['Nile Fibreboard Ltd'],
    supplier_locations: ['Plot 15/17 Nkrumah Road'],
    primary_uses: 'Furniture, partitions, walling',
    notes: '',
    sheet_width_mm: 1220,
    sheet_length_mm: 2440,
    variants: [
      { size_label: '2440x1220x6mm',  thickness_mm: 6,  sheet_area_m2: 2.98, volume_m3: 0.0179, est_price_ugx: null },
      { size_label: '2440x1220x9mm',  thickness_mm: 9,  sheet_area_m2: 2.98, volume_m3: 0.0268, est_price_ugx: null },
      { size_label: '2440x1220x12mm', thickness_mm: 12, sheet_area_m2: 2.98, volume_m3: 0.0357, est_price_ugx: null },
      { size_label: '2440x1220x18mm', thickness_mm: 18, sheet_area_m2: 2.98, volume_m3: 0.0536, est_price_ugx: 53000 },
      { size_label: '2440x1220x25mm', thickness_mm: 25, sheet_area_m2: 2.98, volume_m3: 0.0745, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'BRD-PB-NP',
    name: 'Nile Ply Particle Board',
    local_name: 'Particle Board',
    category: 'ENGINEERED_BOARD',
    subcategory: 'PARTICLEBOARD',
    uom: 'sheet',
    suppliers: ['Nile Plywoods (U) Ltd'],
    supplier_locations: ['Plot 15/17 Nkrumah Road'],
    primary_uses: 'Furniture, insulation, sound deadening',
    notes: '',
    sheet_width_mm: 1220,
    sheet_length_mm: 2440,
    variants: [
      { size_label: '2440x1220x9mm',  thickness_mm: 9,  sheet_area_m2: 2.98, volume_m3: 0.0268, est_price_ugx: null },
      { size_label: '2440x1220x12mm', thickness_mm: 12, sheet_area_m2: 2.98, volume_m3: 0.0357, est_price_ugx: null },
      { size_label: '2440x1220x16mm', thickness_mm: 16, sheet_area_m2: 2.98, volume_m3: 0.0476, est_price_ugx: null },
      { size_label: '2440x1220x18mm', thickness_mm: 18, sheet_area_m2: 2.98, volume_m3: 0.0536, est_price_ugx: null },
    ],
  },

  // ── PAINT AND FINISH ──
  {
    sku_prefix: 'PNT-NC-LAC',
    name: 'Plascon NC Furniture Lacquer',
    local_name: 'NC Lacquer',
    category: 'PAINT_AND_FINISH',
    subcategory: 'NC_LACQUER',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'Furniture top coat, cabinet finishing',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'PNT-NC-SEAL',
    name: 'Plascon NC Sanding Sealer',
    local_name: 'NC Sanding Sealer',
    category: 'PAINT_AND_FINISH',
    subcategory: 'SEALER',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'Base coat grain filler before lacquer/varnish',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'PNT-PLASCRYL',
    name: 'Plascryl 2K Acrylic Refinish',
    local_name: '2K Acrylic',
    category: 'PAINT_AND_FINISH',
    subcategory: '2K_ACRYLIC',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'High-quality furniture finish, automotive refinish. Mix 4:1 with hardener.',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'PNT-PRIMER-WOOD',
    name: 'Plascon Wood Primer',
    local_name: 'Wood Primer',
    category: 'PAINT_AND_FINISH',
    subcategory: 'PRIMER',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'First coat on bare timber before finishing',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: null },
      { size_label: '20L', volume_litres: 20, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'THN-HG',
    name: 'Plascon High Gloss Thinner',
    local_name: 'High Gloss Thinner',
    category: 'PAINT_AND_FINISH',
    subcategory: 'THINNER',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'Diluting NC lacquers and NC furniture lacquer',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'THN-WS',
    name: 'Plascon White Spirit',
    local_name: 'White Spirit',
    category: 'PAINT_AND_FINISH',
    subcategory: 'THINNER',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'Diluting alkyd enamels, varnishes, primers',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: null },
      { size_label: '20L', volume_litres: 20, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'THN-ENAMEL',
    name: 'Plascon Enamel Thinner',
    local_name: 'Enamel Thinner',
    category: 'PAINT_AND_FINISH',
    subcategory: 'THINNER',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'Diluting synthetic enamels',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: null },
      { size_label: '20L', volume_litres: 20, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'THN-PLASCRYL',
    name: 'Plascryl Thinner',
    local_name: 'Plascryl Thinner',
    category: 'PAINT_AND_FINISH',
    subcategory: 'THINNER',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'Diluting Plascryl 2K acrylic system',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '5L',  volume_litres: 5,  est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'PNT-VSE',
    name: 'Plascon Vinyl Silk Emulsion',
    local_name: 'Vinyl Silk Emulsion',
    category: 'PAINT_AND_FINISH',
    subcategory: 'WALL_PAINT',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'Interior wall paint',
    notes: '',
    variants: [
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: 86000 },
      { size_label: '20L', volume_litres: 20, est_price_ugx: 350000 },
    ],
  },
  {
    sku_prefix: 'PNT-SGE',
    name: 'Plascon Super Gloss Enamel',
    local_name: 'Super Gloss Enamel',
    category: 'PAINT_AND_FINISH',
    subcategory: 'ENAMEL',
    uom: 'tin',
    suppliers: ['Kansai Plascon Uganda Ltd'],
    supplier_locations: [],
    primary_uses: 'Wood and metal finishing, doors, window frames',
    notes: '',
    variants: [
      { size_label: '1L',  volume_litres: 1,  est_price_ugx: null },
      { size_label: '4L',  volume_litres: 4,  est_price_ugx: 90000 },
      { size_label: '20L', volume_litres: 20, est_price_ugx: 480000 },
    ],
  },
  {
    sku_prefix: 'PNT-SAD-NCSEAL',
    name: 'Sadolin NC Sanding Sealer',
    local_name: 'Sadolin NC Sealer',
    category: 'PAINT_AND_FINISH',
    subcategory: 'SEALER',
    uom: 'tin',
    suppliers: ['Sadolin Paints (U) Ltd'],
    supplier_locations: ['Freedom City', 'Ntinda', 'Industrial Area', 'Church House'],
    primary_uses: 'Wood sealing before lacquer. Mix 1:2 with NC Thinner.',
    notes: '',
    variants: [
      { size_label: '0.5L', volume_litres: 0.5, est_price_ugx: null },
      { size_label: '1L',   volume_litres: 1,   est_price_ugx: null },
      { size_label: '4L',   volume_litres: 4,   est_price_ugx: null },
      { size_label: '20L',  volume_litres: 20,  est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'PNT-SWC-NCLAC',
    name: 'SWECO NC Lacquer',
    local_name: 'SWECO NC Lacquer',
    category: 'PAINT_AND_FINISH',
    subcategory: 'NC_LACQUER',
    uom: 'tin',
    suppliers: ['Seweco Industrial Coatings Ltd'],
    supplier_locations: ['Plot 63, 8th Street, Namuwongo Road, Industrial Area'],
    primary_uses: 'Furniture lacquer finish (clear, semi-matt, dead-matt)',
    notes: 'Distributor: Raek Chemicals Ltd, +256 778 952095',
    variants: [
      { size_label: '1L', volume_litres: 1, est_price_ugx: null },
      { size_label: '4L', volume_litres: 4, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'PNT-SADOCRYL',
    name: 'Sadocryl 2K Acrylic Enamel',
    local_name: 'Sadocryl 2K',
    category: 'PAINT_AND_FINISH',
    subcategory: '2K_ACRYLIC',
    uom: 'tin',
    suppliers: ['Seweco Industrial Coatings Ltd'],
    supplier_locations: ['Plot 63, 8th Street, Namuwongo Road, Industrial Area'],
    primary_uses: 'High-quality furniture and automotive finish',
    notes: 'Sold by weight (kg). Distributor: Raek Chemicals Ltd. Available in Clear, Black, White, Gold, Copper, Violet, Maroon + custom.',
    variants: [
      { size_label: '1kg',  weight_kg: 1,  est_price_ugx: null },
      { size_label: '4kg',  weight_kg: 4,  est_price_ugx: null },
      { size_label: '20kg', weight_kg: 20, est_price_ugx: null },
    ],
  },

  // ── FASTENERS ──
  {
    sku_prefix: 'FST-BN18',
    name: 'Ingco 18-Gauge Brad Nails',
    local_name: '18ga Brad Nails',
    category: 'FASTENERS',
    subcategory: 'BRAD_NAILS',
    uom: 'box',
    suppliers: ['Ingco Uganda (official store)', 'Aafrin International'],
    supplier_locations: ['Kampala Road', 'Plot 70, 6th Street Industrial Area'],
    primary_uses: 'Trim, moulding, light assembly',
    notes: 'Wire size: 1.25 x 1.0mm. Galvanized steel.',
    variants: [
      { size_label: '20mm',  model: 'ANA18201', length_mm: 20, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '25mm',  model: 'ANA18251', length_mm: 25, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '30mm',  model: 'ANA18301', length_mm: 30, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '35mm',  model: 'ANA18351', length_mm: 35, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '40mm',  model: 'ANA18401', length_mm: 40, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '50mm',  model: 'ANA18501', length_mm: 50, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '50mm (6000pk)', model: 'ANA18506', length_mm: 50, qty_per_box: 6000, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'FST-STP-HD',
    name: 'Ingco Heavy-Duty Staples',
    local_name: 'Heavy-Duty Staples (1.2mm wire)',
    category: 'FASTENERS',
    subcategory: 'STAPLES_MANUAL',
    uom: 'box',
    suppliers: ['Ingco Uganda'],
    supplier_locations: ['Kampala Road'],
    primary_uses: 'Upholstery, insulation, light woodwork',
    notes: 'Wire: 1.2mm, Crown: 11.3mm, ~18ga. Compatible guns: HSG1404, HSG1405, HSG1406.',
    variants: [
      { size_label: '8mm',  model: 'STS0208', leg_length_mm: 8,  qty_per_box: 1000, est_price_ugx: null },
      { size_label: '10mm', model: 'STS0210', leg_length_mm: 10, qty_per_box: 1000, est_price_ugx: null },
      { size_label: '12mm', model: 'STS0212', leg_length_mm: 12, qty_per_box: 1000, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'FST-MT-10J',
    name: 'Meite 10J Series 20ga Upholstery Staples',
    local_name: '10J Upholstery Staples',
    category: 'FASTENERS',
    subcategory: 'STAPLES_PNEUMATIC',
    uom: 'box',
    suppliers: ['Direct import (Alibaba/meiteusa.com)'],
    supplier_locations: [],
    primary_uses: 'Fabric-to-frame on sofas, chairs, cushions',
    notes: '20ga, Crown: 11.2mm (7/16"). Galvanized steel. Compatible staplers: 1013J (6-12mm), 1022J (12-22mm).',
    variants: [
      { size_label: '6mm',  leg_length_mm: 6,  qty_per_box: 5000, est_price_ugx: null },
      { size_label: '8mm',  leg_length_mm: 8,  qty_per_box: 5000, est_price_ugx: null },
      { size_label: '10mm', leg_length_mm: 10, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '12mm', leg_length_mm: 12, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '16mm', leg_length_mm: 16, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '19mm', leg_length_mm: 19, qty_per_box: 5000, est_price_ugx: null },
      { size_label: '22mm', leg_length_mm: 22, qty_per_box: 5000, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'FST-MT-92',
    name: 'Meite 92 Series 18ga Medium Crown Staples',
    local_name: '92 Series Staples',
    category: 'FASTENERS',
    subcategory: 'STAPLES_PNEUMATIC',
    uom: 'case',
    suppliers: ['Direct import'],
    supplier_locations: [],
    primary_uses: 'Mattress, bedding, foam attachment',
    notes: '18ga, Crown: 8.0mm (5/16"). Galvanized steel. Compatible stapler: 9240B.',
    variants: [
      { size_label: '19mm', leg_length_mm: 19, qty_per_case: 20000, est_price_ugx: null },
      { size_label: '25mm', leg_length_mm: 25, qty_per_case: 20000, est_price_ugx: null },
      { size_label: '32mm', leg_length_mm: 32, qty_per_case: 20000, est_price_ugx: null },
      { size_label: '40mm', leg_length_mm: 40, qty_per_case: 20000, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'FST-WN',
    name: 'Roofings Elephant Brand Common Wire Nails',
    local_name: 'Wire Nails',
    category: 'FASTENERS',
    subcategory: 'WIRE_NAILS',
    uom: 'kg',
    suppliers: ['Roofings Group'],
    supplier_locations: ['Channel Lane', 'Market Street', 'Arua Park'],
    primary_uses: 'General construction, framing, formwork',
    notes: 'Mild steel, polished bright, diamond point. Standard: US 194-1.',
    variants: [
      { size_label: '1in (25mm)',    length_in: 1,   length_mm: 25,  wire_dia_mm: 2.0, est_price_per_kg_ugx: 10000 },
      { size_label: '1.5in (38mm)',  length_in: 1.5, length_mm: 38,  wire_dia_mm: 2.5, est_price_per_kg_ugx: 4860 },
      { size_label: '2in (50mm)',    length_in: 2,   length_mm: 50,  wire_dia_mm: 3.0, est_price_per_kg_ugx: 4790 },
      { size_label: '2.5in (63mm)',  length_in: 2.5, length_mm: 63,  wire_dia_mm: 3.5, est_price_per_kg_ugx: 4530 },
      { size_label: '3in (75mm)',    length_in: 3,   length_mm: 75,  wire_dia_mm: 4.0, est_price_per_kg_ugx: 4530 },
      { size_label: '4in (100mm)',   length_in: 4,   length_mm: 100, wire_dia_mm: 5.0, est_price_per_kg_ugx: 4530 },
      { size_label: '5in (125mm)',   length_in: 5,   length_mm: 125, wire_dia_mm: 5.5, est_price_per_kg_ugx: 4530 },
      { size_label: '6in (150mm)',   length_in: 6,   length_mm: 150, wire_dia_mm: 5.9, est_price_per_kg_ugx: 4530 },
    ],
  },

  // ── STEEL SECTIONS ──
  {
    sku_prefix: 'STL-SHS',
    name: 'Roofings SHS (Square Hollow Section)',
    local_name: 'SHS Steel Tube',
    category: 'STEEL_SECTIONS',
    subcategory: 'SHS',
    uom: 'length',
    suppliers: ['Roofings Rolling Mills'],
    supplier_locations: ['Roofings Superstores'],
    primary_uses: 'Furniture frames, gates, windows, structural',
    notes: 'Grade 210 mild steel (JIS G 3444). Black (mill finish). Standard length: 6m.',
    variants: [
      { size_label: '20x20x1.5mm',  dim_mm: '20x20',  wall_mm: 1.5, weight_kg_per_m: 0.91,  weight_per_6m_kg: 5.5, est_price_ugx: null },
      { size_label: '25x25x1.5mm',  dim_mm: '25x25',  wall_mm: 1.5, weight_kg_per_m: 1.17,  weight_per_6m_kg: 7.0, est_price_ugx: null },
      { size_label: '25x25x2.0mm',  dim_mm: '25x25',  wall_mm: 2.0, weight_kg_per_m: 1.53,  weight_per_6m_kg: 9.2, est_price_ugx: null },
      { size_label: '30x30x1.5mm',  dim_mm: '30x30',  wall_mm: 1.5, weight_kg_per_m: 1.39,  weight_per_6m_kg: 8.3, est_price_ugx: null },
      { size_label: '30x30x2.0mm',  dim_mm: '30x30',  wall_mm: 2.0, weight_kg_per_m: 1.82,  weight_per_6m_kg: 10.9, est_price_ugx: null },
      { size_label: '40x40x1.5mm',  dim_mm: '40x40',  wall_mm: 1.5, weight_kg_per_m: 1.75,  weight_per_6m_kg: 10.5, est_price_ugx: null },
      { size_label: '40x40x2.0mm',  dim_mm: '40x40',  wall_mm: 2.0, weight_kg_per_m: 2.29,  weight_per_6m_kg: 13.7, est_price_ugx: null },
      { size_label: '50x50x2.0mm',  dim_mm: '50x50',  wall_mm: 2.0, weight_kg_per_m: 3.01,  weight_per_6m_kg: 18.1, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'STL-RHS',
    name: 'Roofings RHS (Rectangular Hollow Section)',
    local_name: 'RHS Steel Tube',
    category: 'STEEL_SECTIONS',
    subcategory: 'RHS',
    uom: 'length',
    suppliers: ['Roofings Rolling Mills'],
    supplier_locations: ['Roofings Superstores'],
    primary_uses: 'Furniture frames, structural, gates',
    notes: 'Grade 210 mild steel (JIS G 3444). Black (mill finish). Standard length: 6m.',
    variants: [
      { size_label: '40x20x1.5mm',  dim_mm: '40x20',  wall_mm: 1.5, weight_kg_per_m: 1.39,  weight_per_6m_kg: 8.3, est_price_ugx: null },
      { size_label: '40x20x2.0mm',  dim_mm: '40x20',  wall_mm: 2.0, weight_kg_per_m: 1.82,  weight_per_6m_kg: 10.9, est_price_ugx: null },
      { size_label: '50x25x1.5mm',  dim_mm: '50x25',  wall_mm: 1.5, weight_kg_per_m: 1.75,  weight_per_6m_kg: 10.5, est_price_ugx: null },
      { size_label: '50x25x2.0mm',  dim_mm: '50x25',  wall_mm: 2.0, weight_kg_per_m: 2.29,  weight_per_6m_kg: 13.7, est_price_ugx: null },
      { size_label: '60x40x2.0mm',  dim_mm: '60x40',  wall_mm: 2.0, weight_kg_per_m: 3.01,  weight_per_6m_kg: 18.1, est_price_ugx: null },
      { size_label: '80x40x1.5mm',  dim_mm: '80x40',  wall_mm: 1.5, weight_kg_per_m: 2.77,  weight_per_6m_kg: 16.6, est_price_ugx: null },
    ],
  },
  {
    sku_prefix: 'STL-RND',
    name: 'Roofings ERW Round Tube',
    local_name: 'Round Steel Tube',
    category: 'STEEL_SECTIONS',
    subcategory: 'ROUND_TUBE',
    uom: 'length',
    suppliers: ['Roofings Rolling Mills'],
    supplier_locations: ['Roofings Superstores'],
    primary_uses: 'Chair legs, towel rails, decorative frames, handrails',
    notes: 'Grade 210 mild steel (JIS G 3444). Black (mill finish). Standard length: 6m.',
    variants: [
      { size_label: '25mm OD x 1.5mm', od_mm: 25, wall_mm: 1.5, weight_kg_per_m: 0.87, weight_per_6m_kg: 5.2, est_price_ugx: null },
      { size_label: '32mm OD x 1.5mm', od_mm: 32, wall_mm: 1.5, weight_kg_per_m: 1.13, weight_per_6m_kg: 6.8, est_price_ugx: null },
      { size_label: '38mm OD x 1.5mm', od_mm: 38, wall_mm: 1.5, weight_kg_per_m: 1.35, weight_per_6m_kg: 8.1, est_price_ugx: null },
      { size_label: '42mm OD x 2.0mm', od_mm: 42, wall_mm: 2.0, weight_kg_per_m: 1.97, weight_per_6m_kg: 11.8, est_price_ugx: null },
      { size_label: '48mm OD x 2.0mm', od_mm: 48, wall_mm: 2.0, weight_kg_per_m: 2.27, weight_per_6m_kg: 13.6, est_price_ugx: null },
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
    .replace(/\s*timber$/i, '')
    .replace(/\s*board$/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim();
}

/**
 * Build variant attributes array from a variant object based on category.
 */
function buildVariantAttributes(seedCategory, variant) {
  const attrs = [];

  if (seedCategory === 'SOLID_TIMBER') {
    if (variant.width_in != null) attrs.push({ key: 'width_in', value: String(variant.width_in) });
    if (variant.thickness_in != null) attrs.push({ key: 'thickness_in', value: String(variant.thickness_in) });
    if (variant.length_ft != null) attrs.push({ key: 'length_ft', value: String(variant.length_ft) });
  } else if (seedCategory === 'ENGINEERED_BOARD') {
    if (variant.thickness_mm != null) attrs.push({ key: 'thickness_mm', value: String(variant.thickness_mm) });
  } else if (seedCategory === 'PAINT_AND_FINISH') {
    attrs.push({ key: 'volume', value: variant.size_label });
  } else if (seedCategory === 'FASTENERS') {
    attrs.push({ key: 'size_label', value: variant.size_label });
  } else if (seedCategory === 'STEEL_SECTIONS') {
    attrs.push({ key: 'size_label', value: variant.size_label });
  }

  return attrs;
}

/**
 * Build parametric tags (extra metadata) from a variant based on category.
 */
function buildParametricTags(seedCategory, variant, parent) {
  const tags = {};

  if (seedCategory === 'SOLID_TIMBER') {
    if (variant.volume_ft3 != null) tags.volume_ft3 = String(variant.volume_ft3);
    if (variant.volume_m3 != null) tags.volume_m3 = String(variant.volume_m3);
    if (variant.width_mm != null) tags.width_mm = String(variant.width_mm);
    if (variant.thickness_mm != null) tags.thickness_mm = String(variant.thickness_mm);
    if (variant.length_mm != null) tags.length_mm = String(variant.length_mm);
  } else if (seedCategory === 'ENGINEERED_BOARD') {
    if (variant.sheet_area_m2 != null) tags.sheet_area_m2 = String(variant.sheet_area_m2);
    if (variant.volume_m3 != null) tags.volume_m3 = String(variant.volume_m3);
    if (variant.finish) tags.finish = variant.finish;
    if (variant.colour_options) tags.colour_options = variant.colour_options;
  } else if (seedCategory === 'PAINT_AND_FINISH') {
    if (variant.volume_litres != null) tags.volume_litres = String(variant.volume_litres);
    if (variant.weight_kg != null) tags.weight_kg = String(variant.weight_kg);
  } else if (seedCategory === 'FASTENERS') {
    if (variant.model) tags.model = variant.model;
    if (variant.length_mm != null) tags.length_mm = String(variant.length_mm);
    if (variant.leg_length_mm != null) tags.leg_length_mm = String(variant.leg_length_mm);
    if (variant.qty_per_box != null) tags.qty_per_box = String(variant.qty_per_box);
    if (variant.qty_per_case != null) tags.qty_per_case = String(variant.qty_per_case);
    if (variant.wire_dia_mm != null) tags.wire_dia_mm = String(variant.wire_dia_mm);
    if (variant.length_in != null) tags.length_in = String(variant.length_in);
  } else if (seedCategory === 'STEEL_SECTIONS') {
    if (variant.dim_mm) tags.dim_mm = variant.dim_mm;
    if (variant.od_mm != null) tags.od_mm = String(variant.od_mm);
    if (variant.wall_mm != null) tags.wall_mm = String(variant.wall_mm);
    if (variant.weight_kg_per_m != null) tags.weight_kg_per_m = String(variant.weight_kg_per_m);
    if (variant.weight_per_6m_kg != null) tags.weight_per_6m_kg = String(variant.weight_per_6m_kg);
  }

  return tags;
}

/**
 * Build dimensions object for sheet-goods variants.
 */
function buildDimensions(seedCategory, variant, parent) {
  if (seedCategory === 'ENGINEERED_BOARD' && parent.sheet_width_mm && parent.sheet_length_mm) {
    return {
      length: parent.sheet_length_mm,
      width: parent.sheet_width_mm,
      thickness: variant.thickness_mm || 0,
    };
  }
  if (seedCategory === 'SOLID_TIMBER') {
    return {
      length: variant.length_mm || 0,
      width: variant.width_mm || 0,
      thickness: variant.thickness_mm || 0,
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

  // Description from primary_uses + notes
  const descParts = [];
  if (seedItem.primary_uses) descParts.push(`Uses: ${seedItem.primary_uses}`);
  if (seedItem.notes) descParts.push(seedItem.notes);
  const desc = descParts.join('. ');
  setIfEmpty('description', desc);

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

  // Dimensions for sheet goods (parent level)
  if (seedItem.category === 'ENGINEERED_BOARD' && seedItem.sheet_width_mm) {
    if (!existingData.dimensions || FORCE) {
      update.dimensions = {
        length: seedItem.sheet_length_mm,
        width: seedItem.sheet_width_mm,
        thickness: 0,
      };
    }
  }

  // Parametric tags
  const pTags = {};
  if (seedItem.timber_class) pTags.timber_class = seedItem.timber_class;
  if (seedItem.local_name) pTags.local_name = seedItem.local_name;
  if (seedItem.suppliers) pTags.suppliers = seedItem.suppliers.join(', ');
  if (seedItem.supplier_locations && seedItem.supplier_locations.length > 0) {
    pTags.supplier_locations = seedItem.supplier_locations.join(', ');
  }
  if (seedItem.sku_prefix) pTags.seed_sku_prefix = seedItem.sku_prefix;

  if (Object.keys(pTags).length > 0) {
    const existingPTags = existingData.parametricTags || {};
    update.parametricTags = { ...existingPTags, ...pTags };
  }

  // Tags — merge
  const existingTags = existingData.tags || [];
  const newTags = new Set(existingTags);
  newTags.add(SEED_TAG);
  if (seedItem.subcategory) newTags.add(seedItem.subcategory.toLowerCase().replace(/_/g, '-'));
  if (seedItem.local_name) newTags.add(seedItem.local_name.toLowerCase());
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
 * Get the pricing cost for a variant.
 * Wire nails use est_price_per_kg_ugx, everything else uses est_price_ugx.
 */
function getVariantCost(variant) {
  if (variant.est_price_ugx != null) return variant.est_price_ugx;
  if (variant.est_price_per_kg_ugx != null) return variant.est_price_per_kg_ugx;
  return 0;
}

/**
 * Build a complete new family document.
 */
function buildNewFamilyDoc(seedItem, familyId, skuIds) {
  const category = CATEGORY_MAP[seedItem.category];
  const mappedUom = UOM_MAP[seedItem.uom] || seedItem.uom;
  const attrDefs = VARIANT_ATTR_DEFS[seedItem.category] || [];

  const descParts = [];
  if (seedItem.primary_uses) descParts.push(`Uses: ${seedItem.primary_uses}`);
  if (seedItem.notes) descParts.push(seedItem.notes);

  const tags = [SEED_TAG];
  if (seedItem.subcategory) tags.push(seedItem.subcategory.toLowerCase().replace(/_/g, '-'));
  if (seedItem.local_name) tags.push(seedItem.local_name.toLowerCase());
  for (const loc of (seedItem.supplier_locations || [])) {
    tags.push(loc.toLowerCase());
  }

  const pTags = {};
  if (seedItem.timber_class) pTags.timber_class = seedItem.timber_class;
  if (seedItem.local_name) pTags.local_name = seedItem.local_name;
  if (seedItem.suppliers) pTags.suppliers = seedItem.suppliers.join(', ');
  if (seedItem.supplier_locations && seedItem.supplier_locations.length > 0) {
    pTags.supplier_locations = seedItem.supplier_locations.join(', ');
  }
  pTags.seed_sku_prefix = seedItem.sku_prefix;

  const doc = {
    sku: seedItem.sku_prefix,
    name: seedItem.name,
    displayName: seedItem.name,
    description: descParts.join('. '),
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
      currency: 'UGX',
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

  // Dimensions for sheet goods at parent level
  if (seedItem.category === 'ENGINEERED_BOARD' && seedItem.sheet_width_mm) {
    doc.dimensions = {
      length: seedItem.sheet_length_mm,
      width: seedItem.sheet_width_mm,
      thickness: 0,
    };
  }

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
  const cost = getVariantCost(variant);
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
      currency: 'UGX',
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
  console.log('=== Seed Finish Library Materials ===\n');

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

    // Also try matching by local_name or by sku_prefix in existing parametricTags
    let bestMatch = null;
    if (matches.length === 1) {
      bestMatch = matches[0];
    } else if (matches.length > 1) {
      // Prefer family items over flat items
      bestMatch = matches.find(m => m.data.isFamily) || matches[0];
    } else {
      // Try matching by local_name
      const localNorm = normalizeName(seedItem.local_name);
      const localMatches = nameLookup.get(localNorm) || [];
      if (localMatches.length === 1) {
        bestMatch = localMatches[0];
      } else if (localMatches.length > 1) {
        bestMatch = localMatches.find(m => m.data.isFamily) || localMatches[0];
      }
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
            const cost = getVariantCost(matchedVariant);
            if (cost > 0 && (FORCE || !child.data.pricing?.costPerUnit)) {
              childUpdate['pricing.costPerUnit'] = cost;
              childUpdate['pricing.currency'] = 'UGX';
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
