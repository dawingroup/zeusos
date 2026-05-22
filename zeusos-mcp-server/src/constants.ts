// ─── Pagination ───────────────────────────────────────────────────────────────
export const CHARACTER_LIMIT = 50_000;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ─── Organisation ─────────────────────────────────────────────────────────────
// Audit finding: DEFAULT_ORG_ID is 'default', not 'dawin-group'
// Source: src/core/settings/settingsService.ts:33
export const DEFAULT_ORG_ID = 'default';

/**
 * Compliance hardening:
 * Require explicit company scoping for MCP-mediated AI calls so the server
 * never silently falls back to a shared default tenant.
 */
export function getRequiredCompanyId(): string {
  const value = process.env['ZEUSOS_COMPANY_ID']?.trim();
  if (!value) {
    throw new Error('Missing required env: ZEUSOS_COMPANY_ID');
  }
  return value;
}

// ─── Top-level collections ────────────────────────────────────────────────────
// NOTE: These are queried WITHOUT an organizationId WHERE filter.
// Existing tools (functions/src/tools/) confirm these collections do not
// have an organizationId field on their documents.
export const COLLECTIONS = {
  PURCHASE_ORDERS: 'purchaseOrders',
  MANUFACTURING_ORDERS: 'manufacturingOrders',  // audit: spec said manufacturing_orders
  FINISH_LIBRARY: 'finishLibrary',
  INVENTORY_ITEMS: 'inventoryItems',            // audit: spec said inventory_items
  STOCK_ADJUSTMENTS: 'stock_adjustments',       // snake_case — confirmed
  STOCK_LEVELS: 'stockLevels',                  // bonus collection discovered in audit
  SUPPLIERS: 'suppliers',
  CLIENT_QUOTES: 'clientQuotes',
  /** Design Manager — `src/modules/design-manager` */
  DESIGN_PROJECTS: 'designProjects',
} as const;

// ─── Company-scoped paths (companies/{companyId}/...) ─────────────────────────
export const COMPANY_PATHS = {
  expenditureQueue: (companyId: string = DEFAULT_ORG_ID) =>
    `companies/${companyId}/expenditure_queue`,
  spendPlans: (companyId: string = DEFAULT_ORG_ID) =>
    `companies/${companyId}/spend_plans`,
} as const;

// ─── Manufacturing order subcollections ──────────────────────────────────────
// Source: functions/src/tools/manufacturingTools.js:151,172,193
export const MO_SUBCOLLECTIONS = {
  BOM_ENTRIES: 'bomEntries',
  MATERIAL_CONSUMPTIONS: 'materialConsumptions',
  STAGE_TRANSITIONS: 'stageTransitions',
} as const;

// ─── Status enums ─────────────────────────────────────────────────────────────
// All kebab-case confirmed from functions/src/tools/manufacturingTools.js

export const PO_STATUSES = [
  'draft',
  'pending-approval',
  'approved',
  'sent',
  'partially-received',
  'received',
  'closed',
  'cancelled',
] as const;

export const MO_STATUSES = [
  'draft',
  'pending-approval',
  'approved',
  'in-progress',
  'on-hold',
  'completed',
  'cancelled',
] as const;

export const MO_STAGES = [
  'queued',
  'cutting',
  'assembly',
  'finishing',
  'qc',
  'ready',
] as const;

export const INVENTORY_STATUSES = [
  'active',
  'discontinued',
  'out-of-stock',
  'archived',
] as const;

export const INVENTORY_TIERS = [
  'catalogue',
  'project',
] as const;

export const INVENTORY_CATEGORIES = [
  'sheet-goods',
  'solid-wood',
  'hardware',
  'edge-banding',
  'finishing',
  'adhesives',
  'fasteners',
  'upholstery',
  'abrasives',
  'services',
  'products',
  'other',
] as const;

export const FINISH_CATEGORIES = [
  'board',
  'paint',
  'tile',
  'laminate',
  'veneer',
  'fabric',
  'metal',
  'stone',
  'glass',
  'custom',
] as const;

// ─── Type helpers ─────────────────────────────────────────────────────────────
export type POStatus = (typeof PO_STATUSES)[number];
export type MOStatus = (typeof MO_STATUSES)[number];
export type MOStage = (typeof MO_STAGES)[number];
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
export type InventoryTier = (typeof INVENTORY_TIERS)[number];
export type FinishCategory = (typeof FINISH_CATEGORIES)[number];
