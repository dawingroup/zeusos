/**
 * Finish Attribute Definition Types
 * Registry of attribute schemas per material category.
 * Tells the UI which fields to render when specifying a product
 * of a given category (e.g., boards need thickness, sheet size, grade).
 *
 * Collection: `finishAttributeDefinitions`
 */

import { Timestamp } from 'firebase/firestore';
import type { FinishCategory, FinishSubtype } from './finishLibrary';

// ============================================
// Attribute Definition
// ============================================

export type AttributeValueType = 'string' | 'number' | 'boolean' | 'enum' | 'number_array';

/**
 * Defines a single attribute that can be required for products
 * in a given finish category. This is NOT per-product — it's
 * per-category/subtype so all boards share the same attribute schema.
 *
 * ⚠️ The `key` field is IMMUTABLE once created. It is referenced by
 * product requiredAttributes, attributeConstraints, variant attributes,
 * and variant keys. Renaming breaks all referencing data.
 */
export interface AttributeDefinition {
  id: string;
  organizationId: string;

  key: string;                           // "thickness_mm" — IMMUTABLE once created
  label: string;                         // "Thickness (mm)"
  type: AttributeValueType;
  enumValues?: (string | number)[];      // allowed values if type is 'enum'
  unit?: string;                         // "mm", "litres"
  required: boolean;
  defaultValue?: string | number | boolean;
  category: FinishCategory[];            // which categories use this
  subtype?: FinishSubtype[];             // optional narrower scoping
  sortOrder: number;
  validationMin?: number;
  validationMax?: number;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

// ============================================
// Seed Data
// ============================================

/**
 * Seed attribute definitions for Board products.
 * Used by `seedDefaultAttributes` in finishAttributeService.
 */
export const BOARD_ATTRIBUTE_SEEDS: Omit<AttributeDefinition, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] = [
  {
    key: 'thickness_mm',
    label: 'Thickness (mm)',
    type: 'enum',
    enumValues: [3, 6, 9, 12, 16, 18, 25, 32],
    unit: 'mm',
    required: true,
    category: ['board'],
    sortOrder: 1,
  },
  {
    key: 'sheet_width_mm',
    label: 'Sheet Width (mm)',
    type: 'enum',
    enumValues: [1220, 1525, 1830],
    unit: 'mm',
    required: true,
    category: ['board'],
    sortOrder: 2,
  },
  {
    key: 'sheet_length_mm',
    label: 'Sheet Length (mm)',
    type: 'enum',
    enumValues: [2440, 2745, 3050, 3660],
    unit: 'mm',
    required: true,
    category: ['board'],
    sortOrder: 3,
  },
  {
    key: 'grade',
    label: 'Grade',
    type: 'enum',
    enumValues: ['A', 'B', 'commercial', 'marine'],
    required: false,
    category: ['board'],
    sortOrder: 4,
  },
  {
    key: 'core',
    label: 'Core Material',
    type: 'enum',
    enumValues: ['particle', 'mdf', 'plywood', 'solid'],
    required: false,
    category: ['board'],
    sortOrder: 5,
  },
  {
    key: 'face_type',
    label: 'Face Type',
    type: 'enum',
    enumValues: ['single_sided', 'double_sided', 'raw'],
    required: false,
    category: ['board'],
    sortOrder: 6,
  },
  {
    key: 'moisture_resistance',
    label: 'Moisture Resistant',
    type: 'boolean',
    required: false,
    defaultValue: false,
    category: ['board'],
    sortOrder: 7,
  },
  {
    key: 'fire_rating',
    label: 'Fire Rating',
    type: 'enum',
    enumValues: ['none', 'B1', 'Class_0'],
    required: false,
    category: ['board'],
    sortOrder: 8,
  },
];

/**
 * Seed attribute definitions for Paint products.
 */
