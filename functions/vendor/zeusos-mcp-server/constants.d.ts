export declare const CHARACTER_LIMIT = 50000;
export declare const DEFAULT_PAGE_SIZE = 20;
export declare const MAX_PAGE_SIZE = 100;
export declare const DEFAULT_ORG_ID = "default";
/**
 * Compliance hardening:
 * Require explicit company scoping for MCP-mediated AI calls so the server
 * never silently falls back to a shared default tenant.
 */
export declare function getRequiredCompanyId(): string;
export declare const COLLECTIONS: {
    readonly PURCHASE_ORDERS: "purchaseOrders";
    readonly MANUFACTURING_ORDERS: "manufacturingOrders";
    readonly FINISH_LIBRARY: "finishLibrary";
    readonly INVENTORY_ITEMS: "inventoryItems";
    readonly STOCK_ADJUSTMENTS: "stock_adjustments";
    readonly STOCK_LEVELS: "stockLevels";
    readonly SUPPLIERS: "suppliers";
    readonly CLIENT_QUOTES: "clientQuotes";
    /** Design Manager — `src/modules/design-manager` */
    readonly DESIGN_PROJECTS: "designProjects";
};
export declare const COMPANY_PATHS: {
    readonly expenditureQueue: (companyId?: string) => string;
    readonly spendPlans: (companyId?: string) => string;
};
export declare const MO_SUBCOLLECTIONS: {
    readonly BOM_ENTRIES: "bomEntries";
    readonly MATERIAL_CONSUMPTIONS: "materialConsumptions";
    readonly STAGE_TRANSITIONS: "stageTransitions";
};
export declare const PO_STATUSES: readonly ["draft", "pending-approval", "approved", "sent", "partially-received", "received", "closed", "cancelled"];
export declare const MO_STATUSES: readonly ["draft", "pending-approval", "approved", "in-progress", "on-hold", "completed", "cancelled"];
export declare const MO_STAGES: readonly ["queued", "cutting", "assembly", "finishing", "qc", "ready"];
export declare const INVENTORY_STATUSES: readonly ["active", "discontinued", "out-of-stock", "archived"];
export declare const INVENTORY_TIERS: readonly ["catalogue", "project"];
export declare const INVENTORY_CATEGORIES: readonly ["sheet-goods", "solid-wood", "hardware", "edge-banding", "finishing", "adhesives", "fasteners", "upholstery", "abrasives", "services", "products", "other"];
export declare const FINISH_CATEGORIES: readonly ["board", "paint", "tile", "laminate", "veneer", "fabric", "metal", "stone", "glass", "custom"];
export type POStatus = (typeof PO_STATUSES)[number];
export type MOStatus = (typeof MO_STATUSES)[number];
export type MOStage = (typeof MO_STAGES)[number];
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];
export type InventoryTier = (typeof INVENTORY_TIERS)[number];
export type FinishCategory = (typeof FINISH_CATEGORIES)[number];
//# sourceMappingURL=constants.d.ts.map