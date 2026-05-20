/**
 * Integration Hooks
 * 
 * React hooks for cross-module integration functionality.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onSnapshot, doc, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  LinkableEntityType,
  DealConversion,
  CapitalDeployment,
  InitiateDealConversionInput,
  CreateCapitalDeploymentInput,
} from '../types/integration';
import type {
  CoInvestor,
  CreateCoInvestorInput,
  CreateCoInvestmentOpportunityInput,
} from '../types/co-investment';
import type {
  UnifiedAssetView,
  CrossModuleDashboard,
  AggregationGroupBy,
} from '../types/asset-view';
import {
  createCrossModuleLink,
  getLinksForEntity,
  deleteCrossModuleLink,
  initiateDealConversion,
  getConversionsForDeal,
  approveICForConversion,
  approvePortfolioForConversion,
  executeConversion,
  cancelConversion,
  createCapitalDeployment,
  updateDeploymentStatus,
  getPortfolioDealAllocations,
  getDealAllocations,
  getProjectHoldingLinks,
  getHoldingProjectLinks,
  createCoInvestor,
  getCoInvestor,
  getActiveCoInvestors,
  updateCoInvestor,
  createCoInvestmentOpportunity,
  getCoInvestmentOpportunity,
  getOpportunitiesForDeal,
  getActiveOpportunities,
  buildUnifiedAssetView,
  getAssetAggregation,
  buildCrossModuleDashboard,
} from '../services/integration-service';

// Query keys
export const integrationKeys = {
  all: ['integration'] as const,
  links: () => [...integrationKeys.all, 'links'] as const,
  linksForEntity: (type: string, id: string) => [...integrationKeys.links(), type, id] as const,
  conversions: () => [...integrationKeys.all, 'conversions'] as const,
  conversion: (id: string) => [...integrationKeys.conversions(), id] as const,
  conversionsForDeal: (dealId: string) => [...integrationKeys.conversions(), 'deal', dealId] as const,
  pendingConversions: (portfolioId?: string) => [...integrationKeys.conversions(), 'pending', portfolioId] as const,
  deployments: () => [...integrationKeys.all, 'deployments'] as const,
  deploymentsForHolding: (holdingId: string) => [...integrationKeys.deployments(), 'holding', holdingId] as const,
  deploymentsForProject: (projectId: string) => [...integrationKeys.deployments(), 'project', projectId] as const,
  allocations: () => [...integrationKeys.all, 'allocations'] as const,
  allocationsForPortfolio: (portfolioId: string) => [...integrationKeys.allocations(), 'portfolio', portfolioId] as const,
  allocationsForDeal: (dealId: string) => [...integrationKeys.allocations(), 'deal', dealId] as const,
  projectLinks: () => [...integrationKeys.all, 'projectLinks'] as const,
  coInvestors: () => [...integrationKeys.all, 'coInvestors'] as const,
  coInvestor: (id: string) => [...integrationKeys.coInvestors(), id] as const,
  opportunities: () => [...integrationKeys.all, 'opportunities'] as const,
  opportunity: (id: string) => [...integrationKeys.opportunities(), id] as const,
  assetViews: () => [...integrationKeys.all, 'assetViews'] as const,
  assetView: (projectId: string) => [...integrationKeys.assetViews(), projectId] as const,
  assetAggregation: (groupBy: string, value: string) => [...integrationKeys.assetViews(), 'aggregation', groupBy, value] as const,
  dashboard: () => [...integrationKeys.all, 'dashboard'] as const,
};

// ============================================================================
// CROSS-MODULE LINKS
// ============================================================================

export function useCrossModuleLinks(
  entityType: LinkableEntityType | undefined,
  entityId: string | undefined,
  direction: 'source' | 'target' | 'both' = 'both'
) {
  return useQuery({
    queryKey: integrationKeys.linksForEntity(entityType!, entityId!),
    queryFn: () => getLinksForEntity(entityType!, entityId!, direction),
    enabled: !!entityType && !!entityId,
  });
}

export function useCreateCrossModuleLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      sourceType, sourceId, sourceModule,
      targetType, targetId, targetModule,
      linkType, relationship, createdBy, context
    }: Parameters<typeof createCrossModuleLink> extends [...infer P] ? {
      sourceType: P[0]; sourceId: P[1]; sourceModule: P[2];
      targetType: P[3]; targetId: P[4]; targetModule: P[5];
      linkType: P[6]; relationship: P[7]; createdBy: P[8]; context?: P[9];
    } : never) => createCrossModuleLink(
      sourceType, sourceId, sourceModule,
      targetType, targetId, targetModule,
      linkType, relationship, createdBy, context
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.links() });
    },
  });
}

export function useDeleteCrossModuleLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (linkId: string) => deleteCrossModuleLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.links() });
    },
  });
}

// ============================================================================
// DEAL CONVERSION
// ============================================================================

export function useDealConversion(conversionId: string | undefined) {
  const [conversion, setConversion] = useState<DealConversion | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!conversionId) {
      setConversion(null);
      setLoading(false);
      return;
    }
    
    const unsubscribe = onSnapshot(
      doc(db, 'advisoryPlatform/advisory/dealConversions', conversionId),
      (snap) => {
        setConversion(snap.exists() ? (snap.data() as DealConversion) : null);
        setLoading(false);
      }
    );
    
    return unsubscribe;
  }, [conversionId]);
  
  return { data: conversion, isLoading: loading };
}

export function useDealConversions(dealId: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.conversionsForDeal(dealId!),
    queryFn: () => getConversionsForDeal(dealId!),
    enabled: !!dealId,
  });
}

export function usePendingConversions(portfolioId?: string) {
  const [conversions, setConversions] = useState<DealConversion[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const q = query(
      collection(db, 'advisoryPlatform/advisory/dealConversions'),
      where('status', 'in', ['pending_approval', 'partially_approved']),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      let results = snap.docs.map(d => d.data() as DealConversion);
      
      if (portfolioId) {
        results = results.filter(c =>
          c.targetPortfolios.some(tp => tp.portfolioId === portfolioId)
        );
      }
      
      setConversions(results);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [portfolioId]);
  
  return { data: conversions, isLoading: loading };
}

export function useInitiateDealConversion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ input, createdBy }: { input: InitiateDealConversionInput; createdBy: string }) =>
      initiateDealConversion(input, createdBy),
    onSuccess: (conversion) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.conversions() });
      queryClient.invalidateQueries({ queryKey: integrationKeys.conversionsForDeal(conversion.dealId) });
    },
  });
}

export function useDealConversionWorkflow(conversionId: string | undefined) {
  const { data: conversion, isLoading } = useDealConversion(conversionId);
  const queryClient = useQueryClient();
  
  const approveIC = useMutation({
    mutationFn: ({ approvedBy, notes }: { approvedBy: string; notes?: string }) =>
      approveICForConversion(conversionId!, approvedBy, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.conversion(conversionId!) });
    },
  });
  
  const approvePortfolio = useMutation({
    mutationFn: ({ portfolioId, approvedBy, notes }: { portfolioId: string; approvedBy: string; notes?: string }) =>
      approvePortfolioForConversion(conversionId!, portfolioId, approvedBy, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.conversion(conversionId!) });
    },
  });
  
  const execute = useMutation({
    mutationFn: (executedBy: string) => executeConversion(conversionId!, executedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.conversions() });
    },
  });
  
  const cancel = useMutation({
    mutationFn: (cancelledBy: string) => cancelConversion(conversionId!, cancelledBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.conversions() });
    },
  });
  
  return {
    conversion,
    isLoading,
    approveIC: approveIC.mutate,
    approvePortfolio: approvePortfolio.mutate,
    execute: execute.mutate,
    cancel: cancel.mutate,
    isProcessing: approveIC.isPending || approvePortfolio.isPending || execute.isPending || cancel.isPending,
  };
}

export function useConversionStatus(conversion: DealConversion | null) {
  return useMemo(() => {
    if (!conversion) return null;
    
    return {
      isPending: conversion.status === 'pending_approval',
      isPartiallyApproved: conversion.status === 'partially_approved',
      isFullyApproved: conversion.status === 'fully_approved',
      isConverting: conversion.status === 'converting',
      isCompleted: conversion.status === 'completed',
      isCancelled: conversion.status === 'cancelled',
      
      icApproved: conversion.approval.icApproved,
      allPortfoliosApproved: conversion.approval.portfolioApprovals.every(pa => pa.approved),
      approvedPortfolioCount: conversion.approval.portfolioApprovals.filter(pa => pa.approved).length,
      totalPortfolioCount: conversion.approval.portfolioApprovals.length,
      
      pendingActions: {
        icApproval: !conversion.approval.icApproved,
        portfolioApprovals: conversion.approval.portfolioApprovals
          .filter(pa => !pa.approved)
          .map(pa => pa.portfolioId),
      },
      
      createdHoldings: conversion.createdHoldings,
    };
  }, [conversion]);
}

// ============================================================================
// CAPITAL DEPLOYMENT
// ============================================================================

export function useHoldingDeployments(holdingId: string | undefined) {
  const [deployments, setDeployments] = useState<CapitalDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!holdingId) {
      setDeployments([]);
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'advisoryPlatform/advisory/capitalDeployments'),
      where('holdingId', '==', holdingId),
      orderBy('deploymentDate', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setDeployments(snap.docs.map(d => d.data() as CapitalDeployment));
      setLoading(false);
    });
    
    return unsubscribe;
  }, [holdingId]);
  
  const totals = useMemo(() => {
    const planned = deployments.filter(d => d.status === 'planned').reduce((sum, d) => sum + d.amount.amount, 0);
    const committed = deployments.filter(d => d.status === 'committed').reduce((sum, d) => sum + d.amount.amount, 0);
    const disbursed = deployments.filter(d => d.status === 'disbursed').reduce((sum, d) => sum + d.amount.amount, 0);
    
    return { planned, committed, disbursed, total: planned + committed + disbursed };
  }, [deployments]);
  
  return { data: deployments, totals, isLoading: loading };
}

export function useProjectDeployments(projectId: string | undefined) {
  const [deployments, setDeployments] = useState<CapitalDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!projectId) {
      setDeployments([]);
      setLoading(false);
      return;
    }
    
    const q = query(
      collection(db, 'advisoryPlatform/advisory/capitalDeployments'),
      where('projectId', '==', projectId),
      orderBy('deploymentDate', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snap) => {
      setDeployments(snap.docs.map(d => d.data() as CapitalDeployment));
      setLoading(false);
    });
    
    return unsubscribe;
  }, [projectId]);
  
  return { data: deployments, isLoading: loading };
}

export function useCreateDeployment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ input, createdBy }: { input: CreateCapitalDeploymentInput; createdBy: string }) =>
      createCapitalDeployment(input, createdBy),
    onSuccess: (deployment) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.deploymentsForHolding(deployment.holdingId) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.deploymentsForProject(deployment.projectId) });
    },
  });
}

export function useUpdateDeploymentStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ deploymentId, status, updatedBy, disbursementRef }: {
      deploymentId: string;
      status: CapitalDeployment['status'];
      updatedBy: string;
      disbursementRef?: string;
    }) => updateDeploymentStatus(deploymentId, status, updatedBy, disbursementRef),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.deployments() });
    },
  });
}

// ============================================================================
// PORTFOLIO-DEAL ALLOCATIONS
// ============================================================================

export function usePortfolioDealAllocations(portfolioId: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.allocationsForPortfolio(portfolioId!),
    queryFn: () => getPortfolioDealAllocations(portfolioId!),
    enabled: !!portfolioId,
  });
}

export function useDealAllocations(dealId: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.allocationsForDeal(dealId!),
    queryFn: () => getDealAllocations(dealId!),
    enabled: !!dealId,
  });
}

// ============================================================================
// PROJECT-HOLDING LINKS
// ============================================================================

export function useProjectHoldingLinks(projectId: string | undefined) {
  return useQuery({
    queryKey: [...integrationKeys.projectLinks(), 'project', projectId],
    queryFn: () => getProjectHoldingLinks(projectId!),
    enabled: !!projectId,
  });
}

export function useHoldingProjectLinks(holdingId: string | undefined) {
  return useQuery({
    queryKey: [...integrationKeys.projectLinks(), 'holding', holdingId],
    queryFn: () => getHoldingProjectLinks(holdingId!),
    enabled: !!holdingId,
  });
}

// ============================================================================
// CO-INVESTORS
// ============================================================================

export function useCoInvestor(coInvestorId: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.coInvestor(coInvestorId!),
    queryFn: () => getCoInvestor(coInvestorId!),
    enabled: !!coInvestorId,
  });
}

export function useActiveCoInvestors() {
  return useQuery({
    queryKey: integrationKeys.coInvestors(),
    queryFn: () => getActiveCoInvestors(),
  });
}

export function useCreateCoInvestor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ input, createdBy }: { input: CreateCoInvestorInput; createdBy: string }) =>
      createCoInvestor(input, createdBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.coInvestors() });
    },
  });
}

export function useUpdateCoInvestor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ coInvestorId, updates, updatedBy }: {
      coInvestorId: string;
      updates: Partial<CoInvestor>;
      updatedBy: string;
    }) => updateCoInvestor(coInvestorId, updates, updatedBy),
    onSuccess: (_, { coInvestorId }) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.coInvestor(coInvestorId) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.coInvestors() });
    },
  });
}

// ============================================================================
// CO-INVESTMENT OPPORTUNITIES
// ============================================================================

export function useCoInvestmentOpportunity(opportunityId: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.opportunity(opportunityId!),
    queryFn: () => getCoInvestmentOpportunity(opportunityId!),
    enabled: !!opportunityId,
  });
}

export function useOpportunitiesForDeal(dealId: string | undefined) {
  return useQuery({
    queryKey: [...integrationKeys.opportunities(), 'deal', dealId],
    queryFn: () => getOpportunitiesForDeal(dealId!),
    enabled: !!dealId,
  });
}

export function useActiveOpportunities() {
  return useQuery({
    queryKey: [...integrationKeys.opportunities(), 'active'],
    queryFn: () => getActiveOpportunities(),
  });
}

export function useCreateCoInvestmentOpportunity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ input, createdBy }: { input: CreateCoInvestmentOpportunityInput; createdBy: string }) =>
      createCoInvestmentOpportunity(input, createdBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.opportunities() });
    },
  });
}

// ============================================================================
// UNIFIED ASSET VIEW
// ============================================================================

export function useUnifiedAssetView(projectId: string | undefined) {
  const [assetView, setAssetView] = useState<UnifiedAssetView | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!projectId) {
      setAssetView(null);
      setLoading(false);
      return;
    }
    
    const unsubscribe = onSnapshot(
      doc(db, 'advisoryPlatform/advisory/unifiedAssetViews', `asset_${projectId}`),
      (snap) => {
        setAssetView(snap.exists() ? (snap.data() as UnifiedAssetView) : null);
        setLoading(false);
      }
    );
    
    return unsubscribe;
  }, [projectId]);
  
  return { data: assetView, isLoading: loading };
}

export function useBuildAssetView() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ projectId, createdBy }: { projectId: string; createdBy: string }) =>
      buildUnifiedAssetView(projectId, createdBy),
    onSuccess: (assetView) => {
      queryClient.setQueryData(integrationKeys.assetView(assetView.linkedEntities.projectIds[0]), assetView);
    },
  });
}

export function useAssetAggregation(
  groupBy: AggregationGroupBy,
  groupValue: string | undefined
) {
  return useQuery({
    queryKey: integrationKeys.assetAggregation(groupBy, groupValue!),
    queryFn: () => getAssetAggregation(groupBy, groupValue!),
    enabled: !!groupValue,
  });
}

// ============================================================================
// CROSS-MODULE DASHBOARD
// ============================================================================

export function useCrossModuleDashboard() {
  const [dashboard, setDashboard] = useState<CrossModuleDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await buildCrossModuleDashboard();
        setDashboard(data);
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboard();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadDashboard, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return { data: dashboard, isLoading: loading };
}

// ============================================================================
// DERIVED HOOKS
// ============================================================================

export function useEntityLinks(
  entityType: LinkableEntityType | undefined,
  entityId: string | undefined
) {
  const { data: links, isLoading } = useCrossModuleLinks(entityType, entityId);
  
  return useMemo(() => {
    if (!links) return { linkedEntities: null, isLoading };
    
    const portfolioIds = links
      .filter(l => l.sourceType === 'portfolio' || l.targetType === 'portfolio')
      .map(l => l.sourceType === 'portfolio' ? l.sourceId : l.targetId);
    
    const holdingIds = links
      .filter(l => l.sourceType === 'holding' || l.targetType === 'holding')
      .map(l => l.sourceType === 'holding' ? l.sourceId : l.targetId);
    
    const dealIds = links
      .filter(l => l.sourceType === 'deal' || l.targetType === 'deal')
      .map(l => l.sourceType === 'deal' ? l.sourceId : l.targetId);
    
    const projectIds = links
      .filter(l => l.sourceType === 'project' || l.targetType === 'project')
      .map(l => l.sourceType === 'project' ? l.sourceId : l.targetId);
    
    return {
      linkedEntities: {
        portfolioIds: [...new Set(portfolioIds)],
        holdingIds: [...new Set(holdingIds)],
        dealIds: [...new Set(dealIds)],
        projectIds: [...new Set(projectIds)],
      },
      isLoading,
    };
  }, [links, isLoading]);
}

export function useDeploymentSummary(holdingId: string | undefined) {
  const { data: deployments, totals, isLoading } = useHoldingDeployments(holdingId);
  
  return useMemo(() => {
    if (!deployments) return { summary: null, isLoading };
    
    return {
      summary: {
        totalDeployments: deployments.length,
        ...totals,
        byType: deployments.reduce((acc, d) => {
          acc[d.deploymentType] = (acc[d.deploymentType] || 0) + d.amount.amount;
          return acc;
        }, {} as Record<string, number>),
        byStatus: {
          planned: deployments.filter(d => d.status === 'planned').length,
          committed: deployments.filter(d => d.status === 'committed').length,
          disbursed: deployments.filter(d => d.status === 'disbursed').length,
          cancelled: deployments.filter(d => d.status === 'cancelled').length,
        },
      },
      isLoading,
    };
  }, [deployments, totals, isLoading]);
}
