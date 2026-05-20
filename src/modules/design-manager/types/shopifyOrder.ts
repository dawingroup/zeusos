/**
 * Shopify Order Types
 *
 * Full order model for storing complete Shopify orders in Firestore.
 * Orders are stored in the `shopifyOrders` collection, keyed by `shopify_{shopifyOrderId}`.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Financial status of a Shopify order
 */
export type ShopifyFinancialStatus =
  | 'pending'
  | 'authorized'
  | 'partially_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'voided';

/**
 * Fulfillment status of a Shopify order
 */
export type ShopifyFulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | null;

/**
 * Status of an individual fulfillment
 */
export type FulfillmentItemStatus =
  | 'pending'
  | 'open'
  | 'success'
  | 'cancelled'
  | 'error'
  | 'failure';

/**
 * Shopify address (shipping or billing)
 */
export interface ShopifyAddress {
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  country: string;
  zip?: string;
}

/**
 * Order line item
 */
export interface ShopifyOrderLineItem {
  shopifyLineItemId: string;
  title: string;
  variantTitle?: string;
  sku?: string;
  quantity: number;
  price: number;
  totalDiscount: number;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  /** Link to DawinOS inventory item if matched */
  inventoryItemId?: string;
  fulfillableQuantity: number;
  fulfillmentStatus?: string;
}

/**
 * Order fulfillment record
 */
export interface ShopifyFulfillment {
  shopifyFulfillmentId: string;
  status: FulfillmentItemStatus;
  trackingNumber?: string;
  trackingUrl?: string;
  trackingCompany?: string;
  lineItems: { shopifyLineItemId: string; quantity: number }[];
  createdAt: Timestamp;
}

/**
 * Customer snapshot embedded in order
 */
export interface ShopifyOrderCustomer {
  shopifyCustomerId: string;
  name: string;
  email: string;
  phone?: string;
}

/**
 * Full Shopify order document stored in Firestore
 */
export interface ShopifyOrder {
  id: string;
  shopifyOrderId: string;
  orderNumber: string;
  name: string;
  email: string;
  phone?: string;

  // Financial
  currency: string;
  totalPrice: number;
  subtotalPrice: number;
  totalTax: number;
  totalDiscounts: number;
  totalShipping: number;

  // Status
  financialStatus: ShopifyFinancialStatus;
  fulfillmentStatus: ShopifyFulfillmentStatus;
  cancelledAt?: Timestamp;
  cancelReason?: string;

  // Customer
  customer: ShopifyOrderCustomer;
  shippingAddress?: ShopifyAddress;
  billingAddress?: ShopifyAddress;

  // Line items & fulfillments
  lineItems: ShopifyOrderLineItem[];
  fulfillments: ShopifyFulfillment[];

  // Metadata
  note?: string;
  tags: string[];
  shopifyOrderUrl: string;

  // DawinOS linking
  crmDealId?: string;
  subsidiaryId: string;

  // Timestamps
  shopifyCreatedAt: Timestamp;
  shopifyUpdatedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  syncedAt: Timestamp;
}

/**
 * Filters for querying Shopify orders
 */
export interface ShopifyOrderFilters {
  financialStatus?: ShopifyFinancialStatus;
  fulfillmentStatus?: ShopifyFulfillmentStatus;
  customerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

/**
 * Aggregate stats for order dashboard
 */
export interface ShopifyOrderStats {
  totalOrders: number;
  totalRevenue: number;
  currency: string;
  byFinancialStatus: Record<string, number>;
  byFulfillmentStatus: Record<string, number>;
}
