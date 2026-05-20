/**
 * Material Calculator Hook
 */

import { useState, useCallback, useMemo } from 'react';
import {
  calculateMaterials,
  calculateBatchMaterials,
  aggregateMaterials,
  type CalculationResult,
  type CalculationOptions,
} from '../services/materialCalculator';
import type { BOQItem, MaterialRequirement } from '../types';

export function useMaterialCalculator() {
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastResults, setLastResults] = useState<Map<string, CalculationResult>>(new Map());
  
  const calculate = useCallback(async (
    boqItem: BOQItem,
    options?: CalculationOptions
  ): Promise<CalculationResult> => {
    setIsCalculating(true);
    try {
      const result = await calculateMaterials(boqItem, options);
      setLastResults(prev => new Map(prev).set(boqItem.id, result));
      return result;
    } finally {
      setIsCalculating(false);
    }
  }, []);
  
  const calculateBatch = useCallback(async (
    boqItems: BOQItem[],
    options?: CalculationOptions
  ): Promise<Map<string, CalculationResult>> => {
    setIsCalculating(true);
    try {
      const results = await calculateBatchMaterials(boqItems, options);
      setLastResults(results);
      return results;
    } finally {
      setIsCalculating(false);
    }
  }, []);
  
  const aggregatedMaterials = useMemo((): MaterialRequirement[] => {
    return aggregateMaterials(lastResults);
  }, [lastResults]);
  
  return {
    calculate,
    calculateBatch,
    isCalculating,
    lastResults,
    aggregatedMaterials,
  };
}
