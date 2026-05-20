/**
 * EFRIS Validation Hooks
 * React hooks for managing EFRIS invoice validation
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  validateAndSaveInvoice,
  getProjectValidations,
  getDeliveryValidation,
  revalidateInvoice,
  calculateTaxComplianceSummary,
  verifySupplierTIN,
  batchValidatePending,
  isValidFDN,
  parseFDN,
} from '../services/efrisService';
import {
  InvoiceValidationRecord,
  EFRISInvoiceStatus,
  SupplierTaxProfile,
  DeliveryLogForValidation,
} from '../types/efris';
import { useAuth } from '@/shared/hooks/useAuth';

// Simple toast helper
const showToast = (title: string, description: string, variant?: 'default' | 'destructive') => {
  if (variant === 'destructive') {
    console.error(`[Toast] ${title}: ${description}`);
  } else {
    console.log(`[Toast] ${title}: ${description}`);
  }
};

/**
 * Main EFRIS validation hook
 */
export function useEFRISValidation(projectId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Get all validations for project
  const {
    data: validations = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['efris-validations', projectId],
    queryFn: () => getProjectValidations(projectId),
    enabled: !!projectId,
  });
  
  // Validate invoice mutation
  const validateMutation = useMutation({
    mutationFn: async ({ fdn, delivery }: { fdn: string; delivery: DeliveryLogForValidation }) => {
      if (!user?.uid) throw new Error('Not authenticated');
      return validateAndSaveInvoice(projectId, fdn, delivery, user.uid);
    },
    onSuccess: (record: InvoiceValidationRecord) => {
      queryClient.invalidateQueries({ queryKey: ['efris-validations', projectId] });
      
      if (record.validationStatus === 'valid') {
        showToast('Invoice Validated', `FDN ${record.fdn} validated successfully`);
      } else {
        showToast(
          'Validation Issue',
          record.validationError || 'Invoice could not be validated',
          'destructive'
        );
      }
    },
    onError: (error: Error) => {
      showToast('Validation Failed', error.message, 'destructive');
    },
  });
  
  // Revalidate mutation
  const revalidateMutation = useMutation({
    mutationFn: async (validationId: string) => {
      if (!user?.uid) throw new Error('Not authenticated');
      return revalidateInvoice(projectId, validationId, user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['efris-validations', projectId] });
      showToast('Revalidation Complete', 'Invoice has been revalidated');
    },
  });
  
  // Batch validate mutation
  const batchValidateMutation = useMutation({
    mutationFn: async (maxCount?: number) => {
      if (!user?.uid) throw new Error('Not authenticated');
      return batchValidatePending(projectId, user.uid, maxCount);
    },
    onSuccess: (result: { validated: number; failed: number }) => {
      queryClient.invalidateQueries({ queryKey: ['efris-validations', projectId] });
      showToast(
        'Batch Validation Complete',
        `${result.validated} validated, ${result.failed} failed`
      );
    },
  });
  
  // Computed stats
  const stats = {
    total: validations.length,
    valid: validations.filter((v: InvoiceValidationRecord) => v.validationStatus === 'valid').length,
    invalid: validations.filter((v: InvoiceValidationRecord) => 
      ['invalid', 'expired', 'cancelled', 'not_found'].includes(v.validationStatus)
    ).length,
    pending: validations.filter((v: InvoiceValidationRecord) => v.validationStatus === 'pending').length,
  };
  
  return {
    validations,
    stats,
    isLoading,
    error,
    refetch,
    validateInvoice: validateMutation.mutate,
    isValidating: validateMutation.isPending,
    revalidateInvoice: revalidateMutation.mutate,
    isRevalidating: revalidateMutation.isPending,
    batchValidate: batchValidateMutation.mutate,
    isBatchValidating: batchValidateMutation.isPending,
  };
}

/**
 * Hook for single delivery validation
 */
export function useDeliveryValidation(projectId: string, deliveryId: string) {
  const {
    data: validation,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['efris-validation', projectId, deliveryId],
    queryFn: () => getDeliveryValidation(projectId, deliveryId),
    enabled: !!projectId && !!deliveryId,
  });
  
  return {
    validation,
    isLoading,
    error,
    refetch,
    hasValidation: !!validation,
    isValid: validation?.validationStatus === 'valid',
  };
}

/**
 * Hook for FDN input validation
 */
export function useFDNInput() {
  const [fdn, setFDN] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [parsed, setParsed] = useState<ReturnType<typeof parseFDN>>(null);
  
  useEffect(() => {
    const valid = isValidFDN(fdn);
    setIsValid(valid);
    setParsed(valid ? parseFDN(fdn) : null);
  }, [fdn]);
  
  const handleChange = useCallback((value: string) => {
    // Auto-format FDN as user types
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (cleaned.length <= 8) {
      setFDN(cleaned);
    } else if (cleaned.length <= 16) {
      setFDN(`${cleaned.slice(0, 8)}-${cleaned.slice(8)}`);
    } else {
      setFDN(`${cleaned.slice(0, 8)}-${cleaned.slice(8, 16)}-${cleaned.slice(16, 20)}`);
    }
  }, []);
  
  const reset = useCallback(() => {
    setFDN('');
    setIsValid(false);
    setParsed(null);
  }, []);
  
  return {
    fdn,
    setFDN: handleChange,
    isValid,
    parsed,
    reset,
  };
}

/**
 * Hook for tax compliance summary
 */
export function useTaxComplianceSummary(
  projectId: string,
  startDate: string,
  endDate: string
) {
  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['tax-compliance', projectId, startDate, endDate],
    queryFn: () => calculateTaxComplianceSummary(projectId, startDate, endDate),
    enabled: !!projectId && !!startDate && !!endDate,
  });
  
  return {
    summary,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for supplier TIN verification
 */
export function useSupplierTINVerification() {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<SupplierTaxProfile | null>(null);
  
  const verify = useCallback(async (tin: string) => {
    setVerifying(true);
    setResult(null);
    
    try {
      const profile = await verifySupplierTIN(tin);
      setResult(profile);
      
      if (profile) {
        showToast('TIN Verified', `${profile.tradeName} - ${profile.taxStatus}`);
      } else {
        showToast('TIN Not Found', 'No tax profile found for this TIN', 'destructive');
      }
      
      return profile;
    } catch (error) {
      showToast('Verification Failed', 'Could not verify supplier TIN', 'destructive');
      return null;
    } finally {
      setVerifying(false);
    }
  }, []);
  
  const reset = useCallback(() => {
    setResult(null);
  }, []);
  
  return {
    verify,
    verifying,
    result,
    reset,
  };
}

/**
 * Hook to filter validations by status
 */
export function useFilteredValidations(
  validations: InvoiceValidationRecord[],
  initialStatus?: EFRISInvoiceStatus
) {
  const [statusFilter, setStatusFilter] = useState<EFRISInvoiceStatus | 'all'>(
    initialStatus || 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  
  const filtered = validations.filter(v => {
    // Status filter
    if (statusFilter !== 'all' && v.validationStatus !== statusFilter) {
      return false;
    }
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        v.fdn.toLowerCase().includes(term) ||
        v.invoiceNumber.toLowerCase().includes(term) ||
        v.supplierName.toLowerCase().includes(term)
      );
    }
    
    return true;
  });
  
  return {
    filtered,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
  };
}
