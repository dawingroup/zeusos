/**
 * Client Hooks - React Query hooks for client management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  createClient,
  getClient,
  updateClient,
  getClients,
  updateClientStatus,
  updateKYCStatus,
  updateAMLStatus,
  raiseComplianceIssue,
  createMandate,
  getMandate,
  getClientMandates,
  updateMandateStatus,
  createRiskAssessment,
  getRiskAssessmentHistory,
  addClientContact,
  updateClientContact,
  removeClientContact,
  subscribeToClient,
  subscribeToClients
} from '../services/client-service';
import type {
  AdvisoryClient,
  ClientSummary,
  ClientStatus,
  ClientTier,
  KYCStatus,
  AMLStatus,
  ComplianceIssue,
  ClientContact
} from '../types';
import type { InvestmentMandate, MandateStatus } from '../types';
import type { RiskAssessment } from '../types';

// ==================== Query Keys ====================

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...clientKeys.lists(), filters] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  mandates: (clientId: string) => [...clientKeys.detail(clientId), 'mandates'] as const,
  mandate: (mandateId: string) => ['mandates', mandateId] as const,
  riskHistory: (clientId: string) => [...clientKeys.detail(clientId), 'riskHistory'] as const
};

// ==================== Client Queries ====================

export function useClient(clientId: string) {
  return useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: () => getClient(clientId),
    enabled: !!clientId
  });
}

export function useClients(options: {
  engagementId?: string;
  status?: ClientStatus[];
  tier?: ClientTier[];
  relationshipManagerId?: string;
  searchTerm?: string;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: clientKeys.list(options),
    queryFn: () => getClients(options)
  });
}

// Real-time subscription hook
export function useClientSubscription(clientId: string) {
  const [client, setClient] = useState<AdvisoryClient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;

    setLoading(true);
    const unsubscribe = subscribeToClient(clientId, (data) => {
      setClient(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clientId]);

  return { client, loading };
}

export function useClientsSubscription(options: {
  engagementId?: string;
  status?: ClientStatus[];
  relationshipManagerId?: string;
} = {}) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToClients(options, (data) => {
      setClients(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [options.engagementId, options.status?.join(','), options.relationshipManagerId]);

  return { clients, loading };
}

// ==================== Client Mutations ====================

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<AdvisoryClient, 'id' | 'createdAt' | 'updatedAt'>) => 
      createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    }
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, updates }: { clientId: string; updates: Partial<AdvisoryClient> }) =>
      updateClient(clientId, updates),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    }
  });
}

export function useUpdateClientStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, status, reason }: { clientId: string; status: ClientStatus; reason?: string }) =>
      updateClientStatus(clientId, status, reason),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    }
  });
}

// ==================== Compliance Mutations ====================

export function useUpdateKYCStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, kycUpdate }: { clientId: string; kycUpdate: Partial<KYCStatus> }) =>
      updateKYCStatus(clientId, kycUpdate),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    }
  });
}

export function useUpdateAMLStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, amlUpdate }: { clientId: string; amlUpdate: Partial<AMLStatus> }) =>
      updateAMLStatus(clientId, amlUpdate),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    }
  });
}

export function useRaiseComplianceIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, issue }: { clientId: string; issue: Omit<ComplianceIssue, 'id' | 'raisedAt'> }) =>
      raiseComplianceIssue(clientId, issue),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    }
  });
}

// ==================== Mandate Queries & Mutations ====================

export function useMandate(mandateId: string) {
  return useQuery({
    queryKey: clientKeys.mandate(mandateId),
    queryFn: () => getMandate(mandateId),
    enabled: !!mandateId
  });
}

export function useClientMandates(clientId: string, status?: MandateStatus[]) {
  return useQuery({
    queryKey: clientKeys.mandates(clientId),
    queryFn: () => getClientMandates(clientId, status),
    enabled: !!clientId
  });
}

export function useCreateMandate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<InvestmentMandate, 'id' | 'createdAt' | 'updatedAt'>) =>
      createMandate(data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.mandates(data.clientId) });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(data.clientId) });
    }
  });
}

export function useUpdateMandateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mandateId, status, approvedBy }: { mandateId: string; status: MandateStatus; approvedBy?: string }) =>
      updateMandateStatus(mandateId, status, approvedBy),
    onSuccess: (_, { mandateId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.mandate(mandateId) });
    }
  });
}

// ==================== Risk Assessment ====================

export function useRiskAssessmentHistory(clientId: string) {
  return useQuery({
    queryKey: clientKeys.riskHistory(clientId),
    queryFn: () => getRiskAssessmentHistory(clientId),
    enabled: !!clientId
  });
}

export function useCreateRiskAssessment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, assessment }: { clientId: string; assessment: Omit<RiskAssessment, 'assessmentId'> }) =>
      createRiskAssessment(clientId, assessment),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.riskHistory(clientId) });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    }
  });
}

// ==================== Contact Management ====================

export function useAddClientContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, contact }: { clientId: string; contact: Omit<ClientContact, 'id' | 'createdAt'> }) =>
      addClientContact(clientId, contact),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    }
  });
}

export function useUpdateClientContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, contactId, updates }: { clientId: string; contactId: string; updates: Partial<ClientContact> }) =>
      updateClientContact(clientId, contactId, updates),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    }
  });
}

export function useRemoveClientContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, contactId }: { clientId: string; contactId: string }) =>
      removeClientContact(clientId, contactId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    }
  });
}

// ==================== Derived/Computed Hooks ====================

export function useClientComplianceStatus(clientId: string) {
  const { data: client } = useClient(clientId);

  if (!client) return null;

  const { compliance } = client;
  
  return {
    overall: compliance.status,
    kyc: compliance.kyc.status,
    aml: compliance.aml.status,
    hasIssues: (compliance.issues?.length || 0) > 0,
    criticalIssues: compliance.issues?.filter(i => i.severity === 'critical' && i.status === 'open').length || 0,
    isFullyCompliant: compliance.status === 'compliant' && 
                       compliance.kyc.status === 'approved' && 
                       compliance.aml.status === 'cleared',
    nextReviewDate: compliance.nextReviewDate,
    daysToReview: compliance.nextReviewDate 
      ? Math.ceil((compliance.nextReviewDate.toMillis() - Date.now()) / (1000 * 60 * 60 * 24))
      : null
  };
}

export function useClientInvestmentSummary(clientId: string) {
  const { data: client } = useClient(clientId);
  const { data: mandates } = useClientMandates(clientId, ['active']);

  if (!client) return null;

  const activeMandates = mandates?.filter(m => m.status === 'active') || [];
  const totalCommitment = activeMandates.reduce((sum, m) => sum + m.commitmentAmount.amount, 0);
  const totalDeployed = activeMandates.reduce((sum, m) => sum + m.deployedAmount.amount, 0);
  const deploymentRate = totalCommitment > 0 ? (totalDeployed / totalCommitment) * 100 : 0;

  return {
    totalCommitments: client.totalCommitments,
    totalDeployed: client.totalDeployed,
    unrealizedValue: client.unrealizedValue,
    realizedValue: client.realizedValue,
    deploymentRate,
    activePortfolios: client.portfolioIds.length,
    activeHoldings: client.holdingIds.length,
    activeMandates: activeMandates.length
  };
}

export function useClientSuitability(clientId: string, productType: string) {
  const { data: client } = useClient(clientId);

  if (!client?.riskProfile?.suitabilityAssessment) return null;

  const productSuitability = client.riskProfile.suitabilityAssessment.productSuitability
    .find(p => p.productType === productType);

  return {
    isSuitable: productSuitability?.suitability === 'suitable',
    suitability: productSuitability?.suitability || 'not_assessed',
    reasons: productSuitability?.reasons || [],
    conditions: productSuitability?.conditions || [],
    warnings: client.riskProfile.suitabilityAssessment.warnings
      .filter(w => w.severity === 'high')
  };
}
