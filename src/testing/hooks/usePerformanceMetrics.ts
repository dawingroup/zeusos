/**
 * usePerformanceMetrics Hook
 * DawinOS v2.0 - Testing Framework
 * Track and analyze test performance metrics
 */

import { useState, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceEntry {
  id: string;
  name: string;
  module: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
  memory?: number;
}

export interface PerformanceReport {
  totalTests: number;
  completedTests: number;
  failedTests: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  byModule: Record<string, ModuleMetrics>;
}

export interface ModuleMetrics {
  name: string;
  tests: number;
  completed: number;
  failed: number;
  avgDuration: number;
  totalDuration: number;
}

// ============================================================================
// HOOK
// ============================================================================

export const usePerformanceMetrics = () => {
  const [entries, setEntries] = useState<PerformanceEntry[]>([]);
  const startTimesRef = useRef<Map<string, number>>(new Map());

  const startTracking = useCallback((id: string, name: string, module: string) => {
    const startTime = performance.now();
    startTimesRef.current.set(id, startTime);

    const entry: PerformanceEntry = {
      id,
      name,
      module,
      startTime,
      status: 'running',
      memory: (performance as any).memory?.usedJSHeapSize,
    };

    setEntries(prev => [...prev.filter(e => e.id !== id), entry]);
  }, []);

  const stopTracking = useCallback((id: string, success: boolean) => {
    const endTime = performance.now();
    const startTime = startTimesRef.current.get(id);

    if (!startTime) return;

    setEntries(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              endTime,
              duration: Math.round(endTime - startTime),
              status: success ? 'completed' : 'failed',
            }
          : e
      )
    );

    startTimesRef.current.delete(id);
  }, []);

  const clearMetrics = useCallback(() => {
    setEntries([]);
    startTimesRef.current.clear();
  }, []);

  const getReport = useCallback((): PerformanceReport => {
    const completed = entries.filter(e => e.status === 'completed');
    const failed = entries.filter(e => e.status === 'failed');
    const durations = completed.map(e => e.duration || 0);

    // Group by module
    const byModule: Record<string, ModuleMetrics> = {};
    entries.forEach(entry => {
      if (!byModule[entry.module]) {
        byModule[entry.module] = {
          name: entry.module,
          tests: 0,
          completed: 0,
          failed: 0,
          avgDuration: 0,
          totalDuration: 0,
        };
      }
      byModule[entry.module].tests++;
      if (entry.status === 'completed') {
        byModule[entry.module].completed++;
        byModule[entry.module].totalDuration += entry.duration || 0;
      }
      if (entry.status === 'failed') {
        byModule[entry.module].failed++;
      }
    });

    // Calculate avg duration per module
    Object.values(byModule).forEach(m => {
      if (m.completed > 0) {
        m.avgDuration = Math.round(m.totalDuration / m.completed);
      }
    });

    return {
      totalTests: entries.length,
      completedTests: completed.length,
      failedTests: failed.length,
      totalDuration: durations.reduce((a, b) => a + b, 0),
      avgDuration: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      byModule,
    };
  }, [entries]);

  const getModuleMetrics = useCallback((module: string): ModuleMetrics | null => {
    const report = getReport();
    return report.byModule[module] || null;
  }, [getReport]);

  return {
    entries,
    startTracking,
    stopTracking,
    clearMetrics,
    getReport,
    getModuleMetrics,
  };
};

export default usePerformanceMetrics;
