/**
 * Clip Conversion Service
 * Converts product-idea design clips into Launch Pipeline products
 *
 * Follows the pattern of projectPartsService.createProjectPartFromClip()
 */

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { DesignClip } from '@/subsidiaries/finishes/clipper/types';
import type { LaunchProduct, ProductCategory } from '../types/product.types';
import * as pipelineService from './pipelineService';

const CLIPS_COLLECTION = 'designClips';

/**
 * Map AI-detected product type to LaunchProduct category
 */
function inferCategory(clip: DesignClip): ProductCategory {
  const text = `${clip.title} ${clip.description || ''} ${clip.aiAnalysis?.productType || ''} ${clip.tags.join(' ')}`.toLowerCase();

  if (text.includes('cabinet') || text.includes('vanity') || text.includes('wardrobe') || text.includes('closet')) {
    return 'casework';
  }
  if (text.includes('millwork') || text.includes('moulding') || text.includes('paneling') || text.includes('wainscot')) {
    return 'millwork';
  }
  if (text.includes('door') || text.includes('barn door')) {
    return 'doors';
  }
  if (text.includes('fixture') || text.includes('shelf') || text.includes('rack') || text.includes('bracket')) {
    return 'fixtures';
  }
  if (text.includes('table') || text.includes('desk') || text.includes('chair') || text.includes('bench') || text.includes('sofa') || text.includes('bed')) {
    return 'furniture';
  }
  // Default
  return 'furniture';
}

/**
 * Build a product name from clip data
 */
function buildProductName(clip: DesignClip): string {
  // Use AI product type + style if available
  if (clip.aiAnalysis?.productType && clip.aiAnalysis?.style) {
    return `${clip.aiAnalysis.style} ${clip.aiAnalysis.productType}`;
  }
  // Fall back to clip title, cleaned up
  const title = clip.title || 'Untitled Product';
  // Remove common website suffixes and clean up
  return title
    .replace(/\s*[-|]\s*.*$/, '') // Remove "- Site Name" suffixes
    .replace(/\s*\|.*$/, '')
    .trim()
    .slice(0, 100);
}

/**
 * Create a LaunchProduct from a design clip
 */
export async function createLaunchProductFromClip(
  clip: DesignClip,
  userId: string,
  overrides?: Partial<LaunchProduct>
): Promise<LaunchProduct> {
  const name = overrides?.name || buildProductName(clip);
  const category = overrides?.category || inferCategory(clip);

  const description = [
    clip.description || '',
    clip.notes ? `Notes: ${clip.notes}` : '',
    clip.sourceUrl ? `Source: ${clip.sourceUrl}` : '',
  ].filter(Boolean).join('\n\n');

  const productData: Partial<LaunchProduct> = {
    name,
    category,
    description,
    currentStage: 'idea',
    priority: 'medium',

    // Map specifications from clip + AI analysis
    specifications: {
      materials: clip.aiAnalysis?.primaryMaterials || clip.materials || [],
      finishes: [],
      colors: clip.aiAnalysis?.colors || clip.colors || [],
      features: clip.aiAnalysis?.millworkAssessment?.keyFeatures || [],
    },

    // Tags from AI + clip
    tags: [
      ...(clip.aiAnalysis?.suggestedTags || []),
      ...(clip.tags || []),
      'from-clipper',
    ].filter((t, i, arr) => arr.indexOf(t) === i), // deduplicate

    notes: clip.notes || '',

    // Clip traceability
    sourceClipId: clip.id,
    sourceClipUrl: clip.sourceUrl,
    clipImageUrl: clip.thumbnailUrl || clip.imageUrl,

    assignedTo: userId,

    // Apply overrides
    ...overrides,
  };

  // Create the product via pipelineService
  const product = await pipelineService.createProduct(productData);

  // Add clip image as a reference_images deliverable to the idea stage
  if (clip.imageUrl || clip.thumbnailUrl) {
    await pipelineService.addDeliverable(product.id, {
      type: 'reference_images',
      stage: 'idea',
      name: `Clip: ${clip.title || 'Reference Image'}`,
      url: clip.imageUrl || clip.thumbnailUrl,
      uploadedAt: Timestamp.now(),
      uploadedBy: userId,
      metadata: {
        sourceClipId: clip.id,
        sourceUrl: clip.sourceUrl,
      },
    });
  }

  return product;
}

/**
 * Get all product-idea clips that haven't been converted yet
 */
export async function getUnconvertedProductIdeaClips(userId: string): Promise<DesignClip[]> {
  // 1. Fetch all product-idea clips
  const clipsRef = collection(db, CLIPS_COLLECTION);
  const clipsQuery = query(
    clipsRef,
    where('createdBy', '==', userId),
    where('clipType', '==', 'product-idea'),
    orderBy('createdAt', 'desc')
  );

  const clipsSnapshot = await getDocs(clipsQuery);
  const allIdeaClips = clipsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
  })) as DesignClip[];

  // 2. Fetch existing products that were created from clips
  const products = await pipelineService.getProducts();
  const convertedClipIds = new Set(
    products
      .map(p => p.sourceClipId)
      .filter(Boolean)
  );

  // 3. Return only unconverted clips
  return allIdeaClips.filter(clip => !convertedClipIds.has(clip.id));
}

/**
 * Check if a clip has already been converted to a product
 */
export async function isClipConverted(clipId: string): Promise<boolean> {
  const products = await pipelineService.getProducts();
  return products.some(p => p.sourceClipId === clipId);
}

/**
 * Bulk convert multiple clips to products
 */
export async function bulkConvertClipsToProducts(
  clips: DesignClip[],
  userId: string
): Promise<LaunchProduct[]> {
  const products: LaunchProduct[] = [];
  for (const clip of clips) {
    const product = await createLaunchProductFromClip(clip, userId);
    products.push(product);
  }
  return products;
}
