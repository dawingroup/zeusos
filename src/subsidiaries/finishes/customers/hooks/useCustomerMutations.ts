/**
 * useCustomerMutations Hook
 * CRUD operations for customers with loading and error states
 */

import { useState, useCallback } from 'react';
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  generateCustomerCode,
} from '../services/customerService';
import type { CustomerFormData } from '../types';

interface MutationState {
  loading: boolean;
  error: Error | null;
}

interface UseCustomerMutationsReturn {
  createState: MutationState;
  updateState: MutationState;
  deleteState: MutationState;
  create: (data: CustomerFormData, userId: string) => Promise<string>;
  update: (customerId: string, data: Partial<CustomerFormData>, userId: string) => Promise<void>;
  remove: (customerId: string, userId: string, hardDelete?: boolean) => Promise<void>;
  generateCode: () => Promise<string>;
  clearErrors: () => void;
}

export function useCustomerMutations(): UseCustomerMutationsReturn {
  const [createState, setCreateState] = useState<MutationState>({ loading: false, error: null });
  const [updateState, setUpdateState] = useState<MutationState>({ loading: false, error: null });
  const [deleteState, setDeleteState] = useState<MutationState>({ loading: false, error: null });

  const create = useCallback(async (data: CustomerFormData, userId: string): Promise<string> => {
    setCreateState({ loading: true, error: null });
    try {
      const id = await createCustomer(data, userId);
      setCreateState({ loading: false, error: null });
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create customer');
      setCreateState({ loading: false, error });
      throw error;
    }
  }, []);

  const update = useCallback(
    async (customerId: string, data: Partial<CustomerFormData>, userId: string): Promise<void> => {
      setUpdateState({ loading: true, error: null });
      try {
        await updateCustomer(customerId, data, userId);
        setUpdateState({ loading: false, error: null });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update customer');
        setUpdateState({ loading: false, error });
        throw error;
      }
    },
    []
  );

  const remove = useCallback(
    async (customerId: string, userId: string, hardDelete = false): Promise<void> => {
      setDeleteState({ loading: true, error: null });
      try {
        await deleteCustomer(customerId, userId, hardDelete);
        setDeleteState({ loading: false, error: null });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete customer');
        setDeleteState({ loading: false, error });
        throw error;
      }
    },
    []
  );

  const clearErrors = useCallback(() => {
    setCreateState((s) => ({ ...s, error: null }));
    setUpdateState((s) => ({ ...s, error: null }));
    setDeleteState((s) => ({ ...s, error: null }));
  }, []);

  return {
    createState,
    updateState,
    deleteState,
    create,
    update,
    remove,
    generateCode: generateCustomerCode,
    clearErrors,
  };
}
