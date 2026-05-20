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
  metafields: ShopifyMetafield[];
}

export interface ShopifyVariant {
  title: string;
  price: string;
  sku?: string;
  inventoryQuantity?: number;
  weight?: number;
  weightUnit?: 'kg' | 'lb';
}

export interface ShopifyMetafield {
  namespace: string;
  key: string;
  value: string;
  type: 'single_line_text_field' | 'multi_line_text_field' | 'json';
}
