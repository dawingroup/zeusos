/**
 * Smart Procurement Advisor Service
 * AI-powered supplier enrichment (addresses, websites, certifications),
 * procurement recommendations, price trend analysis, and risk assessment.
 *
 * Uses Firebase Cloud Functions:
 * - Gemini 2.0 Flash + Google Search grounding for supplier web lookup
 * - Claude Sonnet for analysis, recommendations, and risk assessment
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';
import { getSupplier, updateSupplier } from './supplierService';
import type { Supplier, SupplierAIIntelligence } from '../types/supplier';
import type {
  SupplierEnrichmentResult,
  ProcurementAdvisorResult,
  ProcurementRecommendation,
  PriceTrendAnalysis,
  SupplierRiskAlert,
} from '../types/procurementAdvisor';

// ============================================================================
// CLOUD FUNCTION CALLABLE
// ============================================================================

interface ProcurementAdvisorRequest {
  action: 'enrich' | 'analyze' | 'full-analysis';
  supplier: Record<string, unknown>;
}

interface EnrichResponse {
  enrichment: SupplierEnrichmentResult;
}

interface AnalyzeResponse {
  recommendations: ProcurementRecommendation[];
  priceTrends: PriceTrendAnalysis[];
  riskAlerts: SupplierRiskAlert[];
  marketInsights: string[];
}

interface FullAnalysisResponse extends AnalyzeResponse {
  enrichment: SupplierEnrichmentResult;
}

const procurementAdvisorFn = httpsCallable<
  ProcurementAdvisorRequest,
  EnrichResponse | AnalyzeResponse | FullAnalysisResponse
>(functions, 'procurementAdvisor');

// ============================================================================
// AI API CALLS
// ============================================================================

/**
 * Enrich a supplier profile via AI web lookup.
 * Uses Gemini with Google Search grounding to find addresses, websites,
 * certifications, news, reviews, specializations.
 */
export async function enrichSupplierProfile(
  supplier: Supplier
): Promise<SupplierEnrichmentResult> {
  const result = await procurementAdvisorFn({
    action: 'enrich',
    supplier: {
      name: supplier.name,
      tradeName: supplier.tradeName,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      website: supplier.website,
      address: supplier.address,
      categories: supplier.categories,
      registrationNumber: supplier.registrationNumber,
    },
  });

  return (result.data as EnrichResponse).enrichment;
}

/**
 * Get procurement recommendations for a supplier's items.
 * Uses Claude to analyze pricing history, lead times, quality to suggest actions.
 */
export async function getProcurementRecommendations(
  supplier: Supplier
): Promise<ProcurementRecommendation[]> {
  const result = await procurementAdvisorFn({
    action: 'analyze',
    supplier: {
      id: supplier.id,
      name: supplier.name,
      rating: supplier.rating,
      totalOrders: supplier.totalOrders,
      onTimeDeliveryRate: supplier.onTimeDeliveryRate,
      qualityScore: supplier.qualityScore,
      paymentTerms: supplier.paymentTerms,
      categories: supplier.categories,
      address: supplier.address,
      materials: supplier.materials,
    },
  });

  return (result.data as AnalyzeResponse).recommendations || [];
}

/**
 * Analyze price trends for a supplier.
 * Uses Claude to analyze pricing data and generate forecasts.
 */
export async function analyzePriceTrends(
  supplier: Supplier
): Promise<PriceTrendAnalysis[]> {
  const result = await procurementAdvisorFn({
    action: 'analyze',
    supplier: {
      id: supplier.id,
      name: supplier.name,
      totalOrders: supplier.totalOrders,
      totalValue: supplier.totalValue,
      categories: supplier.categories,
    },
  });

  return (result.data as AnalyzeResponse).priceTrends || [];
}

/**
 * Assess supplier risks based on performance data.
 * Uses Claude to evaluate delivery, quality, financial, and geopolitical risks.
 */
export async function assessSupplierRisks(
  supplier: Supplier
): Promise<SupplierRiskAlert[]> {
  const result = await procurementAdvisorFn({
    action: 'analyze',
    supplier: {
      id: supplier.id,
      name: supplier.name,
      status: supplier.status,
      rating: supplier.rating,
      totalOrders: supplier.totalOrders,
      totalValue: supplier.totalValue,
      onTimeDeliveryRate: supplier.onTimeDeliveryRate,
      qualityScore: supplier.qualityScore,
      paymentTerms: supplier.paymentTerms,
      categories: supplier.categories,
      address: supplier.address,
    },
  });

  return (result.data as AnalyzeResponse).riskAlerts || [];
}

