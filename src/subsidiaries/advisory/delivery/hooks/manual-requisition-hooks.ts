/**
 * MANUAL REQUISITION HOOKS
 *
 * React hooks for manual requisition management.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import {
  ManualRequisition,
  ManualRequisitionFormData,
  ManualAccountabilityEntry,
  ManualRequisitionStatus,
  LinkToProjectData,
  LinkToRequisitionData,
  AcknowledgementFormData,
  ActivityReportFormData,
} from '../types/manual-requisition';
import { FundsAcknowledgementDocument } from '../types/funds-acknowledgement';
import { AccountabilityStatus } from '../types/requisition';
import { getManualRequisitionService } from '../services/manual-requisition-service';

// ─────────────────────────────────────────────────────────────────
// HOOK: useManualRequisitions
// ─────────────────────────────────────────────────────────────────

export function useManualRequisitions(options?: {
  linkStatus?: ManualRequisitionStatus;
  accountabilityStatus?: AccountabilityStatus;
  linkedProjectId?: string;
}) {
  const [requisitions, setRequisitions] = useState<ManualRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const fetchRequisitions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await service.getAllManualRequisitions(options);
      setRequisitions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch manual requisitions'));
    } finally {
      setLoading(false);
    }
  }, [options?.linkStatus, options?.accountabilityStatus, options?.linkedProjectId]);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  return {
    requisitions,
    loading,
    error,
    refresh: fetchRequisitions,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useManualRequisition
// ─────────────────────────────────────────────────────────────────

export function useManualRequisition(id: string | null) {
  const [requisition, setRequisition] = useState<ManualRequisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const fetchRequisition = useCallback(async () => {
    if (!id) {
      setRequisition(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await service.getManualRequisition(id);
      setRequisition(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch manual requisition'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequisition();
  }, [fetchRequisition]);

  return {
    requisition,
    loading,
    error,
    refresh: fetchRequisition,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCreateManualRequisition
// ─────────────────────────────────────────────────────────────────

export function useCreateManualRequisition() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const createRequisition = useCallback(async (
    data: ManualRequisitionFormData
  ): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const id = await service.createManualRequisition(
        data,
        user.uid,
        user.displayName || undefined
      );
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create manual requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    createRequisition,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useUpdateManualRequisition
// ─────────────────────────────────────────────────────────────────

export function useUpdateManualRequisition() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const updateRequisition = useCallback(async (
    id: string,
    data: Partial<ManualRequisitionFormData>
  ): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await service.updateManualRequisition(id, data, user.uid);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update manual requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addAccountability = useCallback(async (
    id: string,
    accountability: Omit<ManualAccountabilityEntry, 'id'>
  ): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await service.addAccountability(id, accountability, user.uid);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add accountability');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    updateRequisition,
    addAccountability,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useLinkManualRequisition
// ─────────────────────────────────────────────────────────────────

export function useLinkManualRequisition() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const linkToProject = useCallback(async (
    id: string,
    data: LinkToProjectData
  ): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await service.linkToProject(id, data, user.uid);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to link to project');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const linkToRequisition = useCallback(async (
    id: string,
    data: LinkToRequisitionData
  ): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await service.linkToRequisition(id, data, user.uid);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to link to requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const unlinkFromProject = useCallback(async (id: string): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await service.unlinkFromProject(id, user.uid);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to unlink from project');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    linkToProject,
    linkToRequisition,
    unlinkFromProject,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useDeleteManualRequisition
// ─────────────────────────────────────────────────────────────────

export function useDeleteManualRequisition() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const deleteRequisition = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await service.deleteManualRequisition(id);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete manual requisition');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    deleteRequisition,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useSaveAcknowledgement
// ─────────────────────────────────────────────────────────────────

export function useSaveAcknowledgement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const saveAcknowledgement = useCallback(async (
    requisitionId: string,
    data: AcknowledgementFormData
  ): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await service.saveAcknowledgement(requisitionId, data, user.uid);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save acknowledgement');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    saveAcknowledgement,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useManualRequisitionSummary
// ─────────────────────────────────────────────────────────────────

export function useManualRequisitionSummary() {
  const [summary, setSummary] = useState<{
    total: number;
    unlinked: number;
    linked: number;
    reconciled: number;
    totalAmount: number;
    totalAccountedAmount: number;
    totalUnaccountedAmount: number;
    overdueCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await service.getBacklogSummary();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch summary'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refresh: fetchSummary,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useSaveActivityReport
// ─────────────────────────────────────────────────────────────────

export function useSaveActivityReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  /**
   * Save requisition-level activity report
   */
  const saveRequisitionActivityReport = useCallback(async (
    requisitionId: string,
    reportData: ActivityReportFormData
  ): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await service.saveRequisitionActivityReport(
        requisitionId,
        reportData,
        user.uid,
        user.displayName || undefined
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save activity report');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Save accountability-level activity report
   */
  const saveAccountabilityActivityReport = useCallback(async (
    requisitionId: string,
    accountabilityId: string,
    reportData: ActivityReportFormData
  ): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      await service.saveAccountabilityActivityReport(
        requisitionId,
        accountabilityId,
        reportData,
        user.uid,
        user.displayName || undefined
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save activity report');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    saveRequisitionActivityReport,
    saveAccountabilityActivityReport,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useSaveFundsAcknowledgement
// ─────────────────────────────────────────────────────────────────

export function useSaveFundsAcknowledgement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const saveFundsAcknowledgement = useCallback(async (
    requisitionId: string,
    acknowledgement: Omit<FundsAcknowledgementDocument, 'id' | 'generatedAt'>,
    pdfBlob?: Blob
  ): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const docId = await service.saveFundsAcknowledgement(
        requisitionId,
        acknowledgement,
        user.uid,
        user.displayName || undefined,
        pdfBlob
      );
      return docId;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save funds acknowledgement');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    saveFundsAcknowledgement,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useGetNextReceiptNumber
// Get the next receipt number for a project/year
// ─────────────────────────────────────────────────────────────────

export function useGetNextReceiptNumber() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const getNextReceiptNumber = useCallback(async (
    projectCode: string,
    prefix: string = 'Receipt',
    year?: number
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const receiptNumber = await service.getNextReceiptNumber(projectCode, prefix, year);
      return receiptNumber;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get receipt number');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    getNextReceiptNumber,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProjectManualRequisitions
// Fetch all manual requisitions linked to a specific project
// ─────────────────────────────────────────────────────────────────

export function useProjectManualRequisitions(projectId: string | undefined) {
  const [requisitions, setRequisitions] = useState<ManualRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = getManualRequisitionService(db);

  const fetchRequisitions = useCallback(async () => {
    if (!projectId) {
      setRequisitions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await service.getAllManualRequisitions({
        linkedProjectId: projectId,
      });
      setRequisitions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch project manual requisitions'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRequisitions();
  }, [fetchRequisitions]);

  // Calculate summary statistics
  const summary = {
    totalAmount: requisitions.reduce((sum, r) => sum + r.amount, 0),
    totalAccounted: requisitions.reduce((sum, r) => sum + (r.totalAccountedAmount || 0), 0),
    unaccountedAmount: requisitions.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0),
    count: requisitions.length,
    overdueCount: requisitions.filter(r => r.accountabilityStatus === 'overdue').length,
    completeCount: requisitions.filter(r => r.accountabilityStatus === 'complete').length,
  };

  return {
    requisitions,
    summary,
    loading,
    error,
    refresh: fetchRequisitions,
  };
}
