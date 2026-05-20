/**
 * MatFlow Composite Hooks
 * Re-exports and combines hooks for use in MatFlow pages
 */

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/core/hooks/useAuth';
import type { BOQItem } from '../types';

// Re-export with alternative names for convenience
export { useProject as useMatFlowProject } from './useProjects';
export { useProjects as useMatFlowProjects } from './useProjects';
export { useProjectMutations } from './useProjects';

// Default organization ID
const DEFAULT_ORG_ID = 'default';

// Delivery type for this hook
interface DeliveryRecord {
  id: string;
  description?: string;
  supplierName?: string;
  deliveryDate?: Date | string;
  totalAmount?: number;
  invoiceNumber?: string;
  efrisValidated?: boolean;
}

/**
 * Hook to get BOQ items for a project
 */
export function useProjectBOQItems(projectId: string) {
  const { user } = useAuth();
  const [items, setItems] = useState<BOQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  
  useEffect(() => {
    if (!user || !projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    
    // Subscribe to BOQ items from Firestore
    const boqItemsRef = collection(
      db,
      'organizations',
      orgId,
      'matflow_projects',
      projectId,
      'boq_items'
    );
    
    const q = query(boqItemsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const boqItems = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as BOQItem[];
        setItems(boqItems);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load BOQ items:', err);
        setError(err);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [user, projectId, orgId]);
  
  return { items, loading, error };
}

/**
 * Hook to get deliveries for a project
 */
export function useProjectDeliveries(projectId: string) {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);
  
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  
  useEffect(() => {
    if (!user || !projectId) {
      setDeliveries([]);
      setLoading(false);
      return;
    }
    
    // For now, return empty array - will be populated from Firestore subscription
    setLoading(false);
    setDeliveries([]);
  }, [user, projectId, orgId]);
  
  return { deliveries, loading, error };
}

/**
 * Hook to get project statistics
 */
export function useProjectStats(projectId: string) {
  const { items } = useProjectBOQItems(projectId);
  const { deliveries } = useProjectDeliveries(projectId);
  
  const totalBOQValue = items.reduce((sum, item) => sum + ((item as { totalPrice?: number }).totalPrice || 0), 0);
  const totalDeliveredValue = deliveries.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
  const variance = totalDeliveredValue - totalBOQValue;
  const variancePercent = totalBOQValue > 0 ? (variance / totalBOQValue) * 100 : 0;
  
  return {
    boqItemCount: items.length,
    deliveryCount: deliveries.length,
    totalBOQValue,
    totalDeliveredValue,
    variance,
    variancePercent,
  };
}
