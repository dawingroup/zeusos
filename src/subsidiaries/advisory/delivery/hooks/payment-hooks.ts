/**
 * PAYMENT HOOKS
 * 
 * React hooks for payment operations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import {
  Payment,
  PaymentSummary,
} from '../types/payment';
import { IPC, IPCFormData } from '../types/ipc';
import { Requisition, RequisitionFormData } from '../types/requisition';
import { Accountability, AccountabilityFormData } from '../types/accountability';
import { PaymentService } from '../services/payment-service';
import { IPCService } from '../services/ipc-service';
import { RequisitionService } from '../services/requisition-service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface UseProjectPaymentsResult {
  payments: Payment[];
  summary: PaymentSummary;
  byType: {
    ipcs: Payment[];
    requisitions: Payment[];
    accountabilities: Payment[];
  };
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface UsePendingApprovalsResult {
  approvals: Payment[];
  loading: boolean;
  error: Error | null;
}

interface UsePaymentApprovalResult {
  approve: (paymentId: string, comments?: string) => Promise<void>;
  reject: (paymentId: string, reason: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

// ─────────────────────────────────────────────────────────────────
// HOOK: usePayment - Get single payment by ID
// ─────────────────────────────────────────────────────────────────

export function usePayment(
  db: Firestore,
  paymentId: string | null
) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => PaymentService.getInstance(db), [db]);

  const refresh = useCallback(async () => {
    if (!paymentId) {
      setPayment(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getPayment(paymentId);
      setPayment(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch payment'));
    } finally {
      setLoading(false);
    }
  }, [service, paymentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { payment, loading, error, refresh };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useUpdatePaymentCoInvestment
// ─────────────────────────────────────────────────────────────────

export function useUpdatePaymentCoInvestment(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => PaymentService.getInstance(db), [db]);

  const updateCoInvestment = useCallback(
    async (
      paymentId: string,
      coInvestmentEntryId: string | null,
      coInvestmentSourceName: string | null
    ): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updatePaymentCoInvestment(
          paymentId,
          coInvestmentEntryId,
          coInvestmentSourceName,
          userId
        );
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update co-investment');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { updateCoInvestment, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProjectPayments
// ─────────────────────────────────────────────────────────────────

export function useProjectPayments(
  db: Firestore,
  projectId: string | null,
  options: { realtime?: boolean } = {}
): UseProjectPaymentsResult {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => PaymentService.getInstance(db), [db]);

  const fetchPayments = useCallback(async () => {
    if (!projectId) {
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getPaymentsByProject(projectId);
      setPayments(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch payments'));
    } finally {
      setLoading(false);
    }
  }, [service, projectId]);

  useEffect(() => {
    if (!projectId) {
      setPayments([]);
      setLoading(false);
      return;
    }

    if (options.realtime) {
      setLoading(true);
      const unsubscribe = service.subscribeToProjectPayments(projectId, (data) => {
        setPayments(data);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      fetchPayments();
    }
  }, [projectId, options.realtime, service, fetchPayments]);

  // Calculate summary
  const summary = useMemo<PaymentSummary>(() => {
    const paidPayments = payments.filter(p => p.status === 'paid');
    const pendingPayments = payments.filter(p =>
      ['submitted', 'under_review', 'approved'].includes(p.status)
    );

    const retentionHeld = paidPayments.reduce((sum, p) => {
      const retention = p.deductions.find(d => d.type === 'retention');
      return sum + (retention?.amount || 0);
    }, 0);

    return {
      projectId: projectId || '',
      totalPaid: paidPayments.reduce((sum, p) => sum + p.netAmount, 0),
      totalPending: pendingPayments.reduce((sum, p) => sum + p.netAmount, 0),
      pendingCount: pendingPayments.length,
      retentionHeld,
      advanceOutstanding: 0,
      lastPaymentDate: paidPayments[0]?.paidAt?.toDate(),
    };
  }, [payments, projectId]);

  // Group by type
  const byType = useMemo(() => ({
    ipcs: payments.filter(p => p.paymentType === 'ipc'),
    requisitions: payments.filter(p => p.paymentType === 'requisition'),
    accountabilities: payments.filter(p => p.paymentType === 'accountability'),
  }), [payments]);

  return { payments, summary, byType, loading, error, refresh: fetchPayments };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: usePendingApprovals
// ─────────────────────────────────────────────────────────────────

export function usePendingApprovals(
  db: Firestore,
  userRole: string,
  options: { realtime?: boolean } = {}
): UsePendingApprovalsResult {
  const [approvals, setApprovals] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => PaymentService.getInstance(db), [db]);

  useEffect(() => {
    if (!userRole) {
      setApprovals([]);
      setLoading(false);
      return;
    }

    if (options.realtime) {
      setLoading(true);
      const unsubscribe = service.subscribeToPendingApprovals(userRole, (data) => {
        setApprovals(data);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      setLoading(true);
      service.getPendingApprovals(userRole)
        .then(setApprovals)
        .catch(err => setError(err instanceof Error ? err : new Error('Failed')))
        .finally(() => setLoading(false));
    }
  }, [userRole, options.realtime, service]);

  return { approvals, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: usePaymentApproval
// ─────────────────────────────────────────────────────────────────

export function usePaymentApproval(
  db: Firestore,
  userId: string,
  userName: string
): UsePaymentApprovalResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => PaymentService.getInstance(db), [db]);

  const approve = useCallback(
    async (paymentId: string, comments?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.approvePayment(paymentId, userId, userName, comments);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Approval failed');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId, userName]
  );

  const reject = useCallback(
    async (paymentId: string, reason: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.rejectPayment(paymentId, userId, userName, reason);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Rejection failed');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId, userName]
  );

  return { approve, reject, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCreateIPC
// ─────────────────────────────────────────────────────────────────

export function useCreateIPC(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => IPCService.getInstance(db), [db]);

  const createIPC = useCallback(
    async (data: IPCFormData): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.createIPC(data, userId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create IPC');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { createIPC, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProjectIPCs
// ─────────────────────────────────────────────────────────────────

export function useProjectIPCs(
  db: Firestore,
  projectId: string | null,
  includeAll: boolean = false
) {
  const [ipcs, setIPCs] = useState<IPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => IPCService.getInstance(db), [db]);

  useEffect(() => {
    if (!projectId) {
      setIPCs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    service.getProjectIPCs(projectId, includeAll)
      .then(setIPCs)
      .catch(err => setError(err instanceof Error ? err : new Error('Failed')))
      .finally(() => setLoading(false));
  }, [service, projectId, includeAll]);

  // Calculate cumulative stats
  const stats = useMemo(() => {
    const approved = ipcs.filter(ipc => ['approved', 'paid'].includes(ipc.status));
    return {
      count: ipcs.length,
      approvedCount: approved.length,
      totalCertified: approved.reduce((sum, ipc) => sum + ipc.thisCertified, 0),
      totalPaid: approved.filter(ipc => ipc.status === 'paid')
        .reduce((sum, ipc) => sum + ipc.netAmount, 0),
      latestIPC: ipcs[0] || null,
    };
  }, [ipcs]);

  return { ipcs, stats, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCreateRequisition
// ─────────────────────────────────────────────────────────────────

export function useCreateRequisition(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  const createRequisition = useCallback(
    async (data: RequisitionFormData): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.createRequisition(data, userId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create requisition');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { createRequisition, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProjectRequisitions
// ─────────────────────────────────────────────────────────────────

export function useProjectRequisitions(
  db: Firestore,
  projectId: string | null
) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  useEffect(() => {
    if (!projectId) {
      setRequisitions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    service.getProjectRequisitions(projectId)
      .then(setRequisitions)
      .catch(err => setError(err instanceof Error ? err : new Error('Failed')))
      .finally(() => setLoading(false));
  }, [service, projectId]);

  // Separate by accountability status
  const byAccountabilityStatus = useMemo(() => ({
    pending: requisitions.filter(r => r.accountabilityStatus === 'pending'),
    partial: requisitions.filter(r => r.accountabilityStatus === 'partial'),
    complete: requisitions.filter(r => r.accountabilityStatus === 'complete'),
    overdue: requisitions.filter(r => r.accountabilityStatus === 'overdue'),
  }), [requisitions]);

  return { requisitions, byAccountabilityStatus, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCreateAccountability
// ─────────────────────────────────────────────────────────────────

export function useCreateAccountability(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  const createAccountability = useCallback(
    async (data: AccountabilityFormData): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.createAccountability(data, userId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create accountability');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { createAccountability, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useRequisitionAccountabilities
// ─────────────────────────────────────────────────────────────────

export function useRequisitionAccountabilities(
  db: Firestore,
  requisitionId: string | null
) {
  const [accountabilities, setAccountabilities] = useState<Accountability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  useEffect(() => {
    if (!requisitionId) {
      setAccountabilities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    service.getRequisitionAccountabilities(requisitionId)
      .then(setAccountabilities)
      .catch(err => setError(err instanceof Error ? err : new Error('Failed')))
      .finally(() => setLoading(false));
  }, [service, requisitionId]);

  return { accountabilities, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useExpenseVerification
// ─────────────────────────────────────────────────────────────────

export function useExpenseVerification(
  db: Firestore,
  accountabilityId: string | null,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  const verifyExpense = useCallback(
    async (
      expenseId: string,
      approved: boolean,
      rejectionReason?: string
    ): Promise<void> => {
      if (!accountabilityId) throw new Error('No accountability selected');

      setLoading(true);
      setError(null);

      try {
        await service.verifyExpense(
          accountabilityId,
          expenseId,
          userId,
          approved,
          rejectionReason
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Verification failed');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, accountabilityId, userId]
  );

  const completeVerification = useCallback(
    async (notes?: string): Promise<void> => {
      if (!accountabilityId) throw new Error('No accountability selected');

      setLoading(true);
      setError(null);

      try {
        await service.completeVerification(accountabilityId, userId, notes);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to complete verification');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, accountabilityId, userId]
  );

  return { verifyExpense, completeVerification, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useSubmitPayment
// ─────────────────────────────────────────────────────────────────

export function useSubmitPayment(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => PaymentService.getInstance(db), [db]);

  const submitForApproval = useCallback(
    async (paymentId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.submitForApproval(paymentId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Submission failed');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const markAsPaid = useCallback(
    async (paymentId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.markAsPaid(paymentId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to mark as paid');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { submitForApproval, markAsPaid, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useIPC - Get single IPC with real-time updates
// ─────────────────────────────────────────────────────────────────

export function useIPC(
  db: Firestore,
  ipcId: string | null
) {
  const [ipc, setIPC] = useState<IPC | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => IPCService.getInstance(db), [db]);

  useEffect(() => {
    if (!ipcId) {
      setIPC(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    service.getIPC(ipcId)
      .then(setIPC)
      .catch(err => setError(err instanceof Error ? err : new Error('Failed to fetch IPC')))
      .finally(() => setLoading(false));
  }, [service, ipcId]);

  return { ipc, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useUpdateIPC - Update IPC draft
// ─────────────────────────────────────────────────────────────────

export function useUpdateIPC(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => IPCService.getInstance(db), [db]);

  const updateIPC = useCallback(
    async (ipcId: string, updates: Partial<IPCFormData>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updateIPC(ipcId, updates, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update IPC');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { updateIPC, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useRequisition - Get single requisition
// ─────────────────────────────────────────────────────────────────

export function useRequisition(
  db: Firestore,
  requisitionId: string | null
) {
  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  useEffect(() => {
    if (!requisitionId) {
      setRequisition(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    service.getRequisition(requisitionId)
      .then(setRequisition)
      .catch(err => setError(err instanceof Error ? err : new Error('Failed to fetch requisition')))
      .finally(() => setLoading(false));
  }, [service, requisitionId]);

  return { requisition, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useAccountability - Get single accountability
// ─────────────────────────────────────────────────────────────────

export function useAccountability(
  db: Firestore,
  accountabilityId: string | null
) {
  const [accountability, setAccountability] = useState<Accountability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  useEffect(() => {
    if (!accountabilityId) {
      setAccountability(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    service.getAccountability(accountabilityId)
      .then(setAccountability)
      .catch(err => setError(err instanceof Error ? err : new Error('Failed to fetch accountability')))
      .finally(() => setLoading(false));
  }, [service, accountabilityId]);

  return { accountability, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useReturnPayment - Return payment to draft status
// ─────────────────────────────────────────────────────────────────

export function useReturnPayment(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => PaymentService.getInstance(db), [db]);

  const returnToDraft = useCallback(
    async (paymentId: string, reason: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.returnPayment(paymentId, userId, reason);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to return payment');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { returnToDraft, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramPayments - Get all payments for a program
// ─────────────────────────────────────────────────────────────────

export function useProgramPayments(
  db: Firestore,
  programId: string | null
) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => PaymentService.getInstance(db), [db]);

  const fetchPayments = useCallback(async () => {
    if (!programId) {
      setPayments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getPaymentsByProgram(programId);
      setPayments(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch program payments'));
    } finally {
      setLoading(false);
    }
  }, [service, programId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const paidPayments = payments.filter(p => p.status === 'paid');
    const pendingPayments = payments.filter(p => 
      ['submitted', 'under_review', 'approved'].includes(p.status)
    );

    return {
      totalCount: payments.length,
      paidCount: paidPayments.length,
      pendingCount: pendingPayments.length,
      totalPaid: paidPayments.reduce((sum, p) => sum + p.netAmount, 0),
      totalPending: pendingPayments.reduce((sum, p) => sum + p.netAmount, 0),
    };
  }, [payments]);

  return { payments, stats, loading, error, refresh: fetchPayments };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useIPCCertification - QS certification for IPCs
// ─────────────────────────────────────────────────────────────────

export function useIPCCertification(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => IPCService.getInstance(db), [db]);

  const certifyByQS = useCallback(
    async (ipcId: string, comments?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.certifyByQS(ipcId, userId, comments);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Certification failed');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { certifyByQS, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useChildRequisitions
// ─────────────────────────────────────────────────────────────────

export function useChildRequisitions(
  db: Firestore,
  parentRequisitionId: string | null
) {
  const [children, setChildren] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  useEffect(() => {
    if (!parentRequisitionId) {
      setChildren([]);
      setLoading(false);
      return;
    }

    const fetchChildren = async () => {
      setLoading(true);
      try {
        const result = await service.getChildRequisitions(parentRequisitionId);
        setChildren(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch child requisitions'));
      } finally {
        setLoading(false);
      }
    };

    fetchChildren();
  }, [service, parentRequisitionId]);

  const materialChildren = useMemo(
    () => children.filter(c => {
      const t = c.requisitionType as string;
      return t === 'materials' || t === 'materials_services';
    }),
    [children]
  );

  const labourChildren = useMemo(
    () => children.filter(c => c.requisitionType === 'labour'),
    [children]
  );

  const totalChildAmount = useMemo(
    () => children.reduce((sum, c) => sum + (c.grossAmount || 0), 0),
    [children]
  );

  return { children, materialChildren, labourChildren, totalChildAmount, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCreateChildRequisition
// ─────────────────────────────────────────────────────────────────

export function useCreateChildRequisition(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  const createChildRequisition = useCallback(
    async (data: RequisitionFormData): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.createChildRequisition(data, userId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create child requisition');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { createChildRequisition, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useParentRequisition
// ─────────────────────────────────────────────────────────────────

export function useParentRequisition(
  db: Firestore,
  parentRequisitionId: string | null
) {
  const [parent, setParent] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  useEffect(() => {
    if (!parentRequisitionId) {
      setParent(null);
      setLoading(false);
      return;
    }

    const fetchParent = async () => {
      setLoading(true);
      try {
        const result = await service.getRequisition(parentRequisitionId);
        setParent(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch parent requisition'));
      } finally {
        setLoading(false);
      }
    };

    fetchParent();
  }, [service, parentRequisitionId]);

  return { parent, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useParentBOQItems
// ─────────────────────────────────────────────────────────────────

export function useParentBOQItems(
  db: Firestore,
  parentRequisitionId: string | null
) {
  const [boqItems, setBoqItems] = useState<Requisition['boqItems']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => RequisitionService.getInstance(db), [db]);

  useEffect(() => {
    if (!parentRequisitionId) {
      setBoqItems([]);
      setLoading(false);
      return;
    }

    const fetchItems = async () => {
      setLoading(true);
      try {
        const items = await service.getParentBOQItems(parentRequisitionId);
        setBoqItems(items);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch parent BOQ items'));
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [service, parentRequisitionId]);

  return { boqItems, loading, error };
}
