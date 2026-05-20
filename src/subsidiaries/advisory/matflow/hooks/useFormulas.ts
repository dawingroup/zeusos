/**
 * Formula Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getFormulas,
  getFormulaById,
  searchFormulas,
} from '../services/formulaService';
import type { StandardFormula, MaterialCategory } from '../types';

export function useFormulas(category?: MaterialCategory) {
  const [formulas, setFormulas] = useState<StandardFormula[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await getFormulas(category);
        setFormulas(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load formulas'));
      } finally {
        setIsLoading(false);
      }
    };
    
    load();
  }, [category]);
  
  return { formulas, isLoading, error };
}

export function useFormula(formulaId: string | null) {
  const [formula, setFormula] = useState<StandardFormula | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (!formulaId) {
      setFormula(null);
      return;
    }
    
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getFormulaById(formulaId);
        setFormula(data);
      } finally {
        setIsLoading(false);
      }
    };
    
    load();
  }, [formulaId]);
  
  return { formula, isLoading };
}

export function useFormulaSearch() {
  const [results, setResults] = useState<StandardFormula[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const data = await searchFormulas(term);
      setResults(data);
    } finally {
      setIsSearching(false);
    }
  }, []);
  
  return { results, isSearching, search };
}
