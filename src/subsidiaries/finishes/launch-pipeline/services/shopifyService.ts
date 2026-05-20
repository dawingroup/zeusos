/**
 * Shopify Service for Launch Pipeline
 * Handles Shopify sync, publishing, and audit operations
 */

import { 
  doc, 
  setDoc, 
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ShopifySyncState, ShopifyPublishPayload, ShopifyMetafield } from '../types/shopify.types';
import type { LaunchProduct } from '../types/product.types';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';
const CONFIG_DOC = 'shopifyConfig';

// ============================================
// Connection & Status
// ============================================

export interface ShopifyStatus {
  connected: boolean;
  status: string;
  shopName?: string;
  shopDomain?: string;
}

export async function getShopifyStatus(): Promise<ShopifyStatus> {
  try {
    const response = await fetch(`${API_BASE}/shopify/status`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching Shopify status:', error);
    return { connected: false, status: 'error' };
  }
}

export async function connectShopify(
  shopDomain: string, 
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/shopify/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopDomain, accessToken }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Connection failed' };
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}

export async function disconnectShopify(): Promise<void> {
  const docRef = doc(db, 'systemConfig', CONFIG_DOC);
  await setDoc(docRef, {
    status: 'disconnected',
    accessToken: null,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

// ============================================
// Product Publishing
// ============================================

/**
 * Build enhanced publish payload with AI content and metafields
 */
export function buildPublishPayload(product: LaunchProduct): ShopifyPublishPayload {
  const metafields: ShopifyMetafield[] = [];
  
  // Get description from AI content or product
  const description = product.aiContent?.fullDescription || product.description || '';
  
  // Add Schema.org JSON-LD
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.aiContent?.shortDescription || product.description,
    brand: {
      '@type': 'Brand',
      name: 'Dawin Group',
    },
    category: product.category,
    material: product.specifications?.materials?.join(', '),
  };
  
  metafields.push({
    namespace: 'custom',
    key: 'schema_json_ld',
    value: JSON.stringify(schemaOrg),
    type: 'json',
  });
  
  // Add AI content metadata
  if (product.aiContent) {
    metafields.push({
      namespace: 'ai',
      key: 'meta_description',
      value: product.aiContent.metaDescription || '',
      type: 'single_line_text_field',
    });
    
    if (product.aiContent.bulletPoints?.length) {
      metafields.push({
        namespace: 'ai',
        key: 'bullet_points',
        value: product.aiContent.bulletPoints.join('\n'),
        type: 'multi_line_text_field',
      });
    }
  }
  
  // Add SEO metadata if available
  if (product.seoMetadata) {
    metafields.push({
      namespace: 'seo',
      key: 'meta_title',
      value: product.seoMetadata.metaTitle || product.name,
      type: 'single_line_text_field',
    });
    
    if (product.seoMetadata.keywords?.length) {
      metafields.push({
        namespace: 'seo',
        key: 'keywords',
        value: product.seoMetadata.keywords.join(', '),
        type: 'single_line_text_field',
      });
    }
  }
  
  // Add specifications
  if (product.specifications) {
    metafields.push({
      namespace: 'specs',
      key: 'dimensions',
      value: JSON.stringify(product.specifications.dimensions || {}),
      type: 'json',
    });
    
    if (product.specifications.materials?.length) {
      metafields.push({
        namespace: 'specs',
        key: 'materials',
        value: product.specifications.materials.join(', '),
        type: 'single_line_text_field',
      });
    }
    
    if (product.specifications.finishes?.length) {
      metafields.push({
        namespace: 'specs',
        key: 'finishes',
        value: product.specifications.finishes.join(', '),
        type: 'single_line_text_field',
      });
    }
  }
  
  // Build images with alt text from deliverables
  const imageTypes = ['hero_images', 'lifestyle_photos', 'detail_shots'] as const;
  const images = (product.deliverables || [])
    .filter(d => imageTypes.includes(d.type as any))
    .filter(d => d.url)
    .map(d => ({
      src: d.url,
      alt: `${product.name} - ${d.name}`,
    }));
  
  // Build tags
  const tags = [
    product.category,
    product.priority,
    ...(product.seoMetadata?.keywords || []),
  ].filter(Boolean) as string[];
  
  return {
    title: product.name,
    bodyHtml: description,
    vendor: 'Dawin Group',
    productType: product.category || 'Custom Furniture',
    tags,
    status: 'active',
    images,
    variants: [{
      title: 'Default',
      price: '0.00',
      sku: product.id,
    }],
    metafields,
  };
}

/**
 * Publish product to Shopify
 */
export async function publishToShopify(
  product: LaunchProduct
): Promise<{ success: boolean; shopifyProductId?: string; shopifyUrl?: string; error?: string }> {
  try {
    const payload = buildPublishPayload(product);
    
    const response = await fetch(`${API_BASE}/shopify/sync-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        roadmapProductId: product.id, 
        productData: {
          title: payload.title,
          body_html: payload.bodyHtml,
          vendor: payload.vendor,
          product_type: payload.productType,
          tags: payload.tags,
          status: payload.status,
          images: payload.images,
          variants: payload.variants.map(v => ({
            title: v.title,
            price: v.price,
            sku: v.sku,
          })),
          metafields: payload.metafields.map(m => ({
            namespace: m.namespace,
            key: m.key,
            value: m.value,
            type: m.type,
          })),
        },
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Publish failed' };
    }
    
    return { 
      success: true, 
      shopifyProductId: data.shopifyProductId,
      shopifyUrl: data.shopifyUrl,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Publish failed' };
  }
}

/**
 * Update product sync state in Firestore
 */
export async function updateSyncState(
  productId: string, 
  syncState: Partial<ShopifySyncState>
): Promise<void> {
  const productRef = doc(db, 'launchProducts', productId);
  await updateDoc(productRef, {
    shopifySync: {
      ...syncState,
      lastSyncedAt: Timestamp.now(),
    },
  });
}

// ============================================
// Sync Mappings
// ============================================

export interface ProductSyncMapping {
  id: string;
  launchProductId: string;
  shopifyProductId: string;
  shopifyHandle?: string;
  lastSyncedAt: Timestamp;
  syncStatus: 'synced' | 'pending' | 'error';
}

export async function getProductSyncMappings(): Promise<ProductSyncMapping[]> {
  const q = query(collection(db, 'productSyncMappings'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ProductSyncMapping));
}

export async function getSyncMappingForProduct(productId: string): Promise<ProductSyncMapping | null> {
  const q = query(
    collection(db, 'productSyncMappings'),
    where('launchProductId', '==', productId)
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const docSnap = snapshot.docs[0];
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as ProductSyncMapping;
}

// ============================================
// Catalog Audit
// ============================================

export interface ShopifyAuditResult {
  productId: string;
  productName: string;
  issues: ShopifyAuditIssue[];
  score: number;
  checkedAt: Timestamp;
}

export interface ShopifyAuditIssue {
  type: 'missing_image' | 'missing_description' | 'missing_price' | 'missing_sku' | 'missing_metafield' | 'seo_issue';
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

/**
 * Audit a single product for Shopify readiness
 */
export function auditProduct(product: LaunchProduct): ShopifyAuditResult {
  const issues: ShopifyAuditIssue[] = [];
  
  // Check for hero image
  const hasHeroImage = product.deliverables?.some(
    d => d.type === 'hero_images' && d.url
  );
  if (!hasHeroImage) {
    issues.push({
      type: 'missing_image',
      severity: 'error',
      message: 'Missing hero image - required for Shopify listing',
      field: 'deliverables.hero_images',
    });
  }
  
  // Check for description
  if (!product.description && !product.aiContent?.fullDescription) {
    issues.push({
      type: 'missing_description',
      severity: 'error',
      message: 'Missing product description',
      field: 'description',
    });
  }
  
  // Check for SEO metadata
  if (!product.seoMetadata?.metaTitle) {
    issues.push({
      type: 'seo_issue',
      severity: 'warning',
      message: 'Missing SEO meta title - recommend AI generation',
      field: 'seoMetadata.metaTitle',
    });
  }
  
  if (!product.seoMetadata?.metaDescription && !product.aiContent?.metaDescription) {
    issues.push({
      type: 'seo_issue',
      severity: 'warning',
      message: 'Missing SEO meta description - recommend AI generation',
      field: 'seoMetadata.metaDescription',
    });
  }
  
  // Check for specifications
  if (!product.specifications?.dimensions) {
    issues.push({
      type: 'missing_metafield',
      severity: 'warning',
      message: 'Missing product dimensions',
      field: 'specifications.dimensions',
    });
  }
  
  if (!product.specifications?.materials?.length) {
    issues.push({
      type: 'missing_metafield',
      severity: 'info',
      message: 'No materials specified',
      field: 'specifications.materials',
    });
  }
  
  // Calculate score (100 - deductions)
  const errorDeduction = issues.filter(i => i.severity === 'error').length * 25;
  const warningDeduction = issues.filter(i => i.severity === 'warning').length * 10;
  const infoDeduction = issues.filter(i => i.severity === 'info').length * 5;
  const score = Math.max(0, 100 - errorDeduction - warningDeduction - infoDeduction);
  
  return {
    productId: product.id,
    productName: product.name,
    issues,
    score,
    checkedAt: Timestamp.now(),
  };
}

/**
 * Audit multiple products
 */
export function auditProducts(products: LaunchProduct[]): ShopifyAuditResult[] {
  return products.map(auditProduct);
}

/**
 * Check if product is ready for Shopify publish
 */
export function isReadyForPublish(product: LaunchProduct): { ready: boolean; blockers: string[] } {
  const audit = auditProduct(product);
  const blockers = audit.issues
    .filter(i => i.severity === 'error')
    .map(i => i.message);
  
  return {
    ready: blockers.length === 0,
    blockers,
  };
}
