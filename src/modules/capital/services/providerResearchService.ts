/**
 * Capital Provider Research Service
 * AI-powered capital provider search, enrichment, and matching.
 *
 * Uses Firebase Cloud Function: capitalProviderResearch
 * - Gemini 2.0 Flash + Google Search grounding for web research
 * - Claude Sonnet for match analysis and recommendations
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';
import { capitalProductsService } from './capitalProductsService';
import type {
  ProviderSearchResponse,
  ProviderSearchResult,
  EnrichedProviderProfile,
  EnrichedProductDetail,
  ProviderMatchResponse,
  CapitalProductType,
  ProviderType,
  CapitalProduct,
  CapitalNeed,
} from '../types/capital.types';

// ============================================================================
// CLOUD FUNCTION CALLABLE
// ============================================================================

interface ResearchRequest {
  action: 'search-providers' | 'enrich-provider' | 'enrich-product' | 'match-providers';
  [key: string]: unknown;
}

const capitalProviderResearchFn = httpsCallable<ResearchRequest, unknown>(
  functions,
  'capitalProviderResearch'
);

// ============================================================================
// SEARCH PROVIDERS
// ============================================================================

export interface SearchProvidersParams {
  query: string;
  filters?: {
    providerType?: ProviderType;
    productType?: CapitalProductType;
    region?: string;
  };
}

export async function searchProviders(
  params: SearchProvidersParams
): Promise<ProviderSearchResponse> {
  const result = await capitalProviderResearchFn({
    action: 'search-providers',
    query: params.query,
    filters: params.filters,
  });
  return result.data as ProviderSearchResponse;
}

// ============================================================================
// ENRICH PROVIDER
// ============================================================================

export async function enrichProvider(
  provider: { name: string; providerType?: ProviderType; website?: string }
): Promise<EnrichedProviderProfile> {
  const result = await capitalProviderResearchFn({
    action: 'enrich-provider',
    provider,
  });
  return (result.data as { enrichedProvider: EnrichedProviderProfile }).enrichedProvider;
}

// ============================================================================
// ENRICH PRODUCT
// ============================================================================

export async function enrichProduct(
  provider: string,
  product: string,
  productType?: CapitalProductType
): Promise<EnrichedProductDetail> {
  const result = await capitalProviderResearchFn({
    action: 'enrich-product',
    provider,
    product,
    productType,
  });
  return (result.data as { enrichedProduct: EnrichedProductDetail }).enrichedProduct;
}

// ============================================================================
// MATCH PROVIDERS
// ============================================================================

export interface BusinessMatchProfile {
  monthlyRevenue: number;
  yearsInBusiness: number;
  hasCollateral: boolean;
  sectors: string[];
  readinessScore: number;
  documentReadiness: number;
  financialHealth: number;
}

export async function matchProviders(
  businessProfile: BusinessMatchProfile,
  capitalNeed: Partial<CapitalNeed>
): Promise<ProviderMatchResponse> {
  const result = await capitalProviderResearchFn({
    action: 'match-providers',
    businessProfile,
    capitalNeed: {
      type: capitalNeed.type,
      amountRequired: capitalNeed.amountRequired,
      currency: capitalNeed.currency,
      urgency: capitalNeed.urgency,
      description: capitalNeed.description,
    },
  });
  return result.data as ProviderMatchResponse;
}

// ============================================================================
// SAVE TO CATALOG — Convert AI results into CapitalProduct records
// ============================================================================

// Simple email validation to filter out AI-generated junk
function isValidEmail(email: string | undefined): email is string {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Ensure numeric fields from AI are actually numbers (not strings or NaN)
function sanitizeNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Strip all undefined values from an object (Firestore rejects undefined)
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

export async function saveProductToCatalog(
  companyId: string,
  provider: ProviderSearchResult | EnrichedProviderProfile,
  product: EnrichedProductDetail,
): Promise<CapitalProduct> {
  // Map requirements — strip undefined description to avoid Firestore rejection
  const requirements = (product.requirements || []).map(r => {
    const req: { document: string; mandatory: boolean; description?: string } = {
      document: typeof r === 'string' ? r : (r.document || 'Document'),
      mandatory: typeof r === 'string' ? true : (r.mandatory ?? true),
    };
    const desc = typeof r === 'string' ? undefined : r.description;
    if (desc) req.description = desc;
    return req;
  });

  const providerName = 'fullName' in provider ? provider.fullName : provider.name;
  const smeUnit = 'contactInfo' in provider
    ? (provider.contactInfo as EnrichedProviderProfile['contactInfo'])?.smeUnit
    : undefined;
  const rawEmail = smeUnit?.email
    || ('contactInfo' in provider
      ? (provider.contactInfo as EnrichedProviderProfile['contactInfo'])?.generalEmail
      : (provider as ProviderSearchResult).contactInfo?.email);
  const generalPhone = 'contactInfo' in provider
    ? (provider.contactInfo as EnrichedProviderProfile['contactInfo'])?.generalPhone
    : (provider as ProviderSearchResult).contactInfo?.phone;

  // Build input, only including fields with defined values (Firestore rejects undefined)
  const input: Record<string, unknown> = {
    name: product.name || 'Unnamed Product',
    provider: providerName || 'Unknown Provider',
    providerType: provider.providerType || 'bank',
    productType: product.productType || 'term_loan',
    currency: product.currency || 'UGX',
    collateralRequired: product.collateralRequired ?? false,
    requirements,
    status: 'active',
  };

  // Only include optional fields if they have valid values
  const minAmt = sanitizeNumber(product.minAmount);
  const maxAmt = sanitizeNumber(product.maxAmount);
  const rate = sanitizeNumber(product.interestRate);
  const tenorMin = sanitizeNumber(product.tenorMinMonths);
  const tenorMax = sanitizeNumber(product.tenorMaxMonths);
  const fee = sanitizeNumber(product.processingFee);

  if (minAmt !== undefined) input.minAmount = minAmt;
  if (maxAmt !== undefined) input.maxAmount = maxAmt;
  if (rate !== undefined) input.interestRate = rate;
  if (product.interestType) input.interestType = product.interestType;
  if (tenorMin !== undefined) input.tenorMinMonths = Math.round(tenorMin);
  if (tenorMax !== undefined) input.tenorMaxMonths = Math.round(tenorMax);
  if (fee !== undefined) input.processingFee = fee;
  if (product.collateralTypes?.length) input.collateralTypes = product.collateralTypes;
  if (provider.sectors?.length) input.sectors = provider.sectors;
  if (product.description || product.eligibilityCriteria) {
    input.notes = (product.description || product.eligibilityCriteria)?.slice(0, 2000);
  }
  if (smeUnit?.contactPerson) input.contactPerson = smeUnit.contactPerson;
  if (isValidEmail(rawEmail)) input.contactEmail = rawEmail;
  const phone = smeUnit?.phone || generalPhone;
  if (phone) input.contactPhone = phone.slice(0, 50);

  // Final safety: strip any remaining undefined values
  return capitalProductsService.createProduct(companyId, stripUndefined(input) as any);
}

export async function saveProviderProducts(
  companyId: string,
  provider: ProviderSearchResult,
): Promise<CapitalProduct[]> {
  const results: CapitalProduct[] = [];
  for (const product of provider.products) {
    const enrichedProduct: EnrichedProductDetail = {
      ...product,
      requirements: product.requirements?.map(r =>
        typeof r === 'string' ? { document: r, mandatory: true } : r
      ) || [],
    };
    const saved = await saveProductToCatalog(companyId, provider, enrichedProduct);
    results.push(saved);
  }
  return results;
}
