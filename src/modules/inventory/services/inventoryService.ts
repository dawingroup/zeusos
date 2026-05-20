/**
 * Inventory Service
 * CRUD operations for unified inventory items
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  deleteField,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  InventoryItem,
  InventoryItemFormData,
  InventoryListItem,
  InventoryCategory,
  InventoryTier,
  InventoryStatus,
  InventorySource,
  InventoryItemType,
  StructuredName,
  SupplierInventoryPricing,
  SupplierPricingFormData,
  FamilyFormData,
  SkuFormData,
  FamilyStockRollup,
  VariantAttribute,
  InventoryClassification,
  InventoryUnit,
  DeleteSafetyCheck,
} from '../types';
import { getStockLevels } from './stockLevelService';
import { Timestamp } from 'firebase/firestore';

const COLLECTION_NAME = 'inventoryItems';
const inventoryRef = collection(db, COLLECTION_NAME);
const FUNCTIONAL_CURRENCY = 'UGX';

/**
 * Recursively strip undefined values from an object before Firestore writes.
 * Firestore rejects `undefined` — this handles both top-level and nested fields.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const canUseTimestampInstanceof = typeof Timestamp === 'function';
  if (Array.isArray(obj)) {
    return obj
      .filter((value) => value !== undefined)
      .map((value) => {
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          !(canUseTimestampInstanceof && value instanceof Timestamp)
        ) {
          const proto = Object.getPrototypeOf(value);
          if (proto === Object.prototype || proto === null) {
            return stripUndefined(value as Record<string, unknown>);
          }
        }
        if (Array.isArray(value)) {
          return stripUndefined(value as unknown as Record<string, unknown>);
        }
        return value;
      }) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      result[key] = stripUndefined(value as unknown as Record<string, unknown>);
      continue;
    }
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(canUseTimestampInstanceof && value instanceof Timestamp)
    ) {
      // Check if it's a plain object (not a FieldValue, Date, etc.)
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        result[key] = stripUndefined(value as Record<string, unknown>);
        continue;
      }
    }
    result[key] = value;
  }
  return result as T;
}

/**
 * Generate a SKU from name and category
 */
export function generateSku(name: string, category: InventoryCategory): string {
  const categoryPrefix: Record<InventoryCategory, string> = {
    'sheet-goods': 'SHT',
    'solid-wood': 'WOD',
    'hardware': 'HDW',
    'edge-banding': 'EDG',
    'finishing': 'FIN',
    'adhesives': 'ADH',
    'fasteners': 'FST',
    'upholstery': 'UPH',
    'other': 'OTH',
  };

  const prefix = categoryPrefix[category];
  const namePart = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 6);
  const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();

  return `${prefix}-${namePart}-${randomPart}`;
}

// ============================================
// Smart SKU Generation (Phase 2)
// ============================================

/** Category prefix mapping for smart SKUs */
const CATEGORY_PREFIXES: Record<string, string> = {
  'sheet-goods': 'SHT',
  'solid-wood': 'WOD',
  'hardware': 'HDW',
  'edge-banding': 'EDG',
  'finishing': 'FIN',
  'adhesives': 'ADH',
  'fasteners': 'FST',
  'upholstery': 'UPH',
  'other': 'OTH',
};

/** Subcategory abbreviation lookup */
const SUBCATEGORY_CODES: Record<string, string> = {
  'Hinge': 'HNG',
  'Drawer Slide': 'SLD',
  'Handle': 'HDL',
  'Lock': 'LCK',
  'Screw': 'SCR',
  'Plate': 'PLT',
  'Bracket': 'BRK',
  'Shelf Support': 'SHS',
  'Connecting Bolt': 'CBT',
  'Cam Lock': 'CAM',
  'MDF': 'MDF',
  'Plywood': 'PLY',
  'Melamine': 'MEL',
  'Chipboard': 'CHB',
  'Veneer': 'VNR',
  'Hardwood': 'HWD',
  'Softwood': 'SWD',
  'PVC': 'PVC',
  'ABS': 'ABS',
  'Wood Veneer': 'WVE',
  'Lacquer': 'LAC',
  'Stain': 'STN',
  'Oil': 'OIL',
  'Wax': 'WAX',
  'Sealer': 'SEA',
  'PVA': 'PVA',
  'Contact Cement': 'CCE',
  'Epoxy': 'EPX',
};

/** Quality tier codes */
const TIER_CODES: Record<string, string> = {
  'economy': 'ECO',
  'standard': 'STD',
  'premium': 'PRM',
  'luxury': 'LUX',
};

/**
 * Generate a structured, human-readable SKU from parametric attributes.
 * Format: [CAT]-[SUB]-[FUNC]-[SPECS]-[TIER]
 *
 * Examples:
 *   HDW-HNG-INS-110SC-PRM
 *   KIT-HNG-INS-110SC-PRM
 *   SHT-MDF-18MM
 */
export function generateSmartSku(params: {
  category: InventoryCategory;
  subcategory?: string;
  engineeringFunction?: string;
  keySpecs?: string;
  qualityTier?: string;
  itemType?: InventoryItemType;
}): string {
  const parts: string[] = [];

  // 1. Category prefix (or KIT for kit items)
  if (params.itemType === 'kit') {
    parts.push('KIT');
  } else {
    parts.push(CATEGORY_PREFIXES[params.category] || 'OTH');
  }

  // 2. Subcategory code
  if (params.subcategory) {
    const code = SUBCATEGORY_CODES[params.subcategory];
    if (code) {
      parts.push(code);
    } else {
      // Fallback: first 3 characters uppercased
      parts.push(params.subcategory.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase());
    }
  }

  // 3. Engineering function (e.g., INS for Inset, FOV for Full Overlay)
  if (params.engineeringFunction) {
    const fn = params.engineeringFunction
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase();
    if (fn) parts.push(fn);
  }

  // 4. Key specs (e.g., 110SC for 110° Soft-Close)
  if (params.keySpecs) {
    const specs = params.keySpecs
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, 6)
      .toUpperCase();
    if (specs) parts.push(specs);
  }

  // 5. Quality tier code
  if (params.qualityTier) {
    const tier = TIER_CODES[params.qualityTier.toLowerCase()];
    if (tier) parts.push(tier);
  }

  return parts.join('-');
}

/**
 * Build a taxonomy-formatted display name from structured name components.
 * Format: [Category Label] - [Subcategory] - [Function] - [Key Specs] - [Quality Tier] - [Brand]
 *
 * Example: "Hardware - Hinge - Inset - 110° Soft-Close - Premium - Blum"
 */
export function buildDisplayName(params: {
  category: InventoryCategory;
  subcategory?: string;
  structuredName?: StructuredName;
}): string {
  const categoryLabels: Record<string, string> = {
    'sheet-goods': 'Sheet Goods',
    'solid-wood': 'Solid Wood',
    'hardware': 'Hardware',
    'edge-banding': 'Edge Banding',
    'finishing': 'Finishing',
    'adhesives': 'Adhesives',
    'fasteners': 'Fasteners',
    'upholstery': 'Upholstery',
    'other': 'Other',
  };

  const parts: string[] = [categoryLabels[params.category] || params.category];

  if (params.subcategory) parts.push(params.subcategory);
  if (params.structuredName?.function) parts.push(params.structuredName.function);
  if (params.structuredName?.keySpecs) parts.push(params.structuredName.keySpecs);
  if (params.structuredName?.qualityTier) parts.push(params.structuredName.qualityTier);
  if (params.structuredName?.brandName) parts.push(params.structuredName.brandName);

  return parts.join(' - ');
}

/**
 * Transform Firestore doc to InventoryListItem
 */
function docToListItem(id: string, data: any): InventoryListItem {
  return {
    id,
    sku: data.sku || '',
    name: data.name || '',
    displayName: data.displayName,
    category: data.category || 'other',
    subcategory: data.subcategory,
    brand: data.brand,
    tier: data.tier || 'catalogue',
    restockable: data.restockable,
    source: data.source || 'manual',
    thickness: data.dimensions?.thickness,
    costPerUnit: data.pricing?.costPerUnit,
    costUnit: data.pricing?.unit,
    currency: data.pricing?.currency,
    inStock: data.inventory?.inStock,
    status: data.status || 'active',
    // Family / SKU hierarchy
    isFamily: data.isFamily || false,
    isOrderable: data.isOrderable !== false, // default true
    isBomSelectable: data.isBomSelectable !== false, // default true
    familyId: data.familyId || null,
    skuCount: data.skuIds?.length || 0,
    variantAttributeDefinitions: data.variantAttributeDefinitions,
    // Legacy variants
    parentItemId: data.parentItemId,
    isVariantParent: data.isVariantParent || false,
    variantCount: data.variantIds?.length || 0,
    // Variant attributes (for child row display)
    variantAttributes: data.variantAttributes,
    finishCategory: data.finishCategory,
    itemType: data.itemType,
    classification: data.classification,
    vendorSourceCount: data.vendorSources?.length || 0,
  };
}

