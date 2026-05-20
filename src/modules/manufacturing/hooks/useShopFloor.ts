/**
 * Hook for shop floor view with real-time order and workstation data
 */

import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ManufacturingOrderMES,
  ManufacturingOrder,
  MOStatus,
  Workstation,
} from '../types';
import type { MOProjectSalesOrderGroup } from '../utils/moGrouping';
import { groupManufacturingOrdersByProjectSalesOrder } from '../utils/moGrouping';

type ViewMode = 'kanban' | 'workstation';

interface ShopFloorFilters {
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status?: MOStatus[];
  workstationId?: string;
  search?: string;
}

interface UseShopFloorResult {
  orders: ManufacturingOrderMES[];
  workstations: Workstation[];
  isLoading: boolean;
  error: string | null;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeFilters: ShopFloorFilters;
  setFilters: (filters: ShopFloorFilters) => void;
  ordersByStatus: Record<string, ManufacturingOrderMES[]>;
  ordersByWorkstation: Record<string, ManufacturingOrderMES[]>;
  groupedByStatus: Record<string, MOProjectSalesOrderGroup<ManufacturingOrderMES>[]>;
  groupedByWorkstation: Record<string, MOProjectSalesOrderGroup<ManufacturingOrderMES>[]>;
}

const MO_COLLECTION = 'manufacturingOrders';
const WORKSTATION_COLLECTION = 'workstations';

export function useShopFloor(
  subsidiaryId: string,
  organizationId: string,
): UseShopFloorResult {
  const [orders, setOrders] = useState<ManufacturingOrderMES[]>([]);
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [activeFilters, setFilters] = useState<ShopFloorFilters>({});

  // Subscribe to active manufacturing orders
  useEffect(() => {
    if (!subsidiaryId) return;

    setIsLoading(true);
    setError(null);

    const moQuery = query(
      collection(db, MO_COLLECTION),
      where('subsidiaryId', '==', subsidiaryId),
      where('status', 'in', [
        'draft', 'pending-approval', 'approved', 'in-progress', 'on-hold', 'completed',
      ]),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribeMOs = onSnapshot(
      moQuery,
      (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          // Ensure MES fields have defaults
          mesStatus: d.data().mesStatus ?? mapLegacyStatus(d.data().status),
          totalSteps: d.data().totalSteps ?? 0,
          completedSteps: d.data().completedSteps ?? 0,
          currentStepIndex: d.data().currentStepIndex ?? 0,
          defectCount: d.data().defectCount ?? 0,
          reworkOrderIds: d.data().reworkOrderIds ?? [],
          estimatedLaborHours: d.data().estimatedLaborHours ?? 0,
          actualLaborHours: d.data().actualLaborHours ?? 0,
          estimatedMaterialCost: d.data().estimatedMaterialCost ?? 0,
          actualMaterialCost: d.data().actualMaterialCost ?? 0,
          estimatedTotalCost: d.data().estimatedTotalCost ?? 0,
          actualTotalCost: d.data().actualTotalCost ?? 0,
          bomLineCount: d.data().bomLineCount ?? 0,
          bomTotalMaterialCost: d.data().bomTotalMaterialCost ?? 0,
        }) as ManufacturingOrderMES);
        setOrders(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Shop floor orders subscription error:', err);
        setError(err.message);
        setIsLoading(false);
      },
    );

    // Subscribe to workstations
    const wsQuery = query(
      collection(db, WORKSTATION_COLLECTION),
      where('organizationId', '==', organizationId),
      where('subsidiaryId', '==', subsidiaryId),
      where('isActive', '==', true),
      orderBy('name', 'asc'),
    );

    const unsubscribeWS = onSnapshot(wsQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Workstation);
      setWorkstations(data);
    });

    return () => {
      unsubscribeMOs();
      unsubscribeWS();
    };
  }, [subsidiaryId, organizationId]);

  // Filter orders based on active filters
  const filteredOrders = useMemo(() => {
    let result = orders;

    if (activeFilters.priority) {
      result = result.filter(o => o.priority === activeFilters.priority);
    }

    if (activeFilters.status && activeFilters.status.length > 0) {
      result = result.filter(o => activeFilters.status!.includes(o.mesStatus));
    }

    if (activeFilters.workstationId) {
      result = result.filter(o => o.currentWorkstationId === activeFilters.workstationId);
    }

    if (activeFilters.search) {
      const search = activeFilters.search.toLowerCase();
      result = result.filter(o =>
        o.moNumber.toLowerCase().includes(search) ||
        (o.designItemName ?? o.itemName ?? '').toLowerCase().includes(search) ||
        (o.customerName?.toLowerCase().includes(search) ?? false),
      );
    }

    return result;
  }, [orders, activeFilters]);

  // Group orders by MES status
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, ManufacturingOrderMES[]> = {
      draft: [],
      planned: [],
      ready: [],
      in_progress: [],
      on_hold: [],
      quality_review: [],
      completed: [],
    };

    for (const order of filteredOrders) {
      const status = order.mesStatus ?? mapLegacyStatus(order.status);
      if (groups[status]) {
        groups[status].push(order);
      }
    }

    return groups;
  }, [filteredOrders]);

  // Group orders by current workstation
  const ordersByWorkstation = useMemo(() => {
    const groups: Record<string, ManufacturingOrderMES[]> = {
      unassigned: [],
    };

    for (const ws of workstations) {
      groups[ws.id] = [];
    }

    for (const order of filteredOrders) {
      if (order.currentWorkstationId && groups[order.currentWorkstationId]) {
        groups[order.currentWorkstationId].push(order);
      } else {
        groups.unassigned.push(order);
      }
    }

    return groups;
  }, [filteredOrders, workstations]);

  const groupedByStatus = useMemo(() => {
    const groups: Record<string, MOProjectSalesOrderGroup<ManufacturingOrderMES>[]> = {};
    for (const [status, statusOrders] of Object.entries(ordersByStatus)) {
      groups[status] = groupManufacturingOrdersByProjectSalesOrder(statusOrders);
    }
    return groups;
  }, [ordersByStatus]);

  const groupedByWorkstation = useMemo(() => {
    const groups: Record<string, MOProjectSalesOrderGroup<ManufacturingOrderMES>[]> = {};
    for (const [workstationId, workstationOrders] of Object.entries(ordersByWorkstation)) {
      groups[workstationId] = groupManufacturingOrdersByProjectSalesOrder(workstationOrders);
    }
    return groups;
  }, [ordersByWorkstation]);

  return {
    orders: filteredOrders,
    workstations,
    isLoading,
    error,
    viewMode,
    setViewMode,
    activeFilters,
    setFilters,
    ordersByStatus,
    ordersByWorkstation,
    groupedByStatus,
    groupedByWorkstation,
  };
}

/**
 * Map legacy ManufacturingOrderStatus to MOStatus
 */
function mapLegacyStatus(status: ManufacturingOrder['status']): MOStatus {
  switch (status) {
    case 'draft': return 'draft';
    case 'pending-approval': return 'planned';
    case 'approved': return 'ready';
    case 'in-progress': return 'in_progress';
    case 'on-hold': return 'on_hold';
    case 'completed': return 'completed';
    case 'cancelled': return 'cancelled';
    default: return 'draft';
  }
}
