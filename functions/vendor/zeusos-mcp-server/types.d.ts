import type { Timestamp } from 'firebase-admin/firestore';
import type { POStatus, MOStatus, MOStage, InventoryStatus, InventoryCategory, InventoryTier, FinishCategory } from './constants.js';
export interface PaginatedResponse<T> {
    total: number;
    count: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    nextOffset?: number;
    items: T[];
}
export interface POLineItem {
    itemId?: string;
    itemName: string;
    sku?: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    totalPrice: number;
    receivedQuantity?: number;
}
export interface PurchaseOrder {
    id: string;
    poNumber?: string;
    orderNumber?: string;
    status: POStatus;
    supplierId?: string;
    supplierName?: string;
    projectId?: string;
    projectName?: string;
    lineItems?: POLineItem[];
    lineItemCount?: number;
    subtotal?: number;
    total?: number;
    currency?: string;
    expectedDeliveryDate?: Timestamp;
    receivedDate?: Timestamp;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}
export interface BOMEntry {
    id: string;
    inventoryItemId?: string;
    itemName?: string;
    name?: string;
    sku?: string;
    quantity?: number;
    unit?: string;
    unitCost?: number;
    totalCost?: number;
    supplierName?: string;
    status?: string;
}
export interface MaterialConsumption {
    id: string;
    itemName?: string;
    quantity?: number;
    unit?: string;
    costPerUnit?: number;
    totalCost?: number;
    consumedAt?: Timestamp;
    consumedByName?: string;
    consumedBy?: string;
}
export interface StageTransition {
    id: string;
    fromStage?: MOStage;
    toStage?: MOStage;
    transitionedAt?: Timestamp;
    transitionedByName?: string;
    transitionedBy?: string;
    notes?: string;
}
export interface ManufacturingOrder {
    id: string;
    moNumber?: string;
    orderNumber?: string;
    name?: string;
    status?: MOStatus;
    currentStage?: MOStage;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    projectId?: string;
    projectName?: string;
    customerId?: string;
    customerName?: string;
    bomItemCount?: number;
    startDate?: Timestamp;
    targetCompletionDate?: Timestamp;
    actualCompletionDate?: Timestamp;
    totalEstimatedCost?: number;
    totalActualCost?: number;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    bomEntries?: BOMEntry[];
    materialConsumptions?: MaterialConsumption[];
    stageTransitions?: StageTransition[];
}
export interface InventoryItem {
    id: string;
    name?: string;
    sku?: string;
    category?: InventoryCategory;
    classification?: 'material' | 'product' | 'kit';
    status?: InventoryStatus;
    tier?: InventoryTier;
    restockable?: boolean;
    linkedProjectIds?: string[];
    unit?: string;
    stockOnHand?: number;
    reorderLevel?: number;
    reorderQuantity?: number;
    costPrice?: number;
    sellPrice?: number;
    currency?: string;
    primarySupplier?: string;
    preferredSupplierName?: string;
    tags?: string[];
    brand?: string;
    description?: string;
    displayName?: string;
    subcategory?: string;
    isFamily?: boolean;
    familyId?: string;
    parentItemId?: string;
    pricing?: {
        costPerUnit?: number;
        currency?: string;
        unit?: string;
        costPerCubicMetre?: number;
        pricingBasis?: 'per-unit' | 'per-cbm';
    };
    inventory?: {
        inStock?: number;
        reorderLevel?: number;
        volumeOnHand?: number;
        piecesOnHand?: number;
    };
}
export interface StockLevel {
    id: string;
    inventoryItemId?: string;
    warehouseId?: string;
    sku?: string;
    itemName?: string;
    quantityOnHand?: number;
    quantityAllocated?: number;
    quantityAvailable?: number;
    reorderPoint?: number;
    updatedAt?: Timestamp;
}
export interface StockAdjustmentLineItem {
    lineId?: string;
    itemId?: string;
    itemName?: string;
    itemSku?: string;
    direction?: 'increase' | 'decrease';
    quantity?: number;
    currentStock?: number;
    countedQuantity?: number;
    unitCostAtAdjustment?: number;
    totalValue?: number;
}
export interface StockAdjustment {
    id: string;
    adjustmentNumber?: string;
    status?: string;
    adjustmentType?: string;
    lineItems?: StockAdjustmentLineItem[];
    lineCount?: number;
    totalIncreaseValue?: number;
    totalDecreaseValue?: number;
    netValueImpact?: number;
    referenceType?: string;
    referenceId?: string;
    referenceNumber?: string;
    notes?: string;
    reason?: string;
    approvedBy?: string;
    isAutoApproved?: boolean;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;
}
export interface FinishDocument {
    id: string;
    organizationId?: string;
    subsidiaryId?: string;
    name?: string;
    code?: string;
    category?: FinishCategory;
    subtype?: string;
    hexColor?: string;
    secondaryColor?: string;
    patternType?: 'solid' | 'woodgrain' | 'marble' | 'textile' | 'geometric' | 'speckled' | 'custom';
    thumbnailUrl?: string;
    costModifier?: number;
    costModifierType?: 'percentage' | 'absolute';
    availability?: 'in_stock' | 'made_to_order' | 'discontinued' | 'seasonal';
    tags?: string[];
    isActive?: boolean;
    notes?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}
export interface Supplier {
    id: string;
    name?: string;
    companyName?: string;
    contactPerson?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    status?: string;
    categories?: string[];
    materialCategories?: string[];
    rating?: number;
    leadTimeDays?: number;
    averageLeadTime?: number;
    currency?: string;
    country?: string;
    city?: string;
    paymentTerms?: string;
}
//# sourceMappingURL=types.d.ts.map