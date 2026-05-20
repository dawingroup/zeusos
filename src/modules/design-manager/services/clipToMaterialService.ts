/**
 * Clip-to-Material Conversion Service
 * AI-enhanced conversion of Clipper clips into Material Library entries.
 * Uses Gemini for field enhancement, classification, and competitive profiling.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/shared/services/firebase';
import { functions } from '@/shared/services/firebase/functions';
import { createGlobalMaterial } from './materialService';
import type { MaterialCategory, MaterialQualityTier, MaterialAIEnhancement, MaterialFormData } from '../types/materials';
import type { Timestamp } from 'firebase/firestore';

// ============================================
// Types
// ============================================

/**
 * A Firestore clip record as queried from the web app.
 * Subset of DesignClip fields relevant to material conversion.
 */
export interface FirestoreClipRecord {
  id: string;
  sourceUrl: string;
  imageUrl: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  clipType?: string;
  price?: { amount: number; currency?: string; formatted?: string };
  dimensions?: { width?: number; height?: number; depth?: number; unit?: string };
  materials?: string[];
  colors?: string[];
  brand?: string;
  sku?: string;
  tags?: string[];
  notes?: string;
  createdBy: string;
  linkedMaterialId?: string;
  convertedAt?: Timestamp;
  aiAnalysis?: {
    productType?: string;
    style?: string;
    primaryMaterials?: string[];
    suggestedTags?: string[];
    confidence?: number;
  };
}

/**
 * AI-enhanced material data ready for user review
 */
export interface MaterialEnhancement {
  // Core material fields
  name: string;
  code: string;
  description: string;
  category: MaterialCategory;

  // Dimensions
  dimensions?: {
    length: number;
    width: number;
    thickness: number;
  };

  // Pricing
  pricing?: {
    unitCost: number;
    currency: string;
    unit: string;
    functionalCurrencyCost?: number;
    exchangeRate?: number;
    landedCostEstimate?: {
      shipping?: number;
      customs?: number;
      duties?: number;
      other?: number;
      total: number;
    };
    marginPercent?: number;
    estimatedSellingPrice?: number;
  };

  // Classification
  subcategory?: string;
  qualityTier: MaterialQualityTier;
  grainPattern?: 'none' | 'lengthwise' | 'crosswise' | 'random';
  useCases?: string[];
  functionalUse?: string;
  applicationAreas?: string[];
  properties?: Record<string, unknown>;

  // AI analysis
  confidence: number;
  competitivePosition: string;
  strategyAlignment: number;
  suggestedAlternatives: string[];
  aiNotes: string;

  // Source clip data
  sourceUrl: string;
  sourceImageUrl: string;
  clipId: string;
  brand?: string;
  sku?: string;
}

// ============================================
// Clip Query Functions
// ============================================

/** Clip types eligible for material conversion */
const MATERIAL_CLIP_TYPES = ['material', 'procurement', 'parts-source'];

/**
 * Fetch unlinked clips that are candidates for material conversion.
 * Returns clips with clipType in ['material', 'procurement', 'parts-source']
 * that have not yet been linked to a material.
 */
export async function getUnlinkedMaterialClips(
  userId?: string,
): Promise<FirestoreClipRecord[]> {
  const clipsRef = collection(db, 'designClips');

  // Firestore doesn't support NOT queries on missing fields,
  // so we fetch all material-type clips and filter client-side
  const q = userId
    ? query(clipsRef, where('createdBy', '==', userId))
    : query(clipsRef);

  const snapshot = await getDocs(q);
  return parseClipSnapshot(snapshot);
}

/**
 * Subscribe to unlinked material clips in real-time.
 * Uses onSnapshot for instant updates when clips are added/removed.
 * Sorts client-side to avoid composite index requirement.
 */
export function subscribeToUnlinkedMaterialClips(
  userId: string,
  callback: (clips: FirestoreClipRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  console.log('[ClipToMaterial] Subscribing with userId:', userId);
  const clipsRef = collection(db, 'designClips');

  // Simple query — only filter by createdBy (auto-indexed).
  // Sort and clipType filtering are done client-side to avoid
  // composite index issues.
  const q = query(clipsRef, where('createdBy', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      console.log('[ClipToMaterial] Snapshot received:', snapshot.size, 'total docs');
      const clips = parseClipSnapshot(snapshot);
      console.log('[ClipToMaterial] After filter:', clips.length, 'material clips');
      callback(clips);
    },
    (error) => {
      console.error('[ClipToMaterial] Subscription error:', error);
      if (onError) {
        onError(error);
      }
    },
  );
}

/** Parse a Firestore query snapshot into FirestoreClipRecord array, sorted newest first */
function parseClipSnapshot(
  snapshot: import('firebase/firestore').QuerySnapshot,
): FirestoreClipRecord[] {
  const clips: FirestoreClipRecord[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const clipType = data.clipType as string | undefined;

    // Include if clipType is relevant and not yet linked
    if (
      clipType &&
      MATERIAL_CLIP_TYPES.includes(clipType) &&
      !data.linkedMaterialId
    ) {
      clips.push({
        id: docSnap.id,
        sourceUrl: data.sourceUrl ?? '',
        imageUrl: data.imageUrl ?? '',
        thumbnailUrl: data.thumbnailUrl ?? undefined,
        title: data.title ?? '',
        description: data.description ?? undefined,
        clipType,
        price: data.price ?? undefined,
        dimensions: data.dimensions ?? undefined,
        materials: data.materials ?? [],
        colors: data.colors ?? [],
        brand: data.brand ?? undefined,
        sku: data.sku ?? undefined,
        tags: data.tags ?? [],
        notes: data.notes ?? undefined,
        createdBy: data.createdBy ?? '',
        aiAnalysis: data.aiAnalysis ?? undefined,
      });
    }
  });

  // Sort newest first (client-side)
  clips.sort((a, b) => {
    const aSnap = snapshot.docs.find((d) => d.id === a.id);
    const bSnap = snapshot.docs.find((d) => d.id === b.id);
    const aTime = aSnap?.data().createdAt?.toMillis?.() ?? 0;
    const bTime = bSnap?.data().createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });

  return clips;
}

