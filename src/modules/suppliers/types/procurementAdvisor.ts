/**
 * Smart Procurement Advisor Types
 * Types for AI-powered supplier enrichment, procurement recommendations,
 * price trend analysis, and risk assessment.
 */

// ============================================================================
// SUPPLIER ENRICHMENT (Web Lookup)
// ============================================================================

/**
 * AI-enriched supplier profile data from web lookup.
 * Returns addresses, websites, certifications, news, reviews.
 */
export interface SupplierEnrichmentResult {
  website?: string;
  addresses?: EnrichedAddress[];
  socialMedia?: { platform: string; url: string }[];
  certifications?: string[];
  yearEstablished?: number;
  employeeCount?: string;
  annualRevenue?: string;
  specializations?: string[];
  brands?: string[];
  serviceAreas?: string[];
  reviews?: {
    source: string;
    rating: number;
    reviewCount: number;
  }[];
  newsAlerts?: {
    title: string;
    date: string;
    summary: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
}

export interface EnrichedAddress {
  type: 'headquarters' | 'branch' | 'warehouse' | 'showroom';
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  country: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

// ============================================================================
// PROCUREMENT RECOMMENDATIONS
// ============================================================================

export type ProcurementAction = 'keep' | 'switch' | 'renegotiate' | 'add-backup';

export interface ProcurementRecommendation {
  itemId: string;
  itemName: string;
  currentSupplierId: string;
  currentSupplierName: string;
  recommendedSupplierId: string;
  recommendedSupplierName: string;
  reason: string;
  potentialSavings?: {
    amount: number;
    currency: string;
    percentage: number;
  };
  action: ProcurementAction;
  confidence: number;
}

// ============================================================================
// PRICE TREND ANALYSIS
// ============================================================================

export interface PriceTrendAnalysis {
  supplierId: string;
  supplierName: string;
  trend: 'rising' | 'stable' | 'falling';
  avgChangePercent: number;
  dataPoints: { date: string; price: number }[];
  forecast: { date: string; predictedPrice: number }[];
  renegotiationWindow?: string;
}

// ============================================================================
// RISK ALERTS
// ============================================================================

export type RiskType =
  | 'delivery'
  | 'quality'
  | 'financial'
  | 'concentration'
  | 'geopolitical';

export interface SupplierRiskAlert {
  supplierId: string;
  supplierName: string;
  riskType: RiskType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

// ============================================================================
// FULL ADVISOR RESULT
// ============================================================================

export interface ProcurementAdvisorResult {
  supplierEnrichment: SupplierEnrichmentResult;
  recommendations: ProcurementRecommendation[];
  priceTrends: PriceTrendAnalysis[];
  riskAlerts: SupplierRiskAlert[];
  marketInsights: string[];
  analyzedAt: string;
}
