/**
 * AI Service for Launch Pipeline
 * Client-side service for AI-powered product naming and content generation
 * Uses the same REST API pattern as other Design Manager AI tools
 */

import type { NamingContext, NameCandidate, AIGeneratedContent } from '../types/ai.types';
import type { LaunchProduct } from '../types/product.types';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

// ============================================
// Product Naming
// ============================================

export interface GenerateNamesRequest {
  context: NamingContext;
  namingStrategy?: string;
  existingNames?: string[];
}

export interface GenerateNamesResponse {
  candidates: NameCandidate[];
}

/**
 * Generate AI-powered product name candidates
 */
export async function generateProductNames(
  context: NamingContext,
  namingStrategy?: string,
  existingNames: string[] = []
): Promise<GenerateNamesResponse> {
  const response = await fetch(`${API_BASE}/api/ai/generate-product-names`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      context, 
      namingStrategy: namingStrategy || getDefaultNamingStrategy(),
      existingNames,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate names');
  }
  
  return response.json();
}

/**
 * Get default naming strategy for Dawin Finishes
 */
function getDefaultNamingStrategy(): string {
  return `Create names that:
1. Evoke quality craftsmanship and premium materials
2. Are memorable and easy to pronounce
3. Work well for SEO (include relevant keywords naturally)
4. Fit the Dawin Finishes brand identity
5. Could work as part of a collection
6. Are 2-4 words, avoiding generic terms`;
}

// ============================================
// Content Generation
// ============================================

interface ServiceContentGenerationRequest {
  product: {
    name: string;
    category?: string;
    description?: string;
    specifications?: {
      dimensions?: { length: number; width: number; height: number; unit: string };
      materials?: string[];
      finishes?: string[];
      features?: string[];
    };
  };
  contentTypes?: ('short' | 'full' | 'meta' | 'bullets' | 'faqs')[];
  tone?: 'professional' | 'casual' | 'luxury';
}

/**
 * Generate AI-powered product content
 */
export async function generateProductContent(
  request: ServiceContentGenerationRequest
): Promise<Partial<AIGeneratedContent>> {
  const response = await fetch(`${API_BASE}/api/ai/generate-product-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate content');
  }
  
  return response.json();
}

/**
 * Generate content from a LaunchProduct
 */
export async function generateContentFromProduct(
  product: LaunchProduct,
  contentTypes?: ('short' | 'full' | 'meta' | 'bullets' | 'faqs')[],
  tone?: 'professional' | 'casual' | 'luxury'
): Promise<Partial<AIGeneratedContent>> {
  return generateProductContent({
    product: {
      name: product.name,
      category: product.category,
      description: product.description,
      specifications: product.specifications,
    },
    contentTypes: contentTypes || ['short', 'full', 'meta', 'bullets', 'faqs'],
    tone: tone || 'professional',
  });
}

// ============================================
// Discoverability Data
// ============================================

export interface DiscoverabilityData {
  whatItIs: string;
  bestFor: string;
  comparedTo: string;
  uniqueFeatures: string[];
  useCases: string[];
  faqs: { question: string; answer: string }[];
  semanticTags: {
    materialType: string[];
    styleCategory: string[];
    roomType: string[];
    colorFamily: string[];
  };
  searchKeywords: string[];
  generatedAt: string;
}

/**
 * Generate AI-powered discoverability data
 */
export async function generateDiscoverabilityData(
  product: LaunchProduct
): Promise<DiscoverabilityData> {
  const response = await fetch(`${API_BASE}/api/ai/generate-discoverability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: {
        name: product.name,
        category: product.category,
        specifications: product.specifications,
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate discoverability data');
  }
  
  return response.json();
}

// ============================================
// Catalog Audit
// ============================================

export interface ShopifyAuditRequest {
  shopifyProduct: any;
  auditConfig?: {
    minDescriptionLength?: number;
    maxDescriptionLength?: number;
    minImageCount?: number;
    brandTerms?: {
      required?: string[];
      prohibited?: string[];
    };
  };
}

export interface ShopifyAuditResponse {
  productId: string;
  auditedAt: string;
  auditType: string;
  productStatus: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  issues: any[];
  recommendations: string[];
}

/**
 * Audit a Shopify product for quality and SEO
 */
export async function auditShopifyProduct(
  shopifyProduct: any,
  auditConfig?: ShopifyAuditRequest['auditConfig']
): Promise<ShopifyAuditResponse> {
  const response = await fetch(`${API_BASE}/api/ai/audit-product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shopifyProduct, auditConfig }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to audit product');
  }
  
  return response.json();
}

// ============================================
// Combined AI Service Object
// ============================================

export const aiService = {
  generateProductNames,
  generateProductContent,
  generateContentFromProduct,
  generateDiscoverabilityData,
  auditShopifyProduct,
};

export default aiService;