// ============================================
// AI Enhancement (via Cloud Function)
// ============================================

const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Use Cloud Function to enhance clip metadata into full material fields.
 * The Gemini API key is stored server-side as a Firebase secret.
 */
export async function enhanceClipToMaterial(
  clip: FirestoreClipRecord,
  context: {
    existingMaterials?: Array<{ name: string; category: string; qualityTier?: string; unitCost?: number; currency?: string }>;
  } = {},
): Promise<MaterialEnhancement> {
  const enhanceFn = httpsCallable<
    { clip: FirestoreClipRecord; existingMaterials?: Array<{ name: string; category: string; qualityTier?: string; unitCost?: number; currency?: string }> },
    { success: boolean; enhancement: MaterialEnhancement }
  >(functions, 'enhanceClipForMaterial');

  const result = await enhanceFn({
    clip,
    existingMaterials: context.existingMaterials,
  });

  if (!result.data.success || !result.data.enhancement) {
    throw new Error('AI enhancement returned no data');
  }

  return result.data.enhancement;
}

// ============================================
// Material Creation
// ============================================

/**
 * Convert a reviewed AI enhancement into a Material and link it to the clip.
 * Returns the new material ID.
 */
export async function convertClipToMaterial(
  clipId: string,
  enhancement: MaterialEnhancement,
  userId: string,
): Promise<string> {
  // 1. Build MaterialFormData from the enhancement
  // Only include defined fields — Firestore rejects undefined values
  const pricing = enhancement.pricing
    ? (() => {
        const p: Record<string, unknown> = {
          unitCost: enhancement.pricing.unitCost,
          currency: enhancement.pricing.currency,
          unit: enhancement.pricing.unit,
        };
        if (enhancement.brand) p.supplier = enhancement.brand;
        if (enhancement.pricing.functionalCurrencyCost != null) p.functionalCurrencyCost = enhancement.pricing.functionalCurrencyCost;
        if (enhancement.pricing.exchangeRate != null) p.exchangeRate = enhancement.pricing.exchangeRate;
        if (enhancement.pricing.landedCostEstimate) p.landedCostEstimate = enhancement.pricing.landedCostEstimate;
        if (enhancement.pricing.marginPercent != null) p.marginPercent = enhancement.pricing.marginPercent;
        if (enhancement.pricing.estimatedSellingPrice != null) p.estimatedSellingPrice = enhancement.pricing.estimatedSellingPrice;
        return p as MaterialFormData['pricing'];
      })()
    : undefined;

  const formData: MaterialFormData = {
    code: enhancement.code,
    name: enhancement.name,
    description: enhancement.description,
    category: enhancement.category,
    status: 'active',
  };
  if (enhancement.subcategory) formData.subcategory = enhancement.subcategory;
  if (enhancement.grainPattern) formData.grainPattern = enhancement.grainPattern;
  if (enhancement.dimensions) formData.dimensions = enhancement.dimensions;
  if (pricing) formData.pricing = pricing;
  if (enhancement.useCases?.length) formData.useCases = enhancement.useCases;
  if (enhancement.functionalUse) formData.functionalUse = enhancement.functionalUse as MaterialFormData['functionalUse'];
  if (enhancement.applicationAreas?.length) formData.applicationAreas = enhancement.applicationAreas;
  if (enhancement.properties) formData.properties = enhancement.properties as MaterialFormData['properties'];

  // 2. Create the material in Firestore (global tier)
  const materialId = await createGlobalMaterial(formData, userId);

  // 3. Update the material doc with clip provenance and AI enhancement fields
  const materialRef = doc(db, 'materials', materialId);
  const aiEnhancement: Omit<MaterialAIEnhancement, 'enhancedAt'> & { enhancedAt: ReturnType<typeof serverTimestamp> } = {
    enhancedAt: serverTimestamp() as unknown as ReturnType<typeof serverTimestamp>,
    model: GEMINI_MODEL,
    confidence: enhancement.confidence,
    competitivePosition: enhancement.competitivePosition,
    strategyAlignment: enhancement.strategyAlignment,
    suggestedAlternatives: enhancement.suggestedAlternatives,
    notes: enhancement.aiNotes,
  };

  await updateDoc(materialRef, {
    clipId,
    sourceUrl: enhancement.sourceUrl,
    sourceImageUrl: enhancement.sourceImageUrl,
    qualityTier: enhancement.qualityTier,
    aiEnhancement,
  });

  // 4. Update the clip doc to mark it as converted
  const clipRef = doc(db, 'designClips', clipId);
  await updateDoc(clipRef, {
    linkedMaterialId: materialId,
    convertedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });

  return materialId;
}
