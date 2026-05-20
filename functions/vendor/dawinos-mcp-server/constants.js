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
export function getRequiredCompanyId() {
    const value = process.env['DAWINOS_COMPANY_ID']?.trim();
    if (!value) {
        throw new Error('Missing required env: DAWINOS_COMPANY_ID');
    }
    return value;
}
// ─── Top-level collections ────────────────────────────────────────────────────
// NOTE: These are queried WITHOUT an organizationId WHERE filter.
// Existing tools (functions/src/tools/) confirm these collections do not
// have an organizationId field on their documents.
export const COLLECTIONS = {
    PURCHASE_ORDERS: 'purchaseOrders',
    MANUFACTURING_ORDERS: 'manufacturingOrders', // audit: spec said manufacturing_orders
    FINISH_LIBRARY: 'finishLibrary',
    INVENTORY_ITEMS: 'inventoryItems', // audit: spec said inventory_items
    STOCK_ADJUSTMENTS: 'stock_adjustments', // snake_case — confirmed
    STOCK_LEVELS: 'stockLevels', // bonus collection discovered in audit
    SUPPLIERS: 'suppliers',
    CLIENT_QUOTES: 'clientQuotes',
    /** Design Manager — `src/modules/design-manager` */
    DESIGN_PROJECTS: 'designProjects',
};
// ─── MatFlow paths ────────────────────────────────────────────────────────────
// Source: src/subsidiaries/advisory/matflow/firebase/matflow-collections.ts
// Source: src/subsidiaries/advisory/matflow/utils/collections.ts (formulas)
export const MATFLOW_PATHS = {
    formulas: 'matflow/data/formulas',
    materials: 'advisoryPlatform/matflow/materials',
};
// ─── Company-scoped paths (companies/{companyId}/...) ─────────────────────────
export const COMPANY_PATHS = {
    expenditureQueue: (companyId = DEFAULT_ORG_ID) => `companies/${companyId}/expenditure_queue`,
    spendPlans: (companyId = DEFAULT_ORG_ID) => `companies/${companyId}/spend_plans`,
};
// ─── Advisory paths (path-scoped, no field filter needed) ────────────────────
// Source: src/subsidiaries/advisory/delivery/services/allocation-service.ts:44
// Source: src/subsidiaries/advisory/core/project/services/project.service.ts:40
export const ADVISORY_PATHS = {
    projects: (orgId = DEFAULT_ORG_ID) => `organizations/${orgId}/advisory_projects`,
    allocationGroups: (orgId = DEFAULT_ORG_ID) => `organizations/${orgId}/allocation_groups`,
    programs: (orgId = DEFAULT_ORG_ID) => `organizations/${orgId}/advisory_programs`,
};
// ─── Manufacturing order subcollections ──────────────────────────────────────
// Source: functions/src/tools/manufacturingTools.js:151,172,193
export const MO_SUBCOLLECTIONS = {
    BOM_ENTRIES: 'bomEntries',
    MATERIAL_CONSUMPTIONS: 'materialConsumptions',
    STAGE_TRANSITIONS: 'stageTransitions',
};
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
];
export const MO_STATUSES = [
    'draft',
    'pending-approval',
    'approved',
    'in-progress',
    'on-hold',
    'completed',
    'cancelled',
];
export const MO_STAGES = [
    'queued',
    'cutting',
    'assembly',
    'finishing',
    'qc',
    'ready',
];
export const INVENTORY_STATUSES = [
    'active',
    'discontinued',
    'out-of-stock',
    'archived',
];
export const INVENTORY_TIERS = [
    'catalogue',
    'project',
];
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
];
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
];
// Source: src/subsidiaries/advisory/core/project/types/project.types.ts
export const ADVISORY_PROJECT_STATUSES = [
    'planning',
    'procurement',
    'mobilization',
    'active',
    'substantial_completion',
    'defects_liability',
    'completed',
    'suspended',
    'cancelled',
];
// Source: src/subsidiaries/advisory/delivery/types/allocation.ts
export const ALLOCATION_GROUP_STATUSES = ['Draft', 'Finalized'];
//# sourceMappingURL=constants.js.map