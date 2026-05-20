/**
 * useProductDefinition — TanStack Query wrapper for PDD CRUD
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPDD, listPDDs, createPDD, updatePDD, clonePDD } from '../services/pdd.service';
import type { PddStatus, ProductType } from '../constants/productDefinition.constants';
import type { CreatePddInput, UpdatePddInput } from '../schemas/productDefinition.schemas';

const PDD_KEYS = {
  all: ['productDefinitions'] as const,
  lists: () => [...PDD_KEYS.all, 'list'] as const,
  list: (filters?: { productType?: ProductType; status?: PddStatus }) =>
    [...PDD_KEYS.lists(), filters] as const,
  details: () => [...PDD_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PDD_KEYS.details(), id] as const,
};

/** Fetch a single PDD by ID */
export function useProductDefinition(pddId: string | undefined) {
  return useQuery({
    queryKey: PDD_KEYS.detail(pddId || ''),
    queryFn: () => getPDD(pddId!),
    enabled: !!pddId,
  });
}

/** List PDDs with optional filters */
export function useProductDefinitions(filters?: {
  productType?: ProductType;
  status?: PddStatus;
}) {
  return useQuery({
    queryKey: PDD_KEYS.list(filters),
    queryFn: () => listPDDs(filters),
  });
}

/** Create a new PDD */
export function useCreatePDD() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePddInput) => createPDD(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PDD_KEYS.lists() });
    },
  });
}

/** Update an existing PDD */
export function useUpdatePDD() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pddId, updates }: { pddId: string; updates: UpdatePddInput }) =>
      updatePDD(pddId, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: PDD_KEYS.detail(variables.pddId) });
      queryClient.invalidateQueries({ queryKey: PDD_KEYS.lists() });
    },
  });
}

/** Clone a PDD */
export function useClonePDD() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pddId, newName }: { pddId: string; newName?: string }) =>
      clonePDD(pddId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PDD_KEYS.lists() });
    },
  });
}
