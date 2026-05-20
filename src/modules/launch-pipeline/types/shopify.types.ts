/**
 * Shopify Types
 * Shopify sync and publishing types
 */

import { Timestamp } from 'firebase/firestore';

export interface ShopifySyncState {
  shopifyProductId?: string;
  shopifyVariantIds?: string[];
  status: 'not_synced' | 'synced' | 'pending' | 'error' | 'draft';
  lastSyncedAt?: Timestamp;
  lastSyncError?: string;
  shopifyHandle?: string;
  shopifyUrl?: string;
}

export interface ShopifyPublishPayload {
  title: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: 'draft' | 'active';
  images: { src: string; alt?: string }[];
  variants: ShopifyVariant[];
  options?: ShopifyProductOption[];
  metafields: ShopifyMetafield[];
}

export interface ShopifyVariant {
  title: string;
  price: string;
  compareAtPrice?: string;
  sku?: string;
  inventoryQuantity?: number;
  weight?: number;
  weightUnit?: 'kg' | 'lb';
  option1?: string;
  option2?: string;
  option3?: string;
}

export interface ShopifyProductOption {
  name: string;
  values: string[];
}

export interface ShopifyMetafield {
  namespace: string;
  key: string;
  value: string;
  type: 'single_line_text_field' | 'multi_line_text_field' | 'json';
}
