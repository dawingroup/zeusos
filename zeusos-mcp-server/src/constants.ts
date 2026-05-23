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

// ─── Phase 3 + 4 marketing-domain collections (Phase 5.A) ───────────────────
// All top-level. Confirmed against firestore.rules + src/modules/*/services/firestore.ts.
// See TODO_MCP_SERVER.md "Audit: collection paths in use" for the source map.
export const MARKETING_COLLECTIONS = {
  MASTER_JOBS: 'master_jobs',
  INTERNAL_WORK_ORDERS: 'internal_work_orders',
  BUDGET_HOLDS: 'budget_holds',
  MEDIA_PLANS: 'media_plans',
  MEDIA_SUPPLIER_INVOICES: 'media_supplier_invoices',
  PRODUCTION_JOBS: 'production_jobs',
  TALENT_PROFILES: 'talent_profiles',
  TALENT_INVOICES: 'talent_invoices',
  FREELANCER_CONTRACTS: 'freelancer_contracts',
  CLIENT_INVOICES: 'client_invoices',
  INTERCOMPANY_INVOICES: 'intercompany_invoices',
  CLIENTS: 'clients',
  DOMAIN_EVENTS: 'domain_events',
} as const;

// IWO subcollections
export const IWO_SUBCOLLECTIONS = {
  HANDOFF_PACKET: 'handoff_packet',
  TIME_ENTRIES: 'time_entries',
  COST_ENTRIES: 'cost_entries',
  DELIVERABLES: 'deliverables',
} as const;

// MediaPlan subcollections
export const MEDIA_PLAN_SUBCOLLECTIONS = {
  MEDIA_BUYS: 'media_buys',
  ACTUALS: 'actuals',
} as const;

// ─── Subsidiary IDs (mirrors src/core/settings/types.ts SubsidiaryId) ────────
export const ZEUS_SUBSIDIARY_IDS = [
  'zeus-group',         // parent
  'zeus-the-agency',
  'zeus-digital',
  'labyrinth',
  'odd-gorilla',
  'house-of-zeus',
] as const;
export type ZeusSubsidiaryId = (typeof ZEUS_SUBSIDIARY_IDS)[number];

// ─── IWO states (mirrors src/modules/assignment/constants/iwo-states.ts) ────
export const IWO_STATES = [
  'DRAFT',
  'ISSUED',
  'ACCEPTED',
  'REJECTED',
  'IN_PROGRESS',
  'DELIVERED',
  'ACCEPTED_INTERNALLY',
  'CLOSED',
  'CANCELLED',
] as const;
export type IWOState = (typeof IWO_STATES)[number];

export const IWO_ACTIVE_STATES: readonly IWOState[] = [
  'ISSUED',
  'ACCEPTED',
  'IN_PROGRESS',
  'DELIVERED',
  'ACCEPTED_INTERNALLY',
];

// ─── MasterJob statuses ──────────────────────────────────────────────────────
export const MASTER_JOB_STATUSES = ['OPEN', 'DELIVERING', 'CLOSED', 'CANCELLED'] as const;
export type MasterJobStatus = (typeof MASTER_JOB_STATUSES)[number];

// ─── Production stages (mirrors src/modules/production/types/production-job.types.ts) ───
export const PRODUCTION_STAGES = [
  'BRIEF',
  'PRE_PRODUCTION',
  'TALENT_BOOKING',
  'LOCATION_LOCK',
  'EQUIPMENT',
  'SHOOT',
  'POST_PRODUCTION',
  'CLIENT_REVIEW',
  'MASTER_DELIVERY',
  'COMPLETE',
] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const PRODUCTION_JOB_TYPES = ['TVC', 'RADIO', 'PHOTOGRAPHY', 'PRINT', 'EXHIBITION', 'OTHER'] as const;

// ─── Media vehicle types (mirrors src/modules/media/types/media-buy.types.ts) ───
export const MEDIA_VEHICLE_TYPES = ['TV', 'RADIO', 'PRINT', 'OOH', 'DIGITAL', 'SOCIAL', 'SEARCH', 'PROGRAMMATIC'] as const;
export type MediaVehicleType = (typeof MEDIA_VEHICLE_TYPES)[number];

// ─── Invoice statuses ───────────────────────────────────────────────────────
export const CLIENT_INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PART_PAID', 'PAID', 'VOID'] as const;
export const TALENT_INVOICE_STATUSES = ['SUBMITTED', 'APPROVED', 'PAID', 'REJECTED'] as const;
export const MEDIA_SUPPLIER_INVOICE_STATUSES = ['SUBMITTED', 'APPROVED', 'PAID', 'REJECTED'] as const;
export const TALENT_TYPES = ['STAFF', 'FREELANCER'] as const;
export const TALENT_STATUSES = ['ACTIVE', 'INACTIVE', 'BLACKLISTED'] as const;

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
