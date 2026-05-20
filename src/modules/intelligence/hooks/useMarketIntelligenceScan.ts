// ============================================================================
// USE MARKET INTELLIGENCE SCAN HOOK
// DawinOS v2.0 - AI-Driven Competitive Intelligence
// React hook for managing market intelligence scan state
// ============================================================================

import { useState, useCallback } from 'react';
import {
  runMarketIntelligenceScan,
  fetchMarketIntelligenceReports,
} from '../services/marketIntelligenceService';
import type {
  MarketIntelligenceScanInput,
  MarketIntelligenceScanResponse,
  MarketIntelligenceReport,
  StoredMarketIntelligenceReport,
  MarketIntelSubsidiaryId,
} from '../types/market-intelligence.types';

interface UseMarketIntelligenceScanReturn {
  // Scan state
  isScanning: boolean;
  scanResult: MarketIntelligenceScanResponse | null;
  scanError: string | null;
  runScan: (input: MarketIntelligenceScanInput) => Promise<void>;
  clearScan: () => void;

  // Reports state
  reports: StoredMarketIntelligenceReport[];
  isLoadingReports: boolean;
  reportsError: string | null;
  loadReports: (subsidiaryId: MarketIntelSubsidiaryId, limit?: number) => Promise<void>;

  // Active report
  activeReport: MarketIntelligenceReport | null;
  setActiveReport: (report: MarketIntelligenceReport | null) => void;
}

export const useMarketIntelligenceScan = (): UseMarketIntelligenceScanReturn => {
  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<MarketIntelligenceScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Reports state
  const [reports, setReports] = useState<StoredMarketIntelligenceReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);

  // Active report
  const [activeReport, setActiveReport] = useState<MarketIntelligenceReport | null>(null);

  const runScan = useCallback(async (input: MarketIntelligenceScanInput) => {
    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const result = await runMarketIntelligenceScan(input);
      setScanResult(result);

      // Set the report as active for viewing
      if (result.report) {
        setActiveReport(result.report);
      }
    } catch (err) {
      console.error('Market intelligence scan error:', err);
      const message = err instanceof Error ? err.message : 'Failed to run market intelligence scan';
      setScanError(message);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const clearScan = useCallback(() => {
    setScanResult(null);
    setScanError(null);
    setActiveReport(null);
  }, []);

  const loadReports = useCallback(async (subsidiaryId: MarketIntelSubsidiaryId, limit = 10) => {
    setIsLoadingReports(true);
    setReportsError(null);

    try {
      const result = await fetchMarketIntelligenceReports(subsidiaryId, limit);
      setReports(result.reports || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
      const message = err instanceof Error ? err.message : 'Failed to load reports';
      setReportsError(message);
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  return {
    isScanning,
    scanResult,
    scanError,
    runScan,
    clearScan,
    reports,
    isLoadingReports,
    reportsError,
    loadReports,
    activeReport,
    setActiveReport,
  };
};

export default useMarketIntelligenceScan;