/**
 * Transform Firestore doc to full InventoryItem
 */
function docToItem(id: string, data: any): InventoryItem {
  return {
    id,
    sku: data.sku || '',
    name: data.name || '',
    displayName: data.displayName,
    description: data.description,
    classification: data.classification,
    category: data.category || 'other',
    subcategory: data.subcategory,
    brand: data.brand,
    tags: data.tags || [],
    aliases: data.aliases || [],
    // Family / SKU hierarchy
    isFamily: data.isFamily || false,
    isOrderable: data.isOrderable !== false,
    isBomSelectable: data.isBomSelectable !== false,
    familyId: data.familyId || null,
    skuIds: data.skuIds || [],
    variantAttributeDefinitions: data.variantAttributeDefinitions || [],
    // UoM conversion
    purchaseUom: data.purchaseUom,
    stockUom: data.stockUom,
    consumptionUom: data.consumptionUom,
    uomConversion: data.uomConversion,
    // Item type (parametric hierarchy)
    itemType: data.itemType,
    structuredName: data.structuredName,
    // Variant support (legacy)
    parentItemId: data.parentItemId,
    variantAttributes: data.variantAttributes || [],
    variantIds: data.variantIds || [],
    isVariantParent: data.isVariantParent || false,
    // Engineering hierarchy (parametric)
    engineeringParentId: data.engineeringParentId,
    engineeringFunction: data.engineeringFunction,
    purchasingTierIds: data.purchasingTierIds,
    // Vendor sources / MPN
    vendorSources: data.vendorSources,
    // Kit / phantom assembly
    kitComponents: data.kitComponents,
    kitSourceId: data.kitSourceId,
    // Parametric tags
    parametricTags: data.parametricTags,
    // Finish library & attributes
    finishCategory: data.finishCategory,
    finishSubtype: data.finishSubtype,
    linkedFinishes: data.linkedFinishes || [],
    linkedFinishIds: data.linkedFinishIds || [],
    requiredAttributes: data.requiredAttributes || [],
    attributeConstraints: data.attributeConstraints || {},
    // Supplier & Shopify
    preferredSupplierId: data.preferredSupplierId,
    preferredSupplierName: data.preferredSupplierName,
    supplierPricing: data.supplierPricing || [],
    linkedMaterialIds: data.linkedMaterialIds || [],
    source: data.source || 'manual',
    promotedFromPartId: data.promotedFromPartId,
    tier: data.tier || 'catalogue',
    restockable: data.restockable ?? true,
    scopeId: data.scopeId,
    dimensions: data.dimensions,
    grainPattern: data.grainPattern,
    fabricSpec: data.fabricSpec,
    pricing: data.pricing || { costPerUnit: 0, currency: 'UGX', unit: 'sheet' },
    inventory: data.inventory || { inStock: 0 },
    status: data.status || 'active',
    createdAt: data.createdAt,
    createdBy: data.createdBy || '',
    updatedAt: data.updatedAt,
    updatedBy: data.updatedBy || '',
    lastAuditedAt: data.lastAuditedAt,
  };
}

/**
 * Default safety cap for subscribeToInventory. Generous enough to cover
 * realistic inventory + child SKU counts without pathological growth as
 * the catalogue expands. Callers needing more can pass `maxResults`;
 * callers needing every row (analytics, exports) opt in via `unbounded`.
 */
const DEFAULT_SUBSCRIBE_INVENTORY_LIMIT = 2000;

/**
 * Subscribe to inventory items with server-side filters.
 * Filters are pushed to Firestore where clauses so only matching
 * documents are downloaded. A safety limit caps the result set.
 */
