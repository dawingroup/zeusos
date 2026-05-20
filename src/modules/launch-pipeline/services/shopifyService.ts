/**
 * Shopify Service for Launch Pipeline
 * Handles Shopify sync, publishing, and audit operations
 */

import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ShopifySyncState, ShopifyPublishPayload, ShopifyMetafield, ShopifyProductOption } from '../types/shopify.types';
import type { LaunchProduct, ProductDeliverable, ProductVariant, ProductCategory, SEOMetadata } from '../types/product.types';
import type { PipelineStage, DeliverableType } from '../types/stage.types';

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

  // Build variants from product variants or create default
  const variants = product.variants?.length
    ? product.variants.map((v, idx) => ({
        title: v.title,
        price: v.price.toFixed(2),
        compareAtPrice: v.compareAtPrice ? v.compareAtPrice.toFixed(2) : undefined,
        sku: v.sku || `${product.id}-${idx}`,
        inventoryQuantity: v.inventoryQuantity,
        weight: v.weight,
        weightUnit: v.weightUnit,
        option1: Object.values(v.options)[0],
        option2: Object.values(v.options)[1],
        option3: Object.values(v.options)[2],
      }))
    : [{
        title: 'Default',
        price: product.pricing?.basePrice?.toFixed(2) || '0.00',
        compareAtPrice: product.pricing?.compareAtPrice?.toFixed(2),
        sku: product.id,
      }];

  // Build product options from variant options
  const options: ShopifyProductOption[] = [];
  if (product.variants?.length) {
    const optionNames = new Set<string>();
    product.variants.forEach(v => {
      Object.keys(v.options || {}).forEach(k => optionNames.add(k));
    });
    optionNames.forEach(name => {
      const values = [...new Set(product.variants!.map(v => v.options[name]).filter(Boolean))];
      if (values.length > 0) {
        options.push({ name, values });
      }
    });
  }

  return {
    title: product.name,
    bodyHtml: description,
    vendor: 'Dawin Group',
    productType: product.category || 'Custom Furniture',
    tags,
    status: 'active',
    images,
    variants,
    options: options.length > 0 ? options : undefined,
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
            compare_at_price: v.compareAtPrice,
            sku: v.sku,
            inventory_quantity: v.inventoryQuantity,
            weight: v.weight,
            weight_unit: v.weightUnit,
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
          })),
          options: payload.options?.map(o => ({
            name: o.name,
            values: o.values,
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

/**
 * Update an existing product on Shopify
 */
export async function updateShopifyProduct(
  product: LaunchProduct
): Promise<{ success: boolean; error?: string }> {
  if (!product.shopifySync?.shopifyProductId) {
    return { success: false, error: 'Product is not published to Shopify' };
  }

  try {
    const payload = buildPublishPayload(product);

    const response = await fetch(`${API_BASE}/shopify/update-product`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopifyProductId: product.shopifySync.shopifyProductId,
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
            compare_at_price: v.compareAtPrice,
            sku: v.sku,
            inventory_quantity: v.inventoryQuantity,
            weight: v.weight,
            weight_unit: v.weightUnit,
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
          })),
          options: payload.options?.map(o => ({
            name: o.name,
            values: o.values,
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
      return { success: false, error: data.error || 'Update failed' };
    }

    // Update sync timestamp
    await updateSyncState(product.id, {
      status: 'synced',
      shopifyProductId: product.shopifySync.shopifyProductId,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}

/**
 * Re-sync product: rebuild full payload and update on Shopify
 */
export async function resyncProduct(
  product: LaunchProduct
): Promise<{ success: boolean; error?: string }> {
  if (!product.shopifySync?.shopifyProductId) {
    // Not published yet, do a fresh publish
    const result = await publishToShopify(product);
    return { success: result.success, error: result.error };
  }

  return updateShopifyProduct(product);
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

// ============================================
// Shopify Product Import
// ============================================

/** Shape of a product from the Shopify REST Admin API */
export interface ShopifyApiProduct {
  id: number | string;
  title: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  handle: string;
  status: 'active' | 'draft' | 'archived';
  tags: string;
  images: { id: number; src: string; alt: string | null }[];
  variants: {
    id: number;
    title: string;
    price: string;
    compare_at_price: string | null;
    sku: string | null;
    inventory_quantity: number;
    weight: number | null;
    weight_unit: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
  }[];
  options: { name: string; values: string[] }[];
  metafields?: { namespace: string; key: string; value: string; type: string }[];
  created_at: string;
  updated_at: string;
}

export interface ImportResult {
  imported: number;
  alreadyLinked: number;
  errors: number;
  importedProducts: LaunchProduct[];
  errorDetails: { shopifyId: string; title: string; error: string }[];
}

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, '').trim();
}

function inferCategory(productType: string, tags: string): ProductCategory {
  const combined = `${productType} ${tags}`.toLowerCase();
  if (combined.includes('casework') || combined.includes('cabinet')) return 'casework';
  if (combined.includes('millwork') || combined.includes('trim') || combined.includes('molding')) return 'millwork';
  if (combined.includes('door')) return 'doors';
  if (combined.includes('fixture') || combined.includes('vanity') || combined.includes('sink')) return 'fixtures';
  if (combined.includes('special') || combined.includes('custom')) return 'specialty';
  return 'furniture';
}

function mapShopifyToLaunchProduct(
  shopifyProduct: ShopifyApiProduct
): Omit<LaunchProduct, 'id'> {
  const now = Timestamp.now();
  const tags = shopifyProduct.tags
    ? shopifyProduct.tags.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  // Map variants
  const variants: ProductVariant[] = shopifyProduct.variants
    .filter(v => v.title !== 'Default Title' || shopifyProduct.variants.length === 1)
    .map(v => {
      const options: Record<string, string> = {};
      if (v.option1 && shopifyProduct.options?.[0]) {
        options[shopifyProduct.options[0].name] = v.option1;
      }
      if (v.option2 && shopifyProduct.options?.[1]) {
        options[shopifyProduct.options[1].name] = v.option2;
      }
      if (v.option3 && shopifyProduct.options?.[2]) {
        options[shopifyProduct.options[2].name] = v.option3;
      }
      return {
        id: `var_${v.id}`,
        title: v.title,
        sku: v.sku || '',
        price: parseFloat(v.price) || 0,
        ...(v.compare_at_price ? { compareAtPrice: parseFloat(v.compare_at_price) } : {}),
        inventoryQuantity: v.inventory_quantity || 0,
        ...(v.weight ? { weight: v.weight } : {}),
        ...(v.weight_unit ? { weightUnit: v.weight_unit as 'kg' | 'lb' } : {}),
        options,
      };
    });

  // Map images to deliverables
  const deliverables: ProductDeliverable[] = shopifyProduct.images.map((img, idx) => ({
    id: `del_img_${img.id}`,
    type: (idx === 0 ? 'hero_images' : 'detail_shots') as DeliverableType,
    stage: 'launched' as PipelineStage,
    name: img.alt || `Product Image ${idx + 1}`,
    url: img.src,
    mimeType: 'image/jpeg',
    uploadedAt: now,
    uploadedBy: 'shopify-import',
  }));

  // Extract SEO from metafields if present
  const metafields = shopifyProduct.metafields || [];
  const seoTitle = metafields.find(m => m.key === 'title_tag' || m.key === 'meta_title');
  const seoDesc = metafields.find(m => m.key === 'description_tag' || m.key === 'meta_description');

  const seoMetadata: SEOMetadata | null = (seoTitle || seoDesc)
    ? {
        metaTitle: seoTitle?.value || shopifyProduct.title,
        metaDescription: seoDesc?.value || '',
        keywords: tags.slice(0, 10),
      }
    : null;

  const firstVariantPrice = parseFloat(shopifyProduct.variants[0]?.price || '0');
  const firstVariantCompareAt = shopifyProduct.variants[0]?.compare_at_price
    ? parseFloat(shopifyProduct.variants[0].compare_at_price)
    : null;

  return {
    name: shopifyProduct.title,
    handle: shopifyProduct.handle || shopifyProduct.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    description: stripHtml(shopifyProduct.body_html || ''),
    category: inferCategory(shopifyProduct.product_type, shopifyProduct.tags || ''),
    currentStage: 'launched' as PipelineStage,
    stageHistory: [{
      from: 'launched' as PipelineStage,
      to: 'launched' as PipelineStage,
      transitionedAt: now,
      transitionedBy: 'shopify-import',
      notes: 'Imported from Shopify',
    }],
    deliverables,
    specifications: {
      materials: [],
      finishes: [],
      colors: [],
      features: [],
    },
    ...(seoMetadata ? { seoMetadata } : {}),
    shopifySync: {
      shopifyProductId: shopifyProduct.id.toString(),
      shopifyVariantIds: shopifyProduct.variants.map(v => v.id.toString()),
      status: 'synced',
      lastSyncedAt: now,
      shopifyHandle: shopifyProduct.handle,
    },
    auditHistory: [],
    pricing: {
      basePrice: firstVariantPrice,
      ...(firstVariantCompareAt ? { compareAtPrice: firstVariantCompareAt } : {}),
      currency: 'USD',
      taxable: true,
    },
    ...(variants.length > 0 ? { variants } : {}),
    priority: 'medium',
    tags,
    notes: 'Imported from Shopify store',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get Shopify products separated into linked and unlinked
 */
export async function getUnlinkedShopifyProducts(): Promise<{
  unlinked: ShopifyApiProduct[];
  linked: ShopifyApiProduct[];
  total: number;
}> {
  // Fetch Shopify products and all pipeline products in parallel
  const [shopifyResponse, allProductsSnapshot] = await Promise.all([
    fetch(`${API_BASE}/shopify/products`).then(r => r.json()),
    getDocs(query(collection(db, 'launchProducts'))),
  ]);

  const linkedShopifyIds = new Set<string>();
  allProductsSnapshot.docs.forEach(d => {
    const shopifyId = d.data().shopifySync?.shopifyProductId;
    if (shopifyId) linkedShopifyIds.add(shopifyId.toString());
  });

  const shopifyProducts: ShopifyApiProduct[] = shopifyResponse.products || [];
  const linked: ShopifyApiProduct[] = [];
  const unlinked: ShopifyApiProduct[] = [];

  for (const product of shopifyProducts) {
    if (linkedShopifyIds.has(product.id.toString())) {
      linked.push(product);
    } else {
      unlinked.push(product);
    }
  }

  return { unlinked, linked, total: shopifyProducts.length };
}

/**
 * Import Shopify products into the launch pipeline
 * Creates launchProduct documents for unlinked Shopify products
 */
export async function importShopifyProducts(
  shopifyProductIds?: string[]
): Promise<ImportResult> {
  const { unlinked } = await getUnlinkedShopifyProducts();

  // If specific IDs provided, filter to only those
  const toImport = shopifyProductIds
    ? unlinked.filter(p => shopifyProductIds.includes(p.id.toString()))
    : unlinked;

  const result: ImportResult = {
    imported: 0,
    alreadyLinked: shopifyProductIds
      ? shopifyProductIds.length - toImport.length
      : 0,
    errors: 0,
    importedProducts: [],
    errorDetails: [],
  };

  for (const shopifyProduct of toImport) {
    try {
      const productData = mapShopifyToLaunchProduct(shopifyProduct);
      const docRef = await addDoc(collection(db, 'launchProducts'), productData);
      const created = { id: docRef.id, ...productData } as LaunchProduct;
      result.importedProducts.push(created);
      result.imported++;
    } catch (err) {
      result.errors++;
      result.errorDetails.push({
        shopifyId: shopifyProduct.id.toString(),
        title: shopifyProduct.title,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return result;
}
