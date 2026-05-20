/**
 * Product Definition Document Types
 *
 * Extends the existing FurnitureTemplate with constraint rules,
 * inventory bindings, pricing configuration, and client-facing config.
 */
import type { Timestamp } from 'firebase/firestore';
import type { FurnitureTemplate } from './generation.types';
import type {
  ProductType,
  DesignOrigin,
  PddStatus,
  ConstraintAction,
} from '../constants/productDefinition.constants';

// Re-export for convenience
export type { ProductType, DesignOrigin, PddStatus, ConstraintAction };

/** Product Definition Document — extends FurnitureTemplate with production pipeline data */
export interface ProductDefinitionDocument extends FurnitureTemplate {
  productType: ProductType;
  designOrigin: DesignOrigin;
  status: PddStatus;
  constraints: Constraint[];
  validFinishes: string[];
  inventoryBindings: Record<string, InventoryBinding>;
  pricingConfig: PricingConfig;
  clientFacingConfig: ClientFacingConfig;
  dkbArchetypeId?: string;
  manufacturingOutputConfig: ManufacturingOutputConfig;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

/** Constraint rule evaluated against configuration parameters */
export interface Constraint {
  id: string;
  /** JS expression evaluated against parameters via expr-eval */
  condition: string;
  action: ConstraintAction;
  /** Human-readable explanation */
  reason: string;
  /** Which parameter keys this constraint involves */
  affectedParameters: string[];
  isActive: boolean;
}

/** Maps a BOM template line to an inventory item or family */
export interface InventoryBinding {
  /** Maps to BomTemplateLine materialCategory */
  bomTemplateLineKey: string;
  /** Specific inventory item ID */
  inventoryItemId?: string;
  /** Or family ID (any child SKU acceptable) */
  inventoryFamilyId?: string;
  /** Inventory category for fallback search */
  category: string;
  /** Applied to BomTemplateLine quantity */
  quantityMultiplier: number;
  /** Wastage percentage (e.g. 5 = 5%) */
  wastagePercent: number;
}

/** Pricing configuration for a PDD */
export interface PricingConfig {
  /** Design Manager estimation config ID */
  estimationEngineRef: string;
  /** Expression computing complexity score from parameters */
  laborComplexityFormula: string;
  overheadPercent: number;
  marginPercent: number;
  taxConfig: {
    vatApplicable: boolean;
    whtApplicable: boolean;
  };
  currencyOverride?: 'UGX' | 'USD';
}

/** Client-facing configurator settings */
export interface ClientFacingConfig {
  /** Parameter keys visible to client */
  exposedParameters: string[];
  /** Override labels for client display */
  parameterLabels: Record<string, string>;
  /** Tooltip text per parameter */
  parameterHelpText: Record<string, string>;
  /** e.g. "Body Finish", "Door Finish" */
  finishGroupLabels: Record<string, string>;
  showPriceEstimate: boolean;
  showStockAvailability: boolean;
  allowARPreview: boolean;
  shareableUrl: boolean;
}

/** Manufacturing output settings */
export interface ManufacturingOutputConfig {
  generateCutList: boolean;
  cutListFormat: 'csv' | 'pdf' | 'polyboard_native';
  generateEdgeBandingSchedule: boolean;
  generateHardwareSchedule: boolean;
  generateCNCProgram: boolean;
  generateAssemblyInstructions: boolean;
  generateDrawingPackage: boolean;
}