export function subscribeToInventory(
  callback: (items: InventoryListItem[]) => void,
  onError?: (error: Error) => void,
  options?: {
    category?: InventoryCategory;
    tier?: InventoryTier;
    source?: InventorySource;
    status?: InventoryStatus;
    maxResults?: number;
    /** Escape hatch: skip the default safety cap. Use only when the
     *  caller genuinely needs every row (e.g. analytics, exports). */
    unbounded?: boolean;
  }
): Unsubscribe {
  const constraints: QueryConstraint[] = [];

  if (options?.tier) constraints.push(where('tier', '==', options.tier));
  if (options?.status) constraints.push(where('status', '==', options.status));
  if (options?.category) constraints.push(where('category', '==', options.category));
  if (options?.source) constraints.push(where('source', '==', options.source));

  constraints.push(orderBy('name', 'asc'));

  const effectiveLimit = options?.unbounded
    ? undefined
    : (options?.maxResults ?? DEFAULT_SUBSCRIBE_INVENTORY_LIMIT);
  if (effectiveLimit !== undefined) {
    constraints.push(limit(effectiveLimit));
  }

  const q = query(inventoryRef, ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((doc) => docToListItem(doc.id, doc.data()));
      if (effectiveLimit !== undefined && items.length >= effectiveLimit) {
        console.warn(
          `[inventory] subscribeToInventory hit the ${effectiveLimit}-row cap. ` +
          `Some items may be omitted. Pass unbounded=true or raise maxResults ` +
          `if this is intentional.`,
        );
      }
      callback(items);
    },
    (error) => {
      console.error('Inventory subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to catalogue inventory items only
 */
export function subscribeToCatalogueInventory(
  callback: (items: InventoryListItem[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return subscribeToInventory(callback, onError, { tier: 'catalogue' });
}

/** @deprecated Use subscribeToCatalogueInventory instead */
export const subscribeToGlobalInventory = subscribeToCatalogueInventory;

/**
 * Get inventory item by ID
 */
export async function getInventoryItem(id: string): Promise<InventoryItem | null> {
  const docRef = doc(inventoryRef, id);
  const snapshot = await getDoc(docRef);

  if (snapshot.exists()) {
    return docToItem(snapshot.id, snapshot.data());
  }
  return null;
}

/**
 * Get inventory item by SKU
 */
export async function getInventoryItemBySku(sku: string): Promise<InventoryItem | null> {
  const q = query(inventoryRef, where('sku', '==', sku));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return docToItem(doc.id, doc.data());
  }
  return null;
}

/**
 * Search inventory items by name, SKU, or alias
 */
export async function searchInventory(
  searchTerm: string,
  options?: {
    category?: InventoryCategory;
    limit?: number;
    itemScope?: 'sku' | 'family' | 'all';
    isOrderable?: boolean;
    isBomSelectable?: boolean;
    familyId?: string;
    classification?: InventoryClassification;
  }
): Promise<InventoryListItem[]> {
  // Firestore doesn't support full-text search, so we fetch and filter client-side
  // For production, consider Algolia or Typesense
  const constraints: QueryConstraint[] = [orderBy('name', 'asc')];

  // If filtering by a specific family's children, use Firestore where clause
  if (options?.familyId) {
    constraints.push(where('familyId', '==', options.familyId));
  }

  const q = query(inventoryRef, ...constraints);
  const snapshot = await getDocs(q);

  const term = searchTerm.toLowerCase().trim();
  let items = snapshot.docs
    .map((d) => docToListItem(d.id, d.data()))
    .filter((item) => {
      const searchable = [
        item.sku,
        item.name,
        item.displayName || '',
        item.subcategory || '',
        item.brand || '',
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(term);
    });

  // Family/SKU scope filtering
  const scope = options?.itemScope ?? 'all';
  if (scope === 'sku') {
    items = items.filter((i) => !i.isFamily);
  } else if (scope === 'family') {
    items = items.filter((i) => i.isFamily);
  }

  // Orderable filter
  if (options?.isOrderable !== undefined) {
    items = items.filter((i) => i.isOrderable === options.isOrderable);
  }

  // BOM-selectable filter
  if (options?.isBomSelectable !== undefined) {
    items = items.filter((i) => i.isBomSelectable === options.isBomSelectable);
  }

  if (options?.category) {
    items = items.filter((i) => i.category === options.category);
  }

  if (options?.classification) {
    items = items.filter((i) => i.classification === options.classification);
  }

  if (options?.limit) {
    items = items.slice(0, options.limit);
  }

  return items;
}

/**
 * Create a new inventory item
 */
export async function createInventoryItem(
  data: InventoryItemFormData,
  userId: string,
  options?: {
    tier?: InventoryTier;
    scopeId?: string;
    source?: InventorySource;
  }
): Promise<string> {
  const now = serverTimestamp();

  // UoM conversion validation
  if (data.purchaseUom && data.stockUom && data.purchaseUom !== data.stockUom) {
    if (!data.uomConversion || data.uomConversion <= 0) {
      throw new Error(
        `UoM conversion required: purchaseUom (${data.purchaseUom}) differs from stockUom (${data.stockUom}). Provide a positive uomConversion value.`
      );
    }
  }

  const docData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    sku: data.sku,
    name: data.name,
    displayName: data.displayName,
    description: data.description || '',
    classification: data.classification,
    brand: data.brand,
    category: data.category,
    subcategory: data.subcategory,
    tags: data.tags || [],
    // Family / SKU hierarchy
    isFamily: data.isFamily || false,
    isOrderable: data.isFamily ? false : (data.isOrderable !== false),
    isBomSelectable: data.isBomSelectable !== false,
    familyId: data.familyId || null,
    variantAttributeDefinitions: data.variantAttributeDefinitions,
    // UoM conversion
    purchaseUom: data.purchaseUom,
    stockUom: data.stockUom,
    consumptionUom: data.consumptionUom,
    uomConversion: data.uomConversion,
    // Parametric hierarchy
    itemType: data.itemType,
    structuredName: data.structuredName,
    engineeringParentId: data.engineeringParentId,
    engineeringFunction: data.engineeringFunction,
    vendorSources: data.vendorSources,
    kitComponents: data.kitComponents,
    parametricTags: data.parametricTags,
    // Finish library & attributes
    finishCategory: data.finishCategory,
    finishSubtype: data.finishSubtype,
    linkedFinishes: data.linkedFinishes,
    linkedFinishIds: data.linkedFinishIds,
    requiredAttributes: data.requiredAttributes,
    attributeConstraints: data.attributeConstraints,
    // Legacy variant support
    parentItemId: data.parentItemId,
    variantAttributes: data.variantAttributes,
    source: options?.source || 'manual',
    tier: options?.tier || 'catalogue',
    restockable: data.restockable ?? true,
    scopeId: options?.scopeId,
    dimensions: data.dimensions,
    grainPattern: data.grainPattern,
    fabricSpec: data.fabricSpec,
    pricing: {
      costPerUnit: data.pricing.costPerUnit,
      currency: data.pricing.currency,
      unit: data.pricing.unit,
    },
    inventory: { inStock: 0 },
    status: data.status,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  // Remove undefined fields (Firebase rejects undefined values)
  const cleanedData = stripUndefined(docData as unknown as Record<string, unknown>);

  const docRef = await addDoc(inventoryRef, cleanedData);
  return docRef.id;
}

/**
 * Update an inventory item
 */
export async function updateInventoryItem(
  id: string,
  data: Partial<InventoryItemFormData>,
  userId: string
): Promise<void> {
  const docRef = doc(inventoryRef, id);
  const existingSnap = await getDoc(docRef);
  if (!existingSnap.exists()) {
    throw new Error('Inventory item not found');
  }
  const existingData = existingSnap.data();
  const existingFamilyId = (existingData.familyId as string | null) || null;
  const nextFamilyId = data.familyId !== undefined ? (data.familyId || null) : existingFamilyId;

  // UoM conversion validation
  if (data.purchaseUom && data.stockUom && data.purchaseUom !== data.stockUom) {
    if (!data.uomConversion || data.uomConversion <= 0) {
      throw new Error(
        `UoM conversion required: purchaseUom (${data.purchaseUom}) differs from stockUom (${data.stockUom}). Provide a positive uomConversion value.`
      );
    }
  }

  const updateData: Record<string, any> = {
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  // Copy over simple fields
  if (data.name !== undefined) updateData.name = data.name;
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.brand !== undefined) updateData.brand = data.brand;
  if (data.classification !== undefined) updateData.classification = data.classification;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.subcategory !== undefined) updateData.subcategory = data.subcategory;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.aliases !== undefined) updateData.aliases = data.aliases;
  if (data.dimensions !== undefined) updateData.dimensions = data.dimensions;
  if (data.grainPattern !== undefined) updateData.grainPattern = data.grainPattern;
  if (data.fabricSpec !== undefined) updateData.fabricSpec = data.fabricSpec;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.parentItemId !== undefined) updateData.parentItemId = data.parentItemId;
  if (data.variantAttributes !== undefined) updateData.variantAttributes = data.variantAttributes;

  // Family / SKU hierarchy fields
  if (data.isFamily !== undefined) updateData.isFamily = data.isFamily;
  if (data.isOrderable !== undefined) updateData.isOrderable = data.isOrderable;
  if (data.isBomSelectable !== undefined) updateData.isBomSelectable = data.isBomSelectable;
  if (data.familyId !== undefined) updateData.familyId = data.familyId;
  if (data.variantAttributeDefinitions !== undefined) updateData.variantAttributeDefinitions = data.variantAttributeDefinitions;

  // UoM conversion fields
  if (data.purchaseUom !== undefined) updateData.purchaseUom = data.purchaseUom;
  if (data.stockUom !== undefined) updateData.stockUom = data.stockUom;
  if (data.consumptionUom !== undefined) updateData.consumptionUom = data.consumptionUom;
  if (data.uomConversion !== undefined) updateData.uomConversion = data.uomConversion;

  // Parametric fields
  if (data.itemType !== undefined) updateData.itemType = data.itemType;
  if (data.structuredName !== undefined) {
    updateData.structuredName = stripUndefined(data.structuredName as Record<string, unknown>);
  }
  if (data.engineeringParentId !== undefined) updateData.engineeringParentId = data.engineeringParentId;
  if (data.engineeringFunction !== undefined) updateData.engineeringFunction = data.engineeringFunction;
  if (data.vendorSources !== undefined) updateData.vendorSources = data.vendorSources;
  if (data.kitComponents !== undefined) updateData.kitComponents = data.kitComponents;
  if (data.parametricTags !== undefined) updateData.parametricTags = data.parametricTags;
  // Finish library & attributes
  if (data.finishCategory !== undefined) updateData.finishCategory = data.finishCategory;
  if (data.finishSubtype !== undefined) updateData.finishSubtype = data.finishSubtype;
  if (data.linkedFinishes !== undefined) updateData.linkedFinishes = data.linkedFinishes;
  if (data.linkedFinishIds !== undefined) updateData.linkedFinishIds = data.linkedFinishIds;
  if (data.requiredAttributes !== undefined) updateData.requiredAttributes = data.requiredAttributes;
  if (data.attributeConstraints !== undefined) updateData.attributeConstraints = data.attributeConstraints;

  // Handle pricing updates
  if (data.pricing) {
    updateData.pricing = {
      costPerUnit: data.pricing.costPerUnit,
      currency: data.pricing.currency,
      unit: data.pricing.unit,
    };
  }

  // Firestore rejects nested `undefined` (for example structuredName.function).
  // Reuse the deep sanitizer used by create flows before writing updates.
  await updateDoc(docRef, stripUndefined(updateData));

  // Keep parent family pricing in sync with active child SKU prices, even when
  // all child stock quantities are zero (fallback to simple average).
  const shouldSyncFamilyPricing =
    data.pricing !== undefined ||
    data.status !== undefined ||
    data.familyId !== undefined;
  if (shouldSyncFamilyPricing) {
    const familyIds = new Set<string>();
    if (existingFamilyId) familyIds.add(existingFamilyId);
    if (nextFamilyId) familyIds.add(nextFamilyId);
    await Promise.all(Array.from(familyIds).map((familyId) => syncFamilyPricingFromActiveSkus(familyId, userId)));
  }
}

/**
 * Delete an inventory item
 */
export async function deleteInventoryItem(id: string): Promise<void> {
  const docRef = doc(inventoryRef, id);
  await deleteDoc(docRef);
}

/**
 * Get active catalogue items (for estimation / health dashboard).
 * Limited to prevent downloading the entire collection.
 */
export async function getActiveCatalogueItems(maxResults = 500): Promise<InventoryItem[]> {
  const q = query(
    inventoryRef,
    where('tier', '==', 'catalogue'),
    where('status', '==', 'active'),
    limit(maxResults)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => docToItem(doc.id, doc.data()));
}

/** @deprecated Use getActiveCatalogueItems instead */
export const getActiveGlobalItems = getActiveCatalogueItems;

/**
 * Promote a project part to a global inventory item
 * This allows reusing custom parts across projects
 */
export interface PromotePartData {
  name: string;
  partNumber?: string;
  supplier: string;
  category: InventoryCategory;
  unitCost: number;
  currency: string;
  description?: string;
  referenceImageUrl?: string;
  purchaseUrl?: string;
  specifications?: Record<string, string>;
}

export async function promotePartToInventory(
  partData: PromotePartData,
  sourcePartId: string,
  userId: string
): Promise<string> {
  const now = serverTimestamp();

  // Generate SKU for the new inventory item
  const sku = generateSku(partData.name, partData.category);

  const docData = {
    sku,
    name: partData.name,
    displayName: partData.name,
    description: partData.description || `Promoted from project part. Supplier: ${partData.supplier}`,
    category: partData.category,
    subcategory: partData.supplier,
    tags: ['promoted-from-part'],
    aliases: partData.partNumber ? [partData.partNumber] : [],
    source: 'parts-promotion' as const,
    promotedFromPartId: sourcePartId,
    tier: 'catalogue' as const,
    restockable: true,
    dimensions: undefined,
    grainPattern: undefined,
    pricing: {
      costPerUnit: partData.unitCost,
      currency: partData.currency,
      unit: 'ea' as const,
    },
    inventory: { inStock: 0 },
    status: 'active' as const,
    metadata: {
      supplierUrl: partData.purchaseUrl,
      referenceImageUrl: partData.referenceImageUrl,
      specifications: partData.specifications,
    },
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(inventoryRef, docData);
  return docRef.id;
}

// ============================================
// Multi-Supplier Pricing Methods
// ============================================

/**
 * Add or update supplier pricing for an inventory item
 * If the supplier already exists in the pricing array, it will be updated
 */
export async function addSupplierPricing(
  inventoryItemId: string,
  pricing: SupplierPricingFormData,
  userId: string,
  setAsPreferred: boolean = false
): Promise<void> {
  const docRef = doc(inventoryRef, inventoryItemId);
  const item = await getInventoryItem(inventoryItemId);
  if (!item) throw new Error('Inventory item not found');

  const newPricing = stripUndefined({
    supplierId: pricing.supplierId,
    supplierName: pricing.supplierName,
    supplierCode: pricing.supplierCode,
    unitPrice: pricing.unitPrice,
    currency: pricing.currency,
    unit: item.pricing?.unit || 'sheet',
    minimumOrder: pricing.minimumOrder,
    leadTimeDays: pricing.leadTimeDays,
    notes: pricing.notes,
    qualityTier: pricing.qualityTier,
    certifications: pricing.certifications,
    brand: pricing.brand,
    bulkDiscountThreshold: pricing.bulkDiscountThreshold,
    bulkDiscountPrice: pricing.bulkDiscountPrice,
    isPreferred: setAsPreferred,
    addedAt: Timestamp.now(),
    addedBy: userId,
  } as Record<string, unknown>) as unknown as SupplierInventoryPricing;

  // Get existing pricing array
  let updatedPricing = item.supplierPricing || [];

  // If setting as preferred, unset others
  if (setAsPreferred) {
    updatedPricing = updatedPricing.map((sp) => ({ ...sp, isPreferred: false }));
  }

  // Check if supplier already exists - update instead of add
  const existingIndex = updatedPricing.findIndex((sp) => sp.supplierId === pricing.supplierId);
  if (existingIndex >= 0) {
    updatedPricing[existingIndex] = newPricing;
  } else {
    updatedPricing.push(newPricing);
  }

  await updateDoc(docRef, {
    supplierPricing: updatedPricing,
    // Also update preferred supplier fields if setting as preferred
    ...(setAsPreferred
      ? {
          preferredSupplierId: pricing.supplierId,
          preferredSupplierName: pricing.supplierName,
        }
      : {}),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Remove supplier pricing from an inventory item
 */
export async function removeSupplierPricing(
  inventoryItemId: string,
  supplierId: string,
  userId: string
): Promise<void> {
  const docRef = doc(inventoryRef, inventoryItemId);
  const item = await getInventoryItem(inventoryItemId);
  if (!item) throw new Error('Inventory item not found');

  const updatedPricing = (item.supplierPricing || []).filter(
    (sp) => sp.supplierId !== supplierId
  );

  // If removing the preferred supplier, clear the preferred fields
  const clearPreferred = item.preferredSupplierId === supplierId;

  await updateDoc(docRef, {
    supplierPricing: updatedPricing,
    ...(clearPreferred
      ? {
          preferredSupplierId: null,
          preferredSupplierName: null,
        }
      : {}),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Set a supplier as the preferred supplier for an inventory item
 */
export async function setPreferredSupplier(
  inventoryItemId: string,
  supplierId: string,
  userId: string
): Promise<void> {
  const docRef = doc(inventoryRef, inventoryItemId);
  const item = await getInventoryItem(inventoryItemId);
  if (!item) throw new Error('Inventory item not found');

  const supplierPricing = item.supplierPricing || [];
  const supplier = supplierPricing.find((sp) => sp.supplierId === supplierId);
  if (!supplier) throw new Error('Supplier not found in pricing list');

  // Update isPreferred flag on all suppliers
  const updatedPricing = supplierPricing.map((sp) => ({
    ...sp,
    isPreferred: sp.supplierId === supplierId,
  }));

  await updateDoc(docRef, {
    supplierPricing: updatedPricing,
    preferredSupplierId: supplierId,
    preferredSupplierName: supplier.supplierName,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Get all suppliers with pricing for an inventory item
 */
export async function getSupplierPricingForItem(
  inventoryItemId: string
): Promise<SupplierInventoryPricing[]> {
  const item = await getInventoryItem(inventoryItemId);
  if (!item) return [];
  return item.supplierPricing || [];
}

// ============================================
// Variant Management Methods
// ============================================

/**
 * Create a variant of an existing item.
 * Uses a transaction to atomically read the parent, create the variant,
 * and update the parent's variantIds in a single round-trip.
 */
export async function createVariant(
  parentItemId: string,
  variantData: InventoryItemFormData,
  userId: string
): Promise<string> {
  return runTransaction(db, async (transaction) => {
    const parentRef = doc(inventoryRef, parentItemId);
    const parentSnap = await transaction.get(parentRef);
    if (!parentSnap.exists()) throw new Error('Parent item not found');

    const parentData = parentSnap.data();
    const variantRef = doc(inventoryRef); // auto-ID

    // Build variant document
    const now = serverTimestamp();
    const mergedData = {
      ...variantData,
      parentItemId,
      tier: parentData.tier || 'catalogue',
      source: parentData.source || 'manual',
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    // Remove undefined fields (Firebase rejects undefined values)
    const cleanedData = stripUndefined(mergedData as unknown as Record<string, unknown>);

    transaction.set(variantRef, cleanedData);

    // Update parent's variantIds
    const existingVariantIds = parentData.variantIds || [];
    transaction.update(parentRef, {
      variantIds: [...existingVariantIds, variantRef.id],
      isVariantParent: true,
      updatedAt: now,
      updatedBy: userId,
    });

    return variantRef.id;
  });
}

/**
 * Get all variants of a parent item
 */
export async function getVariants(parentItemId: string): Promise<InventoryItem[]> {
  const q = query(inventoryRef, where('parentItemId', '==', parentItemId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToItem(d.id, d.data()));
}

/**
 * Remove a variant (delete the variant item and remove from parent's variantIds).
 * Uses a transaction to atomically read both docs, delete the variant,
 * and update the parent in a single round-trip.
 */
export async function removeVariant(
  variantId: string,
  userId: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const variantRef = doc(inventoryRef, variantId);
    const variantSnap = await transaction.get(variantRef);
    if (!variantSnap.exists()) throw new Error('Variant not found');

    const variantData = variantSnap.data();
    if (!variantData.parentItemId) throw new Error('Not a variant');

    const parentRef = doc(inventoryRef, variantData.parentItemId);
    const parentSnap = await transaction.get(parentRef);

    // Delete the variant
    transaction.delete(variantRef);

    // Update parent's variantIds
    if (parentSnap.exists()) {
      const updatedVariantIds = (parentSnap.data().variantIds || []).filter(
        (id: string) => id !== variantId
      );
      transaction.update(parentRef, {
        variantIds: updatedVariantIds,
        isVariantParent: updatedVariantIds.length > 0,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }
  });
}

// ============================================
// Family / SKU Hierarchy Management
// ============================================

/**
 * Generate a variant SKU code from a family SKU and variant attributes.
 * Format: {FAMILY_SKU}-{ATTR_ABBREVIATIONS}
 * Example: MAH-25x100-A
 */
export function generateVariantSku(
  familySku: string,
  attributes: VariantAttribute[],
): string {
  const attrParts = attributes
    .map((attr) => {
      const val = attr.value
        .replace(/[^A-Za-z0-9]/g, '')
        .substring(0, 6)
        .toUpperCase();
      return val;
    })
    .filter(Boolean);

  return `${familySku}-${attrParts.join('-')}`;
}

/**
 * Generate a variant display name from a family name and variant attributes.
 * Format: {Family Name} – {attr values joined by " / "}
 * Example: "Mahogany Timber – 25x100mm / Grade A"
 */
export function generateVariantName(
  familyName: string,
  attributes: VariantAttribute[],
): string {
  if (attributes.length === 0) return familyName;
  const attrValues = attributes.map((a) => a.value).join(' / ');
  return `${familyName} – ${attrValues}`;
}

/**
 * Create a family record (parent / non-transactable).
 * Families have isFamily=true, isOrderable=false, and no stock.
 */
export async function createFamily(
  data: FamilyFormData,
  userId: string,
): Promise<string> {
  const now = serverTimestamp();
  const sku = generateSku(data.name, data.category);

  const docData = {
    sku,
    name: data.name,
    displayName: data.name,
    description: data.description || '',
    classification: data.classification,
    category: data.category,
    subcategory: data.subcategory,
    tags: data.tags || [],
    // Family hierarchy — enforced
    isFamily: true,
    isOrderable: false,
    isBomSelectable: false,
    familyId: null,
    skuIds: [],
    variantAttributeDefinitions: data.variantAttributeDefinitions,
    // Defaults
    source: 'manual' as const,
    tier: 'catalogue' as InventoryTier,
    restockable: true,
    pricing: {
      costPerUnit: 0,
      currency: 'UGX',
      unit: data.defaultUom || 'ea',
    },
    inventory: { inStock: 0 },
    status: 'active' as InventoryStatus,
    // Supplier
    preferredSupplierId: data.supplierId,
    preferredSupplierName: data.supplierName,
    // Metadata
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const cleanedData = stripUndefined(docData as unknown as Record<string, unknown>);

  const docRef = await addDoc(inventoryRef, cleanedData);
  return docRef.id;
}

/**
 * Create a SKU under a family.
 * Uses a transaction to atomically create the SKU and update the family's skuIds.
 */
export async function createFamilySku(
  familyId: string,
  skuData: SkuFormData,
  userId: string,
): Promise<string> {
  const normalizeVariantSignature = (attrs: VariantAttribute[]): string =>
    attrs
      .map((attr) => `${attr.key.trim().toLowerCase()}:${attr.value.trim().toLowerCase()}`)
      .sort()
      .join('|');

  const inputSku = skuData.sku?.trim() || '';

  const familyPreview = await getInventoryItem(familyId);
  if (!familyPreview || !familyPreview.isFamily) {
    throw new Error('Family not found');
  }

  const generatedPreviewSku = generateVariantSku(familyPreview.sku, skuData.variantAttributes);
  const targetSku = inputSku || generatedPreviewSku;
  const existingTargetSku = await getInventoryItemBySku(targetSku);
  if (existingTargetSku) {
    throw new Error(`SKU "${targetSku}" already exists. Change attributes or set a unique SKU override.`);
  }

  const requestedSignature = normalizeVariantSignature(skuData.variantAttributes || []);
  const existingFamilySkus = await getFamilySkus(familyId);
  const duplicateFamilySku = existingFamilySkus.find(
    (item) => normalizeVariantSignature(item.variantAttributes || []) === requestedSignature,
  );
  if (duplicateFamilySku) {
    throw new Error(
      `A SKU with the same variant attributes already exists (${duplicateFamilySku.sku}). Update attributes to keep SKUs unique.`,
    );
  }

  const skuId = await runTransaction(db, async (transaction) => {
    const familyRef = doc(inventoryRef, familyId);
    const familySnap = await transaction.get(familyRef);
    if (!familySnap.exists()) throw new Error('Family not found');

    const familyData = familySnap.data();
    if (!familyData.isFamily) throw new Error('Target item is not a family record');

    // Validate that variant attributes cover all required definitions
    const requiredAttrs: string[] = familyData.variantAttributeDefinitions || [];
    const providedKeys = (skuData.variantAttributes || []).map((a: VariantAttribute) => a.key);
    const missingAttrs = requiredAttrs.filter((k) => !providedKeys.includes(k));
    if (missingAttrs.length > 0) {
      throw new Error(
        `Missing required variant attributes: ${missingAttrs.join(', ')}`,
      );
    }

    // Auto-generate SKU code and name if not manually provided
    const autoSku = inputSku || generateVariantSku(familyData.sku, skuData.variantAttributes);
    const autoName = skuData.name || generateVariantName(familyData.name, skuData.variantAttributes);
    const mergedStructuredName = stripUndefined({
      ...(familyData.structuredName || {}),
      ...(skuData.structuredName || {}),
    } as Record<string, unknown>);
    const hasStructuredName = Object.keys(mergedStructuredName).length > 0;
    const inheritedPricing = skuData.pricing
      ? {
          costPerUnit: skuData.pricing.costPerUnit,
          currency: skuData.pricing.currency,
          unit: skuData.pricing.unit,
        }
      : {
          costPerUnit: familyData.pricing?.costPerUnit || 0,
          currency: familyData.pricing?.currency || 'UGX',
          unit: familyData.pricing?.unit || 'ea',
        };
    const composedDisplayName = hasStructuredName
      ? `${buildDisplayName({
          category: familyData.category,
          subcategory: familyData.subcategory,
          structuredName: mergedStructuredName as StructuredName,
        })} - ${skuData.variantAttributes.map((a: VariantAttribute) => a.value).join(' / ')}`
      : autoName;

    const skuRef = doc(inventoryRef); // auto-ID
    const now = serverTimestamp();

    // Transaction-level duplicate guard: compare with existing child SKUs in this family.
    const existingSkuIds: string[] = familyData.skuIds || [];
    if (existingSkuIds.length > 0) {
      const childRefs = existingSkuIds.map((id) => doc(inventoryRef, id));
      const childSnaps = await Promise.all(childRefs.map((ref) => transaction.get(ref)));
      for (const childSnap of childSnaps) {
        if (!childSnap.exists()) continue;
        const childData = childSnap.data();
        const childSignature = normalizeVariantSignature(childData.variantAttributes || []);
        if (childData.sku === autoSku) {
          throw new Error(`SKU "${autoSku}" already exists in this family.`);
        }
        if (childSignature && childSignature === requestedSignature) {
          throw new Error('A SKU with the same variant attributes already exists in this family.');
        }
      }
    }

    const skuDoc = {
      sku: autoSku,
      name: autoName,
      displayName: skuData.displayName || composedDisplayName,
      description: skuData.description || '',
      classification: familyData.classification as InventoryClassification,
      category: familyData.category,
      subcategory: familyData.subcategory,
      brand: skuData.brand || familyData.brand,
      tags: skuData.tags || familyData.tags || [],
      // SKU hierarchy
      isFamily: false,
      isOrderable: true,
      isBomSelectable: skuData.isBomSelectable !== false,
      familyId,
      // Variant attributes
      variantAttributes: skuData.variantAttributes,
      // UoM
      purchaseUom: skuData.purchaseUom ?? familyData.purchaseUom,
      stockUom: skuData.stockUom ?? familyData.stockUom,
      consumptionUom: skuData.consumptionUom ?? familyData.consumptionUom,
      uomConversion: skuData.uomConversion ?? familyData.uomConversion,
      // Inherit from family
      preferredSupplierId: familyData.preferredSupplierId,
      preferredSupplierName: familyData.preferredSupplierName,
      itemType: skuData.itemType || familyData.itemType,
      structuredName: hasStructuredName ? mergedStructuredName : undefined,
      // Pricing
      pricing: inheritedPricing,
      // Inventory
      inventory: { inStock: 0 },
      status: skuData.status || 'active',
      source: 'manual' as const,
      tier: (familyData.tier || 'catalogue') as InventoryTier,
      // Dimensions
      dimensions: skuData.dimensions || familyData.dimensions,
      grainPattern: skuData.grainPattern || familyData.grainPattern,
      fabricSpec: skuData.fabricSpec || familyData.fabricSpec,
      // Metadata
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    // Remove undefined fields (Firebase rejects undefined values)
    const cleanedData = stripUndefined(skuDoc as unknown as Record<string, unknown>);

    transaction.set(skuRef, cleanedData);

    // Update family's skuIds
    transaction.update(familyRef, {
      skuIds: [...existingSkuIds, skuRef.id],
      updatedAt: now,
      updatedBy: userId,
    });

    return skuRef.id;
  });

  await syncFamilyPricingFromActiveSkus(familyId, userId);
  return skuId;
}

/**
 * Get a family with all its child SKUs
 */
export async function getFamilyWithSkus(
  familyId: string,
): Promise<{ family: InventoryItem; skus: InventoryItem[] } | null> {
  const family = await getInventoryItem(familyId);
  if (!family || !family.isFamily) return null;

  const q = query(inventoryRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);
  const skus = snapshot.docs.map((d) => docToItem(d.id, d.data()));

  return { family, skus };
}

/**
 * Get stock rollup for a family (computed from child SKUs' stock levels)
 */
export async function getFamilyStockRollup(
  familyId: string,
): Promise<FamilyStockRollup | null> {
  const result = await getFamilyWithSkus(familyId);
  if (!result) return null;

  const { family, skus } = result;
  const activeSkus = skus.filter((s) => s.status === 'active');
  const totalStock = activeSkus.reduce((sum, s) => sum + (s.inventory?.inStock ?? 0), 0);

  const valuationRows = activeSkus
    .map((sku) => ({
      sku,
      valuation: getSkuValuationCostBasis(sku),
      qty: sku.inventory?.inStock ?? 0,
    }))
    .filter((row): row is { sku: InventoryItem; valuation: { cost: number; currency: string; unit: InventoryUnit }; qty: number } => !!row.valuation);

  // Keep family pricing coherent on one valuation unit; mixed units should not be blended.
  const primaryUnit = valuationRows[0]?.valuation.unit;
  const normalizedRows = primaryUnit
    ? valuationRows.filter((row) => row.valuation.unit === primaryUnit)
    : [];

  const costs = normalizedRows
    .map((row) => row.valuation.cost)
    .filter((cost) => cost > 0);

  // Weighted average valuation cost: sum(cost * qty) / sum(qty)
  const valuationQty = normalizedRows.reduce((sum, row) => sum + row.qty, 0);
  const weightedSum = normalizedRows.reduce((sum, row) => sum + (row.valuation.cost * row.qty), 0);
  const weightedAvgCost = valuationQty > 0 ? weightedSum / valuationQty : 0;
  const simpleAvgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

  // Family valuation costs are maintained in functional currency.
  const currency = FUNCTIONAL_CURRENCY;

  return {
    familyId,
    familyName: family.name,
    variantCount: activeSkus.length,
    totalStockQty: totalStock,
    priceFrom: costs.length > 0 ? Math.min(...costs) : 0,
    priceTo: costs.length > 0 ? Math.max(...costs) : 0,
    costFrom: costs.length > 0 ? Math.min(...costs) : 0,
    costTo: costs.length > 0 ? Math.max(...costs) : 0,
    weightedAvgCost,
    simpleAvgCost,
    currency,
  };
}

/**
 * Bulk-generate SKUs from attribute combinations.
 * Given a family and an array of attribute maps, creates one SKU per combination.
 *
 * Example:
 *   bulkGenerateSkus(familyId, [
 *     { color: "Black", fabric: "Linen" },
 *     { color: "White", fabric: "Linen" },
 *     { color: "Black", fabric: "Velvet" },
 *   ], userId)
 */
export async function bulkGenerateSkus(
  familyId: string,
  attributeCombinations: Record<string, string>[],
  userId: string,
  pricingOverride?: { costPerUnit: number; currency: string; unit: InventoryUnit },
): Promise<string[]> {
  const family = await getInventoryItem(familyId);
  if (!family || !family.isFamily) {
    throw new Error('Family not found or item is not a family record');
  }

  const ids: string[] = [];

  for (const combo of attributeCombinations) {
    const variantAttributes: VariantAttribute[] = Object.entries(combo).map(
      ([key, value]) => ({ key, value }),
    );

    const skuData: SkuFormData = {
      sku: '', // auto-generated
      name: '', // auto-generated
      category: family.category,
      status: 'active',
      pricing: pricingOverride || family.pricing || { costPerUnit: 0, currency: 'UGX', unit: 'ea' },
      variantAttributes,
    };

    const id = await createFamilySku(familyId, skuData, userId);
    ids.push(id);
  }

  return ids;
}

/**
 * Get all family records, optionally filtered by classification
 */
export async function getFamilies(
  classification?: InventoryClassification,
): Promise<InventoryItem[]> {
  const constraints: QueryConstraint[] = [
    where('isFamily', '==', true),
  ];

  if (classification) {
    constraints.push(where('classification', '==', classification));
  }

  constraints.push(orderBy('name', 'asc'));

  const q = query(inventoryRef, ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToItem(d.id, d.data()));
}

/**
 * Get all flat SKUs (items with no family), optionally filtered
 */
export async function getFlatSkus(
  options?: {
    classification?: InventoryClassification;
    isOrderable?: boolean;
    maxResults?: number;
  },
): Promise<InventoryItem[]> {
  // Firestore can't query for null/missing fields easily,
  // so we query for isFamily != true and filter client-side for no familyId
  const constraints: QueryConstraint[] = [];

  if (options?.classification) {
    constraints.push(where('classification', '==', options.classification));
  }

  constraints.push(orderBy('name', 'asc'));
  constraints.push(limit(options?.maxResults ?? 500));

  const q = query(inventoryRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => docToItem(d.id, d.data()))
    .filter((item) => !item.isFamily && !item.familyId)
    .filter((item) => options?.isOrderable === undefined || item.isOrderable === options.isOrderable);
}

/**
 * Get SKUs for a specific family
 */
export async function getFamilySkus(familyId: string): Promise<InventoryItem[]> {
  // Fetch all SKUs linked by familyId, regardless of status.
  // Child rows in InventoryList render status badges, so filtering to "active"
  // here can make families show a non-zero count but no visible children.
  const q = query(
    inventoryRef,
    where('familyId', '==', familyId),
  );
  const snapshot = await getDocs(q);

  const byId = new Map<string, InventoryItem>();
  for (const d of snapshot.docs) {
    byId.set(d.id, docToItem(d.id, d.data()));
  }

  // Backfill from family's skuIds for legacy data where child docs may be linked
  // in the parent but missing familyId.
  const family = await getInventoryItem(familyId);
  const skuIds = family?.skuIds || [];
  const missingSkuIds = skuIds.filter((id) => !byId.has(id));

  if (missingSkuIds.length > 0) {
    const docs = await Promise.all(
      missingSkuIds.map((id) => getDoc(doc(inventoryRef, id))),
    );
    for (const skuDoc of docs) {
      if (!skuDoc.exists()) continue;
      byId.set(skuDoc.id, docToItem(skuDoc.id, skuDoc.data()));
    }
  }

  return Array.from(byId.values())
    .filter((item) => item.id !== familyId && !item.isFamily)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Remove a SKU from a family.
 * Uses a transaction to delete the SKU and update the family's skuIds.
 */
export async function removeFamilySku(
  skuId: string,
  userId: string,
): Promise<void> {
  let removedFromFamilyId: string | null = null;

  await runTransaction(db, async (transaction) => {
    const skuRef = doc(inventoryRef, skuId);
    const skuSnap = await transaction.get(skuRef);
    if (!skuSnap.exists()) throw new Error('SKU not found');

    const skuData = skuSnap.data();
    if (!skuData.familyId) throw new Error('Item is not part of a family');
    removedFromFamilyId = skuData.familyId;

    const familyRef = doc(inventoryRef, skuData.familyId);
    const familySnap = await transaction.get(familyRef);

    // Delete the SKU
    transaction.delete(skuRef);

    // Update family's skuIds
    if (familySnap.exists()) {
      const updatedSkuIds = (familySnap.data().skuIds || []).filter(
        (id: string) => id !== skuId,
      );
      transaction.update(familyRef, {
        skuIds: updatedSkuIds,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }
  });

  if (removedFromFamilyId) {
    await syncFamilyPricingFromActiveSkus(removedFromFamilyId, userId);
  }
}

// ============================================
// Convert to Family
// ============================================

/**
 * Convert an inventory item into a Family parent.
 * Uses a transaction to atomically flip the hierarchy fields.
 *
 * If the item is a legacy variant parent (`isVariantParent` with `variantIds`),
 * the existing children are adopted: each child gets `familyId` set and
 * `parentItemId` cleared, and the parent's `skuIds` is initialised from
 * the old `variantIds`.
 *
 * Pre-conditions:
 *  - Item exists and is not already a family
 *  - Item is not a child of another family/parent
 *  - At least one variant attribute definition is provided
 */
export async function convertToFamily(
  itemId: string,
  variantAttributeDefinitions: string[],
  userId: string,
): Promise<void> {
  if (!variantAttributeDefinitions.length) {
    throw new Error('At least one variant attribute definition is required (e.g. "size", "color")');
  }

  await runTransaction(db, async (transaction) => {
    const itemRef = doc(inventoryRef, itemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error('Item not found');

    const data = itemSnap.data();

    if (data.isFamily) throw new Error('Item is already a family');
    if (data.familyId) throw new Error('Item belongs to a family — remove from family first');
    if (data.parentItemId) throw new Error('Item is a variant child — detach from parent first');

    const now = serverTimestamp();
    const legacyChildIds: string[] = data.variantIds || [];

    // Adopt legacy variant children — read them all inside the transaction
    // so we can update them atomically.
    if (legacyChildIds.length > 0) {
      const childRefs = legacyChildIds.map((id) => doc(inventoryRef, id));
      const childSnaps = await Promise.all(childRefs.map((r) => transaction.get(r)));

      for (let i = 0; i < childSnaps.length; i++) {
        const childSnap = childSnaps[i];
        if (!childSnap.exists()) continue; // orphaned ref — skip
        transaction.update(childRefs[i], {
          familyId: itemId,
          parentItemId: deleteField(),
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    // Flip the parent to a modern family
    transaction.update(itemRef, {
      isFamily: true,
      isOrderable: false,
      isBomSelectable: false,
      skuIds: legacyChildIds,
      variantAttributeDefinitions,
      // Clean up legacy fields
      isVariantParent: deleteField(),
      variantIds: deleteField(),
      updatedAt: now,
      updatedBy: userId,
    });
  });
}

// ============================================
// Reclassify & Delete Management
// ============================================

/**
 * Reclassify an existing standalone item as a variant of another item.
 * Uses a transaction to atomically update both the source item and the parent.
 */
export async function reclassifyAsVariant(
  itemId: string,
  parentId: string,
  variantAttributes: VariantAttribute[],
  userId: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const itemRef = doc(inventoryRef, itemId);
    const parentRef = doc(inventoryRef, parentId);
    const [itemSnap, parentSnap] = [
      await transaction.get(itemRef),
      await transaction.get(parentRef),
    ];

    if (!itemSnap.exists()) throw new Error('Item not found');
    if (!parentSnap.exists()) throw new Error('Parent item not found');

    const itemData = itemSnap.data();
    const parentData = parentSnap.data();

    // Validations
    if (itemId === parentId) throw new Error('Cannot make an item a variant of itself');
    if (itemData.parentItemId) throw new Error('Item is already a variant of another item');
    if (itemData.isVariantParent && (itemData.variantIds?.length ?? 0) > 0) {
      throw new Error('Item is a variant parent with children — detach children first');
    }
    if (itemData.isFamily) throw new Error('Item is a family parent — cannot reclassify as variant');
    if (itemData.familyId) throw new Error('Item belongs to a family — remove from family first');
    if (parentData.parentItemId) throw new Error('Parent is itself a variant — choose a top-level item');
    if (parentData.familyId) throw new Error('Parent belongs to a family — choose a top-level item or family');

    // Update source item: set parentItemId + variantAttributes
    const now = serverTimestamp();
    transaction.update(itemRef, {
      parentItemId: parentId,
      variantAttributes: variantAttributes.length > 0 ? variantAttributes : [],
      updatedAt: now,
      updatedBy: userId,
    });

    // Update parent: add to variantIds, flag as variant parent
    const existingVariantIds: string[] = parentData.variantIds || [];
    transaction.update(parentRef, {
      variantIds: [...existingVariantIds, itemId],
      isVariantParent: true,
      updatedAt: now,
      updatedBy: userId,
    });
  });
}

/**
 * Reclassify an existing item as a SKU of a family.
 * Converts a standalone item into a child of a family record,
 * setting familyId and variant attributes atomically.
 */
export async function reclassifyAsSkuOfFamily(
  itemId: string,
  familyId: string,
  variantAttributes: VariantAttribute[],
  userId: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const itemRef = doc(inventoryRef, itemId);
    const familyRef = doc(inventoryRef, familyId);
    const [itemSnap, familySnap] = [
      await transaction.get(itemRef),
      await transaction.get(familyRef),
    ];

    if (!itemSnap.exists()) throw new Error('Item not found');
    if (!familySnap.exists()) throw new Error('Family not found');

    const itemData = itemSnap.data();
    const familyData = familySnap.data();

    // Validations
    if (itemId === familyId) throw new Error('Cannot make an item a SKU of itself');
    if (!familyData.isFamily) throw new Error('Target is not a family record');
    if (itemData.familyId) throw new Error('Item already belongs to a family');
    if (itemData.isFamily) throw new Error('Item is itself a family — cannot reclassify as SKU');
    if (itemData.isVariantParent && (itemData.variantIds?.length ?? 0) > 0) {
      throw new Error('Item is a variant parent with children — detach children first');
    }

    // Validate variant attributes cover required definitions
    const requiredAttrs: string[] = familyData.variantAttributeDefinitions || [];
    const providedKeys = variantAttributes.map((a) => a.key);
    const missingAttrs = requiredAttrs.filter((k) => !providedKeys.includes(k));
    if (missingAttrs.length > 0) {
      throw new Error(`Missing required variant attributes: ${missingAttrs.join(', ')}`);
    }

    const now = serverTimestamp();

    // Update item: assign to family, inherit category if needed
    const itemUpdate: Record<string, unknown> = {
      familyId,
      variantAttributes: variantAttributes.length > 0 ? variantAttributes : [],
      isFamily: false,
      isOrderable: true,
      isBomSelectable: true,
      updatedAt: now,
      updatedBy: userId,
    };

    // Inherit category/subcategory/classification from family if item has "other"
    if (itemData.category === 'other' && familyData.category && familyData.category !== 'other') {
      itemUpdate.category = familyData.category;
    }
    if (itemData.subcategory === 'other' && familyData.subcategory && familyData.subcategory !== 'other') {
      itemUpdate.subcategory = familyData.subcategory;
    }
    if ((!itemData.classification || itemData.classification === 'other') && familyData.classification) {
      itemUpdate.classification = familyData.classification;
    }

    // Clear legacy variant fields if present
    if (itemData.parentItemId) {
      itemUpdate.parentItemId = null;
    }
    if (itemData.isVariantParent) {
      itemUpdate.isVariantParent = false;
    }

    transaction.update(itemRef, itemUpdate);

    // Update family: add to skuIds
    const existingSkuIds: string[] = familyData.skuIds || [];
    if (!existingSkuIds.includes(itemId)) {
      transaction.update(familyRef, {
        skuIds: [...existingSkuIds, itemId],
        updatedAt: now,
        updatedBy: userId,
      });
    }
  });

  await syncFamilyPricingFromActiveSkus(familyId, userId);
}

/**
 * Recompute and persist family average cost from active child SKUs.
 * This intentionally uses simple average of priced children so families keep a
 * meaningful parent price even when all child stock quantities are zero.
 */
async function syncFamilyPricingFromActiveSkus(
  familyId: string,
  userId: string,
): Promise<void> {
  const familyRef = doc(inventoryRef, familyId);
  const [familySnap, skusSnap] = await Promise.all([
    getDoc(familyRef),
    getDocs(query(inventoryRef, where('familyId', '==', familyId))),
  ]);
  if (!familySnap.exists()) return;

  const familyData = familySnap.data();
  const childSkus = skusSnap.docs.map((d) => docToItem(d.id, d.data()));
  const activeSkus = childSkus
    .filter((sku) => sku.status === 'active')
    .map((sku) => ({ sku, valuation: getSkuValuationCostBasis(sku) }))
    .filter((row): row is { sku: InventoryItem; valuation: { cost: number; currency: string; unit: InventoryUnit } } => !!row.valuation)
    .filter((row) => row.valuation.cost > 0);

  const primaryUnit = activeSkus[0]?.valuation.unit;
  const normalizedSkus = primaryUnit
    ? activeSkus.filter((row) => row.valuation.unit === primaryUnit)
    : [];

  const averageCost = normalizedSkus.length > 0
    ? normalizedSkus.reduce((sum, row) => sum + row.valuation.cost, 0) / normalizedSkus.length
    : 0;

  const currency = FUNCTIONAL_CURRENCY;
  const unit =
    primaryUnit ||
    familyData.stockUom ||
    familyData.pricing?.unit ||
    'ea';

  await updateDoc(familyRef, {
    pricing: {
      ...(familyData.pricing || {}),
      costPerUnit: averageCost,
      currency,
      unit,
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Derive stock-facing valuation cost basis from SKU:
 * - starts from functional currency cost (UGX),
 * - then applies purchase->stock UoM conversion when needed.
 */
function getSkuValuationCostBasis(
  sku: InventoryItem,
): { cost: number; currency: string; unit: InventoryUnit } | null {
  // Volume-priced items (notably timber) should remain on m³ basis so
  // family rollups preserve volumetric pricing semantics.
  if (
    sku.pricing?.pricingBasis === 'per-cbm' &&
    (sku.pricing.costPerCubicMetre || 0) > 0
  ) {
    return {
      cost: sku.pricing.costPerCubicMetre as number,
      currency: FUNCTIONAL_CURRENCY,
      unit: 'cbm',
    };
  }

  const purchaseCost = sku.pricing?.costPerUnit || 0;
  if (purchaseCost <= 0) return null;

  const purchaseCurrency = sku.pricing?.currency || FUNCTIONAL_CURRENCY;
  const functionalCost =
    sku.pricing?.functionalCurrencyCost ??
    (purchaseCurrency === FUNCTIONAL_CURRENCY ? purchaseCost : undefined);
  if (functionalCost == null || functionalCost <= 0) return null;

  const purchaseUom = sku.purchaseUom || sku.pricing?.unit;
  const stockUom = sku.stockUom || purchaseUom || sku.pricing?.unit;
  if (!stockUom) return null;

  if (purchaseUom && purchaseUom !== stockUom) {
    const conv = sku.uomConversion || 0;
    if (conv <= 0) return null;
    return { cost: functionalCost / conv, currency: FUNCTIONAL_CURRENCY, unit: stockUom };
  }

  return { cost: functionalCost, currency: FUNCTIONAL_CURRENCY, unit: stockUom };
}

/**
 * Batch reclassify multiple items as SKUs of a single family.
 * Each item is processed in its own transaction for safety.
 */
export async function batchReclassifyAsSkusOfFamily(
  itemIds: string[],
  familyId: string,
  variantAttributesMap: Record<string, VariantAttribute[]>,
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ successCount: number; failureCount: number; results: Array<{ itemId: string; success: boolean; error?: string }> }> {
  const results: Array<{ itemId: string; success: boolean; error?: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < itemIds.length; i++) {
    const id = itemIds[i];
    try {
      await reclassifyAsSkuOfFamily(id, familyId, variantAttributesMap[id] || [], userId);
      successCount++;
      results.push({ itemId: id, success: true });
    } catch (err) {
      failureCount++;
      results.push({ itemId: id, success: false, error: (err as Error).message });
    }
    onProgress?.(i + 1, itemIds.length);
  }

  return { successCount, failureCount, results };
}

/**
 * Batch reclassify multiple items as variants of a single parent.
 * Each item is processed in its own transaction for safety.
 */
export async function batchReclassifyAsVariants(
  itemIds: string[],
  parentId: string,
  variantAttributesMap: Record<string, VariantAttribute[]>,
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ successCount: number; failureCount: number; results: Array<{ itemId: string; success: boolean; error?: string }> }> {
  const results: Array<{ itemId: string; success: boolean; error?: string }> = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < itemIds.length; i++) {
    const id = itemIds[i];
    try {
      await reclassifyAsVariant(id, parentId, variantAttributesMap[id] || [], userId);
      successCount++;
      results.push({ itemId: id, success: true });
    } catch (err) {
      failureCount++;
      results.push({ itemId: id, success: false, error: (err as Error).message });
    }
    onProgress?.(i + 1, itemIds.length);
  }

  return { successCount, failureCount, results };
}

/**
 * Pre-delete safety check — returns warnings about stock, children, etc.
 * Does NOT delete anything.
 */
export async function checkDeleteSafety(itemId: string): Promise<DeleteSafetyCheck> {
  const item = await getInventoryItem(itemId);
  if (!item) throw new Error('Item not found');

  const warnings: string[] = [];

  // Check stock levels (per-warehouse)
  const stockLevelsData = await getStockLevels(itemId);
  const nonEmptyLevels = stockLevelsData.filter(sl => sl.quantityOnHand > 0);
  const totalOnHand = nonEmptyLevels.reduce((sum, sl) => sum + sl.quantityOnHand, 0);
  const aggregateInStock = item.inventory?.inStock || 0;
  const stockQty = Math.max(totalOnHand, aggregateInStock);
  const hasStock = stockQty > 0;

  if (hasStock) {
    warnings.push(
      `Item has ${stockQty} units in stock across ${nonEmptyLevels.length} location(s). Transfer stock before deleting.`,
    );
  }

  // Check variant parent status
  const isVariantParent = item.isVariantParent || false;
  const variantCount = item.variantIds?.length || 0;
  if (isVariantParent && variantCount > 0) {
    warnings.push(
      `Item is a parent of ${variantCount} variant(s). Variants will be detached (orphaned).`,
    );
  }

  // Check family parent status
  const isFamilyParent = item.isFamily || false;
  const skuCount = item.skuIds?.length || 0;
  if (isFamilyParent && skuCount > 0) {
    warnings.push(
      `Item is a family parent with ${skuCount} SKU(s). Delete or reassign SKUs first.`,
    );
  }

  return {
    itemId,
    itemName: item.displayName || item.name,
    hasStock,
    stockQty,
    warehouseStockLevels: nonEmptyLevels.map(sl => ({
      warehouseId: sl.warehouseId,
      warehouseName: sl.itemName || sl.warehouseId,
      qty: sl.quantityOnHand,
    })),
    isVariantParent,
    variantCount,
    isFamilyParent,
    skuCount,
    warnings,
  };
}

/**
 * Safely delete an inventory item, handling variant parent/child cleanup.
 * Uses a transaction to:
 *  - If item is a variant child → remove from parent's variantIds
 *  - If item is a variant parent → orphan children (clear parentItemId)
 *  - Delete the item document
 */
export async function safeDeleteItem(
  itemId: string,
  userId: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const itemRef = doc(inventoryRef, itemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error('Item not found');

    const itemData = itemSnap.data();
    const now = serverTimestamp();

    // If item is a variant child, remove from parent's variantIds
    if (itemData.parentItemId) {
      const parentRef = doc(inventoryRef, itemData.parentItemId);
      const parentSnap = await transaction.get(parentRef);
      if (parentSnap.exists()) {
        const updatedVariantIds = (parentSnap.data().variantIds || []).filter(
          (id: string) => id !== itemId,
        );
        transaction.update(parentRef, {
          variantIds: updatedVariantIds,
          isVariantParent: updatedVariantIds.length > 0,
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    // If item is a variant parent, orphan children
    if (itemData.isVariantParent && itemData.variantIds?.length > 0) {
      for (const variantId of itemData.variantIds) {
        const variantRef = doc(inventoryRef, variantId);
        transaction.update(variantRef, {
          parentItemId: null,
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    // Delete the item
    transaction.delete(itemRef);
  });
}
