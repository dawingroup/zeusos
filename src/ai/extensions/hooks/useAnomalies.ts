/**
 * useAnomalies Hook
 * Anomaly detection and monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import { anomalyDetectionService } from '../services/anomaly-detection';
import { Anomaly } from '../types/ai-extensions';
import { ModuleType } from '../../../subsidiaries/advisory/cross-module/types/cross-module';

interface UseAnomaliesReturn {
  anomalies: Anomaly[];
  isLoading: boolean;
  error: Error | null;
  detectAnomalies: (
    entityId: string,
    entityData: Record<string, any>,
    historicalData?: Record<string, any>[],
    peerData?: Record<string, any>[]
  ) => Promise<void>;
  resolveAnomaly: (anomalyId: string, resolution: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAnomalies(
  module: ModuleType,
  userId: string,
  entityId?: string
): UseAnomaliesReturn {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to anomalies
  useEffect(() => {
    const unsubscribe = anomalyDetectionService.subscribeAnomalies(
      module,
      setAnomalies
    );
    return unsubscribe;
  }, [module]);

  // Detect anomalies for an entity
  const detectAnomalies = useCallback(async (
    entityId: string,
    entityData: Record<string, any>,
    historicalData: Record<string, any>[] = [],
    peerData: Record<string, any>[] = []
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const detected = await anomalyDetectionService.detectProjectAnomalies(
        entityId,
        entityData,
        historicalData,
        peerData
      );
      setAnomalies(prev => [...detected, ...prev]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Resolve an anomaly
  const resolveAnomaly = useCallback(async (
    anomalyId: string,
    resolution: string
  ) => {
    try {
      await anomalyDetectionService.resolveAnomaly(anomalyId, userId, resolution);
      setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
    } catch (err) {
      setError(err as Error);
    }
  }, [userId]);

  // Refresh anomalies
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetched = await anomalyDetectionService.getAnomalies(module, entityId);
      setAnomalies(fetched);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [module, entityId]);

  return {
    anomalies,
    isLoading,
    error,
    detectAnomalies,
    resolveAnomaly,
    refresh,
  };
}

/**
 * Hook for monitoring a specific entity for anomalies
 */
export function useAnomalyMonitoring(
  module: ModuleType,
  entityId: string,
  onAnomalyDetected?: (anomalies: Anomaly[]) => void
): {
  anomalies: Anomaly[];
  isMonitoring: boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
} {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    const unsub = anomalyDetectionService.startMonitoring(
      module,
      entityId,
      (detected) => {
        setAnomalies(detected);
        onAnomalyDetected?.(detected);
      }
    );
    setUnsubscribe(() => unsub);
    setIsMonitoring(true);
  }, [module, entityId, isMonitoring, onAnomalyDetected]);

  const stopMonitoring = useCallback(() => {
    if (unsubscribe) {
      unsubscribe();
      setUnsubscribe(null);
    }
    setIsMonitoring(false);
  }, [unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [unsubscribe]);

  return {
    anomalies,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
  };
}

/**
 * Hook for critical anomalies only
 */
export function useCriticalAnomalies(module: ModuleType): {
  criticalAnomalies: Anomaly[];
  count: number;
} {
  const [criticalAnomalies, setCriticalAnomalies] = useState<Anomaly[]>([]);

  useEffect(() => {
    const fetchCritical = async () => {
      try {
        const all = await anomalyDetectionService.getAnomalies(module);
        const critical = all.filter(a => a.severity === 'critical' || a.severity === 'high');
        setCriticalAnomalies(critical);
      } catch (error) {
        console.error('Error fetching critical anomalies:', error);
      }
    };

    fetchCritical();

    // Subscribe for updates
    const unsubscribe = anomalyDetectionService.subscribeAnomalies(module, (anomalies) => {
      const critical = anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
      setCriticalAnomalies(critical);
    });

    return unsubscribe;
  }, [module]);

  return {
    criticalAnomalies,
    count: criticalAnomalies.length,
  };
}