export const PAINT_ATTRIBUTE_SEEDS: Omit<AttributeDefinition, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] = [
  {
    key: 'finish_sheen',
    label: 'Sheen',
    type: 'enum',
    enumValues: ['matte', 'eggshell', 'satin', 'semi_gloss', 'high_gloss'],
    required: true,
    category: ['paint'],
    sortOrder: 1,
  },
  {
    key: 'base_type',
    label: 'Base',
    type: 'enum',
    enumValues: ['water', 'oil', 'solvent'],
    required: true,
    category: ['paint'],
    sortOrder: 2,
  },
  {
    key: 'coverage_sqm_per_litre',
    label: 'Coverage (sqm/litre)',
    type: 'number',
    unit: 'sqm/litre',
    required: false,
    category: ['paint'],
    sortOrder: 3,
    validationMin: 0,
    validationMax: 100,
  },
  {
    key: 'coats_recommended',
    label: 'Coats Recommended',
    type: 'number',
    required: false,
    defaultValue: 2,
    category: ['paint'],
    sortOrder: 4,
    validationMin: 1,
    validationMax: 10,
  },
  {
    key: 'drying_time_hours',
    label: 'Drying Time (hrs)',
    type: 'number',
    unit: 'hours',
    required: false,
    category: ['paint'],
    sortOrder: 5,
    validationMin: 0,
  },
  {
    key: 'interior_exterior',
    label: 'Usage',
    type: 'enum',
    enumValues: ['interior', 'exterior', 'both'],
    required: false,
    category: ['paint'],
    sortOrder: 6,
  },
  {
    key: 'voc_level',
    label: 'VOC Level',
    type: 'enum',
    enumValues: ['zero', 'low', 'medium', 'high'],
    required: false,
    category: ['paint'],
    sortOrder: 7,
  },
  {
    key: 'container_size_litres',
    label: 'Container Size (L)',
    type: 'enum',
    enumValues: [1, 4, 5, 10, 20],
    unit: 'litres',
    required: true,
    category: ['paint'],
    sortOrder: 8,
  },
];

/**
 * Seed attribute definitions for Tile products.
 */
export const TILE_ATTRIBUTE_SEEDS: Omit<AttributeDefinition, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] = [
  {
    key: 'tile_width_mm',
    label: 'Tile Width (mm)',
    type: 'number',
    unit: 'mm',
    required: true,
    category: ['tile'],
    sortOrder: 1,
    validationMin: 10,
    validationMax: 2000,
  },
  {
    key: 'tile_length_mm',
    label: 'Tile Length (mm)',
    type: 'number',
    unit: 'mm',
    required: true,
    category: ['tile'],
    sortOrder: 2,
    validationMin: 10,
    validationMax: 2000,
  },
  {
    key: 'tile_thickness_mm',
    label: 'Thickness (mm)',
    type: 'number',
    unit: 'mm',
    required: false,
    category: ['tile'],
    sortOrder: 3,
    validationMin: 1,
    validationMax: 50,
  },
  {
    key: 'surface_finish',
    label: 'Surface',
    type: 'enum',
    enumValues: ['polished', 'matte', 'textured', 'lappato', 'rustic'],
    required: false,
    category: ['tile'],
    sortOrder: 4,
  },
  {
    key: 'usage',
    label: 'Usage',
    type: 'enum',
    enumValues: ['wall', 'floor', 'both'],
    required: false,
    category: ['tile'],
    sortOrder: 5,
  },
  {
    key: 'rectified',
    label: 'Rectified',
    type: 'boolean',
    required: false,
    defaultValue: false,
    category: ['tile'],
    sortOrder: 6,
  },
  {
    key: 'slip_resistance',
    label: 'Slip Rating',
    type: 'enum',
    enumValues: ['R9', 'R10', 'R11', 'R12', 'R13'],
    required: false,
    category: ['tile'],
    sortOrder: 7,
  },
  {
    key: 'pieces_per_box',
    label: 'Pieces/Box',
    type: 'number',
    required: false,
    category: ['tile'],
    sortOrder: 8,
    validationMin: 1,
  },
  {
    key: 'sqm_per_box',
    label: 'Sqm/Box',
    type: 'number',
    unit: 'sqm',
    required: false,
    category: ['tile'],
    sortOrder: 9,
    validationMin: 0,
  },
];

/**
 * Seed attribute definitions for Hardware products.
 */
export const HARDWARE_ATTRIBUTE_SEEDS: Omit<AttributeDefinition, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] = [
  {
    key: 'material',
    label: 'Material',
    type: 'enum',
    enumValues: ['steel', 'stainless_steel', 'brass', 'zinc', 'aluminium', 'plastic', 'nylon'],
    required: false,
    category: ['board'], // hardware items often use board category in Firestore
    sortOrder: 1,
  },
  {
    key: 'finish',
    label: 'Finish',
    type: 'enum',
    enumValues: ['nickel', 'chrome', 'brass', 'black', 'white', 'zinc', 'powder_coated', 'satin', 'polished'],
    required: false,
    category: ['board'],
    sortOrder: 2,
  },
  {
    key: 'size',
    label: 'Size',
    type: 'string',
    required: false,
    category: ['board'],
    sortOrder: 3,
  },
  {
    key: 'thread_type',
    label: 'Thread Type',
    type: 'enum',
    enumValues: ['M4', 'M5', 'M6', 'M8', 'M10', 'imperial'],
    required: false,
    category: ['board'],
    sortOrder: 4,
  },
  {
    key: 'drive_type',
    label: 'Drive Type',
    type: 'enum',
    enumValues: ['phillips', 'pozi', 'torx', 'hex', 'slot', 'square'],
    required: false,
    category: ['board'],
    sortOrder: 5,
  },
  {
    key: 'load_capacity_kg',
    label: 'Load Capacity (kg)',
    type: 'number',
    unit: 'kg',
    required: false,
    category: ['board'],
    sortOrder: 6,
    validationMin: 0,
  },
];

