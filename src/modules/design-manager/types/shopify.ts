/**
 * Shopify Integration Types
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Shopify connection status
 */
export type ShopifyConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Shopify sync status for products
 */
export type ShopifySyncStatus = 'not_synced' | 'syncing' | 'synced' | 'error';

/**
 * Shopify store configuration
 */
export interface ShopifyConfig {
  id: string;
  shopDomain: string;
  accessToken?: string;
  status: ShopifyConnectionStatus;
  lastSync?: Timestamp;
  productCount?: number;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Shopify product (simplified)
 */
export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  status: 'active' | 'draft' | 'archived';
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Shopify variant
 */
export interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  sku: string;
  inventoryQuantity: number;
  weight?: number;
  weightUnit?: string;
}

/**
 * Shopify image
 */
export interface ShopifyImage {
  id: string;
  src: string;
  alt?: string;
  position: number;
}

/**
 * Product sync mapping between Roadmap and Shopify
 */
export interface ProductSyncMapping {
  id: string;
  roadmapProductId: string;
  shopifyProductId?: string;
  syncStatus: ShopifySyncStatus;
  lastSynced?: Timestamp;
  error?: string;
}

/**
 * Shopify product for creation/update
 */
export interface ShopifyProductInput {
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  tags: string[];
  status: 'active' | 'draft' | 'archived';
  variants: {
    price: string;
    sku?: string;
    inventory_quantity?: number;
  }[];
  images?: {
    src: string;
    alt?: string;
  }[];
}