/**
 * Full procurement analysis: enrichment + recommendations + trends + risks.
 * Uses Gemini for web lookup + Claude for analysis.
 */
export async function analyzeSupplier(
  supplier: Supplier
): Promise<ProcurementAdvisorResult> {
  const result = await procurementAdvisorFn({
    action: 'full-analysis',
    supplier: {
      id: supplier.id,
      name: supplier.name,
      tradeName: supplier.tradeName,
      code: supplier.code,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      website: supplier.website,
      address: supplier.address,
      categories: supplier.categories,
      materials: supplier.materials,
      rating: supplier.rating,
      totalOrders: supplier.totalOrders,
      totalValue: supplier.totalValue,
      onTimeDeliveryRate: supplier.onTimeDeliveryRate,
      qualityScore: supplier.qualityScore,
      paymentTerms: supplier.paymentTerms,
      status: supplier.status,
      registrationNumber: supplier.registrationNumber,
    },
  });

  const data = result.data as FullAnalysisResponse;

  return {
    supplierEnrichment: data.enrichment,
    recommendations: data.recommendations || [],
    priceTrends: data.priceTrends || [],
    riskAlerts: data.riskAlerts || [],
    marketInsights: data.marketInsights || [],
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================================================
// APPLY ENRICHMENT
// ============================================================================

/**
 * Write enriched data back to the Firestore supplier record.
 */
export async function applyEnrichmentToSupplier(
  supplierId: string,
  enrichment: SupplierEnrichmentResult,
  userId: string
): Promise<void> {
  const supplier = await getSupplier(supplierId);
  if (!supplier) {
    throw new Error(`Supplier ${supplierId} not found`);
  }

  const updates: Partial<Supplier> = {};

  // Apply website if found and not already set
  if (enrichment.website && !supplier.website) {
    updates.website = enrichment.website;
  }

  // Apply primary address if supplier has no address
  if (enrichment.addresses?.length && !supplier.address?.line1) {
    const primary =
      enrichment.addresses.find((a) => a.type === 'headquarters') ||
      enrichment.addresses[0];
    updates.address = {
      line1: primary.line1,
      line2: primary.line2,
      city: primary.city,
      region: primary.region,
      country: primary.country,
      postalCode: primary.postalCode,
    };
  }

  // Persist enrichment to aiIntelligence
  updates.aiIntelligence = {
    ...(supplier.aiIntelligence || {}),
    enrichment,
    lastEnrichedAt: new Date().toISOString(),
  };

  await updateSupplier(supplierId, updates, userId);
}

// ============================================================================
// SAVE FULL ANALYSIS
// ============================================================================

/**
 * Persist the complete procurement advisor analysis to the supplier record.
 * Saves enrichment, recommendations, price trends, risk alerts, and market insights.
 */
export async function saveFullAnalysis(
  supplierId: string,
  advisorResult: ProcurementAdvisorResult,
  userId: string
): Promise<void> {
  const supplier = await getSupplier(supplierId);
  if (!supplier) {
    throw new Error(`Supplier ${supplierId} not found`);
  }

  const aiIntelligence: SupplierAIIntelligence = {
    enrichment: advisorResult.supplierEnrichment,
    recommendations: advisorResult.recommendations,
    priceTrends: advisorResult.priceTrends,
    riskAlerts: advisorResult.riskAlerts,
    marketInsights: advisorResult.marketInsights,
    lastAnalyzedAt: advisorResult.analyzedAt,
    lastEnrichedAt: advisorResult.supplierEnrichment
      ? new Date().toISOString()
      : supplier.aiIntelligence?.lastEnrichedAt,
  };

  const updates: Partial<Supplier> = { aiIntelligence };

  // Also apply website/address if not already set
  if (advisorResult.supplierEnrichment?.website && !supplier.website) {
    updates.website = advisorResult.supplierEnrichment.website;
  }

  if (advisorResult.supplierEnrichment?.addresses?.length && !supplier.address?.line1) {
    const primary =
      advisorResult.supplierEnrichment.addresses.find((a) => a.type === 'headquarters') ||
      advisorResult.supplierEnrichment.addresses[0];
    updates.address = {
      line1: primary.line1,
      line2: primary.line2,
      city: primary.city,
      region: primary.region,
      country: primary.country,
      postalCode: primary.postalCode,
    };
  }

  await updateSupplier(supplierId, updates, userId);
}
