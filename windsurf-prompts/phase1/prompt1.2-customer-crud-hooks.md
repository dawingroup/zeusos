# Prompt 1.2: Customer CRUD Hooks

## Objective
Create React hooks for customer data management with real-time Firestore subscriptions, loading states, and error handling.

## Prerequisites
- Completed Prompt 1.1 (Customer Data Model)

## Requirements

### 1. Create useCustomers Hook

Create file: `src/modules/customer-hub/hooks/useCustomers.ts`

```typescript
/**
 * useCustomers Hook
 * Subscribe to customer list with filtering options
 */

import { useState, useEffect, useMemo } from 'react';
import { subscribeToCustomers } from '../services/customerService';
import type { CustomerListItem, CustomerStatus, CustomerType } from '../types';

interface UseCustomersOptions {
  status?: CustomerStatus;
  type?: CustomerType;
  searchQuery?: string;
}

interface UseCustomersReturn {
  customers: CustomerListItem[];
  loading: boolean;
  error: Error | null;
  filteredCustomers: CustomerListItem[];
}

export function useCustomers(options: UseCustomersOptions = {}): UseCustomersReturn {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { status, type, searchQuery } = options;

  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const unsubscribe = subscribeToCustomers(
        (data) => {
          setCustomers(data);
          setLoading(false);
        },
        { status }
      );

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load customers'));
      setLoading(false);
    }
  }, [status]);

  // Client-side filtering for type and search
  const filteredCustomers = useMemo(() => {
    let result = customers;

    if (type) {
      result = result.filter((c) => c.type === type);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.code.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [customers, type, searchQuery]);

  return { customers, loading, error, filteredCustomers };
}
```

### 2. Create useCustomer Hook

Create file: `src/modules/customer-hub/hooks/useCustomer.ts`

```typescript
/**
 * useCustomer Hook
 * Subscribe to a single customer document
 */

import { useState, useEffect } from 'react';
import { subscribeToCustomer } from '../services/customerService';
import type { Customer } from '../types';

interface UseCustomerReturn {
  customer: Customer | null;
  loading: boolean;
  error: Error | null;
}

export function useCustomer(customerId: string | undefined): UseCustomerReturn {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = subscribeToCustomer(customerId, (data) => {
        setCustomer(data);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load customer'));
      setLoading(false);
    }
  }, [customerId]);

  return { customer, loading, error };
}
```

### 3. Create useCustomerMutations Hook

Create file: `src/modules/customer-hub/hooks/useCustomerMutations.ts`

```typescript
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
  generateCode: (name: string, type: string) => string;
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
```

### 4. Create Hooks Index

Create file: `src/modules/customer-hub/hooks/index.ts`

```typescript
/**
 * Customer Hub Hooks
 * Export all customer-related hooks
 */

export { useCustomers } from './useCustomers';
export { useCustomer } from './useCustomer';
export { useCustomerMutations } from './useCustomerMutations';
```

### 5. Update Module Index

Update file: `src/modules/customer-hub/index.ts`

```typescript
/**
 * Customer Hub Module
 * Exports for customer management functionality
 */

// Types
export * from './types';

// Services
export * from './services/customerService';

// Hooks
export * from './hooks';
```

## Validation Checklist

- [ ] Hooks compile without TypeScript errors
- [ ] useCustomers returns real-time updated customer list
- [ ] useCustomer subscribes to single customer document
- [ ] useCustomerMutations handles create, update, delete operations
- [ ] Loading and error states work correctly
- [ ] Search and filter functionality works client-side

## Next Steps

After completing this prompt, proceed to:
- **Prompt 1.3**: Customer Management UI - React components for customer CRUD interface
