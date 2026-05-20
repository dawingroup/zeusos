/**
 * Kit Service
 *
 * Manages kit (phantom assembly) items. Kits group component items together
 * but are non-inventoried — stock is tracked on individual components.
 *
 * Key operations:
 * - createKit: creates a kit item with kitComponents[]
 * - expandKit: flattens a kit into BOM-ready component lines
 * - getKitCost: computes total cost from component costs
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  InventoryCategory,
  KitComponent,
  InventoryUnit,
  StructuredName,
} from '../types';
import { generateSmartSku } from './inventoryService';

const COLLECTION_NAME = 'inventoryItems';
const inventoryRef = collection(db, COLLECTION_NAME);

// ============================================
// Types
// ============================================

export interface KitDefinition {
  name: string;
  displayName?: string;
  description?: string;
  category: InventoryCategory;
  subcategory?: string;
  structuredName?: StructuredName;
  components: KitComponentInput[];
  tags?: string[];
  parametricTags?: Record<string, string>;
}

export interface KitComponentInput {
  inventoryItemId: string;
  quantity: number;
  isOptional?: boolean;
  notes?: string;
}

export interface ExpandedKitLine {
  inventoryItemId: string;
  sku: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  kitSourceId: string;
  kitSourceName: string;
  isOptional: boolean;
  notes?: string;
}

// ============================================
// Kit Creation
// ============================================

/**
 * Create a kit (phantom assembly) item.
 * Resolves component details from inventory and caches them on the kit.
 */
