/**
 * BOQ Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import {
  createBOQItem,
  updateBOQItem,
  deleteBOQItem,
  subscribeToBOQItems,
  type CreateBOQItemInput,
} from '../services/boqService';
import type { BOQItem, ConstructionStage } from '../types';

// Default organization ID for MatFlow
const DEFAULT_ORG_ID = 'default';

export function useBOQItems(projectId: string) {
  const { user } = useAuth();
  const [items, setItems] = useState<BOQItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  
  useEffect(() => {
    if (!user || !projectId) return;
    
    setIsLoading(true);
    const unsubscribe = subscribeToBOQItems(orgId, projectId, (data) => {
      setItems(data);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [orgId, user, projectId]);
  
  // Group by stage
  const itemsByStage = items.reduce((acc: Record<string, BOQItem[]>, item) => {
    const stage = item.stage || 'unassigned';
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(item);
    return acc;
  }, {} as Record<string, BOQItem[]>) as Record<ConstructionStage, BOQItem[]>;
  
  return { items, itemsByStage, isLoading };
}

export function useBOQMutations(projectId: string) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;
  
  const create = useCallback(async (input: CreateBOQItemInput) => {
    if (!userId) throw new Error('Not authenticated');
    setIsSubmitting(true);
    try {
      return await createBOQItem(orgId, projectId, userId, input);
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, userId, projectId]);
  
  const update = useCallback(async (itemId: string, updates: Partial<BOQItem>) => {
    if (!userId) throw new Error('Not authenticated');
    setIsSubmitting(true);
    try {
      await updateBOQItem(orgId, projectId, itemId, userId, updates);
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, userId, projectId]);
  
  const remove = useCallback(async (itemId: string) => {
    setIsSubmitting(true);
    try {
      await deleteBOQItem(orgId, projectId, itemId);
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, projectId]);
  
  return { create, update, remove, isSubmitting };
}
