// ============================================================================
// CAPITAL PRODUCTS SERVICE
// DawinOS v2.0 — Catalog of available capital products
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { CapitalProduct, CapitalProductFilters } from '../types/capital.types';
import type { CapitalProductInput } from '../schemas/capital.schemas';
import { CAPITAL_PRODUCTS_COLLECTION } from '../constants/capital.constants';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string) {
  return collection(db, 'companies', companyId, CAPITAL_PRODUCTS_COLLECTION);
}

function companyDoc(companyId: string, docId: string) {
  return doc(db, 'companies', companyId, CAPITAL_PRODUCTS_COLLECTION, docId);
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class CapitalProductsService {

  async createProduct(
    companyId: string,
    input: CapitalProductInput,
  ): Promise<CapitalProduct> {
    // Strip undefined values — Firestore rejects them
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        // Also clean nested arrays of objects (e.g., requirements)
        if (Array.isArray(value)) {
          cleaned[key] = value.map(item =>
            item && typeof item === 'object' && !Array.isArray(item)
              ? Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined))
              : item
          );
        } else {
          cleaned[key] = value;
        }
      }
    }

    const data = {
      ...cleaned,
      companyId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(companyCol(companyId), data);
    return { id: docRef.id, ...data } as CapitalProduct;
  }

  async getProduct(companyId: string, productId: string): Promise<CapitalProduct | null> {
    const docSnap = await getDoc(companyDoc(companyId, productId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as CapitalProduct;
  }

  async getProducts(
    companyId: string,
    filters: CapitalProductFilters = {},
  ): Promise<CapitalProduct[]> {
    let q = query(companyCol(companyId), orderBy('provider', 'asc'));

    if (filters.productType) {
      q = query(q, where('productType', '==', filters.productType));
    }
    if (filters.providerType) {
      q = query(q, where('providerType', '==', filters.providerType));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const snapshot = await getDocs(q);
    let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CapitalProduct));

    if (filters.collateralRequired !== undefined) {
      items = items.filter(i => i.collateralRequired === filters.collateralRequired);
    }
    if (filters.minAmount !== undefined) {
      items = items.filter(i => !i.maxAmount || i.maxAmount >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      items = items.filter(i => !i.minAmount || i.minAmount <= filters.maxAmount!);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(
        i =>
          i.name.toLowerCase().includes(term) ||
          i.provider.toLowerCase().includes(term),
      );
    }

    return items;
  }

  async updateProduct(
    companyId: string,
    productId: string,
    updates: Partial<CapitalProductInput>,
  ): Promise<void> {
    await updateDoc(companyDoc(companyId, productId), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteProduct(companyId: string, productId: string): Promise<void> {
    await deleteDoc(companyDoc(companyId, productId));
  }

  /**
   * Calculate eligibility match score (0-100) between business profile and product requirements.
   */
  calculateEligibilityScore(
    product: CapitalProduct,
    businessProfile: {
      annualRevenue?: number;
      yearsInBusiness?: number;
      hasCollateral?: boolean;
      sectors?: string[];
    },
  ): number {
    let score = 100;
    let factors = 0;

    if (product.minRevenue && businessProfile.annualRevenue !== undefined) {
      factors++;
      if (businessProfile.annualRevenue < product.minRevenue) {
        score -= 30;
      }
    }

    if (product.minYearsInBusiness && businessProfile.yearsInBusiness !== undefined) {
      factors++;
      if (businessProfile.yearsInBusiness < product.minYearsInBusiness) {
        score -= 25;
      }
    }

    if (product.collateralRequired) {
      factors++;
      if (!businessProfile.hasCollateral) {
        score -= 25;
      }
    }

    if (product.sectors?.length && businessProfile.sectors?.length) {
      factors++;
      const overlap = product.sectors.some(s => businessProfile.sectors!.includes(s));
      if (!overlap) {
        score -= 20;
      }
    }

    return factors > 0 ? Math.max(0, score) : 100;
  }
}

export const capitalProductsService = new CapitalProductsService();