/**
 * Seed attribute definitions for Solid Wood products.
 */
export const SOLID_WOOD_ATTRIBUTE_SEEDS: Omit<AttributeDefinition, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] = [
  {
    key: 'species',
    label: 'Species',
    type: 'enum',
    enumValues: ['pine', 'oak', 'mahogany', 'walnut', 'maple', 'cherry', 'ash', 'beech', 'teak', 'iroko', 'mvule'],
    required: true,
    category: ['veneer'],
    sortOrder: 1,
  },
  {
    key: 'timber_grade',
    label: 'Timber Grade',
    type: 'enum',
    enumValues: ['select', 'FAS', '#1_common', '#2_common', 'utility'],
    required: false,
    category: ['veneer'],
    sortOrder: 2,
  },
  {
    key: 'timber_thickness_mm',
    label: 'Thickness (mm)',
    type: 'enum',
    enumValues: [12, 19, 25, 32, 38, 50, 75, 100],
    unit: 'mm',
    required: true,
    category: ['veneer'],
    sortOrder: 3,
  },
  {
    key: 'timber_width_mm',
    label: 'Width (mm)',
    type: 'number',
    unit: 'mm',
    required: false,
    category: ['veneer'],
    sortOrder: 4,
    validationMin: 10,
    validationMax: 500,
  },
  {
    key: 'timber_length_mm',
    label: 'Length (mm)',
    type: 'number',
    unit: 'mm',
    required: false,
    category: ['veneer'],
    sortOrder: 5,
    validationMin: 100,
    validationMax: 6000,
  },
  {
    key: 'moisture_content',
    label: 'Moisture Content (%)',
    type: 'number',
    unit: '%',
    required: false,
    category: ['veneer'],
    sortOrder: 6,
    validationMin: 0,
    validationMax: 100,
  },
  {
    key: 'grain_pattern',
    label: 'Grain Pattern',
    type: 'enum',
    enumValues: ['straight', 'interlocked', 'wavy', 'figured', 'burl', 'quarter_sawn'],
    required: false,
    category: ['veneer'],
    sortOrder: 7,
  },
];

/**
 * Seed attribute definitions for Edge Banding products.
 */
export const EDGE_BANDING_ATTRIBUTE_SEEDS: Omit<AttributeDefinition, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>[] = [
  {
    key: 'edge_width_mm',
    label: 'Width (mm)',
    type: 'enum',
    enumValues: [19, 22, 23, 25, 28, 33, 42, 45, 54],
    unit: 'mm',
    required: true,
    category: ['laminate'],
    sortOrder: 1,
  },
  {
    key: 'edge_thickness_mm',
    label: 'Thickness (mm)',
    type: 'enum',
    enumValues: [0.4, 0.8, 1.0, 1.5, 2.0, 3.0],
    unit: 'mm',
    required: true,
    category: ['laminate'],
    sortOrder: 2,
  },
  {
    key: 'edge_material',
    label: 'Material',
    type: 'enum',
    enumValues: ['PVC', 'ABS', 'melamine', 'veneer', 'acrylic', 'aluminium'],
    required: false,
    category: ['laminate'],
    sortOrder: 3,
  },
  {
    key: 'edge_color',
    label: 'Color',
    type: 'string',
    required: false,
    category: ['laminate'],
    sortOrder: 4,
  },
  {
    key: 'edge_pattern',
    label: 'Pattern',
    type: 'enum',
    enumValues: ['solid', 'woodgrain', 'metallic', 'high_gloss', 'textured'],
    required: false,
    category: ['laminate'],
    sortOrder: 5,
  },
  {
    key: 'glue_type',
    label: 'Glue Type',
    type: 'enum',
    enumValues: ['pre_glued', 'hot_melt', 'PUR', 'none'],
    required: false,
    category: ['laminate'],
    sortOrder: 6,
  },
];

/** All seed data combined for convenience */
export const ALL_ATTRIBUTE_SEEDS = [
  ...BOARD_ATTRIBUTE_SEEDS,
  ...PAINT_ATTRIBUTE_SEEDS,
  ...TILE_ATTRIBUTE_SEEDS,
  ...HARDWARE_ATTRIBUTE_SEEDS,
  ...SOLID_WOOD_ATTRIBUTE_SEEDS,
  ...EDGE_BANDING_ATTRIBUTE_SEEDS,
];
