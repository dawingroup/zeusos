/**
 * Offcut Stock Builder
 *
 * Converts an Offcut document into the appropriate stock definition
 * for the material palette, so offcuts can be used as stock sources
 * in the optimization engine.
 *
 * All cost fields are set to 0 since offcuts are already owned.
 */

import type { Offcut } from '@/shared/types/offcut';
import type {
  OptimizationStockSheet,
  TimberStockDefinition,
  LinearStockDefinition,
  GlassStockDefinition,
} from '@/shared/types';

export interface OffcutStockResult {
  stockSheets?: OptimizationStockSheet[];
  timberStock?: TimberStockDefinition[];
  linearStock?: LinearStockDefinition[];
  glassStock?: GlassStockDefinition[];
}

/**
 * Build stock definitions from an offcut so it can be assigned
 * as a stock source in a material palette entry.
 */
export function buildStockFromOffcut(offcut: Offcut): OffcutStockResult {
  const label = `${offcut.materialName} (offcut)`;
  const stockId = `offcut-${offcut.id}`;
  const materialId = offcut.materialId || offcut.id;

  switch (offcut.materialType) {
    case 'PANEL':
    case 'SOLID':
    case 'VENEER':
    case 'STONE': {
      const sheet: OptimizationStockSheet = {
        id: stockId,
        materialId,
        materialName: label,
        length: offcut.length,
        width: offcut.width,
        thickness: offcut.thickness,
        quantity: 1,
        costPerSheet: 0,
      };
      return { stockSheets: [sheet] };
    }

    case 'TIMBER': {
      const timber: TimberStockDefinition = {
        id: stockId,
        materialId,
        materialName: label,
        thickness: offcut.crossSection?.thickness || offcut.thickness,
        width: offcut.crossSection?.width || offcut.width,
        availableLengths: [offcut.length],
        costPerLinearMeter: 0,
        isDressed: offcut.isDressed ?? true,
        canBeRipped: false,
        quantity: 1,
      };
      return { timberStock: [timber] };
    }

    case 'GLASS': {
      const glass: GlassStockDefinition = {
        id: stockId,
        materialId,
        materialName: label,
        length: offcut.length,
        width: offcut.width,
        thickness: offcut.thickness,
        quantity: 1,
        costPerSheet: 0,
        glassType: 'clear',
        safetyMargin: 5,
        minimumCutSize: { length: 50, width: 50 },
        requiresPolishing: true,
        fragile: true,
      };
      return { glassStock: [glass] };
    }

    case 'METAL_BAR':
    case 'ALUMINIUM': {
      const linear: LinearStockDefinition = {
        id: stockId,
        materialId,
        materialName: label,
        profile: `${offcut.width}x${offcut.thickness}`,
        profileDimensions: {
          type: 'rectangle',
          dimension1: offcut.width,
          dimension2: offcut.thickness,
        },
        availableLengths: [offcut.length],
        costPerLinearMeter: 0,
        material: offcut.materialType === 'ALUMINIUM' ? 'aluminium' : 'steel',
        quantity: 1,
      };
      return { linearStock: [linear] };
    }

    default:
      return { stockSheets: [] };
  }
}
