/**
 * Product Search Service
 * Search and recommend products from the launch pipeline catalog
 * Used by Strategy Canvas to recommend existing products to customers
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { LaunchProduct, ProductCategory } from '@/modules/launch-pipeline/types/product.types';

const PRODUCTS_COLLECTION = 'launchProducts';

export interface ProductSearchFilters {
  category?: ProductCategory | ProductCategory[];
  materials?: string[];
  tags?: string[];
  priceRange?: { min?: number; max?: number };
  styleKeywords?: string[];
  roomType?: string[];
}

export interface ProductSearchResult {
  product: LaunchProduct;
  matchScore: number;
  matchReasons: string[];
}

export interface ProductRecommendation {
  productId: string;
  productName: string;
  category: ProductCategory;
  description: string;
  imageUrl?: string;
  features: string[];
  materials: string[];
  relevanceScore: number;
  recommendationReason: string;
}

/**
 * Search products by text query
 */
export async function searchProducts(
  searchQuery: string,
  filters?: ProductSearchFilters,
  maxResults = 20
): Promise<ProductSearchResult[]> {
  try {
    // Get all published/ready products
    const q = query(
      collection(db, PRODUCTS_COLLECTION),
      where('currentStage', 'in', ['launched', 'ready', 'photoshoot', 'seo']),
      orderBy('createdAt', 'desc'),
      limit(100) // Get more to filter client-side
    );

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as LaunchProduct));

    // Score and filter products
    const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    
    const scored = products.map(product => {
      const { score, reasons } = calculateMatchScore(product, searchTerms, filters);
      return {
        product,
        matchScore: score,
        matchReasons: reasons,
      };
    });

    // Filter out zero scores and sort by score
    return scored
      .filter(r => r.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, maxResults);
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

/**
 * Get product recommendations based on project context
 */
export async function getProductRecommendations(
  projectContext: {
    projectType?: string;
    spaceType?: string;
    budgetTier?: string;
    styleKeywords?: string[];
    roomTypes?: string[];
    materials?: string[];
  },
  maxResults = 10
): Promise<ProductRecommendation[]> {
  try {
    const q = query(
      collection(db, PRODUCTS_COLLECTION),
      where('currentStage', 'in', ['launched', 'ready', 'photoshoot', 'seo']),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as LaunchProduct));

    // Build search terms from context
    const searchTerms: string[] = [];
    if (projectContext.projectType) searchTerms.push(projectContext.projectType.toLowerCase());
    if (projectContext.spaceType) searchTerms.push(projectContext.spaceType.toLowerCase());
    if (projectContext.styleKeywords) searchTerms.push(...projectContext.styleKeywords.map(s => s.toLowerCase()));
    if (projectContext.roomTypes) searchTerms.push(...projectContext.roomTypes.map(s => s.toLowerCase()));

    // Score products
    const recommendations = products.map(product => {
      const { score, reasons } = calculateMatchScore(product, searchTerms, {
        materials: projectContext.materials,
      });

      // Get primary image if available
      const imageDeliverable = product.deliverables?.find(d => 
        d.type as string === 'hero-image' || d.type as string === 'product-photos'
      );

      return {
        productId: product.id,
        productName: product.name,
        category: product.category,
        description: product.description || '',
        imageUrl: imageDeliverable?.url,
        features: product.specifications?.features || [],
        materials: product.specifications?.materials || [],
        relevanceScore: score,
        recommendationReason: reasons.length > 0 ? reasons[0] : 'Similar product type',
      };
    });

    return recommendations
      .filter(r => r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  } catch (error) {
    console.error('Product recommendation error:', error);
    return [];
  }
}

/**
 * Get products by category
 */
export async function getProductsByCategory(
  category: ProductCategory,
  maxResults = 20
): Promise<LaunchProduct[]> {
  try {
    const q = query(
      collection(db, PRODUCTS_COLLECTION),
      where('category', '==', category),
      where('currentStage', 'in', ['launched', 'ready', 'photoshoot', 'seo']),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as LaunchProduct));
  } catch (error) {
    console.error('Get products by category error:', error);
    return [];
  }
}

/**
 * Calculate match score for a product against search terms and filters
 */
