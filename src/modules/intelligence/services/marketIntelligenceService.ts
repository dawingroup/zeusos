// ============================================================================
// MARKET INTELLIGENCE SERVICE
// DawinOS v2.0 - AI-Driven Competitive Intelligence
// Frontend service for calling market intelligence cloud functions
// ============================================================================

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';
import type {
  MarketIntelligenceScanInput,
  MarketIntelligenceScanResponse,
  MarketIntelligenceReportsResponse,
  MarketIntelSubsidiaryId,
} from '../types/market-intelligence.types';

// ============================================================================
// SCAN - Run AI market intelligence analysis
// ============================================================================

export const runMarketIntelligenceScan = async (
  input: MarketIntelligenceScanInput
): Promise<MarketIntelligenceScanResponse> => {
  const scanFn = httpsCallable<MarketIntelligenceScanInput, MarketIntelligenceScanResponse>(
    functions,
    'marketIntelligenceScan'
  );

  const result = await scanFn(input);
  return result.data;
};

// ============================================================================
// REPORTS - Fetch historical reports
// ============================================================================

export const fetchMarketIntelligenceReports = async (
  subsidiaryId: MarketIntelSubsidiaryId,
  limit = 10
): Promise<MarketIntelligenceReportsResponse> => {
  const fetchFn = httpsCallable<
    { subsidiaryId: MarketIntelSubsidiaryId; limit: number },
    MarketIntelligenceReportsResponse
  >(functions, 'getMarketIntelligenceReports');

  const result = await fetchFn({ subsidiaryId, limit });
  return result.data;
};
