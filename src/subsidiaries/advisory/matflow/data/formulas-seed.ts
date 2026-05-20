/**
 * MatFlow Formula Seed Data
 * Based on Ugandan construction standards
 * 
 * Note: Quantities may vary based on site conditions and specific requirements.
 * These are standard reference values.
 */

import { StandardFormula, MaterialCategory, MeasurementUnit } from '../types';

export const FORMULA_SEED_DATA: Omit<StandardFormula, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // ============================================================================
  // CONCRETE FORMULAS
  // ============================================================================
  {
    code: 'C15',
    name: 'Concrete Grade 15',
    description: 'Structural concrete for mass concrete, blinding, and lean mix. Mix ratio 1:3:6',
    category: MaterialCategory.CONCRETE,
    outputUnit: MeasurementUnit.CUBIC_METERS,
    components: [
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 5.5, unit: MeasurementUnit.BAGS, wastagePercent: 5 },
      { materialId: 'sand_coarse', materialName: 'Coarse Sand', quantity: 0.45, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 10 },
      { materialId: 'aggregate_20mm', materialName: 'Aggregate 20mm', quantity: 0.9, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 10 },
      { materialId: 'water', materialName: 'Water', quantity: 180, unit: MeasurementUnit.LITERS, wastagePercent: 5 },
    ],
    keywords: ['concrete', 'c15', 'grade 15', 'blinding', 'lean mix', 'mass concrete', '1:3:6'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'C20',
    name: 'Concrete Grade 20',
    description: 'Structural concrete for foundations, ground beams, and general use. Mix ratio 1:2:4',
    category: MaterialCategory.CONCRETE,
    outputUnit: MeasurementUnit.CUBIC_METERS,
    components: [
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 7, unit: MeasurementUnit.BAGS, wastagePercent: 5 },
      { materialId: 'sand_coarse', materialName: 'Coarse Sand', quantity: 0.4, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 10 },
      { materialId: 'aggregate_20mm', materialName: 'Aggregate 20mm', quantity: 0.8, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 10 },
      { materialId: 'water', materialName: 'Water', quantity: 160, unit: MeasurementUnit.LITERS, wastagePercent: 5 },
    ],
    keywords: ['concrete', 'c20', 'grade 20', 'foundation', 'ground beam', '1:2:4'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'C25',
    name: 'Concrete Grade 25',
    description: 'Structural concrete for columns, beams, slabs, and suspended structures. Mix ratio 1:1.5:3',
    category: MaterialCategory.CONCRETE,
    outputUnit: MeasurementUnit.CUBIC_METERS,
    components: [
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 8.5, unit: MeasurementUnit.BAGS, wastagePercent: 5 },
      { materialId: 'sand_coarse', materialName: 'Coarse Sand', quantity: 0.35, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 10 },
      { materialId: 'aggregate_20mm', materialName: 'Aggregate 20mm', quantity: 0.7, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 10 },
      { materialId: 'water', materialName: 'Water', quantity: 150, unit: MeasurementUnit.LITERS, wastagePercent: 5 },
    ],
    keywords: ['concrete', 'c25', 'grade 25', 'column', 'beam', 'slab', 'structural', '1:1.5:3'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'C30',
    name: 'Concrete Grade 30',
    description: 'High strength concrete for heavy duty structures and prestressed elements',
    category: MaterialCategory.CONCRETE,
    outputUnit: MeasurementUnit.CUBIC_METERS,
    components: [
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 10, unit: MeasurementUnit.BAGS, wastagePercent: 5 },
      { materialId: 'sand_coarse', materialName: 'Coarse Sand', quantity: 0.3, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 10 },
      { materialId: 'aggregate_20mm', materialName: 'Aggregate 20mm', quantity: 0.6, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 10 },
      { materialId: 'water', materialName: 'Water', quantity: 140, unit: MeasurementUnit.LITERS, wastagePercent: 5 },
    ],
    keywords: ['concrete', 'c30', 'grade 30', 'high strength', 'prestressed'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },

  // ============================================================================
  // MASONRY FORMULAS
  // ============================================================================
  {
    code: 'BRICK_150',
    name: '150mm Brick Wall',
    description: 'Single skin brick wall 150mm thick in cement mortar 1:4',
    category: MaterialCategory.MASONRY,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'brick_standard', materialName: 'Standard Bricks (230x110x75)', quantity: 60, unit: MeasurementUnit.PIECES, wastagePercent: 5 },
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 0.5, unit: MeasurementUnit.BAGS, wastagePercent: 10 },
      { materialId: 'sand_fine', materialName: 'Fine Sand', quantity: 0.04, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 15 },
    ],
    keywords: ['brick', 'wall', '150mm', 'single skin', 'masonry'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'BRICK_230',
    name: '230mm Brick Wall',
    description: 'Double skin brick wall 230mm thick in cement mortar 1:4',
    category: MaterialCategory.MASONRY,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'brick_standard', materialName: 'Standard Bricks (230x110x75)', quantity: 120, unit: MeasurementUnit.PIECES, wastagePercent: 5 },
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 1, unit: MeasurementUnit.BAGS, wastagePercent: 10 },
      { materialId: 'sand_fine', materialName: 'Fine Sand', quantity: 0.08, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 15 },
    ],
    keywords: ['brick', 'wall', '230mm', 'double skin', 'masonry'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'BLOCK_150',
    name: '150mm Concrete Block Wall',
    description: 'Concrete block wall 150mm thick (400x200x150mm blocks)',
    category: MaterialCategory.MASONRY,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'block_150', materialName: 'Concrete Block 150mm', quantity: 12.5, unit: MeasurementUnit.PIECES, wastagePercent: 5 },
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 0.35, unit: MeasurementUnit.BAGS, wastagePercent: 10 },
      { materialId: 'sand_fine', materialName: 'Fine Sand', quantity: 0.028, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 15 },
    ],
    keywords: ['block', 'wall', '150mm', 'concrete block', 'masonry'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'BLOCK_200',
    name: '200mm Concrete Block Wall',
    description: 'Concrete block wall 200mm thick (400x200x200mm blocks)',
    category: MaterialCategory.MASONRY,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'block_200', materialName: 'Concrete Block 200mm', quantity: 12.5, unit: MeasurementUnit.PIECES, wastagePercent: 5 },
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 0.4, unit: MeasurementUnit.BAGS, wastagePercent: 10 },
      { materialId: 'sand_fine', materialName: 'Fine Sand', quantity: 0.032, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 15 },
    ],
    keywords: ['block', 'wall', '200mm', 'concrete block', 'masonry'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },

  // ============================================================================
  // STEEL REINFORCEMENT FORMULAS
  // ============================================================================
  {
    code: 'REBAR_Y10',
    name: 'Reinforcement Y10',
    description: 'High yield steel reinforcement bars 10mm diameter',
    category: MaterialCategory.STEEL,
    outputUnit: MeasurementUnit.KILOGRAMS,
    components: [
      { materialId: 'rebar_y10', materialName: 'Y10 Rebar', quantity: 1, unit: MeasurementUnit.KILOGRAMS, wastagePercent: 5 },
      { materialId: 'binding_wire', materialName: 'Binding Wire', quantity: 0.02, unit: MeasurementUnit.KILOGRAMS, wastagePercent: 10 },
    ],
    keywords: ['rebar', 'reinforcement', 'y10', '10mm', 'steel', 'bar'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'REBAR_Y12',
    name: 'Reinforcement Y12',
    description: 'High yield steel reinforcement bars 12mm diameter',
    category: MaterialCategory.STEEL,
    outputUnit: MeasurementUnit.KILOGRAMS,
    components: [
      { materialId: 'rebar_y12', materialName: 'Y12 Rebar', quantity: 1, unit: MeasurementUnit.KILOGRAMS, wastagePercent: 5 },
      { materialId: 'binding_wire', materialName: 'Binding Wire', quantity: 0.02, unit: MeasurementUnit.KILOGRAMS, wastagePercent: 10 },
    ],
    keywords: ['rebar', 'reinforcement', 'y12', '12mm', 'steel', 'bar'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'REBAR_Y16',
    name: 'Reinforcement Y16',
    description: 'High yield steel reinforcement bars 16mm diameter',
    category: MaterialCategory.STEEL,
    outputUnit: MeasurementUnit.KILOGRAMS,
    components: [
      { materialId: 'rebar_y16', materialName: 'Y16 Rebar', quantity: 1, unit: MeasurementUnit.KILOGRAMS, wastagePercent: 5 },
      { materialId: 'binding_wire', materialName: 'Binding Wire', quantity: 0.015, unit: MeasurementUnit.KILOGRAMS, wastagePercent: 10 },
    ],
    keywords: ['rebar', 'reinforcement', 'y16', '16mm', 'steel', 'bar'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'BRC_MESH',
    name: 'BRC Mesh Reinforcement',
    description: 'Welded mesh reinforcement (BRC) for slabs and floors',
    category: MaterialCategory.STEEL,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'brc_mesh_a142', materialName: 'BRC Mesh A142', quantity: 1.1, unit: MeasurementUnit.SQUARE_METERS, wastagePercent: 10 },
      { materialId: 'binding_wire', materialName: 'Binding Wire', quantity: 0.05, unit: MeasurementUnit.KILOGRAMS, wastagePercent: 10 },
    ],
    keywords: ['brc', 'mesh', 'welded mesh', 'a142', 'slab', 'floor'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },

  // ============================================================================
  // PLASTERING FORMULAS
  // ============================================================================
  {
    code: 'PLASTER_12',
    name: '12mm Cement Plaster',
    description: 'Internal cement plaster 12mm thick in 1:4 cement mortar',
    category: MaterialCategory.FINISHES,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 0.22, unit: MeasurementUnit.BAGS, wastagePercent: 10 },
      { materialId: 'sand_fine', materialName: 'Fine Sand', quantity: 0.018, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 20 },
    ],
    keywords: ['plaster', '12mm', 'internal', 'cement plaster', 'render'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'PLASTER_20',
    name: '20mm Cement Plaster',
    description: 'External cement plaster 20mm thick in 1:4 cement mortar',
    category: MaterialCategory.FINISHES,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 0.36, unit: MeasurementUnit.BAGS, wastagePercent: 10 },
      { materialId: 'sand_fine', materialName: 'Fine Sand', quantity: 0.03, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 20 },
    ],
    keywords: ['plaster', '20mm', 'external', 'cement plaster', 'render'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },

  // ============================================================================
  // ROOFING FORMULAS
  // ============================================================================
  {
    code: 'ROOF_IRON_28G',
    name: 'Iron Sheet Roofing 28 Gauge',
    description: 'Corrugated iron sheet roofing 28 gauge with timber purlins',
    category: MaterialCategory.ROOFING,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'iron_sheet_28g', materialName: 'Iron Sheet 28G (3m)', quantity: 0.4, unit: MeasurementUnit.SHEETS, wastagePercent: 10 },
      { materialId: 'roofing_nail', materialName: 'Roofing Nails (75mm)', quantity: 8, unit: MeasurementUnit.PIECES, wastagePercent: 15 },
      { materialId: 'timber_2x3', materialName: 'Timber 2x3 inch', quantity: 0.8, unit: MeasurementUnit.METERS, wastagePercent: 10 },
    ],
    keywords: ['roof', 'iron sheet', '28 gauge', 'corrugated', 'mabati'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'ROOF_TILES',
    name: 'Concrete Roof Tiles',
    description: 'Concrete roof tiles with timber battens',
    category: MaterialCategory.ROOFING,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'roof_tile_concrete', materialName: 'Concrete Roof Tiles', quantity: 10, unit: MeasurementUnit.PIECES, wastagePercent: 5 },
      { materialId: 'timber_2x2', materialName: 'Timber Batten 2x2 inch', quantity: 1.5, unit: MeasurementUnit.METERS, wastagePercent: 10 },
      { materialId: 'tile_nail', materialName: 'Tile Nails', quantity: 15, unit: MeasurementUnit.PIECES, wastagePercent: 15 },
    ],
    keywords: ['roof', 'tiles', 'concrete tiles', 'batten'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },

  // ============================================================================
  // FLOORING FORMULAS
  // ============================================================================
  {
    code: 'FLOOR_SCREED_50',
    name: '50mm Floor Screed',
    description: 'Cement sand screed 50mm thick in 1:4 mix',
    category: MaterialCategory.FINISHES,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'cement_50kg', materialName: 'Cement (50kg bags)', quantity: 0.9, unit: MeasurementUnit.BAGS, wastagePercent: 10 },
      { materialId: 'sand_fine', materialName: 'Fine Sand', quantity: 0.07, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 15 },
    ],
    keywords: ['screed', 'floor', '50mm', 'cement screed'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'FLOOR_TILE_CERAMIC',
    name: 'Ceramic Floor Tiles',
    description: 'Ceramic floor tiles (300x300mm) with adhesive and grout',
    category: MaterialCategory.FINISHES,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'tile_ceramic_300', materialName: 'Ceramic Tile 300x300mm', quantity: 11.5, unit: MeasurementUnit.PIECES, wastagePercent: 10 },
      { materialId: 'tile_adhesive', materialName: 'Tile Adhesive (20kg)', quantity: 0.2, unit: MeasurementUnit.BAGS, wastagePercent: 15 },
      { materialId: 'tile_grout', materialName: 'Tile Grout (5kg)', quantity: 0.1, unit: MeasurementUnit.BAGS, wastagePercent: 20 },
    ],
    keywords: ['floor', 'tile', 'ceramic', '300x300', 'tiles'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },

  // ============================================================================
  // EARTHWORKS FORMULAS
  // ============================================================================
  {
    code: 'EXCAVATE_FOUNDATION',
    name: 'Foundation Excavation',
    description: 'Excavation for strip or pad foundations in ordinary soil',
    category: MaterialCategory.EARTHWORKS,
    outputUnit: MeasurementUnit.CUBIC_METERS,
    components: [
      { materialId: 'labour_excavation', materialName: 'Labour for Excavation', quantity: 0.5, unit: MeasurementUnit.PIECES, wastagePercent: 0 },
    ],
    keywords: ['excavation', 'foundation', 'dig', 'earthworks'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'BACKFILL_COMPACT',
    name: 'Backfill and Compaction',
    description: 'Backfilling with approved material and compaction in layers',
    category: MaterialCategory.EARTHWORKS,
    outputUnit: MeasurementUnit.CUBIC_METERS,
    components: [
      { materialId: 'murram', materialName: 'Murram/Laterite', quantity: 1.3, unit: MeasurementUnit.CUBIC_METERS, wastagePercent: 15 },
      { materialId: 'labour_compaction', materialName: 'Labour for Compaction', quantity: 0.25, unit: MeasurementUnit.PIECES, wastagePercent: 0 },
    ],
    keywords: ['backfill', 'compaction', 'murram', 'fill'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },

  // ============================================================================
  // PAINTING FORMULAS
  // ============================================================================
  {
    code: 'PAINT_EMULSION',
    name: 'Emulsion Paint (2 coats)',
    description: 'Internal emulsion paint - 2 coats on plastered walls',
    category: MaterialCategory.FINISHES,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'paint_emulsion_20l', materialName: 'Emulsion Paint (20L)', quantity: 0.05, unit: MeasurementUnit.PIECES, wastagePercent: 10 },
      { materialId: 'paint_undercoat', materialName: 'Undercoat (20L)', quantity: 0.025, unit: MeasurementUnit.PIECES, wastagePercent: 10 },
    ],
    keywords: ['paint', 'emulsion', 'interior', 'wall paint'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
  {
    code: 'PAINT_GLOSS',
    name: 'Gloss Paint (2 coats)',
    description: 'Oil-based gloss paint - 2 coats on woodwork',
    category: MaterialCategory.FINISHES,
    outputUnit: MeasurementUnit.SQUARE_METERS,
    components: [
      { materialId: 'paint_gloss_5l', materialName: 'Gloss Paint (5L)', quantity: 0.1, unit: MeasurementUnit.PIECES, wastagePercent: 10 },
      { materialId: 'paint_undercoat', materialName: 'Undercoat (5L)', quantity: 0.05, unit: MeasurementUnit.PIECES, wastagePercent: 10 },
      { materialId: 'turpentine_1l', materialName: 'Turpentine (1L)', quantity: 0.05, unit: MeasurementUnit.PIECES, wastagePercent: 5 },
    ],
    keywords: ['paint', 'gloss', 'oil paint', 'woodwork'],
    isActive: true,
    usageCount: 0,
    version: 1,
  },
];

// Material rates (UGX prices as of 2024)
export const MATERIAL_RATES_SEED: Array<{
  materialId: string;
  name: string;
  unit: MeasurementUnit;
  unitPrice: number;
  currency: 'UGX';
}> = [
  { materialId: 'cement_50kg', name: 'Cement (50kg bags)', unit: MeasurementUnit.BAGS, unitPrice: 32000, currency: 'UGX' },
  { materialId: 'sand_coarse', name: 'Coarse Sand', unit: MeasurementUnit.CUBIC_METERS, unitPrice: 80000, currency: 'UGX' },
  { materialId: 'sand_fine', name: 'Fine Sand', unit: MeasurementUnit.CUBIC_METERS, unitPrice: 90000, currency: 'UGX' },
  { materialId: 'aggregate_20mm', name: 'Aggregate 20mm', unit: MeasurementUnit.CUBIC_METERS, unitPrice: 120000, currency: 'UGX' },
  { materialId: 'brick_standard', name: 'Standard Bricks', unit: MeasurementUnit.PIECES, unitPrice: 350, currency: 'UGX' },
  { materialId: 'block_150', name: 'Concrete Block 150mm', unit: MeasurementUnit.PIECES, unitPrice: 3500, currency: 'UGX' },
  { materialId: 'block_200', name: 'Concrete Block 200mm', unit: MeasurementUnit.PIECES, unitPrice: 4500, currency: 'UGX' },
  { materialId: 'rebar_y10', name: 'Y10 Rebar', unit: MeasurementUnit.KILOGRAMS, unitPrice: 3800, currency: 'UGX' },
  { materialId: 'rebar_y12', name: 'Y12 Rebar', unit: MeasurementUnit.KILOGRAMS, unitPrice: 3800, currency: 'UGX' },
  { materialId: 'rebar_y16', name: 'Y16 Rebar', unit: MeasurementUnit.KILOGRAMS, unitPrice: 3800, currency: 'UGX' },
  { materialId: 'binding_wire', name: 'Binding Wire', unit: MeasurementUnit.KILOGRAMS, unitPrice: 5000, currency: 'UGX' },
  { materialId: 'iron_sheet_28g', name: 'Iron Sheet 28G (3m)', unit: MeasurementUnit.SHEETS, unitPrice: 35000, currency: 'UGX' },
  { materialId: 'tile_ceramic_300', name: 'Ceramic Tile 300x300mm', unit: MeasurementUnit.PIECES, unitPrice: 3500, currency: 'UGX' },
  { materialId: 'paint_emulsion_20l', name: 'Emulsion Paint (20L)', unit: MeasurementUnit.PIECES, unitPrice: 180000, currency: 'UGX' },
  { materialId: 'murram', name: 'Murram/Laterite', unit: MeasurementUnit.CUBIC_METERS, unitPrice: 50000, currency: 'UGX' },
];