function calculateMatchScore(
  product: LaunchProduct,
  searchTerms: string[],
  filters?: ProductSearchFilters
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const name = (product.name || '').toLowerCase();
  const description = (product.description || '').toLowerCase();
  const category = (product.category || '').toLowerCase();
  const tags = (product.tags || []).map(t => t.toLowerCase());
  const materials = (product.specifications?.materials || []).map(m => m.toLowerCase());
  const features = (product.specifications?.features || []).map(f => f.toLowerCase());
  const colors = (product.specifications?.colors || []).map(c => c.toLowerCase());
  const finishes = (product.specifications?.finishes || []).map(f => f.toLowerCase());

  // AI discovery data for semantic matching
  const aiDiscovery = product.aiDiscovery;
  const roomTypes = aiDiscovery?.semanticTags?.roomType?.map(r => r.toLowerCase()) || [];
  const styleCategories = aiDiscovery?.semanticTags?.styleCategory?.map(s => s.toLowerCase()) || [];
  const useCases = (aiDiscovery?.useCases || []).map(u => u.toLowerCase());

  // Search term matching
  for (const term of searchTerms) {
    // Name match (highest weight)
    if (name.includes(term)) {
      score += 10;
      if (!reasons.includes('Name match')) reasons.push('Name match');
    }

    // Category match
    if (category.includes(term)) {
      score += 8;
      if (!reasons.includes('Category match')) reasons.push('Category match');
    }

    // Description match
    if (description.includes(term)) {
      score += 5;
      if (!reasons.includes('Description match')) reasons.push('Description match');
    }

    // Tag match
    if (tags.some(t => t.includes(term))) {
      score += 6;
      if (!reasons.includes('Tag match')) reasons.push('Tag match');
    }

    // Material match
    if (materials.some(m => m.includes(term))) {
      score += 7;
      if (!reasons.includes('Material match')) reasons.push('Material match');
    }

    // Features match
    if (features.some(f => f.includes(term))) {
      score += 6;
      if (!reasons.includes('Feature match')) reasons.push('Feature match');
    }

    // Room type match (AI discovery)
    if (roomTypes.some(r => r.includes(term))) {
      score += 8;
      if (!reasons.includes('Room type match')) reasons.push('Room type match');
    }

    // Style match (AI discovery)
    if (styleCategories.some(s => s.includes(term))) {
      score += 7;
      if (!reasons.includes('Style match')) reasons.push('Style match');
    }

    // Use case match
    if (useCases.some(u => u.includes(term))) {
      score += 5;
      if (!reasons.includes('Use case match')) reasons.push('Use case match');
    }

    // Color/finish match
    if (colors.some(c => c.includes(term)) || finishes.some(f => f.includes(term))) {
      score += 4;
      if (!reasons.includes('Color/finish match')) reasons.push('Color/finish match');
    }
  }

  // Apply filters
  if (filters) {
    // Category filter
    if (filters.category) {
      const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
      if (!categories.includes(product.category)) {
        score = 0; // Exclude if category doesn't match
      }
    }

    // Material filter
    if (filters.materials && filters.materials.length > 0) {
      const hasMatchingMaterial = filters.materials.some(m => 
        materials.includes(m.toLowerCase())
      );
      if (hasMatchingMaterial) {
        score += 5;
        if (!reasons.includes('Material filter match')) reasons.push('Material filter match');
      }
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(t => 
        tags.includes(t.toLowerCase())
      );
      if (hasMatchingTag) {
        score += 3;
      }
    }
  }

  return { score, reasons };
}

/**
 * Get all unique categories from products
 */
export async function getProductCategories(): Promise<ProductCategory[]> {
  try {
    const products = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const categories = new Set<ProductCategory>();
    
    products.docs.forEach(doc => {
      const data = doc.data();
      if (data.category) {
        categories.add(data.category as ProductCategory);
      }
    });

    return Array.from(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    return [];
  }
}

/**
 * Get all unique materials from products
 */
export async function getProductMaterials(): Promise<string[]> {
  try {
    const products = await getDocs(collection(db, PRODUCTS_COLLECTION));
    const materials = new Set<string>();
    
    products.docs.forEach(doc => {
      const data = doc.data();
      if (data.specifications?.materials) {
        data.specifications.materials.forEach((m: string) => materials.add(m));
      }
    });

    return Array.from(materials).sort();
  } catch (error) {
    console.error('Get materials error:', error);
    return [];
  }
}
