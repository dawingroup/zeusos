/**
 * Customer Hooks for MatFlow
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getCustomersForMatFlow, 
  searchCustomers, 
  getCustomerById,
} from '../services/customerService';
import type { MatFlowCustomerSummary, SharedCustomer } from '../types/customer';

export function useCustomers() {
  const [customers, setCustomers] = useState<MatFlowCustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setIsLoading(true);
        const data = await getCustomersForMatFlow();
        setCustomers(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load customers'));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCustomers();
  }, []);
  
  return { customers, isLoading, error };
}

export function useCustomerSearch() {
  const [results, setResults] = useState<MatFlowCustomerSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const data = await searchCustomers(term);
      setResults(data);
    } catch (err) {
      console.error('Customer search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);
  
  const clear = useCallback(() => {
    setResults([]);
  }, []);
  
  return { results, isSearching, search, clear };
}

export function useCustomer(customerId: string | null) {
  const [customer, setCustomer] = useState<SharedCustomer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      return;
    }
    
    const loadCustomer = async () => {
      setIsLoading(true);
      try {
        const data = await getCustomerById(customerId);
        setCustomer(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load customer'));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCustomer();
  }, [customerId]);
  
  return { customer, isLoading, error };
}