export async function createKit(
  definition: KitDefinition,
  userId: string,
): Promise<string> {
  // Resolve component details
  const resolvedComponents: KitComponent[] = [];

  for (const comp of definition.components) {
    const itemDoc = await getDoc(doc(inventoryRef, comp.inventoryItemId));
    if (!itemDoc.exists()) {
      throw new Error(`Component item not found: ${comp.inventoryItemId}`);
    }
    const itemData = itemDoc.data();

    // Kits cannot contain other kits
    if (itemData.itemType === 'kit') {
      throw new Error(`Cannot add kit "${itemData.name}" as a component. Kits cannot contain other kits.`);
    }

    resolvedComponents.push({
      inventoryItemId: comp.inventoryItemId,
      sku: itemData.sku || '',
      name: itemData.displayName || itemData.name || '',
      quantity: comp.quantity,
      unit: itemData.pricing?.unit || 'ea',
      isOptional: comp.isOptional,
      notes: comp.notes,
    });
  }

  // Generate smart SKU for the kit
  const sku = generateSmartSku({
    category: definition.category,
    subcategory: definition.subcategory,
    engineeringFunction: definition.structuredName?.function,
    keySpecs: definition.structuredName?.keySpecs,
    qualityTier: definition.structuredName?.qualityTier,
    itemType: 'kit',
  });

  const now = serverTimestamp();

  const kitData = {
    sku,
    name: definition.name,
    displayName: definition.displayName || definition.name,
    description: definition.description || `Kit: ${resolvedComponents.map(c => c.name).join(' + ')}`,
    classification: 'kit',
    category: definition.category,
    subcategory: definition.subcategory,
    itemType: 'kit',
    structuredName: definition.structuredName,
    kitComponents: resolvedComponents,
    tags: definition.tags || ['kit'],
    parametricTags: definition.parametricTags,
    // Kits have zero stock — stock is tracked on components
    pricing: { costPerUnit: 0, currency: 'UGX', unit: 'ea' as InventoryUnit },
    inventory: { inStock: 0 },
    source: 'manual',
    tier: 'catalogue',
    status: 'active',
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(inventoryRef, kitData);
  return docRef.id;
}

// ============================================
// Kit Expansion (for BOM generation)
// ============================================

/**
 * Expand a kit item into its component lines for BOM insertion.
 * Each component becomes a separate BOM entry with:
 * - Live cost lookup from the component's current pricing
 * - kitSourceId linking back to the kit item
 * - Quantity multiplied by the requested kit quantity
 *
 * @param kitItemId - The kit inventory item ID
 * @param kitQuantity - How many kits are needed (component qty is multiplied)
 * @param includeOptional - Whether to include optional components (default: true)
 */
export async function expandKit(
  kitItemId: string,
  kitQuantity: number = 1,
  includeOptional: boolean = true,
): Promise<ExpandedKitLine[]> {
  const kitDoc = await getDoc(doc(inventoryRef, kitItemId));
  if (!kitDoc.exists()) {
    throw new Error(`Kit item not found: ${kitItemId}`);
  }

  const kitData = kitDoc.data();
  if (kitData.itemType !== 'kit' || !kitData.kitComponents?.length) {
    throw new Error(`Item "${kitData.name}" is not a kit or has no components`);
  }

  const kitName = kitData.displayName || kitData.name || 'Kit';
  const components: KitComponent[] = kitData.kitComponents;
  const lines: ExpandedKitLine[] = [];

  for (const comp of components) {
    if (!includeOptional && comp.isOptional) continue;

    // Look up current component pricing
    const compDoc = await getDoc(doc(inventoryRef, comp.inventoryItemId));
    let unitCost = 0;
    let unit = comp.unit || 'ea';
    let category = 'other';

    if (compDoc.exists()) {
      const compData = compDoc.data();
      unitCost = compData.pricing?.costPerUnit || 0;
      unit = compData.pricing?.unit || comp.unit || 'ea';
      category = compData.category || 'other';
    }

    const totalQty = comp.quantity * kitQuantity;

    lines.push({
      inventoryItemId: comp.inventoryItemId,
      sku: comp.sku,
      itemName: comp.name,
      category,
      quantity: totalQty,
      unit,
      unitCost,
      totalCost: unitCost * totalQty,
      kitSourceId: kitItemId,
      kitSourceName: kitName,
      isOptional: comp.isOptional || false,
      notes: comp.notes,
    });
  }

  return lines;
}

// ============================================
// Kit Cost Calculation
// ============================================

/**
 * Compute the total cost of a kit from its component prices.
 * Fetches live pricing for each component.
 */
export async function getKitCost(
  kitItemId: string,
): Promise<{ totalCost: number; currency: string; components: { name: string; unitCost: number; quantity: number; subtotal: number }[] }> {
  const lines = await expandKit(kitItemId, 1, true);
  const totalCost = lines.reduce((sum, l) => sum + l.totalCost, 0);

  return {
    totalCost,
    currency: lines.length > 0 ? (lines[0] as any).currency || 'UGX' : 'UGX',
    components: lines.map((l) => ({
      name: l.itemName,
      unitCost: l.unitCost,
      quantity: l.quantity,
      subtotal: l.totalCost,
    })),
  };
}

// ============================================
// Kit Component Management
// ============================================

/**
 * Update the components of an existing kit item.
 * Re-resolves component details from inventory.
 */
export async function updateKitComponents(
  kitItemId: string,
  components: KitComponentInput[],
  userId: string,
): Promise<void> {
  const kitDoc = await getDoc(doc(inventoryRef, kitItemId));
  if (!kitDoc.exists()) throw new Error('Kit not found');

  const kitData = kitDoc.data();
  if (kitData.itemType !== 'kit') throw new Error('Item is not a kit');

  // Resolve component details
  const resolvedComponents: KitComponent[] = [];

  for (const comp of components) {
    const itemDoc = await getDoc(doc(inventoryRef, comp.inventoryItemId));
    if (!itemDoc.exists()) {
      throw new Error(`Component item not found: ${comp.inventoryItemId}`);
    }
    const itemData = itemDoc.data();

    if (itemData.itemType === 'kit') {
      throw new Error(`Cannot add kit "${itemData.name}" as a component.`);
    }

    resolvedComponents.push({
      inventoryItemId: comp.inventoryItemId,
      sku: itemData.sku || '',
      name: itemData.displayName || itemData.name || '',
      quantity: comp.quantity,
      unit: itemData.pricing?.unit || 'ea',
      isOptional: comp.isOptional,
      notes: comp.notes,
    });
  }

  await updateDoc(doc(inventoryRef, kitItemId), {
    kitComponents: resolvedComponents,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
