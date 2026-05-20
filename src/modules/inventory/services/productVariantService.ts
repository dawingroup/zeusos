/**
 * Product Variant Service
 * Lazy variant creation — finds existing or creates new variants
 * for product+finish+attributes combinations.
 *
 * Collection: `productVariants`
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { Timestamp } from 'firebase/firestore';
import type {
  ProductVariant,
  VariantResolution,
  VariantResolutionResult,
} from '../types';
import type { FinishCategory } from '../types';
import { generateVariantKey } from '../utils/variant-key';
import { getFinish } from './finishLibraryService';
import { getInventoryItem } from './inventoryService';

const COLLECTION_NAME = 'productVariants';
const variantsRef = collection(db, COLLECTION_NAME);

/**
 * Strip undefined values before Firestore writes.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
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

// ============================================
// Variant Lookup
// ============================================

/**
 * Find an existing variant by its deterministic key.
 */
export async function getVariantByKey(variantKey: string): Promise<ProductVariant | null> {
  const q = query(variantsRef, where('variantKey', '==', variantKey));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as ProductVariant;
}

/**
 * Get a variant by ID.
 */
export async function getVariant(variantId: string): Promise<ProductVariant | null> {
  const ref = doc(db, COLLECTION_NAME, variantId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ProductVariant;
}

/**
 * Get all variants for a product.
 */
export async function getVariantsByProduct(productId: string): Promise<ProductVariant[]> {
  const q = query(
    variantsRef,
    where('productId', '==', productId),
    where('isActive', '==', true),
    orderBy('displayName')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant));
}

/**
 * Subscribe to variants for a product (real-time).
 */
export function subscribeToVariantsByProduct(
  productId: string,
  callback: (variants: ProductVariant[]) => void
): Unsubscribe {
  const q = query(
    variantsRef,
    where('productId', '==', productId),
    where('isActive', '==', true),
    orderBy('displayName')
  );
  return onSnapshot(q, (snap) => {
    const variants = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductVariant));
    callback(variants);
  });
}

// ============================================
// Variant Creation
// ============================================

/**
 * Core function: find existing variant or create a new one.
 * This is the primary entry point for the lazy variant strategy.
 */
export async function findOrCreateVariant(
  resolution: VariantResolution,
  organizationId: string,
  userId: string,
  subsidiaryId?: string
): Promise<VariantResolutionResult> {
  // 1. Fetch parent product for requiredAttributes
  const product = await getInventoryItem(resolution.productId);
  if (!product) throw new Error(`Product not found: ${resolution.productId}`);

  const requiredAttrs = product.requiredAttributes || Object.keys(resolution.attributes);

  // 2. Generate deterministic key
  const variantKey = generateVariantKey(
    resolution.productId,
    resolution.finishId,
    resolution.attributes,
    requiredAttrs
  );

  // 3. Check if variant already exists
  const existing = await getVariantByKey(variantKey);
  if (existing) return { variant: existing, isNew: false };

  // 4. Fetch finish for denormalized fields
  const finish = await getFinish(resolution.finishId);
  if (!finish) throw new Error(`Finish not found: ${resolution.finishId}`);

  // 5. Generate SKU and display name
  const sku = generateVariantSku(product, finish, resolution.attributes);
  const displayName = generateVariantDisplayName(product, finish, resolution.attributes);

  // 6. Create the variant with zero stock
  const variantData = stripUndefined({
    organizationId,
    subsidiaryId,
    variantKey,
    productId: product.id,
    productName: product.name,
    finishId: finish.id,
    finishName: finish.name,
    finishCode: finish.code,
    hexColor: finish.hexColor,
    attributes: resolution.attributes,
    sku,
    displayName,
    quantityOnHand: 0,
    quantityReserved: 0,
    quantityAvailable: 0,
    unitOfMeasure: product.pricing?.unit || 'ea',
    currency: product.pricing?.currency || 'UGX',
    isActive: true,
    firstCreatedFrom: resolution.creationSource || 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  });

  const docRef = await addDoc(variantsRef, variantData);
  const created: ProductVariant = {
    ...variantData,
    id: docRef.id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  } as ProductVariant;

  return { variant: created, isNew: true };
}

// ============================================
// SKU Generation
// ============================================

/**
 * Generate a category-aware SKU for a variant.
 */
export function generateVariantSku(
  product: { code?: string; id: string; finishCategory?: FinishCategory },
  finish: { code: string },
  attributes: Record<string, string | number | boolean>
): string {
  const productCode = product.code || product.id.substring(0, 4).toUpperCase();
  const base = `${productCode}-${finish.code}`;

  switch (product.finishCategory) {
    case 'board': {
      const t = attributes.thickness_mm ? `-${attributes.thickness_mm}` : '';
      const s = (attributes.sheet_width_mm && attributes.sheet_length_mm)
        ? `-${attributes.sheet_width_mm}x${attributes.sheet_length_mm}` : '';
      return `${base}${t}${s}`;
    }
    case 'paint': {
      const c = attributes.container_size_litres ? `-${attributes.container_size_litres}L` : '';
      const sh = attributes.finish_sheen
        ? `-${String(attributes.finish_sheen).substring(0, 3).toUpperCase()}` : '';
      return `${base}${sh}${c}`;
    }
    case 'tile': {
      const s = (attributes.tile_width_mm && attributes.tile_length_mm)
        ? `-${attributes.tile_width_mm}x${attributes.tile_length_mm}` : '';
      const sf = attributes.surface_finish
        ? `-${String(attributes.surface_finish).substring(0, 3).toUpperCase()}` : '';
      return `${base}${s}${sf}`;
    }
    default: {
      const attrStr = Object.values(attributes)
        .map(v => String(v))
        .join('-');
      return attrStr ? `${base}-${attrStr}` : base;
    }
  }
}

/**
 * Generate a human-readable display name for a variant.
 */
export function generateVariantDisplayName(
  product: { name: string; finishCategory?: FinishCategory },
  finish: { name: string },
  attributes: Record<string, string | number | boolean>
): string {
  const parts = [product.name, finish.name];

  switch (product.finishCategory) {
    case 'board':
      if (attributes.thickness_mm) parts.push(`${attributes.thickness_mm}mm`);
      if (attributes.sheet_width_mm && attributes.sheet_length_mm)
        parts.push(`${attributes.sheet_width_mm}\u00D7${attributes.sheet_length_mm}`);
      break;
    case 'paint':
      if (attributes.finish_sheen) parts.push(String(attributes.finish_sheen));
      if (attributes.container_size_litres) parts.push(`${attributes.container_size_litres}L`);
      break;
    case 'tile':
      if (attributes.tile_width_mm && attributes.tile_length_mm)
        parts.push(`${attributes.tile_width_mm}\u00D7${attributes.tile_length_mm}`);
      if (attributes.surface_finish) parts.push(String(attributes.surface_finish));
      break;
    default:
      Object.values(attributes).forEach(v => parts.push(String(v)));
  }

  return parts.join(' - ');
}
